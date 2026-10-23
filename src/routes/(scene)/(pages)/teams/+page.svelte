<script lang="ts">
	import { resolve } from '$app/paths';
	import MenuRoute from '$lib/components/MenuRoute.svelte';
</script>

<MenuRoute fallback={resolve('/library')} />
