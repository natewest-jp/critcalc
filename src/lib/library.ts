/**
 * src/lib/library.ts
 *
 * THE LIBRARY's model (lineups design §10.1, §10.1a; build step 4) — pure, so
 * the overlay, both tools and a test read one answer.
 *
 * ⚓ THE NOTATION IS THE SAVE CONCEPT; THE LIBRARY PRESENTS IT AS TEAMS. Every
 * saved entry is a notation in `savedNotations`. One with no actions (four bare
 * names) is a TEAM ENTRY — the heading itself, never drawn as a rotation — and
 * its `name` is the team's nickname ('' = none). Every other entry is a
 * rotation, filed under the team its first four distinct names make, order
 * ignored. Grouping is a VIEW: nothing about who is on a team is stored
 * anywhere but the notation.
 *
 * A team entry is created when a rotation is saved (documentBar), so a team
 * outlives its last rotation. A rotation saved before that rule has no entry;
 * its heading still appears (from the rotation), and gains an entry the next
 * time anything is saved for it.
 */

import type { SavedBoard, SavedNotation } from './stores';
import { lastTouched } from './stores';
import { notationHasActions, seatsOfSaved, teamKey } from './utils/notationEdit';
import { getCharacterIndexEntry } from './data/characterLookup';
import { REACTION_INGREDIENTS, teamReactions } from './capabilities/deriveCapabilities';
import { REACTION_FAMILY, REACTION_LABEL } from './utils/auraDisplay';
import type { Reaction } from './types/ability';

export type LibraryTeam = {
	/** `teamKey` of the set — order ignored. */
	key: string;
	/** Up to four ids, in the NEWEST entry's order (portrait order). */
	slots: string[];
	/** The names-only entry, when one exists. */
	entry?: SavedNotation;
	/** The entry's name, if it has one. */
	nickname?: string;
	/** Newest first. */
	rotations: SavedNotation[];
	/** The newest of the team entry and its rotations (ms). */
	touched: number;
	/** Saved boards that hold this team. */
	boards: string[];
};

/** Is this entry a TEAM (names only) rather than a rotation? */
export function isTeamEntry(e: Pick<SavedNotation, 'notation'>): boolean {
	return !notationHasActions(e.notation);
}

/** An entry's team, in slot order: its stored seats (§8.1), else derived. */
const slotsOf = (e: Pick<SavedNotation, 'notation' | 'slots' | 'manualSlots'>) =>
	seatsOfSaved(e).filter((id): id is string => !!id);

/** Group the bank into teams, newest first. */
export function libraryTeams(
	saved: readonly SavedNotation[],
	boards: readonly SavedBoard[] = []
): LibraryTeam[] {
	// A plain record, not a Map: a pure fold, nothing here is state.
	const byKey: Record<string, LibraryTeam> = {};
	const ensure = (e: SavedNotation) => {
		const slots = slotsOf(e);
		const key = teamKey(slots);
		if (!key) return undefined;
		return (byKey[key] ??= { key, slots, rotations: [], touched: 0, boards: [] });
	};
	for (const e of [...saved].sort((a, b) => lastTouched(b) - lastTouched(a))) {
		const t = ensure(e);
		if (!t) continue;
		if (isTeamEntry(e)) {
			// Two names-only entries for one set: the newest is THE entry.
			if (!t.entry) {
				t.entry = e;
				if (e.name.trim()) t.nickname = e.name.trim();
			}
			if (t.rotations.length === 0 && t.touched === 0) t.slots = slotsOf(e);
		} else {
			// Portrait order = the newest ROTATION's (a team entry only orders a
			// team that has none).
			if (t.rotations.length === 0) t.slots = slotsOf(e);
			t.rotations.push(e);
		}
		t.touched = Math.max(t.touched, lastTouched(e));
	}
	for (const b of boards)
		for (const bt of b.teams) {
			const t = byKey[teamKey(bt.slots)];
			if (t && !t.boards.includes(b.name)) t.boards.push(b.name);
		}
	return Object.values(byKey).sort((a, b) => b.touched - a.touched);
}

/** The names-only notation for a set of ids ("A > B > C > D"). */
export function teamNotation(ids: readonly string[]): string {
	return ids
		.slice(0, 4)
		.map((id) => getCharacterIndexEntry(id)?.displayName ?? id)
		.join(' > ');
}

// ---------------------------------------------------------------------------
// Search — free text plus TAGS (§10.1a)
// ---------------------------------------------------------------------------

/**
 * A search tag: a character, an element, or a reaction. ⚓ A player may also
 * tag "Traveler" (`id: 'traveler'`), which matches every element's Traveler —
 * they are different characters for grouping (Nate 2026-10-09), but one name
 * to look for.
 */
export type LibraryTag = {
	kind: 'char' | 'element' | 'reaction';
	id: string;
	label: string;
};

export const ELEMENTS = ['pyro', 'hydro', 'anemo', 'electro', 'dendro', 'cryo', 'geo'];

/** What a player calls a reaction: the family, except a converted reaction
 *  keeps its own name (the composition chips' rule). */
export function reactionName(r: Reaction): string {
	return REACTION_INGREDIENTS[r].enabler ? REACTION_LABEL[r] : REACTION_FAMILY[r];
}

const membersOf = (slots: readonly string[]) =>
	slots.map((id) => getCharacterIndexEntry(id)).filter((m) => m !== null);

/** The reaction names a set of characters can make. */
export function reactionsOf(slots: readonly string[]): string[] {
	return [...new Set(teamReactions(membersOf(slots)).map(reactionName))];
}

/** Does a team (its ids) satisfy one tag? */
export function tagMatches(tag: LibraryTag, slots: readonly string[]): boolean {
	if (tag.kind === 'char')
		return tag.id === 'traveler'
			? slots.some((id) => id.startsWith('traveler_'))
			: slots.includes(tag.id);
	if (tag.kind === 'element') return membersOf(slots).some((m) => m.element === tag.id);
	return reactionsOf(slots).includes(tag.id);
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/**
 * Up to six suggestions for `query`: characters the library holds (plus
 * "Traveler" when it holds one), elements, and the reactions its teams make.
 * Prefix matches first, then a word inside the label.
 */
export function suggestTags(
	query: string,
	characters: readonly string[],
	reactions: readonly string[],
	taken: readonly LibraryTag[]
): LibraryTag[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	const name = (id: string) => getCharacterIndexEntry(id)?.displayName ?? id;
	const all: LibraryTag[] = [
		...characters.map((id) => ({ kind: 'char' as const, id, label: name(id) })),
		...(characters.some((id) => id.startsWith('traveler_'))
			? [{ kind: 'char' as const, id: 'traveler', label: 'Traveler' }]
			: []),
		...ELEMENTS.map((e) => ({ kind: 'element' as const, id: e, label: cap(e) })),
		...reactions.map((r) => ({ kind: 'reaction' as const, id: r, label: r }))
	];
	const isTaken = (t: LibraryTag) => taken.some((x) => x.kind === t.kind && x.id === t.id);
	const starts = all.filter((t) => t.label.toLowerCase().startsWith(q));
	const words = all.filter(
		(t) =>
			!starts.includes(t) &&
			t.label
				.toLowerCase()
				.split(/[\s-]/)
				.some((w) => w.startsWith(q))
	);
	return [...starts, ...words].filter((t) => !isTaken(t)).slice(0, 6);
}
