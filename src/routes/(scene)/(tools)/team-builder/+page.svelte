<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { claimVeilReady, afterPaint } from '$lib/landing/veilReady';
	import { getAllCharacterIndex, getCharacterIndexEntry } from '$lib/data/characterLookup';
	import {
		constellations,
		siteSettings,
		ownership,
		loadout,
		savedBoards,
		savedNotations
	} from '$lib/stores';
	import { swapFramesForPing } from '$lib/utils/frames';
	import { readRotationSwap, type RotationRead } from './lib/auditionRotation';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { warmAvatars } from '$lib/utils/warmAvatars';
	import {
		FACETS,
		OWNERSHIP_VIEWS,
		conCapFor,
		facetBadges,
		splitRoster,
		type ConMode,
		type FacetKey,
		type OwnershipView
	} from './lib/facets';
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
	import { rotationTabs as rt } from '$lib/rotationTabs.svelte';
	import { documentBar } from '$lib/documentBar.svelte';
	import { boards, pinnedRotation, type BoardPreset, type BoardTeam } from '$lib/boards.svelte';
	import { boardBar, boardTabStrip } from '$lib/boardBar.svelte';
	import { library } from '$lib/library.svelte';
	import { currentSeason } from '$lib/endgame';
	import { decodeBoard } from '$lib/utils/boardUrl';
	import { BOARD_W, DOCK_GAP, FOLD_LENS_W, FOLD_SHOW_W, TB_WIPE_MS } from './lib/dock';
	import { motion } from '$lib/motion';
	import { below } from '$lib/media.svelte';
	import ToolStack from '$lib/components/ToolStack.svelte';
	import { scrollFade } from '$lib/actions/scrollFade';
	import DocumentTabs from '$lib/components/DocumentTabs.svelte';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import CharacterCard, { type TagChip } from '$lib/components/CharacterCard.svelte';
	import CharacterGrid, { type GridSection } from '$lib/components/CharacterGrid.svelte';
	import type { GridFilters } from '$lib/characterFilters';
	import DetailCard from '$lib/components/DetailCard.svelte';
	import CompareView from './lib/CompareView.svelte';
	import BoardView from './lib/BoardView.svelte';
	import RosterFilterStrip from './lib/RosterFilterStrip.svelte';
	import MoreFilters from './lib/MoreFilters.svelte';
	import { buildRoleSections, categoryOf } from './lib/atlas';
	import type { RoleCategory, RoleFilter } from './lib/roles';
	import { characterRoles } from '$lib/data/characterRoles.generated';
	import type { RolePosition, RoleFunction, CharacterIndexEntry } from '$lib/types/character';
	import { getAvatarFallback, hasAvatar } from '$lib/utils/getAvatar';
	import { MAX_COMPARE, lensFacet, type CapRowKey } from './lib/compare';
	import { facetsProvidedBy, parseTeamParam, teamDelta, type TeamSlot } from './lib/team';
	import { stripDeepLinkParams } from '../lib/deepLinkUrl';

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
	//
	// The team itself is the shared WORKING TEAM now (the planner's active
	// tab) — no URL mirroring, no cross-tool injection. Two inbound params
	// remain, both stripped after reading:
	// - ?team=a,b,c,d — an external deep link: imports the team into a tab
	//   (pristine-tab reuse rules), same as the planner's own ?team=.
	// - ?alts=1 — the planner's "← Explore alternatives" hand-off: the team is
	//   already here, so the link only asks for the per-slot alternatives view.
	//   ⛔ The chip that sent it is RETIRED (2026-08-13); the param is kept
	//   because it is a shareable URL like any other and costs one branch.
	// - ?swap=N — the planner's bench ⇄ (Source retirement, 2026-08-13): audition
	//   slot N. The team does not travel — it IS the shared working team — so the
	//   slot index is the entire payload.
	afterNavigate((nav) => {
		const url = nav.to?.url;
		if (!url || !url.pathname.endsWith('/team-builder')) return;
		const teamParam = url.searchParams.get('team');
		const altsParam = url.searchParams.get('alts');
		const swapParam = url.searchParams.get('swap');
		const boardParam = url.searchParams.get('b');
		if (!teamParam && !altsParam && !swapParam && !boardParam) return;
		// ⛔ Not $app/navigation's replaceState — see stripDeepLinkParams. This is
		// the call site that carried NO reason at all, and `?swap=` arrives here
		// cold from a shared audition link.
		stripDeepLinkParams(url);
		if (teamParam) {
			const imported = parseTeamParam(teamParam, (id) => rosterIds.has(id));
			const ids = imported.filter((s): s is string => s !== null);
			// ↻ 2026-10-08: onto the ACTIVE BOARD (§9.7), not into a rotation tab —
			// the Builder's document is the board now.
			if (ids.length > 0) {
				boardBar.receiveTeam(ids);
				showLineup();
			}
		}
		if (boardParam) {
			// A shared lineup (`?b=`). Async decode; an empty active board takes it,
			// else a new tab (with the make-room confirm at the limit).
			void decodeBoard(boardParam).then((shared) => {
				if (!shared) {
					documentBar.showNotice('Invalid share link');
					return;
				}
				boardBar.receive(shared, (id) => rosterIds.has(id));
				showLineup();
			});
			return;
		}
		if (swapParam !== null) {
			// Validated, not trusted: this is a URL, so anyone can type ?swap=9.
			const n = Number(swapParam);
			if (Number.isInteger(n) && n >= 0 && n < rt.slots.length) {
				pendingSwapSlot = n;
				fromPlanner = true;
				// The audition is BOARD-LESS (§10.3): it edits the Planner's team.
				// ⏳ It renders in the roster column until swap mode replaces it
				// (step 5) — a temporary casualty, §11.6 item 9.
				tab = 'characters';
			}
			// A swap errand does NOT want the Atlas below — it wants ONE slot's
			// audition, which the effect opens as soon as the tabs are restored.
			return;
		}
		// A team arrival (either other param) opens the Roster, the team above it.
		// ↻ 2026-10-07: it used to open the Atlas's per-slot "alternatives" view,
		// which retired into the audition — ⇄ on a bench card asks the same
		// question with that slot's own facets, and the constellation lens.
		sourceTab = 'roster';
	});

	// ---------------------------------------------------------------------------
	// THE PARTY SETUP SHAPE (design doc §11.2, build step 1)
	//
	// ⚓ The board is DOCKED on the right at a fixed width, where Genshin's
	// endgames always put it; the roster column is the only thing that grows and
	// shrinks, so the board's layout can be made stable. No view switch and no
	// wipe on a wide screen — the old Roster | Roster + board control kept the
	// ROSTER as the subject, and the thing you build was its add-on.
	// Below the dock the two are TABS — Characters | Lineup — and the board
	// slides in over the roster. Both panes stay MOUNTED while hidden, so each
	// keeps its scroll and filters.
	// ---------------------------------------------------------------------------

	type PaneTab = 'characters' | 'lineup';
	let tab = $state<PaneTab>('characters');
	/** Below the dock the panes are tabs. ⚠ The literal is in the CSS too
	 *  (`@media (max-width: 71rem)`) — custom properties can't reach a query. */
	const tabbed = $derived(below('wide'));
	/** Which pane is showing — on a wide screen, both. */
	const showing = $derived<'both' | PaneTab>(tabbed ? tab : 'both');

	/** Show the lineup — a no-op beside the dock, the tab below it. */
	function showLineup(): void {
		tab = 'lineup';
	}

	/** The cold start below the dock: a board with anyone on it opens on the
	 *  Lineup, an empty one on the Characters it is waiting for. Runs once —
	 *  after that, the tab is the reader's. */
	let tabSeeded = false;
	$effect(() => {
		if (tabSeeded || !boards.restored || !mounted) return;
		tabSeeded = true;
		if (pendingSwapSlot === null && !fromPlanner && boardHasAnyone) tab = 'lineup';
	});

	/** The character cell's width in band B — it folds Show, then the lens,
	 *  into More when the cell runs out (`FOLD_*_W`, lib/dock). 0 before the
	 *  first measure, so the first paint is the folded one. */
	let charCellW = $state(0);
	const foldShow = $derived(charCellW < FOLD_SHOW_W);
	const foldLens = $derived(charCellW < FOLD_LENS_W);

	// ── The board ─────────────────────────────────────────────────────────────

	const board = $derived(boards.activeBoard);
	const boardHasAnyone = $derived(board.teams.some((t) => t.slots.some((s) => s !== null)));
	/** Linked to a saved board that still exists (Save → Save changes). */
	const boardLinked = $derived(!!board.savedId && $savedBoards.some((b) => b.id === board.savedId));

	/** THE TEAM the roster's picks fill (Nate 2026-10-09, the game's own model):
	 *  a ROW is selected, never a slot, and picks land in its earliest empty
	 *  slot in the order clicked. `chosenTeamId` is the reader's click; with
	 *  none, the selection FOLLOWS the board — the first team with room, else
	 *  the first — so four picks fill a team and the fifth starts the next.
	 *  ⚠ The library places only into a CHOSEN team: a default is not a
	 *  request to replace someone's lineup. */
	let chosenTeamId = $state<string | null>(null);
	$effect(() => {
		if (chosenTeamId && !board.teams.some((t) => t.id === chosenTeamId)) chosenTeamId = null;
	});
	const selectedTeam = $derived(
		board.teams.find((t) => t.id === chosenTeamId) ??
			board.teams.find((t) => t.slots.includes(null)) ??
			board.teams[0]
	);
	/** A pick that found the team full — the card's button and the row shake
	 *  once (a nudge, ⛔ never a dialog). */
	let nudge = $state<{ id: string; at: number } | null>(null);
	$effect(() => {
		if (!nudge) return;
		const t = setTimeout(() => (nudge = null), 600);
		return () => clearTimeout(t);
	});

	/** A pick lands in the selected team's EARLIEST empty slot. Returns
	 *  whether that filled the team, or null when it was already full (the
	 *  nudge). ⚓ A character on ANOTHER team is not moved: repeats are allowed
	 *  and marked (`Board.noRepeats`). */
	function placeOnBoard(id: string): boolean | null {
		const team = selectedTeam;
		if (!team) return null;
		const i = team.slots.indexOf(null);
		if (i < 0) {
			nudge = { id, at: Date.now() };
			return null;
		}
		boards.setSlot(board.id, team.id, i, id);
		return team.slots.filter((s) => s === null).length === 1;
	}

	/** Out of the SELECTED team, leaving its slot empty — the others keep
	 *  their places, as in the game, and the next pick fills the gap. */
	function removeFromBoard(id: string): void {
		const team = selectedTeam;
		const i = team?.slots.indexOf(id) ?? -1;
		if (team && i >= 0) boards.setSlot(board.id, team.id, i, null);
	}

	/** Open a team in the Planner: its pinned rotation, else its bare names
	 *  (§10.2). Either opens in a NEW tab, so nothing open is replaced. */
	function openInPlanner(team: BoardTeam): void {
		const pinned = pinnedRotation(team, $savedNotations);
		if (pinned) documentBar.loadNewTab(pinned);
		else {
			const ids = team.slots.filter((s): s is string => s !== null);
			documentBar.receive(
				{ ...rt.teamDocument(ids, board.label), tabCon: { ...(team.con ?? {}) } },
				'Team opened'
			);
		}
		void goto(resolve('/rotation-planner'));
	}

	/**
	 * THE LIBRARY'S TARGET (§10.1a): opened from here, a library pick puts its
	 * team on THIS board — the selected team if there is one (a rotation
	 * pinned), else the first empty team, else a new one. Registered while the
	 * page is mounted; `selectedLabel` is read live, so the library's hover hint
	 * follows the selection.
	 */
	onMount(() =>
		library.registerTarget({
			get selectedLabel() {
				if (!chosenTeamId) return null;
				const i = board.teams.findIndex((t) => t.id === chosenTeamId);
				return i >= 0 ? `Team ${i + 1}` : null;
			},
			place(slots, pinnedRotationId) {
				const target =
					board.teams.find((t) => t.id === chosenTeamId) ??
					board.teams.find((t) => t.slots.every((s) => s === null)) ??
					// A battlefield board's teams are the game's — only Custom grows.
					(board.preset === 'custom' ? boards.addTeam(board.id) : undefined);
				if (!target) {
					documentBar.showNotice('The board is full');
					return;
				}
				boards.setTeam(board.id, target.id, slots);
				if (pinnedRotationId) boards.pin(board.id, target.id, pinnedRotationId);
				chosenTeamId = null;
				showLineup();
			}
		})
	);

	const PRESETS: { key: BoardPreset; label: string; hint: string }[] = [
		{ key: 'stygian', label: 'Stygian Onslaught', hint: 'Three teams' },
		{ key: 'abyss', label: 'Spiral Abyss', hint: 'Two teams' },
		{ key: 'custom', label: 'Custom', hint: 'One team, add more as you go' }
	];

	function newBoard(preset: BoardPreset): void {
		// ↻ §11.6: no season is stored — a new Stygian lineup FOLLOWS the season
		// running now until its first edit pins it (the effect below).
		boardBar.newBoard(preset);
		chosenTeamId = null;
	}

	/** ⚓ An UNTOUCHED Stygian board follows the game's season; an edited one
	 *  never changes under you (§11.6 item 4). The first character placed pins
	 *  the season the reader was looking at. */
	$effect(() => {
		if (board.preset !== 'stygian' || board.season || !boardHasAnyone) return;
		const v = currentSeason()?.version;
		if (v) boards.setSeason(board.id, v);
	});

	// ---------------------------------------------------------------------------
	// THE PLANNER'S SWAP ERRAND (Source retirement, 2026-08-13)
	//
	// The planner has no character grid of its own any more: ⇄ on a bench card
	// sends the slot here, because an audition can pin the incumbent and compare
	// against it and the planner's picker could only ever fill the lowest empty
	// slot. Two flags, because they answer two different questions:
	// ---------------------------------------------------------------------------

	/** Arrived on an errand — drives the "Back to planner" plate. Deliberately
	 *  lives for the whole VISIT: cancelling an audition means "let me look
	 *  around", not "I no longer came from the planner", and the way back must
	 *  not evaporate at the moment it becomes the only way back. */
	let fromPlanner = $state(false);

	/** Does committing THIS audition return to the planner? Scoped to the one
	 *  audition the errand opened — cancel and commit both discharge it. Without
	 *  the scope, a commit two auditions later would yank you out of a tool you
	 *  had decided to stay in. */
	let returnOnCommit = $state(false);

	/** The slot to audition once the document is actually here. */
	let pendingSwapSlot = $state<number | null>(null);

	// ⚠ NOT DONE IN afterNavigate, and the gate is the whole point (same shape as
	// the planner's warm effect): the tabs are restored by the (tools) LAYOUT's
	// onMount, and on a COLD load of /team-builder?swap=2 the param is read
	// before that happens — so the slot would read 'blank' and the errand would
	// silently degrade to "open the Roster" for a team that does have someone in
	// it. Depending on `restored` is right whichever way the ordering falls; on
	// SPA arrival from the planner it is already true and this runs immediately.
	// `mounted` joins it because openAudition seeds its facet chips from the
	// roster constellations, which are localStorage-backed.
	$effect(() => {
		if (pendingSwapSlot === null || !rt.restored || !mounted) return;
		const slot = pendingSwapSlot;
		pendingSwapSlot = null;
		const incumbent = rt.slots[slot];
		if (incumbent && incumbent !== 'blank') {
			openAudition(slot, incumbent);
			returnOnCommit = true;
		} else {
			// No incumbent to audition against — the same fall-through the bench's
			// own ⇄ takes for an empty slot. There is no commit to return on: a
			// roster add is freeform, so the plate is the way back.
			selectedId = null;
			sourceTab = 'roster';
		}
	});

	const preferNewfit = $derived(mounted && $siteSettings.useNewOutfits);
	const traveler = $derived(mounted ? $siteSettings.travelerVariant : 'aether');

	// ---------------------------------------------------------------------------
	// Source panel: Roster (the finder) ⇄ Compare
	//
	// ⚓ 2026-10-07 (Nate, the Team Builder round): TWO surfaces, not three. The
	// Atlas, the Roster and the audition's candidate strip were three finders
	// answering "who could do this?" with three sets of rules, and each tab felt
	// thin on its own. The Atlas's role cards are the Roster's front door now
	// and its drill-down the Roster's sections; the audition asks the same
	// pipeline (`splitRoster`).
	// ---------------------------------------------------------------------------

	type SourceTab = 'roster' | 'compare';

	let sourceTab = $state<SourceTab>('roster');
	// Sticky: flips true on first Roster visit and stays — the roster grid is
	// then kept mounted (CSS-hidden) across tab toggles. See the template note.
	let rosterEverShown = $state(false);
	$effect(() => {
		if (sourceTab === 'roster') rosterEverShown = true;
	});

	// (Compare's reachability gate lives with the compare state, further down.)

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

	// Editorial role filters (Position / Function), set by the filter bar's four
	// role icons — each one a category (`openCategory`). Roles join the roster
	// by id.
	const rolePosition = new SvelteSet<RolePosition>();
	const roleFunction = new SvelteSet<RoleFunction>();
	const rolesOf = (id: string) => characterRoles[id];

	// ── The bar's role icons ARE the role filter (↻ §11: the Atlas cards retired
	// into them) ───────────────────────────────────────────────────────────
	/** The card the role filter currently is, if it is exactly one. */
	const activeCategory = $derived(categoryOf(rolePosition, roleFunction));

	/** Picking a card sets the role filter to it; picking the active card again
	 *  clears it. The rail's role chips edit the same two sets, so a card and
	 *  its chips can never disagree. */
	function openCategory(cat: RoleCategory): void {
		const same = activeCategory?.key === cat.key;
		rolePosition.clear();
		roleFunction.clear();
		if (same) return;
		if (cat.position) rolePosition.add(cat.position);
		roleFunction.add(cat.function);
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
			{
				identity: filters,
				facets: activeFacets,
				ownershipView,
				roles: { position: rolePosition, function: roleFunction, rolesOf } satisfies RoleFilter
			},
			(id) => conCapFor(conMode, cons[id]),
			(id) => own[id]
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

	/** Under an active role card the grid is SECTIONED — the old drill-down,
	 *  over whatever the other filters let through. Flat otherwise. */
	const rosterSections = $derived.by((): GridSection[] | undefined => {
		if (!activeCategory) return undefined;
		const cons = mounted ? $constellations : {};
		return buildRoleSections(activeCategory, split.matches, rolesOf, (id) =>
			conCapFor(conMode, cons[id])
		);
	});

	const ownsAny = $derived(mounted && Object.values($ownership).some((v) => v === 'owned'));

	// A tile fades when it's a not-owned character shown among owned ones: in the
	// 'all' view once the user owns anything (Genshin-collection style).
	function tileFaded(id: string): boolean {
		if (!mounted) return false;
		return ownsAny && ownershipView === 'all' && $ownership[id] !== 'owned';
	}

	/** How many choices are hidden inside More — its plate says so, or a
	 *  filter you set and closed would be invisible. */
	const moreCount = $derived(
		filters.weapons.size +
			filters.rarities.size +
			(filters.region ? 1 : 0) +
			(filters.factionBuffs?.size ?? 0) +
			activeFacets.size +
			(foldShow && ownershipView !== 'all' ? 1 : 0)
	);

	/** Anything narrowing the roster — lights the strip's Clear. */
	const anyFilterActive = $derived(
		extraFiltersActive ||
			filters.elements.size > 0 ||
			filters.weapons.size > 0 ||
			filters.rarities.size > 0 ||
			filters.region !== '' ||
			filters.search.trim() !== '' ||
			(filters.factionBuffs?.size ?? 0) > 0 ||
			ownershipView !== 'all'
	);
	function clearAllFilters(): void {
		filters.elements.clear();
		filters.weapons.clear();
		filters.rarities.clear();
		filters.factionBuffs?.clear();
		filters.region = '';
		filters.search = '';
		ownershipView = 'all';
		clearExtraFilters();
	}
	/** The lens the count was read at — said only while facets are asked. */
	const countNote = $derived(
		activeFacets.size === 0
			? undefined
			: conMode === 'mine'
				? 'at your constellations'
				: conMode !== 'c0'
					? `at ${conMode.toUpperCase()}`
					: undefined
	);

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
	/** The comparison an audition interrupted. An audition scopes the selection
	 *  to itself, which used to mean it DESTROYED whatever you were building —
	 *  three characters lined up, one bench ⇄, and they were gone with no undo.
	 *  Stashed on open, put back on commit or cancel. */
	let stashedCompare: string[] = [];
	/** The facets the incumbent provides — what this SLOT does, which is what
	 *  seeds the audition's lens. */
	let auditionSeedFacets = $state<{ key: FacetKey; label: string }[]>([]);
	/** The currently-active subset, driven by CompareView's lens chips — ONE
	 *  control doing two jobs: it groups the chart AND narrows the candidates.
	 *  Toggleable so an over-narrow AND of every seed facet can be relaxed. */
	const auditionFacets = new SvelteSet<FacetKey>();
	/** The ELEMENT fallback's selection — populated only when the incumbent has
	 *  no facet to match on (a main DPS). See CompareView's note. */
	const auditionElements = new SvelteSet<string>();
	/** Where commit/cancel returns to. (One place now — the Roster.) */
	const auditionReturnTab: SourceTab = 'roster';

	function toggleCompare(id: string): void {
		if (id === anchorId) return; // the audition anchor stays pinned
		if (compareIds.has(id)) {
			compareIds.delete(id);
		} else if (compareIds.size < MAX_COMPARE) {
			compareIds.add(id);
		}
	}

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
		compareIds.clear(); // the audition selection is scoped…
		for (const id of stashedCompare) compareIds.add(id); // …and gives back what it borrowed
		stashedCompare = [];
		anchorId = null;
		auditionSlot = null;
		auditionSeedFacets = [];
		auditionFacets.clear();
		auditionElements.clear();
	}

	/** Audition replacements for a filled slot: pin the incumbent as the anchor
	 *  and open the Compare tab, whose in-view candidates strip suggests
	 *  characters covering the facets the incumbent provides. */
	function openAudition(index: number, incumbentId: string): void {
		// Re-auditioning from inside an audition must not stash the audition's own
		// scoped selection over the comparison it is already holding for you.
		if (anchorId === null) stashedCompare = [...compareIds];
		compareIds.clear();
		compareIds.add(incumbentId);
		anchorId = incumbentId;
		auditionSlot = index;
		const cap = conCapFor(conMode, mounted ? ($constellations[incumbentId] ?? 0) : 0);
		const entry = getCharacterIndexEntry(incumbentId);
		// ⚠ Labels come from FACETS, the same source the Roster rail reads, so the
		// audition's chips cannot drift from the wording used to find characters
		// everywhere else on this tool.
		auditionSeedFacets = entry
			? [...facetsProvidedBy(entry, cap)].map((key) => ({
					key,
					label: FACETS.find((f) => f.key === key)?.label ?? key
				}))
			: [];
		auditionFacets.clear();
		for (const f of auditionSeedFacets) auditionFacets.add(f.key);
		// The element fallback seeds itself in CompareView (it owns the decision
		// about which vocabulary is on offer); this only has to start clean.
		auditionElements.clear();
		selectedId = null;
		sourceTab = 'compare';
	}

	/** Commit an audition candidate into its slot, then return whence you came —
	 *  which is the TOOL you came from when the planner sent the errand, and the
	 *  tab you were on otherwise. */
	function commitAudition(candidateId: string): void {
		if (auditionSlot !== null) rt.setSlot(auditionSlot, candidateId);
		const goBack = returnOnCommit;
		returnOnCommit = false;
		endAudition();
		sourceTab = auditionReturnTab;
		// The slot is already written — the working team is shared state, not
		// something the navigation carries — so the planner redraws with the new
		// character on arrival.
		if (goBack) void goto(resolve('/rotation-planner'));
	}

	/** The errand's way back. Leaves the team exactly as it is — the working team
	 *  is shared state, so nothing needs carrying. */
	function backToPlanner(): void {
		void goto(resolve('/rotation-planner'));
	}

	function cancelAudition(): void {
		// Cancelling discharges the auto-return but NOT the errand: you are still
		// someone who arrived from the planner, and the plate stays put.
		returnOnCommit = false;
		endAudition();
		sourceTab = auditionReturnTab;
	}

	/**
	 * CompareView's lens changed — re-point the candidate filter at it.
	 *
	 * ⚠ The two vocabularies overlap but are not identical, so `lensFacet` drops
	 * what has no facet (`summon`, `buff:other`). One consequence worth knowing:
	 * a facet the incumbent provides that the CHART cannot draw (an instant heal
	 * has no window, so no lane) is not offered as a chip and so stops narrowing
	 * the candidate list. That loosens the search slightly — in the same
	 * direction as the fix that made these chips toggleable in the first place
	 * (⚓ Nate: the AND of every provided facet went near-empty).
	 */
	function applyAuditionLens(keys: CapRowKey[]): void {
		auditionFacets.clear();
		for (const key of keys) {
			const facet = lensFacet(key);
			if (facet) auditionFacets.add(facet);
		}
	}

	/**
	 * Candidates for the audition strip: everyone outside the team who covers ALL
	 * currently-active facets at the mode's constellation cap.
	 *
	 * ⚓ …or, when the slot has no facet to match on (a main DPS — see
	 * CompareView's element-fallback note), everyone outside the team of the
	 * selected ELEMENT. The two filters are alternatives, never both: only one
	 * chip vocabulary is ever on offer, so only one of these sets is ever
	 * populated.
	 */
	const auditionCandidates = $derived.by(() => {
		if (anchorId === null) return [] as CharacterIndexEntry[];
		const cons = mounted ? $constellations : {};
		const own = mounted ? $ownership : {};
		// ⚓ The SAME finder the Roster grid runs (2026-10-07) — it used to be its
		// own loop that ignored ownership. Owned candidates first, when you have
		// told the tool what you own.
		return splitRoster(
			roster,
			{
				identity: { ...NO_IDENTITY, elements: auditionElements },
				facets: auditionFacets,
				exclude: new Set([anchorId, ...teamSlots.filter((s): s is string => s !== null)]),
				rank: ownsAny ? 'ownedFirst' : undefined
			},
			(id) => conCapFor(conMode, cons[id]),
			(id) => own[id]
		).matches;
	});

	// ── "In your rotation" (phase 4) ────────────────────────────────────────
	// Each candidate's swap, run through the planner's own parse of the working
	// rotation. Async (the parser loads on demand) and generation-stamped, so a
	// read that lands after the comparison moved on is dropped, not drawn.
	let rotationReads = $state<Record<string, RotationRead | null>>({});
	let readGeneration = 0;
	$effect(() => {
		const incumbent = anchorId;
		const candidates = [...compareIds].filter((id) => id !== incumbent);
		const notation = rt.notation;
		const slots = [...rt.slots];
		// The planner's effective inputs: tab overrides over the roster, its
		// swap ping and human timing — so this reads the rotation the way the
		// planner draws it (⚓ Nate 2026-10-07).
		const cons: Record<string, number> = { ...$constellations, ...rt.tabCon };
		const lo = { ...$loadout };
		for (const [id, entry] of Object.entries(rt.tabLoadout))
			lo[id] = { ...(lo[id] ?? {}), ...entry };
		const swapFrames = swapFramesForPing($siteSettings.swapPing);
		const humanTiming = $siteSettings.humanTiming
			? {
					padFrames:
						$siteSettings.humanTimingMode === 'animations' ? 0 : $siteSettings.humanTimingPadFrames,
					fullAnimations: $siteSettings.humanTimingMode !== 'padding'
				}
			: null;
		const gen = ++readGeneration;
		if (!incumbent || !mounted) {
			rotationReads = {};
			return;
		}
		void Promise.all(
			candidates.map(async (candidateId) => {
				try {
					const read = await readRotationSwap({
						notation,
						slots,
						incumbentId: incumbent,
						candidateId,
						constellations: cons,
						loadout: lo,
						swapFrames,
						humanTiming
					});
					return [candidateId, read] as const;
				} catch (e) {
					// The planner's own parse() swallows a throw the same way: a read
					// that cannot be made is absent, never a broken audition.
					console.error('rotation audition failed:', e);
					return [candidateId, null] as const;
				}
			})
		).then((pairs) => {
			if (gen === readGeneration) rotationReads = Object.fromEntries(pairs);
		});
	});

	/** An identity filter that narrows nothing — the audition's base. */
	const NO_IDENTITY = {
		elements: new Set<string>(),
		weapons: new Set<string>(),
		rarities: new Set<number>(),
		region: '',
		search: ''
	};

	/** What each candidate's swap would change about the TEAM — gained and lost
	 *  capabilities, and the resonance when the party is full. */
	const auditionDeltas = $derived.by(() => {
		if (anchorId === null || auditionSlot === null) return undefined;
		const out: Record<string, ReturnType<typeof teamDelta>> = {};
		for (const id of compareIds) {
			if (id === anchorId) continue;
			const after = members.map((m, i) => (i === auditionSlot ? getCharacterIndexEntry(id) : m));
			out[id] = teamDelta(members, after, coverageCapOf);
		}
		return out;
	});

	/** CompareView's ELEMENT lens changed (the fallback only). */
	function applyElementLens(elements: string[]): void {
		auditionElements.clear();
		for (const el of elements) auditionElements.add(el);
	}

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

	/** The constellation a TEAM member is read at — the tab's own override,
	 *  then the roster's, under the lens. ⚠ Coverage used to skip the lens
	 *  (`tabCon ?? roster`, whatever the menu said), so at "C6" the checklist
	 *  and the grid beneath it answered at two different constellations. */
	const coverageCapOf = (id: string) =>
		conCapFor(conMode, rt.tabCon[id] ?? (mounted ? ($constellations[id] ?? 0) : 0));

	/** A card's team action is about the SELECTED team: in it, or not, or it
	 *  is full ('full' stays clickable — the click is what earns the nudge). */
	const teamStateOf = (id: string): 'in' | 'out' | 'full' =>
		selectedTeam?.slots.includes(id) ? 'in' : selectedTeam?.slots.includes(null) ? 'out' : 'full';

	/** ⚓ The game's toggle: a pick fills the selected team, the same pick again
	 *  frees its slot. Below the dock, the pick that fills the team shows it. */
	function toggleTeam(id: string): void {
		if (selectedTeam?.slots.includes(id)) return removeFromBoard(id);
		const filled = placeOnBoard(id);
		if (filled && tabbed) tab = 'lineup';
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

	// Primary tile click opens the detail card. ⏭ Step 3: the whole card picks
	// and a corner magnifier opens details (§11.2).
	function activate(id: string): void {
		openDetail(id);
	}

	// The old slots→URL mirror is retired with the ?team= injection: the
	// working team lives in the shared tab state (persisted there), and a URL
	// that silently tracked it would imply a share mechanism this page no
	// longer owns. Shareable teams travel through the planner's ⤴ Share link.
</script>

<!-- One roster tile, shared by the roster grid, the "not yet curated" bucket,
     and the Rotation-Planner per-slot alternative rows. -->
{#snippet charTile(entry: CharacterIndexEntry, dimmed: boolean)}
	<CharacterCard
		{entry}
		{preferNewfit}
		{traveler}
		onActivate={activate}
		intent="open"
		con={conMode === 'mine' && mounted ? ($constellations[entry.id] ?? 0) : undefined}
		wishlist={mounted && $ownership[entry.id] === 'wishlist'}
		showUncuratedMark
		tags={tagsFor(entry)}
		accent={compareIds.has(entry.id)}
		faded={tileFaded(entry.id)}
		{dimmed}
		actions={teamActions}
	/>
{/snippet}

<!-- TB-only hover action bar (rendered into the card's overlay shell). -->
{#snippet teamActions(entry: CharacterIndexEntry)}
	{@const teamState = teamStateOf(entry.id)}
	<button
		class="tb-act"
		class:tb-act--on={teamState === 'in'}
		class:tb-nudge={nudge?.id === entry.id}
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
{/snippet}

<!-- Audition candidates — rendered inside CompareView (below the reference row):
     who else covers what this slot does. Handlers live here with the other
     tiles'.
     ↻ 2026-08-13: the "covers" chip row LEFT this snippet. It is now
     CompareView's lens, on the glass control plate — the same chips group the
     chart and narrow this list, because they were always asking the same
     question and asking it twice put two chip rows on one screen. -->
{#snippet auditionStrip()}
	<div class="tb-aud">
		<div class="tb-aud-cands">
			{#each auditionCandidates as entry (entry.id)}
				{@const on = compareIds.has(entry.id)}
				<button
					class="tb-cand"
					class:tb-cand--on={on}
					class:tb-cand--unowned={ownsAny && $ownership[entry.id] !== 'owned'}
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
					No one covers all of these at once — turn a “Show” chip off to broaden the search.
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

<!-- Below the tiles: capability-unknown kits, never silently dropped. -->
{#snippet rosterStubs()}
	{#if split.uncurated.length > 0}
		<section class="tb-stubs">
			<p class="kicker">Not yet curated</p>
			<p class="note tb-note">
				These kits have no capability data yet — they may well do what you’re filtering for. Absence
				of a badge here means “unknown”, not “no”.
				<a
					class="link tb-stubs-link"
					href="{resolve('/coverage')}?c={split.uncurated.map((e) => e.id).join(',')}"
					onclick={(e) =>
						openCoverage(
							e,
							split.uncurated.map((u) => u.id)
						)}>See their coverage</a
				>
			</p>
			<div class="tb-grid">
				{#each split.uncurated as entry (entry.id)}
					{@render charTile(entry, true)}
				{/each}
			</div>
		</section>
	{/if}
{/snippet}

<!-- A role section's heading — the old drill row's glass strip. -->
{#snippet rosterSectionHead(section: GridSection)}
	<header class="tb-slotrow-head ctx-glass">
		{#if section.element}
			<img class="tb-drill-elicon" src={elementIcon(section.element)} alt="" />
			<span class="tb-slotrow-name tb-slotrow-name--el">{section.element}</span>
		{:else}
			<span class="tb-slotrow-name">{section.label}</span>
		{/if}
		<span class="tb-slotrow-count"
			>{section.entries.length} character{section.entries.length === 1 ? '' : 's'}</span
		>
	</header>
{/snippet}

<!-- The tool stack: bands + surface, with the bench ribbon's dock spanning
     both (toolbar round). Band A is the DOCUMENT — the same tabs and the same
     save/load/share the planner shows, because since the bench-band round both
     tools edit ONE working team. Band B is this tool's VIEW: which source you
     are browsing, and at which constellations you are reading it. -->
<!-- The con lens's options — one list, rendered by the lens's own menu at
     desk width and by band B's fold below BP.compact. -->
<!-- THE PANE SWITCH below the dock (§11.6, Nate's pick): ONE plate naming
     the pane it OPENS — the lineup's panel opens on the right, the
     characters' on the left. It leads the open pane's band cell. -->
{#snippet paneSwitch()}
	<button
		class="btn btn--glass tb-pane-switch"
		onclick={() => (tab = tab === 'characters' ? 'lineup' : 'characters')}
	>
		{#if tab === 'characters'}
			<Mark name="panelRight" /> Lineup
		{:else}
			<Mark name="panelLeft" /> Characters
		{/if}
	</button>
{/snippet}

{#snippet conModeItems(close: () => void)}
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

<!-- The + on the board tabs: a new board from a preset (§10.5). -->
{#snippet presetItems(close: () => void)}
	{#each PRESETS as p (p.key)}
		<button
			class="band-menu-item"
			role="menuitem"
			onclick={() => {
				close();
				newBoard(p.key);
			}}
		>
			<span class="tb-conmode-label">{p.label}</span>
			<span class="tb-conmode-hint">{p.hint}</span>
		</button>
	{/each}
{/snippet}

<!-- ↻ 2026-10-08 (lineups design §2.1): NO BENCH. The Builder builds several
     teams at once, so it cannot hold the Planner's one working team; band A is
     the BOARD's now — its tabs, in the rotation tabs' own grammar. -->
<ToolStack fill>
	{#snippet bandALeft()}
		<DocumentTabs model={boardTabStrip} newItems={presetItems} />
	{/snippet}

	{#snippet bandARight()}
		<div class="tb-doc-actions">
			{#if documentBar.notice}
				<span class="tb-notice">{documentBar.notice}</span>
			{/if}
			<button
				class="btn"
				disabled={!boardHasAnyone}
				onclick={() => boardBar.save()}
				title={boardBar.linked
					? `Save changes to “${board.label}”`
					: 'Save this board to your library'}
			>
				<Mark name="save" />
				<span class="tb-band-label">{boardLinked ? 'Save changes' : 'Save'}</span>
			</button>
			<!-- ↻ §11.6 item 1: "Load" was the only door to the library, and nobody
			     looks under Load to mark what they own — the button is named for the
			     place it opens. -->
			<button class="btn" onclick={() => library.show('builder')} title="Open the library">
				<Mark name="library" />
				<span class="tb-band-label">Library</span>
			</button>
			<button
				class="btn"
				disabled={!boardHasAnyone}
				onclick={() => boardBar.shareLink()}
				title="Copy a link to this board"
			>
				<Mark name="share" />
				<span class="tb-band-label">Share</span>
			</button>
		</div>
	{/snippet}

	<!-- ── BAND B, CUT AT THE DOCK (§11.6) ───────────────────────────────────
	     The Visualizers' shape: band B paints no ground and lays its cells on
	     the columns below it, so each cell's plates sit over the pane they
	     control — the character grid's search, Show, More and lens; the
	     lineup's No repeats. Below the dock ONE cell shows, the open pane's,
	     led by the switch to the other. -->
	{#snippet bandBFull()}
		<div
			class="tb-band"
			class:tb-band--tabbed={tabbed}
			style:--tb-board-w="{BOARD_W}px"
			style:--tb-dock-gap="{DOCK_GAP}px"
		>
			{#if showing !== 'lineup'}
				<div class="tb-band-cell" bind:clientWidth={charCellW}>
					{#if tabbed}{@render paneSwitch()}{/if}
					{#if sourceTab === 'roster'}
						<!-- The mark is painted OVER the field, so .field keeps owning its
						     inset stroke and focus ring (the old rail's search, same reasoning). -->
						<div class="tb-search">
							<Mark name="search" size={13} />
							<input
								class="field tb-search-field"
								type="text"
								placeholder="Search…"
								aria-label="Search characters"
								bind:value={filters.search}
								autocomplete="off"
								autocorrect="off"
								spellcheck={false}
							/>
						</div>
						{#if !foldShow}
							<div class="segment tb-show" role="radiogroup" aria-label="Show">
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
						{/if}
						<!-- More hangs from its END and opens leftward, so it stays over the
						     roster column — never over the board you are filtering for. -->
						<BandMenu
							glass
							role="dialog"
							mark="filter"
							label={moreCount > 0 ? `More · ${moreCount}` : 'More'}
							ariaLabel="More filters"
						>
							{#snippet items(close)}
								<MoreFilters
									{roster}
									{filters}
									{activeFacets}
									bind:ownershipView
									showOwnership={foldShow}
									lens={foldLens ? conModeItems : undefined}
									{close}
								/>
							{/snippet}
						</BandMenu>
						{#if !foldLens}
							<!-- The constellation LENS — what the grid's capabilities are read at.
							     A menu states the reading in one plate and gives each option room
							     for the sentence that explains it. -->
							<BandMenu glass label={activeConMode.label} ariaLabel="Read capabilities at">
								{#snippet items(close)}
									{@render conModeItems(close)}
								{/snippet}
							</BandMenu>
						{/if}
					{/if}
				</div>
			{/if}
			{#if showing !== 'characters'}
				<div class="tb-band-cell">
					{#if tabbed}{@render paneSwitch()}{/if}
					<!-- ⏭ Working copy (copy step 8). -->
					<label class="toggle tb-norepeat" title="Mark a character who is on more than one team">
						<input
							type="checkbox"
							checked={board.noRepeats}
							onchange={(e) => boards.setNoRepeats(board.id, e.currentTarget.checked)}
						/>
						<span class="toggle-track"><span class="toggle-thumb"></span></span>
						<span class="toggle-label">No repeats</span>
					</label>
				</div>
			{/if}
		</div>
	{/snippet}

	{#snippet surface()}
		<!-- THE DOCK (§11.2). Both panes stay mounted; below the dock the tab
		     decides which one shows, and the board slides in over the roster. -->
		<div
			class="tb-dock tb-dock--{showing}"
			style:--tb-wipe="{motion(TB_WIPE_MS)}ms"
			style:--tb-board-w="{BOARD_W}px"
			style:--tb-dock-gap="{DOCK_GAP}px"
		>
			<div class="tb-pane tb-pane--roster" inert={showing === 'lineup'}>
				{@render main()}
			</div>
			<div
				class="tb-pane tb-pane--board scroll-fade"
				use:scrollFade
				inert={showing === 'characters'}
			>
				<BoardView
					{board}
					selectedTeamId={selectedTeam?.id ?? null}
					onSelectTeam={(id) => (chosenTeamId = id)}
					nudgeAt={nudge?.at ?? null}
					onEmptySlot={() => {
						if (tabbed) tab = 'characters';
					}}
					onAddTeam={() => boards.addTeam(board.id)}
					onRemoveTeam={(teamId) => boards.removeTeam(board.id, teamId)}
					onOpenInPlanner={openInPlanner}
					onPin={(teamId, rotationId) => boards.pin(board.id, teamId, rotationId)}
					onSeason={(version) => boards.setSeason(board.id, version)}
				/>
			</div>
		</div>
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
		<!-- ↻ §11.2: the filters live IN the roster column, as a bar — never over
		     the board you are filtering for. -->
		{#if sourceTab === 'roster'}
			<RosterFilterStrip
				{filters}
				activeRole={activeCategory?.key ?? null}
				onRole={openCategory}
				count={split.matches.length}
				{countNote}
				anyActive={anyFilterActive}
				onClear={clearAllFilters}
			/>
		{/if}
		<div class="tb-sourcebox tb-sourcebox--fill">
			<section class="tb-source scroll-fade tb-source--fill" use:scrollFade>
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
						auditionSlot={auditionSlot ?? undefined}
						seedLenses={anchorId ? auditionSeedFacets : undefined}
						onLensChange={anchorId ? applyAuditionLens : undefined}
						onElementLensChange={anchorId ? applyElementLens : undefined}
						onRemove={toggleCompare}
						onAdd={toggleCompare}
						onCommit={anchorId ? commitAudition : undefined}
						onClear={anchorId ? undefined : () => compareIds.clear()}
						onCancelAudition={anchorId ? cancelAudition : undefined}
						onBackToPlanner={anchorId && fromPlanner ? backToPlanner : undefined}
						candidatesArea={anchorId ? auditionStrip : undefined}
						teamDeltas={auditionDeltas}
						rotationReads={anchorId ? rotationReads : undefined}
					/>
				{/if}

				<!-- Roster stays MOUNTED once first shown (hidden, not {#if}-destroyed):
				     remounting ~122 cards on every Atlas⇄Roster toggle was a visible
				     stall in Safari 26.x, and keeping it warm makes the toggle instant
				     in every browser.
				     ↻ §11.2: the filters are the bar above; what is left in here is
				     the grid proper. -->
				{#if rosterEverShown}
					<div class="tb-roster" hidden={sourceTab !== 'roster'}>
						<CharacterGrid
							roster={split.matches}
							{filters}
							tile={rosterTile}
							sections={rosterSections}
							sectionHead={rosterSectionHead}
							belowGrid={rosterStubs}
							emptyMessage={rosterEmptyMessage}
						/>
					</div>
				{/if}
			</section>
		</div>
	</div>
{/snippet}

<!-- The one deliberate modal: a focused single-character read. -->
{#if selectedId}
	<DetailCard
		id={selectedId}
		{conMode}
		onClose={() => (selectedId = null)}
		teamState={teamStateOf(selectedId)}
		onToggleTeam={toggleTeam}
	/>
{/if}

<style>
	/* ══ THE DOCK (design doc §11.2) ═══════════════════════════════════════
	   ⚓ The board is docked on the RIGHT at a FIXED width and the roster column
	   is the only thing that flexes, so the board's layout can be made stable.
	   🎛️ --tb-board-w: ⏳ a first value, measured in step 1 against a full
	   Stygian board (§11.6 item 3).
	   Below the dock (`wide`, 71rem — $lib/breakpoints.ts) the panes are TABS:
	   each takes the whole width and the board slides in over the roster on a
	   transform. ⚠ Both panes always lay out, so neither loses its scroll or
	   filters while hidden. 🎛️ --tb-wipe is TB_WIPE_MS (lib/split.ts). */
	.tb-dock {
		--tb-board-w: 580px;
		--tb-dock-gap: 16px;
		--tb-wipe-ease: cubic-bezier(0.2, 0.7, 0.2, 1);
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) var(--tb-board-w);
		/* ⚠ minmax(0, 1fr), never 1fr — the `auto` minimum would let the
		   roster's content hold the row open past the viewport. */
		grid-template-rows: minmax(0, 1fr);
		gap: var(--tb-dock-gap);
	}
	.tb-pane {
		min-width: 0;
		min-height: 0;
	}
	.tb-pane--roster {
		display: flex;
	}
	.tb-pane--board {
		overflow-y: auto;
	}
	@media (max-width: 71rem) {
		.tb-dock {
			position: relative;
			display: flex;
			gap: 0;
			overflow: hidden;
		}
		.tb-pane {
			flex: 0 0 100%;
			transition: transform var(--tb-wipe) var(--tb-wipe-ease);
		}
		.tb-pane--board {
			position: absolute;
			inset: 0;
			transform: translateX(calc(100% + var(--tb-dock-gap)));
		}
		.tb-dock--lineup .tb-pane--roster {
			transform: translateX(calc(-100% - var(--tb-dock-gap)));
		}
		.tb-dock--lineup .tb-pane--board {
			transform: none;
		}
	}

	/* Band A's end zone: the board's notice and Share. */
	.tb-doc-actions {
		display: flex;
		align-items: center;
		gap: var(--band-item-gap, 4px);
	}
	.tb-notice {
		font-size: var(--fs-sm);
		color: var(--muted);
		white-space: nowrap;
	}

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
	/* ↻ §11.2: the stack is the FILTER BAR over the grid now — one reading, a
	   control plate and the cards it narrows, so they sit at a box's distance
	   rather than a section's (the grid's own 6px gutter adds to it). */
	.tb-stack {
		--tb-section-gap: 0.5rem;
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

	/* ── BAND B, CUT AT THE DOCK (§11.6) ─────────────────────────────────────
	   The cells sit on the dock's own columns (--tb-board-w / --tb-dock-gap,
	   from lib/dock), so each run of plates stands over the pane it controls —
	   the Visualizers' per-tile band. The band paints nothing; every control is
	   a glass plate (band--full's half of the bargain). */
	.tb-band {
		display: grid;
		grid-template-columns: minmax(0, 1fr) var(--tb-board-w);
		gap: var(--tb-dock-gap);
		height: 100%;
	}
	.tb-band--tabbed {
		grid-template-columns: minmax(0, 1fr);
	}
	.tb-band-cell {
		display: flex;
		align-items: center;
		gap: var(--band-item-gap, 4px);
		min-width: 0;
	}
	.tb-band-cell :global(.btn) {
		flex: none;
	}
	/* The mark is painted over the field; the field takes the slack. */
	.tb-search {
		position: relative;
		flex: 1 1 8rem;
		min-width: 6rem;
		display: flex;
		align-items: center;
	}
	.tb-search :global(.mark) {
		position: absolute;
		left: 0.6rem;
		color: var(--muted);
		pointer-events: none;
	}
	.tb-search-field {
		width: 100%;
		height: var(--band-ctrl-h);
		padding-left: calc(0.6rem + 13px + 0.4rem);
	}
	/* A segment and a toggle have no plate of their own — on an unpainted band
	   they wear the glass a band A segment wears. */
	.tb-show,
	.tb-norepeat {
		flex: none;
		height: var(--band-ctrl-h);
		border-radius: var(--r-sm);
		background: var(--surface);
	}
	.tb-norepeat {
		padding: 0 0.75rem;
		font-size: var(--fs-md);
	}
	.tb-pane-switch {
		gap: 0.45rem;
	}
	/* Below BP.compact ($lib/breakpoints.ts — 40rem) band A's controls keep
	   their mark and fold their word — one rule for every band control. */
	@media (max-width: 40rem) {
		.tb-band-label {
			display: none;
		}
	}

	/* ↻ 2026-10-08: Clear team and the Compare plate's avatar stack retired
	   with the shared working team and the Compare tab (lineups design §6). */

	/* ── Audition candidates strip (rendered inside CompareView) ── */
	/* Unowned candidates recede once you have told the tool what you own —
	   they are ranked after your own, and the strip should say why. ⚠ In the
	   PAINT (the text colour), never element opacity: these sit in a scroller
	   inside a transform-animated page. */
	.tb-cand--unowned:not(.tb-cand--on) .tb-cand-name {
		color: var(--chart-dim);
	}
	.tb-aud {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	/* ⛔ `.tb-aud-facets` / `.tb-aud-label` are GONE, not commented out — the
	   "covers" chip row moved onto CompareView's glass control plate. */
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
			border-color var(--t-snap),
			background var(--t-snap);
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
	/* ── THE VIEW SWAP FADES IN, AND DOES NOT FADE OUT ───────────────────────
	   (⚓ Nate 2026-08-12, the motion round's #1.) Roster / Compare (Atlas too, until 2026-10-07) are
	   three whole regions replacing one another, so they take --t-quick, the
	   SURFACE band, not the control band the plates above them use.

	   ⚠ IN ONLY, AND ⛔ NEVER A CROSS-FADE. The three views have different
	   heights and `sourceFills` differs between them, so the box they live in
	   RESIZES as they swap. Overlapping an outgoing copy onto that would fade a
	   ghost while it re-fits itself — the same trap that keeps the planner's
	   Source overlay from fading out (RotationTimeline). Instant out also means
	   no dead frames before the view you asked for starts arriving.

	   @starting-style supplies the 0 to run from, and it reaches all three for
	   two different reasons: Atlas and Compare are newly INSERTED on each swap,
	   while the Roster is kept mounted and merely crosses display:none →
	   displayed — both count as "first rendered", so one rule covers a mounting
	   view and a revealed one alike.

	   :global on the child selector because CompareView's root <section> carries
	   its own scope class; scoping would silently skip exactly one of the three. */
	.tb-source > :global(*) {
		opacity: 1;
		transition: opacity var(--t-quick);
	}
	@starting-style {
		.tb-source > :global(*) {
			opacity: 0;
		}
	}

	/* ── Role section heads (the Roster grid's sections) ──────────
	   ↻ 2026-10-07: these were the Atlas drill's and the RP-arrival slot rows'
	   headers; the drill is the Roster's sections now and the slot rows retired
	   into the audition, so only the head survives. */
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
		/* 118 → 108 (2026-09-22, the responsive survey's item 6): at 390 the
		   grid's box MEASURES 346px (the survey's "~110" assumed 358 and was 3px
		   short — 3 × 110 + two 0.6rem gaps is 349), and 3 × 118 is two across
		   with a third that did not fit by 27px. 3 × 108 + 2 gaps is 343. The
		   card's base form is sound down to 104 (its deleted compact band's gate
		   — see CharacterCard.svelte), so 108 costs the card nothing; with
		   auto-fill + 1fr a track sits just above its minimum, ~108–124. */
		--cg-tile-min: 108px;
		--cg-gap: 0.6rem;
		--cg-stack-gap: 0.7rem;
		/* Adds `display` to the shared fade. The Roster is the one view that is
		   REVEALED rather than mounted, so its entry crosses display:none, and
		   allow-discrete is the documented other half of that crossing — the same
		   pairing the planner's Source overlay uses. Atlas and Compare need no
		   such thing: they are fresh nodes, unambiguously first-rendered.

		   ⚠⚠ AND IT MUST NOT RESTATE `opacity: 1`. @starting-style carries the
		   SAME SPECIFICITY as the equivalent normal rule, so a tie falls to
		   SOURCE ORDER — and this rule sits after the @starting-style block. An
		   `opacity: 1` here therefore wins the STARTING style too, the fade runs
		   1 → 1, and nothing moves. Measured exactly that way in WebKit: Atlas
		   ramped 0.00 → 0.96 over eight frames while the Roster sat flat at 1.00.
		   The shared rule above already supplies the resting 1; leave it there. */
		transition:
			opacity var(--t-quick),
			display var(--t-quick) allow-discrete;
	}
	/* The explicit display:flex above would beat the UA's [hidden] rule.
	   ⚠ `transition: none` IS THE INSTANT EXIT. A transition is driven by the
	   AFTER-change style, so hiding reads THIS rule and revealing reads the one
	   above — which is what lets one element fade in and snap out with no second
	   class to track. Drop it and allow-discrete starts deferring display:none
	   to the end of the fade, leaving the old roster sitting there opaque after
	   you have already asked for another view. */
	.tb-roster[hidden] {
		display: none;
		transition: none;
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
	/* .chips, plus the facet rail's own top spacing. */
	/* .note, plus the offset its container doesn't provide. */
	.tb-stubs-link {
		white-space: nowrap;
	}
	.tb-note {
		margin-top: 0.5rem;
		font-size: var(--fs-md);
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
			border-color var(--t-snap),
			background var(--t-snap),
			color var(--t-snap);
	}
	.tb-act.tb-nudge {
		animation: nudge 120ms 2;
		border-color: var(--ui-warning);
	}
	@media (prefers-reduced-motion: reduce) {
		.tb-act.tb-nudge {
			animation: none;
		}
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
