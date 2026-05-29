import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(PROJECT_ROOT, 'src/lib/stars.ts');

// --- Tuning parameters ---------------------------------------------------

// Seed the PRNG so the starfield is identical run-to-run.
// Change the seed to reshuffle; commit the regenerated stars.ts.
const SEED = 0x6e617465;

// --- Whole-sky distribution ---
// Stars scattered uniformly across the entire .twinkle element (the sky
// region above the horizon, in source coords rows 0..2767 of the 5120×3840
// master). The same density is applied inside and outside the band — band
// stars from the second pass below stack additively on top.
const SKY_COUNT = 700;
// Pull the bottom edge of the whole starfield up off the horizon so no star
// sits on — or gets clipped by — the horizon line. BOTTOM_MARGIN is in
// twinkle-element % (100 = horizon = top of floor); HORIZON_CUTOFF is the
// resulting lower Y bound, applied to the whole-sky pass here and as a clamp
// on the galaxy band's bottom edge (bandBottomY). Dial up for more clearance.
const BOTTOM_MARGIN = 1;
const HORIZON_CUTOFF = 100 - BOTTOM_MARGIN;
const SKY = { xMin: 0, xMax: 100, yMin: 0, yMax: HORIZON_CUTOFF };
const SKY_PARAMS = {
	sizeMin: 2.0,
	sizeMax: 2.6,
	haloBaseProb: 0.22,
	haloSizeBoost: 0.18
};

// --- Galaxy band distribution ---
// Denser starfield concentrated within a quadrilateral defined by the band's
// Y extents at the left and right edges of the source image. Source-pixel
// values for direct measurement against the master; converted to %.
const SKY_SRC_HEIGHT = 2768; // sky image's source-px height (rows 0..2767)
const BAND_SRC = {
	topLeft: 2296,
	topRight: 1514,
	bottomLeft: 2756,
	bottomRight: 2637
};
const BAND_COUNT = 800;
// Density falloff inset from the band's top and bottom edges. Stars are
// sampled within the band quad (no outer buffer) and accepted with
// probability that tapers linearly from 0 at each edge to 1 BAND_FALLOFF %
// inside. The band's center stays at full density; the edges fade out
// smoothly into the surrounding sky.
// Note: where the band is narrow (left side ≈17%), top and bottom taper
// zones approach each other and the full-density core shrinks; if narrow
// sections feel washed out, dial BAND_FALLOFF down. 0 = hard edges again.
const BAND_FALLOFF = 8;
// Band stars are slightly smaller-biased and less halo-prone — the baked
// galaxy dust already supplies ambient glow inside the band, so big haloed
// stars on top would over-stack. Smaller pinpoints in a dense cluster read
// more naturally as a starcloud.
const BAND_PARAMS = {
	sizeMin: 2.0,
	sizeMax: 3.0,
	haloBaseProb: 0.22,
	haloSizeBoost: 0.18
};

// Animation mix (must sum to 1) — shared across both distributions.
// jitter = the fast-flicker stars; bumped from 0.05, taken from gentle so
// dramatic is unchanged. Count is stochastic per regen, so the weight is
// tuned by checking the resulting count rather than by arithmetic.
const ANIM_MIX = { gentle: 0.89, jitter: 0.06, dramatic: 0.05 };

// Color mix (must sum to 1). Biased white per Nate's brighter/whiter preference.
const COLOR_MIX = { white: 0.7, warm: 0.15, cool: 0.1, yellow: 0.04, amber: 0.01 };

// Spatial distribution uniformity (Mitchell's best-candidate sampling).
// 1 = pure random (clumpy); 10-20 = noticeably more uniform but still
// random-looking; 30+ starts to feel like a regular pattern. Fractional
// values interpolate stochastically — 1.5 means each star independently
// uses 1 candidate (50%) or 2 candidates (50%).
const CANDIDATE_COUNT = 1.2;

// --- Derived band geometry ----------------------------------------------

// Band corners in twinkle-element % (linearly interpolated along X to get
// the band's local top/bottom Y at any column).
const BAND = {
	topLeft: (BAND_SRC.topLeft / SKY_SRC_HEIGHT) * 100,
	topRight: (BAND_SRC.topRight / SKY_SRC_HEIGHT) * 100,
	bottomLeft: (BAND_SRC.bottomLeft / SKY_SRC_HEIGHT) * 100,
	bottomRight: (BAND_SRC.bottomRight / SKY_SRC_HEIGHT) * 100
};

