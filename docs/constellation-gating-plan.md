# A constellation effect is not gated by its own entry

**Status:** 🔴 **OPEN — measured, not built.** Found 2026-08-18 during the Nicole
session; ⚓ Nate bookmarked it for a session of its own. This doc is the prep: the
size, the shape, and the traps, so the next session starts from a plan.

---

## 1. The defect, in one sentence

`ConstellationAbility.constellationLevel` is described as **the canonical gate** (CLAUDE.md,
and `deriveCapabilities` honours it) — but **nothing in the planner path reads it.**
`buffWindows` and friends collect every constellation effect and gate only on the effect's
own `conditions`, so a constellation effect authored without one is live at **C0**.

⚠️ It is not one call site. The recurring idiom

```ts
[...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])];
```

appears **~15 times** — `effectCollection.ts` (`effectSourcesOf`), `stacks.ts` (×10),
`shields.ts`, `cooldowns.ts`, `slotCaveats.ts`, `notationParser.ts` — and not one of them
carries the level.

## 2. How big it is, measured

**Authored (static census over the 123 character JSONs):**

|                                                      | count                             |
| ---------------------------------------------------- | --------------------------------- |
| constellation effects with a constellation condition | 133                               |
| constellation effects **without** one                | **184**, across **77** characters |

By type: buff 104 · damage 38 · energy 14 · resShred 13 · heal 12 · shield 3.
By trigger: `manual` 103 · `onCast` 30 · `onHit` 19 · `passive` 14 · `onReaction` 13 ·
`afterDuration` 3 · `onShieldEnd` 2.

⚓ **The 103 `manual` ones are the reason the authored count and the observed count differ
so much** — a `manual` trigger is not auto-dispatched, so most of the 184 never reach a
surface. ⛔ Don't quote 184 as the user-visible number.

**Observed (prototype).** At C0 a correctly-gated constellation effect already produces
nothing, so stripping ALL constellation effects and diffing the C0 parse measures exactly
the leak, with no engine change needed to size it:

|                                            |               |
| ------------------------------------------ | ------------- |
| characters whose C0 parse changes          | **23 of 123** |
| buff/debuff windows that vanish once gated | **34**        |
| applications                               | **0**         |
| IR events                                  | **0**         |

⚓ **So it is a BARS-ONLY defect.** The aura, the applications and the event stream are
untouched — which also means the gauge round's measurements were never contaminated by it.

⚠️ The probe is one rotation per character (`<name> E Q N5 > Kaeya N5 N5`). A multi-character
rotation will differ; the SHAPE (bars only) is what the probe establishes.
Worst offenders in the probe: klee +7 · razor +3 · durin/kachina/lohen/venti/yoimiya +2.

**The visible ones worth eyeballing** — ungated non-buff effects on real triggers, which
draw debuff/heal/shield bars at C0 today: Beidou C6 resShred · Jean C4 resShred · Klee C2
resShred · Ganyu C1 (resShred + energy) · Nahida C2 resShred · Rosaria C6 · Razor C4 ·
Traveler Anemo C6 · Kaeya C4 shield · Traveler Hydro C4 shield.

## 3. ⚓ The finding that makes the fix safe

Of the **133** constellation effects that DO carry a constellation condition:

- **0** name a level different from their own entry's `constellationLevel`.
- **0** negate it.

So every one of those conditions is **pure duplication of the field**. Gating at collection
cannot change the meaning of a single existing effect — it can only stop the 184 ungated
ones from leaking. ⚓ That is the whole risk assessment for the core change.

## 4. The shape of the fix

**Gate at COLLECTION, not by authoring 184 conditions.** The entry's level is the gate;
making every curator restate it is exactly what produced 184 misses.

1. One helper — `effectSourcesAtConstellation(char, cLevel)` — that returns the flat source
   list with constellation entries filtered by `constellationLevel <= cLevel`. Replace the
   idiom at all ~15 sites. It is greppable and mechanical.
2. `effectSourcesOf` gains the level; its collectors (`getCharacterEffectsForCast`,
   `…ForOnHit`, `…ForAfterDuration`, `…ForOnState`, `…ForTeamNightsoulBurst`,
   `…ForOnReaction`) thread it. ⚓ Their only consumers are `buffWindows.ts` and
   `infusions.ts`, both of which already have `cLevel` in hand — a tight surface.
3. `stacks.ts` is the largest and least obvious (10 sites) and each already receives a
   `constellationLevel`.
4. Decide separately whether to STRIP the 133 now-redundant conditions. ⚠️ Recommendation:
   **leave them.** They are harmless, they document intent at the effect, and stripping
   them is a 133-file diff with no behavioural gain.

## 5. Traps to check before landing

- ⚠️ **`slotCaveats.ts` has the same hole and is NOT a buff path.** A C6 caveat shows in
  the planner's Notes panel at C0. Same one-line fix; count it separately.
- ⚠️ **`notationParser.ts:186`** uses the idiom for `teamHasOnHitStackEffects`, a GUARD
  rather than a dispatch. Gating it changes when the stack settle runs at action sites —
  read the note on that flag before touching it.
- ⚠️ **`constellationScaling` is a different mechanism** (it scales a buff's VALUE at a
  level) and must not be folded into this.
- ⚠️ **`deriveCapabilities` already gates** (`hostConstellation`), and
  `TeamBonusesBlock.svelte` filters on `constellationLevel <= conLevel`. ⛔ Don't
  double-gate the Team Builder — it is already correct, and this is a planner-side defect.
- ⚠️ Effects gated on `not(constellation N)` DO exist (Nicole's A1) but live on PASSIVES,
  so an entry-level gate never touches them. Confirmed: zero on constellation entries.

## 6. How to verify it

- The prototype in §2 IS the expected diff: after the fix, the real C0 parse should equal
  today's stripped-constellations parse. ⚓ Re-run it as a before/after and expect the two
  to converge — 34 windows gone, applications and events unchanged.
- `npx vitest run` — several tests assert on C0 rows and may legitimately move; each one
  that moves should be a bar that should never have been there.
- ⚠️ The gcsim oracles say NOTHING here (they measure applications, which do not move).
- 👀 Nate's eyes on a C0 planner rotation for a couple of the §2 offenders.
