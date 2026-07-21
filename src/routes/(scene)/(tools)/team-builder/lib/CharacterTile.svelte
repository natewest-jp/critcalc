<script lang="ts">
	import type { CharacterIndexEntry } from '$lib/types/character';
	import {
		getAvatar,
		getAvatarFallback,
		hasAvatar,
		type TravelerVariant
	} from '$lib/utils/getAvatar';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { FACETS, type Badge, type FacetKey } from './facets';

	let {
		entry,
		badges = [],
		activeFacets = new Set<FacetKey>(),
		myCon,
		preferNewfit = false,
		traveler = 'aether',
		dimmed = false,
		faded = false,
		onOpen,
		compared = false,
		compareFull = false,
		onToggleCompare,
		teamState,
		onAddToTeam,
		ownership,
		editMode = false,
		onSetOwnership
	}: {
		entry: CharacterIndexEntry;
		badges?: Badge[];
		activeFacets?: ReadonlySet<FacetKey>;
		/** Constellation pip (constellation mode: my roster). */
		myCon?: number;
		preferNewfit?: boolean;
		traveler?: TravelerVariant;
		/** Uncurated bucket dimming — distinct from ownership fade. */
		dimmed?: boolean;
		/** Ownership fade: a not-owned character shown among owned ones. */
		faded?: boolean;
		onOpen: (id: string) => void;
		compared?: boolean;
		compareFull?: boolean;
		onToggleCompare?: (id: string) => void;
		/** Team-slot membership, for the hover "Team" button. */
		teamState?: 'in' | 'out' | 'full';
		onAddToTeam?: (id: string) => void;
		ownership?: 'owned' | 'wishlist';
		/** In edit mode a tile click cycles ownership instead of opening details. */
		editMode?: boolean;
		onSetOwnership?: (id: string, mark: 'owned' | 'wishlist' | null) => void;
	} = $props();

	const WEAPON_TYPES = ['sword', 'claymore', 'polearm', 'bow', 'catalyst'];
	const hasWeaponIcon = $derived(WEAPON_TYPES.includes(entry.weapon ?? ''));

	// Edit mode: a tile click toggles owned on/off (Genshin collection style —
	// full opacity = owned, faded = not owned). Wishlist stays a detail-card
	// action; toggling owned on a wishlisted character claims it as owned.
	function toggleOwned(): void {
		onSetOwnership?.(entry.id, ownership === 'owned' ? null : 'owned');
	}
	function handleOpen(): void {
		if (editMode) toggleOwned();
		else onOpen(entry.id);
	}

	const color = $derived(
		(elementColors[(entry.element ?? 'none') as ElementKey] ?? elementColors.none).main
	);

	// Active-facet badges first, then facet order; cap at 4 with an overflow count.
	const MAX_BADGES = 4;
	const ordered = $derived.by(() => {
		const rank = (b: Badge) =>
			(activeFacets.has(b.facet) ? 0 : 100) + FACETS.findIndex((f) => f.key === b.facet);
		return [...badges].sort((a, b) => rank(a) - rank(b));
	});
	const shown = $derived(ordered.slice(0, MAX_BADGES));
	const overflow = $derived(ordered.length - shown.length);

	// Known-missing assets render initials outright — an SSR'd <img> that 404s
	// fails the prerender crawl (travelers). onerror stays as the
	// runtime belt-and-braces for anything the manifest missed.
	let errored = $state(false);
	const fallback = $derived(errored || !hasAvatar(entry.id));
	function handleAvatarError(event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src.includes('-newfit')) {
			img.src = getAvatarFallback(entry.id, 'full', traveler);
		} else {
			errored = true;
		}
	}
</script>

