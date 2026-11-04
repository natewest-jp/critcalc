# The stage, round 7: ICD timeline (2026-11-04)

**Status:** built on `feat/viz-stage-icd`, waiting for Nate's look. The copy (§5) and Help (§6)
are proposals: the copy is written in so it can be judged in place, and Help is unchanged.

## 1. The headline

⚓ Nate, at the start of the round (design §6), chose **the share of hits that apply** out of
three: the share, the applications per window ("2 every 2.5s", now a label on each band), and
the old Readout's "4 of 12 hits apply", which mostly followed the Hits slider.

An even string's timer windows each hold the same hits at the same offsets, so the first
window's pattern repeats for good, and the headline is that window: "2 of every 5" at 0.5s
under Standard ICD (T··C·), "2 of every 4" at 0.7s, "1 of every 3" at 1s, "Every hit" from
2.5s. The count is the window's own and is never reduced, because "1 of every 2" would
misdescribe T··C. An example is a whole hit list, so its share is the list's: Oz 3 of 10,
Hu Tao all 9, Chevreuse 2 of 8, Layla 2 of 8. `icdTimeline.ts` `evenShare`, tested beside it.

## 2. What changed

The rail (the chart with its key, the Attack string and ICD rule panels, the paper Readout)
is one stage box.

- **The setup bar:** String ("Even spacing" or the example), opening a list with each
  string's note; ICD ("Standard", "No ICD", "Its own", "Custom"), opening the rule's chips,
  its line in words, and Custom's three sliders, with the Internal Cooldown definition at
  the top.
- **The chart tools** at the far end: the element (its icon and name, opening the seven
  swatches) and Send to gauge explorer.
- **Three lanes on one time axis** (design §8): the hits, the counter, the timer windows,
  each named in the left margin, the names' tooltips explaining how to read them. The key is
  gone. The time axis moved to the bottom, over the handle. Each whole timer window says how
  many hits it applied ("2 applied", or "2" where narrow); a window cut off by the axis's
  end says nothing. The counter lane no longer writes a dash under every hit where no
  counter runs (No ICD, first hit only): a dash means the window's limit only.
- **The hit interval is a handle on the time axis**, typeable, its track running 0.1s to 3s
  on the axis's own scale, so the thumb is on hit 2. The three anchors (~0.5s normal attacks,
  ~1s summon ticks, ~2s slow summon ticks) sit at the handle's row end, wrapping under it on
  a narrow tile. An example has no handle; its note is the fine print.
- **The pointed hit's reading** is one paragraph under the handle in two reserved lines,
  so pointing moves nothing.
- The lanes, toolbar, handle and reading are one group that centres in the room under the
  headline once the stalks stop growing (STALK_GROW, unchanged at 2).

### Where the build left the plan

The plan said the hit interval would be a handle on the time axis, the axis frozen during a
drag and refitting after. Built that way it fails: the axis ran to the string's end (hits ×
interval), so hit 2 always refit to the same 1/n of the width, and the track (0.1–3s) shrank
to an eighth of the chart at 2s × 12 hits. So an even string's axis is now **set by the
rule**: three timer windows (7.5s under Standard), at least 6s and at most 20s
(`evenSpan`). The axis never moves under the thumb, dragging slides every hit, and the
string fills the axis. **The Hits control is gone**: once the headline stopped depending on
it, it only set the zoom. An older link's `hits` is ignored; the share state stays `v: 1`.

At 0.1s the axis holds 75 hits. Below 11px between hits (🎛️ `DIGIT_ROOM`, a phone at
0.1s) the counter lane writes only the applying hits' numbers.

Driven on the production build at 1600×1000, 1400×900 and 390×844: the headline at 0.1,
0.5, 0.7, 1 and 3s and on the three examples it was checked against, a pointed reading,
the Custom popover; no page errors.

## 3. For Nate's eye

1. The night between the headline and the chart: the group centres in the stage. The other
   way is the toolbar right under the headline and the night below.
2. The anchors at the handle row's end, at chip size beside the handle's field.
3. "2 applied" inside the timer bands.
4. The lanes' names, dim, in the left margin.
5. On a phone the toolbar wraps to two rows, the tools on the second.
6. The axis fixed at three windows: 7.5s under Standard, 6s with No ICD.

## 4. Tests

- `icdTimeline.test.ts` (new): the share at five intervals under Standard, with No ICD, at the
  window limit, with the counter off, and that the share holds over a long string; the axis's
  span and its hits.
- `e2e/viz-workspace.spec.ts`: the handoff test counted the applying hits from the headline;
  it counts them on the chart now.

## 5. Copy (written in, proposed)

1. Headlines: "{a} of every {n}" / "hits apply their element"; "Every hit" / "applies its
   element"; on an example "{a} of {n}" or "All {n}" / "hits apply their element".
2. The setup bar: "String", "ICD". The ICD values are the old chips ("Standard", "No ICD",
   "Its own", "Custom").
3. The String list: "Even spacing", "Hits at the interval you set under the chart."; the
   examples keep their names and notes.
4. The lanes: "Hits", "Counter", "Timer". Their tooltips: "A tall stem with the element’s
   icon applies its element. A short, faint one is blocked by ICD."; "The hit counter. A
   ringed number is a hit the counter let through." (and, under a window limit, "A dash: the
   window’s limit is reached."); "Each band is a timer window, started by a hit that applies
   once the timer has run out. Its number is how many hits it applied."
5. The bands: "{n} applied".
6. The reading: "Hit 5 · 7.95s **applies**. {why}", the old reading's two lines run as one
   paragraph; the hint and the reasons are unchanged.

## 6. Help (proposed, not landed)

`src/lib/help/chapters/Visualizers.svelte` § ICD timeline:

1. "Which hits in a string actually apply their element. The headline is the share that do:
   for evenly spaced hits, the pattern that repeats in every timer window ("2 of every 5"),
   and for an example, its whole list. The chart has three lanes on one time axis. In
   **Hits**, a tall stem in the element’s color applies and a short, faint tick is blocked.
   **Counter** is the hit counter, ringed where the counter let a hit through. **Timer**
   shows the timer windows, each with how many hits it applied. Point at a hit to read why
   it did or didn’t apply."
2. "Under **String**, pick evenly spaced hits, whose interval is the handle under the chart,
   or one of four real examples taken from gcsim: Fischl’s Oz, Hu Tao’s charged attacks,
   Chevreuse’s burst, and Layla’s Shooting Stars. Under **ICD**, the rules are
   **Standard**, **No ICD**, the example’s own, or **Custom**."

Gates: Vitest 2776, svelte-check, lint and build clean; Chrome e2e 72 passed.

The copy ledger's note for this surface is `docs/text/ledger/notes/vz_icd.md`; it still
describes the rail (the key, the two panels, the Readout).
