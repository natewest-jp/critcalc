/**
 * src/lib/timeline/shieldRows.ts
 *
 * Shield-lane PROJECTION (2026-08-14).
 *
 * The parser has emitted `shield` TimelineWindows since P4 — correct spans,
 * `sourceCastId` provenance, `shieldEnd` events at expiry — and NOTHING drew
 * them. Not the timeline, not the PNG export. A shield reached the chart only
 * when its ability happened to also carry a `summons[]` entry standing in for
 * it, which is an authoring accident rather than a property of the shield: it
 * is why Layla's 12s barrier was visible and Diona's, Dahlia's, Baizhu's,
 * Candace's, Lan Yan's and Nicole's were not.
 *
 * This projects the windows into the SAME shape the summon lane already
 * renders (`SummonSubrow`), so the whole downstream stack — lane heights, the
 * character-block layout, the export snapshot — picks them up with no new
 * geometry. A shield is a labelled span with no tick markers, which is exactly
 * a summon sub-row minus its ticks.
 *
 * ⚠ ONE ROW PER CHARACTER, not per source. Mirrors the summon lane's own rule
 * (one sub-row per label, so E-Oz and Q-Oz share a lane): a character who
 * shields off both E and Q — Thoma — gets one "Shield" row carrying both bars,
 * not two identically-labelled rows the reader has to tell apart by span.
 *
 * ⛔ Windows marked `coveredBySummon` are SKIPPED — those are already on the
 * chart as their stand-in summon, and drawing them here would double them. See
 * `registerShieldOnCast` in notationParser.ts for why the stand-ins can't
 * simply be deleted from the data.
 */

import type { TimelineWindow } from '$lib/utils/notationParser';
import type { SummonSubrow } from './types';

type ShieldWindow = Extract<TimelineWindow, { kind: 'shield' }>;

/** The lane label. Deliberately generic: the stand-in summons are the only
 *  place a shield's in-game NAME is recorded, and a character whose shield is
 *  drawn here by definition has no such entry — inventing one per character
 *  would be curation, and a wrong guess reads as fact. The row sits inside its
 *  character's block and its bars align with the cast that raised them, so
 *  "whose shield, from which cast" is already answered by position. */
const SHIELD_LABEL = 'Shield';

export function computeShieldSubrows(
	windows: readonly TimelineWindow[],
	slotIdxFor: (characterId: string) => number | undefined
): SummonSubrow[] {
	const rowMap = new Map<string, SummonSubrow>();
	const order: SummonSubrow[] = [];

	for (const w of windows) {
		if (w.kind !== 'shield') continue;
		const sw = w as ShieldWindow;
		if (sw.coveredBySummon) continue;
		if (sw.end <= sw.start) continue;
		const slotIdx = slotIdxFor(sw.characterId);
		// Not slotted — the character was dropped from the annotated tracks, the
		// same guard computeSummonSubrows applies before assigning a lane.
		if (slotIdx === undefined) continue;

		let row = rowMap.get(sw.characterId);
		if (!row) {
			row = {
				slotIdx,
				characterId: sw.characterId,
				label: SHIELD_LABEL,
				bars: []
			};
			rowMap.set(sw.characterId, row);
			order.push(row);
		}
		row.bars.push({ start: sw.start, end: sw.end, source: sw.source, ticks: [] });
	}

	// Windows arrive in the parser's final start-order, so a row's bars are
	// already chronological; sorting is belt-and-braces against a future
	// emission-order change, and cheap at these counts.
	for (const row of order) row.bars.sort((a, b) => a.start - b.start);
	return order;
}
