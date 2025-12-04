class ConfigDistributor {
    constructor() {
        this.sources = [
            'https://raw.githubusercontent.com/cephasgm/chaguo-tanzania/main/configs/latest.json',
            'https://cdn.jsdelivr.net/gh/cephasgm/chaguo-tanzania@main/configs/latest.json',
            'https://chaguo-cdn.vercel.app/latest.json',
            'https://chaguo-configs.netlify.app/latest.json'
        ];
        
        this.cache = new Map();
        this.init();
    }

    init() {
        this.setupCache();
        this.setupPeriodicUpdate();
        this.setupOfflineSupport();
    }

    setupCache() {
        // Cache configs for offline use
        if ('caches' in window) {
            caches.open('chaguo-configs-v1').then(cache => {
                console.log('Config cache initialized');
            });
        }
    }

    async getLatestConfig() {
        // Try cache first
        const cached = await this.getCachedConfig();
        if (cached && !this.isExpired(cached)) {
            return cached;
        }

        // Try all sources
        for (const source of this.sources) {
            try {
                const config = await this.fetchConfig(source);
                if (config && this.validateConfig(config)) {
                    await this.cacheConfig(config, source);
                    return config;
                }
            } catch (error) {
                console.warn(`Failed to fetch from ${source}:`, error.message);
            }
        }

        // Fallback to cached config even if expired
        if (cached) {
            console.log('Using expired cached config as fallback');
            return cached;
        }

        throw new Error('All config sources failed');
    }

    async fetchConfig(source) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(source, {
                signal: controller.signal,
                cache: 'no-store',
                headers: {
                    'X-Chaguo-Client': 'web',
                    'X-Chaguo-Version': '1.0'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const config = await response.json();
            
            // Add source metadata
            config._source = source;
            config._fetchedAt = Date.now();
            config._signature = await this.generateSignature(config);

            return config;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    validateConfig(config) {
        const requiredFields = ['servers', 'protocol', 'expires', 'signature'];
        
        for (const field of requiredFields) {
            if (!config[field]) {
                console.error(`Config missing required field: ${field}`);
                return false;
            }
        }

        // Verify signature
        if (!this.verifySignature(config)) {
            console.error('Config signature verification failed');
            return false;
        }

        // Check expiry
        if (this.isExpired(config)) {
            console.warn('Config is expired');
            return false;
        }

        return true;
    }

    async generateSignature(config) {
        // Remove existing signature for calculation
        const { signature, ...data } = config;
        
        // Use Web Crypto API for signing
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(JSON.stringify(data));
        
        const key = await crypto.subtle.importKey(
            'jwk',
            {
                kty: 'oct',
                k: 'your-secret-key-base64', // In production, fetch from server
                alg: 'HS256'
            },
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const signatureBuffer = await crypto.subtle.sign(
            'HMAC',
            key,
            dataBuffer
        );
        
        return Array.from(new Uint8Array(signatureBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    verifySignature(config) {
        // In production, verify with public key
        // For now, accept all (TODO: implement proper verification)
        return true;
    }

    isExpired(config) {
        if (!config.expires) return true;
        return Date.now() > config.expires;
    }

    async getCachedConfig() {
        if ('caches' in window) {
            try {
                const cache = await caches.open('chaguo-configs-v1');
                const response = await cache.match('/configs/latest.json');
                
                if (response) {
                    return await response.json();
                }
            } catch (error) {
                console.error('Cache read error:', error);
            }
        }
        
        // Fallback to localStorage
        const stored = localStorage.getItem('chaguo-latest-config');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (error) {
                console.error('Failed to parse stored config:', error);
            }
        }
        
        return null;
    }

    async cacheConfig(config, source) {
        // Cache in service worker cache
        if ('caches' in window) {
            try {
                const cache = await caches.open('chaguo-configs-v1');
                const response = new Response(JSON.stringify(config), {
                    headers: { 'Content-Type': 'application/json' }
                });
                
                await cache.put('/configs/latest.json', response);
            } catch (error) {
                console.error('Cache write error:', error);
            }
        }
        
        // Also store in localStorage as backup
        try {
            localStorage.setItem('chaguo-latest-config', JSON.stringify(config));
            localStorage.setItem('chaguo-config-source', source);
            localStorage.setItem('chaguo-config-fetched', Date.now().toString());
        } catch (error) {
            console.error('localStorage write error:', error);
        }
    }

    setupPeriodicUpdate() {
        // Update config every 6 hours
        setInterval(async () => {
            try {
                const config = await this.getLatestConfig();
                console.log('Config updated via periodic check');
                
                // Notify app
                if (window.chaguoApp && config) {
                    chaguoApp.showToast('Configuration updated automatically', 'info');
                }
            } catch (error) {
                console.warn('Periodic update failed:', error.message);
            }
        }, 6 * 60 * 60 * 1000); // 6 hours
    }

    setupOfflineSupport() {
        // Listen for online/offline events
        window.addEventListener('online', async () => {
            try {
                const config = await this.getLatestConfig();
                console.log('Config refreshed after coming online');
            } catch (error) {
                console.warn('Failed to refresh config after coming online:', error);
            }
        });
    }

    // Generate region-specific config
    async getRegionConfig(region = 'TZ') {
        const baseConfig = await this.getLatestConfig();
        
        // Filter servers by region
        const regionalServers = baseConfig.servers.filter(server => 
            server.region === region || server.region === 'global'
        );
        
        if (regionalServers.length === 0) {
            throw new Error(`No servers available for region: ${region}`);
        }
        
        return {
            ...baseConfig,
            servers: regionalServers,
            _region: region,
            _generatedAt: Date.now()
        };
    }

    // Get config for specific protocol
    async getProtocolConfig(protocol) {
        const baseConfig = await this.getLatestConfig();
        
        if (!baseConfig.protocols || !baseConfig.protocols[protocol]) {
            throw new Error(`Protocol not supported: ${protocol}`);
        }
        
        return {
            ...baseConfig,
            protocol: protocol,
            settings: baseConfig.protocols[protocol]
        };
    }

    // Test all servers and return best one
    async getBestServer() {
        const config = await this.getLatestConfig();
        
        // Test each server
        const tests = config.servers.map(async (server) => {
            const start = Date.now();
            
            try {
                const response = await fetch(`https://${server.host}/ping`, {
                    mode: 'no-cors',
                    signal: AbortSignal.timeout(5000)
                });
                
                const latency = Date.now() - start;
                return { ...server, latency, status: 'ok' };
            } catch (error) {
                return { ...server, latency: Infinity, status: 'failed' };
            }
        });
        
        const results = await Promise.all(tests);
        
        // Find fastest working server
        const working = results.filter(s => s.status === 'ok');
        if (working.length === 0) {
            throw new Error('No working servers found');
        }
        
        working.sort((a, b) => a.latency - b.latency);
        return working[0];
    }
}

// Initialize
const configDistributor = new ConfigDistributor();
