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

const StatisticsDatabase = require('./StatisticsDatabase');
const bcrypt = require('bcrypt');

class StatisticsTracker {
    constructor(client) {
        this.client = client;
        this.db = new StatisticsDatabase();
        this.trackingIntervals = {};
        this.lastKnownPlayerStates = {};
        this.reconnectPending = {};
        this.reconnectMode = {};
        this.sessionReconnectGraceSeconds = 60 * 60; // 1 hour
        
        this.client.log(this.client.intlGet(null, 'infoCap'), 'Statistics: tracker initialized');
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // Start tracking when rustplus instances are operational
        setInterval(() => {
            this.checkAndStartTracking();
        }, 5000);
    }

    checkAndStartTracking() {
        for (const [guildId, rustplus] of Object.entries(this.client.rustplusInstances)) {
            if (!rustplus || !rustplus.isOperational) {
                this.stopTracking(guildId);
                continue;
            }
            
            if (!this.trackingIntervals[guildId]) {
                this.startTracking(guildId);
            }
        }
    }

    startTracking(guildId) {
        this.client.log(this.client.intlGet(null, 'infoCap'), `Statistics: starting tracking for guild ${guildId}`);

        const now = Math.floor(Date.now() / 1000);
        const lastActivity = this.db.getLastActivityTimestamp(guildId);
        const downtime = lastActivity ? (now - lastActivity) : null;

        if (downtime !== null && downtime > this.sessionReconnectGraceSeconds) {
            this.endAllActiveSessions(guildId);
            this.reconnectPending[guildId] = false;
            this.reconnectMode[guildId] = false;
        } else {
            this.reconnectPending[guildId] = true;
            this.reconnectMode[guildId] = true;
        }
        
        this.lastKnownPlayerStates[guildId] = {};
        
        // Track player sessions and positions every 30 seconds
        this.trackingIntervals[guildId] = setInterval(() => {
            this.trackGuildData(guildId);
        }, 30000);
        
        // Initial track
        this.trackGuildData(guildId);
    }

    stopTracking(guildId) {
        if (this.trackingIntervals[guildId]) {
            clearInterval(this.trackingIntervals[guildId]);
            delete this.trackingIntervals[guildId];

            this.client.log(this.client.intlGet(null, 'infoCap'), `Statistics: stopped tracking for guild ${guildId}`);
        }
    }

    trackGuildData(guildId) {
        const rustplus = this.client.rustplusInstances[guildId];
        if (!rustplus || !rustplus.isOperational) return;

        const serverId = rustplus.serverId;
        const info = rustplus.info;
        const team = rustplus.team;

        try {
            // Track connection statistics
            if (info) {
                this.db.recordConnectionStats(
                    guildId,
                    serverId,
                    info.players,
                    info.maxPlayers,
                    info.queuedPlayers || 0
                );
            }

            // Track player sessions and positions
            if (team && team.players) {
                if (this.reconnectPending[guildId]) {
                    this.reconcileSessionsAfterRestart(guildId, serverId, team.players);
                    this.reconnectPending[guildId] = false;
                    this.reconnectMode[guildId] = false;
                }

                const currentPlayers = {};
                
                team.players.forEach(player => {
                    if (!player.steamId) return;
                    
                    currentPlayers[player.steamId] = player;
                    const lastState = this.lastKnownPlayerStates[guildId]?.[player.steamId];
                    
                    // Check if player just came online
                    if (player.isOnline && (!lastState || !lastState.isOnline)) {
                        if (!this.reconnectMode[guildId]) {
                            this.handlePlayerConnect(guildId, serverId, player);
                        }
                    }
                    
                    // Check if player went offline
                    if (!player.isOnline && lastState && lastState.isOnline) {
                        this.handlePlayerDisconnect(guildId, player);
                    }
                    
                    // Check if player died (went from alive to dead while online)
                    if (player.isOnline && !player.isAlive && lastState && lastState.isAlive) {
                        this.handlePlayerDeath(guildId, serverId, player, lastState);
                    }
                    
                    // Track position if online
                    if (player.isOnline && player.x !== undefined && player.y !== undefined) {
                        this.db.recordPlayerPosition(
                            guildId,
                            serverId,
                            player.steamId,
                            player.x,
                            player.y,
                            player.isAlive
                        );
                    }
                });
                
                // Check for players who left the team
                if (this.lastKnownPlayerStates[guildId]) {
                    Object.keys(this.lastKnownPlayerStates[guildId]).forEach(steamId => {
                        if (!currentPlayers[steamId]) {
                            const lastState = this.lastKnownPlayerStates[guildId][steamId];
                            if (lastState.isOnline) {
                                this.handlePlayerDisconnect(guildId, { steamId, name: lastState.name });
                            }
                        }
                    });
                }
                
                // Update last known states
                this.lastKnownPlayerStates[guildId] = currentPlayers;
            }
        } catch (error) {
            this.client.log(this.client.intlGet(null, 'errorCap'), `Statistics: error tracking guild ${guildId}: ${error}`, 'error');
        }
    }

