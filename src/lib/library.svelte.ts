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
import { foldTeamIntoNotation, orderedCharacterIds } from './utils/notationEdit';
import { encodeRotation } from './utils/rotationUrl';
import { encodeBoard } from './utils/boardUrl';
import { teamNotation, type LibraryTeam } from './library';

export type LibraryFrom = 'planner' | 'builder';

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

	show(from: LibraryFrom) {
		this.from = from;
		this.open = true;
		pushState('', { ...page.state, library: true });
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
			this.#target.place(slotsFromNotationIds(e.notation), e.id);
			this.close();
			return;
		}
		this.close();
		documentBar.loadNewTab(e);
	}

	openTeam(t: LibraryTeam) {
		if (this.from === 'builder' && this.#target) {
			this.#target.place(t.slots);
			this.close();
			return;
		}
		this.close();
		// ⚓ A nicknamed team names its tab, so saving it later names the
		// rotation for free (Nate 2026-10-09).
		documentBar.receive(
			rt.teamDocument(t.slots, t.nickname ?? `Tab ${rt.tabs.length + 1}`),
			'Team opened'
		);
	}

	openBoard(b: SavedBoard) {
		const elsewhere = this.from !== 'builder';
		this.close(elsewhere);
		boardBar.openSaved(b);
		if (elsewhere) void goto(resolve('/team-builder'));
	}

	reopenRotation(tab: RotationTab) {
		const elsewhere = this.from !== 'planner';
		this.close(elsewhere);
		documentBar.reopen(tab);
		if (elsewhere) void goto(resolve('/rotation-planner'));
	}

	reopenBoard(board: Board) {
		const elsewhere = this.from !== 'builder';
		this.close(elsewhere);
		boardBar.reopen(board);
		if (elsewhere) void goto(resolve('/team-builder'));
	}

	/** The rotation's other tool: from the Builder, open it in the Planner;
	 *  from the Planner, put its team on the Builder's active board. */
	openRotationElsewhere(e: SavedNotation) {
		if (this.from === 'builder') {
			this.close(true);
			documentBar.loadNewTab(e);
			void goto(resolve('/rotation-planner'));
		} else {
			this.close(true);
			boardBar.receiveTeam(slotsFromNotationIds(e.notation));
			void goto(resolve('/team-builder'));
		}
	}

	/** "Put on a board" from the Planner: the team onto the Builder's active
	 *  board. */
	putTeamOnBoard(t: LibraryTeam) {
		this.close(true);
		boardBar.receiveTeam(t.slots);
		void goto(resolve('/team-builder'));
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
		for (const id of orderedCharacterIds(e.notation).slice(0, 4))
			levels[id] = e.tabCon?.[id] ?? roster[id] ?? 0;
		try {
			const param = await encodeRotation({
				notation: foldTeamIntoNotation(e.notation, e.manualSlots),
				constellations: levels,
				loadout: e.tabLoadout ?? {}
			});
			await navigator.clipboard.writeText(`${location.origin}/rotation-planner?r=${param}`);
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
			await navigator.clipboard.writeText(`${location.origin}/team-builder?b=${param}`);
			this.say('Link copied');
		} catch {
			this.say('Share failed');
		}
	}
}

/** The first four distinct ids a notation names. */
function slotsFromNotationIds(notation: string): string[] {
	return orderedCharacterIds(notation).slice(0, 4);
}

/** A deleted entry, as a Recently closed tab (no longer linked to anything). */
function closedFromEntry(e: SavedNotation): RotationTab {
	return {
		id: newTabId(),
		label: e.name,
		notation: foldTeamIntoNotation(e.notation, e.manualSlots),
		tabCon: e.tabCon ?? {},
		tabLoadout: e.tabLoadout ?? {}
	};
}

export const library = new LibraryState();
