/**
 * src/lib/sim/parserDiffer.ts
 *
 * The L3 corpus differ's comparator (`docs/gauge-round-L3.md` §5). Test-only —
 * imported by `parserDiffer.test.ts` and by nothing that ships.
 *
 * ⚓ THE GATE IS THREE SURFACES, and they answer three different questions:
 *
 *   STRICT       is the IR byte-identical, INCLUDING event ids and array order?
 *                The default gate. Every extraction commit must pass it.
 *   CANONICAL    id-stripped and re-sorted. A DIAGNOSTIC, not a weaker gate —
 *                when STRICT fails this is what says "the content is identical,
 *                only the order moved", which is the difference between a
 *                five-minute fix and an afternoon.
 *   PROJECTIONS  the seven row modules run over both IRs. ⚓ This is the surface
 *                that answers "did anything MOVE ON SCREEN", which is what
 *                gauge-round.md C2 actually cares about — a clock-driven sim
 *                emits buff windows in a different order and the IR can look
 *                identical by shape while rows jump.
 *
 * ⚠️ The comparator short-circuits on reference equality, and that is what makes
 * it fast rather than merely correct: both engines resolve their effects and
 * conditions from the SAME imported character JSON, so the deep payloads under
 * `effects` are literally the same objects and never get walked.
 */

import type { ParsedRotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import type { LoadoutEntry } from '$lib/stores';
import type { SlottedTrack } from '$lib/timeline/types';
import { projectTeamBuffRows } from '$lib/timeline/teamBuffRows';
import { projectCharReceivedBuffRows } from '$lib/timeline/charReceivedBuffRows';
import { computeSummonSubrows } from '$lib/timeline/summonSubrows';
import { computeShieldSubrows } from '$lib/timeline/shieldRows';
import { computeNBBars } from '$lib/timeline/nbRows';
import { computeMoonsignRows } from '$lib/timeline/moonsignRows';
import { computeWeaponProcRows } from '$lib/timeline/weaponProcRows';

// ---------------------------------------------------------------------------
// Deep comparison — first divergence wins, with the path to it
// ---------------------------------------------------------------------------

const typeName = (v: unknown): string =>
	v === null ? 'null' : Array.isArray(v) ? 'array' : v instanceof Map ? 'Map' : typeof v;

/** A short, readable rendering of a leaf — enough to see WHAT differs without
 *  dumping a rotation into the terminal. */
const show = (v: unknown): string => {
	if (v === undefined) return 'undefined';
	if (v === null) return 'null';
	if (typeof v === 'number' || typeof v === 'boolean') return String(v);
	if (typeof v === 'string') return JSON.stringify(v);
	if (Array.isArray(v)) return `array(${v.length})`;
	if (v instanceof Map) return `Map(${v.size})`;
	if (typeof v === 'object') {
		const o = v as Record<string, unknown>;
		const tag = o.kind ?? o.type ?? o.name ?? o.label;
		return tag === undefined ? 'object' : `{${String(tag)}}`;
	}
	return String(v);
};

/**
 * Returns the path of the FIRST divergence, or null when equal.
 *
 * ⚠️ First-divergence rather than a full diff on purpose. An IR mismatch in a
 * strangler is almost never a scattered set of unrelated changes — it is one
 * mistake showing up in a thousand places — and a thousand-line failure buries
 * the one line that says where.
 */
export function firstDiff(a: unknown, b: unknown, path = ''): string | null {
	// ⚓ The short-circuit that makes this cheap: shared effect/condition
	// subtrees are the same object in both IRs and are never walked.
	if (a === b) return null;
	const ta = typeName(a);
	const tb = typeName(b);
	if (ta !== tb) return `${path}: ${ta} vs ${tb} (${show(a)} vs ${show(b)})`;

	switch (ta) {
		case 'number':
		case 'string':
		case 'boolean':
		case 'undefined':
		case 'null':
			return `${path}: ${show(a)} vs ${show(b)}`;
		case 'array': {
			const A = a as unknown[];
			const B = b as unknown[];
			const n = Math.min(A.length, B.length);
			for (let i = 0; i < n; i++) {
				const d = firstDiff(A[i], B[i], `${path}[${i}]`);
				if (d) return d;
			}
			if (A.length !== B.length) return `${path}: length ${A.length} vs ${B.length}`;
			return null;
		}
		case 'Map': {
			const A = a as Map<unknown, unknown>;
			const B = b as Map<unknown, unknown>;
			for (const [k, v] of A) {
				if (!B.has(k)) return `${path}.get(${show(k)}): present vs absent`;
				const d = firstDiff(v, B.get(k), `${path}.get(${show(k)})`);
				if (d) return d;
			}
			for (const k of B.keys()) {
				if (!A.has(k)) return `${path}.get(${show(k)}): absent vs present`;
			}
			return null;
		}
		case 'object': {
			const A = a as Record<string, unknown>;
			const B = b as Record<string, unknown>;
			// Union of keys, in A's order then B's extras — so a field one side
			// simply forgot to set reads as `undefined vs 3` rather than silently
			// passing (⚠️ an absent optional and an explicit undefined are the
			// same thing to a consumer and are treated as equal here).
			const keys = [...Object.keys(A), ...Object.keys(B).filter((k) => !(k in A))];
			for (const k of keys) {
				const d = firstDiff(A[k], B[k], path ? `${path}.${k}` : k);
				if (d) return d;
			}
			return null;
		}
		default:
			return `${path}: unhandled ${ta}`;
	}
}

// ---------------------------------------------------------------------------
// Surface 1 — STRICT
// ---------------------------------------------------------------------------

/** Everything `ParsedRotation` carries, compared as-is: ids, emission order,
 *  array order, `Map` contents. */
export function strictDiff(a: ParsedRotation, b: ParsedRotation): string | null {
	return (
		firstDiff(a.totalDuration, b.totalDuration, 'totalDuration') ??
		firstDiff(a.unknownTokens, b.unknownTokens, 'unknownTokens') ??
		firstDiff(a.tracks, b.tracks, 'tracks') ??
		firstDiff(a.events, b.events, 'events') ??
		firstDiff(a.windows, b.windows, 'windows')
	);
}

// ---------------------------------------------------------------------------
// Surface 2 — CANONICAL (a diagnostic)
// ---------------------------------------------------------------------------

/** A total order over events that does not use `id` — so two streams carrying
 *  the same events with different id assignments canonicalise the same. */
const eventKey = (e: Record<string, unknown>): string =>
	[e.time, e.kind, e.characterId, e.label ?? '', e.ability ?? '', e.reaction ?? '', e.action ?? '']
		.map(String)
		.join('|');

const windowKey = (w: Record<string, unknown>): string =>
	[w.start, w.end, w.kind, w.characterId, w.name ?? '', w.label ?? '', w.source ?? '']
		.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v)))
		.join('|');

