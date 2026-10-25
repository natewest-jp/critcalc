<script lang="ts">
	/**
	 * THE CHARACTER FILTER STRIP (Party Setup shape, design doc §11.2 / §11.6)
	 * — the Builder's roster, and since 2026-10-25 Teams' details, where it
	 * moved to `$lib` from the Builder's own folder (it was RosterFilterStrip).
	 *
	 * The four roles as icons, the seven elements, the fingerprint's glyphs
	 * ("Can provide" — step 4: the fingerprint IS the filter vocabulary, so
	 * the icons you read on a card and a team are the ones you filter by) —
	 * the filters you READ the grid by, so they sit on top of it. Each group
	 * is ONE joined glass bar (⚓ Nate 2026-10-13), and the count lives in the
	 * destination banner below when there is one, here only when there isn't.
	 * Two glyphs at once ask for characters who provide BOTH. Search, Show and More live
	 * in band B's character cell (`MoreFilters` is that popover's contents).
	 * It owns no state: every set is the page's, the same objects the grid
	 * filters against.
	 *
	 * Teams' details pass no `activeFacets` (the capability glyphs are parked
	 * there, Nate 2026-10-25), bring their own search and Show/More through
	 * `start` / `end`, and stand on SLATE (`slate`), not the night.
	 */
	import type { Snippet } from 'svelte';
	import type { SvelteSet } from 'svelte/reactivity';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import type { GridFilters } from '$lib/characterFilters';
	import type { FacetKey } from '$lib/capabilities/deriveCapabilities';
	import { FACETS } from '$lib/capabilities/facets';
	import { FINGERPRINT } from '$lib/fingerprint';
	import FingerprintGlyph from '$lib/components/FingerprintGlyph.svelte';
	import type { Element } from '$lib/types/ability';
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { positionIcon, functionIcon } from '$lib/utils/roleIcons';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { ROLE_CATEGORIES, type RoleCategory } from '$lib/capabilities/roles';

	let {
		filters,
		activeFacets,
		slate = false,
		start,
		end,
		activeRole,
		onRole,
		count,
		countNote,
		anyActive,
		onClear
	}: {
		filters: GridFilters;
		/** "Can provide" — the capability facets a character must ALL offer.
		 *  Omitted, the glyph group is not drawn. */
		activeFacets?: SvelteSet<FacetKey>;
		/** On the full-screen surface's slate rather than the night: the bars
		 *  take the slate's raised rung instead of glass. */
		slate?: boolean;
		/** Controls before the groups (Teams: search) and after them, before
		 *  the count and Clear (Teams: Show, More). */
		start?: Snippet;
		end?: Snippet;
		/** The role the filter currently is, if it is exactly one. */
		activeRole: string | null;
		onRole: (cat: RoleCategory) => void;
		/** Unset when the destination banner says it instead. */
		count?: number;
		/** "at your constellations" — the lens the count was read at. */
		countNote?: string;
		/** Anything narrowing the roster, band B's filters included. */
		anyActive: boolean;
		/** Unset when the band holds Clear instead (under the switch). */
		onClear?: () => void;
	} = $props();

	const ELEMENTS: Element[] = ['anemo', 'cryo', 'dendro', 'electro', 'geo', 'hydro', 'pyro'];

	function toggle(el: string): void {
		if (filters.elements.has(el)) filters.elements.delete(el);
		else filters.elements.add(el);
	}
	const FACET = Object.fromEntries(FACETS.map((f) => [f.key, f]));
	function toggleFacet(facet: FacetKey): void {
		if (!activeFacets) return;
		if (activeFacets.has(facet)) activeFacets.delete(facet);
		else activeFacets.add(facet);
	}
	const elColor = (el: string) => (elementColors[el as ElementKey] ?? elementColors.none).main;

	/** A phone plate shows every choice up to this many, then two and "+N". */
	const PLATE_SHOWN = 3;
	/** The chosen elements and facets in the strip's own order, which is the
	 *  order a plate shows them in. */
	const chosenElements = $derived(ELEMENTS.filter((el) => filters.elements.has(el)));
	const chosenFacets = $derived(
		FINGERPRINT.flatMap((c) => c.facets).filter((f) => !!activeFacets?.has(f))
	);
	const plateLabel = (word: string, n: number) => (n === 0 ? word : `${word}: ${n} selected`);
