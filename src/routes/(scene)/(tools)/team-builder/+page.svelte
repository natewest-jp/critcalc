<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { claimVeilReady, afterPaint } from '$lib/landing/veilReady';
	import { getAllCharacterIndex, getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { constellations, siteSettings, ownership } from '$lib/stores';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { warmAvatars } from '$lib/utils/warmAvatars';
	import { createProgressiveReveal } from '$lib/utils/progressiveReveal.svelte';
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
	import CharacterCard, { type TagChip } from '$lib/components/CharacterCard.svelte';
	import DetailCard from './lib/DetailCard.svelte';
	import CompareTray from './lib/CompareTray.svelte';
	import CompareView from './lib/CompareView.svelte';
	import Bench from './lib/Bench.svelte';
	import AtlasView from './lib/AtlasView.svelte';
	import {
		buildRoleCards,
		buildDrillRows,
		buildSlotAlternativeRows,
		type DrillRow
	} from './lib/atlas';
	import type { RoleCategory, RoleFilter } from './lib/roles';
	import { characterRoles } from '$lib/data/characterRoles.generated';
	import type { RolePosition, RoleFunction, CharacterIndexEntry } from '$lib/types/character';
	import { getAvatarFallback, hasAvatar } from '$lib/utils/getAvatar';
	import { positionIcon, functionIcon, POSITION_LABEL, FUNCTION_LABEL } from '$lib/utils/roleIcons';
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

	// Hold the loading veil until the personalized view (roster constellations,
	// ownership, saved facets) has replaced the deterministic default paint.
	// Claimed at init (see veilReady.ts); no-op unless this load has a veil.
	const releaseVeil = claimVeilReady();

	let mounted = $state(false);
	onMount(() => {
		mounted = true;
		warmAvatars();
		afterPaint(releaseVeil);
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
		// Arriving from the planner with a team → open the Atlas on the per-slot
		// "alternatives" view (the reason the hand-off exists).
		if (teamSlots.some((s) => s !== null)) {
			atlasMode = 'slots';
			sourceTab = 'atlas';
		}
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
	// Sticky: flips true on first Roster visit and stays — the roster grid is
	// then kept mounted (CSS-hidden) across tab toggles. See the template note.
	let rosterEverShown = $state(false);
	$effect(() => {
		if (sourceTab === 'roster') rosterEverShown = true;
	});

	// The Atlas has three faces: the four role cards, one card's drill-down, and
	// (on Rotation-Planner arrival) per-slot alternatives.
	let atlasMode = $state<'cards' | 'drill' | 'slots'>('cards');
	let drilledCategory = $state<RoleCategory | null>(null);

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

	// Editorial role filters (Position / Function) for the Roster tab, set by the
	// roster-rail role chips. The Atlas is self-contained (drills show tiles
	// inline), so it no longer pivots here. Roles join the roster by id.
	const rolePosition = new SvelteSet<RolePosition>();
	const roleFunction = new SvelteSet<RoleFunction>();
	const rolesOf = (id: string) => characterRoles[id];

	const POSITIONS: RolePosition[] = ['onField', 'offField'];
	const FUNCTIONS: RoleFunction[] = ['dps', 'support', 'survivability'];

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

	/** Bench coverage gap → focus that capability and drop onto the filtered
	 *  Roster (clears any role scope so the capability isn't hidden by it). */
	function selectCapability(facet: FacetKey, element?: string): void {
		activeFacets.clear();
		activeFacets.add(facet);
		filterElements.clear();
		if (element) filterElements.add(element);
		rolePosition.clear();
		roleFunction.clear();
		sourceTab = 'roster';
	}

	// ── Role Atlas navigation (self-contained: drill shows tiles inline) ──────
	function openCategory(cat: RoleCategory): void {
		drilledCategory = cat;
		atlasMode = 'drill';
	}
	function backToCards(): void {
		atlasMode = 'cards';
		drilledCategory = null;
	}
	function toggleRolePosition(p: RolePosition): void {
		toggleSet(rolePosition, p);
		sourceTab = 'roster';
	}
	function toggleRoleFunction(f: RoleFunction): void {
		toggleSet(roleFunction, f);
		sourceTab = 'roster';
	}

	function clearAll(): void {
		activeFacets.clear();
		filterElements.clear();
		filterWeapons.clear();
		filterRarities.clear();
		filterRegion = '';
		search = '';
		rolePosition.clear();
		roleFunction.clear();
	}

	const anyFilterActive = $derived(
		activeFacets.size > 0 ||
			filterElements.size > 0 ||
			filterWeapons.size > 0 ||
			filterRarities.size > 0 ||
			filterRegion !== '' ||
			search.trim() !== '' ||
			rolePosition.size > 0 ||
			roleFunction.size > 0
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
			(id) => own[id],
			{
				position: rolePosition,
				function: roleFunction,
				rolesOf
			} satisfies RoleFilter
		);
	});

	// Time-sliced mount for the roster grid: first batch covers the viewport,
	// the below-fold rest streams in rAF batches (see progressiveReveal.svelte.ts).
	const reveal = createProgressiveReveal();
	$effect(() => {
		reveal.target = split.matches.length;
	});
	const shownMatches = $derived(split.matches.slice(0, reveal.limit));

	// Role Atlas — the four headline cards + the active card's drill rows, over
	// the eager index. Roles come from the joined sidecar (rolesOf); capability
	// drill rows still honor curation + the con cap.
	const roleCards = $derived.by(() => {
		const own = mounted ? $ownership : {};
		return buildRoleCards(roster, rolesOf, (id) => own[id] === 'owned');
	});
	const drillRows = $derived.by(() => {
		if (!drilledCategory) return [] as DrillRow[];
		const cons = mounted ? $constellations : {};
		return buildDrillRows(drilledCategory, roster, rolesOf, (id) => conCapFor(conMode, cons[id]));
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

	// Rotation-Planner arrival: one alternatives row per filled slot.
	const slotRows = $derived.by(() => buildSlotAlternativeRows(teamSlots, roster, rolesOf));

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

	// Capability badges → the card's ordered tag chips: active facets first, then
	// FACETS order; the card slices to its cap + renders the +overflow count.
	function tagsFor(entry: CharacterIndexEntry): TagChip[] {
		const badges = facetBadges(entry.caps);
		const rank = (b: (typeof badges)[number]) =>
			(activeFacets.has(b.facet) ? 0 : 100) + FACETS.findIndex((f) => f.key === b.facet);
		return [...badges]
			.sort((a, b) => rank(a) - rank(b))
			.map((b) => ({
				label: `${b.label}${b.minCon > 0 ? ` C${b.minCon}` : ''}`,
				active: activeFacets.has(b.facet),
				conditional: b.conditional,
				title: b.conditional ? 'Conditional — depends on runtime state (see details)' : undefined
			}));
	}

	// Primary tile click: edit mode toggles owned (Genshin collection style);
	// otherwise open the detail card.
	function activate(id: string): void {
		if (editRoster) {
			ownership.setMark(id, $ownership[id] === 'owned' ? null : 'owned');
		} else {
			openDetail(id);
		}
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

<!-- One roster tile, shared by the roster grid, the "not yet curated" bucket,
     and the Rotation-Planner per-slot alternative rows. -->
{#snippet charTile(entry: CharacterIndexEntry, dimmed: boolean)}
	<CharacterCard
		{entry}
		{preferNewfit}
		{traveler}
		onActivate={activate}
		intent={editRoster ? 'edit' : 'open'}
		con={conMode === 'mine' && mounted ? ($constellations[entry.id] ?? 0) : undefined}
		wishlist={mounted && $ownership[entry.id] === 'wishlist'}
		showUncuratedMark
		tags={tagsFor(entry)}
		accent={compareIds.has(entry.id)}
		faded={tileFaded(entry.id)}
		{dimmed}
		actions={editRoster ? undefined : teamActions}
	/>
{/snippet}

<!-- TB-only hover action bar (rendered into the card's overlay shell). -->
{#snippet teamActions(entry: CharacterIndexEntry)}
	{@const teamState = teamStateOf(entry.id)}
	{@const compared = compareIds.has(entry.id)}
	<button
		class="tb-act"
		class:tb-act--on={teamState === 'in'}
		disabled={teamState === 'full'}
		onclick={() => toggleTeam(entry.id)}
		title={teamState === 'in'
			? 'In your team'
			: teamState === 'full'
				? 'Team is full (4)'
				: 'Add to team'}
	>
		<span class="tb-act-glyph">{teamState === 'in' ? '✓' : '+'}</span>
		<span class="tb-act-label">{teamState === 'full' ? 'Full' : 'Team'}</span>
	</button>
	<button
		class="tb-act tb-act--compare"
		class:tb-act--on={compared}
		disabled={!compared && compareIds.size >= MAX_COMPARE}
		onclick={() => toggleCompare(entry.id)}
		aria-pressed={compared}
		title={compared
			? 'Remove from comparison'
			: compareIds.size >= MAX_COMPARE
				? 'Comparison is full (4)'
				: 'Add to comparison'}
	>
		<span class="tb-act-glyph">{compared ? '✓' : '→'}</span>
		<span class="tb-act-label">Compare</span>
	</button>
{/snippet}

<div
	class="tb"
	class:tb--inspect={stageMode === 'detail'}
	class:tb--compare={stageMode === 'compare'}
>
	<!-- ── Source (Atlas ⇄ Roster) ────────────────────────────── -->
	<section class="tb-source">
		<div class="tb-tabs">
			<div class="tb-tabgroup" role="tablist" aria-label="Source view">
				<button
					class="tab"
					class:active={sourceTab === 'atlas'}
					role="tab"
					aria-selected={sourceTab === 'atlas'}
					onclick={() => (sourceTab = 'atlas')}>Atlas</button
				>
				<button
					class="tab"
					class:active={sourceTab === 'roster'}
					role="tab"
					aria-selected={sourceTab === 'roster'}
					onclick={() => (sourceTab = 'roster')}>Roster</button
				>
			</div>
			<div class="segment tb-conmode" role="radiogroup" aria-label="Constellation mode">
				{#each CON_MODES as m (m.key)}
					<button
						class="btn"
						class:is-active={conMode === m.key}
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
				{#if atlasMode === 'slots' && slotRows.length > 0}
					<div class="tb-atlas-head">
						<p class="tb-atlas-lead">
							Alternatives for each character on your team — same element and role.
						</p>
						<button class="btn" onclick={backToCards}>Browse all roles →</button>
					</div>
					{#each slotRows as row (row.slotEntry.id)}
						<section class="tb-slotrow">
							<header class="tb-slotrow-head">
								{#if hasAvatar(row.slotEntry.id)}
									<img
										class="tb-slotrow-avatar"
										src={getAvatarFallback(row.slotEntry.id, 'circle', traveler)}
										alt=""
										loading="lazy"
									/>
								{:else}
									<span class="tb-slotrow-initials"
										>{row.slotEntry.displayName.slice(0, 2).toUpperCase()}</span
									>
								{/if}
								<span class="tb-slotrow-name">{row.slotEntry.displayName}</span>
								{#if row.slotRoles}
									<span class="tb-slotrow-roles">
										{#each row.slotRoles.position as p (p)}
											<img
												src={positionIcon(p, 'color')}
												alt={POSITION_LABEL[p]}
												title={POSITION_LABEL[p]}
											/>
										{/each}
										{#each row.slotRoles.function as f (f)}
											<img
												src={functionIcon(f, 'color')}
												alt={FUNCTION_LABEL[f]}
												title={FUNCTION_LABEL[f]}
											/>
										{/each}
									</span>
								{/if}
								<span class="tb-slotrow-count"
									>{row.alternatives.length} alt{row.alternatives.length === 1 ? '' : 's'}</span
								>
							</header>
							{#if row.alternatives.length > 0}
								<div class="tb-grid">
									{#each row.alternatives as entry (entry.id)}
										{@render charTile(entry, false)}
									{/each}
								</div>
							{:else}
								<p class="note tb-note">No same-element alternative in this role yet.</p>
							{/if}
						</section>
					{/each}
				{:else if atlasMode === 'drill' && drilledCategory}
					<div class="tb-atlas-head">
						<button class="btn" onclick={backToCards}>← All roles</button>
						<div class="tb-drill-title">
							{#if drilledCategory.position}
								<img src={positionIcon(drilledCategory.position, 'color')} alt="" />
							{/if}
							<img src={functionIcon(drilledCategory.function, 'color')} alt="" />
							<span>{drilledCategory.label}</span>
						</div>
					</div>
					{#each drillRows as row (row.key)}
						<section class="tb-slotrow">
							<header class="tb-slotrow-head">
								{#if row.kind === 'element'}
									<img class="tb-drill-elicon" src={elementIcon(row.element)} alt="" />
									<span class="tb-slotrow-name tb-slotrow-name--el">{row.element}</span>
								{:else}
									<span class="tb-slotrow-name">{row.label}</span>
								{/if}
								<span class="tb-slotrow-count"
									>{row.entries.length} character{row.entries.length === 1 ? '' : 's'}</span
								>
							</header>
							<div class="tb-grid">
								{#each row.entries as entry (entry.id)}
									{@render charTile(entry, false)}
								{/each}
							</div>
						</section>
					{/each}
					{#if drillRows.length === 0}
						<p class="note tb-note">No curated providers in this role yet.</p>
					{/if}
				{:else}
					<p class="tb-atlas-lead">
						Browse by role — from Genshin's Imaginarium Theater classification.
					</p>
					<AtlasView {roleCards} onSelectCategory={openCategory} />
					<p class="tb-atlas-cite">
						Roles: Genshin Impact — Imaginarium Theater. A presence classification, not a ranking.
					</p>
				{/if}
			</div>
		{/if}

		<!-- Roster stays MOUNTED once first shown (hidden, not {#if}-destroyed):
		     remounting ~122 cards on every Atlas⇄Roster toggle was a visible
		     stall in Safari 26.x, and keeping it warm makes the toggle instant
		     in every browser. -->
		{#if rosterEverShown}
			<div class="tb-roster" hidden={sourceTab !== 'roster'}>
				<aside class="tb-rail panel">
					<input
						class="field"
						type="text"
						placeholder="Search characters…"
						bind:value={search}
						autocomplete="off"
						autocorrect="off"
						spellcheck={false}
					/>

					<div>
						<p class="kicker">Roster</p>
						<div class="segment tb-seg" role="radiogroup" aria-label="Roster view">
							{#each OWNERSHIP_VIEWS as v (v.key)}
								<button
									class="btn"
									class:is-active={ownershipView === v.key}
									role="radio"
									aria-checked={ownershipView === v.key}
									title={v.hint}
									onclick={() => (ownershipView = v.key)}>{v.label}</button
								>
							{/each}
						</div>
						<button
							class="btn tb-edit-toggle"
							class:active={editRoster}
							aria-pressed={editRoster}
							onclick={() => (editRoster = !editRoster)}
							title="Click tiles to mark which characters you own"
							>{editRoster ? 'Done editing' : 'Edit roster…'}</button
						>
					</div>

					<div>
						<p class="kicker">Role</p>
						<div class="chips tb-chips">
							{#each POSITIONS as p (p)}
								<button
									class="chip tb-chip--role"
									class:active={rolePosition.has(p)}
									aria-pressed={rolePosition.has(p)}
									onclick={() => toggleRolePosition(p)}
								>
									<img class="tb-chip-icon" src={positionIcon(p, 'color')} alt="" />{POSITION_LABEL[
										p
									]}
								</button>
							{/each}
							{#each FUNCTIONS as f (f)}
								<button
									class="chip tb-chip--role"
									class:active={roleFunction.has(f)}
									aria-pressed={roleFunction.has(f)}
									onclick={() => toggleRoleFunction(f)}
								>
									<img class="tb-chip-icon" src={functionIcon(f, 'color')} alt="" />{FUNCTION_LABEL[
										f
									]}
								</button>
							{/each}
						</div>
					</div>

					<div>
						<p class="kicker">Can provide</p>
						<div class="chips tb-chips">
							{#each FACETS as facet (facet.key)}
								<button
									class="chip"
									class:active={activeFacets.has(facet.key)}
									title={facet.hint}
									aria-pressed={activeFacets.has(facet.key)}
									onclick={() => toggleFacet(facet.key)}>{facet.label}</button
								>
							{/each}
						</div>
						{#if activeFacets.size > 1}
							<p class="note tb-note">Matching characters provide all of these.</p>
						{/if}
					</div>

					<div>
						<p class="kicker">Element</p>
						<div class="chips tb-chips">
							{#each ELEMENTS as el (el)}
								<button
									class="chip chip--element"
									class:active={filterElements.has(el)}
									style:--chip-color={elColor(el)}
									aria-pressed={filterElements.has(el)}
									onclick={() => toggleFilter(filterElements, el)}>{el}</button
								>
							{/each}
						</div>
					</div>

					<div>
						<p class="kicker">Weapon</p>
						<div class="chips tb-chips">
							{#each WEAPONS as w (w)}
								<button
									class="chip"
									class:active={filterWeapons.has(w)}
									aria-pressed={filterWeapons.has(w)}
									onclick={() => toggleFilter(filterWeapons, w)}>{w}</button
								>
							{/each}
						</div>
					</div>

					<div>
						<p class="kicker">Rarity</p>
						<div class="chips tb-chips">
							{#each RARITIES as r (r)}
								<button
									class="chip"
									class:active={filterRarities.has(r)}
									aria-pressed={filterRarities.has(r)}
									onclick={() => toggleFilter(filterRarities, r)}>{r}★</button
								>
							{/each}
						</div>
					</div>

					<div>
						<p class="kicker">Region</p>
						<div class="chips tb-chips">
							{#each allRegions as region (region)}
								<button
									class="chip"
									class:active={filterRegion === region}
									aria-pressed={filterRegion === region}
									onclick={() => pickRegion(region)}>{region}</button
								>
							{/each}
						</div>
					</div>

					{#if anyFilterActive}
						<button class="btn" onclick={clearAll}>Clear filters</button>
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
						{#each shownMatches as entry (entry.id)}
							{@render charTile(entry, false)}
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
							<p class="kicker">Not yet curated</p>
							<p class="note tb-note">
								These kits have no capability data yet — they may well do what you’re filtering for.
								Absence of a badge here means “unknown”, not “no”.
							</p>
							<div class="tb-grid">
								{#each split.uncurated as entry (entry.id)}
									{@render charTile(entry, true)}
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

	<!-- ── Bench (the team) — the right edge, facing the Rotation
	     Planner it sends to; on narrow screens it reorders to the top. -->
	<Bench
		slots={teamSlots}
		conCapOf={(id) => conCapFor(conMode, mounted ? ($constellations[id] ?? 0) : 0)}
		onRemove={(i) => (teamSlots[i] = null)}
		onClear={() => (teamSlots = [null, null, null, null])}
		onOpen={openDetail}
		onFilterFacet={(f) => selectCapability(f)}
		onAudition={openAudition}
	/>
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
	/* Source | (Stage) | Bench — the Bench holds the RIGHT edge, facing the
	   Rotation Planner it sends to (the planner's "Explore alternatives" mirror
	   sits on ITS left edge, facing back). */
	.tb {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 210px;
		gap: 1.1rem;
		align-items: start;
	}

	/* Inspecting a character slides a Stage column in BETWEEN Source and Bench
	   on wide screens (the Source reflows to make room; the Bench keeps the true
	   edge); below the breakpoint the Detail/Compare overlays. */
	@media (min-width: 1200px) {
		.tb--inspect {
			grid-template-columns: minmax(0, 1fr) minmax(360px, 400px) 210px;
		}
	}
	/* Compare's stacked bars need more room than the Detail card (520–600px vs
	   360–400px), which at 1200px would squeeze the Source to ~3 tiles — so
	   Compare docks only from 1400px (the Source keeps ~600px) and stays a
	   centered overlay below that. CompareView's docked media query matches. */
	@media (min-width: 1400px) {
		.tb--compare {
			grid-template-columns: minmax(0, 1fr) minmax(520px, 600px) 210px;
		}
	}

	@media (max-width: 900px) {
		.tb {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	/* Below its docking breakpoint the Stage box dissolves (its docked child
	   overlays via its own fixed positioning); at/above it, it's a sticky
	   inspector column. Detail docks from 1200px, Compare from 1400px — each
	   child's own docked media query agrees. */
	.tb-stage {
		display: contents;
	}
	@media (min-width: 1200px) {
		.tb--inspect .tb-stage {
			display: block;
			position: sticky;
			/* Sticky pins to the scrollport edge — the fixed chrome sits over the
			   top of it, so the pin point clears the strip. */
			top: calc(var(--chrome-h, 64px) + var(--tool-pad-top, 0.5rem));
			max-height: calc(
				100svh - var(--chrome-h, 64px) - var(--tool-pad-top, 2rem) - var(--tool-pad-bottom, 2rem)
			);
			overflow-y: auto;
		}
	}
	@media (min-width: 1400px) {
		.tb--compare .tb-stage {
			display: block;
			position: sticky;
			top: calc(var(--chrome-h, 64px) + var(--tool-pad-top, 0.5rem));
			max-height: calc(
				100svh - var(--chrome-h, 64px) - var(--tool-pad-top, 2rem) - var(--tool-pad-bottom, 2rem)
			);
			overflow-y: auto;
		}
	}

	/* Bench sticks; on narrow it flows back into the column — reordered to the
	   TOP (order: -1), where its compact horizontal strip belongs.
	   --bn-drop: the planner's frame starts below its tab bar (27px + 0.6rem
	   gap ≈ 37px); the bench takes the same head start so the two frames' top
	   edges align across the RP↔TB shared edge (probe-bench-align.mjs measures
	   this). The sticky pin includes it so the bench never shifts on scroll. */
	.tb :global(.bn) {
		--bn-drop: 37px;
		margin-top: var(--bn-drop);
		position: sticky;
		top: calc(var(--chrome-h, 64px) + var(--tool-pad-top, 0.5rem) + var(--bn-drop));
		max-height: calc(
			100svh - var(--chrome-h, 64px) - var(--tool-pad-top, 2rem) - var(--tool-pad-bottom, 2rem) -
				var(--bn-drop)
		);
		overflow-y: auto;
	}
	@media (max-width: 900px) {
		.tb :global(.bn) {
			order: -1;
			margin-top: 0;
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
	.tb-atlas-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.tb-atlas-cite {
		margin: 0.2rem 0 0;
		font-size: var(--fs-2xs);
		color: var(--muted);
		opacity: 0.8;
	}

	/* ── RP-arrival slot rows ─────────────────────────────────── */
	.tb-slotrow {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 0.6rem;
		border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}
	.tb-slotrow-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.tb-slotrow-avatar,
	.tb-slotrow-initials {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		flex: none;
	}
	.tb-slotrow-avatar {
		object-fit: cover;
		background: var(--bg);
	}
	.tb-slotrow-initials {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
		color: var(--muted);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
	}
	.tb-slotrow-name {
		font-family: var(--font-display);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		color: var(--text);
	}
	.tb-slotrow-roles {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
	.tb-slotrow-roles img {
		width: 18px;
		height: 18px;
		object-fit: contain;
	}
	.tb-slotrow-count {
		margin-left: auto;
		font-size: var(--fs-2xs);
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
	}
	.tb-slotrow-name--el {
		text-transform: capitalize;
	}
	.tb-drill-elicon {
		width: 18px;
		height: 18px;
		object-fit: contain;
		flex: none;
	}

	/* Drill header (← All roles + the drilled card's glyphs/label) */
	.tb-drill-title {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--font-display);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--text);
	}
	.tb-drill-title img {
		width: 26px;
		height: 26px;
		object-fit: contain;
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
	/* The explicit display:grid above would beat the UA's [hidden] rule. */
	.tb-roster[hidden] {
		display: none;
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

	.tb-seg {
		margin-top: 0.55rem;
	}

	/* Both segmented groups are the global .segment track now; the only local
	   part is that these two stretch their buttons to equal widths, which a
	   free-standing segment shouldn't do. */
	.tb-conmode,
	.tb-seg {
		display: flex;
	}
	.tb-conmode > .btn,
	.tb-seg > .btn {
		flex: 1;
	}
	.tb-edit-toggle {
		margin-top: 0.4rem;
		width: 100%;
	}

	/* .chips, plus the facet rail's own top spacing. */
	/* .note, plus the offset its container doesn't provide. */
	.tb-note {
		margin-top: 0.5rem;
		font-size: var(--fs-sm);
	}

	.tb-chips {
		margin-top: 0.55rem;
	}

	.tb-chip--role {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		text-transform: none;
	}
	.tb-chip-icon {
		width: 14px;
		height: 14px;
		object-fit: contain;
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
	/* Reward wide screens with roomier cards (fewer-but-bigger), not more tiles at
	   once — the wider cells cross CharacterCard's `roomy` container-query band.
	   Thresholds tuned live; the card adapts to whatever width the grid hands it. */
	@media (min-width: 1500px) {
		.tb-grid {
			grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		}
	}
	@media (min-width: 1900px) {
		.tb-grid {
			grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
		}
	}

	/* Hover action buttons rendered into CharacterCard's overlay shell (Team /
	   Compare). The card owns the reveal + positioning; these are the contents. */
	.tb-act {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		padding: 0.2rem;
		border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
		border-radius: var(--r-sm);
		background: color-mix(in srgb, var(--bg) 55%, transparent);
		color: var(--text);
		font-family: var(--font-body);
		cursor: pointer;
		transition:
			border-color 150ms ease,
			background 150ms ease,
			color 150ms ease;
	}
	.tb-act-glyph {
		font-size: var(--fs-2xl);
		font-weight: var(--fw-bold);
		line-height: 1;
	}
	.tb-act-label {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}
	.tb-act:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
		background: color-mix(in srgb, var(--accent) 18%, var(--bg));
	}
	.tb-act--on {
		border-color: color-mix(in srgb, var(--accent) 65%, var(--border));
		background: color-mix(in srgb, var(--accent) 28%, var(--bg));
	}
	.tb-act:disabled {
		opacity: 0.4;
		cursor: default;
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
