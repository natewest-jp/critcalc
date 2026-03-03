<script lang="ts">
	import {
		CRIT_DAMAGE_MAX,
		CRIT_DAMAGE_MIN,
		CRIT_DAMAGE_STEP,
		CRIT_RATE_MAX,
		CRIT_RATE_MIN,
		CRIT_RATE_STEP,
		averageDamageMultiplier,
		critDamageValues,
		critRateValues,
		getTierColor,
		getTierTextColor,
		tiers
	} from './crit-data';

	let {
		highlightCR = null,
		highlightCD = null,
		minVisibleMultiplier = null,
		showCurve = true,
		curveTolerance = 0.08,
		showLegend = true
	}: {
		highlightCR?: number | null;
		highlightCD?: number | null;
		minVisibleMultiplier?: number | null;
		showCurve?: boolean;
		curveTolerance?: number;
		showLegend?: boolean;
	} = $props();

	const snapToStep = (value: number, min: number, max: number, step: number) => {
		const clamped = Math.min(max, Math.max(min, value));
		return Number((Math.round((clamped - min) / step) * step + min).toFixed(4));
	};

	const selectedCR = $derived(
		highlightCR === null ? null : snapToStep(highlightCR, CRIT_RATE_MIN, CRIT_RATE_MAX, CRIT_RATE_STEP)
	);

	const selectedCD = $derived(
		highlightCD === null ? null : snapToStep(highlightCD, CRIT_DAMAGE_MIN, CRIT_DAMAGE_MAX, CRIT_DAMAGE_STEP)
	);

	function isOnCurve(critRate: number, critDamage: number) {
		return Math.abs(critDamage - 2 * critRate) <= curveTolerance;
	}

	function isSelected(critRate: number, critDamage: number) {
		return selectedCR === critRate && selectedCD === critDamage;
	}

	function cellTitle(critRate: number, critDamage: number, value: number) {
		return `CR: ${Math.round(critRate * 100)}% | CD: ${Math.round(critDamage * 100)}% | Avg: ${value.toFixed(2)}x`;
	}
</script>

<div class="crit-table-shell">
	<div class="crit-table-scroll">
		<table class="crit-table">
			<thead>
				<tr>
					<th class="corner">CD \ CR</th>
					{#each critRateValues as critRate}
						<th class:axisHighlight={selectedCR === critRate}>{Math.round(critRate * 100)}%</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each critDamageValues as critDamage}
					<tr>
						<th scope="row" class="rowHead" class:axisHighlight={selectedCD === critDamage}>
							{Math.round(critDamage * 100)}%
						</th>
						{#each critRateValues as critRate}
							{@const value = averageDamageMultiplier(critRate, critDamage)}
							{@const isDimmed = minVisibleMultiplier !== null && value < minVisibleMultiplier}
							<td
								class:selected={isSelected(critRate, critDamage)}
								class:curve={showCurve && isOnCurve(critRate, critDamage)}
								class:dim={isDimmed}
								style:background-color={getTierColor(value)}
								style:color={getTierTextColor(value)}
								title={cellTitle(critRate, critDamage, value)}
							>
								{value.toFixed(2)}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if showLegend}
		<ul class="tierLegend">
			{#each tiers as tier}
				<li>
					<span class="swatch" style:background-color={tier.color}></span>
					<span>{tier.label}</span>
					<span class="range">
						{#if tier.max === Infinity}
							{tier.min.toFixed(1)}x+
						{:else}
							{tier.min.toFixed(1)}x to {tier.max.toFixed(1)}x
						{/if}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.crit-table-shell {
		display: grid;
		gap: 0.85rem;
	}

	.crit-table-scroll {
		overflow: auto;
		border-radius: 0.8rem;
		border: 1px solid color-mix(in srgb, var(--main-text) 18%, transparent);
		background: color-mix(in srgb, var(--content-bg) 90%, var(--outside-bg) 10%);
	}

	.crit-table {
		width: 100%;
		min-width: max-content;
		border-collapse: collapse;
		font-size: 0.78rem;
		line-height: 1.2;
	}

	th,
	td {
		padding: 0.38rem 0.52rem;
		border: 1px solid color-mix(in srgb, var(--main-text) 16%, transparent);
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	thead th {
		position: sticky;
		top: 0;
		z-index: 2;
		font-weight: 700;
		background: color-mix(in srgb, var(--content-bg) 86%, var(--outside-bg) 14%);
	}

	.rowHead {
		position: sticky;
		left: 0;
		z-index: 1;
		font-weight: 700;
		background: color-mix(in srgb, var(--content-bg) 86%, var(--outside-bg) 14%);
	}

	.corner {
		left: 0;
		z-index: 3;
	}

	td {
		font-weight: 600;
	}

	.axisHighlight {
		background: color-mix(in srgb, var(--header-text) 18%, var(--content-bg) 82%) !important;
	}

	td.curve {
		box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--header-text) 65%, transparent);
	}

	td.selected {
		box-shadow: inset 0 0 0 2.5px #1bd3ff;
		font-weight: 700;
	}

	td.dim {
		opacity: 0.32;
		filter: saturate(0.3);
	}

	.tierLegend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 0.7rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tierLegend li {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid color-mix(in srgb, var(--main-text) 14%, transparent);
		border-radius: 999px;
		padding: 0.26rem 0.62rem;
		font-size: 0.72rem;
		background: color-mix(in srgb, var(--content-bg) 92%, var(--outside-bg) 8%);
	}

	.swatch {
		width: 0.72rem;
		height: 0.72rem;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, black 30%, transparent);
	}

	.range {
		opacity: 0.75;
	}
</style>
