/**
 * scripts/vendor-plex-sans-cjk.mjs
 *
 * Copies one of IBM Plex Sans's CJK companions (SC for Chinese, JP for
 * Japanese) into static/assets/fonts/ and writes the one stylesheet that
 * locale's pages link (src/routes/+layout.svelte). The fonts are vendored
 * rather than installed because IBM's packages run telemetry on every
 * `npm install`, so every Cloudflare build would report. `npm pack` doesn't
 * run it.
 *
 *   npm pack @ibm/plex-sans-sc@1.1.0 && tar xzf ibm-plex-sans-sc-1.1.0.tgz
 *   node scripts/vendor-plex-sans-cjk.mjs path/to/package
 *
 * The family comes from the package name (`@ibm/plex-sans-jp` → IBM Plex
 * Sans JP). Each package splits a weight into slices by unicode-range (216
 * for SC, 124 for JP), so a page fetches only the slices its characters
 * need. Four weights ship, the ones the site sets (400, 500, 600, 700).
 *
 * ⚠️ Line metrics. Neither face boxes a line like the Latin face: SC's hhea
 * carries a line gap of a whole em (a 2em line), and JP's ascent and descent
 * are 1060 and 440 (a 1.5em line), against Plex Sans's 1.3em. At
 * `line-height: normal`, any line holding a CJK character would grow every
 * menu row and button. Each rule overrides the metrics to Plex Sans's own
 * (ascent 1025, descent 275, gap 0, per 1000), so a CJK line boxes exactly
 * like a Latin one on the same baseline. The glyphs themselves are untouched.
 *
 * `/assets/*` is immutable and add-only: a new version goes in a new folder
 * (the package version is in its name), never over an old one.
 */

import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = process.argv[2];
if (!pkg) {
	console.error(
		'usage: node scripts/vendor-plex-sans-cjk.mjs <unpacked @ibm/plex-sans-sc or -jp package>'
	);
	process.exit(1);
}
const { name, version } = JSON.parse(await readFile(join(pkg, 'package.json'), 'utf8'));
const cut = name.match(/^@ibm\/plex-sans-(sc|jp)$/)?.[1];
if (!cut) {
	console.error(`not a Plex Sans CJK package: ${name}`);
	process.exit(1);
}
const CUT = cut.toUpperCase();
const FAMILY = `IBM Plex Sans ${CUT}`;
const SHEET = `plex-sans-${cut}.css`;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'static/assets/fonts', `ibm-plex-sans-${cut}-${version}`);
const SPLIT = join(pkg, 'fonts/split/woff2/hinted');
const WEIGHTS = ['Regular', 'Medium', 'SemiBold', 'Bold'];
const METRICS = 'ascent-override:102.5%;descent-override:27.5%;line-gap-override:0%;';

await mkdir(OUT, { recursive: true });
// SC ships its licence at the package root, JP beside the split fonts.
const license = (await readdir(pkg)).includes('LICENSE.txt')
	? join(pkg, 'LICENSE.txt')
	: join(SPLIT, 'license.txt');
await copyFile(license, join(OUT, 'LICENSE.txt'));

let css = `/* ${FAMILY} ${version} (SIL OFL 1.1, LICENSE.txt), split by unicode-range. Written by scripts/vendor-plex-sans-cjk.mjs; never hand-edit. */\n`;
let files = 0;
for (const w of WEIGHTS) {
	const source = await readFile(join(SPLIT, `IBMPlexSans${CUT}-${w}.css`), 'utf8');
	for (const [, body] of source.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
		const url = body.match(/url\("([^"]+\.woff2)"\)/)[1];
		const weight = body.match(/font-weight:\s*(\d+)/)[1];
		const range = body
			.match(/unicode-range:\s*([^;}]+)/)[1]
			.trim()
			.replace(/,\s+/g, ',');
		await copyFile(join(SPLIT, url), join(OUT, url));
		files++;
		css += `@font-face{font-family:'${FAMILY}';font-style:normal;font-weight:${weight};font-display:swap;src:url(${url}) format("woff2");${METRICS}unicode-range:${range}}\n`;
	}
}
await writeFile(join(OUT, SHEET), css);
console.log(`wrote ${OUT}: ${files} slices, ${SHEET}`);