const stripIds = <T extends object>(o: T): Omit<T, 'id'> => {
	const { id: _id, ...rest } = o as T & { id?: unknown };
	void _id;
	return rest;
};

/**
 * Id-stripped, re-sorted comparison. ⛔ Never the gate on its own: it cannot
 * see an ordering change, which is exactly the class C2 warns about. Its job is
 * to tell you, the moment STRICT goes red, whether you broke a VALUE or moved
 * something.
 */
export function canonicalDiff(a: ParsedRotation, b: ParsedRotation): string | null {
	const canonEvents = (r: ParsedRotation) =>
		r.events
			.map((e) => stripIds(e as unknown as Record<string, unknown>))
			.slice()
			.sort((x, y) => (eventKey(x) < eventKey(y) ? -1 : eventKey(x) > eventKey(y) ? 1 : 0));
	const canonWindows = (r: ParsedRotation) =>
		r.windows
			.map((w) => stripIds(w as unknown as Record<string, unknown>))
			.slice()
			.sort((x, y) => (windowKey(x) < windowKey(y) ? -1 : windowKey(x) > windowKey(y) ? 1 : 0));
	return (
		firstDiff(a.totalDuration, b.totalDuration, '~totalDuration') ??
		firstDiff(a.tracks, b.tracks, '~tracks') ??
		firstDiff(canonEvents(a), canonEvents(b), '~events') ??
		firstDiff(canonWindows(a), canonWindows(b), '~windows')
	);
}

