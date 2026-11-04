/**
 * The Visualizers workspace layer: instrument registry, slot-assignment
 * persistence, and the parent↔instrument contracts (share state, handoff).
 *
 * Pure helpers live here so vitest covers them directly; the workspace page
 * (`+page.svelte`) owns all rendering and the restore→persist lifecycle.
 */

import type { Application, ElementId } from '$lib/utils/gauge';
import type { IcdHit } from '$lib/utils/icd';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const INSTRUMENTS = [
	// ⚓ Nate 2026-10-02: the picker's order is CONCEPTUAL — the two defaults
	// first, then the mechanics (ICD, reactions), the damage maths, and the
	// two dice (artifacts, wishes) last.
	// `help` is the instrument's section id in Help's Visualizers chapter
	// (`$lib/help/chapters/Visualizers.svelte`), which the tile's ⋯ links to.
	{ id: 'crit', name: 'Crit heatmap', help: 'crit-heatmap' },
	{ id: 'gauge', name: 'Gauge explorer', help: 'gauge-explorer' },
	{ id: 'icd', name: 'ICD timeline', help: 'icd-timeline' },
	{ id: 'curves', name: 'Reaction curves', help: 'reaction-curves' },
	{ id: 'breakdown', name: 'Damage breakdown', help: 'damage-breakdown' },
	{ id: 'defres', name: 'Enemy RES & DEF', help: 'enemy-res-def' },
	{ id: 'artifact', name: 'Artifact odds', help: 'artifact-odds' },
	{ id: 'wish', name: 'Wish odds', help: 'wish-odds' }
] as const;

export type InstrumentId = (typeof INSTRUMENTS)[number]['id'];

const INSTRUMENT_IDS = INSTRUMENTS.map((i) => i.id) as InstrumentId[];

/** First-load lineup (Nate-picked): position 0 is every first visitor's slot 1 */
export const DEFAULT_ASSIGNMENT: InstrumentId[] = [
	'crit',
	'gauge',
	'artifact',
	'icd',
	'curves',
	'defres',
	'wish',
	'breakdown'
];

// ---------------------------------------------------------------------------
// Slot count: capacity vs preference
// ---------------------------------------------------------------------------

/** The widest lineup any viewport serves — the ceiling a preference clamps to. */
export const MAX_SLOTS = 3;

/**
 * How many instruments the viewport can hold side by side. The thresholds are
 * width-of-the-window, not a media query, because the count also drives JS
 * (which instruments mount, where a handoff lands).
 */
export function viewportCapacity(vw: number): number {
	return vw >= 2200 ? 3 : vw >= 1360 ? 2 : 1;
}

/**
 * The user's lineup preference: 'auto' follows the viewport, a number CAPS it.
 * Never a floor — asking for 3 on a laptop still yields what fits, so the
 * control can't promise a layout the window can't paint.
 */
export type SlotPref = 'auto' | number;

/**
 * ⚓ ONE INSTRUMENT AT A TIME is the default at every width (Nate 2026-11-02,
 * the Visualizers overhaul: `docs/rounds/viz-workspace-bars-2026-11-02.md`).
 * An instrument is a thing you work in, and a half-width tile put the control
 * you drag below the fold in four of six pairings measured at 1440×900. Side
 * by side is the reader's choice, from Layout.
 */
export const DEFAULT_SLOTS: SlotPref = 1;

/** Repair a stored preference: anything that isn't 'auto' or a whole 1..MAX_SLOTS is the default. */
export function normalizeSlots(stored: unknown): SlotPref {
	if (stored === 'auto') return 'auto';
	if (typeof stored !== 'number' || !Number.isInteger(stored)) return DEFAULT_SLOTS;
	if (stored < 1 || stored > MAX_SLOTS) return DEFAULT_SLOTS;
	return stored;
}

/** The lineup actually rendered: the preference clamped by what fits. */
export function effectiveSlots(pref: SlotPref, capacity: number): number {
	return Math.min(INSTRUMENTS.length, capacity, pref === 'auto' ? capacity : pref);
}

// ---------------------------------------------------------------------------
// Workspace persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'critcalc:vizWorkspace';

/**
 * Repair a stored assignment against the CURRENT instrument roster: drop
 * retired/unknown ids, dedupe keeping first occurrence, append instruments
 * the stored array predates (in default order, i.e. new instruments land on
 * the bench of an existing layout). Garbage in → default out. The result is
 * always a permutation of the full current id set.
 */
