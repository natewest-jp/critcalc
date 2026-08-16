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
 *  Emission sites: one hit per E/Q cast (post-`emitReactionsAtCast`, in
 *  `handleCast`) and one hit per NORMAL SWING / charged / plunge action.
 *  Dash/jump/unset emit no hits; a frameless plunge emits none (matching
 *  its no-event behavior).
 *
 *  Conventions (ratified with the onHit wiring, 2026-07-17):
 *  - **Per-swing = one hit.** Multi-hit swings are not curated (`NormalHit`
 *    carries no hit count; FrameMaps collapse to the last hitmark), so a
 *    swing produces exactly one hit. Effects that count hits without a
 *    procCooldown will undercount on multi-hit swings — a documented
 *    approximation until a `NormalHit.hitCount` consumer appears.
 *  - **`time`** — E/Q casts: the cast start (legacy convention). Actions:
 *    the swing END (`actionEvent.time + duration`; equals the start for
 *    frameless kits) — cancel-window frames are the closest recorded proxy
 *    for the hitmark, and legacy block-driven onHit buffs open at block end.
 *  - **`element` ABSENT ⇒ physical** (the ActionEvent convention). Cast
 *    hits always carry the caster's element.
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
