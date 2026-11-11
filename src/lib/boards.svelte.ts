/**
 * src/lib/boards.svelte.ts
 *
 * THE BOARD — the Team Builder's document (lineups design §2.2; rulings §9 and
 * §10, 2026-10-08). A board is a LINEUP of teams: three for Stygian Onslaught,
 * two for Abyss, as many as the player wants. The Builder shows one board,
 * the profile's current lineup document.
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
 * character is "Try in Planner", which makes a NEW rotation. (A first design
 * linked teams to live Planner tabs and renamed in their notation; the link
 * needed locked tabs, close-snapshots and a "remove from the rotation too?"
 * question to stay honest. Retired the same day.)
 *
 * ══ CONSTELLATIONS (⚓ Nate, §9.5 + §10.2) ══════════════════════════════════
 *
 * A team's level for a character: the PINNED rotation's while pinned, else the
 * team's own value, else the roster's, else C0 — one source at a time, so two
 * cannot disagree. Your own boards hold no values until you set some, so they
 * follow the roster live; a shared board arrives with every value filled in.
 *
 * SSR/hydration: the same deterministic default (one empty board) on server
 * and client; the storage session restores the real state (`restoreFrom`).
 */

import { characterKey } from './data/characterLookup';
import { TEAM_SIZE, notationHasActions, seatsOfSaved, teamKey } from './utils/notationEdit';
import type { SharedBoard } from './utils/boardUrl';
import { ownership, type SavedNotation } from './stores';
import { belongsToTeam, linkedTeam } from './storage/teamLoadout';
import type { TeamRecord } from './storage/records';
import { get } from 'svelte/store';

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
	/** The saved team this entry was made from (`LineupTeam.teamId`). */
	teamId?: string;
};

/** What a board was created as (§10.5). Kept so a preset's boss names and
 *  goals can attach later; a Custom board starts with one team. */
export type BoardPreset = 'stygian' | 'abyss' | 'theater' | 'custom';

/** ⚓ A Theater lineup has no teams (Nate 2026-11-11): the Theater deals its
 *  characters in by events and chance, so its plan is a CAST (`theater`). */
export const PRESET_TEAMS: Record<BoardPreset, number> = {
	stygian: 3,
	abyss: 2,
	theater: 0,
	custom: 1
};

/**
 * An Imaginarium Theater lineup's plan (⚓ Nate 2026-11-11): the season, the
 * mode, and the Alternate Cast the player brings. Strings only, as `season`
 * is: the season DATA and the rules are `$lib/theater`'s, and this module is
 * reached from the Planner too.
 */
export type TheaterPlan = {
	/** The season's start, ISO ("2026-11-01"). Unset until the Builder first
	 *  shows the lineup, which settles it to the running season. */
	season?: string;
	/** The mode (`TheaterMode`). Unset until settled, then the highest the
	 *  roster opens; the player may choose a lower one, and it stays. */
	mode?: string;
	/** The Alternate Cast, in the order it was picked (the game numbers it). */
	cast: string[];
	/** One friend's character counted toward the cast (Supporting Cast). */
	invite?: boolean;
};

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
	/** A Theater lineup's plan; present exactly when `preset` is 'theater'. */
	theater?: TheaterPlan;
};

/** Teams per board. A SAFETY guard for a decoded link as much as a product
 *  number: a lineup is two or three teams, and twelve is far past any mode. */
export const BOARD_TEAM_LIMIT = 12;

/** A team the Builder should select when it next shows its board — set by
 *  the menu state's Add to a lineup (design §3), which runs while the Builder
 *  may not be mounted. The Builder clears it once it has taken it. */
export const boardFocus = $state<{ teamId: string | null }>({ teamId: null });

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

/** The three shapes a new lineup can take, in menu order (the Library's,
 *  Teams' and a team's New lineup menus). */
export const BOARD_PRESETS: readonly { key: BoardPreset; label: string; hint: string }[] = [
	{ key: 'stygian', label: 'Stygian Onslaught', hint: 'Three teams' },
	{ key: 'abyss', label: 'Spiral Abyss', hint: 'Two teams' },
	{ key: 'theater', label: 'Imaginarium Theater', hint: 'A cast for this month' },
	{ key: 'custom', label: 'Custom', hint: 'One team, add more as you go' }
];

/** The shapes a TEAM can start: every preset but the Theater, which holds a
 *  cast, not teams (a team's New lineup menu, in Teams). */
export const TEAM_PRESETS = BOARD_PRESETS.filter((p) => PRESET_TEAMS[p.key] > 0);

