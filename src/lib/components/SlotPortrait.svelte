<script lang="ts">
	/**
	 * SlotPortrait — the roster card shared by the Rotation Planner's timeline
	 * label column and the Team Builder's Bench. One character slot: element glyph
	 * + name + constellation chip on top, the circular side-portrait centered in
	 * the middle, and the artifact/weapon loadout rows grounded at the base. Empty
	 * slots render honestly (blank portrait, "Empty", disabled chips), matching the
	 * planner exactly.
	 *
	 * Purely presentational: it displays the resolved (effective) constellation +
	 * loadout it's handed and reports edits through callbacks. Each host decides
	 * which layer those writes land in — the planner writes the tab (Layer 2), the
	 * Team Builder writes the roster (Layer 1) — so this component never touches a
	 * store or knows about layers. The constellation/refinement popovers and their
	 * viewport-fixed positioning live here (a full-screen backdrop guarantees only
	 * one is ever open, so per-instance state is safe).
	 */
	import { siteSettings, type LoadoutEntry } from '$lib/stores';
	import { getAvatar, getAvatarFallback } from '$lib/utils/getAvatar';
	import { elementPalette } from '$lib/utils/elementColors';
	import { getAllArtifactSets, artifactImagePath } from '$lib/data/artifactLookup';
	import { getWeaponsByType, getAllWeapons, weaponImagePath } from '$lib/data/weaponLookup';
	import type { WeaponType } from '$lib/types/weapon';
	import LoadoutDropdown from '$lib/components/LoadoutDropdown.svelte';
	import type { DropdownItem } from '$lib/components/LoadoutDropdown.svelte';
	// Popovers + backdrops are viewport-fixed but must clear ANY host stacking
	// context (the Team Builder Bench is `position: sticky`) — see $lib/actions/portal
	import { portal } from '$lib/actions/portal';

	/** The minimal character shape the card renders — an index entry or a loaded
	 *  payload both satisfy it. null = empty slot. */
	type SlotChar = { id: string; displayName: string; element?: string; weapon?: string } | null;

	let {
		slotId,
		char,
		conLevel,
		loadoutEntry,
		onSetCon,
		onSetArtifact,
		onSetWeapon,
		onSetRefinement,
		onPortraitClick,
		portraitLabel = 'Open character selector',
		emptyLabel = 'Empty'
	}: {
		/** Raw avatar id (the character id, or 'blank' for an empty slot). */
		slotId: string;
		/** Resolved character, or null while unresolved / empty. */
		char: SlotChar;
		/** Effective constellation level to display (already layer-resolved). */
		conLevel: number;
		/** Effective loadout to display (already layer-resolved). */
		loadoutEntry: LoadoutEntry;
		onSetCon: (level: number) => void;
		onSetArtifact: (artifactSetId: string | undefined) => void;
		onSetWeapon: (weaponId: string | undefined, refinement: 1 | 2 | 3 | 4 | 5) => void;
		onSetRefinement: (r: 1 | 2 | 3 | 4 | 5) => void;
		/** When set, the portrait becomes an interactive button (planner: open the
		 *  selector; Bench: open the character / add). Omit for a static portrait. */
		onPortraitClick?: () => void;
		portraitLabel?: string;
		/** Text shown in the name area for an empty (char===null) slot. The planner
		 *  passes '' so a default empty timeline reads clean; the Bench keeps 'Empty'. */
		emptyLabel?: string;
	} = $props();

	const p = $derived(elementPalette(char?.element));

	function slotLabel(c: NonNullable<SlotChar>): string {
		return c.id.startsWith('traveler') ? 'Traveler' : c.displayName;
	}
	function initials(name: string): string {
		return name.slice(0, 2).toUpperCase();
	}

	// Avatar fallback (per instance) — reset whenever the slot's character changes.
	let avatarFallback = $state(false);
	$effect(() => {
		void slotId;
		avatarFallback = false;
	});
	function handleAvatarError(event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src.includes('-newfit')) {
			img.src = getAvatarFallback(slotId, 'side', $siteSettings.travelerVariant);
		} else {
			avatarFallback = true;
		}
	}

	const artifactItems: DropdownItem[] = getAllArtifactSets().map((a) => ({
		id: a.id,
		label: a.shortName ?? a.name,
		menuLabel: a.name,
		iconSrc: artifactImagePath(a.id)
	}));

	function weaponItemsForType(weaponType: string): DropdownItem[] {
		return getWeaponsByType(weaponType as WeaponType).map((w) => ({
			id: w.id,
			label: w.shortName ?? w.name,
			menuLabel: w.name,
			iconSrc: weaponImagePath(w.id)
		}));
	}

	// Blank (the generic placeholder) has no weapon type, so it offers EVERY
	// authored weapon — users can sketch "a generic character running Sacrificial
	// / TTDS / …" regardless of type.
	const allWeaponItems: DropdownItem[] = getAllWeapons().map((w) => ({
		id: w.id,
		label: w.shortName ?? w.name,
		menuLabel: w.name,
		iconSrc: weaponImagePath(w.id)
	}));

	// ── Popovers (constellation + weapon refinement) ─────────────────────────
	let conOpen = $state(false);
	let conX = $state(0);
	let conY = $state(0);
	let refOpen = $state(false);
	let refX = $state(0);
	let refY = $state(0);

	function anchorTo(e: MouseEvent): { x: number; y: number } {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		return { x: rect.right + 8, y: rect.top + rect.height / 2 };
	}

	function openConstellation(e: MouseEvent) {
		e.stopPropagation();
		refOpen = false;
		if (conOpen) {
			conOpen = false;
			return;
		}
		({ x: conX, y: conY } = anchorTo(e));
		conOpen = true;
	}
	function chooseCon(level: number) {
		onSetCon(level);
		conOpen = false;
	}

	function openRefinement(e: MouseEvent) {
		e.stopPropagation();
		conOpen = false;
		if (refOpen) {
			refOpen = false;
			return;
		}
		({ x: refX, y: refY } = anchorTo(e));
		refOpen = true;
	}
	function chooseRefinement(r: 1 | 2 | 3 | 4 | 5) {
		onSetRefinement(r);
		refOpen = false;
	}

	function closePopovers() {
		conOpen = false;
		refOpen = false;
	}

	const currentRef = $derived(loadoutEntry?.weaponRefinement ?? 1);
