<script lang="ts">
	import CharacterAbilityCardWide from '$lib/components/CharacterAbilityCardWide.svelte';
	import RotationTimeline from '$lib/components/RotationTimeline.svelte';
	import { getCharacterByDisplayName } from '$lib/data/characterLookup';

	let notation = $state('');

	let slots = $derived.by(() => {
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
</script>

<svelte:head>
	<title>Team rotation planner | critcalc.app</title>
</svelte:head>

<section class="rotation-page">
	<section class="card-row">
		{#each slots as slotId, i (i)}
			<div class="card">
				<CharacterAbilityCardWide characterId={slotId} />
			</div>
		{/each}
	</section>

	<section class="timeline-section">
		<RotationTimeline bind:notation characterSlots={slots} />
	</section>
</section>

<style>
	.rotation-page {
		display: flex;
		flex-direction: column;
		gap: clamp(16px, 2.5vw, 32px);
	}

	.card-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: clamp(6px, 0.75vw, 10px);
		min-width: 0;
	}

	.card {
		min-width: 0;
	}

	.timeline-section {
		width: 100%;
	}
</style>
