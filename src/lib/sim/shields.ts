/**
 * src/lib/sim/shields.ts
 *
 * Shield windows: registering one at its cast, and draining expired ones into
 * `shieldEnd` events + `onShieldEnd` dispatch (gauge-round L3c, lifted out of
 * `notationParser.ts`).
 *
 * ⚠️ Shatter-by-damage is NOT modelled — the planner has no enemy or HP state,
 * so a shield always survives to its scheduled expiry. Same optimistic
 * convention as the rest of the planner's null-resolving treatment.
 *
 * ⏭ `dispatchShieldEnds` is POLLED, at each cast site and once at rotation end,
 * and it stays that way through L3 on purpose (L3 plan §4.2). Making the expiry
 * a task is the natural clock move and it is order-VISIBLE — `shieldEnd` is a
 * public IR event, so scheduling it changes its id and its tie position for no
 * gain until something has to fire at that instant.
 */

import type { AbilityVariant, CastAbility, Effect } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import { framesOf } from '$lib/utils/frames';
import type { SimContext } from './context';
import {
	DEFAULT_ASCENSION,
	evalCondition,
	type ChainIndex,
	type ConditionContext
} from './conditions';
import {
	effectSourcesAtConstellation,
	getNonAbilityEffectsForCast
} from '$lib/utils/effectCollection';

/** Register a shield window when the active cast spawns a shield. Two
 *  authoring conventions covered:
 *    1. Ability has `tags: ['shield']` AND `summons[0]` — the primary
 *       summon's duration IS the shield duration (Noelle Breastplate,
 *       Zhongli Jade Shield, Xinyan, Layla pattern).
 *    2. Ability has an `Effect.type: 'shield'` with onCast trigger and
 *       an explicit `duration` — the effect's duration IS the shield
 *       duration (Beidou Q pattern; bound to the cast site since onCast
 *       triggers fire at cast time).
 *
 *  🐛 THE TWO ARE A PRECEDENCE, NOT A UNION (fixed 2026-08-14). They used to
 *  both run, so an ability satisfying both registered TWO identical windows
 *  and fired TWO `shieldEnd` events per cast — seven abilities did (Baizhu Q,
 *  Citlali E, Ineffa E, Kirara E, Layla E, Thoma E, Xinyan E). Noelle's
 *  curator notes document the trap from the far side: her skill's shield
 *  Effect is authored deliberately WITHOUT a `duration` so the summon stays
 *  "the single onShieldEnd source", or her C4 Geo explosion would double-fire.
 *  The data should not have to be shaped around this. Case 2 wins because it
 *  is the EXPLICIT statement — a shield Effect with its own duration says the
 *  shield's length outright, where case 1 infers it from a summon's lifetime
 *  that merely coincides. All seven pairs carry equal durations today, so
 *  this removes duplicates and changes no span.
 *
 *  Shatter-by-damage is NOT modelled — the planner has no enemy/HP state.
 *  Shield windows always fire `onShieldEnd` at scheduled expiry, with the
 *  same null-resolving "assumed to hold" convention as the rest of the
 *  planner's optimistic-render treatment.
 *
 *  ⚓ CASE 2 HAS TWO HALVES SINCE 2026-08-18 — the cast ABILITY'S own effects
 *  and the character's PASSIVE / unlocked-CONSTELLATION ones. It read only the
 *  former, so a `shield` Effect authored on a constellation entry reached no
 *  lane at ANY level: Beidou C1 and Yanfei C4 both grant a 15s shield off their
 *  burst and neither had ever drawn. ⚠ NOT a leak and NOT the constellation
 *  gate's doing (they drew nothing at C0 *or* C6) — it is the orphaned-schema
 *  guard's blind spot, since `shield` effects ARE read, just not from this
 *  source. See docs/constellation-shield-gap.md. */
