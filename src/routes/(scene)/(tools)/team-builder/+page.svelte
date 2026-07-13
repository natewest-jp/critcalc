<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { getAllCharacterIndex } from '$lib/data/characterLookup';
	import { constellations, siteSettings } from '$lib/stores';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import type { Element } from '$lib/types/ability';
	import type { WeaponType } from '$lib/types/weapon';
	import {
		FACETS,
		conCapFor,
		facetBadges,
		splitRoster,
		type ConMode,
		type FacetKey
	} from './lib/facets';
	import CharacterTile from './lib/CharacterTile.svelte';
	import DetailCard from './lib/DetailCard.svelte';
	import CompareTray from './lib/CompareTray.svelte';
	import CompareView from './lib/CompareView.svelte';
	import { MAX_COMPARE } from './lib/compare';

	// ---------------------------------------------------------------------------
	// Roster (eager index; full payloads stay lazy behind the detail card)
	// ---------------------------------------------------------------------------

	const roster = getAllCharacterIndex()
		.filter((c) => c.id !== 'blank')
		.sort((a, b) => a.displayName.localeCompare(b.displayName));

	// ---------------------------------------------------------------------------
	// SSR/hydration safety (see project_rotation_planner_ssr_fix): the server and
	// the first client paint render the deterministic default (no personalization);
	// localStorage-backed stores apply after mount.
	// ---------------------------------------------------------------------------

	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});

	const preferNewfit = $derived(mounted && $siteSettings.useNewOutfits);
	const traveler = $derived(mounted ? $siteSettings.travelerVariant : 'aether');

	// ---------------------------------------------------------------------------
	// Filters
	// ---------------------------------------------------------------------------

	const ELEMENTS: Element[] = ['anemo', 'cryo', 'dendro', 'electro', 'geo', 'hydro', 'pyro'];
	const WEAPONS: WeaponType[] = ['sword', 'claymore', 'polearm', 'bow', 'catalyst'];
	const RARITIES = [4, 5] as const;
	const allRegions = [...new Set(roster.map((c) => c.region).filter(Boolean) as string[])].sort();

	const activeFacets = new SvelteSet<FacetKey>();
	const filterElements = new SvelteSet<string>();
	const filterWeapons = new SvelteSet<string>();
	const filterRarities = new SvelteSet<number>();
	let filterRegion = $state('');
	let search = $state('');
	let conMode = $state<ConMode>('mine');

	function toggleSet<T>(set: SvelteSet<T>, val: T): void {
		if (set.has(val)) set.delete(val);
		else set.add(val);
	}

	function clearAll(): void {
		activeFacets.clear();
		filterElements.clear();
		filterWeapons.clear();
		filterRarities.clear();
		filterRegion = '';
		search = '';
	}

	const anyFilterActive = $derived(
		activeFacets.size > 0 ||
			filterElements.size > 0 ||
			filterWeapons.size > 0 ||
			filterRarities.size > 0 ||
			filterRegion !== '' ||
			search.trim() !== ''
	);

	// Reference $constellations so the split re-derives when roster levels change.
	const split = $derived.by(() => {
		const cons = mounted ? $constellations : {};
		return splitRoster(
			roster,
			{
				elements: filterElements,
				weapons: filterWeapons,
				rarities: filterRarities,
				region: filterRegion,
				search
			},
			activeFacets,
			(id) => conCapFor(conMode, cons[id])
		);
	});

	const CON_MODES: { key: ConMode; label: string; hint: string }[] = [
		{ key: 'c0', label: 'C0', hint: 'Base kits only — what every copy of the character can do' },
		{
			key: 'mine',
			label: 'My roster',
			hint: 'Uses your saved constellations (set them in a character’s details)'
		},
		{ key: 'max', label: 'C6', hint: 'Everything the kit can ever do' }
	];

	// ---------------------------------------------------------------------------
	// Detail card
	// ---------------------------------------------------------------------------

	let selectedId = $state<string | null>(null);

	function elColor(element: string | undefined): string {
		return (elementColors[(element ?? 'none') as ElementKey] ?? elementColors.none).main;
	}

	// ---------------------------------------------------------------------------
	// Compare selection (Layer 2) — ephemeral, insertion-ordered, max 4
	// ---------------------------------------------------------------------------

	const compareIds = new SvelteSet<string>();
	let compareOpen = $state(false);

	function toggleCompare(id: string): void {
		if (compareIds.has(id)) {
			compareIds.delete(id);
			if (compareIds.size < 2) compareOpen = false;
		} else if (compareIds.size < MAX_COMPARE) {
			compareIds.add(id);
		}
	}
