<script lang="ts" module>
	/** A pre-formatted capability chip. The consumer supplies these ALREADY
	 *  ORDERED (the card only slices to `maxTags` + renders the `+overflow`
	 *  count) — the card stays decoupled from the Team Builder's facet system. */
	export type TagChip = { label: string; active?: boolean; conditional?: boolean; title?: string };
</script>

<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import Mark from './Mark.svelte';
	import type { Snippet } from 'svelte';
	import type { CharacterIndexEntry } from '$lib/types/character';
	import { getAvatar, hasAvatar, type TravelerVariant } from '$lib/utils/getAvatar';
	import { elementPalette } from '$lib/utils/elementColors';

	// ---------------------------------------------------------------------------
	// The one square-portrait character tile, shared by the Team Builder roster
	// and the Rotation Planner's picker. Purely presentational + callback-driven
	// (never touches a store — the host wires meaning). LAYOUT adapts to the width
	// it's handed via a CSS container band (base, and roomy at ≥150px — the
	// compact band was deleted 2026-08-11 as unreachable); CONTENT sections are
	// prop-gated. See `SlotPortrait` for the sibling (circular loadout) card —
	// deliberately separate.
	// ---------------------------------------------------------------------------

	let {
		// identity / avatar
		entry,
		preferNewfit = false,
		traveler = 'aether',
		// interaction
		onActivate,
		intent = 'open',
		pressed,
		disabled = false,
		ariaLabel,
		// portrait corners
		con,
		slotNumber,
		wishlist = false,
		showUncuratedMark = false,
		// capability tags (consumer supplies already-ordered chips)
		tags = [],
		maxTags = 4,
		// visual state
		accent = false,
		dimmed = false,
		faded = false,
		// hover action bar (the card owns the overlay shell; consumer fills buttons)
		actions
	}: {
		entry: CharacterIndexEntry;
		preferNewfit?: boolean;
		traveler?: TravelerVariant;
		onActivate: (id: string) => void;
		/** Cursor + default aria phrasing. `open` = plain action (details),
		 *  `select` = toggle (sets aria-pressed), `edit` = ownership toggle (copy cursor). */
		intent?: 'open' | 'select' | 'edit';
		/** Toggle state → aria-pressed. Leave undefined for plain (non-toggle) actions. */
		pressed?: boolean;
		/** Team-full etc. — a real `disabled` button (unfocusable + dimmed). */
		disabled?: boolean;
		ariaLabel?: string;
		/** Constellation pip (top-right). undefined hides it; the consumer owns the
		 *  C0-vs-hide policy (TB shows C0, the planner hides until owned). */
		con?: number;
		/** Slot-number badge (bottom-left) — the planner picker's chosen-slot marker. */
		slotNumber?: number;
		/** Wishlist star (bottom-left) — TB roster. Never co-occurs with slotNumber. */
		wishlist?: boolean;
		/** Frame-timing-not-curated ∅ (right of the name row), when true && !entry.curated. */
		showUncuratedMark?: boolean;
		tags?: TagChip[];
		maxTags?: number;
		/** Accent border (TB "compared"). */
		accent?: boolean;
		/** Uncurated-bucket dim (no hover lift). */
		dimmed?: boolean;
		/** Not-owned / unpicked dim (lifts on hover, except in edit mode). */
		faded?: boolean;
		/** Hover-bar contents (the entry is handed back for context). */
		actions?: Snippet<[CharacterIndexEntry]>;
	} = $props();

	const color = $derived(elementPalette(entry.element).main);

	/** Both halves of the name row consult this — the mark on the right, and the
	 *  spacer on the left that keeps the name centred against it. */
	const uncurated = $derived(showUncuratedMark && !entry.curated);

	const shown = $derived(tags.slice(0, maxTags));
	const overflow = $derived(tags.length - shown.length);

	// Known-missing assets render initials outright, gated by the build-time
	// avatar manifest (hasAvatar). No runtime onerror fallback anymore: the card
	// renders NO <img> elements at all — Safari 26.x has a severe engine
	// regression (~2ms per dynamically-created img-with-src, fixed upstream in
	// STP 245) that turned each 122-card grid mount into a ~1.3s main-thread
	// block. background-image divs take the CSS resource path and dodge it
	// (measured 222ms → 2ms for the same 122 portraits in Safari 26.5.2).
	const fallback = $derived(!hasAvatar(entry.id));

	const defaultLabel = $derived(
		intent === 'edit'
			? `Toggle owned for ${entry.displayName}`
			: intent === 'select'
				? `${entry.displayName}${slotNumber !== undefined ? `, slot ${slotNumber}` : ''}`
				: `${entry.displayName}, open details`
	);
