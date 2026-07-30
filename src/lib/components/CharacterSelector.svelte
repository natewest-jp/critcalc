<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { CharacterIndexEntry } from '$lib/types/character';
	import { getAllCharacterIndex } from '$lib/data/characterLookup';
	import { siteSettings, constellations } from '$lib/stores';
	import CharacterGrid, { type GridFilters } from '$lib/components/CharacterGrid.svelte';
	import {
		FACETS,
		conCapFor,
		isCapabilityUnknown,
		matchesFacets,
		type ConMode
	} from '$lib/capabilities/facets';
	import type { FacetKey } from '$lib/capabilities/deriveCapabilities';
	import CharacterCard from '$lib/components/CharacterCard.svelte';
	import CloseMark from '$lib/components/CloseMark.svelte';

	// ---------------------------------------------------------------------------
	// The planner's character Source — a NON-MODAL, in-frame panel (positioning is
	// supplied by RotationTimeline, which layers it over the track area from the
	// portrait column's edge). The 4 live timeline portraits ARE the team display,
	// so there's no slots panel: clicking a grid character fills the lowest empty
	// slot / deselects, live, emitting the new team up to the planner page. Loadout
	// lives on the portrait chips now, so this is a pure picker.
	// ---------------------------------------------------------------------------

	// ── Capability facets, shared with the Team Builder's rail ──────────────
	// The planner has no C0–C6 stepper, so a facet is judged at the user's SAVED
	// roster constellations (Layer 1): a picker asks "who can do this for ME",
	// which is the question you have before any per-tab override exists.
	const PICKER_CON_MODE: ConMode = 'mine';

	const activeFacets = new SvelteSet<FacetKey>();

	// Factions/Buffs is identity (membership), so it rides in `filters`; the
	// chips are ours because CharacterGrid's rail only renders the four groups
	// both tools have always shared.
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

	function toggleSet<T>(set: SvelteSet<T>, val: T): void {
		if (set.has(val)) set.delete(val);
		else set.add(val);
	}

	/** Facet predicate for the grid. A capability-unknown kit is NEVER dropped:
	 *  no derived data is not the same as "can't do it". (The Team Builder shows
	 *  those in a labelled bucket; a picker has nowhere to put one, so it simply
	 *  lets them through.) */
	function matchesActiveFacets(entry: CharacterIndexEntry): boolean {
		if (activeFacets.size === 0) return true;
		if (isCapabilityUnknown(entry)) return true;
		return matchesFacets(
			entry.caps,
			activeFacets,
			conCapFor(PICKER_CON_MODE, $constellations[entry.id])
		);
	}

	let {
		currentSlots = ['blank', 'blank', 'blank', 'blank'],
		onChange,
		onClose
	}: {
		currentSlots?: string[];
		/** Emits the new 4-slot team (with 'blank' holes) on every add/remove. */
		onChange: (slots: string[]) => void;
		onClose: () => void;
	} = $props();

	const allCharacters = getAllCharacterIndex()
		.filter((c) => c.id !== 'blank')
		.sort((a, b) => a.displayName.localeCompare(b.displayName));

	const filters = $state<GridFilters>({
		elements: new SvelteSet<string>(),
		weapons: new SvelteSet<string>(),
		rarities: new SvelteSet<number>(),
		region: '',
		search: '',
		factionBuffs: new SvelteSet<string>()
	});

	// Selection is derived from the live team (currentSlots) — the panel is
	// stateless; edits round-trip through the planner page and flow back down.
	const selection = $derived(currentSlots.slice(0, 4).map((id) => (id === 'blank' ? null : id)));
	const chosenCount = $derived(selection.filter((id) => id !== null).length);
	const teamFull = $derived(chosenCount === 4);

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

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="cs-panel" role="dialog" aria-label="Choose team members">
	<CharacterGrid
		roster={allCharacters}
		{filters}
		railFlat
		tile={charTile}
		extraFilter={matchesActiveFacets}
		railStart={facetRail}
		extraFiltersActive={activeFacets.size > 0}
		onClearExtras={() => activeFacets.clear()}
	>
		{#snippet headerEnd()}
			<span class="cs-count" aria-live="polite">{chosenCount}/4</span>
			<button class="cs-close-btn" onclick={onClose} aria-label="Close character picker">
				<CloseMark />
			</button>
		{/snippet}
	</CharacterGrid>
</div>

<!-- The rail sections the shared grid doesn't own, matching the Team Builder's
     column. Role and the roster ledger stay TB-only: roles are soft editorial
     scoping for browsing, and ownership is roster management — neither is a
     question you're asking while filling a rotation's four slots. -->
{#snippet facetRail()}
	<div class="cg-sec">
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

	<div class="cg-sec">
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
			<p class="note cs-facet-note">Matching characters provide all of these.</p>
		{/if}
		<p class="note cs-facet-note cs-facet-mode">at your saved constellations</p>
	</div>
{/snippet}

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
	   track area. The panel just fills the space it's given. */
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

	.cs-panel {
		/* Picker dim ladder: unselected tiles rest lighter than the TB's not-owned
		   fade and lift fully on hover — override the CharacterCard defaults. */
		--cc-faded: 0.6;
		--cc-faded-hover: 1;
		/* The wider rail the Team Builder uses — the capability chips need it.
		   Both tools' filter columns are the same object now, just on opposite
		   outer edges of the tool-slide seam. */
		--cg-rail-w: 250px;
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		min-width: 0;
		overflow: hidden;
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		color: var(--text);
	}

	/* .note, plus the offset the rail section doesn't provide. */
	.cs-facet-note {
		margin-top: 0.5rem;
		font-size: var(--fs-sm);
	}
	/* Which constellations the capability chips are judged at — the planner has
	   no C0–C6 stepper, so the answer has to be stated rather than shown. */
	.cs-facet-mode {
		font-size: var(--fs-2xs);
		opacity: 0.75;
	}

	.cs-count {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-wide);
		color: var(--muted);
		flex-shrink: 0;
	}

	/* The character tiles are the shared CharacterCard (no tags/actions passed):
	   element glyph + name + inline ∅, slot-number badge + con pip. Selection reads
	   through opacity (see the --cc-faded overrides above). */
</style>
