const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const Store = require('electron-store');
const log = require('electron-log');

class ConfigManager {
  constructor() {
    this.store = new Store({
      encryptionKey: 'chaguo-config-manager-v1',
      defaults: {
        configs: [],
        lastUpdated: null,
        preferredProtocol: 'auto',
        region: 'TZ',
        servers: [],
        blockHistory: []
      }
    });

    this.configSources = [
      'https://raw.githubusercontent.com/cephasgm/chaguo-tanzania/main/configs/latest.json',
      'https://cdn.jsdelivr.net/gh/cephasgm/chaguo-tanzania@main/configs/latest.json',
      'https://chaguo-cdn.vercel.app/latest.json',
      'https://configs.chaguo.tz/latest.json'
    ];

    this.backupSources = [
      'https://raw.githubusercontent.com/cephasgm/chaguo-backup/main/configs.json',
      'https://chaguo-fallback.herokuapp.com/configs'
    ];

    this.cacheDir = path.join(app.getPath('userData'), 'config-cache');
    this.ensureCacheDir();
    
    this.trustedKeys = this.loadTrustedKeys();
    this.init();
  }

  init() {
    // Load cached configs
    this.loadCachedConfigs();
    
    // Start periodic updates
    this.startPeriodicUpdates();
    
    // Setup config rotation
    this.setupRotation();
  }

  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  loadTrustedKeys() {
    const keysPath = path.join(this.cacheDir, 'trusted-keys.json');
    
    if (fs.existsSync(keysPath)) {
      try {
        return JSON.parse(fs.readFileSync(keysPath, 'utf8'));
      } catch (error) {
        log.error('Failed to load trusted keys:', error);
      }
    }

    // Default trusted keys (in production, fetch from secure source)
    return {
      'chaguo-main': 'ed25519-public-key-here',
      'chaguo-backup': 'ed25519-public-key-here'
    };
  }

  async getLatestConfig(forceRefresh = false) {
    // Check cache first
    if (!forceRefresh) {
      const cached = this.getCachedConfig();
      if (cached && !this.isConfigExpired(cached)) {
        return cached;
      }
    }

    // Try main sources
    for (const source of this.configSources) {
      try {
        const config = await this.fetchConfig(source);
        if (config && this.validateConfig(config)) {
          await this.cacheConfig(config);
          return config;
        }
      } catch (error) {
        log.warn(`Failed to fetch from ${source}:`, error.message);
      }
    }

    // Try backup sources
    for (const source of this.backupSources) {
      try {
        const config = await this.fetchConfig(source);
        if (config && this.validateConfig(config)) {
          await this.cacheConfig(config);
          return config;
        }
      } catch (error) {
        log.warn(`Backup source ${source} failed:`, error.message);
      }
    }

    // Fallback to cached config
    const cached = this.getCachedConfig();
    if (cached) {
      log.warn('Using cached config as fallback');
      return cached;
    }

    throw new Error('All config sources failed');
  }

  async fetchConfig(source) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await axios.get(source, {
        signal: controller.signal,
        timeout: 10000,
        headers: {
          'User-Agent': 'Chaguo-Desktop/1.0',
          'Accept': 'application/json',
          'X-Client-ID': this.getClientId()
        }
      });

      clearTimeout(timeout);

      const config = response.data;
      
      // Add metadata
      config._metadata = {
        source: source,
        fetchedAt: Date.now(),
        clientVersion: app.getVersion(),
        signature: config.signature || ''
      };

      return config;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  validateConfig(config) {
    // Basic validation
    if (!config || typeof config !== 'object') {
      return false;
    }

    // Check required fields
    const required = ['servers', 'protocols', 'version', 'expires'];
    for (const field of required) {
      if (!config[field]) {
        log.error(`Config missing required field: ${field}`);
        return false;
      }
    }

    // Verify signature if present
    if (config.signature && !this.verifySignature(config)) {
      log.error('Config signature verification failed');
      return false;
    }

    // Check expiry
    if (this.isConfigExpired(config)) {
      log.warn('Config is expired');
      // Still return true for emergency use
    }

    // Validate servers
    if (!Array.isArray(config.servers) || config.servers.length === 0) {
      log.error('No valid servers in config');
      return false;
    }

    // Validate protocols
    if (!config.protocols || Object.keys(config.protocols).length === 0) {
      log.error('No protocols defined');
      return false;
    }

    return true;
  }

