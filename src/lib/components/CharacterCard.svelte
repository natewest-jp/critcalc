<script lang="ts" module>
	import type { FacetKey } from '$lib/capabilities/deriveCapabilities';

	/** One glyph of the card's fingerprint. The consumer supplies them ALREADY
	 *  ORDERED (the fingerprint's one order) and decides `lit` against its own
	 *  lens — the card stays decoupled from the Team Builder's facet system. */
	export type CardGlyph = { facet: FacetKey; lit: boolean; title: string };
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
	import { FINGERPRINT_GLYPHS } from '$lib/fingerprintGlyphs.generated';
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
		onDetails
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
	} = $props();

	/** ⏳ Two-letter stand-ins for the facets Nate has not drawn yet. */
	const STAND_IN: Partial<Record<FacetKey, string>> = {
		cleanse: 'CL',
		taunt: 'TA',
		'buff:dmg': 'DM',
		'buff:hpdef': 'HP',
		resShred: 'SH',
		grouping: 'GR',
		infuse: 'IN',
		interruptionRes: 'IR',
		offFieldDamage: 'OF'
	};

	const color = $derived(elementPalette(entry.element).main);
	/** Rows of the glyph column — the gap spreads them over the card's height. */
	const rows = $derived(Math.max(1, glyphs.length));
	const chip = $derived(
		ownedCon !== undefined && ownedCon > 0 && !entry.noConstellations ? ownedCon : null
	);
	// Known-missing art renders initials, gated by the build-time manifest. No
	// <img> elements: Safari 26.x pays ~2ms per dynamically created img, and a
	// background-image div dodges it (122 cards: 222ms → 2ms).
	const fallback = $derived(!hasAvatar(entry.id));
</script>

<div
	class="cc ctx-dark"
	class:cc--nudged={nudged}
	style:--el-color={color}
	style:--rows={rows}
	data-id={entry.id}
>
	<button class="cc-main" onclick={() => onPick(entry.id)} aria-label={pickLabel}>
		<span class="cc-pt">
			<!-- The plate's parchment, run up behind the rounded corner. -->
			<span class="cc-notch ctx-light" aria-hidden="true"></span>
			<span class="cc-art">
				{#if !fallback}
					<span
						class="cc-img"
						style:background-image="url('{getAvatar(entry.id, preferNewfit, 'full', traveler)}')"
					></span>
				{:else}
					<span class="cc-initials">{entry.displayName.slice(0, 2).toUpperCase()}</span>
				{/if}
				{#if entry.element}
					<span
						class="cc-el"
						role="img"
						aria-label={entry.element}
						style:background-image="url('{elementIcon(entry.element)}')"
					></span>
				{/if}
			</span>
			{#if chip !== null}
				<span class="cc-chip" title={`You own C${chip}`}><ConMark level={chip} height={8} /></span>
			{/if}
		</span>
		<span class="cc-glyphs ctx-glass">
			{#each glyphs as g (g.facet)}
				{@const art = FINGERPRINT_GLYPHS[g.facet]}
				<span class="cc-g" class:cc-g--dim={!g.lit} title={g.title}>
					{#if art}
						<svg viewBox="0 0 24 24" aria-hidden="true">
							{#each art.shade ?? [] as d, i (i)}<path class="cc-g-shade" {d} />{/each}
							{#each art.fill as d, i (i)}<path {d} />{/each}
						</svg>
					{:else}
						<span class="cc-g-stand" aria-hidden="true">{STAND_IN[g.facet]}</span>
					{/if}
				</span>
			{/each}
		</span>
		<span class="cc-name ctx-light">{entry.displayName}</span>
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
		   Rows spread over the card's height between the two, so only a long
		   fingerprint (Columbina's nine) tightens. */
		--cc-glyph: 13px;
		--cc-gap-min: 3px;
		--cc-gap-max: 9px;
		--cc-col-pad: 7px;
		/* 🎛️ The art's rounded corner and the name strip's height. */
		--cc-corner: 22px;
		--cc-name-h: 26px;
		/* 🎛️ The team frame's bars (Nate's 3/4). */
		--cc-bar-top: 3px;
		--cc-bar-bottom: 4px;
		--cc-col: calc(var(--cc-glyph) + 2 * var(--cc-col-pad));
		/* ⚠ A size container, so the glyph column can measure the card's height
		   (its width less the column, plus the name) and spread its rows. */
		container-type: inline-size;
		position: relative;
		border-radius: 6px;
		background: var(--glass-sheer);
		transition:
			background-color var(--t-snap),
			transform 100ms ease;
	}
	/* HOVER IS DENSITY (the house rule): the sheer ground firms to the panel
	   stop, so no ring competes with the team frames. */
	.cc:hover {
		background: var(--glass-panel);
		transform: translateY(-1px);
	}
	.cc--nudged {
		animation: cc-nudge 120ms 2;
	}
	@keyframes cc-nudge {
		25% {
			transform: translateX(-3px);
		}
		75% {
			transform: translateX(3px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.cc--nudged {
			animation: none;
		}
	}

	/* The whole card is the pick. */
	.cc-main {
		display: grid;
		grid-template-columns: minmax(0, 1fr) var(--cc-col);
		grid-template-rows: auto var(--cc-name-h);
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
	/* The element, bare on the art at the top left, where the game puts it. */
	.cc-el {
		position: absolute;
		top: 4px;
		left: 4px;
		width: 22px;
		height: 22px;
		background-size: contain;
		background-position: center;
		background-repeat: no-repeat;
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
		row-gap: clamp(
			var(--cc-gap-min),
			calc((var(--avail) - var(--rows) * var(--cc-glyph)) / max(var(--rows) - 1, 1)),
			var(--cc-gap-max)
		);
		padding: var(--cc-col-pad);
	}
	.cc-g {
		display: grid;
		place-items: center;
		width: var(--cc-glyph);
		height: var(--cc-glyph);
		color: var(--text);
	}
	.cc-g svg {
		width: 100%;
		height: 100%;
		fill: currentColor;
		fill-rule: evenodd;
	}
	.cc-g-shade {
		fill-opacity: 0.5;
	}
	/* 🎛️ DIM = painted (the sub-pixel law), never element opacity. */
	.cc-g--dim {
		color: color-mix(in srgb, var(--text) 30%, transparent);
	}
	.cc-g-stand {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		border: 1px solid currentColor;
		border-radius: var(--r-round);
		font-family: var(--font-condensed);
		font-size: calc(var(--cc-glyph) * 0.5);
		font-weight: var(--fw-bold);
		line-height: 1;
	}

	/* ── The name: a parchment strip under the portrait only ── */
	.cc-name {
		grid-column: 1;
		grid-row: 2;
		height: var(--cc-name-h);
		/* 2px short of the strip, so the name sits 1px high and clears the
		   frame's bottom bar when the card is picked (⚓ Nate). */
		line-height: calc(var(--cc-name-h) - 2px);
		padding: 0 6px;
		border-radius: 0 0 6px 6px;
		background: var(--surface);
		color: var(--text);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
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
			top: auto;
			bottom: calc(var(--cc-name-h) + 4px);
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
	/* The tab hangs FROM the top bar: bar + tab is one 20px square and the
	   number centres in the whole of it. */
	.cc-tab {
		position: absolute;
		top: calc(-1 * var(--cc-bar-top));
		right: 0;
		width: 20px;
		height: 20px;
		display: grid;
		place-items: center;
		border-radius: 0 6px 0 6px;
		background: var(--hue);
		color: var(--bright-ink); /* ink on a bright fill */
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		line-height: 1;
	}
</style>
