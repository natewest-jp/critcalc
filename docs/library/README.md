# critcalc Game-Knowledge Library

Our own curated reference for how Genshin's mechanics actually work — kept
**independently of gcsim**, and independently of whether any tool has
implemented a thing yet.

## Why this exists

Two failures this session proved we need it:

- **Elevation** was "special and multiplicative" in a JSDoc and a memory, but the
  actual bucket mechanics — the thing that makes it special — were never written
  down. We had a primitive without a spec.
- **`factionBonuses`** was drafted on Fischl, wired to nothing, and forgotten by
  everyone. Knowledge that lives only in one code path or one memory evaporates.

gcsim is invaluable but it is (a) sometimes **opaque** — you can't always deduce
the game rule from the Go code, and (b) **incomplete/lagging** — it won't have a
mechanic until someone implements it, which is too late for us when a character
drops. So we keep our own written source of truth. When we curate, we map that
truth onto our schema; when gcsim and our understanding disagree, we reconcile
deliberately rather than silently trusting either.

## The KQM-vs-gcsim stance (inherited from `../elemental-reactions.md`)

Nate's framing on the original reactions compilation holds for everything here:
KQM is the strongest **player-side** authority (rigorous testing + documentation),
but it is **not ground truth** — only the game engine has the exact rules.
gcsim is a second strong source with a different method (implementation). Where
they diverge, that's a flag to evaluate together, not an automatic "gcsim wrong"
or "KQM wrong." Each doc here cites its sources and marks **`⚠️ NEEDS-CONFIRM`**
on anything we haven't nailed down.

## How these docs connect to the schema

Every mechanics doc ends with a **"→ Schema mapping"** section: which of our
primitives (`Effect` types, `Stat` keys, `Condition`s, `BuffValue`s) express the
mechanic, and where a gap remains. That's the bridge from "how the game works" to
"how a curator authors it." Keep the mapping current when the schema changes.

## Index

| Doc                                                      | Covers                                                                                                              | Status                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [`../elemental-reactions.md`](../elemental-reactions.md) | Classic reactions (amplifying/transformative/additive), gauge theory, resonance, infusion — the KQM TCL compilation | ✅ stable (referenced by crit-viz code + memories) |
| [`lunar-reactions.md`](lunar-reactions.md)               | Lunar-Charged / Lunar-Bloom / Lunar-Crystallize — triggers, formulas, buckets, ICD/snapshot                         | ✅ drafted (KQM `misc/lunar-reactions`)            |
| [`elevation.md`](elevation.md)                           | The elevation mechanic + the three reaction-DMG buckets, and how each maps to our schema                            | ✅ drafted                                         |
| [`factions.md`](factions.md)                             | Moonsign (level, Gleam tiers, benedictions) + Hexerei (Secret Rite, the 12 members)                                 | ✅ drafted                                         |
| [`stellar-reactions.md`](stellar-reactions.md)           | Stellar reactions (Stellar-Conduct + coming Stellar Swirl…) — the 7.x reaction generation                           | 🚧 stub (beta, ~2026-08)                           |
| `damage-formula.md` _(planned)_                          | The full game damage formula — buckets, enemy DEF/DEF-shred/ignore, RES, amplifying/crit multipliers                | 📋 planned (from a Nate-provided reference)        |

## Conventions for adding to the library

- **Cite the source** at the top (KQM page, patch version, or "Nate, from playtest").
- **Preserve exact numbers** and formula terms; don't round or paraphrase multipliers.
- Mark unknowns **`⚠️ NEEDS-CONFIRM`** rather than guessing — a visible gap is safer
  than a confident error.
- End with **→ Schema mapping**.
- Note the **game version** the doc reflects, and update it when patches change things.
