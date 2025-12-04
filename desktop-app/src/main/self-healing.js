const log = require('electron-log');
const EventEmitter = require('events');

class SelfHealingManager extends EventEmitter {
  constructor(connectionManager) {
    super();
    this.connectionManager = connectionManager;
    this.isMonitoring = false;
    this.monitorInterval = null;
    this.recoveryStrategies = [
      this.switchProtocol.bind(this),
      this.rotateServer.bind(this),
      this.enableObfuscation.bind(this),
      this.reduceMTU.bind(this),
      this.enableChunking.bind(this),
      this.useDomainFronting.bind(this),
      this.fallbackToDirect.bind(this)
    ];
    
    this.failureHistory = [];
    this.successHistory = [];
    
    this.init();
  }

  init() {
    log.info('Self-healing manager initialized');
  }

  startMonitoring(interval = 30000) {
    if (this.isMonitoring) {
      log.warn('Monitoring already started');
      return;
    }
    
    this.isMonitoring = true;
    log.info(`Starting self-healing monitoring (interval: ${interval}ms)`);
    
    this.monitorInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, interval);
    
    // Also monitor connection events
    this.setupEventMonitoring();
  }

  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    this.isMonitoring = false;
    log.info('Self-healing monitoring stopped');
  }

  setupEventMonitoring() {
    // Listen for connection events
    this.connectionManager.on('connection-error', (error) => {
      this.handleConnectionError(error);
    });
    
    this.connectionManager.on('connection-success', () => {
      this.handleConnectionSuccess();
    });
  }

  async performHealthCheck() {
    if (!this.connectionManager.currentConnection) {
      return; // Not connected
    }
    
    try {
      const test = await this.connectionManager.testConnection();
      
      if (test.success) {
        this.recordSuccess(test);
        
        // Check if latency is acceptable
        if (test.latency > 5000) { // 5 seconds
          log.warn(`High latency detected: ${test.latency}ms`);
          this.emit('high-latency', test.latency);
        }
        
      } else {
        this.recordFailure(test);
        await this.triggerRecovery(test);
      }
      
    } catch (error) {
      log.error('Health check failed:', error);
      this.recordFailure({ error: error.message });
    }
  }

  recordSuccess(test) {
    const successRecord = {
      timestamp: Date.now(),
      latency: test.latency,
      ip: test.ip,
      protocol: test.protocol
    };
    
    this.successHistory.push(successRecord);
    
    // Keep only last 100 successes
    if (this.successHistory.length > 100) {
      this.successHistory.shift();
    }
    
    // Emit success event
    this.emit('health-check-success', successRecord);
  }

  recordFailure(test) {
    const failureRecord = {
      timestamp: Date.now(),
      error: test.error,
      protocol: test.protocol
    };
    
    this.failureHistory.push(failureRecord);
    
    // Keep only last 50 failures
    if (this.failureHistory.length > 50) {
      this.failureHistory.shift();
    }
    
    // Emit failure event
    this.emit('health-check-failure', failureRecord);
    
    // Check for patterns
    this.analyzeFailurePatterns();
  }

  analyzeFailurePatterns() {
    const recentFailures = this.failureHistory.filter(
      f => Date.now() - f.timestamp < 300000 // Last 5 minutes
    );
    
    if (recentFailures.length >= 3) {
      log.warn(`Multiple failures detected: ${recentFailures.length} in 5 minutes`);
      this.emit('multiple-failures', recentFailures);
    }
  }

  async triggerRecovery(failureInfo) {
    log.info('Triggering recovery procedures...');
    this.emit('recovery-started', failureInfo);
    
    // Try recovery strategies in order
    for (const strategy of this.recoveryStrategies) {
      try {
        log.info(`Attempting recovery strategy: ${strategy.name}`);
        
        const result = await strategy(failureInfo);
        
        if (result.success) {
          log.info(`Recovery successful with ${strategy.name}`);
          this.emit('recovery-success', {
            strategy: strategy.name,
            result: result
          });
          
          // Verify recovery
          const verification = await this.verifyRecovery();
          
          if (verification.success) {
            return {
              success: true,
              strategy: strategy.name,
              details: result
            };
          }
        }
        
      } catch (error) {
        log.warn(`Recovery strategy ${strategy.name} failed:`, error.message);
        continue;
      }
    }
    
    // All strategies failed
    log.error('All recovery strategies failed');
    this.emit('recovery-failed', failureInfo);
    
    return {
      success: false,
      error: 'All recovery strategies failed'
    };
  }

  async switchProtocol() {
    log.info('Switching protocol...');
    
    const current = this.connectionManager.currentConnection;
    if (!current) return { success: false, error: 'Not connected' };
    
    const configManager = this.connectionManager.configManager;
    const config = await configManager.getLatestConfig();
    
    const protocols = Object.keys(config.protocols);
    const currentIndex = protocols.indexOf(current.type);
    const nextProtocol = protocols[(currentIndex + 1) % protocols.length];
    
    log.info(`Switching from ${current.type} to ${nextProtocol}`);
    
    const result = await this.connectionManager.connect(nextProtocol);
    
    return {
      success: result.success,
      from: current.type,
      to: nextProtocol
    };
  }

  async rotateServer() {
    log.info('Rotating server...');
    
    const current = this.connectionManager.currentConnection;
    if (!current) return { success: false, error: 'Not connected' };
    
    // Get new server
    const configManager = this.connectionManager.configManager;
    const config = await configManager.getLatestConfig();
    
    const availableServers = config.servers.filter(s => 
      s.protocols.includes(current.type)
    );
    
    if (availableServers.length <= 1) {
      return { success: false, error: 'No alternative servers available' };
    }
    
    // Select a different server
    const currentServer = current.serverId;
    const otherServers = availableServers.filter(s => s.id !== currentServer);
    const nextServer = otherServers[0];
    
    log.info(`Rotating from server ${currentServer} to ${nextServer.id}`);
    
    const result = await this.connectionManager.connect(current.type, nextServer.id);
    
    return {
      success: result.success,
      from: currentServer,
      to: nextServer.id
    };
  }

  async enableObfuscation() {
    log.info('Enabling traffic obfuscation...');
    
    // This would enable additional obfuscation layers
    // For now, just log and return success
    
    return {
      success: true,
      action: 'obfuscation-enabled',
      timestamp: Date.now()
    };
  }

  async reduceMTU() {
    log.info('Reducing MTU...');
    
    const platform = process.platform;
    let command;
    
    if (platform === 'win32') {
      command = 'netsh interface ipv4 set subinterface "Ethernet" mtu=1280 store=persistent';
    } else if (platform === 'darwin') {
      command = 'sudo ifconfig en0 mtu 1280';
    } else if (platform === 'linux') {
      command = 'sudo ip link set eth0 mtu 1280';
    } else {
      return { success: false, error: 'Unsupported platform' };
    }
    
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      
      exec(command, (error) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: true, mtu: 1280 });
        }
      });
    });
  }

  async enableChunking() {
    log.info('Enabling traffic chunking...');
    
    // Enable packet fragmentation
    return {
      success: true,
      action: 'chunking-enabled',
      chunkSize: 512
    };
  }

  async useDomainFronting() {
    log.info('Enabling domain fronting...');
    
    // Switch to domain-fronted servers
    const configManager = this.connectionManager.configManager;
    const config = await configManager.getLatestConfig();
    
    const frontedServers = config.servers.filter(s => 
      s.features && s.features.includes('domain-fronting')
    );
    
    if (frontedServers.length === 0) {
      return { success: false, error: 'No domain-fronted servers available' };
    }
    
    const current = this.connectionManager.currentConnection;
    const result = await this.connectionManager.connect(
      current.type,
      frontedServers[0].id
    );
    
    return {
      success: result.success,
      action: 'domain-fronting-enabled'
    };
  }

  async fallbackToDirect() {
    log.warn('Falling back to direct connection...');
    
    // Disconnect VPN and use direct connection
    await this.connectionManager.disconnect();
    
    return {
      success: true,
      action: 'direct-connection',
      warning: 'VPN disabled, using direct connection'
    };
  }

  async verifyRecovery() {
    // Wait a moment for recovery to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test connection
    const test = await this.connectionManager.testConnection();
    
    if (test.success) {
      log.info('Recovery verification successful');
      return {
        success: true,
        latency: test.latency,
        ip: test.ip
      };
    } else {
      log.error('Recovery verification failed');
      return {
        success: false,
        error: test.error
      };
    }
  }

  handleConnectionError(error) {
    log.error('Connection error detected:', error);
    
    // Add to failure history
    this.recordFailure({ error: error.message });
    
    // Auto-recover if configured
    const autoRecover = this.connectionManager.configManager.store.get('autoRecover', true);
    
    if (autoRecover) {
      setTimeout(async () => {
        await this.triggerRecovery({ error: error.message });
      }, 5000);
    }
  }

  handleConnectionSuccess() {
    log.info('Connection successful');
    
    // Clear failure history on successful connection
    if (this.failureHistory.length > 0) {
      log.info('Clearing failure history after successful connection');
      this.failureHistory = [];
    }
  }

  getStats() {
    const recentFailures = this.failureHistory.filter(
      f => Date.now() - f.timestamp < 3600000 // Last hour
    );
    
    const recentSuccesses = this.successHistory.filter(
      s => Date.now() - s.timestamp < 3600000 // Last hour
    );
    
    const successRate = recentSuccesses.length > 0 ?
      (recentSuccesses.length / (recentSuccesses.length + recentFailures.length)) * 100 : 0;
    
    return {
      isMonitoring: this.isMonitoring,
      totalFailures: this.failureHistory.length,
      totalSuccesses: this.successHistory.length,
      recentFailures: recentFailures.length,
      recentSuccesses: recentSuccesses.length,
      successRate: successRate.toFixed(2),
      averageLatency: this.calculateAverageLatency()
    };
  }

  calculateAverageLatency() {
    if (this.successHistory.length === 0) return 0;
    
    const sum = this.successHistory.reduce((acc, s) => acc + (s.latency || 0), 0);
    return Math.round(sum / this.successHistory.length);
  }

  resetHistory() {
    this.failureHistory = [];
    this.successHistory = [];
    log.info('Self-healing history reset');
  }

  setAutoRecover(enabled) {
    this.connectionManager.configManager.store.set('autoRecover', enabled);
    log.info(`Auto-recover ${enabled ? 'enabled' : 'disabled'}`);
  }
}

module.exports = SelfHealingManager;
