/*
    Copyright (C) 2026 Alexander Emanuelsson (alexemanuelol)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

    https://github.com/alexemanuelol/rustplusplus

*/

const Express = require("express");
const Http = require("http");
const Fs = require("fs");
const Path = require("path");
const { Server } = require("socket.io");
const Cors = require("cors");
const StatisticsTracker = require("../statistics/StatisticsTracker");
const setupStatisticsRoutes = require("./StatisticsRoutes");

class WebServer {
  constructor(client, port = 3000) {
    this.client = client;
    this.port = port;
    this.app = Express();
    this.server = Http.createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    // Cache server data to avoid rebuilding it multiple times
    this.cachedServerData = {};
    this.lastCacheUpdate = {};
    this.cachedCctvCodes = null;

    // CCTV streaming sessions (per socket and per guild)
    this.cctvSessions = new Map();
    this.cctvStreams = new Map();
    this.cctvFrameMinIntervalMs = 150;

    // Initialize statistics tracker (shared with client)
    if (!this.client.statisticsTracker) {
      this.client.statisticsTracker = new StatisticsTracker(client);
    }
    this.statisticsTracker = this.client.statisticsTracker;

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.startUpdateInterval();
  }

  setupMiddleware() {
    this.app.use(Cors());
    this.app.use(Express.json());
    this.app.use(Express.static(Path.join(__dirname, "..", "..", "public")));
    this.app.use(
      "/images",
      Express.static(Path.join(__dirname, "..", "resources", "images"))
    );
  }

