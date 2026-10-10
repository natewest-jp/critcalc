<script lang="ts">
	/**
	 * THE ROSTER'S FILTER BAR (Party Setup shape, design doc §11.2 — build step 1).
	 *
	 * The filters live IN the roster column, as the game keeps its filter inside
	 * the character column: the board beside it is what you are filtering FOR,
	 * so nothing here may cover it. The old filter column (an aside, then a
	 * drawer over the board in the split) and the Atlas role cards retire into
	 * this one plate.
	 *
	 *   row 1 — search · All / Owned / Wishlist · More ▾ · Clear
	 *   row 2 — the four roles as icons · the seven elements · the count
	 *
	 * "More" holds the rarer groups (weapon, rarity, region, factions, the
	 * capability facets until the fingerprint becomes the filter in step 4).
	 * ⚠ It hangs from its trigger's END edge and opens LEFTWARD, so it stays
	 * over the roster column — hung from the start, it grew over the board.
	 *
	 * It owns no state: every set is the page's, the same objects the grid
	 * filters against.
	 */
	import type { SvelteSet } from 'svelte/reactivity';
	import type { CharacterIndexEntry } from '$lib/types/character';
	import type { GridFilters } from '$lib/characterFilters';
	import type { Element } from '$lib/types/ability';
	import type { WeaponType } from '$lib/types/weapon';
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { positionIcon, functionIcon } from '$lib/utils/roleIcons';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import Mark from '$lib/components/Mark.svelte';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import { ROLE_CATEGORIES, type RoleCategory } from './roles';
	import { FACETS, type FacetKey, type OwnershipView } from './facets';

	let {
		roster,
		filters,
		activeFacets,
		activeRole,
		onRole,
		ownershipView = $bindable(),
		count,
		countNote,
		anyActive,
		onClear
	}: {
		/** The UNFILTERED roster — Region's choices are drawn from it (from the
		 *  filtered list, choosing a region would collapse the group to itself). */
		roster: CharacterIndexEntry[];
		filters: GridFilters;
		activeFacets: SvelteSet<FacetKey>;
		/** The role the filter currently is, if it is exactly one. */
		activeRole: string | null;
		onRole: (cat: RoleCategory) => void;
		ownershipView: OwnershipView;
		count: number;
		/** "at your constellations" — the lens the count was read at. */
		countNote?: string;
		anyActive: boolean;
		onClear: () => void;
	} = $props();

	const ELEMENTS: Element[] = ['anemo', 'cryo', 'dendro', 'electro', 'geo', 'hydro', 'pyro'];
	const WEAPONS: WeaponType[] = ['sword', 'claymore', 'polearm', 'bow', 'catalyst'];
	const RARITIES = [4, 5] as const;
	const OWNERSHIP_VIEWS: { key: OwnershipView; label: string; hint: string }[] = [
		{ key: 'all', label: 'All', hint: 'Every character' },
		{ key: 'owned', label: 'Owned', hint: 'Only characters you’ve marked as owned' },
		{ key: 'wishlist', label: 'Wishlist', hint: 'Only characters you’ve wishlisted' }
	];
	// Factions/Buffs — faction membership for Moonsign/Hexerei; "Stellar" is
	// enabler-or-gated-buffs (no faction exists for Stellar).
	const FACTION_BUFFS = [
		{
			key: 'moonsign',
			label: 'Moonsign',
			hint: 'Moonsign characters — 2 or more enable Ascendant Gleam and the Lunar reactions'
		},
		{
			key: 'hexerei',
			label: 'Hexerei',
			hint: 'Hexerei characters — 2 or more enable Hexerei: Secret Rite'
		},
		{
			key: 'stellar',
			label: 'Stellar',
			hint: 'Stellar-linked — enables a Stellar reaction, or has buffs that need one enabled'
		}
	] as const;

	const allRegions = $derived(
		[...new Set(roster.map((c) => c.region).filter(Boolean) as string[])].sort()
	);

	/** How many choices are hidden inside More — its trigger says so, or a
	 *  filter you set and closed would be invisible in the bar. */
	const moreCount = $derived(
		filters.weapons.size +
			filters.rarities.size +
			(filters.region ? 1 : 0) +
			(filters.factionBuffs?.size ?? 0) +
			activeFacets.size
	);

	function toggleSet<T>(set: SvelteSet<T>, val: T): void {
		if (set.has(val)) set.delete(val);
		else set.add(val);
	}
	const elColor = (el: string) => (elementColors[el as ElementKey] ?? elementColors.none).main;
</script>

