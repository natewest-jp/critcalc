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
	 *   border (the per-tool ctx flip retired with the ribbon round).
	 * - `mode` is the tool the ribbon is (or is becoming) docked to. It sets
	 *   the card heights (planner: coupled to the timeline's published slot
	 *   metrics; TB: the even resting rhythm) and the ⇄ action's meaning
	 *   (audition on the TB; open the Source on the planner).
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
		RIBBON_BORDER,
		RIBBON_W
	} from '$lib/benchBand.svelte';
	import { constellations, loadout, type LoadoutEntry } from '$lib/stores';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';

	let {
		mode,
		traveling = false,
		travelMs = 0,
		travelEase = 'ease'
	}: {
		/** The tool the band is docked to (or traveling toward). */
		mode: 'rp' | 'tb' | null;
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

<!-- The RIBBON: a self-contained box with its own ground, border and radius —
     ONE identity in both tools (always the dark context; the per-tool ctx
     flip retired with the frame-zone model). The tool frames are loose
     siblings tucked under its edges. Interior styling is interim — the card
     redesign (Nate's mockup) is its own follow-up round. -->
<div
	class="bb ctx-dark"
	style:width="{RIBBON_W}px"
	style:padding="{RIBBON_PAD}px"
	style:border-width="{RIBBON_BORDER}px"
	style:--bb-height-transition={traveling ? `height ${travelMs}ms ${travelEase}` : 'none'}
>
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
	/* The ribbon box: its OWN surface — the dark context's panel ground, a
	   frame-line border and the 9px radius — one identity everywhere. Width,
	   padding and border-width come inline from the RIBBON_* knobs so the dock
	   math and the box always agree. INTERIM styling: the mockup's interior
	   (ringed portrait, chip row) is the follow-up card round's. */
	.bb {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		background: var(--frame-bg);
		border-style: solid;
		border-color: var(--frame-line);
		border-radius: 9px;
	}

	.bb-slot {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex-shrink: 0;
		box-sizing: border-box;
		transition: var(--bb-height-transition, none);
	}
	/* Dividers between cards only — the ribbon's own bottom chrome closes the
	   box (no trailing separator toward lane labels; the ribbon is
	   self-contained now). Borders paint INSIDE the border-box heights, so
	   card k's top stays at the cumulative sum the track groups use. */
	.bb-slot + .bb-slot {
		border-top: 1px solid var(--frame-line);
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
		border-color: color-mix(in srgb, var(--el) 45%, var(--frame-line));
		color: var(--text);
	}
	.bb-act--remove:hover {
		border-color: color-mix(in srgb, var(--ui-danger) 55%, var(--frame-line));
		color: color-mix(in srgb, var(--ui-danger) 45%, var(--text));
	}
</style>
