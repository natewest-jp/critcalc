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
// region above the horizon — rows 0..2674 of the 6400×4000 ascend master).
// The same density is applied inside and outside the band — band stars from
// the second pass below stack additively on top.
//
// Count is AREA-SCALED so DENSITY is the yardstick, not raw count. History:
// the retired 5340×1451 sky ran 400 (~5.2e-5 /px²); plate v1 (6400×3184) ran
// 1200 (~5.9e-5, "a little sparse" — Nate); plate v2 (6400×2671) ran 1400
// (~8.2e-5), then DOUBLED to 2800 (~1.64e-4) per Nate's 2026-08-04
// composition call — the ratified density. Plate v4's sky is 6400×3026
// (~19.4Mpx²), so 3150 holds it. WebGL point sprites make count nearly free
// — the knob is taste, not perf.
const SKY_COUNT = 3150;
// Pull the bottom edge of the whole starfield up off the horizon so no star
// sits on — or gets clipped by — the horizon line. BOTTOM_MARGIN is in
// twinkle-element % (100 = horizon = top of floor); HORIZON_CUTOFF is the
// resulting lower Y bound, applied to the whole-sky pass here and as a clamp
// on the galaxy band's bottom edge (bandBottomY). Dial up for more clearance.
const BOTTOM_MARGIN = 1;
const HORIZON_CUTOFF = 100 - BOTTOM_MARGIN;
const SKY = { xMin: 0, xMax: 100, yMin: 0, yMax: HORIZON_CUTOFF };

// --- Size tiers (Nate's 2026-08-04 composition) ---
// DISCRETE small/medium tiers replace the old continuous size ramp, mixed
// 2:1 small:medium in BOTH distributions; a little per-star spread keeps a
// tier from reading as one exact pixel size. HERO stars exist only in the
// galaxy band: four-point ✦ sparks with an additive glow (rendered by their
// own fragment path in starfield.ts — `size` is the spark's ARM-SPAN, and
// per Nate it stays only slightly larger than a medium star's disc).
const SIZE_TIERS = {
	small: { min: 1.8, max: 2.2, haloProb: 0.15 },
	medium: { min: 2.4, max: 2.8, haloProb: 0.35 },
	// Hero arm-span: first cut was 3.9–4.5 ("not much larger than medium") but
	// at that size the ✦ silhouette reads as a dot — the spikes are thinner
	// than a device pixel (Nate, on-display 2026-08-04). The spark needs
	// roughly 2.5× a medium disc before the points survive antialiasing;
	// sized up in two Nate passes (→6–7 → this).
	hero: { min: 6.8, max: 7.8, haloProb: 1 }
};
const SMALL_SHARE = 2 / 3; // small : medium = 2 : 1
const pickTier = () => (rand() < SMALL_SHARE ? 'small' : 'medium');

