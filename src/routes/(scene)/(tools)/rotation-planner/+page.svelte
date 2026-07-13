<script lang="ts">
	import RotationTimeline from '$lib/components/RotationTimeline.svelte';
	import RotationCharacterPanel from '$lib/components/RotationCharacterPanel.svelte';
	import TeamBonusesBlock from '$lib/components/TeamBonusesBlock.svelte';
	import CharacterSelector from '$lib/components/CharacterSelector.svelte';
	import SavedNotationsOverlay from '$lib/components/SavedNotationsOverlay.svelte';
	import { getCharacterIndexEntry, getIndexEntryByDisplayName } from '$lib/data/characterLookup';
	import { loadCharacter } from '$lib/data/characterData';
	import {
		savedNotations,
		loadout,
		constellations,
		type SavedNotation,
		type LoadoutEntry
	} from '$lib/stores';
	import { encodeRotation, decodeRotation, type SharedRotation } from '$lib/utils/rotationUrl';
	import { browser } from '$app/environment';
	import { fade } from 'svelte/transition';
	import { onMount, untrack } from 'svelte';
	import { afterNavigate } from '$app/navigation';

	// ---------------------------------------------------------------------------
	// Tab model
	// ---------------------------------------------------------------------------

	type Tab = {
		id: string;
		label: string;
		notation: string;
		manualSlots: string[] | null;
		tabLoadout?: Record<string, LoadoutEntry>;
		savedId?: string;
	};

	const TAB_LIMIT = 6;
	const TABS_KEY = 'critcalc:rotationTabs';

	function genId(): string {
		return Math.random().toString(36).slice(2, 10);
	}

	function makeTab(label: string): Tab {
		return { id: genId(), label, notation: '', manualSlots: null };
	}

	function loadFromStorage(): { tabs: Tab[]; activeTabId: string } | null {
		if (!browser) return null;
		try {
			const raw = localStorage.getItem(TABS_KEY);
			if (!raw) return null;
			const data = JSON.parse(raw);
			if (!Array.isArray(data.tabs) || data.tabs.length === 0 || !data.activeTabId) return null;
			return data;
		} catch {
			return null;
		}
	}

	// ---------------------------------------------------------------------------
	// Tabs state
	// ---------------------------------------------------------------------------

	// Server and client both initialise to the same deterministic default (one
	// empty tab) so the SSR'd markup and the hydrating component always agree.
	// Real localStorage state is restored in onMount — after hydration, before
	// the next paint — see the restore block there.
	const initialTab = makeTab('Tab 1');

	let tabs = $state<Tab[]>([initialTab]);
	let activeTabId = $state<string>(initialTab.id);

	// Live working state — kept separate from the tabs array so bind:notation
	// on RotationTimeline works cleanly without circular reactivity.
	let notation = $state<string>('');
	let manualSlots = $state<string[] | null>(null);
	let tabLoadout = $state<Record<string, LoadoutEntry>>({});

	// Flips true once onMount has restored saved tabs. Gates the auto-persist
	// effect so the pre-restore default state can never clobber saved tabs.
	let restored = $state(false);

	// ---------------------------------------------------------------------------
	// Auto-persist
	// Writes only to localStorage — never to $state — so there's no circular
	// reactivity. Svelte 5 batches the synchronous state mutations inside each
	// tab operation into a single effect run.
	// ---------------------------------------------------------------------------

	$effect(() => {
		if (!restored) return;
		const snapshot = tabs.map((t) =>
			t.id === activeTabId ? { ...t, notation, manualSlots, tabLoadout } : t
		);
		localStorage.setItem(TABS_KEY, JSON.stringify({ tabs: snapshot, activeTabId }));
	});

	// Sync tab labels when save bank entries are renamed from the overlay.
	// untrack() on the tabs read means only $savedNotations is a reactive dependency,
	// so renaming a tab (which also calls savedNotations.rename) doesn't re-enter this.
	$effect(() => {
		const bank = $savedNotations;
		tabs = untrack(() => tabs).map((t) => {
			if (!t.savedId) return t;
			const entry = bank.find((e) => e.id === t.savedId);
			if (!entry || entry.name === t.label) return t;
			return { ...t, label: entry.name };
		});
	});

	// ---------------------------------------------------------------------------
	// Tab operations
	// ---------------------------------------------------------------------------

	/** Flush live notation/slots/loadout back into the tabs array before any switch. */
	function flush() {
		tabs = tabs.map((t) =>
			t.id === activeTabId ? { ...t, notation, manualSlots, tabLoadout } : t
		);
	}

	function switchTab(id: string) {
		if (id === activeTabId) return;
		clearResetConfirm();
		flush();
		activeTabId = id;
		const tab = tabs.find((t) => t.id === id)!;
		notation = tab.notation;
		manualSlots = tab.manualSlots;
		tabLoadout = tab.tabLoadout ?? {};
	}

	function addTab() {
		if (tabs.length >= TAB_LIMIT) return;
		flush();
		const newTab = makeTab(`Tab ${tabs.length + 1}`);
		tabs = [...tabs, newTab];
		activeTabId = newTab.id;
		notation = '';
		manualSlots = null;
		tabLoadout = {};
	}

	function closeTab(id: string) {
		if (tabs.length <= 1) return;
		clearResetConfirm();
		flush();
		const idx = tabs.findIndex((t) => t.id === id);
		const wasActive = id === activeTabId;
		tabs = tabs.filter((t) => t.id !== id);
		if (wasActive) {
			const next = tabs[Math.min(idx, tabs.length - 1)];
			activeTabId = next.id;
			notation = next.notation;
			manualSlots = next.manualSlots;
			tabLoadout = next.tabLoadout ?? {};
		}
	}

	function renameTab(id: string, label: string) {
		const trimmed = label.trim();
		if (!trimmed) return;
		const tab = tabs.find((t) => t.id === id);
		tabs = tabs.map((t) => (t.id === id ? { ...t, label: trimmed } : t));
		// Propagate rename to save bank if this tab is linked to a saved entry
		if (tab?.savedId) savedNotations.rename(tab.savedId, trimmed);
	}

	// ---------------------------------------------------------------------------
	// Save / load
	// ---------------------------------------------------------------------------

	/** Whether the active tab is linked to a saved bank entry. */
	let activeTabSavedId = $derived(tabs.find((t) => t.id === activeTabId)?.savedId);

	let saveNotice = $state<string | null>(null);
	let _saveTimer: ReturnType<typeof setTimeout> | undefined;

	function showSaveNotice(msg: string) {
		clearTimeout(_saveTimer);
		saveNotice = msg;
		_saveTimer = setTimeout(() => {
			saveNotice = null;
		}, 2200);
	}

	function handleSave() {
		if (!notation.trim()) return;
		const activeTab = tabs.find((t) => t.id === activeTabId)!;
		if (activeTab.savedId) {
			savedNotations.update(activeTab.savedId, {
				name: activeTab.label,
				notation,
				manualSlots,
				tabLoadout
			});
			showSaveNotice('Updated');
		} else {
			const newId = savedNotations.save({
				name: activeTab.label,
				notation,
				manualSlots,
				tabLoadout
			});
			tabs = tabs.map((t) => (t.id === activeTabId ? { ...t, savedId: newId } : t));
			showSaveNotice('Saved');
		}
	}

	function handleLoad(entry: SavedNotation) {
		tabs = tabs.map((t) =>
			t.id === activeTabId ? { ...t, label: entry.name, savedId: entry.id } : t
		);
		notation = entry.notation;
		manualSlots = entry.manualSlots;
		tabLoadout = entry.tabLoadout ?? {};
		loadOverlayOpen = false;
	}

	function handleLoadNewTab(entry: SavedNotation) {
		if (tabs.length >= TAB_LIMIT) return;
		flush();
		const newTab: Tab = {
			id: genId(),
			label: entry.name,
			notation: entry.notation,
			manualSlots: entry.manualSlots,
			tabLoadout: entry.tabLoadout ?? {},
			savedId: entry.id
		};
		tabs = [...tabs, newTab];
		activeTabId = newTab.id;
		notation = entry.notation;
		manualSlots = entry.manualSlots;
		tabLoadout = entry.tabLoadout ?? {};
		loadOverlayOpen = false;
	}

	// ---------------------------------------------------------------------------
	// Share via URL (?r= — deflate-raw base64url of the active tab)
	// ---------------------------------------------------------------------------

	async function handleShare() {
		if (!notation.trim()) return;
		// Scope the build snapshot to the resolved team (this handles inferred
		// slots too), plus any character carrying a tab-level loadout override.
		const teamIds = new Set<string>([
			...slots.filter((id) => id !== 'blank'),
			...Object.keys(tabLoadout)
		]);
		const cons: Record<string, number> = {};
		const lo: Record<string, LoadoutEntry> = {};
		for (const id of teamIds) {
			const level = $constellations[id];
			if (typeof level === 'number' && level > 0) cons[id] = level;
			// Mirror RotationTimeline's effective-loadout merge so a shared link
			// renders identically regardless of the recipient's own defaults.
			const entry: LoadoutEntry = { ...($loadout[id] ?? {}), ...(tabLoadout[id] ?? {}) };
			if (entry.weaponId || entry.artifactSetId || entry.weaponRefinement) lo[id] = entry;
		}
		const shared: SharedRotation = {
			notation,
			team: manualSlots,
			constellations: cons,
			loadout: lo
		};
		try {
			const param = await encodeRotation(shared);
			const url = `${location.origin}${location.pathname}?r=${param}`;
			await navigator.clipboard.writeText(url);
			showSaveNotice('Link copied');
		} catch {
			showSaveNotice('Share failed');
		}
	}

	/** Apply a decoded shared rotation: cons → global store, build+notation → a tab. */
	function importShared(shared: SharedRotation) {
		// Constellations have no per-tab layer, so a faithful shared build must
		// write them to the global store — this overwrites the recipient's own
		// levels for those characters. Loadout stays tab-scoped (non-stomping).
		for (const [charId, level] of Object.entries(shared.constellations)) {
			constellations.setLevel(charId, level);
		}
		const label = 'Shared rotation';
		const active = tabs.find((t) => t.id === activeTabId)!;
		const pristine = tabs.length === 1 && !active.notation.trim() && !active.savedId;
		const atLimit = tabs.length >= TAB_LIMIT;
		if (pristine || atLimit) {
			// Reuse the current tab (empty first-load, or no room for a new one).
			tabs = tabs.map((t) => (t.id === activeTabId ? { ...t, label, savedId: undefined } : t));
		} else {
			flush();
			const newTab: Tab = {
				id: genId(),
				label,
				notation: shared.notation,
				manualSlots: shared.team,
				tabLoadout: shared.loadout
			};
			tabs = [...tabs, newTab];
			activeTabId = newTab.id;
		}
		notation = shared.notation;
		manualSlots = shared.team;
		tabLoadout = shared.loadout;
		showSaveNotice(
			atLimit && !pristine ? 'Loaded — tab replaced (limit reached)' : 'Loaded shared rotation'
		);
	}

	/** Imports a Team Builder hand-off (`?team=a,b,c,d`): characters into the
	 *  slots, no notation — same pristine-tab reuse rules as a shared rotation. */
	function importTeam(ids: string[]) {
		const team = [...ids];
		while (team.length < 4) team.push('blank');
		const label = 'From Team Builder';
		const active = tabs.find((t) => t.id === activeTabId)!;
		const pristine = tabs.length === 1 && !active.notation.trim() && !active.savedId;
		const atLimit = tabs.length >= TAB_LIMIT;
		if (pristine || atLimit) {
			tabs = tabs.map((t) => (t.id === activeTabId ? { ...t, label, savedId: undefined } : t));
		} else {
			flush();
			const newTab: Tab = { id: genId(), label, notation: '', manualSlots: team };
			tabs = [...tabs, newTab];
			activeTabId = newTab.id;
		}
		notation = '';
		manualSlots = team;
		tabLoadout = {};
		showSaveNotice(
			atLimit && !pristine ? 'Team loaded — tab replaced (limit reached)' : 'Team loaded'
		);
	}

	// On first load: restore saved tabs from localStorage (deferred out of init
	// so SSR/hydration see only the default state; this runs before the browser
	// paints the hydrated page). Order matters — the imports' pristine-tab check
	// and the persist effect must both see the restored tabs.
	onMount(() => {
		const stored = loadFromStorage();
		if (stored) {
			const activeId = stored.tabs.some((t) => t.id === stored.activeTabId)
				? stored.activeTabId
				: stored.tabs[0].id;
			const active = stored.tabs.find((t) => t.id === activeId) ?? stored.tabs[0];
			tabs = stored.tabs;
			activeTabId = activeId;
			notation = active.notation;
			manualSlots = active.manualSlots;
			tabLoadout = active.tabLoadout ?? {};
		}
		restored = true;
	});

	// Import a rotation carried in `?r=` — or a Team Builder hand-off in `?team=`
	// (`?r=` wins when both are present) — and strip the params. Lives in
	// afterNavigate, NOT onMount: on chained SPA navigation the component mounts
	// before the router updates location, so onMount would read the previous
	// page's URL and silently drop the params. Two hard-won rules (2026-07-13):
	// - afterNavigate ALSO fires on the navigation that REMOVES this component,
	//   with nav.to pointing at the OTHER page — consuming ?team= here would
	//   steal the Team Builder's own param mid-hand-off. Guard on nav.to.
	// - read nav.to.url, never window.location — location can lag the router.
	afterNavigate(async (nav) => {
		const url = nav.to?.url;
		if (!url || !url.pathname.endsWith('/rotation-planner')) return;
		const param = url.searchParams.get('r');
		const teamParam = url.searchParams.get('team');
		if (!param && !teamParam) return;
		// Strip the params regardless of outcome so a refresh/re-share is clean
		// and a bad link doesn't linger in the address bar.
		history.replaceState(history.state, '', url.pathname + url.hash);
		if (param) {
			const shared = await decodeRotation(param);
			if (!shared) {
				showSaveNotice('Invalid share link');
				return;
			}
			importShared(shared);
			return;
		}
		const ids = [
			...new Set(
				teamParam!
					.split(',')
					.map((s) => s.trim())
					.filter((id) => id && id !== 'blank' && getCharacterIndexEntry(id))
			)
		].slice(0, 4);
		if (ids.length > 0) importTeam(ids);
	});

	let loadOverlayOpen = $state(false);

	// ---------------------------------------------------------------------------
	// Drag-to-reorder state
	// ---------------------------------------------------------------------------

	let draggedId = $state<string | null>(null);
	let dragOverId = $state<string | null>(null);
	let dragSide = $state<'left' | 'right' | null>(null);

	function reorderTabs(fromId: string, toId: string, side: 'left' | 'right') {
		if (fromId === toId) return;
		flush();
		const arr = [...tabs];
		const fromIdx = arr.findIndex((t) => t.id === fromId);
		const [dragged] = arr.splice(fromIdx, 1);
		const toIdx = arr.findIndex((t) => t.id === toId);
		arr.splice(side === 'left' ? toIdx : toIdx + 1, 0, dragged);
		tabs = arr;
	}

	// ---------------------------------------------------------------------------
	// Reset
	// ---------------------------------------------------------------------------

	let resetTabConfirm = $state(false);
	let resetAllConfirm = $state(false);

	function clearResetConfirm() {
		resetTabConfirm = false;
		resetAllConfirm = false;
	}

	function doResetTab() {
		notation = '';
		manualSlots = null;
		tabLoadout = {};
		tabs = tabs.map((t, i) =>
			t.id === activeTabId
				? {
						...t,
						label: `Tab ${i + 1}`,
						notation: '',
						manualSlots: null,
						tabLoadout: {},
						savedId: undefined
					}
				: t
		);
		clearResetConfirm();
	}

	function doResetAll() {
		const first = makeTab('Tab 1');
		tabs = [first];
		activeTabId = first.id;
		notation = '';
		manualSlots = null;
		tabLoadout = {};
		clearResetConfirm();
	}

	// ---------------------------------------------------------------------------
	// Loadout callbacks
	// ---------------------------------------------------------------------------

	function handleTabLoadoutChange(charId: string, update: Partial<LoadoutEntry>) {
		tabLoadout = { ...tabLoadout, [charId]: { ...(tabLoadout[charId] ?? {}), ...update } };
	}

	function handleCharacterLoadoutChange(charId: string, update: Partial<LoadoutEntry>) {
		if ('weaponId' in update || 'weaponRefinement' in update) {
			loadout.setWeapon(charId, update.weaponId, update.weaponRefinement);
		}
		if ('artifactSetId' in update) {
			loadout.setArtifact(charId, update.artifactSetId);
		}
	}

	// ---------------------------------------------------------------------------
	// Rename UI state
	// ---------------------------------------------------------------------------

	let editingTabId = $state<string | null>(null);
	let editingLabel = $state('');

	function startRename(tab: Tab, e: MouseEvent) {
		e.stopPropagation();
		editingTabId = tab.id;
		editingLabel = tab.label;
	}

	function commitRename() {
		if (editingTabId) renameTab(editingTabId, editingLabel);
		editingTabId = null;
	}

	function cancelRename() {
		editingTabId = null;
	}

	/** Svelte action: focus + select the input on mount. */
	function focusInput(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	// ---------------------------------------------------------------------------
	// Slot resolution (notation-driven + manual override, same as before)
	// ---------------------------------------------------------------------------

	let autoSlots = $derived.by(() => {
		const seen: string[] = [];
		for (const segment of notation.split('>')) {
			const words = segment.trim().split(/\s+/).filter(Boolean);
			if (words.length === 0) continue;
			// Try longest multi-word prefix first so names like "Hu Tao" resolve
			// before a bare "Hu" would. Cap at 3 words — no canonical name is longer.
			let char = null;
			for (let k = Math.min(3, words.length); k >= 1; k--) {
				char = getIndexEntryByDisplayName(words.slice(0, k).join(' '));
				if (char) break;
			}
			if (char && !seen.includes(char.id)) seen.push(char.id);
			if (seen.length === 4) break;
		}
		while (seen.length < 4) seen.push('blank');
		return seen;
	});

	let slots = $derived(manualSlots ?? autoSlots);

	// Lazy-load full character payloads for the slotted set (plus any
	// notation-named characters when manual slots override autoSlots, so the
	// parser can still resolve them). Payloads land in characterData's
	// reactive cache; timeline/panels/bonuses populate via getLoadedCharacter.
	$effect(() => {
		for (const id of new Set([...slots, ...autoSlots])) {
			if (id !== 'blank') void loadCharacter(id);
		}
	});

	function handleSelectorConfirm(chosen: string[]) {
		manualSlots = chosen;
		selectorOpen = false;
	}

	// ---------------------------------------------------------------------------
	// Window-level keyboard / click handlers
	// ---------------------------------------------------------------------------

	function handlePageKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && (resetTabConfirm || resetAllConfirm)) {
			clearResetConfirm();
		}
	}

	// ---------------------------------------------------------------------------
	// UI state
	// ---------------------------------------------------------------------------

	let selectorOpen = $state(false);
	let panelsExpanded = $state(false);

	// ---------------------------------------------------------------------------
	// PNG export (delegates to the timeline instance; menu offers copy/download)
	// ---------------------------------------------------------------------------

	let timelineRef = $state<RotationTimeline>();
	let pngMenuOpen = $state(false);
	let pngBusy = $state(false);

	async function runPng(mode: 'copy' | 'download') {
		pngMenuOpen = false;
		if (!timelineRef || pngBusy) return;
		pngBusy = true;
		const result = await timelineRef.exportPng(mode);
		showSaveNotice(
			result === 'copied'
				? 'PNG copied'
				: result === 'downloaded'
					? 'PNG downloaded'
					: 'PNG export failed'
		);
		pngBusy = false;
	}

	function handleWindowClick() {
		clearResetConfirm();
		pngMenuOpen = false;
	}
