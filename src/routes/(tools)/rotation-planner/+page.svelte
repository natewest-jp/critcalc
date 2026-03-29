<script lang="ts">
	import CharacterAbilityCardWide from '$lib/components/CharacterAbilityCardWide.svelte';
</script>

<svelte:head>
	<title>Team rotation planner | critcalc.app</title>
</svelte:head>

<section class="rotation-page">
	<section class="card-row">
		<div class="card"><CharacterAbilityCardWide characterId="bennett" /></div>
		<div class="card"><CharacterAbilityCardWide characterId="keqing" /></div>
		<div class="card"><CharacterAbilityCardWide characterId="xingqiu" /></div>
		<div class="card"><CharacterAbilityCardWide characterId="yaoyao" /></div>
	</section>
</section>

<style>
	.rotation-page {
		margin: 5vw;
		text-align: center;
	}

	.card-row {
		display: grid;
		grid-template-columns: repeat(2, max-content);
		justify-content: center;
		gap: clamp(12px, 1.5vw, 20px);
	}

	.card {
		width: 100%;
		height: auto;
		min-height: 200px;
	}

</style>
