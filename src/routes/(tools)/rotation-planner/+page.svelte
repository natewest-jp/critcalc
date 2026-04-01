<script lang="ts">
	import RotationTimeline from '$lib/components/RotationTimeline.svelte';
	import RotationCharacterPanel from '$lib/components/RotationCharacterPanel.svelte';
	import CharacterSelector from '$lib/components/CharacterSelector.svelte';
	import { getCharacterByDisplayName } from '$lib/data/characterLookup';

	let notation = $state('');
	let manualSlots = $state<string[] | null>(null);
	let selectorOpen = $state(false);
	let panelsExpanded = $state(false);

	// Notation-derived slots (first 4 unique characters in order of appearance)
	let autoSlots = $derived.by(() => {
		const seen: string[] = [];
		for (const segment of notation.split('>')) {
			const name = segment.trim().split(/\s+/)[0];
			if (!name) continue;
			const char = getCharacterByDisplayName(name);
			if (char && !seen.includes(char.id)) seen.push(char.id);
			if (seen.length === 4) break;
		}
		while (seen.length < 4) seen.push('blank');
		return seen;
	});

	// Active slots: manual takes priority, falls back to notation-driven
	let slots = $derived(manualSlots ?? autoSlots);

	function handleSelectorConfirm(chosen: string[]) {
		manualSlots = chosen;
		selectorOpen = false;
	}
</script>

<svelte:head>
	<title>Team rotation planner | critcalc.app</title>
</svelte:head>

<section class="rotation-page">
	<div class="intro">
		<p class="intro-kicker">Tool</p>
		<h1 class="intro-title">Team Rotation Planner</h1>
		<p class="intro-copy">
			Sequence your team's abilities on a shared timeline. Model burst windows, skill cooldowns, and
			on-field durations to evaluate rotation efficiency and buff uptime. Write rotations in
			KQM-compatible notation — paste directly from guides or build your own.
		</p>
	</div>

	<section class="timeline-section">
		<RotationTimeline
			bind:notation
			characterSlots={slots}
			onOpenSelector={() => { selectorOpen = true; }}
		/>
	</section>

	<section class="panel-row">
		{#each slots as slotId, i (i)}
			<RotationCharacterPanel characterId={slotId} bind:expanded={panelsExpanded} />
		{/each}
	</section>
</section>

{#if selectorOpen}
	<CharacterSelector
		currentSlots={slots}
		onConfirm={handleSelectorConfirm}
		onClose={() => { selectorOpen = false; }}
	/>
{/if}

<style>
	.rotation-page {
		display: flex;
		flex-direction: column;
		gap: clamp(16px, 2.5vw, 32px);
	}
	/* Override the parent gap between timeline and panels to match inter-card spacing */
	.panel-row {
		margin-top: calc(clamp(6px, 0.75vw, 10px) - clamp(16px, 2.5vw, 32px));
	}

	.intro {
		display: grid;
		gap: 0.75rem;
	}
	.intro-kicker {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		opacity: 0.7;
	}
	.intro-title {
		margin: 0;
		font-size: 1.875rem;
		font-weight: 600;
		letter-spacing: -0.025em;
	}
	.intro-copy {
		margin: 0;
		max-width: 56rem;
		font-size: 1rem;
		line-height: 1.75rem;
	}

	@media (min-width: 768px) {
		.intro-title {
			font-size: 2.25rem;
		}
	}

	.panel-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: clamp(6px, 0.75vw, 10px);
		min-width: 0;
	}

	.timeline-section {
		width: 100%;
	}
</style>
