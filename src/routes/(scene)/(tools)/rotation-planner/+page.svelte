<script lang="ts">
	import RotationTimeline from '$lib/components/RotationTimeline.svelte';
	import ToolStack from '$lib/components/ToolStack.svelte';
	import ToolColumns from '$lib/components/ToolColumns.svelte';
	import DocumentTabs from '$lib/components/DocumentTabs.svelte';
	import DocumentActions from '$lib/components/DocumentActions.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import TeamBonusesBlock from '$lib/components/TeamBonusesBlock.svelte';
	import RotationNotes from '$lib/components/RotationNotes.svelte';
	import { collectSlotCaveats } from '$lib/timeline/slotCaveats';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { getLoadedCharacter, loadCharacter } from '$lib/data/characterData';
	import { decodeRotation, type SharedRotation } from '$lib/utils/rotationUrl';
	import { warmAvatars } from '$lib/utils/warmAvatars';
	import { warmOpenTabCharacters } from '../lib/prewarmPlanner';
	import { onMount } from 'svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { claimVeilReady, afterPaint } from '$lib/landing/veilReady';
	import { rotationTabs as rt, TAB_LIMIT } from '$lib/rotationTabs.svelte';
	import { benchBand } from '$lib/benchBand.svelte';
	import { documentBar as db } from '$lib/documentBar.svelte';
	import {
		plannerView as pv,
		ZOOM_DEFAULT,
		ZOOM_MAX,
		ZOOM_MIN,
		ZOOM_STEP
	} from '$lib/plannerView.svelte';

	// ---------------------------------------------------------------------------
	// Tab state — hoisted to the shared working-team module (bench-band round):
	// the active tab's team IS the site's working team, so the Team Builder and
	// the bench band read and write the same state. Restore, persistence and
	// the save-bank label sync live in the (tools) layout, which stays mounted
	// across every tool. This page keeps the planner-only flows: save/load,
	// share links, tab-strip UI state.
	// ---------------------------------------------------------------------------

	// Hold the loading veil until the restored rotation is actually drawn.
	// Claimed at INIT — page components are constructed during the layout's
	// render pass, so this runs before the veil takes its reading. No-op unless
	// this is a server-rendered load with a veil to hold. Released in the
	// payload effect below.
	const releaseVeil = claimVeilReady();

	// Tab operations, save/load, share links and the reset confirm all moved out
	// in the toolbar round: the tab strip is <DocumentTabs>, the actions are
	// <DocumentActions>, and the flows behind them live in $lib/documentBar —
	// because they act on the shared working DOCUMENT, which the Team Builder
	// edits too. What is left here is the planner-only part: importing a `?r=`
	// link, and the character Source.

	/** Apply a decoded shared rotation: cons + loadout → the tab (Layer 2), build+notation → a tab. */
	function importShared(shared: SharedRotation) {
		// Constellations import into the tab's Layer-2 override, NOT the global
		// roster — the planner never writes Layer 1, so a shared link can't stomp
		// the recipient's own constellations. Loadout is likewise tab-scoped.
		const importedCon = { ...shared.constellations };
		const label = 'Shared rotation';
		const active = rt.activeTab;
		const pristine = rt.tabs.length === 1 && !active.notation.trim() && !active.savedId;
		const atLimit = rt.tabs.length >= TAB_LIMIT;
		if (pristine || atLimit) {
			// Reuse the current tab (empty first-load, or no room for a new one).
			rt.tabs = rt.tabs.map((t) =>
				t.id === rt.activeTabId ? { ...t, label, savedId: undefined } : t
			);
			rt.notation = shared.notation;
			rt.tabLoadout = shared.loadout;
			rt.tabCon = importedCon;
		} else {
			rt.openTab({
				label,
				notation: shared.notation,
				tabLoadout: shared.loadout,
				tabCon: importedCon
			});
		}
		db.showNotice(
			atLimit && !pristine ? 'Loaded — tab replaced (limit reached)' : 'Loaded shared rotation'
		);
	}

	// On first load: warm the avatar cache and register this tool's bench-band
	// affordances. Tab restore lives in the (tools) layout now — it must run for
	// every tool.
	//
	// ⚓ NATE 2026-08-12 — the two affordances used to be ONE here: the portrait
	// and ⇄ both opened the Source, which meant the planner had a permanent
	// button duplicating its own portrait. They split now, and the split is what
	// makes the bench behave identically in both tools: a filled portrait reads
	// the character (Detail card), ⇄ changes who fills the slot, and an empty
	// portrait — with no character to read — falls through to ⇄'s job.
	// Warm every open tab's characters, so switching to one you have not opened
	// this session does not stall on a cold payload (⚓ Nate 2026-08-12).
	//
	// ⚠ AN $effect GATED ON `restored`, NOT onMount — and the gate is the whole
	// point. The tabs are restored by the (tools) LAYOUT's onMount, and in Svelte
	// a CHILD's onMount runs BEFORE its parent's: warming from this page's
	// onMount read the default single empty tab and warmed nothing, which is
	// exactly the bug it was meant to fix (measured — a cold switch still pulled
	// both of the target tab's chunks). Depending on `restored` is robust to that
	// ordering whichever way it falls, and it also covers landing on another tool
	// first, where the layout mounted long ago. warmOpenTabCharacters is
	// once-per-session guarded, so a re-run is free.
	$effect(() => {
		if (rt.restored) warmOpenTabCharacters();
	});

	onMount(() => {
		warmAvatars();
		return benchBand.registerHost({
			tool: 'rp',
			onOpenDetail: (id) => {
				detailId = id;
			},
			// ⇄ LEAVES THE TOOL (2026-08-13). The planner's own Source could only
			// ever fill the LOWEST EMPTY SLOT — it had no way to say "replace THIS
			// one" — while the Team Builder's audition pins the incumbent and
			// compares candidates against it, which is the question you actually
			// have at a bench card. So the errand travels instead of being
			// re-implemented worse: ?swap=N asks for that slot's audition, and
			// committing a candidate there navigates back here.
			//
			// The team itself does NOT travel — it IS the shared working team
			// (bench-band round), so the slot INDEX is the whole payload.
			onSwap: (index) => {
				// The path IS resolved — but `no-navigation-without-resolve` requires
				// resolve() to be goto's argument *syntactically*, and it cannot be
				// while the URL carries a query. Checked against the rule source
				// rather than guessed: checkGotoCall accepts only a CallExpression
				// (or an identifier bound straight to one), with none of the
				// absolute/fragment escapes it grants an href — so a template, a
				// concat and a `new URL()` all fail it equally. `index` is a bench
				// slot index, so there is nothing to escape either way.
				// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() is inside the template; the rule cannot see through one
				void goto(`${resolve('/team-builder')}?swap=${index}`);
			}
		});
	});

	// Import a rotation carried in `?r=` — or a Team Builder hand-off in `?team=`
	// (`?r=` wins when both are present) — and strip the params. Lives in
	// afterNavigate, NOT onMount: on chained SPA navigation the component mounts
	// before the router updates location, so onMount would read the previous
	// page's URL and silently drop the params. Two hard-won rules (2026-07-13):
	// - afterNavigate ALSO fires on the navigation that REMOVES this component,
	//   with nav.to pointing at the OTHER page — consuming ?team= here would
	//   steal the Team Builder's own param mid-hand-off. Guard on nav.to.
	// - read nav.to.url, never window.location — location can lag the router.
	afterNavigate(async (nav) => {
		const url = nav.to?.url;
		if (!url || !url.pathname.endsWith('/rotation-planner')) return;
		const param = url.searchParams.get('r');
		const teamParam = url.searchParams.get('team');
		if (!param && !teamParam) return;
		// Strip the params regardless of outcome so a refresh/re-share is clean
		// and a bad link doesn't linger in the address bar.
		history.replaceState(history.state, '', url.pathname + url.hash);
		if (param) {
			const shared = await decodeRotation(param);
			if (!shared) {
				db.showNotice('Invalid share link');
				return;
			}
			importShared(shared);
			return;
		}
		const ids = [
			...new Set(
				teamParam!
					.split(',')
					.map((s) => s.trim())
					.filter((id) => id && id !== 'blank' && getCharacterIndexEntry(id))
			)
		].slice(0, 4);
		if (ids.length > 0) {
			const { replacedTab } = rt.importTeam(ids);
			db.showNotice(replacedTab ? 'Team loaded — tab replaced (limit reached)' : 'Team loaded');
		}
	});

	// ---------------------------------------------------------------------------
	// Slot resolution — the shared module's now (notation-driven + manual
	// override); aliased for the markup below.
	// ---------------------------------------------------------------------------

	let slots = $derived(rt.slots);

	// Lazy-load full character payloads for the slotted set. ↻ 2026-08-13: that
	// used to be the union of `slots` and `autoSlots`, because a manual override
	// could hide a notation-named character the parser still had to resolve.
	// Under single truth the slots ARE the notation's characters, so the union
	// collapsed — and `autoSlots` went with it. Payloads land in characterData's
	// reactive cache; timeline/panels/bonuses populate via getLoadedCharacter.
	//
	// This is also where the loading veil is released on a hard load. The
	// planner is ready when the tabs are restored AND the slotted payloads have
	// landed AND the timeline they feed has painted — restore alone is far too
	// early, which is precisely the "shell, then the rotation blinks in" the
	// veil is there to cover. Reading `restored` inside the effect makes it
	// re-run when the flag flips, so the ordering of onMount vs effects does
	// not matter. releaseVeil is idempotent and a no-op once the veil is gone.
	$effect(() => {
		const loads = [...new Set(slots)].map((id) =>
			// `blank` loads too now — the generic-profile placeholder kit, so a
			// "Blank E Q" rotation resolves and renders like any other slot.
			loadCharacter(id)
		);
		if (!rt.restored) return;
		void Promise.all(loads).then(() => afterPaint(releaseVeil));
	});

	// ---------------------------------------------------------------------------
	// UI state
	// ---------------------------------------------------------------------------

	/** The character whose Detail card is open, from a bench portrait click.
	 *  ⚓ NATE 2026-08-12: the planner reads characters through the SAME modal the
	 *  Team Builder does. It is the one deliberate modal in either tool (a
	 *  focused single-character read; see the non-modal-tools principle). */
	let detailId = $state<string | null>(null);

	/** The Detail card, fetched on first open (see its render site for why it is
	 *  lazy here and static on the Team Builder). */
	let DetailCardComp = $state<typeof import('$lib/components/DetailCard.svelte').default | null>(
		null
	);
	$effect(() => {
		if (!detailId || DetailCardComp) return;
		void import('$lib/components/DetailCard.svelte').then((m) => {
			DetailCardComp = m.default;
		});
	});

	// ---------------------------------------------------------------------------
	// The ASIDE COLUMN (aside-column round, 2026-08-08)
	//
	// One slot, one occupant, decided in one expression — see $lib/toolColumns.
	//
	// ↻ 2026-08-13: there is no longer a contest to decide. The picker's filter
	// rail was the notes' only rival for this column, and the round that keeps
	// the aside honest is the one that removed the rival: the planner's aside is
	// the NOTES, present when there is something to annotate. The expression
	// stays an expression — the column takes one occupant or none, and `null` is
	// still a real answer — but the ternary chain it used to need is gone.
	//
	// ⛔ The window Escape handler went with it. It existed to close the Source,
	// and it had to live on the page because the picker was TWO components by
	// then and neither half could own the key alone. The Detail card owns its
	// own Escape (it is a modal with a close button), so the page needs none.
	// ---------------------------------------------------------------------------

	/** Caveats for the slotted kits. Computed HERE, not in the timeline and not
	 *  in the notes column, because band B's Notes button has to know whether any
	 *  exist before the column is on screen to say so. */
	let slotCaveats = $derived(collectSlotCaveats(slots.map((id) => getLoadedCharacter(id))));

	$effect(() => {
		pv.hasCaveats = slotCaveats.length > 0;
		// A rebuild that leaves nothing to annotate closes the panel; the band's
		// own button is disabled in the same breath by the flag above.
		if (slotCaveats.length === 0) pv.showNotes = false;
	});

	let showAside = $derived(pv.showNotes && slotCaveats.length > 0);
