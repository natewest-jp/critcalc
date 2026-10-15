import { describe, expect, it } from 'vitest';
import { decodeInstrumentParam, encodeInstrumentParam } from './instrumentUrl';

describe('instrumentUrl codec', () => {
	it('encodes a bare id when no state is given', async () => {
		expect(await encodeInstrumentParam('gauge')).toBe('gauge');
	});

	it('round-trips id + state through the compressed form', async () => {
		const state = { v: 1, preset: 'burning', apps: [[0, 'dendro', 2] as const] };
		const param = await encodeInstrumentParam('gauge', state);
		expect(param.startsWith('gauge.1~')).toBe(true);
		expect(await decodeInstrumentParam(param)).toEqual({ id: 'gauge', state });
	});

	it('survives a URLSearchParams round trip', async () => {
		const param = await encodeInstrumentParam('crit', { v: 1, cr: 0.7, cd: 1.4 });
		const qs = new URLSearchParams({ i: param });
		const back = new URLSearchParams(qs.toString()).get('i');
		expect(await decodeInstrumentParam(back)).toEqual({
			id: 'crit',
			state: { v: 1, cr: 0.7, cd: 1.4 }
		});
	});

	// The ICD Timeline's and Reaction Curves' shapes, as their getShareState
	// writes them: a step-snapped float, a string id and a mixed tuple must all
	// come back exactly, since each sanitizer compares against literal values.
	it('round-trips the ICD Timeline state', async () => {
		const state = {
			v: 1,
			source: 'layla',
			interval: 0.45,
			hits: 17,
			rule: 'custom',
			custom: [3.7, 9, 2],
			element: 'cryo'
		};
		const param = await encodeInstrumentParam('icd', state);
		const back = new URLSearchParams(new URLSearchParams({ i: param }).toString()).get('i');
		expect(await decodeInstrumentParam(back)).toEqual({ id: 'icd', state });
	});

	it('round-trips the Reaction Curves state', async () => {
		const state = { v: 1, family: 'lunar', em: 735, level: 95, rb: 40 };
		const param = await encodeInstrumentParam('curves', state);
		const back = new URLSearchParams(new URLSearchParams({ i: param }).toString()).get('i');
		expect(await decodeInstrumentParam(back)).toEqual({ id: 'curves', state });
	});

	it('decodes a bare id with null state', async () => {
		expect(await decodeInstrumentParam('artifact')).toEqual({ id: 'artifact', state: null });
	});

	it('rejects ids that are not url-plain', async () => {
		await expect(encodeInstrumentParam('bad id', {})).rejects.toThrow();
		expect(await decodeInstrumentParam('Bad!')).toBeNull();
		expect(await decodeInstrumentParam('.1~xyz')).toBeNull();
		expect(await decodeInstrumentParam('')).toBeNull();
		expect(await decodeInstrumentParam(null)).toBeNull();
		expect(await decodeInstrumentParam(undefined)).toBeNull();
	});

	it('degrades a corrupt state blob to id-only selection', async () => {
		expect(await decodeInstrumentParam('gauge.1~%%%%')).toEqual({ id: 'gauge', state: null });
		expect(await decodeInstrumentParam('gauge.1~')).toEqual({ id: 'gauge', state: null });
		// wrong version marker: id still selects
		expect(await decodeInstrumentParam('gauge.9~AAAA')).toEqual({ id: 'gauge', state: null });
	});

	it('splits on the FIRST dot so blob-internal dots cannot confuse parsing', async () => {
		const param = await encodeInstrumentParam('icd', { note: 'a.b.c' });
		expect(await decodeInstrumentParam(param)).toEqual({ id: 'icd', state: { note: 'a.b.c' } });
	});
});
