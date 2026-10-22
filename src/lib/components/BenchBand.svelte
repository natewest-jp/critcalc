<script lang="ts">
	/**
	 * BenchBand — THE bench RIBBON: a self-contained box holding the four slot
	 * cards of the Planner's active tab, rendered ONCE at the (tools) layout
	 * level and docked over the planner's [data-bench-anchor]. ↻ The Team
	 * Builder left the bench in the lineups round (2026-10-08). The layout owns
	 * its position and travel; this component owns its content.
	 *
	 * - The team is DERIVED from the tab's notation (rotationTabs.slots).
	 *   Constellation/loadout edits here ALWAYS write Layer 2 (the tab's
	 *   overrides); the Library's Roster and the Detail card are the Layer-1
	 *   editors.
	 * - ONE identity everywhere: its own ground and double frame (the per-tool
	 *   ctx flip retired with the ribbon round). ⚓ NATE 2026-08-09: the strip is
	 *   OPAQUE SLATE and stays that way — "the bench is the thing I'm sure
	 *   should be opaque slate the most". It was glass for part of the Genshin
	 *   Night round and reverted the same day. Its double frame could not have
	 *   survived the move regardless: two crossing strokes over alpha lines
	 *   double-composite at every crossing (see .inset--double in app.css).
	 * - `mode` is 'rp' while the ribbon is (or is becoming) docked to the
	 *   planner, null elsewhere; it picks the host whose affordances apply.
	 * - ⚓ IT ENDS IN A POINT (tail round 2026-08-12), Genshin's banner shape:
	 *   square top, straight sides, a tapered tail. Its height is now simply
	 *   its CONTENT — top chrome + the head + the four cards + the tail —
	 *   and it does not animate at all.
	 *
	 *   That replaced a strip MEASURED against its tool's dock and stretched to
	 *   `max(that, content)`, padding itself out below the last card with empty
	 *   ribbon so its bottom edge would meet the tool frame's. ⚓ Nate: "it
	 *   animates to extend down to different heights with no content at all.
	 *   Its only purpose has been to try to line up with edges of tools." A
	 *   point has nothing to line up — it terminates rather than negotiates —
	 *   so the measurement, the `height` prop and the travel animation all went
	 *   with the job they existed to do.
	 *
	 *   ⚠ CONTENT-SIZED IS NOT THE SAME AS RESPONSIVE. Every typical rotation
	 *   leaves each slot at its BENCH_SLOT_H floor, so the height is a constant
	 *   in practice; it only grows in the extreme many-bars case, where it must,
	 *   because each card is exactly as tall as the track group it labels.
	 *
	 *   The silhouette is a generated `clip-path` and the double frame is a
	 *   generated SVG — see the tail block in benchBand.svelte.ts for both, and
	 *   for why neither could stay a CSS box.
	 */
	import SlotPortrait from '$lib/components/SlotPortrait.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { rotationTabs as rt } from '$lib/rotationTabs.svelte';
	import {
		benchBand,
		BENCH_SLOT_H,
		RIBBON_PAD,
		// RIBBON_EDGE / RIBBON_FRAME_BORDER / RIBBON_RADIUS are no longer read
		// here: the inset, the stroke weight and the corner all live inside the
		// generated path now, which is the point of generating it.
		RIBBON_FRAME_R_TIGHT,
		RIBBON_FRAME_R_WIDE,
		RIBBON_CHROME,
		ribbonHead,
		RIBBON_TAIL_H,
		RIBBON_W,
		RIBBON_RADIUS,
		BENCH_ROW_H,
		BENCH_ROW_CARD_H,
		BENCH_ROW_CARD_GAP,
		rowCardWidth,
		rowPortrait,
		ribbonClipPath,
		ribbonFramePath,
		ribbonFramePathRect
	} from '$lib/benchBand.svelte';
	import { narrowForm } from '$lib/media.svelte';
	import { constellations, loadout, ownership, type LoadoutEntry } from '$lib/stores';

	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { awakeIds } from '$lib/utils/notationEdit';

	let {
		mode
	}: {
		/** The tool the band is docked to (or traveling toward). */
		mode: 'rp' | null;
	} = $props();

	// ⚠ FOUR PROPS LEFT WITH THE TAIL (2026-08-12): `height`, `traveling`,
	// `travelMs`, `travelEase`. They existed to stretch the strip to a MEASURED
	// dock height and to ease that stretch on a tool pan — a job a pointed
	// bottom does not have, since a point terminates instead of meeting an edge.
	// The layout no longer measures for us. See the tail block in
	// benchBand.svelte.ts for the whole argument.

	// Card heights: the planner's published slot metrics, retained across a
	// trip away (see benchBand.slotHeights). The resting rhythm carries only
	// the first frames before the timeline has published at all.
	const heights = $derived(
		benchBand.slotHeights ?? [BENCH_SLOT_H, BENCH_SLOT_H, BENCH_SLOT_H, BENCH_SLOT_H]
	);

	// THE BOX IS ITS CONTENT: top chrome + head + cards + tail. It was
	// `max(measured dock height, content)` until the tail round; the tail
	// supplies the bottom now, and there is no longer an edge to reach for.
	// One chrome, not two — the tail IS the space under the last card, and its
	// first TAIL_LEAD px are straight, so that space is more generous than the
	// 12px it replaces rather than less.
	// ↻ 2026-08-17: the head is a FUNCTION of the planner's published track top,
	// which grows when a lane rides above the time axis — see
	// `benchBand.trackTop`.
	const head = $derived(ribbonHead(benchBand.trackTop, benchBand.noBandA));

	// ══ THE ROW FORM (responsive round, 2026-09-05) ═══════════════════════════
	// Below BP.toolMin the strip is HORIZONTAL: four cards in a row above the
	// band stack, spanning the dock's measured width, one constant height. The
	// column's whole vertical grammar — the head, the per-slot heights, the
	// tail — is what lands each card on its planner track group, and a row has
	// no track groups to land on; so none of it applies here, and the box is
	// simply chrome + one card row + chrome. See benchBand.svelte.ts § THE ROW
	// for why the orientation is responsive rather than one or the other.
	// ↻ 2026-10-15 (responsive sweep §3 item 4): a SHORT screen takes the row
	// too (`narrowForm()`, breakpoints.ts § THE HEIGHT AXIS) — the column costs
	// height a landscape phone does not have. ToolStack's @media says the same.
	const row = $derived(narrowForm());

	const boxW = $derived(row ? benchBand.dockW : RIBBON_W);
	const boxH = $derived(
		row ? BENCH_ROW_H : RIBBON_CHROME + head + heights.reduce((a, b) => a + b, 0) + RIBBON_TAIL_H
	);

	// The row's ONE form is the UPRIGHT card (portrait round, ⚓ Nate
	// 2026-10-13): the portrait takes what four cards get from the strip,
	// floored and capped (benchBand `rowPortrait`), and the card is that plus
	// the upright pill. Decided HERE from the arithmetic rather than by a
	// container query on the slot, because `container-type` implies layout
	// containment and would make each slot the containing block for the card's
	// viewport-fixed popovers.
	const rowDisc = $derived(row ? rowPortrait(boxW) : 0);
	const compact = $derived(row);

	// Resolved card characters. Index entries satisfy SlotPortrait's SlotChar
	// shape and are available eagerly (no payload wait). A 'blank' slot shows
	// the generic Blank card only where the notation actually casts it
	// (planner metrics say so); everywhere else it's an empty add-slot.
	// ↻ 2026-10-22 (§8.1): read off the stored SEATS, where an empty slot is
	// null and a seated Blank is 'blank' — the distinction `blankUsed` used to
	// reconstruct from the parse.
	const chars = $derived(rt.seats.map((id) => (id ? (getCharacterIndexEntry(id) ?? null) : null)));
	/** Seated characters the notation does not name yet: they REST (§8.1). */
	const awake = $derived(awakeIds(rt.seats, rt.notation));

	// Effective (Layer-2 ⇒ Layer-1) display values — the planner column's rule,
	// now the bench's rule everywhere.
	function effectiveCon(id: string): number {
		return rt.tabCon[id] ?? $constellations[id] ?? 0;
	}
	function effectiveLoadout(id: string): LoadoutEntry {
		return { ...($loadout[id] ?? {}), ...(rt.tabLoadout[id] ?? {}) };
	}

	/** Your account's constellation — the Builder's rule (BoardView
	 *  `ownedConOf`): unknown while the roster is empty, null when not owned. */
	const rosterHasContent = $derived(Object.values($ownership).includes('owned'));
	function ownedConOf(id: string): number | null | undefined {
		if (!rosterHasContent || id === 'blank') return undefined;
		return $ownership[id] === 'owned' ? ($constellations[id] ?? 0) : null;
	}

	// The affordances of the tool we are docked to (or traveling toward) —
	// keyed, not last-writer-wins. See the note on BenchBandState#hosts for the
	// page revival this survives.
	const host = $derived(benchBand.hostFor(mode));

	/**
	 * ⚓ THE PORTRAIT READS, THE RAIL ACTS (bench-buttons round, Nate
	 * 2026-10-22): a filled portrait opens the character's details on the desk
	 * as on the phone, and ⇄ / ✕ stand in the rail beside it. With nobody to
	 * read, an empty portrait (or a typed Blank's) still ADDS through the
	 * Builder on the desk. On the phone there is no Swap (swap mode needs the
	 * lineup beside the grid, which a phone cannot show), so an empty portrait
	 * does nothing and Remove lives in the details card.
	 */
	function portraitClickFor(char: { id: string; displayName: string } | null, i: number) {
		if (!host) return undefined;
		const h = host;
		const filled = char && char.id !== 'blank' ? char.id : null;
		if (filled) return () => h.onOpenDetail(filled);
		return row ? undefined : () => h.onSwap(i, char?.id ?? null);
	}
