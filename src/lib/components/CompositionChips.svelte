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
	import { REACTION_INGREDIENTS, teamReactions } from '$lib/capabilities/deriveCapabilities';
	import { REACTION_FAMILY, REACTION_LABEL } from '$lib/utils/auraDisplay';
	import { deriveResonances } from '$lib/utils/resonance';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';
	import type { Reaction } from '$lib/types/ability';

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

	type Pair = { a: string; b: string; label: string; title: string };
	const pairs = $derived.by(() => {
		if (!reactions) return [];
		// A plain object, not a Map: a pure fold, nothing here is state.
		const byPair: Record<string, Reaction[]> = {};
		for (const r of teamReactions(members)) {
			const groups = REACTION_INGREDIENTS[r].elements;
			if (groups.length !== 2) continue;
			const key = `${groups[0][0]}|${groups[1][0]}`;
			(byPair[key] ??= []).push(r);
		}
		const out: Pair[] = [];
		for (const [key, rs] of Object.entries(byPair)) {
			const [a, b] = key.split('|');
			// A converted reaction keeps its own name (Stellar Swirl beside a
			// plain Swirl must not read as two Swirls); the rest read by family.
			const lead = rs[0];
			out.push({
				a,
				b,
				label: REACTION_INGREDIENTS[lead].enabler ? REACTION_LABEL[lead] : REACTION_FAMILY[lead],
				title: rs.map((r) => REACTION_LABEL[r]).join(' · ')
			});
		}
		return out;
	});

	const factions = $derived.by(() => {
		const c = deriveTeamComposition(members);
		const out: string[] = [];
		if (c.hasAscendantGleam) out.push('Ascendant Gleam');
		if (c.hasSecretRite) out.push('Secret Rite');
		if (c.natlanCount >= 2) out.push(`Natlan ×${c.natlanCount}`);
		return out;
	});
</script>

<span class="cc">
	{#each resonances as res (res.key)}
		<span class="cc-chip" title={res.effect}>
			{#if res.element && elementIcon(res.element)}
				<img class="cc-icon" src={elementIcon(res.element)} alt="" />
			{/if}
			{res.label}
		</span>
	{/each}
	{#each pairs as p (p.a + p.b)}
		<span class="cc-chip" title={p.title}>
			<span class="cc-pair" aria-hidden="true">
				<img class="cc-icon cc-half cc-half--a" src={elementIcon(p.a)} alt="" />
				<img class="cc-icon cc-half cc-half--b" src={elementIcon(p.b)} alt="" />
			</span>
			{p.label}
		</span>
	{/each}
	{#each factions as f (f)}
		<span class="cc-chip">{f}</span>
	{/each}
</span>

<style>
	.cc {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.cc-chip {
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
	.cc-chip:not(:has(img)) {
		padding-left: 7px;
	}
	.cc-icon {
		width: 14px;
		height: 14px;
	}
	/* The diagonal: both icons in one box, each keeping its side of the line
	   from the top-right corner to the bottom-left. */
	.cc-pair {
		position: relative;
		width: 16px;
		height: 16px;
	}
	.cc-half {
		position: absolute;
		inset: 0;
		width: 16px;
		height: 16px;
	}
	.cc-half--a {
		clip-path: polygon(0 0, 100% 0, 0 100%);
	}
	.cc-half--b {
		clip-path: polygon(100% 0, 100% 100%, 0 100%);
	}
</style>
