/**
 * notationParser.ir.test.ts — P4 event-stream IR invariants (corpus-driven).
 *
 * Companion to `notationParser.roster.test.ts` (which guards the legacy bar/
 * block output). This sweep drives the same per-character roster notation — plus
 * a handful of multi-character rotations that exercise swaps, cross-element
 * reactions, shields, and summons — and asserts the Phase-2 IR contract:
 *
 *   - `events` are time-sorted with finite times; `windows` all have end >= start
 *     and finite bounds.
 *   - The legacy `reactionEvents` / `hitEvents` / `shieldEndEvents` arrays are
 *     EXACTLY the filtered `events` projections (consistency by construction).
 *   - Every eBar/qBar maps to exactly one `cast` event (bijection on
 *     time/label/kind) and there are no orphan `cast` events.
 *   - Summon windows agree with `computeSummonSubrows` (the renderer's
 *     independent spawn/end/truncation computation) — the parser now authors
 *     what the renderer used to reconstruct.
 *   - Every stance owner bar's `start + uptime` equals its stance window's end
 *     (the finalize uptime stamp agrees with the window record); for cross-
 *     character rotations a swap-clamped stance may end earlier, so the relaxed
 *     bound `end <= start + uptime` is asserted there. (The summon spawn offset
 *     shifts only the bar's rendered active-overlay, not the state window.)
 */

import { describe, it, expect } from 'vitest';
import { parseNotation, type ParsedRotation, type TimelineBar } from './notationParser';
import type { CharacterData } from '$lib/types/character';
import { computeSummonSubrows } from '$lib/timeline/summonSubrows';
import type { SlottedTrack } from '$lib/timeline/types';

const EPS = 1e-6;

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const all: CharacterData[] = Object.values(modules).map(
	(m) => (m as { default: CharacterData }).default
);
const byId = new Map(all.map((c) => [c.id, c]));
const byName = new Map(all.map((c) => [c.displayName, c]));

// Roster notation generator — mirrors notationParser.roster.test.ts.
const SKILL_TOKENS = ['E', 'tE', 'pE', 'hE', 'h1E', 'h2E'] as const;
function declaredSkillTokens(c: CharacterData): string[] {
	const toks = new Set<string>();
	for (const a of c.abilities) {
		if (a.abilityType !== 'skill') continue;
		for (const t of a.input ?? []) toks.add(t);
		for (const v of a.variants ?? []) for (const t of v.input ?? []) toks.add(t);
	}
	const ordered = SKILL_TOKENS.filter((t) => toks.has(t));
	return ordered.length ? ordered : ['E'];
}
function rosterNotation(c: CharacterData): string {
	const skills = declaredSkillTokens(c);
	return [c.displayName, ...skills, 'N1', 'N2', 'N3', 'C', 'P', 'Q', skills[0]].join(' ');
}

const rosterLookup = (name: string): CharacterData | null => byName.get(name) ?? null;

/** Build slot-annotated tracks (one slot per unique character, first-appearance
 *  order) — the shape `computeSummonSubrows` consumes. */
function slotted(result: ParsedRotation): SlottedTrack[] {
	const slotOf = new Map<string, number>();
	return result.tracks.map((t) => {
		if (!slotOf.has(t.characterId)) slotOf.set(t.characterId, slotOf.size);
		return { ...t, slotIdx: slotOf.get(t.characterId)! };
	});
}

type SummonTuple = {
	characterId: string;
	label: string;
	start: number;
	end: number;
	source: string;
};
const tupleKey = (t: SummonTuple) =>
	`${t.characterId}|${t.label}|${t.source}|${t.start.toFixed(6)}|${t.end.toFixed(6)}`;

/** Cross-check the parser's summon windows against the renderer's independent
 *  computeSummonSubrows spawn/end/truncation output. */
function assertSummonWindowsMatchRenderer(
	result: ParsedRotation,
	consLevels: Record<string, number>
): void {
	const parserTuples: SummonTuple[] = result.windows
		.filter(
			(w): w is Extract<(typeof result.windows)[number], { kind: 'summon' }> => w.kind === 'summon'
		)
		.map((w) => ({
			characterId: w.characterId,
			label: w.label,
			start: w.start,
			end: w.end,
			source: w.source
		}));

	const subrows = computeSummonSubrows(slotted(result), consLevels, (id) => byId.get(id) ?? null);
	const rendererTuples: SummonTuple[] = subrows.flatMap((row) =>
		row.bars.map((b) => ({
			characterId: row.characterId,
			label: row.label,
			start: b.start,
			end: b.end,
			source: b.source
		}))
	);

	expect(parserTuples.map(tupleKey).sort()).toEqual(rendererTuples.map(tupleKey).sort());
}

