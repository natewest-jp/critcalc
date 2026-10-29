# The Icon Set — Lucide, GENERATED not depended on

> Moved from Claude's working memory on 2026-10-29, where it was kept as a living reference. Check the code before relying on a detail.

✅ Introduced 2026-08-07 `0a788cf`. **✅ THE SWEEP IS DONE — `b552ede`,
2026-08-07 (pushed 2026-08-08).** 15 marks → 27.

Control glyphs come from **Lucide** (ISC, 2,021 icons). But nothing from Lucide
ships:

```
lucide (devDependency)  →  scripts/generate-marks.mjs  →  src/lib/marks.generated.ts
                                                       →  $lib/components/Mark.svelte
```

Same shape as the element icons, the character index and the roles sidecar —
this repo's standing pattern is _library → generator → `_.generated.ts`*, all
wired into `predev`/`prebuild`. `npm run generate-marks` runs it by hand.

## ⛔ Do NOT install `@lucide/svelte`

It was evaluated and rejected, for reasons that will not change:

- Every icon becomes a **Svelte component instance**. On roster-scale surfaces
  (122 character cards × several marks) that is hundreds of instances where we
  render one `<svg>` element — and this codebase has measured perf trouble at
  exactly that scale (see `docs/rounds/portrait-loading-diagnosis.md`).
- It brings its own `<svg>` attribute defaults, so the size / stroke /
  `aria-hidden` contract that lives in ONE file would have to be re-asserted at
  every call site — or wrapped, at which point the dependency is only delivering
  path strings.
- It requires per-icon deep-import discipline (`@lucide/svelte/icons/save`)
  forever, enforced by nothing; the barrel import wrecks dev-server startup.

**Also do NOT hand-copy SVGs off lucide.dev.** No provenance, no version, no
licence trail, and each downloaded file carries its own `width`/`height`/
`stroke-width`/`class` that has to be stripped by hand.

## How to add a mark

1. Add a line to `MARKS` in `scripts/generate-marks.mjs` — **our semantic name
   → Lucide's export name** (`update: 'RefreshCw'`). The indirection is the
   point: call sites say what the control DOES, so re-picking a glyph is a
   one-line change.
2. `npm run generate-marks`, commit the artifact.
3. Use it: `<Mark name="update" />`. The `MarkName` union is generated, so a
   typo is a type error rather than an empty box.

**Keep the set small** — 27 marks. 2,021 icons is an invitation to over-icon a
restrained design language; add on demand, never speculatively. The sweep's 13
additions were each pulled by a call site: `gated star search rename delete
download upload warn layout uncurated swap forward back`. ⚠️ `update`
(RefreshCw) was RETIRED with the Save-button change — see below.

⚠️ **AN ORNAMENT IS NOT A MARK.** 2026-08-10 added `sparkle: 'Astroid'` — the
same picture as `gated` under a second name, for the flanking flourishes on the
Team Builder's selected nav plate. The DUPLICATE was defensible (call sites say
what a mark DOES, and a state badge and a decoration have no reason to move
together), but ⚓ Nate removed the ornaments the next day and the name went with
them, back to 27. The rule that settled it: **the map's own contract is that an
unused name is dead weight.** Decoration is the shakiest reason to add one —
it is the first thing a design round takes back out.

