# Roster surface round (2026-10-26)

Branch `polish/roster-surface`, behind `?next`. The full-screen surface's
per-surface pass for the **Roster**, after Teams, Settings and Profile. Worked
hands-on with Nate, one look per step.

## Rulings (agreed before the build)

- The filters are the STRIP (Teams' details, the Builder): users meet one
  filter on every surface, and the bulk actions act on what is SHOWN, so what
  decides that sits with them.
- THE LOCK STAYS, and with it the tile's two faces (a C-badge when locked, the
  astroids when editing). An arc of constellation segments round the portrait
  and a badge that swaps to astroids on hover were both weighed and declined.
  The tile and astroid LAYOUT is still open to a visual pass.
- WISHLIST STAYS, but only on characters you don't own: a mark that can't
  exist on an owned tile can never un-own one (the streamer took the star for
  a favourite, and every click faded the character). Its glyph becomes
  Lucide's Sparkles, the picture Genshin uses for its wish screen.

## Steps

1. ✅ The strip replaces the filter column (search · roles · elements · Show
   ✓ ✕ ☆ · More · Sort · count · Clear); the phone sheet is gone.
2. Wishlist: Sparkles, unowned tiles only (the Roster and the details card).
3. Tidy the page's TOP: the lock now stands alone on a row above the strip,
   and "Click 'Edit roster' to begin editing." reads as the search field's
   help. Candidates: the lock, undo/redo and a "Mark shown…" menu up in the
   page head's row.
4. The bar: one "Mark shown…" menu (`BandMenu`), bulk feedback through the
   shared notices with an Undo button, the keys legend on keyboard focus only.
5. Counts, if wanted (bar, sidebar item, or neither).
6. Tiles and astroids: a visual pass on the layout.
7. Phone pass.
8. Copy, as a numbered list.

## Found on the way

- The strip's scroller tucks under it by a negative margin, and coming later
  in the DOM it swallowed the strip's lower 0.9rem: the bottom half of every
  control was dead. Teams' details share the layout and got the same fix
  (the strip stacks above, `position: relative; z-index: 1`); Teams was fixed
  by geometry, not re-measured (its details need a profile).
