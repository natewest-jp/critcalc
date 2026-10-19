<script lang="ts">
	/**
	 * ONE FINGERPRINT GLYPH — the single place a capability's icon is drawn, so
	 * the card's column, the board's fingerprint and the roster's "Can provide"
	 * filter are one icon set (lineups design §11.6 item 18) and Nate's art
	 * lands in all three at once.
	 *
	 * It fills its box and paints in `currentColor`: the consumer decides size
	 * and state (lit / faint / previewed) by setting `color` on it — PAINT,
	 * ⛔ never element opacity (the sub-pixel law). A two-tone glyph's shade
	 * half rides at half whatever colour it wears.
	 */
	import type { FacetKey } from '$lib/capabilities/deriveCapabilities';
	import { FINGERPRINT_GLYPHS } from '$lib/fingerprintGlyphs.generated';

	let { facet }: { facet: FacetKey } = $props();

	const art = $derived(FINGERPRINT_GLYPHS[facet]);
</script>

{#if art}
	<svg class="fg" viewBox={art.box} aria-hidden="true">
		{#each art.shade ?? [] as d, i (i)}<path class="fg-shade" {d} />{/each}
		{#each art.fill as d, i (i)}<path {d} />{/each}
	</svg>
{/if}

<style>
	.fg {
		display: block;
		width: 100%;
		height: 100%;
	}
	/* overflow visible: a glyph NUDGEd past its box (Grouping at 120%) spills
	   into the gap rather than losing its tips to the svg's default clip. */
	/* ⚓ The pointer passes THROUGH the glyph (2026-10-19). Every consumer puts
	   the tooltip (`title`) and any click on the glyph's PARENT; with the svg
	   hit-testable, a hover over it asked the svg for a tooltip, and the title
	   showed only over the parent's bare edges — finicky on the fingerprint,
	   nearly never on a card's 11px glyph, while :hover still lit the slot. */
	svg.fg {
		pointer-events: none;
		overflow: visible;
		fill: currentColor;
		fill-rule: evenodd;
	}
	.fg-shade {
		fill-opacity: 0.5;
	}
</style>