function assertCore(result: ParsedRotation, opts: { strictStanceGeom: boolean }): void {
	const { events, windows } = result;

	// events time-sorted + finite.
	for (let i = 0; i < events.length; i++) {
		expect(Number.isFinite(events[i].time), `event[${i}].time finite`).toBe(true);
		if (i > 0) expect(events[i].time).toBeGreaterThanOrEqual(events[i - 1].time - EPS);
	}

	// windows finite + end >= start.
	for (const w of windows) {
		expect(Number.isFinite(w.start), `${w.kind} window start finite`).toBe(true);
		expect(Number.isFinite(w.end), `${w.kind} window end finite`).toBe(true);
		expect(w.end).toBeGreaterThanOrEqual(w.start - EPS);
	}

	// Legacy arrays === filtered event projections.
	const projReaction = events
		.filter((e) => e.kind === 'reaction')
		.map((e) =>
			e.kind === 'reaction'
				? { characterId: e.characterId, reaction: e.reaction, time: e.time, castKind: e.castKind }
				: null
		);
	const projHit = events
		.filter((e) => e.kind === 'hit')
		.map((e) =>
			e.kind === 'hit'
				? { characterId: e.characterId, element: e.element, time: e.time, castKind: e.castKind }
				: null
		);
	const projShield = events
		.filter((e) => e.kind === 'shieldEnd')
		.map((e) =>
			e.kind === 'shieldEnd'
				? { characterId: e.characterId, ability: e.ability, time: e.time }
				: null
		);
	expect(result.reactionEvents).toEqual(projReaction);
	expect(result.hitEvents).toEqual(projHit);
	expect(result.shieldEndEvents).toEqual(projShield);

	// Bar ↔ cast-event bijection.
	const casts = events.filter((e) => e.kind === 'cast');
	let matched = 0;
	for (const track of result.tracks) {
		const lanes: [TimelineBar[], 'skill' | 'burst'][] = [
			[track.eBars, 'skill'],
			[track.qBars, 'burst']
		];
		for (const [bars, kind] of lanes) {
			for (const bar of bars) {
				const hits = casts.filter(
					(c) =>
						c.kind === 'cast' &&
						c.ability === kind &&
						c.characterId === track.characterId &&
						c.label === bar.label &&
						Math.abs(c.time - bar.start) < EPS
				);
				expect(hits.length, `bar ${track.characterId} ${kind} ${bar.label}@${bar.start}`).toBe(1);
				matched++;
			}
		}
	}
	expect(casts.length, 'no orphan cast events').toBe(matched);

	// Stance geometry: the finalize uptime stamp agrees with the window end.
	// The stance STATE window runs [castStart, castStart + duration]; the summon
	// spawn offset shifts only the bar's rendered active-overlay, not the state
	// window, so the relationship is `window.end === bar.start + bar.uptime`.
	for (const w of windows) {
		if (w.kind !== 'stance') continue;
		const bars =
			w.source === 'burst'
				? result.tracks.filter((t) => t.characterId === w.characterId).flatMap((t) => t.qBars)
				: result.tracks.filter((t) => t.characterId === w.characterId).flatMap((t) => t.eBars);
		const owner = bars.find((b) => Math.abs(b.start - w.start) < EPS);
		expect(owner, `stance owner bar for ${w.characterId}@${w.start}`).toBeTruthy();
		if (!owner) continue;
		const geomEnd = owner.start + owner.uptime;
		if (opts.strictStanceGeom) {
			expect(Math.abs(geomEnd - w.end)).toBeLessThan(1e-6);
		} else {
			expect(w.end).toBeLessThanOrEqual(geomEnd + EPS);
		}
	}
}

describe('parser IR invariants — roster sweep', () => {
	for (const c of all) {
		it(`${c.id}: IR is consistent for its declared inputs`, () => {
			const result = parseNotation(rosterNotation(c), rosterLookup, 8);
			assertCore(result, { strictStanceGeom: true });
			assertSummonWindowsMatchRenderer(result, {});
		});
	}
});

describe('parser IR invariants — multi-character rotations', () => {
	const rotations: { id: string; notation: string; cons?: Record<string, number> }[] = [
		{ id: 'pyro-hydro-swap', notation: 'Xiangling E Q > Xingqiu E Q' },
		{ id: 'shields', notation: 'Noelle E Q > Zhongli E Q' },
		{ id: 'summon-swap', notation: 'Fischl E Q > Bennett E Q > Fischl E' },
		{ id: 'stance-swap', notation: 'Cyno Q E E > Bennett Q' },
		{ id: 'collei-zone', notation: 'Collei E Q > Xingqiu E Q > Collei E' }
	];
	for (const r of rotations) {
		it(`${r.id}: IR consistent across swaps`, () => {
			const result = parseNotation(r.notation, rosterLookup, 8, r.cons);
			assertCore(result, { strictStanceGeom: false });
			assertSummonWindowsMatchRenderer(result, r.cons ?? {});
		});
	}
});
