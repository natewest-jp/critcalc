# The text round — the site's words, rewritten before they are translated

**Status:** survey in progress (started 2026-09-22)
**Roadmap item:** Launch Roadmap §13. ⚠️ Slipped three times; this is the un-cuttable item.
**Sequence:** thin inventory → style guide + glossary (⏭ **Nate rules**) → per-surface worksheets → pass 1 (Nate) ∥ coverage page (Fable) → pass 2 (static pages, Claude leads)

---

## 0. Why the order is this order

⚓ **Rewrite in place first, extract second — never both at once.** Entangling a wording
change with a structural refactor means neither reviews cleanly, and it is why
translation cannot precede the rewrite: extracting now means keying strings we are
about to change and translating strings we are about to rewrite. (Launch Roadmap,
"the wording pass, then i18n".)

⚓ **But the rewrite RECORDS what extraction will need.** Each worksheet row carries its
`file:line` and a one-line context note. That is ~90% of the extraction pass's manual
work, paid at near-zero cost while the surface is in someone's head, and it does not
move a single string. ⛔ No `m.some_key()` call lands in this round.

⚓ **A rewrite is mostly a DECISION exercise, not a writing exercise.** Eight hundred
locally-improved strings that were each judged alone do not sound like one site — and
translation multiplies inconsistency by six locales rather than absorbing it. So the
glossary and the style guide come before the worksheets, and the worksheets are an
application of them.

---

## 1. Scope — measured 2026-09-22

| Surface                                           | Size                                | Pass                 | Medium       |
| ------------------------------------------------- | ----------------------------------- | -------------------- | ------------ |
| Help chapters (7)                                 | ~4,800 words                        | 2                    | conversation |
| Static pages (about/contribute/privacy/settings)  | in the chapters above + page shells | 2                    | conversation |
| `seo.ts` titles + descriptions                    | 14 pairs                            | 2                    | conversation |
| Landing (kickers, card names, announcements)      | ~10 strings                         | 1                    | worksheet    |
| Tool chrome — labels, buttons, tabs, empty states | ~500 strings across 75 components   | 1                    | worksheet    |
| `aria-label` / `title` / `placeholder`            | 143                                 | 1                    | worksheet    |
| Error page + 404                                  | ~8 strings                          | 2                    | conversation |
| Character `caveat` strings                        | ~149                                | ⛔ **not rewritten** | —            |

**Not yet written, and it lands INSIDE this round's guide rather than after it:** the
BETA explainer, the feedback-channel copy (`/contribute` currently carries a live TODO
and promises nothing, correctly), the `/privacy` analytics paragraph if analytics ships,
and the **coverage page's** copy. ⚠️ The coverage page is being built in parallel — if
the style guide is not ruled before its copy is written, that copy joins the backlog it
was meant to be ahead of.

---

## 2. Rulings

### ⚓ R1 — Caveats are NOT rewritten, and ARE translated (⚓ Nate, 2026-09-22)

> _"Caveats don't need to be rewritten, and I don't need to spot-check any. […] They're
> the surface that is safest to be potentially AI-generated-sounding. And I'd like to
> include them in translation — they're important for users of the site."_

Two consequences, both load-bearing:

- **`docs/curation/caveat-style-guide.md` is promoted from a curation doc to a
  translation-source contract.** It now defines the register of ~149 strings that ship in
  every supported locale. ⛔ Changes to it are no longer local to curation.
- ⚠️⚠️ **Every future character ingest now carries translation debt in every locale.**
  This is the accepted cost of R1, not an oversight — but the ingest pipeline gains a
  downstream step it did not have, and the `ingest-character` skill should say so once
  Paraglide lands. Flag it there; do not silently accumulate it.

### ⚓ R2 — The frozen list: what this round does not touch and translation must not either

