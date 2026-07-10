/**
 * prewarmPlanner.ts
 *
 * Fires the planner's lazy character-payload fetches at NAVIGATION START
 * instead of after mount. The planner restores its active tab from
 * localStorage and lazy-loads each slotted character; when those chunks
 * arrive staggered after mount, each landing re-parses the rotation and
 * rebuilds the timeline — main-thread blocks that can land mid cross-fade
 * (the residual fade stutter measured 2026-07-10: 25–85ms blocks inside the
 * fade window on WebKit). Starting the fetches at click time gets the
 * payloads resolved before or with the mount, so the first parse already
 * sees them and the staggered rebuilds collapse.
 *
 * Best-effort by design: any storage/parse hiccup just skips the prewarm —
 * the planner loads everything itself after mount regardless.
 */

import { loadCharacter } from '$lib/data/characterData';
import { getIndexEntryByDisplayName } from '$lib/data/characterLookup';

const TABS_KEY = 'critcalc:rotationTabs';

export function prewarmPlannerCharacters(): void {
	try {
		const raw = localStorage.getItem(TABS_KEY);
		if (!raw) return;
		const data = JSON.parse(raw) as {
			tabs?: Array<{ id: string; notation?: string; manualSlots?: string[] | null }>;
			activeTabId?: string;
		};
		const active = data.tabs?.find((t) => t.id === data.activeTabId) ?? data.tabs?.[0];
		if (!active) return;

		const ids = new Set<string>();
		for (const slotId of active.manualSlots ?? []) {
			if (slotId && slotId !== 'blank') ids.add(slotId);
		}
		// Notation-name resolution mirroring the planner's autoSlots: longest
		// multi-word prefix per segment, capped at 3 words, at most 4 characters.
		let matched = 0;
		for (const segment of String(active.notation ?? '').split('>')) {
			const words = segment.trim().split(/\s+/).filter(Boolean);
			if (words.length === 0) continue;
			for (let k = Math.min(3, words.length); k >= 1; k--) {
				const entry = getIndexEntryByDisplayName(words.slice(0, k).join(' '));
				if (entry) {
					if (!ids.has(entry.id)) {
						ids.add(entry.id);
						matched++;
					}
					break;
				}
			}
			if (matched >= 4) break;
		}

		for (const id of ids) void loadCharacter(id);
	} catch {
		// best-effort — see module comment
	}
}
