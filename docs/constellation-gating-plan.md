# A constellation effect is not gated by its own entry

**Status:** ✅ **SHIPPED 2026-08-18.** Found earlier the same day during the Nicole
session; ⚓ Nate bookmarked it for a session of its own. §1–§5 are the PREP, kept
verbatim as the record of what was believed going in. **§7 is what landed and what
it measured** — read that first if you are here to change something.

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

---

## 7. ✅ What landed

**The gate is `effectSourcesAtConstellation(char, cLevel)` in
`src/lib/utils/effectCollection.ts`** — abilities + passives + the constellations
unlocked at `cLevel`. It replaced the `[...abilities, ...passives, ...constellations]`
idiom everywhere the walk DECIDES something, and `effectSourcesOf` took `cLevel` as a
**required** parameter so a future collector cannot forget it — a miss is now a compile
error rather than a silent leak.

Sites changed:

| file                    | what                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `effectCollection.ts`   | the helper + `unlockedConstellations`; `effectSourcesOf(char, cLevel)`; all six collectors take the level |
| `buffWindows.ts`        | 15 collector calls — every one already had `cLevel` in hand, as §4 predicted                              |
| `infusions.ts`          | the one `getCharacterEffectsForCast` call (its `constellation` param)                                     |
| `stacks.ts`             | 5 dispatchers + `applyDrain`; the 4 housekeeping walks deliberately NOT gated (see below)                 |
| `shields.ts`            | the `onShieldEnd` listener walk                                                                           |
| `cooldowns.ts`          | `getCharacterCdResetTargets` — the entry gate now precedes the effect-level check, which stays            |
| `slotCaveats.ts`        | takes the effective constellation map; the planner page hands it `{...$constellations, ...rt.tabCon}`     |
| `notationParser.ts:186` | the `teamHasOnHitStackEffects` guard                                                                      |

### ⚓ The one place it is deliberately NOT applied

`stacks.ts` has four walks that collect a KEY SPACE rather than decide a dispatch —
`syncOnReactionToStackState`, `syncOnHitToStackState`, `syncSourceLifetimeToStackState`,
`applyLifetimeExpiry`. They stay ungated, with the reason written at the site:

- a key only a LOCKED constellation introduces can never be granted (its dispatcher IS
  gated), so syncing or expiring it writes 0 over 0;
- a key SHARED between an ability and a constellation is the bad case. Skirk's
  `serpentsSubtlety` is granted by her skill **and** by her C2; Linnea's `fieldCatalog`
  is granted by her C1 and that entry carries the **only** `lifetime` declaration for
  the key. Gate the expiry walk and a stack the ability granted would never expire,
  because the entry that says how long it lives is locked.

⚓ **The rule: gate the walk that asks "does this fire", never the walk that asks
"what keys exist".**

### Measured

The §2 prototype re-run as a before/after, per §6. Probe: `<name> E Q N5 > Kaeya N5 N5`,
123 characters, `[char, Kaeya]` as the slot roster.

|                                             | before    | after        |
| ------------------------------------------- | --------- | ------------ |
| characters whose **C0** parse changes       | —         | **23**       |
| buff/debuff windows removed at C0           | —         | **34**       |
| applications                                | —         | **0 delta**  |
| IR events                                   | —         | **0 delta**  |
| characters whose **C6** parse changes       | —         | **0**        |
| C0 parse vs constellation-STRIPPED C0 parse | 23 differ | **0 differ** |

✅ **The two convergences are the proof.** At C0 the real parse now equals the
stripped-constellations parse — the leak is exactly closed, nothing more. At C6 the
corpus is **byte-identical** either side — the gate never removes an effect the reader
actually has. Applications and events did not move, confirming §2's BARS-ONLY reading.

Ladder spot-check (the off-by-one): Razor's C4 shred appears **at C4**, his C6 crit pair
**at C6**; Klee's C1 ATK% at C1, her C2 shred at C2.

Two of the 23 are not a whole window disappearing but an effect leaving a POOL —
Faruzan's C6 crit DMG was pooled into her A4 anemo-bonus window, Yun Jin's C2
normal-DMG bonus into her burst's flat-DMG window. Both windows survive with one fewer
effect, which is why a count-only diff shows them as unchanged.

### The safety claim, independently re-derived

Re-walked the corpus condition trees (including `not`/`all`/`any` nesting) rather than
trusting §3: **133** constellation effects carry a constellation condition, **0** name a
level other than their own entry's, **0** negate it. **184** carry none, across **77**
characters. All 122 characters with constellations author exactly C1–C6 with numeric
levels — no entry can fall through the gate for want of a level.

### ⚠️ Two of §2's "worth eyeballing" list are NOT what they look like

- **Ganyu C1 / Nahida C2** never showed in the 23-character diff because the probe
  rotation (`E Q N5`) fires neither trigger — Ganyu's shred is `onHit` on a CHARGED
  attack, Nahida's is `onReaction`. Re-probed directly, both behave: Ganyu's `resShred`
  is absent at C0 and present at C1+. §2's list came from the STATIC census, so it names
  candidates, not measured emitters.
- **Traveler Hydro C4's shield is not a leak — it is unmodelled.** `emitShield` reads
  `variant?.effects ?? activeAbility.effects`, i.e. the CAST ability's own effects only,
  so a constellation-hosted `shield` effect reaches no shield window at any level. Seven
  constellation entries author one. That is a pre-existing orphaned-schema gap, out of
  this round's scope — ⛔ don't "fix" it by widening `emitShield` to the constellation
  walk without deciding what a C-gated shield's lane and label should be.

### Left alone, on purpose

- ⛔ The **133 redundant conditions stay** (§4.4). They are harmless, they document
  intent at the effect, and stripping them is a 133-file diff with no behavioural gain.
- ⛔ **`deriveCapabilities` / `TeamBonusesBlock`** untouched — already correct, and
  double-gating is how the Team Builder would start disagreeing with itself.
- ⛔ **`constellationScaling`** untouched — a different mechanism (it scales an
  already-unlocked effect's VALUE).
- **Procs** need nothing: `armCastProcs`/`armSummonProcs` read a resolved ability's or
  summon's effects, never a constellation walk, and the corpus's constellation-hosted
  procs (Fischl C6's coordinated attack, authored on Oz) carry their own condition.

### Gates

`npm run check` ✅ · `npx vitest run` ✅ 1613/1613 · `npm run lint` ✅ · `npm run build` ✅.
⚠️ **No vitest test moved**, which is worth knowing: the suite's C0 fixtures never
touched any of the 34 bars, so the suite could not have caught this and did not confirm
the fix either — the probe above is the whole evidence. `test:e2e` not run (no browser
surface change beyond the two panels' contents).
