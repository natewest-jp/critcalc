<script lang="ts" module>
	/** A pre-formatted capability chip. The consumer supplies these ALREADY
	 *  ORDERED (the card only slices to `maxTags` + renders the `+overflow`
	 *  count) — the card stays decoupled from the Team Builder's facet system. */
	export type TagChip = { label: string; active?: boolean; conditional?: boolean; title?: string };
</script>

<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import type { Snippet } from 'svelte';
	import type { CharacterIndexEntry } from '$lib/types/character';
	import { getAvatar, hasAvatar, type TravelerVariant } from '$lib/utils/getAvatar';
	import { elementPalette } from '$lib/utils/elementColors';

	// ---------------------------------------------------------------------------
	// The one square-portrait character tile, shared by the Team Builder roster
	// and the Rotation Planner's picker. Purely presentational + callback-driven
	// (never touches a store — the host wires meaning). LAYOUT adapts to the width
	// it's handed via three CSS container-query bands (compact / comfortable /
	// roomy); CONTENT sections are prop-gated. See `SlotPortrait` for the sibling
	// (circular loadout) card — deliberately separate.
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
		showWeapon = true,
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
		showWeapon?: boolean;
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

	const WEAPON_TYPES = ['sword', 'claymore', 'polearm', 'bow', 'catalyst'];
	const hasWeaponIcon = $derived(WEAPON_TYPES.includes(entry.weapon ?? ''));

	const color = $derived(elementPalette(entry.element).main);

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
		<div class="cc-portrait">
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

			{#if showWeapon && hasWeaponIcon}
				<span
					class="cc-weapon"
					role="img"
					aria-label={entry.weapon}
					title={entry.weapon}
					style:background-image="url('/assets/weapon-types/{entry.weapon}.webp')"
				></span>
			{/if}
			{#if con !== undefined && !entry.noConstellations}
				<span class="cc-con" class:cc-con--set={con > 0} title="Your constellation">C{con}</span>
			{/if}
			{#if slotNumber !== undefined}
				<span class="cc-slot">{slotNumber}</span>
			{/if}
			{#if wishlist}
				<span class="cc-wish" title="Wishlisted">★</span>
			{/if}
		</div>

		<span class="cc-namerow">
			{#if entry.element}
				<span
					class="cc-el"
					role="img"
					aria-label={entry.element}
					style:background-image="url('{elementIcon(entry.element)}')"
				></span>
			{/if}
			<span class="cc-name">{entry.displayName}</span>
			{#if showUncuratedMark && !entry.curated}
				<span
					class="cc-namemark"
					title="Frame timing not curated yet — capabilities are complete, but Planner timing is approximate"
					aria-label="Frame timing not curated yet">∅</span
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
		--cc-faded: 0.46;
		--cc-faded-hover: 0.92;
		--cc-dimmed: 0.55;
		--cc-disabled: 0.32;
		container: charcard / inline-size;
		display: flex;
		flex-direction: column;
		background: var(--surface-raised); /* in-page panel role (Nate 2026-07-31) */
		/* The one raised panel that keeps an ELEMENT border — brightened from
		   the old 22% mix so the element actually reads at rest. */
		border: 1px solid color-mix(in srgb, var(--el-color) 42%, var(--border));
		border-radius: 6px;
		overflow: hidden;
		transition:
			border-color 150ms ease,
			opacity 150ms ease,
			transform 100ms ease;
	}
	.cc:hover:not(.cc--disabled) {
		border-color: color-mix(in srgb, var(--el-color) 65%, var(--border));
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
	.cc--accent {
		border-color: color-mix(in srgb, var(--accent) 65%, var(--border));
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

	.cc-portrait {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--el-color) 14%, var(--bg)) 0%,
			var(--bg) 100%
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
		font-size: var(--fs-2xl);
		font-weight: var(--fw-bold);
		color: var(--el-color);
	}

	/* ── Corner chips ────────────────────────────────────────────
	   TL weapon · TR constellation · BL wishlist(TB) / slot(planner) · BR frames.
	   Compact sizes are the base; comfortable+ bumps them (see @container). */
	.cc-weapon {
		position: absolute;
		top: 4px;
		left: 4px;
		width: 19px;
		height: 19px;
		padding: 2px;
		border-radius: 3px;
		background-color: color-mix(in srgb, var(--el-color) 4%, var(--bg));
		/* icon image sits inside the 2px padding, like the old object-fit img */
		background-origin: content-box;
		background-size: contain;
		background-position: center;
		background-repeat: no-repeat;
		z-index: 1;
	}
	.cc-con {
		position: absolute;
		top: 4px;
		right: 4px;
		min-width: 18px;
		height: 16px;
		display: grid;
		place-items: center;
		padding: 0 4px;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.08);
		color: var(--muted);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-wide);
		line-height: var(--lh-none);
		z-index: 1;
	}
	.cc-con--set {
		background: color-mix(in srgb, var(--el-color) 24%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--el-color) 55%, transparent);
		color: color-mix(in srgb, var(--el-color) 75%, white);
	}
	/* Slot-number badge — bottom-left, matching the weapon glyph's chip (same
	   element-tinted background, radius, and box size; tracks the weapon per band). */
	.cc-slot {
		position: absolute;
		bottom: 4px;
		left: 4px;
		width: 19px;
		height: 19px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 3px;
		background: color-mix(in srgb, var(--el-color) 4%, var(--bg));
		color: #fff;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		line-height: var(--lh-none);
		z-index: 2;
	}
	.cc-wish {
		position: absolute;
		bottom: 4px;
		left: 5px;
		color: var(--el-geo-hi, #eed8a5);
		font-size: var(--fs-md);
		line-height: var(--lh-none);
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.7));
		z-index: 1;
	}
	/* ── Name row ────────────────────────────────────────────────
	   Base (compact) centers the name, no element glyph. Comfortable+ shows the
	   glyph and left-aligns (see @container). */
	.cc-namerow {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		padding: 4px 4px 5px;
		min-width: 0;
		width: 100%;
		box-sizing: border-box;
	}
	.cc-el {
		display: none;
		width: 15px;
		height: 15px;
		flex-shrink: 0;
		background-size: contain;
		background-position: center;
		background-repeat: no-repeat;
	}
	.cc-name {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		color: var(--text);
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}
	/* Frame-timing-not-curated mark — a bold warning ∅ ("no frame data") at the
	   right of the name row (all cards): capability data is complete, only Planner
	   timing is approximate. --ui-danger, not a domain color — a data-quality
	   consequence, not a game fact (dire-retirement round, 2026-08-05). No chip —
	   it sits on the card surface. Scales up with the card (fs-xl → fs-3xl). */
	.cc-namemark {
		margin-left: auto;
		flex-shrink: 0;
		color: var(--ui-danger);
		font-size: var(--fs-xl);
		font-weight: var(--fw-bold);
		line-height: var(--lh-none);
		/* The ∅ glyph sits low in its line box; nudge it up. In `em` so the lift
		   scales with the glyph's own (band-dependent) font-size — ~1.8px at fs-2xl,
		   ~2px at fs-3xl — one declaration instead of a per-band offset. */
		transform: translateY(-0.1em);
		cursor: help;
	}

	/* ── Body: capability tags + hover action overlay ────────────
	   Hidden at compact (planner passes neither, so it isn't rendered there).
	   Fixed height at comfortable+ keeps grid rows even and the hover bar in a
	   constant place regardless of tag count. */
	.cc-body {
		position: relative;
		display: none;
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
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		text-transform: uppercase;
		color: var(--muted);
		background: rgba(255, 255, 255, 0.06);
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

	/* Hover action bar — covers the tags with the consumer's buttons. Reveal is
	   disabled at compact (no room); enabled comfortable+ via @container. */
	.cc-actions {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: stretch;
		gap: 4px;
		padding: 0.3rem 0.4rem;
		background: color-mix(in srgb, var(--surface-raised) 90%, transparent);
		opacity: 0;
		pointer-events: none;
		transition: opacity 120ms ease;
	}

	/* ── Comfortable band (TB default ~118px, picker ~130px) ────── */
	@container charcard (min-width: 104px) {
		.cc-namerow {
			justify-content: flex-start;
			gap: 0.3rem;
			padding: 0.25rem 0.5rem;
		}
		.cc-el {
			display: inline-block;
		}
		.cc-name {
			font-size: var(--fs-md);
			text-align: left;
		}
		.cc-weapon,
		.cc-slot {
			width: 21px;
			height: 21px;
		}
		.cc-con {
			min-width: 20px;
			height: 18px;
		}
		.cc-namemark {
			font-size: var(--fs-2xl);
		}
		.cc-body {
			display: block;
			height: 3.7rem;
		}
		.cc:hover .cc-actions,
		.cc-actions:focus-within {
			opacity: 1;
			pointer-events: auto;
		}
	}

	/* ── Roomy band (wide screens, ~150px+) ────────────────────── */
	@container charcard (min-width: 150px) {
		.cc-namerow {
			padding: 0.45rem 0.6rem 0.2rem;
		}
		.cc-name {
			font-size: var(--fs-lg);
		}
		.cc-weapon,
		.cc-slot {
			width: 24px;
			height: 24px;
		}
		.cc-namemark {
			font-size: var(--fs-3xl);
		}
		.cc-body {
			height: 4.4rem;
		}
	}
</style>
