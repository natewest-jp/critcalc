<!--
  The toast home and the dialog host (docs/notices-design.md §3.2, §3.4).
  Mounted ONCE, by the scene layout, so every surface (tools, the full-screen
  surface, the landing) has the same place to look.

  Toasts: bottom centre, above the Planner's phone dock (`--notice-floor`,
  which the dock publishes). ⚓ ALL PAPER (Nate 2026-10-27, from the
  `/lab/toast-attention` blind test): on a dark site paper is the one big
  brightness step, which is what peripheral vision catches; a glass toast
  could come and go unseen. The kind is the mark and a 4px left stripe in its
  state colour; an error also stays until dismissed. They arrive on the shared
  rise (`riseIn`). ⚠ A whole-paper surface would blunt this; none exists, and
  the shadow still separates the card there. The time left is a ring round the ✕ (⚓ Nate
  2026-10-26: the ring over the edge and the line), and the ✕'s hover is the
  ring's own circle, never a rounded rectangle behind it.

  The live region stays mounted: one inserted with its text is often not
  announced.
-->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { linear } from 'svelte/easing';
	import Mark from './Mark.svelte';
	import { notices, type NoticeKind } from '$lib/notices.svelte';
	import { motion, outroInert, introLive, riseIn, T_QUICK, T_MOVE } from '$lib/motion';

	const MARK: Record<NoticeKind, 'check' | 'about' | 'warn'> = {
		success: 'check',
		info: 'about',
		warning: 'warn',
		error: 'warn'
	};
	/** The ring's circumference: r = 12 in a 28 box. */
	const RING = 2 * Math.PI * 12;

	let safeEl = $state<HTMLButtonElement>();
	$effect(() => {
		if (notices.asking) safeEl?.focus();
	});
	function onKey(e: KeyboardEvent): void {
		if (notices.asking && e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			notices.answer(false);
		}
	}
</script>

<svelte:window onkeydowncapture={onKey} />

