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
import type {
	CastEvent,
	ReactionEvent,
	StackThresholdEvent,
	TimelineWindow
} from '$lib/utils/rotationEvents';
import { evalTriggerFilter, type TriggerFilterContext } from '$lib/types/ability';
import type { Effect, Element, Reaction } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import type { LoadoutEntry } from '$lib/stores';
import { getArtifactSetById } from '$lib/data/artifactLookup';
import { getWeaponById } from '$lib/data/weaponLookup';
import { framesOf } from '$lib/utils/frames';
import { buildStateIndex, type StatesAt } from '$lib/utils/stateIndex';
import {
	getCharacterEffectsForAfterDuration,
	getCharacterEffectsForCast,
	getCharacterEffectsForOnHit,
	getCharacterEffectsForOnReaction,
	getCharacterEffectsForOnStack,
	getCharacterEffectsForOnState,
	getCharacterEffectsForTeamHit,
	getCharacterEffectsForTeamNightsoulBurst,
	factionProvenanceOf,
	type FactionProvenance,
	isActiveTargetOnly,
	resolveCastContext,
	castLandsNoHit,
	effectSourcesAtConstellation,
	normalizeBuffLikeEffect,
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
	/** The parser's `stackThreshold` events — what an `onStack` buff anchors
	 *  on, the way NB buffs anchor on `nbBars` (stack-threshold round,
	 *  2026-09-18). */
	stackFires: readonly StackThresholdEvent[];
	/** The parser's authored state/summon windows (afterDuration span join). */
	windows: readonly TimelineWindow[];
	/** Which `summon` windows are their cast's PRIMARY summon — what
	 *  `duringSummon` means. See `buildStateIndex`. */
	primarySummonWindows: ReadonlySet<TimelineWindow>;
	constellationLevels: Record<string, number>;
	loadoutMap: Record<string, LoadoutEntry>;
	teamFactionCounts: ReadonlyMap<string, number>;
	/** Reactions the party enables (Stellar model) — resolves
	 *  `teamEnablesReaction` conditions in every buff-window context. */
	teamEnabledReactions: ReadonlySet<string>;
	teamElementCountsByHolder: ReadonlyMap<string, ReadonlyMap<Element, number>>;
	getCharacter: (id: string) => CharacterData | null;
	/** Every change to a rotation-scoped stack count, `holderId::key` → steps in
	 *  time order (`SimContext.stackHistory`) — what a `whileStacks` buff IS. */
	stackHistory?: ReadonlyMap<string, readonly { at: number; count: number }[]>;
};

