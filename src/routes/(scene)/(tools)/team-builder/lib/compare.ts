/**
 * team-builder/lib/compare.ts
 *
 * Pure row model for the aligned comparison view (Layer 2). Cards align BY
 * ROW: every selected character's E cooldown sits on one line, Q costs on
 * one line, each capability kind on one line — differences pop instead of
 * requiring saccades between stacked cards.
 *
 * TWO PROJECTIONS OFF ONE MODEL, and they answer different questions:
 *
 * - `cells` — one per (row × character), for the FACTS TABLE. Aggregated: the
 *   whole character collapses to one value per row.
 * - `lanes` — one per (row × character × HOST), for the TIMING CHART. A lane is
 *   an ABILITY, not an effect, so its cooldown and energy cost travel with it;
 *   the EFFECT is the grouping. That is why Jean gets two lanes under "Heal"
 *   (her E and her Q) where she gets one cell: which button carries a thing is
 *   kit-design accident, but what it COSTS is the comparison.
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
	type FacetKey,
	type NormalizedTarget
} from '$lib/capabilities/deriveCapabilities';
import type { BuffValue, Stat } from '$lib/types/ability';
import type { CapabilitySource } from '$lib/capabilities/deriveCapabilities';
import { KIND_LABEL, KIND_ORDER, capDetailText } from '$lib/capabilities/capabilityText';
import { REACTION_FAMILY } from '$lib/utils/auraDisplay';

/** Columns stay readable side by side up to a full team's worth. */
export const MAX_COMPARE = 4;

/** ⛔ No `curated` flag. It was required here and never read: the null-cell
 *  distinction it was meant to carry ("unknown" vs "—") is drawn at the RENDER
 *  site off the index entry, which is where the view already had the fact. A
 *  required field with no reader is a claim the model does not honour. */
export type CompareCharacter = {
	id: string;
	abilities: readonly Ability[];
	capabilities: readonly DerivedCapability[];
};

/** Seconds spanned by the timing chart's axis. A control, not a derivation —
 *  the axis is chosen so every lane tiles against the SAME ruler, which is what
 *  makes duty cycles comparable by eye. */
export const COMPARE_AXIS_CHOICES = [20, 30, 60] as const;
export const COMPARE_AXIS_DEFAULT = 30;

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

/** Kind for non-buffs; `buff:<family>` for the five facet families, and
 *  `buff:other:<stat>` for everything else — ⛔ never one "Other buff" bucket
 *  (Healing Bonus and DEF ignore sharing a row compared two unrelated things). */
export type CapRowKey = string;

const BUFF_FAMILY_ORDER = ['atk', 'em', 'crit', 'dmg', 'hpdef'] as const;

const BUFF_FAMILY_LABEL: Record<(typeof BUFF_FAMILY_ORDER)[number], string> = {
	atk: 'ATK buff',
	em: 'EM buff',
	crit: 'CRIT buff',
	dmg: 'DMG% buff',
	hpdef: 'HP/DEF buff'
};

/** ⛔ `summon` is not a contribution. It is HOW something is delivered (Oz,
 *  Guoba), and what the summon does already has its own row — Off-field DMG,
 *  Heal — so a Summon row printed "C0" and nothing else. */
const DROPPED_KINDS: ReadonlySet<CapabilityKind> = new Set(['summon']);

export function capRowKeyOf(cap: DerivedCapability): CapRowKey {
	if (cap.kind === 'buff') {
		const family = buffFamilyOf(cap.detail ?? '');
		return family === 'other' ? `buff:other:${cap.detail ?? ''}` : `buff:${family}`;
	}
	return cap.kind;
}

export function capRowLabelOf(key: CapRowKey): string {
	if (key.startsWith('buff:other:')) return capDetailText('buff', key.slice('buff:other:'.length));
	if (key.startsWith('buff:')) {
		return BUFF_FAMILY_LABEL[key.slice(5) as (typeof BUFF_FAMILY_ORDER)[number]] ?? 'Buff';
	}
	return KIND_LABEL[key as CapabilityKind] ?? key;
}

/** Display order: kinds in the DetailCard's order, buffs expanded into their
 *  families, then any named other-stat rows the selection actually has. */
function rowKeyOrder(present: ReadonlySet<CapRowKey>): CapRowKey[] {
	return KIND_ORDER.filter((k) => !DROPPED_KINDS.has(k)).flatMap((kind) =>
		kind === 'buff'
			? [
					...BUFF_FAMILY_ORDER.map((f) => `buff:${f}`),
					...[...present].filter((k) => k.startsWith('buff:other:')).sort()
				]
			: [kind]
	);
}

