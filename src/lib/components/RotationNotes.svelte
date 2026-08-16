<script lang="ts">
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

	let { entries, showAuraNote = false }: { entries: SlotCaveatEntry[]; showAuraNote?: boolean } =
		$props();

	// ══ HOW THE AURA IS MODELLED (gauge round L6) ═════════════════════════════
	//
	// ⚓ THE LIMITS BELONG BESIDE THE PICTURE, NOT IN A CHANGELOG. The target-aura
	// lane is the first thing in the planner that makes a claim about the enemy,
	// and a gauge chart is exactly the kind of surface a reader trusts further
	// than it deserves. This is the standing note that says where it stops.
	//
	// ⚠️⚠️ RE-DERIVED FROM THE CODE, NOT COPIED. The round's own plan (§5, written
	// at L3) listed "no hyperbloom/burgeon core modelling" — which stopped being
	// true at L5b, when dendro cores landed in `gauge.ts` with a real spawn delay
	// and lifetime. A stale honesty note is worse than none: it under-claims in
	// public while the code has moved on, and a reader who checks once and finds
	// it wrong stops believing the rest of it.
	//
	// ⛔ Do not add a line here without a source in the code. Each of these is
	// one:
	//   one enemy          — `gauge.ts` carries a single `ModState`
	//   nothing back       — no path applies an aura the enemy owns
	//   no Shatter         — `sim/reactionBridge.ts` leaves it unemitted
	//   nominal schedule   — `application[]`'s contract C4 (types/ability.ts)
	//   one hit per swing  — the hit stream's documented approximation
	//   1U default         — `DEFAULT_UNITS` in `sim/aura.ts`, and what the
	//                        lane's yellow-footed ticks mark
	const AURA_NOTES = [
		'One enemy, and it never applies an element back at you — so no Pyro from a Blazing Axe Mage, and no auras you did not put there.',
		'Hits land on their listed timing. A swing that hits several times counts as one application, and Shatter is not modelled.',
		'A tick marked in yellow means we are using a default gauge strength of 1U for that hit rather than a measured one.'
	];
</script>

<div class="rp-caveat-panel">
	{#if showAuraNote}
		<div class="rp-caveat-char rp-aura-note">
			<div class="rp-caveat-char-name">How the aura is modelled</div>
			{#each AURA_NOTES as note (note)}
				<p class="rp-caveat-text">{note}</p>
			{/each}
		</div>
	{/if}
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
		</div>
	{/each}
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
	/* ⚠ It is a STANDING note, not a character's, so it takes the panel's
	   neutral ink rather than an element hue — every other heading here is a
	   character name painted its element, and borrowing one would say this
	   belongs to someone. The rule under it is what separates the two kinds. */
	.rp-aura-note {
		padding-bottom: 12px;
		border-bottom: 1px solid var(--frame-line);
	}
	.rp-aura-note .rp-caveat-char-name {
		color: var(--muted);
	}
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
	.rp-caveat-text {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--text);
		line-height: var(--lh-normal);
		opacity: 0.75;
	}
</style>
