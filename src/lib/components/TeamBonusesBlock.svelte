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
							<span class="bonus-chip">{bonus.name}</span>
						{/each}
					</div>
				{/each}
			</div>
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
		font-family: var(--font-mono);
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
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.06em;
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
		font-size: 0.625rem;
		font-weight: 500;
		background: rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.75);
		white-space: nowrap;
	}
</style>
