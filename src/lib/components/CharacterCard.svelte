<script lang="ts" module>
	import type { FacetKey } from '$lib/capabilities/deriveCapabilities';

	/** One glyph of the card's fingerprint. The consumer supplies them ALREADY
	 *  ORDERED (the fingerprint's one order) and decides `lit` against its own
	 *  lens — the card stays decoupled from the Team Builder's facet system. */
	export type CardGlyph = {
		facet: FacetKey;
		lit: boolean;
		title: string;
		/** Swap mode: this capability would be NEW to the team — painted in
		 *  the fingerprint preview's gain hue. */
		gain?: boolean;
	};

	/* 🎛️ The glyph column's geometry (⚓ Nate on /lab/cards, 2026-10-11),
	   owned HERE and handed to the CSS as custom properties, because the cap
	   below reads the same numbers. */
	export const CC_GLYPH = 11;
	export const CC_GAP_MIN = 5;
	export const CC_COL_PAD = 8;
	export const CC_NAME_H = 26;
	const CC_COL = CC_GLYPH + 2 * CC_COL_PAD;

	/* 🎛️ THE NAME NEVER WRAPS (⚓ Nate 2026-10-20; ↻ responsive sweep
	   2026-10-15 item 23 gave it a second line, which bent a card's shape and
	   so its whole row). A name that doesn't fit its strip SHRINKS to fit,
	   from the strip's 12px down to a 10px floor — the CSS reads the name's
	   width at 12px, measured once per name here. Measured 2026-10-20: the
	   widest are the elemental Travelers (89px at 12px), which at a 390
	   phone's ~109px card land at ~10px. */
	export const CC_NAME_FS = 12;
	/** Write-once per name, never read reactively — a plain record. */
	const nameWidths: Record<string, number> = {};
	let measureCtx: CanvasRenderingContext2D | null = null;
	/** The name's width at CC_NAME_FS in the strip's face (cached). */
	function nameWidth(name: string, el: HTMLElement): number {
		const hit = nameWidths[name];
		if (hit !== undefined) return hit;
		measureCtx ??= document.createElement('canvas').getContext('2d');
		if (!measureCtx) return 0;
		const cs = getComputedStyle(el);
		measureCtx.font = `${cs.fontWeight} ${CC_NAME_FS}px ${cs.fontFamily}`;
		const w = Math.ceil(measureCtx.measureText(name).width);
		nameWidths[name] = w;
		return w;
	}

	/** How many rows the glyph column holds on a card `width` px wide without
	 *  growing it: the portrait (square, the width less the column) plus a
	 *  ONE-line name strip, less the column's padding, at the tightest gap.
	 *  ⚓ Responsive sweep 2026-10-15 item 23 (⚓ Nate): Columbina's nine
	 *  glyphs made her card, and so her whole grid row, taller than the rest. */
	export function glyphFit(width: number): number {
		const avail = width - CC_COL + CC_NAME_H - 2 * CC_COL_PAD;
		return Math.max(2, Math.floor((avail + CC_GAP_MIN) / (CC_GLYPH + CC_GAP_MIN)));
	}
</script>

