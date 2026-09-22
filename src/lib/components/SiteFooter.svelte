<!-- Copyright + disclaimer only; page navigation lives in the site chrome.
	 Identical on the landing and the static pages (positioned by the scene
	 layout). Quiet dimmed tone, no hover. -->
<script lang="ts">
	import HRule from '$lib/components/HRule.svelte';
</script>

<footer class="ftr">
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
		© {__BUILD_YEAR__} critcalc.app — an unofficial fan project, not affiliated with or endorsed by HoYoverse.
		Genshin Impact and all related trademarks and assets are © HoYoverse.
	</p>
</footer>

<style>
	.ftr {
		text-align: center;
		color: var(--muted);
		padding: 0 1rem;
		opacity: 0.6;
	}

	/* Same measure as the legal text below it — the rule sizes to the content
	   it caps, not to the viewport. --rule-tint/-opacity are the shared HRule
	   knobs; kept dimmer than the text so it frames without competing. */
	.ftr__rule {
		max-width: 62rem;
		margin: 0 auto 0.55rem;
		--rule-tint: var(--muted);
		--rule-opacity: 0.35;
	}

	.ftr__legal {
		margin: 0 auto;
		max-width: 62rem;
		/* One line at a laptop width. 🎛️ Stepped down from --fs-lg (⚓ Nate
		   2026-09-16): at 14px the sentence wrapped inside its 62rem measure. */
		font-size: var(--fs-md);
		line-height: var(--lh-snug);
	}
</style>
