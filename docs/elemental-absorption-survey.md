# Elemental absorption — the survey (2026-09-21)

⚓ Nate, 2026-09-20: absorption gets its own round, **survey first**. This is the
survey. Nothing here is built; §5 is a proposal and §6 is what needs an answer
before a line of engine code.

**Why it exists:** Lynette on a Stellar-Conduct team drew Anemo hits from her
Bogglecat Box and never the absorbed element, so it could not feed the Conduct
she was picked for. Absorption is unmodelled corpus-wide — there is no primitive
in `src/lib/sim` or the schema; `grep absorb` finds only curator notes.

Source: gcsim at `e82383e4e`. Every absorber goes through ONE function,
`pkg/core/combat/absorb.go` `AbsorbCheck(idx, pattern, prio...)`: walk the
priority list, and for each element return it if any enemy (then gadget, then
the player) inside the pattern has an aura that CONTAINS it. First match wins,
so **the priority list is the mechanic** when two auras coexist.

## 1. The census — thirteen sites, eleven characters

Ten `AbsorbCheck` call sites, plus three that read the aura by hand with the
same priority walk (Jahoda, Heizou, Ifa — found by grepping `AuraContains`, ⚠️
which the `AbsorbCheck` grep alone misses).

| #   | character · ability           | priority           | first check                       | poll                              | what locking does                                                                                                                                       |
| --- | ----------------------------- | ------------------ | --------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Venti Q (Stormeye)            | P > H > E > C      | 178f (4th Anemo tick)             | 18f, ≤ 21                         | starts its OWN stream: 15 hits × 24f from the lock, 1U, `ICDTagElementalBurst<El>` on `ICDGroupVenti`                                                   |
| 2   | Kazuha Q (field)              | P > H > E > C      | 81f (hitmark − 1)                 | 18f, ≤ 17                         | each of the 5 DoT ticks (140f, then every 117f) lands a TWIN hit of the locked element on the same frame, 1U, `ICDTagNone` (every twin applies)         |
| 3   | Kazuha A1 (plunge)            | P > H > E > C      | E cast + 1f                       | 6f, until the E's hitmark         | the following plunge lands ONE extra hit of the locked element (200% ATK), 1U, `ICDTagNone`; cleared after                                              |
| 4   | Sucrose Q                     | P > H > E > C      | 136f                              | 18f, ≤ duration/18                | a TWIN per tick (137f, then every 113f — 3 ticks, 4 at C2), 1U, `ICDTagNone`; **C6 fires once AT the lock** (+20% that element's DMG, 10s in gcsim)     |
| 5   | Sayu E (hold)                 | P > H > E > C      | 30f                               | 12f, ≤ duration/12                | a TWIN on each roll tick (every 30f) and on the kick, `ICDTagElementalArt<El>`; the press form checks ONCE                                              |
| 6   | Anemo Traveler E (hold)       | **C > P > H > E**  | first tick + 1                    | 18f, ≤ hitmark/18                 | a TWIN on every cutting tick and on the storm, per-element ICD tag                                                                                      |
| 7   | Anemo Traveler Q              | **C > P > H > E**  | 39f                               | 18f, ≤ duration/18                | a TWIN per tick (9 ticks × 30f from 94f), **2U**, per-element ICD tag                                                                                   |
| 8   | Lynette Q (Box)               | **C > P > H > E**  | box spawn                         | 18f (the gadget's think interval) | starts its OWN stream: Vivid Shots every 134f from the lock (1 shot, 2 at C2… `vividCount`), 1U, ⚠️ `ICDTagElementalBurstAnemo` — the ANEMO tag         |
| 9   | Wanderer A1                   | the 4, minus taken | the skill cast                    | none — two draws at one instant   | no damage at all: up to TWO elements pick BUFFS (Hydro +20 Kuugoryoku cap · Pyro +30% ATK · Cryo +20% CRIT Rate · Electro energy on N/CA hits)          |
| 10  | Lan Yan A1                    | P > H > E > C      | the skill's first hit on an enemy | none — one draw                   | sets the SHIELD's element, and every Feathermoon Ring hit lands a TWIN of that element at 50% (`ICDGroupLanyanRingAttackMix`); no aura → Anemo, no twin |
| 11  | Heizou Q (Windmuster Iris)    | P > H > E > C      | the burst's hit (34f)             | none — one draw per enemy         | each enemy holding an aura is afflicted; the Iris explodes 40f later in THAT element, 1U, `ICDTagNone`; no aura → no Iris                               |
| 12  | Ifa Q (Sedation Mark)         | P > H > E > C      | the burst's hit (41f)             | none — one draw                   | a Sedation Mark hit in the aura's element 38f later, 1U, own ICD group; no aura → no mark                                                               |
| —   | Jahoda Q (robots) / E (flask) | P > H > E > C      | 6f, +41f per robot                | hitmark/3                         | not `AbsorbCheck` but her own `enemyAuraInArea`; ⚠️ **only under Ascendant Gleam** (Moonsign ≥ 2); each robot locks its OWN element                     |

⚠️ Lynette's Box has a second door the others lack: it is a gadget that can be
**HIT** (`HandleAttack`), so a teammate's elemental attack landing on the box
absorbs that attack's element with no enemy aura involved. We have no box to
hit; the aura door is the one we can model.

⚠️ The other `AuraContains` readers are CONDITIONS, not absorbers — "if the
target has Cryo, then…" (Chongyun C4, Kaeya A4/C1, Keqing C2, Lyney A4, Qiqi C2)
— which is `enemyAffectedBy`, already in our vocabulary. ⚠️ Sayu's BURST does
not absorb (her Daruma deals Anemo only); her hold-E does. ⛔ Not verified here:
Chasca, whose shell conversion is by PARTY composition as far as the kit text
goes (the `teamElementPriority` shape, not an aura read) — she has no
`AuraContains` call, which is consistent with that, but her source was not read.

## 2. Three shapes, not thirteen mechanics

**A. The TWIN** (rows 2, 4, 5, 6, 7) — the summon's own tick series keeps its
cadence; once the element locks, every tick lands a second hit of that element
on the same frame. Five of the thirteen, and it is one rule.

**B. The OWN STREAM** (rows 1, 8) — locking STARTS a second series with its own
interval, phased from the lock instant rather than from the cast. Venti 15 × 24f,
Lynette every 134f to the box's end.

**C. The ONE DRAW** (rows 3, 9, 10, 11, 12, Sucrose's C6, Jahoda's flask) — a
single read of the aura at a known instant picks an element, and something
that is NOT a tick series uses it: one extra hit (Kazuha's plunge, Heizou's
Iris, Ifa's Mark), a twin on a character's own swings (Lan Yan), or which of
several buffs applies (Wanderer, Sucrose C6). ⚠️ Heizou and Ifa have a fourth
outcome the others lack: **no aura means the hit does not exist at all.**

All three share the LOCK — poll the enemy's aura from a first-check frame at a
fixed interval, stop at the first priority match, hold it for the life of that
cast — and differ only in the consumer.

## 3. What we draw today

| character      | authored                                                                                     | absorbed element                                                                         |
| -------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Venti          | Stormeye 8s, Anemo every 0.4s (+0.2), gate 60f/3                                             | nothing; his notes describe the 15 × 24f stream                                          |
| Kazuha         | Autumn Whirlwind 8.78s, Anemo every 1.95s, `icdGate: 'none'`                                 | nothing; A1's plunge hit unauthored                                                      |
| Sucrose        | Large Wind Spirit 6s, Anemo every 1.883s, cap 3                                              | nothing; **C6 deleted 2026-09-21 with a restore spec**                                   |
| Sayu           | hold-E is a cast `application[]` (two Anemo entries)                                         | nothing                                                                                  |
| Anemo Traveler | hold-E is a 7-entry `application[]`; Gust Surge 4.03s, Anemo every 0.5s                      | nothing                                                                                  |
| Lynette        | Bogglecat Box 12.6s, Anemo every 0.983s (+2.033)                                             | nothing — Nate's report                                                                  |
| Wanderer       | no summon                                                                                    | **A1's Cryo branch deleted 2026-09-21 with a restore spec**; Pyro/Electro never authored |
| Lan Yan        | skill `application: [{ frame: 7 }]` — ⚠️ an entry with NO element                            | nothing; the ring twin and the shield's element are unauthored                           |
| Heizou         | burst `application: [{ frame: 34 }, { frame: 34, anemo, 1U }]` — ⚠️ the first has NO element | that element-less entry is the Iris waiting for this round                               |
| Ifa            | burst `application: [{ frame: 41, anemo, 1U }]`                                              | nothing; the Sedation Mark hit is unauthored                                             |
| Jahoda         | robots carry a HEAL series only                                                              | nothing; the robots' damage is unauthored entirely (tick-gaps round, held)               |

## 4. What the engine already has

- **The live gauge answers the question.** `ctx.aura` is a real gauge on the
  clock (`sim/aura.ts`), and an absorb poll is "at frame F, which of these
  elements does the target hold" — `gauges()` after `advanceTo(F)`. ⚠️ It must
  be asked LIVE, as a clock task: the answer depends on every application
  before F, and the absorbed stream's own applications change every later
  answer (the feed-order law).
- **The tick chain is one tick at a time** (`sim/aura.ts`), each fired tick
  scheduling the next and re-asking whether the summon lives. A poll chain is
  the same shape and retires the same way — the generation stamp.
- **A refused tick keeps its cadence** (the Radiance-window round): a series
  gated on something that is not true yet is asked PER TICK in both readers,
  and the original phase survives. Shape A is exactly that, gated on "locked".
- **`ElementRef`** already lets a field name an element that is resolved rather
  than literal (`teamElementPriority`, Varka). ⚠️ It resolves at PARSE START off
  party composition and is NOT read on a summon tick's `element` today.
- **Published markers.** `TimelineWindow.ticks` is stamped by the parse, so a
  tick that exists only after a lock is drawn only if the live chain publishes
  it — the Lumi ruling (⚓ Nate: published by the live chain, ⛔ never replayed
  at finalize) is the precedent and applies unchanged.

## 5. Proposed primitive (NOT built — for discussion)

**One lock per summon, three consumers.**

```jsonc
// on a Summon (shapes A and B) or on a cast ability (shape C)
"absorbs": {
  "order": ["pyro", "hydro", "electro", "cryo"], // the priority IS the mechanic
  "from": 178,     // FRAMES after the cast — first poll
  "every": 18,     // FRAMES between polls; absent = one draw
  "polls": 21      // absent with `every` = until the window ends
}
```

- The live chain runs the polls as clock tasks; the first match is stored on the
  summon's live record and published as `TimelineWindow.absorbed = { element, at }`.
- **Shape A:** a tick series names `element: { "type": "absorbed" }`. Unlocked,
  the tick is refused and keeps its cadence; locked, it lands in that element.
  The twin is authored as the SAME series twice (the "cadence can change"
  precedent: two series, mutually exclusive by construction), so its `units`,
  `icdGate` and marker are its own. Kazuha's and Sucrose's twins are
  `icdGate: 'none'`; the Traveler's burst twin is 2U.
- **Shape B:** the same series with `phase: 'absorbed'` — its first tick is
  measured from the lock, not from the spawn. Venti `interval 0.4, tickCap 15`;
  Lynette `interval 2.233`.
- **Shape C:** `application[].element: { "type": "absorbed" }` on the cast that
  carries `absorbs` — Heizou's Iris and Ifa's Mark are exactly this, an entry
  that lands in the drawn element or NOT AT ALL (an unresolved `ElementRef`
  already means "applies nothing", Varka's rule). Kazuha's plunge add-on and
  Lan Yan's ring twin ride a character's SWINGS and want the lock carried from
  the skill cast to a later action — the `coInfusion` slot is the nearest
  existing shape. The buffs (Wanderer A1, Sucrose C6) want a Condition leaf
  `{ "type": "absorbed", "element": "cryo" }`.

What the reader sees: the summon's lane gains tick marks in the absorbed
element's colour from the lock onward, the aura lane gains their applications
and the swirls/reactions they cause, and nothing appears when no aura was there
to absorb — which is the honest answer for a rotation that casts Venti first.

## 6. Open questions — these need Nate

1. **Scope of the first cut.** Shapes A + B cover the seven SUMMON absorbers
   (rows 1, 2, 4–8) with one lock and one tick-series change, and they are what
   the report was about. Shape C is four unrelated consumers (a cast's own
   entry, a swing twin, a plunge add-on, buff selection). Recommend: A + B
   first; then the cast-entry half of C (Heizou, Ifa — two element-less entries
   already sit in the data waiting); then the swing/buff half; Jahoda last (she
   also needs her robots' damage authored and sits behind a Moonsign gate).
2. **Lynette's box being hit.** The aura door is modellable; the "a teammate's
   attack hits the box" door needs box geometry we do not have. Recommend: aura
   only, no caveat unless a pixel is wrong (in a Conduct team the enemy carries
   Cryo/Electro, so the aura door opens anyway).
3. **Two absorbed elements at once.** With Pyro and Hydro both on the target the
   PRIORITY decides (Pyro). Our gauge holds coexisting auras, so this falls out —
   but "Frozen" and "Quicken" are compound states: gcsim's `AuraContains(cryo)`
   is true on a Frozen target. Proposed: a compound counts as its parents
   (Frozen → Cryo and Hydro; Burning → Pyro; Quicken → nothing, Dendro is not
   absorbable). Needs a yes.
   ✅ **ANSWERED IN GAME (Nate's combat logs, 2026-10-14, Sucrose Q):
   Frozen counts as CRYO, never as Hydro.** A Frozen-ONLY target (2U Hydro → 2U
   Cryo, and the reverse — the trigger swallows the aura) absorbs: the Swirl line
   proves the Frozen was alive at the check, and the absorbed hit (`866`, 1U) lands
   every tick after, identical in both orders. Permanent Cryo + Frozen absorbs Cryo
   (if Frozen were Hydro, Hydro would win by priority); permanent Hydro + Frozen
   absorbs Hydro (priority). The earlier "1U + 1U absorbs nothing" tries were a
   THAW: 1U-on-1U Frozen lives ~2.9s, about the swap-and-cast time. ⚓ So the
   proposal narrows to **Frozen → Cryo** — exactly gcsim's `AuraContains(cryo)`.
   (`866` is Cryo cyan, confirmed by Nate.) Swirl also reacts with Frozen as its
   own aura — see `docs/library/game/stellar-reactions.md` § Swirling a Frozen target.
4. **Sucrose C6's length.** gcsim: 10s from the lock. Kit text: "during its
   duration", which reads as the burst's. The restore spec flagged the
   disagreement; it is an in-game check (add to the 2026-09-23 batch?).
5. **The marker grammar.** Twin ticks land on the SAME frame as the Anemo tick,
   and one-mark-per-frame (⚓ Nate, 2026-09-19) dedupes them to one stub. For an
   absorbed twin that erases the very thing the round exists to show. Proposed:
   the dedupe keeps one mark per (frame, ELEMENT), so a twin draws a second stub
   in its own colour. Needs Nate's eye.
6. **Does the oracle reach it?** The dumper runs one character in an empty core:
   no aura, so no absorber ever locks. Every number above was read from source,
   not measured. A two-character driver (an aura applier + the absorber) would
   let the frames audit see the absorbed stream; without it the round has no
   oracle, like Aino's Moonsign branch.

## 7. What waits on this round

- Sucrose C6 "Chaotic Entropy" and Wanderer A1 "Jade-Claimed Flower" — both
  deleted in the `manual` retirement with full restore specs in their
  `_curatorNotes` (shape C).
- Jahoda's robots and flask (`docs/summon-tick-gaps-round.md`).
- Lan Yan's and Heizou's element-less `application[]` entries.

## 8. ⚓ Nate's answers (2026-10-17) — the round is GO, pre-launch

1. **Scope:** Shapes A + B first (Venti Q, Kazuha Q, Sucrose Q, Sayu hold E, the
   Anemo Traveler's E and Q, Lynette's Box), then the cast-entry half of C
   (Heizou's Iris, Ifa's Sedation Mark). Kazuha's plunge, Lan Yan, Wanderer A1,
   Sucrose C6 and Jahoda follow later.
2. **Lynette:** the aura door only, no caveat.
3. ✅ Answered in game (above): Frozen counts as Cryo.
4. Sucrose C6's length stays a bounty (Nate has no C6) — it is not in this cut.
5. **Markers:** one mark per frame AND element — an absorbed twin draws a second
   stub in its own colour; same-element duplicates still collapse.
6. **Oracle:** Nate's 2026-10-14 Sucrose Q logs + gcsim source are the acceptance
   test; a Kazuha Q log is queued in the in-game batch. No two-character driver.

## 9. ✅ Built (2026-10-17, `feat/elemental-absorption`)

- **The lock** — `AbsorbSpec` (`absorbs` on a `Summon`, a cast, or a variant) and
  `sim/absorb.ts`: polls on the live clock (`Band.LAND`, after the frame's hits),
  first element of `order` held — Frozen counting as Cryo, Burning as Pyro
  (gcsim `AuraContains`).
- **Summon consumers** — `summonTick.absorbed: 'twin' | 'stream'` (an effect with
  no `element`), plus `summonTick.units` for the Traveler's 2U twin. A twin before
  the lock is refused and keeps its cadence; a stream starts at the lock. Marks
  and hits are PUBLISHED by the live chain (`ctx.absorbedMarks` →
  `TimelineWindow.absorbedTicks`; `ctx.strikeLandings` → hit records); the walks
  skip absorbed series. ⚓ Markers: one per frame AND element — a twin draws its
  own stub in its element, 1px beside the Anemo stub (timeline + PNG export).
- **Cast consumers** — `application[].element: {type: 'absorbed'}`, decided at
  the entry's landing (`emitAbsorbedAtCast`), on its own per-cast counter unless
  `noICD`; nothing locked → no application and no hit (left out of `hitsAt`).
- Lint D.54. Tests `sim/absorb.test.ts` (Frozen → Cryo from Nate's logs).

**Authored** (gcsim 4eda9fc5f, each in the character's notes): Venti Q (own stream,
15 × 24f), Lynette Q (Vivid Shots every 134f + 15f travel; C2's second shot on a
named shared counter), Kazuha Q (twin, authored BEFORE its Anemo series — gcsim
lands it first), Sucrose Q (twin, capped like its Anemo series), Anemo Traveler Q
(2U twin, ICDTagNone — gcsim never writes its per-element tag) and hold E (six
twins on one counter), Heizou Q (the Iris; the old element-less entry was gcsim's
0-durability aura check, retired), Ifa Q (the Sedation Mark). Heizou's and Ifa's
draws sit one frame before their own hit — gcsim reads the aura first.

**Not in this cut / open:**

1. ✅ **Sayu** — built 2026-10-17 as a held cast (§10).
2. Venti's stream is CUT at the Stormeye's end; gcsim lets all 15 outlive it.
   Believed to be the game's behaviour, unverified (a Venti log would settle it).
3. Lynette's last shot within 15f of the box's end is dropped (the window bounds
   the landing). A4 on lock not modelled.
4. Kazuha's plunge add-on, Lan Yan, Wanderer A1, Sucrose C6, Jahoda — later (§8).
5. ✅ The absorbed stubs' colour on the bar — settled as a FILL, not a mark (§11).

## 10. ✅ Sayu's held Windwheel (2026-10-17, `feat/sayu-hold`)

⚓ Nate: Sayu mains roll for most of the skill, so `hE` is the FULL hold and a time
token shortens it — the Mizuki behaviour. But Mizuki's stance machinery is the wrong
host. Mizuki acts during Dreamdrifter; Sayu can do nothing but end the roll, and
everything after it moves with its length (gcsim `skillHold(duration)`). So the hold
is ONE cast whose length the player sets:

- **`AbilityVariant.held {max, from, cooldownPerSecond}`** (`HeldCast`, lint D.55).
  `D` is a `~Xs` written right after the cast, clamped to `max` (600f); any excess
  stays a wait. With no time token she rolls the full 600f.
- **Everything after the release moves by `D`:** every `frames` entry,
  `cooldownStartDelay`, and each `application[]` entry marked `held: 'after'`
  (the kick). Entries marked `held: 'during'` (the roll ticks, authored to the
  longest hold) land only while `frame − from ≤ D`. One resolver,
  `heldApplications`, feeds every reader of the cast's list.
- **The cooldown** is 6s + D/2, through the ability's cooldown modifiers.
- **Absorption** polls only while she rolls (gcsim's `duration/12` checks), from 30f
  every 12f, Pyro > Hydro > Electro > Cryo.
- **The data, from gcsim:**
  - Roll ticks at 18 + 30k, each with an absorbed twin on standard ICD per element.
    gcsim lands the twin 1f after its tick; ours is authored on the same frame, after
    the Anemo entry, so the boundary tick at 30k = D keeps its twin.
  - The kick at 67 + D (no ICD), and its absorbed hit 1f later.
  - Frames N/Q 109, D/J 108, swap 106, each + D.
  - CD start at 50 + D.
- **gcsim's ShortHold is retired** (kick 48, swap 87, 6.2s); tap and hold cover how
  she is played.
- Tests in `sim/heldCast.test.ts`.

**Not done / known:**

- **The E re-press** ("use the skill again to end it early") has no token. A `~Xs`
  says the same thing.
- **The frames audit compares gcsim's dumper hold (`hold=1`)** with our D = 0
  nominal list: off by one frame, and 22 hits against 2. This is an oracle
  artefact, ⛔ never migrate (CLAUDE.md's artefact list).
- **Static readers** (Team Builder, coverage) see the nominal list: all 21 roll
  ticks, and the kick at 67.
- **C2** (the kick's +3.3% per 0.5s rolled) is unchanged.

## 11. ✅ The bar becomes the element (2026-10-17, `feat/absorbed-fill`)

The first build drew each absorbed hit as a stub in its element, 1px beside the
Anemo stub. ⚓ Nate: hard to find, and Cryo on Anemo read as white.

A `/lab` board (`experiment/foreign-marks`) ran three rounds:

1. Marks: a bead, a lock band, a notch. Practical but clunky — a foreign colour
   stamped on a plain bar.
2. Nate's wave split (Anemo above, the element below, an airy seam). Closer, but
   Cryo still vanished on Anemo.
3. **Varka's rule: the bar BECOMES the element.** ✅ Candidate D, chosen as built.
   A soft-note variant (E, NB-style `hi` patches) barely showed and was dropped.

**Built:**

- From the first absorbed hit the summon bar fades into the absorbed element over
  `ABSORB_FADE_PX` (24 screen px), then stays that element to its end, under its
  label.
- **Ticks merge to ONE stub per FRAME.** A twin collapses into the Anemo tick it
  shares a frame with; a stream on its own cadence (Venti, every 24f) keeps its
  stubs. A stub past the fade takes the element's `hi`.
- ⚓ This retires §8's "one mark per frame AND element". The aura lane is where an
  absorbed hit's element is read (⚓ Nate).
- `$lib/timeline/summonMarks.ts` is the one rule; the timeline
  (`.rp-summon-absorbed`, a single gradient, not the tiled fill the Safari veto
  forbids) and the PNG export both read it.
- Tests in `sim/absorb.test.ts`.

### 11.1 Columbina's Lunar hits are moonbeams (same day, `feat/lunar-gleam`)

The same board took Columbina's threshold fires (Gravity Interference), which had
been drawn as a 2px full-height slab in the reaction's element. ⚓ Nate: in game
those strikes are moon-power lilac, not the element. Tried: the slab fading to
Hydro either side, lilac ticks at three strengths, and a moonlight gleam.

**Chosen (3e):** a FALLING gleam, 10px wide (6 on the board; ⚓ Nate went to 7, then 10 — it is the only thing that marks these hits), white at its core through a light
lilac (the Moonsign `#b0a9ff`, 40% of the way to white) to nothing at its sides.
It is brightest at the bar's top edge and gone by its foot, where the ticks rise
from, so the two never share pixels. The constants live in
`timeline/summonMarks.ts` (`LUNAR_GLEAM_*`). The timeline uses a mask; the PNG
export draws rows at a falling alpha. The hit's element is no longer drawn.
