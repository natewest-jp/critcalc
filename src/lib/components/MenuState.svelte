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
	import Mark from '$lib/components/Mark.svelte';
	import {
		SECTION_GROUPS,
		itemOf,
		menu,
		profileItems,
		sectionForPath,
		type Section,
		type SectionItem
	} from '$lib/menuState.svelte';
	import { findChapter, type ChromeAreaId } from '$lib/help/areas';
	import { TOOLS } from '$lib/tools';
	import { storageSession } from '$lib/storage/session.svelte';
	import { library } from '$lib/library.svelte';
	import { documentBar } from '$lib/documentBar.svelte';
	import { boardBar } from '$lib/boardBar.svelte';
	import { sceneOccluded } from '$lib/landing/transition';
	import LibraryPlace from './LibraryPlace.svelte';
	import RosterTab from './RosterTab.svelte';
	import TeamsPlace from './TeamsPlace.svelte';
	import ProfileForm from './ProfileForm.svelte';
	import SettingsPanel from './SettingsPanel.svelte';

	const section = $derived(menu.section);
	const item = $derived(section ? itemOf(section) : undefined);
	const group = $derived(SECTION_GROUPS.find((g) => g.items.some((i) => i.id === section)));
	const profileName = $derived(storageSession.profile?.name ?? 'You');
	const groupTitle = (g: (typeof SECTION_GROUPS)[number]) => g.title ?? profileName;
	const isTheorycraft = $derived(storageSession.profile?.kind !== 'real');
	/** A real profile edits itself; Theorycraft invites an account (§2.2). */
	const itemsOf = (g: (typeof SECTION_GROUPS)[number]) =>
		g.id === 'profile' ? profileItems(isTheorycraft ? 'theorycraft' : 'real') : g.items;

	/** The tool underneath, if any (its button toggles back onto it). */
	const tool = $derived(
		menu.routed ? undefined : TOOLS.find((t) => page.url.pathname.startsWith(resolve(t.path)))
	);

	// ── Share, on a phone (⚓ Nate 2026-10-25) ─────────────────────────────
	// The top bar's Share gave its place to the index, so the index carries
	// it, first under the tools. The same actions as the bar's menu.
	const docTool = $derived(
		tool?.path === '/planner' ? 'planner' : tool?.path === '/builder' ? 'builder' : null
	);
	const canShare = $derived(docTool === 'planner' ? documentBar.hasContent : docTool === 'builder');
	const canExportChart = $derived(docTool === 'planner' && !!documentBar.exporters);
	/** Back onto the tool first: the result (a toast, a copied link) shows there. */
	function share(act: () => void): void {
		menu.close();
		act();
	}

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
		const to: Section | null = sectionForPath(a.pathname, a.search);
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

<div
	class="menu ctx-dark"
	class:is-index={section === 'index'}
	data-menu-state
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
		{#if docTool}
			<div class="side-share">
				<p class="side-group">Share</p>
				<button
					class="side-item"
					disabled={!canShare}
					onclick={() =>
						share(() => (docTool === 'planner' ? documentBar.shareLink() : boardBar.shareLink()))}
					><Mark name="link" /> Copy link</button
				>
				{#if canExportChart}
					<button class="side-item" onclick={() => share(() => documentBar.shareKqm())}
						><Mark name="copy" /> Copy KQM notation</button
					>
					<button class="side-item" onclick={() => share(() => documentBar.sharePng('copy'))}
						><Mark name="image" /> Copy timeline image</button
					>
					<button class="side-item" onclick={() => share(() => documentBar.sharePng('download'))}
						><Mark name="image" /> Download timeline image</button
					>
				{/if}
			</div>
		{/if}
		{#each SECTION_GROUPS as g (g.id)}
			<p class="side-group">{groupTitle(g)}</p>
			{#each itemsOf(g) as it (it.id)}
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
			<!-- The inspector modal's ✕ (InspectModal), one close on every slate
			     surface (Nate 2026-10-23). -->
			<button
				class="btn btn--icon head-close"
				aria-label={tool ? `Back to the ${tool.short}` : 'Close'}
				title={tool ? `Back to the ${tool.short} (Esc)` : 'Close (Esc)'}
				onclick={() => menu.close()}><Mark name="close" size={16} /></button
			>
		</header>

		<div class="body">
			{#if section === 'rotations'}
				<LibraryPlace place="planner" />
			{:else if section === 'lineups'}
				<LibraryPlace place="builder" />
			{:else if section === 'profile'}
				<ProfileForm mode="edit" />
			{:else if section === 'profile/new'}
				<ProfileForm mode="new" />
			{:else if (section === 'roster' || section === 'teams') && isTheorycraft}
				<!-- §9.1: Theorycraft has no roster and no teams; the invitation
				     stands in them. -->
				<div class="invite ctx-light">
					<h3>Add your account</h3>
					{#if section === 'roster'}
						<p>
							Theorycraft has every character at every level, so it has no roster. Add your account
							to mark what you own and set your constellations.
						</p>
					{:else}
						<p>
							Teams belong to an account. Add yours to name the teams you play and start rotations
							and lineups from them.
						</p>
					{/if}
					<button class="btn btn--primary" onclick={() => menu.show('profile/new')}
						>Add your account</button
					>
				</div>
			{:else if section === 'teams'}
				<TeamsPlace />
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
	.side-tools,
	.side-share {
		display: none;
	}
	/* Share's rows are buttons among links: the link's look, the button's reset. */
	button.side-item {
		align-items: center;
		justify-content: flex-start;
		width: 100%;
		border: none;
		background: none;
		font: inherit;
		font-size: var(--fs-lg);
		text-align: left;
		cursor: pointer;
	}
	button.side-item:disabled {
		opacity: 0.45;
		cursor: default;
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
	/* Paper as a patch (§6.4): the invitation is the one card on this page. */
	.invite {
		max-width: 30rem;
		padding: 1.1rem 1.25rem;
		border-radius: var(--r-sm);
		background: var(--surface);
		color: var(--text);
	}
	.invite h3 {
		margin: 0 0 0.4rem;
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
	}
	.invite p {
		margin: 0 0 0.9rem;
		font-size: var(--fs-md);
		line-height: 1.5;
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
		.side-share {
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
