# Caveat Style Guide & Audit Rubric (A7 pass)

> The permanent style contract for user-facing \`caveat\` strings, produced by
> the A7 corpus pass (2026-07-19/20, Nate-signed style). Enforced by
> characterLint E.26 (banned tokens strict, length 280 warn / 400 strict) and
> \`scripts/caveat-lint.mjs\` (fuller pattern checks; parses the config block
> below). Audit record: \`docs/curation/caveat-pass/\`.

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

One surface: the planner NOTES panel — a narrow (262px) scrolling column that
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

**Implement-first** _(Nate, 2026-07-20, A7b pilot)_: if a divergence is
expressible with wired primitives (condition-gated effect pairs,
`cooldownModifiers`, `durationModifiers`, `teamElementCount`, …), author the
data instead of writing a caveat — a caveat for a wireable gap is a debt note.
Caveat only the residual, including places where the in-game description
differs from actual behavior. Check the CAN list before writing "not modeled";
schema-expressible-but-unwired mechanics go to the implement queue.

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

**Presence ≠ reachability** _(wave-3 lesson)_: before tagging a claim
"working-behavior", check not just that the field is authored but that the
path is actually reachable — read the ability's `_curatorNotes` residuals
(e.g. a variant can exist yet be blocked by a shared charge queue). A
modeled-but-unreachable mechanic is a divergence, not working behavior.

⛔⛔ **STRUCK 2026-08-18 — the wave-3 "add it manually" lesson was FALSE and
actively harmful.** It read: _"if the effect exists with a manual trigger, the
honest phrasing is 'doesn't fire on its own — add it manually' (it IS on the
timeline once toggled)."_ **There is no toggle and there never was one.**
Verified by grep: `'manual'` occurs exactly ONCE in the whole codebase, at its
own type declaration (`src/lib/types/ability.ts:649`). 167 manual-trigger
effects across 69 characters reach **no surface whatsoever**. The lesson had
produced 15 live caveats instructing players to use a control that does not
exist; all 15 were rewritten in the 2026-08-18 refresh.

⚓ **A manual-trigger effect is genuinely "Not modeled".** Authored is not
rendered — never soften it, and never delete such a caveat on the grounds that
the effect exists in the data.

⚠️ The `{key:N}` notation token is a **stack-assert** that satisfies a `stacks`
CONDITION. It cannot fire a `manual` TRIGGER. ⛔ Never rewrite one into the other.

**Deletes need a who-renders check** _(wave-4 lesson)_: an effect being
authored and reachable is not enough — ask who actually gets a visible
window. Target-resolution approximations (e.g. `['self','active']` collapsing
onto the on-field holder) can silently drop a teammate's buff bar; that is a
user-visible omission deserving a caveat, not a curator residual.

## Capability rubric — MOVED

⛔ **The CAN / CANNOT lists that used to live here are gone.** They were written
2026-07-19/20 and by 2026-08-18 were stale in **14 named places** — including a
flat "no aura decay, no ICD, cast-only reactions" that three engine rounds had
falsified, and a `stellarConduct` FROZEN entry that had shipped. Judging caveats
against them produced wrong verdicts, which is what forced the 2026-08-18 refresh.

👉 **The current rubric is `docs/curation/engine-capability-rubric.md`** — CAN /
**PARTIAL** / CANNOT / FROZEN, every claim carrying `file:line` evidence, plus a
DELTAS section and a TRAPS section naming where an auditor is most likely to
wrongly delete.

⚠️⚠️ **RE-DERIVE IT AT THE START OF EVERY CAVEAT PASS.** It is a snapshot of a
moving engine, not a contract. The whole reason this section was deleted is that a
rubric living inside a style guide reads as permanent when it is not.

⚓ **PARTIAL is a first-class verdict input.** The old binary CAN/CANNOT is what
produced the bad calls: a mechanic that works on the cast path and not the summon
path is not a "CAN", and a blanket delete on it removes a true warning.

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
