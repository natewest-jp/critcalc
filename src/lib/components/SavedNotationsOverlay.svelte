<script lang="ts">
	import { savedNotations, siteSettings, type SavedNotation } from '$lib/stores';
	import { getCharacterByDisplayName, getCharacterById } from '$lib/data/characterLookup';
	import { getAvatar } from '$lib/utils/getAvatar';

	const ELEMENT_COLOR: Record<string, string> = {
		pyro: '#e05a4a', hydro: '#1472f0', anemo: '#4ecbb4',
		electro: '#c070f0', cryo: '#88c8f0', geo: '#d4a040',
		dendro: '#80c840'
	};

	function elementBorderColor(charId: string): string {
		if (charId === 'blank') return '#17213a';
		const el = getCharacterById(charId)?.element;
		return el ? (ELEMENT_COLOR[el] ?? '#17213a') : '#17213a';
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
			const char = getCharacterByDisplayName(name);
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

	function cancelRename() { editingId = null; }

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
			if (editingId) { cancelRename(); return; }
			if (deletingId) { deletingId = null; return; }
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

<div class="panel" role="dialog" aria-modal="true" aria-label="Saved rotations">

	<div class="panel-header">
		<h2 class="panel-title">Saved Rotations</h2>
		<button class="close-btn" onclick={onClose} aria-label="Close">&#xD7;</button>
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
										src={getAvatar(charId, $siteSettings.useNewOutfits, 'side')}
										alt={charId}
										onerror={(e) => {
											const img = e.currentTarget as HTMLImageElement;
											if ($siteSettings.useNewOutfits && !img.dataset.triedFallback) {
												img.dataset.triedFallback = '1';
												img.src = getAvatar(charId, false, 'side');
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
										if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
										else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
									}}
								/>
							{:else}
								<span class="entry-name">{entry.name}</span>
								<button
									class="icon-btn"
									onclick={() => startRename(entry)}
									title="Rename"
									aria-label="Rename {entry.name}"
								>&#x270E;</button>
							{/if}
							<span class="entry-date">{formatDate(entry.savedAt)}</span>
						</div>
						<div class="entry-bottom">
							<span class="entry-notation">{entry.notation}</span>
						</div>
					</div>

					<!-- Load / New tab / Delete actions -->
					<div class="entry-actions">
						{#if canAddTab}
							<button
								class="action-btn action-btn--secondary"
								onclick={() => { deletingId = null; editingId = null; onLoadNewTab(entry); }}
								title="Open in a new tab"
							>New tab</button>
						{/if}
						<button
							class="action-btn action-btn--primary"
							onclick={() => { deletingId = null; editingId = null; onLoad(entry); }}
						>Load</button>
						{#if isDeleting}
							<button
								class="action-btn action-btn--confirm"
								onclick={() => confirmDelete(entry.id)}
							>Confirm?</button>
						{:else}
							<button
								class="action-btn action-btn--delete"
								onclick={() => requestDelete(entry.id)}
								aria-label="Delete {entry.name}"
							>Delete</button>
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

	.panel {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 61;
		width: min(600px, calc(100vw - 32px));
		max-height: min(72vh, 640px);
		background: #17213a;
		border: 1px solid #253252;
		border-radius: 12px;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace;
		font-size: 10px;
		color: #e6edf8;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px 12px;
		border-bottom: 1px solid #253252;
		flex-shrink: 0;
	}
	.panel-title {
		font-family: 'Space Grotesk', 'IBM Plex Mono', sans-serif;
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.01em;
		margin: 0;
		color: #e6edf8;
	}
	.close-btn {
		background: none;
		border: none;
		color: #9eacc8;
		font-size: 18px;
		line-height: 1;
		padding: 2px 4px;
		cursor: pointer;
		border-radius: 4px;
		transition: color 0.1s, background 0.1s;
	}
	.close-btn:hover {
		color: #e6edf8;
		background: rgba(255, 255, 255, 0.06);
	}

	.empty-state {
		padding: 40px 24px;
		text-align: center;
		color: #9eacc8;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.empty-title { font-size: 11px; font-weight: 600; margin: 0; }
	.empty-hint { font-size: 9.5px; margin: 0; opacity: 0.7; line-height: 1.6; }
	.empty-hint strong { color: #c8d4e8; }

	.entry-list {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		flex: 1;
	}
	.entry-list::-webkit-scrollbar { width: 6px; }
	.entry-list::-webkit-scrollbar-track { background: transparent; }
	.entry-list::-webkit-scrollbar-thumb { background: #253252; border-radius: 3px; }

	.entry {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 16px;
		border-bottom: 1px solid rgba(37, 50, 82, 0.6);
		transition: background 0.1s;
	}
	.entry:last-child { border-bottom: none; }
	.entry:hover { background: rgba(255, 255, 255, 0.025); }
	.entry--deleting { background: rgba(200, 60, 60, 0.04); }

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
		border: 1.5px solid #17213a;
		background: #0f1528;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.avatar-blank { background: #1a2540; border-color: #17213a; }
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
		font-family: 'Space Grotesk', 'IBM Plex Mono', sans-serif;
		font-size: 11px;
		font-weight: 600;
		color: #e6edf8;
		letter-spacing: 0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
		min-width: 0;
	}
	.entry-date {
		font-size: 8px;
		color: #4a6090;
		white-space: nowrap;
		flex-shrink: 0;
		letter-spacing: 0.04em;
	}
	.rename-input {
		font-family: 'Space Grotesk', 'IBM Plex Mono', sans-serif;
		font-size: 11px;
		font-weight: 600;
		background: rgba(255, 255, 255, 0.07);
		border: 1px solid #3a4e72;
		border-radius: 3px;
		color: #e6edf8;
		padding: 2px 6px;
		outline: none;
		flex: 1;
		min-width: 0;
	}
	.rename-input:focus { border-color: #6cb5ff; }
	.icon-btn {
		background: none;
		border: none;
		padding: 1px 3px;
		color: #4a6090;
		font-size: 10px;
		cursor: pointer;
		border-radius: 3px;
		line-height: 1;
		flex-shrink: 0;
		transition: color 0.1s, background 0.1s;
	}
	.icon-btn:hover { color: #9eacc8; background: rgba(255, 255, 255, 0.06); }
	.entry-bottom { min-width: 0; }
	.entry-notation {
		font-size: 8.5px;
		color: #6a7c9e;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
		letter-spacing: 0.02em;
	}

	.entry-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}
	.action-btn {
		border: 1px solid;
		border-radius: 4px;
		padding: 3px 7px;
		font-family: 'IBM Plex Mono', monospace;
		font-size: 8.5px;
		font-weight: 600;
		letter-spacing: 0.04em;
		cursor: pointer;
		white-space: nowrap;
		transition: background 0.1s, color 0.1s, border-color 0.1s;
	}
	.action-btn--primary {
		background: rgba(108, 181, 255, 0.1);
		border-color: rgba(108, 181, 255, 0.35);
		color: #6cb5ff;
	}
	.action-btn--primary:hover {
		background: rgba(108, 181, 255, 0.2);
		border-color: rgba(108, 181, 255, 0.6);
	}
	.action-btn--secondary {
		background: transparent;
		border-color: #2a3a5c;
		color: #9eacc8;
	}
	.action-btn--secondary:hover {
		background: rgba(255, 255, 255, 0.05);
		border-color: #3a4e72;
		color: #c8d4e8;
	}
	.action-btn--delete {
		background: transparent;
		border-color: #2a3a5c;
		color: #6a7c9e;
	}
	.action-btn--delete:hover {
		background: rgba(200, 60, 60, 0.1);
		border-color: rgba(200, 60, 60, 0.4);
		color: #e07070;
	}
	.action-btn--confirm {
		background: rgba(200, 60, 60, 0.15);
		border-color: rgba(200, 60, 60, 0.5);
		color: #e07070;
		animation: pulse-confirm 0.25s ease;
	}
	.action-btn--confirm:hover {
		background: rgba(200, 60, 60, 0.28);
		border-color: rgba(200, 60, 60, 0.7);
	}

	@keyframes pulse-confirm {
		from { transform: scale(0.92); opacity: 0.5; }
		to   { transform: scale(1);    opacity: 1;   }
	}
</style>
