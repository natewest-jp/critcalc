/**
 * team-builder/lib/auditionRotation.ts
 *
 * "In your rotation" — the audition's planner-backed read (Team Builder round,
 * phase 4, 2026-10-07).
 *
 * Compare's chart is a CLAIM: every lane assumes the cast is made the instant
 * its cooldown lapses, energy unmodelled. The planner already simulates the
 * rotation the player actually wrote. So an audition can run THAT rotation
 * twice — as written, and with the incumbent's segments renamed to the
 * candidate — and report what the team's coverage did in each. It is the one
 * comparison only this site can make.
 *
 * ⚠ THE PARSER IS LOADED ON DEMAND (`import()`), never statically: the Team
 * Builder's first paint has no use for it, and an audition is the only reason
 * it ever arrives here. (Precedent: RotationTimeline's lazy notation editor.)
 *
 * ⚓ It reads at the PLANNER's constellations (⚓ Nate 2026-10-07): the tab's
 * own override, then the roster's — the candidate has no tab override and so
 * reads at the roster's. It is the player's rotation, so it reads the way the
 * planner would; the strip says so.
 */

import type { ParsedRotation } from '$lib/sim/types';
import type { TimelineWindow } from '$lib/utils/rotationEvents';
import type { CharacterData } from '$lib/types/character';
import type { LoadoutEntry } from '$lib/stores';
import type { HumanTiming } from '$lib/sim/humanTiming';
import type { DerivedCapability } from '$lib/capabilities/deriveCapabilities';
import { flagNotation } from '$lib/utils/notationFlags';
import {
	notationHasActions,
	notationSegments,
	renameCharacterInNotation
} from '$lib/utils/notationEdit';
import { getIndexEntryByDisplayName } from '$lib/data/characterLookup';
import { getLoadedCharacter, loadCharacter } from '$lib/data/characterData';
import { capRowKeyOf, capRowLabelOf } from './compare';

// ---------------------------------------------------------------------------
// Pure: what a character contributes, and how much of the rotation it covers
// ---------------------------------------------------------------------------

type Span = { start: number; end: number };

/** Fraction of `[0, total]` covered by the UNION of the spans — two windows
 *  of one buff overlapping count once. 0 when there is no rotation. */
export function unionUptime(spans: readonly Span[], total: number): number {
	if (!(total > 0)) return 0;
	const sorted = spans
		.map((s) => ({ start: Math.max(0, s.start), end: Math.min(total, s.end) }))
		.filter((s) => s.end > s.start)
		.sort((a, b) => a.start - b.start);
	let covered = 0;
	let runStart = -1;
	let runEnd = -1;
	for (const s of sorted) {
		if (s.start > runEnd) {
			if (runEnd > runStart) covered += runEnd - runStart;
			runStart = s.start;
			runEnd = s.end;
		} else if (s.end > runEnd) {
			runEnd = s.end;
		}
	}
	if (runEnd > runStart) covered += runEnd - runStart;
	return covered / total;
}

const buffKey = (stat: string) => capRowKeyOf({ kind: 'buff', detail: stat } as DerivedCapability);

/**
 * The contribution keys one window carries for the TEAM, in Compare's row
 * vocabulary — so a line here and a block in Compare name the same thing.
 * A buff a character gives only themselves is not a contribution and is left
 * out; a summon is keyed by its own name (it is a presence, not a stat).
 */
export function contributionKeysOf(w: TimelineWindow): { key: string; label: string }[] {
	if (w.kind === 'buff') {
		if (w.receiverId !== undefined && w.receiverId === w.characterId) return [];
		const out = new Map<string, string>();
		for (const e of w.effects) {
			if (e.type === 'resShred') out.set('resShred', capRowLabelOf('resShred'));
			else if (e.type === 'buff') {
				const key = buffKey(e.stat);
				out.set(key, capRowLabelOf(key));
			}
		}
		return [...out].map(([key, label]) => ({ key, label }));
	}
	if (w.kind === 'shield') return [{ key: 'shield', label: capRowLabelOf('shield') }];
	if (w.kind === 'summon') return [{ key: `summon:${w.label}`, label: w.label }];
	return [];
}

