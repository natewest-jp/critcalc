/**
 * builder/lib/team.ts
 *
 * Pure model for a team: the four slots, the `?team=` URL param, and the
 * derived team-level FACTS — elemental resonance, and what a swap changes.
 * Facts, not a score: present/absent and gained/lost, never aggregated or
 * rated.
 */

import type { CharacterIndexEntry } from '$lib/types/character';
import { isCapabilityUnknown, type FacetKey } from './facets';
import type { Board } from '$lib/boards.svelte';
import { SEASONS, checkAlternatives, liveSeasons, type BattlefieldCheck } from '$lib/endgame';
import { evaluateCheck, type CheckVerdict } from '$lib/endgameChecks';
import { FINGERPRINT, teamFingerprint } from '$lib/fingerprint';
import { characterKey, getCharacterIndexEntry } from '$lib/data/characterLookup';
import { reactionPairs, type ReactionPair } from '$lib/utils/reactionPairs';

export const TEAM_SIZE = 4;

export type TeamSlot = string | null;

// ---------------------------------------------------------------------------
// ?team= param
// ---------------------------------------------------------------------------

/** Parses `?team=a,b,c,d` into four slots — unknown ids and duplicates are
 *  dropped, extras beyond four ignored. Order is preserved. */
export function parseTeamParam(
	param: string | null,
	isValidId: (id: string) => boolean
): TeamSlot[] {
	const slots: TeamSlot[] = Array.from({ length: TEAM_SIZE }, () => null);
	if (!param) return slots;
	const seen = new Set<string>();
	let i = 0;
	for (const raw of param.split(',')) {
		if (i >= TEAM_SIZE) break;
		const id = raw.trim();
		if (!id || seen.has(id) || !isValidId(id)) continue;
		seen.add(id);
		slots[i++] = id;
	}
	return slots;
}

// ---------------------------------------------------------------------------
// Elemental resonance — game facts, active only with a full party of four.
// The model moved to $lib/utils/resonance.ts (shared with the rotation
// planner's always-on strip); re-exported here for this tool's consumers.
// ---------------------------------------------------------------------------

import { deriveResonances } from '$lib/utils/resonance';
export { deriveResonances };
export type { Resonance, ResonanceFacts } from '$lib/utils/resonance';

// ---------------------------------------------------------------------------
// SWAP MODE — what a swap does to the TEAM (lineups design §11.6 item 20)
// ---------------------------------------------------------------------------

/** One thing a swap changes, signed: +1 the team gains it, −1 it loses it. */
export type DeltaItem =
	| { kind: 'reaction'; sign: 1 | -1; pair: ReactionPair }
	| { kind: 'resonance'; sign: 1 | -1; key: string; label: string; element?: string }
	| { kind: 'facet'; sign: 1 | -1; facet: FacetKey }
	| { kind: 'check'; sign: 1 | -1; check: BattlefieldCheck };

/** ⚓ The four tiers, in the order the grid shows them. A change of reactions
 *  OR resonance is its own tier whatever else moves: the team becomes a
 *  different archetype, which is a different question from "what does it
 *  lose". `uncurated` = an unknown kit, which no delta can speak for. */
export type SwapTier = 'keeps' | 'trades' | 'reactions' | 'uncurated';

export type SwapDelta = { tier: SwapTier; items: DeltaItem[] };

const KIND_ORDER = ['reaction', 'resonance', 'facet', 'check'] as const;
const FACET_ORDER = FINGERPRINT.flatMap((c) => c.facets);

function itemId(i: DeltaItem): string {
	switch (i.kind) {
		case 'reaction':
			return `${i.pair.a}|${i.pair.b}`;
		case 'resonance':
			return i.key;
		case 'facet':
			return i.facet;
		case 'check':
			return i.check.text.en;
	}
}

/** Header order: reactions, resonance, capabilities, checks; within a kind
 *  gains before losses, capabilities in the fingerprint's one order. */
function itemRank(i: DeltaItem): number {
	const within = i.kind === 'facet' ? FACET_ORDER.indexOf(i.facet) : 0;
	return KIND_ORDER.indexOf(i.kind) * 1000 + (i.sign > 0 ? 0 : 500) + within;
}

/** The facets lit in this team. */
function litFacets(ids: readonly string[], conOf: (id: string) => number): Set<FacetKey> {
	return new Set(
		teamFingerprint(ids, conOf).flatMap((c) =>
			c.slots.filter((s) => s.state === 'lit').map((s) => s.facet)
		)
	);
}

