/**
 * src/lib/sim/castHits.test.ts
 *
 * ⚓ A CAST'S HIT RECORD LANDS WHERE ITS APPLICATION DOES (cast hit-record round,
 * 2026-09-21 — `docs/rounds/multi-hit-swings-round.md` §6, Phase A). §1.K synced a
 * swing's application and hit record; a cast's record still fired at the button
 * PRESS while its `application[]` was queued at the hitmark, so every `onHit`
 * consumer heard the cast up to 530 frames early and a damage proc landed AHEAD
 * of the hit that fired it.
 *
 * End to end over the shipped corpus, in FRAMES. The "no landing stated" half
 * (an unmeasured cast keeps the press) is pinned by the stub in
 * `states.test.ts` — "a hitting E anchors its onHit shred on the cast".
 */
import { describe, it, expect } from 'vitest';
import type { CharacterData } from '$lib/types/character';
import type { LoadoutEntry } from '$lib/stores';
import { parseNotation } from '$lib/utils/notationParser';
import type { ParsedRotation } from '$lib/utils/notationParser';

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const corpus: CharacterData[] = Object.values(modules).map(
	(m) => (m as { default: CharacterData }).default
);
const byName = new Map(corpus.map((c) => [c.displayName, c]));
const lookup = (name: string): CharacterData | null => byName.get(name) ?? null;

const parse = (
	notation: string,
	cons: Record<string, number> = {},
	loadout: Record<string, LoadoutEntry> = {}
): ParsedRotation => parseNotation(notation, lookup, 8, cons, loadout, undefined);

/** `[frame, element]` per application a character put on the target. */
const appsOf = (r: ParsedRotation, characterId: string): [number, string][] =>
	r.applications.filter((a) => a.characterId === characterId).map((a) => [a.time, a.element]);

const castOf = (r: ParsedRotation, characterId: string) => {
	const ev = r.events.find((e) => e.kind === 'cast' && e.characterId === characterId);
	if (!ev || ev.kind !== 'cast') throw new Error(`no cast for ${characterId}`);
	return ev;
};

describe('a cast’s hit record lands at its first landing', () => {
	it('⚓⚓ a proc fired by a cast’s hit lands AFTER that hit — the order inversion', () => {
		// C6 Faruzan's Pressurized Collapse hears her own burst's hit. gcsim: the
		// burst lands at 54, the Collapse 33 frames later. Fired at the press, the
		// Collapse landed at 33 — 21 frames BEFORE the hit that caused it.
		const r = parse('Faruzan Q ~3s', { faruzan: 6 });
		expect(castOf(r, 'faruzan').firstHitAt).toBe(54);
		expect(appsOf(r, 'faruzan')).toEqual([
			[54, 'anemo'],
			[87, 'anemo']
		]);
	});

	it('publishes the NOMINAL first landing — a physical opener counts', () => {
		// Xinyan's burst opens with a physical hit at 22; its first Pyro is at 57.
		const r = parse('Xinyan Q');
		expect(castOf(r, 'xinyan').firstHitAt).toBe(22);
		expect(appsOf(r, 'xinyan')[0]).toEqual([57, 'pyro']);
	});

	it('a hit-triggered artifact set opens at the landing, not the press', () => {
		// Tenacity: "when an Elemental Skill hits". Baron Bunny explodes 530 frames
		// after Amber throws it.
		const r = parse('Amber E ~12s', {}, { amber: { artifactSetId: 'tenacity_of_the_millelith' } });
		const at = castOf(r, 'amber').firstHitAt;
		expect(at).toBe(530);
		const tenacity = r.windows.filter((w) => w.kind === 'buff' && w.source.type === 'artifact');
		expect(tenacity.map((w) => w.start)).toEqual([530]);
	});

	it('⚓ a landing after the caster left the field is not the ACTIVE character’s hit', () => {
		// The Bunny explodes with Amber ON field: C6 Faruzan's Collapse
		// (`source: 'active'`) answers it, 33 frames on.
		const onField = parse('Faruzan Q > Amber E ~12s', { faruzan: 6 });
		const bunny = castOf(onField, 'amber').firstHitAt!;
		expect(appsOf(onField, 'faruzan').map(([t]) => t)).toContain(bunny + 33);
		// Same throw, but Amber has swapped out by the time it lands: refused.
		const offField = parse('Faruzan Q > Amber E > Faruzan ~12s', { faruzan: 6 });
		expect(appsOf(offField, 'faruzan').map(([t]) => t)).toEqual([54, 87]);
		// ⚠️ Refused by `active` ONLY. Raiden's Eye hears any damage the opponent
		// takes (`source: 'team'`), whoever is on field when it lands.
		const eye = parse('Raiden E > Amber E > Raiden ~12s');
		const landed = castOf(eye, 'amber').firstHitAt!;
		expect(appsOf(eye, 'raiden_shogun').map(([t]) => t)).toContain(landed + 5);
	});

	it('⚓ a summon spawned AT the hit was spawned BY it, and hears nothing there', () => {
		// Albedo's E lands at 25 and the Isotoma spawns at 25. gcsim queues the
		// attack before it creates the construct; a Blossom at 26 would be the
		// flower answering the hit that planted it.
		const r = parse('Albedo E ~5s');
		expect(appsOf(r, 'albedo')).toEqual([[25, 'geo']]);
	});
});

