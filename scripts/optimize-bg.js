import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const INPUT = join(PROJECT_ROOT, 'static/assets/landing/raw/plate-frame16x9-3840w.png');
const OUT_DIR = join(PROJECT_ROOT, 'static/assets/landing');
const BASENAME = 'plate-frame16x9';

const widths = [1920, 2560, 3840];

// Noise sigma in 0-255 pixel-value units. Applied post-downsample as a
// 50%-gray Gaussian-noise overlay (Overlay blend), so each tier gets the
// same effective amplitude regardless of resolution. Tune until banding
// dies; sub-perceptual band-killer typically lands at 4-8.
const NOISE_SIGMA = 6;

await mkdir(OUT_DIR, { recursive: true });

for (const width of widths) {
  const downsampled = await sharp(INPUT)
    .resize({ width, withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h } = downsampled.info;

  const noise = await sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
      noise: { type: 'gaussian', mean: 128, sigma: NOISE_SIGMA },
    },
  })
    .png()
    .toBuffer();

  const noisy = sharp(downsampled.data).composite([{ input: noise, blend: 'overlay' }]);

  await noisy
    .clone()
    .avif({ quality: 78, effort: 6, chromaSubsampling: '4:4:4' })
    .toFile(join(OUT_DIR, `${BASENAME}-${width}w.avif`));

  await noisy
    .clone()
    .webp({ quality: 90, effort: 6, smartSubsample: true })
    .toFile(join(OUT_DIR, `${BASENAME}-${width}w.webp`));

  console.log(`✓ ${width}w done`);
}