<script lang="ts">
	/**
	 * BenchBand — THE bench RIBBON: a self-contained box holding the four slot
	 * cards of the working team, rendered ONCE at the (tools) layout level and
	 * docked over each tool's [data-bench-anchor] (planner LEFT, Team Builder
	 * RIGHT — the tool frames tuck beneath its edges as loose siblings). The
	 * layout owns its position and travel; this component owns its content.
	 *
	 * - The team is the shared working team (rotationTabs.slots — the
	 *   planner's active tab). Constellation/loadout edits here ALWAYS write
	 *   Layer 2 (the tab's overrides): the bench is the plan's team editor in
	 *   both tools. The TB roster grid + Detail card remain the Layer-1
	 *   editors.
	 * - ONE identity everywhere: always the dark context, its own ground and
	 *   double frame (the per-tool ctx flip retired with the ribbon round).
	 * - `mode` is the tool the ribbon is (or is becoming) docked to. It sets
	 *   the card heights (planner: coupled to the timeline's published slot
	 *   metrics; TB: the even resting rhythm) and the ⇄ action's meaning
	 *   (audition on the TB; open the Source on the planner).
	 * - `height` is MEASURED by the layout from the dock, which stretches with
	 *   its tool frame (tall-bench round): the strip spans the frame and stands
	 *   RIBBON_OVERHANG_Y proud at both ends. The cards keep their track-group
	 *   alignment at the top (RIBBON_HEAD below the strip's interior top) and
	 *   the tail beneath them is deliberately empty — a container slightly
	 *   taller than its contents.
	 * - Height changes animate only while `traveling` (the layout flips it for
	 *   the pan's duration, passing the shared clock in) — mid-session metric
	 *   changes on the planner snap, so cards never lag their track groups.
	 */
	import SlotPortrait from '$lib/components/SlotPortrait.svelte';
	import { rotationTabs as rt } from '$lib/rotationTabs.svelte';
	import {
		benchBand,
		BENCH_SLOT_H,
		RIBBON_PAD,
		RIBBON_EDGE,
		RIBBON_FRAME_BORDER,
		RIBBON_DIVIDER_H,
		RIBBON_FRAME_R_TIGHT,
		RIBBON_FRAME_R_WIDE,
		RIBBON_RADIUS,
		RIBBON_CHROME,
		RIBBON_HEAD,
		RIBBON_RESTING_H,
		RIBBON_W
	} from '$lib/benchBand.svelte';
	import { constellations, loadout, type LoadoutEntry } from '$lib/stores';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';

	let {
		mode,
		height = 0,
		traveling = false,
		travelMs = 0,
		travelEase = 'ease'
	}: {
		/** The tool the band is docked to (or traveling toward). */
		mode: 'rp' | 'tb' | null;
		/** The strip's full height, measured by the layout from the dock (the
		 *  tool frame + RIBBON_OVERHANG_Y at each end). 0 = not yet measured;
		 *  the resting height carries the first paint. */
		height?: number;
		/** True for the duration of a tool pan — heights animate on the shared
		 *  clock; at rest they snap with the timeline. */
		traveling?: boolean;
		travelMs?: number;
		travelEase?: string;
	} = $props();

	// Card heights: coupled to the planner's published slot metrics while the
	// planner is (or is becoming) the docked tool; the even resting rhythm
	// everywhere else. borders paint inside these border-box heights.
	const heights = $derived(
		mode === 'rp' && benchBand.slotHeights
			? benchBand.slotHeights
			: [BENCH_SLOT_H, BENCH_SLOT_H, BENCH_SLOT_H, BENCH_SLOT_H]
	);

	// The strip spans its tool frame (+ the overhang at each end) — but never
	// shrinks below its own cards. On a short viewport the Team Builder's frame
	// is viewport-fit and can be shorter than four cards; clamping to it would
	// slice the fourth card off inside the frame. Standing proud of a short
	// tool is exactly what this strip is for.
	const contentH = $derived(2 * RIBBON_CHROME + RIBBON_HEAD + heights.reduce((a, b) => a + b, 0));
	const boxH = $derived(Math.max(height || RIBBON_RESTING_H, contentH));

	// Resolved card characters. Index entries satisfy SlotPortrait's SlotChar
	// shape and are available eagerly (no payload wait). A 'blank' slot shows
	// the generic Blank card only where the notation actually casts it
	// (planner metrics say so); everywhere else it's an empty add-slot.
	const chars = $derived(
		rt.slots.map((id, i) => {
			if (id === 'blank') {
				return mode === 'rp' && benchBand.blankUsed[i]
					? (getCharacterIndexEntry('blank') ?? null)
					: null;
			}
			return getCharacterIndexEntry(id) ?? null;
		})
	);

	// Effective (Layer-2 ⇒ Layer-1) display values — the planner column's rule,
	// now the bench's rule everywhere.
	function effectiveCon(id: string): number {
		return rt.tabCon[id] ?? $constellations[id] ?? 0;
	}
	function effectiveLoadout(id: string): LoadoutEntry {
		return { ...($loadout[id] ?? {}), ...(rt.tabLoadout[id] ?? {}) };
	}

	// Discriminated host views — the ternaries narrow the union for TS.
	const rpHost = $derived(benchBand.host?.tool === 'rp' ? benchBand.host : null);
	const tbHost = $derived(benchBand.host?.tool === 'tb' ? benchBand.host : null);

	function portraitClickFor(char: { id: string; displayName: string } | null) {
		if (mode === 'rp' && rpHost) return rpHost.onPortraitClick;
		if (mode === 'tb' && tbHost && char && char.id !== 'blank') {
			const h = tbHost;
			const id = char.id;
			return () => h.onOpenDetail(id);
		}
		return undefined;
	}
