<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { getAllCharacterIndex, getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { constellations, siteSettings, ownership } from '$lib/stores';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import type { Element } from '$lib/types/ability';
	import type { WeaponType } from '$lib/types/weapon';
	import {
		FACETS,
		conCapFor,
		facetBadges,
		splitRoster,
		type ConMode,
		type FacetKey,
		type OwnershipView
	} from './lib/facets';
	import { afterNavigate, replaceState } from '$app/navigation';
	import CharacterTile from './lib/CharacterTile.svelte';
	import DetailCard from './lib/DetailCard.svelte';
	import CompareTray from './lib/CompareTray.svelte';
	import CompareView from './lib/CompareView.svelte';
	import Bench from './lib/Bench.svelte';
	import AtlasView from './lib/AtlasView.svelte';
	import { buildAtlasCards } from './lib/atlas';
	import { MAX_COMPARE } from './lib/compare';
	import { facetsProvidedBy, parseTeamParam, serializeTeamParam, type TeamSlot } from './lib/team';

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

	// URL param consumption lives in afterNavigate, NOT onMount: on chained SPA
	// navigation the component mounts before the router updates location, so
	// onMount reads the PREVIOUS page's URL and silently drops the params.
	// Two hard-won rules (post-merge probe forensics, 2026-07-13):
	// - afterNavigate ALSO fires on the navigation that REMOVES this component,
	//   with nav.to pointing at the OTHER page — consuming its params here
	//   strips them before the destination can read them. Guard on nav.to.
	// - read nav.to.url, never window.location — location can lag the router.
	afterNavigate((nav) => {
		const url = nav.to?.url;
		if (!url || !url.pathname.endsWith('/team-builder')) return;
		// ?team= is the shareable slot state — and the planner's hand-off: the
		// Rotation Planner's "Explore alternatives →" sends the whole team here,
		// where Atlas surfaces what those four characters collectively touch. (The
		// old single-character ?replace= pre-seed is retired — a whole-team payload
		// covers "swap to cover a gap" and "swap to clone a role" alike.)
		teamSlots = parseTeamParam(url.searchParams.get('team'), (id) => rosterIds.has(id));
		urlSynced = true;
	});

	/** Flips once afterNavigate has parsed the real URL — gates the mirror
	 *  effect so a pre-sync teamSlots default can't strip a param first. */
	let urlSynced = $state(false);

	const preferNewfit = $derived(mounted && $siteSettings.useNewOutfits);
	const traveler = $derived(mounted ? $siteSettings.travelerVariant : 'aether');

	// ---------------------------------------------------------------------------
	// Source panel: Atlas (question-indexed cards) ⇄ Roster (grid)
	// ---------------------------------------------------------------------------

	let sourceTab = $state<'atlas' | 'roster'>('atlas');

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
	let ownershipView = $state<OwnershipView>('all');
	let editRoster = $state(false);

	function toggleSet<T>(set: SvelteSet<T>, val: T): void {
		if (set.has(val)) set.delete(val);
		else set.add(val);
	}

	// Filtering is a Roster-tab activity — any filter action lands you there.
	function toggleFacet(f: FacetKey): void {
		toggleSet(activeFacets, f);
		sourceTab = 'roster';
	}
	function toggleFilter<T>(set: SvelteSet<T>, val: T): void {
		toggleSet(set, val);
		sourceTab = 'roster';
	}
	function pickRegion(region: string): void {
		filterRegion = filterRegion === region ? '' : region;
		sourceTab = 'roster';
	}

	/** Atlas card / element pip / Bench coverage gap → focus that capability and
	 *  drop onto the filtered Roster. */
	function selectCapability(facet: FacetKey, element?: string): void {
		activeFacets.clear();
		activeFacets.add(facet);
		filterElements.clear();
		if (element) filterElements.add(element);
		sourceTab = 'roster';
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
		const own = mounted ? $ownership : {};
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
			(id) => conCapFor(conMode, cons[id]),
			ownershipView,
			(id) => own[id]
		);
	});

	// Atlas cards — question-indexed capability overview over the eager index.
	const atlasCards = $derived.by(() => {
		const cons = mounted ? $constellations : {};
		const own = mounted ? $ownership : {};
		return buildAtlasCards(
			roster,
			(id) => conCapFor(conMode, cons[id]),
			(id) => own[id] === 'owned'
		);
	});

	const ownsAny = $derived(mounted && Object.values($ownership).some((v) => v === 'owned'));

	// A tile fades when it's a not-owned character shown among owned ones: in the
	// 'all' view once the user owns anything, and always while editing the roster
	// (so owned vs not-owned reads at a glance, Genshin-collection style).
	function tileFaded(id: string): boolean {
		if (!mounted) return false;
		const notOwned = $ownership[id] !== 'owned';
		if (editRoster) return notOwned;
		return ownsAny && ownershipView === 'all' && notOwned;
	}

	const CON_MODES: { key: ConMode; label: string; hint: string }[] = [
		{ key: 'c0', label: 'C0', hint: 'Base kits only — what every copy of the character can do' },
		{
			key: 'mine',
			label: 'My roster',
			hint: 'Uses your saved constellations (set them in a character’s details)'
		},
		{ key: 'max', label: 'C6', hint: 'Everything the kit can ever do' }
	];

	const OWNERSHIP_VIEWS: { key: OwnershipView; label: string; hint: string }[] = [
		{ key: 'all', label: 'All', hint: 'Every character' },
		{ key: 'owned', label: 'Owned', hint: 'Only characters you’ve marked as owned' },
		{ key: 'wishlist', label: 'Wishlist', hint: 'Only characters you’ve wishlisted' }
	];

	// ---------------------------------------------------------------------------
	// Detail card
	// ---------------------------------------------------------------------------

	let selectedId = $state<string | null>(null);

	function elColor(element: string | undefined): string {
		return (elementColors[(element ?? 'none') as ElementKey] ?? elementColors.none).main;
	}

	// ---------------------------------------------------------------------------
	// Stage inspector (Layer 2) — Detail OR Compare, one at a time. Compare docks
	// into a widened Stage on wide screens; Audition is Compare with a pinned
	// anchor (the incumbent) and a commit that swaps the slot.
	// ---------------------------------------------------------------------------

	const compareIds = new SvelteSet<string>();
	let compareOpen = $state(false);
	/** Audition: the pinned incumbent + the slot it holds (null = plain compare). */
	let anchorId = $state<string | null>(null);
	let auditionSlot = $state<number | null>(null);

	const stageMode = $derived<'compare' | 'detail' | null>(
		compareOpen ? 'compare' : selectedId ? 'detail' : null
	);

	function openDetail(id: string): void {
		// Opening a detail leaves any in-progress audition — one Stage, one view.
		if (anchorId !== null) {
			compareIds.clear();
			anchorId = null;
			auditionSlot = null;
		}
		selectedId = id;
		compareOpen = false;
	}

	function openCompareView(): void {
		anchorId = null;
		auditionSlot = null;
		selectedId = null;
		compareOpen = true;
	}

	function closeCompare(): void {
		if (anchorId !== null) compareIds.clear(); // the audition selection is scoped
		compareOpen = false;
		anchorId = null;
		auditionSlot = null;
	}

	function toggleCompare(id: string): void {
		if (id === anchorId) return; // the audition anchor stays pinned
		if (compareIds.has(id)) {
			compareIds.delete(id);
			if (compareIds.size < 2 && anchorId === null) compareOpen = false;
		} else if (compareIds.size < MAX_COMPARE) {
			compareIds.add(id);
		}
	}

	/** Audition replacements for a filled slot: pin the incumbent as the anchor,
	 *  pre-seed the Source with the facets it provides ("find someone who does
	 *  what this character does"), and open Compare in the Stage. */
	function openAudition(index: number, incumbentId: string): void {
		compareIds.clear();
		compareIds.add(incumbentId);
		anchorId = incumbentId;
		auditionSlot = index;
		const cap = conCapFor(conMode, mounted ? ($constellations[incumbentId] ?? 0) : 0);
		const entry = getCharacterIndexEntry(incumbentId);
		activeFacets.clear();
		filterElements.clear();
		if (entry) for (const f of facetsProvidedBy(entry, cap)) activeFacets.add(f);
		sourceTab = 'roster';
		selectedId = null;
		compareOpen = true;
	}

	/** Commit an audition candidate into its slot, then close the Stage. */
	function commitAudition(candidateId: string): void {
		if (auditionSlot !== null) teamSlots[auditionSlot] = candidateId;
		closeCompare();
	}

	// ---------------------------------------------------------------------------
	// Team slots (Layer 3) — positional, mirrored into the ?team= URL param
	// ---------------------------------------------------------------------------

	const rosterIds = new Set(roster.map((c) => c.id));
	let teamSlots = $state<TeamSlot[]>([null, null, null, null]);

	const teamStateOf = (id: string): 'in' | 'out' | 'full' =>
		teamSlots.includes(id) ? 'in' : teamSlots.every((s) => s !== null) ? 'full' : 'out';

	function toggleTeam(id: string): void {
		const at = teamSlots.indexOf(id);
		if (at >= 0) {
			teamSlots[at] = null;
			return;
		}
		const empty = teamSlots.indexOf(null);
		if (empty >= 0) teamSlots[empty] = id;
	}

	// Mirror slots → URL (replace, not push — slot edits aren't nav history).
	// The query is built by hand so commas stay literal (searchParams.set would
	// %2C-encode them — legal but ugly in a URL meant to be shared).
	$effect(() => {
		const serialized = serializeTeamParam(teamSlots);
		if (!urlSynced) return;
		const current = new URLSearchParams(window.location.search).get('team') ?? '';
		if (current === serialized) return;
		const target =
			window.location.pathname + (serialized ? `?team=${serialized}` : '') + window.location.hash;
		// Query-string update on the CURRENT location, not a route navigation — no path to resolve.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		replaceState(target, {});
	});