/** Is every alternative of this check something the header already names —
 *  a capability (shields, healing, crowd control → Grouping) or a reaction?
 *  ⚓ Then a change to it would say the same thing twice, and only the
 *  preview shows it. Anything else (an element's characters, Nightsoul,
 *  melee, Bond of Life…) enters the header. */
export function checkNamedElsewhere(check: BattlefieldCheck): boolean {
	return checkAlternatives(check.text.en).every((parts) => {
		const text = parts
			.flatMap((p) => ('text' in p ? [p.text] : []))
			.join(' ')
			.trim()
			.toLowerCase();
		return (
			text.includes('reaction') ||
			text === 'shields' ||
			text.startsWith('shield character') ||
			text.startsWith('healing character') ||
			/^crowd[- ]control character/.test(text)
		);
	});
}

/** Did a check move, and which way? +1 the team now stands better with the
 *  boss (brings what it favours, or stopped doing what it resists), −1
 *  worse. An `unknown` either side is no change — ⛔ never guessed. */
export function checkShift(check: BattlefieldCheck, before: CheckVerdict, after: CheckVerdict) {
	if (before === after || before === 'unknown' || after === 'unknown') return 0;
	const nowMet = after === 'met' ? 1 : -1;
	return check.tag === 'favoured' ? nowMet : -nowMet;
}

/**
 * ⚓ What a swap does to the TEAM — never how the newcomer compares to the
 * one leaving. The fingerprint is TEAM-AWARE, so a teammate's buff whose
 * condition the swap breaks is a loss here too (the ripple, §1.7). Facts
 * only: no score, no net, no ranking.
 */
export function swapDelta(
	before: readonly string[],
	after: readonly string[],
	conOf: (id: string) => number,
	checks: readonly BattlefieldCheck[] = []
): SwapDelta {
	const entry = (ids: readonly string[]) =>
		ids.map((id) => getCharacterIndexEntry(id)).filter((e) => e !== null);
	const was = entry(before);
	const now = entry(after);
	// The newcomer's kit is uncurated: its absence of data proves nothing, so
	// no delta can speak for it.
	if (now.some((m) => !before.includes(m.id) && isCapabilityUnknown(m)))
		return { tier: 'uncurated', items: [] };

	const items: DeltaItem[] = [];
	const diff = <T>(a: T[], b: T[], id: (x: T) => string, push: (x: T, sign: 1 | -1) => void) => {
		const ia = new Set(a.map(id));
		const ib = new Set(b.map(id));
		for (const x of b) if (!ia.has(id(x))) push(x, 1);
		for (const x of a) if (!ib.has(id(x))) push(x, -1);
	};
	diff(
		reactionPairs(was),
		reactionPairs(now),
		(p) => `${p.a}|${p.b}`,
		(pair, sign) => items.push({ kind: 'reaction', sign, pair })
	);
	diff(
		deriveResonances(was.map((m) => m.element)).active,
		deriveResonances(now.map((m) => m.element)).active,
		(r) => r.key,
		(r, sign) =>
			items.push({ kind: 'resonance', sign, key: r.key, label: r.label, element: r.element })
	);
	const archetype = items.length > 0;
	diff(
		[...litFacets(before, conOf)],
		[...litFacets(after, conOf)],
		(f) => f,
		(facet, sign) => items.push({ kind: 'facet', sign, facet })
	);
	for (const check of checks) {
		if (checkNamedElsewhere(check)) continue;
		const sign = checkShift(
			check,
			evaluateCheck(check, before, conOf).verdict,
			evaluateCheck(check, after, conOf).verdict
		);
		if (sign) items.push({ kind: 'check', sign: sign as 1 | -1, check });
	}
	items.sort((x, y) => itemRank(x) - itemRank(y));
	const tier: SwapTier = archetype
		? 'reactions'
		: items.some((i) => i.sign < 0)
			? 'trades'
			: 'keeps';
	return { tier, items };
}

/** One run inside a section: the candidates who ADD the same things —
 *  seated together, and their gains are their cards' green glyphs. */
export type SwapRun = { key: string; gains: DeltaItem[]; entries: CharacterIndexEntry[] };

export type SwapSection = {
	key: string;
	tier: SwapTier;
	/** The header: what the swap COSTS, plus any change of reactions or
	 *  resonance (the archetype — a gain there is the header's business too). */
	items: DeltaItem[];
	/** Within it, one run per set of further gains. */
	runs: SwapRun[];
	entries: CharacterIndexEntry[];
};

const TIER_ORDER: SwapTier[] = ['keeps', 'trades', 'reactions', 'uncurated'];

