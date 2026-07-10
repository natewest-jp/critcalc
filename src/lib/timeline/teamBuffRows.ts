/**
 * src/lib/timeline/teamBuffRows.ts
 *
 * Team-buffs-row computation: derives buff/debuff windows from character
 * E/Q/N-hit effects, artifact 4pc onCast/onReaction triggers, team Nightsoul
 * Burst events, and the parser's reaction-event stream. One sub-row per
 * dedup key; bars carry pre-formatted display values.
 *
 * Pure — extracted from RotationTimeline.svelte. The character resolver is
 * injected so the component can pass the reactive lazy-load cache
 * (`getLoadedCharacter`) while unit tests pass hermetic fixtures.
 */

import {
	evalCondition,
	type ConditionContext,
	type CharacterTrack,
	type TimelineBar
} from '$lib/utils/notationParser';
import { evalTriggerFilter } from '$lib/types/ability';
import type { Effect, Element, Reaction } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import type { LoadoutEntry } from '$lib/stores';
import { getArtifactSetById } from '$lib/data/artifactLookup';
import type {
	BuffEffect,
	ResShredEffect,
	MergedEffectDisplay,
	TeamBuffBar,
	TeamBuffSubrow
} from './types';
import {
	canonicalHeadlineOf,
	formatBuffDisplayValue,
	formatResShredDisplayValue,
	resShredDisplayStat
} from './buffDisplay';
import {
	getBlockDamageTag,
	getCharacterEffectsForAfterDuration,
	getCharacterEffectsForCast,
	getCharacterEffectsForOnHit,
	getCharacterEffectsForOnReaction,
	getCharacterEffectsForTeamNightsoulBurst,
	isActiveTargetOnly,
	resolveBlockContext,
	resolveCastContext,
	targetsEnemy,
	targetsTeamOrActive
} from './effectCollection';

