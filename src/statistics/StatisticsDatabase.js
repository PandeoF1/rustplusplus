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

const Database = require('better-sqlite3');
const Path = require('path');
const Fs = require('fs');

class StatisticsDatabase {
    constructor(dbPath = null) {
        if (!dbPath) {
            const dbDir = Path.join(__dirname, '..', '..', 'database');
            if (!Fs.existsSync(dbDir)) {
                Fs.mkdirSync(dbDir, { recursive: true });
            }
            dbPath = Path.join(dbDir, 'statistics.db');
        }

        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL'); // Better concurrent access
        this.initializeTables();
        this.setupMaintenanceSchedule();
    }

    initializeTables() {
        // Player sessions table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS player_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                server_id TEXT NOT NULL,
                steam_id TEXT NOT NULL,
                player_name TEXT NOT NULL,
                session_start INTEGER NOT NULL,
                session_end INTEGER,
                duration_seconds INTEGER,
                is_active INTEGER DEFAULT 1,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
            CREATE INDEX IF NOT EXISTS idx_player_sessions_guild ON player_sessions(guild_id);
            CREATE INDEX IF NOT EXISTS idx_player_sessions_steam ON player_sessions(steam_id);
            CREATE INDEX IF NOT EXISTS idx_player_sessions_active ON player_sessions(is_active);
            CREATE INDEX IF NOT EXISTS idx_player_sessions_start ON player_sessions(session_start);
        `);

        // Player position tracking for replays
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS player_positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                server_id TEXT NOT NULL,
                steam_id TEXT NOT NULL,
                x REAL NOT NULL,
                y REAL NOT NULL,
                timestamp INTEGER NOT NULL,
                is_alive INTEGER DEFAULT 1,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
            CREATE INDEX IF NOT EXISTS idx_player_positions_guild ON player_positions(guild_id);
            CREATE INDEX IF NOT EXISTS idx_player_positions_steam ON player_positions(steam_id);
            CREATE INDEX IF NOT EXISTS idx_player_positions_time ON player_positions(timestamp);
        `);

        // Player deaths
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS player_deaths (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                server_id TEXT NOT NULL,
                steam_id TEXT NOT NULL,
                player_name TEXT NOT NULL,
                x REAL,
                y REAL,
                death_time INTEGER NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
            CREATE INDEX IF NOT EXISTS idx_player_deaths_guild ON player_deaths(guild_id);
            CREATE INDEX IF NOT EXISTS idx_player_deaths_steam ON player_deaths(steam_id);
            CREATE INDEX IF NOT EXISTS idx_player_deaths_time ON player_deaths(death_time);
        `);

        // Chat history
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                server_id TEXT NOT NULL,
                steam_id TEXT NOT NULL,
                player_name TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
            CREATE INDEX IF NOT EXISTS idx_chat_history_guild ON chat_history(guild_id);
            CREATE INDEX IF NOT EXISTS idx_chat_history_steam ON chat_history(steam_id);
            CREATE INDEX IF NOT EXISTS idx_chat_history_time ON chat_history(timestamp);
        `);

