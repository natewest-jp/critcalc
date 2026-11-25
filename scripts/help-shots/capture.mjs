/**
 * Renders Help's screenshots from the PRODUCTION build (`npm run help-shots`
 * builds first): serves `build/` with `vite preview`, drives each shot in
 * `shots.mjs` through headless Chromium at 2×, and writes
 * `src/lib/help/shots/<id>.webp`, their sizes and callouts in
 * `shots.generated.json`, and `shots.generated.ts`, the manifest the chapters
 * import (through Vite, so the names hash; never under `/assets/`,
 * which is immutable and add-only).
 *
 * Deterministic on purpose:
 * - `reducedMotion: 'reduce'` holds the night sky on its static frame (no
 *   twinkle, no shooting stars) and zeroes the motion tokens, so the glass
 *   shows the same sky every run and nothing is caught mid-fade.
 * - Every shot gets a fresh context: its own storage, seeded, then migrated
 *   into a profile by the app's first load.
 * - The pointer is parked off the surface before the capture.
 *
 * Every shot is rendered once per language in `LANGS`, from that language's
 * pages (`/ja/planner`): English as `<id>.webp`, the others as
 * `<id>.<lang>.webp`, each with its own size and pins, since the layout moves
 * with the words. `HelpFigure.svelte` shows the page's own, else English's.
 *
 * Usage: `npm run help-shots` (build + capture), or
 * `node scripts/help-shots/capture.mjs [--only id,id] [--lang ja]` against an
 * existing build. `--only` and `--lang` re-render those shots or languages and
 * keep the rest of the manifest.
 */
import { chromium, devices } from 'playwright';
import sharp from 'sharp';
import { spawn } from 'node:child_process';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import * as prettier from 'prettier';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOTS, setShotLang, t } from './shots.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'src/lib/help/shots');
const MANIFEST = join(OUT, 'shots.generated.ts');
const DATA = join(OUT, 'shots.generated.json');
const PORT = 4997;
const BASE = `http://localhost:${PORT}`;
/** 🎛️ WebP quality. UI text wants crisp edges; 92 kept them clean by eye at
 *  a third of the lossless size. */
const QUALITY = 92;

const DEVICES = {
	desk: { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 },
	phone: { ...devices['iPhone 13'], deviceScaleFactor: 2 }
};

/** The languages Help is shot in: English, and each locale with a draft of
 *  the tools. */
const LANGS = ['en', 'ja', 'zh'];
/** The browser's own locale per language, so nothing the browser formats
 *  (a date input, a number) shows another language's form. */
const BROWSER_LOCALE = { en: 'en-US', ja: 'ja-JP', zh: 'zh-CN' };

const argOf = (name) => {
	const i = process.argv.indexOf(name);
	return i > -1 ? new Set(process.argv[i + 1].split(',')) : null;
};
const only = argOf('--only');
const onlyLang = argOf('--lang');
/** A shot's file and manifest key in one language. */
const fileOf = (id, lang) => (lang === 'en' ? `${id}.webp` : `${id}.${lang}.webp`);

if (!existsSync(join(ROOT, 'build/index.html'))) {
	console.error('help-shots: no build/ — run `npm run help-shots`, which builds first.');
	process.exit(1);
}

// ── The server ─────────────────────────────────────────────────────────────
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
	cwd: ROOT,
	stdio: ['ignore', 'ignore', 'inherit']
});
const stop = () => server.kill();
process.on('exit', stop);
for (let i = 0; ; i++) {
	try {
		if ((await fetch(BASE)).ok) break;
	} catch {
		/* not up yet */
	}
	if (i > 100) throw new Error(`help-shots: the preview never answered on ${PORT}`);
	await new Promise((r) => setTimeout(r, 100));
}

// ── One shot ───────────────────────────────────────────────────────────────
/** Where on a box a callout marker sits. */
function anchor(b, at = 'center') {
	const cx = b.x + b.width / 2;
	const cy = b.y + b.height / 2;
	return {
		center: { x: cx, y: cy },
		'top-left': { x: b.x, y: b.y },
		'top-right': { x: b.x + b.width, y: b.y },
		'bottom-left': { x: b.x, y: b.y + b.height },
		'bottom-right': { x: b.x + b.width, y: b.y + b.height },
		top: { x: cx, y: b.y },
		bottom: { x: cx, y: b.y + b.height },
		left: { x: b.x, y: cy },
		right: { x: b.x + b.width, y: cy }
	}[at];
}

