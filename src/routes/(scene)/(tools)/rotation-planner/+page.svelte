<script lang="ts">
	import RotationTimeline from '$lib/components/RotationTimeline.svelte';
	import ToolStack from '$lib/components/ToolStack.svelte';
	import { below } from '$lib/media.svelte';
	import ToolColumns from '$lib/components/ToolColumns.svelte';
	import DocumentTabs from '$lib/components/DocumentTabs.svelte';
	import DocumentActions from '$lib/components/DocumentActions.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import TeamBonusesBlock from '$lib/components/TeamBonusesBlock.svelte';
	import RotationNotes from '$lib/components/RotationNotes.svelte';
	import EventLog from '$lib/components/EventLog.svelte';
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
	import { rotationTabs as rt } from '$lib/rotationTabs.svelte';
	import { benchBand } from '$lib/benchBand.svelte';
	import { documentBar as db } from '$lib/documentBar.svelte';
	import { constellations, savedNotations, siteSettings } from '$lib/stores';
	import { get } from 'svelte/store';
	import { stripDeepLinkParams } from '../lib/deepLinkUrl';
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
		const doc = {
			label,
			notation: shared.notation,
			tabLoadout: shared.loadout,
			tabCon: importedCon
		};
		if (rt.adopt(doc)) {
			db.showNotice('Loaded shared rotation');
			return;
		}
		// ⚓ EVERY TAB IS OCCUPIED, SO THE LINK GOES TO THE BANK — ⛔ never over a
		// tab with work in it (see `rotationTabs.adopt` for what this replaced).
		//
		// The reader clicked a link expecting to RECEIVE something, so refusing
		// outright is the one answer that fails them twice: the param has already
		// been stripped by then, so there is nothing left to retry. Parking it in
		// Saved Rotations delivers the content, costs one entry they can delete,
		// keeps all six tabs, and uses a surface that is already one button away
		// in the same band. ⛔ Not a confirm dialog either — tool surfaces here are
		// non-modal, and a blocking prompt on a link the user just opened
		// interrupts a flow they did not start.
		//
		// ⚠ DEDUPED ON THE WAY IN. Even with the dialog, a reader can legitimately
		// open the same link twice — from the same message, or after a refresh —
		// and every arrival would otherwise add another identical entry. Matching
		// on the NOTATION (not the name, which is always "Shared rotation") means
		// two genuinely different links still bank separately, and the same one
		// twice does not.
		const already = get(savedNotations).some(
			(e) => e.name === label && e.notation === shared.notation
		);
		if (!already) {
			savedNotations.save({
				name: label,
				notation: shared.notation,
				tabLoadout: shared.loadout,
				tabCon: importedCon
			});
		}
		// ⚓ A MODAL, NOT A NOTICE (⚓ Nate) — this outcome leaves the planner
		// looking untouched, so a 2.2s line in band A reads as "nothing happened"
		// and the reader clicks the link again. See documentBar.showParked.
		db.showParked(label);
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
		// and a bad link doesn't linger in the address bar. ⛔ Not
		// $app/navigation's replaceState — see stripDeepLinkParams; taking that
		// advice makes every cold-loaded share link silently do nothing.
		stripDeepLinkParams(url);
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
			// ⚠ Same rule as a shared link, one line away — `importTeam` had the
			// identical clobber-the-active-tab bug, and two answers to "where does
			// an incoming document go" is how they drift.
			db.showNotice(rt.importTeam(ids) ? 'Team loaded' : 'Tabs full — close one to load a team');
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
	/** ⚓ The EFFECTIVE constellation map — the tab's Layer-2 override over the
	 *  roster's Layer-1 default, the same resolution `RotationTimeline` feeds the
	 *  parser. A caveat is gated by its constellation entry (2026-08-18), so the
	 *  panel must be told which entries the reader actually has. */
	let effectiveCon = $derived({ ...$constellations, ...rt.tabCon });

	let slotCaveats = $derived(
		collectSlotCaveats(
			slots.map((id) => getLoadedCharacter(id)),
			effectiveCon
		)
	);

	/** ↻ BACK TO CAVEATS ALONE (2026-08-17). Gauge round L6 had added `|| hasAura`
	 *  so the standing "how the aura is modelled" block could reach a
	 *  fully-curated team with no caveats — that block lives at the head of the
	 *  aura LOG now, so this reason left with it, and keeping the second gate
	 *  would open an EMPTY notes panel. `plannerView.hasAura` retired in the same
	 *  breath: it existed for this expression and had no other reader. */
	let hasNotes = $derived(slotCaveats.length > 0);

	$effect(() => {
		pv.hasCaveats = hasNotes;
		// A rebuild that leaves nothing to annotate closes the panel; the band's
		// own button is disabled in the same breath by the flag above.
		// ⛔ `closeIfShowing`, not `aside = null` — a caveat-free team must not
		// close the LOG panel as a side effect (2026-08-17).
		if (!hasNotes) pv.closeIfShowing('notes');
	});

	/** ⚓ ONE COLUMN, TWO POSSIBLE OCCUPANTS — the aside is a slot and this is the
	 *  single expression that decides what fills it (see ToolColumns' header, and
	 *  `plannerView.AsidePanel` for why the exclusivity is in the state). */
	let showAside = $derived((pv.showNotes && hasNotes) || (pv.showLog && pv.hasAuraLog));

	/** The aura's standing modelling limits — see the `auraLimits` snippet below
	 *  for the sourcing rule that governs every line. */
	const AURA_NOTES = [
		'One enemy, and it never applies an element back at you — so no Pyro from a Blazing Axe Mage, and no auras you did not put there.',
		'Hits land on their listed timing. A swing that hits several times counts as one application, and Shatter is not modelled.',
		'A pip with a yellow ring means we are using a default gauge strength of 1U for that hit rather than a measured one.',
		// ⚠️ The one thing the gadget strip could be misread as. A Prism bar says
		// WHEN the field exists; nothing on the chart says where it is, and the
		// house rule (docs/library/game/stellar-reactions.md) is that a field is
		// assumed entered — the same assumption every character's dropped field
		// already gets.
		'A Starlight Prism bar says when the Polestar Field is up, not where — we assume you are standing in it.'
	];
