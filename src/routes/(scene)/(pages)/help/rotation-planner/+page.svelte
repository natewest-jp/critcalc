<script lang="ts">
	import HelpAreaShell from '$lib/components/HelpAreaShell.svelte';
	import { HELP_AREA } from '$lib/help/areas';
	import Chapter from '$lib/help/chapters/RotationPlanner.svelte';
</script>

<svelte:head>
	<title>Rotation Planner help · critcalc.app</title>
	<meta
		name="description"
		content="How the critcalc Rotation Planner works: KQM-style notation, reading the timeline, team loadouts and caveats."
	/>
</svelte:head>

<HelpAreaShell area={HELP_AREA} chapter="rotation-planner" chapterComponent={Chapter} />
