/**
 * src/lib/documentBar.svelte.ts
 *
 * THE DOCUMENT BAR — band A's state, shared by every tool that edits the
 * working team (toolbar round, 2026-08-07).
 *
 * Since the bench-band round there has been exactly ONE working document: the
 * active rotation tab (rotationTabs.svelte.ts), carrying the team, the
 * per-tab loadout/constellation overrides and the notation. Both the planner
 * and the Team Builder edit it. But save/load/share lived in the planner PAGE,
 * so the Team Builder could build a team and had no way to keep it — the
 * gap the round set out to close. Hoisting the flows here makes them the
 * document's, not one tool's, and band A renders identically in both.
 *
 * What deliberately stays out: anything about how a tool DISPLAYS the
 * document. Band B is each tool's own business.
 */

import { get } from 'svelte/store';
import {
	savedNotations,
	loadout,
	constellations,
	type SavedNotation,
	type LoadoutEntry
} from './stores';
import {
	rotationTabs as rt,
	newTabId,
	slotsFromNotation,
	TAB_LIMIT,
	type RotationTab
} from './rotationTabs.svelte';
import { closeCandidate, createRecentlyClosed } from './tabSet';
import { encodeRotation, type SharedRotation } from './utils/rotationUrl';
import { foldTeamIntoNotation } from './utils/notationEdit';

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
	png: (mode: 'copy' | 'download') => Promise<void>;
};

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
	/** The tab closed if the reader just confirms (viewed longest ago). */
	candidateId: string;
	/** What opens once there is room. */
	run: () => void;
	/** What happens on Cancel. An ARRIVING document (a shared link) is kept in
	 *  Recently closed, so cancelling never loses the link. */
	onCancel?: () => void;
};

class DocumentBarState {
	/** Transient outcome message, shown in band A beside the actions. */
	notice = $state<string | null>(null);
	/** The saved-rotation bank overlay (rendered by the (tools) layout). */
	loadOpen = $state(false);
	exporters = $state<DocumentExporters | null>(null);

	/** The open make-room confirm, if any. */
	room = $state<RoomRequest | null>(null);

	/** Tabs that may not close to make room. Set by the Team Builder's board
	 *  store (a tab a board team links to); nothing is locked until then. */
	lockedTab: (tab: RotationTab) => boolean = () => false;

	#noticeTimer: ReturnType<typeof setTimeout> | undefined;

	/** Whether the active document is linked to a bank entry (Save → Save changes,
	 *  and "Save as new" appears in the overflow). */
	get linked() {
		return !!rt.activeTab.savedId;
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
		return !!rt.notation.trim();
	}

	showNotice(msg: string) {
		clearTimeout(this.#noticeTimer);
		this.notice = msg;
		this.#noticeTimer = setTimeout(() => (this.notice = null), 2200);
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
		tabLoadout: Record<string, LoadoutEntry>
	): {
		tabLoadout: Record<string, LoadoutEntry>;
		tabCon: Record<string, number>;
	} {
		const rosterLoadout = get(loadout);
		const rosterCons = get(constellations);
		const denseLoadout: Record<string, LoadoutEntry> = { ...tabLoadout };
		const denseCon: Record<string, number> = { ...tabCon };
		for (const id of slots) {
			if (!id || id === 'blank') continue;
			const merged: LoadoutEntry = { ...(rosterLoadout[id] ?? {}), ...(tabLoadout[id] ?? {}) };
			if (merged.weaponId || merged.artifactSetId || merged.weaponRefinement) {
				denseLoadout[id] = merged;
			}
			// Always a number (incl. an explicit 0) so the level is pinned against
			// later roster edits — the whole point of the freeze.
			denseCon[id] = tabCon[id] ?? rosterCons[id] ?? 0;
		}
		return { tabLoadout: denseLoadout, tabCon: denseCon };
	}

	/** Everything the bank stores about the working document, right now. */
	#payload(name: string) {
		const dense = this.#densifiedSnapshot(rt.slots, rt.tabCon, rt.tabLoadout);
		return {
			name,
			notation: rt.notation,
			tabLoadout: dense.tabLoadout,
			tabCon: dense.tabCon
		};
	}

