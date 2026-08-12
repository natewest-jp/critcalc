/**
 * src/lib/rotationTabs.svelte.ts
 *
 * The planner's tab model, hoisted to a shared module — THE working team
 * (bench-band unification, 2026-08-05). Team composition exists ONCE: it is
 * the active rotation tab's team. The Rotation Planner reads and writes it as
 * its tab state; the Team Builder edits the same slots directly; the shared
 * bench band displays it in both tools and writes Layer-2 overrides
 * (tabCon/tabLoadout) wherever it is. The old `?team=` cross-injection
 * mechanism is retired — deep links now open a tab with the team via
 * importTeam(), in either tool.
 *
 * Layer discipline (unchanged in shape, re-routed at the bench):
 *   Layer 1 = the roster (`constellations`/`loadout` stores) — edited in the
 *             TB roster grid + Detail card only.
 *   Layer 2 = the active tab (`tabCon`/`tabLoadout` here) — edited by the
 *             bench band in BOTH tools. The bench is the plan's team editor
 *             everywhere; it never marks ownership.
 *
 * SSR/hydration safety: the module initializes the same deterministic default
 * on server and client (one empty tab); localStorage state is restored by the
 * tools layout's onMount (pre-paint). Persistence is an $effect in the tools
 * layout too — it must run for EVERY tool, since the TB edits this state while
 * the planner page is unmounted. Nothing here reads a store or the DOM, and
 * SSR only ever reads this state, so module-level state is safe under
 * prerendering.
 */

import { browser } from '$app/environment';
import { getIndexEntryByDisplayName } from '$lib/data/characterLookup';
import type { LoadoutEntry } from '$lib/stores';

export type RotationTab = {
	id: string;
	label: string;
	notation: string;
	manualSlots: string[] | null;
	tabLoadout?: Record<string, LoadoutEntry>;
	/** Per-tab constellation overrides (Layer 2), parallel to tabLoadout. */
	tabCon?: Record<string, number>;
	savedId?: string;
};

export const TAB_LIMIT = 6;
export const TABS_KEY = 'critcalc:rotationTabs';

/**
 * Notation → the four slot ids it implies: the first four distinct character
 * names in segment order, padded with 'blank'.
 *
 * ⚠ ONE COPY, and it is here because two already existed. `autoSlots` below is
 * a $derived over the ACTIVE tab, and prewarmPlanner.ts hand-rolled a mirror of
 * it to run before this store is restored — its comment said as much ("mirroring
 * the planner's autoSlots"). Warming the OTHER open tabs needed the same
 * resolution a third time, which is where a mirror stops being a shortcut. Both
 * callers now share this; it is a pure string → string[] with no runes, so the
 * pre-restore caller can use it as freely as the reactive one.
 */
export function slotsFromNotation(notation: string): string[] {
	const seen: string[] = [];
	for (const segment of notation.split('>')) {
		const words = segment.trim().split(/\s+/).filter(Boolean);
		if (words.length === 0) continue;
		// Try longest multi-word prefix first so names like "Hu Tao" resolve
		// before a bare "Hu" would. Cap at 3 words — no canonical name is longer.
		let char = null;
		for (let k = Math.min(3, words.length); k >= 1; k--) {
			char = getIndexEntryByDisplayName(words.slice(0, k).join(' '));
			if (char) break;
		}
		if (char && !seen.includes(char.id)) seen.push(char.id);
		if (seen.length === 4) break;
	}
	while (seen.length < 4) seen.push('blank');
	return seen;
}

/** The character ids a tab actually needs loaded — its manual override if it has
 *  one, else what its notation implies. 'blank' is not a character. */
export function tabCharacterIds(tab: Pick<RotationTab, 'notation' | 'manualSlots'>): string[] {
	const slots = tab.manualSlots ?? slotsFromNotation(tab.notation ?? '');
	return slots.filter((id) => id && id !== 'blank');
}

function genId(): string {
	return Math.random().toString(36).slice(2, 10);
}

function makeTab(label: string): RotationTab {
	return { id: genId(), label, notation: '', manualSlots: null };
}

function loadFromStorage(): { tabs: RotationTab[]; activeTabId: string } | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(TABS_KEY);
		if (!raw) return null;
		const data = JSON.parse(raw);
		if (!Array.isArray(data.tabs) || data.tabs.length === 0 || !data.activeTabId) return null;
		return data;
	} catch {
		return null;
	}
}

