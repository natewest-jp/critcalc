<script lang="ts">
	import RotationTimeline from '$lib/components/RotationTimeline.svelte';
	import RotationCharacterPanel from '$lib/components/RotationCharacterPanel.svelte';
	import TeamBonusesBlock from '$lib/components/TeamBonusesBlock.svelte';
	import CharacterSelector from '$lib/components/CharacterSelector.svelte';
	import SavedNotationsOverlay from '$lib/components/SavedNotationsOverlay.svelte';
	import { getIndexEntryByDisplayName } from '$lib/data/characterLookup';
	import { loadCharacter } from '$lib/data/characterData';
	import { savedNotations, loadout, type SavedNotation, type LoadoutEntry } from '$lib/stores';
	import { browser } from '$app/environment';
	import { fade } from 'svelte/transition';
	import { untrack } from 'svelte';

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

	// Derive all initial values from const data so no $state initializer
	// references another $state variable (avoids Svelte's state_referenced_locally warning).
	const stored = loadFromStorage();
	const initialTabs: Tab[] = stored?.tabs ?? [makeTab('Tab 1')];
	const initialActiveId: string =
		stored?.activeTabId && initialTabs.some((t) => t.id === stored.activeTabId)
			? stored.activeTabId
			: initialTabs[0].id;
	const initialTab = initialTabs.find((t) => t.id === initialActiveId) ?? initialTabs[0];

	let tabs = $state<Tab[]>(initialTabs);
	let activeTabId = $state<string>(initialActiveId);

	// Live working state — kept separate from the tabs array so bind:notation
	// on RotationTimeline works cleanly without circular reactivity.
	let notation = $state<string>(initialTab.notation);
	let manualSlots = $state<string[] | null>(initialTab.manualSlots);
	let tabLoadout = $state<Record<string, LoadoutEntry>>(initialTab.tabLoadout ?? {});

	// ---------------------------------------------------------------------------
	// Auto-persist
	// Writes only to localStorage — never to $state — so there's no circular
	// reactivity. Svelte 5 batches the synchronous state mutations inside each
	// tab operation into a single effect run.
	// ---------------------------------------------------------------------------

	$effect(() => {
		if (!browser) return;
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
</script>

<svelte:head>
	<title>Team rotation planner | critcalc.app</title>
</svelte:head>

<svelte:window onkeydown={handlePageKeydown} onclick={clearResetConfirm} />

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
						e.dataTransfer && (e.dataTransfer.effectAllowed = 'move');
					}}
					ondragend={() => {
						draggedId = null;
						dragOverId = null;
						dragSide = null;
					}}
					ondragover={(e) => {
						if (!draggedId || draggedId === tab.id) return;
						e.preventDefault();
						e.dataTransfer && (e.dataTransfer.dropEffect = 'move');
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
			</div>
		</div>

		<!-- ── Timeline ─────────────────────────────────────────────── -->
		<RotationTimeline
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
		onTabLoadoutChange={handleTabLoadoutChange}
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

	/* ── Timeline section (tab bar + timeline stacked, zero gap) ─── */

	.timeline-section {
		width: 100%;
		display: flex;
		flex-direction: column;
	}

	/* ── Tab bar ─────────────────────────────────────────────────── */

	.tab-bar {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		padding: 8px 12px 0;
		background: #17213a;
		border-radius: 10px 10px 0 0;
		border-bottom: 1px solid #253252;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 5px 8px 6px;
		border-radius: 5px 5px 0 0;
		border: 1px solid transparent;
		border-bottom: none;
		background: transparent;
		color: #9eacc8;
		cursor: pointer;
		font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace;
		font-size: 9px;
		letter-spacing: 0.03em;
		user-select: none;
		white-space: nowrap;
		min-width: 0;
		max-width: 160px;
		position: relative;
		transition:
			background 0.1s,
			color 0.1s,
			opacity 0.1s;
	}

	.tab--dragging {
		opacity: 0.35;
	}

	/* Drop indicator: a 2px vertical line on the left or right edge of the target tab */
	.tab--drag-over-left::before,
	.tab--drag-over-right::after {
		content: '';
		position: absolute;
		top: 4px;
		bottom: 4px;
		width: 2px;
		border-radius: 1px;
		background: #6cb5ff;
		pointer-events: none;
	}
	.tab--drag-over-left::before {
		left: -1px;
	}
	.tab--drag-over-right::after {
		right: -1px;
	}

	.tab:hover:not(.active) {
		background: rgba(255, 255, 255, 0.05);
		color: #c8d4e8;
	}

	/*
		Active tab: background matches the timeline card (#0f1528), and
		border-bottom-color matches so it visually "eats" the bar's bottom
		border, merging the tab into the content below.
	*/
	.tab.active {
		background: #0f1528;
		color: #e6edf8;
		border-color: #253252;
		border-bottom-color: #0f1528;
		margin-bottom: -1px;
		padding-bottom: 7px; /* +1px to compensate for the -1px margin */
	}

	.tab-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
		min-width: 0;
	}

	.tab-rename {
		background: rgba(255, 255, 255, 0.07);
		border: 1px solid #3a4e72;
		border-radius: 3px;
		color: #e6edf8;
		font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace;
		font-size: 9px;
		padding: 1px 4px;
		width: 80px;
		outline: none;
		flex-shrink: 0;
	}
	.tab-rename:focus {
		border-color: #6cb5ff;
	}

	.tab-close {
		background: none;
		border: none;
		padding: 0;
		width: 14px;
		height: 14px;
		border-radius: 3px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: inherit;
		font-size: 13px;
		line-height: 1;
		cursor: pointer;
		opacity: 0.4;
		flex-shrink: 0;
		transition:
			opacity 0.1s,
			background 0.1s;
	}
	.tab-close:hover {
		opacity: 1;
		background: rgba(255, 255, 255, 0.08);
	}

	.tab-add {
		background: none;
		border: none;
		padding: 0 8px 7px;
		color: #9eacc8;
		font-size: 16px;
		line-height: 1;
		cursor: pointer;
		opacity: 0.45;
		transition: opacity 0.1s;
		align-self: flex-end;
		font-family: 'IBM Plex Mono', monospace;
	}
	.tab-add:hover {
		opacity: 1;
	}

	/* ── Tab bar: spacer + actions ──────────────────────────────── */

	.tab-bar-spacer {
		flex: 1;
	}

	.tab-bar-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		padding-bottom: 6px;
		flex-shrink: 0;
	}

	.save-notice {
		font-family: 'IBM Plex Mono', monospace;
		font-size: 8.5px;
		letter-spacing: 0.06em;
		color: #6cb5ff;
		padding: 0 6px;
		white-space: nowrap;
	}

	.tb-btn {
		background: transparent;
		border: 1px solid #2a3a5c;
		border-radius: 4px;
		padding: 3px 8px;
		font-family: 'IBM Plex Mono', monospace;
		font-size: 8.5px;
		font-weight: 600;
		letter-spacing: 0.05em;
		color: #9eacc8;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background 0.1s,
			color 0.1s,
			border-color 0.1s;
	}
	.tb-btn:hover {
		background: rgba(255, 255, 255, 0.05);
		border-color: #3a4e72;
		color: #c8d4e8;
	}
	.tb-btn:disabled {
		opacity: 0.3;
		cursor: default;
		pointer-events: none;
	}
	.tab-bar-divider {
		width: 1px;
		height: 18px;
		background: #253252;
		flex-shrink: 0;
		align-self: center;
		margin: 0 2px;
	}

	.tb-btn--destructive {
		color: #6a7c9e;
		border-color: #1e2d4a;
	}
	.tb-btn--destructive:hover {
		background: rgba(200, 60, 60, 0.08);
		border-color: rgba(200, 60, 60, 0.35);
		color: #e07070;
	}

	.tb-btn--confirm {
		background: rgba(200, 60, 60, 0.15);
		border-color: rgba(200, 60, 60, 0.5);
		color: #e07070;
		animation: pulse-confirm 0.2s ease;
	}
	.tb-btn--confirm:hover {
		background: rgba(200, 60, 60, 0.28);
		border-color: rgba(200, 60, 60, 0.7);
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
		color: #6cb5ff;
		border-color: rgba(108, 181, 255, 0.3);
	}
	.tb-btn--linked:hover {
		background: rgba(108, 181, 255, 0.08);
		border-color: rgba(108, 181, 255, 0.55);
		color: #90c8ff;
	}

	/* ── Character panel row ─────────────────────────────────────── */

	.panel-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: clamp(6px, 0.75vw, 10px);
		min-width: 0;
	}
</style>
