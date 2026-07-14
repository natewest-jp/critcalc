# Factions — Moonsign & Hexerei

**Sources:** Nate (roster + patch knowledge, 2026-07-14) + KQM lunar-reactions
(Moonsign level) + our `factions` / `factionBonuses` schema.
**Game version reflected:** 6.8.
**See also:** [`lunar-reactions.md`](lunar-reactions.md), [`elevation.md`](elevation.md).

"Faction" here = a **gameplay-mechanic** grouping with team-composition bonuses,
distinct from lore affiliation. Two exist today: **Moonsign** (Nod-Krai) and
**Hexerei** (Hexenzirkel). More faction-generations are expected in 7.x+.

---

## Moonsign (Nod-Krai)

A **party-level** mechanic. Characters with a **Moonsign Benediction** passive each
**increase the party's Moonsign Level by 1**. Two tiers:

- **Nascent Gleam** — Moonsign Level 1 (one benediction character).
- **Ascendant Gleam** — Moonsign Level 2 (two benediction characters).

Effects are **non-stacking** unless a description says otherwise.

**Moonsign Team Bonus (at Ascendant Gleam):** _non-Moonsign_ party members grant a
**Lunar Reaction DMG Bonus (max 36%)** when they cast Skill or Burst (resets each
cast, does not stack). Per-element scaling (KQM):

| Element(s)            | Scaling               | Cap       |
| --------------------- | --------------------- | --------- |
| Pyro / Electro / Cryo | 0.9% per 100 ATK      | 4,000 ATK |
| Hydro                 | 0.6% per 1,000 max HP | 60,000 HP |
| Geo                   | 1% per 100 DEF        | 3,600 DEF |
| Anemo / Dendro        | 2.25% per 100 EM      | 1,600 EM  |

Benediction passives _also_ **enable the Lunar reactions** themselves and often
**convert** classic reactions to Lunar variants — see [`lunar-reactions.md`](lunar-reactions.md).

**Key resolution (2026-07-14):** since each benediction character is exactly **+1
level**, party **Moonsign Level == count of Moonsign-benediction characters**.
There is no current character who adds _more_ than +1, so illuga's "increase by 1
level" is ordinary membership, not an extra. → in schema terms, membership alone
(`factions: ['moonsign']`) is the correct model for every current Moonsign char.

## Hexerei (Hexenzirkel)

Team-composition faction whose bonus — **"Secret Rite"** — activates when **≥ 2
Hexerei members** are in the party. As of **6.8** there are **twelve** members:

**Older characters retrofitted with Hexerei buffs (7):**
Albedo · Fischl · Klee · Mona · Razor · Sucrose · Venti

**Newer characters introduced as Hexerei, with Secret-Rite-gated stats (5):**
Durin · Varka · Nicole · Prune · Lohen

More may be added later. **All twelve should eventually have `factionBonuses`
authored** — see the wiring task: [`../curation/faction-bonuses-wiring.md`](../../curation/faction-bonuses-wiring.md).
(Fischl's is the one drafted so far — the "Secret Rite" example.)

---

## → Schema mapping

| Concept                                                                           | Our primitive                                                                                      | Status                                                                                                                          |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Faction membership                                                                | `CharacterData.factions: string[]` (`'moonsign'`, `'hexerei'`)                                     | ✅ — but was **missing** on columbina/illuga/zibai/durin until 2026-07-14                                                       |
| Party faction level / count                                                       | parser `teamFactionCounts` = Σ members + Σ `factionContributions` (via `computeTeamFactionCounts`) | ✅                                                                                                                              |
| Faction gate (a char's effect needs N faction members)                            | `Condition.teamFaction { faction, min }`                                                           | ✅ (e.g. Secret Rite = `hexerei, min: 2`; Ascendant Gleam = `moonsign, min: 2`)                                                 |
| Active-char faction routing                                                       | `Condition.activeCharFaction { faction }`                                                          | ✅                                                                                                                              |
| Extra faction contribution (a char adds >+1, or a non-member contributes)         | `CharacterData.factionContributions: Record<string, number>`                                       | ✅ mechanism exists; **no current data uses it** (forward-looking for 7.x)                                                      |
| **Faction-wide bonus effects** (the "Secret Rite" / Ascendant-Gleam bonus itself) | `CharacterData.factionBonuses: FactionBonus[]` — `{ faction, name, description?, effects[] }`      | ⚠️ **type + lint exist, but UNWIRED** — no renderer/derivation consumes it; only Fischl authored. **This is the gap to close.** |

**The `factionBonuses` gap:** the intended home for faction team-bonuses is
`factionBonuses[]`, gated internally with `teamFaction` conditions. The data
shape, the bidirectional lint (C.16: `factions` set ⇒ expect `factionBonuses`),
and Fischl's example all exist — but **nothing renders or derives it**, so it's
invisible today. Note the **two current patterns** in the corpus:

- **Fischl (hexerei):** authored the bonus in `factionBonuses[]` (the intended home).
- **Moonsign chars (aino, flins, …):** authored faction-gated effects as ordinary
  character effects with `teamFaction` conditions (works because those _do_ render).

Closing the gap means wiring `factionBonuses` into effect-collection + rendering,
then authoring it for the 12 Hexerei chars (and deciding whether Moonsign bonuses
migrate into it too). Tracked in [`../curation/faction-bonuses-wiring.md`](../../curation/faction-bonuses-wiring.md).
