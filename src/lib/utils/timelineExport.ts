/**
 * src/lib/utils/timelineExport.ts
 *
 * "Copy timeline as PNG" — paints the rotation chart onto a canvas straight
 * from the same derived data the DOM renders, then hands back a PNG blob.
 *
 * Why canvas-2D and not DOM capture or SVG-serialize:
 *   - html2canvas chokes on color-mix() fills and inset box-shadows (the
 *     planner uses both), and captures only the scrolled viewport;
 *   - a serialized SVG needs IBM Plex Mono embedded as a data URI to rasterize
 *     with the right glyphs — canvas simply uses the document's loaded fonts.
 * Geometry comes from the caller's xForTime-derived snapshot, so the export
 * can never drift horizontally from the on-screen chart.
 *
 * ══ THIS IS A PRINT RENDERING, NOT A MIRROR OF THE SCREEN ═══════════════════
 * ⚓ NATE 2026-08-11 asked whether this file earns its keep at all: it needs
 * constant maintenance, it can never look as good as the real chart because it
 * cannot have the night scene behind it, and every Genshin player can already
 * take a screenshot. Three of the four things it offers — uniform framing, the
 * watermark, straight-to-clipboard — a screenshot roughly matches.
 *
 * THE FOURTH IS WHY IT STAYS: it paints `labelW + totalWidth`, the WHOLE
 * timeline, not the viewport. A minute-long rotation at working zoom is several
 * screens wide, and sharing that as one image is the thing a user cannot do for
 * themselves without scrolling and stitching.
 *
 * ⚠ SO THE MAINTENANCE BURDEN WAS NEVER INHERENT — IT CAME FROM THE MIRROR
 * CLAIM, AND THE CLAIM WAS ALREADY FALSE. This painter draws a portrait label
 * column the on-screen chart has not had since the tall-bench round, and it
 * draws the notation itself as a header, which lives in the composer on screen.
 * It is not a screenshot substitute; it is a DOCUMENT — notation, labelled
 * timeline, watermark. That divergence went unremarked for weeks.
 *
 * WHAT THIS MEANS IN PRACTICE, and it is the whole point of writing it down:
 *   · COLOUR still tracks. Both sides read the same tokens, the mirror test is
 *     cheap, and a bar in the wrong hue is a factual error either way.
 *   · SHAPE, GEOMETRY AND CHROME DO NOT have to track. The screen may drop a
 *     ground, a border or a separator because it has a live scene behind it;
 *     this canvas has flat paper behind it and may keep whatever a diagram on
 *     paper needs. A polish round is NOT obliged to drag this file along.
 *   · Round two is the first exercise of that: the on-screen chart lost its
 *     slot separators, its ruler seam and its lane rules; the export KEEPS all
 *     of them, because without a scene those lines are what stop a flat chart
 *     reading as soup.
 *
 * ⚠ Colors here MIRROR the CSS in RotationTimeline.svelte (the same
 * keep-in-lockstep convention as elementColors.ts ↔ app.css). If a bar/lane
 * color changes there, change it here.
 */

import { FPS } from '$lib/utils/frames';
import { elementPalette, shiftHue, desaturate } from '$lib/utils/elementColors';
import { barPhases } from '$lib/timeline/barPhases';
import {
	UPTIME_DIM_MIX,
	GHOST_FILL_MIX,
	GHOST_EDGE_MIX,
	GHOST_CHROMA_KEEP
} from '$lib/timeline/barMix';
import type { TimelineBar, InputBlock } from '$lib/utils/notationParser';
import { stepCeiling, stepDensity } from '$lib/timeline/barSteps';
import type {
	BarStep,
	CharReceivedBuffSubrow,
	MoonsignRow,
	SummonSubrow,
	TeamBuffSubrow,
	WeaponProcSubrow
} from '$lib/timeline/types';
import {
	auraMarkerLabels,
	auraSpanLabels,
	auraSpanPoints,
	auraUnitLines,
	type AuraLane
} from '$lib/timeline/auraPlot';
import type { GadgetRow } from '$lib/timeline/gadgetRows';
import type { AuraKey } from '$lib/utils/gauge';

// ── Palette mirror (RotationTimeline.svelte <style>) ────────────────────────

// ↻ 2026-08-09 (Genshin Night): every value below is now the RESOLVED end of a
// chain — app.css grew a primitive layer, so --rp-chart-bg is --surface-well is
// --slate-900. The mirror test resolves the chain itself rather than comparing
// declaration text, so these stay literals and stay checked.
// ↻ 2026-08-11: slate-900 merged with slate-950 (⚓ Nate — see the ramp in
// app.css), so the chart's ground went #262c38 → #1f2635.
/** 🎛️ The human-padding hatch (2026-09-14) — MIRRORS `.rp-input-block--pad` in
 *  RotationTimeline: stroke width, alpha and period. Change both or neither. */
const PAD_HATCH_W = 2;
const PAD_HATCH_ALPHA = 0.12;
const PAD_HATCH_PERIOD = 6;

const CHART_BG = '#1f2635'; // --rp-chart-bg → --surface-well → --slate-900
// ↻ 2026-08-10: both moved because --border did — the line roles dropped to the
// two most transparent stops (--line-edge → --line-soft, ⚓ Nate), and these
// derive from --border. The mirror test caught it, which is the only reason
// this pair is right: nothing else compares an exported PNG to the screen.
// ↻ 2026-08-11: and again — this time because the OTHER input moved. Both mix
// --border against CHART_BG, so the slate-900 merge above pulls them down with
// it. Same lesson from the opposite side: a resolved literal has two ways to go
// stale, and the mirror test is what makes either one loud.
const GRID = '#353b47'; // --rp-grid = mix(ctx-dark --border 45%, chart-bg), resolved
const LANE_LINE = '#494e58'; // --rp-line = mix(ctx-dark --border 85%, chart-bg), resolved
// ⚠ THIS BLOCK IS A HAND-MAINTAINED MIRROR of app.css. Canvas can't resolve
// var(), so every token the export paints has to be duplicated here as a
// literal. When a token value changes in app.css, change it here too or the
// exported PNG silently stops matching what the user saw. ↻ 2026-08-05: the
// timeline runs in the DARK context (.ctx-dark) and the portrait cards in the
// LIGHT one (.ctx-light), so the context-sensitive tokens here mirror those
// blocks, not :root — the mirror test sources them the same way.
const ACTIVE = '#757f93'; // --rp-active (Nate-sampled 2026-07-31; no longer the --neutral alias)
const TEXT = '#ece5d8'; // --text (ctx-dark) → --parchment-100
// ↻ 2026-08-09: the dark context's --muted stopped being an invented blend and
// became what Genshin actually does — the ink laid on the ground at .72.
const MUTED = '#b7b4ae'; // --muted (ctx-dark) = mix(parchment-100 72%, slate-800)
const INK = '#0d0d0f'; // --bright-ink → --ink-950 (⚓ NATE 2026-08-05)
// THE ANNOTATION REGISTER — one bar material for buffs, debuffs and procs
// alike (⚓ Nate 2026-08-11: "there's really no need to colour-split the
// buff/debuff bars"). app.css holds the reasoning.
//
// ⚠ ON SCREEN IT IS GLASS; HERE IT IS THE COMPOSITE. --glass-bar is
// rgb(44 53 73 / .8) laid on the night scene, and a PNG has no scene — so this
// is that material resolved against the only ground the export has, CHART_BG:
//     .8 × (44 53 73) + .2 × (31 38 53) = (41 50 69)
// That is the decoupling declared at the top of this file doing its job. The
// screen gets a material; paper gets what the material looks like on paper.
// ⚠ If --glass-bar's alpha or rung moves, RECOMPUTE — the mirror test does this
// arithmetic and will fail rather than let the two drift. It has already caught
// three moves in one day: slate-700 @ .58 → slate-600 @ .8 → an off-ramp blue,
// twice.
// (Ramping/decaying received buffs paint flat here — the on-screen density
// envelope isn't reproduced; the flat fill matches their full end.)
const BAR_FILL = '#293245';
// ↻ 2026-08-11: the 2px left edge returns to the buff/proc bars alone (⚓ Nate —
// "the main purpose is to separate stacking buff bars"). On screen it is
// rgb(255 255 255 / .3); here it is that composited over BAR_FILL, because a
// canvas has no scene for the alpha to resolve against:
//     .3 × (255 255 255) + .7 × (41 50 69) = (105 111 125)
const BAR_EDGE = '#696f7d';
// ↻ 2026-08-11: every bar label went from .85 white to FULL white on screen
// (⚓ Nate, "all labels back to white"). The one label deliberately left at
// partial strength is the ghost track's CD readout — it is a duration on a
// recessive track, not a label, and it sits on an opaque bar.
// ⛔ The buff / debuff / proc trio of fills and labels collapsed into this ONE
// pair on 2026-08-11. They had been three names for what was becoming the same
// value anyway (procs borrowed debuff's, debuff was pinned to buff's weight);
// the unification made that explicit rather than incidental.
const BAR_LABEL = '#fff';
// Generic-timing (no-frame-map) marks are a DATA-QUALITY state, not a domain
// color (the marks left dire 2026-08-05).
// ↻ 2026-08-12: they ride --ui-provisional, not --ui-danger. The state family
// grew a fourth value for exactly this — "our data is incomplete" is a
// provenance statement, not an error — and the two on-screen rules this mirrors
// moved with it. ⚠ The :root rung, not the ctx-light one: the chart is dark.
const UI_PROVISIONAL = '#f6d365';
// The circular backing behind a (transparent-background) avatar in the label
// column. ↻ 2026-08-05 (archetype consistency pass): was the LIGHT context's
// #f2f2ec, mirroring the `ctx-light` class SlotPortrait used to carry. That
// class is gone — the bench card renders in the ribbon's DARK context, and the
// export's own label column has always been painted CHART_BG, so a paper disc
// was drift in both directions.
// ↻ 2026-08-11: --sp-avatar-fill was re-cut onto ONE ground and that ground is
// --surface-well, so the flat disc follows it down a rung. The export never
// carried the element gradient (a PNG label column has no element context to
// tint with), so it mirrors the gradient's TOP stop, as it always has.
const PORTRAIT_BG = '#1f2635'; // --surface-well (ctx-dark) → --slate-900

