<script lang="ts">
	import HelpAreaShell from '$lib/components/HelpAreaShell.svelte';
	import { ABOUT_AREA } from '$lib/help/areas';
	import Chapter from '$lib/components/CoverageList.svelte';
</script>

<HelpAreaShell area={ABOUT_AREA} chapter="coverage" chapterComponent={Chapter} />
