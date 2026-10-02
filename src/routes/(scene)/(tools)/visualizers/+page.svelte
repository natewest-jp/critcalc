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
	import BreakdownInstrument from './lib/BreakdownInstrument.svelte';
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
	import { TOOL_GUTTER } from '$lib/toolGutter';
	import { scrollFade } from '$lib/actions/scrollFade';
	import { stripDeepLinkParams } from '../lib/deepLinkUrl';

	/**
	 * 🎛️ Bare scene BETWEEN two instruments — the widest gap inside this tool.
	 *
	 * ⚓ 2026-08-13: DOUBLE the tool gutter, and the doubling is the whole point.
	 * Since the instruments lost their frames there is no ground left to say
	 * where one ends and the next begins — the gap is the only boundary, and it
	 * was 20px against a 16px rhythm INSIDE each instrument (`.panels`' column
	 * gap). Four pixels cannot carry that distinction, so at three-up the three
	 * arguments read as one field of panels.
	 *
	 * This is the planner's law one axis over — the gap encodes GROUPING — and
	 * the same ratio the planner already uses where a tool meets a caption about
	 * itself (`.rotation-page`, deliberately double the gutter). Two rungs, and
	 * they must not collapse to equal.
	 */
	const TILE_GAP = TOOL_GUTTER * 2;

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
	// window.location. ⛔ The strip goes through `stripDeepLinkParams` — see that
	// file for why it must NOT use $app/navigation's replaceState, and for the
	// dev warning that is the accepted price.
	afterNavigate(async (nav) => {
		const url = nav.to?.url;
		if (!url || !url.pathname.startsWith('/visualizers')) return;
		const param = url.searchParams.get('i');
		if (!param) return;
		stripDeepLinkParams(url);
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
		await navigator.clipboard.writeText(`${location.origin}/visualizers?i=${param}`);
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
<ToolStack bandAClass="ws-lineup-band">
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
		     over the instrument it switches — and, since 2026-08-13, so does the
		     GROUND: band B stops painting for this tool and each cell is its own
		     run of glass plates, cut from its neighbours by the tile gap. See
		     .band--full in ToolStack for the rule; the controls' half of the
		     bargain is that every one of them is a plate (.btn--glass), because
		     there is no longer a rail for a button to sit on. -->
		<div class="ws-band" style:--ws-slots={slotCount} style:--ws-tile-gap="{TILE_GAP}px">
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
								class="btn btn--sm btn--glass"
								onclick={() => handles[id]?.reset?.()}
								title="Reset this instrument's controls to their defaults"
							>
								<Mark name="reset" size={12} />
								Defaults
							</button>
						{/if}
						{#if handles[id]?.getShareState}
							<button
								class="btn btn--sm btn--glass"
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
		<div class="ws" style:--ws-slots={slotCount} style:--ws-tile-gap="{TILE_GAP}px">
			{#each INSTRUMENTS as inst (inst.id)}
				{@const slot = slotOf(inst.id)}
				<section class="ws-tile" class:ws-hidden={slot === -1} style:order={slot}>
					<!-- THE TILE IS THE VIEWPORT (2026-08-17). See .ws-body's rule for
					     what was wrong before; the mask is unconditional and inert
					     until there is something to scroll, which is what makes it
					     safe on the narrow layout where the page scrolls instead. -->
					<div class="ws-body scroll-fade" use:scrollFade>
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
							{:else if inst.id === 'breakdown'}
								<BreakdownInstrument bind:this={handles.breakdown} />
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
		font-size: var(--fs-sm);
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
	   Same track definition and same gap as .ws below, so cell N sits exactly
	   over tile N at every lineup size — and now the ground is cut on those same
	   columns too (see .band--full in ToolStack). The picker does not merely
	   point at the instrument beneath it; the whole run stops where that
	   instrument stops. */
	.ws-band,
	.ws {
		display: grid;
		grid-template-columns: repeat(var(--ws-slots, 1), minmax(0, 1fr));
		gap: var(--ws-tile-gap);
	}

	/* A cell is a RUN OF PLATES, not a rail with things in it: the picker takes
	   the slack, the actions sit at the far end, and --band-item-gap between them
	   is the same distance band A puts between two of its buttons. So the ladder
	   across the header reads 4px between plates in one instrument · 32px between
	   instruments, with nothing painted underneath either. */
	.ws-band-cell {
		display: flex;
		align-items: center;
		gap: var(--band-item-gap, 4px);
		min-width: 0;
	}

	.ws-band-actions {
		display: flex;
		align-items: center;
		gap: var(--band-item-gap, 4px);
		flex-shrink: 0;
	}

	/* ⚠ The copied state overrides .btn--glass's ground on purpose and has to
	   out-specify it: two classes there, two here, and this rule is later in the
	   cascade only because scoped component styles load after app.css. Pinned
	   with the same accent fill the rest of the site uses for "this happened". */
	.ws-band-actions .ws-share-copied {
		color: var(--ink-active);
		background: var(--sel-fill);
	}

	/* ⛔ NO --band-pad-x HERE ANY MORE. The workspace used to take the band's own
	   horizontal padding so the tiles lined up with the pickers above them; band
	   B dropped that padding with its ground (2026-08-13), so keeping it here
	   would push every instrument 14px right of the header it belongs to. The two
	   were always a pair — they still are, at zero. */

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
		/* 🎛️ The roll-off. Shorter than the roster's 32 because what passes an
		   instrument's edge is a PANEL — a card with its own border, whose top
		   rule wants to dissolve rather than sit half-dimmed for a third of its
		   own height. */
		--scroll-fade: 24px;
	}

	/* ══ BAND A ONLY WHERE THERE IS A LINEUP (⚓ Nate 2026-10-02) ══════════════
	   Band A holds the lineup — Auto / 1 / 2 / 3 and Reset layout — and below
	   1360px the window fits ONE instrument (viewportCapacity), so every one of
	   those controls is a no-op: 2 and 3 disable, and Reset layout only puts the
	   default instrument back in the slot, which the picker does in one click.
	   On a phone it also collided with itself (the kicker under Auto). So the
	   band is shown from 1360px up and is simply absent below.
	   ⚠ CSS, not `capacity`: vw is 0 until hydration, so a JS gate would paint
	   the band on every desktop's first frame and then pull it — or the reverse.
	   ⚠ 1360px is the literal of viewportCapacity's `vw >= 1360` (innerWidth
	   and a width query both include the scrollbar), registered as a named
	   content stop in breakpoints.test.ts. Move one, move both.
	   ⚠ The band's height and gap leave .ws's height budget with it
	   (--ws-band-a). The asymmetry with the benched tools is accepted: this one
	   has no document and no bench, so its band A was never their band A. */
	.ws {
		--ws-band-a: 0px;
	}

	:global(.bands > .band-a.ws-lineup-band) {
		display: none;
	}

	@media (min-width: 1360px) {
		.ws {
			--ws-band-a: calc(var(--band-a-h) + var(--band-gap));
		}

		:global(.bands > .band-a.ws-lineup-band) {
			display: flex;
		}
	}

	@media (min-width: 1024px) {
		/* Fill the viewport below the bands. The band stack and its gap come out
		   of the budget — BAND_STACK_TO_SURFACE, passed down by ToolStack.
		   🐛 --band-gap WAS MISSING from this sum (2026-08-17). The bands stopped
		   abutting on 2026-08-09 and this calc was never told, so the workspace
		   was 4px taller than its slot for eight days — a permanent 4px of page
		   scroll that the 213px overflow above was hiding. ⚠ Every term of
		   BAND_STACK_TO_SURFACE has to be here, and the reason they are spelled
		   out rather than passed as one number is that ToolStack publishes the
		   parts, not the total; if a third band ever appears, this is the sum
		   that has to learn about it. */
		.ws {
			height: calc(
				100svh - var(--chrome-h, 64px) - var(--tool-pad-top, 0.5rem) -
					var(--tool-pad-bottom, 1.5rem) - var(--ws-band-a) - var(--band-b-h) -
					var(--band-stack-gap)
			);
			/* 🐛 THE ROW HAD TO BE PINNED, and this one declaration is the whole
			   fix (⚓ NATE 2026-08-17: the Visualizers should not page-scroll).
			   `.ws` had a definite height and every instrument declared
			   `height: 100%; overflow-y: auto` — but the implicit row was `auto`,
			   whose minimum is its item's MIN-CONTENT size, so the row grew past
			   the container, the instrument was never taller than its own box, its
			   scroller never engaged, and the excess fell through to .tool-shell.
			   Measured at 2-up on a 997px window: 796px of `.ws` holding 1053px
			   tiles, and 213px of page scroll that took both bands off the top.
			   ⚠ minmax(0, 1fr), not `1fr` — `1fr` is `minmax(auto, 1fr)` and the
			   `auto` minimum is exactly the term that was doing the damage. Same
			   law as .ws-body's min-width note, one axis over. */
			grid-template-rows: minmax(0, 1fr);
		}
		/* ⚓ THE TILE IS THE VIEWPORT, not the instrument. Eight instrument roots
		   each carried their own (inert) `overflow-y: auto`; the scroll lives here
		   instead, because the roll-off mask needs `use:scrollFade` attached to
		   the scroller and there is one tile against eight roots. The instrument
		   keeps `height: 100%` — that is what fills a slot a short instrument does
		   not need all of, and it resolves for the first time now.
		   ⚠ In the media query with the height, deliberately: below 1024px `.ws`
		   has no definite height, so this would be a scroller that can never
		   scroll — and the narrow layout page-scrolling is correct. */
		.ws-body {
			overflow-y: auto;
			/* A fling inside a tile must not chain to the shell once the tile is
			   at its end — the shell is the surface this round just stopped using. */
			overscroll-behavior-y: contain;
		}
	}
</style>
