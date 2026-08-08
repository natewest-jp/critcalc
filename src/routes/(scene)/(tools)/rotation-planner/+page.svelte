<script lang="ts">
	import RotationTimeline from '$lib/components/RotationTimeline.svelte';
	import ToolStack from '$lib/components/ToolStack.svelte';
	import ToolColumns from '$lib/components/ToolColumns.svelte';
	import DocumentTabs from '$lib/components/DocumentTabs.svelte';
	import DocumentActions from '$lib/components/DocumentActions.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import TeamBonusesBlock from '$lib/components/TeamBonusesBlock.svelte';
	import CharacterSelector from '$lib/components/CharacterSelector.svelte';
	import CharacterSelectorFilters from '$lib/components/CharacterSelectorFilters.svelte';
	import RotationNotes from '$lib/components/RotationNotes.svelte';
	import { collectSlotCaveats } from '$lib/timeline/slotCaveats';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { getLoadedCharacter, loadCharacter } from '$lib/data/characterData';
	import { decodeRotation, type SharedRotation } from '$lib/utils/rotationUrl';
	import { warmAvatars } from '$lib/utils/warmAvatars';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { claimVeilReady, afterPaint } from '$lib/landing/veilReady';
	import { rotationTabs as rt, TAB_LIMIT } from '$lib/rotationTabs.svelte';
	import { benchBand } from '$lib/benchBand.svelte';
	import { documentBar as db } from '$lib/documentBar.svelte';
	import { plannerView as pv, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '$lib/plannerView.svelte';

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
			rt.manualSlots = shared.team;
			rt.tabLoadout = shared.loadout;
			rt.tabCon = importedCon;
		} else {
			rt.openTab({
				label,
				notation: shared.notation,
				manualSlots: shared.team,
				tabLoadout: shared.loadout,
				tabCon: importedCon
			});
		}
		db.showNotice(
			atLimit && !pristine ? 'Loaded — tab replaced (limit reached)' : 'Loaded shared rotation'
		);
	}

	// On first load: warm the avatar cache and register this tool's bench-band
	// affordances (a bench portrait click opens the character Source). Tab
	// restore lives in the (tools) layout now — it must run for every tool.
	onMount(() => {
		warmAvatars();
		return benchBand.registerHost({
			tool: 'rp',
			onPortraitClick: () => {
				selectorOpen = true;
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

	// Lazy-load full character payloads for the slotted set (plus any
	// notation-named characters when manual slots override autoSlots, so the
	// parser can still resolve them). Payloads land in characterData's
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
		const loads = [...new Set([...slots, ...rt.autoSlots])].map((id) =>
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

	let selectorOpen = $state(false);

	/** How many of the four slots are filled — the picker column's readout. */
	let chosenCount = $derived(slots.filter((id) => id && id !== 'blank').length);

	// Escape closes the Source. It lives here rather than in the picker because
	// the page owns `selectorOpen` — and since the aside-column round the picker
	// is TWO components, so neither half could own the key on its own.
	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && selectorOpen) selectorOpen = false;
	}

	// ---------------------------------------------------------------------------
	// The ASIDE COLUMN (aside-column round, 2026-08-08)
	//
	// One slot, one occupant, decided in one expression — see $lib/toolColumns.
	// The picker's filters WIN over the notes: opening the Source covers the
	// whole surface, cards over the timeline and filters over the notes, and
	// closing it puts back whatever was there. Before the round this collision
	// was three unrelated booleans and the winner was an accident of z-index.
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

	let asideOccupant = $derived(
		selectorOpen ? 'filters' : pv.showNotes && slotCaveats.length > 0 ? 'notes' : null
	);
</script>

<svelte:window onkeydown={onWindowKeydown} />

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

		{#snippet bandBLeft()}
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
					     palette change carries through. -->
					<svg class="rp-notes-badge" viewBox="0 0 24 24" aria-hidden="true"
						><g transform="matrix(1,0,0,1,-273.029018,-202.228283)">
							<g>
								<g transform="matrix(0.575277,0,0,0.575277,146.251428,151.449127)">
									<circle cx="241.236" cy="109.129" r="20.86" fill="var(--ui-danger)" />
								</g>
								<g transform="matrix(1,0,0,1,-2.378613,7.691546)">
									<path
										d="M287.339,210.822L287.495,210.822C287.975,210.822 288.411,210.985 288.799,211.317C289.203,211.663 289.404,212.098 289.404,212.623L289.404,212.775L289.396,212.852C289.39,212.885 289.384,212.909 289.384,212.925C289.384,213.273 289.218,213.648 288.84,214.026C288.478,214.387 288.083,214.562 287.662,214.57L287.535,214.589L287.271,214.589C287.246,214.589 287.222,214.587 287.197,214.582C287.165,214.576 287.141,214.57 287.124,214.57C286.714,214.57 286.319,214.399 285.951,214.03C285.591,213.67 285.412,213.239 285.412,212.739L285.412,212.683L285.427,212.698C285.423,212.677 285.421,212.655 285.421,212.632L285.421,212.61L285.419,212.607L285.422,212.593C285.432,212.155 285.613,211.749 285.98,211.381C286.353,211.009 286.805,210.822 287.339,210.822ZM285.538,200.334L285.538,199.894C285.538,199.03 286.205,198.484 287.681,198.484L287.715,198.486L287.827,198.494C287.827,198.494 288.021,198.509 287.827,198.494C288.334,198.5 288.685,198.655 288.898,198.903C289.103,199.141 289.228,199.513 289.228,200.031L289.228,200.479L289.226,200.527L289.218,200.619L289.217,200.629L289.208,200.842L289.207,200.863C289.202,200.93 289.199,200.995 289.199,201.056L289.197,201.094L289.178,201.322C289.165,201.472 289.16,201.722 289.16,202.072C289.16,202.444 289.098,203.162 288.971,204.225C288.848,205.262 288.753,206.181 288.685,206.982C288.614,207.812 288.546,208.359 288.486,208.621C288.395,209.014 288.053,209.293 287.369,209.293L287.242,209.293C287.009,209.293 286.817,209.224 286.662,209.099C286.463,208.939 286.315,208.67 286.264,208.271C285.779,204.394 285.538,201.748 285.538,200.334Z"
										fill="var(--text)"
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
			<ToolColumns {main} aside={asideOccupant ? asideColumn : undefined} />
		{/snippet}
	</ToolStack>

	<!-- Always-on bonuses caption, directly under the frame (the per-character
	     ability panels are gone — the timeline itself is the timing reference
	     for slotted characters, and the Team Builder is the deep ability
	     reference) -->
	<TeamBonusesBlock {slots} />
</section>

<!-- ── The main column: the timeline instrument ───────────────────────────── -->
{#snippet main()}
	<RotationTimeline
		bind:notation={rt.notation}
		characterSlots={slots}
		tabLoadout={rt.tabLoadout}
		tabCon={rt.tabCon}
		sourceOpen={selectorOpen}
	>
		<!-- The character Source's CARDS, layered over the timeline frame
		     (non-modal). Its filter column is the other half, in the aside below.
		     Edits are live: each add/remove sets manualSlots, which flows back
		     down as the bench portraits' team. -->
		{#snippet sourceOverlay()}
			<CharacterSelector currentSlots={slots} onChange={(chosen) => (rt.manualSlots = chosen)} />
		{/snippet}
	</RotationTimeline>
{/snippet}

<!-- ── The aside column: notes, or the Source's filters over them ─────────── -->
{#snippet asideColumn()}
	{#if asideOccupant === 'filters'}
		<CharacterSelectorFilters {chosenCount} onClose={() => (selectorOpen = false)} />
	{:else}
		<RotationNotes entries={slotCaveats} />
	{/if}
{/snippet}

<style>
	.rotation-page {
		display: flex;
		flex-direction: column;
		gap: clamp(16px, 2.5vw, 32px);
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
	.rp-total {
		display: inline-flex;
		align-items: baseline;
		gap: 0.45rem;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		white-space: nowrap;
	}
	.rp-total-key {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-widest);
		text-transform: uppercase;
		opacity: 0.75;
	}

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
		pointer-events: none;
	}
</style>
