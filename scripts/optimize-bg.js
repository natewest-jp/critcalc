import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const INPUT = join(PROJECT_ROOT, 'static/assets/landing/raw/scene-5120.png');
const OUT_DIR = join(PROJECT_ROOT, 'static/assets/landing');

// The master is rendered once at 5120×3840 and split here at the horizon
// line. Floor occupies the bottom 1072px (opaque ground + baked reflections);
// sky covers the top 2768px (gradient + galaxy dust + band + baked anchor
// stars). Both regions are cropped from the same source image so the horizon
// alignment is mechanical — no chance of drift between the two outputs.
//
// No noise is baked in this pipeline; banding is mitigated at composite time
// via the CSS noise overlay (noise-128.{png,webp}) layered on the sky element.
// That keeps the encoded files smaller (noise is high-entropy and inflates
// AVIF/WebP) and gives us a tuning knob in CSS instead of in the pipeline.
const REGIONS = [
	{
		name: 'floor',
		// y origin is the top of the master; floor occupies rows 2768-3839.
		crop: { left: 0, top: 2768, width: 5120, height: 1072 },
		// Floor preserves reflection detail; encode at higher quality.
		avifQuality: 80,
		webpQuality: 88
	},
	{
		name: 'sky',
		// Sky/dust/band region, rows 0-2767.
		crop: { left: 0, top: 0, width: 5120, height: 2768 },
		// Smoother content tolerates lower quality without visible loss.
		avifQuality: 70,
		webpQuality: 82
	}
];

// Tier widths cover the four common ultrawide hardware resolutions:
//   1920 → 1080p 16:9
//   2560 → 1080p ultrawide, 16:9 1440p
//   3440 → 1440p ultrawide (the modern "default" ultrawide)
//   5120 → 4K ultrawide (5K2K), retina @2x for 2560 CSS-px displays
const TIERS = [1920, 2560, 3440, 5120];

await mkdir(OUT_DIR, { recursive: true });

// Sanity-check the master dimensions before slicing.
const meta = await sharp(INPUT).metadata();
if (meta.width !== 5120 || meta.height !== 3840) {
	console.warn(
		`⚠ master is ${meta.width}×${meta.height}, expected 5120×3840 — ` +
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
