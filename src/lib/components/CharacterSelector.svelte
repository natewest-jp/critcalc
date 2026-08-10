<script lang="ts">
	import type { CharacterIndexEntry } from '$lib/types/character';
	import { getAllCharacterIndex } from '$lib/data/characterLookup';
	import { siteSettings, constellations } from '$lib/stores';
	import CharacterGrid from '$lib/components/CharacterGrid.svelte';
	import {
		conCapFor,
		isCapabilityUnknown,
		matchesFacets,
		type ConMode
	} from '$lib/capabilities/facets';
	import CharacterCard from '$lib/components/CharacterCard.svelte';
	import { pickerFilters as pf } from '$lib/pickerFilters.svelte';

	// ---------------------------------------------------------------------------
	// The planner's character Source — a NON-MODAL, in-frame panel (positioning is
	// supplied by RotationTimeline, which layers it over the timeline frame). The
	// 4 live bench portraits ARE the team display, so there's no slots panel:
	// clicking a grid character fills the lowest empty slot / deselects, live,
	// emitting the new team up to the planner page. Loadout lives on the portrait
	// chips, so this is a pure picker.
	//
	// ↻ ASIDE-COLUMN ROUND 2026-08-08: this is the GRID half only. The filter
	// column is <CharacterSelectorFilters>, which the planner page places in the
	// surface's aside column — covering the notes exactly as these cards cover
	// the timeline. The two halves meet on $lib/pickerFilters and nowhere else.
	// ---------------------------------------------------------------------------

	// The planner has no C0–C6 stepper, so a facet is judged at the user's SAVED
	// roster constellations (Layer 1): a picker asks "who can do this for ME",
	// which is the question you have before any per-tab override exists. The
	// column states it in words, since there is no stepper to show it.
	const PICKER_CON_MODE: ConMode = 'mine';

	/** Facet predicate for the grid. A capability-unknown kit is NEVER dropped:
	 *  no derived data is not the same as "can't do it". (The Team Builder shows
	 *  those in a labelled bucket; a picker has nowhere to put one, so it simply
	 *  lets them through.) */
	function matchesActiveFacets(entry: CharacterIndexEntry): boolean {
		if (pf.activeFacets.size === 0) return true;
		if (isCapabilityUnknown(entry)) return true;
		return matchesFacets(
			entry.caps,
			pf.activeFacets,
			conCapFor(PICKER_CON_MODE, $constellations[entry.id])
		);
	}

	let {
		currentSlots = ['blank', 'blank', 'blank', 'blank'],
		onChange
	}: {
		currentSlots?: string[];
		/** Emits the new 4-slot team (with 'blank' holes) on every add/remove. */
		onChange: (slots: string[]) => void;
	} = $props();

	const allCharacters = getAllCharacterIndex()
		.filter((c) => c.id !== 'blank')
		.sort((a, b) => a.displayName.localeCompare(b.displayName));

	// Selection is derived from the live team (currentSlots) — the panel is
	// stateless; edits round-trip through the planner page and flow back down.
	const selection = $derived(currentSlots.slice(0, 4).map((id) => (id === 'blank' ? null : id)));
	const teamFull = $derived(selection.filter((id) => id !== null).length === 4);

	function slotIndexOf(id: string): number {
		return selection.indexOf(id);
	}

	function toggleCharacter(id: string): void {
		const next = [...selection];
		const at = next.indexOf(id);
		if (at !== -1) {
			next[at] = null; // deselect → free that slot
		} else {
			const empty = next.indexOf(null);
			if (empty === -1) return; // team full
			next[empty] = id;
		}
		onChange(next.map((s) => s ?? 'blank'));
	}
</script>

<div class="cs-panel" role="dialog" aria-label="Choose team members">
	<CharacterGrid
		roster={allCharacters}
		filters={pf.filters}
		tile={charTile}
		extraFilter={matchesActiveFacets}
	/>
</div>

{#snippet charTile(char: CharacterIndexEntry)}
	{@const slotNum = slotIndexOf(char.id)}
	{@const selected = slotNum !== -1}
	{@const full = teamFull && !selected}
	{@const myCon = $constellations[char.id] ?? 0}
	<CharacterCard
		entry={char}
		preferNewfit={$siteSettings.useNewOutfits}
		traveler={$siteSettings.travelerVariant}
		onActivate={toggleCharacter}
		intent="select"
		pressed={selected}
		disabled={full}
		con={myCon > 0 ? myCon : undefined}
		slotNumber={selected ? slotNum + 1 : undefined}
		showUncuratedMark
		faded={!selected && !full}
	/>
{/snippet}

<style>
	/* ── Panel ────────────────────────────────────────────────── */
	/* No backdrop / fixed positioning — RotationTimeline layers this over the
	   timeline frame. The panel just fills the space it's given. */
	.cs-panel {
		/* Picker dim ladder: unselected tiles rest lighter than the TB's not-owned
		   fade and lift fully on hover — override the CharacterCard defaults. */
		--cc-faded: 0.6;
		--cc-faded-hover: 1;
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		min-width: 0;
		overflow: hidden;
		font-family: var(--font-body);
		font-size: var(--fs-md);
		color: var(--text);
	}

	/* The character tiles are the shared CharacterCard (no tags/actions passed):
	   element glyph + name + inline ∅, slot-number badge + con pip. Selection reads
	   through opacity (see the --cc-faded overrides above). */
</style>
