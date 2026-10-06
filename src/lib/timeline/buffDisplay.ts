/**
 * src/lib/timeline/buffDisplay.ts
 *
 * Display-value formatting for buff / resShred effects on timeline rows.
 * Pure string builders — extracted from RotationTimeline.svelte so they can
 * be unit-tested; the CSS-gradient helpers (ramping/decaying backgrounds)
 * stay component-side with the rest of the presentation layer.
 */

import type { Stat, BuffValue, Element } from '$lib/types/ability';

export function isPctStat(stat: Stat): boolean {
	return (
		stat.endsWith('%') ||
		stat.endsWith('DmgBonus') ||
		// ⚠️ The bucket-5 reaction bonuses are percentages too ("Superconduct DMG is
		// increased by 50%") — they printed as a bare +50 until 2026-09-27.
		stat.endsWith('ReactionBonus') ||
		stat.endsWith('Res') ||
		stat.endsWith('CritDmg') ||
		stat === 'critRate' ||
		stat === 'critDmg' ||
		stat === 'cdReduction' ||
		stat === 'defIgnore' ||
		stat === 'skillDefIgnore' ||
		stat === 'incomingHealingBonus'
	);
}

export function formatBuffDisplayValue(
	stat: Stat,
	value: BuffValue,
	refinementIndex: number,
	stackContext?: ReadonlyMap<string, number>
): string {
	const pct = isPctStat(stat);
	if (typeof value === 'number') return pct ? `+${value}%` : `+${value}`;
	if ('refinementValues' in value) {
		const v = value.refinementValues[refinementIndex];
		return pct ? `+${v}%` : `+${v}`;
	}
	if (value.type === 'unknown') return value.description;
	if (value.type === 'ramping') {
		const capStr = value.cap != null ? ` → ${value.cap}%` : '';
		return `+${value.startValue}%${capStr} (+${value.stepValue}%/${value.stepInterval}s)`;
	}
	if (value.type === 'decaying') {
		const end = value.endValue ?? 0;
		const startStr = pct ? `+${value.startValue}%` : `+${value.startValue}`;
		const endStr = pct ? `${end}%` : `${end}`;
		return `${startStr} → ${endStr} over duration`;
	}
	if (value.type === 'perStack') {
		const stacks = stackContext?.get(value.key);
		const threshold = value.threshold ?? 0;
		const effectiveStacks = (raw: number) => {
			const adjusted = Math.max(0, raw - threshold);
			return value.maxStacks != null ? Math.min(adjusted, value.maxStacks) : adjusted;
		};
		const overSuffix = threshold > 0 ? ` over ${threshold}` : '';
		const capSuffix = value.cap != null ? ` (cap ${value.cap})` : '';
		if (typeof value.per === 'object') {
			const scalingLabel = scalingStatLabel(value.per.stat);
			if (stacks != null && stacks > threshold) {
				const totalRatio = effectiveStacks(stacks) * value.per.ratio;
				return `~${totalRatio}% ${scalingLabel}${capSuffix}`;
			}
			return `~${value.per.ratio}% ${scalingLabel}/stack${overSuffix}${capSuffix}`;
		}
		if (stacks != null && stacks > threshold) {
			const rawTotal = effectiveStacks(stacks) * value.per;
			const total = value.cap != null ? Math.min(rawTotal, value.cap) : rawTotal;
			return pct ? `+${total}%` : `+${total}`;
		}
		const perStr = pct ? `+${value.per}%` : `+${value.per}`;
		return `${perStr}/stack${overSuffix}${capSuffix}`;
	}
	if (value.type === 'perTeamCount') {
		const unit =
			'elements' in value.count
				? `${value.count.elements.join('/')} ally`
				: `${value.count.faction} member`;
		const capSuffix = value.cap != null ? ` (cap ${value.cap}${pct ? '%' : ''})` : '';
		const perStr = pct ? `+${value.per}%` : `+${value.per}`;
		return `${perStr}/${unit}${capSuffix}`;
	}
	const ratioNum =
		typeof value.ratio === 'number' ? value.ratio : value.ratio.refinementValues[refinementIndex];
	const scalingLabel = scalingStatLabel(value.stat);
	const scalingCap = value.cap != null ? ` (cap ${value.cap})` : '';
	// ⚠️ The offset must SHOW. A reader who sees "~1% ATK (cap 20)" and does not
	// see "above 1000" will read a buff the character does not have at low ATK —
	// which is the whole reason these kits went unauthored before the field
	// existed. It sits before the cap so the phrase reads as the kit states it.
	const scalingOver = value.offset != null ? ` above ${value.offset}` : '';
	// ratio is in percentage points (see BuffValue.scaling JSDoc) — display
	// directly as `~{ratio}% {stat}` without further scaling.
	return `~${ratioNum}% ${scalingLabel}${scalingOver}${scalingCap}`;
}

