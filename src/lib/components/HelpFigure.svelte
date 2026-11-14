<!--
	A Help screenshot and the paragraphs it belongs to. The chapter wraps the
	paragraphs; the figure is anchored to the first of them.

	Wide (the reading layout's margin is open, MenuState.svelte): the figure
	floats into the margin, level with that paragraph. Narrow, or on the
	server-drawn chapter page (no container, so the query never matches): it
	falls in under the paragraphs.

	The image and its callout positions come from the generated manifest
	(`scripts/help-shots/`); the numbered markers are laid over it here, so
	their look is the custom properties below, not pixels in the image.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { HELP_SHOTS, type HelpShotId } from '$lib/help/shots/shots.generated';

	let {
		shot,
		alt,
		caption,
		legend,
		children
	}: {
		shot: HelpShotId;
		/** What the image shows, for a reader who can't see it. */
		alt: string;
		caption?: string;
		/** One label per callout, in the markers' order. */
		legend?: string[];
		children: Snippet;
	} = $props();

	const s = $derived(HELP_SHOTS[shot]);
	/** A marker set beside the image, not on it, needs room on that side. */
	const outLeft = $derived(s.callouts.some((c) => c.x < 0));
	const outBelow = $derived(s.callouts.some((c) => c.y > 1));
</script>

<div class="hf">
	<figure class="hf-fig" style:--hf-img-w="{s.width * s.scale}px">
		<div class="hf-frame" class:hf-frame--out-left={outLeft} class:hf-frame--out-below={outBelow}>
			<img src={s.src} {alt} width={s.width} height={s.height} loading="lazy" decoding="async" />
			{#each s.callouts as c (c.n)}
				<span class="hf-mark" style:left="{c.x * 100}%" style:top="{c.y * 100}%" aria-hidden="true"
					>{c.n}</span
				>
			{/each}
		</div>
		{#if caption || legend}
			<figcaption>
				{#if caption}<span class="hf-caption">{caption}</span>{/if}
				{#if legend}
					<ol class="hf-legend">
						{#each legend as label, i (i)}
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
	/* 🎛️ The callout marker: size, fill, ink and the ring that parts it from
	   the screenshot under it. */
	.hf {
		--hf-mark-size: 1.25rem;
		--hf-mark-fill: var(--accent);
		--hf-mark-ink: var(--sel-ink);
		--hf-mark-ring: var(--bg);
		/* 🎛️ The gap between a figure and the text it falls under (narrow). */
		--hf-gap: 1rem;

		display: flex;
		flex-direction: column;
	}

	/* Narrow: under the paragraphs, at its own size or the column's. */
	.hf-fig {
		order: 1;
		margin: 0 0 var(--hf-gap);
		width: min(var(--hf-img-w), 100%);
	}

	/* Wide: the reading layout's margin is open (MenuState.svelte's
	   `.reading-host` container; the same 56rem). The figure leaves the flow
	   and floats right, the full margin wide, with the image at its left edge.
	   The text keeps its 68ch measure, so the float never narrows a line. */
	@container (min-width: 56rem) {
		.hf {
			display: block;
		}
		.hf-fig {
			float: right;
			clear: right;
			width: var(--hf-margin, 28rem);
			margin: 0 0 var(--hf-gap) 0;
		}
		.hf-frame {
			max-width: var(--hf-img-w);
		}
	}

	.hf-frame {
		position: relative;
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

	.hf-frame--out-left {
		margin-left: calc(var(--hf-mark-size) * 0.75);
	}
	.hf-frame--out-below {
		margin-bottom: calc(var(--hf-mark-size) * 0.5);
	}

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
		transform: translate(-50%, -50%);
		box-shadow: 0 0 0 2px var(--hf-mark-ring);
	}

	figcaption {
		margin-top: 0.5rem;
		font-size: var(--fs-md);
		color: var(--muted);
	}

	.hf-legend {
		display: grid;
		gap: 0.3rem;
		margin: 0.4rem 0 0;
		padding: 0;
		list-style: none;
	}

	.hf-legend li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		max-width: none;
	}

	.hf-mark--key {
		flex: none;
	}
</style>
