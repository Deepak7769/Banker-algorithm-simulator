const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const wwwDir = path.join(rootDir, 'www');

// Ensure www exists and clean it
if (fs.existsSync(wwwDir)) {
  fs.rmSync(wwwDir, { recursive: true, force: true });
}
fs.mkdirSync(wwwDir, { recursive: true });

// Copy index.html
fs.copyFileSync(path.join(rootDir, 'index.html'), path.join(wwwDir, 'index.html'));

// Copy vendor directory
const vendorSrc = path.join(rootDir, 'vendor');
if (fs.existsSync(vendorSrc)) {
  fs.cpSync(vendorSrc, path.join(wwwDir, 'vendor'), { recursive: true });
}

console.log('✓ Successfully prepared www/ directory for Capacitor Android build');
