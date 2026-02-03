// Statistics Manager for RustPlus WebUI

class StatisticsManager {
    constructor(apiClient, guildId, serverId = null) {
        this.apiClient = apiClient;
        this.guildId = guildId;
        this.serverId = serverId; // Will be set from serverData, required for filtering
        this.currentView = 'overview';
        this.selectedPlayer = null;
        this.charts = {};
        this.authManager = null; // Will be set by app.js
    }

    async init() {
        // Button is created in main app, we just need to load initial data
        await this.loadOverview();
    }

    setupUI() {
        // This method is no longer needed as button is created in main app
        // Keeping for backward compatibility
    }

    async checkAuthenticationBeforeOpen() {
        // Authentication is now handled globally by authManager
        // Just open the panel directly since auth was checked on server selection
        this.openStatisticsPanel();
    }

    async openStatisticsPanel() {
        // Ensure we have serverId before opening
        if (!this.serverId) {
            console.error('[Statistics] Cannot open panel - serverId not available yet');
            return;
        }
        
        const existing = document.getElementById('statisticsPanel');
        if (existing) {
            existing.style.display = 'flex';
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'statisticsPanel';
        panel.className = 'statistics-panel';
        
        // Check PIN status for button label
        let pinButtonHtml = '<button id="pinCodeManageBtn" class="primary-button" onclick="window.rustplusUI.statisticsManager.openPinCodeManager()">🔒 Manage PIN</button>';
        try {
            const pinStatus = await this.apiClient.get(`/api/statistics/pin-status/${this.guildId}`);
            pinButtonHtml = pinStatus.hasPinCode 
                ? '<button id="pinCodeManageBtn" class="primary-button" onclick="window.rustplusUI.statisticsManager.openPinCodeManager()">🔒 Change PIN</button>'
                : '<button id="pinCodeManageBtn" class="primary-button" onclick="window.rustplusUI.statisticsManager.openPinCodeManager()">🔒 Set PIN</button>';
        } catch (e) {
            console.log('PIN status check failed, using default button');
        }
        
        panel.innerHTML = `
            <div class="statistics-content">
                <div class="statistics-header">
                    <h2>📊 Server Statistics</h2>
                    <div class="header-actions" id="statsHeaderActions" style="display: flex; align-items: center; gap: 10px;">
                        ${pinButtonHtml}
                        <button class="primary-button" onclick="window.rustplusUI.statisticsManager.confirmResetStats()">🗑️ Reset Stats</button>
                        <button class="close-button" onclick="document.getElementById('statisticsPanel').style.display='none'">✕</button>
                    </div>
                </div>
                <div class="statistics-tabs">
                    <button class="tab-button active" data-tab="overview">Overview</button>
                    <button class="tab-button" data-tab="players">Players</button>
                    <button class="tab-button" data-tab="sessions">Sessions</button>
                    <button class="tab-button" data-tab="deaths">Deaths</button>
                    <button class="tab-button" data-tab="chat">Chat History</button>
                    <button class="tab-button" data-tab="replay">Map Replay</button>
                </div>
                <div class="statistics-body" id="statisticsBody">
                    <div class="loading">Loading statistics...</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        panel.style.display = 'flex';

        // Setup tab switching
        panel.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                panel.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.switchTab(e.target.dataset.tab);
            });
        });

        await this.loadOverview();
    }

    async switchTab(tab) {
        this.currentView = tab;
        const body = document.getElementById('statisticsBody');
        body.innerHTML = '<div class="loading">Loading...</div>';

        switch (tab) {
            case 'overview':
                await this.loadOverview();
                break;
            case 'players':
                await this.loadPlayers();
                break;
            case 'sessions':
                await this.loadSessions();
                break;
            case 'deaths':
                await this.loadDeaths();
                break;
            case 'chat':
                await this.loadChatHistory();
                break;
            case 'replay':
                await this.loadReplay();
                break;
        }
    }
    
    async openPinCodeManager() {
        // Check current PIN status from auth manager or API
        let hasPinCode = false;
        if (this.authManager) {
            hasPinCode = this.authManager.hasPinCode;
        }
        
        // If not set in auth manager, check from API
        if (hasPinCode === null || hasPinCode === undefined) {
            try {
                const pinStatus = await this.apiClient.get(`/api/statistics/pin-status/${this.guildId}`);
                hasPinCode = pinStatus.hasPinCode;
                if (this.authManager) {
                    this.authManager.hasPinCode = hasPinCode;
                }
            } catch (e) {
                console.log('Failed to check PIN status:', e);
                hasPinCode = false;
            }
        }
        
        if (!hasPinCode) {
            // No pin code set, show setup form
            this.showPinSetupForm();
        } else {
            // Pin code exists, show management options
            this.showPinManagementForm();
        }
    }
    
    showPinSetupForm() {
        const body = document.getElementById('statisticsBody');
        body.innerHTML = `
            <div style="max-width: 500px; margin: 0 auto; padding: 40px;">
                <h3>🔒 Set PIN Code</h3>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">Protect your server statistics with a PIN code. This PIN will be required to view statistics and reset data.</p>
                
                <div class="form-group">
                    <label>New PIN Code (4-20 characters)</label>
                    <input type="password" id="newPin" class="form-control" placeholder="Enter new PIN" maxlength="20">
                </div>
                
                <div class="form-group">
                    <label>Confirm PIN Code</label>
                    <input type="password" id="confirmPin" class="form-control" placeholder="Confirm PIN" maxlength="20">
                </div>
                
                <div id="pinSetupError" style="color: #ff5722; margin: 15px 0; min-height: 20px;"></div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="window.rustplusUI.statisticsManager.saveNewPin()" class="primary-button" style="flex: 1;">💾 Save PIN</button>
                    <button onclick="window.rustplusUI.statisticsManager.loadOverview()" class="primary-button" style="flex: 1; background: var(--bg-secondary);">Cancel</button>
                </div>
            </div>
        `;
    }
    
    showPinManagementForm() {
        const body = document.getElementById('statisticsBody');
        body.innerHTML = `
            <div style="max-width: 500px; margin: 0 auto; padding: 40px;">
                <h3>🔒 Manage PIN Code</h3>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">Change or remove your statistics PIN code.</p>
                
                <div class="form-group">
                    <label>Current PIN Code</label>
                    <input type="password" id="currentPin" class="form-control" placeholder="Enter current PIN">
                </div>
                
                <div class="form-group">
                    <label>New PIN Code (leave empty to remove PIN)</label>
                    <input type="password" id="newPin" class="form-control" placeholder="Enter new PIN (optional)" maxlength="20">
                </div>
                
                <div class="form-group">
                    <label>Confirm New PIN</label>
                    <input type="password" id="confirmPin" class="form-control" placeholder="Confirm new PIN">
                </div>
                
                <div id="pinManageError" style="color: #ff5722; margin: 15px 0; min-height: 20px;"></div>
                
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <button onclick="window.rustplusUI.statisticsManager.updatePin()" class="primary-button" style="flex: 1;">💾 Update PIN</button>
                    <button onclick="window.rustplusUI.statisticsManager.loadOverview()" class="primary-button" style="flex: 1; background: var(--bg-secondary);">Cancel</button>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="window.rustplusUI.statisticsManager.removePin()" class="primary-button" style="width: 100%; background: #d32f2f;">🗑️ Remove PIN Protection</button>
                </div>
            </div>
        `;
    }
    
    async saveNewPin() {
        const newPin = document.getElementById('newPin')?.value || '';
        const confirmPin = document.getElementById('confirmPin')?.value || '';
        const errorDiv = document.getElementById('pinSetupError');
        
        if (!newPin || newPin.length < 4) {
            errorDiv.textContent = 'PIN must be at least 4 characters';
            return;
        }
        
        if (newPin !== confirmPin) {
            errorDiv.textContent = 'PIN codes do not match';
            return;
        }
        
        try {
            const result = await this.apiClient.post(`/api/statistics/set-pin/${this.guildId}`, { pin: newPin });
            
            if (result.success) {
                // Update auth manager
                if (this.authManager) {
                    this.authManager.hasPinCode = true;
                }
                // Update the PIN button text
                const pinBtn = document.getElementById('pinCodeManageBtn');
                if (pinBtn) pinBtn.textContent = '🔒 Change PIN';
                alert('✅ PIN code has been set successfully!');
                await this.loadOverview();
            } else {
                errorDiv.textContent = 'Failed to set PIN code';
            }
        } catch (error) {
            console.error('Error setting pin:', error);
            if (error.message && error.message.includes('404')) {
                errorDiv.textContent = '⚠️ PIN API endpoints not implemented yet on backend. Please add the PIN endpoints to your server.';
            } else {
                errorDiv.textContent = 'Error setting PIN code: ' + error.message;
            }
        }
    }
    
    async updatePin() {
        const currentPin = document.getElementById('currentPin')?.value || '';
        const newPin = document.getElementById('newPin')?.value || '';
        const confirmPin = document.getElementById('confirmPin')?.value || '';
        const errorDiv = document.getElementById('pinManageError');
        
        if (!currentPin) {
            errorDiv.textContent = 'Please enter current PIN';
            return;
        }
        
        if (newPin && newPin.length < 4) {
            errorDiv.textContent = 'New PIN must be at least 4 characters';
            return;
        }
        
        if (newPin !== confirmPin) {
            errorDiv.textContent = 'New PIN codes do not match';
            return;
        }
        
        try {
            const result = await this.apiClient.post(`/api/statistics/update-pin/${this.guildId}`, { 
                currentPin, 
                newPin: newPin || null 
            });
            
            if (result.success) {
                if (!newPin) {
                    // PIN was removed
                    if (this.authManager) {
                        this.authManager.hasPinCode = false;
                        this.authManager.clearAuth(); // Clear session auth
                    }
                    const pinBtn = document.getElementById('pinCodeManageBtn');
                    if (pinBtn) pinBtn.textContent = '🔒 Set PIN';
                    alert('✅ PIN code has been removed successfully!\n\nWebsite is now accessible without authentication.');
                } else {
                    alert('✅ PIN code has been updated successfully!');
                }
                await this.loadOverview();
            } else {
                errorDiv.textContent = result.error || 'Incorrect current PIN';
            }
        } catch (error) {
            console.error('Error updating pin:', error);
            errorDiv.textContent = 'Error updating PIN code';
        }
    }
    
    async removePin() {
        const currentPin = document.getElementById('currentPin')?.value || '';
        const errorDiv = document.getElementById('pinManageError');
        
        if (!currentPin) {
            errorDiv.textContent = 'Please enter current PIN to remove it';
            return;
        }
        
        if (!confirm('⚠️ Are you sure you want to remove PIN protection?\n\nAnyone will be able to view statistics and reset data without authentication.')) {
            return;
        }
        
        try {
            const result = await this.apiClient.post(`/api/statistics/update-pin/${this.guildId}`, { 
                currentPin, 
                newPin: null 
            });
            
            if (result.success) {
                if (this.authManager) {
                    this.authManager.hasPinCode = false;
                    this.authManager.clearAuth(); // Clear session auth
                }
                const pinBtn = document.getElementById('pinCodeManageBtn');
                if (pinBtn) pinBtn.textContent = '🔒 Set PIN';
                alert('✅ PIN code has been removed successfully!\n\nWebsite is now accessible without authentication.');
                await this.loadOverview();
            } else {
                errorDiv.textContent = result.error || 'Incorrect PIN';
            }
        } catch (error) {
            console.error('Error removing pin:', error);
            errorDiv.textContent = 'Error removing PIN code';
        }
    }

    async switchTab(tab) {
        this.currentView = tab;
        const body = document.getElementById('statisticsBody');
        body.innerHTML = '<div class="loading">Loading...</div>';

        switch (tab) {
            case 'overview':
                await this.loadOverview();
                break;
            case 'players':
                await this.loadPlayers();
                break;
            case 'sessions':
                await this.loadSessions();
                break;
            case 'deaths':
                await this.loadDeaths();
                break;
            case 'chat':
                await this.loadChatHistory();
                break;
            case 'replay':
                await this.loadReplay();
                break;
        }
    }

    async loadOverview() {
        try {
            const teamData = window.rustplusUI?.serverData?.team;
            if (!teamData || !teamData.players || teamData.players.length === 0) {
                document.getElementById('statisticsBody').innerHTML = `
                    <div class="info">No team data available. Connect to a server with team members to see statistics.</div>
                `;
                return;
            }

            const steamIds = teamData.players.map(p => p.steamId);
            const defaultHours = 168; // 7 days default
            const [teamStats, connectionStats] = await Promise.all([
                this.apiClient.get(`/api/statistics/team/${this.guildId}?steamIds=${steamIds.join(',')}&serverId=${this.serverId}`),
                this.apiClient.get(`/api/statistics/connections/${this.guildId}?hours=${defaultHours}&serverId=${this.serverId}`)
            ]);

            const body = document.getElementById('statisticsBody');
            body.innerHTML = `
                <div class="stats-overview">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon">👥</div>
                            <div class="stat-value">${teamStats.playerCount || 0}</div>
                            <div class="stat-label">Team Members</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">🎮</div>
                            <div class="stat-value">${teamStats.totalSessions || 0}</div>
                            <div class="stat-label">Total Sessions</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">⏱️</div>
                            <div class="stat-value">${teamStats.totalPlaytimeHours || 0}h</div>
                            <div class="stat-label">Total Playtime</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">📈</div>
                            <div class="stat-value">${Math.floor(teamStats.avgSessionSeconds / 60) || 0}m</div>
                            <div class="stat-label">Avg Session</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin: 30px 0 15px 0;">
                        <h3 style="margin: 0;">📈 Population Timeline</h3>
                        <div class="time-range-selector">
                            <label style="margin-right: 8px;">Time Range:</label>
                            <select id="populationTimeRange" onchange="window.rustplusUI.statisticsManager.updatePopulationTimeline()">
                                <option value="24">Last 24 Hours</option>
                                <option value="72">Last 3 Days</option>
                                <option value="168" selected>Last 7 Days</option>
                                <option value="336">Last 14 Days</option>
                                <option value="720">Last 30 Days</option>
                                <option value="2160">Last 90 Days</option>
                                <option value="4320">Last 180 Days</option>
                            </select>
                        </div>
                    </div>
                    <div class="chart-container">
                        <canvas id="connectionChart"></canvas>
                    </div>
                    
                    <h3>👥 Team Members Overview</h3>
                    <div class="team-stats-grid">
                        ${teamStats.playerStats.map(stat => `
                            <div class="team-member-card">
                                <div class="member-name">${this.getPlayerName(stat.steamId)}</div>
                                <div class="member-stats">
                                    <span>⏱️ ${stat.totalPlaytimeHours}h ${Math.floor((stat.totalPlaytimeSeconds % 3600) / 60)}m</span>
                                    <span>🎮 ${stat.totalSessions} sessions</span>
                                    <span>💀 ${stat.totalDeaths} deaths</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div id="dbInfo" class="db-info" style="margin-top: 20px;"></div>
                </div>
            `;

            this.renderPopulationTimeline(connectionStats);
            this.loadDatabaseInfo();
        } catch (error) {
            console.error('Error loading overview:', error);
            document.getElementById('statisticsBody').innerHTML = `
                <div class="error">Failed to load statistics: ${error.message}</div>
            `;
        }
    }

    async updatePopulationTimeline() {
        try {
            const hours = parseInt(document.getElementById('populationTimeRange')?.value || '168');
            const connectionStats = await this.apiClient.get(`/api/statistics/connections/${this.guildId}?hours=${hours}&serverId=${this.serverId}`);
            this.renderPopulationTimeline(connectionStats);
        } catch (error) {
            console.error('Error updating population timeline:', error);
        }
    }
    
    getPlayerName(steamId) {
        const teamData = window.rustplusUI?.serverData?.team;
        if (!teamData) return 'Unknown';
        const player = teamData.players.find(p => p.steamId === steamId);
        return player ? player.name : 'Unknown';
    }

    async loadPlayers() {
        try {
            const teamData = window.rustplusUI?.serverData?.team;
            if (!teamData || !teamData.players) {
                document.getElementById('statisticsBody').innerHTML = `
                    <div class="info">No team data available</div>
                `;
                return;
            }

            const steamIds = teamData.players.map(p => p.steamId);
            const playerStats = await Promise.all(
                steamIds.map(id => this.apiClient.get(`/api/statistics/player/${this.guildId}/${id}`))
            );

            const body = document.getElementById('statisticsBody');
            body.innerHTML = `
                <div class="players-stats">
                    <h3>Team Players</h3>
                    <div class="players-list">
                        ${playerStats.map((data, idx) => {
                            const player = teamData.players[idx];
                            const stats = data.stats;
                            return `
                                <div class="player-stat-card" style="border-left: 4px solid ${data.color};">
                                    <div class="player-stat-header">
                                        <img src="/api/avatar/${player.steamId}" alt="${player.name}" class="player-avatar-small">
                                        <div>
                                            <h4>${player.name}</h4>
                                            <span class="steam-id">${player.steamId}</span>
                                        </div>
                                    </div>
                                    <div class="player-stat-details">
                                        <div class="stat-row">
                                            <span>Total Playtime:</span>
                                            <strong>${stats.totalPlaytimeHours}h ${Math.floor((stats.totalPlaytimeSeconds % 3600) / 60)}m</strong>
                                        </div>
                                        <div class="stat-row">
                                            <span>Sessions:</span>
                                            <strong>${stats.totalSessions}</strong>
                                        </div>
                                        <div class="stat-row">
                                            <span>Avg Session:</span>
                                            <strong>${Math.floor(stats.avgSessionSeconds / 60)}m</strong>
                                        </div>
                                        <div class="stat-row">
                                            <span>Longest Session:</span>
                                            <strong>${Math.floor(stats.longestSessionSeconds / 3600)}h ${Math.floor((stats.longestSessionSeconds % 3600) / 60)}m</strong>
                                        </div>
                                        <div class="stat-row">
                                            <span>Deaths:</span>
                                            <strong>${stats.totalDeaths} (${stats.deathsPerHour.toFixed(2)}/hr)</strong>
                                        </div>
                                    </div>
                                    <button class="view-details-btn" onclick="window.rustplusUI.statisticsManager.viewPlayerDetails('${player.steamId}', '${player.name}')">
                                        View Details
                                    </button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error loading players:', error);
            document.getElementById('statisticsBody').innerHTML = `
                <div class="error">Failed to load player statistics: ${error.message}</div>
            `;
        }
    }

    async viewPlayerDetails(steamId, playerName) {
        try {
            const data = await this.apiClient.get(`/api/statistics/player/${this.guildId}/${steamId}`);
            
            // Helper function to get session duration (including active sessions)
            const now = Math.floor(Date.now() / 1000);
            const getSessionDuration = (session) => {
                if (session.duration_seconds && !session.is_active) {
                    return session.duration_seconds;
                }
                // For active sessions or missing duration, calculate from timestamps
                const endTime = session.session_end || now;
                return Math.max(0, endTime - session.session_start);
            };
            
            // Calculate enhanced statistics (including active sessions)
            const totalPlaytime = data.sessions.reduce((sum, s) => sum + getSessionDuration(s), 0);
            const avgSessionLength = data.sessions.length > 0 ? totalPlaytime / data.sessions.length : 0;
            const longestSession = Math.max(...data.sessions.map(s => getSessionDuration(s)), 0);
            const activeSessions = data.sessions.filter(s => s.is_active).length;
            const deathCount = data.deaths.length;
            const deathsPerHour = totalPlaytime > 0 ? (deathCount / (totalPlaytime / 3600)).toFixed(2) : 0;
            
            // Calculate play patterns (hours of day) - including active sessions
            const playByHour = new Array(24).fill(0);
            const playByDayOfWeek = new Array(7).fill(0);
            data.sessions.forEach(session => {
                const start = new Date(session.session_start * 1000);
                const duration = getSessionDuration(session);
                playByHour[start.getHours()] += duration / 3600;
                playByDayOfWeek[start.getDay()] += duration / 3600;
            });
            
            const favoriteHour = playByHour.indexOf(Math.max(...playByHour));
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const favoriteDay = dayNames[playByDayOfWeek.indexOf(Math.max(...playByDayOfWeek))];
            
            const body = document.getElementById('statisticsBody');
            body.innerHTML = `
                <div class="player-details">
                    <button class="back-button" onclick="window.rustplusUI.statisticsManager.loadPlayers()">← Back to Players</button>
                    <div class="player-header" style="border-left: 4px solid ${data.color};">
                        <img src="/api/avatar/${steamId}" alt="${this.escapeHtml(playerName)}" class="player-avatar-large">
                        <div style="flex: 1;">
                            <h2>${this.escapeHtml(playerName)}</h2>
                            <span class="steam-id">${steamId}</span>
                            ${activeSessions > 0 ? '<span style="color: #4caf50; font-weight: bold; margin-left: 10px;">● ONLINE</span>' : ''}
                        </div>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon">⏱️</div>
                            <div class="stat-value">${Math.floor(totalPlaytime / 3600)}h ${Math.floor((totalPlaytime % 3600) / 60)}m</div>
                            <div class="stat-label">Total Playtime</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">📊</div>
                            <div class="stat-value">${Math.floor(avgSessionLength / 60)} min</div>
                            <div class="stat-label">Avg Session</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">🏆</div>
                            <div class="stat-value">${Math.floor(longestSession / 3600)}h ${Math.floor((longestSession % 3600) / 60)}m</div>
                            <div class="stat-label">Longest Session</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">💀</div>
                            <div class="stat-value">${deathCount}</div>
                            <div class="stat-label">Total Deaths</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">📈</div>
                            <div class="stat-value">${data.sessions.length}</div>
                            <div class="stat-label">Total Sessions</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">⚠️</div>
                            <div class="stat-value">${deathsPerHour}</div>
                            <div class="stat-label">Deaths/Hour</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">🕐</div>
                            <div class="stat-value">${favoriteHour}:00</div>
                            <div class="stat-label">Favorite Hour</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">📅</div>
                            <div class="stat-value">${favoriteDay.substring(0, 3)}</div>
                            <div class="stat-label">Favorite Day</div>
                        </div>
                    </div>
                    
                    <h3>Session Duration Over Time</h3>
                    <canvas id="sessionChart" style="margin-bottom: 20px;"></canvas>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                        <div>
                            <h3>Activity by Hour of Day</h3>
                            <canvas id="hourlyActivityChart"></canvas>
                        </div>
                        <div>
                            <h3>Activity by Day of Week</h3>
                            <canvas id="weeklyActivityChart"></canvas>
                        </div>
                    </div>
                    
                    <h3>Recent Sessions (${data.sessions.length} total)</h3>
                    <div class="sessions-list">
                        ${data.sessions.slice(0, 15).map(session => {
                            const duration = getSessionDuration(session);
                            const hours = Math.floor(duration / 3600);
                            const minutes = Math.floor((duration % 3600) / 60);
                            const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;
                            return `
                            <div class="session-item ${session.is_active ? 'active' : ''}">
                                <div class="session-time">
                                    ${new Date(session.session_start * 1000).toLocaleString()}
                                    ${session.session_end ? '→ ' + new Date(session.session_end * 1000).toLocaleString() : '<span style="color: #4caf50;"> (Active Now)</span>'}
                                </div>
                                <div class="session-duration">
                                    ⏱️ ${durationStr}${session.is_active ? ' <span style="color: #4caf50;">(ongoing)</span>' : ''}
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                    
                    <h3>Recent Deaths (${deathCount} total)</h3>
                    <div class="deaths-list">
                        ${data.deaths.length > 0 ? data.deaths.slice(0, 15).map(death => `
                            <div class="death-item">
                                <div class="death-time">💀 ${new Date(death.death_time * 1000).toLocaleString()}</div>
                                <div class="death-location">
                                    ${death.x && death.y ? `📍 Location: (${Math.floor(death.x)}, ${Math.floor(death.y)})` : '📍 Unknown location'}
                                </div>
                            </div>
                        `).join('') : '<p style="color: #888; text-align: center; padding: 20px;">No deaths recorded yet 🎉</p>'}
                    </div>
                </div>
            `;
            
            // Render charts with proper sizing
            requestAnimationFrame(() => {
                this.renderPlayerSessionChart(data.sessions, data.color);
                this.renderHourlyActivityChart(playByHour, data.color);
                this.renderWeeklyActivityChart(playByDayOfWeek, data.color);
            });
        } catch (error) {
            console.error('Error loading player details:', error);
            const body = document.getElementById('statisticsBody');
            body.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">Error loading player details</p>';
        }
    }

    async loadSessions() {
        const teamData = window.rustplusUI?.serverData?.team;
        if (!teamData || !teamData.players || teamData.players.length === 0) {
            document.getElementById('statisticsBody').innerHTML = '<div class="info">No team data available.</div>';
            return;
        }

        const body = document.getElementById('statisticsBody');
        body.innerHTML = `
            <div class="sessions-overview">
                <div class="time-range-controls">
                    <h3>Team Session Timeline</h3>
                    <div class="time-range-selector">
                        <label>Time Range:</label>
                        <select id="timeRangeSelect" onchange="window.rustplusUI.statisticsManager.updateSessionTimeline()">
                            <option value="24">Last 24 Hours</option>
                            <option value="72">Last 3 Days</option>
                            <option value="168" selected>Last Week</option>
                            <option value="336">Last 2 Weeks</option>
                            <option value="720">Last 30 Days</option>
                            <option value="all">All Time</option>
                        </select>
                    </div>
                </div>
                <div class="timeline-legend">
                    <span class="legend-item"><span class="legend-box" style="background: #4caf50;"></span> Online</span>
                    <span class="legend-item"><span class="legend-box" style="background: #333;"></span> Offline</span>
                </div>
                <canvas id="allSessionsChart"></canvas>
            </div>
        `;
        
        await this.updateSessionTimeline();
    }

    async loadDeaths() {
        const body = document.getElementById('statisticsBody');
        body.innerHTML = `
            <div class="deaths-overview">
                <div class="time-range-controls">
                    <h3>💀 Death Statistics</h3>
                    <div class="time-range-selector">
                        <label>Time Range:</label>
                        <select id="deathTimeRangeSelect" onchange="window.rustplusUI.statisticsManager.updateDeathsView()">
                            <option value="24">Last 24 Hours</option>
                            <option value="72">Last 3 Days</option>
                            <option value="168" selected>Last Week</option>
                            <option value="336">Last 2 Weeks</option>
                            <option value="720">Last 30 Days</option>
                            <option value="all">All Time</option>
                        </select>
                    </div>
                </div>
                <div id="deathsContent">
                    <div class="loading">Loading death statistics...</div>
                </div>
            </div>
        `;
        
        await this.updateDeathsView();
    }
    
    async updateDeathsView() {
        try {
            const timeRange = document.getElementById('deathTimeRangeSelect')?.value || '168';
            const now = Math.floor(Date.now() / 1000);
            const startTime = timeRange === 'all' ? 0 : now - (parseInt(timeRange) * 3600);
            
            const url = `/api/statistics/deaths/${this.guildId}?startTime=${startTime}&endTime=${now}&limit=10000&serverId=${this.serverId || ''}`;
            console.log('[Deaths] Fetching from URL:', url);
            
            const deathsResponse = await this.apiClient.get(url);
            console.log('[Deaths] Received deaths:', deathsResponse);
            
            const content = document.getElementById('deathsContent');
            
            // Handle both array and object formats
            let deathsArray = Array.isArray(deathsResponse) ? deathsResponse : Object.values(deathsResponse).flat();
            
            // Group deaths by steam_id
            const deaths = {};
            deathsArray.forEach(death => {
                const steamId = death.steam_id;
                if (!deaths[steamId]) {
                    deaths[steamId] = [];
                }
                deaths[steamId].push(death);
            });
            
            // Calculate statistics
            const totalDeaths = deathsArray.length;
            const playerDeathCounts = {};
            const deathsByHour = new Array(24).fill(0);
            const recentDeaths = [];
            
            Object.entries(deaths).forEach(([steamId, playerDeaths]) => {
                playerDeathCounts[steamId] = playerDeaths.length;
                playerDeaths.forEach(death => {
                    const date = new Date(death.death_time * 1000);
                    deathsByHour[date.getHours()]++;
                    recentDeaths.push({ ...death, steamId });
                });
            });
            
            // Sort recent deaths by time
            recentDeaths.sort((a, b) => b.death_time - a.death_time);
            
            // Find most dangerous hour
            const maxDeathHour = deathsByHour.indexOf(Math.max(...deathsByHour));
            const avgDeathsPerDay = totalDeaths / (timeRange === 'all' ? 30 : parseInt(timeRange) / 24);
            
            // Get player names
            const teamData = window.rustplusUI?.serverData?.team;
            const getPlayerName = (steamId) => {
                if (!teamData) return 'Unknown';
                const player = teamData.players.find(p => p.steamId === steamId);
                return player ? player.name : 'Unknown';
            };
            
            // Top death leaders
            const topDeaths = Object.entries(playerDeathCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            
            content.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">💀</div>
                        <div class="stat-value">${totalDeaths}</div>
                        <div class="stat-label">Total Deaths</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">📊</div>
                        <div class="stat-value">${avgDeathsPerDay.toFixed(1)}</div>
                        <div class="stat-label">Deaths/Day</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">⏰</div>
                        <div class="stat-value">${maxDeathHour}:00</div>
                        <div class="stat-label">Most Dangerous Hour</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">👥</div>
                        <div class="stat-value">${Object.keys(playerDeathCounts).length}</div>
                        <div class="stat-label">Players with Deaths</div>
                    </div>
                </div>
                
                <h3>Deaths by Hour of Day</h3>
                <canvas id="deathsByHourChart" style="max-height: 250px; margin-bottom: 30px;"></canvas>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                    <div>
                        <h3>💀 Most Deaths Leaderboard</h3>
                        <div class="deaths-list">
                            ${topDeaths.length > 0 ? topDeaths.map(([steamId, count], index) => `
                                <div class="death-item" style="background: ${index === 0 ? 'rgba(255, 87, 34, 0.1)' : 'var(--bg-primary)'}; border-left: 3px solid ${index === 0 ? '#ff5722' : index === 1 ? '#ff9800' : index === 2 ? '#ffc107' : '#666'};">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <img src="/api/avatar/${steamId}" alt="" class="chat-avatar" style="width: 30px; height: 30px;">
                                        <div style="flex: 1;">
                                            <div style="font-weight: bold;">${index + 1}. ${this.escapeHtml(getPlayerName(steamId))}</div>
                                            <div style="font-size: 11px; color: var(--text-secondary);">${steamId}</div>
                                        </div>
                                        <div style="font-size: 20px; font-weight: bold; color: ${index === 0 ? '#ff5722' : '#888'};">${count}</div>
                                    </div>
                                </div>
                            `).join('') : '<p style="color: #888; text-align: center; padding: 20px;">No deaths recorded</p>'}
                        </div>
                    </div>
                    <div>
                        <h3>🕐 Recent Deaths</h3>
                        <div class="deaths-list">
                            ${recentDeaths.slice(0, 10).map(death => `
                                <div class="death-item">
                                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                                        <img src="/api/avatar/${death.steamId}" alt="" class="chat-avatar" style="width: 25px; height: 25px;">
                                        <div style="font-weight: bold;">${this.escapeHtml(getPlayerName(death.steamId))}</div>
                                    </div>
                                    <div class="death-time">${new Date(death.death_time * 1000).toLocaleString()}</div>
                                    <div class="death-location">
                                        ${death.x && death.y ? `📍 Location: (${Math.floor(death.x)}, ${Math.floor(death.y)})` : '📍 Unknown location'}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                
                <h3>All Deaths Map</h3>
                <div style="background: var(--bg-primary); padding: 15px; border-radius: 8px; text-align: center;">
                    <p style="color: var(--text-secondary); margin: 10px 0;">💡 Death locations are shown on the main map with skull markers</p>
                    <button class="primary-button" onclick="document.getElementById('showDeathMarkers').checked = true; window.rustplusUI.dirtyDynamic = true; window.rustplusUI.needsRender = true; document.getElementById('statisticsPanel').style.display='none';">
                        📍 View Deaths on Map
                    </button>
                </div>
            `;
            
            // Render deaths by hour chart
            this.renderDeathsByHourChart(deathsByHour);
            
        } catch (error) {
            console.error('Error loading deaths:', error);
            const content = document.getElementById('deathsContent');
            content.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">Error loading death statistics</p>';
        }
    }
    
    renderDeathsByHourChart(deathsByHour) {
        const canvas = document.getElementById('deathsByHourChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth || canvas.parentElement?.clientWidth || 800;
        canvas.height = 250;
        
        const data = deathsByHour.map((count, hour) => ({
            x: hour,
            y: count,
            label: `${hour}:00`
        }));
        
        const padding = { left: 50, right: 20, top: 30, bottom: 40 };
        const chartWidth = canvas.width - padding.left - padding.right;
        const chartHeight = canvas.height - padding.top - padding.bottom;
        const maxY = Math.max(...deathsByHour, 1) * 1.1;
        const barWidth = chartWidth / 24 * 0.7;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Deaths Distribution by Hour', canvas.width / 2, 20);
        
        // Draw bars
        data.forEach((point, i) => {
            const x = padding.left + (chartWidth / 24) * i + (chartWidth / 24 - barWidth) / 2;
            const barHeight = (point.y / maxY) * chartHeight;
            const y = padding.top + chartHeight - barHeight;
            
            // Gradient fill
            const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
            gradient.addColorStop(0, '#ff5722');
            gradient.addColorStop(1, '#ff5722aa');
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Hour label (every 3 hours)
            if (i % 3 === 0) {
                ctx.fillStyle = '#888';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(i.toString(), x + barWidth / 2, canvas.height - 5);
            }
        });
        
        // Draw axes
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + chartHeight);
        ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
        ctx.stroke();
        
        // Y-axis labels
        ctx.fillStyle = '#888';
        ctx.font = '11px Arial';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + chartHeight - (chartHeight / 5) * i;
            const value = Math.floor((maxY / 5) * i);
            ctx.fillText(value.toString(), padding.left - 5, y + 4);
        }
        
        // Axis labels
        ctx.fillStyle = '#aaa';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Hour of Day', canvas.width / 2, canvas.height - 5);
        
        ctx.save();
        ctx.translate(15, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Number of Deaths', 0, 0);
        ctx.restore();
    }

    async loadChatHistory() {
        try {
            const chatHistory = await this.apiClient.get(`/api/statistics/chat/${this.guildId}?limit=200`);
            
            const body = document.getElementById('statisticsBody');
            body.innerHTML = `
                <div class="chat-history">
                    <h3>Chat History</h3>
                    <div class="chat-messages">
                        ${chatHistory.map(msg => `
                            <div class="chat-message">
                                <div class="chat-header">
                                    <img src="/api/avatar/${msg.steam_id}" alt="${msg.player_name}" class="chat-avatar">
                                    <strong>${msg.player_name}</strong>
                                    <span class="chat-time">${new Date(msg.timestamp * 1000).toLocaleString()}</span>
                                </div>
                                <div class="chat-text">${this.escapeHtml(msg.message)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }

    async loadReplay() {
        const body = document.getElementById('statisticsBody');
        body.innerHTML = `
            <div class="replay-container">
                <h3>Map Replay</h3>
                <p class="info-text">View historical player movements on the main map with a timeline scrubber.</p>
                
                <div class="replay-setup">
                    <div class="form-group">
                        <label for="replayTimeRange">Time Range:</label>
                        <select id="replayTimeRange" class="form-control">
                            <option value="60">Last 1 Hour</option>
                            <option value="360">Last 6 Hours</option>
                            <option value="720">Last 12 Hours</option>
                            <option value="1440" selected>Last 24 Hours</option>
                            <option value="4320">Last 3 Days</option>
                            <option value="10080">Last 7 Days</option>
                            <option value="43200">Last 30 Days (Full History)</option>
                        </select>
                    </div>
                    
                    <button id="startReplayBtn" class="primary-button large">
                        🎬 Start Map Replay
                    </button>
                    
                    <div id="replayStatus" class="replay-status"></div>
                </div>
                
                <div class="replay-info-box">
                    <h4>How to use:</h4>
                    <ul>
                        <li>Select a time range above</li>
                        <li>Click "Start Map Replay" to load position data</li>
                        <li>Replay controls will appear at the bottom of the main map</li>
                        <li>Use the timeline scrubber to jump to any point in history</li>
                        <li>Play/pause and adjust speed with the control buttons</li>
                        <li>Click "Exit Replay" on the map to return to live view</li>
                    </ul>
                </div>
            </div>
        `;
        
        document.getElementById('startReplayBtn').onclick = () => this.startMapReplay();
    }

    async startMapReplay() {
        const minutes = parseInt(document.getElementById('replayTimeRange').value);
        const status = document.getElementById('replayStatus');
        const btn = document.getElementById('startReplayBtn');
        
        btn.disabled = true;
        status.innerHTML = '<div class="loading">Loading replay data...</div>';
        
        try {
            const replayData = await this.apiClient.get(`/api/statistics/replay/${this.guildId}?minutes=${minutes}`);
            
            const playerCount = Object.keys(replayData).length;
            const totalPositions = Object.values(replayData).reduce((sum, p) => sum + p.positions.length, 0);
            
            if (playerCount === 0 || totalPositions === 0) {
                status.innerHTML = '<div class="error">No replay data available for this time range.</div>';
                btn.disabled = false;
                return;
            }
            
            status.innerHTML = `<div class="success">✓ Loaded ${totalPositions.toLocaleString()} positions for ${playerCount} players</div>`;
            
            // Start replay on main map
            if (window.rustplusUI) {
                window.rustplusUI.setReplayMode(true, replayData);
                
                // Close statistics panel so user can see the map
                setTimeout(() => {
                    const panel = document.getElementById('statisticsPanel');
                    if (panel) panel.style.display = 'none';
                }, 1000);
            }
            
            btn.disabled = false;
        } catch (error) {
            status.innerHTML = `<div class="error">Error loading replay: ${error.message}</div>`;
            btn.disabled = false;
            console.error('Error loading replay:', error);
        }
    }

    async loadDatabaseInfo() {
        try {
            const info = await this.apiClient.get('/api/statistics/info');
            const dbInfo = document.getElementById('dbInfo');
            if (dbInfo) {
                dbInfo.innerHTML = `
                    Database: ${info.size.megabytes} MB | 
                    Last maintenance: ${info.maintenanceLog.length > 0 ? 
                        new Date(info.maintenanceLog[0].timestamp * 1000).toLocaleString() : 'Never'}
                `;
            }
        } catch (error) {
            console.error('Error loading database info:', error);
        }
    }

    renderPopulationTimeline(data) {
        const canvas = document.getElementById('connectionChart');
        if (!canvas) return;
        
        // Set canvas size
        canvas.width = canvas.offsetWidth;
        canvas.height = 300;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (!data || data.length === 0) {
            ctx.fillStyle = '#888';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
            return;
        }
        
        const padding = { top: 40, right: 40, bottom: 60, left: 60 };
        const chartWidth = canvas.width - padding.left - padding.right;
        const chartHeight = canvas.height - padding.top - padding.bottom;
        
        // Find max values
        const maxPlayers = Math.max(...data.map(d => d.online_players), 10);
        const maxQueue = Math.max(...data.map(d => d.queued_players || 0), 0);
        const maxValue = Math.max(maxPlayers, maxQueue) * 1.1;
        
        // Draw background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);
        
        // Draw grid lines
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartHeight / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();
            
            // Y-axis labels
            const value = Math.floor(maxValue * (1 - i / gridLines));
            ctx.fillStyle = '#888';
            ctx.font = '12px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(value.toString(), padding.left - 10, y + 4);
        }
        
        // Draw time labels (sample every N points for readability)
        const timeLabels = 6;
        const step = Math.floor(data.length / timeLabels);
        ctx.textAlign = 'center';
        for (let i = 0; i <= timeLabels; i++) {
            const idx = Math.min(i * step, data.length - 1);
            const x = padding.left + (chartWidth / data.length) * idx;
            const date = new Date(data[idx].timestamp * 1000);
            const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            ctx.fillText(timeStr, x, canvas.height - padding.bottom + 20);
        }
        
        // Function to draw line chart
        const drawLine = (dataKey, color, fillAlpha = 0.2) => {
            const points = data.map((point, i) => ({
                x: padding.left + (chartWidth / (data.length - 1)) * i,
                y: padding.top + chartHeight - ((point[dataKey] || 0) / maxValue) * chartHeight
            }));
            
            // Draw filled area
            ctx.fillStyle = color + Math.floor(fillAlpha * 255).toString(16).padStart(2, '0');
            ctx.beginPath();
            ctx.moveTo(points[0].x, chartHeight + padding.top);
            points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(points[points.length - 1].x, chartHeight + padding.top);
            ctx.closePath();
            ctx.fill();
            
            // Draw line
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            points.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
        };
        
        // Draw queue first (background layer)
        if (maxQueue > 0) {
            drawLine('queued_players', '#ff9800', 0.15);
        }
        
        // Draw online players (foreground layer)
        drawLine('online_players', '#4caf50', 0.25);
        
        // Draw border
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(padding.left, padding.top, chartWidth, chartHeight);
        
        // Draw legend
        const legendY = padding.top - 20;
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';
        
        // Online players legend
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(padding.left, legendY, 15, 15);
        ctx.fillStyle = '#fff';
        ctx.fillText('Online Players', padding.left + 20, legendY + 12);
        
        // Queue legend
        if (maxQueue > 0) {
            ctx.fillStyle = '#ff9800';
            ctx.fillRect(padding.left + 150, legendY, 15, 15);
            ctx.fillStyle = '#fff';
            ctx.fillText('Queue', padding.left + 170, legendY + 12);
        }
        
        // Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Server Population Over Time', canvas.width / 2, 20);
    }

    renderPlayerSessionChart(sessions, color) {
        const canvas = document.getElementById('sessionChart');
        if (!canvas) {
            console.log('[Charts] Session chart canvas not found');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth || canvas.parentElement?.clientWidth || 800;
        canvas.height = 300;
        
        const now = Math.floor(Date.now() / 1000);
        
        // Prepare data - show session durations over time (most recent 20)
        // Always calculate duration including active sessions
        const data = sessions
            .map(s => {
                let duration;
                if (s.duration_seconds && !s.is_active) {
                    duration = s.duration_seconds;
                } else {
                    // For active sessions, calculate current duration
                    const endTime = s.session_end || now;
                    duration = Math.max(0, endTime - s.session_start);
                }
                return { 
                    x: s.session_start, 
                    y: duration / 60,
                    timestamp: s.session_start,
                    isActive: s.is_active
                };
            })
            .filter(s => s.y > 0)
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-20);
        
        console.log('[Charts] Rendering session chart with', data.length, 'data points');
        this.renderSimpleBarChart(ctx, canvas, data, color, 'Session Duration (minutes)');
    }
    
    renderHourlyActivityChart(playByHour, color) {
        const canvas = document.getElementById('hourlyActivityChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth || canvas.parentElement?.clientWidth || 400;
        canvas.height = 200;
        
        const data = playByHour.map((hours, index) => ({
            x: index,
            y: hours,
            label: `${index}:00`
        }));
        
        this.renderSimpleBarChart(ctx, canvas, data, color, 'Hours Played by Hour of Day');
    }
    
    renderWeeklyActivityChart(playByDay, color) {
        const canvas = document.getElementById('weeklyActivityChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth || canvas.parentElement?.clientWidth || 400;
        canvas.height = 200;
        
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const data = playByDay.map((hours, index) => ({
            x: index,
            y: hours,
            label: dayNames[index]
        }));
        
        this.renderSimpleBarChart(ctx, canvas, data, color, 'Hours Played by Day of Week');
    }

    renderAllSessionsChart(sessionsData, players) {
        const canvas = document.getElementById('allSessionsChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Create timeline visualization showing when each player was online
        this.renderTimelineChart(ctx, canvas, sessionsData, players);
    }

    renderSimpleLineChart(ctx, canvas, data, yKey, label) {
        canvas.height = 300;
        const padding = 40;
        const width = canvas.width - padding * 2;
        const height = canvas.height - padding * 2;
        
        if (!data || data.length === 0) {
            ctx.fillStyle = '#888';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
            return;
        }
        
        const maxY = Math.max(...data.map(d => d[yKey])) * 1.1;
        const minY = 0;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        
        // Draw axes
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height + padding);
        ctx.lineTo(width + padding, height + padding);
        ctx.stroke();
        
        // Draw grid
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 5; i++) {
            const y = padding + (height / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width + padding, y);
            ctx.stroke();
            
            // Y-axis labels
            const value = maxY - (maxY / 5) * i;
            ctx.fillStyle = '#888';
            ctx.font = '10px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(Math.floor(value).toString(), padding - 5, y + 4);
        }
        
        // Draw line
        ctx.strokeStyle = '#00ff88';
        ctx.fillStyle = 'rgba(0, 255, 136, 0.2)';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        data.forEach((point, i) => {
            const x = padding + (width / (data.length - 1)) * i;
            const y = padding + height - ((point[yKey] - minY) / (maxY - minY)) * height;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        
        // Fill area under line
        ctx.lineTo(width + padding, height + padding);
        ctx.lineTo(padding, height + padding);
        ctx.closePath();
        ctx.fill();
        
        // Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(label, canvas.width / 2, 20);
    }

    renderSimpleBarChart(ctx, canvas, data, color, label) {
        // Canvas size should be set before calling this
        const padding = { left: 50, right: 20, top: 35, bottom: 40 };
        const width = canvas.width - padding.left - padding.right;
        const height = canvas.height - padding.top - padding.bottom;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (!data || data.length === 0) {
            ctx.fillStyle = '#888';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
            return;
        }
        
        const maxY = Math.max(...data.map(d => d.y), 1) * 1.1;
        const barWidth = Math.max(width / data.length * 0.7, 2);
        
        // Draw title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(label, canvas.width / 2, 20);
        
        // Draw bars with gradient
        data.forEach((point, i) => {
            const x = padding.left + (width / data.length) * i + (width / data.length - barWidth) / 2;
            const barHeight = (point.y / maxY) * height;
            const y = padding.top + height - barHeight;
            
            // Gradient fill
            const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
            const baseColor = color || '#00ff88';
            gradient.addColorStop(0, baseColor);
            // Convert hex/hsl to rgba for gradient transparency
            const gradientColor = baseColor.startsWith('#') ? baseColor + '88' : baseColor.replace('hsl(', 'hsla(').replace(')', ', 0.53)');
            gradient.addColorStop(1, gradientColor);
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Value on top of bar if space permits
            if (barHeight > 20) {
                ctx.fillStyle = '#fff';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                const valueText = point.y >= 60 ? `${Math.floor(point.y / 60)}h` : `${Math.floor(point.y)}m`;
                ctx.fillText(valueText, x + barWidth / 2, y - 5);
            }
        });
        
        // Draw axes
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + height);
        ctx.lineTo(padding.left + width, padding.top + height);
        ctx.stroke();
        
        // Y-axis labels
        ctx.fillStyle = '#888';
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + height - (height / 5) * i;
            const value = (maxY / 5) * i;
            const valueText = value >= 60 ? `${Math.floor(value / 60)}h` : `${Math.floor(value)}m`;
            ctx.fillText(valueText, padding.left - 5, y + 4);
            
            // Grid line
            if (i > 0) {
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(padding.left + width, y);
                ctx.stroke();
            }
        }
        
        // X-axis labels (show labels if available)
        if (data[0]?.label) {
            ctx.fillStyle = '#888';
            ctx.font = '9px Arial';
            ctx.textAlign = 'center';
            const labelStep = Math.ceil(data.length / 10);
            data.forEach((point, i) => {
                if (i % labelStep === 0 || data.length <= 10) {
                    const x = padding.left + (width / data.length) * i + (width / data.length) / 2;
                    ctx.fillText(point.label, x, canvas.height - 10);
                }
            });
        }
    }

    async updateSessionTimeline() {
        const teamData = window.rustplusUI?.serverData?.team;
        if (!teamData || !teamData.players) {
            console.log('[Sessions] No team data available');
            return;
        }

        const timeRange = document.getElementById('timeRangeSelect')?.value || '168';
        const steamIds = teamData.players.map(p => p.steamId).join(',');
        
        let url = `/api/statistics/sessions/${this.guildId}?steamIds=${steamIds}&serverId=${this.serverId}`;
        if (timeRange !== 'all') {
            // Add time-based filtering to get ALL sessions in the range
            const hours = parseInt(timeRange);
            const now = Math.floor(Date.now() / 1000);
            const startTime = now - (hours * 3600);
            url += `&startTime=${startTime}&endTime=${now}`;
            // Add high limit as fallback to ensure we get all sessions
            url += `&limit=10000`;
        } else {
            // For "all time", use a very high limit
            url += `&limit=50000`;
        }
        
        console.log('[Sessions] Fetching from URL:', url);
        try {
            const sessions = await this.apiClient.get(url);
            console.log('[Sessions] Received data:', sessions);
            console.log('[Sessions] Session counts per player:', Object.entries(sessions).map(([id, s]) => `${id}: ${s.length}`));
            requestAnimationFrame(() => this.renderTimelineChart(sessions, teamData.players));
        } catch (error) {
            console.error('Error loading session timeline:', error);
        }
    }

    renderTimelineChart(sessionsData, players) {
        const canvas = document.getElementById('allSessionsChart');
        if (!canvas) {
            console.log('[Sessions] Canvas not found');
            return;
        }
        
        console.log('[Sessions] Rendering chart with players:', players.length);
        console.log('[Sessions] Sessions data:', sessionsData);
        
        const ctx = canvas.getContext('2d');
        const rowHeight = 45;
        const headerHeight = 10;
        const padding = { left: 150, right: 40, top: headerHeight, bottom: 30 };

        const parentWidth = canvas.parentElement?.clientWidth || 0;
        const fallbackWidth = canvas.getBoundingClientRect().width || 1000;
        canvas.width = canvas.offsetWidth || parentWidth || fallbackWidth;
        canvas.height = (players?.length || 0) * rowHeight + padding.top + padding.bottom;
        
        console.log('[Sessions] Canvas size:', canvas.width, 'x', canvas.height);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!players || players.length === 0) {
            ctx.fillStyle = '#888';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No team data available', canvas.width / 2, canvas.height / 2);
            return;
        }
        
        // Get time range
        const timeRange = document.getElementById('timeRangeSelect')?.value || '168';
        const now = Date.now() / 1000;
        const startTime = timeRange === 'all' ? this.getEarliestSessionTime(sessionsData) : now - (parseInt(timeRange) * 3600);
        const endTime = now;
        const timeSpan = Math.max(1, endTime - startTime);
        
        console.log('[Sessions] Time range:', { timeRange, startTime: new Date(startTime * 1000), endTime: new Date(endTime * 1000), timeSpan });
        
        const chartWidth = canvas.width - padding.left - padding.right;
        const chartHeight = players.length * rowHeight;
        
        // Draw background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);
        
        // Draw grid lines and time labels
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#888';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        
        const timeIntervals = timeSpan < 86400 ? 6 : timeSpan < 259200 ? 8 : 10;
        for (let i = 0; i <= timeIntervals; i++) {
            const time = startTime + (timeSpan / timeIntervals) * i;
            const x = padding.left + (chartWidth / timeIntervals) * i;
            
            // Draw grid line
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + chartHeight);
            ctx.stroke();
            
            // Draw time label
            const date = new Date(time * 1000);
            const label = timeSpan < 86400 ? 
                `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` :
                `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:00`;
            ctx.fillText(label, x, canvas.height - 10);
        }
        
        const hasSessions = Object.values(sessionsData || {}).some(sessions => sessions.length > 0);

        // Draw each player's timeline
        players.forEach((player, index) => {
            const y = padding.top + index * rowHeight;
            const playerSessions = sessionsData[player.steamId] || [];
            const playerColor = this.getPlayerColorForTimeline(player.steamId);
            
            console.log(`[Sessions] Player ${player.name} (${player.steamId}): ${playerSessions.length} sessions`, playerSessions);
            
            // Draw player name background
            ctx.fillStyle = '#252525';
            ctx.fillRect(0, y, padding.left - 5, rowHeight - 5);
            
            // Draw player avatar if available
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = `/api/avatar/${player.steamId}`;
            img.onload = () => {
                ctx.save();
                ctx.beginPath();
                ctx.arc(20, y + rowHeight / 2, 15, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(img, 5, y + rowHeight / 2 - 15, 30, 30);
                ctx.restore();
            };
            
            // Draw player name
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(player.name.substring(0, 15), 45, y + rowHeight / 2 + 4);
            
            // Draw status indicator
            const isOnline = player.isOnline;
            ctx.fillStyle = isOnline ? '#4caf50' : '#666';
            ctx.beginPath();
            ctx.arc(padding.left - 15, y + rowHeight / 2, 5, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw session bars
            ctx.fillStyle = playerColor;
            playerSessions.forEach(session => {
                const sessionStart = Math.max(session.session_start, startTime);
                const sessionEnd = session.session_end ? Math.min(session.session_end, endTime) : endTime;
                
                if (sessionEnd > startTime && sessionStart < endTime) {
                    const startX = padding.left + ((sessionStart - startTime) / timeSpan) * chartWidth;
                    const endX = padding.left + ((sessionEnd - startTime) / timeSpan) * chartWidth;
                    const width = Math.max(endX - startX, 2);
                    
                    // Draw session bar with gradient
                    const gradient = ctx.createLinearGradient(startX, y + 8, startX, y + rowHeight - 13);
                    // Convert HSL to HSLA for transparency
                    const transparentColor = playerColor.replace('hsl(', 'hsla(').replace(')', ', 0.53)');
                    gradient.addColorStop(0, playerColor);
                    gradient.addColorStop(1, transparentColor);
                    ctx.fillStyle = gradient;
                    
                    ctx.fillRect(startX, y + 8, width, rowHeight - 13);
                    
                    // Add border if session is active
                    if (!session.session_end) {
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(startX, y + 8, width, rowHeight - 13);
                    }
                }
            });
            
            // Draw horizontal separator
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, y + rowHeight - 2);
            ctx.lineTo(canvas.width, y + rowHeight - 2);
            ctx.stroke();
        });
        
        // Draw border
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(padding.left, padding.top, chartWidth, chartHeight);

        if (!hasSessions) {
            ctx.fillStyle = '#888';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No sessions recorded yet', padding.left + chartWidth / 2, padding.top + chartHeight / 2);
        }
        
        // Draw "now" indicator
        const nowX = padding.left + ((now - startTime) / timeSpan) * chartWidth;
        ctx.strokeStyle = '#ff5722';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(nowX, padding.top);
        ctx.lineTo(nowX, padding.top + chartHeight);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // "Now" label
        ctx.fillStyle = '#ff5722';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('NOW', nowX, padding.top - 5);
    }
    
    getEarliestSessionTime(sessionsData) {
        let earliest = Date.now() / 1000;
        Object.values(sessionsData).forEach(sessions => {
            sessions.forEach(session => {
                if (session.session_start < earliest) {
                    earliest = session.session_start;
                }
            });
        });
        return earliest;
    }
    
    getPlayerColorForTimeline(steamId) {
        // Generate consistent color from steam ID
        const colors = window.rustplusUI?.playerColors;
        if (colors && colors[steamId]) {
            const color = colors[steamId];
            // Ensure it's in HSL format for gradient manipulation
            if (color.startsWith('#')) {
                // Convert hex to HSL if needed (simplified conversion)
                const hash = steamId.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
                const hue = Math.abs(hash) % 360;
                return `hsl(${hue}, 70%, 50%)`;
            }
            return color;
        }
        const hash = steamId.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }
    
    async confirmResetStats() {
        // Check if PIN is required
        if (this.hasPinCode) {
            // Show PIN verification modal
            this.showResetPinVerification();
        } else {
            // No PIN, proceed with regular confirmation
            await this.performReset();
        }
    }
    
    showResetPinVerification() {
        const body = document.getElementById('statisticsBody');
        const currentView = this.currentView;
        
        body.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; padding: 40px;">
                <div style="background: var(--bg-primary); padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: 500px; width: 100%;">
                    <h3 style="text-align: center; margin-bottom: 10px; color: #ff5722;">⚠️ Reset Statistics</h3>
                    <p style="text-align: center; color: var(--text-secondary); margin-bottom: 20px;">This will permanently delete ALL statistics data!</p>
                    
                    <div style="background: rgba(255, 87, 34, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #ff5722; margin-bottom: 25px;">
                        <p style="margin: 5px 0; font-size: 13px;">📊 All player sessions</p>
                        <p style="margin: 5px 0; font-size: 13px;">📍 Position history</p>
                        <p style="margin: 5px 0; font-size: 13px;">💀 Death records</p>
                        <p style="margin: 5px 0; font-size: 13px;">💬 Chat history</p>
                    </div>
                    
                    <p style="text-align: center; color: var(--text-primary); font-weight: bold; margin-bottom: 20px;">Enter PIN to confirm:</p>
                    
                    <input type="password" id="resetPinInput" placeholder="Enter PIN Code" maxlength="20" style="width: 100%; padding: 12px; font-size: 16px; border: 2px solid var(--border); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); text-align: center; letter-spacing: 2px; margin-bottom: 20px;">
                    <div id="resetPinError" style="color: #ff5722; text-align: center; margin-bottom: 15px; min-height: 20px;"></div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button onclick="window.rustplusUI.statisticsManager.verifyResetPin()" class="reset-stats-button" style="flex: 1;">🗑️ Confirm Reset</button>
                        <button onclick="window.rustplusUI.statisticsManager.switchTab('${currentView}')" class="back-button" style="flex: 1;">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        // Focus input and allow Enter key
        setTimeout(() => {
            const input = document.getElementById('resetPinInput');
            if (input) {
                input.focus();
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.verifyResetPin();
                    }
                });
            }
        }, 100);
    }
    
    async verifyResetPin() {
        const input = document.getElementById('resetPinInput');
        const errorDiv = document.getElementById('resetPinError');
        const pin = input?.value || '';
        
        if (!pin) {
            errorDiv.textContent = 'Please enter PIN code';
            return;
        }
        
        try {
            const result = await this.apiClient.post(`/api/statistics/verify-pin/${this.guildId}`, { pin });
            
            if (result.success) {
                // PIN verified, proceed with reset
                await this.performReset();
            } else {
                errorDiv.textContent = '❌ Incorrect PIN code';
                input.value = '';
                input.focus();
            }
        } catch (error) {
            console.error('Error verifying pin:', error);
            errorDiv.textContent = '❌ Error verifying PIN';
        }
    }
    
    async performReset() {
        if (!confirm('⚠️ FINAL WARNING\n\nAre you absolutely sure you want to reset ALL statistics?\n\nThis action cannot be undone!')) {
            await this.switchTab(this.currentView);
            return;
        }
        
        try {
            const body = document.getElementById('statisticsBody');
            body.innerHTML = '<div class="loading">Resetting statistics...</div>';
            
            await this.apiClient.post(`/api/statistics/reset/${this.guildId}`, {});
            alert('✅ Statistics have been reset successfully!');
            
            // Reload current view
            await this.switchTab(this.currentView);
        } catch (error) {
            console.error('Error resetting statistics:', error);
            alert('❌ Failed to reset statistics: ' + error.message);
            await this.switchTab(this.currentView);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
