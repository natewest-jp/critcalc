<!--
  THE MENU STATE's shell (profiles and surfaces design §6; build plan §13,
  phase 2c). ⚓ Slate over the WHOLE screen, the top bar on it (draft 5); the
  tool underneath is kept, paused, as a left tool page is. A sidebar of
  sections; each one an address (`$lib/menuState.svelte.ts`).

  On a phone (below `roomy`) the sidebar IS the index ☰ opens, with the tools
  at its top (§5.2), and a section shows alone with a way back to it.

  ⏭ The reading surfaces keep today's chapters for now: §6.4's short strings
  on slate with paper patches are a copy round of their own. Strings here are
  working copy.
-->
<script lang="ts">
	import { onDestroy, type Component } from 'svelte';
	import { fade } from 'svelte/transition';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import {
		SECTION_GROUPS,
		itemOf,
		menu,
		sectionForPath,
		type Section,
		type SectionItem
	} from '$lib/menuState.svelte';
	import { findChapter, type ChromeAreaId } from '$lib/help/areas';
	import { TOOLS } from '$lib/tools';
	import { storageSession } from '$lib/storage/session.svelte';
	import { library } from '$lib/library.svelte';
	import { sceneOccluded } from '$lib/landing/transition';
	import LibraryPlace from './LibraryPlace.svelte';
	import RosterTab from './RosterTab.svelte';
	import SettingsPanel from './SettingsPanel.svelte';

	const section = $derived(menu.section);
	const item = $derived(section ? itemOf(section) : undefined);
	const group = $derived(SECTION_GROUPS.find((g) => g.items.some((i) => i.id === section)));
	const profileName = $derived(storageSession.profile?.name ?? 'You');
	const groupTitle = (g: (typeof SECTION_GROUPS)[number]) => g.title ?? profileName;

	/** The tool underneath, if any (its button toggles back onto it). */
	const tool = $derived(
		menu.routed ? undefined : TOOLS.find((t) => page.url.pathname.startsWith(resolve(t.path)))
	);

	// ── A chapter section: Help's and About's existing chapters ─────────────
	const chapter = $derived.by(() => {
		const m = section?.match(/^(help|about)\/(.+)$/);
		return m ? findChapter(m[1] as ChromeAreaId, m[2]) : null;
	});
	let ChapterC = $state<Component | null>(null);
	$effect(() => {
		const c = chapter;
		ChapterC = null;
		if (c) void c.load().then((m) => chapter === c && (ChapterC = m.default));
	});

	let mainEl = $state<HTMLElement>();
	// A fresh section starts at its own top.
	$effect(() => {
		void section;
		if (mainEl) mainEl.scrollTop = 0;
	});

	function go(e: MouseEvent, it: SectionItem): void {
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		e.preventDefault();
		menu.show(it.id);
	}

	/** A link inside a section to another section switches in place, rather
	 *  than leaving the tool underneath (a chapter's "see the Planner help"). */
	function onMainClick(e: MouseEvent): void {
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
		const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
		if (!a || a.target === '_blank' || a.origin !== location.origin) return;
		const to: Section | null = sectionForPath(a.pathname);
		if (!to) return;
		e.preventDefault();
		menu.show(to);
	}

	function onKey(e: KeyboardEvent): void {
		// A section that spent the Escape on something of its own (a search, a
		// rename) marks it defaultPrevented.
		if (e.key === 'Escape' && !e.defaultPrevented) menu.close();
	}

	// ⚓ The world is covered, so it stops rendering (§6.1): unpainted once the
	// slate has faded in, painted again as it starts to leave.
	const covered = () => sceneOccluded.set(true);
	const uncovered = () => sceneOccluded.set(false);
	onDestroy(uncovered);
</script>

<svelte:window onkeydown={onKey} />

