/**
 * src/lib/timeline/charReceivedBuffRows.ts
 *
 * Per-character received-buff PROJECTION (post-P4 #5). Weapon swap procs
 * (TTDS, Widsith — ICD applied parser-side), active-target slices (receivers
 * concrete, pre-sliced at swap boundaries), self buffs, and NB self-target
 * dispatches all arrive as `buff` TimelineWindows carrying a `receiverId`;
 * this module rebuilds the `${receiverId}::${sourceLabel}` row grouping and
 * formats display strings. The ~700-line legacy derivation was removed after
 * a corpus byte-parity proof (phases 4–6 of the arc).
 */

import type { TimelineWindow } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import { getWeaponById } from '$lib/data/weaponLookup';
import type {
	BuffEffect,
	CharReceivedBuffBar,
	CharReceivedBuffSubrow,
	MergedEffectDisplay
} from './types';
import { canonicalHeadlineOf, formatBuffDisplayValue } from './buffDisplay';

export type { CharReceivedBuffBar, CharReceivedBuffSubrow };

type BuffWindow = Extract<TimelineWindow, { kind: 'buff' }>;

const AB_LABEL = { skill: 'E', burst: 'Q', normal: 'N', charged: 'CA', plunge: 'P' } as const;

export function projectCharReceivedBuffRows(
	windows: ReadonlyArray<TimelineWindow>,
	getCharacter: (id: string) => CharacterData | null
): CharReceivedBuffSubrow[] {
	const buffWins = windows
		.filter((w): w is BuffWindow => w.kind === 'buff' && w.receiverId !== undefined)
		.sort((a, b) => a.id - b.id);
	const rowMap = new Map<string, CharReceivedBuffSubrow>();

	for (const w of buffWins) {
		const src = w.source;
		let sourceLabel: string;
		if (src.type === 'weapon') {
			const weapon = getWeaponById(src.weaponId);
			sourceLabel = weapon?.shortName ?? weapon?.name ?? src.weaponId;
		} else if (src.type === 'character' && src.trigger === 'nightsoulBurst') {
			const char = getCharacter(w.characterId);
			sourceLabel = `${char?.displayName ?? w.characterId} NB`;
		} else if (src.type === 'character') {
			const char = getCharacter(w.characterId);
			sourceLabel = `${char?.displayName ?? w.characterId} ${AB_LABEL[src.abilityClass!]}`;
		} else {
			continue; // artifact windows are team-surface only
		}

		const effects: MergedEffectDisplay[] = (w.effects as BuffEffect[]).map((e) => ({
			stat: e.stat,
			displayValue: formatBuffDisplayValue(
				e.stat,
				e.value,
				w.refinementIndex ?? 0,
				w.stackContext,
				canonicalHeadlineOf(e)
			)
		}));

		const bar: CharReceivedBuffBar = {
			start: w.start,
			end: w.end,
			primaryStat: (w.effects[0] as BuffEffect).stat,
			effects,
			sourceLabel,
			isMutuallyExclusive: w.isMutuallyExclusive ?? false,
			...(w.procCooldown !== undefined ? { procCooldown: w.procCooldown } : {}),
			duration: w.duration!,
			...(w.rampParams ? { buffStart: w.buffStart!, rampParams: w.rampParams } : {}),
			...(w.decayParams ? { buffStart: w.buffStart!, decayParams: w.decayParams } : {})
		};

		const key = `${w.receiverId}::${sourceLabel}`;
		const existing = rowMap.get(key);
		if (existing) {
			existing.bars.push(bar);
		} else {
			rowMap.set(key, {
				characterId: w.receiverId!,
				sourceLabel,
				primaryStat: bar.primaryStat,
				bars: [bar]
			});
		}
	}

	return [...rowMap.values()];
}
