# The translation ledger — plan (approved 2026-10-01, not started)

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