// ── Aura-lane mod colours (gauge round L6) ──────────────────────────────────
// ⚠ The five elemental mods go through `elementPalette`, which is itself the
// guarded mirror of --el-*; only the four that are NOT elements need literals
// here. They are reaction STATES rather than auras of an element (see
// $lib/utils/auraDisplay.ts), so they carry --rx-* hues and have no palette
// entry to borrow.
const RX_FROZEN = '#cbeaf3';
const RX_QUICKEN = '#46c865';
const RX_BURNING = '#d76822';
const RX_BURNING_FUEL = '#84b46a';
// ── Gadget-strip colours (Polestar-Field round, 2026-09-01) ─────────────────
// ⚠ One more --rx-* literal, for the same reason as the four above: a dendro
// core and a thundercloud are their own OBJECTS, not auras of an element, so
// neither has an --el-* entry to borrow. ⚓ The Prism and the Moondrift DO have
// one (Cryo, Geo) and take it.
const RX_DENDRO_CORE = '#e2ec6f';
const RX_THUNDERCLOUD = '#5f9ec4';

// ⚓ The two with a real element go through `elementPalette`, the guarded mirror
// of --el-*; only the two that are their own object need a literal.
const GADGET_COLOR: Record<GadgetRow['kind'], string> = {
	core: RX_DENDRO_CORE,
	prism: elementPalette('cryo').main,
	thundercloud: RX_THUNDERCLOUD,
	moondrift: elementPalette('geo').main
};

const AURA_MOD_COLOR: Record<AuraKey, string> = {
	pyro: elementPalette('pyro').main,
	hydro: elementPalette('hydro').main,
	cryo: elementPalette('cryo').main,
	electro: elementPalette('electro').main,
	dendro: elementPalette('dendro').main,
	frozen: RX_FROZEN,
	quicken: RX_QUICKEN,
	burning: RX_BURNING,
	burningFuel: RX_BURNING_FUEL
};

/** Test-only: the hand-maintained mirror, exported so
 *  timelineExport.mirror.test.ts can assert it against app.css /
 *  RotationTimeline.svelte. The mirror stops being trust-based — if a token
 *  moves without this block, vitest fails. Not for runtime use. */
export const PALETTE_MIRROR = {
	CHART_BG,
	GRID,
	LANE_LINE,
	ACTIVE,
	TEXT,
	MUTED,
	INK,
	BAR_FILL,
	PORTRAIT_BG,
	RX_FROZEN,
	RX_QUICKEN,
	RX_BURNING,
	RX_BURNING_FUEL,
	RX_DENDRO_CORE,
	RX_THUNDERCLOUD
} as const;

const MONO = '"IBM Plex Mono", ui-monospace, monospace';
// Chart text follows the site's Sans-default (body font). Only the notation
// header (KQM notation) keeps MONO — mirrors the on-screen Sans/Mono split.
// ⚠ MUST NAME THE VARIABLE FAMILY, and it is the one literal that has to. Every
// other consumer goes through --font-body, but canvas takes a font STRING and
// cannot resolve a custom property. Since 2026-08-11 the static 'IBM Plex Sans'
// is not loaded at all, so leaving the old name here would have silently
// dropped every exported label onto a system sans — a failure that renders
// perfectly and is only visible by comparing a PNG to the screen.
const SANS = '"IBM Plex Sans Variable", "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif';

// ── Color math (stand-ins for CSS color-mix in srgb) ────────────────────────

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	const n = parseInt(
		h.length === 3
			? h
					.split('')
					.map((c) => c + c)
					.join('')
			: h,
		16
	);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** color-mix(in srgb, a pct%, b) */
function mix(a: string, b: string, pctA: number): string {
	const [ar, ag, ab] = hexToRgb(a);
	const [br, bg, bb] = hexToRgb(b);
	const t = pctA / 100;
	const r = Math.round(ar * t + br * (1 - t));
	const g = Math.round(ag * t + bg * (1 - t));
	const bl = Math.round(ab * t + bb * (1 - t));
	return `rgb(${r}, ${g}, ${bl})`;
}

// ── Snapshot shape (assembled by RotationTimeline from its deriveds) ────────

export type ExportBar = TimelineBar & { hasSummon: boolean };

export type ExportSlot = {
	displayName: string | null; // null = blank slot
	element: string | undefined;
	/** No-frame-map character (uncurated stub, not Blank): its N/C/P tokens get
	 *  the dire gradient + dire text, mirroring the on-screen treatment. */
	isApprox: boolean;
	consLevel: number;
	blockH: number;
	qRowTop: number;
	activeRowTop: number;
	buffRowsTop: number;
	summonLaneTop: number;
	tracks: Array<{
		activeStart: number;
		activeEnd: number;
		hasUnsetDuration: boolean;
		inputBlocks: InputBlock[];
		eBars: ExportBar[];
		qBars: ExportBar[];
	}>;
	summonRows: SummonSubrow[];
	procRows: WeaponProcSubrow[];
	receivedRows: CharReceivedBuffSubrow[];
	/** Equipped artifact/weapon icon paths — drawn under the name so shared
	 *  images show who caused which buffs. */
	equipIcons: string[];
};

export type TimelineSnapshot = {
	title: string;
	/** The raw notation string — rendered as the export's header. */
	notation: string;
	scale: number;
	labelW: number;
	rulerH: number;
	totalWidth: number;
	contentH: number;
	ticks: Array<{ t: number; x: number; major: boolean }>;
	slots: ExportSlot[];
	slotTops: number[]; // offsets below the top ruler
	// Connectors, pre-resolved to geometry (from/to active-row edges)
	connectors: Array<{ x: number; w: number; yTop: number; yBottom: number; downward: boolean }>;
	eRowH: number;
	qRowH: number;
	activeRowH: number;
	buffRowH: number;
	buffRowStride: number;
	summonRowH: number;
	summonRowStride: number;
	charPadTop: number;
	teamBuffRows: TeamBuffSubrow[];
	teamBuffsTop: number;
	teamBuffsH: number;
	nbBars: Array<{ start: number; cooldown: number }>;
	nbTop: number | null; // null = lane hidden
	nbH: number;
	moonsignRows: MoonsignRow[];
	moonsignTop: number | null;
	moonsignH: number;
	/**
	 * The target-aura lane (gauge round L6).
	 *
	 * ↻ 2026-08-17: `auraTop` became `auraHeaderH`, and the rename IS the change.
	 * The lane moved ABOVE the ruler, so it no longer has a position within the
	 * lane stack — it opens the chart column, and what the painter needs is how
	 * far everything else is pushed down by it. **0 means not drawn** (the layer
	 * is off, or the rotation landed nothing), which replaces the old `null`.
	 */
	auraLane: AuraLane;
	auraHeaderH: number;
	auraPlotH: number;
	/** Reserved px above the ceiling, so a line AT the ceiling is not clipped in
	 *  half — see AURA_PLOT_HEAD on the screen side. */
	auraPlotHead: number;
	auraMarkerH: number;
	auraTickH: number;
	/** Radius of the application pill — the lane's half of the marker grammar
	 *  shared with the Gauge Explorer. */
	auraPillR: number;
	auraMinPx: number;
	auraLabelMinSpan: number;
	auraLabelMinGap: number;
	auraLabelMinRow: number;
	/** The gadget strip's rows (Polestar-Field round, 2026-09-01) — things a
	 *  reaction left in the world. ⚠️ Its height is already inside
	 *  `auraHeaderH`, so every `oy`-relative offset below stays byte-identical
	 *  whether the strip is there or not. */
	gadgetRows: GadgetRow[];
	/** ⚠️ A row's height is set by the gadget's CAPACITY, never by the rotation's
	 *  own peak — a counted row gets `gadgetProfileH`, a binary one its own dot.
	 *  See gadgetRows.ts. */
	gadgetProfileH: number;
	gadgetDotR: number;
	/** 🎛️ The state shape's flat alpha — ⛔ no gradient, ⛔ no outline. */
	gadgetFillAlpha: number;
	gadgetRowGap: number;
	statIconFor: (stat: string) => string | undefined;
	avatarFor: (slotIdx: number) => string | null;
	elementGlyphFor: (element: string | undefined) => string | null;
};

