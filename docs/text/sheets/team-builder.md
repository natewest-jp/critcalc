# Worksheet — Team Builder

**Surface:** the capability facets, the Atlas/Roster/Compare views, the filter rail, the
character card and its detail card, Compare/Audition, and the coverage panel.
**Pass:** 1 (Nate leads) · **Strings:** ~90 (plus repeats noted below) ·
**Guide:** `docs/text/style-guide.md` · **Glossary:** `docs/text/glossary.md`

⚓ **The capability vocabulary in §1 is the tool's whole argument.** Those fifteen labels
are what the Team Builder _is_ — "who can heal, who can shield, at which constellation."
They appear on badges, in filter chips, in the detail card, in Compare's chart headings
and in the facts table. A change to one propagates to five surfaces. Treat §1 as the
most consequential section in this round.

---

## 1. ⚠️ The capability facets — fifteen labels, three casing conventions

| key             | Label now        | New | Hint now                                          | New hint |
| --------------- | ---------------- | --- | ------------------------------------------------- | -------- |
| `cap.heal`      | Heals            |     | Restores HP to someone                            |          |
| `cap.shield`    | Shields          |     | Creates a damage-absorbing shield                 |          |
| `cap.interrupt` | Interruption Res |     | Grants resistance to interruption / knockback     |          |
| `cap.offfield`  | Off-field DMG    |     | Coordinated attacks or damaging summons           |          |
| `cap.resshred`  | RES shred        |     | Lowers enemy elemental/physical RES               |          |
| `cap.cleanse`   | Cleanse          |     | Removes elemental auras from party members        |          |
| `cap.grouping`  | Grouping         |     | Pulls or gathers enemies                          |          |
| `cap.atk`       | ATK buff         |     | Buffs allies' ATK                                 |          |
| `cap.em`        | EM buff          |     | Buffs allies' Elemental Mastery                   |          |
| `cap.crit`      | Crit buff        |     | Buffs allies' Crit Rate / Crit DMG                |          |
| `cap.dmg`       | DMG% buff        |     | Buffs allies' damage bonuses                      |          |
| `cap.hpdef`     | HP/DEF buff      |     | Buffs allies' HP or DEF                           |          |
| `cap.infusion`  | Infusion         |     | Applies an elemental infusion to on-field attacks |          |
| `cap.energy`    | Energy           |     | Grants flat energy                                |          |
| `cap.taunt`     | Taunt            |     | Summons draw enemy aggro                          |          |

`src/lib/capabilities/facets.ts:47–69`

- ↻⚠️⚠️ **"Interruption Res" — HALF of what this row used to say was WRONG.** ⛔ It is
  **not** the same stat as `RES shred`: `RES` is Elemental/Physical **damage** resistance,
  interruption resistance is the poise/stagger stat. ⛔ **Do not uppercase it to
  `Interruption RES`** — that asserts a false equation on the one surface where both chips
  sit side by side. What survives: it is the only Title Case label, so it follows whatever
  §A settles. ⏭ Proposal + alternatives: **glossary §2a**.
- ⚠️ **`DMG` / `RES` / `ATK` / `EM` / `HP` / `DEF` are 🔒 frozen** stat abbreviations, so
  each label is 🏷 mixed: the abbreviation stays, the English word beside it translates.
  A translator needs the split marked, not the label as a blob.
- ⚠️ **"Heals" and "Shields" are plural verbs; everything else is a noun phrase.** They
  read as "this character heals" while "Grouping" reads as a category. Both work as chips;
  they will not both work in a language that inflects.
- ⚠️ **"someone" in the Heals hint** is vague where every other hint is specific
  ("party members", "allies", "enemies"). ⚓ It may be deliberate — a heal can target self
  — but then say so.
- ⚠️ **tight** — these are chips in a rail and headings in a chart. **"Interruption Res"
  is already the longest** and every European locale adds 20–30%.

---

## 2. Roles and view tabs

