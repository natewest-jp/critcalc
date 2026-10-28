/**
 * notationFlags.test.ts
 *
 * The linter's job is to say what the parser silently approximates, so the
 * tests are anchored to REAL characters rather than fixtures: Albedo declares
 * no hold variant, Bennett declares two (h1E/h2E), Flins declares the short
 * burst. If a curation change ever moves one of those, this file should fail —
 * that is the point of linting against the shipped index.
 */

import { describe, it, expect } from 'vitest';
import { flagNotation, flagSeverity } from './notationFlags';

const reasons = (n: string) => flagNotation(n).map((f) => f.reason);
const texts = (n: string) => flagNotation(n).map((f) => f.text);

describe('notationFlags', () => {
	it('says nothing about a rotation the timeline can draw exactly', () => {
		expect(flagNotation('Bennett E Q > Xingqiu E Q > Zhongli E > Hu Tao E N2C Q')).toEqual([]);
	});

	it('flags a hold on a character with no hold variant', () => {
		expect(reasons('Albedo hE Q')).toEqual(['approximate-cast']);
		expect(flagNotation('Albedo hE Q')[0].message).toMatch(/no hE \(hold\) variant/);
	});

	it('says nothing about a hold the character DOES declare', () => {
		expect(flagNotation('Bennett h1E h2E Q')).toEqual([]);
	});

	it('treats tap/press as aliases of a plain E everywhere', () => {
		expect(flagNotation('Albedo tE pE E')).toEqual([]);
	});

	it('flags a short burst on a character with no short-burst variant', () => {
		expect(reasons('Albedo sQ')).toEqual(['approximate-cast']);
		expect(flagNotation('Albedo sQ')[0].message).toMatch(/no short-burst variant/);
	});

	it('says nothing about the short burst where it is declared', () => {
		expect(flagNotation('Flins E sQ')).toEqual([]);
	});

	it('looks INSIDE a bracket repeat group', () => {
		// `2[hE C]` reaches the tokenizer as one label token; a linter that only
		// walked top-level tokens would have a hole exactly where a rotation
		// repeats itself.
		const flags = flagNotation('Albedo 2[hE C]');
		expect(flags).toHaveLength(1);
		expect(flags[0].text).toBe('hE');
		// …and it points at the token, not at the whole group.
		expect('Albedo 2[hE C]'.slice(flags[0].from, flags[0].to)).toBe('hE');
	});

	it('ignores casts the parser itself drops (optional groups, or-alternatives)', () => {
		expect(flagNotation('Albedo (hE) E /sQ')).toEqual([]);
	});

	it('flags an unresolvable name in the WARNING register, not the provisional one', () => {
		const flags = flagNotation('Bennett E > Zhonli E');
		expect(flags).toHaveLength(1);
		expect(flags[0].reason).toBe('unknown-character');
		expect(flagSeverity(flags[0].reason)).toBe('warning');
	});

	it('does not lint the casts of a segment it could not resolve a name for', () => {
		// Nothing was approximated — the whole segment is skipped.
		expect(reasons('Zhonli hE sQ')).toEqual(['unknown-character']);
	});

	it('flags the FIFTH distinct character and nobody before them', () => {
		const flags = flagNotation('Bennett E > Xingqiu E > Zhongli E > Albedo E > Nahida E');
		expect(flags).toHaveLength(1);
		expect(flags[0].reason).toBe('no-slot');
		expect(flags[0].text).toBe('Nahida');
		expect(flagSeverity(flags[0].reason)).toBe('provisional');
	});

	it('does not count a repeat appearance toward the team size', () => {
		expect(flagNotation('Bennett E > Xingqiu E > Bennett Q > Zhongli E > Albedo E')).toEqual([]);
	});

	it('reports flags in source order', () => {
		const flags = flagNotation('Albedo hE > Zhonli E > Albedo sQ');
		expect(texts('Albedo hE > Zhonli E > Albedo sQ')).toEqual(['hE', 'Zhonli', 'sQ']);
		expect(flags.map((f) => f.from)).toEqual([...flags.map((f) => f.from)].sort((a, b) => a - b));
	});

	it('gives every flag a span that actually covers its token', () => {
		const n = 'Albedo hE > Zhonli E > Bennett > Xingqiu > Zhongli > Nahida';
		for (const f of flagNotation(n)) expect(n.slice(f.from, f.to)).toBe(f.text);
	});
});

