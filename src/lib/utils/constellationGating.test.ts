/**
 * constellationGating.test.ts — the entry IS the gate (2026-08-18).
 *
 * ⚓ A constellation effect is gated by its own entry's `constellationLevel`,
 * filtered at COLLECTION by `effectSourcesAtConstellation`. Before that landed,
 * ~15 copies of the idiom
 *
 *     [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])]
 *
 * walked every constellation whatever the level, so the 184 constellation
 * effects authored without their own `conditions` were live at C0 — the round's
 * probe measured 34 bars across 23 characters, and this file's wider rotation
 * puts it at 59 across 25. Record: docs/constellation-gating-plan.md.
 *
 * ⚓⚓ WHY THE CORPUS TEST IS A DIFFERENTIAL, NOT A SNAPSHOT. It compares two
 * parses of the SAME tree — the real C0 parse against a C0 parse of the same
 * character with `constellations` removed — and asserts they agree. That is
 * what makes it survive unrelated refactors: a timing change, a new lane, a
 * projection rewrite all move BOTH sides equally and the assertion holds. A
 * snapshot of expected windows would break on every one of them and teach the
 * next reader to re-bless it.
 *
 * ⚠️⚠️ THE SUITE COULD NOT SEE THIS DEFECT AND STILL CANNOT WITHOUT THIS FILE.
 * When the gate landed, not one of the 1613 existing tests moved — no C0
 * fixture touched any of the leaking bars. A green suite was not evidence then
 * and is not evidence now; this file is the one thing that would fail if a
 * future walk of the effect surface forgot the level.
 *
 * ⚓ VERIFIED BY SEEDED NEGATIVE, because a regression test nobody has watched
 * fail is a decoration. Two mutations of `unlockedConstellations`:
 *   · gate removed (`return cons`) — the original defect: 3 boundary tests and
 *     25 of the differential characters go red.
 *   · `<=` → `<` — the off-by-one: ONLY the 3 boundary tests go red. That is
 *     exactly why they exist. The differential runs at C0, where the two
 *     operators are indistinguishable (no entry is C0), so it is blind here.
 *
 * ⚠️ The 25 is TWO MORE than the round's own probe found, and the extra two are
 * the reason this file's notation is richer than `<name> E Q N5`: Ganyu C1 and
 * Mona C2 are `onHit` on a CHARGED attack, a whole trigger class the probe
 * never fired. Measured under this rotation the leak is 25 characters and 59
 * windows (plus 2 effects pooled inside surviving windows — Faruzan C6, Yun Jin
 * C2), against the probe's 23 and 34. ⚓ Applications and IR events stay at 0
 * either way: the BARS-ONLY finding survives the wider rotation.
 */

import { describe, it, expect } from 'vitest';
import { parseNotation, type ParsedRotation } from './notationParser';
import { effectSourcesAtConstellation, unlockedConstellations } from './effectCollection';
import type { CharacterData } from '$lib/types/character';

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const all: CharacterData[] = Object.values(modules).map(
	(m) => (m as { default: CharacterData }).default
);
const byName = new Map(all.map((c) => [c.displayName, c]));

// ── Roster notation generator ───────────────────────────────────────────────
// ⚠ A third mirror of the generator in notationParser.roster.test.ts (ir.test.ts
// carries the second and says so). Kept duplicated rather than extracted so each
// corpus file stays self-contained — the established shape here.
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

/**
 * ⚓ TWO REACTING PARTNERS, and they are not decoration. `onReaction` is one of
 * the seven triggers a constellation effect can carry (13 effects in the
 * corpus) and a SOLO rotation cannot fire it at all, so a single-character
 * sweep is structurally blind to the whole class. Cryo + Hydro between them
 * react with every element in the game.
 *
 * ⚠ Reachable is not the same as reached: no `onReaction` constellation is
 * among the 25 this rotation catches today (Nahida's C2 shred wants HER as the
 * reaction source and does not fire here). The partners are what makes the
 * class reachable at all when one is authored ungated — ⛔ don't drop them
 * because the count is currently zero.
 *
 * ⚠ The partners keep their own constellations on BOTH sides of the comparison.
 * Only the subject's are stripped, which is what keeps the differential about
 * one character at a time.
 */