class RotationTabsState {
	// Server and client both initialize to the same deterministic default (one
	// empty tab) so SSR markup and the hydrating component always agree. Real
	// localStorage state is restored via restore() — called from the tools
	// layout's onMount, after hydration, before the next paint.
	tabs = $state<RotationTab[]>([makeTab('Tab 1')]);
	activeTabId = $state<string>(this.tabs[0].id);

	// Live working state — kept separate from the tabs array so bind:notation
	// on RotationTimeline works cleanly without circular reactivity.
	notation = $state<string>('');
	manualSlots = $state<string[] | null>(null);
	tabLoadout = $state<Record<string, LoadoutEntry>>({});
	tabCon = $state<Record<string, number>>({});

	/** Flips true once restore() has run. Gates the persist effect so the
	 *  pre-restore default state can never clobber saved tabs. */
	restored = $state(false);

	/** Slots inferred from the notation: first four distinct character names in
	 *  segment order, padded with 'blank'. */
	autoSlots = $derived(slotsFromNotation(this.notation));

	/** THE working team: manual override if set, else notation-derived.
	 *  Always 4 entries; 'blank' = empty slot. */
	slots = $derived(this.manualSlots ?? this.autoSlots);

	get activeTab(): RotationTab {
		return this.tabs.find((t) => t.id === this.activeTabId) ?? this.tabs[0];
	}

	/** Restore saved tabs from localStorage. Idempotent; call once, pre-paint. */
	restore(): void {
		const stored = loadFromStorage();
		if (stored) {
			const activeId = stored.tabs.some((t) => t.id === stored.activeTabId)
				? stored.activeTabId
				: stored.tabs[0].id;
			const active = stored.tabs.find((t) => t.id === activeId) ?? stored.tabs[0];
			this.tabs = stored.tabs;
			this.activeTabId = activeId;
			this.notation = active.notation;
			this.manualSlots = active.manualSlots;
			this.tabLoadout = active.tabLoadout ?? {};
			this.tabCon = active.tabCon ?? {};
		}
		this.restored = true;
	}

	/** Write the current state to localStorage. Reads every persisted field, so
	 *  an $effect wrapping this call tracks all of them. Never writes $state —
	 *  no circular reactivity. */
	persist(): void {
		const snapshot = this.tabs.map((t) =>
			t.id === this.activeTabId
				? {
						...t,
						notation: this.notation,
						manualSlots: this.manualSlots,
						tabLoadout: this.tabLoadout,
						tabCon: this.tabCon
					}
				: t
		);
		if (!this.restored) return;
		localStorage.setItem(
			TABS_KEY,
			JSON.stringify({ tabs: snapshot, activeTabId: this.activeTabId })
		);
	}

	/** Flush live working state back into the tabs array before any switch. */
	flush(): void {
		this.tabs = this.tabs.map((t) =>
			t.id === this.activeTabId
				? {
						...t,
						notation: this.notation,
						manualSlots: this.manualSlots,
						tabLoadout: this.tabLoadout,
						tabCon: this.tabCon
					}
				: t
		);
	}

	private loadWorkingState(tab: RotationTab): void {
		this.notation = tab.notation;
		this.manualSlots = tab.manualSlots;
		this.tabLoadout = tab.tabLoadout ?? {};
		this.tabCon = tab.tabCon ?? {};
	}

	/** Switching tabs switches the working team — site-wide. */
	switchTab(id: string): void {
		if (id === this.activeTabId) return;
		this.flush();
		this.activeTabId = id;
		const tab = this.tabs.find((t) => t.id === id);
		if (tab) this.loadWorkingState(tab);
	}

	addTab(): void {
		if (this.tabs.length >= TAB_LIMIT) return;
		this.flush();
		const newTab = makeTab(`Tab ${this.tabs.length + 1}`);
		this.tabs = [...this.tabs, newTab];
		this.activeTabId = newTab.id;
		this.loadWorkingState(newTab);
	}

	/** Open a new tab from a snapshot (a saved entry, a shared rotation) and
	 *  make it active. No-op at the tab limit — callers gate on TAB_LIMIT. */
	openTab(partial: Omit<RotationTab, 'id'>): void {
		if (this.tabs.length >= TAB_LIMIT) return;
		this.flush();
		const newTab: RotationTab = { ...partial, id: genId() };
		this.tabs = [...this.tabs, newTab];
		this.activeTabId = newTab.id;
		this.loadWorkingState(newTab);
	}

	closeTab(id: string): void {
		if (this.tabs.length <= 1) return;
		this.flush();
		const idx = this.tabs.findIndex((t) => t.id === id);
		const wasActive = id === this.activeTabId;
		this.tabs = this.tabs.filter((t) => t.id !== id);
		if (wasActive) {
			const next = this.tabs[Math.min(idx, this.tabs.length - 1)];
			this.activeTabId = next.id;
			this.loadWorkingState(next);
		}
	}

