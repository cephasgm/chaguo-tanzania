const crypto = require('crypto');
const log = require('electron-log');

class TrafficObfuscator {
  constructor() {
    this.patterns = {
      'whatsapp': this.generateWhatsAppPattern.bind(this),
      'youtube': this.generateYouTubePattern.bind(this),
      'normal': this.generateNormalPattern.bind(this),
      'cdn': this.generateCDNPattern.bind(this),
      'random': this.generateRandomPattern.bind(this)
    };
    
    this.currentPattern = 'random';
    this.rotationInterval = null;
    this.active = false;
    
    this.init();
  }

  init() {
    log.info('Traffic obfuscator initialized');
    
    // Load saved pattern preference
    const savedPattern = this.loadPreference();
    if (savedPattern && this.patterns[savedPattern]) {
      this.currentPattern = savedPattern;
    }
  }

  start(pattern = 'auto', rotationMinutes = 5) {
    if (this.active) {
      log.warn('Obfuscator already active');
      return;
    }
    
    this.active = true;
    
    if (pattern === 'auto') {
      this.currentPattern = this.selectPatternForTime();
    } else if (this.patterns[pattern]) {
      this.currentPattern = pattern;
    }
    
    log.info(`Traffic obfuscation started with pattern: ${this.currentPattern}`);
    
    // Rotate patterns periodically
    if (rotationMinutes > 0) {
      this.startRotation(rotationMinutes);
    }
    
    // Apply initial pattern
    this.applyPattern(this.currentPattern);
  }

  stop() {
    this.active = false;
    
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }
    
