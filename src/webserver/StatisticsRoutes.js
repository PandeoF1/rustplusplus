/*
    Copyright (C) 2026 Alexander Emanuelsson (alexemanuelol)

    Statistics API routes for the WebUI

*/

const Express = require('express');

function setupStatisticsRoutes(app, statisticsTracker) {
    const router = Express.Router();

    /* Get player statistics */
    router.get('/player/:guildId/:steamId', (req, res) => {
        try {
            const { guildId, steamId } = req.params;
            const serverId = req.query.serverId;
            const stats = statisticsTracker.getPlayerStats(guildId, serverId, steamId);
            const sessions = statisticsTracker.getPlayerSessions(guildId, serverId, steamId, 50);
            const deaths = statisticsTracker.getPlayerDeaths(guildId, serverId, steamId, 50);
            const chatHistory = statisticsTracker.getPlayerChatHistory(guildId, serverId, steamId, 100);
            const color = statisticsTracker.getPlayerColor(steamId);

            res.json({
                stats,
                sessions,
                deaths,
                chatHistory,
                color
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /* Get team statistics */
    router.get('/team/:guildId', (req, res) => {
        try {
            const { guildId } = req.params;
            const serverId = req.query.serverId;
            const steamIds = req.query.steamIds ? req.query.steamIds.split(',') : [];

            if (steamIds.length === 0) {
                return res.status(400).json({ error: 'No steam IDs provided' });
            }

            const stats = statisticsTracker.getTeamStats(guildId, serverId, steamIds);
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /* Get server statistics */
    router.get('/server/:guildId', (req, res) => {
        try {
            const { guildId } = req.params;
            const serverId = req.query.serverId;
            const days = parseInt(req.query.days) || 7;
            const stats = statisticsTracker.getServerStats(guildId, serverId, days);
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /* Get player sessions */
    router.get('/sessions/:guildId/:steamId', (req, res) => {
        try {
            const { guildId, steamId } = req.params;
            const serverId = req.query.serverId;
            const limit = parseInt(req.query.limit) || 100;
            const sessions = statisticsTracker.getPlayerSessions(guildId, serverId, steamId, limit);
            res.json(sessions);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /* Get all player sessions for a guild (for graphs) */
    router.get('/sessions/:guildId', (req, res) => {
        try {
            const { guildId } = req.params;
            const serverId = req.query.serverId;
            const steamIds = req.query.steamIds ? req.query.steamIds.split(',') : [];
            const limit = parseInt(req.query.limit) || 1000;

            const allSessions = {};
            steamIds.forEach(steamId => {
                allSessions[steamId] = statisticsTracker.getPlayerSessions(guildId, serverId, steamId, limit);
            });

            res.json(allSessions);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /* Get chat history */
    router.get('/chat/:guildId', (req, res) => {
        try {
            const { guildId } = req.params;
            const serverId = req.query.serverId;
            const limit = parseInt(req.query.limit) || 100;
            const chatHistory = statisticsTracker.getChatHistory(guildId, serverId, limit);
            res.json(chatHistory);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /* Sync chat history from Discord */
    router.post('/sync-chat/:guildId', async (req, res) => {
        try {
            const { guildId } = req.params;
            const limit = parseInt(req.query.limit) || 100;
            const result = await statisticsTracker.syncChatHistoryFromDiscord(guildId, limit);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /* Get deaths with optional filtering */
    router.get('/deaths/:guildId', (req, res) => {
        try {
            const { guildId } = req.params;
            const serverId = req.query.serverId;
            const steamIds = req.query.steamIds ? req.query.steamIds.split(',') : null;
            const startTime = req.query.startTime ? parseInt(req.query.startTime) : null;
            const endTime = req.query.endTime ? parseInt(req.query.endTime) : null;

            let deaths = statisticsTracker.getAllDeaths(guildId, serverId, 10000);

            // Filter by steam IDs if provided
            if (steamIds && steamIds.length > 0) {
                deaths = deaths.filter(d => steamIds.includes(d.steam_id));
            }
            // Filter by time range if provided
            if (startTime) {
                deaths = deaths.filter(d => d.death_time >= startTime);
            }
            if (endTime) {
                deaths = deaths.filter(d => d.death_time <= endTime);
            }
            res.json(deaths);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /* Get command history */
    router.get('/commands/:guildId', (req, res) => {
        try {
            const { guildId } = req.params;
            const serverId = req.query.serverId;
            const limit = parseInt(req.query.limit) || 100;
            const commandHistory = statisticsTracker.getCommandHistory(guildId, serverId, limit);
            res.json(commandHistory);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /* Get connection statistics (player count over time) */
    router.get('/connections/:guildId', (req, res) => {
        try {
            const { guildId } = req.params;
            const serverId = req.query.serverId;
            const hours = parseInt(req.query.hours) || 24;

            const endTime = Math.floor(Date.now() / 1000);
            const startTime = endTime - (hours * 3600);

            const stats = statisticsTracker.getConnectionStats(guildId, serverId, startTime, endTime);
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /* Get replay data for map */
    router.get('/replay/:guildId', (req, res) => {
        try {
            const { guildId } = req.params;
            const serverId = req.query.serverId;
            const minutes = parseInt(req.query.minutes) || 60;
            const maxMinutes = 43200; // 30 days max
            const limitedMinutes = Math.min(minutes, maxMinutes);

            const endTime = Math.floor(Date.now() / 1000);
            const startTime = endTime - (limitedMinutes * 60);

            const positions = statisticsTracker.getReplayData(guildId, serverId, startTime, endTime);

            // Group by player and include color
            const playerData = {};
            positions.forEach(pos => {
                if (!playerData[pos.steam_id]) {
                    playerData[pos.steam_id] = {
                        steamId: pos.steam_id,
                        color: statisticsTracker.getPlayerColor(pos.steam_id),
                        positions: []
                    };
                }
                playerData[pos.steam_id].positions.push({
                    x: pos.x,
                    y: pos.y,
                    timestamp: pos.timestamp,
                    isAlive: pos.is_alive === 1
                });
            });
            res.json(playerData);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /* Get player colors */
    router.get('/colors', (req, res) => {
        try {
            const steamIds = req.query.steamIds ? req.query.steamIds.split(',') : [];
            const colors = {};

            steamIds.forEach(steamId => {
                colors[steamId] = statisticsTracker.getPlayerColor(steamId);
            });

            res.json(colors);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /* Get database info */
    router.get('/info', (req, res) => {
        try {
            const info = statisticsTracker.getDatabaseInfo();
            res.json(info);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /* Reset statistics for a guild (wipe) */
    router.post('/reset/:guildId', (req, res) => {
        try {
            const { guildId } = req.params;
            statisticsTracker.resetGuildStats(guildId);
            res.json({ success: true, message: 'Statistics reset successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /* PIN CODE ENDPOINTS */
    /* Check if PIN is set for a guild */
    router.get('/pin-status/:guildId', (req, res) => {
        try {
            const { guildId } = req.params;
            const hasPinCode = statisticsTracker.hasPinCode(guildId);
            res.json({ hasPinCode });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    /* Verify PIN code */
    router.post('/verify-pin/:guildId', async (req, res) => {
        try {
            const { guildId } = req.params;
            const { pin } = req.body;

            if (!pin) {
                return res.status(400).json({ success: false, error: 'PIN required' });
            }

            const isValid = await statisticsTracker.verifyPinCode(guildId, pin);
            if (isValid) {
                res.json({ success: true, hash: 'verified' });
            } else {
                res.json({ success: false });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    /* Set PIN code (first time) */
    router.post('/set-pin/:guildId', async (req, res) => {
        try {
            const { guildId } = req.params;
            const { pin } = req.body;

            if (!pin || pin.length < 4) {
                return res.status(400).json({ success: false, error: 'PIN must be at least 4 characters' });
            }

            await statisticsTracker.setPinCode(guildId, pin);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    /* Update or remove PIN code */
    router.post('/update-pin/:guildId', async (req, res) => {
        try {
            const { guildId } = req.params;
            const { currentPin, newPin } = req.body;

            if (!currentPin) {
                return res.status(400).json({ success: false, error: 'Current PIN required' });
            }

            // Verify current PIN
            const isValid = await statisticsTracker.verifyPinCode(guildId, currentPin);
            if (!isValid) {
                return res.json({ success: false, error: 'Incorrect current PIN' });
            }
            // Update or remove PIN
            if (newPin) {
                if (newPin.length < 4) {
                    return res.status(400).json({ success: false, error: 'New PIN must be at least 4 characters' });
                }
                await statisticsTracker.setPinCode(guildId, newPin);
            } else {
                statisticsTracker.removePinCode(guildId);
            }
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.use('/api/statistics', router);
}

module.exports = setupStatisticsRoutes;
