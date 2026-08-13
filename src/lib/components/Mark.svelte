<script module lang="ts">
	/**
	 * ⚓ NATE — the two knobs for the whole set.
	 *
	 * Both are in Lucide's 24-unit grid, so the ink that actually lands is
	 * `strokeWidth × size / 24`: at the defaults, 1.9 × 14 / 24 ≈ 1.11 device px.
	 * That is deliberately a hair under the 1.225 the hand-cut 16-grid set
	 * rendered, because Lucide's ink fills more of its box (20 of 24 units
	 * against the old set's 12 of 16), so the same nominal weight reads heavier.
	 *
	 * ⚠ Tune against CHROME, per the sub-pixel law: WebKit snaps strokes to whole
	 * pixels and its rendering of a given value moves with layout position, so
	 * tuning there chases a number that is not stable.
	 */
	export const MARK_SIZE = 14;
	export const MARK_STROKE = 1.9;
</script>

<script lang="ts">
	import { MARK_NODES, MARK_VIEWBOX, type MarkName } from '$lib/marks.generated';

	// ---------------------------------------------------------------------------
	// THE ONE MARK WRAPPER. Every control glyph on the site renders through here,
	// which is what makes the size / stroke / aria contract a single decision
	// instead of fifteen. The geometry itself is generated from Lucide — see
	// scripts/generate-marks.mjs for the map, the licence, and why the icon
	// library is a devDependency rather than a runtime one.
	//
	// Nodes are rendered as <svelte:element>, NOT injected as markup: the data is
	// a typed [tag, attrs] array, so there is no innerHTML anywhere in the path
	// and an upstream icon can never smuggle in an element we did not expect.
	//
	// Stroked in currentColor, so a mark inherits its control's ink — including
	// the disabled and active states — and scales with `size` alone.
	//
	// Marks are decorative WITHOUT EXCEPTION: every control that carries one also
	// carries a text label or an aria-label, so they are aria-hidden. If a mark
	// is ever the only thing in a control, the control needs the label, not this.
	// ---------------------------------------------------------------------------

	let {
		name,
		size = MARK_SIZE,
		strokeWidth = MARK_STROKE,
		filled = false
	}: {
		name: MarkName;
		/** Edge of the square box, in px. The stroke scales with it. */
		size?: number;
		/** Override for a mark that needs to hold its own beside heavier text. */
		strokeWidth?: number;
		/**
		 * Fill the geometry in currentColor as well as stroking it.
		 *
		 * ⚓ NATE 2026-08-13, on the Gauge's transport: "the outlined play/pause
		 * buttons don't read well — are there filled versions?" There are not.
		 * LUCIDE IS A STROKE-ONLY SET; it ships no filled variants of anything, so
		 * the choice is between filling the geometry we already have and taking on
		 * a second icon library for two glyphs. This is the cheap half of that.
		 *
		 * ⚠ IT IS NOT A GENERAL SWITCH, even though it is written as one. Filling
		 * only means anything for a CLOSED shape whose interior is the picture —
		 * play's triangle, pause's two bars, a solid star. On an open path (the
		 * chevron, the arrows) it fills the region the curve happens to enclose
		 * and produces a blob. Use it where the solid form IS the idiom, which for
		 * a transport control it is: every media player on earth draws these
		 * filled, and an outlined triangle reads as "insert" long before it reads
		 * as "play".
		 *
		 * The stroke stays on underneath. Lucide's joins are round, so stroking
		 * the same path grows the shape by half a stroke on every side with a
		 * softened corner — which is what keeps a 12px filled triangle from
		 * looking like a shard.
		 */
		filled?: boolean;
	} = $props();
</script>

<svg
	class="mark"
	width={size}
	height={size}
	viewBox="0 0 {MARK_VIEWBOX} {MARK_VIEWBOX}"
	fill={filled ? 'currentColor' : 'none'}
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{#each MARK_NODES[name] as [tag, attrs], i (i)}
		<svelte:element this={tag} {...attrs} />
	{/each}
</svg>

<style>
	/* Block, so the SVG contributes no baseline descender space inside a flex
	   control; flex-shrink guards it when a sibling label ellipsizes. */
	.mark {
		display: block;
		flex-shrink: 0;
	}
</style>
