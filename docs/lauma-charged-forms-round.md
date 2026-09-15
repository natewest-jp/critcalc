# The Lauma charged-forms round — scope (2026-09-16)

_Status: SPEC, not started. Scoped at Nate's request after the essential-characters
T0 tranche bookmarked "modelling both of Lauma's charged forms". ⚠️ §0–§8 are the
plan; when the round ships, its record wins where they disagree._

## 0. The ask

Nate, 2026-09-16: two precedents worth having, with Lauma as the first user —

1. **something other than an E/Q that has a cooldown / a change / a chaining**,
   however we end up thinking of it;
2. **a non-hitting input** — an action the player performs that lands no hit and
   applies nothing.

The second is the general one: it is the first time an N/C/P token means "I did a
thing, and the thing was not an attack", and it is the blocker the T0 record named
("a catalyst charged attack ALWAYS applies its element and no field says a charged
attack applies nothing, so the deer would draw a phantom Dendro").

## 1. What the game does (gcsim `internal/characters/lauma/charge.go`, kit text)

Lauma has ONE charged-attack button and TWO things it does:

- **Spirit Envoy Metamorphosis — the deer.** Taken when the Envoy is READY
  (`deerStateReady`, which starts `true`). No hit, no application. Frames are
  `deerFrames`: anim 64, N 61, C 63, E 63, Q 63, J 49, swap 49; dash is
  ILLEGAL in the state (`dash.go` returns an error). The transformation lands at
  frame 49 and the state lasts 10s (+5s at C1). It ENDS on **any action of hers
  except jump and walk** (`chargeInit`'s `OnActionExec` hook), or when she
  **swaps out**, or at expiry.
- **Spiritcall Prayer — the attack.** Taken whenever the Envoy is NOT ready.
  anim 68, every cancel at 67, hitmark 73 (after the release), Dendro 25,
  `ICDTagNone`.

The link between them is a **cooldown that starts when the deer ENDS**: 4s ×
`a4SpiritEnvoyCooldownReduction()` (−0.02% per EM point, floor ×0.8 at 1000 EM).
While it runs, `C` is Prayer; when it lapses, `C` is the deer again.

Consequences the model has to reproduce:

| notation                  | in game                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| `C C`                     | deer, then Prayer (the second C ends the deer AND is the attack) |
| `C E C`                   | deer; E ends it at frame 63; cooldown [63, 303); C = Prayer      |
| `C ~12s C`                | deer expires at 649; cooldown [649, 889); C at 769 = Prayer      |
| `C ~15s C`                | cooldown lapsed at 889; C at 949 = deer                          |
| `C J C`                   | jump does NOT end the deer; second C ends it and is Prayer       |
| `C > Bennett … > Lauma C` | swap ends the deer; cooldown runs from the swap-out              |

Two divergences we will not chase: Q→C cancels at 115 when the deer is ready and
110 otherwise (`burstDeerFrame`; 5 frames, and a cancel key cannot depend on which
`C` follows), and the A4 EM scaling of the 4s (our modifiers have no EM term —
§6).

## 2. What we draw today (probed 2026-09-16, `Lauma` at C0)

Every `C` is Prayer (Nate's T0 call, with a caveat naming the gap):

| notation   | blocks                          | applications                     |
| ---------- | ------------------------------- | -------------------------------- |
| `C C`      | C dendro 68f · C dendro 67f     | Dendro @1.13s, Dendro @2.25s     |
| `C E C`    | C dendro 67f · E · C dendro 67f | Dendro @1.12s (+ the E's stream) |
| `C ~12s C` | C dendro 67f · C dendro 67f     | Dendro @1.12s, @14.23s           |
| `N1 C N1`  | N1 · C dendro 67f · N1          | Dendro @0.28s, @1.40s (N1 gated) |

No state window exists for either form. In the first, third and fourth rows the
first `C` is the deer in game and applies nothing, so the chart is one Dendro
application HIGH and 63–68 frames wrong in the deer's timing.

## 3. What the engine has, and exactly where it stops

Read before changing anything; every line was checked at the site.

**State-gated sibling normals exist** — `resolveActiveAbility` (`sim/resolve.ts`)
takes the first `normal` whose `conditions` evaluate definitively true and falls
back to the unconditioned base. Durin's Denial of Darkness and Zibai's Lunar
Phase Shift are the precedent. A Prayer sibling gated on a state costs no engine
work.

**Post-action states exist** — `actionOpensState.charged` opens a
`TransientStateSpec` at the charged attack's END (Furina's Arkhe toggle). A spec
is a `duration` window or a `toggle`, may `consumes` other states, may
`terminatesOnSwap`, may carry `conditions`. `applyTransientState` opens;
`closeStateWindows` is documented as THE off edge (`sim/states.ts`).

**A state ends four ways today**: its duration lapses; a later opener lists it in
`consumes`; a toggle re-fires; a swap, when `terminatesOnSwap`. ⛔ Nothing ends a
state at **the owner's next action**, and ⛔ nothing opens one state **because
another closed**. Both are needed: the deer's end is "whatever she does next",
and the cooldown is a window that starts at that end, whichever of three causes
produced it.

**The swap-close site does not use the off edge** — `run.ts` ~1546 clamps
`cs.states` and the records inline for `statesTerminatingOnSwap`. A chain hook
placed in `closeStateWindows` would miss the swap unless that loop is routed
through it.

**A silent expiry fires nothing** — the Arkhe round's lint says so in words
("re-resolves at state edges the parse can SEE, ⛔ never at a timed window's
silent expiry"). The cooldown after an EXPIRED deer (`C ~12s C`) must therefore be
materialised either by a scheduled clock task or lazily at the next read. §4.1
chooses lazily.

**"Does this action hit" is answered by the weapon** —
`resolveActionElement` (`utils/actionElement.ts`, shared with the editor's
highlighter) says every catalyst N/C/P is elemental, and `resolveActionIcd`
(`utils/icd.ts`) says a catalyst charged attack is `ICDTagNone` — it always
applies. The charged branch of `run.ts` (~1254–1395) then does three things
unconditionally: stamps `element` on the action event (which makes the block
`elemental-normal`, dendro-tinted), offers the swing to the gauge
(`emitReactionsAtSwing`), and dispatches a parser-private `HitEvent` (which feeds
every `onHit charged` consumer and the buff-window derivation). ⛔ No field on
`NormalAbility` can say "this class of action lands no hit". The only non-hitting
actions in the parser are `D`, `J` and `~?`, hard-coded by class (`hits.ts`
conventions).

**Corpus reach of the second primitive, measured**: a scan of every charged-attack
section's text finds Lauma as the ONLY non-hitting N/C/P in 126 characters. The
adjacent class is on the CAST side and is real: 38 abilities author
`application: []` ("applies nothing") but `handleCast` still dispatches a hit
record for every cast (`run.ts` ~994, `if (char.element) dispatchHit(…)`), and five
characters carry `onHit` effects of that cast's type — Xiangling C1 (E), Kinich
C2/C6 (E), Emilie C2 (E/Q), Venti C2/C6 (E/Q), Anemo Traveler C6 (Q). ⚠️ "applies
nothing" is NOT "lands no hit": Emilie's E has a real hit at Durability 0, so her
C2 firing at cast is correct, while Xiangling's Guoba cast lands nothing and her
C1 shred draws from 0.22s when the first Guoba flame is at 2.10s. That is a
per-ability census against gcsim's `QueueAttack` calls, not a data property, and
it is §7's follow-up — but the field in §4.2 is shaped so a cast can carry it.

**Transient state windows are recorded and never drawn** — `finalize` emits
`kind: 'state'` windows for every transient (symphonyWindow, apexDrive,
transmuting, whiteForm, darkForm, codaWindow, pneuma) and no timeline module
consumes them (only `inStance` reaches a bar, via the stance's cast; `teamBuffRows`
reads a state-trigger SOURCE, not a window). The deer and its cooldown would be
invisible except through the blocks (§6.1).

**The frames audit can reach a state-gated sibling** — `gcsim-map.mjs`
`prereqFor` resolves a single `{type:'state'}` condition through `drivers.json`'s
`states` map, and the dumper accepts `charge` and `attack` as prerequisite steps.
The Prayer is capturable as "charge, attack, then C". ⚠️ An `any(...)` gate is
NOT resolvable there, which is one reason the Prayer gates on ONE state (§4.3).

**Human timing already does the right thing** — N→C and C→C are buffered
transitions (non-bow), so the deer after an N costs no pad; the deer→E pad is
real time spent in deer form and lands before the E that ends it.

## 4. The proposal

### 4.1 Primitive 1 — a state that ends on the owner's next action, and chains

Two fields on `TransientStateCommon` (`types/ability.ts`), both opt-in:

```ts
/** Close this window at the START of the owner's next simulated ATTACK or cast
 *  (N, C, P, E, Q). ⚓ Not D and not J (Nate, 2026-09-16): Lauma dashes and
 *  jumps IN deer form, so movement is not an exit — and not a wait, an unset,
 *  or a token we skip (`W`). A swap is `terminatesOnSwap` and is authored
 *  beside it; the two are different edges. */
terminatesOnAction?: true;
/** When this window ENDS — by expiry, by `terminatesOnAction`, by a swap, or by a
 *  later opener's `consumes` — open THIS window at that instant, once, with the
 *  same provenance. The cooldown that starts when the deer ends. */
onEnd?: { state: State; duration: number };
```

Why a chained NAMED state and not a `cooldown: 4` number on the charged attack
(Nate's first framing): the thing that consumes the cooldown is the Prayer
sibling's `conditions`, and a condition needs a name to read. A number would have
to mint a state anyway, and it would drag the E/Q charge-queue and ghost-tail
machinery toward actions, which draw no pill. "A cooldown on something other than
an E/Q" is, in this vocabulary, **a window that opens when another closes** — and
that shape is reusable for things that are not cooldowns at all.

Mechanics, in `sim/states.ts` and `run.ts`:

- **`settleOwnerStates(ctx, cs, charId, now)`** — a new function, called at the
  TOP of every attack and cast branch of the owner (N, C, P, E, Q — five call
  sites; ⛔ not D or J, per Nate's ruling), at the segment's swap-close site,
  and once more at finalize for anything still pending. It does
  two things in order: (a) closes every live state flagged `terminatesOnAction`
  at `now`; (b) for every record whose `end <= now` and whose spec carries
  `onEnd` and which has not chained yet, pushes the chained window
  `[end, end + duration)` and marks the record chained. (b) is what makes an
  EXPIRED deer's cooldown exist without a clock task: the window is
  materialised at the first read after expiry with the start it always had.
  ⚠️ (b) runs at cast sites too, so a `C ~12s E C` chains the deer's cooldown at
  the E and the C reads it live.
- **Order at an action site**: settle → snapshot (`computeCurrentStates`) →
  resolve → emit → opener. That ordering is the whole `C C` case: the second C
  closes the deer, opens the cooldown, and then resolves against the cooldown
  as Prayer. ⛔ `computeCurrentStates` stays a pure reader — settling inside it
  would mutate on every one of its dozen other callers.
- **The swap-close site** routes through `closeStateWindows` and then the chain
  step, instead of its inline clamp loop, so a swap-ended deer chains its
  cooldown from the swap-out. `consumes` and toggle-off go through the same off
  edge already.
- **Chained windows carry the opener's provenance** (`sourceActionId` of the
  deer's C) and no `source`, which is what `notationParser.ir.test.ts` already
  asserts of every non-`inStance` state window. Ends are finite by
  construction.
- **Lint** (`characterLint.ts`, `transient-state-spec`): `terminatesOnAction`
  must be literally `true`; `onEnd.state` ∈ STATES, `onEnd.duration` finite
  positive; ⛔ `onEnd` on a toggle is refused (a toggle has no end).

### 4.2 Primitive 2 — a non-hitting action class

One field on `NormalAbility`, keyed like `actionOpensState`:

```ts
/** This ability's action of that class LANDS NO HIT: no element on the block,
 *  nothing offered to the gauge, no hit record for any `onHit` consumer. The
 *  positive claim — absent means the weapon rule applies (a catalyst swing is
 *  elemental, a bow's aimed shot is elemental, a claymore swing is physical).
 *  First holder: Lauma's Spirit Envoy Metamorphosis, a charged attack that turns
 *  her into a deer. */
nonHitting?: { normal?: true; charged?: true; plunge?: true };
```

Consumed at the three action branches in `run.ts`: when the RESOLVED normal
ability flags the class, `element` is left `undefined` on the action event (so
the block projects as `normal`, untinted, with no pill in the aura lane),
`emitReactionsAtSwing` and `dispatchHit` are skipped. Frames, cancel keys,
human pads, the transient opener and the block itself are untouched — the
input happened and took its time. ⛔ Not in `resolveActionElement`: that rule is
shared with the editor's highlighter, which has no state machine and cannot know
which form a `C` resolved to (§6.3).

`normal` is per-ABILITY, not per-swing: a non-hitting normal string would flag
its sibling ability, exactly as `infusion` does. No holder exists; the key is
declared so the field is complete and lint-guarded (`nonHitting` keys ∈
{normal, charged, plunge}, values `true`; `nonHitting.charged` beside
`chargedIcdWindow` is a lint warning — a gate on a swing that never applies).
`orphanedSchema.test.ts` sees both new fields read.

The cast-side twin — `nonHitting: true` on a `CastAbility`, skipping the
`handleCast` hit dispatch — is the same word and the same meaning and is
deliberately NOT in this round (§7).

### 4.3 Lauma's authoring

Two states → `State` union AND `characterLint`'s `STATES` set (⚠️⚠️ two edits,
the Odette trap):

- `spiritEnvoy` — the deer. Window, `duration: 10`, `terminatesOnAction`,
  `terminatesOnSwap`, `onEnd: { state: 'envoyCooldown', duration: 4 }`.
- `envoyCooldown` — Metamorphosis on cooldown; `C` is Spiritcall Prayer.

The base normal ability (Peregrination of Linnunrata) becomes the DEER's home:
`chargeFrames` = `deerFrames` `{anim 64, N 61, C 63, E 63, Q 63, J 49, swap 49}`
(no `hit`, no `D` — gcsim forbids the dash, so the D key falls to `anim`),
`nonHitting: { charged: true }`, `actionOpensState.charged` = the `spiritEnvoy`
spec above. The T0 oracle-artefact note retires with it: the dumper's bare `C`
capture IS the deer, and the map now agrees with it.

A sibling normal ability **Spiritcall Prayer**: `input: ['N']`,
`conditions: { type: 'state', state: 'envoyCooldown' }`, the same three `hits`
(a sibling REPLACES the base while its gate holds, so her N1–N3 travel with it —
Durin's dark form is the precedent), `chargeFrames`
`{anim 68, hit 73, N 67, E 67, Q 67, D 67, J 67, swap 67}`. Prayer is
`ICDTagNone`, which the catalyst rule already gives it. ⚓ Gated on
`envoyCooldown` ALONE, not `any(spiritEnvoy, envoyCooldown)`: the settle step
closes the deer before the snapshot, so a `C` during the deer already reads the
cooldown, and a single-state gate keeps the frames audit able to reach the map.

`drivers.json`: `lauma: { states: { envoyCooldown: [{action:'charge'},
{action:'attack'}] } }` — deer, then an N1 that ends it, then the captured `C` is
Prayer. ⚠️ Check what the dumper emits as `hit` for the deer capture (no attack is
queued); `frameMapDisagreements` compares `hit` on normal-style maps and must
treat a `nonHitting` class as having no hitmark tier rather than flag the row.

Timing check of the opener against gcsim: the state opens at the deer C's END
(the cancel slice, 49–63f), where gcsim's transformation lands at 49. For an
action-ended deer the COOLDOWN start — the only thing anything reads — is the
next action's start in both. For an expiry-ended deer with nothing following
(`C ~12s C`), the next key is `swap` = 49, so expiry is 649 in both. The
zero-length deer window of a `C E` is the honest reading of a 14-frame deer.

Then: `npm run generate-character-index`; retire the base normal's caveat; a
new one only if §6.2's pixel is judged real; curator notes rewritten (the T0
note is now the record of what was replaced, not guidance).

## 5. Expected measurements

Corpus digest at C0 and C6: **125 characters byte-identical, Lauma alone moves.**
The engine landing (4.1 + 4.2 with no authoring) must measure byte-identical on
its own before any JSON changes — the constellation-gating and summon-tick rounds'
discipline.

After authoring, the §2 probes should read:

| notation   | blocks                            | applications                     | state windows                                  |
| ---------- | --------------------------------- | -------------------------------- | ---------------------------------------------- |
| `C C`      | C untinted 63f · C dendro 67f     | Dendro @2.17s                    | spiritEnvoy [63,63) · envoyCooldown [63,303)   |
| `C E C`    | C untinted 63f · E · C dendro 67f | Dendro @2.80s (+ the E's stream) | spiritEnvoy [63,63) · envoyCooldown [63,303)   |
| `C ~12s C` | C untinted 49f · C dendro 67f     | Dendro @13.93s                   | spiritEnvoy [49,649) · envoyCooldown [649,889) |
| `C ~15s C` | C untinted 49f · C untinted 49f   | (none)                           | two deer windows, two cooldowns                |
| `N1 C N1`  | N1 · C untinted 61f · N1          | Dendro @0.28s only (N1 gated)    | spiritEnvoy [78,78) · envoyCooldown [78,318)   |
| `C J C`    | C · J · C dendro                  | one, from the second C           | deer survives the jump                         |

Guards worth proposing (approval needed for any new spec file): unit tests for
`settleOwnerStates` on hand-built specs — action-close, swap-close, expiry-chain,
chain-once, jump-does-not-close, toggle-refused — each seeded-negative verified;
and `notationParser.ir.test.ts` gains nothing new (the existing finite-end and
no-`source` invariants already cover chained windows). The roster invariant gate
drives `N1 N2 N3 C P Q E …` per character and will exercise the deer path on
Lauma without change.

## 6. Nate's calls (2026-09-16, all four taken before implementation)

1. **The deer does not draw.** No transient state draws today and this round does
   not start. On the active strip the two forms already differ — the deer is an
   untinted `C` block, the Prayer a dendro-tinted one — and the deer's "length"
   is mostly the wait the player typed. (The hover-name idea — an `InputBlock`
   `title` filled with the resolved ability's name — stays parked.)
2. **A4 is a caveat, not a simulation.** At 1000 EM the cooldown is 3.2s, not
   4s, so a `C` typed 3.2–4s after the deer ends is Prayer here and the deer in
   game; the caveat names that window. C1's +5s deer duration only moves
   `C ~11–15s C` and lives in the curator notes.
3. **Neither a dash nor a jump ends the deer.** ⚓ Nate: gcsim is right — she
   dashes and jumps IN deer form, so movement is not an exit. `terminatesOnAction`
   therefore means the next ATTACK or CAST (N, C, P, E, Q), and D joins J on the
   list of tokens the settle step ignores.
4. **Names approved:** `terminatesOnAction`, `onEnd`, `nonHitting`,
   `spiritEnvoy`, `envoyCooldown`.

## 7. Out of scope, named so it is not reinvented

- **The cast-side twin** — casts whose animation lands no attack still dispatch
  a hit record (§3). Needs a gcsim census of the 38 `application: []` abilities
  (Xiangling E, Venti Q, Anemo Traveler Q are likely; Emilie E is NOT). Same
  field name on `CastAbility`; its own measured landing.
- **§1.L, the stance-CANCEL token** (Ifa, Xilonen, Varesa, Mualani, Jahoda) — a
  token that names the cancel. `terminatesOnAction` is the implicit cousin (any
  action ends it) and does not replace it; stances are not transient states and
  `onEnd` does not reach `cooldownStartsAtStanceEnd`. ⛔ Don't fold them.
- **§1.M, a summon that dies on another cast** — different object, different
  round.
- **The editor's tint** — the highlighter colours every catalyst `C` dendro
  because it reads only the eager index. The deer `C` will be tinted in the
  editor and untinted on the chart. Accepted: the editor already leaves every
  timed infusion neutral for the same reason.
- **Q→C at 115 vs 110**, and Moon Song / Pale Hymn / Verdant Dew — untouched.

## 8. Landings, in order

1. **Engine, primitive 1** — types + lint + `settleOwnerStates` + the six settle
   sites + swap-close refactor + unit tests. Corpus byte-identical.
2. **Engine, primitive 2** — `nonHitting` + the three branch gates + lint.
   Corpus byte-identical.
3. **Lauma** — two states (two edits each), base normal re-authored as the deer,
   Prayer sibling, `drivers.json`, index regeneration, caveat retired, notes
   rewritten. Exactly one character moves; the §5 table is the check.
4. **Record** — this file's record section, CLAUDE.md's Key Types entry for the
   two primitives, the T0 bookmark closed in
   `essential-characters-2026-09-15.md` §7, rubric refresh if N15's wording
   needs to distinguish the implicit end from the token.

Gates per landing: vitest, check, lint, build. e2e before the merge only.
