# Stellar Reactions

**Sources:** Fandom wiki "Damage" page (Stellar section, pasted by Nate 2026-07-29) +
Nate's trigger-model explanation (2026-07-29, recorded in project memory
`hexerei-stellar-todo`). gcsim had no Stellar implementation as of `5d1ec8c79`
(2026-07-26) — **wiki + Nate are the arbiters for now** (the Hexerei round showed
gcsim can be off on current-patch details anyway).
**Game version reflected:** ↻ **7.0 (genshin-db 5.2.13, ingested 2026-08-31)** —
Stellar Swirl went live and the enabler roster grew from one to three. The
pre-7.0 edition of this file is preserved in git history; the tables below are
current.
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

| Stellar reaction    | Converts                    | Enabled by (7.0)                      | Live buffed characters                                          |
| ------------------- | --------------------------- | ------------------------------------- | --------------------------------------------------------------- |
| **Stellar-Conduct** | Superconduct                | **Sandrone · Odette · Cryo Traveler** | Wriothesley, Yae Miko, Qiqi, Cyno, Beidou, Diona                |
| **Stellar Swirl**   | Cryo Swirl ⚠️ NEEDS-CONFIRM | **Sandrone · Odette · Cryo Traveler** | Kazuha, Sucrose, Sayu, Heizou, Mizuki, Varka, Ifa, Prune, Skirk |

⚓ **All three enablers convert BOTH reactions, via one shared passive shape.**
"Stellar Jubilee: <name>" is the house form, identical across the three but for
the ATK ratio (Sandrone 0.7%/cap 14% · Odette 0.7%/cap 14% · Cryo Traveler
0.35%/cap 7%):

> "When a party member triggers a **Superconduct or Cryo Swirl** reaction, it
> becomes a **Stellar-Conduct or Stellar Swirl** reaction instead, and the Base
> DMG of said reaction is also increased by X% for every 100 points of ATK."

⚓⚓ **RESOLVED (⚓ Nate, 2026-08-31): Stellar Swirl is CRYO SWIRL ONLY**, and it
is enabler-gated exactly like Stellar-Conduct. Diona and Sucrose carry Stellar
Swirl wording in their kits now, but they trigger plain Cryo Swirl until an
enabler (Sandrone / Odette / Cryo Traveler) joins the party — then **every** Cryo
Swirl converts automatically.

⛔ **This is a fact about the REACTION, not about the enabler's element.** All
three enablers are Cryo, so the observed data cannot distinguish "Cryo Swirl is
the base" from "the swirl matching the enabler's element" — the mechanic is
stated the first way. Cryo Swirl is Stellar Swirl's base exactly as Superconduct
is Stellar-Conduct's. ⛔ Don't generalise on a future non-Cryo enabler without
re-confirming. Implemented in `src/lib/sim/reactionBridge.ts`; ⚠️ `SWIRL_OF`
maps both `cryo` and `frozen` to `cryoSwirl`, so a swirl off a frozen aura
converts too.

## ⚓⚓ A BUFF ON THE BASE IS NOT A BUFF ON THE CONVERTED REACTION

⚓ Nate, 2026-08-31 — **the single most important rule for authoring these, and an
earlier draft of this file asserted the exact opposite.**

**In a Sandrone party, Diona's C6 Superconduct bonus does NOT fire.** No
Superconduct is happening. Buffs to newer-generation reactions are granted by
**explicitly naming them**, and usually at a different scaling, because the newer
reactions carry extra terms in their damage formula (they can CRIT, among other
things).

Consequences for authoring, and they are the opposite of what you might reach for:

- ⛔ **Do NOT make a converted reaction "satisfy" a listener for its base.** A
  subsumption rule was considered and is REJECTED.
- ⛔ **Do NOT pair up OR-arrays whose kit text was not itself updated.** An effect
  going dark in an enabler party is **CORRECT**, not a defect to repair.
- ✅ **Author exactly what the kit text says.** For responding to a reaction, the
  text IS the authority.
- ⚠️ **This differs from TRIGGERING**, and the distinction is real: any party
  member can _cause_ a converted reaction without naming it (see the model
  above), but only an effect that _names_ it is buffed by it. ⛔ Don't collapse
  the two.

⚠️ **So the corpus is already correct where it looks unpaired.** Venti, Lohen,
Clorinde and Diona list a base reaction without its converted counterpart, and
that is right — their kit texts were not rewritten. ⛔ **Nothing here needs a
lint rule and nothing needs a bulk fix.** The only characters that DO need the
converted reaction added are the ones whose 7.0 text now names it — the eight
Anemo kits rewritten to "Swirl or Stellar Swirl".

⛔ **`enablesReactions` is the ARMING SWITCH.** A conversion is inert until some
character declares the reaction. Declare enablers only when the corpus is ready
for their teams to convert.

## ⚓ The RADIANCE idiom — how to author a Radiance-gated effect

⚓ Nate, 2026-08-31. **Radiance needs no new schema** — it is a composition of two
conditions we already have, and writing it down once is what keeps Sandrone,
Odette and Cryo Traveler saying the same thing.

**The mechanics, as stated:**

- A **Polestar Field** is created only by Stellar-Conduct reactions/DMG; a
  **Stellar Vortex** only by Stellar Swirl.
- A character is in **Radiance: Stellar-Conduct** while inside a Polestar Field,
  and in **Radiance: Stellar Swirl** for **8s** after a nearby party member
  triggers a Stellar Swirl.
- ⚓ **Both can exist at once** (a team fielding Conduct and Swirl triggerers
  together), and ⚓⚓ **on any one-or-the-other split, Stellar-Conduct WINS.**
  Cryo Traveler's kit suits both playstyles and plays as the Conduct variant
  when both are up.

