/**
 * src/lib/timeline/charReceivedBuffRows.ts
 *
 * Per-character received-buff bars: weapon swap procs (TTDS, Widsith — ICD
 * enforced across the swap sequence), active-target ability buffs sliced per
 * on-field window, self-target ability buffs, and onTeamNightsoulBurst
 * self-target dispatches. Keyed by the RECEIVING character; rendered in each
 * character's buff row.
 *
 * Pure — extracted from RotationTimeline.svelte. The character resolver is
 * injected (reactive lazy-load cache in the component, fixtures in tests);
 * weapon lookups stay direct imports (eager, sync).
 *
 * P4: E/Q buff loops consume the parser's `cast` event stream (partitioned
 * per source track by active-span window) instead of walking `track.eBars`/
 * `qBars` geometry. Weapon swap-proc ICD and active-target per-segment slicing
 * stay track-driven (tracks still carry activeStart/activeEnd); N/CA/P loops
 * stay input-block-driven.
 */

import {
	evalCondition,
	type ConditionContext,
	type CharacterTrack,
	type CastEvent,
	type TimelineWindow
} from '$lib/utils/notationParser';
import { evalTriggerFilter } from '$lib/types/ability';
import type { Element } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import type { LoadoutEntry } from '$lib/stores';
import { getWeaponById } from '$lib/data/weaponLookup';
import type {
	BuffEffect,
	CharReceivedBuffBar,
	CharReceivedBuffSubrow,
	DecayParams,
	MergedEffectDisplay,
	RampParams
} from './types';
import { canonicalHeadlineOf, formatBuffDisplayValue } from './buffDisplay';
import {
	getBlockDamageTag,
	getCharacterEffectsForCast,
	getCharacterEffectsForOnHit,
	getCharacterEffectsForTeamNightsoulBurst,
	isActiveTargetOnly,
	resolveBlockContext,
	resolveCastContext
} from './effectCollection';

