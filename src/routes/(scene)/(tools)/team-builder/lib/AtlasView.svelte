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
		<button
			class="rolecard"
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
		background: var(--surface-raised); /* in-page panel role (Nate 2026-07-31) */
		text-align: left;
		cursor: pointer;
		color: inherit;
		font: inherit;
		transition:
			border-color 150ms ease,
			transform 150ms ease;
	}
	.rolecard:hover {
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
		transform: translateY(-2px);
	}
	/* Monotone role glyph as a large, faint backdrop over the navy surface. */
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
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
	}

	.rolecard-label {
		font-family: var(--font-display);
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--text);
	}
	.rolecard-counts {
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.rolecard-count {
		font-weight: var(--fw-semibold);
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.rolecard-count--owned {
		color: color-mix(in srgb, var(--accent) 85%, white);
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
		font-size: var(--fs-xs);
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
