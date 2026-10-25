<script lang="ts">
	/**
	 * THE ROSTER — the Library's second tab (lineups design §11.6 items 1, 2, 7,
	 * 17), and the ONE place the roster is edited: details in both tools only
	 * read it. Designed with Nate on a /lab/roster demo, 2026-10-11 (since
	 * retired; lineups design §11.6 items 17–18 hold every ruling).
	 *
	 * ⚓ TILES, not a ledger of rows: the rows were dense without being more
	 * usable. The portrait toggles owned; six ASTROIDS under it set the
	 * constellation (C0 = the lit portrait, none filled; clicking the top lit
	 * one steps down, so C0 is one click from C1).
	 *
	 * ⚓ THE LOCK: a stray click must not edit the roster. Locked, a tile READS
	 * (a C-badge from C1, no astroids); editing, it WRITES (the astroids, no
	 * badge). It opens unlocked when there is nothing to fumble (an empty
	 * roster) or when you came here to edit (a details card's link), else
	 * locked — and it is NOT remembered.
	 *
	 * ⚓ BULK ACTIONS ARE ONE CLICK because UNDO catches a slip (⌘Z / ⇧⌘Z, the
	 * bar's buttons; 100 steps, this visit only). Each acts on what is SHOWN
	 * under a filter. "Not owned" keeps the constellations stored (the stores
	 * keep them apart), so an accidental flip comes back intact.
	 *
	 * ON A PHONE (⚓ Nate, before the merge): the sidebar becomes a sheet behind
	 * a Filters button, the bulk actions fold into ⋯, and touch gets an
	 * always-visible wishlist star and taller astroid tap areas — see the CSS.
	 *
	 * Filters mirror the Builder's vocabulary in a right sidebar. Blank is left
	 * out: it is the Planner's generic stand-in, no one's to own. Default
	 * loadout, the 70+ flag and bulk wishlisting are deferred or declined.
	 */
	import { onMount, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { get } from 'svelte/store';
	import { SvelteSet } from 'svelte/reactivity';
	import { browser } from '$app/environment';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import Mark from './Mark.svelte';
	import CharacterFilterRail from './CharacterFilterRail.svelte';
	import { getAllCharacterIndex } from '$lib/data/characterLookup';
	import { characterRoles } from '$lib/data/characterRoles.generated';
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { matchesIdentity, type GridFilters } from '$lib/characterFilters';
	import { constellations, ownership, siteSettings, type OwnershipMark } from '$lib/stores';
	import { getAvatar, hasAvatar } from '$lib/utils/getAvatar';
	import { positionIcon, functionIcon } from '$lib/utils/roleIcons';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { scrollFade } from '$lib/actions/scrollFade';
	import { ROLE_CATEGORIES, inCategory, type RoleCategory } from '$lib/capabilities/roles';
	import { rosterView, type RosterShow } from '$lib/rosterView.svelte';
	import type { CharacterIndexEntry } from '$lib/types/character';

	let {
		focus = null,
		onFocused
	}: {
		/** A character to scroll to and flash on arrival (a details card's link). */
		focus?: string | null;
		/** Called once the arrival has been made, so the caller can clear it. */
		onFocused?: () => void;
	} = $props();

	/** ⚓ Blank stays in the Planner (a generic stand-in to test a rotation
	 *  with) but is no one's to own. */
	const NOT_ON_THE_ROSTER = new Set(['blank']);
	const ALL = getAllCharacterIndex().filter((c) => !NOT_ON_THE_ROSTER.has(c.id));

	const marks = $derived($ownership);
	const cons = $derived($constellations);
	const ownedCount = $derived(Object.values(marks).filter((m) => m === 'owned').length);
	const wishCount = $derived(Object.values(marks).filter((m) => m === 'wishlist').length);

	// ── The lock ─────────────────────────────────────────────────────────────
	let editing = $state(false);
	let nudge = $state(false);
	function nudgeLock(): void {
		nudge = false;
		requestAnimationFrame(() => (nudge = true));
	}

	// ── Undo ─────────────────────────────────────────────────────────────────
	// Every edit records the roster BEFORE it; a restore is one write per store.
	type Snapshot = { marks: Record<string, OwnershipMark>; cons: Record<string, number> };
	const HISTORY_CAP = 100;
	let past = $state<Snapshot[]>([]);
	let future = $state<Snapshot[]>([]);
	const snap = (): Snapshot => ({ marks: { ...get(ownership) }, cons: { ...get(constellations) } });
	function restore(s: Snapshot): void {
		ownership.replaceAll(s.marks);
		constellations.replaceAll(s.cons);
	}
	function record(): void {
		past = [...past.slice(-(HISTORY_CAP - 1)), snap()];
		future = [];
	}
	function undo(): void {
		const prev = past.at(-1);
		if (!prev) return;
		future = [...future, snap()];
		past = past.slice(0, -1);
		restore(prev);
		notice = '';
	}
	function redo(): void {
		const next = future.at(-1);
		if (!next) return;
		past = [...past, snap()];
		future = future.slice(0, -1);
		restore(next);
		notice = '';
	}
	/** What the last bulk action did, said beside Undo for a few seconds. */
	let notice = $state('');
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;
	function announce(text: string): void {
		notice = text;
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = ''), 6000);
	}
	function onWindowKey(e: KeyboardEvent): void {
		if (!editing || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
		const t = e.target as HTMLElement | null;
		if (t?.closest('input, textarea, select, .cm-editor')) return;
		e.preventDefault();
		if (e.shiftKey) redo();
		else undo();
	}

	// ── Single edits ─────────────────────────────────────────────────────────
	function toggleOwned(id: string): void {
		record();
		ownership.setMark(id, marks[id] === 'owned' ? null : 'owned');
	}
	function setOwned(id: string, owned: boolean): void {
		if (owned ? marks[id] === 'owned' : marks[id] !== 'owned') return;
		record();
		ownership.setMark(id, owned ? 'owned' : null);
	}
	function toggleWish(id: string): void {
		record();
		ownership.setMark(id, marks[id] === 'wishlist' ? null : 'wishlist');
	}
	/** A constellation is something you own (DetailCard's old rule, kept). */
	function setCon(id: string, n: number): void {
		if (marks[id] === 'owned' && (cons[id] ?? 0) === n) return;
		record();
		constellations.setLevel(id, n);
		if (marks[id] !== 'owned') ownership.setMark(id, 'owned');
	}
	function clickPip(id: string, n: number): void {
		setCon(id, marks[id] === 'owned' && (cons[id] ?? 0) === n ? n - 1 : n);
	}

	// ── Phone (below toolMin / compact) ─────────────────────────────────────
	/** Below toolMin the filters are a SHEET over the grid, opened by the
	 *  Filters button — stacked under it they took half a phone's screen. */
	let filtersOpen = $state(false);
	/** Below compact the three bulk actions fold into one ⋯ menu. */
	let bulkOpen = $state(false);

	// ── Filters ──────────────────────────────────────────────────────────────
	const filters: GridFilters = $state({
		elements: new SvelteSet<string>(),
		weapons: new SvelteSet<string>(),
		rarities: new SvelteSet<number>(),
		region: '',
		search: ''
	});
	let role = $state<RoleCategory | null>(null);
	type Sort = 'newest' | 'name' | 'element';
	let sort = $state<Sort>('newest');

	const releaseKey = (c: CharacterIndexEntry) => {
		const [a, b] = (c.release ?? '0.0').split('.').map(Number);
		return a * 100 + b;
	};
	const ELEMENT_ORDER = ['pyro', 'hydro', 'anemo', 'electro', 'dendro', 'cryo', 'geo'];
	const sorted = $derived(
		[...ALL].sort((a, b) => {
			if (sort === 'newest')
				return releaseKey(b) - releaseKey(a) || a.displayName.localeCompare(b.displayName);
			if (sort === 'element')
				return (
					ELEMENT_ORDER.indexOf(a.element ?? '') - ELEMENT_ORDER.indexOf(b.element ?? '') ||
					b.rarity - a.rarity ||
					a.displayName.localeCompare(b.displayName)
				);
			return a.displayName.localeCompare(b.displayName);
		})
	);
	const passesShow = (id: string, s: RosterShow) =>
		s === 'all' ||
		(s === 'owned' && marks[id] === 'owned') ||
		(s === 'wishlist' && marks[id] === 'wishlist') ||
		(s === 'unowned' && marks[id] !== 'owned');
	const passesRole = (id: string, r: RoleCategory | null) =>
		!r || inCategory(characterRoles[id], r);
	const shown = $derived(
		sorted.filter(
			(c) =>
				matchesIdentity(c, filters) && passesShow(c.id, rosterView.show) && passesRole(c.id, role)
		)
	);
	const extraActive = $derived(rosterView.show !== 'all' || role !== null);
	const filtered = $derived(shown.length < ALL.length);

	// ── Bulk actions ─────────────────────────────────────────────────────────
	const unownedShown = $derived(shown.filter((c) => marks[c.id] !== 'owned'));
	const ownedShown = $derived(shown.filter((c) => marks[c.id] === 'owned'));
	const belowC6Shown = $derived(
		shown.filter((c) => marks[c.id] !== 'owned' || (!c.noConstellations && cons[c.id] !== 6))
	);
	const plural = (n: number) => `${n} character${n === 1 ? '' : 's'}`;
	function bulk(list: CharacterIndexEntry[], c6: boolean, owned: boolean): void {
		record();
		const m = { ...get(ownership) };
		const k = { ...get(constellations) };
		for (const c of list) {
			if (owned) m[c.id] = 'owned';
			else delete m[c.id];
			if (c6 && !c.noConstellations) k[c.id] = 6;
		}
		ownership.replaceAll(m);
		if (c6) constellations.replaceAll(k);
	}
	function markAllOwned(): void {
		const n = unownedShown.length;
		bulk(unownedShown, false, true);
		announce(`Marked ${plural(n)} owned.`);
	}
	function markAllC6(): void {
		const n = belowC6Shown.length;
		bulk(belowC6Shown, true, true);
		announce(`Marked ${plural(n)} owned at C6.`);
	}
	function markAllNotOwned(): void {
		const n = ownedShown.length;
		bulk(ownedShown, false, false);
		announce(`Marked ${plural(n)} not owned.`);
	}

	// ── The keys (⚓ Nate: "I want people to know the keys available to them")
	const MOD = browser && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl';
	const KEYS: { keys: string[]; does: string }[] = [
		{ keys: ['←', '→', '↑', '↓'], does: 'move' },
		{ keys: ['O'], does: 'owned' },
		{ keys: ['X'], does: 'not owned' },
		{ keys: ['Space'], does: 'switch' },
		{ keys: ['W'], does: 'wishlist' },
		{ keys: ['0', '–', '6'], does: 'constellation' },
		{ keys: [MOD, 'Z'], does: 'undo' }
	];

	// ── Keyboard (roving focus over the shown tiles) ─────────────────────────
	let listEl = $state<HTMLElement>();
	let focusId = $state<string | null>(null);
	function itemEls(): HTMLElement[] {
		return listEl ? [...listEl.querySelectorAll<HTMLElement>('[data-id]')] : [];
	}
	function columns(els: HTMLElement[]): number {
		if (!els.length) return 1;
		const top = els[0].offsetTop;
		return Math.max(1, els.filter((e) => e.offsetTop === top).length);
	}
	function onItemKey(e: KeyboardEvent, c: CharacterIndexEntry): void {
		if (e.target !== e.currentTarget || e.metaKey || e.ctrlKey || e.altKey) return;
		const els = itemEls();
		const i = els.findIndex((el) => el.dataset.id === c.id);
		const cols = columns(els);
		const step: Record<string, number> = {
			ArrowRight: 1,
			ArrowLeft: -1,
			ArrowDown: cols,
			ArrowUp: -cols
		};
		if (e.key in step) {
			e.preventDefault();
			els[Math.min(els.length - 1, Math.max(0, i + step[e.key]))]?.focus();
			return;
		}
		const k = e.key.toLowerCase();
		const edits =
			['o', 'x', 'w', 'enter', ' ', 'backspace', 'delete'].includes(k) || /^[0-6]$/.test(k);
		if (!editing) {
			if (edits) {
				e.preventDefault();
				nudgeLock();
			}
			return;
		}
		if (k === 'o') {
			e.preventDefault();
			setOwned(c.id, true);
		} else if (k === 'x' || k === 'backspace' || k === 'delete') {
			e.preventDefault();
			setOwned(c.id, false);
		} else if (k === 'enter' || k === ' ') {
			e.preventDefault();
			toggleOwned(c.id);
		} else if (k === 'w') {
			e.preventDefault();
			toggleWish(c.id);
		} else if (/^[0-6]$/.test(k) && !c.noConstellations) {
			e.preventDefault();
			setCon(c.id, Number(k));
		}
	}
	const inView = (el: HTMLElement) => {
		const view = listEl?.getBoundingClientRect();
		const r = el.getBoundingClientRect();
		return !!view && r.top >= view.top && r.bottom <= view.bottom;
	};
	/** Unlocking hands the keyboard to the GRID: the click that unlocks leaves
	 *  focus on the lock, so the first arrow went nowhere. Focus lands on the
	 *  last tile you were on if it is in view, else the first in view, without
	 *  scrolling. */
	async function toggleLock(): Promise<void> {
		editing = !editing;
		if (!editing) return;
		await tick();
		const els = itemEls();
		const last = els.find((el) => el.dataset.id === focusId);
		const target = last && inView(last) ? last : (els.find(inView) ?? els[0]);
		target?.focus({ preventScroll: true });
	}

	// ── Arriving on a character (a details card's link) ──────────────────────
	let flashId = $state<string | null>(null);
	async function arrive(id: string): Promise<void> {
		const c = ALL.find((e) => e.id === id);
		if (!c) return;
		// Clear ONLY what hides them.
		if (!matchesIdentity(c, filters)) {
			filters.elements.clear();
			filters.weapons.clear();
			filters.rarities.clear();
			filters.region = '';
			filters.search = '';
		}
		if (!passesShow(id, rosterView.show)) rosterView.show = 'all';
		if (!passesRole(id, role)) role = null;
		await tick();
		const el = listEl?.querySelector<HTMLElement>(`[data-id="${id}"]`);
		if (!el) return;
		el.scrollIntoView({ block: 'center' });
		el.focus({ preventScroll: true });
		flashId = id;
		setTimeout(() => {
			if (flashId === id) flashId = null;
		}, 1400);
	}
	$effect(() => {
		if (!focus) return;
		const id = focus;
		editing = true;
		void arrive(id).then(() => onFocused?.());
	});

	onMount(() => {
		// Nothing to fumble yet, or here to edit: open unlocked.
		if (ownedCount + wishCount === 0 || focus) editing = true;
	});

	// ── Display ──────────────────────────────────────────────────────────────
	const elColor = (el?: string) =>
		(elementColors[(el ?? 'none') as ElementKey] ?? elementColors.none).main;
	const avatar = (id: string) =>
		hasAvatar(id)
			? getAvatar(id, $siteSettings.useNewOutfits, 'circle', $siteSettings.travelerVariant)
			: null;
	/** The tile's six constellations: C0 is the lit portrait with none filled. */
	const CON_PIPS = [1, 2, 3, 4, 5, 6];
	/** 🎛️ ⚓ Nate 2026-10-11. The line is Mark's held 1.15px at every size. */
	const ASTROID_SIZE = 13;
</script>

<svelte:window onkeydown={onWindowKey} onclick={() => (bulkOpen = false)} />

<div class="ros">
	<div class="ros-main">
		<div class="ros-bar">
			<p class="ros-count">{shown.length} of {ALL.length} characters</p>
			<!-- Below toolMin: the sidebar becomes a sheet behind this button. Its
			     word goes below compact (the band rule: keep the MARK). -->
			<button
				class="btn btn--sm ros-filters-btn"
				class:is-active={filtered}
				aria-expanded={filtersOpen}
				aria-label="Filters"
				onclick={() => (filtersOpen = true)}
				><Mark name="filter" size={13} /><span class="ros-filters-word">Filters</span></button
			>
			{#if editing && (unownedShown.length || belowC6Shown.length || ownedShown.length)}
				<!-- Below compact the bulk actions fold into one ⋯. -->
				<span class="ros-bulk-fold">
					<button
						class="btn btn--sm btn--icon"
						aria-label="Mark all…"
						aria-expanded={bulkOpen}
						onclick={(e) => {
							e.stopPropagation();
							bulkOpen = !bulkOpen;
						}}><Mark name="more" size={13} /></button
					>
					{#if bulkOpen}
						<div
							class="ros-menu ctx-dark"
							role="menu"
							transition:fade={{ duration: motion(T_QUICK) }}
							onintrostart={introLive}
							onoutrostart={outroInert}
						>
							{#if unownedShown.length}
								<button class="ros-menu-item" role="menuitem" onclick={markAllOwned}
									><Mark name="check" size={12} />
									{filtered ? 'Mark all shown owned' : 'Mark all owned'}</button
								>
							{/if}
							{#if belowC6Shown.length}
								<button class="ros-menu-item" role="menuitem" onclick={markAllC6}
									><Mark name="constellation" size={12} filled />
									{filtered ? 'Mark all shown C6' : 'Mark all C6'}</button
								>
							{/if}
							{#if ownedShown.length}
								<button class="ros-menu-item" role="menuitem" onclick={markAllNotOwned}
									><Mark name="close" size={12} />
									{filtered ? 'Mark all shown not owned' : 'Mark all not owned'}</button
								>
							{/if}
						</div>
					{/if}
				</span>
			{/if}
			{#if editing}
				{#if unownedShown.length}
					<button class="btn btn--sm ros-bulk" onclick={markAllOwned}
						><Mark name="check" size={12} />
						{filtered ? 'Mark all shown owned' : 'Mark all owned'}</button
					>
				{/if}
				{#if belowC6Shown.length}
					<button class="btn btn--sm ros-bulk" onclick={markAllC6}
						><Mark name="constellation" size={12} filled />
						{filtered ? 'Mark all shown C6' : 'Mark all C6'}</button
					>
				{/if}
				{#if ownedShown.length}
					<button class="btn btn--sm ros-bulk" onclick={markAllNotOwned}
						><Mark name="close" size={12} />
						{filtered ? 'Mark all shown not owned' : 'Mark all not owned'}</button
					>
				{/if}
			{/if}
			{#if editing && notice}<span
					class="ros-notice"
					role="status"
					transition:fade={{ duration: motion(T_QUICK) }}>{notice}</span
				>{/if}
			<span class="ros-end">
				{#if editing}
					<button
						class="btn btn--sm btn--icon"
						aria-label="Undo"
						title={MOD === '⌘' ? 'Undo (⌘Z)' : 'Undo (Ctrl+Z)'}
						disabled={!past.length}
						onclick={undo}><Mark name="undo" size={13} /></button
					>
					<button
						class="btn btn--sm btn--icon"
						aria-label="Redo"
						title={MOD === '⌘' ? 'Redo (⇧⌘Z)' : 'Redo (Ctrl+Shift+Z)'}
						disabled={!future.length}
						onclick={redo}><Mark name="redo" size={13} /></button
					>
				{/if}
				<button
					class="btn btn--sm ros-lock"
					class:is-active={editing}
					class:is-nudged={nudge}
					aria-pressed={editing}
					onanimationend={() => (nudge = false)}
					title={editing ? 'Lock the roster against stray clicks' : 'Unlock the roster to edit it'}
					onclick={toggleLock}
					><Mark name={editing ? 'unlocked' : 'locked'} size={13} />
					{editing ? 'Lock roster' : 'Edit roster'}</button
				>
			</span>
		</div>
		{#if editing}
			<p class="ros-keys" aria-label="Keyboard shortcuts">
				{#each KEYS as k (k.does)}
					<span class="ros-key"
						>{#each k.keys as key, i (i)}{#if key === '–'}<span class="ros-key-dash">–</span
								>{:else}<kbd>{key}</kbd>{/if}{/each}
						{k.does}</span
					>
				{/each}
			</p>
		{/if}
		<div class="ros-scroll scroll-fade" bind:this={listEl} use:scrollFade>
			{#if !editing}
				<p class="ros-hint">Click “Edit roster” to begin editing.</p>
			{:else if ownedCount === 0}
				<p class="ros-hint">
					Mark the characters you own: click a portrait, or select one and use the keys above.
				</p>
			{/if}

			<div class="til" role="list">
				{#each shown as c (c.id)}
					{@const m = marks[c.id]}
					{@const src = avatar(c.id)}
					{@const con = cons[c.id] ?? 0}
					<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
					<div
						class="til-card"
						class:is-locked={!editing}
						class:is-owned={m === 'owned'}
						class:is-wish={m === 'wishlist'}
						class:is-flash={flashId === c.id}
						role="listitem"
						tabindex={focusId === c.id || (!focusId && c === shown[0]) ? 0 : -1}
						data-id={c.id}
						onfocus={() => (focusId = c.id)}
						onkeydown={(e) => onItemKey(e, c)}
					>
						<div class="til-head" style:--el={elColor(c.element)}>
							<button
								class="til-face"
								aria-pressed={m === 'owned'}
								aria-label="{c.displayName}: {m === 'owned' ? 'owned' : 'not owned'}"
								tabindex="-1"
								title={editing
									? m === 'owned'
										? 'Mark not owned (X)'
										: 'Mark owned (O)'
									: 'Edit the roster to change this'}
								onclick={() => (editing ? toggleOwned(c.id) : nudgeLock())}
							>
								{#if src}<img {src} alt="" loading="lazy" />{/if}
							</button>
							{#if c.element}
								<span class="til-corner til-corner--start"
									><img src={elementIcon(c.element)} alt="" /></span
								>
							{/if}
							<button
								class="til-corner til-corner--end til-wish"
								class:is-active={m === 'wishlist'}
								aria-pressed={m === 'wishlist'}
								aria-label="Wishlist"
								title={editing ? 'Wishlist (W)' : undefined}
								tabindex="-1"
								onclick={() => (editing ? toggleWish(c.id) : nudgeLock())}
								><Mark name="star" size={12} filled={m === 'wishlist'} /></button
							>
							{#if !editing && m === 'owned' && con > 0 && !c.noConstellations}
								<span class="til-con">C{con}</span>
							{/if}
						</div>
						<span class="til-name">{c.displayName}</span>
						{#if editing && !c.noConstellations}
							<div class="til-pips" role="group" aria-label="Constellation">
								{#each CON_PIPS as n (n)}
									{@const on = m === 'owned' && n <= con}
									<button
										class="til-pip"
										class:is-on={on}
										aria-label="C{n}"
										title="C{n} ({n})"
										tabindex="-1"
										onclick={() => clickPip(c.id, n)}
										><Mark name="constellation" size={ASTROID_SIZE} filled={on} /></button
									>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
			{#if !shown.length}
				<p class="ros-hint">No character matches.</p>
			{/if}
		</div>
	</div>

	<div class="ros-side" class:is-open={filtersOpen}>
		<!-- The sheet's own head, shown only when the sidebar is a sheet. -->
		<div class="ros-sheet-head">
			<p class="ros-count">{shown.length} of {ALL.length} characters</p>
			<button class="btn btn--sm" onclick={() => (filtersOpen = false)}>Done</button>
		</div>
		<CharacterFilterRail
			roster={ALL}
			{filters}
			extraFiltersActive={extraActive}
			onClearExtras={() => {
				rosterView.show = 'all';
				role = null;
			}}
			searchPlaceholder="Search characters"
		>
			{#snippet railStart()}
				<div class="side-sec">
					<p class="kicker">Show</p>
					<div class="segment side-seg">
						{#each [['all', 'All'], ['owned', 'Owned'], ['wishlist', 'Wishlist'], ['unowned', 'Not owned']] as const as [k, label] (k)}
							<button
								class="btn btn--sm"
								class:is-active={rosterView.show === k}
								onclick={() => (rosterView.show = k)}>{label}</button
							>
						{/each}
					</div>
				</div>
				<div class="side-sec">
					<p class="kicker">Sort</p>
					<div class="segment side-seg">
						{#each [['newest', 'Newest'], ['name', 'Name'], ['element', 'Element']] as const as [k, label] (k)}
							<button class="btn btn--sm" class:is-active={sort === k} onclick={() => (sort = k)}
								>{label}</button
							>
						{/each}
					</div>
				</div>
				<div class="side-sec">
					<p class="kicker">Role</p>
					<div class="chips">
						{#each ROLE_CATEGORIES as cat (cat.key)}
							<button
								class="chip side-role"
								class:active={role?.key === cat.key}
								aria-pressed={role?.key === cat.key}
								onclick={() => (role = role?.key === cat.key ? null : cat)}
							>
								{#if cat.position}<img src={positionIcon(cat.position, 'color')} alt="" />{/if}
								<img src={functionIcon(cat.function, 'color')} alt="" />
								{cat.label}
							</button>
						{/each}
					</div>
				</div>
			{/snippet}
		</CharacterFilterRail>
	</div>
</div>

<style>
	.ros {
		position: relative;
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 18rem;
		gap: 1.5rem;
	}
	/* The bar sits ABOVE the scroller, so the roll-off fades the tiles and
	   never the controls. */
	.ros-main {
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.ros-scroll {
		--scroll-fade: 28px;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 4px 6px 1.25rem 4px;
	}
	.ros-side {
		min-height: 0;
		display: flex;
		flex-direction: column;
		padding-bottom: 1rem;
	}
	.side-sec {
		display: grid;
		gap: 0.4rem;
	}
	.side-sec .kicker {
		margin: 0;
	}
	.side-seg {
		display: flex;
	}
	.side-seg > .btn {
		flex: 1;
		height: 26px;
		padding: 0 0.4rem;
	}
	.side-role {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		text-transform: none;
	}
	.side-role img {
		width: 14px;
		height: 14px;
		object-fit: contain;
	}

	.ros-bar {
		flex: none;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding: 0 6px 8px 4px;
	}
	.ros-bar .btn {
		gap: 5px;
	}
	.ros-end {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	/* The notice sits just before the end cluster; on a phone it takes its own
	   row (below). */
	.ros-notice + .ros-end {
		margin-left: 0;
	}
	.ros-count {
		margin: 0;
		color: var(--muted);
		font-size: var(--fs-xs);
	}
	.ros-notice {
		margin-left: auto;
		margin-right: 0.25rem;
		color: var(--muted);
		font-size: var(--fs-xs);
	}
	.ros-keys {
		flex: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 1rem;
		margin: 0;
		padding: 0 6px 8px 4px;
		color: var(--muted);
		font-size: var(--fs-xs);
	}
	.ros-key {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}
	.ros-key kbd {
		min-width: 18px;
		padding: 0 4px;
		border-radius: var(--r-xs);
		background: var(--surface-raised);
		color: var(--text);
		/* Body, not mono: in the mono face a capital O and a zero are twins. */
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		line-height: 18px;
		text-align: center;
	}
	.ros-key-dash {
		margin: 0 -1px;
	}
	.ros-hint {
		margin: 0 0 0.75rem;
		color: var(--muted);
		font-size: var(--fs-sm);
	}
	/* A locked tile was clicked: the lock says where the key is. The shared
	   nudge (app.css), which guards reduced motion itself — and still ends, so
	   `onanimationend` clears the ring under the preference too. */
	.ros-lock.is-nudged {
		animation: nudge 120ms 2;
		box-shadow: inset 0 0 0 1px var(--accent);
	}
	/* The flash on arrival: an inset ring that fades (a paint, not an opacity). */
	@keyframes ros-flash {
		0%,
		40% {
			box-shadow: inset 0 0 0 2px var(--accent);
		}
		100% {
			box-shadow: inset 0 0 0 2px transparent;
		}
	}
	.is-flash {
		animation: ros-flash 1.4s ease-out;
	}
	@media (prefers-reduced-motion: reduce) {
		.is-flash {
			animation: none;
		}
	}

	/* ── Tiles ── */
	.til {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		gap: 0.9rem 0.6rem;
	}
	.til-card {
		position: relative;
		display: grid;
		justify-items: center;
		align-content: start;
		gap: 5px;
		padding: 8px 4px 7px;
		border-radius: var(--r-md);
		outline: none;
		transition: background-color var(--t-snap);
	}
	.til-card:hover {
		background: var(--surface-hover);
	}
	.til-card:focus-visible {
		box-shadow: inset 0 0 0 1px var(--sel-ring);
	}
	/* The portrait and its two corners — ONE recipe, mirrored, so the element
	   and the wishlist star balance. Each corner sits on a small surface disc,
	   which lifts the element icon off the owned ring. (⚓ Nate's values.) */
	.til-head {
		--corner: 18px;
		--corner-inset: -1px;
		position: relative;
		width: 76px;
		height: 76px;
	}
	.til-face {
		display: block;
		width: 100%;
		height: 100%;
		padding: 0;
		border: none;
		border-radius: var(--r-round);
		background: color-mix(in srgb, var(--el) 28%, var(--surface-well));
		cursor: pointer;
	}
	.til-face > img {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: var(--r-round);
		object-fit: cover;
		filter: var(--portrait-unowned);
	}
	.is-owned .til-face {
		box-shadow: 0 0 0 2px var(--el);
	}
	.is-owned .til-face > img {
		filter: none;
	}
	.is-locked .til-face {
		cursor: default;
	}
	.til-corner {
		position: absolute;
		top: var(--corner-inset);
		display: grid;
		place-items: center;
		width: var(--corner);
		height: var(--corner);
		padding: 0;
		border: none;
		border-radius: var(--r-round);
		background: var(--surface);
	}
	.til-corner--start {
		left: var(--corner-inset);
	}
	.til-corner--end {
		right: var(--corner-inset);
	}
	.til-corner > img {
		width: 16px;
		height: 16px;
	}
	.til-con {
		position: absolute;
		right: 0;
		bottom: 0;
		padding: 0 3px;
		border-radius: var(--r-round);
		background: var(--surface);
		color: var(--text);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
	}
	/* The star APPEARS on the --t-snap clock (SlotPortrait's .sp-mag recipe):
	   at rest its disc and its ink are transparent PAINT (alpha in the paint,
	   never element opacity — the sub-pixel laws), and `visibility` rides the
	   same transition, so it fades out before it stops taking clicks and is
	   there at once on the way in. */
	.til-wish {
		background-color: transparent;
		color: transparent;
		cursor: pointer;
		visibility: hidden;
		transition:
			background-color var(--t-snap),
			color var(--t-snap),
			visibility var(--t-snap);
	}
	.til-card:not(.is-locked):hover .til-wish,
	.til-wish.is-active {
		visibility: visible;
		background-color: var(--surface);
	}
	.til-card:not(.is-locked):hover .til-wish:not(.is-active) {
		color: var(--muted);
	}
	.til-wish.is-active {
		color: var(--accent);
	}
	.til-card:not(.is-locked):hover .til-wish:hover {
		color: var(--text);
	}
	.is-locked .til-wish {
		cursor: default;
	}
	.til-name {
		max-width: 100%;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--muted);
		font-size: var(--fs-sm);
	}
	.is-owned .til-name,
	.is-wish .til-name {
		color: var(--text);
	}
	.til-pips {
		display: flex;
	}
	/* The button IS the astroid's box: its spacing is Lucide's own margin. */
	.til-pip {
		display: grid;
		place-items: center;
		padding: 0;
		border: none;
		background: none;
		color: var(--line-soft);
		cursor: pointer;
		transition: color var(--t-snap);
	}
	.til-pip:hover {
		color: var(--text);
	}
	.til-pip.is-on {
		color: var(--accent);
	}

	/* ── Phone controls: hidden on wide ── */
	.ros-filters-btn,
	.ros-bulk-fold,
	.ros-sheet-head {
		display: none;
	}
	.ros-filters-btn {
		gap: 5px;
	}
	.ros-bulk-fold {
		position: relative;
	}
	.ros-menu {
		position: absolute;
		z-index: 3;
		top: calc(100% + 4px);
		left: 0;
		display: flex;
		flex-direction: column;
		min-width: 14rem;
		padding: 4px;
		border-radius: var(--r-sm);
		background: var(--surface-raised);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.45);
	}
	.ros-menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		padding: 0 10px;
		border: none;
		border-radius: var(--r-xs);
		background: none;
		color: var(--text);
		font: inherit;
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
		/* A menu row is a CONTROL (NavPanel's .np-row). */
		transition: background-color var(--t-snap);
	}
	.ros-menu-item:hover {
		background: var(--fill-hover);
	}

	/* No keyboard to speak of on a touch screen: the legend would be noise.
	   (A different AXIS from the width table — see responsive survey.) */
	@media (hover: none) {
		.ros-keys {
			display: none;
		}
		/* No hover, so the wishlist star would never appear: while editing it
		   always shows, quietly. */
		.til-card:not(.is-locked) .til-wish {
			visibility: visible;
			background-color: var(--surface);
		}
		.til-card:not(.is-locked) .til-wish:not(.is-active) {
			color: var(--muted);
		}
	}
	/* A thumb is not a cursor: the astroids keep their paint (13px, six to a
	   tile) and grow their tap area DOWNWARD and UPWARD only — sideways they
	   touch already. The slider's `pointer: coarse` precedent; undo is the net
	   for a neighbour hit. */
	@media (pointer: coarse) {
		.til-pip {
			padding-block: 8px;
			margin-block: -8px;
		}
	}

	/* ── Below toolMin (54rem — $lib/breakpoints.ts): the sidebar is a SHEET
	   over the grid, opened by the Filters button; the grid gets the screen. */
	@media (max-width: 54rem) {
		.ros {
			display: flex;
			flex-direction: column;
		}
		.ros-main {
			flex: 1;
		}
		.ros-filters-btn {
			display: inline-flex;
		}
		.ros-bar .ros-count {
			display: none;
		}
		.ros-side {
			display: none;
		}
		.ros-side.is-open {
			position: absolute;
			inset: 0;
			z-index: 4;
			display: flex;
			padding-bottom: 0.75rem;
			background: var(--surface);
		}
		.ros-sheet-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0 6px 8px;
		}
	}

	/* ── Below compact (40rem — $lib/breakpoints.ts): one row of controls.
	   The bulk actions fold into ⋯, the Filters button keeps its mark, the
	   notice takes its own row, and three tiles fit at 320 (88px: 3 × 88 + gaps
	   in the 278px a 320 screen leaves; the portrait is 76, the astroids 78). */
	@media (max-width: 40rem) {
		.ros-bulk {
			display: none;
		}
		.ros-bulk-fold {
			display: inline-flex;
		}
		.ros-filters-word {
			display: none;
		}
		/* Mark only: the .btn--icon box, so it matches ⋯ and undo beside it. */
		.ros-filters-btn {
			padding: 0.25rem;
			min-width: 1.6rem;
			justify-content: center;
		}
		.ros-notice {
			order: 99;
			flex-basis: 100%;
			margin: 0;
		}
		.ros-notice + .ros-end {
			margin-left: auto;
		}
		.til {
			grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
			gap: 0.75rem 0.25rem;
		}
	}
</style>
