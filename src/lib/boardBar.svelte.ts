/**
 * src/lib/boardBar.svelte.ts
 *
 * The Team Builder's document flows, as `documentBar` is the Planner's: an
 * arriving lineup (`?b=`) or team (`?team=`), and Share. The document itself
 * is `boards`; the storage session saves it as it changes.
 */

import { notices } from './notices.svelte';
import type { Outcome } from './controlAnswer.svelte';
import { get } from 'svelte/store';
import { constellations } from './stores';
import { documentBar } from './documentBar.svelte';
import {
	boards,
	fromSharedBoard,
	makeBoard,
	toSharedBoard,
	type Board,
	type TeamSlot
} from './boards.svelte';
import { encodeBoard, type SharedBoard } from './utils/boardUrl';
import { documentsReady, OPENED_IN_THEORYCRAFT } from './storage/arrivals';
import { m } from '$lib/paraglide/messages';

/** A team that found no room on the open lineup (a full one, or a Theater
 *  cast, which has no teams) opens in a lineup of its own. */
export const TEAM_IN_NEW_LINEUP = m.library_team_added_to_a_new_custom_lineup;
/** Any of the board's teams holds anyone: a board worth sharing. */
export function boardHasMembers(board: Board): boolean {
	return board.teams.some((t) => t.slots.some((s) => s !== null));
}

class BoardBarState {
	/** An arriving shared board (`?b=`). ⚓ A new document in THEORYCRAFT
	 *  (§9.3). With no store at all the Builder is on its defaults, persisted
	 *  nowhere, and the board takes their place (`documentBar.receive`'s rule). */
	receive(shared: SharedBoard, isValidId: (id: string) => boolean) {
		const doc = { ...makeBoard(shared.label), ...fromSharedBoard(shared, isValidId) };
		void documentsReady.then(async (viaStore) => {
			if (!viaStore) {
				boards.restoreFrom(doc);
				notices.toast('info', m.library_loaded_shared_lineup());
				return;
			}
			const { storageSession } = await import('./storage/session.svelte');
			const { switched, id, movable } = await storageSession.receiveLineup(doc);
			documentBar.arrived(switched, m.library_loaded_shared_lineup(), id, movable);
		});
	}

	/**
	 * An arriving team (`?team=`): onto the board on screen, the first team
	 * with nobody in it, else a new team on a Custom board. (Lineups design
	 * §9.7's "probably a team on the active board", taken.) ⚓ With no room
	 * (Nate 2026-11-11), it opens as a new Custom lineup, the way `?b=`
	 * arrives, rather than being dropped.
	 */
	receiveTeam(ids: string[]) {
		// ⚓ Onto THEORYCRAFT's lineup (§9.3).
		void documentsReady.then(async (viaStore) => {
			let switched = false;
			if (viaStore) {
				const { storageSession } = await import('./storage/session.svelte');
				switched = await storageSession.toTheorycraft();
			}
			if (this.#placeTeam(ids)) {
				if (switched) documentBar.arrived(true, OPENED_IN_THEORYCRAFT());
				else notices.toast('success', m.library_team_added_to_the_lineup());
				return;
			}
			const board = makeBoard('');
			board.teams[0].slots = Array.from({ length: 4 }, (_, i) => ids[i] ?? null);
			if (!viaStore) {
				boards.restoreFrom(board);
				notices.toast('success', TEAM_IN_NEW_LINEUP());
				return;
			}
			const { storageSession } = await import('./storage/session.svelte');
			const got = await storageSession.receiveLineup(board);
			documentBar.arrived(switched || got.switched, TEAM_IN_NEW_LINEUP(), got.id, got.movable);
		});
	}

	/** Onto the open board; false when it has no room (a full battlefield
	 *  board, a Custom board at its limit, or a Theater cast). */
	#placeTeam(ids: string[]): boolean {
		const board = boards.board;
		const slots: TeamSlot[] = ids.slice(0, 4);
		const empty = board.teams.find((t) => t.slots.every((s) => s === null));
		if (empty) {
			boards.setTeam(board.id, empty.id, slots);
			return true;
		}
		// A battlefield board's teams are the game's: only Custom grows.
		return board.preset === 'custom' && !!boards.addTeam(board.id, slots);
	}

	/** Copy a `?b=` link to the board. Teams and levels travel, pins
	 *  never (§9.4). */
	async shareLink(): Promise<Outcome | null> {
		if (!boardHasMembers(boards.board)) return null;
		try {
			const url = await this.shareUrl();
			if (!url) return null;
			await navigator.clipboard.writeText(url);
			return { ok: true, short: m.notices_copied(), long: m.notices_link_copied() };
		} catch {
			return {
				ok: false,
				short: m.notices_couldn_t_copy(),
				long: m.notices_couldn_t_copy_what_the_browser_may_have({ what: m.notices_the_link() })
			};
		}
	}

	/** The `?b=` link to the board — what Share copies, and what a
	 *  problem report carries ($lib/feedback.ts). `null` for an empty board. */
	async shareUrl(): Promise<string | null> {
		const board = boards.board;
		if (!boardHasMembers(board)) return null;
		// ⚓ A pin names a rotation in the profile's storage.
		const saved = await (await import('./storage/session.svelte')).storageSession.savedRotations();
		const param = await encodeBoard(toSharedBoard(board, saved, get(constellations)));
		return `${location.origin}/builder?b=${param}`;
	}
}

export const boardBar = new BoardBarState();
