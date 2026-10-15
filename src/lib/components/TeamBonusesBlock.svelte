<!--
	src/lib/components/TeamBonusesBlock.svelte

	Always-on bonuses caption for the rotation planner — a quiet footnote strip
	directly below the timeline frame (the per-character ability panels it once
	column-aligned with are gone). Shows team-wide faction states and each
	character's permanent (`trigger.type === 'passive'`) bonuses as chips.

	Speaks the frame's language: a right-aligned micro-label in the label-rail
	position (echoing the TEAM BUFFS lane labels), chips flowing where the
	tracks start, and per-chip ELEMENT stripes for ownership — the same
	element-color identity the timeline bars use. Only renders when there is
	something to show.

	↻ 2026-08-11: THE RAIL IS GONE and so is the geometry that justified it. This
	block used to hang below the whole tool stack, where it kept the CONTENT
	MARGIN and reserved a right-aligned label column derived from TOOL_INSET, so
	its chips could land on the frame's left edge. It renders INSIDE the timeline
	now (⚓ Nate — between the lanes and the notation field), so its host does the
	insetting and the label just starts at the lane names' x. One less derived
	number, and it can no longer drift when the bench strip's geometry moves —
	which is exactly what it did on 2026-08-06.
-->
<script lang="ts">
	import { getLoadedCharacter } from '$lib/data/characterData';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';
	import { deriveResonances, type Resonance } from '$lib/utils/resonance';
	import { elementPalette } from '$lib/utils/elementColors';
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import type { CharacterData } from '$lib/types/character';
	import type { Ability, Effect } from '$lib/types/ability';
	import type { MergedEffectDisplay } from '$lib/timeline/types';
	import {
		formatBuffDisplayValue,
		formatResShredDisplayValue,
		resShredDisplayStat
	} from '$lib/timeline/buffDisplay';
	import BuffTooltip, { type BuffTooltipData } from '$lib/components/BuffTooltip.svelte';
	import { computeTeamFactionCounts, computeHolderElementCounts } from '$lib/utils/teamComposition';
	import { DEFAULT_ASCENSION, evalCondition, type ConditionContext } from '$lib/sim/conditions';

	// `conLevels` is the TAB's effective map (roster under the tab's Layer-2
	// overrides), the one the timeline simulates and the bench shows.
	let { slots, conLevels }: { slots: string[]; conLevels: Record<string, number> } = $props();

	// Payloads for the slotted set are loaded by the planner page's $effect;
	// this derived re-runs as each one lands in the reactive cache.
	let chars = $derived(slots.map((id) => getLoadedCharacter(id)));
	let comp = $derived(deriveTeamComposition(chars));

	// Elemental resonance — from the EAGER index (element is an identity
	// field), so resonance badges render before full payloads land. The
	// planner deliberately relaxes the full-party rule: an element pair
	// resonates even beside blank example slots (flexible-slot rotations).
	let resonance = $derived(
		deriveResonances(
			slots.map((id) => getCharacterIndexEntry(id)?.element ?? null),
			{ requireFullParty: false }
		)
	);

	// ⚓ TEAM-SCOPE CONDITIONS ARE EVALUATED HERE (2026-09-19). The chip used to
	// list every passive effect "optimistically", which was tolerable while the
	// only gates were runtime facts the chip cannot know (enemy HP, an aura) —
	// but a PARTY-COMPOSITION gate is a static fact this surface holds in full,
	// and Varka's Dawn Wind's March is a five-rung ladder on exactly that:
	// measured, the chip listed Anemo + Pyro + Hydro + Electro + Cryo in every
	// party where the game grants Anemo plus ONE of the four, and never changed
	// when the party did. So a definitive `false` drops an effect (and a chip
	// left with no effect), while `null` — a condition this surface cannot
	// answer — still lists, the Conditions' optimistic rule. The context
	// mirrors the parser's: faction counts over the whole party, element counts
	// with the HOLDER excluded (`notationParser.ts`).
	let teamFactionCounts = $derived(computeTeamFactionCounts(chars));
	function holderContext(holder: CharacterData): ConditionContext {
		return { teamFactionCounts, teamElementCounts: computeHolderElementCounts(chars, holder.id) };
	}
	/** The always-on effects of one entry that the slotted party does not
	 *  definitively rule out. */
	function liveEffects(holder: CharacterData, entry: Ability, conLevel: number): Effect[] {
		const ctx = holderContext(holder);
		return ((entry.effects ?? []) as Effect[]).filter(
			(fx) =>
				fx.trigger.type === 'passive' &&
				evalCondition(
					fx.conditions,
					DEFAULT_ASCENSION,
					undefined,
					conLevel,
					undefined,
					undefined,
					ctx
				) !== false
		);
	}

	function permanentPassives(char: CharacterData | null, conLevel: number) {
		if (!char) return [];
		return (char.passives ?? []).filter((p) => liveEffects(char, p, conLevel).length > 0);
	}

	/** Constellation entries whose always-on (`trigger: passive`) buff/shred
	 *  effects are unlocked at the slotted constellation level. Scoped to the
	 *  effect types the chip tooltip can display — shield/heal/elevate
	 *  passives (e.g. Kaeya C4's emergency shield, frozen elevate stats)
	 *  stay unlisted. Runtime gates (enemy HP etc.) are NOT evaluated — they
	 *  list optimistically, and each affected character carries a caveat
	 *  saying so; team-scope gates ARE (see `liveEffects`). */
	function permanentConstellations(char: CharacterData | null, conLevel: number) {
		if (!char) return [];
		return (char.constellations ?? []).filter(
			(c) =>
				c.abilityType === 'constellation' &&
				c.constellationLevel <= conLevel &&
				liveEffects(char, c, conLevel).some((fx) => fx.type === 'buff' || fx.type === 'resShred')
		);
	}

	let permanentByChar = $derived(
		chars.map((c) => {
			const conLevel = c ? (conLevels[c.id] ?? 0) : 0;
			return [...permanentPassives(c, conLevel), ...permanentConstellations(c, conLevel)];
		})
	);

	let hasFactionBadges = $derived(comp.hasAscendantGleam || comp.hasSecretRite);
	let hasPermanentBonuses = $derived(permanentByChar.some((p) => p.length > 0));
	let visible = $derived(resonance.active.length > 0 || hasFactionBadges || hasPermanentBonuses);

	// ── Chip hover tooltip — same detail rows as the timeline's buff bars ──

	/** The chip's always-on effects, formatted for the shared tooltip — the
	 *  ones the slotted party does not rule out. */
	function chipEffects(holder: CharacterData, bonus: Ability): MergedEffectDisplay[] {
		const out: MergedEffectDisplay[] = [];
		for (const fx of liveEffects(holder, bonus, conLevels[holder.id] ?? 0)) {
			if (fx.type === 'buff') {
				out.push({
					stat: fx.stat,
					displayValue: formatBuffDisplayValue(fx.stat, fx.value, 0, undefined)
				});
			} else if (fx.type === 'resShred') {
				out.push({
					stat: resShredDisplayStat(fx.element, fx.shredStat),
					displayValue: formatResShredDisplayValue(fx.value)
				});
			}
		}
		return out;
	}

	let tooltip = $state<BuffTooltipData | null>(null);

	function showChipTooltip(
		e: MouseEvent,
		holder: CharacterData,
		bonus: Ability,
		ownerName: string | undefined
	) {
		const effects = chipEffects(holder, bonus);
		if (effects.length === 0) return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const above = rect.top > 80;
		tooltip = {
			sourceLabel: ownerName ? `${ownerName} · ${bonus.name}` : bonus.name,
			effects,
			x: rect.left + rect.width / 2,
			y: above ? rect.top - 6 : rect.bottom + 6,
			above
		};
	}

	function hideChipTooltip() {
		tooltip = null;
	}

	function showResonanceTooltip(e: MouseEvent, res: Resonance) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const above = rect.top > 80;
		tooltip = {
			sourceLabel: `${res.label} — Resonance`,
			effects: res.rows,
			x: rect.left + rect.width / 2,
			y: above ? rect.top - 6 : rect.bottom + 6,
			above
		};
	}

	/**
	 * ↻ ⚓ NATE 2026-08-12: THE RESONANCE CHIPS ARE THE TEAM BUILDER'S LEAD PILL
	 * NOW — "elemental icon, same fill, border, and text color."
	 *
	 * They were a one-off: `hi` ink on a 16% wash of `main`, no ring, no icon.
	 * The TB's CoveragePanel already had the settled answer for the same fact —
	 * `.ts-lead-pill`, a 22% ground with a 45% inset ring and `--text` ink — and
	 * two tools stating the same resonance in two different chips is exactly the
	 * drift the shared components exist to stop.
	 *
	 * ⚠ ONE DIFFERENCE, AND IT IS DELIBERATE: no `--r-round`. ⚓ "Let's reserve
	 * that for where it's displayed on the TB." The pill shape is the Coverage
	 * run's idiom; down here the chip sits in a row of square-cornered footnote
	 * chips, and a lozenge among them would read as a control.
	 *
	 * ⚠ `main`, not `bar`. The ground is a 22% WASH and the ring is a LINE —
	 * identity uses, which is the half of the palette `main` owns.
	 */
	function resonanceBadgeStyle(res: Resonance): string {
		const c = res.element ? elementPalette(res.element).main : 'var(--accent)';
		return `--pill-color: ${c};`;
	}
