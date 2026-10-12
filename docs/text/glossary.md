# critcalc glossary — one name per thing

**Status:** ✅ RULED by Nate 2026-09-22 — every proposed canonical below accepted as
written. Round record: `docs/text-round.md`.

⚓ **This is the artifact the worksheets are checked against, and the artifact a
translator is handed.** Its job is to make sure one thing has one name — because an
inconsistency in the English source is reproduced, and usually amplified, in every
locale.

**Translatability column:**

- 🔓 **translate** — ordinary prose, localize normally
- 🔒 **frozen** — ⛔ never translated, in any locale (see `docs/text-round.md` §2 R2)
- 🏷 **label frozen, explanation translates** — keep the English term as the label,
  localize the sentence that explains it

---

## 1. Things we named — our own interface

⚠️ These are the highest-value rows in the file. They are the only terms on the site
that _no external source defines_, so if we are inconsistent, nobody corrects us.

| Thing                                         | Found in the wild                                    | ⏭ Proposed canonical                                                                                                     |     | Note                                                                                                                                                                            |
| --------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Band B (per-tool view controls)               | **"the view bar"** (1) · **"the view controls"** (4) | **the view bar**                                                                                                          | 🔓  | ⚠️ Both appear in the _same_ Rotation Planner chapter, three paragraphs apart. "Bar" matches its shape and matches "document bar" below.                                        |
| Band A (tabs + Save/Load/Share)               | "the document bar" (2)                               | **the document bar**                                                                                                      | 🔓  | Only ever named in help; fine.                                                                                                                                                  |
| The CodeMirror notation surface               | **"the composer"** (11) · **"notation editor"** (5)  | **the composer**                                                                                                          | 🔓  | Dominant, shorter, and already what the undo control is described against.                                                                                                      |
| The slot strip under the bands                | "the bench" (34)                                     | **the bench**                                                                                                             | 🔓  | Settled and consistent. A single card is a **bench card**; the position it occupies is a **slot**.                                                                              |
| The Gantt chart                               | "the timeline" · "the chart"                         | **the timeline**                                                                                                          | 🔓  | ⚠️ "chart" is used loosely for the same object in the Rotation Planner help's human-timing and layers paragraphs. Reserve **chart** for the Visualizers' and Compare's graphs.  |
| A planner tab                                 | "the plan (the tab you're in)" · "tab" · "rotation"  | **tab**, holding a **rotation**                                                                                           | 🔓  | ⚠️ Three names today. The object is a tab; its contents are a rotation. ⛔ Retire "plan".                                                                                       |
| The aura display                              | "the lane" · "the plot" · "the strip"                | **the aura lane** (the whole thing) · ✅ **the gauge lines** (above the baseline) · ✅ **the reaction spawns** (below it) | 🔓  | ↻ Renamed 2026-09-22 — see §1a. The old "plot" and "strip" named the _shape_ of each half and told a reader nothing about what was in it.                                       |
| The aura log                                  | "the aura log"                                       | **the aura log**                                                                                                          | 🔓  |                                                                                                                                                                                 |
| The notes panel                               | "Notes"                                              | **Notes** (the control), **the notes panel** (the thing)                                                                  | 🔓  |                                                                                                                                                                                 |
| A Visualizers slot                            | "tile" · "slot"                                      | **tile**                                                                                                                  | 🔓  | The workspace holds tiles; a tile shows an **instrument**.                                                                                                                      |
| A Visualizers graph                           | "instrument"                                         | **instrument**                                                                                                            | 🔓  | Consistent and good. ⚓ Keep — it is the word that makes the Observatory name land.                                                                                             |
| TB middle-panel tabs                          | Atlas · Roster · Compare                             | ↻ superseded by the lineups rows below (2026-10-12)                                                                       | 🔓  | The lineups reshape retired the three-tab panel.                                                                                                                                |
| The TB's board of teams                       | "board" (code) · "lineup"                            | **Lineup**                                                                                                                | 🔓  | ✅ Ruled 2026-10-12 (copy step 6). `board` stays in code only.                                                                                                                  |
| One Stygian team row                          | "battlefield"                                        | **battlefield**                                                                                                           | 🎮  | The game's own word.                                                                                                                                                            |
| The TB's character grid                       | "grid" · "roster" · "Characters"                     | **Characters**                                                                                                            | 🔓  | ✅ Ruled 2026-10-12. ⛔ **Roster** names the Library's tab ONLY.                                                                                                                |
| The ownership filter / the constellation lens | "owned" · "my roster"                                | **Owned** · **My constellations**                                                                                         | 🔓  | ✅ Ruled 2026-10-12. Applied in the TB 2026-10-12; ⚠️ the Coverage page's toggle still says "My roster".                                                                        |
| The fingerprint                               | "fingerprint" (code)                                 | **the team's capabilities**                                                                                               | 🔓  | ✅ Ruled 2026-10-12. ⛔ "fingerprint" is internal vocabulary.                                                                                                                   |
| A team's linked rotation                      | "pinned rotation"                                    | **pinned rotation**                                                                                                       | 🔓  | ✅ Ruled 2026-10-12 — the rotation a team opens in the Rotation Planner.                                                                                                        |
| Replacing a benched character                 | "an audition"                                        | **audition**                                                                                                              | 🔓  | ⚠️ A coined term. It is good and it is explained where it first appears — keep both facts true.                                                                                 |
| Tool names                                    | Rotation Planner · Team Builder · Visualizers        | unchanged — and they **translate**                                                                                        | 🔓  | ✅ Ruled 2026-09-22. Descriptions, not a brand.                                                                                                                                 |
| Card names                                    | Astrolabe · Ephemeris · Observatory                  | unchanged — and they stay **English**                                                                                     | 🔒  | ✅ Ruled 2026-09-22. Brand-adjacent; the three-instrument progression does not survive CJK. ⚠️ So a localized card carries a translated kicker over an English name, by design. |

