import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Regenerates the element icon set FROM the element tokens, so the icons can
// never drift from the colours they represent again.
//
// THE RULE, as of 2026-08-11, is now the simplest one there is:
//
//     icon = the token, painted onto the white silhouette.
//
// Nothing is read back off the art, nothing is boosted, nothing is offset. The
// icon IS --el-{element}-main, exactly, by construction.
//
// ⚠ IT USED TO BE MUCH MORE THAN THAT, and the reason it no longer needs to be
// is worth keeping. The old rule was "token hue (+ a per-element offset), token
// saturation x 1.35, the ARTWORK's own lightness", and every clause of it
// existed to reconcile art drawn at one colour with tokens that had been tuned
// to another: hydro's glyph sat 19 degrees off its token, cryo 14, and the
// saturation boost existed because a small bright glyph and a timeline bar had
// been given different jobs by hand. ⚓ Nate 2026-08-11 retired the whole
// problem by adopting Genshin's palette verbatim — the token IS the icon colour
// now, so there is nothing left to reconcile and every knob was deleted rather
// than re-fitted. ⛔ Do not reintroduce SAT_BOOST or ICON_HUE_OFFSET. If an
// element ever needs its glyph to differ from its bar again, that is a claim
// that has to be argued in app.css first, not smuggled in here.
//
// ⚠ THE SOURCE IS flat-white, NOT flat-color. Both are one colour plus straight
// alpha, so both tint losslessly — but flat-white is 128px against 84, and
// white art means the output is the token exactly rather than the token
// filtered through whatever value the art happened to be drawn at.
// ⚠ flat-white also carries lunar, omni and stellar. Those are NATE'S OWN,
// traced from art Genshin uses but never drew as icons, which is why they exist
// in white only and are NOT generated here — they have no --el-* token, and he
// has colour schemes to suggest if they are ever wanted. Do not invent one.
//
// ⚠ ADD-ONLY ASSETS. static/_headers serves /assets/* as immutable for a year,
// so a changed asset must ship under a NEW filename, never overwritten. Output
// filenames carry a hash of the colour that produced them: change a token, get
// a new file, and the old one is deleted from the working tree (it was only
// ever reachable through the generated manifest). Call sites import that
// manifest rather than building paths by hand.
//
// Auto-run by the predev/prebuild hooks. Manual: npm run generate-element-icons

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC_DIR = join(ROOT, 'static/assets/elements/flat-white');
const OUT_DIR = join(ROOT, 'static/assets/elements/tinted');
const MANIFEST = join(ROOT, 'src/lib/data/elementIcons.generated.ts');
const APP_CSS = join(ROOT, 'src/app.css');

/** ⚠ NOT every glyph in SRC_DIR. flat-white also ships lunar/omni/stellar,
 *  which have no --el-* token and are deliberately not generated — see the
 *  header. This list is the seven elements and nothing else. */
const ELEMENTS = ['pyro', 'hydro', 'anemo', 'electro', 'cryo', 'geo', 'dendro'];

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

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
 * This is lossless because the source icons are FLAT: one colour plus an
 * antialiased edge (verified — a coarse histogram of each file returns a single
 * bucket). PNG alpha is straight, not premultiplied, so the edge pixels carry
 * that same RGB at a lower alpha and recolour correctly along with everything
 * else. Nothing is masked, resampled or composited, so the silhouette that
 * comes out is the silhouette that went in.
 *
 * ⚠ The source being WHITE is what makes the output the token exactly. Tinting
 * flat-color would give the token's RGB too — the pixels are overwritten either
 * way — but white art is the honest input for "paint the token onto a
 * silhouette", and it is the reason nothing has to be read back off the art.
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
	const hex = tokens[el];

	const hash = createHash('sha256').update(hex).digest('hex').slice(0, 8);
	const file = `${el}-${hash}.png`;
	keep.add(file);

	await writeFile(join(OUT_DIR, file), await tint(srcPath, hexToRgb(hex)));
	rows.push({ el, hex, file });
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
// The --el-*-main tokens from app.css, painted onto the flat-white silhouettes.
// Each icon IS its token colour, exactly. Filenames carry a hash of that colour
// because /assets/* is served immutable for a year (static/_headers): a token
// change yields a NEW filename rather than editing art in place. Import from
// here instead of building the path by hand, so the hash is never stale.

export const ELEMENT_ICONS: Record<string, string> = {
${rows.map((r) => `\t${r.el}: '/assets/elements/tinted/${r.file}'`).join(',\n')}
};

/** Icon URL for an element, or null when it has none (physical, none). */
export function elementIcon(element: string | null | undefined): string | null {
	return (element && ELEMENT_ICONS[element]) ?? null;
}
`;
await writeFile(MANIFEST, manifest);

console.log('[generate-element-icons] painted --el-*-main onto flat-white:');
for (const r of rows) console.log(`    ${r.el.padEnd(8)} ${r.hex}  ${r.file}`);
console.log(`  ${rows.length} icons, manifest -> src/lib/data/elementIcons.generated.ts`);
