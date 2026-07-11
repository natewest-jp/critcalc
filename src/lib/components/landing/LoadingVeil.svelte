<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	// The veil exists only in a server-rendered document of `/` — exactly the
	// loads where the starfield canvas paints late (first visit, refresh, direct
	// link, bfcache miss). Detection: during hydration the SSR-rendered veil is
	// findable in the DOM, so we keep it; a fresh client-side mount (SPA nav to
	// the landing) finds nothing and renders nothing. No flags, no store.
	let show = $state(browser ? document.getElementById('loading-veil') !== null : true);
	let leaving = $state(false);

	// Minimum time the veil stays up, measured from first contentful paint (the
	// veil IS the first paint on these loads). On fast connections the starfield
	// is ready in ~300ms and a veil that brief reads as a glitch — "what was
	// that?" (Nate, 2026-07-11). This holds it just long enough for the glyph
	// entrance (~900ms) to play and register as a deliberate moment. It only
	// delays loads that were already fast; slow loads blow past it anyway.
	const MIN_HOLD_MS = 1100;

	onMount(() => {
		if (!show) return;
		// Two frames after mount the starfield has presented its first canvas
		// frame (TwinkleStars starts it in an effect, which flushes before our
		// first rAF fires; if WebGL is unavailable the baked anchor stars in the
		// sky image cover instead), so the scene is ready under the veil.
		let hold = 0 as ReturnType<typeof setTimeout> | 0;
		let raf2 = 0;
		const raf1 = requestAnimationFrame(() => {
			raf2 = requestAnimationFrame(() => {
				// Reduced motion has no entrance flourish to let play — dismiss now.
				const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
				const fcp = performance
					.getEntriesByType('paint')
					.find((e) => e.name === 'first-contentful-paint')?.startTime;
				const shownFor = performance.now() - (fcp ?? performance.now());
				const wait = reduced ? 0 : Math.max(0, MIN_HOLD_MS - shownFor);
				hold = setTimeout(() => (leaving = true), wait);
			});
		});
		// Backstop if transitionend never fires (throttled background tab).
		const bail = setTimeout(() => (show = false), 4000);
		return () => {
			cancelAnimationFrame(raf1);
			cancelAnimationFrame(raf2);
			clearTimeout(hold);
			clearTimeout(bail);
		};
	});
</script>

