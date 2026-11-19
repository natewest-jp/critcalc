# Ledger refresh — 2026-11-19

Round 1 of the translation item in `docs/todo.md`: bring the translation ledger
(`docs/text/ledger-plan.md`) up to date with the profiles layout before any locale work.
Branch `docs/ledger-refresh`.

## What changed

- **Surfaces.** `scripts/extract-strings.mjs` had 39 files with strings that matched no
  surface (465 messages), all from the profiles layout. They now sit in eight new surfaces
  and four existing ones:
  - new: `menu` (the menu state), `keys` (the keyboard shortcuts sheet), `notices` (toasts,
    banners, the links and layout-change dialogs, the copy toasts in `documentBar`, and
    the storage session's messages), `library`, `teams`, `trash`, `profile`, `changelog`;
  - existing: `chrome` takes the top bar, `errors` takes `RenderCrash`, `bench` takes the
    compare control, `planner` takes the inspector, `settings` takes the backup restore
    errors, and `tb` takes the character inspector, the filter strip and More filters
    (shared by the Roster and Teams), `theater.ts` and the twin labels.
  - `docbar` is gone: every file it named was deleted with the old layout. Dead patterns for
    deleted files were removed from the other surfaces too.
- **Two extractor fixes.**
  - The orphan check read only the first key of a heading that names several
    (`` `a` · `b` ``), so two orphans hid behind a live first key. It now checks each.
  - A BEM class list passed to a snippet (`editInRoster('btn btn--sm')`) was read as text.
- **Orphaned notes.** All 35, in the five Visualizer notes files, were orphaned by the
  instrument rewrites. Where the string was rewritten, the note moved to the new key and was
  updated to the current text. Where the string is gone, the note was dropped, after moving
  any ruling that still binds:
  - Artifact Odds' "days, never runs" ruling joins the resin note;
  - the ICD window definition and "per window, never per second" join `Limit per window`;
  - Nate's "every piece like it" scope note now sits on the "Better than N%" line.
  - Dropped as superseded: Artifact Odds' "N in 100" frequency (chances now print as
    percentages through `chance.ts`), the Gauge Explorer's aura-log lines (the log is gone),
    and its "No aura" teaching sentence (now a figure and a sentence of its own).
  - Several assembled fragments the old notes warned about are now whole sentences
    (the DEF/RES row tooltips), so those warnings went with them.

## Measured

2,695 messages across 35 surfaces, none unassigned, no orphaned notes. Termbase: 181 terms
and 29 avoided forms; 1,092 messages carry a term. Flags: 29 assembled, 63 plural-shaped.

## Left for the pilot

The new surfaces have no notes yet; notes are written at each surface's pass. Their flags
are the first translation defects to fix in code, chiefly: "Couldn't copy {what}" filled
with "the link" / "the notation" (`documentBar`), "Your {x}" in the top bar, "Move to {x}"
with "a profile", "No {rotations or lineups} for this team yet", and the hand-made plurals
(`character{s}`, `{n} days ago`, `+{n} more teams`).
