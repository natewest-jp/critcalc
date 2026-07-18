<!--
	src/lib/components/TeamBonusesBlock.svelte

	Displays team-wide faction bonuses and per-character permanent bonuses.
	Sits between the rotation timeline and the character ability panels.
	Only renders when there is something to show.

	Permanent bonuses are derived: any passive whose effects fire with
	`trigger.type === 'passive'` is rendered as an always-on bonus chip.
-->
<script lang="ts">
	import { getLoadedCharacter } from '$lib/data/characterData';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';
	import type { CharacterData } from '$lib/types/character';
	import type { Ability, Effect } from '$lib/types/ability';
	import type { MergedEffectDisplay } from '$lib/timeline/types';
	import {
		canonicalHeadlineOf,
		formatBuffDisplayValue,
		formatResShredDisplayValue,
		resShredDisplayStat
	} from '$lib/timeline/buffDisplay';
	import BuffTooltip, { type BuffTooltipData } from '$lib/components/BuffTooltip.svelte';

	let { slots }: { slots: string[] } = $props();

	// Payloads for the slotted set are loaded by the planner page's $effect;
	// this derived re-runs as each one lands in the reactive cache.
	let chars = $derived(slots.map((id) => getLoadedCharacter(id)));
	let comp = $derived(deriveTeamComposition(chars));

	function permanentPassives(char: CharacterData | null) {
		if (!char) return [];
		return (char.passives ?? []).filter((p) =>
			(p.effects ?? []).some((fx) => fx.trigger.type === 'passive')
		);
	}

	let permanentByChar = $derived(chars.map(permanentPassives));

	let hasFactionBadges = $derived(comp.hasAscendantGleam || comp.hasSecretRite);
	let hasPermanentBonuses = $derived(permanentByChar.some((p) => p.length > 0));
	let visible = $derived(hasFactionBadges || hasPermanentBonuses);

	// ── Chip hover tooltip — same detail rows as the timeline's buff bars ──

	/** The chip's always-on effects, formatted for the shared tooltip. */
	function chipEffects(bonus: Ability): MergedEffectDisplay[] {
		const out: MergedEffectDisplay[] = [];
		for (const fx of (bonus.effects ?? []) as Effect[]) {
			if (fx.trigger.type !== 'passive') continue;
			if (fx.type === 'buff') {
				out.push({
					stat: fx.stat,
					displayValue: formatBuffDisplayValue(
						fx.stat,
						fx.value,
						0,
						undefined,
						canonicalHeadlineOf(fx)
					)
				});
			} else if (fx.type === 'resShred') {
				out.push({
					stat: resShredDisplayStat(fx.element, fx.shredStat),
					displayValue: formatResShredDisplayValue(fx.value)
				});
			}
		}
		return out;
	}

	let tooltip = $state<BuffTooltipData | null>(null);

	function showChipTooltip(e: MouseEvent, bonus: Ability) {
		const effects = chipEffects(bonus);
		if (effects.length === 0) return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const above = rect.top > 80;
		tooltip = {
			sourceLabel: bonus.name,
			effects,
			x: rect.left + rect.width / 2,
			y: above ? rect.top - 6 : rect.bottom + 6,
			above
		};
	}

	function hideChipTooltip() {
		tooltip = null;
	}
</script>

{#if visible}
	<div class="team-bonuses">
		{#if hasFactionBadges}
			<div class="faction-badges">
				{#if comp.hasAscendantGleam}
					<span class="faction-badge faction-badge--moonsign">Moonsign: Ascendant Gleam</span>
				{/if}
				{#if comp.hasSecretRite}
					<span class="faction-badge faction-badge--hexerei">Hexerei: Secret Rite</span>
				{/if}
			</div>
		{/if}

		{#if hasPermanentBonuses}
			<div class="bonuses-grid">
				{#each permanentByChar as bonuses, ci (ci)}
					<div class="bonuses-cell">
						{#each bonuses as bonus, bi (bi)}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<span
								class="bonus-chip"
								onmouseenter={(e) => showChipTooltip(e, bonus)}
								onmouseleave={hideChipTooltip}>{bonus.name}</span
							>
						{/each}
					</div>
				{/each}
			</div>
		{/if}

		{#if tooltip}
			<BuffTooltip tip={tooltip} />
		{/if}
	</div>
{/if}

<style>
	/* Solid panel surface + inset top hairline — the shared register. */
	.team-bonuses {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px;
		background: var(--surface);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
		border-radius: 6px;
		font-family: var(--font-body);
	}

	/* ── Faction badges ─────────────────────────────────────── */

	.faction-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}

	/* Solid tinted fills — team-state chips, not hollow outlines. */
	.faction-badge {
		display: inline-flex;
		align-items: center;
		padding: 3px 8px;
		border-radius: 3px;
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}

	.faction-badge--moonsign {
		color: #b8d2f2;
		background: rgba(168, 200, 240, 0.14);
	}

	.faction-badge--hexerei {
		color: #ccb0e6;
		background: rgba(192, 160, 224, 0.14);
	}

	/* ── Per-character permanent bonuses grid ───────────────── */

	.bonuses-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: clamp(6px, 0.75vw, 10px);
	}

	.bonuses-cell {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		min-height: 0;
	}

	.bonus-chip {
		display: inline-flex;
		align-items: center;
		padding: 2px 6px 3px;
		border-radius: 3px;
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		background: rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.75);
		white-space: nowrap;
	}
</style>
