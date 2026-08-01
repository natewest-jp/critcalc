<script lang="ts">
	import type { Component } from 'svelte';
	import type { Area } from '$lib/help/areas';
	import { findChapter } from '$lib/help/areas';
	import { setChapter } from './chromeModal.svelte';

	// One area, two presentations. In `modal` mode the chapter list switches
	// panes in place (the URL never moves — see chromeModal.svelte.ts); in
	// `page` mode the same list is ordinary navigation between the prerendered
	// chapter routes. Either way the entries are real <a href> elements, so
	// middle-click and "copy link" behave, and only the modal intercepts.
	//
	// Wide: a sidebar, with the CURRENT chapter expanded to show its contents.
	// Narrow: the chapters become tabs across the top and the table of contents
	// is dropped entirely — a nested list of jump links is not worth the
	// vertical space on a phone.
	//
	// The table of contents is READ OFF the rendered chapter's `h2[id]`
	// elements rather than declared in areas.ts. Chapters are expected to grow
	// (screenshots, more sections); a derived TOC cannot fall out of step with
	// the prose the way a hand-kept list would. The one obligation on a chapter
	// component is to put an `id` on every `<h2>`.

	let {
		area,
		chapter,
		mode = 'page',
		chapterComponent
	}: {
		area: Area;
		chapter: string;
		mode?: 'modal' | 'page';
		/** Routes pass their chapter statically so it prerenders; the modal omits
		    it and the chapter is fetched on demand. */
		chapterComponent?: Component;
	} = $props();

	const current = $derived(findChapter(area.id, chapter));

	let bodyEl = $state<HTMLElement | undefined>();
	let toc = $state<{ id: string; text: string }[]>([]);

	/** Runs once per chapter render (the {#key} below remounts this subtree). */
	function collectToc(node: HTMLElement) {
		toc = [...node.querySelectorAll<HTMLElement>('h2[id]')].map((h) => ({
			id: h.id,
			text: h.textContent?.trim() ?? ''
		}));
		// A fresh chapter starts at its own top, not wherever the last one was.
		if (bodyEl) bodyEl.scrollTop = 0;
	}

	function onChapterClick(event: MouseEvent, id: string) {
		if (mode !== 'modal') return; // page mode: let the browser navigate
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return; // leave open-in-new-tab to the browser
		}
		event.preventDefault();
		setChapter(id);
	}

	function jumpTo(event: MouseEvent, id: string) {
		event.preventDefault();
		const target = bodyEl?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
		target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
	}
</script>

<!-- Chapter hrefs come out of areas.ts already base-resolved (that is where the
	 route literals live and where resolve() is called), so calling resolve()
	 again on them here would double the base prefix. The rule cannot see that
	 from a variable, hence the file-scoped exemption. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<div class="area-shell" class:is-page={mode === 'page'}>
	<nav class="area-nav" aria-label="{area.title} sections">
		<ul class="area-chapters">
			{#each area.chapters as ch (ch.id)}
				<li>
					<a
						class="area-chapter"
						class:is-current={ch.id === current.id}
						href={ch.path}
						aria-current={ch.id === current.id ? 'page' : undefined}
						onclick={(event) => onChapterClick(event, ch.id)}>{ch.title}</a
					>

					<!-- Contents of the chapter you are actually reading. Wide only. -->
					{#if ch.id === current.id && toc.length > 1}
						<ul class="area-toc">
							{#each toc as entry (entry.id)}
								<li>
									<a href="#{entry.id}" onclick={(event) => jumpTo(event, entry.id)}>{entry.text}</a
									>
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
	</nav>

	<div class="area-body" bind:this={bodyEl}>
		{#key current.id}
			{#if chapterComponent}
				{@const Chapter = chapterComponent}
				<article class="prose" use:collectToc><Chapter /></article>
			{:else}
				{#await current.load()}
					<p class="area-loading">Loading…</p>
				{:then mod}
					{@const Chapter = mod.default}
					<article class="prose" use:collectToc><Chapter /></article>
				{/await}
			{/if}
		{/key}
	</div>
</div>

<style>
	.area-shell {
		display: grid;
		grid-template-columns: 13.5rem minmax(0, 1fr);
		gap: 1.75rem;
		height: 100%;
		min-height: 0;
	}

	/* On a route the surrounding panel does the scrolling, so the shell grows
	   with its content and only the sidebar sticks. */
	.area-shell.is-page {
		height: auto;
	}

	.area-nav {
		min-height: 0;
		overflow-y: auto;
		padding-right: 0.25rem;
		border-right: 2px solid var(--border);
	}

	.is-page .area-nav {
		position: sticky;
		top: 0;
		overflow: visible;
	}

	.area-chapters,
	.area-toc {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.area-chapters {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	/* Body face, not Bitter. Chapter nav sits inside the content, not in the
	   site chrome, and at this size Bitter read as decoration rather than
	   navigation (Nate 2026-07-27). */
	.area-chapter {
		display: block;
		padding: 0.4rem 0.6rem;
		border-radius: var(--r-sm);
		font-family: var(--font-body);
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: var(--muted);
		text-decoration: none;
		transition:
			color 150ms ease,
			background 150ms ease;
	}

	.area-chapter:hover,
	.area-chapter:focus-visible {
		color: var(--text);
		background: color-mix(in srgb, var(--text) 6%, transparent);
	}

	/* "You are here" is the fill alone — the accent edge was a second signal
	   doing the same job, and the fill already reads.
	   ↻ 2026-08-01: the beige selected-state pilot (Stygian selected-row
	   idiom) — the current chapter is the nav's one bright plate, dark ink.
	   Independently revertable to --sel-fill if the pilot stays tool-only. */
	.area-chapter.is-current {
		color: var(--sel-ink);
		background: var(--sel-surface);
	}

	.area-toc {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		margin: 0.3rem 0 0.5rem;
	}

	.area-toc a {
		display: block;
		padding: 0.2rem 0.4rem;
		font-size: var(--fs-lg);
		line-height: var(--lh-snug);
		color: var(--muted);
		text-decoration: none;
		opacity: 0.85;
		transition: color 150ms ease;
	}

	.area-toc a:hover,
	.area-toc a:focus-visible {
		color: var(--text);
		opacity: 1;
	}

	.area-body {
		min-height: 0;
		overflow-y: auto;
		padding-right: 0.4rem;
	}

	.is-page .area-body {
		overflow: visible;
	}

	.area-loading {
		color: var(--muted);
	}

	/* Narrow: chapters become tabs, the table of contents goes away. */
	@media (max-width: 47.5rem) {
		.area-shell {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr);
			gap: 1rem;
		}

		.area-nav {
			overflow-x: auto;
			overflow-y: hidden;
			border-right: none;
			border-bottom: 1px solid var(--border);
			padding: 0 0 0.5rem;
		}

		.is-page .area-nav {
			position: static;
		}

		.area-chapters {
			flex-direction: row;
			gap: 0.35rem;
		}

		.area-chapter {
			flex: none;
			padding: 0.35rem 0.7rem;
			border-left: none;
			border-radius: 999px;
			border: 1px solid var(--border);
			font-size: var(--fs-lg);
			white-space: nowrap;
		}

		.area-chapter.is-current {
			border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
		}

		.area-toc {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.area-chapter,
		.area-toc a {
			transition: none;
		}
	}
</style>
