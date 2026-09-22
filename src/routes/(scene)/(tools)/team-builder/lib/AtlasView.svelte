<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	/**
	 * The role Atlas front door — four Position×Function category cards in ONE
	 * ROW of portrait blocks (⚓ Nate 2026-08-11; it was a 2×2 of wide cards, and
	 * the CSS below holds the measurements that moved it). Each card is split:
	 * a glass IDENTITY half carrying the color Role+Function glyphs, the label
	 * and (since 2026-08-12) the per-element breakdown, over a parchment CONTENT
	 * half carrying the provides/owned readout and the monotone role watermark.
	 * ⚠ The breakdown is on the DARK half on purpose — element colour has no
	 * light rung; see the note at .rolecard-elements. Clicking a card
	 * drills into it (the drill + the Rotation-Planner "slots" view both render
	 * inline character tiles in +page.svelte, where the tile handlers live).
	 */
	import { positionIcon, functionIcon } from '$lib/utils/roleIcons';
	import type { RoleCard } from './atlas';
	import type { RoleCategory } from './roles';

	let {
		roleCards,
		onSelectCategory
	}: {
		roleCards: RoleCard[];
		onSelectCategory: (category: RoleCategory) => void;
	} = $props();

	const elIcon = (el: string) => elementIcon(el);

	/**
	 * ↻ 2026-08-12: the name is no longer RENDERED — the breakdown went back to a
	 * horizontal pip row on the glass half, where seven names will not fit — so
	 * this is now the icon's ALT TEXT. It has to keep working: with the label gone
	 * from the DOM, the alt is the only thing that says which element a count
	 * belongs to. `none` is the physical/elementless bucket (unreachable here, see
	 * the note at .rolecard-elements) and "None" would read as a missing value.
	 */
	const elLabel = (el: string) => (el === 'none' ? 'Physical' : el[0].toUpperCase() + el.slice(1));
</script>

<!-- ⚓ NATE 2026-08-11: the cards get a header of their own. The surface reads as
     two named blocks now — "This team covers" over the capability chips, "Explore
     by role" over the Atlas — which is the same banner-and-bare grammar the round
     established: a narrow thing that NAMES content sitting bare on the world.
     It lives here rather than in +page.svelte for the same reason CoveragePanel
     owns its own: the header belongs to the block, and this component is only
     rendered on the cards view, so it appears and leaves with them. -->
<h2 class="atlas-head">Explore by role</h2>

