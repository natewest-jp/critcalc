/**
 * team-builder/lib/compare.ts
 *
 * Pure row model for the aligned comparison view (Layer 2). Cards align BY
 * ROW: every selected character's E cooldown sits on one line, Q costs on
 * one line, each capability kind on one line — differences pop instead of
 * requiring saccades between stacked cards.
 *
 * Row semantics:
 * - Timing rows come straight from ability fields (cooldown/charges/energyCost).
 * - Capability rows are the union across the selected characters of
 *   (kind, buff-family) row keys, in the DetailCard's kind order. A cell
 *   aggregates that character's matching capabilities: lowest constellation
 *   gate wins; ties prefer the broadest target (team > active > self).
 * - When a broader-target source exists only at a HIGHER gate than the cell's
 *   primary entry (e.g. self-heal at C0, team heal at C1), the cell carries an
 *   `also` upgrade so the compact view doesn't hide team-relevant reach.
 * - `null` cell = nothing derives. For uncurated characters that means
 *   "unknown", not "no" — callers must render the distinction.
 */

import type { Ability } from '$lib/types/ability';
import {
	buffFamilyOf,
	type CapabilityKind,
	type DerivedCapability,
	type NormalizedTarget
} from '$lib/capabilities/deriveCapabilities';
import { KIND_LABEL, KIND_ORDER } from './capabilityText';

/** Columns stay readable side by side up to a full team's worth. */
export const MAX_COMPARE = 4;

export type CompareCharacter = {
	id: string;
	curated: boolean;
	abilities: readonly Ability[];
	capabilities: readonly DerivedCapability[];
};

// ---------------------------------------------------------------------------
// Timing rows
// ---------------------------------------------------------------------------

export type TimingRow = {
	key: 'skill-cd' | 'burst-cd' | 'burst-cost';
	label: string;
	/** One entry per compared character; null = the kit exposes no value. */
	cells: (string | null)[];
};

function skillCdCell(abilities: readonly Ability[]): string | null {
	const parts: string[] = [];
	for (const a of abilities) {
		if (a.abilityType !== 'skill' || !('cooldown' in a) || !a.cooldown) continue;
		const charges = 'charges' in a && a.charges && a.charges > 1 ? ` ×${a.charges}` : '';
		parts.push(`${a.cooldown}s${charges}`);
	}
	return parts.length > 0 ? parts.join(' / ') : null;
}

function burstCdCell(abilities: readonly Ability[]): string | null {
	const parts = abilities
		.filter((a) => a.abilityType === 'burst' && 'cooldown' in a && a.cooldown)
		.map((a) => `${(a as { cooldown: number }).cooldown}s`);
	return parts.length > 0 ? parts.join(' / ') : null;
}

function burstCostCell(abilities: readonly Ability[]): string | null {
	const parts = abilities
		.filter((a) => a.abilityType === 'burst' && 'energyCost' in a && a.energyCost)
		.map((a) => `${(a as { energyCost: number }).energyCost}`);
	return parts.length > 0 ? parts.join(' / ') : null;
}

// ---------------------------------------------------------------------------
// Capability rows
// ---------------------------------------------------------------------------

/** Kind for non-buffs; `buff:<family>` for buffs — mirrors the facet split. */
export type CapRowKey = string;

const BUFF_FAMILY_ORDER = ['atk', 'em', 'crit', 'dmg', 'hpdef', 'other'] as const;

const BUFF_FAMILY_LABEL: Record<(typeof BUFF_FAMILY_ORDER)[number], string> = {
	atk: 'ATK buff',
	em: 'EM buff',
	crit: 'Crit buff',
	dmg: 'DMG% buff',
	hpdef: 'HP/DEF buff',
	other: 'Other buff'
};

export function capRowKeyOf(cap: DerivedCapability): CapRowKey {
	if (cap.kind === 'buff') return `buff:${buffFamilyOf(cap.detail ?? '')}`;
	return cap.kind;
}

export function capRowLabelOf(key: CapRowKey): string {
	if (key.startsWith('buff:')) {
		return BUFF_FAMILY_LABEL[key.slice(5) as (typeof BUFF_FAMILY_ORDER)[number]] ?? 'Buff';
	}
	return KIND_LABEL[key as CapabilityKind] ?? key;
}

/** All possible rows in display order: kinds with buff expanded into families. */
const ROW_KEY_ORDER: CapRowKey[] = KIND_ORDER.flatMap((kind) =>
	kind === 'buff' ? BUFF_FAMILY_ORDER.map((f) => `buff:${f}`) : [kind]
);

/** Broadest reach first — used for tie-breaks at the same constellation gate. */
const TARGET_RANK: Record<NormalizedTarget, number> = { team: 0, active: 1, enemy: 2, self: 3 };
const targetRank = (t: NormalizedTarget | undefined) => (t === undefined ? 4 : TARGET_RANK[t]);

/** Uptime glyph inputs: the primary entry's window vs its host cooldown.
 *  Rendered as a static three-phase bar (planner vocabulary: solid uptime /
 *  dim continuation past CD / ghost CD remainder) at a scale shared across
 *  the whole comparison. */
export type CapGlyph = {
	/** Effect window in seconds. */
	uptime: number;
	/** Hosting ability's cooldown in seconds. */
	cooldown: number;
};

