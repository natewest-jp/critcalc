<script lang="ts">
	import { fade } from 'svelte/transition';
	import { portal } from '$lib/actions/portal';
	import Mark from '$lib/components/Mark.svelte';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import { closeOnLeave } from '$lib/closeOnLeave';
	import { INSTRUMENTS, type InstrumentId } from './workspace';

	// Per-tile instrument switcher: the chip row didn't scale past five
	// instruments, so each tile gets a compact trigger + portal listbox.
	// Picking an instrument already visible in another slot SWAPS the two
	// tiles (the parent's pick() semantics); at one slot this degrades to a
	// plain tab-switcher.
	let {
		current,
		assignment,
		slotCount,
		slot,
		onPick
	}: {
		current: InstrumentId;
		assignment: InstrumentId[];
		slotCount: number;
		/** This tile's slot index; -1 while benched (tile hidden, keep-alive) */
		slot: number;
		onPick: (id: InstrumentId) => void;
	} = $props();

	let open = $state(false);
	let activeIndex = $state(0);
	let triggerEl: HTMLButtonElement | null = null;
	let listEl = $state<HTMLDivElement | null>(null);
	let menuX = $state(0);
	let menuY = $state(0);

	const currentName = $derived(INSTRUMENTS.find((i) => i.id === current)?.name ?? current);

	// Which slot (if any) each instrument is visible in — drives the swap badge
	const slotOf = (id: InstrumentId) => {
		const i = assignment.indexOf(id);
		return i >= 0 && i < slotCount ? i : -1;
	};

	// A swap initiated from ANOTHER tile can bench this tile while its menu is
	// open; the portaled popover escapes the tile's display:none, so close it.
	$effect(() => {
		if (slot === -1) open = false;
	});
	// …and for the same reason, leaving the tool: the page is kept, paused, for
	// the pan, and the popover would ride over the incoming tool.
	closeOnLeave(
		() => open,
		() => close(false)
	);

	function openMenu() {
		if (!triggerEl) return;
		const rect = triggerEl.getBoundingClientRect();
		const menuW = 240;
		menuX = Math.min(rect.left, window.innerWidth - menuW - 8);
		menuY = rect.bottom + 6;
		activeIndex = INSTRUMENTS.findIndex((i) => i.id === current);
		open = true;
		queueMicrotask(() => listEl?.focus());
	}

	function close(refocus = true) {
		open = false;
		if (refocus) triggerEl?.focus();
	}

	function choose(id: InstrumentId) {
		close();
		if (id !== current) onPick(id);
	}

	function onTriggerKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			openMenu();
		}
	}

	function onListKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIndex = Math.min(INSTRUMENTS.length - 1, activeIndex + 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = Math.max(0, activeIndex - 1);
		} else if (e.key === 'Home') {
			e.preventDefault();
			activeIndex = 0;
		} else if (e.key === 'End') {
			e.preventDefault();
			activeIndex = INSTRUMENTS.length - 1;
		} else if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			choose(INSTRUMENTS[activeIndex].id);
		} else if (e.key === 'Escape' || e.key === 'Tab') {
			e.preventDefault();
			close();
		}
	}
</script>

<button
	bind:this={triggerEl}
	class="ip-trigger"
	aria-haspopup="listbox"
	aria-expanded={open}
	onclick={() => (open ? close(false) : openMenu())}
	onkeydown={onTriggerKeydown}
>
	<span class="ip-name-current">{currentName}</span>
	<span class="ip-caret"><Mark name="chevron" size={12} /></span>
</button>