<script lang="ts">
	/**
	 * THE CHARACTER CARD — the Team Builder's grid tile (lineups design §11.6,
	 * the card round 2026-10-11; designed on /lab/cards, concept E, ⚓ Nate).
	 *
	 * The game's Stygian card, in our materials:
	 *   · the PORTRAIT and its NAME are one opaque, rounded card — the art on its
	 *     element wash, the name on a parchment strip, the game's large rounded
	 *     corner at the art's lower right with the parchment run up behind it;
	 *   · it sits on a SHEER glass ground (`--glass-sheer`) that also holds the
	 *     character's own FINGERPRINT to the right: only the capabilities they
	 *     have or can unlock — lit = offered at your settings, dim = from a
	 *     higher constellation — with no labels and no numbers. ⛔ Never the
	 *     full fifteen (that is the team's fingerprint), and ⛔ no chip row: it
	 *     overflowed into "+N" on 24 of 128 characters, hiding the very thing
	 *     the card was for. A character with no capabilities shows an empty
	 *     column, and the sheer glass keeps that from reading as a hole.
	 *   · The WHOLE CARD PICKS into the selected team; the corner magnifier
	 *     opens details (the boss disc's grammar).
	 *   · Picked, it wears its team's FRAME: bars along the top and bottom in
	 *     the team's hue (never the sides), the slot number in a tab hung from
	 *     the top bar at the card's top right.
	 *   · The constellation chip (owned, C1+) sits at the portrait's TOP right —
	 *     the art's lower right is too busy — under the magnifier, which covers
	 *     it exactly on hover. On touch there is no hover, so the magnifier
	 *     moves to the lower right and the chip stays visible.
	 *
	 * Purely presentational + callback-driven: it never touches a store.
	 */
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import FingerprintGlyph from './FingerprintGlyph.svelte';
	import Mark from './Mark.svelte';
	import ConMark from './ConMark.svelte';
	import type { CharacterIndexEntry } from '$lib/types/character';
	import { getAvatar, hasAvatar, type TravelerVariant } from '$lib/utils/getAvatar';
	import { elementPalette } from '$lib/utils/elementColors';

	let {
		entry,
		preferNewfit = false,
		traveler = 'aether',
		glyphs,
		ownedCon,
		frame,
		nudged = false,
		pickLabel,
		onPick,
		onDetails,
		onPreview
	}: {
		entry: CharacterIndexEntry;
		preferNewfit?: boolean;
		traveler?: TravelerVariant;
		glyphs: CardGlyph[];
		/** The roster's constellation when owned; the chip shows from C1. */
		ownedCon?: number;
		/** The team this character's frame wears, and their slot in it. */
		frame?: { hue: string; slot: number };
		/** A pick that found the team full: the card shakes once. */
		nudged?: boolean;
		/** The pick's screen-reader name (it names the team). */
		pickLabel: string;
		onPick: (id: string) => void;
		onDetails: (id: string) => void;
		/** The pointer or keyboard focus has come to rest on the card (`id`)
		 *  or left it (`null`) — the board previews what a pick would do. A
		 *  mouse or pen only: a touch has no resting state, and its
		 *  `pointerleave` is not promised. */
		onPreview?: (id: string | null) => void;
	} = $props();

	const hoverable = (e: PointerEvent) => e.pointerType !== 'touch';

	const color = $derived(elementPalette(entry.element).main);
	/** The card's width, for the glyph cap. 0 before the first measure, when
	 *  the cap assumes the narrowest card (--cg-tile-min, 108): a first frame
	 *  may hide one glyph too many, never grow the card. */
	let cardW = $state(0);
	let nameEl = $state<HTMLElement>();
	/** The name's width at 12px (unitless px), for the strip's fit. */
	const nameW = $derived(nameEl ? nameWidth(entry.displayName, nameEl) : 0);
	const fit = $derived(glyphFit(cardW || 108));
	/** Past the fit, the first fit−1 glyphs and a "+K" in the last row. The
	 *  consumer orders them (a filtered capability first), so what is hidden
	 *  is the tail. */
	const shown = $derived(glyphs.length > fit ? glyphs.slice(0, fit - 1) : glyphs);
	const hidden = $derived(glyphs.length - shown.length);
	/** Rows of the glyph column — the gap spreads them over the card's height. */
	const rows = $derived(Math.max(1, shown.length + (hidden > 0 ? 1 : 0)));
	const chip = $derived(
		ownedCon !== undefined && ownedCon > 0 && !entry.noConstellations ? ownedCon : null
	);
	// Known-missing art renders initials, gated by the build-time manifest.
	const fallback = $derived(!hasAvatar(entry.id));
</script>

<!-- The preview handlers are a pointer ENHANCEMENT; the keyboard reaches the
     same preview through focusin on the card's own buttons. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="cc ctx-dark"
	class:cc--nudged={nudged}
	style:--el-color={color}
	style:--rows={rows}
	style:--cc-glyph="{CC_GLYPH}px"
	style:--cc-gap-min="{CC_GAP_MIN}px"
	style:--cc-col-pad="{CC_COL_PAD}px"
	style:--cc-name-h="{CC_NAME_H}px"
	style:--cc-name-fs="{CC_NAME_FS}px"
	bind:clientWidth={cardW}
	data-id={entry.id}
	onpointerenter={(e) => hoverable(e) && onPreview?.(entry.id)}
	onpointerleave={(e) => hoverable(e) && onPreview?.(null)}
	onfocusin={() => onPreview?.(entry.id)}
	onfocusout={(e) => {
		if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) onPreview?.(null);
	}}
