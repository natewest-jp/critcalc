/**
 * src/lib/boards.svelte.ts
 *
 * THE BOARD — the Team Builder's document (lineups design §2.2; rulings §9 and
 * §10, 2026-10-08). A board is a LINEUP of teams: three for Stygian Onslaught,
 * two for Abyss, as many as the player wants. Boards are tabs, in the same
 * grammar as the Planner's rotation tabs (⚓ Nate: "so people already know how
 * they behave"), and share their machinery — the limit, the room-making rule
 * and Recently closed — through `tabSet.ts`.
 *
 * ══ A TEAM'S ROTATIONS ARE DERIVED, NOT LINKED (⚓ Nate, §10.2) ═════════════
 *
 * A board team is a set of characters. Its rotations are whatever the library
 * holds for that set (`teamKey`), so nothing links a team to a tab. It may PIN
 * one saved rotation as "the one I'd play here"; a pin whose rotation is gone,
 * or whose rotation's team no longer matches, simply stops counting.
 *
 * ⚓ THE BUILDER NEVER REWRITES A SAVED ROTATION. Swapping on a board changes
 * the board's team and nothing else; carrying a rotation across to a new
 * character is "Try in Planner", which opens a NEW tab. (A first design linked
 * teams to live Planner tabs and renamed in their notation; tabs are scratch
 * space, and the link needed locked tabs, close-snapshots and a "remove from
 * the rotation too?" question to stay honest. Retired the same day.)
 *
 * ══ CONSTELLATIONS (⚓ Nate, §9.5 + §10.2) ══════════════════════════════════
 *
 * A team's level for a character: the PINNED rotation's while pinned, else the
 * team's own value, else the roster's, else C0 — one source at a time, so two
 * cannot disagree. Your own boards hold no values until you set some, so they
 * follow the roster live; a shared board arrives with every value filled in.
 *
 * SSR/hydration: the same deterministic default (one empty board) on server
 * and client; `restore()` runs from the tools layout's onMount.
 */

import { browser } from '$app/environment';
import { TEAM_SIZE, notationHasActions, teamKey, teamKeyOfNotation } from './utils/notationEdit';
import { TAB_LIMIT, createRecentlyClosed } from './tabSet';
import type { SharedBoard } from './utils/boardUrl';
import { safeSetItem, type SavedBoardTeam, type SavedNotation } from './stores';

export type TeamSlot = string | null;

export type BoardTeam = {
	id: string;
	/** Four slots — any position, gaps allowed. */
	slots: TeamSlot[];
	/** Layer 2: this team's own constellations. Absent = the roster's. */
	con?: Record<string, number>;
	/** A saved rotation (`SavedNotation.id`) pinned as this team's own. Counts
	 *  only while that rotation exists and is for this team (`pinnedRotation`). */
	pinnedRotationId?: string;
};

/** What a board was created as (§10.5). Kept so a preset's boss names and
 *  goals can attach later; a Custom board starts with one team. */
export type BoardPreset = 'stygian' | 'abyss' | 'custom';

export const PRESET_TEAMS: Record<BoardPreset, number> = { stygian: 3, abyss: 2, custom: 1 };

