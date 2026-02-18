const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const assetsDir = path.join(__dirname, '..', 'src', 'assets');
const desktopSrc = path.join(assetsDir, 'clara-hero-desktop-1920.jpg');
const mobileSrc = path.join(assetsDir, 'clara-hero-mobile-640.jpg');
const outputSizes = [480, 768, 1024, 1440, 1920, 2560, 3840];
const formats = [
  { ext: 'jpg', opts: { quality: 92 } },
  { ext: 'webp', opts: { quality: 88 } },
  { ext: 'avif', opts: { quality: 60 } },
];

fs.mkdirSync(assetsDir, { recursive: true });

async function generate() {
  for (const size of outputSizes) {
    const source = size <= 768 ? mobileSrc : desktopSrc;
    for (const format of formats) {
      const outputName = `clara-hero-${size}.${format.ext}`;
      const transformer = sharp(source).resize(size, null, { fit: 'cover' });
      await transformer.toFormat(format.ext, format.opts).toFile(path.join(assetsDir, outputName));
    }
  }
  console.log('Hero assets regenerated');
}

generate().catch((err) => {
  console.error('Failed to regenerate hero assets', err);
  process.exit(1);
});
