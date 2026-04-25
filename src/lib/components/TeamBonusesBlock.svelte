<!--
	src/lib/components/TeamBonusesBlock.svelte

	Displays team-wide faction bonuses and per-character permanent bonuses.
	Sits between the rotation timeline and the character ability panels.
	Only renders when there is something to show.

	Permanent bonuses are derived: any passive whose effects fire with
	`trigger.type === 'passive'` is rendered as an always-on bonus chip.
-->
<script lang="ts">
	import { getCharacterById } from '$lib/data/characterLookup';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';
	import type { CharacterData } from '$lib/types/character';

	let { slots }: { slots: string[] } = $props();

	let chars = $derived(slots.map((id) => getCharacterById(id)));
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
				{#each permanentByChar as bonuses}
					<div class="bonuses-cell">
						{#each bonuses as bonus}
							<span class="bonus-chip">{bonus.name}</span>
						{/each}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.team-bonuses {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 6px;
	}

	/* ── Faction badges ─────────────────────────────────────── */

	.faction-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}

	.faction-badge {
		display: inline-flex;
		align-items: center;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		border: 1px solid;
	}

	.faction-badge--moonsign {
		color: #a8c8f0;
		background: rgba(168, 200, 240, 0.1);
		border-color: rgba(168, 200, 240, 0.25);
	}

	.faction-badge--hexerei {
		color: #c0a0e0;
		background: rgba(192, 160, 224, 0.1);
		border-color: rgba(192, 160, 224, 0.25);
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
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 0.65rem;
		font-weight: 500;
		background: rgba(255, 255, 255, 0.07);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.75);
		white-space: nowrap;
	}
</style>
