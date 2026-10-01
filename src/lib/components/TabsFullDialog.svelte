<script lang="ts">
	/**
	 * A shared link arrived with all six tabs occupied, so the rotation went to
	 * the bank instead of over someone's work. This says so, and has to be
	 * acknowledged.
	 *
	 * ⚓ NATE 2026-08-17 — why this outcome, alone, gets a modal: every other
	 * document outcome is confirmable by LOOKING (a save leaves a linked tab, a
	 * team load leaves a team), so band A's 2.2s line is enough. This one leaves
	 * the planner looking exactly as it did. A reader who misses the line
	 * concludes the link is broken, clicks it again, and banks another copy —
	 * the failure compounds precisely because the report was quiet.
	 *
	 * ⚠️ NOT a breach of the non-modal-tools principle: that reserves modals for
	 * meta surfaces and asks whether a surface reasons against its surroundings
	 * (→ non-modal) or is a focused read (→ modal fine). This is neither — a
	 * one-shot report of something that already happened, which the principle's
	 * own text allows. ⛔ Not licence for tool features.
	 */
	import { fade } from 'svelte/transition';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import Mark from './Mark.svelte';

	let { name, onOpenBank, onClose }: { name: string; onOpenBank: () => void; onClose: () => void } =
		$props();

	let confirmEl = $state<HTMLButtonElement | undefined>();
	// Focus the acknowledgement so Enter dismisses and a screen reader lands on
	// the way out rather than on the prose.
	$effect(() => confirmEl?.focus());

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- ⛔ THE BACKDROP DOES NOT DISMISS, and that is the one place this diverges
     from the site's other modals (DetailCard, ChromeOverlay — Esc / backdrop /
     ✕ all three). Those are surfaces you are BROWSING and can leave any way you
     like; this is a message that has to be taken, and a stray click on the way
     to the timeline underneath is exactly how it would be missed by the reader
     it exists for. Esc and the two buttons dismiss.
     ⚠️ `alertdialog`, not `dialog`: the role for a message requiring
     acknowledgement.
     Fades on --t-quick — the SURFACE band, because size sets the clock and this
     is a scrim over the whole viewport (motion round). `outroInert` is the
     outro-eats-your-click fix; ⛔ don't drop it. -->
<div
	class="tf-backdrop"
	transition:fade={{ duration: motion(T_QUICK) }}
	onintrostart={introLive}
	onoutrostart={outroInert}
	role="presentation"
>
	<div class="tf-panel ctx-dark" role="alertdialog" aria-modal="true" aria-labelledby="tf-title">
		<h2 class="title" id="tf-title">All your tabs are in use</h2>
		<p class="tf-body">
			Nothing you had open was replaced. The shared rotation is in
			<strong>Saved rotations</strong>, as <strong>{name}</strong> — close a tab and load it there whenever
			you want it.
		</p>
		<div class="tf-actions">
			<button class="btn btn--sm" type="button" bind:this={confirmEl} onclick={onClose}>
				Got it
			</button>
			<button class="btn btn--sm btn--primary" type="button" onclick={onOpenBank}>
				<Mark name="load" />
				Open saved rotations
			</button>
		</div>
	</div>
</div>

<style>
	.tf-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: flex;
		align-items: center;
		justify-content: center;
		/* Alpha in the PAINT — this subtree is transform-placed by the panel's
		   centring, and an opacity subtree rasterizes at rounded coordinates in
		   WebKit (the sub-pixel laws). */
		background: rgba(16, 16, 19, 0.72);
	}
	.tf-panel {
		width: min(30rem, calc(100vw - 2rem));
		background: var(--surface);
		border-radius: 6px;
		padding: 18px 20px 16px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	/* The heading uses the shared `.title` (Bitter, --fs-3xl) — the same header
	   the Saved Rotations overlay wears, because this is the same register of
	   surface and the heading rule says headers are the display face. */
	.tf-body {
		margin: 0;
		font-size: var(--fs-xl);
		line-height: var(--lh-normal);
		color: var(--muted);
	}
	.tf-body strong {
		color: var(--text);
		font-weight: var(--fw-semibold);
	}
	.tf-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 4px;
	}
</style>
