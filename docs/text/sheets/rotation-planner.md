# Worksheet — Rotation Planner

**Surface:** the planner's own view bar (zoom, human timing, layers, log, notes), the
timeline's lane headings, the composer's undo pair, and the aura log's heading.
**Pass:** 1 (Nate leads) · **Strings:** 34 · **Guide:** `docs/text/style-guide.md` ·
**Glossary:** `docs/text/glossary.md`

---

## 1. 🐛 The lane headings shout, and one of them disagrees with itself

The chart's lane names are written **UPPERCASE in the source** _and_ uppercased again by
CSS (`.rp-lane-name { text-transform: uppercase }`).

| key                | Where                                     | Now              | New |
| ------------------ | ----------------------------------------- | ---------------- | --- |
| `rp.lane.aura`     | Heading on the aura lane, above the ruler | TARGET AURA      |     |
| `rp.lane.buffs`    | Heading on the team-buff lane             | TEAM BUFFS       |     |
| `rp.lane.nb`       | Heading on the Nightsoul-burst lane       | NIGHTSOUL BURSTS |     |
| `rp.lane.moonsign` | Heading on the Ascendant Gleam lane       | ASCENDANT GLEAM  | 🔒  |
| `rp.bar.nb`        | The label inside each NB bar              | NB               |     |
| `rp.log.head`      | Heading of the aura log column            | Target aura      |     |

`src/lib/components/RotationTimeline.svelte:2142,2887,2952,2958,2972` ·
`rotation-planner/+page.svelte:645`

- 🐛 **`TARGET AURA` and `Target aura` are the same thing, named twice.** The lane heading
  on the chart and the heading of the log that transcribes it. ⚓ They must agree —
  the log _is_ the lane in words, and a reader moving between them should not have to
  wonder.
- ⚠️⚠️ **The uppercase is doubled**, so the locale files would carry shouting English for
  no benefit: the CSS already does it, and **CJK has no case**, so a Japanese lane label
  gets the styling and none of the emphasis. ⚓ Write these sentence case and let the CSS
  do the shouting — that is also the only version that works in every locale.
- ⚠️ **"Ascendant Gleam" is a 🔒 frozen game term**; "Nightsoul" likewise. The lane _word_
  around them ("bursts") is ours.
- ⚠️ **tight** — lane names sit in the chart's left inset at `--fs-xs` with the widest
  tracking on the site. **"NIGHTSOUL BURSTS" is already the longest** and RU/FR/ES add
  20–30%. ⛔ Check this one at the narrow breakpoint before lengthening anything.

---

## 2. Zoom

| key                   | Where                  | Now                                 | New |
| --------------------- | ---------------------- | ----------------------------------- | --- |
| `rp.zoom.reset`       | Button label           | Reset                               |     |
| `rp.zoom.reset.aria`  | Its screen-reader name | Reset the zoom to its resting level |     |
| `rp.zoom.reset.title` | Its tooltip            | Back to the resting zoom            |     |
| `rp.zoom.aria`        | The slider             | Zoom                                |     |
| `rp.zoom.title`       | The slider's tooltip   | Zoom — pixels per second            |     |
| `rp.zoom.out.aria`    | − button               | Zoom out                            |     |
| `rp.zoom.in.aria`     | ＋ button              | Zoom in                             |     |

`src/routes/(scene)/(tools)/visualizers/../rotation-planner/+page.svelte:379,380,385,387,391,407,408,414`

⚠️ **Three phrasings of one idea** on the reset control alone — "Reset", "Reset the zoom
to its resting level", "Back to the resting zoom". Two is normal (a short label, a fuller
screen-reader name); three means the tooltip and the aria-label drifted apart.
⚓ **"Resting" is a good, deliberate word** — it says the zoom has a home to return to
rather than a factory default. ⛔ Don't flatten it to "default"; that is what the _tile_
control in the Visualizers means, and the two are different ideas.
⚠️ ⛔ **Nothing but the zoom resets here** (⚓ Nate) — the button narrowed to the zoom
alone on purpose, because a panel and a layer are things you deliberately opened. ⛔ Don't
write copy that implies it resets the view.

---

## 3. Human timing

| key              | Where                  | Now          | New |
| ---------------- | ---------------------- | ------------ | --- |
| `rp.human.label` | The toggle's label     | Human timing |     |
| `rp.human.aria`  | Its screen-reader name | Human timing |     |

### `rp.human.title` — its tooltip

**Now:** Time the rotation as a person plays it: pad the inputs the game does not buffer,
let animations finish. Configure in Settings.
**New:**
**Notes:** ⚓ **The colon-plus-two-clauses shape is doing a lot of work in very little
room** and it works. ⚠️ It is also three sentences' worth of content in one line — a good
candidate for the one-idea-per-sentence rule if it can keep its density.
⚠️⚠️ **Settings calls this button "Human"** (see `settings.md` §2) while the button says
**"Human timing"**. One of the two is wrong and the Settings one names a control that
does not exist by that name.
`src/routes/(scene)/(tools)/rotation-planner/+page.svelte:464,470,474`

---

## 4. Layers, log and notes

