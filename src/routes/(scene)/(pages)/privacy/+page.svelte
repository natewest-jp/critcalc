<script lang="ts">
	import HelpAreaShell from '$lib/components/HelpAreaShell.svelte';
	import { ABOUT_AREA } from '$lib/help/areas';
	import Chapter from '$lib/help/chapters/Privacy.svelte';
</script>

<svelte:head>
	<title>Privacy · critcalc.app</title>
	<meta
		name="description"
		content="critcalc keeps nothing on a server: no accounts, no tracking, no cookies. Your data lives only in your browser."
	/>
</svelte:head>

<HelpAreaShell area={ABOUT_AREA} chapter="privacy" chapterComponent={Chapter} />
