/**
 * src/lib/boards.svelte.ts
 *
 * THE BOARD — the Team Builder's document (lineups design §2.2, 2026-10-07;
 * rulings §9, 2026-10-08). A board is a LINEUP of teams: three for Stygian
 * Onslaught, two for Abyss, as many as the player wants. Boards are tabs, in
 * the same grammar as the Planner's rotation tabs (⚓ Nate: "so people already
 * know how they behave"), and share their machinery — the limit, the
 * room-making rule and Recently closed — through `tabSet.ts`.
 *
 * ══ A LINKED TEAM IS A VIEW, NOT A COPY (⚓ Nate, §2.3) ═════════════════════
 *
 * A team may link to a Planner tab. It then READS that tab's slots, which come
 * from the notation, which is the single source of truth — so there is no sync
 * problem, because there is no second copy. Every write to a linked team is a
 * TEXT edit of the tab's notation (`setSlotInNotation`, the rule the bench
 * uses), so a swap renames a character in the rotation and the rotation
 * survives.
 *
 * `slots` on a linked team is therefore NOT read while the link is live. It is
 * the last view, written into the persisted copy only, so a team whose tab has
 * gone (closed, or reset away) keeps its four characters instead of emptying
 * — ⛔ a team is never deleted because its tab was (§2.3).
 *
 * ══ CONSTELLATIONS: ONE MODEL WITH THE PLANNER (⚓ Nate, §9.5) ══════════════
 *
 * A team's level for a character is its OWN value if set, otherwise the
 * roster's — Layer 2 over Layer 1, exactly as a Planner tab's `tabCon`. Your
 * own boards hold no values until you set some, so they follow the roster
 * live; a shared board arrives with every value filled in, so it never falls
 * back. A linked team reads its tab's values.
 *
 * SSR/hydration: the same deterministic default (one empty board) on server
 * and client; `restore()` runs from the tools layout's onMount, AFTER the
 * rotation tabs restore (a link is validated against them).
 */

import { browser } from '$app/environment';
import { rotationTabs as rt, slotsFromNotation } from './rotationTabs.svelte';
import { setSlotInNotation, TEAM_SIZE } from './utils/notationEdit';
import { TAB_LIMIT, createRecentlyClosed } from './tabSet';
import type { SharedBoard } from './utils/boardUrl';
import type { SavedBoardTeam } from './stores';

export type TeamSlot = string | null;

export type BoardTeam = {
	id: string;
	/** Four slots, free-standing. On a LINKED team, the last view of its tab —
	 *  read only once the link is gone (see the module header). */
	slots: TeamSlot[];
	/** Layer 2: this team's own constellations. Absent = the roster's. A linked
	 *  team reads its tab's `tabCon` instead. */
	con?: Record<string, number>;
	/** The Planner tab this team is a live view of. */
	linkedTabId?: string;
};

export type Board = {
	id: string;
	label: string;
	teams: BoardTeam[];
	/** ⚓ "No repeats" — ALLOW AND MARK (§2.2): a character on two teams is
	 *  marked on both, never refused. On by default. */
	noRepeats: boolean;
	/** The saved-board entry this tab is linked to, as `RotationTab.savedId`. */
	savedId?: string;
	/** When this board was last on screen (ms) — see `tabSet.closeCandidate`. */
	viewedAt?: number;
};

/** Teams per board. A SAFETY guard for a decoded link as much as a product
 *  number: a lineup is two or three teams, and twelve is far past any mode. */
export const BOARD_TEAM_LIMIT = 12;

export const BOARDS_KEY = 'critcalc:boards';

export const recentlyClosedBoards = createRecentlyClosed<Board>('critcalc:recentlyClosedBoards');

function genId(): string {
	return Math.random().toString(36).slice(2, 10);
}

export function emptySlots(): TeamSlot[] {
	return Array.from({ length: TEAM_SIZE }, () => null);
}

export function makeTeam(slots: TeamSlot[] = emptySlots()): BoardTeam {
	return { id: genId(), slots: normalizeSlots(slots) };
}

export function makeBoard(label: string, teamCount = 1): Board {
	return {
		id: genId(),
		label,
		teams: Array.from({ length: teamCount }, () => makeTeam()),
		noRepeats: true,
		viewedAt: Date.now()
	};
}

/** Exactly four slots, ids or null. */
export function normalizeSlots(slots: readonly (string | null | undefined)[]): TeamSlot[] {
	const out = emptySlots();
	for (let i = 0; i < TEAM_SIZE; i++) {
		const id = slots[i];
		out[i] = typeof id === 'string' && id && id !== 'blank' ? id : null;
	}
	return out;
}

