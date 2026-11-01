/**
 * src/lib/rotationTabs.svelte.ts
 *
 * The Planner's document, in a shared module (bench-band round, 2026-08-05)
 * so it outlives the planner page. The storage session hands it the
 * profile's current rotation as a single tab (`restoreFrom`) and saves it
 * through `persistSink`. The Rotation Planner reads and writes it; the bench
 * displays its team and writes Layer-2 overrides (tabCon/tabLoadout); the
 * Team Builder writes it only through the planner's ⇄ errand (swap mode,
 * `setSlot`). The planner's `?team=` deep link makes a document with
 * teamDocument() and hands it to documentBar.receive().
 *
 * Layer discipline (unchanged in shape, re-routed at the bench):
 *   Layer 1 = the roster (`constellations`/`loadout` stores) — edited in the
 *             Library's Roster + the Detail card only.
 *   Layer 2 = the document (`tabCon`/`tabLoadout` here) — edited by the
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
 * on server and client (one empty tab); the storage session restores the real
 * state (`restoreFrom`). Persistence is an $effect in the tools
 * layout — it must run for EVERY tool, since the TB edits this state while
 * the planner page is unmounted. Nothing here reads a store or the DOM, and
 * SSR only ever reads this state, so module-level state is safe under
 * prerendering.
 */

import { browser } from '$app/environment';
import {
	deleteCharacterFromNotation,
	emptySeating,
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
	/** The first-visit sample this tab opened on (`plannerSamples.ts`), whose
	 *  source the Inspector credits while the notation is still its own. */
	sample?: string;
};

/** Re-exported so a consumer reading the team from this module does not have to
 *  know the notation layer defines it. ONE definition, in notationEdit. */
export { TEAM_SIZE, seatsOfSaved };

/**
 * Notation → the four slot ids it implies: the first four distinct character
 * names in segment order, padded with 'blank'. THE team, since single truth.
 *
 * ⚠ ONE COPY, and it is here because two already existed. It is a pure
 * string → string[] with no runes.
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

/** The character ids a tab actually needs loaded. 'blank' is not a character. */
export function tabCharacterIds(tab: Pick<RotationTab, 'notation' | 'slots'>): string[] {
	// A plain array scan, not a Set: the list is four-ish entries and nothing
	// here is state — `svelte/prefer-svelte-reactivity` would rather see a
	// SvelteSet, which would be wrong for a pure function.
	const ids: string[] = [];
	for (const id of [...(tab.slots ?? []), ...slotsFromNotation(tab.notation ?? '')]) {
		if (id && id !== 'blank' && !ids.includes(id)) ids.push(id);
	}
	return ids;
}

function genId(): string {
	return Math.random().toString(36).slice(2, 10);
}

/** A fresh tab id: a document the storage session makes, or an arrival
 *  with no store to make it in. */
export const newTabId = genId;

function makeTab(label: string): RotationTab {
	return { id: genId(), label, notation: '' };
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

/** A link that brings its own document — a shared rotation, a team, the
 *  Team Builder's swap errand — lands in the empty first tab, so a first visit
 *  through one gets no sample. */
function arrivingWithDocument(): boolean {
	if (!browser) return false;
	const q = new URLSearchParams(location.search);
	return q.has('r') || q.has('team') || q.has('swap');
}

class RotationTabsState {
	/**
	 * The document on screen: its id (the stored document's), label and
	 * sample. Its working state lives in the fields below. Server and client
	 * both initialize to the same deterministic default (one empty tab) so SSR
	 * markup and the hydrating component always agree; the storage session
	 * restores the real one (`restoreFrom`) after hydration.
	 */
	tab = $state<RotationTab>(makeTab('Tab 1'));

	// Live working state — kept separate from `tab` so bind:notation on
	// RotationTimeline works cleanly without circular reactivity.
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

	/** Flips true once restoreFrom() has run. Gates the persist effect so the
	 *  pre-restore default state can never clobber the stored document. */
	restored = $state(false);

	/** THE working team in its consumers' long-standing shape: four ids, an
	 *  EMPTY slot as `'blank'` (the timeline, the bench and the Builder all read
	 *  it that way; `benchBand.blankUsed` still tells a seated Blank apart).
	 *  ↻ 2026-10-22: read off the stored seats, ⛔ no longer derived from the
	 *  notation — a resting character keeps their slot. */
	slots = $derived(this.seats.map((id) => id ?? 'blank'));

	/**
	 * Show a stored document — or, given `null`, the first visit's sample (no
	 * sample when `sample` is false or a link is arriving) — and mark the
	 * state restored. The storage session hands it the profile's current
	 * document (build plan §13).
	 */
	restoreFrom(stored: RotationTab | null, sample = true): void {
		if (stored) {
			this.tab = stored;
			this.setDocument(stored.notation, seatingOf(stored));
			this.tabLoadout = stored.tabLoadout ?? {};
			this.tabCon = stored.tabCon ?? {};
		} else if (sample && !arrivingWithDocument()) {
			// ⚓ THE FIRST VISIT (Nate 2026-10-17): no tabs were ever made in this
			// browser, so the first one opens on a sample rather than empty —
			// unless a share link is arriving, which must land in the empty tab.
			const sample = pickSample();
			const tab: RotationTab = {
				...this.tab,
				label: `Sample: ${sample.name}`,
				notation: sample.notation,
				tabCon: sample.cons ?? {},
				tabLoadout: sample.loadout ?? {},
				sample: sample.id
			};
			this.tab = tab;
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
		const snapshot: RotationTab = {
			...this.tab,
			notation: this.notation,
			slots: [...this.seats],
			placed: [...this.seating.placed],
			tabLoadout: this.tabLoadout,
			tabCon: this.tabCon
		};
		if (!this.restored) return;
		this.persistSink?.(snapshot);
	}

	/** The tab persists to the store (build plan §13), and ⚓ localStorage is
	 *  left exactly as the migration found it (copy-only). A plain field, not
	 *  `$state`: it is set once, before `restored`, and must not become a
	 *  dependency of the persist effect. */
	persistSink: ((tab: RotationTab) => void) | null = null;

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
		this.tab = { ...this.tab, sample: undefined };
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
	 *  ⚠️ The toast outlives the document it was made for: `setDocument` writes
	 *  the one on screen, so an Undo pressed after the session switched
	 *  documents (Library, a profile switch) would put this one's text and
	 *  seats over another. It does nothing unless this document is still the
	 *  one in front, and works again if it comes back while the toast is up. */
	#snapshot(): () => void {
		const tabId = this.tab.id;
		const text = this.notation;
		const seats = [...this.seats];
		const placed = [...this.seating.placed];
		return () => {
			if (this.tab.id !== tabId || !this.canEdit()) return;
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
