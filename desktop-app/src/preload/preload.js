const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('chaguoAPI', {
  // Connection methods
  connect: (protocol, serverId) => 
    ipcRenderer.invoke('connect-vpn', protocol, serverId),
  
  disconnect: () => 
    ipcRenderer.invoke('disconnect-vpn'),
  
  testConnection: () => 
    ipcRenderer.invoke('test-connection'),
  
  // Config methods
  getConfig: () => 
    ipcRenderer.invoke('get-config'),
  
  importConfig: () => 
    ipcRenderer.invoke('import-config-file'),
  
  exportConfig: (config) => 
    ipcRenderer.invoke('export-config-file', config),
  
  // Network methods
  getNetworkInfo: () => 
    ipcRenderer.invoke('get-network-info'),
  
  // App methods
  showAbout: () => 
    ipcRenderer.send('show-about'),
  
  // Events
  onConfigUpdated: (callback) => 
    ipcRenderer.on('config-updated', (event, data) => callback(data)),
  
  onConnectionStatus: (callback) => 
    ipcRenderer.on('connection-status', (event, status) => callback(status)),
  
  onUpdateStatus: (callback) => 
    ipcRenderer.on('update-status', (event, status, info) => callback(status, info)),
  
  // Settings
  setProtocolPreference: (protocol, enabled) =>
    ipcRenderer.send('set-protocol-preference', protocol, enabled),
  
  setObfuscation: (pattern) =>
    ipcRenderer.send('set-obfuscation', pattern),
  
  // Mesh network
  discoverPeers: () =>
    ipcRenderer.send('discover-peers'),
  
  shareConfig: () =>
    ipcRenderer.send('share-config'),
  
  // Self-healing
  triggerRecovery: () =>
    ipcRenderer.send('trigger-recovery'),
  
  getBlockHistory: () =>
    ipcRenderer.invoke('get-block-history'),
  
  // WireGuard specific
  generateWireGuardKeys: () =>
    ipcRenderer.invoke('generate-wireguard-keys'),
  
  connectWireGuard: (config) =>
    ipcRenderer.invoke('connect-wireguard', config),
  
  // Logging
  log: (level, message, data) =>
    ipcRenderer.send('log-message', level, message, data),
  
  // Utils
  openExternal: (url) =>
    ipcRenderer.send('open-external', url),
  
  showNotification: (title, message) =>
    ipcRenderer.send('show-notification', title, message),
  
  // Quit app
  quitApp: () =>
    ipcRenderer.send('quit-app')
});

// Expose version info
contextBridge.exposeInMainWorld('appInfo', {
  version: process.env.npm_package_version || '1.0.0',
  platform: process.platform,
  arch: process.arch,
  nodeVersion: process.versions.node,
  chromeVersion: process.versions.chrome,
  electronVersion: process.versions.electron
});

// Expose safe Node.js modules
contextBridge.exposeInMainWorld('nodeModules', {
  crypto: {
    randomUUID: () => crypto.randomUUID()
  }
});
