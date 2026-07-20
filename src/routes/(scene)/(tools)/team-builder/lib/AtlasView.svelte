<script lang="ts">
	/**
	 * The Atlas grid — the Team Builder's question-indexed front door. One card
	 * per capability ("who can heal, and how many do I own"), with element pips
	 * to scope a capability to an element. Clicking a card selects the facet;
	 * clicking a pip selects facet + element. Selection pivots to the Roster tab.
	 */
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import type { FacetKey } from './facets';
	import type { AtlasCard } from './atlas';

	let {
		cards,
		onSelect
	}: {
		cards: AtlasCard[];
		onSelect: (facet: FacetKey, element?: string) => void;
	} = $props();

	function elColor(el: string): string {
		return (elementColors[el as ElementKey] ?? elementColors.none).main;
	}
</script>

<div class="atlas">
	{#each cards as card (card.facet)}
		<div class="atlas-card" style:--accent-el={elColor(card.byElement[0]?.element ?? 'none')}>
			<button
				class="atlas-card-main"
				onclick={() => onSelect(card.facet)}
				title={card.hint}
				aria-label="{card.label}: {card.providerCount} providers, {card.ownedCount} owned"
			>
				<span class="atlas-card-label">{card.label}</span>
				<span class="atlas-card-counts">
					<span class="atlas-count">{card.providerCount}</span> providers ·
					<span class="atlas-count atlas-count--owned">{card.ownedCount}</span> owned
				</span>
			</button>
			<div class="atlas-pips">
				{#each card.byElement as pip (pip.element)}
					<button
						class="atlas-pip"
						style:--el={elColor(pip.element)}
						onclick={() => onSelect(card.facet, pip.element)}
						title="{card.label} · {pip.element} ({pip.count})"
						aria-label="{pip.count} {pip.element} {card.label} providers"
					>
						<span class="atlas-pip-dot"></span>{pip.count}
					</button>
				{/each}
			</div>
		</div>
	{/each}
</div>

<style>
	.atlas {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
		gap: 0.7rem;
		align-content: start;
	}

	.atlas-card {
		display: flex;
		flex-direction: column;
		border: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
		border-left: 3px solid color-mix(in srgb, var(--accent-el) 70%, var(--border));
		border-radius: 6px;
		background: var(--surface);
		overflow: hidden;
		transition: border-color 150ms ease;
	}
	.atlas-card:hover {
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
	}

	.atlas-card-main {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.6rem 0.7rem 0.5rem;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
		color: inherit;
		font: inherit;
	}
	.atlas-card-label {
		font-family: var(--font-display);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--text);
	}
	.atlas-card-counts {
		font-size: var(--fs-xs);
		color: var(--muted);
	}
	.atlas-count {
		font-weight: var(--fw-semibold);
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.atlas-count--owned {
		color: color-mix(in srgb, var(--accent) 85%, white);
	}

	.atlas-pips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		padding: 0 0.7rem 0.6rem;
	}
	.atlas-pip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 1px 6px 1px 4px;
		border: 1px solid color-mix(in srgb, var(--el) 45%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--el) 10%, transparent);
		color: var(--text);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
		cursor: pointer;
		transition:
			background 150ms ease,
			border-color 150ms ease;
	}
	.atlas-pip:hover {
		background: color-mix(in srgb, var(--el) 22%, transparent);
		border-color: color-mix(in srgb, var(--el) 70%, transparent);
	}
	.atlas-pip-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--el);
	}
</style>
