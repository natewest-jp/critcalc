/**
 * src/lib/utils/settingsBackup.test.ts
 *
 * Pins the pure `parseBackup` validator: a well-formed envelope round-trips,
 * garbage is rejected, and every store value is sanitized/clamped so a
 * hand-edited or corrupt file can never reach the stores unsanitized.
 */

import { describe, it, expect } from 'vitest';
import { parseBackup, BACKUP_VERSION, type BackupEnvelope } from './settingsBackup';

function envelope(data: Record<string, unknown>): string {
	const env: BackupEnvelope = {
		app: 'critcalc',
		version: BACKUP_VERSION,
		exportedAt: 1_700_000_000_000,
		data
	};
	return JSON.stringify(env);
}

describe('parseBackup', () => {
	it('round-trips a well-formed envelope and counts its contents', () => {
		const res = parseBackup(
			envelope({
				'critcalc:siteSettings': { useNewOutfits: true, travelerVariant: 'lumine', swapPing: 100 },
				'critcalc:constellations': { bennett: 6, xingqiu: 2 },
				'critcalc:ownership': { bennett: 'owned', furina: 'wishlist' },
				'critcalc:loadout': { bennett: { weaponId: 'aquila_favonia', weaponRefinement: 3 } },
				'critcalc:savedNotations': [
					{ id: 'a1', name: 'Test', notation: 'E Q', manualSlots: null, savedAt: 123 }
				]
			})
		);

		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.data['critcalc:constellations']).toEqual({ bennett: 6, xingqiu: 2 });
		expect(res.data['critcalc:siteSettings']).toEqual({
			useNewOutfits: true,
			travelerVariant: 'lumine',
			swapPing: 100
		});
		expect(res.counts).toEqual({ characters: 2, owned: 1, loadouts: 1, rotations: 1 });
	});

	it('rejects invalid JSON', () => {
		const res = parseBackup('{not json');
		expect(res.ok).toBe(false);
	});

	it('rejects a file without the critcalc app marker', () => {
		const res = parseBackup(
			JSON.stringify({ app: 'other', data: { 'critcalc:constellations': {} } })
		);
		expect(res.ok).toBe(false);
	});

	it('rejects an envelope with no recognizable data', () => {
		const res = parseBackup(envelope({ 'critcalc:constellations': 'not-an-object' }));
		expect(res.ok).toBe(false);
	});

	it('clamps and rounds constellation levels out of range', () => {
		const res = parseBackup(
			envelope({ 'critcalc:constellations': { a: 9, b: -3, c: 4.6, d: 'x' } })
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		// a → 6 (cap), b → 0 (floor), c → 5 (rounded), d dropped (non-numeric)
		expect(res.data['critcalc:constellations']).toEqual({ a: 6, b: 0, c: 5 });
	});

	it('drops invalid ownership marks but keeps valid ones', () => {
		const res = parseBackup(
			envelope({ 'critcalc:ownership': { a: 'owned', b: 'bogus', c: 'wishlist' } })
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.data['critcalc:ownership']).toEqual({ a: 'owned', c: 'wishlist' });
	});

	it('sanitizes site settings: clamps swap ping, rejects a bad traveler variant', () => {
		const res = parseBackup(
			envelope({
				'critcalc:siteSettings': {
					travelerVariant: 'paimon',
					swapPing: 999,
					useNewOutfits: 'yes'
				}
			})
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		// bad variant + non-boolean outfits dropped; ping clamped to 200
		expect(res.data['critcalc:siteSettings']).toEqual({ swapPing: 200 });
	});

	it('migrates a legacy frame-based backup to swap ping', () => {
		const res = parseBackup(envelope({ 'critcalc:siteSettings': { swapFrames: 12 } }));
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		// 12 frames / 0.12 = 100ms
		expect(res.data['critcalc:siteSettings']).toEqual({ swapPing: 100 });
	});

	it('drops saved-notation entries missing required string fields', () => {
		const res = parseBackup(
			envelope({
				'critcalc:savedNotations': [
					{ id: 'a', name: 'ok', notation: 'E' },
					{ id: 'b', name: 'no notation' },
					{ notation: 'E Q' }
				]
			})
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		const notes = res.data['critcalc:savedNotations'] as unknown[];
		expect(notes).toHaveLength(1);
	});
});
