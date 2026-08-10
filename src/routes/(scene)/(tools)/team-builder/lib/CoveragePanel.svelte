<script lang="ts">
	import Mark from '$lib/components/Mark.svelte';
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';
	import { deriveCoverage, deriveResonances } from './team';
	import type { FacetKey } from './facets';
	import type { CharacterIndexEntry } from '$lib/types/character';

	let {
		members,
		conCapOf,
		onFilterFacet
	}: {
		/** The working team, slot order preserved; null = an empty slot. */
		members: readonly (CharacterIndexEntry | null)[];
		/** Constellation cap per character under the active con mode. */
		conCapOf: (id: string) => number;
		/** A coverage gap was clicked — drive the Source filter to fill it. */
		onFilterFacet: (facet: FacetKey) => void;
	} = $props();

	const coverage = $derived(deriveCoverage(members, conCapOf));
	const resonance = $derived(deriveResonances(members.map((m) => m?.element ?? null)));
	const comp = $derived(deriveTeamComposition(members));

	const colorOf = (element: string | undefined) =>
		(elementColors[(element ?? 'none') as ElementKey] ?? elementColors.none).main;

	/**
	 * THE LEAD CLUSTER — what the TEAM is, as opposed to what it covers.
	 *
	 * ⚓ NATE 2026-08-09: resonance and the faction buffs move IN with the
	 * capabilities "but just slightly kept distinct from them by always appearing
	 * on the left". They were their own component (TeamFacts) riding the end of
	 * the banner; that banner is a bare header now, with no end to ride.
	 *
	 * ⚠ HOW MANY CAN LAND HERE. Nate's estimate — "two elemental resonances and
	 * two faction buffs … that should probably be the max" — is the right shape
	 * but one short: a four-Natlan party can hold two resonances, Ascendant
	 * Gleam, Secret Rite AND the Nightsoul count, so FIVE is the real ceiling.
	 * The cluster is laid out two-to-a-column for exactly this reason (see the
	 * CSS): it grows sideways, and the block stays two rows tall no matter what.
	 */
	/** `kind` separates the two families inside one cluster: a RESONANCE is an
	 *  elemental fact of the party's composition, a FACT is a faction/count gate.
	 *  They look alike on purpose, but they are not the same claim. */
	type LeadPill = {
		key: string;
		kind: 'res' | 'fact';
		label: string;
		element?: string;
		title?: string;
	};

	const lead = $derived.by(() => {
		const pills: LeadPill[] = [];
		if (!resonance.needsFullTeam) {
			for (const res of resonance.active) {
				pills.push({
					key: res.key,
					kind: 'res',
					label: res.label,
					element: res.element,
					title: res.effect
				});
			}
		}
		if (comp.natlanCount > 0) {
			pills.push({
				key: 'nb',
				kind: 'fact',
				label: `${comp.natlanCount} Natlan`,
				title: 'Nightsoul Burst triggers scale with Natlan members in the team'
			});
		}
		if (comp.hasAscendantGleam) {
			pills.push({
				key: 'gleam',
				kind: 'fact',
				label: 'Ascendant Gleam',
				title: 'Two or more Moonsign characters — the Lunar reactions are enabled'
			});
		}
		if (comp.hasSecretRite) {
			pills.push({
				key: 'rite',
				kind: 'fact',
				label: 'Secret Rite',
				title: 'Two or more Hexerei characters — Hexerei: Secret Rite is enabled'
			});
		}
		return pills;
	});

	function coverageTitle(providers: string[], state: string, label: string): string {
		if (state === 'yes') return `${label} — provided by ${providers.join(', ')}`;
		if (state === 'unknown') return `${label} — unknown (an uncurated kit is in the team)`;
		return `${label} — no slotted character provides this. Click to find one.`;
	}
</script>

<!-- WHAT THE TEAM IS AND WHAT IT COVERS — the tool's thesis object.
     The gaps are FILTER DRIVERS — a `no` chip is a <button> that points the
     roster at whatever would fill it — which is why this wants to be directly
     above the roster rather than tucked into a band. -->