/** Is the link live — does its tab still exist? */
function linkLive(team: BoardTeam): team is BoardTeam & { linkedTabId: string } {
	return !!team.linkedTabId && rt.notationOf(team.linkedTabId) !== undefined;
}

/** THE team's slots: its tab's, read through, while linked; its own otherwise. */
export function teamSlots(team: BoardTeam): TeamSlot[] {
	if (!linkLive(team)) return team.slots;
	return normalizeSlots(slotsFromNotation(rt.notationOf(team.linkedTabId) ?? ''));
}

/** The team's own constellation values (Layer 2): its tab's while linked. */
export function teamCon(team: BoardTeam): Record<string, number> {
	if (!linkLive(team)) return team.con ?? {};
	return rt.tabConOf(team.linkedTabId) ?? {};
}

/** A character's level on a team: the team's own value, else the roster's,
 *  else C0. ONE resolution, the Planner tab's (§9.5). */
export function effectiveCon(
	own: Record<string, number>,
	roster: Record<string, number>,
	id: string
): number {
	return own[id] ?? roster[id] ?? 0;
}

/**
 * ⚓ "No repeats" — ALLOW AND MARK. Every character that sits on more than one
 * team, mapped to the indexes of the teams that hold them. The board's
 * `noRepeats` decides whether a consumer SHOWS the marks; this only counts.
 */
export function repeatedCharacters(teams: readonly TeamSlot[][]): Record<string, number[]> {
	// A plain record, not a Map: this is a pure function and nothing here is
	// state (the repo's svelte/prefer-svelte-reactivity rule would rather see a
	// SvelteMap, which would be wrong — see documentBar.copyName).
	const holders: Record<string, number[]> = {};
	teams.forEach((slots, t) => {
		for (const id of slots) {
			if (!id) continue;
			const ts = (holders[id] ??= []);
			if (!ts.includes(t)) ts.push(t);
		}
	});
	for (const id of Object.keys(holders)) if (holders[id].length < 2) delete holders[id];
	return holders;
}

/** The persisted form of a board: every linked team's CURRENT view written
 *  into its own `slots`/`con`, so the team survives its tab (module header). */
export function snapshotBoard(board: Board): Board {
	return {
		...board,
		teams: board.teams.map((t) =>
			linkLive(t) ? { ...t, slots: teamSlots(t), con: { ...teamCon(t) } } : t
		)
	};
}

function loadFromStorage(): { boards: Board[]; activeBoardId: string } | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(BOARDS_KEY);
		if (!raw) return null;
		const data = JSON.parse(raw);
		if (!Array.isArray(data.boards) || data.boards.length === 0 || !data.activeBoardId) return null;
		return data;
	} catch {
		return null;
	}
}

class BoardsState {
	boards = $state<Board[]>([makeBoard('Board 1')]);
	activeBoardId = $state<string>(this.boards[0].id);
	restored = $state(false);

	get activeBoard(): Board {
		return this.boards.find((b) => b.id === this.activeBoardId) ?? this.boards[0];
	}

	/** Restore from localStorage. Call once, pre-paint, AFTER `rotationTabs.restore()`:
	 *  a link to a tab that no longer exists is dropped here, keeping the team's
	 *  last view. */
	restore(): void {
		const stored = loadFromStorage();
		if (stored) {
			this.boards = stored.boards.map((b) => ({
				...b,
				teams: b.teams.map((t) => ({
					...t,
					slots: normalizeSlots(t.slots ?? []),
					linkedTabId:
						t.linkedTabId && rt.notationOf(t.linkedTabId) !== undefined ? t.linkedTabId : undefined
				}))
			}));
			this.activeBoardId = this.boards.some((b) => b.id === stored.activeBoardId)
				? stored.activeBoardId
				: this.boards[0].id;
		}
		this.restored = true;
	}

	/** Write to localStorage. Reads every persisted field — including each
	 *  linked tab's notation, so a rotation edit refreshes the team's last view
	 *  — and never writes $state. */
	persist(): void {
		const snapshot = this.boards.map(snapshotBoard);
		if (!this.restored) return;
		localStorage.setItem(
			BOARDS_KEY,
			JSON.stringify({ boards: snapshot, activeBoardId: this.activeBoardId })
		);
	}

	// ── Board tabs ──────────────────────────────────────────────────────────

