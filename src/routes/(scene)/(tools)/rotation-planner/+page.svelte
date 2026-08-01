<script lang="ts">
	import RotationTimeline from '$lib/components/RotationTimeline.svelte';
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
	import { warmAvatars } from '$lib/utils/warmAvatars';
	import { browser } from '$app/environment';
	import { fade } from 'svelte/transition';
	import { onMount, untrack } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { claimVeilReady, afterPaint } from '$lib/landing/veilReady';

	// ---------------------------------------------------------------------------
	// Tab model
	// ---------------------------------------------------------------------------

	type Tab = {
		id: string;
		label: string;
		notation: string;
		manualSlots: string[] | null;
		tabLoadout?: Record<string, LoadoutEntry>;
		/** Per-tab constellation overrides (Layer 2), parallel to tabLoadout. */
		tabCon?: Record<string, number>;
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

	// Server and client both initialize to the same deterministic default (one
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
	let tabCon = $state<Record<string, number>>({});

	// Flips true once onMount has restored saved tabs. Gates the auto-persist
	// effect so the pre-restore default state can never clobber saved tabs.
	let restored = $state(false);

	// Hold the loading veil until the restored rotation is actually drawn.
	// Claimed at INIT — page components are constructed during the layout's
	// render pass, so this runs before the veil takes its reading. No-op unless
	// this is a server-rendered load with a veil to hold. Released in the
	// payload effect below.
	const releaseVeil = claimVeilReady();

	// ---------------------------------------------------------------------------
	// Auto-persist
	// Writes only to localStorage — never to $state — so there's no circular
	// reactivity. Svelte 5 batches the synchronous state mutations inside each
	// tab operation into a single effect run.
	// ---------------------------------------------------------------------------

	$effect(() => {
		if (!restored) return;
		const snapshot = tabs.map((t) =>
			t.id === activeTabId ? { ...t, notation, manualSlots, tabLoadout, tabCon } : t
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
			t.id === activeTabId ? { ...t, notation, manualSlots, tabLoadout, tabCon } : t
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
		tabCon = tab.tabCon ?? {};
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
		tabCon = {};
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
			tabCon = next.tabCon ?? {};
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

	/**
	 * Freeze the resolved effective loadout + constellation for every slotted
	 * character. Saved rotations are meant to stay faithful even if the roster
	 * (Layer 1) changes later, so un-overridden fields are captured densely at
	 * save time rather than re-resolving to the current roster on load. Existing
	 * tab overrides for non-slotted characters are preserved as-is. Only the bank
	 * copy is densified — the open tab keeps its sparse live-fallback state.
	 */
	function densifiedSnapshot(): {
		tabLoadout: Record<string, LoadoutEntry>;
		tabCon: Record<string, number>;
	} {
		const denseLoadout: Record<string, LoadoutEntry> = { ...tabLoadout };
		const denseCon: Record<string, number> = { ...tabCon };
		for (const id of slots) {
			if (id === 'blank') continue;
			const merged: LoadoutEntry = { ...($loadout[id] ?? {}), ...(tabLoadout[id] ?? {}) };
			if (merged.weaponId || merged.artifactSetId || merged.weaponRefinement) {
				denseLoadout[id] = merged;
			}
			// Always a number (incl. an explicit 0) so the level is pinned against
			// later roster edits — the whole point of the freeze.
			denseCon[id] = tabCon[id] ?? $constellations[id] ?? 0;
		}
		return { tabLoadout: denseLoadout, tabCon: denseCon };
	}

	function handleSave() {
		if (!notation.trim()) return;
		const activeTab = tabs.find((t) => t.id === activeTabId)!;
		const dense = densifiedSnapshot();
		if (activeTab.savedId) {
			savedNotations.update(activeTab.savedId, {
				name: activeTab.label,
				notation,
				manualSlots,
				tabLoadout: dense.tabLoadout,
				tabCon: dense.tabCon
			});
			showSaveNotice('Updated');
		} else {
			const newId = savedNotations.save({
				name: activeTab.label,
				notation,
				manualSlots,
				tabLoadout: dense.tabLoadout,
				tabCon: dense.tabCon
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
		tabCon = entry.tabCon ?? {};
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
			tabCon: entry.tabCon ?? {},
			savedId: entry.id
		};
		tabs = [...tabs, newTab];
		activeTabId = newTab.id;
		notation = entry.notation;
		manualSlots = entry.manualSlots;
		tabLoadout = entry.tabLoadout ?? {};
		tabCon = entry.tabCon ?? {};
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
			// Effective constellation: the tab's Layer-2 override wins over the
			// roster default, so a shared link carries what the rotation actually
			// ran at, not the sharer's roster.
			const level = tabCon[id] ?? $constellations[id];
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

	/** Apply a decoded shared rotation: cons + loadout → the tab (Layer 2), build+notation → a tab. */
	function importShared(shared: SharedRotation) {
		// Constellations import into the tab's Layer-2 override, NOT the global
		// roster — the planner never writes Layer 1, so a shared link can't stomp
		// the recipient's own constellations. Loadout is likewise tab-scoped.
		const importedCon = { ...shared.constellations };
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
				tabLoadout: shared.loadout,
				tabCon: importedCon
			};
			tabs = [...tabs, newTab];
			activeTabId = newTab.id;
		}
		notation = shared.notation;
		manualSlots = shared.team;
		tabLoadout = shared.loadout;
		tabCon = importedCon;
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
		tabCon = {};
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
			tabCon = active.tabCon ?? {};
		}
		restored = true;
		warmAvatars();
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
		tabCon = {};
		tabs = tabs.map((t, i) =>
			t.id === activeTabId
				? {
						...t,
						label: `Tab ${i + 1}`,
						notation: '',
						manualSlots: null,
						tabLoadout: {},
						tabCon: {},
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
		tabCon = {};
		clearResetConfirm();
	}

	// ---------------------------------------------------------------------------
	// Loadout callbacks
	// ---------------------------------------------------------------------------

	function handleTabLoadoutChange(charId: string, update: Partial<LoadoutEntry>) {
		tabLoadout = { ...tabLoadout, [charId]: { ...(tabLoadout[charId] ?? {}), ...update } };
	}

	// Layer 2 constellation write — the tab only, never the roster (the Team
	// Builder owns Layer 1). Never marks the character owned.
	function handleTabConChange(charId: string, level: number) {
		tabCon = { ...tabCon, [charId]: level };
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
	//
	// This is also where the loading veil is released on a hard load. The
	// planner is ready when the tabs are restored AND the slotted payloads have
	// landed AND the timeline they feed has painted — restore alone is far too
	// early, which is precisely the "shell, then the rotation blinks in" the
	// veil is there to cover. Reading `restored` inside the effect makes it
	// re-run when the flag flips, so the ordering of onMount vs effects does
	// not matter. releaseVeil is idempotent and a no-op once the veil is gone.
	$effect(() => {
		const loads = [...new Set([...slots, ...autoSlots])].map((id) =>
			// `blank` loads too now — the generic-profile placeholder kit, so a
			// "Blank E Q" rotation resolves and renders like any other slot.
			loadCharacter(id)
		);
		if (!restored) return;
		void Promise.all(loads).then(() => afterPaint(releaseVeil));
	});

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

	function handleWindowClick() {
		clearResetConfirm();
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
			class="rp-tab-bar"
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
					class="tab tab--closeable rp-tab"
					class:active={tab.id === activeTabId}
					class:rp-tab--drag-over-left={dragOverId === tab.id && dragSide === 'left'}
					class:rp-tab--drag-over-right={dragOverId === tab.id && dragSide === 'right'}
					class:rp-tab--dragging={draggedId === tab.id}
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
							class="rp-tab-rename"
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
						<span class="rp-tab-label">{tab.label}</span>
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
				<button class="btn btn--icon rp-tab-add" onclick={addTab} aria-label="New tab">+</button>
			{/if}

			<div class="rp-tab-bar-spacer"></div>

			<!-- Reset actions -->
			<div class="rp-tab-bar-actions">
				{#if resetTabConfirm}
					<button
						class="btn btn--danger is-confirming"
						onclick={(e) => {
							e.stopPropagation();
							doResetTab();
						}}
						title="Confirm: clear this tab">Confirm?</button
					>
				{:else}
					<button
						class="btn btn--danger"
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
							class="btn btn--danger is-confirming"
							onclick={(e) => {
								e.stopPropagation();
								doResetAll();
							}}
							title="Confirm: close all tabs and reset">Confirm?</button
						>
					{:else}
						<button
							class="btn btn--danger"
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

			<div class="rp-tab-bar-divider"></div>

			<!-- Save / Load actions -->
			<div class="rp-tab-bar-actions">
				{#if saveNotice}
					<span class="save-notice" transition:fade={{ duration: 180 }}>{saveNotice}</span>
				{/if}
				<button
					class="btn"
					class:rp-btn-linked={!!activeTabSavedId}
					onclick={() => {
						clearResetConfirm();
						handleSave();
					}}
					disabled={!notation.trim()}
					title={activeTabSavedId ? 'Update saved rotation' : 'Save rotation to bank'}
					>{activeTabSavedId ? '↺ Update' : '↑ Save'}</button
				>
				<button
					class="btn"
					onclick={() => {
						clearResetConfirm();
						loadOverlayOpen = true;
					}}
					title="Load a saved rotation">↓ Load</button
				>
				<button
					class="btn"
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
			bind:notation
			characterSlots={slots}
			{tabLoadout}
			{tabCon}
			sourceOpen={selectorOpen}
			onOpenSelector={() => {
				selectorOpen = true;
			}}
			onTabLoadoutChange={handleTabLoadoutChange}
			onTabConChange={handleTabConChange}
		>
			<!-- The character Source, layered over the track area from the portrait
			     edge (non-modal). Edits are live: each add/remove sets manualSlots,
			     which flows back down as the portraits' team. -->
			{#snippet sourceOverlay()}
				<CharacterSelector
					currentSlots={slots}
					onChange={(chosen) => (manualSlots = chosen)}
					onClose={() => {
						selectorOpen = false;
					}}
				/>
			{/snippet}
		</RotationTimeline>

		<!-- Always-on bonuses caption, directly under the frame (the
		     per-character ability panels are gone — the timeline itself is the
		     timing reference for slotted characters, and the Team Builder is
		     the deep ability reference) -->
		<TeamBonusesBlock {slots} />
	</section>
</section>

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
	   idiom shared with .chip (accent-tinted fill + inset ring). */

	.rp-tab-bar {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	/* .tab .tab--closeable now. Only the drag affordances and the width clamp
	   are local — the global class can't know about reorderable documents. */
	.rp-tab {
		position: relative;
		max-width: 180px;
		min-width: 0;
	}

	.rp-tab--dragging {
		opacity: 0.35;
	}

	/* Drop indicator: a 2px vertical line on the left or right edge of the target tab */
	.rp-tab--drag-over-left::before,
	.rp-tab--drag-over-right::after {
		content: '';
		position: absolute;
		top: 2px;
		bottom: 2px;
		width: 2px;
		border-radius: 1px;
		background: var(--accent);
		pointer-events: none;
	}
	.rp-tab--drag-over-left::before {
		left: -2px;
	}
	.rp-tab--drag-over-right::after {
		right: -2px;
	}

	.rp-tab-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
		min-width: 0;
	}

	.rp-tab-rename {
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
	/* Renaming happens inside the ACTIVE tab — which is beige now (the
	   --sel-surface pilot). White-on-beige would vanish; flip to ink and a
	   slightly-recessed opaque well (mixed against the known beige ground,
	   never alpha — the compositing law). */
	.tab.active .rp-tab-rename {
		color: var(--sel-ink);
		background: color-mix(in srgb, var(--sel-surface) 94%, black);
	}
	.rp-tab-rename:focus {
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 80%, transparent);
	}

	/* The + is a .btn--icon; only its glyph size and resting weight are local. */
	.rp-tab-add {
		font-size: var(--fs-xl);
		line-height: var(--lh-none);
		opacity: 0.5;
	}
	.rp-tab-add:hover {
		opacity: 1;
	}

	/* ── Tab strip: spacer + actions ────────────────────────────── */

	.rp-tab-bar-spacer {
		flex: 1;
	}

	.rp-tab-bar-actions {
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

	/* Tab is linked to a save-bank entry — the Update variant reads in accent.
	   Kept local on top of .btn: the global set is base/primary/danger, and
	   "linked" is a planner-specific semantic, not a fourth button variant. */
	.rp-btn-linked {
		color: color-mix(in srgb, var(--accent) 55%, var(--text));
	}
	.rp-btn-linked:hover {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: color-mix(in srgb, var(--accent) 35%, var(--text));
	}
</style>
