<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { TabStripModel } from '$lib/tabSet';
	import Mark from './Mark.svelte';
	import BandMenu from './BandMenu.svelte';
	import { fade } from 'svelte/transition';
	import { portal } from '$lib/actions/portal';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import { closeOnLeave } from '$lib/closeOnLeave';

	// ---------------------------------------------------------------------------
	// THE DOCUMENT TABS — band A's left zone (toolbar round, 2026-08-07).
	//
	// ↻ 2026-10-08 (lineups design §2.2): ONE strip for two kinds of document.
	// The Planner hands it its rotation tabs, the Team Builder its boards, each
	// through a `TabStripModel` — so both behave identically (⚓ Nate: "so
	// people already know how they behave"), and a fix to one is a fix to both.
	// ---------------------------------------------------------------------------

	let {
		model,
		newItems
	}: {
		model: TabStripModel;
		/** A menu for the + control instead of `model.addNew` (board presets). */
		newItems?: Snippet<[() => void]>;
	} = $props();

	type Tab = { id: string; label: string };
	const activeTab = $derived(model.tabs.find((t) => t.id === model.activeId) ?? model.tabs[0]);

	let draggedId = $state<string | null>(null);
	let dragOverId = $state<string | null>(null);
	let dragSide = $state<'left' | 'right' | null>(null);

	let editingTabId = $state<string | null>(null);
	let editingLabel = $state('');

	function switchTab(id: string) {
		if (id === model.activeId) return;
		model.switchTo(id);
	}

	function closeTab(id: string) {
		model.close(id);
	}

	function startRename(tab: Tab, e: MouseEvent) {
		e.stopPropagation();
		editingTabId = tab.id;
		editingLabel = tab.label;
	}

	function commitRename() {
		if (editingTabId) model.rename(editingTabId, editingLabel);
		editingTabId = null;
	}

	// ══ STRIP OR DROPDOWN (⚓ Nate 2026-10-08, lineups design §9.3) ══════════
	// The strip while it FITS, a dropdown where it doesn't — twelve tabs with
	// real names overflow even at 1440, and a phone could not hold three. Decided
	// by MEASUREMENT, ⛔ never a breakpoint or container query (containment
	// would trap the menu's fixed popover, and the width that matters depends
	// on the labels, not the viewport): a hidden copy of the strip is always
	// laid out, and its natural width is compared with the room this zone has.
	let rootEl = $state<HTMLDivElement | undefined>();
	let measureEl = $state<HTMLDivElement | undefined>();
	let collapsed = $state(false);

	$effect(() => {
		if (!rootEl || !measureEl) return;
		const root = rootEl;
		const measure = measureEl;
		const check = () => {
			collapsed = measure.scrollWidth > root.clientWidth;
		};
		const ro = new ResizeObserver(check);
		ro.observe(root);
		ro.observe(measure);
		check();
		return () => ro.disconnect();
	});

	let menuOpen = $state(false);
	let triggerEl = $state<HTMLElement | undefined>();
	let menuEl = $state<HTMLDivElement | undefined>();
	let menuX = $state(0);
	let menuY = $state(0);
	const MENU_W = 240;

	function openMenu() {
		if (!triggerEl) return;
		const r = triggerEl.getBoundingClientRect();
		menuX = Math.max(8, Math.min(r.left, window.innerWidth - MENU_W - 8));
		menuY = r.bottom + 6;
		menuOpen = true;
		queueMicrotask(() => menuEl?.focus());
	}

	function closeMenu(refocus = true) {
		menuOpen = false;
		if (refocus) triggerEl?.focus();
	}
	// Portalled, like BandMenu's, so it would outlive its page's leave.
	closeOnLeave(
		() => menuOpen,
		() => closeMenu(false)
	);

	/** Svelte action: focus + select the input on mount. */
	function focusInput(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
</script>

<!-- `folds`: the dropdown form's + leaves the row below `compact` and becomes
     the menu's last row (see .doc-tabs-new). Only the plain + folds — a
     preset menu (`newItems`) stays a menu of its own. -->
{#snippet addControl(folds = false)}
	{#if newItems}
		<BandMenu compact mark="plus" ariaLabel={model.newLabel} items={newItems} />
	{:else}
		<button
			class="btn btn--icon doc-tab-add"
			class:doc-tab-add--folds={folds}
			onclick={() => model.addNew?.()}
			aria-label={model.newLabel}
		>
			<Mark name="plus" />
		</button>
	{/if}
{/snippet}

<div class="doc-tabs-host" bind:this={rootEl}>
	<!-- The measuring copy: the strip as it would lay out, never seen or reached.
     Same classes, so its width is the strip's width. Its box clips it to the
     host, so its overflow never reaches an ancestor's scroll range. -->
	<div class="doc-tabs-measure-box" aria-hidden="true" inert>
		<div class="doc-tabs doc-tabs--measure" bind:this={measureEl}>
			{#each model.tabs as tab (tab.id)}
				<span class="tab tab--closeable doc-tab">
					<span class="doc-tab-label">{tab.label}</span>
					{#if model.tabs.length > 1}<span class="tab-close"><Mark name="close" size={11} /></span
						>{/if}
				</span>
			{/each}
			<span class="btn btn--icon doc-tab-add"><Mark name="plus" /></span>
		</div>
	</div>

	{#if collapsed}
		{@const active = activeTab}
		<!-- The dropdown form: the active tab as a trigger (double-click renames it,
	     as on the strip), every tab in a portalled list. -->
		<div class="doc-tabs">
			{#if editingTabId === active.id}
				<span class="tab tab--closeable doc-tab active">
					<input
						class="doc-tab-rename"
						bind:value={editingLabel}
						use:focusInput
						onblur={commitRename}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								commitRename();
							} else if (e.key === 'Escape') {
								e.preventDefault();
								editingTabId = null;
							}
						}}
					/>
				</span>
			{:else}
				<button
					bind:this={triggerEl}
					class="tab doc-tab doc-tab-trigger active"
					type="button"
					aria-haspopup="listbox"
					aria-expanded={menuOpen}
					onclick={() => (menuOpen ? closeMenu(false) : openMenu())}
					ondblclick={(e) => {
						menuOpen = false;
						startRename(active, e);
					}}
					onkeydown={(e) => {
						if (e.key === 'ArrowDown') {
							e.preventDefault();
							openMenu();
						}
					}}
				>
					<span class="doc-tab-label">{active.label}</span>
					<span class="doc-tab-count">{model.tabs.length}</span>
					<Mark name="chevron" size={11} />
				</button>
			{/if}
			{@render addControl(true)}
		</div>

		{#if menuOpen}
			<div
				class="doc-tabs-backdrop"
				use:portal
				transition:fade={{ duration: motion(T_QUICK) }}
				onintrostart={introLive}
				onoutrostart={outroInert}
				onclick={() => closeMenu(false)}
				aria-hidden="true"
			></div>
			<div
				bind:this={menuEl}
				class="doc-tabs-menu ctx-dark"
				use:portal
				transition:fade={{ duration: motion(T_QUICK) }}
				onintrostart={introLive}
				onoutrostart={outroInert}
				style:left="{menuX}px"
				style:top="{menuY}px"
				style:width="{MENU_W}px"
				role="dialog"
				aria-label="Open rotations"
				tabindex="-1"
				onkeydown={(e) => {
					if (e.key === 'Escape') {
						e.preventDefault();
						closeMenu();
					}
				}}
			>
				<!-- ↻ The LIST is the tabs alone, and the folded + is a button after
				     it (responsive sweep 2026-10-15 item 24, a11y): inside the
				     listbox a screen reader announced "New rotation" as one of the
				     open rotations. A bare block, so nothing moves. -->
				<div role="listbox" aria-label="Open rotations">
					{#each model.tabs as tab (tab.id)}
						<div
							class="doc-tabs-option"
							class:doc-tabs-option--active={tab.id === model.activeId}
							role="option"
							aria-selected={tab.id === model.activeId}
							tabindex="0"
							onclick={() => {
								switchTab(tab.id);
								closeMenu();
							}}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									switchTab(tab.id);
									closeMenu();
								}
							}}
						>
							<span class="doc-tab-label">{tab.label}</span>
							{#if model.tabs.length > 1}
								<button
									class="tab-close"
									tabindex="-1"
									aria-label="Close {tab.label}"
									onclick={(e) => {
										e.stopPropagation();
										closeTab(tab.id);
									}}><Mark name="close" size={11} /></button
								>
							{/if}
						</div>
					{/each}
				</div>
				{#if !newItems && model.addNew}
					<!-- The + folded into the menu below `compact` (responsive sweep
					     2026-10-15, §3 item 24): at 320 the trigger kept four
					     characters of the name, and the + was 30px of it. Its own
					     label, shown; hidden above `compact`, where the + stays. -->
					<div
						class="doc-tabs-option doc-tabs-new"
						role="button"
						tabindex="0"
						onclick={() => {
							closeMenu();
							model.addNew?.();
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								closeMenu();
								model.addNew?.();
							}
						}}
					>
						<Mark name="plus" size={11} />
						<span class="doc-tab-label">{model.newLabel}</span>
					</div>
				{/if}
			</div>
		{/if}
	{:else}
		<div
			class="doc-tabs"
			role="tablist"
			tabindex="-1"
			ondragleave={(e) => {
				// Clear the drop indicator when the pointer leaves the strip entirely
				if (!e.currentTarget.contains(e.relatedTarget as Node)) {
					dragOverId = null;
					dragSide = null;
				}
			}}
		>
			{#each model.tabs as tab (tab.id)}
				<!--
			Outer element is a div[role=button] to avoid nesting <button> inside
			<button> (the close control). Keyboard: Enter = switch.
		-->
				<div
					class="tab tab--closeable doc-tab"
					class:active={tab.id === model.activeId}
					class:doc-tab--drag-over-left={dragOverId === tab.id && dragSide === 'left'}
					class:doc-tab--drag-over-right={dragOverId === tab.id && dragSide === 'right'}
					class:doc-tab--dragging={draggedId === tab.id}
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
							model.reorder(draggedId, dragOverId, dragSide);
						}
						draggedId = null;
						dragOverId = null;
						dragSide = null;
					}}
				>
					{#if editingTabId === tab.id}
						<input
							class="doc-tab-rename"
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
									editingTabId = null;
								}
							}}
						/>
					{:else}
						<span class="doc-tab-label">{tab.label}</span>
					{/if}

					{#if model.tabs.length > 1}
						<button
							class="tab-close"
							tabindex="-1"
							aria-label="Close {tab.label}"
							onclick={(e) => {
								e.stopPropagation();
								closeTab(tab.id);
							}}><Mark name="close" size={11} /></button
						>
					{/if}
				</div>
			{/each}

			<!-- Always offered: at the limit it asks which tab to close (↻ 2026-10-08). -->
			{@render addControl()}
		</div>
	{/if}
</div>

<style>
	/* The zone's whole width, so the strip-or-dropdown test can read the room
	   it has (ToolStack lets band A's start zone grow). */
	.doc-tabs-host {
		position: relative;
		flex: 1;
		min-width: 0;
		display: flex;
	}
	/* The measuring copy's box: the host's own size, clipping. Unclipped, the
	   copy's max-content width (675px for five tabs) widened every scroll
	   ancestor's range — .tool-shell scrolled 371px past a 320 screen, unseen
	   only because the shell is overflow-x: hidden. ⛔ Not overflow on
	   .doc-tabs-host itself: that would clip the real tabs' focus rings. */
	.doc-tabs-measure-box {
		position: absolute;
		inset: 0;
		overflow: hidden;
		visibility: hidden;
		pointer-events: none;
	}
	/* Laid out, never painted or hit: only its width is read. */
	.doc-tabs--measure {
		position: absolute;
		top: 0;
		left: 0;
		width: max-content;
		visibility: hidden;
		pointer-events: none;
		overflow: visible;
	}

	.doc-tab-trigger {
		max-width: 240px;
	}
	/* How many are open — the strip showed it by its length, the trigger has
	   to say it. Condensed, in the label voice. */
	.doc-tab-count {
		font-family: var(--font-condensed);
		font-weight: var(--fw-normal);
		color: var(--muted);
	}

	.doc-tabs-backdrop {
		position: fixed;
		inset: 0;
		z-index: 90;
		background: transparent;
	}
	/* Same surface as the Visualizers' instrument picker and BandMenu: a
	   portalled popover is the MODAL role. */
	.doc-tabs-menu {
		position: fixed;
		z-index: 91;
		max-height: min(60svh, 480px);
		overflow-y: auto;
		padding: 0.35rem;
		border-radius: var(--r-md);
		background: var(--surface);
		border: 1px solid var(--border);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
		outline: none;
	}
	.doc-tabs-option {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.45rem 0.6rem;
		border-radius: 3px;
		color: var(--muted);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		/* A menu row is a CONTROL (NavPanel's .np-row). */
		transition:
			background-color var(--t-snap),
			color var(--t-snap);
	}
	.doc-tabs-option:hover,
	.doc-tabs-option:focus-visible {
		background: var(--accent-hover-fill);
		color: var(--text);
		outline: none;
	}
	.doc-tabs-option--active {
		color: var(--text);
		box-shadow: inset 0 0 0 1px var(--sel-ring);
	}
	/* The folded + (see the markup). The row exists at every width and shows
	   only where the trigger's + is gone, so the two are one switch.
	   ⚠ Literal from $lib/breakpoints.ts: `compact`, 40rem — the narrow round's
	   rung where a band control keeps its mark and drops its word. */
	.doc-tabs-new {
		display: none;
	}
	@media (max-width: 40rem) {
		.doc-tabs-new {
			display: flex;
		}
		.doc-tab-add--folds {
			display: none;
		}
	}

	/* gap: BAND_ITEM_GAP, shared with the actions zone across the row (⚓ Nate
	   2026-08-10 — these were .35rem and .25rem, two values that meant the same
	   thing and had drifted apart). */
	.doc-tabs {
		display: flex;
		align-items: center;
		gap: var(--band-item-gap, 4px);
		min-width: 0;
		/* The strip is the flexible half of band A: many documents ellipsize
		   inside it rather than pushing the actions off the band's end. */
		overflow: hidden;
	}

	/* .tab .tab--closeable now. Only the drag affordances and the width clamp
	   are local — the global class can't know about reorderable documents. */
	.doc-tab {
		position: relative;
		max-width: 180px;
		min-width: 0;
	}

	.doc-tab--dragging {
		opacity: 0.35;
	}

	/* Drop indicator: a 2px vertical line on the left or right edge of the
	   target tab.

	   Both sides use ::before. It was ::after on the right until the active tab
	   briefly wore `.inset--plain`, whose stroke is an ::after — one would have
	   silently won. The inset came back off the same day, but the two states are
	   mutually exclusive (dragSide is left XOR right) so one pseudo serves both
	   perfectly well, and leaving ::after free costs nothing. */
	.doc-tab--drag-over-left::before,
	.doc-tab--drag-over-right::before {
		content: '';
		position: absolute;
		top: 2px;
		bottom: 2px;
		width: 2px;
		border-radius: 1px;
		background: var(--accent);
		pointer-events: none;
	}
	.doc-tab--drag-over-left::before {
		left: -2px;
	}
	.doc-tab--drag-over-right::before {
		right: -2px;
	}

	.doc-tab-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
		min-width: 0;
	}

	.doc-tab-rename {
		background: var(--fill-rest);
		border: none;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
		border-radius: 3px;
		color: var(--text);
		font-size: var(--fs-md);
		padding: 0.1rem 0.3rem;
		width: 92px;
		outline: none;
		flex-shrink: 0;
		/* The focus ring eases like `.field`'s. */
		transition: box-shadow var(--t-snap);
	}
	/* ↻ 2026-08-10: the active tab stopped being a beige plate and went opaque
	   slate, so the ink-on-beige flip this used to need is gone with it. The
	   base rule above already reads correctly on that ground; only the well
	   stays local, mixed against the tab's own KNOWN opaque ground rather than
	   carried as alpha (the compositing law — and .ctx-glass's alpha lines do
	   not apply to a surface that is not glass). */
	.doc-tab.active .doc-tab-rename {
		background: color-mix(in srgb, var(--frame-bg) 88%, black);
	}
	.doc-tab-rename:focus {
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 80%, transparent);
	}

	/* The + is a .btn--icon; only its resting weight is local now that the glyph
	   is geometry rather than a font-sized character. */
	.doc-tab-add {
		opacity: 0.5;
	}
	.doc-tab-add:hover {
		opacity: 1;
	}
</style>