| Class                                             | Examples                                                      | Why                                                                                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **KQM notation tokens**                           | `E` `Q` `N5` `C` `A` `D` `J` `P` `sQ` `sE` `sC` `W` `~2s` `>` | ⛔⛔ Parser contract. Localizing them breaks the notation standard **and every `?r=` link in the wild.**                                                               |
| **Character / ability / weapon / artifact names** | Bennett, Nightrider, Favonius Sword                           | genshin-db ships the official HoYo localization per locale. Free, and ours would be wrong.                                                                             |
| **Stat + element names**                          | ATK, DEF, CRIT Rate, EM, Pyro                                 | Same — game-owned.                                                                                                                                                     |
| **Theorycrafting jargon**                         | ICD, snapshot, CV, gauge, aura tax, uptime                    | ⚓ Not a translation problem, an ethnography one. Community usage has diverged and much of it runs untranslated. **Keep the English label, localize the explanation.** |
| **Brand**                                         | critcalc, critcalc.app                                        | Never translated.                                                                                                                                                      |

⏭ **Two open calls in this class, for Nate (§4).** Tool names (Rotation Planner / Team
Builder / Visualizers) and the landing's poetic card names (Astrolabe / Ephemeris /
Observatory).

### ⚓ R4 — Capitals are never emphasis (⚓ Nate, 2026-09-22)

⛔ Absolute, site-wide. Style guide §2.1; three live sites, all in the instruments.

### ⚓ R5 — The existing prose carries no authorial intent (⚓ Nate, 2026-09-22)

> _"Pretty much all text on the site was generated by AI, not written by me at this
> point. […] any string is fair game for rewriting, even the ones that you might have
> marked as worth protecting."_

⚠️⚠️ **This corrects an assumption the worksheets were built on.** Their ⚓/⛔
"worth protecting" notes were written as though the prose were authored and load-bearing.
⚓ **Re-read every one as a note about the JOB the sentence does, not the words** — see
`docs/text/sheets/README.md`, which carries the reframing where Nate will actually meet
it. ⛔ Nothing in the sheets is a veto.

⚠️ Consequence for pass 2: the help chapters and static pages are **not** a light edit of
good existing prose. They can be rewritten from the sections up, which is what §13's
pass-2 shape ("decide what the pages need, then write") already assumed.

### ⚓⚓ R6 — US English, everywhere (⚓ Nate, 2026-09-22)

> _"US English spelling for everything, please. […] Claude has a real tendency to spell in
> British English."_

⚠️⚠️ **The mixture was an AI artifact, not a house style** — and the survey's first cut
read it as one, describing the accident as an "Oxford" convention. ⛔ Retired. Full rule,
the 12 live spellings with file:line, and the two withdrawn "strays": **glossary §4**.

🙏 **Standing request, wider than the corpus:** correct or flag Nate's _own_ British
spellings when he writes one into a worksheet or a reply — silently when unambiguous,
flagged when the fix would change meaning.

### ⚓⚓ R7 — The register: humble, "we" not "I", and ⛔ no creed (⚓ Nate, 2026-09-22)

Three rulings from one conversation, all in style guide §1.3–§1.4.

- ⛔ **The "visualize mechanics, never calculate verdicts" framing is retired as a
  REGISTER.** ⚓ The idea stays; the slogan goes. It was generated during brainstorming,
  hardened into something legalistic, and had spread to **~10 restatements across 7
  surfaces**. ⚓ Nate: the word **"never"** clashed hardest — the site is meant to feel
  like a place of endless possibility. ⛔ So never write "never" about the project's
  future; the tools could reach damage numbers, that is simply not the goal now.
- ⚓⚓ **Humble, without apologizing** (§1.3b) — ⛔ no apology about **the work**, ⚓
  humility about **the authority**. Nate is explicit that much of the audience knows more
  than we do. ⛔ Never imply otherwise.
- ✅ **"We", never "I"** (§1.4) — ⚓ and it is a **genuine plural**, not a corporate one:
  Claude wired the site, and from launch Nate wants contributors. ↻ The earlier warning
  that "we" would sound like a company is **withdrawn**.
