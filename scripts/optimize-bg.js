import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Raw master lives OUTSIDE static/ (in assets-src/, gitignored) so it is never
// copied into the build output; only the encoded tiers written to OUT_DIR ship.
const INPUT = join(PROJECT_ROOT, 'assets-src/landing/scene-5340.png');
const OUT_DIR = join(PROJECT_ROOT, 'static/assets/landing');

// Master dimensions and split, in source pixels. The master is the 21:9 design
// frame (5120×2194) plus parallax bleed on every edge so a cursor shift never
// pulls a gutter into view: 110px left/right, 66px top/bottom → 5340×2326. The
// horizon (sky/floor contact) is at row 1451, so the sky occupies the top 1451
// rows and the floor the bottom 875. Both regions are cropped from the same
// source image so the horizon alignment is mechanical — no drift between them.
//
// No noise is baked in this pipeline; banding is mitigated at composite time
// via the CSS noise overlay (noise-128.{png,webp}) layered on the sky element.
// That keeps the encoded files smaller (noise is high-entropy and inflates
// AVIF/WebP) and gives us a tuning knob in CSS instead of in the pipeline.
const MASTER_W = 5340;
const MASTER_H = 2326;
const HORIZON_Y = 1451; // sky height; floor height = MASTER_H − HORIZON_Y

const REGIONS = [
	{
		name: 'floor',
		// Floor occupies rows HORIZON_Y..MASTER_H-1 (the bottom 875).
		crop: { left: 0, top: HORIZON_Y, width: MASTER_W, height: MASTER_H - HORIZON_Y },
		// Floor preserves reflection detail; encode at higher quality.
		avifQuality: 80,
		webpQuality: 88
	},
	{
		name: 'sky',
		// Sky/dust/band region, rows 0..HORIZON_Y-1 (the top 1451).
		crop: { left: 0, top: 0, width: MASTER_W, height: HORIZON_Y },
		// Smoother content tolerates lower quality without visible loss.
		avifQuality: 70,
		webpQuality: 82
	}
];

// Tier widths cover the common hardware resolutions. These are PLATE widths
// (the full bleed-inclusive image), each ≈1.043× its target viewport width
// since the plate is 5340 wide for a 5120-wide visible frame. The top tier
// equals the master width so we never upscale:
//   2000 → ~1920 16:9 viewport (1080p) + bleed
//   2670 → ~2560 viewport (1080p ultrawide / 1440p 16:9) + bleed
//   3585 → ~3440 viewport (1440p ultrawide) + bleed
//   5340 → ~5120 viewport (4K ultrawide / 5K2K) + bleed, = master width
const TIERS = [2000, 2670, 3585, 5340];

await mkdir(OUT_DIR, { recursive: true });

// Sanity-check the master dimensions before slicing.
const meta = await sharp(INPUT).metadata();
if (meta.width !== MASTER_W || meta.height !== MASTER_H) {
	console.warn(
		`⚠ master is ${meta.width}×${meta.height}, expected ${MASTER_W}×${MASTER_H} — ` +
			`crops will not align correctly. Aborting.`
	);
	process.exit(1);
}

for (const region of REGIONS) {
	for (const tier of TIERS) {
		const base = sharp(INPUT)
			.extract(region.crop)
			.resize({ width: tier, withoutEnlargement: true });

		await base
			.clone()
			.avif({ quality: region.avifQuality, effort: 6, chromaSubsampling: '4:4:4' })
			.toFile(join(OUT_DIR, `${region.name}-${tier}w.avif`));

		await base
			.clone()
			.webp({ quality: region.webpQuality, effort: 6, smartSubsample: true })
			.toFile(join(OUT_DIR, `${region.name}-${tier}w.webp`));

		console.log(`✓ ${region.name}-${tier}w (avif + webp)`);
	}
}

console.log('done');
