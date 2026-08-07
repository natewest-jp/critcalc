<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CharacterIndexEntry } from '$lib/types/character';
	import { matchesIdentity, type IdentityFilters } from '$lib/characterFilters';
	import { createProgressiveReveal } from '$lib/utils/progressiveReveal.svelte';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import type { Element } from '$lib/types/ability';
	import type { WeaponType } from '$lib/types/weapon';
	import type { SvelteSet } from 'svelte/reactivity';
	import Mark from './Mark.svelte';

	// ---------------------------------------------------------------------------
	// Shared roster grid: a scrolling character grid beside a vertical identity
	// filter rail (search + element / weapon / rarity / region), echoing the Team
	// Builder's own filter column. Tile visuals stay per consumer via the `tile`
	// snippet — the planner's Source overlay carries the slot badge. Identity
	// filtering is the shared `matchesIdentity`; capability facets / ownership
	// stay the Team Builder's concern (passed in via `extraFilter`).
	// ---------------------------------------------------------------------------

	/** The mutable filter state the rail binds to (the sets are SvelteSets so
	 *  the grid can toggle them in place). Owned by the consumer as $state. */
	export type GridFilters = {
		elements: SvelteSet<string>;
		weapons: SvelteSet<string>;
		rarities: SvelteSet<number>;
		region: string;
		search: string;
		/** Team Builder's Factions/Buffs group. The rail doesn't render it (the
		 *  TB supplies those chips via railStart); it rides along so the shared
		 *  matchesIdentity sees the same filter object both tools bind to. */
		factionBuffs?: SvelteSet<string>;
	};

	let {
		roster,
		filters,
		showFilterRail = true,
		railSide = 'right',
		extraFilter,
		emptyMessage = 'No characters match these filters.',
		tile,
		headerEnd,
		railStart,
		railEnd,
		aboveGrid,
		belowGrid,
		extraFiltersActive = false,
		onClearExtras,
		searchPlaceholder = 'Search…'
	}: {
		roster: CharacterIndexEntry[];
		filters: GridFilters;
		/** Render the identity-filter rail. Off = grid only (consumer supplies
		 *  its own filter chrome). */
		showFilterRail?: boolean;
		/** Which edge the rail holds. Both tools keep it RIGHT — one filter-column
		 *  grammar site-wide (bench left · work center · filters right). The prop
		 *  survives the retired mirrored arrangement, which put the Team Builder's
		 *  rail left to face the old tool-slide seam. */
		railSide?: 'left' | 'right';
		/** Extra predicate ANDed after the identity match (facets, ownership, …). */
		extraFilter?: (entry: CharacterIndexEntry) => boolean;
		emptyMessage?: string;
		tile: Snippet<[CharacterIndexEntry]>;
		/** Rail-top slot, above the search field — e.g. a count + close button. */
		headerEnd?: Snippet;
		/** Extra rail sections around the identity groups: railStart sits between
		 *  the search field and Element, railEnd after Region. Search, the
		 *  identity groups and Clear stay the grid's. */
		railStart?: Snippet;
		railEnd?: Snippet;
		/** Rendered INSIDE the scroll container, before / after the grid — a count
		 *  line above, a secondary bucket (the TB's "not yet curated") below. */
		aboveGrid?: Snippet;
		belowGrid?: Snippet;
		/** Lets a consumer's own filters light up the shared Clear button, and be
		 *  cleared by it. Without these the button would clear half the rail. */
		extraFiltersActive?: boolean;
		onClearExtras?: () => void;
		/** The picker's rail is narrow enough to want the short form. */
		searchPlaceholder?: string;
	} = $props();

	const ELEMENTS: Element[] = ['anemo', 'cryo', 'dendro', 'electro', 'geo', 'hydro', 'pyro'];
	const WEAPONS: WeaponType[] = ['sword', 'claymore', 'polearm', 'bow', 'catalyst'];
	const RARITIES = [4, 5] as const;

	const allRegions = $derived(
		[...new Set(roster.map((c) => c.region).filter(Boolean) as string[])].sort()
	);

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

	const anyActive = $derived(
		filters.elements.size > 0 ||
			filters.weapons.size > 0 ||
			filters.rarities.size > 0 ||
			(filters.factionBuffs?.size ?? 0) > 0 ||
			filters.region !== '' ||
			filters.search.trim() !== '' ||
			extraFiltersActive
	);

	function toggleSet<T>(set: SvelteSet<T>, val: T): void {
		if (set.has(val)) set.delete(val);
		else set.add(val);
	}

	function clearFilters(): void {
		filters.elements.clear();
		filters.weapons.clear();
		filters.rarities.clear();
		filters.factionBuffs?.clear();
		filters.region = '';
		filters.search = '';
		onClearExtras?.();
	}

	function elColor(element: string | undefined): string {
		return (elementColors[(element ?? 'none') as ElementKey] ?? elementColors.none).main;
	}
</script>

