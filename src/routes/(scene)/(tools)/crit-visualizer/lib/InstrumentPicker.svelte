<script lang="ts">
	import { portal } from '$lib/actions/portal';
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
	{currentName}
	<span class="ip-caret" aria-hidden="true">▾</span>
</button>

{#if open}
	<div class="ip-backdrop" use:portal onclick={() => close(false)} aria-hidden="true"></div>
	<div
		bind:this={listEl}
		class="ip-menu"
		use:portal
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
					<span class="ip-badge">Slot {at + 1} ⇄</span>
				{:else if inst.id === current}
					<span class="ip-badge ip-badge-here">●</span>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	/* Trigger inherits the active-chip look the chip row had */
	.ip-trigger {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.38rem 0.85rem;
		border: none;
		border-radius: 3px;
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent);
		color: var(--text);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background 150ms ease,
			box-shadow 150ms ease;
	}

	.ip-trigger:hover {
		background: color-mix(in srgb, var(--accent) 30%, transparent);
	}

	.ip-caret {
		font-size: var(--fs-xs);
		opacity: 0.7;
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
		font-size: var(--fs-md);
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
		font-family: var(--font-condensed);
		font-size: var(--fs-sm);
		font-weight: var(--fw-normal);
		letter-spacing: var(--ls-mid);
		text-transform: none;
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	.ip-badge-here {
		color: color-mix(in srgb, var(--accent) 80%, transparent);
	}
</style>