{#if show}
	<div
		id="loading-veil"
		class="veil"
		class:leaving
		aria-hidden="true"
		ontransitionend={(e) => e.target === e.currentTarget && (show = false)}
	>
		<!-- Static trusted markup (noscript can't be authored in a Svelte template). -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html '<noscript><style>#loading-veil{display:none}</style></noscript>'}
		<svg class="grain" aria-hidden="true">
			<filter id="veil-grain">
				<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" />
			</filter>
			<rect width="100%" height="100%" filter="url(#veil-grain)" />
		</svg>
		<div class="word">
			<!-- Glow: a <use> clone of the glyphs (no byte cost) blurred behind the
			     ink. Its filter is static; only its opacity animates, so the pulse
			     stays compositor-only even while the main thread parses chunks. -->
			<svg class="glow" viewBox="0 0 347 65" aria-hidden="true">
				<use href="#veil-word" />
			</svg>
			<svg class="glyphs" viewBox="0 0 347 65">
				<g id="veil-word">
					<path
						d="M29.3 31.5c0 2-1.2 4.4-2.3 6l-.4.3q-.5.6-.7.6l-.6.2a10 10 0 0 0-4.3 2.7l-2 2.1-.3-.3-.3-.4-.3-.4-2.6-2.3-.9-.5q-.9-.6-2.4-1l-.4-.3-.5-.6a11 11 0 0 1-2.6-6.1H1.3q-.2 0-.2.5-.4 3 .1 5l.5 2-.5 1.3-.5 1.5a8 8 0 0 0 0 6.3c0 .4 1 3.4 1.4 3.5.4 0 .8-.8 1-1.2q.2-.1.3-.4l.2-.3.8-1.4q.5-.6.9-.8l.3-.3q.5-1-.1-2.3l-.3-.5-.4-.6q0-.6.5-1.4c.6-1 1.9-.8 2.5.2q1 1.8.5 2.6t0 2.4q.3.6 1.5 1.6 1.7 1.4 3.7 2.4l1.3 1q.3.1.5.6l.4.8 1 2 1 2.1.5 1q.5.9.7.9h.1q.4 0 .6-.4l1.2-2.2 1-2.3.6-1 .4-.8q.2-.6.4-.7l2.8-1.8 1-.8 1.2-.8 1.1-1.1q.9-1.2.6-2t-.3-1.8q0-.7.6-1.6c.6-1 1.8-1.3 2.5-.3q.5.7.5 1.5l-.3.4-.4.6q-.6 1.3-.1 2.2l.6.6.5.5.7 1 .6 1.2q.6 1.1 1 1.2l.4-.7 1-2.4.1-.4.2-.4a8 8 0 0 0 0-5.2v-.4l-1.2-3 .1-.5.1-.3V38l.5-1 .2-2v-2.7l-.1-.6q-.4-.2-1.5-.1h-6.2m-6-27-3-.1-3-.4h-1a16 16 0 0 0-7.2.6h-.3l-.3.2c0 .6.6 1.4.9 1.8L10.9 8c.7.6 1.9 1.6 2.4 2.4l.4.6.4.6c.9 1.6 1.6 4.8 1.8 6.6l.2 1.5q-.2 0-.2 1v.3l-.1.3.2.6 1.9 4.3.2.5.3.5q0 .4.2.5l.5.5.3-.4c.3-.5 1.5-3 1.7-3.7l.6-1.4.6-1.3v-.6q-.2-1.2-.3-1.1l.2-1.6c.2-1.7.8-4.5 1.6-6l.5-1q.7-1.2 1.7-2l.8-.8.4-.3 1.5-1.5.6-1c.1-.3.7-2 .7-2.4q0-.6-.5-.4l-1.2.6a13 13 0 0 1-4.9 1.2M8.7 30.4a16 16 0 0 1 2.1-7.5l1-1.4q.3-.4.3-1t-.2-.9l-.4-.6-.3.4-.7.6q-1.2 1-2.4 1.6-2.9 1.2-4.6 3.5L3 26q-.7 1.2-1.1 2.3l-.1.2v.3l-.4 1-.1.6zm17.4-10 .1 1v.2h.2l.5.8.3.4.3.5.3.5.5 1.2q1 2.5 1 5.3h7.5l-.1-.5-.2-.5-.1-.5-.5-1.2-.5-1.2-.5-.8a9 9 0 0 0-3.4-3.3l-.9-.4-1.7-1q-.9-.4-1.6-1.1l-.3-.3-.3-.5h-.1l-.3.7zm3.5-4.7q0 .9.2 1l1 .5q1 .7 1.6 1.5l1 1.8q0 1.4 1.5 1.4.4 0 .6-1 .3-1.6 1-3.6.5-1.8.5-4a14 14 0 0 0-.8-4.8q-.6 0-.7.4t-1 1.3L33 11.3l-2.2 2.1a7 7 0 0 0-1.2 2.3m-28.5-3q0 2.6.4 3.8l.9 3.4.2 1.6c0 .8 2 0 2.1-1l.4-1q.7-1.5 3-2.8.4-.2.4-1c0-.6-.9-1.8-1.2-2.3q-.6-.9-1.7-1.7l-2-1.5-1.1-1.4q-.2-.3-.6-.3l-.3.9Q1 10.9 1 12.8"
					/>
					<path
						d="M70.3 46.2c-2.1 0-5-.5-6.5-2l-.7-.6a15 15 0 0 1-3.4-7.1l-.2-.4-3.9-2.4-.8-.5-1-.6q-.3 0-.5.2l.1.3v.4l.6 2q.7 5.4 2.7 10.5a12 12 0 0 0 2.6 4.1l.9.8q1 1 1.9 1.5.3.2.5 1.1l.5 2.9a36 36 0 0 0 1.3 5.3q.3.3 1-.5l.1-.2.2-.3.6-.6.2-.3.2-.2 1.8-2 .1-.2 1.1-1.3q1-.9 1-1.3c.5 0 2.7-.3 3-.5l1.4-.4a15 15 0 0 0 4.5-2.7l2.8-3 1.3-1.9L85 44l1.2-2.4 7.3-1.1q.3-.4.2-1L91.3 38l-2.9-2-.8-.5-.2-.1-.1-.2-.4-.2-2.4-1.5-1.6-1-1.6-.8-.2.1-.2 2.7c-.1 2-1.2 5.6-2.4 7.2l-.7.9-.3.3-.2.3-.5.4-.7.5-.4.3-.5.4q-1 .6-2.2 1a9 9 0 0 1-2.7.4m-.9-39.1-3 .5L65 8q-2.5 1-4 2.3l-1.4 1.3-2 2.4-1.1 1.6q0 .2-.7 1.1l-.6 1.2-.6 1.2-.3.6-.3.7-7 .8q-.6.3-.6 1.2l.8.5 2.3 1.5.3.3.4.2 3.9 2.5.4.2.3.3 1.8 1 1.8 1.1.5.2.1-.1.1-.6v-.6l.2-2a19 19 0 0 1 2.3-6.7l1.3-1.4.5-.5.6-.5 1.4-1 .6-.2q3.4-1.4 7.6-.4 1.6.4 2.6 1.3l.2.2.2.1c1.1 1 2.3 3 2.9 4.3l.4 1 .6 2q0 .7.3.7l.2.2 3.2 2c.3.2 2 1.5 2.4 1.3q.2 0 .1-.6v-.3q-.5-1.5-.8-3.1l-1.1-5.5q-1.2-4.6-3.3-7.2a14 14 0 0 0-3.7-3.2q-.2 0-.2-.7A82 82 0 0 0 76 .4q-.3-.7-.8-.1l-.3.3-.6.8-1.9 2q0 .3-.3.4L72 4l-.2.2-.1.1-1.7 2zm-4.7 24.8a9 9 0 0 0 .8 3.2l.8 1.5.8.8q.8.9 2.2 1.2.7.3 1.8 0h.2l.2-.1.2-.1 1.3-.8.2-.2 1-1.6c.2-.5.9-2.5.9-3.3q0-.7-.3-.9h-2.7c-1 0-1.2 1.1-1.5 1.9l-.1.2-.1.3-.4 1-.2-.4-.2-.6-.3-.5-.7-1.3q-.4-.7-.8-.7h-2.3q-.3 0-.8.4m5.8-5c0 1-.1 2.3.4 3q.4.8.4.5h3.2q.6-.2.6-.5 0-1.6-.3-2.5-.4-1.3-1.1-2.2l-.6-.5-.6-.5h-.2q-.5-.2-.1 0l-.6-.2-.2.3-.4.6a4 4 0 0 0-.5 2m-5.9 3 .5.4 1.5.2h1.6c.6 0 1.2-1.9 1.2-2.6a7 7 0 0 0-.4-2.5l-.6-1q-.2-.2-.6-.2l-.6.3-.4.3-.3.3q-.3 0-.3.2c-.6.7-.5.5-.9 1.4l-.1.3q-.6 1.2-.6 2.8"
					/>
					<path
						d="M105.3 22.6q0 .3.2.5l1.4.5q3.5 1 6.1 2.5l1.3.7 1.4.9 1.2.8.8.5.6.4.5.2q.9.3 1.8-.1a21 21 0 0 1 7-2l-.4-.3-3-2-4.2-2.5-1.7-.7-3.6-1.4-.5-.1-.5-.1-.3-.3q-.1-.1.3-1.3l.3-.9q1.2-2.8 3-5.6l1-1.3 1-1.2v-.1l.2-.2.6-.6c.7 0 1.8 1.3 2.3 1.9q1.5 1.5 2.5 3l.5.8q0 .4.2.4l.5 1 .6 1a26 26 0 0 1 2.5 7.5l.1 2q0 1 1.1 1.5l1 .2 1 .2 2 .5.9.3.9.3 1 .4.8.3-.3-1-.3-1.4-.4-1q0-.7-.3-1.2l-.4-1.4-.2-.3v-.3l-.1-.3a42 42 0 0 0-3.4-8.5l-1-1.9-1.1-1.8q-1.1-1.8-2.4-3.5l-1-1.2-.7-.8-.7-.8-1.8-2-2-1.6q-1-.4-2-.4-.7 0-1.6.6-.5.2-1.2 1l-.6.6-.6.6-1 1.2-1.4 2-.1.1-.1.2-2.4 3.8-1.2 2.2c-.8 1.1-2.4 4.7-3 6.1l-.2.8-.3.9-.2.8-.2.2zm3.3 28-.2-1-.5-3v-2.8a15 15 0 0 1 1.7-7l.5-.7.4-.7.7.3.7.4.8.5.7.6 2.5 2.1 1.3 1.3 1.3 1.2q0 .2.5.6l.4.5-2.3 1.7-2.3 1.7-4 2.9q-.6.2-1.1.7zm-7-4.8c0 3.1 0 5.3.7 8.3q.7 4 2.5 7.3c.6 1.4.6 2.3 2.4.6l1-.8.8-1c.3-.2.8-1 1-1.3q.2-.4.1-1 0-.9.7-1.8l2-2.1a33 33 0 0 1 4.3-3.4l1.5-.9 4.8-2.3.9-.3 1.8-.6q.5-.3.5-.6l-.2-.6-.4-.5-.5-1-.2-.6-3-5.9-.7-1-.2-.1-2.1-2.4q-.3 0-.5-.3l-1.3-.8-1.4-.7q-.8-.4-1.2-.4h-10.5c-.5 0-1.3 2.4-1.4 2.8l-1 5.4q-.4 3-.4 6m24-13 .5.5.5.6q2.1 2.5 3.8 5.2l.2.4.3.4 1.2 2.2.3.4 1.4 2.7a35 35 0 0 1 4.2 15v.7l.1.7v2.6q.3 0 .7-.5 0-.3.1-.1l.3-.5a34 34 0 0 0 2-11.8v-2.1c0-1-.3-6.3-.6-7.5l-.4-2.3a56 56 0 0 0-1.9-7q-.2-.7-1-.7H133l-.6.1h-.7l-1.2.2-2.2.2z"
					/>
					<path
						d="M155 1.7q.3.6.3 1.5l.3 1.6v.9l.1.8.2 5.4-.1 18.5h8l.2-1.8.2-3.5v-.8l.1-1 1.1.4 1.1.3q3 .6 5.6 1.6l3.2 1 1.4.4 1.3.6a9 9 0 0 1 2.2 2.8h7.8l.2-.4.1-.3-.2-1.5-.5-1-.4-1.1-.5-.7-.1-.2-.1-.2-.4-.3q0-.3-.4-.4l-.5-.5a14 14 0 0 0-5.4-3.2h-.3l-5.6-2a100 100 0 0 0-9.4-3.6l-.2-2.1-.1-2q0-1.4-.2-1.7l.7.1.7.2 1 .3 1 .2 2.8 1.4 3.2 2c2.3 1.4 4.2 2.6 7 3.2q2.4.7 4.5.4l.8-.1q.4 0 .8-.3l1.1-.4.4-.2q.8-.4 1-1v-.2l.2-.2v-.9q-.2-.5-.8-.3h-1a7 7 0 0 1-3-1l-.4-.3-1.4-1.3-.2-.1-.1-.1-.4-.4-.2-.2-.1-.1-.4-.4a33 33 0 0 0-5.1-3.5l-4.4-2.3-1-.4-1-.2-1-.3q-2.2-.7-4.4-1c-2.6-.5-5.8-.8-8.4-.3l-.5.1zm25.8 30h-.2l-.1.3.2.7.3 3 .4 3 .1 1.3.2 1.2.1 5.3c0 2.7-.4 7.5-1.3 10.2l-.2.7-.4.7-.3.5q-.2.2 0 .4l.3.4.3.3q1.4.9 3.4.6 2.9-.5 4.2.3 1.5.7 2 .7c.3 0 1.2.3 1.5-.3l.3-.5q.3-.6.1-1.1l-.3-.3-.4-.4q-1.2-1.5-1.8-3l-.3-1.8v-2.5l-.1-3.5v-1.2l-.1-6.8v-7.4l-.1-.5q0 .2-.5-.4zm-25 .5V36l.1.4v2.4l.1.5v2.3l.1.4v.5l.1 1.4v1.4l.3 3.7v.4l.1 1.4.4 6.4v1l.1.4v.5l.2 2.7.7-.2 3-1.9 1-.8 2.9-2.4.5-.5.5-.5.1-.4q0-.3-.3-.6l-.7-.6q-.4-.2-.7-1l-.2-.7-.5-2.4c-.3-2.4-.4-6-.3-8.7v-1.9l.1-1.3.1-1.3V36l.3-4.5h-8zm12.9 9.2q0 .8.2 1.4.5 1.3 1.5 1.8l.6.2.3.1h.4q1.4.4 2.3 0l.3-.1a3 3 0 0 0 1.2-1.2v-.1l.2-.1v-.2l.4-1 .1-.2v-1l-.3-1-.4-.8-.4-.5-.5-.4-.5-.4q-.9-.5-2.1-.5l-.7.1-.6.3-.6.4-.8 1.2q-.6 1-.6 2"
					/>
					<path
						d="m214.6 57.6.4.4.5.8q.6.9.8 1.6.1.6 1.1 1t2 .4l1.5-.4 2-.6 1-.4q.6 0 1.1-.3h1.6l1.5.3 1.5.4a4 4 0 0 0 3.3-.4l1.1-1q0-.6-.4-.6l-1.1-.5-.8-.5-.4-.3q-.7-.6-1.6-1.8A13 13 0 0 1 228 51l-.3-1.7q-.3-.6-.3-1.7V46l-.1-.1V45q0-1.4.3-2.3l.3-1q.8-2.4 2.4-4.4l.1-.2.2-.2.9-1 1-1.2.9-1 1-1 .2-.1.2-.2.2-.1q.3-.2.3-.8H214c0 .7.8 1.9 1.3 2.3l1.7 2 1 1.3.5.8a20 20 0 0 1 1.8 4.8l.2.8v.8q.2.6.1 1.2v1c0 2.7-1.5 7.2-3 9.2-.3.4-1.6 1.4-2.3 1.4h-.4zm4.8-47.7c0 3 0 4.1.5 7.3q.6 4.3 2 8.1L223 28q.3.7 1 .7l.6-.6.4-.8.7-1.7.7-1.7.3-1 .2-1 .8-4q.7-4.9 0-8.8-.2-2.3-.9-4.2l-.4-1-.5-1.2-.6-1.4q-.4-1-1-1.2l-.3.5-.1.2v.1q-1.2 1.8-2 2.5a11 11 0 0 0-2 3.4l-.3 1.5zM202 29.3v.2q0 .6.2 1h19.7q0-.3-.3-.5l-.5-.4-.7-.9-.4-.4-.4-.4-2.7-2.4c-1-.5-1.5-1-2.6-1-1.8 0-5.3 1-6.7 1.9q-2.1 1.8-3.9 2.4zm24.4 1.1H246v-1l-.7-.3q-.8 0-1.5-.5-2.6-1.2-3.7-2.4t-4.1-1.7h-.9l-.9-.1-1.6.3-.6.4q-.6.1-.6.4l-1.3 1.7-1.5 1.5-.3.2zm6.7-13q0 1.2.8 1.8 1.4 1 2.3 1.1l1.1-.3q1.7-.8 1.7-2.3v-.6l-.2-.5a4 4 0 0 0-1.5-1.8q-.7-.4-1-.4l-.7.1q-1 0-1.6.8-.9 1.1-.9 2.1m-24 0q0 1.8 2 2.6l1.1.2q.8 0 2-1 .8-.9.9-1.9a3 3 0 0 0-1-2.1l-.8-.7q-.5-.2-.9-.1l-.6.1q-.6 0-.9.3l-.4.3-.1.1q-.7.6-.9 1z"
					/>
					<path
						d="M256.7 27.2v2.3l.3 1h7q0-5 1.6-9.2l1.2-2.7.6-1a21 21 0 0 1 2.6-3.4l1.1-1.2.7-.7.8-.7 3.1-2.4q.3 0 1 1 0-.2.3.1l.3.3.4.5 2.1 2 3.2 3.8 1.2 1.8q1.6 2.5 2.5 5.4.4 1.2.5 2.5v2l.1.9v.9h6.4c.1-1.2.2-3.6 0-4.8V25l-.1-3.2-.3-1.2-.1-.1-1-1-1-.7-.6-.5-1.1-1.3-1.9-2.2-5.7-7.1-1.7-2.4-.9-1.2-1.2-1.5-1-1q-.9-.4-1.4-.3l-2.6 1.4-4.2 2.8-2.5 2-.6.5-.7.7-.7.7L263 11l-.6.7-1.2 1.6q-.8.8-1.4 2.3l-.3.4a25 25 0 0 0-3 11.2m30.6 4.3v1.1l-.1.5v.5l-.8 4c-.2 1-1 3.3-1.4 4.3l-.5.7c-1 1.6-1.3 2-2.4 3.3l-1 1.2-2.8 2.5-.4.2c-1 .8-4 2.5-5.3 2.8h-2q-.8 0-1.1.4l-3.4 3.3-.3.2-.2.2-1.3 1.2q-.6.5-.2.8v.1h1.1a29 29 0 0 0 7-1h.1l.5-.2a25 25 0 0 0 7.7-3l.6-.4 1.9-1.1 2.9-2.1 2.5-2.4a21 21 0 0 0 4.4-10.4l.9-6v-.7zm-9 0a19 19 0 0 1-1.7 3.6l-.4.7-1.8 3q-.9 1.5-1.5 3.2l-.2.8-.5-.7-.1-.2-.2-.2-2.7-3.5-.9-1-1-.9v-.1l-.2-.2-.4-.3-.3-.3-.3-.3q-.2 0-.4-.3c-1.2-1.3-1.7-1.4-1.7-3.3h-6.9q0 1.2.6 2.1l.3.7.8 1 1 1q.6.7 2 1.7 1.4 1.2 3.2 2.3l.6.4 1.1.7.2.2 3 3 1.3 1.6q0 .3.1.1l.4.4.9 1q.6.5 1.7-.4l.5-.4 1.5-1.2.5-.5.9-1 .8-1 .8-1 2.6-4.3.2-.4c.9-2 1.4-3.6 1.4-6zm-6-1V30c.4-1.2.5-1.6 1.2-2.7a7 7 0 0 1 2-2.6c.6.1 1.4 1.6 1.8 2.2l.5 1v.2l.2.4.2.6v.5q0 .4.1.3v.5h5.3q0-2.7-.7-4.6l-2-3.3-3.5-3.9c-.3-.3-1.3-1.6-1.7-1.6q-.5 0-1.8 1l-.3.4-.7.6-.7.7-.6.7-.3.4q-.7.7-1.2 1.6c-.6 1-2 3.3-2 4.6-.3 1.6-.2 1.8.2 3.4zm-.2 5.2q.3 0 .2-.3l-.2-.4c-.2-.5-.4-2.2-.2-2.7v-.4l.1-.4h-3.3l.1.4.1.3c.2.5 1.1 2 1.5 2.4l.5.4.5.5zm-1.7-.4"
					/>
					<path
						d="m327.7 31.5.2.6.2.3v.1l.4.2q.5.5.8.5c1.6.7 3.8 2.3 5 3.6l.3.5q.6.8.7 1.8V51l-1 .7q-.7.6-1.3.8-1.6.7-2.1.7-1.2.3-2.3 0-1.5-.3-2-1.2-.3-.6-.3-1.3v-13l-.1-4.7v-1.2l-.1-.3h-4.8v19.2q-.6-.3-1-.8l-.5-.3-.9-1q0-.2-.3-.4l-.3-.4a10 10 0 0 1-1.6-3 22 22 0 0 1-1.7-12.5l.2-.8h-8l-.1.3-.1.4a26 26 0 0 0 3.5 20q.9 1.3 2.1 2.3l.4.3 1.4 1.2a16 16 0 0 0 5 2.7q2.6 1 5.5 1l1.2.1 4.4-.4a19 19 0 0 0 5.4-1.8l.2-.1.2-.1 1.1-.7q1.2-.7 2.1-1.5l.6-.6.7-.6q1.7-1.6 2.7-3.2a20 20 0 0 0 1.8-16.4l-.4-1-.5-1.2-.4-.8zm-6.8-28c-1.4 0-6.3 0-7 .3-.6.4.1 1.3.5 1.6l.7.5 1 .4q.8.4 1.8.6l2 .6 1.7.8q1 .5 1 1.9 0 .4-.8 1l-.9.8-1.3 1.2-1.7 1.5-2.5 2.3-.5-.6-1-1.2-.4-.6-.5-.7-.1-.1-.1-.2q-.4-.5-.6-1.1l-.6-1.1-.5-1.2-.7-1.6-.6-2.6q-.2-.7-.6-.7-.2 0-.3.7l-.1.1v.2l-.2.7-.1.6c-.5 3-.4 6.6.9 9.2q.6 1.4 1.2 2l1 1.4.2.2.3.2q-1.5 2.2-2.4 4l-.5 1.1-.3.6a20 20 0 0 0-1.4 4h7.8l.2-.5.2-.7q0-.6.4-1.2l.4-1.2q.1-.6.5-1.2l.5.6 1.5 2 .8.9.3.3.4.4.5.9h4.7l-.1-.7-.1-.3-.1-.3q-.3-1.2-1.4-2.8l-.8-1q-.3 0-.7-.7L320 22c-1-1.2-1-.9.2-2.5l.3-.5.4-.5.6-.9.7-.8.2-.2c.4-.5 2.3-2.3 3-2.8l.2-.2 3-2.4 3.8-2.5 3.8-2.4 2.1-1.2.6-.5.6-.5q.6-.5-.2-.7H327l-3.6.2h-.5l-.6-.1zm7.2 19q0 1.3 1 2.5 1 1 3 1a3 3 0 0 0 2.5-1.2 5 5 0 0 0 1-3.4q0-.8-.6-1.3l-.3-.3-.2-.2q-2.2-1.7-4.3-.8l-1 .6-.1.2q-1 1.4-1 2.8"
					/>
				</g>
			</svg>
		</div>
	</div>
{/if}

<style>
	.veil {
		position: fixed;
		inset: 0;
		z-index: 10;
		display: grid;
		place-items: center;
		background: linear-gradient(180deg, #000 0%, #0e0f12 100%);
		transition: opacity 400ms ease;
		/* CSS-only self-destruct: if JS never arrives (blocked, failed chunk),
		   the veil clears itself and the SSR'd scene shell remains usable. */
		animation: veil-bail 600ms ease 8s forwards;
	}

	/* Grain: inline feTurbulence, not the scene's noise-128 tile — that tile has
	   a wrap seam that repeats every 128px once composited plainly over
	   near-black (sky-bg gets away with it because `overlay` blending over its
	   brighter gradient buries the seam). Turbulence is continuous across the
	   whole rect: no seams, no tiling, no extra request. Also breaks up banding
	   in the gradient. */
	.grain {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		/* High enough to dither the gradient's 8-bit banding steps (a #000→#0e0f12
		   ramp only has ~14 luminance levels), low enough to stay subliminal. */
		opacity: 0.08;
		pointer-events: none;
	}

	.veil.leaving {
		opacity: 0;
		pointer-events: none;
	}

	@keyframes veil-bail {
		to {
			opacity: 0;
			visibility: hidden;
		}
	}

	.word {
		position: relative;
		width: clamp(8rem, 20vw, 14rem);
	}

	.glyphs,
	.glow {
		display: block;
		width: 100%;
		height: auto;
		fill: #00a8ff;
	}

	/* Tight neon edge on the ink itself; the wide bloom is the blurred clone. */
	.glyphs {
		filter: drop-shadow(0 0 6px rgba(0, 168, 255, 0.55));
	}

	/* Per-glyph materialization + ambient shimmer. Entrance: each glyph rises
	   and fades in, left to right (~700ms total; getting cut off by the veil's
	   fade-out on a fast load still reads as intentional — the word blooms
	   through the fade). Then each glyph breathes on its OWN cycle: duration,
	   phase and dim level all differ per glyph (nth-of-type below), so the
	   seven never sync and the word reads as living script, not a metronome.
	   The breathe is listed last so it owns opacity once its delay elapses;
	   the entrance's forwards fill keeps owning transform throughout. Every
	   breathe delay must stay past that glyph's entrance end (delay + 480ms) —
	   its 0% keyframe is opacity 1, so the handoff is seamless. */
	.glyphs path {
		opacity: 0;
		transform: translateY(0.375rem);
		animation:
			veil-glyph-in 480ms cubic-bezier(0.2, 0.7, 0.3, 1) forwards,
			veil-glyph-breathe 4s ease-in-out 1.5s infinite;
	}

	/* Each glyph's RESTING brightness (--lit) is also its own value — the word
	   is never uniformly lit, even in the first second before the breathe
	   starts, so fast loads still see worn, uneven script (Nate: full-opacity
	   reads as artificial). Entrance lands on --lit; breathe cycles --lit→--dim. */
	.glyphs path:nth-of-type(1) {
		animation-duration: 480ms, 4.3s;
		animation-delay: 0ms, 1.9s;
		--lit: 0.88;
		--dim: 0.5;
	}
	.glyphs path:nth-of-type(2) {
		animation-duration: 480ms, 3.4s;
		animation-delay: 70ms, 1.2s;
		--lit: 0.72;
		--dim: 0.42;
	}
	.glyphs path:nth-of-type(3) {
		animation-duration: 480ms, 5.1s;
		animation-delay: 140ms, 2.6s;
		--lit: 0.95;
		--dim: 0.48;
	}
	.glyphs path:nth-of-type(4) {
		animation-duration: 480ms, 3.9s;
		animation-delay: 210ms, 1.5s;
		--lit: 0.8;
		--dim: 0.38;
	}
	.glyphs path:nth-of-type(5) {
		animation-duration: 480ms, 4.7s;
		animation-delay: 280ms, 2.2s;
		--lit: 0.68;
		--dim: 0.45;
	}
	.glyphs path:nth-of-type(6) {
		animation-duration: 480ms, 3.6s;
		animation-delay: 350ms, 1.05s;
		--lit: 0.9;
		--dim: 0.55;
	}
	.glyphs path:nth-of-type(7) {
		animation-duration: 480ms, 4.4s;
		animation-delay: 420ms, 2.9s;
		--lit: 0.76;
		--dim: 0.4;
	}

	@keyframes veil-glyph-in {
		to {
			opacity: var(--lit, 1);
			transform: translateY(0);
		}
	}

	/* var(--lit)/var(--dim) resolve per animated element, so one keyframe set
	   serves all seven glyphs at different peaks and depths. */
	@keyframes veil-glyph-breathe {
		0%,
		100% {
			opacity: var(--lit, 1);
		}
		50% {
			opacity: var(--dim, 0.5);
		}
	}

	.glow {
		position: absolute;
		inset: 0;
		filter: blur(0.75rem);
		opacity: 0.55;
		/* Bloom in behind the materializing glyphs, then breathe. The pulse is
		   listed last so it owns opacity once its delay elapses (a forwards fill
		   earlier in the list would otherwise override it forever). */
		animation:
			veil-glow-in 900ms ease-out both,
			veil-glow-pulse 2.8s ease-in-out 900ms infinite;
	}

	@keyframes veil-glow-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 0.55;
		}
	}

	@keyframes veil-glow-pulse {
		0%,
		100% {
			opacity: 0.55;
		}
		50% {
			opacity: 0.85;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.glyphs path,
		.glow {
			animation: none;
			/* Static, but still the worn per-glyph brightness, not uniform. */
			opacity: var(--lit, 1);
			transform: none;
		}
		.glow {
			opacity: 0.55;
		}
		.veil {
			/* Keep the bail backstop; drop the flourish, keep a quick functional
			   fade so transitionend still fires for the dismissal path. */
			transition-duration: 120ms;
			animation: veil-bail 600ms ease 8s forwards;
		}
	}
</style>