export function registerShieldOnCast(
	ctx: SimContext,
	char: CharacterData,
	castKind: 'skill' | 'burst',
	castTime: number,
	activeAbility: CastAbility,
	variant: AbilityVariant | undefined,
	sourceCastId: number,
	constellation: number,
	states: ReadonlySet<string>,
	chainIdx: ChainIndex,
	stackState: Map<string, number>,
	holderCtx: ConditionContext
): void {
	// ⚠ VARIANT FIRST, for both halves. A variant's `effects` and `summons`
	// each REPLACE the base ability's (see AbilityVariant in types/ability),
	// so a hold-E shield reads its own duration rather than the tap's —
	// Diona 12s not 4.8s, Candace 1.52s not 0.27s — and Zhongli, whose Jade
	// Shield lives only on his hE variant, gets a shield window at all.
	const abilityEffects = variant?.effects ?? activeAbility.effects ?? [];
	const abilitySummons = (variant?.summons?.length ? variant.summons : activeAbility.summons) ?? [];
	const abilityTags = variant?.tags ?? activeAbility.tags;
	const windows: {
		ability: 'skill' | 'burst';
		endTime: number;
		label?: string;
		/** Ability-hosted, as opposed to passive/constellation-hosted. Only the
		 *  ability half may satisfy `authorsShieldEffect` or be reconciled
		 *  against a stand-in summon — see both sites below. */
		fromAbility: boolean;
		coveredBySummon?: boolean;
	}[] = [];
	/** Push a window for one qualifying shield Effect, or nothing.
	 *
	 *  ⚠ The conditions are judged here for BOTH halves, which is new in shape
	 *  and a no-op in the corpus: no ability-hosted shield carries conditions,
	 *  and every constellation-hosted one carries exactly its own entry's level,
	 *  which `getNonAbilityEffectsForCast` has already applied at collection.
	 *  Only a definitive `false` drops — same optimistic null-resolving rule
	 *  `registerInfusionsOnCast` uses at the sibling call, and the same one this
	 *  file's "a shield always survives to its scheduled expiry" rests on. */
	const pushShield = (eff: Effect, fromAbility: boolean): void => {
		if (eff.type !== 'shield') return;
		if (eff.trigger.type !== 'onCast') return;
		if (eff.trigger.ability !== undefined && eff.trigger.ability !== castKind) return;
		if (eff.duration === undefined || eff.duration <= 0) return;
		const verdict = evalCondition(
			eff.conditions,
			DEFAULT_ASCENSION,
			states,
			constellation,
			chainIdx,
			stackState,
			holderCtx
		);
		if (verdict === false) return;
		windows.push({
			ability: castKind,
			endTime: castTime + framesOf(eff.duration),
			fromAbility,
			...(eff.label !== undefined ? { label: eff.label } : {})
		});
	};
	// Case 2 FIRST — it is the one that wins (see the precedence note above).
	// `Effect.type === 'shield'` with an onCast trigger + explicit duration.
	// Triggers gated on the cast type via `trigger.ability` (if set) must match
	// the current cast.
	//
	// Half A — the RESOLVED cast ability's own effects.
	for (const eff of abilityEffects) pushShield(eff, true);
	// Half B — passives + unlocked constellations + faction bonuses.
	// ⛔ NOT `getCharacterEffectsForCast`: that walks EVERY ability of this
	// cast's type, and Lan Yan has three `skill` abilities of which only the
	// base one shields — her stance follow-ups would each register a 12.5s
	// shield they do not grant. The caller has already resolved which ability
	// this cast is; half A is that ability, and this is the rest.
	for (const eff of getNonAbilityEffectsForCast(char, constellation, castKind)) {
		pushShield(eff, false);
	}
	// Case 1: summon-tagged shield ability — the FALLBACK, for kits whose
	// shield has no Effect of its own AT ALL.
	// ⚠ THE GUARD IS "no shield Effect", not "case 2 produced nothing".
	// Thoma's burst is why: it authors its shield as an onHit effect (8s,
	// refreshing on team normal hits), which this onCast site cannot fire —
	// so case 2 came back empty and the fallback happily inferred a shield
	// from "Scorching Ooyoroi", his 15s FIELD. An 8s shield rendered as a
	// 15s one, from a summon that isn't a shield. An ability that states a
	// shield Effect has spoken; if this site can't fire it, the answer is
	// nothing, not a guess off the nearest summon.
	const authorsShieldEffect = abilityEffects.some((e) => e.type === 'shield');
	// ⏸️ DORMANT SINCE 2026-08-14 and kept deliberately: every corpus shield
	// now authors an Effect, so nothing reaches this branch. It survives
	// because a kit CAN still legitimately be authored the old way, and
	// silently dropping its shield would be worse than a fallback nobody
	// currently needs. If it ever fires again, `coveredBySummon` below is
	// what stops the shield lane drawing what the summon lane already has.
	// ⚠ THE GUARD ASKS ABOUT THE ABILITY HALF ONLY, both terms of it. A
	// constellation-hosted shield must not satisfy `authorsShieldEffect` (it is
	// not the ABILITY speaking) and must not suppress this fallback by merely
	// existing — otherwise a C-shield would silently delete a kit's
	// summon-inferred one. Nothing in the corpus is shaped that way today; the
	// asymmetry is the point of writing it down.
	if (
		!windows.some((w) => w.fromAbility) &&
		!authorsShieldEffect &&
		abilityTags?.includes('shield')
	) {
		const primary = abilitySummons[0];
		if (primary?.duration !== undefined && primary.duration > 0) {
			// The stand-in summon's label IS the shield's name in this
			// convention, so it rides along rather than being lost.
			windows.push({
				ability: castKind,
				endTime: castTime + framesOf(primary.duration),
				fromAbility: true,
				label: primary.label
			});
		}
	}
	if (windows.length === 0) return;
	// ⚓ ONE SPAN, ONE BAR (2026-08-18). Two shield Effects on one cast that
	// resolve to the SAME span are one shield stated twice, not two shields —
	// and the shield lane draws SPANS under the CASTER with no notion of a
	// RECIPIENT, so a second window there is a second bar the reader cannot
	// tell from the first (plus a second `shieldEnd`, which is the 2026-08-14
	// double-window class back). ⚠ It collapses IDENTITY, not coincidence: a
	// genuinely different LENGTH is a different shield and still draws its own
	// bar. The ability half is pushed first, so the survivor keeps its
	// provenance, and a name from either half is kept.
	//
	// ⏸️ DORMANT AS OF ITS OWN DAY, and kept for the same reason the summon
	// fallback above is. Nicole's C2 was the one author — her skill's own
	// "Shield of Blazing Light" re-granted at the same 20s — and it turned out
	// to be a CO-OP statement ("nearby active party members" is plural only
	// when several players each have an on-field character), so it was retired
	// to a curator note rather than modelled. ⚓ The half-A/half-B pool is what
	// makes a same-span pair reachable at all, so the guard outlives its
	// author; `shields.test.ts` exercises it on a synthetic re-add of exactly
	// the shape that was retired.
	if (windows.length > 1) {
		const bySpan = new Map<number, (typeof windows)[number]>();
		for (const w of windows) {
			const prev = bySpan.get(w.endTime);
			if (!prev) {
				bySpan.set(w.endTime, w);
				continue;
			}
			if (prev.label === undefined && w.label !== undefined) prev.label = w.label;
		}
		if (bySpan.size !== windows.length) windows.splice(0, windows.length, ...bySpan.values());
	}
	// ── Is this shield ALREADY DRAWN, as a summon? ────────────────────────
	// ⚓ 2026-08-14, and it is a reconciliation of two authoring conventions
	// for one fact, not a heuristic about art. Before shield windows existed,
	// the only way to get a shield onto the chart was to author it as a
	// `summons[]` entry with no effects — nine abilities still do (Layla's
	// "Curtain of Slumber", Zhongli's "Jade Shield", Noelle's "Stone Armor"…).
	// Those entries ARE the shield: same span, drawn in the summon lane. Now
	// that the shield lane draws shield windows, they would be drawn twice.
	//
	// The test is EXACT, and both halves matter: a summon with NO effects of
	// its own (a real summon does something — Itzpapa ticks, Birgitta ticks)
	// AND whose duration is this shield's duration. ⚠ That second half is
	// what saves Thoma's burst: "Scorching Ooyoroi" is a genuine 15s field
	// that carries no effects yet, and his burst shield is 8s — it is not the
	// same thing, so his field keeps its lane.
	//
	// ⛔ THE FIX IS NOT TO DELETE THOSE SUMMON ENTRIES, tempting as it looks.
	// For five of them (Kirara, Layla, Thoma E, Xinyan, Noelle) the shield is
	// the ability's ONLY summon, so `summons[0]` is also what gives the E BAR
	// its active duration — deleting it would collapse a 12s bar to an instant
	// pill. Retiring the convention properly means authoring `activeDuration`
	// alongside, which is a data round with a visual verdict attached.
	//
	// ⚠ ABILITY-HOSTED WINDOWS ONLY (2026-08-18). A passive- or
	// constellation-hosted shield has no stand-in summon twin — the convention
	// this reconciles was only ever an ABILITY authoring one — so matching one
	// against `summons[]` could only ever be a duration coincidence, which is
	// exactly what the Thoma half of the test exists to refuse.
	const shieldSummons = abilitySummons;
	for (const w of windows) {
		if (!w.fromAbility) continue;
		const dur = w.endTime - castTime;
		w.coveredBySummon = shieldSummons.some(
			(s) => (s.effects?.length ?? 0) === 0 && framesOf(s.duration) === dur
		);
	}
	const existing = ctx.getCharState(char.id).shields;
	for (const w of windows) {
		existing.push(w);
		// IR shield window (append-only; not drained like the dispatch queue).
		ctx.shieldWindowRecs.push({
			characterId: char.id,
			source: w.ability,
			start: castTime,
			end: w.endTime,
			sourceCastId,
			...(w.label !== undefined ? { label: w.label } : {}),
			...(w.coveredBySummon ? { coveredBySummon: true as const } : {})
		});
	}
	existing.sort((a, b) => a.endTime - b.endTime);
}

