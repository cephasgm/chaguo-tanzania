class ChaguoApp {
    constructor() {
        this.currentConfig = null;
        this.expiryTimer = null;
        this.language = 'en';
        this.translations = this.loadTranslations();
        this.init();
    }

    // UPDATED INIT FUNCTION (as instructed)
    init() {
        console.log('Chaguo App Initializing...');

        // Fix: Load QR code library dynamically
        this.loadQRLibrary().then(() => {
            this.bindEvents();
            this.setupLanguage();
            this.loadMethods();
            this.generateQRCode();
            this.setupPWA();
            this.checkConnection();
            this.startExpiryTimer();
        });
    }

    // NEW METHOD (as instructed)
    async loadQRLibrary() {
        if (typeof QRCode === 'undefined') {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/qrcode.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
    }

    loadTranslations() {
        return {
            en: {
                title: "Chaguo - Your Choice for Internet Freedom",
                subtitle: "Open-source tools to bypass internet restrictions in Tanzania",
                qrTitle: "📱 One-Click Setup",
                qrDescription: "Scan QR code to import configuration directly to your VPN client",
                downloadTitle: "⬇️ Download Chaguo Toolkit",
                downloadDesc: "Available for all platforms",
                methodsTitle: "🛡️ Working Methods",
            },
            sw: {
                title: "Chaguo - Chaguo Lako kwa Uhuru wa Intaneti",
                subtitle: "Zana za wazi kuzuia vikwazo vya intaneti Tanzania",
                qrTitle: "📱 Usanidi wa Kubofya-Moja",
                qrDescription: "Piga scan msimbo wa QR kuweka usanidi moja kwa moja kwenye VPN yako",
                downloadTitle: "⬇️ Pakua Chaguo Toolkit",
                downloadDesc: "Inapatikana kwa majukwaa yote",
                methodsTitle: "🛡️ Mbinu Zinazofanya Kazi",
            }
        };
    }

    bindEvents() {
        document.getElementById('lang-en').addEventListener('click', () => this.switchLanguage('en'));
        document.getElementById('lang-sw').addEventListener('click', () => this.switchLanguage('sw'));

        document.getElementById('generate-qr').addEventListener('click', () => this.generateQRCode());
        document.getElementById('download-qr').addEventListener('click', () => this.downloadQRCode());
        document.getElementById('copy-config').addEventListener('click', () => this.copyConfig());
        document.getElementById('download-config').addEventListener('click', () => this.downloadConfig());

        document.getElementById('emergency-sms').addEventListener('click', () => this.requestConfigViaSMS());
        document.getElementById('mesh-discover').addEventListener('click', () => this.discoverMeshPeers());
        document.getElementById('offline-mode').addEventListener('click', () => this.enableOfflineMode());

        const installBtn = document.getElementById('install-pwa');
        if (installBtn) {
            installBtn.addEventListener('click', () => this.installPWA());
        }
    }

    async generateQRCode() {
        try {
            document.getElementById('qrcode').innerHTML = '';

            this.currentConfig = await this.fetchLatestConfig();

            document.getElementById('config-text').value = JSON.stringify(this.currentConfig, null, 2);
            document.getElementById('protocol-name').textContent = this.currentConfig.protocol;

            QRCode.toCanvas(document.getElementById('qrcode'),
                JSON.stringify(this.currentConfig),
                {
                    width: 256,
                    height: 256,
                    margin: 1,
                    color: {
                        dark: '#2E7D32',
                        light: '#ffffff'
                    }
                },
                (error) => {
                    if (error) console.error('QR Code error:', error);
                }
            );

            this.resetExpiryTimer();

            this.updateStatus('Config generated successfully', 'success');

        } catch (error) {
            console.error('Failed to generate config:', error);
            this.updateStatus('Failed to generate config', 'error');
        }
    }

    async fetchLatestConfig() {
        const response = await fetch('https://raw.githubusercontent.com/cephasgm/chaguo-tanzania/main/configs/latest.json');
        if (!response.ok) throw new Error('Failed to fetch config');

        const baseConfig = await response.json();

        return {
            ...baseConfig,
            id: this.generateConfigId(),
            timestamp: Date.now(),
            expires: Date.now() + (24 * 60 * 60 * 1000),
            client: {
                version: '1.0.0',
                os: navigator.platform,
                language: this.language
            }
        };
    }

    generateConfigId() {
        return 'chg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    downloadQRCode() {
        const canvas = document.querySelector('#qrcode canvas');
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = `chaguo-config-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    async copyConfig() {
        try {
            await navigator.clipboard.writeText(document.getElementById('config-text').value);
            this.showToast('Configuration copied to clipboard!', 'success');
        } catch (error) {
            this.showToast('Failed to copy. Please select and copy manually.', 'error');
        }
    }

    downloadConfig() {
        const config = document.getElementById('config-text').value;
        const blob = new Blob([config], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.download = `chaguo-config-${Date.now()}.json`;
        link.href = url;
        link.click();

        URL.revokeObjectURL(url);
    }

    resetExpiryTimer() {
        if (this.expiryTimer) clearInterval(this.expiryTimer);

        let timeLeft = 24 * 60 * 60;

        this.expiryTimer = setInterval(() => {
            timeLeft--;

            const hours = Math.floor(timeLeft / 3600);
            const minutes = Math.floor((timeLeft % 3600) / 60);
            const seconds = timeLeft % 60;

            document.getElementById('expiry-time').textContent =
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            if (timeLeft <= 0) {
                clearInterval(this.expiryTimer);
                this.showToast('Configuration expired. Please generate a new one.', 'warning');
            }
        }, 1000);
    }

    switchLanguage(lang) {
        this.language = lang;

        document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`lang-${lang}`).classList.add('active');

        const texts = this.translations[lang];
        Object.keys(texts).forEach(key => {
            const element = document.getElementById(key);
            if (element) element.textContent = texts[key];
        });

        localStorage.setItem('chaguo-language', lang);
    }

    setupLanguage() {
        const savedLang = localStorage.getItem('chaguo-language') || 'en';
        this.switchLanguage(savedLang);
    }

    async loadMethods() {
        try {
            const response = await fetch('https://raw.githubusercontent.com/cephasgm/chaguo-tanzania/main/configs/methods.json');
            const methods = await response.json();

            const container = document.getElementById('methods-list');
            container.innerHTML = '';

            methods.forEach(method => {
                const card = document.createElement('div');
                card.className = 'method-card';
                card.innerHTML = `
                    <h4>${method.name}</h4>
                    <p>${method.description}</p>
                    <div class="method-meta">
                        <span class="method-status ${method.status}">${method.status}</span>
                        <small>Last tested: ${method.lastTested}</small>
                    </div>
                `;
                container.appendChild(card);
            });
        } catch (error) {
            console.error('Failed to load methods:', error);
        }
    }

    async checkConnection() {
        const statusElement = document.getElementById('connection-status');
        const textElement = document.getElementById('status-text');
        const indicator = statusElement.querySelector('.status-indicator');

        try {
            await fetch('https://httpbin.org/get', {
                mode: 'no-cors',
                cache: 'no-store'
            });

            indicator.className = 'status-indicator connected';
            textElement.textContent = this.language === 'en' ? 'Connected to Internet' : 'Imeunganishwa kwa Intaneti';
            statusElement.classList.remove('disconnected');

        } catch (error) {
            indicator.className = 'status-indicator disconnected';
            textElement.textContent = this.language === 'en' ? 'No internet connection' : 'Hakuna muunganisho wa intaneti';
            statusElement.classList.add('disconnected');
        }
    }

    setupPWA() {
        let deferredPrompt;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;

            const installBtn = document.getElementById('install-pwa');
            if (installBtn) {
                installBtn.style.display = 'inline-block';

                installBtn.addEventListener('click', () => {
                    if (deferredPrompt) {
                        deferredPrompt.prompt();
                        deferredPrompt.userChoice.then(() => {
                            deferredPrompt = null;
                        });
                    }
                });
            }
        });
    }

    installPWA() {
        if (window.deferredPrompt) {
            window.deferredPrompt.prompt();
        }
    }

    async requestConfigViaSMS() {
        if (!('sms' in navigator)) {
            this.showToast('SMS not supported on this device', 'error');
            return;
        }

        try {
            await navigator.sms.send({
                number: '+255XXXXXXXXX',
                body: 'CHAGUO CONFIG REQUEST'
            });

            this.showToast('SMS request sent. You will receive config shortly.', 'success');
        } catch (error) {
            this.showToast('Failed to send SMS', 'error');
        }
    }

    async discoverMeshPeers() {
        this.showToast('Searching for nearby devices...', 'info');

        try {
            if ('bluetooth' in navigator) {
                const device = await navigator.bluetooth.requestDevice({
                    filters: [{ services: ['chaguo-mesh'] }]
                });

                this.showToast(`Found device: ${device.name}`, 'success');
            }

            const peer = new RTCPeerConnection();

        } catch (error) {
            this.showToast('No devices found nearby', 'warning');
        }
    }

    enableOfflineMode() {
        if ('caches' in window) {
            caches.open('chaguo-configs').then(cache => {
                cache.match('/configs/latest.json').then(response => {
                    if (response) {
                        response.json().then(config => {
                            this.currentConfig = config;
                            this.generateQRCode();
                            this.showToast('Using cached configuration', 'info');
                        });
                    } else {
                        this.showToast('No cached configuration found', 'warning');
                    }
                });
            });
        }
    }

    showToast(message, type = 'info') {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '12px 24px',
            background:
                type === 'success' ? '#4CAF50' :
                type === 'error' ? '#f44336' :
                type === 'warning' ? '#ff9800' : '#2196F3',
            color: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: '10000',
            animation: 'slideIn 0.3s ease'
        });

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    updateStatus(message, type) {
        const status = document.getElementById('status-text');
        status.textContent = message;

        const indicator = document.querySelector('.status-indicator');
        indicator.className = `status-indicator ${type}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.chaguoApp = new ChaguoApp();
});
