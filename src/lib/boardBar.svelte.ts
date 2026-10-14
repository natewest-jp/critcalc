/**
 * src/lib/boardBar.svelte.ts
 *
 * The Team Builder's band A — the BOARD document's flows (lineups design §2.2,
 * §9.3, §10), as `documentBar` is the rotation's. Boards copy the rotation
 * tabs completely (⚓ Nate §9.6a): the same limit, the same make-room confirm
 * (raised on `documentBar.room`, so ONE dialog serves both kinds of tab), the
 * same Recently closed.
 *
 * Save and Load arrived with the library (§10.1a, build step 4): Load is the
 * library, opened from the Builder.
 */

import { get } from 'svelte/store';
import { constellations, savedBoards, savedNotations, type SavedBoard } from './stores';
import { documentBar } from './documentBar.svelte';
import {
	boards,
	fromSavedTeams,
	fromSharedBoard,
	toSavedTeams,
	makeBoard,
	recentlyClosedBoards,
	toSharedBoard,
	type Board,
	type BoardPreset,
	type TeamSlot
} from './boards.svelte';
import { closeCandidate, TAB_LIMIT, type TabStripModel } from './tabSet';
import { encodeBoard, type SharedBoard } from './utils/boardUrl';

/** A closing board is worth keeping when any of its teams holds anyone. */
export function boardWorthKeeping(board: Board): boolean {
	return board.teams.some((t) => t.slots.some((s) => s !== null));
}

class BoardBarState {
	/** Run `open` now if there is room; otherwise raise the make-room confirm. */
	withRoom(open: () => void, onCancel?: () => void) {
		if (boards.boards.length < TAB_LIMIT) {
			open();
			return;
		}
		const candidate = closeCandidate(boards.boards, boards.activeBoardId)!;
		documentBar.room = {
			tabs: boards.boards.map((b) => ({ id: b.id, label: b.label })),
			close: (id) => this.closeBoard(id),
			candidateId: candidate.id,
			run: open,
			onCancel
		};
	}

	/** A new board; a Stygian one opens on `season` (the page passes the
	 *  current one — this module must not import the season data). */
	newBoard(preset: BoardPreset, season?: string) {
		this.withRoom(() => boards.addBoard(preset, season));
	}

	/** Close a board, keeping it in Recently closed when it holds anyone. */
	closeBoard(id: string) {
		const closed = boards.closeBoard(id);
		if (closed && boardWorthKeeping(closed)) recentlyClosedBoards.push(closed);
	}

	reopen(board: Board) {
		this.withRoom(() => {
			boards.openBoard(board);
			recentlyClosedBoards.remove(board.id);
		});
	}

	/** Is the active board linked to a saved entry that still exists? */
	get linked(): boolean {
		const id = boards.activeBoard.savedId;
		return !!id && get(savedBoards).some((b) => b.id === id);
	}

	/** Save the active board: over its saved entry when linked, else a new
	 *  entry the tab then links to. Members' levels are PINNED, as a saved
	 *  rotation's are. */
	save() {
		const board = boards.activeBoard;
		if (!boardWorthKeeping(board)) return;
		const payload = {
			name: board.label,
			preset: board.preset,
			...(board.season && { season: board.season }),
			noRepeats: board.noRepeats,
			teams: toSavedTeams(board, get(savedNotations), get(constellations))
		};
		if (this.linked) savedBoards.update(board.savedId!, payload);
		else {
			const id = savedBoards.save(payload);
			boards.boards = boards.boards.map((b) => (b.id === board.id ? { ...b, savedId: id } : b));
		}
		documentBar.showNotice('Saved');
	}

