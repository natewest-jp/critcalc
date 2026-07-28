import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Regenerates the element icon set FROM the element tokens, so the icons can
// never drift from the colors they represent again.
//
// THE RULE the set follows — five of the seven icons already obeyed it before
// this script existed, which is how it was found:
//
//     icon = the token's HUE (+ any declared offset), at the token's
//            saturation x SAT_BOOST (capped), keeping the ARTWORK's own
//            lightness.
//
// Hue and saturation come from the token because they are what says "this is
// hydro". Lightness stays with the art: an icon is a small bright glyph while
// the token has to fill timeline bars and set text on dark navy, and that
// difference is deliberate — every icon measured 12-32 saturation points above
// its token. Reading lightness back off the source means nothing is hardcoded
// here; the artwork keeps its own value and only its color identity is
// corrected.
//
// Why this was needed: hydro's icon sat 19 degrees off its token (a vivid cyan
// against a royal blue) and cryo 14 degrees, because hydro and cryo were
// deliberately pushed apart in the token palette to stop them colliding in a
// dense timeline — a constraint Genshin's own UI never has to satisfy. The
// icons never followed. Everything else was already within 9 degrees.
//
// ICON_HUE_OFFSET is how a deliberate split gets BACK in without the drift
// coming back with it. Collapsing hydro's split to zero was a slight
// over-correction: the token wants to be the royal blue that separates from
// cryo in a dense timeline, while the glyph — a small bright mark seen alone,
// never next to a cryo bar — is more recognisably hydro when it keeps some of
// its cyan. So the two now diverge BY DECLARATION, one step each way from where
// they met, rather than by nobody having checked.
//
// ⚠️ ADD-ONLY ASSETS. static/_headers serves /assets/* as immutable for a
// year, so a changed asset must ship under a NEW filename, never overwritten.
// Output filenames therefore carry a hash of the color that produced them:
// change a token, get a new file, and the old one is deleted from the working
// tree (it was only ever reachable through the generated manifest). Call sites
// import that manifest rather than building paths by hand.
//
// Auto-run by the predev/prebuild hooks. Manual: npm run generate-element-icons

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC_DIR = join(ROOT, 'static/assets/elements/flat-color');
const OUT_DIR = join(ROOT, 'static/assets/elements/tinted');
const MANIFEST = join(ROOT, 'src/lib/data/elementIcons.generated.ts');
const APP_CSS = join(ROOT, 'src/app.css');

/** How much more saturated a glyph runs than its token. Fitted to the set as
 *  authored: it reproduces every icon's saturation within 7 points. */
const SAT_BOOST = 1.35;

/** One "point" of hue, in degrees — the unit Nate's palette nudges come in. */
const HUE_STEP = 3;

/** Degrees the GLYPH sits off its token's hue. Absent = 0, and 0 is the
 *  default for a reason: an entry here is a claim that the icon and the bar
 *  want different things, and it needs to survive being asked why.
 *    hydro  −2 steps: token pushed royal (away from cryo's bar), glyph pulled
 *                     back toward the cyan it was drawn as — one step each way
 *                     from the 205° they used to share. Nate 2026-07-28. */
const ICON_HUE_OFFSET = { hydro: -2 * HUE_STEP };

const ELEMENTS = ['pyro', 'hydro', 'anemo', 'electro', 'cryo', 'geo', 'dendro'];

// ── color helpers ───────────────────────────────────────────────────────────