// --- Galaxy band distribution ---
// Denser starfield concentrated within the galaxy band, defined by its top
// and bottom edges as POLYLINES in master source px — measured by Nate off
// the 6400×4000 ascend master (2026-08-04). Source-pixel values for direct
// measurement against the plate; converted to % below.
const SKY_SRC_WIDTH = 6400; // sky image's source-px width (the full plate)
const SKY_SRC_HEIGHT = 3026; // sky image's source-px height (rows 0..3025)
// Plate v4's band (Nate's four points, 2026-08-04): a VERTICAL trapezoid
// wedge — narrow base on the horizon (x 2222–2782), widening to the plate
// top (x 3166–5333). Its left/right edges still decompose into per-column
// TOP/BOTTOM polylines: the left edge (2222,3025)→(3166,0) bounds the top
// (zenith-side) until the band reaches the plate top; the right edge
// (2782,3025)→(5333,0) bounds the bottom (horizon-side). Columns outside
// x 2222–5333 fall out naturally (top extrapolates below the horizon on the
// left, bottom below zero on the right → bandDensity 0).
const BAND_TOP_SRC = [
	[2222, 3025],
	[3166, 0],
	[5333, 0]
];
const BAND_BOTTOM_SRC = [
	[2222, 3025],
	[2782, 3025],
	[5333, 0]
];
// Area-scaled like SKY_COUNT: the ratified band density is ~3.9e-4 /px²
// (v1's 3200 over ~8.2Mpx², "pretty good" — Nate); this trapezoid is
// (560+2167)/2 × 3025 ≈ 4.1Mpx², so 1600 holds it (small+medium; heroes
// ride on top).
const BAND_COUNT = 1600;
// Density falloff inset from the band's top and bottom edges. Stars are
// sampled within the band quad (no outer buffer) and accepted with
// probability that tapers linearly from 0 at each edge to 1 BAND_FALLOFF %
// inside. The band's center stays at full density; the edges fade out
// smoothly into the surrounding sky.
// Note: where the band is narrow (left side ≈17%), top and bottom taper
// zones approach each other and the full-density core shrinks; if narrow
// sections feel washed out, dial BAND_FALLOFF down. 0 = hard edges again.
const BAND_FALLOFF = 10;
// Hero stars scattered through the band — "only a few, maybe 20 or 30
// overall" (Nate 2026-08-04). Placed with a high best-candidate count so the
// handful spreads evenly along the band instead of clumping.
const HERO_COUNT = 24;
const HERO_SPREAD_CANDIDATES = 12;

// Animation split (Nate 2026-08-04): small/medium stars are 25% flicker
// (jitter) / 75% pulse (gentle) — his first spec was 50/50, dialed down after
// an on-display look ("a little too much flicker"). Heroes are ALL flicker —
// flagged test-and-see — on a slower clock than the field (1.1–2.0s vs
// 0.7–1.4s) and at HALF depth (HERO_FLICKER_SCALE in starfield.ts), peaking
// at base = 1 so every ✦ hits full brightness. `dramatic` is retired from
// generation (the decoder and shader still support it).
const FLICKER_SHARE = 0.25;

// Color mix (must sum to 1). Biased white per Nate's brighter/whiter preference.
const COLOR_MIX = { white: 0.7, warm: 0.15, cool: 0.1, yellow: 0.04, amber: 0.01 };

// Spatial distribution uniformity (Mitchell's best-candidate sampling).
// 1 = pure random (clumpy); 10-20 = noticeably more uniform but still
// random-looking; 30+ starts to feel like a regular pattern. Fractional
// values interpolate stochastically — 1.5 means each star independently
// uses 1 candidate (50%) or 2 candidates (50%).
const CANDIDATE_COUNT = 1.2;

// --- Derived band geometry ----------------------------------------------

// Band edges in twinkle-element % (x: % of plate width, y: % of sky height).
const toPct = (points) =>
	points.map(([x, y]) => [(x / SKY_SRC_WIDTH) * 100, (y / SKY_SRC_HEIGHT) * 100]);
const BAND_TOP = toPct(BAND_TOP_SRC);
const BAND_BOTTOM = toPct(BAND_BOTTOM_SRC);

// Piecewise-linear interpolation along an edge polyline (points ordered by
// ascending x, spanning 0..100).
function edgeY(edge, x) {
	for (let i = 1; i < edge.length; i++) {
		const [x0, y0] = edge[i - 1];
		const [x1, y1] = edge[i];
		if (x <= x1 || i === edge.length - 1) {
			return y0 + ((y1 - y0) * (x - x0)) / Math.max(x1 - x0, 1e-6);
		}
	}
}

