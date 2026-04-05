<script lang="ts">
	import RotationTimeline from '$lib/components/RotationTimeline.svelte';
	import RotationCharacterPanel from '$lib/components/RotationCharacterPanel.svelte';
	import TeamBonusesBlock from '$lib/components/TeamBonusesBlock.svelte';
	import CharacterSelector from '$lib/components/CharacterSelector.svelte';
	import { getCharacterByDisplayName } from '$lib/data/characterLookup';
	import { browser } from '$app/environment';

	// ---------------------------------------------------------------------------
	// Tab model
	// ---------------------------------------------------------------------------

	type Tab = {
		id: string;
		label: string;
		notation: string;
		manualSlots: string[] | null;
		savedId?: string; // reserved: links to future save-bank entry
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

	// ---------------------------------------------------------------------------
	// Auto-persist
	// Writes only to localStorage — never to $state — so there's no circular
	// reactivity. Svelte 5 batches the synchronous state mutations inside each
	// tab operation into a single effect run.
	// ---------------------------------------------------------------------------

	$effect(() => {
		if (!browser) return;
		const snapshot = tabs.map((t) =>
			t.id === activeTabId ? { ...t, notation, manualSlots } : t
		);
		localStorage.setItem(TABS_KEY, JSON.stringify({ tabs: snapshot, activeTabId }));
	});

	// ---------------------------------------------------------------------------
	// Tab operations
	// ---------------------------------------------------------------------------

	/** Flush live notation/slots back into the tabs array before any switch. */
	function flush() {
		tabs = tabs.map((t) => (t.id === activeTabId ? { ...t, notation, manualSlots } : t));
	}

	function switchTab(id: string) {
		if (id === activeTabId) return;
		flush();
		activeTabId = id;
		const tab = tabs.find((t) => t.id === id)!;
		notation = tab.notation;
		manualSlots = tab.manualSlots;
	}

	function addTab() {
		if (tabs.length >= TAB_LIMIT) return;
		flush();
		const newTab = makeTab(`Tab ${tabs.length + 1}`);
		tabs = [...tabs, newTab];
		activeTabId = newTab.id;
		notation = '';
		manualSlots = null;
	}

	function closeTab(id: string) {
		if (tabs.length <= 1) return;
		flush();
		const idx = tabs.findIndex((t) => t.id === id);
		const wasActive = id === activeTabId;
		tabs = tabs.filter((t) => t.id !== id);
		if (wasActive) {
			const next = tabs[Math.min(idx, tabs.length - 1)];
			activeTabId = next.id;
			notation = next.notation;
			manualSlots = next.manualSlots;
		}
	}

	function renameTab(id: string, label: string) {
		const trimmed = label.trim();
		if (!trimmed) return;
		tabs = tabs.map((t) => (t.id === id ? { ...t, label: trimmed } : t));
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
			const name = segment.trim().split(/\s+/)[0];
			if (!name) continue;
			const char = getCharacterByDisplayName(name);
			if (char && !seen.includes(char.id)) seen.push(char.id);
			if (seen.length === 4) break;
		}
		while (seen.length < 4) seen.push('blank');
		return seen;
	});

	let slots = $derived(manualSlots ?? autoSlots);

	function handleSelectorConfirm(chosen: string[]) {
		manualSlots = chosen;
		selectorOpen = false;
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

<section class="rotation-page">
	<div class="intro">
		<p class="intro-kicker">Tool</p>
		<h1 class="intro-title">Team Rotation Planner</h1>
		<p class="intro-copy">
			Sequence your team's abilities on a shared timeline. Model burst windows, skill cooldowns, and
			on-field durations to evaluate rotation efficiency and buff uptime. Write rotations in
			KQM-compatible notation — paste directly from guides or build your own.
		</p>
	</div>

	<section class="timeline-section">

		<!-- ── Tab bar ──────────────────────────────────────────────── -->
		<div class="tab-bar">
			{#each tabs as tab (tab.id)}
				<!--
					Outer element is a div[role=button] to avoid nesting <button>
					inside <button> (the close button). Keyboard: Enter = switch.
				-->
				<div
					class="tab"
					class:active={tab.id === activeTabId}
					role="button"
					tabindex="0"
					onclick={() => switchTab(tab.id)}
					ondblclick={(e) => startRename(tab, e)}
					onkeydown={(e) => { if (e.key === 'Enter') switchTab(tab.id); }}
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
								if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
								else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
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
							onclick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
						>×</button>
					{/if}
				</div>
			{/each}

			{#if tabs.length < TAB_LIMIT}
				<button class="tab-add" onclick={addTab} aria-label="New tab">+</button>
			{/if}
		</div>

		<!-- ── Timeline ─────────────────────────────────────────────── -->
		<RotationTimeline
			bind:notation
			characterSlots={slots}
			onOpenSelector={() => { selectorOpen = true; }}
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
		onConfirm={handleSelectorConfirm}
		onClose={() => { selectorOpen = false; }}
	/>
{/if}

<style>
	.rotation-page {
		display: flex;
		flex-direction: column;
		gap: clamp(16px, 2.5vw, 32px);
	}

	/* ── Intro ───────────────────────────────────────────────────── */

	.intro {
		display: grid;
		gap: 0.75rem;
	}
	.intro-kicker {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		opacity: 0.7;
	}
	.intro-title {
		margin: 0;
		font-size: 1.875rem;
		font-weight: 600;
		letter-spacing: -0.025em;
	}
	.intro-copy {
		margin: 0;
		max-width: 56rem;
		font-size: 1rem;
		line-height: 1.75rem;
	}
	@media (min-width: 768px) {
		.intro-title { font-size: 2.25rem; }
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
		transition: background 0.1s, color 0.1s;
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
		transition: opacity 0.1s, background 0.1s;
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

	/* ── Character panel row ─────────────────────────────────────── */

	.panel-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: clamp(6px, 0.75vw, 10px);
		min-width: 0;
	}
</style>
