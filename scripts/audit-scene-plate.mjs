#!/usr/bin/env node
/**
 * audit-scene-plate — what a landing-plate re-export actually changed.
 *
 * Nate re-exports assets-src/landing/scene-6400-8bit.png, `npm run optimize-bg`
 * turns it into the shipped tiers, and the only question that follows is
 * whether the new plate did what he meant it to. Five re-exports in one evening
 * (2026-09-04) were measured by five throwaway probes, which is what this
 * replaces: the numbers were reproducible and the round kept needing them, so
 * the instrument is now permanent rather than re-derived each time.
 *
 *   node scripts/audit-scene-plate.mjs                 # working tree vs HEAD's plate
 *   node scripts/audit-scene-plate.mjs --against origin/main
 *   node scripts/audit-scene-plate.mjs --tier 3200 --json
 *
 * ⚠️ The baseline comes from GIT, not from disk, and it has to: optimize-bg
 * sweeps the superseded tiers as it writes the new ones (the immutable-assets
 * contract), so by the time there is anything to compare, the thing to compare
 * against exists only in history. `--against` takes any ref; the hash is read
 * out of that ref's copy of the generated manifest rather than guessed.
 *
 * ⚠️ It compares ENCODED tier to ENCODED tier through one instrument, never a
 * master to a tier. AVIF smooths low-amplitude detail, and it smooths more of
 * it in a darker plate — so a master-vs-tier reading would attribute the
 * encoder's work to the export.
 *
 * ⚠️⚠️ Edge energy MUST be read against its own band mean. A darker plate has
 * proportionally less absolute contrast everywhere, so raw edge energy falls
 * whenever exposure does and says nothing about whether detail survived; the
 * `edge/mean` rows are the ones that answer "are the reflections still there".
 * The 2026-09-04 round turned on exactly this distinction twice.
 *
 * The metrics, and what each is for:
 *   sat / val / hue   HSV means over the region; hue is circular, weighted by
 *                     saturation so near-grey pixels do not vote.
 *   percentiles       Luma. The quantile transfer (base -> new at each) is what
 *                     separates an exposure change from a contrast change: a
 *                     flat row of ratios is exposure, a rising one is a curve.
 *   horizon           Mean luma of sky row -5 (just above the contact line) and
 *                     the floor rows below it — the glow the eye reads first.
 *   plateau           Share of vertically adjacent pixels with equal luma. The
 *                     banding proxy; the scene shader's --scene-dither is what
 *                     answers it, so a move here is information, not a defect.
 *   clip              Share of pixels at 0 or 255 in any channel. Headroom.
 *   edge / edge-mean  Mean |horizontal delta| of luma, per floor band. The
 *                     floor's reflections are vertical streaks, so horizontal
 *                     energy is what measures them.
 *   col peak/med      Column-mean profile's p99 over its median — the BROAD
 *                     band reflection, which survives a crush that erases the
 *                     fine streaks. Read it beside edge/mean, not instead.
 */

import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = 'src/lib/data/sceneAssets.generated.ts';
const OUT_DIR = 'static/assets/landing';

// Floor bands, in source rows below the horizon. The split is where the art
// changes character: the horizon glow, the near ground the band reflection
// falls on, and the deep floor the star streaks run down.
const FLOOR_BANDS = [
	['top 100', 0, 100],
	['100-300', 100, 300],
	['300+', 300, Infinity]
];

const QUANTILES = [0.02, 0.1, 0.2, 0.3, 0.5, 0.7, 0.8, 0.9, 0.98, 1];

function parseArgs(argv) {
	const out = { against: 'HEAD', tier: 6400, json: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--against') out.against = argv[++i];
		else if (a === '--tier') out.tier = Number(argv[++i]);
		else if (a === '--json') out.json = true;
		else if (a === '--help' || a === '-h') out.help = true;
		else throw new Error(`unknown argument ${a}`);
	}
	return out;
}

const git = (args) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 28 });

/** A ref's generated manifest, or the working tree's. */
function manifestAt(ref) {
	return ref === null
		? readFileSync(resolve(ROOT, MANIFEST), 'utf8')
		: git(['show', `${ref}:${MANIFEST}`]).toString('utf8');
}

/** The plate hash a manifest names. */
function hashOf(src, where) {
	const m = src.match(/SCENE_SKY = '\/assets\/landing\/sky-([0-9a-f]+)'/);
	if (!m) throw new Error(`no SCENE_SKY hash in ${where}'s manifest`);
	return m[1];
}