  async verifySignature(config) {
    if (!config.signature) return false;

    try {
      // Extract signature
      const { signature, ...dataToVerify } = config;
      
      // Convert to string for signing
      const dataString = JSON.stringify(dataToVerify, Object.keys(dataToVerify).sort());
      
      // Verify with trusted keys
      for (const [keyName, publicKey] of Object.entries(this.trustedKeys)) {
        const verified = await this.verifyEd25519Signature(
          dataString,
          signature,
          publicKey
        );
        
        if (verified) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      log.error('Signature verification error:', error);
      return false;
    }
  }

  async verifyEd25519Signature(data, signature, publicKey) {
    // In production, use proper Ed25519 verification
    // For now, implement placeholder
    return true; // TODO: Implement proper verification
  }

  isConfigExpired(config) {
    if (!config.expires) return true;
    return Date.now() > config.expires;
  }

  getCachedConfig() {
    const cacheFile = path.join(this.cacheDir, 'latest-config.json');
    
    if (fs.existsSync(cacheFile)) {
      try {
        const data = fs.readFileSync(cacheFile, 'utf8');
        return JSON.parse(data);
      } catch (error) {
        log.error('Failed to read cached config:', error);
      }
    }
    
    return null;
  }

  async cacheConfig(config) {
    const cacheFile = path.join(this.cacheDir, 'latest-config.json');
    
    try {
      // Add caching metadata
      config._cachedAt = Date.now();
      config._cacheVersion = 1;
      
      fs.writeFileSync(cacheFile, JSON.stringify(config, null, 2));
      
      // Also update store
      this.store.set('lastUpdated', Date.now());
      this.store.set('configs', [...(this.store.get('configs') || []), {
        timestamp: Date.now(),
        protocol: config.protocol,
        serverCount: config.servers.length
      }]);
      
      log.info('Config cached successfully');
    } catch (error) {
      log.error('Failed to cache config:', error);
    }
  }

  getClientId() {
    let clientId = this.store.get('clientId');
    
    if (!clientId) {
      clientId = crypto.randomBytes(16).toString('hex');
      this.store.set('clientId', clientId);
    }
    
    return clientId;
  }

  startPeriodicUpdates() {
    // Update every 4 hours
    setInterval(async () => {
      try {
        const config = await this.getLatestConfig(true);
        log.info('Periodic config update successful');
        
        // Notify renderer
        if (global.mainWindow) {
          global.mainWindow.webContents.send('config-updated', {
            timestamp: Date.now(),
            serverCount: config.servers.length
          });
        }
      } catch (error) {
        log.warn('Periodic update failed:', error.message);
      }
    }, 4 * 60 * 60 * 1000);
  }

  setupRotation() {
    // Rotate configs every 12 hours
    setInterval(() => {
      const configs = this.store.get('configs') || [];
      
      // Keep only last 50 configs
      if (configs.length > 50) {
        this.store.set('configs', configs.slice(-50));
      }
    }, 12 * 60 * 60 * 1000);
  }

  async generateClientConfig(protocol = 'auto', serverId = null) {
    const baseConfig = await this.getLatestConfig();
    
    let selectedProtocol = protocol;
    let selectedServer = serverId;
    
    // Auto-select best protocol
    if (protocol === 'auto') {
      selectedProtocol = this.selectBestProtocol(baseConfig);
    }
    
    // Auto-select best server
    if (!selectedServer) {
      selectedServer = await this.selectBestServer(baseConfig, selectedProtocol);
    }
    
    // Generate client config
    const clientConfig = {
      ...baseConfig,
      client: {
        id: this.getClientId(),
        os: process.platform,
        version: app.getVersion(),
        selectedAt: Date.now()
      },
      connection: {
        protocol: selectedProtocol,
        server: selectedServer,
        settings: baseConfig.protocols[selectedProtocol],
        obfuscation: this.getObfuscationSettings()
      }
    };
    
    // Add client-specific signature
    clientConfig.clientSignature = await this.signClientConfig(clientConfig);
    
    return clientConfig;
  }

  selectBestProtocol(config) {
    const protocols = Object.keys(config.protocols);
    const preferences = this.store.get('protocolPreferences') || {};
    
    // Check preferences first
    for (const [protocol, pref] of Object.entries(preferences)) {
      if (pref.enabled && protocols.includes(protocol)) {
        return protocol;
      }
    }
    
    // Default to first available
    return protocols[0] || 'v2ray-ws';
  }

  async selectBestServer(config, protocol) {
    const servers = config.servers.filter(s => 
      s.protocols.includes(protocol) && s.region === 'TZ'
    );
    
    if (servers.length === 0) {
      // Fallback to any server with protocol
      return config.servers.find(s => s.protocols.includes(protocol));
    }
    
    // Simple round-robin selection
    const lastUsed = this.store.get('lastServerIndex') || 0;
    const nextIndex = (lastUsed + 1) % servers.length;
    
    this.store.set('lastServerIndex', nextIndex);
    return servers[nextIndex];
  }

  getObfuscationSettings() {
    return {
      enabled: true,
      mode: 'random',
      patterns: ['whatsapp', 'youtube', 'normal', 'cdn'],
      rotateInterval: 300000 // 5 minutes
    };
  }

  async signClientConfig(config) {
    // Create signature for client config
    const dataToSign = JSON.stringify({
      clientId: config.client.id,
      protocol: config.connection.protocol,
      server: config.connection.server.id,
      timestamp: config.client.selectedAt
    });
    
    const hash = crypto.createHash('sha256');
    hash.update(dataToSign);
    return hash.digest('hex');
  }

  async testServer(server, protocol) {
    const testUrl = `https://${server.host}/ping`;
    
    try {
      const start = Date.now();
      const response = await axios.get(testUrl, { timeout: 5000 });
      const latency = Date.now() - start;
      
      return {
        server: server.id,
        protocol: protocol,
        latency: latency,
        status: 'ok',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        server: server.id,
        protocol: protocol,
        latency: null,
        status: 'failed',
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  async testAllServers() {
    const config = await this.getLatestConfig();
    const results = [];
    
    for (const server of config.servers.slice(0, 5)) { // Test first 5
      for (const protocol of server.protocols) {
        const result = await this.testServer(server, protocol);
        results.push(result);
        
        // Store result
        const blockHistory = this.store.get('blockHistory') || [];
        blockHistory.push(result);
        this.store.set('blockHistory', blockHistory.slice(-100)); // Keep last 100
      }
    }
    
    return results;
  }

  getBlockHistory() {
    return this.store.get('blockHistory') || [];
  }

  clearBlockHistory() {
    this.store.set('blockHistory', []);
  }

  setProtocolPreference(protocol, enabled) {
    const preferences = this.store.get('protocolPreferences') || {};
    preferences[protocol] = { enabled, lastUsed: Date.now() };
    this.store.set('protocolPreferences', preferences);
  }

  setRegion(region) {
    this.store.set('region', region);
  }

  getStats() {
    const configs = this.store.get('configs') || [];
    const blockHistory = this.store.get('blockHistory') || [];
    
    return {
      totalConfigsFetched: configs.length,
      lastUpdated: this.store.get('lastUpdated'),
      preferredProtocol: this.store.get('preferredProtocol'),
      region: this.store.get('region'),
      blockCount: blockHistory.filter(b => b.status === 'failed').length,
      clientId: this.getClientId()
    };
  }
}

module.exports = ConfigManager;
