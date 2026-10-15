<script lang="ts">
	import type { Snippet } from 'svelte';
	import { feedbackUrl, type FeedbackPrefill } from '$lib/feedback';

	// A link to the feedback form, prefilled ($lib/feedback.ts owns the form).
	//
	// ⚓ An <a>, not a button that opens a window: every share link is built
	// ASYNCHRONOUSLY (deflate), and a `window.open` after an await has lost the
	// click's user activation — Safari blocks it as a popup. So the href is
	// right at once without the share link, and gains it the moment the encoder
	// returns (milliseconds; these links mount when their menu or card opens).
	// A click in between still reaches the form, one field short.

	let {
		prefill,
		shareUrl,
		class: className = '',
		role,
		onclick,
		children
	}: {
		prefill: FeedbackPrefill;
		/** Resolves the share link to carry; `null` when there is none. */
		shareUrl?: () => Promise<string | null | undefined>;
		class?: string;
		role?: string;
		onclick?: () => void;
		children: Snippet;
	} = $props();

	let shareLink = $state<string | null>(null);

	$effect(() => {
		if (!shareUrl) return;
		let live = true;
		shareUrl().then(
			(url) => {
				if (live) shareLink = url ?? null;
			},
			() => {
				// No link is still a report — the reader can paste one.
			}
		);
		return () => {
			live = false;
		};
	});

	const href = $derived(feedbackUrl({ ...prefill, shareLink: shareLink ?? prefill.shareLink }));
</script>

<!-- `onclick` (a menu's close) runs a task LATER: a host that unmounts this
     link in the click itself would detach the <a> before its default action
     opens the tab. The rule below is for in-site paths; this href is the
     external form. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<a
	class={className}
	{href}
	target="_blank"
	rel="noopener noreferrer"
	{role}
	onclick={() => {
		if (onclick) setTimeout(onclick);
	}}>{@render children()}</a
>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
