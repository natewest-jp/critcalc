/**
 * Moving a Theorycraft document into a real profile (design §4.3; build plan
 * §13, phase 3). Pure.
 *
 * ⚓ Arriving in a real profile, an OWNED character reads the roster: that is
 * what "Sync" used to do, now a consequence of where the document lives. So a
 * move drops the document's own level for every character the profile owns,
 * and ⚓ the confirmation lists each one whose level CHANGES before you commit
 * — if the document exists because of those levels, the list is what tells you
 * to leave it in Theorycraft. Unowned characters keep their level (§2.4), and
 * loadouts are the document's own choice and never move (§4.6).
 */

import type { DocumentRecord, LineupBody, Roster, RotationBody } from './records';

export type LevelChange = { id: string; from: number; to: number };

const owned = (roster: Roster, id: string) => roster.ownership[id] === 'owned';

/** The characters a level can be stored for: the seated ones and any the
 *  document holds a level for (a typed fifth name, a teammate swapped out). */
function idsOf(slots: readonly (string | null)[], con: Record<string, number> = {}): string[] {
	const ids = new Set<string>(Object.keys(con));
	for (const id of slots) if (id) ids.add(id);
	return [...ids];
}

function changesIn(
	slots: readonly (string | null)[],
	con: Record<string, number> | undefined,
	roster: Roster
): LevelChange[] {
	const out: LevelChange[] = [];
	for (const id of idsOf(slots, con)) {
		if (!owned(roster, id)) continue;
		const from = con?.[id] ?? 0;
		const to = roster.constellations[id] ?? 0;
		if (from !== to) out.push({ id, from, to });
	}
	return out;
}

/** Each owned character whose level would change, once (a lineup lists a
 *  character on two teams once, at its first team's level). */
export function levelChanges(doc: DocumentRecord, roster: Roster): LevelChange[] {
	if (doc.type === 'rotation') return changesIn(doc.body.slots, doc.body.con, roster);
	const seen = new Set<string>();
	const out: LevelChange[] = [];
	for (const team of doc.body.teams) {
		for (const c of changesIn(team.slots, team.con, roster)) {
			if (seen.has(c.id)) continue;
			seen.add(c.id);
			out.push(c);
		}
	}
	return out;
}

function withoutOwned(
	con: Record<string, number> | undefined,
	roster: Roster
): Record<string, number> | undefined {
	if (!con) return undefined;
	const kept = Object.fromEntries(Object.entries(con).filter(([id]) => !owned(roster, id)));
	return Object.keys(kept).length ? kept : undefined;
}

/** The document's body as it arrives: owned characters' levels dropped, so
 *  they read the roster. */
export function movedBody(doc: DocumentRecord, roster: Roster): DocumentRecord['body'] {
	if (doc.type === 'rotation') {
		const body: RotationBody = { ...doc.body };
		const con = withoutOwned(body.con, roster);
		if (con) body.con = con;
		else delete body.con;
		return body;
	}
	const body: LineupBody = {
		...doc.body,
		teams: doc.body.teams.map((t) => {
			const team = { ...t };
			const con = withoutOwned(t.con, roster);
			if (con) team.con = con;
			else delete team.con;
			return team;
		})
	};
	return body;
}
