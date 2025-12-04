const dns = require('dns');
const net = require('net');
const https = require('https');
const log = require('electron-log');

class BlockDetector {
  constructor() {
    this.detectionInterval = null;
    this.blockHistory = [];
    this.detectionMethods = [
      this.detectDNSBlocking.bind(this),
      this.detectTCPBlocking.bind(this),
      this.detectHTTPBlocking.bind(this),
      this.detectProtocolBlocking.bind(this),
      this.detectDPI.bind(this)
    ];
    
    this.testTargets = [
      { host: 'google.com', type: 'standard' },
      { host: 'cloudflare.com', type: 'cdn' },
      { host: '1.1.1.1', type: 'dns' },
      { host: '8.8.8.8', type: 'dns' },
      { host: 'api.ipify.org', type: 'api' }
    ];
    
    this.init();
  }

  init() {
    log.info('Block detector initialized');
  }

  startDetection(interval = 300000) { // 5 minutes
    if (this.detectionInterval) {
      log.warn('Detection already running');
      return;
    }
    
    log.info(`Starting block detection (interval: ${interval}ms)`);
    
    // Initial detection
    this.runDetection();
    
    // Schedule periodic detection
    this.detectionInterval = setInterval(() => {
      this.runDetection();
    }, interval);
  }

  stopDetection() {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
    
    log.info('Block detection stopped');
  }

  async runDetection() {
    log.info('Running block detection...');
    
    const results = await Promise.allSettled(
      this.detectionMethods.map(method => method())
    );
    
    const blocks = results
      .filter(r => r.status === 'fulfilled' && r.value.blocked)
      .map(r => r.value);
    
    if (blocks.length > 0) {
      log.warn(`Detected ${blocks.length} types of blocks`);
      this.handleBlocks(blocks);
    } else {
      log.info('No blocks detected');
    }
    
    return blocks;
  }

  async detectDNSBlocking() {
    const testPromises = this.testTargets.map(target => {
      return new Promise((resolve) => {
        dns.lookup(target.host, (err, address) => {
          resolve({
            target: target.host,
            type: 'dns',
            blocked: !!err,
            error: err?.message,
            address: address
          });
        });
      });
    });
    
    const results = await Promise.all(testPromises);
    const blocked = results.filter(r => r.blocked);
    
    return {
      type: 'dns-blocking',
      blocked: blocked.length > 0,
      details: results,
      confidence: blocked.length / results.length,
      timestamp: Date.now()
    };
  }

  async detectTCPBlocking() {
    const testPorts = [80, 443, 53, 853];
    const testHosts = ['1.1.1.1', '8.8.8.8', 'google.com'];
    
    const testPromises = [];
    
    for (const host of testHosts) {
      for (const port of testPorts) {
        testPromises.push(this.testTCPConnection(host, port));
      }
    }
    
    const results = await Promise.all(testPromises);
    const blocked = results.filter(r => r.blocked);
    
    return {
      type: 'tcp-blocking',
      blocked: blocked.length > 0,
      details: results,
      confidence: blocked.length / results.length,
      timestamp: Date.now()
    };
  }

