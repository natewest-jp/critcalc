<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CharacterIndexEntry } from '$lib/types/character';
	import { matchesIdentity, type IdentityFilters } from '$lib/characterFilters';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import type { Element } from '$lib/types/ability';
	import type { WeaponType } from '$lib/types/weapon';
	import type { SvelteSet } from 'svelte/reactivity';

	// ---------------------------------------------------------------------------
	// Shared roster grid: an identity-filter header (search + element / weapon /
	// rarity / region) over a scrolling character grid. Tile visuals stay per
	// consumer via the `tile` snippet — the Team Builder carries badges / compare
	// toggles / ownership; the planner's Source overlay carries the slot badge.
	// Identity filtering is the shared `matchesIdentity`; capability facets and
	// ownership stay the Team Builder's concern (passed in via `extraFilter`).
	// ---------------------------------------------------------------------------

	/** The mutable filter state the header binds to (the sets are SvelteSets so
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
		/** Render the identity-filter header. Off = grid only (consumer supplies
		 *  its own filter chrome). */
		showFilterRail?: boolean;
		/** Extra predicate ANDed after the identity match (facets, ownership, …). */
		extraFilter?: (entry: CharacterIndexEntry) => boolean;
		emptyMessage?: string;
		tile: Snippet<[CharacterIndexEntry]>;
		/** Trailing slot on the header's search row — e.g. a close button. */
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

	function toggleSet<T>(set: SvelteSet<T>, val: T): void {
		if (set.has(val)) set.delete(val);
		else set.add(val);
	}

	function elColor(element: string | undefined): string {
		return (elementColors[(element ?? 'none') as ElementKey] ?? elementColors.none).main;
	}
</script>

<div class="cg">
	{#if showFilterRail}
		<div class="cg-header">
			<div class="cg-search-row">
				<input
					class="cg-search"
					type="text"
					placeholder="Search characters…"
					bind:value={filters.search}
					autocomplete="off"
					autocorrect="off"
					spellcheck={false}
				/>
				{@render headerEnd?.()}
			</div>
			<div class="cg-chips">
				{#each ELEMENTS as el (el)}
					<button
						class="cg-chip cg-chip--element"
						class:cg-chip--active={filters.elements.has(el)}
						style:--chip-color={elColor(el)}
						aria-pressed={filters.elements.has(el)}
						onclick={() => toggleSet(filters.elements, el)}>{el}</button
					>
				{/each}
				<span class="cg-chip-sep"></span>
				{#each WEAPONS as w (w)}
					<button
						class="cg-chip"
						class:cg-chip--active={filters.weapons.has(w)}
						aria-pressed={filters.weapons.has(w)}
						onclick={() => toggleSet(filters.weapons, w)}>{w}</button
					>
				{/each}
				<span class="cg-chip-sep"></span>
				{#each RARITIES as r (r)}
					<button
						class="cg-chip"
						class:cg-chip--active={filters.rarities.has(r)}
						aria-pressed={filters.rarities.has(r)}
						onclick={() => toggleSet(filters.rarities, r)}>{r}★</button
					>
				{/each}
				<span class="cg-chip-sep"></span>
				{#each allRegions as region (region)}
					<button
						class="cg-chip"
						class:cg-chip--active={filters.region === region}
						aria-pressed={filters.region === region}
						onclick={() => (filters.region = filters.region === region ? '' : region)}
						>{region}</button
					>
				{/each}
			</div>
		</div>
	{/if}

	<div class="cg-grid">
		{#each filtered as entry (entry.id)}
			{@render tile(entry)}
		{/each}
	</div>

	{#if filtered.length === 0}
		<p class="cg-empty">{emptyMessage}</p>
	{/if}
</div>

<style>
	.cg {
		display: flex;
		flex-direction: column;
		min-height: 0;
		gap: 10px;
	}

	/* ── Filter header ────────────────────────────────────────── */
	.cg-header {
		display: flex;
		flex-direction: column;
		gap: 8px;
		flex-shrink: 0;
	}

	.cg-search-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	/* Same field affordance as the notation editor: hairline ring, hover
	   brighten, accent focus ring. */
	.cg-search {
		flex: 1;
		min-width: 0;
		box-sizing: border-box;
		background: #0a101f;
		border: none;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.09);
		border-radius: 6px;
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		padding: 8px 12px;
		outline: none;
		transition: box-shadow 150ms ease;
	}
	.cg-search:hover {
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
	}
	.cg-search:focus {
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 50%, transparent);
	}

	.cg-chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
	}
	.cg-chip-sep {
		width: 1px;
		align-self: stretch;
		margin: 2px 4px;
		background: rgba(255, 255, 255, 0.1);
	}

	/* Filter chips: the shared selected-chip idiom — quiet fill, active = tinted
	   fill + inset ring (accent, or the element's color). */
	.cg-chip {
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		padding: 3px 7px 4px;
		border-radius: 3px;
		border: none;
		background: rgba(255, 255, 255, 0.05);
		color: var(--muted);
		cursor: pointer;
		text-transform: capitalize;
		letter-spacing: var(--ls-tight);
		transition:
			color 150ms ease,
			background 150ms ease,
			box-shadow 150ms ease;
	}
	.cg-chip:hover {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--text);
	}
	.cg-chip--active {
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent);
		color: var(--text);
	}
	.cg-chip--element:hover {
		background: color-mix(in srgb, var(--chip-color) 14%, transparent);
	}
	.cg-chip--element.cg-chip--active {
		background: color-mix(in srgb, var(--chip-color) 20%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--chip-color) 55%, transparent);
		color: color-mix(in srgb, var(--chip-color) 75%, white);
	}

	/* ── Grid ─────────────────────────────────────────────────── */
	.cg-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
		gap: 8px;
		align-content: start;
		overflow-y: auto;
		min-height: 0;
		flex: 1;
	}

	.cg-empty {
		margin: 1rem 0;
		font-size: var(--fs-sm);
		color: var(--muted);
	}
</style>
