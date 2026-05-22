import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(PROJECT_ROOT, 'src/lib/stars.ts');

// --- Tuning parameters ---------------------------------------------------

// Seed the PRNG so the starfield is identical run-to-run.
// Change the seed to reshuffle; commit the regenerated stars.ts.
const SEED = 0x6e617465;

// Total star count across the sky region.
const COUNT = 800;

// Sky region in plate-relative %. (0,0) = top-left of the 1:1 plate.
// Per Nate, sky occupies the top 65% of the plate (a 1.54:1 box
// aligned with the plate's top edge). No stars on the ground below.
const SKY = { xMin: 0, xMax: 100, yMin: 0, yMax: 65 };

// Animation mix (must sum to 1).
const ANIM_MIX = { gentle: 0.9, jitter: 0.05, dramatic: 0.05 };

// Color mix (must sum to 1). Biased white per Nate's brighter/whiter preference.
const COLOR_MIX = { white: 0.7, warm: 0.15, cool: 0.1, yellow: 0.04, amber: 0.01 };

// Halo (soft static glow) probability for non-jitter stars.
// Jitter stars are always halo'd — the dancing halo is part of the jitter effect.
const HALO_BASE_PROB = 0.22;
// Larger stars are slightly more likely to halo (looks more natural).
const HALO_SIZE_BOOST = 0.18;

// Star size in CSS pixels (diameter). Quadratic distribution biased small,
// so most stars are pinpoints with occasional brighter neighbors.
const SIZE_MIN = 2.0;
const SIZE_MAX = 2.6;

// Spatial distribution uniformity (Mitchell's best-candidate sampling).
// 1 = pure random (clumpy); 10-20 = noticeably more uniform but still
// random-looking; 30+ starts to feel like a regular pattern. Fractional
// values interpolate stochastically — 1.5 means each star independently
// uses 1 candidate (50%) or 2 candidates (50%).
const CANDIDATE_COUNT = 1.5;

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

// --- Generate -----------------------------------------------------------

const stars = [];

// Best-candidate sampler: returns the candidate position farthest from any
// existing star, producing blue-noise spacing without strict minimum-distance
// rejection. Fractional CANDIDATE_COUNT is resolved per-star by rolling the
// fractional part — so 1.5 picks k=1 or k=2 with equal probability.
const _kFloor = Math.floor(CANDIDATE_COUNT);
const _kFrac = CANDIDATE_COUNT - _kFloor;
function pickPosition() {
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

for (let i = 0; i < COUNT; i++) {
	const { x, y } = pickPosition();

	// Quadratic-weighted size — small bias.
	const sizeRoll = rand();
	const size = SIZE_MIN + sizeRoll * sizeRoll * (SIZE_MAX - SIZE_MIN);

	const animation = pickWeighted(rand(), ANIM_MIX);
	const color = pickWeighted(rand(), COLOR_MIX);

	const sizeFraction = (size - SIZE_MIN) / (SIZE_MAX - SIZE_MIN);
	const haloProb = HALO_BASE_PROB + sizeFraction * HALO_SIZE_BOOST;
	const halo = animation === 'jitter' || rand() < haloProb;

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

	stars.push(star);
}

// --- Write --------------------------------------------------------------

const summary = {
	count: stars.length,
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
	/** Plate-relative X position, 0-100. */
	x: number;
	/** Plate-relative Y position, 0-100. 0 = top of plate (far above viewport). */
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
