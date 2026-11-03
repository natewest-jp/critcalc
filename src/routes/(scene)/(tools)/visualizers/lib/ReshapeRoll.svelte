<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import { portal } from '$lib/actions/portal';
	import Mark from '$lib/components/Mark.svelte';
	import type { ReshapeRoll } from './appraise';

	/**
	 * "TRY A RESHAPE": one reshape, played as the game plays it (Nate's
	 * recording, 2026-11-03). The piece appears on its starting rolls, every
	 * badge a dot; then each upgrade lands in turn, about half a second apart:
	 * the line's value and badge change at once, and a light sweeps its row,
	 * white then settling to gold on a selected line, a flat gray on another,
	 * with a ring bursting from the badge. A pause, then the game's "Select a
	 * Result to Keep": the original and the result side by side.
	 * ⚓ ONE LAYOUT FOR BOTH (Nate 2026-11-03): the rolling card IS the result
	 * card, centred while it rolls, so at the choice it only slides sideways
	 * into its place and the original fades in beside it. Everything the
	 * choice adds (the original, the totals, the radios, the verdict) is laid
	 * out during the roll but hidden, so nothing changes height and the panel
	 * never re-centres. On a phone the original appears under it instead, and
	 * the card doesn't move at all.
	 */
	type Line = { name: string; selected: boolean; wanted: boolean; unit: string };
	let {
		lines,
		original,
		originalCounts,
		roll,
		mainName,
		kind,
		originalValue,
		resultValue,
		verdict,
		onsettle,
		onclose,
		onretry
	}: {
		lines: Line[];
		/** The piece as it is: each line's value, and its rolls (first included) */
		original: string[];
		originalCounts: number[];
		roll: ReshapeRoll;
		mainName: string;
		/** "Standard", "Advanced", "Decreed" */
		kind: string;
		/** Your stats' value on each card ("34.2 CV"), under it */
		originalValue: string;
		resultValue: string;
		/** What the result means, said under the two cards */
		verdict: string;
		/** The result is showing: the chart behind can light where it landed */
		onsettle: () => void;
		onclose: (keep: boolean) => void;
		onretry: () => void;
	} = $props();

	/** 🎛️ The recording's pace: a pause to find the card (Nate: a little more
	 *  than the game's, so the eye knows where to look), then an upgrade every
	 *  STEP_MS. Was 600. */
	const INTRO_MS = 1100;
	const STEP_MS = 520;
	/** 🎛️ The pause on the finished piece before the choice, to take it in
	 *  (Nate: a little more). Was 800. */
	const OUTRO_MS = 1500;

	/** Upgrades shown so far */
	let shown = $state(0);
	let phase = $state<'rolling' | 'result'>('rolling');
	let keep = $state<'original' | 'result'>('original');
	let confirmEl = $state<HTMLButtonElement>();

	const values = $derived.by(() => {
		const v = [...roll.start];
		for (const s of roll.steps.slice(0, shown)) v[s.line] = s.value;
		return v;
	});
	const upgrades = $derived.by(() => {
		const u = lines.map(() => 0);
		for (const s of roll.steps.slice(0, shown)) u[s.line] = s.upgrades;
		return u;
	});
	/** Each line's latest flash: a new key replays the sweep */
	const flashes = $derived.by(() => {
		const f = lines.map(() => 0);
		roll.steps.slice(0, shown).forEach((s, k) => (f[s.line] = k + 1));
		return f;
	});

	let timers: ReturnType<typeof setTimeout>[] = [];
	function clearTimers() {
		timers.forEach(clearTimeout);
		timers = [];
	}
	function toResult() {
		clearTimers();
		shown = roll.steps.length;
		phase = 'result';
		keep = 'original';
		onsettle();
	}
	function play() {
		clearTimers();
		shown = 0;
		phase = 'rolling';
		// reduced motion: no light show, straight to the choice
		if (motion(STEP_MS) === 0) return toResult();
		roll.steps.forEach((_, k) => {
			timers.push(setTimeout(() => (shown = k + 1), INTRO_MS + k * STEP_MS));
		});
		timers.push(setTimeout(toResult, INTRO_MS + (roll.steps.length - 1) * STEP_MS + OUTRO_MS));
	}
	onMount(() => {
		play();
		return clearTimers;
	});

	// A new roll (Try again) plays from its start
	let lastRoll: ReshapeRoll | null = null;
	$effect(() => {
		if (lastRoll && lastRoll !== roll) play();
		lastRoll = roll;
	});
	$effect(() => {
		if (phase === 'result') confirmEl?.focus();
	});

	function onKey(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		e.preventDefault();
		if (phase === 'rolling') toResult();
		else onclose(false);
	}
