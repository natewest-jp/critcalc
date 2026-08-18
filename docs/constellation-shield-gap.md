# A constellation-hosted shield reaches no lane

**Status:** ✅ **SHIPPED 2026-08-18 (`53db108`). §7 is the record; §1–§6 are the PREP and two of
their readings were wrong — see §7.1.** Found 2026-08-18 while landing the constellation
gate (`docs/constellation-gating-plan.md`); ⚓ Nate asked whether to fix it in the same
session and the answer was no — see §5.

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

⛔ **BOTH READINGS BELOW ARE WRONG — see §7.1.** The kit text answers Nicole (her C2
re-grants the SAME shield to the party), and Traveler Hydro's missing duration is
deliberate, not a lookup.

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

⛔ **THE POOL NAMED HERE IS THE WRONG ONE — see §7.2.** `getCharacterEffectsForCast`
walks every ability of the cast's type and takes no resolved variant; measured, it breaks
Candace, Diona and Yun Jin.

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

---

## 7. ✅ The record (shipped 2026-08-18)

⚠️ **§7.1's Nicole finding is ⚓ Nate's**, landed after the first cut of this section — the
C2 shield is co-op and is now unmodelled, which changes §7.3 from a live rule to a dormant
guard. The measurement below predates the deletion and is unaffected by it: her C2 never
produced a second window either way.

**Measured: two shield windows appear, both at their entry's level, and nothing else in
the corpus moves.** A before/after census of every shield window over all 123 characters
at C0 and at C6 (notation: every declared skill token + `N1 N2 N3 C P Q` + a re-cast)
diffs to exactly two lines, both C6:

```
> beidou  C6  burst  385-1285   (unnamed)
> yanfei  C6  burst  407-1307   (unnamed)
```

C0 is **byte-identical** either side, which is the half `constellationGating.test.ts`
already asserts corpus-wide — and it passes UNCHANGED, as §6 required.

### 7.1 ⚠️ Two of the prep's readings were WRONG

**Nicole C2 was never a lane-design question — it was never a SHIELD.** ⚓ Nate read the
kit text and named it: _"nearby active party members will also gain a Shield of Blazing
Light"_ is **CO-OP**. The phrase is plural only when several players each have an on-field
character; in a single-player party there is exactly one active character, and her
skill's own Shield of Blazing Light (gcsim `Target: -1`, player-wide) already covers them.
**gcsim implements no C2 shield at all** — `nicole/cons.go` c2 is the +300 ATK buff and
the RES ticker, both of which we author; `shield.go` has one `addShield` with no cons
check.

⛔ **So it is deliberately UNMODELLED now, and the house form already existed** — Kirara
C2, whose entry keeps its `description` and carries NO `effects`, with a curator note
saying "Co-op only — not implemented in gcsim". Nicole's C2 entry now matches it: the buff
and the shred stay, the shield Effect is gone, and the reasoning is in her
`_curatorNotes`.

⚠️⚠️ **And it was not inert — it was making a false claim.** `target: 'team'` reached
`deriveCapabilities`, so the Team Builder carried a **`shield / team / C2`** capability
for Nicole: "at C2 she shields the whole party". Measured either side of the deletion:

```
before  shield/active/C0/…skill…   shield/undefined/C0/…skill…   shield/team/C2/…constellation…
after   shield/active/C0/…skill…   shield/undefined/C0/…skill…
```

⚠️ The `target` was wrong twice over: **every other corpus use of this exact phrase is
`target: 'active'`** (Illuga's C? flat DEF, Aino's EM), so even as a single-player effect
`'team'` was the wrong reading.

