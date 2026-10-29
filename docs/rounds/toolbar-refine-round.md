# The toolbar refinement, 2026-10-24

Hands-on with Nate, under the switch (`?next`), starting from the redesign bug sweep's §2.1 (the Planner's toolbar controls overlapped on a phone). Nate gave latitude to reimagine the toolbar and update the style guide. Everything here is behind the switch: the CSS through `:where(:root[data-next])` / `:where(:root:not([data-next]))`, which add no specificity (step 5 deletes the `:not` halves and unwraps the rest), and the markup through `$nextLayout`.

## Rulings (⚓ Nate)

- **On is a dim gold FILL, not a ring** (from the bars demo): a ring means "you are here" (hover, focus), a fill means "it is on". On a phone the last plate tapped keeps its hover ring, which read as "on". The fill is `.btn.is-active`'s recipe (accent 20% over the face), on the toolbar's plates. Hover rings only where a pointer can hover (`@media (hover: hover)`).
- **The centre has no ground**: the Total and the hand stand on the night (the bars demo's centre). ToolStack's 3-up centre zone keeps its layout job and drops its paint.
- **Sentence case for every control** (`.btn`, `.chip--control`): "verbs shout, nouns don't" was arbitrary, and the caps cost the band its width.
- **The hand TOGGLES Human timing**, always visible; setup stays in Settings. Off draws Nate's struck hand (`assets-src/tools/hand-off.svg` → the bespoke mark `handOff`, `scripts/lib/bespoke-marks.mjs`, merged by `generate-marks.mjs`), in an OPAQUE ink (`color-mix` of `--chrome` and `--frame-bg`): at alpha the mark's separate strokes overlapped and their crossings read darker.
- **No Builder inspector button**; nothing moves into the title bar yet.
- **Compare moves to the BENCH**: a comparison is a second version of this team, it fits neither bar, and the bench has room to name both sides.
  - Desktop: the bench FOOT, which grows to hold it (`footGrow`): a "Comparing ✕" head over a full-width segment naming both sides, then Save as team / In Teams. Compare comes first because Save as team comes and goes. Unpaired: a full-width "Compare ▾".
  - ⛔ Never profile pictures: beside a bench of portraits a picture reads as a character.
- **In Teams is a plate**, like Save as team (as bare text it did not read as pressable); quieter ink, so the request outranks the fact.
- **The phone bench has a RAIL** (ToolStack `benchRail`): one control-high strip ABOVE the bench row, joined to it as one slate object (the bench's own frame keeps the cards apart; the ribbon's top corners are the rail's, BenchBand `railed`; the row tucks 2px up under the rail's slack). Its chevron is always at the left end, so the toggle never moves; the bench folds into it.
  - Open: ⌃ · Save as team / In Teams · Compare (or the pair + ✕).
  - Folded: ⌄ · the four SIDE portraits, stacked (leftmost at the bottom, 1px `--line-strong` ring, disc centred) · ✓ / + · Compare.
  - While comparing, the team status shrinks to its mark so the names get the room; folded, the ⇆ mark goes too.
  - A what-if pair reads **Original | What-if** on the rail (the desk foot keeps the profile names).
  - The pull-tab on the bench's edge and the ⋯ menu's Compare items retired with it.
- **The phone toolbar**: Play · Zoom · Total + hand · Buffs · Auras · ⋯. Rewind folds into ⋯ ("Back to the start"); a non-1× speed shows on Play; ⋯ carries a gold dot while something in it is on.

## Fixed on the way

- **Flipping a comparison flashed** (~50% of flips): the session cleared the pair and re-read the partner from IndexedDB, so the foot showed the unpaired form for a frame and the ribbon shrank ~30px and regrew. The partner is in the session's records already, so `#plannerContext` settles it in the same tick; the store read only confirms.

## Open (for Nate)

1. The SEGMENTED control's chosen side still wears the gold ring (the compare pair; the Builder's All / Owned / Wishlist). The fill rule would change it site-wide.
2. Sentence case reaches every `.btn` under the switch: one look across the Builder and Visualizers for anything half-converted. Kickers stay uppercase on purpose.
3. The Builder toolbar in the same grammar is the next round; the Builder's 3-up centre also lost its rail ground under the switch, so judge it there.
4. The gap between the rail's controls and the bench frame is now the ribbon's 5px edge; thinner needs that edge shrunk only where the rail joins (the frame path reads it).
5. Hair on the tallest portraits rises over the frame toward the rail.

## Verification

vitest 2606 · check · lint · build. A width sweep, 320–1900 in 10px steps, checking every toolbar, rail and top-bar control for overlaps, controls past the edge and page overflow: 0 findings at Medium (default), Large and Small, and with a pair showing at Medium and Large. With `data-next` removed the gated styles revert (uppercase, the gold ring, the centre's ground and padding). The flip measured per frame: the foot holds through six flips in a row.

## Notes carried over from Claude's working memory (2026-10-29)

From `docs/rounds/toolbar-refine-round.md` (covers this round and `builder-toolbar-round.md`):

- **Gating a removed declaration.** To keep a declaration behind the switch, scope the OLD declaration to `:where(:root:not([data-next]))` rather than writing `none` or `normal` under the switch. Removal means inheriting or falling to another rule (`.chip--control` falls to `.chip`'s capitalize), and an explicit value is a different result from the one tested. In a Svelte component the form is `:global(:where(:root[data-next])) .x`.
- **Testing widths.** A Chrome window resize does not change the viewport in the automation used here, so widths were tested in a same-origin iframe resized by JS (media queries follow, no reload). Never run two sweeps on one iframe: a timed-out script keeps running and fights the next one.
- **Showing a paired state without touching real data.** Set `storageSession.plannerPair` in memory through the iframe's own module instance, `w.eval("import('/src/lib/storage/session.svelte.ts?t=<v>')")`, with `v` read from the transformed CompareControl source (HMR stamps the URL; without the stamp you get a second, empty instance). Theorycraft can be faked the same way in a read-only tab, `storageSession.profile = {...real, kind: 'theorycraft'}`, restored afterwards.
- The rail toggle writes `siteSettings.showBenchRow` to localStorage, which any other open tab shares: restore it after testing.
- The bench ribbon paints above the page, so tucking it under the rail can clip the rail's buttons: 3px clipped 0.3px, and 2px is the limit.
- `RAIL_FACE` (20) is still a tuning knob.
