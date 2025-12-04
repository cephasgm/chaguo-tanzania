# Chaguo Tanzania - Icons Directory

This directory contains all icons for the Chaguo Tanzania Progressive Web App (PWA).

## Icon Sizes and Usage

### Required PWA Icons
- `icon-72x72.png`   - Android homescreen icon
- `icon-96x96.png`   - Android task switcher
- `icon-128x128.png` - Chrome web store
- `icon-144x144.png` - IE11 Metro tile
- `icon-152x152.png` - Apple touch icon (iPad)
- `icon-192x192.png` - Android/Chrome recommended
- `icon-384x384.png` - Android splash screen
- `icon-512x512.png` - High-resolution PWA icon

### Additional Icons
- `icon-tray.png`    - Desktop app tray icon (16x16)
- `icon-tray-connected.png` - Tray icon when connected
- `favicon.ico`      - Browser favicon (16x16, 32x32, 48x48)
- `favicon-16x16.png` - Small favicon
- `favicon-32x32.png` - Medium favicon
- `apple-touch-icon.png` - Apple touch icon (180x180)

## Design Guidelines

### Colors
- Primary: #2E7D32 (Green)
- Secondary: #FFC107 (Yellow/Gold)
- Background: #FFFFFF (White)
- Foreground: #000000 (Black)

### Design Elements
- Globe icon representing global connectivity
- Shield representing security
- Green color representing growth and freedom
- Clean, modern design for professional appearance

## Generation Instructions

To generate all icons from a source image (1024x1024 recommended):

### Using ImageMagick
```bash
# Install ImageMagick first
# Ubuntu/Debian: sudo apt install imagemagick
# macOS: brew install imagemagick

# Convert source image to all required sizes
convert source.png -resize 512x512 icon-512x512.png
convert source.png -resize 384x384 icon-384x384.png
convert source.png -resize 192x192 icon-192x192.png
convert source.png -resize 152x152 icon-152x152.png
convert source.png -resize 144x144 icon-144x144.png
convert source.png -resize 128x128 icon-128x128.png
convert source.png -resize 96x96 icon-96x96.png
convert source.png -resize 72x72 icon-72x72.png
convert source.png -resize 32x32 favicon-32x32.png
convert source.png -resize 16x16 favicon-16x16.png

# Create ICO file (Windows favicon)
convert source.png -resize 16x16 icon16.png
convert source.png -resize 32x32 icon32.png
convert source.png -resize 48x48 icon48.png
convert icon16.png icon32.png icon48.png favicon.ico
Using Online Tools
Visit https://realfavicongenerator.net/

Upload your source image

Configure settings as needed

Download generated package

Extract to this directory

Quality Requirements
All icons must be PNG format with transparent background

Icons should be crisp and clear at all sizes

Maintain aspect ratio (square)

Use anti-aliasing for smooth edges

Test on different backgrounds (light/dark)

Testing
After adding/updating icons:

Clear browser cache

Visit https://cephasgm.github.io/chaguo-tanzania/

Install as PWA (if supported)

Verify icons appear correctly:

Browser tab

Mobile home screen

Desktop PWA

Task switcher

Troubleshooting
Icons Not Showing
Check file paths in manifest.json

Verify file permissions

Clear browser cache

Check console for 404 errors

Icons Blurry
Use high-resolution source image (min 512x512)

Generate each size individually (don't rely on browser scaling)

Use proper image optimization

PWA Installation Failing
Verify all required icon sizes exist

Check manifest.json icon paths

Ensure HTTPS is used (GitHub Pages provides this)

Updates
When updating icons:

Update all sizes for consistency

Update manifest.json if filenames change

Update this README if specifications change

Test on multiple devices/browsers

Credits
Icons designed for Chaguo Tanzania project.
For icon design assistance, contact: contact@chaguo.tz

License
Icons are part of the Chaguo Tanzania project and are licensed under MIT License.
See ../LICENSE for details.