| key              | Where            | Now             | New |
| ---------------- | ---------------- | --------------- | --- |
| `role.onfield`   | Role filter      | On-Field DPS    |     |
| `role.offfield`  | Role filter      | Off-Field DPS   |     |
| `role.support`   | Role filter      | Support         |     |
| `role.survive`   | Role filter      | Survivability   |     |
| `tb.tab.roster`  | Middle-panel tab | Roster          |     |
| `tb.tab.compare` | Middle-panel tab | Compare         |     |
| `tb.roster.aria` | The Roster view  | Roster view     |     |
| `tb.source.aria` | The middle panel | Source view     |     |
| `tb.atlas.title` | Atlas heading    | Explore by role |     |

`src/routes/(scene)/(tools)/team-builder/lib/roles.ts:39–42` ·
`AtlasView.svelte:47` · `team-builder/+page.svelte:806,896,897,1108`

🐛 **"Off-Field DPS" (roles) and "Off-field DMG" (facets) capitalize differently.** Same
hyphenated compound, two conventions, and they sit within a few pixels of each other in
the UI. ⚓ The glossary rules **off-field** (lowercase f).
⚠️ **"Source view"** is internal vocabulary — "Source" was the name of a retired surface
and no user-facing label says it. ⛔ Banned by the glossary's §3; this is a screen-reader
name, so it is invisible until it isn't.
⚠️ **"DPS" is 🔒 frozen** community jargon; the words around it translate.

---

## 3. The filter rail

| key                      | Where                                       | Now                                          | New |
| ------------------------ | ------------------------------------------- | -------------------------------------------- | --- |
| `tb.filters.aria`        | The rail                                    | Filters                                      |     |
| `tb.filters.open`        | The plate that opens the drawer below 54rem | Filters                                      |     |
| `tb.filters.open.title`  | Its tooltip                                 | Filter the roster                            |     |
| `tb.filter.element`      | Group heading                               | Element                                      | 🔒  |
| `tb.filter.weapon`       | Group heading                               | Weapon                                       | 🔒  |
| `tb.filter.rarity`       | Group heading                               | Rarity                                       | 🔒  |
| `tb.filter.region`       | Group heading                               | Region                                       | 🔒  |
| `tb.filter.role`         | Group heading                               | Role                                         |     |
| `tb.filter.factions`     | Group heading                               | Factions / Buffs                             |     |
| `tb.filter.provide`      | Group heading                               | Can provide                                  |     |
| `tb.filter.provide.hint` | Under it                                    | Matching characters provide all of these.    |     |
| `tb.filter.clear`        | Button                                      | Clear filters                                |     |
| `tb.roster.mark.title`   | Roster tiles' tooltip                       | Click tiles to mark which characters you own |     |
| `tb.con.read`            | Above the constellation switch              | Read capabilities at                         |     |

`src/lib/components/CharacterFilterRail.svelte:100,125,140,154,168,185` ·
`team-builder/+page.svelte:914,920,946,962,975,1020,1024,1203`

✅ **Part of this is ruled (⚓ Nate, 2026-09-23): a slash that means _per_ becomes the word
"per"** (`Hits / Rotation` → `Hits per rotation`, Crit instrument). A rate is not two
nouns joined, so ⏭ **what is still open here is only the joining case** (`Factions /
Buffs`, `Boss / Strongbox`, `Levels & Enemy`, `Enemy DEF & RES`, `Spread/Aggravate`).
⚠️ **"Factions / Buffs" uses a spaced slash** — the only one on the site. Other pairs use
"and" ("weapon and refinement") or an ampersand ("Enemy DEF & RES"). ⚓ Three conventions
for the same job; pick one.
⚠️ **"Can provide" + "Matching characters provide all of these."** ⚓ The hint is doing
essential work — it says the filters are AND, not OR, which is the tool's most
misunderstood behavior. ⛔ Never cut it for space.
⚠️ **"Read capabilities at"** is a sentence stem completed by the control beside it
(C0 / My roster / C6). ⚠️⚠️ **ASSEMBLED across a control** — in several languages the
preposition cannot lead. Needs restructuring, not translating.

---

## 4. 🐛 "Not curated" is explained four times, four ways

The same idea — _a missing badge means unknown, not no_ — appears on four surfaces with
four wordings.