export function makeBoard(label: string, preset: BoardPreset = 'custom'): Board {
	return {
		id: genId(),
		label,
		preset,
		teams: Array.from({ length: PRESET_TEAMS[preset] }, () => makeTeam()),
		// The game forbids a repeat across a battlefield's teams; a Theater cast
		// has no teams to repeat across.
		noRepeats: preset === 'stygian' || preset === 'abyss',
		...(preset === 'theater' && { theater: { cast: [] } })
	};
}

/** The saved rotations filed under this team — the library's grouping (§10.1).
 *  A board team linked to a saved team leaves out rotations linked to another
 *  team of the same four. */
export function rotationsForTeam(
	team: Pick<BoardTeam, 'slots' | 'teamId'>,
	saved: readonly SavedNotation[],
	teams: readonly TeamRecord[] = []
): SavedNotation[] {
	const key = teamKey(team.slots);
	if (!key) return [];
	const linked = linkedTeam(teams, team);
	// A names-only entry is the TEAM itself (the library's heading), never one
	// of its rotations.
	return saved.filter((e) => {
		if (!notationHasActions(e.notation)) return false;
		const slots = seatsOfSaved(e);
		if (teamKey(slots) !== key) return false;
		return !linked || belongsToTeam(linked, { slots, teamId: e.teamId }, teams);
	});
}

/** The pinned rotation, if it still exists AND is still this team's. */
export function pinnedRotation(
	team: BoardTeam,
	saved: readonly SavedNotation[]
): SavedNotation | undefined {
	if (!team.pinnedRotationId) return undefined;
	const entry = saved.find((e) => e.id === team.pinnedRotationId);
	return entry && teamKey(seatsOfSaved(entry)) === teamKey(team.slots) ? entry : undefined;
}

/** The team's own constellation values (Layer 2): the pinned rotation's while
 *  pinned, else the team's. */
export function teamCon(team: BoardTeam, saved: readonly SavedNotation[]): Record<string, number> {
	return pinnedRotation(team, saved)?.tabCon ?? team.con ?? {};
}

/** A character's level: the team's own value, else the roster's, else C0.
 *  ONE resolution, the Planner tab's (§9.5). ↻ Phase 4 (design §2.4): given
 *  `owned`, an OWNED character reads the roster. */
export function effectiveCon(
	own: Record<string, number>,
	roster: Record<string, number>,
	id: string,
	owned?: Record<string, 'owned' | 'wishlist'>
): number {
	if (owned?.[id] === 'owned') return roster[id] ?? 0;
	return own[id] ?? roster[id] ?? 0;
}

/** The ownership `effectiveCon` reads. */
export const strictOwnership = (): Record<string, 'owned' | 'wishlist'> => get(ownership);

/**
 * ⚓ "No repeats" — ONE TEAM PER CHARACTER (Nate 2026-10-11; ↻ it used to
 * allow and mark). Keeps each character's first appearance in `keepOrder`
 * (team indexes, most-preferred first; teams it leaves out follow in board
 * order) and empties every other slot they hold. Slots keep their places, as
 * a removal does in the game. Pure: the store applies it.
 */
/** A team with new slots; its pin and its link drop if the set of characters
 *  changed. */
