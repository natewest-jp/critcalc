<script lang="ts">
	import { rotationTabs as rt, type RotationTab } from '$lib/rotationTabs.svelte';
	import { documentBar } from '$lib/documentBar.svelte';
	import { savedNotations } from '$lib/stores';
	import Mark from './Mark.svelte';
	import { fade } from 'svelte/transition';
	import { portal } from '$lib/actions/portal';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';

	// ---------------------------------------------------------------------------
	// THE DOCUMENT TABS — band A's left zone, in EVERY benched tool (toolbar
	// round, 2026-08-07). Lifted verbatim out of the planner page, where it had
	// been since before there was a shared working team.
	//
	// That was the misplacement the round set out to fix: since the bench-band
	// round these tabs select the site's ONE working document — team, per-tab
	// loadout/constellations and notation together — and switching them switches
	// what the Team Builder is editing too. Living only in the planner meant the
	// Team Builder showed no document identity at all: you could not tell which
	// team you were editing, and you could not switch to another without
	// navigating to the other tool first.
	// ---------------------------------------------------------------------------

	let draggedId = $state<string | null>(null);
	let dragOverId = $state<string | null>(null);
	let dragSide = $state<'left' | 'right' | null>(null);

	let editingTabId = $state<string | null>(null);
	let editingLabel = $state('');

	function switchTab(id: string) {
		if (id === rt.activeTabId) return;
		rt.switchTab(id);
	}

	// Through the document bar: closing keeps the tab in Recently closed.
	function closeTab(id: string) {
		documentBar.closeTab(id);
	}

	function startRename(tab: RotationTab, e: MouseEvent) {
		e.stopPropagation();
		editingTabId = tab.id;
		editingLabel = tab.label;
	}

	function commitRename() {
		if (editingTabId) {
			const tab = rt.renameTab(editingTabId, editingLabel);
			// Propagate to the save bank when this document is linked to an entry.
			if (tab?.savedId) savedNotations.rename(tab.savedId, editingLabel.trim());
		}
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

	/** Svelte action: focus + select the input on mount. */
	function focusInput(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
</script>

<div class="doc-tabs-host" bind:this={rootEl}>
	<!-- The measuring copy: the strip as it would lay out, never seen or reached.
     Same classes, so its width is the strip's width. -->
	<div class="doc-tabs doc-tabs--measure" bind:this={measureEl} aria-hidden="true" inert>
		{#each rt.tabs as tab (tab.id)}
			<span class="tab tab--closeable doc-tab">
				<span class="doc-tab-label">{tab.label}</span>
				{#if rt.tabs.length > 1}<span class="tab-close"><Mark name="close" size={11} /></span>{/if}
			</span>
		{/each}
		<span class="btn btn--icon doc-tab-add"><Mark name="plus" /></span>
	</div>

	{#if collapsed}
		{@const active = rt.activeTab}
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
					<span class="doc-tab-count">{rt.tabs.length}</span>
					<Mark name="chevron" size={11} />
				</button>
			{/if}
			<button
				class="btn btn--icon doc-tab-add"
				onclick={() => documentBar.newTab()}
				aria-label="New rotation"
			>
				<Mark name="plus" />
			</button>
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
				role="listbox"
				aria-label="Open rotations"
				tabindex="-1"
				onkeydown={(e) => {
					if (e.key === 'Escape') {
						e.preventDefault();
						closeMenu();
					}
				}}
			>
				{#each rt.tabs as tab (tab.id)}
					<div
						class="doc-tabs-option"
						class:doc-tabs-option--active={tab.id === rt.activeTabId}
						role="option"
						aria-selected={tab.id === rt.activeTabId}
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
						{#if rt.tabs.length > 1}
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
			{#each rt.tabs as tab (tab.id)}
				<!--
			Outer element is a div[role=button] to avoid nesting <button> inside
			<button> (the close control). Keyboard: Enter = switch.
		-->
				<div
					class="tab tab--closeable doc-tab"
					class:active={tab.id === rt.activeTabId}
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
							rt.reorderTabs(draggedId, dragOverId, dragSide);
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

					{#if rt.tabs.length > 1}
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
			<button
				class="btn btn--icon doc-tab-add"
				onclick={() => documentBar.newTab()}
				aria-label="New rotation"
			>
				<Mark name="plus" />
			</button>
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