- ⛔⛔ **Don't explain what the reader can work out** (§1.3c) — ⚓ Nate: telling someone
  something obvious is where it turns condescending. ⚠️ It is the opposite of terseness:
  **instruction is welcome**, and a non-obvious detail beats a paragraph about why
  something matters. 7 live instances; ⚠️ two of them are the same sentence on two pages,
  the same duplication the creed had. ↻ **Two of my own "protect this" notes are
  reversed by it** (`errors-and-frame.md`, `…-07-anatomy.md`).

### ⚓ R3 — The review unit is the SURFACE, never the string

A label is judged against its neighbors. Worksheets are grouped by what a reader
encounters together and ordered as the eye reads them, ⛔ never alphabetically and ⛔
never by file. The tier column exists; it is not the organizing axis.

---

## 3. The worksheet protocol

⚓ **Nate works offline.** The medium is chosen so pass 1 costs no Claude session — Nate
edits markdown on his own clock while the coverage page is built in parallel.

One file per surface, `docs/text/sheets/<surface>.md`. Each row:

```markdown
### `tb.roster.empty` — Roster, empty state

**Where:** Team Builder → Roster tab, when every filter excludes everything.
**Now:** No characters match these filters.
**New:**
**Notes:** 42 chars. Container is fixed-width; +30% (RU) overflows at ~55.
`src/lib/components/CharacterGrid.svelte:118`
```

- **`New:` blank means "leave it alone."** Only filled rows are applied. Nate does not
  have to touch a row to approve it.
- **`Notes:` carries the length budget** where a string is already tight, so the
  rewrite does not walk into a break the pseudo-locale pass would find later.
- The key stub (`tb.roster.empty`) is **recorded, not used** — it is extraction's
  head start, per §0.
- ⚠️ A row whose text is a fragment assembled at runtime is marked **`⚠ ASSEMBLED`**
  and shows all its parts. Those are the rows that must become whole sentences; see the
  style guide's §3.1.

Claude applies a returned sheet in one commit per surface, and Nate reviews in situ.

---

## 4. ✅ Calls ruled — ⚓ Nate, 2026-09-22 ("yes to all")

1. ✅ **Tool names TRANSLATE.** Rotation Planner / Team Builder / Visualizers are
   descriptions, not a brand. A Japanese reader gains more from
   「ローテーションプランナー」 meaning something than from it being familiar. 🔓
