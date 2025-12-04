const dgram = require('dgram');
const crypto = require('crypto');
const log = require('electron-log');

class MeshNetwork {
  constructor() {
    this.peers = new Map();
    this.discoveryInterval = null;
    this.advertiseInterval = null;
    this.configCache = new Map();
    this.localConfig = null;
    
    this.discoveryPort = 53535;
    this.dataPort = 53536;
    this.broadcastAddress = '255.255.255.255';
    
    this.nodeId = this.generateNodeId();
    this.peerKey = this.generatePeerKey();
    
    this.discoverySocket = null;
    this.dataSocket = null;
    
    this.init();
  }

  init() {
    log.info(`Mesh network initialized. Node ID: ${this.nodeId}`);
    
    // Generate local config identifier
    this.localConfig = {
      nodeId: this.nodeId,
      timestamp: Date.now(),
      version: '1.0'
    };
  }

  generateNodeId() {
    return 'node-' + crypto.randomBytes(8).toString('hex');
  }

  generatePeerKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  async startDiscovery() {
    log.info('Starting mesh network discovery...');
    
    try {
      // Create discovery socket
      this.discoverySocket = dgram.createSocket('udp4');
      
      this.discoverySocket.on('error', (err) => {
        log.error('Discovery socket error:', err);
        this.discoverySocket.close();
      });
      
      this.discoverySocket.on('message', (msg, rinfo) => {
        this.handleDiscoveryMessage(msg, rinfo);
      });
      
      this.discoverySocket.on('listening', () => {
        const address = this.discoverySocket.address();
        log.info(`Discovery socket listening on ${address.address}:${address.port}`);
        
        // Enable broadcast
        this.discoverySocket.setBroadcast(true);
        
        // Start advertising
        this.startAdvertising();
        
        // Start peer discovery
        this.startDiscoveryInterval();
      });
      
      // Bind to discovery port
      this.discoverySocket.bind(this.discoveryPort);
      
      // Create data socket for config sharing
      await this.createDataSocket();
      
    } catch (error) {
      log.error('Failed to start discovery:', error);
    }
  }

  async createDataSocket() {
    this.dataSocket = dgram.createSocket('udp4');
    
    this.dataSocket.on('error', (err) => {
      log.error('Data socket error:', err);
    });
    
    this.dataSocket.on('message', (msg, rinfo) => {
      this.handleDataMessage(msg, rinfo);
    });
    
    return new Promise((resolve, reject) => {
      this.dataSocket.bind(this.dataPort, () => {
        log.info(`Data socket listening on port ${this.dataPort}`);
        resolve();
      });
    });
  }

  startAdvertising() {
    // Advertise our presence every 30 seconds
    this.advertiseInterval = setInterval(() => {
      this.advertisePresence();
    }, 30000);
    
    // Initial advertisement
    this.advertisePresence();
  }

  advertisePresence() {
    if (!this.discoverySocket) return;
    
    const advertisement = this.createAdvertisement();
    const message = Buffer.from(JSON.stringify(advertisement));
    
    this.discoverySocket.send(
      message,
      0,
      message.length,
      this.discoveryPort,
      this.broadcastAddress,
      (err) => {
        if (err) log.error('Advertisement send error:', err);
      }
    );
  }

  createAdvertisement() {
    return {
      type: 'discovery',
      nodeId: this.nodeId,
      timestamp: Date.now(),
      capabilities: ['config-sharing', 'relay'],
      configCount: this.configCache.size,
      version: '1.0'
    };
  }

  startDiscoveryInterval() {
    // Actively search for peers every 60 seconds
    this.discoveryInterval = setInterval(() => {
      this.discoverPeers();
    }, 60000);
    
    // Initial discovery
    this.discoverPeers();
  }

