<!--
	A Help screenshot and the paragraphs it belongs to. The chapter wraps the
	paragraphs; the figure is anchored to the first of them.

	Where it stands (the reading layout's `help-reading` container,
	MenuState.svelte):
	- Wide (the margin is open, 56rem): it floats into the margin, level with
	  that paragraph.
	- Middle: a TALL shot (a phone screen) floats right inside the column and
	  its paragraphs wrap around it; a wide one falls in under them.
	- Narrow, or on the server-drawn chapter page (no container, so no query
	  matches): every shot falls in under its paragraphs.

	What it names: a numbered pin beside each point, its tip on the point,
	and the prose says what each number is with `HelpRef`. The pins are one
	design at every width: they scale with the image and nothing switches.

	The image and the points come from the generated manifest
	(`scripts/help-shots/`); the pins are drawn here, over it, so their look
	is the custom properties below, not pixels in the image. Each shot was
	taken in every language Help is drafted in, with its own pins, and the
	page shows its own language's, else English's.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { HELP_SHOTS, type HelpShot, type HelpShotId } from '$lib/help/shots/shots.generated';
	import { getLocale } from '$lib/i18n/locale';

	let {
		shot,
		alt,
		caption,
		children
	}: {
		shot: HelpShotId;
		/** What the image shows, for a reader who can't see it. */
		alt: string;
		caption?: string;
		children: Snippet;
	} = $props();

	const s = $derived<HelpShot>(HELP_SHOTS[shot].locales[getLocale()] ?? HELP_SHOTS[shot]);
	/** 🎛️ Narrower than this (width ÷ height), a shot counts as tall and
	 *  wraps its text at the middle widths. */
	const TALL_RATIO = 1.2;
	const tall = $derived(s.width / s.height < TALL_RATIO);
	/** A pin set off its point toward an edge needs room past that edge. */
	const near = (side: string, test: (c: { x: number; y: number }) => boolean) =>
		s.callouts.some((c) => c.side === side && test(c));
	const room = $derived({
		left: near('left', (c) => c.x < 0.15),
		right: near('right', (c) => c.x > 0.85),
		top: near('top', (c) => c.y < 0.3) || near('center', (c) => c.y < 0.3),
		bottom: near('bottom', (c) => c.y > 0.7)
	});
</script>

