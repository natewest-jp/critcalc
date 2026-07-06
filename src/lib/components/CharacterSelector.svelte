<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { getAllCharacterIndex } from '$lib/data/characterLookup';
	import { getAvatar, getAvatarFallback } from '$lib/utils/getAvatar';
	import { siteSettings, loadout, type LoadoutEntry } from '$lib/stores';
	import type { Element } from '$lib/types/ability';
	import type { WeaponType } from '$lib/types/weapon';
	import { getAllArtifactSets, artifactImagePath } from '$lib/data/artifactLookup';
	import { getWeaponsByType } from '$lib/data/weaponLookup';
	import LoadoutDropdown from '$lib/components/LoadoutDropdown.svelte';
	import type { DropdownItem } from '$lib/components/LoadoutDropdown.svelte';
	import { elementColors } from '$lib/utils/elementColors';

	// ---------------------------------------------------------------------------
	// Props
	// ---------------------------------------------------------------------------

	let {
		currentSlots = ['blank', 'blank', 'blank', 'blank'],
		tabLoadout = {} as Record<string, LoadoutEntry>,
		onConfirm,
		onClose,
		onCharacterLoadoutChange
	}: {
		currentSlots?: string[];
		tabLoadout?: Record<string, LoadoutEntry>;
		onConfirm: (slots: string[]) => void;
		onClose: () => void;
		onCharacterLoadoutChange?: (charId: string, update: Partial<LoadoutEntry>) => void;
	} = $props();

	// ---------------------------------------------------------------------------
	// All characters (sorted alphabetically by displayName)
	// ---------------------------------------------------------------------------

	const allCharacters = getAllCharacterIndex()
		.filter((c) => c.id !== 'blank')
		.sort((a, b) => a.displayName.localeCompare(b.displayName));

	// ---------------------------------------------------------------------------
	// Selection state — 4 slots, null = blank
	// Initialized from currentSlots prop (strip 'blank' → null)
	// ---------------------------------------------------------------------------

	let selection = $state<(string | null)[]>(
		untrack(() => currentSlots.slice(0, 4).map((id) => (id === 'blank' ? null : id)))
	);

	function slotIndexOf(id: string): number {
		return selection.indexOf(id);
	}

	function nextEmptySlot(): number {
		return selection.indexOf(null);
	}

	function toggleCharacter(id: string) {
		const existing = slotIndexOf(id);
		if (existing !== -1) {
			// Deselect
			selection[existing] = null;
		} else {
			const empty = nextEmptySlot();
			if (empty !== -1) selection[empty] = id;
			// If all 4 slots full, do nothing
		}
	}

	function clearSlot(slotIdx: number) {
		selection[slotIdx] = null;
	}

	function handleConfirm() {
		onConfirm(selection.map((id) => id ?? 'blank'));
	}

	// ---------------------------------------------------------------------------
	// Filters
	// ---------------------------------------------------------------------------

	const ELEMENTS: Element[] = ['anemo', 'cryo', 'dendro', 'electro', 'geo', 'hydro', 'pyro'];
	const WEAPONS: WeaponType[] = ['sword', 'claymore', 'polearm', 'bow', 'catalyst'];
	const RARITIES = [4, 5] as const;

	const filterElements = new SvelteSet<Element>();
	const filterWeapons = new SvelteSet<WeaponType>();
	const filterRarities = new SvelteSet<number>();
	let filterRegion = $state<string>('');
	let search = $state('');

	function toggleSet<T>(set: SvelteSet<T>, val: T): void {
		if (set.has(val)) {
			set.delete(val);
		} else {
			set.add(val);
		}
	}

	// Unique regions from roster, sorted
	const allRegions = [
		...new Set(allCharacters.map((c) => c.region).filter(Boolean) as string[])
	].sort();

	let filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return allCharacters.filter((c) => {
			if (q && !c.displayName.toLowerCase().includes(q)) return false;
			if (filterElements.size > 0 && !filterElements.has(c.element as Element)) return false;
			if (filterWeapons.size > 0 && !filterWeapons.has(c.weapon as WeaponType)) return false;
			if (filterRarities.size > 0 && !filterRarities.has(c.rarity)) return false;
			if (filterRegion && c.region !== filterRegion) return false;
			return true;
		});
	});

	// ---------------------------------------------------------------------------
	// Element color accessor — values live in `src/app.css` as `--el-*-main`.
	// ---------------------------------------------------------------------------

	function elColor(element: string | undefined): string {
		const key = (element ?? 'none') as keyof typeof elementColors;
		return (elementColors[key] ?? elementColors.none).main;
	}

	// ---------------------------------------------------------------------------
	// Loadout dropdown items
	// ---------------------------------------------------------------------------

	const artifactItems: DropdownItem[] = getAllArtifactSets().map((a) => ({
		id: a.id,
		label: a.shortName ?? a.name,
		iconSrc: artifactImagePath(a.id)
	}));

	function weaponItemsForChar(charId: string | null): DropdownItem[] {
		if (!charId) return [];
		const char = allCharacters.find((c) => c.id === charId);
		if (!char) return [];
		return getWeaponsByType(char.weapon as WeaponType).map((w) => ({
			id: w.id,
			label: w.shortName ?? w.name
		}));
	}

	function effectiveEntry(charId: string): LoadoutEntry {
		return { ...($loadout[charId] ?? {}), ...(tabLoadout[charId] ?? {}) };
	}

	// ---------------------------------------------------------------------------
	// Avatar fallback (grid)
	// ---------------------------------------------------------------------------

	let gridFallbacks = $state<Record<string, boolean>>({});

	function handleGridAvatarError(id: string, event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src.includes('-newfit')) {
			img.src = getAvatarFallback(id, 'full');
		} else {
			gridFallbacks[id] = true;
		}
	}

	// ---------------------------------------------------------------------------
	// Slot avatar fallback
	// ---------------------------------------------------------------------------

	let slotFallbacks = $state([false, false, false, false]);

	function handleSlotAvatarError(i: number, charId: string, event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src.includes('-newfit')) {
			img.src = getAvatarFallback(charId, 'side');
		} else {
			slotFallbacks[i] = true;
		}
	}

	function initials(name: string): string {
		return name.slice(0, 2).toUpperCase();
	}

	// ---------------------------------------------------------------------------
	// Backdrop click to close
	// ---------------------------------------------------------------------------

	function handleBackdropClick(e: MouseEvent) {
		if ((e.target as HTMLElement).classList.contains('cs-backdrop')) onClose();
	}

	// ---------------------------------------------------------------------------
	// Keyboard: Escape to close
	// ---------------------------------------------------------------------------

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- ============================================================ -->
<!--  Backdrop + panel                                            -->
<!-- ============================================================ -->
<div
	class="cs-backdrop"
	onclick={handleBackdropClick}
	onkeydown={handleKeydown}
	role="presentation"
