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
	import ToolColumns from '$lib/components/ToolColumns.svelte';
	// The Atlas cards fill their column now, so on a short viewport they CLIP —
	// which is exactly the case the fade exists for. Harmless on Roster/Compare:
	// their inner scroller does the travelling, so this one measures none and
	// paints no edges.
	import { scrollFade } from '$lib/actions/scrollFade';
	import DocumentTabs from '$lib/components/DocumentTabs.svelte';
	import DocumentActions from '$lib/components/DocumentActions.svelte';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import CharacterCard, { type TagChip } from '$lib/components/CharacterCard.svelte';
	import CharacterGrid from '$lib/components/CharacterGrid.svelte';
	import CharacterFilterRail from '$lib/components/CharacterFilterRail.svelte';
	import type { GridFilters } from '$lib/characterFilters';
	import DetailCard from '$lib/components/DetailCard.svelte';
	import CompareView from './lib/CompareView.svelte';
	import CoveragePanel from './lib/CoveragePanel.svelte';
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
			onSwap: benchSwap
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

	type SourceTab = 'atlas' | 'roster' | 'compare';

	let sourceTab = $state<SourceTab>('atlas');
	// Sticky: flips true on first Roster visit and stays — the roster grid is
	// then kept mounted (CSS-hidden) across tab toggles. See the template note.
	let rosterEverShown = $state(false);
	$effect(() => {
		if (sourceTab === 'roster') rosterEverShown = true;
	});

	// The three routes, as data — band B's navigation renders them in a loop now
	// that each is a plate rather than a hand-written .tab.
	const SOURCES: { key: SourceTab; label: string }[] = [
		{ key: 'atlas', label: 'Atlas' },
		{ key: 'roster', label: 'Roster' },
		{ key: 'compare', label: 'Compare' }
	];

	// (Compare's reachability gate lives with the compare state, further down.)

	// The Atlas has three faces: the four role cards, one card's drill-down, and
	// (on Rotation-Planner arrival) per-slot alternatives.
	let atlasMode = $state<'cards' | 'drill' | 'slots'>('cards');
	let drilledCategory = $state<RoleCategory | null>(null);

	// Which Source views hand their scroller a definite height to fill, and which
	// end at their content. Named because it is now asked TWICE — once by the
	// scroller and once by the box that holds it and the pinned Atlas head.
	const sourceFills = $derived(sourceTab !== 'atlas' || atlasMode === 'cards');

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

	/**
	 * ⚓ NATE 2026-08-09: COMPARE IS UNREACHABLE UNTIL THERE IS SOMETHING IN IT.
	 * It used to accept the click and land you on a paragraph explaining why the
	 * page was empty — a route whose only content is an apology for existing. The
	 * accumulator teaches itself without that: a card's Compare button fills the
	 * plate's avatar stack, and the plate wakes up the moment it holds a pick.
	 */
	const compareReady = $derived(compareIds.size > 0);

	// ...which means the route has to be able to LOSE the argument too. Removing
	// the last pick — or CompareView's own Clear — would otherwise strand you on
	// a route the navigation has just said you cannot be on. Bounce to the
	// Roster, where picks are made. `anchorId` is checked for completeness: an
	// audition always holds its incumbent, so it can never empty.
	$effect(() => {
		if (sourceTab === 'compare' && compareIds.size === 0 && anchorId === null) {
			sourceTab = 'roster';
		}
	});

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

	/** The bench's ⇄ (and an EMPTY slot's portrait, since there are no details to
	 *  read for nobody). An occupied slot auditions its incumbent; an empty one
	 *  has no incumbent to audition against, so it opens the Roster, which is
	 *  where you pick somebody. Empty slots used to be inert here — the planner's
	 *  ⇄ opened its Source and the TB's did nothing. */
	function benchSwap(index: number, incumbentId: string | null): void {
		if (incumbentId) {
			openAudition(index, incumbentId);
			return;
		}
		selectedId = null;
		sourceTab = 'roster';
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

	// The resolved team, and whether there IS one. Both used to live inside the
	// TeamStrip; the breathing-room round split that component into two panels,
	// and the presence test has to sit above BOTH of them — otherwise an empty
	// team leaves two empty boxes and a gutter between them. Deriving `members`
	// here also means the two panels share one lookup pass instead of each
	// mapping the slots themselves.
	// `?? null` normalizes the lookup's `undefined` (an id with no index entry)
	// into the empty-slot representation, so the panels take one clean type.
	const members = $derived<(CharacterIndexEntry | null)[]>(
		teamSlots.map((id) => (id ? (getCharacterIndexEntry(id) ?? null) : null))
	);
	const filledCount = $derived(members.filter((m) => m != null).length);

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
		<!-- 16 to match its peer — see the note on the Compare button. Two glyphs
		     side by side in one bar have to be one size whatever each needs. -->
		<span class="tb-act-glyph"><Mark name={teamState === 'in' ? 'check' : 'plus'} size={16} /></span
		>
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
		<!-- 16, not the default 14: `compare` (Scale) is the busiest mark in the
		     set and needs the extra two pixels to resolve its pans. `check` rides
		     along so the button doesn't resize when you press it. -->
		<span class="tb-act-glyph"><Mark name={compared ? 'check' : 'compare'} size={16} /></span>
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
					<!-- ctx-dark for the same reason the compare chip's disc claims it:
					     a portrait backing must not follow its surroundings to paper. -->
					<span class="tb-cand-avatar ctx-dark">
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
		<!-- The team's one destructive action, moved out of the coverage read-out
		     (⚓ NATE 2026-08-09) — that run is now a bare header on the scene with
		     nowhere to hang a control, and a team action belongs in the band with
		     the other team controls anyway.
		     ↻ 2026-08-10: a PLATE at the row's height, detached from the band and
		     mirroring the con lens at the far end, so the navigation rail sits
		     between two peers. It is a plain .btn rather than .btn--danger: the
		     danger variant is a deliberate ghost (it must not sit on screen
		     looking pressable) and Nate asked for a solid ████ here. The
		     destructive reading moves to the hover, which is where the hand
		     actually is when it matters. -->
		<button
			class="btn tb-clear"
			disabled={filledCount === 0}
			title="Empty every slot in the working team"
			onclick={() => rt.clearTeam()}><Mark name="close" /> Clear team</button
		>
	{/snippet}

	<!-- ── THE IN-TOOL NAVIGATION (⚓ NATE 2026-08-09, tuned 08-10) ───────────
	     Three plates in Bitter on their own glass rail, the selected one on a
	     parchment ground with a --plain inset border — Genshin's own three-part
	     tab strip, which is the shape this navigation always was without ever
	     looking like it. It used to be three 11px .tab chips in the band's left
	     corner: "too small and inconspicuous" for the control that decides what
	     the whole tool is showing you.

	     ↻ ⚓ NATE 2026-08-10, three tweaks: the flanking star ornaments are OUT
	     (the `sparkle` mark went with them — nothing else used it), the plate's
	     border is a GOLD mix rather than the light context's slate line, and the
	     items are sized from the rail rather than from their text.

	     The selected plate still stands PROUD of the rail at both ends
	     (--nav-plate-h against BAND_B_H), which is what makes it read as a thing
	     sitting on the strip rather than a fill inside it. -->
	{#snippet bandBCenter()}
		<div class="tb-nav" role="tablist" aria-label="Source view">
			{#each SOURCES as s (s.key)}
				{@const on = sourceTab === s.key}
				{@const gated = s.key === 'compare' && !compareReady}
				<button
					class="tb-nav-item"
					class:active={on}
					class:ctx-light={on}
					class:inset={on}
					class:inset--plain={on}
					role="tab"
					aria-selected={on}
					disabled={gated}
					title={gated
						? 'Nothing to compare yet — press Compare on a character card to add one'
						: undefined}
					onclick={() => (sourceTab = s.key)}
				>
					<span class="tb-nav-label">{s.label}</span>
					<!-- The Compare plate IS the accumulator: a card's "Compare" lands
					     its pick here as a mini side avatar (the Saved-Rotations stack
					     grammar) — no tray, no navigation; click when ready. -->
					{#if s.key === 'compare' && compareStack.length > 0}
						<span
							class="tb-tabstack"
							style:width="{24 + (compareStack.length - 1) * 16}px"
							aria-label="{compareStack.length} in comparison"
						>
							{#each compareStack as pick, i (pick.id)}
								<!-- ctx-dark: this disc must not follow the plate it rides on.
								     The Compare plate is glass when unselected and PARCHMENT when
								     selected, and a portrait backing has to be one opaque thing
								     in both. See the note at .tb-tabstack-circle. -->
								<span
									class="tb-tabstack-circle ctx-dark"
									style:left="{i * 16}px"
									style:z-index={i + 1}
									style:--el-color={pick.color}
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
			{/each}
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
		<!-- Two boxes with a gap (aside-column round): the work frame, and — on
		     the Roster only — the filter column beside it. Atlas and Compare have
		     nothing to filter, so they get the full width. -->
		<!-- asideBare: the rail paints its own groups, so the column is a gutter
		     of objects rather than one box of sections. -->
		<ToolColumns {main} aside={sourceTab === 'roster' ? rosterRail : undefined} asideBare />
	{/snippet}
</ToolStack>

<!-- ── The main column: the work frame ────────────────────────────────────── -->
{#snippet main()}
	<!-- ── THE SURFACE HAS NO FRAME (⚓ NATE 2026-08-08).
	     The Team Builder used to be a full-width, full-height sheet of PAPER —
	     the largest surface on the site wearing the treatment that, on a dark
	     world, belongs to the narrowest. Genshin's rule, read off its own
	     screens: light is for banners, buttons and cards; a field is the world
	     itself. So the frame is gone and the content sits on the dimmed scene,
	     with light kept for the character cards (which stay light — Genshin's
	     are too) and for the section banners that name each run.

	     .ctx-dark is CLAIMED rather than inherited, and that is honest here:
	     at TOOL_DIM the crest is a dark ground, painted by the scene layer
	     instead of by this element. See the amended law in app.css — the
	     exception cuts one way only, because there is no light ground anywhere
	     to inherit from. -->
	<div class="tb-stack ctx-dark">
		<!-- WHAT THE TEAM IS and WHAT IT COVERS — two panels, above the roster
		     the coverage gaps filter. The gate is HERE rather than inside either
		     component so an empty team costs no boxes and no gutter: four blank
		     cards in the ribbon already say there is no team. -->
		{#if filledCount > 0}
			<!-- ↻ 2026-08-09: ONE component again. TeamFacts (resonance + the
			     faction facts) used to ride the banner's far end; the banner is a
			     bare on-scene header now and the facts moved INTO the capability
			     run as its left-hand cluster, which is where they always belonged
			     — "what the team is" and "what it covers" are one reading. -->
			<CoveragePanel
				{members}
				conCapOf={(id) => rt.tabCon[id] ?? (mounted ? ($constellations[id] ?? 0) : 0)}
				onFilterFacet={(f) => selectCapability(f)}
			/>
		{/if}

		<!-- .tb-frame is GONE — it existed only to supply a ground, a radius and
		     a clip, and with no ground there is nothing to round or clip. The
		     scroll zone below is the box now, one level shallower.

		     FILLS on Roster and Compare, ends at its content on the Atlas. The
		     Atlas is four role cards (or ≤4 slot rows); the other two can be
		     arbitrarily long AND the Roster's bounded scroller depends on this
		     having a definite height. So it is per-VIEW. ⚠ Never
		     `max-height: 100%` here — a percentage against a flex-derived
		     height is exactly the shape that silently failed on 2026-08-08, and
		     probe-bench-align's bounded-scroller check is what catches it. -->
		<!-- ↻ 2026-08-11: THE ATLAS CARDS VIEW FILLS TOO. It was content-height on
		     the reasoning that four cards are a short, known thing — true while
		     the cards asserted their own height, and false the moment they had to
		     FIT the column instead (⚓ Nate: "the cards aren't fitting on the
		     screen vertically"). A grid can only size itself to the space left
		     over if something gives it a definite one. The drill and slots views
		     keep the old behaviour: those are lists, and a list should end where
		     its content does. -->
		<!-- ⚓ NATE 2026-08-11: THE ATLAS HEAD IS PINNED — and pinning it meant
		     lifting it OUT of the scroller, not sticking it inside one. That head
		     carries the way BACK from a drill-down, and it was scrolling off the
		     top the moment you went looking through the characters it introduced.
		     ⚠ WHY NOT `position: sticky`. It would park the head in exactly the
		     pixels the scroll-fade mask erases: the fade is what tells you there
		     is more above, so a sticky head sitting at top:0 would dissolve the
		     instant the content behind it started moving. A mask cannot be told
		     to spare one child. So the head and the scroller are two boxes, and
		     only the second one scrolls. -->
		<div class="tb-sourcebox" class:tb-sourcebox--fill={sourceFills}>
			{#if sourceTab === 'atlas' && atlasMode === 'slots' && slotRows.length > 0}
				<div class="tb-atlas-head">
					<p class="tb-atlas-lead">
						Alternatives for each character on your team — same element and role.
					</p>
					<button class="btn btn--glass ctx-glass" onclick={backToCards}
						>Browse all roles <Mark name="forward" /></button
					>
				</div>
			{:else if sourceTab === 'atlas' && atlasMode === 'drill' && drilledCategory}
				<div class="tb-atlas-head">
					<button class="btn btn--glass ctx-glass" onclick={backToCards}
						><Mark name="back" /> All roles</button
					>
					<div class="tb-drill-title">
						{#if drilledCategory.position}
							<img src={positionIcon(drilledCategory.position, 'color')} alt="" />
						{/if}
						<img src={functionIcon(drilledCategory.function, 'color')} alt="" />
						<span>{drilledCategory.label}</span>
					</div>
				</div>
			{/if}
			<section class="tb-source scroll-fade" class:tb-source--fill={sourceFills} use:scrollFade>
				{#if sourceTab === 'atlas'}
					<div class="tb-atlas">
						{#if atlasMode === 'slots' && slotRows.length > 0}
							{#each slotRows as row (row.slotEntry.id)}
								<section class="tb-slotrow">
									<header
										class="tb-slotrow-head ctx-glass"
										style:--el-color={elColor(row.slotEntry.element)}
									>
										{#if hasAvatar(row.slotEntry.id)}
											<img
												class="tb-slotrow-avatar ctx-dark"
												src={getAvatarFallback(row.slotEntry.id, 'circle', traveler)}
												alt=""
												loading="lazy"
											/>
										{:else}
											<span class="tb-slotrow-initials ctx-dark"
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
							{#each drillRows as row (row.key)}
								<section class="tb-slotrow">
									<header class="tb-slotrow-head ctx-glass">
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
							<!-- ⚓ NATE 2026-08-10: the lead line and the citation that used to
						     bracket these cards are GONE — "they're just clutter". Four
						     cards that each name a role and count its characters do not
						     need a sentence telling you they are roles.
						     ⚠ WHAT WENT WITH THEM: the only user-facing statement of where
						     these roles come from (Genshin's Imaginarium Theater) and the
						     only place the surface said "a presence classification, not a
						     ranking". The second is a constitution line — no tier lists —
						     and it now lives nowhere a reader can see it. If it belongs
						     anywhere it is the Team Builder's Help chapter, not wrapped
						     around the cards. -->
							<AtlasView {roleCards} onSelectCategory={openCategory} />
						{/if}
					</div>
				{/if}

				<!-- ── Compare — a first-class center view, not an inspector: the shared
			     ruler gets the Source's full width, and the view works at every
			     viewport (no dock breakpoint, no modal fallback). -->
				<!-- ↻ 2026-08-09: THE TAUGHT EMPTY STATE IS GONE, and its absence is the
			     feature. "Nothing to compare yet — hover a card and press Compare"
			     was a whole view explaining why it had nothing to show; the
			     navigation says that now, by refusing the click and putting the
			     same sentence in the plate's title.
			     `compareReady` is still tested HERE, not just on the plate: the
			     bounce back to the Roster is an effect, so there is one frame after
			     the last pick leaves where this branch is still selected. Rendering
			     nothing for that frame is what keeps the old empty state from
			     flashing on its way out. -->
				{#if sourceTab === 'compare' && compareReady}
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

				<!-- Roster stays MOUNTED once first shown (hidden, not {#if}-destroyed):
				     remounting ~122 cards on every Atlas⇄Roster toggle was a visible
				     stall in Safari 26.x, and keeping it warm makes the toggle instant
				     in every browser.
				     ↻ ASIDE-COLUMN ROUND 2026-08-08: the filter column left this box.
				     It is the surface's ASIDE now — its own dark box beside the frame
				     with bare scene between them (see the rosterRail snippet below).
				     What is left in here is the grid proper. -->
				{#if rosterEverShown}
					<div class="tb-roster" hidden={sourceTab !== 'roster'}>
						<CharacterGrid
							roster={split.matches}
							{filters}
							tile={rosterTile}
							aboveGrid={rosterCount}
							belowGrid={rosterStubs}
							emptyMessage={rosterEmptyMessage}
						/>
					</div>
				{/if}
			</section>
		</div>
	</div>
{/snippet}

<!-- ── The aside column: the filter column ────────────────────────────────
     The shared identity groups (search · element · weapon · rarity · region ·
     Clear) come from <CharacterFilterRail>; the TB's own groups — the roster
     ledger, the editorial roles, factions/buffs and the capability facets —
     ride in through railStart, and reach the same Clear.

     The rail is handed the UNFILTERED roster, not split.matches: its Region
     chips are drawn from whatever it is given, and from the filtered list
     choosing a region collapsed the group to the one chip you had just
     pressed. (Live before this round; the extraction is where it surfaced.) -->
{#snippet rosterRail()}
	<CharacterFilterRail
		{roster}
		{filters}
		searchPlaceholder="Search characters…"
		railStart={rosterFacetRail}
		{extraFiltersActive}
		onClearExtras={clearExtraFilters}
	/>
{/snippet}

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

	/* ── The surface: a COLUMN OF BOXES (breathing-room round 2026-08-08) ──
	   The Team Builder used to be ONE frame with every zone packed inside it,
	   which measured 6.7% bare scene inside its own bounding box against the
	   Visualizers' 11.5% — the difference the round exists to close. It is a
	   stack now: the team panels, then the browse frame, with TOOL_GUTTER of
	   scene running between them.

	   ⚠ min-height: 0 IS LOAD-BEARING. This inserts a level into the fill chain
	   (.tool-stack--fill → .tool-surface → .tool-columns → .tc-main → HERE →
	   .tb-frame → .tb-source → .tb-roster → .cg-scroll), and a flex column that
	   forgets it refuses to shrink below its content — which reproduces the
	   2026-08-08 break exactly: the roster renders all ~122 cards at full
	   height, .cg-scroll never bounds, and the SHELL scrolls instead. It reads
	   almost right until you notice the filter column scrolling away with the
	   tiles. probe-bench-align's bounded-scroller check is what catches it. */
	/* ⚓ NATE 2026-08-10: the SECTION rhythm is its own knob now, and it is wider
	   than the gutter. TOOL_GUTTER is the rhythm BETWEEN BOXES — bands to
	   surface, main column to aside — and it was doing double duty here as the
	   rhythm between two runs of bare content on open ground. Boxes carry their
	   own edges and can sit close; bare runs have nothing but the space around
	   them to say where one ends, so they need more of it. Two knobs because
	   they answer two questions. */
	.tb-stack {
		--tb-section-gap: 2rem;
		/* 🎛️ THE SURFACE'S CENTRED MEASURE — how wide a centred block on this
		   column is allowed to get. One consumer today: the capability run's cap
		   (CoveragePanel reads it with a local fallback).
		   ↻ It briefly had two. The Atlas grid was aligned to it on 2026-08-11
		   so the cards would match the chips above them, and then released the
		   same day when the cards went to a full-width row of four (⚓ Nate: "they
		   can use all the space available to them, not just the chip area"). Kept
		   at this level rather than pushed back down because the question it
		   answers — what is a centred block's measure HERE — belongs to the
		   surface, and the next centred block will want the same answer. */
		--tb-measure: 1040px;
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: var(--tb-section-gap);
	}

	/* ── Source ───────────────────────────────────────────────── */
	/* The scroll container all three views live in — and, since the frame went,
	   the only box left in the main column. It has no ground: the content sits
	   on the dimmed world.
	   No horizontal padding either. That padding existed to hold content off a
	   frame's edge; with no frame there is no edge, and zeroing it lines the
	   cards and banners up with the band stack above rather than insetting them
	   14px from it for no reason anyone could see. */
	/* The Source BOX: an optional pinned head plus the scroller under it. It
	   exists so the Atlas head can sit outside the mask (see the markup note) and
	   still be spaced by the Atlas's own row rhythm rather than the surface's
	   much wider section gap — a back button and the rows it heads are one
	   reading, not two runs of content.
	   ⚠ It inserts a level into the fill chain (.tool-stack--fill →
	   .tool-surface → .tool-columns → .tc-main → .tb-stack → HERE → .tb-source →
	   .tb-roster → .cg-scroll), so it needs the same min-height: 0 every other
	   level needs: a flex column that forgets it refuses to shrink below its
	   content, and the Roster's bounded scroller silently stops bounding. */
	.tb-sourcebox {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		min-width: 0;
		min-height: 0;
	}
	.tb-source {
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 0;
	}
	/* Roster + Compare + the Atlas cards. The Roster's .cg-scroll resolves its
	   bounds through this flex:1 — see the note at the markup, and the
	   bounded-scroller check in probe-bench-align. Both levels take it together:
	   a definite height has to survive the whole way down. */
	.tb-sourcebox--fill,
	.tb-source--fill {
		flex: 1;
	}

	/* ── The in-tool navigation (band B's centre zone, i.e. the rail) ───────
	   ⚓ NATE's knobs, both of them.

	   --nav-plate-h: the selected plate is TALLER THAN THE RAIL on purpose —
	   that overhang is most of what makes it read as a plate laid on the strip
	   rather than a selected cell inside it. The rail is BAND_B_H (36px), so 38
	   stands 1px proud at each end (⚓ Nate 2026-08-10, walked down 42 → 40 → 38
	   across the day). Move one, look at the other.
	   ⚠ 1px is the floor for this idiom, not a waypoint on the way to 0: at 36
	   the plate stops being proud of anything and becomes a selected cell inside
	   the rail, which is the shape this whole treatment exists to avoid.

	   --nav-fill: how much of the rail the three items take between them.
	   ⚓ NATE: "make the buttons wider than their text requires… not entirely
	   filling up the space… but maybe filling at least 50%." A PERCENTAGE rather
	   than a width, so it stays true at every viewport — the items are sized
	   from the rail, never from their labels. Rail visible at both ends is what
	   keeps the group reading as three plates ON a strip. */
	.tb-nav {
		--nav-plate-h: 38px;
		--nav-fill: 76%;
		width: var(--nav-fill);
		display: flex;
		align-items: center;
		gap: var(--band-item-gap, 4px);
	}

	/* Bitter, a full step up from the .tab it replaces (11px → 14px), and BOLD
	   (⚓ Nate 2026-08-10 — semibold did not carry at this size against the
	   parchment plate beside it). The face is the whole point of the change:
	   this is the tool's main navigation, and Nate's heading rule puts a voice
	   like that on the display face.

	   `flex: 1 1 0` with a zero basis is what makes the three EQUAL rather than
	   proportional to their words — "Atlas" and "Compare" get the same plate,
	   which is what a three-part navigation looks like. */
	.tb-nav-item {
		flex: 1 1 0;
		min-width: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		height: var(--nav-plate-h);
		padding: 0 0.6rem;
		border: none;
		border-radius: var(--r-sm);
		background: none;
		color: var(--muted);
		font-family: var(--font-display);
		font-size: var(--fs-xl);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-tight);
		white-space: nowrap;
		cursor: pointer;
		transition: color var(--t-quick);
	}
	.tb-nav-item:hover:not(.active):not(:disabled) {
		color: var(--ink-active);
	}
	/* Unreachable, not merely unpressed — see `compareReady`. Kept legible
	   enough to read as a place you could get to, unlike .btn:disabled's 0.3.
	   ↻ ⚓ NATE 2026-08-11: the cursor goes to HELP, not default. The `title`
	   already explains why you can't get here; `default` is the cursor for dead
	   space and gives no reason to wait for it, where a question mark says "this
	   has an explanation" the instant you arrive. Same idiom as the coverage
	   chips and the lead pills — cursor:help wherever the answer is in a tooltip.
	   ⚠ This works only because .tb-nav-item is NOT a .btn. The global
	   `.btn:disabled` sets `pointer-events: none`, which would kill the cursor
	   AND the title together — so if this ever adopts .btn, the tooltip goes
	   with it and the affordance has to move to a wrapper. */
	.tb-nav-item:disabled {
		opacity: 0.45;
		cursor: help;
	}

	/* THE SELECTED PLATE. It CLAIMS .ctx-light rather than naming a light token,
	   which is the same move AtlasView's cards make and for the same reason: it
	   paints its own opaque light ground, so the ink ladder and the ACCENT RUNG
	   flip with it — gold-400 measures 1.48:1 on this paper, gold-700 is what
	   .ctx-light resolves --accent to, and the edge below depends on that.

	   ↻ ⚓ NATE 2026-08-10: the plate is PARCHMENT-100 now, via --sel-surface —
	   "the unified character-card-sharing parchment value". It is literally the
	   paper a character card is made of rather than a near-miss beside it, and
	   it takes the light family off the gold ramp: the plate was gold-300, so
	   selection and jewelry were sharing a hue for no reason. Gold keeps the
	   EDGE; paper keeps the FILL.

	   ⚠ THE EDGE IS THE FAMILY'S, WITH NO LOCAL STRENGTH. The gold-edge reasoning
	   started on this plate and then generalised into the whole --inset-line
	   family (see app.css), so what is left here is nothing: it takes the
	   context's own stop. ⚓ Nate on the 42% mix that lived here — "an unwanted
	   artifact of the development process, not a line strength to be preserved".
	   It came from a round where this was the only gold edge in the system and
	   had to carry the idea by itself; it does not any more. */
	.tb-nav-item.active {
		background: var(--sel-surface);
		color: var(--sel-ink);
		/* ⚠ --frame-inset only. The 1.5px stroke this used to declare IS the
		   family default now (⚓ Nate: 1.5px for small elements, 2px for large
		   panels), so the override retired rather than being restated. 7px of
		   inset is still wrong here — it would put the line through the type. */
		--frame-inset: 3px;
	}

	/* Rests as a peer of every other band plate and only announces itself under
	   the hand — see the markup note on why this is not .btn--danger. */
	.tb-clear:hover:not(:disabled) {
		color: var(--ui-danger);
	}

	/* ── Compare plate's avatar stack (the accumulator's live feedback) ──
	   Side avatars in 24px circles overlapping 8px, the Saved-Rotations stack
	   at promoted-tab scale; border tinted per element, width set inline from
	   the pick count. */
	.tb-tabstack {
		position: relative;
		height: 24px;
		flex-shrink: 0;
	}
	/* ⚓ NATE 2026-08-11, with screenshots: transparent avatars on the Compare TAB
	   — and the same disc turning parchment once the tab is selected. One root
	   cause, and it is the sharpest example in the codebase of why a portrait
	   backing may not name a context-following role.

	   It was `background: var(--surface)`, itself a fix (the comment records the
	   stray #131c30 it replaced). Right instinct, wrong role: --surface FOLLOWS
	   its context, and this disc rides a plate that changes context underneath
	   it. In band B's .ctx-glass, --surface is --glass-panel at .58 — hence stars
	   through the avatars. Selected, the plate CLAIMS .ctx-light for --sel-surface
	   (see THE SELECTED PLATE below), so --surface becomes parchment-100 — hence
	   the light disc. Two symptoms, one token, and the hex it replaced was
	   accidentally righter than the role that replaced it.

	   ⚠ THE RULE THIS SETTLES: a portrait backing is an OPAQUE OBJECT, not a
	   layer of its surroundings. It claims .ctx-dark and takes the element wash,
	   like every other character portrait on the site. The context claim is the
	   load-bearing half — without it this disc would resolve to --glass-well and
	   parchment-200 in exactly the same two places. */
	.tb-tabstack-circle {
		position: absolute;
		top: 0;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 1.5px solid var(--el-color, var(--border));
		background: color-mix(in srgb, var(--el-color) 26%, var(--surface-well));
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
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--muted);
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
		font-size: var(--fs-xs);
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
		font-size: var(--fs-sm);
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
		font-size: var(--fs-md);
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
	/* Same correction as .tb-slotrow-avatar, from a different starting point: a
	   raw rgba(0,0,0,.5) rather than a token. Half-black over an unknown ground
	   is the alpha-compositing law's own counter-example — the result depended on
	   whatever the audition strip happened to be sitting on. */
	.tb-cand-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		overflow: hidden;
		background: color-mix(in srgb, var(--el-color) 26%, var(--surface-well));
		flex-shrink: 0;
	}
	.tb-cand-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.tb-cand-initials {
		font-size: var(--fs-xs);
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
	/* ⚓ NATE 2026-08-10: the Atlas breathes too. With the lead line and the
	   citation gone the four cards were the section's whole content and they
	   started flush against the band above and the scroller's edge below —
	   sentences had been doing the spacing's job. padding-block does it now,
	   and the same 0.8rem still separates the drill's rows from each other. */
	/* flex:1 + min-height:0 so the cards view can hand its grid a definite
	   height to fill (see the markup note). Inert on the drill and slots views —
	   their .tb-source is content-height, and flex:1 against an indefinite
	   parent grows nothing. */
	.tb-atlas {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		padding-block: 0.5rem 0.75rem;
		gap: 0.8rem;
	}
	/* ⚠ ON THE SCENE, PROSE TAKES THE BRIGHT INK — not the muted rung.
	   This was --muted, which is right for secondary text INSIDE a panel: the
	   panel supplies a flat ground and its own hierarchy to be secondary within.
	   On open ground there is neither. Measured, --muted's WORST pixel under
	   this run came to 4.70:1 — it passes 4.5:1, with 0.2 to spare, against a
	   backdrop that varies by ΔL 0.15 along the line. Genshin's on-backdrop
	   prose is bright for exactly this reason; the dim rung is a panel
	   affordance. Size comes up a step too: text on open ground carries no box
	   to lend it presence, so it has to carry its own. */
	.tb-atlas-lead {
		margin: 0;
		font-size: var(--fs-lg);
		color: var(--text);
	}
	/* PINNED — it lives in .tb-sourcebox, above the scroller, not inside it.
	   flex: none because the box it now sits in is a flex column that shrinks:
	   without it a tall drill title would be the first thing squeezed when the
	   window gets short, which is exactly backwards for the row carrying the way
	   back out. */
	.tb-atlas-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		flex: none;
	}
	/* ── RP-arrival slot rows ─────────────────────────────────── */
	/* ⛔ THE HAIRLINE IS GONE (⚓ NATE 2026-08-11). It marked where a row began;
	   the header plate now does that far more plainly, and a rule above a plate
	   says the same thing twice. On the open scene two weak signals read worse
	   than one clear one. */
	.tb-slotrow {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	/* ⚓ NATE 2026-08-11 — A GLASS PANE, not a night scrim. These row headers sit
	   directly on the dimmed scene (the TB surface has had no frame since
	   2026-08-08), and the first attempt made them the debut consumer of
	   `.night-ribbon` — which was the right FAMILY and the wrong member: ⚓ "the
	   dark panel is interesting and may get a use somewhere, but this one doesn't
	   quite cut it." So they take --glass-panel, the same material as the band
	   plates above them, which also makes the tool read as one set of surfaces
	   rather than two.
	   ✅ AND IT SETTLES THE INK QUESTION THE SCRIM LEFT OPEN. A night paint
	   carries no ink ladder by law, so the count had to sit at --text and recede
	   by size alone. Glass is a MATERIAL WITH A LADDER — --muted clears its floor
	   on the panel stop (4.74:1 against a star, measured in app.css) — so the
	   second voice comes back, and by the right mechanism. */
	.tb-slotrow-head {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.45rem 0.8rem;
		border-radius: var(--r-sm);
		background: var(--surface);
	}
	/* Up with the name — an 18px heading beside a 30px portrait read as a label
	   stuck to a chip; 34 keeps the portrait the row's anchor. */
	.tb-slotrow-avatar,
	.tb-slotrow-initials {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		flex: none;
	}
	/* ── The disc behind these avatars ────────────────────────────────────────
	   ↻ 2026-08-11: they were `background: var(--bg)` — the PAGE ground, and the
	   last two instances of the reach this round set out to remove (the bench's
	   backing and the roster card's portrait were the other two). Here it was
	   worse than off-ramp: these sit ON A GLASS PLATE, so a disc borrowing the
	   colour of the world outside the tools was painting a hole through a pane.

	   They take the element wash instead, which makes EVERY character portrait
	   on the site one recipe — the bench's 68px disc, the roster card's square,
	   and these. Flat rather than a gradient: at 34px a two-stop ramp has ~17px
	   to travel in and reads as a single muddy tone, so this is just the wash's
	   tinted end.
	   ⚠ .ctx-dark is CLAIMED on the disc, and it is doing real work: --surface-
	   well in ctx-glass is --glass-well, i.e. TRANSLUCENT, and the band-plates
	   round's rule is that alpha stacks — glass on glass is not a ground. The
	   flip gives the mix a real opaque rung to sit on, which is the same reason
	   .cc-portrait claims it. */
	.tb-slotrow-avatar,
	.tb-slotrow-initials {
		background: color-mix(in srgb, var(--el-color) 26%, var(--surface-well));
	}
	.tb-slotrow-avatar {
		object-fit: cover;
	}
	.tb-slotrow-initials {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
	}
	/* ↻ ⚓ NATE 2026-08-11: --fs-lg → --fs-2xl. "The font sizes in those headers
	   can probably go up" — and two rungs rather than one, because the job
	   changed with the ground. This was dense-body-sized when it labelled a row
	   inside a framed panel; it is now the heading of a block standing on the
	   world, and content on open ground has to carry its own presence (the same
	   argument .banner makes for sitting a rung above .kicker). It still lands a
	   clear step below the Atlas header above it at 4xl. */
	.tb-slotrow-name {
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
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
	/* ↻ 2026-08-11: --fs-xs → --fs-md with the header. The ink stays --muted, and
	   the reason is worth a line because it briefly wasn't: while the header was
	   a night scrim this had to be --text, since a night paint carries no ink
	   ladder by law. On glass it does — the panel stop clears 4.74:1 for --muted
	   against a star — so the count can recede by INK again rather than by size
	   alone. Choosing the material chose the ladder. */
	.tb-slotrow-count {
		margin-left: auto;
		font-size: var(--fs-md);
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
	}
	.tb-slotrow-name--el {
		text-transform: capitalize;
	}
	.tb-drill-elicon {
		width: 22px;
		height: 22px;
		object-fit: contain;
		flex: none;
	}

	/* Drill header (← All roles + the drilled card's glyphs/label) */
	.tb-drill-title {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--font-display);
		font-size: var(--fs-xl);
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
	   is how the TB keeps its own tile scale without the planner's picker
	   changing. (--cg-rail-w went with the rail: the filter column's width is
	   ASIDE_W, one knob for both tools, in $lib/toolColumns.) */
	.tb-roster {
		display: flex;
		flex: 1;
		min-height: 0;
		min-width: 0;
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
		font-size: var(--fs-sm);
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
		font-size: var(--fs-md);
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
		font-size: var(--fs-lg);
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
	   Compare). The card owns the reveal + positioning; these are the contents.

	   ⚓ NATE 2026-08-11: "the hover buttons are all wrong — wrong colors." They
	   were, and by one mistake made three times: every state mixed against
	   `--bg`. That is the PAGE ground, a near-black that belongs to the world
	   outside the tools — so a control living on a parchment card painted itself
	   a dark translucent slab, and the accent mixes on top of it ("gold 18% of
	   near-black") came out as mud rather than gold. The card is ctx-light and
	   the light context already owns a full set of control roles for exactly
	   this; they are what it wears now, so the buttons follow the paper through
	   any future ground change instead of being pinned to a hex three contexts
	   away.
	     rest   --fill-rest      + ink border  + --muted ink  (a quiet control)
	     hover  --accent-hover-fill + gold edge + --ink-active (the promoted ink)
	     on     --sel-fill       + --sel-ring  + --ink-active (standing state)
	   ⚠ --fill-rest / --sel-fill / --accent-hover-fill all mix toward
	   TRANSPARENT, and the alpha-compositing law says a fill needs a real ground:
	   theirs is .cc-actions, which is opaque --surface. That is why the overlay
	   had to stop being 90%. */
	.tb-act {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		padding: 0.2rem;
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		background: var(--fill-rest);
		color: var(--muted);
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
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}
	.tb-act:hover:not(:disabled) {
		border-color: var(--sel-ring);
		background: var(--accent-hover-fill);
		color: var(--ink-active);
	}
	.tb-act--on {
		border-color: var(--sel-ring);
		background: var(--sel-fill);
		color: var(--ink-active);
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
