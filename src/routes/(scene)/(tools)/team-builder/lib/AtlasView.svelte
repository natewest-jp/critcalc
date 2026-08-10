<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	/**
	 * The role Atlas front door — four Position×Function category cards in ONE
	 * ROW of portrait blocks (⚓ Nate 2026-08-11; it was a 2×2 of wide cards, and
	 * the CSS below holds the measurements that moved it). Each card is split:
	 * a glass IDENTITY half carrying the color Role+Function glyphs, the label
	 * and the monotone role backdrop, over a parchment CONTENT half carrying the
	 * provides/owned readout and the per-element breakdown. Clicking a card
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
	 * The breakdown rows NAME their element now (⚓ Nate 2026-08-11 — the cards
	 * "aren't distributing content very well"). An icon and a number alone left a
	 * ~200px hole in the middle of every full-width row; the name is what makes
	 * the row a row rather than two things at opposite ends of one.
	 * `none` is the physical/elementless bucket — it has no icon either, and
	 * "None" would read as a missing value rather than as a category.
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
			<!-- THE IDENTITY HALF — what this card IS. Keeps the glass the card has
			     worn since 2026-08-09 (it simply inherits it from the button) and
			     the monotone role backdrop, which is CLIPPED here by construction:
			     that art is near-black, drawn to read as a deeper pool in dark
			     slate, and it inverts the moment it crosses the seam. -->
			<div class="rolecard-id">
				<div class="rolecard-glyphs">
					{#if card.category.position}
						<img
							class="rolecard-glyph"
							src={positionIcon(card.category.position, 'color')}
							alt=""
						/>
						<span class="rolecard-plus" aria-hidden="true">+</span>
					{/if}
					<img class="rolecard-glyph" src={functionIcon(card.category.function, 'color')} alt="" />
				</div>
				<span class="rolecard-label">{card.category.label}</span>
			</div>

			<!-- THE CONTENT HALF — what this card HOLDS.
			     ⚓ NATE 2026-08-11: no custom vector after all — "with the new
			     layout, boxes are actually reading quite well, and that's the most
			     flexible. Let's plan on just using CSS boxes unless a better
			     concept really makes itself apparent." So this is a plain
			     parchment block, and the art reservation that used to squeeze the
			     pip row is gone with it. -->
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
				<div class="rolecard-elements">
					{#each card.byElement as pip (pip.element)}
						<span class="rolecard-el">
							{#if pip.element !== 'none'}
								<img class="rolecard-el-icon" src={elIcon(pip.element)} alt="" />
							{/if}
							<span class="rolecard-el-name">{elLabel(pip.element)}</span>
							<span class="rolecard-el-count">{pip.count}</span>
						</span>
					{/each}
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
		/* The identity half's height. Sized by its content (42px glyphs + the
		   label + padding ≈ 123), not by a fraction, so the seam does not drift
		   when the card's height moves. */
		--atlas-id-h: 145px;
		/* Never crush below this; a shorter window scrolls instead (the zone
		   carries the scroll fade, so a clipped card reads as clipped).
		   ⚠ IT IS THE CONTENT'S FLOOR, NOT A ROUND NUMBER, and it has moved three
		   times for the same reason each time — the breakdown's height. 335 at the
		   4+3 cloud, 405 at the seven-row stack, and 425 now.
		   ⚠ THE LAST MOVE IS THE SUBTLE ONE: the rows are `1fr` and LOOK
		   infinitely compressible, but a grid track cannot go below its
		   min-content, which here is the 22px element icon in its line box — 24px,
		   measured. Seven of those is 168 whatever the card does, so at 405 the
		   seventh row was pushing 18px out of its own block and into the body's
		   bottom padding. 425 = --atlas-id-h + padding 37 + readout 52 + rule 22 +
		   rows 168. Move the icon, the readout or the row count and move this. */
		--atlas-card-min-h: 425px;
		/* ⚠ A CEILING IN PX, NOT A RATIO, and it has to be: the card's width is
		   now a fraction of the column, and a `max-height` percentage resolves
		   against HEIGHT, so there is no way to say "never taller than N× my own
		   width" in CSS here. Without it a very tall monitor draws four extremely
		   tall slivers.
		   ↻ ⚓ NATE 2026-08-11: 620 → 500, "tighten the cards up vertically a
		   little bit". At a 1000px window this is now the binding constraint
		   rather than the column, so the cards stop growing with the viewport and
		   the slack lands below the group instead of inside each card. */
		--atlas-max-h: 500px;

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
	@media (max-width: 620px) {
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
	.rolecard {
		position: relative;
		overflow: hidden;
		display: grid;
		grid-template-rows: var(--atlas-id-h) 1fr;
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
		transition: transform 150ms ease;
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

	/* ── The identity half ──────────────────────────────────────────────────── */
	.rolecard-id {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.6rem;
		padding: 0 1.2rem;
		/* ⚠ --surface, not --surface-raised. On glass the two resolve to the same
		   stop (there is no "raised" through a translucent material — depth here
		   comes from alpha, and the well is the only other rung), and --surface is
		   the honest name for the ground a card paints. */
		background: var(--surface);
		transition: background 150ms ease;
	}
	.rolecard:hover .rolecard-id {
		background: var(--surface-hover);
	}
	.rolecard-id > * {
		position: relative;
		z-index: 1;
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
	   ⚠ ONLY THE WIDTH IS A KNOB. The art is square and `background-size:
	   contain` takes the SMALLER of the two, so height has never been the binding
	   dimension here (62% of the body's width was ~178px against 88% of its
	   height at ~312) — raising `height` alone would have done nothing at all,
	   which is exactly the kind of no-op that reads as "the file must be wrong".
	   Height stays generous purely so it never becomes the constraint on a short
	   card; the bleed offsets grew with the mark so it still runs off the corner
	   rather than sitting inside it. */
	.rolecard-body::before {
		content: '';
		position: absolute;
		right: -8%;
		bottom: -12%;
		width: 76%;
		height: 92%;
		background-image: var(--role-bg);
		background-repeat: no-repeat;
		background-position: bottom right;
		background-size: contain;
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
	/* ⚓ NATE 2026-08-11: space-between, not a left huddle. The breakdown below is
	   a run of full-width rows anchored to both edges; a readout bunched at the
	   left would be the one thing on the parchment half not on that grid. Now
	   every line in this half starts at the same left edge and ends at the same
	   right one. */
	.rolecard-readout {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
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

	/* THE PIPS STAY WITH THE READOUT, and the reason is arithmetic rather than
	   aesthetic: they ARE the providers figure decomposed — 9+7+8+6+5+7+6 = 48.
	   Putting a number and its own breakdown on opposite sides of the card's one
	   structural seam would split a single fact in half.
	   ⚠ THEY WILL READ POORLY UNTIL THE --el-* ROUND. Every --el-*-main is under
	   3:1 on parchment-100 (cryo 1.14:1, geo 1.36, anemo 1.38, dendro 1.42,
	   electro 2.12, pyro 2.61, hydro 2.92) against 3.36–8.59:1 on slate. ⚓ NATE
	   2026-08-11 — that round is next and will define light-context element
	   colors and icons, so this is a scheduled fix and NOT a reason to move them:
	   "only go for the optimal layout logically."
	   ↻ ⚓ NATE 2026-08-11: THE ART RESERVATION IS GONE. It capped this row at
	   `100% - --atlas-art-w` to keep a corner clear, and the cost was a row that
	   wrapped to two lines with the space to sit on one — ⚓ "they're wrapping to
	   a second row, even if there's plenty of space available to them; they are
	   allowed to sit on top of the art I provide." Correct on both counts: seven
	   pips set ~300px against ~460 of content, and an element count laid over a
	   faint backdrop is exactly the layering the card already does on its dark
	   half.

	   ↻ ⚓ NATE 2026-08-11: "either display them stacked vertically if there's
	   room, or in two rows as a kind of pip cloud." It shipped as the aligned
	   cloud (4 + 3 via `repeat(4, auto)`) and he has since called the stack:
	   ⚓ "I'd like to go ahead and try the repeat(7, auto) — there's plenty of
	   room on my screen." So ONE COLUMN, seven rows, each a bare icon + count.

	   ⚠ THE STACK COSTS ~72px OF CARD HEIGHT (≈160 against the block's ≈88), and
	   that number is what sets --atlas-card-min-h below and therefore the viewport
	   at which the Atlas starts scrolling. It is the more elegant answer in a
	   portrait card — a column reads as a breakdown where a 4+3 block reads as
	   chips — and the whole reason the card went portrait is that height is the
	   plentiful dimension here. Spending it on the breakdown is the point.
	   🎛️ `repeat(4, auto)` restores the compact block if a short window makes the
	   scrolling annoying; nothing else has to change with it except the floor.

	   ↻↻ ⚓ NATE 2026-08-11 — THE DISTRIBUTION FIX. "The content just isn't
	   distributed very well." It was two small clusters flung to opposite ends of
	   the parchment half with ~30% of the card's height dead between them, and
	   `margin-top: auto` was doing it: the readout pinned to the top, the pips
	   pushed to the bottom, nothing responsible for the middle.
	   THE BLOCK NOW OWNS THE REMAINING HEIGHT (`flex: 1`) and divides it into
	   seven equal rows, so the breakdown scales with the card instead of sinking
	   to the floor of it. The rule is what the top of a filled block needs and a
	   floated one never had: something that says the breakdown begins here. */
	.rolecard-elements {
		display: grid;
		grid-template-rows: repeat(7, 1fr);
		flex: 1;
		min-height: 0;
		margin-top: 0.9rem;
		padding-top: 0.4rem;
		border-top: 1px solid var(--border);
	}
	/* A ROW, NOT A CHIP. It was `inline-flex` — icon and count hugging each other
	   in a ~50px sliver down the left edge of a 430px card, which is what made
	   the breakdown read as an afterthought rather than as the card's content.
	   Now each row spans the half: element left, count RIGHT, on the same two
	   edges the readout above uses. ⚓ Nate's cards are the tool's front door and
	   they have to look like it — using the width is most of that.
	   ⚠ THE NAME IS LOAD-BEARING, not decoration. Icon-left + number-right across
	   a full row leaves a large hole in the middle unless something occupies it;
	   the name fills it, and turns a cryptic pip into a legible line. */
	.rolecard-el {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
	}
	.rolecard-el-icon {
		flex: none;
		/* ↻ 18 → 22. The whole parchment half was sized for the old wide card and
		   never grew with it — every rung in here was the smallest one we own
		   inside the largest object on the surface. */
		width: 22px;
		height: 22px;
		object-fit: contain;
	}
	/* ⚠ CAPPED, NOT FREE-GROWING — ⚓ NATE 2026-08-11: "the numbers that go with
	   each element row are spaced a bit far apart, so the eye has to wander."
	   Correct, and the cause was `flex: 1` with nothing to stop it: the name ate
	   every spare pixel, which shoved the count onto the card's right edge and
	   left ~150px of nothing between an element and its own number. Seven rows of
	   that is seven separate journeys.
	   Capping the name puts the count at a FIXED short distance from the icon on
	   every row, so the counts still form a clean vertical column (the thing
	   right-alignment was actually buying) while sitting close enough to read as
	   part of the row. The space that used to be the gap is now trailing space at
	   the right, which is where the watermark lives — so the card fills the same
	   width, just with the art doing it instead of a void.
	   ↻ ⚓ NATE 2026-08-11: 6.6em → 5em, "almost flush with the longest word
	   electro". MEASURED: at --fs-md uppercase with --ls-wide the seven labels
	   run Geo 26.5px → ELECTRO 56.8px, so 5em (60px) clears the longest by 3.2px
	   and every count sits as close to its name as the widest row allows.
	   ⚠ FLUSH IS ONLY SAFE BECAUSE THE SET IS CLOSED. `byElement` is built by
	   filtering ATLAS_ELEMENT_ORDER — the seven real elements — so 'none'
	   (→ "Physical", ~64px, the one label that would ellipsize here) is
	   unreachable, and so is the icon guard in the markup above. If that filter
	   ever widens, this width is the thing that breaks first. */
	.rolecard-el-name {
		flex: 1;
		max-width: 5em;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
	/* The figure takes the anchoring ink and a real size — it is the number the
	   row exists to state, and at --fs-sm it was quieter than the label beside
	   it. Tabular + a min-width so a 10 lines up with a 9 rather than nudging the
	   column. */
	.rolecard-el-count {
		flex: none;
		min-width: 1.4em;
		text-align: right;
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}
</style>
