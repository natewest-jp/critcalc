<!--
  THE RETURNING-VISITOR DIALOG (flip-readiness §1 item 4): said once, to a
  browser that used the site before the redesign. A clone of LinksDialog
  rather than `notices.ask`, because `ask`'s body is one plain string; it is
  informational, so it has one answer, not ask's confirm/cancel pair. It must
  be answered to go (the backdrop does not dismiss), and while it is open it
  holds the migration toast and the links dialog (`flipNotice.svelte.ts`).

  ⚓ A CLICK-THROUGH (Nate 2026-10-27, Genshin's "new feature" language): one
  page per change, each with a looping clip Nate records. The lead-in sits
  under the title, above the clip, on every page (⚓ Nate 2026-10-27): only
  on the first, the clip box would move between pages.
  - Every page is rendered at once, stacked in one grid cell, so the dialog
    takes the TALLEST page's height and nothing jumps under the Next button.
  - Clips are 4:3 (1024×768, 2× a 512px box). Only a page you have reached,
    and the one after it, has a `src`: the dialog shows once, so nobody pays
    for clips they never get to.
  - Reduced motion shows each clip's still instead (`.webp`, a frame of it).
  - ⚓ PHONES get ONE screen with the list and no media: a desktop clip shows
    a layout a phone does not have, and without media a click-through is just
    four short pages to tap past. Also used on a short (landscape phone) view.

  Dev: `?flipNotice` on any page shows it without touching the stored flag.

  Copy: Nate's draft, given its pass 2026-10-27 once the shape settled (read
  docs/text/style-guide.md + glossary.md before changing it). Each sentence
  is true on a phone too, since the phone list reuses them: the document's
  NAME opens the Library in both top bars, and Teams' two figures are in both.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import { belowQuery, SHORT_QUERY } from '$lib/breakpoints';
	import { dismissFlipNotice } from '$lib/flipNotice.svelte';
	import { menu } from '$lib/menuState.svelte';

	type Page = { title: string; body: string; clip: string };

	/** The lead-in, under the title on every page (and above the phone's list). */
	const LEAD =
		'Everything you had is still here. Your roster, rotations, and lineups are now in a profile called My profile, and a few things work differently.';

	/** `clip` names a pair in static/assets/whats-new: `<clip>.mp4` (x264 from
	 *  Nate's ProRes master, kept in the gitignored assets-src/whats-new) and
	 *  its still `<clip>.webp`. ⚠ /assets is immutable: a new cut ships as -v2. */
	const PAGES: Page[] = [
		{
			title: 'No more Save buttons',
			body: 'Your work saves itself as you go. The top bar shows every time it saves.',
			clip: 'flip-save-v1'
		},
		{
			title: 'No more tabs',
			body: 'Each tool holds one rotation or lineup at a time. Its name in the top bar opens the full Library.',
			clip: 'flip-notabs-v1'
		},
		{
			title: 'Set up teams ahead of time',
			body: 'Teams, the two figures in the top bar, lets you make team presets, like Genshin’s Party Setup.',
			clip: 'flip-teams-v1'
		},
		{
			title: 'Shared links open in Theorycraft',
			body: 'Theorycraft is a built-in profile with no roster. It’s the place to explore ideas that don’t fit your profiles. Shared links open there so your own profiles stay as you left them.',
			clip: 'flip-theorycraft-v1'
		}
	];
	const LAST = PAGES.length - 1;

	let page = $state(0);
	/** The furthest page reached: its clip and the next one's may load. */
	let reached = $state(0);

	/** Decided at mount and held: the dialog is short-lived, and a form that
	 *  swapped under a resize would lose the reader's page. SSR and the first
	 *  paint take the desktop form (the dialog is client-raised anyway). */
	let phone = $state(false);
	let still = $state(false);
	onMount(() => {
		phone =
			window.matchMedia(belowQuery('compact')).matches || window.matchMedia(SHORT_QUERY).matches;
		still = motion(1) === 0;
	});

	const videos: (HTMLVideoElement | undefined)[] = [];
	$effect(() => {
		const at = page;
		videos.forEach((v, i) => {
			if (!v) return;
			if (i === at) {
				v.currentTime = 0;
				void v.play().catch(() => {});
			} else v.pause();
		});
	});

	function go(to: number): void {
		page = Math.max(0, Math.min(LAST, to));
		reached = Math.max(reached, page);
	}

	function close(whatsNew = false): void {
		dismissFlipNotice();
		if (whatsNew) menu.show('about/changelog');
	}

	function primary(): void {
		if (phone || page === LAST) close();
		else go(page + 1);
	}

	let okEl = $state<HTMLButtonElement | undefined>();
	$effect(() => okEl?.focus());

	function onKey(e: KeyboardEvent): void {
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
		} else if (!phone && e.key === 'ArrowRight') {
			e.preventDefault();
			go(page + 1);
		} else if (!phone && e.key === 'ArrowLeft') {
			e.preventDefault();
			go(page - 1);
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<!-- `outroInert` is the outro-eats-your-click fix; ⛔ don't drop it. -->
<div
	class="fn-backdrop"
	transition:fade={{ duration: motion(T_QUICK) }}
	onintrostart={introLive}
	onoutrostart={outroInert}
	role="presentation"
>
	<div
		class="fn-panel ctx-dark"
		class:is-phone={phone}
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="fn-title"
	>
		<h2 class="title" id="fn-title">critcalc has a new layout</h2>
		<p class="note lead">{LEAD}</p>

		{#if phone}
			<ul class="list">
				{#each PAGES as p (p.title)}
					<li><strong>{p.title}:</strong> {p.body}</li>
				{/each}
			</ul>
		{:else}
			<div class="media">
				{#each PAGES as p, i (p.title)}
					<div class="slot" class:is-on={i === page} inert={i !== page}>
						{#if still}
							<img src="/assets/whats-new/{p.clip}.webp" alt="" />
						{:else}
							<video
								bind:this={videos[i]}
								src={i <= reached + 1 ? `/assets/whats-new/${p.clip}.mp4` : undefined}
								poster="/assets/whats-new/{p.clip}.webp"
								preload={i <= reached + 1 ? 'auto' : 'none'}
								muted
								loop
								playsinline
								aria-hidden="true"
							></video>
						{/if}
					</div>
				{/each}
			</div>

			<div class="pages" aria-live="polite">
				{#each PAGES as p, i (p.title)}
					<div class="page" class:is-on={i === page} inert={i !== page}>
						<h3 class="head">{p.title}</h3>
						<p class="note">{p.body}</p>
						{#if i === LAST}
							<button class="link link--quiet more" onclick={() => close(true)}>
								See everything in What’s new
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<div class="actions">
			{#if !phone}
				<div class="dots">
					{#each PAGES as p, i (p.title)}
						<button
							class="dot"
							class:is-on={i === page}
							aria-label="{i + 1} of {PAGES.length}: {p.title}"
							aria-current={i === page ? 'step' : undefined}
							onclick={() => go(i)}
						></button>
					{/each}
				</div>
				{#if page > 0}
					<button class="btn" onclick={() => go(page - 1)}>Back</button>
				{/if}
			{:else}
				<button class="btn" onclick={() => close(true)}>What’s new</button>
			{/if}
			<button class="btn btn--primary" bind:this={okEl} onclick={primary}>
				{phone || page === LAST ? 'Got it' : 'Next'}
			</button>
		</div>
	</div>
</div>

<style>
	/* LinksDialog's backdrop and panel, on purpose: the two are siblings. */
	.fn-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(16, 16, 19, 0.72);
	}
	.fn-panel {
		/* 32rem: the clip box is 512px, edge to edge. */
		width: min(32rem, 100%);
		max-height: calc(100dvh - 2rem);
		overflow-y: auto;
		border-radius: var(--r-md);
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
	}
	.fn-panel.is-phone {
		width: min(26rem, 100%);
		padding-top: 1.2rem;
	}
	.title {
		margin: 0;
		padding: 1rem 1.3rem 0.5rem;
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
	}
	.is-phone .title {
		padding-top: 0;
	}

	/* Every page in one cell: the tallest sets the size. The fade is linear
	   (the fade law) and rides --t-quick, so reduced motion zeroes it. */
	.media,
	.pages {
		display: grid;
	}
	.slot,
	.page {
		grid-area: 1 / 1;
		opacity: 0;
		visibility: hidden;
		transition:
			opacity var(--t-quick),
			visibility var(--t-quick);
		transition-timing-function: linear;
	}
	.slot.is-on,
	.page.is-on {
		opacity: 1;
		visibility: visible;
	}

	.media {
		aspect-ratio: 4 / 3;
		background: var(--frame-bg);
	}
	.slot {
		display: grid;
		place-items: center;
		min-height: 0;
	}
	.slot video,
	.slot img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.pages {
		padding: 1rem 1.3rem 0;
	}
	.head {
		margin: 0 0 0.3rem;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
	}
	.note {
		margin: 0 0 0.6rem;
		font-size: var(--fs-md);
		line-height: 1.5;
	}
	/* The global .note caps its measure at 56ch; here the panel already
	   bounds it, and the full width saves the lead-in a line (⚓ Nate). */
	.lead {
		max-width: none;
		margin-bottom: 1rem;
		padding-inline: 1.3rem;
		color: var(--muted);
	}
	.more {
		padding: 0;
		border: none;
		background: none;
		font: inherit;
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.list {
		margin: 0 0 0.6rem;
		padding: 0 1.3rem 0 2.5rem;
		font-size: var(--fs-md);
		line-height: 1.5;
	}

	.actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.4rem;
		padding: 0.6rem 1.3rem 1.1rem;
	}
	.dots {
		display: flex;
		gap: 0.15rem;
		margin-right: auto;
	}
	.dot {
		width: 1.4rem;
		height: 1.4rem;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		display: grid;
		place-items: center;
	}
	.dot::before {
		content: '';
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: var(--muted);
		opacity: 0.45;
		transition:
			background var(--t-snap),
			opacity var(--t-snap);
	}
	.dot:hover::before {
		opacity: 0.8;
	}
	.dot.is-on::before {
		background: var(--accent);
		opacity: 1;
	}
</style>
