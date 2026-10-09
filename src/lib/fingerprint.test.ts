import { describe, it, expect } from 'vitest';
import { FINGERPRINT, teamFingerprint } from './fingerprint';
import { evaluateCheck } from './endgameChecks';
import { SEASONS } from './endgame';

/**
 * The fingerprint (lineups design §4) and the battlefield checks (§2.6). The
 * rules pinned here: fifteen slots in ONE order; a slot is lit for whoever
 * provides it in THIS team, and the dots count them; a check is met only on a
 * rule we trust and is otherwise left unknown — never guessed.
 */
const at0 = () => 0;
const slot = (fp: ReturnType<typeof teamFingerprint>, facet: string) =>
	fp.flatMap((c) => c.slots).find((s) => s.facet === facet)!;

describe('the fingerprint', () => {
	it('is fifteen slots, Survival · Support · Damage', () => {
		expect(FINGERPRINT.map((c) => c.cluster)).toEqual(['survival', 'support', 'damage']);
		expect(FINGERPRINT.flatMap((c) => c.facets)).toHaveLength(15);
	});

	it('lights a slot for its providers and counts them', () => {
		const fp = teamFingerprint(['bennett', 'xiangling', 'xingqiu', 'sucrose'], at0);
		const heal = slot(fp, 'heal');
		expect(heal.state).toBe('lit');
		expect(heal.providers).toContain('bennett');
		expect(slot(fp, 'buff:atk').providers).toContain('bennett');
	});

	it('keeps every slot, absent ones included, in place', () => {
		const fp = teamFingerprint(['xiangling'], at0);
		expect(fp.flatMap((c) => c.slots)).toHaveLength(15);
		expect(slot(fp, 'taunt').state).toBe('absent');
	});
});

describe('battlefield checks', () => {
	const check = (en: string, tag: 'favoured' | 'disfavoured' = 'favoured') => ({
		tag,
		text: { en }
	});

	it('an element character is met by a member of that element', () => {
		const c = check('{sprite:11004} characters');
		expect(evaluateCheck(c, ['raiden_shogun'], at0).verdict).toBe('met');
		expect(evaluateCheck(c, ['bennett'], at0).verdict).toBe('unmet');
	});

	it('a reaction pair is met when the team can make it', () => {
		const ec = check('{sprite:11034} reactions | {sprite:11004} characters');
		expect(evaluateCheck(ec, ['xingqiu', 'fischl'], at0).verdict).toBe('met');
		const r = evaluateCheck(check('{sprite:11034} reactions'), ['xingqiu', 'bennett'], at0);
		expect(r.verdict).toBe('unmet');
	});

	it('leaves a check it cannot decide unknown, never guessed', () => {
		expect(evaluateCheck(check('Multi Elemental DMG'), ['bennett'], at0).verdict).toBe('unknown');
		// …but a decidable alternative beside it still decides
		const mixed = check('Multi Elemental DMG | Bow characters');
		expect(evaluateCheck(mixed, ['fischl'], at0).verdict).toBe('met');
		expect(evaluateCheck(mixed, ['bennett'], at0).verdict).toBe('unknown');
	});

	it('reads every check in the data without throwing', () => {
		for (const s of SEASONS)
			for (const b of s.battlefields)
				for (const c of b.checks) expect(() => evaluateCheck(c, ['bennett'], at0)).not.toThrow();
	});
});