/** Broadest reach first — used for tie-breaks at the same constellation gate. */
const TARGET_RANK: Record<NormalizedTarget, number> = { team: 0, active: 1, enemy: 2, self: 3 };
const targetRank = (t: NormalizedTarget | undefined) => (t === undefined ? 4 : TARGET_RANK[t]);

export type Magnitude = { stat: Stat; value: BuffValue } | { shred: number };

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
	/** The primary's window, in seconds, when it has one. */
	duration?: number;
	/** How big, when the primary is a buff (the view formats it) or a shred —
	 *  the one a delta is read from. */
	magnitude?: Magnitude;
	/** Every DISTINCT size at the gate, primary first: Sucrose shares a flat
	 *  50 EM on Swirl AND 20% of her own EM on a cast hit, and the cell has to
	 *  say both or it understates her by half. */
	magnitudes: Magnitude[];
	/** What opens it: the cast labels ('E', 'Q') or 'per Swirl' — distinct, at
	 *  the gate. Empty for an always-on or untimed effect. */
	opensOn: string[];
	/** Every source at the gate, whole — the inline provenance reads this. */
	provenance: { source: CapabilitySource; caveats: string[]; target?: NormalizedTarget }[];
};

export type CapRow = {
	key: CapRowKey;
	label: string;
	cells: (CapCell | null)[];
	/** Chart projection — see the header. One entry per (character × host); a
	 *  character with no timed host under this row contributes none. */
	lanes: CapLane[];
};

// ---------------------------------------------------------------------------
// Lanes — the chart projection
// ---------------------------------------------------------------------------

/** The ability (or summon) a lane is drawn for. Its cycle and its price. */
export type LaneHost = {
	abilityId: string;
	/** 'E' · 'Q' · 'E (Hold)' · 'Q · Oz' — the cast, named the way notation does. */
	label: string;
	cooldown: number;
	charges?: number;
	/** Bursts only. Reference-tier per the constitution: shown, never computed with. */
	energyCost?: number;
	/** Set when a summon hosts the window rather than the caster's own state. */
	summonLabel?: string;
};

export type CapLane = {
	/** Index into the comparison's character array — the column this lane belongs to. */
	columnIndex: number;
	/** Unique within a row: two hosts on one character must not collide. */
	key: string;
	/** The cast whose cycle this lane tiles. Absent on a {@link perReaction} lane. */
	host?: LaneHost;
	/** Set instead of `host` when a REACTION opens the window (Kazuha's Swirl
	 *  bonus): the reaction families, e.g. ['Swirl']. ⚓ Nate 2026-10-07: drawn
	 *  as ONE window, never tiled — it says how long the buff lasts without
	 *  inventing how often the reaction happens. */
	perReaction?: string[];
	/** Effect window in seconds. */
	uptime: number;
	/** Tick offsets in seconds from the cast, when a summon sets the cadence. */
	ticks?: number[];
	/** Other rows this SAME cast also buys — one cast for two jobs is a fact
	 *  worth showing, and it is the thing a per-effect lane model hides. */
	alsoCarries: CapRowKey[];
	minCon: number;
	conditional: boolean;
	target?: NormalizedTarget;
	details: string[];
	caveats: string[];
};

/** Ticks never outrun their window, and a pathological interval can't hang the
 *  view. 240 is far past anything the corpus authors (Xiangling's Guoba is 4). */
const MAX_TICKS = 240;

function tickOffsets(interval: number, firstDelay: number, uptime: number): number[] {
	const ticks: number[] = [];
	for (let t = firstDelay; t < uptime && ticks.length < MAX_TICKS; t += interval) ticks.push(t);
	return ticks;
}

/** Short cast name, in the notation's own vocabulary. */
function hostLabel(ability: Ability, variant: string | undefined, summonLabel?: string): string {
	const base = ability.abilityType === 'burst' ? 'Q' : ability.abilityType === 'skill' ? 'E' : '';
	const cast = variant ? `${base} (${variant})` : base;
	return summonLabel ? `${cast} · ${summonLabel}` : cast;
}

/** An ability's cooldown, when it has a real one — the only thing that makes a
 *  cast a CYCLE a lane can tile. */
function cycleOf(ability: Ability | undefined): number {
	return ability && 'cooldown' in ability ? Number(ability.cooldown) || 0 : 0;
}

/** What a character's abilities look like to the lane resolver: by id, and the
 *  first cooldown-bearing skill and burst — the cast a passive's trigger names
 *  when it says "after Elemental Skill". ⚠ The FIRST, for the nine kits with a
 *  stance sibling (Cyno, Tartaglia, Varka…): the sibling shares the trigger's
 *  abilityType, and the base cast is the one you open with. */
