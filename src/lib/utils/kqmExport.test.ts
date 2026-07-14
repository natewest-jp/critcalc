import { describe, it, expect } from 'vitest';
import { toKqmNotation } from './kqmExport';

// Real planner notation separates character blocks with `>` (matching the
// editor placeholder "Bennett E Q > Xiangling E Q N3 > …"). Single-character
// rotations carry no `>`.

describe('toKqmNotation', () => {
	it('leaves an already-clean multi-character rotation unchanged', () => {
		const input = 'Bennett E Q > Xiangling E Q N3 > Hu Tao E N2C N2C D N2C Q';
		expect(toKqmNotation(input)).toBe(input);
	});

	it('strips tool-only annotations, keeping the shareable KQM core', () => {
		expect(toKqmNotation('Bennett Q ~1s > Kazuha hE P {swirl:1} > Xiangling E/Q Q ~5s')).toBe(
			'Bennett Q > Kazuha hE P > Xiangling E Q'
		);
	});

	it('preserves the user grouping — fused stays fused, spaced stays spaced', () => {
		// Concatenated run: adjacent tokens stay concatenated.
		expect(toKqmNotation('Bennett EN2CN2CQ > Xiangling EQ')).toBe(
			'Bennett EN2CN2CQ > Xiangling EQ'
		);
		// Same actions written apart: the spaces are kept.
		expect(toKqmNotation('Hu Tao E N2C N2C D N2C Q')).toBe('Hu Tao E N2C N2C D N2C Q');
	});

	it('normalizes the spacing around ">" separators', () => {
		// Unspaced separator + fused hEP → normalized separator, grouping kept.
		expect(toKqmNotation('Bennett Q>Kazuha hEP')).toBe('Bennett Q > Kazuha hEP');
	});

	it('preserves multi-word character names', () => {
		expect(toKqmNotation('Hu Tao E > Yun Jin Q')).toBe('Hu Tao E > Yun Jin Q');
	});

	describe('drops tool-only extensions (not part of the KQM standard)', () => {
		it('drops ~Xs and ~?s on-field-time tokens', () => {
			expect(toKqmNotation('Fischl E N1 N2 ~2s')).toBe('Fischl E N1 N2');
			expect(toKqmNotation('Ganyu ~?s C1')).toBe('Ganyu C1');
			// A time token fused to an action drops cleanly, leaving the action.
			expect(toKqmNotation('Nahida E~3s N1')).toBe('Nahida E N1');
		});

		it('drops {key:N} stack assertions', () => {
			expect(toKqmNotation('Heizou {declension:4} E')).toBe('Heizou E');
		});

		it('drops the /alt side of an E/Q or-pair, keeping the first option', () => {
			expect(toKqmNotation('Raiden E/Q Q')).toBe('Raiden E Q');
		});
	});

	describe('passes standard tokens through verbatim', () => {
		it('keeps ( ) optional-action groups (KQM-compatible)', () => {
			expect(toKqmNotation('Xiangling E (Q) N1')).toBe('Xiangling E (Q) N1');
			// Fused optional stays fused.
			expect(toKqmNotation('Xiangling E(Q)')).toBe('Xiangling E(Q)');
		});

		it('keeps [...]xN repeat groups', () => {
			expect(toKqmNotation('Ayaka N1C [N1C]x3')).toBe('Ayaka N1C [N1C]x3');
			expect(toKqmNotation('Wanderer 3[C]')).toBe('Wanderer 3[C]');
		});

		it('keeps the E family, plunges, and cancels', () => {
			expect(toKqmNotation('Kazuha h1E hP D J W')).toBe('Kazuha h1E hP D J W');
		});
	});

	it('preserves unrecognized tokens verbatim (may be valid KQM we do not model)', () => {
		// A word our tokenizer cannot classify passes through rather than vanishing.
		expect(toKqmNotation('Zhongli E xyz')).toBe('Zhongli E xyz');
	});

	it('keeps a bare-name block when all of its actions were tool-only', () => {
		// Kazuha's only token is a time advance; dropping it must not erase the swap.
		expect(toKqmNotation('Bennett Q > Kazuha ~2s > Xiangling Q')).toBe(
			'Bennett Q > Kazuha > Xiangling Q'
		);
	});

	it('is idempotent — exporting KQM output again is a no-op', () => {
		const input = 'Bennett Q ~1s > Kazuha hE P {swirl:1} > Xiangling E/Q Q ~5s';
		const once = toKqmNotation(input);
		expect(toKqmNotation(once)).toBe(once);
	});

	describe('degenerate input', () => {
		it.each([
			['empty string', ''],
			['whitespace only', '   \t  '],
			['separators only', '> > >']
		])('returns "" for %s', (_label, input) => {
			expect(toKqmNotation(input)).toBe('');
		});

		it('handles a lone character name with no actions', () => {
			expect(toKqmNotation('Bennett')).toBe('Bennett');
		});
	});
});