---

## 1a. ↻ The aura lane's two halves — renamed (⚓ Nate asked, 2026-09-22)

⚓ **"the plot" and "the strip" named the SHAPE of each half, not its contents** — they
were generic in exactly the way a first-time reader cannot afford.

| Half               | Was       | Now                        | What is in it                                                      |
| ------------------ | --------- | -------------------------- | ------------------------------------------------------------------ |
| Above the baseline | the plot  | **the gauge lines**        | One line per aura stuck to the enemy; its height is the gauge left |
| Below the baseline | the strip | ✅ **the reaction spawns** | Dendro Core · Starlight Prism · Thundercloud · Moondrift           |

⚓ **"Gauge lines" is Nate's**, and it works because it names both axes at once — what is
measured and how it is drawn.

### ✅ The lower half is "the reaction spawns" — three candidates died first

⛔ **"the standing row" is DEAD, and ⚓ Nate killed it correctly:** only two of the four
stand. A Starlight Prism and a Moondrift sit on the ground; a Dendro Core and a
Thundercloud **hover**. ⚓ So ⛔ no physical-position metaphor can name this set — that
rules out "standing", "on the ground", and anything built on where the things sit.

⛔ **"remnants" — proposed and withdrawn.** Collision-free, but ⚓ Nate: not clear enough,
and he is right. It says these things are _left over_, which tells a first-time reader
nothing about what they are or why the row is worth looking at.

⛔⛔ **"field effects row" — recommend AGAINST, and the reason is concrete.** It would name
the row after the two things that are **drawn somewhere else**:

- **The Polestar Field's buffs are a team-buff row**, not this row.
- **Bennett's field is a summon** and draws in the summon lane.

So a reader who went looking for "field effects" in the "field effects row" would not find
either of them. ⚠️ Secondary: **"effect" is the core schema type** (`Effect` — buff /
damage / heal / shield / …), and ⚠️ "field" already carries **"on field" / "off-field"**,
this project's fixed vocabulary for which character is active (§4).

