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
import {
	getCharacterEffectsForAfterDuration,
	getCharacterEffectsForCast,
	getCharacterEffectsForOnHit,
	getCharacterEffectsForOnReaction,
	getCharacterEffectsForTeamNightsoulBurst,
	isActiveTargetOnly,
	resolveCastContext,
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
	const emit = (w: Omit<BuffWindow, 'kind' | 'id'>): BuffWindow => {
		const win: BuffWindow = { kind: 'buff', id: nextId++, ...w };
		out.push(win);
		return win;
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
			const castEffects = getCharacterEffectsForCast(char, castType);
			const onHitEffects = getCharacterEffectsForOnHit(char, castType);
			const afterDurationEffects = getCharacterEffectsForAfterDuration(char, castType);

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
			const seenStats = new Set<string>();
			const qualifiedEffects = [...castEffects, ...onHitEffects]
				.filter(universalPool)
				.filter((effect) => {
					if (seenStats.has(effect.stat)) return false;
					seenStats.add(effect.stat);
					return true;
				});
			if (qualifiedEffects.length > 0) {
				for (const cast of abCasts) {
					const filterCtx = resolveCastContext(char, castType, cast);
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
						if (effect.trigger.type === 'onHit' && filterCtx) {
							if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
						}
						return true;
					});
					if (barEffects.length === 0) continue;
					const buffStart = cast.fieldStart;
					const buffEnd = buffStart + barEffects[0].duration!;
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

			// ── afterDuration buffs ──
			const seenStatsAfter = new Set<string>();
			const qualifiedEffectsAfter = afterDurationEffects.filter((effect): effect is BuffEffect => {
				if (effect.type !== 'buff') return false;
				if (!targetsTeamOrActive(effect.target)) return false;
				if (isActiveTargetOnly(effect.target)) return false;
				if (effect.duration == null) return false;
				if (
					evalCondition(effect.conditions, 4, new Set(), cLevel, undefined, undefined, baseCtx) ===
					false
				)
					return false;
				if (seenStatsAfter.has(effect.stat)) return false;
				seenStatsAfter.add(effect.stat);
				return true;
			});
			if (qualifiedEffectsAfter.length > 0) {
				for (const cast of abCasts) {
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
					const buffEnd = buffStart + barEffects[0].duration!;
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

			// ── resShred (debuff): onCast+onHit at cast start ──
			const resShredStartPool = dedupResShredByElement(
				[...castEffects, ...onHitEffects].filter(resShredBase)
			);
			if (resShredStartPool.length > 0) {
				for (const cast of abCasts) {
					const filterCtx = resolveCastContext(char, castType, cast);
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
						if (effect.trigger.type === 'onHit' && filterCtx) {
							if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
						}
						return true;
					});
					if (barEffects.length === 0) continue;
					const buffStart = cast.fieldStart;
					const buffEnd = buffStart + barEffects[0].duration!;
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

			// ── resShred (debuff): afterDuration at cast end — no per-bar filter ──
			const resShredEndPool = dedupResShredByElement(afterDurationEffects.filter(resShredBase));
			if (resShredEndPool.length > 0) {
				for (const cast of abCasts) {
					const buffStart = afterDurationStart(cast);
					const buffEnd = buffStart + resShredEndPool[0].duration!;
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

		// ── N/CA/P onHit pools (PER-SWING hit anchored — phase-6 delta) ──
		// Each parser hit record carries swing-end time, per-hit element,
		// comboIndex (filter.hitIndex), and the hit-time stack snapshot.
		// Successive overlapping same-shape hits REFRESH the open window in
		// place (Flins C2's 7s Electro shred rides an NA string as one span).
		const blockClassPairs: Array<'normal' | 'charged' | 'plunge'> = ['normal', 'charged', 'plunge'];
		for (const blockClass of blockClassPairs) {
			const onHitBlockEffects = getCharacterEffectsForOnHit(char, blockClass);
			if (onHitBlockEffects.length === 0) continue;
			const seenStats = new Set<string>();
			const qualifiedEffects = onHitBlockEffects
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
					const buffEnd = buffStart + barEffects[0].duration!;
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

			const resShredBlockPool = dedupResShredByElement(onHitBlockEffects.filter(resShredBase));
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
					const buffEnd = buffStart + barEffects[0].duration!;
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

		// ── onTeamNightsoulBurst team-target buffs (once per character) ──
		const nbEffects = getCharacterEffectsForTeamNightsoulBurst(char);
		if (firstTrackOfChar && nbBars.length > 0 && nbEffects.length > 0) {
			const seenStatsNB = new Set<string>();
			const qualifiedEffectsNB = nbEffects.filter((effect): effect is BuffEffect => {
				if (effect.type !== 'buff') return false;
				if (!targetsTeamOrActive(effect.target)) return false;
				if (isActiveTargetOnly(effect.target)) return false;
				if (effect.duration == null) return false;
				if (
					evalCondition(effect.conditions, 4, new Set(), cLevel, undefined, undefined, baseCtx) ===
					false
				)
					return false;
				if (seenStatsNB.has(effect.stat)) return false;
				seenStatsNB.add(effect.stat);
				return true;
			});
			if (qualifiedEffectsNB.length > 0) {
				for (const nb of nbBars) {
					const buffStart = nb.start;
					const buffEnd = buffStart + qualifiedEffectsNB[0].duration!;
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
						const buffEnd = buffStart + effects[0].duration!;
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
				for (const effect of artifactOnReactionFiltered) {
					const trigReaction = (effect.trigger as { reaction: Reaction | Reaction[] | 'any' })
						.reaction;
					const matches = (r: Reaction): boolean =>
						trigReaction === 'any' ||
						(Array.isArray(trigReaction) ? trigReaction.includes(r) : trigReaction === r);
					for (const ev of charReactionEvents) {
						if (!matches(ev.reaction)) continue;
						const buffStart = ev.time;
						const buffEnd = buffStart + effect.duration!;
						emit({
							characterId: track.characterId,
							start: buffStart,
							end: buffEnd,
							debuff: effect.type === 'resShred' || undefined,
							effects: [effect],
							source: { type: 'artifact', setId: artifactSetId, trigger: 'reaction' }
						});
					}
				}
			}
		}

		// ── Character onReaction effects (buff + resShred), once per character ──
		const onReactionEffects = getCharacterEffectsForOnReaction(char);
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
			for (const effect of qualified) {
				const trig = effect.trigger as {
					reaction: Reaction | Reaction[] | 'any';
					source?: 'self' | 'team';
				};
				const trigReaction = trig.reaction;
				const matches = (r: Reaction): boolean =>
					trigReaction === 'any' ||
					(Array.isArray(trigReaction) ? trigReaction.includes(r) : trigReaction === r);
				const eventPool = trig.source === 'team' ? reactionEvents : ownReactionEvents;
				for (const ev of eventPool) {
					if (!matches(ev.reaction)) continue;
					const buffStart = ev.time;
					const buffEnd = buffStart + effect.duration!;
					emit({
						characterId: track.characterId,
						start: buffStart,
						end: buffEnd,
						debuff: effect.type === 'resShred' || undefined,
						effects: [effect],
						source: { type: 'character', trigger: 'reaction' }
					});
				}
			}
		}
	}

	// ════════════════════════════════════════════════════════════════════
	// PASS B — received surface (port of computeCharReceivedBuffRows)
	// ════════════════════════════════════════════════════════════════════

	const procReadyAt = new Map<string, number>();
	const receivedBaseCtx: ConditionContext = { teamFactionCounts, teamEnabledReactions };

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
			const icd =
				rawIcd == null
					? 0
					: typeof rawIcd === 'number'
						? rawIcd
						: rawIcd.refinementValues[refinementIndex];
			const procReady = procReadyAt.get(icdKey) ?? 0;
			if (swapTime < procReady) continue;
			procReadyAt.set(icdKey, swapTime + icd);

			emit({
				characterId: holderId,
				receiverId,
				start: swapTime,
				end: swapTime + first.duration!,
				effects,
				refinementIndex,
				duration: first.duration!,
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
			const onCastList = getCharacterEffectsForCast(char, castType);
			const onHitList = getCharacterEffectsForOnHit(char, castType);
			const seenStats = new Set<string>();
			const activeEffects = [...onCastList, ...onHitList].filter((effect): effect is BuffEffect => {
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
						receivedBaseCtx
					) === false
				)
					return false;
				if (seenStats.has(effect.stat)) return false;
				seenStats.add(effect.stat);
				return true;
			});
			if (activeEffects.length === 0) continue;

			for (const cast of abCasts) {
				const filterCtx = resolveCastContext(char, castType, cast);
				const barEffects = activeEffects.filter((effect) => {
					if (
						evalCondition(
							effect.conditions,
							4,
							new Set(),
							cLevel,
							undefined,
							cast.stackContext,
							receivedBaseCtx
						) === false
					)
						return false;
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
								stepInterval: firstValue.stepInterval,
								cap: firstValue.cap
							}
						: undefined;
				const decayParams =
					typeof firstValue === 'object' && 'type' in firstValue && firstValue.type === 'decaying'
						? {
								startValue: firstValue.startValue,
								endValue: firstValue.endValue ?? 0,
								duration: barEffects[0].duration!
							}
						: undefined;
				const buffStart = cast.fieldStart;
				const buffEnd = buffStart + barEffects[0].duration!;

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
						activeCharFactions
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

		// ── N/CA/P onHit active-target (PER-SWING hit anchored — phase-6) ──
		const blockClassPairs: Array<'normal' | 'charged' | 'plunge'> = ['normal', 'charged', 'plunge'];
		for (const blockClass of blockClassPairs) {
			const onHitBlockList = getCharacterEffectsForOnHit(char, blockClass);
			if (onHitBlockList.length === 0) continue;
			const seenStats = new Set<string>();
			const activeEffects = onHitBlockList.filter((effect): effect is BuffEffect => {
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
						receivedBaseCtx
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
							receivedBaseCtx
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
				const buffEnd = buffStart + barEffects[0].duration!;
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
						activeCharFactions
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
			const onCastSelf = getCharacterEffectsForCast(char, castType);
			const onHitSelf = getCharacterEffectsForOnHit(char, castType);
			const seenStats = new Set<string>();
			const selfResolved = new Set<string>(['onField']);
			const selfNegated = new Set<string>(['offField']);
			const selfCtx: ConditionContext = {
				teamFactionCounts,
				negatedStates: selfNegated,
				teamElementCounts: teamElementCountsByHolder.get(char.id)
			};
			const selfEffects = [...onCastSelf, ...onHitSelf].filter((effect): effect is BuffEffect => {
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
			if (selfEffects.length === 0) continue;

			for (const cast of abCasts) {
				const filterCtx = resolveCastContext(char, castType, cast);
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
					if (effect.trigger.type === 'onHit' && filterCtx) {
						if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
					}
					return true;
				});
				if (barEffects.length === 0) continue;
				const buffStart = cast.fieldStart;
				const buffEnd = buffStart + barEffects[0].duration!;
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
			const onHitBlockSelf = getCharacterEffectsForOnHit(char, blockClass);
			if (onHitBlockSelf.length === 0) continue;
			const seenStats = new Set<string>();
			const selfEffects = onHitBlockSelf.filter((effect): effect is BuffEffect => {
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
				const buffEnd = buffStart + barEffects[0].duration!;
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

		// ── onTeamNightsoulBurst self-target ──
		const nbSelfPool = getCharacterEffectsForTeamNightsoulBurst(char);
		if (firstTrackOfChar && nbBars.length > 0 && nbSelfPool.length > 0) {
			const seenStatsNB = new Set<string>();
			const selfEffectsNB = nbSelfPool.filter((effect): effect is BuffEffect => {
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
						receivedBaseCtx
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
					const buffEnd = buffStart + selfEffectsNB[0].duration!;
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

	return out;
}