| key                    | Where               | Now                                                                | New |
| ---------------------- | ------------------- | ------------------------------------------------------------------ | --- |
| `rp.layers.aria`       | The two-plate group | Timeline layers                                                    |     |
| `rp.layers.buffs`      | Plate 1             | Buffs                                                              |     |
| `rp.layers.auras`      | Plate 2             | Auras                                                              |     |
| `rp.layers.title`      | The group's tooltip | Draw buff bars, weapon procs, Nightsoul bursts and Ascendant Gleam |     |
| `rp.log.toggle.aria`   | Log button          | Toggle the aura log                                                |     |
| `rp.log.toggle`        | Its label           | Log                                                                |     |
| `rp.notes.toggle.aria` | Notes button        | Toggle notes panel                                                 |     |
| `rp.notes.toggle`      | Its label           | Notes                                                              |     |

`src/routes/(scene)/(tools)/rotation-planner/+page.svelte:499,505,512,524,540,546,552,557`

⚠️ **The layers tooltip describes only the Buffs plate**, not the pair it is attached to.
It lists what Buffs draws and says nothing about Auras. ⚓ Since the two plates are
deliberately **not** a menu — a lit plate is supposed to announce at a glance that
something is hidden — the tooltip is where the second half of that explanation should
live.
⚠️ ⛔ **The cut is "a bar that says when an ability IS stays; a bar that says what it
GRANTS goes"** — so summons and shields stay visible either way. Any rewording must not
imply the plates hide everything.
⚠️ **"Toggle the aura log" / "Toggle notes panel"** — one takes an article, the other
doesn't. Also "toggle" is interface-speak; the glossary bans curator vocabulary but this
is the ordinary-UI equivalent. Worth deciding once, as it recurs.
⚠️ **tight** — all four labels fold to marks below 40rem, and below 68rem the whole band
folds. These are the shortest labels in the tool for that reason.

---

## 5. 🐛 The composer's undo pair hardcodes Mac keys

| key               | Where            | Now                                  | New |
| ----------------- | ---------------- | ------------------------------------ | --- |
| `rp.undo.aria`    | Undo button      | Undo the last notation change        |     |
| `rp.undo.title`   | Its tooltip      | Undo (⌘Z)                            |     |
| `rp.redo.aria`    | Redo button      | Redo the last undone notation change |     |
| `rp.redo.title`   | Its tooltip      | Redo (⌘⇧Z)                           |     |
| `rp.history.aria` | The pair's group | Notation history                     |     |

`src/lib/components/RotationTimeline.svelte:3118,3122,3123,3133,3134`

🐛 **`⌘Z` and `⌘⇧Z` are Mac-only.** A Windows or Linux reader is told a shortcut that
does not exist on their machine — and this is a Genshin audience, which skews heavily
toward Windows. ⚓ The fix is a rendered value, not a copy edit: detect the platform and
substitute, so the locale file carries `Undo ({shortcut})`.
⚠️ Note the keys themselves are 🔒 frozen — `⌘` and `Ctrl` are not translated.

---

## 6. Small strings inside the chart

| key              | Where                                       | Now     | New |
| ---------------- | ------------------------------------------- | ------- | --- |
| `rp.total`       | The rotation's total-duration readout       | Total   |     |
| `rp.buff.oneof`  | Buff tooltip, before a list of alternatives | one of: |     |
| `rp.proc.ereset` | A weapon proc's row name                    | E reset |     |

`src/routes/(scene)/(tools)/rotation-planner/+page.svelte:445` ·
`BuffTooltip.svelte:62` · `src/lib/timeline/weaponProcRows.ts:41`

⚠️ **"one of:" is a bare fragment** with a trailing colon carried in the string — same
punctuation-in-the-message problem as the bench's headings, and ⚠️ it is also a _list
introducer_, which several languages express as a suffix on the list rather than a prefix.
⚠️⚠️ **"E reset" uses a notation token as a word.** `E` is 🔒 frozen, but "E reset" as a
phrase is ours, and it assumes the reader maps `E` → skill. ⚓ That is a safe assumption
for this audience and an unsafe one for a translator, so it needs a context note more than
it needs a rewrite.

---

## 7. Gadget row labels — 🔒 frozen

**Starlight Prism · Thundercloud · Moondrift · Dendro Core** —
`src/lib/timeline/gadgetRows.ts:115,121,133,138` (and the same four in `sim/fields.ts`,
`sim/finalize.ts`, `sim/gadgets.ts`).

⚠️ All four are game terms; genshin-db ships them per locale. ⛔ Never hand-translate.
⚠️ They are **declared in four different files** and must stay identical — worth one
shared source when extraction runs, so a locale cannot drift between the chart and the log.

## 8. Aura series labels — 🔒 mostly

**Pyro · Hydro · Cryo · Electro · Dendro · Frozen · Quicken · Burning** are 🔒 frozen
game terms. ⚠️ **"Fuel"** (`auraDisplay.ts:62`) is **ours** — it names the dendro fuel
that feeds a Burning aura, which the game does not name. It translates, and it needs a
context note saying what it is, or a translator will read it as fuel in the ordinary
sense.