**The idiom.** ⚠️ Enablement alone cannot separate the two — all three enablers
enable BOTH reactions, so `teamEnablesReaction` is true for Conduct in every
Swirl team. What distinguishes them is whether the team can actually PRODUCE the
base reaction, which is an element question. For a Cryo holder:

```jsonc
// Radiance: Stellar-Conduct — Superconduct needs an Electro teammate.
{ "type": "all", "conditions": [
    { "type": "teamEnablesReaction", "reaction": "stellarConduct" },
    { "type": "teamElementCount", "elements": ["electro"], "comparison": ">=", "value": 1 }
] }

// Radiance: Stellar Swirl — Cryo Swirl needs an Anemo teammate, AND Conduct
// must not be available, because Conduct takes precedence.
{ "type": "all", "conditions": [
    { "type": "teamEnablesReaction", "reaction": "stellarSwirl" },
    { "type": "teamElementCount", "elements": ["anemo"], "comparison": ">=", "value": 1 },
    { "type": "not", "condition": { /* the whole Conduct condition above */ } }
] }
```

⚓ **The `not` IS the precedence rule** — one clause, no new state, and it makes
the two branches mutually exclusive by construction rather than by convention.

⚠️ **`teamElementCount` excludes the HOLDER** (documented on the type). That is
right here: Odette is Cryo and supplies the Cryo half herself, so what the
condition must find is the _other_ element.

⚠️ **The two Radiances are not the same KIND of object**, and it changes what you
author. Conduct is field-presence, so under the assume-entered rule it is a
standing condition with no duration. Swirl is a genuine **8s window** off a
trigger. ⛔ Don't author Swirl as a standing condition just because Conduct is
one.

⛔ **A Radiance branch is not a caveat.** Both branches are authorable, so a kit
that splits its numbers gets two effects, not one effect plus prose.

## Stellar Vortex — what Stellar Swirl actually produces

⚓ Nate, 2026-08-31, from the in-game tutorial. ⚠️ **Stellar Swirl has NO FIELD**
— it does not use a Polestar Field, and none of Stellar-Conduct's in-field
baselines (+20% Cryo/Electro, −40% Physical RES) apply to it.

- Stellar Swirl deals an instance of **Anemo DMG** and generates a **Stellar
  Vortex** — unbounded, no field geometry; **at most one** on the field within a
  certain range.
- Repeated Stellar Swirls **level the Vortex** (Lv. 2 after a certain count); a
  higher level explodes for more AoE Cryo DMG over a wider area.
- It **explodes after a certain time OR a certain number of triggers**, dealing
  **AoE Cryo DMG** that **can CRIT**. On explosion it also grants nearby
  characters one **higher jump** for a short time.
- After a trigger, nearby characters enter **Radiance: Stellar Swirl for 8s**.

**What of this we can model, and what we deliberately cannot:**

| Mechanic                           | Modelable? | Why                                                                 |
| ---------------------------------- | ---------- | ------------------------------------------------------------------- |
| Radiance: Stellar Swirl, **8s**    | ✅         | A stated duration on a temporal trigger.                            |
| Radiance: Stellar-Conduct          | ✅         | Gated on a **Polestar Field** — ⚓ assume we are inside it (below). |
| Vortex explosion timing / count    | ⛔         | "a certain time", "a certain number" — ⛔ never fake timing.        |
| Vortex level, AoE size, jump grant | ⛔         | Positional//traversal; outside what the tools draw.                 |

⚓⚓ **A FIELD IS ASSUMED ENTERED** (⚓ Nate, 2026-08-31). We cannot simulate
entering and exiting a Polestar Field, and we do not try: a field is treated like
**any other character's dropped field — the play is happening inside it**. Field
footprints are generously sized and the player realistically always is. ⛔ So
"it's positional" is NOT a reason to leave a field effect unauthored, and an
earlier draft of this file got that wrong.

⚠️ This is the house rule already, not a new one — Sandrone's in-field baselines
(+20% Cryo/Electro team, −40% Physical RES) were authored on exactly this
assumption in the 2026-07-29 round. **Radiance: Stellar-Conduct is authorable on
the same footing.**

⚓ The Conduct radiance is SPATIAL and the Swirl radiance is TEMPORAL — still
worth holding onto, because it changes the SHAPE of what you author (an
assumed-on state vs. an 8s window off a trigger), even though both are
authorable. It is stated in one sentence of the shared enabler passive and is
easy to read past.

⚓ **"Stellar Glimmer" is the UMBRELLA term for the family, not a twelfth
reaction** (7.0 wording, on Sandrone / Odette / Cryo Traveler only). Sandrone's
reworked burst: the ray "is considered **the corresponding** Stellar Glimmer
reaction DMG"; "Radiance: Stellar Glimmer" replaced the per-reaction Radiance
state names. ⛔ **It gets no `Reaction` union member** — the union stays
per-reaction. It gets family-wide **Stat** keys instead, on the `lunarDmgBonus`
precedent: `stellarGlimmerDmgBonus` / `stellarGlimmerReactionBonus`.

**Stat keys (all live as of 2026-08-31):**

| Bucket                     | Stellar-Conduct               | Stellar Swirl               | Family-wide (Glimmer)         |
| -------------------------- | ----------------------------- | --------------------------- | ----------------------------- |
| 3 — own multiplicative     | `stellarConductDmgBonus`      | `stellarSwirlDmgBonus`      | `stellarGlimmerDmgBonus`      |
| 5 — additive with EM bonus | `stellarConductReactionBonus` | `stellarSwirlReactionBonus` | `stellarGlimmerReactionBonus` |

Label rule unchanged: wiki category "\<Reaction\> DMG Bonus" → `*ReactionBonus`;
"Base DMG Bonus" → `*DmgBonus`.

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
