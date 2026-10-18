/**
 * src/lib/rotationTabs.svelte.ts
 *
 * The planner's tab model, hoisted to a shared module (bench-band round,
 * 2026-08-05) so it outlives the planner page. The Rotation Planner reads and
 * writes it as its tab state; the bench band displays the active tab's team
 * and writes Layer-2 overrides (tabCon/tabLoadout); the Team Builder writes it
 * only through the planner's ⇄ errand (swap mode, `setSlot`). ↻ Since the
 * lineups round (2026-10-08) the Builder's own document is the BOARD, not
 * this. The `?team=` cross-injection is retired — the planner's deep link
 * opens a tab via teamDocument() and documentBar.receive().
 *
 * Layer discipline (unchanged in shape, re-routed at the bench):
 *   Layer 1 = the roster (`constellations`/`loadout` stores) — edited in the
 *             Library's Roster + the Detail card only.
 *   Layer 2 = the active tab (`tabCon`/`tabLoadout` here) — edited by the
 *             bench band. The bench is the plan's team editor; it never marks
 *             ownership.
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
 * a swap renames that character's segments, `setSlot(i, null)` deletes them
 * (the bench ✕ that did so retired 2026-10-13), adding somebody appends a
 * bare-name segment (see notationEdit.ts, which owns the rewrites).
 * ⚠ The cost, taken knowingly: slot ORDER is notation order, so you cannot fill
 * slot 3 while 1–2 are empty. Nate traded reordering away for the tool and the
 * text agreeing, and has a separate idea for reordering.
 *
 * The gain that pays for it is undo. Because the slot is derived from the text,
 * undoing the text restores the slot by itself — there is no separate
 * slot-restore path, and ⌘Z in the notation box reaches a team edit made
 * outside the editor (see RotationTimeline's editor handle for the routing that makes the
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
	foldTeamIntoNotation,
	orderedCharacterIds,
	setSlotInNotation,
	TEAM_SIZE
} from '$lib/utils/notationEdit';
import { safeSetItem, type LoadoutEntry } from '$lib/stores';
import { TAB_LIMIT } from '$lib/tabSet';
import { pickSample } from '$lib/data/plannerSamples';

export type RotationTab = {
	id: string;
	label: string;
	notation: string;
	tabLoadout?: Record<string, LoadoutEntry>;
	/** Per-tab constellation overrides (Layer 2), parallel to tabLoadout. */
	tabCon?: Record<string, number>;
	savedId?: string;
	/** Synced to the roster (§10.4) — see `SavedNotation.synced`. */
	synced?: boolean;
	/** When this tab was last on screen (ms). The room-making rule closes the
	 *  one viewed longest ago (`tabSet.closeCandidate`); absent on tabs that
	 *  predate the field, which count as the oldest. */
	viewedAt?: number;
	/** The first-visit sample this tab opened on (`plannerSamples.ts`), whose
	 *  source the Notes panel credits while the notation is still its own. */
	sample?: string;
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

/** ONE limit for every tabbed document — see `tabSet.ts`. */
export { TAB_LIMIT };
export const TABS_KEY = 'critcalc:rotationTabs';

/** Re-exported so a consumer reading the team from this module does not have to
 *  know the notation layer defines it. ONE definition, in notationEdit. */
export { TEAM_SIZE };

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

/** A fresh tab id, for a document kept in Recently closed before it ever
 *  had a tab (a shared link cancelled at the make-room confirm). */
export const newTabId = genId;

function makeTab(label: string): RotationTab {
	return { id: genId(), label, notation: '', viewedAt: Date.now() };
}

/** Strip a restored tab of its retired field, folding whatever team it carried
 *  into the notation first. See {@link LegacyTeam}. */
function migrateTab(tab: RotationTab & LegacyTeam): RotationTab {
	const { manualSlots, ...rest } = tab;
	if (!manualSlots) return rest;
	return { ...rest, notation: foldTeamIntoNotation(rest.notation ?? '', manualSlots) };
}

/** A link that brings its own document — a shared rotation, a team, the
 *  Team Builder's swap errand — lands in the empty first tab, so a first visit
 *  through one gets no sample. */
