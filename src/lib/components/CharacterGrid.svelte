<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CharacterIndexEntry } from '$lib/types/character';
	import { matchesIdentity, type IdentityFilters } from '$lib/characterFilters';
	import { createProgressiveReveal } from '$lib/utils/progressiveReveal.svelte';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import type { Element } from '$lib/types/ability';
	import type { WeaponType } from '$lib/types/weapon';
	import type { SvelteSet } from 'svelte/reactivity';

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
	};

	let {
		roster,
		filters,
		showFilterRail = true,
		extraFilter,
		emptyMessage = 'No characters match these filters.',
		tile,
		headerEnd
	}: {
		roster: CharacterIndexEntry[];
		filters: GridFilters;
		/** Render the identity-filter rail. Off = grid only (consumer supplies
		 *  its own filter chrome). */
		showFilterRail?: boolean;
		/** Extra predicate ANDed after the identity match (facets, ownership, …). */
		extraFilter?: (entry: CharacterIndexEntry) => boolean;
		emptyMessage?: string;
		tile: Snippet<[CharacterIndexEntry]>;
		/** Rail-top slot, above the search field — e.g. a count + close button. */
		headerEnd?: Snippet;
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
			filters.region !== '' ||
			filters.search.trim() !== ''
	);

	function toggleSet<T>(set: SvelteSet<T>, val: T): void {
		if (set.has(val)) set.delete(val);
		else set.add(val);
	}

	function clearFilters(): void {
		filters.elements.clear();
		filters.weapons.clear();
		filters.rarities.clear();
		filters.region = '';
		filters.search = '';
	}

	function elColor(element: string | undefined): string {
		return (elementColors[(element ?? 'none') as ElementKey] ?? elementColors.none).main;
	}
</script>

<div class="cg">
	<div class="cg-grid">
		{#each shown as entry (entry.id)}
			{@render tile(entry)}
		{/each}
		{#if filtered.length === 0}
			<p class="cg-empty">{emptyMessage}</p>
		{/if}
	</div>

	{#if showFilterRail}
		<aside class="cg-rail panel">
			{#if headerEnd}
				<div class="cg-rail-head">{@render headerEnd()}</div>
			{/if}

			<input
				class="cg-search"
				type="text"
				placeholder="Search…"
				bind:value={filters.search}
				autocomplete="off"
				autocorrect="off"
				spellcheck={false}
			/>

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

			{#if anyActive}
				<button class="btn" onclick={clearFilters}>Clear filters</button>
			{/if}
		</aside>
	{/if}
</div>

<style>
	.cg {
		display: flex;
		flex-direction: row;
		gap: 12px;
		flex: 1;
		min-width: 0;
		min-height: 0;
	}

	/* ── Grid (left, scrolls) ─────────────────────────────────── */
	.cg-grid {
		flex: 1;
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
		/* Content-sized rows — without this, a bounded grid shrinks its `auto`
		   rows toward min-content when the roster overflows (the aspect-ratio
		   portraits collapse), squishing the cards instead of scrolling. */
		grid-auto-rows: max-content;
		gap: 8px;
		align-content: start;
	}
	.cg-empty {
		grid-column: 1 / -1;
		margin: 1rem 0;
		font-size: var(--fs-sm);
		color: var(--muted);
	}

	/* ── Filter rail (right, the Team Builder's filter column) ──── */
	.cg-rail {
		flex-shrink: 0;
		width: 210px;
		align-self: stretch;
		overflow-y: auto;
		gap: 1rem;
	}
	.cg-rail-head {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
	}

	.cg-search {
		box-sizing: border-box;
		width: 100%;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 3px;
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--fs-md);
		padding: 0.5rem 0.7rem;
		outline: none;
		transition: border-color 150ms ease;
	}
	.cg-search:focus {
		border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
	}

	.cg-sec .kicker {
		margin-bottom: 0.5rem;
	}
</style>
