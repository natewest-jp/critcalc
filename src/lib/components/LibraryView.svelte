<script lang="ts">
	/**
	 * LibraryView — THE LIBRARY (lineups design §10.1, §10.1a; build step 4):
	 * its tabs, search, sections and the Roster. ONE view with two hosts — the
	 * overlay a tool opens (`LibraryOverlay`, a scrim and a window around this)
	 * and the standalone page (`/library`, in the static pages' panel). It
	 * replaced SavedNotationsOverlay. The flows are `library.svelte.ts`; the
	 * grouping and the tags are `library.ts`; this file is the view.
	 *
	 * ⚓ What a click does is the FLOWS' business, never the host's: on the page
	 * no tool is mounted, so `library.atPage()` puts the flows in their
	 * "elsewhere" mode and every pick travels to its document's home (§10.1a).
	 *
	 * ⚓ The Shelf (Nate 2026-10-09, from the /lab/library demos): teams in the
	 * main column — the heading is the names-only TEAM entry, never a rotation —
	 * and Recently closed (three, then "N more") over Boards in the side column.
	 *
	 * ⚓ THE STRIP IS THE BUTTON: a rotation row, a team heading, a board card
	 * and a Recently closed row are each one click meaning "use this here"; a
	 * hover hint names the click, ⋯ holds the rest.
	 *
	 * ⚓ ONE GRID for every row in the Teams column (Nate 2026-10-09): teams,
	 * headings, rotation lists and rotations are subgrids, so the middle zone
	 * (constellation chips at rest, the hint on hover) sits on one line through
	 * the whole library and the right clusters align. A heading spans left +
	 * middle and is always as tall as a NICKNAMED one (an invisible sizer).
	 *
	 * ⚓ Filtering is the search box: Enter turns a suggestion into a TAG (a
	 * character, "Traveler", an element or a reaction); tags AND together;
	 * leftover text searches names.
	 */
	import { onMount, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import Mark from './Mark.svelte';
	import SidePortrait from './SidePortrait.svelte';
	import CompositionChips from './CompositionChips.svelte';
	import { getCharacterIndexEntry, shortName } from '$lib/data/characterLookup';
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import {
		constellations,
		lastTouched,
		ownership,
		savedBoards,
		savedNotations,
		type SavedBoard,
		type SavedNotation
	} from '$lib/stores';
	import { recentlyClosedRotations } from '$lib/documentBar.svelte';
	import { recentlyClosedBoards, type Board } from '$lib/boards.svelte';
	import type { RotationTab } from '$lib/rotationTabs.svelte';
	import { orderedCharacterIds, teamKey } from '$lib/utils/notationEdit';
	import { sideLayout } from '$lib/sidePortrait';
	import {
		libraryTeams,
		reactionsOf,
		suggestTags,
		tagMatches,
		type LibraryTag,
		type LibraryTeam
	} from '$lib/library';
	import { library } from '$lib/library.svelte';
	import RosterTab from './RosterTab.svelte';
	import { rosterView } from '$lib/rosterView.svelte';
	import type { LibraryTab } from '$lib/library.svelte';

	let {
		onclose,
		standalone = false,
		ontab
	}: {
		/** The overlay's close: shows ✕, and Escape's last step calls it. The
		 *  page passes none — it is left like any other page. */
		onclose?: () => void;
		/** Rendered as the `/library` page rather than inside the overlay. */
		standalone?: boolean;
		/** A tab was picked (the page mirrors it into its URL). */
		ontab?: (tab: LibraryTab) => void;
	} = $props();

	function setTab(tab: LibraryTab) {
		library.tab = tab;
		ontab?.(tab);
	}

	// ── The bank, grouped ────────────────────────────────────────────────────
	const teams = $derived(libraryTeams($savedNotations, $savedBoards));
	const ids = (notation: string) => orderedCharacterIds(notation).slice(0, 4);
	const nameOf = (id: string) => getCharacterIndexEntry(id)?.displayName ?? id;

	const boardsList = $derived([...$savedBoards].sort((a, b) => lastTouched(b) - lastTouched(a)));

	type Closed =
		| {
				kind: 'rotation';
				id: string;
				name: string;
				slots: string[];
				when: number;
				tab: RotationTab;
		  }
		| { kind: 'board'; id: string; name: string; slots: string[]; when: number; board: Board };
	const closed = $derived(
		[
			...$recentlyClosedRotations.map(
				(e): Closed => ({
					kind: 'rotation',
					id: `r:${e.tab.id}`,
					name: e.tab.label,
					slots: ids(e.tab.notation),
					when: e.closedAt,
					tab: e.tab
				})
			),
			...$recentlyClosedBoards.map(
				(e): Closed => ({
					kind: 'board',
					id: `b:${e.tab.id}`,
					name: e.tab.label,
					slots:
						(e.tab.teams.find((t) => t.slots.some((s) => s)) ?? e.tab.teams[0])?.slots.filter(
							(s): s is string => !!s
						) ?? [],
					when: e.closedAt,
					board: e.tab
				})
			)
		].sort((a, b) => b.when - a.when)
	);

	// ── Ownership (§9.5): compared only once the roster has content ─────────
	const rosterHasContent = $derived(Object.values($ownership).includes('owned'));
	const ownedCon = (id: string): number | null | undefined =>
		!rosterHasContent ? undefined : $ownership[id] === 'owned' ? ($constellations[id] ?? 0) : null;
	/** A rotation's level for a member: its own (saved levels are pinned), else
	 *  the roster's. */
	const levelOf = (e: SavedNotation, id: string) => e.tabCon?.[id] ?? $constellations[id] ?? 0;

	// ── Search ───────────────────────────────────────────────────────────────
	let query = $state('');
	let tags = $state<LibraryTag[]>([]);
	let activeSuggestion = $state(0);
	let inputEl = $state<HTMLInputElement>();

	const everyone = $derived([...new Set(teams.flatMap((t) => t.slots))]);
	const allReactions = $derived([...new Set(teams.flatMap((t) => reactionsOf(t.slots)))]);
	const suggestions = $derived(suggestTags(query, everyone, allReactions, tags));

	function addTag(t: LibraryTag) {
		tags = [...tags, t];
		query = '';
		activeSuggestion = 0;
		inputEl?.focus();
	}
	function onSearchKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && suggestions.length) {
			e.preventDefault();
			addTag(suggestions[Math.min(activeSuggestion, suggestions.length - 1)]);
		} else if (e.key === 'ArrowDown' && suggestions.length) {
			e.preventDefault();
			activeSuggestion = (activeSuggestion + 1) % suggestions.length;
		} else if (e.key === 'ArrowUp' && suggestions.length) {
			e.preventDefault();
			activeSuggestion = (activeSuggestion - 1 + suggestions.length) % suggestions.length;
		} else if (e.key === 'Backspace' && query === '' && tags.length) {
			tags = tags.slice(0, -1);
		}
	}

	/** Tags AND together. Free text matches only while no suggestion is being
	 *  typed toward — otherwise "Mav" would empty the list before Enter. */
	const matches = (slots: string[], words: string[]) => {
		if (!tags.every((t) => tagMatches(t, slots))) return false;
		const q = query.trim().toLowerCase();
		if (!q || suggestions.length) return true;
		return words.some((w) => w.toLowerCase().includes(q));
	};

	const shownTeams = $derived(
		teams.filter((t) =>
			matches(t.slots, [
				...t.slots.map(nameOf),
				t.nickname ?? '',
				...t.rotations.map((r) => r.name)
			])
		)
	);
	const boardSlots = (b: SavedBoard) => b.teams.map((t) => t.slots.filter((s): s is string => !!s));
	const shownBoards = $derived(
		boardsList.filter((b) =>
			boardSlots(b).some((slots) => matches(slots, [b.name, ...slots.map(nameOf)]))
		)
	);
	const shownClosed = $derived(
		closed.filter((c) => matches(c.slots, [c.name, ...c.slots.map(nameOf)]))
	);
	let closedOpen = $state(false);
	const CLOSED_PEEK = 3;

	// ── Words ────────────────────────────────────────────────────────────────
	// ⏭ Working copy from the demos; the copy step (8) judges every string.
	const now = Date.now();
	const ago = (t: number) => {
		const m = Math.round((now - t) / 60_000);
		if (m < 1) return 'Just now';
		if (m < 60) return `${m} min ago`;
		const h = Math.round(m / 60);
		if (h < 24) return `${h} h ago`;
		const d = Math.round(h / 24);
		return d === 1 ? 'Yesterday' : `${d} days ago`;
	};
	const PRESET_NAME: Record<string, string> = {
		stygian: 'Stygian',
		abyss: 'Abyss',
		custom: 'Custom'
	};

	/** What a click does, in words — per the tool that opened the library.
	 *  `away` (the page, or a page that is neither tool): a Planner pick then
	 *  GOES to the Planner, so the hint names where it lands. */
	const hint = $derived({
		rotation: library.away
			? 'Open in the Planner'
			: library.from === 'planner'
				? 'Open in a new tab'
				: library.builderHere
					? `Pin to ${library.builderHere}`
					: 'Add to the lineup, pinned',
		team: library.away
			? 'Open in the Planner'
			: library.from === 'planner'
				? 'New tab with these four'
				: library.builderHere
					? `Put on ${library.builderHere}`
					: 'Add to the lineup',
		board: library.from === 'builder' ? 'Open as a tab' : 'Open in the Team Builder',
		closedBoard: library.from === 'builder' ? 'Reopen' : 'Reopen in the Team Builder',
		closedRotation: library.from === 'planner' && !library.away ? 'Reopen' : 'Reopen in the Planner'
	});

	// ── The ⋯ menu (one open at a time) ──────────────────────────────────────
	type MenuItem = { label: string; danger?: boolean; run: () => void };
	let menu = $state<{ id: string; items: MenuItem[] } | null>(null);
	function openMenu(e: MouseEvent, id: string, items: MenuItem[]) {
		e.stopPropagation();
		menu = menu?.id === id ? null : { id, items };
	}

	// ── Inline rename (a rotation, a nickname, a board) ─────────────────────
	let editing = $state<{ id: string; value: string; commit: (v: string) => void } | null>(null);
	async function startEdit(id: string, value: string, commit: (v: string) => void) {
		editing = { id, value, commit };
		await tick();
		const el = document.querySelector<HTMLInputElement>('.lib-edit');
		el?.focus();
		el?.select();
	}
	function finishEdit(save: boolean) {
		const e = editing;
		editing = null;
		if (save && e) e.commit(e.value);
	}
	function editKey(e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'Enter') finishEdit(true);
		else if (e.key === 'Escape') finishEdit(false);
	}

	// ── The one confirm ──────────────────────────────────────────────────────
	let confirm = $state<{ title: string; body: string; action: string; run: () => void } | null>(
		null
	);

	const rotationMenu = (r: SavedNotation): MenuItem[] => [
		{
			label: 'Rename',
			run: () => startEdit(`r:${r.id}`, r.name, (v) => library.renameRotation(r, v))
		},
		{ label: 'Copy share link', run: () => library.shareRotation(r) },
		{
			label: library.from === 'builder' ? 'Open in the Planner' : 'Put on a lineup',
			run: () => library.openRotationElsewhere(r)
		},
		{
			label: 'Delete',
			danger: true,
			run: () =>
				(confirm = {
					title: `Delete “${r.name}”?`,
					body: 'It goes to Recently closed, where you can reopen it.',
					action: 'Delete',
					run: () => library.deleteRotation(r)
				})
		}
	];
	const teamMenu = (t: LibraryTeam): MenuItem[] => [
		{
			label: t.nickname ? 'Rename nickname' : 'Add a nickname',
			run: () => startEdit(`t:${t.key}`, t.nickname ?? '', (v) => library.setNickname(t, v))
		},
		...(library.from !== 'builder'
			? [{ label: 'Put on a lineup', run: () => library.putTeamOnBoard(t) }]
			: []),
		{
			label: 'Delete team',
			danger: true,
			run: () =>
				(confirm = {
					title: 'Delete this team?',
					body:
						t.rotations.length === 0
							? 'Lineups that use it keep their four characters.'
							: t.rotations.length === 1
								? 'Its rotation goes to Recently closed. Lineups that use the team keep their four characters.'
								: `Its ${t.rotations.length} rotations go to Recently closed. Lineups that use the team keep their four characters.`,
					action: 'Delete team',
					run: () => library.deleteTeam(t)
				})
		}
	];
	const boardMenu = (b: SavedBoard): MenuItem[] => [
		{
			label: 'Rename',
			run: () => startEdit(`b:${b.id}`, b.name, (v) => library.renameBoard(b, v))
		},
		{ label: 'Copy share link', run: () => library.shareBoard(b) },
		{
			label: 'Delete',
			danger: true,
			run: () =>
				(confirm = {
					title: `Delete “${b.name}”?`,
					body: 'It goes to Recently closed, where you can reopen it.',
					action: 'Delete',
					run: () => library.deleteBoard(b)
				})
		}
	];
	const closedMenu = (c: Closed): MenuItem[] => [
		{
			label: 'Save to library',
			run: () =>
				c.kind === 'rotation' ? library.saveClosedRotation(c.tab) : library.saveClosedBoard(c.board)
		},
		{
			label: 'Forget',
			danger: true,
			run: () =>
				c.kind === 'rotation'
					? recentlyClosedRotations.remove(c.tab.id)
					: recentlyClosedBoards.remove(c.board.id)
		}
	];

	/** A strip is a div with button semantics, so ⋯ and Sync can live inside it. */
	function activate(e: KeyboardEvent, run: () => void) {
		if (e.target !== e.currentTarget) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			run();
		}
	}

	/** Escape unwinds one layer at a time: an edit, the confirm, a menu, the
	 *  search's suggestions, then the library itself (the overlay's close).
	 *  ⚠ On the PAGE a consumed Escape is marked `defaultPrevented`: the pages
	 *  layout returns to the landing on Escape, and it must not also do that
	 *  for the keypress that only dismissed a menu. It listens in the CAPTURE
	 *  phase there so it runs before the layout's window listener. */
	function onKey(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (editing) finishEdit(false);
		else if (confirm) confirm = null;
		else if (menu) menu = null;
		else if (query) query = '';
		else if (onclose) onclose();
		else return;
		if (standalone) e.preventDefault();
	}

	const HEAD_DISC = 48;
	/** How far a heading's hair rises above its discs. The hover box is fitted
	 *  to the DISCS and the hair breaks out of its top edge (the Stygian look);
	 *  the section's top padding pays for it instead. */
	const HEAD_OVERHANG = sideLayout(HEAD_DISC).overhang;

	const pinName = (id?: string) =>
		id ? $savedNotations.find((e) => e.id === id)?.name : undefined;
	const pinHolds = (slots: (string | null)[], id?: string) => {
		const e = id ? $savedNotations.find((x) => x.id === id) : undefined;
		return !!e && teamKey(ids(e.notation)) === teamKey(slots);
	};

	// The overlay takes the keyboard on open; a page does not grab focus (on a
	// phone that would raise the keyboard over the page on arrival).
	onMount(() => {
		if (!standalone) inputEl?.focus();
	});

	const ownedTotal = $derived(Object.values($ownership).filter((m) => m === 'owned').length);
	const wishTotal = $derived(Object.values($ownership).filter((m) => m === 'wishlist').length);
