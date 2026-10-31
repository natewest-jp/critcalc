/**
 * src/lib/tabSet.ts
 *
 * The tab machinery the Planner's rotations and the Team Builder's boards
 * share (⚓ Nate 2026-10-08, lineups design §9.3 + §9.6a): ONE limit, ONE rule
 * for which tab makes room, ONE "Recently closed" list per kind of document.
 *
 * ⚓ CLOSING IS NEVER LOSS. Every tab that closes with something in it goes to
 * Recently closed, so the limit stops being a wall: reaching it means a tab
 * moves there, never that work disappears. That is what lets the limit sit at
 * a number chosen for DISPLAY (only the active rotation is ever parsed) rather
 * than for safety.
 *
 * Pure apart from the store factory's localStorage, so both tab states and the
 * tests read the same rules.
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { safeRemoveItem, safeSetItem } from '$lib/stores';

/** Open tabs per kind of document. ↻ 6 → 12 (2026-10-08): a board's linked
 *  teams each hold a rotation tab, and Stygian alone wants three. */
export const TAB_LIMIT = 12;

/** Recently closed keeps the newest this many; the oldest drops off. */
export const RECENTLY_CLOSED_CAP = 20;

/** What the room-making rule needs to know about a tab. */
export type ViewedTab = { id: string; viewedAt?: number };

/**
 * The tab to close when a new one needs room: the one VIEWED longest ago,
 * ⛔ never the one you are looking at. Null only when there is no other tab.
 * A tab with no `viewedAt` predates the field and counts as the oldest.
 *
 * ↻ 2026-10-08: a `locked` predicate (tabs a board team linked to) existed
 * for a few hours; links became DERIVED from the library (lineups design
 * §10.2), so no tab is ever off-limits.
 */
export function closeCandidate<T extends ViewedTab>(
	tabs: readonly T[],
	activeId: string
): T | null {
	let best: T | null = null;
	for (const t of tabs) {
		if (t.id === activeId) continue;
		if (!best || (t.viewedAt ?? 0) < (best.viewedAt ?? 0)) best = t;
	}
	return best;
}

/** A closed tab, kept so it can be reopened. `closedAt` orders the list. */
export type ClosedEntry<T> = { tab: T; closedAt: number };

/**
 * A persistent "Recently closed" list for one kind of tab. Newest first,
 * capped at {@link RECENTLY_CLOSED_CAP}. The caller decides what is worth
 * keeping (an empty tab is not, and nor is a saved one with no changes); this
 * only keeps it.
 */
export function createRecentlyClosed<T extends { id: string }>(key: string) {
	function load(): ClosedEntry<T>[] {
		if (!browser) return [];
		try {
			const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}
	const store = writable<ClosedEntry<T>[]>(load());
	const persist = (items: ClosedEntry<T>[]) => {
		if (browser) safeSetItem(key, JSON.stringify(items));
		return items;
	};
	return {
		subscribe: store.subscribe,
		/** Keep a tab. A tab closed twice (reopened, then closed again) keeps
		 *  ONE entry, its latest. */
		push(tab: T) {
			store.update((items) =>
				persist(
					[{ tab, closedAt: Date.now() }, ...items.filter((e) => e.tab.id !== tab.id)].slice(
						0,
						RECENTLY_CLOSED_CAP
					)
				)
			);
		},
		/** Forget one — it was reopened, saved, or deleted. */
		remove(id: string) {
			store.update((items) => persist(items.filter((e) => e.tab.id !== id)));
		},
		clear() {
			store.set([]);
			if (browser) safeRemoveItem(key);
		}
	};
}

/**
 * What the old layout's tab strip needed from a kind of document — so
 * the Planner's rotations and the Team Builder's boards share ONE strip, in
 * the same grammar (⚓ Nate §2.2: "so people already know how they behave").
 * Implementations expose `tabs`/`activeId` as getters over their own state.
 */
export type TabStripModel = {
	readonly tabs: readonly { id: string; label: string }[];
	readonly activeId: string;
	/** Screen-reader name of the + control. */
	readonly newLabel: string;
	switchTo(id: string): void;
	/** Close — keeping the tab in its Recently closed. */
	close(id: string): void;
	rename(id: string, label: string): void;
	reorder(fromId: string, toId: string, side: 'left' | 'right'): void;
	/** The + control. A model offering choices (board presets) leaves this out
	 *  and hands the strip a `newItems` menu instead. */
	addNew?(): void;
};