>
	<button class="cc-main" onclick={() => onPick(entry.id)} aria-label={pickLabel}>
		<span class="cc-pt">
			<!-- The plate's parchment, run up behind the rounded corner. -->
			<span class="cc-notch ctx-light" aria-hidden="true"></span>
			<span class="cc-art">
				{#if !fallback}
					<img
						class="cc-img"
						src={getAvatar(entry.id, preferNewfit, 'full', traveler)}
						alt=""
						decoding="async"
						draggable="false"
					/>
				{:else}
					<span class="cc-initials">{entry.displayName.slice(0, 2).toUpperCase()}</span>
				{/if}
				{#if entry.element}
					<img
						class="cc-el"
						src={elementIcon(entry.element)}
						alt={entry.element}
						decoding="async"
						draggable="false"
					/>
				{/if}
			</span>
			{#if chip !== null}
				<span class="cc-chip" title={`You own C${chip}`}><ConMark level={chip} height={8} /></span>
			{/if}
		</span>
		<span class="cc-glyphs ctx-glass">
			{#each shown as g (g.facet)}
				<span class="cc-g" class:cc-g--dim={!g.lit} class:cc-g--gain={g.gain} title={g.title}>
					<FingerprintGlyph facet={g.facet} />
				</span>
			{/each}
			{#if hidden > 0}
				<!-- The rest are in the character's details (the magnifier). -->
				<span
					class="cc-g cc-more"
					title={`${hidden} more ${hidden === 1 ? 'capability' : 'capabilities'}`}>+{hidden}</span
				>
			{/if}
		</span>
		<span class="cc-name ctx-light" bind:this={nameEl} style:--cc-name-w={nameW || undefined}
			>{entry.displayName}</span
		>
	</button>
	<button
		class="cc-mag"
		aria-label={`${entry.displayName}'s details`}
		title={`${entry.displayName}'s details`}
		onclick={() => onDetails(entry.id)}><Mark name="search" size={14} /></button
	>
	{#if frame}
		<span class="cc-frame" style:--hue={frame.hue} aria-hidden="true">
			<span class="cc-tab">{frame.slot}</span>
		</span>
	{/if}
</div>

<style>
	.cc {
		/* 🎛️ The glyph column (⚓ Nate on /lab/cards, 2026-10-11 — retune once
		   the fifteen glyphs are drawn): glyph size, and the row gap's range.
		   Rows spread over the card's height between the two; a fingerprint
		   longer than the card holds is capped with a "+K" (glyphFit). ↻ The
		   glyph size, the minimum gap, the column's padding and the name
		   strip's height are set inline from the module's CC_* constants,
		   which the cap reads too. */
		--cc-gap-max: 11px;
		/* 🎛️ The art's rounded corner. */
		--cc-corner: 22px;
		/* A wrapped name's line pitch (12px type): two lines and the strip's
		   6px of padding make a 34px strip. */
		--cc-name-lh: 14px;
		/* 🎛️ The team frame's bars (Nate's 3/4). */
		--cc-bar-top: 3px;
		--cc-bar-bottom: 4px;
		--cc-col: calc(var(--cc-glyph) + 2 * var(--cc-col-pad));
		/* ⚠ A size container, so the glyph column can measure the card's height
		   (its width less the column, plus the name) and spread its rows. */
		container-type: inline-size;
		position: relative;
		/* A column, so the pick button fills the cell the grid stretched this
		   card to — see .cc-name. */
		display: flex;
		flex-direction: column;
		border-radius: 6px;
		background: var(--glass-sheer);
		transition:
			background-color var(--t-snap),
			transform var(--t-snap);
	}
	/* HOVER IS DENSITY (the house rule): the sheer ground firms to the panel
	   stop, so no ring competes with the team frames. */
	.cc:hover {
		background: var(--glass-panel);
		transform: translateY(-1px);
	}
	/* The shared nudge (app.css) — it guards reduced motion itself. */
	.cc--nudged {
		animation: nudge 120ms 2;
	}

	/* The whole card is the pick. */
	.cc-main {
		flex: 1;
		display: grid;
		grid-template-columns: minmax(0, 1fr) var(--cc-col);
		grid-template-rows: auto minmax(var(--cc-name-h), 1fr);
		width: 100%;
		padding: 0;
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	/* ── The portrait: the inner card's top half ── */
	.cc-pt {
		position: relative;
		grid-column: 1;
		grid-row: 1;
		display: block;
	}
	.cc-notch {
		position: absolute;
		right: 0;
		bottom: 0;
		width: var(--cc-corner);
		height: var(--cc-corner);
		background: var(--surface);
	}
	/* The house wash — the element at the BOTTOM, rising out of the shoulders
	   (⚓ Nate 2026-08-11), on one slate ground. */
	.cc-art {
		position: relative;
		display: flex;
		justify-content: center;
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: 6px 6px var(--cc-corner) 0;
		background: linear-gradient(
			180deg,
			var(--surface-well) 0%,
			color-mix(in srgb, var(--el-color) 32%, var(--surface-well)) 100%
		);
	}
	.cc-img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: top center;
	}
	.cc-initials {
		align-self: center;
		font-size: var(--fs-3xl);
		font-weight: var(--fw-bold);
		color: var(--el-color);
	}
	/* The element, bare on the art at the top left, where the game puts it. */
	.cc-el {
		position: absolute;
		top: 4px;
		left: 4px;
		width: 22px;
		height: 22px;
		object-fit: contain;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55));
	}
	/* The lineup slot's constellation chip, on the WELL (⚓ Nate: it reads as a
	   twin of the sheer glass), at the portrait's top right. */
	.cc-chip {
		position: absolute;
		top: 7px;
		right: 3px;
		height: 18px;
		padding: 0 6px;
		box-sizing: border-box;
		display: grid;
		place-items: center;
		border-radius: var(--r-round);
		background: var(--surface-well);
		color: var(--text);
	}

	/* ── The fingerprint column ── centred in the WHOLE card's height. */
	.cc-glyphs {
		--avail: calc(100cqw - var(--cc-col) + var(--cc-name-h) - 2 * var(--cc-col-pad));
		grid-column: 2;
		grid-row: 1 / -1;
		display: grid;
		grid-template-columns: var(--cc-glyph);
		grid-auto-rows: var(--cc-glyph);
		align-content: center;
		justify-content: center;
		--cc-row-gap: clamp(
			var(--cc-gap-min),
			calc((var(--avail) - var(--rows) * var(--cc-glyph)) / max(var(--rows) - 1, 1)),
			var(--cc-gap-max)
		);
		row-gap: var(--cc-row-gap);
		padding: var(--cc-col-pad);
	}
	.cc-g {
		position: relative;
		display: grid;
		place-items: center;
		width: var(--cc-glyph);
		height: var(--cc-glyph);
		color: var(--text);
	}
	/* The glyph's HIT AREA (for its tooltip) covers half the row gap above and
	   below and the column's padding either side, so the column has no dead
	   space between glyphs — crossing one hid the tooltip and restarted its
	   delay on an 11px target. Transparent and out of flow. */
	.cc-g::before {
		content: '';
		position: absolute;
		inset: calc(var(--cc-row-gap) / -2) calc(-1 * var(--cc-col-pad));
	}
	/* 🎛️ DIM = painted (the sub-pixel law), never element opacity. */
	.cc-g--dim {
		color: color-mix(in srgb, var(--text) 30%, transparent);
	}
	/* The cap's "+K": the column's count in the column's own small type, at
	   the dim glyphs' ink, so it reads as the column's tail, not a badge. It
	   centres on the glyph track and may run past its 11px into the padding. */
	.cc-more {
		font-family: var(--font-condensed);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		line-height: 1;
		white-space: nowrap;
		color: color-mix(in srgb, var(--text) 60%, transparent);
	}
	/* Swap mode: what this character would ADD to the team — the preview's
	   gain hue, straight (Fingerprint.svelte's .fp-gain). */
	.cc-g--gain {
		color: var(--ui-positive);
	}

	/* ── The name: a parchment strip under the portrait only ── */
	/* ⚓ Nate 2026-10-20: ONE line, always — a name that doesn't fit SHRINKS
	   to fit (12px → a 10px floor; --cc-name-w is its width at 12px, set in
	   the script), and every card in a row keeps one shape. ↻ It took a
	   second line before (responsive sweep 2026-10-15 item 23), which grew
	   the strip and with it the whole row. The ellipsis is a last resort the
	   floor should never reach. */
	.cc-name {
		grid-column: 1;
		grid-row: 2;
		align-self: stretch;
		display: flex;
		align-items: center;
		justify-content: center;
		/* 2px more at the foot than the head, so the name sits 1px high and
		   clears the frame's bottom bar when the card is picked (⚓ Nate) — one
		   line lands where the old 24px line box in a 26px strip put it. 3px at
		   the sides (was 6), so the widest name holds the floor on the 108px
		   card ("Dendro Traveler" needs 74.2px at 10px). */
		padding: 2px 3px 4px;
		border-radius: 0 0 6px 6px;
		background: var(--surface);
		color: var(--text);
		/* The strip's text width is the card (100cqw) less the glyph column
		   and the 6px of padding; the name's 12px width scales into it. */
		font-size: max(
			10px,
			min(var(--cc-name-fs), calc((100cqw - var(--cc-col) - 6px) * 12 / var(--cc-name-w, 1)))
		);
		font-weight: var(--fw-semibold);
		line-height: var(--cc-name-lh);
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* ── The magnifier: the boss disc's, 26px with a 14px mark — the width
	   that covers the widest chip (C6, 25px), centred on it (7 + 18/2 = 3 +
	   26/2). OPAQUE in both states, so the chip never shows through: the
	   button face at rest, the selection gold laid as an inset shadow over the
	   well on hover, the same gold the boss ring wears. */
	.cc-mag {
		position: absolute;
		top: 3px;
		right: calc(var(--cc-col) + 2px);
		width: 26px;
		height: 26px;
		display: grid;
		place-items: center;
		padding: 0;
		border: none;
		border-radius: var(--r-round);
		background-color: var(--btn-face);
		box-shadow: inset 0 0 0 13px transparent;
		color: var(--text);
		cursor: zoom-in;
		opacity: 0;
		transition:
			opacity var(--t-snap),
			background-color var(--t-snap),
			box-shadow var(--t-snap);
	}
	.cc:hover .cc-mag,
	.cc:focus-within .cc-mag {
		opacity: 1;
	}
	.cc-mag:hover {
		background-color: var(--surface-well);
		box-shadow: inset 0 0 0 13px var(--sel-ring);
	}
	/* ⚓ No hover on touch, so the magnifier is always shown — at the
	   portrait's lower right, inset 4px to stay inside the rounded corner,
	   leaving the chip its top right. */
	@media (hover: none) {
		.cc-mag {
			/* From the TOP: the portrait is square (100cqw less the glyph
			   column), and the name strip under it may be two lines tall. */
			top: calc(100cqw - var(--cc-col) - 26px - 4px);
			right: calc(var(--cc-col) + 4px);
			opacity: 1;
		}
	}

	/* ── The team frame: top and bottom bars only, in the team's hue ── */
	.cc-frame {
		position: absolute;
		inset: 0;
		border-top: var(--cc-bar-top) solid var(--hue);
		border-bottom: var(--cc-bar-bottom) solid var(--hue);
		border-radius: 6px;
		pointer-events: none;
	}
	/* The tab hangs FROM the top bar: bar + tab is one square and the number
	   centres in the whole of it. ↻ Nate 2026-10-13: as wide as the glyph
	   column under it (was 20px), so the tab caps the column. */
	.cc-tab {
		position: absolute;
		top: calc(-1 * var(--cc-bar-top));
		right: 0;
		width: var(--cc-col);
		height: var(--cc-col);
		display: grid;
		place-items: center;
		border-radius: 0 6px 0 6px;
		background: var(--hue);
		color: var(--bright-ink); /* ink on a bright fill */
		font-size: var(--fs-md);
		font-weight: var(--fw-bold);
		line-height: 1;
	}
</style>
