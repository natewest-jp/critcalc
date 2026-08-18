# A constellation-hosted shield reaches no lane

**Status:** 🔴 **OPEN — surveyed, not built.** Found 2026-08-18 while landing the
constellation gate (`docs/constellation-gating-plan.md`); ⚓ Nate asked whether to fix
it in the same session and the answer was no — see §5. This doc is the prep.

⚠️ **It is NOT a leak and the constellation gate did not cause it.** These shields draw
nothing at C0 and nothing at C6 either. It is the [[orphaned_schema]] blind spot the
guard cannot see: `shield` effects ARE read, just not from this source, so a green
`orphanedSchema.test.ts` says nothing here.

---

## 1. The gap, in one sentence

`registerShieldOnCast` (`src/lib/sim/shields.ts`) reads
`variant?.effects ?? activeAbility.effects` — **the cast ability's own effects only** —
so a `shield` Effect authored on a constellation entry reaches no shield window at any
constellation level.

## 2. The seven authors, triaged

| character          | entry | trigger        | duration   | target   | verdict                                 |
| ------------------ | ----- | -------------- | ---------- | -------- | --------------------------------------- |
| **Beidou**         | C1    | `onCast burst` | 15s        | self     | ✅ clean wire — her Q authors no shield |
| **Yanfei**         | C4    | `onCast burst` | 15s        | self     | ✅ clean wire — her Q authors no shield |
| **Nicole**         | C2    | `onCast skill` | 20s        | **team** | ⚠️ needs a decision — see §3            |
| **Traveler Hydro** | C4    | `onCast skill` | **absent** | self     | ⚠️ DATA gap, not wiring — see §3        |
| Columbina          | C1    | `manual`       | 8s         | self     | ⛔ correctly inert                      |
| Sigewinne          | C2    | `manual`       | absent     | self     | ⛔ correctly inert                      |
| Kaeya              | C4    | `passive`      | 20s        | self     | ⛔ correctly inert                      |

⛔ **The three inert ones are not work.** `manual` is not auto-dispatched anywhere (103
constellation effects carry it — the constellation-gating round's §2 makes the same
point), and Kaeya's is gated on `selfHpBelow: 20`, which the planner cannot answer:
`registerShieldOnCast`'s own comment says the planner has no enemy/HP state. Leaving
them is the correct outcome, not a backlog.

⚓ **So the round is 2 clean wires, 1 design question and 1 curation lookup** — not
seven characters.

## 3. The two that are not mechanical

**Nicole C2 is the one to think about.** It is `onCast skill`, and **her skill already
authors its own `shield` Effect**. Wiring the constellation pool naively gives her skill
TWO shield windows at C2. That is precisely the double-window class the 2026-08-14
precedence fix cleaned up (seven abilities registering two identical windows and firing
two `shieldEnd` events per cast — read the note at the head of `registerShieldOnCast`
before touching any of this). ⚠️ It is also the corpus's **only team-target shield**, and
the shield lane has no notion of one: `shieldRows.ts` projects into a `SummonSubrow`
under the CASTER, so a team shield is either one row on Nicole or four rows and a lane
redesign. **Needs the kit text and Nate's call on the lane** — does C2 replace her
skill's shield, or add a second, team-wide one?

**Traveler Hydro C4 has no `duration`** and case 2 requires `duration > 0`, so widening
the pool would still skip it. That is a curation lookup (kit text → duration), not an
engine change, and it belongs to the `ingest-character` recipe rather than here.

## 4. The shape of the fix, for the two clean ones

⚓ **The pool already exists.** `getCharacterEffectsForCast(char, cLevel, castKind,
castLabel)` returns exactly the right list — constellation-gated since 2026-08-18,
variant-replacement rule applied, passive/constellation fall-through handled. The change
is to feed case 2 from it rather than from `abilityEffects`.

⚠️ **Three things the widening must not break**, each with a comment at its site already
explaining why it is shaped as it is:

1. **`authorsShieldEffect`** guards the dormant summon fallback, and its meaning is "the
   ABILITY has spoken". ⛔ Don't let a constellation effect satisfy it — that would let a
   C-shield silently suppress a kit's summon-inferred shield.
2. **The `coveredBySummon` reconciliation** exists because nine abilities author their
   shield as an effect-less `summons[]` entry. A constellation shield has no summon
   twin, so it must not be matched against one by duration coincidence.
3. **The "no explicit `trigger.ability` → fires on BOTH casts" fall-through** in
   `getCharacterEffectsForCast`. All four `onCast` shields declare their ability, so it
   does not bite today — ⛔ but a future one that omits it would register a shield window
   on the skill AND the burst.

⚠️ **Every one of the seven is authored with NO `label`.** The shield lane renders
`Effect.label`, the shield's in-game NAME, and ⛔ inventing one is forbidden
([[shield_summon_split]]). Beidou C1, Yanfei C4 and Nicole C2 have no named shield in
game, so **what an unlabelled shield bar reads as is a design question for Nate** — it
is the first of its kind on that lane.

## 5. ⚓ Why this was NOT folded into the constellation-gating session

Not scope discipline for its own sake — three concrete reasons:

- **It is a different KIND of work.** The gating round was one mechanical change
  verified by a differential. This is 2 wires + 1 lane-design decision + 1 curation
  lookup, and the decisions want the kit text and Nate's eyes, not a probe.
- **The wrong memories are loaded.** This round wants `shield_summon_split`,
  the caveat/curation conventions and the `ingest-character` recipe; the gating session
  was carrying the parser-collection material instead.
- **It touches character JSONs**, and the project's own convention puts char-JSON edits
  in a fresh context (memory `stance_chain_pilot`).

## 6. How to verify it

- ⚠️ **The gcsim oracles say nothing** — a shield leaves no damage event, exactly as the
  tick-cap round found for sibling heal series.
- The differential in `constellationGating.test.ts` must still pass **unchanged**: these
  shields draw nothing at C0 before or after, so a C0 parse still owes constellations
  nothing. ⚓ If wiring them makes that test fail, the gate has been bypassed — that is
  the guard doing its job, not a test to update.
- Assert instead at C1/C4/C2 that ONE shield window appears per cast, and for Nicole
  that her skill does not register two.
- 👀 Nate's eyes on the lane for the unlabelled bar.