function withSlots(t: BoardTeam, slots: TeamSlot[]): BoardTeam {
	const sameTeam = teamKey(slots) === teamKey(t.slots);
	return { ...t, slots, ...(!sameTeam && { pinnedRotationId: undefined, teamId: undefined }) };
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

/** The slot of `slots` holding the same character as `id` (any Traveler for a
 *  Traveler), or -1. */
export const slotOfCharacter = (slots: readonly TeamSlot[], id: string): number =>
	slots.findIndex((s) => !!s && characterKey(s) === characterKey(id));

/** Under No repeats, the OTHER team of `board` that holds `id` — the team a
 *  pick for `teamId` takes them off FIRST (⚓ Nate 2026-10-18, the game's two
 *  clicks: the first frees them, the second places them). Undefined when the
 *  board allows repeats, or no other team holds them. */
export function heldElsewhere(
	board: Pick<Board, 'noRepeats' | 'teams'>,
	teamId: string,
	id: string
): BoardTeam | undefined {
	if (!board.noRepeats) return undefined;
	return board.teams.find((t) => t.id !== teamId && slotOfCharacter(t.slots, id) >= 0);
}

export function withoutRepeats(
	teams: readonly TeamSlot[][],
	keepOrder: readonly number[] = []
): TeamSlot[][] {
	const order = [...keepOrder, ...teams.map((_, i) => i).filter((i) => !keepOrder.includes(i))];
	// A plain array, not a Set: this is a pure function and nothing here is
	// state, so `svelte/prefer-svelte-reactivity`'s SvelteSet would be wrong.
	const seen: string[] = [];
	const out = teams.map((slots) => [...slots]);
	for (const t of order) {
		const slots = out[t];
		if (!slots) continue;
		slots.forEach((id, i) => {
			if (!id) return;
			if (seen.includes(characterKey(id))) slots[i] = null;
			else seen.push(characterKey(id));
		});
	}
	return out;
}

class BoardsState {
	/** ⚓ The cold start is the CURRENT Stygian Onslaught (§11.2): the tool at
	 *  its most useful, the mode most players come for. No `season` is stored, so
	 *  the board FOLLOWS the season (the Team Builder reads an unset season as
	 *  the current one) until its first edit pins it (§11.6 item 4). The
	 *  storage session replaces it with the profile's current lineup. */
	board = $state<Board>(makeBoard('Lineup 1', 'stygian'));
	/** ⚓ May this board be changed? False while another tab holds it
	 *  (rotationTabs.canEdit's rule). Set by the storage session. */
	canEdit: (id: string) => boolean = () => true;
	restored = $state(false);

	/** Show a stored board (`null` keeps the cold start) and mark the state
	 *  restored: the profile's current lineup, from the storage session
	 *  (build plan §13). */
	restoreFrom(stored: Board | null): void {
		if (stored) {
			this.board = {
				...stored,
				preset: stored.preset ?? 'custom',
				...(stored.preset === 'theater' && {
					theater: { ...stored.theater, cast: [...(stored.theater?.cast ?? [])] }
				}),
				teams: stored.teams.map((t) => ({ ...t, slots: normalizeSlots(t.slots ?? []) }))
			};
		}
		this.restored = true;
	}

	/** Hand the board to the storage session's sink. Reads every persisted
	 *  field; never writes $state. */
	persist(): void {
		const snapshot = this.board;
		if (!this.restored) return;
		this.persistSink?.(snapshot);
	}

	/** The store's sink (see `rotationTabs.persistSink`, the same rule). */
	persistSink: ((board: Board) => void) | null = null;

	// ── The board ───────────────────────────────────────────────────────────

	setSeason(id: string, season: string): void {
		this.#updateBoard(id, (b) => ({ ...b, season }));
	}

	/** Change a Theater lineup's plan: the fields given, the rest kept. */
	setTheater(id: string, plan: Partial<TheaterPlan>): void {
		this.#updateBoard(id, (b) =>
			b.preset === 'theater' ? { ...b, theater: { cast: [], ...b.theater, ...plan } } : b
		);
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
		if (!this.canEdit(id)) return;
		if (this.board.id === id) this.board = fn(this.board);
	}

	#updateTeam(boardId: string, teamId: string, fn: (t: BoardTeam) => BoardTeam): void {
		this.#updateBoard(boardId, (b) => ({
			...b,
			teams: b.teams.map((t) => (t.id === teamId ? fn(t) : t))
		}));
	}

	addTeam(boardId: string, slots?: TeamSlot[]): BoardTeam | undefined {
		const board = this.board.id === boardId ? this.board : undefined;
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

	/** Fill every slot at once — a team chosen from the library (§10.2), linked
	 *  to it when it is a saved team. Under No repeats its members leave any
	 *  other team. */
	setTeam(boardId: string, teamId: string, slots: TeamSlot[], savedTeamId?: string): void {
		this.#updateTeam(boardId, teamId, (t) => ({
			id: t.id,
			slots: normalizeSlots(slots),
			...(t.con && { con: t.con }),
			...(savedTeamId && { teamId: savedTeamId })
		}));
		this.#settleRepeats(
			boardId,
			teamId,
			slots.filter((s): s is string => !!s)
		);
	}

	/** The OTHER teams `id` sits on, when the board forbids repeats. */
	#teamsHolding(boardId: string, id: TeamSlot, exceptTeamId: string): string[] {
		const board = this.board.id === boardId ? this.board : undefined;
		if (!id || !board?.noRepeats) return [];
		return board.teams
			.filter((t) => t.id !== exceptTeamId && slotOfCharacter(t.slots, id) >= 0)
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
					t.id === keepTeamId
						? t.slots
						: t.slots.map((s) =>
								s && ids.some((id) => characterKey(id) === characterKey(s)) ? null : s
							)
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

	/** Empty every team on the board, keeping the teams themselves (the
	 *  Lineup's Clear; removing a team is the Custom board's ✕). A team's own
	 *  constellations and pin go with its members. */
	clearTeams(boardId: string): void {
		this.#updateBoard(boardId, (b) => ({
			...b,
			teams: b.teams.map((t) => ({ id: t.id, slots: emptySlots() }))
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
	const owned = strictOwnership();
	for (const id of team.slots) if (id) out[id] = effectiveCon(own, roster, id, owned);
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
		// ⚓ A Theater lineup is not shared (Nate 2026-11-11: it is one player's
		// roster), so the Builder offers no Share there; a call sends no cast.
		preset: board.preset === 'theater' ? 'custom' : board.preset,
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
