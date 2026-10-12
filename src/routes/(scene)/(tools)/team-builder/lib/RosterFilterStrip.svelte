<script lang="ts">
	/**
	 * THE ROSTER'S FILTER STRIP (Party Setup shape, design doc §11.2 / §11.6).
	 *
	 * The four roles as icons, the seven elements, the fingerprint's glyphs
	 * ("Can provide" — step 4: the fingerprint IS the filter vocabulary, so
	 * the icons you read on a card and a team are the ones you filter by), and
	 * the count — the filters you READ the grid by, so they sit on top of it.
	 * Two glyphs at once ask for characters who provide BOTH. Search, Show and More live
	 * in band B's character cell (`MoreFilters` is that popover's contents).
	 * It owns no state: every set is the page's, the same objects the grid
	 * filters against.
	 */
	import type { SvelteSet } from 'svelte/reactivity';
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
		activeRole,
		onRole,
		count,
		countNote,
		anyActive,
		onClear
	}: {
		filters: GridFilters;
		/** "Can provide" — the capability facets a character must ALL offer. */
		activeFacets: SvelteSet<FacetKey>;
		/** The role the filter currently is, if it is exactly one. */
		activeRole: string | null;
		onRole: (cat: RoleCategory) => void;
		count: number;
		/** "at your constellations" — the lens the count was read at. */
		countNote?: string;
		/** Anything narrowing the roster, band B's filters included. */
		anyActive: boolean;
		onClear: () => void;
	} = $props();

	const ELEMENTS: Element[] = ['anemo', 'cryo', 'dendro', 'electro', 'geo', 'hydro', 'pyro'];

	function toggle(el: string): void {
		if (filters.elements.has(el)) filters.elements.delete(el);
		else filters.elements.add(el);
	}
	const FACET = Object.fromEntries(FACETS.map((f) => [f.key, f]));
	function toggleFacet(facet: FacetKey): void {
		if (activeFacets.has(facet)) activeFacets.delete(facet);
		else activeFacets.add(facet);
	}
	const elColor = (el: string) => (elementColors[el as ElementKey] ?? elementColors.none).main;
</script>

<!-- ctx-glass: the plates stand on the night, so their tokens are glass ones —
     under the page's ctx-dark a btn--glass rested and HOVERED in slate. -->
<div class="rfs ctx-glass" role="group" aria-label="Role and element">
	<div class="rfs-icons" role="group" aria-label="Role">
		{#each ROLE_CATEGORIES as cat (cat.key)}
			{@const on = activeRole === cat.key}
			<button
				class="btn btn--icon btn--glass rfs-role"
				class:is-active={on}
				aria-pressed={on}
				aria-label={cat.label}
				title={on ? 'Show every role again' : cat.label}
				onclick={() => onRole(cat)}
			>
				{#if cat.position}<img src={positionIcon(cat.position, 'color')} alt="" />{/if}
				<img src={functionIcon(cat.function, 'color')} alt="" />
			</button>
		{/each}
	</div>
	<div class="rfs-icons" role="group" aria-label="Element">
		{#each ELEMENTS as el (el)}
			{@const on = filters.elements.has(el)}
			<button
				class="btn btn--icon btn--glass rfs-el"
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
	<!-- The fingerprint's own order and clusters (Survival · Support · Damage). -->
	<div class="rfs-glyphs" role="group" aria-label="Can provide">
		{#each FINGERPRINT as c (c.cluster)}
			<span class="rfs-icons">
				{#each c.facets as facet (facet)}
					{@const on = activeFacets.has(facet)}
					{@const f = FACET[facet]}
					<button
						class="btn btn--icon btn--glass rfs-glyph"
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
	<span class="rfs-end">
		<p class="rfs-count" role="status">
			{count} character{count === 1 ? '' : 's'}{#if countNote}<span class="rfs-count-note"
					>{countNote}</span
				>{/if}
		</p>
		{#if anyActive}
			<button class="btn btn--sm btn--glass" onclick={onClear}>Clear</button>
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
	.rfs-icons {
		display: flex;
		gap: 4px;
	}
	.rfs-role,
	.rfs-el {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 1px;
		height: 30px;
		min-width: 30px;
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
		height: 30px;
		min-width: 26px;
		padding: 0;
		color: var(--text);
	}
	.rfs-glyph-art {
		width: 16px;
		height: 16px;
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
	.rfs-el.is-active {
		box-shadow: inset 0 0 0 1px var(--el);
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
</style>
