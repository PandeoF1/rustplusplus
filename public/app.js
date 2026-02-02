class RustPlusWebUI {
    constructor() {
        this.socket = null;
        this.currentGuildId = null;
        this.serverData = null;
        this.mapImage = null;
        
        // Initialize API client
        this.apiClient = new APIClient();
        
        // Initialize global authentication manager
        this.authManager = new AuthManager(this.apiClient);
        
        // Statistics manager
        this.statisticsManager = null;
        
        // Map replay system
        this.mapReplay = null;
        
        // Player colors (persistent across sessions)
        this.playerColors = {};
        
        // Trail duration setting (in milliseconds) - default 10 minutes
        this.trailDuration = parseInt(localStorage.getItem('trailDuration')) || 600000;
        
        // Monument name mapping with emojis
        this.monumentNames = {
            // Base names
            'airfield': { name: 'Airfield', emoji: '✈️' },
            'arctic_base': { name: 'Arctic Research Base', emoji: '🏔️' },
            'arctic_base_a': { name: 'Arctic Research Base', emoji: '🏔️' },
            'bandit_camp': { name: 'Bandit Camp', emoji: '🏕️' },
            'dome': { name: 'The Dome', emoji: '⚛️' },
            'excavator': { name: 'Giant Excavator Pit', emoji: '⚒️' },
            'gas_station': { name: 'Gas Station', emoji: '⛽' },
            'harbor': { name: 'Harbor', emoji: '⚓' },
            'junkyard': { name: 'Junkyard', emoji: '🗑️' },
            'large_oil_rig': { name: 'Large Oil Rig', emoji: '🛢️' },
            'launch_site': { name: 'Launch Site', emoji: '🚀' },
            'launchsite': { name: 'Launch Site', emoji: '🚀' },
            'lighthouse': { name: 'Lighthouse', emoji: '🗼' },
            'military_tunnel': { name: 'Military Tunnels', emoji: '🎖️' },
            'military_tunnels': { name: 'Military Tunnels', emoji: '🎖️' },
            'missile_silo_monument': { name: 'Missile Silo', emoji: '🚀' },
            'mining_outpost': { name: 'Mining Outpost', emoji: '⛏️' },
            'mining_quarry': { name: 'Mining Quarry', emoji: '🪨' },
            'outpost': { name: 'Outpost', emoji: '🏪' },
            'power_plant': { name: 'Power Plant', emoji: '⚡' },
            'quarry': { name: 'Quarry', emoji: '🪨' },
            'ranch': { name: 'Ranch', emoji: '🐄' },
            'sewer_branch': { name: 'Sewer Branch', emoji: '🚰' },
            'sewer': { name: 'Sewer Branch', emoji: '🚰' },
            'small_oil_rig': { name: 'Small Oil Rig', emoji: '🛢️' },
            'oil_rig_small': { name: 'Small Oil Rig', emoji: '🛢️' },
            'supermarket': { name: 'Abandoned Supermarket', emoji: '🏬' },
            'abandoned_supermarket': { name: 'Abandoned Supermarket', emoji: '🏬' },
            'satellite': { name: 'Satellite Dish', emoji: '📡' },
            'satellite_dish': { name: 'Satellite Dish', emoji: '📡' },
            'train_tunnel': { name: 'Train Tunnel', emoji: '🚇' },
            'train_yard': { name: 'Train Yard', emoji: '🚂' },
            'trainyard': { name: 'Train Yard', emoji: '🚂' },
            'underwater_lab': { name: 'Underwater Lab', emoji: '🔬' },
            'water_treatment': { name: 'Water Treatment Plant', emoji: '💧' },
            'water_treatment_plant': { name: 'Water Treatment Plant', emoji: '💧' },
            'water_well': { name: 'Water Well', emoji: '🚰' },
            'fishing_village': { name: 'Fishing Village', emoji: '🎣' },
            'large_fishing_village': { name: 'Large Fishing Village', emoji: '🎣' },
            'stable': { name: 'Stable', emoji: '🐴' },
            'stables': { name: 'Stables', emoji: '🐴' },
            'stables_a': { name: 'Ranch', emoji: '🐄' },
            'stables_b': { name: 'Large Barn', emoji: '🏚️' },
            
            // Display name variants (with _display_name suffix)
            'airfield_display_name': { name: 'Airfield', emoji: '✈️' },
            'arctic_base_display_name': { name: 'Arctic Research Base', emoji: '🏔️' },
            'arctic_base_a_display_name': { name: 'Arctic Research Base', emoji: '🏔️' },
            'bandit_camp_display_name': { name: 'Bandit Camp', emoji: '🏕️' },
            'dome_display_name': { name: 'The Dome', emoji: '⚛️' },
            'dome_monument_name': { name: 'The Dome', emoji: '⚛️' },
            'excavator_display_name': { name: 'Giant Excavator Pit', emoji: '⚒️' },
            'gas_station_display_name': { name: 'Gas Station', emoji: '⛽' },
            'harbor_display_name': { name: 'Harbor', emoji: '⚓' },
            'harbor_1_display_name': { name: 'Harbor', emoji: '⚓' },
            'harbor_2_display_name': { name: 'Harbor', emoji: '⚓' },
            'junkyard_display_name': { name: 'Junkyard', emoji: '🗑️' },
            'large_oil_rig_display_name': { name: 'Large Oil Rig', emoji: '🛢️' },
            'launch_site_display_name': { name: 'Launch Site', emoji: '🚀' },
            'lighthouse_display_name': { name: 'Lighthouse', emoji: '🗼' },
            'military_tunnel_display_name': { name: 'Military Tunnels', emoji: '🎖️' },
            'military_tunnels_display_name': { name: 'Military Tunnels', emoji: '🎖️' },
            'missile_silo_monument_display_name': { name: 'Missile Silo', emoji: '🚀' },
            'mining_outpost_display_name': { name: 'Mining Outpost', emoji: '⛏️' },
            'mining_quarry_display_name': { name: 'Mining Quarry', emoji: '🪨' },
            'outpost_display_name': { name: 'Outpost', emoji: '🏪' },
            'power_plant_display_name': { name: 'Power Plant', emoji: '⚡' },
            'quarry_display_name': { name: 'Quarry', emoji: '🪨' },
            'ranch_display_name': { name: 'Ranch', emoji: '🐄' },
            'sewer_branch_display_name': { name: 'Sewer Branch', emoji: '🚰' },
            'sewer_display_name': { name: 'Sewer Branch', emoji: '🚰' },
            'small_oil_rig_display_name': { name: 'Small Oil Rig', emoji: '🛢️' },
            'oil_rig_small_display_name': { name: 'Small Oil Rig', emoji: '🛢️' },
            'supermarket_display_name': { name: 'Abandoned Supermarket', emoji: '🏬' },
            'abandoned_supermarket_display_name': { name: 'Abandoned Supermarket', emoji: '🏬' },
            'satellite_display_name': { name: 'Satellite Dish', emoji: '📡' },
            'satellite_dish_display_name': { name: 'Satellite Dish', emoji: '📡' },
            'train_tunnel_display_name': { name: 'Train Tunnel', emoji: '🚇' },
            'train_tunnel_link_display_name': { name: 'Train Tunnel', emoji: '🚇' },
            'train_yard_display_name': { name: 'Train Yard', emoji: '🚂' },
            'trainyard_display_name': { name: 'Train Yard', emoji: '🚂' },
            'underwater_lab_display_name': { name: 'Underwater Lab', emoji: '🔬' },
            'water_treatment_display_name': { name: 'Water Treatment Plant', emoji: '💧' },
            'water_treatment_plant_display_name': { name: 'Water Treatment Plant', emoji: '💧' },
            'water_well_display_name': { name: 'Water Well', emoji: '🚰' },
            'fishing_village_display_name': { name: 'Fishing Village', emoji: '🎣' },
            'large_fishing_village_display_name': { name: 'Large Fishing Village', emoji: '🎣' },
            'stable_display_name': { name: 'Stable', emoji: '🐴' },
            'stables_display_name': { name: 'Stables', emoji: '🐴' },
            'oxums_gas_station_display_name': { name: 'Oxum\'s Gas Station', emoji: '⛽' },
            'mining_quarry_a_display_name': { name: 'Mining Quarry', emoji: '🪨' },
            'mining_quarry_b_display_name': { name: 'Mining Quarry', emoji: '🪨' },
            'mining_quarry_c_display_name': { name: 'Mining Quarry', emoji: '🪨' },
            'mining_quarry_sulfur_display_name': { name: 'Sulfur Quarry', emoji: '🪨' },
            'mining_quarry_stone_display_name': { name: 'Stone Quarry', emoji: '🪨' },
            'mining_quarry_hqm_display_name': { name: 'HQM Quarry', emoji: '🪨' }
        };
        
        // Canvas layers
        this.backgroundCanvas = null;
        this.backgroundCtx = null;
        this.staticCanvas = null;
        this.staticCtx = null;
        this.dynamicCanvas = null;
        this.dynamicCtx = null;
        
        this.worldRect = null;
        
        // Pan and zoom state
        this.baseScale = 1;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        
        // Control states
        this.controls = {
            showPlayers: true,
            showPlayerNames: true,
            showTrails: true,
            showMonuments: true,
            showGrid: true,
            showMarkers: false,
            showVendingMachines: false,
            showEvents: false,
            showRadZones: false,
            showDeathMarkers: false
        };
        
        // Death markers data
        this.deathMarkersData = [];
        this.deathMarkersTimeRange = 24; // hours
        
        // Recent team deaths (always shown for 5 minutes, separate from death markers option)
        this.recentTeamDeaths = [];
        this.TEAM_DEATH_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
        
        // Persistent patrol markers (5-minute expiry)
        this.persistentPatrolMarkers = [];
        this.PATROL_MARKER_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

        this.playerTrails = {};
        this.needsRender = true;
        this.lastRenderTime = 0;
        this.dirtyStatic = true;
        this.dirtyDynamic = true;
        
        // Minimap properties
        this.minimapCanvas = null;
        this.minimapCtx = null;
        this.followedPlayerId = null;
        this.minimapSize = 300;
        this.minimapZoom = 10.0;
        this.minimapZoomMin = 0.2;
        this.minimapZoomMax = 16.0;
        this.minimapPanX = 0;
        this.minimapPanY = 0;
        this.minimapBaseCanvas = null;
        this.minimapBaseCtx = null;
        this.minimapBaseDirty = true;
        
        // Player avatars cache
        this.playerAvatars = {};
        this.loadAvatars = true;
        this.showMinimapGrid = true;
        this.showMinimapPlayerNames = true;
        
        this.init();
    }

    computeWorldRectFromWorldSize(imgW, imgH, worldSize, padWorld = 2000) {
        if (worldSize <= 0) {
            return { x: 0, y: 0, width: imgW, height: imgH };
        }

        const minSidePx = Math.min(imgW, imgH);
        const scale = worldSize / (worldSize + padWorld);
        const sidePx = minSidePx * scale;

        const ox = (imgW - sidePx) / 2.0;
        const oy = (imgH - sidePx) / 2.0;

        return { x: ox, y: oy, width: sidePx, height: sidePx };
    }

    worldToCanvas(worldX, worldY) {
        if (!this.worldRect || !this.serverData?.info?.mapSize) {
            return { x: 0, y: 0 };
        }

        const worldSize = this.serverData.info.mapSize;
        if (worldSize <= 0 || this.worldRect.width <= 0) {
            return { x: 0, y: 0 };
        }
        
        const x = this.worldRect.x + (worldX / worldSize) * this.worldRect.width;
        const y = this.worldRect.y + ((worldSize - worldY) / worldSize) * this.worldRect.height;
        
        return { x, y };
    }

    init() {
        this.backgroundCanvas = document.getElementById('map-background-canvas');
        this.backgroundCtx = this.backgroundCanvas.getContext('2d');
        this.staticCanvas = document.getElementById('map-static-canvas');
        this.staticCtx = this.staticCanvas.getContext('2d');
        this.dynamicCanvas = document.getElementById('map-dynamic-canvas');
        this.dynamicCtx = this.dynamicCanvas.getContext('2d');

        this.setupMinimap();
        this.setupSocketConnection();
        this.setupEventListeners();
        this.loadGuilds();
        this.startRenderLoop();
        
        // Initialize map replay system
        this.mapReplay = new MapReplay(this);
        
        // Setup statistics button (will be enabled when server is selected)
        this.setupStatisticsButton();
        
        // Make globally accessible for statistics panel
        window.rustplusUI = this;
        
        // Add window resize listener
        window.addEventListener('resize', () => this.handleResize());
        this.handleResize();
    }
    
    handleResize() {
        if (!this.mapImage) return;
        
        const wrapper = document.getElementById('mapWrapper');
        const containerWidth = wrapper.clientWidth;
        const containerHeight = wrapper.clientHeight;
        
        // Set canvas dimensions to fill the container
        [this.backgroundCanvas, this.staticCanvas, this.dynamicCanvas].forEach(canvas => {
            canvas.width = containerWidth;
            canvas.height = containerHeight;
        });
        
        // Compute base scale to fit map image into container
        const prevBaseScale = this.baseScale || 1;
        const zoomRatio = this.scale / prevBaseScale;
        this.baseScale = Math.min(containerWidth / this.mapImage.width, containerHeight / this.mapImage.height);
        this.scale = this.baseScale * zoomRatio;
        
        // Recalculate world rect based on the original map image size
        if (this.serverData?.info) {
            this.worldRect = this.computeWorldRectFromWorldSize(this.mapImage.width, this.mapImage.height, this.serverData.info.mapSize);
        }
        
        // Redraw everything
        this.dirtyStatic = true;
        this.dirtyDynamic = true;
        this.needsRender = true;
    }

    setupMinimap() {
        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        this.minimapCanvas.width = this.minimapSize;
        this.minimapCanvas.height = this.minimapSize;
        this.minimapBaseCanvas = document.createElement('canvas');
        this.minimapBaseCtx = this.minimapBaseCanvas.getContext('2d');
        
        this.minimapCanvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.minimapZoom *= zoomFactor;
            this.minimapZoom = Math.max(this.minimapZoomMin, Math.min(this.minimapZoomMax, this.minimapZoom));
            this.dirtyDynamic = true;
            this.needsRender = true;
        });
        
        let isPanning = false;
        let panStartX = 0, panStartY = 0;
        let panStartPanX = 0, panStartPanY = 0;
        
        this.minimapCanvas.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                isPanning = true;
                panStartX = e.clientX;
                panStartY = e.clientY;
                panStartPanX = this.minimapPanX;
                panStartPanY = this.minimapPanY;
                e.preventDefault();
            }
        });
        
        this.minimapCanvas.addEventListener('mousemove', (e) => {
            if (isPanning) {
                const dx = e.clientX - panStartX;
                const dy = e.clientY - panStartY;
                this.minimapPanX = panStartPanX + dx;
                this.minimapPanY = panStartPanY + dy;
                this.dirtyDynamic = true;
                this.needsRender = true;
            }
        });
        
        window.addEventListener('mouseup', (e) => {
            if (e.button === 2) isPanning = false;
        });
        
        this.minimapCanvas.addEventListener('mouseleave', () => { isPanning = false; });
        
        this.minimapCanvas.addEventListener('dblclick', (e) => {
            if (e.button === 2) {
                this.minimapZoom = 1.0;
                this.minimapPanX = 0;
                this.minimapPanY = 0;
                this.dirtyDynamic = true;
                this.needsRender = true;
                e.preventDefault();
            }
        });
        
        this.minimapCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    setupSocketConnection() {
        this.socket = io();
        
        this.socket.on('connect', () => this.updateConnectionStatus(true));
        this.socket.on('disconnect', () => this.updateConnectionStatus(false));

        this.socket.on('serverUpdate', (data) => {
            const firstUpdate = !this.serverData;
            this.serverData = data;

            if ((firstUpdate || !this.worldRect) && this.mapImage && this.serverData.info) {
                this.worldRect = this.computeWorldRectFromWorldSize(
                    this.mapImage.width,
                    this.mapImage.height,
                    this.serverData.info.mapSize
                );
                this.dirtyStatic = true;
            }
            
            // Track patrol helicopter DEATH location (explosion when taken down)
            if (data.mapMarkers?.patrolHelicopterDestroyedLocation && data.mapMarkers?.timeSincePatrolHelicopterWasDestroyed) {
                const deathTime = new Date(data.mapMarkers.timeSincePatrolHelicopterWasDestroyed).getTime();
                const exists = this.persistentPatrolMarkers.some(m => 
                    m.type === 'heli' && m.timestamp === deathTime
                );
                
                if (!exists) {
                    const gridPos = data.mapMarkers.patrolHelicopterDestroyedLocation;
                    // Convert grid position to world coordinates
                    // Grid positions are like "K15", we need to estimate the center
                    // For now, just use the location string
                    this.addPersistentPatrolMarker('heli', null, null, gridPos.location || gridPos, deathTime);
                }
            }

            this.updateUI();
            this.updateLastUpdateTime();
            
            // Load player avatars and update trails
            if (data.team?.players) {
                data.team.players.forEach(p => {
                    this.loadPlayerAvatar(p.steamId);
                    
                    // Add to player trails
                    if (p.isOnline && p.isAlive) {
                        if (!this.playerTrails[p.steamId]) {
                            this.playerTrails[p.steamId] = [];
                        }
                        
                        const pos = this.worldToCanvas(p.x, p.y);
                        if (pos) {
                            const trails = this.playerTrails[p.steamId];
                            const lastTrail = trails[trails.length - 1];
                            
                            // Only add if moved significantly (reduce trail point density)
                            if (!lastTrail || 
                                Math.abs(lastTrail.x - pos.x) > 5 || 
                                Math.abs(lastTrail.y - pos.y) > 5) {
                                trails.push({ x: pos.x, y: pos.y, time: Date.now() });
                                
                                // Keep only last 100 points
                                if (trails.length > 100) {
                                    trails.shift();
                                }
                            }
                        }
                    }
                });
            }
            
            this.dirtyDynamic = true;
            this.needsRender = true;
        });
        
        this.socket.on('resetPlayerTrail', (data) => {
            if (data.steamId && this.playerTrails[data.steamId]) {
                console.log(`[WebUI] Resetting trail for player ${data.steamId}`);
                this.playerTrails[data.steamId] = [];
                this.dirtyDynamic = true;
                this.needsRender = true;
            }
        });
        
        this.socket.on('teamDeath', (data) => {
            if (data.x && data.y && data.player_name) {
                const now = Date.now();
                this.recentTeamDeaths.push({
                    x: data.x,
                    y: data.y,
                    player_name: data.player_name,
                    steam_id: data.steam_id,
                    timestamp: now,
                    expiresAt: now + this.TEAM_DEATH_DURATION
                });
                console.log(`[WebUI] Team death recorded: ${data.player_name} at (${data.x}, ${data.y})`);
                this.dirtyDynamic = true;
                this.needsRender = true;
            }
        });
    }

    setupEventListeners() {
        document.getElementById('serverSelect').addEventListener('change', (e) => this.selectServer(e.target.value));

        Object.keys(this.controls).forEach(key => {
            const checkbox = document.getElementById(key);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this.controls[key] = e.target.checked;
                    this.needsRender = true;
                    const staticControls = ['showGrid', 'showMonuments', 'showVendingMachines'];
                    if (staticControls.includes(key)) {
                        this.dirtyStatic = true;
                    }
                    this.dirtyDynamic = true;
                    
                    // Show/hide death markers config and fetch data
                    if (key === 'showDeathMarkers') {
                        const config = document.getElementById('deathMarkersConfig');
                        if (config) {
                            config.style.display = e.target.checked ? 'block' : 'none';
                        }
                        if (e.target.checked) {
                            this.fetchDeathMarkers();
                        }
                    }
                });
            }
        });
        
        // Death markers time range selector
        const timeRangeSelect = document.getElementById('deathMarkersTimeRange');
        if (timeRangeSelect) {
            timeRangeSelect.addEventListener('change', (e) => {
                this.deathMarkersTimeRange = parseInt(e.target.value);
                if (this.controls.showDeathMarkers) {
                    this.fetchDeathMarkers();
                }
            });
        }
        
        // Refresh death markers button
        const refreshBtn = document.getElementById('refreshDeathMarkers');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (this.controls.showDeathMarkers) {
                    this.fetchDeathMarkers();
                }
            });
        }
        
        // Trail duration slider
        const trailSlider = document.getElementById('trailDurationSlider');
        const trailValue = document.getElementById('trailDurationValue');
        if (trailSlider && trailValue) {
            // Initialize slider with current value
            const currentMinutes = Math.round(this.trailDuration / 60000);
            trailSlider.value = currentMinutes;
            trailValue.textContent = currentMinutes;
            
            trailSlider.addEventListener('input', (e) => {
                const minutes = parseInt(e.target.value);
                trailValue.textContent = minutes;
                this.trailDuration = minutes * 60000; // Convert to milliseconds
                localStorage.setItem('trailDuration', this.trailDuration.toString());
                
                // Clear existing trails to apply new duration immediately
                Object.keys(this.playerTrails).forEach(steamId => {
                    const trails = this.playerTrails[steamId] || [];
                    this.playerTrails[steamId] = trails.filter(t => t.time > Date.now() - this.trailDuration);
                });
                
                this.dirtyDynamic = true;
                this.needsRender = true;
            });
        }

        document.getElementById('zoomIn').addEventListener('click', () => this.zoom(1.2));
        document.getElementById('zoomOut').addEventListener('click', () => this.zoom(0.8));
        document.getElementById('resetZoom').addEventListener('click', () => this.resetView());
        document.getElementById('toggleFullscreen').addEventListener('click', () => this.toggleFullscreen());

        const wrapper = this.dynamicCanvas;
        
        wrapper.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
        });

        wrapper.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.offsetX += (e.clientX - this.lastX) / this.scale;
                this.offsetY += (e.clientY - this.lastY) / this.scale;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                this.dirtyDynamic = true;
                this.needsRender = true;
            }
        });
        
        wrapper.addEventListener('mouseup', () => { this.isDragging = false; });
        wrapper.addEventListener('mouseleave', () => { this.isDragging = false; });
        
        document.getElementById('mapWrapper').addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoomAt(e.clientX, e.clientY, zoomFactor);
        });

        document.getElementById('pipButton')?.addEventListener('click', () => this.enterPictureInPicture());
        document.getElementById('followPlayer')?.addEventListener('change', (e) => {
            this.followedPlayerId = e.target.value || null;
            this.dirtyDynamic = true;
            this.needsRender = true;
        });
        
        document.getElementById('minimapZoomIn')?.addEventListener('click', () => {
            this.minimapZoom = Math.min(this.minimapZoomMax, this.minimapZoom * 1.2);
            this.dirtyDynamic = true;
            this.needsRender = true;
        });
        
        document.getElementById('minimapZoomOut')?.addEventListener('click', () => {
            this.minimapZoom = Math.max(this.minimapZoomMin, this.minimapZoom / 1.2);
            this.dirtyDynamic = true;
            this.needsRender = true;
        });
        
        document.getElementById('minimapReset')?.addEventListener('click', () => {
            this.minimapZoom = 1.0;
            this.minimapPanX = 0;
            this.minimapPanY = 0;
            this.dirtyDynamic = true;
            this.needsRender = true;
        });
        
        document.getElementById('hideMainMap')?.addEventListener('change', (e) => {
            const mapContainer = document.querySelector('.map-container');
            if (mapContainer) mapContainer.style.display = e.target.checked ? 'none' : 'flex';
        });
    }

    async loadGuilds() {
        try {
            const response = await fetch('/api/guilds');
            const guilds = await response.json();
            const select = document.getElementById('serverSelect');
            select.innerHTML = '<option value="">Select a server...</option>';
            guilds.forEach(g => select.add(new Option(`${g.guildName} - ${g.serverName}`, g.guildId)));
            if (guilds.length > 0) {
                select.value = guilds[0].guildId;
                this.selectServer(guilds[0].guildId);
            } else {
                select.innerHTML = '<option value="">No active servers</option>';
            }
        } catch (error) {
            console.error('Failed to load guilds:', error);
        }
    }

    async selectServer(guildId) {
        if (this.currentGuildId) this.socket.emit('unsubscribe', this.currentGuildId);
        this.currentGuildId = guildId;
        if (!guildId) {
            this.serverData = null;
            // Disable statistics button
            const statsBtn = document.getElementById('statsButton');
            if (statsBtn) statsBtn.disabled = true;
            return;
        }
        
        // Check authentication BEFORE subscribing or showing anything
        const isAuthenticated = await this.authManager.ensureAuthenticated(guildId);
        
        if (!isAuthenticated) {
            // User closed PIN modal or authentication failed
            // Reset to no server selected
            const select = document.getElementById('serverSelect');
            select.value = '';
            this.currentGuildId = null;
            this.serverData = null;
            return;
        }
        
        // Only proceed if authenticated
        this.socket.emit('subscribe', guildId);
        this.loadMapImage(guildId);
        
        // Initialize statistics manager for this guild
        if (this.statisticsManager) {
            this.statisticsManager.guildId = guildId;
            this.statisticsManager.authManager = this.authManager; // Share auth manager
        } else {
            this.statisticsManager = new StatisticsManager(this.apiClient, guildId);
            this.statisticsManager.authManager = this.authManager; // Share auth manager
        }
        
        // Enable statistics button
        const statsBtn = document.getElementById('statsButton');
        if (statsBtn) statsBtn.disabled = false;
        
        // Load player colors
        this.loadPlayerColors();
        
        // Load persistent patrol markers
        this.loadPersistentMarkers();
        
        // Start cleanup interval if not already running
        if (!this.patrolMarkerCleanupInterval) {
            this.patrolMarkerCleanupInterval = setInterval(() => {
                this.cleanExpiredPatrolMarkers();
                this.cleanExpiredDeathMarkers();
                this.cleanExpiredTeamDeaths();
            }, 30000); // Check every 30 seconds
        }
    }
    
    cleanExpiredDeathMarkers() {
        if (!this.deathMarkersData?.length) return;
        
        const now = Date.now();
        const before = this.deathMarkersData.length;
        this.deathMarkersData = this.deathMarkersData.filter(m => m.expiresAt > now);
        
        if (this.deathMarkersData.length !== before) {
            console.log(`[WebUI] Cleaned ${before - this.deathMarkersData.length} expired death markers`);
            this.dirtyDynamic = true;
            this.needsRender = true;
        }
    }
    
    cleanExpiredTeamDeaths() {
        if (!this.recentTeamDeaths?.length) return;
        
        const now = Date.now();
        const before = this.recentTeamDeaths.length;
        this.recentTeamDeaths = this.recentTeamDeaths.filter(d => d.expiresAt > now);
        
        if (this.recentTeamDeaths.length !== before) {
            console.log(`[WebUI] Cleaned ${before - this.recentTeamDeaths.length} expired team deaths`);
            this.dirtyDynamic = true;
            this.needsRender = true;
        }
    }
    
    async fetchDeathMarkers() {
        if (!this.currentGuildId) return;
        
        try {
            const hoursAgo = this.deathMarkersTimeRange;
            const startTime = Math.floor(Date.now() / 1000) - (hoursAgo * 3600);
            
            const response = await fetch(`/api/statistics/deaths/${this.currentGuildId}?startTime=${startTime}`);
            if (response.ok) {
                const deaths = await response.json();
                const now = Date.now();
                const fiveMinutesMs = 5 * 60 * 1000;
                
                // Add fetchedAt timestamp and calculate expiry
                this.deathMarkersData = deaths.map(death => ({
                    ...death,
                    fetchedAt: now,
                    expiresAt: now + fiveMinutesMs
                }));
                
                console.log(`[WebUI] Loaded ${this.deathMarkersData.length} death markers (last ${hoursAgo}h, 5min expiry)`);
                this.dirtyDynamic = true;
                this.needsRender = true;
            } else {
                console.error('[WebUI] Failed to fetch death markers:', response.statusText);
                this.deathMarkersData = [];
            }
        } catch (error) {
            console.error('[WebUI] Error fetching death markers:', error);
            this.deathMarkersData = [];
        }
    }
    
    addPersistentPatrolMarker(type, x, y, location, timestamp = null) {
        const now = timestamp || Date.now();
        const marker = {
            type: type, // 'heli', 'cargo', 'chinook'
            x: x,
            y: y,
            location: location,
            timestamp: now,
            expiresAt: now + this.PATROL_MARKER_DURATION,
            isGridPosition: x === null || y === null
        };
        
        // Remove duplicate markers (by timestamp for grid positions, by location for world coords)
        if (marker.isGridPosition) {
            this.persistentPatrolMarkers = this.persistentPatrolMarkers.filter(m => 
                !(m.type === type && m.timestamp === now)
            );
        } else {
            this.persistentPatrolMarkers = this.persistentPatrolMarkers.filter(m => 
                !(m.type === type && Math.abs(m.x - x) < 10 && Math.abs(m.y - y) < 10)
            );
        }
        
        this.persistentPatrolMarkers.push(marker);
        this.savePersistentMarkers();
        console.log(`[WebUI] Added persistent ${type} death marker at ${location} (expires in 5min)`);
        this.dirtyDynamic = true;
        this.needsRender = true;
    }
    
    cleanExpiredPatrolMarkers() {
        const now = Date.now();
        const before = this.persistentPatrolMarkers.length;
        this.persistentPatrolMarkers = this.persistentPatrolMarkers.filter(m => m.expiresAt > now);
        if (this.persistentPatrolMarkers.length !== before) {
            this.savePersistentMarkers();
            this.dirtyDynamic = true;
            this.needsRender = true;
        }
    }
    
    savePersistentMarkers() {
        if (!this.currentGuildId) return;
        try {
            localStorage.setItem(`patrol_markers_${this.currentGuildId}`, JSON.stringify(this.persistentPatrolMarkers));
        } catch (e) {
            console.error('[WebUI] Failed to save persistent markers:', e);
        }
    }
    
    loadPersistentMarkers() {
        if (!this.currentGuildId) return;
        try {
            const stored = localStorage.getItem(`patrol_markers_${this.currentGuildId}`);
            if (stored) {
                this.persistentPatrolMarkers = JSON.parse(stored);
                this.cleanExpiredPatrolMarkers();
                console.log(`[WebUI] Loaded ${this.persistentPatrolMarkers.length} persistent patrol markers`);
            }
        } catch (e) {
            console.error('[WebUI] Failed to load persistent markers:', e);
            this.persistentPatrolMarkers = [];
        }
    }

    async loadMapImage(guildId) {
        try {
            const response = await fetch(`/api/map/${guildId}`);
            if (!response.ok) throw new Error(`Failed to fetch map: ${response.statusText}`);
            const blob = await response.blob();
            const img = new Image();
            img.onload = () => {
                this.mapImage = img;
                this.minimapBaseDirty = true;
                
                // Use handleResize to properly size canvases
                this.handleResize();
                
                // Enable high quality rendering on all contexts
                [this.backgroundCtx, this.staticCtx, this.dynamicCtx].forEach(ctx => {
                    if (ctx) {
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                    }
                });
                this.drawStaticLayers();
                this.resetView();
            };
            img.src = URL.createObjectURL(blob);
        } catch (error) {
            console.error('Failed to load map:', error);
        }
    }

    updateUI() {
        if (!this.serverData) return;
        this.updateServerInfo();
        this.updateTeamList();
        this.updateEventsList();
    }

    updateServerInfo() {
        const info = this.serverData.info;
        const time = this.serverData.time;
        if (!info) {
            document.getElementById('serverInfo').innerHTML = '<p>No server data available</p>';
            return;
        }
        const timeOfDay = time ? (time.isDay ? '☀️ Day' : '🌙 Night') : 'Unknown';
        const gameTime = time ? this.formatGameTime(time.time) : 'Unknown';
        document.getElementById('serverInfo').innerHTML = `
            <p><strong>Server:</strong> ${info.name}</p>
            <p><strong>Map:</strong> ${info.map} (${info.mapSize}m)</p>
            <p><strong>Players:</strong> ${info.players}/${info.maxPlayers}</p>
            ${info.queuedPlayers > 0 ? `<p><strong>Queue:</strong> ${info.queuedPlayers}</p>` : ''}
            <p><strong>Time:</strong> ${timeOfDay} (${gameTime})</p>
            <p><strong>Wipe:</strong> ${this.formatWipeTime(info.wipeTime)}</p>`;
    }

    updateTeamList() {
        const team = this.serverData?.team;
        const teamList = document.getElementById('teamList');
        if (!team?.players?.length) {
            teamList.innerHTML = '<p class="loading">No team members</p>';
            return;
        }
        
        const followSelect = document.getElementById('followPlayer');
        if (followSelect) {
            const currentVal = followSelect.value;
            followSelect.innerHTML = '<option value="">Auto-follow</option>';
            team.players.filter(p => p.isOnline).forEach(p => {
                followSelect.add(new Option(p.name, p.steamId, false, p.steamId === currentVal));
            });
        }
        
        teamList.innerHTML = '';
        team.players.forEach(p => {
            const div = document.createElement('div');
            div.className = 'team-member';
            if (!this.playerAvatars[p.steamId]) this.loadPlayerAvatar(p.steamId);
            div.classList.toggle('offline', !p.isOnline);
            div.classList.toggle('dead', p.isOnline && !p.isAlive);
            const status = !p.isOnline ? '⚫ Offline' : !p.isAlive ? '💀 Dead' : '🟢 Online';
            const pos = p.isOnline && p.isAlive ? `(${Math.round(p.x)}, ${Math.round(p.y)})` : '';
            div.innerHTML = `<div class="team-member-name">${p.name} ${p.steamId === team.leaderSteamId ? '👑' : ''}</div>
                             <div class="team-member-status">${status} ${pos}</div>`;
            teamList.appendChild(div);
        });
    }

    updateEventsList() {
        const events = this.serverData?.events?.all || [];
        const eventsList = document.getElementById('eventsList');
        eventsList.innerHTML = events.length === 0 ? '<p class="loading">No recent events</p>' : '';
        events.slice(0, 10).forEach(event => {
            const div = document.createElement('div');
            div.className = 'event-item';
            div.textContent = event;
            eventsList.appendChild(div);
        });
    }

    startRenderLoop() {
        const render = (timestamp) => {
            const elapsed = timestamp - this.lastRenderTime;
            
            // Only render at most 60fps
            if (elapsed < 16 && !this.dirtyStatic && !this.dirtyDynamic) {
                requestAnimationFrame(render);
                return;
            }
            
            if (this.dirtyStatic) {
                this.drawStaticLayers();
                this.dirtyStatic = false;
            }
            
            if (this.needsRender || this.dirtyDynamic) {
                this.applyTransform();
                this.drawDynamicLayers();
                this.renderMinimap();
                this.needsRender = false;
                this.dirtyDynamic = false;
                this.lastRenderTime = timestamp;
            }
            
            requestAnimationFrame(render);
        };
        requestAnimationFrame(render);
    }
    
    applyTransform() {
        // Don't use CSS transforms - they pixelate everything
        // Instead we'll use canvas context transforms when drawing
        const canvases = [this.backgroundCanvas, this.staticCanvas, this.dynamicCanvas];
        canvases.forEach(c => {
            if (c) c.style.transform = 'none';
        });
        
        // Mark layers as dirty to redraw at proper scale
        this.dirtyStatic = true;
        this.dirtyDynamic = true;
        this.needsRender = true;
    }

    drawStaticLayers() {
        if (!this.mapImage) return;

        this.backgroundCtx.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
        
        // Save context state
        this.backgroundCtx.save();
        
        // Apply zoom and pan transforms
        this.backgroundCtx.translate(this.backgroundCanvas.width / 2, this.backgroundCanvas.height / 2);
        this.backgroundCtx.scale(this.scale, this.scale);
        this.backgroundCtx.translate(this.offsetX - this.mapImage.width / 2, this.offsetY - this.mapImage.height / 2);
        
        // Use high quality image rendering
        this.backgroundCtx.imageSmoothingEnabled = true;
        this.backgroundCtx.imageSmoothingQuality = 'high';
        this.backgroundCtx.drawImage(this.mapImage, 0, 0);
        
        this.backgroundCtx.restore();

        this.staticCtx.clearRect(0, 0, this.staticCanvas.width, this.staticCanvas.height);
        
        this.staticCtx.save();
        this.staticCtx.translate(this.staticCanvas.width / 2, this.staticCanvas.height / 2);
        this.staticCtx.scale(this.scale, this.scale);
        this.staticCtx.translate(this.offsetX - this.mapImage.width / 2, this.offsetY - this.mapImage.height / 2);
        
        if (this.serverData) {
            if (this.controls.showGrid) this.drawGrid(this.staticCtx);
            if (this.controls.showMonuments) this.drawMonuments(this.staticCtx);
            if (this.controls.showVendingMachines && this.serverData.mapMarkers?.vendingMachines) {
                this.drawVendingMachines(this.staticCtx);
            }
        }
        
        this.staticCtx.restore();
    }
    
    drawDynamicLayers() {
        this.dynamicCtx.clearRect(0, 0, this.dynamicCanvas.width, this.dynamicCanvas.height);
        if (!this.serverData || !this.mapImage) return;
        
        const ctx = this.dynamicCtx;
        
        // Apply zoom and pan transforms
        ctx.save();
        ctx.translate(this.dynamicCanvas.width / 2, this.dynamicCanvas.height / 2);
        ctx.scale(this.scale, this.scale);
        ctx.translate(this.offsetX - this.mapImage.width / 2, this.offsetY - this.mapImage.height / 2);
        
        // Check if replay mode should handle rendering
        if (this.mapReplay?.isReplayMode && this.serverData.map) {
            const rendered = this.mapReplay.render(ctx, this.serverData.map);
            if (rendered) {
                ctx.restore();
                return; // Replay handled all rendering
            }
        }
        
        // Normal rendering
        if (this.controls.showRadZones && this.serverData.mapMarkers?.genericRadiuses) this.drawRadZones(ctx);
        if (this.controls.showEvents) this.drawEvents(ctx);
        // Draw persistent patrol death markers (always visible)
        this.drawPersistentPatrolMarkers(ctx);
        // Draw recent team deaths (always visible for 5 minutes)
        if (!this.mapReplay?.isReplayMode) this.drawRecentTeamDeaths(ctx);
        // Draw historical death markers (only when enabled)
        if (this.controls.showDeathMarkers && !this.mapReplay?.isReplayMode) this.drawDeathMarkers(ctx);
        if (this.controls.showMarkers && this.serverData.markers) this.drawCustomMarkers(ctx);
        
        // Render live trails with colors
        if (this.controls.showTrails && !this.mapReplay?.isReplayMode) {
            this.drawPlayerTrails(ctx);
        }
        
        if (this.controls.showPlayers && this.serverData.team?.players) this.drawPlayers(ctx);
        
        ctx.restore();
    }

    drawGrid(ctx) {
        if (!this.worldRect || !this.serverData?.info?.mapSize) return;

        const worldSize = this.serverData.info.mapSize;
        const gridSize = 150;
        const numCells = Math.ceil(worldSize / gridSize);
        const cellSize = this.worldRect.width / numCells;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1 / this.scale;
        
        for (let i = 0; i <= numCells; i++) {
            const x = this.worldRect.x + i * cellSize;
            ctx.beginPath();
            ctx.moveTo(x, this.worldRect.y);
            ctx.lineTo(x, this.worldRect.y + this.worldRect.height);
            ctx.stroke();
        }
        
        for (let i = 0; i <= numCells; i++) {
            const y = this.worldRect.y + i * cellSize;
            ctx.beginPath();
            ctx.moveTo(this.worldRect.x, y);
            ctx.lineTo(this.worldRect.x + this.worldRect.width, y);
            ctx.stroke();
        }
        
        if (this.scale < 0.8) return; // Hide labels when zoomed out
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = `${14 / this.scale}px Arial`;
        ctx.textAlign = 'center';
        
        for (let i = 0; i < numCells; i++) {
            const col = this.columnLabel(i);
            for (let j = 0; j < numCells; j++) {
                const x = this.worldRect.x + i * cellSize + cellSize / 2;
                const y = this.worldRect.y + j * cellSize + cellSize / 2;
                ctx.fillText(`${col}${j}`, x, y);
            }
        }
    }

    columnLabel(index) {
        let s = '';
        do {
            s = String.fromCharCode('A'.charCodeAt(0) + (index % 26)) + s;
            index = Math.floor(index / 26) - 1;
        } while (index >= 0);
        return s;
    }
    
    worldToGrid(worldX, worldY) {
        if (!this.serverData?.info?.mapSize) return '??';
        
        const mapSize = this.serverData.info.mapSize;
        const gridSize = 150;
        const numCells = Math.ceil(mapSize / gridSize);
        
        const cellX = Math.floor(worldX / gridSize);
        const cellY = Math.floor((mapSize - worldY) / gridSize);
        
        const col = this.columnLabel(cellX);
        const row = cellY;
        
        return `${col}${row}`;
    }

    drawMonuments(ctx) {
        const monuments = this.serverData.map?.monuments;
        if (!monuments) return;
        
        monuments.forEach(m => {
            const { x, y } = this.worldToCanvas(m.x, m.y);
            const size = 10 / this.scale;
            
            // Get formatted monument info
            let token = (m.token || '').toLowerCase();
            
            // Handle prefab paths - extract the key part
            if (token.includes('/')) {
                // Extract filename from path
                const parts = token.split('/');
                const filename = parts[parts.length - 1].replace('.prefab', '');
                
                // Map common prefab patterns
                if (token.includes('underwater')) {
                    token = 'underwater_lab';
                } else if (token.includes('moonpool')) {
                    token = 'underwater_lab';
                } else {
                    token = filename.replace(/[-_]/g, '_');
                }
            }
            
            token = token.replace(/\s+/g, '_');
            
            const monumentInfo = this.monumentNames[token] || { 
                name: m.token || 'Monument', 
                emoji: '📍' 
            };
            
            ctx.fillStyle = 'rgba(206, 65, 43, 0.3)';
            ctx.strokeStyle = 'rgba(206, 65, 43, 0.8)';
            ctx.lineWidth = 2 / this.scale;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            if (this.scale > 0.5) {
                // Draw emoji
                ctx.font = `${16 / this.scale}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(monumentInfo.emoji, x, y);
                
                // Draw name with outline for better readability
                if (this.scale > 0.8) {
                    ctx.font = `bold ${11 / this.scale}px Arial`;
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                    ctx.lineWidth = 3 / this.scale;
                    ctx.lineJoin = 'round';
                    ctx.strokeText(monumentInfo.name, x, y - size - 8 / this.scale);
                    
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                    ctx.fillText(monumentInfo.name, x, y - size - 8 / this.scale);
                }
            }
        });
        
        // Draw death markers if in replay mode
        if (this.mapReplay?.isReplayMode) {
            const deathMarkers = this.mapReplay.getMinimapDeathMarkers();
            deathMarkers.forEach(death => {
                if (death.x && death.y) {
                    const normalizedX = death.x / mapData.width;
                    const normalizedY = 1 - (death.y / mapData.height);
                    const minimapX = centerX + (normalizedX - 0.5) * (mapData.width * this.minimapZoom) + panOffsetX;
                    const minimapY = centerY + (normalizedY - 0.5) * (mapData.height * this.minimapZoom) + panOffsetY;
                    
                    // Draw death skull
                    this.minimapCtx.fillStyle = '#ff0000';
                    this.minimapCtx.strokeStyle = '#fff';
                    this.minimapCtx.lineWidth = 1;
                    this.minimapCtx.font = 'bold 12px Arial';
                    this.minimapCtx.textAlign = 'center';
                    this.minimapCtx.textBaseline = 'middle';
                    this.minimapCtx.strokeText('💀', minimapX, minimapY);
                    this.minimapCtx.fillText('💀', minimapX, minimapY);
                    
                    // Draw player name
                    this.minimapCtx.font = 'bold 8px Arial';
                    this.minimapCtx.fillStyle = '#fff';
                    this.minimapCtx.strokeStyle = '#000';
                    this.minimapCtx.lineWidth = 2;
                    this.minimapCtx.strokeText(death.player_name, minimapX, minimapY + 10);
                    this.minimapCtx.fillText(death.player_name, minimapX, minimapY + 10);
                }
            });
        }
    }

    drawRadZones(ctx) {
        const radZones = this.serverData.mapMarkers.genericRadiuses;
        if (!radZones?.length) return;
        
        const scale = this.worldRect.width / this.serverData.info.mapSize;
        
        ctx.fillStyle = 'rgba(46, 204, 113, 0.2)';
        ctx.strokeStyle = 'rgba(46, 204, 113, 0.6)';
        ctx.lineWidth = 2 / this.scale;
        
        radZones.forEach(zone => {
            const { x, y } = this.worldToCanvas(zone.x, zone.y);
            const radius = zone.radius * scale;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
    }

    drawEvents(ctx) {
        const markers = this.serverData.mapMarkers;
        if (!markers) return;
        
        const drawMarker = (items, color, emoji) => {
            if (!items) return;
            items.forEach(item => {
                const { x, y } = this.worldToCanvas(item.x, item.y);
                const size = 15 / this.scale;
                ctx.fillStyle = `rgba(${color}, 0.8)`;
                ctx.strokeStyle = `rgba(${color}, 1)`;
                ctx.lineWidth = 2 / this.scale;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = 'white';
                ctx.font = `bold ${12 / this.scale}px Arial`;
                ctx.textAlign = 'center';
                ctx.fillText(emoji, x, y + size / 2.5);
            });
        };
        
        drawMarker(markers.cargoShips, '255, 215, 0', '🚢');
        drawMarker(markers.patrolHelicopters, '255, 0, 0', '🚁');
        drawMarker(markers.ch47s, '128, 0, 128', 'CH47');
    }
    
    drawDeathMarkers(ctx) {
        if (!this.deathMarkersData?.length) return;
        
        const now = Date.now();
        
        this.deathMarkersData.forEach(death => {
            if (!death.x || !death.y) return;
            if (death.expiresAt && death.expiresAt <= now) return; // Skip expired
            
            const { x, y } = this.worldToCanvas(death.x, death.y);
            const size = 12 / this.scale;
            
            // Draw red circle background
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.lineWidth = 2 / this.scale;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Draw skull emoji
            ctx.font = `bold ${16 / this.scale}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2 / this.scale;
            ctx.strokeText('💀', x, y);
            ctx.fillText('💀', x, y);
            
            // Draw player name if zoomed in enough
            if (this.scale > 0.5 && death.player_name) {
                ctx.font = `bold ${10 / this.scale}px Arial`;
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
                ctx.lineWidth = 3 / this.scale;
                ctx.strokeText(death.player_name, x, y + size + 10 / this.scale);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(death.player_name, x, y + size + 10 / this.scale);
                
                // Draw time since death
                const deathTime = death.death_time || death.timestamp || 0;
                const timeSince = Math.floor((Date.now() / 1000 - deathTime) / 60);
                const timeText = timeSince < 60 ? `${timeSince}m ago` : `${Math.floor(timeSince / 60)}h ago`;
                ctx.font = `${9 / this.scale}px Arial`;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.fillText(timeText, x, y + size + 22 / this.scale);
            }
        });
    }
    
    drawRecentTeamDeaths(ctx) {
        if (!this.recentTeamDeaths?.length) return;
        
        const now = Date.now();
        
        this.recentTeamDeaths.forEach(death => {
            if (!death.x || !death.y) return;
            if (death.expiresAt <= now) return; // Skip expired
            
            const { x, y } = this.worldToCanvas(death.x, death.y);
            const size = 12 / this.scale;
            
            // Draw red circle background with pulsing effect
            const pulsePhase = (now % 1500) / 1500;
            const pulseOpacity = 0.4 + 0.2 * Math.sin(pulsePhase * Math.PI * 2);
            
            ctx.fillStyle = `rgba(255, 0, 0, ${pulseOpacity})`;
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.95)';
            ctx.lineWidth = 2 / this.scale;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Draw skull emoji
            ctx.font = `bold ${16 / this.scale}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ff0000';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2 / this.scale;
            ctx.strokeText('💀', x, y);
            ctx.fillText('💀', x, y);
            
            // Draw player name
            if (this.scale > 0.5) {
                ctx.font = `bold ${10 / this.scale}px Arial`;
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
                ctx.lineWidth = 3 / this.scale;
                ctx.strokeText(death.player_name, x, y + size + 10 / this.scale);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(death.player_name, x, y + size + 10 / this.scale);
                
                // Draw time remaining
                const timeRemaining = Math.ceil((death.expiresAt - now) / 1000 / 60);
                const timeText = `${timeRemaining}m`;
                ctx.font = `${9 / this.scale}px Arial`;
                ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
                ctx.fillText(timeText, x, y + size + 22 / this.scale);
            }
        });
    }
    
    drawPersistentPatrolMarkers(ctx) {
        if (!this.persistentPatrolMarkers?.length) return;
        
        const now = Date.now();
        this.persistentPatrolMarkers.forEach(marker => {
            if (marker.expiresAt <= now) return;
            
            // Skip grid-only positions as they're shown in minimap info bar
            if (marker.isGridPosition) return;
            
            // For world coordinates (if available)
            if (!marker.x || !marker.y) return;
            
            const { x, y } = this.worldToCanvas(marker.x, marker.y);
            const size = 25 / this.scale;
            
            // Pulsing circle
            const pulsePhase = (now % 2000) / 2000;
            const pulseSize = size * (1 + 0.4 * Math.sin(pulsePhase * Math.PI * 2));
            const opacity = 0.5 + 0.3 * Math.sin(pulsePhase * Math.PI * 2);
            
            ctx.fillStyle = `rgba(255, 69, 0, ${opacity})`;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 3 / this.scale;
            ctx.beginPath();
            ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Draw explosion emoji
            ctx.font = `bold ${32 / this.scale}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2 / this.scale;
            ctx.strokeText('💥', x, y);
            ctx.fillText('💥', x, y);
            
            // Draw label
            if (this.scale > 0.5) {
                const timeLeft = Math.ceil((marker.expiresAt - now) / 60000);
                const timeText = timeLeft > 1 ? `${timeLeft}m` : '<1m';
                
                ctx.font = `bold ${14 / this.scale}px Arial`;
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
                ctx.lineWidth = 3 / this.scale;
                ctx.strokeText(`Patrol Down - ${marker.location}`, x, y + size + 12 / this.scale);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(`Patrol Down - ${marker.location}`, x, y + size + 12 / this.scale);
                
                ctx.font = `bold ${12 / this.scale}px Arial`;
                ctx.fillStyle = '#ff4500';
                ctx.strokeText(`⏱️ ${timeText}`, x, y + size + 26 / this.scale);
                ctx.fillText(`⏱️ ${timeText}`, x, y + size + 26 / this.scale);
            }
        });
    }

    drawVendingMachines(ctx) {
        const machines = this.serverData.mapMarkers.vendingMachines;
        if (!machines?.length || this.scale < 1.2) return;
        
        ctx.fillStyle = 'rgba(52, 152, 219, 0.8)';
        ctx.strokeStyle = 'rgba(52, 152, 219, 1)';
        ctx.lineWidth = 2 / this.scale;
        machines.forEach(vm => {
            const { x, y } = this.worldToCanvas(vm.x, vm.y);
            ctx.beginPath();
            ctx.arc(x, y, 8 / this.scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
    }

    drawCustomMarkers(ctx) {
        // Implementation for custom markers can be added here
    }

    drawPlayerTrails(ctx) {
        const players = this.serverData.team?.players || [];
        if (!players.length) return;
        
        players.forEach(p => {
            if (!p.isOnline || !p.isAlive) return;
            
            const trails = this.playerTrails[p.steamId] || [];
            
            // Clean old trails using configurable duration
            this.playerTrails[p.steamId] = trails.filter(t => t.time > Date.now() - this.trailDuration);
            
            if (trails.length > 1) {
                // Use player-specific color
                const color = this.getPlayerColor(p.steamId);
                ctx.strokeStyle = color;
                ctx.lineWidth = 3 / this.scale;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalAlpha = 0.6;
                
                ctx.beginPath();
                ctx.moveTo(trails[0].x, trails[0].y);
                for (let i = 1; i < trails.length; i++) {
                    ctx.lineTo(trails[i].x, trails[i].y);
                }
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }
        });
    }

    drawPlayers(ctx) {
        const players = this.serverData.team?.players;
        if (!players) return;
        
        players.forEach(p => {
            if (!p.isOnline) return;
            
            const { x, y } = this.worldToCanvas(p.x, p.y);
            const size = 10 / this.scale;
            const avatar = this.playerAvatars[p.steamId];
            const playerColor = this.getPlayerColor(p.steamId);
            
            // Draw avatar if loaded, otherwise draw colored circle
            if (avatar) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(avatar, x - size, y - size, size * 2, size * 2);
                ctx.restore();
                
                // Draw colored border with player's unique color (dimmed if dead)
                ctx.strokeStyle = p.isAlive ? playerColor : `${playerColor}80`;
                ctx.lineWidth = 2 / this.scale;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                // Fallback to colored circle using player's unique color
                ctx.fillStyle = p.isAlive ? playerColor : `${playerColor}80`;
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2 / this.scale;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            
            if (this.controls.showPlayerNames && this.scale > 0.7) {
                ctx.fillStyle = 'white';
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 3 / this.scale;
                ctx.font = `bold ${12 / this.scale}px Arial`;
                ctx.textAlign = 'center';
                ctx.strokeText(p.name, x, y - size - (5 / this.scale));
                ctx.fillText(p.name, x, y - size - (5 / this.scale));
            }
        });
    }

    renderMinimap() {
        if (!this.minimapCtx || !this.serverData) return;
        
        const ctx = this.minimapCtx;
        const size = this.minimapSize;
        ctx.clearRect(0, 0, size, size);
        
        const centerPlayer = this.serverData.team?.players.find(p => p.steamId === this.followedPlayerId && p.isOnline) || this.serverData.team?.players.find(p => p.isOnline);
        
        if (!centerPlayer || !this.worldRect || !this.mapImage || !this.minimapBaseCanvas) {
            // Fallback if no player or map
            if (this.mapImage) ctx.drawImage(this.mapImage, 0, 0, size, size);
            return;
        }

        if (this.minimapBaseDirty) {
            this.minimapBaseCanvas.width = this.mapImage.width;
            this.minimapBaseCanvas.height = this.mapImage.height;
            this.minimapBaseCtx.clearRect(0, 0, this.mapImage.width, this.mapImage.height);
            this.minimapBaseCtx.drawImage(this.mapImage, 0, 0);

            const prevScale = this.scale;
            this.scale = 1;
            this.minimapBaseCtx.save();
            this.drawGrid(this.minimapBaseCtx);
            this.drawMonuments(this.minimapBaseCtx);
            this.minimapBaseCtx.restore();
            this.scale = prevScale;

            this.minimapBaseDirty = false;
        }
        
        // Get player position in world coordinates and convert to canvas coordinates
        // accounting for the canvas transforms (scale and offset)
        const { x: playerX, y: playerY } = this.worldToCanvas(centerPlayer.x, centerPlayer.y);
        
        // Now apply the canvas transform to get the actual pixel position on the transformed canvas
        const viewSize = (this.minimapBaseCanvas.width / this.minimapZoom);
        const centerX = playerX - this.minimapPanX;
        const centerY = playerY - this.minimapPanY;

        const desiredSx = centerX - viewSize / 2;
        const desiredSy = centerY - viewSize / 2;
        const maxSx = Math.max(0, this.minimapBaseCanvas.width - viewSize);
        const maxSy = Math.max(0, this.minimapBaseCanvas.height - viewSize);
        const sx = Math.max(0, Math.min(maxSx, desiredSx));
        const sy = Math.max(0, Math.min(maxSy, desiredSy));

        const miniScale = size / viewSize;
        const dx = (sx - desiredSx) * miniScale;
        const dy = (sy - desiredSy) * miniScale;

        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(this.minimapBaseCanvas, sx, sy, viewSize, viewSize, dx, dy, size, size);

        if (dx > 0) {
            ctx.drawImage(this.minimapBaseCanvas, sx, sy, 1, viewSize, 0, dy, dx, size);
        } else if (dx < 0) {
            ctx.drawImage(this.minimapBaseCanvas, sx + viewSize - 1, sy, 1, viewSize, size + dx, dy, -dx, size);
        }

        if (dy > 0) {
            ctx.drawImage(this.minimapBaseCanvas, sx, sy, viewSize, 1, dx, 0, size, dy);
        } else if (dy < 0) {
            ctx.drawImage(this.minimapBaseCanvas, sx, sy + viewSize - 1, viewSize, 1, dx, size + dy, size, -dy);
        }
        
        this.serverData.team?.players.forEach(p => {
            if (!p.isOnline) return;
            const { x: px, y: py } = this.worldToCanvas(p.x, p.y);
            
            // Apply the same transform as for center player
            const mx = (px - desiredSx) * miniScale;
            const my = (py - desiredSy) * miniScale;
            
            if (mx >= 0 && mx <= size && my >= 0 && my <= size) {
                const isCenter = p.steamId === centerPlayer.steamId;
                const markerSize = 10;
                const avatar = this.playerAvatars[p.steamId];
                const playerColor = this.getPlayerColor(p.steamId);
                
                // Draw avatar if loaded
                if (avatar) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(mx, my, markerSize, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(avatar, mx - markerSize, my - markerSize, markerSize * 2, markerSize * 2);
                    ctx.restore();
                    
                    // Draw colored border with player's unique color (dimmed if dead)
                    ctx.strokeStyle = p.isAlive ? playerColor : `${playerColor}80`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(mx, my, markerSize, 0, Math.PI * 2);
                    ctx.stroke();
                } else {
                    // Fallback to colored circles using player's unique color
                    ctx.fillStyle = p.isAlive ? playerColor : `${playerColor}80`;
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(mx, my, markerSize, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
                
                if (this.showMinimapPlayerNames && this.minimapZoom > 0.8) {
                    ctx.fillStyle = 'white';
                    ctx.font = `bold ${isCenter ? 12 : 10}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 2;
                    ctx.strokeText(p.name, mx, my - markerSize - 3);
                    ctx.fillText(p.name, mx, my - markerSize - 3);
                }
            }
        });
        
        // Draw recent team deaths on minimap (always shown for 5 minutes)
        if (this.recentTeamDeaths?.length > 0 && !this.mapReplay?.isReplayMode) {
            const now = Date.now();
            
            this.recentTeamDeaths.forEach(death => {
                if (!death.x || !death.y) return;
                if (death.expiresAt <= now) return; // Skip expired
                
                const { x: dx, y: dy } = this.worldToCanvas(death.x, death.y);
                
                // Apply the same transform
                const dmx = (dx - desiredSx) * miniScale;
                const dmy = (dy - desiredSy) * miniScale;
                
                // Only draw if in view
                if (dmx >= 0 && dmx <= size && dmy >= 0 && dmy <= size) {
                    // Draw circle background
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    ctx.strokeStyle = '#ff0000';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(dmx, dmy, 10, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    
                    // Draw death skull (brighter red for recent deaths)
                    ctx.fillStyle = '#ff0000';
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.font = 'bold 14px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.strokeText('💀', dmx, dmy);
                    ctx.fillText('💀', dmx, dmy);
                }
            });
        }
        
        // Draw historical death markers on minimap if enabled
        if (this.controls.showDeathMarkers && this.deathMarkersData?.length > 0 && !this.mapReplay?.isReplayMode) {
            const now = Date.now();
            
            this.deathMarkersData.forEach(death => {
                if (!death.x || !death.y) return;
                if (death.expiresAt && death.expiresAt <= now) return; // Skip expired
                
                const { x: dx, y: dy } = this.worldToCanvas(death.x, death.y);
                
                // Apply the same transform
                const dmx = (dx - desiredSx) * miniScale;
                const dmy = (dy - desiredSy) * miniScale;
                
                // Only draw if in view
                if (dmx >= 0 && dmx <= size && dmy >= 0 && dmy <= size) {
                    // Draw circle background
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
                    ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(dmx, dmy, 9, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    
                    // Draw death skull (slightly transparent for historical deaths)
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1.5;
                    ctx.font = 'bold 12px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.strokeText('💀', dmx, dmy);
                    ctx.fillText('💀', dmx, dmy);
                }
            });
        }
        
        this.drawMinimapCrosshair(ctx, size);
        this.drawMinimapStatusBar(ctx, size);
    }
    
    drawMinimapCrosshair(ctx, size) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(size / 2 - 10, size / 2);
        ctx.lineTo(size / 2 + 10, size / 2);
        ctx.moveTo(size / 2, size / 2 - 10);
        ctx.lineTo(size / 2, size / 2 + 10);
        ctx.stroke();
    }

    drawMinimapStatusBar(ctx, size) {
        const info = this.serverData.info;
        const time = this.serverData.time;
        const markers = this.serverData.mapMarkers;
        if (!info || !time) return;
        
        // Single line status bar
        const barHeight = 18;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, size - barHeight, size, barHeight);
        
        ctx.font = '9px Arial';
        ctx.textAlign = 'left';
        
        let x = 5;
        const y = size - 6;
        
        // Player count
        ctx.fillStyle = '#ffffff';
        let text = `👥 ${info.players}/${info.maxPlayers}`;
        if (info.queuedPlayers > 0) text += ` (${info.queuedPlayers})`;
        ctx.fillText(text, x, y);
        x += ctx.measureText(text).width;
        
        // Time
        const gameTime = this.formatGameTime(time.time);
        const timeIcon = time.isDay ? '☀️' : '🌙';
        ctx.fillStyle = '#888';
        ctx.fillText(' | ', x, y);
        x += ctx.measureText(' | ').width;
        ctx.fillStyle = '#ffffff';
        text = `${timeIcon} ${gameTime}`;
        ctx.fillText(text, x, y);
        x += ctx.measureText(text).width;
        
        // Events
        if (markers?.patrolHelicopters?.length > 0) {
            markers.patrolHelicopters.forEach(heli => {
                const grid = this.worldToGrid(heli.x, heli.y);
                ctx.fillStyle = '#888';
                ctx.fillText(' | ', x, y);
                x += ctx.measureText(' | ').width;
                ctx.fillStyle = '#ff4444';
                text = `🚁 ${grid}`;
                ctx.fillText(text, x, y);
                x += ctx.measureText(text).width;
            });
        }
        
        if (markers?.cargoShips?.length > 0) {
            markers.cargoShips.forEach(cargo => {
                const grid = this.worldToGrid(cargo.x, cargo.y);
                ctx.fillStyle = '#888';
                ctx.fillText(' | ', x, y);
                x += ctx.measureText(' | ').width;
                ctx.fillStyle = '#ffd700';
                text = `🚢 ${grid}`;
                ctx.fillText(text, x, y);
                x += ctx.measureText(text).width;
            });
        }
        
        if (markers?.ch47s?.length > 0) {
            markers.ch47s.forEach(ch47 => {
                const grid = this.worldToGrid(ch47.x, ch47.y);
                ctx.fillStyle = '#888';
                ctx.fillText(' | ', x, y);
                x += ctx.measureText(' | ').width;
                ctx.fillStyle = '#9c27b0';
                text = `🚁CH47 ${grid}`;
                ctx.fillText(text, x, y);
                x += ctx.measureText(text).width;
            });
        }
        
        const patrolDeath = this.persistentPatrolMarkers?.find(m => m.type === 'heli' && m.expiresAt > Date.now());
        if (patrolDeath) {
            const timeLeft = Math.ceil((patrolDeath.expiresAt - Date.now()) / 60000);
            ctx.fillStyle = '#888';
            ctx.fillText(' | ', x, y);
            x += ctx.measureText(' | ').width;
            ctx.fillStyle = '#ff6644';
            text = `💥 ${patrolDeath.location} ${timeLeft}m`;
            ctx.fillText(text, x, y);
            x += ctx.measureText(text).width;
        }
    }

    async enterPictureInPicture() {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                const video = document.createElement('video');
                video.muted = true;
                video.srcObject = this.minimapCanvas.captureStream();
                video.style.width = '100%';
                video.style.height = '100%';
                await video.play();
                
                // Request PiP with smaller minimum size
                const pipWindow = await video.requestPictureInPicture();
                
                // Try to resize to a smaller size if supported
                if (pipWindow.width && pipWindow.height) {
                    try {
                        // Some browsers support resizing PiP window
                        pipWindow.resize(200, 200);
                    } catch (e) {
                        // Resize not supported in this browser
                    }
                }
            }
        } catch (error) {
            console.error('PiP failed:', error);
            alert('Picture-in-Picture not supported or failed.');
        }
    }

    zoom(factor) {
        this.scale *= factor;
        const minScale = this.baseScale * 0.1;
        const maxScale = this.baseScale * 20;
        this.scale = Math.max(minScale, Math.min(maxScale, this.scale));
        this.dirtyStatic = true;
        this.dirtyDynamic = true;
        this.needsRender = true;
    }

    zoomAt(clientX, clientY, factor) {
        if (!this.mapImage) return;

        const rect = this.dynamicCanvas.getBoundingClientRect();
        const scaleX = this.dynamicCanvas.width / rect.width;
        const scaleY = this.dynamicCanvas.height / rect.height;
        const canvasX = (clientX - rect.left) * scaleX;
        const canvasY = (clientY - rect.top) * scaleY;

        const centerX = this.dynamicCanvas.width / 2;
        const centerY = this.dynamicCanvas.height / 2;

        const imageX = (canvasX - centerX) / this.scale - this.offsetX + this.mapImage.width / 2;
        const imageY = (canvasY - centerY) / this.scale - this.offsetY + this.mapImage.height / 2;

        const prevScale = this.scale;
        this.scale *= factor;
        const minScale = this.baseScale * 0.1;
        const maxScale = this.baseScale * 20;
        this.scale = Math.max(minScale, Math.min(maxScale, this.scale));

        if (this.scale === prevScale) return;

        this.offsetX = (canvasX - centerX) / this.scale - imageX + this.mapImage.width / 2;
        this.offsetY = (canvasY - centerY) / this.scale - imageY + this.mapImage.height / 2;

        this.dirtyStatic = true;
        this.dirtyDynamic = true;
        this.needsRender = true;
    }

    resetView() {
        this.scale = this.baseScale || 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.dirtyStatic = true;
        this.dirtyDynamic = true;
        this.needsRender = true;
    }
    
    toggleFullscreen() {
        const content = document.querySelector('.content');
        content.classList.toggle('fullscreen-map');
        
        // Trigger resize to adjust canvas to new container size
        setTimeout(() => {
            this.handleResize();
        }, 100);
    }

    loadPlayerAvatar(steamId) {
        if (this.playerAvatars[steamId]) return;
        
        const img = new Image();
        
        // Use placeholder initially
        this.playerAvatars[steamId] = null;
        
        img.onload = () => {
            this.playerAvatars[steamId] = img;
            this.dirtyDynamic = true;
            this.needsRender = true;
        };
        
        img.onerror = () => {
            // If proxy fails, just use default circle (no fallback to prevent 404s)
            this.playerAvatars[steamId] = null;
        };
        
        // Use our server proxy - it handles the Steam CDN redirect properly
        img.src = `/api/avatar/${steamId}`;
    }

    updateConnectionStatus(connected) {
        const status = document.getElementById('connectionStatus');
        status.textContent = connected ? '● Connected' : '● Disconnected';
        status.className = connected ? 'status-connected' : 'status-disconnected';
    }

    updateLastUpdateTime() {
        document.getElementById('lastUpdate').textContent = `Last update: ${new Date().toLocaleTimeString()}`;
    }

    formatGameTime(time) {
        const h = Math.floor(time);
        const m = Math.floor((time - h) * 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    formatWipeTime(timestamp) {
        const diff = (Date.now() / 1000 - timestamp) / 3600;
        if (diff < 24) return `${Math.floor(diff)}h ago`;
        return `${Math.floor(diff / 24)}d ago`;
    }

    // ==================== PLAYER COLORS ====================
    
    async loadPlayerColors() {
        if (!this.serverData?.team?.players) return;
        
        const steamIds = this.serverData.team.players.map(p => p.steamId).join(',');
        try {
            const colors = await this.apiClient.get(`/api/statistics/colors?steamIds=${steamIds}`);
            this.playerColors = colors;
            this.dirtyDynamic = true;
            this.needsRender = true;
        } catch (error) {
            console.error('Failed to load player colors:', error);
        }
    }

    getPlayerColor(steamId) {
        return this.playerColors[steamId] || '#00ff88';
    }

    // ==================== MAP REPLAY ====================
    
    setReplayMode(enabled, replayData = null) {
        if (enabled && replayData) {
            this.mapReplay.setReplayData(replayData);
        }
        this.mapReplay.enableReplayMode(enabled);
        this.dirtyDynamic = true;
        this.needsRender = true;
    }

    startReplay() {
        this.mapReplay.start();
    }

    pauseReplay() {
        this.mapReplay.pause();
    }

    stopReplay() {
        this.mapReplay.stop();
    }

    // ==================== HELPER METHODS ====================
    
    gameToCanvasX(x, worldWidth, oceanMargin) {
        if (!this.mapImage) return 0;
        // Convert game coordinates (0 to worldWidth) to normalized map coordinates (0 to 1)
        const normalized = x / worldWidth;
        // Convert to canvas coordinates using map image dimensions and current transform
        return normalized * this.mapImage.width * this.baseScale * this.scale;
    }

    gameToCanvasY(y, worldHeight, oceanMargin) {
        if (!this.mapImage) return 0;
        // Convert game coordinates (0 to worldHeight) to normalized map coordinates (0 to 1)
        // Note: Rust coordinates are inverted (0 at bottom), so we flip them
        const normalized = (worldHeight - y) / worldHeight;
        // Convert to canvas coordinates using map image dimensions and current transform
        return normalized * this.mapImage.height * this.baseScale * this.scale;
    }

    setupStatisticsButton() {
        // Create statistics button in header
        const statsButton = document.createElement('button');
        statsButton.id = 'statsButton';
        statsButton.className = 'stats-button';
        statsButton.innerHTML = '📊 Statistics';
        statsButton.disabled = true; // Disabled until server is selected
        statsButton.onclick = async () => {
            if (this.statisticsManager) {
                // Check authentication BEFORE opening panel
                await this.statisticsManager.checkAuthenticationBeforeOpen();
            }
        };
        
        document.querySelector('header').appendChild(statsButton);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RustPlusWebUI();
});
