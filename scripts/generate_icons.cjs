const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateIcons() {
  // Check candidate locations for our_story_icon.png
  const searchLocations = [
    path.join(__dirname, '../our_story_icon.png'),
    path.join(__dirname, '../public/our_story_icon.png'),
    path.join(__dirname, '../resources/our_story_icon.png'),
    path.join(__dirname, '../../our_story_icon.png'),
    path.join('/tmp/our_story_icon.png'),
    path.join(__dirname, '../public/icon.svg')
  ];

  let sourceImagePath = null;
  for (const loc of searchLocations) {
    if (fs.existsSync(loc)) {
      sourceImagePath = loc;
      break;
    }
  }

  if (!sourceImagePath) {
    console.error('Source icon image not found. Looked in:', searchLocations);
    process.exit(1);
  }

  console.log(`Using source icon image: ${sourceImagePath}`);
  const imageBuffer = fs.readFileSync(sourceImagePath);

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
    await sharp(imageBuffer)
      .resize(item.size, item.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
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
    await sharp(imageBuffer)
      .resize(item.size, item.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(dest);
    console.log(`Generated: resources/${item.name}`);
  }

  // 3. Generate native Android mipmap directory structure
  const androidResDir = path.join(__dirname, '../android/app/src/main/res');
  const mipmaps = [
    { dir: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', size: 96, iconSize: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', size: 144, iconSize: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', size: 192, iconSize: 192, fgSize: 432 },
  ];

  for (const m of mipmaps) {
    const targetDir = path.join(androidResDir, m.dir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Standard Launcher Icon
    await sharp(imageBuffer)
      .resize(m.iconSize, m.iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    // Round Launcher Icon
    await sharp(imageBuffer)
      .resize(m.iconSize, m.iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // Foreground Adaptive Icon
    await sharp(imageBuffer)
      .resize(m.fgSize, m.fgSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`Generated Android mipmap: ${m.dir}`);
  }

  console.log('All Android launcher icons generated successfully without modification!');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
