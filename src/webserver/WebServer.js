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

const Express = require('express');
const Http = require('http');
const Path = require('path');
const { Server } = require('socket.io');
const Cors = require('cors');
const StatisticsTracker = require('../statistics/StatisticsTracker');
const setupStatisticsRoutes = require('./StatisticsRoutes');

class WebServer {
    constructor(client, port = 3000) {
        this.client = client;
        this.port = port;
        this.app = Express();
        this.server = Http.createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            }
        });

        // Cache server data to avoid rebuilding it multiple times
        this.cachedServerData = {};
        this.lastCacheUpdate = {};

        // Initialize statistics tracker
        this.statisticsTracker = new StatisticsTracker(client);

        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.startUpdateInterval();
    }

    setupMiddleware() {
        this.app.use(Cors());
        this.app.use(Express.json());
        this.app.use(Express.static(Path.join(__dirname, '..', '..', 'public')));
    }

    setupRoutes() {
        /* Get list of all guilds and their active servers */
        this.app.get('/api/guilds', (req, res) => {
            const guilds = [];
            
            for (const [guildId, rustplus] of Object.entries(this.client.rustplusInstances)) {
                if (!rustplus || !rustplus.isOperational) continue;
                
                const instance = this.client.getInstance(guildId);
                if (!instance) continue;

                const guildInfo = this.client.guilds.cache.get(guildId);
                
                guilds.push({
                    guildId: guildId,
                    guildName: guildInfo ? guildInfo.name : 'Unknown',
                    serverId: rustplus.serverId,
                    serverName: instance.serverList[rustplus.serverId]?.title || 'Unknown Server',
                    isOperational: rustplus.isOperational
                });
            }
            
            res.json(guilds);
        });

        /* Get server data for a specific guild */
        this.app.get('/api/server/:guildId', (req, res) => {
            const { guildId } = req.params;
            const data = this.getServerData(guildId);
            
            if (!data) {
                return res.status(404).json({ error: 'Server not found or not operational' });
            }
            
            res.json(data);
        });

        /* Get player avatar (proxied from Steam) */
        this.app.get('/api/avatar/:steamId', async (req, res) => {
            const { steamId } = req.params;
            
            try {
                // Fetch avatar from Rust Companion API and proxy it
                const companionUrl = `https://companion-rust.facepunch.com/api/avatar/${steamId}`;
                const fetch = (await import('node-fetch')).default;
                const response = await fetch(companionUrl);
                
                if (!response.ok) {
                    throw new Error('Avatar not found');
                }
                
                // Set proper headers
                res.set('Content-Type', 'image/jpeg');
                res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
                res.set('Access-Control-Allow-Origin', '*');
                
                // Pipe the image data
                const buffer = await response.buffer();
                res.send(buffer);
            } catch (error) {
                // Return a 1x1 transparent pixel as fallback
                const transparentPixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
                res.set('Content-Type', 'image/gif');
                res.send(transparentPixel);
            }
        });

        /* Get map image for a specific guild */
        this.app.get('/api/map/:guildId', (req, res) => {
            const { guildId } = req.params;
            const rustplus = this.client.rustplusInstances[guildId];
            
            if (!rustplus || !rustplus.isOperational) {
                return res.status(404).json({ error: 'Server not found' });
            }

            const mapImage = this.client.rustplusMaps[guildId];
            if (!mapImage) {
                return res.status(404).json({ error: 'Map not available' });
            }

            const buffer = Buffer.from(mapImage, 'base64');
            res.set('Content-Type', 'image/jpeg');
            res.send(buffer);
        });

        /* Get switches for a specific guild */
        this.app.get('/api/switches/:guildId', (req, res) => {
            const { guildId } = req.params;
            const rustplus = this.client.rustplusInstances[guildId];
            
            if (!rustplus || !rustplus.isOperational) {
                return res.status(404).json({ error: 'Server not found' });
            }

            const instance = this.client.getInstance(guildId);
            const switches = instance.serverList[rustplus.serverId]?.switches || {};
            
            res.json(switches);
        });

        /* Toggle a switch */
        this.app.post('/api/switch/:guildId/:entityId', async (req, res) => {
            const { guildId, entityId } = req.params;
            const rustplus = this.client.rustplusInstances[guildId];
            
            if (!rustplus || !rustplus.isOperational) {
                return res.status(404).json({ error: 'Server not found' });
            }

            try {
                const response = await rustplus.turnSmartSwitchAsync(entityId);
                res.json({ success: true, response });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        /* Setup statistics routes */
        setupStatisticsRoutes(this.app, this.statisticsTracker);
    }

    setupWebSocket() {
        this.io.on('connection', (socket) => {
            this.client.log(this.client.intlGet(null, 'infoCap'), `WebUI: client connected: ${socket.id}`);

            socket.on('subscribe', (guildId) => {
                socket.join(`guild-${guildId}`);
                this.client.log(this.client.intlGet(null, 'infoCap'), `WebUI: client ${socket.id} subscribed to guild ${guildId}`);
                
                /* Send initial data */
                const data = this.getServerData(guildId);
                if (data) {
                    socket.emit('serverUpdate', data);
                }
            });

            socket.on('unsubscribe', (guildId) => {
                socket.leave(`guild-${guildId}`);
                this.client.log(this.client.intlGet(null, 'infoCap'), `WebUI: client ${socket.id} unsubscribed from guild ${guildId}`);
            });

            socket.on('disconnect', () => {
                this.client.log(this.client.intlGet(null, 'infoCap'), `WebUI: client disconnected: ${socket.id}`);
            });
        });
    }

    getServerData(guildId, useCache = true) {
        // Use cached data if it's less than 5 seconds old
        const now = Date.now();
        if (useCache && this.cachedServerData[guildId] && 
            this.lastCacheUpdate[guildId] && 
            (now - this.lastCacheUpdate[guildId]) < 5000) {
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
            serverName: serverInfo?.title || 'Unknown',
            info: rustplus.info ? {
                name: rustplus.info.name,
                map: rustplus.info.map,
                mapSize: rustplus.info.mapSize,
                players: rustplus.info.players,
                maxPlayers: rustplus.info.maxPlayers,
                queuedPlayers: rustplus.info.queuedPlayers,
                seed: rustplus.info.seed,
                wipeTime: rustplus.info.wipeTime
            } : null,
            time: rustplus.time ? {
                dayLengthMinutes: rustplus.time.dayLengthMinutes,
                time: rustplus.time.time,
                sunrise: rustplus.time.sunrise,
                sunset: rustplus.time.sunset,
                isDay: rustplus.time.isDay()
            } : null,
            map: rustplus.map ? {
                width: rustplus.map.width,
                height: rustplus.map.height,
                oceanMargin: rustplus.map.oceanMargin,
                monuments: rustplus.map.monuments
            } : null,
            team: rustplus.team ? {
                leaderSteamId: rustplus.team.leaderSteamId,
                players: rustplus.team.players.map(p => ({
                    steamId: p.steamId,
                    name: p.name,
                    x: p.x,
                    y: p.y,
                    isOnline: p.isOnline,
                    isAlive: p.isAlive,
                    spawnTime: p.spawnTime,
                    deathTime: p.deathTime
                }))
            } : null,
            mapMarkers: rustplus.mapMarkers ? {
                players: rustplus.mapMarkers.players,
                vendingMachines: rustplus.mapMarkers.vendingMachines,
                ch47s: rustplus.mapMarkers.ch47s,
                cargoShips: rustplus.mapMarkers.cargoShips,
                patrolHelicopters: rustplus.mapMarkers.patrolHelicopters,
                genericRadiuses: rustplus.mapMarkers.genericRadiuses,
                travelingVendors: rustplus.mapMarkers.travelingVendors,
                patrolHelicopterDestroyedLocation: rustplus.mapMarkers.patrolHelicopterDestroyedLocation,
                timeSincePatrolHelicopterWasDestroyed: rustplus.mapMarkers.timeSincePatrolHelicopterWasDestroyed
            } : null,
            markers: rustplus.markers || {},
            events: rustplus.events || { all: [], cargo: [], heli: [], small: [], large: [], chinook: [] }
        };

        // Cache the data
        this.cachedServerData[guildId] = data;
        this.lastCacheUpdate[guildId] = now;

        return data;
    }

    startUpdateInterval() {
        /* Update cache and broadcast to all connected clients
         * Uses same interval as polling to stay synchronized
         * This does NOT make additional Rust+ API calls - it only broadcasts
         * the data that was already fetched by the polling handler */
        const updateInterval = this.client.pollingIntervalMs || 10000;
        
        this.client.log(this.client.intlGet(null, 'infoCap'), 
            `WebUI: broadcasting updates every ${updateInterval}ms (synced with polling)`);
        
        setInterval(() => {
            for (const [guildId, rustplus] of Object.entries(this.client.rustplusInstances)) {
                if (!rustplus || !rustplus.isOperational) continue;
                // Force refresh cache and get new data (from memory, not Rust+ API)
                const data = this.getServerData(guildId, false);
                if (data) {
                    // Broadcast to all clients subscribed to this guild
                    this.io.to(`guild-${guildId}`).emit('serverUpdate', data);
                }
            }
        }, updateInterval);
    }

    start() {
        this.server.listen(this.port, () => {
            this.client.log(this.client.intlGet(null, 'infoCap'), `WebUI: server running on http://localhost:${this.port}`);
        });
    }

    broadcastTrailReset(guildId, steamId) {
        this.io.to(`guild-${guildId}`).emit('resetPlayerTrail', { steamId });
    }
    
    broadcastTeamDeath(guildId, steamId, playerName, x, y) {
        this.io.to(`guild-${guildId}`).emit('teamDeath', {
            steam_id: steamId,
            player_name: playerName,
            x: x,
            y: y
        });
    }

    stop() {
        if (this.statisticsTracker) {
            this.statisticsTracker.shutdown();
        }
        this.server.close();
    }
}

module.exports = WebServer;
