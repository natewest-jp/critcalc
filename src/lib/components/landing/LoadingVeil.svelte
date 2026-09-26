<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { isToolPath } from '$lib/landing/transition';
	import { afterPaint, onVeilReady } from '$lib/landing/veilReady';
	import HRule from '$lib/components/HRule.svelte';
	import VeilGround from '$lib/components/VeilGround.svelte';

	// The veil exists only in a server-rendered document — exactly the loads
	// where content arrives late (first visit, refresh, direct link, bfcache
	// miss), on EVERY surface: the starfield paints late on the scene, and a
	// tool restores its saved state after hydration. Detection: during
	// hydration the SSR-rendered veil is findable in the DOM, so we keep it; a
	// fresh client-side mount (any SPA nav, including a hero-card ascend into a
	// tool) finds nothing and renders nothing. No flags, no store.
	let show = $state(browser ? document.getElementById('loading-veil') !== null : true);
	let leaving = $state(false);

	// Minimum time the veil stays up, measured from first contentful paint (the
	// veil IS the first paint on these loads). On fast connections content is
	// ready in ~300ms and a veil that brief reads as a glitch — "what was
	// that?" (Nate, 2026-07-11). The scene hold lets the glyph entrance
	// (~900ms) play and register as a deliberate moment.
	//
	// Tools get a shorter floor (Nate, 2026-07-26): a tool is somewhere you
	// reload repeatedly while iterating on a rotation, and the full ceremony
	// turns into friction there. The blink is still fully covered — that is the
	// ready handshake's job, not the floor's — so this only governs how long a
	// FAST reload lingers.
	const SCENE_HOLD_MS = 1100;
	const TOOL_HOLD_MS = 500;

	// Hard ceiling on the ready handshake. A stalled payload fetch must never
	// strand the veil over a usable page; past this we uncover regardless and
	// let the content settle in the open. Sits well inside the 4s JS backstop
	// and the 8s CSS self-destruct below.
	const READY_CAP_MS = 2500;

	onMount(() => {
		if (!show) return;
		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const hold = isToolPath(location.pathname) ? TOOL_HOLD_MS : SCENE_HOLD_MS;

		let holdTimer = 0 as ReturnType<typeof setTimeout> | 0;
		let capTimer = 0 as ReturnType<typeof setTimeout> | 0;
		let cancelPaint = () => {};
		let cancelReady = () => {};
		let dismissed = false;

		const dismiss = () => {
			// onVeilReady fires synchronously when nothing is pending (the scene's
			// normal path), so this can be reached before the cap timer is even
			// armed — and again when it fires. Once only.
			if (dismissed) return;
			dismissed = true;
			cancelReady();
			clearTimeout(capTimer);
			// Reduced motion has no entrance flourish to let play — dismiss now.
			const fcp = performance
				.getEntriesByType('paint')
				.find((e) => e.name === 'first-contentful-paint')?.startTime;
			const shownFor = performance.now() - (fcp ?? performance.now());
			const wait = reduced ? 0 : Math.max(0, hold - shownFor);
			holdTimer = setTimeout(() => (leaving = true), wait);
		};

		// Two frames after mount the scene has presented its first canvas frame
		// (TwinkleStars starts it in an effect, which flushes before our first
		// rAF fires; if WebGL is unavailable the baked anchor stars in the sky
		// image cover instead). That is the whole story on the landing and the
		// content pages — but a tool has also claimed the veil by now, so we
		// then wait for it to say its restored state is really on screen.
		cancelPaint = afterPaint(() => {
			cancelReady = onVeilReady(dismiss);
			capTimer = setTimeout(dismiss, READY_CAP_MS);
		});

		// Backstop if transitionend never fires (throttled background tab).
		const bail = setTimeout(() => (show = false), 4000);
		return () => {
			cancelPaint();
			cancelReady();
			clearTimeout(holdTimer);
			clearTimeout(capTimer);
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

		<!-- The night gradient + grain — shared with the 404 (VeilGround.svelte,
		     colours in app.css --veil-ground-*). -->
		<VeilGround />
		<!-- The mark: rule / word / rule as one centered column. The rules are laid
		     out BY the word rather than the viewport, so they inherit its width
		     exactly and stay locked to it at every size — the frame belongs to the
		     word, not to the screen. -->
		<div class="mark">
			<HRule />

			<div class="word">
				<!-- Glow: a <use> clone of the glyphs (no byte cost) blurred behind the
				     ink. Its filter is static; only its opacity animates, so the pulse
				     stays compositor-only even while the main thread parses chunks. -->
				<svg class="glow" viewBox="0 0 413 72" aria-hidden="true">
					<use href="#veil-word" />
				</svg>
				<svg class="glyphs" viewBox="0 0 413 72">
					<g id="veil-word">
						<path
							d="M31.6 40.8a12 12 0 0 1-2.5 6.4l-.3.4q-.6.7-.8.7l-.6.2q-3 1-4.7 3l-2.1 2.3-.3-.4-.4-.4-.3-.3-2.9-2.5-.9-.6q-1-.6-2.6-1.1l-.5-.3-.5-.6A12 12 0 0 1 9.3 41h-8q-.2 0-.3.7-.3 3.2.2 5.3l.6 2.3-.5 1.4-.6 1.5c-.9 2.8-1 4 0 6.9a18 18 0 0 0 1.7 3.8c.4-.1.8-.9 1.1-1.3l.2-.4.2-.4q.7-1.2 1-1.5l.8-1q.6-.5.4-.2.6-1-.1-2.5l-.4-.6q-.4-.7-.4-.6 0-.7.5-1.5c.7-1.2 2-.9 2.8.2q1.2 2 .5 2.7-.6 1 .1 2.6.3.8 1.5 1.8 2 1.5 4 2.6l1.5 1q.3.2.5.7l.5.8 1.1 2.2 1.1 2.2.6 1.1.7 1h.1q.4 0 .7-.4.7-1.2 1.2-2.5l1.2-2.5.6-1 .4-1 .4-.7 3-2 1.2-.8 1.3-1q.9-.6 1.2-1.1.9-1.5.6-2.3t-.4-1.9q0-.6.7-1.7c.6-1.1 1.9-1.4 2.7-.3q.5.7.5 1.6l-.2.4-.5.7q-.6 1.3-.1 2.4l.7.6.6.6.7 1q.3.8.7 1.3.6 1.2 1.1 1.3l.4-.8 1-2.5.2-.5.1-.4c.6-2.2.7-3.5 0-5.7q0-.5 0-.4c-.3-.4-1.3-3-1.3-3.3l.1-.5V48l.1-.3.3-1.2.2-2.3V42l-.1-.6v-.7q-.5-.2-1.7-.1h-6.7m-6.7-29c-1.5 0-1.9 0-3.3-.2l-3.3-.3-1-.1a17 17 0 0 0-7.8.8h-.3l-.4.2c0 .6.7 1.5 1 2l1.6 1.4c.7.7 2 1.8 2.6 2.6l.5.7.4.7a24 24 0 0 1 2.2 8.6l-.2 1.2v.6q0 .3.2.7l2 4.6.3.5.3.6.3.5q.3.5.5.5l.4-.4 1.8-4q0-.4.6-1.6L24 30v-.6l-.3-1.2.1-1.7c.2-1.8.9-4.9 1.7-6.5l.5-1.1q.9-1.4 1.9-2.3l.8-.8.4-.3 1.7-1.7.6-1c.1-.4.7-2.3.7-2.7q0-.7-.5-.4l-1.3.7c-1.5.7-3.6 1.3-5.3 1.4m-15.6 28a17 17 0 0 1 2.2-8.1l1-1.6q.4-.4.4-1.1l-.3-.9-.4-.6q0 0-.4.3l-.7.7-2.6 1.8c-2 1-3.7 2-5 3.9L3 35l-1.2 2.5v.3l-.1.2-.4 1.2v.6zm18.7-11q0 1 .2 1.1v.2h.1l.6.8.3.5.4.6.3.5.5 1.2a15 15 0 0 1 1.2 5.8h8v-.6l-.2-.6-.2-.5-1-2.6-.6-.9q-1.1-2-3.8-3.5l-.9-.5-1.8-1q-1-.4-1.8-1.2l-.4-.3-.3-.5-.4.7zm3.8-5.2q0 1 .2 1l1.1.7q1 .7 1.7 1.5c.3.5 1 1.4 1 2q.2 1.5 1.8 1.5.4 0 .6-1 .3-1.9 1-4 .6-2 .5-4.2a15 15 0 0 0-.9-5.3q-.6 0-.7.5T37 17.6L35.4 19q-1.5 1-2.4 2.3c-.3.4-1.2 1.9-1.2 2.4m-31-2.8q0 2.5.5 4l1 3.7.3 1.8c0 .8 2 0 2.2-1.1q0-.4.5-1a8 8 0 0 1 3-3.2q.6-.2.6-1c0-.7-1-2-1.3-2.5q-.7-1-1.9-1.9L3.6 18q-.7-.4-1.3-1.5l-.6-.3-.4 1Q1 18.7.8 20.7"
						/>
						<path
							d="M83.3 54.2c-2 0-5-.5-6.4-1.9l-.8-.7a15.3 15.3 0 0 1-3.5-7v-.4l-4-2.4-.8-.5-1-.6q-.3 0-.5.2l.1.3v.2l.1.2.5 2c.7 3.5 1.3 7.2 2.8 10.5a12 12 0 0 0 2.7 4l.8.9 1.9 1.4q.3.3.5 1.2l.5 2.8a36 36 0 0 0 1.4 5.4q.3.2 1-.6l.1-.2.2-.2.6-.7.2-.2.2-.3 1.7-2 .2-.2 2-2.6 3-.5 1.5-.4a15 15 0 0 0 4.4-2.8l2.8-3 1.3-1.9L98 52l1.1-2.4 7.3-1.2q.3-.3.3-1-.6-.2-2.5-1.5l-2.8-2-.8-.4-.2-.1-.2-.2-.4-.2-2.4-1.5-1.6-1-1.6-.8-.2.1v.1l-.2 2.6c0 2-1.1 5.6-2.3 7.2l-.7 1-.3.2-.3.3-.5.4-1 .9q-.3 0-.5.3c-.5.5-1.5.9-2.2 1a9 9 0 0 1-2.8.5m-1-39.1-3 .5-1.4.4q-2.5 1-4 2.4l-1.4 1.3-2 2.4-1 1.6-.8 1.1-.6 1.2-.6 1.2-.3.6-.3.6-6.9.9q-.6.3-.6 1.2l.7.5 2.3 1.5.4.3.4.2 3.8 2.5.4.2.4.3 1.8 1 1.8 1.1h.6l.1-.5V37l.2-2a19 19 0 0 1 2.3-6.7q.6-1 1.2-1.5l.5-.4.6-.5 1.4-1 .6-.3q3.4-1.4 7.6-.4 1.6.4 2.7 1.3l.1.1.2.2c1.1.9 2.3 3 3 4.3q0 0 .3 1l.6 2 .3.7h.3l3.2 2c.3.3 2 1.6 2.4 1.4q.2 0 .1-.6v-.3q-.6-1.5-.8-3.1l-1.2-5.5q-1.2-4.5-3.3-7.2a14 14 0 0 0-3.7-3.2l-.3-.7q-.4-3-1.3-6.6 0-1-.3-1.6-.3-.8-.8-.1l-.3.3-.6.7-1.8 2.1-.3.4-.2.2-.1.2h-.1v.1l-1.7 2q-.5.4-.6.8M77.7 40a9 9 0 0 0 .8 3c0 .3.7 1.4.8 1.6l.8.8q.8.9 2.3 1.2.7.2 1.7 0h.2l.2-.1.2-.1q1-.5 1.3-.9l.2-.1v-.1q.6-.4 1-1.5c.2-.5.9-2.5.9-3.3q0-.7-.3-.9l-1.2-.1H85c-1 0-1.2 1.2-1.5 2l-.1.2v.3l-.5 1-.2-.4-.2-.6-.3-.5-.7-1.3q-.4-.7-.8-.7h-2.3q-.3 0-.8.5m5.7-5c0 .9 0 2.2.5 3l.3.4h3.2q.7-.2.7-.5 0-1.6-.3-2.5-.5-1.4-1.1-2.2l-.6-.6-.7-.4h-.2q-.5-.2 0 0l-.6-.2-.3.3-.4.6a4 4 0 0 0-.5 2m-5.8 2.8q0 .3.5.5t1.5.2h1.6c.6 0 1.2-1.9 1.2-2.6a7 7 0 0 0-.4-2.5l-.6-1q-.3-.2-.7-.2l-.6.3-.4.3-.3.3-.2.2c-.7.8-.5.5-.9 1.4l-.2.4q-.5 1-.5 2.7"
						/>
						<path
							d="m130.3 26.6.1.5 1.5.5q3.1 1 5.8 2.5l1.2.7q.3.1 1.3.8l1.2.8.7.5 1.1.6q1 .3 1.7-.1a20 20 0 0 1 6.7-1.7q0-.3-.3-.4l-2.8-2q-2.1-1.4-4.1-2.4l-1.6-.8-3.5-1.3-.5-.1q-.2 0-.4-.2 0 0-.3-.2-.2-.1.3-1.3l.4-.8q1-2.7 3-5.4l.8-1.2 1.1-1.3.1-.1.6-.6c.6.1 1.7 1.3 2.2 1.9q1.4 1.5 2.3 3l.5.7.2.4.5.9.6 1a25 25 0 0 1 2.3 7.2v2q0 .9 1 1.4l1 .2 1 .2 1.8.5 1 .3.8.3.9.4.8.3-.2-1-.3-1.3-.4-1-.3-1.2-.3-1.3-.2-.2V28l-.1-.3a40 40 0 0 0-3.1-8.2l-1-1.9-1-1.7-2.3-3.4-1-1.2-.6-.8-.6-.8L148 8l-1.9-1.6q-.9-.5-1.9-.5a3 3 0 0 0-1.6.6q-.3.1-1.1 1l-.6.5-.5.6-1 1.1-1.4 1.9-.1.1-.1.2-2.3 3.6-1.3 2c-.7 1.2-2.3 4.6-2.8 6l-.3.7-.3.8-.3.9q0 .2 0 .1zm2.8 26.9-.2-1q-.3-1.4-.4-2.8V47a14 14 0 0 1 1.7-6.7l.5-.7.5-.6.6.3.7.4.7.5.7.5 2.3 2 1.3 1.4 1.2 1.1q0 .2.5.6l.4.5-2.2 1.6-2.3 1.6-4 2.7-1 .7zm-6.6-4.6c0 3 0 5 .5 7.9q.7 4 2.3 7.1c.6 1.3.6 2.2 2.3.6l1-.8.8-.9 1-1.3v-1q0-.7.8-1.6l2-2c.8-1 3-2.5 4.1-3.2l1.4-.9 4.7-2.1.8-.3 1.7-.6q.6-.3.6-.6l-.2-.5-.4-.5-.4-1-.3-.6c-.8-1.8-1.7-4-2.8-5.7q-.4-.3-.6-.9l-.2-.2a12 12 0 0 0-2.5-2.6l-1.2-.7-1.3-.7q-.7-.4-1.2-.4l-10-.2c-.5 0-1.4 2.3-1.5 2.7l-1 5.2zm23.3-12.3.3.6.6.5q1.8 2.4 3.5 5l.2.4.2.4 1.2 2.2.3.4 1.3 2.6a34 34 0 0 1 4 15.8l-.2 1.3V67q.3.2.7-.4.2-.3.2-.1l.2-.4a34.6 34.6 0 0 0 2-11.3v-2.1c0-1-.1-6-.3-7.2l-.4-2.2a54 54 0 0 0-1.7-6.8q-.1-.6-1-.7h-4.7l-.6.1-1.3.1z"
						/>
						<path
							d="m191.4 7.6.3 1.4.3 1.6v.8l.1.8.2 5.2.2 18.1h7.9v-1.8l.2-3.4v-1.7q.7 0 1.2.3l1 .3q3 .6 5.5 1.4l3.2 1 1.3.4 1.3.5a8 8 0 0 1 2.2 2.7h7.5q0-.3.3-.4v-.3l-.2-1.4-.4-1-.5-1.1-.5-.7v-.2l-.2-.1-.3-.4-.4-.4q-.2 0-.5-.4a14 14 0 0 0-5.6-3.2q-2.4-.6-5.5-1.8a97 97 0 0 0-9.2-3.4q0-.6-.2-2l-.2-2q0-1.2-.2-1.6h.7l.7.2 1 .3 1 .2c.8.3 2 .9 2.7 1.4l3.2 1.8c2.2 1.4 4 2.6 6.8 3.1q2.4.7 4.4.4.3 0 .8-.2.3 0 .8-.2l1-.5.4-.2q.7-.4 1-1v-.2l.1-.2q.2-.3 0-.8 0-.4-.7-.3h-1a7 7 0 0 1-3-1l-.3-.2-1.4-1.2-.2-.2h-.1v-.1l-.4-.4-.1-.1q-.2 0-.2-.2l-.3-.3a32 32 0 0 0-5.1-3.4l-4.3-2.2-1-.3-1-.3-1-.2q-2-.7-4.3-1a25 25 0 0 0-8.2-.1h-.4zm25.4 29-.1-.2q-.3.4-.1.5l.1.6.4 2.8.4 3 .1 1.3.2 1.2.2 5.1c0 2.6-.3 7.4-1.2 10l-.2.7q0 .2-.4.7l-.2.4q-.3.3 0 .5l.2.3.4.3q1.4 1 3.3.5 2.7-.3 4.1.3a5 5 0 0 0 2 .7c.2 0 1 .3 1.4-.3l.3-.5q.3-.6.1-1.1l-.3-.3q-.3 0-.4-.4a9 9 0 0 1-1.8-3l-.3-1.6v-2.2l-.1-.3-.1-3.3V51l-.2-6.6v-5.3l-.1-1.9v-.4q-.1.1-.5-.4l-.5-.1h-6.7zm-24.3.7V39l.1 1.8v1l.1 1.8v.5l.1.4v2.3l.1.4.1 1.4V50l.3 3.5v.5l.1 1.4.5 6.2v.9l.1.4v.5l.2 2.6.8-.1 2.8-2 1-.8 1.5-1.3.4-.3.4-.3.5-.4.5-.5.4-.5.2-.4q0-.3-.4-.6l-.6-.5q-.4-.3-.7-1l-.2-.7a57 57 0 0 1-1-10.8l.1-1.3v-1.9l.2-1.2V41l.2-4.4-7.8.1zm12.6 8.8.2 1.3v.1q.6 1.2 1.5 1.7l.7.2.2.1h.4q1.5.4 2.2 0l.3-.2q.8-.3 1.2-1.1V48l.2-.1v-.2l.4-1v-1.1l-.2-1-.4-.7-.5-.5-.4-.4-.5-.4q-1-.4-2-.4l-.8.1-.6.3-.5.4c-.2.1-.7.9-.8 1.1q-.6 1-.6 2"
						/>
						<path
							d="m261.6 59.9.4.5.5.7q.7 1 .8 1.6t1.2 1q1 .6 2.2.5l1.4-.5q1.4-.4 2.1-.7l1.1-.4q.6 0 1-.3h1.8q.8 0 1.5.2.8.4 1.5.4 2 .6 3.5-.4.8-.4 1.1-1-.1-.8-.4-.7-.3 0-1.2-.5-.3-.1-.8-.5l-.4-.3-1.7-1.8q-1.4-2-2-5l-.4-1.7-.3-1.9v-1.4l-.1-.2v-.9q0-1.5.2-2.4l.3-1.1a14 14 0 0 1 2.4-4.6l.2-.2.1-.1 1-1.2 1-1.2.9-1 1-1 .2-.2.2-.2.2-.1q.3-.3.3-.8l-11.7.2h-.3l-10 .2c0 .6 1 1.9 1.4 2.3l1.8 2 1.2 1.4q.2.5.5.8a20 20 0 0 1 2.2 6.6v2.3c.1 2.8-1.3 7.5-2.9 9.6-.3.4-1.6 1.4-2.3 1.4q-.3 0-.5.2zm4-49.6c.1 3.2.1 4.4.7 7.6q.6 4.4 2.2 8.4l1.3 2.7q.4.6 1 .7.3 0 .6-.7l.4-.8.8-1.7.6-1.9.3-1 .2-1 .8-4.1q.6-5.2 0-9.3c-.3-1.3-.6-3-1.2-4.2l-.5-1.2-.5-1.1-.6-1.5q-.5-1-1-1.2l-.4.6v.1l-.1.2q-1.1 1.8-2 2.5a11 11 0 0 0-2 3.6zM248 30.8v.2q0 .6.2 1l20.5-.4-.5-.4-.4-.5-.8-.9-.4-.4-.4-.4-2.8-2.4q-1.3-.9-2.8-1c-1.9 0-5.5 1-6.8 2q-2.4 2-4 2.7zm25.2.7 3-.1 17.4-.3v-1l-.8-.3q-.8 0-1.5-.5a13 13 0 0 1-4-2.4q-1.1-1.2-4.2-1.7h-.9l-1-.1-1.6.4-.7.3-.6.5L277 28l-1.5 1.6-.2.2zM280 18q0 1.2.9 1.8 1.4 1.2 2.4 1.2l1-.4q1.8-.9 1.8-2.4l-.2-1.2q-.4-1-1.6-1.8l-1-.4-.8.1q-1 .2-1.6.8-.9 1.3-.9 2.3m-24.9.3q0 2 2 2.8l1.3.2q.9 0 2-1.1.9-1 .9-2a3 3 0 0 0-1-2.2l-1-.6q-.3-.3-.8-.1h-.7l-.8.3-.5.4-.1.2q-.7.5-1 1z"
						/>
						<path
							d="M312.6 31.7V34q0 1 .2 1h7q.1-4.8 1.8-9l1.3-2.8.6-1a21 21 0 0 1 2.7-3.3l1.1-1.2.8-.7.7-.6c.5-.5 2.6-2 3.2-2.4q.3 0 1 1 0-.2.3.1l.3.3.4.6 1.1 1 1 1 3 3.8q.9 1 1.2 1.8a27 27 0 0 1 2.5 5.5l.4 2.6v2l.1.9v.9h6.4c.2-1 .3-3.5.2-4.7v-.7l-.2-3.2q0-1-.2-1.1l-.2-.2-1-.9-1-.8-.5-.5-1-1.3-2-2.2-5.6-7.3-1.6-2.5-.9-1.1-1.1-1.6q-.3-.5-1.1-1t-1.3-.3l-2.6 1.3-4.4 2.7-2.5 2-.6.5-.8.7-.7.7-1.3 1.5-.6.8-1.3 1.6q-.6.7-1.4 2.2l-.3.4a25 25 0 0 0-3.1 11.2m30.6 5v1l-.1.5v.5l-.9 4c-.2 1-1 3.3-1.5 4.3l-.4.7-2.5 3.3-1.1 1.2-2.9 2.4-.3.2c-1.1.8-4.1 2.5-5.4 2.7h-2q-.8 0-1.1.3l-3.5 3.3-.3.2-.2.2-1.3 1.2q-.7.5-.3.8l.1.1h1a29 29 0 0 0 7.7-1 25 25 0 0 0 7.8-3l.6-.3q1-.7 2-1.1l2.8-2 2.6-2.4a21 21 0 0 0 4.7-10.3l1-6.8h-6.5m-9-.3c-.2.7-1 2.5-1.4 3l-.3.6-.5.7-1.9 3q-.8 1.4-1.5 3.1l-.2.9-.5-.8-.2-.2v-.1l-2.8-3.6-.8-1L323 41l-.2-.1-.3-.4-.3-.3q-.2 0-.3-.2l-.4-.4c-1.2-1.3-1.7-1.4-1.6-3.3l-7-.1q0 1 .6 2l.3.7.8 1.1.9 1q.6.8 2 1.8 1.5 1.2 3.2 2.3l.6.4 1 .8.3.2 3 3.1 1.2 1.6q0 .2.1 0l.4.5.8 1q.6.5 1.8-.4l.5-.3 1.5-1.3.5-.4 1-1 .7-1 1-1c.5-.8 2-3 2.5-4l.1-.3.2-.3c1-2 1.5-3.6 1.6-6zm-6-1.2v-.4c.4-1.2.6-1.5 1.2-2.7.4-.7 1.3-2.1 2-2.6.7.2 1.5 1.7 2 2.3l.4 1v.2l.2.4.1.6.1.5v.9h5.4q0-2.6-.7-4.6-.8-1.7-2-3.3l-3.4-4c-.2-.4-1.3-1.7-1.6-1.7q-.6 0-1.9 1l-.3.3-.7.7-.7.7-.6.7q-.2.1-.3.4-.8.7-1.2 1.5c-.7 1-2 3.3-2.2 4.6-.3 1.7-.2 1.8.2 3.5zm-.3 5.3q.3 0 .2-.3l-.1-.3c-.3-.6-.5-2.3-.2-2.8v-.8h-3.2v.3l.2.3c.1.5 1 2 1.4 2.5q.3 0 .5.4l.5.5zm-1.7-.4"
						/>
						<path
							d="m394.5 35.3.2.5.2.3v.2l.4.2.8.4c1.5.7 3.7 2.1 4.7 3.4l.4.5q.6.7.7 1.7V54l-.9.7-1.3.8q-1.5.6-2 .7h-2.1q-1.5-.3-2-1.2-.3-.4-.3-1.3V41.3l-.2-4.6v-1.1l-.1-.3h-4.6v2.2l.2 16.2-1.1-.7-.4-.3-.9-1-.3-.3-.3-.4q-1-1.3-1.5-3a21 21 0 0 1-1.7-11.8l.1-.8H375l-.1.4-.1.3a25 25 0 0 0 3.5 19.1q1 1.3 2 2.2l.4.3 1.4 1.1q2.4 1.8 4.8 2.6 2.5.8 5.3 1h1.2l4.1-.4a18 18 0 0 0 5.4-1.9l.1-.1 1.1-.7a11 11 0 0 0 2.6-2l.6-.5q1.7-1.7 2.6-3.2a19 19 0 0 0 1.6-15.7l-.4-1q-.3-1-.5-1l-.4-.8h-3.9zm-6.7-26.8c-1.3 0-6 0-6.7.4-.6.4.1 1.3.5 1.5l.7.5.8.4 1.8.5 2 .6 1.6.7q.9.5.9 1.8 0 .5-.7 1l-.8.8-1.3 1.2-1.6 1.4-2.3 2.2-.5-.6-1-1-.5-.7-.4-.6-.1-.2-.1-.1-.6-1-.6-1.1-.5-1.1-.6-1.5q-.4-1-.6-2.6-.1-.6-.6-.6l-.3.6v.2l-.1.2-.1.6-.2.6c-.4 2.9-.3 6.3 1 8.8l1.1 2 1 1.2.2.2.3.2-2.2 3.8-.6 1.1-.2.6a19 19 0 0 0-1.3 3.9h7.4l.2-.6.2-.7.3-1.2.4-1.1.5-1.2.5.7 1.5 1.7.7.7.3.4.4.3.5.9h4.5l-.1-.7-.1-.3-.1-.3q-.4-1.2-1.3-2.6l-.9-1-.7-.7-2.3-2.4c-1-1.2-1-.9.2-2.5l.3-.4q0-.2.3-.5l.6-.9.6-.7.2-.2 3-3 2.9-2.2q1.7-1.4 3.6-2.5l3.7-2.3 2-1.2.5-.4.6-.5q.6-.5-.2-.7h-3.9l-4.6.1h-3.4l-3.4.2h-2.3m7 18.1q0 1.3 1 2.5 1 .9 3 .9 1.4 0 2.3-1.1 1.1-1.8.9-3.4l-.6-1.2-.2-.2-.3-.3q-2-1.6-4.1-.7-.7.4-.9.6l-.2.2q-1 1.4-1 2.7"
						/>
					</g>
				</svg>
			</div>

			<HRule />
		</div>
	</div>
{/if}

<style>
	.veil {
		/* The three knobs worth turning by eye. Ink drives both the glyph fill
		   and its halo, so they can never drift apart.
		   Ink: the original #00a8ff read a touch too intense (Nate, 2026-07-26)
		   — same hue, saturation off 100% and lightness down a little, so the
		   script still glows without shouting.
		   ↻ 2026-09-26 (⚓ Nate): #2d98f5 → #24a0fe — HSL saturation 91% → 99%,
		   hue 208° → 206° (a small step toward cyan), lightness held at 57%.
		   Ground: the shared VEIL GROUND (VeilGround.svelte; its colours and
		   their derivation are the root tokens --veil-ground-* in app.css). */
		--veil-ink: #24a0fe;

		/* Horizontal rules. Tint themes the caps AND the line together (both are
		   currentColor, so there is one value to turn).
		   ↻ 2026-09-26: #82708a → #607b90. The old violet matched the retired
		   purple ground; the new tint is a quiet blue-grey on the INK's hue
		   (HSL 206° / 20% / 47%), so the frame belongs to the script rather
		   than to the ground, at the old tint's luminance (0.187 vs 0.182) so
		   the rules are exactly as present as before — only the hue moved.
		   Retune it WITH the ink: same hue, 20% saturation, luminance held.
		   ⚠️ The faintness is a GROUP opacity on the whole rule, not a
		   translucent color on its parts. The line overlaps each cap by 1px to
		   hide the seam, and two translucent layers stacking there would show
		   up as a brighter notch at both ends (measured at 8× — it is
		   obvious). Opaque parts + one group fade composites the rule as a
		   single shape first, so the overlap is invisible at any alpha.
		   ⚠️ The mark is centered as a column, so its absolute Y is inherited
		   from that centering and can land on a half-pixel (the word's height is
		   its width × 72/413 — rarely an integer). The rhythm INSIDE the mark
		   stays exact — gap, cap and line are whole pixels and shift together,
		   so the caps and the line never lose their shared centerline — but the
		   2px line may rasterize a touch soft. That is the price of tying the
		   frame to the word instead of the viewport, and at these opacities it
		   is not perceptible; forcing an integer origin would mean duplicating
		   the artwork's aspect ratio in CSS and hoping it never drifts. */
		--veil-rule-tint: #607b90;
		--veil-rule-opacity: 0.1;

		/* Geometry of the mark. The word's width lives here rather than on
		   .word because the rules share it — they are as wide as the glyph
		   artwork by construction, not by a second value kept in sync.
		   The gap is derived from the glow's blur radius instead of being a
		   hand-picked pixel count: a CSS blur(r) is a Gaussian of sigma r/2, so
		   its visible reach is ~1.5r and 2r clears it with a little air. Retune
		   the glow and the frame follows it out. */
		--veil-word-w: clamp(9.5rem, 23.8vw, 16.7rem);
		--veil-glow-blur: 0.75rem;
		--veil-rule-gap: calc(var(--veil-glow-blur) * 2);

		position: fixed;
		inset: 0;
		/* Above everything: the veil renders from the scene layout as a sibling
		   of .content (z:2), and it has to cover the opaque tool shell inside
		   .content too. */
		z-index: 20;
		display: grid;
		place-items: center;
		/* No background of its own: VeilGround paints the whole rect. */
		transition: opacity 400ms ease;
		/* CSS-only self-destruct: if JS never arrives (blocked, failed chunk),
		   the veil clears itself and the SSR'd scene shell remains usable. */
		animation: veil-bail 600ms ease 8s forwards;
	}

	.veil.leaving {
		opacity: 0;
		pointer-events: none;
	}

	/* The mark: rule / word / rule as one centered column. The column carries the
	   width, so the rules measure exactly as wide as the glyph artwork — they
	   are stretch-aligned flex children of it — and stay locked to the word at
	   every viewport size, with no second clamp to keep in sync. */
	.mark {
		/* Positioned so it paints ABOVE VeilGround, an absolute layer earlier in
		   the markup (an in-flow box would paint under it). */
		position: relative;
		display: flex;
		flex-direction: column;
		width: var(--veil-word-w);
		gap: var(--veil-rule-gap);
		/* The rules are shared HRule elements now; map the veil's own knobs onto
		   the component's generic ones so the tuned values keep their names. */
		--rule-tint: var(--veil-rule-tint);
		--rule-opacity: var(--veil-rule-opacity);
	}

	@keyframes veil-bail {
		to {
			opacity: 0;
			visibility: hidden;
		}
	}

	.word {
		position: relative;
		width: 100%;
	}

	.glyphs,
	.glow {
		display: block;
		width: 100%;
		height: auto;
		fill: var(--veil-ink);
	}

	/* Tight neon edge on the ink itself; the wide bloom is the blurred clone.
	   Mixed from --veil-ink so retuning the ink carries the halo with it. */
	.glyphs {
		filter: drop-shadow(0 0 6px color-mix(in srgb, var(--veil-ink) 55%, transparent));
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
		filter: blur(var(--veil-glow-blur));
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
