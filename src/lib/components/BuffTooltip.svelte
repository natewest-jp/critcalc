<!--
	src/lib/components/BuffTooltip.svelte

	Shared buff-detail tooltip: source line, per-stat effect rows (icon /
	label / value), optional duration + proc-CD footer. Extracted from
	RotationTimeline so the permanent-bonus chips (TeamBonusesBlock) can show
	the same details. Purely presentational — position/show/hide state stays
	with the caller.
-->
<script module lang="ts">
	// Display-only row: `stat` is either a real Stat key (icon + canonical
	// label from the stat maps) or a plain prose label rendered as-is —
	// MergedEffectDisplay (stat: Stat) is assignable to it, and callers like
	// the resonance chips can pass prose rows ("Stamina cost").
	export type TooltipEffectRow = { stat: string; displayValue: string };

	export type BuffTooltipData = {
		sourceLabel: string;
		effects: TooltipEffectRow[];
		isMutuallyExclusive?: boolean;
		duration?: number;
		procCooldown?: number;
		x: number;
		y: number;
		above: boolean;
	};
</script>

<script lang="ts">
	import { BUFF_STAT_ICON, BUFF_STAT_LABEL } from '$lib/timeline/buffStatMaps';
	import type { Stat } from '$lib/types/ability';

	let { tip }: { tip: BuffTooltipData } = $props();

	// Loose-row lookups: a prose `stat` simply misses both maps and renders
	// its own text with no icon.
	const iconFor = (stat: string) => BUFF_STAT_ICON[stat as Stat];
	const labelFor = (stat: string) => BUFF_STAT_LABEL[stat as Stat] ?? stat;
</script>

<div
	class="bt-tooltip"
	class:bt-tooltip--above={tip.above}
	style:left="{tip.x}px"
	style:top="{tip.y}px"
>
	<div class="bt-source">{tip.sourceLabel}</div>
	{#if tip.isMutuallyExclusive}
		<div class="bt-mutual">one of:</div>
	{/if}
	{#each tip.effects as fx (fx.stat)}
		<div class="bt-row">
			{#if iconFor(fx.stat)}
				<img src={iconFor(fx.stat)} alt="" class="bt-icon" />
			{/if}
			<span class="bt-stat">{labelFor(fx.stat)}</span>
			<span class="bt-value">{fx.displayValue}</span>
		</div>
	{/each}
	{#if tip.duration != null || tip.procCooldown != null}
		<div class="bt-footer">
			{#if tip.duration != null}{tip.duration}s{/if}
			{#if tip.duration != null && tip.procCooldown != null}
				·
			{/if}
			{#if tip.procCooldown != null}CD {tip.procCooldown}s{/if}
		</div>
	{/if}
</div>

<style>
	.bt-tooltip {
		position: fixed;
		z-index: 100;
		transform: translateX(-50%);
		background: var(--surface-raised);
		border: none;
		border-radius: 6px;
		padding: 8px 11px;
		pointer-events: none;
		min-width: 120px;
		max-width: 230px;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.06),
			0 4px 16px rgba(0, 0, 0, 0.55);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.bt-tooltip--above {
		transform: translateX(-50%) translateY(-100%);
	}
	.bt-source {
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		color: var(--muted);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		padding-bottom: 4px;
		margin-bottom: 1px;
	}
	.bt-mutual {
		font-size: var(--fs-2xs);
		color: var(--muted);
		font-style: italic;
		letter-spacing: var(--ls-mid);
	}
	.bt-row {
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.bt-icon {
		width: 11px;
		height: 11px;
		flex-shrink: 0;
		object-fit: contain;
		opacity: 0.8;
	}
	.bt-stat {
		font-size: var(--fs-xs);
		color: var(--text);
		flex: 1;
	}
	.bt-value {
		font-size: var(--fs-xs);
		color: #90b4d0;
		font-weight: var(--fw-semibold);
		white-space: nowrap;
	}
	.bt-footer {
		font-size: var(--fs-2xs);
		color: var(--muted);
		letter-spacing: var(--ls-mid);
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		padding-top: 3px;
		margin-top: 1px;
	}
</style>
