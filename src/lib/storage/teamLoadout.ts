/**
 * ⚓ LOADOUTS BELONG TO TEAMS (Nate 2026-10-24). A weapon and an artifact set
 * are a TEAM decision more than a character's: Cryo Traveler wears Tenacity in
 * a Stellar Swirl team and not in a Stellar Conduct one, and Sucrose wears
 * Viridescent Venerer or Instructor by what she is there to do. So:
 *
 *   · a team carries a loadout per member (`TeamRecord.loadout`);
 *   · a rotation whose four are a team INHERITS it, live: change the team and
 *     every rotation of it follows, except where a rotation chose otherwise;
 *   · a rotation's own choice (the bench pill) overrides it, per part — the
 *     artifact set, and the weapon with its refinement as one;
 *   · the roster's per-character default RETIRES, its values moving into the
 *     teams and into the rotations that have no team (`retireRosterLoadout`).
 *
 * Pure, so the session and its tests share one reading. Theorycraft has no
 * teams, so there a rotation's loadout is all its own.
 */
import type { LoadoutEntry } from '$lib/stores';
import type { RotationBody, TeamRecord } from './records';
import { teamKey } from '$lib/utils/notationEdit';

export type Loadouts = Record<string, LoadoutEntry>;

/**
 * ⚓ An EXPLICIT "none" (Nate 2026-10-24: clicking None and getting no
 * response felt wrong). Only a rotation's own choice under a team needs it:
 * "nothing" is otherwise just an absent part, which reads as "follow the
 * team". It is turned back into nothing by `resolveEntry`, the one place an
 * entry is resolved, so no reader past it (the parser, the pill icons, a
 * share link, a PNG) ever sees it.
 */
export const NONE = 'none';

/** An entry that sets nothing. */
export const isEmptyEntry = (e: LoadoutEntry | undefined): boolean =>
	!e || (!e.artifactSetId && !e.weaponId && !e.weaponRefinement);

/** Only the parts an entry sets: `undefined` fields dropped, so a stored entry
 *  never carries a key that reads as "set to nothing" and hides the team's. */
export function compactEntry(e: LoadoutEntry): LoadoutEntry {
	const out: LoadoutEntry = {};
	if (e.artifactSetId) out.artifactSetId = e.artifactSetId;
	if (e.weaponId) out.weaponId = e.weaponId;
	if (e.weaponRefinement) out.weaponRefinement = e.weaponRefinement;
	return out;
}

/**
 * A rotation's own entry with every part that only repeats what it inherits
 * taken out, so choosing the team's value means FOLLOWING the team again.
 * ⚓ The weapon and its refinement are one part: an R5 of the team's weapon
 * is a different choice, and must not pick up the team's next weapon.
 */
export function pruneInherited(
	own: LoadoutEntry,
	inherited: LoadoutEntry | undefined
): LoadoutEntry {
	const out = compactEntry(own);
	// "None" over a team that sets nothing says nothing.
	if (out.artifactSetId === NONE && !inherited?.artifactSetId) delete out.artifactSetId;
	if (out.weaponId === NONE && !inherited?.weaponId) {
		delete out.weaponId;
		delete out.weaponRefinement;
	}
	if (!inherited) return out;
	if (out.artifactSetId && out.artifactSetId === inherited.artifactSetId) delete out.artifactSetId;
	if (
		(out.weaponId || out.weaponRefinement) &&
		(out.weaponId ?? inherited.weaponId) === inherited.weaponId &&
		(out.weaponRefinement ?? inherited.weaponRefinement) === inherited.weaponRefinement
	) {
		delete out.weaponId;
		delete out.weaponRefinement;
	}
	return out;
}

/** What a character's loadout resolves to: the team's, then the rotation's
 *  own, with an explicit "none" made nothing. ⚓ THE ONE RESOLVER. */
export function resolveEntry(
	inherited: LoadoutEntry | undefined,
	own: LoadoutEntry | undefined
): LoadoutEntry {
	const out: LoadoutEntry = { ...(inherited ?? {}), ...(own ?? {}) };
	if (out.artifactSetId === NONE) delete out.artifactSetId;
	if (out.weaponId === NONE) {
		delete out.weaponId;
		delete out.weaponRefinement;
	}
	return out;
}

