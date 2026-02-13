class SwitchesModalManager {
    constructor(app) {
        this.app = app;
        this.modal = document.getElementById('switchesModal');
        this.list = document.getElementById('switches-list');
        this.headerBtn = document.getElementById('switchesNavBtn');
        this.closeBtn = this.modal ? this.modal.querySelector('.close-modal') : null;

        // Edit Modal Elements
        this.editModal = document.getElementById('editSwitchModal');
        this.editNameInput = document.getElementById('editSwitchName');
        this.editCommandInput = document.getElementById('editSwitchCommand');
        this.saveEditBtn = document.getElementById('saveEditBtn');
        this.cancelEditBtn = document.getElementById('cancelEditBtn');
        this.closeEditModalBtn = this.editModal ? this.editModal.querySelector('.close-edit-modal') : null;

        this.currentEditId = null;
        this.currentEditIsGroup = false;

        this.switches = {};
        this.switchGroups = {};

        // Auto Config Options
        this.autoOptions = [
            { value: 0, key: 'switches.autoOption.off' },
            { value: 1, key: 'switches.autoOption.autoDay' },
            { value: 2, key: 'switches.autoOption.autoNight' },
            { value: 3, key: 'switches.autoOption.autoOn' },
            { value: 4, key: 'switches.autoOption.autoOff' },
            { value: 5, key: 'switches.autoOption.autoOnProximity' },
            { value: 6, key: 'switches.autoOption.autoOffProximity' },
            { value: 7, key: 'switches.autoOption.autoOnAnyOnline' },
            { value: 8, key: 'switches.autoOption.autoOffAnyOnline' }
        ];

        this.init();
    }

    init() {
        if (this.headerBtn) {
            this.headerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
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

        // Edit Modal Events
        if (this.saveEditBtn) {
            this.saveEditBtn.addEventListener('click', () => this.saveEdit());
        }
        if (this.cancelEditBtn) {
            this.cancelEditBtn.addEventListener('click', () => this.closeEditModal());
        }
        if (this.closeEditModalBtn) {
            this.closeEditModalBtn.addEventListener('click', () => this.closeEditModal());
        }
        if (this.editModal) {
            this.editModal.addEventListener('click', (e) => {
                if (e.target === this.editModal) this.closeEditModal();
            });
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
        if (this.app?.serverData?.switches) {
            this.switches = this.app.serverData.switches;
            this.switchGroups = this.app.serverData.switchGroups || {};
            this.render();
        } else {
            this.list.innerHTML = `<div class="loading-switches">${this.app.languageManager.get('switches.loading')}</div>`;
        }
    }

    render() {
        this.list.innerHTML = '';

        const allSwitches = Object.entries(this.switches).map(([id, data]) => ({ ...data, entityId: id }));
        const allGroups = Object.entries(this.switchGroups).map(([id, data]) => ({ ...data, entityId: id }));

        const visibleSwitches = allSwitches.filter(sw => sw.reachable !== false);

        if (visibleSwitches.length === 0 && allGroups.length === 0) {
            this.list.innerHTML = `
                <div class="no-switches">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🔌</div>
                    <div>${this.app.languageManager.get('switches.empty.title')}</div>
                    <div style="font-size: 0.8rem; color: #888; margin-top: 0.5rem;">
                        ${this.app.languageManager.get('switches.empty.hint')}<br>
                        ${this.app.languageManager.get('switches.empty.note')}
                    </div>
                </div>`;
            return;
        }

        allGroups.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(group => {
            this.createCard(group, true);
        });

        visibleSwitches.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(sw => {
            this.createCard(sw, false);
        });
    }

    createCard(entity, isGroup) {
        const card = document.createElement('div');
        card.className = 'switch-card';
        card.style.opacity = entity.reachable === false ? '0.6' : '1';

        const isActive = entity.active;
        const imageSrc = entity.image ? `/images/electrics/${entity.image}` : (isGroup ? '/images/electrics/switch_group.png' : '/images/electrics/smart_switch.png');
        const cleanImageSrc = imageSrc.replace('attachment://', '/images/');

        const currentAuto = entity.autoDayNightOnOff !== undefined ? entity.autoDayNightOnOff : 0;
        const optionsHtml = this.autoOptions.map(opt => {
            const label = this.app.languageManager.get(opt.key);
            return `<option value="${opt.value}" ${currentAuto === opt.value ? 'selected' : ''}>${label}</option>`;
        }).join('');

        card.innerHTML = `
            <div class="switch-main-row">
                <div class="switch-info-col">
                    <div class="switch-header-info">
                        <span class="switch-status-badge ${isActive ? 'status-on' : 'status-off'}">
                             ● ${this.app.languageManager.get(isActive ? 'switches.status.on' : 'switches.status.off')}
                        </span>
                        <div class="switch-name">${entity.name}</div>
                    </div>
                    <div class="switch-id">
                        <span class="id-label">${this.app.languageManager.get('switches.id')}:</span> <span class="id-value">${entity.entityId}</span>
                    </div>
                    <div class="switch-command">
                         <span class="command-label">${this.app.languageManager.get('switches.customCommand')}</span><br>
                         <span class="command-value">!${entity.command || entity.entityId}</span>
                    </div>
                    ${!isGroup ? `
                    <div class="switch-location">
                        ${entity.location || this.app.languageManager.get('switches.unknownGrid')} • ${this.app.serverData?.serverName || this.app.languageManager.get('header.loading')}
                    </div>` : ''}
                </div>
                <div class="switch-img-col">
                     <img src="${cleanImageSrc}" alt="${entity.name}" onerror="this.src='/images/rust-logo.png'">
                </div>
            </div>

            <div class="switch-config-row">
                <div class="auto-config-label">
                    ${this.app.languageManager.get('switches.autoConfig')}:
                </div>
                <select class="auto-config-select">
                    ${optionsHtml}
                </select>
            </div>

            <div class="switch-actions-row">
                <button class="action-btn toggle-btn ${isActive ? 'btn-off' : 'btn-on'}" type="button">
                    ${this.app.languageManager.get(isActive ? 'switches.action.turnOff' : 'switches.action.turnOn')}
                </button>
                <button class="action-btn edit-btn" type="button">
                    ${this.app.languageManager.get('switches.action.edit')}
                </button>
                <button class="action-btn delete-btn" type="button" title="${this.app.languageManager.get('switches.action.delete')}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;

        const toggleBtn = card.querySelector('.toggle-btn');
        const editBtn = card.querySelector('.edit-btn');
        const deleteBtn = card.querySelector('.delete-btn');
        const autoSelect = card.querySelector('.auto-config-select');

        toggleBtn.onclick = (e) => { e.stopPropagation(); this.handleToggle(entity.entityId, isGroup, !isActive); };
        editBtn.onclick = (e) => { e.stopPropagation(); this.openEditModal(entity.entityId, isGroup); };
        deleteBtn.onclick = (e) => { e.stopPropagation(); this.handleDelete(entity.entityId, isGroup); };

        autoSelect.onchange = (e) => {
            e.stopPropagation();
            this.handleAutoConfig(entity.entityId, isGroup, e.target.value);
        };

        this.list.appendChild(card);
    }

    // --- Actions ---

    async handleToggle(entityId, isGroup, targetState) {
        const guildId = this.app.currentGuildId;
        if (!guildId) return;
        try {
            await fetch(`/api/switch/${guildId}/${entityId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: targetState })
            });
        } catch (e) { console.error(e); }
    }

    async handleAutoConfig(entityId, isGroup, selectedValue) {
        const guildId = this.app.currentGuildId;
        try {
            await fetch(`/api/switch/${guildId}/${entityId}/edit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ autoDayNightOnOff: parseInt(selectedValue) })
            });
        } catch (e) { console.error(e); }
    }

    async handleDelete(entityId, isGroup) {
        if (!confirm(this.app.languageManager.get('switches.confirm.delete'))) return;
        const guildId = this.app.currentGuildId;
        try {
            await fetch(`/api/switch/${guildId}/${entityId}/delete`, { method: 'POST' });
        } catch (e) { console.error(e); }
    }

    // --- Modal Logic ---

    openEditModal(entityId, isGroup) {
        this.currentEditId = entityId;
        this.currentEditIsGroup = isGroup;

        const entity = isGroup ? this.switchGroups[entityId] : this.switches[entityId];
        if (!entity || !this.editModal) return;

        this.editNameInput.value = entity.name || '';
        this.editCommandInput.value = entity.command || entityId;

        this.editModal.classList.add('open');
    }

    closeEditModal() {
        if (this.editModal) {
            this.editModal.classList.remove('open');
        }
        this.currentEditId = null;
    }

    async saveEdit() {
        if (!this.currentEditId) return;

        const guildId = this.app.currentGuildId;
        const newName = this.editNameInput.value.trim();
        const newCommand = this.editCommandInput.value.trim();

        if (!newName || !newCommand) {
            alert(this.app.languageManager.get('switches.error.missingFields'));
            return;
        }

        try {
            const endpoint = `/api/switch/${guildId}/${this.currentEditId}/edit`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName, command: newCommand })
            });

            if (response.ok) {
                this.closeEditModal();
            } else {
                alert(this.app.languageManager.get('switches.error.save'));
            }
        } catch (e) {
            console.error('Save error:', e);
            alert(this.app.languageManager.get('switches.error.save'));
        }
    }
}