type AbilityLookup = {
	byId: Map<string, Ability>;
	byType: Partial<Record<'skill' | 'burst', Ability>>;
};

function abilityLookup(abilities: readonly Ability[]): AbilityLookup {
	const byType: AbilityLookup['byType'] = {};
	for (const a of abilities) {
		if ((a.abilityType === 'skill' || a.abilityType === 'burst') && !byType[a.abilityType]) {
			if (cycleOf(a) > 0) byType[a.abilityType] = a;
		}
	}
	return { byId: new Map(abilities.map((a) => [a.id, a])), byType };
}

/**
 * The cast(s) whose cycle a capability rides — its own source when that is a
 * cooldown-bearing cast, else the cast(s) its trigger names (`host.casts`):
 * Sucrose's A4 EM share rides BOTH her E and her Q, Kazuha's C2 EM his Q.
 * Empty = no cast cycle to draw against (a reaction-set or always-on effect),
 * and inventing one would be fake timing.
 */
function laneHostsOf(cap: DerivedCapability, lookup: AbilityLookup): Ability[] {
	const own = lookup.byId.get(cap.source.abilityId);
	if (cycleOf(own) > 0) return [own!];
	if (cap.host && 'casts' in cap.host) {
		return cap.host.casts.map((t) => lookup.byType[t]).filter((a): a is Ability => !!a);
	}
	return [];
}

/** The reaction families a reaction-set effect listens for, deduped — four
 *  per-element Swirl triggers read as one "Swirl". */
function reactionFamilies(cap: DerivedCapability): string[] {
	if (!cap.host || !('reactions' in cap.host)) return [];
	const names = cap.host.reactions.map((r) =>
		r === 'any' ? 'any reaction' : (REACTION_FAMILY[r as keyof typeof REACTION_FAMILY] ?? r)
	);
	return [...new Set(names)];
}

/** What opens a capability, in the chart's words: the cast it rides ('E',
 *  'Q'), or — ONE entry — the reactions it waits for ('per Quicken / Spread'). */
function opensOnOf(cap: DerivedCapability, lookup: AbilityLookup): string[] {
	const casts = laneHostsOf(cap, lookup).map((a) =>
		a.abilityType === 'burst' ? 'Q' : a.abilityType === 'skill' ? 'E' : a.name
	);
	if (casts.length > 0) return casts;
	const families = reactionFamilies(cap);
	return families.length > 0 ? [`per ${families.join(' / ')}`] : [];
}

function magnitudeOf(cap: DerivedCapability): Magnitude | undefined {
	if (cap.kind === 'buff' && cap.value !== undefined && cap.detail) {
		return { stat: cap.detail as Stat, value: cap.value };
	}
	if (cap.kind === 'resShred' && cap.amount !== undefined) return { shred: cap.amount };
	return undefined;
}

/**
 * Lanes for one row key and one character.
 *
 * Grouped by HOST — the cast's `abilityId` plus the summon label, because a
 * summon is a host in its own right (Xiangling's Q and its Guoba are two
 * different cycles off one cast). A lane needs both halves to be real: a
 * window with a duration AND a cooldown-bearing cast. A passive or
 * constellation joins the lane of the cast its trigger names (`laneHostsOf`)
 * — until 2026-10-07 they had no lane at all, which left Kazuha, Sucrose and
 * Nahida's defining buffs off the chart.
 */
