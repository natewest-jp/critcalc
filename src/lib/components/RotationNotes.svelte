<script lang="ts">
	import { resolve } from '$app/paths';
	import { elementPalette } from '$lib/utils/elementColors';
	import type { SlotCaveatEntry } from '$lib/timeline/slotCaveats';

	// ---------------------------------------------------------------------------
	// THE NOTES COLUMN — the caveats of the kits in the four slots: what the
	// timeline draws but cannot say, in the player-facing voice (see
	// docs/curation/caveat-style-guide.md).
	//
	// ↻ ASIDE-COLUMN ROUND 2026-08-08: this was ~50 lines inside RotationTimeline
	// — an absolute panel pinned over the track area, with a matching
	// `margin-right` on the tracks faking the push. It is the surface's ASIDE
	// COLUMN now (see $lib/toolColumns.ts): a box of its own beside the timeline
	// box, so the whole instrument narrows together. That also settles a wart the
	// old arrangement had by construction — the ruler strip sat ABOVE the pushed
	// row, kept its full width, and drew ticks for time the narrowed track
	// viewport could no longer reach.
	//
	// The entries are computed by the planner page (collectSlotCaveats): band B's
	// Notes button has to know whether any exist before this component exists to
	// tell it.
	// ---------------------------------------------------------------------------

	// ⛔ `showAuraNote` and the AURA_NOTES block RETIRED (2026-08-17). "How the
	// aura is modelled" moved to the head of the aura LOG (see the planner page),
	// which is where ⚓ Nate put it the moment that column existed — and it is the
	// better home for the same reason the note gave for being here at all: the
	// limits belong beside the picture. The log IS the aura's data, so the caveat
	// now sits on top of the thing it qualifies rather than beside a chart in a
	// panel about somebody's kit.
	// ⚠ The lines themselves moved verbatim, along with their "no line without a
	// source in the code" rule. ⛔ Don't re-add an aura block here.
	// ⚓ Coverage links (coverage round Phase 4, ⚓ Nate 2026-09-23): each
	// character's notes end in a link to their row on /coverage, and the panel
	// ends in one for the whole team — the only way to reach a slot whose kit
	// carries no caveat, since such a character has no entry here at all.
	let { entries, teamIds = [] }: { entries: SlotCaveatEntry[]; teamIds?: string[] } = $props();
</script>

<div class="rp-caveat-panel">
	{#each entries as entry (entry.id)}
		<div class="rp-caveat-char">
			<div class="rp-caveat-char-name" style:color={elementPalette(entry.element).main}>
				{entry.displayName}
			</div>
			{#each entry.caveats as item, ci (ci)}
				<div class="rp-caveat-item">
					<span class="rp-caveat-ability"
						><span class="rp-caveat-kind">{item.kind}</span>{item.name}</span
					>
					<p class="rp-caveat-text">{item.caveat}</p>
				</div>
			{/each}
			<a class="rp-coverage-link" href="{resolve('/coverage')}?c={entry.id}">Coverage</a>
		</div>
	{/each}
	{#if teamIds.length > 1}
		<a class="rp-coverage-link rp-coverage-team" href="{resolve('/coverage')}?c={teamIds.join(',')}"
			>Coverage for this team</a
		>
	{/if}
</div>

<style>
	/* Fills the aside box and scrolls inside it — the box's height is the main
	   column's, so long caveats scroll in place and can never grow the tool. */
	.rp-caveat-panel {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.rp-caveat-char {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.rp-caveat-char-name {
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-widest);
		text-transform: uppercase;
	}
	/* ⛔ `.rp-aura-note` retired with the block it painted — see the script. */
	.rp-caveat-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.rp-caveat-ability {
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		color: var(--muted);
		letter-spacing: var(--ls-mid);
	}
	.rp-caveat-kind {
		display: inline-block;
		margin-right: 6px;
		padding: 0 4px;
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		font-size: var(--fs-sm);
		text-transform: uppercase;
		letter-spacing: var(--ls-widest);
		opacity: 0.8;
	}
	.rp-coverage-link {
		align-self: flex-start;
		font-size: var(--fs-sm);
		color: var(--muted);
		text-decoration-color: color-mix(in srgb, currentColor 40%, transparent);
		text-underline-offset: 0.2em;
		transition: color var(--t-snap);
	}
	.rp-coverage-link:hover {
		color: var(--text);
	}
	.rp-coverage-team {
		margin-top: 2px;
		padding-top: 10px;
		border-top: 1px solid var(--border);
		align-self: stretch;
	}
	.rp-caveat-text {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--text);
		line-height: var(--lh-normal);
		opacity: 0.75;
	}
</style>