</script>

<svelte:window
	onclick={() => (menu = null)}
	onkeydown={standalone ? undefined : onKey}
	onkeydowncapture={standalone ? onKey : undefined}
/>

{#snippet tagMark(t: LibraryTag, size: number)}
	{#if t.kind === 'char' && t.id !== 'traveler'}
		<SidePortrait id={t.id} {size} />
	{:else if t.kind === 'element' && elementIcon(t.id)}
		<img class="lib-tag-icon" src={elementIcon(t.id)} alt="" />
	{:else if t.kind === 'reaction'}
		<Mark name="aura" size={12} />
	{/if}
{/snippet}

{#snippet more(id: string, items: MenuItem[], label: string)}
	<span class="lib-more">
		<button
			class="btn btn--icon lib-more-btn"
			aria-label={label}
			aria-expanded={menu?.id === id}
			onclick={(e) => openMenu(e, id, items)}><Mark name="more" size={14} /></button
		>
		{#if menu?.id === id}
			<span
				class="lib-menu"
				role="menu"
				transition:fade={{ duration: motion(T_QUICK) }}
				onintrostart={introLive}
				onoutrostart={outroInert}
			>
				{#each menu.items as item (item.label)}
					<button
						role="menuitem"
						class="lib-menu-item"
						class:lib-menu-item--danger={item.danger}
						onclick={(e) => {
							e.stopPropagation();
							menu = null;
							item.run();
						}}>{item.label}</button
					>
				{/each}
			</span>
		{/if}
	</span>
{/snippet}

{#snippet editField()}
	{#if editing}
		<input
			class="lib-edit"
			bind:value={editing.value}
			onkeydown={editKey}
			onclick={(e) => e.stopPropagation()}
			onblur={() => finishEdit(true)}
		/>
	{/if}
{/snippet}

{#snippet heading(t: LibraryTeam)}
	{@const run = () => library.openTeam(t)}
	{@const isEditing = editing?.id === `t:${t.key}`}
	<div
		class="lib-strip lib-head"
		role="button"
		tabindex="0"
		onclick={() => !isEditing && run()}
		onkeydown={(e) => activate(e, run)}
	>
		<div class="lib-head-left">
			<div class="lib-faces lib-faces--head" style:--head-over="{HEAD_OVERHANG}px">
				{#each t.slots as id (id)}<SidePortrait {id} size={HEAD_DISC} />{/each}
				{#each { length: 4 - t.slots.length } as _, i (i)}<SidePortrait
						id={null}
						size={HEAD_DISC}
					/>{/each}
			</div>
			<!-- Every heading is as tall as a NICKNAMED one (Nate 2026-10-09). A
			     heading without a nickname carries an invisible copy of itself WITH
			     a nickname line in the same cell, and the real text centres against
			     it, so the heights match by construction, not by a number. -->
			<div class="lib-head-textbox">
				{#if !t.nickname && !isEditing}
					<div class="lib-head-text lib-head-sizer" aria-hidden="true">
						<span class="lib-nick">&nbsp;</span>
						<CompositionChips ids={t.slots} reactions={false} />
						<span class="lib-meta">&nbsp;</span>
					</div>
				{/if}
				<div class="lib-head-text">
					{#if isEditing}
						{@render editField()}
					{:else if t.nickname}<span class="lib-nick">{t.nickname}</span>{/if}
					<CompositionChips ids={t.slots} reactions={false} />
					<span class="lib-meta">
						{t.rotations.length === 0
							? 'No rotation yet'
							: t.rotations.length === 1
								? '1 rotation'
								: `${t.rotations.length} rotations`} · {ago(t.touched)}{#if t.boards.length}
							· on {t.boards.join(', ')}{/if}
					</span>
				</div>
			</div>
		</div>
		<!-- A heading needs the left AND middle tracks; its hint sits at its
		     right end beside ⋯ (empty space on a heading). -->
		<div class="lib-head-end">
			<span class="lib-hint">{hint.team}</span>
			{@render more(`t:${t.key}`, teamMenu(t), 'More: nickname, delete team')}
		</div>
	</div>
{/snippet}

{#snippet rotationRow(r: SavedNotation)}
	{@const run = () => library.openRotation(r)}
	{@const isEditing = editing?.id === `r:${r.id}`}
	{@const raised = ids(r.notation)
		.map((id) => [id, levelOf(r, id)] as const)
		.filter(([id, c]) => {
			const own = ownedCon(id);
			return c > 0 || (own !== undefined && (own === null || own < c));
		})}
	<div
		class="lib-strip lib-rot"
		role="button"
		tabindex="0"
		onclick={() => !isEditing && run()}
		onkeydown={(e) => activate(e, run)}
	>
		<div class="lib-rot-main">
			{#if isEditing}
				{@render editField()}
			{:else}
				<span class="lib-rot-name">{r.name}</span>
			{/if}
			<code class="lib-rot-notation">{r.notation}</code>
		</div>
		<!-- The middle zone: the constellation chips at rest, the click's hint on
		     hover. Both live in one grid cell, so the zone is always wide enough
		     for either and the hint never lands on other content. -->
		<div class="lib-mid">
			<span class="lib-cons">
				{#each raised as [id, c] (id)}
					{@const own = ownedCon(id)}
					{@const short = own !== undefined && (own === null || own < c)}
					<span
						class="lib-con"
						class:lib-con--short={short}
						title={short
							? own === null
								? `You don't own ${nameOf(id)}`
								: `This rotation uses C${c} · you own C${own}`
							: ''}>{shortName(id)} C{c}</span
					>
				{/each}
			</span>
			<span class="lib-hint">{hint.rotation}</span>
		</div>
		<div class="lib-rot-side">
			<span class="lib-date">{ago(lastTouched(r))}</span>
			<!-- ⚓ Sync is per ROTATION and shown once the roster has content
			     (§10.4). "Sync", not "Sync with roster" — the longer word read as
			     nagging (Nate 2026-10-09). -->
			{#if rosterHasContent}
				{#if r.synced}
					<span class="lib-synced" title="Follows your roster's constellations"
						><Mark name="link" size={11} /> Synced</span
					>
				{:else}
					<button
						class="btn btn--sm lib-sync"
						title="Use your roster's constellations from now on"
						onclick={(e) => {
							e.stopPropagation();
							confirm = {
								title: `Sync “${r.name}” to your roster?`,
								body: "Your roster's constellations will replace this rotation's for every character you own, and it will keep following your roster from now on.",
								action: 'Sync',
								run: () => library.syncRotation(r)
							};
						}}><Mark name="link" size={11} /> Sync</button
					>
				{/if}
			{/if}
			{@render more(`r:${r.id}`, rotationMenu(r), 'More: rename, share, delete')}
		</div>
	</div>
{/snippet}

{#snippet boardCard(b: SavedBoard)}
	{@const run = () => library.openBoard(b)}
	{@const isEditing = editing?.id === `b:${b.id}`}
	<div
		class="lib-strip lib-board"
		role="button"
		tabindex="0"
		onclick={() => !isEditing && run()}
		onkeydown={(e) => activate(e, run)}
	>
		<header class="lib-board-head">
			{#if isEditing}
				{@render editField()}
			{:else}
				<span class="lib-board-name">{b.name}</span>
			{/if}
			<!-- The meta and the hint share one cell: the hint REPLACES it on hover,
			     as the chips give way on a rotation strip. -->
			<span class="lib-end lib-end--rot">
				<span class="lib-meta lib-date"
					>{PRESET_NAME[b.preset] ?? b.preset} · {ago(lastTouched(b))}</span
				>
				<span class="lib-hint">{hint.board}</span>
			</span>
			{@render more(`b:${b.id}`, boardMenu(b), 'More: rename, share, delete')}
		</header>
		{#each b.teams as bt, i (bt.id)}
			{@const slots = bt.slots.filter((s): s is string => !!s)}
			{@const pin = pinHolds(bt.slots, bt.pinnedRotationId)
				? pinName(bt.pinnedRotationId)
				: undefined}
			<div class="lib-board-team">
				<span class="lib-board-n">{i + 1}</span>
				<div class="lib-faces lib-faces--tight">
					{#each slots as id (id)}<SidePortrait {id} size={32} />{/each}
				</div>
				{#if pin}
					<span class="lib-pin" title="Pinned rotation"><Mark name="pin" size={11} /> {pin}</span>
				{/if}
			</div>
		{/each}
	</div>
{/snippet}

{#snippet closedRow(c: Closed)}
	{@const run = () =>
		c.kind === 'rotation' ? library.reopenRotation(c.tab) : library.reopenBoard(c.board)}
	<div
		class="lib-strip lib-closed-row"
		role="button"
		tabindex="0"
		onclick={run}
		onkeydown={(e) => activate(e, run)}
	>
		<div class="lib-faces lib-faces--tight">
			{#each c.slots as id (id)}<SidePortrait {id} size={28} />{/each}
		</div>
		<span class="lib-closed-text">
			<span class="lib-closed-name">{c.name}</span>
			<span class="lib-end lib-end--rot">
				<span class="lib-meta lib-date"
					>{c.kind === 'board' ? 'Lineup' : 'Rotation'} · closed {ago(c.when)}</span
				>
				<span class="lib-hint">{c.kind === 'board' ? hint.closedBoard : hint.closedRotation}</span>
			</span>
		</span>
		{@render more(`c:${c.id}`, closedMenu(c), 'More: save, forget')}
	</div>
{/snippet}

<!-- The overlay's window (LibraryOverlay) or the page's panel is the frame;
     this fills it. -->
<div class="lib ctx-dark" class:lib--page={standalone}>
	<header class="lib-top">
		<div class="lib-head-start">
			<!-- The page's heading is its h1; in the overlay it heads a dialog. -->
			<svelte:element this={standalone ? 'h1' : 'h2'} class="lib-title">Library</svelte:element>
			<!-- ⚓ Two tabs (lineups design §11.6): the saved teams and boards, and
			     the ROSTER — the one place the roster is edited. -->
			<div class="segment lib-tabs" role="tablist" aria-label="Library">
				<button
					class="btn"
					class:is-active={library.tab === 'teams'}
					role="tab"
					aria-selected={library.tab === 'teams'}
					onclick={() => setTab('teams')}>Teams</button
				>
				<button
					class="btn"
					class:is-active={library.tab === 'roster'}
					role="tab"
					aria-selected={library.tab === 'roster'}
					onclick={() => setTab('roster')}>Roster</button
				>
			</div>
		</div>
		{#if library.tab === 'roster'}
			<!-- The totals ARE the Show filter: a click shows just those. -->
			<p class="lib-tally">
				<button
					class="lib-tally-btn"
					class:is-active={rosterView.show === 'owned'}
					aria-pressed={rosterView.show === 'owned'}
					onclick={() => (rosterView.show = rosterView.show === 'owned' ? 'all' : 'owned')}
					><strong>{ownedTotal}</strong> owned</button
				>
				·
				<button
					class="lib-tally-btn"
					class:is-active={rosterView.show === 'wishlist'}
					aria-pressed={rosterView.show === 'wishlist'}
					onclick={() => (rosterView.show = rosterView.show === 'wishlist' ? 'all' : 'wishlist')}
					><strong>{wishTotal}</strong> on your wishlist</button
				>
			</p>
		{:else}
			<div class="lib-search-wrap">
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<div class="lib-search" onclick={() => inputEl?.focus()}>
					<Mark name="search" size={14} />
					{#each tags as t, i (t.kind + t.id)}
						<span class="lib-tag lib-tag--{t.kind}">
							{@render tagMark(t, 18)}
							{t.label}
							<button
								class="lib-tag-x"
								aria-label="Remove {t.label}"
								onclick={(e) => {
									e.stopPropagation();
									tags = tags.filter((_, j) => j !== i);
								}}><Mark name="close" size={10} /></button
							>
						</span>
					{/each}
					<input
						bind:this={inputEl}
						type="search"
						aria-label="Search the library"
						placeholder={tags.length
							? 'Add another'
							: 'Search, or type a character, element or reaction'}
						bind:value={query}
						oninput={() => (activeSuggestion = 0)}
						onkeydown={onSearchKey}
					/>
				</div>
				{#if suggestions.length}
					<div class="lib-suggest" role="listbox">
						{#each suggestions as s, i (s.kind + s.id)}
							<button
								role="option"
								aria-selected={i === activeSuggestion}
								class="lib-suggest-item"
								class:lib-suggest-item--on={i === activeSuggestion}
								onmouseenter={() => (activeSuggestion = i)}
								onclick={() => addTag(s)}
							>
								{@render tagMark(s, 22)}
								<span>{s.label}</span>
								<span class="lib-meta lib-suggest-kind"
									>{s.kind === 'char'
										? 'Character'
										: s.kind === 'element'
											? 'Element'
											: 'Reaction'}</span
								>
								{#if i === activeSuggestion}<kbd class="lib-kbd">Enter</kbd>{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
		{#if onclose}
			<button class="btn btn--icon lib-close" aria-label="Close" onclick={onclose}
				><Mark name="close" size={16} /></button
			>
		{/if}
	</header>

	{#if library.tab === 'roster'}
		<RosterTab focus={library.rosterFocus} onFocused={() => (library.rosterFocus = null)} />
	{:else}
		<div class="lib-body">
			<div class="lib-col lib-scroll">
				<p class="kicker">Teams</p>
				<div class="lib-teams">
					{#each shownTeams as t (t.key)}
						<section class="lib-team">
							{@render heading(t)}
							{#if t.rotations.length}
								<div class="lib-rots">
									{#each t.rotations as r (r.id)}{@render rotationRow(r)}{/each}
								</div>
							{/if}
						</section>
					{:else}
						<p class="lib-empty">
							{teams.length
								? 'No team matches.'
								: 'Nothing saved yet. Save a rotation and its team appears here.'}
						</p>
					{/each}
				</div>
			</div>
			<div class="lib-col lib-scroll">
				{#if shownClosed.length}
					<p class="kicker">Recently closed</p>
					<div class="lib-closed">
						{#each closedOpen ? shownClosed : shownClosed.slice(0, CLOSED_PEEK) as c (c.id)}
							{@render closedRow(c)}
						{/each}
					</div>
					{#if shownClosed.length > CLOSED_PEEK}
						<button class="lib-closed-toggle" onclick={() => (closedOpen = !closedOpen)}>
							{closedOpen ? 'Show fewer' : `${shownClosed.length - CLOSED_PEEK} more`}
							<Mark name="chevron" size={12} />
						</button>
					{/if}
				{/if}
				<p class="kicker">Lineups</p>
				{#each shownBoards as b (b.id)}{@render boardCard(b)}{:else}
					<p class="lib-empty">
						{boardsList.length ? 'No lineup matches.' : 'No saved lineups yet.'}
					</p>
				{/each}
			</div>
		</div>
	{/if}

	{#if library.toast}<div
			class="lib-toast"
			role="status"
			transition:fade={{ duration: motion(T_QUICK) }}
		>
			{library.toast}
		</div>{/if}
</div>

{#if confirm}
	{@const c = confirm}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		class="lib-confirm-scrim"
		onclick={() => (confirm = null)}
		transition:fade={{ duration: motion(T_QUICK) }}
		onintrostart={introLive}
		onoutrostart={outroInert}
	></div>
	<div
		class="lib-confirm ctx-dark"
		role="alertdialog"
		aria-modal="true"
		aria-label={c.title}
		transition:fade={{ duration: motion(T_QUICK) }}
		onintrostart={introLive}
		onoutrostart={outroInert}
	>
		<p class="lib-confirm-title">{c.title}</p>
		<p class="lib-confirm-body">{c.body}</p>
		<div class="lib-confirm-actions">
			<button class="btn" onclick={() => (confirm = null)}>Cancel</button>
			<button
				class="btn btn--primary"
				onclick={() => {
					c.run();
					confirm = null;
				}}>{c.action}</button
			>
		</div>
	</div>
{/if}

<style>
	/* The portrait ring at --line-soft (Nate 2026-10-09): the library sits on
	   slate, where the board's faint night ring would vanish. */
	.lib :global(.spt-disc) {
		border-color: var(--line-soft);
	}
	/* The view FILLS its host — the overlay's window or the page's panel —
	   which owns the position, the size and the corner. */
	.lib {
		position: relative;
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1rem 1.25rem 0;
		background: var(--surface);
		color: var(--text);
		overflow: hidden;
	}
	/* On the page the panel is the ground and pays the padding. */
	.lib.lib--page {
		flex: 1;
		min-height: 0;
		height: auto;
		padding: 0;
		background: none;
	}
	/* Title · search · close. The search sits on the WINDOW's centre line
	   (Nate 2026-10-09): two equal flanks, the search in the middle track. */
	.lib-top {
		display: grid;
		grid-template-columns: minmax(max-content, 1fr) minmax(0, 36rem) minmax(max-content, 1fr);
		align-items: center;
		gap: 1rem;
	}
	.lib-close {
		justify-self: end;
	}
	.lib-head-start {
		display: flex;
		align-items: center;
		gap: 1.25rem;
	}
	.lib-tabs > .btn {
		height: 28px;
		padding: 0 0.9rem;
	}
	.lib-tally {
		margin: 0;
		justify-self: center;
		color: var(--muted);
		font-size: var(--fs-sm);
	}
	.lib-tally-btn {
		padding: 2px 4px;
		border: none;
		border-radius: var(--r-xs);
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition:
			background-color var(--t-snap),
			box-shadow var(--t-snap);
	}
	.lib-tally-btn:hover {
		background: var(--fill-hover);
	}
	.lib-tally-btn.is-active {
		background: var(--sel-fill);
		box-shadow: inset 0 0 0 1px var(--sel-ring);
	}
	.lib-tally strong {
		color: var(--text);
		font-weight: var(--fw-semibold);
	}
	/* Bitter at the headings' shared weight (the global h rule), section size. */
	.lib-title {
		margin: 0;
		font-size: var(--fs-4xl);
	}
	/* ── search + tags ── */
	.lib-search-wrap {
		position: relative;
		width: 100%;
	}
	.lib-search {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 5px;
		min-height: 32px;
		padding: 3px 0.6rem;
		border-radius: var(--r-sm, 3px);
		background: var(--surface-well);
		color: var(--muted);
		cursor: text;
	}
	.lib-search input {
		flex: 1 1 8rem;
		min-width: 6rem;
		border: none;
		background: none;
		color: var(--text);
		font: inherit;
		font-size: var(--fs-sm);
		outline: none;
	}
	.lib-tag {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 24px;
		padding: 0 4px 0 3px;
		border-radius: var(--r-round);
		background: var(--surface-raised);
		color: var(--text);
		font-size: var(--fs-sm);
		white-space: nowrap;
	}
	/* A tag's portrait has no room to overhang: hold it to the disc. */
	.lib-tag :global(.spt),
	.lib-suggest-item :global(.spt) {
		height: var(--d) !important;
		overflow: hidden;
		border-radius: var(--r-round);
	}
	.lib-tag :global(.spt-art),
	.lib-suggest-item :global(.spt-art) {
		top: var(--art-top) !important;
	}
	.lib-tag-icon {
		width: 16px;
		height: 16px;
	}
	.lib-tag-x {
		display: grid;
		place-items: center;
		width: 16px;
		height: 16px;
		padding: 0;
		border: none;
		border-radius: var(--r-round);
		background: none;
		color: var(--muted);
		cursor: pointer;
		transition:
			background-color var(--t-snap),
			color var(--t-snap);
	}
	.lib-tag-x:hover {
		color: var(--text);
		background: var(--surface-well);
	}
	.lib-suggest {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(100% + 4px);
		z-index: 10;
		display: flex;
		flex-direction: column;
		padding: 4px;
		border-radius: var(--r-sm, 3px);
		background: var(--surface-raised);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.45);
	}
	.lib-suggest-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 8px;
		border: none;
		border-radius: var(--r-sm, 3px);
		background: none;
		color: var(--text);
		font: inherit;
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
	}
	.lib-suggest-item--on {
		background: var(--surface-well);
	}
	.lib-suggest-kind {
		margin-left: auto;
	}
	.lib-kbd {
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		padding: 1px 5px;
		border-radius: var(--r-sm, 3px);
		background: var(--surface-raised);
		color: var(--muted);
	}

	.lib-body {
		flex: 1;
		min-height: 0;
		display: grid;
		/* Both flexible: a capped side track (minmax(16rem, 26rem)) fills to its
		   cap BEFORE Teams' fr gets any leftover, and squeezed Teams at ~900. */
		grid-template-columns: minmax(0, 2.4fr) minmax(16rem, 1fr);
		gap: 2rem;
	}
	.lib-col {
		min-height: 0;
	}
	.lib-scroll {
		overflow-y: auto;
		padding-bottom: 1.25rem;
	}
	.kicker {
		margin: 0.25rem 0 0.6rem;
	}
	.lib-empty {
		color: var(--muted);
		font-size: var(--fs-sm);
	}

	/* ── The strip: the whole row is the button ── */
	.lib-strip {
		cursor: pointer;
		border-radius: var(--r-sm, 3px);
		transition: background-color var(--t-snap);
	}
	.lib-strip:focus-visible {
		outline: 2px solid var(--sel-ring);
		outline-offset: 1px;
	}
	/* The hint takes the date's place on hover/focus, so nothing shifts. */
	.lib-end {
		display: inline-grid;
		align-items: center;
		justify-items: end;
		grid-auto-flow: column;
		gap: 4px;
	}
	.lib-end--rot > * {
		grid-area: 1 / 1;
	}
	.lib-hint {
		font-size: var(--fs-md);
		color: var(--accent);
		white-space: nowrap;
		visibility: hidden;
	}
	.lib-strip:hover .lib-hint,
	.lib-strip:focus-visible .lib-hint {
		visibility: visible;
	}
	.lib-strip:hover .lib-end--rot .lib-date,
	.lib-strip:focus-visible .lib-end--rot .lib-date {
		visibility: hidden;
	}
	/* A hovered ⋯ / Sync / menu is its own target: the strip stands down. */
	.lib-strip:has(.lib-more-btn:hover, .lib-sync:hover, .lib-menu:hover) .lib-hint {
		visibility: hidden;
	}
	.lib-strip:has(.lib-more-btn:hover, .lib-sync:hover, .lib-menu:hover) .lib-end--rot .lib-date {
		visibility: visible;
	}

	/* ── shared pieces ── */
	.lib-faces {
		display: flex;
		align-items: flex-end;
		gap: 6px;
	}
	.lib-faces--head {
		margin-top: calc(-1 * var(--head-over));
	}
	.lib-faces--tight {
		gap: 3px;
	}
	/* No rules between teams (Nate 2026-10-09): spacing separates them. */
	/* The top padding holds the hair that rises out of the heading's box. */
	.lib-team {
		padding: 1.6rem 0 0.6rem;
	}
	/* Inset like the rotation rows below it (no negative margin: that put the
	   hover's left padding outside the column and scrolled it sideways). */
	.lib-head {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: subgrid;
		align-items: center;
		padding: 0.35rem 0.6rem 0.45rem;
	}
	.lib-head-left {
		grid-column: 1 / 3;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 1rem;
		min-width: 0;
	}
	.lib-head-end {
		grid-column: 3;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
	}
	.lib-head:hover:not(:has(.lib-more-btn:hover, .lib-menu:hover)) {
		background: var(--surface-raised);
	}
	.lib-head-textbox {
		display: grid;
		flex: 0 1 auto;
		min-width: 0;
	}
	.lib-head-textbox > * {
		grid-area: 1 / 1;
	}
	.lib-head-text {
		display: flex;
		flex-direction: column;
		gap: 5px;
		min-width: 0;
		align-self: center;
		padding-bottom: 2px;
	}
	.lib-head-sizer {
		visibility: hidden;
	}
	.lib-nick {
		font-family: var(--font-display);
		font-weight: var(--fw-semibold);
		font-size: var(--fs-2xl);
	}
	.lib-meta {
		font-size: var(--fs-xs);
		color: var(--muted);
	}
	/* ⚓ ONE column grid for every row in the Teams column (Nate 2026-10-09:
	   middles centred against differing left siblings looked sloppy). Teams,
	   headings, rotation lists and rotations are all SUBGRIDS of it, so:
	     left   a fixed share; a longer name/notation fades out at its edge;
	     middle the same track everywhere — chips and hints on one line;
	     right  as wide as the widest cluster — dates, Sync and ⋯ align. */
	.lib-teams {
		display: grid;
		/* ⚠ The middle's minimum is a LENGTH, not max-content: a heading spans
		   left + middle, and a content-sized track grows to fit the whole
		   heading (measured: 540px, the column scrolled sideways at 1100). 11rem
		   holds the widest chip set and the longest hint. */
		grid-template-columns: minmax(0, 1.6fr) minmax(11rem, 1fr) max-content;
		column-gap: 0.75rem;
	}
	.lib-team,
	.lib-rots {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: subgrid;
	}
	.lib-rots {
		margin: 0.4rem 0 0;
		row-gap: 2px;
	}
	/* Left · middle · right. The left takes what it needs (the notation
	   truncates past that), the middle the rest, the right its controls. */
	.lib-rot {
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
		align-items: center;
		column-gap: 0.75rem;
		padding: 0.45rem 0.6rem;
		background: var(--surface-well);
	}
	.lib-mid {
		flex: 1;
		align-self: stretch;
		display: grid;
		place-items: center;
	}
	.lib-mid > * {
		grid-area: 1 / 1;
	}
	.lib-cons {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
		justify-content: center;
	}
	.lib-strip:hover .lib-cons,
	.lib-strip:focus-visible .lib-cons {
		visibility: hidden;
	}
	.lib-strip:has(.lib-more-btn:hover, .lib-sync:hover, .lib-menu:hover) .lib-cons {
		visibility: visible;
	}
	.lib-rot:hover:not(:has(.lib-more-btn:hover, .lib-sync:hover, .lib-menu:hover)) {
		background: var(--surface-raised);
	}
	.lib-rot-main {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	.lib-rot-name {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
	}
	/* Past the left track's edge the text FADES rather than ellipsising — the
	   track is the limit, and a fade reads as "there is more" without a glyph. */
	.lib-rot-name,
	.lib-rot-notation {
		overflow: hidden;
		white-space: nowrap;
		mask-image: linear-gradient(to right, #000 calc(100% - 2rem), transparent);
	}
	.lib-rot-notation {
		font-size: var(--fs-xs);
		color: var(--muted);
	}
	.lib-rot-side {
		display: flex;
		align-items: center;
		gap: 8px;
		justify-content: flex-end;
	}
	.lib-con {
		font-size: var(--fs-xs);
		padding: 1px 6px;
		border-radius: var(--r-round);
		background: var(--line-strong);
	}
	.lib-con--short {
		background: none;
		box-shadow: inset 0 0 0 1px var(--muted);
		color: var(--muted);
	}
	.lib-synced {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: var(--fs-xs);
		color: var(--muted);
	}
	.lib-date {
		font-size: var(--fs-xs);
		color: var(--muted);
	}

	/* ── ⋯ ── */
	.lib-more {
		position: relative;
	}
	.lib-menu {
		position: absolute;
		right: 0;
		top: calc(100% + 4px);
		z-index: 5;
		display: flex;
		flex-direction: column;
		min-width: 12rem;
		padding: 4px;
		border-radius: var(--r-sm, 3px);
		background: var(--surface-raised);
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.4);
	}
	.lib-menu-item {
		padding: 6px 10px;
		border: none;
		border-radius: var(--r-sm, 3px);
		background: none;
		color: var(--text);
		font: inherit;
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
		/* A menu row is a CONTROL (NavPanel's .np-row); `color` for the danger
		   variant's hover. */
		transition:
			background-color var(--t-snap),
			color var(--t-snap);
	}
	.lib-menu-item:hover {
		background: var(--surface-well);
	}
	/* The band menu's destructive reading (BandMenu.svelte) — ⚠ this was
	   `var(--debuff)`, which doesn't exist, so Delete rendered plain white. */
	.lib-menu-item--danger {
		color: color-mix(in srgb, var(--ui-danger) 70%, var(--text));
	}
	.lib-menu-item--danger:hover {
		background: var(--ui-danger-soft);
		color: var(--ui-danger);
	}

	/* ── boards ── */
	.lib-board {
		padding: 0.7rem 0.8rem;
		background: var(--surface-well);
		margin-bottom: 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.lib-board:hover:not(:has(.lib-more-btn:hover, .lib-menu:hover)) {
		background: var(--surface-raised);
	}
	/* Name · meta (the hint replaces it) · ⋯. The name's track is what is left,
	   so it fades only when it truly runs into the meta. */
	.lib-board-head {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0.6rem;
	}
	.lib-board-name {
		overflow: hidden;
		white-space: nowrap;
		mask-image: linear-gradient(to right, #000 calc(100% - 1.5rem), transparent);
	}
	.lib-board-name {
		font-weight: var(--fw-semibold);
	}
	.lib-board-team {
		display: flex;
		align-items: flex-end;
		gap: 0.6rem;
	}
	.lib-board-n {
		width: 1rem;
		font-size: var(--fs-xs);
		color: var(--muted);
		padding-bottom: 8px;
	}
	/* A narrow side column: the pinned name fades at the card's edge, as the
	   notation does. */
	.lib-pin {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		flex: 1 1 0;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		mask-image: linear-gradient(to right, #000 calc(100% - 1.5rem), transparent);
		font-size: var(--fs-xs);
		color: var(--muted);
		padding-bottom: 8px;
	}

	/* ── recently closed ── */
	.lib-closed {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.lib-closed-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.3rem 0.4rem;
	}
	.lib-closed-row:hover:not(:has(.lib-more-btn:hover, .lib-menu:hover)) {
		background: var(--surface-raised);
	}
	.lib-closed-text {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}
	/* In-place swap under the name; clipped rather than widening the row. */
	.lib-closed-text .lib-end--rot {
		justify-items: start;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
	}
	.lib-closed-name {
		font-size: var(--fs-sm);
	}
	/* Inline rename: the field stands where the name stood. */
	.lib-edit {
		min-width: 0;
		width: 100%;
		max-width: 22rem;
		padding: 2px 6px;
		border: none;
		border-radius: var(--r-sm, 3px);
		background: var(--surface-well);
		color: var(--text);
		font: inherit;
		font-size: var(--fs-sm);
		outline: 1px solid var(--sel-ring);
	}
	.lib-closed-toggle {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin: 0.3rem 0 1rem 0.4rem;
		padding: 0;
		border: none;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: var(--fs-xs);
		cursor: pointer;
		transition: color var(--t-snap);
	}
	.lib-closed-toggle:hover {
		color: var(--text);
	}

	/* ── demo feedback ── */
	/* Centred by auto margins, ⛔ never a translate: it FADES on element
	   opacity, and a transform-placed subtree under opacity is rasterized at
	   rounded coordinates in WebKit and shifts (/styleguide § Laws). */
	.lib-toast {
		position: absolute;
		inset-inline: 0;
		bottom: 1.25rem;
		width: fit-content;
		margin-inline: auto;
		padding: 0.5rem 0.9rem;
		border-radius: var(--r-sm, 3px);
		background: var(--surface-raised);
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.4);
		font-size: var(--fs-sm);
		pointer-events: none;
	}
	.lib-confirm-scrim {
		position: fixed;
		inset: 0;
		z-index: 210;
		background: rgb(0 0 0 / 0.4);
	}
	.lib-confirm {
		position: fixed;
		z-index: 211;
		/* Centred at 40% by auto margins in a box that ends 20% short of the
		   foot (centre = 80% / 2), ⛔ never a translate — see .lib-toast. */
		inset: 0 0 20%;
		margin: auto;
		height: fit-content;
		width: min(26rem, calc(100vw - 2rem));
		padding: 1.1rem 1.25rem 1rem;
		border-radius: var(--r-lg, 6px);
		background: var(--surface-raised);
		color: var(--text);
		box-shadow: 0 10px 40px rgb(0 0 0 / 0.5);
	}
	.lib-confirm-title {
		margin: 0 0 0.4rem;
		font-weight: var(--fw-semibold);
	}
	.lib-confirm-body {
		margin: 0 0 1rem;
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.lib-confirm-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	/* ── One column below wide (71rem — $lib/breakpoints.ts). ↻ Responsive
	   sweep 2026-10-15 item 19 (⚓ Nate): the switch was toolMin (54rem),
	   where the side column squeezes Teams past what a heading needs (measured
	   at 800) — but just above it both columns were still too narrow: at 865 a
	   notation showed ~70px of its text and "Stygian 7.1 clear" was cut by
	   12px, while at 863, one column, everything read. */
	@media (max-width: 71rem) {
		.lib-body {
			display: block;
			overflow-y: auto;
		}
		.lib-col {
			overflow: visible;
		}
	}

	/* ── Narrow: phone forms (roomy, 47.5rem — $lib/breakpoints.ts) ── */
	@media (max-width: 47.5rem) {
		.lib:not(.lib--page) {
			padding: 0.75rem 1rem 0;
		}
		/* Title and close share a row; the search takes the next one whole.
		   ⚠ minmax(0, …), and the tabs may wrap under the title: the /library
		   page's panel leaves 235px at 320 (the overlay 288), and a max-content
		   track pushed the tabs and the search 25–40px out of the box. */
		.lib-top {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.lib-head-start {
			flex-wrap: wrap;
			row-gap: 0.5rem;
		}
		.lib-search-wrap,
		.lib-tally {
			grid-column: 1 / -1;
			grid-row: 2;
		}
		.lib-tally {
			justify-self: start;
		}
		/* The heading: portraits and ⋯ on one row, chips + meta beneath. */
		/* Two tracks: content, then ⋯ / the right cluster. */
		.lib-teams {
			grid-template-columns: minmax(0, 1fr) max-content;
		}
		.lib-head-left {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.6rem;
		}
		.lib-head-left {
			grid-column: 1;
		}
		.lib-head-end {
			grid-column: 2;
			align-self: start;
		}
		.lib-rot-main {
			grid-column: 1 / -1;
		}
		.lib-mid {
			justify-items: start;
		}
		.lib-hint {
			display: none;
		}
	}
</style>