</script>

<svelte:head>
	<title>Team Builder | critcalc.app</title>
</svelte:head>

<div
	class="tb"
	class:tb--inspect={stageMode === 'detail'}
	class:tb--compare={stageMode === 'compare'}
>
	<!-- ── Bench (the team) ───────────────────────────────────── -->
	<Bench
		slots={teamSlots}
		conCapOf={(id) => conCapFor(conMode, mounted ? ($constellations[id] ?? 0) : 0)}
		onRemove={(i) => (teamSlots[i] = null)}
		onClear={() => (teamSlots = [null, null, null, null])}
		onOpen={openDetail}
		onFilterFacet={(f) => selectCapability(f)}
		onAudition={openAudition}
	/>

	<!-- ── Source (Atlas ⇄ Roster) ────────────────────────────── -->
	<section class="tb-source">
		<div class="tb-tabs">
			<div class="tb-tabgroup" role="tablist" aria-label="Source view">
				<button
					class="tb-tab"
					class:active={sourceTab === 'atlas'}
					role="tab"
					aria-selected={sourceTab === 'atlas'}
					onclick={() => (sourceTab = 'atlas')}>Atlas</button
				>
				<button
					class="tb-tab"
					class:active={sourceTab === 'roster'}
					role="tab"
					aria-selected={sourceTab === 'roster'}
					onclick={() => (sourceTab = 'roster')}>Roster</button
				>
			</div>
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

		{#if sourceTab === 'atlas'}
			<div class="tb-atlas">
				<p class="tb-atlas-lead">
					Browse by what a character can do — counts are curated providers at
					{#if conMode === 'c0'}C0{:else if conMode === 'max'}C6{:else}your constellations{/if}.
				</p>
				<AtlasView cards={atlasCards} onSelect={selectCapability} />
			</div>
		{:else}
			<div class="tb-roster">
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
						<p class="vz-kicker">Roster</p>
						<div class="tb-seg" role="radiogroup" aria-label="Roster view">
							{#each OWNERSHIP_VIEWS as v (v.key)}
								<button
									class="tb-conmode-btn"
									class:active={ownershipView === v.key}
									role="radio"
									aria-checked={ownershipView === v.key}
									title={v.hint}
									onclick={() => (ownershipView = v.key)}>{v.label}</button
								>
							{/each}
						</div>
						<button
							class="tb-edit-toggle"
							class:active={editRoster}
							aria-pressed={editRoster}
							onclick={() => (editRoster = !editRoster)}
							title="Click tiles to mark which characters you own"
							>{editRoster ? 'Done editing' : 'Edit roster…'}</button
						>
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
									onclick={() => toggleFacet(facet.key)}>{facet.label}</button
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
									onclick={() => toggleFilter(filterElements, el)}>{el}</button
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
									onclick={() => toggleFilter(filterWeapons, w)}>{w}</button
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
									onclick={() => toggleFilter(filterRarities, r)}>{r}★</button
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
									onclick={() => pickRegion(region)}>{region}</button
								>
							{/each}
						</div>
					</div>

					{#if anyFilterActive}
						<button class="tb-clear" onclick={clearAll}>Clear filters</button>
					{/if}
				</aside>

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
								onOpen={openDetail}
								compared={compareIds.has(entry.id)}
								compareFull={compareIds.size >= MAX_COMPARE}
								onToggleCompare={toggleCompare}
								faded={tileFaded(entry.id)}
								teamState={teamStateOf(entry.id)}
								onAddToTeam={toggleTeam}
								ownership={mounted ? $ownership[entry.id] : undefined}
								editMode={editRoster}
								onSetOwnership={(id, mark) => ownership.setMark(id, mark)}
							/>
						{/each}
					</div>

					{#if split.matches.length === 0}
						<p class="tb-empty">
							No curated character matches.
							{#if conMode === 'c0' && activeFacets.size > 0}
								Some kits unlock these capabilities at higher constellations — try “My roster” or
								“C6”.
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
										onOpen={openDetail}
										compared={compareIds.has(entry.id)}
										compareFull={compareIds.size >= MAX_COMPARE}
										onToggleCompare={toggleCompare}
										faded={tileFaded(entry.id)}
										teamState={teamStateOf(entry.id)}
										onAddToTeam={toggleTeam}
										ownership={mounted ? $ownership[entry.id] : undefined}
										editMode={editRoster}
										onSetOwnership={(id, mark) => ownership.setMark(id, mark)}
									/>
								{/each}
							</div>
						</section>
					{/if}
				</div>
			</div>
		{/if}
	</section>

	<!-- ── Stage (docked inspector — Detail or Compare) ───────── -->
	{#if stageMode === 'compare'}
		<aside class="tb-stage">
			<CompareView
				ids={[...compareIds]}
				{conMode}
				docked
				anchorId={anchorId ?? undefined}
				onClose={closeCompare}
				onRemove={toggleCompare}
				onCommit={anchorId ? commitAudition : undefined}
			/>
		</aside>
	{:else if stageMode === 'detail' && selectedId}
		<aside class="tb-stage">
			<DetailCard
				id={selectedId}
				docked
				{conMode}
				onClose={() => (selectedId = null)}
				teamState={teamStateOf(selectedId)}
				onToggleTeam={toggleTeam}
			/>
		</aside>
	{/if}
</div>

{#if compareIds.size > 0 && !compareOpen}
	<CompareTray
		ids={[...compareIds]}
		onRemove={toggleCompare}
		onClear={() => compareIds.clear()}
		onCompare={openCompareView}
	/>
{/if}

<style>
	.tb {
		display: grid;
		grid-template-columns: 210px minmax(0, 1fr);
		gap: 1.1rem;
		align-items: start;
	}

	/* Inspecting a character slides a Stage column in on wide screens (the Source
	   reflows to make room); below the breakpoint the Detail/Compare overlays. */
	@media (min-width: 1200px) {
		.tb--inspect {
			grid-template-columns: 210px minmax(0, 1fr) minmax(360px, 400px);
		}
		/* Compare's stacked bars need more room than the Detail card: the Stage
		   widens and the Source narrows while comparing (bars keep their full
		   track; a 4-way comparison grows downward, not sideways). */
		.tb--compare {
			grid-template-columns: 210px minmax(0, 1fr) minmax(520px, 600px);
		}
	}

	@media (max-width: 900px) {
		.tb {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	/* Below 1200px the Stage box dissolves (its docked child overlays via its own
	   fixed positioning); at/above it, it's a sticky inspector column. */
	.tb-stage {
		display: contents;
	}
	@media (min-width: 1200px) {
		.tb-stage {
			display: block;
			position: sticky;
			top: 0;
			max-height: calc(100svh - var(--tool-pad-top, 2rem) - var(--tool-pad-bottom, 2rem));
			overflow-y: auto;
		}
	}

	/* Bench sticks; on narrow it flows back into the column. */
	.tb :global(.bn) {
		position: sticky;
		top: 0;
		max-height: calc(100svh - var(--tool-pad-top, 2rem) - var(--tool-pad-bottom, 2rem));
		overflow-y: auto;
	}
	@media (max-width: 900px) {
		.tb :global(.bn) {
			position: static;
			max-height: none;
		}
	}

	/* ── Source ───────────────────────────────────────────────── */
	.tb-source {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		min-width: 0;
	}

	.tb-tabs {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.tb-tabgroup {
		display: flex;
		gap: 0.3rem;
	}
	.tb-tab {
		padding: 0.4rem 1rem;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: none;
		color: var(--muted);
		font-family: var(--font-display);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		cursor: pointer;
		transition:
			border-color 150ms ease,
			background 150ms ease,
			color 150ms ease;
	}
	.tb-tab:hover {
		color: var(--text);
	}
	.tb-tab.active {
		color: var(--text);
		border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
		background: color-mix(in srgb, var(--accent) 16%, transparent);
	}

	/* ── Atlas ────────────────────────────────────────────────── */
	.tb-atlas {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}
	.tb-atlas-lead {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--muted);
	}

	/* ── Roster (rail + grid) ─────────────────────────────────── */
	/* Grid left, filter rail on the RIGHT (matches the planner picker's Source).
	   DOM order stays rail-first so the narrow single-column stack puts filters
	   above the grid; grid-column placement flips them on wide screens. */
	.tb-roster {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 250px;
		gap: 1.1rem;
		align-items: start;
	}
	.tb-roster .tb-content {
		grid-column: 1;
		grid-row: 1;
	}
	.tb-roster .tb-rail {
		grid-column: 2;
		grid-row: 1;
	}
	@media (max-width: 720px) {
		.tb-roster {
			grid-template-columns: minmax(0, 1fr);
		}
		.tb-roster .tb-content,
		.tb-roster .tb-rail {
			grid-column: auto;
			grid-row: auto;
		}
	}

	.tb-rail {
		gap: 1rem;
		position: sticky;
		top: 0;
		max-height: calc(100svh - var(--tool-pad-top, 2rem) - var(--tool-pad-bottom, 2rem));
		overflow-y: auto;
	}
	@media (max-width: 720px) {
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
		font-family: var(--font-body);
		font-size: var(--fs-md);
		padding: 0.5rem 0.7rem;
		outline: none;
		transition: border-color 150ms ease;
	}
	.tb-search:focus {
		border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
	}

	.tb-conmode,
	.tb-seg {
		display: flex;
		border: 1px solid var(--border);
		border-radius: 3px;
		overflow: hidden;
	}
	.tb-seg {
		margin-top: 0.55rem;
	}

	.tb-edit-toggle {
		margin-top: 0.4rem;
		width: 100%;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: none;
		color: var(--muted);
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		cursor: pointer;
		transition:
			border-color 150ms ease,
			color 150ms ease,
			background 150ms ease;
	}
	.tb-edit-toggle:hover {
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
		color: var(--text);
	}
	.tb-edit-toggle.active {
		border-color: color-mix(in srgb, var(--accent) 65%, var(--border));
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		color: var(--text);
	}

	.tb-conmode-btn {
		flex: 1;
		padding: 0.4rem 0.2rem;
		border: none;
		background: none;
		color: var(--muted);
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
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
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
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
		font-size: var(--fs-sm);
		line-height: var(--lh-snug);
		color: var(--muted);
	}

	.tb-clear {
		padding: 0.45rem;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: none;
		color: var(--muted);
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
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
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		color: var(--muted);
	}
	.tb-count-mode {
		opacity: 0.7;
		text-transform: none;
		letter-spacing: var(--ls-tight);
	}

	.tb-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
		gap: 0.6rem;
	}

	.tb-empty {
		margin: 1.5rem 0;
		font-size: var(--fs-md);
		color: var(--muted);
	}

	.tb-stubs {
		margin-top: 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
</style>