function bandTopY(x) {
	return edgeY(BAND_TOP, x);
}
function bandBottomY(x) {
	// Clamp the band's lower edge to the same horizon margin as the whole-sky
	// pass — its bottom-left run sits ON the horizon row otherwise. Density
	// still tapers to 0 across BAND_FALLOFF inside this.
	return Math.min(edgeY(BAND_BOTTOM, x), HORIZON_CUTOFF);
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
// next to whole-sky stars at the band's edges. `kOverride` forces a higher
// candidate count — the hero pass uses it to spread its handful evenly.
function pickBandPosition(stars, kOverride) {
	const k = kOverride ?? (_kFrac > 0 ? _kFloor + (rand() < _kFrac ? 1 : 0) : _kFloor);
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

function generateStar(x, y, tierName) {
	const tier = SIZE_TIERS[tierName];
	const hero = tierName === 'hero';
	// Uniform within the tier's narrow range — the tiers themselves carry the
	// size structure now, so no small-bias curve.
	const size = tier.min + rand() * (tier.max - tier.min);

	const animation = hero || rand() < FLICKER_SHARE ? 'jitter' : 'gentle';
	const color = pickWeighted(rand(), COLOR_MIX);

	// Halo is probabilistic per tier, independent of animation type — a
	// flickering no-halo pinpoint is allowed and reads nicely. Heroes always
	// glow (their fragment path draws the glow beneath the spark).
	const halo = rand() < tier.haloProb;

	// Animation timing. Jitter is a rapid flicker (heroes run a statelier
	// clock — see the note on FLICKER_SHARE); gentle is a slow pulse.
	const duration =
		animation === 'jitter'
			? hero
				? 1.1 + rand() * 0.9 // 1.1–2.0s
				: 0.7 + rand() * 0.7 // 0.7–1.4s
			: 3.5 + rand() * 4.5; // 3.5–8s

	// Negative delay desynchronizes the cycle start.
	const delay = rand() * Math.max(duration, 4);

	// Each star has its own resting opacity floor — which for jitter stars is
	// also the PEAK (the flicker only dips below it). Heroes pin base = 1 so
	// every ✦ peaks at full brightness (Nate 2026-08-04); their flicker depth
	// is additionally halved in the shader (HERO_FLICKER_SCALE). The roll is
	// consumed either way to keep the PRNG stream — and every star position —
	// stable across this knob.
	const baseRoll = rand();
	const base = hero ? 1 : 0.3 + baseRoll * 0.5; // 0.3–0.8

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
	if (hero) star.hero = true;

	return star;
}

// --- Generate -----------------------------------------------------------

const stars = [];

// Pass 1: whole-sky distribution. Uniform-ish across the full sky region.
for (let i = 0; i < SKY_COUNT; i++) {
	const { x, y } = pickPosition(stars);
	stars.push(generateStar(x, y, pickTier()));
}

// Track where pass 1 ends so the summary can break down counts per distribution.
const skyEnd = stars.length;

// Pass 2: band distribution. Concentrated within the band wedge; the
// best-candidate check sees all pass-1 stars so the band stars naturally
// avoid co-locating with them at the edges of the band.
for (let i = 0; i < BAND_COUNT; i++) {
	const { x, y } = pickBandPosition(stars);
	stars.push(generateStar(x, y, pickTier()));
}

// Pass 3: hero stars — a handful of ✦ sparks scattered through the band,
// spread by a high best-candidate count against every star placed so far.
for (let i = 0; i < HERO_COUNT; i++) {
	const { x, y } = pickBandPosition(stars, HERO_SPREAD_CANDIDATES);
	stars.push(generateStar(x, y, 'hero'));
}

// --- Write --------------------------------------------------------------

const summary = {
	count: stars.length,
	sky: skyEnd,
	band: stars.length - skyEnd - HERO_COUNT,
	hero: HERO_COUNT,
	tier: {
		small: stars.filter((s) => !s.hero && s.size <= SIZE_TIERS.small.max).length,
		medium: stars.filter((s) => !s.hero && s.size > SIZE_TIERS.small.max).length
	},
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
	/** Galaxy-band hero star: rendered as a four-point ✦ spark with an
	 *  additive glow instead of a disc. \`size\` is the spark's arm-span. */
	hero?: boolean;
}
`;

// Packed emission — 16 base-36 chars per star instead of an object literal per
// star (the literal form was 140KB of JS parsed on every route's cold load;
// packed it's ~23KB + a ~1ms decode). The decoder lives in src/lib/stars.ts —
// field layout MUST stay in lockstep with it. All values are 2-decimal (see
// round() above), so ·100 integers round-trip losslessly.
const ANIMS = ['gentle', 'jitter', 'dramatic'];
const COLORS = ['white', 'warm', 'cool', 'yellow', 'amber'];
const VARIANTS = [undefined, 'a', 'b', 'c'];

const b36 = (n, w) => {
	if (!Number.isInteger(n) || n < 0 || n >= 36 ** w) {
		throw new Error(`packed field out of range: ${n} (width ${w})`);
	}
	return n.toString(36).padStart(w, '0');
};
const c100 = (v) => {
	const n = Math.round(v * 100);
	if (Math.abs(n / 100 - v) > 1e-9) throw new Error(`value not 2-decimal: ${v}`);
	return n;
};

const packed = stars
	.map(
		(s) =>
			b36(c100(s.x), 3) +
			b36(c100(s.y), 3) +
			b36(c100(s.size), 2) +
			b36(c100(s.duration), 2) +
			b36(c100(s.delay), 2) +
			b36(c100(s.base), 2) +
			b36(
				ANIMS.indexOf(s.animation) +
					COLORS.indexOf(s.color) * 3 +
					(s.halo ? 15 : 0) +
					VARIANTS.indexOf(s.variant) * 30 +
					(s.hero ? 120 : 0),
				2
			)
	)
	.join('');

const packedLines = [];
for (let i = 0; i < packed.length; i += 128) {
	packedLines.push(`\t'${packed.slice(i, i + 128)}'`);
}

const data = `
// The star field, packed 16 base-36 chars per star (was: one object literal per
// star — 140KB of JS parsed on every route's cold load; packed + decoded it's
// ~23KB and ~1ms of decode). Field layout per star:
//   [0,3)  x·100     [3,6)  y·100     [6,8)  size·100
//   [8,10) duration·100   [10,12) delay·100   [12,14) base·100
//   [14,16) flags = animIdx + colorIdx·3 + halo·15 + variantIdx·30 + hero·120
// All source values are exactly 2-decimal (the generator rounds), so ·100
// round-trips losslessly and the decoded numbers are byte-identical to the old
// literals (verified at conversion, 2026-07-10). The encoder lives in
// scripts/generate-stars.js — keep the two in lockstep.
const PACKED =
${packedLines.join(' +\n')};

const ANIMS: readonly StarAnimation[] = ['gentle', 'jitter', 'dramatic'];
const COLORS: readonly StarColor[] = ['white', 'warm', 'cool', 'yellow', 'amber'];
const VARIANTS: readonly (JitterVariant | undefined)[] = [undefined, 'a', 'b', 'c'];

function decodeStars(packed: string): Star[] {
	const out: Star[] = [];
	for (let i = 0; i < packed.length; i += 16) {
		const n = (at: number, w: number) => parseInt(packed.slice(i + at, i + at + w), 36);
		const flags = n(14, 2);
		const star: Star = {
			x: n(0, 3) / 100,
			y: n(3, 3) / 100,
			size: n(6, 2) / 100,
			animation: ANIMS[flags % 3],
			color: COLORS[Math.floor(flags / 3) % 5],
			halo: Math.floor(flags / 15) % 2 === 1,
			duration: n(8, 2) / 100,
			delay: n(10, 2) / 100,
			base: n(12, 2) / 100
		};
		const variant = VARIANTS[Math.floor(flags / 30) % 4];
		if (variant) star.variant = variant;
		if (Math.floor(flags / 120) === 1) star.hero = true;
		out.push(star);
	}
	return out;
}

export const stars: readonly Star[] = decodeStars(PACKED);
`;

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, banner + types + data);

console.log(`Generated ${stars.length} stars -> ${OUT}`);
console.log('Composition:', summary);
