<!--
  THE TOP BAR (profiles and surfaces design §5.1–5.2; build plan §13, phase 2b).
  Form 5 with the tabs
  gone (⚓ Nate 2026-10-21/22): three equal tool buttons, centred; the current
  one names its document and is the LIBRARY's door. Brand left, profile right.

  ↻ 2c: every door opens a section of the menu state — the current tool's
  button its Library place, ☰ the phone's index, `?` Help and About, ⚙
  Settings. ⏭ The profile picture opens the Roster until 2d's profile menu.

  Sizes come from the interface size (app.css § THE INTERFACE SIZE).
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { keysSheet } from '$lib/keysSheet.svelte';
	import { onMount } from 'svelte';
	import { hrefTo, routeOf } from '$lib/i18n/paths';
	import { page } from '$app/state';
	import { TOOLS } from '$lib/tools';
	import { rotationTabs } from '$lib/rotationTabs.svelte';
	import { boards } from '$lib/boards.svelte';
	import { documentBar } from '$lib/documentBar.svelte';
	import { boardBar } from '$lib/boardBar.svelte';
	import { chapterSection, menu as menuState, type Section } from '$lib/menuState.svelte';
	import { helpChapterForPath } from '$lib/help/areas';
	import { storageSession } from '$lib/storage/session.svelte';
	import { lineupLabel, rotationLabel } from '$lib/storage/convert';
	import { pictureOf, type ProfileRecord } from '$lib/storage/records';
	import { colorValue, pictureUrl as pictureUrlOf } from '$lib/profileLook';
	import { motion } from '$lib/motion';
	import { siteSettings } from '$lib/stores';
	import Mark from './Mark.svelte';
	import ReportLink from './ReportLink.svelte';
	import { feedbackToolForPath } from '$lib/feedback';
	import { getLocale, htmlLang } from '$lib/i18n/locale';
	import { hrefIn, offeredLanguages, showSwitcher } from '$lib/i18n/switcher';

	// A surface with no document (the landing, a content page) still shows
	// the profile; the tools' session loads it with their documents.
	/** The switcher's links carry the query only once mounted (`hrefIn`). */
	let mounted = $state(false);
	onMount(() => {
		mounted = true;
		void storageSession.peekProfile();
	});

	/** How long ✓ Saved stays before the status clears (§5.1: brief). 🎛️ */
	const SAVED_SHOWN_MS = 1600;

	type Menu = 'help' | 'language' | 'profile' | null;
	let menu = $state<Menu>(null);

	const tool = $derived(TOOLS.find((t) => routeOf(page.url).startsWith(t.path)));
	const docTool = $derived(
		tool?.path === '/planner' ? 'planner' : tool?.path === '/builder' ? 'builder' : null
	);
	const landing = $derived(routeOf(page.url) === '/');
	const profile = $derived(storageSession.profile);
	/** ⚓ A guest (§4.6): a Theorycraft document shown in a real profile. The
	 *  button wears Theorycraft's white, and the white comes with the word. */
	const guest = $derived(docTool === 'planner' && storageSession.plannerGuest);

	/** The current document's label: its stored name, else derived (§4.2). */
	const docName = $derived.by(() => {
		if (docTool === 'planner') {
			const name = storageSession.nameOf(rotationTabs.tab.id);
			return { text: name ?? rotationLabel(rotationTabs.seats), derived: !name };
		}
		if (docTool === 'builder') {
			const name = storageSession.nameOf(boards.board.id);
			return { text: name ?? lineupLabel(boards.board), derived: !name };
		}
		return null;
	});

	// The brief status (⚓ 2026-10-21): Saving… → ✓ Saved, then it clears.
	let justSaved = $state(false);
	// ⚠ The top bar is mounted twice (off the tools and on them), and both
	// stamps outlive it on the session: a mount reads only what time is LEFT,
	// or every tool switch replays a save, and a switch, that already passed.
	const left = (at: number, ms: number) => at + ms - Date.now();
	$effect(() => {
		const at = storageSession.savedAt;
		if (!at || left(at, SAVED_SHOWN_MS) <= 0) return;
		justSaved = true;
		const t = setTimeout(() => (justSaved = false), left(at, SAVED_SHOWN_MS));
		return () => clearTimeout(t);
	});

	const pictureUrl = (p: ProfileRecord) =>
		pictureUrlOf(pictureOf(p), $siteSettings.useNewOutfits, p.twin);

	// ── The switch cue (design §9.4; ⚓ Nate 2026-10-22: a wash from the bar) ──
	// The new profile's color falls from the top bar and fades; its name rides
	// below the picture and folds away with it. 🎛️ Knobs, for Nate's pass.
	/** How long the wash takes to fade out (ms). */
	const WASH_MS = 2000;
	/** How far down the screen it reaches. */
	const WASH_REACH = '38vh';
	/** Its strongest alpha, at the bar's edge (percent). */
	const WASH_PEAK = 32;

	let cue = $state<{ key: number; color: string; name: string } | null>(null);
	$effect(() => {
		const at = storageSession.switchedAt;
		const p = storageSession.profile;
		if (!at || !p) return;
		// Reduced motion: no fade, so no flash; the ring carries the meaning.
		const ms = motion(WASH_MS);
		if (!ms || left(at, ms) <= 0) return;
		cue = { key: at, color: colorValue(p.color), name: p.name };
		const t = setTimeout(() => (cue = null), left(at, ms));
		return () => clearTimeout(t);
	});

	/** ⚓ The current tool's button TOGGLES its Library place (§6.1): from the
	 *  tool into it, and from anywhere in the menu state back onto the tool.
	 *  Another tool's is plain navigation, which the anchor already is. */
	function onTool(e: MouseEvent, path: string): void {
		menu = null;
		if (tool?.path !== path) return;
		e.preventDefault();
		if (menuState.open && menuState.section !== place) menuState.close();
		else if (place) menuState.toggle(place);
	}

	const place = $derived<Section | null>(
		docTool === 'planner' ? 'rotations' : docTool === 'builder' ? 'lineups' : null
	);
	/** Which glyph's section is showing, so it reads as open. */
	const showing = $derived(menuState.section);

	function toggle(m: Menu, e: MouseEvent): void {
		e.stopPropagation();
		menu = menu === m ? null : m;
	}

	/** Beta opens its chapter OVER the surface, as About does from the Help
	 *  menu, rather than navigating off the tool; a new-tab click keeps the
	 *  link's own address (the `openCoverage` rule). */
	function onBeta(e: MouseEvent): void {
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		e.preventDefault();
		menu = null;
		menuState.show(chapterSection('about', 'beta'));
	}

	/** A report carries the document's share link. */
	function reportShareUrl(): Promise<string | null> {
		if (docTool === 'planner') return documentBar.shareUrl();
		if (docTool === 'builder') return boardBar.shareUrl();
		return Promise.resolve(location.href);
	}
