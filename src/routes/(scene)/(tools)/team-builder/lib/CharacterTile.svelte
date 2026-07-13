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
		onOpen,
		compared = false,
		compareFull = false,
		onToggleCompare
	}: {
		entry: CharacterIndexEntry;
		badges?: Badge[];
		activeFacets?: ReadonlySet<FacetKey>;
		/** Shown as a corner pip when defined (constellation mode: my roster). */
		myCon?: number;
		preferNewfit?: boolean;
		traveler?: TravelerVariant;
		dimmed?: boolean;
		onOpen: (id: string) => void;
		/** This character is in the compare selection. */
		compared?: boolean;
		/** Selection is at capacity — the toggle disables instead of adding. */
		compareFull?: boolean;
		onToggleCompare?: (id: string) => void;
	} = $props();

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
	// fails the prerender crawl (travelers, lanyan). onerror stays as the
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

<!-- The open action and the compare toggle are separate buttons — buttons
     can't nest, so the tile shell is a div and the toggle floats over it. -->
<div
	class="tb-tile"
	class:tb-tile--dimmed={dimmed}
	class:tb-tile--compared={compared}
	style:--el-color={color}
>
	<button
		class="tb-tile-open"
		onclick={() => onOpen(entry.id)}
		aria-label="{entry.displayName}, open details"
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
			{#if myCon !== undefined}
				<span class="tb-tile-con" title="Your constellation">C{myCon}</span>
			{/if}
			<span class="tb-tile-rarity" class:tb-tile-rarity--five={entry.rarity === 5}
				>{entry.rarity}★</span
			>
		</div>
		<span class="tb-tile-name">{entry.displayName}</span>
		{#if shown.length > 0}
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
		{/if}
	</button>
	{#if onToggleCompare}
		<button
			class="tb-tile-cmp"
			class:tb-tile-cmp--on={compared}
			disabled={!compared && compareFull}
			onclick={() => onToggleCompare(entry.id)}
			aria-pressed={compared}
			aria-label={compared
				? `Remove ${entry.displayName} from comparison`
				: `Add ${entry.displayName} to comparison`}
			title={compared
				? 'Remove from comparison'
				: compareFull
					? 'Comparison is full (4)'
					: 'Add to comparison'}
		>
			{compared ? '✓' : '+'}
		</button>
	{/if}
</div>

<style>
	.tb-tile {
		position: relative;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		border-radius: 6px;
		overflow: hidden;
		transition:
			border-color 150ms ease,
			transform 100ms ease;
	}
	.tb-tile:hover {
		border-color: color-mix(in srgb, var(--el-color) 65%, var(--border));
		transform: translateY(-1px);
	}
	.tb-tile--dimmed {
		opacity: 0.55;
	}
	.tb-tile--compared {
		border-color: color-mix(in srgb, var(--accent) 65%, var(--border));
	}

	.tb-tile-open {
		display: flex;
		flex-direction: column;
		flex: 1;
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		color: inherit;
		font: inherit;
	}

	.tb-tile-cmp {
		position: absolute;
		top: 22px;
		right: 4px;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
		border-radius: 50%;
		background: color-mix(in srgb, var(--bg) 82%, transparent);
		color: var(--muted);
		font-family: var(--font-body);
		font-size: 0.7rem;
		line-height: 1;
		cursor: pointer;
		opacity: 0;
		transition:
			opacity 120ms ease,
			border-color 150ms ease,
			color 150ms ease;
	}
	.tb-tile:hover .tb-tile-cmp,
	.tb-tile-cmp:focus-visible,
	.tb-tile-cmp--on {
		opacity: 1;
	}
	.tb-tile-cmp:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
		color: var(--text);
	}
	.tb-tile-cmp--on {
		border-color: color-mix(in srgb, var(--accent) 65%, var(--border));
		background: color-mix(in srgb, var(--accent) 30%, var(--bg));
		color: var(--text);
	}
	.tb-tile-cmp:disabled {
		opacity: 0;
		cursor: default;
	}
	.tb-tile:hover .tb-tile-cmp:disabled {
		opacity: 0.35;
	}

	.tb-tile-img-wrap {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--el-color) 10%, var(--bg)) 0%,
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
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--el-color);
	}

	.tb-tile-con {
		position: absolute;
		top: 4px;
		left: 4px;
		padding: 1px 5px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--bg) 80%, transparent);
		border: 1px solid color-mix(in srgb, var(--el-color) 55%, transparent);
		color: var(--text);
		font-size: 0.6rem;
		font-weight: 600;
	}

	.tb-tile-rarity {
		position: absolute;
		top: 4px;
		right: 4px;
		font-size: 0.6rem;
		color: var(--muted);
		opacity: 0.85;
	}
	.tb-tile-rarity--five {
		color: var(--el-geo-hi, #eed8a5);
	}

	.tb-tile-name {
		padding: 0.35rem 0.5rem 0.1rem;
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tb-tile-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
		padding: 0.25rem 0.5rem 0.5rem;
	}

	.tb-badge {
		padding: 1px 5px;
		border-radius: 3px;
		font-size: 0.58rem;
		font-weight: 600;
		letter-spacing: 0.04em;
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
</style>