`src/lib/marks.test.ts` guards it: fresh-extraction drift, orphans in both
directions, the header's version matching the installed package, node shapes
being plain SVG children, and no node carrying its own `fill`/`stroke` (marks
inherit their control's ink — that is how disabled/active states work).

## Knobs and rules

- `MARK_SIZE` (14) and `MARK_STROKE` (1.9) are exported from `Mark.svelte`'s
  module block. Both in Lucide's 24-unit grid, so landed ink is
  `stroke × size / 24` ≈ 1.11 device px. ⚠️ Tune against **Chrome** — see
  `docs/design/subpixel-rendering-laws.md`.
- Nodes render via `<svelte:element this={tag}>`, never `{@html}`.
- ⛔ **Not for the element icons** (a generated artifact of the `--el-*` tokens;
  `ICON_HUE_OFFSET` is the only sanctioned divergence) or the brand mark.
- Bespoke domain glyphs are supported by _adding a second record in the
  generator_, but there is none yet — the merge was deliberately not built, and
  the two hand-drawn marks the site owns are not candidates (the planner's notes
  badge is two-fill artwork, not a currentColor stroke).

## The sweep — ✅ done, `b552ede`

Every control glyph in the app is geometry now. The worst offender was **🔒 on
the TB constellation gates: a COLOR emoji**, so it ignored `currentColor`
outright — a locked chip kept its blue-and-gold padlock through every ink state.
Nothing else on the site could disobey the ink contract that completely.

⚠️ **Three things stay typeset ON PURPOSE** — don't "fix" them:

- **Rarity stars** (`5★`) — Genshin's own notation, sits inline with a numeral.
- **The `?`** on a TB maybe-coverage chip — a hedge, and `?` is a real glyph in
  the body face.
- **Every `× · → ⁄` in prose and formulas** (help chapters, the instruments'
  math, `buffDisplay` strings). The law is about code points the text font
  doesn't cover, **not about punctuation**. A blind find-and-replace mangles copy.

↻ **2026-10-23 (Nate): under `?next` every slate surface closes with the INSPECTOR's ✕** (`btn btn--icon` + `<Mark name="close" size={16}/>`: InspectModal, the menu state, the phone drawer). Nothing in the new layout uses the drawn close art now; `CloseMark` + `assets-src/tools/close.svg` live only in the old layout (ChromeOverlay, the old DetailCard, the drawer off-switch) and retire at step 5. Also 2026-10-23: `library` = Lucide `Library` (filled, live too), `help` = `CircleQuestionMark`, `about` = `Info` (the `?` menu). Nate keeps redrawing the disc glyphs in `assets-src/tools/` (incl. an unused `about.svg`): a "swap them in" = copy each file's path `d` into its inlined `<svg>` (TopBar share/help; MenuState no longer has one).
⚠️ **`CloseMark` is NOT a duplicate of `close`** and must not be merged: it is
Nate's filled disc-with-a-hole artwork for the heavy overlay/modal dismiss
(28px), a different role from the 11px inline stroke close. Same for the
planner's notes badge (two-fill artwork).

`BenchBand`'s hand-cut ⇄/✕ paths joined the set; **`BB_GLYPH` (17) is the one
size knob** — ⚓ NATE, since the proportions are Lucide's now, not the hand-cut
14×12 / 9×9.

## ⚠️ Two failure modes that cost THREE rounds on one glyph

Read before picking any mark that lives in a chip. The constellation-gate mark
(`gated`) went padlock → alternatives → stars before landing.

1. **A mark has to survive its own SIZE.** At the 10–11px these chips run,
   anything with a small enclosed counter closes up. Lucide's `Lock` shackle
   lands at ~2px — no padlock can resolve there, which was the real complaint
   the whole time, not the drawing. **Prefer ONE path, no counters, no slash.**
2. **A mark has to survive its NEIGHBOURS.** It shares a card with `uncurated`,
   `star` and `check`. So a base-shape-plus-modifier collapses into the shape it
   borrowed: `StarX` loses its X into `star`; `Ban` is a circle-and-diagonal one
   seat from `uncurated` (= `CircleSlash2`). **Test in a real row, not in
   isolation** — `StarOff` is fine alone and reads as a rendering fault in a
   column of rows.

**The settled answer: `gated: 'Astroid'`** — a four-cusped star, i.e. a
constellation node. ⚠️ Named `gated`, NOT `locked`, on purpose: a constellation
gate involves no permission and no secrecy, you are simply not at C6 yet. The
padlock was a borrowed software metaphor. Its concave points separate from
`star`'s five straight ones at every size, so **wishlist did not have to move**.

⛔ `LockOpen` reads more clearly than `Lock` and says the OPPOSITE of the truth.
**Legibility bought with a lie is not a trade.** Same for `Flag` (means
_marked_ — a thing the user does) and `Sparkles` (now the universal "AI feature"
glyph, and four pieces of it at 11px is a smudge). `Waypoints` is the most
evocative thing in the field at 44px and a smear at 11 — remember it for
somewhere it can be drawn 20px+.

**Prefer the game's vocabulary to software's** when both fit.

## The guard: `scripts/probe-marks.mjs`

`marks.test.ts` proves the SET is coherent; it **cannot** prove the site stopped
typesetting, and a static grep can't tell a control glyph from prose. The probe
walks the RENDERED text of every tool surface against a banned-code-point list.
⚠️ It caught one the grep missed (a second `∅` on CharacterCard whose code point
fell outside my regex range) — **run it, don't trust a grep**. Needs a built
preview on :4998. It also fails loudly when a surface never opens, so a broken
selector can't read as a pass.

## ↻ 2026-10-11: ONE HELD LINE — `MARK_STROKE` is 1.15 CSS px at every size (merged `b8749c14`)

- Mark's stroke used to SCALE with its box: 1.9 Lucide units, so the ink was `1.9 × size / 24` (0.79px at 10, 1.42 at 18).
- Every shape now takes `vector-effect: non-scaling-stroke`, set in CSS on `.mark :global(*)`.
  - ⚠ The attribute isn't typed on `svelte:element`.
  - ⛔ Never use a stroke derived from `size`: `SlotPortrait` and `CharacterCard` size marks in CSS.
- Nate picked 1.15 on a /lab specimen at 2× and 1×. The specimen is in history at `e9d3198d`.
- ⚓ **Width cannot buy crispness.** At 1×, 12px is the crisp size, because a Lucide unit is half a pixel and lines land on pixel centres. 14px straddles two rows at every weight from 1.00 to 1.25. SIZE is the lever; 1.00 is the MOST exposed width. Recorded in Mark.svelte's header.
- New marks: `constellation` (Astroid, the same picture as `gated`), `locked`, `unlocked`.
- ⚠⚠ **Inlined SVG ART (not Lucide) needs per-INSTANCE gradient ids.**
  - Affinity names every export's gradients `_Linear1`/`_Linear2`, and inlined ids are page-global. A clash, or a copy inside a `display:none` subtree (which Chrome won't paint), hands `url(#…)` the wrong gradient.
  - Use `$props.id()`. Pin `fill-opacity="1"` on shading layers so the chrome's inherited 0.85 doesn't dim the artwork.
  - The chrome Roster marks (Aether/Lumine, SiteChrome.svelte) are the worked example. They are sized by luminous ink per height² (the compass method), and Lumine is aligned to Aether by nose tip + chin read from the path data.
