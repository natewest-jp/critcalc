<script lang="ts">
	import { MARK_PATHS, type MarkName } from '$lib/marks';

	// Inline geometry for the toolbar symbols — see $lib/marks.ts for the grid,
	// the paths, and the sub-pixel law that requires them to be geometry rather
	// than unicode characters.
	//
	// Stroked in currentColor, so a mark inherits its control's ink (including
	// the disabled and active states) and scales with `size` alone.
	//
	// Marks are decorative without exception: every control that carries one
	// also carries a text label or an aria-label, so they are aria-hidden.

	let {
		name,
		size = 14
	}: {
		name: MarkName;
		/** Edge of the square box, in px. The stroke scales with it. */
		size?: number;
	} = $props();
</script>

<svg
	class="mark"
	width={size}
	height={size}
	viewBox="0 0 16 16"
	fill="none"
	stroke="currentColor"
	stroke-width="1.4"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"><path d={MARK_PATHS[name]} /></svg
>

<style>
	/* Block, so the SVG contributes no baseline descender space inside a flex
	   control; flex-shrink guards it when a sibling label ellipsizes. */
	.mark {
		display: block;
		flex-shrink: 0;
	}
</style>
