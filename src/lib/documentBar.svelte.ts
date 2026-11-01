/**
 * src/lib/documentBar.svelte.ts
 *
 * THE DOCUMENT BAR — the Planner's document flows that outlive its page:
 * an arriving rotation (a shared link, a `?team=` hand-off), the Builder's
 * Try in Planner, and Share (the link, and the timeline's KQM and PNG
 * exporters). The document itself is `rotationTabs`; saving is the storage
 * session's, which writes every edit as it happens. The Builder's flows are
 * `boardBar`, which says its arrivals through `arrived` here.
 *
 * What deliberately stays out: anything about how a tool DISPLAYS the
 * document.
 */

import { notices, type NoticeAction } from './notices.svelte';
import type { Outcome } from './controlAnswer.svelte';
import { get } from 'svelte/store';
import { linksIntro, moveRequest, MOVE_TO_PROFILE } from './moveRequest.svelte';
import {
	constellations,
	ownership,
	siteSettings,
	type LoadoutEntry,
	type SavedNotation
} from './stores';
import { rotationTabs as rt, newTabId, type RotationTab } from './rotationTabs.svelte';
import { encodeRotation, type SharedRotation } from './utils/rotationUrl';
import { renameCharacterInNotation, seatingOfSaved } from './utils/notationEdit';
import { documentsReady, OPENED_IN_THEORYCRAFT } from './storage/arrivals';
import { resolveEntry } from './storage/teamLoadout';

/**
 * The planner's timeline registers its two chart-bound exporters here on
 * mount, so the toolbar's Share menu can offer them alongside the link. Same
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

/** ⚓ Move to a profile rides an arrival's notice (design §9.3) whenever
 *  there is a real profile to move it to. */
function moveAction(id: string, movable: boolean): NoticeAction[] {
	return movable ? [{ label: MOVE_TO_PROFILE, run: () => (moveRequest.id = id) }] : [];
}

class DocumentBarState {
	exporters = $state<DocumentExporters | null>(null);

	/** Is there anything to share? A seated team with no notation yet (Plan a
	 *  rotation) counts: it is a team the player chose (§8.1). */
	get hasContent() {
		return !!rt.notation.trim() || rt.seats.some((id) => id !== null);
	}

	/** An arrival: its notice, or — the first time a link
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
	 * Take an ARRIVING document (a shared link, a `?team=` hand-off). ⚓ It
	 * opens in THEORYCRAFT as its own new document (§9.3), once the session is
	 * up. With no store at all (neither the browser's nor the stand-in in
	 * memory would start) the tool is on its defaults, persisted nowhere, and
	 * the document simply takes their place.
	 */
	receive(doc: Omit<RotationTab, 'id'>, notice: string) {
		void documentsReady.then(async (viaStore) => {
			if (!viaStore) {
				const id = newTabId();
				rt.restoreFrom({ tabs: [{ ...doc, id }], activeTabId: id }, false);
				notices.toast('info', notice);
				return;
			}
			const { storageSession } = await import('./storage/session.svelte');
			const { switched, id, movable } = await storageSession.receiveRotation(doc);
			this.arrived(switched, notice, id, movable);
		});
	}

	/** A saved rotation with one character renamed, as a NEW rotation — the
	 *  Team Builder's "Try in Planner" after a swap. ⚓ §10.2: the saved
	 *  rotation is never rewritten. */
	tryWithSwap(entry: SavedNotation, fromId: string, toId: string, label: string) {
		// ⚓ The try is a new rotation in the current profile; the pinned one
		// is untouched.
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
		// Its team's, so a link carries what the team supplies.
		const rosterLoadout = rt.inheritedLoadout();
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
			// ⚓ An owned character's level is the roster's (§12 Q31).
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
