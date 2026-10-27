<!--
  THE RETURNING-VISITOR DIALOG (flip-readiness §1 item 4): said once, to a
  browser that used the site before the redesign. A clone of LinksDialog
  rather than `notices.ask`, because `ask`'s body is one plain string and this
  copy may want a list or a link to What's new; it is informational, so it has
  one answer, not ask's confirm/cancel pair. It must be answered to go (the
  backdrop does not dismiss), and while it is open it holds the migration
  toast and the links dialog (`flipNotice.svelte.ts`).

  Dev: `?flipNotice` on any page shows it without touching the stored flag.

  ⚠️ EVERY STRING BELOW IS A PLACEHOLDER: the copy is Nate's (§1 item 4; read
  docs/text/style-guide.md + glossary.md first). §3's first ruling (a
  returning visitor arriving on a shared link stays in Theorycraft) may land
  here too, as a paragraph.
-->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import { dismissFlipNotice } from '$lib/flipNotice.svelte';
	import { menu } from '$lib/menuState.svelte';

	function close(whatsNew = false): void {
		dismissFlipNotice();
		if (whatsNew) menu.show('about/changelog');
	}

	let okEl = $state<HTMLButtonElement | undefined>();
	$effect(() => okEl?.focus());

	function onKey(e: KeyboardEvent): void {
		if (e.key !== 'Escape') return;
		e.preventDefault();
		close();
	}
</script>

<svelte:window onkeydown={onKey} />

<!-- `outroInert` is the outro-eats-your-click fix; ⛔ don't drop it. -->
<div
	class="fn-backdrop"
	transition:fade={{ duration: motion(T_QUICK) }}
	onintrostart={introLive}
	onoutrostart={outroInert}
	role="presentation"
>
	<div class="fn-panel ctx-dark" role="alertdialog" aria-modal="true" aria-labelledby="fn-title">
		<!-- TODO(copy): the title. -->
		<h2 class="title" id="fn-title">TODO(copy): title</h2>
		<!-- TODO(copy): the body. A paragraph, a list (`<ul class="list">`, styled
		     below) or both; delete what goes unused. -->
		<p class="note">TODO(copy): what changed for a returning visitor.</p>
		<ul class="list">
			<li>TODO(copy): a change</li>
			<li>TODO(copy): another change</li>
		</ul>
		<div class="actions">
			<!-- TODO(copy): the What's new button's label (or drop the button). -->
			<button class="btn" onclick={() => close(true)}>TODO(copy): What’s new</button>
			<!-- TODO(copy): the answer. -->
			<button class="btn btn--primary" bind:this={okEl} onclick={() => close()}
				>TODO(copy): Got it</button
			>
		</div>
	</div>
</div>

<style>
	/* LinksDialog's geometry, on purpose: the two are siblings. */
	.fn-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(16, 16, 19, 0.72);
	}
	.fn-panel {
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
		line-height: 1.5;
	}
	.list {
		margin: 0 0 0.6rem;
		padding-left: 1.2rem;
		font-size: var(--fs-md);
		line-height: 1.5;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.4rem;
		margin-top: 1rem;
	}
</style>
