<script lang="ts">
	import HelpAreaShell from '$lib/components/HelpAreaShell.svelte';
	import { ABOUT_AREA } from '$lib/help/areas';
	import Chapter from '$lib/help/chapters/About.svelte';
</script>

<svelte:head>
	<title>About · critcalc.app</title>
	<meta
		name="description"
		content="What critcalc is: a set of Genshin Impact theorycrafting tools that visualize mechanics rather than reduce them to a score."
	/>
</svelte:head>

<HelpAreaShell area={ABOUT_AREA} chapter="about" chapterComponent={Chapter} />
