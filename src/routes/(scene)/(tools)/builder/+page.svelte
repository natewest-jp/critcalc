<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { onMount, tick, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { claimVeilReady, afterPaint } from '$lib/landing/veilReady';
	import { getAllCharacterIndex, getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { newestFirst } from '$lib/utils/release';
	import {
		constellations,
		siteSettings,
		ownership,
		savedBoards,
		savedNotations
	} from '$lib/stores';
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
	import { documentBar, type NoticeAction } from '$lib/documentBar.svelte';
	import {
		BOARD_TEAM_LIMIT,
		boards,
		effectiveCon,
		pinnedRotation,
		teamCon,
		type BoardPreset,
		type BoardTeam
	} from '$lib/boards.svelte';
	import { boardBar, boardTabStrip } from '$lib/boardBar.svelte';
	import type { TabStripModel } from '$lib/tabSet';
	import { library } from '$lib/library.svelte';
	import { SEASONS, currentSeason, liveSeasons } from '$lib/endgame';
	import { decodeBoard } from '$lib/utils/boardUrl';
	import { FOLD_LENS_W, FOLD_SHOW_W, TB_WIPE_MS } from './lib/dock';
	import { motion } from '$lib/motion';
	import { below, short } from '$lib/media.svelte';
	import ToolStack from '$lib/components/ToolStack.svelte';
	import { scrollFade } from '$lib/actions/scrollFade';
	import DocumentTabs from '$lib/components/DocumentTabs.svelte';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import CharacterCard, { type CardGlyph } from '$lib/components/CharacterCard.svelte';
	import CharacterGrid, { type GridSection } from '$lib/components/CharacterGrid.svelte';
	import type { GridFilters } from '$lib/characterFilters';
	import DetailCard from '$lib/components/DetailCard.svelte';
	import SwapDelta from './lib/SwapDelta.svelte';
	import BoardView from './lib/BoardView.svelte';
	import RosterFilterStrip from './lib/RosterFilterStrip.svelte';
	import MoreFilters from './lib/MoreFilters.svelte';
	import { buildRoleSections, categoryOf } from './lib/atlas';
	import type { RoleCategory, RoleFilter } from '$lib/capabilities/roles';
	import { characterRoles } from '$lib/data/characterRoles.generated';
	import type { RolePosition, RoleFunction, CharacterIndexEntry } from '$lib/types/character';
	import {
		parseTeamParam,
		swapSections,
		teamHue,
		teamLabel,
		type SwapSection,
		type SwapTier
	} from './lib/team';
	import { FINGERPRINT } from '$lib/fingerprint';
	import { stripDeepLinkParams } from '../lib/deepLinkUrl';

	// ---------------------------------------------------------------------------
	// Roster (eager index; full payloads stay lazy behind the detail card)
	// ---------------------------------------------------------------------------

	// ⚓ Newest first (Nate 2026-10-13) — "is the new release in yet?" is the
	// first question a visit brings, as on the Coverage page.
	const roster = getAllCharacterIndex()
		.filter((c) => c.id !== 'blank')
		.sort(newestFirst);
	const rosterIds = new Set(roster.map((c) => c.id));

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
	// Three inbound params, each stripped after reading:
	// - ?team=a,b,c,d — an external deep link: the team lands on the ACTIVE
	//   BOARD (§9.7), not in a rotation tab.
	// - ?b= — a shared lineup.
	// - ?swap=N — the planner's bench ⇄: swap mode on slot N of the Planner's
	//   OWN team, drawn as a temporary row on top of the lineup (§10.3, §11.6
	//   item 20). The team does not travel — it is the Planner's active tab —
	//   so the slot index is the entire payload.
	afterNavigate((nav) => {
		const url = nav.to?.url;
		if (!url || !url.pathname.endsWith('/builder')) return;
		const teamParam = url.searchParams.get('team');
		const swapParam = url.searchParams.get('swap');
		const boardParam = url.searchParams.get('b');
		if (!teamParam && !swapParam && !boardParam) return;
		// ⛔ Not $app/navigation's replaceState — see stripDeepLinkParams. This is
		// the call site that carried NO reason at all, and `?swap=` arrives here
		// cold from the planner's ⇄.
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
			if (Number.isInteger(n) && n >= 0 && n < 4) {
				pendingSwapSlot = n;
				tab = 'characters';
			}
		}
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
	/** ↻ Responsive sweep §3 item 5 (⚓ Nate 2026-10-15): on a SHORT screen
	 *  (`(max-height: 30rem)`, breakpoints.ts § THE HEIGHT AXIS) the roster's
	 *  head — filter strip, hint, destination banner — rides INSIDE the grid's
	 *  scroller instead of pinned over it. Pinned, it left the grid 13–83px of a
	 *  landscape phone (a card is ~120). */
	const headScrolls = $derived(short());
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
		if (pendingSwapSlot === null && !errandOpen && boardHasAnyone) tab = 'lineup';
	});

	/** The character cell's width in band B — it folds Show, then the lens,
	 *  into More when the cell runs out (`FOLD_*_W`, lib/dock). 0 before the
	 *  first measure, so the first paint is the folded one. */
	let charCellW = $state(0);
	const foldShow = $derived(charCellW < FOLD_SHOW_W);
	const foldLens = $derived(charCellW < FOLD_LENS_W);

	// ── The board ─────────────────────────────────────────────────────────────

	const board = $derived(boards.activeBoard);

	// The Planner's ⇄ row (swap mode, below) — declared here because the
	// selection reads it.
	const ERRAND_ID = 'planner-errand';
	let errandOpen = $state(false);
	/** The slot asked for, until the tabs are restored and it can be read. */
	let pendingSwapSlot = $state<number | null>(null);
	const errandTeam = $derived<BoardTeam | null>(
		errandOpen
			? {
					id: ERRAND_ID,
					slots: rt.slots.map((s) => (s === 'blank' ? null : s)),
					con: { ...rt.tabCon }
				}
			: null
	);
	/** A team by id — the board's, or the Planner's temporary row. */
	const teamById = (id: string): BoardTeam | undefined =>
		id === ERRAND_ID ? (errandTeam ?? undefined) : board.teams.find((t) => t.id === id);

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
		if (chosenTeamId && !teamById(chosenTeamId)) chosenTeamId = null;
	});
	/** The team the selection is FOLLOWING: it holds while it has room, so a
	 *  move that frees a slot on an earlier team does not pull the selection
	 *  back there; a full team hands on to the next with room. */
	let followTeamId = $state<string | null>(null);
	const selectedTeam = $derived(
		(chosenTeamId === ERRAND_ID ? errandTeam : null) ??
			board.teams.find((t) => t.id === chosenTeamId) ??
			board.teams.find((t) => t.id === followTeamId && t.slots.includes(null)) ??
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

	/** The order teams were last selected in, most recent first. A
	 *  character's frame wears the newest team that holds them, and turning No
	 *  repeats on keeps each one there (⚓ Nate 2026-10-11). This visit only. */
	let teamRecency = $state<string[]>([]);
	$effect(() => {
		const id = selectedTeam?.id;
		if (!id || id === ERRAND_ID) return;
		untrack(() => {
			if (teamRecency[0] !== id) teamRecency = [id, ...teamRecency.filter((x) => x !== id)];
			if (!chosenTeamId) followTeamId = id;
		});
	});
	const indexOfTeam = (teamId: string) => board.teams.findIndex((t) => t.id === teamId);
	const selectedIndex = $derived(selectedTeam ? indexOfTeam(selectedTeam.id) : 0);
	/** The selected team's name and hue — the Planner's row is neither a
	 *  battlefield nor a numbered team, and wears the gold of an errand. */
	const selectedLabel = $derived(
		selectedTeam?.id === ERRAND_ID ? 'the Planner’s team' : teamLabel(board, selectedIndex)
	);
	const selectedHue = $derived(
		selectedTeam?.id === ERRAND_ID ? 'var(--accent)' : teamHue(selectedIndex)
	);

	/** The frame a card wears: the most recently selected team holding them. */
	function frameOf(id: string): { hue: string; slot: number } | undefined {
		const order = [...teamRecency, ...board.teams.map((t) => t.id)];
		for (const teamId of order) {
			const t = indexOfTeam(teamId);
			const slot = board.teams[t]?.slots.indexOf(id) ?? -1;
			if (slot >= 0) return { hue: teamHue(t), slot: slot + 1 };
		}
		return undefined;
	}

	/** A pick lands in the selected team's EARLIEST empty slot. Returns
	 *  whether that filled the team, or null when it was already full (the
	 *  nudge). ⚓ Under No repeats a character on ANOTHER team MOVES here (the
	 *  store frees their old slot) and the band says so. */
	function placeOnBoard(id: string): boolean | null {
		const team = selectedTeam;
		if (!team) return null;
		const i = team.slots.indexOf(null);
		// The Planner's row changes by swapping only — its edits are the
		// notation's, made where the rotation is.
		if (i < 0 || team.id === ERRAND_ID) {
			nudge = { id, at: Date.now() };
			return null;
		}
		const left = boards.setSlot(board.id, team.id, i, id);
		if (left.length) {
			const name = getCharacterIndexEntry(id)?.displayName ?? id;
			documentBar.showNotice(
				`${name} moved from ${teamLabel(board, indexOfTeam(left[0]))} to ${teamLabel(board, indexOfTeam(team.id))}.`
			);
		}
		return team.slots.filter((s) => s === null).length === 1;
	}

	/** Out of the SELECTED team, leaving its slot empty — the others keep
	 *  their places, as in the game, and the next pick fills the gap. */
	function removeFromBoard(id: string): void {
		const team = selectedTeam;
		const i = team?.slots.indexOf(id) ?? -1;
		if (team && i >= 0 && team.id !== ERRAND_ID) boards.setSlot(board.id, team.id, i, null);
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
		void goto(resolve('/planner'));
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
				return i >= 0 ? teamLabel(board, i) : null;
			},
			place(slots, pinnedRotationId) {
				// The Planner's swap hides the board: a pick ends it, as a tab click
				// does, so the team lands where it can be seen.
				if (errandOpen) leaveErrand();
				const target =
					board.teams.find((t) => t.id === chosenTeamId) ??
					board.teams.find((t) => t.slots.every((s) => s === null)) ??
					// A battlefield board's teams are the game's — only Custom grows.
					(board.preset === 'custom' ? boards.addTeam(board.id) : undefined);
				if (!target) {
					documentBar.showNotice('The lineup is full');
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
		leaveErrand();
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
	// SWAP MODE (lineups design §11.6 item 20)
	//
	// A FILLED portrait in the SELECTED row puts its slot in swap mode: the
	// Characters grid regroups by what the swap would do to the TEAM, the
	// hovered card previews it on the board, and a pick swaps and leaves.
	// Escape, the strip's ✕ or the portrait again leaves without a swap — and
	// on the Planner's row, ends the errand (`stopSwap`).
	// ⚓ Compare and Audition retired into this — the question was never "how
	// do these kits compare" but "what happens to my team".
	// ---------------------------------------------------------------------------

	/** `incumbent` null = ADDING: the Planner's errand on an EMPTY slot of
	 *  its team (⚓ Nate 2026-10-13) — nobody leaves, so the grid is grouped
	 *  by what each candidate brings. Only the errand adds this way; a board
	 *  fills its empty slots by picks, the game's way. */
	let swapping = $state<{ teamId: string; slot: number; incumbent: string | null } | null>(null);

	/** The portrait again leaves swap mode; another filled one moves it (on
	 *  the Planner's row, an empty one too). */
	function toggleSwap(teamId: string, slot: number): void {
		if (swapping?.teamId === teamId && swapping.slot === slot) return stopSwap();
		const incumbent = teamById(teamId)?.slots[slot];
		if (incumbent === undefined || (incumbent === null && teamId !== ERRAND_ID)) return;
		swapping = { teamId, slot, incumbent };
		if (tabbed) tab = 'characters';
	}

	// Swap mode belongs to ONE occupant of ONE slot of the selected team: it
	// ends when any of the three changes under it (another row selected, the
	// board switched, a member moved off by No repeats).
	$effect(() => {
		if (!swapping) return;
		const team = teamById(swapping.teamId);
		if (
			!team ||
			team.slots[swapping.slot] !== swapping.incumbent ||
			selectedTeam?.id !== swapping.teamId
		)
			swapping = null;
	});

	/** Out of swap mode WITHOUT a swap: Escape, the strip's ✕, the portrait
	 *  again. ⚓ One meaning — cancel (Nate 2026-10-15, sweep item 7) — so on
	 *  the Planner's row it ends the whole errand, as its Cancel does: the
	 *  row can only change by swapping, and leaving the slot alone left a
	 *  team nothing could be picked into, under a strip that said so falsely. */
	function stopSwap(): void {
		if (swapping?.teamId === ERRAND_ID) return cancelErrand();
		swapping = null;
	}

	const nameOf = (id: string) => getCharacterIndexEntry(id)?.displayName ?? id;

	// ⚓ A swap's suggestions are read from the TOP (Nate 2026-10-13): the
	// grid's scroller is the roster's too, so entering swap mode — or moving
	// it to another slot — puts it back at the first section, and leaving it
	// returns the roster to where you were reading.
	let rosterHost: HTMLElement | undefined = $state();
	let lastSwapKey: string | null = null;
	let rosterScrollTop = 0;
	$effect.pre(() => {
		const key = swapping ? `${swapping.teamId}:${swapping.slot}:${swapping.incumbent}` : null;
		const was = lastSwapKey;
		lastSwapKey = key;
		if (key === was) return;
		const scroller = untrack(() => rosterHost)?.querySelector<HTMLElement>('.cg-scroll');
		if (!scroller) return;
		if (was === null) rosterScrollTop = scroller.scrollTop;
		void tick().then(() => (scroller.scrollTop = key === null ? rosterScrollTop : 0));
	});

	/** The pick, in swap mode: the swap itself, then out of the mode. Band A
	 *  says what happened, with Undo; when the swap broke a pinned rotation it
	 *  also offers that rotation with the newcomer in it — a NEW tab, never a
	 *  rewrite of the saved one (§10.2). */
	function swapIn(id: string): void {
		const s = swapping;
		if (!s) return;
		swapping = null;
		previewHeld = id;
		if (s.teamId === ERRAND_ID) {
			// The Planner's own team: rename in its tab and go back to it.
			rt.setSlot(s.slot, id);
			errandOpen = false;
			chosenTeamId = null;
			void goto(resolve('/planner'));
			return;
		}
		const team = teamById(s.teamId);
		if (!team || !s.incumbent) return;
		const incumbent = s.incumbent;
		const boardId = board.id;
		const snapshot = board.teams.map((t) => ({ ...t, slots: [...t.slots] }));
		const pin = pinnedRotation(team, $savedNotations);
		const left = boards.setSlot(boardId, team.id, s.slot, id);
		const name = nameOf(id);
		const from = left.length ? ` (from ${teamLabel(board, indexOfTeam(left[0]))})` : '';
		const actions: NoticeAction[] = [];
		if (pin)
			actions.push({
				label: `Try it with ${name} in the Planner`,
				run: () => {
					documentBar.tryWithSwap(pin, incumbent, id, `${pin.name} · ${name}`);
					void goto(resolve('/planner'));
				}
			});
		actions.push({ label: 'Undo', run: () => boards.restoreTeams(boardId, snapshot) });
		documentBar.showNotice(
			pin
				? `${name} replaced ${nameOf(incumbent)}${from}. “${pin.name}” is no longer pinned.`
				: `${name} replaced ${nameOf(incumbent)}${from}.`,
			actions
		);
		if (tabbed) tab = 'lineup';
	}

	// ── THE PLANNER'S ⇄ (`?swap=N`, §10.3) ───────────────────────────────────
	// The Planner has no character grid: ⇄ on its bench sends the slot here.
	// Its team is drawn as a TEMPORARY row on top of the lineup — board-less,
	// never stored — already swapping slot N. A pick renames in the Planner's
	// tab and returns; Cancel returns unchanged. An EMPTY slot (or a typed
	// Blank) arrives the same way and ADDS (⚓ Nate 2026-10-13): the pick
	// appends a bare name, or renames the Blank, through the same setSlot.

	// ⚠ NOT DONE IN afterNavigate: the tabs are restored by the (tools)
	// LAYOUT's onMount, and on a COLD load of /builder?swap=2 the param is
	// read before that — the slot would read 'blank'. Waiting on `restored` is
	// right whichever way the ordering falls.
	$effect(() => {
		if (pendingSwapSlot === null || !rt.restored || !mounted) return;
		const slot = pendingSwapSlot;
		pendingSwapSlot = null;
		const id = rt.slots[slot];
		const incumbent = !id || id === 'blank' ? null : id;
		errandOpen = true;
		chosenTeamId = ERRAND_ID;
		swapping = { teamId: ERRAND_ID, slot, incumbent };
	});

	/** Leave the errand IN the Builder — a board tab, or a new board, was
	 *  asked for. The board was never touched, so it simply shows again. */
	function leaveErrand(): void {
		errandOpen = false;
		swapping = null;
		chosenTeamId = null;
	}

	/** Band A's tabs, as the board strip — except that during the errand NO
	 *  tab is active (the Lineup isn't showing any board), and clicking one
	 *  ends the errand and shows that board (Nate 2026-10-13: a state of its
	 *  own, not a temporary tab — it never takes one of the twelve, lands in
	 *  Recently closed, or asks to make room). */
	const tabStrip: TabStripModel = {
		get tabs() {
			return boardTabStrip.tabs;
		},
		get activeId() {
			return errandOpen ? '' : boardTabStrip.activeId;
		},
		newLabel: boardTabStrip.newLabel,
		switchTo: (id) => {
			leaveErrand();
			boardTabStrip.switchTo(id);
		},
		close: (id) => boardTabStrip.close(id),
		rename: (id, label) => boardTabStrip.rename(id, label),
		reorder: (from, to, side) => boardTabStrip.reorder(from, to, side)
	};

	function cancelErrand(): void {
		errandOpen = false;
		swapping = null;
		chosenTeamId = null;
		void goto(resolve('/planner'));
	}

	const preferNewfit = $derived(mounted && $siteSettings.useNewOutfits);
	const traveler = $derived(mounted ? $siteSettings.travelerVariant : 'aether');

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
			? 'No curated character matches. Some kits unlock these capabilities at higher constellations — try “My constellations” or “C6”.'
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

	/** How many choices are hidden inside More — its plate says so, or a
	 *  filter you set and closed would be invisible. */
	const moreCount = $derived(
		filters.weapons.size +
			filters.rarities.size +
			(filters.region ? 1 : 0) +
			(filters.factionBuffs?.size ?? 0) +
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
			label: 'My constellations',
			hint: 'Uses the constellations in your Roster'
		}
	];

	/** The lens's current reading — band B's menu states it on the trigger, so
	 *  the setting stays visible now that its eight segments are gone. */
	const activeConMode = $derived(CON_MODES.find((m) => m.key === conMode) ?? CON_MODES[0]);

	// ---------------------------------------------------------------------------
	// Detail card — a focused single-character modal (the tool's one deliberate
	// modal: an isolated read where focus is a feature).
	// ---------------------------------------------------------------------------

	let selectedId = $state<string | null>(null);

	function openDetail(id: string): void {
		selectedId = id;
	}

	/** A card's team action is about the SELECTED team: in it, or not, or it
	 *  is full ('full' stays clickable — the click is what earns the nudge). */
	const teamStateOf = (id: string): 'in' | 'out' | 'full' =>
		selectedTeam?.slots.includes(id) ? 'in' : selectedTeam?.slots.includes(null) ? 'out' : 'full';

	/** ⚓ The game's toggle: a pick fills the selected team, the same pick again
	 *  frees its slot. Below the dock, the pick that fills the team shows it. */
	function toggleTeam(id: string): void {
		// The pick has been seen: the preview rests until the pointer leaves,
		// or the row would flip at once to previewing the pick's UNDO.
		if (swapping) return swapIn(id);
		previewHeld = id;
		if (selectedTeam?.slots.includes(id)) return removeFromBoard(id);
		const filled = placeOnBoard(id);
		if (filled && tabbed) tab = 'lineup';
	}

	// ── THE FINGERPRINT AS THE FILTER (lineups design §11.2, step 4) ─────────
	/** The card the pointer (or focus) rests on — the selected team's
	 *  fingerprint previews the team its pick would make. */
	let hoverId = $state<string | null>(null);
	/** A card just picked: no preview until the pointer leaves it. */
	let previewHeld = $state<string | null>(null);
	const previewId = $derived(hoverId && hoverId !== previewHeld ? hoverId : null);
	function onCardPreview(id: string | null): void {
		if (id === null || id !== hoverId) previewHeld = null;
		hoverId = id;
	}

	/** A faint glyph on a team's fingerprint: find who would provide it — the
	 *  team becomes the destination and the roster narrows to that one
	 *  capability; the same glyph again lets it go. */
	function findFor(teamId: string, facet: FacetKey): void {
		const only = activeFacets.size === 1 && activeFacets.has(facet);
		activeFacets.clear();
		if (!only) activeFacets.add(facet);
		chosenTeamId = teamId;
		if (tabbed && !only) tab = 'characters';
	}

	/** A card's own fingerprint: the facets the character has or can unlock,
	 *  in the fingerprint's one order — lit at the lens, dim from a higher
	 *  constellation (⚓ Nate 2026-10-11; ⛔ never the full fifteen). */
	const FINGERPRINT_ORDER = FINGERPRINT.flatMap((c) => c.facets);
	const FACET_LABEL = Object.fromEntries(FACETS.map((f) => [f.key, f.label]));
	function glyphsFor(entry: CharacterIndexEntry): CardGlyph[] {
		const cap = conCapFor(conMode, mounted ? $constellations[entry.id] : undefined);
		return facetBadges(entry.caps)
			.sort((a, b) => FINGERPRINT_ORDER.indexOf(a.facet) - FINGERPRINT_ORDER.indexOf(b.facet))
			.map((b) => {
				const label = FACET_LABEL[b.facet] ?? b.facet;
				const lit = b.minCon <= cap;
				const gain = swapGrid?.gains[entry.id]?.includes(b.facet) ?? false;
				return {
					facet: b.facet,
					lit,
					gain,
					title: gain ? `${label} · new to the team` : lit ? label : `${label} · from C${b.minCon}`
				};
			});
	}

	/** The pick's screen-reader name — it names the team it acts on. */
	function pickLabel(entry: CharacterIndexEntry): string {
		if (swapping)
			return swapping.incumbent
				? `Swap ${entry.displayName} in for ${nameOf(swapping.incumbent)}`
				: `Add ${entry.displayName} to ${selectedLabel}`;
		const team = selectedLabel;
		const slot = selectedTeam?.slots.indexOf(entry.id) ?? -1;
		return slot >= 0
			? `Remove ${entry.displayName} from ${team} (slot ${slot + 1})`
			: `Add ${entry.displayName} to ${team}`;
	}

	// ── SWAP MODE'S GRID (§11.6 item 20) ─────────────────────────────────────
	/** The team being swapped in, read at the board's own constellations —
	 *  the same resolution its row draws with, so a header and the preview
	 *  above it can never disagree. */
	const swapTeam = $derived(swapping ? teamById(swapping.teamId) : undefined);
	const swapConOf = $derived.by(() => {
		const own = swapTeam ? teamCon(swapTeam, $savedNotations) : {};
		const roster = mounted ? $constellations : {};
		return (id: string) => effectiveCon(own, roster, id);
	});
	/** The battlefield's checks, when the team stands on one. */
	const swapChecks = $derived.by(() => {
		if (!swapTeam || board.preset !== 'stygian') return [];
		const season = SEASONS.find((x) => x.version === board.season) ?? liveSeasons()[0];
		return season?.battlefields[indexOfTeam(swapTeam.id)]?.checks ?? [];
	});

	const SWAP_TIER_LABEL: Record<SwapTier, string> = {
		keeps: 'Keeps everything',
		trades: 'Trades',
		reactions: 'Changes the reactions',
		uncurated: 'Not yet curated'
	};
	/** ⚓ Nate 2026-10-14: ADDING to a free slot loses nothing by construction,
	 *  so its first tier says what it does — "Adds", not "Keeps everything". */
	const swapTierLabel = (t: SwapTier): string =>
		t === 'keeps' && !swapping?.incumbent ? 'Adds' : SWAP_TIER_LABEL[t];

	/** The grid's sections while swapping: one per specific change, each
	 *  tier's name above its first. The filters still narrow who is offered. */
	/** ⚓ Swap mode respects ON-FIELD / OFF-FIELD (Nate 2026-10-13): an
	 *  off-fielder's slot is offered off-fielders and an on-fielder's
	 *  on-fielders — mixed together, the two read as a category error. The
	 *  other position waits behind one button at the foot of the grid, under
	 *  its own kickers. A character with no editorial position, or both
	 *  (Mavuika), counts as either. */
	let swapOtherShown = $state(false);
	$effect(() => {
		void swapping?.incumbent;
		swapOtherShown = false;
	});
	const POSITION_LABEL: Record<RolePosition, string> = {
		onField: 'On-field',
		offField: 'Off-field'
	};
	/** Adding has no position to respect — everyone is offered. */
	const swapPosition = $derived(
		swapping?.incumbent ? (rolesOf(swapping.incumbent)?.position ?? []) : []
	);
	const samePosition = (id: string): boolean => {
		const theirs = rolesOf(id)?.position ?? [];
		return !swapPosition.length || !theirs.length || theirs.some((p) => swapPosition.includes(p));
	};
	/** The position the button offers — the one the incumbent doesn't hold. */
	const swapOtherPosition = $derived(
		swapPosition.length === 1 ? (swapPosition[0] === 'onField' ? 'offField' : 'onField') : null
	);

	/** The grid's sections while swapping: one per specific change, each
	 *  tier's name above its first. The filters still narrow who is offered. */
	const swapGrid = $derived.by(() => {
		if (!swapping || !swapTeam) return undefined;
		const team = swapTeam;
		const slot = swapping.slot;
		const own = mounted ? $ownership : {};
		const everyone = [...split.matches, ...split.uncurated];
		const same = everyone.filter((e) => samePosition(e.id));
		const other = everyone.filter((e) => !samePosition(e.id));
		// Plain objects, not a Set/Map: a pure fold, nothing here is state.
		const meta: Record<string, { section: SwapSection; tierStart: boolean; kicker: string }> = {};
		/** Each candidate's gained capabilities — their card's green glyphs (B). */
		const gains: Record<string, FacetKey[]> = {};
		const sections: GridSection[] = [];
		const add = (
			entries: CharacterIndexEntry[],
			prefix: string,
			kickerOf: (t: SwapTier) => string
		) => {
			const seen: SwapTier[] = [];
			for (const sec of swapSections(
				entries,
				team.slots,
				slot,
				swapConOf,
				swapChecks,
				(id) => own[id] === 'owned'
			)) {
				const key = prefix + sec.key;
				meta[key] = {
					section: sec,
					tierStart: !seen.includes(sec.tier),
					kicker: kickerOf(sec.tier)
				};
				seen.push(sec.tier);
				for (const r of sec.runs) {
					const facets = [...sec.items, ...r.gains].flatMap((i) =>
						i.kind === 'facet' && i.sign > 0 ? [i.facet] : []
					);
					for (const e of r.entries) gains[e.id] = facets;
				}
				sections.push({ key, label: swapTierLabel(sec.tier), entries: sec.entries });
			}
		};
		add(same, '', swapTierLabel);
		const otherLabel = swapOtherPosition ? POSITION_LABEL[swapOtherPosition] : '';
		if (swapOtherShown) add(other, 'other:', (t) => `${otherLabel} · ${swapTierLabel(t)}`);
		return { sections, meta, gains, otherCount: other.length, otherLabel };
	});

	/** Escape leaves swap mode — unless a modal or a menu took it first. */
	function onKeydown(e: KeyboardEvent): void {
		if (e.key !== 'Escape' || !swapping || selectedId || e.defaultPrevented) return;
		stopSwap();
	}

	/** The destination strip over the grid: where a pick goes. */
	const destFilled = $derived(selectedTeam?.slots.filter((s) => s !== null).length ?? 0);
</script>

<!-- One grid tile: the roster grid and the "not yet curated" bucket. -->
{#snippet charTile(entry: CharacterIndexEntry)}
	<CharacterCard
		{entry}
		{preferNewfit}
		{traveler}
		glyphs={glyphsFor(entry)}
		ownedCon={mounted && $ownership[entry.id] === 'owned'
			? ($constellations[entry.id] ?? 0)
			: undefined}
		frame={frameOf(entry.id)}
		nudged={nudge?.id === entry.id}
		pickLabel={pickLabel(entry)}
		onPick={toggleTeam}
		onDetails={openDetail}
		onPreview={onCardPreview}
	/>
{/snippet}

<!-- ── Roster-view slots handed to the shared CharacterGrid ───────────────── -->

<!-- One grid tile (the grid's own snippet takes just the entry). -->
{#snippet rosterTile(entry: CharacterIndexEntry)}
	{@render charTile(entry)}
{/snippet}

<!-- Below the tiles: capability-unknown kits, never silently dropped. -->
{#snippet rosterStubs()}
	{#if split.uncurated.length > 0}
		<section class="tb-stubs">
			<p class="kicker">Not yet curated</p>
			<p class="note tb-note">
				These kits have no capability data yet — they may well do what you’re filtering for. A card
				with no capabilities here means “unknown”, not “no”.
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
					{@render charTile(entry)}
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

<!-- SWAP MODE'S section head (§11.6 item 20): the tier's name over its
     first section, then what this section's swap does, as signed items. -->
{#snippet swapSectionHead(section: GridSection)}
	{@const m = swapGrid?.meta[section.key]}
	{#if m?.tierStart}<p class="kicker tb-swap-tier">{m.kicker}</p>{/if}
	<header class="tb-slotrow-head tb-swap-head ctx-glass">
		{#if m?.section.items.length}
			<SwapDelta items={m.section.items} />
		{:else if m?.section.tier === 'uncurated'}
			<span class="tb-swap-quiet">No capability data yet, so this swap can’t be read.</span>
		{:else}
			<span class="tb-swap-quiet">Loses nothing</span>
		{/if}
		<span class="tb-slotrow-count"
			>{section.entries.length} character{section.entries.length === 1 ? '' : 's'}</span
		>
	</header>
{/snippet}

<!-- The grid's count, at the destination banner's end (⚓ Nate 2026-10-13:
     beside the filters it wrapped to a line of its own). Swapping, it counts
     who is offered. -->
{#snippet destCount()}
	{@const n = swapGrid
		? swapGrid.sections.reduce((sum, s) => sum + s.entries.length, 0)
		: split.matches.length}
	<span class="tb-dest-count"
		>{n} character{n === 1 ? '' : 's'}{#if countNote}<span class="tb-dest-note">{countNote}</span
			>{/if}</span
	>
{/snippet}

<!-- The other position's door, at the foot of the swap grid. -->
{#snippet swapFoot()}
	{#if swapGrid?.otherCount}
		<p class="tb-swap-foot">
			<button class="btn btn--glass" onclick={() => (swapOtherShown = !swapOtherShown)}>
				{swapOtherShown
					? `Hide the ${swapGrid.otherLabel.toLowerCase()} characters`
					: `Show ${swapGrid.otherCount} ${swapGrid.otherLabel.toLowerCase()} characters too`}
			</button>
		</p>
	{/if}
{/snippet}

<svelte:window onkeydown={onKeydown} />

<!-- The tool stack: bands + surface (toolbar round). Band A is this tool's
     DOCUMENT — its lineup tabs and Save/Library/Share. Band B is its VIEW: the
     panes, the filters, and the constellations you are reading at. -->
<!-- The con lens's options — one list, rendered by the lens's own menu at
     desk width and by band B's fold below BP.compact. -->
<!-- THE PANE SWITCH below the dock (§11.6, Nate's pick): ONE plate naming
     the pane it OPENS — the lineup's panel opens on the right, the
     characters' on the left. It leads the open pane's band cell. -->
{#snippet paneSwitch()}
	<button
		class="btn btn--glass tb-pane-switch"
		aria-label={tab === 'characters' ? 'Lineup' : 'Characters'}
		onclick={() => (tab = tab === 'characters' ? 'lineup' : 'characters')}
	>
		{#if tab === 'characters'}
			<Mark name="panelRight" /> <span class="tb-band-label">Lineup</span>
		{:else}
			<Mark name="panelLeft" /> <span class="tb-band-label">Characters</span>
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
		<DocumentTabs model={tabStrip} newItems={presetItems} />
	{/snippet}

	{#snippet bandARight()}
		<div class="tb-doc-actions">
			{#if documentBar.notice}
				<span class="tb-notice" role="status">{documentBar.notice}</span>
				{#each documentBar.noticeActions as action (action.label)}
					<button class="btn btn--sm" onclick={() => documentBar.runNoticeAction(action)}
						>{action.label}</button
					>
				{/each}
			{/if}
			<button
				class="btn"
				disabled={!boardHasAnyone || errandOpen}
				onclick={() => boardBar.save()}
				title={boardBar.linked
					? `Save changes to “${board.label}”`
					: 'Save this lineup to your library'}
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
				disabled={!boardHasAnyone || errandOpen}
				onclick={() => boardBar.shareLink()}
				title="Copy a link to this lineup"
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
		<div class="tb-band" class:tb-band--tabbed={tabbed}>
			{#if showing !== 'lineup'}
				<div class="tb-band-cell" bind:clientWidth={charCellW}>
					{#if tabbed}{@render paneSwitch()}{/if}
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
				</div>
			{/if}
			{#if showing !== 'characters'}
				<div class="tb-band-cell">
					{#if tabbed}{@render paneSwitch()}{/if}
					<!-- THE LINEUP'S RAIL (⚓ Nate): the cell always spans its pane, as the
					     Planner's band B rail spans its middle — an empty plate today,
					     the lineup's controls standing at its end. -->
					<span class="tb-rail" aria-hidden="true"></span>
					{#if errandOpen}
						<!-- The errand edits the Planner's team, not a board: the board's
						     own controls wait for it. -->
					{:else if board.preset === 'custom' && board.teams.length < BOARD_TEAM_LIMIT}
						<!-- A battlefield is the game's, not yours to add — teams come and go
						     on a Custom board only (with ✕, §11.6 item 13). -->
						<button
							class="btn btn--glass"
							aria-label="Add team"
							onclick={() => boards.addTeam(board.id)}
							><Mark name="plus" /> <span class="tb-band-label">Add team</span></button
						>
					{/if}
					{#if !errandOpen}
						<label class="toggle tb-norepeat" title="Each character joins only one team.">
							<input
								type="checkbox"
								checked={board.noRepeats}
								onchange={(e) =>
									boards.setNoRepeats(board.id, e.currentTarget.checked, teamRecency)}
							/>
							<!-- The label leads and the switch ends the row (⚓ Nate). -->
							<span class="toggle-label">No repeats</span>
							<span class="toggle-track"><span class="toggle-thumb"></span></span>
						</label>
					{/if}
				</div>
			{/if}
		</div>
	{/snippet}

	{#snippet surface()}
		<!-- THE DOCK (§11.2). Both panes stay mounted; below the dock the tab
		     decides which one shows, and the board slides in over the roster. -->
		<div class="tb-dock tb-dock--{showing}" style:--tb-wipe="{motion(TB_WIPE_MS)}ms">
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
					roomy={!below('broad')}
					selectedTeamId={selectedTeam?.id ?? null}
					onSelectTeam={(id) => (chosenTeamId = id)}
					nudgeAt={nudge?.at ?? null}
					onEmptySlot={() => {
						if (tabbed) tab = 'characters';
					}}
					onRemoveTeam={(teamId) => boards.removeTeam(board.id, teamId)}
					onOpenInPlanner={openInPlanner}
					onPin={(teamId, rotationId) => boards.pin(board.id, teamId, rotationId)}
					onSeason={(version) => boards.setSeason(board.id, version)}
					{previewId}
					filteredFacets={activeFacets}
					onFind={findFor}
					swapping={swapping ? { teamId: swapping.teamId, slot: swapping.slot } : null}
					onSwap={toggleSwap}
					errand={errandTeam
						? {
								team: errandTeam,
								label: `From the Planner: ${rt.activeTab.label}`,
								onCancel: cancelErrand
							}
						: null}
				/>
			</div>
		</div>
	{/snippet}
</ToolStack>

<!-- ── The roster's HEAD: the filter strip, the empty-roster hint and the
     destination banner. Pinned over the grid's scroller, or — on a short
     screen (`headScrolls`) — the first thing INSIDE it, so it scrolls away with
     the cards. One snippet, so the two placements cannot drift. -->
{#snippet rosterHead()}
	<!-- ↻ §11.2: the filters live IN the roster column, as a bar — never over
	     the board you are filtering for. -->
	<RosterFilterStrip
		{filters}
		{activeFacets}
		activeRole={activeCategory?.key ?? null}
		onRole={openCategory}
		count={swapping || selectedTeam ? undefined : split.matches.length}
		{countNote}
		anyActive={anyFilterActive}
		onClear={clearAllFilters}
	/>
	<!-- ⚓ The empty-roster hint (lineups design §11.6 item 12): the Owned
	     filter and the "My constellations" lens read the roster, and do
	     nothing until it has something in it. -->
	{#if mounted && !ownsAny}
		<p class="tb-roster-hint">
			The Owned filter and “My constellations” read your roster, which is empty.
			<button class="link" onclick={() => library.openRoster()}>Open the Roster</button>
		</p>
	{/if}
	<!-- THE DESTINATION STRIP (§11.2): where a pick goes, keyed by the
	     team's hue — or, swapping, who the pick replaces (§11.6 item 20). -->
	{#if swapping}
		{@const verb = swapping.incumbent ? 'replacing' : 'adding'}
		<p class="tb-dest" role="status" style:--team-hue={selectedHue}>
			{#if swapping.incumbent}
				Replacing {nameOf(swapping.incumbent)} · {selectedLabel}
			{:else}
				Adding to {selectedLabel}
			{/if}
			{@render destCount()}
			<button
				class="btn btn--icon tb-dest-close"
				onclick={stopSwap}
				aria-label={swapping.incumbent
					? `Stop replacing ${nameOf(swapping.incumbent)}`
					: `Stop adding to ${selectedLabel}`}
				title="Stop {verb} (Esc)"><Mark name="close" size={12} /></button
			>
		</p>
	{:else if selectedTeam}
		<p class="tb-dest" role="status" style:--team-hue={selectedHue}>
			{#if destFilled === 4}
				{selectedLabel} is full. Pick a member again to remove them.
			{:else}
				Adding to {selectedLabel} · {destFilled}/4
			{/if}
			{@render destCount()}
		</p>
	{/if}
{/snippet}

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
		{#if !headScrolls}{@render rosterHead()}{/if}
		<div class="tb-sourcebox tb-sourcebox--fill">
			<section class="tb-source scroll-fade tb-source--fill" use:scrollFade>
				<!-- ↻ §11.2: the filters are the bar above; what is left in here is
				     the grid proper. In swap mode it is sectioned by what each swap
				     does, the uncurated kits a tier of their own. -->
				<div class="tb-roster" bind:this={rosterHost}>
					<CharacterGrid
						roster={split.matches}
						{filters}
						tile={rosterTile}
						sections={swapGrid?.sections ?? rosterSections}
						sectionHead={swapGrid ? swapSectionHead : rosterSectionHead}
						aboveGrid={headScrolls ? rosterHead : undefined}
						belowGrid={swapGrid ? swapFoot : rosterStubs}
						emptyMessage={rosterEmptyMessage}
					/>
				</div>
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
		teamState={swapping ? undefined : teamStateOf(selectedId)}
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
	   filters while hidden. 🎛️ --tb-wipe is TB_WIPE_MS (lib/dock.ts). */
	/* 🎛️ THE BOARD'S WIDTH, read by the dock AND band B's cells (one rule, so
	   the two rows cannot drift). FIXED within a range, so the board's layout
	   stays stable; it steps up where the screen has room to give (⚓ Nate
	   2026-10-10: 580 alone read cramped and diminutive on a 1728px laptop).
	   The steps are the table's `broad` and `vast` — the same two the roster's
	   cards grow at ($lib/breakpoints.ts).
	     · 580 from the dock (1137): every boss heading on one line at 13px, and
	       the roster still holds four columns.
	     · 720 from 1500 · 800 from 1900. */
	.tb-dock,
	.tb-band {
		--tb-board-w: 580px;
		--tb-dock-gap: 16px;
	}
	@media (min-width: 1500px) {
		.tb-dock,
		.tb-band {
			--tb-board-w: 720px;
		}
	}
	@media (min-width: 1900px) {
		.tb-dock,
		.tb-band {
			--tb-board-w: 800px;
		}
	}
	.tb-dock {
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
		/* ↻ Responsive sweep 2026-10-15 item 18 (⚓ Nate): in the Lineup TAB the
		   board keeps the width it docks at, start-aligned, instead of
		   stretching to the pane. Stretched, a team ran 1089px wide at 1135
		   while its content ended at 440, so Planner →, the pin and the chips
		   stood ~520px from the lineup they belong to, and the 640px Abyss art
		   was drawn at up to 1089px. ⚠ --tb-board-w is 580 throughout this
		   range (it steps at `broad`), so this is the docked board exactly. */
		.tb-pane--board > :global(.bv) {
			max-width: var(--tb-board-w);
		}
	}
	/* …but not the phone form (below BP.compact, 40rem — $lib/breakpoints.ts):
	   there the board is the whole screen (BoardView's own narrow form), and
	   431–640 is left to the Builder's phone pass (sweep item 20). */
	@media (max-width: 40rem) {
		.tb-pane--board > :global(.bv) {
			max-width: none;
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
	/* The mark is painted over the field; the field takes the slack — up to
	   28rem, with More and the lens following it (↻ responsive sweep
	   2026-10-15 item 15, ⚓ Nate: uncapped, the field ran 2078px at 3440 and
	   the cell's controls sat a screen's width from where you type). */
	.tb-search {
		position: relative;
		flex: 1 1 8rem;
		min-width: 6rem;
		max-width: 28rem;
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
	/* ⚠ The SEGMENT'S buttons sit INSIDE its 2px track, so they are the band's
	   control height less the track — band B's blanket `.btn { height }` made
	   them 36 in a 36 track, and the selected ring and the hover hung 4px off
	   the track's foot. The track keeps the glass a band A segment wears. */
	.tb-show > .btn {
		height: calc(var(--band-ctrl-h) - 4px);
	}
	/* The lineup's rail: an empty plate that spans what its controls leave,
	   the shape of the Planner's band B middle. */
	.tb-rail {
		flex: 1;
		min-width: 0;
		align-self: stretch;
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
	   their mark and fold their word — one rule for every band control. ↻ The
	   lineup cell of band B too (pane switch + Add team): on a Custom board
	   below ~407px its flex:none children pushed No repeats off the screen
	   (87px spill at 320), and the fold returns ~160px. */
	@media (max-width: 40rem) {
		.tb-band-label {
			display: none;
		}
	}

	/* ↻ 2026-10-08: Clear team and the Compare plate's avatar stack retired
	   with the shared working team and the Compare tab (lineups design §6). */

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
	   into the audition (since retired into swap mode), so only the head
	   survives. */
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

	/* The stubs bucket's grid (the roster's own is CharacterGrid's). It READS
	   the roster's --cg-* knobs on .tb-roster rather than restating them, so
	   tiles read identically beside the roster at every width — ↻ the copied
	   118px literal outlived the roster's 108 retune and drew the stub tile up
	   to 54% wider (390: 168 vs 109). The 1500/1900 steps ride the knobs too. */
	.tb-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(var(--cg-tile-min, 108px), 1fr));
		gap: var(--cg-gap, 0.6rem);
	}

	.tb-stubs {
		margin-top: 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	/* The destination strip: where a pick goes, keyed by its team's hue. */
	/* THE DESTINATION BANNER (⚓ Nate 2026-10-13): a full-width narrow band in
	   the selected team's hue — the team the grid is working FOR, said in
	   the colour its frames and its row's edge already wear. The hues are
	   bright, so the ink is the bright-fill ink. */
	.tb-dest {
		flex: none;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 26px;
		margin: 0;
		padding: 2px 4px 2px 10px;
		border-radius: var(--r-sm);
		background: var(--team-hue);
		color: var(--bright-ink);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
	}
	/* The count FOLLOWS the message (↻ responsive sweep 2026-10-15 item 15,
	   ⚓ Nate): pushed to the band's end it sat 2560px from what it counts at
	   3440. Swapping, the ✕ still ends the band (.tb-dest-close). */
	.tb-dest-count {
		margin-left: 0.75rem;
		padding-right: 6px;
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		white-space: nowrap;
	}
	.tb-dest-note {
		margin-left: 0.35em;
		text-transform: none;
		letter-spacing: var(--ls-tight);
		font-weight: var(--fw-regular, 400);
	}
	/* Swapping, the banner ends in its ✕ (Escape does the same) — bare ink on
	   the hue, not a plate. */
	.tb-dest-close {
		margin-left: auto;
		width: 22px;
		height: 22px;
		background: none;
		color: inherit;
	}
	/* ── SWAP MODE'S SECTIONS (§11.6 item 20) ── */
	.tb-swap-tier {
		margin: 0.6rem 0 -0.1rem;
	}
	.tb-swap-head {
		font-size: var(--fs-md);
	}
	.tb-swap-foot {
		margin: 0.6rem 0 0;
		display: flex;
		justify-content: center;
	}
	.tb-swap-quiet {
		color: var(--muted);
	}
	.tb-roster-hint {
		flex: none;
		margin: 0;
		color: var(--muted);
		font-size: var(--fs-sm);
	}
	.tb-roster-hint .link {
		padding: 0;
		border: none;
		background: none;
		font: inherit;
		cursor: pointer;
	}
</style>
