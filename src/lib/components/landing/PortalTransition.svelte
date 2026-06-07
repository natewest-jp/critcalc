<script lang="ts">
	import { onMount } from 'svelte';
	import {
		registerPortalRunner,
		prefersReducedMotion,
		PORTAL_SPIN_MS,
		PORTAL_TOOL_FADE_MS,
		PORTAL_SPIN_DEG,
		PORTAL_SCALE_END,
		PORTAL_VORTEX_FADE_AT,
		PORTAL_REDUCED_MS,
		PORTAL_HOLD_MS,
		PORTAL_BLACK_EASING_CSS,
		PORTAL_VORTEX_EASING_CSS,
		revealToolNow,
		isLandingPath,
		type PortalOrigin
	} from '$lib/landing/transition';

	// The iris-style tool transition. Lives above the content layer (z:3). On a
	// hero click a vortex plate spirals open from the clicked card while a black
	// backing fills in; at pure black the backing fades out to reveal the tool
	// (mounted beneath on its own black bg → dark-to-dark, reads as a fade-in).
	// Everything is transform + opacity on two pre-rendered layers — compositor-
	// only, so the heavy tool mount underneath can't stutter it.

	let backingEl: HTMLDivElement;
	let vortexEl: HTMLDivElement;
	let running = $state(false);
	let anims: Animation[] = [];
	let holdTimer: ReturnType<typeof setTimeout> | null = null;
	let revealRaf = 0;

	onMount(() => registerPortalRunner(run));

	function clearAnims() {
		for (const a of anims) a.cancel();
		anims = [];
		if (holdTimer) {
			clearTimeout(holdTimer);
			holdTimer = null;
		}
		if (revealRaf) {
			cancelAnimationFrame(revealRaf);
			revealRaf = 0;
		}
	}

	function run(toPath: string, origin: PortalOrigin | null, onCovered?: () => void) {
		clearAnims();
		running = true;

		const reduced = prefersReducedMotion();

		// Reverse (tool → landing): cover the tool with black, swap to the landing
		// beneath, then collapse the spiral back down to the hero card.
		if (isLandingPath(toPath)) {
			runReverse(origin ?? centreOrigin(), onCovered, reduced);
			return;
		}

		// Forward, no spiral (reduced motion / missing origin): a brief dip through
		// black that covers the content swap, then reveal.
		if (reduced || !origin) {
			const inA = backingEl.animate([{ opacity: 0 }, { opacity: 1 }], {
				duration: reduced ? PORTAL_REDUCED_MS : PORTAL_SPIN_MS,
				easing: 'linear',
				fill: 'forwards'
			});
			anims.push(inA);
			inA.finished.then(holdThenReveal).catch(() => {});
			return;
		}

		runForward(origin);
	}

	// --- Forward: spiral open from the card, black out, reveal the tool ----------

	function runForward(origin: PortalOrigin) {
		// Pin the vortex box so its centre sits on the click origin; transform-
		// origin: center then scales/rotates around exactly that point.
		vortexEl.style.left = `calc(${origin.x}px - 50vmax)`;
		vortexEl.style.top = `calc(${origin.y}px - 50vmax)`;

		// Black backing fills in over the spin, reaching FULL black exactly when the
		// vortex begins to fade (PORTAL_VORTEX_FADE_AT) and holding there — so the
		// vortex only ever dissolves over an already-opaque backing. If the backing
		// were still ramping when the vortex faded (it eases in late so the vortex
		// reads against the scene early), the centre would briefly show the scene
		// through — the "dip" before the reveal. Per-keyframe easing: ease-in across
		// 0 → fade-point, then hold.
		const blackIn = backingEl.animate(
			[
				{ opacity: 0, easing: PORTAL_BLACK_EASING_CSS },
				{ opacity: 1, offset: PORTAL_VORTEX_FADE_AT },
				{ opacity: 1 }
			],
			{ duration: PORTAL_SPIN_MS, fill: 'forwards' }
		);
		anims.push(blackIn);

		// Vortex grows + spins clockwise from the origin point.
		anims.push(
			vortexEl.animate(
				[
					{ transform: 'scale(0.02) rotate(0deg)' },
					{ transform: `scale(${PORTAL_SCALE_END}) rotate(${PORTAL_SPIN_DEG}deg)` }
				],
				{ duration: PORTAL_SPIN_MS, easing: PORTAL_VORTEX_EASING_CSS, fill: 'forwards' }
			)
		);

		// Rapid fade-out of the vortex over the tail, so the endpoint is pure black
		// even if the vortex itself didn't reach every border (the backing does).
		anims.push(
			vortexEl.animate(
				[
					{ opacity: 1, offset: 0 },
					{ opacity: 1, offset: PORTAL_VORTEX_FADE_AT },
					{ opacity: 0, offset: 1 }
				],
				{ duration: PORTAL_SPIN_MS, easing: 'linear', fill: 'forwards' }
			)
		);

		blackIn.finished.then(holdThenReveal).catch(() => {});
	}

	// At full black: DRIVE the tool reveal (un-suppress the shell), then wait two
	// frames so it's actually painted opaque before we fade the backing off it —
	// this is the handshake that closes the race a fixed hold can't. PORTAL_HOLD_MS
	// is then just an optional dwell on pure black (the tool already painted
	// beneath it) before the reveal fade begins.
	function holdThenReveal() {
		revealToolNow();
		revealRaf = requestAnimationFrame(() => {
			revealRaf = requestAnimationFrame(() => {
				holdTimer = setTimeout(revealThenReset, PORTAL_HOLD_MS);
			});
		});
	}

	// Reveal the tool by fading the black backing out (the vortex is already gone).
	// Dark-to-dark with the tool's black bg → reads as the tool fading in.
	function revealThenReset() {
		const out = backingEl.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: PORTAL_TOOL_FADE_MS,
			easing: 'linear',
			fill: 'forwards'
		});
		anims.push(out);
		out.finished.then(endRun).catch(() => {});
	}

	// --- Reverse: cover the tool, then collapse the spiral back to the card ------

	function runReverse(origin: PortalOrigin, onCovered?: () => void, reduced = false) {
		// Cover phase: black fills over the still-visible tool (mirror of the forward
		// reveal fade). At full black we swap to the landing beneath, then collapse.
		const cover = backingEl.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: reduced ? PORTAL_REDUCED_MS : PORTAL_TOOL_FADE_MS,
			easing: 'linear',
			fill: 'forwards'
		});
		anims.push(cover);
		cover.finished
			.then(() => {
				onCovered?.(); // navigate to the landing, mounting it beneath the black
				// Two frames for the landing to mount/paint beneath the black before
				// we start lifting it (the same paint gate as the forward reveal).
				revealRaf = requestAnimationFrame(() => {
					revealRaf = requestAnimationFrame(() =>
						reduced ? fadeOutBacking(PORTAL_REDUCED_MS) : collapse(origin)
					);
				});
			})
			.catch(() => {});
	}

	function collapse(origin: PortalOrigin) {
		// Anchor the vortex on the destination card; it appears full-screen and
		// shrinks down to that point, spinning clockwise (same sense as the forward).
		vortexEl.style.left = `calc(${origin.x}px - 50vmax)`;
		vortexEl.style.top = `calc(${origin.y}px - 50vmax)`;

		anims.push(
			vortexEl.animate(
				[
					{ transform: `scale(${PORTAL_SCALE_END}) rotate(0deg)` },
					{ transform: `scale(0.02) rotate(${PORTAL_SPIN_DEG}deg)` }
				],
				{ duration: PORTAL_SPIN_MS, easing: PORTAL_VORTEX_EASING_CSS, fill: 'forwards' }
			)
		);

		// Vortex fades in as it appears, holds, then fades out as it reaches the card.
		anims.push(
			vortexEl.animate(
				[
					{ opacity: 0, offset: 0 },
					{ opacity: 1, offset: 1 - PORTAL_VORTEX_FADE_AT },
					{ opacity: 1, offset: 0.85 },
					{ opacity: 0, offset: 1 }
				],
				{ duration: PORTAL_SPIN_MS, easing: 'linear', fill: 'forwards' }
			)
		);

		// Backing holds black, then fades out to reveal the landing as the spiral
		// shrinks — the mirror of the forward backing fill.
		const out = backingEl.animate(
			[
				{ opacity: 1, offset: 0 },
				{ opacity: 1, offset: 1 - PORTAL_VORTEX_FADE_AT },
				{ opacity: 0, offset: 1 }
			],
			{ duration: PORTAL_SPIN_MS, easing: 'linear', fill: 'forwards' }
		);
		anims.push(out);
		out.finished.then(endRun).catch(() => {});
	}

	function fadeOutBacking(ms: number) {
		const out = backingEl.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: ms,
			easing: 'linear',
			fill: 'forwards'
		});
		anims.push(out);
		out.finished.then(endRun).catch(() => {});
	}

	function centreOrigin(): PortalOrigin {
		return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
	}

	function endRun() {
		clearAnims();
		running = false;
	}
</script>

<div class="portal" class:running aria-hidden="true">
	<div class="portal-black" bind:this={backingEl}></div>
	<div class="portal-vortex" bind:this={vortexEl}>
		<picture>
			<source type="image/avif" srcset="/assets/transitions/vortex-plate.avif" />
			<source type="image/webp" srcset="/assets/transitions/vortex-plate.webp" />
			<img src="/assets/transitions/vortex-plate.webp" alt="" />
		</picture>
	</div>
</div>

<style>
	.portal {
		position: fixed;
		inset: 0;
		z-index: 3;
		pointer-events: none;
		/* Idle: hidden + off the paint path. .running flips it visible; the WAAPI
		   animations then own opacity/transform inline. */
		visibility: hidden;
	}

	.portal.running {
		visibility: visible;
	}

	.portal-black {
		position: absolute;
		inset: 0;
		background: #000;
		opacity: 0;
		will-change: opacity;
	}

	.portal-vortex {
		position: absolute;
		width: 100vmax;
		height: 100vmax;
		transform-origin: center;
		transform: scale(0.02);
		opacity: 0;
		will-change: transform, opacity;
	}

	.portal-vortex picture,
	.portal-vortex img {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
