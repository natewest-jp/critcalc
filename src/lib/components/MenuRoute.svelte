<!--
  A menu-state section's own route (build plan §13.4) that has no page of its
  own yet: under the switch the pages layout hands the address to the menu
  state, which renders the section. ⏭ With the switch off the address is not
  public, so it goes to what it replaces (the old Library page).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { nextLayout } from '$lib/nextLayout';

	let { fallback }: { fallback: string } = $props();

	onMount(() => {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass a resolved path
		if (!get(nextLayout)) void goto(fallback, { replaceState: true });
	});
</script>
