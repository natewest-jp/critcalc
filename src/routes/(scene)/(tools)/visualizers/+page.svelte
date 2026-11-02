<script lang="ts">
	import { named, notices } from '$lib/notices.svelte';
	import { chapterSection, menu } from '$lib/menuState.svelte';
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
	import InstrumentTabs from './lib/InstrumentTabs.svelte';
	import ToolStack from '$lib/components/ToolStack.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import ReportLink from '$lib/components/ReportLink.svelte';
	import {
		DEFAULT_ASSIGNMENT,
		DEFAULT_SLOTS,
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
	let slotPref = $state<SlotPref>(DEFAULT_SLOTS);
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
		slotPref = stored?.slots ?? DEFAULT_SLOTS;
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
	// goes back to the default count.
	function resetWorkspace() {
		assignment = [...DEFAULT_ASSIGNMENT];
		slotPref = DEFAULT_SLOTS;
	}

	/** The lineup control's options: cap at 1..MAX_SLOTS, or follow the viewport. */
	const SLOT_OPTIONS: SlotPref[] = [...Array.from({ length: MAX_SLOTS }, (_, i) => i + 1), 'auto'];

	// ── Instrument handles ─────────────────────────────────────────────────
	// Optional per-instrument capabilities (share state in/out, handoff intake)
	// exposed as component `export function`s and collected via bind:this.
	// Method calls, not mount-time props: with keep-alive a target may already
	// be mounted when a link or handoff arrives.
	let handles = $state<Partial<Record<InstrumentId, InstrumentHandle>>>({});

	// ── Defaults on the bar (the Visualizers overhaul, round 1) ─────────────
	// Each instrument's share state AS IT MOUNTS is its defaults: a handle
	// binds before anything is applied to it (a link's state, and later a
	// saved one, arrive after the mount — see afterNavigate below). Compared as
	// JSON, the bar's Defaults is lit only when there is something to undo, so
	// the button also tells you that you have moved something. Generic on
	// purpose: no instrument has to declare its defaults twice.
	let defaults = $state<Partial<Record<InstrumentId, string>>>({});
	function register(id: InstrumentId, handle: InstrumentHandle | null | undefined) {
		if (handle && defaults[id] === undefined && handle.getShareState) {
			defaults[id] = JSON.stringify(handle.getShareState());
		}
		handles[id] = handle ?? undefined;
	}
	/** Read in the template, so it tracks every control the share state reads. */
	function atDefaults(id: InstrumentId): boolean {
		const h = handles[id];
		if (!h?.getShareState || defaults[id] === undefined) return false;
		return JSON.stringify(h.getShareState()) === defaults[id];
	}
	/** Defaults, with Undo: the toast hands the state back through the share
	 *  path, which every instrument already sanitizes. */
	function restoreDefaults(id: InstrumentId) {
		const h = handles[id];
		if (!h?.reset) return;
		const before = h.getShareState?.();
		h.reset();
		const name = INSTRUMENTS.find((i) => i.id === id)?.name ?? id;
		const apply = h.applyShareState;
		notices.toast(
			'success',
			named`${name} is back to its defaults`,
			before !== undefined && apply
				? { actions: [{ label: 'Undo', run: () => apply(before) }] }
				: {}
		);
	}
	/** Help's Visualizers chapter, opened at this instrument's section. */
	function openHelp(id: InstrumentId) {
		menu.show(chapterSection('help', 'visualizers'), INSTRUMENTS.find((i) => i.id === id)?.help);
	}

	// ── `?i=` deep links ───────────────────────────────────────────────────
	// afterNavigate, NOT onMount (Team Builder lessons): SPA mounts run before
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
		if (!decoded || !INSTRUMENTS.some((i) => i.id === decoded.id)) {
			notices.toast(
				'error',
				'That instrument link couldn’t be read. It may have been cut short when it was copied.'
			);
			return;
		}
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
	let failedTile = $state<InstrumentId | null>(null);
	/** The `?i=` link that reopens a tile as it looks now — what Share copies,
	 *  and what a problem report carries ($lib/feedback.ts). An instrument with
	 *  no share state still gets a link that opens it. */
	async function tileUrl(id: InstrumentId): Promise<string> {
		const param = await encodeInstrumentParam(id, handles[id]?.getShareState?.());
		return `${location.origin}/visualizers?i=${param}`;
	}
	async function shareTile(id: InstrumentId) {
		try {
			await navigator.clipboard.writeText(await tileUrl(id));
		} catch {
			// a denied clipboard (or a lost user activation after the await) —
			// say so on the button, as the planner's Share does
			copiedTile = null;
			failedTile = id;
			setTimeout(() => {
				if (failedTile === id) failedTile = null;
			}, 1500);
			return;
		}
		failedTile = null;
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

     Band B is the VIEW row — and here it was already right: the per-tile
     picker bar predates the round and is the shape the other two tools were
     rebuilt toward. It subdivides by the tile grid instead of splitting
     left/right, which is what bandBFull is for. The lineup size is a property
     of the workspace, not of any one instrument, so it and Reset layout are
     the Layout plate on the last tile (below). -->
{#snippet layoutControls()}
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

<!-- ↻ Phase 2e (design §5.3): the layout is ONE control at the toolbar's right
     end, and each tile's Defaults is in its ⋯. -->
<ToolStack>
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
				<div class="ws-band-cell" class:ws-band-cell--one={slotCount === 1}>
					{#if slotCount === 1}
						<!-- One up: the eight as tabs where the row fits, else the
						     dropdown (the container queries below). -->
						<div class="ws-tabs">
							<InstrumentTabs
								current={id}
								onPick={(next) => pick(slot, next)}
								panelId="ws-tile-{id}"
							/>
						</div>
					{/if}
					<div class="ws-picker">
						<InstrumentPicker
							current={id}
							{assignment}
							{slotCount}
							{slot}
							onPick={(next) => pick(slot, next)}
						/>
					</div>
					<span class="ws-band-actions">
						{#if handles[id]?.reset}
							<!-- ⚓ On the bar, not in the ⋯ (Nate 2026-11-02): the reset
							     players reach for. Dimmed while there is nothing to put
							     back; Undo in its toast. -->
							<button
								class="btn btn--sm btn--glass"
								disabled={atDefaults(id)}
								onclick={() => restoreDefaults(id)}
								title="Put this instrument’s controls back to their defaults"
							>
								<Mark name="reset" size={12} />
								<span class="ws-band-word">Defaults</span>
							</button>
						{/if}
						{#if handles[id]?.getShareState}
							<button
								class="btn btn--sm btn--glass"
								class:ws-share-copied={copiedTile === id}
								onclick={() => shareTile(id)}
								title="Copy a link that reopens this instrument as it looks now"
							>
								<Mark name={copiedTile === id ? 'check' : 'link'} size={12} />
								<!-- ⚓ The tile's button says what it does (§5.3). -->
								<span class="ws-band-word" class:ws-band-word--keep={failedTile === id}
									>{failedTile === id
										? 'Copy failed'
										: copiedTile === id
											? 'Copied'
											: 'Copy link'}</span
								>
							</button>
						{/if}
						<!-- Per TILE, so the report carries this instrument's link. -->
						<BandMenu compact glass size="sm" mark="more" ariaLabel="More instrument actions">
							{#snippet items(close)}
								<button
									class="band-menu-item"
									role="menuitem"
									onclick={() => {
										close();
										openHelp(id);
									}}><Mark name="help" /> How it works</button
								>
								<ReportLink
									class="band-menu-item"
									role="menuitem"
									prefill={{ category: 'broken', tool: 'visualizers', includeTech: true }}
									shareUrl={() => tileUrl(id)}
									onclick={close}
								>
									<Mark name="report" />
									Report a problem
								</ReportLink>
							{/snippet}
						</BandMenu>
						{#if slot === slotCount - 1}
							<!-- The workspace's own control (§5.3): how many instruments,
							     and Reset layout, as one plate at the toolbar's right. -->
							<BandMenu glass size="sm" mark="layout" label="Layout" role="dialog" align="end">
								{#snippet items()}
									<div class="ws-layout">{@render layoutControls()}</div>
								{/snippet}
							</BandMenu>
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
				<section
					id="ws-tile-{inst.id}"
					class="ws-tile"
					class:ws-hidden={slot === -1}
					style:order={slot}
				>
					<!-- THE TILE IS THE VIEWPORT (2026-08-17). See .ws-body's rule for
					     what was wrong before; the mask is unconditional and inert
					     until there is something to scroll, which is what makes it
					     safe on the narrow layout where the page scrolls instead. -->
					<div class="ws-body scroll-fade" use:scrollFade>
						{#if slot !== -1 || everSlotted.has(inst.id)}
							{#if inst.id === 'crit'}
								<CritInstrument bind:this={() => handles.crit, (h) => register('crit', h)} />
							{:else if inst.id === 'icd'}
								<IcdInstrument
									bind:this={() => handles.icd, (h) => register('icd', h)}
									onHandoff={(msg) => deliverHandoff(msg, slot)}
								/>
							{:else if inst.id === 'artifact'}
								<ArtifactInstrument
									bind:this={() => handles.artifact, (h) => register('artifact', h)}
								/>
							{:else if inst.id === 'gauge'}
								<GaugeInstrument bind:this={() => handles.gauge, (h) => register('gauge', h)} />
							{:else if inst.id === 'curves'}
								<ReactionCurvesInstrument
									bind:this={() => handles.curves, (h) => register('curves', h)}
								/>
							{:else if inst.id === 'defres'}
								<DefResInstrument bind:this={() => handles.defres, (h) => register('defres', h)} />
							{:else if inst.id === 'wish'}
								<WishInstrument bind:this={() => handles.wish, (h) => register('wish', h)} />
							{:else if inst.id === 'breakdown'}
								<BreakdownInstrument
									bind:this={() => handles.breakdown, (h) => register('breakdown', h)}
								/>
							{/if}
						{/if}
					</div>
				</section>
			{/each}
		</div>
	{/snippet}
</ToolStack>

<style>
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

	/* The quieter of the Layout plate's two controls — resetting a layout is
	   not what you came for. */
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
	   is the gap between controls. So the ladder
	   across the header reads 4px between plates in one instrument · 32px between
	   instruments, with nothing painted underneath either. */
	.ws-band-cell {
		display: flex;
		align-items: center;
		gap: var(--band-item-gap, 4px);
		min-width: 0;
	}

	/* The picker's wrapper takes the slack the picker itself used to (the
	   nameplate is the long plate, InstrumentPicker § THE TILE'S NAMEPLATE). */
	.ws-picker {
		display: flex;
		flex: 1;
		min-width: 0;
	}
	.ws-tabs {
		flex: 1;
		min-width: 0;
	}

	/* ONE UP: tabs or the dropdown, by the CELL's width. The cell is the
	   query container, so the question is "does the row fit beside the
	   actions", whatever the window and the interface size.
	   🎛️ 73rem, the literal in the query below: measured at the default
	   interface size, the eight tabs are 850px and the four action plates
	   300px, so the row needs 1154px of cell. 73rem (1168px) is the first
	   whole rem above it, and a cell that wide comes with a window of about
	   1232px. Re-measure if a name or an action changes. */
	.ws-band-cell--one {
		container: ws-cell / inline-size;
	}
	.ws-band-cell--one .ws-picker {
		display: none;
	}
	@container ws-cell (width < 73rem) {
		.ws-band-cell--one .ws-tabs {
			display: none;
		}
		.ws-band-cell--one .ws-picker {
			display: flex;
		}
	}

	.ws-layout {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.4rem;
	}
	.ws-band-actions {
		display: flex;
		align-items: center;
		gap: var(--band-item-gap, 4px);
		flex-shrink: 0;
	}

	/* THE FOLD, reaching band B (responsive sweep, 2026-10-15). Below
	   BP.compact ($lib/breakpoints.ts — 40rem) Defaults and Share drop their
	   WORDS and keep their marks, the fold the old document actions had
	   since 2026-09-05. The picker shrinks first and these plates never
	   do, so at 320 the one label saying WHICH instrument you are looking at
	   read "DAMA…" beside two worded buttons (Damage Breakdown ellipsised by
	   104px). The `title`s still carry the words. A FAILED share keeps its
	   words: a check mark says "copied", but nothing but words says "it
	   didn't work". ⚠ Literal from the table, by necessity. */
	@media (max-width: 40rem) {
		.ws-band-word:not(.ws-band-word--keep) {
			display: none;
		}
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
	   inline-size only — size containment would collapse indefinite heights
	   (from 1024px, where the height is the row's, it is size; see below). */
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

	@media (min-width: 1024px) {
		/* Fill the viewport below the toolbar. The toolbar and its gap come out
		   of the budget, as ToolStack's --stack-to-surface counts them.
		   ⚠ Every term has to be here: a missing gap once left the workspace
		   4px taller than its slot, a permanent 4px of page scroll. They are
		   spelled out rather than passed as one number because ToolStack
		   publishes the parts; a row added to the stack is a term this sum has
		   to learn. */
		.ws {
			height: calc(
				100svh - var(--chrome-h, 64px) - var(--tool-pad-top, 0.5rem) -
					var(--tool-pad-bottom, 1.5rem) - var(--band-b-h) - var(--band-stack-gap)
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
		/* ↻ 2026-10-15 (responsive sweep §3 item 16): here, and only here, the
		   tile is a SIZE container. Its height is the row's now — definite, and
		   never its content's — so the containment the rule above warns about
		   has nothing to collapse, and `100cqh` is the tile's height: what the
		   capped instruments' chart column and the Crit Heatmap's stage measure
		   their width against (app.css .instrument--capped). The name and the
		   width queries are unchanged; layout containment already came with
		   inline-size, so nothing positioned inside moves. */
		.ws-tile {
			container-type: size;
		}
		/* ⚓ THE TILE IS THE VIEWPORT, not the instrument. Eight instrument roots
		   each carried their own (inert) `overflow-y: auto`; the scroll lives here
		   instead, because the roll-off mask needs `use:scrollFade` attached to
		   the scroller and there is one tile against eight roots. The instrument
		   is `min-height: 100%` (↻ 2026-10-06, was `height`) — that is what fills a
		   slot a short instrument does not need all of, and lets a long one grow
		   past it (app.css .instrument).
		   ⚠ In the media query with the height, deliberately: below 1024px `.ws`
		   has no definite height, so this would be a scroller that can never
		   scroll — and the narrow layout page-scrolling is correct. */
		/* ↻ 2026-10-25 (the edges round): the scroller REACHES into the scene
		   above and below its tile and pads back, so its roll-off ends at band
		   B and at the screen's foot rather than inside the instrument (app.css
		   § THE FADE ENDS AT THE NEIGHBOUR). The tile does not clip (a size
		   container contains layout, not paint), and the instrument's
		   `min-height: 100%` is of the content box, which the pair leaves the
		   size it was. */
		.ws-body {
			margin-block: calc(var(--room-top) * -1) calc(var(--room-bottom) * -1);
			padding-block: var(--room-top) var(--room-bottom);
			overflow-y: auto;
			/* A fling inside a tile must not chain to the shell once the tile is
			   at its end — the shell is the surface this round just stopped using. */
			overscroll-behavior-y: contain;
		}
	}
</style>
