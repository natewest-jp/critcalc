# The stage: the pre-push layout sweep (2026-11-04)

**Status:** on `polish/viz-stage-sweep`, not merged. The fixes are built; Nate's eye is still
to come, and the What's new entry is proposed, not landed.

## 1. Why

Before the Visualizers overhaul is pushed, one pass over every instrument at every layout,
phones especially, to fix what's small and raise what isn't. This is not the phone-usability
pass that `viz-stage-tidy-2026-11-03.md` deferred (`docs/todo.md` § On hold). That pass
questions the layout; this one checks that the layout holds.

## 2. How

On the production build, all eight instruments at 360×740, 390×844 and 430×932 (touch),
844×390 (a landscape phone), 768×1024 and 1024×768 (touch), 1280×800 and 1440×900, then two up
at 1440×900 and three up at 2560×1440. Each load was checked for page errors and console
errors, for anything outside its tile that no scroller clips, for clipped text, and for
overlapping text, and was screenshotted. The phones were read by eye.

## 3. What it found, and what changed

- **Enemy RES & DEF drew a rect at width −50** once its tile was hidden (switching to another
  instrument): a hidden tile measures 0 wide, and its geometry was the one of the eight with
  no floor. It now floors the width at its narrowest plot (290px), below any real width.
- **Reaction curves' dot labels ran off the plot on a phone.** They were only ever pushed down,
  so on a short plot the stack reached "what the next 100 EM adds". A second pass pushes the
  stack back up from the plot's floor.
- **Artifact odds' Outbreak label sat on the Domain curve on a phone.** It didn't fit left of
  the marker, and right of it the Domain curve rises through it. It now sits under the
  Domain's dot, where a rising curve leaves space.

## 4. Seen and left

- ⏭ For Nate: two touch targets under 24px tall, Enemy RES & DEF's common RES chips (10% …
  Immune, 23px) and the Gauge explorer's Unpin (26×22). The `pointer: coarse` hit-box growth in
  `app.css` is an opt-in list, and neither is on it. Joining it grows the box 10px above and
  below, over the RES field above the chips, and that list's own comment holds such cases for
  Nate's eye.
- At 360px, Enemy RES & DEF's element tabs wrap Physical to a second row. The design lets the
  toolbar wrap.
- On a landscape phone every instrument scrolls inside its tile below the toolbar, as the
  design allows.
- Where Reaction curves' labels go right of the marker (a phone, low EM) they cross the other
  curves. That is the instrument's designed fallback.

## 5. Checks

Vitest 2796, svelte-check, lint and build clean; Chrome e2e 72 passed. After the fixes, the sweep finds no errors,
overflow or clipping at any of the viewports, or two or three up.
