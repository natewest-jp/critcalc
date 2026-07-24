<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';
	import CritInstrument from './lib/CritInstrument.svelte';
	import IcdInstrument from './lib/IcdInstrument.svelte';
	import ArtifactInstrument from './lib/ArtifactInstrument.svelte';
	import GaugeInstrument from './lib/GaugeInstrument.svelte';
	import ReactionCurvesInstrument from './lib/ReactionCurvesInstrument.svelte';
	import DefResInstrument from './lib/DefResInstrument.svelte';
	import InstrumentPicker from './lib/InstrumentPicker.svelte';
	import {
		DEFAULT_ASSIGNMENT,
		INSTRUMENTS,
		loadAssignment,
		normalizeAssignment,
		saveAssignment,
		type HandoffMessage,
		type InstrumentHandle,
		type InstrumentId
	} from './lib/workspace';
	import { decodeInstrumentParam, encodeInstrumentParam } from '$lib/utils/instrumentUrl';

	// The Visualizers workspace: N side-by-side instrument slots, N derived from
	// viewport width. Every instrument mounts exactly once and hides via
	// display:none when unslotted, so its state (sliders, pins, presets)
	// survives swaps and slot-count changes. At one slot the picker behaves as
	// a tab-switcher — same model, no separate mobile mode.

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
	// the "bench" (hidden but still mounted). SSR paints the deterministic
	// default; the saved layout restores in onMount pre-paint, and only then
	// does the persist effect arm (restored gate) — the planner's SSR pattern.
	let assignment = $state<InstrumentId[]>([...DEFAULT_ASSIGNMENT]);
	let restored = $state(false);

	onMount(() => {
		assignment = normalizeAssignment(loadAssignment() ?? DEFAULT_ASSIGNMENT);
		restored = true;
	});

	$effect(() => {
		if (restored) saveAssignment(assignment);
	});

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

	// Layout only — instrument-internal state is deliberately untouched
	// (nothing internal is persisted)
	function resetWorkspace() {
		assignment = [...DEFAULT_ASSIGNMENT];
	}

	// ── Instrument handles ─────────────────────────────────────────────────
	// Optional per-instrument capabilities (share state in/out, handoff intake)
	// exposed as component `export function`s and collected via bind:this.
	// Method calls, not mount-time props: with keep-alive a target may already
	// be mounted when a link or handoff arrives.
	let handles = $state<Partial<Record<InstrumentId, InstrumentHandle>>>({});

	// ── `?i=` deep links ───────────────────────────────────────────────────
	// afterNavigate, NOT onMount (team-builder lessons): SPA mounts run before
	// location updates; afterNavigate also fires for the navigation that
	// REMOVES this component (guard nav.to); read nav.to.url, never
	// window.location; strip with NATIVE history.replaceState (the
	// $app/navigation version throws pre-router-init on cold load).
	afterNavigate(async (nav) => {
		const url = nav.to?.url;
		if (!url || !url.pathname.startsWith('/crit-visualizer')) return;
		const param = url.searchParams.get('i');
		if (!param) return;
		history.replaceState(history.state, '', url.pathname + url.hash);
		const decoded = await decodeInstrumentParam(param);
		if (!decoded || !INSTRUMENTS.some((i) => i.id === decoded.id)) return;
		const id = decoded.id as InstrumentId;
		// The link's instrument becomes slot 0 of the (restored) layout — the
		// onMount restore has already run on cold load, so this layers on top
		// and the persist effect records the result.
		pick(0, id);
		await tick(); // lets the everSlotted effect mount a deferred instrument
		if (decoded.state !== null) handles[id]?.applyShareState?.(decoded.state);
	});

	// ── Per-tile share ─────────────────────────────────────────────────────
	let copiedTile = $state<InstrumentId | null>(null);
	async function shareTile(id: InstrumentId) {
		const param = await encodeInstrumentParam(id, handles[id]?.getShareState?.());
		await navigator.clipboard.writeText(`${location.origin}/crit-visualizer?i=${param}`);
		copiedTile = id;
		setTimeout(() => {
			if (copiedTile === id) copiedTile = null;
		}, 1500);
	}

	// ── Cross-instrument handoff ───────────────────────────────────────────
	// Parent-mediated: the workspace owns slotting the target into view (beside
	// the source when there's room) and the tick() a deferred mount needs.
	async function deliverHandoff(msg: HandoffMessage, sourceSlot: number) {
		if (slotOf(msg.target) === -1) {
			pick(slotCount > 1 ? (sourceSlot + 1) % slotCount : 0, msg.target);
		}
		await tick();
		handles[msg.target]?.receiveHandoff?.(msg.kind, msg.payload);
	}
</script>

<svelte:window bind:innerWidth={vw} />

<svelte:head>
	<title>Visualizers | critcalc.app</title>
</svelte:head>

<div class="ws-toolbar">
	<button class="ws-reset" onclick={resetWorkspace}>Reset workspace</button>
</div>

<div class="ws" style:--ws-slots={slotCount}>
	{#each INSTRUMENTS as inst (inst.id)}
		{@const slot = slotOf(inst.id)}
		<section class="ws-tile" class:ws-hidden={slot === -1} style:order={slot}>
			<nav class="ws-bar" aria-label="Instrument picker">
				<InstrumentPicker
					current={inst.id}
					{assignment}
					{slotCount}
					{slot}
					onPick={(id) => pick(slot, id)}
				/>
				{#if handles[inst.id]?.getShareState}
					<button
						class="ws-share"
						class:ws-share-copied={copiedTile === inst.id}
						onclick={() => shareTile(inst.id)}
						title="Copy a link that reopens this instrument as it looks now"
					>
						{copiedTile === inst.id ? '✓ Copied' : '⤴ Share'}
					</button>
				{/if}
			</nav>
			<div class="ws-body">
				{#if slot !== -1 || everSlotted.has(inst.id)}
					{#if inst.id === 'crit'}
						<CritInstrument bind:this={handles.crit} />
					{:else if inst.id === 'icd'}
						<IcdInstrument onHandoff={(msg) => deliverHandoff(msg, slot)} />
					{:else if inst.id === 'rolls'}
						<ArtifactInstrument bind:this={handles.rolls} />
					{:else if inst.id === 'gauge'}
						<GaugeInstrument bind:this={handles.gauge} active={slotOf('gauge') !== -1} />
					{:else if inst.id === 'curves'}
						<ReactionCurvesInstrument />
					{:else if inst.id === 'defres'}
						<DefResInstrument />
					{/if}
				{/if}
			</div>
		</section>
	{/each}
</div>

<style>
	.ws-toolbar {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 0.55rem;
	}

	.ws-reset {
		padding: 0.2rem 0.5rem;
		border: none;
		border-radius: 3px;
		background: none;
		color: color-mix(in srgb, var(--muted) 75%, transparent);
		font-size: var(--fs-sm);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		cursor: pointer;
		transition: color 150ms ease;
	}

	.ws-reset:hover {
		color: var(--text);
	}

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
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
	}

	.ws-share {
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
			color 150ms ease;
	}

	.ws-share:hover {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--text);
	}

	.ws-share-copied {
		color: var(--text);
		background: color-mix(in srgb, var(--accent) 20%, transparent);
	}

	.ws-body {
		min-height: 0;
	}

	@media (min-width: 1024px) {
		/* Fill the viewport between the Dire edge paddings; instruments manage
		   their own internal scroll */
		.ws {
			height: calc(
				100svh - var(--chrome-h, 56px) - var(--tool-pad-top, 2rem) - var(--tool-pad-bottom, 2rem) -
					1.9rem
			);
		}
	}
</style>
