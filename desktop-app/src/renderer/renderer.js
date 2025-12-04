class ChaguoRenderer {
    constructor() {
        this.currentPage = 'dashboard';
        this.currentConnection = null;
        this.connectionTimer = null;
        this.notifications = [];
        this.servers = [];
        this.protocols = [];
        this.activities = [];
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupPageNavigation();
        this.loadAppInfo();
        this.setupTheme();
        this.setupNotifications();
        this.loadInitialData();
        this.startConnectionMonitor();
        this.setupAutoUpdateCheck();
    }

    bindEvents() {
        // Quick connect buttons
        document.getElementById('quick-connect-btn').addEventListener('click', () => this.connect());
        document.getElementById('quick-disconnect-btn').addEventListener('click', () => this.disconnect());
        document.getElementById('main-connect-btn').addEventListener('click', () => this.connect());
        document.getElementById('main-disconnect-btn').addEventListener('click', () => this.disconnect());
        
        // Test connection
        document.getElementById('test-connection-btn').addEventListener('click', () => this.testConnection());
        
        // Refresh servers
        document.getElementById('refresh-servers-btn').addEventListener('click', () => this.loadServers());
        
        // Quick actions
        document.getElementById('action-mesh').addEventListener('click', () => this.openMeshNetwork());
        document.getElementById('action-obfuscate').addEventListener('click', () => this.toggleObfuscation());
        document.getElementById('action-recovery').addEventListener('click', () => this.triggerRecovery());
        document.getElementById('action-settings').addEventListener('click', () => this.navigateTo('settings'));
        
        // Protocol selection
        document.getElementById('protocol-select').addEventListener('change', (e) => {
            this.setProtocolPreference(e.target.value);
        });
        
        // Obfuscation controls
        document.getElementById('enable-obfuscation').addEventListener('change', (e) => {
            this.toggleObfuscation(e.target.checked);
        });
        
        document.getElementById('obfuscation-pattern').addEventListener('change', (e) => {
            this.setObfuscationPattern(e.target.value);
        });
        
        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
        
        // Notifications
        document.getElementById('notifications-btn').addEventListener('click', () => this.toggleNotifications());
        document.getElementById('close-notifications').addEventListener('click', () => this.toggleNotifications());
        
        // User menu
        document.getElementById('user-menu-btn').addEventListener('click', () => this.toggleUserMenu());
        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.quitApp();
        });
        
        // IPC events
        this.setupIPCEvents();
    }

    setupIPCEvents() {
        // Connection status updates
        window.chaguoAPI.onConnectionStatus((event, status) => {
            this.updateConnectionStatus(status);
        });
        
        // Config updates
        window.chaguoAPI.onConfigUpdated((event, data) => {
            this.showNotification('Config Updated', 'New configuration received', 'info');
            this.loadServers();
        });
        
        // Update status
        window.chaguoAPI.onUpdateStatus((event, status, info) => {
            this.handleUpdateStatus(status, info);
        });
    }

    setupPageNavigation() {
        const navItems = document.querySelectorAll('.nav-item[data-page]');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.getAttribute('data-page');
                this.navigateTo(page);
            });
        });
    }

    navigateTo(page) {
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
        
        // Update breadcrumb
        document.getElementById('breadcrumb').textContent = this.getPageTitle(page);
        
        // Update page content
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });
        document.getElementById(`page-${page}`)?.classList.add('active');
        
        this.currentPage = page;
        
        // Load page-specific data
        switch(page) {
            case 'servers':
                this.loadServers();
                break;
            case 'protocols':
                this.loadProtocols();
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }

    getPageTitle(page) {
        const titles = {
            dashboard: 'Dashboard',
            connect: 'Connect',
            servers: 'Servers',
            protocols: 'Protocols',
            settings: 'Settings',
            tools: 'Tools'
        };
        return titles[page] || 'Dashboard';
    }

    loadAppInfo() {
        document.getElementById('app-version').textContent = window.appInfo.version;
    }

    setupTheme() {
        const savedTheme = localStorage.getItem('chaguo-theme') || 'dark';
        document.body.setAttribute('data-theme', savedTheme);
        
        const themeIcon = document.querySelector('#theme-toggle i');
        themeIcon.className = savedTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }

    toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('chaguo-theme', newTheme);
        
        const themeIcon = document.querySelector('#theme-toggle i');
        themeIcon.className = newTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }

    async connect() {
        const protocol = document.getElementById('protocol-select').value;
        
        this.updateGlobalStatus('connecting', 'Connecting...');
        
        try {
            const result = await window.chaguoAPI.connect(protocol);
            
            if (result.success) {
                this.showNotification('Connected', 'VPN connection established successfully', 'success');
                this.updateGlobalStatus('connected', 'Connected');
                this.currentConnection = result.connection;
                this.startConnectionTimer();
                
                // Update connection info
                this.updateConnectionInfo(result);
                
                // Add activity
                this.addActivity('Connected to VPN', `Protocol: ${protocol}`);
                
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.showNotification('Connection Failed', error.message, 'error');
            this.updateGlobalStatus('disconnected', 'Connection Failed');
            console.error('Connection error:', error);
        }
    }

    async disconnect() {
        this.updateGlobalStatus('disconnecting', 'Disconnecting...');
        
        try {
            const result = await window.chaguoAPI.disconnect();
            
            if (result.success) {
                this.showNotification('Disconnected', 'VPN connection terminated', 'info');
                this.updateGlobalStatus('disconnected', 'Disconnected');
                this.currentConnection = null;
                this.stopConnectionTimer();
                
                // Add activity
                this.addActivity('Disconnected from VPN', 'Connection closed');
                
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.showNotification('Disconnect Failed', error.message, 'error');
            console.error('Disconnect error:', error);
        }
    }

    async testConnection() {
        const testBtn = document.getElementById('test-connection-btn');
        const originalHtml = testBtn.innerHTML;
        
        testBtn.innerHTML = '<i class="fas fa-spinner loading"></i> Testing...';
        testBtn.disabled = true;
        
        try {
            const result = await window.chaguoAPI.testConnection();
            
            if (result.success) {
                this.showNotification('Connection Test', `Success! Latency: ${result.latency}ms`, 'success');
                
                // Update UI
                document.getElementById('external-ip').textContent = result.ip;
                document.getElementById('latency').textContent = `${result.latency} ms`;
                
            } else {
                this.showNotification('Connection Test', `Failed: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showNotification('Connection Test', `Error: ${error.message}`, 'error');
        } finally {
            testBtn.innerHTML = originalHtml;
            testBtn.disabled = false;
        }
    }

    updateGlobalStatus(status, text) {
        const indicator = document.getElementById('global-status-indicator');
        const statusText = document.getElementById('global-status-text');
        
        // Remove all status classes
        indicator.classList.remove('disconnected', 'connecting', 'connected', 'disconnecting');
        
        // Add current status
        indicator.classList.add(status);
        statusText.textContent = text;
        
        // Update dashboard status
        document.getElementById('connection-status-text').textContent = text;
        document.getElementById('connection-status-text').className = `status-${status}`;
    }

    startConnectionTimer() {
        this.stopConnectionTimer();
        
        let startTime = Date.now();
        
        this.connectionTimer = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            document.getElementById('connection-duration').textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopConnectionTimer() {
        if (this.connectionTimer) {
            clearInterval(this.connectionTimer);
            this.connectionTimer = null;
        }
        document.getElementById('connection-duration').textContent = '00:00:00';
    }

    updateConnectionInfo(connectionResult) {
        document.getElementById('connection-protocol').textContent = 
            connectionResult.connection?.type || 'Unknown';
        
        // Update detailed connection info
        const infoDisplay = document.getElementById('detailed-connection-info');
        if (infoDisplay && connectionResult.config) {
            infoDisplay.textContent = JSON.stringify(connectionResult.config, null, 2);
        }
    }

    async loadServers() {
        try {
            const config = await window.chaguoAPI.getConfig();
            
            if (config && config.servers) {
                this.servers = config.servers;
                this.renderServers();
            }
        } catch (error) {
            console.error('Failed to load servers:', error);
            this.showNotification('Server Load Failed', error.message, 'error');
        }
    }

    renderServers() {
        const serversList = document.getElementById('servers-list');
        if (!serversList) return;
        
        serversList.innerHTML = '';
        
        this.servers.slice(0, 5).forEach(server => {
            const serverItem = document.createElement('div');
            serverItem.className = 'server-item';
            
            const latency = Math.floor(Math.random() * 200) + 50; // Mock latency
            
            serverItem.innerHTML = `
                <div class="server-status-indicator online"></div>
                <div class="server-info">
                    <div class="server-name">${server.name || server.host}</div>
                    <div class="server-details">
                        <span>${server.region || 'Global'}</span>
                        <span class="server-latency">${latency}ms</span>
                        <span>${server.protocols?.join(', ') || 'Multiple'}</span>
                    </div>
                </div>
            `;
            
            serversList.appendChild(serverItem);
        });
    }

    async loadProtocols() {
        // Mock protocols data
        this.protocols = [
            {
                id: 'v2ray-ws',
                name: 'V2Ray + WebSocket',
                icon: 'fas fa-code',
                description: 'V2Ray with WebSocket and TLS obfuscation',
                latency: '45ms',
                successRate: '98%',
                features: ['WebSocket transport', 'TLS encryption', 'Traffic obfuscation', 'Multi-path']
            },
            {
                id: 'shadowsocks',
                name: 'Shadowsocks',
                icon: 'fas fa-shield-alt',
                description: 'Lightweight proxy with obfuscation',
                latency: '38ms',
                successRate: '95%',
                features: ['AES encryption', 'Obfs plugin', 'UDP support', 'Simple setup']
            },
            {
                id: 'wireguard',
                name: 'WireGuard',
                icon: 'fas fa-bolt',
                description: 'Modern VPN protocol with better performance',
                latency: '32ms',
                successRate: '99%',
                features: ['State-of-the-art crypto', 'Fast handshake', 'Roaming support', 'Minimal codebase']
            },
            {
                id: 'trojan',
                name: 'Trojan',
                icon: 'fas fa-user-secret',
                description: 'Disguises as HTTPS traffic',
                latency: '52ms',
                successRate: '96%',
                features: ['HTTPS disguise', 'TLS encryption', 'Anti-detection', 'WebSocket support']
            }
        ];
        
        this.renderProtocols();
    }

    renderProtocols() {
        const protocolsGrid = document.getElementById('protocols-grid');
        if (!protocolsGrid) return;
        
        protocolsGrid.innerHTML = '';
        
        this.protocols.forEach(protocol => {
            const protocolCard = document.createElement('div');
            protocolCard.className = 'protocol-card';
            
            protocolCard.innerHTML = `
                <div class="protocol-header">
                    <div class="protocol-icon">
                        <i class="${protocol.icon}"></i>
                    </div>
                    <div class="protocol-title">
                        <h4>${protocol.name}</h4>
                        <p>${protocol.description}</p>
                    </div>
                </div>
                
                <div class="protocol-stats">
                    <div class="stat">
                        <div class="stat-value">${protocol.latency}</div>
                        <div class="stat-label">Latency</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${protocol.successRate}</div>
                        <div class="stat-label">Success Rate</div>
                    </div>
                </div>
                
                <div class="protocol-features">
                    <h5>Features</h5>
                    <ul class="feature-list">
                        ${protocol.features.map(feature => `<li>${feature}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="protocol-actions">
                    <button class="btn-primary" data-protocol="${protocol.id}">
                        <i class="fas fa-play"></i> Use
                    </button>
                    <button class="btn-secondary" data-protocol="${protocol.id}">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                </div>
            `;
            
            protocolsGrid.appendChild(protocolCard);
        });
        
        // Add event listeners to protocol buttons
        protocolsGrid.querySelectorAll('[data-protocol]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const protocol = e.currentTarget.getAttribute('data-protocol');
                const action = e.currentTarget.textContent.includes('Use') ? 'use' : 'details';
                
                if (action === 'use') {
                    this.setProtocolPreference(protocol);
                    this.navigateTo('connect');
                } else {
                    this.showProtocolDetails(protocol);
                }
            });
        });
    }

    showProtocolDetails(protocolId) {
        const protocol = this.protocols.find(p => p.id === protocolId);
        if (!protocol) return;
        
        this.showNotification(
            protocol.name,
            `${protocol.description}\nLatency: ${protocol.latency}\nSuccess Rate: ${protocol.successRate}`,
            'info'
        );
    }

    loadSettings() {
        // This would load actual settings from storage
        // For now, just show placeholder
        console.log('Loading settings...');
    }

    setupNotifications() {
        // Load notifications from storage
        this.notifications = JSON.parse(localStorage.getItem('chaguo-notifications') || '[]');
        this.updateNotificationBadge();
    }

    toggleNotifications() {
        const panel = document.getElementById('notifications-panel');
        panel.classList.toggle('show');
    }

    toggleUserMenu() {
        const dropdown = document.getElementById('user-menu-dropdown');
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    }

    showNotification(title, message, type = 'info') {
        // Add to notifications list
        const notification = {
            id: Date.now(),
            title,
            message,
            type,
            time: new Date().toLocaleTimeString(),
            read: false
        };
        
        this.notifications.unshift(notification);
        
        // Keep only last 50 notifications
        if (this.notifications.length > 50) {
            this.notifications.pop();
        }
        
        // Save to storage
        localStorage.setItem('chaguo-notifications', JSON.stringify(this.notifications));
        
        // Update badge
        this.updateNotificationBadge();
        
        // Show toast
        this.showToast(title, message, type);
        
        // Add to activity log
        this.addActivity(title, message);
    }

    showToast(title, message, type) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-header">
                <div class="toast-title">${title}</div>
                <button class="toast-close">&times;</button>
            </div>
            <div class="toast-message">${message}</div>
        `;
        
        document.body.appendChild(toast);
        
        // Add close button event
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        });
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }

    updateNotificationBadge() {
        const unreadCount = this.notifications.filter(n => !n.read).length;
        const badge = document.getElementById('notification-count');
        
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    addActivity(title, message) {
        const activity = {
            time: new Date().toLocaleTimeString(),
            title,
            message
        };
        
        this.activities.unshift(activity);
        
        // Keep only last 20 activities
        if (this.activities.length > 20) {
            this.activities.pop();
        }
        
        this.renderActivities();
    }

    renderActivities() {
        const activityList = document.getElementById('activity-list');
        if (!activityList) return;
        
        activityList.innerHTML = '';
        
        this.activities.forEach(activity => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.innerHTML = `
                <div class="activity-time">${activity.time}</div>
                <div class="activity-message">
                    <strong>${activity.title}:</strong> ${activity.message}
                </div>
            `;
            activityList.appendChild(activityItem);
        });
    }

    startConnectionMonitor() {
        // Monitor connection status periodically
        setInterval(async () => {
            if (this.currentConnection) {
                const status = await window.chaguoAPI.testConnection();
                if (!status.success) {
                    this.showNotification('Connection Lost', 'Attempting to reconnect...', 'warning');
                    this.triggerRecovery();
                }
            }
        }, 30000); // Check every 30 seconds
    }

    async triggerRecovery() {
        try {
            await window.chaguoAPI.triggerRecovery();
            this.showNotification('Self-Healing', 'Recovery procedures initiated', 'info');
        } catch (error) {
            console.error('Recovery failed:', error);
        }
    }

    async openMeshNetwork() {
        try {
            await window.chaguoAPI.discoverPeers();
            this.showNotification('Mesh Network', 'Searching for nearby devices...', 'info');
        } catch (error) {
            console.error('Mesh network error:', error);
        }
    }

    toggleObfuscation(enabled = null) {
        const checkbox = document.getElementById('enable-obfuscation');
        if (enabled !== null) {
            checkbox.checked = enabled;
        }
        
        const pattern = document.getElementById('obfuscation-pattern').value;
        
        window.chaguoAPI.setObfuscation(pattern);
        this.showNotification(
            'Obfuscation',
            `Traffic obfuscation ${checkbox.checked ? 'enabled' : 'disabled'}`,
            'info'
        );
    }

    setObfuscationPattern(pattern) {
        window.chaguoAPI.setObfuscation(pattern);
        this.showNotification('Obfuscation', `Pattern set to: ${pattern}`, 'info');
    }

    setProtocolPreference(protocol) {
        window.chaguoAPI.setProtocolPreference(protocol, true);
        
        // Update UI
        document.getElementById('protocol-select').value = protocol;
        
        this.showNotification('Protocol', `Preferred protocol set to: ${protocol}`, 'info');
    }

    handleUpdateStatus(status, info) {
        const updateStatus = document.getElementById('update-status');
        
        switch(status) {
            case 'checking':
                updateStatus.textContent = 'Checking for updates...';
                break;
            case 'available':
                updateStatus.textContent = 'Update available!';
                this.showNotification('Update Available', 'A new version is available for download.', 'info');
                break;
            case 'downloaded':
                updateStatus.textContent = 'Update ready to install';
                this.showNotification('Update Ready', 'Restart the app to install the update.', 'success');
                break;
            case 'not-available':
                updateStatus.textContent = 'Up to date';
                break;
            case 'error':
                updateStatus.textContent = 'Update check failed';
                break;
        }
    }

    setupAutoUpdateCheck() {
        // Check for updates on startup
        setTimeout(() => {
            this.handleUpdateStatus('checking');
        }, 3000);
    }

    loadInitialData() {
        // Load initial data
        this.loadServers();
        this.renderActivities();
        
        // Load network info
        this.loadNetworkInfo();
    }

    async loadNetworkInfo() {
        try {
            const info = await window.chaguoAPI.getNetworkInfo();
            
            if (info && !info.error) {
                // Update network info display
                // This is a simplified version
                console.log('Network info:', info);
            }
        } catch (error) {
            console.error('Failed to load network info:', error);
        }
    }

    quitApp() {
        if (confirm('Are you sure you want to exit Chaguo?')) {
            window.chaguoAPI.quitApp();
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chaguoApp = new ChaguoRenderer();
});