/**
 * A pill choice under a team, as the rotation's own entry: a part cleared to
 * nothing where the team supplies one becomes an explicit "none" (else it
 * would read as following the team), and only what DIFFERS is kept.
 */
export function ownChoice(
	current: LoadoutEntry | undefined,
	update: Partial<LoadoutEntry>,
	inherited: LoadoutEntry | undefined
): LoadoutEntry {
	const u = { ...update };
	if ('artifactSetId' in u && !u.artifactSetId && inherited?.artifactSetId) u.artifactSetId = NONE;
	if ('weaponId' in u && !u.weaponId && inherited?.weaponId) {
		u.weaponId = NONE;
		u.weaponRefinement = undefined;
	}
	return pruneInherited({ ...(current ?? {}), ...u }, inherited);
}

/** A loadout map with every empty entry left out. */
export function compactLoadouts(m: Loadouts): Loadouts {
	const out: Loadouts = {};
	for (const [id, e] of Object.entries(m)) {
		const c = compactEntry(e);
		if (!isEmptyEntry(c)) out[id] = c;
	}
	return out;
}

/** The team in `teams` whose set these slots are, if any. */
export function teamOfSlots<T extends TeamRecord>(
	teams: readonly T[],
	slots: readonly (string | null)[]
): T | undefined {
	const key = teamKey(slots);
	return key ? teams.find((t) => !t.deleted && teamKey(t.slots) === key) : undefined;
}

/** Only the members' entries: a team whose set changed drops the loadout of
 *  whoever left, and the newcomer starts with none. */
export function membersOnly(m: Loadouts | undefined, slots: readonly (string | null)[]): Loadouts {
	const out: Loadouts = {};
	for (const id of slots) if (id && m?.[id]) out[id] = m[id];
	return out;
}

/**
 * A rotation's body with what it inherits from `team` made its own, for a
 * copy LEAVING the profile (a what-if's Theorycraft copy): there it has no
 * team, and without this it would lose its weapons and sets.
 */
export function bakeLoadout(body: RotationBody, team: TeamRecord | undefined): RotationBody {
	if (!team?.loadout) return body;
	const own = body.loadout ?? {};
	const merged: Loadouts = { ...own };
	for (const id of body.slots) {
		if (!id) continue;
		const e = compactEntry(resolveEntry(team.loadout[id], own[id]));
		if (!isEmptyEntry(e)) merged[id] = e;
	}
	return Object.keys(merged).length ? { ...body, loadout: merged } : body;
}

/**
 * ⚓ THE ROSTER DEFAULT RETIRES INTO TEAMS (Nate 2026-10-24), and no rotation's
 * result moves on the way:
 *   · each team takes a member's default wherever it sets nothing of its own;
 *   · each rotation with NO team takes it the same way, for its seated
 *     characters, since nothing else would supply it any more;
 *   · a rotation that IS a team's needs nothing: it inherits the same values.
 * Returns only the records that changed.
 */
export function retireRosterLoadout(
	roster: Loadouts,
	teams: readonly TeamRecord[],
	rotations: readonly { slots: readonly (string | null)[]; loadout?: Loadouts }[]
): { teams: Map<number, Loadouts>; rotations: Map<number, Loadouts> } {
	const fill = (own: Loadouts | undefined, slots: readonly (string | null)[]) => {
		const out: Loadouts = { ...(own ?? {}) };
		let changed = false;
		for (const id of slots) {
			if (!id || isEmptyEntry(roster[id])) continue;
			const next = compactEntry(resolveEntry(roster[id], out[id]));
			if (JSON.stringify(next) !== JSON.stringify(out[id] ?? {})) {
				out[id] = next;
				changed = true;
			}
		}
		return changed ? out : null;
	};
	const teamOut = new Map<number, Loadouts>();
	teams.forEach((t, i) => {
		if (t.deleted) return;
		const next = fill(t.loadout, t.slots);
		if (next) teamOut.set(i, next);
	});
	const rotOut = new Map<number, Loadouts>();
	rotations.forEach((r, i) => {
		if (teamOfSlots(teams, r.slots)) return;
		const next = fill(r.loadout, r.slots);
		if (next) rotOut.set(i, next);
	});
	return { teams: teamOut, rotations: rotOut };
}
