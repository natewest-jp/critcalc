<!-- Copyright + disclaimer only; page navigation lives in the site chrome.
	 Identical on the landing and the static pages (positioned by the scene
	 layout). Quiet dimmed tone, no hover. -->
<script lang="ts">
	import HRule from '$lib/components/HRule.svelte';

	/** The copy at the END of a page panel (short screens — see the pages
	 *  layout), which is transform-placed: its fade goes in the PAINT. */
	let { inPanel = false }: { inPanel?: boolean } = $props();
</script>

<footer class="ftr" class:ftr--panel={inPanel}>
	<!-- Test placement of the center-marked rule (Nate, 2026-07-26): same
	     measure as the disclaimer beneath it, so the two read as one block.
	     Shows on the landing AND the static content pages — the footer is
	     shared by both. -->
	<div class="ftr__rule"><HRule variant="center" /></div>

	<!-- ⚠ ONE SENTENCE, NO INTERIOR MARKUP (text round, 2026-09-22). The wordmark
		 used to be a <strong> inside it, which made the line three fragments — and
		 a fragmented sentence cannot be reordered by a translator, so it has to be
		 one message before extraction (docs/text/style-guide.md § 3.1).
		 The year is a build constant; vite.config.ts says why it cannot read the
		 clock here. -->
	<p class="ftr__legal">
		© {__BUILD_YEAR__} critcalc.app, an unofficial fan project not affiliated with HoYoverse. Genshin
		Impact and all related trademarks and assets are © HoYoverse.
	</p>
</footer>

<style>
	.ftr {
		text-align: center;
		color: var(--muted);
		padding: 0 1rem;
		opacity: 0.6;
	}
	/* Inside the parallaxed page panel the 0.6 moves into the paint (the
	   sub-pixel law: element opacity on a transform-placed subtree is
	   rasterized at rounded coordinates and dances in WebKit). The rule's own
	   fade is HRule's group opacity over opaque parts, its documented form,
	   so it takes the product. */
	.ftr--panel {
		opacity: 1;
		color: color-mix(in srgb, var(--muted) 60%, transparent);
		padding: 0;
	}
	.ftr--panel .ftr__rule {
		--rule-opacity: 0.21;
	}

	/* Same measure as the legal text below it — the rule sizes to the content
	   it caps, not to the viewport. --rule-tint/-opacity are the shared HRule
	   knobs; kept dimmer than the text so it frames without competing. */
	.ftr__rule {
		max-width: 62rem;
		margin: 0 auto 0.55rem;
		--rule-tint: var(--muted);
		--rule-opacity: 0.35;
		--rule-weight: 1px;
	}

	.ftr__legal {
		margin: 0 auto;
		max-width: 62rem;
		/* One line at a laptop width. 🎛️ Stepped down from --fs-lg (⚓ Nate
		   2026-09-16): at 14px the sentence wrapped inside its 62rem measure. */
		font-size: var(--fs-md);
		line-height: var(--lh-snug);
	}

	/* `compact` — 40rem, $lib/breakpoints.ts (the literal: custom properties do
	   not work in media queries). ↻ Responsive sweep §3 item 9 (⚓ Nate
	   2026-10-15): on a phone the sentence is three or four lines in a 64px
	   footer (--site-footer-h), and at 320 its last line, "HoYoverse.", was cut
	   by the screen's foot. One type step down and a tighter rule fit it; a
	   taller footer was the other option and would cost the pages ~24px of
	   reading height. */
	@media (max-width: 40rem) {
		.ftr__rule {
			margin-bottom: 0.3rem;
		}
		/* ↻ 2026-10-18 (⚓ Nate): --fs-sm → --fs-xs (10px), the ladder's floor
		   for running text (--fs-2xs is a reserve rung), so the legal line
		   stops competing with the landing's cards on a phone. */
		.ftr__legal {
			font-size: var(--fs-xs);
		}
	}
</style>