	/** Rename a tab. Returns the tab (pre-rename) so the caller can propagate
	 *  to the save bank when it's linked. */
	renameTab(id: string, label: string): RotationTab | undefined {
		const trimmed = label.trim();
		if (!trimmed) return undefined;
		const tab = this.tabs.find((t) => t.id === id);
		this.tabs = this.tabs.map((t) => (t.id === id ? { ...t, label: trimmed } : t));
		return tab;
	}

	reorderTabs(fromId: string, toId: string, side: 'left' | 'right'): void {
		if (fromId === toId) return;
		this.flush();
		const arr = [...this.tabs];
		const fromIdx = arr.findIndex((t) => t.id === fromId);
		const [dragged] = arr.splice(fromIdx, 1);
		const toIdx = arr.findIndex((t) => t.id === toId);
		arr.splice(side === 'left' ? toIdx : toIdx + 1, 0, dragged);
		this.tabs = arr;
	}

	resetActiveTab(): void {
		this.notation = '';
		this.manualSlots = null;
		this.tabLoadout = {};
		this.tabCon = {};
		this.tabs = this.tabs.map((t, i) =>
			t.id === this.activeTabId
				? {
						...t,
						label: `Tab ${i + 1}`,
						notation: '',
						manualSlots: null,
						tabLoadout: {},
						tabCon: {},
						savedId: undefined
					}
				: t
		);
	}

	resetAll(): void {
		const first = makeTab('Tab 1');
		this.tabs = [first];
		this.activeTabId = first.id;
		this.loadWorkingState(first);
	}

	// -------------------------------------------------------------------------
	// Composition writes (the Team Builder + the bench band)
	// -------------------------------------------------------------------------

	/** Set one slot of the working team. Materializes the notation-derived
	 *  slots into an explicit manual override first — the same rule the
	 *  planner's picker applies. `null`/'blank' empties the slot. */
	setSlot(index: number, id: string | null): void {
		const next = [...this.slots];
		next[index] = id ?? 'blank';
		this.manualSlots = next;
	}

	/** Add to the first empty slot (no-op when full or already present). */
	addToTeam(id: string): void {
		if (this.slots.includes(id)) return;
		const empty = this.slots.indexOf('blank');
		if (empty >= 0) this.setSlot(empty, id);
	}

	/** Remove a character wherever it sits. */
	removeFromTeam(id: string): void {
		const at = this.slots.indexOf(id);
		if (at >= 0) this.setSlot(at, null);
	}

	/** Empty every slot (an explicit override — the notation may still name
	 *  characters, and clearing must win over re-inference). */
	clearTeam(): void {
		this.manualSlots = ['blank', 'blank', 'blank', 'blank'];
	}

	// -------------------------------------------------------------------------
	// Layer-2 writes (the bench band, both tools)
	// -------------------------------------------------------------------------

	setTabCon(charId: string, level: number): void {
		this.tabCon = { ...this.tabCon, [charId]: level };
	}

	setTabLoadout(charId: string, update: Partial<LoadoutEntry>): void {
		this.tabLoadout = {
			...this.tabLoadout,
			[charId]: { ...(this.tabLoadout[charId] ?? {}), ...update }
		};
	}

	// -------------------------------------------------------------------------
	// Team import (deep links: ?team= on either tool)
	// -------------------------------------------------------------------------

	/** Import a team by ids: reuse a pristine first tab (or the active tab at
	 *  the limit), else open a new tab. Returns whether a tab was replaced. */
	importTeam(ids: string[], label = 'Imported team'): { replacedTab: boolean } {
		const team = [...ids];
		while (team.length < 4) team.push('blank');
		const active = this.activeTab;
		const pristine = this.tabs.length === 1 && !active.notation.trim() && !active.savedId;
		const atLimit = this.tabs.length >= TAB_LIMIT;
		if (pristine || atLimit) {
			this.tabs = this.tabs.map((t) =>
				t.id === this.activeTabId ? { ...t, label, savedId: undefined } : t
			);
		} else {
			this.flush();
			const newTab: RotationTab = { id: genId(), label, notation: '', manualSlots: team };
			this.tabs = [...this.tabs, newTab];
			this.activeTabId = newTab.id;
		}
		this.notation = '';
		this.manualSlots = team;
		this.tabLoadout = {};
		this.tabCon = {};
		return { replacedTab: atLimit && !pristine };
	}
}

export const rotationTabs = new RotationTabsState();
