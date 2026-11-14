// Derives small WebP icons and 3D screen textures from the source screenshots in /assets.
// Usage: npm run images:build
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const out = 'public/img';
mkdirSync(out, { recursive: true });
const q = { quality: 80 };

const jobs = [
  // program list icons (shown at 56px, 2x)
  ['assets/lantern.png', null, [128, 128], 'icon-lantern.webp', { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }],
  ['assets/the-void.png', { left: 400, top: 150, width: 560, height: 560 }, [128, 128], 'icon-void.webp'],
  ['assets/j-station-now-playing.png', { left: 104, top: 288, width: 440, height: 440 }, [128, 128], 'icon-jstation.webp'],
  ['assets/jlpt-flashcards-card.png', { left: 150, top: 580, width: 350, height: 350 }, [128, 128], 'icon-flashcards.webp'],
  // screen textures for the 3D arcade cabinet and phones
  ['assets/the-void.png', { left: 250, top: 40, width: 904, height: 650 }, [512, 368], 'tex-void.webp'],
  ['assets/j-station-now-playing.png', null, [288, 640], 'tex-jstation.webp'],
  ['assets/jlpt-flashcards-card.png', null, [288, 640], 'tex-flashcards.webp'],
];

for (const [src, crop, [w, h], name, opts] of jobs) {
  let img = sharp(src);
  if (crop) img = img.extract(crop);
  await img.resize(w, h, opts ?? { fit: 'cover' }).webp(q).toFile(`${out}/${name}`);
  console.log('wrote', name);
}

await sharp('public/favicon.svg', { density: 300 }).resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('wrote apple-touch-icon.png');