</script>

<div class="sp-card" style:--el={p.main}>
	<!-- Name row: element glyph + name ranged left, constellation chip ranged right. -->
	<div class="sp-id-row">
		<span class="sp-id-name">
			{#if char?.element}
				<img
					class="sp-el-badge"
					src="/assets/elements/flat-color/{char.element}.png"
					alt={char.element}
				/>
			{/if}
			<span class="sp-char-name" class:sp-char-name--empty={!char}
				>{char ? slotLabel(char) : emptyLabel}</span
			>
		</span>
		<button
			class="sp-cons-chip"
			class:sp-cons-chip--set={conLevel > 0}
			disabled={!char}
			onclick={openConstellation}
			aria-label={char ? `Set constellation for ${char.displayName}` : 'Constellation (empty slot)'}
			>C{conLevel}</button
		>
	</div>

	<div class="sp-portrait-area">
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			class="sp-avatar-chip"
			class:sp-avatar-clickable={!!onPortraitClick}
			onclick={onPortraitClick}
			role={onPortraitClick ? 'button' : undefined}
			tabindex={onPortraitClick ? 0 : undefined}
			aria-label={onPortraitClick ? portraitLabel : undefined}
		>
			<span class="sp-avatar-clip">
				{#if !avatarFallback}
					<img
						class="sp-avatar-img"
						src={getAvatar(
							slotId,
							$siteSettings.useNewOutfits,
							'side',
							$siteSettings.travelerVariant
						)}
						alt={char?.displayName ?? 'Empty slot'}
						onerror={handleAvatarError}
					/>
				{:else}
					<span class="sp-avatar-initials">{initials(char?.displayName ?? slotId)}</span>
				{/if}
			</span>
		</div>
	</div>

	<div class="sp-loadout-rows">
		<LoadoutDropdown
			items={artifactItems}
			selected={loadoutEntry?.artifactSetId}
			placeholder="Artifact"
			disabled={!char}
			onSelect={(id) => char && onSetArtifact(id)}
		/>
		<div class="sp-weapon-group">
			<div class="sp-weapon-dd">
				<LoadoutDropdown
					items={char
						? char.id === 'blank'
							? allWeaponItems
							: weaponItemsForType(char.weapon ?? '')
						: []}
					selected={loadoutEntry?.weaponId}
					placeholder="Weapon"
					disabled={!char || char.weapon === 'polearm'}
					title={char?.weapon === 'polearm' ? 'No polearm-type weapons available' : undefined}
					onSelect={(id) => char && onSetWeapon(id, currentRef)}
				/>
			</div>
			{#if loadoutEntry?.weaponId}
				<button class="sp-ref-badge" onclick={openRefinement} aria-label="Set refinement for weapon"
					>R{currentRef}</button
				>
			{/if}
		</div>
	</div>
</div>

<!-- ── Constellation + refinement popovers ─────────────────────────────────── -->
{#if conOpen || refOpen}
	<div
		class="sp-popover-backdrop"
		role="button"
		tabindex="-1"
		aria-label="Close picker"
		use:portal
		onclick={closePopovers}
		onkeydown={(e) => {
			if (e.key === 'Escape') closePopovers();
		}}
	></div>
{/if}
{#if conOpen}
	<div class="sp-popover" use:portal style:left="{conX}px" style:top="{conY}px">
		{#each [0, 1, 2, 3, 4, 5, 6] as level (level)}
			<button
				class="sp-pip"
				class:sp-pip--filled={level > 0 && level <= conLevel}
				class:sp-pip--current={level === conLevel}
				style:--pip-color={p.main}
				onclick={() => chooseCon(level)}>{level}</button
			>
		{/each}
	</div>
{/if}
{#if refOpen}
	<div class="sp-popover" use:portal style:left="{refX}px" style:top="{refY}px">
		{#each [1, 2, 3, 4, 5] as r (r)}
			<button
				class="sp-pip"
				class:sp-pip--filled={r <= currentRef}
				class:sp-pip--current={r === currentRef}
				style:--pip-color={p.main}
				onclick={() => chooseRefinement(r as 1 | 2 | 3 | 4 | 5)}>R{r}</button
			>
		{/each}
	</div>
{/if}

<style>
	/* ── Card ─────────────────────────────────────────────────────────────────
	   Three zones: identity header (glyph + name + constellation) across the top,
	   the portrait centered — alone — in the middle space, and the loadout rows
	   grounded at the base. `flex: 1` lets the card fill a host cell of fixed
	   height (the planner's timeline row); with no such height (the Bench) it
	   collapses to content. */
	.sp-card {
		box-sizing: border-box;
		flex: 1;
		min-height: 0;
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		padding: 8px 10px 10px 8px;
		gap: 8px;
	}

	.sp-portrait-area {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Name row: glyph+name ranged left, constellation selector ranged right. */
	.sp-id-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		min-width: 0;
	}
	.sp-id-name {
		display: flex;
		align-items: center;
		gap: 1px;
		min-width: 0;
	}
	/* Sized as large as the longest roster names allow: single-word names sit on
	   one line; multi-word outliers (Sangonomiya Kokomi, Shikanoin Heizou…) wrap
	   to a second line rather than truncate. */
	.sp-char-name {
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--text);
		line-height: var(--lh-tight);
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		max-width: 100%;
		letter-spacing: var(--ls-tight);
	}
	.sp-char-name--empty {
		color: var(--muted);
		font-weight: var(--fw-medium);
		opacity: 0.55;
	}

	/* Element glyph inline with the name — the in-game card language. */
	.sp-el-badge {
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		padding: 1px;
		background: none;
		pointer-events: none;
	}

	/* Constellation selector: rides the name row, ranged right. Resting = quiet
	   dark chip; once a constellation is set it claims the element color + an
	   inset ring — the selected-chip idiom. */
	.sp-cons-chip {
		flex-shrink: 0;
		width: 20px;
		height: 18px;
		display: grid;
		place-items: center;
		background: rgba(255, 255, 255, 0.07);
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		color: var(--muted);
		letter-spacing: var(--ls-wide);
		border-radius: 3px;
		line-height: var(--lh-none);
		z-index: 1;
		transition:
			background 150ms ease,
			box-shadow 150ms ease,
			color 150ms ease;
	}
	.sp-cons-chip:hover {
		background: rgba(255, 255, 255, 0.13);
		color: var(--text);
	}
	.sp-cons-chip:disabled {
		opacity: 0.35;
		cursor: default;
		pointer-events: none;
	}
	.sp-cons-chip--set {
		background: color-mix(in srgb, var(--el) 20%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--el) 50%, transparent);
		color: color-mix(in srgb, var(--el) 75%, white);
	}
	.sp-cons-chip--set:hover {
		background: color-mix(in srgb, var(--el) 30%, transparent);
	}

	/* ── Loadout rows (artifact + weapon stacked) ─────────────────────────────
	   4px gap: the 26px equipment icons overhang their 18px chips by 4px per edge,
	   so this is the minimum that keeps neighboring icons clear. */
	.sp-loadout-rows {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
	}
	.sp-weapon-group {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 2px;
		width: 100%;
	}
	.sp-weapon-dd {
		flex: 1;
		min-width: 0;
	}
	.sp-ref-badge {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		/* Same rendered height as the loadout chips beside it (.ld-trigger:
		   17px min-height + 1px padding top/bottom → 19px box) */
		min-height: 19px;
		background: rgba(255, 255, 255, 0.07);
		border: none;
		border-radius: 3px;
		color: var(--muted);
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-mid);
		cursor: pointer;
		padding: 0 4px;
		line-height: var(--lh-none);
		white-space: nowrap;
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	.sp-ref-badge:hover {
		background: rgba(255, 255, 255, 0.12);
		color: var(--text);
	}

	/* ── Portrait ─────────────────────────────────────────────────────────────
	   Circular — the side-avatar art is cropped to a circle in-game, so the
	   portrait honours that shape. Neutral backing (no element tint on the art);
	   element identity rides on the small glyph badge in the name row, and the
	   clip border picks up --el. */
	.sp-avatar-chip {
		position: relative;
		width: 54px;
		height: 54px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.sp-avatar-clip {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #131c30;
		border: 1.5px solid var(--el, #6a7080);
		transition: box-shadow 150ms ease;
	}
	.sp-avatar-clickable {
		cursor: pointer;
	}
	/* Element-tinted glow — same recipe as the chrome ?/gear buttons
	   (0 0 10px @ 40%), not an enlarged outline ring. */
	.sp-avatar-clickable:hover .sp-avatar-clip {
		box-shadow: 0 0 10px color-mix(in srgb, var(--el, #9eacc8) 40%, transparent);
	}
	.sp-avatar-img {
		/* Side avatars are 128×128 with the character positioned toward the
		   center/bottom. Scale up and translate upward within the clipping circle. */
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.333) translateY(-14%);
	}
	.sp-avatar-initials {
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-mid);
		color: var(--text);
	}

	/* ── Popovers (constellation + refinement pip pickers) ────────────────────
	   Full-screen backdrop (z 49) captures the dismiss click and guarantees only
	   one popover is open at a time; the picker (z 50) is viewport-fixed to the
	   right of the chip that opened it. */
	.sp-popover-backdrop {
		position: fixed;
		inset: 0;
		/* Portaled to <body>, so this competes at the root stacking level. High
		   enough to clear the tool panels (Bench sticky, Source rail) but below the
		   1000 modal layer, which never coexists with this picker. */
		z-index: 949;
	}
	.sp-popover {
		position: fixed;
		transform: translateY(-50%);
		z-index: 950;
		background: var(--surface-raised);
		border: none;
		border-radius: 6px;
		padding: 7px 9px;
		display: flex;
		align-items: center;
		gap: 4px;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.06),
			0 4px 16px rgba(0, 0, 0, 0.5);
	}
	.sp-pip {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.06);
		color: var(--muted);
		font-family: var(--font-body);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		transition:
			background 150ms ease,
			box-shadow 150ms ease,
			color 150ms ease;
	}
	.sp-pip--filled {
		background: color-mix(in srgb, var(--pip-color) 22%, transparent);
		color: var(--pip-color);
	}
	.sp-pip--current {
		background: color-mix(in srgb, var(--pip-color) 30%, transparent);
		box-shadow: inset 0 0 0 1.5px var(--pip-color);
	}
	.sp-pip:hover {
		background: rgba(255, 255, 255, 0.12);
		color: var(--pip-color, var(--text));
	}
</style>
