<script lang="ts">
	import CharacterAbilityCardWide from '$lib/components/CharacterAbilityCardWide.svelte';
	import RotationTimeline from '$lib/components/RotationTimeline.svelte';

	let slots = $state(['blank', 'blank', 'blank', 'blank']);
</script>

<svelte:head>
	<title>Team rotation planner | critcalc.app</title>
</svelte:head>

<section class="rotation-page">
	<section class="card-row">
		{#each slots as slotId}
			<div class="card">
				<CharacterAbilityCardWide characterId={slotId} />
			</div>
		{/each}
	</section>

	<section class="timeline-section">
		<RotationTimeline characterSlots={slots} />
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