    handlePlayerConnect(guildId, serverId, player) {
        this.client.log(this.client.intlGet(null, 'infoCap'), `Statistics: player connected: ${player.name} (${player.steamId})`);
        
        // Check if there's already an active session (shouldn't happen, but handle it)
        const activeSession = this.db.getActiveSession(guildId, player.steamId);
        if (activeSession) {
            if (this.reconnectMode[guildId]) {
                return; // Resume existing session during reconnect window
            }
            this.db.endPlayerSession(guildId, player.steamId);
        }
        
        // Start new session
        this.db.startPlayerSession(guildId, serverId, player.steamId, player.name);
    }

    handlePlayerDisconnect(guildId, player) {
        this.client.log(this.client.intlGet(null, 'infoCap'), `Statistics: player disconnected: ${player.name} (${player.steamId})`);
        this.db.endPlayerSession(guildId, player.steamId);
    }

    handlePlayerDeath(guildId, serverId, player, lastState) {
        this.client.log(this.client.intlGet(null, 'infoCap'), `Statistics: player died: ${player.name} (${player.steamId})`);
        this.db.recordPlayerDeath(
            guildId,
            serverId,
            player.steamId,
            player.name,
            lastState.x,
            lastState.y
        );
    }

    reconcileSessionsAfterRestart(guildId, serverId, players) {
        const onlineIds = new Set(players.filter(p => p.isOnline).map(p => p.steamId));
        const activeSessions = this.db.getAllActiveSessions(guildId);

        activeSessions.forEach(session => {
            if (!onlineIds.has(session.steam_id)) {
                this.db.endPlayerSession(guildId, session.steam_id);
            }
        });

        players.forEach(player => {
            if (!player.isOnline || !player.steamId) return;
            const activeSession = this.db.getActiveSession(guildId, player.steamId);
            if (!activeSession) {
                this.db.startPlayerSession(guildId, serverId, player.steamId, player.name);
            }
        });

        // Merge recent sessions to avoid fragmentation from restarts/crashes
        // Only merge sessions with gaps ≤2 minutes (bot restarts), not player disconnects
        const mergedCount = this.db.mergeRecentSessions(guildId, 500, 48);
        if (mergedCount > 0) {
            this.client.log(this.client.intlGet(null, 'infoCap'), `Statistics: merged ${mergedCount} fragmented sessions`);
        }
    }

    endAllActiveSessions(guildId) {
        const activeSessions = this.db.getAllActiveSessions(guildId);
        activeSessions.forEach(session => {
            this.db.endPlayerSession(guildId, session.steam_id);
        });
    }

    // Public methods for manual tracking
    
    trackChatMessage(guildId, serverId, steamId, playerName, message) {
        this.db.recordChatMessage(guildId, serverId, steamId, playerName, message);
    }

    trackCommand(guildId, serverId, command, steamId = null, playerName = null) {
        this.db.recordCommand(guildId, serverId, command, steamId, playerName);
    }
    
