import { describe, it, expect } from 'vitest';
import { encodeRotation, decodeRotation, type SharedRotation } from './rotationUrl';

const SAMPLE: SharedRotation = {
	notation: 'Zhongli E Kazuha E Q Yelan E Q Hu Tao E N2C N2C N2C D N2C Q',
	team: ['hu_tao', 'yelan', 'kaedehara_kazuha', 'zhongli'],
	constellations: { hu_tao: 1, kaedehara_kazuha: 2, zhongli: 6 },
	loadout: {
		kaedehara_kazuha: { weaponId: 'the_widsith', weaponRefinement: 1, artifactSetId: 'viridescent_venerer' },
		yelan: { artifactSetId: 'noblesse_oblige' },
		zhongli: { artifactSetId: 'tenacity_of_the_millelith' }
	}
};

describe('rotationUrl codec', () => {
	it('round-trips a full rotation exactly', async () => {
		const encoded = await encodeRotation(SAMPLE);
		expect(await decodeRotation(encoded)).toEqual(SAMPLE);
	});

	it('produces a URLSearchParams-safe blob (base64url only, no + / =)', async () => {
		const encoded = await encodeRotation(SAMPLE);
		expect(encoded).toMatch(/^1~[A-Za-z0-9_-]+$/);
		expect(encoded).not.toMatch(/[+/=]/);
	});

	it('survives a real URLSearchParams round-trip in a query string', async () => {
		const encoded = await encodeRotation(SAMPLE);
		// Simulate the receiving end: parse the query string the browser hands us.
		const url = new URL(`https://critcalc.app/rotation-planner?r=${encoded}`);
		const param = url.searchParams.get('r');
		expect(param).toBe(encoded); // the `+`-becomes-space trap does not fire
		expect(await decodeRotation(param)).toEqual(SAMPLE);
	});

	it('round-trips a null team', async () => {
		const shared: SharedRotation = { ...SAMPLE, team: null };
		expect(await decodeRotation(await encodeRotation(shared))).toEqual(shared);
	});

	it('round-trips empty constellations / loadout', async () => {
		const shared: SharedRotation = { notation: 'Bennett E Q', team: null, constellations: {}, loadout: {} };
		expect(await decodeRotation(await encodeRotation(shared))).toEqual(shared);
	});

	it('round-trips unicode and long notation', async () => {
		const shared: SharedRotation = {
			notation: ('Furina E Q Neuvillette CA '.repeat(40) + '— café ✨').trim(),
			team: ['furina', 'neuvillette'],
			constellations: {},
			loadout: {}
		};
		expect(await decodeRotation(await encodeRotation(shared))).toEqual(shared);
	});

	it('keeps the compressed blob shorter than raw base64 of the JSON', async () => {
		const encoded = await encodeRotation(SAMPLE);
		const rawB64 = Buffer.from(JSON.stringify(SAMPLE)).toString('base64');
		expect(encoded.length).toBeLessThan(rawB64.length);
	});

	describe('decode is graceful on bad input', () => {
		it.each([
			['null', null],
			['undefined', undefined],
			['empty', ''],
			['marker only', '1~'],
			['wrong marker', '2~abcd'],
			['no marker', 'eyJ2IjoxfQ'],
			['garbage base64url', '1~!!!!not base64!!!!'],
			['valid base64url but not deflate', '1~aGVsbG8']
		])('returns null for %s', async (_label, input) => {
			expect(await decodeRotation(input)).toBeNull();
		});
	});

	it('sanitizes a hostile / malformed payload', async () => {
		const dirty: SharedRotation = {
			notation: 'X E',
			team: ['a', 'b'],
			// out-of-range + wrong-type values that a hand-edited link might carry
			constellations: { a: 9, b: 0, c: -3, d: 4.6 } as unknown as Record<string, number>,
			loadout: {
				a: { weaponId: 'w', weaponRefinement: 7 as 1, artifactSetId: 'art' },
				b: {} // empty entry should be dropped
			}
		};
		const decoded = await decodeRotation(await encodeRotation(dirty));
		expect(decoded).not.toBeNull();
		// cons clamped to 1–6, zero/negative dropped, 4.6 rounded to 5
		expect(decoded!.constellations).toEqual({ a: 6, d: 5 });
		// invalid refinement dropped, empty loadout entry dropped
		expect(decoded!.loadout).toEqual({ a: { weaponId: 'w', artifactSetId: 'art' } });
	});

	it('rejects a JSON payload with the wrong version', async () => {
		// Hand-build a v:2 payload through the same pipeline to prove version gating.
		const bad = { v: 2, notation: 'x', team: null, constellations: {}, loadout: {} };
		const compressed = await (async () => {
			const cs = new CompressionStream('deflate-raw');
			const w = cs.writable.getWriter();
			w.write(new TextEncoder().encode(JSON.stringify(bad)));
			w.close();
			return new Uint8Array(await new Response(cs.readable).arrayBuffer());
		})();
		const b64url = Buffer.from(compressed)
			.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
		expect(await decodeRotation(`1~${b64url}`)).toBeNull();
	});
});
