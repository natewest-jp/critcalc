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
 * ══ ↻ 2026-10-22: SLOTS ARE STORED AGAIN — design §8.1 (⚓ Nate) ═══════════
 *
 * The section below is the 2026-08-13 ruling, kept as history. It is PARTLY
 * REVERSED: the notation stays the truth for what HAPPENS, but the TEAM is
 * now four stored seats (`seats`) that the notation fills. A seated character
 * it does not name RESTS (keeps the slot, draws no bars) — the streamer
 * cleared a bare-names stub to start writing and the team vanished. A newly
 * named character takes the first empty seat, else the first resting one
 * (`seatTeam`). ⚓ A seat PLACED on purpose (a team, a swap) rests; a TYPED
 * one empties when its character leaves the text. Undo still reaches every seat change: the seats ride the
 * editor's history beside the text (`notationSeats.ts`), so the "undo came
 * free" argument below is replaced, not lost. Slot ORDER is the slot's key
 * again, and `setSlot` honours its index.
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
	deleteCharacterFromNotation,
	emptySeating,
	emptySeats,
	makeSeating,
	orderedCharacterIds,
	placedSeating,
	renameCharacterInNotation,
	seatTeam,
	seatsFromLegacy,
	seatsOfSaved,
	TEAM_SIZE,
	type Seating,
	type Seats
} from '$lib/utils/notationEdit';
import { type LoadoutEntry } from '$lib/stores';
import type { TeamRecord } from '$lib/storage/records';
import { teamOfSlots } from '$lib/storage/teamLoadout';
import { TAB_LIMIT } from '$lib/tabSet';
import { pickSample } from '$lib/data/plannerSamples';
import { getCharacterIndexEntry } from '$lib/data/characterLookup';
import { notices } from '$lib/notices.svelte';

