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
	import { BUFF_STAT_ICON, BUFF_STAT_LABEL } from '$lib/timeline/buffStatMaps';
	import type { Stat } from '$lib/types/ability';

	let { tip }: { tip: BuffTooltipData } = $props();

	// Loose-row lookups: a prose `stat` simply misses both maps and renders
	// its own text with no icon.
	const iconFor = (stat: string) => BUFF_STAT_ICON[stat as Stat];
	const labelFor = (stat: string) => BUFF_STAT_LABEL[stat as Stat] ?? stat;

	// Durations and ICDs arrive in FRAMES (gauge-round.md C1) — this is the
	// display seam that turns them back into seconds, and the only place in this
	// component that knows the unit.
	//
	// ↻ 2026-08-16: the 2dp snap used to be here because the values were raw
	// float arithmetic (window end − start) carrying IEEE noise like
	// 12.000000000000002. That noise is gone — a frame span is an exact integer.
	// The rounding stays for a better reason: 754 frames really is 12.566…s, and
	// nobody wants to read that. (Number() drops trailing zeros: 12, 4.5, 0.25.)
	const fmtSecs = (frames: number) => Number((frames / 60).toFixed(2));
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
	<!-- ⛔ KEYED BY POSITION, NOT BY `stat` (2026-08-17) — this closes a class
	     rather than an instance. `(fx.stat)` asserts an invariant no caller can
	     honour: `stat` is documented as possibly being free PROSE rather than a
	     `Stat` key, so two rows naming one reaction — "Electro-Charged · Xingqiu"
	     over "Electro-Charged · Raiden" — collide and Svelte throws
	     `each_key_duplicate`. That was the FOURTH keyed-each crash in this area
	     (archive_bug_lessons), whose rule is that every `(expr)` here is a crash
	     surface and must be collision-free.
	     ⚓ The index IS the identity here: the tooltip is rebuilt whole on every
	     hover, and `.bt-row` carries no transition, no input and no focus, so
	     there is nothing to preserve ACROSS renders that position does not say.
	     ⚠ The callers were made unique-by-construction in the same pass anyway —
	     see `auraMarkerRows` — because duplicate rows were a bad CARD as well as
	     a bad key. Both halves are load-bearing; ⛔ don't restore the `stat` key
	     on the grounds that the callers behave now. -->
	{#each tip.effects as fx, i (i)}
		<div class="bt-row">
			{#if iconFor(fx.stat)}
				<img src={iconFor(fx.stat)} alt="" class="bt-icon" />
			{/if}
			<span class="bt-stat">{labelFor(fx.stat)}</span>
			<span class="bt-value">{fx.displayValue}</span>
			{#if fx.note}<span class="bt-note">{fx.note}</span>{/if}
		</div>
	{/each}
	{#if tip.duration != null || tip.procCooldown != null}
		<div class="bt-footer">
			{#if tip.duration != null}{fmtSecs(tip.duration)}s{/if}
			{#if tip.duration != null && tip.procCooldown != null}
				·
			{/if}
			{#if tip.procCooldown != null}CD {fmtSecs(tip.procCooldown)}s{/if}
		</div>
	{/if}
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
		   The viewport still constrains naturally near screen edges. */
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
	.bt-mutual {
		font-size: var(--fs-xs);
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
		font-size: var(--fs-sm);
		color: var(--text);
		flex: 1;
	}
	.bt-value {
		font-size: var(--fs-sm);
		color: #90b4d0;
		font-weight: var(--fw-semibold);
		white-space: nowrap;
	}
	/* A seamed bar's per-effect length — the footer's register (muted, small),
	   because it is the same kind of fact the footer states for the whole bar. */
	.bt-note {
		font-size: var(--fs-xs);
		color: var(--muted);
		white-space: nowrap;
	}
	.bt-footer {
		font-size: var(--fs-xs);
		color: var(--muted);
		letter-spacing: var(--ls-mid);
		border-top: 1px solid var(--frame-line);
		padding-top: 3px;
		margin-top: 1px;
	}
</style>
