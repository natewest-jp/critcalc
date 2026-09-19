/**
 * fields.test.ts — the Polestar Field's producer (2026-09-01).
 *
 * ⚓ WHY THIS FILE EXISTS. `deriveFieldWindows` is the round's one piece of
 * genuinely new arithmetic: a window producer that is not a cast, and a buff
 * value recomputed per 4s cycle from a ledger of the preceding window's
 * Cryo/Electro applications. Every rule in it was decided from prose on a wiki
 * page, so each is a place a future reader could "simplify" into something that
 * still looks right and pays the wrong number.
 *
 * ⚠️ IT TESTS THE PRODUCER, NOT THE CORPUS. The rules here are game facts, not
 * measurements of our data, so the inputs are hand-built reaction/application
 * streams. ⛔ A corpus fixture would couple these assertions to whichever
 * characters happen to superconduct today.
 *
 * ⚓ SEEDED-NEGATIVE VERIFIED — each of these fails on the mutation it is aimed
 * at, checked at authoring time:
 *   · `n === 0 ? 20 : 28 + n` → `20 + n` (the discontinuity) — value tests red;
 *   · the ledger reading its OWN window instead of the previous one — red;
 *   · dropping the creating-hit exclusion — red;
 *   · excluding every conduct trigger rather than only the initial one — red;
 *   · refresh EXTENDING (`end += lifetime`) instead of replacing — red;
 *   · grants not clipped to the presence end — red.
 */

import { describe, it, expect } from 'vitest';
import { deriveFieldWindows, polestarDmgBonus } from './fields';
import { framesOf } from '$lib/utils/frames';
import type { ReactionEvent } from '$lib/utils/rotationEvents';
import type { AuraApplication } from './aura';

const conduct = (timeS: number, characterId = 'sandrone'): ReactionEvent => ({
	kind: 'reaction',
	id: 0,
	characterId,
	reaction: 'stellarConduct',
	time: framesOf(timeS),
	castKind: 'skill'
});

const app = (timeS: number, element: string, characterId = 'ganyu'): AuraApplication =>
	({
		time: framesOf(timeS),
		characterId,
		element,
		units: 1
	}) as AuraApplication;

const derive = (reactionEvents: ReactionEvent[], applications: AuraApplication[] = []) =>
	deriveFieldWindows({ reactionEvents, applications, nextBuffId: 0 });

/** The buff (not shred) windows, in time order. */
const buffTiles = (r: ReturnType<typeof derive>) => r.buffs.filter((w) => !w.debuff);

describe('polestarDmgBonus', () => {
	it('treats zero as its own case, not the bottom of the ramp', () => {
		// ⚠️⚠️ The whole point: nothing recorded pays 20%, but ONE recorded hit
		// pays 29% — not 21%. Exactly parallel to the Base Reaction Coefficient's
		// own 1 / (1.4 + 0.05n) shape, which is what makes the jump deliberate
		// rather than a transcription slip.
		expect(polestarDmgBonus(0)).toBe(20);
		expect(polestarDmgBonus(1)).toBe(29);
	});

	it('adds one point per recorded hit and caps at twelve', () => {
		expect(polestarDmgBonus(2)).toBe(30);
		expect(polestarDmgBonus(11)).toBe(39);
		expect(polestarDmgBonus(12)).toBe(40);
		// ⚠️ Past the table's end the value HOLDS; it does not keep climbing.
		expect(polestarDmgBonus(13)).toBe(40);
		expect(polestarDmgBonus(50)).toBe(40);
	});
});

describe('the Prism', () => {
	it('stands for seven seconds, not six', () => {
		const [prism] = derive([conduct(1)]).gadgets;
		expect(prism.gadget).toBe('prism');
		expect(prism.end - prism.start).toBe(framesOf(7));
	});

	it('refresh REPLACES, so two triggers inside seven seconds are one presence', () => {
		// ⛔ Not an extension: the second conduct resets the clock to a full 7s
		// from ITSELF, so the presence ends at 5 + 7, never at 1 + 7 + 7.
		const { gadgets } = derive([conduct(1), conduct(5)]);
		expect(gadgets).toHaveLength(1);
		expect(gadgets[0].start).toBe(framesOf(1));
		expect(gadgets[0].end).toBe(framesOf(12));
	});

	it('separates presences when the gap outlives the Prism', () => {
		const { gadgets } = derive([conduct(1), conduct(20)]);
		expect(gadgets.map((g) => [g.start, g.end])).toEqual([
			[framesOf(1), framesOf(8)],
			[framesOf(20), framesOf(27)]
		]);
	});

	it('emits nothing at all without a Stellar-Conduct', () => {
		const none = derive([{ ...conduct(1), reaction: 'superConduct' }]);
		expect(none.gadgets).toHaveLength(0);
		expect(none.buffs).toHaveLength(0);
	});
});

