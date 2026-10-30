# critcalc Game-Knowledge Library

Our own curated reference for the things that **evaporate when they live only in
code, gcsim, or memory** — kept in-repo, checked in, and independent of whether
any tool has implemented a thing yet.

Two kinds of knowledge live here:

- **[`game/`](game/)** — how Genshin's mechanics actually work (game-truth):
  reactions, elevation, factions, the damage formula, …
- **[`gotchas/`](gotchas/)** — the bugs, footguns, omissions, and errors **we**
  made, written down once so we don't repeat them.

## What belongs here (the inclusion test)

Ask: _would this knowledge evaporate if it lived only in code, gcsim, or a
memory file — and would re-deriving it cost real time or risk a repeat mistake?_

- **In** — durable, reference-grade, reusable across sessions / tools / contributors:
  _how the game works_ (`game/`) and _how we got it wrong_ (`gotchas/`).
- **Out** — project state: roadmaps, perf audits, handoffs, "what shipped when."
  Those are logs; they belong in memory or `docs/curation/`. The library is
  _what's true_; `docs/curation/` is _what to do about it_ (recipes, backlog, audits).

We do **not** mirror the data conventions that already live load-bearing in
`CLAUDE.md` (talent-level-10, atk% whole numbers, never-fake-timing). Duplicating
them here invites drift — the library _references_ them instead.

## Why this exists

Two failures proved we needed it — both now cataloged in [`gotchas/`](gotchas/):

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

## The KQM-vs-gcsim stance (inherited from `game/elemental-reactions.md`)

Nate's framing on the original reactions compilation holds for everything here:
KQM is the strongest **player-side** authority (rigorous testing + documentation),
but it is **not ground truth** — only the game engine has the exact rules.
gcsim is a second strong source with a different method (implementation). Where
they diverge, that's a flag to evaluate together, not an automatic "gcsim wrong"
or "KQM wrong." Each doc here cites its sources and marks **`⚠️ NEEDS-CONFIRM`**
on anything we haven't nailed down.

## How `game/` docs connect to the schema

Every mechanics doc ends with a **"→ Schema mapping"** section: which of our
primitives (`Effect` types, `Stat` keys, `Condition`s, `BuffValue`s) express the
mechanic, and where a gap remains. That's the bridge from "how the game works" to
"how a curator authors it." Keep the mapping current when the schema changes.

## Index

### `game/` — how the game works

