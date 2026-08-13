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
 * ══ THE NOTATION IS THE SINGLE SOURCE OF TRUTH (⚓ NATE 2026-08-13) ═══════════
 *
 * `manualSlots` is RETIRED. The team was `manualSlots ?? autoSlots` — two
 * sources of truth for one fact — and every bug in the area was the two
 * disagreeing: one bench ✕ materialized a manual override and killed notation
 * inference for the whole tab (type a character who was never involved and they
 * would not slot either), while a character the notation named but the manual
 * slots did not got a full parsed track and no lane to draw it in.
 *
 * So the team is DERIVED, always: the first four distinct characters the
 * notation names, in segment order. Every team edit is therefore a TEXT edit —
 * a swap renames that character's segments, ✕ deletes them, adding somebody
 * appends a bare-name segment (see notationEdit.ts, which owns the rewrites).
 * ⚠ The cost, taken knowingly: slot ORDER is notation order, so you cannot fill
 * slot 3 while 1–2 are empty. Nate traded reordering away for the tool and the
 * text agreeing, and has a separate idea for reordering.
 *
 * The gain that pays for it is undo. Because the slot is derived from the text,
 * undoing the text restores the slot by itself — there is no separate
 * slot-restore path, and ⌘Z in the notation box reaches a ✕ pressed on the
 * bench (see RotationTimeline's editor handle for the routing that makes the
 * store's write land as a CodeMirror transaction).
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
import {
	appendCharacterToNotation,
	deleteCharacterFromNotation,
	foldTeamIntoNotation,
	orderedCharacterIds,
	renameCharacterInNotation
} from '$lib/utils/notationEdit';
import type { LoadoutEntry } from '$lib/stores';

export type RotationTab = {
	id: string;
	label: string;
	notation: string;
	tabLoadout?: Record<string, LoadoutEntry>;
	/** Per-tab constellation overrides (Layer 2), parallel to tabLoadout. */
	tabCon?: Record<string, number>;
	savedId?: string;
};

/**
 * What a pre-single-truth tab carried alongside its notation. Never written
 * again; read once, at the boundary where old state arrives (localStorage
 * restore, a saved-bank entry, a settings backup), and folded into the notation
 * by {@link foldTeamIntoNotation}. ⚓ Nate 2026-08-13: no backwards
 * compatibility is REQUIRED — nobody but him has used the site — so this is a
 * courtesy to his own open tabs, not a contract.
 */
export type LegacyTeam = { manualSlots?: string[] | null };

export const TAB_LIMIT = 6;
export const TABS_KEY = 'critcalc:rotationTabs';

/** How many characters a team holds. */
export const TEAM_SIZE = 4;

/**
 * Notation → the four slot ids it implies: the first four distinct character
 * names in segment order, padded with 'blank'. THE team, since single truth.
 *
 * ⚠ ONE COPY, and it is here because two already existed (prewarmPlanner
 * hand-rolled a mirror to run before this store is restored). It is a pure
 * string → string[] with no runes, so the pre-restore caller can use it as
 * freely as the reactive one.
 *
 * ↻ 2026-08-13: resolution moved to the TOKENIZER (notationEdit.orderedCharacterIds)
 * from a word-prefix scan of `notation.split('>')`. The two agreed on every
 * ordinary rotation and disagreed at the edges — and the parser resolves the
 * tokenizer's `character` token, so the scan was the odd one out. A slot
 * derivation that can disagree with the parser is the exact shape of the bug
 * this round is removing.
 */
export function slotsFromNotation(notation: string): string[] {
	const seen = orderedCharacterIds(notation ?? '').slice(0, TEAM_SIZE);
	while (seen.length < TEAM_SIZE) seen.push('blank');
	return seen;
}

/** The character ids a tab actually needs loaded. 'blank' is not a character.
 *  Still tolerates a legacy `manualSlots`: the planner's navigation-start
 *  prewarm reads RAW localStorage, before restore() has migrated anything. */
export function tabCharacterIds(tab: Pick<RotationTab, 'notation'> & LegacyTeam): string[] {
	// A plain array scan, not a Set: the list is four-ish entries and nothing
	// here is state — `svelte/prefer-svelte-reactivity` would rather see a
	// SvelteSet, which would be wrong for a pure function (documentBar.copyName
	// makes the same call for the same reason).
	const ids: string[] = [];
	for (const id of [...slotsFromNotation(tab.notation ?? ''), ...(tab.manualSlots ?? [])]) {
		if (id && id !== 'blank' && !ids.includes(id)) ids.push(id);
	}
	return ids;
}

function genId(): string {
	return Math.random().toString(36).slice(2, 10);
}

function makeTab(label: string): RotationTab {
	return { id: genId(), label, notation: '' };
}

/** Strip a restored tab of its retired field, folding whatever team it carried
 *  into the notation first. See {@link LegacyTeam}. */
function migrateTab(tab: RotationTab & LegacyTeam): RotationTab {
	const { manualSlots, ...rest } = tab;
	if (!manualSlots) return rest;
	return { ...rest, notation: foldTeamIntoNotation(rest.notation ?? '', manualSlots) };
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
	tabLoadout = $state<Record<string, LoadoutEntry>>({});
	tabCon = $state<Record<string, number>>({});

	/** Flips true once restore() has run. Gates the persist effect so the
	 *  pre-restore default state can never clobber saved tabs. */
	restored = $state(false);

	/** THE working team, derived from the notation and nothing else: the first
	 *  four distinct character names in segment order, padded with 'blank'.
	 *  ⛔ There is no override to consult any more — see the module header. */
	slots = $derived(slotsFromNotation(this.notation));

	get activeTab(): RotationTab {
		return this.tabs.find((t) => t.id === this.activeTabId) ?? this.tabs[0];
	}

	/** Restore saved tabs from localStorage. Idempotent; call once, pre-paint. */
	restore(): void {
		const stored = loadFromStorage();
		if (stored) {
			// Migrate at the boundary — every tab that still carries a retired
			// `manualSlots` has its team folded into its notation here, once, and
			// nothing downstream ever sees the field again.
			const tabs = stored.tabs.map(migrateTab);
			const activeId = tabs.some((t) => t.id === stored.activeTabId)
				? stored.activeTabId
				: tabs[0].id;
			const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
			this.tabs = tabs;
			this.activeTabId = activeId;
			this.notation = active.notation;
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
						tabLoadout: this.tabLoadout,
						tabCon: this.tabCon
					}
				: t
		);
	}

	private loadWorkingState(tab: RotationTab): void {
		this.notation = tab.notation;
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
		this.tabLoadout = {};
		this.tabCon = {};
		this.tabs = this.tabs.map((t, i) =>
			t.id === this.activeTabId
				? {
						...t,
						label: `Tab ${i + 1}`,
						notation: '',
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
	//
	// ⚠ EVERY ONE OF THESE IS A TEXT EDIT NOW. They read like slot operations
	// because that is what the callers have — a bench index, a candidate id —
	// but each resolves to a rewrite of the notation, which is the only place a
	// team is recorded. Writing `this.notation` is also what makes them
	// undoable: the planner's editor mirrors the value in as a CodeMirror
	// transaction, so ⌘Z reaches a ✕ pressed on the bench.
	// -------------------------------------------------------------------------

	/**
	 * Set one slot of the working team. A filled slot is RENAMED (that
	 * character's segments keep their actions and change who performs them —
	 * the audition commit's move); an empty one APPENDS a bare-name segment;
	 * `null`/'blank' DELETES the occupant's segments.
	 *
	 * ⚠ `index` is honoured for the outgoing character, not the incoming one:
	 * filling an empty slot appends, so the new character lands after everyone
	 * already named rather than at `index`. Slot order is notation order — see
	 * the module header for the trade.
	 */
	setSlot(index: number, id: string | null): void {
		const outgoing = this.slots[index];
		const incoming = id ?? 'blank';
		if (outgoing === incoming) return;
		if (incoming === 'blank') {
			if (outgoing !== 'blank') {
				this.notation = deleteCharacterFromNotation(this.notation, outgoing);
			}
			return;
		}
		this.notation =
			outgoing === 'blank'
				? appendCharacterToNotation(this.notation, incoming)
				: renameCharacterInNotation(this.notation, outgoing, incoming);
	}

	/** Add to the team (no-op when full or already present). */
	addToTeam(id: string): void {
		if (this.slots.includes(id)) return;
		if (!this.slots.includes('blank')) return;
		this.notation = appendCharacterToNotation(this.notation, id);
	}

	/** Remove a character wherever it sits — deletes their segments. */
	removeFromTeam(id: string): void {
		if (!this.slots.includes(id)) return;
		this.notation = deleteCharacterFromNotation(this.notation, id);
	}

	/**
	 * Empty every slot. Under single truth that means deleting every slotted
	 * character's segments — i.e. the rotation, if one was written. The Team
	 * Builder asks first when there is more than bare names to lose
	 * (notationEdit.notationHasActions); the ⌘Z that follows a mistake is the
	 * other half of that safety.
	 *
	 * Anything the notation holds that ISN'T a slotted character survives — an
	 * unresolvable name, a fifth character with no slot — because this clears
	 * the TEAM, and those were never on it.
	 */
	clearTeam(): void {
		let next = this.notation;
		for (const id of this.slots) {
			if (id && id !== 'blank') next = deleteCharacterFromNotation(next, id);
		}
		this.notation = next;
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
	 *  the limit), else open a new tab. Returns whether a tab was replaced.
	 *  The team arrives as the notation it now IS — a run of bare-name segments,
	 *  ready to have actions typed after each. */
	importTeam(ids: string[], label = 'Imported team'): { replacedTab: boolean } {
		const notation = foldTeamIntoNotation('', ids.slice(0, TEAM_SIZE));
		const active = this.activeTab;
		const pristine = this.tabs.length === 1 && !active.notation.trim() && !active.savedId;
		const atLimit = this.tabs.length >= TAB_LIMIT;
		if (pristine || atLimit) {
			this.tabs = this.tabs.map((t) =>
				t.id === this.activeTabId ? { ...t, label, savedId: undefined } : t
			);
		} else {
			this.flush();
			const newTab: RotationTab = { id: genId(), label, notation };
			this.tabs = [...this.tabs, newTab];
			this.activeTabId = newTab.id;
		}
		this.notation = notation;
		this.tabLoadout = {};
		this.tabCon = {};
		return { replacedTab: atLimit && !pristine };
	}
}

export const rotationTabs = new RotationTabsState();
