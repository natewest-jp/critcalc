/**
 * Human timing — what a rotation costs when a PERSON plays it (2026-09-14).
 *
 * The parse is frame-perfect by default: every cancel lands on the exact frame
 * gcsim's slice says the next action may begin, which is what macro-driven frame
 * counts describe and what the game allows. A player is not a macro. KQM's frames
 * page (TCL, "Frames"): "Since macros aren't often used in actual gameplay, a
 * good starting point is adding 10 frames to every attack to account for human
 * error" — and "different players have very different skill levels, so consider
 * that when using these frames and add accordingly." That sentence is this
 * module's whole authority; the number is the player's, exposed in Settings.
 *
 * ⚓⚓ THE RULE IS INPUT BUFFERING, NOT A UNIFORM SLOWDOWN. The game STORES some
 * inputs and executes them the frame the current action allows, so a human costs
 * nothing at those transitions and everything at the others. From the same page:
 *   - "Most Normal and Charged Attacks can be buffered, but Bow Charged Attacks
 *     cannot." The next N or C pressed DURING a swing is queued → no human gap.
 *     ⚠️ That sentence says a CA can BE buffered (pressed during a normal); the
 *     page never says what is stored AFTER a CA. We extend "a swing stores the
 *     next swing" to a CA, which KQM's Raiden guide supports ("can be input
 *     buffered or button-mashed" over her N3C / N1C combos) — and ⚓ it is NOT
 *     universal: Lohen's quick guide says "you cannot buffer inputs after a
 *     Charged Attack". A character like that carries
 *     `NormalAbility.noBufferAfterCharged` (2026-09-17). ⛔ Don't flip the
 *     default without a source that speaks for most characters.
 *   - "Any action after Normal Attacks (except the next Normal Attack or Charged
 *     Attack) can't be buffered because it will cancel the Normal Attack
 *     immediately when the action is input." So N → E/Q/D/J/swap is TIMED by
 *     the player against the hitmark: early loses the hit, late wastes frames.
 *   - "Any action after swapping to a character also can't be buffered, meaning
 *     you have to wait until the new character appears." A REACTION, not a
 *     timing — the largest single human site.
 *   - During a Skill or Burst, inputs are "buffered or ignored" and the page does
 *     not say which. ⚠️ An UNKNOWN, resolved conservatively: KQM's +10 is "every
 *     attack", so a cast pads like everything else that is not a stored input.
 *
 * Two adjustments ride the SAME transition set, because both are about the
 * moment a player presses a button the game was not already holding:
 *   - **padding** — frames added after the action, before the next input;
 *   - **full animations** — resolve the action to its animation length instead
 *     of the cancel slice (most players never cancel). ⛔ NEVER at a buffered
 *     transition: gcsim's N→N frames ARE the chain cadence a stored input
 *     produces, so `anim` there would slow the string past what any player sees.
 *
 * ⛔ NOT a 2-frame "input lag floor". KQM observes the animation starting ~2
 * frames after the press, but gcsim counts an action as `end − start` where the
 * end is the START FRAME OF THE NEXT ACTION'S ANIMATION — so a macro's lag is
 * already inside every cancel number we ship, and a floor would count it twice.
 *
 * ⚠️ gcsim parses `attack_delay`/`skill_delay`/… and a `frame_defaults=human`
 * preset (swap 8, everything else 5) but its core applies ONLY `swap_delay`
 * (`pkg/core/player/exec.go`); the others are echoed into the result metadata
 * and read by nothing. So there is no oracle for this — it is a stated model.
 */
import type { ActionKey } from '$lib/types/ability';
import type { CancelKey } from '$lib/utils/frames';
import { FULL_ANIMATION_KEY } from '$lib/utils/frames';

/** What the parse is told when the planner's Human plate is lit. `null` = frame-perfect. */
export type HumanTiming = {
	/** Frames added after every non-buffered action. 0 = padding off. */
	padFrames: number;
	/** Resolve non-buffered actions to `anim` instead of the cancel slice. */
	fullAnimations: boolean;
};

/** KQM's "good starting point". 🎛️ The Settings slider's default. */
export const HUMAN_PAD_DEFAULT_F = 10;
export const HUMAN_PAD_MIN_F = 1;
export const HUMAN_PAD_MAX_F = 20;

/** The action a pad follows. `swap` = the incoming character's first input. */
export type HumanPadAfter =
	| 'normal'
	| 'charged'
	| 'plunge'
	| 'skill'
	| 'burst'
	| 'dash'
	| 'jump'
	| 'swap';

/**
 * Does the game STORE the input for `next` while `prev` is still running?
 * Only a swing stores anything, and only the next swing (N, or C off a
 * non-bow). ⚠️ A bow's C is its aimed shot — `peekActionKey` maps `A` to `C`
 * on a bow, and KQM says that one cannot be buffered. `chargedBuffers: false`
 * is a character that stores nothing after a Charged Attack (Lohen).
 */
export function isBufferedTransition(
	prev: HumanPadAfter,
	next: ActionKey,
	isBow: boolean,
	chargedBuffers = true
): boolean {
	if (prev !== 'normal' && prev !== 'charged') return false;
	if (prev === 'charged' && !chargedBuffers) return false;
	if (next === 'N') return true;
	if (next === 'C') return !isBow;
	return false;
}

/** The key to resolve `prev`'s frames with: the cancel slice, or the whole animation. */
export function cancelKeyFor(
	ht: HumanTiming | null,
	prev: HumanPadAfter,
	next: ActionKey,
	isBow: boolean,
	chargedBuffers = true
): CancelKey {
	if (!ht?.fullAnimations) return next;
	return isBufferedTransition(prev, next, isBow, chargedBuffers) ? next : FULL_ANIMATION_KEY;
}

/** Frames of human padding after `prev` when `next` follows it (0 = none). */
export function padFramesAfter(
	ht: HumanTiming | null,
	prev: HumanPadAfter,
	next: ActionKey,
	isBow: boolean,
	chargedBuffers = true
): number {
	if (!ht || ht.padFrames <= 0) return 0;
	return isBufferedTransition(prev, next, isBow, chargedBuffers) ? 0 : ht.padFrames;
}
