import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Raw master lives OUTSIDE static/ (in assets-src/, gitignored) so it is never
// copied into the build output; only the encoded tiers written to OUT_DIR ship.
// The 8-bit Blender export IS the master (Nate's call, measured 2026-08-04):
// Blender dithers at export time, so its 8-bit sky measures 59.4% plateau
// where our own 16->8 conversion of the same art measured 96.1% — the
// correct place to quantize. (The AVIF encoder smooths sub-level dither
// either way — both masters ship identical bytes and ~90% plateau — so the
// on-screen fix stays the scene shader's --scene-dither; the 8-bit master is
// simply 5x smaller and strictly >= at the source. Keep Blender's Dither
// setting ON in the export preset.)
const INPUT = join(PROJECT_ROOT, 'assets-src/landing/scene-6400-8bit.png');
const OUT_DIR = join(PROJECT_ROOT, 'static/assets/landing');
const MANIFEST = join(PROJECT_ROOT, 'src/lib/data/sceneAssets.generated.ts');

// ⚠️ CONTENT-HASHED OUTPUT — the reason this is not optional. OUT_DIR is under
// /assets/*, which static/_headers serves `immutable, max-age=31536000`: a
// browser that has ever loaded the landing holds these slices for a YEAR and
// will not revalidate. Re-encoding a new plate onto the same filenames would
// therefore ship to nobody who had already visited — the art would look
// unchanged for everyone but a first-time visitor, which is exactly the kind of
// bug that reads as "the script didn't work".
//
// So the master's content hash goes in every filename. New plate → new URLs →
// every browser fetches it; the superseded files are swept from the working
// tree below (they are unreachable once the manifest stops naming them, and an
// add-only tree that never sweeps turns into a midden). Call sites import the
// generated manifest rather than building these paths by hand, so the hash and
// the tier list can never go stale in two places at once.
const MASTER = await readFile(INPUT);
const HASH = createHash('sha256').update(MASTER).digest('hex').slice(0, 8);

// Master dimensions and split, in source pixels. The ascend master (Nate's
// Blender re-export, 2026-08-04) is the 21:9 design frame (5120 wide) plus
// 640px of bleed left/right (full 16° crane ≈472px + parallax reserve on every
// viewport) → 6400 wide. Vertically it carries the full ascend sky: the rest
// pose is bottom-anchored (66px of bleed below the viewport), and everything
// above the rest frame — ~1740 rows — is the sky the camera tilts up into,
// whose top ~2194 rows must compose as a standalone full-viewport tool-state
// backdrop. The horizon (sky/floor contact) is at row 3026, so the sky
// occupies the top 3026 rows and the floor the bottom 974. Both regions are
// cropped from the same source image so the horizon alignment is mechanical —
// no drift between them.
//
// No noise is baked INTO the plates: it is high-entropy and inflates AVIF/WebP
// badly, and baking it would also fix its strength at encode time. Banding is
// instead dithered at composite time, by the mid-grey grain tile this script
// emits alongside the plates and the scene layout lays over them with a CSS
// opacity knob per region (--sky-grain / --floor-grain).
//
// Why a tile rather than an feTurbulence, which the loading veil uses: the veil
// is a small, transient, untransformed overlay, and can afford a filter that
// generates fractal noise per pixel. The scene is permanent, viewport-sized (up
// to 5340px of plate) and carries the cursor-parallax transform — a filter there
// is a software raster pass repeated as the layer moves, and this project has
// already been bitten by filters over the parallaxed scene (see the WebKit note
// in SiteChrome.svelte). A tile is one small texture uploaded once and repeated
// by the GPU, free per frame, and tunable from CSS.
const MASTER_W = 6400;
const MASTER_H = 4000;
const HORIZON_Y = 3026; // sky height; floor height = MASTER_H − HORIZON_Y

// Source rows the SKY crop continues PAST the horizon, to be covered by the
// floor (z:3 over sky's z:1). Nate saw a hairline at the junction on a real
// display — sub-pixel, and not a misalignment: the two boxes abut at exactly
// 0.000px across every viewport height measured, because the floor's top works
// out to (floor-h − bleed-v)·px, which IS --horizon-y. That leaves rasterisation:
// two separately-composited layers meeting on a fractional device row, each
// antialiasing its own edge against transparency.
//
// The cheap fix is to stretch the sky box 1px so it underlaps. This is better:
// the overlap carries the master's REAL next rows, so nothing is scaled, no
// content shifts, and the covered strip is the true continuation of the art
// rather than a smeared edge row. It costs ~0.3% more sky pixels.
//
// ⚠️ Consumed via the manifest by the scene layout, which grows the sky IMAGE
// box by exactly this much — and only the image box. --sky-h stays the true
// horizon height because the twinkle and shooting-star layers size their host
// to it and place stars as a percentage of it; folding the overlap into that
// would shift every star.
const SKY_OVERLAP_SRC = 4;