2. ✅ **Card names stay ENGLISH.** Astrolabe / Ephemeris / Observatory are three
   instruments of observation in increasing scope, and the progression is the point. It
   survives in the Romance and Slavic languages but loses its shared etymological
   register in CJK, and the names are doing brand work rather than descriptive work.
   🔒 Treat as brand-adjacent.
   ⚠️ Consequence for the landing card: the **kicker** (the tool's real name) localizes
   and the **name** under it does not — so a locale's card carries one translated line
   and one English one, by design. ⚠️ The kicker is the line already allowed to wrap, and
   it is the one that grows 20–30% in RU/FR/ES. Flag it in the landing worksheet.
3. ✅ **Three speakers, each with a job** — style guide §1.4. ⛔ Not flattened to one.

---

## 5. What the thin inventory found

Detail and proposed rulings in `docs/text/glossary.md`; the short version:

- **One control, two names, in one chapter.** Band B is "the view bar" in the Rotation
  Planner help's aura section and "the view controls" three paragraphs later.
- **`RES shred` (20 files) vs `resistance shred` (2)** — and the minority spelling is in
  `seo.ts`, i.e. the social card.
- **`off-field damage` (12) vs `off-field DMG` (5).**
- **`composer` (11) vs `notation editor` (5)** for the CodeMirror surface.
- **`aria-label="Close"` ×5 and `aria-label="close"` ×2.** ⚠️ The perfect illustration of
  §3.2 of the style guide: these are one meaning and must become one key — but they are
  also, today, two strings, and a naive dedupe-by-spelling pass would keep both.
- ↻ **Spelling was MIXED, and it is now ruled US English** (⚓ Nate, 2026-09-22 — R6).
  ⚠️⚠️ The first cut of this survey read the mixture as an intentional "Oxford" house
  style and was wrong: it was an AI artifact. 12 live British spellings, ten of them in
  help chapters — glossary §4 has the table. ⛔ And the two "strays" this line originally
  named (`behavior`, `modeled`) were the only US-correct spellings on the site. The old
  finding read: ~~Oxford (`-ize` + `-ll-`: visualize, modelled, labelled, cancelling)~~ with
  two American strays (`behavior`, one `color` in prose). Oxford is a real, consistent
  house style; the strays are just strays.
- **Sentence case headings throughout** — already consistent, nothing to fix.
- **Bold names a UI control** (`press **Compare**`) and `<code>` wraps a notation token
  — both already consistent conventions. ⚠️ Both become extraction hazards; style guide §3.

---

## 6. What the worksheet pass found

**18 sheets, ~570 strings, `docs/text/sheets/`.** Index + suggested order: its README.

⚓ **The voice is strong and consistent; the vocabulary is not.** Almost nothing found is
badly written. What varies is what things are _called_, how labels are _cased_, and how
sentences are _assembled_ — and the third of those is the one that decides whether the
extraction pass is mechanical or a refactor.

**Defects, not taste calls (🐛):**

|                                                                                                         | Where                    |
| ------------------------------------------------------------------------------------------------------- | ------------------------ |
| The compass button says "Go to" and never finishes the sentence — it is the only nav control on a phone | `site-chrome.md` §2      |
| The footer's copyright year is hardcoded `2026`                                                         | `site-chrome.md` §6      |
| Settings names a planner button "Human"; the button says "Human timing"                                 | `settings.md` §2         |
| Settings calls band B "the planner's toolbar" — a **third** name for it                                 | `settings.md` §2         |
| The import confirmation has three unguarded plurals ("1 owned characters")                              | `settings.md` §3         |
| Undo/Redo tooltips hardcode `⌘Z` — a Windows-majority audience                                          | `rotation-planner.md` §5 |
| `TARGET AURA` (chart) and `Target aura` (its log) are one thing named twice                             | `rotation-planner.md` §1 |
| `Interruption Res` — the only Title Case facet, and `Res` where the game writes `RES`                   | `team-builder.md` §1     |
| `Off-Field DPS` vs `Off-field DMG` sit pixels apart                                                     | `team-builder.md` §2     |
| `Elemental Mastery` vs `Elemental mastery` — same stat, two lines apart                                 | `…-07-anatomy.md`        |
| `modeled` (American) in Wish Odds; `behavior` in Contribute                                             | glossary §4              |
| `1.234x` where the whole site uses `×`                                                                  | `…-00-conventions.md` §G |
| "Source view" — retired internal vocabulary, live as an `aria-label`                                    | glossary §3              |

**Structural, and this is where the real cost is:**

- ⚠️⚠️ **~25 assembled strings.** The worst are Artifact Rolls' readout (20+ fragments,
  parentheses opened in one and closed in another), Settings' import confirmation, the
  Enemy DEF & RES readout, and the tabs-full dialog. ⚓ These need **restructuring before
  extraction**, not re-keying — style guide §3.1.
- ⚠️ **Uppercase used as emphasis in four places** and as lane/axis labels throughout.
  ⛔ Lost entirely in CJK, where `<strong>` survives.
- ⚠️ **Colons, slashes and ampersands live inside the strings.** French spaces its colons,
  Japanese uses `：`, and the site joins two nouns five different ways.
- ⚠️ **"Not curated" is explained four times in four wordings** across two genuinely
  different states. ⛔ The states must stay distinct; the wordings should not.

**Worth protecting (⚓), found by reading:** "the hidden rule that stops every hit from
applying its element" · "reports are how problems get found" · "Your saved rotations are
untouched" · "No aura — the next element applies fresh" · "Odds only — no verdicts on
whether to pull" · "Fixed order, no verdicts: the bars speak for themselves" · "isn't
fully datamined, so it isn't modeled" · "a selfish carry" · "The unlucky tenth".

---

## 7. Record

