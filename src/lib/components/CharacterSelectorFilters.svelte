<script lang="ts">
	import CharacterFilterRail from '$lib/components/CharacterFilterRail.svelte';
	import CloseMark from '$lib/components/CloseMark.svelte';
	import { getAllCharacterIndex } from '$lib/data/characterLookup';
	import { FACETS } from '$lib/capabilities/facets';
	import { pickerFilters as pf } from '$lib/pickerFilters.svelte';
	import type { SvelteSet } from 'svelte/reactivity';

	// ---------------------------------------------------------------------------
	// The character Source's FILTER COLUMN — the aside half of the planner's
	// picker (aside-column round, 2026-08-08). It covers the notes column exactly
	// as <CharacterSelector>'s cards cover the timeline; the two halves share
	// nothing but $lib/pickerFilters.
	//
	// The shared identity groups come from <CharacterFilterRail>; what is local
	// here is the pair of groups the planner adds — faction membership, and the
	// capability facets — plus the count/close head.
	//
	// Role and the roster ledger stay TB-only: roles are soft editorial scoping
	// for browsing, and ownership is roster management — neither is a question
	// you are asking while filling a rotation's four slots.
	// ---------------------------------------------------------------------------

	let {
		chosenCount,
		onClose
	}: {
		/** How many of the four slots are filled — the head's live readout. */
		chosenCount: number;
		onClose: () => void;
	} = $props();

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

	// The Region chips are drawn from the WHOLE index, never a filtered subset —
	// otherwise choosing a region collapses the group to the one chip you just
	// pressed. Blank is a placeholder kit, not a character.
	const allCharacters = getAllCharacterIndex().filter((c) => c.id !== 'blank');

	function toggleSet<T>(set: SvelteSet<T>, val: T): void {
		if (set.has(val)) set.delete(val);
		else set.add(val);
	}
</script>

<CharacterFilterRail
	roster={allCharacters}
	filters={pf.filters}
	searchPlaceholder="Search…"
	extraFiltersActive={pf.extraActive}
	onClearExtras={() => pf.clearExtras()}
	{headerEnd}
	railStart={extraGroups}
/>

{#snippet headerEnd()}
	<span class="cs-count" aria-live="polite">{chosenCount}/4</span>
	<button class="cs-close-btn" onclick={onClose} aria-label="Close character picker">
		<CloseMark />
	</button>
{/snippet}

{#snippet extraGroups()}
	<div class="cg-sec">
		<p class="kicker">Factions / Buffs</p>
		<div class="chips">
			{#each FACTION_BUFFS as fb (fb.key)}
				<button
					class="chip"
					class:active={pf.filters.factionBuffs?.has(fb.key)}
					title={fb.hint}
					aria-pressed={pf.filters.factionBuffs?.has(fb.key)}
					onclick={() => pf.filters.factionBuffs && toggleSet(pf.filters.factionBuffs, fb.key)}
					>{fb.label}</button
				>
			{/each}
		</div>
	</div>

	<div class="cg-sec">
		<p class="kicker">Can provide</p>
		<div class="chips">
			{#each FACETS as facet (facet.key)}
				<button
					class="chip"
					class:active={pf.activeFacets.has(facet.key)}
					title={facet.hint}
					aria-pressed={pf.activeFacets.has(facet.key)}
					onclick={() => toggleSet(pf.activeFacets, facet.key)}>{facet.label}</button
				>
			{/each}
		</div>
		{#if pf.activeFacets.size > 1}
			<p class="note cs-facet-note">Matching characters provide all of these.</p>
		{/if}
		<!-- Which constellations the capability chips are judged at — the planner
		     has no C0–C6 stepper, so the answer has to be stated rather than
		     shown. Reads the SAVED roster (Layer 1): a picker asks "who can do
		     this for ME", which is the question you have before any per-tab
		     override exists. -->
		<p class="note cs-facet-note cs-facet-mode">at your saved constellations</p>
	</div>
{/snippet}

<style>
	/* A bare hit target around Nate's close mark — the same treatment the meta
	   overlays' close wears. Deliberately not .btn--icon: the mark is already a
	   disc, and a bordered box around it reads as two shapes. */
	.cs-close-btn {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		flex: none;
		padding: 0;
		border: none;
		background: none;
		color: var(--text);
		cursor: pointer;
	}

	.cs-count {
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-wide);
		color: var(--muted);
		flex-shrink: 0;
	}

	/* .note, plus the offset the section doesn't provide. */
	.cs-facet-note {
		margin-top: 0.5rem;
		font-size: var(--fs-md);
	}
	.cs-facet-mode {
		font-size: var(--fs-xs);
		opacity: 0.75;
	}
</style>