export type Board = {
	id: string;
	label: string;
	preset: BoardPreset;
	teams: BoardTeam[];
	/** ⚓ "No repeats" — ALLOW AND MARK (§2.2): a character on two teams is
	 *  marked on both, never refused. ON for the endgame presets, where the game
	 *  forbids it; OFF for Custom (Nate 2026-10-09). */
	noRepeats: boolean;
	/** A Stygian lineup's season — its game VERSION ("7.1"), changeable from the
	 *  board (§2.6). Team i stands on battlefield i. ↻ §11.6: UNSET means "the
	 *  current season" — an untouched board follows the game, and the Team
	 *  Builder pins it here on the board's first edit. ⚠ A string only: the season DATA is the Team
	 *  Builder's (`$lib/endgame`), and this module is reached from the Planner
	 *  too, so it must not import 187 KB of bosses. */
	season?: string;
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

/** Exactly four slots, ids or null. */
export function normalizeSlots(slots: readonly (string | null | undefined)[]): TeamSlot[] {
	const out = emptySlots();
	for (let i = 0; i < TEAM_SIZE; i++) {
		const id = slots[i];
		out[i] = typeof id === 'string' && id && id !== 'blank' ? id : null;
	}
	return out;
}

export function makeTeam(slots: TeamSlot[] = emptySlots()): BoardTeam {
	return { id: genId(), slots: normalizeSlots(slots) };
}

export function makeBoard(label: string, preset: BoardPreset = 'custom'): Board {
	return {
		id: genId(),
		label,
		preset,
		teams: Array.from({ length: PRESET_TEAMS[preset] }, () => makeTeam()),
		noRepeats: preset !== 'custom',
		viewedAt: Date.now()
	};
}

/** The saved rotations filed under this team — the library's grouping (§10.1). */
export function rotationsForTeam(
	team: Pick<BoardTeam, 'slots'>,
	saved: readonly SavedNotation[]
): SavedNotation[] {
	const key = teamKey(team.slots);
	if (!key) return [];
	// A names-only entry is the TEAM itself (the library's heading), never one
	// of its rotations.
	return saved.filter(
		(e) => notationHasActions(e.notation) && teamKeyOfNotation(e.notation) === key
	);
}

/** The pinned rotation, if it still exists AND is still this team's. */
export function pinnedRotation(
	team: BoardTeam,
	saved: readonly SavedNotation[]
): SavedNotation | undefined {
	if (!team.pinnedRotationId) return undefined;
	const entry = saved.find((e) => e.id === team.pinnedRotationId);
	return entry && teamKeyOfNotation(entry.notation) === teamKey(team.slots) ? entry : undefined;
}

/** The team's own constellation values (Layer 2): the pinned rotation's while
 *  pinned, else the team's. */
export function teamCon(team: BoardTeam, saved: readonly SavedNotation[]): Record<string, number> {
	return pinnedRotation(team, saved)?.tabCon ?? team.con ?? {};
}

/** A character's level: the team's own value, else the roster's, else C0.
 *  ONE resolution, the Planner tab's (§9.5). */
export function effectiveCon(
	own: Record<string, number>,
	roster: Record<string, number>,
	id: string
): number {
	return own[id] ?? roster[id] ?? 0;
}

/**
 * ⚓ "No repeats" — ONE TEAM PER CHARACTER (Nate 2026-10-11; ↻ it used to
 * allow and mark). Keeps each character's first appearance in `keepOrder`
 * (team indexes, most-preferred first; teams it leaves out follow in board
 * order) and empties every other slot they hold. Slots keep their places, as
 * a removal does in the game. Pure: the store applies it.
 */
/** A team with new slots; its pin drops if the set of characters changed. */
function withSlots(t: BoardTeam, slots: TeamSlot[]): BoardTeam {
	const sameTeam = teamKey(slots) === teamKey(t.slots);
	return { ...t, slots, ...(!sameTeam && { pinnedRotationId: undefined }) };
}

/** A board whose teams take these slots, in order (unchanged teams kept as-is). */
function withTeams(b: Board, slots: TeamSlot[][]): Board {
	return {
		...b,
		teams: b.teams.map((t, i) =>
			slots[i].every((s, j) => s === t.slots[j]) ? t : withSlots(t, slots[i])
		)
	};
}

export function withoutRepeats(
	teams: readonly TeamSlot[][],
	keepOrder: readonly number[] = []
): TeamSlot[][] {
	const order = [...keepOrder, ...teams.map((_, i) => i).filter((i) => !keepOrder.includes(i))];
	// A plain array, not a Set: this is a pure function and nothing here is
	// state (see documentBar.copyName for the lint rule's false alarm).
	const seen: string[] = [];
	const out = teams.map((slots) => [...slots]);
	for (const t of order) {
		const slots = out[t];
		if (!slots) continue;
		slots.forEach((id, i) => {
			if (!id) return;
			if (seen.includes(id)) slots[i] = null;
			else seen.push(id);
		});
	}
	return out;
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
	/** ⚓ The cold start is the CURRENT Stygian Onslaught (§11.2): the tool at
	 *  its most useful, the mode most players come for. No `season` is stored, so
	 *  the board FOLLOWS the season (the Team Builder reads an unset season as
	 *  the current one) until its first edit pins it (§11.6 item 4). */
	boards = $state<Board[]>([makeBoard('Lineup 1', 'stygian')]);
	activeBoardId = $state<string>(this.boards[0].id);
	restored = $state(false);

	get activeBoard(): Board {
		return this.boards.find((b) => b.id === this.activeBoardId) ?? this.boards[0];
	}

	/** Restore from localStorage. Idempotent; call once, pre-paint. */
	restore(): void {
		const stored = loadFromStorage();
		if (stored) {
			this.boards = stored.boards.map((b) => ({
				...b,
				preset: b.preset ?? 'custom',
				teams: b.teams.map((t) => ({ ...t, slots: normalizeSlots(t.slots ?? []) }))
			}));
			this.activeBoardId = this.boards.some((b) => b.id === stored.activeBoardId)
				? stored.activeBoardId
				: this.boards[0].id;
		}
		this.restored = true;
	}

	/** Write to localStorage. Reads every persisted field; never writes $state. */
	persist(): void {
		const snapshot = { boards: this.boards, activeBoardId: this.activeBoardId };
		if (!this.restored) return;
		safeSetItem(BOARDS_KEY, JSON.stringify(snapshot));
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
		this.boards = [...this.boards, { ...board, id, viewedAt: Date.now() }];
		this.activeBoardId = id;
		return true;
	}

	addBoard(preset: BoardPreset = 'custom', season?: string): boolean {
		return this.openBoard({
			...makeBoard(`Lineup ${this.boards.length + 1}`, preset),
			...(season && { season })
		});
	}

	/** Close a board and hand it back for Recently closed. The last board
	 *  never closes. */
	closeBoard(id: string): Board | undefined {
		if (this.boards.length <= 1) return undefined;
		const idx = this.boards.findIndex((b) => b.id === id);
		if (idx < 0) return undefined;
		const closed = this.boards[idx];
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

	setSeason(id: string, season: string): void {
		this.#updateBoard(id, (b) => ({ ...b, season }));
	}

	/** Turning it ON settles any repeats at once, keeping each character on
	 *  the team that comes first in `keepOrder` (team ids — the Builder passes
	 *  the order teams were last selected in). */
	setNoRepeats(id: string, on: boolean, keepOrder: readonly string[] = []): void {
		this.#updateBoard(id, (b) => {
			if (!on) return { ...b, noRepeats: false };
			const order = keepOrder.map((tid) => b.teams.findIndex((t) => t.id === tid));
			return {
				...withTeams(
					b,
					withoutRepeats(
						b.teams.map((t) => t.slots),
						order
					)
				),
				noRepeats: true
			};
		});
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

	/** Put `id` in slot `index` (null empties it). The board's team changes and
	 *  nothing else — ⚓ no saved rotation is touched (§10.2). A pin to a
	 *  rotation for the OLD team drops, since it is no longer this team's.
	 *  Under No repeats a character placed here LEAVES any other team; returns
	 *  the ids of the teams they left. */
	setSlot(boardId: string, teamId: string, index: number, id: TeamSlot): string[] {
		const left = this.#teamsHolding(boardId, id, teamId);
		this.#updateTeam(boardId, teamId, (t) => {
			const slots = [...t.slots];
			slots[index] = id;
			return withSlots(t, slots);
		});
		if (id) this.#settleRepeats(boardId, teamId, [id]);
		return left;
	}

	/** Fill every slot at once — a team chosen from the library (§10.2). Under
	 *  No repeats its members leave any other team. */
	setTeam(boardId: string, teamId: string, slots: TeamSlot[]): void {
		this.#updateTeam(boardId, teamId, (t) => ({
			id: t.id,
			slots: normalizeSlots(slots),
			...(t.con && { con: t.con })
		}));
		this.#settleRepeats(
			boardId,
			teamId,
			slots.filter((s): s is string => !!s)
		);
	}

	/** The OTHER teams `id` sits on, when the board forbids repeats. */
	#teamsHolding(boardId: string, id: TeamSlot, exceptTeamId: string): string[] {
		const board = this.boards.find((b) => b.id === boardId);
		if (!id || !board?.noRepeats) return [];
		return board.teams
			.filter((t) => t.id !== exceptTeamId && t.slots.includes(id))
			.map((t) => t.id);
	}

	/** Under No repeats, `keepTeamId` keeps `ids` and every other team lets
	 *  them go. ⚠ Only the characters just placed: a repeat already on the
	 *  board is the toggle's to settle, never an unrelated pick's. */
	#settleRepeats(boardId: string, keepTeamId: string, ids: readonly string[]): void {
		this.#updateBoard(boardId, (b) => {
			if (!b.noRepeats) return b;
			return withTeams(
				b,
				b.teams.map((t) =>
					t.id === keepTeamId ? t.slots : t.slots.map((s) => (s && ids.includes(s) ? null : s))
				)
			);
		});
	}

	/** Set a team's own constellation for a character. */
	setTeamCon(boardId: string, teamId: string, charId: string, level: number): void {
		this.#updateTeam(boardId, teamId, (t) => ({
			...t,
			con: { ...(t.con ?? {}), [charId]: level }
		}));
	}

	/** Put a board's teams back exactly as they were — a swap's Undo. Whole
	 *  teams, pins included: under No repeats a swap may have moved its
	 *  candidate off another team, and that team comes back too. */
	restoreTeams(boardId: string, teams: readonly BoardTeam[]): void {
		this.#updateBoard(boardId, (b) => ({ ...b, teams: teams.map((t) => ({ ...t })) }));
	}

	/** Pin a saved rotation as this team's (null unpins). */
	pin(boardId: string, teamId: string, rotationId: string | null): void {
		this.#updateTeam(boardId, teamId, (t) => ({ ...t, pinnedRotationId: rotationId ?? undefined }));
	}
}

