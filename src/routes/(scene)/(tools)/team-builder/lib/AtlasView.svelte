<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	/**
	 * The role Atlas front door — four large Position×Function category cards in a
	 * 2×2 grid. Each card carries color Role+Function glyphs (function-only cards
	 * omit the position glyph), a monotone Role backdrop, and a provides/owned +
	 * per-element breakdown. Clicking a card drills into it (the drill + the
	 * Rotation-Planner "slots" view both render inline character tiles in
	 * +page.svelte, where the tile handlers live).
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
</script>

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
			class="rolecard ctx-glass"
			style:--role-bg="url({functionIcon(card.category.function, 'monotone')})"
			onclick={() => onSelectCategory(card.category)}
			aria-label="{card.category.label}: {card.providerCount} characters, {card.ownedCount} owned"
		>
			<div class="rolecard-glyphs">
				{#if card.category.position}
					<img class="rolecard-glyph" src={positionIcon(card.category.position, 'color')} alt="" />
					<span class="rolecard-plus" aria-hidden="true">+</span>
				{/if}
				<img class="rolecard-glyph" src={functionIcon(card.category.function, 'color')} alt="" />
			</div>
			<span class="rolecard-label">{card.category.label}</span>
			<span class="rolecard-counts">
				<span class="rolecard-count">{card.providerCount}</span> provides ·
				<span class="rolecard-count rolecard-count--owned">{card.ownedCount}</span> owned
			</span>
			<div class="rolecard-elements">
				{#each card.byElement as pip (pip.element)}
					<span class="rolecard-el" title="{pip.element} ({pip.count})">
						{#if pip.element !== 'none'}
							<img class="rolecard-el-icon" src={elIcon(pip.element)} alt={pip.element} />
						{/if}
						{pip.count}
					</span>
				{/each}
			</div>
		</button>
	{/each}
</div>

<style>
	.rolecards {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
		align-content: start;
	}
	@media (max-width: 620px) {
		.rolecards {
			grid-template-columns: 1fr;
		}
	}

	.rolecard {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		min-height: 210px;
		padding: 1.4rem 1.5rem 1.2rem;
		/* Edge border retired 2026-08-07 — the raised ground is the separation. */
		border: none;
		border-radius: var(--r-sm);
		/* ⚠ --surface, not --surface-raised. On glass the two resolve to the same
		   stop (there is no "raised" through a translucent material — depth here
		   comes from alpha, and the well is the only other rung), and --surface is
		   the honest name for the ground a card paints. */
		background: var(--surface);
		text-align: left;
		cursor: pointer;
		color: inherit;
		font: inherit;
		transition:
			background 150ms ease,
			transform 150ms ease;
	}
	/* ↻ ⚓ NATE 2026-08-10: the glass pane-hover idiom — A RING AND A DENSITY,
	   no wash. Same treatment as the band plates (see app.css), because this is
	   the same situation: a pane of glass whose extent the sky behind it will not
	   reliably declare. The accent wash it replaces was the last place a hovered
	   slate surface picked up a foreign hue. */
	.rolecard:hover {
		background: var(--surface-hover);
		box-shadow: inset 0 0 0 1px var(--glass-ring);
		transform: translateY(-2px);
	}
	/* The monotone role glyph as a large, faint backdrop.
	   ↻ ⚓ NATE 2026-08-10: DRAWN, not masked. It was briefly re-published as a
	   mask over a painted fill, on the reasoning that navy ink authored for
	   parchment would vanish on a dark ground. That was the wrong end of the
	   problem — these assets were drawn to be exactly this: a slightly
	   transparent overlay on dark slate, where the near-black of the glyph
	   reads as a deeper pool in the card rather than as a lit shape on it. The
	   card going glass changed nothing about that; it is still dark slate. */
	.rolecard::before {
		content: '';
		position: absolute;
		right: -12%;
		bottom: -20%;
		width: 64%;
		height: 120%;
		background-image: var(--role-bg);
		background-repeat: no-repeat;
		background-position: bottom right;
		background-size: contain;
		opacity: 0.2;
		pointer-events: none;
	}
	.rolecard > * {
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
	.rolecard-counts {
		font-size: var(--fs-md);
		color: var(--muted);
	}
	.rolecard-count {
		font-weight: var(--fw-semibold);
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	/* ⚠ The white lift is gone with the light ground. It existed to pull gold-700
	   forward off parchment; on glass the accent is already gold-400, the
	   brightest thing on the card, and mixing white into it only desaturates the
	   one figure the card exists to state. */
	.rolecard-count--owned {
		color: var(--accent);
	}

	.rolecard-elements {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: auto;
		padding-top: 0.4rem;
	}
	.rolecard-el {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}
	.rolecard-el-icon {
		width: 18px;
		height: 18px;
		object-fit: contain;
	}
</style>
