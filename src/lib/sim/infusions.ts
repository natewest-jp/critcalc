/**
 * src/lib/sim/infusions.ts
 *
 * Elemental infusions granted by an `infuse` EFFECT — opening the window at the
 * cast, and answering "what element is this swing" at the consumption site
 * (gauge-round L3c, lifted out of `notationParser.ts`).
 *
 * ⚠️ A DIFFERENT MECHANISM from `NormalAbility.infusion`, which is a field on a
 * stance's normal ability and needs no tracking at all — the stance IS the
 * window. An `infuse` Effect is a timed grant from a cast, and it may land on
 * someone else.
 *
 * ⚓ The `active`-target case is structural rather than hard: only the ACTIVE
 * character swings, so the swinger is by construction the receiver. That turns
 * "a window per receiver" into a lookup at consumption.
 *
 * ⚓⚓ ONE CONDITION TREE, TWO SUBJECTS. `constellation` is a fact about the
 * HOLDER and is known at the cast; `weaponType` is a fact about the RECEIVER and
 * is not known until someone swings. So the cast site drops a window only on a
 * definitive `false`, and the consumption site re-evaluates with the receiver's
 * weapon in hand.
 *
 * ⛔ A window is NEVER truncated on swap (⚓ Bennett's C6 infusion is famously
 * still there when you swap back inside the 12s).
 */

import type { Element } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import { framesOf } from '$lib/utils/frames';
import { getCharacterEffectsForCast } from '$lib/utils/effectCollection';
import type { SimContext } from './context';
import {
	DEFAULT_ASCENSION,
	evalCondition,
	type ChainIndex,
	type ConditionContext
} from './conditions';

/** Opens an infusion window for every `infuse` Effect this cast fires
 *  (infusion round, 2026-08-15). Reuses `getCharacterEffectsForCast`, which
 *  already walks abilities + passives + constellations + faction bonuses and
 *  applies the variant-replacement rule — three of the five authored
 *  infusions live on a C6, so a walk of the cast ability alone would find
 *  only Candace's and Lohen's.
 *
 *  ⚠️ The conditions are judged TWICE, because one tree has two subjects:
 *  `constellation` is a fact about the HOLDER and is known here, while
 *  `weaponType` is a fact about the RECEIVER and is not. So this site drops
 *  a window only on a definitive `false`, and the consumption site
 *  re-evaluates with the receiver's weapon in hand. Each pass resolves what
 *  it can and neither can wrongly open a window the other would close. */
export function registerInfusionsOnCast(
	ctx: SimContext,
	char: CharacterData,
	castKind: 'skill' | 'burst',
	castTime: number,
	castLabel: string,
	states: ReadonlySet<string>,
	constellation: number,
	chainIdx: ChainIndex,
	stackState: Map<string, number>,
	holderCtx: ConditionContext
): void {
	for (const fx of getCharacterEffectsForCast(char, castKind, castLabel)) {
		if (fx.type !== 'infuse') continue;
		if (fx.duration === undefined || fx.duration <= 0) continue;
		const targets = Array.isArray(fx.target) ? fx.target : [fx.target];
		// `self` and `active` are the only receivers an infusion can mean —
		// you cannot infuse an off-field character's normals, because they
		// are not swinging. A `team`-target infusion would be an authoring
		// error rather than something to approximate.
		const receiver = targets.includes('active')
			? 'active'
			: targets.includes('self')
				? 'self'
				: undefined;
		if (!receiver) continue;
		const holderVerdict = evalCondition(
			fx.conditions,
			DEFAULT_ASCENSION,
			states,
			constellation,
			chainIdx,
			stackState,
			holderCtx
		);
		if (holderVerdict === false) continue;
		ctx.infusionWindows.push({
			holderId: char.id,
			holderConstellation: constellation,
			receiver,
			element: fx.element,
			start: castTime,
			end: castTime + framesOf(fx.duration),
			...(fx.conditions !== undefined ? { conditions: fx.conditions } : {})
		});
	}
}

/** The element infusing `receiver`'s N/C/P at `time`, or undefined.
 *
 *  ⚠️ NEWEST WINS. Two overlapping infusions is a real rotation (Bennett Q
 *  then Candace Q), and in game the later grant replaces the earlier — an
 *  infusion is not a stack.
 *
 *  ⚠️ The re-evaluation deliberately carries only TWO facts: the holder's
 *  constellation and the receiver's weapon. ⛔ It passes no states, no
 *  stacks and NOT the swinger's `ConditionContext` — those describe the
 *  wrong character. The holder's own were already judged at the cast, and
 *  handing over a per-holder map (`teamElementCounts`) built for the
 *  receiver would answer a holder's question with a stranger's facts.
 *  Anything else in the tree returns null here, and null is kept. */
export function infusionAt(
	ctx: SimContext,
	receiver: CharacterData,
	time: number
): Element | undefined {
	for (let i = ctx.infusionWindows.length - 1; i >= 0; i--) {
		const w = ctx.infusionWindows[i];
		if (time < w.start || time >= w.end) continue;
		if (w.receiver === 'self' && w.holderId !== receiver.id) continue;
		const verdict = evalCondition(
			w.conditions,
			DEFAULT_ASCENSION,
			new Set(),
			w.holderConstellation,
			new Map(),
			undefined,
			{ receiverWeapon: receiver.weapon }
		);
		if (verdict === false) continue;
		return w.element;
	}
	return undefined;
}
