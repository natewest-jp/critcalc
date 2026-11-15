<!--
	A numbered marker in Help's prose, pointing at the same number on the
	screenshot beside it (HelpFigure.svelte's pins). Hidden
	from a screen reader, like the markers: the figure's alt text says what
	the image shows.
-->
<script lang="ts">
	let { n }: { n: number } = $props();
</script>

<span class="hf-ref" aria-hidden="true">{n}</span>

<style>
	/* The figure's pin as a plain disc (no tip: it points at nothing here),
	   a little smaller, sitting on the text's x-height. Its look follows
	   HelpFigure's --hf-pin-* knobs, which it inherits. */
	.hf-ref {
		display: inline-grid;
		place-items: center;
		width: 1.3em;
		height: 1.3em;
		margin: 0 0.1em;
		border-radius: var(--r-round);
		box-sizing: border-box;
		border: var(--hf-pin-rim-w, 1.5px) solid var(--hf-pin-rim, var(--marker-rim));
		background: var(--hf-pin-fill, var(--marker-fill));
		color: var(--hf-pin-ink, var(--marker-ink));
		font-size: 0.8em;
		font-weight: var(--fw-semibold);
		line-height: 1;
		vertical-align: 0.05em;
		font-variant-numeric: tabular-nums;
	}
</style>
