<script lang="ts">
	import ChromeOverlay from './ChromeOverlay.svelte';
	import SettingsPanel from './SettingsPanel.svelte';
	import NavPanel from './NavPanel.svelte';
	import HelpAreaShell from './HelpAreaShell.svelte';
	import { chromeModal, closeChromeModal } from './chromeModal.svelte';
	import AreaTabs from './AreaTabs.svelte';
	import { AREAS } from '$lib/help/areas';

	// Host for whatever the chrome's meta glyphs have open. Each layout renders
	// exactly one of these, as a SIBLING of the chrome — see chromeModal.svelte.ts
	// for why it cannot be a child of it on the scene.

	let {
		/** Lighter backdrop for overlays floating over the visible scene. */
		onScene = false
	}: { onScene?: boolean } = $props();

	const state = $derived(chromeModal.current);
</script>

{#if state?.kind === 'nav'}
	<ChromeOverlay title="Go to" onClose={closeChromeModal} {onScene}>
		<NavPanel />
	</ChromeOverlay>
{:else if state?.kind === 'settings'}
	<ChromeOverlay title="Settings" onClose={closeChromeModal} {onScene}>
		<SettingsPanel />
	</ChromeOverlay>
{:else if state?.kind === 'area'}
	{@const area = AREAS[state.area]}
	<ChromeOverlay title={area.title} onClose={closeChromeModal} size="wide" {onScene}>
		{#snippet heading()}
			<AreaTabs current={state.area} mode="modal" />
		{/snippet}
		<HelpAreaShell {area} chapter={state.chapter} mode="modal" />
	</ChromeOverlay>
{/if}