function hexToHsl(hex) {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
	const mx = Math.max(r, g, b);
	const mn = Math.min(r, g, b);
	const d = mx - mn;
	let h = 0;
	if (d) {
		if (mx === r) h = 60 * (((g - b) / d) % 6);
		else if (mx === g) h = 60 * ((b - r) / d + 2);
		else h = 60 * ((r - g) / d + 4);
	}
	if (h < 0) h += 360;
	const l = (mx + mn) / 2;
	const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
	return [h, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
	s /= 100;
	l /= 100;
	const k = (n) => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}

const toHex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

// ── read the tokens ─────────────────────────────────────────────────────────

/** Parse --el-{element}-main out of app.css. The tokens are THE source; this
 *  script never carries its own copy of a color. */
async function readTokens() {
	const css = await readFile(APP_CSS, 'utf8');
	const out = {};
	for (const el of ELEMENTS) {
		const m = new RegExp(`--el-${el}-main:\\s*(#[0-9a-f]{6})`, 'i').exec(css);
		if (!m) throw new Error(`app.css has no --el-${el}-main`);
		out[el] = m[1].toLowerCase();
	}
	return out;
}

// ── the tint ────────────────────────────────────────────────────────────────

/**
 * Replace every pixel's RGB while preserving its alpha byte for byte.
 *
 * This is lossless because the source icons are FLAT: one color plus an
 * antialiased edge (verified — a coarse histogram of each file returns a single
 * bucket). PNG alpha is straight, not premultiplied, so the edge pixels carry
 * that same RGB at a lower alpha and recolor correctly along with everything
 * else. Nothing is masked, resampled or composited, so the silhouette that
 * comes out is the silhouette that went in.
 */
async function tint(srcPath, [r, g, b]) {
	const { data, info } = await sharp(srcPath)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] === 0) continue; // fully transparent: leave it alone
		data[i] = r;
		data[i + 1] = g;
		data[i + 2] = b;
	}
	return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
		.png({ compressionLevel: 9 })
		.toBuffer();
}

// ── main ────────────────────────────────────────────────────────────────────

const tokens = await readTokens();
await mkdir(OUT_DIR, { recursive: true });

const rows = [];
const keep = new Set();

for (const el of ELEMENTS) {
	const srcPath = join(SRC_DIR, `${el}.png`);

	// the artwork's own lightness, and its current color for the report
	const { data } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	let artHex = null;
	for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] >= 250) {
			artHex = toHex([data[i], data[i + 1], data[i + 2]]);
			break;
		}
	}
	if (!artHex) throw new Error(`${el}.png has no opaque pixel`);

	const [, , artL] = hexToHsl(artHex);
	const [tokH, tokS] = hexToHsl(tokens[el]);
	const iconH = (((tokH + (ICON_HUE_OFFSET[el] ?? 0)) % 360) + 360) % 360;
	const rgb = hslToRgb(iconH, Math.min(100, tokS * SAT_BOOST), artL);
	const hex = toHex(rgb);

	const hash = createHash('sha256').update(hex).digest('hex').slice(0, 8);
	const file = `${el}-${hash}.png`;
	keep.add(file);

	await writeFile(join(OUT_DIR, file), await tint(srcPath, rgb));
	rows.push({ el, token: tokens[el], was: artHex, now: hex, file, off: ICON_HUE_OFFSET[el] ?? 0 });
}

// Sweep superseded files: they are unreachable once the manifest stops naming
// them, and leaving them behind is how an "add-only" tree turns into a midden.
for (const f of await readdir(OUT_DIR)) {
	if (f.endsWith('.png') && !keep.has(f)) {
		await unlink(join(OUT_DIR, f));
		console.log(`  removed superseded ${f}`);
	}
}

const manifest = `// GENERATED by scripts/generate-element-icons.mjs — do not edit.
//
// Element icons tinted from the --el-*-main tokens in app.css. Filenames carry
// a hash of the color that produced them because /assets/* is served immutable
// for a year (static/_headers): a token change yields a NEW filename rather
// than editing art in place. Import from here instead of building the path by
// hand, so the hash is never stale.

export const ELEMENT_ICONS: Record<string, string> = {
${rows.map((r) => `\t${r.el}: '/assets/elements/tinted/${r.file}'`).join(',\n')}
};

/** Icon URL for an element, or null when it has none (physical, none). */
export function elementIcon(element: string | null | undefined): string | null {
	return (element && ELEMENT_ICONS[element]) ?? null;
}
`;
await writeFile(MANIFEST, manifest);

console.log('[generate-element-icons] tinted from --el-*-main:');
for (const r of rows) {
	const mark = r.was === r.now ? ' ' : '*';
	const off = r.off ? `  hue ${r.off > 0 ? '+' : ''}${r.off}°` : '';
	console.log(
		`  ${mark} ${r.el.padEnd(8)} token ${r.token}  art ${r.was} -> ${r.now}${off}  ${r.file}`
	);
}
console.log(`  ${rows.length} icons, manifest -> src/lib/data/elementIcons.generated.ts`);
