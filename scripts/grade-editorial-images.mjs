// scripts/grade-editorial-images.mjs
// One-time grading pass: darken, desaturate, warm-tint toward umber so every
// editorial image sits in the dark/porcelain/gold world. Outputs AVIF + WebP
// + JPEG at 640/1280/1920 into src/assets/editorial/.
import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const RAW_DIR = 'scripts/editorial-raw';
const OUT_DIR = 'src/assets/editorial';
const WIDTHS = [640, 1280, 1920];

const files = (await readdir(RAW_DIR)).filter((f) => /\.(jpe?g|png)$/i.test(f));
if (files.length === 0) {
  console.error(`No source images in ${RAW_DIR}`);
  process.exit(1);
}
await mkdir(OUT_DIR, { recursive: true });

for (const file of files) {
  const stem = path.parse(file).name;
  const src = sharp(path.join(RAW_DIR, file)).rotate();
  const { width: srcWidth } = await src.metadata();

  for (const width of WIDTHS) {
    if (srcWidth && srcWidth < width) continue;
    const resized = await src
      .clone()
      .resize(width)
      .modulate({ saturation: 0.78, brightness: 0.92 })
      .toBuffer();
    const { width: w, height: h } = await sharp(resized).metadata();
    // Warm umber multiply wash (#3E3A33 at 30%) pulls every image into the palette.
    const wash = await sharp({
      create: {
        width: w,
        height: h,
        channels: 4,
        background: { r: 62, g: 58, b: 51, alpha: 0.3 },
      },
    })
      .png()
      .toBuffer();
    const graded = sharp(resized).composite([{ input: wash, blend: 'multiply' }]);

    await graded.clone().avif({ quality: 60 }).toFile(`${OUT_DIR}/${stem}-${width}.avif`);
    await graded.clone().webp({ quality: 75 }).toFile(`${OUT_DIR}/${stem}-${width}.webp`);
    await graded.clone().jpeg({ quality: 80 }).toFile(`${OUT_DIR}/${stem}-${width}.jpg`);
    console.log(`graded ${stem} @ ${width}`);
  }
}
console.log('done');
