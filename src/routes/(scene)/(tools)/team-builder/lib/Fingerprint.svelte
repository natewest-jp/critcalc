<script lang="ts">
	/**
	 * THE FINGERPRINT, drawn (lineups design §4; the model is `$lib/fingerprint`).
	 * Fifteen slots in three clusters — Survival · Support · Damage — the same
	 * order for every team, so two teams compare as SHAPES.
	 *
	 * GLYPHS: Nate's traced icons (`fingerprintGlyphs.generated.ts`, six of
	 * fifteen on 2026-10-09); a facet without one keeps its circle pip.
	 *
	 * ⚓ TWO STATES, EVERY GLYPH ALWAYS DRAWN (Nate 2026-10-09) — a missing
	 * capability has to be SEEN missing, so no slot shrinks to a dot:
	 *   lit    the team has it; dots = how many members provide it
	 *   faint  the team does not; dots = members who WOULD (a higher
	 *          constellation, or a condition this team doesn't meet), no dots =
	 *          nobody here has it
	 * The model's five states survive in the slot's sentence (the tooltip),
	 * which says which kind of "would" it is. An uncurated member reads as
	 * faint with no dots — the sentence says the kit is unknown.
	 * Painted, ⛔ never element opacity (the sub-pixel law).
	 */
	import { FACETS } from '$lib/capabilities/facets';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import type { FingerprintCluster, FingerprintSlot } from '$lib/fingerprint';
	import { FINGERPRINT_GLYPHS } from '$lib/fingerprintGlyphs.generated';

	let { clusters }: { clusters: { cluster: FingerprintCluster; slots: FingerprintSlot[] }[] } =
		$props();

	const LABEL = Object.fromEntries(FACETS.map((f) => [f.key, f.label]));
	const first = (id: string) => (getCharacterIndexEntry(id)?.displayName ?? id).split(' ')[0];

	/** Who the dots count: the providers when lit, the would-be providers when
	 *  faint. */
	const dotsOf = (s: FingerprintSlot) =>
		s.state === 'lit'
			? s.providers
			: s.members.filter((m) => m.state === 'locked' || m.state === 'outlined').map((m) => m.id);

	/** ⏭ Working copy for the slot's sentence (copy step 8). */
	function sentence(s: FingerprintSlot): string {
		const label = LABEL[s.facet] ?? s.facet;
		const who = (state: string) =>
			s.members.filter((m) => m.state === state).map((m) => first(m.id));
		const parts: string[] = [];
		if (who('lit').length) parts.push(who('lit').join(', '));
		if (who('outlined').length) parts.push(`${who('outlined').join(', ')} — not in this team`);
		if (who('locked').length) parts.push(`${who('locked').join(', ')} — at a higher constellation`);
		if (who('unknown').length) parts.push(`${who('unknown').join(', ')} — not yet curated`);
		return `${label}: ${parts.length ? parts.join('; ') : 'nobody'}`;
	}
</script>

<div class="fp" role="list" aria-label="The team's capabilities">
	{#each clusters as c (c.cluster)}
		<span class="fp-cluster">
			{#each c.slots as s (s.facet)}
				{@const glyph = FINGERPRINT_GLYPHS[s.facet]}
				{@const lit = s.state === 'lit'}
				<span class="fp-slot" role="listitem" title={sentence(s)} aria-label={sentence(s)}>
					{#if glyph}
						<svg class="fp-glyph" class:fp-lit={lit} viewBox="0 0 24 24" aria-hidden="true">
							{#each glyph.shade ?? [] as d, i (i)}<path class="fp-shade" {d} />{/each}
							{#each glyph.fill as d, i (i)}<path {d} />{/each}
						</svg>
					{:else}
						<span class="fp-pip" class:fp-lit={lit}></span>
					{/if}
					<span class="fp-dots" class:fp-lit={lit}>
						{#each dotsOf(s) as p (p)}<span class="fp-dot"></span>{/each}
					</span>
				</span>
			{/each}
		</span>
	{/each}
</div>

<style>
	.fp {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.fp-cluster {
		display: flex;
		gap: 4px;
	}
	.fp-slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		width: 16px;
	}
	/* FAINT is the resting paint; LIT is the ink. A shade half rides at half
	   whichever it wears. */
	.fp-glyph {
		width: 16px;
		height: 16px;
		fill-rule: evenodd;
		fill: var(--line-strong);
	}
	.fp-glyph.fp-lit {
		fill: var(--text);
	}
	.fp-shade {
		fill-opacity: 0.5;
	}
	.fp-pip {
		width: 12px;
		height: 12px;
		margin: 2px 0;
		border-radius: var(--r-round);
		background: var(--line-strong);
	}
	.fp-pip.fp-lit {
		background: var(--text);
	}
	.fp-dots {
		display: flex;
		gap: 1px;
		height: 3px;
		color: var(--line-edge);
	}
	.fp-dots.fp-lit {
		color: var(--text);
	}
	.fp-dot {
		width: 3px;
		height: 3px;
		border-radius: var(--r-round);
		background: currentColor;
	}
</style>