	/** Open a saved board as a tab (or switch to the tab already showing it). */
	openSaved(entry: SavedBoard) {
		savedBoards.markOpened(entry.id);
		const open = boards.boards.find((b) => b.savedId === entry.id);
		if (open) {
			boards.switchBoard(open.id);
			return;
		}
		this.withRoom(() =>
			boards.openBoard({
				label: entry.name,
				preset: entry.preset,
				...(entry.season && { season: entry.season }),
				noRepeats: entry.noRepeats,
				teams: fromSavedTeams(entry.teams),
				savedId: entry.id
			})
		);
	}

	/** Save a Recently closed board (its "promotion"). */
	saveClosed(board: Board) {
		const payload = {
			name: board.label,
			preset: board.preset,
			...(board.season && { season: board.season }),
			noRepeats: board.noRepeats,
			teams: toSavedTeams(board, get(savedNotations), get(constellations))
		};
		if (board.savedId && get(savedBoards).some((b) => b.id === board.savedId))
			savedBoards.update(board.savedId, payload);
		else savedBoards.save(payload);
		recentlyClosedBoards.remove(board.id);
	}

	/** A saved board was renamed in the library: its open tab follows. */
	renameLinked(savedId: string, label: string) {
		for (const b of boards.boards) if (b.savedId === savedId) boards.renameBoard(b.id, label);
	}

	/** An arriving shared board (`?b=`). An empty active board takes it, else
	 *  a new tab; cancelling the confirm keeps it in Recently closed. */
	receive(shared: SharedBoard, isValidId: (id: string) => boolean) {
		const doc = fromSharedBoard(shared, isValidId);
		const active = boards.activeBoard;
		if (!boardWorthKeeping(active) && !active.savedId) {
			boards.boards = boards.boards.map((b) => (b.id === active.id ? { ...doc, id: b.id } : b));
			documentBar.showNotice('Loaded shared board');
			return;
		}
		this.withRoom(
			() => {
				boards.openBoard(doc);
				documentBar.showNotice('Loaded shared board');
			},
			() => recentlyClosedBoards.push({ ...makeBoard(doc.label), ...doc })
		);
	}

	/**
	 * An arriving team (`?team=`): onto the ACTIVE board — the first team with
	 * nobody in it, else a new team. (Lineups design §9.7's "probably a team on
	 * the active board", taken.)
	 */
	receiveTeam(ids: string[]) {
		const board = boards.activeBoard;
		const slots: TeamSlot[] = ids.slice(0, 4);
		const empty = board.teams.find((t) => t.slots.every((s) => s === null));
		if (empty) boards.setTeam(board.id, empty.id, slots);
		// A battlefield board's teams are the game's — only Custom grows.
		else if (board.preset !== 'custom' || !boards.addTeam(board.id, slots)) {
			documentBar.showNotice('The board is full');
			return;
		}
		documentBar.showNotice('Team added to the board');
	}

	/** Copy a `?b=` link to the active board. Teams and levels travel, pins
	 *  never (§9.4). */
	async shareLink() {
		const board = boards.activeBoard;
		if (!boardWorthKeeping(board)) return;
		try {
			const param = await encodeBoard(
				toSharedBoard(board, get(savedNotations), get(constellations))
			);
			await navigator.clipboard.writeText(`${location.origin}/builder?b=${param}`);
			documentBar.showNotice('Link copied');
		} catch {
			documentBar.showNotice('Share failed');
		}
	}
}

export const boardBar = new BoardBarState();

/** Band A's strip over the board tabs. The + offers the presets as a menu
 *  (the Team Builder page hands the strip its items), so `addNew` is absent. */
export const boardTabStrip: TabStripModel = {
	get tabs() {
		return boards.boards;
	},
	get activeId() {
		return boards.activeBoardId;
	},
	newLabel: 'New board',
	switchTo: (id) => boards.switchBoard(id),
	close: (id) => boardBar.closeBoard(id),
	rename: (id, label) => {
		const board = boards.renameBoard(id, label);
		if (board?.savedId) savedBoards.rename(board.savedId, label.trim());
	},
	reorder: (from, to, side) => boards.reorderBoards(from, to, side)
};
