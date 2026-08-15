# ICD round

**Status:** ✅ SHIPPED 2026-08-15. Scoped from the far side of the faction-bonuses round (`fec93f8`), which is where the gap surfaced.
**Why it existed:** ⚓ Nate asked what it would take to feed catalyst normals, charged attacks and bow aimed shots into the reaction system, and whether stance infusions would come along. The answer was that the _wiring_ is small and the _ICD model_ is the round.

---

## The one-paragraph version

The parser emitted reactions **only from E/Q casts**. Feeding N/C/P in is a handful of lines — the element was already resolved and already stamped on every action event. But there was **no elemental-application ICD anywhere in `src`**, and casts are naturally spaced enough that its absence never showed. Normals are exactly where it bites: standard ICD is "3 hits or 2.5s", so a catalyst `N5` applies on hits 1 and 4, and naive wiring would emit **five** swirls where the game gives two — on the single most common token in the tool. ICD went in first; normals-feed-reactions then fell out nearly free.

---

## What shipped

**The instrument's model became the shared model.** `icd.ts` moved from the visualizers' lib to `src/lib/utils/icd.ts` and grew a streaming form beside its batch one:

| form                            | fed by                                |
| ------------------------------- | ------------------------------------- |
| `simulateIcd(hitTimes, params)` | the ICD instrument — a whole hit list |
| `createIcdClock` + `icdApplies` | the parser — one swing at a time      |

⚓ **The batch form is written in terms of the streaming one**, so the instrument and the planner cannot drift. The parser test asserts this literally: it re-predicts the parser's normal-attack applications by running `simulateIcd` over the swing times and compares.

**`resolveActionIcd`** is the one rule, alongside `actionElement.ts`. It returns `null` for gcsim's `ICDTagNone` — ⚠️ **`null` is not `NO_ICD`**: an untracked source applies always _and touches no counter_, so it cannot reset a counter it shares a tag with (Mualani's `noICD` normals beside her ordinary ones is the reachable case).

**Two blanket cases live in the rule, not in 166 JSONs.** icd.md's curator signal is "leave the field off when standard", so mass-annotating the default is what it forbids. Both are census results over the local gcsim checkout, cited at the call site:

- **plunges apply every time** — 165 of 166 attacks across per-character `plunge.go` are `ICDTagNone` (the exception is Mavuika's Flamestrider, a bespoke group)
- **catalyst charged attacks apply every time** — every catalyst in the roster is `ICDTagNone` on `charge.go`. Klee's `N1C` loop applying pyro on each C is the observable difference.

**Clocks are keyed `(character, tag)`**, tag ∈ `normal` | `charged`, and live at parse scope beside the aura — rotation-wide, so a swap-out neither resets nor freezes one.

**⛔ E/Q casts stay ungated, and that is the load-bearing decision.** ICD counts **hits**; a cast event is an **ability**. We model a multi-hit skill as ONE application, so a counter over cast events would suppress a second cast that in game lands four more hits — strictly worse than the optimistic model it replaced. Normals are genuinely one swing = one hit, which is exactly where a counter belongs. A consequence worth stating: the `noICD` flags authored on skills and bursts (Cyno, Fischl, Ganyu, Kinich, Lan Yan, Xingqiu) remain inert, now for a stated reason rather than as an unwired field. Only `NormalAbility.noICD` is read, and Mualani is its sole holder.

**A physical swing reaches no clock.** `resolveActionElement` returning `undefined` means the swing applies nothing, and a hit that applies nothing spends no budget — so a physical string followed by an infusion starts the infused counter fresh, which is the KQM model.

**Stance infusions came free, as predicted.** 16 characters carry `NormalAbility.infusion` and `resolveActiveAbility` is stance-aware, so Xiao's burst-stance plunges swirl the moment plunges apply.

---

## Knowingly divergent from gcsim (both bounded, both documented at the call site)

- A **melee infused charged attack shares the NORMAL counter** for 24 characters in gcsim (`ICDTagNormalAttack` on `charge.go` — Keqing, Kazuha, Xingqiu…); we give it its own. Worst case is one extra application per 2.5 s window.
- **Bespoke groups collapse to standard** — Pole Extra Attack's 0.5 s timer, Ayaka's and Yae's charged groups, Oz's 5 s / 4-hit cadence. This is the pre-existing schema gap icd.md already tracks; nothing here made it worse.

---

## ✅ The follow-on shipped the same day — infuse EFFECTS

Landed immediately after, because the ICD round is what made the gap visible: once a catalyst's normals reacted and a Bennett-buffed sword still read as physical, the hole was an inconsistency rather than a silence.

All five are wired — a different mechanism from `NormalAbility.infusion`, which is a field on a stance's normal ability and needs no tracking because **the stance IS the window**. An `infuse` Effect is a timed grant from a cast, and it can land on someone else:

| character | effect                              | target   | gate                 |
| --------- | ----------------------------------- | -------- | -------------------- |
| Bennett   | Fire Ventures With Me → pyro        | `active` | C6 + receiver weapon |
| Candace   | Sacred Rite: Wagtail's Tide → hydro | `active` | receiver weapon      |
| Dori      | Sprinkling Weight → electro         | `self`   | C6                   |
| Kazuha    | Crimson Momiji → anemo              | `self`   | C6                   |
| Lohen     | Unforeseen Strike → cryo            | `self`   | —                    |

⚓ **The `active` case was far simpler than scoped, and the reason is structural: only the active character swings.** A segment IS a character's on-field window, so the swinger is by construction the receiver. There is no separate "who is on field" to track — only a window to be inside. That turned "an infusion window per receiver" into a lookup at consumption.

⚓ **The real work was that one condition tree carries TWO subjects.** `constellation` is a fact about the HOLDER and is known at the cast; `weaponType` is a fact about the RECEIVER and is not known until someone swings. Judging the tree once, at either site, gets one of them wrong. So the cast site drops a window only on a definitive `false`, and the consumption site re-evaluates with the receiver's weapon in hand — each pass resolving what it can.

⚠️ `evalCondition` used to return `null` for `weaponType`, lumped in with the HP conditions the planner genuinely cannot simulate. It is now answerable whenever the context supplies a receiver. **Census over all 123 characters: every `weaponType` condition in the corpus sits on an `active`-target effect** (Bennett C6's buff and infusion, Candace's infusion), so the subject is always the receiver; for a `self`-target effect the receiver IS the holder, so one field serves both.

**That fixed a second thing on the way past.** Bennett's C6 Pyro DMG bonus was drawing a bar for every teammate regardless of weapon. The per-segment slice in `buffWindows` is the one scope where the receiver is concrete — the same structural claim `activeCharFactions` already makes there — so it supplies the weapon too and the bow/catalyst receivers correctly lose that half of the bar (keeping the ungated ATK buff).

Other rules, each with a test: **newest wins** (an infusion is a replacement, not a stack); **a stance infusion beats a granted one** (Xiao's burst stays anemo through Bennett's pyro); **windows are never truncated on swap** — Bennett's 12s is famously still there when you swap back, so cancelling it would be a visible regression rather than a conservative choice.

---

## Still open

**Summon ticks still do not react.** Off-field summon damage ticks synthesize hits at finalize (buff-bar merge round) but feed `deriveBuffWindows` only, deliberately — a finalize-time hit cannot be interleaved into parse-order state. Reactions from Oz, Guoba and friends would need the same two-pass parse that stack effects do.

**`weaponType` is answered only where a receiver is concrete.** The infusion path and the two per-segment buff slices supply one; every team-wide pool has no receiver to ask about, so the condition still returns null there. That is correct rather than partial — but if a holder-facing `weaponType` is ever authored, `receiverWeapon` is the field to split.
