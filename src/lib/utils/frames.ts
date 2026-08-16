/**
 * src/lib/utils/frames.ts
 *
 * The time unit of the rotation simulation.
 *
 * ⚓ INSIDE THE PARSER AND ON THE IR, A NUMBER THAT MEANS TIME IS AN INTEGER
 * COUNT OF 60fps FRAMES. Seconds exist at exactly two places: the JSON we read,
 * and the screen we draw. (gauge-round.md contract C1.)
 *
 * The game's clock is 60fps and gcsim is frames-native — aura lifetime is
 * `6·durability + 420` FRAMES, and our familiar `2.5·U + 7` seconds is that
 * number divided. Seconds are the lossy re-expression, not the other way round,
 * and carrying them internally cost us float-keyed lookup maps, three different
 * epsilon conventions, and drift on any interval walked by repeated addition.
 *
 * ⛔ THERE IS NO `secondsOf` COMPANION, deliberately. The reverse direction is
 * presentation, it is always a bare `/ 60`, and giving it a name would invite it
 * to be called somewhere that is not presentation — which is how a frames-native
 * system quietly becomes bilingual again. A division at a display site is
 * self-evidently a display site; a named helper is not.
 *
 * Types only in spirit — one function, no imports, safe everywhere.
 */

/** Frames per second. The game's clock, and gcsim's. */
export const FPS = 60;

/**
 * Authored seconds → integer frames. **THE** rounding site in the simulation.
 *
 * ⚠️ This SNAPS, and that is the point. An authored value that is not a whole
 * frame was never expressible on the game's clock — `2.33` is Varesa's Apex
 * Drive window, whose true value is gcsim's 140 frames, and rounding recovers it
 * exactly. Where an authored value is a genuine 2-dp rounding of a frame count
 * (`12.57` = 754f, `0.983` = 59f) this recovers those too.
 *
 * ⚠️ The one class it does NOT recover is a value that was never a frame count to
 * begin with — Furina's Salon Solitaire intervals are statistical MEANS of a
 * genuinely randomised tick (±7 frames of real spread), so a half-frame rounding
 * there is noise against the mechanic. See gauge-round.md §C1.
 */
export const framesOf = (seconds: number): number => Math.round(seconds * FPS);

/**
 * The keys `InitNormalCancelSlice` overrides with the hitmark. Everything else in
 * a normal's slice is the animation length.
 *
 * ⚠️ `P` is deliberately absent — gcsim does not override `ActionHighPlunge`, so
 * a plunge after a normal waits out the whole animation.
 */
const HIT_KEYS: ReadonlySet<string> = new Set(['E', 'Q', 'D', 'J', 'swap']);

/**
 * Resolve one entry of a FrameMap: how long until the given next action.
 *
 * ⚓⚓ **THE ONE PLACE THE FALLBACK LIVES.** Before L4b this was written inline as
 * `fm[key] ?? fm.swap` at five sites, and it was wrong at every one of them: gcsim
 * fills an unlisted slot with the ANIMATION length, and `swap` is just an override
 * that usually happens to be shorter. ⛔ Never re-inline it — the failure mode is
 * silent and it understated a charged attack after a normal by a median 22 frames.
 *
 * ⚠️ A FrameMap authored before L4b has no `anim`; the migration gave every one of
 * them the field, and `characterLint` requires it. The `?? 0` here is a NaN guard
 * for hand-built fixtures, not a fallback anyone should rely on.
 */
export function frameAt(fm: import('$lib/types/ability').FrameMap, key: string): number {
	const explicit = (fm as Record<string, number | undefined>)[key];
	if (typeof explicit === 'number') return explicit;
	if (HIT_KEYS.has(key) && typeof fm.hit === 'number') return fm.hit;
	return fm.anim ?? 0;
}
