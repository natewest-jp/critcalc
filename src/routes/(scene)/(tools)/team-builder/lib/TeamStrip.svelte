<script lang="ts">
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';
	import Mark from '$lib/components/Mark.svelte';
	import { deriveCoverage, deriveResonances, type TeamSlot } from './team';
	import type { FacetKey } from './facets';

	let {
		slots,
		conCapOf,
		onClear,
		onFilterFacet
	}: {
		slots: TeamSlot[];
		/** Constellation cap per character under the active con mode. */
		conCapOf: (id: string) => number;
		onClear: () => void;
		/** A coverage gap was clicked — drive the Source filter to fill it. */
		onFilterFacet: (facet: FacetKey) => void;
	} = $props();

	const members = $derived(slots.map((id) => (id ? getCharacterIndexEntry(id) : null)));
	const filledCount = $derived(members.filter((m) => m != null).length);

	const resonance = $derived(deriveResonances(members.map((m) => m?.element ?? null)));
	const comp = $derived(deriveTeamComposition(members));
	const coverage = $derived(deriveCoverage(members, conCapOf));

	const colorOf = (element: string | undefined) =>
		(elementColors[(element ?? 'none') as ElementKey] ?? elementColors.none).main;

	function coverageTitle(providers: string[], state: string, label: string): string {
		if (state === 'yes') return `${label} — provided by ${providers.join(', ')}`;
		if (state === 'unknown') return `${label} — unknown (an uncurated kit is in the team)`;
		return `${label} — no slotted character provides this. Click to find one.`;
	}
</script>

<!-- The TEAM STRIP: what the working team IS (resonance, composition facts) and
     what it COVERS, as one horizontal readout across the top of the work zone.
     It moved here from the bench column in the tall-bench round (2026-08-06):
     the ribbon spans the frame's full height now, so nothing can live beneath
     the cards — and the strip is the better home anyway, because the coverage
     gaps are FILTER DRIVERS. They sit directly above the roster they filter,
     and the width they gained turns 214px of wrapped column into one row.
     Nothing to say with an empty team: four blank cards already say it. -->
{#if filledCount > 0}
	<div class="ts" aria-label="Team summary">
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

		<div class="ts-coverage">
			{#each coverage as c (c.facet)}
				{#if c.state === 'no'}
					<button
						class="ts-cov ts-cov--no"
						title={coverageTitle(c.providers, c.state, c.label)}
						onclick={() => onFilterFacet(c.facet)}>{c.label} <Mark name="close" size={11} /></button
					>
				{:else}
					<span
						class="ts-cov ts-cov--{c.state}"
						title={coverageTitle(c.providers, c.state, c.label)}
						>{c.label}
						{#if c.state === 'yes'}<Mark name="check" size={11} />{:else}?{/if}</span
					>
				{/if}
			{/each}
		</div>

		<button class="btn ts-clear" onclick={onClear}>
			<Mark name="close" /> Clear team
		</button>
	</div>
{/if}

<style>
	/* One row that wraps: identity on the left, coverage filling the middle,
	   the destructive action pinned right. A hairline under it seams the strip
	   to the browse zone below without giving it a surface of its own — the
	   frame owns the ground, as every zone here does. */
	.ts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem 0.6rem;
		flex-shrink: 0;
		padding: 8px 14px;
		border-bottom: 1px solid var(--frame-line);
	}

	.ts-facts,
	.ts-coverage {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
	}
	/* The coverage run takes the slack so Clear lands on the right edge. */
	.ts-coverage {
		flex: 1;
		min-width: 0;
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

	.ts-cov {
		padding: 0.18rem 0.4rem;
		border: none;
		border-radius: var(--r-sm);
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		text-transform: uppercase;
	}
	/* Covered recedes, a GAP anchors: in the light context --text is the
	   recessive prose voice and --muted the label anchor, so this pairing puts
	   the actionable chip forward without a second color. */
	.ts-cov--yes {
		color: var(--text);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		cursor: help;
	}
	.ts-cov--no {
		color: var(--muted);
		background: var(--fill-rest);
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	.ts-cov--no:hover {
		color: var(--ink-active);
		background: color-mix(in srgb, var(--accent) 16%, transparent);
	}
	.ts-cov--unknown {
		color: var(--el-geo-main, #ddb04a);
		background: color-mix(in srgb, var(--el-geo-main, #ddb04a) 8%, transparent);
		cursor: help;
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
