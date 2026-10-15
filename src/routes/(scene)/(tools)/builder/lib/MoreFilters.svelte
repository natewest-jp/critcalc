<script lang="ts">
	/**
	 * THE "MORE" POPOVER'S CONTENTS (design doc §11.2 / §11.6) — the rarer
	 * filters: weapon, rarity, region, factions. (The capability facets left
	 * for the filter strip in step 4 — the fingerprint's glyphs are that filter.)
	 *
	 * When band B's character cell is too narrow to hold them, the Show segment
	 * and the constellation lens FOLD in here too, at the top — the cell keeps
	 * search and this button, and nothing is ever out of reach.
	 */
	import type { Snippet } from 'svelte';
	import type { SvelteSet } from 'svelte/reactivity';
	import type { CharacterIndexEntry } from '$lib/types/character';
	import { regionChips, type GridFilters } from '$lib/characterFilters';
	import type { WeaponType } from '$lib/types/weapon';
	import { OWNERSHIP_VIEWS, type OwnershipView } from './facets';

	let {
		roster,
		filters,
		ownershipView = $bindable(),
		showOwnership = false,
		lens,
		close
	}: {
		/** The UNFILTERED roster — Region's choices are drawn from it. */
		roster: CharacterIndexEntry[];
		filters: GridFilters;
		ownershipView: OwnershipView;
		/** The Show segment, folded in from the cell. */
		showOwnership?: boolean;
		/** The constellation lens's items, folded in from the cell. */
		lens?: Snippet<[() => void]>;
		close: () => void;
	} = $props();

	const WEAPONS: WeaponType[] = ['sword', 'claymore', 'polearm', 'bow', 'catalyst'];
	const RARITIES = [4, 5] as const;
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

	const allRegions = $derived(regionChips(roster));

	function toggleSet<T>(set: SvelteSet<T>, val: T): void {
		if (set.has(val)) set.delete(val);
		else set.add(val);
	}
</script>

<div class="mf">
	{#if showOwnership}
		<div class="mf-group">
			<p class="kicker">Show</p>
			<div class="segment" role="radiogroup" aria-label="Show">
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
		</div>
	{/if}
	{#if lens}
		<div class="mf-group">
			<p class="kicker">Read capabilities at</p>
			<div class="mf-lens">{@render lens(close)}</div>
		</div>
	{/if}
	<div class="mf-group">
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
	<div class="mf-group">
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
	<div class="mf-group">
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
	<div class="mf-group">
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
</div>

<style>
	.mf {
		display: grid;
		gap: 0.6rem;
		width: min(24rem, calc(100vw - 2rem));
		/* The cap is measured from where the popover OPENS (top ≈ 143px under
		   band B, + its 4px frame), not a guess: at 8rem the box ran 19px past
		   the foot of any screen shorter than ~650px (844x390, 320x568). 10rem
		   lands the foot ~13px clear at every height. */
		max-height: min(32rem, calc(100svh - 10rem));
		overflow-y: auto;
		padding: 0.6rem;
	}
	.mf-group .kicker {
		margin-bottom: 0.45rem;
	}
	.mf-lens {
		display: grid;
	}
</style>
