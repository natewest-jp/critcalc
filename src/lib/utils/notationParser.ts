/**
 * src/lib/utils/notationParser.ts
 *
 * KQM-aligned rotation notation parser. Produces timeline track data from a
 * notation string like:
 *   Bennett Q > Kazuha hE P > Xiangling Q E > Fischl E N1 N2 ~2s
 *
 * ⚓ THIS FILE IS THE DOOR, and it stays fixed (gauge-round.md C2). Since L3 the
 * room behind it is `$lib/sim/`: `parseNotation` resolves the team's static
 * facts, builds a `SimContext`, hands it to the driver, and finalizes. Every
 * name any consumer ever imported from here is still exported from here — 22
 * files depend on that, and the refactor is only verifiable because the door
 * did not move.
 *
 * Where the work lives now:
 *   `sim/run.ts`        the driver — walks the segments and owns the clock
 *   `sim/clock.ts`      the frame clock + task queue (⚓ it JUMPS, see C6)
 *   `sim/context.ts`    `SimContext` — the state every dispatcher shares
 *   `sim/aura.ts`       the live gauge's wiring (⚓ L5 crossed the seam here)
 *   `sim/finalize.ts`   window authoring + the bar/block projections
 *   `sim/conditions.ts` `sim/resolve.ts` `sim/tokens.ts` `sim/states.ts`
 *   `sim/stacks.ts` `sim/hits.ts` `sim/shields.ts` `sim/infusions.ts`
 *   `sim/extensions.ts` `sim/cooldowns.ts` `sim/summons.ts` `sim/types.ts`
 *
 * Time model:
 *   ⚓ THE CLOCK IS INTEGER FRAMES AT 60fps, and so is every time field on the
 *   IR (gauge-round.md contract C1). Authored SECONDS are converted at the read
 *   site by `framesOf`, which is the one rounding in the system; seconds come
 *   back only at presentation, where a bare `/ 60` is self-evidently a display.
 *   ⛔ Don't reintroduce a seconds value to "make a site readable" — the whole
 *   benefit is that a number in the sim needs no unit asked of it.
 *
 *   - A segment is a TURN: one character's on-field window. The clock enters it
 *     at that character's active-start and every action pushes it forward.
 *   - Q advances by Q_CAST_F, E by E_CAST_F when the ability carries no frames.
 *   - ~Xs advances by X seconds, rounded to frames on the way in.
 *   - ~?s is a placeholder meaning "duration unset" — advances by MIN_ACTIVE_F
 *     and flags the track so the renderer can show a visual warning.
 *   - Swapping costs swapFrames before the next character starts.
 *   - ( ) marks optional actions (KQM-compatible); contents are label tokens
 *     rendered with lower opacity.
 *   - [ ] bracket groups (e.g. [N2D]x3) are preserved as label tokens.
 */

import type { CharacterData } from '$lib/types/character';
import type { Element } from '$lib/types/ability';
import { tokenizeNotation } from '$lib/utils/tokenizer';
import { computeTeamEnabledReactions, computeTeamFactionCounts } from '$lib/utils/teamComposition';
import { effectSourcesAtConstellation } from '$lib/utils/effectCollection';
import type { LoadoutEntry } from '$lib/stores';
import { createSimContext } from '$lib/sim/context';
import type { HumanTiming } from '$lib/sim/humanTiming';
import type { ParsedRotation } from '$lib/sim/types';
import { finalizeParse } from '$lib/sim/finalize';
import { runRotation } from '$lib/sim/run';
import { collectStackThresholds } from '$lib/sim/thresholds';
import { collectCooldownReduces } from '$lib/sim/cooldownReduce';

// ---------------------------------------------------------------------------
// The published surface. ⛔ Every re-export below exists so a consumer's import
// statement did not have to change when the implementation moved (L3c/L3d).
// ---------------------------------------------------------------------------

// The IR event/window types, straight from their own module.
export type {
	TimelineEvent,
	TimelineWindow,
	CastEvent,
	ReactionEvent,
	ShieldEndEvent,
	NightsoulBurstEvent
} from '$lib/utils/rotationEvents';