function arrivingWithDocument(): boolean {
	if (!browser) return false;
	const q = new URLSearchParams(location.search);
	return q.has('r') || q.has('team') || q.has('swap');
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
		} else if (!arrivingWithDocument()) {
			// ⚓ THE FIRST VISIT (Nate 2026-10-17): no tabs were ever made in this
			// browser, so the first one opens on a sample rather than empty —
			// unless a share link is arriving, which must land in the empty tab.
			const sample = pickSample();
			const tab: RotationTab = {
				...this.tabs[0],
				label: `Sample: ${sample.name}`,
				notation: sample.notation,
				tabCon: sample.cons ?? {},
				tabLoadout: sample.loadout ?? {},
				sample: sample.id
			};
			this.tabs = [tab];
			this.activeTabId = tab.id;
			this.notation = tab.notation;
			this.tabCon = tab.tabCon ?? {};
			this.tabLoadout = tab.tabLoadout ?? {};
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
		safeSetItem(TABS_KEY, JSON.stringify({ tabs: snapshot, activeTabId: this.activeTabId }));
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

	/** The tab being LEFT was on screen until now — that, not when it was
	 *  opened, is what "viewed longest ago" measures. */
	#stampLeaving(): void {
		const now = Date.now();
		this.tabs = this.tabs.map((t) => (t.id === this.activeTabId ? { ...t, viewedAt: now } : t));
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
		this.#stampLeaving();
		this.activeTabId = id;
		const tab = this.tabs.find((t) => t.id === id);
		if (tab) this.loadWorkingState(tab);
	}

	addTab(): boolean {
		if (this.tabs.length >= TAB_LIMIT) return false;
		this.flush();
		this.#stampLeaving();
		const newTab = makeTab(`Tab ${this.tabs.length + 1}`);
		this.tabs = [...this.tabs, newTab];
		this.activeTabId = newTab.id;
		this.loadWorkingState(newTab);
		return true;
	}

	/** Open a new tab from a snapshot (a saved entry, a shared rotation) and
	 *  make it active. Returns false at the tab limit — the caller makes room
	 *  first (`documentBar.withRoom`). `id` may be passed to reopen a closed tab
	 *  under its own id; it is ignored if an open tab already holds it. */
	openTab(partial: Omit<RotationTab, 'id'> & { id?: string }): boolean {
		if (this.tabs.length >= TAB_LIMIT) return false;
		this.flush();
		this.#stampLeaving();
		const id = partial.id && !this.tabs.some((t) => t.id === partial.id) ? partial.id : genId();
		const newTab: RotationTab = { ...partial, id, viewedAt: Date.now() };
		this.tabs = [...this.tabs, newTab];
		this.activeTabId = newTab.id;
		this.loadWorkingState(newTab);
		return true;
	}

	/**
	 * Take an INCOMING document (a shared `?r=` link, a `?team=` hand-off) into a
	 * tab, without ever destroying work. Returns false when there is nowhere for
	 * it to go — the caller then parks it somewhere non-destructive.
	 *
	 * ⚓ ONE RULE, in one sentence: **an incoming document fills an EMPTY tab if
	 * there is one, else opens a new tab, else does not land.**
	 *
	 * 🐛 WHAT THIS REPLACED, because it was silently destructive (2026-08-17).
	 * Both callers used to reuse the ACTIVE tab when `tabs.length >= TAB_LIMIT` —
	 * overwriting its notation, label, loadout and constellations, and telling
	 * you afterwards with a 2.2s toast. At six tabs, clicking a friend's link
	 * replaced whatever you were looking at, and if that tab was unsaved the work
	 * was gone: there is no tab-level undo, and the composer's ⌘Z does not reach
	 * a label or a loadout. ⚠️ It also picked the worst possible victim — the
	 * ACTIVE tab is by definition the one you are working in.
	 *
	 * ⚠️ The empty-tab search is deliberately not limited to the at-limit case.
	 * "Fill the empty tab I already have" is what a reader expects at any count,
	 * and one rule that always holds is worth more than a cheaper rule with an
	 * exception in it. An empty tab is a slot waiting for content.
	 *
	 * ⚠️ EMPTY means no notation AND no `savedId`. A tab linked to a bank entry
	 * is not spare even when blank — the link is a thing the user made.
	 */
	adopt(partial: Omit<RotationTab, 'id'>): boolean {
		// ⚠️ The active tab's typed text lives in `notation` until a flush, so its
		// stored copy can read empty while it holds work. Test the LIVE text.
		const live = (t: RotationTab) => (t.id === this.activeTabId ? this.notation : t.notation);
		const spare = this.tabs.find((t) => !live(t).trim() && !t.savedId);
		if (spare) {
			this.flush();
			this.#stampLeaving();
			this.tabs = this.tabs.map((t) => (t.id === spare.id ? { ...partial, id: t.id } : t));
			this.activeTabId = spare.id;
			this.loadWorkingState({ ...partial, id: spare.id });
			return true;
		}
		if (this.tabs.length >= TAB_LIMIT) return false;
		this.openTab(partial);
		return true;
	}

	/** Close a tab and hand it back (with its live state flushed in), so the
	 *  caller can keep it in Recently closed. Undefined when it is the last
	 *  tab, which never closes. */
	closeTab(id: string): RotationTab | undefined {
		if (this.tabs.length <= 1) return undefined;
		this.flush();
		const idx = this.tabs.findIndex((t) => t.id === id);
		if (idx < 0) return undefined;
		const closed = this.tabs[idx];
		const wasActive = id === this.activeTabId;
		this.tabs = this.tabs.filter((t) => t.id !== id);
		if (wasActive) {
			const next = this.tabs[Math.min(idx, this.tabs.length - 1)];
			this.activeTabId = next.id;
			this.loadWorkingState(next);
		}
		return closed;
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
						savedId: undefined,
						synced: undefined,
						sample: undefined
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
	// transaction, so ⌘Z reaches a team edit made outside the editor.
	// -------------------------------------------------------------------------

	/**
	 * Set one slot of the working team. A filled slot is RENAMED (that
	 * character's segments keep their actions and change who performs them —
	 * a swap-mode commit's move); an empty one APPENDS a bare-name segment;
	 * `null`/'blank' DELETES the occupant's segments.
	 *
	 * ⚠ `index` is honoured for the outgoing character, not the incoming one:
	 * filling an empty slot appends, so the new character lands after everyone
	 * already named rather than at `index`. Slot order is notation order — see
	 * the module header for the trade.
	 */
	setSlot(index: number, id: string | null): void {
		this.notation = setSlotInNotation(this.notation, index, id === 'blank' ? null : id);
	}

	// -------------------------------------------------------------------------
	// Layer-2 writes (the bench band)
	// -------------------------------------------------------------------------

	setTabCon(charId: string, level: number): void {
		this.tabCon = { ...this.tabCon, [charId]: level };
		// ⚓ A level set by hand ends a sync — the badge reads itself (§10.4).
		if (this.activeTab.synced) {
			this.tabs = this.tabs.map((t) => (t.id === this.activeTabId ? { ...t, synced: false } : t));
		}
	}

	/** A saved rotation was synced in the library: every open tab linked to it
	 *  drops its owned characters' levels (they follow the roster now). */
	applySync(savedId: string, owned: readonly string[]): void {
		const drop = (con: Record<string, number> = {}) =>
			Object.fromEntries(Object.entries(con).filter(([id]) => !owned.includes(id)));
		this.flush();
		this.tabs = this.tabs.map((t) =>
			t.savedId === savedId ? { ...t, tabCon: drop(t.tabCon), synced: true } : t
		);
		if (this.activeTab.savedId === savedId) this.tabCon = drop(this.tabCon);
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

	/**
	 * A team as a document: the notation it now IS — a run of bare-name
	 * segments, ready to have actions typed after each. The caller hands it to
	 * `documentBar.receive`, which places it like any arriving document.
	 * ↻ 2026-10-08: was `importTeam`, which adopted directly and declined at the
	 * limit; the make-room confirm lives in documentBar, so this only builds.
	 */
	teamDocument(ids: string[], label = 'Imported team'): Omit<RotationTab, 'id'> {
		return { label, notation: foldTeamIntoNotation('', ids.slice(0, TEAM_SIZE)) };
	}
}

export const rotationTabs = new RotationTabsState();