export function computeTeamBuffRows(
	tracks: CharacterTrack[],
	constellationLevels: Record<string, number>,
	loadoutMap: Record<string, LoadoutEntry>,
	teamFactionCounts: ReadonlyMap<string, number>,
	teamElementCountsByHolder: ReadonlyMap<string, ReadonlyMap<Element, number>>,
	nbBars: ReadonlyArray<{ start: number; cooldown: number }>,
	reactionEvents: ReadonlyArray<{
		characterId: string;
		reaction: Reaction;
		time: number;
		castKind: 'skill' | 'burst';
	}>,
	getCharacter: (id: string) => CharacterData | null
): Array<TeamBuffSubrow & { key: string }> {
	const rowMap = new Map<string, TeamBuffSubrow>();

	// Characters that already had their character-scoped (rotation-wide
	// event pool) dispatches run. NB / onReaction pools are filtered by
	// characterId only — never by track — so running them once per TRACK
	// duplicates every bar when a character appears in multiple segments.
	const dispatchedCharScoped = new Set<string>();

	for (const track of tracks) {
		const char = getCharacter(track.characterId);
		if (!char) continue;
		const firstTrackOfChar = !dispatchedCharScoped.has(track.characterId);
		dispatchedCharScoped.add(track.characterId);

		// Per-holder context: teamFactionCounts stays whole-team (matches
		// teamFaction semantic), teamElementCounts narrows to this holder's
		// non-self count map.
		const baseCtx: ConditionContext = {
			teamFactionCounts,
			teamElementCounts: teamElementCountsByHolder.get(char.id)
		};

		const cLevel = constellationLevels[track.characterId] ?? 0;

		// ── resShred (debuff) shared helpers — used by every dispatch site below ──
		// Common base filter for `target: enemy` resShred effects; returns true
		// when type/target/duration match and base conditions resolve true (or
		// null). Per-bar conditions and onHit filter are layered at each call site.
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
		// Dedup by element (`_all` for unspecified) so multiple sources of the
		// same element shred collapse to a single bar. First-declared wins.
		const dedupResShredByElement = (pool: ResShredEffect[]): ResShredEffect[] => {
			const seen = new Set<string>();
			return pool.filter((e) => {
				const k = e.element ?? '_all';
				if (seen.has(k)) return false;
				seen.add(k);
				return true;
			});
		};

		// ── Character cast effects (onCast) — source-grouped by ability ──
		// Effects are sourced from the character's full effect surface (abilities +
		// passives + constellations) so that buffs declared on a constellation node
		// (e.g. Bennett C1) attach to the timeline bar of the cast they trigger off.
		const castPairs: Array<['skill' | 'burst', TimelineBar[], string]> = [
			['skill', track.eBars, 'E'],
			['burst', track.qBars, 'Q']
		];

		for (const [castType, abBars, abLabel] of castPairs) {
			const castEffects = getCharacterEffectsForCast(char, castType);
			const onHitEffects = getCharacterEffectsForOnHit(char, castType);
			const afterDurationEffects = getCharacterEffectsForAfterDuration(char, castType);

			// ── onCast + onHit effects (combined pool) ──
			// onHit triggers are filtered per-bar via evalTriggerFilter
			// against the cast's resolved (ability, variant) context.
			// onCast effects always pass that filter (their trigger has no
			// `filter` field). Dedup-by-stat prefers onCast over onHit when
			// both fire on the same stat (declaration order in the merged
			// pool: onCast first).
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
				const rowKey = `${track.characterId}::char::${abLabel}`;
				const sourceLabel = `${char.displayName} ${abLabel}`;

				for (const bar of abBars) {
					const filterCtx = resolveCastContext(char, castType, bar);
					// Per-cast filter chain:
					//   1. evalCondition with bar.stackContext (drops stack-gated)
					//   2. evalTriggerFilter for onHit triggers (G primitive)
					const barEffects = qualifiedEffects.filter((effect) => {
						if (
							evalCondition(
								effect.conditions,
								4,
								new Set(),
								cLevel,
								undefined,
								bar.stackContext,
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
					const buffStart = bar.start + (bar.summonActivatesAt ?? 0) / 60;
					const buffEnd = buffStart + barEffects[0].duration!;
					const effects: MergedEffectDisplay[] = barEffects.map((e) => ({
						stat: e.stat,
						displayValue: formatBuffDisplayValue(
							e.stat,
							e.value,
							0,
							bar.stackContext,
							canonicalHeadlineOf(e)
						)
					}));
					const buffBar: TeamBuffBar = { start: buffStart, end: buffEnd, effects };
					const primaryStat = barEffects[0].stat;
					const existing = rowMap.get(rowKey);
					if (existing) {
						existing.bars.push(buffBar);
					} else {
						rowMap.set(rowKey, {
							characterId: track.characterId,
							primaryStat,
							bars: [buffBar],
							sourceLabel
						});
					}
				}
			}

			// ── afterDuration effects — buff fires when ability duration ends ──
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
				const attribution = qualifiedEffectsAfter[0].attribution;
				const rowKey = `${track.characterId}::char::${abLabel}::afterDuration`;
				const sourceLabel = attribution
					? `${char.displayName} ${attribution}`
					: `${char.displayName} ${abLabel} (end)`;

				for (const bar of abBars) {
					const barEffects = qualifiedEffectsAfter.filter(
						(effect) =>
							evalCondition(
								effect.conditions,
								4,
								new Set(),
								cLevel,
								undefined,
								bar.stackContext,
								baseCtx
							) !== false
					);
					if (barEffects.length === 0) continue;
					const buffStart = bar.start + bar.uptime;
					const buffEnd = buffStart + barEffects[0].duration!;
					const effects: MergedEffectDisplay[] = barEffects.map((e) => ({
						stat: e.stat,
						displayValue: formatBuffDisplayValue(
							e.stat,
							e.value,
							0,
							bar.stackContext,
							canonicalHeadlineOf(e)
						)
					}));
					const buffBar: TeamBuffBar = { start: buffStart, end: buffEnd, effects };
					const primaryStat = barEffects[0].stat;
					const existing = rowMap.get(rowKey);
					if (existing) {
						existing.bars.push(buffBar);
					} else {
						rowMap.set(rowKey, {
							characterId: track.characterId,
							primaryStat,
							bars: [buffBar],
							sourceLabel
						});
					}
				}
			}

			// ── resShred (debuff) dispatch — onCast + onHit + afterDuration ──
			// Mirrors the buff blocks above but for `target: enemy` resShred
			// effects. onCast/onHit fire at cast start (the `summonActivatesAt`
			// offset preserved); afterDuration fires at cast end (`bar.uptime`).
			const resShredStartPool = dedupResShredByElement(
				[...castEffects, ...onHitEffects].filter(resShredBase)
			);
			if (resShredStartPool.length > 0) {
				const rowKey = `${track.characterId}::char::${abLabel}::resShred`;
				const sourceLabel = `${char.displayName} ${abLabel}`;
				const primaryStat = resShredDisplayStat(resShredStartPool[0].element);
				for (const bar of abBars) {
					const filterCtx = resolveCastContext(char, castType, bar);
					const barEffects = resShredStartPool.filter((effect) => {
						if (
							evalCondition(
								effect.conditions,
								4,
								new Set(),
								cLevel,
								undefined,
								bar.stackContext,
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
					const buffStart = bar.start + (bar.summonActivatesAt ?? 0) / 60;
					const buffEnd = buffStart + barEffects[0].duration!;
					const effects: MergedEffectDisplay[] = barEffects.map((e) => ({
						stat: resShredDisplayStat(e.element),
						displayValue: formatResShredDisplayValue(e.value)
					}));
					const buffBar: TeamBuffBar = { start: buffStart, end: buffEnd, effects };
					const existing = rowMap.get(rowKey);
					if (existing) {
						existing.bars.push(buffBar);
					} else {
						rowMap.set(rowKey, {
							characterId: track.characterId,
							primaryStat,
							bars: [buffBar],
							sourceLabel,
							kind: 'debuff'
						});
					}
				}
			}
			const resShredEndPool = dedupResShredByElement(afterDurationEffects.filter(resShredBase));
			if (resShredEndPool.length > 0) {
				const rowKey = `${track.characterId}::char::${abLabel}::afterDuration::resShred`;
				const sourceLabel = `${char.displayName} ${abLabel} (end)`;
				const primaryStat = resShredDisplayStat(resShredEndPool[0].element);
				for (const bar of abBars) {
					const buffStart = bar.start + bar.uptime;
					const buffEnd = buffStart + resShredEndPool[0].duration!;
					const effects: MergedEffectDisplay[] = resShredEndPool.map((e) => ({
						stat: resShredDisplayStat(e.element),
						displayValue: formatResShredDisplayValue(e.value)
					}));
					const buffBar: TeamBuffBar = { start: buffStart, end: buffEnd, effects };
					const existing = rowMap.get(rowKey);
					if (existing) {
						existing.bars.push(buffBar);
					} else {
						rowMap.set(rowKey, {
							characterId: track.characterId,
							primaryStat,
							bars: [buffBar],
							sourceLabel,
							kind: 'debuff'
						});
					}
				}
			}
		}

		// ── N/CA/P onHit effects (input-block class — F2B) ──
		// Mirrors the cast loop above but iterates `track.inputBlocks`. No
		// onCast pool (onCast doesn't fire on N/CA/P). Stack context is not
		// carried on InputBlock — stack-gated effects with `conditions.type:
		// "stacks"` would be excluded; rare for N/CA/P onHit, defer if needed.
		const blockClassPairs: Array<['normal' | 'charged' | 'plunge', string]> = [
			['normal', 'N'],
			['charged', 'CA'],
			['plunge', 'P']
		];
		for (const [blockClass, blockLabel] of blockClassPairs) {
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
				const rowKey = `${track.characterId}::char::${blockLabel}`;
				const sourceLabel = `${char.displayName} ${blockLabel}`;
				for (const block of track.inputBlocks) {
					if (getBlockDamageTag(block) !== blockClass) continue;
					const filterCtx = resolveBlockContext(char, block);
					const barEffects = qualifiedEffects.filter((effect) => {
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
							return false;
						}
						if (effect.trigger.type === 'onHit' && filterCtx) {
							if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
						}
						return true;
					});
					if (barEffects.length === 0) continue;
					const buffStart = block.start + block.duration;
					const buffEnd = buffStart + barEffects[0].duration!;
					const effects: MergedEffectDisplay[] = barEffects.map((e) => ({
						stat: e.stat,
						displayValue: formatBuffDisplayValue(
							e.stat,
							e.value,
							0,
							undefined,
							canonicalHeadlineOf(e)
						)
					}));
					const buffBar: TeamBuffBar = { start: buffStart, end: buffEnd, effects };
					const primaryStat = barEffects[0].stat;
					const existing = rowMap.get(rowKey);
					if (existing) {
						existing.bars.push(buffBar);
					} else {
						rowMap.set(rowKey, {
							characterId: track.characterId,
							primaryStat,
							bars: [buffBar],
							sourceLabel
						});
					}
				}
			}

			// ── resShred (debuff) dispatch on N/CA/P input blocks ──
			// Mirrors the buff block above for `target: enemy` resShred effects.
			const resShredBlockPool = dedupResShredByElement(onHitBlockEffects.filter(resShredBase));
			if (resShredBlockPool.length > 0) {
				const rowKey = `${track.characterId}::char::${blockLabel}::resShred`;
				const sourceLabel = `${char.displayName} ${blockLabel}`;
				const primaryStat = resShredDisplayStat(resShredBlockPool[0].element);
				for (const block of track.inputBlocks) {
					if (getBlockDamageTag(block) !== blockClass) continue;
					const filterCtx = resolveBlockContext(char, block);
					const barEffects = resShredBlockPool.filter((effect) => {
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
						if (effect.trigger.type === 'onHit' && filterCtx) {
							if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
						}
						return true;
					});
					if (barEffects.length === 0) continue;
					const buffStart = block.start + block.duration;
					const buffEnd = buffStart + barEffects[0].duration!;
					const effects: MergedEffectDisplay[] = barEffects.map((e) => ({
						stat: resShredDisplayStat(e.element),
						displayValue: formatResShredDisplayValue(e.value)
					}));
					const buffBar: TeamBuffBar = { start: buffStart, end: buffEnd, effects };
					const existing = rowMap.get(rowKey);
					if (existing) {
						existing.bars.push(buffBar);
					} else {
						rowMap.set(rowKey, {
							characterId: track.characterId,
							primaryStat,
							bars: [buffBar],
							sourceLabel,
							kind: 'debuff'
						});
					}
				}
			}
		}

		// ── onTeamNightsoulBurst effects — fire once per nbBars event ──
		// Global team event: emits buff bars regardless of which character is on
		// field at the NB event time. Stack-context isn't carried (no host cast),
		// so stack-gated effects with `conditions.type: "stacks"` resolve null
		// (preserved into render — they fall back to the placeholder).
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
				const rowKey = `${track.characterId}::char::NB`;
				const sourceLabel = `${char.displayName} NB`;
				for (const nb of nbBars) {
					const buffStart = nb.start;
					const buffEnd = buffStart + qualifiedEffectsNB[0].duration!;
					const effects: MergedEffectDisplay[] = qualifiedEffectsNB.map((e) => ({
						stat: e.stat,
						displayValue: formatBuffDisplayValue(
							e.stat,
							e.value,
							0,
							undefined,
							canonicalHeadlineOf(e)
						)
					}));
					const buffBar: TeamBuffBar = { start: buffStart, end: buffEnd, effects };
					const primaryStat = qualifiedEffectsNB[0].stat;
					const existing = rowMap.get(rowKey);
					if (existing) {
						existing.bars.push(buffBar);
					} else {
						rowMap.set(rowKey, {
							characterId: track.characterId,
							primaryStat,
							bars: [buffBar],
							sourceLabel
						});
					}
				}
			}
		}

		// ── Artifact 4pc effects (onCast only) — source-grouped by artifact ──
		const artifactSetId = loadoutMap[track.characterId]?.artifactSetId;
		// Persisted loadout ids are unvalidated — tolerate a stale/unknown id
		// instead of crashing the teamBuffRows derived.
		const artifactSet = artifactSetId ? getArtifactSetById(artifactSetId) : null;
		if (artifactSet) {
			const allEffects = artifactSet.fourPiece?.effects ?? [];

			// Group qualifying effects by their trigger ability key
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

			const sourceLabel = artifactSet.shortName ?? artifactSet.name;

			for (const [triggerKey, effects] of byTrigger) {
				const barSets: [TimelineBar[], string][] = [];
				if (triggerKey === 'any' || triggerKey === 'skill') barSets.push([track.eBars, 'E']);
				if (triggerKey === 'any' || triggerKey === 'burst') barSets.push([track.qBars, 'Q']);

				const primaryStat = effects[0].stat;

				for (const [bars, abLabel] of barSets) {
					const rowKey = `${track.characterId}::artifact::${artifactSetId}::${triggerKey}::${abLabel}`;
					for (const bar of bars) {
						const buffStart = bar.start + (bar.summonActivatesAt ?? 0) / 60;
						const buffEnd = buffStart + effects[0].duration!;
						const mergedEffects: MergedEffectDisplay[] = effects.map((e) => ({
							stat: e.stat,
							displayValue: formatBuffDisplayValue(
								e.stat,
								e.value,
								0,
								bar.stackContext,
								canonicalHeadlineOf(e)
							)
						}));
						const buffBar: TeamBuffBar = {
							start: buffStart,
							end: buffEnd,
							effects: mergedEffects
						};
						const existing = rowMap.get(rowKey);
						if (existing) {
							existing.bars.push(buffBar);
						} else {
							rowMap.set(rowKey, {
								characterId: track.characterId,
								primaryStat,
								bars: [buffBar],
								sourceLabel
							});
						}
					}
				}
			}

			// ── Artifact 4pc onReaction effects (E3 v1.5 + resShred) ──
			// Driven by the parser's synthetic reaction events. Each event
			// fires a bar at the cast time for `effect.duration`s. Multiple
			// matching events refresh-in-place by appending bars; the
			// renderer's bar-merging logic dedups overlap automatically.
			// Buff bars + resShred (debuff) bars share this dispatch site;
			// resShred uses a synthetic `${element}Res` stat for icon/label
			// lookup and renders with the debuff treatment.
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
					const isDebuff = effect.type === 'resShred';
					const displayStat = isDebuff ? resShredDisplayStat(effect.element) : effect.stat;
					const displayValue = isDebuff
						? formatResShredDisplayValue(effect.value)
						: formatBuffDisplayValue(
								effect.stat,
								effect.value,
								0,
								undefined,
								canonicalHeadlineOf(effect)
							);
					const rowKey = `${track.characterId}::artifact::${artifactSetId}::onReaction::${displayStat}`;
					for (const ev of charReactionEvents) {
						if (!matches(ev.reaction)) continue;
						const buffStart = ev.time;
						const buffEnd = buffStart + effect.duration!;
						const buffBar: TeamBuffBar = {
							start: buffStart,
							end: buffEnd,
							effects: [{ stat: displayStat, displayValue }]
						};
						const existing = rowMap.get(rowKey);
						if (existing) {
							existing.bars.push(buffBar);
						} else {
							rowMap.set(rowKey, {
								characterId: track.characterId,
								primaryStat: displayStat,
								bars: [buffBar],
								sourceLabel,
								kind: isDebuff ? 'debuff' : 'buff'
							});
						}
					}
				}
			}
		}

		// ── Character onReaction effects (E3 v1.5 — buff + resShred) ──
		// Same reaction-event stream that drives the artifact onReaction
		// pass above; here we walk the character's full effect surface
		// (abilities + passives + constellations) for `onReaction` triggers.
		// Unblocks Chevreuse C overload, Citlali Ks/melt-frozen, Durin
		// overload, Nilou bloom (resShred); Kazuha A4 / Sucrose A4 / Baizhu /
		// Tighnari / Fischl / Freminet / Varka onReaction buffs; Linnea C1
		// Field Catalog consumer (uses `trigger.source: 'team'` to fire on
		// any teammate's lunarCrystallize, not just Linnea's own).
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
				// `source: 'team'` opts into firing on any team member's matching
				// reaction (Linnea C1 Field Catalog consumer). Default `'self'`
				// keeps the holder-only scoping that Kazuha A4 / Sucrose A4 etc.
				// rely on.
				const eventPool = trig.source === 'team' ? reactionEvents : ownReactionEvents;
				const isDebuff = effect.type === 'resShred';
				const displayStat = isDebuff ? resShredDisplayStat(effect.element) : effect.stat;
				const displayValue = isDebuff
					? formatResShredDisplayValue(effect.value)
					: formatBuffDisplayValue(
							effect.stat,
							effect.value,
							0,
							undefined,
							canonicalHeadlineOf(effect)
						);
				const rowKey = `${track.characterId}::char::onReaction::${displayStat}`;
				const sourceLabel = `${char.displayName} reaction`;
				for (const ev of eventPool) {
					if (!matches(ev.reaction)) continue;
					const buffStart = ev.time;
					const buffEnd = buffStart + effect.duration!;
					const buffBar: TeamBuffBar = {
						start: buffStart,
						end: buffEnd,
						effects: [{ stat: displayStat, displayValue }]
					};
					const existing = rowMap.get(rowKey);
					if (existing) {
						existing.bars.push(buffBar);
					} else {
						rowMap.set(rowKey, {
							characterId: track.characterId,
							primaryStat: displayStat,
							bars: [buffBar],
							sourceLabel,
							kind: isDebuff ? 'debuff' : 'buff'
						});
					}
				}
			}
		}
	}

	// Carry the rowMap dedup key (unique by construction) onto each row so the
	// keyed {#each} in the template renders with that exact identity. Deriving
	// the each-key from coarser fields (characterId + sourceLabel) collides
	// whenever one character yields multiple rows under one label — e.g.
	// Chevreuse's A4 emits both a Pyro- and an Electro-RES shred on Overloaded,
	// two distinct rows sharing the label "Chevreuse reaction" → Svelte
	// each_key_duplicate (freezes the tool).
	return [...rowMap].map(([key, row]) => ({ ...row, key }));
}
