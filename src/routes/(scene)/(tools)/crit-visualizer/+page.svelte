<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import CritInstrument from './lib/CritInstrument.svelte';
	import IcdInstrument from './lib/IcdInstrument.svelte';
	import ArtifactInstrument from './lib/ArtifactInstrument.svelte';
	import GaugeInstrument from './lib/GaugeInstrument.svelte';
	import ReactionCurvesInstrument from './lib/ReactionCurvesInstrument.svelte';

	// The Visualizers workspace: N side-by-side instrument slots, N derived from
	// viewport width. Every instrument mounts exactly once and hides via
	// display:none when unslotted, so its state (sliders, pins, presets)
	// survives swaps and slot-count changes. At one slot the pickers behave as
	// tabs — same model, no separate mobile mode.

	const INSTRUMENTS = [
		{ id: 'crit', name: 'Crit Heatmap' },
		{ id: 'icd', name: 'ICD Timeline' },
		{ id: 'rolls', name: 'Artifact Rolls' },
		{ id: 'gauge', name: 'Gauge Explorer' },
		{ id: 'curves', name: 'Reaction Curves' }
	] as const;
	type InstrumentId = (typeof INSTRUMENTS)[number]['id'];

	let vw = $state(0);
	const slotCount = $derived(Math.min(INSTRUMENTS.length, vw >= 2200 ? 3 : vw >= 1360 ? 2 : 1));

	// Benched instruments don't mount until first slotted (then stay mounted so
	// their state keeps surviving swaps — the keep-alive model is unchanged;
	// pre-first-mount there is no state to lose). This keeps the other four
	// instruments out of the SSR HTML and the cold-load hydration pass, which
	// the 2026-07-10 perf audit measured as the bulk of this route's
	// main-thread blocking on throttled hardware (F8). Slotted-ness is checked
	// directly in the template (not via this set) for SSR, where effects don't
	// run; the set only preserves benched-after-slotted instruments.
	const everSlotted = new SvelteSet<InstrumentId>();
	$effect(() => {
		for (let i = 0; i < slotCount; i++) everSlotted.add(assignment[i]);
	});

	// Position i holds the instrument shown in slot i; positions ≥ slotCount are
	// the "bench" (hidden but still mounted)
	let assignment = $state<InstrumentId[]>(['crit', 'icd', 'rolls', 'gauge', 'curves']);

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
				{#if slot !== -1 || everSlotted.has(inst.id)}
					{#if inst.id === 'crit'}
						<CritInstrument />
					{:else if inst.id === 'icd'}
						<IcdInstrument />
					{:else if inst.id === 'rolls'}
						<ArtifactInstrument />
					{:else if inst.id === 'gauge'}
						<GaugeInstrument />
					{:else if inst.id === 'curves'}
						<ReactionCurvesInstrument />
					{/if}
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
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.06);
		color: var(--muted);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background 150ms ease,
			box-shadow 150ms ease,
			color 150ms ease;
	}

	.ws-chip:hover {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--text);
	}

	.ws-chip.active {
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent);
		color: var(--text);
	}

	.ws-body {
		min-height: 0;
	}

	@media (min-width: 1024px) {
		/* Fill the viewport between the Dire edge paddings; instruments manage
		   their own internal scroll */
		.ws {
			height: calc(
				100svh - var(--chrome-h, 56px) - var(--tool-pad-top, 2rem) - var(--tool-pad-bottom, 2rem)
			);
		}
	}
</style>
