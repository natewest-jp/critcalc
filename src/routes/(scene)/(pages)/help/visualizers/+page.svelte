<script lang="ts">
	import HelpAreaShell from '$lib/components/HelpAreaShell.svelte';
	import { HELP_AREA } from '$lib/help/areas';
	import Chapter from '$lib/help/chapters/Visualizers.svelte';
</script>

<HelpAreaShell area={HELP_AREA} chapter="visualizers" chapterComponent={Chapter} />
