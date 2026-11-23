/**
 * src/lib/utils/resonance.ts
 *
 * Elemental resonance — shared game facts (KQM-aligned), derived from the
 * four team slots' elements. Extracted from builder/lib/team.ts so the
 * rotation planner's always-on strip can consume the same source of truth
 * (team.ts re-exports for its existing consumers).
 *
 * Constitution line: these are FACTS (label + mechanical effect), never a
 * synergy verdict. Resonance requires a full party of four; two of an
 * element grants that element's resonance, four distinct elements grant
 * Protective Canopy.
 *
 * `rows` are pre-formatted tooltip rows for the shared BuffTooltip: `stat`
 * is either a real `Stat` key (gets the stat icon) or a plain display label
 * (rendered as-is) — the tooltip's row type is deliberately loose.
 */

import { m } from '$lib/paraglide/messages';

export const TEAM_SIZE = 4;

/** One tooltip row: a Stat key (icon + canonical label) or a prose label. */
export type ResonanceRow = { stat: string; displayValue: string };

export type Resonance = {
	key: string;
	label: string;
	/** Short mechanical effect text (game fact, not advice). */
	effect: string;
	/** Structured tooltip rows — same facts as `effect`, one per line. */
	rows: ResonanceRow[];
	/** Element behind the resonance; absent for Protective Canopy. */
	element?: string;
};

/** Built at each call, so the text follows the page's language: a table
 *  filled at module load would freeze one locale for the whole prerender. */
const ELEMENT_RESONANCE: Record<
	string,
	() => { label: string; effect: string; rows: ResonanceRow[] }
> = {
	pyro: () => ({
		label: m.bench_fervent_flames(),
		effect: m.bench_atk_25_cryo_aura_duration_40(),
		rows: [
			{ stat: 'atk%', displayValue: '+25%' },
			{ stat: m.bench_cryo_aura_duration(), displayValue: '−40%' }
		]
	}),
	hydro: () => ({
		label: m.bench_soothing_water(),
		effect: m.bench_max_hp_25_pyro_aura_duration_40(),
		rows: [
			{ stat: 'hp%', displayValue: '+25%' },
			{ stat: m.bench_pyro_aura_duration(), displayValue: '−40%' }
		]
	}),
	anemo: () => ({
		label: m.bench_impetuous_winds(),
		effect: m.bench_stamina_cost_15_movement_speed_10_skill(),
		rows: [
			{ stat: m.bench_stamina_cost(), displayValue: '−15%' },
			{ stat: m.bench_movement_speed(), displayValue: '+10%' },
			{ stat: 'cdReduction', displayValue: '−5%' }
		]
	}),
	electro: () => ({
		label: m.bench_high_voltage(),
		effect: m.bench_electro_reactions_generate_an_elemental(),
		rows: [
			{
				stat: m.bench_electro_particles(),
				displayValue: m.bench_1_per_electro_reaction_5s_cooldown()
			},
			{ stat: m.bench_hydro_aura_duration(), displayValue: '−40%' }
		]
	}),
	cryo: () => ({
		label: m.bench_shattering_ice(),
		effect: m.bench_crit_rate_15_vs_frozen_or_cryo_affected(),
		rows: [
			{ stat: 'critRate', displayValue: m.bench_15_frozen_cryo() },
			{ stat: m.bench_electro_aura_duration(), displayValue: '−40%' }
		]
	}),
	geo: () => ({
		label: m.bench_enduring_rock(),
		effect: m.bench_shield_strength_15_shielded_dmg_15_20(),
		rows: [
			{ stat: m.bench_shield_strength(), displayValue: '+15%' },
			{ stat: 'allDmgBonus', displayValue: m.bench_15_shielded() },
			{ stat: m.bench_enemy_geo_res(), displayValue: m.bench_20_15s() }
		]
	}),
	dendro: () => ({
		label: m.bench_sprawling_greenery(),
		effect: m.bench_em_50_reaction_triggered_em_boosts_30_20(),
		rows: [
			{ stat: 'em', displayValue: '+50' },
			{ stat: m.bench_em_after_reactions(), displayValue: m.bench_30_20_6s() }
		]
	})
};

export type ResonanceFacts = {
	/** Resonances active for the slotted elements. */
	active: Resonance[];
	/** True when fewer than four slots are filled. */
	needsFullTeam: boolean;
};

/**
 * @param opts.requireFullParty  Default true (the in-game rule: resonance
 *   needs a full party of four — the Team Builder's strict fact posture).
 *   The rotation planner passes false so a pair of elements resonates even
 *   with blank example slots (a deliberate tool-UX call, Nate 2026-07-19).
 *   Protective Canopy always needs four distinct filled slots — it has no
 *   partial form.
 */
export function deriveResonances(
	elements: (string | null | undefined)[],
	opts: { requireFullParty?: boolean } = {}
): ResonanceFacts {
	const { requireFullParty = true } = opts;
	const filled = elements.filter((e): e is string => !!e);
	const needsFullTeam = filled.length < TEAM_SIZE;
	if (requireFullParty && needsFullTeam) return { active: [], needsFullTeam };

	const counts = new Map<string, number>();
	for (const el of filled) counts.set(el, (counts.get(el) ?? 0) + 1);

	const active: Resonance[] = [];
	for (const [el, n] of counts) {
		if (n < 2) continue;
		const res = ELEMENT_RESONANCE[el];
		if (res) active.push({ key: el, element: el, ...res() });
	}
	if (active.length === 0 && !needsFullTeam && counts.size === TEAM_SIZE) {
		active.push({
			key: 'canopy',
			label: m.bench_protective_canopy(),
			effect: m.bench_all_elemental_and_physical_res_15(),
			rows: [{ stat: m.bench_all_res(), displayValue: '+15%' }]
		});
	}
	return { active, needsFullTeam };
}