</script>

<!-- The RIBBON: a self-contained STRIP with its own ground, double frame and
     radius — ONE identity in both tools (the per-tool ctx flip retired with
     the frame-zone model; the ground is OPAQUE SLATE, ⚓ NATE). The tool frames
     are loose siblings tucked under its edges, and it stands proud of them at top
     and bottom. Interior styling is interim — the card redesign (Nate's
     mockup) is its own follow-up round. -->
<!-- ↻ 2026-09-05: TWO BOXES FROM ONE ELEMENT. The column keeps its generated
     silhouette (a clip-path, because it ends in a point); the row is a plain
     rounded rectangle and needs no clip at all — a border-radius on the ground
     is the whole shape, and the frame ring below closes at the bottom exactly
     as it does at the top. -->
<div
	class="bb ctx-dark"
	class:bb--row={row}
	style:width="{boxW}px"
	style:height="{boxH}px"
	style:padding={row
		? `${RIBBON_CHROME}px`
		: `${RIBBON_CHROME + head}px ${RIBBON_CHROME}px ${RIBBON_TAIL_H}px`}
	style:clip-path={row ? undefined : `path('${ribbonClipPath(boxH)}')`}
	style:border-radius={row ? `${RIBBON_RADIUS}px` : undefined}
	style:--bb-pad="{RIBBON_PAD}px"
	style:--bb-card-gap="{BENCH_ROW_CARD_GAP}px"
	style:--bb-card-w="{rowCardWidth(rowDisc)}px"
