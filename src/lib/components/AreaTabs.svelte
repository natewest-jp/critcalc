<script lang="ts">
	/**
	 * About | Help — the static pages as ONE place (⚓ Nate 2026-09-23). The
	 * heading of the area routes is these two tabs, the current one lit, and
	 * the other area is one click away. Each area's chapters stay in its own
	 * sidebar below, so the nav keeps two levels (chapter, then its sections).
	 * Settings stays out on purpose — it is a control you reach for mid-task, not
	 * something you go and read.
	 */
	import { AREAS, type ChromeAreaId } from '$lib/help/areas';

	let { current }: { current: ChromeAreaId } = $props();

	// About first: the chrome's marks read ⓘ then ?.
	const ORDER: ChromeAreaId[] = ['about', 'help'];
</script>

<!-- Area paths come out of areas.ts already base-resolved (the HelpAreaShell
	 precedent), so resolve() again would double the base prefix. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<nav class="area-tabs" aria-label="Help and About">
	{#each ORDER as id (id)}
		{@const area = AREAS[id]}
		<a
			class="area-tab"
			class:is-current={id === current}
			aria-current={id === current ? 'page' : undefined}
			href={area.chapters[0].path}>{area.title}</a
		>
	{/each}
</nav>

<style>
	.area-tabs {
		display: flex;
		align-items: baseline;
		gap: 1.1rem;
	}

	/* The overlay title's own face and size — the tabs ARE the title now. The
	   lit tab carries the title's ink; the other recedes and lights on hover. */
	.area-tab {
		padding: 0;
		font: inherit;
		font-family: var(--font-display);
		font-size: var(--fs-4xl);
		font-weight: var(--fw-semibold);
		line-height: var(--lh-tight);
		color: var(--muted);
		background: none;
		border: 0;
		text-decoration: none;
		text-transform: none;
		cursor: pointer;
		transition: color var(--t-snap);
	}
	.area-tab:hover,
	.area-tab:focus-visible {
		color: var(--text);
	}
	.area-tab.is-current {
		color: var(--chrome);
		cursor: default;
	}
</style>
