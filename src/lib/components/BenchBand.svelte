<script lang="ts">
	/**
	 * BenchBand — THE bench RIBBON: a self-contained box holding the four slot
	 * cards of the working team, rendered ONCE at the (tools) layout level and
	 * docked over each tool's [data-bench-anchor] (planner LEFT, Team Builder
	 * RIGHT — the tool frames tuck beneath its edges as loose siblings). The
	 * layout owns its position and travel; this component owns its content.
	 *
	 * - The team is the shared working team (rotationTabs.slots — the
	 *   planner's active tab). Constellation/loadout edits here ALWAYS write
	 *   Layer 2 (the tab's overrides): the bench is the plan's team editor in
	 *   both tools. The TB roster grid + Detail card remain the Layer-1
	 *   editors.
	 * - ONE identity everywhere: its own ground and double frame (the per-tool
	 *   ctx flip retired with the ribbon round). ⚓ NATE 2026-08-09: the strip is
	 *   OPAQUE SLATE and stays that way — "the bench is the thing I'm sure
	 *   should be opaque slate the most". It was glass for part of the Genshin
	 *   Night round and reverted the same day. Its double frame could not have
	 *   survived the move regardless: two crossing strokes over alpha lines
	 *   double-composite at every crossing (see .inset--double in app.css).
	 * - `mode` is the tool the ribbon is (or is becoming) docked to. It sets
	 *   the card heights (planner: coupled to the timeline's published slot
	 *   metrics; TB: the even resting rhythm) and the ⇄ action's meaning
	 *   (audition on the TB; open the Source on the planner).
	 * - ⚓ IT ENDS IN A POINT (tail round 2026-08-12), Genshin's banner shape:
	 *   square top, straight sides, a tapered tail. Its height is now simply
	 *   its CONTENT — top chrome + RIBBON_HEAD + the four cards + the tail —
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
		RIBBON_HEAD,
		RIBBON_TAIL_H,
		RIBBON_W,
		ribbonClipPath,
		ribbonFramePath
	} from '$lib/benchBand.svelte';
	import { constellations, loadout, type LoadoutEntry } from '$lib/stores';

	import { getCharacterIndexEntry } from '$lib/data/characterLookup';

	let {
		mode
	}: {
		/** The tool the band is docked to (or traveling toward). */
		mode: 'rp' | 'tb' | null;
	} = $props();

	// ⚠ FOUR PROPS LEFT WITH THE TAIL (2026-08-12): `height`, `traveling`,
	// `travelMs`, `travelEase`. They existed to stretch the strip to a MEASURED
	// dock height and to ease that stretch on a tool pan — a job a pointed
	// bottom does not have, since a point terminates instead of meeting an edge.
	// The layout no longer measures for us. See the tail block in
	// benchBand.svelte.ts for the whole argument.

	// Card heights: the planner's published slot metrics, wherever we are.
	// ⚓ NATE 2026-08-12 — this used to be gated on `mode === 'rp'`, so the cards
	// relaxed to an even rhythm on the Team Builder and the four cards you were
	// looking at changed shape as you crossed. The ribbon's whole job across
	// that seam is to be the thing that DOESN'T change. The resting rhythm now
	// only carries a session that has never had a timeline mounted at all (a
	// cold load straight onto the Team Builder).
	const heights = $derived(
		benchBand.slotHeights ?? [BENCH_SLOT_H, BENCH_SLOT_H, BENCH_SLOT_H, BENCH_SLOT_H]
	);

	// THE BOX IS ITS CONTENT: top chrome + head + cards + tail. It was
	// `max(measured dock height, content)` until the tail round; the tail
	// supplies the bottom now, and there is no longer an edge to reach for.
	// One chrome, not two — the tail IS the space under the last card, and its
	// first TAIL_LEAD px are straight, so that space is more generous than the
	// 12px it replaces rather than less.
	const boxH = $derived(
		RIBBON_CHROME + RIBBON_HEAD + heights.reduce((a, b) => a + b, 0) + RIBBON_TAIL_H
	);

	// Resolved card characters. Index entries satisfy SlotPortrait's SlotChar
	// shape and are available eagerly (no payload wait). A 'blank' slot shows
	// the generic Blank card only where the notation actually casts it
	// (planner metrics say so); everywhere else it's an empty add-slot.
	const chars = $derived(
		rt.slots.map((id, i) => {
			if (id === 'blank') {
				return mode === 'rp' && benchBand.blankUsed[i]
					? (getCharacterIndexEntry('blank') ?? null)
					: null;
			}
			return getCharacterIndexEntry(id) ?? null;
		})
	);

	// Effective (Layer-2 ⇒ Layer-1) display values — the planner column's rule,
	// now the bench's rule everywhere.
	function effectiveCon(id: string): number {
		return rt.tabCon[id] ?? $constellations[id] ?? 0;
	}
	function effectiveLoadout(id: string): LoadoutEntry {
		return { ...($loadout[id] ?? {}), ...(rt.tabLoadout[id] ?? {}) };
	}

	// The affordances of the tool we are docked to (or traveling toward) — during
	// a pan BOTH pages are alive, and after an A→B→A pan both are still
	// REGISTERED, which is why the lookup is keyed rather than filtered. See the
	// note on BenchBandState#hosts for the revival this survives.
	const host = $derived(benchBand.hostFor(mode));

	/**
	 * ⚓ NATE 2026-08-12: the portrait does the SAME thing in both tools now.
	 * A filled slot opens that character's Detail card; an empty one — and the
	 * generic Blank, which has no details worth reading — asks the host to fill
	 * it. Nothing here is tool-aware any more; the host decides what "swap"
	 * means (the planner's Source picker, the TB's audition).
	 */
	function portraitClickFor(char: { id: string; displayName: string } | null, i: number) {
		if (!host) return undefined;
		const h = host;
		if (char && char.id !== 'blank') {
			const id = char.id;
			return () => h.onOpenDetail(id);
		}
		return () => h.onSwap(i, char?.id ?? null);
	}
