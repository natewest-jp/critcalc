<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { CharacterIndexEntry } from '$lib/types/character';
	import { getAllCharacterIndex } from '$lib/data/characterLookup';
	import { getAvatar, getAvatarFallback } from '$lib/utils/getAvatar';
	import { siteSettings } from '$lib/stores';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import CharacterGrid, { type GridFilters } from '$lib/components/CharacterGrid.svelte';

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

	function elColor(element: string | undefined): string {
		return (elementColors[(element ?? 'none') as ElementKey] ?? elementColors.none).main;
	}

	function initials(name: string): string {
		return name.slice(0, 2).toUpperCase();
	}

	// Per-tile avatar fallback.
	let gridFallbacks = $state<Record<string, boolean>>({});
	function handleGridAvatarError(id: string, event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src.includes('-newfit')) {
			img.src = getAvatarFallback(id, 'full', $siteSettings.travelerVariant);
		} else {
			gridFallbacks[id] = true;
		}
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
			<button class="cs-close-btn" onclick={onClose} aria-label="Close character picker">✕</button>
		{/snippet}
	</CharacterGrid>
</div>

{#snippet charTile(char: CharacterIndexEntry)}
	{@const slotNum = slotIndexOf(char.id)}
	{@const selected = slotNum !== -1}
	{@const full = teamFull && !selected}
	<button
		class="cs-char-card"
		class:cs-char-card--selected={selected}
		class:cs-char-card--full={full}
		style:--el-color={elColor(char.element)}
		onclick={() => toggleCharacter(char.id)}
		aria-pressed={selected}
		aria-label="{char.displayName}{selected ? `, slot ${slotNum + 1}` : ''}"
	>
		{#if selected}
			<span class="cs-slot-badge">{slotNum + 1}</span>
		{/if}
		<div class="cs-char-img-wrap">
			{#if !gridFallbacks[char.id]}
				<img
					class="cs-char-img"
					src={getAvatar(
						char.id,
						$siteSettings.useNewOutfits,
						'full',
						$siteSettings.travelerVariant
					)}
					alt={char.displayName}
					loading="lazy"
					onerror={(e) => handleGridAvatarError(char.id, e)}
				/>
			{:else}
				<span class="cs-char-initials">{initials(char.displayName)}</span>
			{/if}
		</div>
		<span class="cs-char-name">{char.displayName}</span>
	</button>
{/snippet}

<style>
	/* ── Panel ────────────────────────────────────────────────── */
	/* No backdrop / fixed positioning — RotationTimeline layers this over the
	   track area. The panel just fills the space it's given. */
	.cs-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
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

	.cs-close-btn {
		background: rgba(255, 255, 255, 0.05);
		border: none;
		color: var(--muted);
		font-size: var(--fs-lg);
		cursor: pointer;
		padding: 6px 10px;
		line-height: var(--lh-none);
		border-radius: 3px;
		flex-shrink: 0;
		transition:
			color 150ms ease,
			background 150ms ease;
	}
	.cs-close-btn:hover {
		color: var(--text);
		background: rgba(255, 255, 255, 0.1);
	}

	/* ── Character card ───────────────────────────────────────── */
	/* Solid tiles; selection earns its ring in the element color. */
	.cs-char-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0;
		background: #0b1222;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		overflow: hidden;
		transition:
			box-shadow 150ms ease,
			transform 100ms ease;
	}
	.cs-char-card:hover:not(.cs-char-card--full) {
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
		transform: translateY(-1px);
	}
	.cs-char-card--selected {
		box-shadow: inset 0 0 0 1.5px var(--el-color) !important;
	}
	.cs-char-card--full {
		opacity: 0.35;
		cursor: default;
	}

	/* Slot number badge (top-left corner of card) */
	.cs-slot-badge {
		position: absolute;
		top: 4px;
		left: 4px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--el-color);
		color: #0b1020;
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2;
	}

	.cs-char-img-wrap {
		width: 100%;
		aspect-ratio: 3 / 4;
		background: linear-gradient(180deg, #111a30 0%, #0a1020 100%);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		overflow: hidden;
	}

	.cs-char-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: top center;
	}

	.cs-char-initials {
		font-size: var(--fs-2xl);
		font-weight: var(--fw-bold);
		color: var(--el-color);
		align-self: center;
	}

	.cs-char-name {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		color: var(--muted);
		text-align: center;
		padding: 4px 4px 5px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 100%;
		box-sizing: border-box;
	}
</style>
