<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	let {
		title,
		open = $bindable(false),
		children
	}: {
		title: string;
		open?: boolean;
		children: Snippet;
	} = $props();

	function onWindowKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') open = false;
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		class="overlay-backdrop"
		transition:fade={{ duration: 140 }}
		onclick={(event) => {
			if (event.target === event.currentTarget) open = false;
		}}
	>
		<div class="overlay-panel" role="dialog" aria-modal="true" aria-label={title}>
			<header class="overlay-header">
				<h2 class="overlay-title">{title}</h2>
				<button class="overlay-close" onclick={() => (open = false)} aria-label="Close">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
						<path d="M6 6l12 12M18 6L6 18" />
					</svg>
				</button>
			</header>
			<div class="overlay-rule"></div>
			<div class="overlay-body">
				{@render children()}
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay-backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: grid;
		place-items: center;
		padding: 2rem;
		background: rgba(3, 6, 14, 0.72);
	}

	.overlay-panel {
		width: min(34rem, 100%);
		max-height: min(80svh, 40rem);
		overflow-y: auto;
		padding: 1.4rem 1.6rem 1.6rem;
		border-radius: 8px;
		background: var(--surface);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.07),
			0 18px 60px rgba(0, 0, 0, 0.55);
	}

	.overlay-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.overlay-title {
		font-size: 1.25rem;
		font-weight: 600;
	}

	.overlay-close {
		width: 30px;
		height: 30px;
		flex: none;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 50%;
		background: var(--text);
		color: #0b1020;
		cursor: pointer;
		transition:
			background 150ms ease,
			box-shadow 150ms ease;
	}

	.overlay-close:hover {
		background: #fff;
		box-shadow: 0 0 10px rgba(230, 237, 248, 0.35);
	}

	.overlay-close svg {
		width: 14px;
		height: 14px;
	}

	/* Decorative hairline under the title — fades out to the right */
	.overlay-rule {
		height: 1px;
		margin: 0.85rem 0 1rem;
		background: linear-gradient(
			to right,
			color-mix(in srgb, var(--accent) 55%, transparent),
			transparent
		);
	}

	.overlay-body {
		display: grid;
		gap: 0.7rem;
		font-size: 0.92rem;
		line-height: 1.6;
		color: var(--muted);
	}

	.overlay-body :global(strong) {
		color: var(--text);
	}
</style>