</script>

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
			<!-- ══ THE LEFT ZONE (⚓ NATE 2026-09-14) ═════════════════════════════
			     The zoom cluster, ahead of the rail. Band B had gone right-heavy —
			     seven plates queued at the end and the rail's whole run empty but
			     for the readout — so the SCALE controls sit on the left, and the
			     right zone keeps what is DRAWN (the layers), what TIME the parse
			     keeps (Human timing) and what is OPEN (the aside panels). ↻ Human
			     timing rode here for one try and went back: beside the rail it read
			     as part of the zoom cluster. The zone is plates on the bare scene
			     like the right one. -->
			<!-- ↻ ⚓ NATE 2026-08-17: THE ZOOM, AND NOTHING ELSE. This briefly meant
			     the whole of band B's state — zoom, the notes panel and the two
			     layers — which is a fair reading of "Reset view" and the wrong
			     control: a scale is something you fiddle with and want back, while
			     a panel and a layer are things you deliberately opened, and
			     sweeping them away as a side effect of fixing your zoom does more
			     than you asked. One button, one job, and the label says which.
			     It sits left of the zoom group because that is what it undoes.
			     ↻ ⚓ Nate 2026-09-14: the word is "Reset" now, not "Reset zoom" —
			     the cluster moved to the band's LEFT, away from every other
			     button, so the slider beside it says what is being reset.
			     Inert at the resting scale, like the zoom buttons at their
			     limits. -->
			<button
				class="btn btn--sm rp-reset"
				type="button"
				aria-label="Reset the zoom to its resting level"
				title="Back to the resting zoom"
				disabled={pv.scale === ZOOM_DEFAULT}
				onclick={() => pv.reset()}
			>
				<Mark name="resetZoom" />
				<span class="rp-band-label">Reset</span>
			</button>
			<div class="rp-zoom" role="group" aria-label="Zoom">
				<button
					class="btn btn--sm btn--icon"
					type="button"
					aria-label="Zoom out"
					disabled={pv.scale <= ZOOM_MIN}
					onclick={() => pv.zoomBy(-ZOOM_STEP)}><Mark name="zoomOut" size={18} /></button
				>
				<!-- ⚓ Nate 2026-09-14: the slider rides a glass plate of its own. Bare
				     over the scene it read fine beside 26px steppers; once every band B
				     control stands at the full control height the naked track is the
				     one thing in the row without a ground. -->
				<span class="rp-zoom-slider-plate">
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
				</span>
				<button
					class="btn btn--sm btn--icon"
					type="button"
					aria-label="Zoom in"
					disabled={pv.scale >= ZOOM_MAX}
					onclick={() => pv.zoomBy(ZOOM_STEP)}><Mark name="zoomIn" size={18} /></button
				>
			</div>
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
		     control, and a strip is exactly what a readout wants to sit on.
		     ↻ 2026-09-14: the left zone is no longer empty (see bandBLeft), so
		     the rail runs from the zoom cluster to the layer plates. -->
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
			<!-- ══ HUMAN TIMING (2026-09-14) ═══════════════════════════════════
			     Its own group, NOT a third layer plate: the layers change what the
			     chart DRAWS, this changes what time the parse KEEPS. ⚓ Nate, over
			     three tries: it sits FIRST in the right zone, ahead of Buffs — after
			     the layers it split Auras from the Log, which belong together, and
			     on the left beside the rail it read as part of the zoom cluster.
			     Same laws as
			     the layers — never disabled, nothing resets it, per taste
			     (`siteSettings`), ⛔ never in the `?r=` codec — and a lit plate is
			     the announcement that the chart is padded. What it does is set in
			     Settings (a three-way choice, so it can never be lit and idle);
			     the model and its authority live in `$lib/sim/humanTiming.ts`. -->
			<div class="rp-layers" role="group" aria-label="Human timing">
				<button
					class="btn btn--sm"
					class:is-active={$siteSettings.humanTiming}
					type="button"
					aria-pressed={$siteSettings.humanTiming}
					title="Time the rotation as a person plays it: pad the inputs the game does not buffer, let animations finish. Configure in Settings."
					onclick={() => siteSettings.setHumanTiming({ humanTiming: !$siteSettings.humanTiming })}
				>
					<Mark name="hand" />
					<span class="rp-band-label">Human timing</span>
				</button>
			</div>
			<!-- ══ THE LAYERS (2026-08-17) ══════════════════════════════════════
			     What the chart draws besides ability timings. Band B is the VIEW,
			     so this is where they belong; ⛔ NOT the Settings modal, and ⛔ not
			     a "Layers ∨" menu, which was considered and rejected. There are
			     two, so a menu is an abstraction with no user — and the point of a
			     stripped-down chart is that it ANNOUNCES itself. A lit plate says
			     "buffs are hidden" at a glance; a closed menu turns "why is my
			     timeline empty" into a hunt.

			     ⚠ NEVER DISABLED, unlike Notes. Whether the current rotation
			     happens to produce an aura changes on every keystroke, so a
			     control gated on it would grey in and out while you type. These
			     state a standing preference — draw this layer when there is one —
			     which is answerable at all times, including on an empty tab.

			     ↻ ⚓ NATE 2026-08-17, LATER THE SAME DAY: (Buffs)(Auras), reversing
			     the (Auras)(Buffs) he asked for that morning. The order is not
			     arbitrary now that the aura LOG sits immediately to the right — put
			     Auras last and the two aura controls are adjacent, so the run reads
			     buffs · auras · the aura's transcript rather than interleaving two
			     subjects. ⚠ The pair is still ONE group at the tighter gap; only
			     their order moved. -->
			<div class="rp-layers" role="group" aria-label="Timeline layers">
				<button
					class="btn btn--sm"
					class:is-active={$siteSettings.showTimelineBuffs}
					type="button"
					aria-pressed={$siteSettings.showTimelineBuffs}
					title="Draw buff bars, weapon procs, Nightsoul bursts and Ascendant Gleam"
					onclick={() =>
						siteSettings.setTimelineLayers({
							showTimelineBuffs: !$siteSettings.showTimelineBuffs
						})}
				>
					<Mark name="buff" />
					<span class="rp-band-label">Buffs</span>
				</button>
				<button
					class="btn btn--sm"
					class:is-active={$siteSettings.showAuraLane}
					type="button"
					aria-pressed={$siteSettings.showAuraLane}
					title="Draw the target's elemental gauge, with applications and reactions"
					onclick={() =>
						siteSettings.setTimelineLayers({ showAuraLane: !$siteSettings.showAuraLane })}
				>
					<Mark name="aura" />
					<span class="rp-band-label">Auras</span>
				</button>
			</div>
			<!-- ══ THE ASIDE'S TWO PANELS (2026-08-17) ═════════════════════════
			     ⚓ TWO PEER TOGGLES, NOT A SEGMENTED PICKER. They share the column,
			     so opening one closes the other — but each is also independently
			     closeable, and a 3-state segment (Notes | Log | off) has no honest
			     form. Two buttons that each toggle, with the exclusivity in the
			     state, says exactly what happens. Same group as the layer plates
			     above them and the same tight gap: both answer "what is on screen".
			     ⚠ Each disables on its OWN content, which is why they are not one
			     control — a rotation can easily have a log and no caveats. -->
			<button
				class="btn btn--sm rp-notes-btn"
				class:is-active={pv.showLog}
				type="button"
				aria-label="Toggle the aura log"
				title="The target's aura, application by application"
				disabled={!pv.hasAuraLog}
				onclick={() => pv.togglePanel('log')}
			>
				<Mark name="log" />
				<span class="rp-band-label">Log</span>
			</button>
			<button
				class="btn btn--sm rp-notes-btn"
				class:is-active={pv.showNotes}
				type="button"
				aria-label="Toggle notes panel"
				disabled={!pv.hasCaveats}
				onclick={() => pv.togglePanel('notes')}
			>
				<Mark name="note" />
				<span class="rp-band-label">Notes</span>
				<!-- ⛔ THE `!` BADGE IS RETIRED (⚓ NATE 2026-08-17), and the reason is
				     that its job was taken over by its NEIGHBOURS. It existed because
				     Notes stood alone at the end of band B and a reader might never look
				     there; with Auras and Buffs beside it the eye goes to that cluster
				     anyway, so the mark was charging for attention already bought —
				     ⚓ Nate: it "does trigger some people with OCD". The button still
				     disables itself when there is nothing to annotate, which is the
				     honest half of the signal and the half that never nagged.
				     ⚠ The artwork survives at assets-src/tools/notification.svg. If a
				     badge is ever wanted again, ⛔ don't redraw it: it is Nate's, its two
				     fills were wired to --ui-danger/--chrome rather than the SVG's baked
				     hexes, and it carried a 6° rotation so it read as stuck on rather
				     than typeset. -->
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
			<!-- Below BP.toolMin the aside is a DRAWER over the chart rather than a
			     column beside it (ToolColumns' sheet): the Log/Notes plates open
			     it exactly as they open the column, and closing it nulls the same
			     state they toggle. -->
			<ToolColumns
				{main}
				aside={showAside ? asideColumn : undefined}
				sheet={below('toolMin')}
				asideTitle={pv.showLog ? 'Target aura' : 'Notes'}
				onCloseAside={() => (pv.aside = null)}
			/>
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
	{#if pv.showLog}
		<!-- ⚓ THE LANE IN WORDS. The same projection the chart draws (see
		     $lib/timeline/auraLog), so a row and the mark above it cannot disagree
		     — and it says the one thing the chart cannot fit: WHO applied it.
		     ⚠ The heading is inside the scroller's box rather than sticky: the
		     column is one continuous reading and a 22px sticky bar over a
		     several-hundred-row transcript costs more than it explains. -->
		<div class="rp-log-panel">
			<div class="rp-log-head">Target aura</div>
			<!-- ⚓ THE TWO CHANNELS ARE SCALARS IN SECONDS, both brokered by
			     plannerView — see its note. `hover` lights the rows the chart's
			     cursor stands on; `onHover` drives the chart's own crosshair from
			     here; `onSeek` scrolls the timeline to the instant a row names. -->
			<EventLog
				rows={pv.auraLog}
				empty="This rotation puts nothing on the target."
				lead={auraLimits}
				hover={pv.auraHover}
				onHover={(seconds) => (pv.logHover = seconds)}
				onSeek={(seconds) => pv.scrollToSeconds?.(seconds)}
			/>
		</div>
	{:else}
		<RotationNotes entries={slotCaveats} />
	{/if}
{/snippet}

<!-- ══ HOW THE AURA IS MODELLED (gauge round L6; moved here 2026-08-17) ══════
     ⚓ THE LIMITS BELONG BESIDE THE PICTURE, and the picture turned out to be
     this column rather than the Notes panel it opened in: the log IS the aura's
     data, so the caveat sits on top of the thing it qualifies instead of beside
     a panel about somebody's kit. ⚓ Nate put it here the moment the column
     existed.

     ⚠️⚠️ RE-DERIVED FROM THE CODE, NOT COPIED. The round's own plan (§5, written
     at L3) listed "no hyperbloom/burgeon core modelling" — which stopped being
     true at L5b, when dendro cores landed in `gauge.ts` with a real spawn delay
     and lifetime. A stale honesty note is worse than none: it under-claims in
     public while the code has moved on, and a reader who checks once and finds
     it wrong stops believing the rest of it.

     ⛔ Do not add a line here without a source in the code. Each of these is one:
       one enemy          — `gauge.ts` carries a single `ModState`
       nothing back       — no path applies an aura the enemy owns
       no Shatter         — `sim/reactionBridge.ts` leaves it unemitted
       nominal schedule   — `application[]`'s contract C4 (types/ability.ts)
       one hit per swing  — the hit stream's documented approximation
       1U default         — `DEFAULT_UNITS` in `sim/aura.ts`, and what the
                            ring-footed pips mark -->
{#snippet auraLimits()}
	<div class="rp-log-limits">
		{#each AURA_NOTES as note (note)}
			<p>{note}</p>
		{/each}
	</div>
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

	/* Track/thumb styling comes from the shared .slider (app.css). The PLATE is
	   a .btn's face at the band's control height — the same object the
	   steppers either side of it are — with the track centred in it. */
	.rp-zoom-slider-plate {
		display: inline-flex;
		align-items: center;
		height: var(--band-ctrl-h);
		padding: 0 0.65rem;
		border-radius: var(--r-sm);
		background: var(--btn-face);
	}
	.rp-zoom-slider {
		width: 88px;
	}

	/* ══ THE FOLD (responsive round, 2026-09-05; ↻ moved 2026-09-14) ═══════════
	   Band B's controls drop their WORDS and keep their MARKS, and the zoom
	   loses its slider (−/+ step the same scale). ↻ ⚓ Nate 2026-09-14: the fold
	   is BP.wide ($lib/breakpoints.ts — 68rem), a rung minted for exactly this
	   row, not BP.compact (40rem). The Human timing plate, the full-height
	   steppers and the slider's plate took the full form to ~806px of band
	   (zones 268 + 426, rail ~103 for the Total, gaps), and above BP.toolMin the
	   band also gives up the bench COLUMN (~276), so the full form fits only
	   from a ~1082 viewport — below it the Total spilled under the first
	   right-zone plate (37px at 900, 24px at 1040). One monotonic fold at the
	   rung beats a words-on window at 786–864 (bench row) that closes again at
	   864: a reader widening a window should see the words arrive once.
	   ⛔ Not a container query (layout containment would trap the plates'
	   popovers).
	   ⚠ The layer plates are NOT folded into a menu, and that ruling stands on
	   a phone for the same reason it was made: a stripped chart must ANNOUNCE
	   itself, and a lit mark announces exactly as a lit word does. What a
	   reader loses is the word, and the `title`s still carry it.
	   ⚠ Literal from the table, by necessity. */
	@media (max-width: 68rem) {
		.rp-band-label,
		.rp-zoom-slider-plate {
			display: none;
		}
	}
	/* Below BP.compact (40rem) the marks-only row still wants ~354px of band
	   and a 320 phone gives 288, so the Total spilled 20px under the Human
	   timing plate on the very form Nate verified. Two things go: the Reset
	   plate (the steppers still walk the scale back) and the Total's KEY (the
	   number alone, beside the zoom, reads as the length). And the steppers,
	   36px squares since the icon-height exception was withdrawn, narrow to
	   28px plates (the 18px glyph keeps 5px a side) — without it the number
	   spilled 10px at 320 again. Measured: at 320 the number ends 12px short
	   of the rail's edge (2px into its padding), and clear of it from 340. */
	@media (max-width: 40rem) {
		.rp-reset,
		.rp-total-key {
			display: none;
		}
		.rp-zoom > .btn--icon {
			min-width: calc(var(--band-ctrl-h) - 8px);
		}
	}

	/* The two layer toggles read as ONE control — "what is drawn" — so they sit
	   at the tighter intra-group gap the zoom cluster uses rather than band B's
	   own item gap. Same reasoning, same number: a group is a thing whose parts
	   answer one question. Bare flex, no plate — see .rp-zoom. */
	.rp-layers {
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	/* The log fills the aside box and scrolls inside it — the same arrangement
	   RotationNotes makes, for the same reason: the box's height is the main
	   column's, so a long transcript scrolls in place and can never grow the
	   tool. */
	.rp-log-panel {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px;
	}
	/* The kicker voice, matching the notes column's character headings — this is
	   the same kind of object (a column heading), so it takes the same type. */
	.rp-log-head {
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-widest);
		text-transform: uppercase;
		color: var(--muted);
		flex-shrink: 0;
	}

	/* The standing limits, at the head of the transcript and INSIDE its scroller
	   — three paragraphs pinned over a several-hundred-row list would spend a
	   third of the column permanently on something you read once. The rule under
	   them is what separates a caveat about the model from the data itself. */
	.rp-log-limits {
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding-bottom: 10px;
		margin-bottom: 4px;
		border-bottom: 1px solid var(--frame-line);
	}
	.rp-log-limits p {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--lh-normal);
		color: color-mix(in srgb, var(--text) 75%, transparent);
	}
</style>
