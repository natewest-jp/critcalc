/**
 * The Visualizers workspace layer: instrument registry, slot-assignment
 * persistence, and the parent↔instrument contracts (share state, handoff).
 *
 * Pure helpers live here so vitest covers them directly; the workspace page
 * (`+page.svelte`) owns all rendering and the restore→persist lifecycle.
 */

import type { Application, ElementId } from './gauge';
import type { IcdHit } from './icd';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const INSTRUMENTS = [
	{ id: 'crit', name: 'Crit Heatmap' },
	{ id: 'icd', name: 'ICD Timeline' },
	{ id: 'rolls', name: 'Artifact Rolls' },
	{ id: 'gauge', name: 'Gauge Explorer' },
	{ id: 'curves', name: 'Reaction Curves' },
	{ id: 'defres', name: 'Enemy DEF & RES' }
] as const;

export type InstrumentId = (typeof INSTRUMENTS)[number]['id'];

const INSTRUMENT_IDS = INSTRUMENTS.map((i) => i.id) as InstrumentId[];

/** First-load lineup (Nate-picked): position 0 is every first visitor's slot 1 */
export const DEFAULT_ASSIGNMENT: InstrumentId[] = [
	'crit',
	'gauge',
	'rolls',
	'icd',
	'curves',
	'defres'
];

// ---------------------------------------------------------------------------
// Slot-assignment persistence
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

/** Read the persisted assignment (already normalized), or null when absent. */
export function loadAssignment(): InstrumentId[] | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== 'object' || parsed === null) return null;
		const data = parsed as { v?: unknown; assignment?: unknown };
		if (data.v !== 1) return null;
		return normalizeAssignment(data.assignment);
	} catch {
		return null;
	}
}

export function saveAssignment(assignment: InstrumentId[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, assignment }));
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
};

// ---------------------------------------------------------------------------
// Cross-instrument handoff
// ---------------------------------------------------------------------------

/** Grows one union arm per future handoff (e.g. rolls→crit CV). */
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
