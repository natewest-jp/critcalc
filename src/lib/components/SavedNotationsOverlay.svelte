<script lang="ts">
	import { savedNotations, siteSettings, type SavedNotation } from '$lib/stores';
	import { getIndexEntryByDisplayName, getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { getAvatar } from '$lib/utils/getAvatar';
	import { elementColors } from '$lib/utils/elementColors';
	import Mark from './Mark.svelte';

	function elementBorderColor(charId: string): string {
		if (charId === 'blank') return '#17213a';
		const el = getCharacterIndexEntry(charId)?.element;
		const entry = el ? elementColors[el as keyof typeof elementColors] : undefined;
		return entry?.main ?? '#17213a';
	}

	let {
		canAddTab,
		onLoad,
		onLoadNewTab,
		onClose
	}: {
		canAddTab: boolean;
		onLoad: (entry: SavedNotation) => void;
		onLoadNewTab: (entry: SavedNotation) => void;
		onClose: () => void;
	} = $props();

	let entries = $derived([...$savedNotations].sort((a, b) => b.savedAt - a.savedAt));

	function entryCharIds(entry: SavedNotation): string[] {
		if (entry.manualSlots) return entry.manualSlots;
		const seen: string[] = [];
		for (const segment of entry.notation.split('>')) {
			const name = segment.trim().split(/\s+/)[0];
			if (!name) continue;
			const char = getIndexEntryByDisplayName(name);
			if (char && !seen.includes(char.id)) seen.push(char.id);
			if (seen.length === 4) break;
		}
		while (seen.length < 4) seen.push('blank');
		return seen;
	}

	let editingId = $state<string | null>(null);
	let editingName = $state('');

	function startRename(entry: SavedNotation) {
		editingId = entry.id;
		editingName = entry.name;
		deletingId = null;
	}

	function commitRename() {
		const trimmed = editingName.trim();
		if (editingId && trimmed) savedNotations.rename(editingId, trimmed);
		editingId = null;
	}

	function cancelRename() {
		editingId = null;
	}

	function focusInput(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	let deletingId = $state<string | null>(null);

	function requestDelete(id: string) {
		deletingId = deletingId === id ? null : id;
		editingId = null;
	}

	function confirmDelete(id: string) {
		savedNotations.delete(id);
		deletingId = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (editingId) {
				cancelRename();
				return;
			}
			if (deletingId) {
				deletingId = null;
				return;
			}
			onClose();
		}
	}

	function formatDate(ts: number): string {
		return new Date(ts).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="backdrop"
	role="button"
	tabindex="-1"
	aria-label="Close"
	onclick={onClose}
	onkeydown={(e) => e.key === 'Enter' && onClose()}
></div>

<div class="sn-panel" role="dialog" aria-modal="true" aria-label="Saved rotations">
	<div class="sn-panel-header">
		<h2 class="title">Saved Rotations</h2>
		<button class="btn btn--icon sn-close" onclick={onClose} aria-label="Close">
			<Mark name="close" size={16} />
		</button>
	</div>

	{#if entries.length === 0}
		<div class="empty-state">
			<p class="empty-title">No saved rotations yet.</p>
			<p class="empty-hint">
				Write a rotation and click <strong>Save</strong> to bank it here.
			</p>
		</div>
	{:else}
		<ul class="entry-list">
			{#each entries as entry (entry.id)}
				{@const charIds = entryCharIds(entry)}
				{@const isDeleting = deletingId === entry.id}

				<li class="entry" class:entry--deleting={isDeleting}>
					<!-- 4 overlapping side-avatar circles -->
					<div class="avatar-stack">
						{#each charIds as charId, i (i)}
							<div
								class="avatar-circle"
								class:avatar-blank={charId === 'blank'}
								style:left="{i * 20}px"
								style:z-index={i + 1}
								style:border-color={elementBorderColor(charId)}
							>
								{#if charId !== 'blank'}
									<img
										class="avatar-img"
										src={getAvatar(
											charId,
											$siteSettings.useNewOutfits,
											'side',
											$siteSettings.travelerVariant
										)}
										alt={charId}
										onerror={(e) => {
											const img = e.currentTarget as HTMLImageElement;
											if ($siteSettings.useNewOutfits && !img.dataset.triedFallback) {
												img.dataset.triedFallback = '1';
												img.src = getAvatar(charId, false, 'side', $siteSettings.travelerVariant);
											} else {
												img.style.display = 'none';
											}
										}}
									/>
								{/if}
							</div>
						{/each}
					</div>

					<!-- Name row + notation preview -->
					<div class="entry-content">
						<div class="entry-top">
							{#if editingId === entry.id}
								<input
									class="rename-input"
									bind:value={editingName}
									use:focusInput
									onclick={(e) => e.stopPropagation()}
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
								<span class="entry-name">{entry.name}</span>
								<button
									class="btn btn--icon sn-icon"
									onclick={() => startRename(entry)}
									title="Rename"
									aria-label="Rename {entry.name}"><Mark name="rename" size={12} /></button
								>
							{/if}
							<span class="entry-date">{formatDate(entry.savedAt)}</span>
						</div>
						<div class="entry-bottom">
							<span class="entry-notation">{entry.notation}</span>
						</div>
					</div>

					<!-- Load / New tab / Delete actions. Every one carries its mark: the
					     row used to be three bare words next to a glyph-only Rename, so
					     Delete — the only irreversible control in the overlay — read with
					     exactly as much weight as "New tab". -->
					<div class="entry-actions">
						{#if canAddTab}
							<button
								class="btn btn--sm"
								onclick={() => {
									deletingId = null;
									editingId = null;
									onLoadNewTab(entry);
								}}
								title="Open in a new tab"><Mark name="plus" size={12} /> New tab</button
							>
						{/if}
						<button
							class="btn btn--sm btn--primary"
							onclick={() => {
								deletingId = null;
								editingId = null;
								onLoad(entry);
							}}><Mark name="load" size={12} /> Load</button
						>
						{#if isDeleting}
							<button
								class="btn btn--sm btn--danger is-confirming"
								onclick={() => confirmDelete(entry.id)}
								><Mark name="warn" size={12} /> Confirm?</button
							>
						{:else}
							<button
								class="btn btn--sm btn--danger"
								onclick={() => requestDelete(entry.id)}
								aria-label="Delete {entry.name}"><Mark name="delete" size={12} /> Delete</button
							>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 60;
		cursor: default;
	}

	/* Dialog surface — raised panel with the chart-frame border tone. */
	.sn-panel {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 61;
		width: min(600px, calc(100vw - 32px));
		max-height: min(72vh, 640px);
		/* Modal surface (the --surface role) — quiet border, not dire: the
		   dire-tinted frame border grammar belongs to tool frames, and this
		   is an overlay (Nate 2026-07-31). */
		background: var(--surface);
		/* Modals keep their edge border and the softer corner — they float with
		   no ground to belong to. See the GEOMETRY block in app.css. */
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		font-family: var(--font-body);
		font-size: var(--fs-xs);
		color: var(--text);
	}

	.sn-panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px 12px;
		border-bottom: 1px solid var(--frame-line);
		flex-shrink: 0;
	}
	/* The two icon buttons are .btn--icon. Their glyphs are Marks now, so the
	   size is a PROP on the mark (16 for the panel's close, 12 for the row's
	   rename) — the --fs-2xl / --fs-xs that used to live here were sizing the
	   × and ✎ code points as type, which is the thing the marks-are-geometry
	   law exists to stop. */
	.sn-icon {
		flex-shrink: 0;
	}

	.empty-state {
		padding: 40px 24px;
		text-align: center;
		color: var(--muted);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.empty-title {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		margin: 0;
	}
	.empty-hint {
		font-size: var(--fs-xs);
		margin: 0;
		opacity: 0.7;
		line-height: var(--lh-relaxed);
	}
	.empty-hint strong {
		color: var(--text);
	}

	.entry-list {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		flex: 1;
	}
	.entry-list::-webkit-scrollbar {
		width: 6px;
	}
	.entry-list::-webkit-scrollbar-track {
		background: transparent;
	}
	.entry-list::-webkit-scrollbar-thumb {
		background: var(--fill-hover);
		border-radius: 3px;
	}

	.entry {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--frame-line);
		transition: background 150ms ease;
	}
	.entry:last-child {
		border-bottom: none;
	}
	.entry:hover {
		background: var(--fill-rest);
	}
	.entry--deleting {
		background: rgba(200, 60, 60, 0.04);
	}

	/*
		Avatar stack: 4 x 28px circles, 20px apart (8px overlap each).
		Total width: 28 + 3*20 = 88px.
		Border matches panel bg — creates the visible gap ring between overlapping circles.
	*/
	.avatar-stack {
		position: relative;
		width: calc(28px + 3 * 20px);
		height: 28px;
		flex-shrink: 0;
	}
	.avatar-circle {
		position: absolute;
		top: 0;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: var(--surface-raised); /* panel-in-modal (raised role) */
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.avatar-blank {
		background: var(--fill-rest);
		border-color: var(--surface-raised);
	}
	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.333) translateY(-14%);
	}

	.entry-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.entry-top {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.entry-name {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--text);
		letter-spacing: var(--ls-tight);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
		min-width: 0;
	}
	.entry-date {
		font-size: var(--fs-2xs);
		color: var(--muted);
		opacity: 0.65;
		white-space: nowrap;
		flex-shrink: 0;
		letter-spacing: var(--ls-mid);
	}
	.rename-input {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		background: var(--fill-rest);
		border: none;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
		border-radius: 3px;
		color: var(--text);
		padding: 2px 6px;
		outline: none;
		flex: 1;
		min-width: 0;
	}
	.rename-input:focus {
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 80%, transparent);
	}
	.entry-bottom {
		min-width: 0;
	}
	.entry-notation {
		/* KQM notation string stays monospace — the one place Mono is kept in
		   this overlay after the panel defaulted to Sans. */
		font-family: var(--font-mono);
		font-size: var(--fs-2xs);
		color: rgba(158, 172, 200, 0.7);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
		letter-spacing: var(--ls-tight);
	}

	.entry-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}
</style>
