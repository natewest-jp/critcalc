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
2. ✅ Wishlist: Sparkles, unowned tiles only (the Roster and the details card).
3. ✅ The page's TOP: the bar's controls are ONE group in the menu state's
   page head, on the ✕'s line (`menu.headActions`, a snippet slot a section
   fills while mounted; the old layout renders the same group in its own
   row). The locked hint ("Click 'Edit roster'…") is gone: a locked tile
   nudges the lock, which now sits where the eye starts.
4. The bar: ✅ one "Mark all / Mark shown" menu (`BandMenu`: Owned, Owned at
   C6, Not owned); ✅ bulk feedback is a toast whose Undo takes back THAT
   action's characters only (a later edit to anyone else survives, and ⌘Z
   can redo it). ✅ The keys legend shows only while a tile has KEYBOARD
   focus, FLOATING over the grid's bottom roll-off (a row that came and went
   would shove the grid down at the first arrow); `scroll-padding` keeps a
   focused tile clear of it.
5. Counts, if wanted (bar, sidebar item, or neither).
6. Tiles and astroids: ✅ a star with POINTS fills with no stroke
   (`Mark filled="solid"`: the stroke's round joins blunted every tip; lines
   and circles keep their stroke) for the wish mark and the lit astroids. ✅
   The keys bar is a size larger throughout. ⛔ Grouping the astroids was
   tried (two threes, then three pairs for C2/C4/C6) and DECLINED (⚓ Nate):
   at a gap this small even spacing reads better, and a wider gap would cost
   the astroids size, which they cannot spare.
7. Phone pass.
8. Copy, as a numbered list.

## Found on the way

- The grid's scroller tucked UNDER the strip by a -0.9rem margin (Teams'
  details' layout). Later in the DOM, it swallowed the strip's lower half
  (every control's bottom took no clicks); stacked beneath the strip (the
  first fix), scrolled tiles showed through behind it (Nate). Both surfaces
  now start the scroller at the strip's edge, so the roll-off begins there,
  and the top padding went 0.9rem → 0.5rem (it had been clearing the
  overlap). Teams was fixed by geometry, not re-measured (its details need
  a profile).
