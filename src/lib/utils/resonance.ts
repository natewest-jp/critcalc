/**
 * src/lib/utils/resonance.ts
 *
 * Elemental resonance — shared game facts (KQM-aligned), derived from the
 * four team slots' elements. Extracted from team-builder/lib/team.ts so the
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

const ELEMENT_RESONANCE: Record<string, { label: string; effect: string; rows: ResonanceRow[] }> = {
	pyro: {
		label: 'Fervent Flames',
		effect: 'ATK +25%, cryo aura duration −40%',
		rows: [
			{ stat: 'atk%', displayValue: '+25%' },
			{ stat: 'Cryo aura duration', displayValue: '−40%' }
		]
	},
	hydro: {
		label: 'Soothing Water',
		effect: 'Max HP +25%, pyro aura duration −40%',
		rows: [
			{ stat: 'hp%', displayValue: '+25%' },
			{ stat: 'Pyro aura duration', displayValue: '−40%' }
		]
	},
	anemo: {
		label: 'Impetuous Winds',
		effect: 'Stamina cost −15%, movement speed +10%, skill cooldown −5%',
		rows: [
			{ stat: 'Stamina cost', displayValue: '−15%' },
			{ stat: 'Movement speed', displayValue: '+10%' },
			{ stat: 'cdReduction', displayValue: '−5%' }
		]
	},
	electro: {
		label: 'High Voltage',
		effect:
			'Electro reactions generate an elemental particle (5s cooldown); hydro aura duration −40%',
		rows: [
			{ stat: 'Electro particles', displayValue: '1 per electro reaction · 5s cooldown' },
			{ stat: 'Hydro aura duration', displayValue: '−40%' }
		]
	},
	cryo: {
		label: 'Shattering Ice',
		effect: 'CRIT rate +15% vs frozen or cryo-affected enemies; electro aura duration −40%',
		rows: [
			{ stat: 'critRate', displayValue: '+15% (frozen/cryo)' },
			{ stat: 'Electro aura duration', displayValue: '−40%' }
		]
	},
	geo: {
		label: 'Enduring Rock',
		effect: 'Shield strength +15%; shielded: DMG +15%, −20% enemy geo RES (15s)',
		rows: [
			{ stat: 'Shield strength', displayValue: '+15%' },
			{ stat: 'allDmgBonus', displayValue: '+15% (shielded)' },
			{ stat: 'Enemy Geo RES', displayValue: '−20% · 15s' }
		]
	},
	dendro: {
		label: 'Sprawling Greenery',
		effect: 'EM +50; reaction-triggered EM boosts (+30/+20, 6s)',
		rows: [
			{ stat: 'em', displayValue: '+50' },
			{ stat: 'EM after reactions', displayValue: '+30 / +20 · 6s' }
		]
	}
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
		if (res) active.push({ key: el, element: el, ...res });
	}
	if (active.length === 0 && !needsFullTeam && counts.size === TEAM_SIZE) {
		active.push({
			key: 'canopy',
			label: 'Protective Canopy',
			effect: 'All elemental and physical RES +15%',
			rows: [{ stat: 'All RES', displayValue: '+15%' }]
		});
	}
	return { active, needsFullTeam };
}
