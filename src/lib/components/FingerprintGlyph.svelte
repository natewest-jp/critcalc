<script lang="ts" module>
	import type { FacetKey } from '$lib/capabilities/deriveCapabilities';

	/** ⏳ Two-letter stand-ins for the facets Nate has not drawn yet — retire
	 *  each line as its glyph lands in `fingerprintGlyphs.generated.ts`. */
	const STAND_IN: Partial<Record<FacetKey, string>> = {
		grouping: 'GR'
	};
</script>

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
	import { FINGERPRINT_GLYPHS } from '$lib/fingerprintGlyphs.generated';

	let { facet }: { facet: FacetKey } = $props();

	const art = $derived(FINGERPRINT_GLYPHS[facet]);
</script>

{#if art}
	<svg class="fg" viewBox="0 0 24 24" aria-hidden="true">
		{#each art.shade ?? [] as d, i (i)}<path class="fg-shade" {d} />{/each}
		{#each art.fill as d, i (i)}<path {d} />{/each}
	</svg>
{:else}
	<span class="fg fg-stand" aria-hidden="true"><span>{STAND_IN[facet] ?? '?'}</span></span>
{/if}

<style>
	.fg {
		display: block;
		width: 100%;
		height: 100%;
	}
	svg.fg {
		fill: currentColor;
		fill-rule: evenodd;
	}
	.fg-shade {
		fill-opacity: 0.5;
	}
	/* The stand-in: a ring with the facet's initials, scaled to the box (the
	   ring is a size container, so the letters inside can follow it). */
	.fg-stand {
		display: grid;
		place-items: center;
		box-sizing: border-box;
		border: 1px solid currentColor;
		border-radius: var(--r-round);
		container-type: size;
	}
	.fg-stand > span {
		font-family: var(--font-condensed);
		font-weight: var(--fw-bold);
		line-height: 1;
		font-size: 50cqh;
	}
</style>