</script>

<svelte:head>
	<title>Team Builder | critcalc.app</title>
</svelte:head>

<div class="tb">
	<!-- ── Facet rail ─────────────────────────────────────────── -->
	<aside class="tb-rail vz-panel">
		<input
			class="tb-search"
			type="text"
			placeholder="Search characters…"
			bind:value={search}
			autocomplete="off"
			autocorrect="off"
			spellcheck={false}
		/>

		<div>
			<p class="vz-kicker">Constellations</p>
			<div class="tb-conmode" role="radiogroup" aria-label="Constellation mode">
				{#each CON_MODES as m (m.key)}
					<button
						class="tb-conmode-btn"
						class:active={conMode === m.key}
						role="radio"
						aria-checked={conMode === m.key}
						title={m.hint}
						onclick={() => (conMode = m.key)}>{m.label}</button
					>
				{/each}
			</div>
		</div>

		<div>
			<p class="vz-kicker">Can provide</p>
			<div class="tb-chips">
				{#each FACETS as facet (facet.key)}
					<button
						class="tb-chip"
						class:active={activeFacets.has(facet.key)}
						title={facet.hint}
						aria-pressed={activeFacets.has(facet.key)}
						onclick={() => toggleSet(activeFacets, facet.key)}>{facet.label}</button
					>
				{/each}
			</div>
			{#if activeFacets.size > 1}
				<p class="tb-note">Matching characters provide all of these.</p>
			{/if}
		</div>

		<div>
			<p class="vz-kicker">Element</p>
			<div class="tb-chips">
				{#each ELEMENTS as el (el)}
					<button
						class="tb-chip tb-chip--element"
						class:active={filterElements.has(el)}
						style:--chip-color={elColor(el)}
						aria-pressed={filterElements.has(el)}
						onclick={() => toggleSet(filterElements, el)}>{el}</button
					>
				{/each}
			</div>
		</div>

		<div>
			<p class="vz-kicker">Weapon</p>
			<div class="tb-chips">
				{#each WEAPONS as w (w)}
					<button
						class="tb-chip"
						class:active={filterWeapons.has(w)}
						aria-pressed={filterWeapons.has(w)}
						onclick={() => toggleSet(filterWeapons, w)}>{w}</button
					>
				{/each}
			</div>
		</div>

		<div>
			<p class="vz-kicker">Rarity</p>
			<div class="tb-chips">
				{#each RARITIES as r (r)}
					<button
						class="tb-chip"
						class:active={filterRarities.has(r)}
						aria-pressed={filterRarities.has(r)}
						onclick={() => toggleSet(filterRarities, r)}>{r}★</button
					>
				{/each}
			</div>
		</div>

		<div>
			<p class="vz-kicker">Region</p>
			<div class="tb-chips">
				{#each allRegions as region (region)}
					<button
						class="tb-chip"
						class:active={filterRegion === region}
						aria-pressed={filterRegion === region}
						onclick={() => (filterRegion = filterRegion === region ? '' : region)}>{region}</button
					>
				{/each}
			</div>
		</div>

		{#if anyFilterActive}
			<button class="tb-clear" onclick={clearAll}>Clear filters</button>
		{/if}
	</aside>

	<!-- ── Roster ─────────────────────────────────────────────── -->
	<div class="tb-content">
		<p class="tb-count" role="status">
			{split.matches.length} character{split.matches.length === 1 ? '' : 's'}
			{#if activeFacets.size > 0 && conMode === 'mine'}
				<span class="tb-count-mode">at your constellations</span>
			{:else if activeFacets.size > 0 && conMode === 'max'}
				<span class="tb-count-mode">at C6</span>
			{/if}
		</p>

		<div class="tb-grid">
			{#each split.matches as entry (entry.id)}
				<CharacterTile
					{entry}
					badges={facetBadges(entry.caps)}
					{activeFacets}
					myCon={conMode === 'mine' && mounted ? ($constellations[entry.id] ?? 0) : undefined}
					{preferNewfit}
					{traveler}
					onOpen={(id) => (selectedId = id)}
					compared={compareIds.has(entry.id)}
					compareFull={compareIds.size >= MAX_COMPARE}
					onToggleCompare={toggleCompare}
				/>
			{/each}
		</div>

		{#if split.matches.length === 0}
			<p class="tb-empty">
				No curated character matches.
				{#if conMode === 'c0' && activeFacets.size > 0}
					Some kits unlock these capabilities at higher constellations — try “My roster” or “C6”.
				{/if}
			</p>
		{/if}

		{#if split.uncurated.length > 0}
			<section class="tb-stubs">
				<p class="vz-kicker">Not yet curated</p>
				<p class="tb-note">
					These kits have no capability data yet — they may well do what you’re filtering for.
					Absence of a badge here means “unknown”, not “no”.
				</p>
				<div class="tb-grid">
					{#each split.uncurated as entry (entry.id)}
						<CharacterTile
							{entry}
							badges={facetBadges(entry.caps)}
							{activeFacets}
							{preferNewfit}
							{traveler}
							dimmed
							onOpen={(id) => (selectedId = id)}
							compared={compareIds.has(entry.id)}
							compareFull={compareIds.size >= MAX_COMPARE}
							onToggleCompare={toggleCompare}
						/>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>

{#if selectedId}
	<DetailCard id={selectedId} {conMode} onClose={() => (selectedId = null)} />
{/if}

{#if compareIds.size > 0 && !compareOpen}
	<CompareTray
		ids={[...compareIds]}
		onRemove={toggleCompare}
		onClear={() => compareIds.clear()}
		onCompare={() => (compareOpen = true)}
	/>
{/if}

{#if compareOpen && compareIds.size >= 2}
	<CompareView
		ids={[...compareIds]}
		{conMode}
		onClose={() => (compareOpen = false)}
		onRemove={toggleCompare}
	/>
{/if}

<style>
	.tb {
		display: grid;
		grid-template-columns: 250px minmax(0, 1fr);
		gap: 1.25rem;
		align-items: start;
	}

	@media (max-width: 860px) {
		.tb {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	/* ── Rail ─────────────────────────────────────────────────── */
	.tb-rail {
		gap: 1rem;
		position: sticky;
		top: 0;
		max-height: calc(100svh - var(--tool-pad-top, 2rem) - var(--tool-pad-bottom, 2rem));
		overflow-y: auto;
	}

	@media (max-width: 860px) {
		.tb-rail {
			position: static;
			max-height: none;
		}
	}

	.tb-search {
		box-sizing: border-box;
		width: 100%;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 3px;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 0.78rem;
		padding: 0.5rem 0.7rem;
		outline: none;
		transition: border-color 150ms ease;
	}
	.tb-search:focus {
		border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
	}

	.tb-conmode {
		display: flex;
		border: 1px solid var(--border);
		border-radius: 3px;
		overflow: hidden;
		margin-top: 0.55rem;
	}

	.tb-conmode-btn {
		flex: 1;
		padding: 0.4rem 0.2rem;
		border: none;
		background: none;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	.tb-conmode-btn + .tb-conmode-btn {
		border-left: 1px solid var(--border);
	}
	.tb-conmode-btn:hover {
		color: var(--text);
	}
	.tb-conmode-btn.active {
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		color: var(--text);
	}

	.tb-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-top: 0.55rem;
	}

	.tb-chip {
		padding: 0.3rem 0.55rem;
		border: none;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.06);
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: capitalize;
		cursor: pointer;
		transition:
			background 150ms ease,
			box-shadow 150ms ease,
			color 150ms ease;
	}
	.tb-chip:hover {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--text);
	}
	.tb-chip.active {
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent);
		color: var(--text);
	}
	.tb-chip--element.active {
		background: color-mix(in srgb, var(--chip-color) 16%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--chip-color) 60%, transparent);
		color: var(--chip-color);
	}

	.tb-note {
		margin: 0.5rem 0 0;
		font-size: 0.68rem;
		line-height: 1.45;
		color: var(--muted);
	}

	.tb-clear {
		padding: 0.45rem;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: none;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		cursor: pointer;
		transition:
			border-color 150ms ease,
			color 150ms ease;
	}
	.tb-clear:hover {
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
		color: var(--text);
	}

	/* ── Content ──────────────────────────────────────────────── */
	.tb-content {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		min-width: 0;
	}

	.tb-count {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.tb-count-mode {
		opacity: 0.7;
		text-transform: none;
		letter-spacing: 0.02em;
	}

	.tb-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
		gap: 0.6rem;
	}

	.tb-empty {
		margin: 1.5rem 0;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.tb-stubs {
		margin-top: 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
</style>
