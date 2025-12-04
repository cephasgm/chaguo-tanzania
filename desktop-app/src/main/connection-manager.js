const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const log = require('electron-log');

class ConnectionManager {
  constructor(configManager) {
    this.configManager = configManager;
    this.currentConnection = null;
    this.processes = new Map();
    this.connections = new Map();
    this.metrics = {
      connections: 0,
      bytesTransferred: 0,
      errors: 0,
      reconnectAttempts: 0
    };
    
    this.init();
  }

  init() {
    this.setupCleanup();
    this.setupMetricsCollection();
  }

  async connect(protocol = 'auto', serverId = null) {
    log.info(`Connecting with protocol: ${protocol}, server: ${serverId}`);
    
    // Disconnect existing connection
    await this.disconnect();
    
    try {
      // Get config
      const config = await this.configManager.generateClientConfig(protocol, serverId);
      
      // Start connection based on protocol
      switch (config.connection.protocol) {
        case 'v2ray-ws':
          this.currentConnection = await this.connectV2Ray(config);
          break;
        case 'shadowsocks':
          this.currentConnection = await this.connectShadowsocks(config);
          break;
        case 'wireguard':
          this.currentConnection = await this.connectWireGuard(config);
          break;
        case 'trojan':
          this.currentConnection = await this.connectTrojan(config);
          break;
        default:
          throw new Error(`Unsupported protocol: ${config.connection.protocol}`);
      }
      
      // Setup tun2socks for full system proxy
      await this.setupTun2Socks();
      
      // Start metrics collection
      this.startMetricsCollection();
      
      log.info('Connection established successfully');
      return {
        success: true,
        connection: this.currentConnection,
        config: config
      };
      
    } catch (error) {
      log.error('Connection failed:', error);
      this.metrics.errors++;
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async connectV2Ray(config) {
    const v2rayConfig = this.generateV2RayConfig(config);
    const configPath = path.join(this.configManager.cacheDir, 'v2ray-config.json');
    
    fs.writeFileSync(configPath, JSON.stringify(v2rayConfig, null, 2));
    
    return new Promise((resolve, reject) => {
      const v2ray = spawn('v2ray', ['-config', configPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true
      });
      
      this.processes.set('v2ray', v2ray);
      
      v2ray.stdout.on('data', (data) => {
        log.info(`V2Ray: ${data.toString().trim()}`);
      });
      
      v2ray.stderr.on('data', (data) => {
        log.error(`V2Ray Error: ${data.toString().trim()}`);
      });
      
      v2ray.on('close', (code) => {
        log.warn(`V2Ray process exited with code ${code}`);
        this.processes.delete('v2ray');
      });
      
      // Wait for V2Ray to start
      setTimeout(() => {
        resolve({
          type: 'v2ray',
          pid: v2ray.pid,
          config: configPath,
          startedAt: Date.now()
        });
      }, 2000);
    });
  }

  generateV2RayConfig(config) {
    const server = config.connection.server;
    
    return {
      "inbounds": [{
        "port": 1080,
        "listen": "127.0.0.1",
        "protocol": "socks",
        "settings": {
          "auth": "noauth",
          "udp": true
        },
        "sniffing": {
          "enabled": true,
          "destOverride": ["http", "tls"]
        }
      }],
      "outbounds": [{
        "protocol": "vmess",
        "settings": {
          "vnext": [{
            "address": server.host,
            "port": server.port,
            "users": [{
              "id": server.userId,
              "alterId": server.alterId || 0,
              "security": server.security || "auto"
            }]
          }]
        },
        "streamSettings": {
          "network": "ws",
          "wsSettings": {
            "path": server.path || "/ws",
            "headers": {
              "Host": server.headers?.host || "www.cloudflare.com"
            }
          },
          "security": "tls",
          "tlsSettings": {
            "serverName": server.tls?.serverName || "www.cloudflare.com",
            "allowInsecure": false
          }
        }
      }],
      "routing": {
        "domainStrategy": "IPIfNonMatch",
        "rules": []
      }
    };
  }

  async connectShadowsocks(config) {
    const ssConfig = this.generateShadowsocksConfig(config);
    const configPath = path.join(this.configManager.cacheDir, 'ss-config.json');
    
    fs.writeFileSync(configPath, JSON.stringify(ssConfig, null, 2));
    
    return new Promise((resolve, reject) => {
      const ssLocal = spawn('ss-local', [
        '-c', configPath,
        '-u',
        '--fast-open'
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true
      });
      
      this.processes.set('shadowsocks', ssLocal);
      
      ssLocal.stdout.on('data', (data) => {
        log.info(`Shadowsocks: ${data.toString().trim()}`);
      });
      
      ssLocal.on('close', (code) => {
        log.warn(`Shadowsocks process exited with code ${code}`);
        this.processes.delete('shadowsocks');
      });
      
      setTimeout(() => {
        resolve({
          type: 'shadowsocks',
          pid: ssLocal.pid,
          config: configPath,
          startedAt: Date.now()
        });
      }, 2000);
    });
  }

  generateShadowsocksConfig(config) {
    const server = config.connection.server;
    
    return {
      "server": server.host,
      "server_port": server.port,
      "password": server.password,
      "method": server.method || "chacha20-ietf-poly1305",
      "mode": "tcp_and_udp",
      "local_address": "127.0.0.1",
      "local_port": 1081,
      "timeout": 300,
      "fast_open": true,
      "plugin": "obfs-local",
      "plugin_opts": `obfs=http;obfs-host=${server.obfsHost || 'www.bing.com'}`
    };
  }

  async connectWireGuard(config) {
    const wgConfig = this.generateWireGuardConfig(config);
    const configPath = path.join(this.configManager.cacheDir, 'wg0.conf');
    
    fs.writeFileSync(configPath, wgConfig);
    
    return new Promise((resolve, reject) => {
      const platform = process.platform;
      let command;
      
      if (platform === 'win32') {
        command = `wireguard.exe /installtunnelservice "${configPath}"`;
      } else if (platform === 'darwin') {
        command = `sudo wg-quick up ${configPath}`;
      } else if (platform === 'linux') {
        command = `sudo wg-quick up ${configPath}`;
      } else {
        reject(new Error(`Unsupported platform: ${platform}`));
        return;
      }
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`WireGuard failed: ${stderr}`));
          return;
        }
        
        resolve({
          type: 'wireguard',
          config: configPath,
          startedAt: Date.now()
        });
      });
    });
  }

  generateWireGuardConfig(config) {
    const server = config.connection.server;
    
    return `[Interface]
PrivateKey = ${server.privateKey}
Address = ${server.address}
DNS = 1.1.1.1, 8.8.8.8
MTU = 1420

[Peer]
PublicKey = ${server.peerPublicKey}
AllowedIPs = 0.0.0.0/0
Endpoint = ${server.host}:${server.port}
PersistentKeepalive = 25`;
  }

  async connectTrojan(config) {
    const trojanConfig = this.generateTrojanConfig(config);
    const configPath = path.join(this.configManager.cacheDir, 'trojan-config.json');
    
    fs.writeFileSync(configPath, JSON.stringify(trojanConfig, null, 2));
    
    return new Promise((resolve, reject) => {
      const trojan = spawn('trojan-go', ['-config', configPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true
      });
      
      this.processes.set('trojan', trojan);
      
      trojan.stdout.on('data', (data) => {
        log.info(`Trojan: ${data.toString().trim()}`);
      });
      
      trojan.on('close', (code) => {
        log.warn(`Trojan process exited with code ${code}`);
        this.processes.delete('trojan');
      });
      
      setTimeout(() => {
        resolve({
          type: 'trojan',
          pid: trojan.pid,
          config: configPath,
          startedAt: Date.now()
        });
      }, 2000);
    });
  }

  generateTrojanConfig(config) {
    const server = config.connection.server;
    
    return {
      "run_type": "client",
      "local_addr": "127.0.0.1",
      "local_port": 1082,
      "remote_addr": server.host,
      "remote_port": server.port,
      "password": [server.password],
      "ssl": {
        "verify": true,
        "verify_hostname": true,
        "sni": server.sni || "cloudflare.com"
      },
      "websocket": {
        "enabled": true,
        "path": server.path || "/ws",
        "host": server.hostname || "cloudflare.com"
      }
    };
  }

  async setupTun2Socks() {
    const platform = process.platform;
    let args;
    
    if (platform === 'win32') {
      args = [
        '-device', 'tun://chaguo',
        '-proxy', 'socks5://127.0.0.1:1080',
        '-interface', '0.0.0.0'
      ];
    } else {
      args = [
        '-tunAddr', '10.0.0.2',
        '-tunGw', '10.0.0.1',
        '-tunMask', '255.255.255.0',
        '-tunName', 'utun_chaguo',
        '-proxy', 'socks5://127.0.0.1:1080'
      ];
    }
    
    return new Promise((resolve, reject) => {
      const tun2socks = spawn('tun2socks', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true
      });
      
      this.processes.set('tun2socks', tun2socks);
      
      tun2socks.stdout.on('data', (data) => {
        log.info(`tun2socks: ${data.toString().trim()}`);
      });
      
      tun2socks.on('close', (code) => {
        log.warn(`tun2socks process exited with code ${code}`);
        this.processes.delete('tun2socks');
      });
      
      setTimeout(() => {
        resolve({
          type: 'tun2socks',
          pid: tun2socks.pid,
          startedAt: Date.now()
        });
      }, 3000);
    });
  }

  async disconnect() {
    log.info('Disconnecting...');
    
    // Kill all processes
    for (const [name, process] of this.processes) {
      try {
        if (process.pid) {
          process.kill('SIGTERM');
        }
      } catch (error) {
        log.error(`Failed to kill ${name}:`, error);
      }
    }
    
    this.processes.clear();
    this.currentConnection = null;
    
    // Clean up WireGuard interface
    if (process.platform !== 'win32') {
      try {
        exec('sudo wg-quick down wg0', (error) => {
          if (error) log.error('Failed to down WireGuard:', error);
        });
      } catch (error) {
        // Ignore errors
      }
    }
    
    log.info('Disconnected successfully');
    return { success: true };
  }

  async testConnection() {
    if (!this.currentConnection) {
      return { success: false, error: 'Not connected' };
    }
    
    try {
      const testUrl = 'https://api.ipify.org?format=json';
      const start = Date.now();
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'Chaguo-Test/1.0' },
        timeout: 10000
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const latency = Date.now() - start;
      
      return {
        success: true,
        ip: data.ip,
        latency: latency,
        protocol: this.currentConnection.type,
        connectedFor: Date.now() - this.currentConnection.startedAt
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        protocol: this.currentConnection?.type
      };
    }
  }

  startMetricsCollection() {
    // Collect metrics every 10 seconds
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 10000);
  }

  async collectMetrics() {
    try {
      // Get network stats
      const si = require('systeminformation');
      const networkStats = await si.networkStats();
      
      if (networkStats && networkStats.length > 0) {
        const stats = networkStats[0];
        this.metrics.bytesTransferred += stats.tx_bytes + stats.rx_bytes;
      }
      
      // Test connection quality
      const test = await this.testConnection();
      if (!test.success) {
        this.metrics.errors++;
      }
      
      // Store metrics
      this.storeMetrics();
      
    } catch (error) {
      log.error('Metrics collection failed:', error);
    }
  }

  storeMetrics() {
    const metricsHistory = this.configManager.store.get('metricsHistory') || [];
    
    metricsHistory.push({
      timestamp: Date.now(),
      ...this.metrics,
      connectionType: this.currentConnection?.type
    });
    
    // Keep only last 1000 entries
    if (metricsHistory.length > 1000) {
      metricsHistory.splice(0, metricsHistory.length - 1000);
    }
    
    this.configManager.store.set('metricsHistory', metricsHistory);
  }

  getMetrics() {
    return {
      ...this.metrics,
      currentConnection: this.currentConnection,
      activeProcesses: Array.from(this.processes.keys())
    };
  }

  setupCleanup() {
    // Cleanup on exit
    process.on('exit', () => this.disconnect());
    process.on('SIGINT', () => this.disconnect());
    process.on('SIGTERM', () => this.disconnect());
  }

  setupMetricsCollection() {
    // Log connection events
    this.connections.on('connect', (connection) => {
      this.metrics.connections++;
      log.info(`New connection: ${connection.type}`);
    });
    
    this.connections.on('disconnect', () => {
      log.info('Connection closed');
    });
  }

  async reconnect() {
    log.info('Attempting reconnection...');
    this.metrics.reconnectAttempts++;
    
    if (!this.currentConnection) {
      return { success: false, error: 'No current connection' };
    }
    
    await this.disconnect();
    
    try {
      const result = await this.connect(
        this.currentConnection.type,
        this.currentConnection.serverId
      );
      
      if (result.success) {
        log.info('Reconnection successful');
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      log.error('Reconnection failed:', error);
      return { success: false, error: error.message };
    }
  }

  getStatus() {
    return {
      connected: !!this.currentConnection,
      connection: this.currentConnection,
      processes: Array.from(this.processes.entries()).map(([name, proc]) => ({
        name,
        pid: proc.pid,
        alive: !proc.killed
      })),
      metrics: this.metrics
    };
  }
}

module.exports = ConnectionManager;
