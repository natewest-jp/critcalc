/**
 * src/lib/utils/buffWindows.ts
 *
 * Parser-side buff-window derivation (post-P4 #5): computes who-buffs-whom-
 * when — the MEANING previously derived renderer-side by `teamBuffRows.ts` +
 * `charReceivedBuffRows.ts` — and emits `buff` TimelineWindows. The thin row
 * projections in those modules rebuild the legacy row shapes (grouping,
 * labels, display strings) from these windows without re-deriving anything.
 *
 * PORT FIDELITY: the iteration structure below mirrors the (now-deleted)
 * legacy modules bar-for-bar — same per-track cast partitioning, same
 * effect-pool collection and dedup rules, same evalCondition call shapes,
 * same float arithmetic. Byte-identity was PROVEN before the flip by a
 * temporary corpus parity test (123-char roster + C6 sweep + multi-char/
 * loadout scenarios, retired in phase 6 with the legacy implementations).
 * Emission order IS the legacy row-insertion order: windows carry an
 * emission-order `id` and the projections group in id order. Two
 * sub-passes: the team surface (teamBuffRows order), then the received
 * surface (charReceivedBuffRows order — weapon swaps, active-target
 * slices, self/NB).
 *
 * Phase-6 delta (the arc's deliberate improvement over the legacy output):
 * onHit N/CA/P windows are anchored on the parser's PER-SWING hit records
 * (swing-end times, per-hit element/hitIndex context, hit-time stack
 * snapshots — Yanfei A1 reads her pre-consume seal count) instead of the
 * legacy block-end collapse; on the team surface, successive overlapping
 * same-shape hits REFRESH the open window in place (Flins C2's Electro RES
 * shred extends across an NA string) rather than stacking bars.
 *
 * Pure and runtime-import-free (weapon/artifact lookups are pure data
 * modules). Imported by notationParser's finalize — the module cycle is
 * benign (only hoisted function exports cross it at call time).
 */

import {
	evalCondition,
	onHitTriggerMatches,
	type ConditionContext,
	type CharacterTrack,
	type HitEvent
} from '$lib/utils/notationParser';
import type { CastEvent, ReactionEvent, TimelineWindow } from '$lib/utils/rotationEvents';
import { evalTriggerFilter, type TriggerFilterContext } from '$lib/types/ability';
import type { Effect, Element, Reaction } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import type { LoadoutEntry } from '$lib/stores';
import { getArtifactSetById } from '$lib/data/artifactLookup';
import { getWeaponById } from '$lib/data/weaponLookup';
import { framesOf } from '$lib/utils/frames';
import {
	getCharacterEffectsForAfterDuration,
	getCharacterEffectsForCast,
	getCharacterEffectsForOnHit,
	getCharacterEffectsForOnReaction,
	getCharacterEffectsForOnState,
	getCharacterEffectsForTeamNightsoulBurst,
	factionProvenanceOf,
	type FactionProvenance,
	isActiveTargetOnly,
	resolveCastContext,
	castLandsNoHit,
	targetsEnemy,
	targetsTeamOrActive
} from '$lib/utils/effectCollection';

export type BuffWindow = Extract<TimelineWindow, { kind: 'buff' }>;
type BuffEffect = Extract<Effect, { type: 'buff' }>;
type ResShredEffect = Extract<Effect, { type: 'resShred' }>;

export type BuffWindowInput = {
	tracks: CharacterTrack[];
	/** Parser-private per-swing hit records — drive the N/CA/P onHit sites. */
	hits: readonly HitEvent[];
	castEvents: readonly CastEvent[];
	reactionEvents: readonly ReactionEvent[];
	nbBars: readonly { start: number; cooldown: number }[];
	/** The parser's authored state/summon windows (afterDuration span join). */
	windows: readonly TimelineWindow[];
	constellationLevels: Record<string, number>;
	loadoutMap: Record<string, LoadoutEntry>;
	teamFactionCounts: ReadonlyMap<string, number>;
	/** Reactions the party enables (Stellar model) — resolves
	 *  `teamEnablesReaction` conditions in every buff-window context. */
	teamEnabledReactions: ReadonlySet<string>;
	teamElementCountsByHolder: ReadonlyMap<string, ReadonlyMap<Element, number>>;
	getCharacter: (id: string) => CharacterData | null;
};

