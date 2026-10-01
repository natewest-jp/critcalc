# The translation ledger — plan (approved 2026-10-01; step 1 built 2026-10-01)

⚓ **Nate approved this, including a PERMANENT extractor script** (a promotion under
CLAUDE.md's verification policy — the approval is the 2026-10-01 session). It is
fresh-context work; this file is the starting point.

## Why

The 18 worksheets in `docs/text/sheets/` were written as review documents for Nate. The
text round now runs as hands-on surface passes (`docs/instrument-passes-2026-10-01.md`
§0), so the sheets no longer need to be readable by him. What survives is a ledger for
**Claude and for translation**: every user-facing string, where it renders, what fills
it, and what a translator must know. ⚠️ The sheets proved that a hand-maintained
inventory DRIFTS — their line numbers went stale with every merge (checked 2026-10-01:
content still matched, positions did not). So the inventory is GENERATED; only the notes
are hand-written.

## Shape

Two layers per surface:

1. **Generated inventory** — produced by the extractor from the code. Per string: the
   text, file + line (a hint, regenerated each run), the element/attribute it renders in
   (text, `title`, `aria-label`, `placeholder`, object-literal field…), the interpolated
   variables, and flags the code can see: ASSEMBLED (concatenation / adjacent fragments),
   a plural-shaped number, an HTML entity, a bare `x` used as multiplication.
2. **Hand-written notes** — one short file per surface, keyed by string, for what code
   can't say: translator context (style guide §3.5), length budget (§3.6), frozen terms
   (glossary 🔒 / 🏷), rulings specific to the surface. Carried over from the sheets'
   useful notes, ⛔ not their review chatter.

The end product feeds Paraglide's English source (`docs/i18n-plan.md` §3 picks Paraglide, §5 generates `en.json`), so
keys should be the ones extraction will use.

## The extractor

⚓ The method already exists in outline — the 2026-09-27 re-extraction
(`docs/text/sheets/README.md` § "the re-extraction"): **Svelte's own `parse()` walked
generically** for templates and scripts, **the TypeScript compiler** for `.ts`, which found
~370 fragments the regex pass missed. That code was a one-off and is gone; rebuild it as a
script in `scripts/` (the extractor IS the approved permanent tool; ⛔ don't add a probe
beside it). ⚠️ Known limits to state in its output: single words can't be verified by
substring; strings built at runtime from data (character names, caveats) are out of scope
(caveats have their own guide and are translated, not rewritten — round record R1).

Scope: everything user-facing under `src/` — tools, chrome, help chapters, static pages,
`seo.ts` (its `description:` keys were missed by the first extractor), error pages.

## Order of work

1. Build the extractor; run it; compare its count with the sheets' ~570 + 370.
2. Write the per-surface notes, seeding them from the sheets' notes and the rulings in
   `style-guide.md` / `glossary.md`. Include the strings from the Reaction Curves and
   Damage Anatomy passes (never in any sheet).
3. Mark the worksheets superseded (keep them in git history; ⛔ don't delete rulings that
   only live there — move them into the notes first).

---

## ✅ Step 1 — built 2026-10-01 (branch `feat/translation-ledger`)

`node scripts/extract-strings.mjs` prints a summary; `--write` regenerates
`docs/text/ledger/inventory/` (one file per surface + a README); `--surface=<id>` prints
one surface. ⛔ The inventory is never edited by hand, and it is in `.prettierignore`
because prettier would escape the `*` and `_` inside the quoted strings.

- **One AST for everything.** Svelte's `parse()`; a `.ts` file is parsed as the body of a
  `<script lang="ts">`. ⚠️ acorn + `@sveltejs/acorn-typescript` on its own refuses most
  of our `.ts` (an acorn version mismatch), which is why the TS compiler is not needed.
- **A template message is a RUN**: adjacent text, `{expressions}` and inline elements form
  one message, because that is the unit a translator reorders. A run with no text of its
  own is layout (`<span><span>Title</span><span>Hint</span></span>`) and splits.
- **Keys** are `<surface>_<slug>`, identifier-safe for Paraglide; a 4-hex text hash is
  added only when two texts on one surface share a slug. Identical text on one surface is
  one message with several locations.
- **Surfaces** are a first-match path table in the script. A file that yields strings and
  matches nothing is reported UNASSIGNED; that is the alarm for a new file.
- **Flags:** `off-glossary` · `assembled` · `plural?` · `x-for-×` · `entity` · `nbsp` ·
  `thrown`.

**Measured on the first run: 1,572 messages, 27 surfaces.** Checked against the
worksheets' "Now" column (787 fragments, excluding sheets 04 and 07, whose surfaces were
reworked): every miss was explained. Most were strings since removed from the code, or
quote and apostrophe differences between the sheets and the code. ⚠️ Two are genuinely
out of reach, both **assembled at runtime from code words**, and they are translation
defects to fix in code, not extractor gaps:

- `orderHint()` in `playback/tones.ts` spells "Burst low · skill middle · attacks high"
  from the words `attacks`/`skill`/`burst` + `low`/`middle`/`high`, capitalising the first
  at runtime. No locale can reorder or inflect that.
- The same file's note-set hint ("A · B · E") is built from note names.

⚠️ **Known limits:** a lone lowercase word in a script is kept only when its context names
a text field, or it sits in a map whose other values are prose (a "text table") ·
strings built from DATA (character/ability names, caveats) are out of scope · `/lab` and
`/styleguide` are excluded.

## ⚓ The termbase — `docs/text/ledger/terms.json` (added 2026-10-01, ⚓ Nate asked)

Protected terms are marked **beside** the strings, never inside them: the extractor tags
every message with the terms it contains (longest match first, so `Electro-Charged` is
not also `Electro`), and flags any form a term lists under `avoid` as **off-glossary**.
At translation time the tagged spans are what a translator, or a translating model, is
told to keep, look up, or reuse.

