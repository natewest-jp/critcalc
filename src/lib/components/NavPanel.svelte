<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { TOOLS } from '$lib/tools';
	import {
		openArea,
		openSettings,
		closeChromeModal,
		roster,
		rosterHref
	} from './chromeModal.svelte';
	import { defaultChapter, helpChapterForPath } from '$lib/help/areas';

	// What the compass opens: every destination on the site, in one panel.
	//
	// ⚠ THE WHOLE POINT IS THAT IT HOLDS BOTH KINDS OF NAVIGATION. Below 47.5rem
	// the chrome hides the tool switcher, About and Help, because the bar cannot
	// fit them beside a wordmark on a 320px phone (see openNav()). Everything
	// they reach has to be reachable from here or it is unreachable.
	//
	// ⚠ Settings is listed even though its cog SURVIVES in the bar at that
	// width. ⛔ That is not an oversight to tidy away: the cog is an unlabelled
	// glyph, and a reader who does not recognise it will open this panel to
	// look. An index that omits a destination because it happens to be
	// reachable elsewhere makes people hunt.
	//
	// ⚠ NO DESCRIPTIONS, deliberately. Every line of user-facing copy on this
	// site is Nate's (roadmap §13, the text rewrite), and `seo.ts` already
	// carries per-tool descriptions written for search results rather than for
	// a nav panel. Titles are already authored and already correct; inventing a
	// second voice for them here is the text pass's call, not this round's.

	const helpChapter = $derived(helpChapterForPath(page.url.pathname));

	// A tool is "current" on its own route and on anything nested under it,
	// matching how the chrome switcher decides the same thing.
	const currentTool = $derived(TOOLS.find((t) => page.url.pathname.startsWith(t.path)));
</script>

<!-- ⚠ The landmark is named after the CONTROL that opens it (the chrome's
	 Navigate button and the overlay's own title), never after one of the two
	 sections inside it — it wraps Tools AND Site, so "Site" named it after half
	 its contents and collided with the heading below (text round, 2026-09-22). -->
<nav class="np" aria-label="Navigate">
	<section class="np-section">
		<h2 class="kicker np-section-title">Tools</h2>
		{#each TOOLS as t (t.path)}
			{@const isCurrent = t === currentTool}
			<a
				class="np-row"
				class:is-current={isCurrent}
				href={resolve(t.path)}
				aria-current={isCurrent ? 'page' : undefined}
				onclick={closeChromeModal}
			>
				<span class="np-name">{t.title}</span>
				{#if isCurrent}<span class="np-here">You are here</span>{/if}
			</a>
		{/each}
	</section>

	<section class="np-section">
		<h2 class="kicker np-section-title">Site</h2>
		<!-- These three REPLACE the modal rather than stacking on it: the panel
		     is the same overlay host, so opening an area from here is the same
		     state write the chrome glyph would have made at a wider viewport. -->
		<button class="np-row" onclick={() => openArea('about', defaultChapter('about'))}>
			<span class="np-name">About</span>
		</button>
		<button class="np-row" onclick={() => openArea('help', helpChapter)}>
			<span class="np-name">Help</span>
		</button>
		<!-- The chrome's Roster button, folded (SiteChrome): over a tool it opens
		     the Library there; anywhere else it goes to the /library page. -->
		{#if roster.available}
			<button class="np-row" onclick={roster.open}>
				<span class="np-name">Roster</span>
			</button>
		{:else}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- rosterHref IS resolve('/library') plus a query (chromeModal.svelte.ts) -->
			<a class="np-row" href={rosterHref} onclick={closeChromeModal}>
				<span class="np-name">Roster</span>
			</a>
		{/if}
		<button class="np-row" onclick={openSettings}>
			<span class="np-name">Settings</span>
		</button>
	</section>
</nav>

<style>
	.np {
		display: flex;
		flex-direction: column;
		gap: 1.4rem;
	}

	.np-section {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.np-section-title {
		margin: 0 0 0.35rem;
	}

	/* One row shape for a link and a button alike — the reader is picking a
	   destination either way, and two shapes would say they differ. `button`
	   needs the resets an `a` does not, so both are stated here rather than
	   letting the element type decide anything visible. */
	.np-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		width: 100%;
		/* ⚠ 44px of hit height, not the 25–34px the chrome's own controls carry.
		   This panel is the phone surface by construction — it only appears
		   where the bar could not fit its buttons — so it is the one place on
		   the site that should be sized for a thumb from the start rather than
		   waiting for the pointer: coarse pass. */
		min-height: 44px;
		padding: 0.4rem 0.6rem;
		border: none;
		border-radius: var(--r-sm);
		background: none;
		color: var(--text);
		font: inherit;
		font-size: var(--fs-xl);
		text-align: left;
		text-decoration: none;
		cursor: pointer;
		transition: background-color var(--t-snap);
	}

	.np-row:hover,
	.np-row:focus-visible {
		background: var(--fill-rest);
	}

	.np-name {
		font-weight: var(--fw-medium);
	}

	/* The current tool stays selectable — it is a legitimate "close this and go
	   back" — so it is marked, not disabled. */
	.np-row.is-current .np-name {
		color: var(--accent);
	}

	.np-here {
		flex: none;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
</style>
