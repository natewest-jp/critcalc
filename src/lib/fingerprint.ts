/**
 * src/lib/fingerprint.ts
 *
 * THE FINGERPRINT (lineups design §4) — one fixed row of fifteen capability
 * slots, the SAME order for every character and every team, so differences are
 * seen as shapes before anything is read. Internal name; in Help it is "the
 * team's capabilities" (Nate 2026-10-09).
 *
 * ⚓ ONE ORDER, the design doc's table (§4.2; Nate 2026-10-09 — the code's
 * FUNCTION_FACETS order and the table's differed, §9.1 said choose once):
 * Survival · Support · Damage, which also adds the Damage cluster
 * (`offFieldDamage`) FUNCTION_FACETS leaves out.
 *
 * ⚓ FOUR STATES, PRESENCE ONLY (§4.1; ⛔ never fill-as-uptime):
 *   lit       — provides it in this team;
 *   outlined  — provides it, but a condition fails in this team ("can't
 *               happen here", ⛔ never "unlikely" — §9.2);
 *   locked    — provides it only above the member's constellation;
 *   unknown   — the kit is uncurated, so absence proves nothing;
 *   absent    — nobody provides it (the slot keeps its POSITION).
 * A team's slot takes its strongest member state in that order, and counts
 * the members for whom it is LIT (the provider dots: redundancy shown, never
 * judged).
 */

import {
	capMatchesFacet,
	summaryInTeam,
	type FacetKey,
	type TeamMember
} from '$lib/capabilities/deriveCapabilities';
import { isCapabilityUnknown } from '$lib/capabilities/facets';
import { getCharacterIndexEntry } from '$lib/data/characterLookup';

export type FingerprintCluster = 'survival' | 'support' | 'damage';

export const FINGERPRINT: { cluster: FingerprintCluster; facets: FacetKey[] }[] = [
	{ cluster: 'survival', facets: ['heal', 'shield', 'cleanse', 'taunt'] },
	{
		cluster: 'support',
		facets: [
			'buff:atk',
			'buff:em',
			'buff:crit',
			'buff:dmg',
			'buff:hpdef',
			'energy',
			'resShred',
			'grouping',
			'infuse',
			'interruptionRes'
		]
	},
	{ cluster: 'damage', facets: ['offFieldDamage'] }
];

export type SlotState = 'lit' | 'outlined' | 'locked' | 'unknown' | 'absent';

/** Strongest first — a team's slot takes its strongest member's state. */
const RANK: SlotState[] = ['lit', 'outlined', 'locked', 'unknown', 'absent'];

export type FingerprintSlot = {
	facet: FacetKey;
	state: SlotState;
	/** Members for whom it is LIT — the provider dots. */
	providers: string[];
	/** Every member's own state, for the slot's sentence. */
	members: { id: string; state: SlotState }[];
};

/** One member's state for one facet, in `team`, at constellation `con`. */
export function memberState(
	id: string,
	facet: FacetKey,
	team: readonly TeamMember[],
	con: number
): SlotState {
	const entry = getCharacterIndexEntry(id);
	if (!entry) return 'absent';
	if (isCapabilityUnknown(entry)) return 'unknown';
	const states = entry.caps
		.filter((c) => capMatchesFacet(c, facet))
		.map((c) => summaryInTeam(c, team, id, con));
	if (states.includes('yes')) return 'lit';
	if (states.includes('inactive')) return 'outlined';
	if (states.includes('locked')) return 'locked';
	return 'absent';
}

/**
 * The fingerprint of a team: `ids` are its members, `conOf` each member's
 * constellation for this team (the board's own value, else the roster's).
 */
export function teamFingerprint(
	ids: readonly string[],
	conOf: (id: string) => number
): { cluster: FingerprintCluster; slots: FingerprintSlot[] }[] {
	const team: TeamMember[] = ids.map((id) => getCharacterIndexEntry(id)).filter((e) => e !== null);
	return FINGERPRINT.map(({ cluster, facets }) => ({
		cluster,
		slots: facets.map((facet) => {
			const members = ids.map((id) => ({ id, state: memberState(id, facet, team, conOf(id)) }));
			const state = RANK.find((r) => members.some((m) => m.state === r)) ?? ('absent' as SlotState);
			return {
				facet,
				state: members.length ? state : 'absent',
				providers: members.filter((m) => m.state === 'lit').map((m) => m.id),
				members
			};
		})
	}));
}
