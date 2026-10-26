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
	import { T_QUICK, motion, introLive, outroInert, scrollBehavior } from '$lib/motion';
	import Mark from '$lib/components/Mark.svelte';
	import type { MarkName } from '$lib/marks.generated';
	import { siteSettings } from '$lib/stores';
	import { pictureOf, type ProfileRecord } from '$lib/storage/records';
	import { colourValue, pictureUrl as pictureUrlOf } from '$lib/profileLook';
	import { HERO_ART } from '$lib/landing/heroArt';
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
	import { sceneOccluded } from '$lib/landing/transition';
	import LibraryPlace from './LibraryPlace.svelte';
	import NoticeBanners from './NoticeBanners.svelte';
	import { notices } from '$lib/notices.svelte';
	import RosterTab from './RosterTab.svelte';
	import TeamsPlace from './TeamsPlace.svelte';
	import ProfileForm from './ProfileForm.svelte';
	import SettingsPanel, { SETTINGS_GROUPS } from './SettingsPanel.svelte';
	import TrashPlace from './TrashPlace.svelte';
	import { trashCount } from '$lib/storage/trash';

	// ⚓ THE INDEX NEVER SHOWS ON DESKTOP (Nate 2026-10-25). On a phone the
	// index is the sidebar on its own; beside a sidebar it has nothing to say,
	// so a wide screen shows a real section in its place: the tool's own
	// Library place, else Rotations. Display only: the history entry is left
	// alone, so narrowing the window again shows the index it names.
	let narrow = $state(
		typeof window !== 'undefined' && window.matchMedia('(max-width: 47.5rem)').matches
	);
	$effect(() => {
		const mq = window.matchMedia('(max-width: 47.5rem)'); // breakpoints.ts `roomy`
		narrow = mq.matches;
		const on = () => (narrow = mq.matches);
		mq.addEventListener('change', on);
		return () => mq.removeEventListener('change', on);
	});
	const dev = import.meta.env.DEV;
	const section = $derived.by((): Section | null => {
		const s = menu.section;
		if (s !== 'index' || narrow) return s;
		return tool?.path === '/builder' ? 'lineups' : 'rotations';
	});
	const item = $derived(section ? itemOf(section) : undefined);
	const group = $derived(SECTION_GROUPS.find((g) => g.items.some((i) => i.id === section)));
	const profileName = $derived(storageSession.profile?.name ?? 'You');
	const groupTitle = (g: (typeof SECTION_GROUPS)[number]) => g.title ?? profileName;
	const isTheorycraft = $derived(storageSession.profile?.kind !== 'real');
	/** A section that FILLS the screen (2026-10-25): its own controls stay put
	 *  and only its grid scrolls — the Roster, and a team's details. */
	/** ⚓ A team's details carry no page head and no ✕ (Nate 2026-10-25): the
	 *  team's name is the title, and its Done is the one way out — two closes
	 *  on one screen were mistaken for each other. Escape still leaves. */
	const headless = $derived(!isTheorycraft && section === 'teams' && !!menu.teamDetail);
	const fills = $derived(
		!isTheorycraft && (section === 'roster' || (section === 'teams' && !!menu.teamDetail))
	);
	/** A real profile edits itself; Theorycraft invites an account (§2.2). */
	const itemsOf = (g: (typeof SECTION_GROUPS)[number]) =>
		g.id === 'profile' ? profileItems(isTheorycraft ? 'theorycraft' : 'real') : g.items;

	// ── The sidebar ─────────────────────────────────────────────────────────
	/** A line mark per item (the list register; marks.generated.ts). */
	const ICON: Partial<Record<Section, MarkName>> = {
		profile: 'profile',
		'profile/new': 'plus',
		roster: 'constellation',
		teams: 'teams',
		rotations: 'rotations',
		lineups: 'lineups',
		settings: 'settings',
		trash: 'delete'
	};
	/** Help and About FOLD to one item each and expand in place (Nate
	 *  2026-10-25): the item opens the first chapter, and the chapters show
	 *  under it while you are in that group. */
	const FOLDED: Record<string, MarkName> = { help: 'help', about: 'about' };
	const bodyGroups = SECTION_GROUPS.filter((g) => g.id !== 'profile' && g.id !== 'settings');
	const footItems = SECTION_GROUPS.find((g) => g.id === 'settings')!.items;
	const profileGroup = SECTION_GROUPS[0];

	/** How many documents each Library place holds (Nate: a count nudges a
	 *  busy library toward a tidy). */
	let counts = $state<Partial<Record<Section, number>>>({});
	$effect(() => {
		void storageSession.version;
		void storageSession.profile?.id;
		void Promise.all([
			storageSession.documents('rotation'),
			storageSession.documents('lineup'),
			storageSession.trash()
		]).then(
			([r, l, t]) =>
				(counts = { rotations: r.length, lineups: l.length, trash: trashCount(t) || undefined })
		);
	});

	// The account switcher: the sidebar's first row. It expands IN PLACE, as
	// Help does, rather than floating a menu over the list.
	let switching = $state(false);
	$effect(() => {
		void storageSession.profile?.id;
		switching = false;
	});
	const others = $derived(
		storageSession.profiles.filter((p) => p.id !== storageSession.profile?.id)
	);
	const pictureUrl = (p: ProfileRecord) =>
		pictureUrlOf(pictureOf(p), $siteSettings.useNewOutfits, p.twin);

	// The phone index's tools: the landing's own figures, cropped to their
	// rings (every figure's rings share this box on the 511 × 919 plate).
	const TILE_VIEWBOX = '28 31 457 466';
	const TILE_ART = {
		'/builder': 'astrolabe',
		'/planner': 'ephemeris',
		'/visualizers': 'observatory'
	} as const;

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
		if (c)
			void c
				.load()
				.then((m) => chapter === c && (ChapterC = m.default))
				// A chunk that won't load left a blank page under the title.
				.catch(() =>
					notices.toast('error', 'This page couldn’t load. Check your connection and try again.')
				);
	});

	let mainEl = $state<HTMLElement>();
	// A fresh section starts at its own top.
	$effect(() => {
		void section;
		if (mainEl) mainEl.scrollTop = 0;
	});

	// ── Settings' groups (2026-10-26): listed under Settings while you are
	// in it, as Help's chapters are, but they are places on ONE page, so an
	// item scrolls there and the current one follows the scroll. As with
	// Help, the heading IS the first group (Settings lights at the top of the
	// page) and only the groups after it list below.
	type SettingsGroupId = (typeof SETTINGS_GROUPS)[number]['id'];
	let settingsAt = $state<SettingsGroupId>(SETTINGS_GROUPS[0].id);
	const groupEl = (id: string) => mainEl?.querySelector<HTMLElement>(`#settings-${id}`);
	function toSettingsGroup(id: SettingsGroupId): void {
		groupEl(id)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
	}
	function spySettings(): void {
		if (!mainEl) return;
		const top = mainEl.getBoundingClientRect().top;
		let at: SettingsGroupId = SETTINGS_GROUPS[0].id;
		for (const g of SETTINGS_GROUPS) {
			const el = groupEl(g.id);
			if (el && el.getBoundingClientRect().top - top <= mainEl.clientHeight / 3) at = g.id;
		}
		// The last group may never reach the line on a tall screen: at the
		// foot of the page, the foot's group is the one you are reading.
		if (mainEl.scrollTop + mainEl.clientHeight >= mainEl.scrollHeight - 2)
			at = SETTINGS_GROUPS[SETTINGS_GROUPS.length - 1].id;
		settingsAt = at;
	}
	$effect(() => {
		if (section === 'settings') settingsAt = SETTINGS_GROUPS[0].id;
	});

	function go(e: MouseEvent, it: SectionItem): void {
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		e.preventDefault();
		if (it.id === 'settings' && section === 'settings') {
			toSettingsGroup(SETTINGS_GROUPS[0].id);
			return;
		}
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
		<!-- Phone: the tools head the index (§5.2) as three large tiles wearing
		     the landing's figures (Nate 2026-10-25: the index's first job on a
		     phone is fast access to the tools). -->
		<div class="side-tools">
			{#each TOOLS as t (t.path)}
				{@const art = HERO_ART[TILE_ART[t.path as keyof typeof TILE_ART]]}
				<a
					class="tool-tile"
					class:is-on={tool?.path === t.path}
					href={resolve(t.path)}
					aria-current={tool?.path === t.path ? 'page' : undefined}
					onclick={(e) => {
						if (tool?.path === t.path) {
							e.preventDefault();
							menu.close();
						}
					}}
				>
					<svg class="tool-tile-art" viewBox={TILE_VIEWBOX} aria-hidden="true" focusable="false">
						{#each art as layer (layer.role)}
							<path class="art art--{layer.role}" d={layer.d} />
						{/each}
					</svg>
					<span class="tool-tile-name">{t.short}</span>
				</a>
			{/each}
		</div>

		<!-- The account: a switcher row (Slack's, Linear's), then its places. -->
		{#if storageSession.profile}
			{@const p = storageSession.profile}
			{@const url = pictureUrl(p)}
			<button
				class="side-switch"
				class:is-open={switching}
				aria-expanded={switching}
				onclick={() => (switching = !switching)}
			>
				<span class="pp" style:--pp-color={colourValue(p.colour)}>
					{#if url}<img src={url} alt="" />{:else}<span class="pp-fallback">{p.name[0]}</span>{/if}
				</span>
				<span class="side-switch-name">{p.name}</span>
				<Mark name="switcher" size={16} />
			</button>
			{#if switching}
				<div class="side-switch-list">
					{#each others as o (o.id)}
						{@const ourl = pictureUrl(o)}
						<button
							class="side-item"
							onclick={() => {
								switching = false;
								menu.attempt(() => void storageSession.switchTo(o.id));
							}}
						>
							<span class="side-label">
								<span class="pp pp--sm" style:--pp-color={colourValue(o.colour)}>
									{#if ourl}<img src={ourl} alt="" />{/if}
								</span>
								{o.name}
							</span>
						</button>
					{/each}
					<button
						class="side-item"
						onclick={() => {
							switching = false;
							menu.show('profile/new');
						}}><span class="side-label"><Mark name="plus" size={18} /> Add a profile</span></button
					>
				</div>
			{/if}
		{/if}

		<!-- Section paths come resolved from menuState (SECTION_GROUPS). -->
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<div class="side-group-items">
			{#each itemsOf(profileGroup) as it (it.id)}
				{@render sideItem(it)}
			{/each}
		</div>

		{#each bodyGroups as g (g.id)}
			{#if FOLDED[g.id]}
				{@const first = g.items[0]}
				{@const inside = g.items.some((i) => i.id === section)}
				<!-- ⚓ The group's first chapter IS its heading's page (Nate
				     2026-10-25): Help opens Help & FAQ and stays selected there,
				     About opens About; only the chapters after it list below. -->
				<a
					class="side-item side-fold"
					class:is-in={inside}
					class:is-on={section === first.id}
					href={first.path}
					aria-expanded={inside}
					aria-current={section === first.id ? 'page' : undefined}
					onclick={(e) => go(e, first)}
				>
					<span class="side-label"><Mark name={FOLDED[g.id]} size={18} /> {g.title}</span>
				</a>
				{#if inside}
					<div class="side-sub">
						{#each g.items.slice(1) as it (it.id)}
							<a
								class="side-item side-subitem"
								class:is-on={section === it.id}
								href={it.path}
								aria-current={section === it.id ? 'page' : undefined}
								onclick={(e) => go(e, it)}>{it.label}</a
							>
						{/each}
					</div>
				{/if}
			{:else}
				<p class="side-group">{groupTitle(g)}</p>
				<div class="side-group-items">
					{#each itemsOf(g) as it (it.id)}
						{@render sideItem(it)}
					{/each}
				</div>
			{/if}
		{/each}

		<!-- Settings stands apart at the foot, as it does in most apps. -->
		<div class="side-foot">
			{#each footItems as it (it.id)}
				{@render sideItem(it)}
				{#if it.id === 'settings' && section === 'settings'}
					<div class="side-sub">
						{#each SETTINGS_GROUPS.slice(1) as g (g.id)}
							<button
								class="side-item side-subitem"
								class:is-on={settingsAt === g.id}
								onclick={() => toSettingsGroup(g.id)}>{g.label}</button
							>
						{/each}
					</div>
				{/if}
			{/each}
		</div>
	</nav>

	{#snippet sideItem(it: SectionItem)}
		{@const on =
			section === it.id && (it.id !== 'settings' || settingsAt === SETTINGS_GROUPS[0].id)}
		<a
			class="side-item"
			class:is-on={on}
			href={it.path}
			aria-current={section === it.id ? 'page' : undefined}
			onclick={(e) => go(e, it)}
		>
			<span class="side-label">
				{#if ICON[it.id]}<Mark name={ICON[it.id]!} size={18} />{/if}
				{it.label}
			</span>
			{#if counts[it.id] !== undefined}<span class="side-count">{counts[it.id]}</span>{/if}
		</a>
	{/snippet}

	<!-- The click handler only re-routes links inside it (keyboard activation
	     of a link is a click too). -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
	<main
		class="main"
		class:is-fill={fills}
		bind:this={mainEl}
		onclick={onMainClick}
		onscroll={section === 'settings' ? spySettings : undefined}
	>
		<!-- Conditions (notices §3.3), at the top of the content. -->
		<NoticeBanners class="menu-banners" />
		{#if !headless}
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
		{/if}

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
					<h3>Add a profile</h3>
					{#if section === 'roster'}
						<p>
							Theorycraft has every character at every level, so it has no roster. Add a profile to
							mark what you own and set your constellations.
						</p>
					{:else}
						<p>
							Teams belong to a profile. Add one to name the teams you play and start rotations and
							lineups from them.
						</p>
					{/if}
					<button class="btn btn--primary" onclick={() => menu.show('profile/new')}
						>Add a profile</button
					>
				</div>
			{:else if section === 'teams'}
				<TeamsPlace />
			{:else if section === 'roster'}
				<!-- Keyed on the profile: its undo history belongs to one roster, and
				     replayed into another it would overwrite that one. -->
				{#key storageSession.profile?.id}
					<RosterTab focus={library.rosterFocus} onFocused={() => (library.rosterFocus = null)} />
				{/key}
			{:else if section === 'settings'}
				<SettingsPanel />
			{:else if section === 'trash'}
				<TrashPlace />
			{:else if chapter && ChapterC}
				{#if chapter.bare}
					<ChapterC />
				{:else}
					<!-- THE READING LAYOUT (2026-10-25): a text column and a MARGIN
					     beside it, for what sits level with a paragraph — Help's
					     screenshots, About's notes (Nate). -->
					<div class="reading-host">
						<div class="reading">
							<article class="prose chapter"><ChapterC /></article>
							{#if dev}
								<!-- ⏳ DEV-ONLY MOCK: slate blocks standing in for the margin's
							     figures so the proportions can be judged before any exist.
							     Stripped from a build by `import.meta.env.DEV`. -->
								<aside class="margin" aria-hidden="true">
									{#each [{ top: 9, h: 11, cap: 'The composer, mid-edit' }, { top: 16, h: 8, cap: 'A buff row, hovered' }, { top: 20, h: 14, cap: 'The aura lane' }] as m (m.cap)}
										<figure class="margin-fig" style:margin-top="{m.top}rem">
											<div class="margin-shot" style:height="{m.h}rem"></div>
											<figcaption>{m.cap}</figcaption>
										</figure>
									{/each}
								</aside>
							{/if}
						</div>
					</div>
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
		/* 🎛️ 17rem: the larger list (2026-10-25) at 16px type wants the room,
		   and at 1366 it still leaves the content ~1060px. */
		grid-template-columns: 17rem minmax(0, 1fr);
		padding-top: var(--chrome-h);
		background: var(--surface);
		color: var(--text);
	}

	/* ── Sidebar ── */
	/* ⚓ THE LIST REGISTER (2026-10-25): an item is a line mark and a word;
	   a group header is SMALLER and quieter than its items, with real air
	   above it, so the eye reads groups first and items second. Hover is one
	   rung up (--surface-hover); the current item takes that fill AND the gold
	   edge — density says engaged, the hue says which. */
	.side {
		display: flex;
		flex-direction: column;
		/* ⚓ THE SITE GUTTER (Nate 2026-10-25): the items' boxes start on the
		   logo's line and the tools' left edge, as a toolbar's plates do. */
		padding: 1rem 0.75rem 1rem var(--site-pad-x);
		overflow-y: auto;
		border-right: 1px solid var(--line-faint);
	}
	.side-tools {
		display: none;
	}
	.side-group {
		margin: 1.5rem 0.7rem 0.4rem;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
	.side-group-items,
	.side-sub,
	.side-switch-list {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	/* The folded groups (Help, About) follow the Library as one block. */
	.side-group-items + .side-fold {
		margin-top: 1.1rem;
	}
	.side-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-height: 2.5rem;
		padding: 0.35rem 0.7rem;
		border: none;
		border-radius: var(--r-sm);
		background: none;
		color: var(--text);
		font: inherit;
		/* ⚓ Base UI type (2026-10-25, Nate: the list was "smaller than it needs
		   to be"), as a full-screen surface's main navigation is set. */
		font-size: var(--fs-xl);
		text-align: left;
		text-decoration: none;
		cursor: pointer;
		transition: background var(--t-snap);
	}
	.side-item:hover:not(:disabled) {
		background: var(--surface-hover);
	}
	.side-item:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.side-item.is-on {
		background: var(--surface-hover);
		box-shadow: inset 2px 0 0 var(--accent);
	}
	.side-label {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-width: 0;
	}
	.side-label :global(svg) {
		flex: none;
		color: var(--muted);
	}
	.side-item.is-on .side-label :global(svg),
	.side-fold.is-in .side-label :global(svg) {
		color: var(--text);
	}
	.side-count {
		font-size: var(--fs-md);
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}
	/* A chapter sits under its group's word, past the mark's column. */
	.side-sub {
		margin: 1px 0 0.25rem;
	}
	.side-subitem {
		padding-left: calc(0.7rem + 18px + 0.7rem);
		min-height: 2.2rem;
		font-size: var(--fs-lg);
		color: var(--muted);
	}
	.side-subitem.is-on {
		color: var(--text);
	}
	.side-foot {
		margin-top: auto;
		padding-top: 1.1rem;
	}

	/* The account switcher: a row, not a header. */
	.side-switch {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		margin-bottom: 0.5rem;
		padding: 0.45rem 0.6rem;
		border: none;
		border-radius: var(--r-sm);
		background: none;
		color: var(--text);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: background var(--t-snap);
	}
	.side-switch:hover,
	.side-switch.is-open {
		background: var(--surface-hover);
	}
	.side-switch > :global(svg) {
		flex: none;
		margin-left: auto;
		color: var(--muted);
	}
	.side-switch-name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
	}
	.side-switch-list {
		margin: -0.25rem 0 0.6rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--line-faint);
	}
	.pp {
		flex: none;
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		box-shadow: 0 0 0 2px var(--pp-color);
		background: var(--surface-raised);
		overflow: hidden;
	}
	.pp img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.pp--sm {
		width: 1.6rem;
		height: 1.6rem;
		box-shadow: 0 0 0 1.5px var(--pp-color);
	}
	.pp-fallback {
		font-weight: var(--fw-semibold);
		color: var(--pp-color);
	}

	/* The phone's tool tiles: the landing card's figure, one gold at four
	   alphas as there (+page.svelte), on a raised tile. */
	.tool-tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		padding: 0.45rem 0.3rem 0.5rem;
		border-radius: var(--r-sm);
		background: var(--surface-raised);
		color: var(--text);
		text-decoration: none;
		transition: background var(--t-snap);
	}
	.tool-tile:hover {
		background: var(--surface-hover);
	}
	.tool-tile.is-on {
		box-shadow: inset 0 0 0 1.5px var(--accent);
	}
	.tool-tile-art {
		width: 100%;
		max-width: 7rem;
		aspect-ratio: 457 / 466;
		fill-rule: evenodd;
	}
	.tool-tile-art .art {
		fill: var(--accent);
	}
	.tool-tile-art .art--outer-ring {
		fill-opacity: 0.09;
	}
	.tool-tile-art .art--middle-ring {
		fill-opacity: 0.06;
	}
	.tool-tile-art .art--inner-ring {
		fill-opacity: 0.03;
	}
	.tool-tile-name {
		font-family: var(--font-display);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
	}

	/* ── Main ── */
	.main {
		min-height: 0;
		overflow-y: auto;
		/* The far edge is the site gutter, so the content ends where a tool's
		   does; the near side is the gap off the sidebar's rule. */
		padding: 1.5rem var(--site-pad-x) 4rem clamp(1rem, 3vw, 3rem);
	}
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
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
	/* Pinned to the content area's top right, so it neither drifts to the
	   middle of a wide screen with a capped column nor scrolls away with a
	   long section. `.menu` (fixed) is its containing block. */
	.head-close {
		position: absolute;
		top: calc(var(--chrome-h) + 1.25rem);
		right: var(--site-pad-x);
		z-index: 1;
	}
	/* No cap on the body: a COLLECTION fills the width (2026-10-25), and each
	   reading or form surface carries its own measure (.chapter, .settings,
	   .invite, ProfileForm's). */
	.body {
		min-width: 0;
	}
	/* ⚓ A filling section gets the content area's HEIGHT, not just its width
	   (2026-10-25): the area scrolled as one block, so the Roster's bar and a
	   team's party strip scrolled away with the grid that was meant to scroll
	   under them. Here the area stops scrolling and hands its height down;
	   the section's own scroller takes over and ends at the screen's foot. */
	.main :global(.menu-banners) {
		position: sticky;
		top: 0;
		z-index: 3;
		flex-shrink: 0;
		margin-bottom: 1rem;
	}
	.main.is-fill {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		padding-bottom: 0;
	}
	.main.is-fill .body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	/* 🎛️ The measure: 68ch of the prose face, about 75 characters a line,
	   inside the usual 45–75 (it was 56ch, ~62). The site-wide cap on
	   `.prose p, li` (app.css) is lifted here so the column sets it once.
	   The MARGIN takes what is left up to 28rem: a screenshot of the UI has
	   to be big enough to read, so it gets the room, not the text. */
	.reading {
		display: grid;
		grid-template-columns: minmax(0, 68ch) minmax(16rem, 28rem);
		column-gap: 3rem;
		align-items: start;
	}
	.chapter {
		min-width: 0;
	}
	.chapter :global(p),
	.chapter :global(li) {
		max-width: none;
	}
	.margin {
		display: flex;
		flex-direction: column;
	}
	.margin-fig {
		margin: 0;
	}
	.margin-shot {
		border-radius: var(--r-sm);
		background: var(--surface-raised);
		box-shadow: inset 0 0 0 1px var(--line-faint);
	}
	.margin-fig figcaption {
		margin-top: 0.4rem;
		font-size: var(--fs-md);
		color: var(--muted);
	}
	/* Too narrow for both — the text's 68ch, the gap and the margin's 16rem
	   floor, ~56rem of CONTENT width — and the text takes the width, the
	   margin's figures folding in under their paragraphs (the mock just goes).
	   A container query, because the question is the content area's width,
	   which the sidebar and its padding take from the window's. */
	.reading-host {
		container-type: inline-size;
	}
	@container (max-width: 56rem) {
		.reading {
			grid-template-columns: minmax(0, 68ch);
		}
		.margin {
			display: none;
		}
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
			padding: 1rem var(--site-pad-x) 2rem;
		}
		.menu.is-index .side {
			display: flex;
		}
		.menu.is-index .main {
			display: none;
		}
		.side-tools {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 0.5rem;
			margin-bottom: 1rem;
		}
		.head-back {
			display: inline-flex;
			gap: 0.3rem;
		}
		/* ‹ Menu is the way back on a phone; the top bar's document button
		   returns to the tool. Two exits for one screen was one too many. */
		.head-close {
			display: none;
		}
		.main {
			padding: 1rem var(--site-pad-x) 3rem;
		}
		.main.is-fill {
			padding-bottom: 0;
		}
	}
</style>
