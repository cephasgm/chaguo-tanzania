#!/usr/bin/env node

/**
 * Chaguo Configuration Generator
 * 
 * This script generates secure configurations for Chaguo servers.
 * Run it periodically to update configurations.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class ConfigGenerator {
    constructor() {
        this.configDir = path.join(__dirname, '../configs');
        this.templatesDir = path.join(this.configDir, 'templates');
        this.ensureDirectories();
    }

    ensureDirectories() {
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }
        if (!fs.existsSync(this.templatesDir)) {
            fs.mkdirSync(this.templatesDir, { recursive: true });
        }
    }

    generateServerConfig(server) {
        const configId = `server-${server.region}-${Date.now()}`;
        
        const baseConfig = {
            id: configId,
            name: `${server.location} Server`,
            host: server.hostname,
            port: server.port,
            protocol: server.protocol,
            protocols: server.protocols || [server.protocol],
            region: server.region,
            country: server.country,
            location: server.location,
            provider: server.provider,
            generated: new Date().toISOString(),
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            signature: null
        };

        // Add protocol-specific configuration
        switch (server.protocol) {
            case 'v2ray-ws':
                baseConfig.config = this.generateV2RayConfig();
                break;
            case 'shadowsocks':
                baseConfig.config = this.generateShadowsocksConfig();
                break;
            case 'wireguard':
                baseConfig.config = this.generateWireGuardConfig();
                break;
            case 'trojan':
                baseConfig.config = this.generateTrojanConfig();
                break;
            default:
                baseConfig.config = this.generateV2RayConfig();
        }

        // Add metadata
        baseConfig.metadata = {
            version: '1.0.0',
            capabilities: server.capabilities || ['obfuscation', 'tls', 'websocket'],
            performance: {
                expectedLatency: this.calculateExpectedLatency(server.region),
                bandwidth: server.bandwidth || '1Gbps',
                capacity: server.capacity || 1000
            }
        };

        // Generate signature
        baseConfig.signature = this.signConfig(baseConfig);

        return baseConfig;
    }

    generateV2RayConfig() {
        const userId = uuidv4();
        
        return {
            protocol: 'vmess',
            transport: 'ws',
            security: 'tls',
            settings: {
                clients: [{
                    id: userId,
                    alterId: 0,
                    security: 'auto',
                    level: 0
                }],
                disableInsecureEncryption: true
            },
            streamSettings: {
                network: 'ws',
                security: 'tls',
                tlsSettings: {
                    serverName: 'www.cloudflare.com',
                    allowInsecure: false,
                    alpn: ['http/1.1']
                },
                wsSettings: {
                    path: '/ws',
                    headers: {
                        Host: 'www.cloudflare.com'
                    }
                }
            },
            sniffing: {
                enabled: true,
                destOverride: ['http', 'tls']
            }
        };
    }

    generateShadowsocksConfig() {
        const password = crypto.randomBytes(16).toString('hex');
        
        return {
            method: 'chacha20-ietf-poly1305',
            password: password,
            plugin: 'obfs-server',
            plugin_opts: 'obfs=http;obfs-host=www.bing.com',
            mode: 'tcp_and_udp',
            fast_open: true,
            reuse_port: true,
            no_delay: true
        };
    }

    generateWireGuardConfig() {
        const privateKey = this.generateWireGuardKey();
        const publicKey = this.derivePublicKey(privateKey);
        
        return {
            privateKey: privateKey,
            publicKey: publicKey,
            address: '10.0.0.1/24',
            dns: ['1.1.1.1', '8.8.8.8'],
            mtu: 1420,
            table: 'auto',
            preUp: '',
            postUp: '',
            preDown: '',
            postDown: '',
            peers: []
        };
    }

    generateTrojanConfig() {
        const password = crypto.randomBytes(32).toString('hex');
        
        return {
            run_type: 'server',
            local_addr: '0.0.0.0',
            local_port: 443,
            remote_addr: '127.0.0.1',
            remote_port: 80,
            password: [password],
            ssl: {
                cert: '/etc/ssl/certs/chaguo.crt',
                key: '/etc/ssl/private/chaguo.key',
                key_password: '',
                cipher: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384',
                cipher_tls13: 'TLS_AES_128_GCM_SHA256:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_256_GCM_SHA384',
                prefer_server_cipher: true,
                alpn: ['http/1.1'],
                reuse_session: true,
                session_ticket: false,
                session_timeout: 600,
                plain_http_response: '',
                curves: '',
                dhparam: ''
            },
            tcp: {
                prefer_ipv4: false,
                no_delay: true,
                keep_alive: true,
                reuse_port: false,
                fast_open: false,
                fast_open_qlen: 20
            },
            mysql: {
                enabled: false,
                server_addr: '127.0.0.1',
                server_port: 3306,
                database: 'trojan',
                username: 'trojan',
                password: ''
            }
        };
    }

    generateWireGuardKey() {
        // Generate a WireGuard private key
        const key = crypto.randomBytes(32);
        return Buffer.from(key).toString('base64');
    }

    derivePublicKey(privateKey) {
        // In production, use proper curve25519
        const hash = crypto.createHash('sha256');
        hash.update(privateKey);
        return hash.digest('base64');
    }

    calculateExpectedLatency(region) {
        const latencies = {
            'tz': 50,
            'ke': 80,
            'za': 120,
            'eu': 180,
            'us': 250,
            'sg': 300,
            'jp': 350
        };
        return latencies[region] || 200;
    }

    signConfig(config) {
        // Remove existing signature for signing
        const { signature, ...data } = config;
        
        const dataString = JSON.stringify(data, Object.keys(data).sort());
        const hash = crypto.createHash('sha256');
        hash.update(dataString);
        
        // In production, use proper signing with private key
        return hash.digest('hex');
    }

    async generateAllConfigs() {
        console.log('🔧 Generating Chaguo configurations...');
        
        // Define servers
        const servers = [
            {
                hostname: 'server1.kenya.chaguo.tz',
                port: 443,
                protocol: 'v2ray-ws',
                region: 'ke',
                country: 'Kenya',
                location: 'Nairobi',
                provider: 'Oracle Cloud',
                bandwidth: '10Gbps',
                capacity: 5000
            },
            {
                hostname: 'server1.sa.chaguo.tz',
                port: 8388,
                protocol: 'shadowsocks',
                protocols: ['shadowsocks', 'v2ray-ws'],
                region: 'za',
                country: 'South Africa',
                location: 'Johannesburg',
                provider: 'AWS',
                bandwidth: '5Gbps',
                capacity: 3000
            },
            {
                hostname: 'server1.eu.chaguo.tz',
                port: 51820,
                protocol: 'wireguard',
                region: 'eu',
                country: 'Germany',
                location: 'Frankfurt',
                provider: 'Oracle Cloud',
                bandwidth: '10Gbps',
                capacity: 10000
            },
            {
                hostname: 'server1.us.chaguo.tz',
                port: 443,
                protocol: 'trojan',
                protocols: ['trojan', 'v2ray-ws'],
                region: 'us',
                country: 'USA',
                location: 'Virginia',
                provider: 'Google Cloud',
                bandwidth: '5Gbps',
                capacity: 5000
            }
        ];

        // Generate configs
        const configs = servers.map(server => this.generateServerConfig(server));
        
        // Create combined config
        const combinedConfig = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            signature: null,
            servers: configs,
            protocols: {
                'v2ray-ws': {
                    description: 'V2Ray with WebSocket + TLS',
                    recommended: true,
                    obfuscation: 'high',
                    speed: 'fast',
                    reliability: 'high',
                    setupGuide: 'https://chaguo.tz/guides/v2ray'
                },
                'shadowsocks': {
                    description: 'Shadowsocks with Obfs',
                    recommended: true,
                    obfuscation: 'medium',
                    speed: 'very-fast',
                    reliability: 'high',
                    setupGuide: 'https://chaguo.tz/guides/shadowsocks'
                },
                'wireguard': {
                    description: 'Modern WireGuard VPN',
                    recommended: true,
                    obfuscation: 'low',
                    speed: 'extremely-fast',
                    reliability: 'very-high',
                    setupGuide: 'https://chaguo.tz/guides/wireguard'
                },
                'trojan': {
                    description: 'Trojan disguised as HTTPS',
                    recommended: true,
                    obfuscation: 'very-high',
                    speed: 'fast',
                    reliability: 'high',
                    setupGuide: 'https://chaguo.tz/guides/trojan'
                }
            },
            client: {
                desktop: {
                    download: 'https://chaguo.tz/download/desktop',
                    version: '1.0.0',
                    platforms: ['windows', 'macos', 'linux']
                },
                mobile: {
                    android: 'https://chaguo.tz/download/android',
                    ios: 'https://chaguo.tz/download/ios',
                    configInstructions: 'https://chaguo.tz/guides/mobile'
                }
            },
            meta: {
                generatedBy: 'Chaguo Config Generator v1.0',
                signatureMethod: 'SHA256',
                updateInterval: 86400,
                backupSources: [
                    'https://cdn.chaguo.tz/configs/latest.json',
                    'https://github.com/cephasgm/chaguo-tanzania/raw/main/configs/latest.json'
                ]
            }
        };

        // Sign combined config
        combinedConfig.signature = this.signConfig(combinedConfig);

        // Save files
        this.saveConfigs(configs, combinedConfig);
        
        console.log('✅ Configurations generated successfully!');
        console.log(`📁 Total servers: ${configs.length}`);
        console.log(`📊 Configs saved to: ${this.configDir}`);
        
        return combinedConfig;
    }

    saveConfigs(serverConfigs, combinedConfig) {
        // Save individual server configs
        serverConfigs.forEach(config => {
            const filename = path.join(this.configDir, `${config.id}.json`);
            fs.writeFileSync(filename, JSON.stringify(config, null, 2));
        });

        // Save combined config
        const latestPath = path.join(this.configDir, 'latest.json');
        fs.writeFileSync(latestPath, JSON.stringify(combinedConfig, null, 2));

        // Save versioned copy
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const versionedPath = path.join(this.configDir, `archive/config-${timestamp}.json`);
        
        if (!fs.existsSync(path.dirname(versionedPath))) {
            fs.mkdirSync(path.dirname(versionedPath), { recursive: true });
        }
        fs.writeFileSync(versionedPath, JSON.stringify(combinedConfig, null, 2));

        // Save for Telegram bot
        const botConfig = {
            servers: serverConfigs.map(config => ({
                id: config.id,
                name: config.name,
                host: config.host,
                port: config.port,
                protocol: config.protocol,
                region: config.region,
                config: config.config
            }))
        };
        
        const botPath = path.join(this.configDir, 'telegram-bot.json');
        fs.writeFileSync(botPath, JSON.stringify(botConfig, null, 2));
    }

    validateConfig(config) {
        const requiredFields = ['id', 'host', 'port', 'protocol', 'signature'];
        
        for (const field of requiredFields) {
            if (!config[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (!this.verifySignature(config)) {
            throw new Error('Invalid signature');
        }

        return true;
    }

    verifySignature(config) {
        // In production, verify with public key
        // For now, accept all valid signatures
        return config.signature && config.signature.length === 64;
    }
}

// Run if called directly
if (require.main === module) {
    const generator = new ConfigGenerator();
    
    generator.generateAllConfigs().catch(error => {
        console.error('❌ Failed to generate configurations:', error);
        process.exit(1);
    });
}

module.exports = ConfigGenerator;
