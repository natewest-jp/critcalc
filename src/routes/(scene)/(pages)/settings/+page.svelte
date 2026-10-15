<script lang="ts">
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
</script>

<h1>Settings</h1>
<SettingsPanel />

<style>
	/* This route owns its title. The chapters get theirs from the .prose article
	   HelpAreaShell wraps them in; Settings renders a bare panel, so it carries
	   the page-heading treatment itself rather than leaning on an outer .prose
	   that also leaked onto everything else in the panel. */
	h1 {
		margin: 0 0 1.2rem;
		font-size: var(--fs-5xl);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-tight);
		color: var(--chrome);
	}

	/* 🎛️ The panel keeps the overlay's measure (responsive sweep 2026-10-15, §3
	   item 25). The page is the 72rem static-page panel, and at 1920 the rows
	   ran its full 1073px: a label and its toggle ~720px apart across a
	   `space-between` row, and the section ledes ~200 characters a line. The
	   overlay draws the same panel at 491px and reads well, so here it stops at
	   40rem, left-aligned under the title, and the rest of the panel is bare.
	   The overlay renders SettingsPanel without this route, so it is
	   untouched. */
	h1 + :global(.sp) {
		max-width: 40rem;
	}
</style>
