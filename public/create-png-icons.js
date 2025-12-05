// Create PNG icons using canvas (requires node-canvas or use online)
// OR simpler: Download placeholder PNGs

const https = require('https');
const fs = require('fs');
const path = require('path');

const icons = [
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' }
];

const iconsDir = path.join(__dirname, 'public/icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

icons.forEach(icon => {
  const url = `https://via.placeholder.com/${icon.size}x${icon.size}/2E7D32/ffffff?text=CH`;
  const dest = path.join(iconsDir, icon.name);
  
  const file = fs.createWriteStream(dest);
  https.get(url, response => {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log(`✅ Created ${icon.name}`);
    });
  }).on('error', err => {
    console.log(`Error: ${err.message}`);
    // Create SVG fallback
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${icon.size}" height="${icon.size}"><rect width="${icon.size}" height="${icon.size}" fill="#2E7D32"/><text x="50%" y="50%" font-family="Arial" font-size="${icon.size/2}" fill="white" text-anchor="middle" dy=".3em">C</text></svg>`;
    fs.writeFileSync(dest.replace('.png', '.svg'), svg);
  });
});

console.log('\n🎉 Update manifest.json to use PNG files');
