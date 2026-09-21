/**
 * src/lib/sim/hits.ts
 *
 * The parser-private hit record and the shared onHit trigger gate
 * (gauge-round L3c — lifted verbatim out of `notationParser.ts`).
 *
 * ⚓ A hit is NOT part of the public IR (post-P4 #1) — `ParsedRotation` does not
 * expose one. These records exist for the internal onHit dispatch and for the
 * buff-window derivation, and `notationParser.ts` re-exports the type because
 * `buffWindows.ts` takes them as input.
 */

import type { DamageTag, Element, Trigger } from '$lib/types/ability';
import { evalTriggerFilter } from '$lib/types/ability';

/** Raw hit record. PARSER-PRIVATE (post-P4 #1 decision): consumed by the
 *  onHit dispatchers (gainStacks / consumeStacks) and — via the retained
 *  per-parse list — the buff-window derivation pass. NOT part of the public
 *  IR event stream; action events are the public per-action surface and
 *  carry no hit-level records.
 *
 *  Emission sites: one hit per LANDING (every-landing round, 2026-09-21) — each
 *  entry of an E/Q cast's nominal `application[]`, each frame of a swing's
 *  `landingsOf(frames)` — dispatched in `handleCast` and by `landSwing`.
 *  Dash/jump/unset emit no hits; a frameless plunge emits none (matching
 *  its no-event behavior). A cast or map that states no landing emits ONE, at
 *  the press / the swing's end.
 *
 *  Conventions (ratified with the onHit wiring, 2026-07-17):
 *  - ↻ **A swing lands as many hits as its map lists.** Until the every-landing
 *    round one swing was one hit, a documented approximation: ICD and every
 *    un-cooled `onHit` undercounted on the 113 multi-hit maps. A swing's hits
 *    share its `sourceEventId`, `hitIndex` (the COMBO index — ⛔ not a hit
 *    ordinal) and resolved element.
 *  - **`time`** — E/Q casts: the record's OWN landing (cast hit-record round,
 *    2026-09-21) — its entry of the nominal `application[]`; the first is
 *    `CastEvent.firstHitAt`, all of them `CastEvent.hitsAt`; the cast start
 *    when it states none. Actions:
 *    the swing's LANDING (§1.K, 2026-09-20) — `landsAt(frames)` from the
 *    swing's start, which is its hitmark. ⚠️ A map that states no landing
 *    frame, or a swing cancelled before it, keeps the swing END
 *    (`actionEvent.time + duration`), the placement every swing had before
 *    that round. The application and this record are ONE instant by
 *    construction — `run.ts`'s `landSwing` hands both over as one closure.
 *  - **`element` ABSENT ⇒ physical** (the ActionEvent convention). A cast
 *    hit carries its first landed `application[]` entry's element, or the
 *    caster's when the cast states no landing.
 *  - `damageTag`/`abilityName`/`isCrit` mirror the renderer's
 *    `resolveCastContext`/`resolveBlockContext` conventions so
 *    `evalTriggerFilter` gating agrees across both surfaces.
 *  - `hitIndex` — the swing's combo index (normals only).
 *  - `stacks` — post-gain, pre-consume snapshot of the hitter's segment
 *    stack state at hit time (the cast-site `stackContext` analog).
 *  - `sourceEventId` — the public cast/action event id that produced the
 *    hit (window provenance for the buff derivation). */
export type HitEvent = {
	characterId: string;
	time: number;
	abilityType: 'skill' | 'burst' | 'normal' | 'charged' | 'plunge';
	element?: Element;
	damageTag: DamageTag;
	abilityName?: string;
	hitIndex?: number;
	stacks?: ReadonlyMap<string, number>;
	sourceEventId: number;
	/**
	 * ⚓⚓ DELIVERED BY AN ENTITY, NOT BY THE CHARACTER — a summon's damage tick,
	 * synthesized at finalize (step 6c). Absent on every hit a character landed
	 * itself: an E/Q cast, a normal, a charged, a plunge.
	 *
	 * ⚓ The word and the meaning are shared with `offerApplication`'s flag of the
	 * same name (mark-triggered round, 2026-08-17), deliberately: one vocabulary
	 * for "this came from the summon, whose owner may be off field". A tick
	 * carries its OWNER's `characterId`, so an id comparison alone cannot tell
	 * the two apart — which is gcsim's `ActorIndex` defect, and the reason
	 * `source: 'active'` needs this flag rather than a name check.
	 */
	viaEntity?: true;
	/**
	 * ⚓ A CAST'S HIT THAT LANDED AFTER ITS CASTER LEFT THE FIELD (cast hit-record
	 * round, 2026-09-21) — Amber's Bunny at 530f, Klee's mines, Mona's bubble. The
	 * character still landed it (⛔ not `viaEntity`: that routes a hit into the
	 * summon-tick passes, and this is the cast's own), but it is not the ACTIVE
	 * character's hit, which is gcsim's `ActorIndex == Player.Active()` test.
	 */
	offField?: true;
};
// NB: the type export above is for the parser-side buff-window derivation
// (`buffWindows.ts`) ONLY — hit records remain OUTSIDE the public IR event
// stream (post-P4 #1 decision stands; `ParsedRotation` does not expose them).

/** Shared onHit trigger gate: source scoping + coarse abilityType/damageType
 *  filters + the fine-grained `filter` (G primitive) via `evalTriggerFilter`.
 *  A hit with no `element` is physical (ActionEvent convention).
 *  ⚓ Exported since 2026-08-15 for the artifact onHit branch in
 *  `buffWindows.ts` — that module already imports `evalCondition` from here,
 *  so this crosses the same documented-benign cycle. Reused rather than forked:
 *  a second copy of a trigger gate is how the two ends drift. */
export function onHitTriggerMatches(
	trigger: Extract<Trigger, { type: 'onHit' }>,
	hit: HitEvent,
	holderId: string
): boolean {
	const srcMode = trigger.source ?? 'self';
	if (srcMode === 'self' && holderId !== hit.characterId) return false;
	if (srcMode === 'others' && holderId === hit.characterId) return false;
	// ⚓ `'active'` is `'team'` minus what an ENTITY delivered. A cast or swing hit
	// is the on-field character's by construction, so this one clause is the whole
	// of the distinction — see the source doc on the trigger.
	if (srcMode === 'active' && (hit.viaEntity || hit.offField)) return false;
	if (trigger.abilityType !== undefined) {
		// Array form matches any listed class under one effect (one shared
		// procCooldown clock — Escoffier C6's NA/CA/PL 0.5s ICD).
		const classes = Array.isArray(trigger.abilityType)
			? trigger.abilityType
			: [trigger.abilityType];
		if (!classes.includes(hit.abilityType)) return false;
	}
	const isPhysical = hit.element === undefined || hit.element === 'physical';
	if (trigger.damageType === 'elemental' && isPhysical) return false;
	if (trigger.damageType === 'physical' && !isPhysical) return false;
	return evalTriggerFilter(trigger.filter, {
		damageTag: hit.damageTag,
		element: hit.element ?? 'physical',
		abilityName: hit.abilityName,
		hitIndex: hit.hitIndex,
		// Optimistic-fire: the planner doesn't simulate crit outcomes (mirrors
		// resolveCastContext / resolveBlockContext).
		isCrit: true
	});
}