<div class="nr" aria-live="polite">
	{#each notices.toasts as t (t.id)}
		<div
			class="nt-slot"
			animate:flip={{ duration: motion(T_MOVE) }}
			in:riseIn
			out:fade={{ duration: motion(T_QUICK), easing: linear }}
		>
			<div
				class="nt nt--{t.kind} ctx-light"
				role={t.kind === 'error' ? 'alert' : undefined}
				onpointerenter={() => notices.pause(t.id)}
				onpointerleave={() => notices.resume(t.id)}
				onfocusin={() => notices.pause(t.id)}
				onfocusout={() => notices.resume(t.id)}
			>
				{#if t.swatch}
					<span class="nt-swatch" class:has-picture={!!t.picture} style:--pp={t.swatch}
						>{#if t.picture}<img src={t.picture} alt="" />{/if}</span
					>
				{:else}
					<span class="nt-mark"><Mark name={MARK[t.kind]} size={18} /></span>
				{/if}
				<span class="nt-text">{t.text}</span>
				{#if t.actions.length}
					<span class="nt-acts">
						{#each t.actions as a (a.label)}
							<button class="btn btn--sm nt-act" onclick={() => notices.act(t.id, a)}
								>{a.label}</button
							>
						{/each}
					</span>
				{/if}
				<button
					class="nt-x"
					aria-label="Dismiss"
					title="Dismiss"
					onclick={() => notices.dismiss(t.id)}
				>
					{#if t.ms !== null}
						<svg class="nt-ring" viewBox="0 0 28 28" aria-hidden="true">
							<circle class="nt-ring-track" cx="14" cy="14" r="12" />
							<circle
								class="nt-ring-arc"
								class:is-paused={t.paused}
								style:--ms="{t.ms}ms"
								style:--ring={RING}
								cx="14"
								cy="14"
								r="12"
							/>
						</svg>
					{/if}
					<Mark name="close" size={14} />
				</button>
			</div>
		</div>
	{/each}
</div>

{#if notices.asking}
	{@const q = notices.asking}
	<!-- `outroInert` is the outro-eats-your-click fix; ⛔ don't drop it. -->
	<div
		class="nd-scrim"
		transition:fade={{ duration: motion(T_QUICK), easing: linear }}
		onintrostart={introLive}
		onoutrostart={outroInert}
	>
		<div
			class="nd ctx-light"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="nd-title"
			aria-describedby={q.body ? 'nd-body' : undefined}
		>
			<h2 id="nd-title" class="nd-title">{q.title}</h2>
			{#if q.body}<p id="nd-body" class="nd-body">{q.body}</p>{/if}
			<div class="nd-acts">
				<button
					class="btn nd-confirm"
					class:nd-confirm--danger={q.danger}
					onclick={() => notices.answer(true)}>{q.confirm}</button
				>
				<button class="btn btn--primary" bind:this={safeEl} onclick={() => notices.answer(false)}
					>{q.cancel ?? 'Cancel'}</button
				>
			</div>
		</div>
	</div>
{/if}

<style>
	/* ── The toast home ── */
	.nr {
		position: fixed;
		left: 0;
		right: 0;
		bottom: max(1.5rem, var(--notice-floor, 0px));
		z-index: 150;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0 1rem;
		pointer-events: none;
		container-type: inline-size;
	}
	.nt-slot {
		display: flex;
		justify-content: center;
		max-width: 100%;
	}
	.nt {
		pointer-events: auto;
		position: relative;
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		grid-template-areas: 'mark text acts x';
		align-items: center;
		gap: 0.4rem 0.7rem;
		max-width: 34rem;
		min-height: 3rem;
		padding: 0.55rem 0.55rem 0.55rem 1.1rem;
		border-radius: var(--r-md);
		font-size: var(--fs-xl);
		line-height: var(--lh-snug);
		/* Paper inverts the ink ladder: --muted anchors. */
		background: var(--surface);
		color: var(--muted);
		box-shadow:
			0 10px 30px rgb(0 0 0 / 0.5),
			inset 4px 0 0 var(--nt-stripe);
	}
	.nt--success {
		--nt-stripe: var(--ui-positive);
	}
	.nt--info {
		--nt-stripe: var(--ui-info);
	}
	.nt--warning {
		--nt-stripe: var(--ui-warning);
	}
	.nt--error {
		--nt-stripe: var(--ui-danger);
	}
	.nt-mark,
	.nt-swatch {
		grid-area: mark;
	}
	/* The mark wears its stripe's colour. */
	.nt-mark {
		display: inline-flex;
		color: var(--nt-stripe);
	}
	.nt-swatch {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 2px solid var(--pp);
		background: color-mix(in srgb, var(--pp) 35%, var(--surface));
	}
	/* ⚓ With the profile's picture (Nate 2026-10-27): larger, the colour as a
	   2px ring outside it, as the top bar wears it. */
	.nt-swatch.has-picture {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border: none;
		box-shadow: 0 0 0 2px var(--pp);
		background: var(--surface);
		overflow: hidden;
	}
	.nt-swatch img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.nt-text {
		grid-area: text;
		min-width: 0;
	}
	.nt-acts {
		grid-area: acts;
		display: flex;
		gap: 0.4rem;
	}
	.nt-act {
		font-weight: var(--fw-semibold);
	}
	/* Narrow: the buttons take their own row under the words. */
	@container (max-width: 30rem) {
		.nt {
			grid-template-columns: auto 1fr auto;
			grid-template-areas: 'mark text x' '. acts acts';
		}
	}

	/* ── The ✕ and its ring. The hover is the ring's circle. ── */
	.nt-x {
		grid-area: x;
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
		color: inherit;
		cursor: pointer;
	}
	.nt-x::before {
		content: '';
		position: absolute;
		inset: 1px;
		border-radius: 50%;
		background: transparent;
		transition: background var(--t-snap);
	}
	.nt-x:hover::before,
	.nt-x:focus-visible::before {
		background: rgb(127 127 127 / 0.22);
	}
	.nt-x > :global(svg:not(.nt-ring)) {
		position: relative;
	}
	.nt-ring {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}
	.nt-ring circle {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
	}
	.nt-ring-track {
		stroke-opacity: 0.14;
	}
	.nt-ring-arc {
		stroke-opacity: 0.75;
		stroke-dasharray: var(--ring);
		animation: nt-drain var(--ms) linear forwards;
	}
	.nt-ring-arc.is-paused {
		animation-play-state: paused;
	}
	@keyframes nt-drain {
		to {
			stroke-dashoffset: var(--ring);
		}
	}

	/* ── The dialog ── */
	.nd-scrim {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgb(6 9 16 / 0.6);
	}
	.nd {
		width: min(28rem, 100%);
		padding: 1.5rem 1.5rem 1.25rem;
		border-radius: var(--r-md);
		background: var(--surface-broad);
		color: var(--text);
		box-shadow: 0 20px 60px rgb(0 0 0 / 0.55);
	}
	.nd-title {
		margin: 0 0 0.5rem;
		font-family: var(--font-display);
		font-size: var(--fs-3xl);
		color: var(--muted);
	}
	.nd-body {
		margin: 0 0 1.25rem;
		font-size: var(--fs-xl);
		line-height: var(--lh-normal);
		white-space: pre-line;
	}
	.nd-acts {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	.nd-confirm--danger {
		color: var(--ui-danger);
	}
</style>
