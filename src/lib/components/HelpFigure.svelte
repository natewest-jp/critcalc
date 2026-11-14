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

	What it names: with `labels`, a label beside the image for each callout,
	with a line to its point, on the side the shot list gives it. Where the
	figure is too narrow for that (its own container, `hf`), the labels give
	way to numbered markers just off each point and a key under the image.
	Without `labels`, the markers alone, which the prose refers to with
	`HelpRef`.

	The image and the points come from the generated manifest
	(`scripts/help-shots/`); everything drawn over it is here, so its look is
	the custom properties below, not pixels in the image.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { HELP_SHOTS, type HelpShotId } from '$lib/help/shots/shots.generated';

	let {
		shot,
		alt,
		caption,
		labels,
		children
	}: {
		shot: HelpShotId;
		/** What the image shows, for a reader who can't see it. */
		alt: string;
		caption?: string;
		/** One label per callout, in the callouts' order. */
		labels?: string[];
		children: Snippet;
	} = $props();

	const s = $derived(HELP_SHOTS[shot]);
	/** 🎛️ Narrower than it is tall-ish: wraps its text at the middle widths. */
	const TALL_RATIO = 1.2;
	const tall = $derived(s.width / s.height < TALL_RATIO);
	/** A marker set off its point toward an edge needs room past that edge. */
	const near = (side: string, test: (c: { x: number; y: number }) => boolean) =>
		s.callouts.some((c) => c.side === side && test(c));
	const room = $derived({
		left: near('left', (c) => c.x < 0.1),
		right: near('right', (c) => c.x > 0.9),
		top: near('top', (c) => c.y < 0.15),
		bottom: near('bottom', (c) => c.y > 0.85)
	});
</script>