// ---------------------------------------------------------------------------
// Surface 3 — PROJECTIONS (what the user sees)
// ---------------------------------------------------------------------------

/** Mirrors `mapTracksToSlots` in RotationTimeline.svelte — a track with no slot
 *  is DROPPED (a fifth character; the composer squiggles it), and a character
 *  appearing twice cycles its matching slots. */
function mapTracksToSlots(r: ParsedRotation, slots: string[]): SlottedTrack[] {
	const slotUsage: Record<string, number> = {};
	const out: SlottedTrack[] = [];
	for (const track of r.tracks) {
		const matching = slots
			.map((id, idx) => (id === track.characterId ? idx : -1))
			.filter((idx) => idx >= 0);
		if (matching.length === 0) continue;
		const usage = slotUsage[track.characterId] ?? 0;
		out.push({ ...track, slotIdx: matching[usage % matching.length] });
		slotUsage[track.characterId] = usage + 1;
	}
	return out;
}

/** The notation-derived team: first four distinct characters in track order
 *  (`notation as single source of truth`, 2026-08-13). */
export function slotsOf(r: ParsedRotation): string[] {
	const seen: string[] = [];
	for (const t of r.tracks) {
		if (!seen.includes(t.characterId)) seen.push(t.characterId);
		if (seen.length === 4) break;
	}
	return seen;
}

export type ProjectionInput = {
	getCharacter: (id: string) => CharacterData | null;
	constellationLevels: Record<string, number>;
	loadoutMap: Record<string, LoadoutEntry>;
};

/** Every row surface the timeline draws off the IR, in one bundle. */
export function projectAll(r: ParsedRotation, input: ProjectionInput) {
	const slots = slotsOf(r);
	const annotated = mapTracksToSlots(r, slots);
	const moonsignSlots = slots
		.map((id, idx) => ({ id, idx }))
		.filter(({ id }) => !(input.getCharacter(id)?.factions ?? []).includes('moonsign'))
		.map(({ idx }) => idx);
	return {
		teamBuff: projectTeamBuffRows(r.windows, input.getCharacter),
		received: projectCharReceivedBuffRows(r.windows, input.getCharacter),
		summon: computeSummonSubrows(
			annotated,
			r.windows,
			input.constellationLevels,
			input.getCharacter
		),
		shield: computeShieldSubrows(r.windows, (id) => {
			const i = slots.indexOf(id);
			return i === -1 ? undefined : i;
		}),
		nb: computeNBBars(r.events),
		moonsign: computeMoonsignRows(r.events, moonsignSlots, slots),
		weaponProc: computeWeaponProcRows(r.windows, input.loadoutMap)
	};
}

export function projectionDiff(
	a: ParsedRotation,
	b: ParsedRotation,
	input: ProjectionInput
): string | null {
	return firstDiff(projectAll(a, input), projectAll(b, input), 'rows');
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

export type DifferVerdict = {
	strict: string | null;
	canonical: string | null;
	projections: string | null;
};

export function compare(
	a: ParsedRotation,
	b: ParsedRotation,
	input: ProjectionInput
): DifferVerdict {
	const strict = strictDiff(a, b);
	return {
		strict,
		// Only worth computing when STRICT is red — it exists to explain a
		// failure, not to be a second assertion on a green run.
		canonical: strict === null ? null : canonicalDiff(a, b),
		projections: projectionDiff(a, b, input)
	};
}

/** One legible line per failing surface — the differ's whole user interface. */
export function describe(v: DifferVerdict, label: string): string {
	const lines: string[] = [];
	if (v.strict) {
		lines.push(`${label} — STRICT: ${v.strict}`);
		lines.push(
			v.canonical
				? `${label} — CANONICAL also differs, so a VALUE changed: ${v.canonical}`
				: `${label} — CANONICAL is clean, so only ORDER/ids moved (see C2)`
		);
	}
	if (v.projections) lines.push(`${label} — PROJECTIONS (rows move on screen): ${v.projections}`);
	return lines.join('\n');
}
