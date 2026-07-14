# Task: Wire up `factionBonuses` + author the Hexerei roster

**Filed:** 2026-07-14 (surfaced while reconciling the schema-gaps design).
**Status:** OPEN — not started.
**Game knowledge:** [`../library/factions.md`](../library/factions.md).

## The problem

`CharacterData.factionBonuses: FactionBonus[]` (`{ faction, name, description?,
effects[] }`) is the intended home for **faction team-wide bonus effects** (the
"Secret Rite" for Hexerei, gated internally with `teamFaction` conditions). But it
is **half-built and forgotten**:

- ✅ Type exists (`character.ts`).
- ✅ Lint exists — **C.16** (bidirectional): a char with `factions` set is expected
  to have `factionBonuses` (currently `warn`), and `factionBonuses[].faction` must be
  declared in `factions[]` (strict, `faction-bonus-orphan`). Condition trees inside
  `factionBonuses[].effects` are lint-walked.
- ✅ One example authored: **Fischl** ("Secret Rite", hexerei).
- ❌ **NO consumer** — `effectCollection`, `teamBuffRows`, `deriveCapabilities`, the
  parser, and the components do **not** walk `factionBonuses`. So the effects are
  authored + linted but **render/derive nowhere**. Fischl's Secret Rite is invisible.

It was almost certainly drafted on Fischl and dropped before a second character used
it. Now the Hexerei faction has grown to 12 members, so it's worth finishing.

## Part A — Wire the consumer

Make `factionBonuses[].effects` flow through the same machinery as ability/passive/
constellation effects:

1. **Effect collection** (`src/lib/timeline/effectCollection.ts`) — include
   `factionBonuses[].effects` in the pools it gathers (cast/onHit/onReaction/afterDuration),
   so they reach `computeTeamBuffRows`. They already carry `teamFaction` conditions, which
   `evalCondition` resolves against `teamFactionCounts` — so a Secret Rite bonus only
   renders when the team actually has ≥2 Hexerei.
2. **Attribution** — rows should read as the faction bonus (e.g. "Secret Rite"), using
   `FactionBonus.name`, not a normal ability label.
3. **Capabilities** (`deriveCapabilities`) — decide whether faction bonuses contribute
   Team Builder capability facets. Probably **yes** for buffs (a Hexerei char "buffs the
   team when 2+ Hexerei"), but gate the provenance clearly on the faction condition.
4. **Consider a "Team Bonuses" panel** — the `FactionBonus.name`/`description` fields were
   designed for a display surface (per the type JSDoc). Optional; rows may be enough for v1.
5. Tests: extend `teamBuffRows.test.ts` with a `factionBonuses` fixture (renders only at
   `teamFaction ≥ min`); a `deriveCapabilities` case if facets are added.

## Part B — Author the 12 Hexerei members

Once Part A renders, author a `factions: ['hexerei']` + `factionBonuses` (Secret Rite)
for each. **Get each character's actual Secret-Rite-gated numbers** from kit text / a
reliable source before authoring (don't copy Fischl's values).

**Older, retrofitted with Hexerei buffs (7):** albedo, fischl ✅ (done), klee, mona,
razor, sucrose, venti.
**Newer, Hexerei-native (5):** durin (already `factions:['hexerei']`), varka, nicole,
prune, lohen.

Notes:

- durin already has `factions:['hexerei']` (added 2026-07-14) but **no `factionBonuses`** →
  currently trips the C.16 `warn`. Authoring its Secret Rite closes that.
- varka/nicole/prune/lohen need `factions:['hexerei']` added too.
- The Secret Rite effects should be gated `teamFaction { faction:'hexerei', min:2 }` (Fischl's pattern).

## Part C — Decide the Moonsign question

Moonsign chars currently author their Ascendant-Gleam / benediction effects as **ordinary
character effects** (aino/flins pattern) rather than in `factionBonuses`. Once Part A works,
decide whether faction-wide Moonsign bonuses (e.g. the Moonsign Team Bonus) should **migrate**
into `factionBonuses` for consistency, or stay as character effects. Not required for the
Hexerei work; flag for when the reaction/elevation pass happens.

## Gates

Standard: `npx vitest run`, `npm run check`, `npm run lint`, capability audit. Part A must
not regress the (invisible-but-linted) Fischl data; Part B each character behind the usual
curation gates. Expect the C.16 `warn` count to drop to zero as members get their bonuses.