<!-- Actions and the ownership control live outside the open button (buttons
     can't nest); the open button covers the portrait + name. -->
<div
	class="tb-tile"
	class:tb-tile--dimmed={dimmed}
	class:tb-tile--faded={faded}
	class:tb-tile--compared={compared}
	class:tb-tile--edit={editMode}
	style:--el-color={color}
>
	<button
		class="tb-tile-open"
		onclick={handleOpen}
		aria-label={editMode
			? `Toggle owned for ${entry.displayName}`
			: `${entry.displayName}, open details`}
	>
		<div class="tb-tile-img-wrap">
			{#if !fallback}
				<img
					class="tb-tile-img"
					src={getAvatar(entry.id, preferNewfit, 'full', traveler)}
					alt=""
					loading="lazy"
					onerror={handleAvatarError}
				/>
			{:else}
				<span class="tb-tile-initials">{entry.displayName.slice(0, 2).toUpperCase()}</span>
			{/if}
			{#if hasWeaponIcon}
				<img
					class="tb-tile-weapon"
					src="/assets/weapon-types/{entry.weapon}.webp"
					alt={entry.weapon}
					title={entry.weapon}
					loading="lazy"
				/>
			{/if}
			{#if myCon !== undefined}
				<span class="tb-tile-con" class:tb-tile-con--set={myCon > 0} title="Your constellation"
					>C{myCon}</span
				>
			{/if}
			{#if ownership === 'wishlist'}
				<span class="tb-tile-wish" title="Wishlisted">★</span>
			{/if}
		</div>
		<span class="tb-tile-namerow">
			{#if entry.element}
				<img
					class="tb-tile-el"
					src="/assets/elements/flat-color/{entry.element}.png"
					alt={entry.element}
					loading="lazy"
				/>
			{/if}
			<span class="tb-tile-name">{entry.displayName}</span>
		</span>
	</button>

	<div class="tb-tile-body">
		<div class="tb-tile-badges">
			{#each shown as badge (badge.facet)}
				<span
					class="tb-badge"
					class:tb-badge--active={activeFacets.has(badge.facet)}
					class:tb-badge--conditional={badge.conditional}
					title={badge.conditional
						? 'Conditional — depends on runtime state (see details)'
						: undefined}
				>
					{badge.label}{badge.minCon > 0 ? ` C${badge.minCon}` : ''}
				</span>
			{/each}
			{#if overflow > 0}
				<span class="tb-badge tb-badge--more">+{overflow}</span>
			{/if}
		</div>

		{#if !editMode && (onAddToTeam || onToggleCompare)}
			<div class="tb-tile-actions">
				{#if onAddToTeam}
					<button
						class="tb-tile-act"
						class:tb-tile-act--on={teamState === 'in'}
						disabled={teamState === 'full'}
						onclick={() => onAddToTeam(entry.id)}
						title={teamState === 'in'
							? 'In your team'
							: teamState === 'full'
								? 'Team is full (4)'
								: 'Add to team'}
					>
						<span class="tb-tile-act-glyph">{teamState === 'in' ? '✓' : '+'}</span>
						<span class="tb-tile-act-label">{teamState === 'full' ? 'Full' : 'Team'}</span>
					</button>
				{/if}
				{#if onToggleCompare}
					<button
						class="tb-tile-act tb-tile-act--compare"
						class:tb-tile-act--on={compared}
						disabled={!compared && compareFull}
						onclick={() => onToggleCompare(entry.id)}
						aria-pressed={compared}
						title={compared
							? 'Remove from comparison'
							: compareFull
								? 'Comparison is full (4)'
								: 'Add to comparison'}
					>
						<span class="tb-tile-act-glyph">{compared ? '✓' : '→'}</span>
						<span class="tb-tile-act-label">Compare</span>
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.tb-tile {
		position: relative;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 1px solid color-mix(in srgb, var(--el-color) 22%, var(--border));
		border-radius: 6px;
		overflow: hidden;
		transition:
			border-color 150ms ease,
			opacity 150ms ease,
			transform 100ms ease;
	}
	.tb-tile:hover {
		border-color: color-mix(in srgb, var(--el-color) 65%, var(--border));
		transform: translateY(-1px);
	}
	.tb-tile--dimmed {
		opacity: 0.55;
	}
	/* Ownership fade — Genshin's not-yet-owned convention. Lifts on hover so the
	   character stays comfortably actionable. */
	.tb-tile--faded {
		opacity: 0.46;
	}
	.tb-tile--faded:hover {
		opacity: 0.92;
	}
	/* In edit mode keep the owned/not-owned contrast crisp — no hover lift, so
	   you can read the whole roster's ownership at a glance while marking. */
	.tb-tile--edit.tb-tile--faded:hover {
		opacity: 0.46;
	}
	.tb-tile--compared {
		border-color: color-mix(in srgb, var(--accent) 65%, var(--border));
	}
	.tb-tile--edit {
		cursor: copy;
	}

	.tb-tile-open {
		display: flex;
		flex-direction: column;
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		color: inherit;
		font: inherit;
	}
	.tb-tile--edit .tb-tile-open {
		cursor: copy;
	}

	.tb-tile-img-wrap {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--el-color) 14%, var(--bg)) 0%,
			var(--bg) 100%
		);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		overflow: hidden;
	}

	.tb-tile-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: top center;
	}

	.tb-tile-initials {
		align-self: center;
		font-size: var(--fs-3xl);
		font-weight: var(--fw-bold);
		color: var(--el-color);
	}

	/* Weapon-type glyph, top-left — a familiarity aid on a dark chip. */
	.tb-tile-weapon {
		position: absolute;
		top: 4px;
		left: 4px;
		width: 21px;
		height: 21px;
		padding: 2px;
		border-radius: 4px;
		background: color-mix(in srgb, #05070d 62%, transparent);
		object-fit: contain;
		z-index: 1;
	}

	/* Constellation pip, top-right — matches the planner's rp-cons-chip. */
	.tb-tile-con {
		position: absolute;
		top: 4px;
		right: 4px;
		min-width: 20px;
		height: 18px;
		display: grid;
		place-items: center;
		padding: 0 4px;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.08);
		color: var(--muted);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-wide);
		line-height: var(--lh-none);
		z-index: 1;
	}
	.tb-tile-con--set {
		background: color-mix(in srgb, var(--el-color) 24%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--el-color) 55%, transparent);
		color: color-mix(in srgb, var(--el-color) 75%, white);
	}

	.tb-tile-wish {
		position: absolute;
		bottom: 4px;
		right: 5px;
		color: var(--el-geo-hi, #eed8a5);
		font-size: var(--fs-md);
		line-height: var(--lh-none);
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.7));
		z-index: 1;
	}

	/* Name row: element glyph left of the name (mirrors the planner portrait). */
	.tb-tile-namerow {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem 0.5rem 0.15rem;
		min-width: 0;
	}
	.tb-tile-el {
		width: 15px;
		height: 15px;
		flex-shrink: 0;
		object-fit: contain;
	}
	.tb-tile-name {
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Body holds the badges; the hover action bar overlays it. Fixed height so
	   every tile is the same total height and the hover buttons land in the same
	   place regardless of how many badges a character has (fits ~2 badge rows). */
	.tb-tile-body {
		position: relative;
		height: 3.7rem;
	}

	.tb-tile-badges {
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: 3px;
		height: 100%;
		box-sizing: border-box;
		padding: 0.15rem 0.5rem 0.5rem;
		overflow: hidden;
	}

	.tb-badge {
		padding: 1px 5px;
		border-radius: 3px;
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		text-transform: uppercase;
		color: var(--muted);
		background: rgba(255, 255, 255, 0.06);
		white-space: nowrap;
	}
	.tb-badge--active {
		color: var(--text);
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 50%, transparent);
	}
	.tb-badge--conditional {
		opacity: 0.66;
		font-style: italic;
	}
	.tb-badge--more {
		background: none;
		color: color-mix(in srgb, var(--muted) 70%, transparent);
	}

	/* Hover action bar — covers the badges with the two primary actions. */
	.tb-tile-actions {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: stretch;
		gap: 4px;
		padding: 0.3rem 0.4rem;
		background: color-mix(in srgb, var(--surface) 90%, transparent);
		opacity: 0;
		pointer-events: none;
		transition: opacity 120ms ease;
	}
	.tb-tile:hover .tb-tile-actions,
	.tb-tile-act:focus-visible {
		opacity: 1;
		pointer-events: auto;
	}
	.tb-tile-act {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		padding: 0.2rem;
		border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
		border-radius: 4px;
		background: color-mix(in srgb, var(--bg) 55%, transparent);
		color: var(--text);
		font-family: var(--font-body);
		cursor: pointer;
		transition:
			border-color 150ms ease,
			background 150ms ease,
			color 150ms ease;
	}
	.tb-tile-act-glyph {
		font-size: var(--fs-2xl);
		font-weight: var(--fw-bold);
		line-height: 1;
	}
	.tb-tile-act-label {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}
	.tb-tile-act:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
		background: color-mix(in srgb, var(--accent) 18%, var(--bg));
	}
	.tb-tile-act--on {
		border-color: color-mix(in srgb, var(--accent) 65%, var(--border));
		background: color-mix(in srgb, var(--accent) 28%, var(--bg));
	}
	.tb-tile-act:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