/** Rows the sky crop runs PAST the horizon to underlap the floor. Read from the
 *  manifest rather than assumed: those rows are the floor's art, so a reading of
 *  "the sky at the horizon" that includes them measures the ground instead. */
function overlapOf(src) {
	const m = src.match(/SCENE_SKY_OVERLAP_SRC = (\d+)/);
	return m ? Number(m[1]) : 0;
}

/** Tier bytes: from disk for the working tree, from the ref's blob otherwise. */
function plateBytes(ref, region, hash, tier) {
	const path = `${OUT_DIR}/${region}-${hash}-${tier}w.avif`;
	return ref === null ? readFileSync(resolve(ROOT, path)) : git(['show', `${ref}:${path}`]);
}

async function measure(bytes) {
	const { data, info } = await sharp(bytes)
		.removeAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const { width: w, height: h, channels: c } = info;
	const luma = new Float64Array(w * h);
	let satSum = 0;
	let valSum = 0;
	let hueX = 0;
	let hueY = 0;
	let n = 0;
	let clipLo = 0;
	let clipHi = 0;
	for (let i = 0, p = 0; i < data.length; i += c, p++) {
		const r = data[i] / 255;
		const g = data[i + 1] / 255;
		const b = data[i + 2] / 255;
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const d = max - min;
		const s = max === 0 ? 0 : d / max;
		satSum += s;
		valSum += max;
		n++;
		if (d > 0) {
			let deg;
			if (max === r) deg = 60 * (((g - b) / d) % 6);
			else if (max === g) deg = 60 * ((b - r) / d + 2);
			else deg = 60 * ((r - g) / d + 4);
			if (deg < 0) deg += 360;
			const rad = (deg * Math.PI) / 180;
			// Saturation-weighted, so a near-grey pixel does not drag the mean.
			hueX += s * Math.cos(rad);
			hueY += s * Math.sin(rad);
		}
		if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) clipLo++;
		if (data[i] === 255 || data[i + 1] === 255 || data[i + 2] === 255) clipHi++;
		luma[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
	}
	let same = 0;
	let pairs = 0;
	for (let y = 0; y < h - 1; y++) {
		for (let x = 0; x < w; x++) {
			if (Math.round(luma[y * w + x]) === Math.round(luma[(y + 1) * w + x])) same++;
			pairs++;
		}
	}
	let hue = (Math.atan2(hueY, hueX) * 180) / Math.PI;
	if (hue < 0) hue += 360;
	const sorted = Float64Array.from(luma).sort();
	return {
		w,
		h,
		luma,
		sat: satSum / n,
		val: valSum / n,
		hue,
		plateau: same / pairs,
		clipLo: (clipLo / n) * 100,
		clipHi: (clipHi / n) * 100,
		q: (f) => sorted[Math.floor(f * (sorted.length - 1))]
	};
}

const rowMean = ({ luma, w }, y) => {
	let s = 0;
	for (let x = 0; x < w; x++) s += luma[y * w + x];
	return s / w;
};

const bandMean = ({ luma, w, h }, y0, y1) => {
	const end = Math.min(y1, h);
	let s = 0;
	let n = 0;
	for (let y = y0; y < end; y++) {
		for (let x = 0; x < w; x++) {
			s += luma[y * w + x];
			n++;
		}
	}
	return s / n;
};

/** Mean |horizontal delta| of luma over a row band — vertical-streak energy. */
const bandEdge = ({ luma, w, h }, y0, y1) => {
	const end = Math.min(y1, h);
	let e = 0;
	let n = 0;
	for (let y = y0; y < end; y++) {
		for (let x = 0; x < w - 1; x++) {
			e += Math.abs(luma[y * w + x] - luma[y * w + x + 1]);
			n++;
		}
	}
	return e / n;
};

/** Column-mean profile p99 over its median: the BROAD band reflection. */
function colPeak({ luma, w, h }, y0, y1) {
	const end = Math.min(y1, h);
	const prof = new Float64Array(w);
	for (let y = y0; y < end; y++) for (let x = 0; x < w; x++) prof[x] += luma[y * w + x];
	for (let x = 0; x < w; x++) prof[x] /= end - y0;
	const s = [...prof].sort((a, b) => a - b);
	return s[Math.floor(s.length * 0.99)] / s[Math.floor(s.length / 2)];
}

