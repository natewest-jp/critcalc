# Stellar Reactions

**Sources:** Fandom wiki "Damage" page (Stellar section, pasted by Nate 2026-07-29) +
Nate's trigger-model explanation (2026-07-29, recorded in project memory
`hexerei-stellar-todo`). gcsim had no Stellar implementation as of `5d1ec8c79`
(2026-07-26) — **wiki + Nate are the arbiters for now** (the Hexerei round showed
gcsim can be off on current-patch details anyway).
**Game version reflected:** current patch (Sandrone's release, pre-7.0). 7.0 adds
more Stellar-Conduct enablers and the first Stellar Swirl enablers.
**See also:** [`lunar-reactions.md`](lunar-reactions.md) (the structural template —
Stellar is the 7.x generation following 6.x Lunar), [`elevation.md`](elevation.md),
[`elemental-reactions.md`](elemental-reactions.md), [`factions.md`](factions.md).

> `⚠️ NEEDS-CONFIRM` marks anything unsettled.

## What they are

Stellar Reactions are the **7.x reaction generation**. Like Lunar reactions they
**convert pre-existing reactions into their Stellar variants**, and they are
**enabled by specific characters** — but the gating model differs from everything
before it:

- **NOT faction-count-gated.** There is no "2+ members" condition (unlike Hexerei's
  Secret Rite or Moonsign's Ascendant Gleam).
- **One enabler suffices.** If a party contains a character who enables a given
  Stellar reaction, **all** of the base reaction triggered by **any** party member
  converts (exactly like Ineffa converting all Electro-Charged → Lunar-Charged).
- **Enablement is per-reaction.** A Stellar-Swirl enabler does nothing for a
  character whose buffs key off Stellar-Conduct — the _specific_ reaction must be
  enabled.
- **Buffed characters ≠ enablers.** Many characters carry buffs _conditional on a
  Stellar reaction being enabled_ (e.g. Diona's Stellar-Conduct buffs light up only
  when a Conduct enabler is in the party) without enabling anything themselves.
- **⚠️ Watch for permanent patches:** some Stellar-era buffs on these characters are
  unconditional kit patches with no reaction gate at all (the Hexerei round had the
  same split — per-effect verification required).

| Stellar reaction    | Converts     | Enabled by (current patch) | Live buffed characters            |
| ------------------- | ------------ | -------------------------- | --------------------------------- |
| **Stellar-Conduct** | Superconduct | **Sandrone** (only)        | known roster — see curation round |
| **Stellar Swirl**   | Swirl        | none yet (7.0)             | some buffs already live           |

Example: Diona + Electro teammates trigger Superconduct. Add Sandrone → every
Superconduct becomes Stellar-Conduct AND Diona's Stellar-Conduct-related buffs
activate.

## The damage formula & its buckets

Stellar-Conduct DMG is dealt **through certain character abilities**, like Direct
Lunar reactions — and despite not being triggered by a reaction it **is still
reaction DMG**: it benefits from EM and Reaction Bonus. Fandom's formula:

```
Stellar-Conduct DMG =
  ( Base Reaction Coefficient × %Ability × Stat(Attacker) × Base DMG Multiplier
      × (1 + Stellar Reaction Base DMG Bonus)
      × (1 + EM Bonus + Reaction Bonus)
    + Reaction Additive Base DMG Bonus )
  × Elevation Multiplier × Enemy RES Multiplier × CRIT Multiplier

EM Bonus = (6 × EM) / (EM + 2000)          — identical to Lunar
Base Reaction Coefficient ∈ [1, 2]         — the hit-counter mechanic, below
```

The buckets are the **same five as Lunar** (see `lunar-reactions.md` § buckets):

1. **Base** — the ability's own `%Ability × Stat` scaling (Direct-type; no
   autonomous level-scaled reaction hit is documented for Stellar-Conduct).
2. **EM Bonus** — `6·EM/(2000+EM)`, additive inside the EM bracket.
3. **Stellar Reaction Base DMG Bonus** — its own `(1 + …)` bracket, provided by
   **certain passive talents**. The Lunar bucket-3 analogue → our
   `stellarConductDmgBonus` stat. Explicitly NOT the ordinary Reaction Bonus.
4. **Elevation** — outermost multiplier; expected on higher constellations of the
   new generation's 5-stars (same bucket as Lunar elevation).
5. **Reaction Bonus** — additive inside the EM bracket alongside EM → our
   `*ReactionBonus` stat family (closed 2026-07-29; was the standing Lunar gap).

### The Base Reaction Coefficient (the un-simulatable part)

For Stellar-Conduct the coefficient **scales with the number of recorded Cryo and
Electro hits**:

- **0 recorded** → coefficient **1**.
- **≥1 recorded** → **1.4 + 0.05 × n** for n = 1…12 recorded hits (the wiki's
  "increased by 40% plus an additional 5% for each recorded hit"). Note the
  coefficient never actually _takes_ 1.4 — at one hit it is already **1.45**,
  topping out at **2.0** with 12 hits.

**✅ CONFIRMED (Fandom Stellar-Conduct page table, fetched 2026-07-29):**
1 hit = 1.45 · 2 = 1.5 · … · 11 = 1.95 · 12 = 2.0. The same 4s-window hit count
also drives the Polestar Field's in-field Cryo/Electro DMG Bonus (20% baseline
with no hits; 28% + 1%/hit → 40% at 12) and the field's flat −40% enemy
Physical RES. Hits are recorded per 4s window, count resets each window, buffs
last 4s. The initial field-creating hit is not counted.

