/**
 * src/lib/documentBar.svelte.ts
 *
 * THE DOCUMENT BAR — the Planner's band A: the flows of its document, the
 * active rotation tab (rotationTabs.svelte.ts), which carries the team, the
 * per-tab loadout/constellation overrides and the notation.
 *
 * The toolbar round (2026-08-07) hoisted save/load/share out of the planner
 * PAGE so the Team Builder, which edited the same tab then, could keep a team
 * it built. ↻ Since the lineups round (2026-10-08) the Builder's document is
 * the BOARD, with its own band A (boardBar.svelte.ts), which raises its
 * make-room confirm and its notices here so one dialog serves both.
 *
 * What deliberately stays out: anything about how a tool DISPLAYS the
 * document. Band B is each tool's own business.
 */

import { notices, named, type NoticeAction } from './notices.svelte';
import type { Outcome } from './controlAnswer.svelte';
import { fromStore, get } from 'svelte/store';
import { linksIntro, moveRequest, MOVE_TO_PROFILE } from './moveRequest.svelte';
import {
	savedNotations,
	loadout,
	constellations,
	ownership,
	siteSettings,
	type SavedNotation,
	type LoadoutEntry
} from './stores';
import {
	rotationTabs as rt,
	newTabId,
	seatingOf,
	TAB_LIMIT,
	type RotationTab
} from './rotationTabs.svelte';
import { closeCandidate, createRecentlyClosed, type TabStripModel } from './tabSet';
import { encodeRotation, type SharedRotation } from './utils/rotationUrl';
import {
	notationHasActions,
	renameCharacterInNotation,
	seatingOfSaved,
	teamKey,
	teamKeyOfNotation,
	type Seats
} from './utils/notationEdit';
import { isTeamEntry, teamNotation } from './library';
import { nextLayout } from './nextLayout';
import { documentsReady, OPENED_IN_THEORYCRAFT } from './storage/arrivals';
import { resolveEntry } from './storage/teamLoadout';

/**
 * The planner's timeline registers its two chart-bound exporters here on
 * mount, so the Share menu in band A can offer them alongside the link. Same
 * registration idiom as benchBand.registerHost, and for the same reason: the
 * exporter needs the live chart (a KQM round-trip of the notation; a PNG of
 * the rendered timeline), which only the timeline component has. Absent —
 * on the Team Builder, or before the timeline mounts — the menu simply
 * offers the link, which is the whole of what a team can export.
 */
export type DocumentExporters = {
	kqm: () => Promise<boolean>;
	png: (mode: 'copy' | 'download') => Promise<Outcome>;
};

/** A copy that didn't happen, in both forms (controlAnswer.ts). */
const COPY_FAILED = (what: string): Outcome => ({
	ok: false,
	short: 'Couldn’t copy',
	long: `Couldn’t copy ${what}. The browser may have blocked the clipboard.`
});

/**
 * The name a fork takes: "Vape Hu Tao" → "Vape Hu Tao copy" → "… copy 2".
 *
 * The bank is a flat list a person reads, so two identical names help nobody.
 * ⚠ The suffix is STRIPPED before it is re-applied — forking a FORK has to
 * number rather than stack, or you arrive at "copy copy copy". It stacked
 * until a probe forked twice; hence this being a pure exported function with
 * a test rather than a private line inside saveAsNew().
 */
export function copyName(label: string, taken: readonly string[]): string {
	// A plain array scan, not a Set: the bank is a short hand-written list, and
	// the repo's svelte/prefer-svelte-reactivity rule would rather see a
	// SvelteSet — which would be wrong here, since nothing about this is state.
	const base = `${label.replace(/ copy(?: \d+)?$/, '')} copy`;
	if (!taken.includes(base)) return base;
	for (let n = 2; ; n++) {
		if (!taken.includes(`${base} ${n}`)) return `${base} ${n}`;
	}
}

/** Two level maps agree on every character either names. */
function sameLevels(a: Record<string, number>, b: Record<string, number>): boolean {
	const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const id of ids) if ((a[id] ?? 0) !== (b[id] ?? 0)) return false;
	return true;
}

/** Rotation tabs closed in this browser, newest first (§9.3 of the lineups
 *  design). Listed above the saved rotations in the bank. */
export const recentlyClosedRotations = createRecentlyClosed<RotationTab>(
	'critcalc:recentlyClosedRotations'
);

