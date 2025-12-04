🌐 Chaguo Tanzania - Internet Freedom Toolkit

[![GitHub License](https://img.shields.io/github/license/cephasgm/chaguo-tanzania)](https://github.com/cephasgm/chaguo-tanzania/blob/main/LICENSE)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fcephasgm.github.io%2Fchaguo-tanzania%2F)](https://cephasgm.github.io/chaguo-tanzania/)
[![Telegram Bot](https://img.shields.io/badge/Telegram-@chaguo__tz__bot-blue)](https://t.me/chaguo_tz_bot)
[![GitHub Stars](https://img.shields.io/github/stars/cephasgm/chaguo-tanzania)](https://github.com/cephasgm/chaguo-tanzania/stargazers)

**Chaguo** (Swahili for "Choice") is an open-source internet freedom toolkit designed specifically for Tanzania, where VPNs and other privacy tools are often blocked.

## 🚀 Features

### 🌐 Multi-Protocol Support
- **V2Ray with WebSocket + TLS** - Masquerades as normal HTTPS traffic
- **Shadowsocks with Obfs** - Lightweight proxy with traffic obfuscation
- **WireGuard** - Modern, fast VPN protocol
- **Trojan** - Disguises as legitimate HTTPS traffic
- **Auto Protocol Switching** - Automatically selects best working protocol

### 🔧 Advanced Features
- **Traffic Obfuscation** - Mimics WhatsApp, YouTube, and normal HTTPS patterns
- **Self-Healing Network** - Automatic recovery when blocks are detected
- **Mesh Networking** - Bluetooth/Wi-Fi Direct config sharing (offline capable)
- **Real-time Block Detection** - Identifies DNS blocking, DPI, and port blocking
- **Domain Fronting** - Uses Cloudflare/Google domains to bypass restrictions
- **Config Attestation** - Cryptographic verification of configurations

### 📱 Cross-Platform
- **Web App** (PWA) - https://cephasgm.github.io/chaguo-tanzania/
- **Desktop App** - Windows, macOS, Linux
- **Telegram Bot** - @chaguo_tz_bot for config distribution
- **Mobile Ready** - Configs for Android/iOS VPN clients

## 🏗️ Project Structure
chaguo-tanzania/
├── .github/ # GitHub workflows
├── bot/ # Telegram bot source
├── configs/ # Server configurations
├── desktop-app/ # Electron desktop application
├── scripts/ # Deployment & testing scripts
├── public/ # Website static assets
├── index.html # Main website
├── style.css # Website styles
├── app.js # Website JavaScript
├── pwa-manager.js # PWA functionality
├── qr-generator.js # QR code generation
├── config-distributor.js # Config distribution logic
├── telegram-bot.js # Telegram bot
├── test.html # Testing interface
├── README.md # This file
└── LICENSE # MIT License

text

## 🚀 Quick Start

### 1. Web App (Easiest)
Visit **[https://cephasgm.github.io/chaguo-tanzania/](https://cephasgm.github.io/chaguo-tanzania/)** and:
1. Generate a configuration QR code
2. Scan with your VPN client
3. Import and connect

### 2. Desktop App (Recommended)
1. Download from the [Releases page](https://github.com/cephasgm/chaguo-tanzania/releases)
2. Install on your system
3. Click "Connect" - it auto-configures everything

### 3. Manual Configuration
1. Visit the website
2. Copy configuration JSON
3. Import into your preferred client (V2RayN, Shadowrocket, etc.)

### 4. Telegram Bot
1. Message [@chaguo_tz_bot](https://t.me/chaguo_tz_bot) on Telegram
2. Use `/config` command
3. Receive latest configurations

## 🔧 For Developers

### Prerequisites
- Node.js 16+
- npm or yarn
- Git

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/cephasgm/chaguo-tanzania.git
cd chaguo-tanzania

# Install dependencies for website
npm install

# Install dependencies for desktop app
cd desktop-app
npm install

# Run desktop app in development mode
npm run dev

# Build desktop app for production
npm run build
Server Deployment
bash
# Deploy proxy servers
./scripts/server-setup.sh

# Generate configurations
node ./scripts/generate-configs.js

# Test from Tanzania
./scripts/test-from-tz.sh
Telegram Bot Deployment
bash
# Install bot dependencies
cd bot
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your bot token

# Start the bot
npm start
📡 Protocols Comparison
Protocol	Speed	Obfuscation	Reliability	Setup Difficulty
V2Ray + WS	⚡⚡⚡⚡	⭐⭐⭐⭐	⭐⭐⭐⭐	⭐⭐
Shadowsocks	⚡⚡⚡⚡⚡	⭐⭐⭐	⭐⭐⭐⭐	⭐
WireGuard	⚡⚡⚡⚡⚡	⭐⭐	⭐⭐⭐⭐⭐	⭐⭐⭐
Trojan	⚡⚡⚡	⭐⭐⭐⭐⭐	⭐⭐⭐⭐	⭐⭐⭐
🛡️ Security Features
Privacy First
No Logging: Servers don't keep connection logs

End-to-End Encryption: All traffic is encrypted

Open Source: Code is auditable by anyone

Config Rotation: Configurations expire every 24 hours

Anti-Censorship
Domain Fronting: Uses legitimate domains (Cloudflare, Google)

Traffic Mimicking: Looks like normal web traffic

Port Randomization: Uses random ports to avoid detection

Protocol Obfuscation: Additional layers of obfuscation

Resilience
Multi-Server: Automatic failover between servers

Self-Healing: Recovers from connection drops

Mesh Network: Works even when internet is blocked

Offline Mode: Cached configurations work offline

🌍 Server Locations
Location	Latency (from TZ)	Protocol	Status
Kenya (Nairobi)	45-60ms	V2Ray, WireGuard	✅ Active
South Africa (Johannesburg)	120-150ms	Shadowsocks, Trojan	✅ Active
Germany (Frankfurt)	180-220ms	V2Ray, WireGuard	✅ Active
USA (Virginia)	250-300ms	Trojan, V2Ray	✅ Active
📊 Monitoring
Status Dashboard
Website: https://cephasgm.github.io/chaguo-tanzania/

Server Status: Updated every 5 minutes

Block Detection: Real-time monitoring

Usage Statistics: Anonymous aggregated data

Health Checks
bash
# Test all servers
curl https://chaguo.tz/health

# Get server status
curl https://status.chaguo.tz/api/v1/status
🤝 Contributing
We welcome contributions! Here's how you can help:

Report Issues
Check if the issue already exists

Create a new issue with detailed information

Include logs, error messages, and steps to reproduce

Submit Code
Fork the repository

Create a feature branch

Make your changes

Submit a pull request

Help Categories
Testing: Test from different locations in Tanzania

Documentation: Improve guides and translations

Development: Add features or fix bugs

Infrastructure: Help with server deployment

Development Guidelines
Follow existing code style

Add tests for new features

Update documentation

Keep commits clean and atomic

📝 Translation
Help translate Chaguo into Swahili and other Tanzanian languages:

json
// Example translation entry
{
  "en": "Connect to VPN",
  "sw": "Unganisha kwa VPN"
}
Contact us if you want to help with translation!

⚖️ Legal Disclaimer
Educational Purpose
Chaguo is developed for educational and research purposes to study internet censorship and circumvention techniques.

User Responsibility
Users are responsible for:

Complying with local laws and regulations

Using the tool ethically and responsibly

Respecting network policies

No Warranty
This software is provided "as is" without any warranty. Use at your own risk.

Server Locations
All servers are located outside Tanzania in jurisdictions with strong privacy protections.

🔗 Links
Website: https://cephasgm.github.io/chaguo-tanzania/

Desktop App: https://cephasgm.github.io/chaguo-tanzania/desktop-app/

GitHub: https://github.com/cephasgm/chaguo-tanzania

Telegram Bot: https://t.me/chaguo_tz_bot

Issues: https://github.com/cephasgm/chaguo-tanzania/issues

Discussions: https://github.com/cephasgm/chaguo-tanzania/discussions

📞 Support
Getting Help
Check Documentation: Most questions are answered in the guides

Telegram Bot: @chaguo_tz_bot for quick help

GitHub Issues: For bugs and feature requests

Community: Share experiences and solutions with other users

Emergency Access
If everything is blocked:

SMS Fallback: Text "CHAGUO" to emergency number

Mesh Network: Discover nearby devices with Chaguo

Offline Cache: Use previously cached configurations

🙏 Acknowledgments
V2Ray Project: For the amazing V2Ray core

Shadowsocks Community: For lightweight proxy technology

WireGuard: For modern VPN protocol

All Contributors: Everyone who has helped improve Chaguo

Tanzanian Users: For testing and feedback