	#stampLeaving(): void {
		const now = Date.now();
		this.boards = this.boards.map((b) =>
			b.id === this.activeBoardId ? { ...b, viewedAt: now } : b
		);
	}

	switchBoard(id: string): void {
		if (id === this.activeBoardId || !this.boards.some((b) => b.id === id)) return;
		this.#stampLeaving();
		this.activeBoardId = id;
	}

	/** Open a board (a new one, a saved one, a shared one, a reopened one) and
	 *  make it active. False at the limit — the caller makes room first. */
	openBoard(board: Omit<Board, 'id'> & { id?: string }): boolean {
		if (this.boards.length >= TAB_LIMIT) return false;
		this.#stampLeaving();
		const id = board.id && !this.boards.some((b) => b.id === board.id) ? board.id : genId();
		const next: Board = { ...board, id, viewedAt: Date.now() };
		this.boards = [...this.boards, next];
		this.activeBoardId = id;
		return true;
	}

	addBoard(teamCount = 1): boolean {
		return this.openBoard(makeBoard(`Board ${this.boards.length + 1}`, teamCount));
	}

	/** Close a board and hand it back (its links snapshotted) for Recently
	 *  closed. The last board never closes. */
	closeBoard(id: string): Board | undefined {
		if (this.boards.length <= 1) return undefined;
		const idx = this.boards.findIndex((b) => b.id === id);
		if (idx < 0) return undefined;
		const closed = snapshotBoard(this.boards[idx]);
		this.boards = this.boards.filter((b) => b.id !== id);
		if (id === this.activeBoardId) {
			this.activeBoardId = this.boards[Math.min(idx, this.boards.length - 1)].id;
		}
		return closed;
	}

	renameBoard(id: string, label: string): Board | undefined {
		const trimmed = label.trim();
		if (!trimmed) return undefined;
		const board = this.boards.find((b) => b.id === id);
		this.#updateBoard(id, (b) => ({ ...b, label: trimmed }));
		return board;
	}

	reorderBoards(fromId: string, toId: string, side: 'left' | 'right'): void {
		if (fromId === toId) return;
		const arr = [...this.boards];
		const [dragged] = arr.splice(
			arr.findIndex((b) => b.id === fromId),
			1
		);
		const toIdx = arr.findIndex((b) => b.id === toId);
		arr.splice(side === 'left' ? toIdx : toIdx + 1, 0, dragged);
		this.boards = arr;
	}

	setNoRepeats(id: string, on: boolean): void {
		this.#updateBoard(id, (b) => ({ ...b, noRepeats: on }));
	}

	// ── Teams ───────────────────────────────────────────────────────────────

	#updateBoard(id: string, fn: (b: Board) => Board): void {
		this.boards = this.boards.map((b) => (b.id === id ? fn(b) : b));
	}

	#updateTeam(boardId: string, teamId: string, fn: (t: BoardTeam) => BoardTeam): void {
		this.#updateBoard(boardId, (b) => ({
			...b,
			teams: b.teams.map((t) => (t.id === teamId ? fn(t) : t))
		}));
	}

	#team(boardId: string, teamId: string): BoardTeam | undefined {
		return this.boards.find((b) => b.id === boardId)?.teams.find((t) => t.id === teamId);
	}

	addTeam(boardId: string, slots?: TeamSlot[]): BoardTeam | undefined {
		const board = this.boards.find((b) => b.id === boardId);
		if (!board || board.teams.length >= BOARD_TEAM_LIMIT) return undefined;
		const team = makeTeam(slots);
		this.#updateBoard(boardId, (b) => ({ ...b, teams: [...b.teams, team] }));
		return team;
	}

	removeTeam(boardId: string, teamId: string): void {
		this.#updateBoard(boardId, (b) => ({ ...b, teams: b.teams.filter((t) => t.id !== teamId) }));
	}

	/**
	 * Put `id` in slot `index` (null empties it).
	 *
	 * A free-standing team edits its own slots — any position, gaps allowed.
	 * A LINKED team edits its tab's notation through the bench's own rule, so a
	 * swap renames the character's segments and the rotation survives; slot
	 * order follows the notation, so filling a gap appends (§9.6).
	 *
	 * ⚠ Emptying a linked slot DELETES that character's segments. The UI asks
	 * first (§2.3: "Unlink and remove" or "Remove from the rotation too");
	 * `unlinkAndRemove` is the other answer.
	 */
	setSlot(boardId: string, teamId: string, index: number, id: TeamSlot): void {
		const team = this.#team(boardId, teamId);
		if (!team) return;
		if (linkLive(team)) {
			rt.editTabNotation(team.linkedTabId, (n) => setSlotInNotation(n, index, id));
			return;
		}
		this.#updateTeam(boardId, teamId, (t) => {
			const slots = [...t.slots];
			slots[index] = id;
			return { ...t, slots };
		});
	}

	/** Set a free-standing team's own constellation for a character. A linked
	 *  team's levels are its tab's, edited in the Planner. */
	setTeamCon(boardId: string, teamId: string, charId: string, level: number): void {
		const team = this.#team(boardId, teamId);
		if (!team || linkLive(team)) return;
		this.#updateTeam(boardId, teamId, (t) => ({
			...t,
			con: { ...(t.con ?? {}), [charId]: level }
		}));
	}

	// ── Links ───────────────────────────────────────────────────────────────

	/** Is any board team a live view of this tab? (It may not close to make
	 *  room — documentBar.lockedTab.) */
	linksTab(tabId: string): boolean {
		return this.boards.some((b) => b.teams.some((t) => t.linkedTabId === tabId));
	}

	/** Link a team to a tab. Its own slots are replaced by the view. */
	link(boardId: string, teamId: string, tabId: string): void {
		this.#updateTeam(boardId, teamId, (t) => ({ ...t, linkedTabId: tabId }));
	}

	/** Turn a linked team into a free-standing copy of what it shows now. */
	unlink(boardId: string, teamId: string): void {
		this.#updateTeam(boardId, teamId, (t) =>
			linkLive(t)
				? { id: t.id, slots: teamSlots(t), con: { ...teamCon(t) } }
				: { ...t, linkedTabId: undefined }
		);
	}

	/** "Unlink and remove": the rotation keeps the character, the team
	 *  doesn't. */
	unlinkAndRemove(boardId: string, teamId: string, index: number): void {
		this.unlink(boardId, teamId);
		this.setSlot(boardId, teamId, index, null);
	}

	/**
	 * A tab closed: every team linked to it keeps the four characters it showed
	 * and becomes free-standing (⛔ never deleted, §2.3). Called by
	 * documentBar's close path with the tab's final state.
	 */
	tabClosed(tab: { id: string; notation: string; tabCon?: Record<string, number> }): void {
		if (!this.linksTab(tab.id)) return;
		this.boards = this.boards.map((b) => ({
			...b,
			teams: b.teams.map((t) =>
				t.linkedTabId === tab.id
					? {
							id: t.id,
							slots: normalizeSlots(slotsFromNotation(tab.notation)),
							con: { ...(tab.tabCon ?? {}) }
						}
					: t
			)
		}));
	}
}

