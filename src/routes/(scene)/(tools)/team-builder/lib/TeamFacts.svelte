<script lang="ts">
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';
	import Mark from '$lib/components/Mark.svelte';
	import { deriveResonances } from './team';
	import type { CharacterIndexEntry } from '$lib/types/character';

	let {
		members,
		onClear
	}: {
		/** The working team, slot order preserved; null = an empty slot. */
		members: readonly (CharacterIndexEntry | null)[];
		onClear: () => void;
	} = $props();

	const resonance = $derived(deriveResonances(members.map((m) => m?.element ?? null)));
	const comp = $derived(deriveTeamComposition(members));

	const colorOf = (element: string | undefined) =>
		(elementColors[(element ?? 'none') as ElementKey] ?? elementColors.none).main;
</script>

<!-- WHAT THE TEAM IS — resonance and the composition facts that gate mechanics
     (Natlan count for Nightsoul Burst, Ascendant Gleam, Secret Rite), plus the
     one destructive action.

     ↻ BREATHING-ROOM ROUND 2026-08-08: this was the left third of the TeamStrip,
     a single wrapping row that also carried the 15 coverage chips. The two
     halves answer different questions — "what IS this team" vs "what does it
     COVER" — and packing them into one run meant the coverage chips, which are
     the tool's whole thesis, had to shrink to 9px to fit beside them. They are
     two panels now (see CoveragePanel), and this is the narrow one: it sizes to
     its own content instead of competing for the row. -->
<div class="tb-team" aria-label="Team summary">
	<div class="ts-facts">
		{#if resonance.needsFullTeam}
			<span class="ts-resnote">resonance needs a full party of 4</span>
		{:else}
			{#each resonance.active as res (res.key)}
				<span
					class="ts-res"
					style:--el-color={res.element ? colorOf(res.element) : 'var(--muted)'}
					title={res.effect}>{res.label}</span
				>
			{/each}
		{/if}
		{#if comp.natlanCount > 0}
			<span class="ts-fact" title="Nightsoul Burst triggers scale with Natlan members in the team"
				>NB · {comp.natlanCount} Natlan</span
			>
		{/if}
		{#if comp.hasAscendantGleam}
			<span class="ts-fact">Ascendant Gleam</span>
		{/if}
		{#if comp.hasSecretRite}
			<span class="ts-fact">Secret Rite</span>
		{/if}
	</div>

	<button class="btn ts-clear" onclick={onClear}>
		<Mark name="close" /> Clear team
	</button>
</div>

<style>
	/* ↻ 2026-08-08: NO BOX. These are two or three chips and a text button —
	   the chips already carry their own fills, so a panel behind them was
	   wrapping objects that did not need wrapping. They sit on the world now.
	   (It was briefly a light panel; on a dark world, light belongs to banners,
	   buttons and cards, never to a field — see app.css's amended law.)

	   Still hugging its content, still capped at a third of the row: the
	   coverage run beside it is the headline and must keep the width. */
	/* Rides the coverage banner's far end, so it takes no width of its own and
	   never wraps — the banner is one line. */
	.tb-team {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
	}

	.ts-facts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
	}

	.ts-res {
		padding: 0.2rem 0.45rem;
		border-radius: var(--r-sm);
		border: 1px solid color-mix(in srgb, var(--el-color) 50%, transparent);
		background: color-mix(in srgb, var(--el-color) 10%, transparent);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		cursor: help;
	}
	.ts-resnote {
		font-size: var(--fs-2xs);
		font-style: italic;
		color: var(--muted);
	}
	.ts-fact {
		padding: 0.2rem 0.45rem;
		border-radius: var(--r-sm);
		border: 1px solid var(--border);
		background: var(--fill-rest);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
	}

	.ts-clear {
		flex-shrink: 0;
		padding: 0.15rem 0.5rem;
		border: none;
		border-radius: var(--r-sm);
		background: none;
		color: var(--muted);
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition: color 150ms ease;
	}
	.ts-clear:hover {
		color: var(--ink-active);
	}
</style>
