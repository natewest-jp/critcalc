/**
 * notationParser.roster.test.ts — Method #3: parser-invariant roster sweep.
 *
 * The existing `roster-wide parse smoke test` (characterLint.test.ts) parses
 * ONE fixed notation (`E Q N1 C E`) per character. That never feeds Hold-E,
 * tap/press, or multi-hold skill variants (`hE`/`h1E`/`h2E`/`tE`/`pE`) — 30+
 * cast paths across the roster run zero parser coverage. This sweep drives a
 * RICHER notation built from each character's OWN declared input tokens and
 * asserts a battery of invariants, generalizing last session's
 * unreachable-variant fix from a hand-found bug into a class-level guard:
 *
 *   HARD (gate):
 *     - parsing never throws
 *     - exactly one track is produced
 *     - every bar/block/duration number is finite (no NaN poison)
 *     - `unknownTokens` is empty (no silent token drops)
 *     - every fed E/Q cast produces a bar (no silently-swallowed casts)
 *     - a declared Hold token (hE/h1E/h2E) resolves to DIFFERENT timing than
 *       the tap cast — identical timing = the hold variant silently fell back
 *       to the base skill (the unreachable-variant bug class). Effect-only
 *       holds that legitimately share timing go in HOLD_TIMING_EXEMPT.
 */

import { describe, it, expect } from 'vitest';
import { parseNotation } from './notationParser';
import type { CharacterData } from '$lib/types/character';

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const all: CharacterData[] = Object.values(modules).map(
	(m) => (m as { default: CharacterData }).default
);

/** Skill-entry input tokens (the ones a fixed `E Q N1 C E` never exercises). */
const SKILL_TOKENS = ['E', 'tE', 'pE', 'hE', 'h1E', 'h2E'] as const;

/** Distinct skill-entry tokens a character declares across its skill abilities
 *  and their variants — what the parser should actually be able to resolve. */
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

/** Burst-entry tokens beyond plain `Q` declared across burst variants (the
 *  KQM `sQ` short-burst — Flins Thunderous Symphony, Varesa Volcano Kablam). */
function declaredExtraBurstTokens(c: CharacterData): string[] {
	const toks = new Set<string>();
	for (const a of c.abilities) {
		if (a.abilityType !== 'burst') continue;
		for (const v of a.variants ?? []) for (const t of v.input ?? []) toks.add(t);
	}
	toks.delete('Q');
	return [...toks].sort();
}

/** A per-character notation that exercises each declared skill token, a normal
 *  chain after skill entry (catches stance-N variants), charged, plunge, burst,
 *  a re-cast to exercise cooldown/charge accounting, and any declared short-
 *  burst tokens (fed AFTER the skill re-cast so window-opening skills — Flins
 *  Spearstorm — have just fired). */
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

const lookupFor = (c: CharacterData) => (name: string) => (name === c.displayName ? c : null);

describe('roster parser invariants — hard gate', () => {
	for (const c of all) {
		it(`${c.id}: parses declared inputs without throw / non-finite / unknown tokens`, () => {
			const notation = rosterNotation(c);
			const result = parseNotation(notation, lookupFor(c), 8);

			expect(result.tracks).toHaveLength(1);
			const track = result.tracks[0];

			// no silent token drops
			expect(result.unknownTokens).toEqual([]);

			// no NaN poison anywhere the renderer reads
			for (const bar of [...track.eBars, ...track.qBars]) {
				expect(Number.isFinite(bar.start), `${bar.label}.start`).toBe(true);
				expect(Number.isFinite(bar.uptime), `${bar.label}.uptime`).toBe(true);
				expect(Number.isFinite(bar.cooldown), `${bar.label}.cooldown`).toBe(true);
				expect(Number.isFinite(bar.castTime), `${bar.label}.castTime`).toBe(true);
			}
			for (const block of track.inputBlocks) {
				expect(Number.isFinite(block.start)).toBe(true);
				expect(Number.isFinite(block.duration)).toBe(true);
			}
			expect(Number.isFinite(result.totalDuration)).toBe(true);

			// fed casts must actually produce bars (not silently swallowed)
			expect(track.eBars.length, 'E produced no bar').toBeGreaterThan(0);
			expect(track.qBars.length, 'Q produced no bar').toBeGreaterThan(0);
		});
	}
});

// `E`/`tE`/`pE` are interchangeable ALIASES for the same non-hold cast (KQM
// notation lets users write any of them), so they SHOULD share timing. The
// meaningful invariant is that a declared HOLD token resolves to *different*
// timing than the tap cast — identical timing means the hold variant silently
// fell back to the base skill (the unreachable-variant bug class). Every hold
// variant in the corpus differs in cast-time/cooldown/uptime today; this set
// exempts any future effect-only hold (same timing, different element/effect).
const TAP_TOKENS = new Set(['E', 'tE', 'pE']);
const HOLD_TOKENS = ['hE', 'h1E', 'h2E'];
const HOLD_TIMING_EXEMPT = new Set<string>(); // "<charId>:<holdToken>" — empty today

const timingSig = (b: { castTime: number; cooldown: number; uptime: number }) =>
	`${b.castTime}|${b.cooldown}|${b.uptime}`;

describe('roster parser invariants — hold variants must differ from tap', () => {
	it('no declared Hold token resolves to the same timing as its tap cast', () => {
		const violations: string[] = [];
		let holdsChecked = 0;

		for (const c of all) {
			const skills = declaredSkillTokens(c);
			const holds = skills.filter((t) => HOLD_TOKENS.includes(t));
			if (holds.length === 0) continue;

			const eBars = parseNotation(rosterNotation(c), lookupFor(c), 8).tracks[0]?.eBars ?? [];
			const firstByLabel = new Map<
				string,
				{ castTime: number; cooldown: number; uptime: number }
			>();
			for (const b of eBars) if (!firstByLabel.has(b.label)) firstByLabel.set(b.label, b);

			// tap signature: the first tap-class token that produced a bar
			const tapToken = skills.find((t) => TAP_TOKENS.has(t) && firstByLabel.has(t));
			const tapBar = tapToken ? firstByLabel.get(tapToken) : undefined;
			if (!tapBar) continue;

			for (const h of holds) {
				const holdBar = firstByLabel.get(h);
				if (!holdBar) {
					violations.push(`${c.id}: fed hold "${h}" but no bar was produced`);
				} else if (
					timingSig(holdBar) === timingSig(tapBar) &&
					!HOLD_TIMING_EXEMPT.has(`${c.id}:${h}`)
				) {
					violations.push(
						`${c.id}: hold "${h}" resolves to the same timing as tap "${tapToken}" (${timingSig(holdBar)}) — variant not differentiating`
					);
				}
				holdsChecked++;
			}
		}

		if (violations.length) console.log('\n[hold-distinctness]\n  ' + violations.join('\n  '));
		expect(holdsChecked).toBeGreaterThan(0); // guard: the check is actually exercising holds
		expect(violations).toEqual([]);
	});
});
