<script lang="ts">
	import HelpAreaShell from '$lib/components/HelpAreaShell.svelte';
	import { HELP_AREA } from '$lib/help/areas';
	import Chapter from '$lib/help/chapters/Visualizers.svelte';
</script>

<svelte:head>
	<title>Visualizers help · critcalc.app</title>
	<meta
		name="description"
		content="The critcalc Visualizers: the workspace, and what each of the eight graph instruments shows."
	/>
</svelte:head>

<HelpAreaShell area={HELP_AREA} chapter="crit-visualizer" chapterComponent={Chapter} />
