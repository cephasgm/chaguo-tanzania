#!/bin/bash
echo "🛠️ Creating Chaguo icons..."

# Create directories
mkdir -p public/icons

# Create 192x192 SVG icon
cat > public/icons/icon-192x192.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192">
  <rect width="192" height="192" fill="#2E7D32"/>
  <text x="96" y="100" font-family="Arial" font-size="60" fill="white" text-anchor="middle">C</text>
</svg>
EOF

# Create 512x512 SVG icon  
cat > public/icons/icon-512x512.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" fill="#2E7D32"/>
  <text x="256" y="280" font-family="Arial" font-size="200" fill="white" text-anchor="middle">C</text>
</svg>
EOF

# Create favicon
cat > public/favicon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
  <rect width="32" height="32" fill="#2E7D32"/>
  <text x="16" y="22" font-family="Arial" font-size="16" fill="white" text-anchor="middle">C</text>
</svg>
EOF

echo "✅ Icons created in:"
echo "  - public/icons/icon-192x192.svg"
echo "  - public/icons/icon-512x512.svg"
echo "  - public/favicon.svg"