const keyOf = (items: readonly DeltaItem[]) =>
	items.map((i) => `${i.sign}${i.kind}:${itemId(i)}`).join(',');
/** Lexicographic over the items' ranks, shorter first on a tie. */
function byItems(a: readonly DeltaItem[], b: readonly DeltaItem[]): number {
	for (let i = 0; i < Math.min(a.length, b.length); i++) {
		const d = itemRank(a[i]) - itemRank(b[i]);
		if (d) return d;
	}
	return a.length - b.length;
}

/**
 * The candidates for slot `slot`, grouped by what the swap does (lineups
 * design §11.6 item 20). ↻ 2026-10-13, after Nate used it: one section per
 * specific change ran to ~50 strips, ~80% of them one or two characters —
 * nearly all the variety is in what a candidate ADDS (every kit brings its
 * own), while what you LOSE falls into 4–6 groups. So a SECTION is the cost
 * (+ any archetype change) and the gains are RUNS inside it, seated
 * together and said by each card's green glyphs (↻ the runs' caption tiles
 * were tried the same day and cut — ⚓ Nate: the glyphs carry it). Within a
 * section: owned first, then by run, then the order the candidates came in
 * (the grid's, newest first) — ⛔ never "fewest losses first", which is
 * advice.
 */
export function swapSections(
	candidates: readonly CharacterIndexEntry[],
	slots: readonly TeamSlot[],
	slot: number,
	conOf: (id: string) => number,
	checks: readonly BattlefieldCheck[] = [],
	owned: (id: string) => boolean = () => false
): SwapSection[] {
	const before = slots.filter((s): s is string => !!s);
	// A plain object, not a Map: a pure fold, nothing here is state.
	const byKey: Record<string, SwapSection> = {};
	for (const c of candidates) {
		// A teammate is never offered — nor another Traveler variant while a
		// Traveler sits in a DIFFERENT slot (one Traveler per team). The slot's
		// own Traveler may swap element.
		if (
			slots.some(
				(s, i) => s && characterKey(s) === characterKey(c.id) && (s === c.id || i !== slot)
			)
		)
			continue;
		const after = slots.map((s, i) => (i === slot ? c.id : s)).filter((s): s is string => !!s);
		const d = swapDelta(before, after, conOf, checks);
		const head = d.items.filter(
			(i) => i.sign < 0 || i.kind === 'reaction' || i.kind === 'resonance'
		);
		const gains = d.items.filter((i) => !head.includes(i));
		const key = `${d.tier}:${keyOf(head)}`;
		const section = (byKey[key] ??= { key, tier: d.tier, items: head, runs: [], entries: [] });
		const runKey = `${key}|${keyOf(gains)}`;
		let run = section.runs.find((r) => r.key === runKey);
		if (!run) section.runs.push((run = { key: runKey, gains, entries: [] }));
		run.entries.push(c);
	}
	const sections = Object.values(byKey);
	for (const s of sections) {
		s.runs.sort((x, y) => byItems(x.gains, y.gains));
		// Stable, so run order and then the candidates' own order (the grid's:
		// newest first) hold within each half.
		s.entries = s.runs
			.flatMap((r) => r.entries)
			.sort((x, y) => Number(owned(y.id)) - Number(owned(x.id)));
	}
	return sections.sort(
		(x, y) => TIER_ORDER.indexOf(x.tier) - TIER_ORDER.indexOf(y.tier) || byItems(x.items, y.items)
	);
}

// ---------------------------------------------------------------------------
// A board team's name and hue
// ---------------------------------------------------------------------------

/** A team's name as its board says it: a Stygian battlefield, an Abyss half,
 *  else "Team N" (lineups design §11.6; the destination strip and the
 *  cards' screen-reader names read it). */
export function teamLabel(board: Pick<Board, 'preset' | 'season'>, index: number): string {
	if (board.preset === 'stygian') {
		const season = SEASONS.find((s) => s.version === board.season) ?? liveSeasons()[0];
		if (season?.battlefields[index]) return `Battlefield ${index + 1}`;
	}
	if (board.preset === 'abyss' && index < 2) return index === 0 ? 'First half' : 'Second half';
	return `Team ${index + 1}`;
}

const TEAM_HUES = ['first', 'second', 'third', 'fourth'] as const;

/** A team's hue (app.css `--team-hue-*`): four, cycling past the fourth. */
export const teamHue = (index: number): string =>
	`var(--team-hue-${TEAM_HUES[index % TEAM_HUES.length]})`;