<div class="hf" class:hf--tall={tall}>
	<figure class="hf-fig" style:--hf-img-w="{s.width * s.scale}px">
		<div
			class="hf-frame"
			class:hf-room-left={room.left}
			class:hf-room-right={room.right}
			class:hf-room-top={room.top}
			class:hf-room-bottom={room.bottom}
		>
			<img src={s.src} {alt} width={s.width} height={s.height} loading="lazy" decoding="async" />
			{#each s.callouts as c (c.n)}
				<span
					class="hf-pin hf-pin--{c.side}"
					style:left="{c.x * 100}%"
					style:top="{c.y * 100}%"
					aria-hidden="true"><span class="hf-pin-n">{c.n}</span></span
				>
			{/each}
		</div>
		{#if caption}<figcaption>{caption}</figcaption>{/if}
	</figure>
	<div class="hf-text">{@render children()}</div>
</div>

<style>
	.hf {
		/* 🎛️ The pin: its head's size, its body, rim and number (roles in
		   app.css), the rim's weight, and the gap between its tip and the
		   point it names. HelpRef.svelte, the number in the prose, reads the
		   same knobs. */
		--hf-pin-size: 1.4rem;
		--hf-pin-fill: var(--marker-fill);
		--hf-pin-rim: var(--marker-rim);
		--hf-pin-ink: var(--marker-ink);
		--hf-pin-rim-w: 1.5px;
		--hf-pin-gap: 1px;
		/* 🎛️ The gap between a figure and the text beside or under it. */
		--hf-gap: 1rem;
		/* 🎛️ How much of the column a wrapped tall shot may take. */
		--hf-wrap-max: 45%;

		display: flex;
		flex-direction: column;
	}

	/* ── Where it stands ─────────────────────────────────────────────────── */

	/* Narrow: under the paragraphs, at its own size or the column's. */
	.hf-fig {
		order: 1;
		margin: 0 0 var(--hf-gap);
		width: min(var(--hf-img-w), 100%);
	}

	/* Middle: a tall shot floats right in the column; its text wraps it. */
	@container help-reading (min-width: 30rem) {
		.hf--tall {
			display: flow-root;
		}
		.hf--tall .hf-fig {
			float: right;
			width: min(var(--hf-img-w), var(--hf-wrap-max));
			margin: 0.3rem 0 var(--hf-gap) var(--hf-gap);
		}
	}

	/* Wide: the margin is open (the same 56rem as MenuState.svelte's). The
	   figure leaves the flow and floats right, the full margin wide, with the
	   image at its left edge. The text keeps its 68ch measure, so the float
	   never narrows a line. */
	@container help-reading (min-width: 56rem) {
		.hf,
		.hf--tall {
			display: block;
		}
		.hf-fig,
		.hf--tall .hf-fig {
			float: right;
			clear: right;
			width: var(--hf-margin, 28rem);
			margin: 0 0 var(--hf-gap) 0;
		}
	}

	/* ── The image ───────────────────────────────────────────────────────── */

	.hf-frame {
		position: relative;
		max-width: var(--hf-img-w);
	}

	.hf-frame img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: var(--r-sm);
		/* An outline, not an inset shadow: a shadow paints under the image. */
		outline: 1px solid var(--line-faint);
		outline-offset: -1px;
	}

	/* ── The pins ────────────────────────────────────────────────────────── */

	/* A pin is a round head with one sharp corner, turned so the corner
	   points at the control, and set off the point on the side the shot list
	   gives it, so it never covers what it names. The head is the
	   `::before`, which turns; the number stays upright on top of it.

	   A square's corner sits 0.707 of its side from its center, so the
	   head's center stands that far (plus the gap) from the point. */
	.hf-pin {
		--reach: calc(var(--hf-pin-size) * 0.7071 + var(--hf-pin-gap));
		/* Tip down, above the point: a map pin. */
		--turn: -45deg;
		--dx: 0px;
		--dy: calc(-1 * var(--reach));
		position: absolute;
		width: var(--hf-pin-size);
		height: var(--hf-pin-size);
		margin: calc(var(--hf-pin-size) / -2) 0 0 calc(var(--hf-pin-size) / -2);
		transform: translate(var(--dx), var(--dy));
		filter: drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.5));
	}
	.hf-pin::before {
		content: '';
		position: absolute;
		inset: 0;
		box-sizing: border-box;
		border: var(--hf-pin-rim-w) solid var(--hf-pin-rim);
		/* The bottom-left corner stays sharp: that is the tip. */
		border-radius: var(--r-round) var(--r-round) var(--r-round) 0;
		background: var(--hf-pin-fill);
		transform: rotate(var(--turn));
	}
	/* Left of the point, tip to the right. */
	.hf-pin--left {
		--turn: -135deg;
		--dx: calc(-1 * var(--reach));
		--dy: 0px;
	}
	/* Right of the point, tip to the left. */
	.hf-pin--right {
		--turn: 45deg;
		--dx: var(--reach);
		--dy: 0px;
	}
	/* Below the point, tip up. */
	.hf-pin--bottom {
		--turn: 135deg;
		--dx: 0px;
		--dy: var(--reach);
	}

	.hf-pin-n {
		position: relative;
		display: grid;
		place-items: center;
		height: 100%;
		color: var(--hf-pin-ink);
		font-family: var(--font-body);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	/* A pin past the image's edge: room for its head (its reach plus half
	   its size). */
	.hf-room-left {
		margin-left: calc(var(--hf-pin-size) * 1.25);
	}
	.hf-room-right {
		margin-right: calc(var(--hf-pin-size) * 1.25);
	}
	.hf-room-top {
		margin-top: calc(var(--hf-pin-size) * 1.25);
	}
	.hf-room-bottom {
		margin-bottom: calc(var(--hf-pin-size) * 1.25);
	}

	figcaption {
		margin-top: 0.5rem;
		font-size: var(--fs-md);
		color: var(--muted);
	}
</style>