</script>

<!-- The RIBBON: a self-contained STRIP with its own ground, double frame and
     radius — ONE identity in both tools (always the dark context; the
     per-tool ctx flip retired with the frame-zone model). The tool frames are
     loose siblings tucked under its edges, and it stands proud of them at top
     and bottom. Interior styling is interim — the card redesign (Nate's
     mockup) is its own follow-up round. -->
<div
	class="bb ctx-dark"
	style:width="{RIBBON_W}px"
	style:height="{boxH}px"
	style:padding="{RIBBON_CHROME + RIBBON_HEAD}px {RIBBON_CHROME}px {RIBBON_CHROME}px"
	style:border-radius="{RIBBON_RADIUS}px"
	style:--bb-pad="{RIBBON_PAD}px"
	style:--bb-frame-inset="{RIBBON_EDGE}px"
	style:--bb-frame-border="{RIBBON_FRAME_BORDER}px"
	style:--bb-divider-h="{RIBBON_DIVIDER_H}px"
	style:--bb-frame-r-tight="{RIBBON_FRAME_R_TIGHT}px"
	style:--bb-frame-r-wide="{RIBBON_FRAME_R_WIDE}px"
	style:--bb-height-transition={traveling ? `height ${travelMs}ms ${travelEase}` : 'none'}