| Where                                   | Now                                                                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Bench card + character card tooltip     | Frame timing not curated yet — capabilities are complete, but Planner timing is approximate                                              |
| Detail card, uncurated kit              | Kit not yet curated — capability data below is incomplete. Missing entries mean "unknown", not "no".                                     |
| Detail card, curated kit without frames | Capabilities below are complete. Frame timing isn't curated yet, so only this character's rotation timing is approximate in the Planner. |
| Roster, the uncurated bucket            | These kits have no capability data yet — they may well do what you're filtering for. Absence of a badge here means "unknown", not "no".  |

**New (bench/card tooltip):**
**New (detail, uncurated kit):**
**New (detail, no frames):**
**New (roster bucket):**

`src/lib/components/CharacterCard.svelte:185,186` · `DetailCard.svelte:236,241` ·
`team-builder/+page.svelte:877,878`

- ⚓ **There genuinely are two different states** — _no capability data_ and _capabilities
  but no frames_ — and conflating them would lose the site's most precise honesty claim.
  ⛔ Do not merge the four into one.
- 🐛 **But "unknown, not no" is written twice in different words**, and the two
  "Planner timing is approximate" lines are near-duplicates. ⚓ Make the _pattern_ one
  thing said two ways, not four.
- 🐛 **"the Planner" / "in the Planner"** — capital-P short form again, third and fourth
  occurrences. Glossary: **Rotation Planner**, or lowercase "the planner".
- ⚠️ The bench tooltip and the character-card tooltip are **byte-identical strings in two
  files** → one key. (Also `bench.md` §2.)
- ⚠️ Note the curly quotes around "unknown"/"no" — correct per the guide.
- ⚠️ `Not yet curated` is also a bare heading (`+page.svelte:877`) and `not curated` a
  bare chip in Compare (`CompareView.svelte:423`) — **two more casings of the same
  phrase.**

---

## 5. The detail card

| key                        | Where                              | Now                                                       | New |
| -------------------------- | ---------------------------------- | --------------------------------------------------------- | --- |
| `tb.detail.close`          | ✕                                  | Close                                                     |     |
| `tb.detail.roster`         | Section heading                    | Your roster                                               |     |
| `tb.detail.owned`          | Toggle                             | Owned                                                     |     |
| `tb.detail.wishlist`       | Toggle                             | Wishlist                                                  |     |
| `tb.detail.wishlisted`     | Card badge tooltip                 | Wishlisted                                                |     |
| `tb.detail.ownership.aria` | The ownership control              | Ownership                                                 |     |
| `tb.detail.con.aria`       | The constellation control          | Your constellation                                        |     |
| `tb.detail.caps`           | Section heading                    | Capabilities                                              |     |
| `tb.detail.loading`        | While the payload loads            | Loading kit data…                                         |     |
| `tb.detail.timing`         | Section heading                    | Timing reference                                          |     |
| `tb.detail.tagged`         | A capability marked but unmeasured | tagged                                                    |     |
| `tb.detail.tagged.title`   | Its tooltip                        | Marked on the ability, but target/scaling not yet curated |     |

`src/lib/components/DetailCard.svelte:229,250,251,257,264,273,303,305,330,358` ·
`CharacterCard.svelte:162,168`

⚠️ **"Loading kit data…" appears in two files** (`DetailCard:305`, `CompareView:454`) →
one key.
⚠️ **"tagged" is lowercase and unexplained on its face** — it is the one word carrying
"we know this ability does this, but we have not measured how much." ⚓ That is a real and
useful distinction; the word is too quiet for it.

### `tb.detail.roster.note` — what a roster constellation means

**Now:** Saved to your roster — "My roster" filtering across the site uses it. Setting a
constellation marks the character owned.
**New:**
**Notes:** ⚠️ Names a control ("My roster") in prose — style guide §3.3.
`src/lib/components/DetailCard.svelte:286`

### ⚠️ `tb.detail.roster.vs.rotation` — assembled, and it is the tool's trickiest idea

**Now:** This is your roster constellation, and it can only be changed in the Team
Builder. To set the constellation for **this rotation**, use the C value on the bench
card.
**New:**
**Notes:** ⚠️⚠️ **ASSEMBLED** — three fragments around `<strong>this rotation</strong>`.
⚓ **This sentence carries the whole roster-vs-plan distinction**, which is the thing
users most often get wrong: your saved roster is one thing, the team in this tab is
another. ⛔ Worth more words rather than fewer.
`src/lib/components/DetailCard.svelte:293–295`