// Quality re-tuned 2026-08-04 for the ascend master, with AVIF now the
// SHIPPED format: sceneGL.ts decodes `.avif` first and falls back to `.webp`
// only where the browser can't decode AVIF (pre-16.4 Safari) — WebP is a
// compatibility fallback, not a co-equal.
//
//   SKY: the v2 sky's 8-bit reference measures 95.9% plateaued (runs to 68
//   rows) — the banding is born at 16→8-bit quantisation, NOT in the 16-bit
//   master (Nate verified) and NOT in the encoder. Measured 2026-08-04:
//   encode-side dither does not survive lossy encoding at sane bytes (TPDF ±1
//   pre-encode hits 35.6%, but AVIF's loop filter smooths it back to ~90%
//   until q98/1.1MB), so banding is killed at DISPLAY time instead — the
//   additive dither term in sceneGL's plate shader (--scene-dither), which
//   unlike the overlay-blend grain does not vanish in the darkest rows. Sky
//   quality q78→q90 anyway: it keeps the encoder's quantisation steps at 1
//   level so the display dither can mask them, and the smooth sky is so
//   cheap (tens of KB at full res) that q90 costs nothing.
//
//   FLOOR is where the bytes belong (reflections, thin ground lines), but the
//   v2 floor had headroom by eye (Nate 2026-08-04): avif q90→q85. WebP floor
//   stays q94 — it is the old shipped setting and fallback-only now.
//
// effort 9 throughout: encoding is offline, so the slower search is free.
const REGIONS = [
	{
		name: 'floor',
		// Floor occupies rows HORIZON_Y..MASTER_H-1 (the bottom 875).
		crop: { left: 0, top: HORIZON_Y, width: MASTER_W, height: MASTER_H - HORIZON_Y },
		avifQuality: 85,
		webpQuality: 94
	},
	{
		name: 'sky',
		// Sky/dust/band region, rows 0..HORIZON_Y-1 (the top 1451), plus the
		// overlap rows that run under the floor.
		crop: { left: 0, top: 0, width: MASTER_W, height: HORIZON_Y + SKY_OVERLAP_SRC },
		avifQuality: 90,
		webpQuality: 94
	}
];

/** AVIF search effort. Offline cost only — nothing here is encoded at runtime. */
const AVIF_EFFORT = 9;

// Tier widths cover the common hardware resolutions. These are PLATE widths
// (the full bleed-inclusive image), each 1.25× its target FRAME width since
// the plate is 6400 wide for a 5120-wide visible frame (the frame maps to
// vh × 21/9, so the target is set by viewport HEIGHT, not width). The top
// tier equals the master width so we never upscale:
//   2400 → ~1920-wide frame (vh ≤ ~823 @1×)
//   3200 → ~2560 frame (1080p 16:9 @1×)
//   4300 → ~3440 frame (1440p @1×)
//   6400 → ~5120 frame (4K/5K, retina laptops @2×), = master width
const TIERS = [2400, 3200, 4300, 6400];

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

// ── the dither tile ─────────────────────────────────────────────────────────

// Distinct from the existing noise-128 tile, which stays where it is: that one
// is near-WHITE (mean 249) and is blended into the .sky-bg gradient as a haze,
// where brightening is the point. Dithering needs the opposite property. With
// `overlay`, a blend value of exactly mid-grey is the identity, so a tile
// centred on 128 perturbs the plate symmetrically and leaves its mean alone;
// re-using the near-white tile here lifted the sky by ~25 levels and did not
// break a single plateau (measured).
//
// White noise on purpose — no smoothing. Structured noise is what gives a tile
// a visible wrap seam; per-pixel noise has no low-frequency content to mismatch
// at the edges, and dithering wants exactly this frequency anyway.
//
// LOSSLESS, and it has to stay that way: lossy encoding is in the business of
// discarding precisely this signal, and a smoothed tile dithers nothing. Seeded
// so re-runs are byte-identical and the hash does not churn.
const GRAIN_SIZE = 128;
const GRAIN_SIGMA = 6; // levels; ≈3 levels of dither on a mid-dark sky at full opacity

