<script lang="ts">
	import HelpAreaShell from '$lib/components/HelpAreaShell.svelte';
	import { ABOUT_AREA } from '$lib/help/areas';
	import Chapter from '$lib/help/chapters/Privacy.svelte';
</script>

<HelpAreaShell area={ABOUT_AREA} chapter="privacy" chapterComponent={Chapter} />