describe('the grant cycle', () => {
	it('tiles the presence in 4s windows, clipped to the field end', () => {
		// A 7s presence is 4s + the 3s remainder — ⚠️ the last tile is CLIPPED
		// rather than running its own full 4s past the Prism.
		const tiles = buffTiles(derive([conduct(0)]));
		expect(tiles.map((w) => [w.start, w.end])).toEqual([
			[0, framesOf(4)],
			[framesOf(4), framesOf(7)]
		]);
	});

	it('pays the baseline in a presence that recorded nothing', () => {
		const tiles = buffTiles(derive([conduct(0)]));
		for (const tile of tiles) {
			for (const e of tile.effects) expect((e as { value: number }).value).toBe(20);
			expect(tile.fieldStacks).toBe(0);
		}
	});

	it('grants Cryo and Electro together, and a flat shred beside them', () => {
		const { buffs } = derive([conduct(0)]);
		const first = buffTiles({ buffs, gadgets: [] })[0];
		expect(first.effects.map((e) => (e as { stat: string }).stat)).toEqual([
			'cryoDmgBonus',
			'electroDmgBonus'
		]);
		const shred = buffs.filter((w) => w.debuff);
		expect(shred.length).toBeGreaterThan(0);
		for (const w of shred) {
			expect((w.effects[0] as { value: number }).value).toBe(-40);
			// ⚠️ The shred is ledger-INDEPENDENT, so it carries no count — which is
			// also what lets its tiles refresh-merge into one bar downstream.
			expect(w.fieldStacks).toBeUndefined();
		}
	});
});

describe('the ledger', () => {
	it('pays a window from the PREVIOUS four seconds, not its own', () => {
		// ⚓⚓ "Every 4s the count is reset, and buffs lasting 4s are granted" — the
		// hits that pay for a tile are finished before the tile opens. Three Cryo
		// hits inside [0,4) must move the SECOND tile and leave the first alone.
		const tiles = buffTiles(
			derive([conduct(0)], [app(1, 'cryo'), app(2, 'cryo'), app(3, 'electro')])
		);
		expect(tiles[0].fieldStacks).toBe(0);
		expect(tiles[1].fieldStacks).toBe(3);
		expect((tiles[1].effects[0] as { value: number }).value).toBe(31);
	});

	it('records only Cryo and Electro', () => {
		const tiles = buffTiles(
			derive([conduct(0)], [app(1, 'pyro'), app(2, 'hydro'), app(3, 'cryo')])
		);
		expect(tiles[1].fieldStacks).toBe(1);
	});

	it('does not count the hit that created the Prism', () => {
		// ⚠️ Stated on the Fandom page. The conduct's own trigger is a Cryo or
		// Electro application at the same instant by the same character, and it is
		// struck off — ⛔ or every field would open one hit richer than it is.
		const tiles = buffTiles(
			derive([conduct(1, 'ganyu')], [app(1, 'cryo', 'ganyu'), app(2, 'cryo', 'ganyu')])
		);
		expect(tiles[1].fieldStacks).toBe(1);
	});

	it('DOES count the hits that refresh it — only the initial one is exempt', () => {
		// ⚠️⚠️ "The INITIAL hit that created the Prism is not included" — one hit,
		// not one per trigger. A rule excluding every conduct would have been
		// written as "hits that trigger Stellar-Conduct are not included", and
		// measured against the lane's own dots the every-trigger reading ran the
		// ledger about one short per window (⚓ Nate). ⛔ Don't re-flip this on a
		// re-reading alone: there is no oracle here, gcsim has no Stellar-Conduct.
		const tiles = buffTiles(
			derive(
				[conduct(0, 'ganyu'), conduct(2, 'ganyu')],
				[app(0, 'cryo', 'ganyu'), app(2, 'cryo', 'ganyu'), app(3, 'cryo', 'ganyu')]
			)
		);
		// [0,4) holds all three; only the 0s creator is struck off.
		expect(tiles[1].fieldStacks).toBe(2);
	});

	it("strikes off ONE application, not every one sharing the creator's frame", () => {
		// ⚠️⚠️ Why the exclusion resolves INDICES rather than comparing times: a
		// cast that applies two elements on one frame would otherwise lose BOTH,
		// undercounting a ledger whose whole job is to count.
		const tiles = buffTiles(
			derive([conduct(1, 'ganyu')], [app(1, 'cryo', 'ganyu'), app(1, 'electro', 'ganyu')])
		);
		expect(tiles[1].fieldStacks).toBe(1);
	});

	it('caps the payout at twelve recorded hits', () => {
		const many = Array.from({ length: 20 }, (_, i) => app(0.1 * i + 0.1, 'cryo'));
		const tiles = buffTiles(derive([conduct(0)], many));
		expect(tiles[1].fieldStacks).toBe(20);
		expect((tiles[1].effects[0] as { value: number }).value).toBe(40);
	});
});

