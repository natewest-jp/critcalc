/**
 * src/lib/utils/castTokens.ts
 *
 * WHICH E/Q TOKENS A CHARACTER CAN ACTUALLY PERFORM — one derivation, three
 * consumers (the eager index generator, the roster parser sweep, the editor's
 * approximation squiggle).
 *
 * The parser is deliberately forgiving: a cast token it cannot resolve against
 * the character's kit does not fail, it APPROXIMATES. A character with no burst
 * ability gets a generic 15s-cooldown bar; an `hE` on a character with no hold
 * variant silently uses the tap timing. That tolerance is right — a half-typed
 * rotation should still draw — but it is silent, and silence became a problem
 * the moment the notation started being REWRITTEN for the user (a swap
 * renames a character's segments, so tokens written for Bennett arrive
 * on Nahida). A rename that invents timings without saying so is the one thing
 * single-truth must not do.
 *
 * So the vocabulary is published: the editor squiggles a token this says the
 * segment's character cannot perform, in --ui-provisional — "this timing is
 * approximate", not "you made a mistake". See notationFlags.ts for the rule and
 * the extension's theme block for the two registers.
 *
 * ⚠ RUNTIME-IMPORT-FREE, like deriveCapabilities and characterLint: the index
 * generator executes this module directly under Node's type stripping.
 */

import type { CharacterData } from '$lib/types/character';

/**
 * The tap-class skill tokens. KQM lets a plain skill entry be written three
 * ways and the parser treats them identically (the roster sweep asserts they
 * share timing), so any character with a skill ability can perform all three
 * whether or not its JSON names them.
 */
const TAP_SKILL_TOKENS = ['E', 'tE', 'pE'] as const;

/** Every token shape the tokenizer classifies as an E or Q cast entry. Anything
 *  outside this — an `input: ['N1']` on a normal ability, a plunge variant's
 *  "After Hold E" — is not a cast entry and is filtered out below.
 *
 *  ⚓ `sE` joined it 2026-09-16 beside `sQ`: KQM writes a stance's SPECIAL
 *  Elemental Skill that way (Varka's Four Winds' Ascension). ⚠️ It has to be
 *  here or the editor lints the token it is telling people to type — `casts`
 *  is built through this filter, and `notationFlags` warns on anything outside
 *  it. `sC` is deliberately absent: a charged attack is not a cast entry, and
 *  no `C`-family token is listed. */
const CAST_TOKEN_RE = /^(?:t|p|h|h1|h2|s)?E$|^s?Q$/;

/**
 * The distinct E/Q entry tokens `c` can perform, sorted.
 *
 * A skill ability contributes the three tap aliases plus anything it or its
 * variants declare (`hE`, `h1E`, `h2E`); a burst contributes `Q` plus its
 * variants' short-burst tokens (`sQ` — Flins Thunderous Symphony, Varesa
 * Volcano Kablam). A character with NEITHER ability — an uncurated stub —
 * returns an empty list, which is the honest answer: every cast it is given is
 * a generic stand-in.
 */
export function declaredCastTokens(c: Pick<CharacterData, 'abilities'>): string[] {
	const out = new Set<string>();
	for (const a of c.abilities ?? []) {
		if (a.abilityType !== 'skill' && a.abilityType !== 'burst') continue;
		if (a.abilityType === 'skill') for (const t of TAP_SKILL_TOKENS) out.add(t);
		else out.add('Q');
		for (const t of a.input ?? []) out.add(t);
		for (const v of a.variants ?? []) for (const t of v.input ?? []) out.add(t);
	}
	return [...out].filter((t) => CAST_TOKEN_RE.test(t)).sort();
}

/** Whether `c` carries a MEASURED plunge — a `plungeFrames` (or a plunge
 *  variant) on any normal ability. Absent, the parser draws `P` with
 *  `GENERIC_PLUNGE_FRAMES` and the editor flags it provisional (2026-09-17).
 *  Index-time fact (`CharacterIndexEntry.plunge`), same reason as `casts`. */
export function hasPlungeFrames(c: Pick<CharacterData, 'abilities'>): boolean {
	return (c.abilities ?? []).some(
		(a) =>
			a.abilityType === 'normal' &&
			(a.plungeFrames !== undefined || (a.plungeVariants?.length ?? 0) > 0)
	);
}

/** Whether `c` carries a MEASURED charged attack — `chargeFrames`, or a bow's
 *  `chargeHits` (its aimed shot, which `A` also reads), on any normal ability.
 *  Absent, the parser draws `C` with `GENERIC_CHARGE_FRAMES` and the editor
 *  flags it provisional (2026-10-15) — the plunge's rule, and its index fact's
 *  twin (`CharacterIndexEntry.charged`). */
export function hasChargeFrames(c: Pick<CharacterData, 'abilities'>): boolean {
	return (c.abilities ?? []).some(
		(a) =>
			a.abilityType === 'normal' &&
			(a.chargeFrames !== undefined || (a.chargeHits?.length ?? 0) > 0)
	);
}

/** Whether `c` carries KQM's `sC` — a `specialChargeFrames` on any normal
 *  ability (Varka's Azure Devour). Absent, `sC` falls back to the ordinary
 *  charge, which the editor says (`CharacterIndexEntry.specialCharge`). */
export function hasSpecialChargeFrames(c: Pick<CharacterData, 'abilities'>): boolean {
	return (c.abilities ?? []).some(
		(a) => a.abilityType === 'normal' && a.specialChargeFrames !== undefined
	);
}