</script>

<div
	class="cc ctx-light"
	class:cc--accent={accent}
	class:cc--dimmed={dimmed}
	class:cc--faded={faded}
	class:cc--disabled={disabled}
	class:cc--edit={intent === 'edit'}
	style:--el-color={color}
>
	<button
		class="cc-main"
		onclick={() => onActivate(entry.id)}
		{disabled}
		aria-pressed={pressed}
		aria-label={ariaLabel ?? defaultLabel}
	>
		<!-- ctx-dark is CLAIMED, and legitimately: this element PAINTS its own
		     ground (the gradient below), which is the one thing the context law
		     asks of anything declaring a palette. The flip is what lets the
		     corner marks read — --surface, --muted and --fill-rest inside the
		     portrait now mean the dark context's rungs, so the chips resolve
		     against the picture they sit on instead of against the paper card
		     two levels up. -->
		<div class="cc-portrait ctx-dark">
			{#if !fallback}
				<!-- Decorative (name is in the row below); loads eagerly with the div —
				     lazy-loading roster grids made them trickle on scroll and during the
				     tool→tool slide, and the whole set is ~2.2MB over h3. -->
				<div
					class="cc-img"
					style:background-image="url('{getAvatar(entry.id, preferNewfit, 'full', traveler)}')"
				></div>
			{:else}
				<span class="cc-initials">{entry.displayName.slice(0, 2).toUpperCase()}</span>
			{/if}

			{#if entry.element}
				<!-- ⚓ NATE 2026-08-12, from the game itself: the element pip goes in
				     the portrait's TOP LEFT, bare on the art, where Genshin puts it
				     on its own character cards. It takes over the corner the weapon
				     glyph held — same position, same size, same shadow. -->
				<span
					class="cc-el"
					role="img"
					aria-label={entry.element}
					title={entry.element}
					style:background-image="url('{elementIcon(entry.element)}')"
				></span>
			{/if}
			{#if con !== undefined && !entry.noConstellations}
				<span class="cc-con" class:cc-con--set={con > 0} title="Your constellation">C{con}</span>
			{/if}
			{#if slotNumber !== undefined}
				<span class="cc-slot">{slotNumber}</span>
			{/if}
			{#if wishlist}
				<span class="cc-wish" title="Wishlisted"><Mark name="star" size={11} /></span>
			{/if}
		</div>

		<span class="cc-namerow">
			{#if uncurated}
				<!-- The mark's twin, with nothing in it. Centring a flex row centres
				     the CONTENT, so a lone trailing mark would push the name left by
				     half its width on exactly the cards that already look different.
				     An empty box of the same width on the left is what makes the name
				     sit on the card's centre line whether or not it is annotated. -->
				<span class="cc-namepad" aria-hidden="true"></span>
			{/if}
			<span class="cc-name">{entry.displayName}</span>
			{#if uncurated}
				<span
					class="cc-namemark"
					title="Frame timing not curated yet — capabilities are complete, but Planner timing is approximate"
					aria-label="Frame timing not curated yet"
					><!-- The rendered size is --cc-mark (CSS wins over the attribute, and
					     scales the stroke with it); this only has to be in the right
					     ballpark for the pre-CSS frame. -->
					<Mark name="uncurated" size={12} /></span
				>
			{/if}
		</span>
	</button>

	{#if shown.length || actions}
		<div class="cc-body">
			{#if shown.length}
				<div class="cc-tags">
					{#each shown as tag (tag.label)}
						<span
							class="cc-tag"
							class:cc-tag--active={tag.active}
							class:cc-tag--conditional={tag.conditional}
							title={tag.title}
						>
							{tag.label}
						</span>
					{/each}
					{#if overflow > 0}
						<span class="cc-tag cc-tag--more">+{overflow}</span>
					{/if}
				</div>
			{/if}
			{#if actions}
				<div class="cc-actions">{@render actions(entry)}</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Container-query context: the card reflows to the inline width it's handed.
	   `container-name` is GLOBAL (Svelte doesn't hash it) — `charcard` is unique.
	   NB: an element can't query the container it establishes, so every
	   band-varying rule below targets a `.cc-*` DESCENDANT, never `.cc` itself.
	   `container-type: inline-size` implies `contain: layout`, so `.cc` becomes
	   the containing block for abs-positioned descendants — corner chips anchor to
	   `.cc-portrait` and the action bar to `.cc-body` (both position:relative). */
	.cc {
		/* ── THE STATE LADDER (⚓ NATE 2026-08-11: "tuning, now that they're in an
		   entirely different context — directly on-scene") ─────────────────────
		   Every rung came up. These were picked when the card sat inside a framed
		   paper SHEET, where a fade dropped it toward a known, static ground. The
		   frame went on 2026-08-08 and the card now fades toward the LIVE WORLD:
		   at 0.46 a parchment card became a haze with stars moving through it,
		   which is precisely the state the breathing-room round ruled out —
		   opaque or obviously translucent, the middle is not a place.

		   The floor that sets them: a faded card must still read as an OBJECT
		   with an edge, not as a smudge over the scene. 0.62 holds the paper's
		   identity while leaving a clear step to a resting card; below ~0.55 the
		   scene starts showing through the name plate.

		   ⚠ THIS IS STILL ELEMENT `opacity`, AND THE SUB-PIXEL LAW SAYS IT
		   SHOULDN'T BE — the card is transform-placed on hover, which is exactly
		   the shape WebKit rasterizes at rounded coordinates. Converting means
		   moving the alpha into every child's PAINT (the paper, the gradient, the
		   art, four chips and a tag row), which is a round of its own. Recorded
		   here so it is a known debt rather than an oversight; the transform is
		   1px and only on hover, so any jitter is inside a moving element. */
		--cc-faded: 0.62;
		--cc-faded-hover: 1;
		--cc-dimmed: 0.7;
		--cc-disabled: 0.42;
		container: charcard / inline-size;
		display: flex;
		flex-direction: column;
		/* ↻ ⚓ NATE 2026-08-10: --surface, not --surface-raised. A character card is
		   the canonical SMALLER light object, and on paper the size axis replaced
		   the depth one — see .ctx-light. The two resolve to the same parchment-100
		   now, so this is a naming correction rather than a colour change, but the
		   name is what stops it drifting when a broad panel appears beside it. */
		background: var(--surface);
		/* ↻ 2026-08-11: THE RESTING BORDER IS INK AGAIN, and hue became a STATE.
		   An element border at rest was justified while the card had no other
		   element presence worth the name — a 14% wash over near-black doesn't
		   count. The portrait carries the element properly now, so a coloured
		   edge on all 122 cards at once was just a second, quieter copy of the
		   same fact, and it left hover and "compared" fighting over the only
		   channel the edge has. Three states, three hues, one at a time:
		     rest      ink      — structure, per the palette round's border rule
		     hover     element  — "this one", in the card's own colour
		     compared  gold     — "chosen", the accent's job everywhere else
		   Genshin's own cards agree: a plain cream edge, with the element living
		   in the gradient and the pip. */
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
		transition:
			border-color 150ms ease,
			opacity 150ms ease,
			transform 100ms ease;
	}
	.cc:hover:not(.cc--disabled) {
		border-color: color-mix(in srgb, var(--el-color) 70%, var(--border));
		transform: translateY(-1px);
	}

	/* Visual states live on the root, unconditionally (band-independent). */
	.cc--dimmed {
		opacity: var(--cc-dimmed);
	}
	.cc--faded {
		opacity: var(--cc-faded);
	}
	.cc--faded:hover {
		opacity: var(--cc-faded-hover);
	}
	/* Edit mode keeps the owned/not-owned contrast crisp — no hover lift, so the
	   whole roster's ownership reads at a glance while marking. */
	.cc--edit.cc--faded:hover {
		opacity: var(--cc-faded);
	}
	.cc--disabled {
		opacity: var(--cc-disabled);
	}
	/* Compared — the accent wins over hover's element (source order), because
	   "chosen" is a standing fact and "here" is a passing one. */
	.cc--accent,
	.cc--accent:hover:not(.cc--disabled) {
		border-color: color-mix(in srgb, var(--accent) 75%, var(--border));
	}
	.cc--edit {
		cursor: copy;
	}

	/* Primary control — covers portrait + name; fills the card so no dead zone
	   below the name is unclickable (the planner relies on the whole tile). */
	.cc-main {
		display: flex;
		flex-direction: column;
		width: 100%;
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		color: inherit;
		font: inherit;
	}
	.cc--edit .cc-main {
		cursor: copy;
	}
	.cc-main:disabled {
		cursor: default;
	}

	/* ── The portrait: a WELL the element lights, on the bench card's recipe ──
	   ⚓ NATE 2026-08-11 asked whether this should go LIGHT like Genshin's own
	   character cards (a mid-tone rarity gradient under a cream name plate) or
	   copy the bench. It copies the bench, and the deciding argument is arithmetic
	   rather than taste: the palette round measured Genshin's screens at 10–14%
	   of pixels above L.35 and our TB Roster at 20.8% — this grid is ALREADY the
	   brightest surface we own, and 122 mid-tone gradients would push it further
	   past the reference it is imitating. Genshin can afford bright cards because
	   its party screen shows a dozen; ours shows the whole roster.

	   What DID come across from the reference is the structure, which is the same
	   correction the bench got that morning: ONE ground, with only the element
	   travelling across it. The old recipe ran el-14% → --bg — the PAGE ground,
	   the deepest rung on the site and not on the slate ramp at all — so a paper
	   card had a hole punched through it to the page behind, and 14% of an
	   element over near-black registered as nothing.

	   ⚠ AND THE ELEMENT SITS AT THE BOTTOM, exactly as it does on the bench.
	   ↻ ⚓ NATE 2026-08-11 flipped it: the first draft put the element at the TOP,
	   reasoning that a square filled by the art from the shoulders down leaves
	   the two upper corners as the only ground you can see, so the colour should
	   go where the ground is — plus Genshin's own cards run deep-at-top.
	   His eye says otherwise, and the argument that survives is the simpler one:
	   the colour belongs BEHIND the character, not around their head. Tinting the
	   top puts the strongest wash directly behind the face — the one part of the
	   art that has to hold your attention — and rings every head in its element.
	   Tinting the bottom lets it rise out of the shoulders instead, and it is
	   still perfectly visible: the art tapers, so the lower corners are ground
	   too. The two card families now agree about which way the light falls, which
	   is worth more than either reading of where the ground is widest. */
	.cc-portrait {
		/* 🎛️ How much element the bottom stop carries. Higher than the bench's
		   26% because this is a big flat square rather than a small disc, and the
		   same fraction reads weaker spread over the area. */
		--cc-portrait-el: 32%;
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		background: linear-gradient(
			180deg,
			var(--surface-well) 0%,
			color-mix(in srgb, var(--el-color) var(--cc-portrait-el), var(--surface-well)) 100%
		);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		overflow: hidden;
	}
	.cc-img {
		width: 100%;
		height: 100%;
		background-size: cover;
		background-position: top center;
		background-repeat: no-repeat;
	}
	.cc-initials {
		align-self: center;
		font-size: var(--fs-3xl);
		font-weight: var(--fw-bold);
		color: var(--el-color);
	}

	/* ── Corner marks ─────────────────────────────────────────────
	   TL element · TR constellation · BL wishlist(TB) / slot(planner).
	   The base sizes serve every grid that ships; the roomy band bumps them.

	   ↻ ⚓ NATE 2026-08-12: THE TOP-LEFT CORNER IS THE ELEMENT'S NOW, and the
	   answer came out of the game rather than out of this file — "I was playing
	   Genshin last night, and I think the answer just dropped out from how they
	   handle it: the element icon goes in the top left of the portrait."
	   That solves the last of the round's two element-on-parchment offenders. The
	   glyph used to sit in the NAME ROW, which is `.ctx-light` paper, where the
	   whole palette measures under 3:1 (cryo 1.14:1) — see the --el-* block in
	   app.css for why there is no light rung to reach for instead. In the
	   portrait it is on `.ctx-dark`, at 3.36–8.59:1, and it is doing what the
	   element already does everywhere else on this card: describing the picture
	   rather than the label.
	   ⛔ THE WEAPON GLYPH IS GONE, not moved. It held this corner and there is
	   only one of it; ⚓ Nate's call was a straight replacement, following the
	   in-game card, which shows element and never weapon. Weapon type is still on
	   the detail card and still a roster filter. (Bottom-right is the one free
	   corner if it is ever missed.)

	   ⚓ NATE 2026-08-11: "the constellation pip and the element-type pip are
	   really outdated styling — reference the bench's, and I'm not sure round is
	   the right call." It is, and the reason is that ONE question sorts all four
	   of these: does the mark carry a VALUE, or is it a picture?

	   A VALUE (C4, slot 2) goes in a circle, which is the bench's own idiom for
	   exactly this — .sp-cons-chip is a --r-round well holding a C-number, and
	   two families of character card disagreeing about the shape of a
	   constellation reading would be the drift worth avoiding.

	   A PICTURE (now the element glyph) gets NO CHIP AT ALL. The chip was
	   scaffolding for a legibility problem that no longer exists: the art used to
	   sit on whatever the gradient's near-black end happened to be, so it needed
	   a plate under it. On a well one rung down from the card, at a known slate
	   rung, it simply reads — and Genshin draws its own element pip the same way,
	   bare on the gradient with a soft shadow. */
	.cc-el {
		position: absolute;
		top: 5px;
		left: 5px;
		/* 22, and it is the same 22 as the Atlas card's pip — one mark doing one
		   job on two surfaces, so they are sized together on purpose. It is also
		   what the weapon glyph held here, and that geometry was tuned for this
		   corner. ⚠ Up from 18 in the name row: identity gets to outgrow an
		   annotation, and there is no cap letter beside it to be a peer to now. */
		width: 22px;
		height: 22px;
		background-size: contain;
		background-position: center;
		background-repeat: no-repeat;
		/* ⚓ NATE ASKED: glow or flat? FLAT — and the reason is a system cost
		   rather than a preference. Genshin uses its `glow` set in this exact
		   position and it is beautiful there, but glow is ARTWORK with a baked
		   palette (32–76 colours per glyph), so it cannot be tinted: adopting it
		   here means this one surface's element marks stop tracking --el-*, which
		   is the precise coupling generate-element-icons.mjs exists to guarantee
		   and the drift the palette round deleted (hydro's glyph used to sit 19°
		   off its own token). /lab section 9 measured all five sets.
		   ⚠ And the halo is a fix for THEIR problem, not ours: their pip sits on a
		   bright saturated portrait, ours on a dark slate well. What our corner
		   actually needs is separation from hair, which is what the shadow does —
		   a coloured glow would make a cryo pip WORSE over blonde hair.
		   🎛️ If the glow is wanted anyway, it is a one-line source swap
		   (/assets/elements/glow/{element}.png, already in the repo at 64px) plus
		   accepting that those seven files no longer follow the tokens.
		   The shadow itself: a shadow rather than a plate, because the glyph
		   crosses hair as often as sky and a plate would add a second rectangle to
		   a corner that already has one card edge in it. */
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55));
		z-index: 1;
	}
	/* The two VALUE marks — one shape, one size, opposite corners. Shared so a
	   change to the family cannot land on one of them (the bench learned this
	   with --sp-pill-*). */
	.cc-con,
	.cc-slot {
		position: absolute;
		width: 23px;
		height: 23px;
		display: grid;
		place-items: center;
		border-radius: var(--r-round);
		/* One rung UP from the well it sits on — the reverse of the bench, where
		   the chip is one rung DOWN from the card's ground. Same ΔL, same "this
		   is a control, not part of the picture"; the direction flips because
		   there the surrounding ground was the card and here it is the well. */
		background: var(--surface);
		font-weight: var(--fw-bold);
		line-height: var(--lh-none);
		z-index: 1;
	}
	.cc-con {
		top: 5px;
		right: 5px;
		color: var(--muted);
		font-size: var(--fs-sm);
		/* No tracking inside a circle: the trailing letter-space lands after the
		   last glyph too, so the advance box the grid centres is a unit wider
		   than the ink. Same correction the bench chip carries, same reason. */
		text-indent: -0.06em;
	}
	/* Owned — the value goes ELEMENT, the well does not. Ink is the channel that
	   changes on this family (the bench's rule since it lost its strokes): a
	   filled chip at 20px reads as a coloured dot before it reads as a number. */
	.cc-con--set {
		color: color-mix(in srgb, var(--el-color) 62%, var(--text));
	}
	/* Slot-number badge — the planner picker's chosen-slot marker. Never
	   co-occurs with the wishlist star, so bottom-left is unshared. */
	.cc-slot {
		bottom: 5px;
		left: 5px;
		color: var(--text);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		z-index: 2;
	}
	/* ↻ 2026-08-11: --accent, not --el-geo-hi. A wishlist star is not a geo fact;
	   that token was borrowed for being gold-coloured, which is the exact drift
	   the layer law exists to catch — and it meant every card's star silently
	   carried an element token into a decision the element has no part in. */
	.cc-wish {
		position: absolute;
		bottom: 5px;
		left: 6px;
		color: var(--accent);
		font-size: var(--fs-lg);
		line-height: var(--lh-none);
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55));
		z-index: 1;
	}
	/* ── Name row ────────────────────────────────────────────────
	   ↻ ⚓ NATE 2026-08-12: CENTRED. The row used to lead with the element glyph,
	   which gave the name something to be flush-left against; with the glyph up
	   in the portrait the name was the only thing on the plate and left-alignment
	   read as an accident. "Nothing next to [it] to make it look good with them
	   flush left, so centered they go." Genshin's own cards centre their name
	   plate too, which is the same reference this round is following. */
	.cc-namerow {
		/* Sizes the uncurated mark AND its counterweight — see .cc-namemark. */
		--cc-mark: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		padding: 0.25rem 0.5rem;
		min-width: 0;
		width: 100%;
		box-sizing: border-box;
	}
	.cc-name {
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--text);
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}
	/* Frame-timing-not-curated mark — a warning at the right of the name row (all
	   cards): capability data is complete, only Planner timing is approximate.
	   --ui-danger, not a domain color — a data-quality consequence, not a game
	   fact (dire-retirement round, 2026-08-05). No chip; it sits on the card.

	   ↻ 2026-08-11: THE TYPESET BAGGAGE IS GONE. This was a unicode ∅ until the
	   icon set replaced it with <Mark name="uncurated">, and four declarations
	   survived the swap meaning nothing: font-size, font-weight and line-height
	   do not reach an SVG, and `transform: translateY(-0.1em)` — the optical lift
	   ⚓ Nate tuned by eye because the ∅ sat low in its line box — was now pushing
	   a mark that is already centred OFF its own centre. A Mark is `display:
	   block`, drawn centred in a square viewBox, so it needs no nudge. THE FIX FOR
	   A GLYPH SITTING LOW WAS NEVER SUPPOSED TO OUTLIVE THE GLYPH — this is the
	   second half of the sub-pixel law's marks-are-geometry rule, and worth
	   remembering wherever else the set replaced a character.

	   🎛️ It also stopped SCALING when it stopped being type. The size prop is a
	   fixed 11 at every band, so the mark shrank (relatively) as the card grew,
	   where the ∅ used to climb fs-xl → fs-2xl → fs-3xl. --cc-mark is the knob
	   that restores it: CSS width/height beat the SVG's own attributes, and
	   because the stroke is drawn on a 24-unit viewBox it scales with the box —
	   so one property moves the whole mark, ink weight included.

	   THE SIZE RULE, shared with the bench (.sp-namemark): the mark MATCHES THE
	   NAME IT ANNOTATES, 1:1 in px — 14 beside a --fs-lg name, 16 beside --fs-xl.
	   (The bench's element badge runs 1.25× its name instead; identity outranks
	   annotation. This card's element glyph left the row entirely on 2026-08-12
	   and is sized against the portrait corner now, not against the name.)

	   ↻ 2026-08-12: `margin-left: auto` is GONE. It pushed the mark to the right
	   edge, which was free while the row was flush-left and is now the thing that
	   would break centring — an auto margin absorbs all the free space, so the
	   name would be shoved hard left instead of sitting in the middle. The row's
	   `justify-content: center` plus .cc-namepad (the mark's empty twin on the
	   other side) does the job symmetrically.

	   🎛️ --cc-mark now lives on the ROW rather than on the mark, because two
	   elements read it: the mark and its counterweight. One declaration site is
	   what stops them falling out of step at the roomy band. */
	.cc-namemark {
		flex-shrink: 0;
		display: flex;
		color: var(--ui-danger);
		cursor: help;
	}
	.cc-namemark :global(.mark) {
		width: var(--cc-mark);
		height: var(--cc-mark);
	}
	/* The counterweight — see the markup for why it exists. */
	.cc-namepad {
		width: var(--cc-mark);
		flex-shrink: 0;
	}

	/* ── Body: capability tags + hover action overlay ────────────
	   The whole block is prop-gated, so the planner (which passes neither tags nor
	   actions) never renders it. Fixed height keeps grid rows even and the hover
	   bar in a constant place regardless of tag count. */
	.cc-body {
		position: relative;
		display: block;
		height: 3.7rem;
	}
	.cc-tags {
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: 3px;
		height: 100%;
		box-sizing: border-box;
		padding: 0.15rem 0.5rem 0.5rem;
		overflow: hidden;
	}
	.cc-tag {
		padding: 1px 5px;
		border-radius: 3px;
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		text-transform: uppercase;
		color: var(--muted);
		background: var(--fill-rest);
		white-space: nowrap;
	}
	.cc-tag--active {
		color: var(--text);
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 50%, transparent);
	}
	.cc-tag--conditional {
		opacity: 0.66;
		font-style: italic;
	}
	.cc-tag--more {
		background: none;
		color: color-mix(in srgb, var(--muted) 70%, transparent);
	}

	/* Hover action bar — covers the tags with the consumer's buttons.
	   ↻ 2026-08-11: OPAQUE --surface, not 90% of --surface-raised. Two problems
	   in one declaration: --surface-raised has no meaning on paper (ctx-light has
	   no raised rung — it aliases to --surface, so the name was promising a lift
	   it could never deliver), and a 90% wash let the tag row ghost through the
	   buttons that are supposed to replace it. It is the card's own paper now,
	   which is what makes the bar read as the tag zone TURNING INTO controls
	   rather than as a scrim laid over them. */
	.cc-actions {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: stretch;
		gap: 4px;
		padding: 0.3rem 0.4rem;
		background: var(--surface);
		opacity: 0;
		pointer-events: none;
		transition: opacity 120ms ease;
	}
	.cc:hover .cc-actions,
	.cc-actions:focus-within {
		opacity: 1;
		pointer-events: auto;
	}

	/* ── The ROOMY band — the only container query left ───────────────────────
	   ⛔ THE COMPACT BAND IS DELETED (⚓ Nate approved 2026-08-11). It was the
	   base, gated below 104px — centred name, no element glyph, no body — and it
	   was UNREACHABLE. The smallest minimum any grid hands a card is 118px
	   (.tb-grid and .tb-roster's --cg-tile-min; the planner picker's is 128), and
	   `auto-fill` at a 320px viewport still yields one ~280px column. Everything
	   the 104px query used to set is now simply the base.
	   ⛔ Do not restore it as a mobile safety net: the mobile round is survey-first
	   by its own plan, and a band nothing can reach is the speculative
	   abstraction the conventions forbid.

	   📌 150 IS NOT A FREE NUMBER — IT IS COUPLED TO .tb-grid's 1500px BUMP, and
	   until now nothing said so. With `auto-fill` + `1fr` a track sits just above
	   its minimum (118 → ~118–133 · 150 → ~150–168), so this band fires at exactly
	   the moment the media query raises the minimum to 150. Move one and you must
	   move the other; a value in 134–149 would separate the two regimes with
	   margin, at the cost of the picker (128 min, tracks to ~146) crossing it.

	   ⚓ NATE'S CALIBRATION, 2026-08-11: seven across on a 16" MacBook Pro "feels
	   very nice, very comfortable — if it were a lot more than that, it would
	   start to get too wide." That is this band, at the 150px minimum. The answer
	   to bigger-vs-more is BOTH, IN STEP: the ladder raises the minimum (bigger)
	   while auto-fill adds columns (more), and 7-at-150 is the point it is tuned
	   through. Any change to the 1500/1900 bumps has to keep landing near it. */
	@container charcard (min-width: 150px) {
		.cc-namerow {
			padding: 0.45rem 0.6rem 0.2rem;
			--cc-mark: 16px;
		}
		.cc-name {
			font-size: var(--fs-xl);
		}
		.cc-el {
			width: 25px;
			height: 25px;
		}
		.cc-con,
		.cc-slot {
			width: 26px;
			height: 26px;
		}
		.cc-con {
			font-size: var(--fs-md);
		}
		.cc-slot {
			font-size: var(--fs-xl);
		}
		.cc-body {
			height: 4.4rem;
		}
	}
</style>
