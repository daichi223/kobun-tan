// scripts/resize-icons.js
const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('sharp not found. Please run: npm install --save-dev sharp');
  process.exit(1);
}

const sourceFile = path.join(__dirname, '../public/pwa-192x192.png');
const sizes = [
  { size: 192, output: path.join(__dirname, '../public/pwa-192x192.png') },
  { size: 512, output: path.join(__dirname, '../public/pwa-512x512.png') }
];

async function resizeIcons() {
  console.log('Resizing PWA icons...');

  for (const { size, output } of sizes) {
    await sharp(sourceFile)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(output + '.tmp');

    // Move temp file to final location
    fs.renameSync(output + '.tmp', output);
    console.log(`✓ Created ${size}x${size} icon`);
  }

  console.log('Done!');
}

resizeIcons().catch(console.error);
