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

/** Paraglide's compiled output is generated, and not ours to hold to rules. */
const files = walk(SRC)
	.map((p) => relative(ROOT, p))
	.filter((f) => !f.startsWith('src/lib/paraglide/'));
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

	it('the sitemap lists every indexable route, and no noindex one', () => {
		const indexable = Object.entries(PAGE_META)
			.filter(([, m]) => !m.noindex)
			.map(([path]) => path);
		const hidden = Object.entries(PAGE_META)
			.filter(([, m]) => m.noindex)
			.map(([path]) => path);
		expect(indexable.filter((r) => !sitemap.includes(r))).toEqual([]);
		expect(hidden.filter((r) => sitemap.includes(r))).toEqual([]);
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

describe('US English in the source (docs/text/style-guide.md)', () => {
	/** The two files that read the stored key's old spelling. */
	const READS_OLD_KEY = new Set(['src/lib/storage/records.ts', 'src/lib/storage/backup.ts']);

	it('nothing spells it `colour`', () => {
		const offenders = files.filter(
			(f) =>
				/\.(svelte|ts|css|json)$/.test(f) &&
				!f.endsWith('.test.ts') &&
				!READS_OLD_KEY.has(f) &&
				/colour/i.test(read(f))
		);
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
		{ file: 'src/lib/timeline/buffDisplay.ts', span: '` → ${value.cap}%`' }
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

/**
 * The locale lives in the path, so every internal URL goes through
 * `$lib/i18n/paths`: `hrefTo` on the way out, `routeOf` on the way in. A bare
 * path drops a Japanese reader into English, and a bare `page.url.pathname`
 * comparison fails on every locale but English.
 */
describe('internal URLs keep the locale (src/lib/i18n/paths.ts)', () => {
	const PATHS = 'src/lib/i18n/paths.ts';
	const code = files.filter((f) => /\.(svelte|ts)$/.test(f) && !f.endsWith('.test.ts'));
	/** Dev-only pages, never localized. */
	const DEV = /^src\/routes\/(styleguide|\(scene\)\/lab)\//;

	it("nothing imports SvelteKit's resolve (paths.ts says why)", () => {
		const offenders = code.filter(
			(f) => !DEV.test(f) && /from\s+['"]\$app\/paths['"]/.test(read(f))
		);
		expect(offenders).toEqual([]);
	});

	// A static file (`/manifest.webmanifest`) has no locale and is exempt.
	it('no markup links to a bare internal path', () => {
		const offenders = code.filter(
			(f) =>
				f.endsWith('.svelte') &&
				!DEV.test(f) &&
				/\shref=(["'`]|\{\s*["'`])\/(?!\/|assets\/|[\w/-]*\.\w+["'`])/.test(stripComments(read(f)))
		);
		expect(offenders).toEqual([]);
	});

	it('no navigation call names a bare internal path', () => {
		const offenders = code.filter(
			(f) =>
				!DEV.test(f) &&
				/\b(goto|pushState|replaceState|preloadData|preloadCode)\(\s*["'`]\/|\bredirect\(\s*\d+\s*,\s*["'`]\//.test(
					stripComments(read(f))
				)
		);
		expect(offenders).toEqual([]);
	});

	it('nothing reads a pathname except through routeOf', () => {
		// A line that keeps the browser's own path on purpose (to navigate back to
		// it, or to rewrite the URL in place) says so with `i18n: raw path`.
		const offenders = code.flatMap((f) => {
			if (f === PATHS || DEV.test(f)) return [];
			return read(f)
				.split('\n')
				.map((line, i, all) => ({ line, i, prev: all[i - 1] ?? '' }))
				.filter(
					({ line, prev }) =>
						/\b(url|location)\.pathname\b/.test(stripComments(line)) &&
						!/i18n: raw path/.test(line + prev)
				)
				.map(({ i }) => `${f}:${i + 1}`);
		});
		expect(offenders).toEqual([]);
	});
});
