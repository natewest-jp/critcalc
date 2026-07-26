<script lang="ts">
	import HelpAreaShell from '$lib/components/HelpAreaShell.svelte';
	import { HELP_AREA } from '$lib/help/areas';
	import Chapter from '$lib/help/chapters/TeamBuilder.svelte';
</script>

<svelte:head>
	<title>Team Builder help · critcalc.app</title>
	<meta
		name="description"
		content="How the critcalc Team Builder works: capability facets, constellation modes, comparison and team slots."
	/>
</svelte:head>

<HelpAreaShell area={HELP_AREA} chapter="team-builder" chapterComponent={Chapter} />
