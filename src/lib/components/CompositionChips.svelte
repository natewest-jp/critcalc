<script lang="ts">
	/**
	 * CompositionChips — what a TEAM is, in three kinds of chip (lineups design
	 * §3): its resonance, the reactions its elements can make, its factions.
	 * Shared by the board's team rows and the library's team headings.
	 *
	 * ⚓ A reaction chip is Stygian's: the two element icons, each clipped to one
	 * side of a diagonal, generated from the icons we have (no new art). One chip
	 * per element PAIR — the pair is what a player reads; the variants a pair
	 * can make (Quicken / Spread / Aggravate) ride the hover. Three-element
	 * reactions (Burgeon, Hyperbloom) are implied by their Bloom pair and get no
	 * chip of their own.
	 *
	 * Resonance needs a full party (the in-game rule, `deriveResonances`).
	 * Enablers apply: a team with Columbina shows Lunar-Bloom, not Bloom.
	 */
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { reactionPairs } from '$lib/utils/reactionPairs';
	import { deriveResonances } from '$lib/utils/resonance';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';

	let {
		ids,
		reactions = true
	}: {
		ids: readonly (string | null)[];
		/** ⚓ Off in the library heading (Nate 2026-10-09): an Overvape team makes
		 *  six pairs, and past a few chips they stop being read. There a team is
		 *  recognised by its portraits and nickname and FOUND by a reaction tag in
		 *  the search. The board's rows decide their own form (step 5). */
		reactions?: boolean;
	} = $props();

	const members = $derived(
		ids
			.filter((id): id is string => !!id && id !== 'blank')
			.map((id) => getCharacterIndexEntry(id))
			.filter((m) => m !== null)
	);

	const resonances = $derived(
		deriveResonances(
			ids.map((id) => (id && id !== 'blank' ? (getCharacterIndexEntry(id)?.element ?? null) : null))
		).active
	);

	const pairs = $derived(reactions ? reactionPairs(members) : []);

	const factions = $derived.by(() => {
		const c = deriveTeamComposition(members);
		const out: string[] = [];
		if (c.hasAscendantGleam) out.push('Ascendant Gleam');
		if (c.hasSecretRite) out.push('Secret Rite');
		if (c.natlanCount >= 2) out.push(`Natlan ×${c.natlanCount}`);
		return out;
	});
</script>

<span class="comp">
	{#each resonances as res (res.key)}
		<span class="comp-chip" title={res.effect}>
			{#if res.element && elementIcon(res.element)}
				<img class="comp-icon" src={elementIcon(res.element)} alt="" />
			{/if}
			{res.label}
		</span>
	{/each}
	{#each pairs as p (p.a + p.b)}
		<span class="comp-chip" title={p.title}>
			<span class="comp-pair" aria-hidden="true">
				<img class="comp-icon comp-half comp-half--a" src={elementIcon(p.a)} alt="" />
				<img class="comp-icon comp-half comp-half--b" src={elementIcon(p.b)} alt="" />
			</span>
			{p.label}
		</span>
	{/each}
	{#each factions as f (f)}
		<span class="comp-chip">{f}</span>
	{/each}
</span>

<style>
	.comp {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.comp-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 20px;
		padding: 0 7px 0 4px;
		border-radius: var(--r-round);
		background: var(--surface-raised);
		color: var(--text);
		font-size: var(--fs-xs);
		white-space: nowrap;
	}
	.comp-chip:not(:has(img)) {
		padding-left: 7px;
	}
	.comp-icon {
		width: 14px;
		height: 14px;
	}
	/* The diagonal: both icons in one box, each keeping its side of the line
	   from the top-right corner to the bottom-left. */
	.comp-pair {
		position: relative;
		width: 16px;
		height: 16px;
	}
	.comp-half {
		position: absolute;
		inset: 0;
		width: 16px;
		height: 16px;
	}
	.comp-half--a {
		clip-path: polygon(0 0, 100% 0, 0 100%);
	}
	.comp-half--b {
		clip-path: polygon(100% 0, 100% 100%, 0 100%);
	}
</style>