</script>

<svelte:head>
	<title>Team rotation planner | critcalc.app</title>
</svelte:head>

<section class="rotation-page">
	<!-- The tool stack: bands + surface, with the bench ribbon's dock spanning
	     both (toolbar round). The tab bar that used to float above the frame is
	     band A's left zone now, and the view controls that rode the ruler's
	     right end are band B. TeamBonusesBlock stays OUTSIDE the stack, at the
	     content margin below the strip's bottom end. -->
	<ToolStack benched>
		{#snippet bandALeft()}
			<DocumentTabs />
		{/snippet}

		{#snippet bandARight()}
			<DocumentActions />
		{/snippet}

		<!-- ══ BAND B IS A 3-UP NOW (⚓ NATE 2026-08-12) ══════════════════════════
		     "Move both the NOTES and the zoom slider and its +/- buttons to
		     outside the band B's glass like MY ROSTER ∨ on the Team Builder — but
		     please keep the band extending to fill the distance. Basically,
		     maintaining one layer of glass, not stacked glass."

		     The controls were glass plates sitting INSIDE a glass band, so every
		     one of them composited two stops of the same material — the thing the
		     Team Builder's split fixed on its own band a round earlier. Filling
		     bandBCenter switches ToolStack to the 3-up: the BAND stops painting,
		     the centre zone becomes the only ground in the row, and the flanking
		     controls become plates on the bare scene.

		     ⚠ WHAT GOES IN THE RAIL IS THE READOUT, not nothing. Nate asked for
		     the band to keep "extending to fill the distance", and an empty strip
		     would do that — but the Total is the one thing here that is not a
		     control, and a strip is exactly what a readout wants to sit on. The
		     left zone is therefore empty and the rail takes the whole run from
		     the content margin to the controls. -->
		{#snippet bandBCenter()}
			<!-- What the chart is showing: how long the rotation runs. A readout,
			     not a control — it leads band B the way the tabs lead band A. -->
			{#if pv.totalDuration > 0}
				<span class="rp-total">
					<span class="rp-total-key">Total</span>
					{Math.round(pv.totalDuration * 10) / 10}s
				</span>
			{/if}
		{/snippet}

		{#snippet bandBRight()}
			<!-- Back to the resting view: the zoom AND the notes panel, which is
			     the whole of band B's state — hence "Reset view" rather than
			     "Reset zoom", which would under-describe what it does. It sits
			     left of the zoom group because that is the control it most often
			     undoes. Inert when there is nothing to undo, like the zoom
			     buttons at their limits. -->
			<button
				class="btn btn--sm rp-reset"
				type="button"
				aria-label="Reset the view to its resting zoom"
				title="Back to the resting zoom, and close the notes panel"
				disabled={pv.scale === ZOOM_DEFAULT && !pv.showNotes}
				onclick={() => pv.reset()}
			>
				<Mark name="reset" />
				Reset view
			</button>
			<div class="rp-zoom" role="group" aria-label="Zoom">
				<button
					class="btn btn--sm btn--icon"
					type="button"
					aria-label="Zoom out"
					disabled={pv.scale <= ZOOM_MIN}
					onclick={() => pv.zoomBy(-ZOOM_STEP)}><Mark name="minus" /></button
				>
				<input
					type="range"
					min={ZOOM_MIN}
					max={ZOOM_MAX}
					step={ZOOM_STEP}
					bind:value={pv.scale}
					class="slider rp-zoom-slider"
					aria-label="Zoom"
					title="Zoom — pixels per second"
				/>
				<button
					class="btn btn--sm btn--icon"
					type="button"
					aria-label="Zoom in"
					disabled={pv.scale >= ZOOM_MAX}
					onclick={() => pv.zoomBy(ZOOM_STEP)}><Mark name="plus" /></button
				>
			</div>
			<button
				class="btn btn--sm rp-notes-btn"
				class:is-active={pv.showNotes}
				type="button"
				aria-label="Toggle notes panel"
				disabled={!pv.hasCaveats}
				onclick={() => (pv.showNotes = !pv.showNotes)}
			>
				<Mark name="note" />
				Notes
				{#if pv.hasCaveats}
					<!-- Notification mark: notes exist for the loaded characters.
					     Nate's artwork (assets-src/tools/notification.svg) — a disc
					     with a glyph, drawn rather than typeset. The two fills are
					     wired to tokens rather than the SVG's baked hexes so a
					     palette change carries through.
					     ↻ 2026-08-12: the glyph is --chrome (#ffffff), not --text.
					     ⚓ Nate asked for the ! to be white and the red to be one of
					     our UI colours; the disc was ALREADY --ui-danger, so only the
					     ink moved. --text is parchment-100 — the right ink on a slate
					     ground and slightly warm/dim on a saturated red disc, where
					     the mark wants maximum separation in the smallest space we
					     draw anything. --chrome is the site's one white. -->
					<svg class="rp-notes-badge" viewBox="0 0 24 24" aria-hidden="true"
						><g transform="matrix(1,0,0,1,-273.029018,-202.228283)">
							<g>
								<g transform="matrix(0.575277,0,0,0.575277,146.251428,151.449127)">
									<circle cx="241.236" cy="109.129" r="20.86" fill="var(--ui-danger)" />
								</g>
								<g transform="matrix(1,0,0,1,-2.378613,7.691546)">
									<path
										d="M287.339,210.822L287.495,210.822C287.975,210.822 288.411,210.985 288.799,211.317C289.203,211.663 289.404,212.098 289.404,212.623L289.404,212.775L289.396,212.852C289.39,212.885 289.384,212.909 289.384,212.925C289.384,213.273 289.218,213.648 288.84,214.026C288.478,214.387 288.083,214.562 287.662,214.57L287.535,214.589L287.271,214.589C287.246,214.589 287.222,214.587 287.197,214.582C287.165,214.576 287.141,214.57 287.124,214.57C286.714,214.57 286.319,214.399 285.951,214.03C285.591,213.67 285.412,213.239 285.412,212.739L285.412,212.683L285.427,212.698C285.423,212.677 285.421,212.655 285.421,212.632L285.421,212.61L285.419,212.607L285.422,212.593C285.432,212.155 285.613,211.749 285.98,211.381C286.353,211.009 286.805,210.822 287.339,210.822ZM285.538,200.334L285.538,199.894C285.538,199.03 286.205,198.484 287.681,198.484L287.715,198.486L287.827,198.494C287.827,198.494 288.021,198.509 287.827,198.494C288.334,198.5 288.685,198.655 288.898,198.903C289.103,199.141 289.228,199.513 289.228,200.031L289.228,200.479L289.226,200.527L289.218,200.619L289.217,200.629L289.208,200.842L289.207,200.863C289.202,200.93 289.199,200.995 289.199,201.056L289.197,201.094L289.178,201.322C289.165,201.472 289.16,201.722 289.16,202.072C289.16,202.444 289.098,203.162 288.971,204.225C288.848,205.262 288.753,206.181 288.685,206.982C288.614,207.812 288.546,208.359 288.486,208.621C288.395,209.014 288.053,209.293 287.369,209.293L287.242,209.293C287.009,209.293 286.817,209.224 286.662,209.099C286.463,208.939 286.315,208.67 286.264,208.271C285.779,204.394 285.538,201.748 285.538,200.334Z"
										fill="var(--chrome)"
									/>
								</g>
							</g>
						</g></svg
					>
				{/if}
			</button>
		{/snippet}

		{#snippet surface()}
			<!-- The surface is TWO BOXES with a gap (aside-column round): the
			     timeline, and — when something occupies it — the aside column. The
			     bands above span both. -->
			<!-- ⛔ `asideBare` went with the filter rail: it was for the RAIL only,
			     which painted its own groups and wanted the column to be a gutter
			     of objects. The NOTES keep the box — they are one continuous
			     reading and would look shredded in rows. -->
			<ToolColumns {main} aside={showAside ? asideColumn : undefined} />
		{/snippet}
	</ToolStack>

	<!-- ⛔ TeamBonusesBlock USED TO SIT HERE, below the whole stack. It moved
	     INSIDE the timeline (⚓ Nate 2026-08-11) — between the buff/NB/moonsign
	     lanes and the notation field — and is handed down as the `underChart`
	     snippet so the page keeps owning `slots` while the instrument decides
	     placement. See that prop for why. -->
</section>

<!-- The one deliberate modal, and now the same one in both tools: a focused
     single-character read, opened by clicking a bench portrait.
     LAZY, unlike the Team Builder's static import of the same component — the
     TB is the character tool and would load it anyway; the planner would be
     paying for the capability-derivation graph on first paint for a card most
     sessions never open. One frame's delay on first open, and the character
     payload it renders is a lazy chunk regardless. -->
{#if detailId && DetailCardComp}
	<DetailCardComp
		id={detailId}
		conMode="mine"
		onClose={() => (detailId = null)}
		conEditable={false}
	/>
{/if}

<!-- ── The main column: the timeline instrument ───────────────────────────── -->
{#snippet main()}
	<RotationTimeline
		bind:notation={rt.notation}
		characterSlots={slots}
		tabLoadout={rt.tabLoadout}
		tabCon={rt.tabCon}
	>
		<!-- The always-on bonuses strip, rendered between the chart's last lane
		     and the notation field. -->
		{#snippet underChart()}
			<TeamBonusesBlock {slots} />
		{/snippet}
	</RotationTimeline>
{/snippet}

<!-- ── The aside column: the notes ────────────────────────────────────────── -->
{#snippet asideColumn()}
	<RotationNotes entries={slotCaveats} />
{/snippet}

<style>
	/* ↻ 2026-08-11: the doubled gutter is GONE with the thing it separated.
	   It read "DOUBLE the tool gutter, deliberately: this seam separates the
	   tool from a caption ABOUT the tool" — and that was right while
	   TeamBonusesBlock hung below the stack. The strip is INSIDE the instrument
	   now, so there is no longer a caption to hold at arm's length, and a
	   double gutter under a stack with nothing after it is just a dead margin.
	   The page is a single child again; the gap is kept for whatever lands
	   beside the stack next. */
	.rotation-page {
		display: flex;
		flex-direction: column;
		gap: var(--tool-gutter);
	}

	/* ── Band B: the planner's VIEW controls ─────────────────────
	   Total · zoom · Notes. They used to ride the ruler strip's right end
	   inside the frame, over a gradient that faded the ticks out beneath
	   them; on the band they sit on an opaque ground and need none of that.
	   The controls are the shared .btn/.slider — only the pieces the global
	   classes can't know are local. */

	/* Total-length readout: the LED-style key/value pair that led the old view
	   cluster, minus its chip backing — band B is its own surface now, and a
	   fill inside a fill read as a control the reader could press. */
	/* Ranged LEFT inside the rail. The 3-up centre zone centres its content —
	   right for the Team Builder, whose rail holds navigation — but this is a
	   readout at the start of a long strip, and it reads as a label on that
	   strip only from its leading edge. `margin-right: auto` eats the run to its
	   right rather than fighting the zone's own justification. */
	.rp-total {
		display: inline-flex;
		align-items: baseline;
		gap: 0.45rem;
		margin-right: auto;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		white-space: nowrap;
	}
	.rp-total-key {
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-widest);
		text-transform: uppercase;
		opacity: 0.75;
	}

	/* ── DISABLED DIMS THE INK, NOT THE PLATE (⚓ NATE 2026-08-12) ────────────
	   "For disabling the reset view, can you have the glass stay the same
	   opacity? Otherwise it breaks up the look of the bar."

	   He is right, and the reason is structural rather than aesthetic. The
	   global `.btn:disabled { opacity: 0.3 }` was written for buttons sitting ON
	   something, where fading the whole control fades it toward its background.
	   These four are plates sitting on the BARE SCENE since the 3-up split, so
	   fading the element fades the GLASS — and a run of controls where one pane
	   is thinner than its neighbours reads as a hole in the bar, not as a
	   disabled button.

	   So: restore the element to full and spend the state on `color` alone. The
	   Marks ride currentColor, so they follow. This also puts the alpha back in
	   the PAINT, which is the sub-pixel law's preference everywhere.
	   ⏭ A candidate to generalise to every glass `.btn` on the site — deliberately
	   scoped to this bar for now, because it is the only one where Nate has
	   judged the result. */
	.rp-reset:disabled,
	.rp-zoom .btn:disabled,
	.rp-notes-btn:disabled {
		opacity: 1;
		color: color-mix(in srgb, var(--text) 45%, transparent);
	}

	/* A bare flex group, NOT a plate — band B's 3-up put these controls out on
	   the scene, and giving the group its own glass while the buttons inside it
	   keep theirs would rebuild the stack that was just removed. Each control
	   paints itself, exactly as band A's buttons do. */
	.rp-zoom {
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	/* Track/thumb styling comes from the shared .slider (app.css). */
	.rp-zoom-slider {
		width: 88px;
	}

	.rp-notes-btn {
		/* positions the unread badge */
		position: relative;
	}

	.rp-notes-badge {
		position: absolute;
		top: -4px;
		right: -5px;
		/* 12px renders a 12px disc: the circle fills the 24x24 viewBox
		   edge-to-edge (centre 12,12, r 12 after the artwork's transforms). */
		width: 12px;
		height: 12px;
		/* 🎛️ ⚓ NATE 2026-08-12. A notification mark set dead upright reads as
		   typeset; a few degrees off is what makes it read as a stuck-on badge.
		   ⚠ The disc is centred in its own viewBox, so the default 50% 50% origin
		   turns the glyph in place and the badge's own box does not move —
		   nothing about the button's layout is touched. */
		transform: rotate(6deg);
		pointer-events: none;
	}
</style>
