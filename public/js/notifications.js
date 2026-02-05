class NotificationManager {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.settings = {
            // Core/FCM
            death: true,
            raid: true,
            // Bot Settings (mapped to notificationSettingsTemplate keys)
            cargoShipDetectedSetting: true,
            cargoShipLeftSetting: true,
            cargoShipEgressSetting: true,
            cargoShipDockingAtHarborSetting: true,
            patrolHelicopterDetectedSetting: true,
            patrolHelicopterLeftSetting: true,
            patrolHelicopterDestroyedSetting: true,
            lockedCrateOilRigUnlockedSetting: true,
            heavyScientistCalledSetting: true,
            chinook47DetectedSetting: true,
            travelingVendorDetectedSetting: true,
            travelingVendorHaltedSetting: true,
            travelingVendorLeftSetting: true,
            vendingMachineDetectedSetting: true
        };
        // Temp settings buffer for cancel functionality
        this.tempSettings = { ...this.settings };
        this.isOpen = false;

        // DOM Elements
        this.btn = null;
        this.badge = null;
        this.dropdown = null;
        this.settingsContainer = null;
        this.list = null;
        this.settingsBtn = null;
        this.saveBtn = null;
        this.cancelBtn = null;

        this.init();
    }

    init() {
        this.loadNotifications(); // Cargar notificaciones guardadas ANTES de settings
        this.loadSettings();

        // Wait for DOM to be ready if not already
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupUI());
        } else {
            this.setupUI();
        }
    }

    setupUI() {
        this.btn = document.getElementById('notificationBtn');
        this.badge = document.getElementById('notificationBadge');
        this.dropdown = document.getElementById('notificationDropdown');
        this.settingsContainer = document.getElementById('notificationSettingsContainer');
        this.list = document.getElementById('notificationList');

        // Buttons
        this.settingsBtn = document.getElementById('notificationSettingsBtn');
        this.saveBtn = document.getElementById('saveNotificationSettings');
        this.cancelBtn = document.getElementById('cancelNotificationSettings');

        if (this.btn) {
            this.btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
        }

        if (this.settingsBtn) {
            this.settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSettingsPanel();
            });
        }

        if (this.saveBtn) {
            this.saveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.saveSettingsChanges();
            });
        }

        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.cancelSettingsChanges();
            });
        }

        // Mark All Read button
        const markAllBtn = document.getElementById('markAllReadBtn');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.markAllAsRead();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isOpen &&
                !this.dropdown.contains(e.target) &&
                !this.btn.contains(e.target)) {
                this.closeDropdown();
            }
        });

        // Initialize settings checkboxes
        this.renderSettingsInputs();

        // Initialize empty list
        this.renderList();

        // IMPORTANTE: Actualizar badge DESPUÉS de que setupUI esté completo
        // Actualizar badge después de que setupUI esté completo
        this.updateBadge();
    }

    loadSettings() {
        const saved = localStorage.getItem('rpp_notification_settings');
        if (saved) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            } catch (e) { console.error('Error loading notification settings', e); }
        }

        // Also try to sync from server if possible
        this.syncSettingsFromServer();
    }

    async syncSettingsFromServer() {
        if (!window.rustplusUI?.currentGuildId) return;

        try {
            const res = await fetch(`/api/server/${window.rustplusUI.currentGuildId}/notification-settings`);
            if (res.ok) {
                const serverSettings = await res.json();
                // Map server settings (discord toggle) to our simple local settings
                for (const [key, config] of Object.entries(serverSettings)) {
                    if (this.settings.hasOwnProperty(key)) {
                        this.settings[key] = config.discord;
                    }
                }
                this.renderSettingsInputs();
            }
        } catch (e) {
            console.error('Failed to sync settings from server', e);
        }
    }

    loadNotifications() {
        const saved = localStorage.getItem('rpp_notifications');
        if (saved) {
            try {
                this.notifications = JSON.parse(saved);

                // Eliminar duplicados basados en el mensaje (mantener solo la más reciente)
                const uniqueMap = new Map();
                this.notifications.forEach(notif => {
                    if (!uniqueMap.has(notif.message) || uniqueMap.get(notif.message).time < notif.time) {
                        uniqueMap.set(notif.message, notif);
                    }
                });
                this.notifications = Array.from(uniqueMap.values());

                // Ordenar por tiempo (más recientes primero)
                this.notifications.sort((a, b) => b.time - a.time);

                // Compatibilidad con notificaciones antiguas: añadir campo 'read' si no existe
                this.notifications = this.notifications.map(notif => {
                    if (notif.read === undefined) {
                        notif.read = false; // Las notificaciones antiguas se marcan como no leídas
                    }
                    return notif;
                });

                // Guardar con el nuevo formato limpio
                this.persistNotifications();
                this.updateBadge();
            } catch (e) {
                console.error('Error loading notifications', e);
                this.notifications = [];
            }
        }
    }

    persistNotifications() {
        try {
            localStorage.setItem('rpp_notifications', JSON.stringify(this.notifications));
        } catch (e) {
            console.error('Error saving notifications', e);
        }
    }

    saveSettings() {
        localStorage.setItem('rpp_notification_settings', JSON.stringify(this.settings));
    }

    renderSettingsInputs() {
        this.tempSettings = { ...this.settings };

        Object.keys(this.tempSettings).forEach(key => {
            const checkbox = document.getElementById(`notify_${key}`);
            if (checkbox) {
                checkbox.checked = this.tempSettings[key];
                // Remove old listeners to avoid duplicates if any
                const newCheckbox = checkbox.cloneNode(true);
                checkbox.parentNode.replaceChild(newCheckbox, checkbox);

                newCheckbox.addEventListener('change', (e) => {
                    this.tempSettings[key] = e.target.checked;
                });
            }
        });
    }

    async saveSettingsChanges() {
        this.settings = { ...this.tempSettings };
        this.saveSettings();

        // Push settings to server
        if (window.rustplusUI?.currentGuildId) {
            try {
                // Prepare settings to update (ignoring fcm keys like death/raid for the bot core sync)
                const botSettings = {};
                Object.keys(this.settings).forEach(key => {
                    if (key.endsWith('Setting')) {
                        botSettings[key] = this.settings[key];
                    }
                });

                await fetch(`/api/server/${window.rustplusUI.currentGuildId}/notification-settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(botSettings)
                });
            } catch (e) {
                console.error('Failed to save settings to server', e);
            }
        }

        this.closeSettingsPanel();
    }

    cancelSettingsChanges() {
        this.tempSettings = { ...this.settings }; // Revert
        this.closeSettingsPanel();
    }

    toggleDropdown() {
        if (this.isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    openDropdown() {
        if (!this.dropdown) return;
        this.dropdown.style.display = 'block';
        this.btn.classList.add('active');
        this.isOpen = true;
        this.closeSettingsPanel(); // Always start with settings closed
        // No reseteamos unreadCount aquí, solo al marcar como leído
        this.renderList(); // Re-renderizar para mostrar botón si hay no leídas
    }

    closeDropdown() {
        if (!this.dropdown) return;
        this.dropdown.style.display = 'none';
        this.btn.classList.remove('active');
        this.isOpen = false;
        this.closeSettingsPanel();
    }

    toggleSettingsPanel() {
        if (this.settingsContainer) {
            if (this.settingsContainer.classList.contains('open')) {
                this.closeSettingsPanel();
            } else {
                this.renderSettingsInputs(); // Sync inputs
                this.settingsContainer.classList.add('open');
            }
        }
    }

    closeSettingsPanel() {
        if (this.settingsContainer) {
            this.settingsContainer.classList.remove('open');
        }
    }

    addNotification(type, message, time = Date.now()) {
        if (!this.settings[type]) return;

        // Verificar si ya existe una notificación con el mismo mensaje
        const isDuplicate = this.notifications.some(n => n.message === message);
        if (isDuplicate) {
            return; // No añadir duplicados
        }

        const notification = {
            id: Date.now() + Math.random(),
            type,
            message,
            time,
            read: false  // NUEVO: Estado de lectura
        };

        this.notifications.unshift(notification);
        if (this.notifications.length > 5) this.notifications.pop(); // Cambiar de 50 a 5

        this.persistNotifications(); // Guardar en localStorage
        this.updateBadge();
        this.animateBell();
        this.renderList();
    }

    getUnreadCount() {
        return this.notifications.filter(n => !n.read).length;
    }

    markAsRead(id) {
        const notif = this.notifications.find(n => n.id === id);
        if (notif && !notif.read) {
            notif.read = true;
            this.persistNotifications();
            this.updateBadge();
            this.renderList();
        }
    }

    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.persistNotifications();
        this.updateBadge();
        this.renderList();
    }

    animateBell() {
        if (this.btn) {
            this.btn.classList.remove('animate-ring');
            void this.btn.offsetWidth; // Trigger reflow
            this.btn.classList.add('animate-ring');
        }
    }

    updateBadge() {
        if (!this.badge) return;

        const unreadCount = this.getUnreadCount();

        if (unreadCount > 0) {
            this.badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            this.badge.style.display = 'flex';
            // Añadir clase al botón para cambiar color de la campana
            if (this.btn) this.btn.classList.add('has-unread');
        } else {
            this.badge.style.display = 'none';
            if (this.btn) this.btn.classList.remove('has-unread');
        }
    }

    renderList() {
        if (!this.list) return;

        this.list.innerHTML = '';

        // Botón "Leer todo" - solo visible si hay no leídas
        const markAllBtn = document.getElementById('markAllReadBtn');
        if (markAllBtn) {
            const unreadCount = this.getUnreadCount();
            markAllBtn.style.display = unreadCount > 0 ? 'block' : 'none';
        }

        if (this.notifications.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'notification-empty';
            empty.textContent = window.rustplusUI?.languageManager?.get('notifications.empty') || 'No new notifications';
            this.list.appendChild(empty);
            // NO hacer return aquí - continuar para mostrar el botón
        } else {
            // Renderizar notificaciones solo si hay
            this.notifications.forEach(notif => {
                const li = document.createElement('li');
                li.className = `notification-item type-${notif.type}`;
                if (!notif.read) {
                    li.classList.add('unread');
                }

                const icon = this.getIconForType(notif.type);
                const timeStr = new Date(notif.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                li.innerHTML = `
                <div class="notif-icon">${icon}</div>
                <div class="notif-content">
                    <p class="notif-message">${notif.message}</p>
                    <span class="notif-time">${timeStr}</span>
                </div>
                <button class="notif-delete-btn" title="Borrar">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            `;

                // Click para marcar como leída
                li.addEventListener('click', () => {
                    this.markAsRead(notif.id);
                });

                // Click para borrar
                const deleteBtn = li.querySelector('.notif-delete-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.deleteNotification(notif.id);
                    });
                }

                this.list.appendChild(li);
            });
        }

        // Footer con acciones (Resetear o Restaurar)
        const footerContainer = document.createElement('div');
        footerContainer.style.padding = '10px';
        footerContainer.style.textAlign = 'center';
        footerContainer.style.borderTop = '1px solid var(--border)';
        footerContainer.style.marginTop = 'auto'; // Empujar al fondo si hay flex

        const actionBtn = document.createElement('button');
        actionBtn.className = 'btn-secondary';
        actionBtn.style.fontSize = '11px';
        actionBtn.style.width = '100%';
        actionBtn.style.padding = '8px';
        actionBtn.style.cursor = 'pointer';

        if (this.notifications.length > 0) {
            // Modo Resetear/Borrar
            actionBtn.textContent = this.notifications.length > 5 ? 'Resetear (Mantener 5)' : 'Borrar Todas';
            actionBtn.addEventListener('click', () => this.resetNotifications());
        } else {
            // Modo Restaurar (cuando está vacío)
            actionBtn.textContent = 'Restaurar Recientes (5)';
            actionBtn.addEventListener('click', () => this.restoreRecentNotifications());
        }

        footerContainer.appendChild(actionBtn);
        this.list.appendChild(footerContainer);
    }

    restoreRecentNotifications() {
        // Obtener eventos recientes del servidor global
        const events = window.rustplusUI?.serverData?.events?.all || [];

        if (events.length === 0) {
            alert('No hay eventos recientes en el servidor para restaurar.');
            return;
        }

        // Tomar los últimos 5
        const recentEvents = events.slice(0, 5);
        let addedCount = 0;

        recentEvents.forEach(event => {
            // Verificar duplicados
            const isDuplicate = this.notifications.some(n => n.message === event);
            if (!isDuplicate) {
                // Determinar tipo
                let eventType = 'cargo'; // Default
                const eventLower = event.toLowerCase();

                if (eventLower.includes('cargo') || eventLower.includes('barco')) eventType = 'cargo';
                else if (eventLower.includes('heli') || eventLower.includes('helicóptero')) eventType = 'heli';
                else if (eventLower.includes('crate') || eventLower.includes('caja')) eventType = 'crate';
                else if (eventLower.includes('raid') || eventLower.includes('ataque')) eventType = 'raid';

                this.notifications.unshift({
                    id: Date.now() + Math.random(),
                    type: eventType,
                    message: event,
                    time: Date.now(),
                    read: false
                });
                addedCount++;
            }
        });

        if (addedCount > 0) {
            this.persistNotifications();
            this.updateBadge();
            this.renderList();
        } else {
            alert('No se encontraron nuevos eventos para restaurar.');
        }
    }

    resetNotifications() {
        if (this.notifications.length === 0) return;

        const keepCount = 5;
        let message = '';

        if (this.notifications.length <= keepCount) {
            message = '¿Seguro que quieres borrar TODAS las notificaciones?';
        } else {
            message = `¿Seguro que quieres borrar el historial y mantener solo las ${keepCount} más recientes?`;
        }

        if (confirm(message)) {
            if (this.notifications.length <= keepCount) {
                this.notifications = []; // Borrar todo
            } else {
                this.notifications = this.notifications.slice(0, keepCount); // Mantener 5
            }

            this.persistNotifications();
            this.updateBadge(); // Actualizar contador
            this.renderList();  // Re-renderizar lista
        }
    }

    deleteNotification(id) {
        // Encontrar el elemento en el DOM
        const items = Array.from(this.list.children);
        const itemToDelete = items.find(li => {
            // Buscamos el listener indirectamente o por índice, pero como renderList recrea todo,
            // necesitamos encontrar el índice en el array de notificaciones
            const index = this.notifications.findIndex(n => n.id === id);
            return items[index] === li;
        });

        if (itemToDelete) {
            // 1. Crear efecto visual
            this.createDisintegrationEffect(itemToDelete);

            // 2. Añadir clase para desvanecer
            itemToDelete.classList.add('disintegrating');

            // 3. Esperar a la animación antes de borrar lógicamente
            setTimeout(() => {
                this.notifications = this.notifications.filter(n => n.id !== id);
                this.persistNotifications();
                this.updateBadge(); // Actualizar contador
                this.renderList();  // Re-renderizar lista
            }, 1000); // 1s coincide con la animación de erosión
        } else {
            // Fallback si no encuentra elemento (ej. si renderList se llamó justo antes)
            this.notifications = this.notifications.filter(n => n.id !== id);
            this.persistNotifications();
            this.updateBadge();
            this.renderList();
        }
    }

    createDisintegrationEffect(element) {
        // Asegurar que el elemento tenga id para seleccionarlo si hace falta, aunque usaremos ref directa
        const rect = element.getBoundingClientRect();

        // Configuración
        const duration = 1200; // Duración total
        const fps = 60;

        // Paleta estricta: Rojo y Negro (Estilo Dark/Thanos)
        const colors = [
            '#ff0000', '#ff0000', '#b71c1c', '#ff5252', '#d50000', // Rojos
            '#000000', '#000000', '#212121', '#424242' // Negros/Grises
        ];

        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 1. Calcular el polígono de recorte "Jagged" (Dentado)
            // Límite de erosión actual (de derecha a izquierda)
            const edgeX = rect.width * (1 - progress);

            // Crear 10-15 puntos para el borde vertical irregular
            const segments = 12;
            const segmentHeight = rect.height / segments;
            let polygonPoints = `0px 0px, ${Math.max(0, edgeX)}px 0px`;

            // Puntos intermedios del borde dentado
            for (let i = 0; i <= segments; i++) {
                const y = i * segmentHeight;
                // Ruido aleatorio en X para cada punto: +/- 15px
                const noise = (Math.random() - 0.5) * 30;
                let x = edgeX + noise;

                // Clampear x entre 0 y width
                x = Math.max(0, Math.min(x, rect.width));

                polygonPoints += `, ${x}px ${y}px`;

                // Generar partículas en estos puntos exactos (el borde activo)
                // Solo generamos algunas por frame para no saturar
                if (Math.random() < 0.4) {
                    this.spawnParticle(rect.left + x, rect.top + y, colors);
                }
            }

            polygonPoints += `, 0px ${rect.height}px`;

            // Aplicar clip-path
            element.style.clipPath = `polygon(${polygonPoints})`;
            element.style.opacity = 1 - (progress * 0.5); // Desvanecer ligeramente el resto

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.style.opacity = 0;
            }
        };

        requestAnimationFrame(animate);
    }

    spawnParticle(x, y, colors) {
        const particle = document.createElement('div');
        particle.classList.add('particle');

        // Variedad de tamaños
        const isDust = Math.random() > 0.3;
        const size = isDust ? Math.random() * 3 + 2 : Math.random() * 6 + 4;

        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        if (!isDust) particle.style.borderRadius = '2px';

        // Posición inicial exacta en el borde
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;

        const color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.background = color;

        if (color.includes('ff') || color.includes('b7') || color.includes('d5')) {
            particle.style.boxShadow = `0 0 ${size * 1.5}px ${color}`;
        }

        document.body.appendChild(particle);

        // Física
        const velocityX = -(Math.random() * 150 + 80);
        const velocityY = (Math.random() - 0.5) * 120;
        const particleDuration = Math.random() * 800 + 800;
        const rotation = Math.random() * 720 - 360;

        const animation = particle.animate([
            { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
            { transform: `translate(${velocityX * 0.2}px, ${velocityY * 0.2}px) scale(${isDust ? 0 : 0.9}) rotate(${rotation * 0.3}deg)`, opacity: 0.9, offset: 0.2 },
            { transform: `translate(${velocityX * 0.6}px, ${velocityY * 0.8}px) scale(0.6) rotate(${rotation * 0.7}deg)`, opacity: 0.6, offset: 0.6 },
            { transform: `translate(${velocityX * 1.5}px, ${velocityY * 1.5 - 60}px) scale(0) rotate(${rotation}deg)`, opacity: 0 }
        ], {
            duration: particleDuration,
            easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)'
        });

        animation.onfinish = () => particle.remove();
    }

    getIconForType(type) {
        if (type.toLowerCase().includes('cargo')) return '🚢';
        if (type.toLowerCase().includes('heli')) return '🚁';
        if (type.toLowerCase().includes('crate') || type.toLowerCase().includes('scientist')) return '🏗️';
        if (type.toLowerCase().includes('vendor')) return '🚚';
        if (type.toLowerCase().includes('vending')) return '🏪';
        if (type.toLowerCase().includes('chinook')) return '🚁';

        switch (type) {
            case 'death': return '💀';
            case 'raid': return '💥';
            case 'cargo': return '🚢';
            case 'heli': return '🚁';
            case 'crate': return '📦';
            case 'oil_rig': return '🏗️';
            case 'vendor': return '🚚';
            case 'vending': return '🏪';
            case 'chinook': return '🚁';
            case 'info': return '📢';
            default: return '📢';
        }
    }
}