<!-- Same treatment as BandMenu, deliberately: this is the other copy of the
     portalled-menu shape, and two menus on one site should not arrive
     differently. Surface band (--t-quick), fade only, outro made inert. -->
{#if open}
	<div
		class="ip-backdrop"
		use:portal
		transition:fade={{ duration: motion(T_QUICK) }}
		onintrostart={introLive}
		onoutrostart={outroInert}
		onclick={() => close(false)}
		aria-hidden="true"
	></div>
	<div
		bind:this={listEl}
		class="ip-menu"
		use:portal
		transition:fade={{ duration: motion(T_QUICK) }}
		onintrostart={introLive}
		onoutrostart={outroInert}
		style:left="{menuX}px"
		style:top="{menuY}px"
		role="listbox"
		aria-label="Choose instrument"
		tabindex="-1"
		onkeydown={onListKeydown}
	>
		{#each INSTRUMENTS as inst, idx (inst.id)}
			{@const at = slotOf(inst.id)}
			<div
				class="ip-option"
				class:ip-active={idx === activeIndex}
				role="option"
				aria-selected={inst.id === current}
				tabindex="-1"
				onclick={() => choose(inst.id)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						choose(inst.id);
					}
				}}
				onpointerenter={() => (activeIndex = idx)}
			>
				<span class="ip-name" class:ip-current={inst.id === current}>{inst.name}</span>
				{#if at !== -1 && at !== slot}
					<!-- Picking this one SWAPS the two tiles — the same exchange the
					     bench slots make, so it wears the same mark. -->
					<span class="ip-badge">Tile {at + 1} <Mark name="swap" size={12} /></span>
				{:else if inst.id === current}
					<span class="ip-badge ip-badge-here"><Mark name="check" size={12} /></span>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	/* ══ THE TILE'S NAMEPLATE (⚓ NATE 2026-08-13) ═══════════════════════════
	   A GLASS PLATE, and the widest one in its cell. It used to wear the SELECTED
	   idiom — an accent fill inside an accent ring — which was right while band B
	   was a rail and the trigger had to lift off it. With the rail gone that
	   reading is wrong twice over: gold means CHOSEN AMONG PEERS, and this
	   trigger has no peers (there is exactly one per tile, and what it names is
	   not a choice you are making but the instrument you are already looking at).
	   Plain glass, hovering and opening through the shared pane idiom.

	   ⚠ IT TAKES THE SLACK — flex: 1 — and that is what keeps the hierarchy after
	   the colour left. Nothing else in the cell grows, so the nameplate is always
	   the long plate and the actions are always the short ones; the tile's title
	   reads as the title because of its EXTENT, the way the band-B rail does in
	   the other two tools.
	   ⚠ Height comes from `.band-b .btn`… which this is not — it is not a .btn at
	   all — so it names --band-ctrl-h itself. One row, one height. */
	.ip-trigger {
		display: flex;
		flex: 1;
		min-width: 0;
		align-items: center;
		justify-content: space-between;
		gap: 0.45rem;
		height: var(--band-ctrl-h);
		padding: 0 0.85rem;
		border: none;
		border-radius: var(--band-radius);
		background: var(--surface);
		color: var(--text);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		text-align: left;
		cursor: pointer;
		transition:
			background var(--t-snap),
			box-shadow var(--t-snap);
	}

	/* The shared glass idiom: density + an INK ring for "here". Spelled locally
	   rather than reached for via .btn--glass because this is a listbox trigger,
	   not a button — but the values are the roles, so it moves when glass does. */
	.ip-trigger:hover,
	.ip-trigger[aria-expanded='true'] {
		background: var(--surface-hover);
		box-shadow: inset 0 0 0 1px var(--glass-ring);
	}

	/* The name has to ellipsize before the caret does: at three-up a cell is
	   ~1/3 of the surface minus two action plates, and "Reaction Curves" in
	   wide-tracked uppercase is the instrument that finds the edge first. */
	.ip-name-current {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Alpha in the PAINT, not element opacity: the whole Viz surface is
	   transform-placed while a tool transition glides it, and an opacity
	   subtree rasterizes at rounded coordinates (/styleguide § Laws). Mixing
	   into `color` works because the mark strokes currentColor — and
	   currentColor inside `color` itself resolves to the INHERITED value. */
	.ip-caret {
		display: flex;
		color: color-mix(in srgb, currentColor 70%, transparent);
	}

	.ip-backdrop {
		position: fixed;
		inset: 0;
		z-index: 90;
		background: transparent;
	}

	.ip-menu {
		position: fixed;
		z-index: 91;
		min-width: 240px;
		padding: 0.35rem;
		/* A portalled popover — the MODAL role, so it keeps the softer corner. */
		border-radius: var(--r-md);
		background: var(--surface); /* modal role (Nate 2026-07-31) */
		border: 1px solid var(--border);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
		outline: none;
	}

	.ip-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.45rem 0.6rem;
		border-radius: 3px;
		color: var(--muted);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		cursor: pointer;
	}

	.ip-option.ip-active {
		background: color-mix(in srgb, var(--accent) 16%, transparent);
		color: var(--text);
	}

	.ip-current {
		color: var(--text);
	}

	.ip-badge {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-family: var(--font-condensed);
		font-size: var(--fs-md);
		font-weight: var(--fw-normal);
		letter-spacing: var(--ls-mid);
		text-transform: none;
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	.ip-badge-here {
		color: color-mix(in srgb, var(--accent) 80%, transparent);
	}
</style>
