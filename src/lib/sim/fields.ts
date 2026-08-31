/**
 * src/lib/sim/fields.ts
 *
 * ⚓⚓ A REACTION'S FIELD — the Polestar-Field round, 2026-09-01.
 *
 * The Starlight Prism a Stellar-Conduct leaves behind, and the buffs it grants
 * while it stands. Two things live here that live nowhere else in the parse:
 *
 * 1. A WINDOW PRODUCER THAT IS NOT A CAST. Every `summon` window in the IR
 *    comes from finalize's per-track walk over `eBars`/`qBars` and carries a
 *    `sourceCastId`. A Prism has no cast and no owner: any party member's
 *    Stellar-Conduct spawns one, including a Stellar-Conduct caused by a summon
 *    tick. So the producer reads REACTION EVENTS and emits a `gadget` window,
 *    which is the one window kind with no `characterId`.
 *
 * 2. A BUFF VALUE THAT IS A FUNCTION OF WHAT JUST HAPPENED. The field's
 *    Cryo/Electro DMG Bonus is driven by a ledger of the Cryo and Electro hits
 *    that applied an element in the preceding 4s. ⚓ `BuffValue` has `ramping`,
 *    `decaying`, `perStack` and `perTeamCount` and nothing that says "recomputed
 *    per window" — and it does not need one, because THIS producer owns its own
 *    windows: it resolves the number here and stamps a literal `value`, which
 *    `BuffValue`'s `number` arm has always accepted. ⛔ Don't mint a BuffValue
 *    form for this; a form would have to be read by the general effect pipeline,
 *    which never sees these effects.
 *
 * ⚠️⚠️ WHAT THIS REPLACED, AND WHY IT WAS WRONG. Sandrone (2026-07-29) and
 * Odette (2026-08-31) each carried a private mirror of the same three effects on
 * their "Stellar Jubilee" passive, because the corpus has no home for
 * reaction-level data. Two costs: a party fielding two enablers drew two
 * identical bars, and — the part that actually misinformed — the mirror printed
 * the field's ZERO-HIT baseline (+20%) as though it were the value, when any
 * Cryo or Electro hit inside the window takes it to 29% and twelve take it to
 * 40%. A bar labelled "Polestar Field" printing 20% is more authoritative and no
 * more correct, which is why the ledger is not optional here.
 *
 * ⛔ NOT MODELLED, deliberately: the Base Reaction Coefficient (1 → 2.0 on the
 * same ledger). It is a damage-formula term and the tool constitution forbids
 * computing damage. The count is the same; only the DMG bonus is drawn.
 *
 * Sources: Fandom Stellar-Conduct § Starlight Prism + Provided Buffs (fetched
 * 2026-08-31, transcribed in `docs/library/game/stellar-reactions.md`);
 * `docs/curation/polestar-field-round.md` is the round's spec.
 */

import { framesOf } from '$lib/utils/frames';
import type { Effect } from '$lib/types/ability';
import type { ReactionEvent, TimelineWindow } from '$lib/utils/rotationEvents';
import type { AuraApplication } from './aura';
import { mergePresences } from './gadgets';

type BuffWindow = Extract<TimelineWindow, { kind: 'buff' }>;
type GadgetWindow = Extract<TimelineWindow, { kind: 'gadget' }>;

/**
 * ⚠️⚠️ SEVEN SECONDS, NOT SIX, and the number was wrong in this project's own
 * notes until the round's spec corrected it. Fandom, § Starlight Prism: "After
 * Stellar-Conduct is triggered, the resulting Starlight Prism lasts for 7s and
 * will continuously sustain a Polestar Field around it."
 */
const PRISM_LIFETIME_F = framesOf(7);

/**
 * ⚓ THE SECOND CLOCK. "Every 4s, the count is reset, and buffs lasting 4s are
 * granted." ⚠️ It is NOT the Prism's clock — the two run together and are not
 * the same length, which is exactly why the corpus's old 4s-refresh mirror was
 * drawing the grant cycle and calling it the field.
 */
const GRANT_CYCLE_F = framesOf(4);

/** The field's flat enemy Physical RES reduction — stated, ledger-independent. */
const PHYSICAL_RES_SHRED = -40;

/** Hits above this stop moving the number (Fandom's table ends at 12). */
const MAX_RECORDED_HITS = 12;

/** Only these two elements are recorded (Fandom: "hits from Cryo and Electro
 *  attacks on enemies that apply an element"). */