function notationFor(c: CharacterData): string {
	const skills = declaredSkillTokens(c);
	const own = [
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
	return `${own} > Kaeya E N1 N2 N3 > Xingqiu E Q N1 N2 N3`;
}

const PARTNERS = ['Kaeya', 'Xingqiu'];

/** The user-visible parse, as a comparable value.
 *
 *  ⚠ Event/window `id`s and the `sourceCastId`/`sourceActionId` provenance they
 *  back are deliberately EXCLUDED. They are allocation order, not meaning — a
 *  divergence there would be real but the assertion would read as a false alarm
 *  on any future change to when ids are minted. */
function digest(r: ParsedRotation) {
	return {
		unknownTokens: r.unknownTokens,
		windows: r.windows
			.map((w) => {
				const anyW = w as unknown as Record<string, unknown>;
				const effects = (anyW.effects as Record<string, unknown>[] | undefined) ?? [];
				return [
					w.kind,
					// ⚠️ A `gadget` window belongs to no character (Polestar-Field
					// round) — it is the one arm with no `characterId`, and the
					// differential's signature just leaves that column empty.
					anyW.characterId ?? '',
					anyW.name ?? '',
					anyW.label ?? '',
					w.start,
					w.end,
					effects.map((e) => `${e.type}:${e.stat ?? ''}:${JSON.stringify(e.value ?? '')}`).join('+')
				].join('|');
			})
			.sort(),
		applications: r.applications
			.map((a) => {
				const anyA = a as unknown as Record<string, unknown>;
				return [anyA.time, anyA.element, anyA.units, anyA.characterId].join('|');
			})
			.sort(),
		events: r.events.map((e) => `${e.kind}|${e.time}|${e.characterId}`).sort(),
		bars: r.tracks
			.flatMap((t) => [...t.eBars, ...t.qBars])
			.map((b) => `${b.label}|${b.start}|${b.uptime}|${b.cooldown}`)
			.sort()
	};
}

describe('constellation gating — the entry is the gate', () => {
	describe('effectSourcesAtConstellation boundary', () => {
		// ⚓ The differential sweep below runs at C0 only, where `<` and `<=`
		// behave identically (no entry is C0). This is what catches an
		// off-by-one: a C4 effect must be live AT C4, not at C5.
		const withCons = all.filter((c) => (c.constellations?.length ?? 0) > 0);

		it('every constellation entry carries a numeric level', () => {
			// The gate reads `constellationLevel`; an entry without one would be
			// silently dropped at every level rather than loudly failing.
			for (const c of withCons) {
				for (const con of c.constellations!) {
					expect(typeof (con as { constellationLevel?: unknown }).constellationLevel, c.id).toBe(
						'number'
					);
				}
			}
		});

		it('unlocks exactly the entries at or below the level', () => {
			for (const c of withCons) {
				for (let lvl = 0; lvl <= 6; lvl++) {
					const got = unlockedConstellations(c, lvl).map((a) => a.name);
					const want = c
						.constellations!.filter(
							(a) => (a as { constellationLevel: number }).constellationLevel <= lvl
						)
						.map((a) => a.name);
					expect(got, `${c.id} @C${lvl}`).toEqual(want);
				}
			}
		});

		it('a level-N entry is live at N and dead at N-1', () => {
			for (const c of withCons) {
				for (const con of c.constellations!) {
					const lvl = (con as { constellationLevel: number }).constellationLevel;
					expect(effectSourcesAtConstellation(c, lvl), `${c.id} C${lvl} @C${lvl}`).toContain(con);
					expect(
						effectSourcesAtConstellation(c, lvl - 1),
						`${c.id} C${lvl} @C${lvl - 1}`
					).not.toContain(con);
				}
			}
		});

		it('C0 admits no constellation and C6 admits them all', () => {
			for (const c of withCons) {
				expect(unlockedConstellations(c, 0), c.id).toEqual([]);
				expect(unlockedConstellations(c, 6).length, c.id).toBe(c.constellations!.length);
			}
		});
	});

	describe('corpus differential — a C0 parse owes nothing to constellations', () => {
		for (const c of all) {
			if (!c.constellations?.length) continue;
			it(`${c.id}: C0 parse equals its constellation-stripped parse`, () => {
				const notation = notationFor(c);
				const team = [c, ...PARTNERS.map((n) => byName.get(n) ?? null)];

				// ⚠ A SHALLOW clone with `constellations` emptied — never a mutation
				// of the eagerly-imported module object, which every other test in
				// this worker shares. Nothing nested is touched, so the effect object
				// identities `effectCollection`'s faction-provenance WeakMap keys on
				// survive the clone.
				const stripped: CharacterData = { ...c, constellations: [] };
				const strippedTeam = [stripped, ...PARTNERS.map((n) => byName.get(n) ?? null)];

				const lookup = (name: string) => byName.get(name) ?? null;
				const strippedLookup = (name: string) =>
					name === c.displayName ? stripped : (byName.get(name) ?? null);

				const real = parseNotation(notation, lookup, 8, {}, undefined, team);
				const without = parseNotation(notation, strippedLookup, 8, {}, undefined, strippedTeam);

				expect(digest(real)).toEqual(digest(without));
			});
		}
	});
});