</script>

{#if visible}
	<div class="team-bonuses">
		<span class="tb-key">Always-on buffs</span>
		<div class="tb-flow">
			{#each resonance.active as res (res.key)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<span
					class="faction-badge res-badge"
					style={resonanceBadgeStyle(res)}
					onmouseenter={(e) => showResonanceTooltip(e, res)}
					onmouseleave={hideChipTooltip}
				>
					{#if res.element}
						<img class="res-badge-icon" src={elementIcon(res.element)} alt="" />
					{/if}{res.label}</span
				>
			{/each}
			{#if comp.hasAscendantGleam}
				<span class="faction-badge faction-badge--moonsign">Moonsign: Ascendant Gleam</span>
			{/if}
			{#if comp.hasSecretRite}
				<span class="faction-badge faction-badge--hexerei">Hexerei: Secret Rite</span>
			{/if}
			{#each permanentByChar as bonuses, ci (ci)}
				{@const owner = chars[ci]}
				{#each bonuses as bonus, bi (bi)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<span
						class="bonus-chip"
						style:border-left-color={elementPalette(owner?.element).main}
						onmouseenter={(e) => owner && showChipTooltip(e, owner, bonus, owner.displayName)}
						onmouseleave={hideChipTooltip}
						>{#if owner?.displayName}<span class="bonus-chip-owner">{owner.displayName}:&nbsp;</span
							>{/if}{bonus.name}</span
					>
				{/each}
			{/each}
		</div>

		{#if tooltip}
			<BuffTooltip tip={tooltip} />
		{/if}
	</div>
{/if}

<style>
	/* Frameless caption row — no panel box; the strip is a footnote to the
	   instrument above it, not a sibling surface. */
	.team-bonuses {
		display: flex;
		align-items: baseline;
		gap: 10px;
		font-family: var(--font-body);
	}

	/* ↻ ⚓ NATE 2026-08-11: THE LABEL RAIL IS GONE. It was a fixed-width,
	   RIGHT-aligned column (--tb-key-w) whose text landed KEY_INSET short of the
	   tracks' start — an alignment that made sense while this strip hung below
	   the whole tool stack. It sits inside the timeline now, between the lanes
	   and the notation field, so it lines up with the LANE NAMES instead: the
	   host pads it to their x (.rp-underchart) and the key simply starts there.
	   ⚠ Everything else already matched them — size, weight, tracking, uppercase
	   — so the only other change is the ink: --muted → --chart-dim, the chart's
	   receding voice, which is what "match its opacity/font-colour to the Team
	   Buffs" means. It now reads as one more lane label at the bottom of the
	   stack, which is exactly what it is. */
	.tb-key {
		flex-shrink: 0;
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-widest);
		text-transform: uppercase;
		color: var(--chart-dim);
		line-height: var(--lh-snug);
	}

	.tb-flow {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 6px;
		min-width: 0;
	}

	/* Solid tinted fills — team-state chips, not hollow outlines. */
	.faction-badge {
		display: inline-flex;
		align-items: center;
		padding: 3px 8px;
		border-radius: 3px;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}

	/* ── The resonance chip = the Team Builder's .ts-lead-pill ────────────────
	   ⚓ NATE 2026-08-12. Ground, ring and ink are CoveragePanel's numbers
	   verbatim (22% / 45% / --text) so the two tools cannot state the same
	   resonance two ways. ⚠ Everything except the RADIUS: --r-round stays the
	   Coverage run's alone.
	   ⚠ The values are duplicated rather than shared because there is no chip
	   component yet and one recipe in two files is cheaper than the wrong
	   abstraction — but they are a PAIR. If the TB's move, these move. */
	.res-badge {
		gap: 0.3rem;
		padding-left: 5px;
		background: color-mix(in srgb, var(--pill-color) 22%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pill-color) 45%, transparent);
		color: var(--text);
		cursor: help;
	}
	/* Protective Canopy has no element, so nothing leads it and the left inset
	   goes back to the plain one — same rule the TB's pill carries. */
	.res-badge:not(:has(.res-badge-icon)) {
		padding-left: 8px;
	}
	/* 15, not the TB's 17: this strip runs at --fs-sm where Coverage runs at
	   --fs-md, and the glyph tracks the words it sits with. */
	.res-badge-icon {
		width: 15px;
		height: 15px;
		flex-shrink: 0;
	}

	.faction-badge--moonsign {
		color: #b8d2f2;
		background: rgba(168, 200, 240, 0.14);
	}

	.faction-badge--hexerei {
		color: #ccb0e6;
		background: rgba(192, 160, 224, 0.14);
	}

	/* Per-character permanent bonus chip — ownership via the 2px element
	   stripe (the same element-color identity the timeline bars carry).
	   A chip wider than its column WRAPS rather than running off it: at 320
	   "Xingqiu: Blades Amidst Raindrops" ran 26px past the screen's edge
	   beside the key. A block (not a flex box), so the owner prefix and the
	   buff name flow as ONE text run; the owner's &nbsp; keeps "Name: First"
	   together. A chip that fits is unchanged. */
	.bonus-chip {
		display: inline-block;
		max-width: 100%;
		padding: 2px 6px 3px;
		border-radius: 0 3px 3px 0;
		border-left: 2px solid transparent;
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		background: var(--fill-rest);
		color: var(--muted);
	}

	/* Owner prefix ("Name: ") — the same brighter register the chip's element
	   stripe already carries, so the character reads as the chip's subject and
	   the buff name stays the primary term. */
	.bonus-chip-owner {
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
</style>