function buildLanes(
	columnIndex: number,
	rowKey: CapRowKey,
	caps: DerivedCapability[],
	lookup: AbilityLookup,
	alsoByAbility: Map<string, CapRowKey[]>
): CapLane[] {
	const groups = new Map<string, { ability: Ability; caps: DerivedCapability[] }>();
	const reactionGroups = new Map<string, DerivedCapability[]>();
	for (const cap of caps) {
		if (cap.duration === undefined) continue;
		const hosts = laneHostsOf(cap, lookup);
		for (const ability of hosts) {
			const key = `${ability.id}::${cap.summon?.label ?? ''}`;
			const group = groups.get(key);
			if (group) group.caps.push(cap);
			else groups.set(key, { ability, caps: [cap] });
		}
		const families = hosts.length === 0 ? reactionFamilies(cap) : [];
		if (families.length > 0) {
			const key = `react::${families.join('+')}`;
			const list = reactionGroups.get(key);
			if (list) list.push(cap);
			else reactionGroups.set(key, [cap]);
		}
	}

	const lanes: CapLane[] = [];
	for (const [key, group] of reactionGroups) {
		const minCon = Math.min(...group.map((c) => c.minConstellation));
		const atGate = group.filter((c) => c.minConstellation === minCon);
		const primary = [...atGate].sort(
			(a, b) => targetRank(a.target) - targetRank(b.target) || a.caveats.length - b.caveats.length
		)[0];
		lanes.push({
			columnIndex,
			key,
			perReaction: reactionFamilies(primary),
			uptime: Math.max(...atGate.map((c) => c.duration ?? 0)),
			alsoCarries: [],
			minCon,
			conditional: atGate.every((c) => c.caveats.length > 0),
			...(primary.target !== undefined && { target: primary.target }),
			details: [...new Set(atGate.map((c) => c.detail).filter((d): d is string => !!d))],
			caveats: primary.caveats
		});
	}
	for (const [key, { ability, caps: group }] of groups) {
		const minCon = Math.min(...group.map((c) => c.minConstellation));
		const atGate = group.filter((c) => c.minConstellation === minCon);
		// The primary follows the cell's rule (broadest reach, then fewest
		// caveats) so a lane and its cell can't disagree about who it serves.
		const primary = [...atGate].sort(
			(a, b) => targetRank(a.target) - targetRank(b.target) || a.caveats.length - b.caveats.length
		)[0];
		// Longest window at the gate — deterministic, so JSON variant order can
		// never decide how long the bar is.
		const uptime = Math.max(...atGate.map((c) => c.duration ?? 0));
		if (!(uptime > 0)) continue;

		const cadence = group.find((c) => c.summon?.tickInterval !== undefined)?.summon;
		const ticks = cadence?.tickInterval
			? tickOffsets(cadence.tickInterval, cadence.firstTickDelay ?? cadence.tickInterval, uptime)
			: undefined;

		const charges = 'charges' in ability ? ability.charges : undefined;
		const energyCost = 'energyCost' in ability ? ability.energyCost : undefined;

		lanes.push({
			columnIndex,
			key,
			host: {
				abilityId: ability.id,
				// A variant names THIS cast's form only when the primary came from it —
				// a passive riding the lane has no say in how the cast is labelled.
				label: hostLabel(
					ability,
					primary.source.abilityId === ability.id ? primary.source.variant : undefined,
					group[0].summon?.label
				),
				cooldown: (ability as { cooldown: number }).cooldown,
				...(charges !== undefined && charges > 1 && { charges }),
				...(energyCost !== undefined && energyCost > 0 && { energyCost }),
				...(group[0].summon?.label !== undefined && { summonLabel: group[0].summon.label })
			},
			uptime,
			...(ticks !== undefined && ticks.length > 0 && { ticks }),
			alsoCarries: (alsoByAbility.get(ability.id) ?? []).filter((k) => k !== rowKey),
			minCon,
			conditional: atGate.every((c) => c.caveats.length > 0),
			...(primary.target !== undefined && { target: primary.target }),
			details: [...new Set(atGate.map((c) => c.detail).filter((d): d is string => !!d))],
			caveats: primary.caveats
		});
	}

	// Cheapest cycle first — the lane you can renew soonest reads first; a
	// reaction-set window (no cycle at all) after every cast. Lanes across
	// characters keep COLUMN order: the caller concatenates per character.
	const cycle = (l: CapLane) => l.host?.cooldown ?? Infinity;
	lanes.sort((a, b) => cycle(a) - cycle(b) || a.key.localeCompare(b.key));
	return lanes;
}

