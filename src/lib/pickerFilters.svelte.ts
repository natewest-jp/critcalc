/**
 * src/lib/pickerFilters.svelte.ts
 *
 * THE CHARACTER SOURCE'S FILTER STATE — the planner picker's half of the
 * aside-column round (2026-08-08).
 *
 * The picker used to be one component: grid and filter rail packed together,
 * layered over the timeline frame as a single overlay, with the filter state
 * private inside it. The round splits the two across the surface's columns —
 * the cards cover the timeline, the filters cover the notes — so the state they
 * share can no longer belong to either half. It meets in a rune module, the way
 * rotationTabs, benchBand, documentBar and plannerView already broker between
 * the layout, the bench and both tools.
 *
 * Direction of flow:
 *   filters / activeFacets  — EDITED by <CharacterSelectorFilters> (the aside),
 *                             READ by <CharacterSelector> (the grid)
 *
 * Living outside both components also means the state SURVIVES the aside
 * swapping back to the notes column: close the picker with three chips lit,
 * reopen it, and they are still lit. The old packed rail got that for free by
 * never unmounting; this is the deliberate version of the same promise.
 *
 * Deliberately NOT persisted: a half-typed search box is not part of the
 * document, and nothing here belongs in a saved-team entry.
 */

import { SvelteSet } from 'svelte/reactivity';
import type { GridFilters } from '$lib/characterFilters';
import type { FacetKey } from '$lib/capabilities/deriveCapabilities';

class PickerFilterState {
	/** The identity filters both halves share (see GridFilters). `$state`, not a
	 *  bare object: `region` and `search` are plain string properties, and only
	 *  the deep proxy makes writing them reactive. The SvelteSets inside are
	 *  class instances, which the proxy leaves alone — they carry their own. */
	filters: GridFilters = $state({
		elements: new SvelteSet<string>(),
		weapons: new SvelteSet<string>(),
		rarities: new SvelteSet<number>(),
		region: '',
		search: '',
		factionBuffs: new SvelteSet<string>()
	});

	/**
	 * Capability facets — "who can heal / shield / group for me". Not part of
	 * GridFilters because they are DERIVED traits, not identity, and the grid
	 * applies them through its own predicate (which needs the roster's saved
	 * constellations, a store only the component can read reactively).
	 */
	readonly activeFacets = new SvelteSet<FacetKey>();

	/** Anything the shared Clear button doesn't own by itself. */
	get extraActive(): boolean {
		return this.activeFacets.size > 0;
	}

	clearExtras(): void {
		this.activeFacets.clear();
	}
}

export const pickerFilters = new PickerFilterState();