/**
 * Is a closing tab worth keeping in Recently closed? ⛔ Not an empty one, and
 * not a saved one with nothing unsaved — the bank already holds it. "Nothing
 * unsaved" compares what the TAB states against the entry: the entry is
 * densified on save (every slotted character's constellation pinned) and the
 * tab is sparse, so only the tab's own keys are compared.
 */
export function worthKeeping(tab: RotationTab, saved: readonly SavedNotation[]): boolean {
	if (!tab.notation.trim()) return false;
	const entry = tab.savedId ? saved.find((e) => e.id === tab.savedId) : undefined;
	if (!entry || entry.notation !== tab.notation) return true;
	const conDiffers = Object.entries(tab.tabCon ?? {}).some(
		([id, level]) => (entry.tabCon ?? {})[id] !== level
	);
	const loadoutDiffers = Object.entries(tab.tabLoadout ?? {}).some(
		([id, lo]) => JSON.stringify(lo) !== JSON.stringify((entry.tabLoadout ?? {})[id])
	);
	return conDiffers || loadoutDiffers;
}

/**
 * A request to make room: the tab limit is reached and something wants to
 * open. Rendered by the (tools) layout as a confirm that NAMES the tab it will
 * close and lets the reader pick another (⚓ Nate 2026-10-08).
 */
export type RoomRequest = {
	/** The open tabs to choose from — rotations or boards. */
	tabs: { id: string; label: string }[];
	/** Close the chosen tab (keeping it in its Recently closed). */
	close: (id: string) => void;
	/** The tab closed if the reader just confirms (viewed longest ago). */
	candidateId: string;
	/** What opens once there is room. */
	run: () => void;
	/** What happens on Cancel. An ARRIVING document (a shared link) is kept in
	 *  Recently closed, so cancelling never loses the link. */
	onCancel?: () => void;
};

/** ⚓ Move to a profile rides an arrival's notice (design §9.3) whenever
 *  there is a real profile to move it to. */
export function moveAction(id: string, movable: boolean): NoticeAction[] {
	return movable ? [{ label: MOVE_TO_PROFILE, run: () => (moveRequest.id = id) }] : [];
}

class DocumentBarState {
	exporters = $state<DocumentExporters | null>(null);

	/** The open make-room confirm, if any — for rotation tabs, or for board
	 *  tabs (`boardBar` raises it here too, so ONE dialog serves both). */
	room = $state<RoomRequest | null>(null);

	/** The bank, read reactively — `linked` must follow a Library delete. */
	#saved = fromStore(savedNotations);

	/** Whether the active document is linked to a bank entry (Save → Save changes,
	 *  and "Save as new" appears in the overflow). ⚠️ The entry must still EXIST:
	 *  nothing clears a tab's savedId when its entry goes (a Library delete,
	 *  Settings' Clear, an import), and a dead link saves as new — so the button
	 *  must not say "Save changes" for it (boardBar.linked's rule). */
	get linked() {
		const id = rt.activeTab.savedId;
		return !!id && this.#saved.current.some((e) => e.id === id);
	}

	/**
	 * Is there anything TO save/share? A team alone still counts — a Team
	 * Builder user with four slots and no rotation yet has a document worth
	 * keeping, which was the toolbar round's whole point.
	 *
	 * ↻ 2026-08-13: it no longer takes two tests to say so. This read
	 * `notation.trim() || slots.some(filled)`, and under single truth the second
	 * clause cannot be true while the first is false — a filled slot IS a name
	 * in the notation. The team case is still covered; it just arrives through
	 * the same string now, as four bare-name segments.
	 */
	get hasContent() {
		// ↻ 2026-10-22 (§8.1): the two tests are two again — a SEATED team with
		// no notation yet (Plan a rotation) is content: a team the user chose.
		return !!rt.notation.trim() || rt.seats.some((id) => id !== null);
	}

	/** An arrival under the switch: its notice, or — the first time a link
	 *  moves someone out of a real profile — the dialog that teaches the rule
	 *  once. `id` is the arrived document, when there is one to move. */
	arrived(switched: boolean, notice: string, id?: string, movable = false) {
		if (switched && !get(siteSettings).seenLinksNotice) {
			linksIntro.moveId = id && movable ? id : null;
			linksIntro.open = true;
			return;
		}
		notices.toast('info', switched ? OPENED_IN_THEORYCRAFT : notice, {
			actions: id ? moveAction(id, movable) : []
		});
	}

