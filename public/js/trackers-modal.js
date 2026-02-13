class TrackersModalManager {
    constructor(app) {
        this.app = app;
        this.modal = document.getElementById('trackersModal');
        this.list = document.getElementById('trackers-list');
        this.headerBtn = document.getElementById('trackersNavBtn');
        this.closeBtn = this.modal ? this.modal.querySelector('.close-modal') : null;

        // Edit Modal Elements
        this.editModal = document.getElementById('editTrackerModal');
        this.editNameInput = document.getElementById('editTrackerName');
        this.editBMIdInput = document.getElementById('editTrackerBMId');
        this.editClanTagInput = document.getElementById('editTrackerClanTag');
        this.editChannelNameInput = document.getElementById('editTrackerChannelName');
        this.editEveryoneToggle = document.getElementById('editTrackerEveryone');
        this.editInGameToggle = document.getElementById('editTrackerInGame');

        this.saveEditBtn = document.getElementById('saveTrackerEditBtn');
        this.cancelEditBtn = document.getElementById('cancelTrackerEditBtn');
        this.closeEditModalBtn = this.editModal ? this.editModal.querySelector('.close-edit-modal') : null;

        this.currentEditId = null;
        this.currentAddPlayerTrackerId = null;
        this.trackers = {};

        // New Add Player Modal
        this.addPlayerModal = document.getElementById('addTrackerPlayerModal');
        this.addPlayerInputNew = document.getElementById('addTrackerPlayerId_new');
        this.confirmAddPlayerBtn = document.getElementById('confirmAddPlayerBtn');
        this.cancelAddPlayerBtn = document.getElementById('cancelAddPlayerBtn');

        // New Remove Player Modal
        this.removePlayerModal = document.getElementById('removeTrackerPlayerModal');
        this.removePlayerList = document.getElementById('removePlayerList');
        this.closeRemovePlayerBtn = document.getElementById('closeRemovePlayerBtn');
        this.currentRemoveTrackerId = null;

        this.init();
    }

    formatTimeAgo(timestamp) {
        if (!timestamp) return '';
        const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);

        if (seconds < 60) return this.app.languageManager.get('time.justNow');
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return this.app.languageManager.get('time.m').replace('{n}', minutes);
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return this.app.languageManager.get('time.h').replace('{n}', hours);
        const days = Math.floor(hours / 24);
        return this.app.languageManager.get('time.d').replace('{n}', days);
    }

    init() {
        if (this.headerBtn) {
            this.headerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.open();
            });
        }

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }

        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.close();
            });
        }

        if (this.saveEditBtn) {
            this.saveEditBtn.addEventListener('click', () => this.saveEdit());
        }

        if (this.cancelEditBtn) {
            this.cancelEditBtn.addEventListener('click', () => this.closeEditModal());
        }

        if (this.closeEditModalBtn) {
            this.closeEditModalBtn.addEventListener('click', () => this.closeEditModal());
        }

        if (this.addPlayerBtn) {
            this.addPlayerBtn.addEventListener('click', () => this.handleAddPlayer());
        }

        // Create Button
        const createBtn = document.getElementById('createTrackerBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.handleCreate());
        }

        // New Add Player Modal listeners
        if (this.confirmAddPlayerBtn) {
            this.confirmAddPlayerBtn.addEventListener('click', () => this.executeAddPlayer());
        }
        if (this.cancelAddPlayerBtn) {
            this.cancelAddPlayerBtn.addEventListener('click', () => this.closeAddPlayerModal());
        }
        if (this.addPlayerModal) {
            this.addPlayerModal.querySelector('.close-edit-modal').addEventListener('click', () => this.closeAddPlayerModal());
        }

        // Remove Player Modal listeners
        if (this.closeRemovePlayerBtn) {
            this.closeRemovePlayerBtn.addEventListener('click', () => this.closeRemovePlayerModal());
        }
        if (this.removePlayerModal) {
            this.removePlayerModal.querySelector('.close-edit-modal').addEventListener('click', () => this.closeRemovePlayerModal());
        }
    }

    open() {
        if (this.modal) {
            this.modal.classList.add('open');
            this.fetchAndRender();
        }
    }

    close() {
        if (this.modal) {
            this.modal.classList.remove('open');
        }
    }

    fetchAndRender() {
        if (this.app?.serverData?.trackers) {
            this.trackers = this.app.serverData.trackers;
            this.render();
        } else {
            this.list.innerHTML = `<div class="loading-switches">${this.app.languageManager.get('trackers.loading')}</div>`;
        }
    }

    render() {
        this.list.innerHTML = '';

        const allTrackers = Object.entries(this.trackers).map(([id, data]) => ({ ...data, trackerId: id }));

        if (allTrackers.length === 0) {
            this.list.innerHTML = `
                <div class="no-switches">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📡</div>
                    <div>${this.app.languageManager.get('trackers.notFound')}</div>
                </div>`;
            return;
        }

        allTrackers.sort((a, b) => parseInt(a.trackerId) - parseInt(b.trackerId)).forEach(tracker => {
            this.createCard(tracker);
        });
    }

    createCard(tracker) {
        const card = document.createElement('div');
        card.className = 'switch-card';

        const playerNames = tracker.players.map(p => p.name).join(', ') || this.app.languageManager.get('trackers.noPlayers');

        card.innerHTML = `
            <div class="switch-main-row">
                <div class="switch-info-col">
                    <div class="switch-header-info">
                        <span class="switch-status-badge status-on">
                             TRACKER #${tracker.trackerId}
                        </span>
                        <div class="switch-name">${tracker.name}</div>
                    </div>
                    <div class="switch-id">
                        <span class="id-label">${this.app.languageManager.get('trackers.server')}</span> <span class="id-value">${tracker.title}</span>
                    </div>
                    <div class="switch-command">
                         <span class="command-label">${this.app.languageManager.get('trackers.players')}</span><br>
                         <span class="command-value" style="font-size: 0.85rem; color: #ccc;">${playerNames}</span>
                    </div>
                    <div class="switch-location">
                        BM ID: ${tracker.battlemetricsId} • Clan Tag: ${tracker.clanTag || 'None'}
                    </div>
                </div>
                <div class="switch-img-col">
                     <img src="${tracker.img || '/images/rust-logo.png'}" alt="${tracker.name}" onerror="this.src='/images/rust-logo.png'">
                </div>
            </div>

            <div class="tracker-detailed-players">
                ${tracker.players.map(p => {
            const statusText = p.isOnline ? 'Active' : 'Offline';
            const timestamp = p.isOnline ? p.updatedAt : p.logoutDate;
            const timeAgo = timestamp ? this.formatTimeAgo(timestamp) : (p.isOnline ? 'recently' : 'unknown');

            const avatarUrl = p.steamId ? `/api/avatar/${p.steamId}` : '/images/rust-logo.png';

            return `
                    <div class="detailed-player-item ${p.isOnline ? 'online' : 'offline'}">
                        <div class="player-avatar-container">
                            <img src="${avatarUrl}" class="player-avatar-img" onerror="this.src='/images/rust-logo.png'">
                            <div class="player-status-dot-mini"></div>
                        </div>
                        <div class="player-info-main">
                            <span class="player-name-text">${p.name}</span>
                            <div class="player-activity-meta">
                                <span class="player-timer">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                    ${p.isOnline ? this.app.languageManager.get('trackers.status.active') : this.app.languageManager.get('trackers.status.offline')} ${timeAgo}
                                </span>
                            </div>
                        </div>
                        <div class="player-profile-links">
                            ${p.steamId ? `<a href="https://steamcommunity.com/profiles/${p.steamId}" target="_blank" class="mini-profile-link steam" title="${this.app.languageManager.get('trackers.action.steamProfile') || 'Steam Profile'}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                            </a>` : ''}
                        </div>
                    </div>`;
        }).join('')}
            </div>

            <div class="switch-actions-row">
                <button class="action-btn add-fast-btn" type="button" style="flex: 1.2;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <line x1="19" y1="8" x2="19" y2="14"></line>
                        <line x1="16" y1="11" x2="22" y2="11"></line>
                    </svg>
                    ${this.app.languageManager.get('trackers.action.addPlayer')}
                </button>
                <button class="action-btn remove-fast-btn" type="button" style="flex: 1.2;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <line x1="23" y1="11" x2="17" y2="11"></line>
                    </svg>
                    ${this.app.languageManager.get('trackers.action.removePlayer')}
                </button>
                <button class="action-btn edit-btn" type="button" style="flex: 1;">${this.app.languageManager.get('trackers.action.edit')}</button>
                <button class="action-btn delete-btn" type="button" title="${this.app.languageManager.get('trackers.action.delete')}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v0"></path>
                    </svg>
                </button>
            </div>
        `;

        const editBtn = card.querySelector('.edit-btn');
        const deleteBtn = card.querySelector('.delete-btn');
        const addFastBtn = card.querySelector('.add-fast-btn');
        const removeFastBtn = card.querySelector('.remove-fast-btn');

        if (editBtn) editBtn.onclick = (e) => { e.stopPropagation(); this.openEditModal(tracker.trackerId); };
        if (deleteBtn) deleteBtn.onclick = (e) => { e.stopPropagation(); this.handleDelete(tracker.trackerId); };
        if (addFastBtn) addFastBtn.onclick = (e) => { e.stopPropagation(); this.openAddPlayerModal(tracker.trackerId); };
        if (removeFastBtn) removeFastBtn.onclick = (e) => { e.stopPropagation(); this.openRemovePlayerModal(tracker.trackerId); };

        this.list.appendChild(card);
    }

    async handleCreate() {
        const guildId = this.app.currentGuildId;
        const serverId = this.app.serverData?.serverId;
        if (!guildId || !serverId) return;

        try {
            const response = await fetch(`/api/tracker/${guildId}/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverId })
            });

            if (response.ok) {
                // The update will come via Socket.io
            } else {
                alert(this.app.languageManager.get('trackers.error.create'));
            }
        } catch (e) {
            console.error(e);
        }
    }

    async handleDelete(trackerId) {
        this.app.showConfirm(
            this.app.languageManager.get('switches.action.delete'),
            `${this.app.languageManager.get('trackers.confirm.deleteMsg') || 'Are you sure you want to delete tracker'} #${trackerId}?`,
            async () => {
                const guildId = this.app.currentGuildId;
                try {
                    await fetch(`/api/tracker/${guildId}/${trackerId}/delete`, { method: 'POST' });
                } catch (e) { console.error(e); }
            }
        );
    }

    openEditModal(trackerId) {
        this.currentEditId = trackerId;
        const tracker = this.trackers[trackerId];
        if (!tracker || !this.editModal) return;

        this.editNameInput.value = tracker.name || '';
        this.editBMIdInput.value = tracker.battlemetricsId || '';
        this.editClanTagInput.value = tracker.clanTag || '';

        // Find channel name if possible, or leave empty to not rename
        // The backend doesn't explicitly store channelName in tracker object, 
        // but it's used for the Discord side. We'll populate with a default or leave blank.
        this.editChannelNameInput.value = `tracker-${trackerId}`;

        this.editEveryoneToggle.checked = tracker.everyone || false;
        this.editInGameToggle.checked = tracker.inGame !== false;

        this.editModal.classList.add('open');
    }


    openAddPlayerModal(trackerId) {
        this.currentAddPlayerTrackerId = trackerId;
        if (this.addPlayerModal) {
            this.addPlayerInputNew.value = '';
            this.addPlayerModal.classList.add('open');
            setTimeout(() => this.addPlayerInputNew.focus(), 100);
        }
    }

    closeAddPlayerModal() {
        if (this.addPlayerModal) {
            this.addPlayerModal.classList.remove('open');
        }
        this.currentAddPlayerTrackerId = null;
    }

    async executeAddPlayer() {
        const id = this.addPlayerInputNew.value.trim();
        if (!id) return;

        const guildId = this.app.currentGuildId;
        try {
            const response = await fetch(`/api/tracker/${guildId}/${this.currentAddPlayerTrackerId}/players/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });

            if (response.ok) {
                this.closeAddPlayerModal();
            } else {
                const data = await response.json();
                alert(data.error || this.app.languageManager.get('trackers.error.add'));
            }
        } catch (e) {
            console.error(e);
        }
    }

    async handleAddPlayer() {
        const id = this.addPlayerIdInput.value.trim();
        if (!id) return;

        const guildId = this.app.currentGuildId;
        try {
            const response = await fetch(`/api/tracker/${guildId}/${this.currentEditId}/players/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });

            if (response.ok) {
                this.addPlayerIdInput.value = '';
                // renderPlayerList will be called by Socket.io update or manual refresh if needed
            } else {
                const data = await response.json();
                alert(data.error || this.app.languageManager.get('trackers.error.add'));
            }
        } catch (e) { console.error(e); }
    }

    async handleRemovePlayer(id) {
        const tracker = this.trackers[this.currentEditId];
        const player = tracker?.players.find(p => (p.steamId || p.playerId) === id);
        const name = player ? player.name : id;

        this.app.showConfirm(
            this.app.languageManager.get('trackers.confirm.removeTitle'),
            this.app.languageManager.get('trackers.confirm.removePlayerName').replace('{n}', name),
            async () => {
                const guildId = this.app.currentGuildId;
                try {
                    await fetch(`/api/tracker/${guildId}/${this.currentEditId}/players/remove`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id })
                    });
                } catch (e) { console.error(e); }
            }
        );
    }

    async saveEdit() {
        const guildId = this.app.currentGuildId;
        const payload = {
            name: this.editNameInput.value.trim(),
            battlemetricsId: this.editBMIdInput.value.trim(),
            clanTag: this.editClanTagInput.value.trim(),
            everyone: this.editEveryoneToggle.checked,
            inGame: this.editInGameToggle.checked,
            channelName: this.editChannelNameInput.value.trim()
        };

        try {
            const response = await fetch(`/api/tracker/${guildId}/${this.currentEditId}/edit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                this.closeEditModal();
            } else {
                alert(this.app.languageManager.get('trackers.error.save'));
            }
        } catch (e) { console.error(e); }
    }

    closeEditModal() {
        if (this.editModal) this.editModal.classList.remove('open');
        this.currentEditId = null;
    }

    openRemovePlayerModal(trackerId) {
        this.currentRemoveTrackerId = trackerId;
        this.renderRemovePlayerList();
        if (this.removePlayerModal) {
            this.removePlayerModal.classList.add('open');
        }
    }

    closeRemovePlayerModal() {
        if (this.removePlayerModal) {
            this.removePlayerModal.classList.remove('open');
        }
        this.currentRemoveTrackerId = null;
    }

    renderRemovePlayerList() {
        const tracker = this.trackers[this.currentRemoveTrackerId];
        if (!tracker || !this.removePlayerList) return;

        this.removePlayerList.innerHTML = tracker.players.map(p => `
            <div class="manage-player-item">
                <div class="manage-player-info">
                    <span class="manage-player-name">${p.name}</span>
                    <span class="manage-player-id">${p.steamId || p.playerId}</span>
                </div>
                <button class="btn-delete-player" onclick="trackersModal.executeRemovePlayer('${p.steamId || p.playerId}')" title="${this.app.languageManager.get('trackers.action.removePlayerTitle')}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v0"></path>
                    </svg>
                </button>
            </div>
        `).join('') || `<div class="no-players">${this.app.languageManager.get('trackers.noPlayers')}</div>`;
    }

    async executeRemovePlayer(playerId) {
        const guildId = this.app.currentGuildId;
        const trackerId = this.currentRemoveTrackerId;

        this.app.showConfirm(
            this.app.languageManager.get('trackers.confirm.removeTitle'),
            this.app.languageManager.get('trackers.confirm.removeMsg'),
            async () => {
                try {
                    const response = await fetch(`/api/tracker/${guildId}/${trackerId}/players/remove`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: playerId })
                    });
                    const result = await response.json();
                    if (result.success) {
                        this.app.showNotification('success', this.app.languageManager.get('trackers.notif.remove'));

                        // Update both local and app server data to prevent revert
                        if (this.app.serverData?.trackers?.[trackerId]) {
                            this.app.serverData.trackers[trackerId].players = result.players;
                        }
                        this.trackers[trackerId].players = result.players;

                        this.renderRemovePlayerList();
                        this.render(); // Re-render main cards without re-fetching from potentially stale source
                    }
                } catch (e) {
                    this.app.showNotification('error', this.app.languageManager.get('trackers.error.remove'));
                    console.error(e);
                }
            }
        );
    }
}
