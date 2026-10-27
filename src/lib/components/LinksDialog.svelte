<!--
  LINKS OPEN IN THEORYCRAFT, said once (design §9.3; to-do, Nate 2026-10-22):
  the first time a shared link moves someone out of a real profile. ⚓ Only
  then: a first visitor is already in Theorycraft, and a dialog before the
  content they came for is the wrong first impression. It must be answered to
  go (MoveDialog's shape: the backdrop does not dismiss); afterwards the
  arrival's ordinary notice carries the rule. Strings approved by Nate
  2026-10-23.
-->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import { linksIntro, moveRequest, MOVE_TO_PROFILE } from '$lib/moveRequest.svelte';
	import { siteSettings } from '$lib/stores';

	function close(move: boolean): void {
		siteSettings.markSeen('seenLinksNotice');
		const id = linksIntro.moveId;
		linksIntro.open = false;
		linksIntro.moveId = null;
		if (move && id) moveRequest.id = id;
	}

	let okEl = $state<HTMLButtonElement | undefined>();
	$effect(() => okEl?.focus());

	function onKey(e: KeyboardEvent): void {
		if (e.key !== 'Escape') return;
		e.preventDefault();
		close(false);
	}
</script>

<svelte:window onkeydown={onKey} />

<!-- `outroInert` is the outro-eats-your-click fix; ⛔ don't drop it. -->
<div
	class="ld-backdrop"
	transition:fade={{ duration: motion(T_QUICK) }}
	onintrostart={introLive}
	onoutrostart={outroInert}
	role="presentation"
>
	<div class="ld-panel ctx-dark" role="alertdialog" aria-modal="true" aria-labelledby="ld-title">
		<h2 class="title" id="ld-title">Opened in Theorycraft</h2>
		<p class="note">
			Shared links open in Theorycraft, the place to explore things outside your profiles. Opening
			linked content never changes your profiles or your roster.
		</p>
		{#if linksIntro.moveId}
			<p class="note note--quiet">To keep it in one of your profiles, move it there.</p>
		{/if}
		<div class="actions">
			{#if linksIntro.moveId}
				<button class="btn" onclick={() => close(true)}>{MOVE_TO_PROFILE}</button>
			{/if}
			<button class="btn btn--primary" bind:this={okEl} onclick={() => close(false)}>Got it</button>
		</div>
	</div>
</div>

<style>
	.ld-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(16, 16, 19, 0.72);
	}
	.ld-panel {
		width: min(26rem, 100%);
		padding: 1.2rem 1.3rem 1.1rem;
		border-radius: var(--r-md);
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
	}
	.title {
		margin: 0 0 0.9rem;
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
	}
	.note {
		margin: 0 0 0.6rem;
		font-size: var(--fs-md);
		line-height: var(--lh-normal);
	}
	.note--quiet {
		color: var(--muted);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.4rem;
		margin-top: 1rem;
	}
</style>
