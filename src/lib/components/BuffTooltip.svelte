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
	/** `note` is the effect's OWN length on a seamed bar ("12s" beside a value
	 *  whose bar runs 15s) — see `fuseNestedBars`. */
	export type TooltipEffectRow = { stat: string; displayValue: string; note?: string };

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
	import BuffDetailRows from '$lib/components/BuffDetailRows.svelte';

	let { tip }: { tip: BuffTooltipData } = $props();

	/**
	 * ⚓ KEPT ON SCREEN (Nate 2026-10-14, on his phone): the box is centred on
	 * its anchor, and a bar whose centre sat off-screen dragged the tooltip
	 * half out with it — it then squeezed itself against the edge. The centre
	 * is clamped so the whole box stays EDGE_GUTTER inside the viewport,
	 * measured from the box's own width (and the width is capped at the
	 * viewport, so the clamp always has room).
	 */
	const EDGE_GUTTER = 8;
	let boxW = $state(0);
	let viewW = $state(0);
	let centre = $derived(
		boxW && viewW
			? Math.min(Math.max(tip.x, EDGE_GUTTER + boxW / 2), viewW - EDGE_GUTTER - boxW / 2)
			: tip.x
	);
	// ↻ 2026-10-23: the rows (and their frames → seconds seam) live in
	// BuffDetailRows, shared with the inspector's bar page.
</script>

<svelte:window bind:innerWidth={viewW} />

<div
	class="bt-tooltip"
	class:bt-tooltip--above={tip.above}
	bind:offsetWidth={boxW}
	style:left="{centre}px"
	style:top="{tip.y}px"
>
	<div class="bt-source">{tip.sourceLabel}</div>
	<BuffDetailRows
		effects={tip.effects}
		isMutuallyExclusive={tip.isMutuallyExclusive}
		duration={tip.duration}
		procCooldown={tip.procCooldown}
	/>
</div>

<style>
	.bt-tooltip {
		position: fixed;
		z-index: 100;
		transform: translateX(-50%);
		background: var(--surface); /* modal role (Nate 2026-07-31) */
		border: 1px solid var(--border);
		border: none;
		border-radius: 6px;
		padding: 8px 11px;
		pointer-events: none;
		min-width: 120px;
		/* No max-width: content self-regulates (a source label + short stat
		   rows) and the old 230px cap made long ability names wrap awkwardly.
		   ↻ 2026-10-14: capped at the VIEWPORT (less both gutters) so the
		   on-screen clamp in the script always has room to work. */
		max-width: calc(100vw - 16px);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.55);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.bt-tooltip--above {
		transform: translateX(-50%) translateY(-100%);
	}
	/* ⛔ NOT UPPERCASED (⚓ NATE 2026-08-17), and the reason is a unit rather than
	   a taste: `text-transform: uppercase` turned every "4.2s" into "4.2S", which
	   reads as a 5 at this size — and a capital S is a DIFFERENT unit (siemens).
	   Units are case-sensitive and a CSS transform cannot know that.
	   ⚠ It is also the wrong register for this line. The uppercase idiom belongs
	   to KICKERS — short category words — and this label is data: a character
	   name, a separator and a measurement, all of which carry their own casing.
	   The kicker weight, tracking and colour stay, which is what made it read as
	   a header in the first place. */
	.bt-source {
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-wider);
		color: var(--muted);
		border-bottom: 1px solid var(--frame-line);
		padding-bottom: 4px;
		margin-bottom: 1px;
	}
</style>