| Doc                                                            | Covers                                                                                                                                                                 | Status                                                          |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [`game/elemental-reactions.md`](game/elemental-reactions.md)   | Classic reactions — gauge theory, amplifying/transformative/additive, absorption, reaction priorities. KQM TCL, cross-checked vs official wiki; navigable (TOC + §1–8) | ✅ stable (crit-viz + parser)                                   |
| [`game/icd.md`](game/icd.md)                                   | Internal cooldown — the 3-hit/2.5s standard rule, sequence+counter+timer model, per-ability cadences, `noICD` vs `procCooldown`                                        | ✅ drafted (KQM + gcsim)                                        |
| [`game/energy-and-particles.md`](game/energy-and-particles.md) | Energy/particles — sources, conversion table, ER, funneling. **Reference only — not modeled** (RNG + needs enemies)                                                    | ✅ drafted (KQM; reference-only)                                |
| [`game/snapshotting.md`](game/snapshotting.md)                 | Snapshot vs dynamic — what freezes at cast vs recomputes; maps to `snapshottable` / `snapshots`                                                                        | ✅ drafted (KQM)                                                |
| [`game/lunar-reactions.md`](game/lunar-reactions.md)           | Lunar-Charged / Lunar-Bloom / Lunar-Crystallize — triggers, formula (5 buckets), ICD/snapshot                                                                          | ✅ drafted (KQM + wiki + gcsim; EM fixed, Columbina resolved)   |
| [`game/elevation.md`](game/elevation.md)                       | The elevation mechanic + the three reaction-DMG buckets, and how each maps to our schema                                                                               | ✅ drafted                                                      |
| [`game/wish-mechanics.md`](game/wish-mechanics.md)             | Pity tables + soft-pity ramps (GGanalysis-pinned), Capturing Radiance official facts + counter status, Epitomized Path — the Wish Odds instrument's model of record    | ✅ drafted (wiki via API + GGanalysis, 2026-07-24)              |
| [`game/factions.md`](game/factions.md)                         | Moonsign (level, Gleam tiers, benedictions) + Hexerei (Secret Rite, the 12 members)                                                                                    | ✅ drafted                                                      |
| [`game/stellar-reactions.md`](game/stellar-reactions.md)       | Stellar reactions (Stellar-Conduct + coming Stellar Swirl…) — the 7.x reaction generation                                                                              | 🚧 stub (beta, ~2026-08)                                        |
| [`game/damage-formula.md`](game/damage-formula.md)             | The general damage formula — buckets, DMG Bonus, enemy DEF/DEF-shred/ignore, RES, crit; the curator "which bucket?" lookup                                             | ✅ drafted (wiki + gcsim; reference — we don't compute damage)  |
| [`game/resonance.md`](game/resonance.md)                       | Elemental Resonance — the eight resonances as gcsim applies them, what it leaves out, and what the tools show (only Anemo's −5% reaches the sim)                       | ✅ drafted (gcsim + `resonance.ts`; some figures NEEDS-CONFIRM) |
| [`game/weapon-infusion.md`](game/weapon-infusion.md)           | Weapon infusion — gcsim's one-slot handler, stance vs granted infusions, newest wins, and how the planner resolves an element per swing                                | ✅ drafted (gcsim)                                              |

### `gotchas/` — mistakes we don't want to repeat

| Doc                                      | Covers                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| [`gotchas/README.md`](gotchas/README.md) | Catalog of bugs / footguns / omissions / errors — game-mechanics & data-curation |

## Conventions for adding to the library

- **Cite the source** at the top (KQM page, patch version, or "Nate, from playtest").
- **Preserve exact numbers** and formula terms; don't round or paraphrase multipliers.
- Mark unknowns **`⚠️ NEEDS-CONFIRM`** rather than guessing — a visible gap is safer
  than a confident error.
- `game/` docs end with **→ Schema mapping**.
- Note the **game version** the doc reflects, and update it when patches change things.
- New `game/` topics go in `game/` and get an index row above; new mistakes go in
  the `gotchas/` catalog with the entry template it defines.

## Notes carried over from Claude's working memory (2026-10-29)

- **History.** The library was started 2026-07-14, because knowledge that lived only in gcsim or in one-off notes kept evaporating (elevation was "special" but unspecified; `factionBonuses` was drafted on Fischl and forgotten). The same day it was split into `game/` and `gotchas/`, the root README gained the inclusion test, and every planned `game/` doc was written; it reached main as `05348d5`.
- **The HoYoLAB wiki is a proven source, through its JSON API.** The wiki's pages are JavaScript shells, but `https://sg-wiki-api-static.hoyolab.com/hoyowiki/genshin/wapi/entry_page?entry_page_id=<ID>&lang=en-us` returns the full entry with no auth (retcode 0). It was used for reactions (entry 5206), lunar reactions (10450) and the damage formula (5654). ⚠️ A WebFetch summary of it can drop exact numbers, so corroborate key constants against gcsim.
- **Fandom's `Internal_Cooldown/Data` is paywalled to WebFetch (HTTP 402).** `game/icd.md` cites it as the per-ability lookup only.
- **`game/elemental-reactions.md` stays ONE doc.** Reactions are one interlocking system and gauge theory underpins all of it; its §1–8 numbering is kept because code comments cite those section numbers (`reactionCurves.ts`, `gauge.ts`). If it ever has to split, the path is a `game/reactions/` subdirectory.
- **Follow-ups done (2026-10-30):** Elemental Resonance and Weapon Infusion have their own docs (`game/resonance.md`, `game/weapon-infusion.md`; the §6/§7 stubs in `game/elemental-reactions.md` point there), and `game/elevation.md` now uses the five bucket numbers of `game/lunar-reactions.md`.
