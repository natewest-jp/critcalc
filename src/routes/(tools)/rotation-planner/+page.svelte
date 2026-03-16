<script lang="ts">
	import CharacterAbilityCard from '$lib/components/CharacterAbilityCard.svelte';
</script>

<svelte:head>
	<title>Team rotation planner | critcalc.app</title>
</svelte:head>

<section class="rotation-page">
	<section class="card-row">
		<div class="card"><CharacterAbilityCard /></div>
		<div class="card"><CharacterAbilityCard /></div>
		<div class="card"><CharacterAbilityCard /></div>
		<div class="card"><CharacterAbilityCard /></div>
	</section>
</section>

<style>
	.rotation-page {
		margin: 5vw;
		text-align: center;
	}

	.card-row {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: clamp(12px, 1.5vw, 24px);
	}

	.card {

		width: 100%;
		height: 100%;
		aspect-ratio: 7 / 4;
	}

</style>