/**
 * ⚓ EVERY LANDING IS A HIT (every-landing round, 2026-09-21 — Phase B). One swing
 * was one hit and one cast was one record; ICD and every `onHit` count HITS. A
 * swing's `FrameMap.lands` may be a LIST, and a cast's `application[]` always was
 * one.
 */
describe('every landing is a hit', () => {
	it('⚓⚓ a two-hit swing spends TWO slots of the every-third-hit budget', () => {
		// C6 Bennett infuses Kazuha's sword. N1 · N2 · N3 is FOUR hits (his N3 lands
		// two), so the standard ICD applies on hit 1 and hit 4 — the second hit of
		// N3. Counted as three hits, the string applied once.
		const r = parse('Bennett Q > Kazuha N3', { bennett: 6 });
		expect(appsOf(r, 'kaedehara_kazuha')).toHaveLength(2);
	});

	it('what must NOT multiply: one action event per swing', () => {
		const r = parse('Kazuha N5');
		const swings = r.events.filter((e) => e.kind === 'action');
		expect(swings).toHaveLength(5);
		expect(swings.map((e) => (e.kind === 'action' ? e.comboIndex : null))).toEqual([0, 1, 2, 3, 4]);
	});

	it('a cast publishes every landing, and a hit-triggered window is REFRESHED by each', () => {
		// Kujou Sara's burst: the Titanbreaker at 51, four Stormclusters at 100.
		// Deepwood's shred is 8s from the LAST hit, opened at the FIRST.
		const r = parse('Kujou Sara Q ~3s', {}, { kujou_sara: { artifactSetId: 'deepwood_memories' } });
		const cast = castOf(r, 'kujou_sara');
		expect(cast.hitsAt).toEqual([51, 100, 100, 100, 100]);
		const shred = r.windows.filter((w) => w.kind === 'buff' && w.source.type === 'artifact');
		expect(shred.map((w) => [w.start, w.end])).toEqual([[51, 100 + 480]]);
	});
});

/**
 * ⚓ A PROJECTILE LANDS AFTER ITS RELEASE (projectile-travel round, 2026-09-21).
 * A bow's `hit` is its release frame; the arrow lands `PROJECTILE_TRAVEL_F`
 * later — the flight our ranged CAST data always carried and a swing did not.
 */
describe('projectile travel on swings', () => {
	const firstSwing = (r: ParsedRotation) => {
		const ev = r.events.find((e) => e.kind === 'action');
		if (!ev || ev.kind !== 'action') throw new Error('no swing');
		return ev;
	};

	it('an arrow lands one flight after its release — even past the swing’s end', () => {
		// C6 Bennett cannot infuse a bow, so read a bow whose shots are elemental
		// by kit: Yoimiya under Niwabi. Her N1's first hit releases at 15.
		const r = parse('Yoimiya E N1');
		const swing = firstSwing(r);
		const first = r.applications.find((a) => a.characterId === 'yoimiya' && a.time > swing.time)!;
		expect(first.time).toBe(swing.time + 15 + 10);
	});

	it('melee is untouched, and a bow’s melee STANCE says so itself', () => {
		// Tartaglia is a bow; Foul Legacy is `projectile: false`. His stance N1
		// lands at its hitmark with no flight.
		const r = parse('Tartaglia E N1');
		const swing = firstSwing(r);
		const hit = r.applications.find((a) => a.characterId === 'tartaglia' && a.time > swing.time)!;
		expect(hit.time - swing.time).toBeLessThanOrEqual(swing.duration);
	});

	it('⚓ an arrow that lands after its shooter swapped out is not the ACTIVE character’s hit', () => {
		// Fischl's N1 is cancelled into a swap AT its release frame (15), so the
		// arrow lands 10 frames later — two frames into Faruzan's turn. The same
		// arrow with Fischl still on field fires C6 Faruzan's Collapse
		// (`source: 'active'`); in the air across the swap, it does not.
		const stays = parse('Faruzan Q ~4s > Fischl N1 ~1s', { faruzan: 6 });
		expect(appsOf(stays, 'faruzan')).toHaveLength(3);
		const swaps = parse('Faruzan Q ~4s > Fischl N1 > Faruzan ~3s', { faruzan: 6 });
		expect(appsOf(swaps, 'faruzan')).toHaveLength(2);
	});
});