  discoverPeers() {
    if (!this.discoverySocket) return;
    
    const discoveryMsg = {
      type: 'discover',
      nodeId: this.nodeId,
      timestamp: Date.now()
    };
    
    const message = Buffer.from(JSON.stringify(discoveryMsg));
    
    this.discoverySocket.send(
      message,
      0,
      message.length,
      this.discoveryPort,
      this.broadcastAddress,
      (err) => {
        if (err) log.error('Discovery send error:', err);
      }
    );
  }

  handleDiscoveryMessage(msg, rinfo) {
    try {
      const message = JSON.parse(msg.toString());
      
      if (message.type === 'discovery' || message.type === 'discover') {
        this.handlePeerAdvertisement(message, rinfo);
      }
      
    } catch (error) {
      log.error('Failed to parse discovery message:', error);
    }
  }

  handlePeerAdvertisement(message, rinfo) {
    const peerId = message.nodeId;
    
    if (peerId === this.nodeId) {
      return; // Ignore our own messages
    }
    
    const peerInfo = {
      id: peerId,
      address: rinfo.address,
      port: rinfo.port,
      lastSeen: Date.now(),
      capabilities: message.capabilities || [],
      configCount: message.configCount || 0,
      version: message.version || '1.0'
    };
    
    // Update or add peer
    this.peers.set(peerId, peerInfo);
    
    log.info(`Discovered peer: ${peerId} at ${rinfo.address}:${rinfo.port}`);
    
    // Emit peer discovered event
    this.emit('peer-discovered', peerInfo);
    
    // Request configs from peer if they have more
    if (message.configCount > this.configCache.size) {
      this.requestConfigsFromPeer(peerId);
    }
  }

  async requestConfigsFromPeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    
    const request = {
      type: 'config-request',
      nodeId: this.nodeId,
      requestId: crypto.randomBytes(8).toString('hex'),
      timestamp: Date.now(),
      count: this.configCache.size
    };
    