	registerExporters(ex: DocumentExporters) {
		this.exporters = ex;
		return () => {
			// Ownership guard: during a tool pan both pages are briefly alive, so
			// only clear a registration that is still ours (the bench band's rule).
			if (this.exporters === ex) this.exporters = null;
		};
	}

	/**
	 * Freeze the resolved effective loadout + constellation for every slotted
	 * character. Saved documents are meant to stay faithful even if the roster
	 * (Layer 1) changes later, so un-overridden fields are captured densely at
	 * save time rather than re-resolving on load. Existing tab overrides for
	 * non-slotted characters are preserved as-is. Only the bank copy is
	 * densified — the open tab keeps its sparse live-fallback state.
	 */
	#densifiedSnapshot(
		slots: readonly string[],
		tabCon: Record<string, number>,
		tabLoadout: Record<string, LoadoutEntry>,
		synced = false
	): {
		tabLoadout: Record<string, LoadoutEntry>;
		tabCon: Record<string, number>;
	} {
		const rosterLoadout = get(loadout);
		const rosterCons = get(constellations);
		const owned = get(ownership);
		const denseLoadout: Record<string, LoadoutEntry> = { ...tabLoadout };
		const denseCon: Record<string, number> = { ...tabCon };
		for (const id of slots) {
			if (!id || id === 'blank') continue;
			const merged: LoadoutEntry = resolveEntry(rosterLoadout[id], tabLoadout[id]);
			if (merged.weaponId || merged.artifactSetId || merged.weaponRefinement) {
				denseLoadout[id] = merged;
			}
			// Always a number (incl. an explicit 0) so the level is pinned against
			// later roster edits — the whole point of the freeze. ⚓ Except a
			// SYNCED document's owned characters, which follow the roster (§10.4).
			if (synced && owned[id] === 'owned') delete denseCon[id];
			else denseCon[id] = tabCon[id] ?? rosterCons[id] ?? 0;
		}
		return { tabLoadout: denseLoadout, tabCon: denseCon };
	}

	/** Everything the bank stores about the working document, right now. */
	#payload(name: string) {
		const synced = !!rt.activeTab.synced;
		const dense = this.#densifiedSnapshot(rt.slots, rt.tabCon, rt.tabLoadout, synced);
		return {
			name,
			notation: rt.notation,
			slots: [...rt.seats],
			placed: [...rt.seating.placed],
			tabLoadout: dense.tabLoadout,
			tabCon: dense.tabCon,
			synced
		};
	}

	/**
	 * ⚓ Every rotation has a TEAM ENTRY (lineups design §10.1): a names-only
	 * entry for its set, created here — at the one place entries are written —
	 * so the team outlives its last rotation. Its name is the team's nickname,
	 * '' until the player gives it one. Returns whether it already existed.
	 */
	#ensureTeamEntry(seats: Seats): boolean {
		const ids = seats.filter((id): id is string => !!id);
		const key = teamKey(ids);
		if (!key) return true;
		const exists = get(savedNotations).some(
			(e) => isTeamEntry(e) && teamKeyOfNotation(e.notation) === key
		);
		if (!exists) {
			savedNotations.save({
				name: '',
				notation: teamNotation(ids),
				slots: [...seats],
				// A team entry is a deliberate team: placed, so it rests (§8.1).
				placed: seats.map((id) => !!id),
				tabLoadout: {},
				tabCon: {}
			});
		}
		return exists;
	}

	/** Saving a document with no actions saves its TEAM, never a rotation. */
	#saveTeamOnly(seats: Seats) {
		if (this.#ensureTeamEntry(seats)) notices.toast('info', 'Already in your library');
		else notices.toast('success', 'Team saved');
	}

	/** Save a Recently closed tab to the bank (its "promotion"). */
	saveClosed(tab: RotationTab) {
		if (!notationHasActions(tab.notation)) {
			this.#saveTeamOnly(seatingOf(tab).seats);
			recentlyClosedRotations.remove(tab.id);
			return;
		}
		const dense = {
			...this.#densifiedSnapshot(
				seatingOf(tab).seats.map((id) => id ?? 'blank'),
				tab.tabCon ?? {},
				tab.tabLoadout ?? {},
				!!tab.synced
			),
			synced: !!tab.synced
		};
		const { seats: slots, placed } = seatingOf(tab);
		if (tab.savedId && get(savedNotations).some((e) => e.id === tab.savedId)) {
			savedNotations.update(tab.savedId, {
				name: tab.label,
				notation: tab.notation,
				slots,
				placed,
				...dense
			});
		} else {
			savedNotations.save({ name: tab.label, notation: tab.notation, slots, placed, ...dense });
		}
		this.#ensureTeamEntry(slots);
		recentlyClosedRotations.remove(tab.id);
		notices.toast('success', 'Saved');
	}

	/**
	 * Take an ARRIVING document (a shared link, a `?team=` hand-off) into a tab.
	 * An empty tab takes it, else a new tab, else the make-room confirm
	 * (⚓ Nate 2026-10-08 — a confirm every time, arriving links included,
	 * overruling the 2026-08-17 "park it in the bank" path). Cancelling keeps
	 * the document in Recently closed, so the link is never lost.
	 */
	receive(doc: Omit<RotationTab, 'id'>, notice: string) {
		// ⚓ Under the switch (build plan §13, 2d) an arriving document opens in
		// THEORYCRAFT as its own new document (§9.3), once the session is up.
		if (get(nextLayout)) {
			void documentsReady.then(async (viaStore) => {
				if (!viaStore) return this.#adoptOrMakeRoom(doc, notice);
				const { storageSession } = await import('./storage/session.svelte');
				const { switched, id, movable } = await storageSession.receiveRotation(doc);
				this.arrived(switched, notice, id, movable);
			});
			return;
		}
		this.#adoptOrMakeRoom(doc, notice);
	}

	#adoptOrMakeRoom(doc: Omit<RotationTab, 'id'>, notice: string) {
		if (rt.adopt(doc)) {
			notices.toast('info', notice);
			return;
		}
		this.withRoom(
			() => {
				rt.adopt(doc);
				notices.toast('info', notice);
			},
			() => recentlyClosedRotations.push({ ...doc, id: newTabId() })
		);
	}

	/** Link the active tab to a bank entry (and take that entry's name). */
	#link(savedId: string, label: string) {
		rt.tabs = rt.tabs.map((t) => (t.id === rt.activeTabId ? { ...t, label, savedId } : t));
	}

	/**
	 * Save the working document. Once it is linked to a bank entry, saving
	 * writes over that entry — the button says "Save changes" and the notice
	 * says "Saved" in both cases, because nothing about the ACTION differs.
	 *
	 * It used to say "Update", which named no object and read like a software
	 * update. The object was never missing, though: the entry's name IS the
	 * active tab's label, sitting one zone to the left in the same band. So
	 * the button doesn't have to carry it — the title does, and the tab shows it.
	 */
	save() {
		if (!this.hasContent) return;
		if (!notationHasActions(rt.notation)) {
			this.#saveTeamOnly(rt.seats);
			return;
		}
		const activeTab = rt.activeTab;
		const payload = this.#payload(activeTab.label);
		// ⚠️ A link to an entry deleted since (the library sends deletes to
		// Recently closed) saves as new: updating a missing id writes nothing,
		// and the notice would still say "Saved".
		if (this.linked) {
			savedNotations.update(activeTab.savedId!, payload);
		} else {
			// ⚓ Saving what the library already holds (an arriving link to your
			// own rotation, say) links to it rather than filing a twin. Save as
			// new never asks — forking is its point.
			const twin = get(savedNotations).find(
				(e) =>
					!isTeamEntry(e) &&
					e.notation.trim() === payload.notation.trim() &&
					sameLevels(e.tabCon ?? {}, payload.tabCon)
			);
			if (twin) {
				this.#link(twin.id, twin.name);
				notices.toast('info', named`Already saved as ${twin.name}`);
				return;
			}
			this.#link(savedNotations.save(payload), activeTab.label);
		}
		this.#ensureTeamEntry(rt.seats);
		notices.toast('success', 'Saved');
	}

	/**
	 * Fork the working document into a NEW bank entry, leaving the one it came
	 * from untouched, and continue on the fork.
	 *
	 * Without this there was no way out of an overwrite: once a tab carried a
	 * savedId, every Save wrote over that entry and the original was gone. That
	 * — not the word on the button — is what made saving feel like something to
	 * be careful about.
	 */
	saveAsNew() {
		if (!this.hasContent) return;
		const name = copyName(
			rt.activeTab.label,
			get(savedNotations).map((e) => e.name)
		);
		this.#link(savedNotations.save(this.#payload(name)), name);
		this.#ensureTeamEntry(rt.seats);
		notices.toast('success', 'Saved as new');
	}

	/** A saved rotation with one character renamed, in a NEW unsaved tab —
	 *  the Team Builder's "Try in Planner" after a swap. ⚓ §10.2: the saved
	 *  rotation is never rewritten; Save keeps the trial as its own. */
	tryWithSwap(entry: SavedNotation, fromId: string, toId: string, label: string) {
		// ⚓ Under the switch (phase 3) the try is a new rotation in the
		// current profile; the pinned one is untouched.
		if (get(nextLayout)) {
			const seating = seatingOfSaved(entry);
			void import('./storage/session.svelte').then(({ storageSession }) =>
				storageSession.createRotation(
					{
						notation: renameCharacterInNotation(entry.notation, fromId, toId),
						slots: seating.seats.map((id) => (id === fromId ? toId : id)),
						placed: seating.placed,
						...(entry.tabLoadout && Object.keys(entry.tabLoadout).length
							? { loadout: entry.tabLoadout }
							: {}),
						...(entry.tabCon && Object.keys(entry.tabCon).length ? { con: entry.tabCon } : {})
					},
					label
				)
			);
			return;
		}
		this.withRoom(() => {
			// The swap keeps the SLOT: the incoming character takes the outgoing
			// one's seat and segments (§8.1).
			const seating = seatingOfSaved(entry);
			rt.openTab({
				label,
				notation: renameCharacterInNotation(entry.notation, fromId, toId),
				slots: seating.seats.map((id) => (id === fromId ? toId : id)),
				placed: seating.placed,
				tabLoadout: entry.tabLoadout ?? {},
				tabCon: entry.tabCon ?? {}
			});
		});
	}

	loadNewTab(entry: SavedNotation) {
		// ⚓ An entry already open is SWITCHED TO, never opened twice (the board
		// rule, boardBar.openSaved): two tabs linked to one entry would let the
		// older one's Save changes silently overwrite the newer one's.
		const open = rt.tabs.find((t) => t.savedId === entry.id);
		if (open) {
			rt.switchTab(open.id);
			savedNotations.markOpened(entry.id);
			return;
		}
		this.withRoom(() => {
			rt.openTab({
				label: entry.name,
				notation: entry.notation,
				slots: seatingOfSaved(entry).seats,
				placed: seatingOfSaved(entry).placed,
				tabLoadout: entry.tabLoadout ?? {},
				tabCon: entry.tabCon ?? {},
				savedId: entry.id,
				synced: !!entry.synced
			});
			savedNotations.markOpened(entry.id);
		});
	}

	/** + in the tab strip. */
	newTab() {
		this.withRoom(() => rt.addTab());
	}

	/**
	 * Close a tab, keeping it in Recently closed when it holds anything worth
	 * keeping. ⚓ Closing is never loss — this is the only close path.
	 */
	closeTab(id: string) {
		const closed = rt.closeTab(id);
		if (closed && worthKeeping(closed, get(savedNotations))) recentlyClosedRotations.push(closed);
	}

	/**
	 * Band A's "Close all rotations": every tab goes through the close rule, so
	 * each one worth keeping lands in Recently closed — pushed right to left so
	 * the list reads in strip order — and one fresh tab is left.
	 */
	closeAll() {
		rt.flush();
		const saved = get(savedNotations);
		for (const t of [...rt.tabs].reverse()) {
			if (worthKeeping(t, saved)) recentlyClosedRotations.push(t);
		}
		rt.resetAll();
	}

	/** Reopen a closed tab (making room first if the strip is full). */
	reopen(tab: RotationTab) {
		this.withRoom(() => {
			// The bank entry it was linked to may have been deleted since.
			const linked = tab.savedId && get(savedNotations).some((e) => e.id === tab.savedId);
			rt.openTab({ ...tab, savedId: linked ? tab.savedId : undefined });
			recentlyClosedRotations.remove(tab.id);
		});
	}

	/**
	 * Run `open` now if there is room; otherwise ask which tab to close first.
	 */
	withRoom(open: () => void, onCancel?: () => void) {
		if (rt.tabs.length < TAB_LIMIT) {
			open();
			return;
		}
		rt.flush();
		// Never null here: at the limit there are twelve tabs and one is active.
		const candidate = closeCandidate(rt.tabs, rt.activeTabId)!;
		this.room = {
			tabs: rt.tabs.map((t) => ({ id: t.id, label: t.label })),
			close: (id) => this.closeTab(id),
			candidateId: candidate.id,
			run: open,
			onCancel
		};
	}

	/** The make-room confirm was cancelled. */
	cancelRoom() {
		const req = this.room;
		this.room = null;
		req?.onCancel?.();
	}

	/** The make-room confirm's answer: close `id`, then open what asked. */
	confirmRoom(id: string) {
		const req = this.room;
		this.room = null;
		if (!req) return;
		req.close(id);
		req.run();
	}

	/**
	 * Copy a `?r=` link to the active document. Always lands on the PLANNER —
	 * the link carries a notation as well as a team, and the planner is the tool
	 * that can render all of it (the Team Builder reads the same document, so a
	 * recipient is one click from it either way).
	 */
	async shareLink(): Promise<Outcome | null> {
		if (!this.hasContent) return null;
		try {
			const url = await this.shareUrl();
			if (!url) return null;
			await navigator.clipboard.writeText(url);
			return { ok: true, short: 'Copied', long: 'Link copied' };
		} catch {
			return COPY_FAILED('the link');
		}
	}

	/** The `?r=` link to the active document — what Copy link copies, and what
	 *  a problem report carries ($lib/feedback.ts). `null` with nothing to share. */
	async shareUrl(): Promise<string | null> {
		if (!this.hasContent) return null;
		// Its team's under the switch, so a link carries what the team supplies.
		const rosterLoadout = rt.inheritedLoadout(get(loadout));
		const rosterCons = get(constellations);
		// Scope the build snapshot to the resolved team (this handles inferred
		// slots too), plus any character carrying a tab-level loadout override.
		const slotted = new Set(rt.slots.filter((id) => id && id !== 'blank'));
		const teamIds = new Set<string>([...slotted, ...Object.keys(rt.tabLoadout)]);
		const cons: Record<string, number> = {};
		const lo: Record<string, LoadoutEntry> = {};
		for (const id of teamIds) {
			// Effective constellation: the tab's Layer-2 override wins over the
			// roster default, so a shared link carries what the document actually
			// ran at, not the sharer's roster.
			// ⚓ EVERY member's level, an explicit 0 included (lineups design §9.5):
			// a shared document never falls back to the recipient's roster, so
			// the sender's C0 must travel or the recipient's own C6 shows instead.
			// ⚓ Under the switch an owned character's level is the roster's (§12 Q31).
			if (slotted.has(id)) cons[id] = rt.levelOf(id, rosterCons, get(ownership));
			// Mirror RotationTimeline's effective-loadout merge so a shared link
			// renders identically regardless of the recipient's own defaults.
			const entry: LoadoutEntry = resolveEntry(rosterLoadout[id], rt.tabLoadout[id]);
			if (entry.weaponId || entry.artifactSetId || entry.weaponRefinement) lo[id] = entry;
		}
		const shared: SharedRotation = {
			notation: rt.notation,
			slots: [...rt.seats],
			placed: [...rt.seating.placed],
			constellations: cons,
			loadout: lo
		};
		const param = await encodeRotation(shared);
		return `${location.origin}/planner?r=${param}`;
	}

	async shareKqm(): Promise<Outcome | null> {
		const ex = this.exporters;
		if (!ex) return null;
		return (await ex.kqm())
			? { ok: true, short: 'Copied', long: 'KQM notation copied' }
			: COPY_FAILED('the notation');
	}

	async sharePng(mode: 'copy' | 'download'): Promise<Outcome | null> {
		return (await this.exporters?.png(mode)) ?? null;
	}
}

export const documentBar = new DocumentBarState();

/** Band A's strip over the rotation tabs (see `TabStripModel`). */
export const rotationTabStrip: TabStripModel = {
	get tabs() {
		return rt.tabs;
	},
	get activeId() {
		return rt.activeTabId;
	},
	newLabel: 'New rotation',
	switchTo: (id) => rt.switchTab(id),
	close: (id) => documentBar.closeTab(id),
	rename: (id, label) => {
		const tab = rt.renameTab(id, label);
		// Propagate to the save bank when this document is linked to an entry.
		if (tab?.savedId) savedNotations.rename(tab.savedId, label.trim());
	},
	reorder: (from, to, side) => rt.reorderTabs(from, to, side),
	addNew: () => documentBar.newTab()
};
