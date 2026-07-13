<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
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

	/** Team Builder hand-off for "replace this slot": the outgoing character
	 *  pre-seeds the capability filters over there; the rest of the team rides
	 *  along in ?team= so the slots arrive assembled minus the hole.
	 *  (Query only — resolve() must sit inline in the href for the
	 *  no-navigation-without-resolve lint to see it.) */
	function replaceQuery(slotIndex: number): string {
		const outgoing = selection[slotIndex];
		const rest = selection.filter((id, i) => id !== null && i !== slotIndex).join(',');
		return `?replace=${outgoing}${rest ? `&team=${rest}` : ''}`;
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
			img.src = getAvatarFallback(id, 'full', $siteSettings.travelerVariant);
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
			img.src = getAvatarFallback(charId, 'side', $siteSettings.travelerVariant);
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
									src={getAvatar(
										charId,
										$siteSettings.useNewOutfits,
										'side',
										$siteSettings.travelerVariant
									)}
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
							<a
								class="cs-slot-replace"
								href="{resolve('/team-builder')}{replaceQuery(i)}"
								title="Replace {char?.displayName} — open the Team Builder with filters pre-seeded from their capabilities"
								aria-label="Find a replacement for {char?.displayName} in the Team Builder">⇄</a
							>
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
									src={getAvatar(
										char.id,
										$siteSettings.useNewOutfits,
										'full',
										$siteSettings.travelerVariant
									)}
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
	/* Dialog surface with the chart-frame border tone — the selector is a
	   major instrument surface, so it wears the same edge as the timeline. */
	.cs-panel {
		display: flex;
		width: 100%;
		max-width: 1100px;
		height: min(820px, calc(100vh - 48px));
		background: var(--surface);
		border: 1px solid color-mix(in srgb, var(--dire-tint, #c2185b) 40%, #081225);
		border-radius: 9px;
		overflow: hidden;
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		color: var(--text);
	}

	/* ── Left panel ───────────────────────────────────────────── */
	.cs-left {
		width: 284px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		background: #0b1020;
		border-right: 1px solid rgba(255, 255, 255, 0.06);
		overflow: hidden;
	}

	.cs-left-header {
		display: flex;
		align-items: center;
		padding: 16px 16px 12px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		flex-shrink: 0;
	}

	.cs-title {
		font-family: var(--font-display);
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: var(--text);
	}

	.cs-search-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.cs-close-btn {
		background: rgba(255, 255, 255, 0.05);
		border: none;
		color: var(--muted);
		font-size: var(--fs-xl);
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

	/* ── Slot rows ────────────────────────────────────────────── */
	.cs-slots {
		display: flex;
		flex-direction: column;
		padding: 10px 10px 0;
		gap: 6px;
		flex-shrink: 0;
	}

	/* Solid slot tiles — filled slots sit a step brighter than empties. */
	.cs-slot {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.03);
		min-height: 48px;
		position: relative;
	}
	.cs-slot--filled {
		background: rgba(255, 255, 255, 0.06);
	}

	.cs-slot-num {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		color: rgba(158, 172, 200, 0.55);
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
		background: #131c30;
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
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
	}
	.cs-slot-empty-icon {
		color: rgba(158, 172, 200, 0.45);
		font-size: var(--fs-lg);
	}

	.cs-slot-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}

	.cs-slot-name {
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.cs-slot-element {
		font-size: var(--fs-2xs);
		color: var(--muted);
		opacity: 0.7;
		text-transform: capitalize;
		letter-spacing: var(--ls-wide);
	}

	.cs-slot-loadout {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 108px;
		max-width: 112px;
	}

	.cs-slot-clear {
		background: none;
		border: none;
		color: rgba(158, 172, 200, 0.5);
		font-size: var(--fs-xs);
		cursor: pointer;
		padding: 2px;
		flex-shrink: 0;
		border-radius: 3px;
		line-height: var(--lh-none);
		transition: color 150ms ease;
	}
	.cs-slot-clear:hover {
		color: var(--el-pyro-main);
	}

	.cs-slot-replace {
		color: rgba(158, 172, 200, 0.5);
		font-size: var(--fs-sm);
		text-decoration: none;
		padding: 2px;
		flex-shrink: 0;
		line-height: var(--lh-none);
		transition: color 150ms ease;
	}
	.cs-slot-replace:hover {
		color: var(--text);
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
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-widest);
		color: var(--muted);
		opacity: 0.65;
		text-transform: uppercase;
		margin-top: 4px;
	}

	.cs-filter-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 2px;
	}

	/* Filter chips: the shared selected-chip idiom — solid quiet fill,
	   active = tinted fill + inset ring (accent, or the element's color). */
	.cs-chip {
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		padding: 3px 7px 4px;
		border-radius: 3px;
		border: none;
		background: rgba(255, 255, 255, 0.05);
		color: var(--muted);
		cursor: pointer;
		text-transform: capitalize;
		transition:
			color 150ms ease,
			background 150ms ease,
			box-shadow 150ms ease;
		letter-spacing: var(--ls-tight);
	}
	.cs-chip:hover {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--text);
	}
	.cs-chip--active {
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent);
		color: var(--text);
	}
	.cs-chip--element:hover {
		background: color-mix(in srgb, var(--chip-color) 14%, transparent);
	}
	.cs-chip--element.cs-chip--active {
		background: color-mix(in srgb, var(--chip-color) 20%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--chip-color) 55%, transparent);
		color: color-mix(in srgb, var(--chip-color) 75%, white);
	}

	/* ── Confirm button ───────────────────────────────────────── */
	/* The dialog's one primary action — accent-tinted solid. */
	.cs-confirm-btn {
		margin: 0 10px 12px;
		padding: 10px;
		border-radius: 3px;
		border: none;
		background: color-mix(in srgb, var(--accent) 26%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent);
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 150ms ease;
	}
	.cs-confirm-btn:hover {
		background: color-mix(in srgb, var(--accent) 36%, transparent);
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
	/* Same field affordance as the notation editor: hairline ring,
	   hover brighten, accent focus ring. */
	.cs-search {
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
		flex-shrink: 0;
		transition: box-shadow 150ms ease;
	}
	.cs-search:hover {
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
	}
	.cs-search:focus {
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 50%, transparent);
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