</script>

<svelte:window onkeydown={onKey} />

{#snippet card(vals: string[], counts: number[] | null, ups: number[] | null)}
	<div class="rr-card">
		<div class="rr-main">
			<Mark name="mainStat" size={12} />
			<span>{mainName}</span>
		</div>
		{#each lines as l, i (i)}
			{@const n = counts ? counts[i] - 1 : (ups?.[i] ?? 0)}
			<div class="rr-line" class:is-wanted={l.wanted}>
				{#if !counts}
					{#key flashes[i]}
						{#if flashes[i]}
							<span class="rr-flash" class:is-gold={l.selected} aria-hidden="true">
								<span class="rr-flash-white"></span>
								<span class="rr-flash-tone"></span>
								{#if l.selected}<span class="rr-ring"></span>{/if}
							</span>
						{/if}
					{/key}
				{/if}
				<span class="rr-badge" class:is-zero={n === 0}>{n || ''}</span>
				<span class="rr-name">{l.name}</span>
				<span class="rr-value">{vals[i]}{l.unit}</span>
				<span class="rr-coin" class:is-on={l.selected} aria-hidden="true"></span>
			</div>
		{/each}
	</div>
{/snippet}

<div
	class="rr-backdrop"
	use:portal
	transition:fade={{ duration: motion(T_QUICK) }}
	onintrostart={introLive}
	onoutrostart={outroInert}
	role="presentation"
>
	<div class="rr-panel ctx-dark" role="dialog" aria-modal="true" aria-labelledby="rr-title">
		<h2 class="rr-title" id="rr-title">
			{phase === 'rolling' ? `${kind} reshape` : 'Select a result to keep'}
		</h2>
		<div class="rr-pair" class:is-rolling={phase === 'rolling'}>
			<label
				class="rr-choice rr-choice--original"
				class:is-on={phase === 'result' && keep === 'original'}
				inert={phase === 'rolling'}
			>
				{@render card(original, originalCounts, null)}
				<span class="rr-total">{originalValue}</span>
				<span class="rr-radio">
					<input type="radio" name="rr-keep" value="original" bind:group={keep} />
					Keep the original
				</span>
			</label>
			<span class="rr-arrow" aria-hidden="true"><Mark name="forwardSlim" size={14} /></span>
			<label
				class="rr-choice rr-choice--result"
				class:is-on={phase === 'result' && keep === 'result'}
			>
				<div aria-live="polite">
					{#if phase === 'rolling'}
						{@render card(values, null, upgrades)}
					{:else}
						{@render card(roll.final, roll.counts, null)}
					{/if}
				</div>
				<span class="rr-total rr-later">{resultValue}</span>
				<span class="rr-radio rr-later" inert={phase === 'rolling'}>
					<input type="radio" name="rr-keep" value="result" bind:group={keep} />
					Keep the reshaped result
				</span>
			</label>
		</div>
		<p class="note rr-verdict rr-later">{verdict}</p>
		<div class="rr-actions">
			{#if phase === 'rolling'}
				<button class="btn" onclick={toResult}>Skip</button>
			{:else}
				<button class="btn" onclick={onretry}><Mark name="dice" size={13} /> Try again</button>
				<button
					class="btn btn--primary"
					bind:this={confirmEl}
					onclick={() => onclose(keep === 'result')}>Confirm</button
				>
			{/if}
		</div>
	</div>
</div>

<style>
	/* ⚓ NO DIM (Nate 2026-11-03), unlike the site's other dialogs: the dot
	   strip behind is where the roll lands, so it stays in view. The backdrop
	   still holds the page (a click outside does nothing); the panel stands
	   off the chart on a deep shadow instead, seated high so the strip at the
	   chart's foot shows under it. 🎛️ --rr-top. */
	.rr-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: grid;
		place-items: start center;
		padding: var(--rr-top, 12vh) 1rem 1rem;
		background: transparent;
	}

	.rr-panel {
		display: grid;
		gap: 1rem;
		width: min(44rem, 100%);
		max-height: calc(100vh - 2rem);
		overflow-y: auto;
		padding: 1.2rem 1.3rem 1.1rem;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface);
		color: var(--text);
		box-shadow:
			0 18px 60px rgba(0, 0, 0, 0.75),
			0 4px 16px rgba(0, 0, 0, 0.5);
	}

	.rr-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
		text-align: center;
	}

	/* ── A card: the main stat, then the four lines ── */
	.rr-card {
		display: grid;
		gap: 0.15rem;
		padding: 0.5rem 0.6rem 0.6rem;
		border: 1px solid color-mix(in srgb, var(--text) 16%, transparent);
		border-radius: var(--r-sm);
		background: color-mix(in srgb, var(--text) 4%, transparent);
	}

	.rr-main {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.3rem 0.4rem;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	.rr-main :global(svg) {
		color: var(--muted);
	}

	.rr-line {
		position: relative;
		display: grid;
		grid-template-columns: 1.4rem minmax(0, 1fr) auto 1rem;
		align-items: center;
		gap: 0.45rem;
		min-height: 2rem;
		padding: 0 0.4rem 0 0.3rem;
		border-radius: 3px;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
	}

	.rr-line > :not(.rr-flash) {
		position: relative;
	}

	.rr-line.is-wanted .rr-name {
		color: var(--accent);
	}

	.rr-value {
		font-variant-numeric: tabular-nums;
	}

	.rr-badge {
		display: inline-grid;
		place-items: center;
		width: 1.2rem;
		height: 1.2rem;
		border-radius: 50%;
		background: var(--accent);
		color: var(--frame-bg);
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		font-variant-numeric: tabular-nums;
	}

	.rr-badge.is-zero {
		width: 0.4rem;
		height: 0.4rem;
		margin: auto;
		background: var(--muted);
	}

	/* The gold coin the game puts on a line chosen for the reshape */
	.rr-coin.is-on {
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--frame-bg) 35%, transparent);
	}

	/* ── THE SWEEP: a row's light as an upgrade lands on it ──
	   From the recording: a white streak (bright at the badge, thinning to the
	   right) that settles to gold on a selected line, and a flat gray on one
	   that isn't; a ring bursts from a selected line's badge. 🎛️ The clocks:
	   the white over --rr-white-ms, the tone over --rr-tone-ms, both linear
	   (the fade law). Reduced motion never plays it (the roll skips to the
	   choice). */
	.rr-flash {
		position: absolute;
		inset: 0;
		border-radius: 3px;
		pointer-events: none;
	}

	.rr-flash > span {
		position: absolute;
		inset: 0;
		border-radius: inherit;
	}

	.rr-flash-white {
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--chrome) 90%, transparent),
			color-mix(in srgb, var(--chrome) 30%, transparent)
		);
		opacity: 0;
		animation: rr-white var(--rr-white-ms, 380ms) linear;
	}

	.rr-flash-tone {
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--text) 16%, transparent),
			color-mix(in srgb, var(--text) 8%, transparent)
		);
		opacity: 0;
		animation: rr-tone var(--rr-tone-ms, 900ms) linear;
	}

	.rr-flash.is-gold .rr-flash-tone {
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--accent) 20%, transparent),
			color-mix(in srgb, var(--accent) 80%, transparent)
		);
	}

	.rr-flash:not(.is-gold) .rr-flash-white {
		background: color-mix(in srgb, var(--chrome) 25%, transparent);
	}

	/* The burst at the badge: a ring that grows and thins. Its alpha is in
	   the paint (border-color), not `opacity`, because it is scale-placed. */
	.rr-flash > .rr-ring {
		inset: auto;
		left: calc(0.3rem + 0.6rem - 14px);
		top: calc(50% - 14px);
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2px solid transparent;
		animation: rr-ring 520ms linear;
	}

	@keyframes rr-white {
		0% {
			opacity: 0;
		}
		12% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	@keyframes rr-tone {
		0% {
			opacity: 0;
		}
		25% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	@keyframes rr-ring {
		0% {
			scale: 0.4;
			border-color: var(--chrome);
		}
		100% {
			scale: 1.7;
			border-color: transparent;
		}
	}

	/* ── The choice: the original and the result side by side ──
	   The same grid while it rolls: the result card is moved left by half its
	   own width plus half the arrow and one gap, which centres it, and slides
	   back at the choice (--t-move, travel). With `left`, not a transform: a
	   box snaps to whole pixels, where a transform-placed card's sweeps would
	   fade at fractional offsets (ui.md, sub-pixel laws). What the choice adds
	   waits hidden, holding its room. */
	.rr-pair {
		--rr-gap: 0.6rem;
		--rr-arrow-w: 1.5rem;
		display: grid;
		grid-template-columns: minmax(0, 1fr) var(--rr-arrow-w) minmax(0, 1fr);
		align-items: start;
		gap: var(--rr-gap);
	}

	.rr-choice--result {
		position: relative;
		left: 0;
		transition:
			left var(--t-move),
			background var(--t-snap);
	}

	.rr-pair.is-rolling .rr-choice--result {
		left: calc(-50% - var(--rr-arrow-w) / 2 - var(--rr-gap));
	}

	.rr-choice--original,
	.rr-arrow,
	.rr-later {
		transition:
			opacity var(--t-quick) linear,
			visibility var(--t-quick) linear;
	}

	.rr-pair.is-rolling .rr-choice--original,
	.rr-pair.is-rolling .rr-arrow,
	.rr-pair.is-rolling .rr-later,
	.rr-panel:has(.rr-pair.is-rolling) .rr-verdict {
		opacity: 0;
		visibility: hidden;
	}

	/* A phone: one column, the result first and the original under it, so
	   the rolling card never moves */
	@media (max-width: 40rem) {
		.rr-pair {
			grid-template-columns: minmax(0, 1fr);
		}
		.rr-choice--result {
			order: 1;
		}
		.rr-arrow {
			order: 2;
			rotate: -90deg;
			justify-self: center;
		}
		.rr-choice--original {
			order: 3;
		}
		.rr-pair.is-rolling .rr-choice--result {
			left: 0;
		}
	}

	.rr-arrow {
		align-self: center;
	}

	/* Your stats on each card, under it: the figure the choice is about */
	.rr-total {
		text-align: center;
		font-size: var(--fs-xl);
		font-weight: var(--fw-bold);
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}

	.rr-arrow {
		color: var(--muted);
	}

	.rr-choice {
		display: grid;
		gap: 0.5rem;
		padding: 0.4rem;
		border-radius: var(--r-sm);
		cursor: pointer;
		transition: background var(--t-snap);
	}

	.rr-choice.is-on {
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	.rr-radio {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		font-size: var(--fs-md);
		color: var(--text);
	}

	.rr-radio input {
		accent-color: var(--accent);
	}

	.rr-verdict {
		margin: 0;
		text-align: center;
		color: var(--text);
	}

	.rr-actions {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
	}
</style>
