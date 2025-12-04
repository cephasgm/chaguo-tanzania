# Chaguo Desktop App - How to Run

## Prerequisites

### 1. System Requirements
- **Operating System**: Windows 10/11, macOS 10.14+, or Linux (Ubuntu 18.04+, Fedora 30+, etc.)
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 500MB free space
- **Network**: Active internet connection

### 2. Required Software
- **Node.js** 16.x or higher
- **npm** 8.x or higher
- **Git** (for development)
- **WireGuard** (for WireGuard protocol support)

## Installation Methods

### Method 1: Download Pre-built Release (Recommended)

1. Go to the [Releases page](https://github.com/cephasgm/chaguo-tanzania/releases)
2. Download the installer for your operating system:
   - **Windows**: `Chaguo-Setup-1.0.0.exe`
   - **macOS**: `Chaguo-1.0.0.dmg`
   - **Linux**: `chaguo_1.0.0_amd64.deb` (Ubuntu/Debian) or `chaguo-1.0.0.x86_64.rpm` (Fedora/RHEL)

3. Run the installer:
   - **Windows**: Double-click the `.exe` file and follow the wizard
   - **macOS**: Open the `.dmg` file and drag Chaguo to Applications
   - **Linux**: 
     ```bash
     # For Debian/Ubuntu
     sudo dpkg -i chaguo_1.0.0_amd64.deb
     
     # For Fedora/RHEL
     sudo rpm -i chaguo-1.0.0.x86_64.rpm
     ```

### Method 2: Build from Source (Developers)

1. Clone the repository:
   ```bash
   git clone https://github.com/cephasgm/chaguo-tanzania.git
   cd chaguo-tanzania/desktop-app
Install dependencies:

bash
npm install
Run in development mode:

bash
npm run dev
Build for production:

bash
# Build for current platform
npm run build

# Build for specific platform
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
First-Time Setup
1. Initial Launch
When you first launch Chaguo, you'll see:

Welcome Screen - Brief introduction to Chaguo

Permission Requests:

Network access (required)

Notification permissions (optional)

Auto-start on login (optional)

2. Configuration
Get Latest Configs: Click "Check for Updates" to fetch latest server configurations

Select Protocol: Choose your preferred protocol (Auto-select is recommended)

Test Connection: Verify everything works before connecting

Running the App
Starting the App
Windows: Start Menu → Chaguo

macOS: Applications → Chaguo

Linux: Application Menu → Internet → Chaguo

System Tray
Chaguo runs in the system tray for quick access:

Right-click the tray icon for quick actions

Double-click to show/hide the main window

Color indicators:

🔴 Red: Disconnected

🟡 Yellow: Connecting

🟢 Green: Connected

Keyboard Shortcuts
Ctrl/Cmd + N: Connect

Ctrl/Cmd + D: Disconnect

Ctrl/Cmd + T: Test connection

Ctrl/Cmd + Q: Quit

F5: Refresh servers

Protocols Setup
V2Ray + WebSocket
Ensure port 443 is not blocked

Works best with Cloudflare domains

Recommended for high censorship areas

Shadowsocks
Requires obfs plugin

Fast and lightweight

Good for mobile devices

WireGuard
Windows: Install WireGuard from Microsoft Store

macOS: Install via Homebrew: brew install wireguard-tools

Linux: Install via package manager:

bash
# Ubuntu/Debian
sudo apt install wireguard

# Fedora/RHEL
sudo dnf install wireguard-tools
Trojan
Masquerades as HTTPS traffic

Excellent for bypassing DPI

Requires valid TLS certificate

Troubleshooting
Common Issues
1. "Failed to Connect"
Check firewall: Allow Chaguo through firewall

Try different protocol: Switch from V2Ray to Shadowsocks

Check network: Ensure you have internet access

2. "No Servers Available"
Update configs: Click "Check for Updates"

Check internet: Ensure you're online

Manual config: Import config from website

3. "WireGuard Not Working"
Install WireGuard: See Protocol Setup above

Check permissions: Run as administrator/root if needed

Alternative: Use V2Ray instead

4. "App Crashes on Startup"
Clear cache: Delete %APPDATA%/chaguo (Windows) or ~/Library/Application Support/chaguo (macOS)

Reinstall: Uninstall and reinstall the app

Check logs: See log files in app data directory

Log Files
Windows: %APPDATA%/chaguo/logs/main.log

macOS: ~/Library/Logs/chaguo/main.log

Linux: ~/.config/chaguo/logs/main.log

Debug Mode
Run with debug flag:

bash
# Windows
chaguo.exe --debug

# macOS/Linux
./chaguo --debug
Advanced Features
1. Mesh Networking
Enable mesh sharing to:

Share configs with nearby devices via Bluetooth

Create local mesh network

Works without internet

2. Self-Healing
Automatically:

Detects connection drops

Switches protocols

Rotates servers

Reconnects automatically

3. Traffic Obfuscation
Mimic traffic patterns:

WhatsApp Web

YouTube streaming

Normal HTTPS

CDN traffic

4. Block Detection
Automatically detects:

DNS blocking

Port blocking

DPI (Deep Packet Inspection)

Protocol blocking

Security Notes
Data Collection
Chaguo collects:

Connection success/failure rates (anonymous)

Protocol usage statistics (anonymous)

App crash reports (optional)

No personal data is collected.

Permissions Required
Network: To connect to VPN servers

System Tray: For background operation

Notifications: For connection alerts

Auto-start: Optional for auto-connect on boot

Safety Measures
No logs kept on servers

End-to-end encryption

Open source code

Regular security updates

Updating
Auto-Update
Chaguo checks for updates automatically:

Weekly checks

Background downloads

One-click installation

Manual Update
Download latest version from GitHub

Install over existing version

Settings are preserved

Uninstallation
Windows
Control Panel → Programs → Uninstall

Select Chaguo

Follow uninstaller

macOS
Drag Chaguo from Applications to Trash

Remove config files:

bash
rm -rf ~/Library/Application\ Support/chaguo
Linux
bash
# Debian/Ubuntu
sudo dpkg -r chaguo

# Fedora/RHEL
sudo rpm -e chaguo

# Remove config
rm -rf ~/.config/chaguo
Support
Getting Help
Documentation: https://cephasgm.github.io/chaguo-tanzania/

Telegram: @chaguo_tz_bot

GitHub Issues: https://github.com/cephasgm/chaguo-tanzania/issues

Email: contact@chaguo.tz

Reporting Issues
When reporting issues, include:

Operating system and version

Chaguo version

Steps to reproduce

Log files (if available)

Screenshots (if helpful)

Legal
Disclaimer
Chaguo is provided for:

Educational purposes

Research purposes

Bypassing unjust internet restrictions

Users are responsible for complying with local laws.

License
MIT License - See LICENSE file

Enjoy free and open internet access with Chaguo! 🌐✨

text

---

## **8. GITHUB WORKFLOWS**

### **`.github/workflows/deploy.yml`**
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v3

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v2
        with:
          path: '.'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v2