### `tb.detail.nothing` / `tb.compare.nothing` — the empty capability state

**Now (one):** Nothing team-facing derives from this kit — likely a selfish carry, or
curation hasn't covered its utility yet.
**Now (many):** Nothing team-facing derives from these kits.
**New (one):**
**New (many):**
**Notes:** ⚓ **"a selfish carry" is community idiom and it is exactly right here** — it
names a real archetype without scoring it. ⚠️ It is the SPECIFICITY that works, ⛔ not
the restraint being announced (style guide §1.3a).
⚠️ It will not translate literally; it needs a context note saying what it means.
⚠️ The singular form's second clause is **conditional** (it only appears for a curated
kit) — so this is really two messages, not one with an optional tail.
`src/lib/components/DetailCard.svelte:307` · `CompareView.svelte:641`

---

## 6. Compare and Audition

| key                   | Where                        | Now                            | New |
| --------------------- | ---------------------------- | ------------------------------ | --- |
| `tb.cmp.axis`         | Control label                | Axis                           |     |
| `tb.cmp.element`      | Lens option                  | Element                        | 🔒  |
| `tb.cmp.show`         | Chip group label             | Show                           |     |
| `tb.cmp.ruler`        | Chart heading                | Timing on one ruler            |     |
| `tb.cmp.table`        | Table heading                | Side by side                   |     |
| `tb.cmp.attr.aria`    | The table's attribute column | Attribute                      |     |
| `tb.cmp.clear`        | Button                       | Clear                          |     |
| `tb.cmp.cancel`       | Audition only                | Cancel audition                |     |
| `tb.cmp.back`         | Audition only                | Back to planner                |     |
| `tb.cmp.back.title`   | Its tooltip                  | Return to the rotation planner |     |
| `tb.cmp.current`      | The incumbent's row          | Currently in {slotName}        |     |
| `tb.cmp.take`         | The gold button on a column  | Take {slotName}                |     |
| `tb.cmp.take.title`   | Its tooltip                  | Put {name} in {slotName}       |     |
| `tb.cmp.remove.aria`  | ✕ on a column                | Remove {name} from comparison  |     |
| `tb.cmp.remove.title` | Its tooltip                  | Remove from comparison         |     |
| `tb.cmp.e.cd`         | Facts-table row              | E cooldown                     |     |
| `tb.cmp.q.cd`         | Facts-table row              | Q cooldown                     |     |
| `tb.cmp.q.energy`     | Facts-table row              | Q energy                       |     |

`src/routes/(scene)/(tools)/team-builder/lib/CompareView.svelte:366,378,379,384,398,417,435,436,442,443,461,482,495,520,609,615` ·
`compare.ts:334,339,344`

