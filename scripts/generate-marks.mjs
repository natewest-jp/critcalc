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
 * (`<Mark name="uncurated" />`), not what the library happens to call the
 * picture (`CircleSlash2`), so re-picking a glyph — or swapping icon sets
 * entirely — is a one-line change here and touches nothing else.
 *
 * Keep this list SMALL. Lucide ships 2,021 icons and this design language is
 * restrained; add on demand, never speculatively.
 */
const MARKS = {
	// ── Band A: the document ────────────────────────────────────────────────
	/** ONE save mark in BOTH states. The linked document used to swap this for
	 *  RefreshCw — the universal reload/sync glyph — which is half of why
	 *  "Update" read as a software update. Same action, same mark. */
	save: 'Save',
	/** The Library button (§11.6 item 1): books on a shelf — the library's own
	 *  "Shelf" layout. It replaced Load's FolderOpen, which said "open a file". */
	library: 'LibraryBig',
	/** The Team Builder's pane switch below the dock (§11.6): the button names
	 *  the pane it opens — the board panel opening on the right, the character
	 *  panel on the left. */
	panelRight: 'PanelRightOpen',
	panelLeft: 'PanelLeftOpen',
	/** `Share`, not `Share2`: the node-graph glyph is three circles and two
	 *  lines, which silts up at 14px. The arrow-out-of-box reads at any size. */
	share: 'Share',
	more: 'Ellipsis',
	reset: 'RotateCcw',
	/* ⛔ `resetZoom` RETIRED 2026-09-30: the planner's zoom moved into a
	 * popover whose Reset is a WORD — inside a panel titled Zoom it is obvious
	 * what it resets. It had been ListRestart (2026-08-17) and, for one pass
	 * that day, ScanSearch. */
	/** The notation composer's history pair (single truth, 2026-08-13). Every
	 *  team edit is a text rewrite now, so undo is a first-class control on the
	 *  box rather than a keystroke people have to know about.
	 *  ⚠ `Undo2`/`Redo2` (the flat hooked arrows), NOT `Undo`/`Redo` (the curved
	 *  ones): the curved pair is `reset`'s RotateCcw with a straighter tail, and
	 *  the composer sits one band under a "Reset view" button wearing exactly
	 *  that glyph. Two marks a reader has to tell apart by curvature is not a
	 *  distinction this set makes at 14px. */
	undo: 'Undo2',
	redo: 'Redo2',

	// ── The share menu's destinations ───────────────────────────────────────
	link: 'Link',
	copy: 'Copy',
	image: 'Image',
	/** "Report a problem" (feedback form, 2026-10-15): a speech bubble with a
	 *  warning in it — saying something about a problem, which is what the
	 *  link does. ⛔ Not `Bug`: a reader reporting a wrong value is not filing
	 *  a software defect, and an insect at 14px silts into a blot. ⛔ Not
	 *  `warn` again — that mark is the menu's ARMED destructive state, two
	 *  items away. */
	report: 'MessageSquareWarning',

	// ── Deleting an entry ───────────────────────────────────────────────────
	// ↻ 2026-10-09: `rename` (Pencil) retired with SavedNotationsOverlay — the
	// library renames inline from its ⋯ menu, by word.
	delete: 'Trash2',
	/** Emptying a lineup's teams (the Builder's Clear, 2026-10-20). ⛔ Not
	 *  `delete`: a trash can reads as "the lineup goes away", which is
	 *  closing its tab — Clear keeps the lineup and empties it. */
	clear: 'Eraser',
	/** Settings' backup pair. Two identical-shaped word buttons otherwise —
	 *  the arrow is the only thing that says which direction the data moves. */
	download: 'Download',
	upload: 'Upload',

	// ── Band B and general controls ─────────────────────────────────────────
	note: 'FileText',
	/** The phone's collapsed notation dock (mobile round, 2026-10-14): tap to
	 *  write. ⚓ Nate read FileText as a document, which it is. */
	edit: 'PencilLine',
	/** The Team Builder's filter drawer (responsive round, 2026-09-05): the
	 *  roster's filter rail becomes a drawer below BP.toolMin, and this plate is
	 *  what opens it. The funnel, the one glyph every product uses for "narrow
	 *  this list"; `SlidersHorizontal` was considered and reads as settings. */
	filter: 'Filter',
	/**
	 * The planner's two LAYER toggles (2026-08-17): what the timeline draws
	 * besides ability timings.
	 *
	 * ⚓ Both name the layer's own SHAPE rather than its subject, which is the
	 * only register available here. "Buff" and "aura" are mechanics with no
	 * picture — there is no glyph for a granted stat — but each toggle governs a
	 * body of marks the reader can see, so the mark can say which body.
	 *   `aura`  → Activity, a pulse LINE: the lane is one overlaid plot whose
	 *             height is a gauge, and it is the only lane not made of bars.
	 *   `buff`  → Sparkles, the conventional "granted effect" glyph, and the
	 *             right counterpart precisely because it is NOT a chart shape:
	 *             the two toggles govern different kinds of object and the pair
	 *             should not read as two views of one.
	 * ⚠ NOT `Zap` for either — a lightning bolt is Electro in this domain, and a
	 * mark that names an element on a control that governs all of them is worse
	 * than no mark.
	 */
	aura: 'Activity',
	/** ↻ Sparkles → ChevronsUp (⚓ NATE 2026-08-17). Sparkles was the generic
	 *  software glyph for "effects"; Genshin's own vocabulary for a buffed
	 *  character is a pair of RISING CHEVRONS around them, so the double chevron
	 *  is the picture a player of this game already reads as "buffed". It also
	 *  survives 14px better — three stars at two sizes silt where two strokes do
	 *  not. */
	buff: 'ChevronsUp',
	/**
	 * The planner's side-column TRANSCRIPT (2026-08-17), beside the Auras layer
	 * toggle it reads the same data as.
	 *
	 * ⚓ NOT `aura` again. The two controls sit adjacent and do different things —
	 * one draws a chart, one opens a list of lines — so sharing Activity's pulse
	 * would say they were two views of one thing.
	 * ⚓ `Logs` over `ClipboardClock`, which was the other candidate: at the 14px
	 * band B runs, a clipboard with a clock inside it is two objects and a dial
	 * inside a 24px stroke-only viewBox, and it silts to a grey blob — the same
	 * legibility argument that moved `buff` off Sparkles. `Logs` is three
	 * stacked rules with tick marks: it reads as a list of lines at any size, and
	 * a list of lines is exactly what the panel is. ⚠ The clipboard also implies
	 * a DOCUMENT you keep, and this is a live reading of the current rotation.
	 */
	log: 'Logs',
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
	/** The crit instrument's "Roll N hits" sampler — the one control on the
	 *  site that performs a random trial, and the one place a die is literal
	 *  rather than decorative. Replaces a 🎲 EMOJI, which is the icon set's
	 *  standing hazard rather than a taste call: an emoji is rendered by
	 *  whichever fallback face the engine picks, at a size and weight this
	 *  design language never chose, and it lands in COLOUR on a monochrome row.
	 *  `Dices` (two dice) over `Dice5`: at 12px a single die's pips silt into
	 *  its square, while the pair reads as an object at any size. */
	dice: 'Dices',
	/** The Gauge Explorer's transport. ONE button, two marks — the pair is the
	 *  standard media idiom and nothing else on the site plays anything, so
	 *  there is no house form to defer to.
	 *  ⚠ `Play` is a FILLED-LOOKING triangle only because Lucide strokes it with
	 *  round joins; at the 12px this button runs, the outline reads as solid.
	 *  Both replace unicode (▶ / ⏸), which is the standing hazard rather than a
	 *  taste call — those two characters in particular are notorious for
	 *  resolving to an emoji face on some platforms and a text face on others,
	 *  so the button's glyph could arrive in colour, at the wrong weight, or
	 *  half a line tall depending on the machine. */
	play: 'Play',
	pause: 'Pause',

	// ── State badges ────────────────────────────────────────────────────────
	/**
	 * A capability behind a constellation you don't own.
	 *
	 * ⚓ NATE 2026-08-07, after three rounds. NOT a padlock, and the name is
	 * `gated` rather than `locked` so nobody puts one back. A constellation
	 * gate involves no permission and no secrecy — you are simply not at C6
	 * yet — so the padlock was a borrowed software metaphor, and it was ALSO
	 * illegible: at the 10px these chips run, Lucide's shackle is ~2px and no
	 * padlock can resolve. `LockOpen` reads better and says the opposite of
	 * the truth; `StarX` loses its X into the wishlist star; `StarOff` reads
	 * as a rendering fault in a column of rows; `Ban` is a circle-and-diagonal
	 * one seat away from `uncurated`.
	 *
	 * Astroid is a four-cusped star: ONE path, no enclosed counters, no slash.
	 * It's a constellation node — the game's own vocabulary — and its concave
	 * points separate cleanly from `star`'s five straight ones at every size,
	 * which is why wishlist did not have to move.
	 */
	gated: 'Astroid',
	/** The main stat on Artifact Odds' piece card, where the game draws a ✦
	 *  (⚓ Nate 2026-10-06). The same picture as `gated` on purpose — the two
	 *  never share a screen, and the call site should say which it means. */
	mainStat: 'Astroid',
	/** A constellation on the Library's Roster tab (⚓ Nate 2026-10-11): six
	 *  of them under a portrait, FILLED up to the character's level. The same
	 *  picture as `gated` — the game's constellation node — named for what the
	 *  call site means. */
	constellation: 'Astroid',
	/** The Roster tab's edit lock (⚓ Nate 2026-10-11): a roster you can fumble
	 *  with a stray click is locked until you open it for editing. A real lock
	 *  this time — unlike `gated`, the user holds the key. */
	locked: 'Lock',
	unlocked: 'LockOpen',
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
	back: 'ArrowLeft',

	/** The planner's Human timing plate (2026-09-14): a person's hand on the
	 *  button. Chosen over `Pointer` (sparser ink), `PersonStanding` (reads as
	 *  an accessibility affordance in a row of chart controls), and the pace
	 *  animals (`Turtle`/`Snail` say "you are slow" about the reader). */
	hand: 'Hand',
	/** The planner's zoom steppers (⚓ Nate 2026-09-14): a magnifier with its
	 *  sign reads as ZOOM with no slider beside it — below the fold the slider
	 *  is gone and a bare `plus` read as "add". `plus`/`minus` stay for the
	 *  Visualizers' steppers, which step a VALUE. ⚠️ A glyph with a sign inside
	 *  a magnifier is sparse-topped; if it silts at band size, size it by ink
	 *  area per button, never via the shared glyph size. */
	zoomIn: 'ZoomIn',
	zoomOut: 'ZoomOut',
	/** The planner's LAPS plate (playback round B, 2026-09-29; ↻ renamed from
	 *  Repeat 2026-09-30): the next laps simulated and drawn past the notation's
	 *  end. ⚓ Nate: "repeat" is a loop, and playback already loops — the mark
	 *  must say CARRY ON PAST THE END instead. `ArrowRightFromLine` — an arrow
	 *  leaving a bar, the bar the document's end — over `ArrowBigRightDash`
	 *  (heavy, and reads as fast-forward beside a transport). ⛔ Not
	 *  `Repeat`/`Repeat2`/`RotateCw`: every one of them says "again". */
	laps: 'ArrowRightFromLine',
	/** The planner's rewind plate (2026-09-30): back to the start, and — while
	 *  playing — go again from the top with the count-in. `SkipBack` (a bar
	 *  before a triangle, ⏮) over `Rewind` (two triangles, which reads as
	 *  "scrub backwards" — a gesture this transport does not have). Drawn
	 *  FILLED beside Play, as Play is. */
	rewind: 'SkipBack',
	/** The planner's BENCH plate (2026-10-15): below `toolMin`, where the
	 *  bench is a row, it shows or hides that row. `Users` — the bench is the
	 *  TEAM, and two figures read as people at band size. ⛔ Not a panel glyph
	 *  (`PanelTopClose` and kin): those say "a pane of the layout", and beside
	 *  the layer plates it would read as a third layer of the chart. */
	bench: 'Users',
	/** Compare's REFERENCE column (Team Builder round, 2026-10-07): pin one
	 *  character and every other column reads its differences from them. `Pin`
	 *  — the act of fixing one thing in place for the rest to be read against.
	 *  ⛔ Not `Star` (that is the wishlist) nor `Anchor` (nautical, and reads as
	 *  a link at 14px). */
	pin: 'Pin',
	/** A battlefield's checks (lineups design §2.6): the game marks each one
	 *  favoured or disfavoured with a thumb. */
	thumbsUp: 'ThumbsUp',
	thumbsDown: 'ThumbsDown'
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
