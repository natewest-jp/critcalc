/**
 * src/lib/timeline/stackRows.ts
 *
 * Drawn-stack PROJECTION (Mirror row round, 2026-10-30) — `stacks` windows into
 * the summon lane's `SummonSubrow`, the arrangement `shieldRows.ts` uses, so the
 * lane heights, the block layout and the PNG export take the rows unchanged.
 *
 * ⚓ Each window is ONE stepped bar (⚓ Nate: Odette's grammar) — density is the
 * count, full at the key's cap, and the tooltip reads the step under the pointer
 * (`label ×count`). ⚓ In the summon lane and not a buff row because a Mirror is
 * a thing in the world, not a stat it grants: the bar stays when the Buffs layer
 * is off, as a summon's and a shield's do.
 */

import type { TimelineWindow } from '$lib/utils/rotationEvents';
import type { BarStep, SummonSubrow } from './types';

type StackWindow = Extract<TimelineWindow, { kind: 'stacks' }>;

/** A window's steps as bar steps — each to the next one's instant, the last to
 *  the window's end. No effects: the count is the whole reading. */
export function stackBarSteps(w: StackWindow): BarStep[] {
	return w.steps.map((s, i) => ({
		start: s.at,
		end: w.steps[i + 1]?.at ?? w.end,
		count: s.count,
		effects: []
	}));
}

/** One row per (character, label), the summon lane's own rule. */
export function computeStackSubrows(
	windows: readonly TimelineWindow[],
	slotIdxFor: (characterId: string) => number | undefined
): SummonSubrow[] {
	const rowMap = new Map<string, SummonSubrow>();
	const order: SummonSubrow[] = [];
	for (const w of windows) {
		if (w.kind !== 'stacks' || w.end <= w.start) continue;
		const slotIdx = slotIdxFor(w.characterId);
		if (slotIdx === undefined) continue;
		const key = `${w.characterId}::${w.label}`;
		let row = rowMap.get(key);
		if (!row) {
			row = { slotIdx, characterId: w.characterId, label: w.label, bars: [] };
			rowMap.set(key, row);
			order.push(row);
		}
		row.bars.push({
			start: w.start,
			end: w.end,
			source: w.source,
			ticks: [],
			steps: stackBarSteps(w),
			...(w.max !== undefined ? { stepMax: w.max } : {})
		});
	}
	return order;
}
