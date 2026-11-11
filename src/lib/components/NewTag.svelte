<!--
  THE NEW TAG (⚓ Nate 2026-11-11): the game's corner tag on a new item, here
  announcing a new endgame cycle. Its colors are the game's, measured off
  Nate's inventory screenshot: lemon text and border on an amber fill, in
  Bitter. ↻ The game's glow and its two corner sparkles came off the same
  day (Nate): the site's UI has neither, and on it they read out of place.
  The sparkle's geometry is in this file's history if they return.

  It sits in its host's top-right corner, just past the top and right edges
  (`--new-tag-overhang`): the host is `position: relative` and doesn't clip.
  It takes no clicks, so a click lands on the host, which clears the tag
  (`$lib/stores` `seenCycles`).

  🎛️ The knobs are in `app.css` beside the colors: `--new-tag-size` (the
  text, and the padding in em) and `--new-tag-overhang`.
-->
<span class="new-tag">New</span>

<style>
	.new-tag {
		position: absolute;
		z-index: 1;
		top: calc(-1 * var(--new-tag-overhang));
		right: calc(-1 * var(--new-tag-overhang));
		padding: 0.1em 0.42em 0.08em;
		border: 1px solid var(--new-ink);
		border-radius: var(--r-sm);
		background: var(--new-fill);
		color: var(--new-ink);
		font-family: var(--font-display);
		font-size: var(--new-tag-size);
		font-weight: var(--fw-bold);
		line-height: 1.15;
		letter-spacing: 0.01em;
		white-space: nowrap;
		pointer-events: none;
	}
</style>
