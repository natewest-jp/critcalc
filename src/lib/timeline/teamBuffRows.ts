/**
 * src/lib/timeline/teamBuffRows.ts
 *
 * Team-buffs-row PROJECTION (post-P4 #5). The buff MEANING — who buffs whom,
 * when, under which conditions — is derived parser-side by
 * `deriveBuffWindows` (src/lib/utils/buffWindows.ts) and shipped as `buff`
 * TimelineWindows; this module only rebuilds the row identity (grouping key,
 * source label) and formats display strings. The ~800-line legacy derivation
 * this file used to hold was removed after a corpus byte-parity proof
 * (phases 4–6 of the arc).
 */

import type { TimelineWindow } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import { getArtifactSetById } from '$lib/data/artifactLookup';
import type {
	BuffEffect,
	ResShredEffect,
	MergedEffectDisplay,
	TeamBuffBar,
	TeamBuffSubrow
} from './types';
import {
	formatBuffDisplayValue,
	formatResShredDisplayValue,
	resShredDisplayStat
} from './buffDisplay';
import { fuseNestedBars, mergeRefreshedBars } from './mergeRefreshedBars';
import { barStepsOf } from './barSteps';

// Re-exported for renderer convenience (the template types against these).
export type { TeamBuffBar, TeamBuffSubrow };

type BuffWindow = Extract<TimelineWindow, { kind: 'buff' }>;

const AB_LABEL = { skill: 'E', burst: 'Q', normal: 'N', charged: 'CA', plunge: 'P' } as const;

/** ⚓ A FIELD'S ROW IS NAMED AND MARKED AFTER THE REACTION THAT MADE IT, not
 *  after the stat it happens to grant. The Polestar Field grants a Cryo bonus
 *  and an Electro one; keyed by stat the row would wear whichever came first and
 *  read as somebody's elemental buff. */
const FIELD_ICON: Record<string, string> = {
	polestar: '/assets/elements/flat-white/stellar.png'
};

