<script lang="ts">
	import '@fontsource-variable/bitter';
	import '@fontsource-variable/noto-sans';
	import '@fontsource-variable/noto-sans-display';
	import '@fontsource-variable/noto-sans-mono';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>critcalc.app</title>
	<meta name="description" content="Genshin Impact tools for planning and theorycrafting." />
</svelte:head>

{@render children()}
