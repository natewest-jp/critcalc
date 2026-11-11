<script module lang="ts">
	/** A four-point sparkle, its sides drawn in to the center as the game's. */
	const SPARK =
		'M12 0C12.9 7.6 16.4 11.1 24 12C16.4 12.9 12.9 16.4 12 24C11.1 16.4 7.6 12.9 0 12C7.6 11.1 11.1 7.6 12 0Z';
</script>

<!--
  THE NEW TAG (⚓ Nate 2026-11-11): the game's corner tag on a new item, here
  announcing a new endgame cycle. Drawn after Nate's inventory screenshot: lemon
  text and border on an amber fill, a soft lemon glow, and a four-point
  sparkle on the top-right and bottom-left corners. Bitter, as the game's
  tag is a heavy display face.

  It sits on its host's top-right corner, overhanging it as the game's does:
  the host is `position: relative` and doesn't clip. It takes no clicks, so a
  click lands on the host, which clears the tag (`$lib/stores` `seenCycles`).

  🎛️ The knobs are in `app.css` beside the colors: `--new-tag-size` (the
  text, and everything else in em), `--new-tag-lift` (how far it rises above
  the host's top edge) and `--new-tag-inset` (how far in from its right edge).
-->
<span class="new-tag">
	New
	<svg class="new-spark new-spark--tr" viewBox="0 0 24 24" aria-hidden="true">
		<path d={SPARK} />
	</svg>
	<svg class="new-spark new-spark--bl" viewBox="0 0 24 24" aria-hidden="true">
		<path d={SPARK} />
	</svg>
</span>

<style>
	.new-tag {
		position: absolute;
		z-index: 1;
		top: calc(-1 * var(--new-tag-lift));
		right: var(--new-tag-inset);
		padding: 0.12em 0.42em 0.1em;
		border: 1px solid var(--new-ink);
		border-radius: 0.28em;
		background: var(--new-fill);
		box-shadow: 0 0 0.45em color-mix(in srgb, var(--new-ink) 45%, transparent);
		color: var(--new-ink);
		font-family: var(--font-display);
		font-size: var(--new-tag-size);
		font-weight: var(--fw-bold);
		line-height: 1.15;
		letter-spacing: 0.01em;
		text-shadow: 0 0 0.35em color-mix(in srgb, var(--new-ink) 55%, transparent);
		white-space: nowrap;
		pointer-events: none;
	}
	.new-spark {
		position: absolute;
		fill: var(--new-ink);
		filter: drop-shadow(0 0 0.15em var(--new-ink));
	}
	/* The larger on the top-right corner, centered on it; the smaller on the
	   bottom-left, as the game draws them. */
	.new-spark--tr {
		top: -0.42em;
		right: -0.42em;
		width: 0.85em;
		height: 0.85em;
	}
	.new-spark--bl {
		bottom: -0.32em;
		left: -0.32em;
		width: 0.62em;
		height: 0.62em;
	}
</style>