</script>

<!-- The three groups, each ONE snippet so the phone's popovers hold the very
     controls the strip shows at width — same sets, same handlers. -->
{#snippet roleBar()}
	<div class="rfs-bar" role="group" aria-label="Role">
		{#each ROLE_CATEGORIES as cat (cat.key)}
			{@const on = activeRole === cat.key}
			<button
				class="btn btn--icon rfs-role"
				class:is-active={on}
				aria-pressed={on}
				aria-label={cat.label}
				title={on ? 'Show every role again' : cat.label}
				onclick={() => onRole(cat)}
			>
				{@render roleIcons(cat)}
			</button>
		{/each}
	</div>
{/snippet}

{#snippet roleIcons(cat: RoleCategory)}
	{#if cat.position}<img src={positionIcon(cat.position, 'color')} alt="" />{/if}
	<img src={functionIcon(cat.function, 'color')} alt="" />
{/snippet}

{#snippet elementBar()}
	<div class="rfs-bar" role="group" aria-label="Element">
		{#each ELEMENTS as el (el)}
			{@const on = filters.elements.has(el)}
			<button
				class="btn btn--icon rfs-el"
				class:is-active={on}
				style:--el={elColor(el)}
				aria-pressed={on}
				aria-label={el}
				title={el[0].toUpperCase() + el.slice(1)}
				onclick={() => toggle(el)}
			>
				<img src={elementIcon(el)} alt="" />
			</button>
		{/each}
	</div>
{/snippet}

<!-- The fingerprint's own order and clusters (Survival · Support · Damage). -->
{#snippet glyphRow()}
	<div class="rfs-glyphs" role="group" aria-label="Can provide">
		{#each FINGERPRINT as c (c.cluster)}
			<span class="rfs-bar">
				{#each c.facets as facet (facet)}
					{@const on = !!activeFacets?.has(facet)}
					{@const f = FACET[facet]}
					<button
						class="btn btn--icon rfs-glyph"
						class:is-active={on}
						aria-pressed={on}
						aria-label={`Can provide: ${f?.label ?? facet}`}
						title={f ? `${f.label} — ${f.hint}` : facet}
						onclick={() => toggleFacet(facet)}
					>
						<span class="rfs-glyph-art"><FingerprintGlyph {facet} /></span>
					</button>
				{/each}
			</span>
		{/each}
	</div>
{/snippet}

<!-- A plate's resting face: the word while it holds nothing, else what it
     holds — all of it up to PLATE_SHOWN, past that the first two and a count. -->
{#snippet plateFace(word: string, n: number, icon: Snippet<[number]>)}
	{#if n === 0}
		<span class="band-menu-label">{word}</span>
	{:else}
		<span class="rfs-plate-icons">
			{#each { length: n > PLATE_SHOWN ? 2 : n } as _, i (i)}{@render icon(i)}{/each}
			{#if n > PLATE_SHOWN}<span class="rfs-plate-more">+{n - 2}</span>{/if}
		</span>
	{/if}
{/snippet}

{#snippet roleFace()}
	{@const cat = ROLE_CATEGORIES.find((c) => c.key === activeRole)}
	{#if cat}
		<span class="rfs-plate-icons rfs-plate-icons--role">{@render roleIcons(cat)}</span>
	{:else}
		<span class="band-menu-label">Roles</span>
	{/if}
{/snippet}

{#snippet elementIconAt(i: number)}
	<img class="rfs-plate-el" src={elementIcon(chosenElements[i])} alt="" />
{/snippet}
{#snippet elementFace()}
	{@render plateFace('Elements', chosenElements.length, elementIconAt)}
{/snippet}

{#snippet glyphAt(i: number)}
	<span class="rfs-glyph-art"><FingerprintGlyph facet={chosenFacets[i]} /></span>
{/snippet}
{#snippet capabilityFace()}
	{@render plateFace('Capabilities', chosenFacets.length, glyphAt)}
{/snippet}

<!-- ctx-glass: the plates stand on the night, so their tokens are glass ones —
     under the page's ctx-dark a btn--glass rested and HOVERED in slate. -->
<div
	class="rfs"
	class:ctx-glass={!slate}
	class:rfs--slate={slate}
	role="group"
	aria-label={slate ? 'Filters' : 'Role and element'}
>
	{@render start?.()}
	<div class="rfs-inline">
		{@render roleBar()}
		{@render elementBar()}
		{#if activeFacets}{@render glyphRow()}{/if}
	</div>
	<!-- BELOW `compact` THE THREE ROWS ARE THREE PLATES (2026-10-15, ⚓ Nate):
	     on a phone they wrapped to four rows over the grid. Each plate opens
	     its row in a popover — BandMenu's, portalled, as More is. -->
	<div class="rfs-plates">
		<BandMenu
			glass={!slate}
			size="sm"
			role="dialog"
			align="start"
			ariaLabel={activeRole ? 'Roles: 1 selected' : 'Roles'}
			face={roleFace}
		>
			{#snippet items()}
				<div class="rfs-pop ctx-glass">{@render roleBar()}</div>
			{/snippet}
		</BandMenu>
		<BandMenu
			glass={!slate}
			size="sm"
			role="dialog"
			align="start"
			ariaLabel={plateLabel('Elements', chosenElements.length)}
			face={elementFace}
		>
			{#snippet items()}
				<div class="rfs-pop ctx-glass">{@render elementBar()}</div>
			{/snippet}
		</BandMenu>
		{#if activeFacets}
			<BandMenu
				glass={!slate}
				size="sm"
				role="dialog"
				align="start"
				ariaLabel={plateLabel('Capabilities', chosenFacets.length)}
				face={capabilityFace}
			>
				{#snippet items()}
					<div class="rfs-pop ctx-glass">{@render glyphRow()}</div>
				{/snippet}
			</BandMenu>
		{/if}
	</div>
	{@render end?.()}
	<span class="rfs-end">
		{#if count !== undefined}
			<p class="rfs-count" role="status">
				{count} character{count === 1 ? '' : 's'}{#if countNote}<span class="rfs-count-note"
						>{countNote}</span
					>{/if}
			</p>
		{/if}
		{#if anyActive && onClear}
			<button class="btn btn--sm" class:btn--glass={!slate} onclick={onClear}>Clear</button>
		{/if}
	</span>
</div>

<style>
	/* Plates on the night, groups at EVEN gaps with no rules between them
	   (⚓ Nate's toolbar rulings). */
	.rfs {
		flex: none;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
	}
	/* ONE glass bar per group (⚓ Nate 2026-10-13), the segmented group's
	   build on the band's plate: a 2px track, its buttons bare inside it, so
	   a group reads as one object and the gaps between groups do the
	   grouping. Hover and chosen are the glass ladder's (app.css: density +
	   an ink ring / a gold ring). */
	.rfs-bar {
		display: flex;
		gap: 2px;
		padding: 2px;
		border-radius: var(--r-sm);
		background: var(--surface); /* = --glass-panel, via .ctx-glass */
	}
	/* On slate there is no glass: the track is the slate's raised rung. */
	.rfs--slate .rfs-bar {
		background: var(--surface-raised);
	}
	.rfs-bar > .btn {
		border-radius: var(--r-xs);
		background: transparent;
	}
	:global(:where(:root:not([data-next]))) .rfs-bar > .btn:hover:not(:disabled) {
		background: var(--surface-hover);
		box-shadow: inset 0 0 0 1px var(--glass-ring);
	}
	:global(:where(:root:not([data-next]))) .rfs-bar > .btn.is-active {
		background: var(--surface-hover);
		box-shadow: inset 0 0 0 1px var(--sel-ring);
		color: var(--text);
	}
	/* ↻ 2026-10-25 (Builder toolbar round), under the switch: a filter that
	   is ON is a dim gold FILL, the toolbar's "on" (app.css, ON IS A DIM GOLD
	   FILL); the ring is left to the hand, and only where a hand can hover. */
	@media (hover: hover) {
		:global(:where(:root[data-next])) .rfs-bar > .btn:hover:not(:disabled) {
			background: var(--surface-hover);
			box-shadow: inset 0 0 0 1px var(--glass-ring);
		}
	}
	:global(:where(:root[data-next])) .rfs-bar > .btn.is-active {
		background: color-mix(in srgb, var(--accent) 20%, var(--btn-face));
		color: var(--text);
	}
	.rfs-role,
	.rfs-el {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 1px;
		height: 26px;
		min-width: 28px;
	}
	/* The glyph row: its clusters at the fingerprint's own spacing, a wider
	   gap between them than inside them. */
	.rfs-glyphs {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
	}
	.rfs-glyph {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 26px;
		min-width: 26px;
		padding: 0;
		color: var(--text);
	}
	.rfs-glyph-art {
		width: 13px;
		height: 13px;
	}
	.rfs-role img {
		width: 16px;
		height: 16px;
		object-fit: contain;
	}
	.rfs-el img {
		width: 18px;
		height: 18px;
		object-fit: contain;
	}
	/* An element is chosen in its own hue — the element chip's grammar. */
	:global(:where(:root:not([data-next]))) .rfs-bar > .rfs-el.is-active {
		box-shadow: inset 0 0 0 1px var(--el);
	}
	/* Under the switch the element's hue FILLS, as gold does for the rest. */
	:global(:where(:root[data-next])) .rfs-bar > .rfs-el.is-active {
		background: color-mix(in srgb, var(--el) 24%, var(--btn-face));
	}
	.rfs-end {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.rfs-count {
		margin: 0;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
		white-space: nowrap;
	}
	.rfs-count-note {
		/* The markup's line break is trimmed, so the space is the margin. */
		margin-left: 0.35em;
		text-transform: none;
		letter-spacing: var(--ls-tight);
		font-weight: var(--fw-regular, 400);
	}
	/* THE PHONE FORM (2026-10-15). At width the three groups are the strip's
	   own flex items (`contents`), exactly as before the plates existed; below
	   `compact` they give way to three plates in one row. */
	.rfs-inline {
		display: contents;
	}
	.rfs-plates {
		display: none;
	}
	@media (max-width: 40rem) /* compact — $lib/breakpoints.ts */ {
		.rfs-inline {
			display: none;
		}
		/* Teams' row also carries Show and More: at the Builder's 1rem the
		   mark-only More wrapped alone at 320 by ~10px. */
		.rfs--slate {
			column-gap: 0.5rem;
		}
		.rfs-plates {
			display: flex;
			gap: 6px;
		}
		/* An empty end (the count is in the destination banner, nothing to
		   clear) must not wrap to a row of its own and spend the row gap.
		   ⚠ `:has`, not `:empty` — the if-blocks leave a space between them. */
		.rfs-end:not(:has(*)) {
			display: none;
		}
	}
	/* 🎛️ The plates are `.btn--sm` at the strip's 26px row, and the word sits
	   nearer its chevron than a band menu's does: so measured, the three empty
	   plates take 286px of 288 at 320 (Chrome and WebKit agree), and at the
	   band-menu defaults they took 322 and overflowed. */
	.rfs-plates :global(.band-menu-trigger) {
		height: 26px;
		gap: 0.25rem;
	}
	/* A plate's resting face: what it holds, at the strip's own icon sizes. */
	.rfs-plate-icons {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}
	.rfs-plate-icons--role {
		gap: 1px;
	}
	.rfs-plate-icons--role img {
		width: 16px;
		height: 16px;
		object-fit: contain;
	}
	.rfs-plate-el {
		width: 16px;
		height: 16px;
		object-fit: contain;
	}
	.rfs-plate-icons .rfs-glyph-art {
		display: inline-block;
	}
	.rfs-plate-more {
		margin-left: 2px;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}
	/* The popover: the same bar, on the glass ladder (the menu itself is slate),
	   with the menu's breathing room around it. */
	.rfs-pop {
		padding: 6px 8px;
	}
	.rfs-pop .rfs-glyphs {
		max-width: calc(100vw - 32px);
	}
</style>