    await this.sendToPeer(peerId, request);
  }

  handleDataMessage(msg, rinfo) {
    try {
      const message = JSON.parse(msg.toString());
      
      switch (message.type) {
        case 'config-request':
          this.handleConfigRequest(message, rinfo);
          break;
        case 'config-response':
          this.handleConfigResponse(message, rinfo);
          break;
        case 'config-share':
          this.handleConfigShare(message, rinfo);
          break;
        case 'ping':
          this.handlePing(message, rinfo);
          break;
      }
      
    } catch (error) {
      log.error('Failed to parse data message:', error);
    }
  }

  async handleConfigRequest(message, rinfo) {
    const { nodeId, requestId } = message;
    
    // Prepare response with our configs
    const response = {
      type: 'config-response',
      nodeId: this.nodeId,
      requestId: requestId,
      timestamp: Date.now(),
      configs: Array.from(this.configCache.values()).slice(0, 10) // Send up to 10 configs
    };
    
    await this.sendToAddress(rinfo.address, rinfo.port, response);
  }

  handleConfigResponse(message, rinfo) {
    const { configs, requestId } = message;
    
    log.info(`Received ${configs.length} configs from ${rinfo.address}`);
    
    // Add configs to cache
    configs.forEach(config => {
      const configId = this.getConfigId(config);
      
      if (!this.configCache.has(configId)) {
        this.configCache.set(configId, {
          ...config,
          source: rinfo.address,
          receivedAt: Date.now()
        });
        
        // Emit config received event
        this.emit('config-received', config);
      }
    });
  }

  handleConfigShare(message, rinfo) {
    const { config, configId } = message;
    
    const existingConfig = this.configCache.get(configId);
    if (!existingConfig || config.timestamp > existingConfig.timestamp) {
      this.configCache.set(configId, {
        ...config,
        source: rinfo.address,
        receivedAt: Date.now()
      });
      
      log.info(`Received updated config ${configId} from ${rinfo.address}`);
      
      // Emit config updated event
      this.emit('config-updated', config);
      
      // Share with other peers (gossip protocol)
      this.gossipConfig(config, configId);
    }
  }

  async gossipConfig(config, configId) {
    // Share with 2 random peers
    const peers = Array.from(this.peers.values());
    const randomPeers = peers
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
    
    for (const peer of randomPeers) {
      await this.shareConfigWithPeer(peer.id, config, configId);
    }
  }

  getConfigId(config) {
    // Create unique ID for config
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(config));
    return hash.digest('hex').substring(0, 16);
  }

  async shareConfig(config) {
    const configId = this.getConfigId(config);
    
    // Store in cache
    this.configCache.set(configId, {
      ...config,
      source: 'local',
      storedAt: Date.now()
    });
    
    log.info(`Stored config ${configId} in mesh cache`);
    
    // Share with all peers
    const sharePromises = Array.from(this.peers.keys()).map(peerId =>
      this.shareConfigWithPeer(peerId, config, configId)
    );
    
    await Promise.allSettled(sharePromises);
    
    return configId;
  }

  async shareConfigWithPeer(peerId, config, configId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    
    const shareMessage = {
      type: 'config-share',
      nodeId: this.nodeId,
      configId: configId,
      config: config,
      timestamp: Date.now()
    };
    
    await this.sendToPeer(peerId, shareMessage);
  }

  async sendToPeer(peerId, message) {
    const peer = this.peers.get(peerId);
    if (!peer || !this.dataSocket) return;
    
    await this.sendToAddress(peer.address, peer.port, message);
  }

  async sendToAddress(address, port, message) {
    return new Promise((resolve, reject) => {
      const messageStr = JSON.stringify(message);
      const buffer = Buffer.from(messageStr);
      
      this.dataSocket.send(
        buffer,
        0,
        buffer.length,
        port,
        address,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  handlePing(message, rinfo) {
    // Respond to ping
    const pong = {
      type: 'pong',
      nodeId: this.nodeId,
      timestamp: Date.now()
    };
    
    this.sendToAddress(rinfo.address, rinfo.port, pong).catch(() => {
      // Ignore errors
    });
  }

  async getConfigsFromMesh() {
    // Request configs from all peers
    const requestPromises = Array.from(this.peers.keys()).map(peerId =>
      this.requestConfigsFromPeer(peerId)
    );
    
    await Promise.allSettled(requestPromises);
    
    // Return all configs
    return Array.from(this.configCache.values());
  }

  getCachedConfig(configId) {
    return this.configCache.get(configId);
  }

  getAllCachedConfigs() {
    return Array.from(this.configCache.values());
  }

  clearCache() {
    this.configCache.clear();
    log.info('Mesh config cache cleared');
  }

  getPeers() {
    return Array.from(this.peers.values());
  }

  getPeerCount() {
    return this.peers.size;
  }

  getConfigCount() {
    return this.configCache.size;
  }

  stop() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    
    if (this.advertiseInterval) {
      clearInterval(this.advertiseInterval);
      this.advertiseInterval = null;
    }
    
    if (this.discoverySocket) {
      this.discoverySocket.close();
      this.discoverySocket = null;
    }
    
    if (this.dataSocket) {
      this.dataSocket.close();
      this.dataSocket = null;
    }
    
    log.info('Mesh network stopped');
  }

  getStatus() {
    return {
      nodeId: this.nodeId,
      peers: this.getPeers(),
      peerCount: this.getPeerCount(),
      configCount: this.getConfigCount(),
      discoveryActive: !!this.discoveryInterval,
      advertisingActive: !!this.advertiseInterval
    };
  }

  // Event emitter methods
  on(event, listener) {
    if (!this.listeners) this.listeners = {};
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(listener);
  }

  emit(event, data) {
    if (!this.listeners || !this.listeners[event]) return;
    
    this.listeners[event].forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        log.error(`Event listener error for ${event}:`, error);
      }
    });
  }
}

module.exports = MeshNetwork;
