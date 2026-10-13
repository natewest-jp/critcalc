<script lang="ts" module>
	import type { CharacterIndexEntry as Entry } from '$lib/types/character';
	/** A headed run of tiles — the Team Builder's role sections. */
	export type GridSection = {
		key: string;
		label: string;
		element?: string;
		entries: Entry[];
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CharacterIndexEntry } from '$lib/types/character';
	import { matchesIdentity, type GridFilters, type IdentityFilters } from '$lib/characterFilters';
	import { createProgressiveReveal } from '$lib/utils/progressiveReveal.svelte';
	import { scrollFade } from '$lib/actions/scrollFade';

	// ---------------------------------------------------------------------------
	// Shared roster grid: a scrolling, identity-filtered character grid. Tile
	// visuals stay per consumer via the `tile` snippet — the planner's Source
	// overlay carries the slot badge. Identity filtering is the shared
	// `matchesIdentity`; capability facets / ownership stay the Team Builder's
	// concern (passed in via `extraFilter`).
	//
	// ↻ ASIDE-COLUMN ROUND 2026-08-08: the filter rail is no longer in here. It
	// is <CharacterFilterRail>, its own box in the surface's aside column, which
	// both tools place beside this grid — see $lib/toolColumns.ts. This component
	// APPLIES the filters; the column edits them. They meet on the consumer's
	// `filters` object and nowhere else.
	// ---------------------------------------------------------------------------

	let {
		roster,
		filters,
		extraFilter,
		emptyMessage = 'No characters match these filters.',
		tile,
		aboveGrid,
		belowGrid,
		sections,
		sectionHead
	}: {
		roster: CharacterIndexEntry[];
		filters: GridFilters;
		/** Extra predicate ANDed after the identity match (facets, ownership, …). */
		extraFilter?: (entry: CharacterIndexEntry) => boolean;
		emptyMessage?: string;
		tile: Snippet<[CharacterIndexEntry]>;
		/** Rendered INSIDE the scroll container, before / after the grid — a count
		 *  line above, a secondary bucket (the TB's "not yet curated") below. */
		aboveGrid?: Snippet;
		belowGrid?: Snippet;
		/** When set, the tiles render as these HEADED runs instead of one flat
		 *  grid. ⚠ The entries are taken AS GIVEN — the consumer has already
		 *  filtered them (a section is a grouping of a result, not a query), and a
		 *  character may sit in more than one. */
		sections?: GridSection[];
		sectionHead?: Snippet<[GridSection]>;
	} = $props();

	const filtered = $derived(
		roster.filter(
			(e) => matchesIdentity(e, filters as IdentityFilters) && (extraFilter ? extraFilter(e) : true)
		)
	);

	// Time-sliced mount: first batch covers the viewport, the below-fold rest
	// streams in rAF batches (see progressiveReveal.svelte.ts).
	const reveal = createProgressiveReveal();
	$effect(() => {
		reveal.target = filtered.length;
	});
	const shown = $derived(filtered.slice(0, reveal.limit));
</script>

<!-- The scroller, not the grid itself: aboveGrid/belowGrid ride along inside it
     so a count line and a secondary bucket scroll with the tiles. It IS the
     component root now — the flex row that used to hold grid-plus-rail went
     with the rail (aside-column round). -->
<div class="cg-scroll scroll-fade" use:scrollFade>
	{#if aboveGrid}{@render aboveGrid()}{/if}

	{#if sections}
		{#each sections as section (section.key)}
			<section class="cg-section">
				{#if sectionHead}{@render sectionHead(section)}{/if}
				<div class="cg-grid">
					{#each section.entries as entry (entry.id)}
						{@render tile(entry)}
					{/each}
				</div>
			</section>
		{/each}
		{#if sections.length === 0}
			<p class="cg-empty">{emptyMessage}</p>
		{/if}
	{:else}
		<div class="cg-grid">
			{#each shown as entry (entry.id)}
				{@render tile(entry)}
			{/each}
			{#if filtered.length === 0}
				<p class="cg-empty">{emptyMessage}</p>
			{/if}
		</div>
	{/if}

	{#if belowGrid}{@render belowGrid()}{/if}
</div>

<style>
	/* ── Scroller (the bounded column the tiles live in) ─────────── */
	/* The bounded-scroll chain needs min-height:0 at EVERY flex level above
	   this; break one and the column grows instead of scrolling. */
	.cg-scroll {
		/* A scroll container clips everything that paints outside its content
		   box, and `overflow-y: auto` forces `overflow-x` to `auto` too — so a
		   vertical scroller clips on all FOUR edges, and a card's hover rise
		   paints 1px past its element. Without this gutter the grid's top row
		   lost its top border on hover. (The filter column keeps its own copy of
		   the knob for the same reason, one focus ring wider.) */
		--cg-gutter: 6px;
		/* 🎛️ The roll-off (.scroll-fade + use:scrollFade). Roughly a third of a
		   tile — enough that a clipped row of cards reads as continuing rather
		   than as ending, without dissolving the row you are actually looking at.
		   The rail runs shorter; its groups are smaller objects. */
		--scroll-fade: 36px;

		flex: 1;
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
		padding: var(--cg-gutter);
		display: flex;
		flex-direction: column;
		gap: var(--cg-stack-gap, 8px);
	}

	.cg-grid {
		/* flex:none — as a flex item the grid would otherwise SHRINK to fit the
		   bounded scroller, squishing the aspect-ratio portraits instead of
		   scrolling (the same failure grid-auto-rows: max-content guards
		   against inside a bounded grid). Both stay. */
		flex: none;
		min-width: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(var(--cg-tile-min, 128px), 1fr));
		grid-auto-rows: max-content;
		gap: var(--cg-gap, 8px);
		align-content: start;
	}
	.cg-section {
		flex: none;
		display: flex;
		flex-direction: column;
		gap: var(--cg-gap, 8px);
	}
	.cg-empty {
		grid-column: 1 / -1;
		margin: 1rem 0;
		font-size: var(--fs-md);
		color: var(--muted);
	}
</style>