const RECORDED_ELEMENTS = new Set(['cryo', 'electro']);

/**
 * The in-field Cryo/Electro DMG Bonus for a window whose ledger recorded `n`
 * hits.
 *
 * ⚠️ ZERO IS ITS OWN CASE, not the bottom of the ramp: 20% with nothing
 * recorded, then 28% + 1%/hit from the first hit — so one hit is 29%, not 21%,
 * and twelve is the 40% cap. Exactly parallel to the Base Reaction Coefficient's
 * own shape (1 with nothing recorded, then 1.4 + 0.05n), which is what makes the
 * discontinuity look deliberate rather than like a transcription slip.
 */
export function polestarDmgBonus(n: number): number {
	if (n <= 0) return 20;
	return 28 + Math.min(n, MAX_RECORDED_HITS);
}

// ⚓ The presence merge is SHARED with the other reaction gadgets (`gadgets.ts`):
// a Prism, a Thundercloud and a Moondrift field all refresh by REPLACEMENT, and
// one rule for that is what stops three entities drifting apart. Only the
// Polestar Field needs the triggers back, for the ledger below.

/**
 * ⚠️ THE FIELD-CREATING HIT, as an application INDEX.
 *
 * Stated on the Fandom page: "The initial hit that created the Prism is not
 * included."
 *
 * ↻⚠️⚠️ **ONE HIT PER PRESENCE, NOT ONE PER TRIGGER** (2026-09-01). The first
 * cut struck off every Stellar-Conduct's trigger on the reading that each is "a
 * hit that created the Prism". ⚓ Nate counted the bars against the lane's own
 * application dots and found the ledger low by about one per window — which is
 * exactly the refresh triggers. The literal reading is the right one: **"the
 * INITIAL hit" is doing real work in that sentence**; a rule excluding every
 * conduct would have been written as "hits that trigger Stellar-Conduct are not
 * included".
 *
 * ⚠️ This is a text-reading call with NO oracle behind it — gcsim has no
 * Stellar-Conduct at all — so the evidence that decided it is a reader counting
 * dots against a bar. ⛔ Don't re-flip it on a re-reading alone.
 *
 * ⚠️⚠️ IT RESOLVES AN INDEX RATHER THAN COMPARING TIMES. A reaction event carries
 * the instant and the character whose application caused it, and measured
 * (`Sandrone E Q > Fischl E Q > Ganyu E Q N3 C`) every conduct lands on the exact
 * frame of a recorded application with no rounding drift — but a cast that
 * applies two elements on one frame would have BOTH struck off by a time test,
 * undercounting a ledger whose whole job is to count. Striking off one match
 * cannot.
 */
function creatingHitIndex(
	applications: readonly AuraApplication[],
	trigger: ReactionEvent
): Set<number> {
	const i = applications.findIndex(
		(a) => a.time === trigger.time && a.characterId === trigger.characterId
	);
	return new Set(i >= 0 ? [i] : []);
}

/**
 * The ledger for one grant cycle: Cryo/Electro applications inside `[from, to)`.
 *
 * ⚓⚓ THIS IS THE QUESTION THE GAUGE MADE ANSWERABLE. Nate's 2026-07-29 ruling
 * called the hit-recording mechanic unmodelable, and it was: the planner then had
 * no per-hit ledger at all. `ParsedRotation.applications` IS that ledger — it is
 * the stream the gauge was fed, so "hits from Cryo and Electro attacks on
 * enemies that apply an element (as limited by Internal Cooldown)" is not an
 * approximation of it, it is its definition.
 */
function countRecorded(
	applications: readonly AuraApplication[],
	from: number,
	to: number,
	excluded: ReadonlySet<number>
): number {
	let n = 0;
	for (let i = 0; i < applications.length; i++) {
		const a = applications[i];
		if (a.time < from || a.time >= to) continue;
		if (!RECORDED_ELEMENTS.has(a.element)) continue;
		if (excluded.has(i)) continue;
		n++;
	}
	return n;
}

