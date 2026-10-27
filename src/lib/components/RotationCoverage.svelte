<script lang="ts">
	/**
	 * The planner's opt-in coverage strips (⚓ Nate 2026-09-23 — Settings, OFF by
	 * default): each slotted character's strip under the notation box, the parts
	 * THIS rotation does not reach dimmed (`unusedSegments` — a constellation you
	 * don't have, an action you never type). The strip answers "can I trust this
	 * rotation?"; a name opens that character's coverage over the planner.
	 */
	import { characterIndex } from '$lib/data/characterIndex.generated';
	import { decodeCoverage } from '$lib/coverage/deriveCoverage';
	import { unusedSegments } from '$lib/coverage/rotationUse';
	import { COVERAGE_LAYOUT } from '$lib/coverage/coverageLayout';
	import { COLUMN_LABEL } from '$lib/coverage/coverageText';
	import { openCoverage } from '$lib/coverage/openCoverage';
	import type { TimelineEvent } from '$lib/utils/rotationEvents';
	import { resolve } from '$app/paths';
	import CoverageStrip from './CoverageStrip.svelte';

	let {
		ids,
		events,
		constellations
	}: {
		/** Slotted character ids, in slot order. */
		ids: string[];
		events: readonly TimelineEvent[];
		/** The effective constellation per character (tab over roster). */
		constellations: Record<string, number>;
	} = $props();

	const byId = Object.fromEntries(characterIndex.map((e) => [e.id, e]));

	const rows = $derived(
		ids
			.filter((id) => byId[id])
			.map((id) => ({
				id,
				name: byId[id].displayName,
				states: decodeCoverage(byId[id].coverage),
				dim: unusedSegments(events, id, constellations[id] ?? 0)
			}))
	);
</script>

{#if rows.length > 0}
	<div class="rp-coverage" style:--cov-template={COVERAGE_LAYOUT.template}>
		<span class="rp-cov-corner"></span>
		<div class="rp-cov-head" aria-hidden="true">
			{#each COVERAGE_LAYOUT.colSpan as [col, [a, b]] (col)}
				<span style:grid-column="{a} / {b + 1}">{COLUMN_LABEL[col]}</span>
			{/each}
		</div>
		{#each rows as row (row.id)}
			<a
				class="link link--quiet rp-cov-name"
				href="{resolve('/coverage')}?c={row.id}"
				onclick={(e) => openCoverage(e, [row.id])}>{row.name}</a
			>
			<CoverageStrip
				states={row.states}
				dim={row.dim}
				titles
				label="{row.name}’s coverage, with the parts this rotation doesn’t reach dimmed"
			/>
		{/each}
	</div>
{/if}

<style>
	/* The name column, then the strip — the header row shares the strip's grid,
	   so a column's label sits over its segments. */
	.rp-coverage {
		--cov-strip-h: 9px;
		display: grid;
		grid-template-columns: 7.5rem minmax(0, 1fr);
		align-items: center;
		gap: 3px 0.75rem;
		font-size: var(--fs-sm);
	}
	.rp-cov-head {
		display: grid;
		grid-template-columns: var(--cov-template);
		color: var(--muted);
		font-size: var(--fs-xs);
	}
	.rp-cov-head span {
		text-align: center;
		white-space: nowrap;
		overflow: visible;
	}
	/* ⚓ Nate 2026-09-23: right-aligned, snug against the strip — the column is
	   sized for the longest name and most are far shorter. */
	.rp-cov-name {
		justify-self: end;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text);
	}
</style>
