const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const siteDir = path.join(rootDir, '_site');

if (fs.existsSync(siteDir)) {
  fs.rmSync(siteDir, { recursive: true, force: true });
}
fs.mkdirSync(siteDir, { recursive: true });

fs.copyFileSync(path.join(rootDir, 'index.html'), path.join(siteDir, 'index.html'));
fs.copyFileSync(path.join(rootDir, 'favicon.svg'), path.join(siteDir, 'favicon.svg'));
fs.writeFileSync(path.join(siteDir, '.nojekyll'), '');

const vendorSrc = path.join(rootDir, 'vendor');
if (fs.existsSync(vendorSrc)) {
  fs.cpSync(vendorSrc, path.join(siteDir, 'vendor'), { recursive: true });
}

console.log('Prepared _site/ for GitHub Pages deployment.');