/** The three effects the field provides, at a resolved ledger value. */
function fieldEffects(dmgBonus: number, durationS: number): { buffs: Effect[]; shred: Effect[] } {
	// ⚠️ `trigger` and `target` are required by `EffectBase` and are read by the
	// display formatters, so they are filled honestly: the field's effects are
	// team-wide and caused by a reaction. ⛔ Nothing DISPATCHES off these — the
	// windows are produced here, not by the trigger pipeline.
	const trigger = { type: 'onReaction', reaction: 'stellarConduct', source: 'team' } as const;
	const common = { trigger, duration: durationS, durationType: 'refresh' } as const;
	return {
		buffs: [
			{
				...common,
				type: 'buff',
				target: 'team',
				source: 'character',
				stat: 'cryoDmgBonus',
				value: dmgBonus,
				snapshottable: false
			},
			{
				...common,
				type: 'buff',
				target: 'team',
				source: 'character',
				stat: 'electroDmgBonus',
				value: dmgBonus,
				snapshottable: false
			}
		] as Effect[],
		shred: [
			{
				...common,
				type: 'resShred',
				target: 'enemy',
				element: 'physical',
				value: PHYSICAL_RES_SHRED
			}
		] as Effect[]
	};
}

export type FieldWindows = { gadgets: GadgetWindow[]; buffs: BuffWindow[] };

/**
 * Every Polestar Field this rotation raised, as one gadget window per presence
 * plus the grant cycles that tile it.
 *
 * ⚠️ GRANTS ARE CLIPPED TO THE FIELD'S END. A cycle opening at 4s into a 7s
 * presence would run to 8s on its own 4s duration, one second past the Prism.
 * Everything the field provides is stated as an IN-FIELD effect ("Inside the
 * field…", "All enemies in the field…"), so the honest span is the field's, and
 * a ≤1s tail is not worth inventing a rule for. ⚠️ The alternative reading — a
 * granted 4s buff outliving its field — is not refuted by the text; it is
 * refused because the text does not support it either.
 *
 * `nextBuffId` continues `deriveBuffWindows`' numbering: buff-window ids must be
 * unique across the whole parse because the row projections order rows by their
 * first window's id.
 */
export function deriveFieldWindows(input: {
	reactionEvents: readonly ReactionEvent[];
	applications: readonly AuraApplication[];
	nextBuffId: number;
}): FieldWindows {
	const conducts = input.reactionEvents.filter((e) => e.reaction === 'stellarConduct');
	if (conducts.length === 0) return { gadgets: [], buffs: [] };

	const gadgets: GadgetWindow[] = [];
	const buffs: BuffWindow[] = [];
	let nextId = input.nextBuffId;

	for (const presence of mergePresences(conducts, PRISM_LIFETIME_F)) {
		const excluded = creatingHitIndex(input.applications, presence.triggers[0]);
		gadgets.push({
			kind: 'gadget',
			gadget: 'prism',
			label: 'Starlight Prism',
			start: presence.start,
			end: presence.end
		});

		for (let cycle = presence.start; cycle < presence.end; cycle += GRANT_CYCLE_F) {
			const end = Math.min(cycle + GRANT_CYCLE_F, presence.end);
			// ⚓ THE COUNT DRIVING THIS WINDOW IS THE PREVIOUS WINDOW'S. "Every 4s
			// the count is reset, and buffs lasting 4s are granted" — the buffs
			// granted at a reset are paid for by the hits recorded before it. The
			// first cycle of a presence therefore has an empty ledger and draws the
			// 20% baseline, which is also what the field-creating hit's exclusion
			// implies.
			const recorded =
				cycle === presence.start
					? 0
					: countRecorded(input.applications, cycle - GRANT_CYCLE_F, cycle, excluded);
			const { buffs: buffEffects, shred } = fieldEffects(
				polestarDmgBonus(recorded),
				(end - cycle) / 60
			);
			const base = {
				kind: 'buff' as const,
				characterId: presence.characterId,
				start: cycle,
				end,
				source: { type: 'field' as const, fieldId: 'polestar', fieldName: 'Polestar Field' }
			};
			buffs.push({ ...base, id: nextId++, effects: buffEffects, fieldStacks: recorded });
			// ⚠️ THE SHRED CARRIES NO LEDGER COUNT, AND THAT IS THE POINT. −40%
			// Physical RES is stated flat — it does not move with the recorded hits
			// — so a "recorded hits: 5" line on its tooltip would invite exactly the
			// wrong inference. Leaving it off also lets the refresh-merge do its job:
			// four abutting tiles with identical display and no count to disagree
			// about collapse into ONE bar spanning the field, which is the true
			// shape of a debuff that never changes while the field stands.
			buffs.push({ ...base, id: nextId++, effects: shred, debuff: true });
		}
	}

	return { gadgets, buffs };
}
