<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { claimVeilReady, afterPaint } from '$lib/landing/veilReady';
	import { SvelteSet } from 'svelte/reactivity';
	import CritInstrument from './lib/CritInstrument.svelte';
	import IcdInstrument from './lib/IcdInstrument.svelte';
	import ArtifactInstrument from './lib/ArtifactInstrument.svelte';
	import GaugeInstrument from './lib/GaugeInstrument.svelte';
	import ReactionCurvesInstrument from './lib/ReactionCurvesInstrument.svelte';
	import DefResInstrument from './lib/DefResInstrument.svelte';
	import WishInstrument from './lib/WishInstrument.svelte';
	import AnatomyInstrument from './lib/AnatomyInstrument.svelte';
	import InstrumentPicker from './lib/InstrumentPicker.svelte';
	import ToolStack from '$lib/components/ToolStack.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import {
		DEFAULT_ASSIGNMENT,
		INSTRUMENTS,
		MAX_SLOTS,
		effectiveSlots,
		loadWorkspace,
		normalizeAssignment,
		saveWorkspace,
		viewportCapacity,
		type HandoffMessage,
		type InstrumentHandle,
		type InstrumentId,
		type SlotPref
	} from './lib/workspace';
	import { decodeInstrumentParam, encodeInstrumentParam } from '$lib/utils/instrumentUrl';

	// The Visualizers workspace: N side-by-side instrument slots. Every
	// instrument mounts exactly once and hides via display:none when unslotted,
	// so its state (sliders, pins, presets) survives swaps and slot-count
	// changes. At one slot the picker behaves as a tab-switcher — same model, no
	// separate mobile mode.
	//
	// N is capacity ∩ preference: the viewport says how many FIT, the reader says
	// how many they WANT (fewer, bigger instruments is a legitimate taste on a
	// wide monitor). The preference only ever caps — it can't promise a lineup
	// the window can't paint, which is why the over-capacity options disable
	// rather than silently doing nothing.

	let vw = $state(0);
	const capacity = $derived(viewportCapacity(vw));
	let slotPref = $state<SlotPref>('auto');
	const slotCount = $derived(effectiveSlots(slotPref, capacity));

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

	// Hold the loading veil until the SAVED layout is the one on screen, not the
	// default one — otherwise a hard load shows the default lineup and then
	// swaps instruments under the reader. Claimed at init (see veilReady.ts);
	// no-op unless this load actually has a veil.
	const releaseVeil = claimVeilReady();

	onMount(() => {
		const stored = loadWorkspace();
		assignment = normalizeAssignment(stored?.assignment ?? DEFAULT_ASSIGNMENT);
		slotPref = stored?.slots ?? 'auto';
		restored = true;
		afterPaint(releaseVeil);
	});

	$effect(() => {
		if (restored) saveWorkspace(assignment, slotPref);
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
	// (nothing internal is persisted). The lineup size is layout too, so it
	// goes back to following the viewport.
	function resetWorkspace() {
		assignment = [...DEFAULT_ASSIGNMENT];
		slotPref = 'auto';
	}

	/** The lineup control's options: follow the viewport, or cap at 1..MAX_SLOTS. */
	const SLOT_OPTIONS: SlotPref[] = ['auto', ...Array.from({ length: MAX_SLOTS }, (_, i) => i + 1)];

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

<!-- The tool stack (toolbar round). The Visualizers is the one UNBENCHED tool
     — no working team, so no ribbon and no inset: its stack starts at the
     content margin. It still wears the same two bands as the others, which is
     what finally stops the toolbar jumping 192px sideways across a tool→tool
     fade.

     Band A is this tool's DOCUMENT row: the workspace is what you'd save and
     reset, and the lineup size is a property of the workspace, not of any one
     instrument. Band B is the VIEW row — and here it was already right: the
     per-tile picker bar predates the round and is the shape the other two
     tools were rebuilt toward. It subdivides by the tile grid instead of
     splitting left/right, which is what bandBFull is for. -->
<ToolStack>
	{#snippet bandALeft()}
		<span class="kicker ws-title">Workspace</span>
	{/snippet}

	{#snippet bandARight()}
		<!-- Lineup size. Options wider than the window DISABLE rather than
		     silently clamping — a control that accepts a press and does nothing
		     reads as broken. "Auto" is the resting state and the pre-control
		     behavior. -->
		<div class="segment ws-slots" role="radiogroup" aria-label="Instruments shown">
			{#each SLOT_OPTIONS as opt (opt)}
				{@const tooWide = opt !== 'auto' && opt > capacity}
				<button
					class="btn"
					class:is-active={slotPref === opt}
					role="radio"
					aria-checked={slotPref === opt}
					disabled={tooWide}
					title={tooWide
						? `The window is too narrow for ${opt} instruments side by side`
						: opt === 'auto'
							? 'Show as many instruments as the window fits'
							: `Show ${opt} instrument${opt === 1 ? '' : 's'} at a time`}
					onclick={() => (slotPref = opt)}
				>
					{opt === 'auto' ? 'Auto' : opt}
				</button>
			{/each}
		</div>
		<!-- "Reset workspace" and the per-tile "Reset" were two buttons, one word,
		     two levels — you could not tell from the label which one you were
		     about to press. This one resets the LAYOUT (which instruments, how
		     many); the tile's resets that instrument's CONTROLS. The rename fixed
		     the words; the marks finish the job — a GRID for the layout, the
		     rotate-back for a tile's own defaults. -->
		<button class="btn ws-reset" onclick={resetWorkspace}>
			<Mark name="layout" />
			Reset layout
		</button>
	{/snippet}

	{#snippet bandBFull()}
		<!-- One row of cells on the tile grid's own columns, so each picker sits
		     over the instrument it switches. -->
		<div class="ws-band" style:--ws-slots={slotCount}>
			{#each assignment.slice(0, slotCount) as id, slot (id)}
				<div class="ws-band-cell">
					<InstrumentPicker
						current={id}
						{assignment}
						{slotCount}
						{slot}
						onPick={(next) => pick(slot, next)}
					/>
					<span class="ws-band-actions">
						{#if handles[id]?.reset}
							<button
								class="btn btn--sm"
								onclick={() => handles[id]?.reset?.()}
								title="Reset this instrument's controls to their defaults"
							>
								<Mark name="reset" size={12} />
								Defaults
							</button>
						{/if}
						{#if handles[id]?.getShareState}
							<button
								class="btn btn--sm"
								class:ws-share-copied={copiedTile === id}
								onclick={() => shareTile(id)}
								title="Copy a link that reopens this instrument as it looks now"
							>
								<Mark name={copiedTile === id ? 'check' : 'share'} size={12} />
								{copiedTile === id ? 'Copied' : 'Share'}
							</button>
						{/if}
					</span>
				</div>
			{/each}
		</div>
	{/snippet}

	{#snippet surface()}
		<div class="ws" style:--ws-slots={slotCount}>
			{#each INSTRUMENTS as inst (inst.id)}
				{@const slot = slotOf(inst.id)}
				<section class="ws-tile" class:ws-hidden={slot === -1} style:order={slot}>
					<div class="ws-body">
						{#if slot !== -1 || everSlotted.has(inst.id)}
							{#if inst.id === 'crit'}
								<CritInstrument bind:this={handles.crit} />
							{:else if inst.id === 'icd'}
								<IcdInstrument
									bind:this={handles.icd}
									onHandoff={(msg) => deliverHandoff(msg, slot)}
								/>
							{:else if inst.id === 'rolls'}
								<ArtifactInstrument bind:this={handles.rolls} />
							{:else if inst.id === 'gauge'}
								<GaugeInstrument bind:this={handles.gauge} active={slotOf('gauge') !== -1} />
							{:else if inst.id === 'curves'}
								<ReactionCurvesInstrument bind:this={handles.curves} />
							{:else if inst.id === 'defres'}
								<DefResInstrument bind:this={handles.defres} />
							{:else if inst.id === 'wish'}
								<WishInstrument bind:this={handles.wish} />
							{:else if inst.id === 'anatomy'}
								<AnatomyInstrument bind:this={handles.anatomy} />
							{/if}
						{/if}
					</div>
				</section>
			{/each}
		</div>
	{/snippet}
</ToolStack>

<style>
	/* Band A's left zone: the workspace's name. It is the one tool whose band A
	   has no document tabs — there is nothing to switch between — so the kicker
	   holds the zone rather than leaving the band lopsided, the way an empty
	   left half read before. */
	.ws-title {
		font-size: var(--fs-xs);
	}

	/* The numerals are single characters; without a floor they'd render three
	   noticeably narrower targets than "Auto". */
	.ws-slots .btn {
		min-width: 1.9rem;
	}

	/* Over-capacity options explain themselves on hover, but the global
	   .btn:disabled kills pointer-events, which swallows the title tooltip.
	   The `disabled` attribute still blocks activation on its own. */
	.ws-slots .btn:disabled {
		pointer-events: auto;
		cursor: not-allowed;
	}

	/* The quieter of band A's two actions — resetting a layout is not what you
	   came for. */
	.ws-reset {
		color: color-mix(in srgb, var(--muted) 75%, transparent);
	}

	/* ── Band B: one row of cells on the TILE GRID's own columns ──
	   Same track definition and same gap as .ws below, inside the same band
	   padding, so cell N sits exactly over tile N at every lineup size. That
	   alignment is the reason the workspace grid took the band's padding: the
	   picker has to look like it belongs to the instrument beneath it. */
	.ws-band,
	.ws {
		display: grid;
		grid-template-columns: repeat(var(--ws-slots, 1), minmax(0, 1fr));
		gap: 1.25rem;
	}

	.ws-band-cell {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
		min-width: 0;
	}

	.ws-band-actions {
		display: flex;
		gap: 0.3rem;
		flex-shrink: 0;
	}

	.ws-share-copied {
		color: var(--ink-active);
		background: var(--sel-fill);
	}

	/* The workspace takes the bands' own horizontal padding — without it the
	   tiles would sit --band-pad-x left of the pickers that switch them.
	   (.ws-band needs none: the band it fills already supplies it.) */
	.ws {
		padding: 0 var(--band-pad-x);
	}

	/* The TILE is the query container every instrument sizes against — not the
	   instrument's own root, and never the viewport: a half-width tile on a wide
	   monitor must get the narrow layout. With the lineup control this is load
	   bearing, since the same window now yields 1-, 2- or 3-up tiles. Only the
	   generic name `instrument` exists; the per-instrument container names were
	   declared but never queried, and retired with the slot-count round.
	   inline-size only — size containment would collapse indefinite heights. */
	.ws-tile {
		display: flex;
		flex-direction: column;
		min-width: 0;
		container-type: inline-size;
		container-name: instrument;
	}

	.ws-hidden {
		display: none;
	}

	/* Both minimums are load-bearing, and min-width is the one that bites.
	   A grid item's automatic minimum is its MIN-CONTENT size, and the heatmap
	   sets its drawn frame's width inline in px — so after a wide lineup the
	   body's min-content is that stale wide box and the body refuses to shrink
	   with the tile, spilling over the neighbouring instrument. Zero here lets
	   the tile drive the width; the chart's ResizeObserver then refits into it.
	   Same law as the frames' min-height chain, one axis over. */
	.ws-body {
		flex: 1;
		min-height: 0;
		min-width: 0;
	}

	@media (min-width: 1024px) {
		/* Fill the viewport below the bands; instruments manage their own
		   internal scroll. The band stack and its gap come out of the budget —
		   BAND_STACK_TO_SURFACE, passed down by ToolStack. */
		.ws {
			height: calc(
				100svh - var(--chrome-h, 64px) - var(--tool-pad-top, 0.5rem) -
					var(--tool-pad-bottom, 3rem) - var(--band-a-h) - var(--band-b-h) - var(--band-stack-gap)
			);
		}
	}
</style>
