/**
 * scrollFade — a soft roll-off at a scroller's live edges.
 *
 * ⚓ NATE 2026-08-11: "right now, if we switch to the roster, cards and filter
 * column get cut off sharp at their top and bottom edges." And the filter rail
 * has a second, sharper problem: it is a column of SEPARATE groups with scene
 * between them, so a group cut off at the viewport edge looks exactly like a
 * column that ended. A hard cut carries no information; a fade does.
 *
 * ⚓ NATE 2026-08-11, same day: the planner's timeline wants the same roll-off
 * at its LEFT and RIGHT edges, which is what the `axis` option below is for.
 * That consumer is the one that proves the mask decision below rather than just
 * benefiting from it — the timeline round took the planner's frame and chart
 * ground away entirely, so its scroller has no ground even in principle.
 *
 * ⚠ WHY THIS IS A MASK AND NOT A GRADIENT SCRIM. The usual trick — an overlay
 * fading from the container's ground to transparent — needs a ground to fade
 * FROM. Every consumer sits on the bare dimmed scene (the Team Builder's main
 * box has no frame, and its aside is `asideBare`, a gutter of self-painting
 * groups), so there is no colour a scrim could be. A scrim in ANY colour would
 * be a smear of that colour over the live world. The mask removes the content's
 * own alpha instead, which is the only version of this that works over a scene.
 * ⛔ So do not "simplify" this into a ::before gradient later — it will look
 * right only until someone looks at it over a bright part of the sky.
 *
 * WHAT IT DOES NOT DO, ON PURPOSE: a fade only appears at an edge that has
 * content beyond it, and it GROWS over the first `--scroll-fade` pixels of
 * travel rather than snapping on. A permanent top fade dims the first row for
 * no reason and reads as a rendering bug; a fade that pops the instant you
 * nudge the wheel reads as a flicker. A scroller with nothing to scroll gets no
 * edges at all — which is what makes this safe to attach unconditionally.
 *
 * ⚠ THE LENGTH LIVES IN CSS, NOT HERE. `--scroll-fade` on the element is the
 * per-consumer knob and `--scroll-fade-scale` on :root the site-wide one (see
 * .scroll-fade in app.css); CSS multiplies them into the registered
 * `--scroll-fade-length`, and this reads THAT, so the clamp and the gradient
 * can never disagree. Tune it per consumer — the roster's cards want more
 * roll-off than the rail's small groups. A consumer anchored to geometry (the
 * tool shell under the chrome) sets `--scroll-fade-length` directly.
 * It is re-read on every measure, not only on resize, so a knob changed in
 * devtools lands on the next scroll.
 *
 * ⚠ REAL-SAFARI WATCH ITEM. A mask makes the scroller a composited layer, and
 * these scrollers live inside .tool-page, which is WAAPI-transform-animated
 * during a tool nav — the exact shape the sub-pixel laws warn about (WebKit
 * rasterizes such a subtree at rounded device coordinates). The whole page is
 * moving during that window, so a pixel of edge jitter should be invisible; if
 * it is not, the fix is to drop the mask for the duration of the drift, not to
 * retune the gradient.
 */
import type { Action } from 'svelte/action';

/** Fallback when the element's `--scroll-fade-length` does not compute (an
 *  engine without @property; the class always declares it). */
const DEFAULT_LENGTH = 32;

/**
 * Sub-pixel scroll offsets and fractional layout mean `scrollHeight` and
 * `clientHeight` can differ by a hair on a scroller with nothing to scroll.
 * Below this, an edge is AT the end.
 */
const EPSILON = 1;

/**
 * Which axis rolls off. 'y' (the default) is the roster/rail case this was
 * built for; 'x' is the planner's timeline, whose content runs sideways.
 *
 * ⚠ THE AXIS MUST AGREE WITH THE CLASS. The action writes the custom
 * properties for its axis only, and each class reads only its own pair, so a
 * mismatch leaves both at 0 — an UNMASKED scroller, not a wrongly-masked one.
 * Inert-when-wrong is the failure mode this whole action is built for, but it
 * does mean a missing `.scroll-fade-x` shows up as "the fade never appears"
 * rather than as an error.
 */
export interface ScrollFadeOptions {
	axis?: 'x' | 'y';
	/** 'start' fades only the leading edge (top / left) — the tool shell's
	 *  roll-off under the site chrome, where the screen's foot stays hard. */
	edges?: 'both' | 'start';
}

export const scrollFade: Action<HTMLElement, ScrollFadeOptions | undefined> = (node, options) => {
	const horizontal = options?.axis === 'x';
	let length = DEFAULT_LENGTH;
	let frame = 0;

	function readLength(): void {
		const declared = parseFloat(getComputedStyle(node).getPropertyValue('--scroll-fade-length'));
		if (Number.isFinite(declared) && declared >= 0) length = declared;
	}

	function apply(start: number, end: number): void {
		node.style.setProperty(
			horizontal ? '--scroll-fade-left' : '--scroll-fade-top',
			`${start.toFixed(2)}px`
		);
		node.style.setProperty(
			horizontal ? '--scroll-fade-right' : '--scroll-fade-bottom',
			`${end.toFixed(2)}px`
		);
	}

	function measure(): void {
		frame = 0;
		readLength();
		const travel = horizontal
			? node.scrollWidth - node.clientWidth
			: node.scrollHeight - node.clientHeight;
		if (travel <= EPSILON) {
			apply(0, 0);
			return;
		}
		// Each edge's fade is its DISTANCE from that end, capped at the full
		// length — so it ramps in over the first (and last) `length` px of
		// travel and is exactly 0 when the edge is the end of the content.
		// scrollLeft can be NEGATIVE in a right-to-left scroller and fractional
		// everywhere; the clamp covers both.
		const offset = horizontal ? node.scrollLeft : node.scrollTop;
		const end = options?.edges === 'start' ? 0 : Math.max(0, Math.min(travel - offset, length));
		apply(Math.max(0, Math.min(offset, length)), end);
	}

	/** Scroll fires per frame; coalesce so a fling does one measure per paint. */
	function schedule(): void {
		if (!frame) frame = requestAnimationFrame(measure);
	}

	// The content's height changes with no scroll and no window resize — a facet
	// filter re-cuts the grid, the progressive reveal appends tiles in rAF
	// batches, a chip row rewraps. Observing the node alone would miss all of it
	// (a scroller's own content box excludes its overflow), so the CHILDREN are
	// observed too, and a childList watcher keeps that set current. childList
	// only, never subtree: the roster appends over a hundred tiles a few at a
	// time, and each one is a subtree mutation we would otherwise re-handle.
	const ro = new ResizeObserver(schedule);
	function observeChildren(): void {
		for (const child of node.children) ro.observe(child);
	}
	const mo = new MutationObserver(observeChildren);

	ro.observe(node);
	observeChildren();
	mo.observe(node, { childList: true });
	node.addEventListener('scroll', schedule, { passive: true });

	measure();

	return {
		destroy() {
			if (frame) cancelAnimationFrame(frame);
			node.removeEventListener('scroll', schedule);
			ro.disconnect();
			mo.disconnect();
		}
	};
};
