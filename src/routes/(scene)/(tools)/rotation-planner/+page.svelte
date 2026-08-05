<script lang="ts">
	import RotationTimeline from '$lib/components/RotationTimeline.svelte';
	import TeamBonusesBlock from '$lib/components/TeamBonusesBlock.svelte';
	import CharacterSelector from '$lib/components/CharacterSelector.svelte';
	import SavedNotationsOverlay from '$lib/components/SavedNotationsOverlay.svelte';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
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
	import { fade } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { claimVeilReady, afterPaint } from '$lib/landing/veilReady';
	import { rotationTabs as rt, TAB_LIMIT, type RotationTab } from '$lib/rotationTabs.svelte';
	import { benchBand } from '$lib/benchBand.svelte';

	// ---------------------------------------------------------------------------
	// Tab state — hoisted to the shared working-team module (bench-band round):
	// the active tab's team IS the site's working team, so the Team Builder and
	// the bench band read and write the same state. Restore, persistence and
	// the save-bank label sync live in the (tools) layout, which stays mounted
	// across every tool. This page keeps the planner-only flows: save/load,
	// share links, tab-strip UI state.
	// ---------------------------------------------------------------------------

	// Hold the loading veil until the restored rotation is actually drawn.
	// Claimed at INIT — page components are constructed during the layout's
	// render pass, so this runs before the veil takes its reading. No-op unless
	// this is a server-rendered load with a veil to hold. Released in the
	// payload effect below.
	const releaseVeil = claimVeilReady();

	// ---------------------------------------------------------------------------
	// Tab operations — thin wrappers that clear this page's confirm UI before
	// delegating to the shared module.
	// ---------------------------------------------------------------------------

	function switchTab(id: string) {
		if (id === rt.activeTabId) return;
		clearResetConfirm();
		rt.switchTab(id);
	}

	function addTab() {
		rt.addTab();
	}

	function closeTab(id: string) {
		clearResetConfirm();
		rt.closeTab(id);
	}

	function renameTab(id: string, label: string) {
		const tab = rt.renameTab(id, label);
		// Propagate rename to save bank if this tab is linked to a saved entry
		if (tab?.savedId) savedNotations.rename(tab.savedId, label.trim());
	}

	// ---------------------------------------------------------------------------
	// Save / load
	// ---------------------------------------------------------------------------

	/** Whether the active tab is linked to a saved bank entry. */
	let activeTabSavedId = $derived(rt.activeTab.savedId);

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
		const denseLoadout: Record<string, LoadoutEntry> = { ...rt.tabLoadout };
		const denseCon: Record<string, number> = { ...rt.tabCon };
		for (const id of slots) {
			if (id === 'blank') continue;
			const merged: LoadoutEntry = { ...($loadout[id] ?? {}), ...(rt.tabLoadout[id] ?? {}) };
			if (merged.weaponId || merged.artifactSetId || merged.weaponRefinement) {
				denseLoadout[id] = merged;
			}
			// Always a number (incl. an explicit 0) so the level is pinned against
			// later roster edits — the whole point of the freeze.
			denseCon[id] = rt.tabCon[id] ?? $constellations[id] ?? 0;
		}
		return { tabLoadout: denseLoadout, tabCon: denseCon };
	}

	function handleSave() {
		if (!rt.notation.trim()) return;
		const activeTab = rt.activeTab;
		const dense = densifiedSnapshot();
		if (activeTab.savedId) {
			savedNotations.update(activeTab.savedId, {
				name: activeTab.label,
				notation: rt.notation,
				manualSlots: rt.manualSlots,
				tabLoadout: dense.tabLoadout,
				tabCon: dense.tabCon
			});
			showSaveNotice('Updated');
		} else {
			const newId = savedNotations.save({
				name: activeTab.label,
				notation: rt.notation,
				manualSlots: rt.manualSlots,
				tabLoadout: dense.tabLoadout,
				tabCon: dense.tabCon
			});
			rt.tabs = rt.tabs.map((t) => (t.id === rt.activeTabId ? { ...t, savedId: newId } : t));
			showSaveNotice('Saved');
		}
	}

	function handleLoad(entry: SavedNotation) {
		rt.tabs = rt.tabs.map((t) =>
			t.id === rt.activeTabId ? { ...t, label: entry.name, savedId: entry.id } : t
		);
		rt.notation = entry.notation;
		rt.manualSlots = entry.manualSlots;
		rt.tabLoadout = entry.tabLoadout ?? {};
		rt.tabCon = entry.tabCon ?? {};
		loadOverlayOpen = false;
	}

	function handleLoadNewTab(entry: SavedNotation) {
		if (rt.tabs.length >= TAB_LIMIT) return;
		rt.openTab({
			label: entry.name,
			notation: entry.notation,
			manualSlots: entry.manualSlots,
			tabLoadout: entry.tabLoadout ?? {},
			tabCon: entry.tabCon ?? {},
			savedId: entry.id
		});
		loadOverlayOpen = false;
	}

	// ---------------------------------------------------------------------------
	// Share via URL (?r= — deflate-raw base64url of the active tab)
	// ---------------------------------------------------------------------------

	async function handleShare() {
		if (!rt.notation.trim()) return;
		// Scope the build snapshot to the resolved team (this handles inferred
		// slots too), plus any character carrying a tab-level loadout override.
		const teamIds = new Set<string>([
			...slots.filter((id) => id !== 'blank'),
			...Object.keys(rt.tabLoadout)
		]);
		const cons: Record<string, number> = {};
		const lo: Record<string, LoadoutEntry> = {};
		for (const id of teamIds) {
			// Effective constellation: the tab's Layer-2 override wins over the
			// roster default, so a shared link carries what the rotation actually
			// ran at, not the sharer's roster.
			const level = rt.tabCon[id] ?? $constellations[id];
			if (typeof level === 'number' && level > 0) cons[id] = level;
			// Mirror RotationTimeline's effective-loadout merge so a shared link
			// renders identically regardless of the recipient's own defaults.
			const entry: LoadoutEntry = { ...($loadout[id] ?? {}), ...(rt.tabLoadout[id] ?? {}) };
			if (entry.weaponId || entry.artifactSetId || entry.weaponRefinement) lo[id] = entry;
		}
		const shared: SharedRotation = {
			notation: rt.notation,
			team: rt.manualSlots,
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
		const active = rt.activeTab;
		const pristine = rt.tabs.length === 1 && !active.notation.trim() && !active.savedId;
		const atLimit = rt.tabs.length >= TAB_LIMIT;
		if (pristine || atLimit) {
			// Reuse the current tab (empty first-load, or no room for a new one).
			rt.tabs = rt.tabs.map((t) =>
				t.id === rt.activeTabId ? { ...t, label, savedId: undefined } : t
			);
			rt.notation = shared.notation;
			rt.manualSlots = shared.team;
			rt.tabLoadout = shared.loadout;
			rt.tabCon = importedCon;
		} else {
			rt.openTab({
				label,
				notation: shared.notation,
				manualSlots: shared.team,
				tabLoadout: shared.loadout,
				tabCon: importedCon
			});
		}
		showSaveNotice(
			atLimit && !pristine ? 'Loaded — tab replaced (limit reached)' : 'Loaded shared rotation'
		);
	}

	// On first load: warm the avatar cache and register this tool's bench-band
	// affordances (a bench portrait click opens the character Source). Tab
	// restore lives in the (tools) layout now — it must run for every tool.
	onMount(() => {
		warmAvatars();
		return benchBand.registerHost({
			tool: 'rp',
			onPortraitClick: () => {
				selectorOpen = true;
			}
		});
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
		if (ids.length > 0) {
			const { replacedTab } = rt.importTeam(ids);
			showSaveNotice(replacedTab ? 'Team loaded — tab replaced (limit reached)' : 'Team loaded');
		}
	});

	let loadOverlayOpen = $state(false);

	// ---------------------------------------------------------------------------
	// Drag-to-reorder state
	// ---------------------------------------------------------------------------

	let draggedId = $state<string | null>(null);
	let dragOverId = $state<string | null>(null);
	let dragSide = $state<'left' | 'right' | null>(null);

	function reorderTabs(fromId: string, toId: string, side: 'left' | 'right') {
		rt.reorderTabs(fromId, toId, side);
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
		rt.resetActiveTab();
		clearResetConfirm();
	}

	function doResetAll() {
		rt.resetAll();
		clearResetConfirm();
	}

	// ---------------------------------------------------------------------------
	// Rename UI state
	// ---------------------------------------------------------------------------

	let editingTabId = $state<string | null>(null);
	let editingLabel = $state('');

	function startRename(tab: RotationTab, e: MouseEvent) {
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
	// Slot resolution — the shared module's now (notation-driven + manual
	// override); aliased for the markup below.
	// ---------------------------------------------------------------------------

	let slots = $derived(rt.slots);

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
		const loads = [...new Set([...slots, ...rt.autoSlots])].map((id) =>
			// `blank` loads too now — the generic-profile placeholder kit, so a
			// "Blank E Q" rotation resolves and renders like any other slot.
			loadCharacter(id)
		);
		if (!rt.restored) return;
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
			{#each rt.tabs as tab (tab.id)}
				<!--
					Outer element is a div[role=button] to avoid nesting <button>
					inside <button> (the close button). Keyboard: Enter = switch.
				-->
				<div
					class="tab tab--closeable rp-tab"
					class:active={tab.id === rt.activeTabId}
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

					{#if rt.tabs.length > 1}
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

			{#if rt.tabs.length < TAB_LIMIT}
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
				{#if rt.tabs.length > 1}
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
					disabled={!rt.notation.trim()}
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
					disabled={!rt.notation.trim()}
					title="Copy a shareable link to this rotation">⤴ Share</button
				>
			</div>
		</div>

		<!-- ── Timeline ─────────────────────────────────────────────── -->
		<RotationTimeline
			bind:notation={rt.notation}
			characterSlots={slots}
			tabLoadout={rt.tabLoadout}
			tabCon={rt.tabCon}
			sourceOpen={selectorOpen}
		>
			<!-- The character Source, layered over the track area from the portrait
			     edge (non-modal). Edits are live: each add/remove sets manualSlots,
			     which flows back down as the portraits' team. -->
			{#snippet sourceOverlay()}
				<CharacterSelector
					currentSlots={slots}
					onChange={(chosen) => (rt.manualSlots = chosen)}
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
		canAddTab={rt.tabs.length < TAB_LIMIT}
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
		background: var(--fill-rest);
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