<div class="hf" class:hf--tall={tall}>
	<figure class="hf-fig" class:hf-fig--labeled={!!labels} style:--hf-img-w="{s.width * s.scale}px">
		<div class="hf-plate">
			{#if labels}
				{#each s.callouts as c, i (c.n)}
					<span class="hf-label hf-label--{c.side}" style:--x={c.x} style:--y={c.y}
						>{labels[i]}</span
					>
				{/each}
			{/if}
			<div
				class="hf-frame"
				class:hf-room-left={room.left}
				class:hf-room-right={room.right}
				class:hf-room-top={room.top}
				class:hf-room-bottom={room.bottom}
			>
				<img src={s.src} {alt} width={s.width} height={s.height} loading="lazy" decoding="async" />
				{#each s.callouts as c (c.n)}
					{#if labels}
						<span
							class="hf-lead hf-lead--{c.side}"
							style:--x={c.x}
							style:--y={c.y}
							aria-hidden="true"
						></span>
					{/if}
					<span
						class="hf-mark hf-mark--{c.side}"
						style:left="{c.x * 100}%"
						style:top="{c.y * 100}%"
						aria-hidden="true">{c.n}</span
					>
				{/each}
			</div>
		</div>
		{#if caption || labels}
			<figcaption>
				{#if caption}<span class="hf-caption">{caption}</span>{/if}
				{#if labels}
					<ol class="hf-key">
						{#each labels as label, i (i)}
							<li><span class="hf-mark hf-mark--key" aria-hidden="true">{i + 1}</span>{label}</li>
						{/each}
					</ol>
				{/if}
			</figcaption>
		{/if}
	</figure>
	<div class="hf-text">{@render children()}</div>
</div>

<style>
	.hf {
		/* 🎛️ The numbered marker: size, fill, ink, the ring that parts it from
		   the screenshot under it, and how far it stands off its point. */
		--hf-mark-size: 1.25rem;
		--hf-mark-fill: var(--accent);
		--hf-mark-ink: var(--sel-ink);
		--hf-mark-ring: var(--bg);
		--hf-mark-off: 3px;
		/* 🎛️ The labels: their type, the widest a side label runs before it
		   wraps, its distance from the image, the line's weight and color,
		   the gap between a label and its line, and the dot at the line's end. */
		--hf-label-size: var(--fs-lg);
		--hf-label-ink: var(--text);
		--hf-label-w: 8rem;
		--hf-label-gap: 1.25rem;
		--hf-lead-w: 1px;
		--hf-lead-color: var(--accent);
		--hf-lead-inset: 0.3rem;
		--hf-dot: 5px;
		/* 🎛️ The gap between a figure and the text beside or under it. */
		--hf-gap: 1rem;
		/* 🎛️ How much of the column a wrapped tall shot may take. */
		--hf-wrap-max: 45%;

		display: flex;
		flex-direction: column;
	}

	/* ── Where it stands ─────────────────────────────────────────────────── */

	/* Narrow: under the paragraphs, at its own size or the column's. A
	   labelled figure takes the column, so its own query below can tell
	   whether the labels fit. */
	.hf-fig {
		container: hf / inline-size;
		order: 1;
		margin: 0 0 var(--hf-gap);
		width: min(var(--hf-img-w), 100%);
	}
	.hf-fig--labeled {
		width: 100%;
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

	/* ── Numbered markers (no labels, or no room for them) ───────────────── */

	.hf-mark {
		display: inline-grid;
		place-items: center;
		width: var(--hf-mark-size);
		height: var(--hf-mark-size);
		border-radius: var(--r-round);
		background: var(--hf-mark-fill);
		color: var(--hf-mark-ink);
		font-family: var(--font-body);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.hf-frame .hf-mark {
		position: absolute;
		box-shadow: 0 0 0 2px var(--hf-mark-ring);
		transform: translate(-50%, -50%);
	}
	/* Off the point, toward the label's side, so it never covers the
	   control it names. */
	.hf-frame .hf-mark--left {
		transform: translate(calc(-100% - var(--hf-mark-off)), -50%);
	}
	.hf-frame .hf-mark--right {
		transform: translate(var(--hf-mark-off), -50%);
	}
	.hf-frame .hf-mark--top {
		transform: translate(-50%, calc(-100% - var(--hf-mark-off)));
	}
	.hf-frame .hf-mark--bottom {
		transform: translate(-50%, var(--hf-mark-off));
	}
	.hf-room-left {
		margin-left: var(--hf-mark-size);
	}
	.hf-room-right {
		margin-right: var(--hf-mark-size);
	}
	.hf-room-top {
		margin-top: var(--hf-mark-size);
	}
	.hf-room-bottom {
		margin-bottom: var(--hf-mark-size);
	}

	figcaption {
		margin-top: 0.5rem;
		font-size: var(--fs-md);
		color: var(--muted);
	}

	.hf-key {
		display: grid;
		gap: 0.3rem;
		margin: 0.4rem 0 0;
		padding: 0;
		list-style: none;
	}

	.hf-key li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		max-width: none;
	}

	.hf-mark--key {
		flex: none;
	}

	/* ── Labels with lines (a labelled figure with room for them) ────────── */

	.hf-label,
	.hf-lead {
		display: none;
	}

	/* 🎛️ The narrowest figure that takes its labels; narrower, the markers
	   and the key. */
	@container hf (min-width: 24rem) {
		.hf-fig--labeled .hf-mark,
		.hf-fig--labeled .hf-key {
			display: none;
		}
		.hf-fig--labeled .hf-frame {
			margin: 0;
		}

		/* The image in the middle cell; each label in the cell on its side,
		   all of a side's labels in the one cell, each set along it at its
		   point's fraction (a grid item's % offsets resolve against its own
		   cell, which is the image's height or width). An empty side's track
		   is zero wide. */
		.hf-plate {
			display: grid;
			grid-template-columns: auto minmax(0, var(--hf-img-w)) auto;
			grid-template-rows: auto auto auto;
			justify-content: start;
		}
		.hf-frame {
			grid-area: 2 / 2;
		}

		.hf-label {
			display: block;
			position: relative;
			max-width: var(--hf-label-w);
			font-size: var(--hf-label-size);
			line-height: 1.25;
			color: var(--hf-label-ink);
			text-wrap: balance;
		}
		.hf-label--left,
		.hf-label--right {
			grid-row: 2;
			align-self: start;
			top: calc(var(--y) * 100%);
			transform: translateY(-50%);
		}
		.hf-label--left {
			grid-column: 1;
			justify-self: end;
			margin-right: var(--hf-label-gap);
			text-align: right;
		}
		.hf-label--right {
			grid-column: 3;
			justify-self: start;
			margin-left: var(--hf-label-gap);
		}
		.hf-label--top,
		.hf-label--bottom {
			grid-column: 2;
			justify-self: start;
			left: calc(var(--x) * 100%);
			max-width: none;
			white-space: nowrap;
			transform: translateX(-50%);
		}
		.hf-label--top {
			grid-row: 1;
			align-self: end;
			margin-bottom: var(--hf-label-gap);
		}
		.hf-label--bottom {
			grid-row: 3;
			align-self: start;
			margin-top: var(--hf-label-gap);
		}

		/* The line: from just off the label, across the gap and the image,
		   to the point, with a dot there. */
		.hf-lead {
			--reach: calc(var(--hf-label-gap) - var(--hf-lead-inset));
			display: block;
			position: absolute;
			background: var(--hf-lead-color);
			pointer-events: none;
		}
		.hf-lead::after {
			content: '';
			position: absolute;
			width: var(--hf-dot);
			height: var(--hf-dot);
			border-radius: var(--r-round);
			background: var(--hf-lead-color);
			box-shadow: 0 0 0 1px var(--hf-mark-ring);
		}
		.hf-lead--left,
		.hf-lead--right {
			top: calc(var(--y) * 100%);
			height: var(--hf-lead-w);
			transform: translateY(-50%);
		}
		.hf-lead--left {
			left: calc(-1 * var(--reach));
			width: calc(var(--x) * 100% + var(--reach));
		}
		.hf-lead--left::after {
			right: 0;
			top: 50%;
			transform: translate(50%, -50%);
		}
		.hf-lead--right {
			left: calc(var(--x) * 100%);
			right: calc(-1 * var(--reach));
		}
		.hf-lead--right::after {
			left: 0;
			top: 50%;
			transform: translate(-50%, -50%);
		}
		.hf-lead--top,
		.hf-lead--bottom {
			left: calc(var(--x) * 100%);
			width: var(--hf-lead-w);
			transform: translateX(-50%);
		}
		.hf-lead--top {
			top: calc(-1 * var(--reach));
			height: calc(var(--y) * 100% + var(--reach));
		}
		.hf-lead--top::after {
			bottom: 0;
			left: 50%;
			transform: translate(-50%, 50%);
		}
		.hf-lead--bottom {
			top: calc(var(--y) * 100%);
			bottom: calc(-1 * var(--reach));
		}
		.hf-lead--bottom::after {
			top: 0;
			left: 50%;
			transform: translate(-50%, -50%);
		}
	}
</style>
