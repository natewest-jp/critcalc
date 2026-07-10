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
		stat.endsWith('Res') ||
		stat.endsWith('CritDmg') ||
		stat === 'critRate' ||
		stat === 'critDmg' ||
		stat === 'cdReduction' ||
		stat === 'incomingHealingBonus'
	);
}

/** Helper for callers iterating effect arrays: pulls a buff effect's
 *  canonicalAssumption.headlineValue if present (safe across narrower or
 *  wider effect-type unions). Returns undefined when the effect doesn't
 *  carry the marker, so `formatBuffDisplayValue` falls back to formula
 *  computation. */
export function canonicalHeadlineOf(e: unknown): number | undefined {
	if (!e || typeof e !== 'object') return undefined;
	const ca = (e as { canonicalAssumption?: { headlineValue?: number } }).canonicalAssumption;
	return ca?.headlineValue;
}

export function formatBuffDisplayValue(
	stat: Stat,
	value: BuffValue,
	refinementIndex: number,
	stackContext?: ReadonlyMap<string, number>,
	canonicalHeadline?: number
): string {
	const pct = isPctStat(stat);
	// canonicalAssumption short-circuit: when the buff is flagged as a
	// canonical-rotation assumption, the headline value renders directly
	// and the formula in `value` is treated as schema-level ground truth
	// only (preserved for the day a real primitive resolves the input).
	if (canonicalHeadline !== undefined) {
		return pct ? `+${canonicalHeadline}%` : `+${canonicalHeadline}`;
	}
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
	const ratioNum =
		typeof value.ratio === 'number' ? value.ratio : value.ratio.refinementValues[refinementIndex];
	const scalingLabel = scalingStatLabel(value.stat);
	const scalingCap = value.cap != null ? ` (cap ${value.cap})` : '';
	// ratio is in percentage points (see BuffValue.scaling JSDoc) — display
	// directly as `~{ratio}% {stat}` without further scaling.
	return `~${ratioNum}% ${scalingLabel}${scalingCap}`;
}

/** Friendly display name for the source stat of a scaling/perStack value.
 *  Accepts the broader `Stat` union (the schema's `BuffValue.scaling.stat`
 *  is the generic Stat, not the narrower ScalingStat) so this can be used
 *  in both places. */
export function scalingStatLabel(stat: Stat): string {
	if (stat === 'baseAtk') return 'base ATK';
	if (stat === 'healingBonus') return 'Healing Bonus';
	return stat;
}

/** Maps a resShred element to the matching `${element}Res` Stat key for icon /
 *  label lookup. Resists without an `element` field render under the generic
 *  `allElementalRes` key (Itto burst, VV swirl — VV's actual swirl element is
 *  not carried through the schema). */
export function resShredDisplayStat(element: Element | undefined): Stat {
	if (element === 'physical') return 'physicalRes';
	if (element) return `${element}Res` as Stat;
	return 'allElementalRes';
}

/** Renders a resShred numeric `value` (always negative in authored data) as a
 *  signed percentage. e.g. `-40` → `"-40%"`. */
export function formatResShredDisplayValue(value: number): string {
	return `${value}%`;
}
