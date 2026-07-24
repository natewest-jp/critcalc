import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Dire border textures (tool-interior edge treatment). Raw masters live in
// assets-src/ (gitignored); only the encoded outputs in static/ ship.
//
// - noise: 1200×600 seamless (both axes) black-with-varying-alpha veil that
//   scrolls upward — the ember field's moving luminance. Noise + alpha is the
//   worst case for lossy codecs, so we encode at moderate quality and ship
//   AVIF + WebP; the veil reads through a dot screen at low contrast, so mild
//   artifacts are invisible in situ.
// - The halftone dot plate (dire-halftone.png) is RETIRED (2026-07-25): the
//   dot screen is procedural in the ember shader now (direBorderGL.ts
//   EMBER_* constants, geometry measured from the plate before removal —
//   scripts/probe-plate-analyze.mjs holds the measurement recipe).
const SRC_DIR = join(PROJECT_ROOT, 'assets-src/tools');
const OUT_DIR = join(PROJECT_ROOT, 'static/assets/tools');

await mkdir(OUT_DIR, { recursive: true });

const noise = sharp(join(SRC_DIR, 'noise-alpha-repeating-1200x600.png'));

await noise.clone().avif({ quality: 55, effort: 6 }).toFile(join(OUT_DIR, 'dire-noise.avif'));

await noise
	.clone()
	.webp({ quality: 70, alphaQuality: 80, effort: 6 })
	.toFile(join(OUT_DIR, 'dire-noise.webp'));

console.log('✓ dire-noise (avif + webp)');