async function capture(browser, shot, lang) {
	setShotLang(lang);
	const context = await browser.newContext({
		...DEVICES[shot.device],
		...(shot.width && { viewport: { ...DEVICES[shot.device].viewport, width: shot.width } }),
		reducedMotion: 'reduce',
		locale: BROWSER_LOCALE[lang],
		timezoneId: 'UTC'
	});
	const page = await context.newPage();
	await page.addInitScript((s) => {
		if (localStorage.getItem('critcalc:rotationTabs')) return;
		if (s.notation !== undefined)
			localStorage.setItem(
				'critcalc:rotationTabs',
				JSON.stringify({
					tabs: [
						{
							id: 'shot',
							label: s.label ?? 'Rotation',
							notation: s.notation,
							tabLoadout: s.tabLoadout ?? {},
							tabCon: {},
							savedId: null
						}
					],
					activeTabId: 'shot'
				})
			);
		if (s.boards) localStorage.setItem('critcalc:boards', JSON.stringify(s.boards));
		if (s.ownership) localStorage.setItem('critcalc:ownership', JSON.stringify(s.ownership));
		if (s.constellations)
			localStorage.setItem('critcalc:constellations', JSON.stringify(s.constellations));
		if (s.settings) localStorage.setItem('critcalc:siteSettings', JSON.stringify(s.settings));
	}, shot.seed ?? {});

	await page.goto(BASE + (lang === 'en' ? '' : `/${lang}`) + shot.route);
	await page.locator('.tool-main, div.menu').first().waitFor({ state: 'visible' });

	// A seeded browser is a returning visitor: answer the once-only dialog
	// about the profiles layout by its buttons (e2e/fixtures/critcalc.ts says
	// why never Escape), then dismiss the migration toast.
	const dialog = page.locator('.fn-panel');
	if (shot.seed) {
		await dialog.waitFor({ state: 'visible' });
		const dots = dialog.locator('.dot');
		if (await dots.count()) await dots.last().click();
		await dialog.locator('.btn--primary').click();
		await dialog.waitFor({ state: 'detached' });
	}
	const dismiss = page.locator(`.nr button[aria-label="${t('notices_dismiss')}"]`);
	await dismiss
		.first()
		.waitFor({ state: 'visible', timeout: 3000 })
		.then(async () => {
			for (const b of await dismiss.all()) await b.click();
		})
		.catch(() => {});

	// Park the pointer where it hovers nothing (a hover card from the dialog's
	// last click otherwise sits over the timeline).
	if (shot.device === 'desk') await page.mouse.move(1, DEVICES.desk.viewport.height - 1);

	if (shot.prepare) await shot.prepare(page);

	await page.evaluate(() => document.fonts.ready);
	await page.waitForFunction(() => [...document.images].every((i) => i.complete));
	await page.waitForTimeout(400);

	const clip = await shot.clip(page);
	for (const k of ['x', 'y', 'width', 'height']) clip[k] = Math.round(clip[k]);

	const callouts = [];
	for (const [i, c] of (shot.callouts ?? []).entries()) {
		let a;
		if (c.point) a = await c.point(page);
		else {
			// A selector that names the page's words is a function of the language.
			const selector = typeof c.selector === 'function' ? c.selector() : c.selector;
			const b = await page.locator(selector).boundingBox();
			if (!b) throw new Error(`help-shots: ${shot.id} callout ${i + 1} (${selector}) not found`);
			a = anchor(b, c.at);
		}
		const p = { x: a.x + (c.dx ?? 0), y: a.y + (c.dy ?? 0) };
		callouts.push({
			n: i + 1,
			x: +((p.x - clip.x) / clip.width).toFixed(4),
			y: +((p.y - clip.y) / clip.height).toFixed(4),
			side: c.side ?? 'center'
		});
	}

	const png = await page.screenshot({ clip, type: 'png' });
	await sharp(png)
		.webp({ quality: QUALITY })
		.toFile(join(OUT, fileOf(shot.id, lang)));
	await context.close();

	return { width: clip.width, height: clip.height, scale: shot.scale ?? 1, callouts };
}

// ── All of them ────────────────────────────────────────────────────────────
await mkdir(OUT, { recursive: true });
const previous = only || onlyLang ? await loadPrevious() : {};
/** id → language → its entry. English is the manifest's own entry; the other
 *  languages ride under `locales`. */