</script>

<svelte:window
	onclick={(e) => {
		if (!(e.target as Element).closest?.('.tb-menu-wrap')) menu = null;
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape') menu = null;
	}}
/>

<header class="tb">
	<!-- ── Brand ───────────────────────────────────────────────────────── -->
	<div class="tb-brand">
		<a class="tb-home" href={hrefTo('/')} aria-label={m.chrome_critcalc_app_home()}>
			<!-- The logo INLINE, not an <img>, so it can dim in the paint
			     (fill-opacity) — the chrome state contract on a bar that rides
			     the parallax at fractional x. ⚠ The path is a copy of
			     static/critcalc-logo-white.svg (`npm run build-logo`): re-copy
			     it if the mark is rebuilt. -->
			<svg
				class="tb-logo"
				viewBox="0 0 1000 600.44"
				fill-rule="evenodd"
				aria-hidden="true"
				focusable="false"
				><path
					d="M372.14,432.9C322.27,423.71 223.72,400.85 132.5,351.41C46.5,304.8 9.57,258.71 1.52,223.71C-2.94,204.31 3.23,188.54 9.42,193.77C23.02,205.25 34.36,274.38 203.46,347.11C261.21,371.95 323.88,389.88 383.65,400.44C382.52,403.61 381.34,406.91 380.12,410.35C377.5,417.76 374.83,425.31 372.14,432.9ZM396.44,359.56C353.6,350.67 306.94,335.42 261.2,311.72C230.06,295.58 187.29,263.9 177.48,234.14C176.82,232.13 175,230.27 173.66,220.27C166.89,169.66 245.63,127.07 399.13,128.66C444.54,129.13 488.07,133.71 517.64,138.1C516.03,140.44 514.43,142.75 512.83,145.04C460,142.48 370.29,139.76 305.53,162.17C241.08,184.47 247.36,218.07 247.72,221.75C249.77,242.93 274.5,266.97 295.88,279.46C312.1,288.94 329.31,299.36 369.51,311.16C369.85,311.26 370.2,311.36 370.54,311.46C378.28,316.77 398.1,332.19 397.54,350.27C397.45,353.17 397.07,356.25 396.44,359.56ZM619.91,200.92C746.07,227.56 882.48,283.33 968.77,361.74C991.49,382.38 1007.02,406.12 996.79,400.13C972.79,386.01 885.3,294.29 670.4,233.89C651.93,228.7 632.36,223.99 612.34,219.97C614.64,214.19 617.24,207.88 619.91,200.92ZM603.82,250.69C691.55,270.6 788.18,313.63 834.75,376.22C860.1,410.28 858.18,446.73 839.39,469.89C835.4,474.81 799.41,531.01 635.38,543.31C552.04,549.56 460.65,537.66 459.64,536.62C459.55,536.53 450.55,535.23 440.31,532.96C441.96,530.25 443.63,527.52 445.32,524.77C496.09,522.71 607.77,527.38 702.26,492.15C749.5,474.54 791.15,439.09 776.17,395.5C759.76,347.74 697.48,312.34 640.79,293.85C635.3,290.46 624.85,283.67 619.65,277.95C614.81,272.63 604.18,260.06 603.82,250.69ZM523.24,411.19C582.87,408.64 628.78,394.81 647.26,368.89C653.05,360.76 654.95,353.54 663.61,356.85C673.18,360.52 687.79,383.07 671.7,403.35C651.71,428.53 594.37,447.92 496.93,445.93L496.77,445.93C506.05,432.81 515.03,420.91 523.24,411.19ZM464.34,205.8C417.6,207.49 378.75,217.07 358.92,237.97C355.79,241.26 349.62,251.42 340.9,247.09C328.88,241.14 316.92,208.25 382.5,191.89C410.42,184.93 445.24,182.24 484.23,183.54C476.99,192.52 470.26,200.13 464.34,205.8ZM650.16,0C653.29,.59 559.01,196.42 557.21,254.09C555.75,300.98 650.93,327.83 649.43,330.84C647.94,333.86 544.97,322.28 504.74,359.77C453.81,407.23 358.46,601.49 353.88,600.43C349.3,599.37 445.03,404.01 446.83,346.34C448.28,299.45 353.01,272.94 354.6,269.59C356.2,266.25 456.92,279.34 496.33,242.62C547.26,195.16 647.03,-.59 650.16,0Z"
				/></svg
			>
			<span class="tb-wordmark">critcalc.app</span>
		</a>
		<a
			class="tb-beta"
			href={hrefTo('/beta')}
			title={m.chrome_what_beta_means_here()}
			onclick={onBeta}>{m.chrome_beta()}</a
		>
	</div>

	<!-- ── Three equal tool buttons, centred (form 5) ─────────────────── -->
	<!-- ↻ 2026-10-25 (⚓ Nate): not on the landing — its cards ARE the tool
	     nav (the old bar's rule: only a tool passed the switcher). -->
	<nav class="tb-nav" class:is-landing={landing} aria-label={m.chrome_tools()}>
		{#each TOOLS as t (t.path)}
			{@const current = tool?.path === t.path}
			{@const withDoc = current && !!docName}
			<a
				class="nav-btn"
				class:is-current={current}
				class:has-doc={withDoc}
				class:is-guest={current && guest}
				href={hrefTo(t.path)}
				aria-current={current ? 'page' : undefined}
				title={withDoc
					? docTool === 'planner'
						? m.chrome_your_rotations()
						: m.chrome_your_lineups()
					: undefined}
				onclick={(e) => onTool(e, t.path)}
			>
				{#if withDoc && docName}
					<span class="nav-kicker">
						<span class="nav-tool"
							>{guest ? m.chrome_tool_theorycraft({ tool: t.short }) : t.short}</span
						>
						{#if storageSession.saveFailed}
							<!-- Failure stays in the status, and the banner says why (notices §3.5). -->
							<span class="nav-status nav-status--bad"
								><Mark name="warn" size={11} />{m.chrome_not_saved()}</span
							>
						{:else if storageSession.saving}
							<span class="nav-status"
								><span class="st-dot" aria-hidden="true"></span>{m.chrome_saving()}</span
							>
						{:else if justSaved}
							<span class="nav-status"
								><Mark name="check" size={11} />{guest
									? m.chrome_saved_theorycraft()
									: m.chrome_saved()}</span
							>
						{/if}
					</span>
					<span class="nav-doc">
						<span class="nav-label" class:is-derived={docName.derived}>{docName.text}</span>
						<span class="nav-door"><Mark name="library" size={16} /></span>
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
			<button class="tb-phonedoc" onclick={() => place && menuState.toggle(place)}>
				<span class="nav-label" class:is-derived={docName.derived}>{docName.text}</span>
				<!-- The phone's save status (notices §3.5: it had none): a mark in
				     the pill, its words in its label. -->
				{#if storageSession.saveFailed}
					<span
						class="tb-phonedoc-status is-bad"
						role="img"
						aria-label={m.chrome_not_saved()}
						title={m.chrome_not_saved()}><Mark name="warn" size={12} /></span
					>
				{:else if storageSession.saving}
					<span
						class="tb-phonedoc-status"
						role="img"
						aria-label={m.chrome_saving()}
						title={m.chrome_saving()}><span class="st-dot" aria-hidden="true"></span></span
					>
				{:else if justSaved}
					<span
						class="tb-phonedoc-status"
						role="img"
						aria-label={m.chrome_saved()}
						title={m.chrome_saved()}><Mark name="check" size={12} /></span
					>
				{/if}
				<span class="tb-phonedoc-door"><Mark name="library" size={13} /></span>
			</button>
		{/if}

		<!-- ⚓ §12 Q14: Theorycraft invites an account. ↻ 2026-10-25 (⚓ Nate): it
		     stands LEFT of the picture, so on a wide bar it grows toward the
		     centre and pushes none of the doors (hidden on a phone). -->
		{#if profile?.kind === 'theorycraft'}
			<button class="tb-invite" onclick={() => menuState.show('profile/new')}
				>{m.chrome_add_a_profile()}</button
			>
		{/if}
		<div class="tb-actions">
			{#if profile}
				{@const url = pictureUrl(profile)}
				<div class="tb-menu-wrap">
					<button
						class="tb-profile"
						class:is-open={menu === 'profile'}
						aria-label={m.chrome_profile_name({ name: profile.name })}
						aria-haspopup="menu"
						title={profile.name}
						onclick={(e) => toggle('profile', e)}
					>
						<span class="pp" style:--pp-color={colorValue(profile.color)}>
							{#if url}<img src={url} alt="" />{:else}<span class="pp-fallback"
									>{profile.name[0]}</span
								>{/if}
						</span>
					</button>
					{#if cue}
						{#key cue.key}
							<span class="tb-cue-name" style:--cue-ms="{motion(WASH_MS)}ms">{cue.name}</span>
						{/key}
					{/if}
					{#if menu === 'profile'}
						<!-- The profile menu (§2.3): the switcher, Add an account, and the
						     profile's own places. -->
						<div class="tb-menu tb-menu--profile ctx-dark" role="menu">
							<div class="pm-head">
								<span class="pm-name">{profile.name}</span>
								<span class="pm-sub"
									>{profile.kind === 'theorycraft'
										? m.chrome_shared_links_open_here()
										: m.chrome_your_profile_in_this_browser()}</span
								>
							</div>
							{#each storageSession.profiles.filter((p) => p.id !== profile.id) as p (p.id)}
								{@const purl = pictureUrl(p)}
								<button
									class="mi"
									role="menuitem"
									onclick={() => {
										menu = null;
										menuState.attempt(() => void storageSession.switchTo(p.id));
									}}
								>
									<span class="pp pp--sm" style:--pp-color={colorValue(p.color)}>
										{#if purl}<img src={purl} alt="" />{/if}
									</span>
									{p.name}
								</button>
							{/each}
							<button
								class="mi"
								role="menuitem"
								onclick={() => {
									menu = null;
									menuState.show('profile/new');
								}}><Mark name="plus" /> {m.chrome_add_a_profile()}</button
							>
							<span class="pm-rule" aria-hidden="true"></span>
							{#if profile.kind === 'real'}
								<button
									class="mi"
									role="menuitem"
									onclick={() => {
										menu = null;
										menuState.show('profile');
									}}><Mark name="edit" /> {m.chrome_profile()}</button
								>
							{/if}
							<button
								class="mi"
								role="menuitem"
								onclick={() => {
									menu = null;
									menuState.show('roster');
								}}><Mark name="constellation" /> {m.chrome_roster()}</button
							>
						</div>
					{/if}
				</div>
			{/if}
			<!-- ⚓ TEAMS, one click from anywhere (Nate 2026-10-25): a team is where
			     work STARTS (Plan a rotation, Add to a lineup), as Party Setup is in
			     the game; the roster is set up once and sits behind the picture. In
			     Theorycraft the section is the invitation to make a profile. Nate's
			     art (assets-src/tools/teams.svg): the back figure is the front's white
			     under a black WASH, so it needs fill="#000" inlined (the compass's
			     fill-opacity trap). -->
			<button
				class="tb-glyph tb-glyph--teams"
				class:is-open={showing === 'teams'}
				aria-label={m.chrome_teams()}
				title={m.chrome_teams()}
				onclick={() => {
					menu = null;
					menuState.toggle('teams');
				}}
			>
				<svg viewBox="0 0 47 58" fill-rule="evenodd" aria-hidden="true"
					><path
						d="M27.734,4.795C28.876,4.019 30.254,3.564 31.737,3.564C35.672,3.564 38.867,6.759 38.867,10.694C38.867,14.628 35.672,17.823 31.737,17.823C29.41,17.823 27.342,16.705 26.04,14.978C27.444,13.101 28.275,10.772 28.275,8.25C28.275,7.045 28.085,5.884 27.734,4.795ZM30.665,19.752C31.069,19.693 31.43,19.662 31.737,19.662C35.362,19.662 46.449,24.031 46.449,25.926C46.449,26.705 44.222,28.155 42.026,29.592C40.666,37.331 34.886,53.602 31.737,53.602C30.45,53.602 28.722,50.882 27.037,47.137C29.025,41.941 30.767,36.16 31.64,31.923C33.606,30.603 35.392,29.287 36.122,28.357L36.8,27.192L37.05,25.877L36.932,24.961L36.508,23.942C36.15,23.328 35.459,22.57 34.414,21.831C33.476,21.168 32.164,20.453 30.665,19.752Z"
					/><path
						d="M27.734,4.795C28.876,4.019 30.254,3.564 31.737,3.564C35.672,3.564 38.867,6.759 38.867,10.694C38.867,14.628 35.672,17.823 31.737,17.823C29.41,17.823 27.342,16.705 26.04,14.978C27.444,13.101 28.275,10.772 28.275,8.25C28.275,7.045 28.085,5.884 27.734,4.795ZM30.665,19.752C31.069,19.693 31.43,19.662 31.737,19.662C35.362,19.662 46.449,24.031 46.449,25.926C46.449,26.705 44.222,28.155 42.026,29.592C40.666,37.331 34.886,53.602 31.737,53.602C30.45,53.602 28.722,50.882 27.037,47.137C29.025,41.941 30.767,36.16 31.64,31.923C33.606,30.603 35.392,29.287 36.122,28.357L36.8,27.192L37.05,25.877L36.932,24.961L36.508,23.942C36.15,23.328 35.459,22.57 34.414,21.831C33.476,21.168 32.164,20.453 30.665,19.752Z"
						fill="#000"
						fill-opacity="0.4"
					/><path
						d="M5.119,30.119C2.578,28.457 -0,26.779 0,25.877C-0,23.684 12.831,18.628 17.025,18.628C21.22,18.628 34.05,23.684 34.05,25.877C34.05,26.779 31.473,28.457 28.932,30.119C27.358,39.075 20.669,57.904 17.025,57.904C13.381,57.904 6.692,39.075 5.119,30.119ZM17.025,0C21.579,0 25.275,3.697 25.275,8.25C25.275,12.803 21.579,16.5 17.025,16.5C12.472,16.5 8.775,12.803 8.775,8.25C8.775,3.697 12.472,0 17.025,0Z"
					/></svg
				>
			</button>

			<!-- `?` merges Help and About and carries Report a problem (§5.1). -->
			<div class="tb-menu-wrap tb-help">
				<button
					class="tb-glyph"
					class:is-open={menu === 'help'}
					aria-label={m.chrome_help_and_about()}
					title={m.chrome_help_and_about()}
					onclick={(e) => toggle('help', e)}
				>
					<!-- Nate's disc (assets-src/tools/help.svg). -->
					<svg viewBox="0 0 56 56" fill-rule="evenodd" aria-hidden="true"
						><path
							d="M13.773,3.631C32.373,-6.826 55.553,6.546 55.789,27.871C55.539,49.195 32.35,62.584 13.757,52.138C-4.593,41.271 -4.584,14.51 13.773,3.631ZM23.473,40.717C23.473,41.612 23.809,42.4 24.488,43.078C25.162,43.752 26.018,44.093 27.059,44.093L27.164,44.093L27.729,44.029C28.469,44.023 29.179,43.696 29.85,43.026C30.513,42.362 30.846,41.595 30.854,40.728L30.868,40.656L30.875,40.589L30.875,40.487C30.875,39.496 30.51,38.681 29.783,38.039C29.063,37.403 28.272,37.09 27.415,37.09L26.981,37.09L26.912,37.096L26.715,37.132C25.825,37.14 25.058,37.512 24.419,38.259C23.782,39.003 23.473,39.755 23.473,40.508L23.473,40.717ZM19.721,18.164C19.721,19.079 19.964,19.711 20.395,20.077C20.696,20.333 21.096,20.471 21.599,20.471C22.735,20.471 23.727,19.913 24.558,18.769C25.25,17.816 26.064,17.327 27.017,17.327C27.981,17.327 28.771,17.577 29.381,18.091C29.976,18.592 30.264,19.307 30.264,20.228C30.264,21.197 30.059,22.055 29.644,22.8C29.213,23.574 28.492,24.518 27.485,25.634C26.438,26.795 25.81,27.548 25.597,27.89C24.991,28.85 24.689,29.871 24.689,30.95C24.689,32.02 24.882,32.965 25.263,33.786C25.695,34.717 26.26,35.143 26.891,35.143C28.491,35.143 29.24,34.546 29.24,33.507C29.24,32.154 29.51,31.059 30.067,30.223L30.069,30.221C30.329,29.824 31.301,28.854 32.974,27.304C35.316,25.136 36.471,22.877 36.471,20.543C36.471,18.184 35.599,16.294 33.861,14.87C32.145,13.464 29.984,12.755 27.373,12.755C24.762,12.755 22.687,13.363 21.143,14.561C20.203,15.289 19.721,16.361 19.721,17.787L19.721,18.164Z"
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
								menuState.show(chapterSection('help', helpChapterForPath(routeOf(page.url))));
							}}><Mark name="help" /> {m.chrome_help()}</button
						>
						<button
							class="mi"
							role="menuitem"
							onclick={() => {
								menu = null;
								keysSheet.open = true;
							}}><Mark name="keyboard" /> {m.chrome_keyboard_shortcuts()}</button
						>
						<button
							class="mi"
							role="menuitem"
							onclick={() => {
								menu = null;
								menuState.show('about/about');
							}}><Mark name="about" /> {m.chrome_about()}</button
						>
						<ReportLink
							class="mi"
							role="menuitem"
							prefill={{
								category: 'broken',
								tool: feedbackToolForPath(routeOf(page.url)),
								includeTech: true
							}}
							shareUrl={reportShareUrl}
							onclick={() => (menu = null)}
						>
							<Mark name="report" />
							{m.chrome_report_a_problem()}
						</ReportLink>
					</div>
				{/if}
			</div>

			<!-- The language switcher (`$lib/i18n/switcher.ts`): every offered
			     language, each a link to this page in it. Folds into Settings below
			     `roomy`, as Help folds into the index. -->
			{#if showSwitcher()}
				<div class="tb-menu-wrap tb-lang">
					<button
						class="tb-glyph tb-glyph--lang"
						class:is-open={menu === 'language'}
						aria-label={m.chrome_language()}
						title={m.chrome_language()}
						onclick={(e) => toggle('language', e)}
					>
						<!-- Nate's book (assets-src/tools/language.svg), its shade a black
						     wash (fill="#000": the fill-opacity trap). The viewBox is
						     cropped to the ink, so the box centres the book. -->
						<svg viewBox="0 0 44.154 62.455" fill-rule="evenodd" aria-hidden="true"
							><path
								d="M27.176,4.366C29.54,4.488 37.302,4.366 39.739,4.366C42.175,4.366 44.154,6.344 44.154,8.781L44.154,53.45C44.154,55.887 42.175,57.866 39.739,57.866C37.302,57.866 30.035,57.706 27.671,57.866C26.899,57.918 26.12,58.292 25.556,58.822C24.901,59.438 24.115,60.999 23.745,61.559C23.374,62.118 22.748,62.455 22.077,62.455C21.406,62.455 20.78,62.118 20.409,61.559C20.039,60.999 19.253,59.438 18.598,58.822C18.034,58.292 17.255,57.918 16.483,57.866C14.119,57.706 6.852,57.866 4.415,57.866C1.978,57.866 0,55.887 0,53.45L0,8.781C0,6.344 1.978,4.366 4.415,4.366C6.852,4.366 14.614,4.488 16.978,4.366C17.57,4.335 18.181,4.054 18.598,3.633C19.17,3.054 20.039,1.456 20.409,0.896C20.78,0.337 21.406,0 22.077,0C22.748,-0 23.374,0.337 23.745,0.896C24.115,1.456 24.984,3.054 25.556,3.633C25.973,4.054 26.584,4.335 27.176,4.366ZM26.87,43.02L34.092,43.02L34.885,45.325C35.032,45.726 35.276,46.044 35.619,46.279C35.962,46.514 36.338,46.631 36.749,46.631C37.415,46.641 37.943,46.372 38.335,45.824C38.726,45.276 38.804,44.689 38.57,44.062L33.285,29.456C33.119,29.035 32.854,28.698 32.492,28.443C32.13,28.189 31.724,28.062 31.274,28.062L29.732,28.062C29.282,28.062 28.876,28.189 28.514,28.443C28.152,28.698 27.888,29.035 27.721,29.456L22.437,44.062C22.221,44.699 22.309,45.286 22.701,45.824C23.092,46.362 23.616,46.631 24.272,46.631C24.673,46.631 25.04,46.514 25.373,46.279C25.705,46.044 25.935,45.736 26.062,45.354L26.87,43.02ZM28.074,39.497L30.466,32.554L32.859,39.497L28.074,39.497ZM17.607,35.181L21.424,39.086L22.877,35.02L20.352,32.436C21.438,31.311 22.505,29.828 23.552,27.988C24.599,26.148 25.392,24.382 25.93,22.689L27.956,22.689C28.494,22.679 28.954,22.488 29.336,22.116C29.718,21.744 29.909,21.289 29.909,20.751C29.909,20.213 29.718,19.753 29.336,19.371C28.954,18.99 28.494,18.799 27.956,18.799L19.633,18.799L19.633,17.815C19.633,17.267 19.442,16.807 19.06,16.435C18.679,16.063 18.219,15.873 17.68,15.863C17.142,15.853 16.682,16.039 16.3,16.421C15.919,16.802 15.728,17.262 15.728,17.8L15.728,18.799L7.405,18.799C6.866,18.808 6.406,18.999 6.025,19.371C5.643,19.743 5.452,20.198 5.452,20.736C5.452,21.275 5.643,21.735 6.025,22.116C6.406,22.498 6.866,22.689 7.405,22.689L21.835,22.689C21.433,23.814 20.832,25.047 20.029,26.388C19.227,27.729 18.434,28.815 17.651,29.647C17.015,28.972 16.462,28.316 15.992,27.68C15.522,27.044 15.097,26.359 14.715,25.625L10.429,25.625C10.957,26.897 11.588,28.086 12.322,29.192C13.056,30.298 13.917,31.365 14.906,32.392L9.005,38.293C8.623,38.685 8.432,39.145 8.432,39.673C8.432,40.202 8.623,40.657 9.005,41.038C9.396,41.43 9.851,41.626 10.37,41.626C10.889,41.626 11.339,41.435 11.72,41.053L17.607,35.181Z"
							/><path
								d="M17.202,55.996C14.759,55.789 5.289,55.996 5.289,55.996C3.461,55.996 1.977,54.512 1.977,52.684L1.977,9.808C1.977,7.98 3.461,6.496 5.289,6.496C5.289,6.496 14.678,6.709 17.121,6.496C18.151,6.406 19.182,5.912 19.948,5.217C20.774,4.468 22.077,2 22.077,2C22.077,2 23.38,4.468 24.206,5.217C24.972,5.912 26.003,6.406 27.033,6.496C29.476,6.709 38.865,6.496 38.865,6.496C40.693,6.496 42.177,7.98 42.177,9.808L42.177,52.684C42.177,54.512 40.693,55.996 38.865,55.996C38.865,55.996 29.395,55.789 26.952,55.996C25.951,56.081 24.947,56.56 24.206,57.238C23.394,57.981 22.077,60.455 22.077,60.455C22.077,60.455 20.76,57.981 19.948,57.238C19.206,56.56 18.203,56.081 17.202,55.996ZM27.033,54.996C29.476,55.209 38.865,54.996 38.865,54.996C40.141,54.996 41.177,53.96 41.177,52.684L41.177,9.808C41.177,8.532 40.141,7.496 38.865,7.496C38.865,7.496 29.395,7.289 26.952,7.496C25.951,7.581 24.947,8.06 24.206,8.738C23.394,9.481 22.077,11.955 22.077,11.955C22.077,11.955 20.76,9.481 19.948,8.738C19.206,8.06 18.203,7.581 17.202,7.496C14.759,7.289 5.289,7.496 5.289,7.496C4.013,7.496 2.977,8.532 2.977,9.808L2.977,52.684C2.977,53.96 4.013,54.996 5.289,54.996C5.289,54.996 14.678,55.209 17.121,54.996C18.151,54.906 19.182,54.412 19.948,53.717C20.774,52.968 22.077,50.5 22.077,50.5C22.077,50.5 23.38,52.968 24.206,53.717C24.972,54.412 26.003,54.906 27.033,54.996Z"
								fill="#000"
								fill-opacity="0.3"
							/></svg
						>
					</button>
					{#if menu === 'language'}
						<div class="tb-menu tb-menu--lang ctx-dark" role="menu">
							{#each offeredLanguages() as l (l.locale)}
								<a
									class="mi"
									role="menuitem"
									lang={htmlLang(l.locale)}
									aria-current={l.locale === getLocale() ? 'true' : undefined}
									href={hrefIn(page.url, l.locale, mounted)}
									data-sveltekit-reload
									><span class="tb-lang-tick"
										>{#if l.locale === getLocale()}<Mark name="check" />{/if}</span
									>{l.name}</a
								>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Phone: the index. ↻ 2026-10-25 (⚓ Nate): beside Settings, where Share
			     stood (tried first between the logo and the document, then between
			     the document and the picture). ↻ Same day: Share LEFT the top bar for
			     each tool's toolbar — a document verb, on the bar over the document. -->
			<!-- Nate's compass (assets-src/tools/navigation.svg). -->
			<button
				class="tb-glyph tb-glyph--menu"
				class:is-open={showing === 'index'}
				aria-label={m.chrome_menu()}
				title={m.chrome_menu()}
				onclick={() => menuState.toggle('index')}
			>
				<svg viewBox="0 0 53 62" fill-rule="evenodd" aria-hidden="true"
					><path
						d="M25.071,16.831L24.277,13.093C24.179,12.833 24.026,12.596 23.83,12.4C23.633,12.203 23.397,12.051 23.136,11.953L18.533,10.218L23.136,8.483C23.397,8.385 23.633,8.233 23.83,8.036C24.026,7.84 24.179,7.603 24.277,7.343L26.001,2.767C20.976,2.769 19.892,4.244 20.249,4.818C20.466,5.167 21.671,5.888 23.704,6.227L23.407,7.016C23.37,7.115 23.317,7.208 23.252,7.291C20.576,6.838 18.417,5.815 17.643,4.973C15.91,3.089 19.03,-0 26.011,0C32.992,0 36.112,3.089 34.38,4.973C33.605,5.815 31.446,6.838 28.771,7.291C28.705,7.208 28.653,7.115 28.615,7.016L28.318,6.227C30.352,5.888 31.556,5.167 31.773,4.818C32.131,4.244 31.046,2.769 26.022,2.767L27.746,7.343C27.844,7.603 27.996,7.84 28.193,8.036C28.39,8.233 28.626,8.385 28.886,8.483L33.489,10.218L28.886,11.953C28.626,12.051 28.39,12.203 28.193,12.4C27.996,12.596 27.844,12.833 27.746,13.093L26.952,16.831L28.849,21.147C26.968,22.069 24.166,23.235 21.845,24.166L25.071,16.831ZM7.706,36.077C7.829,38.517 8.431,40.831 9.418,42.928C8.078,45.404 6.523,48.214 5.152,50.671C1.916,46.335 0,40.958 0,35.137C0,23.898 7.143,14.315 17.132,10.683L22.809,12.822C22.945,12.873 23.069,12.953 23.173,13.057C23.276,13.16 23.356,13.284 23.407,13.42L24.094,16.874C14.589,17.547 7.682,25.461 7.682,35.137C7.682,34.821 7.69,34.508 7.706,34.196L15.041,30.97C14.11,33.291 12.943,36.093 12.021,37.975L7.706,36.077ZM44.34,35.137C44.34,32.302 43.748,29.618 42.67,27.223C43.995,24.778 45.522,22.019 46.87,19.602C50.106,23.938 52.023,29.315 52.023,35.137C52.023,49.493 40.367,61.148 26.011,61.148C20.19,61.148 14.813,59.231 10.477,55.996C12.934,54.625 15.744,53.07 18.219,51.729C20.317,52.717 22.631,53.318 25.071,53.442L23.173,49.127C25.054,48.204 27.857,47.038 30.177,46.107L26.952,53.442C36.32,52.968 43.842,45.445 44.317,36.077L36.982,39.303C37.913,36.982 39.079,34.18 40.001,32.298L44.317,34.196C44.333,34.508 44.34,34.821 44.34,35.137ZM34.026,18.423C32.166,17.568 30.116,17.029 27.928,16.874L28.615,13.42C28.667,13.284 28.747,13.16 28.85,13.057C28.953,12.953 29.077,12.873 29.214,12.822L34.891,10.683C37.294,11.556 39.532,12.775 41.546,14.277C39.162,15.607 36.446,17.11 34.026,18.423ZM48.831,12.317C48.831,12.317 40.978,26.18 38.445,31.254C36.589,34.973 33.633,42.759 33.633,42.759C33.633,42.759 25.848,45.714 22.128,47.571C17.055,50.104 3.191,57.956 3.191,57.956C3.191,57.956 11.044,44.093 13.577,39.019C15.434,35.3 18.389,27.514 18.389,27.514C18.389,27.514 26.175,24.559 29.894,22.703C34.968,20.17 48.831,12.317 48.831,12.317Z"
					/><path
						d="M12.021,37.975L7.706,36.077C7.69,35.765 7.682,35.452 7.682,35.137C7.682,34.821 7.69,34.508 7.706,34.196L15.041,30.97C14.11,33.291 12.943,36.093 12.021,37.975ZM21.845,24.166L25.071,16.831C25.382,16.815 25.696,16.807 26.011,16.807C26.327,16.807 26.64,16.815 26.952,16.831L28.849,21.147C26.968,22.069 24.166,23.235 21.845,24.166ZM40.001,32.298L44.317,34.196C44.333,34.508 44.34,34.821 44.34,35.137C44.34,35.452 44.333,35.765 44.317,36.077L36.982,39.303C37.913,36.982 39.079,34.18 40.001,32.298ZM30.177,46.107L26.952,53.442C26.64,53.458 26.327,53.466 26.011,53.466C25.696,53.466 25.382,53.458 25.071,53.442L23.173,49.127C25.054,48.204 27.857,47.038 30.177,46.107Z"
						fill="#000"
						fill-opacity="0.31"
					/><path
						d="M34.882,26.266C34.882,26.266 31.829,31.655 30.845,33.627C30.123,35.073 28.974,38.099 28.974,38.099C28.974,38.099 25.948,39.248 24.502,39.97C22.53,40.954 17.141,44.007 17.141,44.007C17.141,44.007 20.193,38.618 21.178,36.646C21.9,35.2 23.048,32.174 23.048,32.174C23.048,32.174 26.075,31.025 27.521,30.303C29.493,29.319 34.882,26.266 34.882,26.266ZM30.999,30.149C29.899,30.752 28.854,31.314 28.191,31.645C27.117,32.181 25.197,32.947 24.208,33.333C23.822,34.322 23.056,36.242 22.52,37.316C22.189,37.979 21.627,39.024 21.024,40.124C22.124,39.521 23.169,38.959 23.832,38.628C24.906,38.092 26.825,37.326 27.814,36.94C28.201,35.951 28.966,34.031 29.503,32.957C29.834,32.294 30.396,31.249 30.999,30.149Z"
						fill="#000"
						fill-opacity="0.3"
					/></svg
				>
			</button>

			<button
				class="tb-glyph"
				class:is-open={showing === 'settings'}
				aria-label={m.chrome_settings()}
				title={m.chrome_settings()}
				onclick={() => menuState.toggle('settings')}
			>
				<svg viewBox="0 0 59 56" fill-rule="evenodd" aria-hidden="true"
					><path
						d="M38.504,0C42.389,1.269 45.966,3.334 49.007,6.064C49.016,9.123 49.013,12.181 49,15.24C49.427,15.901 49.821,16.583 50.18,17.284C52.835,18.802 55.486,20.329 58.13,21.865C58.974,25.864 58.974,29.994 58.13,33.993C55.486,35.53 52.835,37.057 50.18,38.575C49.821,39.275 49.427,39.958 49,40.619C49.013,43.677 49.016,46.736 49.007,49.794C45.966,52.524 42.389,54.589 38.504,55.858C35.851,54.336 33.204,52.805 30.562,51.264C29.775,51.304 28.988,51.304 28.201,51.264C25.559,52.805 22.912,54.336 20.258,55.858C16.374,54.589 12.797,52.524 9.755,49.794C9.747,46.736 9.75,43.677 9.763,40.619C9.335,39.958 8.942,39.275 8.583,38.575C5.927,37.057 3.277,35.53 0.633,33.993C-0.211,29.994 -0.211,25.864 0.633,21.865C3.277,20.329 5.927,18.802 8.583,17.284C8.942,16.583 9.335,15.901 9.763,15.24C9.75,12.181 9.747,9.123 9.755,6.064C12.797,3.334 16.374,1.269 20.258,0C22.912,1.522 25.559,3.054 28.201,4.594C28.988,4.555 29.775,4.555 30.562,4.594C33.204,3.054 35.851,1.522 38.504,0ZM35.847,16.731C42.027,20.299 44.148,28.214 40.58,34.395C37.011,40.575 29.097,42.696 22.916,39.127C16.736,35.559 14.615,27.644 18.183,21.464C21.751,15.283 29.666,13.163 35.847,16.731Z"
					/><path
						d="M29.381,9.711C39.436,9.711 47.6,17.874 47.6,27.929C47.6,37.984 39.436,46.147 29.381,46.147C19.326,46.147 11.163,37.984 11.163,27.929C11.163,17.874 19.326,9.711 29.381,9.711ZM29.381,11.811C20.486,11.811 13.263,19.033 13.263,27.929C13.263,36.825 20.486,44.047 29.381,44.047C38.277,44.047 45.5,36.825 45.5,27.929C45.5,19.033 38.277,11.811 29.381,11.811Z"
						fill="#000"
						fill-opacity=".15"
					/></svg
				>
			</button>
		</div>
	</div>
</header>

{#if cue}
	{#key cue.key}
		<div
			class="tb-wash"
			aria-hidden="true"
			style:--wash={cue.color}
			style:--wash-ms="{motion(WASH_MS)}ms"
			style:--wash-reach={WASH_REACH}
			style:--wash-peak="{WASH_PEAK}%"
		></div>
	{/key}
{/if}

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
		padding: 0 var(--site-pad-x);
		color: var(--chrome);
		/* ⚠ The strip passes clicks through and its three children catch their
		   own: both hosts mount it in a click-transparent
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
	/* THE CHROME STATE CONTRACT (⚓ Nate 2026-08-05): every
	   chrome mark rests at 0.85 and hovers (and focus-visibles) to opaque, on
	   --t-quick. The logo and wordmark brighten together on the home link;
	   BETA brightens on its own. ⚠ The alpha is in the PAINT, never element
	   opacity: the bar rides the cursor parallax at fractional x, and WebKit
	   rasterises an opacity subtree at rounded coordinates (see .tb-glyph). */
	.tb-logo {
		height: calc(var(--brand-size) * 1.5714);
		width: auto;
		margin-top: calc(var(--brand-size) * -0.18);
		fill: var(--chrome);
		fill-opacity: 0.85;
		transition: fill-opacity var(--t-quick);
	}
	.tb-wordmark {
		font-family: var(--font-display);
		font-size: var(--brand-size);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-tight);
		color: color-mix(in srgb, var(--chrome) 85%, transparent);
		transition: color var(--t-quick);
	}
	.tb-home:hover .tb-logo,
	.tb-home:focus-visible .tb-logo {
		fill-opacity: 1;
	}
	.tb-home:hover .tb-wordmark,
	.tb-home:focus-visible .tb-wordmark {
		color: var(--chrome);
	}
	/* ↻ 2026-10-25: the tag is anchored to the WORDMARK, as the old bar had it
	   — centred with the brand, then lifted. It hung from the bar's top
	   (`--ui-bar-h / 2 − 1.05rem`) while the wordmark is centred in its
	   group, so it sat 7.2 / 11.2 / 15.1px below the word's top at Small /
	   Medium / Large and moved with the interface size. 🎛️ ⚓ NATE 2026-09-16:
	   −0.5em, his superscript lift from the old bar, carried over. */
	.tb-beta {
		position: relative;
		top: -0.5em;
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		text-decoration: none;
		color: color-mix(in srgb, var(--accent) 85%, transparent);
		transition: color var(--t-quick);
	}
	.tb-beta:hover,
	.tb-beta:focus-visible {
		color: var(--accent);
	}

	/* ── The tools ── */
	.tb-nav.is-landing {
		visibility: hidden;
	}
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
	/* Inactive tools on the night: words, no plate (⚓ 2026-10-21). ↻ 2026-10-25
	   (⚓ Nate): uppercase Plex was tried here and the Bitter word kept; the
	   CURRENT tool's kicker became Bitter instead, so the face never swaps. */
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
	/* ↻ 2026-10-25 (⚓ Nate): the current tool is its FILL alone — on is a
	   fill, never a ring — and keeps the glass rather than the gold tint. */
	.nav-btn.is-current {
		background: var(--glass-hover);
	}
	.nav-btn.has-doc {
		align-items: stretch;
	}
	/* The ring is the hand's, in the toolbar's parchment ink (--line-edge,
	   the glass ring's value — --line-strong at .30 read fainter), on the one button that does
	   something when current (it opens the Library). */
	@media (hover: hover) {
		.nav-btn.has-doc:hover {
			box-shadow: inset 0 0 0 1px var(--line-edge);
		}
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
	/* ↻ 2026-10-25 (⚓ Nate): the tool's name in small Bitter, the resting
	   word's own face (was uppercase Plex at --fs-xs). */
	.nav-tool {
		font-family: var(--font-display);
		font-size: var(--fs-md);
		font-weight: var(--fw-bold); /* ⚓ Nate 2026-10-25 */
		letter-spacing: var(--ls-tight);
		white-space: nowrap;
		color: color-mix(in srgb, var(--chrome) 50%, transparent);
	}
	.nav-status--bad {
		color: var(--ui-danger);
		font-weight: var(--fw-semibold);
	}
	.tb-phonedoc-status {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		color: color-mix(in srgb, var(--chrome) 60%, transparent);
	}
	.tb-phonedoc-status.is-bad {
		color: var(--ui-danger);
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
	/* The picture and the doors are ONE run at one gap (⚓ Nate 2026-10-25:
	   tools · picture · Teams · Share · Help · Settings). */
	.tb-actions {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}
	.tb-menu-wrap {
		position: relative;
		display: flex;
	}
	/* ══ THE DOORS ARE SIZED BY INK, NOT BOX (2026-10-25) ═════════════════
	   The old bar's rule, which this one lost in the conversion: the DISCS
	   and the cog share one height (--tb-glyph-h), and a sparse PORTRAIT mark
	   stands just under ink parity with the cog — the compass at Nate's 33
	   beside a 30 cog (⚓ 2026-09-04), the roster mark at 34. Measured as
	   luminous ink per height² (assets-src/tools, rasterised at 400px): help
	   0.71 · share 0.67 · cog 0.56 · language book 0.50 · compass 0.43 ·
	   teams 0.35. Cog parity is
	   ×1.14 for the compass and ×1.27 for teams; each takes the share of it
	   the compass took (×1.10 is 96% of 1.14), so teams is ×1.22. The book
	   stands beside Help, so its parity is the disc's: ×1.20 (√(0.71 / 0.50)).
	   It stands at the compass's height instead, ×1.10 of the disc (92% of
	   parity), because language is a door that should not call for
	   attention. The ratios
	   are knobs on the button (--ink), so every interface size keeps them. */
	.tb-right {
		--tb-glyph-h: calc(var(--ui-ctl-h) - 6px);
		/* 🎛️ ↻ 2026-10-25 (⚓ Nate): the discs, the cog and the compass read a
		   step under the picture and Teams, so they take a step up together;
		   Teams and the picture stay where they were. */
		--disc: 1.12;
	}
	.tb-glyph--menu {
		--ink: calc(1.1 * var(--disc)); /* 🎛️ ⚓ NATE 2026-09-04: 33 beside a 30 cog */
	}
	/* 🎛️ OPTICAL LIFT, ⚓ NATE 2026-09-04 → 2026-10-25: 1px up, the old bar's
	   value. The hanging loop puts ink at the top the disc doesn't balance
	   below, so a box-centred compass sits low. `position: relative` moves
	   paint by a whole pixel. */
	.tb-glyph--menu svg {
		position: relative;
		top: -1px;
	}
	.tb-glyph--teams {
		--ink: 1.22; /* 🎛️ */
	}
	.tb-glyph--lang {
		--ink: calc(1.1 * var(--disc)); /* 🎛️ the compass's height (parity measured 1.20) */
	}
	/* ══ THE DOORS ARE SPACED BY AIR, NOT BOX (2026-11-26) ══════════════════
	   Every door has the same box, so the gap between two inks was whatever
	   their shapes left: the book's flat sides crowded its neighbours while
	   Teams' narrow figures floated apart. Each door gets a side bearing
	   (--sb, in glyph heights, both sides), so every pair shows the same air,
	   in any lineup (the phone swaps Help and the book for the compass).
	   Measured as type is spaced: each side's air is the mean depth of its
	   profile across the bar's band, capped at a quarter glyph height (a
	   cog's valleys and Teams' shoulders count, but only so deep), at 8× in
	   the rendered sizes. Air per side: picture 3.1 · Help 3.0 · compass 3.0
	   · cog 4.0 · Teams 4.6 · book 5.7 (px). Equal air at the bar's mean
	   keeps the run its width. The round doors land at 0; the rest: */
	.tb-glyph--lang {
		--sb: -0.05; /* 🎛️ −1.3px a side: narrow, so its box leaves air */
	}
	.tb-glyph--teams {
		--sb: -0.13; /* 🎛️ −3.3px a side: the most open profile */
		/* 🎛️ Nate asked for more air beside the picture (2026-11-26), whose
		   ring weighs more than the model counts: −1.8px, not −3.3px. */
		--sb-l: -0.07;
	}
	.tb-glyph--menu {
		--sb: -0.04; /* 🎛️ −1px a side */
	}
	.tb-glyph {
		display: grid;
		place-items: center;
		width: calc(var(--ui-ctl-h) + 2px);
		height: calc(var(--ui-ctl-h) + 2px);
		/* Optical spacing: each door's side bearings (--sb, or --sb-l and
		   --sb-r where a side differs). */
		margin-inline: calc(var(--tb-glyph-h) * var(--sb-l, var(--sb, 0)))
			calc(var(--tb-glyph-h) * var(--sb-r, var(--sb, 0)));
		padding: 0;
		border: none;
		background: none;
		color: var(--chrome);
		cursor: pointer;
	}
	/* ⚠ Dimmed in the PAINT, never element opacity: the bar rides the cursor
	   parallax at fractional x, and WebKit rasterises an opacity subtree at
	   rounded coordinates (the ⓘ jitter; /styleguide § Laws). */
	.tb-glyph:disabled {
		cursor: default;
	}
	.tb-glyph:disabled svg {
		fill-opacity: 0.35;
	}
	.tb-glyph svg {
		height: calc(var(--tb-glyph-h) * var(--ink, var(--disc)));
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

	/* The language menu: a tick column, so the names line up whichever is
	   chosen. */
	.tb-menu--lang {
		min-width: 10rem;
	}
	.tb-lang-tick {
		display: inline-grid;
		place-items: center;
		width: 1rem;
	}

	/* ── Profile ── */
	.tb-profile {
		display: flex;
		padding: 0 0.15rem;
		border: none;
		background: none;
		cursor: pointer;
	}
	/* 🎛️ The picture is a disc among discs: 2px over their height, so with
	   its color ring it stands a ring's width proud of them (it was 6px over,
	   and outweighed every door). */
	.pp {
		display: grid;
		place-items: center;
		width: calc(var(--tb-glyph-h) + 2px);
		height: calc(var(--tb-glyph-h) + 2px);
		border-radius: 50%;
		box-shadow: 0 0 0 2px var(--pp-color); /* ↻ ⚓ Nate 2026-10-25: no dark outer ring */
		background: var(--surface);
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

	/* ── The profile menu ── */
	.tb-menu--profile {
		min-width: 15rem;
	}
	.pm-head {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: 0.45rem 0.55rem 0.55rem;
	}
	.pm-name {
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
	.pm-sub {
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.pm-rule {
		height: 1px;
		margin: 0.3rem 0.55rem;
		background: var(--line-faint);
	}
	.tb-menu :global(.mi:disabled) {
		opacity: 0.45;
		cursor: default;
	}

	/* Theorycraft's invitation (§12 Q14), quiet: a word, not a plate. */
	.tb-invite {
		padding: 0 0.2rem;
		border: none;
		background: none;
		color: color-mix(in srgb, var(--chrome) 70%, transparent);
		font: inherit;
		font-size: var(--ui-ctl-fs);
		white-space: nowrap;
		cursor: pointer;
		transition: color var(--t-snap);
	}
	.tb-invite:hover {
		color: var(--chrome);
	}

	/* ── The switch cue ── */
	.tb-wash {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: var(--wash-reach);
		z-index: -1;
		pointer-events: none;
		background: linear-gradient(
			to bottom,
			color-mix(in srgb, var(--wash) var(--wash-peak), transparent),
			transparent
		);
		animation: wash-out var(--wash-ms) linear both;
	}
	@keyframes wash-out {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}
	.tb-cue-name {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		white-space: nowrap;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--chrome);
		text-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
		pointer-events: none;
		animation: wash-out var(--cue-ms) linear both;
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
	.tb-phonedoc-door {
		display: flex;
	}
	/* TRIAL (⚓ Nate 2026-10-25): on the smallest phones the document's
	   Library mark goes, so the saved name gets its ~17px. ⚠ 22.5rem (360px)
	   is a named content stop (breakpoints.test.ts CONTENT_STOPS), not a
	   table value — promote it or drop it on Nate's call. */
	@media (max-width: 22.5rem) {
		.tb-phonedoc-door {
			display: none;
		}
	}
	/* breakpoints.ts `roomy` */
	@media (max-width: 47.5rem) {
		.tb {
			display: flex;
			gap: 0.4rem;
			/* ↻ The edges round (2026-10-25): the site gutter, not 0.75rem, so
			   the logo starts on the tools' line. At 320 the document button
			   is the flex that gives the 8px up. */
		}
		.tb-nav,
		.tb-help,
		.tb-lang,
		.tb-invite {
			display: none;
		}
		.tb-glyph--menu {
			display: grid;
		}
		.tb-right {
			flex: 1;
			gap: 0.4rem;
		}
		/* Pinned to the right edge with or without a document: on the landing
		   there is no document button to take the slack (↻ 2026-10-25). */
		.tb-actions {
			margin-left: auto;
			gap: 0.1rem;
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