<div class="rfb ctx-glass" role="search" aria-label="Filter characters">
	<div class="rfb-row">
		<!-- The mark is painted OVER the field, so .field keeps owning its inset
		     stroke and focus ring (the old rail's search, same reasoning). -->
		<div class="rfb-search">
			<Mark name="search" size={13} />
			<input
				class="field rfb-search-field"
				type="text"
				placeholder="Search…"
				aria-label="Search characters"
				bind:value={filters.search}
				autocomplete="off"
				autocorrect="off"
				spellcheck={false}
			/>
		</div>
		<div class="segment rfb-own" role="radiogroup" aria-label="Show">
			{#each OWNERSHIP_VIEWS as v (v.key)}
				<button
					class="btn"
					class:is-active={ownershipView === v.key}
					role="radio"
					aria-checked={ownershipView === v.key}
					title={v.hint}
					onclick={() => (ownershipView = v.key)}>{v.label}</button
				>
			{/each}
		</div>
		<BandMenu
			role="dialog"
			align="end"
			mark="filter"
			label={moreCount > 0 ? `More · ${moreCount}` : 'More'}
			ariaLabel="More filters"
		>
			{#snippet items()}
				<div class="rfb-more">
					<div class="rfb-group">
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
					<div class="rfb-group">
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
					<div class="rfb-group">
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
					<div class="rfb-group">
						<p class="kicker">Factions / Buffs</p>
						<div class="chips">
							{#each FACTION_BUFFS as fb (fb.key)}
								<button
									class="chip"
									class:active={filters.factionBuffs?.has(fb.key)}
									title={fb.hint}
									aria-pressed={filters.factionBuffs?.has(fb.key)}
									onclick={() => filters.factionBuffs && toggleSet(filters.factionBuffs, fb.key)}
									>{fb.label}</button
								>
							{/each}
						</div>
					</div>
					<!-- ⏭ Step 4: the fingerprint's glyphs become this filter. -->
					<div class="rfb-group">
						<p class="kicker">Can provide</p>
						<div class="chips">
							{#each FACETS as facet (facet.key)}
								<button
									class="chip"
									class:active={activeFacets.has(facet.key)}
									title={facet.hint}
									aria-pressed={activeFacets.has(facet.key)}
									onclick={() => toggleSet(activeFacets, facet.key)}>{facet.label}</button
								>
							{/each}
						</div>
						{#if activeFacets.size > 1}
							<p class="note rfb-note">Matching characters provide all of these.</p>
						{/if}
					</div>
				</div>
			{/snippet}
		</BandMenu>
		{#if anyActive}
			<button class="btn rfb-clear" onclick={onClear}>Clear</button>
		{/if}
	</div>

	<div class="rfb-row">
		<div class="rfb-icons" role="group" aria-label="Role">
			{#each ROLE_CATEGORIES as cat (cat.key)}
				{@const on = activeRole === cat.key}
				<button
					class="btn btn--icon rfb-role"
					class:is-active={on}
					aria-pressed={on}
					aria-label={cat.label}
					title={on ? 'Show every role again' : cat.label}
					onclick={() => onRole(cat)}
				>
					{#if cat.position}<img src={positionIcon(cat.position, 'color')} alt="" />{/if}
					<img src={functionIcon(cat.function, 'color')} alt="" />
				</button>
			{/each}
		</div>
		<div class="rfb-icons" role="group" aria-label="Element">
			{#each ELEMENTS as el (el)}
				{@const on = filters.elements.has(el)}
				<button
					class="btn btn--icon rfb-el"
					class:is-active={on}
					style:--el={elColor(el)}
					aria-pressed={on}
					aria-label={el}
					title={el[0].toUpperCase() + el.slice(1)}
					onclick={() => toggleSet(filters.elements, el)}
				>
					<img src={elementIcon(el)} alt="" />
				</button>
			{/each}
		</div>
		<p class="rfb-count" role="status">
			{count} character{count === 1 ? '' : 's'}{#if countNote}<span class="rfb-count-note">
					{countNote}</span
				>{/if}
		</p>
	</div>
</div>

<style>
	/* One glass plate — "glass touches" — whose groups sit at EVEN gaps with no
	   rules between them (⚓ Nate's toolbar rulings). */
	.rfb {
		--rfb-gap: 0.5rem;
		flex: none;
		display: flex;
		flex-direction: column;
		gap: var(--rfb-gap);
		padding: 0.5rem;
		border-radius: var(--r-md);
	}
	.rfb-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--rfb-gap) 1rem;
	}
	.rfb-search {
		position: relative;
		/* A small basis so row 1 holds at the dock's narrowest roster (495px at
		   1137): search, the Show segment and More on one line. */
		flex: 1 1 8rem;
		min-width: 8rem;
		display: flex;
		align-items: center;
	}
	.rfb-search :global(.mark) {
		position: absolute;
		left: 0.6rem;
		color: var(--muted);
		pointer-events: none;
	}
	.rfb-search-field {
		width: 100%;
		padding-left: calc(0.6rem + 13px + 0.4rem);
	}
	.rfb-icons {
		display: flex;
		gap: 4px;
	}
	.rfb-role,
	.rfb-el {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 1px;
		height: 30px;
		min-width: 30px;
	}
	.rfb-role img {
		width: 16px;
		height: 16px;
		object-fit: contain;
	}
	.rfb-el img {
		width: 18px;
		height: 18px;
		object-fit: contain;
	}
	/* An element is chosen in its own hue — the element chip's grammar. */
	.rfb-el.is-active {
		box-shadow: inset 0 0 0 1px var(--el);
	}
	.rfb-count {
		margin: 0 0 0 auto;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
		white-space: nowrap;
	}
	.rfb-count-note {
		text-transform: none;
		letter-spacing: var(--ls-tight);
		font-weight: var(--fw-regular, 400);
	}

	/* The popover's contents: the old rail's groups, each its own object. */
	.rfb-more {
		display: grid;
		gap: 0.6rem;
		width: min(24rem, calc(100vw - 2rem));
		padding: 0.6rem;
	}
	.rfb-group .kicker {
		margin-bottom: 0.45rem;
	}
	.rfb-note {
		margin-top: 0.45rem;
		font-size: var(--fs-md);
	}
</style>
