<script lang="ts">
	import { rotationTabs as rt, TAB_LIMIT, type RotationTab } from '$lib/rotationTabs.svelte';
	import { savedNotations } from '$lib/stores';
	import Mark from './Mark.svelte';

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

	function closeTab(id: string) {
		rt.closeTab(id);
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

	/** Svelte action: focus + select the input on mount. */
	function focusInput(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
</script>

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

	{#if rt.tabs.length < TAB_LIMIT}
		<button class="btn btn--icon doc-tab-add" onclick={() => rt.addTab()} aria-label="New rotation">
			<Mark name="plus" />
		</button>
	{/if}
</div>

<style>
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
