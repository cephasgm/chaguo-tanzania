@echo off
REM Create directories
mkdir .github
mkdir .github\workflows
mkdir bot
mkdir bot\configs
mkdir configs
mkdir configs\templates
mkdir desktop-app
mkdir desktop-app\src
mkdir desktop-app\src\main
mkdir desktop-app\src\renderer
mkdir desktop-app\src\preload
mkdir scripts
mkdir public
mkdir public\icons

REM Create files
type nul > .github\workflows\deploy.yml
type nul > .github\workflows\tests.yml

type nul > bot\configs\latest.json
type nul > bot\package.json
type nul > bot\telegram-bot.js

type nul > configs\attestation-keys.json
type nul > configs\servers.json
type nul > configs\templates\README.txt

type nul > desktop-app\src\main\main.js
type nul > desktop-app\src\main\config-manager.js
type nul > desktop-app\src\main\connection-manager.js
type nul > desktop-app\src\main\self-healing.js
type nul > desktop-app\src\main\traffic-obfuscator.js
type nul > desktop-app\src\main\mesh-network.js
type nul > desktop-app\src\main\block-detector.js
type nul > desktop-app\src\main\wireguard-manager.js

type nul > desktop-app\src\renderer\index.html
type nul > desktop-app\src\renderer\renderer.js
type nul > desktop-app\src\renderer\styles.css

type nul > desktop-app\src\preload\preload.js
type nul > desktop-app\package.json
type nul > desktop-app\package-lock.json
type nul > desktop-app\builder-debug.yml
type nul > desktop-app\builder-effective-config.yaml
type nul > desktop-app\HOW-TO-RUN.md

type nul > scripts\server-setup.sh
type nul > scripts\deploy-infra.sh
type nul > scripts\generate-configs.js
type nul > scripts\test-from-tz.sh

type nul > public\manifest.json
type nul > public\sw.js
type nul > public\icons\README.txt

type nul > index.html
type nul > style.css
type nul > app.js
type nul > pwa-manager.js
type nul > qr-generator.js
type nul > config-distributor.js
type nul > telegram-bot.js
type nul > test.html
type nul > LICENSE
type nul > README.md

echo Structure created.
pause
