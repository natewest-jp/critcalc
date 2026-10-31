<script lang="ts">
	import { travelerTwin } from '$lib/travelerTwin.svelte';
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
	 * ↻ THE FILTERS ARE THE STRIP (roster surface round, 2026-10-26, ⚓ Nate):
	 * the Builder's and Teams' strip on the grid, not a column beside it — the
	 * bulk actions act on what is SHOWN, so what decides that sits with them,
	 * and the grid takes the width. Blank is left out: it is the Planner's
	 * generic stand-in, no one's to own. Default loadout, the 70+ flag and bulk
	 * wishlisting are deferred or declined.
	 */
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import { SvelteSet } from 'svelte/reactivity';
	import { fade } from 'svelte/transition';
	import { linear } from 'svelte/easing';
	import { motion, riseIn, T_QUICK } from '$lib/motion';
	import { browser } from '$app/environment';
	import Mark from './Mark.svelte';
	import BandMenu from './BandMenu.svelte';
	import CharacterFilterStrip from './CharacterFilterStrip.svelte';
	import MoreFilters from './MoreFilters.svelte';
	import { getAllCharacterIndex } from '$lib/data/characterLookup';
	import { characterRoles } from '$lib/data/characterRoles.generated';
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { matchesIdentity, type GridFilters } from '$lib/characterFilters';
	import { constellations, ownership, siteSettings, type OwnershipMark } from '$lib/stores';
	import { getAvatar, hasAvatar } from '$lib/utils/getAvatar';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { scrollFade } from '$lib/actions/scrollFade';
	import { inCategory, type RoleCategory } from '$lib/capabilities/roles';
	import { rosterView, type RosterShow } from '$lib/rosterView.svelte';
	import { menu } from '$lib/menuState.svelte';
	import { notices } from '$lib/notices.svelte';
	import { storageSession } from '$lib/storage/session.svelte';
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
	/** The keys bar shows while a tile has KEYBOARD focus. It used to be a CSS
	 *  `:has(.til-card:focus-visible)` fade; it is state now so it can arrive
	 *  on the shared rise (`riseIn`, ⚓ Nate 2026-10-27). `focusout` lands
	 *  before the next element is focused, hence the microtask. */
	let keysOn = $state(false);
	let mainEl = $state<HTMLElement>();
	function trackKeys(): void {
		keysOn = !!mainEl?.querySelector('.til-card:focus-visible');
	}
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
	}
	function redo(): void {
		const next = future.at(-1);
		if (!next) return;
		past = [...past, snap()];
		future = future.slice(0, -1);
		restore(next);
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
	/** ⚓ A wish is for a character you DON'T own (Nate 2026-10-26): the mark
	 *  is one value, so wishing an owned character un-owned it — the
	 *  streamer's "favourite" click faded every character he tried it on. */
	function toggleWish(id: string): void {
		if (marks[id] === 'owned') return;
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

	// ── Filters ──────────────────────────────────────────────────────────────
	const filters: GridFilters = $state({
		elements: new SvelteSet<string>(),
		weapons: new SvelteSet<string>(),
		rarities: new SvelteSet<number>(),
		region: '',
		search: '',
		factionBuffs: new SvelteSet<string>()
	});
	let role = $state<RoleCategory | null>(null);
	type Sort = 'newest' | 'name' | 'element';
	let sort = $state<Sort>('newest');
	const SORTS: { key: Sort; label: string }[] = [
		{ key: 'newest', label: 'Newest' },
		{ key: 'name', label: 'Name' },
		{ key: 'element', label: 'Element' }
	];
	/** Teams' Show toggles plus the Roster's own third, Not owned (its X is the
	 *  roster's word for it: the key and the bulk action). None on is everyone. */
	const SHOW_TOGGLES = [
		{ key: 'owned', mark: 'check', label: 'Owned' },
		{ key: 'unowned', mark: 'close', label: 'Not owned' },
		{ key: 'wishlist', mark: 'wish', label: 'Wishlist' }
	] as const;

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
	const moreCount = $derived(
		filters.weapons.size +
			filters.rarities.size +
			(filters.region ? 1 : 0) +
			(filters.factionBuffs?.size ?? 0)
	);
	const anyActive = $derived(
		moreCount > 0 ||
			filters.elements.size > 0 ||
			!!filters.search.trim() ||
			role !== null ||
			rosterView.show !== 'all'
	);
	const filtered = $derived(shown.length < ALL.length);
	function clearIdentity(): void {
		filters.elements.clear();
		filters.weapons.clear();
		filters.rarities.clear();
		filters.factionBuffs?.clear();
		filters.region = '';
		filters.search = '';
	}
	function clearAll(): void {
		clearIdentity();
		role = null;
		rosterView.show = 'all';
	}

	// ── Bulk actions ─────────────────────────────────────────────────────────
	const unownedShown = $derived(shown.filter((c) => marks[c.id] !== 'owned'));
	const ownedShown = $derived(shown.filter((c) => marks[c.id] === 'owned'));
	const belowC6Shown = $derived(
		shown.filter((c) => marks[c.id] !== 'owned' || (!c.noConstellations && cons[c.id] !== 6))
	);
	const plural = (n: number) => `${n} character${n === 1 ? '' : 's'}`;
	/** A bulk edit, and a toast whose Undo takes back ITS characters only: a
	 *  later edit to anyone else survives it (a whole-roster restore lost
	 *  them). The take-back is itself an edit, so ⌘Z can redo the bulk.
	 *  ⚠️ The toast outlives the profile it was made in, and the roster stores
	 *  are whichever profile is in front, so its Undo does nothing once the
	 *  profile has changed (it would write this profile's marks into that one). */
	function bulk(list: CharacterIndexEntry[], c6: boolean, owned: boolean, text: string): void {
		record();
		const before = past.at(-1)!;
		const profileId = storageSession.profile?.id;
		const m = { ...get(ownership) };
		const k = { ...get(constellations) };
		for (const c of list) {
			if (owned) m[c.id] = 'owned';
			else delete m[c.id];
			if (c6 && !c.noConstellations) k[c.id] = 6;
		}
		ownership.replaceAll(m);
		if (c6) constellations.replaceAll(k);
		notices.toast('success', text, {
			actions: [
				{
					label: 'Undo',
					run: () => {
						if (storageSession.profile?.id === profileId) takeBack(list, before);
					}
				}
			]
		});
	}
	function takeBack(list: CharacterIndexEntry[], before: Snapshot): void {
		record();
		const m = { ...get(ownership) };
		const k = { ...get(constellations) };
		for (const { id } of list) {
			if (before.marks[id]) m[id] = before.marks[id];
			else delete m[id];
			if (id in before.cons) k[id] = before.cons[id];
			else delete k[id];
		}
		ownership.replaceAll(m);
		constellations.replaceAll(k);
	}
	function markAllOwned(): void {
		const n = unownedShown.length;
		bulk(unownedShown, false, true, `Marked ${plural(n)} owned`);
	}
	function markAllC6(): void {
		const n = belowC6Shown.length;
		bulk(belowC6Shown, true, true, `Marked ${plural(n)} owned at C6`);
	}
	function markAllNotOwned(): void {
		const n = ownedShown.length;
		bulk(ownedShown, false, false, `Marked ${plural(n)} not owned`);
	}
	const anyBulk = $derived(!!(unownedShown.length || belowC6Shown.length || ownedShown.length));

	// ── The head (the menu state's page head) ───────────────────────────────
	$effect(() => {
		menu.headActions = barActions;
		return () => {
			if (menu.headActions === barActions) menu.headActions = null;
		};
	});

	// ── The keys (⚓ Nate: "I want people to know the keys available to them")
	const MOD = browser && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl';
	const KEYS: { keys: string[]; does: string }[] = [
		{ keys: ['←', '→', '↑', '↓'], does: 'move' },
		{ keys: ['O'], does: 'owned' },
		{ keys: ['X'], does: 'not owned' },
		{ keys: ['Space'], does: 'owned or not' },
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
			if (marks[c.id] === 'owned') nudgeTile(c.id);
			else toggleWish(c.id);
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
	/** A refused key on one tile (W on a character you own) NUDGES it. */
	let nudgeId = $state<string | null>(null);
	function nudgeTile(id: string): void {
		nudgeId = null;
		requestAnimationFrame(() => (nudgeId = id));
	}
	async function arrive(id: string): Promise<void> {
		const c = ALL.find((e) => e.id === id);
		if (!c) return;
		// Clear ONLY what hides them.
		if (!matchesIdentity(c, filters)) clearIdentity();
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
		hasAvatar(id) ? getAvatar(id, $siteSettings.useNewOutfits, 'circle', $travelerTwin) : null;
	/** The tile's six constellations: C0 is the lit portrait with none filled. */
	const CON_PIPS = [1, 2, 3, 4, 5, 6];
	/** 🎛️ ⚓ Nate 2026-10-11. The line is Mark's held 1.15px at every size. */
	const ASTROID_SIZE = 13;
</script>

<svelte:window onkeydown={onWindowKey} />

<!-- The bar's controls, in the menu state's page head. ONE group: mark, undo and redo while editing, the lock. -->
{#snippet barActions()}
	{#if editing}
		{#if anyBulk}
			<BandMenu
				size="sm"
				label={filtered ? 'Mark shown' : 'Mark all'}
				ariaLabel={filtered ? 'Mark every character shown' : 'Mark every character'}
			>
				{#snippet items(close)}
					{#if unownedShown.length}
						<button
							class="band-menu-item"
							role="menuitem"
							onclick={() => {
								close();
								markAllOwned();
							}}><Mark name="check" size={13} /> Owned</button
						>
					{/if}
					{#if belowC6Shown.length}
						<button
							class="band-menu-item"
							role="menuitem"
							onclick={() => {
								close();
								markAllC6();
							}}><Mark name="constellation" size={13} filled="solid" /> Owned at C6</button
						>
					{/if}
					{#if ownedShown.length}
						<button
							class="band-menu-item"
							role="menuitem"
							onclick={() => {
								close();
								markAllNotOwned();
							}}><Mark name="close" size={13} /> Not owned</button
						>
					{/if}
				{/snippet}
			</BandMenu>
		{/if}
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
		aria-label={editing ? 'Lock roster' : 'Edit roster'}
		onanimationend={() => (nudge = false)}
		title={editing ? 'Lock the roster against stray clicks' : 'Unlock the roster to edit it'}
		onclick={toggleLock}
		><Mark name={editing ? 'unlocked' : 'locked'} size={13} /><span class="ros-lock-word"
			>{editing ? 'Lock roster' : 'Edit roster'}</span
		></button
	>
{/snippet}

<div class="ros">
	<div
		class="ros-main"
		bind:this={mainEl}
		onfocusin={trackKeys}
		onfocusout={() => queueMicrotask(trackKeys)}
	>
		{#if editing && keysOn}
			<p
				class="ros-keys"
				aria-label="Keyboard shortcuts"
				in:riseIn
				out:fade={{ duration: motion(T_QUICK), easing: linear }}
			>
				{#each KEYS as k (k.does)}
					<span class="ros-key"
						>{#each k.keys as key, i (i)}{#if key === '–'}<span class="ros-key-dash">–</span
								>{:else}<kbd>{key}</kbd>{/if}{/each}
						{k.does}</span
					>
				{/each}
			</p>
		{/if}
		<!-- The filters sit ON the grid (Teams' details), and the grid's
		     roll-off ends at them. -->
		<div class="ros-filters">
			<CharacterFilterStrip
				slate
				{filters}
				activeRole={role?.key ?? null}
				onRole={(cat) => (role = role?.key === cat.key ? null : cat)}
				count={shown.length}
				{anyActive}
				onClear={clearAll}
			>
				{#snippet start()}
					<span class="ros-search">
						<Mark name="search" size={12} />
						<input
							class="field ros-search-field"
							type="text"
							placeholder="Search…"
							aria-label="Search characters"
							bind:value={filters.search}
							autocomplete="off"
							autocorrect="off"
							spellcheck={false}
						/>
					</span>
				{/snippet}
				{#snippet end()}
					<span class="segment ros-show" role="group" aria-label="Show">
						{#each SHOW_TOGGLES as t (t.key)}
							{@const on = rosterView.show === t.key}
							<button
								class="btn btn--icon"
								class:is-active={on}
								aria-pressed={on}
								aria-label={t.label}
								title={on ? 'Show everyone' : t.label}
								onclick={() => (rosterView.show = on ? 'all' : t.key)}
								><Mark name={t.mark} size={14} /></button
							>
						{/each}
					</span>
					<span class="ros-more"
						><BandMenu
							size="sm"
							role="dialog"
							mark="filter"
							label="More"
							count={moreCount}
							ariaLabel={moreCount > 0 ? `More filters, ${moreCount} set` : 'More filters'}
						>
							{#snippet items(close)}
								<MoreFilters roster={ALL} {filters} ownershipView="all" {close} />
							{/snippet}
						</BandMenu></span
					>
					<BandMenu
						size="sm"
						label={SORTS.find((o) => o.key === sort)?.label}
						ariaLabel="Sort: {SORTS.find((o) => o.key === sort)?.label}"
					>
						{#snippet items(close)}
							{#each SORTS as o (o.key)}
								<button
									class="band-menu-item ros-sort-item"
									role="menuitemradio"
									aria-checked={sort === o.key}
									onclick={() => {
										sort = o.key;
										close();
									}}
									><span class="ros-sort-check"
										>{#if sort === o.key}<Mark name="check" size={13} />{/if}</span
									>{o.label}</button
								>
							{/each}
						{/snippet}
					</BandMenu>
				{/snippet}
			</CharacterFilterStrip>
		</div>
		<div class="ros-scroll scroll-fade" bind:this={listEl} use:scrollFade>
			{#if editing && ownedCount === 0}
				<p class="ros-hint">
					Mark the characters you own by <span class="ros-by-pointer">clicking</span><span
						class="ros-by-touch">tapping</span
					> their portraits.
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
						class:is-nudged={nudgeId === c.id}
						onanimationend={(e) => {
							if (e.animationName.endsWith('nudge') && nudgeId === c.id) nudgeId = null;
						}}
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
							{#if m !== 'owned'}<button
									class="til-corner til-corner--end til-wish"
									class:is-active={m === 'wishlist'}
									aria-pressed={m === 'wishlist'}
									aria-label="Wishlist"
									title={editing
										? m === 'wishlist'
											? 'Remove from wishlist (W)'
											: 'Add to wishlist (W)'
										: undefined}
									tabindex="-1"
									onclick={() => (editing ? toggleWish(c.id) : nudgeLock())}
									><Mark name="wish" size={12} filled={m === 'wishlist' && 'solid'} /></button
								>{/if}
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
										><Mark
											name="constellation"
											size={ASTROID_SIZE}
											filled={on && 'solid'}
										/></button
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
</div>

<style>
	.ros {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	/* The bar sits ABOVE the scroller, so the roll-off fades the tiles and
	   never the controls. */
	.ros-main {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.ros-scroll {
		--scroll-fade: 28px;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0.5rem 6px 1.25rem 4px;
		/* A tile the arrows bring into view stops clear of the keys bar. */
		scroll-padding-block-end: 5.5rem;
	}
	/* The filters sit ON the grid (Teams' details), and the scroller starts at
	   their edge, never under it (TeamDetail .td-filters, 2026-10-26). */
	.ros-filters {
		flex: none;
		padding: 0 6px 0 4px;
	}
	/* The search field and the Show toggles, as Teams' details size them
	   (TeamDetail .td-search / .td-own). ⚠ A wrapping line breaks on the flex
	   BASIS before anything shrinks: a small basis that GROWS. */
	.ros-search {
		position: relative;
		flex: 1 1 8rem;
		max-width: 13rem;
		min-width: 7rem;
		display: flex;
		align-items: center;
	}
	.ros-search :global(.mark) {
		position: absolute;
		left: 0.55rem;
		color: var(--muted);
		pointer-events: none;
	}
	.ros-search-field {
		width: 100%;
		height: 30px;
		padding-block: 0;
		padding-left: calc(0.55rem + 12px + 0.35rem);
		font-size: var(--fs-sm);
	}
	.ros-more {
		display: contents;
	}
	.ros-show > .btn {
		height: 26px;
		min-width: 28px;
	}
	/* The chosen sort's check sits in a fixed column, so the words align. */
	.ros-sort-check {
		display: inline-grid;
		place-items: center;
		width: 13px;
	}
	/* Its own gap, wherever it is rendered (the head or the bar). */
	.ros-lock {
		gap: 5px;
	}
	/* THE KEYS (⚓ Nate: "I want people to know the keys available to them"),
	   shown to the people using them: while a tile has KEYBOARD focus. A row
	   that came and went would shove the grid down the moment you pressed an
	   arrow, so it floats over the grid's bottom roll-off instead, and a
	   pointer passes through it. The fade is linear (the fade law) on the
	   surface clock. */
	.ros-keys {
		/* Centred by auto margins between two zero insets, ⛔ never a resting
		   translate: an opacity fade on a box at fractional offsets dances in
		   WebKit (the sub-pixel laws). Its arrival rise is a transform, but
		   ROUNDED to whole pixels (`riseIn`), which keeps it off those offsets.
		   Lifted off the bottom edge so it sits in the eye line (⚓ Nate), but
		   low, never mid-grid: there it would cover the tiles you are arrowing
		   through. ⚓ Floating (Nate 2026-10-27): --surface-float, no rim. */
		position: absolute;
		z-index: 2;
		left: 0;
		right: 0;
		bottom: 2rem;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem 1.5rem;
		width: max-content;
		max-width: calc(100% - 8px);
		margin: 0 auto;
		padding: 10px 18px;
		border-radius: var(--r-sm);
		background: var(--surface-float);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.5);
		color: var(--text);
		font-size: var(--fs-md);
		pointer-events: none;
	}
	.ros-key {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.ros-key kbd {
		min-width: 26px;
		padding: 0 7px;
		border-radius: var(--r-xs);
		background: var(--surface-float-key);
		color: var(--text);
		/* Body, not mono: in the mono face a capital O and a zero are twins. */
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		line-height: 26px;
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
	/* A refused key (the shared nudge, app.css, which guards reduced motion). */
	.til-card.is-nudged {
		animation: nudge 120ms 2;
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

	/* No keyboard to speak of on a touch screen: the legend would be noise.
	   (A different AXIS from the width table — see responsive survey.) */
	.ros-by-touch {
		display: none;
	}
	@media (hover: none) {
		.ros-keys {
			display: none;
		}
		.ros-by-pointer {
			display: none;
		}
		.ros-by-touch {
			display: inline;
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

	/* ── Below compact (40rem — $lib/breakpoints.ts): three tiles fit at 320
	   (88px: 3 × 88 + gaps in the 278px a 320 screen leaves; the portrait is
	   76, the astroids 78). */
	@media (max-width: 40rem) {
		/* More keeps its MARK and drops its WORD (Teams' details); Sort has
		   no mark, so its word stays. */
		.ros-more :global(.band-menu-word),
		.ros-more :global(.band-menu-sep) {
			display: none;
		}
		/* The lock too, so the head's group holds one row beside the title. */
		.ros-lock-word {
			display: none;
		}
		/* Mark only: the .btn--icon box, so it matches undo and redo. */
		.ros-lock {
			padding: 0.25rem;
			min-width: 1.6rem;
			justify-content: center;
		}
		/* The count spent a row of its own; Teams' details show none here, and
		   the Owned toggle answers "how many". */
		.ros-filters :global(.rfs-count) {
			display: none;
		}
		.til {
			grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
			gap: 0.75rem 0.25rem;
		}
	}
</style>
