// scripts/grade-editorial-images.mjs
// One-time grading pass: darken, desaturate, warm-tint toward umber so every
// editorial image sits in the dark/porcelain/gold world. Outputs AVIF + WebP
// + JPEG at 640/1280/1920 into src/assets/editorial/.
//
// Prerequisite: scripts/editorial-raw/ must contain the source JPEGs (the dir
// is gitignored — originals are staged locally, never committed).
// This is a manually-run, one-time utility (`node scripts/grade-editorial-images.mjs`);
// it is NOT part of `npm run build`.
import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

process.on('unhandledRejection', (err) => {
  console.error(err);
  process.exit(1);
});

const RAW_DIR = 'scripts/editorial-raw';
const OUT_DIR = 'src/assets/editorial';
const WIDTHS = [640, 1280, 1920];

const files = (await readdir(RAW_DIR)).filter((f) => /\.(jpe?g|png)$/i.test(f));
if (files.length === 0) {
  console.error(`No source images in ${RAW_DIR}`);
  process.exit(1);
}
await mkdir(OUT_DIR, { recursive: true });

async function emitSet(src, stem, width) {
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

for (const file of files) {
  try {
    const stem = path.parse(file).name;
    const src = sharp(path.join(RAW_DIR, file)).rotate();
    // metadata().width is pre-rotation; autoOrient.width reflects EXIF orientation.
    const meta = await src.metadata();
    const srcWidth = (meta.autoOrient ?? meta).width;

    let largestEmitted = 0;
    for (const width of WIDTHS) {
      if (srcWidth && srcWidth < width) continue;
      await emitSet(src, stem, width);
      largestEmitted = width;
    }

    // Undersized sources (narrower than 1920) also get one set at their native
    // width so consumers have the sharpest non-upscaled rendition available.
    // Stems with full 1920 coverage are skipped — no spurious extras.
    if (srcWidth && srcWidth < 1920 && srcWidth > largestEmitted) {
      await emitSet(src, stem, srcWidth);
    }
  } catch (err) {
    console.error(`FAILED ${file}: ${err.message}`);
  }
}
console.log('done');