- 2026-09-22 — Round opened. Nate's calls: worksheets for pass 1; thin inventory →
  style guide → worksheets; caveats not rewritten, in scope for translation (R1).
- 2026-09-22 — Style guide and glossary **ruled** ("yes to all"): tool names translate,
  card names stay English, three speakers each with a job (§4).
- 2026-09-22 — Worksheet format settled (table for short labels, block for anything
  needing discussion) and **all 18 sheets generated**. ⏭ Nate works them offline; the
  coverage page is built in parallel.

## Notes carried over from Claude's working memory (2026-10-29)

From `docs/rounds/text-round.md`. ⚠️ Parts of §5 and §6 above were later withdrawn; the reversals are listed below.

### Where the round went after §7

- **Day 1 (2026-09-22)**, branch `text/round-2026-09-22`: `845e9000` applied the site-chrome sheet to the code; `24c43c09` added this record, the style guide, the glossary, the 18 worksheets and CLAUDE.md's rewritten opening line.
- **Day 3 (2026-09-27)**: `4a27a198` re-extracted ~370 strings the first pass missed (object literals, template literals, `title`/`aria-label`) into an "Added 2026-09-27" section at the end of 14 sheets, behind a ☐ box, and ruled ICD 02; `0ff6aa2b` ruled Gauge 03, re-checked Crit 01 strictly and locked Frozen/Overloaded in glossary §2. The method: Svelte's `parse()` walked generically plus the TS compiler for `.ts`, diffed against the sheets; single words can't be verified by substring.
- **How a sheet session ran:** Nate edits `New:` cells and `→ N:` notes inline; Claude cross-checks every mechanic claim against `gauge.ts` and gcsim, answers with `→ C:` notes, writes the agreed text in, then commits. A strict per-sheet check (every string in the sheet's source files against that sheet, single words included) found two misses on a "done" Crit sheet. ⚠️ A blank `New:` is an APPROVAL, not an omission: ⛔ never "improve" a row left blank. ⚠️ In an "Added 2026-09-27" section, though, a blank `New:` is not an approval until its ☐ is ticked.
- **Day-2 rulings (⚓ Nate):** sentence case for instrument labels (frozen game terms keep their casing) · CRIT Rate / CRIT DMG visible, `Crit rate/damage` in aria · `five-star` in aria text only (glossary §4 exception) · × before the number · a RATE takes "per", never `/` · Readout stays · the Crit headline is `×1.72` + "Average DMG per hit. A hit that doesn't crit is ×1."
- **Mechanics accepted on day 3:** Pyro-on-Pyro is special since 3.0 (no top-up; a stronger application replaces gauge and rate, a weaker one is a no-op) · reaction log lines carry both the aura consumed and the trigger spent · the apply line's number is the aura after tax. ⚠️ gcsim trap met here: a `Durability: 25` can be ×1.5 through its ICD group (Nahida's Tri-Karma), so read the data's curator notes before "correcting" a unit.
- **Code-pass traps recorded in the sheets:** the heatmap axis labels are SVG `<text>` with no `text-transform`, so sentence-casing them must ADD `text-transform: uppercase` or the axis visibly changes (and since 2026-10-01 they are placed by measured all-caps ink, `AXIS_INK` in `crit.ts`, so casing moves geometry, as non-Latin locales will) · "Vs pinned" changes MATH, not words: `pinnedDelta` goes from `my − pinned` to `my / pinned − 1`, shown as a signed percentage · × is a PREFIX with two decimals (`×1.72`) · the colon moves to ONE shared `{label}: {value}` locale pattern, ⛔ never CSS `::after` · line numbers drift with every merge, so the code pass locates strings by TEXT.
- **↻ 2026-10-01 the working shape changed (⚓ Nate).** The branch merged into `main` (`06752e3e`; pushed with `85c6b01c`). The round now runs surface by surface, hands-on: Claude reworks an instrument or page (mechanics, layout and copy) and Nate reviews it live. The worksheets stopped being review documents and became the source of a translation LEDGER. Rulings that generalize go into the style guide the same day (§1.8 "would" for a reading of the reader's settings; §1.9 say only what the screen doesn't). The ruled but unapplied sheets (Crit 01, ICD 02, Gauge 03) are the starting point when those instruments get their pass. Pass 2 (help chapters, static pages) shipped with the static-pages rewrite, merged `a8ca42ac` (2026-10-19).
- **The ledger** (2026-10-01, `feat/translation-ledger`, `1228f468`; ⚓ Nate approved the extractor as a permanent script): `scripts/extract-strings.mjs` writes `docs/text/ledger/inventory/` (1,572 messages, 27 surfaces) and the termbase `docs/text/ledger/terms.json`, which marks protected terms WITHOUT touching strings. Four classes: frozen 🔒 (English everywhere) · game 🎮 (the game's own translation, never ours) · label 🏷 · house 📖 (translated once). ⚠️ This splits R2: stat, element and reaction names are `game`, not frozen. ⚠️ The extractor cannot see data printed raw (`{#each WEAPONS as w}{w}`); it lists those as "Rendered from data" (16 sites), and a locale needs a lookup there. Details: `docs/text/ledger-plan.md`.
- **Termbase rulings (⚓ Nate, 2026-10-01, applied `5bfd4180`):** CD = CRIT DMG only; cooldown is always spelled out · "Saved rotations" (sentence case, one name) · element and reaction names translate as the game's word (the Frozen/Overloaded lock is against Freeze/Overload, not against translation) · Radiance: the game's states are "Radiance: Stellar …", and "Stellar Radiance" is coined. Damage Anatomy was renamed **Damage Breakdown** (`4cb391a6`: id, files, help anchor, the `.bd-` class prefix and the ledger surface `vz_breakdown`); "Damage Anatomy" is a termbase avoid form.

### Reversals: said in this round, then withdrawn

⛔ Don't re-derive any of these from an older note, §5 and §6 above included.

- "`Interruption Res` should be `Interruption RES`" (§6's table) is WRONG. Interruption resistance is the poise/stagger stat, not the frozen damage `RES`, and uppercasing it asserts a false equation (⚓ Nate caught this).
- §6's "worth protecting" list is partly withdrawn: "reports are how problems get found" is the headline case of explaining the obvious, and "the bars speak for themselves" / "Odds only — no verdicts" are creed plus explaining the obvious.
- "Fix `behavior` → `behaviour`" and "`modeled` → `modelled`": those were the only US-correct spellings on the site (withdrawn by R6).
- "The em dash is the biggest translation friction" was overstated. The character is fine; DENSITY is the issue, and the ~25 assembled strings are the real cost. ⛔ Keep the em dashes: they build the style guide's §1.2 move, they are informal (a colon is the formal option), and they are Nate's own voice.
- R7's "we, never I" was refined on 2026-10-18: "I" for the personal, "we" for modelling decisions (style guide §1.4).

### Facts worth not re-measuring

- Dashes are already correct site-wide (112 `—`, 4 `–`, no misused hyphens); nothing to convert. ⛔ HTML entities are dated, and an entity inside a string survives into the locale files; `&nbsp;` is the exception, because the character is invisible in source.
- The first extractor missed `description:` keys, so `seo.ts`'s 14 descriptions were in no sheet (they went to pass 2).
- The aura lane's two halves are named (⚓ Nate, 2026-09-22): **the gauge lines** above the baseline, **the reaction spawns** below it. Rejected: "field effects row" (it would name the row after the Polestar Field's buffs and Bennett's field, both drawn elsewhere, and "field" already means on-field/off-field) · "the standing row" (only two of the four stand; cores and thunderclouds hover, so no position metaphor can name the set) · "remnants" (it says only that they are left over).
- Claude's memory note on the tool constitutions (written 2026-07-27) is stale and partly false: its "will never simulate" lists include aura gauge units, aura priority and ICD bookkeeping, all shipped in gauge rounds L3–L6. ⚓ That is the strongest evidence for Nate's point: a "never" list does not just make the copy legalistic, it becomes factually wrong about its own project and keeps being read as if it were true.