**Nate's call (2026-07-29): this hit-recording stack mechanic is beyond what our
tools can simulate** — the planner has no per-hit Cryo/Electro ledger tied to a
reaction coefficient. Treat it as caveat + curator-note territory, never a fake
model.

## → Schema mapping (Tier-2 UNFROZEN 2026-07-29; core BUILT same day)

| Mechanic                                  | Bucket | Our primitive                                                      | Status                                                                                              |
| ----------------------------------------- | ------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Stellar reaction as a trigger             | —      | `Reaction` union `stellarConduct`, `stellarSwirl`                  | ✅ built (stellarSwirl = union-only; no synthetic emission until 7.0 mechanics confirm)             |
| Enablement ("party has an enabler of X")  | —      | `CharacterData.enablesReactions` + `teamEnablesReaction` Condition | ✅ built — parser converts superConduct→stellarConduct off the SLOT roster (presence suffices)      |
| Stellar Reaction Base DMG Bonus           | 3      | `stellarConductDmgBonus` Stat (mirrors `lunar*DmgBonus`)           | ✅ built (Sandrone Light of Rationalisme is the bucket-3 exemplar)                                  |
| Elevation for Stellar                     | 4      | `elevate` Effect + `elevateReactionToDisplayStat`                  | ✅ mapping extended; Sandrone C6 is the first Stellar elevation in the corpus                       |
| Reaction Bonus (additive w/ EM)           | 5      | `*ReactionBonus` Stat family                                       | ✅ CLOSED (Nate's ruling, same day). ⚠️ Fandom's "Stellar-Conduct DMG Bonus" CATEGORY = this bucket |
| Base Reaction Coefficient (hit recording) | 1      | — none —                                                           | ❌ unmodelable per Nate — caveat + `_curatorNotes` only                                             |
| Wiki sweep guard                          | —      | `wiki-capability-config.mjs` categories                            | ⏳ add the four Stellar-Conduct talent/constellation categories on the next snapshot refresh        |

**RP wiring (Nate's ruling 2026-07-29):** the Polestar Field is NOT simulated
(no published lifetime); the requirement is only that **Stellar-conditional
buffs display when an enabler is in the party** — which `teamEnablesReaction`
delivers. The Team Builder's Factions/Buffs "Stellar" filter finds both
enablers (`enablesReactions`) and buff-carriers (index-derived `gatedReactions`).

**✅ RESOLVED (Nate's ruling, 2026-07-29): bucket 5 got its own stat family.**
Nothing ever blocked it but vocabulary — `*ReactionBonus` Stat keys now model
the Reaction Bonus bracket distinctly from the bucket-3 `*DmgBonus` bracket
(labels: "Base Stellar-Conduct DMG" vs "Stellar-Conduct Reaction Bonus").
All five wave sources are authored on it — Wriothesley +30% and Diona C6 +40%
re-keyed; Sandrone C1 (+30% team), Qiqi (+50% party, Superconduct AND
Stellar-Conduct halves), and Cyno C2 (stacked-at-max 80%) newly authored —
plus Diona's Superconduct/Cryo Swirl thirds and **Columbina's burst** on the
Lunar side, closing that doc's standing bucket-5 gap. Authoring rule going
forward: the Fandom category "<Reaction> DMG Bonus" → `*ReactionBonus`;
"Base DMG Bonus" categories → `*DmgBonus`.