</script>

<!-- The RIBBON: a self-contained STRIP with its own ground, double frame and
     radius — ONE identity in both tools (the per-tool ctx flip retired with
     the frame-zone model; the ground is OPAQUE SLATE, ⚓ NATE). The tool frames
     are loose siblings tucked under its edges, and it stands proud of them at top
     and bottom. Interior styling is interim — the card redesign (Nate's
     mockup) is its own follow-up round. -->
<div
	class="bb ctx-dark"
	style:width="{RIBBON_W}px"
	style:height="{boxH}px"
	style:padding="{RIBBON_CHROME + RIBBON_HEAD}px {RIBBON_CHROME}px {RIBBON_TAIL_H}px"
	style:clip-path="path('{ribbonClipPath(boxH)}')"
	style:--bb-pad="{RIBBON_PAD}px"
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
	<svg
		class="bb-frame"
		width={RIBBON_W}
		height={boxH}
		viewBox="0 0 {RIBBON_W} {boxH}"
		aria-hidden="true"
	>
		<path d={ribbonFramePath(boxH, RIBBON_FRAME_R_TIGHT)} fill-rule="evenodd" />
		<path d={ribbonFramePath(boxH, RIBBON_FRAME_R_WIDE)} fill-rule="evenodd" />
	</svg>
	{#each rt.slots as _id, i (i)}
		{@const char = chars[i]}
		<div class="bb-slot" style:height="{heights[i]}px">
			<SlotPortrait
				slotId={char ? char.id : 'blank'}
				{char}
				conLevel={char ? effectiveCon(char.id) : 0}
				loadoutEntry={char ? effectiveLoadout(char.id) : {}}
				onSetCon={(level) => char && rt.setTabCon(char.id, level)}
				onSetArtifact={(artId) => char && rt.setTabLoadout(char.id, { artifactSetId: artId })}
				onSetWeapon={(wid, ref) =>
					char && rt.setTabLoadout(char.id, { weaponId: wid, weaponRefinement: ref })}
				onSetRefinement={(r) => char && rt.setTabLoadout(char.id, { weaponRefinement: r })}
				onPortraitClick={portraitClickFor(char, i)}
				portraitLabel={char && char.id !== 'blank'
					? `Open ${char.displayName}`
					: 'Choose a character for this slot'}
				emptyLabel=""
			>
				{#snippet actions()}
					<!-- Uniform action set (Nate 2026-08-05): ✕ removes everywhere;
					     ⇄ auditions on the TB but opens the character Source on the
					     planner (stays in-tool). They stack in the card's left RAIL
					     and split the portrait's height between them.
					     Always rendered — an EMPTY slot renders them and the card
					     HIDES them, holding their box so the portraits don't step
					     sideways. The generic-Blank card gets LIVE actions (Nate
					     2026-08-06): a deliberately-typed Blank is a placeholder the
					     user may well want to swap a real character into. -->
					{@const live = !!char}
					<button
						class="bb-act"
						disabled={!live}
						onclick={() => char && host?.onSwap(i, char.id)}
						title={live && char
							? mode === 'rp'
								? 'Change who fills this slot'
								: `Compare ${char.displayName} against replacements`
							: undefined}
						aria-label={live && char
							? mode === 'rp'
								? 'Change who fills this slot'
								: `Audition replacements for ${char.displayName}`
							: 'Swap (empty slot)'}
					>
						<!-- The shared mark set (Lucide via the generator), not hand-cut
					     paths and certainly not the ⇄/✕ code points — those aren't in
					     IBM Plex, so each engine drew its own fallback at its own size
					     (Safari's ✕ came out visibly smaller than Chrome's). Strokes
					     ride currentColor, so the button's color states apply
					     unchanged. NO size override — MARK_SIZE (14) is the standard,
					     and it lands the ✕'s ink at 7px: exactly the height of the C0 /
					     R1 digits beside it (--fs-xs, 10px). ⚓ NATE 2026-08-07; the
					     hand-cut 14×12 / 9×9 they replaced were never a tuned target. -->
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

<style>
	/* Registered so the tile's fill INTERPOLATES rather than snapping, and — the
	   part that matters — so the button and its ::before extension read ONE
	   animating value instead of running two transitions that must agree. See
	   the bug note at .bb-act.
	   ⚠ inherits: TRUE, unlike SlotPortrait's --sp-wash-a: ::before resolves
	   var(--bb-act-fill) through inheritance from its originating element, so a
	   non-inherited registration would hand the extension the initial value and
	   paint it transparent. */
	@property --bb-act-fill {
		syntax: '<color>';
		inherits: true;
		initial-value: transparent;
	}

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
		   holds the comparison against a real band. */
		background: var(--surface);
		/* Belt to clip-path's braces: the silhouette already cuts the box, but a
		   card column that outgrew a short frame used to rely on this and the
		   cost of keeping it is nothing. */
		overflow: hidden;
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
	   ⚓ NATE 2026-08-12, from his mockup: VALUE CONTROLS ARE WELLS; COMMAND
	   BUTTONS ARE RAISED. The constellation chip and the loadout pill are places
	   data sits, cut into the card (--surface-well); these are things you press,
	   standing on it (--surface-raised, one rung the other way). They are also
	   SQUARES where the value controls are capsules, so the split survives at a
	   glance and at distance.

	   ⚠ THIS INVERTS THE 2026-08-11 RULING that all four controls share one flat
	   fill "so they read as one family". That is exactly what went wrong: four
	   identical objects in a row read as ONE continuous bar of chrome, heavy
	   enough to outweigh the portrait it was supposed to caption. The family was
	   real; it was just the wrong family.

	   The box is the CARD's — .sp-rail stretches them to split the portrait's
	   height, so no width/height here. Glyph-only; title/aria carry the meaning.

	   ⚠ THE MARK IS RANGED LEFT, NOT CENTRED (⚓ NATE 2026-08-12), and that is
	   geometry rather than taste: the tile's right edge now sits at the disc's
	   CENTRE, so its right half is behind an opaque circle. A centred glyph
	   would be centred in a box the user cannot see most of. --sp-rail-w is
	   solved from this inset (see .sp-card) so the mark clears the circle's arc
	   at every corner. */
	.bb-act {
		position: relative;
		box-sizing: border-box;
		display: grid;
		place-items: center start;
		padding: 0 0 0 var(--sp-rail-mark-inset);
		border: none;
		/* Square, not round: --r-sm is the box vocabulary's tightest corner, and
		   at this size it reads as a plain square while staying on the scale.
		   LEFT corners only — the right pair belongs to ::before, which carries
		   the rest of the tile. */
		border-radius: var(--r-sm) 0 0 var(--r-sm);
		/* ONE fill, TWO painted boxes. Routed through a custom property so the
		   button and its hidden extension can never disagree — including on the
		   danger hover below, which would otherwise need stating twice.
		   🐛 AND THE PROPERTY IS WHAT ANIMATES, NOT THE TWO BACKGROUNDS. ⚓ Nate
		   saw "a split down the middle that very slightly changes opacity at
		   different timings" on hover, in both engines: PSEUDO-ELEMENTS DO NOT
		   INHERIT THEIR ORIGINATING ELEMENT'S TRANSITIONS, so `transition:
		   background-color` on .bb-act reached the button and not its ::before —
		   the extension SNAPPED while the button eased, and the seam between the
		   two painted boxes showed for the length of the ease. Declaring the
		   transition twice would fix the symptom and leave two numbers to keep in
		   step; registering --bb-act-fill (@property, below) makes ONE
		   interpolating value that both boxes re-resolve per frame, so they
		   cannot desync by construction. Engines without @property snap — but
		   they snap TOGETHER, which is still no seam. Same technique as
		   --sp-wash-a in SlotPortrait, and for the same reason. */
		--bb-act-fill: var(--surface-raised);
		background: var(--bb-act-fill);
		/* The card's dimmed-white ladder (inherited from .sp-card — these
		   buttons render inside it via the actions snippet), not --muted: the
		   beige glyphs sat oddly against the white-mix C/R values and icons
		   (Nate 2026-08-06). Rest 40% → hover 65%, like every unset value. */
		color: var(--sp-unset-ink);
		cursor: pointer;
		transition:
			color var(--t-snap),
			--bb-act-fill var(--t-snap);
	}
	/* The glyph size, weight and joins come from Mark.svelte's MARK_SIZE /
	   MARK_STROKE — the .bb-glyph rules that used to set them here are gone,
	   which is the point of a shared set. The button's grid still centers
	   them, and the size knob is site-wide now rather than local. */
	/* Disabled = the card's shared dim (the constellation chip's exact recipe),
	   so an empty slot's four stations fade as one family. */
	.bb-act:disabled {
		opacity: 0.35;
		cursor: default;
		pointer-events: none;
	}
	/* The tile's hidden half: it PAINTS on under the portrait to the disc's
	   centre and stops, but it is not part of the button's box, so it cannot
	   take a click the portrait should have had. The disc (z-index 1) covers it
	   from its own left edge, and because that edge sweeps left as the circle
	   widens, this extension's right end is never visible at any height. */
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
	/* ── BOTH tiles fill on hover; the HUE is what separates them ────────────
	   ⚓ NATE 2026-08-12 asked for ⇄ to fill like ✕ does, "one shade up of
	   slate". That completes a rule the palette round already settled for the
	   glass panes and it is worth stating in the same words: DENSITY separates
	   resting from engaged, HUE separates the two engaged states. The raised
	   register lights up whenever you are on it; only the destructive one goes
	   red.

	   ⚠ 7% white, not `--slate-600`: a component may not name a primitive (the
	   layer law, grep-enforced). 7% is where slate-700 meets slate-600 on the
	   ramp, i.e. it IS the one-rung step Nate asked for, expressed as the mix a
	   role is allowed to carry — the same move --sp-unset-ink and
	   --control-face-hover already make.
	   The glyph keeps brightening too: the ink was always the half you read. */
	.bb-act:hover:not(:disabled) {
		--bb-act-fill: color-mix(in srgb, white 7%, var(--surface-raised));
		color: var(--sp-unset-ink-hover);
	}
	/* ── ✕ hovers by FILLING, and that is the round's second sanctioned
	   exception (⚓ NATE 2026-08-12, from the mockup: "danger fill on hover
	   specifically"). The card's rule since 2026-07-30 is that hover brightens
	   content and never fills, and it holds everywhere else — but destructive is
	   the one action that should announce itself with a surface rather than a
	   shade, and the contrast against ⇄'s ink-only hover is what makes the two
	   buttons read as different KINDS of thing rather than a pair.

	   The alpha lives in the PAINT (an opaque mix, not element opacity) — the
	   ribbon is transform-placed at fractional coordinates and any
	   element-opacity subtree dances in real Safari. Mixed onto the raised rung
	   these buttons already wear, so the fill reads as the same object lighting
	   up rather than a different plate appearing. */
	.bb-act--remove:hover:not(:disabled) {
		--bb-act-fill: color-mix(in srgb, var(--ui-danger) 22%, var(--surface-raised));
		/* Danger mixes into WHITE, not --text — the beige base would pull the
		   red warm against the card's white-mix ladder. */
		color: color-mix(in srgb, var(--ui-danger) 45%, white);
	}
</style>