| Class    | Mark | Meaning                                                                                                                                 |
| -------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `frozen` | 🔒   | English in every locale: the brand, the card names, KQM, gcsim                                                                          |
| `game`   | 🎮   | The game ships an official translation. Take it from the game's text (genshin-db), ⛔ never translate it ourselves                      |
| `label`  | 🏷   | The English label stays; its explanation translates (ICD, CV, RES shred, uptime…)                                                       |
| `house`  | 📖   | Our own coined term. It DOES translate, but ONCE per locale, fixed in the termbase and reused (the bench, the composer, the aura lane…) |

⚠️⚠️ **This splits round record R2.** R2 called stat, element and reaction names "frozen",
and the glossary marks reaction names 🔒 while also saying genshin-db ships them per
locale. Those are two different rules: the brand stays English in Japanese, while Pyro
becomes the game's own Japanese word. ⚓ Nate, 2026-10-01: in-game terms take the game's
own translation and must never be translated by another method. So they are `game`, and
`frozen` is reserved for what stays English.

The seed (99 terms) is the glossary's ruled rows plus the plainly in-game names (elements,
reactions, stats, resonances, factions). ⏭ Completing it is part of step 2. Its first run
found 16 off-glossary messages, and they are the same sites the glossary lists by hand
(Overload/Freeze, Crit Rate/Crit Damage, "Event log", "resistance shred").
✅ **Nate's rulings on the open calls (2026-10-01):** element and reaction names
TRANSLATE (as the game's own words). The Frozen/Overloaded lock was always against the
community forms Freeze/Overload, which the termbase's `avoid` now enforces, never against
translation · Constellation is `game` · the field elements (Dendro Core, Starlight Prism,
Thundercloud, Moondrift, Polestar Field) are `game`, added to the seed.

## ✅ Termbase pass — 2026-10-01 (Nate: "tackle the remaining termbase work, then check in")

**165 terms + 27 avoided forms; 781 of 1,572 messages carry a term; 31 are off-glossary.**

- **`forms`** — every spelling that counts as the term. `skill` / `Skill` / `skills` are
  the game's Elemental Skill, so a translator uses the game's word for each. Matching
  runs longest form first, so `Nightsoul Burst` is not also `burst`.
- **The top-level `avoid` list** holds forms with no canonical term: US spellings (R6),
  glossary §4's fixed forms (`5★`, `datamined`) and leaked internal vocabulary
  (`Source view`). It matches in any case; a term's own `avoid` stays case-sensitive,
  because `Crit rate` in an aria label is deliberate and `Crit Rate` on screen is not.
  The British sweep matches glossary §4 (modelled ×7, modelling ×2, labelled ×2,
  cancelling ×2, neighbour ×1). The rest of the list guards against new ones.
- **Sourced from the inventory, not a wishlist:** a capitalized-phrase census of every
  message not yet covered drove the additions. Weapon types and regions are absent because
  no message contains them; they arrive with the strings that need them.
- **Dropped on purpose:** `line` and `roll` (artifact jargon) are ordinary English words
  in most messages ("Equal-budget line", "Roll {n} hits"). Tagging them would bury the
  real ones, so they belong in the Artifact Rolls notes instead.

**Nate's rulings on the five (2026-10-01), all applied:**

1. ✅ **Saved rotations**, in sentence case, one name. "Saved Rotations" and "save bank" are
   now `avoid` forms. In code: the overlay title, the tabs-full dialog (a verb before it
   lowercases it: "Open saved rotations") and the Settings row.
2. ✅ **CD means CRIT DMG only; cooldown is always spelled out.** The eight cooldown sites
   were changed (resonance ×3, the bench detail card, the buff tooltip, the planner's
   "trigger cooldown" row label in both the timeline and the PNG export, and the stat
   label, which is now `Cooldown Reduction` to match its Title Case game-stat
   neighbors). The `cooldown` term's avoid forms, plus a `pattern` entry for `5s CD`,
   catch a regression. ⚠️ "trigger cooldown" is a timeline row label and longer than
   before, so Nate should check it on screen.
3. ✅ **No conflict.** Every Damage Anatomy string says **Base DMG Bonus**, which is the
   game's own phrase; the formula bracket is named after it. It is now a `game` term, and
   no string change was needed.
4. ✅ **Blazing Axe Mitachurl**, fixed in the planner's assumptions list and the Rotation
   Planner help; `Blazing Axe Mage` is an avoid form.
5. ✅ **Radiance:** the game names three STATES, "Radiance: Stellar Glimmer / Stellar-Conduct
   / Stellar Swirl". "Stellar Radiance" is a coined community term and an avoid form.

## ✅ Rendered from data — a class the inventory cannot hold (2026-10-01)

⚓ Nate asked why weapon types and regions were missing from the strings when the Roster
filters by them. **They are printed straight from data:** `{#each WEAPONS as w}{w}` shows
the id `claymore`, uppercased by CSS, and there is no string literal anywhere. A locale
needs a LOOKUP there (id → the game's term), not a message. The extractor now lists these
sites per surface under **"Rendered from data"** (16 on the first run). Two shapes are
detected:

- a loop variable printed alone, when the loop runs over something that is not a literal
  array of prose or numbers (a file's own `const` arrays are resolved, so `AURA_NOTES`
  (sentences, already messages) is told apart from `ELEMENTS` (ids));
- an id field (`.element`, `.weapon`, `.weaponType`, `.region`) read anywhere in a
  template, e.g. the detail card's `{entry?.element} · {entry?.weapon}`.

⚠️ This is a review list, not a guarantee: an id that reaches the screen under another
field name is not caught. Weapon types and regions are now in the termbase too.