export function projectTeamBuffRows(
	windows: ReadonlyArray<TimelineWindow>,
	getCharacter: (id: string) => CharacterData | null
): Array<TeamBuffSubrow & { key: string }> {
	const buffWins = windows
		.filter((w): w is BuffWindow => w.kind === 'buff' && w.receiverId === undefined)
		.sort((a, b) => a.id - b.id);
	const rowMap = new Map<string, TeamBuffSubrow>();

	for (const w of buffWins) {
		const src = w.source;
		if (src.type === 'weapon') continue; // weapon windows are received-surface only
		const char = getCharacter(w.characterId);
		const displayName = char?.displayName ?? w.characterId;

		// Display formatting — same buffDisplay calls the legacy bars made,
		// with the window's carried trigger-time context.
		const formatAt = (ctx: ReadonlyMap<string, number> | undefined): MergedEffectDisplay[] =>
			(w.effects as BuffEffect[]).map((e) => ({
				stat: e.stat,
				displayValue: formatBuffDisplayValue(e.stat, e.value, w.refinementIndex ?? 0, ctx)
			}));
		const steps = w.debuff ? undefined : barStepsOf(w, w.start, w.end, formatAt);
		const effects: MergedEffectDisplay[] = w.debuff
			? (w.effects as ResShredEffect[]).map((e) => ({
					stat: resShredDisplayStat(e.element, e.shredStat),
					displayValue: formatResShredDisplayValue(e.value)
				}))
			: (w.effects as BuffEffect[]).map((e) => ({
					stat: e.stat,
					displayValue: formatBuffDisplayValue(
						e.stat,
						e.value,
						w.refinementIndex ?? 0,
						w.stackContext
					)
				}));

		let rowKey: string;
		let sourceLabel: string;
		let explicitKind: 'buff' | 'debuff' | undefined;
		let rowIcon: string | undefined;
		if (src.type === 'character') {
			if (src.trigger === 'cast' || src.trigger === 'block') {
				const lbl = AB_LABEL[src.abilityClass!];
				rowKey = `${w.characterId}::char::${lbl}${w.debuff ? '::resShred' : ''}`;
				sourceLabel = `${displayName} ${lbl}`;
			} else if (src.trigger === 'afterDuration') {
				const lbl = AB_LABEL[src.abilityClass!];
				rowKey = `${w.characterId}::char::${lbl}::afterDuration${w.debuff ? '::resShred' : ''}`;
				const attribution = w.debuff
					? undefined
					: (w.poolFirstEffect as BuffEffect | undefined)?.attribution;
				sourceLabel = attribution ? `${displayName} ${attribution}` : `${displayName} ${lbl} (end)`;
			} else if (src.trigger === 'nightsoulBurst') {
				rowKey = `${w.characterId}::char::NB`;
				sourceLabel = `${displayName} NB`;
			} else if (src.trigger === 'stackThreshold') {
				// ⚓ Named after the FIRE (stack-threshold round, 2026-09-18): the
				// bar's claim is "when the threshold fired", and a cast-pool row
				// under the same E would fuse two anchors the merge law keeps apart.
				const fire = src.fireLabel ?? `${AB_LABEL[src.abilityClass ?? 'skill']} threshold`;
				rowKey = `${w.characterId}::char::stackThreshold::${fire}${w.debuff ? '::resShred' : ''}`;
				sourceLabel = `${displayName} ${fire}`;
			} else if (src.trigger === 'stacks') {
				// ⚓ Named after what the COUNT is (its `attribution`), else the
				// hosting entry — the bar is the span the count was held, not a cast.
				// Keyed by stat: one key feeds several stats (Odette's A1/C2/C6).
				const what = (w.effects[0] as BuffEffect).attribution ?? src.hostLabel ?? 'stacks';
				rowKey = `${w.characterId}::char::stacks::${what}::${effects[0].stat}`;
				sourceLabel = `${displayName} ${what}`;
			} else if (src.trigger === 'state') {
				// ⚓ Named after the CONDITION, not a cast — the bar's whole claim is
				// "while this state holds", and its span already says when. Keyed by
				// stat so one character gating two stats on one state draws two
				// rows rather than pooling one of the numbers away (the Prune
				// lesson from the faction round).
				rowKey = `${w.characterId}::char::onState::${effects[0].stat}${w.debuff ? '::resShred' : ''}`;
				const attribution = w.debuff
					? undefined
					: (w.poolFirstEffect as BuffEffect | undefined)?.attribution;
				sourceLabel = attribution ? `${displayName} ${attribution}` : displayName;
				if (w.debuff) explicitKind = 'debuff';
			} else {
				// 'reaction' — one row per effect, keyed by its display stat.
				rowKey = `${w.characterId}::char::onReaction::${effects[0].stat}`;
				sourceLabel = `${displayName} reaction`;
				explicitKind = w.debuff ? 'debuff' : 'buff';
			}
		} else if (src.type === 'faction') {
			// ⚓ Named after the BONUS, not the cast — a Secret Rite bar labelled
			// "Sucrose E" reads as an unconditional buff, and the team-composition
			// gate is the most important thing about it.
			sourceLabel = `${displayName} ${src.bonusName}`;
			// ⚠ The stat rides the key. A faction bonus commonly grants the same
			// stat off two different triggers (Prune: +60% ATK on any reaction to
			// himself, +30% to the active character on a Swirl), and those are two
			// claims about two different things — keyed only by bonus name they
			// would pool into one row and one of the two numbers would vanish.
			const scope =
				src.trigger === 'cast' || src.trigger === 'block'
					? AB_LABEL[src.abilityClass!]
					: src.trigger;
			rowKey = `${w.characterId}::faction::${src.faction}::${src.bonusName}::${scope}::${effects[0].stat}${w.debuff ? '::resShred' : ''}`;
			explicitKind = w.debuff ? 'debuff' : 'buff';
		} else if (src.type === 'field') {
			rowIcon = FIELD_ICON[src.fieldId];
			// ⚓⚓ NAMED AFTER THE FIELD, WHICH IS THE WHOLE POINT OF THE ARM. Any
			// party member's Stellar-Conduct raises the same Polestar Field, so the
			// row key carries NO character — two enablers in one party draw ONE row,
			// where the retired per-enabler mirror drew two identical bars labelled
			// after two different characters.
			sourceLabel = src.fieldName;
			rowKey = `field::${src.fieldId}${w.debuff ? '::resShred' : ''}`;
			explicitKind = w.debuff ? 'debuff' : 'buff';
		} else {
			const set = getArtifactSetById(src.setId);
			sourceLabel = set?.name ?? src.setId;
			if (src.trigger === 'cast') {
				const lbl = AB_LABEL[src.abilityClass!];
				rowKey = `${w.characterId}::artifact::${src.setId}::${src.triggerKey}::${lbl}`;
			} else {
				rowKey = `${w.characterId}::artifact::${src.setId}::onReaction::${effects[0].stat}`;
				explicitKind = w.debuff ? 'debuff' : 'buff';
			}
		}

		// Row primary stat: legacy rows key off the DEDUP POOL's first effect
		// for resShred cast/block rows (carried as poolFirstEffect — a
		// per-cast filter may have dropped it from this window's list);
		// everything else keys off the window's own first effect.
		let primaryStat: MergedEffectDisplay['stat'];
		if (w.debuff) {
			const pf = (w.poolFirstEffect ?? w.effects[0]) as ResShredEffect;
			primaryStat = resShredDisplayStat(pf.element, pf.shredStat);
		} else {
			primaryStat = (w.effects[0] as BuffEffect).stat;
		}

		const bar: TeamBuffBar = {
			start: w.start,
			end: w.end,
			effects,
			...(w.fieldStacks !== undefined ? { stacks: w.fieldStacks } : {}),
			...(steps ? { steps, ...(w.stackMax ? { stepMax: w.stackMax } : {}) } : {})
		};
		const existing = rowMap.get(rowKey);
		if (existing) {
			existing.bars.push(bar);
		} else {
			rowMap.set(rowKey, {
				characterId: w.characterId,
				primaryStat,
				bars: [bar],
				sourceLabel,
				...(rowIcon !== undefined ? { icon: rowIcon } : {}),
				...(explicitKind !== undefined
					? { kind: explicitKind }
					: w.debuff
						? { kind: 'debuff' as const }
						: {})
			});
		}
	}

	// The rowMap dedup key (unique by construction) rides on each row so the
	// keyed {#each} renders with that exact identity — coarser keys collide
	// (Chevreuse's dual-element shred rows share one sourceLabel; see the
	// archived each_key_duplicate lesson).
	//
	// Bars refresh-merge per row (2026-08-15): a buff re-applied before it
	// expires is ONE covered span. The display comparison is nearly the whole
	// test — a team bar has no envelope or ICD to disagree about.
	//
	// ⚠️⚠️ THE ONE GATE: A LEDGER BAR NEVER MERGES (⚓ Nate 2026-09-01, who read
	// two 4s grants fuse into an 8s bar and could not tell what it meant).
	//
	// ⚓ THE MERGE LAW STILL HOLDS; THIS ROW IS OUTSIDE IT. "A buff re-applied
	// before it expires is ONE covered span" is about a refresh landing at an
	// arbitrary moment, where the seam would re-encode a cast marker one row up.
	// The Polestar Field's 4s reset is not that: the CADENCE IS THE MECHANIC —
	// the count resets and the buff is re-granted on a clock — so fusing two
	// cycles that happened to pay the same number hides the thing the row exists
	// to show, and leaves an 8s bar with two answers to "how many were recorded".
	//
	// ⚠️ Only bars carrying a count are held out, which is why the field's SHRED
	// still merges into one span across the whole presence: −40% is flat, so its
	// tiles are one debuff stated four times.
	//
	// ⚓ FUSE FIRST, THEN MERGE (pool round, 2026-09-17): the parts of one cast
	// share a start and become one seamed bar; a ledger bar is held out of the
	// fuse for the same reason it is held out of the merge.
	return [...rowMap].map(([key, row]) => ({
		...row,
		bars: mergeRefreshedBars(
			fuseNestedBars(row.bars, (b) => b.stacks === undefined && b.steps === undefined),
			(a, b) =>
				a.stacks === undefined &&
				b.stacks === undefined &&
				a.steps === undefined &&
				b.steps === undefined
		),
		key
	}));
}
