// Map Replay System for RustPlus WebUI

class MapReplay {
    constructor(mapRenderer) {
        this.mapRenderer = mapRenderer;
        this.replayData = null;
        this.isReplayMode = false;
        this.isPlaying = false;
        this.currentTime = 0;
        this.startTime = 0;
        this.endTime = 0;
        this.playbackSpeed = 1;
        this.replayInterval = null;
        this.playerTrails = {}; // Store trail history for each player
        this.maxTrailLength = 500; // Base maximum points per trail (used when fade is active)
        this.trailFadeIntensity = 0.7; // 0 = no fade (solid), 1 = full fade
        this.deathMarkers = []; // Store all death markers from replay data
        this.minimapDeathMarkers = []; // Store death markers for minimap with timestamps
        this.controlsHeight = 80; // Height of replay control bar
        this.isDraggingProgress = false;
        this.controlsVisible = false;
    }
    
    // Calculate dynamic trail length based on fade intensity
    getMaxTrailLength() {
        if (this.trailFadeIntensity === 0) {
            // No fade = infinite trails (use a very large number)
            return 10000;
        } else {
            // With fade, limit based on when trails become too transparent
            // At minimum alpha (fadeProgress * intensity), trails should be cut off
            // The formula: we want alpha to reach ~0.1 (10% opacity) at the oldest point
            // alpha = fadeProgress * intensity + (1 - intensity) * 0.7
            // When fadeProgress = 0 (oldest), we get alpha = (1 - intensity) * 0.7
            // We want this to be around 0.1, so:
            // If intensity is high (close to 1), trails fade quickly -> shorter trails work
            // If intensity is low (close to 0), trails barely fade -> longer trails needed
            
            // Scale trail length inversely with fade intensity
            // High fade (1.0) = 200 points, Low fade (0.1) = 2000 points
            const baseLength = 200;
            const maxLength = 2000;
            return Math.floor(baseLength + (maxLength - baseLength) * (1 - this.trailFadeIntensity));
        }
    }

    async setReplayData(replayData) {
        this.replayData = replayData;
        this.playerTrails = {};
        this.deathMarkers = [];
        
        // Store player names in replay data
        Object.entries(replayData).forEach(([steamId, playerData]) => {
            // Get player name from team data if available
            const teamData = this.mapRenderer.serverData?.team;
            if (teamData && teamData.players) {
                const player = teamData.players.find(p => p.steamId === steamId);
                if (player) {
                    playerData.playerName = player.name;
                }
            }
        });
        
        // Find time range
        this.startTime = Infinity;
        this.endTime = 0;
        
        Object.values(replayData).forEach(playerData => {
            playerData.positions.forEach(pos => {
                this.startTime = Math.min(this.startTime, pos.timestamp);
                this.endTime = Math.max(this.endTime, pos.timestamp);
            });
        });
        
        // Load death markers from API
        try {
            const guildId = this.mapRenderer.selectedGuild;
            const steamIds = Object.keys(replayData).join(',');
            const response = await fetch(`/api/statistics/deaths/${guildId}?steamIds=${steamIds}&startTime=${this.startTime}&endTime=${this.endTime}`);
            if (response.ok) {
                this.deathMarkers = await response.json();
                console.log(`[Replay] Loaded ${this.deathMarkers.length} death markers`);
            }
        } catch (error) {
            console.error('[Replay] Failed to load death markers:', error);
        }
        
        this.currentTime = this.startTime;
        this.isReplayMode = true;
        this.controlsVisible = true;
        
        // Initialize replay state immediately
        this.updateReplayState();
        
        // Create HTML controls
        this.createHTMLControls();
        
        console.log(`[Replay] Loaded replay data from ${new Date(this.startTime * 1000).toLocaleString()} to ${new Date(this.endTime * 1000).toLocaleString()}`);
        console.log(`[Replay] ${Object.keys(replayData).length} players, controls visible: ${this.controlsVisible}`);
    }

    enableReplayMode(enabled) {
        this.isReplayMode = enabled;
        this.controlsVisible = enabled;
        if (!enabled) {
            this.stop();
            this.clearTrails();
            this.removeHTMLControls();
        }
        this.mapRenderer.dirtyDynamic = true;
        this.mapRenderer.needsRender = true;
    }
    