  setupRoutes() {
    /* Get list of all guilds and their active servers */
    this.app.get("/api/guilds", (req, res) => {
      const guilds = [];

      for (const [guildId, rustplus] of Object.entries(
        this.client.rustplusInstances
      )) {
        if (!rustplus || !rustplus.isOperational) continue;

        const instance = this.client.getInstance(guildId);
        if (!instance) continue;

        const guildInfo = this.client.guilds.cache.get(guildId);

        guilds.push({
          guildId: guildId,
          guildName: guildInfo ? guildInfo.name : "Unknown",
          serverId: rustplus.serverId,
          serverName:
            instance.serverList[rustplus.serverId]?.title || "Unknown Server",
          isOperational: rustplus.isOperational,
        });
      }

      res.json(guilds);
    });

    /* Get CCTV codes for autocomplete */
    this.app.get("/api/cctv-codes", (req, res) => {
      try {
        if (!this.cachedCctvCodes) {
          const raw = Fs.readFileSync(
            Path.join(__dirname, "..", "staticFiles", "cctv.json"),
            "utf8"
          );
          const parsed = JSON.parse(raw);
          const codes = [];

          Object.values(parsed).forEach((entry) => {
            if (!entry || !Array.isArray(entry.codes)) return;
            entry.codes.forEach((code) => {
              if (!code) return;
              const normalized = String(code).replace(/\\\*/g, "*");
              codes.push(normalized);
            });
          });

          this.cachedCctvCodes = Array.from(new Set(codes)).sort();
        }

        res.json({ codes: this.cachedCctvCodes });
      } catch (error) {
        res.status(500).json({ error: "Failed to load CCTV codes" });
      }
    });

    /* Get server data for a specific guild */
    this.app.get("/api/server/:guildId", (req, res) => {
      const { guildId } = req.params;
      const data = this.getServerData(guildId);

      if (!data) {
        return res
          .status(404)
          .json({ error: "Server not found or not operational" });
      }

      res.json(data);
    });

    /* Get player avatar (proxied from Steam) */
    this.app.get("/api/avatar/:steamId", async (req, res) => {
      const { steamId } = req.params;

      try {
        // Fetch avatar from Rust Companion API and proxy it
        const companionUrl = `https://companion-rust.facepunch.com/api/avatar/${steamId}`;
        const fetch = (await import("node-fetch")).default;
        const response = await fetch(companionUrl);

        if (!response.ok) {
          throw new Error("Avatar not found");
        }

        // Set proper headers
        res.set("Content-Type", "image/jpeg");
        res.set("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
        res.set("Access-Control-Allow-Origin", "*");

        // Pipe the image data
        const buffer = await response.buffer();
        res.send(buffer);
      } catch (error) {
        // Return a 1x1 transparent pixel as fallback
        const transparentPixel = Buffer.from(
          "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
          "base64"
        );
        res.set("Content-Type", "image/gif");
        res.send(transparentPixel);
      }
    });

    /* Get map image for a specific guild */
    this.app.get("/api/map/:guildId", (req, res) => {
      const { guildId } = req.params;
      const rustplus = this.client.rustplusInstances[guildId];

      if (!rustplus || !rustplus.isOperational) {
        return res.status(404).json({ error: "Server not found" });
      }

      const mapImage = this.client.rustplusMaps[guildId];
      if (!mapImage) {
        return res.status(404).json({ error: "Map not available" });
      }

      const buffer = Buffer.from(mapImage, "base64");
      res.set("Content-Type", "image/jpeg");
      res.send(buffer);
    });

    /* Get switches for a specific guild */
    this.app.get("/api/switches/:guildId", (req, res) => {
      const { guildId } = req.params;
      const rustplus = this.client.rustplusInstances[guildId];

      if (!rustplus || !rustplus.isOperational) {
        return res.status(404).json({ error: "Server not found" });
      }

      const instance = this.client.getInstance(guildId);
      const switches = instance.serverList[rustplus.serverId]?.switches || {};

      res.json(switches);
    });

    /* Get notification settings for a specific guild */
    this.app.get("/api/server/:guildId/notification-settings", (req, res) => {
      const { guildId } = req.params;
      const instance = this.client.getInstance(guildId);
      if (!instance) {
        return res.status(404).json({ error: "Guild instance not found" });
      }
      res.json(instance.notificationSettings || {});
    });

    /* Update notification settings for a specific guild */
    this.app.post(
      "/api/server/:guildId/notification-settings",
      async (req, res) => {
        const { guildId } = req.params;
        const settings = req.body;
        const instance = this.client.getInstance(guildId);
        if (!instance) {
          return res.status(404).json({ error: "Guild instance not found" });
        }

        for (const [key, value] of Object.entries(settings)) {
          if (instance.notificationSettings[key]) {
            instance.notificationSettings[key].discord = value;
          }
        }

        this.client.setInstance(guildId, instance);
        res.json({ success: true, settings: instance.notificationSettings });
      }
    );

    /* Toggle a switch */
    this.app.post("/api/switch/:guildId/:entityId", async (req, res) => {
      const { guildId, entityId } = req.params;
      const { active } = req.body; // Expect boolean or 'toggle' or undefined (if simple toggle supported?)
      const rustplus = this.client.rustplusInstances[guildId];

      if (!rustplus || !rustplus.isOperational) {
        return res.status(404).json({ error: "Server not found" });
      }

      try {
        // If active is provided, use it. Otherwise assume toggle or handle error?
        // RustPlus.js seems to expect (entityId, on) where on is boolean.
        // If we don't pass 'on', what happens?
        // Depending on implementation, it might error or default.
        // We should enforce providing state for clarity or support simple toggle if we read state first.

        let targetState = active;
        if (targetState === undefined) {
          // If body doesn't specify, maybe we should error?
          // Or read current state and flip it?
          // WebServer doesn't track state perfectly unless we look at instance.serverList
          const instance = this.client.getInstance(guildId);
          const current =
            instance.serverList[rustplus.serverId]?.switches[entityId]?.active;
          targetState = !current;
        }

        const response = await rustplus.turnSmartSwitchAsync(
          entityId,
          targetState
        );

        // Update local state immediately for UI responsiveness (though polling/socket will confirm)
        const instance = this.client.getInstance(guildId);
        const server = instance.serverList[rustplus.serverId];
        if (server && server.switches[entityId]) {
          server.switches[entityId].active = targetState;
          this.client.setInstance(guildId, instance);

          // Also notify Discord? buttonHandler does it.
          const DiscordMessages = require("../discordTools/discordMessages.js");
          await DiscordMessages.sendSmartSwitchMessage(
            guildId,
            rustplus.serverId,
            entityId
          );

          // Broadcast update to WebUI immediately
          this.broadcastServerUpdate(guildId);
        }

        res.json({ success: true, response, active: targetState });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /* Edit a switch */
    this.app.post("/api/switch/:guildId/:entityId/edit", async (req, res) => {
      try {
        // Dynamic import to avoid circular dependencies
        const DiscordMessages = require("../discordTools/discordMessages.js");
        const Keywords = require("../util/keywords.js");

        const { guildId, entityId } = req.params;
        const { name, command, proximity, autoDayNightOnOff } = req.body;

        const instance = this.client.getInstance(guildId);
        const rustplus = this.client.rustplusInstances[guildId];

        if (!rustplus || !rustplus.isOperational) {
          return res.status(404).json({ error: "Server not found" });
        }

        const server = instance.serverList[rustplus.serverId];

        if (!server || !server.switches.hasOwnProperty(entityId)) {
          return res.status(404).json({ error: "Switch not found" });
        }

        if (name) server.switches[entityId].name = name;

        if (
          command &&
          command !== server.switches[entityId].command &&
          !Keywords.getListOfUsedKeywords(
            this.client,
            guildId,
            rustplus.serverId
          ).includes(command)
        ) {
          server.switches[entityId].command = command;
        }

        if (proximity !== undefined && proximity !== null && proximity >= 0) {
          server.switches[entityId].proximity = proximity;
        }

        if (autoDayNightOnOff !== undefined && autoDayNightOnOff !== null) {
          server.switches[entityId].autoDayNightOnOff = parseInt(
            autoDayNightOnOff
          );
        }

        this.client.setInstance(guildId, instance);

        await DiscordMessages.sendSmartSwitchMessage(
          guildId,
          rustplus.serverId,
          entityId
        );

        // Broadcast update to WebUI immediately
        this.broadcastServerUpdate(guildId);

        res.json({ success: true, switch: server.switches[entityId] });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /* Delete a switch */
    this.app.post("/api/switch/:guildId/:entityId/delete", async (req, res) => {
      try {
        // Dynamic import to avoid circular dependencies
        const DiscordTools = require("../discordTools/discordTools.js");
        const DiscordMessages = require("../discordTools/discordMessages.js");

        const { guildId, entityId } = req.params;
        const instance = this.client.getInstance(guildId);
        const rustplus = this.client.rustplusInstances[guildId];

        if (!rustplus || !rustplus.isOperational) {
          if (!instance.activeServer || instance.activeServer === null) {
            return res.status(404).json({ error: "No active server" });
          }
        }
        const serverId = rustplus ? rustplus.serverId : instance.activeServer;
        const server = instance.serverList[serverId];

        if (!server || !server.switches.hasOwnProperty(entityId)) {
          return res.status(404).json({ error: "Switch not found" });
        }

        // Delete Discord message
        if (server.switches[entityId].messageId) {
          await DiscordTools.deleteMessageById(
            guildId,
            instance.channelId.switches,
            server.switches[entityId].messageId
          );
        }

        // Delete local object
        delete server.switches[entityId];

        // Cleanup timeouts
        if (
          rustplus &&
          rustplus.currentSwitchTimeouts &&
          rustplus.currentSwitchTimeouts[entityId]
        ) {
          clearTimeout(rustplus.currentSwitchTimeouts[entityId]);
          delete rustplus.currentSwitchTimeouts[entityId];
        }

        // Update groups
        for (const [groupId, content] of Object.entries(server.switchGroups)) {
          if (content.switches.includes(entityId.toString())) {
            server.switchGroups[groupId].switches = content.switches.filter(
              (e) => e !== entityId.toString()
            );
            this.client.setInstance(guildId, instance);
            await DiscordMessages.sendSmartSwitchGroupMessage(
              guildId,
              serverId,
              groupId
            );
          }
        }

        this.client.setInstance(guildId, instance);

        // Broadcast update to WebUI immediately
        this.broadcastServerUpdate(guildId);

        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /* BattleMetrics Proxy to get full player list */
    this.app.get("/api/battlemetrics/players", async (req, res) => {
      const { q } = req.query;
      if (!q) return res.status(400).json({ error: "Query required" });

      try {
        const fetch = (await import("node-fetch")).default;

        // 1. Search for server
        // We use a loose search.
        const searchUrl = `https://api.battlemetrics.com/servers?filter[search]=${encodeURIComponent(
          q
        )}&page[size]=1&include=player`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        if (!searchData.data || searchData.data.length === 0) {
          return res
            .status(404)
            .json({ error: "Server not found on BattleMetrics" });
        }

        // The search result with "include=player" often contains the included players in the 'included' array
        const server = searchData.data[0];
        const included = searchData.included || [];

        // Map the included players
        const players = included
          .filter((item) => item.type === "player")
          .map((p) => ({
            name: p.attributes.name,
            id: p.id,
          }));

        // If 'included' is empty, we might need to fetch the server details explicitly if the search didn't return them?
        // Usually search+include works. If not, we fallback to just server details.

        res.json({
          serverId: server.id,
          serverName: server.attributes.name,
          battleMetricsUrl: `https://www.battlemetrics.com/servers/rust/${server.id}`,
          players: players, // List of { name, id }
          playerCount: server.attributes.players,
        });
      } catch (error) {
        console.error("BattleMetrics Proxy Error:", error);
        res.status(500).json({ error: "Failed to fetch from BattleMetrics" });
      }
    });

    /* BattleMetrics internal data access (synced with Discord Bot) */
    this.app.get("/api/battlemetrics/players/:guildId", async (req, res) => {
      const { guildId } = req.params;

      try {
        // Access the main DiscordBot client
        const client = this.client;
        if (!client.rustplusInstances[guildId]) {
          return res
            .status(404)
            .json({ error: "Rust+ instance not found for guild" });
        }

        const rustplus = client.rustplusInstances[guildId];
        const instance = client.getInstance(guildId);

        // Get server configuration
        const server = instance.serverList[rustplus.serverId];
        if (!server || !server.battlemetricsId) {
          return res
            .status(404)
            .json({ error: "BattleMetrics ID not configured for this server" });
        }

        const bmId = server.battlemetricsId;
        const bmInstance = client.battlemetricsInstances[bmId];

        if (!bmInstance) {
          return res
            .status(503)
            .json({
              error: "BattleMetrics data not yet loaded (Bot starting up?)",
            });
        }

        // Use the exact same logic as the Discord bot command (players.js)
        // getOnlinePlayerIdsOrderedByTime returns IDs sorted by online time
        const onlineIds = bmInstance.getOnlinePlayerIdsOrderedByTime();

        const players = onlineIds.map((id) => {
          const p = bmInstance.players[id];
          const time = bmInstance.getOnlineTime(id);
          return {
            id: id,
            name: p.name,
            time: time ? time[1] : "00:00", // Formatted time
            rawTime: time ? time[0] : 0, // Seconds
            url: p.url,
          };
        });

        res.json({
          serverId: bmId,
          serverName: bmInstance.server_name,
          battleMetricsUrl: `https://www.battlemetrics.com/servers/rust/${bmId}`,
          players: players,
          playerCount: players.length,
        });
      } catch (error) {
        console.error("BattleMetrics Internal Error:", error);
        res
          .status(500)
          .json({ error: "Internal failure accessing BattleMetrics data" });
      }
    });

    /* Setup statistics routes */
    setupStatisticsRoutes(this.app, this.statisticsTracker);

    /* --- Tracker API Endpoints --- */

    /* Get trackers for a specific guild */
    this.app.get("/api/trackers/:guildId", (req, res) => {
      const { guildId } = req.params;
      const instance = this.client.getInstance(guildId);
      if (!instance)
        return res.status(404).json({ error: "Instance not found" });
      res.json(instance.trackers || {});
    });

    /* Create a tracker */
    this.app.post("/api/tracker/:guildId/create", async (req, res) => {
      try {
        const { guildId } = req.params;
        const { serverId } = req.body;
        const instance = this.client.getInstance(guildId);
        const server = instance.serverList[serverId];

        if (!server) return res.status(404).json({ error: "Server not found" });

        const DiscordTools = require("../discordTools/discordTools.js");
        const DiscordMessages = require("../discordTools/discordMessages.js");

        const trackerId = this.client.findAvailableTrackerId(guildId);
        const trackerChannelName = `tracker-${trackerId}`;
        const newChannel = await DiscordTools.addTextChannel(
          guildId,
          trackerChannelName
        );

        if (newChannel) {
          const category = DiscordTools.getCategoryById(
            guildId,
            instance.channelId.category
          );
          if (category) {
            try {
              await newChannel.setParent(category.id);
              await newChannel.lockPermissions();
            } catch (e) {
              console.error("Error setting parent for tracker channel:", e);
            }
          }

          instance.trackers[trackerId] = {
            name: "Tracker",
            serverId: serverId,
            battlemetricsId: server.battlemetricsId,
            title: server.title,
            img: server.img,
            clanTag: "",
            everyone: false,
            inGame: true,
            players: [],
            messageId: null,
            channelId: newChannel.id,
          };

          this.client.setInstance(guildId, instance);
          await DiscordMessages.sendTrackerMessage(guildId, trackerId);
          this.broadcastServerUpdate(guildId);

          res.json({
            success: true,
            trackerId,
            tracker: instance.trackers[trackerId],
          });
        } else {
          res.status(500).json({ error: "Could not create Discord channel" });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /* Edit a tracker */
    this.app.post("/api/tracker/:guildId/:trackerId/edit", async (req, res) => {
      try {
        const { guildId, trackerId } = req.params;
        const {
          name,
          battlemetricsId,
          clanTag,
          everyone,
          inGame,
          channelName,
        } = req.body;
        const instance = this.client.getInstance(guildId);
        const tracker = instance.trackers[trackerId];

        if (!tracker)
          return res.status(404).json({ error: "Tracker not found" });

        const DiscordTools = require("../discordTools/discordTools.js");
        const DiscordMessages = require("../discordTools/discordMessages.js");
        const Battlemetrics = require("../structures/Battlemetrics");
        const Constants = require("../util/constants.js");

        if (name) tracker.name = name;
        if (clanTag !== undefined) {
          tracker.clanTag = clanTag;
          this.client.battlemetricsIntervalCounter = 0;
        }
        if (everyone !== undefined) tracker.everyone = everyone;
        if (inGame !== undefined) tracker.inGame = inGame;

        if (channelName && tracker.channelId) {
          const channel = DiscordTools.getTextChannelById(
            guildId,
            tracker.channelId
          );
          if (channel) {
            try {
              await channel.setName(channelName);
            } catch (e) {
              console.error("Error renaming channel:", e);
            }
          }
        }

        if (battlemetricsId && battlemetricsId !== tracker.battlemetricsId) {
          if (
            this.client.battlemetricsInstances.hasOwnProperty(battlemetricsId)
          ) {
            const bmInstance = this.client.battlemetricsInstances[
              battlemetricsId
            ];
            tracker.battlemetricsId = battlemetricsId;
            tracker.serverId = `${bmInstance.server_ip}-${bmInstance.server_port}`;
            tracker.img = Constants.DEFAULT_SERVER_IMG;
            tracker.title = bmInstance.server_name;
          } else {
            const bmInstance = new Battlemetrics(battlemetricsId);
            await bmInstance.setup();
            if (bmInstance.lastUpdateSuccessful) {
              this.client.battlemetricsInstances[battlemetricsId] = bmInstance;
              tracker.battlemetricsId = battlemetricsId;
              tracker.serverId = `${bmInstance.server_ip}-${bmInstance.server_port}`;
              tracker.img = Constants.DEFAULT_SERVER_IMG;
              tracker.title = bmInstance.server_name;
            }
          }
        }

        this.client.setInstance(guildId, instance);
        await DiscordMessages.sendTrackerMessage(guildId, trackerId);
        this.broadcastServerUpdate(guildId);

        res.json({ success: true, tracker });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /* Delete a tracker */
    this.app.post(
      "/api/tracker/:guildId/:trackerId/delete",
      async (req, res) => {
        try {
          const { guildId, trackerId } = req.params;
          const instance = this.client.getInstance(guildId);
          const tracker = instance.trackers[trackerId];

          if (!tracker)
            return res.status(404).json({ error: "Tracker not found" });

          const DiscordTools = require("../discordTools/discordTools.js");

          if (tracker.channelId) {
            try {
              await DiscordTools.removeTextChannel(guildId, tracker.channelId);
            } catch (e) {
              console.error("Error deleting channel:", e);
            }
          }

          delete instance.trackers[trackerId];
          this.client.setInstance(guildId, instance);
          this.broadcastServerUpdate(guildId);

          res.json({ success: true });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    /* Add player to tracker */
    this.app.post(
      "/api/tracker/:guildId/:trackerId/players/add",
      async (req, res) => {
        try {
          const { guildId, trackerId } = req.params;
          const { id } = req.body;
          const instance = this.client.getInstance(guildId);
          const tracker = instance.trackers[trackerId];

          if (!tracker)
            return res.status(404).json({ error: "Tracker not found" });

          const DiscordMessages = require("../discordTools/discordMessages.js");
          const Scrape = require("../util/scrape.js");
          const Constants = require("../util/constants.js");

          const isSteamId64 = id.length === Constants.STEAMID64_LENGTH;
          const bmInstance = this.client.battlemetricsInstances[
            tracker.battlemetricsId
          ];

          if (
            (isSteamId64 && tracker.players.some((e) => e.steamId === id)) ||
            (!isSteamId64 &&
              tracker.players.some(
                (e) => e.playerId === id && e.steamId === null
              ))
          ) {
            return res.status(400).json({ error: "Player already added" });
          }

          let name = null;
          let steamId = null;
          let playerId = null;

          if (isSteamId64) {
            steamId = id;
            name = await Scrape.scrapeSteamProfileName(this.client, id);
            if (name && bmInstance) {
              playerId = Object.keys(bmInstance.players).find(
                (e) => bmInstance.players[e]["name"] === name
              );
            }
          } else {
            playerId = id;
            name =
              bmInstance && bmInstance.players[id]
                ? bmInstance.players[id]["name"]
                : "-";
          }

          tracker.players.push({
            name: name || "-",
            steamId,
            playerId: playerId || null,
          });
          this.client.setInstance(guildId, instance);
          await DiscordMessages.sendTrackerMessage(guildId, trackerId);
          this.broadcastServerUpdate(guildId);

          res.json({ success: true, players: tracker.players });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    /* Remove player from tracker */
    this.app.post(
      "/api/tracker/:guildId/:trackerId/players/remove",
      async (req, res) => {
        try {
          const { guildId, trackerId } = req.params;
          const { id } = req.body;
          const instance = this.client.getInstance(guildId);
          const tracker = instance.trackers[trackerId];

          if (!tracker)
            return res.status(404).json({ error: "Tracker not found" });

          const DiscordMessages = require("../discordTools/discordMessages.js");
          const Constants = require("../util/constants.js");

          const isSteamId64 = id.length === Constants.STEAMID64_LENGTH;

          if (isSteamId64) {
            tracker.players = tracker.players.filter((e) => e.steamId !== id);
          } else {
            tracker.players = tracker.players.filter((e) => e.playerId !== id);
          }

          this.client.setInstance(guildId, instance);
          await DiscordMessages.sendTrackerMessage(guildId, trackerId);
          this.broadcastServerUpdate(guildId);

          res.json({ success: true, players: tracker.players });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );
  }

  setupWebSocket() {
    this.io.on("connection", (socket) => {
      this.client.log(
        this.client.intlGet(null, "infoCap"),
        `WebUI: client connected: ${socket.id}`
      );

      socket.on("subscribe", (guildId) => {
        socket.join(`guild-${guildId}`);
        this.client.log(
          this.client.intlGet(null, "infoCap"),
          `WebUI: client ${socket.id} subscribed to guild ${guildId}`
        );

        /* Send initial data */
        const data = this.getServerData(guildId);
        if (data) {
          socket.emit("serverUpdate", data);
        }
      });

      socket.on("unsubscribe", (guildId) => {
        socket.leave(`guild-${guildId}`);
        this.client.log(
          this.client.intlGet(null, "infoCap"),
          `WebUI: client ${socket.id} unsubscribed from guild ${guildId}`
        );
      });

      socket.on("cctv:subscribe", async (payload) => {
        const guildId = payload && payload.guildId ? payload.guildId : null;
        const cameraId = payload && payload.cameraId ? payload.cameraId : null;
        await this.startCctvSession(socket, guildId, cameraId);
      });

      socket.on("cctv:unsubscribe", async (payload) => {
        const cameraId = payload && payload.cameraId ? payload.cameraId : null;
        await this.stopCctvSessionBySocket(socket.id, cameraId, "stopped");
      });

      socket.on("disconnect", () => {
        this.stopCctvSessionBySocket(socket.id, null, "disconnected");
        this.client.log(
          this.client.intlGet(null, "infoCap"),
          `WebUI: client disconnected: ${socket.id}`
        );
      });
    });
  }

  async startCctvSession(socket, guildId, cameraId) {
    if (!guildId || !cameraId) {
      socket.emit("cctv:error", {
        message: "Missing guild or camera id",
        cameraId: cameraId || null,
      });
      return;
    }

    const rustplus = this.client.rustplusInstances[guildId];
    if (!rustplus || !rustplus.isOperational) {
      socket.emit("cctv:error", {
        message: "Server not available",
        cameraId: cameraId,
      });
      return;
    }

    const normalizedCameraId = String(cameraId).trim().toUpperCase();
    if (!normalizedCameraId) {
      socket.emit("cctv:error", {
        message: "Invalid camera id",
        cameraId: cameraId,
      });
      return;
    }

    const existingSessions = this.cctvSessions.get(socket.id);
    if (existingSessions && existingSessions.has(normalizedCameraId)) {
      socket.emit("cctv:status", {
        state: "streaming",
        cameraId: normalizedCameraId,
      });
      return;
    }

    await this.stopCctvSessionBySocket(
      socket.id,
      normalizedCameraId,
      "replaced"
    );

    const streamKey = `${guildId}:${normalizedCameraId}`;
    const existingStream = this.cctvStreams.get(streamKey);
    if (existingStream) {
      existingStream.subscribers.add(socket.id);
      this.addSocketSession(socket.id, guildId, normalizedCameraId);
      this.client.log(
        this.client.intlGet(null, "infoCap"),
        `WebUI: CCTV reused ${normalizedCameraId} for socket ${socket.id}`
      );
      socket.emit("cctv:status", {
        state: "streaming",
        cameraId: normalizedCameraId,
      });
      return;
    }

    let camera;
    try {
      camera = rustplus.getCamera(normalizedCameraId);
    } catch (error) {
      socket.emit("cctv:error", {
        message: error.message || "Unable to access camera",
        cameraId: normalizedCameraId,
      });
      return;
    }

    if (!camera) {
      socket.emit("cctv:error", {
        message: "Camera not available",
        cameraId: normalizedCameraId,
      });
      return;
    }

    this.client.log(
      this.client.intlGet(null, "infoCap"),
      `WebUI: CCTV subscribing ${normalizedCameraId} for socket ${socket.id}`
    );

    const stream = {
      key: streamKey,
      guildId: guildId,
      cameraId: normalizedCameraId,
      camera: camera,
      lastFrameAt: 0,
      onRender: null,
      subscribers: new Set([socket.id]),
    };

    stream.onRender = (frame) => {
      const now = Date.now();
      if (now - stream.lastFrameAt < this.cctvFrameMinIntervalMs) return;
      stream.lastFrameAt = now;

      const payload = {
        cameraId: normalizedCameraId,
        frame: frame.toString("base64"),
      };

      stream.subscribers.forEach((subscriberId) => {
        this.io.to(subscriberId).emit("cctv:frame", payload);
      });
    };

    camera.on("render", stream.onRender);

    try {
      await camera.subscribe();
    } catch (error) {
      camera.off("render", stream.onRender);
      const message = error?.message || "Failed to subscribe";
      socket.emit("cctv:error", { message, cameraId: normalizedCameraId });
      this.client.log(
        this.client.intlGet(null, "infoCap"),
        `WebUI: CCTV subscribe failed ${normalizedCameraId}: ${message}`
      );
      if (error?.stack) {
        this.client.log(
          this.client.intlGet(null, "infoCap"),
          `WebUI: CCTV subscribe stack ${normalizedCameraId}: ${error.stack}`
        );
      }
      return;
    }

    this.cctvStreams.set(streamKey, stream);
    this.addSocketSession(socket.id, guildId, normalizedCameraId);
    this.client.log(
      this.client.intlGet(null, "infoCap"),
      `WebUI: CCTV subscribed ${normalizedCameraId} for socket ${socket.id}`
    );
    socket.emit("cctv:status", {
      state: "streaming",
      cameraId: normalizedCameraId,
    });
  }

  async stopCctvSessionBySocket(socketId, cameraId = null, reason = "stopped") {
    const sessions = this.cctvSessions.get(socketId);
    if (!sessions) return;

    if (cameraId) {
      const session = sessions.get(cameraId);
      if (session) {
        await this.stopCctvSession(session, reason);
        sessions.delete(cameraId);
      }
    } else {
      for (const session of sessions.values()) {
        await this.stopCctvSession(session, reason);
      }
      sessions.clear();
    }

    if (sessions.size === 0) {
      this.cctvSessions.delete(socketId);
    }
  }

  async stopCctvSession(session, reason = "stopped") {
    if (!session) return;
    const streamKey = `${session.guildId}:${session.cameraId}`;
    const stream = this.cctvStreams.get(streamKey);

    if (stream) {
      stream.subscribers.delete(session.socketId);
      this.client.log(
        this.client.intlGet(null, "infoCap"),
        `WebUI: CCTV unsubscribed ${session.cameraId} for socket ${session.socketId}`
      );

      if (stream.subscribers.size === 0) {
        try {
          if (stream.camera && stream.onRender) {
            stream.camera.off("render", stream.onRender);
          }
          if (stream.camera && stream.camera.unsubscribe) {
            await stream.camera.unsubscribe();
          }
        } catch (error) {
          this.client.log(
            this.client.intlGet(null, "infoCap"),
            `WebUI: camera unsubscribe failed: ${error.message}`
          );
        }

        this.client.log(
          this.client.intlGet(null, "infoCap"),
          `WebUI: CCTV stream closed ${session.cameraId}`
        );
        this.cctvStreams.delete(streamKey);
      }
    }

    this.io.to(session.socketId).emit("cctv:status", {
      state: "stopped",
      cameraId: session.cameraId,
      reason,
    });
  }

  addSocketSession(socketId, guildId, cameraId) {
    const socketSessions = this.cctvSessions.get(socketId) || new Map();
    socketSessions.set(cameraId, {
      socketId,
      guildId,
      cameraId,
    });
    this.cctvSessions.set(socketId, socketSessions);
  }

  getServerData(guildId, useCache = true) {
    // Use cached data if it's less than 5 seconds old
    const now = Date.now();
    if (
      useCache &&
      this.cachedServerData[guildId] &&
      this.lastCacheUpdate[guildId] &&
      now - this.lastCacheUpdate[guildId] < 5000
    ) {
      return this.cachedServerData[guildId];
    }

    const rustplus = this.client.rustplusInstances[guildId];

    if (!rustplus || !rustplus.isOperational) {
      return null;
    }

    const instance = this.client.getInstance(guildId);
    const serverInfo = instance.serverList[rustplus.serverId];

    const data = {
      guildId: guildId,
      serverId: rustplus.serverId,
      serverName: serverInfo?.title || "Unknown",
      info: rustplus.info
        ? {
            name: rustplus.info.name,
            map: rustplus.info.map,
            mapSize: rustplus.info.mapSize,
            players: rustplus.info.players,
            maxPlayers: rustplus.info.maxPlayers,
            queuedPlayers: rustplus.info.queuedPlayers,
            seed: rustplus.info.seed,
            wipeTime: rustplus.info.wipeTime,
          }
        : null,
      time: rustplus.time
        ? {
            dayLengthMinutes: rustplus.time.dayLengthMinutes,
            time: rustplus.time.time,
            sunrise: rustplus.time.sunrise,
            sunset: rustplus.time.sunset,
            isDay: rustplus.time.isDay(),
          }
        : null,
      map: rustplus.map
        ? {
            width: rustplus.map.width,
            height: rustplus.map.height,
            oceanMargin: rustplus.map.oceanMargin,
            monuments: rustplus.map.monuments,
          }
        : null,
      team: rustplus.team
        ? {
            leaderSteamId: rustplus.team.leaderSteamId,
            players: rustplus.team.players.map((p) => ({
              steamId: p.steamId,
              name: p.name,
              x: p.x,
              y: p.y,
              isOnline: p.isOnline,
              isAlive: p.isAlive,
              spawnTime: p.spawnTime,
              deathTime: p.deathTime,
            })),
          }
        : null,
      mapMarkers: rustplus.mapMarkers
        ? {
            players: rustplus.mapMarkers.players,
            vendingMachines: rustplus.mapMarkers.vendingMachines.map((vm) => ({
              ...vm,
              sellOrders: vm.sellOrders.map((order) => ({
                ...order,
                itemName: this.client.items.getName(order.itemId),
                currencyName: this.client.items.getName(order.currencyId),
              })),
            })),
            ch47s: rustplus.mapMarkers.ch47s,
            cargoShips: rustplus.mapMarkers.cargoShips,
            patrolHelicopters: rustplus.mapMarkers.patrolHelicopters,
            genericRadiuses: rustplus.mapMarkers.genericRadiuses,
            travelingVendors: rustplus.mapMarkers.travelingVendors,
            patrolHelicopterDestroyedLocation:
              rustplus.mapMarkers.patrolHelicopterDestroyedLocation,
            timeSincePatrolHelicopterWasDestroyed:
              rustplus.mapMarkers.timeSincePatrolHelicopterWasDestroyed,
          }
        : null,
      markers: rustplus.markers || {},
      events: rustplus.events || {
        all: [],
        cargo: [],
        heli: [],
        small: [],
        large: [],
        chinook: [],
      },
      switches: serverInfo?.switches || {},
      switchGroups: serverInfo?.switchGroups || {},
      trackers: this.enrichTrackersWithPlayerData(
        guildId,
        instance.trackers || {}
      ),
    };

    // Cache the data
    this.cachedServerData[guildId] = data;
    this.lastCacheUpdate[guildId] = now;

    return data;
  }

  enrichTrackersWithPlayerData(guildId, trackers) {
    const enriched = JSON.parse(JSON.stringify(trackers));
    for (const [trackerId, tracker] of Object.entries(enriched)) {
      if (!tracker.players) continue;

      const bmInstance = this.client.battlemetricsInstances[
        tracker.battlemetricsId
      ];
      if (!bmInstance) continue;

      tracker.players = tracker.players.map((player) => {
        const bmPlayer =
          bmInstance.players[player.playerId] ||
          Object.values(bmInstance.players).find(
            (p) => p.steamId === player.steamId
          );

        if (bmPlayer) {
          return {
            ...player,
            isOnline: bmPlayer.status === true,
            battlemetricsId: bmPlayer.id,
            steamId: player.steamId || bmPlayer.steamId, // Ensure we have steamId for avatars
            updatedAt: bmPlayer.updatedAt,
            logoutDate: bmPlayer.logoutDate,
          };
        }
        return { ...player, isOnline: false };
      });
    }
    return enriched;
  }

  startUpdateInterval() {
    /* Update cache and broadcast to all connected clients
     * Uses same interval as polling to stay synchronized
     * This does NOT make additional Rust+ API calls - it only broadcasts
     * the data that was already fetched by the polling handler */
    const updateInterval = this.client.pollingIntervalMs || 10000;

    this.client.log(
      this.client.intlGet(null, "infoCap"),
      `WebUI: broadcasting updates every ${updateInterval}ms (synced with polling)`
    );

    setInterval(() => {
      for (const [guildId, rustplus] of Object.entries(
        this.client.rustplusInstances
      )) {
        if (!rustplus || !rustplus.isOperational) continue;
        // Force refresh cache and get new data (from memory, not Rust+ API)
        const data = this.getServerData(guildId, false);
        if (data) {
          // Broadcast to all clients subscribed to this guild
          this.io.to(`guild-${guildId}`).emit("serverUpdate", data);
        }
      }
    }, updateInterval);
  }

  start() {
    this.server.listen(this.port, () => {
      this.client.log(
        this.client.intlGet(null, "infoCap"),
        `WebUI: server running on http://localhost:${this.port}`
      );
    });
  }

  broadcastTrailReset(guildId, steamId) {
    this.io.to(`guild-${guildId}`).emit("resetPlayerTrail", { steamId });
  }

  broadcastServerUpdate(guildId) {
    const data = this.getServerData(guildId, false);
    if (data) {
      this.io.to(`guild-${guildId}`).emit("serverUpdate", data);
    }
  }

  broadcastGuildsUpdate() {
    this.client.log(
      this.client.intlGet(null, "infoCap"),
      "WebUI: broadcasting guilds update to all clients"
    );
    this.io.emit("guildsUpdate");
  }

  broadcastTeamDeath(guildId, steamId, playerName, x, y) {
    this.io.to(`guild-${guildId}`).emit("teamDeath", {
      steam_id: steamId,
      player_name: playerName,
      x: x,
      y: y,
    });
  }

  broadcastNotification(guildId, type, message) {
    this.client.log(
      this.client.intlGet(null, "infoCap"),
      `WebUI: broadcasting notification to guild ${guildId}: ${type}`
    );
    this.io.to(`guild-${guildId}`).emit("notification", { type, message });
  }

  broadcastChatMessage(guildId, message) {
    this.client.log(
      this.client.intlGet(null, "infoCap"),
      `WebUI: broadcasting chat message to guild ${guildId} from ${message.player_name}`
    );
    this.io.to(`guild-${guildId}`).emit("chatMessage", message);
  }

  stop() {
    if (this.statisticsTracker) {
      this.statisticsTracker.shutdown();
    }
    this.server.close();
  }
}

module.exports = WebServer;