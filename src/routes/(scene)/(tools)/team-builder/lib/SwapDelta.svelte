<script lang="ts">
	/**
	 * WHAT A SWAP DOES, as a section head's run of signed items (lineups design
	 * §11.6 item 20): "+ Vaporize · − ATK buff · − [check]". Each item draws
	 * the way the board draws the same thing — a reaction as its diagonal pair
	 * icon, a resonance as its element, a capability as its fingerprint glyph,
	 * a battlefield check as its chip — so a header and the row it predicts
	 * read as one vocabulary. The SIGN carries the hue; the words never change
	 * colour.
	 */
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { FACETS } from '$lib/capabilities/facets';
	import FingerprintGlyph from '$lib/components/FingerprintGlyph.svelte';
	import CheckChip from './CheckChip.svelte';
	import type { DeltaItem } from './team';

	let { items }: { items: DeltaItem[] } = $props();

	const LABEL = Object.fromEntries(FACETS.map((f) => [f.key, f.label]));
</script>

<span class="sd">
	{#each items as item, i (i)}
		<span class="sd-item" class:sd-gain={item.sign > 0} class:sd-loss={item.sign < 0}>
			<span class="sd-sign" aria-label={item.sign > 0 ? 'Gains' : 'Loses'}
				>{item.sign > 0 ? '+' : '−'}</span
			>
			{#if item.kind === 'facet'}
				<span class="sd-glyph"><FingerprintGlyph facet={item.facet} /></span>
				{LABEL[item.facet] ?? item.facet}
			{:else if item.kind === 'reaction'}
				<span class="sd-pair" aria-hidden="true" title={item.pair.title}>
					<img class="sd-half sd-half--a" src={elementIcon(item.pair.a)} alt="" />
					<img class="sd-half sd-half--b" src={elementIcon(item.pair.b)} alt="" />
				</span>
				{item.pair.label}
			{:else if item.kind === 'resonance'}
				{#if item.element && elementIcon(item.element)}
					<img class="sd-icon" src={elementIcon(item.element)} alt="" />
				{/if}
				{item.label}
			{:else}
				<CheckChip check={item.check} />
			{/if}
		</span>
	{/each}
</span>

<style>
	.sd {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 14px;
		min-width: 0;
	}
	.sd-item {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		color: var(--text);
		white-space: nowrap;
	}
	.sd-sign {
		font-weight: var(--fw-bold);
		min-width: 0.6em;
		text-align: center;
	}
	.sd-gain .sd-sign {
		color: var(--ui-positive);
	}
	.sd-loss .sd-sign {
		color: var(--ui-danger);
	}
	.sd-glyph {
		width: 13px;
		height: 13px;
	}
	.sd-icon {
		width: 16px;
		height: 16px;
	}
	/* The diagonal pair, as CompositionChips draws it. */
	.sd-pair {
		position: relative;
		width: 16px;
		height: 16px;
	}
	.sd-half {
		position: absolute;
		inset: 0;
		width: 16px;
		height: 16px;
	}
	.sd-half--a {
		clip-path: polygon(0 0, 100% 0, 0 100%);
	}
	.sd-half--b {
		clip-path: polygon(100% 0, 100% 100%, 0 100%);
	}
</style>
