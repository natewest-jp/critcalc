import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Regenerates the FINGERPRINT glyphs (lineups design §4.2) from Nate's traced
// SVGs in static/assets/effects/ — inline geometry, never an <img>, so the
// fingerprint can paint its states (lit / outlined / locked / unknown) in code
// and the sub-pixel law holds (alpha in the paint, never element opacity).
//
// THE SOURCE CONTRACT (Nate 2026-10-09): a 24-unit viewBox, FILLS ONLY. A
// two-tone glyph names its quieter half with an id containing "gray" or
// "shade" (Energy Recharge: `Gray-tone`); everything else is the main fill.
// The colours in the file are ignored — the component decides them.
//
// All fifteen facets are drawn (2026-10-12); the two-letter stand-ins are
// retired. A NEW facet needs a line in GLYPHS — until it has one it draws
// nothing, and the generator refuses to finish (below). Export the whole
// 24-unit artboard (the viewBox check below), but where the art sits in it
// and how much of it it fills are DISCARDED: each glyph is cropped to its
// ink and balanced below. ⚠ So optical sizing done in the drawing does not
// survive — a by-eye correction belongs in NUDGE.
//
// Auto-run by the predev/prebuild hooks. Manual: npm run generate-fingerprint

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC = join(ROOT, 'static/assets/effects');
const OUT = join(ROOT, 'src/lib/fingerprintGlyphs.generated.ts');

/** Fingerprint facet → the traced file's stem. */
const GLYPHS = {
	heal: 'Icon_Attribute_Healing',
	shield: 'Icon_Attribute_Shield_Strength',
	taunt: 'Icon_Attribute_Taunt',
	'buff:atk': 'Icon_Attribute_Attack',
	'buff:em': 'Icon_Attribute_Elemental_Mastery',
	'buff:crit': 'Icon_Attribute_Critical_Hit',
	'buff:dmg': 'Icon_Attribute_DMG_Buff',
	'buff:hpdef': 'Icon_Attribute_HPDEF_Buff',
	energy: 'Icon_Attribute_Energy_Recharge',
	interruptionRes: 'Icon_Attribute_Interruption_Res',
	infuse: 'Icon_Attribute_Infusion',
	cleanse: 'Icon_Attribute_Cleanse',
	offFieldDamage: 'Icon_Attribute_Off-field_DMG',
	resShred: 'Icon_Attribute_RES_Shred',
	grouping: 'Icon_Attribute_Grouping'
};

// ── OPTICAL BALANCE (2026-10-12) ─────────────────────────────────────────
// The traces sit in a 24-unit artboard with the original icons' padding.
// Each glyph now gets its OWN viewBox, cropped to its art, so the box a
// consumer draws IS the glyph and the gaps around it are layout values.
// Within that box: the longest side fits the box, then a glyph denser than
// the set's median ink density is shrunk toward it, by DENSITY_K. A sparse
// glyph can't grow past the box, so this balances SIZE; it can't add weight.
// 🎛️ DENSITY_K: 0 = every glyph fills its box; 1 = equal ink area (where
//    it can). Taste, not derivation.
const DENSITY_K = 0.5;
// 🎛️ Per-glyph by-eye corrections, applied after the balance: `scale`
//    multiplies the glyph's size (1 = as balanced; past the box it spills
//    into the gap — FingerprintGlyph draws with overflow visible),
//    `dx`/`dy` move it, in fractions of the box (+ = right / down).
/** @type {Record<string, { scale?: number; dx?: number; dy?: number }>} */
const NUDGE = {
	// tune(nate) 2026-10-12, by eye on the balanced set; 2026-10-13 after
	// the DMG% / Cleanse / Grouping redraws (Grouping 1.2 × 0.99); DMG% 0.93 × 0.94 the same evening
	energy: { scale: 1.05 },
	resShred: { scale: 1.06 },
	grouping: { scale: 1.188 },
	interruptionRes: { scale: 1.04 },
	'buff:dmg': { scale: 0.874 },
	shield: { scale: 1.03 },
	'buff:hpdef': { scale: 1.03 }
};

/** The path's outline as polygons: absolute M/L/C/Z only (Affinity's
 *  export), each cubic flattened to 24 segments. */
