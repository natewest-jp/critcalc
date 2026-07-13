# Internationalization Plan

**Status:** Not started
**Scope:** Add multi-language support to critcalc
**Target locales:** English (default), Spanish, French, Russian, Chinese, Japanese, Korean

---

## Summary

Feasible, and cheaper than it looks — the hard part (correct translations for
game terms) is already solved by our existing data source. The real cost is in
fonts, layout, and community jargon, not in translation itself.

---

## 1. Game terms come free from genshin-db

genshin-db ships every string in all in-game locales. Supported `resultLanguage`
values include `ChineseSimplified`, `ChineseTraditional`, `English`, `French`,
`German`, `Indonesian`, `Japanese`, `Korean`, `Portuguese`, `Russian`,
`Spanish`, `Thai`, `Vietnamese` — a superset of our seven.

Pass `resultLanguage` per query and get back the **official HoYo localization**
for character names, talent names, weapons, artifact sets, stat labels, and
ability descriptions. No LLM translation, no hand-maintained lookup table.

### Two constraints

- **No cross-language querying.** You cannot query `'Amber'` and get Japanese
  back. Internal canonical keys must be language-independent — use genshin-db's
  `filename` / id, **not** the English display name. If anything in the codebase
  currently keys records by English name, that's the first refactor.
- **Bundle size.** The full genshin-db webpack dist is 15MB+. The build supports
  restricting to a space-separated language list. Prefer a **build-time step that
  emits one JSON per locale**, lazy-loaded at runtime, over shipping the library
  client-side.

---

## 2. String tiers

Bucketing the strings is the whole planning exercise.

### Tier A — Game data

Character names, talents, weapons, artifacts, stats.
→ **Free from genshin-db. Ignore.**

### Tier B — UI chrome

"Add character", "Reset", "Copy link", error toasts, tooltips.
Estimated **150–300 strings**.
→ **LLM translation is fine, with light review.**

### Tier C — Theorycrafting jargon

KQM notation, "crit ratio", "buff uptime", "snapshot", "ICD", "hitlag",
"reaction DMG bonus".

This is the real work, and it is **not a translation problem — it's an
ethnography problem**. These are community terms, not game terms. There is no
official localization, and communities have diverged: the CN theorycrafting
scene has its own vocabulary and its own frameworks (largely independent of
KQM), while much of the ES/FR/RU/JP/KR community discourse uses the English
terms untranslated. Dictionary-translating "snapshot" into Russian makes it
*less* legible to a Russian theorycrafter, not more.

**Recommendation:** default to keeping the English term as the label, and
localize the *explanation* (tooltip / help text) instead. Keep the strings
extractable so native-speaker users can correct them. This converts an
impossible research task into a community contribution surface.

---

## 3. Implementation

### Library

Use **Paraglide** (`@inlang/paraglide-js`).

- Compiles messages into tree-shakable functions
- Fully typed
- Works with static / prerendered output
- SvelteKit integration handles locale routing

Rejected: `svelte-i18n` (runtime store, ships all messages, awkward with SSR) —
poor fit for a data-heavy static app.

### Locale routing vs. `?r=` state

Keep these **strictly orthogonal**. Locale lives in the path (`/ja/...`) or a
persisted preference — **never inside `?r=`**.

A shared rotation link must render identically for a Spanish and a Korean
viewer: same build, same numbers, different chrome.

---

## 4. Gotchas — this is where the time actually goes

### 4.1 Fonts (biggest risk)

**Current stack** (`src/app.css` `--font-*`): **Bitter Variable** (branding +
display) + **Commit Mono** (body *and* mono/data). Commit Mono and Bitter cover
Latin/Cyrillic/Greek but nothing CJK, and Commit Mono is monospace throughout —
including body prose.

**Ultimate plan — the i18n type foundation, done as a pre-i18n step while the UI
is still English-only:**

- **Bitter** — branding + display (unchanged)
- **IBM Plex Sans** — body prose (replaces Commit Mono; monospace → proportional)
- **IBM Plex Mono** — mono + all dense data tables (replaces Commit Mono)

IBM Plex is chosen precisely because it is an *extensible superfamily*: the core
covers Latin/Cyrillic/Greek, and dedicated **IBM Plex Sans JP / KR / SC / TC**
(plus Thai, Devanagari, Arabic, Hebrew) let us add every target locale without
changing the type system. Doing the swap first, English-only, de-risks i18n:
re-tune once against one metric set now, then drop in per-locale Plex variants
later.

Two things make the swap a visual-acceptance step, not a find/replace:

- **Body voice changes site-wide** (monospace → proportional sans). Deliberate —
  a readable proportional body also directly serves the legibility/usability pass
  and absorbs the ~20–30% length growth of RU/FR/ES better than a monospace body.
- **Dense numeric tables must be re-tuned** against Plex Mono's metrics. Commit
  Mono bakes `ss05`/`calt` kerning that will not carry over (see the `app.css`
  comment); the planner Gantt, crit-viz instruments, and Team Builder glyphs are
  tuned to its advance width.

**Still required for CJK locales, after the Plex swap:**

- Add **IBM Plex Sans JP / SC / KR / TC** as **per-locale fallbacks**, loaded
  only for those locales
- CJK font files are enormous — **subsetting or `unicode-range` splitting is
  mandatory**
- Monospace CJK does **not** align with Plex Mono's metrics. The dense numeric
  tables need per-locale visual testing.

### 4.2 String length

- Russian / French / Spanish run **~20–30% longer** than English
- In a dense, tight-label interface this is what breaks: truncated buttons,
  wrapped table headers, overflowing tooltips
- CJK goes the other way — shorter, but different line-breaking rules

### 4.3 Number formatting

`Intl.NumberFormat` everywhere. French uses a comma decimal separator; a crit
ratio rendered as `1,95` vs `1.95` matters in a calculator.

---

## 5. Execution plan (Claude Code)

Phased. Each phase = a separate session with a verifiable artifact.

- [ ] **1. Audit pass**
  Inventory every user-facing string; classify each as Tier A / B / C.
  Output: a markdown table for human review.
  *Do not skip — this is where we decide what NOT to translate.*

- [ ] **2. Refactor pass**
  Move game data to language-independent canonical keys.
  Add the genshin-db per-locale build step.
  *Mechanical; good Claude Code task.*

- [ ] **3. Extraction pass**
  Wire in Paraglide. Replace hardcoded Tier B/C strings with message references.
  Generate English `en.json`.
  Add an ESLint rule banning literal strings in markup so regressions can't
  sneak back in.

- [ ] **4. Layout hardening**
  *Before any real translation.* Generate a pseudo-locale (English padded ~35%
  longer, plus accents) and fix everything that breaks.
  Finds ~90% of layout bugs at zero translation cost.

- [ ] **5. Translation pass**
  Fill the six locale files. Explicit instruction: **leave Tier C terms in
  English** unless there is a well-established community equivalent.

- [ ] **6. Review & community loop**
  Japanese is self-verifiable. Ship the rest marked as community-editable, with
  a link to the locale JSON on GitHub. Genshin players are notoriously willing
  to fix this.

### Rough budget

| Phase | Cost |
|---|---|
| 1–4 | ~a weekend of Claude Code sessions |
| 5 | ~1 hour |
| 6 | Ongoing |

Fonts (4.1) and dense-table layout (4.2) are where time will actually be lost.

---

## Open questions

- Which Chinese — Simplified only, or both Simplified and Traditional?
  (genshin-db supports both at no extra cost beyond bundle size.)
- Does the Tier C term list need to be enumerated up front, or discovered during
  the audit pass?