/** Friendly display name for the source stat of a scaling/perStack value.
 *
 *  ⚠ This label lands INSIDE a value string ("~20% EM"), one column over from
 *  the row's own `BUFF_STAT_LABEL`. So it wants the SHORT KQM form, not the
 *  column label — "Elem. Mastery · ~20% EM" reads; "Elem. Mastery ·
 *  ~20% Elem. Mastery" does not. That is why this is its own map rather than a
 *  fall-through to `buffStatMaps`, which also folds `baseAtk` into plain ATK.
 *
 *  Everything the corpus actually scales off is listed (atk 22 · hp 18 ·
 *  def 13 · em 10 · baseAtk 4 · healingBonus 2 authored values). The raw-key
 *  fallback used to be the only path for atk/hp/def/em, which printed
 *  "~596% hp" and "~20% em" — raw Stat keys, which the legibility round
 *  forbids on any user surface.
 *
 *  Accepts the broader `Stat` union (the schema's `BuffValue.scaling.stat`
 *  is the generic Stat, not the narrower ScalingStat) so this can be used
 *  in both places. */
const SCALING_STAT_LABEL: Partial<Record<Stat, string>> = {
	atk: 'ATK',
	'atk%': 'ATK',
	baseAtk: 'base ATK',
	hp: 'HP',
	'hp%': 'HP',
	def: 'DEF',
	'def%': 'DEF',
	em: 'EM',
	// ⚠️ A MISSING ENTRY LEAKS THE RAW KEY. `scalingStatLabel` falls through to
	// the Stat name, so an unlabelled stat renders "~40% energyRecharge above
	// 100" instead of "~40% ER". Both of these were caught that way on their
	// first render. ⚓ The invariant: EVERY stat the corpus scales on needs a
	// row here. Census 2026-08-31 — atk, baseAtk, critRate, def, em,
	// energyRecharge, healingBonus, hp — all eight are now present.
	energyRecharge: 'ER',
	critRate: 'CRIT Rate',
	healingBonus: 'Healing Bonus'
};

export function scalingStatLabel(stat: Stat): string {
	return SCALING_STAT_LABEL[stat] ?? stat;
}

/** Maps a resShred effect to a display Stat key for icon / label lookup.
 *  DEF shred (`shredStat: 'def'`) borrows the `def%` key so it renders "DEF"
 *  on the red debuff bar ("DEF −30%"). RES shred maps its element to the
 *  matching `${element}Res` key; shreds without an `element` render under the
 *  generic `allElementalRes` key (Itto burst, VV swirl — VV's actual swirl
 *  element is not carried through the schema). */
export function resShredDisplayStat(element: Element | undefined, shredStat?: 'res' | 'def'): Stat {
	if (shredStat === 'def') return 'def%';
	if (element === 'physical') return 'physicalRes';
	if (element) return `${element}Res` as Stat;
	return 'allElementalRes';
}

/** Renders a resShred numeric `value` (always negative in authored data) as a
 *  signed percentage. e.g. `-40` → `"-40%"`. */
export function formatResShredDisplayValue(value: number): string {
	return `${value}%`;
}
