<script lang="ts">
	/**
	 * THE FINGERPRINT, drawn (lineups design §4; the model is `$lib/fingerprint`).
	 * Fifteen slots in three clusters — Survival · Support · Damage — the same
	 * order for every team, so two teams compare as SHAPES.
	 *
	 * ⏭ PLACEHOLDER GLYPHS: each slot is a circle pip until Nate's fifteen SVGs
	 * arrive (§4.2). The states are already the real ones, painted (⛔ never
	 * element opacity — the sub-pixel law):
	 *   lit       solid ink
	 *   outlined  a ring — provides it, but a condition fails in this team
	 *   locked    a faint fill — only above the member's constellation
	 *   unknown   a dashed ring — uncurated, so absence proves nothing
	 *   absent    a faint dot, keeping the slot's place
	 * Dots under a slot count its providers (redundancy shown, never judged).
	 */
	import { FACETS } from '$lib/capabilities/facets';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import type { FingerprintCluster, FingerprintSlot } from '$lib/fingerprint';

	let { clusters }: { clusters: { cluster: FingerprintCluster; slots: FingerprintSlot[] }[] } =
		$props();

	const LABEL = Object.fromEntries(FACETS.map((f) => [f.key, f.label]));
	const first = (id: string) => (getCharacterIndexEntry(id)?.displayName ?? id).split(' ')[0];

	/** ⏭ Working copy for the slot's sentence (copy step 8). */
	function sentence(s: FingerprintSlot): string {
		const label = LABEL[s.facet] ?? s.facet;
		const who = (state: string) =>
			s.members.filter((m) => m.state === state).map((m) => first(m.id));
		switch (s.state) {
			case 'lit':
				return `${label}: ${who('lit').join(', ')}`;
			case 'outlined':
				return `${label}: ${who('outlined').join(', ')} — not in this team`;
			case 'locked':
				return `${label}: ${who('locked').join(', ')} — at a higher constellation`;
			case 'unknown':
				return `${label}: unknown — ${who('unknown').join(', ')} not yet curated`;
			default:
				return `${label}: nobody`;
		}
	}
</script>

<div class="fp" role="list" aria-label="The team's capabilities">
	{#each clusters as c (c.cluster)}
		<span class="fp-cluster">
			{#each c.slots as s (s.facet)}
				<span class="fp-slot" role="listitem" title={sentence(s)} aria-label={sentence(s)}>
					<span class="fp-pip fp-pip--{s.state}"></span>
					<span class="fp-dots">
						{#each s.providers as p (p)}<span class="fp-dot"></span>{/each}
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
		width: 14px;
	}
	.fp-pip {
		width: 12px;
		height: 12px;
		box-sizing: border-box;
		border-radius: var(--r-round);
	}
	.fp-pip--lit {
		background: var(--text);
	}
	.fp-pip--outlined {
		border: 2px solid var(--text);
	}
	.fp-pip--locked {
		background: var(--line-strong);
	}
	.fp-pip--unknown {
		border: 1px dashed var(--line-edge);
	}
	/* Sized, not scaled: a transform on a painted dot is what the sub-pixel
	   law warns about. */
	.fp-pip--absent {
		width: 4px;
		height: 4px;
		margin: 4px;
		background: var(--line-soft);
	}
	.fp-dots {
		display: flex;
		gap: 1px;
		height: 3px;
	}
	.fp-dot {
		width: 3px;
		height: 3px;
		border-radius: var(--r-round);
		background: var(--muted);
	}
</style>
