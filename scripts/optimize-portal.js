import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Transition sprite: a soft red-magenta vortex on transparency. The shape is all
// smooth gradient (no high-frequency detail), so it survives aggressive lossy
// compression and scaling. The lever here is the ALPHA channel — in lossy WebP
// the alpha is encoded losslessly by default and dominates a soft-glow file, so
// we drop alphaQuality too; AVIF handles smooth alpha far better and is primary.
const INPUT = join(PROJECT_ROOT, 'static/assets/transitions/raw/vortex-plate-2048.png');
const OUT_DIR = join(PROJECT_ROOT, 'static/assets/transitions');
const NAME = 'vortex-plate';

await mkdir(OUT_DIR, { recursive: true });

const base = sharp(INPUT); // already 2048²; soft, so no resize needed

await base
	.clone()
	.avif({ quality: 50, effort: 6 })
	.toFile(join(OUT_DIR, `${NAME}.avif`));

await base
	.clone()
	.webp({ quality: 70, alphaQuality: 85, effort: 6 })
	.toFile(join(OUT_DIR, `${NAME}.webp`));

console.log(`✓ ${NAME} (avif + webp)`);