{#snippet closeGlyph()}
	<!-- Nate's hand-drawn disc (assets-src/tools/close.svg). -->
	<svg viewBox="0 0 56 56" fill-rule="evenodd" aria-hidden="true"
		><path
			d="M28,0C43.454,0 56,12.546 56,28C56,43.454 43.454,56 28,56C12.546,56 0,43.454 0,28C0,12.546 12.546,0 28,0ZM30.782,28.021C30.782,27.807 31.831,26.686 33.93,24.659C36.028,22.632 37.077,21.454 37.077,21.125C37.077,20.796 36.798,20.366 36.239,19.836C35.681,19.306 35.219,19.041 34.854,19.041C34.488,19.041 33.285,20.062 31.244,22.103C29.203,24.144 28.115,25.164 27.979,25.164C27.842,25.164 26.747,24.136 24.691,22.081C22.636,20.026 21.458,18.998 21.157,18.998C20.856,18.998 20.416,19.27 19.836,19.814C19.256,20.359 18.966,20.799 18.966,21.136C18.966,21.472 19.997,22.672 22.06,24.734C24.122,26.797 25.153,27.893 25.153,28.021C25.153,28.15 24.115,29.253 22.038,31.33C19.961,33.407 18.923,34.56 18.923,34.789L18.923,35.111C18.923,35.255 19.209,35.595 19.782,36.132C20.355,36.669 20.813,36.937 21.157,36.937C21.501,36.937 22.693,35.917 24.734,33.876C26.775,31.835 27.842,30.814 27.936,30.814C28.029,30.814 29.139,31.846 31.266,33.908C33.393,35.971 34.603,37.002 34.896,37.002C35.19,37.002 35.62,36.726 36.186,36.175C36.751,35.623 37.034,35.187 37.034,34.864C37.034,34.542 35.992,33.339 33.908,31.255C31.824,29.171 30.782,28.093 30.782,28.021Z"
		/></svg
	>
{/snippet}

<div
	class="menu ctx-dark"
	class:is-index={section === 'index'}
	role="dialog"
	aria-label={item?.label ?? 'Menu'}
	transition:fade={{ duration: motion(T_QUICK) }}
	onintrostart={introLive}
	onintroend={covered}
	onoutrostart={(e) => {
		uncovered();
		outroInert(e);
	}}
>
	<nav class="side" aria-label="Sections">
		<!-- Phone: the tools head the index (§5.2). -->
		<div class="side-tools">
			{#each TOOLS as t (t.path)}
				<a
					class="side-item side-tool-link"
					class:is-on={tool?.path === t.path}
					href={resolve(t.path)}
					onclick={(e) => {
						if (tool?.path === t.path) {
							e.preventDefault();
							menu.close();
						}
					}}>{t.short}</a
				>
			{/each}
		</div>
		{#each SECTION_GROUPS as g (g.id)}
			<p class="side-group">{groupTitle(g)}</p>
			{#each g.items as it (it.id)}
				<!-- Section paths come resolved from menuState (SECTION_GROUPS). -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					class="side-item"
					class:is-on={section === it.id}
					href={it.path}
					aria-current={section === it.id ? 'page' : undefined}
					onclick={(e) => go(e, it)}
				>
					<span>{it.label}</span>
					{#if it.tool}<span class="side-kind">{it.tool}</span>{/if}
				</a>
			{/each}
		{/each}
	</nav>

	<!-- The click handler only re-routes links inside it (keyboard activation
	     of a link is a click too). -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
	<main class="main" bind:this={mainEl} onclick={onMainClick}>
		<header class="head">
			<div class="head-text">
				<button class="head-back" onclick={() => menu.show('index')}
					><span aria-hidden="true">‹</span> Menu</button
				>
				{#if group}<p class="kicker">{groupTitle(group)}</p>{/if}
				<!-- A chapter brings its own title. -->
				{#if item && !chapter}<h2 class="head-title">{item.label}</h2>{/if}
			</div>
			<button
				class="head-close"
				aria-label={tool ? `Back to the ${tool.short}` : 'Close'}
				title={tool ? `Back to the ${tool.short} (Esc)` : 'Close (Esc)'}
				onclick={() => menu.close()}>{@render closeGlyph()}</button
			>
		</header>

		<div class="body">
			{#if section === 'rotations'}
				<LibraryPlace place="planner" />
			{:else if section === 'lineups'}
				<LibraryPlace place="builder" />
			{:else if section === 'roster'}
				<RosterTab focus={library.rosterFocus} onFocused={() => (library.rosterFocus = null)} />
			{:else if section === 'settings'}
				<div class="settings"><SettingsPanel /></div>
			{:else if chapter && ChapterC}
				{#if chapter.bare}
					<ChapterC />
				{:else}
					<article class="prose chapter"><ChapterC /></article>
				{/if}
			{/if}
		</div>
	</main>
</div>

<style>
	/* ⚓ The whole screen (draft 5): the top bar sits ON the slate, above it in
	   the stack; only the night scene goes. */
	.menu {
		position: fixed;
		inset: 0;
		z-index: 9;
		display: grid;
		grid-template-columns: 15rem minmax(0, 1fr);
		padding-top: var(--chrome-h);
		background: var(--surface);
		color: var(--text);
	}

	/* ── Sidebar ── */
	.side {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 1.25rem 0.8rem 2rem;
		overflow-y: auto;
		border-right: 1px solid var(--line-faint);
	}
	.side-tools {
		display: none;
	}
	.side-group {
		margin: 1.1rem 0.6rem 0.3rem;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
	.side-group:first-of-type {
		margin-top: 0;
	}
	.side-item {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.4rem 0.6rem;
		border-radius: var(--r-sm);
		color: var(--text);
		font-size: var(--fs-lg);
		text-decoration: none;
		transition: background var(--t-snap);
	}
	.side-item:hover {
		background: var(--surface-hover);
	}
	.side-item.is-on {
		background: var(--surface-hover);
		box-shadow: inset 2px 0 0 var(--accent);
	}
	.side-kind {
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}

	/* ── Main ── */
	.main {
		min-height: 0;
		overflow-y: auto;
		padding: 1.5rem clamp(1rem, 3vw, 3rem) 4rem;
	}
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		max-width: 60rem;
		margin-bottom: 1rem;
	}
	.head-title {
		margin: 0.15rem 0 0;
		font-family: var(--font-display);
		font-size: var(--fs-3xl);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
	.head-back {
		display: none;
		margin: 0 0 0.6rem;
		padding: 0;
		border: none;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: var(--fs-md);
		cursor: pointer;
	}
	.head-back:hover {
		color: var(--text);
	}
	.head-close {
		flex: none;
		width: 2.25rem;
		height: 2.25rem;
		padding: 0;
		border: none;
		background: none;
		color: var(--chrome);
		opacity: 0.8;
		cursor: pointer;
		transition: opacity var(--t-snap);
	}
	.head-close:hover {
		opacity: 1;
	}
	.head-close svg {
		width: 100%;
		height: 100%;
		fill: currentColor;
	}
	.body {
		max-width: 60rem;
	}
	.chapter {
		max-width: 56ch;
	}
	.settings {
		max-width: 40rem;
	}

	/* ── Phone (roomy, 47.5rem — $lib/breakpoints.ts): the sidebar is the
	      index; a section shows alone ── */
	@media (max-width: 47.5rem) {
		.menu {
			grid-template-columns: minmax(0, 1fr);
		}
		.side {
			display: none;
			border-right: none;
			padding: 1rem 0.75rem 2rem;
		}
		.menu.is-index .side {
			display: flex;
		}
		.menu.is-index .main {
			display: none;
		}
		.side-tools {
			display: flex;
			flex-direction: column;
			gap: 1px;
			margin-bottom: 0.5rem;
			padding-bottom: 0.5rem;
			border-bottom: 1px solid var(--line-faint);
		}
		.side-tool-link {
			font-family: var(--font-display);
			font-size: var(--fs-xl);
			font-weight: var(--fw-semibold);
		}
		.head-back {
			display: inline-flex;
			gap: 0.3rem;
		}
		.main {
			padding: 1rem 0.75rem 3rem;
		}
	}
</style>
