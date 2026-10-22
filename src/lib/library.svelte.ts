/**
 * src/lib/library.svelte.ts
 *
 * THE LIBRARY's state and flows (lineups design §10.1a; build step 4) — the
 * overlay opened by Load in either tool. The model (grouping, tags) is
 * `library.ts`; this file is what a click DOES.
 *
 * ⚓ THE STRIP IS THE BUTTON, and its meaning is "use this HERE": opened from
 * the Planner, a rotation opens in a new tab and a team opens a names-only tab;
 * opened from the Builder, both put the team on the board (a rotation PINNED),
 * on the selected team if there is one. A board always opens in the Builder.
 * The Builder says where "here" is by registering a TARGET while it is mounted
 * (the exporters idiom in documentBar), so this module never imports a page.
 *
 * ⚓ AS ITS OWN PAGE (`/library`, 2026-10-18) the same flows run with no tool
 * mounted — `atPage()` — and every pick goes to its document's home.
 *
 * ⚓ Back closes it (Nate 2026-10-08): opening pushes a shallow history entry
 * (`page.state.library`) and the tools layout closes the overlay when that
 * state goes away.
 */

import { get } from 'svelte/store';
import { goto, pushState } from '$app/navigation';
import { page } from '$app/state';
import { resolve } from '$app/paths';
import {
	constellations,
	ownership,
	savedBoards,
	savedNotations,
	type SavedBoard,
	type SavedNotation
} from './stores';
import { documentBar, recentlyClosedRotations } from './documentBar.svelte';
import { boardBar } from './boardBar.svelte';
import { fromSavedTeams, makeBoard, recentlyClosedBoards, type Board } from './boards.svelte';
import { newTabId, rotationTabs as rt, type RotationTab } from './rotationTabs.svelte';
import { seatsOfSaved } from './utils/notationEdit';
import { encodeRotation } from './utils/rotationUrl';
import { encodeBoard } from './utils/boardUrl';
import { teamNotation, type LibraryTeam } from './library';

export type LibraryFrom = 'planner' | 'builder';
/** ⚓ The Library's two tabs (lineups design §11.6 items 1, 7, 17): the saved
 *  teams and boards, and the ROSTER — the one place the roster is edited. */
export type LibraryTab = 'teams' | 'roster';

/** Where a pick lands when the library was opened from the Builder. */
export type LibraryTarget = {
	/** The selected team's name ("Team 2"), or null — a pick then lands on the
	 *  first empty team, else a new one. */
	readonly selectedLabel: string | null;
	place(slots: string[], pinnedRotationId?: string): void;
};

class LibraryState {
	open = $state(false);
	from = $state<LibraryFrom>('planner');
	tab = $state<LibraryTab>('teams');
	/** The character the Roster tab should scroll to and flash when it opens
	 *  (a details card's "Edit in Roster"). Read once by the tab, then cleared. */
	rosterFocus = $state<string | null>(null);
	/** Opened from a page that is neither tool (the Visualizers, via the
	 *  chrome's Roster button): a Teams pick acts as the Planner's and then
	 *  goes there, since nothing on this page would show it. */
	#away = false;
	/** The overlay's own outcome line (band A's notice is behind it). */
	toast = $state<string | null>(null);
	#toastTimer: ReturnType<typeof setTimeout> | undefined;
	#target = $state<LibraryTarget | null>(null);

	get target(): LibraryTarget | null {
		return this.#target;
	}

