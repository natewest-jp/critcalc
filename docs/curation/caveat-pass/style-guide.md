# Caveat Style Guide & Audit Rubric (A7 pass)

> Working doc for the 2026-07 corpus-wide caveat audit. Graduates to
> `docs/curation/caveat-style-guide.md` when the pass completes.
> Status: **draft — pilot-wave calibration pending Nate sign-off.**

## What a caveat is for

A caveat repairs trust where the rotation-planner timeline **visibly diverges
from in-game reality** or **silently omits something decision-relevant**.
Nothing else.

**The test:** _would a player who already knows this character be misled by the
timeline without this note?_ If no, the caveat should not exist.

Corollaries:

- Never explain how the kit works. Users know their characters.
- Never describe _working_ behavior ("the parser auto-selects the right
  variant") — that's not a limitation; delete it.
- Curator reasoning, sources, frame numbers, schema/field talk → `_curatorNotes`.

## Where caveats render

One surface: the planner NOTES panel — a narrow (240px) scrolling column that
**already shows the character's name, the ability's kind chip (Skill / Burst /
Normal / Passive / C1–C6), and the ability's name** directly above each caveat.
Repeating any of those in prose is pure waste.

## Style rules

1. **Content**: state only what the timeline gets wrong or omits. One idea per
   sentence.
2. **Length**: ≤ 2 sentences. Target ~180 characters; soft cap 280 (lint warns),
   hard cap 400 (lint fails).
3. **Names**: never name this character or this ability (the panel shows both).
   When referencing _another_ character's ability, give kind + name:
   "Bennett's burst Fantastic Voyage". When referencing another ability of the
   _same_ character, kind alone usually suffices ("during the burst").
4. **Audience**: average Genshin players, simple sentences (text will be
   translated later). Game terms are fine: CD, ICD, aura, EM, RES, HP, DMG,
   snapshot, infusion, constellation names like C6. Kit-specific proper nouns
   are fine.
   **Banned**: gcsim, "schema", "parser", "the renderer"/"render", frame
   counts, internal field names (`skillDmgBonus`, camelCase identifiers),
   backticked identifiers, version/internal tags ("E3 v1.5").
   Exception: notation tokens the user is being told to _type_ are allowed —
   e.g. "add `{coldDish:5}` before E" — because they are user instructions.
5. **Stock patterns** (available, not mandatory — Nate, wave-1 sign-off):
   - "Not modeled: X." — for omissions.
   - "Shown as X; in game, Y." — for divergences.
   - "Assumes X." — for baked-in canonical assumptions.
     Use one when it simplifies the wording; write a plain sentence when that
     is just as simple. Do not force every caveat into a template — a panel
     where every entry opens identically reads worse, not better.
6. **Spelling**: "not modeled" (single L, American English) throughout.
7. **Voice**: "the timeline" / "shown" for what the tool displays. Avoid "the
   planner can't…" framing where a stock pattern works.
8. **Quantity clarity** _(pilot lesson)_: no ambiguous quantity pronouns —
   "consumes all of it" reads as "all 50"; say "consumes everything
   accumulated" or name the resource and amount explicitly.

## Worked examples

| Verdict | Before                                                                                                                                                                                                                                                            | After                                                                                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rewrite | _(Bennett burst, 230ch)_ "The Inspiration Field only heals the active character while their HP is at or below 70%; above that they receive Bennett's ATK bonus instead. The planner shows the heal on every field tick regardless of the character's current HP." | "The heal is shown on every field tick, but only characters at or below 70% HP are healed — above that they get the ATK buff instead."                          |
| Rewrite | _(Raiden C6, 138ch)_ "The Constellation 6 CD reduction (−1s per Musou Isshin hit on an opponent, once per second, up to 5 times) is not modelled in the planner."                                                                                                 | "Not modeled: the C6 CD reduction from Musou Isshin hits."                                                                                                      |
| Rewrite | _(Furina skill, 416ch — trimmed)_ "…Because the planner can't track Furina's Arkhe alignment, both lineups render for the full summon window even though only one is active at a time…"                                                                           | "Only one lineup is real per cast — Ousia summons the damage ticks, Pneuma the healing Singer. The timeline shows both because it can't track Arkhe alignment." |
| Delete  | _(Kazuha normal, 238ch)_ "Base plungeFrames = after Press E (plungePressFrames in gcsim; hitmark=36f)… Variant is auto-selected by the parser…"                                                                                                                   | _(none — describes working behavior + internals; content demoted to `_curatorNotes`)_                                                                           |
| Keep    | _(Hu Tao burst, 50ch)_ "DMG and heal are boosted at ≤50% HP (not modeled)."                                                                                                                                                                                       | unchanged                                                                                                                                                       |

## Verdict taxonomy

- **keep** — already concise and correct. Rare.
- **rewrite** (default) — compress to style; every dropped technical claim goes
  to `demotedNotes` (→ `_curatorNotes`) or is accounted for in `claimsLost`.
  Real engine gaps that are on the deferred implement queue stay `rewrite`
  with an `implementQueueNote`.
- **delete** — the entire caveat is curator-facing or describes working
  behavior. Content demoted to `_curatorNotes`; the `caveat` key is removed
  (never set to `""`).
- **implementDelete** — the engine already models the described limitation
  (see CAN list; must be _wired_, not merely schema-present). Always includes
  a `fallbackRewrite` so the wave can ship conservatively; actual data-level
  re-authoring happens in a dedicated later wave.

**Ambiguity always downgrades to `rewrite`.** Deleting is the only verdict
that can silently cost a user a true warning.

**Compression-only rule:** rewritten text may contain only claims traceable to
(a) the original caveat or (b) the character's own `description` fields. Any
new mechanical claim requires `needsFactCheck: true` and verifier attention.

**Scope words are mechanical claims** _(pilot lesson)_: adding an audience
word during compression — "team", "party", "all allies", "everyone" — asserts
who receives an effect. Verify it against the effect's `target` field
(`teamExcludingSelf` ≠ "team") before writing one; when unsure, mirror the
original caveat's scope phrasing exactly.

**Keep the stat owner when de-naming** _(wave-2 lesson)_: stripping the
character's name from "X% of \<name\>'s ATK/HP" is only safe when the buff
holder and recipient are the same character. On cross-character buffs, an
unowned stat ("adds 60% of ATK") reads as the recipient's own stat — say
"the caster's ATK" (or equivalent) instead.

## Capability rubric (for classifying implementDelete vs rewrite)

### CAN model (wired end-to-end — stale caveats about these are implementDelete candidates)

- Cooldowns: `cooldown`, `cooldownModifiers`, base-ability `cooldownStartDelay`,
  `charges`/`chargeModifiers` with per-variant E-charge queues, variant
  `bypassesCooldown`, `cdReset` effects (character unconditional; weapon via
  `procCooldown` — Sacrificial), ghost-CD tails.
- Conditions that resolve definitively: `state`, `not/all/any`, `ascension`,
  `constellation`, `teamFaction`, `teamElementCount`, `activeCharFaction`,
  `weaponType`, `chainStage`, `stacks`.
- Conditions that resolve _optimistically by design_ (render assumed-true +
  caveat): `enemyHpBelow/Above`, `recipientHpBelow`, `enemyAffectedBy`,
  `selfHpBelow/Above`. Caveats explaining these assumptions are **legitimate →
  keep/rewrite, never implementDelete**.
- Trigger dispatch: `onCast`, `onHit` (per-swing, with `damageType`/`filter`/
  `source`), `onReaction`, `afterDuration`, `onTeamNightsoulBurst`, `passive`,
  weapon `onSwapIn/Out`, artifact-4pc `onCast`/`onReaction`, `summonTick`.
- Stacks: `gainStacks` on onCast/onHit/onReaction (`max`, decay shapes `drain`/
  `lifetime`/`sourceLifetime`), `consumeStacks` **on onCast only**, per-effect
  `procCooldown` ICDs, self-vs-team scoping.
- Buff windows: refresh-merge, active-target slicing, all `BuffValue` kinds
  (perStack, perTeamCount, scaling, ramping/decaying, canonicalAssumption
  headline), `resShred` debuff windows.
- Stances/states: `behavior:'stance'`, `opensState`, `terminatesOnSwap`,
  `durationExtensions` (onCast + summon synthetic-reaction path), transient
  states (`opensTransientState`, `actionOpensState`, `consumesState`).
- Per-swing action events (N5 → 5 events, infusion resolution, `plungeVariants`
  auto-selection, `chargeHits`), summons with ticks/`terminatesOn`, shields
  (scheduled expiry + `shieldEnd`), nightsoulBurst lane.

### CANNOT model (real gaps — caveats about these are keep/rewrite)

- `cooldownReduce` effect — **schema-only, parser deferred** (Arlecchino C4,
  Gorou C2, Navia C1). The canonical implementDelete trap.
- No `cooldownStartDelay` on Hold/tap _variants_ (base skill/burst only).
- Multi-hit swings collapse to one hit (no `hitCount`) — hit-counting effects
  undercount.
- No `maxProcs` / per-window proc caps (Escoffier C6 cap).
- `consumeStacks` on onHit/onReaction; `durationExtensions` on onHit/onReaction
  (outside the summon path); summon non-tick effect triggers.
- Unconsumed triggers: `onEnergy`, `onHPChange/Decrease/Increase`, `onHeal`,
  `onState`, `onStack`, `manual`; `onShieldEnd`/`onStanceEnd` emit events but
  don't drive buff windows.
- Reactions are cast-only + optimistic: no aura decay, no absorbed elements,
  no gauge/ICD simulation ("windows, not gauges").
- Shield shatter-by-damage (expiry is scheduled, by design).
- Out of scope by constitution: damage numbers/math, pickup-driven empowerment
  (Neuvillette droplets, orb/particle collection), Bond of Life, field
  redirect (Dehya/Xianyun), hitlag/attack-speed, multi-element absorption.

### ⛔ FROZEN (Nate, 2026-07-14 — never implement, regardless of schema presence)

- `elevate` rendering / reaction-DMG derivation; multi-reaction & non-lunar
  elevate; `stellarConduct`; reaction-multiplier-vs-DMG-bonus distinction.
- Any implementDelete verdict touching these is auto-rejected → rewrite.

## Machine-readable lint config

`scripts/caveat-lint.mjs` parses this block — edit here, not in the script.

```json caveat-lint-config
{
	"targetLength": 180,
	"warnLength": 280,
	"failLength": 400,
	"maxSentences": 2,
	"bannedSubstrings": [
		"gcsim",
		"schema",
		"parser",
		"renderer",
		"modelled",
		"_curatorNotes",
		"_todo",
		"hitmark",
		" v1.",
		" v2."
	],
	"bannedPatterns": [
		{ "pattern": "\\b\\d+f\\b", "reason": "frame counts are curator-speak" },
		{
			"pattern": "\\b[a-z]+[A-Z][a-zA-Z]+\\b",
			"reason": "camelCase internal identifier",
			"allow": ["ATK", "DMG", "HP", "EM", "RES", "CD", "ICD", "McDonell"]
		}
	],
	"backtickAllowedOnlyWithVerbs": ["add", "type", "assert", "put", "use", "write", "prefix"]
}
```

Notes on the config: `modelled` bans the double-L spelling (use "modeled");
backticked tokens are allowed only in sentences containing one of the
instruction verbs (user-typed notation tokens); the camelCase pattern skips
words in `allow` and any ALL-CAPS acronyms.