<div class="cg">
	<!-- The scroller, not the grid itself: aboveGrid/belowGrid ride along inside
	     it so a count line and a secondary bucket scroll with the tiles. -->
	<div class="cg-scroll">
		{#if aboveGrid}{@render aboveGrid()}{/if}

		<div class="cg-grid">
			{#each shown as entry (entry.id)}
				{@render tile(entry)}
			{/each}
			{#if filtered.length === 0}
				<p class="cg-empty">{emptyMessage}</p>
			{/if}
		</div>

		{#if belowGrid}{@render belowGrid()}{/if}
	</div>

	{#if showFilterRail}
		<aside class="cg-rail" class:cg-rail--left={railSide === 'left'}>
			{#if headerEnd}
				<div class="cg-rail-head">{@render headerEnd()}</div>
			{/if}

			<!-- The rail's search box used to be a bare .field whose only affordance
			     was its placeholder, sitting in a column of chips and kickers that
			     look much like it. The mark is what says "type here to filter"
			     before anyone reads a word. -->
			<div class="cg-search">
				<Mark name="search" size={13} />
				<input
					class="field cg-search-field"
					type="text"
					placeholder={searchPlaceholder}
					bind:value={filters.search}
					autocomplete="off"
					autocorrect="off"
					spellcheck={false}
				/>
			</div>

			{#if railStart}{@render railStart()}{/if}

			<div class="cg-sec">
				<p class="kicker">Element</p>
				<div class="chips">
					{#each ELEMENTS as el (el)}
						<button
							class="chip chip--element"
							class:active={filters.elements.has(el)}
							style:--chip-color={elColor(el)}
							aria-pressed={filters.elements.has(el)}
							onclick={() => toggleSet(filters.elements, el)}>{el}</button
						>
					{/each}
				</div>
			</div>

			<div class="cg-sec">
				<p class="kicker">Weapon</p>
				<div class="chips">
					{#each WEAPONS as w (w)}
						<button
							class="chip"
							class:active={filters.weapons.has(w)}
							aria-pressed={filters.weapons.has(w)}
							onclick={() => toggleSet(filters.weapons, w)}>{w}</button
						>
					{/each}
				</div>
			</div>

			<div class="cg-sec">
				<p class="kicker">Rarity</p>
				<div class="chips">
					{#each RARITIES as r (r)}
						<button
							class="chip"
							class:active={filters.rarities.has(r)}
							aria-pressed={filters.rarities.has(r)}
							onclick={() => toggleSet(filters.rarities, r)}>{r}★</button
						>
					{/each}
				</div>
			</div>

			<div class="cg-sec">
				<p class="kicker">Region</p>
				<div class="chips">
					{#each allRegions as region (region)}
						<button
							class="chip"
							class:active={filters.region === region}
							aria-pressed={filters.region === region}
							onclick={() => (filters.region = filters.region === region ? '' : region)}
							>{region}</button
						>
					{/each}
				</div>
			</div>

			{#if railEnd}{@render railEnd()}{/if}

			{#if anyActive}
				<button class="btn" onclick={clearFilters}>Clear filters</button>
			{/if}
		</aside>
	{/if}
</div>

<style>
	.cg {
		/* A scroll container clips everything that paints outside its content
		   box, and `overflow-y: auto` forces `overflow-x` to `auto` too — so a
		   vertical scroller clips on all FOUR edges. Two things here paint
		   outside their element: the shared focus ring (2px outline at 2px
		   offset = 4px past a .field or .chip) and a card's 1px hover rise.
		   Without a gutter the rail ate the ring's left and right edges and the
		   grid's top row lost its top border on hover.
		   The gutter also SUPPLIES the rail↔grid separation (hence gap: 0):
		   6px + 6px is the 12px that used to be a gap, so tuning this knob
		   keeps the interior breathing room self-consistent. */
		--cg-gutter: 6px;

		display: flex;
		flex-direction: row;
		gap: 0;
		flex: 1;
		min-width: 0;
		min-height: 0;
	}

	/* ── Scroller (the bounded column the tiles live in) ─────────── */
	/* The bounded-scroll chain needs min-height:0 at EVERY flex level above
	   this; break one and the column grows instead of scrolling. */
	.cg-scroll {
		flex: 1;
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
		/* Clearance for the cards' hover rise — see --cg-gutter on .cg. */
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
	.cg-empty {
		grid-column: 1 / -1;
		margin: 1rem 0;
		font-size: var(--fs-sm);
		color: var(--muted);
	}

	/* ── Filter rail ─────────────────────────────────────────────── */
	/* Right by default (the planner's picker); the Team Builder flips it left
	   with `order`, so the DOM stays grid-first either way. */
	/* Flat by design — both tools put this on a .frame ground, which IS the
	   surface (nothing inside a frame wears .panel). The width stays the
	   CONTENT column: the gutter is added on top, so the focus rings get their
	   room without the chip rows reflowing narrower. */
	.cg-rail {
		flex-shrink: 0;
		width: calc(var(--cg-rail-w, 210px) + 2 * var(--cg-gutter));
		align-self: stretch;
		overflow-y: auto;
		/* Clearance for the focus ring — see --cg-gutter on .cg. */
		padding: var(--cg-gutter);
		display: grid;
		align-content: start;
		gap: 1rem;
	}
	.cg-rail--left {
		order: -1;
	}
	.cg-rail-head {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
	}

	/* The mark is painted OVER the field rather than inside a bordered wrapper,
	   so .field keeps owning its own inset stroke and focus ring — the ring
	   still traces the input, not a box drawn around it. pointer-events:none so
	   a click on the mark lands in the field. */
	.cg-search {
		position: relative;
		display: flex;
		align-items: center;
	}
	.cg-search :global(.mark) {
		position: absolute;
		left: 0.6rem;
		color: var(--muted);
		pointer-events: none;
	}
	.cg-search-field {
		padding-left: calc(0.6rem + 13px + 0.4rem);
	}

	.cg-sec .kicker {
		margin-bottom: 0.5rem;
	}
</style>
