const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateAllIcons() {
  const sourceCandidates = [
    path.join(__dirname, '../our_story_icon.png'),
    path.join(__dirname, '../resources/icon.png'),
    path.join(__dirname, '../public/our_story_icon.png'),
  ];

  let sourcePath = null;
  for (const cand of sourceCandidates) {
    if (fs.existsSync(cand)) {
      sourcePath = cand;
      break;
    }
  }

  if (!sourcePath) {
    console.error('Source our_story_icon.png not found!');
    process.exit(1);
  }

  console.log(`Processing source icon: ${sourcePath}`);
  const srcBuf = fs.readFileSync(sourcePath);

  // 1. Ensure our_story_icon.png exists in root and public
  const rootDest = path.join(__dirname, '../our_story_icon.png');
  const pubStoryDest = path.join(__dirname, '../public/our_story_icon.png');
  if (!fs.existsSync(rootDest)) fs.writeFileSync(rootDest, srcBuf);
  if (!fs.existsSync(pubStoryDest)) fs.writeFileSync(pubStoryDest, srcBuf);

  // 2. Web & PWA icons in /public
  const publicDir = path.join(__dirname, '../public');
  const webSizes = [
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

  for (const item of webSizes) {
    const dest = path.join(publicDir, item.name);
    await sharp(srcBuf)
      .resize(item.size, item.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(dest);
    console.log(`Updated public/${item.name}`);
  }

  // 3. Resources folder (for Capacitor asset pipelines)
  const resourcesDir = path.join(__dirname, '../resources');
  if (!fs.existsSync(resourcesDir)) fs.mkdirSync(resourcesDir, { recursive: true });

  const resourceSizes = ['icon.png', 'icon-only.png', 'icon-foreground.png', 'icon-background.png'];
  for (const name of resourceSizes) {
    await sharp(srcBuf)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(resourcesDir, name));
    console.log(`Updated resources/${name}`);
  }

  // 4. Android Native Mipmap Directories
  // Android Adaptive icon specs:
  // Foreground asset is 108dp x 108dp with a 72dp safe zone in the center (~66.7% scaling).
  // Standard/legacy icon is 48dp x 48dp at mdpi.
  const androidResDir = path.join(__dirname, '../android/app/src/main/res');
  const mipmapDensities = [
    { dir: 'mipmap-mdpi', iconSize: 48, fgSize: 108, fgIconSize: 72 },
    { dir: 'mipmap-hdpi', iconSize: 72, fgSize: 162, fgIconSize: 108 },
    { dir: 'mipmap-xhdpi', iconSize: 96, fgSize: 216, fgIconSize: 144 },
    { dir: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324, fgIconSize: 216 },
    { dir: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432, fgIconSize: 288 },
  ];

  for (const density of mipmapDensities) {
    const targetDir = path.join(androidResDir, density.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // A. ic_launcher.png (Legacy launcher square/squircle icon)
    await sharp(srcBuf)
      .resize(density.iconSize, density.iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    // B. ic_launcher_round.png (Round launcher icon)
    await sharp(srcBuf)
      .resize(density.iconSize, density.iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // C. ic_launcher_foreground.png (Adaptive icon foreground with proper Android safe zone)
    // The icon is centered inside a transparent 108dp canvas at fgIconSize (72dp)
    const scaledFgBuffer = await sharp(srcBuf)
      .resize(density.fgIconSize, density.fgIconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const topOffset = Math.floor((density.fgSize - density.fgIconSize) / 2);
    const leftOffset = Math.floor((density.fgSize - density.fgIconSize) / 2);

    await sharp({
      create: {
        width: density.fgSize,
        height: density.fgSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{ input: scaledFgBuffer, top: topOffset, left: leftOffset }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`Updated Android ${density.dir} (ic_launcher, ic_launcher_round, ic_launcher_foreground)`);
  }

  // 5. Clean up any conflicting legacy files in android/app/src/main/res
  const legacyFiles = [
    path.join(androidResDir, 'drawable-v24/ic_launcher_foreground.xml'),
    path.join(androidResDir, 'drawable/ic_launcher_background.xml'),
  ];
  for (const lf of legacyFiles) {
    if (fs.existsSync(lf)) {
      fs.unlinkSync(lf);
      console.log(`Removed legacy asset: ${lf}`);
    }
  }

  // 6. Ensure background color in android/app/src/main/res/values/ic_launcher_background.xml matches icon navy #030611
  const bgXmlPath = path.join(androidResDir, 'values/ic_launcher_background.xml');
  const bgXmlContent = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#030611</color>\n</resources>\n`;
  fs.writeFileSync(bgXmlPath, bgXmlContent, 'utf8');
  console.log(`Updated ${bgXmlPath}`);

  console.log('Icon generation and replacement complete!');
}

generateAllIcons().catch((err) => {
  console.error('Fatal error during icon generation:', err);
  process.exit(1);
});