        // Command history
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS command_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                server_id TEXT NOT NULL,
                steam_id TEXT,
                player_name TEXT,
                command TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
            CREATE INDEX IF NOT EXISTS idx_command_history_guild ON command_history(guild_id);
            CREATE INDEX IF NOT EXISTS idx_command_history_time ON command_history(timestamp);
        `);

        // Connection statistics (player queue, total connections, etc.)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS connection_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                server_id TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                online_players INTEGER NOT NULL,
                max_players INTEGER NOT NULL,
                queued_players INTEGER DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
            CREATE INDEX IF NOT EXISTS idx_connection_stats_guild ON connection_stats(guild_id);
            CREATE INDEX IF NOT EXISTS idx_connection_stats_time ON connection_stats(timestamp);
        `);

        // Player colors for trails
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS player_colors (
                steam_id TEXT PRIMARY KEY,
                color TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
        `);

        // Maintenance log
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS maintenance_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                maintenance_type TEXT NOT NULL,
                records_deleted INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
        `);

        // PIN codes for guild authentication
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS pin_codes (
                guild_id TEXT PRIMARY KEY,
                pin_hash TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
        `);
    }

    // ==================== PLAYER SESSIONS ====================

    startPlayerSession(guildId, serverId, steamId, playerName, mergeGapSeconds = 120) {
        const timestamp = Math.floor(Date.now() / 1000);

        // Check if there's a recent ended session within merge gap (bot restart scenario)
        const recentStmt = this.db.prepare(`
            SELECT * FROM player_sessions
            WHERE guild_id = ? AND steam_id = ? AND is_active = 0
            AND session_end IS NOT NULL
            ORDER BY session_end DESC
            LIMIT 1
        `);
        const recentSession = recentStmt.get(guildId, steamId);

        // If found a session that ended within merge gap, resume it instead of creating new
        if (recentSession && (timestamp - recentSession.session_end) <= mergeGapSeconds) {
            const resumeStmt = this.db.prepare(`
                UPDATE player_sessions
                SET session_end = NULL, is_active = 1, duration_seconds = NULL
                WHERE id = ?
            `);
            return resumeStmt.run(recentSession.id);
        }

        // Otherwise create new session
        const stmt = this.db.prepare(`
            INSERT INTO player_sessions (guild_id, server_id, steam_id, player_name, session_start)
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(guildId, serverId, steamId, playerName, timestamp);
    }

    endPlayerSession(guildId, steamId) {
        const timestamp = Math.floor(Date.now() / 1000);
        const stmt = this.db.prepare(`
            UPDATE player_sessions
            SET session_end = ?, duration_seconds = ? - session_start, is_active = 0
            WHERE guild_id = ? AND steam_id = ? AND is_active = 1
        `);
        return stmt.run(timestamp, timestamp, guildId, steamId);
    }

    getActiveSession(guildId, steamId) {
        const stmt = this.db.prepare(`
            SELECT * FROM player_sessions
            WHERE guild_id = ? AND steam_id = ? AND is_active = 1
            LIMIT 1
        `);
        return stmt.get(guildId, steamId);
    }

    resumeMostRecentSession(guildId, steamId) {
        const stmt = this.db.prepare(`
            SELECT * FROM player_sessions
            WHERE guild_id = ? AND steam_id = ? AND is_active = 0
            ORDER BY session_end DESC
            LIMIT 1
        `);
        const recentSession = stmt.get(guildId, steamId);
        if (!recentSession) return null;

        const resumeStmt = this.db.prepare(`
            UPDATE player_sessions
            SET session_end = NULL, is_active = 1, duration_seconds = NULL
            WHERE id = ?
        `);
        resumeStmt.run(recentSession.id);
        return recentSession;
    }

    getPlayerSessions(guildId, serverId, steamId, limit = 100) {
        if (serverId && serverId !== '') {
            const stmt = this.db.prepare(`
                SELECT * FROM player_sessions
                WHERE guild_id = ? AND (server_id = ? OR server_id IS NULL OR server_id = '') AND steam_id = ?
                ORDER BY session_start DESC
                LIMIT ?
            `);
            return stmt.all(guildId, serverId, steamId, limit);
        } else {
            const stmt = this.db.prepare(`
                SELECT * FROM player_sessions
                WHERE guild_id = ? AND steam_id = ?
                ORDER BY session_start DESC
                LIMIT ?
            `);
            return stmt.all(guildId, steamId, limit);
        }
    }

    mergeRecentSessions(guildId, mergeGapSeconds = 120, lookbackHours = 48) {
        const now = Math.floor(Date.now() / 1000);
        const cutoff = now - (lookbackHours * 3600);

        // Get all players with sessions in the lookback period
        const playersStmt = this.db.prepare(`
            SELECT DISTINCT steam_id FROM player_sessions
            WHERE guild_id = ? AND session_start >= ?
        `);
        const players = playersStmt.all(guildId, cutoff);

        let totalMerged = 0;

        players.forEach(({ steam_id }) => {
            // Get all sessions for this player
            const sessionsStmt = this.db.prepare(`
                SELECT * FROM player_sessions
                WHERE guild_id = ? AND steam_id = ? AND session_start >= ?
                ORDER BY session_start ASC
            `);
            const sessions = sessionsStmt.all(guildId, steam_id, cutoff);
            if (sessions.length <= 1) return;

            const merged = [];
            sessions.forEach(session => {
                const sessionStart = session.session_start;
                const sessionEnd = session.session_end || now;

                if (!merged.length) {
                    merged.push({
                        ...session,
                        original_ids: [session.id]
                    });
                    return;
                }

                const last = merged[merged.length - 1];
                const gap = sessionStart - (last.session_end || now);

                if (gap <= mergeGapSeconds && gap >= 0) {
                    // Merge: extend the end time and mark as active if either is active
                    last.session_end = Math.max(last.session_end || now, sessionEnd);
                    last.is_active = last.is_active || session.is_active;
                    last.original_ids.push(session.id);
                } else {
                    merged.push({
                        ...session,
                        original_ids: [session.id]
                    });
                }
            });

            // If merging occurred, update database
            if (merged.length < sessions.length) {
                const transaction = this.db.transaction(() => {
                    // Delete all original sessions
                    const deleteStmt = this.db.prepare(`DELETE FROM player_sessions WHERE id = ?`);
                    sessions.forEach(s => deleteStmt.run(s.id));

                    // Insert merged sessions
                    const insertStmt = this.db.prepare(`
                        INSERT INTO player_sessions (guild_id, server_id, steam_id, player_name, session_start, session_end, is_active, duration_seconds)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `);

                    merged.forEach(m => {
                        const duration = m.is_active ? null : ((m.session_end || now) - m.session_start);
                        insertStmt.run(
                            m.guild_id,
                            m.server_id,
                            m.steam_id,
                            m.player_name,
                            m.session_start,
                            m.session_end,
                            m.is_active,
                            duration
                        );
                    });
                });

                transaction();
                totalMerged += (sessions.length - merged.length);
            }
        });

        return totalMerged;
    }

    getAllActiveSessions(guildId) {
        const stmt = this.db.prepare(`
            SELECT * FROM player_sessions
            WHERE guild_id = ? AND is_active = 1
        `);
        return stmt.all(guildId);
    }

    // Close sessions that have been active for more than maxHours (default 24 hours)
    // This is a safety mechanism to prevent infinitely active sessions
    closeStaleActiveSessions(maxHours = 24) {
        const now = Math.floor(Date.now() / 1000);
        const cutoff = now - (maxHours * 3600);
        
        const stmt = this.db.prepare(`
            UPDATE player_sessions
            SET session_end = ?, duration_seconds = ? - session_start, is_active = 0
            WHERE is_active = 1 AND session_start < ?
        `);
        const result = stmt.run(now, now, cutoff);
        return result.changes;
    }

    getLastActivityTimestamp(guildId) {
        const connStmt = this.db.prepare(`
            SELECT MAX(timestamp) as ts FROM connection_stats WHERE guild_id = ?
        `);
        const posStmt = this.db.prepare(`
            SELECT MAX(timestamp) as ts FROM player_positions WHERE guild_id = ?
        `);

        const conn = connStmt.get(guildId)?.ts || null;
        const pos = posStmt.get(guildId)?.ts || null;

        const maxTs = Math.max(conn || 0, pos || 0);
        return maxTs > 0 ? maxTs : null;
    }

    // ==================== PLAYER POSITIONS ====================

    recordPlayerPosition(guildId, serverId, steamId, x, y, isAlive = true) {
        const stmt = this.db.prepare(`
            INSERT INTO player_positions (guild_id, server_id, steam_id, x, y, timestamp, is_alive)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const timestamp = Math.floor(Date.now() / 1000);
        return stmt.run(guildId, serverId, steamId, x, y, timestamp, isAlive ? 1 : 0);
    }

    getPlayerPositions(guildId, serverId, steamId, startTime, endTime) {
        if (serverId && serverId !== '') {
            const stmt = this.db.prepare(`
                SELECT * FROM player_positions
                WHERE guild_id = ? AND (server_id = ? OR server_id IS NULL OR server_id = '') AND steam_id = ? AND timestamp BETWEEN ? AND ?
                ORDER BY timestamp ASC
            `);
            return stmt.all(guildId, serverId, steamId, startTime, endTime);
        } else {
            const stmt = this.db.prepare(`
                SELECT * FROM player_positions
                WHERE guild_id = ? AND steam_id = ? AND timestamp BETWEEN ? AND ?
                ORDER BY timestamp ASC
            `);
            return stmt.all(guildId, steamId, startTime, endTime);
        }
    }

    getRecentPositions(guildId, serverId, minutes = 60) {
        const startTime = Math.floor(Date.now() / 1000) - (minutes * 60);
        if (serverId && serverId !== '') {
            const stmt = this.db.prepare(`
                SELECT * FROM player_positions
                WHERE guild_id = ? AND (server_id = ? OR server_id IS NULL OR server_id = '') AND timestamp > ?
                ORDER BY timestamp ASC
            `);
            return stmt.all(guildId, serverId, startTime);
        } else {
            const stmt = this.db.prepare(`
                SELECT * FROM player_positions
                WHERE guild_id = ? AND timestamp > ?
                ORDER BY timestamp ASC
            `);
            return stmt.all(guildId, startTime);
        }
    }

    // ==================== PLAYER DEATHS ====================

    recordPlayerDeath(guildId, serverId, steamId, playerName, x = null, y = null) {
        const stmt = this.db.prepare(`
            INSERT INTO player_deaths (guild_id, server_id, steam_id, player_name, x, y, death_time)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const timestamp = Math.floor(Date.now() / 1000);
        return stmt.run(guildId, serverId, steamId, playerName, x, y, timestamp);
    }

    getPlayerDeaths(guildId, serverId, steamId, limit = 100) {
        if (serverId && serverId !== '') {
            const stmt = this.db.prepare(`
                SELECT * FROM player_deaths
                WHERE guild_id = ? AND (server_id = ? OR server_id IS NULL OR server_id = '') AND steam_id = ?
                ORDER BY death_time DESC
                LIMIT ?
            `);
            return stmt.all(guildId, serverId, steamId, limit);
        } else {
            const stmt = this.db.prepare(`
                SELECT * FROM player_deaths
                WHERE guild_id = ? AND steam_id = ?
                ORDER BY death_time DESC
                LIMIT ?
            `);
            return stmt.all(guildId, steamId, limit);
        }
    }

    getAllDeaths(guildId, serverId, limit = 1000) {
        if (serverId && serverId !== '') {
            const stmt = this.db.prepare(`
                SELECT * FROM player_deaths
                WHERE guild_id = ? AND (server_id = ? OR server_id IS NULL OR server_id = '')
                ORDER BY death_time DESC
                LIMIT ?
            `);
            return stmt.all(guildId, serverId, limit);
        } else {
            const stmt = this.db.prepare(`
                SELECT * FROM player_deaths
                WHERE guild_id = ?
                ORDER BY death_time DESC
                LIMIT ?
            `);
            return stmt.all(guildId, limit);
        }
    }

    getTotalDeaths(guildId, serverId, steamId) {
        if (serverId && serverId !== '') {
            const stmt = this.db.prepare(`
                SELECT COUNT(*) as count FROM player_deaths
                WHERE guild_id = ? AND (server_id = ? OR server_id IS NULL OR server_id = '') AND steam_id = ?
            `);
            return stmt.get(guildId, serverId, steamId).count;
        } else {
            const stmt = this.db.prepare(`
                SELECT COUNT(*) as count FROM player_deaths
                WHERE guild_id = ? AND steam_id = ?
            `);
            return stmt.get(guildId, steamId).count;
        }
    }

    // ==================== CHAT HISTORY ====================

    recordChatMessage(guildId, serverId, steamId, playerName, message) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO chat_history (guild_id, server_id, steam_id, player_name, message, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            const timestamp = Math.floor(Date.now() / 1000);
            const result = stmt.run(guildId, serverId || 'all', steamId, playerName, message, timestamp);
            console.log(`[StatisticsDB] Recorded message from ${playerName} for guild ${guildId} (server: ${serverId || 'all'})`);
            return result;
        } catch (error) {
            console.error(`[StatisticsDB] Failed to record chat message: ${error.message}`);
            throw error;
        }
    }

    getChatHistory(guildId, serverId, limit = 100) {
        try {
            console.log(`[StatisticsDB] Fetching chat history: guild=${guildId}, server=${serverId || 'all'}, limit=${limit}`);

            if (serverId && serverId !== '') {
                const stmt = this.db.prepare(`
                    SELECT * FROM chat_history
                    WHERE guild_id = ? AND (server_id = ? OR server_id IS NULL OR server_id = '' OR server_id = 'all')
                    ORDER BY timestamp DESC
                    LIMIT ?
                `);
                let results = stmt.all(guildId, serverId, limit);

                console.log(`[StatisticsDB] Query with serverId returned ${results.length} messages`);

                // Fallback: if no results for this server, try getting all for the guild
                if (results.length === 0) {
                    console.log(`[StatisticsDB] Falling back to all messages for guild ${guildId}`);
                    const fallbackStmt = this.db.prepare(`
                        SELECT * FROM chat_history
                        WHERE guild_id = ?
                        ORDER BY timestamp DESC
                        LIMIT ?
                    `);
                    results = fallbackStmt.all(guildId, limit);
                    console.log(`[StatisticsDB] Fallback returned ${results.length} messages`);
                }

                return results;
            } else {
                const stmt = this.db.prepare(`
                    SELECT * FROM chat_history
                    WHERE guild_id = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                `);
                const results = stmt.all(guildId, limit);
                console.log(`[StatisticsDB] Generic guild query returned ${results.length} messages`);
                return results;
            }
        } catch (error) {
            console.error(`[StatisticsDB] Error fetching chat history: ${error.message}`);
            return [];
        }
    }

    upsertChatMessage(guildId, serverId, steamId, playerName, message, timestamp) {
        try {
            // Check for exact duplicate (same player, same message, same approximate time)
            // Using a 2-second window for variations in time reporting
            const checkStmt = this.db.prepare(`
                SELECT id FROM chat_history
                WHERE guild_id = ? AND steam_id = ? AND message = ? AND ABS(timestamp - ?) <= 2
            `);
            const existing = checkStmt.get(guildId, steamId, message, timestamp);

            if (existing) return { changes: 0, reason: 'duplicate' };

            const stmt = this.db.prepare(`
                INSERT INTO chat_history (guild_id, server_id, steam_id, player_name, message, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            return stmt.run(guildId, serverId || 'all', steamId, playerName, message, timestamp);
        } catch (error) {
            console.error(`[StatisticsDB] Failed to upsert chat message: ${error.message}`);
            return { changes: 0, error: error.message };
        }
    }

    findSteamIdByName(guildId, playerName) {
        try {
            // Try to find steam_id from recent sessions or deaths
            const stmt = this.db.prepare(`
                SELECT steam_id FROM player_sessions 
                WHERE guild_id = ? AND player_name = ?
                ORDER BY session_start DESC
                LIMIT 1
            `);
            const result = stmt.get(guildId, playerName);
            if (result) return result.steam_id;

            const deathStmt = this.db.prepare(`
                SELECT steam_id FROM player_deaths
                WHERE guild_id = ? AND player_name = ?
                ORDER BY death_time DESC
                LIMIT 1
            `);
            const deathResult = deathStmt.get(guildId, playerName);
            return deathResult ? deathResult.steam_id : null;
        } catch (error) {
            return null;
        }
    }

    getPlayerChatHistory(guildId, serverId, steamId, limit = 100) {
        if (serverId && serverId !== '') {
            const stmt = this.db.prepare(`
                SELECT * FROM chat_history
                WHERE guild_id = ? AND (server_id = ? OR server_id IS NULL OR server_id = '') AND steam_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            `);
            return stmt.all(guildId, serverId, steamId, limit);
        } else {
            const stmt = this.db.prepare(`
                SELECT * FROM chat_history
                WHERE guild_id = ? AND steam_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            `);
            return stmt.all(guildId, steamId, limit);
        }
    }

    // ==================== COMMAND HISTORY ====================

    recordCommand(guildId, serverId, command, steamId = null, playerName = null) {
        const stmt = this.db.prepare(`
            INSERT INTO command_history (guild_id, server_id, steam_id, player_name, command, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const timestamp = Math.floor(Date.now() / 1000);
        return stmt.run(guildId, serverId, steamId, playerName, command, timestamp);
    }

    getCommandHistory(guildId, serverId, limit = 100) {
        if (serverId && serverId !== '') {
            const stmt = this.db.prepare(`
                SELECT * FROM command_history
                WHERE guild_id = ? AND (server_id = ? OR server_id IS NULL OR server_id = '')
                ORDER BY timestamp DESC
                LIMIT ?
            `);
            return stmt.all(guildId, serverId, limit);
        } else {
            const stmt = this.db.prepare(`
                SELECT * FROM command_history
                WHERE guild_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            `);
            return stmt.all(guildId, limit);
        }
    }

    // ==================== CONNECTION STATS ====================

    recordConnectionStats(guildId, serverId, onlinePlayers, maxPlayers, queuedPlayers = 0) {
        const stmt = this.db.prepare(`
            INSERT INTO connection_stats (guild_id, server_id, timestamp, online_players, max_players, queued_players)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const timestamp = Math.floor(Date.now() / 1000);
        return stmt.run(guildId, serverId, timestamp, onlinePlayers, maxPlayers, queuedPlayers);
    }

    getConnectionStats(guildId, serverId, startTime, endTime) {
        if (serverId && serverId !== '') {
            const stmt = this.db.prepare(`
                SELECT * FROM connection_stats
                WHERE guild_id = ? AND (server_id = ? OR server_id IS NULL OR server_id = '') AND timestamp BETWEEN ? AND ?
                ORDER BY timestamp ASC
            `);
            return stmt.all(guildId, serverId, startTime, endTime);
        } else {
            const stmt = this.db.prepare(`
                SELECT * FROM connection_stats
                WHERE guild_id = ? AND timestamp BETWEEN ? AND ?
                ORDER BY timestamp ASC
            `);
            return stmt.all(guildId, startTime, endTime);
        }
    }

    // ==================== PLAYER COLORS ====================

    getPlayerColor(steamId) {
        const stmt = this.db.prepare('SELECT color FROM player_colors WHERE steam_id = ?');
        const result = stmt.get(steamId);

        if (result) return result.color;

        // Generate new color
        const color = this.generateUniqueColor(steamId);
        this.db.prepare('INSERT INTO player_colors (steam_id, color) VALUES (?, ?)').run(steamId, color);
        return color;
    }

    generateUniqueColor(steamId) {
        // Generate consistent color from steam ID
        const hash = steamId.split('').reduce((acc, char) => {
            return char.charCodeAt(0) + ((acc << 5) - acc);
        }, 0);

        const hue = Math.abs(hash % 360);
        const saturation = 70 + (Math.abs(hash) % 30);
        const lightness = 50 + (Math.abs(hash >> 8) % 20);

        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    // ==================== STATISTICS & ANALYTICS ====================

    getPlayerStatistics(guildId, serverId, steamId) {
        const sessions = this.getPlayerSessions(guildId, serverId, steamId, 1000);
        const deaths = this.getTotalDeaths(guildId, serverId, steamId);

        const now = Math.floor(Date.now() / 1000);
        const completedSessions = sessions.filter(s => !s.is_active);

        // Calculate total playtime including active sessions
        const totalPlaytime = sessions.reduce((sum, s) => {
            if (s.is_active) {
                // For active sessions, calculate duration from session_start to now
                return sum + (now - s.session_start);
            }
            return sum + (s.duration_seconds || 0);
        }, 0);

        // For averages, use completed sessions only
        const avgSession = completedSessions.length > 0
            ? completedSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / completedSessions.length
            : 0;
        const longestSession = Math.max(...completedSessions.map(s => s.duration_seconds || 0), 0);

        return {
            steamId,
            totalSessions: sessions.length,
            activeSessions: sessions.filter(s => s.is_active).length,
            totalPlaytimeSeconds: totalPlaytime,
            totalPlaytimeHours: Math.floor(totalPlaytime / 3600),
            avgSessionSeconds: Math.floor(avgSession),
            avgSessionHours: avgSession / 3600,
            longestSessionSeconds: longestSession,
            longestSessionHours: longestSession / 3600,
            totalDeaths: deaths,
            deathsPerHour: totalPlaytime > 0 ? (deaths / (totalPlaytime / 3600)) : 0
        };
    }

    getTeamStatistics(guildId, serverId, steamIds) {
        const stats = steamIds.map(id => this.getPlayerStatistics(guildId, serverId, id));

        const totalPlaytime = stats.reduce((sum, s) => sum + s.totalPlaytimeSeconds, 0);
        const totalSessions = stats.reduce((sum, s) => sum + s.totalSessions, 0);
        const avgTeamSession = totalSessions > 0 ? totalPlaytime / totalSessions : 0;

        return {
            playerCount: steamIds.length,
            totalPlaytimeSeconds: totalPlaytime,
            totalPlaytimeHours: Math.floor(totalPlaytime / 3600),
            totalSessions,
            avgSessionSeconds: Math.floor(avgTeamSession),
            avgSessionHours: avgTeamSession / 3600,
            playerStats: stats
        };
    }

    getServerStatistics(guildId, serverId, days = 7) {
        const startTime = Math.floor(Date.now() / 1000) - (days * 24 * 3600);

        if (serverId && serverId !== '') {
            const stmt = this.db.prepare(`
                SELECT 
                    COUNT(DISTINCT steam_id) as unique_players,
                    COUNT(*) as total_sessions,
                    SUM(CASE WHEN duration_seconds IS NOT NULL THEN duration_seconds ELSE 0 END) as total_playtime,
                    AVG(CASE WHEN duration_seconds IS NOT NULL THEN duration_seconds ELSE NULL END) as avg_session
                FROM player_sessions
                WHERE guild_id = ? AND (server_id = ? OR server_id IS NULL OR server_id = '') AND session_start > ?
            `);
            return stmt.get(guildId, serverId, startTime);
        } else {
            const stmt = this.db.prepare(`
                SELECT 
                    COUNT(DISTINCT steam_id) as unique_players,
                    COUNT(*) as total_sessions,
                    SUM(CASE WHEN duration_seconds IS NOT NULL THEN duration_seconds ELSE 0 END) as total_playtime,
                    AVG(CASE WHEN duration_seconds IS NOT NULL THEN duration_seconds ELSE NULL END) as avg_session
                FROM player_sessions
                WHERE guild_id = ? AND session_start > ?
            `);
            return stmt.get(guildId, startTime);
        }
    }

    // ==================== MAINTENANCE & CLEANUP ====================

    setupMaintenanceSchedule() {
        // Run maintenance every hour
        setInterval(() => this.performMaintenance(), 3600000);
    }

    performMaintenance() {
        const now = Math.floor(Date.now() / 1000);
        const oneMonthAgo = now - (30 * 24 * 3600);
        const maxRecords = 5000000; // 5 million records max per table (for 1 month of positions)

        let totalDeleted = 0;

        // Close stale active sessions (sessions active for more than 24 hours)
        const staleSessions = this.closeStaleActiveSessions(24);
        if (staleSessions > 0) {
            console.log(`[Statistics] Maintenance closed ${staleSessions} stale active sessions`);
            totalDeleted += staleSessions;
        }

        // Keep all position records within 1 month (no deletion by time)
        // Only limit by record count if table grows too large

        // Clean old connection stats (keep last 30 days)
        const statsDeleted = this.db.prepare(`
            DELETE FROM connection_stats WHERE timestamp < ?
        `).run(oneMonthAgo).changes;
        totalDeleted += statsDeleted;

        // Limit table sizes if they grow too large
        this.limitTableSize('player_positions', maxRecords);
        this.limitTableSize('chat_history', 500000);
        this.limitTableSize('connection_stats', 200000);

        // Log maintenance
        if (totalDeleted > 0) {
            this.db.prepare(`
                INSERT INTO maintenance_log (maintenance_type, records_deleted, timestamp)
                VALUES (?, ?, ?)
            `).run('scheduled_cleanup', totalDeleted, now);

            console.log(`[Statistics] Maintenance completed: ${totalDeleted} records cleaned`);
        }

        // Optimize database
        this.db.pragma('optimize');
    }

    limitTableSize(tableName, maxRecords) {
        const count = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get().count;

        if (count > maxRecords) {
            const toDelete = count - maxRecords;
            this.db.prepare(`
                DELETE FROM ${tableName}
                WHERE id IN (
                    SELECT id FROM ${tableName}
                    ORDER BY id ASC
                    LIMIT ?
                )
            `).run(toDelete);

            console.log(`[Statistics] Trimmed ${toDelete} old records from ${tableName}`);
        }
    }

    getMaintenanceLog(limit = 10) {
        const stmt = this.db.prepare(`
            SELECT * FROM maintenance_log
            ORDER BY timestamp DESC
            LIMIT ?
        `);
        return stmt.all(limit);
    }

    getDatabaseSize() {
        const stats = Fs.statSync(this.db.name);
        return {
            bytes: stats.size,
            megabytes: (stats.size / 1024 / 1024).toFixed(2),
            path: this.db.name
        };
    }

    resetGuildStats(guildId) {
        // Delete all statistics for a specific guild (for server wipes)
        const tables = [
            'player_sessions',
            'player_positions',
            'player_deaths',
            'chat_history',
            'command_history',
            'connection_stats'
        ];

        let totalDeleted = 0;
        tables.forEach(table => {
            const result = this.db.prepare(`DELETE FROM ${table} WHERE guild_id = ?`).run(guildId);
            totalDeleted += result.changes;
        });

        // Log the reset
        const now = Math.floor(Date.now() / 1000);
        this.db.prepare(`
            INSERT INTO maintenance_log (maintenance_type, records_deleted, timestamp)
            VALUES (?, ?, ?)
        `).run('guild_reset', totalDeleted, now);

        console.log(`[Statistics] Reset statistics for guild ${guildId}: ${totalDeleted} records deleted`);

        return { deleted: totalDeleted };
    }

    // ==================== PIN CODE MANAGEMENT ====================

    hasPinCode(guildId) {
        const stmt = this.db.prepare(`
            SELECT guild_id FROM pin_codes WHERE guild_id = ?
        `);
        const result = stmt.get(guildId);
        return !!result;
    }

    getPinHash(guildId) {
        const stmt = this.db.prepare(`
            SELECT pin_hash FROM pin_codes WHERE guild_id = ?
        `);
        const result = stmt.get(guildId);
        return result ? result.pin_hash : null;
    }

    setPinCode(guildId, pinHash) {
        const now = Math.floor(Date.now() / 1000);
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO pin_codes (guild_id, pin_hash, created_at, updated_at)
            VALUES (?, ?, COALESCE((SELECT created_at FROM pin_codes WHERE guild_id = ?), ?), ?)
        `);
        stmt.run(guildId, pinHash, guildId, now, now);
    }

    removePinCode(guildId) {
        const stmt = this.db.prepare(`
            DELETE FROM pin_codes WHERE guild_id = ?
        `);
        stmt.run(guildId);
    }

    close() {
        this.db.close();
    }
}

module.exports = StatisticsDatabase;