export const boards = new BoardsState();

// ---------------------------------------------------------------------------
// Sharing — the `?b=` link (boardUrl.ts)
// ---------------------------------------------------------------------------

/** Every member's level resolved and written explicitly (team → roster → 0). */
function denseCon(
	team: BoardTeam,
	saved: readonly SavedNotation[],
	roster: Record<string, number>
): Record<string, number> {
	const own = teamCon(team, saved);
	const out: Record<string, number> = {};
	for (const id of team.slots) if (id) out[id] = effectiveCon(own, roster, id);
	return out;
}

/**
 * A board as it travels: every team's characters and every member's level
 * written explicitly, so the recipient sees the sender's constellations and
 * never their own (§9.5). Pins do not travel — they name rotations in the
 * SENDER's library (§9.4).
 */
export function toSharedBoard(
	board: Board,
	saved: readonly SavedNotation[],
	roster: Record<string, number>
): SharedBoard {
	return {
		label: board.label,
		noRepeats: board.noRepeats,
		preset: board.preset,
		...(board.season && { season: board.season }),
		teams: board.teams.map((t) => ({ slots: t.slots, constellations: denseCon(t, saved, roster) }))
	};
}

/** A decoded board, ready to open: unknown characters emptied, every team
 *  carrying the sender's levels as its own. */
export function fromSharedBoard(
	shared: SharedBoard,
	isValidId: (id: string) => boolean
): Omit<Board, 'id'> {
	return {
		label: shared.label,
		preset: shared.preset ?? 'custom',
		...(shared.season && { season: shared.season }),
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

/** Every team with each member's level PINNED (team → roster → 0), so a saved
 *  board stays what it was when the roster changes — a saved rotation's
 *  densify rule. The pin is kept; it counts again only while it still holds. */
export function toSavedTeams(
	board: Board,
	saved: readonly SavedNotation[],
	roster: Record<string, number>
): SavedBoardTeam[] {
	return board.teams.map((t) => ({
		id: t.id,
		slots: t.slots,
		con: denseCon(t, saved, roster),
		...(t.pinnedRotationId && { pinnedRotationId: t.pinnedRotationId })
	}));
}

/** A saved board's teams, ready to open. */
export function fromSavedTeams(teams: readonly SavedBoardTeam[]): BoardTeam[] {
	return teams.map((t) => ({
		id: genId(),
		slots: normalizeSlots(t.slots),
		con: { ...(t.con ?? {}) },
		...(t.pinnedRotationId && { pinnedRotationId: t.pinnedRotationId })
	}));
}