export function deriveBuffWindows(input: BuffWindowInput): BuffWindow[] {
	const {
		tracks,
		hits,
		castEvents,
		reactionEvents,
		nbBars,
		windows,
		constellationLevels,
		loadoutMap,
		teamFactionCounts,
		teamEnabledReactions,
		teamElementCountsByHolder,
		getCharacter
	} = input;

	const out: BuffWindow[] = [];
	let nextId = 0;
	const push = (w: Omit<BuffWindow, 'kind' | 'id'>): BuffWindow => {
		const win: BuffWindow = { kind: 'buff', id: nextId++, ...w };
		out.push(win);
		return win;
	};

	// ⚓ A FACTION BONUS IS A DIFFERENT SOURCE, SO IT GETS ITS OWN WINDOW
	// (2026-08-15). `factionBonuses` effects now ride the same candidate pools as
	// the character's own, and a pool becomes exactly ONE window: one span, one
	// row, one label. Merging the two would put a Hexerei-gated buff inside the
	// bar labelled "Sucrose E", where nothing says it exists only in a Hexerei
	// team — and, worse, hand it the wrong span.
	//
	// ⛔ THE SPLIT CANNOT LIVE IN `emit`, which is where it was first written
	// because that is the single choke point every site passes through. A pool's
	// span is computed BEFORE emit sees it, from `effects[0].duration` — so a
	// 15s Secret Rite sorting ahead of an 8s passive stretched BOTH to 15s
	// (observed: Sucrose's A4 EM share rendered 0.8–15.8 instead of 0.8–8.8).
	// Recomputing per group inside `emit` does not rescue it either: the
	// active-target sites emit SLICES (`end: isLast ? buffEnd : segEnd`), where
	// `end − start` is a segment of an on-field window and not a duration at all.
	// So the split belongs at POOL CONSTRUCTION, below, and `emit` only reads
	// back the provenance the pool already guarantees is uniform.
	const provenanceOfPool = (effects: readonly Effect[]): FactionProvenance | undefined =>
		effects.length > 0 ? factionProvenanceOf(effects[0]) : undefined;

	/** Splits a candidate pool by faction provenance, preserving first-seen order
	 *  so window ids — and the row order derived from them — stay deterministic.
	 *  Every pool-building site funnels through this, so a site that forgets it
	 *  produces a MIXED pool, which `emit` then labels by its first effect —
	 *  visibly wrong rather than silently wrong. `buffWindows.faction.test.ts`
	 *  holds the no-mixed-pool invariant corpus-wide. */
	const byProvenance = <T extends Effect>(
		effects: readonly T[]
	): Array<{ prov?: FactionProvenance; effects: T[] }> => {
		const groups: Array<{ prov?: FactionProvenance; effects: T[] }> = [];
		const byKey = new Map<string, { prov?: FactionProvenance; effects: T[] }>();
		for (const fx of effects) {
			const prov = factionProvenanceOf(fx);
			const key = prov ? `${prov.faction}::${prov.bonusName}` : '';
			let g = byKey.get(key);
			if (!g) {
				g = { prov, effects: [] };
				byKey.set(key, g);
				groups.push(g);
			}
			g.effects.push(fx);
		}
		return groups;
	};

	const emit = (w: Omit<BuffWindow, 'kind' | 'id'>): BuffWindow => {
		// ⚠ Only the CHARACTER sites can carry provenance. Artifact and weapon
		// windows are built from the loadout, not from the character's effect
		// surface, and their `trigger` vocabularies differ (`'hit'` is an
		// artifact-dispatch concept), so there is nothing to translate.
		if (w.source.type !== 'character') return push(w);
		const prov = provenanceOfPool(w.effects);
		if (!prov) return push(w);
		return push({
			...w,
			source: {
				type: 'faction',
				faction: prov.faction,
				bonusName: prov.bonusName,
				trigger: w.source.trigger,
				abilityClass: w.source.abilityClass
			}
		});
	};

	// ⚓ ONE WINDOW PER APPLICATION, NOT PER EFFECT (2026-08-14). Every other
	// dispatch site in this pass emits a POOL — `effects: barEffects`,
	// `effects: [...resShredEndPool]` — because one cast that grants three stats
	// is one buff, and the row shows one bar whose tooltip lists all three. The
	// two onReaction sites were the exception: they emitted `effects: [effect]`,
	// so a kit that shreds two elements off one reaction (Chevreuse: Pyro AND
	// Electro RES off one Overloaded) or buffs two elements off one (Sandrone:
	// Cryo AND Electro DMG off one Stellar-Conduct) drew a bar PER ELEMENT —
	// identical span, identical trigger, identical number, stacked on the chart
	// and each tooltip telling half the story. This groups them back.
	//
	// ⚠ THE MERGE KEY IS THE EVENT, NOT THE INSTANT. Two effects merge only when
	// the SAME reaction event fired them at the same span and the same kind. Two
	// different reactions landing on the same frame stay two windows: they are
	// different triggers that happen to coincide, and Viridescent Venerer (one
	// entry per swirlable element) depends on that — a Pyro swirl and a Cryo
	// swirl are two debuffs, not one two-element debuff.
	//
	// ⚠ BUFF AND DEBUFF NEVER MERGE even off one event and one span (Sandrone
	// grants both). ⛔ NOT because of paint — the coloured debuff bar was
	// deleted 2026-08-11 and the two look identical. Because they are different
	// TARGETS carrying different display formatters: a window is read wholesale
	// as buff-or-shred (`formatBuffDisplayValue` vs `formatResShredDisplayValue`)
	// and its row carries one `kind`, so a mixed pool has no single answer.
	const reactionEventIndex = new Map<ReactionEvent, number>(
		reactionEvents.map((ev, i) => [ev, i] as const)
	);
	type ReactionPool = { start: number; end: number; debuff: boolean; effects: Effect[] };
	/** Collects (effect × reaction-event) pairs into per-application pools,
	 *  preserving first-seen order so window ids stay deterministic. */
	const makeReactionPooler = () => {
		const byKey = new Map<string, ReactionPool>();
		const order: ReactionPool[] = [];
		return {
			add(ev: ReactionEvent, effect: BuffEffect | ResShredEffect): void {
				const debuff = effect.type === 'resShred';
				const start = ev.time;
				const end = start + framesOf(effect.duration!);
				// ⚠ SOURCE JOINS THE MERGE KEY (2026-08-15). A faction bonus firing
				// off the same reaction event, for the same span, is still a
				// different claim under a different name — Durin's base A1 shred and
				// its Secret Rite counterpart share both, and pooled they would draw
				// one bar labelled after whichever sorted first.
				const prov = factionProvenanceOf(effect);
				const src = prov ? `${prov.faction}::${prov.bonusName}` : '';
				const key = `${reactionEventIndex.get(ev)}::${end}::${debuff}::${src}`;
				let pool = byKey.get(key);
				if (!pool) {
					pool = { start, end, debuff, effects: [] };
					byKey.set(key, pool);
					order.push(pool);
				}
				pool.effects.push(effect);
			},
			pools: order
		};
	};

	/** The pooled (effect × matching reaction event) applications for one
	 *  character, shared by the received-surface onReaction sites.
	 *
	 *  ⚓ The three onReaction surfaces disagree about TARGETS, not about
	 *  triggers — which is why `qualifies` is the only thing they pass in. The
	 *  team surface (below) predates this and stays inline; it is the same
	 *  shape with `targetsTeamOrActive` as its predicate.
	 *
	 *  ⚠ `ownEvents` is a FILTER of `reactionEvents`, so both pools hand back
	 *  the same event objects — which is what lets the pooler key on event
	 *  identity across a self-triggered and a team-triggered effect that happen
	 *  to share one event. */
	const reactionPoolsFor = (
		char: CharacterData,
		holderId: string,
		cLevel: number,
		ctx: ConditionContext,
		qualifies: (e: Effect) => boolean
	): ReactionPool[] => {
		const qualified = getCharacterEffectsForOnReaction(char, cLevel).filter(
			(e): e is BuffEffect | ResShredEffect => {
				if (e.duration == null) return false;
				if (evalCondition(e.conditions, 4, new Set(), cLevel, undefined, undefined, ctx) === false)
					return false;
				return qualifies(e);
			}
		);
		if (qualified.length === 0) return [];
		const ownEvents = reactionEvents.filter((ev) => ev.characterId === holderId);
		const pooler = makeReactionPooler();
		for (const effect of qualified) {
			const trig = effect.trigger as {
				reaction: Reaction | Reaction[] | 'any';
				source?: 'self' | 'team';
			};
			const trigReaction = trig.reaction;
			const matches = (r: Reaction): boolean =>
				trigReaction === 'any' ||
				(Array.isArray(trigReaction) ? trigReaction.includes(r) : trigReaction === r);
			for (const ev of trig.source === 'team' ? reactionEvents : ownEvents) {
				if (matches(ev.reaction)) pooler.add(ev, effect);
			}
		}
		return pooler.pools;
	};

	// ── per-swing hit helpers (phase-6 delta) ──
	// A track's hits of one input class, scoped by the track's active span
	// (the same partitioning rule casts use).
	const hitsForTrack = (ti: number, cls: 'normal' | 'charged' | 'plunge'): HitEvent[] => {
		const track = tracks[ti];
		const nextStart = tracks[ti + 1]?.activeStart ?? Infinity;
		return hits.filter(
			(h) =>
				h.characterId === track.characterId &&
				h.abilityType === cls &&
				h.time >= track.activeStart &&
				h.time < nextStart
		);
	};
	const hitFilterCtx = (h: HitEvent): TriggerFilterContext => ({
		damageTag: h.damageTag,
		element: h.element ?? 'physical',
		abilityName: h.abilityName,
		hitIndex: h.hitIndex,
		isCrit: true
	});
	// Refresh-merge equality: only extend an open window when the successive
	// hit fires the SAME effect set under the SAME stack snapshot.
	const sameEffects = (a: readonly Effect[], b: readonly Effect[]): boolean =>
		a.length === b.length && a.every((e, i) => e === b[i]);
	const sameStacks = (
		a: ReadonlyMap<string, number> | undefined,
		b: ReadonlyMap<string, number> | undefined
	): boolean => {
		if (a === b) return true;
		if (!a || !b || a.size !== b.size) return false;
		for (const [k, v] of a) if (b.get(k) !== v) return false;
		return true;
	};

	// Shared with both passes: a track's E/Q casts partitioned from the
	// rotation-wide cast stream by the track's active span (the legacy
	// per-track eBars/qBars membership).
	const castsForTrack = (ti: number): { e: CastEvent[]; q: CastEvent[] } => {
		const track = tracks[ti];
		const nextStart = tracks[ti + 1]?.activeStart ?? Infinity;
		const trackCasts = castEvents.filter(
			(ev) =>
				ev.characterId === track.characterId && ev.time >= track.activeStart && ev.time < nextStart
		);
		return {
			e: trackCasts.filter((ev) => ev.ability === 'skill'),
			q: trackCasts.filter((ev) => ev.ability === 'burst')
		};
	};

	// ════════════════════════════════════════════════════════════════════
	// PASS A — team surface (port of computeTeamBuffRows)
	// ════════════════════════════════════════════════════════════════════

	// afterDuration span join: active-window (inStance state / summon) per
	// opening cast id; first window per cast wins.
	const activeWindowByCastId = new Map<number, TimelineWindow>();
	for (const w of windows) {
		if (w.kind !== 'summon' && !(w.kind === 'state' && w.name === 'inStance')) continue;
		if (w.sourceCastId === undefined) continue;
		if (!activeWindowByCastId.has(w.sourceCastId)) activeWindowByCastId.set(w.sourceCastId, w);
	}
	const afterDurationStart = (cast: CastEvent): number => {
		const win = activeWindowByCastId.get(cast.id);
		return win ? cast.time + (win.end - win.start) : cast.time;
	};

	const dispatchedCharScoped = new Set<string>();

	for (let ti = 0; ti < tracks.length; ti++) {
		const track = tracks[ti];
		const char = getCharacter(track.characterId);
		if (!char) continue;
		const firstTrackOfChar = !dispatchedCharScoped.has(track.characterId);
		dispatchedCharScoped.add(track.characterId);

		const { e: trackECasts, q: trackQCasts } = castsForTrack(ti);

		const baseCtx: ConditionContext = {
			teamFactionCounts,
			teamEnabledReactions,
			teamElementCounts: teamElementCountsByHolder.get(char.id)
		};
		const cLevel = constellationLevels[track.characterId] ?? 0;

		const resShredBase = (effect: Effect): effect is ResShredEffect => {
			if (effect.type !== 'resShred') return false;
			if (!targetsEnemy(effect.target)) return false;
			if (effect.duration == null) return false;
			if (
				evalCondition(effect.conditions, 4, new Set(), cLevel, undefined, undefined, baseCtx) ===
				false
			)
				return false;
			return true;
		};
		const dedupResShredByElement = (pool: ResShredEffect[]): ResShredEffect[] => {
			const seen = new Set<string>();
			return pool.filter((e) => {
				const k = `${e.shredStat ?? 'res'}:${e.element ?? '_all'}`;
				if (seen.has(k)) return false;
				seen.add(k);
				return true;
			});
		};

		// ── Character cast effects (onCast + onHit merged pool) per E/Q ──
		const castPairs: Array<['skill' | 'burst', CastEvent[]]> = [
			['skill', trackECasts],
			['burst', trackQCasts]
		];

		for (const [castType, abCasts] of castPairs) {
			// ⚠ THE POOL DEPENDS ON THE TOKEN, not just the cast class (2026-08-14).
			// A variant's `effects` REPLACE the base ability's, so `E` and `hE`
			// can qualify different effects — Diona's hold shield is 12s where her
			// tap's is 4.8s. These used to be hoisted once per (char, castType);
			// they are now resolved per token and memoised, because a track
			// usually casts one or two distinct tokens and the pools are small.
			// ⚠ Order is preserved: the per-cast loops still walk `abCasts` in
			// chronological order, so window ids — and the row order derived from
			// them — are unchanged for every character with no variant effects.
			const universalPool = (effect: Effect): effect is BuffEffect => {
				if (effect.type !== 'buff') return false;
				if (!targetsTeamOrActive(effect.target)) return false;
				if (isActiveTargetOnly(effect.target)) return false;
				if (effect.duration == null) return false;
				if (
					evalCondition(effect.conditions, 4, new Set(), cLevel, undefined, undefined, baseCtx) ===
					false
				)
					return false;
				return true;
			};
			// ⚠ Each pool is a LIST OF GROUPS, one per source (the character's own
			// effects, then one per faction bonus) — see `byProvenance`. The
			// one-bar-per-stat dedup runs WITHIN a group, not across the merged
			// list: a Secret Rite that re-grants a stat the base kit also grants
			// is a second, separately-gated claim, and collapsing the two would
			// silently drop whichever sorted later.
			type CastPools = {
				qualified: Array<{ prov?: FactionProvenance; effects: BuffEffect[] }>;
				resShred: Array<{ prov?: FactionProvenance; effects: ResShredEffect[] }>;
				afterDuration: Array<{ prov?: FactionProvenance; effects: Effect[] }>;
			};
			const dedupByStat = (effects: BuffEffect[]): BuffEffect[] => {
				const seen = new Set<string>();
				return effects.filter((effect) => {
					if (seen.has(effect.stat)) return false;
					seen.add(effect.stat);
					return true;
				});
			};
			const poolCache = new Map<string, CastPools>();
			const poolsFor = (label: string): CastPools => {
				const hit = poolCache.get(label);
				if (hit) return hit;
				const merged = [
					...getCharacterEffectsForCast(char, cLevel, castType, label),
					...getCharacterEffectsForOnHit(char, cLevel, castType, label)
				];
				const built: CastPools = {
					qualified: byProvenance(merged.filter(universalPool)).map((g) => ({
						prov: g.prov,
						effects: dedupByStat(g.effects)
					})),
					resShred: byProvenance(merged.filter(resShredBase)).map((g) => ({
						prov: g.prov,
						effects: dedupResShredByElement(g.effects)
					})),
					afterDuration: byProvenance(
						getCharacterEffectsForAfterDuration(char, cLevel, castType, label)
					)
				};
				poolCache.set(label, built);
				return built;
			};

			{
				for (const cast of abCasts) {
					const filterCtx = resolveCastContext(char, castType, cast);
					// A non-hitting cast anchors no `onHit` effect (non-hitting casts round,
					// 2026-09-16); its `onCast` effects in the same pool are untouched.
					const castNoHit = castLandsNoHit(char, castType, cast);
					for (const group of poolsFor(cast.label).qualified) {
						const qualifiedEffects = group.effects;
						if (qualifiedEffects.length === 0) continue;
						const barEffects = qualifiedEffects.filter((effect) => {
							if (
								evalCondition(
									effect.conditions,
									4,
									new Set(),
									cLevel,
									undefined,
									cast.stackContext,
									baseCtx
								) === false
							) {
								return false;
							}
							if (effect.trigger.type === 'onHit' && castNoHit) return false;
							if (effect.trigger.type === 'onHit' && filterCtx) {
								if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
							}
							return true;
						});
						if (barEffects.length === 0) continue;
						const buffStart = cast.fieldStart;
						const buffEnd = buffStart + framesOf(barEffects[0].duration!);
						emit({
							characterId: track.characterId,
							start: buffStart,
							end: buffEnd,
							effects: barEffects,
							stackContext: cast.stackContext,
							sourceCastId: cast.id,
							source: { type: 'character', trigger: 'cast', abilityClass: castType }
						});
					}
				}
			}

			// ── afterDuration buffs ──
			const qualifiedAfterFor = (effects: Effect[]): BuffEffect[] => {
				const seenStatsAfter = new Set<string>();
				return effects.filter((effect): effect is BuffEffect => {
					if (effect.type !== 'buff') return false;
					if (!targetsTeamOrActive(effect.target)) return false;
					if (isActiveTargetOnly(effect.target)) return false;
					if (effect.duration == null) return false;
					if (
						evalCondition(
							effect.conditions,
							4,
							new Set(),
							cLevel,
							undefined,
							undefined,
							baseCtx
						) === false
					)
						return false;
					if (seenStatsAfter.has(effect.stat)) return false;
					seenStatsAfter.add(effect.stat);
					return true;
				});
			};
			{
				for (const cast of abCasts) {
					for (const group of poolsFor(cast.label).afterDuration) {
						const qualifiedEffectsAfter = qualifiedAfterFor(group.effects);
						if (qualifiedEffectsAfter.length === 0) continue;
						const barEffects = qualifiedEffectsAfter.filter(
							(effect) =>
								evalCondition(
									effect.conditions,
									4,
									new Set(),
									cLevel,
									undefined,
									cast.stackContext,
									baseCtx
								) !== false
						);
						if (barEffects.length === 0) continue;
						const buffStart = afterDurationStart(cast);
						const buffEnd = buffStart + framesOf(barEffects[0].duration!);
						emit({
							characterId: track.characterId,
							start: buffStart,
							end: buffEnd,
							effects: barEffects,
							stackContext: cast.stackContext,
							poolFirstEffect: qualifiedEffectsAfter[0],
							sourceCastId: cast.id,
							source: { type: 'character', trigger: 'afterDuration', abilityClass: castType }
						});
					}
				}
			}

			// ── resShred (debuff): onCast+onHit at cast start ──
			{
				for (const cast of abCasts) {
					const filterCtx = resolveCastContext(char, castType, cast);
					// A non-hitting cast anchors no `onHit` effect (non-hitting casts round,
					// 2026-09-16); its `onCast` effects in the same pool are untouched.
					const castNoHit = castLandsNoHit(char, castType, cast);
					for (const group of poolsFor(cast.label).resShred) {
						const resShredStartPool = group.effects;
						if (resShredStartPool.length === 0) continue;
						const barEffects = resShredStartPool.filter((effect) => {
							if (
								evalCondition(
									effect.conditions,
									4,
									new Set(),
									cLevel,
									undefined,
									cast.stackContext,
									baseCtx
								) === false
							)
								return false;
							if (effect.trigger.type === 'onHit' && castNoHit) return false;
							if (effect.trigger.type === 'onHit' && filterCtx) {
								if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
							}
							return true;
						});
						if (barEffects.length === 0) continue;
						const buffStart = cast.fieldStart;
						const buffEnd = buffStart + framesOf(barEffects[0].duration!);
						emit({
							characterId: track.characterId,
							start: buffStart,
							end: buffEnd,
							debuff: true,
							effects: barEffects,
							poolFirstEffect: resShredStartPool[0],
							sourceCastId: cast.id,
							source: { type: 'character', trigger: 'cast', abilityClass: castType }
						});
					}
				}
			}

			// ── resShred (debuff): afterDuration at cast end — no per-bar filter ──
			{
				for (const cast of abCasts) {
					for (const group of poolsFor(cast.label).afterDuration) {
						const resShredEndPool = dedupResShredByElement(group.effects.filter(resShredBase));
						if (resShredEndPool.length === 0) continue;
						const buffStart = afterDurationStart(cast);
						const buffEnd = buffStart + framesOf(resShredEndPool[0].duration!);
						emit({
							characterId: track.characterId,
							start: buffStart,
							end: buffEnd,
							debuff: true,
							effects: [...resShredEndPool],
							sourceCastId: cast.id,
							source: { type: 'character', trigger: 'afterDuration', abilityClass: castType }
						});
					}
				}
			}
		}

		// ── N/CA/P onHit pools (PER-SWING hit anchored — phase-6 delta) ──
		// Each parser hit record carries swing-end time, per-hit element,
		// comboIndex (filter.hitIndex), and the hit-time stack snapshot.
		// Successive overlapping same-shape hits REFRESH the open window in
		// place (Flins C2's 7s Electro shred rides an NA string as one span).
		const blockClassPairs: Array<'normal' | 'charged' | 'plunge'> = ['normal', 'charged', 'plunge'];
		for (const blockClass of blockClassPairs) {
			const onHitBlockEffects = getCharacterEffectsForOnHit(char, cLevel, blockClass);
			if (onHitBlockEffects.length === 0) continue;
			// No faction bonus authors an N/CA/P onHit trigger today. Partitioned
			// anyway: the refresh-in-place `lastWin` below belongs to ONE source,
			// and a mixed pool would have a Secret Rite silently extending the
			// span of the base kit's bar.
			for (const blockGroup of byProvenance(onHitBlockEffects)) {
				const seenStats = new Set<string>();
				const qualifiedEffects = blockGroup.effects
					.filter((effect): effect is BuffEffect => {
						if (effect.type !== 'buff') return false;
						if (!targetsTeamOrActive(effect.target)) return false;
						if (isActiveTargetOnly(effect.target)) return false;
						if (effect.duration == null) return false;
						if (
							evalCondition(
								effect.conditions,
								4,
								new Set(),
								cLevel,
								undefined,
								undefined,
								baseCtx
							) === false
						)
							return false;
						return true;
					})
					.filter((effect) => {
						if (seenStats.has(effect.stat)) return false;
						seenStats.add(effect.stat);
						return true;
					});
				if (qualifiedEffects.length > 0) {
					let lastWin: BuffWindow | undefined;
					for (const hit of hitsForTrack(ti, blockClass)) {
						const filterCtx = hitFilterCtx(hit);
						const barEffects = qualifiedEffects.filter((effect) => {
							if (
								evalCondition(
									effect.conditions,
									4,
									new Set(),
									cLevel,
									undefined,
									hit.stacks,
									baseCtx
								) === false
							) {
								return false;
							}
							if (effect.trigger.type === 'onHit') {
								if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
							}
							return true;
						});
						if (barEffects.length === 0) continue;
						const buffStart = hit.time;
						const buffEnd = buffStart + framesOf(barEffects[0].duration!);
						if (
							lastWin &&
							buffStart <= lastWin.end &&
							sameEffects(lastWin.effects, barEffects) &&
							sameStacks(lastWin.stackContext, hit.stacks)
						) {
							lastWin.end = buffEnd;
							continue;
						}
						lastWin = emit({
							characterId: track.characterId,
							start: buffStart,
							end: buffEnd,
							effects: barEffects,
							stackContext: hit.stacks,
							sourceActionId: hit.sourceEventId,
							source: { type: 'character', trigger: 'block', abilityClass: blockClass }
						});
					}
				}

				const resShredBlockPool = dedupResShredByElement(blockGroup.effects.filter(resShredBase));
				if (resShredBlockPool.length > 0) {
					let lastWin: BuffWindow | undefined;
					for (const hit of hitsForTrack(ti, blockClass)) {
						const filterCtx = hitFilterCtx(hit);
						const barEffects = resShredBlockPool.filter((effect) => {
							if (
								evalCondition(
									effect.conditions,
									4,
									new Set(),
									cLevel,
									undefined,
									hit.stacks,
									baseCtx
								) === false
							)
								return false;
							if (effect.trigger.type === 'onHit') {
								if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
							}
							return true;
						});
						if (barEffects.length === 0) continue;
						const buffStart = hit.time;
						const buffEnd = buffStart + framesOf(barEffects[0].duration!);
						if (
							lastWin &&
							buffStart <= lastWin.end &&
							sameEffects(lastWin.effects, barEffects) &&
							sameStacks(lastWin.stackContext, hit.stacks)
						) {
							lastWin.end = buffEnd;
							continue;
						}
						lastWin = emit({
							characterId: track.characterId,
							start: buffStart,
							end: buffEnd,
							debuff: true,
							effects: barEffects,
							stackContext: hit.stacks,
							poolFirstEffect: resShredBlockPool[0],
							sourceActionId: hit.sourceEventId,
							source: { type: 'character', trigger: 'block', abilityClass: blockClass }
						});
					}
				}
			}
		}

		// ── Summon-tick onHit pools (2026-08-31) ──
		//
		// ⚓⚓ A SUMMON'S TICKS FIRE ITS OWNER'S `onHit` EFFECTS. Xiangling's C1
		// Pyro shred is stated on Guoba's hits, Sigewinne's C2 names "Bolstering
		// Bubblebalm", Venti's C6 names "Wind's Grand Ode" — but until this pass
		// the only hit a `skill`/`burst` onHit effect ever saw was the CAST's own,
		// so every one of them opened at the cast and never refreshed. Measured
		// before the fix: `Xiangling E` at C1 drew 0.22 → 6.22s while Guoba ticked
		// at 2.10 / 3.77 / 5.43 / 7.10, where the truth is 0.22 → 13.10s.
		// Eleven characters were under-claiming by +2.3s to +21s.
		//
		// ⚠️ ROTATION-WIDE, not per-track — hence `firstTrackOfChar`, the same
		// guard and the same reason the artifact onHit branch carries one. A
		// summon ticks while its owner is OFF FIELD; scoping these to the holder's
		// active span would cut the window at every swap and report a fraction of
		// the real uptime.
		//
		// ⚓ IT EMITS ONE WINDOW PER TICK AND LETS THE PROJECTION FUSE THEM. The
		// `source` is deliberately the same `{ trigger: 'cast', abilityClass }` the
		// cast pool stamps, so these land in the SAME ROW (`teamBuffRows` keys
		// cast/block rows on character + ability label) and `mergeRefreshedBars`
		// collapses the cast window and the tick windows into one covered span.
		// ⛔ Not by extending the cast window in place: that window's pool can also
		// hold `onCast` effects, which a tick must not refresh.
		//
		// ⚠️ TEAM SURFACE ONLY, and that is measured rather than partial. The
		// 2026-08-31 census found every affected effect is either a `resShred`
		// (13 of them) or a team-target buff (Sucrose A4). The one self-target
		// holder, Nicole's A4, is authored `source: 'active'` precisely so a tick
		// does NOT fire it, and no active-target onHit buff in the corpus sits on a
		// character who leaves a ticking summon. ⛔ Don't add the other two
		// surfaces speculatively; re-run the census first.
		if (firstTrackOfChar) {
			const tickHits = hits
				.filter((h) => h.viaEntity === true && h.characterId === track.characterId)
				.slice()
				.sort((a, b) => a.time - b.time);
			if (tickHits.length > 0) {
				for (const castType of ['skill', 'burst'] as const) {
					const onHitTickEffects = getCharacterEffectsForOnHit(char, cLevel, castType);
					if (onHitTickEffects.length === 0) continue;
					const classHits = tickHits.filter((h) => h.abilityType === castType);
					if (classHits.length === 0) continue;
					for (const tickGroup of byProvenance(onHitTickEffects)) {
						// Only effects whose trigger is genuinely an onHit — the
						// collector also returns nothing else, but the pools below
						// are shared shapes and the narrowing keeps that honest.
						const emitPass = <T extends BuffEffect | ResShredEffect>(
							pool: T[],
							debuff: boolean
						): void => {
							if (pool.length === 0) return;
							let lastWin: BuffWindow | undefined;
							for (const hit of classHits) {
								if (
									!pool.some(
										(e) =>
											e.trigger.type === 'onHit' &&
											onHitTriggerMatches(e.trigger, hit, track.characterId)
									)
								)
									continue;
								const filterCtx = hitFilterCtx(hit);
								const barEffects = pool.filter((effect) => {
									if (effect.trigger.type !== 'onHit') return false;
									if (!onHitTriggerMatches(effect.trigger, hit, track.characterId)) return false;
									if (
										evalCondition(
											effect.conditions,
											4,
											new Set(),
											cLevel,
											undefined,
											hit.stacks,
											baseCtx
										) === false
									)
										return false;
									return evalTriggerFilter(effect.trigger.filter, filterCtx);
								});
								if (barEffects.length === 0) continue;
								const buffStart = hit.time;
								const buffEnd = buffStart + framesOf(barEffects[0].duration!);
								if (
									lastWin &&
									buffStart <= lastWin.end &&
									sameEffects(lastWin.effects, barEffects) &&
									sameStacks(lastWin.stackContext, hit.stacks)
								) {
									lastWin.end = buffEnd;
									continue;
								}
								lastWin = emit({
									characterId: track.characterId,
									start: buffStart,
									end: buffEnd,
									debuff: debuff || undefined,
									effects: barEffects,
									stackContext: hit.stacks,
									poolFirstEffect: debuff ? pool[0] : undefined,
									sourceCastId: hit.sourceEventId >= 0 ? hit.sourceEventId : undefined,
									source: { type: 'character', trigger: 'cast', abilityClass: castType }
								});
							}
						};
						const seenTickStats = new Set<string>();
						emitPass(
							tickGroup.effects
								.filter((effect): effect is BuffEffect => {
									if (effect.type !== 'buff') return false;
									if (!targetsTeamOrActive(effect.target)) return false;
									if (isActiveTargetOnly(effect.target)) return false;
									if (effect.duration == null) return false;
									return (
										evalCondition(
											effect.conditions,
											4,
											new Set(),
											cLevel,
											undefined,
											undefined,
											baseCtx
										) !== false
									);
								})
								.filter((effect) => {
									if (seenTickStats.has(effect.stat)) return false;
									seenTickStats.add(effect.stat);
									return true;
								}),
							false
						);
						emitPass(dedupResShredByElement(tickGroup.effects.filter(resShredBase)), true);
					}
				}
			}
		}

		// ── onState team-target buffs (once per character) ──
		//
		// ⚓ The span IS the state's window. Every other trigger here measures a
		// duration from an instant; this one is co-extensive with a window the
		// parser already computed, so there is no `duration` to read and an
		// effect that carries one would be describing something else.
		//
		// ⚠️ `shielded` resolves to SHIELD windows. It is a State in the union but
		// nothing ever put it in `resolvedStates`, so matching only `kind:'state'`
		// would keep Citlali's bar invisible exactly as it has been.
		if (firstTrackOfChar) {
			for (const [state, stateEffects] of getCharacterEffectsForOnState(char, cLevel)) {
				// ⚠️ A TYPE PREDICATE, because `TimelineWindow` grew an arm with no
				// `characterId` (the `gadget` kind — a thing that belongs to nobody).
				// The kind test has to come FIRST in each branch so it narrows before
				// the character test reads a field only some arms have.
				const spans = windows.filter(
					(w): w is Extract<TimelineWindow, { kind: 'state' } | { kind: 'shield' }> =>
						state === 'shielded'
							? w.kind === 'shield' && w.characterId === track.characterId
							: w.kind === 'state' && w.name === state && w.characterId === track.characterId
				);
				if (spans.length === 0) continue;
				for (const stateGroup of byProvenance(stateEffects)) {
					const seenStatsState = new Set<string>();
					const qualifiedState = stateGroup.effects.filter((effect): effect is BuffEffect => {
						if (effect.type !== 'buff') return false;
						if (!targetsTeamOrActive(effect.target)) return false;
						if (isActiveTargetOnly(effect.target)) return false;
						if (
							evalCondition(
								effect.conditions,
								4,
								new Set(),
								cLevel,
								undefined,
								undefined,
								baseCtx
							) === false
						)
							return false;
						if (seenStatsState.has(effect.stat)) return false;
						seenStatsState.add(effect.stat);
						return true;
					});
					if (qualifiedState.length === 0) continue;
					for (const span of spans) {
						emit({
							characterId: track.characterId,
							start: span.start,
							end: span.end,
							effects: qualifiedState,
							poolFirstEffect: qualifiedState[0],
							sourceCastId: span.sourceCastId,
							source: { type: 'character', trigger: 'state' }
						});
					}
				}
			}
		}

		// ── onTeamNightsoulBurst team-target buffs (once per character) ──
		const nbEffects = getCharacterEffectsForTeamNightsoulBurst(char, cLevel);
		if (firstTrackOfChar && nbBars.length > 0 && nbEffects.length > 0) {
			// No faction bonus authors an NB trigger today; partitioned for the
			// same reason as the rest — a pool is one window, one span, one label.
			for (const nbGroup of byProvenance(nbEffects)) {
				const seenStatsNB = new Set<string>();
				const qualifiedEffectsNB = nbGroup.effects.filter((effect): effect is BuffEffect => {
					if (effect.type !== 'buff') return false;
					if (!targetsTeamOrActive(effect.target)) return false;
					if (isActiveTargetOnly(effect.target)) return false;
					if (effect.duration == null) return false;
					if (
						evalCondition(
							effect.conditions,
							4,
							new Set(),
							cLevel,
							undefined,
							undefined,
							baseCtx
						) === false
					)
						return false;
					if (seenStatsNB.has(effect.stat)) return false;
					seenStatsNB.add(effect.stat);
					return true;
				});
				if (qualifiedEffectsNB.length > 0) {
					for (const nb of nbBars) {
						const buffStart = nb.start;
						const buffEnd = buffStart + framesOf(qualifiedEffectsNB[0].duration!);
						emit({
							characterId: track.characterId,
							start: buffStart,
							end: buffEnd,
							effects: qualifiedEffectsNB,
							source: { type: 'character', trigger: 'nightsoulBurst' }
						});
					}
				}
			}
		}

		// ── Artifact 4pc: onCast groups + onReaction ──
		const artifactSetId = loadoutMap[track.characterId]?.artifactSetId;
		const artifactSet = artifactSetId ? getArtifactSetById(artifactSetId) : null;
		if (artifactSet && artifactSetId) {
			const allEffects = artifactSet.fourPiece?.effects ?? [];

			const byTrigger = new Map<string, BuffEffect[]>();
			for (const effect of allEffects) {
				if (effect.type !== 'buff') continue;
				if (effect.trigger.type !== 'onCast') continue;
				if (!targetsTeamOrActive(effect.target)) continue;
				if (effect.duration == null) continue;
				const tk = (effect.trigger as { ability?: string }).ability ?? 'any';
				const group = byTrigger.get(tk) ?? [];
				group.push(effect as BuffEffect);
				byTrigger.set(tk, group);
			}

			for (const [triggerKey, effects] of byTrigger) {
				const castSets: ['skill' | 'burst', CastEvent[]][] = [];
				if (triggerKey === 'any' || triggerKey === 'skill') castSets.push(['skill', trackECasts]);
				if (triggerKey === 'any' || triggerKey === 'burst') castSets.push(['burst', trackQCasts]);

				for (const [abilityClass, casts] of castSets) {
					for (const cast of casts) {
						const buffStart = cast.fieldStart;
						const buffEnd = buffStart + framesOf(effects[0].duration!);
						emit({
							characterId: track.characterId,
							start: buffStart,
							end: buffEnd,
							effects,
							stackContext: cast.stackContext,
							sourceCastId: cast.id,
							source: {
								type: 'artifact',
								setId: artifactSetId,
								trigger: 'cast',
								triggerKey: triggerKey as 'any' | 'skill' | 'burst',
								abilityClass
							}
						});
					}
				}
			}

			// Artifact onReaction (buff + resShred), once per character.
			const artifactOnReactionEffects = allEffects.filter(
				(e): e is BuffEffect | ResShredEffect =>
					(e.type === 'buff' && targetsTeamOrActive(e.target)) ||
					(e.type === 'resShred' && targetsEnemy(e.target))
			);
			const artifactOnReactionFiltered = artifactOnReactionEffects.filter(
				(e) => e.trigger.type === 'onReaction' && e.duration != null
			);
			if (firstTrackOfChar && artifactOnReactionFiltered.length > 0) {
				const charReactionEvents = reactionEvents.filter(
					(ev) => ev.characterId === track.characterId
				);
				const pooler = makeReactionPooler();
				for (const effect of artifactOnReactionFiltered) {
					const trigReaction = (effect.trigger as { reaction: Reaction | Reaction[] | 'any' })
						.reaction;
					const matches = (r: Reaction): boolean =>
						trigReaction === 'any' ||
						(Array.isArray(trigReaction) ? trigReaction.includes(r) : trigReaction === r);
					for (const ev of charReactionEvents) {
						if (!matches(ev.reaction)) continue;
						pooler.add(ev, effect);
					}
				}
				for (const pool of pooler.pools) {
					emit({
						characterId: track.characterId,
						start: pool.start,
						end: pool.end,
						debuff: pool.debuff || undefined,
						effects: pool.effects,
						source: { type: 'artifact', setId: artifactSetId, trigger: 'reaction' }
					});
				}
			}

			// ── Artifact onHit (buff + resShred), once per character ──
			//
			// ⚓ Deepwood Memories, Tenacity of the Millelith and Silken Moon's
			// Serenade were all authored and none of them rendered, because this
			// section only ever had `onCast` and `onReaction` branches. Their
			// triggers are hits, and until 2026-08-15 the hit stream stopped at the
			// active character — see the step-6c note in notationParser.ts.
			//
			// ⚠ ROTATION-WIDE, not per-track (hence `firstTrackOfChar`, the same
			// gate onReaction uses). A summon keeps ticking while its owner is
			// OFF-FIELD, so scoping these to the holder's active span — the way the
			// N/CA/P passes scope theirs — would cut the window at every swap and
			// report a fraction of the real uptime.
			const artifactOnHitEffects = allEffects.filter(
				(e): e is BuffEffect | ResShredEffect =>
					e.trigger.type === 'onHit' &&
					e.duration != null &&
					((e.type === 'buff' && targetsTeamOrActive(e.target)) ||
						(e.type === 'resShred' && targetsEnemy(e.target)))
			);
			if (firstTrackOfChar && artifactOnHitEffects.length > 0) {
				// ⚓ A SET PRODUCES EFFECTS; SEVERAL TRIGGER ENTRIES ARE SEVERAL
				// DOORWAYS TO THE SAME ONE. Deepwood authors its shred twice — once
				// keyed to skill hits, once to burst hits — but a Dendro RES −30% from
				// an E and one from a Q are the same debuff on the same enemy. Every
				// qualifying effect is therefore canonicalised to a SHAPE
				// REPRESENTATIVE, so a skill hit and a burst hit hand the merge below
				// the SAME object and it treats them as one continuous window rather
				// than two identical rows stacked. Shape key mirrors
				// `dedupResShredByElement`'s convention.
				//
				// ⚠ Conditions are evaluated ONCE here rather than per hit: what gates
				// an artifact effect is team composition and constellation, both static
				// across a rotation. Silken Moon's Nascent/Ascendant split is exactly
				// this — `teamFaction: moonsign` resolves off `baseCtx`, so the tier is
				// picked once and the right rung is the only one that ever fires.
				const shapeOf = (effect: BuffEffect | ResShredEffect): string =>
					effect.type === 'resShred'
						? `res::${effect.shredStat ?? 'res'}::${effect.element ?? '_all'}::${effect.value}::${effect.duration}`
						: `buff::${effect.stat}::${effect.value}::${effect.duration}`;
				const repByShape = new Map<string, BuffEffect | ResShredEffect>();
				const qualified: {
					effect: BuffEffect | ResShredEffect;
					rep: BuffEffect | ResShredEffect;
					shape: string;
				}[] = [];
				for (const effect of artifactOnHitEffects) {
					if (
						evalCondition(
							effect.conditions,
							4,
							new Set(),
							cLevel,
							undefined,
							undefined,
							baseCtx
						) === false
					) {
						continue;
					}
					const shape = shapeOf(effect);
					const rep = repByShape.get(shape) ?? effect;
					repByShape.set(shape, rep);
					qualified.push({ effect, rep, shape });
				}

				// Every hit this character landed, in time order. Includes the
				// summon-tick hits synthesized at finalize, which is the whole point —
				// they arrive appended rather than merged, so the sort is required,
				// not cosmetic.
				const charHits = hits
					.filter((h) => h.characterId === track.characterId)
					.slice()
					.sort((a, b) => a.time - b.time);

				// ⚠ PARTITIONED BY (debuff, duration), NOT ONE PASS OVER EVERYTHING.
				// `debuff` is a per-WINDOW flag and pooled effects share one end, so a
				// set mixing a buff with a shred, or two different durations, must not
				// land in one bar. Within a partition the effects DO pool: Silken
				// Moon's four (EM + three lunar reaction bonuses) draw one bar, the way
				// the onCast branch already pools a multi-stat cast set.
				const partitions = new Map<string, typeof qualified>();
				for (const q of qualified) {
					const key = `${q.effect.type === 'resShred'}::${q.effect.duration}`;
					const list = partitions.get(key) ?? [];
					list.push(q);
					partitions.set(key, list);
				}

				for (const part of partitions.values()) {
					const debuff = part[0].effect.type === 'resShred';
					const duration = framesOf(part[0].effect.duration!);
					// `procCooldown` is the set's own ICD (Tenacity: 0.5s), clocked PER
					// SHAPE. Distinct from the refresh-merge below — the ICD decides
					// whether a hit triggers at all, the merge decides whether a trigger
					// draws a new bar or extends the open one.
					const procReady = new Map<string, number>();
					let lastWin: BuffWindow | undefined;
					for (const hit of charHits) {
						const fired: (BuffEffect | ResShredEffect)[] = [];
						const seen = new Set<string>();
						for (const q of part) {
							if (seen.has(q.shape)) continue;
							if (q.effect.trigger.type !== 'onHit') continue;
							if (!onHitTriggerMatches(q.effect.trigger, hit, track.characterId)) continue;
							if (hit.time < (procReady.get(q.shape) ?? -Infinity)) continue;
							const icd =
								typeof q.effect.procCooldown === 'number' ? framesOf(q.effect.procCooldown) : 0;
							procReady.set(q.shape, hit.time + icd);
							seen.add(q.shape);
							fired.push(q.rep);
						}
						if (fired.length === 0) continue;
						const end = hit.time + duration;
						if (lastWin && hit.time <= lastWin.end && sameEffects(lastWin.effects, fired)) {
							// An overlapping re-trigger of the SAME effect set extends
							// rather than stacks — this is what makes a ticking off-field
							// summon read as one connected bar instead of a picket fence
							// of 3s stubs. The equality guard matters once a set can fire
							// different subsets on different hits.
							lastWin.end = end;
							continue;
						}
						lastWin = emit({
							characterId: track.characterId,
							start: hit.time,
							end,
							debuff: debuff || undefined,
							effects: fired,
							sourceActionId: hit.sourceEventId >= 0 ? hit.sourceEventId : undefined,
							source: { type: 'artifact', setId: artifactSetId, trigger: 'hit' }
						});
					}
				}
			}
		}

		// ── Character onReaction effects (buff + resShred), once per character ──
		const onReactionEffects = getCharacterEffectsForOnReaction(char, cLevel);
		if (firstTrackOfChar && onReactionEffects.length > 0) {
			const ownReactionEvents = reactionEvents.filter((ev) => ev.characterId === track.characterId);
			const qualified = onReactionEffects.filter((e): e is BuffEffect | ResShredEffect => {
				if (e.type === 'buff') {
					if (!targetsTeamOrActive(e.target)) return false;
					if (isActiveTargetOnly(e.target)) return false;
				} else if (e.type === 'resShred') {
					if (!targetsEnemy(e.target)) return false;
				} else {
					return false;
				}
				if (e.duration == null) return false;
				if (
					evalCondition(e.conditions, 4, new Set(), cLevel, undefined, undefined, baseCtx) === false
				)
					return false;
				return true;
			});
			const pooler = makeReactionPooler();
			for (const effect of qualified) {
				const trig = effect.trigger as {
					reaction: Reaction | Reaction[] | 'any';
					source?: 'self' | 'team';
				};
				const trigReaction = trig.reaction;
				const matches = (r: Reaction): boolean =>
					trigReaction === 'any' ||
					(Array.isArray(trigReaction) ? trigReaction.includes(r) : trigReaction === r);
				// ⚠ `ownReactionEvents` is a FILTER of `reactionEvents`, so both pools
				// hand back the same event objects — which is what lets the pooler
				// key on event identity across a self-triggered and a team-triggered
				// effect that happen to share one event.
				const eventPool = trig.source === 'team' ? reactionEvents : ownReactionEvents;
				for (const ev of eventPool) {
					if (!matches(ev.reaction)) continue;
					pooler.add(ev, effect);
				}
			}
			for (const pool of pooler.pools) {
				emit({
					characterId: track.characterId,
					start: pool.start,
					end: pool.end,
					debuff: pool.debuff || undefined,
					effects: pool.effects,
					source: { type: 'character', trigger: 'reaction' }
				});
			}
		}
	}

	// ════════════════════════════════════════════════════════════════════
	// PASS B — received surface (port of computeCharReceivedBuffRows)
	// ════════════════════════════════════════════════════════════════════

	const procReadyAt = new Map<string, number>();
	/**
	 * ⚓ PER HOLDER, and it carries the element counts (T1 tranche, 2026-09-17).
	 * This was ONE shared context with no `teamElementCounts`, so a
	 * `teamElementCount` gate on an active-target, self-reaction or NB buff was
	 * UNRESOLVABLE on the received surface while the team surface (PASS A) and
	 * the self pass resolved it — and because these pools dedupe by `stat`
	 * right after this pre-filter, an unresolvable gate let the FIRST-authored
	 * tier win in every team (§1.H). Measured on Nahida's A1, three EM copies
	 * gated on the Shrine's Hydro count: the 0-Hydro copy drew in a 2-Hydro
	 * team. ⚓ The fix is to SUPPLY the context (the `applyModifiers` law),
	 * ⛔ never to reorder the dedupe here.
	 */
	const receivedCtxCache = new Map<string, ConditionContext>();
	const receivedCtxOf = (holderId: string): ConditionContext => {
		let ctx = receivedCtxCache.get(holderId);
		if (!ctx) {
			ctx = {
				teamFactionCounts,
				teamEnabledReactions,
				teamElementCounts: teamElementCountsByHolder.get(holderId)
			};
			receivedCtxCache.set(holderId, ctx);
		}
		return ctx;
	};

	const processWeaponEffects = (
		triggerType: 'onSwapOut' | 'onSwapIn',
		weapon: ReturnType<typeof getWeaponById>,
		refinementIndex: number,
		receiverId: string,
		holderId: string,
		swapTime: number
	): void => {
		if (!weapon) return;
		const byIcd = new Map<string, BuffEffect[]>();
		for (const effect of weapon.passive.effects) {
			if (effect.type !== 'buff') continue;
			if (effect.trigger.type !== triggerType) continue;
			if (effect.duration == null) continue;
			const icdKey = `${holderId}::${weapon.id}::${triggerType}`;
			const group = byIcd.get(icdKey) ?? [];
			group.push(effect as BuffEffect);
			byIcd.set(icdKey, group);
		}
		for (const [icdKey, effects] of byIcd) {
			const first = effects[0];
			const rawIcd = first.procCooldown;
			const icd = framesOf(
				rawIcd == null
					? 0
					: typeof rawIcd === 'number'
						? rawIcd
						: rawIcd.refinementValues[refinementIndex]
			);
			const procReady = procReadyAt.get(icdKey) ?? 0;
			if (swapTime < procReady) continue;
			procReadyAt.set(icdKey, swapTime + icd);

			emit({
				characterId: holderId,
				receiverId,
				start: swapTime,
				end: swapTime + framesOf(first.duration!),
				effects,
				refinementIndex,
				duration: framesOf(first.duration!),
				procCooldown: icd > 0 ? icd : undefined,
				isMutuallyExclusive: effects.length > 1,
				source: { type: 'weapon', weaponId: weapon.id, trigger: triggerType }
			});
		}
	};

	for (let i = 0; i < tracks.length - 1; i++) {
		const track = tracks[i];
		const nextTrack = tracks[i + 1];
		if (track.characterId === nextTrack.characterId) continue;
		const swapTime = nextTrack.activeStart;

		const outEntry = loadoutMap[track.characterId];
		const outWeapon = outEntry?.weaponId ? getWeaponById(outEntry.weaponId) : null;
		processWeaponEffects(
			'onSwapOut',
			outWeapon,
			(outEntry?.weaponRefinement ?? 1) - 1,
			nextTrack.characterId,
			track.characterId,
			swapTime
		);

		const inEntry = loadoutMap[nextTrack.characterId];
		const inWeapon = inEntry?.weaponId ? getWeaponById(inEntry.weaponId) : null;
		processWeaponEffects(
			'onSwapIn',
			inWeapon,
			(inEntry?.weaponRefinement ?? 1) - 1,
			nextTrack.characterId,
			nextTrack.characterId,
			swapTime
		);
	}

	// ── Active-target ability buff segmentation ──
	// onReaction fires once per CHARACTER, not once per track (the events are
	// rotation-wide), so it needs its own first-track guard — the cast/block
	// sites below are naturally per-track and do not.
	const reactionActiveDispatched = new Set<string>();
	/** Once-per-character guard for the summon-tick active-target pass — the
	 *  received-surface twin of `firstTrackOfChar` in the team-surface loop. */
	const tickActiveDispatched = new Set<string>();
	for (let sti = 0; sti < tracks.length; sti++) {
		const sourceTrack = tracks[sti];
		const char = getCharacter(sourceTrack.characterId);
		if (!char) continue;
		const cLevel = constellationLevels[sourceTrack.characterId] ?? 0;

		const { e: eCasts, q: qCasts } = castsForTrack(sti);
		const castPairs: Array<['skill' | 'burst', CastEvent[]]> = [
			['skill', eCasts],
			['burst', qCasts]
		];

		for (const [castType, abCasts] of castPairs) {
			// Per-token pool — see the note on the team-surface loop above: a
			// variant's effects replace the base's, so `E` and `hE` can qualify
			// different lists.
			const activeCache = new Map<
				string,
				Array<{ prov?: FactionProvenance; effects: BuffEffect[] }>
			>();
			const activeEffectsFor = (
				label: string
			): Array<{ prov?: FactionProvenance; effects: BuffEffect[] }> => {
				const hit = activeCache.get(label);
				if (hit) return hit;
				const seenStats = new Set<string>();
				const built = [
					...getCharacterEffectsForCast(char, cLevel, castType, label),
					...getCharacterEffectsForOnHit(char, cLevel, castType, label)
				].filter((effect): effect is BuffEffect => {
					if (effect.type !== 'buff') return false;
					if (!isActiveTargetOnly(effect.target)) return false;
					if (effect.duration == null) return false;
					if (
						evalCondition(
							effect.conditions,
							4,
							new Set(),
							cLevel,
							undefined,
							undefined,
							receivedCtxOf(char.id)
						) === false
					)
						return false;
					if (seenStats.has(effect.stat)) return false;
					seenStats.add(effect.stat);
					return true;
				});
				const grouped = byProvenance(built);
				activeCache.set(label, grouped);
				return grouped;
			};

			for (const cast of abCasts) {
				const filterCtx = resolveCastContext(char, castType, cast);
				// A non-hitting cast anchors no `onHit` effect (non-hitting casts round,
				// 2026-09-16); its `onCast` effects in the same pool are untouched.
				const castNoHit = castLandsNoHit(char, castType, cast);
				for (const activeGroup of activeEffectsFor(cast.label)) {
					const activeEffects = activeGroup.effects;
					if (activeEffects.length === 0) continue;
					const barEffects = activeEffects.filter((effect) => {
						if (
							evalCondition(
								effect.conditions,
								4,
								new Set(),
								cLevel,
								undefined,
								cast.stackContext,
								receivedCtxOf(char.id)
							) === false
						)
							return false;
						if (effect.trigger.type === 'onHit' && castNoHit) return false;
						if (effect.trigger.type === 'onHit' && filterCtx) {
							if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
						}
						return true;
					});
					if (barEffects.length === 0) continue;
					const firstValue = barEffects[0].value;
					const rampParams =
						typeof firstValue === 'object' && 'type' in firstValue && firstValue.type === 'ramping'
							? {
									startValue: firstValue.startValue,
									stepValue: firstValue.stepValue,
									stepInterval: framesOf(firstValue.stepInterval),
									cap: firstValue.cap
								}
							: undefined;
					const decayParams =
						typeof firstValue === 'object' && 'type' in firstValue && firstValue.type === 'decaying'
							? {
									startValue: firstValue.startValue,
									endValue: firstValue.endValue ?? 0,
									duration: framesOf(barEffects[0].duration!)
								}
							: undefined;
					const buffStart = cast.fieldStart;
					const buffEnd = buffStart + framesOf(barEffects[0].duration!);

					// ⚓ HOW LONG THE RECEIVER HAS BEEN ON FIELD (Nicole, 2026-08-18).
					// `onFieldDelay` shifts each segment's START and leaves the buff's
					// own end alone, so a receiver who swaps in with less than the
					// delay left in the window gets nothing — which is the mechanic:
					// Nicole "observes" whoever is active and upgrades them once they
					// have STAYED. ⚠️ Read off `barEffects[0]`, the same slot every
					// other span field here comes from.
					const delaySpec = barEffects[0].onFieldDelay;
					const segments: Array<{
						receiverId: string;
						segStart: number;
						segEnd: number;
						/** ⚓ THE TRACK's index, not the segment's — see the `isLast` note. */
						trackIdx: number;
					}> = [];
					for (let rti = 0; rti < tracks.length; rti++) {
						const receiverTrack = tracks[rti];
						// ⚓ The waiver is evaluated against the RECEIVER, answerable here
						// for the same reason `activeCharFaction` is — this is the one
						// scope where the receiver is concrete. ⚠️ Only a definitive TRUE
						// waives: an unresolvable condition leaves the wait standing,
						// because a delay that vanishes when we cannot answer would
						// over-claim uptime.
						const waived =
							delaySpec?.waivedWhen !== undefined &&
							evalCondition(delaySpec.waivedWhen, 4, new Set(), cLevel, undefined, undefined, {
								teamFactionCounts,
								activeCharFactions: new Set<string>(
									getCharacter(receiverTrack.characterId)?.factions ?? []
								),
								receiverWeapon: getCharacter(receiverTrack.characterId)?.weapon
							}) === true;
						const delayF = delaySpec && !waived ? framesOf(delaySpec.seconds) : 0;
						const segStart = Math.max(buffStart, receiverTrack.activeStart + delayF);
						const segEnd = Math.min(buffEnd, receiverTrack.activeEnd);
						if (segEnd <= segStart) continue;
						segments.push({
							receiverId: receiverTrack.characterId,
							segStart,
							segEnd,
							trackIdx: rti
						});
					}

					for (let si = 0; si < segments.length; si++) {
						const { receiverId, segStart, segEnd, trackIdx } = segments[si];
						// ⚓ "STILL ON FIELD AT THE END", not "the last segment that
						// survived". The extension to `buffEnd` exists because nobody
						// swaps away from the final track — so it belongs to the LAST
						// TRACK, and reading it off the segment array was only ever right
						// while every track produced a segment.
						// ⚠️ `onFieldDelay` broke that: a receiver who swaps in with less
						// than the delay left gets no segment at all, which promoted the
						// PREVIOUS receiver to "last" and ran their buff to the window's
						// end — straight through a swap-out that had already happened.
						const isLast = trackIdx === tracks.length - 1;
						const sourceIsActive = receiverId === sourceTrack.characterId;
						const segResolved = new Set<string>([sourceIsActive ? 'onField' : 'offField']);
						const segNegated = new Set<string>([sourceIsActive ? 'offField' : 'onField']);
						const receiverChar = getCharacter(receiverId);
						const activeCharFactions = new Set<string>(receiverChar?.factions ?? []);
						const segCtx: ConditionContext = {
							teamFactionCounts,
							negatedStates: segNegated,
							activeCharFactions,
							// ⚓ Same structural claim `activeCharFactions` makes: a
							// per-segment slice is the one scope where the RECEIVER is
							// concrete, so it is the one scope where a `weaponType`
							// condition can be answered. Bennett C6's Pyro DMG bonus is
							// the only buff in the corpus that asks (infusion round,
							// 2026-08-15) — it stops drawing for a bow or catalyst
							// receiver, which is what the talent says.
							receiverWeapon: receiverChar?.weapon
						};

						const segEffects = barEffects.filter(
							(effect) =>
								evalCondition(
									effect.conditions,
									4,
									segResolved,
									cLevel,
									undefined,
									cast.stackContext,
									segCtx
								) !== false
						);
						if (segEffects.length === 0) continue;
						const useSegList = segEffects.length !== barEffects.length;

						emit({
							characterId: sourceTrack.characterId,
							receiverId,
							start: segStart,
							end: isLast ? buffEnd : segEnd,
							effects: useSegList ? segEffects : barEffects,
							stackContext: cast.stackContext,
							duration: buffEnd - buffStart,
							...(rampParams ? { buffStart, rampParams } : {}),
							...(decayParams ? { buffStart, decayParams } : {}),
							sourceCastId: cast.id,
							source: { type: 'character', trigger: 'cast', abilityClass: castType }
						});
					}
				}
			}
		}

		// ── N/CA/P onHit active-target (PER-SWING hit anchored — phase-6) ──
		const blockClassPairs: Array<'normal' | 'charged' | 'plunge'> = ['normal', 'charged', 'plunge'];
		for (const blockClass of blockClassPairs) {
			const onHitBlockList = getCharacterEffectsForOnHit(char, cLevel, blockClass);
			if (onHitBlockList.length === 0) continue;
			for (const blockGroup of byProvenance(onHitBlockList)) {
				const seenStats = new Set<string>();
				const activeEffects = blockGroup.effects.filter((effect): effect is BuffEffect => {
					if (effect.type !== 'buff') return false;
					if (!isActiveTargetOnly(effect.target)) return false;
					if (effect.duration == null) return false;
					if (
						evalCondition(
							effect.conditions,
							4,
							new Set(),
							cLevel,
							undefined,
							undefined,
							receivedCtxOf(char.id)
						) === false
					)
						return false;
					if (seenStats.has(effect.stat)) return false;
					seenStats.add(effect.stat);
					return true;
				});
				if (activeEffects.length === 0) continue;
				for (const hit of hitsForTrack(sti, blockClass)) {
					const filterCtx = hitFilterCtx(hit);
					const barEffects = activeEffects.filter((effect) => {
						if (
							evalCondition(
								effect.conditions,
								4,
								new Set(),
								cLevel,
								undefined,
								hit.stacks,
								receivedCtxOf(char.id)
							) === false
						)
							return false;
						if (effect.trigger.type === 'onHit') {
							if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
						}
						return true;
					});
					if (barEffects.length === 0) continue;
					const buffStart = hit.time;
					const buffEnd = buffStart + framesOf(barEffects[0].duration!);
					const segments: Array<{ receiverId: string; segStart: number; segEnd: number }> = [];
					for (const receiverTrack of tracks) {
						const segStart = Math.max(buffStart, receiverTrack.activeStart);
						const segEnd = Math.min(buffEnd, receiverTrack.activeEnd);
						if (segEnd <= segStart) continue;
						segments.push({ receiverId: receiverTrack.characterId, segStart, segEnd });
					}
					for (let si = 0; si < segments.length; si++) {
						const { receiverId, segStart, segEnd } = segments[si];
						const isLast = si === segments.length - 1;
						const sourceIsActive = receiverId === sourceTrack.characterId;
						const segResolved = new Set<string>([sourceIsActive ? 'onField' : 'offField']);
						const segNegated = new Set<string>([sourceIsActive ? 'offField' : 'onField']);
						const receiverChar = getCharacter(receiverId);
						const activeCharFactions = new Set<string>(receiverChar?.factions ?? []);
						const segCtx: ConditionContext = {
							teamFactionCounts,
							negatedStates: segNegated,
							activeCharFactions,
							// ⚓ Same structural claim `activeCharFactions` makes: a
							// per-segment slice is the one scope where the RECEIVER is
							// concrete, so it is the one scope where a `weaponType`
							// condition can be answered. Bennett C6's Pyro DMG bonus is
							// the only buff in the corpus that asks (infusion round,
							// 2026-08-15) — it stops drawing for a bow or catalyst
							// receiver, which is what the talent says.
							receiverWeapon: receiverChar?.weapon
						};
						const segEffects = barEffects.filter(
							(effect) =>
								evalCondition(
									effect.conditions,
									4,
									segResolved,
									cLevel,
									undefined,
									hit.stacks,
									segCtx
								) !== false
						);
						if (segEffects.length === 0) continue;
						const useSegList = segEffects.length !== barEffects.length;
						emit({
							characterId: sourceTrack.characterId,
							receiverId,
							start: segStart,
							end: isLast ? buffEnd : segEnd,
							effects: useSegList ? segEffects : barEffects,
							stackContext: hit.stacks,
							duration: buffEnd - buffStart,
							sourceActionId: hit.sourceEventId,
							source: { type: 'character', trigger: 'block', abilityClass: blockClass }
						});
					}
				}
			}
		}

		// ── Summon-tick onHit active-target (PER-TICK anchored, 2026-08-31) ──
		//
		// ⚓⚓ THE RECEIVED-SURFACE HALF OF THE SUMMON-TICK PASS. The team-surface
		// one above covers a shred or a team buff; this covers a buff aimed at
		// whoever is ON FIELD, which is the shape Alyosha's Hunter's Precision
		// takes ("all nearby party members … when they are on the field"). Without
		// it a tick could CONSUME the mark and draw nothing — strictly worse than
		// not dispatching the tick at all.
		//
		// ⚠️ Half B deliberately left this surface out and said to re-run the
		// census before adding it. Re-run 2026-08-31: it is still exactly one
		// holder — Alyosha, whose burst's activation effects are the only
		// active-target onHit buffs in the corpus on a character who leaves a
		// ticking summon. ⛔ The other missing surface (`target: 'self'`) still has
		// no author and still stays out.
		//
		// ⚠️ ROTATION-WIDE per character, not per track — the same `firstTrackOfChar`
		// reason the team-surface pass carries: the summon ticks while its owner is
		// off field, and track-scoping would cut the window at every swap.
		if (!tickActiveDispatched.has(sourceTrack.characterId)) {
			tickActiveDispatched.add(sourceTrack.characterId);
			const tickHits = hits
				.filter((h) => h.viaEntity === true && h.characterId === sourceTrack.characterId)
				.slice()
				.sort((a, b) => a.time - b.time);
			for (const castType of ['skill', 'burst'] as const) {
				if (tickHits.length === 0) break;
				const classHits = tickHits.filter((h) => h.abilityType === castType);
				if (classHits.length === 0) continue;
				const onHitTickList = getCharacterEffectsForOnHit(char, cLevel, castType);
				if (onHitTickList.length === 0) continue;
				for (const tickGroup of byProvenance(onHitTickList)) {
					const seenStats = new Set<string>();
					const activeEffects = tickGroup.effects.filter((effect): effect is BuffEffect => {
						if (effect.type !== 'buff') return false;
						if (!isActiveTargetOnly(effect.target)) return false;
						if (effect.duration == null) return false;
						if (
							evalCondition(
								effect.conditions,
								4,
								new Set(),
								cLevel,
								undefined,
								undefined,
								receivedCtxOf(char.id)
							) === false
						)
							return false;
						if (seenStats.has(effect.stat)) return false;
						seenStats.add(effect.stat);
						return true;
					});
					if (activeEffects.length === 0) continue;
					for (const hit of classHits) {
						const filterCtx = hitFilterCtx(hit);
						const barEffects = activeEffects.filter((effect) => {
							if (effect.trigger.type !== 'onHit') return false;
							if (!onHitTriggerMatches(effect.trigger, hit, sourceTrack.characterId)) return false;
							if (
								evalCondition(
									effect.conditions,
									4,
									new Set(),
									cLevel,
									undefined,
									hit.stacks,
									receivedCtxOf(char.id)
								) === false
							)
								return false;
							return evalTriggerFilter(effect.trigger.filter, filterCtx);
						});
						if (barEffects.length === 0) continue;
						const buffStart = hit.time;
						const buffEnd = buffStart + framesOf(barEffects[0].duration!);
						// Sliced across on-field windows exactly like the cast and
						// per-swing paths — the buff follows whoever is active, so one
						// activation becomes one window per receiver it covers.
						const segments: Array<{ receiverId: string; segStart: number; segEnd: number }> = [];
						for (let rti = 0; rti < tracks.length; rti++) {
							const receiverTrack = tracks[rti];
							// ⚓⚓ THE LAST TRACK RUNS TO INFINITY, and this pass is the
							// first that needed saying so. Every other active-target site
							// anchors at a CAST or a SWING, which is inside a track by
							// construction; a summon TICK is the first anchor that can
							// land after the notation's last action — `Alyosha E Q` is
							// 2.32s long and Tugarin mauls until 14.73s. Clamping to the
							// last track's `activeEnd` drew nothing at all there.
							// ⚠️ It is the same claim the `isLast ? buffEnd` clamp below
							// already makes (the last covered receiver keeps the buff to
							// its natural end) — nobody swaps away after the rotation
							// stops. ⛔ Not `totalDuration`: the summon lane already draws
							// past it, so a buff its ticks raise must be allowed to too.
							const trackEnd = rti === tracks.length - 1 ? Infinity : receiverTrack.activeEnd;
							const segStart = Math.max(buffStart, receiverTrack.activeStart);
							const segEnd = Math.min(buffEnd, trackEnd);
							if (segEnd <= segStart) continue;
							segments.push({ receiverId: receiverTrack.characterId, segStart, segEnd });
						}
						for (let si = 0; si < segments.length; si++) {
							const { receiverId, segStart, segEnd } = segments[si];
							const isLast = si === segments.length - 1;
							const sourceIsActive = receiverId === sourceTrack.characterId;
							const segResolved = new Set<string>([sourceIsActive ? 'onField' : 'offField']);
							const segNegated = new Set<string>([sourceIsActive ? 'offField' : 'onField']);
							const receiverChar = getCharacter(receiverId);
							const segCtx: ConditionContext = {
								teamFactionCounts,
								negatedStates: segNegated,
								activeCharFactions: new Set<string>(receiverChar?.factions ?? []),
								receiverWeapon: receiverChar?.weapon
							};
							const segEffects = barEffects.filter(
								(effect) =>
									evalCondition(
										effect.conditions,
										4,
										segResolved,
										cLevel,
										undefined,
										hit.stacks,
										segCtx
									) !== false
							);
							if (segEffects.length === 0) continue;
							emit({
								characterId: sourceTrack.characterId,
								receiverId,
								start: segStart,
								end: isLast ? buffEnd : segEnd,
								effects: segEffects.length !== barEffects.length ? segEffects : barEffects,
								stackContext: hit.stacks,
								duration: buffEnd - buffStart,
								// ⚓ The same `source` the CAST pool stamps, so the tick
								// windows land in the cast's row and `mergeRefreshedBars`
								// fuses them at the projection.
								sourceCastId: hit.sourceEventId >= 0 ? hit.sourceEventId : undefined,
								source: { type: 'character', trigger: 'cast', abilityClass: castType }
							});
						}
					}
				}
			}
		}

		// ── onReaction active-target (segmented, received surface) ──
		//
		// ⚓ Added 2026-08-15. Until then the ONLY onReaction dispatch was the
		// team-surface one, which requires `targetsTeamOrActive` and then
		// rejects `isActiveTargetOnly` — so an onReaction buff aimed at the
		// active character was accepted by the first gate and dropped by the
		// second, and there was no second home for it to fall through to. It
		// rendered nowhere at all. Same class of silent drop as Sucrose's A1
		// `target: 'self'` (9959b5b), found the same way: the effect is
		// authored, the reaction fires, and no bar appears.
		if (!reactionActiveDispatched.has(sourceTrack.characterId)) {
			reactionActiveDispatched.add(sourceTrack.characterId);
			for (const pool of reactionPoolsFor(
				char,
				sourceTrack.characterId,
				cLevel,
				receivedCtxOf(char.id),
				(e) => e.type === 'buff' && isActiveTargetOnly(e.target)
			)) {
				// Sliced across on-field windows exactly like the cast path: the
				// buff follows whoever is active, so one application becomes one
				// window per receiver it covers.
				const segments: Array<{ receiverId: string; segStart: number; segEnd: number }> = [];
				for (const receiverTrack of tracks) {
					const segStart = Math.max(pool.start, receiverTrack.activeStart);
					const segEnd = Math.min(pool.end, receiverTrack.activeEnd);
					if (segEnd <= segStart) continue;
					segments.push({ receiverId: receiverTrack.characterId, segStart, segEnd });
				}
				for (let si = 0; si < segments.length; si++) {
					const { receiverId, segStart, segEnd } = segments[si];
					const isLast = si === segments.length - 1;
					emit({
						characterId: sourceTrack.characterId,
						receiverId,
						start: segStart,
						end: isLast ? pool.end : segEnd,
						effects: pool.effects,
						duration: pool.end - pool.start,
						source: { type: 'character', trigger: 'reaction' }
					});
				}
			}
		}
	}

	// ── Self-target buffs + NB self-target ──
	const nbSelfDispatched = new Set<string>();
	for (let sti = 0; sti < tracks.length; sti++) {
		const sourceTrack = tracks[sti];
		const char = getCharacter(sourceTrack.characterId);
		if (!char) continue;
		const firstTrackOfChar = !nbSelfDispatched.has(sourceTrack.characterId);
		nbSelfDispatched.add(sourceTrack.characterId);
		const cLevel = constellationLevels[sourceTrack.characterId] ?? 0;

		const { e: eCasts, q: qCasts } = castsForTrack(sti);
		const selfCastPairs: Array<['skill' | 'burst', CastEvent[]]> = [
			['skill', eCasts],
			['burst', qCasts]
		];

		for (const [castType, abCasts] of selfCastPairs) {
			const selfResolved = new Set<string>(['onField']);
			const selfNegated = new Set<string>(['offField']);
			const selfCtx: ConditionContext = {
				teamFactionCounts,
				negatedStates: selfNegated,
				teamElementCounts: teamElementCountsByHolder.get(char.id)
			};
			// Per-token pool — see the team-surface loop's note.
			const selfCache = new Map<
				string,
				Array<{ prov?: FactionProvenance; effects: BuffEffect[] }>
			>();
			const selfEffectsFor = (
				label: string
			): Array<{ prov?: FactionProvenance; effects: BuffEffect[] }> => {
				const cached = selfCache.get(label);
				if (cached) return cached;
				const seenStats = new Set<string>();
				const built = [
					...getCharacterEffectsForCast(char, cLevel, castType, label),
					...getCharacterEffectsForOnHit(char, cLevel, castType, label)
				].filter((effect): effect is BuffEffect => {
					if (effect.type !== 'buff') return false;
					if (effect.target !== 'self') return false;
					if (effect.duration == null) return false;
					if (
						evalCondition(
							effect.conditions,
							4,
							selfResolved,
							cLevel,
							undefined,
							undefined,
							selfCtx
						) === false
					)
						return false;
					if (seenStats.has(effect.stat)) return false;
					seenStats.add(effect.stat);
					return true;
				});
				const grouped = byProvenance(built);
				selfCache.set(label, grouped);
				return grouped;
			};

			for (const cast of abCasts) {
				const filterCtx = resolveCastContext(char, castType, cast);
				// A non-hitting cast anchors no `onHit` effect (non-hitting casts round,
				// 2026-09-16); its `onCast` effects in the same pool are untouched.
				const castNoHit = castLandsNoHit(char, castType, cast);
				for (const selfGroup of selfEffectsFor(cast.label)) {
					const selfEffects = selfGroup.effects;
					if (selfEffects.length === 0) continue;
					const barEffects = selfEffects.filter((effect) => {
						if (
							evalCondition(
								effect.conditions,
								4,
								selfResolved,
								cLevel,
								undefined,
								cast.stackContext,
								selfCtx
							) === false
						)
							return false;
						if (effect.trigger.type === 'onHit' && castNoHit) return false;
						if (effect.trigger.type === 'onHit' && filterCtx) {
							if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
						}
						return true;
					});
					if (barEffects.length === 0) continue;
					const buffStart = cast.fieldStart;
					const buffEnd = buffStart + framesOf(barEffects[0].duration!);
					emit({
						characterId: sourceTrack.characterId,
						receiverId: sourceTrack.characterId,
						start: buffStart,
						end: buffEnd,
						effects: barEffects,
						stackContext: cast.stackContext,
						duration: buffEnd - buffStart,
						sourceCastId: cast.id,
						source: { type: 'character', trigger: 'cast', abilityClass: castType }
					});
				}
			}
		}

		// ── N/CA/P onHit self-target (block-end anchored — phase-4 scope) ──
		const blockClassPairs: Array<'normal' | 'charged' | 'plunge'> = ['normal', 'charged', 'plunge'];
		const selfResolvedBlock = new Set<string>(['onField']);
		const selfNegatedBlock = new Set<string>(['offField']);
		const selfCtxBlock: ConditionContext = {
			teamFactionCounts,
			negatedStates: selfNegatedBlock,
			teamElementCounts: teamElementCountsByHolder.get(char.id)
		};
		for (const blockClass of blockClassPairs) {
			const onHitBlockSelf = getCharacterEffectsForOnHit(char, cLevel, blockClass);
			if (onHitBlockSelf.length === 0) continue;
			for (const selfBlockGroup of byProvenance(onHitBlockSelf)) {
				const seenStats = new Set<string>();
				const selfEffects = selfBlockGroup.effects.filter((effect): effect is BuffEffect => {
					if (effect.type !== 'buff') return false;
					if (effect.target !== 'self') return false;
					if (effect.duration == null) return false;
					if (
						evalCondition(
							effect.conditions,
							4,
							selfResolvedBlock,
							cLevel,
							undefined,
							undefined,
							selfCtxBlock
						) === false
					)
						return false;
					if (seenStats.has(effect.stat)) return false;
					seenStats.add(effect.stat);
					return true;
				});
				if (selfEffects.length === 0) continue;
				// PER-SWING hit anchored (phase-6): the hit-time stack snapshot is
				// what stack-gated self buffs read — Yanfei A1's perStack Pyro DMG
				// bonus sees her pre-consume seal count at the CA hit.
				for (const hit of hitsForTrack(sti, blockClass)) {
					const filterCtx = hitFilterCtx(hit);
					const barEffects = selfEffects.filter((effect) => {
						if (
							evalCondition(
								effect.conditions,
								4,
								selfResolvedBlock,
								cLevel,
								undefined,
								hit.stacks,
								selfCtxBlock
							) === false
						)
							return false;
						if (effect.trigger.type === 'onHit') {
							if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
						}
						return true;
					});
					if (barEffects.length === 0) continue;
					const buffStart = hit.time;
					const buffEnd = buffStart + framesOf(barEffects[0].duration!);
					emit({
						characterId: sourceTrack.characterId,
						receiverId: sourceTrack.characterId,
						start: buffStart,
						end: buffEnd,
						effects: barEffects,
						stackContext: hit.stacks,
						duration: buffEnd - buffStart,
						sourceActionId: hit.sourceEventId,
						source: { type: 'character', trigger: 'block', abilityClass: blockClass }
					});
				}
			}
		}

		// ── onTeamNightsoulBurst self-target ──
		const nbSelfPool = getCharacterEffectsForTeamNightsoulBurst(char, cLevel);
		if (firstTrackOfChar && nbBars.length > 0 && nbSelfPool.length > 0) {
			for (const nbSelfGroup of byProvenance(nbSelfPool)) {
				const seenStatsNB = new Set<string>();
				const selfEffectsNB = nbSelfGroup.effects.filter((effect): effect is BuffEffect => {
					if (effect.type !== 'buff') return false;
					if (effect.target !== 'self') return false;
					if (effect.duration == null) return false;
					if (
						evalCondition(
							effect.conditions,
							4,
							new Set(),
							cLevel,
							undefined,
							undefined,
							receivedCtxOf(char.id)
						) === false
					)
						return false;
					if (seenStatsNB.has(effect.stat)) return false;
					seenStatsNB.add(effect.stat);
					return true;
				});
				if (selfEffectsNB.length > 0) {
					for (const nb of nbBars) {
						const buffStart = nb.start;
						const buffEnd = buffStart + framesOf(selfEffectsNB[0].duration!);
						emit({
							characterId: sourceTrack.characterId,
							receiverId: sourceTrack.characterId,
							start: buffStart,
							end: buffEnd,
							effects: selfEffectsNB,
							duration: buffEnd - buffStart,
							source: { type: 'character', trigger: 'nightsoulBurst' }
						});
					}
				}
			}
		}

		// ── onReaction self-target (received surface) ──
		//
		// ⚓ Added 2026-08-15, same gap as the active-target block above: the
		// team-surface onReaction dispatch requires `targetsTeamOrActive`, which
		// `self` fails outright, and no other site handled the trigger. Six
		// effects across three characters rendered nothing — Prune's two Secret
		// Rite ATK buffs, Varka's three, and Freminet's CRIT DMG — four of which
		// are ordinary passives and constellations with no faction involvement.
		//
		// ⛔ Not segmented. A self-target buff has exactly one receiver and does
		// not follow the field, so it is one window per application, matching
		// the self-target cast site directly above.
		if (firstTrackOfChar) {
			for (const pool of reactionPoolsFor(
				char,
				sourceTrack.characterId,
				cLevel,
				receivedCtxOf(char.id),
				(e) => e.type === 'buff' && e.target === 'self'
			)) {
				emit({
					characterId: sourceTrack.characterId,
					receiverId: sourceTrack.characterId,
					start: pool.start,
					end: pool.end,
					effects: pool.effects,
					duration: pool.end - pool.start,
					source: { type: 'character', trigger: 'reaction' }
				});
			}
		}
	}

	return out;
}
