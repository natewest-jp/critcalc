import sharp from 'sharp';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Dire border textures (tool-interior edge treatment). Raw masters live in
// assets-src/ (gitignored); only the encoded outputs in static/ ship.
//
// - noise: 1200×600 seamless (both axes) black-with-varying-alpha veil that
//   scrolls upward beneath the halftone plate. Noise + alpha is the worst case
//   for lossy codecs, so we encode at moderate quality and ship AVIF + WebP;
//   the veil sits behind a dot screen at low contrast, so mild artifacts are
//   invisible in situ.
// - halftone: 10×200 dot screen, crisp 1px-scale detail. Lossy encoding would
//   smear the dots and it is already tiny — copied through as PNG.
const SRC_DIR = join(PROJECT_ROOT, 'assets-src/tools');
const OUT_DIR = join(PROJECT_ROOT, 'static/assets/tools');

await mkdir(OUT_DIR, { recursive: true });

const noise = sharp(join(SRC_DIR, 'noise-alpha-repeating-1200x600.png'));

await noise.clone().avif({ quality: 55, effort: 6 }).toFile(join(OUT_DIR, 'dire-noise.avif'));

await noise
	.clone()
	.webp({ quality: 70, alphaQuality: 80, effort: 6 })
	.toFile(join(OUT_DIR, 'dire-noise.webp'));

await copyFile(join(SRC_DIR, 'halftone-repeating-10x200.png'), join(OUT_DIR, 'dire-halftone.png'));

console.log('✓ dire-noise (avif + webp), dire-halftone (png copy)');
