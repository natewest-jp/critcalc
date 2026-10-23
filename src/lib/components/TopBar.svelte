<!--
  THE TOP BAR (profiles and surfaces design §5.1–5.2; build plan §13, phase 2b).
  Rendered instead of SiteChrome while the switch is on. Form 5 with the tabs
  gone (⚓ Nate 2026-10-21/22): three equal tool buttons, centred; the current
  one names its document and is the LIBRARY's door. Brand left, profile right.

  ↻ 2c: every door opens a section of the menu state — the current tool's
  button its Library place, ☰ the phone's index, `?` Help and About, ⚙
  Settings. ⏭ The profile picture opens the Roster until 2d's profile menu.

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
	import { chapterSection, menu as menuState, type Section } from '$lib/menuState.svelte';
	import { helpChapterForPath } from '$lib/help/areas';
	import { storageSession } from '$lib/storage/session.svelte';
	import { lineupLabel, rotationLabel } from '$lib/storage/convert';
	import { pictureOf, type ProfileRecord } from '$lib/storage/records';
	import { colourValue, pictureUrl as pictureUrlOf } from '$lib/profileLook';
	import { motion } from '$lib/motion';
	import { siteSettings } from '$lib/stores';
	import Mark from './Mark.svelte';
	import ReportLink from './ReportLink.svelte';
	import { feedbackToolForPath } from '$lib/feedback';

	// A surface with no document (the landing, a content page) still shows
	// the profile; the tools' session loads it with their documents.
	onMount(() => void storageSession.peekProfile());

	/** How long ✓ Saved stays before the status clears (§5.1: brief). 🎛️ */
	const SAVED_SHOWN_MS = 1600;

	type Menu = 'share' | 'help' | 'profile' | null;
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

	const pictureUrl = (p: ProfileRecord) =>
		pictureUrlOf(pictureOf(p), $siteSettings.useNewOutfits, p.twin);

	// ── The switch cue (design §9.4; ⚓ Nate 2026-10-22: a wash from the bar) ──
	// The new profile's colour falls from the top bar and fades; its name rides
	// below the picture and folds away with it. 🎛️ Knobs, for Nate's pass.
	/** How long the wash takes to fade out (ms). */
	const WASH_MS = 2000;
	/** How far down the screen it reaches. */
	const WASH_REACH = '38vh';
	/** Its strongest alpha, at the bar's edge (percent). */
	const WASH_PEAK = 32;

	let cue = $state<{ key: number; colour: string; name: string } | null>(null);
	$effect(() => {
		const at = storageSession.switchedAt;
		const p = storageSession.profile;
		if (!at || !p) return;
		// Reduced motion: no fade, so no flash; the ring carries the meaning.
		const ms = motion(WASH_MS);
		if (!ms) return;
		cue = { key: at, colour: colourValue(p.colour), name: p.name };
		const t = setTimeout(() => (cue = null), ms);
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
			<button class="tb-phonedoc" onclick={() => place && menuState.toggle(place)}>
				<span class="nav-label" class:is-derived={docName.derived}>{docName.text}</span>
				<Mark name="library" size={13} />
			</button>
		{/if}

		{#if documentBar.notice}<span class="tb-notice" role="status">{documentBar.notice}</span
			>{#each documentBar.barActions as action (action.label)}<button
					class="tb-notice-act"
					onclick={() => documentBar.runNoticeAction(action)}>{action.label}</button
				>{/each}{/if}

		<div class="tb-actions">
			{#if docTool}
				<div class="tb-menu-wrap">
					<button
						class="tb-glyph"
						class:is-open={menu === 'share'}
						aria-label="Share"
						title="Share"
						disabled={!canShare}
						onclick={(e) => toggle('share', e)}
						><svg viewBox="0 0 56 56" fill-rule="evenodd" aria-hidden="true"
							><path
								d="M13.773,3.631C32.373,-6.826 55.553,6.546 55.789,27.871C55.539,49.195 32.35,62.584 13.757,52.138C-4.593,41.271 -4.584,14.51 13.773,3.631ZM19.371,26.829C19.371,24.309 14.684,23.992 14.513,26.829C14.308,30.229 14.41,33.642 14.513,37.047C14.513,39.685 16.852,41.856 19.695,41.856L36.212,41.856C39.055,41.856 41.394,39.685 41.394,37.047L41.394,26.829C41.394,26.574 41.394,24.574 38.965,24.574C36.536,24.574 36.536,26.574 36.536,26.829L36.536,37.047C36.536,37.212 36.39,37.348 36.212,37.348L19.695,37.348C19.517,37.348 19.371,37.212 19.371,37.047L19.371,26.829ZM25.525,19.497L25.525,30.66C25.525,33.536 30.383,33.536 30.383,30.66L30.383,19.497L31.742,20.759C33.933,22.792 37.368,19.604 35.177,17.571L29.671,12.462C28.8,11.654 27.107,11.654 26.236,12.462L20.73,17.571C18.539,19.604 21.974,22.792 24.165,20.759L25.525,19.497Z"
							/></svg
						></button
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
			<!-- Nate's compass (assets-src/tools/navigation.svg). -->
			<button
				class="tb-glyph tb-glyph--menu"
				class:is-open={showing === 'index'}
				aria-label="Menu"
				title="Menu"
				onclick={() => menuState.toggle('index')}
			>
				<svg viewBox="0 0 53 62" fill-rule="evenodd" aria-hidden="true"
					><path
						d="M25.071,16.831L24.277,13.093C24.179,12.833 24.026,12.596 23.83,12.4C23.633,12.203 23.397,12.051 23.136,11.953L18.533,10.218L23.136,8.483C23.397,8.385 23.633,8.233 23.83,8.036C24.026,7.84 24.179,7.603 24.277,7.343L26.001,2.767C20.976,2.769 19.892,4.244 20.249,4.818C20.466,5.167 21.671,5.888 23.704,6.227L23.407,7.016C23.37,7.115 23.317,7.208 23.252,7.291C20.576,6.838 18.417,5.815 17.643,4.973C15.91,3.089 19.03,-0 26.011,0C32.992,0 36.112,3.089 34.38,4.973C33.605,5.815 31.446,6.838 28.771,7.291C28.705,7.208 28.653,7.115 28.615,7.016L28.318,6.227C30.352,5.888 31.556,5.167 31.773,4.818C32.131,4.244 31.046,2.769 26.022,2.767L27.746,7.343C27.844,7.603 27.996,7.84 28.193,8.036C28.39,8.233 28.626,8.385 28.886,8.483L33.489,10.218L28.886,11.953C28.626,12.051 28.39,12.203 28.193,12.4C27.996,12.596 27.844,12.833 27.746,13.093L26.952,16.831L28.849,21.147C26.968,22.069 24.166,23.235 21.845,24.166L25.071,16.831ZM7.706,36.077C7.829,38.517 8.431,40.831 9.418,42.928C8.078,45.404 6.523,48.214 5.152,50.671C1.916,46.335 0,40.958 0,35.137C0,23.898 7.143,14.315 17.132,10.683L22.809,12.822C22.945,12.873 23.069,12.953 23.173,13.057C23.276,13.16 23.356,13.284 23.407,13.42L24.094,16.874C14.589,17.547 7.682,25.461 7.682,35.137C7.682,34.821 7.69,34.508 7.706,34.196L15.041,30.97C14.11,33.291 12.943,36.093 12.021,37.975L7.706,36.077ZM44.34,35.137C44.34,32.302 43.748,29.618 42.67,27.223C43.995,24.778 45.522,22.019 46.87,19.602C50.106,23.938 52.023,29.315 52.023,35.137C52.023,49.493 40.367,61.148 26.011,61.148C20.19,61.148 14.813,59.231 10.477,55.996C12.934,54.625 15.744,53.07 18.219,51.729C20.317,52.717 22.631,53.318 25.071,53.442L23.173,49.127C25.054,48.204 27.857,47.038 30.177,46.107L26.952,53.442C36.32,52.968 43.842,45.445 44.317,36.077L36.982,39.303C37.913,36.982 39.079,34.18 40.001,32.298L44.317,34.196C44.333,34.508 44.34,34.821 44.34,35.137ZM34.026,18.423C32.166,17.568 30.116,17.029 27.928,16.874L28.615,13.42C28.667,13.284 28.747,13.16 28.85,13.057C28.953,12.953 29.077,12.873 29.214,12.822L34.891,10.683C37.294,11.556 39.532,12.775 41.546,14.277C39.162,15.607 36.446,17.11 34.026,18.423ZM48.831,12.317C48.831,12.317 40.978,26.18 38.445,31.254C36.589,34.973 33.633,42.759 33.633,42.759C33.633,42.759 25.848,45.714 22.128,47.571C17.055,50.104 3.191,57.956 3.191,57.956C3.191,57.956 11.044,44.093 13.577,39.019C15.434,35.3 18.389,27.514 18.389,27.514C18.389,27.514 26.175,24.559 29.894,22.703C34.968,20.17 48.831,12.317 48.831,12.317Z"
					/><path
						d="M12.021,37.975L7.706,36.077C7.69,35.765 7.682,35.452 7.682,35.137C7.682,34.821 7.69,34.508 7.706,34.196L15.041,30.97C14.11,33.291 12.943,36.093 12.021,37.975ZM21.845,24.166L25.071,16.831C25.382,16.815 25.696,16.807 26.011,16.807C26.327,16.807 26.64,16.815 26.952,16.831L28.849,21.147C26.968,22.069 24.166,23.235 21.845,24.166ZM40.001,32.298L44.317,34.196C44.333,34.508 44.34,34.821 44.34,35.137C44.34,35.452 44.333,35.765 44.317,36.077L36.982,39.303C37.913,36.982 39.079,34.18 40.001,32.298ZM30.177,46.107L26.952,53.442C26.64,53.458 26.327,53.466 26.011,53.466C25.696,53.466 25.382,53.458 25.071,53.442L23.173,49.127C25.054,48.204 27.857,47.038 30.177,46.107Z"
					/><path
						d="M34.882,26.266C34.882,26.266 31.829,31.655 30.845,33.627C30.123,35.073 28.974,38.099 28.974,38.099C28.974,38.099 25.948,39.248 24.502,39.97C22.53,40.954 17.141,44.007 17.141,44.007C17.141,44.007 20.193,38.618 21.178,36.646C21.9,35.2 23.048,32.174 23.048,32.174C23.048,32.174 26.075,31.025 27.521,30.303C29.493,29.319 34.882,26.266 34.882,26.266ZM30.999,30.149C29.899,30.752 28.854,31.314 28.191,31.645C27.117,32.181 25.197,32.947 24.208,33.333C23.822,34.322 23.056,36.242 22.52,37.316C22.189,37.979 21.627,39.024 21.024,40.124C22.124,39.521 23.169,38.959 23.832,38.628C24.906,38.092 26.825,37.326 27.814,36.94C28.201,35.951 28.966,34.031 29.503,32.957C29.834,32.294 30.396,31.249 30.999,30.149Z"
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
					<!-- Nate's disc (assets-src/tools/help.svg). -->
					<svg viewBox="0 0 56 56" fill-rule="evenodd" aria-hidden="true"
						><path
							d="M13.773,3.631C32.373,-6.826 55.553,6.546 55.789,27.871C55.539,49.195 32.35,62.584 13.757,52.138C-4.593,41.271 -4.584,14.51 13.773,3.631ZM22.783,42.552C22.783,43.58 23.169,44.486 23.949,45.266C24.724,46.04 25.707,46.432 26.904,46.432L27.024,46.432L27.675,46.359C28.524,46.352 29.341,45.976 30.111,45.206C30.874,44.443 31.256,43.562 31.265,42.565L31.282,42.482L31.29,42.405L31.29,42.287C31.29,41.149 30.87,40.212 30.035,39.474C29.207,38.744 28.298,38.384 27.313,38.384L26.815,38.384L26.735,38.391L26.509,38.432C25.486,38.441 24.604,38.869 23.87,39.727C23.138,40.582 22.783,41.447 22.783,42.311L22.783,42.552ZM18.471,16.632C18.471,17.684 18.75,18.41 19.245,18.831C19.592,19.126 20.051,19.283 20.629,19.283C21.934,19.283 23.074,18.642 24.03,17.327C24.825,16.233 25.761,15.67 26.856,15.67C27.964,15.67 28.871,15.957 29.573,16.548C30.257,17.124 30.588,17.946 30.588,19.005C30.588,20.119 30.352,21.104 29.875,21.96C29.379,22.85 28.551,23.935 27.393,25.218C26.191,26.552 25.469,27.417 25.223,27.81C24.527,28.914 24.18,30.087 24.18,31.327C24.18,32.557 24.402,33.643 24.84,34.587C25.337,35.656 25.986,36.146 26.711,36.146C28.55,36.146 29.411,35.46 29.411,34.266C29.411,32.711 29.721,31.452 30.361,30.492L30.363,30.49C30.663,30.032 31.779,28.918 33.703,27.136C36.393,24.645 37.721,22.049 37.721,19.366C37.721,16.655 36.719,14.483 34.722,12.847C32.749,11.23 30.265,10.416 27.265,10.416C24.264,10.416 21.88,11.115 20.105,12.491C19.025,13.328 18.471,14.56 18.471,16.199L18.471,16.632Z"
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
								menuState.show(chapterSection('help', helpChapterForPath(page.url.pathname)));
							}}>Help</button
						>
						<button
							class="mi"
							role="menuitem"
							onclick={() => {
								menu = null;
								menuState.show('about/about');
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

			<button
				class="tb-glyph"
				class:is-open={showing === 'settings'}
				aria-label="Settings"
				title="Settings"
				onclick={() => menuState.toggle('settings')}
			>
				<svg viewBox="0 0 42 40" fill-rule="evenodd" aria-hidden="true"
					><path
						d="M137.6 90.83q2.52 4.32 5 8.66 1.14.6 2.22 1.29 5-.03 10-.01a32 32 0 0 1 6.6 11.44l-5 8.65q.06 1.3 0 2.57 2.52 4.32 5 8.66a32 32 0 0 1-6.6 11.44l-10-.01q-1.08.7-2.22 1.28-2.48 4.34-5 8.66a32 32 0 0 1-13.2 0q-2.52-4.31-5-8.66-1.14-.59-2.22-1.28-5 .02-10 0a32 32 0 0 1-6.6-11.43q2.5-4.35 5-8.66-.06-1.28 0-2.57l-5-8.65a32 32 0 0 1 6.6-11.44h10q1.08-.7 2.22-1.28 2.48-4.34 5-8.66a32 32 0 0 1 13.2 0m-6.6 17.23a14.1 14.1 0 1 1-.01 28.19 14.1 14.1 0 0 1 .01-28.19"
						transform="rotate(30 165.68 -71.11)scale(.65574)"
					/><path
						d="M257.06 109.7a12.46 12.46 0 1 1-.01 24.91 12.46 12.46 0 0 1 .01-24.92m0 1.43a11.02 11.02 0 1 0 .01 22.05 11.02 11.02 0 0 0 0-22.05"
						fill="#000"
						fill-opacity=".15"
						transform="translate(-247.6 -107.67)scale(1.04482)"
					/></svg
				>
			</button>
		</div>

		{#if profile}
			{@const url = pictureUrl(profile)}
			<!-- ⚓ §12 Q14: Theorycraft invites an account beside its picture
			     (hidden on a phone, where the bar has no room). -->
			{#if profile.kind === 'theorycraft' && storageSession.canAddProfile}
				<button class="tb-invite" onclick={() => menuState.show('profile/new')}
					>Add your account</button
				>
			{/if}
			<div class="tb-menu-wrap">
				<button
					class="tb-profile"
					class:is-open={menu === 'profile'}
					aria-label="Profile: {profile.name}"
					aria-haspopup="menu"
					title={profile.name}
					onclick={(e) => toggle('profile', e)}
				>
					<span class="pp" style:--pp-color={colourValue(profile.colour)}>
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
									? 'Shared links open here'
									: 'Your account, in this browser'}</span
							>
						</div>
						{#each storageSession.profiles.filter((p) => p.id !== profile.id) as p (p.id)}
							{@const purl = pictureUrl(p)}
							<button
								class="mi"
								role="menuitem"
								onclick={() => {
									menu = null;
									void storageSession.switchTo(p.id);
								}}
							>
								<span class="pp pp--sm" style:--pp-color={colourValue(p.colour)}>
									{#if purl}<img src={purl} alt="" />{/if}
								</span>
								{p.name}
							</button>
						{/each}
						<button
							class="mi"
							role="menuitem"
							disabled={!storageSession.canAddProfile}
							title={storageSession.canAddProfile
								? undefined
								: 'Seven accounts, one per element colour, is the most a browser holds'}
							onclick={() => {
								menu = null;
								menuState.show('profile/new');
							}}><Mark name="plus" /> Add your account</button
						>
						<span class="pm-rule" aria-hidden="true"></span>
						{#if profile.kind === 'real'}
							<button
								class="mi"
								role="menuitem"
								onclick={() => {
									menu = null;
									menuState.show('profile');
								}}><Mark name="edit" /> Profile</button
							>
						{/if}
						<button
							class="mi"
							role="menuitem"
							onclick={() => {
								menu = null;
								menuState.show('roster');
							}}><Mark name="constellation" /> Roster</button
						>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</header>

{#if cue}
	{#key cue.key}
		<div
			class="tb-wash"
			aria-hidden="true"
			style:--wash={cue.colour}
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
	/* A notice's button (Move to a profile, §9.3): plain words on the bar,
	   underlined so they read as a thing to press. */
	.tb-notice-act {
		margin-left: -0.6rem;
		padding: 0;
		border: none;
		background: none;
		color: var(--chrome);
		font: inherit;
		font-size: var(--ui-ctl-fs);
		white-space: nowrap;
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, var(--chrome) 40%, transparent);
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.tb-notice-act:hover {
		text-decoration-color: currentColor;
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
		animation: wash-out var(--wash-ms) ease-out both;
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
		animation: wash-out var(--cue-ms) ease-in both;
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
		.tb-help,
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
		.tb-actions {
			gap: 0.1rem;
		}
		.tb-notice,
		.tb-notice-act {
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
