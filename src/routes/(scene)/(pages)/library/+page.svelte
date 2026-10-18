<script lang="ts">
	/**
	 * /library — THE LIBRARY AS ITS OWN PAGE (lineups design §10.1: "an
	 * OVERLAY first … built so it can move to its own page later"; ⚓ Nate
	 * 2026-10-18). The SAME view the tools' overlay renders (`LibraryView`),
	 * in the static pages' panel. ⏭ Its look is Nate's to design; this round
	 * only puts it on a route.
	 *
	 * ⚓ NO TOOL IS MOUNTED HERE, so two things the tools layout does for the
	 * overlay happen on this page instead:
	 *   · the DOCUMENTS are restored and persisted (rotation tabs, lineups).
	 *     A pick writes into them and then navigates to its tool, whose layout
	 *     restores from localStorage on mount — so a pick written into the
	 *     pre-restore default would be clobbered on arrival. Restored only if
	 *     nothing has yet (arriving from a tool, they already are).
	 *   · the flows run in their "elsewhere" mode (`library.atPage`): every
	 *     pick goes to its document's home — rotations and teams to the
	 *     Planner, lineups to the Builder (§10.1a).
	 *
	 * ⚓ THE TAB IS IN THE QUERY (`?tab=roster`), like every deep link on the
	 * site (`?r=`, `?b=`, `?i=`, `?swap=`), and read the same way — in
	 * `afterNavigate`, never `onMount` (a prerendered page cannot read its query
	 * at build time, and the chrome's Roster link re-enters this route from
	 * itself). Unlike those it is VIEW state, not a payload, so it is kept, and
	 * a tab click rewrites it: a reload or a copied link lands where you were.
	 */
	import { onMount } from 'svelte';
	import { afterNavigate, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import LibraryView from '$lib/components/LibraryView.svelte';
	import { library, type LibraryTab } from '$lib/library.svelte';
	import { rotationTabs } from '$lib/rotationTabs.svelte';
	import { boards } from '$lib/boards.svelte';

	const tabOf = (url: URL): LibraryTab =>
		url.searchParams.get('tab') === 'roster' ? 'roster' : 'teams';

	afterNavigate((nav) => {
		const url = nav.to?.url;
		if (!url || !url.pathname.startsWith(resolve('/library'))) return;
		library.atPage(tabOf(url));
	});

	onMount(() => {
		if (!rotationTabs.restored) rotationTabs.restore();
		// After the tabs, as in the tools layout: a board team's link is
		// checked against them.
		if (!boards.restored) boards.restore();
	});
	// Mirrors of the tools layout's: both no-ops until restored.
	$effect(() => {
		rotationTabs.persist();
	});
	$effect(() => {
		boards.persist();
	});

	function ontab(tab: LibraryTab) {
		const href = tab === 'roster' ? `${resolve('/library')}?tab=roster` : resolve('/library');
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved above; the query is appended
		replaceState(href, page.state);
	}
</script>

<div class="library-page">
	<LibraryView standalone {ontab} />
</div>

<style>
	/* The view scrolls its own columns (and the Roster its own grid), so it
	   needs a HEIGHT, which the panel has and its children do not: the panel
	   becomes a column and the page fills it. Scoped with :has() so no other
	   page's flow changes. */
	:global(.pages-panel:has(.library-page)) {
		display: flex;
		flex-direction: column;
	}
	:global(.pages-panel:has(.library-page) > div:has(> .library-page)) {
		flex: 1 0 auto;
		min-height: 0;
		height: 100%;
		display: flex;
		flex-direction: column;
	}
	.library-page {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
</style>