export function deriveBuffWindows(input: BuffWindowInput): BuffWindow[] {
	const {
		tracks,
		hits,
		castEvents,
		reactionEvents,
		nbBars,
		stackFires,
		windows,
		primarySummonWindows,
		constellationLevels,
		loadoutMap,
		teamFactionCounts,
		teamEnabledReactions,
		teamElementCountsByHolder,
		getCharacter,
		stackHistory
	} = input;

	const out: BuffWindow[] = [];
	let nextId = 0;

	// ⚓⚓ THE HOLDER'S STATES AT THE EVENT (state-gates round, §1.G — 2026-09-19).
	//
	// Every per-EVENT condition pass below — a cast, a hit, a tick, a reaction, a
	// threshold fire — evaluates with the states the holder was in at that
	// instant, read off the parse's own final windows (`stateIndex.ts`, which
	// holds the closed-world rule and the self-opened-state rule). Until this a
	// `state` gate was `null` at every site and a pool keeps a `null`, so a buff
	// gated on `inStance` / `duringSummon` / `nightsoulBlessing` drew with the
	// state down.
	//
	// ⚓ THE GATE IS AN ENTRY TEST, at the event. Every state-gated effect that
	// reaches this pass carries its own `duration` (census 2026-09-19), so the
	// state decides whether the buff STARTS and the duration decides how long it
	// runs — Iansan's 15s ATK outlives her 9s Blessing, and that is the kit.
	//
	// ⚠️ THE POOL PREFILTERS STAY STATELESS, on purpose. They run once per token,
	// before any event exists, and drop only a definitive `false`; with no states
	// a `state` gate is `null` there and the effect rides on to the per-event
	// pass, which is where it is decided. ⛔ Don't hand them a state set — there
	// is no instant to read it at. The same goes for the `afterDuration`,
	// Nightsoul-Burst and `onState` sites: no state gate sits on one today, and
	// each would need its own answer to "which instant".
	//
	// ⚠️ `field` is the holder's on/off-field fact for the scopes that know it
	// (the self sites, the per-receiver slices) — it joins the same two sets.
	const stateIndex = buildStateIndex(windows, getCharacter, primarySummonWindows);
	type Gate = { resolved: ReadonlySet<string>; ctx: ConditionContext };
	const gateFor = (base: ConditionContext, st: StatesAt, field?: 'onField' | 'offField'): Gate => {
		if (field === undefined) {
			if (st.negated.size === 0) return { resolved: st.active, ctx: base };
			return { resolved: st.active, ctx: { ...base, negatedStates: st.negated } };
		}
		return {
			resolved: new Set([...st.active, field]),
			ctx: {
				...base,
				negatedStates: new Set([...st.negated, field === 'onField' ? 'offField' : 'onField'])
			}
		};
	};
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

	// ⚓⚓ ONE WINDOW PER (PROVENANCE, DURATION) — the pool round, 2026-09-17.
	//
	// Every cast-shaped site used to compute its span from `barEffects[0]`, so a
	// pool holding a 12s ATK buff and a 15s ATK% buff drew BOTH to whichever was
	// authored first (measured: Iansan's C2 +ATK% cut 15 → 12s on the receiver;
	// Skirk's C2 +ATK% cut 12.5 → 2.6s on herself). The faction split above is
	// the precedent — a pool is one span, so anything that changes the span
	// splits the pool — and the artifact `onHit` branch already partitions by
	// `(debuff, duration)` for the same reason. This is that rule for every
	// site: after the per-event filter, split the survivors by `duration`
	// (first-seen order, so ids and the row order stay deterministic) and emit
	// one window per part. Two parts from one cast share one ROW (the row key
	// is the source), and the projection draws them as ONE bar with a SEAM
	// where the shorter part ends (⚓ Nate 2026-09-17; fallback: one row per
	// duration).
	//
	// ⚓⚓ AND THE STAT DEDUPE MOVES AFTER THE PER-EVENT CONDITIONS (§1.H). It
	// ran at pool construction, where a `stacks` gate is unresolvable (the
	// stack snapshot is the CAST's, or the HIT's), so tiers of one stat
	// collapsed to whichever was authored first — Neuvillette A1, Navia A4,
	// Varesa A1 — and Iansan's tier ORDER was load-bearing. Now the per-event
	// pass evaluates every tier with the event's snapshot, and the dedupe keeps
	// the first SURVIVOR. ⚠️ Strictly a superset of the old rule: where a gate is
	// still unresolvable at the event (a `state` gate, §1.G) the first-authored
	// tier still wins, exactly as before. ⚠️ The received-surface note that
	// said "supply the context, never reorder the dedupe" was about a gate the
	// CONTEXT could answer (team element counts); a stack gate is answerable
	// only per event, and this is the ordering that lets it be.
	const dedupByStat = <T extends BuffEffect>(effects: readonly T[]): T[] => {
		const seen = new Set<string>();
		return effects.filter((effect) => {
			if (seen.has(effect.stat)) return false;
			seen.add(effect.stat);
			return true;
		});
	};
	/** ⚓ An `onHit` effect's own `procCooldown` on a per-swing surface (Mirrors
	 *  round, 2026-10-30): a landing inside it does not fire. The hit pass and the
	 *  cast pools already kept it; the block surfaces drew one bar per landing, so
	 *  Alhaitham's A1-gated C2 stack drew twice off one Charged Attack's two hits.
	 *  The clock is per surface and per track, like `lastWinByDur` beside it. */
	const cooldownOpen = (ready: Map<Effect, number>, effect: Effect, t: number): boolean =>
		t >= (ready.get(effect) ?? -Infinity);
	const stampCooldowns = (
		ready: Map<Effect, number>,
		fired: readonly Effect[],
		t: number
	): void => {
		for (const fx of fired)
			if (typeof fx.procCooldown === 'number') ready.set(fx, t + framesOf(fx.procCooldown));
	};
	/** Splits a per-event effect list by `duration` (and `opensAfter`, which
	 *  moves a part's start), first-seen order. Every effect that reaches this has
	 *  a duration (the pool prefilters demand one), so `part[0].duration!` is the
	 *  part's span. */
	const partitionByDuration = <T extends Effect>(effects: readonly T[]): T[][] => {
		if (effects.length < 2) return effects.length ? [[...effects]] : [];
		const parts: T[][] = [];
		const byDur = new Map<string, T[]>();
		for (const fx of effects) {
			const f = fx as { duration?: number; opensAfter?: number };
			const d = `${f.duration ?? -1}|${f.opensAfter ?? 0}`;
			let p = byDur.get(d);
			if (!p) {
				p = [];
				byDur.set(d, p);
				parts.push(p);
			}
			p.push(fx);
		}
		return parts;
	};

	// ⚓ A CAST POOL'S PARTS, EACH WITH ITS ANCHOR (cast hit-record round,
	// 2026-09-21). One pool holds a cast's `onCast` AND `onHit` effects; the first
	// open where they always did (`fieldStart`), the second where the cast's first
	// hit LANDS (`CastEvent.firstHitAt` — the instant the live hit record fires
	// at, published by the parse so no second resolution of the variant's
	// `application[]` happens here). ⚠️ Split by anchor only where the two
	// instants genuinely differ, so a cast that states no landing — unmeasured, or
	// a hit at Durability 0 — draws exactly the windows it drew before.
	//
	// ↻ AND EVERY LATER LANDING REFRESHES IT (every-landing round, same day): an
	// `onHit` part spans first landing → last landing + duration, which `extend`
	// carries to the site. A landing the part's `procCooldown` refuses does not
	// refresh; a gap longer than the duration closes the window and opens another.
	const partitionCastPool = <T extends Effect>(
		effects: readonly T[],
		cast: CastEvent
	): Array<{ anchor: number; extend: number; part: T[] }> => {
		// ⚓ A part that OPENS LATER (`BuffEffect.opensAfter`, Mirrors round,
		// 2026-10-30) anchors that long after the cast, and only if its holder is on
		// field then — gcsim's burst refill and C4's gain return when he is not.
		const atCast = (part: T[]): Array<{ anchor: number; extend: number; part: T[] }> => {
			const delay = (part[0] as { opensAfter?: number }).opensAfter;
			if (delay === undefined) return [{ anchor: cast.fieldStart, extend: 0, part }];
			const at = cast.time + framesOf(delay);
			return onFieldAt(at) === cast.characterId ? [{ anchor: at, extend: 0, part }] : [];
		};
		const hitsAt = cast.hitsAt;
		if (hitsAt === undefined || (hitsAt.length === 1 && hitsAt[0] === cast.fieldStart))
			return partitionByDuration(effects).flatMap(atCast);
		const onHit = effects.filter((fx) => fx.trigger.type === 'onHit');
		const rest = effects.filter((fx) => fx.trigger.type !== 'onHit');
		const out = partitionByDuration(rest).flatMap(atCast);
		for (const part of partitionByDuration(onHit)) {
			const head = part[0] as { duration?: number; procCooldown?: unknown };
			const dur = framesOf(head.duration ?? 0);
			const pcd = typeof head.procCooldown === 'number' ? framesOf(head.procCooldown) : 0;
			let start = hitsAt[0];
			let last = start;
			for (const h of hitsAt.slice(1)) {
				if (h - last < pcd) continue;
				if (h > last + dur) {
					out.push({ anchor: start, extend: last - start, part });
					start = h;
				}
				last = h;
			}
			out.push({ anchor: start, extend: last - start, part });
		}
		return out;
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
	/**
	 * Whether `effect` fires off `ev`, by the HOLDER's states when the reaction
	 * happened (§1.G). The pool prefilter has already dropped everything the
	 * static context refuses; this is the per-event half, which the reaction
	 * sites did not have at all — Citlali's A1 shred drew off any melt, Itzpapa
	 * or no Itzpapa. One `Gate` per (holder, event), since a kit fires several
	 * effects off one reaction.
	 */
	const makeReactionGate = (holderId: string, cLevel: number, base: ConditionContext) => {
		const gates = new Map<ReactionEvent, Gate>();
		return (effect: Effect, ev: ReactionEvent): boolean => {
			if (effect.conditions === undefined) return true;
			let gate = gates.get(ev);
			if (!gate) {
				gate = gateFor(base, stateIndex.at(holderId, ev.time));
				gates.set(ev, gate);
			}
			return (
				evalCondition(
					effect.conditions,
					4,
					gate.resolved,
					cLevel,
					undefined,
					undefined,
					gate.ctx
				) !== false
			);
		};
	};

	/**
	 * The reaction events an `onReaction` trigger listens to, by its `source`.
	 * ⚓ `'active'` is every reaction the CONTROLLED character caused with their
	 * own cast or swing — whoever that is — so it is the whole stream minus the
	 * entity-delivered ones, ⛔ never an id comparison (a tick carries its
	 * owner's id). Until 2026-09-19 it fell through to the holder's own events,
	 * so Qiqi's A1 ("a character under the effects of Herald of Frost triggers
	 * an Elemental Reaction") drew for nobody but Qiqi.
	 */
	const reactionEventsFor = (
		source: 'self' | 'team' | 'active' | 'others' | undefined,
		own: readonly ReactionEvent[]
	): readonly ReactionEvent[] =>
		source === 'team'
			? reactionEvents
			: source === 'active'
				? reactionEvents.filter((ev) => ev.viaEntity !== true)
				: source === 'others'
					? reactionEvents.filter((ev) => !own.includes(ev))
					: own;

	const reactionEventIndex = new Map<ReactionEvent, number>(
		reactionEvents.map((ev, i) => [ev, i] as const)
	);
	/** `reactorId` — who triggered the pool's reaction (one event per pool: the
	 *  key leads with the event's index), for a `'reactor'`-target buff. */
	type ReactionPool = {
		start: number;
		end: number;
		debuff: boolean;
		effects: Effect[];
		reactorId: string;
	};
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
					pool = { start, end, debuff, effects: [], reactorId: ev.characterId };
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
		const firesAt = makeReactionGate(holderId, cLevel, ctx);
		for (const effect of qualified) {
			const trig = effect.trigger as {
				reaction: Reaction | Reaction[] | 'any';
				source?: 'self' | 'team' | 'active' | 'others';
			};
			const trigReaction = trig.reaction;
			const matches = (r: Reaction): boolean =>
				trigReaction === 'any' ||
				(Array.isArray(trigReaction) ? trigReaction.includes(r) : trigReaction === r);
			for (const ev of reactionEventsFor(trig.source, ownEvents)) {
				if (matches(ev.reaction) && firesAt(effect, ev)) pooler.add(ev, effect);
			}
		}
		return pooler.pools;
	};

	// ── stack-threshold fires (stack-threshold round, 2026-09-18) ──
	//
	// ⚓ A FIRE IS AN ANCHOR LIKE AN NB FIRE: cast-like, start = the instant,
	// end = + duration, once per fire, for the HOLDER's own `onStack` effects.
	// The `dominant` gate is per fire — Columbina's C2 gives ATK, EM or DEF by
	// which Lunar kind held the most Gravity — so the effect list is filtered per
	// event and deduped by stat AFTER that (the buff-pool round's §1.H order),
	// then partitioned by duration. Three sites call this (team, active, self)
	// with their own target filter, exactly the split every other trigger has.
	type FirePool = { fire: StackThresholdEvent; effects: BuffEffect[] };
	const stackFirePoolsFor = (
		char: CharacterData,
		holderId: string,
		cLevel: number,
		ctx: ConditionContext,
		qualifies: (e: BuffEffect) => boolean
	): FirePool[] => {
		const fires = stackFires.filter((f) => f.characterId === holderId);
		if (fires.length === 0) return [];
		const effects = getCharacterEffectsForOnStack(char, cLevel).filter((e): e is BuffEffect => {
			if (e.type !== 'buff') return false;
			if (e.duration == null) return false;
			if (!qualifies(e)) return false;
			return evalCondition(e.conditions, 4, new Set(), cLevel, undefined, undefined, ctx) !== false;
		});
		if (effects.length === 0) return [];
		const pools: FirePool[] = [];
		for (const fire of fires) {
			const gate = gateFor(ctx, stateIndex.at(holderId, fire.time));
			const qualified = dedupByStat(
				effects.filter((e) => {
					const dominant = (e.trigger as { dominant?: string }).dominant;
					if (dominant !== undefined && dominant !== fire.dominant) return false;
					return (
						evalCondition(
							e.conditions,
							4,
							gate.resolved,
							cLevel,
							undefined,
							fire.stackContext,
							gate.ctx
						) !== false
					);
				})
			);
			for (const part of partitionByDuration(qualified)) pools.push({ fire, effects: part });
		}
		return pools;
	};
	const fireSource = (
		fire: StackThresholdEvent
	): Extract<BuffWindow['source'], { type: 'character' }> => ({
		type: 'character',
		trigger: 'stackThreshold',
		...(fire.abilityClass !== undefined ? { abilityClass: fire.abilityClass } : {}),
		...(fire.label !== undefined ? { fireLabel: fire.label } : {})
	});

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
	/** Every hit in the rotation, in time order — the summon-tick hits are
	 *  appended at finalize rather than merged, so the sort is required. */
	let sortedHits: HitEvent[] | undefined;
	const hitsByTime = (): HitEvent[] =>
		(sortedHits ??= hits.slice().sort((a, b) => a.time - b.time));
	/** Who was on field at `time` (tracks are in segment order). */
	const onFieldAt = (time: number): string | undefined => {
		let id: string | undefined;
		for (const t of tracks) {
			if (t.activeStart > time) break;
			id = t.characterId;
		}
		return id;
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
			// ⚠️ The pools are UNDEDUPED (pool round): the stat / element dedupe
			// runs per cast, after that cast's conditions — see `dedupByStat`.
			const poolCache = new Map<string, CastPools>();
			// Keyed by the RESOLVED ability too (2026-09-19): an effect hosted on a
			// skill fires only for casts of that skill — see `hostedElsewhere`.
			const poolsFor = (label: string, abilityId: string): CastPools => {
				const key = `${abilityId}|${label}`;
				const hit = poolCache.get(key);
				if (hit) return hit;
				const merged = [
					...getCharacterEffectsForCast(char, cLevel, castType, label, abilityId),
					...getCharacterEffectsForOnHit(char, cLevel, castType, label, abilityId)
				];
				const built: CastPools = {
					qualified: byProvenance(merged.filter(universalPool)),
					resShred: byProvenance(merged.filter(resShredBase)),
					afterDuration: byProvenance(
						getCharacterEffectsForAfterDuration(char, cLevel, castType, label, abilityId)
					)
				};
				poolCache.set(key, built);
				return built;
			};

			{
				for (const cast of abCasts) {
					const filterCtx = resolveCastContext(char, castType, cast);
					// A non-hitting cast anchors no `onHit` effect (non-hitting casts round,
					// 2026-09-16); its `onCast` effects in the same pool are untouched.
					const castNoHit = castLandsNoHit(char, castType, cast);
					const gate = gateFor(baseCtx, stateIndex.at(track.characterId, cast.time, cast.id));
					for (const group of poolsFor(cast.label, cast.abilityId).qualified) {
						const qualifiedEffects = group.effects;
						if (qualifiedEffects.length === 0) continue;
						const barEffects = dedupByStat(
							qualifiedEffects.filter((effect) => {
								if (
									evalCondition(
										effect.conditions,
										4,
										gate.resolved,
										cLevel,
										undefined,
										cast.stackContext,
										gate.ctx
									) === false
								) {
									return false;
								}
								if (effect.trigger.type === 'onHit' && castNoHit) return false;
								if (effect.trigger.type === 'onHit' && filterCtx) {
									if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
								}
								return true;
							})
						);
						for (const { anchor, extend, part } of partitionCastPool(barEffects, cast)) {
							const buffStart = anchor;
							const buffEnd = buffStart + framesOf(part[0].duration!) + extend;
							emit({
								characterId: track.characterId,
								start: buffStart,
								end: buffEnd,
								effects: part,
								stackContext: cast.stackContext,
								sourceCastId: cast.id,
								source: { type: 'character', trigger: 'cast', abilityClass: castType }
							});
						}
					}
				}
			}

			// ── afterDuration buffs ──
			const qualifiedAfterFor = (effects: Effect[]): BuffEffect[] =>
				effects.filter((effect): effect is BuffEffect => {
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
				});
			{
				for (const cast of abCasts) {
					for (const group of poolsFor(cast.label, cast.abilityId).afterDuration) {
						const qualifiedEffectsAfter = qualifiedAfterFor(group.effects);
						if (qualifiedEffectsAfter.length === 0) continue;
						const barEffects = dedupByStat(
							qualifiedEffectsAfter.filter(
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
							)
						);
						for (const part of partitionByDuration(barEffects)) {
							const buffStart = afterDurationStart(cast);
							const buffEnd = buffStart + framesOf(part[0].duration!);
							emit({
								characterId: track.characterId,
								start: buffStart,
								end: buffEnd,
								effects: part,
								stackContext: cast.stackContext,
								poolFirstEffect: qualifiedEffectsAfter[0],
								sourceCastId: cast.id,
								source: { type: 'character', trigger: 'afterDuration', abilityClass: castType }
							});
						}
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
					const gate = gateFor(baseCtx, stateIndex.at(track.characterId, cast.time, cast.id));
					for (const group of poolsFor(cast.label, cast.abilityId).resShred) {
						const resShredStartPool = group.effects;
						if (resShredStartPool.length === 0) continue;
						const barEffects = dedupResShredByElement(
							resShredStartPool.filter((effect) => {
								if (
									evalCondition(
										effect.conditions,
										4,
										gate.resolved,
										cLevel,
										undefined,
										cast.stackContext,
										gate.ctx
									) === false
								)
									return false;
								if (effect.trigger.type === 'onHit' && castNoHit) return false;
								if (effect.trigger.type === 'onHit' && filterCtx) {
									if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
								}
								return true;
							})
						);
						for (const { anchor, extend, part } of partitionCastPool(barEffects, cast)) {
							const buffStart = anchor;
							const buffEnd = buffStart + framesOf(part[0].duration!) + extend;
							emit({
								characterId: track.characterId,
								start: buffStart,
								end: buffEnd,
								debuff: true,
								effects: part,
								poolFirstEffect: resShredStartPool[0],
								sourceCastId: cast.id,
								source: { type: 'character', trigger: 'cast', abilityClass: castType }
							});
						}
					}
				}
			}

			// ── resShred (debuff): afterDuration at cast end — no per-bar filter ──
			{
				for (const cast of abCasts) {
					for (const group of poolsFor(cast.label, cast.abilityId).afterDuration) {
						const resShredEndPool = dedupResShredByElement(group.effects.filter(resShredBase));
						for (const part of partitionByDuration(resShredEndPool)) {
							const buffStart = afterDurationStart(cast);
							const buffEnd = buffStart + framesOf(part[0].duration!);
							emit({
								characterId: track.characterId,
								start: buffStart,
								end: buffEnd,
								debuff: true,
								effects: part,
								sourceCastId: cast.id,
								source: { type: 'character', trigger: 'afterDuration', abilityClass: castType }
							});
						}
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
				const qualifiedEffects = blockGroup.effects.filter((effect): effect is BuffEffect => {
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
				});
				if (qualifiedEffects.length > 0) {
					// ⚠️ The refresh-in-place window is PER PART (keyed by duration):
					// a hit that fires a 4s part and a 10s part keeps two open windows,
					// each refreshed by the next hit that fires its own shape.
					const lastWinByDur = new Map<number, BuffWindow>();
					const blockReady = new Map<Effect, number>();
					for (const hit of hitsForTrack(ti, blockClass)) {
						const filterCtx = hitFilterCtx(hit);
						const gate = gateFor(baseCtx, stateIndex.at(track.characterId, hit.time));
						const barEffects = dedupByStat(
							qualifiedEffects.filter((effect) => {
								if (!cooldownOpen(blockReady, effect, hit.time)) return false;
								if (
									evalCondition(
										effect.conditions,
										4,
										gate.resolved,
										cLevel,
										undefined,
										hit.stacks,
										gate.ctx
									) === false
								) {
									return false;
								}
								if (effect.trigger.type === 'onHit') {
									if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
								}
								return true;
							})
						);
						stampCooldowns(blockReady, barEffects, hit.time);
						for (const part of partitionByDuration(barEffects)) {
							const buffStart = hit.time;
							const buffEnd = buffStart + framesOf(part[0].duration!);
							const lastWin = lastWinByDur.get(part[0].duration!);
							if (
								lastWin &&
								buffStart <= lastWin.end &&
								sameEffects(lastWin.effects, part) &&
								sameStacks(lastWin.stackContext, hit.stacks)
							) {
								lastWin.end = buffEnd;
								continue;
							}
							lastWinByDur.set(
								part[0].duration!,
								emit({
									characterId: track.characterId,
									start: buffStart,
									end: buffEnd,
									effects: part,
									stackContext: hit.stacks,
									sourceActionId: hit.sourceEventId,
									source: { type: 'character', trigger: 'block', abilityClass: blockClass }
								})
							);
						}
					}
				}

				const resShredBlockPool = blockGroup.effects.filter(resShredBase);
				if (resShredBlockPool.length > 0) {
					const lastWinByDur = new Map<number, BuffWindow>();
					const blockReady = new Map<Effect, number>();
					for (const hit of hitsForTrack(ti, blockClass)) {
						const filterCtx = hitFilterCtx(hit);
						const gate = gateFor(baseCtx, stateIndex.at(track.characterId, hit.time));
						const barEffects = dedupResShredByElement(
							resShredBlockPool.filter((effect) => {
								if (!cooldownOpen(blockReady, effect, hit.time)) return false;
								if (
									evalCondition(
										effect.conditions,
										4,
										gate.resolved,
										cLevel,
										undefined,
										hit.stacks,
										gate.ctx
									) === false
								)
									return false;
								if (effect.trigger.type === 'onHit') {
									if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
								}
								return true;
							})
						);
						stampCooldowns(blockReady, barEffects, hit.time);
						for (const part of partitionByDuration(barEffects)) {
							const buffStart = hit.time;
							const buffEnd = buffStart + framesOf(part[0].duration!);
							const lastWin = lastWinByDur.get(part[0].duration!);
							if (
								lastWin &&
								buffStart <= lastWin.end &&
								sameEffects(lastWin.effects, part) &&
								sameStacks(lastWin.stackContext, hit.stacks)
							) {
								lastWin.end = buffEnd;
								continue;
							}
							lastWinByDur.set(
								part[0].duration!,
								emit({
									characterId: track.characterId,
									start: buffStart,
									end: buffEnd,
									debuff: true,
									effects: part,
									stackContext: hit.stacks,
									poolFirstEffect: resShredBlockPool[0],
									sourceActionId: hit.sourceEventId,
									source: { type: 'character', trigger: 'block', abilityClass: blockClass }
								})
							);
						}
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
							debuff: boolean,
							dedup: (fired: T[]) => T[]
						): void => {
							if (pool.length === 0) return;
							const lastWinByDur = new Map<number, BuffWindow>();
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
								const gate = gateFor(baseCtx, stateIndex.at(track.characterId, hit.time));
								const barEffects = dedup(
									pool.filter((effect) => {
										if (effect.trigger.type !== 'onHit') return false;
										if (!onHitTriggerMatches(effect.trigger, hit, track.characterId)) return false;
										if (
											evalCondition(
												effect.conditions,
												4,
												gate.resolved,
												cLevel,
												undefined,
												hit.stacks,
												gate.ctx
											) === false
										)
											return false;
										return evalTriggerFilter(effect.trigger.filter, filterCtx);
									})
								);
								for (const part of partitionByDuration(barEffects)) {
									const buffStart = hit.time;
									const buffEnd = buffStart + framesOf(part[0].duration!);
									const lastWin = lastWinByDur.get(part[0].duration!);
									if (
										lastWin &&
										buffStart <= lastWin.end &&
										sameEffects(lastWin.effects, part) &&
										sameStacks(lastWin.stackContext, hit.stacks)
									) {
										lastWin.end = buffEnd;
										continue;
									}
									lastWinByDur.set(
										part[0].duration!,
										emit({
											characterId: track.characterId,
											start: buffStart,
											end: buffEnd,
											debuff: debuff || undefined,
											effects: part,
											stackContext: hit.stacks,
											poolFirstEffect: debuff ? pool[0] : undefined,
											sourceCastId: hit.sourceEventId >= 0 ? hit.sourceEventId : undefined,
											source: { type: 'character', trigger: 'cast', abilityClass: castType }
										})
									);
								}
							}
						};
						emitPass(
							tickGroup.effects.filter((effect): effect is BuffEffect => {
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
							}),
							false,
							dedupByStat
						);
						emitPass(tickGroup.effects.filter(resShredBase), true, dedupResShredByElement);
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
					// ⚓ …and a DEBUFF co-extensive with the state (Mavuika round, 2026-10-17):
					// her C2/C6 DEF shred lasts exactly as long as the Ring follows her /
					// she rides — however the form was entered, a swap included, which a
					// cast-anchored window cannot see.
					const shredState = stateGroup.effects.filter(
						(effect): effect is ResShredEffect =>
							effect.type === 'resShred' &&
							targetsEnemy(effect.target) &&
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
					for (const group of [qualifiedState, shredState]) {
						if (group.length === 0) continue;
						for (const span of spans) {
							emit({
								characterId: track.characterId,
								start: span.start,
								end: span.end,
								effects: group,
								poolFirstEffect: group[0],
								sourceCastId: span.sourceCastId,
								...(group === shredState ? { debuff: true } : {}),
								source: { type: 'character', trigger: 'state' }
							});
						}
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
				for (const part of partitionByDuration(qualifiedEffectsNB)) {
					for (const nb of nbBars) {
						const buffStart = nb.start;
						const buffEnd = buffStart + framesOf(part[0].duration!);
						emit({
							characterId: track.characterId,
							start: buffStart,
							end: buffEnd,
							effects: part,
							source: { type: 'character', trigger: 'nightsoulBurst' }
						});
					}
				}
			}
		}

		// ── stack-threshold team-target buffs (once per character) ──
		if (firstTrackOfChar) {
			for (const pool of stackFirePoolsFor(
				char,
				track.characterId,
				cLevel,
				baseCtx,
				(e) => targetsTeamOrActive(e.target) && !isActiveTargetOnly(e.target)
			)) {
				const buffStart = pool.fire.time;
				const buffEnd = buffStart + framesOf(pool.effects[0].duration!);
				emit({
					characterId: track.characterId,
					start: buffStart,
					end: buffEnd,
					effects: pool.effects,
					stackContext: pool.fire.stackContext,
					source: fireSource(pool.fire)
				});
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
						for (const part of partitionByDuration(effects)) {
							const buffStart = cast.fieldStart;
							const buffEnd = buffStart + framesOf(part[0].duration!);
							emit({
								characterId: track.characterId,
								start: buffStart,
								end: buffEnd,
								effects: part,
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
			const firesAt = makeReactionGate(track.characterId, cLevel, baseCtx);
			for (const effect of qualified) {
				const trig = effect.trigger as {
					reaction: Reaction | Reaction[] | 'any';
					source?: 'self' | 'team' | 'active' | 'others';
				};
				const trigReaction = trig.reaction;
				const matches = (r: Reaction): boolean =>
					trigReaction === 'any' ||
					(Array.isArray(trigReaction) ? trigReaction.includes(r) : trigReaction === r);
				// ⚠ `ownReactionEvents` is a FILTER of `reactionEvents`, so both pools
				// hand back the same event objects — which is what lets the pooler
				// key on event identity across a self-triggered and a team-triggered
				// effect that happen to share one event.
				const eventPool = reactionEventsFor(trig.source, ownReactionEvents);
				for (const ev of eventPool) {
					if (!matches(ev.reaction)) continue;
					if (!firesAt(effect, ev)) continue;
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
	/** Same guard for the stack-threshold active-target pass (fires are
	 *  rotation-wide, like reactions). */
	const fireActiveDispatched = new Set<string>();
	/** Once-per-character guard for the summon-tick active-target pass — the
	 *  received-surface twin of `firstTrackOfChar` in the team-surface loop. */
	const tickActiveDispatched = new Set<string>();
	/** When each track's character ARRIVED: its own start, or — across a
	 *  same-character `>`, which is one stay on field written in two segments
	 *  (run.ts, `carry`) — the start of the stay. Read by `onFieldDelay`, the one
	 *  question here that is about how long somebody has been on field.
	 *  ⚠️ Contiguity as well as the id: an unknown name between two segments of
	 *  one character still counts as a swap, and leaves the swap's gap (at any
	 *  swap delay above zero). */
	const arrivedAt: number[] = [];
	for (let ti = 0; ti < tracks.length; ti++) {
		const prev = tracks[ti - 1];
		const t = tracks[ti];
		arrivedAt.push(
			prev && prev.characterId === t.characterId && prev.activeEnd === t.activeStart
				? arrivedAt[ti - 1]
				: t.activeStart
		);
	}
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
				label: string,
				abilityId: string
			): Array<{ prov?: FactionProvenance; effects: BuffEffect[] }> => {
				const key = `${abilityId}|${label}`;
				const hit = activeCache.get(key);
				if (hit) return hit;
				const built = [
					...getCharacterEffectsForCast(char, cLevel, castType, label, abilityId),
					...getCharacterEffectsForOnHit(char, cLevel, castType, label, abilityId)
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
					return true;
				});
				const grouped = byProvenance(built);
				activeCache.set(key, grouped);
				return grouped;
			};

			for (const cast of abCasts) {
				const filterCtx = resolveCastContext(char, castType, cast);
				// A non-hitting cast anchors no `onHit` effect (non-hitting casts round,
				// 2026-09-16); its `onCast` effects in the same pool are untouched.
				const castNoHit = castLandsNoHit(char, castType, cast);
				const castStates = stateIndex.at(sourceTrack.characterId, cast.time, cast.id);
				const gate = gateFor(receivedCtxOf(char.id), castStates);
				for (const activeGroup of activeEffectsFor(cast.label, cast.abilityId)) {
					const activeEffects = activeGroup.effects;
					if (activeEffects.length === 0) continue;
					const barEffects = dedupByStat(
						activeEffects.filter((effect) => {
							if (
								evalCondition(
									effect.conditions,
									4,
									gate.resolved,
									cLevel,
									undefined,
									cast.stackContext,
									gate.ctx
								) === false
							)
								return false;
							if (effect.trigger.type === 'onHit' && castNoHit) return false;
							if (effect.trigger.type === 'onHit' && filterCtx) {
								if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
							}
							return true;
						})
					);
					for (const { anchor, extend, part } of partitionCastPool(barEffects, cast)) {
						const firstValue = part[0].value;
						const rampParams =
							typeof firstValue === 'object' &&
							'type' in firstValue &&
							firstValue.type === 'ramping'
								? {
										startValue: firstValue.startValue,
										stepValue: firstValue.stepValue,
										stepInterval: framesOf(firstValue.stepInterval),
										cap: firstValue.cap
									}
								: undefined;
						const decayParams =
							typeof firstValue === 'object' &&
							'type' in firstValue &&
							firstValue.type === 'decaying'
								? {
										startValue: firstValue.startValue,
										endValue: firstValue.endValue ?? 0,
										duration: framesOf(part[0].duration!)
									}
								: undefined;
						const buffStart = anchor;
						const buffEnd = buffStart + framesOf(part[0].duration!) + extend;

						// ⚓ HOW LONG THE RECEIVER HAS BEEN ON FIELD (Nicole, 2026-08-18).
						// `onFieldDelay` shifts each segment's START and leaves the buff's
						// own end alone, so a receiver who swaps in with less than the
						// delay left in the window gets nothing — which is the mechanic:
						// Nicole "observes" whoever is active and upgrades them once they
						// have STAYED. ⚠️ Read off `part[0]`, the same slot every
						// other span field here comes from.
						const delaySpec = part[0].onFieldDelay;
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
							const segStart = Math.max(
								buffStart,
								receiverTrack.activeStart,
								arrivedAt[rti] + delayF
							);
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
							const receiverChar = getCharacter(receiverId);
							const activeCharFactions = new Set<string>(receiverChar?.factions ?? []);
							const segCtx: ConditionContext = {
								teamFactionCounts,
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
							// The holder's states at the EVENT plus their field fact for THIS
							// slice — one gate, so a state decided at the cast stays decided here.
							const segGate = gateFor(segCtx, castStates, sourceIsActive ? 'onField' : 'offField');

							const segEffects = part.filter(
								(effect) =>
									evalCondition(
										effect.conditions,
										4,
										segGate.resolved,
										cLevel,
										undefined,
										cast.stackContext,
										segGate.ctx
									) !== false
							);
							if (segEffects.length === 0) continue;
							const useSegList = segEffects.length !== part.length;

							emit({
								characterId: sourceTrack.characterId,
								receiverId,
								start: segStart,
								end: isLast ? buffEnd : segEnd,
								effects: useSegList ? segEffects : part,
								stackContext: cast.stackContext,
								duration: buffEnd - buffStart,
								// ⚓ The buff's own start, so the projection can tell a slice cut at a
								// swap from one that ran to its natural end (seam rule, 2026-09-17).
								buffStart,
								...(rampParams ? { rampParams } : {}),
								...(decayParams ? { decayParams } : {}),
								sourceCastId: cast.id,
								source: { type: 'character', trigger: 'cast', abilityClass: castType }
							});
						}
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
					return true;
				});
				if (activeEffects.length === 0) continue;
				const blockReady = new Map<Effect, number>();
				for (const hit of hitsForTrack(sti, blockClass)) {
					const filterCtx = hitFilterCtx(hit);
					const hitStates = stateIndex.at(sourceTrack.characterId, hit.time);
					const gate = gateFor(receivedCtxOf(char.id), hitStates);
					const barEffects = dedupByStat(
						activeEffects.filter((effect) => {
							if (!cooldownOpen(blockReady, effect, hit.time)) return false;
							if (
								evalCondition(
									effect.conditions,
									4,
									gate.resolved,
									cLevel,
									undefined,
									hit.stacks,
									gate.ctx
								) === false
							)
								return false;
							if (effect.trigger.type === 'onHit') {
								if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
							}
							return true;
						})
					);
					stampCooldowns(blockReady, barEffects, hit.time);
					for (const part of partitionByDuration(barEffects)) {
						const buffStart = hit.time;
						const buffEnd = buffStart + framesOf(part[0].duration!);
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
							const receiverChar = getCharacter(receiverId);
							const activeCharFactions = new Set<string>(receiverChar?.factions ?? []);
							const segCtx: ConditionContext = {
								teamFactionCounts,
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
							// The holder's states at the EVENT plus their field fact for THIS
							// slice — one gate, so a state decided at the cast stays decided here.
							const segGate = gateFor(segCtx, hitStates, sourceIsActive ? 'onField' : 'offField');
							const segEffects = part.filter(
								(effect) =>
									evalCondition(
										effect.conditions,
										4,
										segGate.resolved,
										cLevel,
										undefined,
										hit.stacks,
										segGate.ctx
									) !== false
							);
							if (segEffects.length === 0) continue;
							const useSegList = segEffects.length !== part.length;
							emit({
								characterId: sourceTrack.characterId,
								receiverId,
								start: segStart,
								end: isLast ? buffEnd : segEnd,
								effects: useSegList ? segEffects : part,
								stackContext: hit.stacks,
								duration: buffEnd - buffStart,
								// ⚓ The buff's own start, so the projection can tell a slice cut at a
								// swap from one that ran to its natural end (seam rule, 2026-09-17).
								buffStart,
								sourceActionId: hit.sourceEventId,
								source: { type: 'character', trigger: 'block', abilityClass: blockClass }
							});
						}
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
						return true;
					});
					if (activeEffects.length === 0) continue;
					for (const hit of classHits) {
						const filterCtx = hitFilterCtx(hit);
						const hitStates = stateIndex.at(sourceTrack.characterId, hit.time);
						const gate = gateFor(receivedCtxOf(char.id), hitStates);
						const barEffects = dedupByStat(
							activeEffects.filter((effect) => {
								if (effect.trigger.type !== 'onHit') return false;
								if (!onHitTriggerMatches(effect.trigger, hit, sourceTrack.characterId))
									return false;
								if (
									evalCondition(
										effect.conditions,
										4,
										gate.resolved,
										cLevel,
										undefined,
										hit.stacks,
										gate.ctx
									) === false
								)
									return false;
								return evalTriggerFilter(effect.trigger.filter, filterCtx);
							})
						);
						for (const part of partitionByDuration(barEffects)) {
							const buffStart = hit.time;
							const buffEnd = buffStart + framesOf(part[0].duration!);
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
								const receiverChar = getCharacter(receiverId);
								const segCtx: ConditionContext = {
									teamFactionCounts,
									activeCharFactions: new Set<string>(receiverChar?.factions ?? []),
									receiverWeapon: receiverChar?.weapon
								};
								// The holder's states at the EVENT plus their field fact for THIS
								// slice — one gate, so a state decided at the cast stays decided here.
								const segGate = gateFor(segCtx, hitStates, sourceIsActive ? 'onField' : 'offField');
								const segEffects = part.filter(
									(effect) =>
										evalCondition(
											effect.conditions,
											4,
											segGate.resolved,
											cLevel,
											undefined,
											hit.stacks,
											segGate.ctx
										) !== false
								);
								if (segEffects.length === 0) continue;
								emit({
									characterId: sourceTrack.characterId,
									receiverId,
									start: segStart,
									end: isLast ? buffEnd : segEnd,
									effects: segEffects.length !== part.length ? segEffects : part,
									stackContext: hit.stacks,
									duration: buffEnd - buffStart,
									// ⚓ The buff's own start, so the projection can tell a slice cut at a
									// swap from one that ran to its natural end (seam rule, 2026-09-17).
									buffStart,
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

		// ── stack-threshold active-target (segmented, received surface) ──
		// Sliced across on-field windows like the reaction site above: the buff
		// follows whoever is active, one window per receiver it covers.
		if (!fireActiveDispatched.has(sourceTrack.characterId)) {
			fireActiveDispatched.add(sourceTrack.characterId);
			for (const pool of stackFirePoolsFor(
				char,
				sourceTrack.characterId,
				cLevel,
				receivedCtxOf(char.id),
				(e) => isActiveTargetOnly(e.target)
			)) {
				const poolStart = pool.fire.time;
				const poolEnd = poolStart + framesOf(pool.effects[0].duration!);
				const segments: Array<{ receiverId: string; segStart: number; segEnd: number }> = [];
				for (const receiverTrack of tracks) {
					const segStart = Math.max(poolStart, receiverTrack.activeStart);
					const segEnd = Math.min(poolEnd, receiverTrack.activeEnd);
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
						end: isLast ? poolEnd : segEnd,
						effects: pool.effects,
						stackContext: pool.fire.stackContext,
						duration: poolEnd - poolStart,
						source: fireSource(pool.fire)
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
				label: string,
				abilityId: string
			): Array<{ prov?: FactionProvenance; effects: BuffEffect[] }> => {
				const key = `${abilityId}|${label}`;
				const cached = selfCache.get(key);
				if (cached) return cached;
				const built = [
					...getCharacterEffectsForCast(char, cLevel, castType, label, abilityId),
					...getCharacterEffectsForOnHit(char, cLevel, castType, label, abilityId)
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
					return true;
				});
				const grouped = byProvenance(built);
				selfCache.set(key, grouped);
				return grouped;
			};

			for (const cast of abCasts) {
				const filterCtx = resolveCastContext(char, castType, cast);
				// A non-hitting cast anchors no `onHit` effect (non-hitting casts round,
				// 2026-09-16); its `onCast` effects in the same pool are untouched.
				const castNoHit = castLandsNoHit(char, castType, cast);
				const gate = gateFor(
					selfCtx,
					stateIndex.at(sourceTrack.characterId, cast.time, cast.id),
					'onField'
				);
				for (const selfGroup of selfEffectsFor(cast.label, cast.abilityId)) {
					const selfEffects = selfGroup.effects;
					if (selfEffects.length === 0) continue;
					const barEffects = dedupByStat(
						selfEffects.filter((effect) => {
							if (
								evalCondition(
									effect.conditions,
									4,
									gate.resolved,
									cLevel,
									undefined,
									cast.stackContext,
									gate.ctx
								) === false
							)
								return false;
							if (effect.trigger.type === 'onHit' && castNoHit) return false;
							if (effect.trigger.type === 'onHit' && filterCtx) {
								if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
							}
							return true;
						})
					);
					for (const { anchor, extend, part } of partitionCastPool(barEffects, cast)) {
						const buffStart = anchor;
						const buffEnd = buffStart + framesOf(part[0].duration!) + extend;
						emit({
							characterId: sourceTrack.characterId,
							receiverId: sourceTrack.characterId,
							start: buffStart,
							end: buffEnd,
							effects: part,
							stackContext: cast.stackContext,
							duration: buffEnd - buffStart,
							sourceCastId: cast.id,
							source: { type: 'character', trigger: 'cast', abilityClass: castType }
						});
					}
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
					return true;
				});
				if (selfEffects.length === 0) continue;
				// PER-SWING hit anchored (phase-6): the hit-time stack snapshot is
				// what stack-gated self buffs read — Yanfei A1's perStack Pyro DMG
				// bonus sees her pre-consume seal count at the CA hit.
				const blockReady = new Map<Effect, number>();
				for (const hit of hitsForTrack(sti, blockClass)) {
					const filterCtx = hitFilterCtx(hit);
					const gate = gateFor(
						selfCtxBlock,
						stateIndex.at(sourceTrack.characterId, hit.time),
						'onField'
					);
					const barEffects = dedupByStat(
						selfEffects.filter((effect) => {
							if (!cooldownOpen(blockReady, effect, hit.time)) return false;
							if (
								evalCondition(
									effect.conditions,
									4,
									gate.resolved,
									cLevel,
									undefined,
									hit.stacks,
									gate.ctx
								) === false
							)
								return false;
							if (effect.trigger.type === 'onHit') {
								if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
							}
							return true;
						})
					);
					stampCooldowns(blockReady, barEffects, hit.time);
					for (const part of partitionByDuration(barEffects)) {
						const buffStart = hit.time;
						const buffEnd = buffStart + framesOf(part[0].duration!);
						emit({
							characterId: sourceTrack.characterId,
							receiverId: sourceTrack.characterId,
							start: buffStart,
							end: buffEnd,
							effects: part,
							stackContext: hit.stacks,
							duration: buffEnd - buffStart,
							sourceActionId: hit.sourceEventId,
							source: { type: 'character', trigger: 'block', abilityClass: blockClass }
						});
					}
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
				for (const part of partitionByDuration(selfEffectsNB)) {
					for (const nb of nbBars) {
						const buffStart = nb.start;
						const buffEnd = buffStart + framesOf(part[0].duration!);
						emit({
							characterId: sourceTrack.characterId,
							receiverId: sourceTrack.characterId,
							start: buffStart,
							end: buffEnd,
							effects: part,
							duration: buffEnd - buffStart,
							source: { type: 'character', trigger: 'nightsoulBurst' }
						});
					}
				}
			}
		}

		// ── stack-threshold self-target (received surface) ──
		if (firstTrackOfChar) {
			for (const pool of stackFirePoolsFor(
				char,
				sourceTrack.characterId,
				cLevel,
				receivedCtxOf(char.id),
				(e) => e.target === 'self'
			)) {
				const buffStart = pool.fire.time;
				const buffEnd = buffStart + framesOf(pool.effects[0].duration!);
				emit({
					characterId: sourceTrack.characterId,
					receiverId: sourceTrack.characterId,
					start: buffStart,
					end: buffEnd,
					effects: pool.effects,
					stackContext: pool.fire.stackContext,
					duration: buffEnd - buffStart,
					source: fireSource(pool.fire)
				});
			}
		}

		// ── onHit self-target, listening to the PARTY's hits (received surface) ──
		//
		// ⚓⚓ ANCHORED ON THE ROTATION-WIDE HIT STREAM, NOT ON THE HOLDER'S CASTS
		// (cross-character onHit round, 2026-09-21). An `onHit` effect whose trigger
		// names `source: 'others' | 'team' | 'active'` fires off whoever landed the
		// hit, so it has no cast or swing of the holder's to be pooled under — see
		// `getCharacterEffectsForTeamHit`, which is also why the cast and block
		// pools above no longer see these. `onHitTriggerMatches` is the ONE gate
		// (source, ability class, damage type, filter), the same function the live
		// stack and proc dispatchers ask.
		//
		// ⚓ The holder's STATES are read at the hit (§1.G) — Mizuki's A4 wants her
		// Dreamdrifter up when the teammate's hit lands — and so is her on/off-field
		// fact, which here is a lookup rather than a given: the holder is usually
		// NOT the one hitting.
		//
		// ⚠️ `hit.stacks` is the HITTER's snapshot, so it is handed to the
		// conditions only when the hitter is the holder. A `stacks` gate on a
		// teammate's hit resolves `null` and rides, like every unresolvable gate.
		//
		// ⚠️ ONE WINDOW PER FIRE, fused by the projection (`mergeRefreshedBars`),
		// the N/CA/P self site's shape — ⛔ not extended in place: `duration` feeds
		// the tooltip and must stay the effect's LENGTH, not the covered span.
		//
		// ⚠️ SELF SURFACE ONLY, by census: the corpus's holders are self-target
		// (Nicole's A4; Mizuki's A4 and Skirk's A4 once re-authored). Lint B.19
		// refuses the other targets rather than let one reach nothing.
		if (firstTrackOfChar) {
			const holderId = sourceTrack.characterId;
			const hostPools = getCharacterEffectsForTeamHit(char, cLevel);
			for (const host of hostPools) {
				for (const group of byProvenance(host.effects)) {
					const pool = group.effects.filter((effect): effect is BuffEffect => {
						if (effect.type !== 'buff') return false;
						if (effect.target !== 'self') return false;
						if (effect.duration == null) return false;
						return (
							evalCondition(
								effect.conditions,
								4,
								new Set(),
								cLevel,
								undefined,
								undefined,
								receivedCtxOf(char.id)
							) !== false
						);
					});
					if (pool.length === 0) continue;
					const procReady = new Map<BuffEffect, number>();
					const lastFireByDur = new Map<number, { time: number; effects: BuffEffect[] }>();
					for (const hit of hitsByTime()) {
						if (
							!pool.some(
								(e) => e.trigger.type === 'onHit' && onHitTriggerMatches(e.trigger, hit, holderId)
							)
						)
							continue;
						const gate = gateFor(
							receivedCtxOf(char.id),
							stateIndex.at(holderId, hit.time),
							onFieldAt(hit.time) === holderId ? 'onField' : 'offField'
						);
						const ownStacks = hit.characterId === holderId ? hit.stacks : undefined;
						const fired = dedupByStat(
							pool.filter((effect) => {
								if (effect.trigger.type !== 'onHit') return false;
								if (!onHitTriggerMatches(effect.trigger, hit, holderId)) return false;
								if (hit.time < (procReady.get(effect) ?? -Infinity)) return false;
								return (
									evalCondition(
										effect.conditions,
										4,
										gate.resolved,
										cLevel,
										undefined,
										ownStacks,
										gate.ctx
									) !== false
								);
							})
						);
						for (const effect of fired) {
							if (typeof effect.procCooldown === 'number')
								procReady.set(effect, hit.time + framesOf(effect.procCooldown));
						}
						const viaCast = hit.abilityType === 'skill' || hit.abilityType === 'burst';
						for (const part of partitionByDuration(fired)) {
							// Several landings on ONE frame are one fire.
							const last = lastFireByDur.get(part[0].duration!);
							if (last && last.time === hit.time && sameEffects(last.effects, part)) continue;
							lastFireByDur.set(part[0].duration!, { time: hit.time, effects: part });
							const duration = framesOf(part[0].duration!);
							emit({
								characterId: holderId,
								receiverId: holderId,
								start: hit.time,
								end: hit.time + duration,
								effects: part,
								stackContext: ownStacks,
								duration,
								...(hit.sourceEventId >= 0
									? viaCast
										? { sourceCastId: hit.sourceEventId }
										: { sourceActionId: hit.sourceEventId }
									: {}),
								source: { type: 'character', trigger: 'teamHit', hostLabel: host.hostName }
							});
						}
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

		// ── onReaction reactor-target (received surface) ──
		//
		// ⚓ The one who REACTED receives it (`target: 'reactor'`, Prune round,
		// 2026-10-17) — one window per application on that character's row, ⛔ not
		// sliced across the field: an `'active'` stand-in hopped Prune's +30% from
		// Bennett to Xiangling to Varka and cut it at every swap.
		if (firstTrackOfChar) {
			for (const pool of reactionPoolsFor(
				char,
				sourceTrack.characterId,
				cLevel,
				receivedCtxOf(char.id),
				(e) => e.type === 'buff' && e.target === 'reactor'
			)) {
				emit({
					characterId: sourceTrack.characterId,
					receiverId: pool.reactorId,
					start: pool.start,
					end: pool.end,
					effects: pool.effects,
					duration: pool.end - pool.start,
					source: { type: 'character', trigger: 'reaction' }
				});
			}
		}
	}

	// ── whileStacks (stepped stacks round, 2026-09-27) ──
	//
	// ⚓ A BUFF THAT IS ITS COUNT. The window is each span the holder held the
	// key above zero, read off the parse's own ledger (`stackHistory`) — anchored
	// on no cast, so an E, a Q that refreshes Odette's Double and the off-field
	// ticks in between are ONE bar. A `perStack` value on the same key carries
	// the steps, which the projections draw as density. `whileState` then bounds
	// it (the pass below), exactly as it bounds a cast-anchored window.
	if (stackHistory && stackHistory.size > 0) {
		let rotationEnd = 0;
		for (const t of tracks) rotationEnd = Math.max(rotationEnd, t.activeEnd);
		for (const w of windows) rotationEnd = Math.max(rotationEnd, w.end);
		const holders = new Set(tracks.map((t) => t.characterId));
		for (const holderId of holders) {
			const char = getCharacter(holderId);
			if (!char) continue;
			const cLevel = constellationLevels[holderId] ?? 0;
			const sources = effectSourcesAtConstellation(char, cLevel);
			for (const src of sources) {
				for (const raw of src.effects ?? []) {
					if (raw.trigger.type !== 'whileStacks') continue;
					const key = raw.trigger.key;
					const effect = normalizeBuffLikeEffect(raw);
					if (!effect || effect.type !== 'buff') continue;
					if (
						evalCondition(
							effect.conditions,
							4,
							new Set(),
							cLevel,
							undefined,
							undefined,
							receivedCtxOf(holderId)
						) === false
					)
						continue;
					const history = stackHistory.get(`${holderId}::${key}`);
					if (!history || history.length === 0) continue;
					const value = effect.value as { type?: string; key?: string };
					const stepped =
						typeof value === 'object' && value.type === 'perStack' && value.key === key;
					// ⚠️ Only grants that can fire at THIS constellation — Odette's C1
					// grants cap at 6, and counting them at C0 drew 4 of 4 as two-thirds.
					let stackMax: number | undefined;
					const capOf = (fx: Effect): void => {
						if (fx.type !== 'gainStacks' || fx.key !== key || fx.max === undefined) return;
						if (
							evalCondition(
								fx.conditions,
								4,
								new Set(),
								cLevel,
								undefined,
								undefined,
								receivedCtxOf(holderId)
							) === false
						)
							return;
						stackMax = Math.max(stackMax ?? 0, fx.max);
					};
					for (const s2 of sources) for (const fx of s2.effects ?? []) capOf(fx);
					for (const s2 of char.abilities)
						for (const sm of (s2 as { summons?: { effects?: Effect[] }[] }).summons ?? [])
							for (const fx of sm.effects ?? []) capOf(fx);
					const flush = (span: { at: number; count: number }[], end: number): void => {
						const start = span[0].at;
						if (end <= start) return;
						emit({
							characterId: holderId,
							...(effect.target === 'self' ? { receiverId: holderId } : {}),
							start,
							end,
							effects: [effect],
							stackContext: new Map([[key, span[0].count]]),
							duration: end - start,
							...(stepped ? { stackSteps: span, ...(stackMax ? { stackMax } : {}) } : {}),
							source: { type: 'character', trigger: 'stacks', hostLabel: src.name }
						});
					};
					let open: { at: number; count: number }[] | null = null;
					for (const step of history) {
						if (step.count > 0) (open ??= []).push({ at: step.at, count: step.count });
						else if (open) {
							flush(open, step.at);
							open = null;
						}
					}
					if (open) flush(open, rotationEnd);
				}
			}
		}
	}

	return clipToHolderStates(out, windows);
}

/**
 * ⚓⚓ `whileState` — THE BUFF EXISTS ONLY WHILE ITS HOLDER IS IN A STATE
 * (event-ended buffs round, 2026-09-21). Every window is intersected with the
 * holder's `state` windows of the name its effects carry: a Varka A1 multiplier
 * authored at the stance's full length loses its tail to a swap-cut stance, a
 * Skirk Death's Crossing gained before Seven-Phase Flash loses its head, an
 * Illuga C4 ends with the Oriole-Song her spent pool closed.
 *
 * ⚓ ONE PASS, LAST. Several sites refresh a window IN PLACE after emitting it
 * (`lastWin.end = buffEnd`), so a clip at `emit` would cut a span that is about
 * to grow. It also makes the rule one rule for every surface: a per-receiver
 * SLICE is clipped exactly like a whole window, because intersection does not
 * care what cut the other side.
 *
 * ⚠️ A window's effects may disagree (one bound, one not), so the window is
 * split by `whileState` first — the unbound part keeps its span untouched.
 * ⚠️ `duration` is left alone (the tooltip's LENGTH), and a received-surface
 * piece is stamped `buffStart` so the projection reads the clipped end as NOT
 * natural and draws no seam there.
 * ⚠️ Ids are renumbered when — and only when — something was clipped: they are
 * emission ORDER and nothing else, so a rotation with no bound effect returns
 * the very array it was handed.
 */
function clipToHolderStates(out: BuffWindow[], windows: readonly TimelineWindow[]): BuffWindow[] {
	const boundStateOf = (e: Effect): string | undefined => (e as { whileState?: string }).whileState;
	if (!out.some((w) => w.effects.some((e) => boundStateOf(e) !== undefined))) return out;

	const spanCache = new Map<string, { start: number; end: number }[]>();
	const spansOf = (holderId: string, state: string): { start: number; end: number }[] => {
		const key = `${holderId}::${state}`;
		let spans = spanCache.get(key);
		if (!spans) {
			spans = windows
				.filter(
					(w): w is Extract<TimelineWindow, { kind: 'state' }> =>
						w.kind === 'state' && w.name === state && w.characterId === holderId
				)
				.map((w) => ({ start: w.start, end: w.end }))
				.sort((a, b) => a.start - b.start);
			// ⚓ A state re-opened on the frame it closed is ONE span to a clip
			// (stepped stacks round): Odette's `soloDanceDouble` closes and reopens
			// at a refreshing Q, and the bar it bounds must not break there.
			const merged: { start: number; end: number }[] = [];
			for (const sp of spans) {
				const last = merged[merged.length - 1];
				if (last && sp.start <= last.end) last.end = Math.max(last.end, sp.end);
				else merged.push({ ...sp });
			}
			spans = merged;
			spanCache.set(key, spans);
		}
		return spans;
	};

	const result: BuffWindow[] = [];
	for (const w of out) {
		// First-seen order, so an unbound part keeps its place ahead of a bound one
		// authored after it.
		const groups = new Map<string | undefined, Effect[]>();
		for (const e of w.effects) {
			const state = boundStateOf(e);
			const g = groups.get(state);
			if (g) g.push(e);
			else groups.set(state, [e]);
		}
		for (const [state, effects] of groups) {
			if (state === undefined) {
				result.push(effects.length === w.effects.length ? w : { ...w, effects });
				continue;
			}
			for (const span of spansOf(w.characterId, state)) {
				const start = Math.max(w.start, span.start);
				const end = Math.min(w.end, span.end);
				if (end <= start) continue;
				result.push({
					...w,
					start,
					end,
					effects,
					...(w.duration !== undefined ? { buffStart: w.buffStart ?? w.start } : {})
				});
			}
		}
	}
	return result.map((w, i) => (w.id === i ? w : { ...w, id: i }));
}
