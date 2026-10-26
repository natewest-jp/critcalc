<!--
  Banners: CONDITIONS, at the top of the surface (docs/notices-design.md
  §3.3). Paper, a severity rule and mark, a bold lead clause. A banner stays
  while its condition holds and leaves by itself; a warning may be put away
  for the session (✕), an error may not. A refused action calls a banner
  back and it NUDGES (`notices.recall`).

  Placed by each surface: ToolStack floats it under the toolbar, the
  full-screen surface sets it at the top of its content.
-->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import { linear } from 'svelte/easing';
	import Mark from './Mark.svelte';
	import { notices } from '$lib/notices.svelte';
	import { motion, T_QUICK } from '$lib/motion';

	let { class: cls = '' }: { class?: string } = $props();

	/** The last nudge each banner answered, so a recall shakes it once. */
	const seen: Record<string, number> = {};
	function nudge(node: HTMLElement, key: string) {
		seen[key] = notices.nudges[key] ?? 0;
		$effect(() => {
			const n = notices.nudges[key] ?? 0;
			if (n === seen[key]) return;
			seen[key] = n;
			node.classList.remove('is-nudged');
			void node.offsetWidth;
			node.classList.add('is-nudged');
		});
	}
</script>

{#if notices.banners.length}
	<div class="nbs {cls}">
		{#each notices.banners as b (b.key)}
			<div
				class="nb nb--{b.kind} ctx-light"
				role={b.kind === 'error' ? 'alert' : 'status'}
				use:nudge={b.key}
				transition:fade={{ duration: motion(T_QUICK), easing: linear }}
			>
				<span class="nb-mark"><Mark name="warn" size={18} /></span>
				<span class="nb-text"
					><strong>{b.lead}</strong>{#if b.body}<span class="nb-body">{b.body}</span>{/if}</span
				>
				{#if b.actions?.length}
					<span class="nb-acts">
						{#each b.actions as a (a.label)}
							<button class="btn btn--sm btn--primary" onclick={a.run}>{a.label}</button>
						{/each}
					</span>
				{/if}
				{#if b.dismissable}
					<button
						class="nb-x"
						aria-label="Hide this for now"
						title="Hide this for now"
						onclick={() => notices.dismissBanner(b.key)}><Mark name="close" size={14} /></button
					>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.nbs {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.nb {
		--nb-ink: var(--ui-danger);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.9rem;
		padding: 0.6rem 0.6rem 0.6rem 1.1rem;
		border-radius: var(--r-md);
		background: var(--surface);
		color: var(--text);
		font-size: var(--fs-xl);
		line-height: 1.4;
		box-shadow:
			0 6px 20px rgb(0 0 0 / 0.35),
			inset 4px 0 0 var(--nb-ink);
	}
	.nb--warning {
		--nb-ink: var(--ui-warning);
	}
	.nb.is-nudged {
		animation: nudge 120ms linear 2;
	}
	.nb strong {
		color: var(--muted);
	}
	.nb-mark {
		display: inline-flex;
		color: var(--nb-ink);
	}
	.nb-body {
		margin-left: 0.3em;
	}
	.nb-text {
		flex: 1 1 14rem;
	}
	.nb-acts {
		display: flex;
		gap: 0.4rem;
	}
	.nb-x {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: none;
		color: var(--muted);
		cursor: pointer;
	}
	.nb-x:hover,
	.nb-x:focus-visible {
		background: rgb(127 127 127 / 0.2);
	}
</style>