<div class="rolecards">
	{#each roleCards as card (card.category.key)}
		<!-- ↻ ⚓ NATE 2026-08-09: THESE ARE GLASS NOW, not parchment. They were
		     ctx-light on the reasoning that a card is the small opaque object
		     light is for — true as far as it went, but four of them at 210px
		     tall are not a small object, they are the Atlas's entire front door,
		     and Nate's read is that the parchment "is distracting me too much to
		     judge other things". Glass is what the round is for: furniture that
		     sits ON the world without becoming a second page.
		     The context is still CLAIMED rather than inherited (the tool frame
		     that used to supply one went in 2026-08-08) — it just claims a
		     different material. -->
		<button
			class="rolecard ctx-glass inset inset--plain"
			style:--role-bg="url({functionIcon(card.category.function, 'monotone')})"
			onclick={() => onSelectCategory(card.category)}
			aria-label="{card.category.label}: {card.providerCount} characters, {card.ownedCount} owned"
		>
			<!-- THE IDENTITY HALF — what this card IS, and (since 2026-08-12) what
			     it is MADE OF. Keeps the glass the card has worn since 2026-08-09
			     (it simply inherits it from the button); the element breakdown
			     moved up here because element colour may not run on parchment —
			     see the note at .rolecard-elements. -->
			<div class="rolecard-id">
				<!-- ⚓ NATE 2026-08-12: the glass half divides 2:1, role over pips. The
				     wrapper is what makes that expressible — two grid rows need two
				     children, and the glyphs and the label are one thing. -->
				<div class="rolecard-idmain">
					<div class="rolecard-glyphs">
						{#if card.category.position}
							<img
								class="rolecard-glyph"
								src={positionIcon(card.category.position, 'color')}
								alt=""
							/>
							<span class="rolecard-plus" aria-hidden="true">+</span>
						{/if}
						<img
							class="rolecard-glyph"
							src={functionIcon(card.category.function, 'color')}
							alt=""
						/>
					</div>
					<span class="rolecard-label">{card.category.label}</span>
				</div>

				<!-- The rule belongs to the breakdown, so it moved up with it: it is
				     what says "the count of this category decomposes from here",
				     and on the parchment half it was heading nothing. -->
				<div class="rolecard-elements">
					{#each card.byElement as pip (pip.element)}
						<span class="rolecard-el">
							{#if pip.element !== 'none'}
								<img
									class="rolecard-el-icon"
									src={elIcon(pip.element)}
									alt={elLabel(pip.element)}
								/>
							{/if}
							<span class="rolecard-el-count">{pip.count}</span>
						</span>
					{/each}
				</div>
			</div>

			<!-- THE CONTENT HALF — what this card HOLDS.
			     ⚓ NATE 2026-08-11: no custom vector after all — "with the new
			     layout, boxes are actually reading quite well, and that's the most
			     flexible. Let's plan on just using CSS boxes unless a better
			     concept really makes itself apparent." So this is a plain
			     parchment block, and the art reservation that used to squeeze the
			     pip row is gone with it.
			     ↻ 2026-08-12: it holds the two FIGURES and nothing else now —
			     stacked, with the watermark beside them rather than under them. -->
			<div class="rolecard-body ctx-light">
				<div class="rolecard-readout">
					<!-- ⚓ NATE 2026-08-11: "provide", not "provides". The subject is the
					     characters, not the category — every one of these counts is
					     plural and structurally always will be, so the -s was reading
					     as agreement with the number and never agreed with it. -->
					<span class="rolecard-fig">
						<b>{card.providerCount}</b><small>provide</small>
					</span>
					<span class="rolecard-fig rolecard-fig--owned">
						<b>{card.ownedCount}</b><small>owned</small>
					</span>
				</div>
			</div>
		</button>
	{/each}
</div>

<style>
	/* The block's name. Deliberately the SAME register as CoveragePanel's
	   "This team covers" — section heading (4xl), display face, centred, bright
	   ink — because they are peers: two named blocks on one bare surface. On the
	   scene a header carries no box to lend it presence, so it has to carry its
	   own, which is why the face is Bitter and the ink is --text rather than the
	   dim rung. */
	.atlas-head {
		margin: 0 0 0.75rem;
		text-align: center;
		font-family: var(--font-display);
		font-size: var(--fs-4xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: var(--text);
	}

	/* ══ THE ATLAS CARD IS A BLOCK (⚓ NATE 2026-08-11) ═══════════════════════
	   ⚓ "The cards are reading really wide, almost like fat banners."

	   MEASURED, because the fix follows from the cause: at 1600×1000 the card was
	   656 × 210 — 3.12:1, wider than the monitor it is drawn on — and 2.39:1 at
	   1280. Its WIDTH was given by the column while its HEIGHT was asserted by a
	   `min-height: 210px` that nothing needed, so the proportions changed with
	   the window and the card was never one object.

	   ⚠ AND THE 2×2 GRID USED 436px OF A 795px COLUMN. That 359px was not
	   breathing room, it was dead: the drill-down REPLACES these cards rather
	   than opening beneath them, so nothing ever used it. The height was already
	   paid for.

	   So the two knobs below do the work the min-height was failing to: a CAP
	   makes the "more space around them" literal (189px of scene either side at
	   1600), and because the cap holds at 1440 and 1280 too, THE CARD IS THE SAME
	   OBJECT AT EVERY WIDTH. The height then follows from the ratio instead of
	   from a floor.

	   ↻↻ ⚓ NATE 2026-08-11, THIRD PASS — FOUR ACROSS, AND PORTRAIT.

	   The 2×2 could not hold a block ratio, and the arithmetic says why rather
	   than the eye: two rows have to divide whatever height is left over, so the
	   card's ratio is 1020 ÷ (H − gap) and it DOUBLES as the window shortens.
	   One row divides nothing. Measured across the range that matters:

	     grid height H     2×2 @ 1040 cap      4×1 @ full width
	     564 (1600×1000)   510×272 = 1.88:1    311×564 = 0.55:1
	     464 (1600×900)    510×222 = 2.30:1    311×464 = 0.67:1
	     364 (1600×800)    510×172 = 2.97:1    311×364 = 0.85:1
	     284 (1600×720)    510×132 = 3.86:1    311×284 = 1.10:1

	   ⚠ THE 2×2 GOES BACK TO BEING A BANNER BELOW ~900px OF VIEWPORT; the single
	   row never leaves portrait. That is the whole argument — not that 0.55:1 is
	   prettier than 1.88:1, but that one of these degrades gracefully and the
	   other degrades into the exact thing this round set out to fix.
	   (0.55:1 is also very close to Genshin's own character-card proportion,
	   which is reassuring rather than decisive.)

	   ⛔ AND THE MEASURE CAP IS GONE HERE. ⚓ "If we go portrait and four in a
	   row, then I think they can use all the space available to them (not just
	   the chip area), just with a little more gap breathing room." So the grid
	   spans the column and --tb-measure now governs the capability run alone.
	   The two blocks no longer align, deliberately: a full-width row of four
	   reads as the surface's floor, and a centred capped run reads as a caption
	   above it. */
	.rolecards {
		/* ⚓ 20 → 28, the "little more gap breathing room". With the cards now
		   spanning the column there is no outer margin to stay smaller than, so
		   the constraint that held it at 20 is gone; what keeps four cards
		   reading as one row is that the gap stays well under the card width
		   (28 against 311 ≈ 1:11). */
		--atlas-gap: 28px;
		/* ⚓ NATE 2026-08-11: "the gap in-between them is enough right now, but
		   they need to breathe more from the walls." So the group insets from the
		   column rather than spanning it edge to edge. ⚠ IT MUST STAY CLEARLY
		   LARGER THAN --atlas-gap — that inequality is the whole effect: it is
		   what makes four cards read as one group standing off the walls rather
		   than as a row that happens to stop short. */
		--atlas-margin-x: 48px;
		/* Never crush below this; a shorter window scrolls instead (the zone
		   carries the scroll fade, so a clipped card reads as clipped).
		   ⚠ IT IS THE CONTENT'S FLOOR, NOT A ROUND NUMBER, and it has moved four
		   times now for the same reason each time — the breakdown's height. 335 at
		   the 4+3 cloud, 405 at the seven-row stack, 425 with the icon's line box
		   measured, and 340 now that the breakdown is ONE horizontal row again.

		   🎛️ 340 = glass 183 + parchment 151, rounded up:
		     glass      pad 38 + glyphs 42 + gap 10 + label 27 + rule block 22
		                + pip row 44
		     parchment  pad 37 + two figures 106 + gap 8
		   Move the glyph size, the figure size or the pip row and move this. */
		--atlas-card-min-h: 340px;
		/* ⚠ A CEILING IN PX, NOT A RATIO, and it has to be: the card's width is
		   now a fraction of the column, and a `max-height` percentage resolves
		   against HEIGHT, so there is no way to say "never taller than N× my own
		   width" in CSS here. Without it a very tall monitor draws four extremely
		   tall slivers.
		   ↻ ⚓ NATE 2026-08-11: 620 → 500, "tighten the cards up vertically a
		   little bit". At a 1000px window this is now the binding constraint
		   rather than the column, so the cards stop growing with the viewport and
		   the slack lands below the group instead of inside each card.
		   ↻ 2026-08-12: 500 → 380, following the floor down. The card shed six pip
		   rows and gained one stacked figure, so it needs ~85px less; leaving the
		   ceiling where it was would have spent all of that on interior air
		   instead of on the tighten Nate asked for — and this card has drawn the
		   "content isn't distributed very well" note twice, so the error worth
		   avoiding is the airy one.
		   🎛️ MEASURED at 1600×1000, and this IS the binding constraint at every
		   width down to the two-column breakpoint (the column is always taller):
		   glass content 176 + parchment 148 = 324, so 380 hands the glass half
		   ~56px of interior slack, which the two `margin-top: auto`s below split
		   ~28 above the glyphs / ~28 above the rule rather than pooling in one
		   hole. At 420 it was 96px and the identity group floated. Raising this is
		   the one knob for a roomier card; --atlas-card-min-h is the floor it
		   scrolls at, not the resting height. */
		--atlas-max-h: 380px;

		display: grid;
		grid-template-columns: repeat(4, 1fr);
		grid-template-rows: minmax(var(--atlas-card-min-h), 1fr);
		gap: var(--atlas-gap);
		width: 100%;
		padding-inline: var(--atlas-margin-x);
		height: 100%;
		max-height: var(--atlas-max-h);
		min-height: 0;
		flex: 1;
	}
	/* ⚠ TWO STEPS, AND THE FIRST ONE IS ABOUT THE LABEL, NOT THE PICTURE. Below
	   this the column narrows enough that a quarter of it minus padding drops
	   under the longest label and it wraps on the one card least able to spare
	   the room. Two columns of portrait cards is the graceful step down.
	   ⚠ MEASURED, and the first guess was wrong TWICE over. "SURVIVABILITY" sets
	   147px at --fs-2xl, not the ~169 estimated from character count (the wider
	   "Off-Field DPS" has more letters but less ink) — and the wall margin added
	   this round takes 96px out of the column, so the cards are narrower at every
	   viewport than when the breakpoint was first placed. Those errors pulled in
	   opposite directions and nearly cancelled: 1180 left exactly 3px of slack,
	   which is not a margin, it is a coincidence. 1260 leaves ~22px. */
	@media (max-width: 1260px) {
		.rolecards {
			grid-template-columns: repeat(2, 1fr);
			grid-template-rows: repeat(2, minmax(var(--atlas-card-min-h), 1fr));
		}
	}
	/* `compact` (40rem = 640px, $lib/breakpoints.ts) — was a stray 620px, the
	   one the responsive survey named for absorption. Raising it 20px only
	   widens the one-column band, which is the safe direction: two role cards
	   at 621–640 were the narrowest two-column form on the site. ⚠️ Custom
	   properties do not work in media queries; the literal cites the table. */
	@media (max-width: 40rem) {
		.rolecards {
			grid-template-columns: 1fr;
			grid-template-rows: repeat(4, minmax(var(--atlas-card-min-h), 1fr));
		}
	}

	/* THE CARD IS NOW TWO HALVES AND NO GROUND OF ITS OWN. It keeps `.ctx-glass`
	   so the glass tokens (--surface, --surface-hover, --glass-ring) resolve for
	   the identity half and for its own hover ring; the halves do the painting.
	   ⚠ overflow: hidden is load-bearing here in a way it was not before — the
	   two halves must be clipped to the radius, and there is no ground behind the
	   seam that could hide a mismatch. */
	/* ↻ 2026-08-12: THE SEAM IS NO LONGER PINNED. It was `--atlas-id-h 1fr` — a
	   fixed identity half over a parchment half that absorbed every spare pixel —
	   and the two halves have swapped jobs: the glass half now carries three
	   groups (identity, rule, breakdown) and the parchment half carries two
	   figures and nothing else, so the parchment half is the one whose height is
	   genuinely given by its content. `1fr auto` says that. The seam then drifts
	   with the card's height, which is invisible: all four cards share a grid row,
	   so their seams are always level with each other. */
	.rolecard {
		position: relative;
		overflow: hidden;
		display: grid;
		grid-template-rows: 1fr auto;
		min-height: 0;
		padding: 0;
		/* Edge border retired 2026-08-07 — the raised ground is the separation.
		   ↻ ⚓ NATE 2026-08-11: and an INSET took its place (.inset--plain, 2px).
		   It is the first inset in the system to CROSS A SEAM, running over the
		   glass half and the parchment half in one stroke, so it cannot take
		   either context's zoned gold — see --inset-line-mid in app.css for the
		   measurement that picked the rung. */
		border: none;
		border-radius: var(--r-sm);
		--inset-stroke: 2px;
		--inset-line: var(--inset-line-mid);
		background: none;
		text-align: left;
		cursor: pointer;
		color: inherit;
		font: inherit;
		/* ⚠ --t-snap, NOT --t-move, even though this animates a transform. The
		   band is not "is it a transform". This is a 2px HOVER LIFT — an
		   affordance that has to keep up with the pointer, which makes the card
		   a CONTROL and puts it on the fastest band. 240ms here reads as the
		   card lagging your mouse. --t-move is for something that travels
		   because a STATE changed and you are meant to follow it there (the
		   toggle thumb, app.css). Measured 2026-08-12, when this was a candidate
		   for the move band and the 2px is what ruled it out. Same reasoning
		   keeps .rp-explore-arrow's 2px nudge on --t-snap. */
		transition: transform var(--t-snap);
	}
	/* ↻ ⚓ NATE 2026-08-10: the glass pane-hover idiom — A RING AND A DENSITY,
	   no wash. Same treatment as the band plates (see app.css), because this is
	   the same situation: a pane of glass whose extent the sky behind it will not
	   reliably declare. The accent wash it replaces was the last place a hovered
	   slate surface picked up a foreign hue.
	   ↻ 2026-08-11: the DENSITY now lands on the glass half alone — parchment has
	   no hover rung and .ctx-light has no raised one, so there is nothing for it
	   to move to.
	   ⛔ AND THE RING IS GONE (⚓ NATE, same day: "I'd like to try the hover
	   behavior without an edge line"). The ring's whole justification was that
	   glass has no self-evident extent — true when the card was one translucent
	   pane, and no longer true now that it carries an opaque parchment half and a
	   2px gold inset. The card's edge is declared three times over; a fourth line
	   appearing on hover was saying something already said. What is left is a
	   DENSITY and a LIFT, which is the state change rather than the outline. */
	.rolecard:hover {
		transform: translateY(-2px);
	}

	/* ── The identity half ────────────────────────────────────────────────────
	   ↻ ⚓ NATE 2026-08-12: "can we make the section for role and the section for
	   pips a clean 2:1 ratio?" So the half is a two-row GRID rather than a flex
	   column, and the ratio is DECLARED instead of falling out of two auto
	   margins fighting over the slack. The rule — which is the breakdown's own
	   border-top — lands exactly on the 2/3 line at every card height.
	   ⚠ The ratio divides the CONTENT box, not the half: the padding is the
	   card's own inset and belongs to neither section. */
	.rolecard-id {
		position: relative;
		overflow: hidden;
		display: grid;
		grid-template-rows: 2fr 1fr;
		padding: 1.2rem 1.2rem 1.1rem;
		/* ⚠ --surface, not --surface-raised. On glass the two resolve to the same
		   stop (there is no "raised" through a translucent material — depth here
		   comes from alpha, and the well is the only other rung), and --surface is
		   the honest name for the ground a card paints. */
		background: var(--surface);
		transition: background var(--t-snap);
	}
	.rolecard:hover .rolecard-id {
		background: var(--surface-hover);
	}
	.rolecard-id > * {
		position: relative;
		z-index: 1;
	}

	/* The 2fr row's occupant. Centred in it, so the glyphs and the label read as
	   one block floating in the role section rather than as two things stuck to
	   its top edge. */
	.rolecard-idmain {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.6rem;
		min-height: 0;
	}
	.rolecard-glyphs {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
	.rolecard-glyph {
		width: 42px;
		height: 42px;
		object-fit: contain;
	}
	.rolecard-plus {
		color: var(--muted);
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
	}

	.rolecard-label {
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--text);
	}
	/* ── The content half ───────────────────────────────────────────────────── */
	.rolecard-body {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		padding: 1.1rem 1.2rem 1.2rem;
		/* parchment-100 — the CARD rung, not --surface-broad. The size axis on
		   paper asks "is this a large panel or an object", and four category
		   cards are objects however big they get. */
		background: var(--surface);
	}

	/* ── The role backdrop ────────────────────────────────────────────────────
	   ↻ ⚓ NATE 2026-08-11: IT CROSSED THE SEAM, and it is his artwork that moved
	   it. The note this replaces said the monotone assets were near-black, drawn
	   to read as a deeper pool IN dark slate, and that they inverted the moment
	   they touched parchment — true of the OLD files, and the reason the art was
	   clipped to the identity half. He has since redrawn them in the bottom of
	   the gold ramp (the files carry gold-600 / gold-500 / gold-400 literally),
	   which is exactly a set of values that reads as a watermark ON paper. So the
	   art belongs on the parchment half now, and the identity half carries none.

	   ↻↻ AND THEN GOLD DIDN'T WORK EITHER — ⚓ Nate, hours later: "being in gold
	   didn't work, parchment is the play." The files now carry
	   parchment-100 / parchment-200 / parchment-300, which is to say THE PAPER'S
	   OWN RAMP: the watermark is made of the ground it sits on, one and two rungs
	   down. It cannot clash with the surface because it IS the surface.

	   ⛔ NO CSS OPACITY, AND THAT IS THE POINT. ⚓ "I baked the transparency into
	   the SVG this time, so we don't need to do the CSS opacity shift and risk it
	   on WebKit." Exactly right, and worth stating as a general move: alpha
	   inside an SVG that is used as a `background-image` is rasterized INTO THE
	   IMAGE. It never becomes a CSS transparency layer on our element, so the
	   sub-pixel law's hazard — WebKit rounding an element-opacity subtree to
	   whole device pixels — cannot arise. The rule "alpha belongs in the paint"
	   has an asset-side answer as well as a CSS-side one, and this is it.
	   ⚠ So do not reintroduce an `opacity` here to tune it. The knob is the file. */
	/* 🎛️ ⚓ NATE 2026-08-11: "size up the wash marks a little bit." 62% → 76%.
	   ⚠ ONLY ONE OF THE TWO IS A KNOB AT A TIME. The art is square and
	   `background-size: contain` takes the SMALLER of the two, so raising the
	   other one alone is a silent no-op — exactly the kind that reads as "the
	   file must be wrong".
	   ↻ 2026-08-12: ⚓ Nate — "the Provide and Owned stacked, with the wash mark
	   on the right". So it stops being a corner bleed and becomes the right-hand
	   HALF of the readout: full height of the parchment block, centred in it,
	   running a little off the right edge.
	   ↻↻ ⚓ NATE 2026-08-12: "even larger and even more cropped — maybe cropped
	   more off the bottom and a little off the top." So it stops being a
	   `contain` fit inside a box and becomes an OVERSIZE mark positioned from the
	   card's own edges, which is the only way to say "crop 20 off the top and 76
	   off the bottom" and have it stay true.

	   ⚠ THE `contain`-IN-A-BOX FORM COULD NOT EXPRESS THIS, and the reason is
	   worth keeping: `contain` takes the SMALLER of the box's two dimensions, so
	   which one binds flips with the card's width — the box is 52% of a width
	   that runs 287px at four-across and ~528 at two-across. Any crop tuned
	   against one layout was wrong in the other. Sizing off the parchment half's
	   HEIGHT instead is stable, because that height is content-given (two
	   figures + padding = 148px) and does not move with the viewport at all.

	   🎛️ THE THREE KNOBS, and they are independent now:
	     --wash-h      the mark's size, as a multiple of the half's height.
	                   155% ≈ 229px in a 148px block.
	     --wash-up     how much comes off the TOP. Everything else
	                   (229 − 148 − 20 = 61px) crops off the bottom, so raising
	                   --wash-h alone deepens the bottom crop and leaves the top
	                   where it is — which is the axis Nate asked for.
	     --wash-out-x  how far it runs past the right edge.
	   ⚠ The mark's LEFT edge is 287 + 16 − 229 = 74px at four-across, and the
	   figures end at 71 — so --wash-h is the knob with a limit: much past 155%
	   and the art starts under the readout. Not fatal (⚓ "they are allowed to sit
	   on top of the art I provide") but it is where the next one will be felt. */
	.rolecard-body::before {
		content: '';
		position: absolute;
		inset: 0;
		--wash-h: 155%;
		--wash-up: -20px;
		--wash-out-x: -16px;
		background-image: var(--role-bg);
		background-repeat: no-repeat;
		background-size: auto var(--wash-h);
		background-position: right var(--wash-out-x) top var(--wash-up);
		pointer-events: none;
	}
	/* The readout and the pips ride ABOVE the watermark. ⚓ Nate, on the pips:
	   "they are allowed to sit on top of the art I provide." */
	.rolecard-body > * {
		position: relative;
		z-index: 1;
	}

	/* THE NUMBERS BECOME A READOUT (2026-08-11). They were one --fs-md line —
	   "48 provides · 12 owned" — which stated the card's whole point in its
	   quietest voice, because on a 3:1 banner there was nowhere to put anything
	   bigger. A block card has the room, and OWNED earns the promotion: it is the
	   only PERSONAL fact on the surface, the one number that is about the reader
	   rather than about the corpus. */
	/* ↻ 2026-08-12: STACKED, not a row. ⚓ Nate's sketch for this round puts the
	   two figures one above the other with the watermark beside them.
	   ⚠ The 2026-08-11 note this replaces is worth keeping visible, because its
	   reasoning EXPIRED rather than being wrong: "space-between, not a left
	   huddle — the breakdown below is a run of full-width rows anchored to both
	   edges, and a readout bunched at the left would be the one thing on the
	   parchment half not on that grid." True while the breakdown lived down here;
	   the breakdown is on the glass half now, so there is no full-width grid left
	   for the figures to align with, and the half's right-hand column belongs to
	   the mark. A left column of figures is the honest reading of what's left.
	   `width: max-content` so the column is only as wide as its widest figure —
	   without it the flex item spans the half and the (invisible) box overlaps
	   the mark, which costs nothing visually but makes the next layout edit
	   here misleading. */
	.rolecard-readout {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: max-content;
	}
	.rolecard-fig {
		display: flex;
		flex-direction: column;
		line-height: var(--lh-tight);
	}
	.rolecard-fig b {
		font-size: var(--fs-5xl);
		font-weight: var(--fw-bold);
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}
	.rolecard-fig small {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
	/* ⚠ On parchment the accent is gold-700, which is what .ctx-light resolves
	   --accent to — the zoned rung, not the dark context's gold-400 (1.48:1 on
	   this paper). Naming the role is what makes that automatic. */
	.rolecard-fig--owned b {
		color: var(--accent);
	}

	/* ══ THE PIPS CROSSED THE SEAM (⚓ NATE 2026-08-12) ═══════════════════════
	   THE FIX WAS A MOVE, NOT A COLOUR, and this is the move. Every
	   --el-*-main is under 3:1 on parchment-100 (cryo 1.14:1, geo 1.36, anemo
	   1.38, dendro 1.42, electro 2.12, pyro 2.61, hydro 2.92); on the glass half
	   the same palette runs 2.49–5.08:1 untouched. The --el-* round (2026-08-11)
	   established the law behind that — there IS no light-context element
	   colour, because Genshin has no light UI and every one of their five icon
	   sets measures under 3:1 on paper, gilded (the one that sounds like
	   parchment) nearly worst at 1.15–1.19. See the --el-* block in app.css.
	   The ink fallback (--ink-900 monochrome, 8.00:1, silhouette carries the
	   element) is the FLOOR for marks that genuinely cannot move — not this.

	   ⚠ WHAT HELD THE MOVE UP FOR A ROUND, and how it was answered. The pips ARE
	   the providers figure decomposed (9+7+8+6+5+7+6 = 48), so ⚓ Nate's "only go
	   for the optimal layout logically" said a number and its own breakdown must
	   not end up on opposite sides of the card's one structural seam. The answer
	   is that the SEAM MOVED TOO: the breakdown did not cross alone, it took the
	   RULE with it, and the card is now read top-down as
	     what this is (glyphs + label) → what it is made of (rule + pips) → how
	     many, and how many are yours (the parchment figures).
	   The figure is the SUM, and a sum sitting under its own terms is not a
	   split fact — it is the ordinary way a breakdown is written.

	   ↻ AND THE COLUMN WENT BACK TO A ROW. `repeat(7, 1fr)` down the parchment
	   half was ⚓ Nate's own call ("plenty of room on my screen") and it was right
	   for a half whose spare dimension was height. The glass half's spare
	   dimension is WIDTH — the label sets ~147px in a ~272px half — so the same
	   seven pips lay across it in one band: icons on a line, counts beneath them,
	   which is the shape Nate sketched.
	   ⚠ THE NAMES DID NOT COME WITH THEM, and they were load-bearing in the old
	   layout (icon-left + number-right across a full row leaves a hole in the
	   middle unless something fills it). A 7-across band has no such hole and no
	   room for them; the element is carried by the glyph, which is what a glyph
	   is for. ⚠ They live on as the img ALT — with no label in the DOM that is
	   the only thing naming a count for a screen reader, so keep it.
	   🎛️ It buys back ~116px of card height, which is most of what took
	   --atlas-card-min-h from 425 to 340. */
	.rolecard-elements {
		/* The 1fr row. `align-content: center` is what spends the difference
		   between the row (≈65px) and the band (≈54): the pips sit in the middle
		   of their section instead of hanging off the rule. */
		align-content: center;
		min-height: 0;
		padding-top: 0.55rem;
		border-top: 1px solid var(--border);
		display: grid;
		/* Seven equal columns, so the counts sit on a fixed pitch whatever the
		   digits do. ⚠ Only safe because the set is CLOSED: `byElement` filters
		   ATLAS_ELEMENT_ORDER, the seven real elements, so there is never an
		   eighth column and the 'none' → "Physical" bucket (which has no icon
		   either) is unreachable. If that filter ever widens, this is the first
		   thing that breaks. */
		grid-template-columns: repeat(7, 1fr);
	}
	/* A COLUMN PER ELEMENT: glyph over count, both centred on the same axis, so
	   the band reads as one object rather than as seven small pairs. */
	.rolecard-el {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		min-width: 0;
		/* The pips' only guaranteed air. The columns are 1fr, so at the narrowest
		   four-across layout they are barely wider than the glyph itself — this is
		   what stops seven of them touching. */
		padding-inline: 2px;
	}
	.rolecard-el-icon {
		/* 22 — sized to match the roster card's portrait pip, which is the same
		   mark doing the same job one surface away.
		   ⚠ IT TAPERS RATHER THAN OVERFLOWING, and that is not defensive coding,
		   it is the measured case. MEASURED at three widths: a card is 287px at
		   1600 (columns 36px), 249 at 1440 (30), 215 at 1300 (25) — the grid
		   narrows all the way down to the 1260px two-column breakpoint, so a fixed
		   22 would have had 1.5px of air either side at the bottom of that range.
		   min() with the padding above keeps the taper graceful instead. */
		width: min(22px, 100%);
		height: auto;
		aspect-ratio: 1;
		object-fit: contain;
	}
	/* The number the pip exists to state. Tabular so a 10 and a 9 sit on the same
	   pitch; --text because this is now on GLASS, where the dark context's ink
	   ladder applies. */
	.rolecard-el-count {
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
		line-height: var(--lh-tight);
		color: var(--text);
	}
</style>
