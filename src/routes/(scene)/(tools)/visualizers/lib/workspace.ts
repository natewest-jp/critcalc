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
	{ id: 'crit', name: 'Crit Heatmap' },
	{ id: 'gauge', name: 'Gauge Explorer' },
	{ id: 'icd', name: 'ICD Timeline' },
	{ id: 'curves', name: 'Reaction Curves' },
	{ id: 'breakdown', name: 'Damage Breakdown' },
	{ id: 'defres', name: 'Enemy DEF & RES' },
	{ id: 'artifact', name: 'Artifact Odds' },
	{ id: 'wish', name: 'Wish Odds' }
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

/** Repair a stored preference: anything that isn't a whole 1..MAX_SLOTS is 'auto'. */
export function normalizeSlots(stored: unknown): SlotPref {
	if (typeof stored !== 'number' || !Number.isInteger(stored)) return 'auto';
	if (stored < 1 || stored > MAX_SLOTS) return 'auto';
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

/**
 * Read the persisted workspace (already normalized), or null when absent.
 * No version bump for `slots`: a v1 payload written before the slot control
 * existed simply has no `slots` key and normalizes to 'auto' — which IS the
 * pre-control behavior, so old layouts restore unchanged.
 */
export function loadWorkspace(): StoredWorkspace | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== 'object' || parsed === null) return null;
		const data = parsed as { v?: unknown; assignment?: unknown; slots?: unknown };
		if (data.v !== 1) return null;
		return {
			assignment: normalizeAssignment(data.assignment),
			slots: normalizeSlots(data.slots)
		};
	} catch {
		return null;
	}
}

export function saveWorkspace(assignment: InstrumentId[], slots: SlotPref): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, assignment, slots }));
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

/** The gauge time slider's ceiling — handoff times clamp into it. */
export const MAX_GAUGE_TIME = 15;

/**
 * Convert an ICD attack string into Gauge Explorer application rows: only the
 * hits that actually APPLY their element, capped at the gauge row limit.
 * Gauge size is not something ICD models, so every application is an honest
 * 1U default (the send button says so).
 */
export function icdHitsToGaugeApps(hits: IcdHit[], element: ElementId): Application[] {
	return hits
		.filter((h) => h.applies)
		.slice(0, MAX_GAUGE_APPS)
		.map((h) => ({
			time: Math.min(Math.round(h.time * 10) / 10, MAX_GAUGE_TIME),
			element,
			gauge: 1
		}));
}
