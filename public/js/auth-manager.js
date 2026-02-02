// Global Authentication Manager for RustPlus WebUI

class AuthManager {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.isAuthenticated = false;
        this.hasPinCode = null; // null = not checked, true/false = has/doesn't have pin
        this.sessionPinHash = null; // Store verified pin hash for this session
        this.guildId = null;
        this.onAuthCallbacks = [];
    }

    // Check if PIN exists in sessionStorage (for session persistence)
    checkSessionAuth() {
        const sessionAuth = sessionStorage.getItem('rustpp_auth');
        if (sessionAuth) {
            try {
                const authData = JSON.parse(sessionAuth);
                if (authData.authenticated && authData.guildId === this.guildId) {
                    this.isAuthenticated = true;
                    this.sessionPinHash = authData.hash;
                    return true;
                }
            } catch (e) {
                console.error('Error reading session auth:', e);
            }
        }
        return false;
    }

    // Save authentication to session
    saveSessionAuth() {
        if (this.isAuthenticated && this.guildId) {
            sessionStorage.setItem('rustpp_auth', JSON.stringify({
                authenticated: true,
                guildId: this.guildId,
                hash: this.sessionPinHash,
                timestamp: Date.now()
            }));
        }
    }

    // Clear authentication
    clearAuth() {
        this.isAuthenticated = false;
        this.sessionPinHash = null;
        sessionStorage.removeItem('rustpp_auth');
    }

    // Set guild ID and check if we need auth
    async setGuildId(guildId) {
        if (this.guildId === guildId && this.isAuthenticated) {
            return true; // Already authenticated for this guild
        }

        this.guildId = guildId;
        // Check session first
        if (this.checkSessionAuth()) {
            return true;
        }

        try {
            // Check if pin code is configured
            const pinStatus = await this.apiClient.get(`/api/statistics/pin-status/${guildId}`);
            this.hasPinCode = pinStatus.hasPinCode;
            if (!this.hasPinCode) {
                // No pin code set, allow access
                this.isAuthenticated = true;
                return true;
            }
            return false; // Need to authenticate
        } catch (error) {
            console.error('Error checking PIN status:', error);
            // If API endpoint doesn't exist (404), assume no PIN protection
            if (error.message && error.message.includes('404')) {
                console.warn('[PIN] API endpoints not implemented yet - allowing access without PIN');
            }
            // On error, assume no pin code and allow access
            this.hasPinCode = false;
            this.isAuthenticated = true;
            return true;
        }
    }

    // Show PIN entry modal
    async showPinModal() {
        return new Promise((resolve, reject) => {
            // Remove any existing modal
            const existingModal = document.getElementById('globalPinModal');
            if (existingModal) {
                existingModal.remove();
            }

            // Create a modal overlay for PIN entry
            const modal = document.createElement('div');
            modal.id = 'globalPinModal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 100000;';
            modal.innerHTML = `
                <div style="background: var(--bg-primary); padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); max-width: 400px; width: 90%;">
                    <h2 style="text-align: center; margin-bottom: 10px; color: var(--text-primary);">🔒 Protected Access</h2>
                    <p style="text-align: center; color: var(--text-secondary); margin-bottom: 30px; font-size: 14px;">This server requires a PIN code.<br>Enter the PIN to access the WebUI.</p>
                    <input type="password" id="globalPinInput" placeholder="Enter PIN Code" maxlength="20" style="width: 100%; padding: 14px; font-size: 18px; border: 2px solid var(--border); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); text-align: center; letter-spacing: 3px; margin-bottom: 20px; box-sizing: border-box; font-weight: 600;">
                    <div id="globalPinError" style="color: #ff5722; text-align: center; margin-bottom: 15px; min-height: 20px; font-weight: 500;"></div>
                    <div style="display: flex; gap: 10px;">
                        <button id="globalPinSubmit" style="flex: 1; padding: 12px; background: var(--accent); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600; transition: all 0.2s;">🔓 Unlock</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const input = document.getElementById('globalPinInput');
            const submitBtn = document.getElementById('globalPinSubmit');

            const submit = async () => {
                const pin = input.value || '';
                const errorDiv = document.getElementById('globalPinError');

                if (!pin) {
                    errorDiv.textContent = 'Please enter a PIN code';
                    input.style.borderColor = '#ff5722';
                    return;
                }

                submitBtn.disabled = true;
                submitBtn.textContent = '⏳ Verifying...';

                try {
                    const result = await this.apiClient.post(`/api/statistics/verify-pin/${this.guildId}`, { pin });

                    if (result.success) {
                        this.isAuthenticated = true;
                        this.sessionPinHash = result.hash;
                        this.saveSessionAuth();
                        document.body.removeChild(modal);

                        // Call all registered callbacks
                        this.onAuthCallbacks.forEach(callback => callback());
                        this.onAuthCallbacks = [];

                        resolve(true);
                    } else {
                        errorDiv.textContent = '❌ Incorrect PIN code';
                        input.value = '';
                        input.style.borderColor = '#ff5722';
                        input.focus();
                        submitBtn.disabled = false;
                        submitBtn.textContent = '🔓 Unlock';
                    }
                } catch (error) {
                    console.error('Error verifying pin:', error);
                    errorDiv.textContent = '❌ Error verifying PIN';
                    submitBtn.disabled = false;
                    submitBtn.textContent = '🔓 Unlock';
                }
            };
            submitBtn.onclick = submit;
            input.onkeypress = (e) => {
                if (e.key === 'Enter') submit();
            };
            input.oninput = () => {
                input.style.borderColor = 'var(--border)';
            };
            // Add hover effect
            submitBtn.onmouseenter = () => {
                if (!submitBtn.disabled) {
                    submitBtn.style.transform = 'scale(1.02)';
                    submitBtn.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.3)';
                }
            };
            submitBtn.onmouseleave = () => {
                submitBtn.style.transform = 'scale(1)';
                submitBtn.style.boxShadow = 'none';
            };
            setTimeout(() => input.focus(), 100);
        });
    }

    // Ensure authentication before proceeding
    async ensureAuthenticated(guildId) {
        const needsAuth = !(await this.setGuildId(guildId));

        if (needsAuth) {
            await this.showPinModal();
        }

        return this.isAuthenticated;
    }

    // Register callback to be called after authentication
    onAuthenticated(callback) {
        if (this.isAuthenticated) {
            callback();
        } else {
            this.onAuthCallbacks.push(callback);
        }
    }
}