// ── Radiance as a WINDOW (Radiance-window round, 2026-09-19) ──
import { polestarFieldOpenAt } from './fields';
import { parseNotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import travelerCryoJson from '$lib/data/characters/traveler_cryo.json';
import lisaJson from '$lib/data/characters/lisa.json';
import bennettJson from '$lib/data/characters/bennett.json';

describe('polestarFieldOpenAt — the one reader, live and at finalize', () => {
	const at = (s: number) => framesOf(s);
	it('is open for 7s after a conduct, and the LATEST conduct decides (refresh replaces)', () => {
		const times = [at(1), at(5)];
		expect(polestarFieldOpenAt(times, at(0.5))).toBe(false);
		expect(polestarFieldOpenAt(times, at(4))).toBe(true);
		expect(polestarFieldOpenAt(times, at(8.5))).toBe(true); // 1s + 7s has lapsed; 5s + 7s has not
		expect(polestarFieldOpenAt(times, at(12))).toBe(false);
		expect(polestarFieldOpenAt([], at(3))).toBe(false);
	});
	it('⚠️ STRICTLY before — the instant a conduct happens is not yet inside its field', () => {
		// A tick whose own application CAUSES the conduct fired with the field
		// down; the finished stream must not un-draw it.
		expect(polestarFieldOpenAt([at(2)], at(2))).toBe(false);
		expect(polestarFieldOpenAt([at(2)], at(2) + 1)).toBe(true);
	});
	it('agrees with the Prism windows finalize draws, everywhere but the opening frame', () => {
		const events = [conduct(1), conduct(5), conduct(20)];
		const { gadgets } = deriveFieldWindows({ reactionEvents: events, applications: [] });
		const times = events.map((e) => e.time);
		for (let f = 0; f < framesOf(30); f += 7) {
			const inWindow = gadgets.some((g) => f > g.start && f < g.end);
			expect(polestarFieldOpenAt(times, f), `frame ${f}`).toBe(inWindow);
		}
	});
});

describe("a tick series gated on the field pauses under it — the Cryo Traveler's Star", () => {
	const TRAVELER = travelerCryoJson as unknown as CharacterData;
	const LISA = lisaJson as unknown as CharacterData;
	const BENNETT = bennettJson as unknown as CharacterData;
	const run = (notation: string, mate: CharacterData) => {
		const chars = [TRAVELER, mate];
		const r = parseNotation(
			notation,
			(n) => chars.find((c) => c.displayName === n) ?? null,
			8,
			{},
			undefined,
			chars
		);
		expect(r.unknownTokens).toEqual([]);
		const star = r.windows.find((w) => w.kind === 'summon' && w.characterId === TRAVELER.id);
		if (!star || star.kind !== 'summon') throw new Error('no Star');
		const prisms = r.windows.filter((w) => w.kind === 'gadget');
		const entityApps = r.applications
			.filter((a) => a.characterId === TRAVELER.id && a.time > star.start)
			.map((a) => a.time);
		return { star, prisms, entityApps };
	};

	it('skips the interval crystals inside the Prism and resumes on the ORIGINAL phase', () => {
		// One Lisa E is one Electro aura: the Traveler's cast conducts once, the
		// Prism stands 7s, and nothing re-opens it.
		const { star, prisms, entityApps } = run('Lisa E > Cryo Traveler E ~12s', LISA);
		expect(prisms).toHaveLength(1);
		const first = star.start + framesOf(1.25);
		const cadence = framesOf(3);
		// The first two volleys fall inside the field; the third is the first out.
		expect(first + cadence).toBeLessThan(prisms[0].end);
		expect(star.ticks).toEqual([first + 2 * cadence, first + 3 * cadence]);
		// ⚓ Both readers: the markers drawn are exactly the ticks that applied.
		expect(entityApps).toEqual(star.ticks);
	});

	it('with no Electro there is no field, and the Star keeps its interval', () => {
		const { star, prisms } = run('Bennett E > Cryo Traveler E ~12s', BENNETT);
		expect(prisms).toHaveLength(0);
		expect(star.ticks).toHaveLength(4);
	});
});
