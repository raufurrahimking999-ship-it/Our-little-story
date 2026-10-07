const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateIcons() {
  const svgPath = path.join(__dirname, '../public/icon.svg');
  if (!fs.existsSync(svgPath)) {
    console.error('Source icon.svg not found at:', svgPath);
    process.exit(1);
  }

  const svgBuffer = fs.readFileSync(svgPath);

  // 1. Generate standard public web / PWA / Android launcher icon sizes
  const publicDir = path.join(__dirname, '../public');
  const sizes = [
    { name: 'icon-512.png', size: 512 },
    { name: 'icon.png', size: 512 },
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-144.png', size: 144 },
    { name: 'icon-96.png', size: 96 },
    { name: 'icon-72.png', size: 72 },
    { name: 'icon-48.png', size: 48 },
    { name: 'favicon.png', size: 64 },
    { name: 'icon-foreground.png', size: 512 },
    { name: 'icon-background.png', size: 512 },
  ];

  for (const item of sizes) {
    const dest = path.join(publicDir, item.name);
    await sharp(svgBuffer)
      .resize(item.size, item.size)
      .png()
      .toFile(dest);
    console.log(`Generated: public/${item.name} (${item.size}x${item.size})`);
  }

  // 2. Generate resources/ folder for Capacitor/Cordova asset pipelines
  const resourcesDir = path.join(__dirname, '../resources');
  if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir, { recursive: true });
  }

  const resourceFiles = [
    { name: 'icon.png', size: 512 },
    { name: 'icon-foreground.png', size: 512 },
    { name: 'icon-background.png', size: 512 },
    { name: 'icon-only.png', size: 512 },
  ];

  for (const item of resourceFiles) {
    const dest = path.join(resourcesDir, item.name);
    await sharp(svgBuffer)
      .resize(item.size, item.size)
      .png()
      .toFile(dest);
    console.log(`Generated: resources/${item.name}`);
  }

  // 3. Generate native Android mipmap directory structure
  const androidResDir = path.join(__dirname, '../android/app/src/main/res');
  const mipmaps = [
    { dir: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 },
  ];

  for (const m of mipmaps) {
    const targetDir = path.join(androidResDir, m.dir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Standard Launcher Icon
    await sharp(svgBuffer)
      .resize(m.iconSize, m.iconSize)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    // Round Launcher Icon
    await sharp(svgBuffer)
      .resize(m.iconSize, m.iconSize)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // Foreground Adaptive Icon
    await sharp(svgBuffer)
      .resize(m.fgSize, m.fgSize)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`Generated Android mipmap: ${m.dir}`);
  }

  console.log('All Android launcher icons generated successfully from icon.svg!');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
