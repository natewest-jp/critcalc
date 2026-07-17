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
 *   - Every eBar/qBar maps to exactly one `cast` event (bijection on
 *     time/label/kind) and there are no orphan `cast` events.
 *   - Summon windows match an INDEPENDENT geometry reconstruction from bar
 *     spans (spawn offset + terminatesOn swap/recast truncation) — the same
 *     computation `computeSummonSubrows` used to own pre-3c, now re-derived
 *     test-side so parser-authored spans stay covered after the renderer
 *     stopped reconstructing them.
 *   - Every stance owner bar's `start + uptime` equals its stance window's end
 *     (the finalize uptime stamp agrees with the window record); for cross-
 *     character rotations a swap-clamped stance may end earlier, so the relaxed
 *     bound `end <= start + uptime` is asserted there. (The summon spawn offset
 *     shifts only the bar's rendered active-overlay, not the state window.)
 */

import { describe, it, expect } from 'vitest';
import { parseNotation, type ParsedRotation, type TimelineBar } from './notationParser';
import type { CharacterData } from '$lib/types/character';
import { findCastSummon } from '$lib/timeline/summonSubrows';

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
function declaredExtraBurstTokens(c: CharacterData): string[] {
	const toks = new Set<string>();
	for (const a of c.abilities) {
		if (a.abilityType !== 'burst') continue;
		for (const v of a.variants ?? []) for (const t of v.input ?? []) toks.add(t);
	}
	toks.delete('Q');
	return [...toks].sort();
}
function rosterNotation(c: CharacterData): string {
	const skills = declaredSkillTokens(c);
	return [
		c.displayName,
		...skills,
		'N1',
		'N2',
		'N3',
		'C',
		'P',
		'Q',
		skills[0],
		...declaredExtraBurstTokens(c)
	].join(' ');
}

const rosterLookup = (name: string): CharacterData | null => byName.get(name) ?? null;

type SummonTuple = {
	characterId: string;
	label: string;
	start: number;
	end: number;
	source: 'skill' | 'burst';
};
const tupleKey = (t: SummonTuple) =>
	`${t.characterId}|${t.label}|${t.source}|${t.start.toFixed(6)}|${t.end.toFixed(6)}`;

/** Independently reconstruct the expected summon spans from bar geometry — the
 *  spawn-offset + terminatesOn swap/recast truncation `computeSummonSubrows`
 *  owned pre-3c, re-derived here from `result.tracks` (a distinct code path from
 *  the parser's finalize summon pass, sharing only the `findCastSummon`
 *  resolution primitive). Swap-out is keyed by characterId, matching the
 *  parser; over the corpus + multi-segment fixtures characterId ↔ slotIdx is a
 *  bijection so this equals the renderer's former slotIdx-keyed computation. */
function reconstructSummonWindows(result: ParsedRotation): SummonTuple[] {
	const out: SummonTuple[] = [];
	const lastByKey = new Map<string, SummonTuple>();
	const tracks = result.tracks;
	for (let ti = 0; ti < tracks.length; ti++) {
		const track = tracks[ti];
		const char = byId.get(track.characterId) ?? null;
		let swapOutAt = Infinity;
		for (let k = ti + 1; k < tracks.length; k++) {
			if (tracks[k].characterId !== track.characterId) {
				swapOutAt = tracks[k].activeStart;
				break;
			}
		}
		const emit = (bar: TimelineBar, kind: 'skill' | 'burst'): void => {
			if (bar.uptime <= 0) return;
			const summon = findCastSummon(char, kind, bar.label);
			if (!summon) return;
			const spawnAt = bar.start + (bar.summonActivatesAt ?? 0) / 60;
			let endAt = spawnAt + bar.uptime;
			if (summon.terminatesOn === 'swap' && swapOutAt < endAt) endAt = swapOutAt;
			if (endAt <= spawnAt) return;
			const key = `${track.characterId}::${summon.label}`;
			if (summon.terminatesOn === 'recast') {
				const prev = lastByKey.get(key);
				if (prev && prev.end > spawnAt) prev.end = spawnAt;
			}
			const t: SummonTuple = {
				characterId: track.characterId,
				label: summon.label,
				start: spawnAt,
				end: endAt,
				source: kind
			};
			out.push(t);
			lastByKey.set(key, t);
		};
		for (const bar of track.eBars) emit(bar, 'skill');
		for (const bar of track.qBars) emit(bar, 'burst');
	}
	return out;
}

/** Assert the parser's `summon` windows equal the independent bar-geometry
 *  reconstruction — direct geometry coverage now that the renderer no longer
 *  reconstructs. */
function assertSummonWindowsMatchGeometry(result: ParsedRotation): void {
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

	const expected = reconstructSummonWindows(result);
	expect(parserTuples.map(tupleKey).sort()).toEqual(expected.map(tupleKey).sort());
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

	// Event ids are unique (identity invariant, post-P4 #1).
	const ids = new Set(events.map((e) => e.id));
	expect(ids.size, 'event ids unique').toBe(events.length);

	// Window provenance: every cast-opened window's sourceCastId references an
	// existing `cast` event by the same character, whose time is <= the window
	// start (a window can't open before the cast that opened it).
	const castById = new Map(events.filter((e) => e.kind === 'cast').map((e) => [e.id, e] as const));
	for (const w of windows) {
		if (w.sourceCastId === undefined) continue;
		const src = castById.get(w.sourceCastId);
		expect(src, `${w.kind} window sourceCastId ${w.sourceCastId} resolves to a cast`).toBeTruthy();
		if (!src) continue;
		expect(src.characterId, `${w.kind} window owner matches its source cast`).toBe(w.characterId);
		expect(src.time).toBeLessThanOrEqual(w.start + EPS);
	}

	// Bar ↔ cast-event bijection + full field agreement (post-P4 #3: bars are
	// projections of cast events, so every geometric field must match).
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
				const c = hits[0];
				if (c.kind !== 'cast') continue;
				expect(c.uptime, 'bar/cast uptime agree').toBe(bar.uptime);
				expect(c.cooldown, 'bar/cast cooldown agree').toBe(bar.cooldown);
				expect(c.castTime, 'bar/cast castTime agree').toBe(bar.castTime);
				expect(c.summonActivatesAt, 'bar/cast spawn offset agree').toBe(bar.summonActivatesAt ?? 0);
				expect(c.sacProcFired ?? false, 'bar/cast sacProcFired agree').toBe(
					bar.sacProcFired ?? false
				);
				expect(c.stackContext, 'bar/cast stackContext agree').toBe(bar.stackContext);
				// readyAt sanity: never before the cast; equals the hitmark on a
				// sac proc, else >= time + cooldown (delay-adjusted).
				expect(c.readyAt).toBeGreaterThanOrEqual(c.time - EPS);
				if (!c.sacProcFired) expect(c.readyAt).toBeGreaterThanOrEqual(c.time + c.cooldown - EPS);
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
			assertSummonWindowsMatchGeometry(result);
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
			assertSummonWindowsMatchGeometry(result);
		});
	}
});
