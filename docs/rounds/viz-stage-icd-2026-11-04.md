# The stage, round 7: ICD timeline (2026-11-04)

**Status:** ✅ merged into `main` on 2026-11-04 (`feat/viz-stage-icd`). Nate: "There we go! This
is so much more tidy", then "it's looking good!". All copy approved (§5, §7, §10, §12); Help
(§6, superseded by §8 and §10) landed. Five passes after the first build: less spare (§7),
the layout (§9), the companion (§10), tints and the strip apart (§11), the strip flush (§12).
Real Safari checked by Nate, and pushed, on 2026-11-04.

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

## 5. Copy (written in, approved by Nate)

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

## 6. Help (first proposal, superseded by §8)

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

## 7. The second pass: less spare

Nate (2026-11-04), on his 2000×1000 screen: the chart took a fifth of the stage, and even a
phone had room around it. His two ideas, both built, plus two of Claude's:

1. **The controls on the surface.** ⚓ The ICD timeline has no setup bar: its rule is what
   you play with, a live control in design §3's terms, not a setting. The strings are a
   row of view tabs on the chart's top edge (Even spacing and the four examples), the seven
   element swatches and Send to gauge explorer at its far end. The rule is a section under
   the chart: ICD's presets as a segment (Standard, No ICD, the example's own, Custom),
   then Timer, Hit counter and Limit per window, always shown. A preset fills in the three;
   moving one makes the rule Custom from the preset's numbers (`editRule`). The Timer's
   track now starts at 0, "Off", which is what No ICD shows. The rule's line in words
   ("2.5s timer · every 3rd hit") went, since the sliders say it.
2. **The chart sizes up as a whole.** ⚓ Replaces "the stalks grow, and only a little"
   (2026-10-06, from the rail). Every mark and word scales by `k`, up to 🎛️ `K_MAX` 1.6,
   then the stems lengthen up to 🎛️ `STALK_GROW` 1.5 × their scaled length; past that the
   group centres. A phone's stage is its natural height, so it stays at 1.
3. **The share strip** under the time axis, on the handle's span (0.1–3s): the headline at
   every interval, a dot at yours, named "Share" in the lanes' margin. Under Standard it
   steps up through 1 of 3 and 1 of 2 to every hit at 2.5s. Below about 0.4s it wobbles
   between nearby shares (8 of 25, 7 of 22): the window limit and the counter's phase,
   really, not noise.
4. **The headline's window, bracketed** over its hits: "2 of these 5". ⚓ Nate: on trial,
   to be judged on screen. Not on an example or when every hit applies.

Driven on the production build at 2000×1006, 1400×860 and 390×844: the presets, Oz's own
rule in the sliders (5s, 4, 8), a typed 4s timer turning Standard into Custom ("3 of every
8"); no page errors. A phone's rule section ran off the edge (the grid's implicit `auto`
column took the sliders' min-content) and is fixed.

For Nate's eye: the bracket (on trial); the strip's wobble at fast intervals; the element
swatches, small and dim at the row's end; the rule section's width, capped at 60rem.

Copy (proposed): "2 of these 5" (the bracket); "Share", its tooltip "The share of hits that
apply at every hit interval, along the slider under it."; the rule section's name "ICD";
"Off" at the Timer's 0. No longer shown: "String" (the tabs say it), "Hits at the interval
you set under the chart.", and the rule's line in words.

## 8. Help (proposed, not landed)

`src/lib/help/chapters/Visualizers.svelte` § ICD timeline, §6 revised for the second pass:

1. "Which hits in a string actually apply their element. The headline is the share that do:
   for evenly spaced hits, the pattern that repeats in every timer window ("2 of every 5",
   bracketed over its hits on the chart), and for an example, its whole list. The chart has
   three lanes on one time axis. In **Hits**, a tall stem in the element’s color applies
   and a short, faint tick is blocked. **Counter** is the hit counter, ringed where the
   counter let a hit through. **Timer** shows the timer windows, each with how many hits it
   applied. Point at a hit to read why it did or didn’t apply."
2. "The row over the chart picks the string: evenly spaced hits, or one of four real
   examples from gcsim (Fischl’s Oz, Hu Tao’s charged attacks, Chevreuse’s burst, and
   Layla’s Shooting Stars). For evenly spaced hits, the handle under the chart sets the
   interval, and the **Share** strip along it shows the share that applies at every
   interval. Under the chart, **ICD** sets the rule: **Standard**, **No ICD**, or the
   example’s own fill in its timer, hit counter, and limit per window, and moving any of
   them makes it **Custom**."

## 9. The third pass: layout and order

Nate (2026-11-04): an improvement, the rule's sliders "really nice"; what was left was layout,
with things placed oddly and the chart's edges loose. Claude's reading of what goes together:
the hits (which string, how far apart, what element), the result (the chart, the bracket,
the strip, the reading), and the rule. The interval has to stay on the time axis, so the hits
bracket the chart: which string above it, how far apart at its foot. Nate: "similar to what
is already there, but if it's tidied up it might solve it."

- **Top-aligned** under the headline, as every stage instrument is; the room the chart can't
  use falls at the foot. Centring had left a gap between the answer and its chart.
- **The chart's edges:** the lanes' names follow the chart's type only up to 13px, and their
  column is the widest name, about half the old one; the right margin is half the last time
  label, so the axis ends at the stage's edge.
- **The interval's presets** follow its field on the header line (`InstrumentSlider`'s new
  `headerEnd` slot), instead of at the row's far end; the track keeps the axis's span and the
  line runs on past it.
