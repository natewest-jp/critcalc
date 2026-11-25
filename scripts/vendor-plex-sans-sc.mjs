/**
 * scripts/vendor-plex-sans-sc.mjs
 *
 * Copies IBM Plex Sans SC's web fonts into static/assets/fonts/ and writes the
 * one stylesheet Chinese pages link (src/routes/+layout.svelte). The fonts are
 * vendored rather than installed because @ibm/plex-sans-sc runs IBM's
 * telemetry on every `npm install`, so every Cloudflare build would report.
 *
 *   npm pack @ibm/plex-sans-sc@1.1.0 && tar xzf ibm-plex-sans-sc-1.1.0.tgz
 *   node scripts/vendor-plex-sans-sc.mjs path/to/package
 *
 * The package splits each weight into 216 slices by unicode-range, so a page
 * fetches only the slices its characters need. Four weights ship, the ones the
 * site sets (400, 500, 600, 700).
 *
 * ⚠️ Line metrics. Plex Sans SC's hhea carries a line gap of a whole em, so
 * at `line-height: normal` any line holding a Chinese character would stand
 * 2em tall against the Latin face's 1.3em, and every menu row and button
 * grows. Each rule overrides the metrics to Plex Sans's own (ascent 1025,
 * descent 275, gap 0, per 1000), so a Chinese line boxes exactly like a Latin
 * one on the same baseline. The glyphs themselves are untouched.
 *
 * `/assets/*` is immutable and add-only: a new version goes in a new folder
 * (the package version is in its name), never over this one.
 */

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = process.argv[2];
if (!pkg) {
	console.error('usage: node scripts/vendor-plex-sans-sc.mjs <unpacked @ibm/plex-sans-sc package>');
	process.exit(1);
}
const { version } = JSON.parse(await readFile(join(pkg, 'package.json'), 'utf8'));
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'static/assets/fonts', `ibm-plex-sans-sc-${version}`);
const SPLIT = join(pkg, 'fonts/split/woff2/hinted');
const WEIGHTS = ['Regular', 'Medium', 'SemiBold', 'Bold'];
const METRICS = 'ascent-override:102.5%;descent-override:27.5%;line-gap-override:0%;';

await mkdir(OUT, { recursive: true });
await copyFile(join(pkg, 'LICENSE.txt'), join(OUT, 'LICENSE.txt'));

let css = `/* IBM Plex Sans SC ${version} (SIL OFL 1.1, LICENSE.txt), split by unicode-range. Written by scripts/vendor-plex-sans-sc.mjs; never hand-edit. */\n`;
let files = 0;
for (const w of WEIGHTS) {
	const source = await readFile(join(SPLIT, `IBMPlexSansSC-${w}.css`), 'utf8');
	for (const [, body] of source.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
		const url = body.match(/url\("([^"]+\.woff2)"\)/)[1];
		const weight = body.match(/font-weight:\s*(\d+)/)[1];
		const range = body
			.match(/unicode-range:\s*([^;}]+)/)[1]
			.trim()
			.replace(/,\s+/g, ',');
		await copyFile(join(SPLIT, url), join(OUT, url));
		files++;
		css += `@font-face{font-family:'IBM Plex Sans SC';font-style:normal;font-weight:${weight};font-display:swap;src:url(${url}) format("woff2");${METRICS}unicode-range:${range}}\n`;
	}
}
await writeFile(join(OUT, 'plex-sans-sc.css'), css);
console.log(`wrote ${OUT}: ${files} slices, plex-sans-sc.css`);
