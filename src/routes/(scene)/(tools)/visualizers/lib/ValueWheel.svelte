<script lang="ts">
	import { tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { T_QUICK, motion, introLive, outroInert, scrollBehavior } from '$lib/motion';

	// Dial-style value picker: click to unlock, scroll/drag spins the values
	// through the field (native scroll + CSS scroll-snap — momentum and touch
	// come free), click a value to select and close. Only legal values are
	// offered, so entry errors are impossible by construction.
	let {
		values,
		value = $bindable(''),
		label
	}: {
		/** Formatted option strings, ascending */
		values: string[];
		value?: string;
		label: string;
	} = $props();

	let open = $state(false);
	let listEl: HTMLElement | null = $state(null);
	let rootEl: HTMLElement | null = null;
	let centered = $state(0);

	const ITEM_H = 28;
	/** Rows above/below the highlight band */
	const PAD_ROWS = 2;

	const currentIndex = $derived(Math.max(0, values.indexOf(value)));

	async function openWheel() {
		open = true;
		centered = currentIndex;
		await tick();
		if (listEl) listEl.scrollTop = currentIndex * ITEM_H;
	}

	function commit(index: number) {
		value = values[Math.max(0, Math.min(values.length - 1, index))];
		open = false;
	}

	function onScroll() {
		if (!listEl) return;
		centered = Math.max(0, Math.min(values.length - 1, Math.round(listEl.scrollTop / ITEM_H)));
	}

	function onKeydown(event: KeyboardEvent) {
		if (!open) {
			if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
				event.preventDefault();
				openWheel();
			}
			return;
		}
		if (event.key === 'Escape') {
			open = false;
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const next = centered + (event.key === 'ArrowDown' ? 1 : -1);
			if (listEl) listEl.scrollTo({ top: next * ITEM_H, behavior: scrollBehavior() });
		} else if (event.key === 'Enter') {
			event.preventDefault();
			commit(centered);
		}
	}

	function onWindowPointerDown(event: PointerEvent) {
		if (open && rootEl && !rootEl.contains(event.target as Node)) open = false;
	}
</script>

<svelte:window onpointerdown={onWindowPointerDown} />

<div class="vw" bind:this={rootEl}>
	<button
		class="vw-field"
		class:open
		onclick={() => (open ? commit(centered) : openWheel())}
		onkeydown={onKeydown}
		aria-label={label}
		aria-expanded={open}
	>
		{value || '—'}
	</button>

	{#if open}
		<div
			class="vw-panel ctx-dark"
			style:--item-h="{ITEM_H}px"
			style:--pad-rows={PAD_ROWS}
			transition:fade={{ duration: motion(T_QUICK) }}
			onintrostart={introLive}
			onoutrostart={outroInert}
		>
			<div class="vw-band" aria-hidden="true"></div>
			<div class="vw-list" role="listbox" bind:this={listEl} onscroll={onScroll} tabindex="-1">
				<div class="vw-spacer"></div>
				{#each values as v, i (v)}
					<!-- Keyboard access lives on the field (arrows + Enter); reel items
					     are pointer targets only -->
					<div
						class="vw-item"
						class:centered={i === centered}
						role="option"
						aria-selected={v === value}
						tabindex="-1"
						onpointerup={() => commit(i)}
					>
						{v}
					</div>
				{/each}
				<div class="vw-spacer"></div>
			</div>
		</div>
	{/if}
</div>

<style>
	.vw {
		position: relative;
	}

	.vw-field {
		width: 100%;
		padding: 0.3rem 0.45rem;
		border: none;
		border-radius: 3px;
		background: var(--fill-rest);
		color: var(--text);
		/* Input field — one of the two sanctioned Mono homes (Nate 2026-07-24) */
		font-family: var(--font-mono);
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		text-align: right;
		cursor: pointer;
		transition: background var(--t-snap);
	}

	.vw-field:hover {
		background: var(--fill-hover);
	}

	.vw-field.open,
	.vw-field:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
		outline-offset: 1px;
	}

	.vw-panel {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		z-index: 30;
		width: max(100%, 5.4rem);
		height: calc(var(--item-h) * (var(--pad-rows) * 2 + 1));
		/* A popover over the instrument — the MODAL role, softer corner. */
		border-radius: var(--r-md);
		background: var(--surface); /* modal role (Nate 2026-07-31) */
		border: 1px solid var(--border);
		box-shadow: 0 10px 32px rgba(0, 0, 0, 0.55);
		overflow: hidden;
	}

	/* Highlight band marking the selection row */
	.vw-band {
		position: absolute;
		top: calc(var(--item-h) * var(--pad-rows));
		left: 4px;
		right: 4px;
		height: var(--item-h);
		border-radius: 3px;
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		pointer-events: none;
	}

	.vw-list {
		height: 100%;
		overflow-y: auto;
		scroll-snap-type: y mandatory;
		scrollbar-width: none;
		/* Fade the reel edges — the site's eased ramp (app.css § THE EASED RAMP:
		   smootherstep sampled at k/9), at the reel's own fixed length. It is
		   always on, so it is not a .scroll-fade, which fades by scroll position. */
		--vw-fade: 22%;
		--vw-mask: linear-gradient(
			to bottom,
			transparent 0%,
			rgb(0 0 0 / 0.012) calc(var(--vw-fade) * 0.1111),
			rgb(0 0 0 / 0.076) calc(var(--vw-fade) * 0.2222),
			rgb(0 0 0 / 0.21) calc(var(--vw-fade) * 0.3333),
			rgb(0 0 0 / 0.397) calc(var(--vw-fade) * 0.4444),
			rgb(0 0 0 / 0.603) calc(var(--vw-fade) * 0.5556),
			rgb(0 0 0 / 0.79) calc(var(--vw-fade) * 0.6667),
			rgb(0 0 0 / 0.924) calc(var(--vw-fade) * 0.7778),
			rgb(0 0 0 / 0.988) calc(var(--vw-fade) * 0.8889),
			#000 var(--vw-fade),
			#000 calc(100% - var(--vw-fade)),
			rgb(0 0 0 / 0.988) calc(100% - var(--vw-fade) * 0.8889),
			rgb(0 0 0 / 0.924) calc(100% - var(--vw-fade) * 0.7778),
			rgb(0 0 0 / 0.79) calc(100% - var(--vw-fade) * 0.6667),
			rgb(0 0 0 / 0.603) calc(100% - var(--vw-fade) * 0.5556),
			rgb(0 0 0 / 0.397) calc(100% - var(--vw-fade) * 0.4444),
			rgb(0 0 0 / 0.21) calc(100% - var(--vw-fade) * 0.3333),
			rgb(0 0 0 / 0.076) calc(100% - var(--vw-fade) * 0.2222),
			rgb(0 0 0 / 0.012) calc(100% - var(--vw-fade) * 0.1111),
			transparent 100%
		);
		-webkit-mask-image: var(--vw-mask);
		mask-image: var(--vw-mask);
	}

	.vw-list::-webkit-scrollbar {
		display: none;
	}

	.vw-spacer {
		height: calc(var(--item-h) * var(--pad-rows));
	}

	.vw-item {
		height: var(--item-h);
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding: 0 0.7rem;
		scroll-snap-align: center;
		font-family: var(--font-mono);
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		color: var(--muted);
		cursor: pointer;
	}

	.vw-item:hover {
		color: var(--text);
	}

	.vw-item.centered {
		color: var(--text);
	}
</style>
