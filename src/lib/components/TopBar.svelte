<!--
  THE TOP BAR (profiles and surfaces design §5.1–5.2; build plan §13, phase 2b).
  Rendered instead of SiteChrome while the switch is on. Form 5 with the tabs
  gone (⚓ Nate 2026-10-21/22): three equal tool buttons, centred; the current
  one names its document and is the LIBRARY's door. Brand left, profile right.

  ⏭ Stand-ins until the steps that own them: the Library door opens today's
  overlay (2c), the profile picture opens the Roster (2d's profile menu), ☰
  opens today's compass (2c's index).

  Sizes come from the interface size (app.css § THE INTERFACE SIZE).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { TOOLS } from '$lib/tools';
	import { rotationTabs } from '$lib/rotationTabs.svelte';
	import { boards } from '$lib/boards.svelte';
	import { documentBar } from '$lib/documentBar.svelte';
	import { boardBar } from '$lib/boardBar.svelte';
	import { library } from '$lib/library.svelte';
	import { openArea, openNav, openSettings, roster } from './chromeModal.svelte';
	import { helpChapterForPath } from '$lib/help/areas';
	import { storageSession } from '$lib/storage/session.svelte';
	import { lineupLabel, rotationLabel } from '$lib/storage/convert';
	import { pictureOf, type Picture, type ProfileColour } from '$lib/storage/records';
	import { PROFILE_PICTURES, THEORYCRAFT_PICTURE } from '$lib/profilePictures.generated';
	import { getAvatar } from '$lib/utils/getAvatar';
	import { siteSettings } from '$lib/stores';
	import Mark from './Mark.svelte';
	import ReportLink from './ReportLink.svelte';
	import { MARK_NODES } from '$lib/marks.generated';
	import { feedbackToolForPath } from '$lib/feedback';

	/** Per-instance mask ids (an inlined SVG's ids are global to the page). */
	const uid = $props.id();

	// A surface with no document (the landing, a content page) still shows
	// the profile; the tools' session loads it with their documents.
	onMount(() => void storageSession.peekProfile());

	/** How long ✓ Saved stays before the status clears (§5.1: brief). 🎛️ */
	const SAVED_SHOWN_MS = 1600;

	type Menu = 'share' | 'help' | null;
	let menu = $state<Menu>(null);

	const tool = $derived(TOOLS.find((t) => page.url.pathname.startsWith(resolve(t.path))));
	const docTool = $derived(
		tool?.path === '/planner' ? 'planner' : tool?.path === '/builder' ? 'builder' : null
	);
	const profile = $derived(storageSession.profile);
	const guest = $derived(false); // ⏭ 2d: a Theorycraft document shown in a real profile

	/** The current document's label: its stored name, else derived (§4.2). */
	const docName = $derived.by(() => {
		if (docTool === 'planner') {
			const name = storageSession.nameOf(rotationTabs.activeTabId);
			return { text: name ?? rotationLabel(rotationTabs.seats), derived: !name };
		}
		if (docTool === 'builder') {
			const name = storageSession.nameOf(boards.activeBoardId);
			return { text: name ?? lineupLabel(boards.activeBoard), derived: !name };
		}
		return null;
	});

	// The brief status (⚓ 2026-10-21): Saving… → ✓ Saved, then it clears.
	let justSaved = $state(false);
	$effect(() => {
		if (!storageSession.savedAt) return;
		justSaved = true;
		const t = setTimeout(() => (justSaved = false), SAVED_SHOWN_MS);
		return () => clearTimeout(t);
	});

	const COLOUR: Record<ProfileColour, string> = {
		pyro: 'var(--el-pyro-main)',
		hydro: 'var(--el-hydro-main)',
		anemo: 'var(--el-anemo-main)',
		electro: 'var(--el-electro-main)',
		dendro: 'var(--el-dendro-main)',
		cryo: 'var(--el-cryo-main)',
		geo: 'var(--el-geo-main)',
		theorycraft: 'var(--profile-theorycraft)'
	};

	function pictureUrl(p: Picture): string | null {
		if (p.kind === 'character') {
			return getAvatar(p.id, $siteSettings.useNewOutfits, 'circle', profile?.twin ?? 'aether');
		}
		if (p.name === THEORYCRAFT_PICTURE.id) return THEORYCRAFT_PICTURE.url;
		return PROFILE_PICTURES.find((x) => x.id === p.name)?.url ?? null;
	}

	/** ⚓ The current tool's button is the Library's door (§5.1); another
	 *  tool's is plain navigation, which the anchor already is. */
	function onTool(e: MouseEvent, path: string): void {
		menu = null;
		if (tool?.path !== path) return;
		e.preventDefault();
		if (docTool) library.show(docTool);
	}

	function toggle(m: Menu, e: MouseEvent): void {
		e.stopPropagation();
		menu = menu === m ? null : m;
	}

	const canShare = $derived(docTool === 'planner' ? documentBar.hasContent : docTool === 'builder');
	/** A report carries the document's share link, as band A's ⋯ did. */
	function reportShareUrl(): Promise<string | null> {
		if (docTool === 'planner') return documentBar.shareUrl();
		if (docTool === 'builder') return boardBar.shareUrl();
		return Promise.resolve(location.href);
	}

	const canExportChart = $derived(docTool === 'planner' && !!documentBar.exporters);