>
	<!-- ── THE DOUBLE FRAME, NOW ONE SVG (tail round 2026-08-12) ──────────────
	     It was two absolutely-positioned <span>s wearing CSS borders, which is
	     the one thing a border cannot do here: a border draws a rounded
	     RECTANGLE, and this box ends in a point. Clipping them to the taper
	     would not help — a clipped border stops at the cut instead of following
	     it, which is exactly the trap that makes clip-path fine for the GROUND
	     (no stroke of its own) and useless for a line.

	     ⚠ ONE ELEMENT, TWO PATHS, AND THAT IS THE POINT. The alternative — a
	     separate "cap" for the tail — would have put a CSS border and an SVG
	     edge against each other at a seam, in FOUR places (two strokes × two
	     sides), across two rasterisers that this repo has already measured
	     disagreeing about stroke weight (Chrome floors border-width to whole CSS
	     px; WebKit does not). One renderer has no seam to align.

	     The two paths still differ only in corner radius, so the wide arc cuts
	     across the tight one exactly as before — the ornament is unchanged, it
	     simply has nowhere to appear at the bottom any more. -->
	<svg class="bb-frame" width={boxW} height={boxH} viewBox="0 0 {boxW} {boxH}" aria-hidden="true">
		<path
			d={row
				? ribbonFramePathRect(boxW, boxH, RIBBON_FRAME_R_TIGHT)
				: ribbonFramePath(boxH, RIBBON_FRAME_R_TIGHT)}
			fill-rule="evenodd"
		/>
		<!-- ⚓ Nate 2026-10-14, trying it: the column (desktop) drops the wide
		     arc and keeps the tight corner alone; the phone row keeps both. -->
		{#if row}
			<path d={ribbonFramePathRect(boxW, boxH, RIBBON_FRAME_R_WIDE)} fill-rule="evenodd" />
		{/if}
	</svg>
	<!-- The card run: a column at rest, a row below BP.toolMin. In the row the
	     cards take their solved width and the strip spreads them. -->
	<div class="bb-cards" class:bb-cards--row={row}>
		{#each rt.slots as _id, i (i)}
			{@const char = chars[i]}
			<div class="bb-slot" style:height="{row ? BENCH_ROW_CARD_H : heights[i]}px">
				<SlotPortrait
					slotId={char ? char.id : 'blank'}
					{char}
					{compact}
					compactDisc={rowDisc || undefined}
					conLevel={char ? effectiveCon(char.id) : 0}
					ownedCon={char ? ownedConOf(char.id) : undefined}
					loadoutEntry={char ? effectiveLoadout(char.id) : {}}
					onSetCon={(level) => char && rt.setTabCon(char.id, level)}
					onSetArtifact={(artId) => char && rt.setTabLoadout(char.id, { artifactSetId: artId })}
					onSetWeapon={(wid, ref) =>
						char && rt.setTabLoadout(char.id, { weaponId: wid, weaponRefinement: ref })}
					onSetRefinement={(r) => char && rt.setTabLoadout(char.id, { weaponRefinement: r })}
					onPortraitClick={portraitClickFor(char, i)}
					portraitLabel={char && char.id !== 'blank'
						? `${char.displayName}'s details`
						: row
							? 'Empty slot'
							: 'Choose a character for this slot'}
					emptyLabel=""
					resting={mode === 'rp' && !!char && !awake.includes(char.id)}
				>
					{#snippet actions()}
						<!-- ⇄ hands the slot to the Builder's swap mode; ✕ empties it and
						     deletes the character's notation (the one way to take a
						     PLACED character off). An empty slot keeps the boxes and
						     hides them; a typed Blank's are live, since a placeholder is
						     exactly what you swap a real character into. -->
						{@const live = !!char}
						<button
							class="bb-act"
							disabled={!live}
							onclick={() => char && host?.onSwap(i, char.id)}
							title={live && char ? `Swap ${char.displayName}` : undefined}
							aria-label={live && char ? `Swap ${char.displayName}` : 'Swap (empty slot)'}
						>
							<Mark name="swap" />
						</button>
						<button
							class="bb-act bb-act--remove"
							disabled={!live}
							onclick={() => rt.setSlot(i, null)}
							title={live && char ? `Remove ${char.displayName} from team` : undefined}
							aria-label={live && char
								? `Remove ${char.displayName} from team`
								: 'Remove (empty slot)'}
						>
							<Mark name="close" />
						</button>
					{/snippet}
				</SlotPortrait>
			</div>
		{/each}
	</div>
</div>

<style>
	/* The ribbon box: its OWN surface — the dark context's ground and its
	   radius — one identity everywhere. Width, height, padding and radius come
	   inline from the RIBBON_* knobs so the dock math and the box always agree.
	   The ground carries NO stroke of its own (the mockup's outer "border" is
	   the ground's edge against whatever it floats over); the two strokes below
	   are the frame. overflow:hidden keeps a card column that outgrows a short
	   frame inside the strip — SlotPortrait's popovers are position:fixed and
	   escape it. INTERIM styling: the mockup's interior (ringed portrait, chip
	   row) is the follow-up card round's. */
	.bb {
		position: relative;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		/* ↻ 2026-08-09: --frame-bg → --surface. Identical here (the dark context
		   declares both as slate-800), but --surface is the token you PAINT and
		   --frame-bg is the reference everything MIXES against — a distinction
		   with no teeth in the opaque contexts and real teeth in .ctx-glass.
		   Naming the right one costs nothing and stops this from being a trap if
		   the strip's material is ever revisited.

		   ── THE SHADE, AND WHY IT STAYS HERE (⚓ NATE asked, 2026-08-11) ───────
		   ⚠ THE STRIP IS LIGHTER THAN THE GLASS BESIDE IT, AND THAT IS THE
		   SEPARATION. Composited properly — --glass-panel .58 over the scene
		   under the wash (--scene-dim at TOOL_DIM .75) — a band lands around
		   #262b36…#293040 depending on what the world is doing behind it, i.e.
		   essentially ON slate-900. The strip at slate-800 is therefore one rung
		   ABOVE its neighbours, which is what makes it read as the solid lit
		   object standing among translucent panes.
		   Moving it one darker to --surface-well would put it AT the glass's own
		   average, and then the only thing distinguishing opaque from glass is
		   whether stars swim through it — the middle the "opaque or obviously
		   translucent" law exists to keep empty.
		   ⚠ It also costs the card its ladder: the controls are --surface-well
		   (see --sp-pill-fill), so a strip on that same rung would have the well
		   collapse into the ground it is cut into — and slate-900 is now the
		   ramp's BOTTOM rung, with nothing below to fall back to (⚓ Nate merged
		   it with slate-950 on 2026-08-11).
		   ⚓ SETTLED: it stays at --surface. /lab § "The bench, on the scene"
		   held the comparison against a real band (git: 40bcb5b1). */
		background: var(--surface);
		/* Belt to clip-path's braces: the silhouette already cuts the box, but a
		   card column that outgrew a short frame used to rely on this and the
		   cost of keeping it is nothing. */
		overflow: hidden;
	}
	/* ⚓ Nate 2026-10-14: THE ROW CLIPS NOTHING. The upright card has no head
	   room — its disc fills the card — so the portrait's hair rises over the
	   double line and, for the tallest icons, past the strip's edge (Amber's
	   bow ~8px at the 56 disc), the desk card's rule ("nothing clips it").
	   Measured over the 147 side icons: 105 rise above the disc, median 2.8px,
	   5 by more than the strip's 12px of chrome. */
	.bb--row {
		overflow: visible;
	}

	/* The two frame strokes, drawn as one overlay. Geometry (both radii, both
	   edges of each 2px band, and the taper) is generated in benchBand.svelte.ts
	   from Nate's artwork; this only places the canvas and gives it its ink.
	   Above the ground, below the cards — the cards start RIBBON_PAD inside it,
	   so nothing overlaps in practice.

	   `fill: currentColor` rather than a token per path: the colour is stated
	   ONCE here and both paths take it, which is the same "one line, two
	   corners" contract the CSS pair had. */
	.bb-frame {
		position: absolute;
		inset: 0;
		color: var(--frame-line-quiet);
		fill: currentColor;
		pointer-events: none;
	}

	/* The card run. A flex column that changes nothing about the column form —
	   the slots carry explicit heights and shrink nowhere — so that the row form
	   can be the same element turned sideways. */
	.bb-cards {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		min-width: 0;
	}
	.bb-cards--row {
		flex-direction: row;
		/* Spreads the four solved cards across the strip: from ~390px their
		   portraits are capped and the cards are narrower than a quarter. */
		justify-content: space-between;
		gap: var(--bb-card-gap);
		/* ↻ 2026-10-14: NOT a scroller any more. It was `overflow-x: auto` as a
		   guard that never fired (from 320px up four cards always fit — see
		   BENCH_ROW_PORTRAIT_MIN), and a scroller cannot show anything outside
		   its box on EITHER axis, so it was cutting every portrait's hair at
		   the disc's top. */
	}
	.bb-cards--row > .bb-slot {
		flex: 0 0 var(--bb-card-w);
	}

	.bb-slot {
		position: relative;
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex-shrink: 0;
		box-sizing: border-box;
		/* ⛔ NO HEIGHT TRANSITION (tail round). It only ever ran while the layout
		   flagged `traveling`, i.e. inside the 2s camera crane with both tool
		   surfaces cross-fading over it — so it animated exclusively where it
		   could not be seen. It also cannot come back alone: the tail is pinned
		   below the last card, so a slot that eased while the box snapped would
		   drag the point around behind it. Both or neither; ⚓ Nate chose neither. */
	}
	/* ⛔ THE SHELF LINE BETWEEN CARDS IS GONE (⚓ NATE 2026-08-12), and with it
	   RIBBON_DIVIDER_H. It was drawn for a card that filled its slot; the card
	   is a fixed 78px band sitting at the TOP of a slot that can be any height,
	   so a rule at the slot boundary no longer marked the edge of anything you
	   could see — ⚓ Nate: "if they're going to sit at the top of their row, then
	   having that border separator only highlights how they're off-center from
	   their slot height." The cards' own spacing separates them now.
	   ⚠ If a separator ever comes back it must still take NO height: card k's
	   top has to stay on the cumulative sum the planner's track groups use. */

	/* ── Slot commands (⇄ · ✕) — THE RAISED REGISTER ─────────────────────────
	   Lifted from the pre-2026-10-13 rail (bench-buttons round, ⚓ Nate
	   2026-10-22): VALUE CONTROLS ARE WELLS, COMMAND BUTTONS ARE RAISED, and
	   squares where the value controls are capsules. New this round: QUIET AT
	   REST, and they stay quiet until a tile ITSELF is pointed at. ⚓ Nate
	   2026-10-22: a first cut raised the whole rail on card hover, and moving
	   the cursor over the strip lit things up all over the place; the dimmed
	   mark is legible enough on its own.

	   The box is the card's (.sp-rail stretches them to split the band). The
	   mark is ranged LEFT: the tile's right half runs on under the opaque disc
	   as ::before, so a centred glyph would be centred in a box mostly hidden.

	   🐛 THE CUSTOM PROPERTY IS WHAT ANIMATES: pseudo-elements do not inherit
	   their element's transitions, so easing two backgrounds showed a seam
	   down the tile mid-hover. One registered value, re-resolved by both boxes
	   (inherits: true, or ::before reads the initial value). */
	@property --bb-act-fill {
		syntax: '<color>';
		inherits: true;
		initial-value: transparent;
	}
	.bb-act {
		position: relative;
		box-sizing: border-box;
		display: grid;
		place-items: center start;
		padding: 0 0 0 var(--sp-rail-mark-inset);
		border: none;
		border-radius: var(--r-sm) 0 0 var(--r-sm);
		/* At rest, halfway from the card's ground to the raised rung: there,
		   but not asking. An opaque mix, so the alpha stays in the paint. */
		--bb-act-fill: color-mix(in srgb, var(--surface-raised) 45%, var(--surface));
		background: var(--bb-act-fill);
		color: var(--sp-unset-ink);
		cursor: pointer;
		transition:
			color var(--t-snap),
			--bb-act-fill var(--t-snap);
	}
	.bb-act::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 100%;
		width: var(--sp-rail-underlap);
		background: var(--bb-act-fill);
		border-radius: 0 var(--r-sm) var(--r-sm) 0;
		pointer-events: none;
	}
	/* A tile itself: one rung up (7% white is where slate-700 meets 600, the
	   step a role may carry), ink to full. */
	.bb-act:hover:not(:disabled),
	.bb-act:focus-visible {
		--bb-act-fill: color-mix(in srgb, white 7%, var(--surface-raised));
		color: var(--text);
	}
	/* ✕ announces itself with a surface: the destructive one goes red. */
	.bb-act--remove:hover:not(:disabled),
	.bb-act--remove:focus-visible {
		--bb-act-fill: color-mix(in srgb, var(--ui-danger) 22%, var(--surface-raised));
		color: color-mix(in srgb, var(--ui-danger) 45%, white);
	}
	/* An empty slot: the boxes stay (the portraits do not step sideways) and
	   paint nothing. ⛔ Not element opacity — the ribbon is transform-placed. */
	.bb-act:disabled {
		visibility: hidden;
	}
</style>