// ── A and W (⚓ Nate 2026-08-13; W simulated 2026-10-18, its walk points 2026-10-19) ──
describe('A, which the planner may not be able to draw, and W, which it times from data', () => {
	it('says nothing about A on a bow — it IS that bow’s charged shot', () => {
		expect(flagNotation('Ganyu A N1 A')).toEqual([]);
	});

	it('flags A on anyone else, in the WARNING register (nothing is drawn)', () => {
		const flags = flagNotation('Bennett A');
		expect(flags).toHaveLength(1);
		expect(flags[0].reason).toBe('unsupported-token');
		expect(flagSeverity(flags[0].reason)).toBe('warning');
		expect(flags[0].message).toMatch(/Only a bow can take an aimed shot/);
	});

	it('says nothing about W — its walk point is gcsim’s, per character', () => {
		expect(flagNotation('Ganyu A W N1')).toEqual([]);
	});

	it('finds A inside a bracket repeat group, and still nothing for W', () => {
		expect(reasons('Bennett 2[A W]')).toEqual(['unsupported-token']);
	});
});

// ── C and sC (⚓ Nate 2026-10-15) ─────────────────────────────────────────────
describe('charged attacks drawn with a stand-in', () => {
	it('says nothing about a C the character has measured frames for', () => {
		expect(flagNotation('Hu Tao E N2C C1 C2')).toEqual([]);
	});

	it('flags a C with no measured frames as PROVISIONAL, in the plunge line’s shape', () => {
		// Diluc's spin has no `chargeFrames`: the parser takes the token on the
		// generic profile, so this is a stand-in, not a refusal.
		const flags = flagNotation('Diluc E C');
		expect(flags).toHaveLength(1);
		expect(flags[0].text).toBe('C');
		expect(flags[0].reason).toBe('approximate-cast');
		expect(flagSeverity(flags[0].reason)).toBe('provisional');
		expect(flags[0].message).toBe(
			"Diluc's charged attack isn't measured yet — drawn with generic timing."
		);
	});

	it('catches every charged token, including concatenated and bracketed ones', () => {
		expect(texts('Diluc N2C C1 2[N1C]')).toEqual(['C', 'C1', 'C']);
	});

	it('flags sC on a character with no special charged attack', () => {
		const flags = flagNotation('Hu Tao E sC');
		expect(flags).toHaveLength(1);
		expect(flags[0].text).toBe('sC');
		expect(flagSeverity(flags[0].reason)).toBe('provisional');
		expect(flags[0].message).toBe('Hu Tao has no special charged attack — timed as a plain C.');
	});

	it('says nothing about sC where it is declared', () => {
		expect(flagNotation('Varka E sC')).toEqual([]);
	});

	it('says the plain C is the stand-in when it is one', () => {
		// "timed as a plain C" would be true and useless: Diluc's plain C is
		// itself generic, so the sentence that says so wins.
		expect(flagNotation('Diluc sC')[0].message).toMatch(/charged attack isn't measured yet/);
	});

	it('says nothing about a bow’s C, A or sC — its aimed shot is measured', () => {
		expect(flagNotation('Ganyu C1 C A sC')).toEqual([]);
	});

	it('flags the twin a real profile did not choose, and only when told the profile’s', () => {
		const flags = flagNotation('Anemo Aether E > Bennett Q', undefined, 'lumine');
		expect(flags.map((f) => [f.text, f.reason, flagSeverity(f.reason)])).toEqual([
			['Anemo Aether', 'other-twin', 'provisional']
		]);
		expect(flagNotation('Anemo Lumine E > Anemo Traveler Q', undefined, 'lumine')).toEqual([]);
		expect(flagNotation('Anemo Aether E')).toEqual([]);
	});
});
