<script lang="ts">
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
</script>

<div class="settings-page">
	<h1 class="page-title">Site settings</h1>
	<SettingsPanel />
</div>

<style>
	.settings-page {
		max-width: 640px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.4rem;
	}

	.page-title {
		font-size: var(--fs-4xl);
		font-weight: var(--fw-bold);
		margin: 0;
	}
</style>
