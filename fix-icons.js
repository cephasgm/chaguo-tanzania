// fix-icons.js - Simple icon creator
const fs = require('fs');
const path = require('path');

console.log('🛠️ Creating icons for Chaguo...');

// Create directories
const publicDir = path.join(__dirname, 'public');
const iconsDir = path.join(publicDir, 'icons');

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

// Create simple SVG icons
const icons = [
  { size: 192, name: 'icon-192x192.svg' },
  { size: 512, name: 'icon-512x512.svg' }
];

icons.forEach(({ size, name }) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="100%" height="100%" fill="#2E7D32"/>
    <text x="50%" y="50%" font-family="Arial" font-size="${size/3}" 
          fill="white" text-anchor="middle" dy=".3em">C</text>
  </svg>`;
  
  fs.writeFileSync(path.join(iconsDir, name), svg);
  console.log(`✅ Created ${name}`);
});

// Create favicon
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
  <rect width="32" height="32" fill="#2E7D32"/>
  <text x="16" y="22" font-family="Arial" font-size="16" fill="white" text-anchor="middle">C</text>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'favicon.svg'), favicon);
console.log('✅ Created favicon.svg');

console.log('\n🎉 Icons created!');
console.log('Update your index.html with:');
console.log('<link rel="icon" href="public/favicon.svg" type="image/svg+xml">');
