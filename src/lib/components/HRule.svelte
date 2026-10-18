<script lang="ts">
	// Ornamental horizontal rule — Nate's artwork, in two designs.
	//
	//   <HRule />                     cap ——————————————— cap
	//   <HRule variant="center" />    ————————— ✳ —————————
	//
	// Sources live in assets-src/transitions/ (gitignored masters):
	// hr-endcap-left.svg, hr-endcap-right.svg, hr-center.svg. All three are
	// 17-unit-tall Affinity exports sharing one centerline, normalized here so
	// that ONE SVG USER UNIT IS ONE CSS PIXEL at render size:
	//
	//   scale 0.5 · centerline → y=5 of a 10px box · artwork → y 0.8–9.2
	//
	// That is what lands the 2px line dead on the pixel grid, and it is why the
	// caps and the center mark can never drift out of alignment — all three were
	// mapped through the same transform, and all three measure 10px tall.
	//
	// ⚠️ Only ONE endcap asset is used. The caps are POINT-symmetric, not
	// mirror-symmetric, so the far end is rotated 180°; scaleX(-1) points the
	// chevron the wrong way. hr-endcap-right.svg is therefore redundant and
	// stays a source-only reference.
	//
	// ⚠️ Overlaps, not butts. Every join overlaps by a pixel or two so a
	// sub-pixel seam can never show — see the CSS for why each amount is what it
	// is. This only works because the parts are OPAQUE and the whole rule is
	// faded as a group (--rule-opacity); translucent parts would stack at every
	// overlap and show a brighter notch.
	//
	// Styling, from any ancestor:
	//   --rule-tint      color of caps + line + mark (default: currentColor)
	//   --rule-opacity   group fade (default: 1)
	//   --rule-size      the rule's HEIGHT, and with it everything (default:
	//                    10px — the artwork's own scale). The line is a fifth
	//                    of it and the caps/mark keep their proportions, so the
	//                    rule scales as one drawing. ⚓ Nate 2026-10-18: 5px on
	//                    the landing cards and the footer. ⚠️ Keep it a whole
	//                    multiple of 5px: at 5px the 1px line lands on whole
	//                    rows (y 2–3), crisp even at 1×.
	// Width comes from the parent; the line takes up the slack.

	let { variant = 'capped' }: { variant?: 'capped' | 'center' } = $props();

	// Normalized artwork. Kept as constants so each shape is written once even
	// though a rule renders two of them (identical strings gzip to nothing).
	const CAP =
		'M18.6 6H18l-4.2-2.8-1.34.9-1.8-1.2L13.8.8 18.6 4zm-1.65 1.1-3.14 2.1-8.25-5.5L3.6 5l1.95 1.3.6-.4 1.8 1.2-2.4 1.6L0 5l5.56-3.7 8.25 5.5 1.34-.9z';
	const MARK =
		'm7.7 5-1.2-.8-.75-.5L3.8 5l1.95 1.3.6-.4 1.8 1.2-2.4 1.6L.19 5l5.56-3.7 6.69 4.46L14 6.8l1.34-.9 1.8 1.2L14 9.2zm14.55 3.7-6.69-4.46L14 3.2l-1.34.9-1.8-1.2L14 .8 20.3 5l1.2.8.75.5L24.2 5l-1.95-1.3-.6.4-1.8-1.2 2.4-1.6L27.81 5z';
</script>

<div class="hrule" class:is-capped={variant === 'capped'} aria-hidden="true">
	{#if variant === 'center'}
		<span class="hrule-line"></span>
		<svg class="hrule-mark" viewBox="0 0 28 10"><path d={MARK} /></svg>
		<span class="hrule-line"></span>
	{:else}
		<svg class="hrule-cap" viewBox="0 0 19 10">
			<path d={CAP} />
			<!-- The connecting strand. The artwork tapers to a knife edge and only
			     spans the full 2px band at its very tip, so there is nothing square
			     for the line to meet. This carries the band out to the box edge —
			     axis-aligned and crispEdges, so it never antialiases. -->
			<rect x="18" y="4" width="1" height="2" shape-rendering="crispEdges" />
		</svg>
		<span class="hrule-line"></span>
		<svg class="hrule-cap is-far" viewBox="0 0 19 10">
			<path d={CAP} />
			<rect x="18" y="4" width="1" height="2" shape-rendering="crispEdges" />
		</svg>
	{/if}
</div>

<style>
	/* One flex row sharing a single centerline: the shapes are 10px boxes with
	   their strand at y 4–6, the line is 2px, and align-items center puts the
	   line exactly there. Nothing needs nudging. */
	.hrule {
		display: flex;
		align-items: center;
		color: var(--rule-tint, currentColor);
		opacity: var(--rule-opacity, 1);
		pointer-events: none;
	}

	.hrule-cap,
	.hrule-mark {
		flex: none;
		height: var(--rule-size, 10px);
		fill: currentColor;
	}

	.hrule-cap {
		width: calc(var(--rule-size, 10px) * 1.9);
	}

	/* Point-symmetric artwork — rotate, never flip. */
	.hrule-cap.is-far {
		transform: rotate(180deg);
	}

	.hrule-mark {
		width: calc(var(--rule-size, 10px) * 2.8);
		/* The mark comes to a POINT at each side rather than a flat edge, so the
		   lines run INTO it: the wedge is thinner than 2px for the first ~1.5px
		   past each tip, and a line that merely butted up would leave a visible
		   pinch there. Pulling the neighbors 2px in covers that stretch with the
		   line's own 2px, and the wedge takes over once it is thicker. */
		margin-inline: calc(var(--rule-size, 10px) * -0.2);
	}

	.hrule-line {
		flex: 1;
		height: calc(var(--rule-size, 10px) / 5);
		background: currentColor;
	}

	/* Caps get 1px, not 2: their join IS a flat 2px edge, so this only has to
	   defeat sub-pixel rounding, and it lands on the solid strand rect. */
	.hrule.is-capped .hrule-line {
		margin-inline: calc(var(--rule-size, 10px) * -0.1);
	}
</style>