⚠️ **"Back to planner" vs its tooltip "Return to the rotation planner"** — lowercase
common-noun use. ⚓ Acceptable per the glossary ("the planner"), but the button's bare
"planner" and the sheet's other capital-P "Planner" (§4) should not both survive.
⚠️ **`E cooldown` / `Q cooldown` use notation tokens as words**, like the planner's
"E reset". 🔒 The tokens are frozen; the word beside them is not. ⚠️ Worth confirming
these are the **facts table**, not the retired chart groups — the chart's cooldown groups
were deleted deliberately (every lane's ghost segment _is_ its cooldown), and copy that
implies otherwise would re-describe a surface that no longer exists.

### ⚠️ `tb.cmp.footnote` — the chart's whole caveat, in four fragments

**Now:** A lane is one ability; the heading is what it does. Solid = the cast you make
now, faint = the same cast repeated on cooldown — **energy is not modelled**, so a burst's
repeats are a best case. Ticks mark a summon's cadence over its first window.
**New:**
**Notes:**

- ⚓ **This footnote is where the repeat-fade's honesty lives.** The repeat _is_ a claim
  (cast-on-cooldown, energy unmodeled) and the decision was to put the caveat here rather
  than fade the bars. ⛔ So this string is load-bearing and must not be trimmed for space.
- ⚠️⚠️ **ASSEMBLED**, and it uses `=` as a copula twice ("Solid = …, faint = …"). That is
  a legend convention and survives translation, but it is also four independent claims in
  one paragraph.
- ⚠️ **tight-ish** — it sits under the chart and wraps freely, so length is affordable.
  `src/routes/(scene)/(tools)/team-builder/lib/CompareView.svelte:599–601`

### `tb.cmp.legend` — the facts table's legend

**Now:** ~ = conditional (hover for the condition) · hover a cell for its source ability ·
full provenance lives in each character's detail card.
**New:**
**Notes:** ⚠️ **Three instructions joined by `·`**, all of them hover-only — ⚠️ which
means **none of them is reachable on a touch device**, where the tools now run. Worth
knowing before rewording.
⚠️ `~` is a 🔒 frozen symbol (it is drawn in the cells).
`src/routes/(scene)/(tools)/team-builder/lib/CompareView.svelte:700`

### Empty and edge states

| key                 | Where                                  | Now                                                                                | New |
| ------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- | --- |
| `tb.cmp.allhidden`  | Every chip off                         | Every effect is hidden — turn a chip back on to draw the chart.                    |     |
| `tb.cmp.notiming`   | No curated timing in the selection     | No curated timing to draw for this selection.                                      |     |
| `tb.roster.nomatch` | No character matches every "Show" chip | No one covers all of these at once — turn a "Show" chip off to broaden the search. |     |
| `tb.alt.none`       | No same-element alternative            | No same-element alternative in this role yet.                                      |     |
| `tb.alt.norole`     | No curated provider in a role          | No curated providers in this role yet.                                             |     |

`src/routes/(scene)/(tools)/team-builder/+page.svelte:846,1386,1412` ·
`CompareView.svelte:594,596`

⚓ **Every one of these tells the reader what to do next**, which is the right shape for
an empty state and is already consistent. ⛔ Don't lose the second clause in a trim.
⚠️ Two end in "yet." ⚓ Good — it says the gap is curation, not the game.

---

## 7. Small, and the ones the extractor could not read

| key                | Where                          | Now                                                                   | New |
| ------------------ | ------------------------------ | --------------------------------------------------------------------- | --- |
| `tb.atlas.provide` | Atlas tile                     | provide                                                               |     |
| `tb.atlas.owned`   | Atlas tile                     | owned                                                                 |     |
| `tb.alt.intro`     | Above the alternatives list    | Alternatives for each character on your team — same element and role. |     |
| `tb.alt.browse`    | Button                         | Browse all roles                                                      |     |
| `tb.alt.all`       | Option                         | All roles                                                             |     |
| `tb.cov.intro`     | Coverage panel                 | This team covers                                                      |     |
| `tb.cov.resonance` | Coverage note                  | resonance needs a full party of 4                                     |     |
| `tb.con.mine`      | Constellation mode             | at your constellations                                                |     |
| `tb.con.at`        | Constellation mode             | at {C0/C6}                                                            |     |
| `tb.card.con`      | Card badge                     | C{n}                                                                  | 🔒  |
| `tb.card.overflow` | Card badge, extra capabilities | +{n}                                                                  |     |

`AtlasView.svelte:130,133` · `CoveragePanel.svelte:108,128` ·
`team-builder/+page.svelte:866,868,1313,1317,1323` · `CharacterCard.svelte:162,211`

⚠️ **"This team covers" and "resonance needs a full party of 4" are both sentence stems**
completed by markup. ⚠️⚠️ ASSEMBLED, both.
⚠️ **"4" as a digit mid-sentence** — the guide has no rule; "four" is the prose form.
⚠️ **The detail card's identity line** (`· {weapon} · {rarity}★ · {region}`) is a
separator-joined list built in a template. 🔒 Its values are frozen, but the `★` and the
`·` joins are presentation and should not end up inside a locale string.
⚠️⚠️ **`DetailCard.svelte:367`'s timing line** (`{n} charges · {n} energy`) is a plural
case the extractor could not read cleanly — **"1 charges"** is reachable. Needs ICU.
