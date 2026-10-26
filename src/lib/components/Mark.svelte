<script module lang="ts">
	/**
	 * ⚓ NATE — the two knobs for the whole set.
	 *
	 * ↻ 2026-10-11: THE STROKE IS HELD, NOT SCALED. It used to live in Lucide's
	 * 24-unit grid (1.9 units, so the ink was `1.9 × size / 24`: 0.79px at 10,
	 * 1.11 at 14, 1.42 at 18). Small marks drew thin and large ones stubby.
	 * Every shape now carries `vector-effect: non-scaling-stroke`, so
	 * MARK_STROKE is CSS px and EVERY mark draws the same line at every size —
	 * including where CSS, not `size`, sizes the box (SlotPortrait,
	 * CharacterCard), which a stroke derived from `size` would have missed.
	 * ⚓ Nate picked 1.15 on the /lab/marks specimen (2026-10-11, removed once
	 * shipped — in history at `e9d3198d`), at 2× and at 1×.
	 *
	 * ⚠ WHAT THE WIDTH CANNOT DO: make a straight edge crisp. A horizontal or
	 * vertical line is crisp only when it lands on the pixel grid, and where
	 * it lands is set by the mark's SIZE and its sub-pixel POSITION, not by
	 * this number (the filter's top edge went pale at 1.10 and filled in at
	 * 1.15 — that was the line's phase, not its weight). Diagonals average out
	 * and look the same at any width.
	 *
	 * 📐 AT 1× DPR, 12px IS THE CRISP SIZE. Lucide draws on integer coordinates
	 * of a 24 grid; at 12px a unit is exactly half a pixel, so its lines land
	 * on pixel centres and fill one row cleanly. At 14px (and most others) the
	 * same lines straddle two rows and read as a pale double line — at every
	 * weight from 1.00 to 1.25 (measured 2026-10-11). Our sizes are tuned for
	 * how they sit beside text, not for this; but if 1× crispness ever becomes
	 * the goal, SIZE is the lever, and ⛔ a thinner or "whole-pixel" stroke is
	 * not (1.00 is the most exposed width: crispest when it lands, palest —
	 * two rows at ~50% — when it splits).
	 *
	 * ⚠ Tune against CHROME, per the sub-pixel law: WebKit snaps strokes to whole
	 * pixels and its rendering of a given value moves with layout position, so
	 * tuning there chases a number that is not stable.
	 */
	export const MARK_SIZE = 14;
	/** The line, in CSS px, at every size (held — see above). */
	export const MARK_STROKE = 1.15;
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
	// the disabled and active states. `size` scales the picture; the line holds.
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
		/** Edge of the square box, in px. The stroke does NOT scale with it. */
		size?: number;
		/** Override for a mark that needs to hold its own beside heavier text,
		 *  in CSS px like MARK_STROKE. */
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
		 *
		 * `'solid'` (roster surface round, ⚓ Nate 2026-10-26) is the other
		 * answer, for a STAR whose points are the picture: the areas fill with
		 * NO stroke, and an open line part keeps its stroke (Sparkles' little
		 * plus). The stroke's round joins blunted every tip by ~0.6px, and on a
		 * 12px wish mark the points went stubby. ⚠ Lucide's geometry still
		 * rounds each tip by one grid unit (0.5px at 12px), so a point gets
		 * SHARPER, not sharp; the solid shape also sits half a stroke inside
		 * its outline.
		 */
		filled?: boolean | 'solid';
	} = $props();

	/** Under `'solid'`, per part: a shape with POINTS fills with no stroke; a
	 *  circle (no points to sharpen) fills and KEEPS its stroke, or Sparkles'
	 *  dot shrinks to a speck; a line (a path of straight open segments,
	 *  M/L/H/V only) keeps its stroke and no fill. */
	function solidPart(tag: string, attrs: Record<string, string>): Record<string, string> {
		if (tag === 'circle' || tag === 'ellipse') return { fill: 'currentColor' };
		const area =
			tag === 'path' ? /[aAcCqQsStTzZ]/.test(attrs.d ?? '') : tag !== 'line' && tag !== 'polyline';
		return area ? { fill: 'currentColor', stroke: 'none' } : { fill: 'none' };
	}
</script>

<svg
	class="mark"
	width={size}
	height={size}
	viewBox="0 0 {MARK_VIEWBOX} {MARK_VIEWBOX}"
	fill={filled === true ? 'currentColor' : 'none'}
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{#each MARK_NODES[name] as [tag, attrs], i (i)}
		<svelte:element this={tag} {...attrs} {...filled === 'solid' ? solidPart(tag, attrs) : {}} />
	{/each}
</svg>

<style>
	/* Block, so the SVG contributes no baseline descender space inside a flex
	   control; flex-shrink guards it when a sibling label ellipsizes. */
	.mark {
		display: block;
		flex-shrink: 0;
	}
	/* The HELD stroke (see MARK_STROKE). vector-effect is NOT inherited, so it
	   must reach every shape, not the <svg>. */
	.mark :global(*) {
		vector-effect: non-scaling-stroke;
	}
</style>