✅ **"Reaction spawns" — RULED (⚓ Nate, 2026-09-22).** What is actually true of all four — and the
only thing that is — is that **a reaction made them, they last a while, and you can count
them.** "Spawn" is real Genshin player vocabulary ("the core spawns half a second after
the Bloom"), it says where they came from, and it is silent about whether they stand or
hover. ⚠️ It collides with nothing user-facing.

⛔ Alternative considered and not taken: "reaction objects" — clearer but drier.

⚓ **Nate on why the pair works:** _"those two are much more specific and understandable on
a first read."_ ⚠️ That is the test the old "plot"/"strip" failed — both named a shape, so
neither survived a first read.

⚠️ Scope check: the lower half draws exactly those four. The name does not have to stretch
over a buff or a summon.

---

## 2. Game and theorycrafting terms with variance

| Term                  | Found in the wild                                 | ⏭ Proposed canonical                                                                  |                      | Note                                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RES shred             | **"RES shred"** (20) · "resistance shred" (2)     | **RES shred**                                                                          | 🏷                   | ⚠️ The minority spelling is in `seo.ts` — i.e. on the social card and in search results. Fix there first.                                                                                                                                                |
| Off-field damage      | **"off-field damage"** (12) · "off-field DMG" (5) | **off-field damage** in prose; **off-field DMG** only where it is a capability _badge_ | 🏷                   | ⚓ The split is real but not random — the badge is a label, the prose is prose. State the rule rather than flattening it.                                                                                                                                |
| Skill / burst         | "skill and burst" · `E`/`Q`                       | **skill** and **burst** in prose; `E`/`Q` only as notation                             | 🔒 tokens / 🔓 prose | ⛔ Never write "the E" in prose.                                                                                                                                                                                                                         |
| Normal attack         | "normal attacks", "normals"                       | **normal attack**; **normals** acceptable in dense chart furniture                     | 🏷                   |                                                                                                                                                                                                                                                          |
| Constellation         | "constellation", C0/C6                            | **constellation**; **C0** / **C6** as levels                                           | 🏷                   | ⛔ Never "con" or "cons" in user-facing text.                                                                                                                                                                                                            |
| Uptime                | "buff uptime", "permanent uptime"                 | **uptime**                                                                             | 🏷                   |                                                                                                                                                                                                                                                          |
| ICD                   | "ICD", "Standard ICD"                             | **ICD**                                                                                | 🏷                   | Explanation localizes; the three letters do not.                                                                                                                                                                                                         |
| Elemental application | "application", "applies its element"              | **application**                                                                        | 🏷                   |                                                                                                                                                                                                                                                          |
| Gauge / aura          | "gauge", "aura"                                   | **gauge** = the amount; **aura** = the element stuck to the enemy                      | 🏷                   | Already used correctly and distinctly. Worth stating because the distinction is easy to lose in translation.                                                                                                                                             |
| Crit value            | "CV", "total crit value"                          | **crit value (CV)** on first use, **CV** after                                         | 🏷                   |                                                                                                                                                                                                                                                          |
| Summon                | "summon", "a thing left in the world"             | **summon**                                                                             | 🏷                   |                                                                                                                                                                                                                                                          |
| Reaction names        | Bloom, Hyperbloom, Lunar-Charged…                 | as HoYo spells them                                                                    | 🎮                   | ↻ 2026-10-01: they TRANSLATE, as the game's own word in each locale — the termbase's `game` class (`ledger/terms.json`), not 🔒. genshin-db ships these per locale. ⚠️ **Stellar Glimmer is an umbrella term, not a reaction** — ⛔ never use it as one. |

### ⚓ Frozen and Overloaded — the game's names, locked (⚓ Nate, 2026-09-27)

The game names these reactions **Frozen** and **Overloaded**. Players widely say
"Freeze" and "Overload", and the site did too — ⛔ never either in user-facing text.
The frozen label follows the game, not community usage, for the same reason every
reaction name does: genshin-db ships the game's names per locale, and "Freeze" has no
translation to match.

✅ **Applied 2026-10-02** (the Gauge Explorer pass) — every site below now says Frozen / Overloaded; `auraPlot.test.ts` asserts the planner's labels. The sites, as found 2026-09-27: `auraDisplay.ts:159,163,199,203`
(`'Overload'`, `'Freeze'`) · `GaugeInstrument.svelte:43,46` (the log's reaction names) and
`:172` (the scenario chip) · `ReactionCurvesInstrument.svelte:65` · `anatomy.ts:66`
(`Overload ×2.75`). ⚠️ Seven character JSONs say "Overload" in prose — `caveat`s are not
rewritten (R1), so they are left.

---

## 2a. ⚠️⚠️ `Interruption Res` is NOT the frozen `RES` — and my earlier fix was wrong

✅ **RULED 2026-10-12 (⚓ Nate): `Interruption RES` — the game's own spelling** (Alyosha's kit
text writes it so). The two stats ARE different, as below; Nate judged the risk of
confusion small now that each facet carries a glyph. The proposals below are superseded.

⚓ **Nate's check, 2026-09-22, was right and it caught an error.** `Interruption Res` and
`RES shred` are **different stats**: `RES` (frozen, game-owned) is Elemental and Physical
**damage** resistance; interruption resistance is the poise/stagger stat that stops you
being knocked out of an animation. The two share four letters and nothing else.

🐛 **So the fix `team-builder.md` §1 proposed — "the game writes RES, so make it
`Interruption RES`" — was WRONG.** Uppercasing it would assert the false equation on the
one surface where both chips sit side by side. ⛔ Withdrawn.

**What is still true about that row:** it is the only Title Case facet label, so it
should follow whatever §A of the instrument conventions settles for casing.

⏭ **Proposed:** **`Interruption res`** — sentence case, and the lowercase is _load-bearing_:
it is what stops the word reading as the frozen stat. The hint under it already
disambiguates ("Grants resistance to interruption / knockback").

⏭ **Alternative if you want it unmistakable:** **`Anti-interruption`** — same length as
today's label, community-legible, and impossible to confuse with `RES`. ⛔ Not "Poise":
that is borrowed from other games and is not standard Genshin vocabulary.
⛔ Not "Interruption resistance" spelled out — the chip is already the longest in the rail
and has 20–30% of European growth coming.

Curator and engine vocabulary that has leaked, or could. ⛔ None of these belong on a
surface a player sees.

**`FrameMap` · `application[]` · `summonTick` · `icdGate` · IR · window · projection ·
lint · corpus · the oracle · digest · `provisional` (as a word — the _mark_ is fine) ·
"not yet modelled" (prefer the specific thing) · "TODO" · "curator"**

🐛 **One has already leaked: `Source view`** — the Team Builder's middle panel carries it
as an `aria-label` (`team-builder/+page.svelte:1108`). "Source" was the name of a surface
retired in 2026-08 and no visible label says it. ⚠️ A screen-reader name is invisible
until it isn't.

⚠️ **"curated" is the exception and it stays.** "Not yet curated" is the honest,
already-shipped way the tools describe a kit without frame data, it is explained in the
FAQ, and it has no better replacement. ⛔ Don't let a tidy-up delete it.

---

## 4. House spellings

## ⚓⚓ **US English, everywhere** (⚓ Nate, 2026-09-22 — supersedes the Oxford reading)

> _"US English spelling for everything, please. […] the reason things may mix in British
> English spelling is because I noticed Claude has a real tendency to spell in British
> English."_

⚠️⚠️ **The mixed spelling was never a house style — it was an AI artifact**, and the
earlier "Oxford (`-ize` + `-ll-`)" entry here was me describing the accident as if it were
a decision. ⛔ Retired.

**modeling · modeled · labeled · canceling · traveled · behavior · color · center ·
defense · analyze · visualize · gray · toward**

⚠️ `-ize` was already right and does not move: **visualize · visualizer · analyze ·
normalize** are correct in both readings.

### 🙏 Standing request — correct Nate's own British spellings too

> _"if I make a mistake and spell something in British English down the line, can you
> please correct it or flag it for me?"_

⚓ **Applies to anything he writes into a worksheet or hands back**, not just to existing
copy. Correct it silently when it is unambiguous; flag it when the fix would change
meaning.

### The 12 live British spellings — full sweep, not a sample

| Spelling          | →         | Where                                                                                                                   |
| ----------------- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `modelled` (×6)   | modeled   | `RotationPlanner.svelte:112,137,171` · `TeamBuilder.svelte:65` · `Visualizers.svelte:70` · **`CompareView.svelte:601`** |
| `modelling` (×1)  | modeling  | `RotationPlanner.svelte:42`                                                                                             |
| `labelled` (×2)   | labeled   | `About.svelte:44` · `RotationPlanner.svelte:96`                                                                         |
| `cancelling` (×2) | canceling | **`SettingsPanel.svelte:141`** · `RotationPlanner.svelte:76`                                                            |
| `neighbour` (×1)  | neighbor  | `RotationPlanner.svelte:130`                                                                                            |

⚠️ **Ten of the twelve are in help chapters — pass 2, Claude's.** Only the two in bold are
pass-1 surfaces (`settings.md` §2 and `team-builder.md` §6), and they are applied when
those sheets land.

⚠️⚠️ **Two "strays" I previously flagged were the only US-correct spellings on the site
and must NOT be changed:** `behavior` (`Contribute.svelte`) and `modeled`
(`WishInstrument.svelte:256`). ⛔ The instruction to "fix" them is withdrawn — see
`sheets/visualizers-instruments-00-conventions.md` §J.

⏭ **Owed:** the style guide's §2 **Spelling** row still says "Oxford" and needs this same
flip. Not edited because Nate is reviewing that file.

Other fixed forms: **on field** (adverbial: "when they are on field") · **off-field**
(adjectival: "off-field damage") · **frame-accurate** · **frame-perfect** ·
**theorycrafting** (one word) · **datamined** (one word) · **5★** (star glyph, ⛔ never
"5-star" or "five-star" — `WishInstrument.svelte` uses all three forms). ⚓ **One
exception (ruled 2026-09-23): screen-reader text writes `five-star`**, because `5★` is
read aloud as "5 black star".

---

## 4a. ✅ House phrases settled by a closed worksheet

| Phrase                        | Ruling                                                                                                                        | Where it was set                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **an unofficial fan project** | ⚓ The house phrase. ⛔ Retire "an independent, non-commercial fan project" (About, FAQ — pass 2 aligns them).                | `sheets/site-chrome.md` §6         |
| **Navigate**                  | The compass button, the overlay it opens, and that overlay's `<nav>` landmark — ⚓ one name for all three.                    | `sheets/site-chrome.md` §2         |
| **Site actions**              | The chrome's About/Help/Settings/compass cluster. ⛔ Not "Site", which is the nav overlay's section heading.                  | `sheets/site-chrome.md` §1         |
| **Builder**                   | The Team Builder's tool-switcher short form. ⛔ Retire "Teams".                                                               | `sheets/site-chrome.md` §5         |
| **About**                     | The chrome glyph and the nav row. ⚠️ The `/about` **chapter heading** is still "About critcalc" — a different string, pass 2. | `sheets/site-chrome.md` §1, §4     |
| **Saved rotations**           | ⚓ Sentence case, one name; ⛔ "Saved Rotations", "save bank". A verb before it lowercases it ("Open saved rotations").       | Nate, 2026-10-01 (ledger check-in) |
| **CD**                        | ⚓ CRIT DMG **only**. Cooldown is always spelled out.                                                                         | Nate, 2026-10-01 (ledger check-in) |

---

## 5. Found during the worksheet pass (2026-09-22)

New variance the sheets turned up. ⏭ These are **proposals, not rulings** — each is
decided on the sheet that raises it.

| Thing               | Found in the wild                                            | ⏭ Proposed                                                | Where it is raised                      |
| ------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------- |
| Band B, again       | ↻ a **third** name: **"the planner's toolbar"**              | the view bar (unchanged)                                   | `settings.md` §2                        |
| The loadout popover | "picker" (`Close picker`)                                    | the loadout popover                                        | `bench.md` §2                           |
| The aura log        | "Event log" in the Gauge Explorer, "aura log" in the planner | ✅ **Aura log**, both tools (⚓ Nate 2026-09-27)           | `visualizers-instruments-03-gauge.md`   |
| A capability's stat | `RES shred` (facets) · `RES Shred` (DEF & RES) — ONE term    | RES shred                                                  | `team-builder.md` §1, `…-05-def-res.md` |
| ⚠️⚠️ Interruption   | `Interruption Res` — a **different** resistance              | ⏭ see §2a, ⛔ not `RES`                                   | §2a below                               |
| Off-field           | `Off-field DMG` (facets) · `Off-Field DPS` (roles)           | off-field                                                  | `team-builder.md` §2                    |
| Crit stats          | `Crit Rate` · `CRIT Rate` · `CRIT RATE`                      | ✅ **CRIT Rate** · **CRIT DMG** (visible); aria spells out | `…-00-conventions.md` §B                |
| Elemental Mastery   | `Elemental Mastery` · `Elemental mastery`                    | Elemental Mastery 🔒                                       | `…-07-anatomy.md`                       |
| "not curated"       | four wordings across four surfaces                           | two states, one pattern                                    | `team-builder.md` §4                    |
| Joining two nouns   | `/` (×5) · `&` (×3) · `and`                                  | one rule · ✅ a RATE uses _per_, never `/`                 | `team-builder.md` §3                    |
| Emphasis            | `<strong>` · _italics_ · **CAPS** (×4)                       | ⛔ never caps (lost in CJK)                                | `…-00-conventions.md` §F                |
| Multiplier          | `×` · `x`                                                    | ✅ **×**, prefix (`×1.234`)                                | `…-00-conventions.md` §G                |

⚠️ **Community vocabulary found and needing 🏷 context notes, not translation:**
pity · soft pity · 50/50 · fate point · line (an artifact substat row) · the 70–100%
tiers · selfish carry · play tight · A4 · DPS · CV · playhead.