**Traveler Hydro C4 is not a curation lookup.** The duration is absent _deliberately_ —
the curator note already says so ("Lifetime is channel-bound, so no duration is
authored"), the kit says _"It will persist until the Traveler finishes using the skill"_,
and his skill is `behavior: 'instant'` with no active window to bind to. ⛔ There is no
number to look up; inventing one would be faking timing. Modelling it needs a
channel/stance window on the skill FIRST. Left inert, with the reasoning now in his
`_curatorNotes` so it does not get re-filed as a bug.

**And the unlabelled bar was not a design question either.** Beidou C1 and Yanfei C4
render as the shield lane's generic `"Shield"` — the SAME fallback Xinyan, Diona, Candace
and Lan Yan have used since 2026-08-14. It is not the first of its kind on that lane.

### 7.2 ⛔ The pool the prep named is the WRONG one

§4 said to feed case 2 from `getCharacterEffectsForCast`. **Measured, that breaks three
characters** — it walks EVERY ability of the cast's type and takes no resolved variant:

```
> candace  C0/C6  skill  374-390   (unnamed)               ← the 0.27s TAP shield, on a hold cast
> diona    C0/C6  skill  365-653   (unnamed)               ← the 4.8s TAP shield, on a hold cast
> yun_jin  C0/C6  skill  551-563   Opening Flourish Shield ← the 0.2s base, beside its variant's
```

⚓ **The caller has already RESOLVED which ability this cast is** — that is the whole
point of `registerShieldOnCast` taking `activeAbility` and `variant` rather than a label.
So case 2 is TWO HALVES: half A is that resolved ability's own effects (unchanged), and
half B is `getNonAbilityEffectsForCast` — `effectSourcesOf` MINUS `char.abilities`.

⚠️ The sibling-ability hazard is real independent of variants: **Lan Yan has three
`skill` abilities, two of them stance follow-ups also keyed to `E`**, and only the base
one shields. `getCharacterEffectsForCast(lan_yan, 0, 'skill', 'E')` returns that shield
whichever of the three the parser resolved. ⚠️ `registerInfusionsOnCast` uses the full
pool and carries the same latent hazard — no live case today (no character with a
duplicated skill/burst authors an `infuse`), and it was left alone rather than changed
blind.

### 7.3 ⚓ ONE SPAN, ONE BAR — ⏸️ dormant on its own day

Two shield Effects on one cast that resolve to the SAME span are one shield stated twice.
The lane draws SPANS under the CASTER and has **no notion of a recipient**, so a second
window there is a second bar the reader cannot tell from the first — plus a second
`shieldEnd`, which is the 2026-08-14 double-window class back.

⚠️ It collapses IDENTITY, not coincidence: a genuinely different LENGTH is a different
shield and still draws its own bar.

⏸️ **Nicole was its only author, and §7.1 retired her.** The guard is kept anyway, for the
same reason the summon fallback above it is kept: ⚓ the half-A/half-B pool is what makes
a same-span pair reachable at all, so the guard outlives its author, and the failure mode
is silent. `shields.test.ts` exercises it on a **synthetic re-add of exactly the shape
that was retired**, with a second case at a different length pinning that it collapses
identity rather than merely deduplicating whatever overlaps.

### 7.4 The three guards §4 named, and what each cost

1. **`authorsShieldEffect`** stays computed from the ability half alone — ✅ unchanged.
   ⚠️ The _other_ half of that guard needed the same treatment and §4 did not say so: the
   dormant summon fallback also tests `windows.length === 0`, which a constellation
   window would satisfy. It now asks `!windows.some((w) => w.fromAbility)`, so a
   C-shield can neither satisfy the guard nor suppress the fallback by existing.
2. **`coveredBySummon`** is computed for ability-hosted windows only. A constellation
   shield has no summon twin, so a match could only ever be a duration coincidence —
   which is exactly what the Thoma half of that test exists to refuse.
3. **The both-casts fall-through** is now pinned by **lint B.8a**: a `shield` effect on a
   passive/constellation with an `onCast` trigger must bind `trigger.ability`, at
   `strict`. B.8 already warned for every trigger; for a shield an unbound trigger costs
   a whole extra bar on the wrong cast and a second `shieldEnd`, so it is not a
   preference. All four onCast constellation shields bind explicitly today — the rule
   pins the property rather than fixing anything.

### 7.5 Conditions are evaluated now, and it is a no-op

`registerShieldOnCast` never evaluated an effect's `conditions` at all. It does now, for
BOTH halves, dropping only on a definitive `false` — the same optimistic rule
`registerInfusionsOnCast` uses at the adjacent call, and the same one this file's "a
shield always survives to its scheduled expiry" rests on. ⚠️ Corpus-wide it changes
nothing: no ability-hosted shield carries conditions, and every constellation-hosted one
carries exactly its own entry's level, which the collection-time gate has already
applied.

### 7.6 🔒 Guarded by `src/lib/sim/shields.test.ts`

⚠️⚠️ **The corpus differential could not see this defect and still cannot.** It runs at
C0, where these shields drew nothing before the wire and draw nothing after it. The new
file is the other half — it asserts AT the entry's level:

- Beidou C1 / Yanfei C4: nothing at C(N−1), exactly one window at C(N), of the stated
  length, `coveredBySummon` unset — and still nothing at C0.
- Nicole: ONE window and ONE `shieldEnd` at C0, C2 and C6 — her C2 shield is retired as
  co-op, so this is now the assertion that it stays retired.
- The same-span collapse, on a synthetic re-add of the retired shape (and a
  different-length control).
- The four correctly-inert entries (Columbina C1, Sigewinne C2, Kaeya C4, Traveler Hydro
  C4) draw nothing at C6, so a future author who wires one has to come here and say why.

⚠️ **Every assertion in that file is an ABSENCE**, so a notation the parser could not
read would pass all of them — a mistyped `displayName` did exactly that on the first cut
(Traveler Hydro's is "Hydro Traveler"). The harness asserts `unknownTokens` is empty and
that the subject actually cast, on every parse.

⚓ **Verified by seeded negative**, because a regression test nobody has watched fail is a
decoration: removing half B reds the two clean wires and nothing else; disabling the
same-span collapse reds Nicole and nothing else.

### 7.7 ⏭ What is still open

- **Traveler Hydro C4** — wants a channel/stance window on `Aquacrest Saber` before its
  shield has anything to bind to. Same family as Ifa's stance-CANCEL gap.
- **The lane cannot say WHO is shielded.** Nicole's C2 widening from `active` to `team`
  is real, reaches the Team Builder through the effect's `target`, and is invisible on
  the timeline — for the base shield as much as for the C2. ⚓ Whether that is worth
  surfacing is Nate's call, and it is a lane question, not this round's.
- **`registerInfusionsOnCast`** carries the sibling-ability hazard of §7.2 latently.
