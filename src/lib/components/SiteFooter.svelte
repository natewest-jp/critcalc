<!-- Copyright + disclaimer only; page navigation lives in the site chrome.
	 Identical on the landing and the static pages (positioned by the scene
	 layout). Quiet dimmed tone, no hover. -->
<script lang="ts">
	import HRule from '$lib/components/HRule.svelte';
</script>

<footer class="ftr">
	<!-- Test placement of the centre-marked rule (Nate, 2026-07-26): same
	     measure as the disclaimer beneath it, so the two read as one block.
	     Shows on the landing AND the static content pages — the footer is
	     shared by both. -->
	<div class="ftr__rule"><HRule variant="center" /></div>

	<p class="ftr__legal">
		© 2026 <strong>critcalc.app</strong> — an unofficial fan project, not affiliated with or endorsed
		by HoYoverse. Genshin Impact and all related trademarks and assets are © HoYoverse.
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
		font-size: var(--fs-md);
		line-height: var(--lh-snug);
	}
</style>
