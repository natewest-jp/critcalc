# The Planner on a phone — round record (2026-10-14)

Branch `polish/rp-mobile`. Nate drove it live on his iPhone (Safari + Chrome)
against `npm run dev -- --host`; every value below that says ⚓ was his call on
the device. The aim: make the Planner comfortable to WRITE in on a phone, not
just to read.

## 1. What shipped

**Defaults below `toolMin` (54rem)**

- Both layers (Buffs, Auras) start OFF; the zoom rests at 30 px/s
  (`ZOOM_DEFAULT_NARROW`; 60 above) and Reset zoom / the % readout measure
  against the screen's own resting zoom. Both decided ONCE at load.
- ⚠️ The layers needed the store to tell a DEFAULT from a CHOICE, which it
  could not: it merged its defaults into the saved object and wrote the whole
  thing back. The layers now persist apart as `timelineLayers`, holding only
  what was toggled; old top-level keys are dropped (Nate was the only visitor).
- Each slot is its own height (`slotHeights`): the uniform height exists only
  for the desktop bench's cards, and a row bench labels nothing vertically.
- The band stack keeps the BAND gap (4px) between band B, the bench and the
  surface, not the tool gutter.

**At every width**

- The always-on buffs strip hides with the Buffs layer (a team bonus is what an
  ability GRANTS); the Buffs tooltip names it (approved copy).
- Tooltips anchor on the bar's VISIBLE part and clamp inside the viewport.
- `text-size-adjust: 100%` — iOS inflated small text after a rotation.
- The empty notation box reads "Type a rotation in KQM notation" (approved; no
  example rotation to date the site).

**The dock (below `compact`, 40rem)** — the composer is a glass plate pinned to
the screen's foot (`--glass-dock`, tune(nate) .80; one plate, the editor drops
its own ground):

- Collapsed: one line, the END of the last notation line, painted as the editor
  paints it (tokenizer kinds + the parse's tints). One tap opens it WITH the
  keyboard — an invisible 16px input takes focus inside the tap, then hands it
  to the editor (iOS only raises the keyboard for a focus made in the gesture).
- A TAP outside collapses it (a bar included — its tooltip still opens); a DRAG
  does not. Tap = lifted within 10px; ⛔ not `click`, which iOS fires only on
  things that look clickable.
- It rides the keyboard on the visual viewport's inset, and on iOS Chrome
  (`CriOS`) carries 24px more bottom padding for the address pill Chrome draws
  over the page without telling it.
- **The key row** follows the caret: a new segment → the team's names; inside a
  segment → `>`, that character's casts (index `casts`, minus the `tE`/`pE`
  aliases — ⚓ Nate), N, C, P when the kit plunges; after an N → 1–5 first.
  Keys fire on LIFT (their pointerdown is cancelled so focus stays put, which in
  WebKit's touch path swallowed the click) and show their case (`sQ`, not the
  `.btn` uppercase).
- ⚠️ The composer is MOVED to `<body>` while docked, never re-mounted. Leaving
  the planner does not destroy the page — the pan keeps it alive and Svelte
  PAUSES its effects — so `before/afterNavigate` (plain callbacks) move it back
  and re-dock it.
- Autocomplete rows are ~44px under `pointer: coarse`.
- On iOS (and iPadOS) `maximum-scale=1`, so focusing the 13px editor no longer
  zooms the page; pinch-zoom still works there. ⛔ Not on Android, where the tag
  would kill pinch-zoom. ⛔ Nor 16px notation (Nate: it wraps too often).

**The scene**

- The camera re-poses on resize (`syncSceneCamera` from a canvas
  ResizeObserver): the crest pose is PIXELS of the viewport height, and a
  rotation kept the portrait pan, sliding the world down.
- The renderer re-sizes on its canvas's own box (the window's `resize` fires
  mid-rotation on iOS with stale numbers).
- The world takes `100lvh` (Safari's large viewport), with the renderer and the
  crest pose reading the canvas box: a pull-to-refresh moved the toolbars, the
  dynamic height changed under the canvas, and the scene stretched. ⚓ Accepted
  by Nate in both browsers on phone and desktop; the cost — with Safari's
  toolbars showing, the horizon sits a toolbar lower — is acceptable to him.

## 2. Measured

- Notation wrap, eight-segment rotation: 320px 8 → 6 lines, 390px 5 → 4.
- Slot heights at 390 with Buffs on: 136/150/150/122 against 150 ×4.
- Camera after rotation: 644 → 297 → 644px, 76.3% of vh each way.

## 3. Open

- ⏭ **The fade under the site chrome** (Nate's ask) — its own small round: the
  chrome lives INSIDE the tool scroller, so the mask goes on the content and
  rides the scroll offset; measure it in real Safari.
- ⏭ **A web app manifest** (roadmap to-do): standalone removes the browser bars
  on a home-screen install. It does not change the keyboard.
- ⏭ Untried on a device: an iPad (the zoom fix's iPadOS branch), Play on a phone.
- ⏭ Autocomplete's desktop look, for Nate's eye. The narrow round's
  `pointer: coarse` pass for band controls is still queued.
- 🗒️ A narrow e2e smoke for the dock (docks, collapses on a tap, returns to
  its page on navigation) was proposed and not yet approved.
