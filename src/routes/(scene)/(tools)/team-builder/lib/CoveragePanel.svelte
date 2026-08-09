<script lang="ts">
	import Mark from '$lib/components/Mark.svelte';
	import { deriveCoverage } from './team';
	import type { FacetKey } from './facets';
	import type { CharacterIndexEntry } from '$lib/types/character';

	let {
		members,
		conCapOf,
		onFilterFacet,
		trailing
	}: {
		/** Rides the banner's far end — the team's identity facts and Clear. */
		trailing?: import('svelte').Snippet;
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
<div class="tb-cover">
	<p class="banner">
		Team covers
		{#if trailing}<span class="banner-end">{@render trailing()}</span>{/if}
	</p>
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
	/* ↻ 2026-08-08: NO BOX — a BANNER and then bare chips, which is the grammar
	   the tools are moving to. The banner NAMES the run; the run sits on the
	   world. Fifteen chips that each carry their own fill never needed a
	   surface behind them, and putting one there is what made this read as a
	   slab rather than as a list of states. */
	.tb-cover {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		/* ⚠ CONTENT HEIGHT. This was `flex: 1` to take the slack when it sat in
		   a ROW beside TeamFacts; as a full-width child of the stack's COLUMN
		   the same declaration made it grow vertically instead, swallowing
		   175px of nothing between the chips and the Atlas. The axis changed
		   under the property. */
		flex: 0 0 auto;
		min-width: 0;
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
	/* COVERED RECEDES, A GAP ANCHORS — the intent is unchanged; the tokens had
	   to flip to keep it.
	   ⚠ 2026-08-08: this run moved from a light panel onto the dark world, and
	   the old pairing INVERTED on the way. In .ctx-light, --text is the
	   recessive prose brown and --muted the anchoring slate, so "covered =
	   --text, gap = --muted" put the actionable chip forward. In .ctx-dark the
	   ladder is the other way up: --text is bright parchment and --muted is the
	   dim rung. Kept as-was, the checkmarks shouted and the gaps — the only
	   chips you can click — sank into the scene.
	   So: covered takes the DIM ink and barely any fill; a gap takes the bright
	   ink on a parchment wash that reads as a plate against near-black. */
	.ts-cov--yes {
		color: var(--muted);
		background: var(--fill-rest);
		cursor: help;
	}
	.ts-cov--no {
		color: var(--text);
		background: color-mix(in srgb, var(--accent) 16%, transparent);
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	.ts-cov--no:hover {
		color: var(--ink-active);
		background: color-mix(in srgb, var(--accent) 28%, transparent);
	}
	.ts-cov--unknown {
		color: var(--el-geo-main);
		background: color-mix(in srgb, var(--el-geo-main) 8%, transparent);
		cursor: help;
	}
</style>