const entries = {};
const browser = await chromium.launch();
try {
	for (const shot of SHOTS)
		for (const lang of LANGS) {
			// ⚠️ English's entry is the manifest's own and carries `locales`; kept
			// whole, a language that has since matched English (and lost its
			// file) would ride along in it and come back on a later run.
			const { locales: _stale, ...keptEn } = previous[shot.id] ?? {};
			const kept = lang === 'en' ? previous[shot.id] && keptEn : previous[shot.id]?.locales?.[lang];
			if ((only && !only.has(shot.id)) || (onlyLang && !onlyLang.has(lang))) {
				if (kept) (entries[shot.id] ??= {})[lang] = kept;
				continue;
			}
			process.stdout.write(`help-shots: ${shot.id} (${lang}) … `);
			const e = await capture(browser, shot, lang);
			// A shot with no words in it (icons, notation, bars) comes out the
			// same in every language: keep English's alone, which the figure
			// falls back to.
			const file = join(OUT, fileOf(shot.id, lang));
			const en = join(OUT, fileOf(shot.id, 'en'));
			if (lang !== 'en' && existsSync(en) && readFileSync(file).equals(readFileSync(en))) {
				await unlink(file);
				console.log('same as English');
				continue;
			}
			(entries[shot.id] ??= {})[lang] = e;
			console.log(`${e.width}×${e.height}`);
		}
} finally {
	await browser.close();
	stop();
}

// Images no shot names any more.
const named = new Set(
	SHOTS.flatMap((s) => LANGS.filter((l) => entries[s.id]?.[l]).map((l) => fileOf(s.id, l)))
);
for (const f of await readdir(OUT))
	if (f.endsWith('.webp') && !named.has(f)) await unlink(join(OUT, f));

const ident = (id, lang = 'en') =>
	id.replace(/-(\w)/g, (_, c) => c.toUpperCase()) + (lang === 'en' ? '' : lang.toUpperCase());
const ids = SHOTS.map((s) => s.id).filter((id) => entries[id]?.en);
const others = (id) => LANGS.filter((l) => l !== 'en' && entries[id][l]);
const data = Object.fromEntries(
	ids.map((id) => {
		const { en, ...rest } = entries[id];
		return [id, { ...en, ...(Object.keys(rest).length && { locales: rest }) }];
	})
);
await writeFormatted(DATA, JSON.stringify(data));
await writeFormatted(
	MANIFEST,
	`// GENERATED by scripts/help-shots/capture.mjs (\`npm run help-shots\`) — do not edit.
// The shot list is scripts/help-shots/shots.mjs; HelpFigure.svelte draws these.

import data from './shots.generated.json';
${ids
	.flatMap((id) =>
		['en', ...others(id)].map((l) => `import ${ident(id, l)} from './${fileOf(id, l)}';`)
	)
	.join('\n')}

export type HelpCalloutSide = 'top' | 'right' | 'bottom' | 'left' | 'center';

export type HelpShot = {
	src: string;
	/** The capture's size in CSS pixels (the image itself is 2×). */
	width: number;
	height: number;
	/** Display size against the capture's CSS size. */
	scale: number;
	/** The points a figure names, as fractions of the image's width and
	 *  height, and the side of the point its pin stands on. */
	callouts: { n: number; x: number; y: number; side: HelpCalloutSide }[];
};

/** A shot in English, and in each other language it was taken in. */
export type HelpShotSet = HelpShot & { locales: Partial<Record<string, HelpShot>> };

export const HELP_SHOTS = {
${ids
	.map((id) => {
		const locales = others(id)
			.map((l) => `${l}: { ...data['${id}'].locales.${l}, src: ${ident(id, l)} }`)
			.join(', ');
		return `'${id}': { ...data['${id}'], src: ${ident(id)}, locales: { ${locales} } } as HelpShotSet,`;
	})
	.join('\n')}
} satisfies Record<string, HelpShotSet>;

export type HelpShotId = keyof typeof HELP_SHOTS;
`
);
console.log(`help-shots: wrote ${ids.length} shots and the manifest.`);

/** Written as the repo's Prettier would, so the lint gate passes as-is. */
async function writeFormatted(path, source) {
	const options = (await prettier.resolveConfig(path)) ?? {};
	await writeFile(path, await prettier.format(source, { ...options, filepath: path }));
}

/** The manifest's current entries, for \`--only\`. */
async function loadPrevious() {
	if (!existsSync(DATA)) return {};
	return JSON.parse(readFileSync(DATA, 'utf8'));
}