// The parser's own output types (`$lib/sim/types.ts`).
export type {
	TimelineBar,
	InputBlockKind,
	InputBlock,
	CharacterTrack,
	WeaponProcBar,
	ParsedRotation
} from '$lib/sim/types';

// What the gauge was fed (`$lib/sim/aura.ts`) — the aura lane's tick row and
// the L0 oracle both read it through this door (gauge round L6).
export type { AuraApplication } from '$lib/sim/aura';

// Condition evaluation (`$lib/sim/conditions.ts`) — eight modules import
// `evalCondition` from here, `buffWindows.ts` among them.
export {
	evalCondition,
	findChainStage,
	DEFAULT_ASCENSION,
	type ChainIndex,
	type ConditionContext
} from '$lib/sim/conditions';

// The parser-private hit record + its trigger gate (`$lib/sim/hits.ts`).
// ⚠️ A hit is NOT public IR (post-P4 #1); these are exported for the
// buff-window derivation, which is a lobe of the parser rather than a consumer.
export { onHitTriggerMatches } from '$lib/sim/hits';
export type { HitEvent } from '$lib/sim/hits';

// Summon tick walking (`$lib/sim/summons.ts`) — `summonSubrows.ts` imports both
// this and `findSummonsForBar`, which is now the ONE resolver (the forked
// `findCastSummons` was retired at L3c).
export { computeSummonTicks } from '$lib/sim/summons';

// ---------------------------------------------------------------------------
// The parse
// ---------------------------------------------------------------------------

