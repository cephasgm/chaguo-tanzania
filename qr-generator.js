class QRGenerator {
    constructor() {
        this.canvas = null;
        this.currentQR = null;
        this.init();
    }

    init() {
        // Create canvas for QR
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'qr-canvas';
        this.canvas.style.display = 'none';
        document.body.appendChild(this.canvas);
    }

    async generate(data, options = {}) {
        const defaultOptions = {
            width: 256,
            height: 256,
            margin: 2,
            colorDark: '#2E7D32',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        };

        const config = { ...defaultOptions, ...options };
        const qrContainer = document.getElementById('qrcode');
        
        // Clear previous
        qrContainer.innerHTML = '';
        
        return new Promise((resolve, reject) => {
            QRCode.toCanvas(this.canvas, data, config, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                
                // Create image from canvas
                const img = new Image();
                img.src = this.canvas.toDataURL('image/png');
                img.alt = 'Chaguo Configuration QR Code';
                
                qrContainer.appendChild(img);
                this.currentQR = img.src;
                
                // Add click to enlarge
                img.style.cursor = 'pointer';
                img.addEventListener('click', () => this.enlargeQR(img.src));
                
                resolve(img.src);
            });
        });
    }

    enlargeQR(src) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            cursor: pointer;
        `;
        
        const enlargedImg = new Image();
        enlargedImg.src = src;
        enlargedImg.style.cssText = `
            max-width: 80%;
            max-height: 80%;
            border: 10px solid white;
            border-radius: 10px;
            box-shadow: 0 0 50px rgba(0,0,0,0.5);
        `;
        
        overlay.appendChild(enlargedImg);
        overlay.addEventListener('click', () => overlay.remove());
        
        document.body.appendChild(overlay);
    }

    download(filename = 'chaguo-config.png') {
        if (!this.currentQR) {
            throw new Error('No QR code generated');
        }
        
        const link = document.createElement('a');
        link.download = filename;
        link.href = this.currentQR;
        link.click();
    }

    share() {
        if (!navigator.share || !this.currentQR) return false;
        
        // Convert base64 to blob for sharing
        fetch(this.currentQR)
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], 'chaguo-config.png', { type: 'image/png' });
                
                navigator.share({
                    files: [file],
                    title: 'Chaguo Configuration',
                    text: 'Scan this QR code to configure Chaguo VPN'
                });
            });
        
        return true;
    }

    generateConfigQR(config) {
        // Add metadata
        const qrData = {
            ...config,
            _meta: {
                app: 'Chaguo',
                version: '1.0',
                timestamp: Date.now(),
                expires: Date.now() + (24 * 60 * 60 * 1000)
            }
        };
        
        return this.generate(JSON.stringify(qrData));
    }

    // Generate animated QR for large configs
    generateAnimatedQR(data, chunkSize = 500) {
        if (data.length <= chunkSize) {
            return this.generate(data);
        }
        
        // Split data into chunks
        const chunks = [];
        for (let i = 0; i < data.length; i += chunkSize) {
            chunks.push(data.substring(i, i + chunkSize));
        }
        
        // Generate QR for each chunk
        const qrContainer = document.getElementById('qrcode');
        qrContainer.innerHTML = '';
        
        const container = document.createElement('div');
        container.className = 'animated-qr';
        container.style.cssText = `
            position: relative;
            width: 256px;
            height: 256px;
            margin: 0 auto;
        `;
        
        chunks.forEach((chunk, index) => {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            canvas.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                opacity: 0;
                transition: opacity 0.5s ease;
            `;
            
            QRCode.toCanvas(canvas, JSON.stringify({
                chunk: chunk,
                index: index,
                total: chunks.length,
                id: this.generateChunkId()
            }), (error) => {
                if (error) console.error('QR chunk error:', error);
            });
            
            container.appendChild(canvas);
        });
        
        qrContainer.appendChild(container);
        
        // Animate through chunks
        let currentIndex = 0;
        const canvases = container.querySelectorAll('canvas');
        
        const animate = () => {
            canvases.forEach((canvas, i) => {
                canvas.style.opacity = i === currentIndex ? '1' : '0';
            });
            
            currentIndex = (currentIndex + 1) % chunks.length;
        };
        
        // Start animation
        animate();
        const interval = setInterval(animate, 2000);
        
        // Stop on hover
        container.addEventListener('mouseenter', () => clearInterval(interval));
        container.addEventListener('mouseleave', () => {
            interval = setInterval(animate, 2000);
        });
        
        return container;
    }

    generateChunkId() {
        return Math.random().toString(36).substring(2, 15);
    }
}

// Initialize
const qrGenerator = new QRGenerator();