export function normalizeAssignment(stored: unknown): InstrumentId[] {
	if (!Array.isArray(stored)) return [...DEFAULT_ASSIGNMENT];
	const seen = new Set<InstrumentId>();
	const out: InstrumentId[] = [];
	for (const v of stored) {
		if (typeof v !== 'string') continue;
		const id = v as InstrumentId;
		if (!INSTRUMENT_IDS.includes(id) || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}
	for (const id of DEFAULT_ASSIGNMENT) if (!seen.has(id)) out.push(id);
	return out;
}

/** Everything the workspace persists: which instruments, and how many at once. */
export type StoredWorkspace = { assignment: InstrumentId[]; slots: SlotPref };

/** Read the persisted workspace (already normalized), or null when absent. */
export function loadWorkspace(): StoredWorkspace | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		return parseWorkspace(JSON.parse(raw));
	} catch {
		return null;
	}
}

/**
 * Read a stored workspace record. v1 was written while 'auto' was the
 * default, and it saved the preference whether or not the reader ever
 * touched it, so a v1 'auto' (or a v1 with no `slots`) cannot be told
 * apart from "never chose": it takes today's default. A count a v1 reader
 * did pick (1, 2 or 3) was a choice, and is kept. v2 is taken as written.
 */
export function parseWorkspace(parsed: unknown): StoredWorkspace | null {
	if (typeof parsed !== 'object' || parsed === null) return null;
	const data = parsed as { v?: unknown; assignment?: unknown; slots?: unknown };
	if (data.v !== 1 && data.v !== 2) return null;
	const slots =
		data.v === 1 && (data.slots === 'auto' || data.slots === undefined)
			? DEFAULT_SLOTS
			: normalizeSlots(data.slots);
	return { assignment: normalizeAssignment(data.assignment), slots };
}

export function saveWorkspace(assignment: InstrumentId[], slots: SlotPref): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, assignment, slots }));
	} catch {
		// storage full / privacy mode — layout just won't persist
	}
}

// ---------------------------------------------------------------------------
// Instrument handle contract
// ---------------------------------------------------------------------------

/**
 * Optional per-instrument capabilities, exposed as `export function`s on the
 * component instance and collected by the workspace via `bind:this`. Method
 * calls (not mount-time props) because the keep-alive model means a target
 * may already be mounted when a share link or handoff arrives.
 */
export type InstrumentHandle = {
	/** Serialize the instrument's shareable state (versioned, own shape). */
	getShareState?: () => unknown;
	/** Apply a decoded share payload; the instrument sanitizes internally. */
	applyShareState?: (state: unknown) => void;
	/** Receive a cross-instrument handoff; the instrument sanitizes internally. */
	receiveHandoff?: (kind: string, payload: unknown) => void;
	/** Restore the instrument's controls to their first-load defaults. */
	reset?: () => void;
	/** Run a link's one-shot action (`?do=`, beside `?i=`) on what the
	 *  instrument holds; an action it doesn't know is ignored. */
	act?: (action: string) => void;
};

// ---------------------------------------------------------------------------
// Cross-instrument handoff
// ---------------------------------------------------------------------------

/** Grows one union arm per future handoff (e.g. artifact→crit CV). */
export type HandoffMessage = {
	target: 'gauge';
	kind: 'applications';
	payload: Application[];
};

/** Gauge Explorer caps at this many application rows (shared with its UI). */
export const MAX_GAUGE_APPS = 8;

/** The gauge time slider's ceiling — a handoff leaves out what lands past it. */
export const MAX_GAUGE_TIME = 15;

/**
 * Convert an ICD attack string into Gauge Explorer application rows: only the
 * hits that actually APPLY their element within the gauge's 15s axis, capped
 * at the gauge row limit. A later hit is left out rather than clamped — folding
 * it onto 15s would chart a top-up the ICD chart never showed. Gauge size is
 * not something ICD models, so every application is an honest 1U default (the
 * send button says so).
 */
export function icdHitsToGaugeApps(hits: IcdHit[], element: ElementId): Application[] {
	return hits
		.map((h) => ({ applies: h.applies, time: Math.round(h.time * 10) / 10 }))
		.filter((h) => h.applies && h.time <= MAX_GAUGE_TIME)
		.slice(0, MAX_GAUGE_APPS)
		.map((h) => ({ time: h.time, element, gauge: 1 }));
}