export type RotationRow = {
	key: string;
	label: string;
	/** Team-wide uptime of this contribution in the rotation as written. */
	before: number;
	/** …and with the candidate in the slot. */
	after: number;
};

/**
 * One line per contribution the INCUMBENT gives in the rotation as written or
 * the CANDIDATE gives in the swapped one: how much of the rotation the TEAM
 * has it for, before and after. Team-wide on purpose — a candidate's ATK buff
 * that another teammate already covers changes nothing, and that is exactly
 * what the player needs to see.
 */
export function rotationRows(
	before: ParsedRotation,
	after: ParsedRotation,
	incumbentId: string,
	candidateId: string
): RotationRow[] {
	const labels = new Map<string, string>();
	const relevant = new Set<string>();
	const collect = (r: ParsedRotation, giver: string) => {
		for (const w of r.windows) {
			if (!('characterId' in w) || w.characterId !== giver) continue;
			for (const { key, label } of contributionKeysOf(w)) {
				relevant.add(key);
				labels.set(key, label);
			}
		}
	};
	collect(before, incumbentId);
	collect(after, candidateId);

	const uptimeOf = (r: ParsedRotation, key: string) =>
		unionUptime(
			r.windows.filter((w) => contributionKeysOf(w).some((k) => k.key === key)),
			r.totalDuration
		);

	return [...relevant]
		.map((key) => ({
			key,
			label: labels.get(key) ?? key,
			before: uptimeOf(before, key),
			after: uptimeOf(after, key)
		}))
		.sort((a, b) => b.after - a.after || a.label.localeCompare(b.label));
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

export type RotationRead = {
	rows: RotationRow[];
	/** Actions in the candidate's segments the planner times as a stand-in
	 *  (a hold E on a kit with no hold, …) — the swap's honesty line. */
	approximated: number;
};

export type RotationInputs = {
	notation: string;
	/** The working team, slot order; 'blank' or null for an empty slot. */
	slots: readonly (string | null)[];
	incumbentId: string;
	candidateId: string;
	/** The planner's effective constellations (tab override, then roster). */
	constellations: Record<string, number>;
	loadout: Record<string, LoadoutEntry>;
	swapFrames: number;
	humanTiming: HumanTiming | null;
};

/** Null when there is no rotation to read (a team of bare names). */
export async function readRotationSwap(input: RotationInputs): Promise<RotationRead | null> {
	if (!notationHasActions(input.notation)) return null;
	const ids = [...input.slots.filter((s): s is string => !!s && s !== 'blank'), input.candidateId];
	await Promise.all(ids.map((id) => loadCharacter(id)));
	const { parseNotation } = await import('$lib/utils/notationParser');

	const lookup = (name: string): CharacterData | null => {
		const entry = getIndexEntryByDisplayName(name);
		return entry ? getLoadedCharacter(entry.id) : null;
	};
	const team = (swap: boolean) =>
		input.slots.map((s) =>
			!s || s === 'blank'
				? null
				: getLoadedCharacter(swap && s === input.incumbentId ? input.candidateId : s)
		);
	const parse = (text: string, swap: boolean) =>
		parseNotation(
			text,
			lookup,
			input.swapFrames,
			input.constellations,
			input.loadout,
			team(swap),
			input.humanTiming
		);

	const swapped = renameCharacterInNotation(input.notation, input.incumbentId, input.candidateId);
	const before = parse(input.notation, false);
	const after = parse(swapped, true);

	// The candidate's own segments, by source offset — a flag inside one of them
	// is an action the planner had to stand in for after the swap.
	const spans = notationSegments(swapped)
		.filter((s) => s.charId === input.candidateId)
		.map((s) => ({ from: s.nameFrom, to: s.contentEnd }));
	const approximated = flagNotation(swapped).filter(
		(f) => f.reason === 'approximate-cast' && spans.some((s) => f.from >= s.from && f.to <= s.to)
	).length;

	return { rows: rotationRows(before, after, input.incumbentId, input.candidateId), approximated };
}
