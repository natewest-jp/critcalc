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

/** A team that found no room: what to do about it, too. */
export const LINEUP_FULL =
	'The lineup is full, so the team wasn’t added. Choose a team to replace, or use a Custom lineup.';
/** A board is worth sharing when any of its teams holds anyone. */
export function boardWorthKeeping(board: Board): boolean {
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
				boards.restoreFrom({ boards: [doc], activeBoardId: doc.id });
				notices.toast('info', 'Loaded shared lineup');
				return;
			}
			const { storageSession } = await import('./storage/session.svelte');
			const { switched, id, movable } = await storageSession.receiveLineup(doc);
			documentBar.arrived(switched, 'Loaded shared lineup', id, movable);
		});
	}

	/**
	 * An arriving team (`?team=`): onto the ACTIVE board — the first team with
	 * nobody in it, else a new team. (Lineups design §9.7's "probably a team on
	 * the active board", taken.)
	 */
	receiveTeam(ids: string[]) {
		// ⚓ Onto THEORYCRAFT's lineup (§9.3).
		void documentsReady.then(async (viaStore) => {
			let switched = false;
			if (viaStore) {
				const { storageSession } = await import('./storage/session.svelte');
				switched = await storageSession.toTheorycraft();
			}
			// One slot: the arrival's notice would replace a refusal said a
			// moment before, so a team that didn't fit is said LAST.
			const added = this.#placeTeam(ids, switched);
			if (switched) documentBar.arrived(true, OPENED_IN_THEORYCRAFT);
			if (!added && switched) notices.toast('warning', LINEUP_FULL);
		});
	}

	/** False when the lineup had no room. `quiet` leaves the notices to the
	 *  caller, which has an arrival to say as well. */
	#placeTeam(ids: string[], quiet = false): boolean {
		const board = boards.activeBoard;
		const slots: TeamSlot[] = ids.slice(0, 4);
		const empty = board.teams.find((t) => t.slots.every((s) => s === null));
		if (empty) boards.setTeam(board.id, empty.id, slots);
		// A battlefield board's teams are the game's — only Custom grows.
		else if (board.preset !== 'custom' || !boards.addTeam(board.id, slots)) {
			if (!quiet) notices.toast('warning', LINEUP_FULL);
			return false;
		}
		if (!quiet) notices.toast('success', 'Team added to the lineup');
		return true;
	}

	/** Copy a `?b=` link to the active board. Teams and levels travel, pins
	 *  never (§9.4). */
	async shareLink(): Promise<Outcome | null> {
		if (!boardWorthKeeping(boards.activeBoard)) return null;
		try {
			const url = await this.shareUrl();
			if (!url) return null;
			await navigator.clipboard.writeText(url);
			return { ok: true, short: 'Copied', long: 'Link copied' };
		} catch {
			return {
				ok: false,
				short: 'Couldn’t copy',
				long: 'Couldn’t copy the link. The browser may have blocked the clipboard.'
			};
		}
	}

	/** The `?b=` link to the active board — what Share copies, and what a
	 *  problem report carries ($lib/feedback.ts). `null` for an empty board. */
	async shareUrl(): Promise<string | null> {
		const board = boards.activeBoard;
		if (!boardWorthKeeping(board)) return null;
		// ⚓ A pin names a rotation in the profile's storage.
		const saved = await (await import('./storage/session.svelte')).storageSession.savedRotations();
		const param = await encodeBoard(toSharedBoard(board, saved, get(constellations)));
		return `${location.origin}/builder?b=${param}`;
	}
}

export const boardBar = new BoardBarState();