const mulberry32 = (seed) => () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rand = mulberry32(0x63726974); // 'crit'
const grainPixels = Buffer.alloc(GRAIN_SIZE * GRAIN_SIZE);
for (let i = 0; i < grainPixels.length; i++) {
	// Box–Muller for a gaussian; a uniform tile has too much of its energy at
	// the extremes and reads as speckle rather than grain.
	const g = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
	grainPixels[i] = Math.max(0, Math.min(255, Math.round(128 + g * GRAIN_SIGMA)));
}
const grainPng = await sharp(grainPixels, {
	raw: { width: GRAIN_SIZE, height: GRAIN_SIZE, channels: 1 }
})
	.png({ compressionLevel: 9 })
	.toBuffer();
const GRAIN_HASH = createHash('sha256').update(grainPng).digest('hex').slice(0, 8);
const GRAIN_FILE = `grain-${GRAIN_HASH}-${GRAIN_SIZE}.png`;
await writeFile(join(OUT_DIR, GRAIN_FILE), grainPng);

const keep = new Set();

for (const region of REGIONS) {
	for (const tier of TIERS) {
		const base = sharp(INPUT)
			.extract(region.crop)
			.resize({ width: tier, withoutEnlargement: true });

		for (const [ext, encode] of [
			[
				'avif',
				(p) =>
					p.avif({
						quality: region.avifQuality,
						effort: AVIF_EFFORT,
						chromaSubsampling: '4:4:4'
					})
			],
			['webp', (p) => p.webp({ quality: region.webpQuality, effort: 6, smartSubsample: true })]
		]) {
			const file = `${region.name}-${HASH}-${tier}w.${ext}`;
			keep.add(file);
			await encode(base.clone()).toFile(join(OUT_DIR, file));
		}

		console.log(`✓ ${region.name}-${HASH}-${tier}w (avif + webp)`);
	}
}

// Sweep superseded slices and grain tiles. Matched by explicit pattern rather
// than "anything we didn't just write", so the hand-made noise-128.{png,webp}
// haze tile — not produced here, still used by .sky-bg — is never collected.
keep.add(GRAIN_FILE);
const names = REGIONS.map((r) => r.name).join('|');
const SWEEPABLE = [
	new RegExp(`^(${names})-[0-9a-f]{8}-\\d+w\\.(avif|webp)$`),
	new RegExp(`^(${names})-\\d+w\\.(avif|webp)$`), // pre-hash generation
	/^grain-[0-9a-f]{8}-\d+\.png$/
];
for (const f of await readdir(OUT_DIR)) {
	if (keep.has(f) || !SWEEPABLE.some((re) => re.test(f))) continue;
	await unlink(join(OUT_DIR, f));
	console.log(`  removed superseded ${f}`);
}

await writeFile(
	MANIFEST,
	`// GENERATED by scripts/optimize-bg.js — do not edit.
//
// Landing scene plate slices. Filenames carry a hash of the MASTER that
// produced them, because /assets/* is served immutable for a year
// (static/_headers): a new plate yields new URLs rather than art edited in
// place, which a cached browser would never re-fetch. Import from here instead
// of building the paths by hand, so neither the hash nor the tier list can go
// stale in a second location.

/** Plate tier widths, in source px — full plate (frame + L/R bleed). */
export const SCENE_TIERS = [${TIERS.join(', ')}] as const;

/** Source rows the sky slice continues past the horizon, to run UNDER the
 *  floor and kill the rasterisation hairline where the two layers meet. The
 *  layout grows the sky image box by exactly this; see the note in the
 *  script. */
export const SCENE_SKY_OVERLAP_SRC = ${SKY_OVERLAP_SRC};

export const SCENE_SKY = '/assets/landing/sky-${HASH}';
export const SCENE_FLOOR = '/assets/landing/floor-${HASH}';

/** Mid-grey dither tile laid over the plates to break encode banding.
 *  Lossless PNG — see the note in the script; a lossy re-encode dithers
 *  nothing. Distinct from the near-white noise-128 haze on .sky-bg. */
export const SCENE_GRAIN = '/assets/landing/${GRAIN_FILE}';

/** The grain tile's gaussian σ, in 8-bit levels. The scene shader's additive
 *  dither term divides by this to express its strength in levels — keep it in
 *  step with the tile above. */
export const SCENE_GRAIN_SIGMA = ${GRAIN_SIGMA};

/** \`srcset\` for one region base, e.g. srcsetFor(SCENE_SKY, 'avif'). */
export function srcsetFor(base: string, ext: 'avif' | 'webp'): string {
	return SCENE_TIERS.map((w) => \`\${base}-\${w}w.\${ext} \${w}w\`).join(', ');
}
`
);

console.log(`manifest -> src/lib/data/sceneAssets.generated.ts (master ${HASH})`);
console.log('done');
