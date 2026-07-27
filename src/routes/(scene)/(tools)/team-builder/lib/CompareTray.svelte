<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { siteSettings } from '$lib/stores';
	import { getAvatar, getAvatarFallback, hasAvatar } from '$lib/utils/getAvatar';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { MAX_COMPARE } from './compare';

	let {
		ids,
		onRemove,
		onClear,
		onCompare
	}: {
		ids: string[];
		onRemove: (id: string) => void;
		onClear: () => void;
		onCompare: () => void;
	} = $props();

	const entries = $derived(
		ids.map((id) => {
			const entry = getCharacterIndexEntry(id);
			return {
				id,
				name: entry?.displayName ?? id,
				color: (elementColors[(entry?.element ?? 'none') as ElementKey] ?? elementColors.none).main
			};
		})
	);

	const erroredAvatars = new SvelteSet<string>();
	function fallbackFor(id: string): boolean {
		return erroredAvatars.has(id) || !hasAvatar(id);
	}
	function handleAvatarError(id: string, event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src.includes('-newfit')) {
			img.src = getAvatarFallback(id, 'side', $siteSettings.travelerVariant);
		} else {
			erroredAvatars.add(id);
		}
	}
</script>

<div class="tray" role="region" aria-label="Compare selection">
	<div class="tray-picks">
		{#each entries as e (e.id)}
			<button
				class="tray-pick"
				style:--el-color={e.color}
				onclick={() => onRemove(e.id)}
				title="Remove {e.name} from comparison"
			>
				<span class="tray-avatar">
					{#if !fallbackFor(e.id)}
						<img
							src={getAvatar(
								e.id,
								$siteSettings.useNewOutfits,
								'side',
								$siteSettings.travelerVariant
							)}
							alt=""
							onerror={(ev) => handleAvatarError(e.id, ev)}
						/>
					{:else}
						<span class="tray-initials">{e.name.slice(0, 2).toUpperCase()}</span>
					{/if}
				</span>
				<span class="tray-name">{e.name}</span>
				<span class="tray-x" aria-hidden="true">✕</span>
			</button>
		{/each}
		{#if ids.length < MAX_COMPARE}
			<span class="tray-hint">
				{ids.length < 2 ? 'pick another to compare' : `up to ${MAX_COMPARE}`}
			</span>
		{/if}
	</div>
	<div class="tray-actions">
		<button class="btn btn--outline" onclick={onClear}>Clear</button>
		<button class="btn btn--primary tray-go" disabled={ids.length < 2} onclick={onCompare}>
			Compare {ids.length}
		</button>
	</div>
</div>

<style>
	.tray {
		position: fixed;
		bottom: 18px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 900;
		display: flex;
		align-items: center;
		gap: 0.9rem;
		max-width: calc(100vw - 32px);
		padding: 0.5rem 0.7rem;
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border));
		border-radius: 6px;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
		font-family: var(--font-body);
		backdrop-filter: blur(6px);
	}

	/* .btn--primary; the tray's own sizing is local. */
	.tray-go {
		padding: 0.35rem 0.75rem;
		letter-spacing: var(--ls-mid);
	}

	.tray-picks {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.35rem;
		min-width: 0;
	}

	.tray-pick {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.45rem 0.2rem 0.25rem;
		border: 1px solid color-mix(in srgb, var(--el-color) 40%, var(--border));
		border-radius: 999px;
		background: color-mix(in srgb, var(--el-color) 8%, transparent);
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition: border-color 150ms ease;
	}
	.tray-pick:hover {
		border-color: color-mix(in srgb, var(--el-color) 80%, var(--border));
	}
	.tray-pick:hover .tray-x {
		color: var(--text);
	}

	.tray-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		overflow: hidden;
		background: rgba(0, 0, 0, 0.5);
	}
	.tray-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.333) translateY(-14%);
	}
	.tray-initials {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		color: var(--el-color);
	}

	.tray-name {
		white-space: nowrap;
	}

	.tray-x {
		color: color-mix(in srgb, var(--muted) 60%, transparent);
		font-size: var(--fs-xs);
	}

	.tray-hint {
		margin-left: 0.2rem;
		font-size: var(--fs-xs);
		color: var(--muted);
		white-space: nowrap;
	}

	.tray-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.tray-go:disabled {
		opacity: 0.45;
		cursor: default;
	}
</style>
