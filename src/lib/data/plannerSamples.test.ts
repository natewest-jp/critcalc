import { describe, it, expect } from 'vitest';
import { PLANNER_SAMPLES } from './plannerSamples';
import { characterIndex } from './characterIndex.generated';
import { tabCharacterIds } from '$lib/rotationTabs.svelte';

/**
 * The first-visit samples' builds (2026-10-18). 🐛 Four of the first batch
 * (Raiden National, Double Hydro National, Nahida Hyperbloom, Hu Tao Double
 * Hydro) declared no `cons` at all, so their Xingqiu, Bennett, Xiangling and
 * Kuki opened at C0 while every other sample put its 4★ members at C6. The
 * restore path carried every declared level faithfully (measured in the built
 * app, all fifteen); the levels were simply never written.
 */
const byId = new Map(characterIndex.map((c) => [c.id, c]));

describe('PLANNER_SAMPLES builds', () => {
	for (const s of PLANNER_SAMPLES) {
		const team = tabCharacterIds({ notation: s.notation });

		it(`${s.id}: every build key is a member of its team, by id`, () => {
			for (const id of [...Object.keys(s.cons ?? {}), ...Object.keys(s.loadout ?? {})]) {
				expect(team, `${id} is not in ${s.id}'s team`).toContain(id);
			}
		});

		it(`${s.id}: every 4★ member declares a constellation`, () => {
			const fourStars = team.filter((id) => byId.get(id)?.rarity === 4);
			for (const id of fourStars) {
				expect(s.cons?.[id], `${id} in ${s.id}`).toBeTypeOf('number');
			}
		});
	}
});
