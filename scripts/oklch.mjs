/**
 * scripts/oklch.mjs — sRGB ↔ OKLCH conversion (Björn Ottosson's matrices).
 *
 * The palette-derivation helper behind the 2026-07-31 surface re-cut: the
 * surface stack is designed in OKLCH (hue ~constant H265, chroma rising with
 * lightness) and committed as resolved hex literals. Use this to read a
 * token's L/C/H or to generate candidates when re-deriving the stack from
 * new anchor picks.
 *
 *   node scripts/oklch.mjs '#121b2f'          → its oklch L/C/H
 *   node scripts/oklch.mjs 0.28 0.054 265     → the hex (flags out-of-gamut)
 */
const l2s = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export function hexToOklch(hex) {
	const n = hex.replace('#', '');
	const r = s2l(parseInt(n.slice(0, 2), 16) / 255);
	const g = s2l(parseInt(n.slice(2, 4), 16) / 255);
	const b = s2l(parseInt(n.slice(4, 6), 16) / 255);
	const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
	const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
	const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
	const C = Math.hypot(a, bb);
	let H = (Math.atan2(bb, a) * 180) / Math.PI;
	if (H < 0) H += 360;
	return { L, C, H };
}

export function oklchToHex(L, C, Hdeg) {
	const h = (Hdeg * Math.PI) / 180;
	const a = C * Math.cos(h);
	const b = C * Math.sin(h);
	const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
	const g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
	const bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;
	const inGamut = [r, g, bl].every((c) => c >= -0.0001 && c <= 1.0001);
	const to255 = (c) =>
		Math.max(0, Math.min(255, Math.round(l2s(Math.max(0, Math.min(1, c))) * 255)));
	const hex = '#' + [r, g, bl].map((c) => to255(c).toString(16).padStart(2, '0')).join('');
	return { hex, inGamut };
}

const args = process.argv.slice(2);
if (args.length === 1 && args[0].startsWith('#')) {
	const { L, C, H } = hexToOklch(args[0]);
	console.log(`${args[0]}  L ${L.toFixed(3)}  C ${C.toFixed(3)}  H ${H.toFixed(1)}`);
} else if (args.length === 3) {
	const { hex, inGamut } = oklchToHex(Number(args[0]), Number(args[1]), Number(args[2]));
	console.log(`${hex}${inGamut ? '' : '  ⚠ out of sRGB gamut (clamped)'}`);
}
