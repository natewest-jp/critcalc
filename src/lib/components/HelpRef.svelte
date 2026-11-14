<!--
	A numbered marker in Help's prose, pointing at the same number on the
	screenshot beside it (HelpFigure.svelte, a shot without labels). Hidden
	from a screen reader, like the markers: the figure's alt text says what
	the image shows.
-->
<script lang="ts">
	let { n }: { n: number } = $props();
</script>

<span class="hf-ref" aria-hidden="true">{n}</span>

<style>
	/* The figure's marker, a little smaller, sitting on the text's x-height.
	   Its look follows HelpFigure's --hf-mark-* knobs, which it inherits. */
	.hf-ref {
		display: inline-grid;
		place-items: center;
		width: 1.15em;
		height: 1.15em;
		margin: 0 0.1em;
		border-radius: var(--r-round);
		background: var(--hf-mark-fill, var(--accent));
		color: var(--hf-mark-ink, var(--sel-ink));
		font-size: 0.85em;
		font-weight: var(--fw-semibold);
		line-height: 1;
		vertical-align: 0.05em;
		font-variant-numeric: tabular-nums;
	}
</style>