function contours(d) {
	const nums = (s) =>
		s
			.trim()
			.split(/[\s,]+/)
			.filter(Boolean)
			.map(Number);
	const out = [];
	let cur = [];
	let p = [0, 0];
	for (const [, cmd, args] of d.matchAll(/([MLCZ])([^MLCZ]*)/gi)) {
		if (/[mlcz]/.test(cmd)) throw new Error(`relative path command '${cmd}' — export absolute`);
		const n = nums(args);
		if (cmd === 'M') {
			if (cur.length) out.push(cur);
			for (let i = 0; i < n.length; i += 2)
				cur = i ? [...cur, [n[i], n[i + 1]]] : [[n[i], n[i + 1]]];
			p = cur.at(-1);
		} else if (cmd === 'L') {
			for (let i = 0; i < n.length; i += 2) cur.push((p = [n[i], n[i + 1]]));
		} else if (cmd === 'C') {
			for (let i = 0; i < n.length; i += 6) {
				const [x1, y1, x2, y2, x, y] = n.slice(i, i + 6);
				const [x0, y0] = p;
				for (let k = 1; k <= 24; k++) {
					const t = k / 24,
						u = 1 - t;
					cur.push([
						u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
						u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y
					]);
				}
				p = [x, y];
			}
		} else {
			if (cur.length) out.push(cur);
			cur = [];
		}
	}
	if (cur.length) out.push(cur);
	return out;
}

/** Ink area of a set of paths (even-odd, per path), by scanline. */
function inkArea(paths, step = 0.02) {
	let area = 0;
	for (const d of paths) {
		const edges = contours(d).flatMap((poly) =>
			poly.map((a, i) => [a, poly[(i + 1) % poly.length]])
		);
		for (let y = step / 2; y < 24; y += step) {
			const xs = [];
			for (const [[x0, y0], [x1, y1]] of edges)
				if (y0 <= y !== y1 <= y) xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
			xs.sort((a, b) => a - b);
			for (let i = 0; i + 1 < xs.length; i += 2) area += (xs[i + 1] - xs[i]) * step;
		}
	}
	return area;
}

const glyphs = {};
const measured = {};
for (const [facet, stem] of Object.entries(GLYPHS)) {
	const svg = await readFile(join(SRC, `${stem}.svg`), 'utf8');
	if (!/viewBox="0 0 24 24"/.test(svg)) throw new Error(`${stem}: not a 24-unit viewBox`);
	if (/<(circle|rect|ellipse|polygon|line|polyline)\b/.test(svg))
		throw new Error(`${stem}: only <path> fills are read — convert shapes to paths`);
	const fill = [];
	const shade = [];
	for (const [tag] of svg.matchAll(/<path\b[^>]*>/g)) {
		const d = tag.match(/\sd="([^"]+)"/)?.[1];
		if (!d) continue;
		const id = tag.match(/\sid="([^"]+)"/)?.[1] ?? '';
		(/gray|grey|shade/i.test(id) ? shade : fill).push(d);
	}
	if (!fill.length) throw new Error(`${stem}: no fill path`);
	glyphs[facet] = shade.length ? { fill, shade } : { fill };
	const pts = [...fill, ...shade].flatMap(contours).flat();
	const xs = pts.map((q) => q[0]);
	const ys = pts.map((q) => q[1]);
	const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
	const side = Math.max(x1 - x0, y1 - y0);
	const ink = inkArea(fill) + inkArea(shade) / 2;
	measured[facet] = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, side, density: ink / side ** 2 };
}

const densities = Object.values(measured)
	.map((m) => m.density)
	.sort((a, b) => a - b);
const median = densities[Math.floor(densities.length / 2)];
const r = (v) => +v.toFixed(3);
for (const [facet, m] of Object.entries(measured)) {
	const n = NUDGE[facet] ?? {};
	const fit = Math.min(1, (median / m.density) ** DENSITY_K) * (n.scale ?? 1);
	const v = m.side / fit; // the viewBox side that makes the art `fit` of the box
	const x = m.cx - v / 2 - (n.dx ?? 0) * v;
	const y = m.cy - v / 2 - (n.dy ?? 0) * v;
	glyphs[facet].box = `${r(x)} ${r(y)} ${r(v)} ${r(v)}`;
	console.log(
		`  ${facet.padEnd(16)} density ${m.density.toFixed(2)} → ${(fit * 100).toFixed(0)}% of the box`
	);
}

// Every fingerprint facet must have art: read the fifteen keys from facets.ts.
const facetSrc = await readFile(join(ROOT, 'src/lib/capabilities/facets.ts'), 'utf8');
const missing = [...facetSrc.matchAll(/key: '([^']+)'/g)]
	.map((m) => m[1])
	.filter((k) => !glyphs[k]);
if (missing.length) throw new Error(`no glyph for: ${missing.join(', ')}`);

const body = `// GENERATED by scripts/generate-fingerprint-glyphs.mjs — do not edit.
// Source: static/assets/effects/*.svg (Nate's traces, 24-unit, fills only).

export type FingerprintGlyph = {
	/** The main fill, one or more paths. */
	fill: string[];
	/** A two-tone glyph's quieter half, painted fainter. */
	shade?: string[];
	/** Its own viewBox: cropped to the art and optically balanced. */
	box: string;
};

export const FINGERPRINT_GLYPHS: Partial<Record<string, FingerprintGlyph>> = ${JSON.stringify(glyphs, null, '\t')};
`;
await writeFile(OUT, body);
console.log(`fingerprint glyphs: ${Object.keys(glyphs).length} → ${OUT}`);
