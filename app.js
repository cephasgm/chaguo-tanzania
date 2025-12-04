// Chaguo App - Main JavaScript
class ChaguoApp {
    constructor() {
        this.currentConfig = null;
        this.expiryTimer = null;
        this.init();
    }

    init() {
        console.log('Chaguo App Initializing...');
        this.bindEvents();
        this.generateQRCode();
        this.setupPWA();
        this.loadMethods();
    }

    bindEvents() {
        // QR Controls
        document.getElementById('generate-qr').addEventListener('click', () => this.generateQRCode());
        document.getElementById('download-qr').addEventListener('click', () => this.downloadQRCode());
        document.getElementById('copy-config').addEventListener('click', () => this.copyConfig());
        document.getElementById('download-config').addEventListener('click', () => this.downloadConfig());
        
        // Language Switcher
        document.getElementById('lang-en').addEventListener('click', () => this.switchLanguage('en'));
        document.getElementById('lang-sw').addEventListener('click', () => this.switchLanguage('sw'));
        
        // PWA Install
        const installBtn = document.getElementById('install-pwa');
        if (installBtn) {
            installBtn.addEventListener('click', () => this.installPWA());
        }
    }

    generateQRCode() {
        try {
            const qrContainer = document.getElementById('qrcode');
            qrContainer.innerHTML = '';
            
            // Generate config
            this.currentConfig = {
                server: "server1.kenya.chaguo.tz",
                port: 443,
                protocol: "v2ray-ws",
                userId: this.generateUUID(),
                alterId: 0,
                security: "auto",
                network: "ws",
                path: "/ws",
                host: "www.cloudflare.com",
                timestamp: Date.now(),
                expires: Date.now() + 86400000
            };
            
            // Display config text
            const configText = JSON.stringify(this.currentConfig, null, 2);
            document.getElementById('config-text').value = configText;
            
            // Generate QR Code
            if (typeof QRCode !== 'undefined') {
                new QRCode(qrContainer, {
                    text: configText,
                    width: 256,
                    height: 256,
                    colorDark: "#2E7D32",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
                console.log('QR Code generated successfully');
            } else {
                this.showFallbackQR(qrContainer, configText);
            }
            
            // Start expiry timer
            this.startExpiryTimer();
            
        } catch (error) {
            console.error('QR generation error:', error);
            this.showToast('Error generating QR code', 'error');
        }
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    showFallbackQR(container, configText) {
        container.innerHTML = `
            <div style="padding: 20px; background: #f5f5f5; border-radius: 10px; text-align: center;">
                <p>QR Code Preview:</p>
                <div style="width: 256px; height: 256px; margin: 0 auto; background: #e0e0e0; display: flex; align-items: center; justify-content: center;">
                    <span>QR Code Here</span>
                </div>
                <p style="margin-top: 10px; font-size: 12px; color: #666;">
                    Copy the configuration below manually
                </p>
            </div>
        `;
    }

    startExpiryTimer() {
        if (this.expiryTimer) clearInterval(this.expiryTimer);
        
        let timeLeft = 24 * 60 * 60; // 24 hours
        
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

    downloadQRCode() {
        const canvas = document.querySelector('#qrcode canvas');
        if (!canvas) {
            this.showToast('No QR code to download', 'error');
            return;
        }
        
        const link = document.createElement('a');
        link.download = `chaguo-config-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        this.showToast('QR Code downloaded', 'success');
    }

    async copyConfig() {
        const configText = document.getElementById('config-text').value;
        
        try {
            await navigator.clipboard.writeText(configText);
            this.showToast('Configuration copied to clipboard!', 'success');
        } catch (error) {
            console.error('Copy failed:', error);
            // Fallback: Select text
            document.getElementById('config-text').select();
            document.execCommand('copy');
            this.showToast('Configuration selected. Press Ctrl+C to copy.', 'info');
        }
    }

    downloadConfig() {
        const configText = document.getElementById('config-text').value;
        const blob = new Blob([configText], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.download = `chaguo-config-${Date.now()}.json`;
        link.href = url;
        link.click();
        
        URL.revokeObjectURL(url);
        this.showToast('Configuration downloaded', 'success');
    }

    switchLanguage(lang) {
        // Update active button
        document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`lang-${lang}`).classList.add('active');
        
        // Simple translation
        const translations = {
            en: {
                title: "Chaguo - Your Choice for Internet Freedom",
                subtitle: "Open-source tools to bypass internet restrictions in Tanzania"
            },
            sw: {
                title: "Chaguo - Chaguo Lako kwa Uhuru wa Intaneti",
                subtitle: "Zana za wazi kuzuia vikwazo vya intaneti Tanzania"
            }
        };
        
        if (translations[lang]) {
            document.getElementById('title').textContent = translations[lang].title;
            document.getElementById('subtitle').textContent = translations[lang].subtitle;
        }
    }

    setupPWA() {
        // Show install button if PWA is available
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            const installBtn = document.getElementById('install-pwa');
            if (installBtn) {
                installBtn.style.display = 'block';
                installBtn.addEventListener('click', () => {
                    e.prompt();
                    e.userChoice.then((choiceResult) => {
                        if (choiceResult.outcome === 'accepted') {
                            console.log('User accepted PWA install');
                        }
                        installBtn.style.display = 'none';
                    });
                });
            }
        });
    }

    installPWA() {
        // Triggered by install button
        if (window.deferredPrompt) {
            window.deferredPrompt.prompt();
        }
    }

    loadMethods() {
        // Already loaded in HTML
        console.log('Methods loaded');
    }

    showToast(message, type = 'info') {
        // Remove existing toasts
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
            background: type === 'success' ? '#4CAF50' : 
                       type === 'error' ? '#f44336' : 
                       type === 'warning' ? '#ff9800' : '#2196F3',
            color: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: '10000'
        });
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chaguoApp = new ChaguoApp();
});
