<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CharacterIndexEntry } from '$lib/types/character';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import type { Element } from '$lib/types/ability';
	import type { WeaponType } from '$lib/types/weapon';
	import type { SvelteSet } from 'svelte/reactivity';
	import { regionChips, type GridFilters } from '$lib/characterFilters';
	import Mark from './Mark.svelte';
	import { scrollFade } from '$lib/actions/scrollFade';

	// ---------------------------------------------------------------------------
	// THE FILTER COLUMN — search + the identity chip groups (element / weapon /
	// rarity / region) + Clear, shared by the Team Builder's Roster and the
	// planner's character Source.
	//
	// It was CharacterGrid's `<aside>` until the aside-column round (2026-08-08),
	// packed inside the grid component and separated from the tiles by nothing
	// but the scroll gutter. It is its own BOX now — the aside column of a
	// ToolColumns surface, on the dark context (⚓ NATE) — which means the grid
	// and the column are two siblings a tool places, not one component's private
	// layout. Consumers keep their extra sections through railStart / railEnd.
	//
	// It owns no filter state: `filters` is the consumer's $state object (the
	// same one CharacterGrid filters against), and the capability facets each
	// tool adds ride in through extraFiltersActive / onClearExtras so one Clear
	// press empties the whole column.
	// ---------------------------------------------------------------------------

	let {
		roster,
		filters,
		headerEnd,
		railStart,
		railEnd,
		extraFiltersActive = false,
		onClearExtras,
		searchPlaceholder = 'Search…'
	}: {
		/**
		 * The roster the Region chips are drawn from. Pass the UNFILTERED list:
		 * derived from the filtered one, choosing a region collapses the group to
		 * the single chip you just pressed and there is no way back but Clear.
		 */
		roster: CharacterIndexEntry[];
		filters: GridFilters;
		/** Column-top slot, above the search field — e.g. a count + close button. */
		headerEnd?: Snippet;
		/** Extra sections around the identity groups: railStart sits between the
		 *  search field and Element, railEnd after Region. Search, the identity
		 *  groups and Clear stay this component's. */
		railStart?: Snippet;
		railEnd?: Snippet;
		/** Lets a consumer's own filters light up the shared Clear button, and be
		 *  cleared by it. Without these the button would clear half the column. */
		extraFiltersActive?: boolean;
		onClearExtras?: () => void;
		/** The picker's column is narrow enough to want the short form. */
		searchPlaceholder?: string;
	} = $props();

	const ELEMENTS: Element[] = ['anemo', 'cryo', 'dendro', 'electro', 'geo', 'hydro', 'pyro'];
	const WEAPONS: WeaponType[] = ['sword', 'claymore', 'polearm', 'bow', 'catalyst'];
	const RARITIES = [4, 5] as const;

	const allRegions = $derived(regionChips(roster));

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

<aside class="cg-rail scroll-fade" aria-label="Filters" use:scrollFade>
	{#if headerEnd}
		<div class="cg-rail-head">{@render headerEnd()}</div>
	{/if}

	<!-- The search box used to be a bare .field whose only affordance was its
	     placeholder, sitting in a column of chips and kickers that look much like
	     it. The mark is what says "type here to filter" before anyone reads a
	     word. -->
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

<style>
	/* ── The column ───────────────────────────────────────────────
	   Fills the aside box it is handed — the WIDTH is the shell's knob now
	   (ASIDE_W), not a --cg-rail-w each tool set for itself.

	   The gutter is not decoration: `overflow-y: auto` forces `overflow-x` to
	   `auto` too, so a vertical scroller clips on all FOUR edges, and the shared
	   focus ring paints 4px past a .field or .chip. Without it the column ate
	   the rings' left and right edges. */
	.cg-rail {
		--cg-gutter: 6px;
		/* 🎛️ The roll-off (.scroll-fade + use:scrollFade), and here it is doing a
		   JOB rather than a polish: ⚓ NATE — because the column is SEGMENTED with
		   gaps, a group clipped at the viewport edge reads as the column simply
		   ending, so the rail never signalled that there was more below. A fading
		   edge is the signal.
		   Shorter than the grid's 36: these groups are ~60–100px tall, and a fade
		   long enough for a card would dissolve half a filter section. */
		--scroll-fade: 24px;

		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--cg-gutter);
		display: grid;
		align-content: start;
		gap: 1rem;
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

	/* ── A GROUP IS AN OBJECT (breathing-room round, 2026-08-08) ──
	   Eight labelled groups — search · roster · role · factions · can-provide ·
	   element · weapon · rarity · region — used to be eight sections of one
	   continuous box, separated by nothing but a 1rem gap. That made the
	   densest column on the site read as a single wall of chips: the eye had
	   nothing to rest on between "Element" and "Weapon" except a label.
	   Genshin's mission lists do the opposite — every row is its own small
	   plate on the backdrop — and that is what this is.

	   Each group now paints its own ground, so the aside can go GROUNDLESS
	   (ToolColumns' asideBare) and the column becomes objects with scene
	   between them. Costs ~9 × padding of scroll height in a column that
	   already scrolls; buys the whole rail a rhythm.

	   ⚠ The RAISED rung, not --surface: with the box gone there is no ground
	   for these to lift off, so they take the value the box itself had — the
	   groups inherit the column's old weight rather than stacking a second
	   rung on top of it.

	   ⚠ :global, and it has to be. FOUR of the eight groups are injected by the
	   Team Builder through the railStart snippet, so their markup is authored in
	   that page and Svelte scopes styles to where markup lives, not where it
	   renders. A plain `.cg-sec` rule here would paint the rail's own four and
	   silently skip the tool's — which is the same trap the TB's local
	   `.tb-chips { margin-top }` was already working around. Scoped under
	   `.cg-rail` so it cannot escape this column. */
	.cg-rail :global(.cg-sec) {
		padding: 0.55rem 0.6rem;
		border-radius: var(--r-sm);
		background: var(--surface-raised);
	}

	.cg-rail :global(.cg-sec .kicker) {
		margin-bottom: 0.5rem;
	}
</style>
