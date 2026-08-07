import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as lucide from 'lucide';

// Regenerates the toolbar MARK set from Lucide, so the site's control glyphs
// are a build artifact of a maintained icon library rather than path data
// somebody pasted in once — the same arrangement as the element icons, and for
// the same reason: an icon nobody can trace is an icon nobody dares change.
//
// WHY GEOMETRY AT ALL: the sub-pixel rendering law (/styleguide § Laws) —
// "symbol marks are GEOMETRY, never unicode characters." Engines resolve a
// codepoint like ↺ from whichever fallback face happens to cover it, at a
// different optical size in every browser, with no relation to the metrics of
// the label beside it.
//
// WHY GENERATED RATHER THAN A RUNTIME DEPENDENCY: `@lucide/svelte` would make
// every icon a Svelte COMPONENT instance. On roster-scale surfaces (122
// character cards, several marks each) that is hundreds of component instances
// where this repo renders one <svg> element — and this codebase has measured
// perf trouble at exactly that scale before (project_portrait_loading_diagnosis).
// It would also bring its own <svg> attribute defaults, so the size / stroke /
// aria contract that currently lives in ONE file would have to be re-asserted
// at every call site. Generating the node data keeps `lucide` a devDependency:
// nothing from it reaches the bundle except the paths named below.
//
// ADDING A MARK: add a line to MARKS and re-run. The MarkName union is emitted
// from this map, so a name that is not here cannot be referenced, and a name
// here that nothing uses shows up as dead weight in review.
//
// ADDING A BESPOKE MARK (not from Lucide — a domain glyph the library has no
// word for): emit it alongside these by adding a second record of literal
// nodes and merging it into the output below. Deliberately NOT built yet —
// there is no bespoke entry today, and an empty merge is an abstraction with
// no user. The two hand-drawn marks the site does own are NOT candidates: the
// planner's notes badge is two-fill artwork rather than a currentColor stroke,
// and the element icons are their own generated set (never hand-recolor one).
//
// Auto-run by the predev/prebuild hooks. Manual: npm run generate-marks
// Guarded against drift by src/lib/marks.test.ts.

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = join(ROOT, 'src/lib/marks.generated.ts');
const LICENSE = join(ROOT, 'node_modules/lucide/LICENSE');

/**
 * OUR semantic name → Lucide's export name.
 *
 * The indirection is the point. Call sites say what the control DOES
 * (`<Mark name="update" />`), not what the library happens to call the picture
 * (`RefreshCw`), so re-picking a glyph — or swapping icon sets entirely — is a
 * one-line change here and touches nothing else.
 *
 * Keep this list SMALL. Lucide ships 2,021 icons and this design language is
 * restrained; add on demand, never speculatively.
 */
const MARKS = {
	// ── Band A: the document ────────────────────────────────────────────────
	save: 'Save',
	/** Save, when the document is already linked to a bank entry. */
	update: 'RefreshCw',
	load: 'FolderOpen',
	/** `Share`, not `Share2`: the node-graph glyph is three circles and two
	 *  lines, which silts up at 14px. The arrow-out-of-box reads at any size. */
	share: 'Share',
	more: 'Ellipsis',
	reset: 'RotateCcw',

	// ── The share menu's destinations ───────────────────────────────────────
	link: 'Link',
	copy: 'Copy',
	image: 'Image',

	// ── The bank's entry rows ───────────────────────────────────────────────
	rename: 'Pencil',
	delete: 'Trash2',
	/** Settings' backup pair. Two identical-shaped word buttons otherwise —
	 *  the arrow is the only thing that says which direction the data moves. */
	download: 'Download',
	upload: 'Upload',

	// ── Band B and general controls ─────────────────────────────────────────
	note: 'FileText',
	plus: 'Plus',
	minus: 'Minus',
	close: 'X',
	check: 'Check',
	chevron: 'ChevronDown',
	search: 'Search',
	/** The Visualizers' workspace reset, against a tile's own `reset`: same
	 *  word ("reset") at two scopes, so the MARK has to carry the scope. */
	layout: 'LayoutGrid',
	/** Two things exchange places — a bench slot's occupant, an instrument's
	 *  column. NOT a document action; nothing is saved or reloaded. */
	swap: 'ArrowLeftRight',

	// ── State badges ────────────────────────────────────────────────────────
	/** Gated behind a constellation you don't have. Replaces 🔒, which was a
	 *  COLOR emoji: it ignored `currentColor` outright, so a locked chip kept
	 *  its blue-and-gold padlock through every ink state the chip has. */
	locked: 'Lock',
	star: 'Star',
	/** A character whose frame timing isn't curated yet (⚓ NATE: CircleSlash2,
	 *  which matches the ∅ it replaces). */
	uncurated: 'CircleSlash2',
	/** The armed half of the two-step danger idiom (.btn--danger.is-confirming)
	 *  — the one place a mark buys safety rather than decoration. */
	warn: 'TriangleAlert',

	// ── Going somewhere / handing off ───────────────────────────────────────
	/** Named for the DIRECTION of travel, not the picture: "→ Compare" sends a
	 *  card onward, "← All roles" comes back. Both are navigation. */
	forward: 'ArrowRight',
	back: 'ArrowLeft'
};

const licenseText = await readFile(LICENSE, 'utf8').catch(() => '');
const copyright =
	licenseText.split('\n').find((l) => l.startsWith('Copyright')) ??
	'Copyright (c) Lucide Icons and Contributors';
const { version } = JSON.parse(
	await readFile(join(ROOT, 'node_modules/lucide/package.json'), 'utf8')
);

const missing = Object.entries(MARKS).filter(([, icon]) => !lucide[icon]);
if (missing.length > 0) {
	console.error(
		`[generate-marks] not in lucide@${version}: ${missing.map(([n, i]) => `${n} -> ${i}`).join(', ')}`
	);
	process.exit(1);
}

const names = Object.keys(MARKS);
const rows = names
	.map((name) => {
		const nodes = lucide[MARKS[name]].map(([tag, attrs]) => [tag, attrs]);
		return `\t${name}: ${JSON.stringify(nodes)}`;
	})
	.join(',\n');

const out = `// GENERATED by scripts/generate-marks.mjs — do not edit.
//
// Toolbar mark geometry, extracted from lucide@${version} (ISC).
// ${copyright}
// https://lucide.dev — the upstream project; icons are used unmodified.
//
// Rendered by $lib/components/Mark.svelte, which owns the one <svg> wrapper
// (viewBox, stroke weight, aria) every mark on the site shares. Add or re-point
// a mark in the generator's MARKS map, not here.

/** One SVG child element: its tag, and its attributes as authored upstream. */
export type MarkNode = [tag: string, attrs: Record<string, string>];

/** Every mark the site can render. The union is generated, so a typo in a
 *  \`<Mark name="...">\` is a type error rather than an empty box. */
export type MarkName = ${names.map((n) => `'${n}'`).join(' | ')};

/** Lucide's native grid. The wrapper's viewBox — not a knob. */
export const MARK_VIEWBOX = 24;

export const MARK_NODES: Record<MarkName, MarkNode[]> = {
${rows}
};
`;

await writeFile(OUT, out);

console.log(`[generate-marks] lucide@${version} -> src/lib/marks.generated.ts`);
for (const [name, icon] of Object.entries(MARKS)) {
	const shape = lucide[icon].map(([t]) => t).join('+');
	console.log(`  ${name.padEnd(9)} ${icon.padEnd(12)} ${shape}`);
}
console.log(`  ${names.length} marks`);