    log.info('Traffic obfuscation stopped');
  }

  startRotation(minutes) {
    const interval = minutes * 60 * 1000;
    
    this.rotationInterval = setInterval(() => {
      this.rotatePattern();
    }, interval);
    
    log.info(`Pattern rotation started (every ${minutes} minutes)`);
  }

  rotatePattern() {
    const patterns = Object.keys(this.patterns);
    const currentIndex = patterns.indexOf(this.currentPattern);
    const nextIndex = (currentIndex + 1) % patterns.length;
    const nextPattern = patterns[nextIndex];
    
    log.info(`Rotating pattern from ${this.currentPattern} to ${nextPattern}`);
    
    this.currentPattern = nextPattern;
    this.applyPattern(nextPattern);
    
    // Save preference
    this.savePreference(nextPattern);
  }

  applyPattern(patternName) {
    if (!this.active) return;
    
    const pattern = this.patterns[patternName]();
    
    log.info(`Applying pattern: ${patternName}`, {
      headers: pattern.headers,
      timing: pattern.timing
    });
    
    // Apply pattern to current connection
    this.emit('pattern-changed', {
      pattern: patternName,
      config: pattern
    });
  }

  generateWhatsAppPattern() {
    return {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/json',
        'Origin': 'https://web.whatsapp.com',
        'Referer': 'https://web.whatsapp.com/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
      },
      timing: {
        minDelay: 100,
        maxDelay: 500,
        burstSize: 3,
        burstInterval: 2000
      },
      padding: {
        enabled: true,
        minSize: 16,
        maxSize: 64,
        pattern: 'random'
      }
    };
  }

  generateYouTubePattern() {
    return {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Range': 'bytes=0-',
        'Referer': 'https://www.youtube.com/',
        'Sec-Fetch-Dest': 'video',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site'
      },
      timing: {
        minDelay: 50,
        maxDelay: 200,
        burstSize: 10,
        burstInterval: 1000,
        streaming: true
      },
      padding: {
        enabled: true,
        minSize: 128,
        maxSize: 1024,
        pattern: 'video'
      }
    };
  }

  generateNormalPattern() {
    return {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timing: {
        minDelay: 500,
        maxDelay: 2000,
        burstSize: 1,
        burstInterval: 0
      },
      padding: {
        enabled: false
      }
    };
  }

  generateCDNPattern() {
    return {
      headers: {
        'User-Agent': 'Amazon CloudFront',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0'
      },
      timing: {
        minDelay: 10,
        maxDelay: 100,
        burstSize: 50,
        burstInterval: 100,
        parallel: true
      },
      padding: {
        enabled: true,
        fixedSize: 512,
        pattern: 'cdn'
      }
    };
  }

  generateRandomPattern() {
    const patterns = ['whatsapp', 'youtube', 'normal', 'cdn'];
    const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
    
    return this.patterns[randomPattern]();
  }

  selectPatternForTime() {
    const hour = new Date().getHours();
    
    if (hour >= 9 && hour <= 17) {
      // Business hours - mix of patterns
      const patterns = ['whatsapp', 'youtube', 'normal'];
      return patterns[Math.floor(Math.random() * patterns.length)];
    } else if (hour >= 18 && hour <= 23) {
      // Evening - YouTube streaming
      return 'youtube';
    } else {
      // Night - low traffic
      return 'normal';
    }
  }

  obfuscatePacket(packet, pattern = null) {
    if (!this.active) return packet;
    
    const currentPattern = pattern || this.currentPattern;
    const patternConfig = this.patterns[currentPattern]();
    
    // Add random padding
    if (patternConfig.padding.enabled) {
      packet = this.addPadding(packet, patternConfig.padding);
    }
    
    // Add timing jitter
    if (patternConfig.timing) {
      this.addTimingJitter(patternConfig.timing);
    }
    
    return packet;
  }

  addPadding(packet, paddingConfig) {
    let paddingSize;
    
    if (paddingConfig.fixedSize) {
      paddingSize = paddingConfig.fixedSize;
    } else {
      paddingSize = Math.floor(
        Math.random() * (paddingConfig.maxSize - paddingConfig.minSize + 1)
      ) + paddingConfig.minSize;
    }
    
    // Generate random padding
    const padding = crypto.randomBytes(paddingSize);
    
    // Add padding based on pattern
    switch (paddingConfig.pattern) {
      case 'video':
        // Video streaming pattern
        return Buffer.concat([packet, padding.slice(0, 256)]);
        
      case 'cdn':
        // CDN pattern - add at beginning
        return Buffer.concat([padding.slice(0, 128), packet]);
        
      case 'random':
      default:
        // Random placement
        const position = Math.random() > 0.5 ? 'before' : 'after';
        return position === 'before' ?
          Buffer.concat([padding, packet]) :
          Buffer.concat([packet, padding]);
    }
  }

  addTimingJitter(timingConfig) {
    if (!timingConfig.minDelay || !timingConfig.maxDelay) return;
    
    const delay = Math.floor(
      Math.random() * (timingConfig.maxDelay - timingConfig.minDelay + 1)
    ) + timingConfig.minDelay;
    
    // In real implementation, this would affect packet timing
    // For now, just log the intended delay
    if (delay > 1000) {
      log.debug(`Adding timing delay: ${delay}ms`);
    }
  }

  generateFakeHeaders(patternName) {
    const pattern = this.patterns[patternName]();
    const headers = { ...pattern.headers };
    
    // Add some randomness to headers
    if (headers['User-Agent']) {
      headers['User-Agent'] = this.randomizeUserAgent(headers['User-Agent']);
    }
    
    if (headers['X-Forwarded-For']) {
      headers['X-Forwarded-For'] = this.generateRandomIP();
    }
    
    return headers;
  }

  randomizeUserAgent(baseUA) {
    const versions = [
      '91.0.4472.124',
      '92.0.4515.107',
      '93.0.4577.63',
      '94.0.4606.61',
      '95.0.4638.54'
    ];
    
    const randomVersion = versions[Math.floor(Math.random() * versions.length)];
    return baseUA.replace(/\d+\.\d+\.\d+\.\d+/, randomVersion);
  }

  generateRandomIP() {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  loadPreference() {
    try {
      const Store = require('electron-store');
      const store = new Store();
      return store.get('obfuscationPattern', 'random');
    } catch (error) {
      log.error('Failed to load obfuscation preference:', error);
      return 'random';
    }
  }

  savePreference(pattern) {
    try {
      const Store = require('electron-store');
      const store = new Store();
      store.set('obfuscationPattern', pattern);
    } catch (error) {
      log.error('Failed to save obfuscation preference:', error);
    }
  }

  getStatus() {
    return {
      active: this.active,
      currentPattern: this.currentPattern,
      availablePatterns: Object.keys(this.patterns),
      rotationInterval: this.rotationInterval ? 'active' : 'inactive'
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

module.exports = TrafficObfuscator;
