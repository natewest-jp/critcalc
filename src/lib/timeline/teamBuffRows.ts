/**
 * src/lib/timeline/teamBuffRows.ts
 *
 * Team-buffs-row PROJECTION (post-P4 #5). The buff MEANING — who buffs whom,
 * when, under which conditions — is derived parser-side by
 * `deriveBuffWindows` (src/lib/utils/buffWindows.ts) and shipped as `buff`
 * TimelineWindows; this module only rebuilds the row identity (grouping key,
 * source label) and formats display strings. The ~800-line legacy derivation
 * this file used to hold was removed after a corpus byte-parity proof
 * (phases 4–6 of the arc).
 */

import type { TimelineWindow } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import { getArtifactSetById } from '$lib/data/artifactLookup';
import type {
	BuffEffect,
	ResShredEffect,
	MergedEffectDisplay,
	TeamBuffBar,
	TeamBuffSubrow
} from './types';
import {
	formatBuffDisplayValue,
	formatResShredDisplayValue,
	resShredDisplayStat
} from './buffDisplay';
import { mergeRefreshedBars } from './mergeRefreshedBars';

// Re-exported for renderer convenience (the template types against these).
export type { TeamBuffBar, TeamBuffSubrow };

type BuffWindow = Extract<TimelineWindow, { kind: 'buff' }>;

const AB_LABEL = { skill: 'E', burst: 'Q', normal: 'N', charged: 'CA', plunge: 'P' } as const;

export function projectTeamBuffRows(
	windows: ReadonlyArray<TimelineWindow>,
	getCharacter: (id: string) => CharacterData | null
): Array<TeamBuffSubrow & { key: string }> {
	const buffWins = windows
		.filter((w): w is BuffWindow => w.kind === 'buff' && w.receiverId === undefined)
		.sort((a, b) => a.id - b.id);
	const rowMap = new Map<string, TeamBuffSubrow>();

	for (const w of buffWins) {
		const src = w.source;
		if (src.type === 'weapon') continue; // weapon windows are received-surface only
		const char = getCharacter(w.characterId);
		const displayName = char?.displayName ?? w.characterId;

		// Display formatting — same buffDisplay calls the legacy bars made,
		// with the window's carried trigger-time context.
		const effects: MergedEffectDisplay[] = w.debuff
			? (w.effects as ResShredEffect[]).map((e) => ({
					stat: resShredDisplayStat(e.element, e.shredStat),
					displayValue: formatResShredDisplayValue(e.value)
				}))
			: (w.effects as BuffEffect[]).map((e) => ({
					stat: e.stat,
					displayValue: formatBuffDisplayValue(
						e.stat,
						e.value,
						w.refinementIndex ?? 0,
						w.stackContext
					)
				}));

		let rowKey: string;
		let sourceLabel: string;
		let explicitKind: 'buff' | 'debuff' | undefined;
		if (src.type === 'character') {
			if (src.trigger === 'cast' || src.trigger === 'block') {
				const lbl = AB_LABEL[src.abilityClass!];
				rowKey = `${w.characterId}::char::${lbl}${w.debuff ? '::resShred' : ''}`;
				sourceLabel = `${displayName} ${lbl}`;
			} else if (src.trigger === 'afterDuration') {
				const lbl = AB_LABEL[src.abilityClass!];
				rowKey = `${w.characterId}::char::${lbl}::afterDuration${w.debuff ? '::resShred' : ''}`;
				const attribution = w.debuff
					? undefined
					: (w.poolFirstEffect as BuffEffect | undefined)?.attribution;
				sourceLabel = attribution ? `${displayName} ${attribution}` : `${displayName} ${lbl} (end)`;
			} else if (src.trigger === 'nightsoulBurst') {
				rowKey = `${w.characterId}::char::NB`;
				sourceLabel = `${displayName} NB`;
			} else {
				// 'reaction' — one row per effect, keyed by its display stat.
				rowKey = `${w.characterId}::char::onReaction::${effects[0].stat}`;
				sourceLabel = `${displayName} reaction`;
				explicitKind = w.debuff ? 'debuff' : 'buff';
			}
		} else {
			const set = getArtifactSetById(src.setId);
			sourceLabel = set?.name ?? src.setId;
			if (src.trigger === 'cast') {
				const lbl = AB_LABEL[src.abilityClass!];
				rowKey = `${w.characterId}::artifact::${src.setId}::${src.triggerKey}::${lbl}`;
			} else {
				rowKey = `${w.characterId}::artifact::${src.setId}::onReaction::${effects[0].stat}`;
				explicitKind = w.debuff ? 'debuff' : 'buff';
			}
		}

		// Row primary stat: legacy rows key off the DEDUP POOL's first effect
		// for resShred cast/block rows (carried as poolFirstEffect — a
		// per-cast filter may have dropped it from this window's list);
		// everything else keys off the window's own first effect.
		let primaryStat: MergedEffectDisplay['stat'];
		if (w.debuff) {
			const pf = (w.poolFirstEffect ?? w.effects[0]) as ResShredEffect;
			primaryStat = resShredDisplayStat(pf.element, pf.shredStat);
		} else {
			primaryStat = (w.effects[0] as BuffEffect).stat;
		}

		const bar: TeamBuffBar = { start: w.start, end: w.end, effects };
		const existing = rowMap.get(rowKey);
		if (existing) {
			existing.bars.push(bar);
		} else {
			rowMap.set(rowKey, {
				characterId: w.characterId,
				primaryStat,
				bars: [bar],
				sourceLabel,
				...(explicitKind !== undefined
					? { kind: explicitKind }
					: w.debuff
						? { kind: 'debuff' as const }
						: {})
			});
		}
	}

	// The rowMap dedup key (unique by construction) rides on each row so the
	// keyed {#each} renders with that exact identity — coarser keys collide
	// (Chevreuse's dual-element shred rows share one sourceLabel; see the
	// archived each_key_duplicate lesson).
	//
	// Bars refresh-merge per row (2026-08-15): a buff re-applied before it
	// expires is ONE covered span. No extra gate here — a team bar is
	// `{start, end, effects}` with no envelope or ICD to disagree about, so the
	// display comparison is the whole test.
	return [...rowMap].map(([key, row]) => ({
		...row,
		bars: mergeRefreshedBars(row.bars),
		key
	}));
}