<div class="tb-cover">
	<h2 class="cover-head">Team covers</h2>

	<div class="cover-run">
		{#if lead.length > 0}
			<div class="ts-lead">
				{#each lead as pill (pill.key)}
					<span
						class="ts-pill ts-lead-pill ts-lead-pill--{pill.kind}"
						style:--pill-color={pill.element ? colorOf(pill.element) : 'var(--accent)'}
						title={pill.title}
					>
						{#if pill.element}
							<img class="ts-lead-icon" src={elementIcon(pill.element)} alt="" />
						{/if}
						{pill.label}
					</span>
				{/each}
			</div>
		{:else if resonance.needsFullTeam}
			<div class="ts-lead">
				<span class="ts-resnote">resonance needs a full party of 4</span>
			</div>
		{/if}

		<div class="ts-coverage">
			{#each coverage as c (c.facet)}
				{#if c.state === 'no'}
					<button
						class="ts-pill ts-cov ts-cov--no"
						title={coverageTitle(c.providers, c.state, c.label)}
						onclick={() => onFilterFacet(c.facet)}>{c.label} <Mark name="close" size={12} /></button
					>
				{:else}
					<span
						class="ts-pill ts-cov ts-cov--{c.state}"
						title={coverageTitle(c.providers, c.state, c.label)}
						>{c.label}
						{#if c.state === 'yes'}<Mark name="check" size={12} />{:else}?{/if}</span
					>
				{/if}
			{/each}
		</div>
	</div>
</div>

<style>
	/* ↻ ⚓ NATE 2026-08-09: NO BANNER EITHER. This was a banner — a narrow filled
	   strip naming a bare run — and it is now a HEADER SET DIRECTLY ON THE
	   SCENE. It is the first surface to try that, and it is the reason the
	   heading face moved back to Bitter this round: a header out here carries no
	   box to lend it presence, so it has to carry its own. */
	.tb-cover {
		display: flex;
		flex-direction: column;
		/* ⚓ NATE 2026-08-10 — "just enough to let them breathe". Two moves, not
		   one: the block gets air ABOVE and BELOW itself (padding-block, so the
		   header clears band B rather than hanging off it), and the header gets
		   air under it before the chips. A run of pills on open ground reads as
		   crowded long before a boxed one does — there is no edge doing the work
		   that space has to do here. */
		padding-block: 0.5rem 0.75rem;
		gap: 1rem;
		/* ⚠ CONTENT HEIGHT. This was `flex: 1` back when it sat in a ROW beside
		   TeamFacts; as a full-width child of the stack's COLUMN the same
		   declaration grew it vertically instead, swallowing 175px of nothing
		   between the chips and the Atlas. The axis changed under the property. */
		flex: 0 0 auto;
		min-width: 0;
	}

	/* ⚠ ON THE SCENE, PROSE TAKES THE BRIGHT INK, and a heading all the more:
	   --text, not --muted. The dim rung is a panel affordance and there is no
	   panel here.

	   ↻ ⚓ NATE 2026-08-10: it is a SECTION HEADING (4xl), not a page title. The
	   uniform size-up carried it to 5xl along with everything else, and 5xl is
	   the page-title rung — this names one block on a tool surface, not the
	   tool. It is still a full step above anything else in the run, which was
	   always the actual requirement. */
	.cover-head {
		margin: 0;
		text-align: center;
		font-family: var(--font-display);
		font-size: var(--fs-4xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: var(--text);
	}

	/* The lead cluster and the capability run, side by side and centred as one
	   block. The gap between them is deliberately ~3× the gap WITHIN either —
	   that is the whole of "kept distinct", and it needs no rule, no ground and
	   no divider to do its job.

	   ⚠ THE MEASURE IS CAPPED, and this is the one place on the surface where
	   that is right (⚓ Nate 2026-08-10, who measured it at ~1000px). Everything
	   else here fills the column, but fifteen chips given 1600px stop being a
	   block and become a rule across the top of the tool — three or four to a
	   line, four lines deep, nothing clustered. Capped, they hold the two rows
	   they were designed as at every width above the cap, and the block stays
	   under its own centred header instead of running out from under it.
	   ⚠ It is a MAX, not a width: below the cap this shrinks and the run wraps
	   to three rows, which is correct — the alternative is a scrollbar.

	   ↻ ⚓ NATE 2026-08-10, THE SAME DAY: THE CAP MOVED OFF THE RUN AND ONTO THE
	   CAPABILITIES. Nate's 1000px is unchanged and still the number this is built
	   from — but capping the whole ROW meant the lead cluster and the capability
	   run were competing for one measure, and the lead cluster wins, because it
	   is flex-shrink: 0. A third lead pill starts a second lead COLUMN (see
	   .ts-lead), that column ate ~175px of the 1000, and fifteen capability chips
	   with 175px less went to three rows — the exact thing the cap exists to
	   prevent, triggered by a change on the other side of the gap.

	   So the capabilities now hold their own measure (--cover-measure minus one
	   lead column and the gap) no matter how wide the cluster beside them gets,
	   and the ROW grows past 1000px instead of squeezing them. At one lead column
	   this is pixel-for-pixel what shipped; at two or three the block simply gets
	   wider, which is what there is room for at these viewports. Narrow screens
	   are unaffected: a max-width does not stop a flex item shrinking, so the run
	   still wraps to three rows when the column genuinely cannot hold two. */
	.cover-run {
		--cover-measure: 1000px;
		/* 🎛️ One column of lead pills, at the width the longest of them takes —
		   "Sprawling Greenery" with its element icon, the widest label either
		   family can produce. A RESERVATION, not a width: the cluster is still
		   sized by its own content, and this only decides how much of the measure
		   the capabilities keep. Raise it and the capability run narrows (and will
		   eventually go to three rows on its own); lower it and the run widens. */
		--lead-column: 175px;
		--cover-gap: 1.1rem;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: var(--cover-gap);
		min-width: 0;
	}

	/* ⚠ TWO ROWS, THEN A NEW COLUMN — never a third row. `grid-auto-flow: column`
	   with two explicit rows fills top-to-bottom and then moves right, so one
	   lead pill is one cell, two stack, and three-to-five become a second column.
	   A plain wrapping row would put a fifth pill on a third line and make the
	   whole block taller than the fifteen capabilities beside it. */
	.ts-lead {
		display: grid;
		grid-auto-flow: column;
		grid-template-rows: repeat(2, auto);
		align-content: start;
		justify-items: start;
		gap: 0.35rem;
		flex-shrink: 0;
	}

	/* Centred like its header (⚓ Nate). With a capped measure the last row is
	   always short, and a short row left-aligned under two full ones is what
	   made this read as a list that ran out rather than as a block.

	   THE MEASURE LIVES HERE now, not on the row — see .cover-run. Fifteen chips
	   in a wrapping flex have a max-content width of one very long line, so
	   without the cap this would ask for the whole column; with it, it takes
	   exactly the space the two-row layout was tuned against and no more. */
	.ts-coverage {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		max-width: calc(var(--cover-measure) - var(--lead-column) - var(--cover-gap));
		min-width: 0;
	}

	/* ⚓ NATE: PILLS (--r-round). One shape for both families — the cluster is
	   distinguished by POSITION and fill, not by silhouette, which is what keeps
	   it reading as part of the same run rather than as a different control. */
	.ts-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.65rem;
		border: none;
		border-radius: var(--r-round);
		font-family: var(--font-body);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		text-transform: uppercase;
		white-space: nowrap;
	}

	/* The lead pills carry their own hue: the element's for a resonance, the
	   accent for a faction fact that has no element behind it. Ground and ring
	   both mix from it, so the cluster is the only coloured thing in the run. */
	.ts-lead-pill {
		padding-left: 0.4rem;
		background: color-mix(in srgb, var(--pill-color) 22%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pill-color) 45%, transparent);
		color: var(--text);
		cursor: help;
	}
	.ts-lead-pill:not(:has(.ts-lead-icon)) {
		padding-left: 0.65rem;
	}
	.ts-lead-icon {
		width: 17px;
		height: 17px;
		object-fit: contain;
		flex: none;
	}
	.ts-resnote {
		font-size: var(--fs-sm);
		font-style: italic;
		color: var(--muted);
	}

	/* COVERED RECEDES, A GAP ANCHORS — the intent is unchanged; the tokens flipped
	   when this run moved from a light panel onto the dark world (2026-08-08). In
	   .ctx-light, --text is the recessive prose ink and --muted the anchoring
	   slate; in .ctx-dark the ladder is the other way up. Kept as-was, the
	   checkmarks shouted and the gaps — the only chips you can click — sank into
	   the scene. So: covered takes the DIM ink and barely any fill; a gap takes
	   the bright ink on an accent wash that reads as a plate against near-black. */
	.ts-cov--yes {
		color: var(--muted);
		background: var(--fill-rest);
		cursor: help;
	}
	.ts-cov--no {
		color: var(--text);
		background: color-mix(in srgb, var(--accent) 16%, transparent);
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	.ts-cov--no:hover {
		color: var(--ink-active);
		background: color-mix(in srgb, var(--accent) 28%, transparent);
	}
	.ts-cov--unknown {
		color: var(--el-geo-main);
		background: color-mix(in srgb, var(--el-geo-main) 8%, transparent);
		cursor: help;
	}
</style>