function bandTopY(x) {
	return BAND.topLeft + (BAND.topRight - BAND.topLeft) * (x / 100);
}
function bandBottomY(x) {
	const y = BAND.bottomLeft + (BAND.bottomRight - BAND.bottomLeft) * (x / 100);
	// Clamp the band's lower edge to the same horizon margin as the whole-sky
	// pass — its bottom-left corner otherwise dips to ~99.6% (right on the
	// horizon). Density still tapers to 0 across BAND_FALLOFF inside this.
	return Math.min(y, HORIZON_CUTOFF);
}

// Acceptance probability at (x, y) for the band distribution: 0 outside
// the band entirely, 0 at each band edge, tapering linearly to 1 across
// BAND_FALLOFF % inward from each edge. Where the band is wider than
// 2 × BAND_FALLOFF, the middle stays at full density; narrower sections
// peak below 1 (density falls off from both edges simultaneously).
function bandDensity(x, y) {
	const topY = bandTopY(x);
	const bottomY = bandBottomY(x);
	if (y < topY || y > bottomY) return 0;
	if (BAND_FALLOFF <= 0) return 1;
	const distFromNearestEdge = Math.min(y - topY, bottomY - y);
	return distFromNearestEdge >= BAND_FALLOFF ? 1 : distFromNearestEdge / BAND_FALLOFF;
}

// --- PRNG ----------------------------------------------------------------

