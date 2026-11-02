<script lang="ts">
	import type { Snippet } from 'svelte';
	import BandMenu from '$lib/components/BandMenu.svelte';

	/**
	 * A SET-ONCE SETTING, FOLDED (the Visualizers overhaul, round 3; design §3):
	 * its label, and a summary of its value that opens the setting in a popover.
	 * The shape Wish odds' Goal and Radiance counter introduced (2026-11-02, ⚓
	 * Nate), so every instrument folds the same way. Use it for what a player
	 * sets once and then reads (a level, a goal, a model choice); a control
	 * you scrub stays a slider in the open.
	 *
	 * The summary is the value, so it speaks at the label's size; the popover
	 * holds the full control (`children`), and stays open while you use it.
	 */
	let {
		label,
		summary,
		ariaLabel,
		children
	}: {
		/** The visible label, sentence case, as a slider's. */
		label: string;
		/** The value as it reads at rest ("Not owned → C2", "90"). */
		summary: Snippet;
		/** The trigger's accessible name: the label and the value in words. */
		ariaLabel: string;
		/** The setting itself, in the popover; `close` puts the popover away
		 *  (Wish odds closes it once an import has been read). */
		children: Snippet<[close: () => void]>;
	} = $props();
</script>

<div class="sl-row">
	<span class="slider-label">{label}</span>
	<BandMenu role="dialog" size="sm" align="end" {ariaLabel}>
		{#snippet face()}
			<span class="sl-face">{@render summary()}</span>
		{/snippet}
		{#snippet items(close)}
			<div class="sl-pop">{@render children(close)}</div>
		{/snippet}
	</BandMenu>
</div>

<style>
	.sl-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		min-width: 0;
	}

	/* At the label's size: at the small trigger's own 11px the value sat under
	   its label. Condensed, so a long summary ("Not owned → C5") holds a line. */
	.sl-face {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-family: var(--font-condensed);
		font-size: var(--fs-lg);
	}

	/* The popover's contents (BandMenu, portalled: the band menu's own surface).
	   🎛️ 22rem: about the rail's own width, so a slider inside keeps the track
	   it had in the open (a level's 90/95/100 stops need the length). */
	.sl-pop {
		display: grid;
		gap: var(--inst-gap-control);
		width: min(22rem, calc(100vw - 2rem));
		padding: 0.6rem;
	}
</style>
