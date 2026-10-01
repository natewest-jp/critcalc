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
