<script lang="ts">
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';
	import { deriveCoverage, deriveResonances, type TeamSlot } from './team';
	import type { FacetKey } from './facets';
	import { RIBBON_TOP_OFFSET, RIBBON_RESTING_H } from '$lib/benchBand.svelte';

	/** Breathing room between the ribbon's bottom edge and the facts strip. */
	const RIBBON_FACTS_GAP = 9;

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

<!-- A ZONE of the Team Builder's frame, not a framed island of its own: the
     page owns the surface, this owns its column. Exactly how the planner's
     portrait column sits inside .rp-frame — the two are mirror images at the
     tool-slide seam. No kicker, no empty-state copy: four empty slot cards
     ARE the explanation, same as the planner's. -->
<!-- The RIBBON (the self-contained bench box) floats over this zone; its dock
     anchor lives on .tb-frame now, not in here. The zone's own scroll
     viewport starts BELOW the ribbon's resting extent (padding-top from the
     ribbon constants), so the facts scroll in the visible strip beneath it
     and never disappear under the opaque box — which is also what retired the
     old scroll-mirror/clip machinery. -->
<section
	class="bn"
	aria-label="Team"
	style:padding-top="{RIBBON_TOP_OFFSET + RIBBON_RESTING_H + RIBBON_FACTS_GAP}px"
>
	{#if filledCount > 0}
		<div class="bn-factrow">
			{#if resonance.needsFullTeam}
				<span class="bn-resnote">resonance needs a full party of 4</span>
			{:else}
				{#each resonance.active as res (res.key)}
					<span
						class="bn-res"
						style:--el-color={res.element ? colorOf(res.element) : 'var(--muted)'}
						title={res.effect}>{res.label}</span
					>
				{/each}
			{/if}
			{#if comp.natlanCount > 0}
				<span class="bn-fact" title="Nightsoul Burst triggers scale with Natlan members in the team"
					>NB · {comp.natlanCount} Natlan</span
				>
			{/if}
			{#if comp.hasAscendantGleam}
				<span class="bn-fact">Ascendant Gleam</span>
			{/if}
			{#if comp.hasSecretRite}
				<span class="bn-fact">Secret Rite</span>
			{/if}
		</div>

		<div class="bn-coverage">
			{#each coverage as c (c.facet)}
				{#if c.state === 'no'}
					<button
						class="bn-cov bn-cov--no"
						title={coverageTitle(c.providers, c.state, c.label)}
						onclick={() => onFilterFacet(c.facet)}>{c.label} ✗</button
					>
				{:else}
					<span
						class="bn-cov bn-cov--{c.state}"
						title={coverageTitle(c.providers, c.state, c.label)}
						>{c.label} {c.state === 'yes' ? '✓' : '?'}</span
					>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- The "Send to Rotation Planner" link is retired: the team IS the
	     planner's — it's already there. The bench band gliding across the
	     tool pan is the affordance that used to be this link. -->
	{#if filledCount > 0}
		<button class="btn bn-clear" onclick={onClear}>✕ Clear team</button>
	{/if}
</section>

<style>
	/* Zone layout only — border, fill and radius belong to the containing
	   .tb-frame; the padding echoes .rp-frame's so the column sits at the same
	   inset as the planner's portraits. */
	.bn {
		display: grid;
		gap: 0.7rem;
		padding: 10px 12px 10px;
		align-content: start;
	}

	.bn-clear {
		justify-self: center;
		padding: 0.15rem 0.5rem;
		border: none;
		border-radius: var(--r-sm);
		background: none;
		color: color-mix(in srgb, var(--muted) 80%, transparent);
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition: color 150ms ease;
	}
	.bn-clear:hover {
		color: var(--text);
	}

	/* ── Facts ────────────────────────────────────────────────── */
	.bn-factrow {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.bn-res {
		padding: 0.2rem 0.45rem;
		border-radius: var(--r-sm);
		border: 1px solid color-mix(in srgb, var(--el-color) 50%, transparent);
		background: color-mix(in srgb, var(--el-color) 10%, transparent);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		cursor: help;
	}
	.bn-resnote {
		font-size: var(--fs-2xs);
		font-style: italic;
		color: var(--muted);
	}
	.bn-fact {
		padding: 0.2rem 0.45rem;
		border-radius: var(--r-sm);
		border: 1px solid var(--border);
		background: rgba(255, 255, 255, 0.04);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
	}

	.bn-coverage {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.bn-cov {
		padding: 0.18rem 0.4rem;
		border: none;
		border-radius: var(--r-sm);
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		text-transform: uppercase;
	}
	.bn-cov--yes {
		color: var(--text);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		cursor: help;
	}
	.bn-cov--no {
		color: color-mix(in srgb, var(--muted) 75%, transparent);
		background: rgba(255, 255, 255, 0.04);
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	.bn-cov--no:hover {
		color: var(--text);
		background: color-mix(in srgb, var(--accent) 16%, transparent);
	}
	.bn-cov--unknown {
		color: var(--el-geo-main, #ddb04a);
		background: color-mix(in srgb, var(--el-geo-main, #ddb04a) 8%, transparent);
		cursor: help;
	}

	/* No narrow-screen flip: the bench holds its edge at every width, as the
	   planner's portrait column always has. A real mobile treatment is the
	   mobile usability pass's job, not a breakpoint that moves the one thing
	   the two tools mirror each other on. */
</style>