// ── Image preload ────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		img.src = src;
	});
}

/** Greedy word-wrap against the current ctx font. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
	if (!text) return [];
	const words = text.split(' ');
	const lines: string[] = [];
	let cur = '';
	for (const word of words) {
		const trial = cur ? `${cur} ${word}` : word;
		if (ctx.measureText(trial).width > maxW && cur) {
			lines.push(cur);
			cur = word;
		} else {
			cur = trial;
		}
	}
	if (cur) lines.push(cur);
	return lines;
}

// ── The painter ──────────────────────────────────────────────────────────────

const DPR = 2; // fixed 2× raster for crisp Discord/KQM embeds
const PAD = 16; // canvas padding around the chart
const FOOTER_H = 22; // watermark strip

export async function renderTimelinePng(snap: TimelineSnapshot): Promise<Blob> {
	await document.fonts.ready;

	// Preload every image the chart needs (portraits, glyphs, stat icons).
	const imageSrcs = new Set<string>();
	snap.slots.forEach((s, i) => {
		const a = snap.avatarFor(i);
		if (a) imageSrcs.add(a);
		const g = snap.elementGlyphFor(s.element);
		if (g) imageSrcs.add(g);
	});
	for (const row of snap.teamBuffRows) {
		const icon = snap.statIconFor(row.primaryStat);
		if (icon) imageSrcs.add(icon);
	}
	for (const slot of snap.slots) {
		for (const row of slot.receivedRows) {
			const icon = snap.statIconFor(row.primaryStat);
			if (icon) imageSrcs.add(icon);
		}
	}
	for (const slot of snap.slots) {
		for (const src of slot.equipIcons) imageSrcs.add(src);
	}
	// The moonsign lane's one constant glyph — mirrors LUNAR_ICON on screen
	const lunarIconSrc = snap.moonsignRows.length ? snap.statIconFor('lunarDmgBonus') : undefined;
	if (lunarIconSrc) imageSrcs.add(lunarIconSrc);
	const images = new Map<string, HTMLImageElement>();
	await Promise.all(
		[...imageSrcs].map(async (src) => {
			const img = await loadImage(src);
			if (img) images.set(src, img);
		})
	);

	const w = snap.labelW + snap.totalWidth + PAD * 2;

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('canvas 2d context unavailable');

	// Header: the notation itself, wrapped to the canvas width. Measured
	// before the canvas is sized (resizing resets ctx state anyway).
	const HEADER_LINE_H = 17;
	ctx.font = `11px ${MONO}`;
	const notationLines = wrapText(ctx, snap.notation.trim(), w - PAD * 2);
	const headerH = notationLines.length > 0 ? notationLines.length * HEADER_LINE_H + 14 : 0;

	const h = headerH + snap.contentH + PAD * 2 + FOOTER_H;
	canvas.width = w * DPR;
	canvas.height = h * DPR;
	ctx.scale(DPR, DPR);

	// Ground
	ctx.fillStyle = CHART_BG;
	ctx.fillRect(0, 0, w, h);

	// Notation header
	ctx.font = `11px ${MONO}`;
	ctx.fillStyle = 'rgba(230, 237, 248, 0.85)';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	notationLines.forEach((line, i) => {
		ctx.fillText(line, PAD, PAD + 8 + i * HEADER_LINE_H);
	});

	// Chart origin (tracks area starts right of the label column, below the
	// notation header). The ruler rides the TOP edge (DAW convention, mirrors the
	// live component); track lanes start below it at oy + rulerH.
	//
	// ⚠ `oy` IS THE RULER'S TOP, NOT THE CHART COLUMN'S (2026-08-17). The aura
	// lane sits above the axis now, so the column opens `auraHeaderH` earlier.
	// Defining the origin this way is deliberate: every `oy + snap.rulerH + …`
	// below is a track offset and stays exactly as it was, so the lane's move is
	// a change to TWO expressions here rather than to forty downstream.
	const ox = PAD + snap.labelW;
	const chartTop = PAD + headerH;
	const oy = chartTop + snap.auraHeaderH;

	// ⚓ The export's own frames→px seam, mirroring the two wrappers in
	// RotationTimeline: the snapshot carries FRAMES (gauge-round.md C1) while
	// `snap.scale` is px per SECOND. `barGeomW` below derives from this, so the
	// division lands once. ⚠ `snap.ticks` are ALREADY seconds — the component
	// computes them off the seconds-native `rulerTicks` — so they skip it.
	const x = (f: number) => ox + Math.round((f / FPS) * snap.scale);

	/** FRAMES → the "12.5s" readout, matching the live component's label. */
	const secondsLabel = (frames: number) => Math.round((frames / FPS) * 10) / 10;

	// ── Gridlines (z:0) — from the ruler's seam down to the lanes' end ──
	ctx.strokeStyle = GRID;
	ctx.lineWidth = 1;
	for (const tick of snap.ticks) {
		if (!tick.major) continue;
		ctx.beginPath();
		ctx.moveTo(ox + tick.x + 0.5, oy + snap.rulerH);
		// ⚠ Measured from `chartTop`: `contentH` is the WHOLE column including the
		// aura band, and the gridlines start below the axis. Mirrors the screen,
		// where the gridline layer lives in .rp-tracks and the header is a sibling.
		ctx.lineTo(ox + tick.x + 0.5, chartTop + snap.contentH);
		ctx.stroke();
	}

	// ── Ruler (top edge): stubs rise to the seam, labels above ──
	ctx.textBaseline = 'alphabetic';
	for (const tick of snap.ticks) {
		ctx.fillStyle = tick.major ? '#3a3a4a' : GRID; // --border / --rp-grid (mirrors .rp-tick)
		const th = tick.major ? 8 : 4;
		ctx.fillRect(ox + tick.x, oy + snap.rulerH - th, 1, th);
		if (tick.major && tick.t > 0) {
			ctx.fillStyle = MUTED;
			ctx.font = `10px ${SANS}`;
			ctx.textAlign = 'center';
			ctx.fillText(`${tick.t}s`, ox + tick.x, oy + snap.rulerH - 11);
		}
	}
	ctx.strokeStyle = LANE_LINE;
	ctx.beginPath();
	ctx.moveTo(ox, oy + snap.rulerH + 0.5);
	ctx.lineTo(ox + snap.totalWidth, oy + snap.rulerH + 0.5);
	ctx.stroke();

	// Rounded-rect helper (uniform radius)
	function rr(px: number, py: number, pw: number, ph: number, r: number) {
		ctx!.beginPath();
		ctx!.roundRect(px, py, pw, ph, r);
	}

	// Width = difference of rounded endpoints (mirrors barGeom in the
	// timeline) so adjacent segments telescope at every zoom.
	const barGeomW = (start: number, span: number) => Math.max(x(start + span) - x(start), 2);

	// Cast pill / summon fill — mirrors castFill(), which went FLAT on
	// 2026-08-11 (the top-light was depth against a raised frame that no longer
	// exists). Colour is one of the things the export does still track; see the
	// decoupling note at the top of this file for what it doesn't.
	function paintCastFill(px: number, py: number, pw: number, ph: number, bar: string) {
		ctx!.fillStyle = bar;
		rr(px, py, pw, ph, 1);
		ctx!.fill();
	}

	// Bar-label halo — mirrors the shared on-screen text-shadow: a soft halo
	// in a dark shade of the bar's own element color (NB/moonsign pin their
	// darkest palette color) so full-white labels read on light fills.
	// Two passes, one per shadow layer; the second also lays the final fill.
	// `tight` = 0 1px 2px @ 0.25; `wide` = 0 0 6px @ 0.5 (mirrors the CSS).
	function haloText(
		text: string,
		tx: number,
		ty: number,
		tight: string,
		wide: string,
		maxW?: number
	) {
		ctx!.save();
		ctx!.shadowColor = wide;
		ctx!.shadowBlur = 6;
		if (maxW !== undefined) ctx!.fillText(text, tx, ty, maxW);
		else ctx!.fillText(text, tx, ty);
		ctx!.shadowColor = tight;
		ctx!.shadowBlur = 2;
		ctx!.shadowOffsetY = 1;
		if (maxW !== undefined) ctx!.fillText(text, tx, ty, maxW);
		else ctx!.fillText(text, tx, ty);
		ctx!.restore();
	}

	/** The two halo shadow colors for a BAR-rung hex (dark shade, −30 L).
	 *  ⚠ The bar rung, not `main` — the halo's job is to hold white ink off the
	 *  fill it sits on, so it has to be that fill's own shade. Mirrors
	 *  --label-halo in RotationTimeline, which moved the same day. */
	function elementHalo(bar: string): [string, string] {
		return [shiftHue(bar, 0, -30, 0.25), shiftHue(bar, 0, -30, 0.5)];
	}

	// ── NB / Moonsign layered-tile fills — mirror the on-screen CSS ──
	// (repeat-x px tiles; angles flattened to horizontal — invisible at 14px)

	/** rgba() with alpha, from a hex color */
	const alpha = (hex: string, a: number) => {
		const [r, g, b] = hexToRgb(hex);
		return `rgba(${r}, ${g}, ${b}, ${a})`;
	};

	// NB/moonsign label halos pin each lane's darkest palette color
	const NB_HALO_TIGHT = alpha('#f85b21', 0.25);
	const NB_HALO_WIDE = alpha('#f85b21', 0.5);
	const MOONSIGN_HALO_TIGHT = alpha('#2b3576', 0.25);
	const MOONSIGN_HALO_WIDE = alpha('#2b3576', 0.5);

	/** One tiling linear-gradient layer painted across a clipped bar */
	function tileLinear(
		px: number,
		py: number,
		pw: number,
		ph: number,
		tileW: number,
		stops: Array<[number, string]>
	) {
		for (let ox = 0; ox < pw; ox += tileW) {
			const g = ctx!.createLinearGradient(px + ox, 0, px + ox + tileW, 0);
			for (const [at, c] of stops) g.addColorStop(at, c);
			ctx!.fillStyle = g;
			ctx!.fillRect(px + ox, py, Math.min(tileW, pw - ox), ph);
		}
	}

	/** One tiling soft elliptical bloom layer (cx px / cy fraction per tile) */
	function tileBloom(
		px: number,
		py: number,
		pw: number,
		ph: number,
		tileW: number,
		cx: number,
		cyFrac: number,
		rx: number,
		ry: number,
		color: string,
		fade: number
	) {
		for (let ox = cx; ox < pw + rx; ox += tileW) {
			ctx!.save();
			ctx!.translate(px + ox, py + cyFrac * ph);
			ctx!.scale(rx, ry);
			const g = ctx!.createRadialGradient(0, 0, 0, 0, 0, 1);
			g.addColorStop(0, color);
			g.addColorStop(fade, alpha(color, 0));
			g.addColorStop(1, alpha(color, 0));
			ctx!.fillStyle = g;
			ctx!.fillRect(-1, -1, 2, 2);
			ctx!.restore();
		}
	}

	/* ⛔ paintBrightBarEdge is DELETED (2026-08-11, the flattening pass). It
	   mirrored the 1px ring + 2px lighter left edge that every bar used to
	   carry; screen-side those went from the buff, proc, NB and moonsign bars
	   in one sweep, so there is nothing left for it to mirror. */

	/** Phlogiston NB fill — mirrors .rp-nb-bar */
	function paintNbBar(px: number, py: number, pw: number, ph: number) {
		ctx!.save();
		rr(px, py, pw, ph, 1);
		ctx!.clip();
		ctx!.fillStyle = '#f85b21';
		ctx!.fillRect(px, py, pw, ph);
		tileLinear(px, py, pw, ph, 251, [
			[0, '#f85b21'],
			[0.24, '#e1a566'],
			[0.46, '#f85b21'],
			[0.65, mix('#f85b21', '#e1a566', 55)],
			[0.82, '#e1a566'],
			[1, '#f85b21']
		]);
		tileBloom(px, py, pw, ph, 127, 15, 0.25, 26, 10, '#e1a566', 0.7);
		tileBloom(px, py, pw, ph, 173, 60, 0.75, 34, 12, '#e1a566', 0.72);
		tileBloom(px, py, pw, ph, 211, 160, 0.3, 24, 12, mix('#70e1c1', '#e1a566', 55), 0.82);
		// ↻ 2026-08-12: the buff register's 2px left edge came to this lane.
		// ⚠ TWO THINGS DIFFER FROM THE BUFF BARS' EDGE AND BOTH MATTER.
		// (1) It is painted INSIDE the clip and AFTER the tiles: this fill is a
		//     stack of tiled layers, not one colour, so drawing it first buries it.
		// (2) It uses REAL ALPHA, not BAR_EDGE. That literal is white .3
		//     composited against BAR_FILL — the glass bar's ground — and this
		//     lane's ground is a bright phlogiston orange, so the literal would
		//     paint a grey-blue smear here. Over an already-painted canvas the
		//     alpha resolves correctly on its own; the literal only exists for
		//     bars whose ground the exporter has to model rather than draw.
		ctx!.fillStyle = 'rgba(255, 255, 255, 0.3)';
		ctx!.fillRect(px, py, 2, ph);
		ctx!.restore();
	}

	/** Soft moonlight fill — mirrors .rp-moonsign-bar */
	function paintMoonsignBar(px: number, py: number, pw: number, ph: number) {
		ctx!.save();
		rr(px, py, pw, ph, 1);
		ctx!.clip();
		// Base gradient — #87B3FF · #B0A9FF · #BEA1FF, palindromic.
		tileLinear(px, py, pw, ph, 719, [
			[0, '#87b3ff'],
			[0.2521, '#b0a9ff'],
			[0.5, '#bea1ff'],
			[0.75, '#b0a9ff'],
			[1, '#87b3ff']
		]);
		// Occasional soft cyan (0.4) + coral (0.2) blooms.
		tileLinear(px, py, pw, ph, 433, [
			[0, alpha('#69dbf2', 0)],
			[0.15, alpha('#69dbf2', 0.4)],
			[0.3, alpha('#69dbf2', 0)],
			[0.6, alpha('#ef8e91', 0)],
			[0.8, alpha('#ef8e91', 0.2)],
			[1, alpha('#ef8e91', 0)]
		]);
		// The 2px left edge — real alpha over the painted tiles; see paintNbBar
		// for why this is not BAR_EDGE.
		ctx!.fillStyle = 'rgba(255, 255, 255, 0.3)';
		ctx!.fillRect(px, py, 2, ph);
		ctx!.restore();
	}

	// ── Per-slot ghost CD tracks first (z:0), then connectors (z:1),
	//    then solid bars (z:2) — the on-screen sandwich. ──

	type GhostDraw = { px: number; pw: number; py: number; ph: number; barColor: string; cd: number };
	const ghosts: GhostDraw[] = [];

	function collectBarPhases(
		bar: ExportBar,
		rowTop: number,
		rowH: number,
		/** ⚠ The `bar` RUNG, not `main` — every use below is a fill. */
		barColor: string,
		badge: string,
		solids: Array<() => void>
	) {
		// Full row height (the 1px inset died with the bottom-shading look);
		// ghost CD tracks are 14px — the summon/buff row height
		const py = rowTop;
		const ph = rowH;
		const ghostY = rowTop + 3;
		const ghostH = rowH - 6;

		const drawSolid = (start: number, span: number, dim: boolean) => {
			solids.push(() => {
				const px = x(start);
				const pw = barGeomW(start, span);
				ctx!.font = `700 9px ${SANS}`;
				ctx!.textAlign = 'left';
				if (dim) {
					ctx!.fillStyle = mix(barColor, CHART_BG, UPTIME_DIM_MIX);
					rr(px, py, pw, ph, 1);
					ctx!.fill();
					// Dim continuation keeps the white+halo treatment.
					ctx!.fillStyle = '#fff';
					haloText(badge, px + 4, py + ph / 2 + 3, ...elementHalo(barColor));
				} else {
					paintCastFill(px, py, pw, ph, barColor);
					// ↻ 2026-08-14: WHITE + HALO, same as the dim branch above.
					// 🐛 This was still painting dark INK "mirrors .rp-bar-row-badge
					// (bright-chip idiom, 2026-08-01)" — but that idiom was retired
					// on screen on 2026-08-11, so the export had been drawing dark
					// ink under white-labelled pills for three days. ⚠ The mirror
					// test only covers COLOUR TOKENS, not which ink a label picks,
					// so nothing caught it; the two branches are now identical and
					// there is no second treatment left to drift.
					ctx!.fillStyle = '#fff';
					haloText(badge, px + 4, py + ph / 2 + 3, ...elementHalo(barColor));
				}
			});
		};
		const pushGhost = (start: number, span: number, cd: number) => {
			ghosts.push({
				px: x(start),
				pw: barGeomW(start, span),
				py: ghostY,
				ph: ghostH,
				barColor,
				cd
			});
		};

		// Shared phase geometry (barPhases.ts). The canvas projection keeps its
		// own styling: drawSolid always stamps the badge + radius-1; ghost tracks
		// paint below. `uptimeDim`/`overflow` are the dim continuation tones.
		for (const seg of barPhases(bar, bar.hasSummon)) {
			if (seg.role === 'ghost') {
				pushGhost(seg.start, seg.span, seg.cooldown ?? 0);
			} else {
				const dim = seg.role === 'uptimeDim' || seg.role === 'overflow';
				drawSolid(seg.start, seg.span, dim);
			}
		}
	}

	const solidDraws: Array<() => void> = [];

	snap.slots.forEach((slot, si) => {
		const top = oy + snap.rulerH + snap.slotTops[si];
		const p = elementPalette(slot.element);

		for (const track of slot.tracks) {
			// ⚠️ The BAR's element when it lands one that is not the slot's
			// (Varka's Four Winds and burst), else the slot's — the on-screen rule.
			const barPal = (bar: ExportBar) => (bar.element ? elementPalette(bar.element).bar : p.bar);
			for (const bar of track.eBars)
				collectBarPhases(
					bar,
					top + snap.charPadTop,
					snap.eRowH,
					barPal(bar),
					bar.label,
					solidDraws
				);
			for (const bar of track.qBars)
				collectBarPhases(bar, top + slot.qRowTop, snap.qRowH, barPal(bar), bar.label, solidDraws);
		}

		// Active strip + input blocks (solid layer)
		for (const track of slot.tracks) {
			const rowTop = top + slot.activeRowTop;
			solidDraws.push(() => {
				const left = x(track.activeStart);
				const width = Math.max(x(track.activeEnd) - left, 4);
				ctx!.fillStyle = ACTIVE;
				if (track.hasUnsetDuration) {
					ctx!.strokeStyle = ACTIVE;
					ctx!.setLineDash([3, 3]);
					ctx!.strokeRect(left + 0.5, rowTop + 1.5, width - 1, snap.activeRowH - 3);
					ctx!.setLineDash([]);
				} else {
					ctx!.fillRect(left, rowTop + 1, width, snap.activeRowH - 2);
				}
				track.inputBlocks.forEach((block, bi) => {
					const bx = x(block.start);
					const bw = barGeomW(block.start, block.duration);
					const kind = block.kind;
					// No-frame-map N/C/P (everything but E/Q): the ordinary strip with
					// its label in the provisional ink — ↻ 2026-09-14, the gradient
					// wash is retired (mirrors .rp-active-text--danger).
					const approxToken = slot.isApprox && kind !== 'skill' && kind !== 'burst';
					if (kind === 'unset') {
						return;
					} else if (kind === 'pad') {
						// Human timing's padding — mirrors `.rp-input-block--pad`: a
						// 135° hatch of PAD_HATCH_W px white at PAD_HATCH_ALPHA on a
						// PAD_HATCH_PERIOD px period, over the strip, no divider, no label.
						ctx!.save();
						ctx!.beginPath();
						ctx!.rect(bx, rowTop + 1, bw, snap.activeRowH - 2);
						ctx!.clip();
						ctx!.strokeStyle = `rgba(255, 255, 255, ${PAD_HATCH_ALPHA})`;
						ctx!.lineWidth = PAD_HATCH_W;
						const h = snap.activeRowH - 2;
						for (let d = -h; d < bw + h; d += PAD_HATCH_PERIOD) {
							ctx!.beginPath();
							ctx!.moveTo(bx + d, rowTop + 1 + h);
							ctx!.lineTo(bx + d + h, rowTop + 1);
							ctx!.stroke();
						}
						ctx!.restore();
						return;
					} else if (kind === 'skill' || kind === 'burst' || kind === 'elemental-normal') {
						// ⚠️ The BLOCK's element, falling back to the slot's — an
						// infused swing does not land in the swinger's own element
						// (Bennett C6 makes Xingqiu's normals pyro). Mirrors the
						// on-screen rule exactly; both read `InputBlock.element`.
						ctx!.fillStyle = mix(
							block.element ? elementPalette(block.element).bar : p.bar,
							ACTIVE,
							50
						);
					} else {
						// Movement and every other non-infused input: the active strip's
						// own color, no extra fill (mirrors the on-screen rule — only
						// elemental infusion may overlay the strip).
						ctx!.fillStyle = ACTIVE;
					}
					ctx!.fillRect(bx, rowTop + 1, bw, snap.activeRowH - 2);
					// gap divider — none on the last block, so the strip meets its
					// swap connector seamlessly (mirrors the on-screen rule)
					if (bi !== track.inputBlocks.length - 1) {
						ctx!.fillStyle = 'rgba(8, 18, 37, 0.2)';
						ctx!.fillRect(bx + bw - 1, rowTop + 1, 1, snap.activeRowH - 2);
					}
					// label — provisional tinted on no-frame-map N/C/P tokens (mirrors
					// .rp-active-text--danger)
					ctx!.fillStyle = approxToken ? UI_PROVISIONAL : '#fff';
					ctx!.font = `600 10px ${SANS}`;
					ctx!.textAlign = 'left';
					ctx!.fillText(block.parts.join(''), bx + 4, rowTop + snap.activeRowH / 2 + 3, bw - 6);
				});
			});
		}

		// Summon lane (solid layer, opaque mix)
		slot.summonRows.forEach((srow, ri) => {
			const rowTop = top + slot.summonLaneTop + ri * snap.summonRowStride;
			solidDraws.push(() => {
				for (const sbar of srow.bars) {
					const px = x(sbar.start);
					const pw = barGeomW(sbar.start, sbar.end - sbar.start);
					// Full-strength castFill — same finish as the E/Q pills;
					// full row height (matches the buff bars — no inset).
					// ↻ 2026-08-14: white + halo at --fw-medium, mirroring
					// .rp-summon-label. 🐛 It was dark INK at weight 700, both left
					// behind by the 2026-08-11 round that took this label to white
					// and dropped it two rungs to medium (500). Same blind spot as
					// the E/Q badge above — the mirror test reads colour tokens, not
					// ink choice or font weight.
					paintCastFill(px, rowTop, pw, snap.summonRowH, p.bar);
					ctx!.fillStyle = '#fff';
					ctx!.font = `500 9px ${SANS}`;
					ctx!.textAlign = 'left';
					haloText(
						srow.label,
						px + 4,
						rowTop + snap.summonRowH / 2 + 3,
						...elementHalo(p.bar),
						Math.max(pw - 6, 8)
					);
					// Bottom-anchored tick stubs — mirror .rp-summon-tick (7px, opaque
					// since 2026-09-18)
					ctx!.fillStyle = p.hi;
					const th = 7;
					for (const tickT of sbar.ticks) {
						ctx!.fillRect(x(tickT), rowTop + snap.summonRowH - th, 1, th);
					}
					// Threshold fires — mirror .rp-summon-fire: full height, 2px,
					// centred, in the hit's element.
					for (const fire of sbar.fires ?? []) {
						ctx!.fillStyle = elementPalette(fire.element).hi;
						ctx!.fillRect(x(fire.time) - 1, rowTop, 2, snap.summonRowH);
					}
				}
			});
		});

		// Proc + received buff rows (solid layer)
		const buffTop = top + slot.buffRowsTop;
		slot.procRows.forEach((row, pi) => {
			const rowTop = buffTop + pi * snap.buffRowStride;
			solidDraws.push(() => {
				row.bars.forEach((bar, bi) => {
					const next = row.bars[bi + 1];
					drawLaneBar(
						x(bar.start),
						rowTop,
						barGeomW(bar.start, bar.end - bar.start),
						snap.buffRowH,
						BAR_FILL,
						BAR_LABEL,
						`${row.label} trigger CD`,
						undefined,
						next ? x(next.start) : undefined
					);
				});
			});
		});
		slot.receivedRows.forEach((row, ri) => {
			const rowTop = buffTop + (slot.procRows.length + ri) * snap.buffRowStride;
			const icon = snap.statIconFor(row.primaryStat);
			solidDraws.push(() => {
				row.bars.forEach((bar, bi) => {
					const next = row.bars[bi + 1];
					drawLaneBar(
						x(bar.start),
						rowTop,
						barGeomW(bar.start, bar.end - bar.start),
						snap.buffRowH,
						BAR_FILL,
						BAR_LABEL,
						bar.sourceLabel,
						icon ? images.get(icon) : undefined,
						next ? x(next.start) : undefined,
						stepRects(bar.steps, bar.stepMax)
					);
					drawSeams(bar.seams, rowTop, snap.buffRowH);
				});
			});
		});
	});

	/** A stepped bar's steps in canvas pixels (stepped stacks round). */
	function stepRects(
		steps: BarStep[] | undefined,
		stepMax: number | undefined
	): { px0: number; px1: number; density: number }[] | undefined {
		if (!steps?.length) return undefined;
		const ceiling = stepCeiling(steps, stepMax);
		return steps.map((st) => ({
			px0: x(st.start),
			px1: x(st.end),
			density: stepDensity(st.count, ceiling)
		}));
	}

	/** A seamed bar's inner ends (pool round, 2026-09-17) — the leading edge's
	 *  ink at each, mirroring `.rp-buff-seam`. */
	function drawSeams(seams: number[] | undefined, py: number, ph: number) {
		if (!seams?.length) return;
		ctx!.fillStyle = BAR_EDGE;
		for (const s of seams) ctx!.fillRect(x(s), py, 2, ph);
	}

	// Lane bar helper (team buff / proc / received): flat fill + optional icon +
	// label, filling its row.
	//
	// ↻ 2026-08-11 round two: the slim bar and its 2px left edge are both gone
	// (see .rp-team-buff-bar for why the slim bar was the wrong borrowing), so
	// this is back to painting the full `ph` it is handed. What SURVIVES from
	// round one is `nextPx` — the next bar's left edge in this subrow, mirroring
	// the DOM's labelCapPx. The bar clips its own label again, so this is a
	// refinement rather than the only bound: it makes a label stop at the
	// neighbour's edge instead of running under it. Undefined = nothing follows,
	// so the lane's own width bounds it.
	function drawLaneBar(
		px: number,
		py: number,
		pw: number,
		ph: number,
		fill: string,
		labelColor: string,
		label: string,
		icon: HTMLImageElement | undefined,
		nextPx?: number,
		steps?: { px0: number; px1: number; density: number }[]
	) {
		ctx!.fillStyle = fill;
		rr(px, py, pw, ph, 1);
		ctx!.fill();
		// ⚓ A STEPPED BAR (stepped stacks round) — each step is the material at
		// its density, resolved on the export's one ground. Compositing is linear
		// in alpha, so that is CHART_BG moved toward BAR_FILL by the density —
		// ⛔ no new literal, and it tracks BAR_FILL when the mirror test moves it.
		if (steps && steps.length > 0) {
			ctx!.save();
			rr(px, py, pw, ph, 1);
			ctx!.clip();
			for (const st of steps) {
				ctx!.fillStyle = mix(fill, CHART_BG, st.density * 100);
				ctx!.fillRect(st.px0, py, st.px1 - st.px0, ph);
			}
			ctx!.restore();
		}
		// The 2px left edge — the one bar edge that survives the flattening pass,
		// because these bars can overlap and glass gives no seam of its own.
		ctx!.fillStyle = BAR_EDGE;
		ctx!.fillRect(px, py, 2, ph);
		let tx = px + 5;
		if (icon) {
			ctx!.drawImage(icon, tx, py + (ph - 11) / 2, 11, 11);
			tx += 15;
		}
		ctx!.save();
		ctx!.beginPath();
		ctx!.rect(px, py, Math.max(0, Math.min(px + pw, nextPx ?? Infinity) - px - 2), ph);
		ctx!.clip();
		ctx!.fillStyle = labelColor;
		ctx!.font = `600 9px ${SANS}`;
		ctx!.textAlign = 'left';
		ctx!.fillText(label, tx, py + ph / 2 + 3);
		ctx!.restore();
	}

	// ── Lane separators (horizontal) — drawn BEFORE bars/connectors so the
	//    connectors span slot boundaries uninterrupted (matches on-screen
	//    stacking, where positioned bars paint above the container borders) ──
	ctx.strokeStyle = LANE_LINE;
	const hline = (yy: number) => {
		ctx.beginPath();
		ctx.moveTo(PAD, yy + 0.5);
		ctx.lineTo(ox + snap.totalWidth, yy + 0.5);
		ctx.stroke();
	};
	snap.slots.forEach((slot, si) => {
		hline(oy + snap.rulerH + snap.slotTops[si] + slot.blockH);
	});
	// Lane separators are top-only (mirrors the live border-top scheme): a
	// lane's closing line is drawn ONLY when another lane follows, so the
	// bottom-most lane leaves no line before the ruler gap.
	// ↻ 2026-08-17: the aura lane LEFT this test when it moved above the ruler.
	// It is no longer something that "comes after" — moonsign is the bottom-most
	// lane again, and closes only when nothing follows it, which is never.
	const laneFollows = (after: 'teamBuffs' | 'nb') => {
		const later = [after === 'teamBuffs' ? snap.nbTop : null, snap.moonsignTop];
		return later.some((t) => t !== null);
	};
	if (laneFollows('teamBuffs')) {
		hline(oy + snap.rulerH + snap.teamBuffsTop + snap.teamBuffsH);
	}
	if (snap.nbTop !== null && laneFollows('nb')) {
		hline(oy + snap.rulerH + snap.nbTop + snap.nbH);
	}
	// ⛔ No closing line under moonsign: it is bottom-most now, and the rule is
	// "a lane closes only when something comes after it".

	// z:0 — ghosts (chroma-dropped before mixing — recessive structure; the
	// desaturate/mix pairing mirrors the DOM's ghost rules exactly)
	for (const g of ghosts) {
		ctx.fillStyle = mix(desaturate(g.barColor, GHOST_CHROMA_KEEP), CHART_BG, GHOST_FILL_MIX);
		rr(g.px, g.py, g.pw, g.ph, 1);
		ctx.fill();
		// 1px outline on top/right/bottom (left stays open — the track flows out
		// of the cast pill); the right edge still marks the exact ready moment.
		ctx.fillStyle = mix(desaturate(g.barColor, GHOST_CHROMA_KEEP), CHART_BG, GHOST_EDGE_MIX);
		ctx.fillRect(g.px, g.py, g.pw, 1); // top
		ctx.fillRect(g.px + g.pw - 1, g.py, 1, g.ph); // right
		ctx.fillRect(g.px, g.py + g.ph - 1, g.pw, 1); // bottom
		if (g.pw > 32) {
			ctx.fillStyle = 'rgba(255,255,255,0.4)';
			ctx.font = `600 9px ${SANS}`;
			ctx.textAlign = 'center';
			haloText(
				`${secondsLabel(g.cd)}s`,
				g.px + g.pw / 2,
				g.py + g.ph / 2 + 3,
				...elementHalo(g.barColor)
			);
		}
	}

	// z:1 — connectors
	//
	// ↻ 2026-08-11: the corners round FULLY now (⚓ Nate). On screen that is
	// `border-radius: 999px` and CSS's own overlap rule resolves it to
	// min(w, h) — see connectorStyle for the derivation. Canvas has no such
	// rule, so the resolved value is computed here instead: this is the one
	// place the two sides have to agree by hand, and it is why the mirror is
	// worth keeping for a mark this prominent even though SHAPE is otherwise
	// decoupled (see the header).
	//
	// ⚠ arcTo, not quadraticCurveTo. A quadratic with its control point at the
	// corner is the cheap quarter-circle approximation and it undershoots a true
	// arc by ~6% of the radius — invisible at the old 3px cap, and a couple of
	// visible px once the radius can reach tens of px.
	ctx.fillStyle = ACTIVE;
	for (const c of snap.connectors) {
		const cx = ox + c.x;
		const yT = oy + c.yTop;
		const yB = oy + c.yBottom;
		const r = Math.min(c.w, yB - yT);
		ctx.beginPath();
		if (c.downward) {
			ctx.moveTo(cx, yT);
			ctx.lineTo(cx + c.w - r, yT);
			ctx.arcTo(cx + c.w, yT, cx + c.w, yT + r, r);
			ctx.lineTo(cx + c.w, yB);
			ctx.lineTo(cx + r, yB);
			ctx.arcTo(cx, yB, cx, yB - r, r);
		} else {
			ctx.moveTo(cx + r, yT);
			ctx.lineTo(cx + c.w, yT);
			ctx.lineTo(cx + c.w, yB - r);
			ctx.arcTo(cx + c.w, yB, cx + c.w - r, yB, r);
			ctx.lineTo(cx, yB);
			ctx.lineTo(cx, yT + r);
			ctx.arcTo(cx, yT, cx + r, yT, r);
		}
		ctx.closePath();
		ctx.fill();
	}

	// z:2 — solids
	for (const draw of solidDraws) draw();

	// ── Below-timeline lanes ──
	// Team buffs
	{
		const laneTop = oy + snap.rulerH + snap.teamBuffsTop;
		snap.teamBuffRows.forEach((subrow, ri) => {
			const rowTop = laneTop + 2 + ri * snap.buffRowStride;
			const icon = snap.statIconFor(subrow.primaryStat);
			subrow.bars.forEach((bar, bi) => {
				const next = subrow.bars[bi + 1];
				drawLaneBar(
					x(bar.start),
					rowTop,
					barGeomW(bar.start, bar.end - bar.start),
					snap.buffRowH,
					BAR_FILL,
					BAR_LABEL,
					subrow.sourceLabel,
					icon ? images.get(icon) : undefined,
					next ? x(next.start) : undefined,
					stepRects(bar.steps, bar.stepMax)
				);
				drawSeams(bar.seams, rowTop, snap.buffRowH);
			});
		});
	}
	// NB lane (phlogiston fill, matching on-screen)
	if (snap.nbTop !== null) {
		const laneTop = oy + snap.rulerH + snap.nbTop + 2;
		for (const ev of snap.nbBars) {
			const px = x(ev.start);
			const pw = barGeomW(ev.start, ev.cooldown);
			paintNbBar(px, laneTop, pw, snap.buffRowH);
			ctx.fillStyle = '#fff';
			ctx.font = `600 9px ${SANS}`;
			ctx.textAlign = 'left';
			haloText('NB', px + 5, laneTop + snap.buffRowH / 2 + 3, NB_HALO_TIGHT, NB_HALO_WIDE);
			if (pw > 40) {
				ctx.fillStyle = '#fff';
				ctx.textAlign = 'center';
				haloText(
					`${secondsLabel(ev.cooldown)}s`,
					px + pw / 2,
					laneTop + snap.buffRowH / 2 + 3,
					NB_HALO_TIGHT,
					NB_HALO_WIDE
				);
			}
		}
	}
	// Moonsign lane
	if (snap.moonsignTop !== null) {
		snap.moonsignRows.forEach((row, ri) => {
			const rowTop = oy + snap.rulerH + snap.moonsignTop! + 2 + ri * snap.buffRowStride;
			// Per-window lunar glyph + label in the buff-bar grammar, clipped to
			// the span the NEXT window doesn't cover — mirrors the on-screen
			// per-window label cap (the old single first-window label bled
			// across seams; retired 2026-07-31). Icon inset and 15px step as in
			// drawLaneBar.
			row.windows.forEach((win, wi) => {
				const wx = x(win.start);
				const ww = barGeomW(win.start, win.duration);
				paintMoonsignBar(wx, rowTop, ww, snap.buffRowH);
				const next = row.windows[wi + 1];
				const visW = next ? Math.min(ww, x(next.start) - wx) : ww;
				if (visW <= 24) return;
				const name = snap.slots[row.slotIdx]?.displayName ?? '';
				ctx!.save();
				ctx!.beginPath();
				ctx!.rect(wx, rowTop, visW - 2, snap.buffRowH);
				ctx!.clip();
				ctx!.fillStyle = '#fff';
				ctx!.font = `600 9px ${SANS}`;
				ctx!.textAlign = 'left';
				let tx = wx + 5;
				const lunar = lunarIconSrc ? images.get(lunarIconSrc) : undefined;
				if (lunar) {
					// Same two-pass halo the label text gets — canvas shadows apply
					// to drawImage exactly as they do to fillText.
					const iy = rowTop + (snap.buffRowH - 11) / 2;
					ctx!.save();
					ctx!.shadowColor = MOONSIGN_HALO_WIDE;
					ctx!.shadowBlur = 6;
					ctx!.drawImage(lunar, tx, iy, 11, 11);
					ctx!.shadowColor = MOONSIGN_HALO_TIGHT;
					ctx!.shadowBlur = 2;
					ctx!.shadowOffsetY = 1;
					ctx!.drawImage(lunar, tx, iy, 11, 11);
					ctx!.restore();
					tx += 15;
				}
				haloText(
					`${name} · Ascendant Gleam`,
					tx,
					rowTop + snap.buffRowH / 2 + 3,
					MOONSIGN_HALO_TIGHT,
					MOONSIGN_HALO_WIDE
				);
				ctx!.restore();
			});
		});
	}

	// ── Target aura lane (gauge round L6) ──
	// ⚓ THE SHAPE COMES FROM THE SAME FUNCTIONS THE SCREEN USES. `auraSpanPoints`
	// maps a span into the caller's pixel space and `auraSpanLabels` decides which
	// names survive; here they are walked with `lineTo` instead of joined into an
	// SVG `d`. A mirror that re-derives the shape is not a mirror.
	if (snap.auraHeaderH > 0) {
		// ⚓ The band OPENS the column, above the axis — `chartTop`, not an offset
		// down the lane stack.
		const laneY = chartTop;
		const plotTop = laneY + snap.auraMarkerH + snap.auraTickH + 2;
		const plotBase = plotTop + snap.auraPlotH;
		const yOf = (u: number) =>
			plotBase - (u / snap.auraLane.uMax) * (snap.auraPlotH - snap.auraPlotHead);

		// Reaction markers — pip + family name, in the ruler's neutral ink. ⚠ A
		// reaction is not an element and must not borrow one.
		ctx.fillStyle = MUTED;
		ctx.font = `600 9px ${SANS}`;
		ctx.textAlign = 'left';
		// ⚓ WHICH LABELS SURVIVE IS DECIDED BY THE SAME FUNCTION THE SCREEN USES,
		// with the canvas supplying its own metrics (2026-08-17). That is the whole
		// point of `auraMarkerLabels` taking a `measure`: a mirror that re-derives
		// the rule is not a mirror, and this one is 9px where the screen is 10, so
		// a shared THRESHOLD would have been wrong in one of the two.
		const markerShown = auraMarkerLabels(
			snap.auraLane.markers,
			x,
			(text) => ctx!.measureText(text).width,
			8
		);
		for (const marker of snap.auraLane.markers) {
			const mx = x(marker.time);
			// ⛔ No run bracket here either — the screen dropped it because at
			// resting zoom the label is wider than the run it names, so the extent
			// reads as an underline. The count is in `marker.label`.
			ctx.fillRect(mx - 1, laneY + snap.auraMarkerH - 6, 3, 3);
			// ⛔ NO CLIP. The label is drawn in full or not at all — clipping is what
			// produced `Electro-C` on screen, and a canvas clip would reproduce it.
			if (markerShown.has(marker.time)) {
				ctx.fillText(marker.label, mx + 5, laneY + snap.auraMarkerH - 4);
			}
		}

		// ⚓ Application PILLS, each dropping a hairline into the gauge it changed —
		// the grammar shared with the Gauge Explorer (2026-08-17). The
		// --ui-provisional mark is a RING around the pill, not a foot under a
		// stub: it states that the VALUE is a stand-in and must not replace the
		// element colour that identifies the mark.
		const tickY = laneY + snap.auraMarkerH;
		const pillCy = tickY + snap.auraTickH - snap.auraPillR;
		for (const tick of snap.auraLane.ticks) {
			const tx = x(tick.time);
			// The hairline first, so the pill and everything in the plot sit over it.
			ctx.strokeStyle = alpha(elementPalette(tick.element).main, 0.22);
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(tx + 0.5, plotTop);
			ctx.lineTo(tx + 0.5, plotTop + snap.auraPlotH);
			ctx.stroke();
			ctx.fillStyle = alpha(elementPalette(tick.element).main, 0.9);
			ctx.beginPath();
			ctx.arc(tx, pillCy, snap.auraPillR, 0, Math.PI * 2);
			ctx.fill();
			if (tick.provisional) {
				ctx.strokeStyle = UI_PROVISIONAL;
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.arc(tx, pillCy, snap.auraPillR + 0.5, 0, Math.PI * 2);
				ctx.stroke();
			}
		}

		// The one datum, under everything: whole units below the ceiling.
		ctx.strokeStyle = GRID;
		ctx.font = `600 8px ${SANS}`;
		ctx.textAlign = 'left';
		for (const u of auraUnitLines(snap.auraLane.uMax)) {
			const gy = Math.round(yOf(u)) + 0.5;
			ctx.beginPath();
			// ⚓ `ox`, i.e. x(0) — the datum belongs to the PLOT, not the page, and
			// starting it at the label column's edge only happens to coincide.
			ctx.moveTo(ox, gy);
			ctx.lineTo(ox + snap.totalWidth, gy);
			ctx.stroke();
			// ⚓ Named in the LABEL COLUMN, on the far side of 0s — the export has the
			// gutter the screen had to borrow from the frame's padding. ⚠ Not a
			// duplicate of the ceiling reading below it: the column says how high the
			// plot goes, these say where each unit is.
			ctx.fillStyle = MUTED;
			ctx.textAlign = 'right';
			ctx.fillText(`${u}U`, ox - 4, gy + 3);
			ctx.textAlign = 'left';
		}

		// Every span walked once: the gradient area, then the line on top of it.
		const walk = (pts: Array<[number, number]>) => {
			ctx!.beginPath();
			pts.forEach(([px, py], i) => (i ? ctx!.lineTo(px, py) : ctx!.moveTo(px, py)));
		};
		for (const series of snap.auraLane.series) {
			const color = AURA_MOD_COLOR[series.mod];
			for (const span of series.spans) {
				const pts = auraSpanPoints(span, x, yOf, snap.auraMinPx);
				if (pts.length === 0) continue;
				// ⚠ The fuel draws as a bare dashed line with NO area — bookkeeping,
				// not an aura on the target.
				if (!series.dash) {
					// ⚓ The fade is anchored to the SPAN'S OWN PEAK, not the plot's
					// ceiling, so a shallow aura is not drawn as the faint tail of a
					// gradient it never reaches. The screen's objectBoundingBox gradient
					// resolves to exactly this.
					const top = pts.reduce((m, [, py]) => Math.min(m, py), plotBase);
					const grad = ctx.createLinearGradient(0, top, 0, plotBase);
					grad.addColorStop(0, alpha(color, 0.34));
					grad.addColorStop(1, alpha(color, 0));
					ctx.fillStyle = grad;
					walk(pts);
					ctx.lineTo(pts[pts.length - 1][0], plotBase);
					ctx.lineTo(pts[0][0], plotBase);
					ctx.closePath();
					ctx.fill();
				}
				ctx.strokeStyle = color;
				ctx.lineWidth = 2;
				ctx.lineJoin = 'round';
				// ⚠ A DASHED path must be BUTT-capped, or every dash grows half its
				// stroke-width at each end and the gaps close up — which is what made
				// the fuel series read as a badly-aliased solid line. Mirrors the
				// screen; see `burningFuel.dash`.
				ctx.lineCap = series.dash ? 'butt' : 'round';
				ctx.setLineDash(series.dash ? series.dash.split(' ').map(Number) : []);
				walk(pts);
				ctx.stroke();
				ctx.setLineDash([]);
			}
		}

		// Series names, where each aura first appears.
		ctx.font = `600 8px ${SANS}`;
		ctx.textAlign = 'left';
		for (const entry of auraSpanLabels(
			snap.auraLane.series,
			x,
			yOf,
			snap.auraLabelMinSpan,
			snap.auraLabelMinGap,
			snap.auraLabelMinRow
		)) {
			ctx.fillStyle = AURA_MOD_COLOR[entry.mod];
			ctx.fillText(
				entry.label.toUpperCase(),
				x(entry.span.start) + 4,
				Math.max(plotTop + 7, yOf(entry.span.openingU) - 3)
			);
		}

		// ── The gadget strip, under the baseline ──
		// ⚓ Below the plot because a core and a Prism are ENTITIES, not gauge —
		// the same reason the screen puts them there. `plotBase + 2` clears the
		// plot's own bottom margin, which the screen spends as a CSS margin and
		// the canvas has to add by hand.
		// ⚓ MARKS FOR EVENTS, AN AREA FOR STATE — mirroring the screen, and a
		// miniature of the plot above it. ⛔ Not a per-life duration mark of any
		// kind: a dendro core's life is a CONSTANT, so drawing eleven identical 6s
		// spans encoded nothing and read as clutter (three cuts proved it).
		let gadgetY = plotBase + 2;
		for (const row of snap.gadgetRows) {
			const rowH = row.capacity > 1 ? snap.gadgetProfileH : snap.gadgetDotR * 2;
			const color = GADGET_COLOR[row.kind];
			// ⚓ THE STAIR HANGS FROM THE TOP, mirroring the screen: the row's
			// baseline is its top edge, where the discs sit, and each live core
			// steps the boundary DOWN.
			// ⚓ FILL ONLY — ⛔ no gradient, ⛔ no outline. That is what lets the core
			// row and the Prism row read as the same object rather than as a chart
			// beside a bar, and it retires an outline that was drawing the baseline
			// and both end walls along with the data.
			const yOf = (n: number) => gadgetY + (Math.min(n, row.capacity) / row.capacity) * rowH;
			if (row.runs.length > 0) {
				ctx.fillStyle = alpha(color, snap.gadgetFillAlpha);
				ctx.beginPath();
				ctx.moveTo(x(row.runs[0].start), gadgetY);
				for (const run of row.runs) {
					ctx.lineTo(x(run.start), yOf(run.count));
					ctx.lineTo(x(run.end), yOf(run.count));
				}
				ctx.lineTo(x(row.runs[row.runs.length - 1].end), gadgetY);
				ctx.closePath();
				ctx.fill();
			}
			// The spawn discs, last — a mark is never behind the state it caused.
			// ⚠ ONE PER SPAWN INSTANT, not per life: a Lunar-Crystallize tops the
			// field up to three at once, and three identical discs at one x is
			// redundant ink for a count the area already carries.
			ctx.fillStyle = color;
			for (const spawn of row.spawns) {
				ctx.beginPath();
				ctx.arc(x(spawn.time), gadgetY + snap.gadgetDotR, snap.gadgetDotR, 0, Math.PI * 2);
				ctx.fill();
			}
			gadgetY += rowH + snap.gadgetRowGap;
		}
	}
	// ── Label column ──
	// Opaque backing (below the notation header) so long ghost bars never
	// bleed under the labels
	ctx.fillStyle = CHART_BG;
	ctx.fillRect(0, oy, PAD + snap.labelW, h - oy);

	snap.slots.forEach((slot, si) => {
		const top = oy + snap.rulerH + snap.slotTops[si];
		const p = elementPalette(slot.element);
		const cx = PAD + 8;

		// Portrait: circle clip + neutral backing + element ring
		const size = 54;
		const px = PAD + (snap.labelW - size) / 2 - 8;
		const py = top + Math.max((slot.blockH - size) / 2 - 16, 8);
		ctx.save();
		ctx.beginPath();
		ctx.arc(px + size / 2, py + size / 2, size / 2, 0, Math.PI * 2);
		ctx.clip();
		ctx.fillStyle = PORTRAIT_BG;
		ctx.fill();
		const avatarSrc = snap.avatarFor(si);
		const avatar = avatarSrc ? images.get(avatarSrc) : undefined;
		if (avatar) {
			// mirror .rp-avatar-img: scale(1.333) translateY(-14%)
			const s = size * 1.333;
			ctx.drawImage(avatar, px + (size - s) / 2, py + (size - s) / 2 - size * 0.14, s, s);
		}
		ctx.restore();
		// ⚠ `main`, and it stays `main`: this is a RING, not a fill with ink on
		// it, and the bar rung must not creep into the element's identity uses
		// (see the ⛔ at --el-* in app.css). Same for the C-level readout below.
		ctx.strokeStyle = p.main;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(px + size / 2, py + size / 2, size / 2 - 0.75, 0, Math.PI * 2);
		ctx.stroke();

		// Glyph + name + Cn under the portrait
		const nameY = py + size + 16;
		const glyphSrc = snap.elementGlyphFor(slot.element);
		const glyph = glyphSrc ? images.get(glyphSrc) : undefined;
		let tx = cx;
		if (glyph) {
			ctx.drawImage(glyph, tx, nameY - 10, 13, 13);
			tx += 16;
		}
		ctx.fillStyle = slot.displayName ? TEXT : MUTED;
		ctx.font = `600 11px ${SANS}`;
		ctx.textAlign = 'left';
		ctx.fillText(slot.displayName ?? 'Empty', tx, nameY, snap.labelW - 44);
		if (slot.displayName) {
			ctx.fillStyle = slot.consLevel > 0 ? p.main : MUTED;
			ctx.font = `700 9px ${SANS}`;
			ctx.textAlign = 'right';
			ctx.fillText(`C${slot.consLevel}`, PAD + snap.labelW - 10, nameY);
		}

		// Equipped artifact/weapon icons — who caused which buffs
		slot.equipIcons.forEach((src, ei) => {
			const icon = images.get(src);
			if (icon) ctx.drawImage(icon, cx + ei * 24, nameY + 8, 20, 20);
		});
	});

	// Lane labels
	ctx.fillStyle = MUTED;
	ctx.font = `600 9px ${SANS}`;
	ctx.textAlign = 'right';
	const laneLabelX = PAD + snap.labelW - 10;
	// Header hides when the lane is empty (mirrors the on-screen behavior) — the
	// lane's reserved height stays, so lanes below it don't shift.
	if (snap.teamBuffRows.length > 0)
		ctx.fillText(
			'TEAM BUFFS',
			laneLabelX,
			oy + snap.rulerH + snap.teamBuffsTop + snap.teamBuffsH / 2 + 3
		);
	if (snap.nbTop !== null)
		ctx.fillText('NIGHTSOUL BURSTS', laneLabelX, oy + snap.rulerH + snap.nbTop + snap.nbH / 2 + 3);
	if (snap.moonsignTop !== null)
		ctx.fillText(
			'ASCENDANT GLEAM',
			laneLabelX,
			oy + snap.rulerH + snap.moonsignTop + snap.moonsignH / 2 + 3
		);
	if (snap.auraHeaderH > 0) {
		// ⚓ THE ONE PLACE THE EXPORT IS BETTER THAN THE SCREEN, and it costs
		// nothing: the PNG kept its label column when the live chart gave it up
		// (abutting round), so the mod names can sit OUTSIDE the plot here
		// instead of over their own bars. Same names, more room.
		ctx.fillText('TARGET AURA', laneLabelX, chartTop + 9);
		const plotTop = chartTop + snap.auraMarkerH + snap.auraTickH + 2;
		// ⚓ THE LEGEND AND THE CEILING ARE EXPORT-ONLY, and they are the clearest
		// case yet for this file being a DOCUMENT rather than a screenshot (see the
		// header). On screen a reader hovers the plot for a full readout and each
		// aura names itself where it appears; a shared PNG has neither, so the
		// column the live chart gave up earns its keep by carrying both the y
		// ceiling and every mod in the plot.
		ctx.font = `600 8px ${SANS}`;
		ctx.fillStyle = MUTED;
		ctx.fillText(`${snap.auraLane.uMax}U`, laneLabelX, plotTop + 7);
		snap.auraLane.series.forEach((series, si) => {
			ctx!.fillStyle = AURA_MOD_COLOR[series.mod];
			ctx!.fillText(series.label.toUpperCase(), laneLabelX, plotTop + 19 + si * 10);
		});
	}

	// ── Footer: title left, watermark right ──
	const fy = h - PAD / 2 - 4;
	ctx.fillStyle = MUTED;
	ctx.font = `600 10px ${SANS}`;
	ctx.textAlign = 'left';
	ctx.fillText(snap.title, PAD, fy);
	ctx.fillStyle = 'rgba(158, 172, 200, 0.55)';
	ctx.textAlign = 'right';
	ctx.fillText('critcalc.app', w - PAD, fy);

	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error('toBlob failed'));
		}, 'image/png');
	});
}

/**
 * Deliver the PNG. mode 'copy' tries the clipboard and silently falls back to
 * a download when the browser refuses; mode 'download' goes straight to disk.
 * Returns what actually happened.
 */
export async function deliverPng(
	blob: Blob,
	filename: string,
	mode: 'copy' | 'download'
): Promise<'copied' | 'downloaded'> {
	if (mode === 'copy') {
		try {
			if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
				await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
				return 'copied';
			}
		} catch {
			// fall through to download
		}
	}
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
	return 'downloaded';
}