</script>

<svelte:window
	onclick={(e) => {
		if (!(e.target as Element).closest?.('.tb-menu-wrap')) menu = null;
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape') menu = null;
	}}
/>

{#snippet disc(name: 'share')}
	<svg viewBox="0 0 24 24" aria-hidden="true">
		<defs>
			<mask id="{uid}-{name}" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
				<circle cx="12" cy="12" r="11.5" fill="#fff" />
				<g
					transform="translate(12 12) scale(0.52) translate(-12 -12)"
					fill="none"
					stroke="#000"
					stroke-width="2.6"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					{#each MARK_NODES[name] as [tag, attrs], i (i)}
						<svelte:element this={tag} {...attrs} />
					{/each}
				</g>
			</mask>
		</defs>
		<circle cx="12" cy="12" r="11.5" mask="url(#{uid}-{name})" />
	</svg>
{/snippet}

<header class="tb">
	<!-- ── Brand ───────────────────────────────────────────────────────── -->
	<div class="tb-brand">
		<a class="tb-home" href={resolve('/')} aria-label="critcalc.app home">
			<img class="tb-logo" src="/critcalc-logo-white.svg" alt="" />
			<span class="tb-wordmark">critcalc.app</span>
		</a>
		<a class="tb-beta" href={resolve('/beta')} title="What beta means here">Beta</a>
	</div>

	<!-- ── Three equal tool buttons, centred (form 5) ─────────────────── -->
	<nav class="tb-nav" aria-label="Tools">
		{#each TOOLS as t (t.path)}
			{@const current = tool?.path === t.path}
			{@const withDoc = current && !!docName}
			<a
				class="nav-btn"
				class:is-current={current}
				class:has-doc={withDoc}
				class:is-guest={current && guest}
				href={resolve(t.path)}
				aria-current={current ? 'page' : undefined}
				title={withDoc ? `Your ${docTool === 'planner' ? 'rotations' : 'lineups'}` : undefined}
				onclick={(e) => onTool(e, t.path)}
			>
				{#if withDoc && docName}
					<span class="nav-kicker">
						<span class="nav-tool">{t.short}</span>
						{#if storageSession.saving}
							<span class="nav-status"><span class="st-dot" aria-hidden="true"></span>Saving…</span>
						{:else if justSaved}
							<span class="nav-status"><Mark name="check" size={11} />Saved</span>
						{/if}
					</span>
					<span class="nav-doc">
						<span class="nav-label" class:is-derived={docName.derived}>{docName.text}</span>
						<span class="nav-door"><Mark name="library" size={14} /></span>
					</span>
				{:else}
					<span class="nav-name">{t.short}</span>
				{/if}
			</a>
		{/each}
	</nav>

	<!-- ── Actions › profile ───────────────────────────────────────────── -->
	<div class="tb-right">
		<!-- Phone (§5.2): the document, opening the Library like the desktop button. -->
		{#if docTool && docName}
			<button class="tb-phonedoc" onclick={() => library.show(docTool)}>
				<span class="nav-label" class:is-derived={docName.derived}>{docName.text}</span>
				<Mark name="library" size={13} />
			</button>
		{/if}

		{#if documentBar.notice}<span class="tb-notice" role="status">{documentBar.notice}</span>{/if}

		<div class="tb-actions">
			{#if docTool}
				<div class="tb-menu-wrap">
					<button
						class="tb-glyph"
						class:is-open={menu === 'share'}
						aria-label="Share"
						title="Share"
						disabled={!canShare}
						onclick={(e) => toggle('share', e)}>{@render disc('share')}</button
					>
					{#if menu === 'share'}
						<div class="tb-menu ctx-dark" role="menu">
							<button
								class="mi"
								role="menuitem"
								onclick={() => {
									menu = null;
									if (docTool === 'planner') documentBar.shareLink();
									else boardBar.shareLink();
								}}><Mark name="link" /> Copy link</button
							>
							{#if canExportChart}
								<button
									class="mi"
									role="menuitem"
									onclick={() => {
										menu = null;
										documentBar.shareKqm();
									}}><Mark name="copy" /> Copy KQM notation</button
								>
								<button
									class="mi"
									role="menuitem"
									onclick={() => {
										menu = null;
										documentBar.sharePng('copy');
									}}><Mark name="image" /> Copy timeline image</button
								>
								<button
									class="mi"
									role="menuitem"
									onclick={() => {
										menu = null;
										documentBar.sharePng('download');
									}}><Mark name="image" /> Download timeline image</button
								>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Phone: the index (⏭ 2c's menu state; today's compass for now). -->
			<button class="tb-glyph tb-glyph--menu" aria-label="Menu" title="Menu" onclick={openNav}>
				<svg viewBox="0 0 24 24" aria-hidden="true"
					><path
						d="M4 6.5h16M4 12h16M4 17.5h16"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						fill="none"
					/></svg
				>
			</button>

			<!-- `?` merges Help and About and carries Report a problem (§5.1). -->
			<div class="tb-menu-wrap tb-help">
				<button
					class="tb-glyph"
					class:is-open={menu === 'help'}
					aria-label="Help and About"
					title="Help and About"
					onclick={(e) => toggle('help', e)}
				>
					<svg viewBox="0 0 40 40" fill-rule="evenodd" aria-hidden="true"
						><path
							d="M241.24 88.27a20.87 20.87 0 0 1 0 41.72 20.87 20.87 0 0 1 0-41.72m-2.73 28.11q0 .8.6 1.4t1.51.6h.07l.33-.04q.66 0 1.25-.6.6-.59.6-1.35v-.14q0-.88-.64-1.45-.63-.56-1.4-.56h-.29l-.12.03q-.79 0-1.35.66t-.56 1.33zm-2.22-13.3q.01.8.4 1.12.26.24.71.24 1.01 0 1.75-1 .6-.86 1.45-.86t1.4.45q.52.45.52 1.26 0 .86-.37 1.52a10 10 0 0 1-1.28 1.67q-.92 1.03-1.1 1.33a3.3 3.3 0 0 0-.54 1.8q0 .96.34 1.68.38.81.96.8c.94 0 1.38-.35 1.38-.96q0-1.2.49-1.94.23-.35 1.72-1.72 2.06-1.92 2.06-4t-1.54-3.34a5.8 5.8 0 0 0-3.83-1.25q-2.31 0-3.68 1.07-.83.64-.84 1.9z"
							transform="translate(-211.3 -84.63)scale(.9588)"
						/></svg
					>
				</button>
				{#if menu === 'help'}
					<div class="tb-menu ctx-dark" role="menu">
						<button
							class="mi"
							role="menuitem"
							onclick={() => {
								menu = null;
								openArea('help', helpChapterForPath(page.url.pathname));
							}}>Help</button
						>
						<button
							class="mi"
							role="menuitem"
							onclick={() => {
								menu = null;
								openArea('about', 'about');
							}}>About</button
						>
						<ReportLink
							class="mi"
							role="menuitem"
							prefill={{
								category: 'broken',
								tool: feedbackToolForPath(page.url.pathname),
								includeTech: true
							}}
							shareUrl={reportShareUrl}
							onclick={() => (menu = null)}
						>
							<Mark name="report" /> Report a problem
						</ReportLink>
					</div>
				{/if}
			</div>

			<button class="tb-glyph" aria-label="Settings" title="Settings" onclick={openSettings}>
				<svg viewBox="0 0 42 40" fill-rule="evenodd" aria-hidden="true"
					><path
						d="M137.6 90.83q2.52 4.32 5 8.66 1.14.6 2.22 1.29 5-.03 10-.01a32 32 0 0 1 6.6 11.44l-5 8.65q.06 1.3 0 2.57 2.52 4.32 5 8.66a32 32 0 0 1-6.6 11.44l-10-.01q-1.08.7-2.22 1.28-2.48 4.34-5 8.66a32 32 0 0 1-13.2 0q-2.52-4.31-5-8.66-1.14-.59-2.22-1.28-5 .02-10 0a32 32 0 0 1-6.6-11.43q2.5-4.35 5-8.66-.06-1.28 0-2.57l-5-8.65a32 32 0 0 1 6.6-11.44h10q1.08-.7 2.22-1.28 2.48-4.34 5-8.66a32 32 0 0 1 13.2 0m-6.6 17.23a14.1 14.1 0 1 1-.01 28.19 14.1 14.1 0 0 1 .01-28.19"
						transform="rotate(30 165.68 -71.11)scale(.65574)"
					/></svg
				>
			</button>
		</div>

		{#if profile}
			{@const url = pictureUrl(pictureOf(profile))}
			<button
				class="tb-profile"
				aria-label="Profile: {profile.name}"
				title={profile.name}
				onclick={() => roster.open()}
			>
				<span class="pp" style:--pp-color={COLOUR[profile.colour]}>
					{#if url}<img src={url} alt="" />{:else}<span class="pp-fallback">{profile.name[0]}</span
						>{/if}
				</span>
			</button>
		{/if}
	</div>
</header>

<style>
	.tb {
		position: relative;
		height: var(--ui-bar-h);
		display: grid;
		/* ⚓ The flanks never shrink below their content; the CENTRE gives way,
		   and its three buttons shrink together so they stay equal. ⚠ Each child
		   names its own grid-column (the compass round's auto-placement trap). */
		grid-template-columns: minmax(max-content, 1fr) minmax(0, max-content) minmax(max-content, 1fr);
		align-items: center;
		gap: 1.1rem;
		padding: 0 clamp(1rem, 2vw, 2rem);
		color: var(--chrome);
		/* ⚠ The strip passes clicks through and its three children catch their
		   own (SiteChrome's contract): both hosts mount it in a click-transparent
		   wrapper, so without the `auto` below NOTHING in the bar is clickable. */
		pointer-events: none;
	}
	.tb-brand,
	.tb-nav,
	.tb-right {
		pointer-events: auto;
	}

	/* ── Brand ── */
	.tb-brand {
		grid-column: 1;
		justify-self: start;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		--brand-size: var(--fs-3xl);
	}
	.tb-home {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		color: inherit;
		text-decoration: none;
	}
	.tb-logo {
		height: calc(var(--brand-size) * 1.5714);
		margin-top: calc(var(--brand-size) * -0.18);
		opacity: 0.85;
	}
	.tb-wordmark {
		font-family: var(--font-display);
		font-size: var(--brand-size);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-tight);
		opacity: 0.85;
	}
	.tb-beta {
		align-self: flex-start;
		margin-top: calc(var(--ui-bar-h) / 2 - 1.05rem);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		text-decoration: none;
		color: var(--accent);
		opacity: 0.85;
	}

	/* ── The tools ── */
	.tb-nav {
		grid-column: 2;
		display: flex;
		gap: 6px;
		min-width: 0;
		/* 🎛️ One button's width at rest. */
		--nav-w: 13.5rem;
		width: calc(3 * var(--nav-w) + 12px);
		max-width: 100%;
	}
	.nav-btn {
		flex: 0 1 var(--nav-w);
		min-width: 8.5rem;
		height: calc(var(--ui-bar-h) - 12px);
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 1px;
		padding: 0 0.75rem;
		border-radius: var(--r-sm);
		color: var(--chrome);
		text-decoration: none;
		transition:
			background var(--t-snap),
			box-shadow var(--t-snap);
	}
	/* Inactive tools on the night: words, no plate (⚓ 2026-10-21). */
	.nav-name {
		font-family: var(--font-display);
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: color-mix(in srgb, var(--chrome) 70%, transparent);
		transition: color var(--t-snap);
	}
	.nav-btn:hover .nav-name,
	.nav-btn.is-current .nav-name {
		color: var(--chrome);
	}
	.nav-btn.is-current {
		background: var(--glass-hover);
		box-shadow: inset 0 0 0 1px var(--sel-ring);
	}
	.nav-btn.has-doc {
		align-items: stretch;
	}
	.nav-btn.has-doc:hover {
		background: var(--glass-hover);
		box-shadow: inset 0 0 0 1px var(--sel-ring);
	}
	/* The guest (§4.6): Theorycraft's white, which no real profile can wear. */
	.nav-btn.is-guest {
		box-shadow: inset 0 0 0 1.5px var(--profile-theorycraft);
	}
	.nav-kicker {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-width: 0;
		line-height: 1.2;
	}
	.nav-tool {
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		white-space: nowrap;
		color: color-mix(in srgb, var(--chrome) 50%, transparent);
	}
	.nav-status {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--fs-xs);
		white-space: nowrap;
		color: color-mix(in srgb, var(--chrome) 55%, transparent);
		animation: brief-in var(--t-quick) both;
	}
	@keyframes brief-in {
		from {
			opacity: 0;
		}
	}
	.st-dot {
		width: 6px;
		height: 6px;
		margin: 0 2px;
		border-radius: 50%;
		background: currentColor;
		animation: st-pulse 0.9s ease-in-out infinite;
	}
	@keyframes st-pulse {
		50% {
			opacity: 0.3;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.st-dot {
			animation: none;
		}
	}
	.nav-doc {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		min-width: 0;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		line-height: 1.25;
	}
	.nav-label {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* A derived label is a placeholder: the name is not set (§4.2). */
	.is-derived {
		color: color-mix(in srgb, currentColor 60%, transparent);
	}
	.nav-door {
		display: inline-flex;
		flex: none;
		opacity: 0.5;
		transition: opacity var(--t-snap);
	}
	.nav-btn:hover .nav-door {
		opacity: 0.95;
	}

	/* ── Right flank ── */
	.tb-right {
		grid-column: 3;
		justify-self: end;
		display: flex;
		align-items: center;
		gap: 1.1rem;
		min-width: 0;
	}
	.tb-notice {
		font-size: var(--ui-ctl-fs);
		white-space: nowrap;
		color: color-mix(in srgb, var(--chrome) 75%, transparent);
	}
	.tb-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.tb-menu-wrap {
		position: relative;
		display: flex;
	}
	.tb-glyph {
		display: grid;
		place-items: center;
		width: calc(var(--ui-ctl-h) + 2px);
		height: calc(var(--ui-ctl-h) + 2px);
		padding: 0;
		border: none;
		background: none;
		color: var(--chrome);
		cursor: pointer;
	}
	.tb-glyph:disabled {
		cursor: default;
		opacity: 0.4;
	}
	.tb-glyph svg {
		height: calc(var(--ui-ctl-h) - 6px);
		width: auto;
		fill: currentColor;
		fill-opacity: 0.85;
		transition: fill-opacity var(--t-snap);
	}
	.tb-glyph:hover:not(:disabled) svg,
	.tb-glyph.is-open svg {
		fill-opacity: 1;
	}
	.tb-glyph--menu {
		display: none;
	}
	.tb-glyph--menu svg {
		height: calc(var(--ui-ctl-h) - 8px);
	}

	.tb-menu {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 10;
		min-width: 13rem;
		padding: 0.35rem;
		border-radius: var(--r-sm);
		background: var(--surface);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.4);
		display: flex;
		flex-direction: column;
	}
	.tb-menu :global(.mi) {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.45rem 0.55rem;
		border: none;
		border-radius: var(--r-sm);
		background: none;
		color: var(--text);
		font: inherit;
		font-size: var(--fs-lg);
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.tb-menu :global(.mi:hover) {
		background: var(--surface-hover);
	}

	/* ── Profile ── */
	.tb-profile {
		display: flex;
		padding: 0 0.15rem;
		border: none;
		background: none;
		cursor: pointer;
	}
	.pp {
		display: grid;
		place-items: center;
		width: calc(var(--ui-ctl-h) - 2px);
		height: calc(var(--ui-ctl-h) - 2px);
		border-radius: 50%;
		box-shadow:
			0 0 0 2px var(--pp-color),
			0 0 0 3.5px rgb(0 0 0 / 0.35);
		background: var(--surface);
		overflow: hidden;
	}
	.pp img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.pp-fallback {
		font-weight: var(--fw-semibold);
		color: var(--pp-color);
	}

	/* ── Phone form (design §5.2) ── */
	.tb-phonedoc {
		display: none;
	}
	/* breakpoints.test.ts named stop: the centre's three buttons need ~26rem at
	   their floor, so the wordmark and its tag give way first. */
	@media (max-width: 75rem) {
		.tb-wordmark,
		.tb-beta {
			display: none;
		}
	}
	/* breakpoints.ts `roomy` */
	@media (max-width: 47.5rem) {
		.tb {
			display: flex;
			gap: 0.4rem;
			padding: 0 0.75rem;
		}
		.tb-nav,
		.tb-help {
			display: none;
		}
		.tb-glyph--menu {
			display: grid;
		}
		.tb-right {
			flex: 1;
			gap: 0.4rem;
		}
		.tb-actions {
			gap: 0.1rem;
		}
		.tb-notice {
			display: none;
		}
		.tb-phonedoc {
			display: flex;
			align-items: center;
			gap: 0.4rem;
			flex: 1 1 auto;
			min-width: 0;
			height: var(--ui-ctl-h);
			margin-right: auto;
			padding: 0 0.6rem;
			border: none;
			border-radius: var(--r-sm);
			background: var(--glass-panel);
			color: var(--chrome);
			font-size: calc(var(--ui-ctl-fs) + 1px);
			font-weight: var(--fw-semibold);
			cursor: pointer;
		}
	}
</style>