function regionReport(m, isFloor, opts) {
	const r = {
		sat: m.sat,
		val: m.val,
		hue: m.hue,
		plateau: m.plateau,
		clipLo: m.clipLo,
		clipHi: m.clipHi,
		q: Object.fromEntries(QUANTILES.map((f) => [f, m.q(f)]))
	};
	if (isFloor) {
		r.horizon = rowMean(m, 0);
		r.bands = FLOOR_BANDS.map(([name, y0, y1]) => {
			const mean = bandMean(m, y0, y1);
			const edge = bandEdge(m, y0, y1);
			return { name, mean, edge, edgeOverMean: (edge / mean) * 1e4, colPeak: colPeak(m, y0, y1) };
		});
	} else {
		// The last TRUE sky row: everything below it in this crop is the floor's
		// art, carried down to underlap the seam.
		r.horizon = rowMean(m, m.h - opts.skyOverlap - 1);
	}
	return r;
}

const pct = (a, b) => `${(((b - a) / a) * 100).toFixed(1)}%`;

function printRegion(name, base, next) {
	console.log(`\n${name}`);
	console.log(
		`  sat  ${base.sat.toFixed(3)} -> ${next.sat.toFixed(3)} (${pct(base.sat, next.sat)})` +
			`   val ${base.val.toFixed(3)} -> ${next.val.toFixed(3)} (${pct(base.val, next.val)})` +
			`   hue ${base.hue.toFixed(1)} -> ${next.hue.toFixed(1)}`
	);
	console.log(
		`  plateau ${(base.plateau * 100).toFixed(1)}% -> ${(next.plateau * 100).toFixed(1)}%` +
			`   clip ${base.clipLo.toFixed(3)}/${base.clipHi.toFixed(3)}% -> ${next.clipLo.toFixed(3)}/${next.clipHi.toFixed(3)}%` +
			`   horizon ${base.horizon.toFixed(1)} -> ${next.horizon.toFixed(1)}`
	);
	console.log(
		'  luma  ' +
			QUANTILES.map((f) => {
				const a = base.q[f];
				const b = next.q[f];
				return `${(f * 100).toFixed(0)}%:${a.toFixed(0)}->${b.toFixed(0)}(x${(b / a).toFixed(2)})`;
			}).join(' ')
	);
	if (!next.bands) return;
	console.log('  band            mean            edge            edge/mean       col peak/med');
	for (let i = 0; i < next.bands.length; i++) {
		const a = base.bands[i];
		const b = next.bands[i];
		console.log(
			`  ${b.name.padEnd(10)} ${a.mean.toFixed(1).padStart(6)} -> ${b.mean.toFixed(1).padEnd(6)}` +
				`  ${a.edge.toFixed(3)} -> ${b.edge.toFixed(3)}` +
				`  ${a.edgeOverMean.toFixed(2).padStart(5)} -> ${b.edgeOverMean.toFixed(2).padEnd(5)} (${pct(a.edgeOverMean, b.edgeOverMean).padStart(6)})` +
				`  ${a.colPeak.toFixed(3)} -> ${b.colPeak.toFixed(3)}`
		);
	}
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
	console.log(
		readFileSync(new URL(import.meta.url))
			.toString()
			.split('*/')[0]
	);
	process.exit(0);
}

const baseManifest = manifestAt(args.against);
const nextManifest = manifestAt(null);
const baseHash = hashOf(baseManifest, args.against);
const nextHash = hashOf(nextManifest, 'the working tree');
if (baseHash === nextHash) {
	console.error(
		`Both plates are ${nextHash} — nothing to compare.\n` +
			`Run \`npm run optimize-bg\` after the new master lands, or pass --against <earlier ref>.`
	);
	process.exit(1);
}

const report = {
	against: args.against,
	tier: args.tier,
	base: baseHash,
	next: nextHash,
	regions: {}
};
for (const region of ['sky', 'floor']) {
	const isFloor = region === 'floor';
	const base = regionReport(
		await measure(plateBytes(args.against, region, baseHash, args.tier)),
		isFloor,
		{
			skyOverlap: overlapOf(baseManifest)
		}
	);
	const next = regionReport(await measure(plateBytes(null, region, nextHash, args.tier)), isFloor, {
		skyOverlap: overlapOf(nextManifest)
	});
	report.regions[region] = { base, next };
}

if (args.json) {
	console.log(JSON.stringify(report, null, 2));
} else {
	console.log(
		`scene plate ${baseHash} (${args.against}) -> ${nextHash} (working tree), ${args.tier}w AVIF`
	);
	printRegion('sky', report.regions.sky.base, report.regions.sky.next);
	printRegion('floor', report.regions.floor.base, report.regions.floor.next);
	console.log(
		'\nedge/mean is the reflection reading — raw edge falls with exposure and says nothing on its own.'
	);
}
