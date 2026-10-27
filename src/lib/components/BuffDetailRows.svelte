<!--
	src/lib/components/BuffDetailRows.svelte

	A buff's detail rows — "one of:", the per-stat rows, the duration/cooldown
	footer — without a box around them. Lifted out of BuffTooltip in the
	inspector round (2026-10-23) so the tooltip that GLANCES at a bar and the
	inspector that PINS it print the same rows: hover peeks, click inspects,
	and the two cannot drift apart.
-->
<script lang="ts">
	import type { TooltipEffectRow } from '$lib/components/BuffTooltip.svelte';
	import { BUFF_STAT_ICON, BUFF_STAT_LABEL } from '$lib/timeline/buffStatMaps';
	import type { Stat } from '$lib/types/ability';

	let {
		effects,
		isMutuallyExclusive = false,
		duration,
		procCooldown
	}: {
		effects: TooltipEffectRow[];
		isMutuallyExclusive?: boolean;
		duration?: number;
		procCooldown?: number;
	} = $props();

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

{#if isMutuallyExclusive}
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
     ⚓ The index IS the identity here: the rows are rebuilt whole on every
     hover, and `.bt-row` carries no transition, no input and no focus, so
     there is nothing to preserve ACROSS renders that position does not say.
     ⚠ The callers were made unique-by-construction in the same pass anyway —
     see `auraMarkerRows` — because duplicate rows were a bad CARD as well as
     a bad key. Both halves are load-bearing; ⛔ don't restore the `stat` key
     on the grounds that the callers behave now. -->
{#each effects as fx, i (i)}
	<div class="bt-row">
		{#if iconFor(fx.stat)}
			<img src={iconFor(fx.stat)} alt="" class="bt-icon" />
		{/if}
		<span class="bt-stat">{labelFor(fx.stat)}</span>
		<span class="bt-value">{fx.displayValue}</span>
		{#if fx.note}<span class="bt-note">{fx.note}</span>{/if}
	</div>
{/each}
{#if duration != null || procCooldown != null}
	<div class="bt-footer">
		{#if duration != null}{fmtSecs(duration)}s{/if}
		{#if duration != null && procCooldown != null}
			·
		{/if}
		{#if procCooldown != null}Cooldown {fmtSecs(procCooldown)}s{/if}
	</div>
{/if}

<style>
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
		color: var(--ui-info);
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