export type CapCell = {
	/** Lowest constellation gate at which this row's capability exists. */
	minCon: number;
	/** True when every source at minCon is runtime-conditional. */
	conditional: boolean;
	target?: NormalizedTarget;
	/** Distinct detail values at minCon (buff stats, shred elements). */
	details: string[];
	/** Caveats of the primary entry (for the conditional tooltip). */
	caveats: string[];
	/** Distinct source ability names across ALL matching capabilities. */
	sources: string[];
	/** Broader-target upgrade available at a higher gate, when one exists. */
	also?: { target: NormalizedTarget; minCon: number };
	glyph?: CapGlyph;
};

export type CapRow = {
	key: CapRowKey;
	label: string;
	cells: (CapCell | null)[];
};

function buildCell(
	caps: DerivedCapability[],
	cooldownOf: (abilityId: string) => number | undefined
): CapCell | null {
	if (caps.length === 0) return null;
	const minCon = Math.min(...caps.map((c) => c.minConstellation));
	const atGate = caps.filter((c) => c.minConstellation === minCon);
	const primary = [...atGate].sort(
		(a, b) => targetRank(a.target) - targetRank(b.target) || a.caveats.length - b.caveats.length
	)[0];
	const details = [...new Set(atGate.map((c) => c.detail).filter((d): d is string => !!d))];
	const sources = [...new Set(caps.map((c) => c.source.abilityName))];

	// Broader reach unlocking later than the primary gate (self C0 → team C2).
	let also: CapCell['also'];
	const broader = caps
		.filter((c) => targetRank(c.target) < targetRank(primary.target))
		.sort((a, b) => a.minConstellation - b.minConstellation)[0];
	if (broader && broader.target !== undefined) {
		also = { target: broader.target, minCon: broader.minConstellation };
	}

	// Glyph only when both halves are real: a durationed window granted by a
	// cooldown-bearing ability. Passive/constellation hosts have no cast cycle
	// to visualize — an invented one would be fake timing. Prefer the primary
	// entry; otherwise the longest window at the gate (deterministic — variant
	// order in the JSON must not decide which bar renders).
	let glyph: CapGlyph | undefined;
	const glyphable = (c: DerivedCapability) =>
		c.duration !== undefined && cooldownOf(c.source.abilityId) !== undefined;
	const glyphSource = glyphable(primary)
		? primary
		: atGate.filter(glyphable).sort((a, b) => b.duration! - a.duration!)[0];
	if (glyphSource?.duration !== undefined) {
		glyph = { uptime: glyphSource.duration, cooldown: cooldownOf(glyphSource.source.abilityId)! };
	}

	return {
		minCon,
		conditional: atGate.every((c) => c.caveats.length > 0),
		...(primary.target !== undefined && { target: primary.target }),
		details,
		caveats: primary.caveats,
		sources,
		...(also && { also }),
		...(glyph && { glyph })
	};
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export type CompareModel = {
	timingRows: TimingRow[];
	capRows: CapRow[];
};

export function buildCompareModel(characters: readonly CompareCharacter[]): CompareModel {
	const timingRows: TimingRow[] = [
		{
			key: 'skill-cd',
			label: 'E cooldown',
			cells: characters.map((c) => skillCdCell(c.abilities))
		},
		{
			key: 'burst-cd',
			label: 'Q cooldown',
			cells: characters.map((c) => burstCdCell(c.abilities))
		},
		{
			key: 'burst-cost',
			label: 'Q energy',
			cells: characters.map((c) => burstCostCell(c.abilities))
		}
	].filter((row) => row.cells.some((cell) => cell !== null)) as TimingRow[];

	const grouped = characters.map((c) => {
		const byKey = new Map<CapRowKey, DerivedCapability[]>();
		for (const cap of c.capabilities) {
			const key = capRowKeyOf(cap);
			const list = byKey.get(key);
			if (list) list.push(cap);
			else byKey.set(key, [cap]);
		}
		return byKey;
	});

	const cooldownLookups = characters.map((c) => {
		const byId = new Map<string, number>();
		for (const a of c.abilities) {
			if ('cooldown' in a && typeof a.cooldown === 'number' && a.cooldown > 0) {
				byId.set(a.id, a.cooldown);
			}
		}
		return (abilityId: string) => byId.get(abilityId);
	});

	const capRows: CapRow[] = [];
	for (const key of ROW_KEY_ORDER) {
		if (!grouped.some((g) => g.has(key))) continue;
		capRows.push({
			key,
			label: capRowLabelOf(key),
			cells: grouped.map((g, i) => buildCell(g.get(key) ?? [], cooldownLookups[i]))
		});
	}

	return { timingRows, capRows };
}

/** Seconds spanned by the shared glyph scale — the longest cycle (cooldown or
 *  window, whichever is longer) among every glyph in the model. All glyphs
 *  render against this one scale so bar lengths compare truthfully. */
export function glyphScaleSeconds(model: CompareModel): number {
	let max = 0;
	for (const row of model.capRows) {
		for (const cell of row.cells) {
			if (!cell?.glyph) continue;
			max = Math.max(max, cell.glyph.cooldown, cell.glyph.uptime);
		}
	}
	return max;
}
