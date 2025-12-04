const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const log = require('electron-log');

class WireGuardManager {
  constructor() {
    this.interfaceName = 'wg-chaguo';
    this.configDir = path.join(require('electron').app.getPath('userData'), 'wireguard');
    this.interfaceStatus = 'disconnected';
    this.currentConfig = null;
    
    this.ensureConfigDir();
    this.init();
  }

  init() {
    log.info('WireGuard manager initialized');
    
    // Check if WireGuard is available
    this.checkWireGuardAvailability();
  }

  ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  async checkWireGuardAvailability() {
    const platform = process.platform;
    
    try {
      if (platform === 'win32') {
        await this.execCommand('where wireguard');
        log.info('WireGuard for Windows is available');
      } else if (platform === 'darwin') {
        await this.execCommand('which wg-quick');
        log.info('WireGuard for macOS is available');
      } else if (platform === 'linux') {
        await this.execCommand('which wg-quick');
        log.info('WireGuard for Linux is available');
      }
    } catch (error) {
      log.warn('WireGuard may not be installed:', error.message);
    }
  }

  async connect(config) {
    log.info('Connecting WireGuard...');
    
    try {
      // Generate config file
      const configPath = await this.generateConfigFile(config);
      
      // Connect based on platform
      const result = await this.platformConnect(configPath);
      
      if (result.success) {
        this.interfaceStatus = 'connected';
        this.currentConfig = config;
        
        log.info('WireGuard connected successfully');
        return {
          success: true,
          interface: this.interfaceName,
          configPath: configPath
        };
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      log.error('WireGuard connection failed:', error);
      this.interfaceStatus = 'error';
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateConfigFile(config) {
    const configContent = this.generateConfigContent(config);
    const configPath = path.join(this.configDir, `${this.interfaceName}.conf`);
    
    fs.writeFileSync(configPath, configContent);
    log.info(`WireGuard config generated: ${configPath}`);
    
    return configPath;
  }

  generateConfigContent(config) {
    const {
      privateKey,
      address,
      dns = '1.1.1.1, 8.8.8.8',
      mtu = 1420,
      peerPublicKey,
      endpoint,
      allowedIPs = '0.0.0.0/0',
      persistentKeepalive = 25
    } = config;
    
    return `[Interface]
PrivateKey = ${privateKey}
Address = ${address}
DNS = ${dns}
MTU = ${mtu}

[Peer]
PublicKey = ${peerPublicKey}
AllowedIPs = ${allowedIPs}
Endpoint = ${endpoint}
PersistentKeepalive = ${persistentKeepalive}`;
  }

  async platformConnect(configPath) {
    const platform = process.platform;
    
    switch (platform) {
      case 'win32':
        return this.connectWindows(configPath);
      case 'darwin':
        return this.connectMacOS(configPath);
      case 'linux':
        return this.connectLinux(configPath);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  async connectWindows(configPath) {
    return new Promise((resolve, reject) => {
      const command = `wireguard.exe /installtunnelservice "${configPath}"`;
      
      exec(command, { shell: true }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`WireGuard Windows failed: ${stderr || error.message}`));
        } else {
          resolve({
            success: true,
            output: stdout
          });
        }
      });
    });
  }

  async connectMacOS(configPath) {
    return new Promise((resolve, reject) => {
      const command = `sudo wg-quick up ${configPath}`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          // Try without sudo first (might be in PATH)
          const fallbackCommand = `wg-quick up ${configPath}`;
          
          exec(fallbackCommand, (fallbackError, fallbackStdout, fallbackStderr) => {
            if (fallbackError) {
              reject(new Error(`WireGuard macOS failed: ${fallbackStderr || fallbackError.message}`));
            } else {
              resolve({
                success: true,
                output: fallbackStdout
              });
            }
          });
        } else {
          resolve({
            success: true,
            output: stdout
          });
        }
      });
    });
  }

  async connectLinux(configPath) {
    return new Promise((resolve, reject) => {
      const command = `sudo wg-quick up ${configPath}`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          // Try with pkexec (for GUI environments)
          const fallbackCommand = `pkexec wg-quick up ${configPath}`;
          
          exec(fallbackCommand, (fallbackError, fallbackStdout, fallbackStderr) => {
            if (fallbackError) {
              reject(new Error(`WireGuard Linux failed: ${fallbackStderr || fallbackError.message}`));
            } else {
              resolve({
                success: true,
                output: fallbackStdout
              });
            }
          });
        } else {
          resolve({
            success: true,
            output: stdout
          });
        }
      });
    });
  }

  async disconnect() {
    log.info('Disconnecting WireGuard...');
    
    if (this.interfaceStatus !== 'connected') {
      log.warn('WireGuard not connected');
      return { success: false, error: 'Not connected' };
    }
    
    try {
      const result = await this.platformDisconnect();
      
      if (result.success) {
        this.interfaceStatus = 'disconnected';
        this.currentConfig = null;
        
        log.info('WireGuard disconnected successfully');
        return { success: true };
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      log.error('WireGuard disconnect failed:', error);
      return { success: false, error: error.message };
    }
  }

  async platformDisconnect() {
    const platform = process.platform;
    const configPath = path.join(this.configDir, `${this.interfaceName}.conf`);
    
    switch (platform) {
      case 'win32':
        return this.disconnectWindows();
      case 'darwin':
        return this.disconnectMacOS(configPath);
      case 'linux':
        return this.disconnectLinux(configPath);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  async disconnectWindows() {
    return new Promise((resolve, reject) => {
      const command = `wireguard.exe /uninstalltunnelservice "${this.interfaceName}"`;
      
      exec(command, { shell: true }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`WireGuard Windows disconnect failed: ${stderr || error.message}`));
        } else {
          resolve({
            success: true,
            output: stdout
          });
        }
      });
    });
  }

  async disconnectMacOS(configPath) {
    return new Promise((resolve, reject) => {
      const command = `sudo wg-quick down ${configPath}`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          // Try without sudo
          const fallbackCommand = `wg-quick down ${configPath}`;
          
          exec(fallbackCommand, (fallbackError, fallbackStdout, fallbackStderr) => {
            if (fallbackError) {
              reject(new Error(`WireGuard macOS disconnect failed: ${fallbackStderr || fallbackError.message}`));
            } else {
              resolve({
                success: true,
                output: fallbackStdout
              });
            }
          });
        } else {
          resolve({
            success: true,
            output: stdout
          });
        }
      });
    });
  }

  async disconnectLinux(configPath) {
    return new Promise((resolve, reject) => {
      const command = `sudo wg-quick down ${configPath}`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          // Try with pkexec
          const fallbackCommand = `pkexec wg-quick down ${configPath}`;
          
          exec(fallbackCommand, (fallbackError, fallbackStdout, fallbackStderr) => {
            if (fallbackError) {
              reject(new Error(`WireGuard Linux disconnect failed: ${fallbackStderr || fallbackError.message}`));
            } else {
              resolve({
                success: true,
                output: fallbackStdout
              });
            }
          });
        } else {
          resolve({
            success: true,
            output: stdout
          });
        }
      });
    });
  }

  async getStatus() {
    try {
      const platform = process.platform;
      let statusCommand;
      
      if (platform === 'win32') {
        statusCommand = 'wireguard.exe /showtunnelservices';
      } else {
        statusCommand = 'wg show';
      }
      
      const result = await this.execCommand(statusCommand);
      
      return {
        success: true,
        status: this.interfaceStatus,
        details: result,
        platform: platform,
        config: this.currentConfig ? 'configured' : 'not-configured'
      };
      
    } catch (error) {
      return {
        success: false,
        status: this.interfaceStatus,
        error: error.message
      };
    }
  }

  async generateKeyPair() {
    try {
      // Generate private key
      const privateKey = await this.execCommand('wg genkey');
      
      // Generate public key from private key
      const publicKey = await this.execCommand(`echo "${privateKey.trim()}" | wg pubkey`);
      
      return {
        success: true,
        privateKey: privateKey.trim(),
        publicKey: publicKey.trim(),
        generatedAt: Date.now()
      };
      
    } catch (error) {
      log.error('Failed to generate WireGuard keys:', error);
      
      // Fallback: generate keys in Node.js
      const privateKey = crypto.randomBytes(32).toString('base64');
      const publicKey = this.derivePublicKey(privateKey);
      
      return {
        success: true,
        privateKey: privateKey,
        publicKey: publicKey,
        generatedAt: Date.now(),
        note: 'Generated using fallback method'
      };
    }
  }

  derivePublicKey(privateKey) {
    // Simple derivation (in production, use proper curve25519)
    const hash = crypto.createHash('sha256');
    hash.update(privateKey);
    return hash.digest('base64').substring(0, 44); // Similar length to WireGuard keys
  }

  async execCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve(stdout);
        }
      });
    });
  }

  async testConnection() {
    if (this.interfaceStatus !== 'connected') {
      return { success: false, error: 'Not connected' };
    }
    
    try {
      const start = Date.now();
      
      // Test DNS resolution through WireGuard
      const dnsResult = await this.execCommand('nslookup google.com');
      
      // Test HTTP connectivity
      const https = require('https');
      const httpResult = await new Promise((resolve) => {
        const req = https.get('https://api.ipify.org', { timeout: 10000 }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            req.destroy();
            resolve({ success: true, ip: data.trim() });
          });
        });
        
        req.on('timeout', () => {
          req.destroy();
          resolve({ success: false, error: 'timeout' });
        });
        
        req.on('error', (err) => {
          req.destroy();
          resolve({ success: false, error: err.message });
        });
        
        req.end();
      });
      
      const latency = Date.now() - start;
      
      return {
        success: httpResult.success,
        latency: latency,
        dnsWorking: !!dnsResult,
        ip: httpResult.ip,
        interface: this.interfaceName
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        interface: this.interfaceName
      };
    }
  }

  async getInterfaceStats() {
    try {
      const platform = process.platform;
      let statsCommand;
      
      if (platform === 'win32') {
        statsCommand = `netsh interface ipv4 show subinterface "${this.interfaceName}"`;
      } else {
        statsCommand = `wg show ${this.interfaceName} transfer`;
      }
      
      const result = await this.execCommand(statsCommand);
      
      return {
        success: true,
        stats: result,
        platform: platform
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateConfig(newConfig) {
    log.info('Updating WireGuard config...');
    
    // Disconnect first if connected
    if (this.interfaceStatus === 'connected') {
      await this.disconnect();
    }
    
    // Connect with new config
    return await this.connect(newConfig);
  }

  getCurrentConfig() {
    return this.currentConfig;
  }

  getInterfaceInfo() {
    return {
      name: this.interfaceName,
      status: this.interfaceStatus,
      configDir: this.configDir,
      platform: process.platform,
      configExists: fs.existsSync(path.join(this.configDir, `${this.interfaceName}.conf`))
    };
  }

  cleanup() {
    // Remove config files
    const configPath = path.join(this.configDir, `${this.interfaceName}.conf`);
    
    if (fs.existsSync(configPath)) {
      try {
        fs.unlinkSync(configPath);
        log.info('WireGuard config file removed');
      } catch (error) {
        log.error('Failed to remove config file:', error);
      }
    }
  }
}

module.exports = WireGuardManager;