>
	<!-- The double frame: two strokes on ONE box, differing only in corner
	     radius, so the wide arc cuts across the tight corner (Nate's mockup).
	     Pseudo-elements, not wrappers — they must not affect the card column's
	     box, and the strip has to clip them at its own rounded edge. -->
	<span class="bb-frame bb-frame--tight" aria-hidden="true"></span>
	<span class="bb-frame bb-frame--wide" aria-hidden="true"></span>
	{#each rt.slots as _id, i (i)}
		{@const char = chars[i]}
		<div class="bb-slot" style:height="{heights[i]}px">
			<SlotPortrait
				slotId={char ? char.id : 'blank'}
				{char}
				conLevel={char ? effectiveCon(char.id) : 0}
				loadoutEntry={char ? effectiveLoadout(char.id) : {}}
				onSetCon={(level) => char && rt.setTabCon(char.id, level)}
				onSetArtifact={(artId) => char && rt.setTabLoadout(char.id, { artifactSetId: artId })}
				onSetWeapon={(wid, ref) =>
					char && rt.setTabLoadout(char.id, { weaponId: wid, weaponRefinement: ref })}
				onSetRefinement={(r) => char && rt.setTabLoadout(char.id, { weaponRefinement: r })}
				onPortraitClick={portraitClickFor(char)}
				portraitLabel={mode === 'tb' && char ? `Open ${char.displayName}` : undefined}
				emptyLabel=""
			>
				{#snippet actions()}
					{#if char && char.id !== 'blank'}
						<!-- Uniform action set (Nate 2026-08-05): ✕ removes everywhere;
						     ⇄ auditions on the TB but opens the character Source on the
						     planner (stays in-tool). SlotPortrait pins the first action
						     to the pill's left and the last to its right
						     (display:contents + order). -->
						<button
							class="bb-act"
							onclick={() =>
								char &&
								(mode === 'rp' ? rpHost?.onPortraitClick() : tbHost?.onAudition(i, char.id))}
							title={mode === 'rp'
								? 'Change who fills this slot'
								: `Compare ${char.displayName} against replacements`}
							aria-label={mode === 'rp'
								? 'Change who fills this slot'
								: `Audition replacements for ${char.displayName}`}>⇄</button
						>
						<button
							class="bb-act bb-act--remove"
							onclick={() => rt.setSlot(i, null)}
							title="Remove {char.displayName} from team"
							aria-label="Remove {char.displayName} from team">✕</button
						>
					{/if}
				{/snippet}
			</SlotPortrait>
		</div>
	{/each}
</div>

<style>
	/* The ribbon box: its OWN surface — the dark context's panel ground and
	   radius — one identity everywhere. Width, height, padding and radius come
	   inline from the RIBBON_* knobs so the dock math and the box always agree.
	   The ground carries NO stroke of its own (the mockup's outer "border" is
	   the ground's edge against whatever it floats over); the two strokes below
	   are the frame. overflow:hidden keeps a card column that outgrows a short
	   frame inside the strip — SlotPortrait's popovers are position:fixed and
	   escape it. INTERIM styling: the mockup's interior (ringed portrait, chip
	   row) is the follow-up card round's. */
	.bb {
		position: relative;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		background: var(--frame-bg);
		overflow: hidden;
		transition: var(--bb-height-transition, none);
	}

	/* The two frame strokes: same box, same inset, same color — only the corner
	   radius differs, which is the whole trick. They sit ABOVE the ground and
	   BELOW the cards (the cards start RIBBON_PAD inside them, so nothing
	   overlaps in practice). */
	.bb-frame {
		position: absolute;
		inset: var(--bb-frame-inset);
		border: var(--bb-frame-border) solid var(--frame-line-quiet);
		pointer-events: none;
	}
	.bb-frame--tight {
		border-radius: var(--bb-frame-r-tight);
	}
	.bb-frame--wide {
		border-radius: var(--bb-frame-r-wide);
	}

	.bb-slot {
		position: relative;
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex-shrink: 0;
		box-sizing: border-box;
		transition: var(--bb-height-transition, none);
	}
	/* Dividers between cards only — the strip's own frame closes the box (no
	   trailing separator; the ribbon is self-contained). Drawn as a pseudo so
	   it can run the full width INSIDE the frame (the mockup's shelf line,
	   wider than the card) while taking no height: card k's top has to stay at
	   the cumulative sum the planner's track groups use. */
	.bb-slot + .bb-slot::before {
		content: '';
		position: absolute;
		top: 0;
		left: calc(-1 * var(--bb-pad));
		right: calc(-1 * var(--bb-pad));
		height: var(--bb-divider-h);
		background: var(--frame-line-quiet);
	}

	/* Slot actions (audition/remove) — the card's shared capsule treatment at
	   the pill's own height; glyph-only, title/aria carry the meaning. Moved
	   from the TB Bench with the cards. */
	.bb-act {
		box-sizing: border-box;
		flex-shrink: 0;
		width: var(--sp-pill-h);
		height: var(--sp-pill-h);
		display: grid;
		place-items: center;
		padding: 0;
		border: var(--sp-pill-border);
		border-radius: var(--r-round);
		background: var(--sp-pill-fill);
		color: var(--muted);
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		line-height: var(--lh-none);
		cursor: pointer;
		transition:
			border-color 150ms ease,
			background 150ms ease,
			color 150ms ease;
	}
	.bb-act:hover {
		border-color: color-mix(in srgb, var(--el) 45%, var(--frame-line-quiet));
		color: var(--text);
	}
	.bb-act--remove:hover {
		border-color: color-mix(in srgb, var(--ui-danger) 55%, var(--frame-line));
		color: color-mix(in srgb, var(--ui-danger) 45%, var(--text));
	}
</style>