/** Drain all shield windows whose `endTime <= currentTime` in chronological
 *  order. For each expired window, push a `shieldEnd` IR event and dispatch
 *  `onShieldEnd`-trigger effects from every team character's passives /
 *  constellations. Source filter ('self' / 'team') and procCooldown gating
 *  are evaluated per (holder, effect) at dispatch time.
 *
 *  Called at the top of each E/Q handler (after `localCursor` is set to the
 *  cast time) and once at rotation end (with `Infinity` so any remaining
 *  windows drain). v1 emits `shieldEnd` events only — per-effect damage/buff
 *  rendering at shield-end time is a future renderer pass (mirrors the v0.8
 *  HitEvent pattern: emission shipped before per-event rendering). */
export function dispatchShieldEnds(ctx: SimContext, currentTime: number): void {
	type Expired = { holderId: string; ability: 'skill' | 'burst'; endTime: number };
	const expired: Expired[] = [];
	// Snapshot the entries: the listener loop below calls getCharState (which
	// may create new empty CharStates), and those never carry shields, so a
	// live iteration would only visit no-op empties anyway. `expired` is
	// sorted below on (endTime, holderId) — a total order — so dispatch order
	// is deterministic regardless of charStates insertion order.
	for (const [holderId, cs] of [...ctx.charStates]) {
		const windows = cs.shields;
		while (windows.length > 0 && windows[0].endTime <= currentTime) {
			const w = windows.shift()!;
			expired.push({ holderId, ability: w.ability, endTime: w.endTime });
		}
	}
	if (expired.length === 0) return;
	expired.sort((a, b) => a.endTime - b.endTime || a.holderId.localeCompare(b.holderId));
	for (const ev of expired) {
		ctx.events.push({
			kind: 'shieldEnd',
			id: ctx.nextId(),
			characterId: ev.holderId,
			ability: ev.ability,
			time: ev.endTime
		});
		// Walk every team char's onShieldEnd-trigger effects and apply
		// source/ability/procCooldown gating. v1 records the dispatch via
		// the event stream above; no renderer-visible side effect yet.
		for (const listener of ctx.team.teamChars) {
			const listenerCons = ctx.constellationLevels?.[listener.id] ?? 0;
			const sources = effectSourcesAtConstellation(listener, listenerCons);
			for (let nodeIdx = 0; nodeIdx < sources.length; nodeIdx++) {
				const node = sources[nodeIdx];
				const effects = node.effects ?? [];
				for (let effIdx = 0; effIdx < effects.length; effIdx++) {
					const fx = effects[effIdx];
					if (fx.trigger.type !== 'onShieldEnd') continue;
					const srcMode = fx.trigger.source ?? 'self';
					if (srcMode === 'self' && listener.id !== ev.holderId) continue;
					if (fx.trigger.ability !== undefined && fx.trigger.ability !== ev.ability) continue;
					const condResult = evalCondition(
						fx.conditions,
						DEFAULT_ASCENSION,
						new Set<string>(),
						listenerCons,
						new Map(),
						undefined
					);
					if (condResult !== true) continue;
					const pc = fx.procCooldown;
					const pcNum = typeof pc === 'number' ? framesOf(pc) : undefined;
					if (pcNum !== undefined && pcNum > 0) {
						const charMap = ctx.getCharState(listener.id).shieldEndProcCooldown;
						const fxKey = `${node.id}#${effIdx}`;
						const last = charMap.get(fxKey) ?? -Infinity;
						if (ev.endTime - last < pcNum) continue;
						charMap.set(fxKey, ev.endTime);
					}
				}
			}
		}
	}
}
