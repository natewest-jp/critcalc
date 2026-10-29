# Full-screen surface round (2026-10-25)

Branch `polish/fullscreen-surface`, behind `?next`. The first refinement pass
over the menu state (`MenuState.svelte`, `LibraryPlace.svelte`,
`TeamsPlace.svelte`). Agreed shape: memory `project_fullscreen_refine_round`.

## Rulings

- 🐛 **Slate has a hover rung.** `--surface-hover` was defined only in
  `.ctx-glass`, so on slate every `var(--surface-hover)` painted nothing: a
  hovered card dropped to its ground. `.ctx-dark` now has `--slate-600`. A
  verb hovered on a hovered card goes one rung DOWN (`--surface-raised`).
- **Sidebar.** Line marks per item (six new Lucide marks; Lineups is
  `LayoutGridCircles`, which moved the generator's `lucide` devDependency
  1.30 → 1.61, every existing mark byte-identical). Base UI type: 16px
  items, 18px marks, 11px headers, 17rem wide. The account is a SWITCHER
  row that expands in place. Counts on Rotations and Lineups. Help and About
  fold to one item each: the heading IS its first chapter's page (Help &
  FAQ, About) and stays selected there; the rest list beneath while inside.
  Settings at the foot.
- **The index never shows on desktop** — it displays the tool's Library
  place (or Rotations), the history entry left alone.
- **Edges.** The surface stands on the site gutter: item boxes on the logo's
  line, the content's far edge and the ✕ where a tool's end. The ✕ is
  pinned to the content area's top right; on a phone it goes and "‹ Menu"
  is the way back.
- **The phone index** leads with three tool tiles wearing the landing's
  figures, cropped to their rings.
- **Library.** No 60rem cap: a collection fills the width. Rotations are
  ROWS (the notation's opening fills the middle, gone under 40rem of
  Library); lineups are cards. Every portrait is the SIDE portrait, four to
  a team, the blank side portrait in an empty seat. PINS ARE A SHELF of
  cards across the top (a column aside was tried first and put the
  most-used ones out of the way). A same-account COMPARE PAIR is one entry:
  A the row, B beneath with A/B tags. Verbs show on hover or KEYBOARD focus
  (`:has(:focus-visible)` — `:focus-within` let a clicked Pin hold them up),
  a ⋯ on touch (`hover: none`), and the current ring is a pseudo-element
  painted over them. Teams cards follow the same verbs.
- **Reading.** Chapters at 68ch (~75 characters, was 56ch) beside a 16–28rem
  MARGIN for Help's screenshots and About's notes, folding away under ~56rem
  of content width (a container query). The margin holds a DEV-ONLY slate
  mock; a build strips it.

## Open

- The margin's real content (screenshots, notes) and its anchoring to a
  paragraph (a float into the margin, decided by the chapter's markup).
- Long chapters' headings in the sidebar under the chapter.
- Each surface (Roster, Teams, Settings, Profile) wants its own pass.

Gates: vitest 2606, check, lint, build; full e2e chrome + webkit 160 passed.