export function parseNotation(
	notation: string,
	lookupChar: (name: string) => CharacterData | null,
	swapFrames = 8,
	constellationLevels?: Record<string, number>,
	loadoutMap?: Record<string, LoadoutEntry>,
	teamCharacters?: (CharacterData | null)[],
	/** Human timing (`$lib/sim/humanTiming.ts`). Omitted = frame-perfect. */
	humanTiming?: HumanTiming | null
): ParsedRotation {
	const raw = notation.trim();
	if (!raw)
		return {
			tracks: [],
			totalDuration: 0,
			unknownTokens: [],
			events: [],
			windows: [],
			applications: [],
			auraSeries: []
		};

	// Tokenize the full string, then group into segments by separator tokens.
	const allTokens = tokenizeNotation(raw);

	const segments: (typeof allTokens)[] = [];
	let current: typeof allTokens = [];
	for (const tok of allTokens) {
		if (tok.kind === 'separator') {
			if (current.length > 0) segments.push(current);
			current = [];
		} else {
			current.push(tok);
		}
	}
	if (current.length > 0) segments.push(current);

	// ── Team facts, resolved ONCE before the first token. Everything here
	//    depends only on the segments and the caller's arguments, so it is
	//    settled before the clock starts and never revisited.

	// Compute team Moonsign membership once: 2+ Moonsign chars enables
	// `lunarCrystallize` emission on geo casts (per Linnea/Lauma/Flins family
	// of effects). Walks all unique character IDs across segments.
	const seenChars = new Set<string>();
	const teamChars: CharacterData[] = [];
	for (const seg of segments) {
		const charTok = seg[0];
		if (!charTok || charTok.kind !== 'character') continue;
		const c = lookupChar(charTok.text);
		if (!c) continue;
		if (seenChars.has(c.id)) continue;
		seenChars.add(c.id);
		teamChars.push(c);
	}

	// ⚓ ONE ROSTER FOR EVERY TEAM FACT (small-fix bundle, 2026-09-17). The
	// party is the SLOT roster when the caller hands one in: an enabler's mere
	// presence converts the base reaction (Sandrone in slot 4 with zero casts
	// still turns every Superconduct into Stellar-Conduct), and by the same
	// token a slot-holder who never casts still counts toward a teammate's
	// element and faction gates. The segment roster is the no-slots fallback.
	// ⚠️ Until now `teamEnabledReactions` read the slots while the faction and
	// element counts read the SEGMENTS, so a fifth name in the notation (no
	// slot, provisional) counted toward Nahida's Dendro tally while the slot
	// roster said the team was four. The two agree whenever the notation and
	// the slots agree, which since notation-as-single-truth is every case but
	// that one.
	// ⚠️ An EMPTY slot list reads as "no roster given", not as an empty party:
	// an empty count map is unresolvable to every `teamElementCount` gate and
	// lets the first-authored tier win (measured: Skirk's A4 drew +5% at three
	// Cryo/Hydro teammates).
	const slotChars = teamCharacters?.filter((c): c is CharacterData => c !== null) ?? [];
	const rosterChars: CharacterData[] = slotChars.length > 0 ? slotChars : teamChars;
	const teamEnabledReactions = computeTeamEnabledReactions(rosterChars);

	// Shared holder-constellation map for the onHit dispatchers (the reaction
	// dispatch sites build theirs inline per fire — left untouched).
	const constellationByHolder = new Map(
		teamChars.map((c) => [c.id, constellationLevels?.[c.id] ?? 0])
	);

	// Team-level pre-check: hit STACK dispatch (and the drain/lifetime settle
	// it requires at action sites) only runs when someone on the team actually
	// authors an onHit gainStacks/consumeStacks. Guards corpus-wide float
	// identity of drain settling — without an onHit consumer, drain anchors
	// advance ONLY at cast sites, exactly as before the wiring.
	//
	// ⚓ Constellation-gated (2026-08-18) via the shared collector: a locked
	// entry's effect can never dispatch, so counting it here would run the
	// settle for a consumer that does not exist. Census-checked byte-identical —
	// the corpus authors no onHit gainStacks/consumeStacks on a constellation at
	// all (the only two are Linnea C1 and Skirk C2, both `onCast`).
	const teamHasOnHitStackEffects = teamChars.some((c) =>
		effectSourcesAtConstellation(c, constellationByHolder.get(c.id) ?? 0).some((src) =>
			(src.effects ?? []).some(
				(fx) =>
					(fx.type === 'gainStacks' || fx.type === 'consumeStacks') && fx.trigger.type === 'onHit'
			)
		)
	);

	// Team context for variant-condition resolution (sQ primitive): lets
	// `teamFaction` / `teamElementCount` conditions on ability VARIANTS resolve
	// definitively parser-side (Varka Four Winds' Ascension needs an elemental
	// teammate). Mirrors the renderer's per-holder maps: faction counts are
	// whole-team, element counts exclude the holder.
	// ⚠️ Counted over the ROSTER; keyed for every parsed HOLDER (a fifth name
	// still needs an entry to resolve its own gates against the four).
	const teamFactionCounts = computeTeamFactionCounts(rosterChars);
	const teamElementCountsByHolder = new Map<string, Map<Element, number>>();
	for (const holder of teamChars) {
		const counts = new Map<Element, number>();
		for (const other of rosterChars) {
			if (other.id === holder.id || !other.element) continue;
			counts.set(other.element, (counts.get(other.element) ?? 0) + 1);
		}
		teamElementCountsByHolder.set(holder.id, counts);
	}

	// The sim's mutable state, in one place (`$lib/sim/context.ts`).
	const ctx = createSimContext({
		swapF: swapFrames,
		humanTiming: humanTiming ?? null,
		constellationLevels,
		loadoutMap,
		team: {
			teamChars,
			rosterChars,
			teamEnabledReactions,
			teamFactionCounts,
			teamElementCountsByHolder,
			constellationByHolder,
			teamHasOnHitStackEffects,
			stackThresholds: collectStackThresholds(teamChars, constellationByHolder),
			cooldownReduces: collectCooldownReduces(teamChars, constellationByHolder),
			slotRoster: teamCharacters
		}
	});

	// Run the clock, then author the IR from what it left behind.
	return finalizeParse(ctx, runRotation(ctx, segments, lookupChar));
}
