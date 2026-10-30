/**
 * Repo conventions that used to live only as prose in CLAUDE.md and
 * `.claude/rules/`. Each test names the rule it holds; when a rule changes,
 * change it here and in the instruction file together.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { PAGE_META } from './seo';

const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'src');

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, out);
		else out.push(p);
	}
	return out;
}

const files = walk(SRC).map((p) => relative(ROOT, p));
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8');

/** Strip comments and `<code>` spans, so a rule can be explained in prose
 *  (or documented on /styleguide) without tripping it. */
function stripComments(s: string): string {
	return s
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<code>[\s\S]*?<\/code>/g, '')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** Dev-only pages that carry their own meta and are not in the sitemap. */
const DEV_ROUTES = new Set(['/lab', '/lab/notices', '/styleguide']);

/** `src/routes/(scene)/(pages)/help/planner/+page.svelte` → `/help/planner`. */
function routeOf(file: string): string {
	const segs = file
		.replace(/^src\/routes/, '')
		.replace(/\/\+page\.svelte$/, '')
		.split('/')
		.filter((s) => s && !/^\(.*\)$/.test(s));
	return '/' + segs.join('/');
}

describe('page meta (CLAUDE.md: standing rules)', () => {
	const routes = files.filter((f) => f.endsWith('/+page.svelte')).map(routeOf);
	const sitemap = [
		...read('static/sitemap.xml').matchAll(/<loc>https:\/\/critcalc\.app([^<]*)<\/loc>/g)
	].map((m) => m[1].replace(/\/$/, '') || '/');

	it('every public route has an entry in seo.ts', () => {
		const missing = routes.filter((r) => !DEV_ROUTES.has(r) && !(r in PAGE_META));
		expect(missing).toEqual([]);
	});

	it('every sitemap entry is a route with meta', () => {
		const stray = sitemap.filter((r) => !(r in PAGE_META) || !routes.includes(r));
		expect(stray).toEqual([]);
	});

	it('no page sets its own <title> (svelte:head does not dedupe)', () => {
		const allowed = new Set([
			'src/lib/components/SeoHead.svelte',
			'src/routes/styleguide/+page.svelte',
			'src/routes/(scene)/lab/+page.svelte'
		]);
		const offenders = files.filter(
			(f) =>
				f.endsWith('.svelte') &&
				!allowed.has(f) &&
				/<svelte:head>[\s\S]*?<title>[\s\S]*?<\/svelte:head>/.test(stripComments(read(f)))
		);
		expect(offenders).toEqual([]);
	});
});

describe('the notation editor stays lazy (.claude/rules/planner.md)', () => {
	it('nothing outside the editor modules imports it statically', () => {
		const editor = /(^|\/)notationEditor(Extension)?\.ts$/;
		const offenders = files.filter((f) => {
			if (editor.test(f) || f.endsWith('.test.ts')) return false;
			if (!/\.(ts|svelte)$/.test(f)) return false;
			const src = stripComments(read(f));
			return /^\s*import\s+(?!type\b)[^;]*?from\s+['"][^'"]*notationEditor(Extension)?['"]/m.test(
				src
			);
		});
		expect(offenders).toEqual([]);
	});
});

describe('retired names stay retired (.claude/rules/ui.md)', () => {
	const styled = files.filter((f) => /\.(svelte|css)$/.test(f));

	it('no `.frame` class', () => {
		const offenders = styled.filter((f) => {
			const src = stripComments(read(f));
			return (
				/(^|[\s,{}>+~(])\.frame(?![\w-])/m.test(src) ||
				/class="[^"]*(?<![\w-])frame(?![\w-])[^"]*"/.test(src)
			);
		});
		expect(offenders).toEqual([]);
	});

	it('no `var(--debuff)`: it is not a token, so it silently inherits', () => {
		const offenders = styled.filter((f) => /var\(--debuff\b/.test(stripComments(read(f))));
		expect(offenders).toEqual([]);
	});
});

/**
 * The source half of the mark sweep; `e2e/marks.spec.ts` is the rendered half,
 * on the surfaces it opens. Same code points, same exemptions: rarity stars
 * (`5★` is Genshin's notation) and `?` are real glyphs in the body face.
 */
describe('symbol marks are geometry, not type (.claude/rules/ui.md: sub-pixel laws)', () => {
	const BANNED = /[←→↑↓⇄⇆↺↻✓✔✗✕✖✘●○☆🔒▾▴⌄⌃∅⧉⤴]/gu;

	/** Help prose may name a control by its mark (docs/text/style-guide.md);
	 *  the dev pages document the marks themselves. */
	const EXEMPT = [
		/^src\/lib\/help\//,
		/^src\/routes\/styleguide\//,
		/^src\/routes\/\(scene\)\/lab\//
	];

	/** Exact spans allowed in one file. Remove an entry when its span goes. */
	const ALLOWED: { file: string; span: string }[] = [
		// Parses the roles sheet's check mark; renders nothing.
		{ file: 'src/lib/data/parseRolesCsv.ts', span: `'✔'` },
		// Live UI, kept by Nate's ruling (2026-10-30): arrows mid-text read fine, and the
		// `⌃` sits in a tooltip the OS draws. Only ↑ and ↓ are in our Plex subset, so
		// → and ← fall back to the system's font; one that looks off becomes a <Mark>.
		{ file: 'src/lib/components/MoveDialog.svelte', span: 'C{c.from} → C{c.to}' },
		{ file: 'src/lib/components/RosterTab.svelte', span: `['←', '→', '↑', '↓']` },
		{ file: 'src/lib/components/CompareControl.svelte', span: '(⌃\\`)' },
		{ file: 'src/lib/timeline/buffDisplay.ts', span: '` → ${value.cap}%`' },
		{ file: 'src/lib/timeline/buffDisplay.ts', span: '`${startStr} → ${endStr} over duration`' },
		{
			file: 'src/routes/(scene)/(tools)/visualizers/lib/DefResInstrument.svelte',
			span: '`${x}% → ${fmtX(resAt(x))}`'
		},
		{
			file: 'src/routes/(scene)/(tools)/visualizers/lib/DefResInstrument.svelte',
			span: '`Lv ${x} → ${fmtX(defAt(x))}`'
		}
	];

	const scanned = files.filter(
		(f) =>
			/\.(svelte|ts|css)$/.test(f) &&
			!/\.(test|generated)\.ts$/.test(f) &&
			!EXEMPT.some((re) => re.test(f))
	);

	it('no source that renders typesets a banned code point', () => {
		const offenders = scanned.flatMap((f) => {
			let src = stripComments(read(f));
			for (const a of ALLOWED) if (a.file === f) src = src.split(a.span).join('');
			return [...new Set(src.match(BANNED) ?? [])].map((ch) => `${f}: ${ch}`);
		});
		expect(offenders).toEqual([]);
	});

	it('every allowance still matches its file', () => {
		const stale = ALLOWED.filter((a) => !read(a.file).includes(a.span));
		expect(stale).toEqual([]);
	});
});