	/** The Builder registers its target while mounted; the cleanup clears it
	 *  only if it is still ours (both pages are briefly alive during a pan). */
	registerTarget(t: LibraryTarget): () => void {
		this.#target = t;
		return () => {
			if (this.#target === t) this.#target = null;
		};
	}

	show(from: LibraryFrom, tab: LibraryTab = 'teams') {
		this.from = from;
		this.tab = tab;
		this.#away = false;
		if (this.open) return;
		this.open = true;
		pushState('', { ...page.state, library: true });
	}

	/** The chrome's Roster button and a details card's link: the Library on its
	 *  Roster tab, from whichever page we are on, optionally arriving on one
	 *  character. Already open, it just switches tab. */
	openRoster(focusId: string | null = null) {
		const path = page.url.pathname;
		const builder = path.startsWith(resolve('/builder'));
		this.show(builder ? 'builder' : 'planner', 'roster');
		this.#away = !builder && !path.startsWith(resolve('/planner'));
		this.rosterFocus = focusId;
	}

	/** True when no tool is here to take a Planner pick (the `/library` page,
	 *  or the overlay over the Visualizers): the pick then goes to the Planner. */
	get away(): boolean {
		return this.#away;
	}

	/**
	 * THE `/library` PAGE (lineups design §10.1a: "as its own page, each goes to
	 * its document's HOME — rotations → the Planner, boards → the Builder").
	 * No tool is mounted there, so the flows run in their elsewhere mode: a
	 * rotation or team acts as the Planner's and then goes to the Planner, a
	 * board goes to the Builder. ⚠ The page must have RESTORED the documents
	 * first (rotationTabs/boards) — a pick written into the pre-restore default
	 * would be overwritten when the tools layout restores on arrival.
	 */
	atPage(tab: LibraryTab) {
		this.open = false;
		this.from = 'planner';
		this.#away = true;
		this.tab = tab;
	}

	/** A Planner pick made from neither tool: carry it out, then go there. */
	#followToPlanner() {
		if (this.#away) void goto(resolve('/planner'));
	}

	/** Close. `navigating`: the caller is about to `goto` elsewhere, so the
	 *  library's history entry is dropped here rather than popped (a pop and a
	 *  goto would race). */
	close(navigating = false) {
		if (!this.open) return;
		this.open = false;
		if (page.state.library && !navigating) history.back();
	}

	say(msg: string) {
		clearTimeout(this.#toastTimer);
		this.toast = msg;
		this.#toastTimer = setTimeout(() => (this.toast = null), 2200);
	}

	// ── What a click does ─────────────────────────────────────────────────

	/** Where the Builder will put a pick, in words (the hover hint). */
	get builderHere(): string | null {
		return this.#target?.selectedLabel ?? null;
	}

	openRotation(e: SavedNotation) {
		if (this.from === 'builder' && this.#target) {
			this.#target.place(seatedIds(e), e.id);
			this.close();
			return;
		}
		this.close(this.#away);
		documentBar.loadNewTab(e);
		this.#followToPlanner();
	}

	openTeam(t: LibraryTeam) {
		if (this.from === 'builder' && this.#target) {
			this.#target.place(t.slots);
			this.close();
			return;
		}
		this.close(this.#away);
		// ⚓ A nicknamed team names its tab, so saving it later names the
		// rotation for free (Nate 2026-10-09).
		documentBar.receive(
			rt.teamDocument(t.slots, t.nickname ?? `Tab ${rt.tabs.length + 1}`),
			'Team opened'
		);
		this.#followToPlanner();
	}

	openBoard(b: SavedBoard) {
		const elsewhere = this.from !== 'builder';
		this.close(elsewhere);
		boardBar.openSaved(b);
		if (elsewhere) void goto(resolve('/builder'));
	}

	reopenRotation(tab: RotationTab) {
		const elsewhere = this.from !== 'planner' || this.#away;
		this.close(elsewhere);
		documentBar.reopen(tab);
		if (elsewhere) void goto(resolve('/planner'));
	}

	reopenBoard(board: Board) {
		const elsewhere = this.from !== 'builder';
		this.close(elsewhere);
		boardBar.reopen(board);
		if (elsewhere) void goto(resolve('/builder'));
	}

	/** The rotation's other tool: from the Builder, open it in the Planner;
	 *  from the Planner, put its team on the Builder's active board. */
	openRotationElsewhere(e: SavedNotation) {
		if (this.from === 'builder') {
			this.close(true);
			documentBar.loadNewTab(e);
			void goto(resolve('/planner'));
		} else {
			this.close(true);
			boardBar.receiveTeam(seatedIds(e));
			void goto(resolve('/builder'));
		}
	}

	/** "Put on a board" from the Planner: the team onto the Builder's active
	 *  board. */
	putTeamOnBoard(t: LibraryTeam) {
		this.close(true);
		boardBar.receiveTeam(t.slots);
		void goto(resolve('/builder'));
	}

	// ── Editing the library ───────────────────────────────────────────────

	renameRotation(e: SavedNotation, name: string) {
		const trimmed = name.trim();
		if (!trimmed) return;
		savedNotations.rename(e.id, trimmed);
		// An open tab linked to it carries the entry's name as its label.
		for (const tab of rt.tabs) if (tab.savedId === e.id) rt.renameTab(tab.id, trimmed);
	}

	/** Set a team's nickname ('' clears it). A team with no entry yet gets one. */
	setNickname(t: LibraryTeam, name: string) {
		const trimmed = name.trim();
		if (t.entry) savedNotations.rename(t.entry.id, trimmed);
		else savedNotations.save({ name: trimmed, notation: teamNotation(t.slots), tabCon: {} });
	}

	renameBoard(b: SavedBoard, name: string) {
		const trimmed = name.trim();
		if (!trimmed) return;
		savedBoards.rename(b.id, trimmed);
		boardBar.renameLinked(b.id, trimmed);
	}

	/** ⚓ One confirm (asked by the overlay), and the rotation goes to Recently
	 *  closed, so a delete is never loss (Nate 2026-10-08). */
	deleteRotation(e: SavedNotation) {
		savedNotations.delete(e.id);
		recentlyClosedRotations.push(closedFromEntry(e));
	}

	/** The team and every rotation filed under it; the rotations go to Recently
	 *  closed. Boards that use the team keep their characters. */
	deleteTeam(t: LibraryTeam) {
		for (const r of [...t.rotations].reverse()) this.deleteRotation(r);
		if (t.entry) savedNotations.delete(t.entry.id);
	}

	deleteBoard(b: SavedBoard) {
		savedBoards.delete(b.id);
		recentlyClosedBoards.push({
			...makeBoard(b.name, b.preset),
			...(b.season && { season: b.season }),
			teams: fromSavedTeams(b.teams),
			noRepeats: b.noRepeats
		});
	}

	saveClosedRotation(tab: RotationTab) {
		documentBar.saveClosed(tab);
		this.say('Saved');
	}

	saveClosedBoard(board: Board) {
		boardBar.saveClosed(board);
		this.say('Saved');
	}

	/**
	 * ⚓ Sync a saved rotation to the roster (§10.4; one confirm, asked by the
	 * overlay): every character you OWN loses its stored level and follows the
	 * roster from now on; one you do not own keeps its level. Open tabs linked
	 * to it follow.
	 */
	syncRotation(e: SavedNotation) {
		const owned = Object.entries(get(ownership))
			.filter(([, m]) => m === 'owned')
			.map(([id]) => id);
		const tabCon = Object.fromEntries(
			Object.entries(e.tabCon ?? {}).filter(([id]) => !owned.includes(id))
		);
		savedNotations.update(e.id, { tabCon, synced: true });
		rt.applySync(e.id, owned);
		this.say('Synced');
	}

	// ── Sharing ───────────────────────────────────────────────────────────

	/** A saved rotation's link: its own levels (a synced one's owned members
	 *  read from the roster, so EVERY level travels — §9.5) and loadouts. */
	async shareRotation(e: SavedNotation) {
		const roster = get(constellations);
		const levels: Record<string, number> = {};
		const slots = seatsOfSaved(e);
		for (const id of slots) if (id) levels[id] = e.tabCon?.[id] ?? roster[id] ?? 0;
		try {
			const param = await encodeRotation({
				notation: e.notation,
				slots,
				constellations: levels,
				loadout: e.tabLoadout ?? {}
			});
			await navigator.clipboard.writeText(`${location.origin}/planner?r=${param}`);
			this.say('Link copied');
		} catch {
			this.say('Share failed');
		}
	}

	async shareBoard(b: SavedBoard) {
		try {
			const param = await encodeBoard({
				label: b.name,
				noRepeats: b.noRepeats,
				teams: b.teams.map((t) => ({ slots: t.slots, constellations: t.con ?? {} }))
			});
			await navigator.clipboard.writeText(`${location.origin}/builder?b=${param}`);
			this.say('Link copied');
		} catch {
			this.say('Share failed');
		}
	}
}

/** A saved entry's seated team, in slot order (§8.1). */
function seatedIds(e: SavedNotation): string[] {
	return seatsOfSaved(e).filter((id): id is string => !!id);
}

/** A deleted entry, as a Recently closed tab (no longer linked to anything). */
function closedFromEntry(e: SavedNotation): RotationTab {
	return {
		id: newTabId(),
		label: e.name,
		notation: e.notation,
		slots: seatsOfSaved(e),
		tabCon: e.tabCon ?? {},
		tabLoadout: e.tabLoadout ?? {}
	};
}

export const library = new LibraryState();
