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
		expect(res.counts).toEqual({
			characters: 2,
			owned: 1,
			loadouts: 1,
			rotations: 1,
			lineups: 0
		});
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

	it('sanitizes human timing: clamps the pad, drops a bad mode, keeps the booleans', () => {
		const res = parseBackup(
			envelope({
				'critcalc:siteSettings': {
					humanTiming: true,
					humanTimingMode: 'faster',
					humanTimingPadFrames: 99,
					showHumanPadding: false
				}
			})
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		// bad mode dropped; pad clamped to the slider's ceiling; booleans kept
		expect(res.data['critcalc:siteSettings']).toEqual({
			humanTiming: true,
			humanTimingPadFrames: 20,
			showHumanPadding: false
		});
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

	it('counts a names-only team entry as a team, not a rotation', () => {
		const res = parseBackup(
			envelope({
				'critcalc:savedNotations': [
					{ id: 't', name: '', notation: 'Bennett Xiangling Xingqiu Sucrose' },
					{ id: 'r', name: 'Nat', notation: 'Bennett E Q' }
				]
			})
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.counts.rotations).toBe(1);
		expect(res.data['critcalc:savedNotations']).toHaveLength(2);
	});

	it('keeps a saved rotation’s synced flag and opened time', () => {
		const res = parseBackup(
			envelope({
				'critcalc:savedNotations': [
					{ id: 'a', name: 'ok', notation: 'E', savedAt: 1, synced: true, openedAt: 5 },
					{ id: 'b', name: 'ok', notation: 'E', savedAt: 1, synced: 'yes', openedAt: NaN }
				]
			})
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		const [a, b] = res.data['critcalc:savedNotations'] as Record<string, unknown>[];
		expect(a.synced).toBe(true);
		expect(a.openedAt).toBe(5);
		expect(b).not.toHaveProperty('synced');
		expect(b).not.toHaveProperty('openedAt');
	});

	it('round-trips saved lineups and sanitizes their teams', () => {
		const res = parseBackup(
			envelope({
				'critcalc:savedBoards': [
					{
						id: 'b1',
						name: 'Spiral',
						preset: 'stygian',
						season: '7.1',
						noRepeats: true,
						savedAt: 10,
						openedAt: 20,
						teams: [
							{
								id: 't1',
								slots: ['bennett', null, 3, 'xingqiu', 'extra'],
								con: { bennett: 9, xingqiu: 'x' },
								pinnedRotationId: 'r1'
							},
							{ slots: ['furina'] }
						]
					},
					{ id: 'b2', name: 'Bad preset', preset: 'theatre', teams: [] },
					{ id: 'b3', name: 'Loose', preset: 'custom', season: 'soon', teams: 'none' }
				]
			}),
			99
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.data['critcalc:savedBoards']).toEqual([
			{
				id: 'b1',
				name: 'Spiral',
				preset: 'stygian',
				season: '7.1',
				noRepeats: true,
				savedAt: 10,
				openedAt: 20,
				teams: [
					{
						id: 't1',
						slots: ['bennett', null, null, 'xingqiu'],
						con: { bennett: 6 },
						pinnedRotationId: 'r1'
					}
				]
			},
			{ id: 'b3', name: 'Loose', preset: 'custom', noRepeats: false, savedAt: 99, teams: [] }
		]);
		expect(res.counts.lineups).toBe(2);
	});

	it('carries the coverage strips, chosen layers and playback sound, and drops bad values', () => {
		const res = parseBackup(
			envelope({
				'critcalc:siteSettings': {
					showCoverageStrips: true,
					showAuraLane: false,
					timelineLayers: { showAuraLane: false, showTimelineBuffs: 'no' },
					playbackSound: false,
					playbackSoundMode: 'metronome',
					playbackVoice: 'kazoo',
					playbackVolume: 4
				}
			})
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.data['critcalc:siteSettings']).toEqual({
			showCoverageStrips: true,
			timelineLayers: { showAuraLane: false },
			playbackSound: false,
			playbackSoundMode: 'metronome',
			playbackVolume: 1
		});
	});
});
