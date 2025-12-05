#!/bin/bash
echo "🔧 Applying final fixes..."

# 1. Fix QR Code library CDN
echo "1. Fixing QR Code library..."
sed -i '17s|.*|<script src="https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs@gh-pages/qrcode.min.js"></script>|' index.html

# 2. Create icon directories
echo "2. Creating icon directories..."
mkdir -p public/icons

# 3. Create SVG icons
echo "3. Creating SVG icons..."
cat > public/icons/icon-192x192.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192">
  <rect width="192" height="192" fill="#2E7D32"/>
  <text x="96" y="100" font-family="Arial" font-size="60" fill="white" text-anchor="middle">C</text>
</svg>
EOF

cat > public/icons/icon-512x512.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" fill="#2E7D32"/>
  <text x="256" y="280" font-family="Arial" font-size="200" fill="white" text-anchor="middle">C</text>
</svg>
EOF

# 4. Update manifest for SVG
echo "4. Updating manifest.json..."
cat > public/manifest.json << 'EOF'
{
  "name": "Chaguo Tanzania",
  "short_name": "Chaguo",
  "description": "Internet Freedom for Tanzania",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#2E7D32",
  "theme_color": "#2E7D32",
  "icons": [
    {
      "src": "icons/icon-192x192.svg",
      "sizes": "192x192",
      "type": "image/svg+xml"
    },
    {
      "src": "icons/icon-512x512.svg",
      "sizes": "512x512",
      "type": "image/svg+xml"
    }
  ]
}
EOF

# 5. Add favicon to index.html
echo "5. Adding favicon..."
if ! grep -q "favicon" index.html; then
  sed -i '10a\  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>">' index.html
fi

# 6. Update app.js to handle QR library loading better
echo "6. Updating app.js QR handling..."
cat > app.js << 'EOF'
// Chaguo App - Fixed version
class ChaguoApp {
    constructor() {
        this.init();
    }

    init() {
        console.log('Chaguo App Initializing...');
        this.loadQRLibrary().then(() => {
            this.bindEvents();
            this.generateQRCode();
            this.setupPWA();
            this.loadMethods();
            console.log('✅ App initialized successfully');
        }).catch(error => {
            console.log('⚠️ QR library failed, using fallback:', error);
            this.bindEvents();
            this.generateQRCode();
            this.setupPWA();
            this.loadMethods();
        });
    }

    loadQRLibrary() {
        return new Promise((resolve, reject) => {
            if (typeof QRCode !== 'undefined') {
                resolve();
                return;
            }
            
            // Load the library
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs@gh-pages/qrcode.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    bindEvents() {
        document.getElementById('generate-qr')?.addEventListener('click', () => this.generateQRCode());
        document.getElementById('download-qr')?.addEventListener('click', () => this.downloadQRCode());
        document.getElementById('copy-config')?.addEventListener('click', () => this.copyConfig());
        document.getElementById('download-config')?.addEventListener('click', () => this.downloadConfig());
    }

    generateQRCode() {
        try {
            const qrContainer = document.getElementById('qrcode');
            if (!qrContainer) return;
            
            qrContainer.innerHTML = '';
            
            // Generate config
            const config = {
                server: "server.kenya.chaguo.tz",
                port: 443,
                protocol: "v2ray-ws",
                userId: this.generateUUID(),
                timestamp: Date.now()
            };
            
            const configText = JSON.stringify(config, null, 2);
            document.getElementById('config-text').value = configText;
            
            // Try to generate QR code
            if (typeof QRCode !== 'undefined') {
                try {
                    new QRCode(qrContainer, {
                        text: configText,
                        width: 256,
                        height: 256,
                        colorDark: "#2E7D32",
                        colorLight: "#ffffff"
                    });
                    console.log('✅ QR Code generated with library');
                } catch (error) {
                    this.showFallbackQR(qrContainer, configText);
                }
            } else {
                this.showFallbackQR(qrContainer, configText);
            }
            
        } catch (error) {
            console.error('QR generation error:', error);
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
            <div style="text-align: center; padding: 20px; border: 2px dashed #ccc; border-radius: 10px;">
                <div style="font-size: 100px; color: #2E7D32;">📱</div>
                <p>Scan this placeholder</p>
                <p><small>Configuration is ready below</small></p>
            </div>
        `;
    }

    downloadQRCode() {
        alert('Download feature coming soon!');
    }

    async copyConfig() {
        const text = document.getElementById('config-text').value;
        try {
            await navigator.clipboard.writeText(text);
            alert('✅ Configuration copied!');
        } catch (err) {
            alert('📋 Please copy manually from the text box');
        }
    }

    downloadConfig() {
        const text = document.getElementById('config-text').value;
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chaguo-config.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    setupPWA() {
        // PWA setup code
    }

    loadMethods() {
        console.log('Methods loaded');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.chaguoApp = new ChaguoApp();
});
EOF

echo "✅ All fixes applied!"
echo ""
echo "Commit and push:"
echo "git add ."
echo 'git commit -m "Fix: QR library, icons, and favicon"'
echo "git push"
echo ""
echo "Wait 1-2 minutes, then visit:"
echo "https://cephasgm.github.io/chaguo-tanzania/"
