/**
 * Documents ↔ the tools' working shapes. Pure.
 *
 * Until the new bars land (phase 2b), the Planner and the Builder still run on
 * their tab models (`RotationTab`, `Board`); under the switch each tab IS a
 * document, keyed by the document's id. These are the two directions.
 */

import type { Board } from '$lib/boards.svelte';
import type { RotationTab } from '$lib/rotationTabs.svelte';
import { getCharacterIndexEntry } from '$lib/data/characterLookup';
import { isMintedLabel } from './migrate';
import type { SavedNotation } from '$lib/stores';
import type { LineupBody, LineupDocument, RotationBody, RotationDocument } from './records';

/**
 * ⚓ An unnamed document shows a label derived from its contents (§4.2): the
 * characters' names, which stays right as the team changes. ⏭ A matching
 * saved team's name comes first once Teams exist (phase 3).
 */
export function rotationLabel(slots: readonly (string | null)[]): string {
	const names = slots
		.filter((id): id is string => !!id)
		.map((id) => getCharacterIndexEntry(id)?.displayName ?? id);
	return names.length ? names.join(' · ') : 'New rotation';
}

/** A lineup's derived label: its mode and season (§4.2). */
export function lineupLabel(body: Pick<LineupBody, 'preset' | 'season'>): string {
	if (body.preset === 'stygian') return body.season ? `Stygian ${body.season}` : 'Stygian';
	if (body.preset === 'abyss') return 'Abyss';
	return 'Custom lineup';
}

export function rotationToTab(doc: RotationDocument): RotationTab {
	const tab: RotationTab = {
		id: doc.id,
		label: doc.name ?? rotationLabel(doc.body.slots),
		notation: doc.body.notation,
		slots: [...doc.body.slots],
		placed: [...doc.body.placed],
		tabLoadout: doc.body.loadout ?? {},
		tabCon: doc.body.con ?? {}
	};
	if (doc.body.sample) tab.sample = doc.body.sample;
	if (doc.openedAt) tab.viewedAt = doc.openedAt;
	return tab;
}

export function tabToRotationBody(tab: RotationTab): RotationBody {
	const body: RotationBody = {
		notation: tab.notation,
		slots: [...(tab.slots ?? [null, null, null, null])],
		placed: [...(tab.placed ?? [false, false, false, false])]
	};
	if (tab.tabLoadout && Object.keys(tab.tabLoadout).length) body.loadout = tab.tabLoadout;
	if (tab.tabCon && Object.keys(tab.tabCon).length) body.con = tab.tabCon;
	if (tab.sample) body.sample = tab.sample;
	return body;
}

export function lineupToBoard(doc: LineupDocument): Board {
	const board: Board = {
		id: doc.id,
		label: doc.name ?? lineupLabel(doc.body),
		preset: doc.body.preset,
		noRepeats: doc.body.noRepeats,
		teams: doc.body.teams.map((t) => ({ ...t, slots: [...t.slots] }))
	};
	if (doc.body.season) board.season = doc.body.season;
	if (doc.openedAt) board.viewedAt = doc.openedAt;
	return board;
}

export function boardToLineupBody(board: Board): LineupBody {
	const body: LineupBody = {
		preset: board.preset,
		noRepeats: board.noRepeats,
		teams: board.teams.map((t) => {
			const team: LineupBody['teams'][number] = { id: t.id, slots: [...t.slots] };
			if (t.con && Object.keys(t.con).length) team.con = t.con;
			if (t.pinnedRotationId) team.pinnedRotationId = t.pinnedRotationId;
			return team;
		})
	};
	if (board.season) body.season = board.season;
	return body;
}

/**
 * The name to STORE for a tab: `null` while its label is still the one the
 * session derived for it (an unnamed document stays unnamed as its team
 * changes) or one the tools minted ("Tab 2"), the label once the player has
 * renamed it, or the name the document already has.
 */
export function nameToStore(
	label: string,
	derivedAtLoad: string | undefined,
	stored: string | null = null
): string | null {
	const trimmed = label.trim();
	// A name already stored stays, whatever it says: a saved entry's name was
	// typed or accepted at Save, so "Tab 2" there is the player's.
	if (trimmed && trimmed === stored) return trimmed;
	if (!trimmed || trimmed === derivedAtLoad || isMintedLabel(trimmed)) return null;
	return trimmed;
}

/** A rotation document in the old bank's shape, for the Builder's pins and
 *  lists, which still speak it (phase 3 closes 2a's gap: under the switch a
 *  team's pin names a DOCUMENT). */
export function rotationAsSaved(doc: RotationDocument): SavedNotation {
	return {
		id: doc.id,
		name: doc.name ?? rotationLabel(doc.body.slots),
		notation: doc.body.notation,
		slots: [...doc.body.slots],
		placed: [...doc.body.placed],
		tabLoadout: doc.body.loadout ?? {},
		tabCon: doc.body.con ?? {},
		savedAt: doc.updatedAt
	};
}
