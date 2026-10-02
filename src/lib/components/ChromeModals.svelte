<script lang="ts">
	import ChromeOverlay from './ChromeOverlay.svelte';
	import SettingsPanel from './SettingsPanel.svelte';
	import NavPanel from './NavPanel.svelte';
	import HelpAreaShell from './HelpAreaShell.svelte';
	import { chromeModal, closeChromeModal, type ChromeModalState } from './chromeModal.svelte';
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

	// ⚠ The area branch keeps rendering through ChromeOverlay's fade-OUT, after
	// close has already nulled `state` — so its body reads the last OPEN area,
	// never `state` itself, or the outro throws on `state.area`.
	type AreaState = Extract<ChromeModalState, { kind: 'area' }>;
	let lastArea: AreaState | null = null;
	const shownArea = $derived.by(() => {
		if (state?.kind === 'area') lastArea = state;
		return lastArea;
	});
</script>

{#if state?.kind === 'nav'}
	<ChromeOverlay title="Navigate" onClose={closeChromeModal} {onScene}>
		<NavPanel />
	</ChromeOverlay>
{:else if state?.kind === 'settings'}
	<ChromeOverlay title="Settings" onClose={closeChromeModal} {onScene}>
		<SettingsPanel />
	</ChromeOverlay>
{:else if state?.kind === 'area' && shownArea}
	{@const area = AREAS[shownArea.area]}
	<ChromeOverlay title={area.title} onClose={closeChromeModal} size="wide" {onScene}>
		{#snippet heading()}
			<AreaTabs current={shownArea.area} mode="modal" />
		{/snippet}
		<HelpAreaShell {area} chapter={shownArea.chapter} mode="modal" />
	</ChromeOverlay>
{/if}