	/** Save a Recently closed tab to the bank (its "promotion"). */
	saveClosed(tab: RotationTab) {
		const dense = this.#densifiedSnapshot(
			slotsFromNotation(tab.notation),
			tab.tabCon ?? {},
			tab.tabLoadout ?? {}
		);
		if (tab.savedId && get(savedNotations).some((e) => e.id === tab.savedId)) {
			savedNotations.update(tab.savedId, { name: tab.label, notation: tab.notation, ...dense });
		} else {
			savedNotations.save({ name: tab.label, notation: tab.notation, ...dense });
		}
		recentlyClosedRotations.remove(tab.id);
		this.showNotice('Saved');
	}

	/**
	 * Take an ARRIVING document (a shared link, a `?team=` hand-off) into a tab.
	 * An empty tab takes it, else a new tab, else the make-room confirm
	 * (⚓ Nate 2026-10-08 — a confirm every time, arriving links included,
	 * overruling the 2026-08-17 "park it in the bank" path). Cancelling keeps
	 * the document in Recently closed, so the link is never lost.
	 */
	receive(doc: Omit<RotationTab, 'id'>, notice: string) {
		if (rt.adopt(doc)) {
			this.showNotice(notice);
			return;
		}
		this.withRoom(
			() => {
				rt.adopt(doc);
				this.showNotice(notice);
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
		const activeTab = rt.activeTab;
		const payload = this.#payload(activeTab.label);
		if (activeTab.savedId) {
			savedNotations.update(activeTab.savedId, payload);
		} else {
			this.#link(savedNotations.save(payload), activeTab.label);
		}
		this.showNotice('Saved');
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
		this.showNotice('Saved as new');
	}

	load(entry: SavedNotation) {
		this.#link(entry.id, entry.name);
		savedNotations.markOpened(entry.id);
		// Pre-single-truth entries still carry an explicit team; fold it into the
		// notation on the way in, once, and it is never seen again.
		rt.notation = foldTeamIntoNotation(entry.notation, entry.manualSlots);
		rt.tabLoadout = entry.tabLoadout ?? {};
		rt.tabCon = entry.tabCon ?? {};
		this.loadOpen = false;
	}

	loadNewTab(entry: SavedNotation) {
		this.loadOpen = false;
		this.withRoom(() => {
			rt.openTab({
				label: entry.name,
				notation: foldTeamIntoNotation(entry.notation, entry.manualSlots),
				tabLoadout: entry.tabLoadout ?? {},
				tabCon: entry.tabCon ?? {},
				savedId: entry.id
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

	/** Reopen a closed tab (making room first if the strip is full). */
	reopen(tab: RotationTab) {
		this.loadOpen = false;
		this.withRoom(() => {
			// The bank entry it was linked to may have been deleted since.
			const linked = tab.savedId && get(savedNotations).some((e) => e.id === tab.savedId);
			rt.openTab({ ...tab, savedId: linked ? tab.savedId : undefined });
			recentlyClosedRotations.remove(tab.id);
		});
	}

	/**
	 * Run `open` now if there is room; otherwise ask which tab to close first.
	 * Refuses (with a notice) only when every other tab is locked.
	 */
	withRoom(open: () => void, onCancel?: () => void) {
		if (rt.tabs.length < TAB_LIMIT) {
			open();
			return;
		}
		rt.flush();
		const candidate = closeCandidate(rt.tabs, rt.activeTabId, this.lockedTab);
		if (!candidate) {
			onCancel?.();
			this.showNotice('Every tab is linked to a team — close one first');
			return;
		}
		this.room = { candidateId: candidate.id, run: open, onCancel };
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
		this.closeTab(id);
		req.run();
	}

	/**
	 * Copy a `?r=` link to the active document. Always lands on the PLANNER —
	 * the link carries a notation as well as a team, and the planner is the tool
	 * that can render all of it (the Team Builder reads the same document, so a
	 * recipient is one click from it either way).
	 */
	async shareLink() {
		if (!this.hasContent) return;
		const rosterLoadout = get(loadout);
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
			if (slotted.has(id)) cons[id] = rt.tabCon[id] ?? rosterCons[id] ?? 0;
			// Mirror RotationTimeline's effective-loadout merge so a shared link
			// renders identically regardless of the recipient's own defaults.
			const entry: LoadoutEntry = { ...(rosterLoadout[id] ?? {}), ...(rt.tabLoadout[id] ?? {}) };
			if (entry.weaponId || entry.artifactSetId || entry.weaponRefinement) lo[id] = entry;
		}
		const shared: SharedRotation = {
			notation: rt.notation,
			constellations: cons,
			loadout: lo
		};
		try {
			const param = await encodeRotation(shared);
			await navigator.clipboard.writeText(`${location.origin}/rotation-planner?r=${param}`);
			this.showNotice('Link copied');
		} catch {
			this.showNotice('Share failed');
		}
	}

	async shareKqm() {
		const ex = this.exporters;
		if (!ex) return;
		this.showNotice((await ex.kqm()) ? 'KQM copied' : 'Copy failed');
	}

	async sharePng(mode: 'copy' | 'download') {
		await this.exporters?.png(mode);
	}
}

export const documentBar = new DocumentBarState();