</script>

<svelte:head>
	<title>Team rotation planner | critcalc.app</title>
</svelte:head>

<svelte:window onkeydown={handlePageKeydown} onclick={handleWindowClick} />

<section class="rotation-page">
	<section class="timeline-section">
		<!-- ── Tab bar ──────────────────────────────────────────────── -->
		<div
			class="tab-bar"
			role="tablist"
			tabindex="-1"
			ondragleave={(e) => {
				// Clear drop indicator when pointer leaves the bar entirely
				if (!e.currentTarget.contains(e.relatedTarget as Node)) {
					dragOverId = null;
					dragSide = null;
				}
			}}
		>
			{#each tabs as tab (tab.id)}
				<!--
					Outer element is a div[role=button] to avoid nesting <button>
					inside <button> (the close button). Keyboard: Enter = switch.
				-->
				<div
					class="tab"
					class:active={tab.id === activeTabId}
					class:tab--drag-over-left={dragOverId === tab.id && dragSide === 'left'}
					class:tab--drag-over-right={dragOverId === tab.id && dragSide === 'right'}
					class:tab--dragging={draggedId === tab.id}
					role="button"
					tabindex="0"
					draggable={editingTabId !== tab.id}
					onclick={() => switchTab(tab.id)}
					ondblclick={(e) => startRename(tab, e)}
					onkeydown={(e) => {
						if (e.key === 'Enter') switchTab(tab.id);
					}}
					ondragstart={(e) => {
						draggedId = tab.id;
						// Required for Firefox; content doesn't matter
						e.dataTransfer?.setData('text/plain', tab.id);
						if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
					}}
					ondragend={() => {
						draggedId = null;
						dragOverId = null;
						dragSide = null;
					}}
					ondragover={(e) => {
						if (!draggedId || draggedId === tab.id) return;
						e.preventDefault();
						if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
						const rect = e.currentTarget.getBoundingClientRect();
						dragOverId = tab.id;
						dragSide = e.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
					}}
					ondrop={(e) => {
						e.preventDefault();
						if (draggedId && dragOverId && dragSide) {
							reorderTabs(draggedId, dragOverId, dragSide);
						}
						draggedId = null;
						dragOverId = null;
						dragSide = null;
					}}
				>
					{#if editingTabId === tab.id}
						<input
							class="tab-rename"
							bind:value={editingLabel}
							use:focusInput
							onclick={(e) => e.stopPropagation()}
							ondblclick={(e) => e.stopPropagation()}
							onblur={commitRename}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									commitRename();
								} else if (e.key === 'Escape') {
									e.preventDefault();
									cancelRename();
								}
							}}
						/>
					{:else}
						<span class="tab-label">{tab.label}</span>
					{/if}

					{#if tabs.length > 1}
						<button
							class="tab-close"
							tabindex="-1"
							aria-label="Close {tab.label}"
							onclick={(e) => {
								e.stopPropagation();
								closeTab(tab.id);
							}}>×</button
						>
					{/if}
				</div>
			{/each}

			{#if tabs.length < TAB_LIMIT}
				<button class="tab-add" onclick={addTab} aria-label="New tab">+</button>
			{/if}

			<div class="tab-bar-spacer"></div>

			<!-- Reset actions -->
			<div class="tab-bar-actions">
				{#if resetTabConfirm}
					<button
						class="tb-btn tb-btn--confirm"
						onclick={(e) => {
							e.stopPropagation();
							doResetTab();
						}}
						title="Confirm: clear this tab">Confirm?</button
					>
				{:else}
					<button
						class="tb-btn tb-btn--destructive"
						onclick={(e) => {
							e.stopPropagation();
							resetAllConfirm = false;
							resetTabConfirm = true;
						}}
						title="Clear this tab's notation and unlink from save bank">Reset</button
					>
				{/if}
				{#if tabs.length > 1}
					{#if resetAllConfirm}
						<button
							class="tb-btn tb-btn--confirm"
							onclick={(e) => {
								e.stopPropagation();
								doResetAll();
							}}
							title="Confirm: close all tabs and reset">Confirm?</button
						>
					{:else}
						<button
							class="tb-btn tb-btn--destructive"
							onclick={(e) => {
								e.stopPropagation();
								resetTabConfirm = false;
								resetAllConfirm = true;
							}}
							title="Close all tabs and start fresh">Reset all</button
						>
					{/if}
				{/if}
			</div>

			<div class="tab-bar-divider"></div>

			<!-- Save / Load actions -->
			<div class="tab-bar-actions">
				{#if saveNotice}
					<span class="save-notice" transition:fade={{ duration: 180 }}>{saveNotice}</span>
				{/if}
				<button
					class="tb-btn"
					class:tb-btn--linked={!!activeTabSavedId}
					onclick={() => {
						clearResetConfirm();
						handleSave();
					}}
					disabled={!notation.trim()}
					title={activeTabSavedId ? 'Update saved rotation' : 'Save rotation to bank'}
					>{activeTabSavedId ? '↺ Update' : '↑ Save'}</button
				>
				<button
					class="tb-btn"
					onclick={() => {
						clearResetConfirm();
						loadOverlayOpen = true;
					}}
					title="Load a saved rotation">↓ Load</button
				>
				<div class="tb-png-wrap">
					<button
						class="tb-btn"
						disabled={!notation.trim() || pngBusy}
						aria-haspopup="menu"
						aria-expanded={pngMenuOpen}
						onclick={(e) => {
							e.stopPropagation();
							clearResetConfirm();
							pngMenuOpen = !pngMenuOpen;
						}}
						title="Export the timeline as an image">⧉ PNG</button
					>
					{#if pngMenuOpen}
						<div class="tb-png-menu" role="menu">
							<button
								class="tb-png-item"
								role="menuitem"
								onclick={(e) => {
									e.stopPropagation();
									runPng('copy');
								}}>Copy image</button
							>
							<button
								class="tb-png-item"
								role="menuitem"
								onclick={(e) => {
									e.stopPropagation();
									runPng('download');
								}}>Download</button
							>
						</div>
					{/if}
				</div>
				<button
					class="tb-btn"
					onclick={() => {
						clearResetConfirm();
						handleShare();
					}}
					disabled={!notation.trim()}
					title="Copy a shareable link to this rotation">⤴ Share</button
				>
			</div>
		</div>

		<!-- ── Timeline ─────────────────────────────────────────────── -->
		<RotationTimeline
			bind:this={timelineRef}
			bind:notation
			characterSlots={slots}
			{tabLoadout}
			onOpenSelector={() => {
				selectorOpen = true;
			}}
			onTabLoadoutChange={handleTabLoadoutChange}
		/>
	</section>

	<TeamBonusesBlock {slots} />

	<section class="panel-row">
		{#each slots as slotId, i (i)}
			<RotationCharacterPanel characterId={slotId} bind:expanded={panelsExpanded} />
		{/each}
	</section>
</section>

{#if selectorOpen}
	<CharacterSelector
		currentSlots={slots}
		{tabLoadout}
		onConfirm={handleSelectorConfirm}
		onClose={() => {
			selectorOpen = false;
		}}
		onCharacterLoadoutChange={handleCharacterLoadoutChange}
	/>
{/if}

{#if loadOverlayOpen}
	<SavedNotationsOverlay
		canAddTab={tabs.length < TAB_LIMIT}
		onLoad={handleLoad}
		onLoadNewTab={handleLoadNewTab}
		onClose={() => {
			loadOverlayOpen = false;
		}}
	/>
{/if}

<style>
	.rotation-page {
		display: flex;
		flex-direction: column;
		gap: clamp(16px, 2.5vw, 32px);
	}

	/* ── Timeline section (tab strip + timeline stacked) ─────────── */

	.timeline-section {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	/* ── Tab strip ───────────────────────────────────────────────
	   Tabs are chips floating on the tool black — the selected-state
	   idiom shared with .vz-chip (accent-tinted fill + inset ring). */

	.tab-bar {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.32rem 0.65rem;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.06);
		color: var(--muted);
		cursor: pointer;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		user-select: none;
		white-space: nowrap;
		min-width: 0;
		max-width: 180px;
		position: relative;
		transition:
			background 150ms ease,
			box-shadow 150ms ease,
			color 150ms ease,
			opacity 150ms ease;
	}

	.tab--dragging {
		opacity: 0.35;
	}

	/* Drop indicator: a 2px vertical line on the left or right edge of the target tab */
	.tab--drag-over-left::before,
	.tab--drag-over-right::after {
		content: '';
		position: absolute;
		top: 2px;
		bottom: 2px;
		width: 2px;
		border-radius: 1px;
		background: var(--accent);
		pointer-events: none;
	}
	.tab--drag-over-left::before {
		left: -2px;
	}
	.tab--drag-over-right::after {
		right: -2px;
	}

	.tab:hover:not(.active) {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--text);
	}

	.tab.active {
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent);
		color: var(--text);
	}

	.tab-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
		min-width: 0;
	}

	.tab-rename {
		background: rgba(255, 255, 255, 0.08);
		border: none;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
		border-radius: 3px;
		color: var(--text);
		font-size: var(--fs-sm);
		padding: 0.1rem 0.3rem;
		width: 92px;
		outline: none;
		flex-shrink: 0;
	}
	.tab-rename:focus {
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 80%, transparent);
	}

	.tab-close {
		background: none;
		border: none;
		padding: 0;
		width: 15px;
		height: 15px;
		border-radius: 3px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: inherit;
		font-size: var(--fs-lg);
		line-height: var(--lh-none);
		cursor: pointer;
		opacity: 0.4;
		flex-shrink: 0;
		transition:
			opacity 150ms ease,
			background 150ms ease;
	}
	.tab-close:hover {
		opacity: 1;
		background: rgba(255, 255, 255, 0.1);
	}

	.tab-add {
		background: none;
		border: none;
		padding: 0.2rem 0.5rem;
		color: var(--muted);
		font-size: var(--fs-xl);
		line-height: var(--lh-none);
		cursor: pointer;
		opacity: 0.5;
		transition:
			opacity 150ms ease,
			color 150ms ease;
	}
	.tab-add:hover {
		opacity: 1;
		color: var(--text);
	}

	/* ── Tab strip: spacer + actions ────────────────────────────── */

	.tab-bar-spacer {
		flex: 1;
	}

	.tab-bar-actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.save-notice {
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		color: color-mix(in srgb, var(--accent) 55%, var(--text));
		padding: 0 0.4rem;
		white-space: nowrap;
	}

	/* Quiet text buttons — fill on hover, no resting border. */
	.tb-btn {
		background: transparent;
		border: none;
		border-radius: 3px;
		padding: 0.32rem 0.55rem;
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
		cursor: pointer;
		white-space: nowrap;
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	.tb-btn:hover {
		background: rgba(255, 255, 255, 0.07);
		color: var(--text);
	}
	.tb-btn:disabled {
		opacity: 0.3;
		cursor: default;
		pointer-events: none;
	}
	.tab-bar-divider {
		width: 1px;
		height: 16px;
		background: rgba(255, 255, 255, 0.1);
		flex-shrink: 0;
		align-self: center;
		margin: 0 0.3rem;
	}

	.tb-btn--destructive {
		color: color-mix(in srgb, var(--muted) 70%, transparent);
	}
	.tb-btn--destructive:hover {
		background: rgba(200, 60, 60, 0.12);
		color: #e07070;
	}

	.tb-btn--confirm {
		background: rgba(200, 60, 60, 0.2);
		box-shadow: inset 0 0 0 1px rgba(200, 60, 60, 0.45);
		color: #e07070;
		animation: pulse-confirm 0.2s ease;
	}
	.tb-btn--confirm:hover {
		background: rgba(200, 60, 60, 0.32);
		color: #f09090;
	}

	@keyframes pulse-confirm {
		from {
			transform: scale(0.92);
			opacity: 0.5;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	/* Tab is linked to a save bank entry — show the Update variant in accent */
	.tb-btn--linked {
		color: color-mix(in srgb, var(--accent) 55%, var(--text));
	}
	.tb-btn--linked:hover {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: color-mix(in srgb, var(--accent) 35%, var(--text));
	}

	/* ── PNG export menu (copy / download pop-out) ──────────────── */

	.tb-png-wrap {
		position: relative;
	}

	.tb-png-menu {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		z-index: 40;
		min-width: 128px;
		display: flex;
		flex-direction: column;
		padding: 3px;
		background: var(--surface-raised);
		border-radius: 6px;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.06),
			0 4px 16px rgba(0, 0, 0, 0.5);
	}

	.tb-png-item {
		background: none;
		border: none;
		border-radius: 3px;
		padding: 6px 9px;
		text-align: left;
		font-size: var(--fs-sm);
		color: var(--muted);
		cursor: pointer;
		white-space: nowrap;
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	.tb-png-item:hover {
		background: rgba(255, 255, 255, 0.07);
		color: var(--text);
	}

	/* ── Character panel row ─────────────────────────────────────── */

	.panel-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: clamp(6px, 0.75vw, 10px);
		min-width: 0;
	}

	/* Panels flex with the viewport: 2×2 when four-across gets cramped. */
	@media (max-width: 1180px) {
		.panel-row {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