  testTCPConnection(host, port) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = 5000;
      
      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve({
          host,
          port,
          blocked: false,
          latency: Date.now() - startTime
        });
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          host,
          port,
          blocked: true,
          error: 'timeout'
        });
      });
      
      socket.on('error', (err) => {
        socket.destroy();
        resolve({
          host,
          port,
          blocked: true,
          error: err.message
        });
      });
      
      const startTime = Date.now();
      socket.connect(port, host);
    });
  }

  async detectHTTPBlocking() {
    const testUrls = [
      'https://google.com',
      'https://cloudflare.com',
      'https://httpbin.org/get',
      'https://api.ipify.org'
    ];
    
    const testPromises = testUrls.map(url => this.testHTTPConnection(url));
    const results = await Promise.all(testPromises);
    const blocked = results.filter(r => r.blocked);
    
    return {
      type: 'http-blocking',
      blocked: blocked.length > 0,
      details: results,
      confidence: blocked.length / results.length,
      timestamp: Date.now()
    };
  }

  testHTTPConnection(url) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const req = https.get(url, { timeout: 10000 }, (res) => {
        const latency = Date.now() - startTime;
        req.destroy();
        
        resolve({
          url,
          blocked: false,
          statusCode: res.statusCode,
          latency,
          headers: res.headers
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({
          url,
          blocked: true,
          error: 'timeout'
        });
      });
      
      req.on('error', (err) => {
        req.destroy();
        resolve({
          url,
          blocked: true,
          error: err.message
        });
      });
      
      req.end();
    });
  }

  async detectProtocolBlocking() {
    // Test common VPN/proxy ports
    const testPorts = [
      { port: 443, protocol: 'HTTPS' },
      { port: 8443, protocol: 'Alt-HTTPS' },
      { port: 8080, protocol: 'HTTP-Proxy' },
      { port: 1080, protocol: 'SOCKS' },
      { port: 1194, protocol: 'OpenVPN' },
      { port: 51820, protocol: 'WireGuard' }
    ];
    
    const testHost = '1.1.1.1';
    const testPromises = testPorts.map(p => this.testProtocolPort(testHost, p.port, p.protocol));
    
    const results = await Promise.all(testPromises);
    const blocked = results.filter(r => r.blocked);
    
    return {
      type: 'protocol-blocking',
      blocked: blocked.length > 0,
      details: results,
      confidence: blocked.length / results.length,
      timestamp: Date.now()
    };
  }

  testProtocolPort(host, port, protocol) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = 3000;
      
      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        // Send protocol-specific probe
        let probe;
        
        switch (protocol) {
          case 'HTTPS':
            probe = 'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n';
            break;
          case 'SOCKS':
            probe = Buffer.from([0x05, 0x01, 0x00]); // SOCKS5 greeting
            break;
          default:
            probe = '';
        }
        
        if (probe) {
          socket.write(probe);
        }
        
        setTimeout(() => {
          socket.destroy();
          resolve({
            host,
            port,
            protocol,
            blocked: false,
            latency: Date.now() - startTime
          });
        }, 1000);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          host,
          port,
          protocol,
          blocked: true,
          error: 'timeout'
        });
      });
      
      socket.on('error', (err) => {
        socket.destroy();
        resolve({
          host,
          port,
          protocol,
          blocked: true,
          error: err.message
        });
      });
      
      const startTime = Date.now();
      socket.connect(port, host);
    });
  }

  async detectDPI() {
    // Send specially crafted packets to detect DPI
    const probes = [
      this.sendVPNProbe(),
      this.sendShadowsocksProbe(),
      this.sendWireGuardProbe(),
      this.sendTLSProbe()
    ];
    
    const results = await Promise.allSettled(probes);
    const responses = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
    
    const dpiDetected = this.analyzeDPIResponses(responses);
    
    return {
      type: 'dpi',
      blocked: dpiDetected,
      techniques: this.getDPITechniques(responses),
      confidence: this.calculateConfidence(responses),
      timestamp: Date.now()
    };
  }

  async sendVPNProbe() {
    // Send OpenVPN-like handshake
    const probe = Buffer.from([
      0x00, 0x2a, // OpenVPN magic
      0x01, 0x00, // Control channel
      0x00, 0x00, 0x00, 0x00 // Session ID
    ]);
    
    return this.sendProbeAndAnalyze('OpenVPN', probe, '1.1.1.1', 1194);
  }

  async sendShadowsocksProbe() {
    // Send Shadowsocks-like data
    const probe = Buffer.from([
      0x01, // SOCKS5 version
      0x03, // 3 methods
      0x00, 0x01, 0x02 // Methods: no auth, GSSAPI, username/password
    ]);
    
    return this.sendProbeAndAnalyze('Shadowsocks', probe, '1.1.1.1', 8388);
  }

  async sendWireGuardProbe() {
    // Send WireGuard-like handshake init
    const probe = Buffer.alloc(148);
    probe[0] = 0x01; // Handshake init
    
    return this.sendProbeAndAnalyze('WireGuard', probe, '1.1.1.1', 51820);
  }

  async sendTLSProbe() {
    // Send TLS Client Hello
    const probe = Buffer.from([
      0x16, // Content type: Handshake
      0x03, 0x01, // Version: TLS 1.0
      0x00, 0x2a, // Length
      0x01, // Handshake type: Client Hello
      0x00, 0x00, 0x26, // Length
      0x03, 0x03 // Client version: TLS 1.2
    ]);
    
    return this.sendProbeAndAnalyze('TLS', probe, '1.1.1.1', 443);
  }

  async sendProbeAndAnalyze(protocol, probe, host, port) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = 3000;
      let response = Buffer.alloc(0);
      
      socket.setTimeout(timeout);
      
      socket.on('data', (data) => {
        response = Buffer.concat([response, data]);
      });
      
      socket.on('connect', () => {
        socket.write(probe);
        
        setTimeout(() => {
          socket.destroy();
          
          resolve({
            protocol,
            host,
            port,
            response: response.toString('hex'),
            length: response.length,
            analysis: this.analyzeProbeResponse(response)
          });
        }, 1000);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          protocol,
          host,
          port,
          error: 'timeout',
          analysis: 'no-response'
        });
      });
      
      socket.on('error', (err) => {
        socket.destroy();
        resolve({
          protocol,
          host,
          port,
          error: err.message,
          analysis: 'error'
        });
      });
      
      socket.connect(port, host);
    });
  }

  analyzeProbeResponse(response) {
    if (response.length === 0) return 'no-response';
    
    // Check for RST (TCP reset) - indicates blocking
    if (response.length === 0) return 'possible-block';
    
    // Check for ICMP destination unreachable
    // This is more complex and requires raw sockets
    
    return 'unknown';
  }

  analyzeDPIResponses(responses) {
    // Look for patterns indicating DPI
    const patterns = [
      'tcp-reset',
      'icmp-unreachable',
      'specific-error'
    ];
    
    for (const response of responses) {
      if (patterns.some(p => response.analysis?.includes(p))) {
        return true;
      }
    }
    
    return false;
  }

  getDPITechniques(responses) {
    const techniques = new Set();
    
    responses.forEach(response => {
      if (response.analysis === 'tcp-reset') {
        techniques.add('TCP Reset Injection');
      } else if (response.analysis === 'icmp-unreachable') {
        techniques.add('ICMP Blocking');
      } else if (response.error?.includes('ECONNREFUSED')) {
        techniques.add('Port Blocking');
      }
    });
    
    return Array.from(techniques);
  }

  calculateConfidence(responses) {
    if (responses.length === 0) return 0;
    
    const suspicious = responses.filter(r => 
      r.analysis === 'tcp-reset' || 
      r.analysis === 'icmp-unreachable' ||
      r.error?.includes('ECONNREFUSED')
    );
    
    return suspicious.length / responses.length;
  }

  handleBlocks(blocks) {
    // Store in history
    blocks.forEach(block => {
      this.blockHistory.push({
        ...block,
        detectedAt: Date.now()
      });
    });
    
    // Keep only last 100 entries
    if (this.blockHistory.length > 100) {
      this.blockHistory = this.blockHistory.slice(-100);
    }
    
    // Emit event
    this.emit('blocks-detected', blocks);
    
    // Log details
    log.warn('Blocks detected:', blocks.map(b => ({
      type: b.type,
      confidence: b.confidence
    })));
  }

  getBlockHistory() {
    return this.blockHistory;
  }

  clearHistory() {
    this.blockHistory = [];
    log.info('Block history cleared');
  }

  getDetectionStatus() {
    return {
      isRunning: !!this.detectionInterval,
      lastDetection: this.blockHistory[this.blockHistory.length - 1]?.detectedAt || null,
      totalDetections: this.blockHistory.length,
      recentBlocks: this.blockHistory.filter(b => 
        Date.now() - b.detectedAt < 3600000 // Last hour
      ).length
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

module.exports = BlockDetector;
