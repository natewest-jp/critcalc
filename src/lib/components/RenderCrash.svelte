<!--
  What a render boundary shows when the surface inside it throws: a title, a
  sentence on what still works, Try again and Report this. One look for both
  boundaries, the tool page's (`(tools)/+layout.svelte`) and the menu state's
  sections (`MenuState.svelte`); each brings its own words, since what still
  works differs.

  ⚠️ `+error.svelte` never sees a render throw: it catches routing and load
  failures. A throw during render, with no boundary above it, takes the whole
  document down to a blank page.
-->
<script lang="ts">
	import { dev } from '$app/environment';
	import ReportLink from '$lib/components/ReportLink.svelte';
	import type { FeedbackTool } from '$lib/feedback';

	let {
		title,
		body,
		tool,
		error,
		reset,
		shareUrl
	}: {
		title: string;
		body: string;
		/** The feedback form's "Where?". */
		tool: FeedbackTool;
		error: unknown;
		reset: () => void;
		/** The share link the report carries, where the surface can still make one. */
		shareUrl?: () => Promise<string | null>;
	} = $props();
</script>

<!-- Claims .ctx-dark's job by hand rather than the class, because it is a bare
     notice, not a tool surface: no frame, no glass, nothing to mistake for
     apparatus. Its inks come from whatever ground it lands on (night under a
     tool, slate in the menu state). Centred in its area so it reads as "this
     part failed" rather than "the site failed", which is the whole point of
     scoping each boundary as it is. -->
<div class="render-crash">
	<h2>{title}</h2>
	<p>{body}</p>
	<div class="render-crash__actions">
		<button class="btn btn--primary" onclick={reset}>Try again</button>
		<!-- The feedback form, with the error and the share link where there is one. -->
		<ReportLink class="btn" prefill={{ category: 'broken', tool, error }} {shareUrl}
			>Report this</ReportLink
		>
	</div>
	{#if dev}
		<pre>{error instanceof Error ? (error.stack ?? error.message) : String(error)}</pre>
	{/if}
</div>

<style>
	.render-crash {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		min-height: 50svh;
		padding: clamp(1.5rem, 5vw, 3rem);
		text-align: center;
	}

	.render-crash h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	.render-crash p {
		margin: 0;
		max-width: 32rem;
		font-size: var(--fs-md);
		line-height: var(--lh-relaxed);
		color: var(--muted);
	}

	.render-crash__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: center;
		margin-top: 0.5rem;
	}

	.render-crash pre {
		max-width: 100%;
		margin: 1rem 0 0;
		padding: 0.75rem 1rem;
		overflow-x: auto;
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		text-align: left;
		color: var(--muted);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
	}
</style>
