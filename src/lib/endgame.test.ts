import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
	ABYSS_CYCLES,
	BOSSES,
	SEASONS,
	blessingImage,
	currentAbyss,
	SPRITES,
	bossImage,
	bossRuns,
	checkAlternatives,
	currentSeason,
	liveSeasons,
	spriteImage
} from './endgame';

/**
 * The endgame presets' data (lineups design §2.6). It is GENERATED from
 * lunaris.moe, so these are the rules a re-fetch must keep: every season has
 * three battlefields on known bosses with real HP, every image the site will
 * ask for exists, every sprite a check names is mapped, and ⚓ nothing shows
 * before its live date.
 */
const STATIC = join(process.cwd(), 'static');

describe('the Stygian data', () => {
	it('every season has three battlefields on known bosses, with both HP values', () => {
		for (const s of SEASONS) {
			expect(s.battlefields, s.version).toHaveLength(3);
			for (const b of s.battlefields) {
				expect(BOSSES[b.boss], `${s.version} ${b.boss}`).toBeDefined();
				expect(b.hp.fearless).toBeGreaterThan(0);
				expect(b.hp.dire).toBeGreaterThan(b.hp.fearless);
			}
		}
	});

	it('seasons follow each other without gaps or overlaps', () => {
		const sorted = [...SEASONS].sort((a, b) => a.start.localeCompare(b.start));
		sorted.forEach((s, i) => {
			expect(s.start < s.end, s.version).toBe(true);
			if (sorted[i + 1]) expect(s.end).toBe(sorted[i + 1].start);
		});
	});

	it('every boss has its art and its circle icon on disk', () => {
		for (const id of Object.keys(BOSSES)) {
			expect(existsSync(join(STATIC, bossImage(id, 'art'))), id).toBe(true);
			expect(existsSync(join(STATIC, bossImage(id, 'icon'))), id).toBe(true);
		}
	});

	it('every sprite a check names is mapped and on disk', () => {
		for (const s of SEASONS)
			for (const b of s.battlefields)
				for (const c of b.checks)
					for (const m of c.text.en.matchAll(/\{sprite:(\d+)\}/g)) {
						expect(SPRITES[Number(m[1])], m[1]).toBeDefined();
						expect(existsSync(join(STATIC, spriteImage(Number(m[1])))), m[1]).toBe(true);
					}
	});
});

describe('what shows when', () => {
	it('shows nothing before its live date (no leaks)', () => {
		const first = [...SEASONS].sort((a, b) => a.start.localeCompare(b.start))[0];
		const dayBefore = new Date(`${first.start}T00:00:00Z`);
		dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
		expect(liveSeasons(dayBefore)).toEqual([]);
		expect(liveSeasons(new Date(`${first.start}T12:00:00Z`))[0].version).toBe(first.version);
	});

	it('the current season is the newest live one', () => {
		expect(currentSeason(new Date('2026-10-09T12:00:00Z'))?.version).toBe('7.1');
		expect(currentSeason(new Date('2026-09-01T12:00:00Z'))?.version).toBe('7.0');
	});

	it('lists every season a boss ran in, newest first', () => {
		const runs = bossRuns('frostnight-herra-hatred-and-rage', new Date('2026-10-09T12:00:00Z'));
		expect(runs.map((s) => s.version)).toEqual(['6.5', '6.1']);
	});
});

describe('a check, as parts', () => {
	it('splits alternatives and keeps the icons', () => {
		expect(checkAlternatives('{sprite:11034} reactions | {sprite:11004} characters')).toEqual([
			[{ sprite: 11034 }, { text: 'reactions' }],
			[{ sprite: 11004 }, { text: 'characters' }]
		]);
	});
});

describe('the Abyss', () => {
	it('every cycle has its blessing text and icon', () => {
		for (const c of ABYSS_CYCLES) {
			expect(c.name.en, c.start).toBeTruthy();
			expect(c.text.en, c.start).toBeTruthy();
			expect(
				c.halves.map((h) => !!h.en),
				c.start
			).toEqual([true, true]);
			expect(existsSync(join(STATIC, blessingImage(c.icon))), c.icon).toBe(true);
		}
	});

	it('the current cycle is the newest live one', () => {
		expect(currentAbyss(new Date('2026-10-09T12:00:00Z'))?.name.en).toBe('Cascading Moon');
		expect(currentAbyss(new Date('2026-09-15T12:00:00Z'))).toBeUndefined();
	});
});