export const boards = new BoardsState();

// ---------------------------------------------------------------------------
// Sharing — the `?b=` link (boardUrl.ts)
// ---------------------------------------------------------------------------

/**
 * A board as it travels: every team's CURRENT view, and every member's level
 * resolved (team value → roster → 0) and written explicitly, so the recipient
 * sees the sender's constellations and never their own (§9.5). Links do not
 * travel (§9.4).
 */
export function toSharedBoard(board: Board, roster: Record<string, number>): SharedBoard {
	return {
		label: board.label,
		noRepeats: board.noRepeats,
		teams: board.teams.map((t) => {
			const slots = teamSlots(t);
			const own = teamCon(t);
			const constellations: Record<string, number> = {};
			for (const id of slots) if (id) constellations[id] = effectiveCon(own, roster, id);
			return { slots, constellations };
		})
	};
}

/** A decoded board, ready to open: unknown characters emptied, every team
 *  free-standing and carrying the sender's levels as its own. */
export function fromSharedBoard(
	shared: SharedBoard,
	isValidId: (id: string) => boolean
): Omit<Board, 'id'> {
	return {
		label: shared.label,
		noRepeats: shared.noRepeats,
		teams: shared.teams.map((t) => {
			const slots = normalizeSlots(t.slots.map((id) => (id && isValidId(id) ? id : null)));
			const con: Record<string, number> = {};
			for (const id of slots) if (id && id in t.constellations) con[id] = t.constellations[id];
			return { id: genId(), slots, con };
		})
	};
}

// ---------------------------------------------------------------------------
// The bank — saved boards (stores.ts `savedBoards`)
// ---------------------------------------------------------------------------

/** Every team's current view with each member's level PINNED (team value →
 *  roster → 0), so a saved board stays what it was when the roster changes —
 *  a saved rotation's densify rule. A link is kept (see `fromSavedTeams`). */
export function toSavedTeams(board: Board, roster: Record<string, number>): SavedBoardTeam[] {
	return board.teams.map((t) => {
		const slots = teamSlots(t);
		const own = teamCon(t);
		const con: Record<string, number> = {};
		for (const id of slots) if (id) con[id] = effectiveCon(own, roster, id);
		return { id: t.id, slots, con, ...(linkLive(t) && { linkedTabId: t.linkedTabId }) };
	});
}

/** A saved board's teams, ready to open: a link whose tab still exists is
 *  live again; any other team is its saved snapshot. */
export function fromSavedTeams(teams: readonly SavedBoardTeam[]): BoardTeam[] {
	return teams.map((t) => ({
		id: genId(),
		slots: normalizeSlots(t.slots),
		con: { ...(t.con ?? {}) },
		...(t.linkedTabId &&
			rt.notationOf(t.linkedTabId) !== undefined && { linkedTabId: t.linkedTabId })
	}));
}
