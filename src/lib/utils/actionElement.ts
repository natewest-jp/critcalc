/**
 * src/lib/utils/actionElement.ts
 *
 * The single source of the "is this N/C/P attack infused, and with what
 * element?" rule — shared by the rotation parser (which stamps the element on
 * every action event and hit) and the notation editor's syntax highlighter
 * (which tints elemental attacks the caster's element).
 *
 * The rule: an N/C/P action lands with an element when the character wields a
 * catalyst (all catalyst N/C/P are elemental), when it's a bow's charged/aimed
 * shot (bar the C1 partial shot, which is physical), or when the active normal
 * ability carries an infusion (a stance/permanent infusion). The element is the
 * infusion if present, else the character's own element.
 *
 * `infusion` is the caller's contribution of context the rule itself can't see.
 * ⚠️ There are TWO sources of one and the parser resolves both, stance FIRST:
 * `NormalAbility.infusion` (a field on a stance's normal ability — Cyno after Q,
 * Xiao's Q-stance plunges) and, since 2026-08-15, an `infuse` EFFECT's window
 * (Bennett C6 and Candace granting to whoever is on field; Dori, Kazuha and
 * Lohen to themselves). A stance infusion wins, because it is the character's
 * own and in game a self-infusion overrides a granted one.
 *
 * The editor passes `undefined` for both, because it reads only the eager
 * identity index and doesn't run the parser's state machine — so it colors
 * permanent weapon-class infusions exactly and leaves every timed one neutral.
 */

import type { Element } from '$lib/types/ability';
import type { WeaponType } from '$lib/types/weapon';

/** The three attack classes whose element depends on weapon/infusion (E/Q casts
 *  always carry the character's element and don't go through this rule). */
export type NormalActionKind = 'normal' | 'charged' | 'plunge';

/**
 * The element an N/C/P action lands with, or `undefined` when it is physical.
 *
 * @param kind       normal / charged / plunge
 * @param tokenText  the action token as typed ("N3", "C1", "hP", …) — only the
 *                   bow C1 partial-shot exception reads it
 * @param weapon     the character's weapon type
 * @param element    the character's own element (the fallback when uninfused)
 * @param infusion   the active normal ability's infusion, when the caller can
 *                   resolve one (parser: stance-aware; editor: always undefined)
 */
export function resolveActionElement(
	kind: NormalActionKind,
	tokenText: string,
	weapon: WeaponType | undefined,
	element: Element | undefined,
	infusion: Element | undefined
): Element | undefined {
	const elemental =
		weapon === 'catalyst' ||
		(kind === 'charged' && weapon === 'bow' && tokenText !== 'C1') ||
		infusion !== undefined;
	if (!elemental) return undefined;
	return infusion ?? element ?? 'pyro';
}
