<!--
  THE KEYBOARD SHORTCUTS SHEET (to-do, ⚓ Nate 2026-11-13: a dialog over the
  tool, the area you are in first). The list is `$lib/keysSheet.svelte.ts`;
  this draws it. LinksDialog's backdrop and motion, but the backdrop
  dismisses: nothing here needs an answer.
-->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import Mark from '$lib/components/Mark.svelte';
	import type { MarkName } from '$lib/marks.generated';
	import { keysSheet, currentKeyArea, orderedKeyAreas, type Key } from '$lib/keysSheet.svelte';

	// Read once as it opens: the sheet describes where you pressed `?`.
	const areas = orderedKeyAreas(currentKeyArea());

	// Only ever rendered on the client, after a key or a click.
	const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);

	const ARROWS: Partial<Record<Key, MarkName>> = {
		left: 'back',
		right: 'forward',
		up: 'arrowUp',
		down: 'arrowDown'
	};
	const ARROW_NAMES: Partial<Record<Key, string>> = {
		left: 'Left arrow',
		right: 'Right arrow',
		up: 'Up arrow',
		down: 'Down arrow'
	};
	function cap(k: Key): string {
		if (k === 'mod') return mac ? '⌘' : 'Ctrl';
		if (k === 'shift') return mac ? '⇧' : 'Shift';
		if (k === 'ctrl') return 'Ctrl';
		return k;
	}

	function close(): void {
		keysSheet.open = false;
	}

	let closeEl = $state<HTMLButtonElement | undefined>();
	$effect(() => closeEl?.focus());

	/** Escape is spent here, so the menu state under the sheet stays open. */
	function onKey(e: KeyboardEvent): void {
		if (e.key !== 'Escape' && e.key !== '?') return;
		e.preventDefault();
		e.stopImmediatePropagation();
		close();
	}
</script>

<svelte:window onkeydowncapture={onKey} />

<!-- `outroInert` is the outro-eats-your-click fix; ⛔ don't drop it. -->
<div
	class="ks-backdrop"
	transition:fade={{ duration: motion(T_QUICK) }}
	onintrostart={introLive}
	onoutrostart={outroInert}
	onclick={(e) => e.target === e.currentTarget && close()}
	role="presentation"
>
	<div class="ks-panel ctx-dark" role="dialog" aria-modal="true" aria-labelledby="ks-title">
		<header class="ks-head">
			<h2 class="ks-title" id="ks-title">Keyboard shortcuts</h2>
			<button class="btn btn--icon" bind:this={closeEl} aria-label="Close" onclick={close}
				><Mark name="close" /></button
			>
		</header>
		<div class="ks-body">
			{#each areas as area (area.id)}
				<section class="ks-area">
					<h3 class="kicker">{area.title}</h3>
					{#if area.note}<p class="ks-note">{area.note}</p>{/if}
					<dl class="ks-rows">
						{#each area.rows as row, i (i)}
							<dt class="ks-keys">
								{#each row.keys as combo, ci (ci)}
									{#if ci > 0}<span class="ks-or">or</span>{/if}
									<span class="ks-combo">
										{#each combo as k, ki (ki)}
											{@const arrow = ARROWS[k]}
											<kbd class="ks-cap" aria-label={ARROW_NAMES[k]}
												>{#if arrow}<Mark name={arrow} size={12} />{:else}{cap(k)}{/if}</kbd
											>
										{/each}
									</span>
								{/each}
							</dt>
							<dd class="ks-does">{row.does}</dd>
						{/each}
					</dl>
				</section>
			{/each}
		</div>
	</div>
</div>

<style>
	.ks-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(16, 16, 19, 0.72);
	}
	.ks-panel {
		display: flex;
		flex-direction: column;
		width: min(var(--ks-width, 46rem), 100%);
		/* ⚠️ Against the viewport, not `100%`: the backdrop's grid row sizes to
		   the panel's content, so a percentage cap never bites and a phone
		   pushed the panel off the bottom. */
		max-height: min(var(--ks-max-height, 40rem), calc(100dvh - 2rem));
		border-radius: var(--r-md);
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
	}
	.ks-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1rem 0.6rem 1.3rem;
	}
	.ks-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
	}
	.ks-body {
		overflow-y: auto;
		padding: 0.2rem 1.3rem 1.2rem;
	}
	/* Two columns where the rows still fit beside each other (`roomy`,
	   $lib/breakpoints.ts). */
	@media (min-width: 47.5rem) {
		.ks-body {
			columns: 2;
			column-gap: var(--ks-column-gap, 2rem);
		}
	}
	.ks-area {
		break-inside: avoid;
		padding-bottom: 1.1rem;
	}
	.ks-area .kicker {
		font-size: var(--fs-md);
		margin-bottom: 0.4rem;
	}
	.ks-note {
		margin: 0 0 0.4rem;
		font-size: var(--fs-md);
		color: var(--muted);
	}
	.ks-rows {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.35rem 0.8rem;
		align-items: baseline;
		margin: 0;
	}
	.ks-keys {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
	}
	.ks-combo {
		display: inline-flex;
		gap: 0.15rem;
	}
	.ks-or {
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.ks-cap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.6rem;
		height: 1.5rem;
		padding: 0 0.35rem;
		border-radius: var(--r-sm);
		background: var(--surface-raised);
		box-shadow: inset 0 -1px 0 var(--line-strong);
		font-family: var(--font-body);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
	.ks-does {
		margin: 0;
		font-size: var(--fs-lg);
		line-height: var(--lh-normal);
	}
</style>