- **The reading** stands right of the share strip, under the chart it explains, where 360px
  are left there; otherwise (a phone, an example) it is a line under the chart.
- **The rule is one row** across the stage, its edges the chart's: the ICD name over its
  presets, as a label over its track, then Timer, Hit counter and Limit per window; the
  definition under the row. Stacked under 52rem.
- **The element swatches** are a segment, the strings' track and height, at the toolbar's
  far end before Send.
- On an example the bracket's room at the chart's top goes, and 🎛️ `STALK_GROW` is 2.

For Nate's eye: at 2000×1045 about 250px of night is left at the foot, because the chart
stops at its cap (`K_MAX` 1.6 × the type, then the stems to `STALK_GROW` 2); either knob
fills more of it.

Then Nate: "This is so much more tidy." Three touch-ups: the interval presets are the strings'
and the rule's segment, one size with them (lit only while the interval is a preset's); the
band labels lose the chart words' halo, the band being their ground; and the rule row's last
range input ran 2px past the stage's edge (Chrome's range margin, the trap the axis handles
already guard) and scrolled the tile sideways, now zeroed.

## 10. The companion, changed: how often the element lands

Nate: the share strip is interesting, "perhaps the graph true theorycrafters would gain the
most from", but obtuse to everyday players, himself included. Claude's reading: it answered a
theorycrafter's question (what fraction of my hits apply); the everyday one is how often the
element lands. Offered with a plain-spoken share strip, the aura on the enemy (set aside:
at 1U per application nearly every string keeps it on, and a reaction eating it is the
Gauge explorer's job), and hits against applications as two staircases (set aside: it repeats
the stems). ⚓ Nate picked how often it lands.

The strip is now the seconds between applications at every interval on the handle's span
(`icdTimeline.ts` `landsEvery`, tested: Standard ICD lands every 1.25s at 0.5s, 3s at 1s,
2.5s at 1.25s, 4s at 2s, and 2.5s at 2.5s). It is a sawtooth, and its drops are the
surprise: attacking slower can land the element more often, where each hit meets the timer
as it runs out. Drawn as a line (taller is a longer wait), its seconds in the lanes' margin,
its title over it, and the dot's value beside the dot, lifted over the curve wherever the
label spans so the line never runs through it. The strip is no longer the headline's own
number; the two answer different questions.

Copy (proposed): "How often the element lands, at each hit interval" (the strip's title);
"every 1.25s" (the dot); the seconds on its scale ("2s", "4s", "6s"). Gone: "Share" and its
tooltip.

Help §8's second paragraph, revised for it: "…For evenly spaced hits, the handle under the
chart sets the interval, and the strip along it shows how often the element lands at every
interval: sometimes a slower string lands it more often. Under the chart, **ICD** sets the
rule…"

## 11. Element tints, the strip apart, the reading centred

Nate: the headline and the strip complement each other, and the strings (§5, §7, §10) are
approved. Three more:

- **An element is chosen in its own tint**, here and in Enemy RES & DEF: `.segment >
.btn.seg-el.is-active` in `app.css` (by `.segment`), the Gauge explorer's hover recipe
  (the element's `--el-*-main` at 22% over the ground), each button setting `--seg-el`.
  Physical takes `--el-none-main`.
- **The strip stands apart where it would be small.** Tied to the time axis it spans
  0.1–3s of it, a fifth or less on a phone or a 20s custom axis. Below 🎛️ `TIED_MIN`
  (360px of that span) the strip and the handle take the plot's full width on a 0–3s scale
  of their own, its seconds under the strip, and the thumb leaves hit 2. Wide, it stays
  tied. Decided from the width and the axis only, ahead of the type's scale, which depends
  on the height this decides.
- **The reading centres** in the open space beside the strip, from the strip's title to the
  handle's foot, at most 40rem wide.

Driven at 2000×1045 (tied, reading centred), 900×800 and 390×844 (apart), and Enemy RES &
DEF at 1400×860 (Pyro in its tint); no sideways scroll, no page errors.

## 12. Close

- **The strip apart is flush with the timeline:** its own scale runs 0.1–3s across the plot's
  exact width, so its gridlines start and end with the timeline's (measured: 43→852 at 900px,
  43→346 at 390px).
- **"On average"** (Nate's question, Claude's wording): the element lands at uneven gaps inside
  a window (1.5s then 1s at 0.5s apart under Standard ICD), so "every 1.25s" is their average.
  The strip's title is "How often the element lands on average, at each hit interval"; the dot
  stays "every 1.25s", under it.
- **Help** landed as §8's first paragraph and §10's revision of the second, in one with the
  string row, the strip and the rule's presets. The third paragraph (the rule explained) still
  holds.
- The copy ledger's note `docs/text/ledger/notes/vz_icd.md` still describes the rail; it joins
  the to-do's string-inventory item with the other stage rounds' orphaned notes.

Gates: Vitest 2782, svelte-check, lint, build; e2e both engines 144 passed.
