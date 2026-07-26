<script lang="ts">
	import HelpAreaShell from '$lib/components/HelpAreaShell.svelte';
	import { ABOUT_AREA } from '$lib/help/areas';
	import Chapter from '$lib/help/chapters/Contribute.svelte';
</script>

<svelte:head>
	<title>Contribute · critcalc.app</title>
	<meta
		name="description"
		content="critcalc is built on community data. How to support gcsim and Keqing Mains, and how to report something wrong."
	/>
</svelte:head>

<HelpAreaShell area={ABOUT_AREA} chapter="contribute" chapterComponent={Chapter} />
