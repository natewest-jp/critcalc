<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { CharacterIndexEntry } from '$lib/types/character';
	import { getAllCharacterIndex } from '$lib/data/characterLookup';
	import { siteSettings, constellations } from '$lib/stores';
	import CharacterGrid, { type GridFilters } from '$lib/components/CharacterGrid.svelte';
	import CharacterCard from '$lib/components/CharacterCard.svelte';

	// ---------------------------------------------------------------------------
	// The planner's character Source — a NON-MODAL, in-frame panel (positioning is
	// supplied by RotationTimeline, which layers it over the track area from the
	// portrait column's edge). The 4 live timeline portraits ARE the team display,
	// so there's no slots panel: clicking a grid character fills the lowest empty
	// slot / deselects, live, emitting the new team up to the planner page. Loadout
	// lives on the portrait chips now, so this is a pure picker.
	// ---------------------------------------------------------------------------

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
		search: ''
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
	<CharacterGrid roster={allCharacters} {filters} tile={charTile}>
		{#snippet headerEnd()}
			<span class="cs-count" aria-live="polite">{chosenCount}/4</span>
			<button
				class="btn btn--icon cs-close-btn"
				onclick={onClose}
				aria-label="Close character picker">✕</button
			>
		{/snippet}
	</CharacterGrid>
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
	   track area. The panel just fills the space it's given. */
	/* .btn--icon; only the resting fill and glyph size are local. */
	.cs-close-btn {
		background: var(--fill-rest);
		font-size: var(--fs-lg);
		padding: 6px 10px;
		flex-shrink: 0;
	}

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
		font-size: var(--fs-sm);
		color: var(--text);
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
