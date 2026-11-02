import { MAX_LEVEL, snapLevel, stepLevel } from '../reactionCurves';

/**
 * The character-level slider, spread into an `InstrumentSlider`
 * (`{...LEVEL_SLIDER}`): 1–90, then 95 and 100. A drag lands on the nearest
 * level a character can hold, the arrows step 90 → 95 → 100, and the three
 * marks show where the stops are. Reaction curves, Enemy RES & DEF and the
 * Damage breakdown each carried their own copy.
 */
export const LEVEL_SLIDER = {
	min: 1,
	max: MAX_LEVEL,
	step: 1,
	snap: snapLevel,
	stepKey: stepLevel,
	marks: [90, 95, 100]
};
