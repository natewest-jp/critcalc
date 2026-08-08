<script lang="ts">
	import Mark from '$lib/components/Mark.svelte';
	import { deriveCoverage } from './team';
	import type { FacetKey } from './facets';
	import type { CharacterIndexEntry } from '$lib/types/character';

	let {
		members,
		conCapOf,
		onFilterFacet
	}: {
		/** The working team, slot order preserved; null = an empty slot. */
		members: readonly (CharacterIndexEntry | null)[];
		/** Constellation cap per character under the active con mode. */
		conCapOf: (id: string) => number;
		/** A coverage gap was clicked — drive the Source filter to fill it. */
		onFilterFacet: (facet: FacetKey) => void;
	} = $props();

	const coverage = $derived(deriveCoverage(members, conCapOf));

	function coverageTitle(providers: string[], state: string, label: string): string {
		if (state === 'yes') return `${label} — provided by ${providers.join(', ')}`;
		if (state === 'unknown') return `${label} — unknown (an uncurated kit is in the team)`;
		return `${label} — no slotted character provides this. Click to find one.`;
	}
</script>

<!-- WHAT THE TEAM COVERS — the tool's thesis object, and now the headline of
     its own panel.

     ↻ BREATHING-ROOM ROUND 2026-08-08. These fifteen chips used to share one
     wrapping row with the resonance and composition facts, at --fs-2xs: 9px,
     the smallest type token on the site. That size was never a decision — it
     was what fit once the facts and Clear had taken their share of the row.
     Given the width back, they sit at the chip register the type scale already
     names (--fs-sm, 11px), which is also where every other chip in the app
     lives.

     The gaps are still FILTER DRIVERS — a `no` chip is a <button> that points
     the roster at whatever would fill it — which is why the panel wants to be
     directly above the roster rather than tucked into a band. -->
<div class="tb-cover frame ctx-light">
	<p class="kicker">Team covers</p>
	<div class="ts-coverage">
		{#each coverage as c (c.facet)}
			{#if c.state === 'no'}
				<button
					class="ts-cov ts-cov--no"
					title={coverageTitle(c.providers, c.state, c.label)}
					onclick={() => onFilterFacet(c.facet)}>{c.label} <Mark name="close" size={12} /></button
				>
			{:else}
				<span class="ts-cov ts-cov--{c.state}" title={coverageTitle(c.providers, c.state, c.label)}
					>{c.label}
					{#if c.state === 'yes'}<Mark name="check" size={12} />{:else}?{/if}</span
				>
			{/if}
		{/each}
	</div>
</div>

<style>
	.tb-cover {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		/* Takes the row's slack — this is the wide one, and the reason
		   TeamFacts caps itself at a third. */
		flex: 1;
		min-width: 0;
		padding: 0.6rem 0.75rem;
		border-radius: var(--r-sm);
	}

	.ts-coverage {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
	}

	/* ⚓ NATE — the chip register. Was --fs-2xs (9px) at 0.18/0.4 padding when
	   this run had to share a row; --fs-sm is what app.css's type scale calls
	   the chip size, and the Marks beside the labels move 11 → 12 to match (they
	   are inline geometry, so they do not scale with the font on their own). */
	.ts-cov {
		padding: 0.3rem 0.55rem;
		border: none;
		border-radius: var(--r-sm);
		font-family: var(--font-body);
		font-size: var(--fs-sm);
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
</style>