>
	<div
		class="cs-panel"
		role="dialog"
		aria-modal="true"
		aria-label="Select characters"
		tabindex="-1"
	>
		<!-- ── Left: slots + filters ──────────────────────────── -->
		<div class="cs-left">
			<div class="cs-left-header">
				<span class="cs-title">Select Characters</span>
			</div>

			<!-- Slot rows -->
			<div class="cs-slots">
				{#each selection as charId, i (i)}
					{@const char = charId ? allCharacters.find((c) => c.id === charId) : null}
					{@const color = elColor(char?.element)}
					{@const entry = charId ? effectiveEntry(charId) : null}
					<div class="cs-slot" class:cs-slot--filled={charId !== null}>
						<span class="cs-slot-num">{i + 1}</span>
						<div class="cs-slot-avatar" style:border-color={charId ? color : 'var(--border)'}>
							{#if charId && !slotFallbacks[i]}
								<img
									class="cs-slot-avatar-img"
									src={getAvatar(charId, $siteSettings.useNewOutfits, 'side')}
									alt={char?.displayName ?? charId}
									onerror={(e) => handleSlotAvatarError(i, charId, e)}
								/>
							{:else if charId}
								<span class="cs-slot-initials" style:color>
									{initials(char?.displayName ?? charId)}
								</span>
							{:else}
								<span class="cs-slot-empty-icon">?</span>
							{/if}
						</div>
						<div class="cs-slot-info">
							<span class="cs-slot-name" style:color={charId ? color : 'var(--muted)'}>
								{char?.displayName ?? 'Empty'}
							</span>
							{#if char?.element}
								<span class="cs-slot-element">{char.element}</span>
							{/if}
						</div>
						{#if charId && entry !== null}
							<div class="cs-slot-loadout">
								<LoadoutDropdown
									items={artifactItems}
									selected={entry.artifactSetId}
									placeholder="Artifact"
									onSelect={(id) => {
										loadout.setArtifact(charId, id);
										onCharacterLoadoutChange?.(charId, { artifactSetId: id });
									}}
								/>
								<LoadoutDropdown
									items={weaponItemsForChar(charId)}
									selected={entry.weaponId}
									placeholder="Weapon"
									onSelect={(id) => {
										loadout.setWeapon(charId, id);
										onCharacterLoadoutChange?.(charId, { weaponId: id });
									}}
								/>
							</div>
						{/if}
						{#if charId}
							<button
								class="cs-slot-clear"
								onclick={() => clearSlot(i)}
								aria-label="Remove {char?.displayName}">✕</button
							>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Filters -->
			<div class="cs-filters">
				<span class="cs-filter-heading">ELEMENT</span>
				<div class="cs-filter-chips">
					{#each ELEMENTS as el (el)}
						<button
							class="cs-chip cs-chip--element"
							class:cs-chip--active={filterElements.has(el)}
							style:--chip-color={elColor(el)}
							onclick={() => {
								toggleSet(filterElements, el);
							}}
							aria-pressed={filterElements.has(el)}>{el}</button
						>
					{/each}
				</div>

				<span class="cs-filter-heading">RARITY</span>
				<div class="cs-filter-chips">
					{#each RARITIES as r (r)}
						<button
							class="cs-chip"
							class:cs-chip--active={filterRarities.has(r)}
							onclick={() => {
								toggleSet(filterRarities, r);
							}}
							aria-pressed={filterRarities.has(r)}>{r}★</button
						>
					{/each}
				</div>

				<span class="cs-filter-heading">WEAPON</span>
				<div class="cs-filter-chips">
					{#each WEAPONS as w (w)}
						<button
							class="cs-chip"
							class:cs-chip--active={filterWeapons.has(w)}
							onclick={() => {
								toggleSet(filterWeapons, w);
							}}
							aria-pressed={filterWeapons.has(w)}>{w}</button
						>
					{/each}
				</div>

				<span class="cs-filter-heading">REGION</span>
				<div class="cs-filter-chips">
					<button
						class="cs-chip"
						class:cs-chip--active={filterRegion === ''}
						onclick={() => {
							filterRegion = '';
						}}>All</button
					>
					{#each allRegions as region (region)}
						<button
							class="cs-chip"
							class:cs-chip--active={filterRegion === region}
							onclick={() => {
								filterRegion = filterRegion === region ? '' : region;
							}}
							aria-pressed={filterRegion === region}>{region}</button
						>
					{/each}
				</div>
			</div>

			<button class="cs-confirm-btn" onclick={handleConfirm}> Confirm </button>
		</div>

		<!-- ── Right: search + character grid ─────────────────── -->
		<div class="cs-right">
			<div class="cs-search-row">
				<input
					class="cs-search"
					type="text"
					placeholder="Search characters…"
					bind:value={search}
					autocomplete="off"
					autocorrect="off"
					spellcheck={false}
				/>
				<button class="cs-close-btn" onclick={onClose} aria-label="Close">✕</button>
			</div>

			<div class="cs-grid">
				{#each filtered as char (char.id)}
					{@const slotNum = slotIndexOf(char.id)}
					{@const selected = slotNum !== -1}
					{@const full = nextEmptySlot() === -1 && !selected}
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
									src={getAvatar(char.id, $siteSettings.useNewOutfits, 'full')}
									alt={char.displayName}
									onerror={(e) => handleGridAvatarError(char.id, e)}
								/>
							{:else}
								<span class="cs-char-initials">{initials(char.displayName)}</span>
							{/if}
						</div>
						<span class="cs-char-name">{char.displayName}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	/* ── Backdrop ─────────────────────────────────────────────── */
	.cs-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.72);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		box-sizing: border-box;
	}

	/* ── Panel ────────────────────────────────────────────────── */
	.cs-panel {
		display: flex;
		width: 100%;
		max-width: 1100px;
		height: min(820px, calc(100vh - 48px));
		background: #0f1528;
		border: 1px solid #253252;
		border-radius: 12px;
		overflow: hidden;
		font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace;
		font-size: 11px;
		color: #e6edf8;
	}

	/* ── Left panel ───────────────────────────────────────────── */
	.cs-left {
		width: 260px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		background: #0b1020;
		border-right: 1px solid #253252;
		overflow: hidden;
	}

	.cs-left-header {
		display: flex;
		align-items: center;
		padding: 16px 16px 12px;
		border-bottom: 1px solid #1a2540;
		flex-shrink: 0;
	}

	.cs-title {
		font-family: 'Space Grotesk', sans-serif;
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: #e6edf8;
	}

	.cs-search-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.cs-close-btn {
		background: none;
		border: 1px solid #253252;
		color: #4a6090;
		font-size: 16px;
		cursor: pointer;
		padding: 5px 9px;
		line-height: 1;
		border-radius: 6px;
		flex-shrink: 0;
		transition:
			color 0.15s,
			border-color 0.15s;
	}
	.cs-close-btn:hover {
		color: #e6edf8;
		border-color: #4a6090;
	}

	/* ── Slot rows ────────────────────────────────────────────── */
	.cs-slots {
		display: flex;
		flex-direction: column;
		padding: 10px 10px 0;
		gap: 6px;
		flex-shrink: 0;
	}

	.cs-slot {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border-radius: 6px;
		border: 1px solid #1a2540;
		background: #0f1528;
		min-height: 48px;
		position: relative;
	}
	.cs-slot--filled {
		border-color: #253252;
	}

	.cs-slot-num {
		font-size: 9px;
		font-weight: 700;
		color: #3a4e72;
		width: 10px;
		flex-shrink: 0;
		text-align: center;
	}

	.cs-slot-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 1.5px solid;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
		flex-shrink: 0;
	}

	.cs-slot-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.333) translateY(-14%);
	}

	.cs-slot-initials,
	.cs-slot-empty-icon {
		font-size: 9px;
		font-weight: 700;
	}
	.cs-slot-empty-icon {
		color: #3a4e72;
		font-size: 14px;
	}

	.cs-slot-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}

	.cs-slot-name {
		font-size: 10px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.cs-slot-element {
		font-size: 8px;
		color: #4a6090;
		text-transform: capitalize;
		letter-spacing: 0.05em;
	}

	.cs-slot-loadout {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 120px;
		max-width: 140px;
	}

	.cs-slot-clear {
		background: none;
		border: none;
		color: #3a4e72;
		font-size: 10px;
		cursor: pointer;
		padding: 2px;
		flex-shrink: 0;
		border-radius: 3px;
		line-height: 1;
		transition: color 0.15s;
	}
	.cs-slot-clear:hover {
		color: var(--el-pyro-main);
	}

	/* ── Filters ──────────────────────────────────────────────── */
	.cs-filters {
		flex: 1;
		overflow-y: auto;
		padding: 12px 10px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.cs-filter-heading {
		font-size: 8px;
		font-weight: 600;
		letter-spacing: 0.12em;
		color: #3a4e72;
		text-transform: uppercase;
		margin-top: 4px;
	}

	.cs-filter-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 2px;
	}

	.cs-chip {
		font-family: 'IBM Plex Mono', monospace;
		font-size: 9px;
		padding: 3px 7px;
		border-radius: 4px;
		border: 1px solid #253252;
		background: #0f1528;
		color: #6a7a9a;
		cursor: pointer;
		text-transform: capitalize;
		transition:
			border-color 0.12s,
			color 0.12s,
			background 0.12s;
		letter-spacing: 0.02em;
	}
	.cs-chip:hover {
		border-color: #4a6090;
		color: #9eacc8;
	}
	.cs-chip--active {
		border-color: #4a6090;
		background: #17213a;
		color: #c8d4e8;
	}
	.cs-chip--element.cs-chip--active {
		border-color: var(--chip-color);
		color: var(--chip-color);
		background: color-mix(in srgb, var(--chip-color) 12%, #0f1528);
	}

	/* ── Confirm button ───────────────────────────────────────── */
	.cs-confirm-btn {
		margin: 0 10px 12px;
		padding: 10px;
		border-radius: 6px;
		border: 1px solid #4a6090;
		background: #17213a;
		color: #c8d4e8;
		font-family: 'Space Grotesk', sans-serif;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.06em;
		cursor: pointer;
		flex-shrink: 0;
		transition:
			background 0.15s,
			border-color 0.15s;
	}
	.cs-confirm-btn:hover {
		background: #1e2d50;
		border-color: #6cb5ff;
	}

	/* ── Right panel ──────────────────────────────────────────── */
	.cs-right {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		padding: 14px;
		gap: 12px;
		overflow-y: auto;
	}

	/* ── Search ───────────────────────────────────────────────── */
	.cs-search {
		flex: 1;
		min-width: 0;
		box-sizing: border-box;
		background: #060914;
		border: 1px solid #253252;
		border-radius: 6px;
		color: #e6edf8;
		font-family: 'IBM Plex Mono', monospace;
		font-size: 11px;
		padding: 8px 12px;
		outline: none;
		flex-shrink: 0;
		transition: border-color 0.15s;
	}
	.cs-search:focus {
		border-color: #4a6090;
	}

	/* ── Character grid ───────────────────────────────────────── */
	/* The grid itself has natural height; the scroll happens on .cs-right */
	.cs-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
		gap: 8px;
		align-content: start;
	}

	/* ── Character card ───────────────────────────────────────── */
	.cs-char-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0;
		background: #0b1020;
		border: 1.5px solid #1a2540;
		border-radius: 8px;
		cursor: pointer;
		overflow: hidden;
		transition:
			border-color 0.15s,
			transform 0.1s;
	}
	.cs-char-card:hover:not(.cs-char-card--full) {
		border-color: #4a6090;
		transform: translateY(-1px);
	}
	.cs-char-card--selected {
		border-color: var(--el-color) !important;
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--el-color) 40%, transparent);
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
		font-size: 9px;
		font-weight: 700;
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
		font-size: 18px;
		font-weight: 700;
		color: var(--el-color);
	}

	.cs-char-name {
		font-size: 8.5px;
		font-weight: 500;
		color: #9eacc8;
		text-align: center;
		padding: 4px 4px 5px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 100%;
		box-sizing: border-box;
	}
</style>
