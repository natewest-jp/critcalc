<script lang="ts">
	import CritInstrument from './lib/CritInstrument.svelte';
	import IcdInstrument from './lib/IcdInstrument.svelte';

	// The Visualizers workspace: N side-by-side instrument slots, N derived from
	// viewport width. Every instrument mounts exactly once and hides via
	// display:none when unslotted, so its state (sliders, pins, presets)
	// survives swaps and slot-count changes. At one slot the pickers behave as
	// tabs — same model, no separate mobile mode.

	const INSTRUMENTS = [
		{ id: 'crit', name: 'Crit Heatmap' },
		{ id: 'icd', name: 'ICD Timeline' }
	] as const;
	type InstrumentId = (typeof INSTRUMENTS)[number]['id'];

	let vw = $state(0);
	const slotCount = $derived(Math.min(INSTRUMENTS.length, vw >= 2200 ? 3 : vw >= 1360 ? 2 : 1));

	// Position i holds the instrument shown in slot i; positions ≥ slotCount are
	// the "bench" (hidden but still mounted)
	let assignment = $state<InstrumentId[]>(['crit', 'icd']);

	const slotOf = (id: InstrumentId) => {
		const i = assignment.indexOf(id);
		return i >= 0 && i < slotCount ? i : -1;
	};

	// Picking an instrument already visible elsewhere swaps the two tiles
	function pick(slot: number, id: InstrumentId) {
		if (assignment[slot] === id) return;
		const existing = assignment.indexOf(id);
		const next = [...assignment];
		if (existing !== -1) next[existing] = next[slot];
		next[slot] = id;
		assignment = next;
	}
</script>

<svelte:window bind:innerWidth={vw} />

<svelte:head>
	<title>Visualizers | critcalc.app</title>
</svelte:head>

<div class="ws" style:--ws-slots={slotCount}>
	{#each INSTRUMENTS as inst (inst.id)}
		{@const slot = slotOf(inst.id)}
		<section class="ws-tile" class:ws-hidden={slot === -1} style:order={slot}>
			<nav class="ws-bar" aria-label="Instrument picker">
				{#each INSTRUMENTS as opt (opt.id)}
					<button
						class="ws-chip"
						class:active={opt.id === inst.id}
						onclick={() => pick(slot, opt.id)}
					>
						{opt.name}
					</button>
				{/each}
			</nav>
			<div class="ws-body">
				{#if inst.id === 'crit'}
					<CritInstrument />
				{:else if inst.id === 'icd'}
					<IcdInstrument />
				{/if}
			</div>
		</section>
	{/each}
</div>

<style>
	.ws {
		display: grid;
		grid-template-columns: repeat(var(--ws-slots, 1), minmax(0, 1fr));
		gap: 1.25rem;
	}

	.ws-tile {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: 0.7rem;
		min-width: 0;
	}

	.ws-hidden {
		display: none;
	}

	.ws-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.ws-chip {
		padding: 0.38rem 0.85rem;
		border: none;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.06);
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease;
	}

	.ws-chip:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text);
	}

	.ws-chip.active {
		background: color-mix(in srgb, var(--accent) 24%, var(--surface));
		color: var(--text);
	}

	.ws-body {
		min-height: 0;
	}

	@media (min-width: 1024px) {
		/* Fill the viewport between the Dire edge paddings; instruments manage
		   their own internal scroll */
		.ws {
			height: calc(100svh - var(--tool-pad-top, 2rem) - var(--tool-pad-bottom, 2rem));
		}
	}
</style>
