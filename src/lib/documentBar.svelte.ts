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
import { rotationTabs as rt, TAB_LIMIT } from './rotationTabs.svelte';
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

class DocumentBarState {
	/** Transient outcome message, shown in band A beside the actions. */
	notice = $state<string | null>(null);
	/** The saved-rotation bank overlay (rendered by the (tools) layout). */
	loadOpen = $state(false);
	/** Two-step destructive confirm for "reset this document". */
	resetConfirm = $state(false);

	exporters = $state<DocumentExporters | null>(null);

	#noticeTimer: ReturnType<typeof setTimeout> | undefined;

	/** Whether the active document is linked to a bank entry (Save → Save changes,
	 *  and "Save as new" appears in the overflow). */
	get linked() {
		return !!rt.activeTab.savedId;
	}

	/** Is there anything TO save/share? A team alone counts — that is the point
	 *  of the round; a Team Builder user with four slots and no notation yet has
	 *  a document worth keeping. */
	get hasContent() {
		return !!rt.notation.trim() || rt.slots.some((id) => id && id !== 'blank');
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
	#densifiedSnapshot(): {
		tabLoadout: Record<string, LoadoutEntry>;
		tabCon: Record<string, number>;
	} {
		const rosterLoadout = get(loadout);
		const rosterCons = get(constellations);
		const denseLoadout: Record<string, LoadoutEntry> = { ...rt.tabLoadout };
		const denseCon: Record<string, number> = { ...rt.tabCon };
		for (const id of rt.slots) {
			if (!id || id === 'blank') continue;
			const merged: LoadoutEntry = { ...(rosterLoadout[id] ?? {}), ...(rt.tabLoadout[id] ?? {}) };
			if (merged.weaponId || merged.artifactSetId || merged.weaponRefinement) {
				denseLoadout[id] = merged;
			}
			// Always a number (incl. an explicit 0) so the level is pinned against
			// later roster edits — the whole point of the freeze.
			denseCon[id] = rt.tabCon[id] ?? rosterCons[id] ?? 0;
		}
		return { tabLoadout: denseLoadout, tabCon: denseCon };
	}

	/** Everything the bank stores about the working document, right now. */
	#payload(name: string) {
		const dense = this.#densifiedSnapshot();
		return {
			name,
			notation: rt.notation,
			tabLoadout: dense.tabLoadout,
			tabCon: dense.tabCon
		};
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
		// Pre-single-truth entries still carry an explicit team; fold it into the
		// notation on the way in, once, and it is never seen again.
		rt.notation = foldTeamIntoNotation(entry.notation, entry.manualSlots);
		rt.tabLoadout = entry.tabLoadout ?? {};
		rt.tabCon = entry.tabCon ?? {};
		this.loadOpen = false;
	}

	loadNewTab(entry: SavedNotation) {
		if (rt.tabs.length >= TAB_LIMIT) return;
		rt.openTab({
			label: entry.name,
			notation: foldTeamIntoNotation(entry.notation, entry.manualSlots),
			tabLoadout: entry.tabLoadout ?? {},
			tabCon: entry.tabCon ?? {},
			savedId: entry.id
		});
		this.loadOpen = false;
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
		const teamIds = new Set<string>([
			...rt.slots.filter((id) => id && id !== 'blank'),
			...Object.keys(rt.tabLoadout)
		]);
		const cons: Record<string, number> = {};
		const lo: Record<string, LoadoutEntry> = {};
		for (const id of teamIds) {
			// Effective constellation: the tab's Layer-2 override wins over the
			// roster default, so a shared link carries what the document actually
			// ran at, not the sharer's roster.
			const level = rt.tabCon[id] ?? rosterCons[id];
			if (typeof level === 'number' && level > 0) cons[id] = level;
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

	resetDocument() {
		rt.resetActiveTab();
		this.resetConfirm = false;
	}
}

export const documentBar = new DocumentBarState();