export function computeCharReceivedBuffRows(
	tracks: CharacterTrack[],
	constellationLevels: Record<string, number>,
	loadoutMap: Record<string, LoadoutEntry>,
	teamFactionCounts: ReadonlyMap<string, number>,
	teamElementCountsByHolder: ReadonlyMap<string, ReadonlyMap<Element, number>>,
	nbBars: ReadonlyArray<{ start: number; cooldown: number }>,
	castEvents: ReadonlyArray<CastEvent>,
	getCharacter: (id: string) => CharacterData | null
): CharReceivedBuffSubrow[] {
	const rowMap = new Map<string, CharReceivedBuffSubrow>();
	const procReadyAt = new Map<string, number>();
	const baseCtx: ConditionContext = { teamFactionCounts };

	// A source track's E/Q casts, partitioned from the rotation-wide `cast`
	// stream by the track's active span [activeStart, nextTrackStart). The
	// parser emits one bar per cast within its track's window, so the
	// time-window split reproduces the legacy per-track `eBars`/`qBars`
	// membership exactly (same equivalence teamBuffRows relies on). Casts
	// carry `fieldStart` (summon offset baked in) + `stackContext`, the only
	// per-cast fields these buff loops read.
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

	function addBar(receiverId: string, bar: CharReceivedBuffBar) {
		const key = `${receiverId}::${bar.sourceLabel}`;
		const existing = rowMap.get(key);
		if (existing) {
			existing.bars.push(bar);
		} else {
			rowMap.set(key, {
				characterId: receiverId,
				sourceLabel: bar.sourceLabel,
				primaryStat: bar.primaryStat,
				bars: [bar]
			});
		}
	}

	function processWeaponEffects(
		triggerType: 'onSwapOut' | 'onSwapIn',
		weapon: ReturnType<typeof getWeaponById>,
		refinementIndex: number,
		receiverId: string,
		holderId: string,
		swapTime: number
	) {
		if (!weapon) return;
		// Collect all matching effects, grouped by ICD key
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

			addBar(receiverId, {
				start: swapTime,
				end: swapTime + first.duration!,
				primaryStat: first.stat,
				effects: effects.map((e) => ({
					stat: e.stat,
					displayValue: formatBuffDisplayValue(
						e.stat,
						e.value,
						refinementIndex,
						undefined,
						canonicalHeadlineOf(e)
					)
				})),
				sourceLabel: weapon.shortName ?? weapon.name,
				isMutuallyExclusive: effects.length > 1,
				procCooldown: icd > 0 ? icd : undefined,
				duration: first.duration!
			});
		}
	}

	for (let i = 0; i < tracks.length - 1; i++) {
		const track = tracks[i];
		const nextTrack = tracks[i + 1];
		// Consecutive segments of the SAME character are one continuous field
		// presence, not a swap (the parser emits one track per notation
		// segment) — no swap-triggered procs fire and no proc ICD is consumed.
		// Same rule the swap connectors already apply.
		if (track.characterId === nextTrack.characterId) continue;
		const swapTime = nextTrack.activeStart;

		// onSwapOut: outgoing character's weapon → buff to incoming character (e.g. TTDS)
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

		// onSwapIn: incoming character's weapon → buff to themselves (e.g. The Widsith)
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
	// Effects with target: "active" skip the team buff row and are sliced per on-field window.
	// Each source ability's buff window is intersected with every track's [activeStart, activeEnd].
	for (let sti = 0; sti < tracks.length; sti++) {
		const sourceTrack = tracks[sti];
		const char = getCharacter(sourceTrack.characterId);
		if (!char) continue;
		const cLevel = constellationLevels[sourceTrack.characterId] ?? 0;

		const { e: eCasts, q: qCasts } = castsForTrack(sti);
		const castPairs: Array<['skill' | 'burst', CastEvent[], string]> = [
			['skill', eCasts, 'E'],
			['burst', qCasts, 'Q']
		];

		for (const [castType, abCasts, abLabel] of castPairs) {
			const onCastList = getCharacterEffectsForCast(char, castType);
			const onHitList = getCharacterEffectsForOnHit(char, castType);
			const seenStats = new Set<string>();
			const activeEffects = [...onCastList, ...onHitList].filter((effect): effect is BuffEffect => {
				if (effect.type !== 'buff') return false;
				if (!isActiveTargetOnly(effect.target)) return false;
				if (effect.duration == null) return false;
				// Universal pre-filter: only drop effects that are *definitively*
				// false at this scope (no segment context yet, so off-field
				// conditions stay null and survive into per-segment evaluation).
				if (
					evalCondition(effect.conditions, 4, new Set(), cLevel, undefined, undefined, baseCtx) ===
					false
				)
					return false;
				if (seenStats.has(effect.stat)) return false;
				seenStats.add(effect.stat);
				return true;
			});
			if (activeEffects.length === 0) continue;

			const sourceLabel = `${char.displayName} ${abLabel}`;

			for (const cast of abCasts) {
				const filterCtx = resolveCastContext(char, castType, cast);
				// Per-cast filter: stack-gated effects against cast.stackContext +
				// onHit-trigger filter eval (G primitive).
				const barEffects = activeEffects.filter((effect) => {
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
				const primaryStat = barEffects[0].stat;
				const mergedEffects: MergedEffectDisplay[] = barEffects.map((e) => ({
					stat: e.stat,
					displayValue: formatBuffDisplayValue(
						e.stat,
						e.value,
						0,
						cast.stackContext,
						canonicalHeadlineOf(e)
					)
				}));
				const firstValue = barEffects[0].value;
				const rampParams: RampParams | undefined =
					typeof firstValue === 'object' && 'type' in firstValue && firstValue.type === 'ramping'
						? {
								startValue: firstValue.startValue,
								stepValue: firstValue.stepValue,
								stepInterval: firstValue.stepInterval,
								cap: firstValue.cap
							}
						: undefined;
				const decayParams: DecayParams | undefined =
					typeof firstValue === 'object' && 'type' in firstValue && firstValue.type === 'decaying'
						? {
								startValue: firstValue.startValue,
								endValue: firstValue.endValue ?? 0,
								duration: barEffects[0].duration!
							}
						: undefined;
				const buffStart = cast.fieldStart;
				const buffEnd = buffStart + barEffects[0].duration!;

				// Collect all segments (one per on-field window that overlaps the buff).
				// Tracks are chronological, so segments are naturally ordered by segStart.
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

					// Per-segment off-field gating: when the receiver IS the source
					// character, the source is on-field; otherwise off-field. Inject
					// the affirmative state into resolvedStates and the inverse into
					// negatedStates so `state: "offField"` (and onField) resolve
					// definitively for this segment. Effects with such conditions
					// that resolve to false are dropped from the segment's bar.
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

					const segMergedEffects: MergedEffectDisplay[] = segEffects.map((e) => ({
						stat: e.stat,
						displayValue: formatBuffDisplayValue(
							e.stat,
							e.value,
							0,
							cast.stackContext,
							canonicalHeadlineOf(e)
						)
					}));
					const segPrimaryStat = segEffects[0].stat;
					// If the per-segment filter didn't drop anything, use the merged
					// pre-segment effect list for visual consistency. Otherwise the
					// segment-specific list (which may be a subset).
					const useSegList = segEffects.length !== barEffects.length;

					addBar(receiverId, {
						start: segStart,
						end: isLast ? buffEnd : segEnd,
						primaryStat: useSegList ? segPrimaryStat : primaryStat,
						effects: useSegList ? segMergedEffects : mergedEffects,
						sourceLabel,
						isMutuallyExclusive: false,
						duration: buffEnd - buffStart,
						...(rampParams ? { buffStart, rampParams } : {}),
						...(decayParams ? { buffStart, decayParams } : {})
					});
				}
			}
		}

		// ── N/CA/P onHit active-target effects (input-block class — F2B) ──
		const blockClassPairs: Array<['normal' | 'charged' | 'plunge', string]> = [
			['normal', 'N'],
			['charged', 'CA'],
			['plunge', 'P']
		];
		for (const [blockClass, blockLabel] of blockClassPairs) {
			const onHitBlockList = getCharacterEffectsForOnHit(char, blockClass);
			if (onHitBlockList.length === 0) continue;
			const seenStats = new Set<string>();
			const activeEffects = onHitBlockList.filter((effect): effect is BuffEffect => {
				if (effect.type !== 'buff') return false;
				if (!isActiveTargetOnly(effect.target)) return false;
				if (effect.duration == null) return false;
				if (
					evalCondition(effect.conditions, 4, new Set(), cLevel, undefined, undefined, baseCtx) ===
					false
				)
					return false;
				if (seenStats.has(effect.stat)) return false;
				seenStats.add(effect.stat);
				return true;
			});
			if (activeEffects.length === 0) continue;
			const sourceLabel = `${char.displayName} ${blockLabel}`;
			for (const block of sourceTrack.inputBlocks) {
				if (getBlockDamageTag(block) !== blockClass) continue;
				const filterCtx = resolveBlockContext(char, block);
				const barEffects = activeEffects.filter((effect) => {
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
				const primaryStat = barEffects[0].stat;
				const mergedEffects: MergedEffectDisplay[] = barEffects.map((e) => ({
					stat: e.stat,
					displayValue: formatBuffDisplayValue(
						e.stat,
						e.value,
						0,
						undefined,
						canonicalHeadlineOf(e)
					)
				}));
				const buffStart = block.start + block.duration;
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
								undefined,
								segCtx
							) !== false
					);
					if (segEffects.length === 0) continue;
					const segMergedEffects: MergedEffectDisplay[] = segEffects.map((e) => ({
						stat: e.stat,
						displayValue: formatBuffDisplayValue(
							e.stat,
							e.value,
							0,
							undefined,
							canonicalHeadlineOf(e)
						)
					}));
					const segPrimaryStat = segEffects[0].stat;
					const useSegList = segEffects.length !== barEffects.length;
					addBar(receiverId, {
						start: segStart,
						end: isLast ? buffEnd : segEnd,
						primaryStat: useSegList ? segPrimaryStat : primaryStat,
						effects: useSegList ? segMergedEffects : mergedEffects,
						sourceLabel,
						isMutuallyExclusive: false,
						duration: buffEnd - buffStart
					});
				}
			}
		}
	}

	// ── Self-target ability buff ──
	// Effects with target: "self" apply only to the caster for the full buff duration,
	// shown as a bar on that character's individual received-buff row.
	// Includes onTeamNightsoulBurst self-target effects (Mavuika A1, Varesa A4,
	// Xilonen A2, Ifa A1) — fire from each nbBars event regardless of field state.
	// NB dispatch is character-scoped (rotation-wide nbBars pool), so it runs
	// on the character's FIRST track only — per-track would duplicate every
	// bar when a character appears in multiple segments.
	const nbSelfDispatched = new Set<string>();
	for (let sti = 0; sti < tracks.length; sti++) {
		const sourceTrack = tracks[sti];
		const char = getCharacter(sourceTrack.characterId);
		if (!char) continue;
		const firstTrackOfChar = !nbSelfDispatched.has(sourceTrack.characterId);
		nbSelfDispatched.add(sourceTrack.characterId);
		const cLevel = constellationLevels[sourceTrack.characterId] ?? 0;

		const { e: eCasts, q: qCasts } = castsForTrack(sti);
		const selfCastPairs: Array<['skill' | 'burst', CastEvent[], string]> = [
			['skill', eCasts, 'E'],
			['burst', qCasts, 'Q']
		];

		for (const [castType, abCasts, abLabel] of selfCastPairs) {
			const onCastSelf = getCharacterEffectsForCast(char, castType);
			const onHitSelf = getCharacterEffectsForOnHit(char, castType);
			const seenStats = new Set<string>();
			// Self-target buffs apply to the source character themselves; for
			// purposes of state resolution the source is always "on-field" in
			// these segments (you can't self-buff while off-field). Inject
			// onField/¬offField so a self-buff with `state: "offField"` is
			// definitively dropped rather than rendering on a window that
			// doesn't actually qualify.
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

			const sourceLabel = `${char.displayName} ${abLabel}`;

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
				const primaryStat = barEffects[0].stat;
				const mergedEffects: MergedEffectDisplay[] = barEffects.map((e) => ({
					stat: e.stat,
					displayValue: formatBuffDisplayValue(
						e.stat,
						e.value,
						0,
						cast.stackContext,
						canonicalHeadlineOf(e)
					)
				}));
				const buffStart = cast.fieldStart;
				const buffEnd = buffStart + barEffects[0].duration!;
				addBar(sourceTrack.characterId, {
					start: buffStart,
					end: buffEnd,
					primaryStat,
					effects: mergedEffects,
					sourceLabel,
					isMutuallyExclusive: false,
					duration: buffEnd - buffStart
				});
			}
		}

		// ── N/CA/P onHit self-target effects (input-block class — F2B) ──
		const blockClassPairs: Array<['normal' | 'charged' | 'plunge', string]> = [
			['normal', 'N'],
			['charged', 'CA'],
			['plunge', 'P']
		];
		const selfResolvedBlock = new Set<string>(['onField']);
		const selfNegatedBlock = new Set<string>(['offField']);
		const selfCtxBlock: ConditionContext = {
			teamFactionCounts,
			negatedStates: selfNegatedBlock,
			teamElementCounts: teamElementCountsByHolder.get(char.id)
		};
		for (const [blockClass, blockLabel] of blockClassPairs) {
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
			const sourceLabel = `${char.displayName} ${blockLabel}`;
			for (const block of sourceTrack.inputBlocks) {
				if (getBlockDamageTag(block) !== blockClass) continue;
				const filterCtx = resolveBlockContext(char, block);
				const barEffects = selfEffects.filter((effect) => {
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
					if (effect.trigger.type === 'onHit' && filterCtx) {
						if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
					}
					return true;
				});
				if (barEffects.length === 0) continue;
				const primaryStat = barEffects[0].stat;
				const mergedEffects: MergedEffectDisplay[] = barEffects.map((e) => ({
					stat: e.stat,
					displayValue: formatBuffDisplayValue(
						e.stat,
						e.value,
						0,
						undefined,
						canonicalHeadlineOf(e)
					)
				}));
				const buffStart = block.start + block.duration;
				const buffEnd = buffStart + barEffects[0].duration!;
				addBar(sourceTrack.characterId, {
					start: buffStart,
					end: buffEnd,
					primaryStat,
					effects: mergedEffects,
					sourceLabel,
					isMutuallyExclusive: false,
					duration: buffEnd - buffStart
				});
			}
		}

		// ── onTeamNightsoulBurst self-target effects ──
		// Fire once per nbBars event, regardless of whether the source character
		// is on field at that time (NB is a global team event in-game). The
		// receiver is the source character themselves.
		const nbSelfPool = getCharacterEffectsForTeamNightsoulBurst(char);
		if (firstTrackOfChar && nbBars.length > 0 && nbSelfPool.length > 0) {
			const seenStatsNB = new Set<string>();
			const selfEffectsNB = nbSelfPool.filter((effect): effect is BuffEffect => {
				if (effect.type !== 'buff') return false;
				if (effect.target !== 'self') return false;
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
			if (selfEffectsNB.length > 0) {
				const sourceLabel = `${char.displayName} NB`;
				const primaryStat = selfEffectsNB[0].stat;
				const mergedEffects: MergedEffectDisplay[] = selfEffectsNB.map((e) => ({
					stat: e.stat,
					displayValue: formatBuffDisplayValue(
						e.stat,
						e.value,
						0,
						undefined,
						canonicalHeadlineOf(e)
					)
				}));
				for (const nb of nbBars) {
					const buffStart = nb.start;
					const buffEnd = buffStart + selfEffectsNB[0].duration!;
					addBar(sourceTrack.characterId, {
						start: buffStart,
						end: buffEnd,
						primaryStat,
						effects: mergedEffects,
						sourceLabel,
						isMutuallyExclusive: false,
						duration: buffEnd - buffStart
					});
				}
			}
		}
	}

	return [...rowMap.values()];
}

// ---------------------------------------------------------------------------
// Projection from parser buff windows (post-P4 #5 phase 4 — dark launch).
// Received-surface windows carry a concrete `receiverId`; this projection
// rebuilds the legacy `${receiverId}::${sourceLabel}` row grouping and
// formats display strings. Byte-identity with `computeCharReceivedBuffRows`
// is guarded by the corpus parity test until the phase-5 flip.
// ---------------------------------------------------------------------------

type BuffWindow = Extract<TimelineWindow, { kind: 'buff' }>;

const AB_LABEL = { skill: 'E', burst: 'Q', normal: 'N', charged: 'CA', plunge: 'P' } as const;

export function projectCharReceivedBuffRows(
	windows: ReadonlyArray<TimelineWindow>,
	getCharacter: (id: string) => CharacterData | null
): CharReceivedBuffSubrow[] {
	const buffWins = windows
		.filter((w): w is BuffWindow => w.kind === 'buff' && w.receiverId !== undefined)
		.sort((a, b) => a.id - b.id);
	const rowMap = new Map<string, CharReceivedBuffSubrow>();

	for (const w of buffWins) {
		const src = w.source;
		let sourceLabel: string;
		if (src.type === 'weapon') {
			const weapon = getWeaponById(src.weaponId);
			sourceLabel = weapon?.shortName ?? weapon?.name ?? src.weaponId;
		} else if (src.type === 'character' && src.trigger === 'nightsoulBurst') {
			const char = getCharacter(w.characterId);
			sourceLabel = `${char?.displayName ?? w.characterId} NB`;
		} else if (src.type === 'character') {
			const char = getCharacter(w.characterId);
			sourceLabel = `${char?.displayName ?? w.characterId} ${AB_LABEL[src.abilityClass!]}`;
		} else {
			continue; // artifact windows are team-surface only
		}

		const effects: MergedEffectDisplay[] = (w.effects as BuffEffect[]).map((e) => ({
			stat: e.stat,
			displayValue: formatBuffDisplayValue(
				e.stat,
				e.value,
				w.refinementIndex ?? 0,
				w.stackContext,
				canonicalHeadlineOf(e)
			)
		}));

		const bar: CharReceivedBuffBar = {
			start: w.start,
			end: w.end,
			primaryStat: (w.effects[0] as BuffEffect).stat,
			effects,
			sourceLabel,
			isMutuallyExclusive: w.isMutuallyExclusive ?? false,
			...(w.procCooldown !== undefined ? { procCooldown: w.procCooldown } : {}),
			duration: w.duration!,
			...(w.rampParams ? { buffStart: w.buffStart!, rampParams: w.rampParams } : {}),
			...(w.decayParams ? { buffStart: w.buffStart!, decayParams: w.decayParams } : {})
		};

		const key = `${w.receiverId}::${sourceLabel}`;
		const existing = rowMap.get(key);
		if (existing) {
			existing.bars.push(bar);
		} else {
			rowMap.set(key, {
				characterId: w.receiverId!,
				sourceLabel,
				primaryStat: bar.primaryStat,
				bars: [bar]
			});
		}
	}

	return [...rowMap.values()];
}
