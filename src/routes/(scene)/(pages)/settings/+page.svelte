<script lang="ts">
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
</script>

<svelte:head>
	<title>Settings · critcalc.app</title>
</svelte:head>

<h1>Settings</h1>
<SettingsPanel />

<style>
	/* This route owns its title. The chapters get theirs from the .prose article
	   HelpAreaShell wraps them in; Settings renders a bare panel, so it carries
	   the page-heading treatment itself rather than leaning on an outer .prose
	   that also leaked onto everything else in the panel. */
	h1 {
		margin: 0 0 1.2rem;
		font-size: var(--fs-5xl);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-tight);
		color: var(--chrome);
	}
</style>