export type RotationTab = {
	id: string;
	label: string;
	notation: string;
	/** ⚓ The party's four slots (keys 1–4; `null` = empty), design §8.1. The
	 *  notation FILLS them; a seated character it does not name is RESTING.
	 *  Absent on a tab saved before slots existed: derived once from its
	 *  notation (`seatsOf`), which reproduces the team it always had. */
	slots?: (string | null)[];
	/** Per slot: filled ON PURPOSE (rests when unnamed) rather than typed
	 *  (empties). Absent = all typed. See `Seating`. */
	placed?: boolean[];
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

/** Re-exported so a consumer reading the team from this module does not have to
 *  know the notation layer defines it. ONE definition, in notationEdit. */
export { TEAM_SIZE, seatsOfSaved };

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
export function tabCharacterIds(
	tab: Pick<RotationTab, 'notation' | 'slots'> & LegacyTeam
): string[] {
	// A plain array scan, not a Set: the list is four-ish entries and nothing
	// here is state — `svelte/prefer-svelte-reactivity` would rather see a
	// SvelteSet, which would be wrong for a pure function (documentBar.copyName
	// makes the same call for the same reason).
	const ids: string[] = [];
	for (const id of [
		...(tab.slots ?? []),
		...slotsFromNotation(tab.notation ?? ''),
		...(tab.manualSlots ?? [])
	]) {
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

/** A tab's seating: its stored slots and flags, or — saved before slots
 *  existed — the team its notation always implied (the seat rule from an
 *  empty seating IS the old derivation). */
export function seatingOf(tab: Pick<RotationTab, 'notation' | 'slots' | 'placed'>): Seating {
	return tab.slots
		? makeSeating(tab.slots, tab.placed)
		: seatTeam(emptySeating(), tab.notation ?? '');
}

/** A tab's seats alone. */
export const seatsOf = (tab: Pick<RotationTab, 'notation' | 'slots' | 'placed'>): Seats =>
	seatingOf(tab).seats;

/** Strip a restored tab of its retired field. ↻ 2026-10-22: a legacy
 *  `manualSlots` becomes the tab's SLOTS, in its own order, rather than being
 *  folded into the notation as bare names — slots can hold a team the text
 *  does not name, which is what the field was for. See {@link LegacyTeam}. */
function migrateTab(tab: RotationTab & LegacyTeam): RotationTab {
	const { manualSlots, ...rest } = tab;
	if (!manualSlots) return rest;
	// A manual team was a deliberate one: its seats are PLACED, so they rest.
	const seating = seatTeam(placedSeating(seatsFromLegacy(manualSlots)), rest.notation ?? '');
	return { ...rest, slots: seating.seats, placed: seating.placed };
}

/** A link that brings its own document — a shared rotation, a team, the
 *  Team Builder's swap errand — lands in the empty first tab, so a first visit
 *  through one gets no sample. */
function arrivingWithDocument(): boolean {
	if (!browser) return false;
	const q = new URLSearchParams(location.search);
	return q.has('r') || q.has('team') || q.has('swap');
}

class RotationTabsState {
	// Server and client both initialize to the same deterministic default (one
	// empty tab) so SSR markup and the hydrating component always agree. The
	// storage session restores the real state (`restoreFrom`) after hydration.
	tabs = $state<RotationTab[]>([makeTab('Tab 1')]);
	activeTabId = $state<string>(this.tabs[0].id);

	// Live working state — kept separate from the tabs array so bind:notation
	// on RotationTimeline works cleanly without circular reactivity.
	#notation = $state<string>('');
	/** ⚓ The party's slots and what each remembers (§8.1): stored, not derived. */
	seating = $state<Seating>(emptySeating());
	/** Who sits where (`null` = empty). */
	get seats(): Seats {
		return this.seating.seats;
	}

	/**
	 * The working notation. ⚠ An ACCESSOR: a write from anywhere but the editor
	 * (a bench edit, a load) runs the seat rule, so a newly named character
	 * takes a seat and a typed one who left the text gives theirs up. The
	 * editor computes the same rule inside its own transaction (it must, for ⌘Z
	 * to restore seats) and writes `seating` FIRST, which makes this setter's
	 * call a no-op — `seatTeam` is idempotent.
	 */
	get notation(): string {
		return this.#notation;
	}
	set notation(value: string) {
		this.seating = seatTeam(this.seating, value);
		this.#notation = value;
	}

	/** Write text and seating together, with no rule run: a swap, ✕, Clear and
	 *  every load decide the seats themselves. */
	setDocument(notation: string, seating: Seating): void {
		this.seating = makeSeating(seating.seats, seating.placed);
		this.#notation = notation;
	}

	/**
	 * ⚓ May the person change the document on screen? False while another
	 * tab holds it (notices round, 2026-10-26): every edit the planner offers
	 * asks here first, and a refusal calls the "Open in another tab" banner
	 * back. Set by the storage session; a plain field, not state.
	 */
	canEdit: () => boolean = () => true;
	/** The document on screen is held by another tab: its Edit here, for the
	 *  editor's own locked line. Set by the tools layout. */
	held = $state<{ editHere: () => void } | null>(null);

	tabLoadout = $state<Record<string, LoadoutEntry>>({});
	tabCon = $state<Record<string, number>>({});

	/**
	 * ⚓ A GUEST is showing (design §4.6): a Theorycraft document inside a real
	 * profile, set by the storage session. Every value in it is its own, so the
	 * profile's roster is not read at all.
	 */
	rosterless = $state(false);

	/** The profile's teams, handed over by the storage session (empty in
	 *  Theorycraft), each with its display label. */
	teams = $state<(TeamRecord & { label: string })[]>([]);

	/**
	 * ⚓ The saved TEAM this rotation is (its set of four): its loadout is the
	 * layer this rotation inherits (storage/teamLoadout.ts). `null` with no
	 * team, and for a guest, whose values are all its own.
	 */
	team = $derived(this.rosterless ? null : (teamOfSlots(this.teams, this.seats) ?? null));

	/**
	 * ⚓ THE ONE RESOLVER for the layer a rotation's own loadout sits on: the
	 * rotation's TEAM's (the roster's default retired into teams, Nate
	 * 2026-10-24), and nothing without one.
	 */
	inheritedLoadout(): Record<string, LoadoutEntry> {
		return this.team?.loadout ?? {};
	}

	/**
	 * ⚓ THE ONE RESOLVER for a character's constellation in this rotation
	 * (design §2.4). An OWNED character reads the roster, live: a level of its
	 * own would be a what-if, and a what-if is a Theorycraft copy (§4.6), never
	 * an edit. An unowned character keeps the document's own value, else the
	 * roster's. A guest reads only its own.
	 */
	levelOf(
		id: string,
		roster: Record<string, number>,
		owned: Record<string, 'owned' | 'wishlist'>
	): number {
		if (this.rosterless) return this.tabCon[id] ?? 0;
		if (owned[id] === 'owned') return roster[id] ?? 0;
		return this.tabCon[id] ?? roster[id] ?? 0;
	}

	/** Every level a reader of this rotation may ask for, resolved: the roster's
	 *  characters (unless a guest), the document's own, and `ids`. */
	levels(
		roster: Record<string, number>,
		owned: Record<string, 'owned' | 'wishlist'>,
		ids: readonly string[] = []
	): Record<string, number> {
		const keys = new Set([
			...(this.rosterless ? [] : Object.keys(roster)),
			...Object.keys(this.tabCon),
			...ids
		]);
		const out: Record<string, number> = {};
		for (const id of keys) out[id] = this.levelOf(id, roster, owned);
		return out;
	}

	/** Flips true once restore() has run. Gates the persist effect so the
	 *  pre-restore default state can never clobber saved tabs. */
	restored = $state(false);

	/** THE working team in its consumers' long-standing shape: four ids, an
	 *  EMPTY slot as `'blank'` (the timeline, the bench and the Builder all read
	 *  it that way; `benchBand.blankUsed` still tells a seated Blank apart).
	 *  ↻ 2026-10-22: read off the stored seats, ⛔ no longer derived from the
	 *  notation — a resting character keeps their slot. */
	slots = $derived(this.seats.map((id) => id ?? 'blank'));

	get activeTab(): RotationTab {
		return this.tabs.find((t) => t.id === this.activeTabId) ?? this.tabs[0];
	}

	/**
	 * Take a stored tab set — or, given `null`, the first visit's sample (no
	 * sample when `sample` is false or a link is arriving) — and mark the
	 * state restored. The storage session hands it the profile's current
	 * document (build plan §13).
	 */
	restoreFrom(stored: { tabs: RotationTab[]; activeTabId: string } | null, sample = true): void {
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
			this.setDocument(active.notation, seatingOf(active));
			this.tabLoadout = active.tabLoadout ?? {};
			this.tabCon = active.tabCon ?? {};
		} else if (sample && !arrivingWithDocument()) {
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
			this.setDocument(tab.notation, seatingOf(tab));
			this.tabCon = tab.tabCon ?? {};
			this.tabLoadout = tab.tabLoadout ?? {};
		}
		this.restored = true;
	}

	/** Hand the current state to the storage session's sink. Reads every
	 *  persisted field, so an $effect wrapping this call tracks all of them.
	 *  Never writes $state — no circular reactivity. */
	persist(): void {
		const snapshot = this.tabs.map((t) =>
			t.id === this.activeTabId
				? {
						...t,
						notation: this.notation,
						slots: [...this.seats],
						placed: [...this.seating.placed],
						tabLoadout: this.tabLoadout,
						tabCon: this.tabCon
					}
				: t
		);
		if (!this.restored) return;
		this.persistSink?.(snapshot, this.activeTabId);
	}

	/** The tabs persist to the store (build plan §13), and ⚓ localStorage is
	 *  left exactly as the migration found it (copy-only). A plain field, not `$state`: it is set once, before
	 *  `restored`, and must not become a dependency of the persist effect. */
	persistSink: ((tabs: RotationTab[], activeTabId: string) => void) | null = null;

	/** Flush live working state back into the tabs array before any switch. */
	flush(): void {
		this.tabs = this.tabs.map((t) =>
			t.id === this.activeTabId
				? {
						...t,
						notation: this.notation,
						slots: [...this.seats],
						placed: [...this.seating.placed],
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
		this.setDocument(tab.notation, seatingOf(tab));
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
		// ↻ 2026-10-22: a tab holding a SEATED team with no notation yet (Plan a
		// rotation) is not spare either — the team is a thing the user chose.
		const seated = (t: RotationTab) =>
			(t.id === this.activeTabId ? this.seats : seatsOf(t)).some((id) => id !== null);
		const spare = this.tabs.find((t) => !live(t).trim() && !t.savedId && !seated(t));
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
		if (!this.canEdit()) return;
		this.setDocument('', emptySeating());
		this.tabLoadout = {};
		this.tabCon = {};
		this.tabs = this.tabs.map((t, i) =>
			t.id === this.activeTabId
				? {
						...t,
						label: `Tab ${i + 1}`,
						notation: '',
						slots: emptySeats(),
						placed: undefined,
						tabLoadout: {},
						tabCon: {},
						savedId: undefined,
						synced: undefined,
						sample: undefined
					}
				: t
		);
	}

	/**
	 * Empty the working rotation — its notation and team — and KEEP its name
	 * (phase 2e: the composer's Clear; a document's name is the player's, and
	 * New in the Library is how you start another one). The write replays as
	 * an editor transaction, so Undo brings it back. ⚓ The levels and loadouts
	 * STAY (Nate 2026-10-23): they are not in the editor's history, so wiping
	 * them made the tooltip's "Undo brings it back" false, and kept per
	 * character they show again only if that character returns.
	 */
	clearDocument(): void {
		if (!this.canEdit()) return;
		this.setDocument('', emptySeating());
		this.tabs = this.tabs.map((t) => (t.id === this.activeTabId ? { ...t, sample: undefined } : t));
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
	// ↻ 2026-10-22 (§8.1): a slot write sets the SEATS and, where the character
	// has segments, rewrites the text too — through `setDocument`, so the seats
	// are decided here and never left to the rule. Undo still reaches them:
	// the planner's editor replays text AND seats as one CodeMirror transaction.
	// -------------------------------------------------------------------------

	/**
	 * Set one slot of the working team, at `index` (⚓ the slot's own key now —
	 * ⛔ no longer "honoured for the outgoing character only").
	 *  - a filled slot is RENAMED: the new character takes the seat and the
	 *    outgoing one's segments, actions and all (a swap-mode commit);
	 *  - an empty slot is simply SEATED — no bare-name segment is appended; the
	 *    newcomer rests until the notation names them;
	 *  - `null`/'blank' EMPTIES the slot and deletes the occupant's segments
	 *    (the one deliberate way off the team).
	 * A character already seated elsewhere is a no-op, as before.
	 */
	setSlot(index: number, id: string | null): void {
		if (!this.canEdit()) return;
		const want = id === 'blank' ? null : id;
		const outgoing = this.seats[index] ?? null;
		if (outgoing === want) return;
		if (want && this.seats.includes(want)) return;
		const seats = [...this.seats];
		const placed = [...this.seating.placed];
		seats[index] = want;
		// A seat filled from the bench or the Builder is a choice: it rests.
		placed[index] = !!want;
		let text = this.notation;
		if (outgoing) {
			text = want
				? renameCharacterInNotation(text, outgoing, want)
				: deleteCharacterFromNotation(text, outgoing);
		}
		this.setDocument(text, makeSeating(seats, placed));
	}

	/** The text and seats as they are now, to put back (an Undo toast).
	 *  ⚠️ The toast outlives the tab it was made for: `setDocument` writes the
	 *  ACTIVE tab, so an Undo pressed after a switch would put this tab's text
	 *  and seats over another one (and leave this one as it is). It does
	 *  nothing unless the tab is still the one in front, and works again if
	 *  you switch back while the toast is up. */
	#snapshot(): () => void {
		const tabId = this.activeTabId;
		const text = this.notation;
		const seats = [...this.seats];
		const placed = [...this.seating.placed];
		return () => {
			if (this.activeTabId !== tabId || !this.canEdit()) return;
			this.setDocument(text, makeSeating(seats, placed));
		};
	}

	/** Take someone off the team (the bench's ✕, Remove): at once, with Undo
	 *  in a toast (notices §5: a smaller destructive action takes Undo, not a
	 *  confirm). ⌘Z in the composer still reaches it too. */
	takeOff(index: number): void {
		const id = this.seats[index];
		if (!id || !this.canEdit()) return;
		const undo = this.#snapshot();
		this.setSlot(index, null);
		const name = getCharacterIndexEntry(id)?.displayName ?? id;
		notices.toast('success', `${name} is off the team`, {
			actions: [{ label: 'Undo', run: undo }]
		});
	}

	/** The composer's Clear, said with Undo. */
	clearWithUndo(): void {
		if (!this.canEdit()) return;
		const undo = this.#snapshot();
		this.clearDocument();
		notices.toast('success', 'Rotation cleared', { actions: [{ label: 'Undo', run: undo }] });
	}

	// -------------------------------------------------------------------------
	// Layer-2 writes (the bench band)
	// -------------------------------------------------------------------------

	setTabCon(charId: string, level: number): void {
		if (!this.canEdit()) return;
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
		if (!this.canEdit()) return;
		this.tabLoadout = {
			...this.tabLoadout,
			[charId]: { ...(this.tabLoadout[charId] ?? {}), ...update }
		};
	}

	/** Replace a character's own entry whole (`null` = none, so the inherited
	 *  layer shows through): the bench's writes under a team, already pruned
	 *  of what the team supplies. */
	putTabLoadout(charId: string, entry: LoadoutEntry | null): void {
		if (!this.canEdit()) return;
		const next = { ...this.tabLoadout };
		if (entry) next[charId] = entry;
		else delete next[charId];
		this.tabLoadout = next;
	}

	// -------------------------------------------------------------------------
	// Team import (deep links: ?team= on either tool)
	// -------------------------------------------------------------------------

	/**
	 * A team as a document: the four SEATED, resting, in an EMPTY notation
	 * (⚓ §8.1 — ⛔ the old run of bare names joined by swaps retires: the
	 * streamer cleared it to start writing and the team vanished). Slot order is
	 * the team's own, gaps included. The caller hands it to
	 * `documentBar.receive`, which places it like any arriving document.
	 */
	teamDocument(ids: readonly (string | null)[], label = 'Imported team'): Omit<RotationTab, 'id'> {
		const seating = placedSeating(seatsFromLegacy(ids));
		return { label, notation: '', slots: seating.seats, placed: seating.placed };
	}
}

export const rotationTabs = new RotationTabsState();
