const { app, BrowserWindow, ipcMain, Menu, Tray, nativeTheme, shell, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const Store = require('electron-store');
const notifier = require('node-notifier');

// Initialize store
const store = new Store({
  encryptionKey: 'chaguo-tanzania-secure-storage-v1'
});

// Set up logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

let mainWindow;
let tray = null;
let isQuitting = false;
let connectionManager = null;
let configManager = null;
let selfHealingManager = null;

// Enable sandbox for security
app.enableSandbox();

function createWindow() {
  // Create the browser window with security settings
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, '../preload/preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    frame: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
    show: false
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Check for updates
    autoUpdater.checkForUpdatesAndNotify();
    
    // Initialize managers
    initializeManagers();
  });

  // Handle window close
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
    return true;
  });

  // Create application menu
  createMenu();

  // Create tray icon
  createTray();

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function initializeManagers() {
  // Initialize managers
  const ConfigManager = require('./config-manager.js');
  const ConnectionManager = require('./connection-manager.js');
  const SelfHealingManager = require('./self-healing.js');
  const TrafficObfuscator = require('./traffic-obfuscator.js');
  const BlockDetector = require('./block-detector.js');
  const MeshNetwork = require('./mesh-network.js');
  const WireGuardManager = require('./wireguard-manager.js');

  configManager = new ConfigManager();
  connectionManager = new ConnectionManager(configManager);
  selfHealingManager = new SelfHealingManager(connectionManager);
  const trafficObfuscator = new TrafficObfuscator();
  const blockDetector = new BlockDetector();
  const meshNetwork = new MeshNetwork();
  const wireguardManager = new WireGuardManager();

  // Start monitoring
  selfHealingManager.startMonitoring();
  blockDetector.startDetection();

  // Send managers to renderer via preload
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('managers-initialized', {
      configManager: true,
      connectionManager: true,
      selfHealingManager: true
    });
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Connect',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('connect-vpn')
        },
        {
          label: 'Disconnect',
          accelerator: 'CmdOrCtrl+D',
          click: () => mainWindow.webContents.send('disconnect-vpn')
        },
        { type: 'separator' },
        {
          label: 'Import Config',
          click: () => mainWindow.webContents.send('import-config')
        },
        {
          label: 'Export Config',
          click: () => mainWindow.webContents.send('export-config')
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Protocols',
      submenu: [
        {
          label: 'V2Ray + WebSocket',
          type: 'checkbox',
          checked: true,
          click: (menuItem) => mainWindow.webContents.send('set-protocol', 'v2ray-ws')
        },
        {
          label: 'Shadowsocks + Obfs',
          type: 'checkbox',
          click: (menuItem) => mainWindow.webContents.send('set-protocol', 'shadowsocks')
        },
        {
          label: 'WireGuard',
          type: 'checkbox',
          click: (menuItem) => mainWindow.webContents.send('set-protocol', 'wireguard')
        },
        {
          label: 'Trojan',
          type: 'checkbox',
          click: (menuItem) => mainWindow.webContents.send('set-protocol', 'trojan')
        },
        { type: 'separator' },
        {
          label: 'Auto Select Best',
          click: () => mainWindow.webContents.send('auto-select-protocol')
        }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Network Test',
          click: () => mainWindow.webContents.send('run-network-test')
        },
        {
          label: 'Block Detection',
          click: () => mainWindow.webContents.send('detect-blocks')
        },
        {
          label: 'Traffic Obfuscation',
          submenu: [
            {
              label: 'Mimic WhatsApp',
              type: 'checkbox',
              click: (menuItem) => mainWindow.webContents.send('set-obfuscation', 'whatsapp')
            },
            {
              label: 'Mimic YouTube',
              type: 'checkbox',
              click: (menuItem) => mainWindow.webContents.send('set-obfuscation', 'youtube')
            },
            {
              label: 'Random Pattern',
              type: 'checkbox',
              checked: true,
              click: (menuItem) => mainWindow.webContents.send('set-obfuscation', 'random')
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Mesh Network',
          submenu: [
            {
              label: 'Discover Peers',
              click: () => mainWindow.webContents.send('discover-peers')
            },
            {
              label: 'Share Config',
              click: () => mainWindow.webContents.send('share-config')
            },
            {
              label: 'Receive Config',
              click: () => mainWindow.webContents.send('receive-config')
            }
          ]
        }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Website',
          click: () => shell.openExternal('https://cephasgm.github.io/chaguo-tanzania')
        },
        {
          label: 'Telegram Bot',
          click: () => shell.openExternal('https://t.me/chaguo_tz_bot')
        },
        {
          label: 'GitHub Repository',
          click: () => shell.openExternal('https://github.com/cephasgm/chaguo-tanzania')
        },
        { type: 'separator' },
        {
          label: 'Report Issue',
          click: () => shell.openExternal('https://github.com/cephasgm/chaguo-tanzania/issues')
        },
        {
          label: 'About Chaguo',
          click: () => mainWindow.webContents.send('show-about')
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray() {
  tray = new Tray(path.join(__dirname, '../../build/icon-tray.png'));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Connect',
      click: () => {
        mainWindow.webContents.send('connect-vpn');
        showNotification('Chaguo', 'Connecting to VPN...');
      }
    },
    {
      label: 'Disconnect',
      click: () => {
        mainWindow.webContents.send('disconnect-vpn');
        showNotification('Chaguo', 'Disconnecting VPN...');
      }
    },
    { type: 'separator' },
    {
      label: 'Show App',
      click: () => mainWindow.show()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Chaguo - Internet Freedom Tool');
  tray.setContextMenu(contextMenu);

  // Double click to show window
  tray.on('double-click', () => mainWindow.show());
}

function showNotification(title, message) {
  notifier.notify({
    title: title,
    message: message,
    icon: path.join(__dirname, '../../build/icon.png'),
    sound: true
  });
}

// IPC Handlers
ipcMain.handle('get-config', async () => {
  if (!configManager) return null;
  return await configManager.getLatestConfig();
});

ipcMain.handle('connect-vpn', async (event, protocol, serverId) => {
  if (!connectionManager) return { success: false, error: 'Not initialized' };
  
  try {
    const result = await connectionManager.connect(protocol, serverId);
    
    if (result.success) {
      showNotification('Chaguo', 'Connected successfully!');
      
      // Update tray icon
      if (tray) {
        tray.setImage(path.join(__dirname, '../../build/icon-tray-connected.png'));
      }
    }
    
    return result;
  } catch (error) {
    log.error('Connection failed:', error);
    showNotification('Chaguo', `Connection failed: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('disconnect-vpn', async () => {
  if (!connectionManager) return { success: false };
  
  try {
    await connectionManager.disconnect();
    
    // Update tray icon
    if (tray) {
      tray.setImage(path.join(__dirname, '../../build/icon-tray.png'));
    }
    
    showNotification('Chaguo', 'Disconnected');
    return { success: true };
  } catch (error) {
    log.error('Disconnect failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('test-connection', async () => {
  if (!connectionManager) return { success: false };
  
  try {
    const result = await connectionManager.testConnection();
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-network-info', async () => {
  const si = require('systeminformation');
  
  try {
    const network = await si.networkInterfaces();
    const stats = await si.networkStats();
    
    return {
      interfaces: network,
      stats: stats[0] || {},
      online: navigator.onLine
    };
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('import-config-file', async (event) => {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (filePaths.length === 0) return null;

  try {
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
    
    // Validate config
    if (configManager && configManager.validateConfig(config)) {
      store.set('imported-config', config);
      return { success: true, config: config };
    } else {
      return { success: false, error: 'Invalid configuration file' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-config-file', async (event, config) => {
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: `chaguo-config-${Date.now()}.json`,
    filters: [
      { name: 'JSON Files', extensions: ['json'] }
    ]
  });

  if (!filePath) return { success: false, error: 'No file selected' };

  try {
    const fs = require('fs');
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  mainWindow.webContents.send('update-status', 'checking');
});

autoUpdater.on('update-available', (info) => {
  mainWindow.webContents.send('update-status', 'available', info);
  showNotification('Update Available', 'Downloading new version...');
});

autoUpdater.on('update-not-available', () => {
  mainWindow.webContents.send('update-status', 'not-available');
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow.webContents.send('update-status', 'downloaded', info);
  
  // Ask user to restart
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'A new version has been downloaded. Restart the application to apply the update.',
    buttons: ['Restart Now', 'Later']
  }).then(({ response }) => {
    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (error) => {
  log.error('Auto-updater error:', error);
  mainWindow.webContents.send('update-status', 'error', error.message);
});

// App event handlers
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  
  // Cleanup
  if (connectionManager) {
    connectionManager.disconnect();
  }
  
  if (selfHealingManager) {
    selfHealingManager.stopMonitoring();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
