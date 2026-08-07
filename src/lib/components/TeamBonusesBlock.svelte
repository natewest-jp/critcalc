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

	⚠ Rail width is DERIVED, never kept in lockstep by hand: the chips start
	where the timeline's tracks start, which is where the bench strip ends
	(TOOL_INSET), less the lane-label text inset. This block deliberately keeps
	the CONTENT MARGIN while the tab bar and frame above it are inset by the
	strip's column — it sits clear of the strip's bottom edge, so its rail can
	use that column and its chips still land on the frame's left edge.
-->
<script lang="ts">
	import { getLoadedCharacter } from '$lib/data/characterData';
	import { TOOL_INSET } from '$lib/benchBand.svelte';

	/** How far the rail's text stops short of the tracks — the lane-label inset
	 *  the timeline's own labels used. */
	const KEY_INSET = 10;
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';
	import { deriveResonances, type Resonance } from '$lib/utils/resonance';
	import { elementPalette } from '$lib/utils/elementColors';
	import type { CharacterData } from '$lib/types/character';
	import type { Ability, Effect } from '$lib/types/ability';
	import type { MergedEffectDisplay } from '$lib/timeline/types';
	import {
		formatBuffDisplayValue,
		formatResShredDisplayValue,
		resShredDisplayStat
	} from '$lib/timeline/buffDisplay';
	import { constellations } from '$lib/stores';
	import BuffTooltip, { type BuffTooltipData } from '$lib/components/BuffTooltip.svelte';

	let { slots }: { slots: string[] } = $props();

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

	function permanentPassives(char: CharacterData | null) {
		if (!char) return [];
		return (char.passives ?? []).filter((p) =>
			(p.effects ?? []).some((fx) => fx.trigger.type === 'passive')
		);
	}

	/** Constellation entries whose always-on (`trigger: passive`) buff/shred
	 *  effects are unlocked at the slotted constellation level. Scoped to the
	 *  effect types the chip tooltip can display — shield/heal/elevate
	 *  passives (e.g. Kaeya C4's emergency shield, frozen elevate stats)
	 *  stay unlisted. Conditions on listed effects (enemy-HP gates etc.) are
	 *  NOT evaluated — they list optimistically, and each affected character
	 *  carries a caveat saying so. */
	function permanentConstellations(char: CharacterData | null, conLevel: number) {
		if (!char) return [];
		return (char.constellations ?? []).filter(
			(c) =>
				c.abilityType === 'constellation' &&
				c.constellationLevel <= conLevel &&
				(c.effects ?? []).some(
					(fx) => fx.trigger.type === 'passive' && (fx.type === 'buff' || fx.type === 'resShred')
				)
		);
	}

	let permanentByChar = $derived(
		chars.map((c) => [
			...permanentPassives(c),
			...permanentConstellations(c, c ? ($constellations[c.id] ?? 0) : 0)
		])
	);

	let hasFactionBadges = $derived(comp.hasAscendantGleam || comp.hasSecretRite);
	let hasPermanentBonuses = $derived(permanentByChar.some((p) => p.length > 0));
	let visible = $derived(resonance.active.length > 0 || hasFactionBadges || hasPermanentBonuses);

	// ── Chip hover tooltip — same detail rows as the timeline's buff bars ──

	/** The chip's always-on effects, formatted for the shared tooltip. */
	function chipEffects(bonus: Ability): MergedEffectDisplay[] {
		const out: MergedEffectDisplay[] = [];
		for (const fx of (bonus.effects ?? []) as Effect[]) {
			if (fx.trigger.type !== 'passive') continue;
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

	function showChipTooltip(e: MouseEvent, bonus: Ability, ownerName: string | undefined) {
		const effects = chipEffects(bonus);
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

	/** Element-tinted badge colors; Protective Canopy gets the neutral pair. */
	function resonanceBadgeStyle(res: Resonance): string {
		if (!res.element) return 'color: var(--muted); background: var(--fill-hover);';
		const p = elementPalette(res.element);
		return `color: ${p.hi}; background: color-mix(in srgb, ${p.main} 16%, transparent);`;
	}
</script>

{#if visible}
	<div class="team-bonuses" style:--tb-key-w="{TOOL_INSET - KEY_INSET}px">
		<span class="tb-key">Always-on buffs</span>
		<div class="tb-flow">
			{#each resonance.active as res (res.key)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<span
					class="faction-badge res-badge"
					style={resonanceBadgeStyle(res)}
					onmouseenter={(e) => showResonanceTooltip(e, res)}
					onmouseleave={hideChipTooltip}>{res.label}</span
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
						onmouseenter={(e) => showChipTooltip(e, bonus, owner?.displayName)}
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

	/* Label rail — its text's right edge lands KEY_INSET short of the tracks'
	   left edge, the lane-label inset. Width comes inline from the derivation
	   (see the top comment); a literal here would drift the moment the strip's
	   geometry moves, which is exactly what happened on 2026-08-06. */
	.tb-key {
		flex-shrink: 0;
		width: var(--tb-key-w);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-widest);
		text-transform: uppercase;
		color: var(--muted);
		text-align: right;
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
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
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
	   stripe (the same element-color identity the timeline bars carry). */
	.bonus-chip {
		display: inline-flex;
		align-items: center;
		padding: 2px 6px 3px;
		border-radius: 0 3px 3px 0;
		border-left: 2px solid transparent;
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		background: var(--fill-rest);
		color: var(--muted);
		white-space: nowrap;
	}

	/* Owner prefix ("Name: ") — the same brighter register the chip's element
	   stripe already carries, so the character reads as the chip's subject and
	   the buff name stays the primary term. */
	.bonus-chip-owner {
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
</style>
