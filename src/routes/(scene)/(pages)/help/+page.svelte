<!-- Help area, FAQ chapter. The chapter component is imported STATICALLY so this
	 route prerenders with its content in the HTML; the chrome overlay renders the
	 same component lazily instead (see $lib/help/areas.ts). -->
<script lang="ts">
	import HelpAreaShell from '$lib/components/HelpAreaShell.svelte';
	import { HELP_AREA } from '$lib/help/areas';
	import Chapter from '$lib/help/chapters/Faq.svelte';
</script>

<svelte:head>
	<title>Help &amp; FAQ · critcalc.app</title>
	<meta
		name="description"
		content="How to use critcalc's tools, plus answers to common questions about the site and its data."
	/>
</svelte:head>

<HelpAreaShell area={HELP_AREA} chapter="faq" chapterComponent={Chapter} />
