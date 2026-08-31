/**
 * gadgets.test.ts — the Thundercloud and the Moondrift field (2026-09-01).
 *
 * ⚓ WHY THIS FILE EXISTS. Both entities are transcriptions of gcsim's own
 * numbers and branch structure, and both have a rule that reads as an oddity
 * until you know the source: a Lunar-Crystallize TOPS THE FIELD UP to three
 * rather than adding one, and on a full field it refreshes the three instead
 * (Moondrift Harmony). Either would be "tidied" into add-one by a reader who had
 * not read `lunarcrystallize.go`.
 *
 * ⚓ SEEDED-NEGATIVE VERIFIED at authoring time — top-up → add-one, the Harmony
 * refresh removed, and the cloud stacking instead of restarting each go red on
 * the test aimed at them.
 */

import { describe, it, expect } from 'vitest';
import { deriveGadgetWindows } from './gadgets';
import { framesOf } from '$lib/utils/frames';
import type { Reaction } from '$lib/types/ability';
import type { ReactionEvent } from '$lib/utils/rotationEvents';

const rx = (timeS: number, reaction: Reaction): ReactionEvent => ({
	kind: 'reaction',
	id: 0,
	characterId: 'columbina',
	reaction,
	time: framesOf(timeS),
	castKind: 'skill'
});

/** ⚠️ Frames, for the cases where a rounded second would land on the wrong side
 *  of a 37-frame window. */
const rxF = (frames: number, reaction: Reaction): ReactionEvent => ({
	kind: 'reaction',
	id: 0,
	characterId: 'columbina',
	reaction,
	time: frames,
	castKind: 'skill'
});

const of = (kind: string, events: ReactionEvent[]) =>
	deriveGadgetWindows(events).filter((w) => w.gadget === kind);

describe('the Thundercloud', () => {
	it('stands 5.5s from a Lunar-Charged', () => {
		const [cloud] = of('thundercloud', [rx(1, 'lunarCharged')]);
		expect(cloud.end - cloud.start).toBe(framesOf(5.5));
	});

	it('is ONE cloud whose clock restarts, never a second cloud', () => {
		// ⚠️ gcsim keeps it as a STATUS (`Status.Add(LcKey, 5.5*60)`), and its own
		// comment says the lifetime is "extended to last another 5.5s" — from the
		// new trigger, not added to what remained.
		const clouds = of('thundercloud', [
			rx(1, 'lunarCharged'),
			rx(2, 'lunarCharged'),
			rx(4, 'lunarCharged')
		]);
		expect(clouds).toHaveLength(1);
		expect(clouds[0].start).toBe(framesOf(1));
		expect(clouds[0].end).toBe(framesOf(9.5));
	});

	it('starts a new cloud once the old one has lapsed', () => {
		const clouds = of('thundercloud', [rx(1, 'lunarCharged'), rx(10, 'lunarCharged')]);
		expect(clouds).toHaveLength(2);
	});
});

describe('the Moondrift field', () => {
	it('drops THREE at once on the first Lunar-Crystallize, each lasting 9s', () => {
		// ⚓⚓ gcsim spawns `3 − nearby`, so one reaction on an empty field is three
		// drifts — ⛔ not one.
		const drifts = of('moondrift', [rx(1, 'lunarCrystallize')]);
		expect(drifts).toHaveLength(3);
		for (const d of drifts) {
			expect(d.start).toBe(framesOf(1));
			expect(d.end).toBe(framesOf(10));
		}
	});

	it('spawns NOTHING while three still stand', () => {
		// ⚓ The top-up is `3 − nearby`, so a full field adds none — and with the
		// counter at only 2 the Harmony branch is closed too, which leaves this
		// reaction doing nothing at all to the entities. ⚠️ That is the honest
		// reading of gcsim and not an omission.
		const drifts = of('moondrift', [rx(1, 'lunarCrystallize'), rx(9.5, 'lunarCrystallize')]);
		expect(drifts).toHaveLength(3);
		expect(new Set(drifts.map((d) => d.end))).toEqual(new Set([framesOf(10)]));
	});

	it('refreshes the standing three via Moondrift Harmony — on the THIRD reaction', () => {
		// ⚓⚓ TWO SEPARATE THREES, and conflating them is the trap. Harmony needs
		// three drifts STANDING *and* `lcrCountKey >= 3`, which counts every
		// Lunar-Crystallize since the last Harmony spent three. So the reaction at
		// 1s does nothing (counter 2) and the one at 2s fires, resetting every
		// drift to a full 9s — ends at 11s, ⛔ not at 10s.
		// ⚠️ Without this branch a stocked field quietly expires under a player who
		// is still reacting.
		const drifts = of('moondrift', [
			rx(0, 'lunarCrystallize'),
			rx(1, 'lunarCrystallize'),
			rx(2, 'lunarCrystallize')
		]);
		expect(drifts).toHaveLength(3);
		// One window each, its end MOVED — ⛔ not a second window per refresh.
		for (const d of drifts) expect(d.end).toBe(framesOf(11));
	});

	it('respects the Harmony ICD, so a second Harmony cannot fire inside 37 frames', () => {
		// ⚠️⚠️ THE COUNTER ALONE ALREADY BLOCKS MOST BURSTS, which is why this
		// fixture is shaped so carefully: Harmony spends three from the counter, so
		// it takes three MORE reactions to be eligible again, and only then does
		// the ICD have anything to refuse. Frames 0/12/24 fire it at 24 (ends →
		// 24 + 540); 26/28/30 rebuild the counter to 3 inside the 37-frame window,
		// and the ICD is the only thing that stops a second refresh at 30.
		const drifts = of('moondrift', [
			rxF(0, 'lunarCrystallize'),
			rxF(12, 'lunarCrystallize'),
			rxF(24, 'lunarCrystallize'),
			rxF(26, 'lunarCrystallize'),
			rxF(28, 'lunarCrystallize'),
			rxF(30, 'lunarCrystallize')
		]);
		expect(new Set(drifts.map((d) => d.end))).toEqual(new Set([24 + framesOf(9)]));
	});

	it('fires again once the ICD has cleared', () => {
		const drifts = of('moondrift', [
			rxF(0, 'lunarCrystallize'),
			rxF(12, 'lunarCrystallize'),
			rxF(24, 'lunarCrystallize'),
			rxF(26, 'lunarCrystallize'),
			rxF(28, 'lunarCrystallize'),
			rxF(70, 'lunarCrystallize')
		]);
		expect(new Set(drifts.map((d) => d.end))).toEqual(new Set([70 + framesOf(9)]));
	});

	it('drops a fresh three once the field has lapsed', () => {
		const drifts = of('moondrift', [rx(0, 'lunarCrystallize'), rx(20, 'lunarCrystallize')]);
		expect(drifts).toHaveLength(6);
	});
});

describe('the stream', () => {
	it('ignores reactions that spawn nothing', () => {
		expect(deriveGadgetWindows([rx(1, 'electroCharged'), rx(2, 'pyroCrystallize')])).toHaveLength(
			0
		);
	});

	it('leaves the Prism to fields.ts', () => {
		// ⛔ The Polestar Field is produced with its buff ledger, not here.
		expect(deriveGadgetWindows([rx(1, 'stellarConduct')])).toHaveLength(0);
	});
});
