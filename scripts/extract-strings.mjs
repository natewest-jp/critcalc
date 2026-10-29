/**
 * scripts/extract-strings.mjs
 *
 * The translation ledger's GENERATED half (docs/text/ledger-plan.md): every
 * user-facing string under src/, where it renders, what fills it, and what the
 * code can tell a translator about it. The hand-written half — translator
 * context, length budgets, rulings — lives in docs/text/ledger/notes/ and is
 * keyed by the keys this script mints.
 *
 * ⚓ Why generated: the 2026-09-22 worksheets were a hand inventory and their
 * line numbers went stale with every merge. Only the notes are hand-written.
 *
 * Method — ONE AST for everything: Svelte's own `parse()` (modern AST). A `.ts`
 * file is parsed as the body of a `<script lang="ts">`, so templates, component
 * scripts and modules all walk as the same ESTree. (acorn + acorn-typescript
 * alone refuses most of our .ts — measured 2026-10-01.)
 *
 *   - Template text is grouped into RUNS: adjacent text, `{expressions}` and
 *     inline elements (<strong>, <kbd>, <a>…) form ONE message, because that is
 *     the unit a translator must reorder. `{expr}` becomes a placeholder.
 *   - Attributes: `title`, `aria-*` text, `placeholder`, `alt` on elements; any
 *     prop on a component that passes the text heuristic.
 *   - Script: string literals, template literals (`${x}` → `{x}`) and `+`
 *     chains, judged by a text heuristic plus their syntactic context
 *     (comparisons, property keys, imports, console/DOM calls are skipped).
 *
 * Key = `<surface>_<slug of the text>` — identifier-safe, because Paraglide
 * compiles each key to a function (`docs/design/i18n-plan.md` §3). Identical text on
 * one surface is ONE message with several locations.
 *
 * ⚠️ Known limits, also printed into the inventory:
 *   - A single LOWERCASE word in a script is only kept when its context names a
 *     text field (`label:`, `hint:`…); elsewhere it is indistinguishable from
 *     an enum value. Capitalised single words are kept.
 *   - Strings built at runtime from DATA (character/ability names, caveats,
 *     src/lib/data/**) are out of scope — caveats are translated from their own
 *     guide (round record R1), game names come from genshin-db.
 *   - `throw new Error(...)` text is kept and flagged `thrown`: most never reach
 *     a screen, but the code cannot tell which do.
 *
 * Read-only by default (prints a summary). `--write` regenerates
 * docs/text/ledger/inventory/. `--surface=<id>` prints one surface's entries.
 *
 *   node scripts/extract-strings.mjs
 *   node scripts/extract-strings.mjs --write
 *   node scripts/extract-strings.mjs --surface=vz_crit
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from 'svelte/compiler';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const LEDGER = join(ROOT, 'docs/text/ledger');
const OUT = join(LEDGER, 'inventory');
const NOTES = join(LEDGER, 'notes');
const TERMS = join(LEDGER, 'terms.json');

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const ONLY = args.find((a) => a.startsWith('--surface='))?.slice('--surface='.length);

// ─── Surfaces ────────────────────────────────────────────────────────────────
// First match wins; a path is matched relative to src/. `null` = no
// user-facing text by design (dev-only pages, renderers, schema), skipped. A
// file that yields strings and matches nothing is reported as UNASSIGNED —
// that is the drift alarm for a new file.
const SURFACES = [
	[null, /^routes\/styleguide\/|^routes\/\(scene\)\/lab\//], // specimen boards, not shipped copy
	[null, /utils\/characterLint\.ts$|^lib\/types\/|^lib\/stores\.ts$/], // dev-facing lint text · schema · storage defaults
	[null, /^lib\/landing\/(sceneGL|sceneDim|starPass|shootingStars|transition|veilReady)\.ts$/],
	// The Google Form's own option values + the prefilled tech line: never shown on the
	// site, and they must match the form EXACTLY (feedback.ts) — translated with the form.
	[null, /^lib\/feedback\.ts$/],
	['seo', /^lib\/seo\.ts$|SeoHead\.svelte$/],
	[
		'chrome',
		/SiteChrome|NavPanel|SiteFooter|ChromeOverlay|ChromeModals|^lib\/tools\.ts$|toolChrome\.ts$|BandMenu|ToolStack|^routes\/\+layout\.svelte$|\(scene\)\/\+layout\.svelte$|\(pages\)\/\+layout\.svelte$/
	],
	['landing', /^routes\/\(scene\)\/\+page\.svelte$|^lib\/landing\/|components\/landing\//],
	['errors', /\+error\.svelte$|\(tools\)\/\+layout\.svelte$|ToolColumns/],
	[
		'bench',
		/BenchBand|SlotPortrait|SidePortrait|LoadoutPanel|TeamBonusesBlock|utils\/resonance\.ts$|loadoutIcons/
	],
	[
		'docbar',
		/DocumentActions|DocumentTabs|documentBar|rotationTabs|SavedNotationsOverlay|TabsFullDialog|TabLimitDialog|boardBar|^lib\/boards\.svelte\.ts$|boardUrl|^lib\/library(\.svelte)?\.ts$|LibraryOverlay|LibraryView/
	],
	['settings', /SettingsPanel|settingsBackup|playback\/tones\.ts$|\/settings\/\+page/],
	['coverage', /^lib\/coverage\/|CoverageList|CoverageStrip|\/coverage\/\+page/],
	[
		'help',
		/^lib\/help\/areas\.ts$|HelpAreaShell|AreaTabs|\/help\/(\+page|[a-z-]+\/\+page)\.svelte$/
	],
	['help_planner', /help\/chapters\/RotationPlanner/],
	['help_tb', /help\/chapters\/TeamBuilder/],
	['help_vz', /help\/chapters\/Visualizers/],
	['about', /help\/chapters\/About|\/about\/\+page/],
	['faq', /help\/chapters\/Faq|\/faq\//],
	['beta', /help\/chapters\/Beta|\/beta\//],
	['privacy', /help\/chapters\/Privacy|\/privacy\//],
	['contribute', /help\/chapters\/Contribute|\/contribute\//],
	['vz_crit', /Crit(Instrument|Heatmap)\.svelte$|visualizers\/lib\/(crit|critRamp)\.ts$/],
	['vz_icd', /IcdInstrument|utils\/icd\.ts$/],
	['vz_gauge', /GaugeInstrument|utils\/gauge\.ts$|playhead/],
	['vz_rc', /ReactionCurves|reactionCurves\.ts$/],
	['vz_defres', /DefRes|defres\.ts$/],
	['vz_wish', /Wish|wish\.ts$/],
	['vz_breakdown', /BreakdownInstrument|visualizers\/lib\/breakdown\.ts$/],
	['vz_artifact', /Artifact(Instrument)?\.svelte$|artifactOdds|appraise|ValueWheel/],
	['vz', /visualizers\/|utils\/instrumentUrl\.ts$/],
	[
		'tb',
		/builder\/|CharacterCard|CompositionChips|RosterTab|CharacterFilterRail|CharacterGrid|DetailCard|ConMark|^lib\/capabilities\/|characterFilters|roleIcons/
	],
	[
		'planner',
		/planner\/|plannerSamples|RotationTimeline|RotationNotes|RotationCoverage|BuffTooltip|EventLog|^lib\/timeline\/|^lib\/sim\/|^lib\/playback\/|utils\/(notation|auraDisplay|kqmExport|timelineExport|castTokens|rotationUrl|urlCodec|tokenizer)/
	]
];

function surfaceOf(rel) {
	for (const [id, re] of SURFACES) if (re.test(rel)) return id;
	return 'unassigned';
}

// ─── Files ───────────────────────────────────────────────────────────────────
function* walkFiles(dir) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
		const p = join(dir, e.name);
		if (e.isDirectory()) {
			if (p === join(SRC, 'lib/data/characters')) continue;
			yield* walkFiles(p);
		} else if (
			/\.svelte$/.test(e.name) ||
			(/\.ts$/.test(e.name) && !/\.(test|d|generated)\.ts$/.test(e.name))
		)
			yield p;
	}
}

// ─── Text heuristics ─────────────────────────────────────────────────────────
// A field / prop / variable whose NAME says it holds prose. Lets a lone
// lowercase word through (`unit: 'hits'`), which nothing else can.
const TEXT_FIELD =
	/^(label|title|text|hint|desc|description|caption|heading|note|notes|summary|message|msg|tooltip|placeholder|aria-(label|description|valuetext|roledescription)|unit|units|suffix|prefix|short|long|verb|noun|plural|singular|word|caveat|kicker|sub|subtitle|body|help|tip|blurb|lede|cta|empty|tagline|headline|legend|lines?|para|prose|explain|answer|question)s?$/i;
const TEXT_FIELD_SUFFIX =
	/(Label|Title|Text|Hint|Desc|Note|Caption|Message|Tooltip|Heading|Unit|Prose|Word|Line)s?$/;
// Context that holds CODE however the string looks.
const CODE_FIELD =
	/^(class|cls|className|style|css|selector|key|keys|id|ids|icon|mark|glyph|kind|type|event|attr|path|href|src|url|font|transform|easing|d|fill|stroke|color|colour|bg|token|tokens|slug|ref|mode|variant|tone|tag|code|axis|element|el|lang|format|mime|ease|role|anchor|zone|group|tier|tab|area|route|param|query|storageKey)$/i;
const CODE_FIELD_SUFFIX =
	/^(text(Align|Baseline|Anchor|Decoration\w*|Transform|Rendering|Overflow)|line(Cap|Join|Height|Width|Dash\w*)|font\w*|white\w*|globalComposite\w*)$|(Class|Key|Id|Ids|Icon|Mark|Kind|Type|Url|Href|Path|Color|Colour|Var|Token|Selector|Style|Css|Slug|Ref|Mode|Tone|Tag|Zone|Font)$/;

// Calls whose string arguments are never shown.
const SKIP_CALLS = new Set([
	'log',
	'warn',
	'error',
	'info',
	'debug',
	'trace',
	'assert',
	'time',
	'timeEnd',
	'group',
	'groupEnd',
	'querySelector',
	'querySelectorAll',
	'getElementById',
	'closest',
	'matches',
	'createElement',
	'createElementNS',
	'addEventListener',
	'removeEventListener',
	'dispatchEvent',
	'CustomEvent',
	'Event',
	'KeyboardEvent',
	'getItem',
	'setItem',
	'removeItem',
	'get',
	'has',
	'delete',
	'getAttribute',
	'setAttribute',
	'removeAttribute',
	'hasAttribute',
	'toggleAttribute',
	'add',
	'remove',
	'toggle',
	'contains',
	'replace',
	'replaceAll',
	'split',
	'startsWith',
	'endsWith',
	'includes',
	'indexOf',
	'lastIndexOf',
	'match',
	'matchAll',
	'search',
	'test',
	'padStart',
	'padEnd',
	'join',
	'matchMedia',
	'getComputedStyle',
	'getPropertyValue',
	'setProperty',
	'removeProperty',
	'fetch',
	'goto',
	'import',
	'require',
	'getContext',
	'setContext',
	'hasContext',
	'createContext',
	'RegExp',
	'Symbol',
	'Intl',
	'NumberFormat',
	'DateTimeFormat',
	'toLocaleString',
	'toFixed',
	'getContextAttributes',
	'getUniformLocation',
	'getAttribLocation',
	'getExtension',
	'createShader',
	'shaderSource',
	'localeCompare',
	'persisted',
	'writable',
	'readable',
	'Map',
	'Set',
	'animate',
	'scrollIntoView',
	'focus',
	'postMessage',
	'pushState',
	'replaceState',
	'searchParams',
	'URLSearchParams',
	'URL',
	'Blob',
	'download',
	'decode',
	'encode',
	'btoa',
	'atob',
	'parse',
	'stringify',
	'stateKey',
	'icon',
	'getAvatar',
	'hasAvatar',
	'below',
	'above',
	'cssVar',
	'readVar',
	'cssNum',
	'resolveVar',
	'select',
	'selectAll',
	'style',
	'attr',
	'expect',
	'describe',
	'it',
	'on',
	'off',
	'emit',
	'mark',
	'measure',
	'tok',
	'el'
]);
const THROW_CTORS = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError']);

const UNIT_TOKEN = /^[-+]?[\d.]+(px|rem|em|ms|s|%|deg|vh|vw|svh|dvh|fr|x|ch|turn)?[,;)]*$/;
const CSS_FN =
	/(var\(--|rgba?\(|hsla?\(|oklch\(|oklab\(|color-mix\(|calc\(|clamp\(|min\(|max\(|translate|rotate\(|scale\(|cubic-bezier|steps\(|linear-gradient|radial-gradient|url\(|blur\(|drop-shadow|inset\(|polygon\()/;
const SVG_PATH = /^[MmLlHhVvCcSsQqTtAaZz][\d\s.,eE+\-MmLlHhVvCcSsQqTtAaZz]*$/;

function codeMarked(tok) {
	return /[-_./#:=()[\]{}<>@$\\|]/.test(tok) || /\d/.test(tok) || /^[a-z]+[A-Z]\w*$/.test(tok);
}

/** Does this string read as prose rather than code? `field` is its context's name. */
function looksLikeText(raw, field = '') {
	const t = raw.replace(/\{[^{}]*\}/g, ' X ').trim(); // placeholders count as a word
	if (!/\p{L}/u.test(raw.replace(/\{[^{}]*\}/g, ''))) return false;
	if (/^(https?:|mailto:|data:|blob:|\/|\.\.?\/|#[\w-]|@)/.test(t) || t.includes('://'))
		return false;
	const solid = raw.replace(/\{[^{}]*\}/g, '0'); // a placeholder as a number, for shape tests
	if (CSS_FN.test(t) || SVG_PATH.test(solid.trim())) return false;
	if (/^[\d.\s]*(px|rem|em|deg|%|fr)$/.test(solid.trim())) return false;
	if (/^--?[a-z][\w-]*\s*:/.test(t)) return false; // a CSS declaration
	if (/^<(svg|\?xml|path|g)\b/.test(t)) return false;
	if (/\b(sans-serif|monospace|serif)\b.*,|,.*\b(sans-serif|monospace|serif)\b/.test(t))
		return false;
	if (/^\(?(min|max|prefers)-[\w-]+\s*:/.test(t) || /^\(prefers-/.test(t)) return false;
	if (/^[\w.-]+\.(svg|png|jpe?g|webp|avif|json|ts|js|svelte|css|md|woff2?)$/i.test(t)) return false;
	const codeCtx = field && (CODE_FIELD.test(field) || CODE_FIELD_SUFFIX.test(field));
	const textCtx = field && (TEXT_FIELD.test(field) || TEXT_FIELD_SUFFIX.test(field));
	const toks = t.split(/\s+/).filter(Boolean);
	if (toks.length > 1) {
		if (toks.every((k) => UNIT_TOKEN.test(k) || /^[\d.,%x×\-+/:]+$/.test(k))) return false;
		const marked = toks.filter((k) => k !== 'X' && (codeMarked(k) || UNIT_TOKEN.test(k))).length;
		const words = toks.filter((k) => k !== 'X').length;
		if (codeCtx && !textCtx) return marked < words / 2 && /[A-Z]/.test(t[0] ?? '');
		if (words > 0 && marked === words) return false; // a class list, a CSS value
		return true;
	}
	// One token. A code-shaped field wins: `textDecorationLine: 'underline'`.
	if (codeCtx) return false;
	if (textCtx)
		return (
			(!/^[a-z]+[A-Z-_]/.test(t) && !codeMarked(t.replace(/[.!?:…%]$/, ''))) ||
			/^[A-Z][a-z]+$/.test(t)
		);
	if (/^[A-Z][a-z]+(['’][a-z]+)?[.!?:…]?$/.test(t)) return true; // Save · Reset · Pyro
	if (/^[A-Z]{2,5}$/.test(t)) return true; // ICD · ATK · DEF — ambiguous, kept
	if (/[…—–×·]/.test(t) && /\p{L}{2}/u.test(t)) return true;
	return false;
}

// ─── Inventory ───────────────────────────────────────────────────────────────
/** surface → text → entry */
const inventory = new Map();
/** Data values printed raw by a template — see `noteFromData`. */
const fromData = [];
let unassigned = new Map();

function slugOf(text) {
	const words = text
		.replace(/<[^>]+>/g, ' ')
		.replace(
			/\{([^{}]*)\}/g,
			(_, e) => ' ' + (e.match(/[A-Za-z_$][\w$]*(?=\s*$|\s*[)\]]*$)/)?.[0] ?? 'x') + ' '
		)
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.split(' ')
		.filter(Boolean);
	let slug = '';
	for (const w of words) {
		if (slug && (slug + '_' + w).length > 40) break;
		slug = slug ? slug + '_' + w : w;
	}
	return slug || 'x';
}

function record(file, line, text, info) {
	const rel = relative(SRC, file);
	const surface = surfaceOf(rel);
	if (surface === null) return;
	text = text.replace(/\s+/g, ' ').trim();
	if (!text) return;
	if (surface === 'unassigned') {
		unassigned.set(rel, (unassigned.get(rel) ?? 0) + 1);
	}
	let bucket = inventory.get(surface);
	if (!bucket) inventory.set(surface, (bucket = new Map()));
	let entry = bucket.get(text);
	if (!entry) bucket.set(text, (entry = { text, where: [], vars: new Set(), flags: new Set() }));
	entry.where.push({ file: rel, line, kind: info.kind });
	for (const v of info.vars ?? []) entry.vars.add(v);
	for (const f of info.flags ?? []) entry.flags.add(f);
}

// ─── Source positions ────────────────────────────────────────────────────────
function lineIndex(src) {
	const starts = [0];
	for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
	return (offset) => {
		let lo = 0;
		let hi = starts.length - 1;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if (starts[mid] <= offset) lo = mid;
			else hi = mid - 1;
		}
		return lo + 1;
	};
}

// ─── Per-file walk ───────────────────────────────────────────────────────────
const INLINE = new Set([
	'strong',
	'em',
	'b',
	'i',
	'u',
	's',
	'kbd',
	'code',
	'a',
	'abbr',
	'span',
	'sup',
	'sub',
	'small',
	'mark',
	'q',
	'time',
	'br',
	'wbr',
	'dfn',
	'cite',
	'var',
	'tspan'
]);
// Element attributes that are read by a person.
const TEXT_ATTRS = new Set([
	'title',
	'aria-label',
	'aria-description',
	'aria-valuetext',
	'aria-roledescription',
	'aria-placeholder',
	'placeholder',
	'alt',
	'label'
]);
// Attributes whose expressions only ever hold code.
const CODE_ATTRS =
	/^(class|style|id|href|src|srcset|for|type|role|d|viewBox|fill|stroke|transform|points|xmlns|key|data-.*|text-anchor|dominant-baseline|alignment-baseline|aria-current|aria-hidden|aria-live|aria-orientation|aria-haspopup|aria-sort|inputmode|autocomplete|loading|decoding|preserveAspectRatio|stroke-.*|fill-.*|font-.*|paint-order|vector-effect|shape-rendering|mask|clip-path|marker-.*|filter)$/;
// Component props that are never prose, whatever their value looks like.
const SKIP_PROPS =
	/^(class|style|id|href|src|srcset|for|type|role|name|d|viewBox|fill|stroke|transform|xmlns|key|kind|variant|tone|size|icon|mark|tab|mode|element|anchor|placement|side|align|value|ref|width|height|x|y|cx|cy|r|rx|ry|points|data-.*|on.*|bind.*)$/;

function extractFile(file) {
	let src = readFileSync(file, 'utf8');
	const isTs = file.endsWith('.ts');
	let shift = 0;
	if (isTs) {
		src = '<script lang="ts">\n' + src.replaceAll('</script', '<\\/script') + '\n</script>';
		shift = 1;
	}
	const lineOf = lineIndex(src);
	const L = (node) => lineOf(node.start ?? 0) - shift;
	const code = (node) => src.slice(node.start, node.end);
	let ast;
	try {
		ast = parse(src, { modern: true, filename: file });
	} catch (e) {
		console.error(`✗ ${relative(ROOT, file)}: ${e.message}`);
		return;
	}

	// ── JS ──
	/** Emits candidates under `node`; returns how many it emitted. */
	function walkJs(node, ctx = {}, parent = null) {
		if (!node || typeof node !== 'object') return 0;
		if (Array.isArray(node)) return node.reduce((n, c) => n + walkJs(c, ctx, parent), 0);
		const t = node.type;
		if (!t) return 0;
		if (
			/^(Import|Export(All)?Declaration$)/.test(t) &&
			t !== 'ExportNamedDeclaration' &&
			t !== 'ExportDefaultDeclaration'
		)
			return 0;
		if (t === 'ExportNamedDeclaration') return walkJs(node.declaration, ctx, node);
		if (t === 'ImportExpression') return 0;
		if (t.startsWith('TS')) {
			if (
				t === 'TSAsExpression' ||
				t === 'TSSatisfiesExpression' ||
				t === 'TSNonNullExpression' ||
				t === 'TSTypeAssertion'
			)
				return walkJs(node.expression, ctx, node);
			return 0; // types, interfaces, enums
		}
		if (t === 'ExpressionStatement' && node.directive) return 0;

		if (t === 'Literal') {
			if (typeof node.value !== 'string') return 0;
			return candidate(node.value, node, ctx, []);
		}
		if (t === 'TemplateLiteral') {
			if (parent?.type === 'TaggedTemplateExpression') return 0;
			let text = '';
			const vars = [];
			let nested = 0;
			node.quasis.forEach((q, i) => {
				text += q.value.cooked ?? q.value.raw;
				const ex = node.expressions[i];
				if (ex) {
					const c = code(ex);
					text += `{${c}}`;
					vars.push(c);
					nested += walkJs(ex, { ...ctx, inTemplate: true }, node);
				}
			});
			return nested + candidate(text, node, ctx, vars, nested ? ['assembled'] : []);
		}
		if (
			t === 'BinaryExpression' &&
			node.operator === '+' &&
			(isStr(node.left) || isStr(node.right) || isConcat(node.left))
		) {
			const parts = [];
			flatten(node, parts);
			let text = '';
			const vars = [];
			let nested = 0;
			for (const p of parts) {
				if (p.type === 'Literal' && typeof p.value === 'string') text += p.value;
				else if (p.type === 'TemplateLiteral') {
					p.quasis.forEach((q, i) => {
						text += q.value.cooked ?? q.value.raw;
						if (p.expressions[i]) {
							const c = code(p.expressions[i]);
							text += `{${c}}`;
							vars.push(c);
							nested += walkJs(p.expressions[i], ctx, p);
						}
					});
				} else {
					const c = code(p);
					text += `{${c}}`;
					vars.push(c);
					nested += walkJs(p, ctx, node);
				}
			}
			return nested + candidate(text, node, ctx, vars, ['assembled']);
		}
		if (
			t === 'BinaryExpression' &&
			['===', '!==', '==', '!=', 'in', 'instanceof'].includes(node.operator)
		) {
			return (
				(isStr(node.left) ? 0 : walkJs(node.left, ctx, node)) +
				(isStr(node.right) ? 0 : walkJs(node.right, ctx, node))
			);
		}
		if (t === 'SwitchCase') return walkJs(node.consequent, ctx, node);
		if (t === 'ObjectExpression') {
			// A map whose string values are mostly prose (`{ team: 'team-wide',
			// self: 'self only' }`) is a TEXT TABLE: its lone lowercase words are
			// text too, which nothing else could tell from enum values.
			const strs = node.properties.filter(
				(p) => p.type === 'Property' && !p.computed && isStr(p.value)
			);
			const prose = strs.filter((p) =>
				looksLikeText(p.value.value, String(p.key.name ?? p.key.value))
			);
			const table = strs.length >= 3 && prose.length * 2 > strs.length;
			return walkJs(node.properties, { ...ctx, textTable: table }, node);
		}
		if (t === 'Property' || t === 'PropertyDefinition' || t === 'MethodDefinition') {
			const key = !node.computed ? (node.key.name ?? node.key.value) : null;
			// The table vote reaches only this object's OWN string values.
			const textTable = !!ctx.textTable && isStr(node.value);
			return walkJs(
				node.value,
				{ ...ctx, field: key != null ? String(key) : ctx.field, textTable },
				node
			);
		}
		if (t === 'MemberExpression') {
			return (
				walkJs(node.object, ctx, node) +
				(node.computed && !isStr(node.property) ? walkJs(node.property, ctx, node) : 0)
			);
		}
		if (t === 'VariableDeclarator')
			// `let { label = 'Save' } = $props()` — a pattern's defaults are text too.
			return (
				walkJs(node.id.type === 'Identifier' ? null : node.id, ctx, node) +
				walkJs(node.init, { ...ctx, field: node.id.name ?? ctx.field }, node)
			);
		if (t === 'AssignmentExpression') {
			const target =
				node.left.type === 'MemberExpression'
					? (node.left.property.name ?? node.left.property.value)
					: node.left.name;
			return walkJs(node.right, { ...ctx, field: target ?? ctx.field }, node);
		}
		if (t === 'AssignmentPattern')
			return walkJs(node.right, { ...ctx, field: node.left.name ?? ctx.field }, node);
		if (t === 'CallExpression' || t === 'NewExpression') {
			const name = calleeName(node.callee);
			if (t === 'NewExpression' && THROW_CTORS.has(name))
				return walkJs(node.arguments, { ...ctx, thrown: true }, node);
			if (
				SKIP_CALLS.has(name) ||
				/^(console|document|window|localStorage|sessionStorage|gl|ctx)$/.test(rootName(node.callee))
			)
				return walkJs(
					node.arguments.filter((a) => !isStr(a) && a.type !== 'TemplateLiteral'),
					ctx,
					node
				);
			return (
				walkJs(node.callee, ctx, node) +
				walkJs(node.arguments, { ...ctx, field: ctx.field ?? name }, node)
			);
		}
		if (t === 'ReturnStatement' || t === 'ArrowFunctionExpression') {
			// A function's return keeps the field it was assigned to: `label: () => 'Save'`.
			return walkJs(t === 'ReturnStatement' ? node.argument : node.body, ctx, node);
		}
		let n = 0;
		for (const k of Object.keys(node)) {
			if (
				k === 'type' ||
				k === 'start' ||
				k === 'end' ||
				k === 'loc' ||
				k === 'range' ||
				k === 'metadata' ||
				k === 'leadingComments' ||
				k === 'trailingComments' ||
				k === 'typeAnnotation' ||
				k === 'returnType' ||
				k === 'typeParameters' ||
				k === 'typeArguments'
			)
				continue;
			const v = node[k];
			if (v && typeof v === 'object') n += walkJs(v, ctx, node);
		}
		return n;
	}

	function candidate(text, node, ctx, vars, flags = []) {
		const codeField =
			ctx.field && (CODE_FIELD.test(ctx.field) || CODE_FIELD_SUFFIX.test(ctx.field));
		const tableWord = ctx.textTable && !codeField && /^\p{Ll}[\p{L}'’]*(-\p{L}+)*$/u.test(text);
		// In a text table the key is the map's own label, not a field name —
		// `anchor: 'Anchor'` — so a value that reads as text on its own is text.
		const tableText = ctx.textTable && looksLikeText(text);
		if (!tableWord && !tableText && !looksLikeText(text, ctx.field ?? '')) return 0;
		const f = [...flags];
		if (ctx.thrown) f.push('thrown');
		if (
			vars.some((v) => /[!=]==?\s*1\b|\b1\s*[!=]==?/.test(v)) ||
			/\{[^{}]*\}\s+[a-z]+s\b/.test(text)
		)
			f.push('plural?');
		if (/(\d|\})x\b|\bx(\d|\{)/.test(text)) f.push('x-for-×');
		if (/&[a-zA-Z]+;|&#\d+;/.test(text)) f.push('entity');
		const kind = ctx.attr ? `${ctx.attr}=` : ctx.field ? `${ctx.field}:` : 'script';
		record(file, L(node), text, { kind: ctx.inTemplate ? kind : kind, vars, flags: f });
		return 1;
	}

	const isStr = (n) => n && n.type === 'Literal' && typeof n.value === 'string';
	const isConcat = (n) =>
		n &&
		n.type === 'BinaryExpression' &&
		n.operator === '+' &&
		(isStr(n.left) || isStr(n.right) || isConcat(n.left));
	function flatten(n, out) {
		if (n.type === 'BinaryExpression' && n.operator === '+' && n !== null) {
			flatten(n.left, out);
			flatten(n.right, out);
		} else out.push(n);
	}
	function calleeName(c) {
		if (!c) return '';
		if (c.type === 'Identifier') return c.name;
		if (c.type === 'MemberExpression') return c.property.name ?? c.property.value ?? '';
		return '';
	}
	function rootName(c) {
		while (c && c.type === 'MemberExpression') c = c.object;
		return c?.type === 'Identifier' ? c.name : '';
	}

	// ── Template ──
	function isInlineTree(node) {
		if (node.type === 'Text' || node.type === 'ExpressionTag' || node.type === 'Comment')
			return true;
		if (node.type === 'RegularElement' && INLINE.has(node.name))
			return node.fragment.nodes.every(isInlineTree);
		return false;
	}

	function renderRun(nodes, acc) {
		for (const n of nodes) {
			if (n.type === 'Text') {
				acc.text += n.data;
				acc.staticText += n.data;
				if (/&[a-zA-Z]+;|&#\d+;/.test(n.raw))
					acc.flags.add(
						/&nbsp;/.test(n.raw) && !/&(?!nbsp;)[a-zA-Z]+;|&#\d+;/.test(n.raw) ? 'nbsp' : 'entity'
					);
			} else if (n.type === 'ExpressionTag') {
				const c = code(n.expression);
				acc.text += `{${c}}`;
				acc.vars.push(c);
				acc.nested += walkJs(n.expression, { inTemplate: true, field: acc.field }, n);
				noteDataField(n);
			} else if (n.type === 'RegularElement') {
				if (n.name === 'br' || n.name === 'wbr') {
					acc.text += `<${n.name}>`;
					continue;
				}
				acc.inline += 1;
				walkAttributes(n);
				const before = acc.text.length;
				acc.text += `<${n.name}>`;
				renderRun(n.fragment.nodes, acc);
				acc.text += `</${n.name}>`;
				// An empty inline element (an icon slot, a swatch) says nothing to a translator.
				if (/^<(\w+)>\s*<\/\1>$/.test(acc.text.slice(before))) acc.text = acc.text.slice(0, before);
			}
		}
	}

	// `{#each WEAPONS as w}<button>{w}</button>` prints a DATA VALUE — an id
	// such as `claymore` — with no string literal anywhere, so no message can
	// hold it; a locale needs a lookup there. Listed separately, per surface.
	const eachVars = new Map();
	const constArrays = new Map();
	const DATA_FIELD = /^(region|element|weapon|weaponType)$/;
	/** `{entry?.weapon ?? '?'}` anywhere in a template: an id field read straight
	 *  off a data row, whatever surrounds it. */
	function noteDataField(tag) {
		let ex = tag.expression;
		for (;;) {
			if (ex.type === 'ChainExpression') ex = ex.expression;
			else if (ex.type === 'LogicalExpression') ex = ex.left;
			else break;
		}
		if (ex.type !== 'MemberExpression' || !DATA_FIELD.test(ex.property.name ?? '')) return;
		const surface = surfaceOf(relative(SRC, file));
		if (!surface || surface === 'unassigned') return;
		const at = { surface, file: relative(SRC, file), line: L(tag), expr: code(ex) };
		if (!fromData.some((d) => d.file === at.file && d.line === at.line && d.expr === at.expr))
			fromData.push(at);
	}
	function noteFromData(tag) {
		const ex = tag.expression;
		let root = ex;
		while (root.type === 'MemberExpression') root = root.object;
		if (root.type !== 'Identifier' || !eachVars.get(root.name)) return;
		if (ex.type === 'MemberExpression' && !DATA_FIELD.test(ex.property.name ?? '')) return;
		const surface = surfaceOf(relative(SRC, file));
		if (!surface || surface === 'unassigned') return;
		const at = {
			surface,
			file: relative(SRC, file),
			line: L(tag),
			expr: code(ex),
			from: eachVars.get(root.name)
		};
		if (!fromData.some((d) => d.file === at.file && d.line === at.line && d.expr === at.expr))
			fromData.push(at);
	}
	// What an `{#each}` iterates, as far as this file can say. A literal array
	// (inline, or a top-level const) of PROSE or of numbers needs no lookup — its
	// strings are already messages; one of ids (`'claymore'`) does. Anything not
	// literal (a prop, a call, data rows) is reported, except a numeric axis.
	function eachSource(ex) {
		const src = code(ex);
		while (/^TS(As|Satisfies)Expression$/.test(ex.type)) ex = ex.expression;
		let arr = ex.type === 'ArrayExpression' ? ex : null;
		if (!arr && ex.type === 'Identifier') arr = constArrays.get(ex.name) ?? null;
		if (arr) {
			const els = arr.elements.filter(Boolean);
			const ids = els.filter((e) => isStr(e) && !looksLikeText(e.value));
			return ids.length && ids.length === els.length ? src : null;
		}
		return /(ticks?|values|speeds|readings)$/i.test(src) ? null : src;
	}
	function patternNames(p) {
		if (!p) return [];
		if (p.type === 'Identifier') return [p.name];
		if (p.type === 'ObjectPattern')
			return p.properties.flatMap((q) => patternNames(q.value ?? q.argument));
		if (p.type === 'ArrayPattern') return p.elements.flatMap(patternNames);
		if (p.type === 'AssignmentPattern') return patternNames(p.left);
		return [];
	}

	function walkFragment(fragment, host) {
		let run = [];
		const flush = () => {
			// A run with no text of its own is LAYOUT — `<span><span>Title</span>
			// <span>Hint</span></span>` is two messages, not one. Descend instead.
			const ownText = run.some(
				(n) => (n.type === 'Text' && n.data.trim()) || n.type === 'ExpressionTag'
			);
			if (run.length && !ownText) {
				for (const n of run) if (n.type === 'RegularElement') walkNode(n, host);
				run = [];
				return;
			}
			if (run.length) {
				const acc = {
					text: '',
					staticText: '',
					vars: [],
					nested: 0,
					inline: 0,
					flags: new Set(),
					field: host
				};
				renderRun(run, acc);
				const text = acc.text.replace(/\s+/g, ' ').trim();
				// Only text the TEMPLATE wrote counts; `{ok ? 'Yes' : 'No'}` alone is
				// two script messages, already recorded by the walk.
				const tags = run.filter((n) => n.type === 'ExpressionTag');
				if (!/\p{L}/u.test(acc.staticText) && tags.length === 1) noteFromData(tags[0]);
				if (/\p{L}/u.test(acc.staticText)) {
					const flags = [...acc.flags];
					if (acc.nested) flags.push('assembled');
					if (acc.vars.some((v) => /[!=]==?\s*1\b/.test(v)) || /\}\s+[a-z]+s\b/.test(text))
						flags.push('plural?');
					if (/(\d|\})x\b|\bx(\d|\{)/.test(text)) flags.push('x-for-×');
					record(file, L(run.find((n) => n.type !== 'Text' || n.data.trim()) ?? run[0]), text, {
						kind: `<${host}>`,
						vars: acc.vars,
						flags
					});
				}
			}
			run = [];
		};
		for (const node of fragment.nodes) {
			if (node.type === 'Comment') continue;
			if (isInlineTree(node)) run.push(node);
			else {
				flush();
				walkNode(node, host);
			}
		}
		flush();
	}

	function walkAttributes(el) {
		const isComponent =
			el.type === 'Component' || el.type === 'SvelteComponent' || el.type === 'SvelteSelf';
		for (const a of el.attributes ?? []) {
			if (a.type === 'Attribute') {
				const name = a.name;
				const userFacing = isComponent ? !SKIP_PROPS.test(name) : TEXT_ATTRS.has(name);
				if (a.value === true) continue;
				if (!userFacing) {
					// An expression on any other attribute can still BUILD text — a
					// tooltip assembled in `onmouseenter={…}`. Walk it; the heuristic
					// judges. Attributes that only ever hold code are skipped outright.
					const only = Array.isArray(a.value) ? a.value : [a.value];
					if (!CODE_ATTRS.test(name))
						for (const p of only)
							if (p.type === 'ExpressionTag') walkJs(p.expression, { field: name }, a);
					continue;
				}
				const parts = Array.isArray(a.value) ? a.value : [a.value];
				if (parts.length === 1 && parts[0].type === 'ExpressionTag') {
					walkJs(parts[0].expression, { attr: name, field: name, inTemplate: true }, a);
					continue;
				}
				let text = '';
				const vars = [];
				let nested = 0;
				for (const p of parts) {
					if (p.type === 'Text') text += p.data;
					else {
						const c = code(p.expression);
						text += `{${c}}`;
						vars.push(c);
						nested += walkJs(p.expression, { attr: name, field: name, inTemplate: true }, a);
					}
				}
				if (
					isComponent ? looksLikeText(text, name) : /\p{L}/u.test(text.replace(/\{[^{}]*\}/g, ''))
				) {
					const flags = nested ? ['assembled'] : [];
					if (/(\d|\})x\b|\bx(\d|\{)/.test(text)) flags.push('x-for-×');
					record(file, L(a), text, { kind: `${name}=`, vars, flags });
				}
			} else if (
				a.type === 'SpreadAttribute' ||
				a.type === 'OnDirective' ||
				a.type === 'UseDirective' ||
				a.type === 'AttachTag'
			) {
				if (a.expression) walkJs(a.expression, {}, a);
			}
			// class:/style:/bind:/transition: directives hold no prose
		}
	}

	function walkNode(node, host) {
		if (!node || typeof node !== 'object') return;
		switch (node.type) {
			case 'RegularElement':
			case 'SvelteElement':
				if (node.name === 'style' || node.name === 'script') return;
				walkAttributes(node);
				walkFragment(node.fragment, node.name);
				return;
			case 'Component':
			case 'SvelteComponent':
			case 'SvelteSelf':
			case 'SvelteFragment':
			case 'SlotElement':
			case 'TitleElement':
			case 'SvelteHead':
			case 'SvelteBoundary':
			case 'SvelteWindow':
			case 'SvelteDocument':
			case 'SvelteBody':
				walkAttributes(node);
				if (node.fragment)
					walkFragment(node.fragment, node.type === 'TitleElement' ? 'title' : host);
				return;
		}
		// Blocks and tags: walk every expression and every fragment they hold.
		const bound = node.type === 'EachBlock' ? patternNames(node.context) : [];
		const saved = bound.map((n) => [n, eachVars.get(n)]);
		const source = node.type === 'EachBlock' ? eachSource(node.expression) : null;
		for (const n of bound) eachVars.set(n, source);
		walkBlock(node, host);
		for (const [n, prev] of saved) {
			if (prev === undefined) eachVars.delete(n);
			else eachVars.set(n, prev);
		}
	}

	function walkBlock(node, host) {
		for (const k of Object.keys(node)) {
			if (k === 'metadata' || k === 'type') continue;
			const v = node[k];
			if (!v || typeof v !== 'object') continue;
			if (v.type === 'Fragment') walkFragment(v, host);
			else if (Array.isArray(v))
				v.forEach(
					(c) =>
						c &&
						typeof c === 'object' &&
						(c.type === 'Fragment' ? walkFragment(c, host) : walkJs(c, {}, node))
				);
			else if (
				k === 'expression' ||
				k === 'test' ||
				k === 'declaration' ||
				k === 'context' ||
				k === 'value' ||
				k === 'error' ||
				k === 'key'
			)
				walkJs(v, {}, node);
		}
	}

	for (const prog of [ast.module?.content, ast.instance?.content])
		for (const st of prog?.body ?? []) {
			const decl = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
			if (decl?.type !== 'VariableDeclaration') continue;
			for (const d of decl.declarations) {
				let init = d.init;
				while (init && /^TS(As|Satisfies)Expression$/.test(init.type)) init = init.expression;
				if (d.id.type === 'Identifier' && init?.type === 'ArrayExpression')
					constArrays.set(d.id.name, init);
			}
		}
	if (ast.module) walkJs(ast.module.content);
	if (ast.instance) walkJs(ast.instance.content);
	if (!isTs) walkFragment(ast.fragment, 'root');
}

// ─── Terms (the termbase) ────────────────────────────────────────────────────
// docs/text/ledger/terms.json: the PROTECTED terms. Strings are never marked
// up in code; instead every entry is checked here and tagged with the terms it
// contains, so a translator (or a translating model) is told which spans to
// keep, look up, or translate consistently. Matching is case-sensitive and on
// word boundaries.
function loadTerms() {
	if (!existsSync(TERMS)) return { terms: [], forms: [], avoid: [] };
	const { terms, avoid = [] } = JSON.parse(readFileSync(TERMS, 'utf8'));
	// Every surface form (the term + its `forms`), longest first, so a longer
	// form masks the shorter terms inside it.
	const forms = terms
		.flatMap((t) => [t.term, ...(t.forms ?? [])].map((f) => ({ form: f, term: t, re: wordRe(f) })))
		.sort((a, b) => b.form.length - a.form.length);
	for (const t of terms) t.avoidRe = (t.avoid ?? []).map((a) => [a, wordRe(a)]);
	// The house avoid list: spellings and leaked words, matched in any case.
	// An entry may give a `pattern` (a regex) where a literal form can't say it:
	// `5s CD` has a digit glued to the word.
	const house = avoid.map((a) => ({
		...a,
		re: a.pattern ? new RegExp(a.pattern, 'gu') : wordRe(a.form, 'giu')
	}));
	return { terms, forms, avoid: house };
}
const wordRe = (w, flags = 'gu') =>
	new RegExp(
		`(?<![\\p{L}\\p{N}-])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}-])`,
		flags
	);

/** The terms a message contains, longest form first — a matched span is
 *  masked, so `Electro-Charged` is not also `Electro`. Plus every form the
 *  termbase says to avoid: a term's own variants (case-sensitive — `Crit rate`
 *  in an aria label is deliberate, `Crit Rate` on screen is not) and the house
 *  list (any case). */
function termsIn(text, base) {
	let rest = text.replace(/\{[^{}]*\}/g, ' ').replace(/<[^>]+>/g, ' ');
	const found = new Set();
	const avoided = [];
	for (const t of base.terms)
		for (const [a, re] of t.avoidRe) if (rest.match(re)) avoided.push(`${a} → ${t.term}`);
	for (const a of base.avoid)
		for (const m of rest.matchAll(a.re)) avoided.push(`${m[0]} → ${a.use ?? `(${a.why})`}`);
	for (const f of base.forms) {
		if (rest.match(f.re)) {
			found.add(f.term);
			rest = rest.replace(f.re, (m) => ' '.repeat(m.length));
		}
	}
	return { found: [...found], avoided };
}

// ─── Run ─────────────────────────────────────────────────────────────────────
for (const f of walkFiles(SRC)) extractFile(f);
const base = loadTerms();

// Mint keys: <surface>_<slug>, a short text hash only when two texts collide.
const entries = [];
for (const [surface, bucket] of inventory) {
	const bySlug = new Map();
	for (const e of bucket.values()) {
		const s = slugOf(e.text);
		if (!bySlug.has(s)) bySlug.set(s, []);
		bySlug.get(s).push(e);
	}
	for (const [s, group] of bySlug) {
		for (const e of group) {
			const hash = createHash('sha1').update(e.text).digest('hex').slice(0, 4);
			e.key = `${surface}_${s}${group.length > 1 ? '_' + hash : ''}`;
			e.surface = surface;
			const { found, avoided } = termsIn(e.text, base);
			e.terms = found;
			e.avoided = avoided;
			if (avoided.length) e.flags.add('off-glossary');
			entries.push(e);
		}
	}
}

// Notes keyed to keys that no longer exist: the drift alarm for the hand half.
const keys = new Set(entries.map((e) => e.key));
const orphanNotes = [];
if (existsSync(NOTES)) {
	for (const f of readdirSync(NOTES).filter((n) => n.endsWith('.md'))) {
		const body = readFileSync(join(NOTES, f), 'utf8');
		for (const m of body.matchAll(/^#{2,4} `([a-z0-9_]+)`/gm))
			if (!keys.has(m[1])) orphanNotes.push(`${f}: ${m[1]}`);
	}
}

const surfaces = [...new Set([...entries, ...fromData].map((e) => e.surface))].sort();
const bySurface = (s) =>
	entries
		.filter((e) => e.surface === s)
		.sort(
			(a, b) => a.where[0].file.localeCompare(b.where[0].file) || a.where[0].line - b.where[0].line
		);
const FLAG_ORDER = ['off-glossary', 'assembled', 'plural?', 'x-for-×', 'entity', 'nbsp', 'thrown'];
const TERM_MARK = { frozen: '🔒', game: '🎮', label: '🏷', house: '📖' };

function renderSurface(s) {
	const list = bySurface(s);
	const files = [...new Set(list.flatMap((e) => e.where.map((w) => w.file)))].sort();
	let md = `# Inventory — \`${s}\`\n\n`;
	md += `> ⛔ GENERATED by \`scripts/extract-strings.mjs\` — never edit by hand. Notes go in\n> \`../notes/${s}.md\`, keyed by the \`key\`s below. Line numbers are hints.\n\n`;
	md += `**${list.length} messages** · ${files.map((f) => '`' + basename(f) + '`').join(' · ')}\n\n`;
	for (const e of list) {
		const flags = FLAG_ORDER.filter((f) => e.flags.has(f));
		const where = e.where.map((w) => `${basename(w.file)}:${w.line} ${w.kind}`).join(' · ');
		md += `- \`${e.key}\` — ${where}${flags.length ? ' — ⚑ ' + flags.join(' ') : ''}\n`;
		md += `  > ${e.text.replace(/\n/g, ' ')}\n`;
		if (e.vars.size)
			md += `  - vars: ${[...e.vars].map((v) => '`' + v.replace(/`/g, "'") + '`').join(' ')}\n`;
		if (e.terms.length)
			md += `  - terms: ${e.terms.map((t) => `${TERM_MARK[t.class]} ${t.term}`).join(' · ')}\n`;
		if (e.avoided.length) md += `  - ⚠️ off-glossary: ${e.avoided.join(' · ')}\n`;
	}
	const raw = fromData.filter((d) => d.surface === s);
	if (raw.length) {
		md += `\n## Rendered from data\n\nA value printed straight from data, with no string literal: a locale needs a LOOKUP here (the game's term for the id), not a message.\n\n`;
		for (const d of raw)
			md += `- \`{${d.expr}}\` — ${basename(d.file)}:${d.line}${d.from ? `, each over \`${d.from}\`` : ''}\n`;
	}
	return md;
}

const total = entries.length;
const flagCount = (f) => entries.filter((e) => e.flags.has(f)).length;
const summary = [
	`${total} messages across ${surfaces.length} surfaces (${entries.reduce((n, e) => n + e.where.length, 0)} occurrences)`,
	...surfaces.map((s) => `  ${s.padEnd(13)} ${String(bySurface(s).length).padStart(4)}`),
	`rendered from data (lookups, not messages): ${fromData.length}`,
	`flags: ${FLAG_ORDER.map((f) => `${f} ${flagCount(f)}`).join(' · ')}`,
	base.terms.length
		? `terms: ${base.terms.length} terms + ${base.avoid.length} avoided forms in the termbase, ${entries.filter((e) => e.terms.length).length} messages carry one`
		: 'terms: no termbase yet',
	unassigned.size
		? `⚠️ UNASSIGNED files (add them to SURFACES): ${[...unassigned].map(([f, n]) => `${f} (${n})`).join(', ')}`
		: 'unassigned: none',
	orphanNotes.length
		? `⚠️ ORPHANED notes (their key no longer exists): ${orphanNotes.join(', ')}`
		: 'orphaned notes: none'
];

if (ONLY) {
	console.log(renderSurface(ONLY));
} else {
	console.log(summary.join('\n'));
}

if (WRITE) {
	rmSync(OUT, { recursive: true, force: true });
	mkdirSync(OUT, { recursive: true });
	for (const s of surfaces) writeFileSync(join(OUT, `${s}.md`), renderSurface(s));
	let idx = `# Translation ledger — inventory\n\n> ⛔ GENERATED by \`scripts/extract-strings.mjs --write\`. Plan: \`../../ledger-plan.md\`.\n\n`;
	idx += '```\n' + summary.join('\n') + '\n```\n\n';
	idx += `**Terms** (\`../terms.json\`): 🔒 frozen, English everywhere · 🎮 game, the game's own translation · 🏷 label stays, explanation translates · 📖 house, translated once and reused.\n\n`;
	idx += `**Flags:** \`off-glossary\` — uses a form the termbase says to avoid · \`assembled\` —built from fragments (concatenation, or a placeholder that itself holds text) · \`plural?\` — a number sits beside a counted noun · \`x-for-×\` — a bare \`x\` used as multiplication · \`entity\` — an HTML entity in source · \`nbsp\` — only \`&nbsp;\` (fine) · \`thrown\` — an Error message; may never reach a screen.\n\n`;
	idx += `**Known limits:** a lone lowercase word in a script is kept only when its context names a text field · strings built from DATA (character and ability names, caveats, \`src/lib/data/**\`) are out of scope · \`/lab\` and \`/styleguide\` are excluded as specimen boards.\n`;
	writeFileSync(join(OUT, 'README.md'), idx);
	console.log(`\nwrote ${surfaces.length} surfaces → ${relative(ROOT, OUT)}/`);
}
