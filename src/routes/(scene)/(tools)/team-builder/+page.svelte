<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { claimVeilReady, afterPaint } from '$lib/landing/veilReady';
	import { getAllCharacterIndex, getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { constellations, siteSettings, ownership } from '$lib/stores';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { warmAvatars } from '$lib/utils/warmAvatars';
	import {
		FACETS,
		conCapFor,
		facetBadges,
		splitRoster,
		type ConMode,
		type FacetKey,
		type OwnershipView
	} from './lib/facets';
	import { afterNavigate } from '$app/navigation';
	import { rotationTabs as rt } from '$lib/rotationTabs.svelte';
	import { benchBand } from '$lib/benchBand.svelte';
	import ToolStack from '$lib/components/ToolStack.svelte';
	import DocumentTabs from '$lib/components/DocumentTabs.svelte';
	import DocumentActions from '$lib/components/DocumentActions.svelte';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import CharacterCard, { type TagChip } from '$lib/components/CharacterCard.svelte';
	import CharacterGrid, { type GridFilters } from '$lib/components/CharacterGrid.svelte';
	import DetailCard from './lib/DetailCard.svelte';
	import CompareView from './lib/CompareView.svelte';
	import TeamStrip from './lib/TeamStrip.svelte';
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
	import { getAvatar, getAvatarFallback, hasAvatar } from '$lib/utils/getAvatar';
	import { positionIcon, functionIcon, POSITION_LABEL, FUNCTION_LABEL } from '$lib/utils/roleIcons';
	import { MAX_COMPARE } from './lib/compare';
	import { facetsProvidedBy, parseTeamParam, type TeamSlot } from './lib/team';

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
		// Bench-band affordances for this tool: a filled card's portrait opens
		// the Detail card; ⇄ auditions the slot. (Remove/edit writes go straight
		// to the shared tab state inside the band.)
		return benchBand.registerHost({
			tool: 'tb',
			onOpenDetail: openDetail,
			onAudition: openAudition
		});
	});

	// URL param consumption lives in afterNavigate, NOT onMount: on chained SPA
	// navigation the component mounts before the router updates location, so
	// onMount reads the PREVIOUS page's URL and silently drops the params.
	// Two hard-won rules (post-merge probe forensics, 2026-07-13):
	// - afterNavigate ALSO fires on the navigation that REMOVES this component,
	//   with nav.to pointing at the OTHER page — consuming its params here
	//   strips them before the destination can read them. Guard on nav.to.
	// - read nav.to.url, never window.location — location can lag the router.
	//
	// The team itself is the shared WORKING TEAM now (the planner's active
	// tab) — no URL mirroring, no cross-tool injection. Two inbound params
	// remain, both stripped after reading:
	// - ?team=a,b,c,d — an external deep link: imports the team into a tab
	//   (pristine-tab reuse rules), same as the planner's own ?team=.
	// - ?alts=1 — the planner's "← Explore alternatives" hand-off: the team is
	//   already here, so the link only asks for the per-slot alternatives view.
	afterNavigate((nav) => {
		const url = nav.to?.url;
		if (!url || !url.pathname.endsWith('/team-builder')) return;
		const teamParam = url.searchParams.get('team');
		const altsParam = url.searchParams.get('alts');
		if (!teamParam && !altsParam) return;
		history.replaceState(history.state, '', url.pathname + url.hash);
		if (teamParam) {
			const imported = parseTeamParam(teamParam, (id) => rosterIds.has(id));
			const ids = imported.filter((s): s is string => s !== null);
			if (ids.length > 0) rt.importTeam(ids, 'Imported team');
		}
		// A team arrival (either param) opens the Atlas on the per-slot
		// "alternatives" view — the reason both hand-offs exist.
		if (teamSlots.some((s) => s !== null)) {
			atlasMode = 'slots';
			sourceTab = 'atlas';
		}
	});

	const preferNewfit = $derived(mounted && $siteSettings.useNewOutfits);
	const traveler = $derived(mounted ? $siteSettings.travelerVariant : 'aether');

	// ---------------------------------------------------------------------------
	// Source panel: Atlas (question-indexed cards) ⇄ Roster (grid) ⇄ Compare
	// ---------------------------------------------------------------------------

	let sourceTab = $state<'atlas' | 'roster' | 'compare'>('atlas');
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

	// Identity filters live in the shared CharacterGrid's shape now — it renders
	// the search field and the element/weapon/rarity/region groups, binding to
	// these very sets. Factions/Buffs rides along in the same object (the TB
	// renders those chips itself, via the rail's railStart slot) so
	// matchesIdentity sees one filter state, not two.
	const filters = $state<GridFilters>({
		elements: new SvelteSet<string>(),
		weapons: new SvelteSet<string>(),
		rarities: new SvelteSet<number>(),
		region: '',
		search: '',
		// Factions/Buffs group (Nate 2026-07-29): moonsign/hexerei by faction
		// membership, stellar by enabler-or-gated-buffs (see isStellarLinked).
		factionBuffs: new SvelteSet<string>()
	});

	const activeFacets = new SvelteSet<FacetKey>();
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

	// Factions/Buffs chips — faction membership for Moonsign/Hexerei;
	// "Stellar" is enabler-or-gated-buffs (no faction exists for Stellar).
	const FACTION_BUFFS = [
		{
			key: 'moonsign',
			label: 'Moonsign',
			hint: 'Moonsign characters — 2 or more enable Ascendant Gleam and the Lunar reactions'
		},
		{
			key: 'hexerei',
			label: 'Hexerei',
			hint: 'Hexerei characters — 2 or more enable Hexerei: Secret Rite'
		},
		{
			key: 'stellar',
			label: 'Stellar',
			hint: 'Stellar-linked — enables a Stellar reaction, or has buffs that need one enabled'
		}
	] as const;

	function toggleSet<T>(set: SvelteSet<T>, val: T): void {
		if (set.has(val)) set.delete(val);
		else set.add(val);
	}

	const facetMeta = (key: FacetKey) => FACETS.find((f) => f.key === key);

	// Filtering is a Roster-tab activity — and the filter rail only EXISTS on
	// the Roster tab, so only the off-rail entry points (bench coverage gaps,
	// Atlas role chips) still need to steer there.
	function toggleFacet(f: FacetKey): void {
		toggleSet(activeFacets, f);
	}

	/** Bench coverage gap → focus that capability and drop onto the filtered
	 *  Roster (clears any role scope so the capability isn't hidden by it). */
	function selectCapability(facet: FacetKey, element?: string): void {
		activeFacets.clear();
		activeFacets.add(facet);
		filters.elements.clear();
		if (element) filters.elements.add(element);
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

	/** The TB's own filters — everything the shared rail doesn't own. Wired to
	 *  CharacterGrid's Clear button so one press clears the whole column. */
	function clearExtraFilters(): void {
		activeFacets.clear();
		rolePosition.clear();
		roleFunction.clear();
	}

	const extraFiltersActive = $derived(
		activeFacets.size > 0 || rolePosition.size > 0 || roleFunction.size > 0
	);

	// Reference $constellations so the split re-derives when roster levels change.
	const split = $derived.by(() => {
		const cons = mounted ? $constellations : {};
		const own = mounted ? $ownership : {};
		return splitRoster(
			roster,
			filters,
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

	// The roster grid's time-sliced mount is CharacterGrid's now (it runs the
	// same createProgressiveReveal over whatever roster it's handed).

	/** CharacterGrid takes a plain string; the constellation hint is the only
	 *  variable part, and it only helps while capability facets are on. */
	const rosterEmptyMessage = $derived(
		conMode === 'c0' && activeFacets.size > 0
			? 'No curated character matches. Some kits unlock these capabilities at higher constellations — try “My roster” or “C6”.'
			: 'No curated character matches.'
	);

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

	// The full stepper (Nate 2026-07-30): every fixed step so "who can do this
	// at exactly C2" is answerable, with the roster mode alongside.
	const CON_MODES: { key: ConMode; label: string; hint: string }[] = [
		{ key: 'c0', label: 'C0', hint: 'Base kits only — what every copy of the character can do' },
		...([1, 2, 3, 4, 5] as const).map((n) => ({
			key: `c${n}` as ConMode,
			label: `C${n}`,
			hint: `Everything a kit unlocks through C${n}`
		})),
		{ key: 'c6', label: 'C6', hint: 'Everything the kit can ever do' },
		{
			key: 'mine',
			label: 'My roster',
			hint: 'Uses your saved constellations (set them in a character’s details)'
		}
	];

	/** The lens's current reading — band B's menu states it on the trigger, so
	 *  the setting stays visible now that its eight segments are gone. */
	const activeConMode = $derived(CON_MODES.find((m) => m.key === conMode) ?? CON_MODES[0]);

	const OWNERSHIP_VIEWS: { key: OwnershipView; label: string; hint: string }[] = [
		{ key: 'all', label: 'All', hint: 'Every character' },
		{ key: 'owned', label: 'Owned', hint: 'Only characters you’ve marked as owned' },
		{ key: 'wishlist', label: 'Wishlist', hint: 'Only characters you’ve wishlisted' }
	];

	// ---------------------------------------------------------------------------
	// Detail card — a focused single-character modal (the tool's one deliberate
	// modal: an isolated read where focus is a feature, unlike the in-frame
	// Compare workspace that reasons against the roster/team around it).
	// ---------------------------------------------------------------------------

	let selectedId = $state<string | null>(null);

	function elColor(element: string | undefined): string {
		return (elementColors[(element ?? 'none') as ElementKey] ?? elementColors.none).main;
	}

	function openDetail(id: string): void {
		selectedId = id;
	}

	// ---------------------------------------------------------------------------
	// Compare (Layer 2) — the Compare tab itself is the accumulator: a card's
	// "Compare" silently adds the character here (the tab's avatar stack is
	// the feedback), and clicking the tab lands on an already-loaded view.
	// Audition is Compare with a pinned anchor (the incumbent), an in-view
	// candidates strip, and a commit that swaps the slot.
	// ---------------------------------------------------------------------------

	const compareIds = new SvelteSet<string>();
	/** Audition: the pinned incumbent + the slot it holds (null = plain compare). */
	let anchorId = $state<string | null>(null);
	let auditionSlot = $state<number | null>(null);
	/** The facets the incumbent provides — the candidate strip's chip row. */
	let auditionSeedFacets = $state<FacetKey[]>([]);
	/** The currently-active subset (toggleable, so an over-narrow AND of every
	 *  seed facet can be relaxed chip by chip). */
	const auditionFacets = new SvelteSet<FacetKey>();
	/** Where commit/cancel returns to — the tab active when the audition began. */
	let auditionReturnTab = $state<'atlas' | 'roster'>('atlas');

	function toggleCompare(id: string): void {
		if (id === anchorId) return; // the audition anchor stays pinned
		if (compareIds.has(id)) {
			compareIds.delete(id);
		} else if (compareIds.size < MAX_COMPARE) {
			compareIds.add(id);
		}
	}

	const compareStateOf = (id: string): 'in' | 'out' | 'full' =>
		compareIds.has(id) ? 'in' : compareIds.size >= MAX_COMPARE ? 'full' : 'out';

	function endAudition(): void {
		compareIds.clear(); // the audition selection is scoped
		anchorId = null;
		auditionSlot = null;
		auditionSeedFacets = [];
		auditionFacets.clear();
	}

	/** Audition replacements for a filled slot: pin the incumbent as the anchor
	 *  and open the Compare tab, whose in-view candidates strip suggests
	 *  characters covering the facets the incumbent provides. */
	function openAudition(index: number, incumbentId: string): void {
		compareIds.clear();
		compareIds.add(incumbentId);
		anchorId = incumbentId;
		auditionSlot = index;
		const cap = conCapFor(conMode, mounted ? ($constellations[incumbentId] ?? 0) : 0);
		const entry = getCharacterIndexEntry(incumbentId);
		auditionSeedFacets = entry ? [...facetsProvidedBy(entry, cap)] : [];
		auditionFacets.clear();
		for (const f of auditionSeedFacets) auditionFacets.add(f);
		auditionReturnTab = sourceTab === 'compare' ? 'atlas' : sourceTab;
		selectedId = null;
		sourceTab = 'compare';
	}

	/** Commit an audition candidate into its slot, then return whence you came. */
	function commitAudition(candidateId: string): void {
		if (auditionSlot !== null) rt.setSlot(auditionSlot, candidateId);
		endAudition();
		sourceTab = auditionReturnTab;
	}

	function cancelAudition(): void {
		endAudition();
		sourceTab = auditionReturnTab;
	}

	/** Candidates for the audition strip: everyone (outside the team) who covers
	 *  ALL currently-active seed facets at the mode's constellation cap. */
	const auditionCandidates = $derived.by(() => {
		if (anchorId === null) return [] as CharacterIndexEntry[];
		const cons = mounted ? $constellations : {};
		const wanted = [...auditionFacets];
		return roster.filter((e) => {
			if (e.id === anchorId || teamSlots.includes(e.id)) return false;
			const provided = facetsProvidedBy(e, conCapFor(conMode, cons[e.id]));
			return wanted.every((f) => provided.includes(f));
		});
	});

	// The tab's avatar stack — insertion order, the anchor first when auditioning.
	const compareStack = $derived(
		[...compareIds].map((id) => {
			const entry = getCharacterIndexEntry(id);
			return { id, entry, color: elColor(entry?.element) };
		})
	);

	// ---------------------------------------------------------------------------
	// Team slots — THE working team (the planner's active tab), read from the
	// shared rotationTabs module. This tool edits it directly; the planner and
	// the bench band see every change live. The module speaks the planner's
	// representation ('blank' = empty); this tool's TeamSlot uses null.
	// ---------------------------------------------------------------------------

	const rosterIds = new Set(roster.map((c) => c.id));
	const teamSlots = $derived<TeamSlot[]>(rt.slots.map((id) => (id === 'blank' ? null : id)));

	// Rotation-Planner arrival: one alternatives row per filled slot.
	const slotRows = $derived.by(() => buildSlotAlternativeRows(teamSlots, roster, rolesOf));

	const teamStateOf = (id: string): 'in' | 'out' | 'full' =>
		teamSlots.includes(id) ? 'in' : teamSlots.every((s) => s !== null) ? 'full' : 'out';

	function toggleTeam(id: string): void {
		if (teamSlots.includes(id)) rt.removeFromTeam(id);
		else rt.addToTeam(id);
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

	// The old slots→URL mirror is retired with the ?team= injection: the
	// working team lives in the shared tab state (persisted there), and a URL
	// that silently tracked it would imply a share mechanism this page no
	// longer owns. Shareable teams travel through the planner's ⤴ Share link.
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
		<span class="tb-act-glyph"><Mark name={teamState === 'in' ? 'check' : 'plus'} /></span>
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
		<span class="tb-act-glyph"><Mark name={compared ? 'check' : 'forward'} /></span>
		<span class="tb-act-label">Compare</span>
	</button>
{/snippet}

<!-- Audition candidates — rendered inside CompareView (below its legend): who
     else covers the facets the incumbent provides, chips toggleable so an
     over-narrow AND can be relaxed. Handlers live here with the other tiles'. -->
{#snippet auditionStrip()}
	<div class="tb-aud">
		{#if auditionSeedFacets.length > 0}
			<div class="tb-aud-facets">
				<span class="tb-aud-label">covers</span>
				{#each auditionSeedFacets as f (f)}
					<button
						class="chip"
						class:active={auditionFacets.has(f)}
						aria-pressed={auditionFacets.has(f)}
						title={facetMeta(f)?.hint}
						onclick={() => toggleSet(auditionFacets, f)}>{facetMeta(f)?.label ?? f}</button
					>
				{/each}
			</div>
		{/if}
		<div class="tb-aud-cands">
			{#each auditionCandidates as entry (entry.id)}
				{@const on = compareIds.has(entry.id)}
				<button
					class="tb-cand"
					class:tb-cand--on={on}
					style:--el-color={elColor(entry.element)}
					disabled={!on && compareIds.size >= MAX_COMPARE}
					onclick={() => toggleCompare(entry.id)}
					title={on
						? `Remove ${entry.displayName} from the comparison`
						: `Add ${entry.displayName} to the comparison`}
				>
					<span class="tb-cand-avatar">
						{#if hasAvatar(entry.id)}
							<img src={getAvatarFallback(entry.id, 'circle', traveler)} alt="" />
						{:else}
							<span class="tb-cand-initials">{entry.displayName.slice(0, 2).toUpperCase()}</span>
						{/if}
					</span>
					<span class="tb-cand-name">{entry.displayName}</span>
					{#if on}<span class="tb-cand-mark"><Mark name="check" size={12} /></span>{/if}
				</button>
			{/each}
			{#if auditionCandidates.length === 0}
				<p class="note tb-aud-none">
					No one covers all of these at once — toggle a chip off to broaden the search.
				</p>
			{/if}
		</div>
	</div>
{/snippet}

<!-- ── Roster-view slots handed to the shared CharacterGrid ───────────────── -->

<!-- One grid tile (the grid's own snippet takes just the entry). -->
{#snippet rosterTile(entry: CharacterIndexEntry)}
	{@render charTile(entry, false)}
{/snippet}

<!-- Above the tiles, inside the grid's scroller. -->
{#snippet rosterCount()}
	<p class="tb-count" role="status">
		{split.matches.length} character{split.matches.length === 1 ? '' : 's'}
		{#if activeFacets.size > 0 && conMode === 'mine'}
			<span class="tb-count-mode">at your constellations</span>
		{:else if activeFacets.size > 0 && conMode !== 'c0'}
			<span class="tb-count-mode">at {conMode.toUpperCase()}</span>
		{/if}
	</p>
{/snippet}

<!-- Below the tiles: capability-unknown kits, never silently dropped. -->
{#snippet rosterStubs()}
	{#if split.uncurated.length > 0}
		<section class="tb-stubs">
			<p class="kicker">Not yet curated</p>
			<p class="note tb-note">
				These kits have no capability data yet — they may well do what you’re filtering for. Absence
				of a badge here means “unknown”, not “no”.
			</p>
			<div class="tb-grid">
				{#each split.uncurated as entry (entry.id)}
					{@render charTile(entry, true)}
				{/each}
			</div>
		</section>
	{/if}
{/snippet}

<!-- The rail sections the shared grid doesn't own: the roster ledger, the
     editorial roles, the faction/buff groups and the capability facets. They
     render between the grid's search field and its identity chip groups. -->
{#snippet rosterFacetRail()}
	<div class="cg-sec">
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

	<div class="cg-sec">
		<p class="kicker">Role</p>
		<div class="chips tb-chips">
			{#each POSITIONS as p (p)}
				<button
					class="chip tb-chip--role"
					class:active={rolePosition.has(p)}
					aria-pressed={rolePosition.has(p)}
					onclick={() => toggleRolePosition(p)}
				>
					<img class="tb-chip-icon" src={positionIcon(p, 'color')} alt="" />{POSITION_LABEL[p]}
				</button>
			{/each}
			{#each FUNCTIONS as f (f)}
				<button
					class="chip tb-chip--role"
					class:active={roleFunction.has(f)}
					aria-pressed={roleFunction.has(f)}
					onclick={() => toggleRoleFunction(f)}
				>
					<img class="tb-chip-icon" src={functionIcon(f, 'color')} alt="" />{FUNCTION_LABEL[f]}
				</button>
			{/each}
		</div>
	</div>

	<div class="cg-sec">
		<p class="kicker">Factions / Buffs</p>
		<div class="chips tb-chips">
			{#each FACTION_BUFFS as fb (fb.key)}
				<button
					class="chip"
					class:active={filters.factionBuffs?.has(fb.key)}
					title={fb.hint}
					aria-pressed={filters.factionBuffs?.has(fb.key)}
					onclick={() => filters.factionBuffs && toggleSet(filters.factionBuffs, fb.key)}
					>{fb.label}</button
				>
			{/each}
		</div>
	</div>

	<div class="cg-sec">
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
{/snippet}

<!-- The tool stack: bands + surface, with the bench ribbon's dock spanning
     both (toolbar round). Band A is the DOCUMENT — the same tabs and the same
     save/load/share the planner shows, because since the bench-band round both
     tools edit ONE working team. Band B is this tool's VIEW: which source you
     are browsing, and at which constellations you are reading it. -->
<ToolStack benched fill>
	{#snippet bandALeft()}
		<DocumentTabs />
	{/snippet}

	{#snippet bandARight()}
		<DocumentActions />
	{/snippet}

	{#snippet bandBLeft()}
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
			<!-- The Compare tab IS the accumulator: a card's "Compare" lands
			     its pick here as a mini side avatar (the Saved-Rotations stack
			     grammar) — no tray, no navigation; click when ready. -->
			<button
				class="tab tb-tab--compare"
				class:active={sourceTab === 'compare'}
				role="tab"
				aria-selected={sourceTab === 'compare'}
				onclick={() => (sourceTab = 'compare')}
			>
				Compare
				{#if compareStack.length > 0}
					<span
						class="tb-tabstack"
						style:width="{24 + (compareStack.length - 1) * 16}px"
						aria-label="{compareStack.length} in comparison"
					>
						{#each compareStack as pick, i (pick.id)}
							<span
								class="tb-tabstack-circle"
								style:left="{i * 16}px"
								style:z-index={i + 1}
								style:border-color={pick.color}
							>
								{#if hasAvatar(pick.id)}
									<img
										src={getAvatar(pick.id, preferNewfit, 'side', traveler)}
										alt=""
										onerror={(e) => {
											const img = e.currentTarget as HTMLImageElement;
											if (!img.dataset.triedFallback) {
												img.dataset.triedFallback = '1';
												img.src = getAvatarFallback(pick.id, 'side', traveler);
											} else {
												img.style.display = 'none';
											}
										}}
									/>
								{:else}
									<span class="tb-tabstack-initials"
										>{(pick.entry?.displayName ?? pick.id).slice(0, 1).toUpperCase()}</span
									>
								{/if}
							</span>
						{/each}
					</span>
				{/if}
			</button>
		</div>
	{/snippet}

	{#snippet bandBRight()}
		<!-- The constellation LENS. It was an eight-segment C0…C6 + My roster
		     rail — 356px, the widest single control on the site, for something
		     you set once and rarely touch. A menu states the current reading in
		     one chip and gives each option room for the sentence that explains
		     it. -->
		<BandMenu label={activeConMode.label} ariaLabel="Read capabilities at">
			{#snippet items(close)}
				{#each CON_MODES as m (m.key)}
					<button
						class="band-menu-item"
						role="menuitemradio"
						aria-checked={conMode === m.key}
						onclick={() => {
							close();
							conMode = m.key;
						}}
					>
						<span class="tb-conmode-mark">
							{#if conMode === m.key}<Mark name="check" size={12} />{/if}
						</span>
						<span class="tb-conmode-label">{m.label}</span>
						<span class="tb-conmode-hint">{m.hint}</span>
					</button>
				{/each}
			{/snippet}
		</BandMenu>
	{/snippet}

	{#snippet surface()}
		<!-- ── The tool frame: filter/center zones inside ONE surface. Viewport-fit
		     — the views scroll INSIDE it, the page never does. -->
		<div class="tb-frame frame ctx-light">
			<div class="tb-work">
				<!-- What the team IS and what it COVERS — one horizontal readout above
			     the roster the coverage gaps filter. -->
				<TeamStrip
					slots={teamSlots}
					conCapOf={(id) => rt.tabCon[id] ?? (mounted ? ($constellations[id] ?? 0) : 0)}
					onClear={() => rt.clearTeam()}
					onFilterFacet={(f) => selectCapability(f)}
				/>
				<section class="tb-source">
					{#if sourceTab === 'atlas'}
						<div class="tb-atlas">
							{#if atlasMode === 'slots' && slotRows.length > 0}
								<div class="tb-atlas-head">
									<p class="tb-atlas-lead">
										Alternatives for each character on your team — same element and role.
									</p>
									<button class="btn" onclick={backToCards}
										>Browse all roles <Mark name="forward" /></button
									>
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
												>{row.alternatives.length} alt{row.alternatives.length === 1
													? ''
													: 's'}</span
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
									<button class="btn" onclick={backToCards}><Mark name="back" /> All roles</button>
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
									Roles: Genshin Impact — Imaginarium Theater. A presence classification, not a
									ranking.
								</p>
							{/if}
						</div>
					{/if}

					<!-- ── Compare — a first-class center view, not an inspector: the shared
			     ruler gets the Source's full width, and the view works at every
			     viewport (no dock breakpoint, no modal fallback). -->
					{#if sourceTab === 'compare'}
						{#if compareIds.size === 0}
							<div class="tb-cmp-empty">
								<p class="tb-cmp-empty-title">Nothing to compare yet.</p>
								<p class="note">
									Hover a character card in the Roster and press <strong>Compare</strong> — up to four
									characters line up here on one shared time ruler.
								</p>
							</div>
						{:else}
							<CompareView
								ids={[...compareIds]}
								{conMode}
								anchorId={anchorId ?? undefined}
								onRemove={toggleCompare}
								onCommit={anchorId ? commitAudition : undefined}
								onClear={anchorId ? undefined : () => compareIds.clear()}
								onCancelAudition={anchorId ? cancelAudition : undefined}
								candidatesArea={anchorId ? auditionStrip : undefined}
							/>
						{/if}
					{/if}

					<!-- Roster stays MOUNTED once first shown (hidden, not {#if}-destroyed):
				     remounting ~122 cards on every Atlas⇄Roster toggle was a visible
				     stall in Safari 26.x, and keeping it warm makes the toggle instant
				     in every browser.
				     The shared CharacterGrid owns the search field, the identity chip
				     groups and the Clear button; the TB's own filters ride in via the
				     rail slot below it. The rail sits RIGHT — the same side as the
				     planner's picker, one filter-column grammar site-wide (the old
				     mirrored arrangement served the retired slide seam). -->
					{#if rosterEverShown}
						<div class="tb-roster" hidden={sourceTab !== 'roster'}>
							<CharacterGrid
								roster={split.matches}
								{filters}
								railSide="right"
								searchPlaceholder="Search characters…"
								tile={rosterTile}
								railStart={rosterFacetRail}
								aboveGrid={rosterCount}
								belowGrid={rosterStubs}
								{extraFiltersActive}
								onClearExtras={clearExtraFilters}
								emptyMessage={rosterEmptyMessage}
							/>
						</div>
					{/if}
				</section>
			</div>
		</div>
	{/snippet}
</ToolStack>

<!-- The one deliberate modal: a focused single-character read. -->
{#if selectedId}
	<DetailCard
		id={selectedId}
		{conMode}
		onClose={() => (selectedId = null)}
		teamState={teamStateOf(selectedId)}
		onToggleTeam={toggleTeam}
		compareState={compareStateOf(selectedId)}
		onToggleCompare={toggleCompare}
	/>
{/if}

<style>
	/* ONE frame holding every zone, inside a ToolStack that supplies the
	   ribbon inset, the band header and the viewport-height budget (toolbar
	   round). The .tb wrapper is gone with them: it existed to carry the
	   padding-left, the tab-row gap and the height calc, and the stack owns all
	   three now — which is also what finally makes the two tools' frame tops
	   agree by construction rather than by --tb-tabrow-gap being hand-tuned
	   against the planner's (probe-bench-align still asserts it).

	   The page itself never scrolls: the stack fills the viewport budget
	   exactly and the frame's zones scroll internally — which is what lets the
	   bench hold its edge at a fixed height instead of stickily chasing the
	   scroll position. */

	/* Radius per the 3/6/9 scale, matching .rp-frame. overflow:hidden clips the
	   zones' square scroll boxes to the rounded corners; the SlotPortrait
	   popovers are position:fixed, which a plain overflow clip does not catch. */
	.tb-frame {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: row;
		align-items: stretch;
		border-radius: var(--r-sm);
		overflow: hidden;
		position: relative;
	}

	/* The .bn bench zone is GONE (abutting round). It was the strip of frame
	   that tucked under the ribbon — width reservation and nothing else once
	   the tall-bench round moved the team facts out to the TeamStrip. The frame
	   now starts where the ribbon ends, so there is no column to reserve, and
	   the TeamStrip picks up the frame's own left edge. */

	/* The work column: the team strip, then the browse zone under it. The
	   strip must NOT scroll with the roster (its coverage chips drive the
	   filters), so the scroll lives one level down, on .tb-source. */
	.tb-work {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	/* ── Source ───────────────────────────────────────────────── */
	/* The center zone: the scroll container all three views live in. Padding
	   echoes .rp-frame's (10px 14px) — it belongs to the zone, not the frame,
	   so the bench hairline can run the frame's full height. */
	.tb-source {
		flex: 1;
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 10px 14px;
	}

	.tb-tabgroup {
		display: flex;
		gap: 0.3rem;
	}

	/* ── Compare tab's avatar stack (the accumulator's live feedback) ──
	   Side avatars in 24px circles overlapping 8px, the Saved-Rotations stack
	   at promoted-tab scale; border tinted per element, width set inline from
	   the pick count. */
	.tb-tab--compare {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}
	.tb-tabstack {
		position: relative;
		height: 24px;
		flex-shrink: 0;
	}
	.tb-tabstack-circle {
		position: absolute;
		top: 0;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 1.5px solid var(--border);
		background: var(--surface); /* was a drifted stray #131c30 */
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.tb-tabstack-circle img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		/* The side-crop framing every circular side avatar on the site uses. */
		transform: scale(1.333) translateY(-14%);
	}
	.tb-tabstack-initials {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		color: var(--muted);
	}

	/* ── Compare empty state (0 picks) — teaches the flow ────── */
	/* Flat: a plain section on the frame fill, like every other inner panel. */
	.tb-cmp-empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
	}
	.tb-cmp-empty-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	/* ── Audition candidates strip (rendered inside CompareView) ── */
	.tb-aud {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.tb-aud-facets {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.tb-aud-label {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
	.tb-aud-cands {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.tb-aud-none {
		font-size: var(--fs-xs);
	}
	.tb-cand {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.18rem 0.5rem 0.18rem 0.22rem;
		border: 1px solid color-mix(in srgb, var(--el-color) 40%, var(--border));
		border-radius: 999px;
		background: color-mix(in srgb, var(--el-color) 8%, transparent);
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition:
			border-color 150ms ease,
			background 150ms ease;
	}
	.tb-cand:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--el-color) 80%, var(--border));
	}
	.tb-cand--on {
		background: color-mix(in srgb, var(--el-color) 22%, transparent);
		border-color: color-mix(in srgb, var(--el-color) 70%, var(--border));
	}
	.tb-cand:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.tb-cand-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		overflow: hidden;
		background: rgba(0, 0, 0, 0.5);
		flex-shrink: 0;
	}
	.tb-cand-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.tb-cand-initials {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		color: var(--el-color);
	}
	.tb-cand-name {
		white-space: nowrap;
	}
	.tb-cand-mark {
		display: flex;
		color: var(--el-color);
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

	/* ── Roster (the shared CharacterGrid) ────────────────────── */
	/* Fills the center zone and bounds the grid's internal scroll — the chain
	   needs min-height:0 at every level, or the grid grows instead of
	   scrolling. Sizing knobs are custom properties CharacterGrid reads, which
	   is how the TB keeps its own tile scale and a wider rail without the
	   planner's picker changing. */
	.tb-roster {
		display: flex;
		flex: 1;
		min-height: 0;
		min-width: 0;
		--cg-rail-w: 250px;
		--cg-tile-min: 118px;
		--cg-gap: 0.6rem;
		--cg-stack-gap: 0.7rem;
	}
	/* The explicit display:flex above would beat the UA's [hidden] rule. */
	.tb-roster[hidden] {
		display: none;
	}
	/* Reward wide screens with roomier cards (fewer-but-bigger), not more tiles
	   at once — the wider cells cross CharacterCard's `roomy` container-query
	   band. Thresholds tuned live; the card adapts to whatever width it's given. */
	@media (min-width: 1500px) {
		.tb-roster {
			--cg-tile-min: 150px;
		}
	}
	@media (min-width: 1900px) {
		.tb-roster {
			--cg-tile-min: 168px;
		}
	}

	.tb-seg {
		margin-top: 0.55rem;
	}

	/* The rail's segmented group is the global .segment track; the only local
	   part is that it stretches its buttons to equal widths, which a
	   free-standing segment shouldn't do. (The constellation lens used to be
	   the second member of this rule — it is a band menu now.) */
	.tb-seg {
		display: flex;
	}
	.tb-seg > .btn {
		flex: 1;
	}

	/* ── The constellation lens's menu rows ─────────────────────
	   Three columns: the check gutter (fixed, so every label starts on one
	   line), the reading, and the sentence that explains it. */
	.tb-conmode-mark {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 12px;
		flex-shrink: 0;
	}
	.tb-conmode-label {
		font-weight: var(--fw-semibold);
		flex-shrink: 0;
		min-width: 4.5rem;
	}
	.tb-conmode-hint {
		font-size: var(--fs-xs);
		color: var(--muted);
		white-space: normal;
		max-width: 22rem;
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

	/* The Atlas rows' and the stubs bucket's grid (the roster's own is
	   CharacterGrid's, tuned through the --cg-* knobs on .tb-roster). Same
	   scale, so tiles read identically wherever they appear. */
	.tb-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
		gap: 0.6rem;
	}
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
		display: flex;
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

	.tb-stubs {
		margin-top: 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
</style>