function buildCell(caps: DerivedCapability[], lookup: AbilityLookup): CapCell | null {
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

	const duration = primary.duration;
	const magnitude = magnitudeOf(primary);
	const magnitudes = new Map<string, Magnitude>();
	for (const c of [primary, ...atGate]) {
		const m = magnitudeOf(c);
		if (m) magnitudes.set(JSON.stringify(m), m);
	}

	return {
		minCon,
		conditional: atGate.every((c) => c.caveats.length > 0),
		...(primary.target !== undefined && { target: primary.target }),
		details,
		caveats: primary.caveats,
		sources,
		...(also && { also }),
		...(duration !== undefined && { duration }),
		...(magnitude && { magnitude }),
		magnitudes: [...magnitudes.values()],
		opensOn: [...new Set(atGate.flatMap((c) => opensOnOf(c, lookup)))],
		provenance: atGate.map((c) => ({
			source: c.source,
			caveats: c.caveats,
			...(c.target !== undefined && { target: c.target })
		}))
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
			if (DROPPED_KINDS.has(cap.kind)) continue;
			const key = capRowKeyOf(cap);
			const list = byKey.get(key);
			if (list) list.push(cap);
			else byKey.set(key, [cap]);
		}
		return byKey;
	});

	const lookups = characters.map((c) => abilityLookup(c.abilities));

	// Which rows each CAST feeds, per character — the `also:` list on a lane is
	// read straight off this, so it stays consistent with the rows on screen.
	// Keyed by the RESOLVED host, so a passive riding Q appears in Q's list.
	const alsoLookups = characters.map((c, i) => {
		const byAbility = new Map<string, CapRowKey[]>();
		for (const cap of c.capabilities) {
			if (DROPPED_KINDS.has(cap.kind)) continue; // never a row, so never an "also"
			const key = capRowKeyOf(cap);
			const hosts = laneHostsOf(cap, lookups[i]).map((a) => a.id);
			for (const id of hosts.length > 0 ? hosts : [cap.source.abilityId]) {
				const list = byAbility.get(id);
				if (!list) byAbility.set(id, [key]);
				else if (!list.includes(key)) list.push(key);
			}
		}
		return byAbility;
	});

	const present = new Set(grouped.flatMap((g) => [...g.keys()]));
	const capRows: CapRow[] = [];
	for (const key of rowKeyOrder(present)) {
		if (!present.has(key)) continue;
		capRows.push({
			key,
			label: capRowLabelOf(key),
			cells: grouped.map((g, i) => buildCell(g.get(key) ?? [], lookups[i])),
			lanes: grouped.flatMap((g, i) =>
				buildLanes(i, key, g.get(key) ?? [], lookups[i], alsoLookups[i])
			)
		});
	}

	return { timingRows, capRows };
}

/**
 * A chart lens key as a roster FACET, so the one chip row can both group the
 * chart and narrow an audition's candidate list.
 *
 * ⚠ The two vocabularies are near-identical and are NOT the same, which is
 * exactly why this is a function and not a cast. `CapRowKey` has `summon` and
 * `buff:other` (rows worth drawing, not worth filtering a roster by);
 * `FacetKey` has `interruptionRes`, which is not a CapabilityKind at all. The
 * overlap is everything else.
 */
export function lensFacet(key: CapRowKey): FacetKey | null {
	return (FACET_KEYS as readonly string[]).includes(key) ? (key as FacetKey) : null;
}

const FACET_KEYS = [
	'heal',
	'shield',
	'offFieldDamage',
	'resShred',
	'cleanse',
	'grouping',
	'taunt',
	'energy',
	'infuse',
	'interruptionRes',
	'buff:atk',
	'buff:em',
	'buff:crit',
	'buff:dmg',
	'buff:hpdef'
] as const satisfies readonly FacetKey[];

// ---------------------------------------------------------------------------
// Deltas against a reference column
// ---------------------------------------------------------------------------

/**
 * How a cell differs from the REFERENCE cell in the same row — the audition's
 * incumbent, or the column pinned in plain Compare.
 *
 * ⚠ A delta is a FACT, never a verdict: the view prints it in neutral ink,
 * never good/bad colour, and it says only what is arithmetic — a longer window
 * is not "better" when the cooldown is longer too. Only like is compared with
 * like: a duration with a duration, and a magnitude only when both are a
 * plain number on the SAME stat. Everything else returns nothing rather than
 * a misleading sign.
 */
export function factDelta(ref: CapCell | null, cell: CapCell | null): string[] {
	if (!ref || !cell) return [];
	const out: string[] = [];
	if (ref.duration !== undefined && cell.duration !== undefined) {
		const d = Math.round((cell.duration - ref.duration) * 100) / 100;
		if (d !== 0) out.push(`${d > 0 ? '+' : '−'}${Math.abs(d)}s`);
	}
	const a = ref.magnitude;
	const b = cell.magnitude;
	if (a && b && 'stat' in a && 'stat' in b && a.stat === b.stat) {
		if (typeof a.value === 'number' && typeof b.value === 'number' && a.value !== b.value) {
			const d = Math.round((b.value - a.value) * 100) / 100;
			out.push(`${d > 0 ? '+' : '−'}${Math.abs(d)}`);
		}
	} else if (a && b && 'shred' in a && 'shred' in b && a.shred !== b.shred) {
		const d = b.shred - a.shred;
		out.push(`${d > 0 ? '+' : '−'}${Math.abs(d)}%`);
	}
	return out;
}

/** True when two or more columns have something in this row — the rows that
 *  are a real comparison. The rest are what ONE character alone brings. */
export function isShared(row: CapRow): boolean {
	return row.cells.filter((c) => c !== null).length >= 2;
}