    createHTMLControls() {
        // Remove existing controls if any
        const existing = document.getElementById('replayControls');
        if (existing) existing.remove();
        
        const controls = document.createElement('div');
        controls.id = 'replayControls';
        controls.className = 'replay-controls-overlay';
        controls.innerHTML = `
            <div class="replay-control-bar">
                <div class="replay-time-info">
                    <div class="replay-current-time" id="replayCurrentTime">Loading...</div>
                    <div class="replay-time-range" id="replayTimeRange"></div>
                </div>
                <div class="replay-progress-container">
                    <input type="range" id="replayProgressBar" class="replay-progress-bar" min="0" max="100" value="0">
                </div>
                <div class="replay-trail-fade-container" style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: rgba(0,0,0,0.3); border-radius: 4px; margin: 0 10px;">
                    <label style="color: white; font-size: 12px; white-space: nowrap;">Trail Fade:</label>
                    <input type="range" id="replayTrailFade" class="trail-fade-slider" min="0" max="100" value="70" style="flex: 1; min-width: 100px;">
                    <span id="replayTrailFadeValue" style="color: white; font-size: 12px; min-width: 35px;">70%</span>
                </div>
                <div class="replay-buttons">
                    <button id="replayPlayPause" class="replay-btn replay-btn-play" title="Play/Pause">▶</button>
                    <button id="replayStop" class="replay-btn replay-btn-stop" title="Stop">⏹</button>
                    <button id="replaySpeedDown" class="replay-btn replay-btn-speed" title="Decrease Speed">«</button>
                    <span class="replay-speed-display" id="replaySpeed">1x</span>
                    <button id="replaySpeedUp" class="replay-btn replay-btn-speed" title="Increase Speed">»</button>
                    <button id="replayExit" class="replay-btn replay-btn-exit" title="Exit Replay">✕ Exit</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(controls);
        
        // Attach event listeners
        document.getElementById('replayPlayPause').onclick = () => {
            if (this.isPlaying) this.pause();
            else this.start();
            this.updateHTMLControls();
        };
        
        document.getElementById('replayStop').onclick = () => {
            this.stop();
            this.updateHTMLControls();
        };
        
        document.getElementById('replaySpeedDown').onclick = () => {
            this.setPlaybackSpeed(this.playbackSpeed / 2);
            this.updateHTMLControls();
        };
        
        document.getElementById('replaySpeedUp').onclick = () => {
            this.setPlaybackSpeed(this.playbackSpeed * 2);
            this.updateHTMLControls();
        };
        
        document.getElementById('replayExit').onclick = () => {
            this.enableReplayMode(false);
        };
        
        const progressBar = document.getElementById('replayProgressBar');
        progressBar.oninput = (e) => {
            const progress = parseFloat(e.target.value) / 100;
            const newTime = this.startTime + (this.endTime - this.startTime) * progress;
            this.seek(newTime);
        };
        
        // Trail fade slider
        const trailFadeSlider = document.getElementById('replayTrailFade');
        const trailFadeValue = document.getElementById('replayTrailFadeValue');
        
        trailFadeSlider.oninput = (e) => {
            const value = parseInt(e.target.value);
            this.trailFadeIntensity = value / 100;
            
            if (value === 0) {
                trailFadeValue.textContent = 'OFF';
                trailFadeValue.style.color = '#4caf50';
            } else {
                trailFadeValue.textContent = `${value}%`;
                trailFadeValue.style.color = 'white';
            }
            
            // Trim trails to new max length if fade increased
            const maxLength = this.getMaxTrailLength();
            Object.keys(this.playerTrails).forEach(steamId => {
                const trail = this.playerTrails[steamId];
                if (trail.length > maxLength) {
                    // Remove oldest points to fit new max length
                    this.playerTrails[steamId] = trail.slice(trail.length - maxLength);
                }
            });
            
            // Trigger re-render
            this.mapRenderer.dirtyDynamic = true;
            this.mapRenderer.needsRender = true;
        };
        
        this.updateHTMLControls();
    }
    
    updateHTMLControls() {
        if (!this.controlsVisible) return;
        
        const playPauseBtn = document.getElementById('replayPlayPause');
        if (playPauseBtn) {
            playPauseBtn.textContent = this.isPlaying ? '⏸' : '▶';
            playPauseBtn.className = this.isPlaying ? 'replay-btn replay-btn-pause' : 'replay-btn replay-btn-play';
        }
        
        const speedDisplay = document.getElementById('replaySpeed');
        if (speedDisplay) {
            speedDisplay.textContent = `${this.playbackSpeed}x`;
        }
        
        const currentTimeEl = document.getElementById('replayCurrentTime');
        if (currentTimeEl) {
            const date = new Date(this.currentTime * 1000);
            currentTimeEl.textContent = date.toLocaleString();
        }
        
        const timeRangeEl = document.getElementById('replayTimeRange');
        if (timeRangeEl) {
            const startDate = new Date(this.startTime * 1000);
            const endDate = new Date(this.endTime * 1000);
            const durationHours = ((this.endTime - this.startTime) / 3600).toFixed(1);
            timeRangeEl.textContent = `${startDate.toLocaleString()} → ${endDate.toLocaleString()} (${durationHours}h)`;
        }
        
        const progressBar = document.getElementById('replayProgressBar');
        if (progressBar && this.endTime > this.startTime) {
            const progress = ((this.currentTime - this.startTime) / (this.endTime - this.startTime)) * 100;
            progressBar.value = progress;
        }
    }
    
    removeHTMLControls() {
        const controls = document.getElementById('replayControls');
        if (controls) controls.remove();
    }

    start() {
        if (!this.replayData || this.isPlaying) return;
        
        this.isPlaying = true;
        this.replayInterval = setInterval(() => {
            this.tick();
        }, 100); // Update every 100ms
        
        console.log('[Replay] Started playback');
    }

    pause() {
        this.isPlaying = false;
        if (this.replayInterval) {
            clearInterval(this.replayInterval);
            this.replayInterval = null;
        }
        console.log('[Replay] Paused playback');
    }

    stop() {
        this.pause();
        this.currentTime = this.startTime;
        this.clearTrails();
        console.log('[Replay] Stopped playback');
    }

    tick() {
        if (!this.isPlaying) return;
        
        // Advance time (1 second of real time = configurable game time)
        const timeIncrement = 60 * this.playbackSpeed;
        this.currentTime += timeIncrement;
        
        if (this.currentTime >= this.endTime) {
            this.currentTime = this.startTime;
            this.clearTrails();
        }
        
        this.updateReplayState();
        this.updateHTMLControls();
        this.mapRenderer.dirtyDynamic = true;
        this.mapRenderer.needsRender = true;
    }

    updateReplayState() {
        // Build current state based on replay time
        const currentState = {};
        
        Object.entries(this.replayData).forEach(([steamId, playerData]) => {
            // Find the most recent position at or before currentTime
            let lastPos = null;
            for (const pos of playerData.positions) {
                if (pos.timestamp <= this.currentTime) {
                    lastPos = pos;
                } else {
                    break;
                }
            }
            
            if (lastPos) {
                currentState[steamId] = {
                    steamId: steamId,
                    x: lastPos.x,
                    y: lastPos.y,
                    isAlive: lastPos.isAlive,
                    color: playerData.color
                };
                
                // Add to trail
                if (!this.playerTrails[steamId]) {
                    this.playerTrails[steamId] = [];
                }
                this.playerTrails[steamId].push({ x: lastPos.x, y: lastPos.y, timestamp: this.currentTime });
                
                // Limit trail length dynamically based on fade setting
                const maxLength = this.getMaxTrailLength();
                if (this.playerTrails[steamId].length > maxLength) {
                    this.playerTrails[steamId].shift();
                }
            }
        });
        
        // Store current replay state for rendering
        this.currentReplayState = currentState;
    }

    clearTrails() {
        this.playerTrails = {};
    }

    seek(timestamp) {
        this.currentTime = timestamp;
        this.clearTrails();
        
        // Rebuild trails up to this point
        Object.entries(this.replayData).forEach(([steamId, playerData]) => {
            this.playerTrails[steamId] = [];
            
            for (const pos of playerData.positions) {
                if (pos.timestamp <= this.currentTime) {
                    this.playerTrails[steamId].push({ x: pos.x, y: pos.y, timestamp: pos.timestamp });
                } else {
                    break;
                }
            }
            
            // Limit trail dynamically based on fade setting
            const maxLength = this.getMaxTrailLength();
            if (this.playerTrails[steamId].length > maxLength) {
                this.playerTrails[steamId] = this.playerTrails[steamId].slice(-maxLength);
            }
        });
        
        this.updateReplayState();
        this.mapRenderer.dirtyDynamic = true;
        this.mapRenderer.needsRender = true;
    }

    setPlaybackSpeed(speed) {
        this.playbackSpeed = Math.max(0.1, Math.min(100, speed));
        console.log(`[Replay] Playback speed: ${this.playbackSpeed}x`);
    }

    // Render replay trails and positions
    render(ctx, mapData) {
        if (!this.isReplayMode) {
            return false; // Not in replay mode, use normal rendering
        }
        
        console.log(`[Replay] Rendering - controlsVisible: ${this.controlsVisible}, hasState: ${!!this.currentReplayState}`);
        
        const { width, height, oceanMargin } = mapData;
        
        // Draw death markers that have occurred up to current time
        this.deathMarkers.forEach(death => {
            if (death.death_time <= this.currentTime) {
                const pos = this.mapRenderer.worldToCanvas(death.x, death.y);
                
                // Draw skull marker
                ctx.fillStyle = '#ff0000';
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.strokeText('💀', pos.x, pos.y);
                ctx.fillText('💀', pos.x, pos.y);
                
                // Draw player name below skull
                ctx.font = 'bold 12px Arial';
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 3;
                ctx.strokeText(death.player_name, pos.x, pos.y + 20);
                ctx.fillText(death.player_name, pos.x, pos.y + 20);
            }
        });
        
        // Draw trails for each player (only if we have state)
        if (this.currentReplayState) {
            Object.entries(this.playerTrails).forEach(([steamId, trail]) => {
                if (trail.length < 2) return;
                
                const playerData = this.replayData[steamId];
                if (!playerData) return;
                
                const color = playerData.color;
                
                // Draw trail with configurable gradient
                for (let i = 0; i < trail.length - 1; i++) {
                    // Calculate alpha based on fade intensity
                    // If fade is 0 (OFF), alpha is always 0.7 (solid)
                    // If fade is 1 (100%), alpha fades from 0.3 to 1.0
                    let alpha;
                    if (this.trailFadeIntensity === 0) {
                        alpha = 0.7; // Solid trail, no fade
                    } else {
                        // Apply fade: newer points are more opaque
                        const fadeProgress = (i / trail.length);
                        alpha = fadeProgress * this.trailFadeIntensity + (1 - this.trailFadeIntensity) * 0.7;
                    }
                    
                    ctx.globalAlpha = alpha;
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 3;
                    ctx.lineCap = 'round';
                    
                    const p1 = trail[i];
                    const p2 = trail[i + 1];
                    
                    const pos1 = this.mapRenderer.worldToCanvas(p1.x, p1.y);
                    const pos2 = this.mapRenderer.worldToCanvas(p2.x, p2.y);
                    
                    ctx.beginPath();
                    ctx.moveTo(pos1.x, pos1.y);
                    ctx.lineTo(pos2.x, pos2.y);
                    ctx.stroke();
                }
                
                ctx.globalAlpha = 1.0;
            });
            
            // Draw current player positions with names and avatars
            Object.values(this.currentReplayState).forEach(player => {
                const pos = this.mapRenderer.worldToCanvas(player.x, player.y);
                
                // Draw player avatar if available
                const avatarImg = document.querySelector(`img[src="/api/avatar/${player.steamId}"]`);
                if (avatarImg && avatarImg.complete) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(avatarImg, pos.x - 12, pos.y - 12, 24, 24);
                    ctx.restore();
                    
                    // Border around avatar
                    ctx.strokeStyle = player.color;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
                    ctx.stroke();
                } else {
                    // Fallback to colored dot
                    ctx.fillStyle = player.color;
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
                
                // Draw player name
                const playerData = this.replayData[player.steamId];
                const playerName = playerData?.playerName || player.steamId;
                
                ctx.font = 'bold 12px Arial';
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 3;
                ctx.textAlign = 'center';
                ctx.strokeText(playerName, pos.x, pos.y - 20);
                ctx.fillText(playerName, pos.x, pos.y - 20);
                
                // Draw pulsing effect if alive
                if (player.isAlive) {
                    ctx.strokeStyle = player.color;
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.5;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.globalAlpha = 1.0;
                }
            });
        }
        
        // Add death markers to minimap
        this.updateMinimapDeathMarkers();
        
        return true; // We handled the rendering
    }
    
    updateMinimapDeathMarkers() {
        const now = Date.now() / 1000;
        
        // Add new death markers that just occurred
        this.deathMarkers.forEach(death => {
            if (death.death_time <= this.currentTime) {
                // Check if this death is already in minimap markers
                const exists = this.minimapDeathMarkers.some(m => 
                    m.steam_id === death.steam_id && m.death_time === death.death_time
                );
                
                if (!exists) {
                    this.minimapDeathMarkers.push({
                        ...death,
                        addedAt: now
                    });
                }
            }
        });
        
        // Remove markers older than 2 minutes
        this.minimapDeathMarkers = this.minimapDeathMarkers.filter(marker => {
            return (now - marker.addedAt) < 120; // 2 minutes
        });
    }
    
    getMinimapDeathMarkers() {
        return this.minimapDeathMarkers;
    }

    // Draw live player trails (non-replay mode)
    renderLiveTrails(ctx, mapData, playerPositions) {
        if (this.isReplayMode) return; // Don't draw live trails in replay mode
        
        const { width, height, oceanMargin } = mapData;
        
        // Draw trails for online players
        Object.values(playerPositions).forEach(player => {
            if (!player.trail || player.trail.length < 2) return;
            
            const color = player.color || '#00ff88';
            
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.6;
            
            ctx.beginPath();
            let first = true;
            player.trail.forEach(point => {
                const x = this.mapRenderer.gameToCanvasX(point.x, width, oceanMargin);
                const y = this.mapRenderer.gameToCanvasY(point.y, height, oceanMargin);
                
                if (first) {
                    ctx.moveTo(x, y);
                    first = false;
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        });
    }
}
