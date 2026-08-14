<script lang="ts">
	import { page } from '$app/state';
	import {
		metaFor,
		titleFor,
		canonicalFor,
		SITE_NAME,
		SITE_URL,
		OG_IMAGE,
		OG_IMAGE_W,
		OG_IMAGE_H,
		OG_IMAGE_ALT
	} from '$lib/seo';

	// ⚓ RENDERED ONCE, IN THE ROOT LAYOUT. <svelte:head> does not dedupe, so a
	// second instance anywhere emits a second <title> and a second set of og:
	// tags, and which one wins is up to each individual scraper. If a page needs
	// different meta, give it an entry in $lib/seo.ts — do not render this twice.

	const pathname = $derived(page.url.pathname);
	const meta = $derived(metaFor(pathname));

	// The error page is a real route in SvelteKit's eyes but not in the map, and
	// it must never be indexed — an unmatched URL is not a page. Status is 200 on
	// every normal render, so this branch only opens on an actual error.
	const isError = $derived(page.status >= 400);
	const title = $derived(
		isError
			? `${page.status === 404 ? 'Page not found' : 'Something went wrong'} · ${SITE_NAME}`
			: titleFor(pathname)
	);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={meta.description} />

	{#if isError}
		<meta name="robots" content="noindex" />
	{:else}
		<link rel="canonical" href={canonicalFor(pathname)} />
	{/if}

	<!-- Open Graph — Discord, Facebook, Slack, iMessage, and most link unfurlers.
	     og:url and og:image MUST be absolute; relative values are silently
	     dropped, which looks exactly like "no card" and is invisible locally. -->
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:locale" content="en_US" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={meta.description} />
	<meta property="og:url" content={canonicalFor(pathname)} />
	<meta property="og:image" content={`${SITE_URL}${OG_IMAGE}`} />
	<!-- Dimensions let a scraper lay the card out before the image finishes
	     downloading, which is the difference between a card that pops in and one
	     that reflows. -->
	<meta property="og:image:width" content={String(OG_IMAGE_W)} />
	<meta property="og:image:height" content={String(OG_IMAGE_H)} />
	<meta property="og:image:alt" content={OG_IMAGE_ALT} />

	<!-- Twitter/X reads og:* for most fields but needs its own card type, and
	     honours twitter:* over og:* when both are present. -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={meta.description} />
	<meta name="twitter:image" content={`${SITE_URL}${OG_IMAGE}`} />
	<meta name="twitter:image:alt" content={OG_IMAGE_ALT} />
</svelte:head>
