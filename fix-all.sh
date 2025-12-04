#!/bin/bash
echo "🚀 Fixing Chaguo Tanzania Project..."

# 1. Create missing directories
mkdir -p public/icons
mkdir -p configs
mkdir -p scripts

# 2. Download placeholder icons
echo "📱 Downloading icons..."
curl -s -o public/icons/icon-192x192.png "https://via.placeholder.com/192x192/2E7D32/ffffff?text=CH"
curl -s -o public/icons/icon-512x512.png "https://via.placeholder.com/512x512/2E7D32/ffffff?text=CH"

# 3. Create fixed files
echo "📝 Creating fixed files..."

# Create manifest.json
cat > public/manifest.json << 'EOF'
{
  "name": "Chaguo Tanzania",
  "short_name": "Chaguo",
  "description": "Internet Freedom for Tanzania",
  "start_url": "/chaguo-tanzania/",
  "display": "standalone",
  "background_color": "#2E7D32",
  "theme_color": "#2E7D32",
  "icons": [
    {
      "src": "icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
EOF

# Create service worker
cat > public/sw.js << 'EOF'
const CACHE_NAME = 'chaguo-v1';
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(['/chaguo-tanzania/']))
  );
});
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
EOF

# Create config
cat > configs/latest.json << 'EOF'
{
  "version": "1.0.0",
  "servers": [
    {
      "id": "kenya-1",
      "name": "Test Server",
      "host": "test.chaguo.tz",
      "port": 443,
      "protocol": "v2ray-ws"
    }
  ]
}
EOF

echo "✅ All files created!"
echo ""
echo "Next steps:"
echo "1. Commit changes: git add . && git commit -m 'Fix PWA and QR codes'"
echo "2. Push: git push origin main"
echo "3. Wait 1 minute for GitHub Pages to update"
echo "4. Visit: https://cephasgm.github.io/chaguo-tanzania/"