    trackPlayerDeath(guildId, serverId, steamId, playerName, x = null, y = null) {
        this.client.log(this.client.intlGet(null, 'infoCap'), `Statistics: recording death: ${playerName} at (${x}, ${y})`);
        this.db.recordPlayerDeath(guildId, serverId, steamId, playerName, x, y);
    }

    // Statistics retrieval
    
    getPlayerStats(guildId, serverId, steamId) {
        return this.db.getPlayerStatistics(guildId, serverId, steamId);
    }

    getTeamStats(guildId, serverId, steamIds) {
        return this.db.getTeamStatistics(guildId, serverId, steamIds);
    }

    getServerStats(guildId, serverId, days = 7) {
        return this.db.getServerStatistics(guildId, serverId, days);
    }

    getPlayerSessions(guildId, serverId, steamId, limit = 100) {
        return this.db.getPlayerSessions(guildId, serverId, steamId, limit);
    }

    getPlayerDeaths(guildId, serverId, steamId, limit = 100) {
        return this.db.getPlayerDeaths(guildId, serverId, steamId, limit);
    }

    getAllDeaths(guildId, serverId, limit = 1000) {
        return this.db.getAllDeaths(guildId, serverId, limit);
    }

    getChatHistory(guildId, serverId, limit = 100) {
        return this.db.getChatHistory(guildId, serverId, limit);
    }

    getPlayerChatHistory(guildId, serverId, steamId, limit = 100) {
        return this.db.getPlayerChatHistory(guildId, serverId, steamId, limit);
    }

    getCommandHistory(guildId, serverId, limit = 100) {
        return this.db.getCommandHistory(guildId, serverId, limit);
    }

    getPlayerColor(steamId) {
        return this.db.getPlayerColor(steamId);
    }

    getReplayData(guildId, serverId, startTime, endTime) {
        return this.db.getRecentPositions(guildId, serverId, Math.floor((endTime - startTime) / 60));
    }

    getConnectionStats(guildId, serverId, startTime, endTime) {
        return this.db.getConnectionStats(guildId, serverId, startTime, endTime);
    }

    getDatabaseInfo() {
        return {
            size: this.db.getDatabaseSize(),
            maintenanceLog: this.db.getMaintenanceLog(5)
        };
    }

    resetGuildStats(guildId) {
        this.client.log(this.client.intlGet(null, 'infoCap'), `Statistics: resetting statistics for guild ${guildId}`);
        return this.db.resetGuildStats(guildId);
    }

    /* PIN CODE MANAGEMENT */
    
    hasPinCode(guildId) {
        return this.db.hasPinCode(guildId);
    }
    
    verifyPinCode(guildId, pin) {
        return this.db.verifyPinCode(guildId, pin);
    }
    
    hasPinCode(guildId) {
        return this.db.hasPinCode(guildId);
    }
    
    async verifyPinCode(guildId, pin) {
        const pinHash = this.db.getPinHash(guildId);
        if (!pinHash) {
            return false;
        }
        return await bcrypt.compare(pin, pinHash);
    }
    
    async setPinCode(guildId, pin) {
        this.client.log(this.client.intlGet(null, 'infoCap'), `Statistics: setting PIN code for guild ${guildId}`);
        const saltRounds = 10;
        const pinHash = await bcrypt.hash(pin, saltRounds);
        return this.db.setPinCode(guildId, pinHash);
    }
    
    removePinCode(guildId) {
        this.client.log(this.client.intlGet(null, 'infoCap'), `Statistics: removing PIN code for guild ${guildId}`);
        return this.db.removePinCode(guildId);
    }

    shutdown() {
        this.client.log(this.client.intlGet(null, 'infoCap'), 'Statistics: shutting down statistics tracker...');
        
        // Stop all tracking
        Object.keys(this.trackingIntervals).forEach(guildId => {
            this.stopTracking(guildId);
        });
        
        // Close database
        this.db.close();
        this.client.log(this.client.intlGet(null, 'infoCap'), 'Statistics: statistics tracker shut down');
    }
}

module.exports = StatisticsTracker;