// Mulberry32 — small, fast, well-distributed for non-crypto seeded RNG.
function mulberry32(seed) {
	let s = seed >>> 0;
	return function () {
		s = (s + 0x6d2b79f5) | 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const rand = mulberry32(SEED);

// --- Helpers -------------------------------------------------------------

function pickWeighted(roll, weights) {
	let acc = 0;
	for (const [key, w] of Object.entries(weights)) {
		acc += w;
		if (roll < acc) return key;
	}
	return Object.keys(weights).at(-1);
}

function round(n, decimals = 2) {
	const k = 10 ** decimals;
	return Math.round(n * k) / k;
}

// --- Position pickers ----------------------------------------------------

// Best-candidate sampler: returns the candidate position farthest from any
// existing star, producing blue-noise spacing without strict minimum-distance
// rejection. Fractional CANDIDATE_COUNT resolved per-star by rolling the
// fractional part — so 1.5 picks k=1 or k=2 with equal probability.
const _kFloor = Math.floor(CANDIDATE_COUNT);
const _kFrac = CANDIDATE_COUNT - _kFloor;

function pickPosition(stars) {
	const k = _kFrac > 0 ? _kFloor + (rand() < _kFrac ? 1 : 0) : _kFloor;
	let bestX = 0;
	let bestY = 0;
	let bestDist = -1;
	for (let c = 0; c < k; c++) {
		const cx = SKY.xMin + rand() * (SKY.xMax - SKY.xMin);
		const cy = SKY.yMin + rand() * (SKY.yMax - SKY.yMin);
		let minDist = Infinity;
		for (const p of stars) {
			const dx = p.x - cx;
			const dy = p.y - cy;
			const d = dx * dx + dy * dy;
			if (d < minDist) minDist = d;
		}
		if (minDist > bestDist) {
			bestDist = minDist;
			bestX = cx;
			bestY = cy;
		}
	}
	return { x: bestX, y: bestY };
}

// Same best-candidate algorithm but candidates are drawn from within the
// band quad and accepted with probability bandDensity(x, y) — peaking at the
// band's center and tapering to 0 at the edges. Rejected candidates are
// replaced with new draws until k acceptances accumulate. Distance check is
// against ALL existing stars (whole-sky + band) so band stars don't bunch up
// next to whole-sky stars at the band's edges.
function pickBandPosition(stars) {
	const k = _kFrac > 0 ? _kFloor + (rand() < _kFrac ? 1 : 0) : _kFloor;
	let bestX = 0;
	let bestY = 0;
	let bestDist = -1;
	let accepted = 0;
	let attempts = 0;
	const maxAttempts = k * 50;
	while (accepted < k && attempts < maxAttempts) {
		attempts++;
		const cx = rand() * 100;
		const top = bandTopY(cx);
		const bot = bandBottomY(cx);
		const cy = top + rand() * (bot - top);
		if (rand() >= bandDensity(cx, cy)) continue;
		accepted++;
		let minDist = Infinity;
		for (const p of stars) {
			const dx = p.x - cx;
			const dy = p.y - cy;
			const d = dx * dx + dy * dy;
			if (d < minDist) minDist = d;
		}
		if (minDist > bestDist) {
			bestDist = minDist;
			bestX = cx;
			bestY = cy;
		}
	}
	return { x: bestX, y: bestY };
}

// --- Star factory --------------------------------------------------------

function generateStar(x, y, params) {
	// Quadratic-weighted size — small bias.
	const sizeRoll = rand();
	const size = params.sizeMin + sizeRoll * sizeRoll * (params.sizeMax - params.sizeMin);

	const animation = pickWeighted(rand(), ANIM_MIX);
	const color = pickWeighted(rand(), COLOR_MIX);

	const sizeFraction = (size - params.sizeMin) / (params.sizeMax - params.sizeMin);
	const haloProb = params.haloBaseProb + sizeFraction * params.haloSizeBoost;
	// Halo is purely probabilistic, independent of animation type. Jitter
	// (flicker) stars are therefore drawn from the whole field — a flickering
	// no-halo pinpoint is allowed and reads nicely. The flicker itself is a
	// subtle opacity-only animation (no box-shadow), so it costs nothing extra
	// to paint on a non-halo star.
	const halo = rand() < haloProb;

	// Animation timing.
	// Jitter is fast (rapid flicker); gentle/dramatic are slow pulses.
	const duration =
		animation === 'jitter'
			? 0.7 + rand() * 0.7 // 0.7–1.4s
			: animation === 'dramatic'
				? 3 + rand() * 4 // 3–7s
				: 2.5 + rand() * 3.5; // 2.5–6s

	// Negative delay desynchronizes the cycle start.
	const delay = rand() * Math.max(duration, 4);

	// Each star has its own resting opacity floor.
	const base = 0.3 + rand() * 0.5; // 0.3–0.8

	const star = {
		x: round(x),
		y: round(y),
		size: round(size),
		animation,
		color,
		halo,
		duration: round(duration),
		delay: round(delay),
		base: round(base)
	};

	if (animation === 'jitter') {
		// Three keyframe variants prevent visible synchronization across jitter stars.
		star.variant = ['a', 'b', 'c'][Math.floor(rand() * 3)];
	}

	return star;
}

// --- Generate -----------------------------------------------------------

const stars = [];

// Pass 1: whole-sky distribution. Uniform-ish across the full sky region.
for (let i = 0; i < SKY_COUNT; i++) {
	const { x, y } = pickPosition(stars);
	stars.push(generateStar(x, y, SKY_PARAMS));
}

// Track where pass 1 ends so the summary can break down counts per distribution.
const skyEnd = stars.length;

// Pass 2: band distribution. Concentrated within the band wedge; the
// best-candidate check sees all pass-1 stars so the band stars naturally
// avoid co-locating with them at the edges of the band.
for (let i = 0; i < BAND_COUNT; i++) {
	const { x, y } = pickBandPosition(stars);
	stars.push(generateStar(x, y, BAND_PARAMS));
}

// --- Write --------------------------------------------------------------

const summary = {
	count: stars.length,
	sky: skyEnd,
	band: stars.length - skyEnd,
	animation: Object.fromEntries(
		['gentle', 'jitter', 'dramatic'].map((k) => [k, stars.filter((s) => s.animation === k).length])
	),
	color: Object.fromEntries(
		['white', 'warm', 'cool', 'yellow', 'amber'].map((k) => [
			k,
			stars.filter((s) => s.color === k).length
		])
	),
	halo: stars.filter((s) => s.halo).length
};

const banner = `// Auto-generated by scripts/generate-stars.js — DO NOT EDIT BY HAND.
// Regenerate via \`npm run generate-stars\`. Seed: 0x${SEED.toString(16)}.
// Composition: ${JSON.stringify(summary)}
`;

const types = `
export type StarColor = 'white' | 'warm' | 'cool' | 'yellow' | 'amber';
export type StarAnimation = 'gentle' | 'jitter' | 'dramatic';
export type JitterVariant = 'a' | 'b' | 'c';

export interface Star {
	/** Sky-region-relative X position, 0-100. */
	x: number;
	/** Sky-region-relative Y position, 0-100. 0 = top of scene (far above
	 *  viewport at landing rest); 100 = horizon (top of floor). */
	y: number;
	/** Diameter in CSS pixels. */
	size: number;
	animation: StarAnimation;
	color: StarColor;
	/** Soft static glow around the star (always true for jitter stars). */
	halo: boolean;
	/** Animation cycle length in seconds. */
	duration: number;
	/** Animation offset in seconds (applied as negative delay). */
	delay: number;
	/** Resting opacity floor between twinkle peaks. */
	base: number;
	/** Sub-variant keyframe (jitter only). */
	variant?: JitterVariant;
}
`;

// One star per line so regenerations produce readable git diffs.
const lines = stars.map((s) => '\t' + JSON.stringify(s));
const data = `export const stars: readonly Star[] = [\n${lines.join(',\n')}\n];\n`;

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, banner + types + '\n' + data);

console.log(`Generated ${stars.length} stars -> ${OUT}`);
console.log('Composition:', summary);
