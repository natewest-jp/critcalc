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

↻ **2026-09-30 (playback round): the zoom moved into a popover** off one Zoom plate, so
three rows above are **retired** — `rp.zoom.reset.aria`, `rp.zoom.reset.title` and
`rp.zoom.title` no longer exist (Reset is a plain word inside a panel titled Zoom, and the
slider has no tooltip). The "three phrasings" ⚠️ is resolved by that. The surviving rows
and the new ones (the plate, the percentage) are in **Added 2026-09-30 § B** at the end.

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

---

## Added 2026-09-27 — missed by the first extraction

☐ **Not yet read.** ⚠️ Until this box is ticked, a blank `New:` in this section is **not**
an approval. These rows come from a parser-based re-run; the first pass skipped strings
inside script expressions, object literals and template literals — which is where the
planner builds nearly every tooltip. Keys are left to the extraction pass. The planner's
toasts are in `document-bar.md` (they all render in band A).

### A. The editor's lint messages — `notationFlags.ts`

The squiggles under the notation, on the rule the editor lints by: `--ui-warning` = we
cannot take this · `--ui-provisional` = we took it and this is a stand-in.

| Where                            | Kind        | Now                                                                                | New |
| -------------------------------- | ----------- | ---------------------------------------------------------------------------------- | --- |
| `notationFlags.ts:156`           | warning     | No character called "{text}" — this segment is skipped.                            |     |
| `notationFlags.ts:170`           | provisional | No slot for {character} — a team holds 4, and this is character {n}.               |     |
| `notationFlags.ts:184`           | warning     | Walk-cancels aren't simulated. Use ~2s for a deliberate pause.                     |     |
| `notationFlags.ts:198`           | warning     | Only a bow can take an aimed shot — {character} wields a {weapon \| melee weapon}. |     |
| `notationFlags.ts:81`            | provisional | {character}'s kit isn't curated yet — this cast is drawn with generic timing.      |     |
| `notationFlags.ts:84`            | provisional | {character} has no {token} (hold) variant — timed as a plain E.                    |     |
| `notationFlags.ts:87`            | provisional | {character} has no short-burst variant — timed as a full Q.                        |     |
| `notationFlags.ts:89`            | provisional | {character} can't perform {token} — this cast is drawn with generic timing.        |     |
| `notationFlags.ts:213`           | provisional | {character}'s plunge isn't measured yet — drawn with generic timing.               |     |
| `notationEditorExtension.ts:578` | Placeholder | Type a rotation — e.g. Bennett E Q > Xiangling E Q N3 > …                          |     |

⚓ **These are the most-read explanatory strings in the planner** — every mistake in a
rotation meets one — and none of them were in a sheet.
🐛 **`wields a {weapon}` inserts the raw weapon id** ("wields a claymore"), lowercase and
untranslated, and "a" is wrong before a vowel-initial locale word.
⚠️ **"Walk-cancels aren't simulated"** is the style guide's own model passage (§1.2).
⚓ It keeps its job; the wording is still open like everything else.
⚠️ **Three endings for one idea** — "this cast is drawn with generic timing" / "drawn
with generic timing" / "timed as a plain E". Worth one phrase.
⚠️ **"{character}'s"** — a possessive glued to a name, twice.
⚠️ The KQM tokens (`E`, `Q`, `N3`, `>`, `{token}`) and the placeholder's names are 🔒.
🐛 **The placeholder has a double space after "e.g."** (`e.g.  Bennett`) — it collapses
in HTML but not necessarily in CodeMirror's placeholder widget.

### B. The aura log's standing limits

The four lines above the log (`rotation-planner/+page.svelte:325–334`), plus its empty
states.

| Where                | Now                                                                                                                              | New |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --- |
| `+page.svelte:326`   | One enemy, and it never applies an element back at you — so no Pyro from a Blazing Axe Mage, and no auras you did not put there. |     |
| `+page.svelte:327`   | Hits land on their listed timing. A swing that hits several times counts as one application, and Shatter is not modelled.        |     |
| `+page.svelte:328`   | A pip with a yellow ring means we are using a default gauge strength of 1U for that hit rather than a measured one.              |     |
| `+page.svelte:334`   | A Starlight Prism bar says when the Polestar Field is up, not where — we assume you are standing in it.                          |     |
| `+page.svelte:652`   | This rotation puts nothing on the target. _(log, empty)_                                                                         |     |
| `EventLog.svelte:94` | Nothing to report. _(the shared log's default empty state)_                                                                      |     |

🐛 **"modelled"** — British (R6, US English everywhere).
🐛 **"we are using" / "we assume"** — ⚓ Nate 2026-09-23: a limitation is the **tool's**
("The Rotation Planner assumes…"), ⛔ never "we". (The same pass was applied to the
coverage page's 184 reasons.)
⚠️ **"did not"** — the style guide takes contractions.
⚠️ "Blazing Axe Mage", "Starlight Prism", "Polestar Field", "Shatter" are 🔒.
⚠️ **"A pip with a yellow ring"** names a color a color-blind reader may not see as
yellow — the chart's own mark is the provisional foot. Worth naming the mark by shape.

### C. The band B controls' tooltips

| Where              | Context              | Now                                                                | New |
| ------------------ | -------------------- | ------------------------------------------------------------------ | --- |
| `+page.svelte:519` | Auras plate, tooltip | Draw the target's elemental gauge, with applications and reactions |     |
| `+page.svelte:541` | Log button, tooltip  | The target's aura, application by application                      |     |

### D. Chart tooltips and in-chart labels — `RotationTimeline.svelte`

| Where        | Context                                             | Now                                                                                                                               | New |
| ------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --- |
| `:1184`      | A human-timing pad, after a swap                    | Human timing: {n} frames ({n}s) after the swap — nothing buffers until the new character appears.                                 |     |
| `:1185`      | A human-timing pad, otherwise                       | Human timing: {n} frames ({n}s) after {action}, before an input the game does not buffer.                                         |     |
| `:1171–1182` | …where {action} is                                  | a normal attack · a charged attack · a plunge · a skill · a burst · a dash · a jump · the swap · an action                        |     |
| `:2852`      | An approximated input block                         | No frame data yet — cast animations and normal attacks use generic timings.                                                       |     |
| `:2890`      | Weapon-proc row label                               | {proc} trigger CD                                                                                                                 |     |
| `:2287`      | Aura pip tooltip, several applications on one frame | On this frame · {n} applications                                                                                                  |     |
| `:2299`      | Aura pip tooltip, provisional gauge                 | Gauge strength · not measured — 1U assumed                                                                                        |     |
| `:1014`      | Gadget run tooltip (cores / a lone gadget)          | On the field · {n} cores / Standing · {n}s                                                                                        |     |
| `:1021`      | …when some were used                                | Just now · {n} consumed by a reaction                                                                                             |     |
| `:1043–1064` | Single gadget tooltip                               | On the field · {n}s / Spawned · {n} at once / Alongside · {n} / Ends · consumed by a reaction / Ends · pushed out by a newer core |     |
| `:2998` 🆕   | Odette's stepped-stack bar                          | Recorded hits · {n} in the previous 4s                                                                                            |     |
| `:3075`      | Ascendant Gleam bar, tooltip heading                | Ascendant Gleam — {character}                                                                                                     |     |
| `:3086`      | Ascendant Gleam bar, label                          | {character} · Ascendant Gleam                                                                                                     |     |
| `:2089–2098` | Ascendant Gleam scaling line                        | +0.6% / 1,000 Max HP (cap 36%) · +1% / 100 DEF (cap 36%) · +2.25% / 100 EM (cap 36%) · +0.9% / 100 ATK (cap 36%)                  |     |
| `:1532`      | PNG export title when the team is empty             | critcalc rotation                                                                                                                 |     |

🆕 = added 2026-09-27 (`787f0ee1`).
🐛 **`{n} cores` / `core` is a hand-rolled plural** (`:1016`) — ICU.
⚠️ **The tooltip rows are `label · value` pairs**, the same grammar as the buff tooltip;
"Just now", "Standing", "Alongside" only make sense as the left half of that pair.
⚠️ **"{n} frames"** — a plural; "{n}s" goes through `Intl`.
⚠️ **The Gleam scaling lines write rates with `/`** — the day-2 ruling says a rate takes
"per". And `1,000` carries an English thousands separator.
⚠️ **"trigger CD"** is our coinage; 🏷 "CD" is community shorthand.
⚠️ **The PNG export repeats two of these** (`timelineExport.ts:943` "trigger CD", `:1248`
"· Ascendant Gleam") — the export mirrors the chart, so an edit here is an edit there.
⚠️ **"a skill" / "a burst"** — lowercase here, while the chart's own words for them are
Skill / Burst (glossary).

### E. Coverage links — added after the sheets 🆕

| Where                           | Now                                                                                | New |
| ------------------------------- | ---------------------------------------------------------------------------------- | --- |
| `RotationNotes.svelte:68` 🆕    | Coverage for this team                                                             |     |
| `RotationCoverage.svelte:63` 🆕 | {character}'s coverage, with the parts this rotation doesn't reach dimmed _(aria)_ |     |

🆕 = added 2026-09-23, the coverage round — written against the style guide.

### F. Stat labels — the buff tooltip's left column

`buffStatMaps.ts:86–155` (`BUFF_STAT_LABEL`). Used by every buff tooltip in the planner
and by the Team Builder's capability detail. **All 🔒 in principle** (stat names are frozen
game terms, R2) — but several are **ours**, and those are the rows to read:

> ATK · ATK% · CRIT Rate · CRIT DMG · **Elem. Mastery** · **CD Reduction** · DEF · DEF% ·
> DEF Ignore · HP · HP% · Healing Bonus · Interruption Res · DMG Bonus · **Skill DMG** ·
> **Burst DMG** · **Normal DMG** · **Charged DMG** · **Plunge DMG** · **Skill Flat DMG** ·
> **Burst Flat DMG** · **Normal Flat DMG** · **Charged Flat DMG** · **Plunge Flat DMG** ·
> Pyro DMG · Hydro DMG · Cryo DMG · Electro DMG · Anemo DMG · Geo DMG · Dendro DMG ·
> Lunar DMG · Energy Recharge · Lunar-Charged DMG · Lunar-Bloom DMG · Lunar-Crystallize
> DMG · **Lunar-Crystallize Flat DMG** · Base Stellar-Conduct DMG · Base Stellar Swirl
> DMG · Base Stellar Glimmer DMG · Superconduct Reaction Bonus · Swirl Reaction Bonus ·
> Cryo Swirl Reaction Bonus · Electro-Charged Reaction Bonus · Bloom Reaction Bonus ·
> Stellar-Conduct Reaction Bonus · Stellar Swirl Reaction Bonus · Stellar Glimmer
> Reaction Bonus · Lunar-Charged Reaction Bonus · Lunar-Bloom Reaction Bonus ·
> Lunar-Crystallize Reaction Bonus · Anemo RES · Cryo RES · Dendro RES · Electro RES ·
> Geo RES · Hydro RES · Pyro RES · Physical RES · All Elemental RES · {Element} CRIT DMG ×7

⚠️ **Bold = our abbreviation or coinage**, not the game's wording. The game says
"Elemental Mastery" (the Reaction Curves sheet spells it out); "Normal Attack DMG Bonus" /
"Charged Attack DMG Bonus" / "Elemental Skill DMG Bonus" are the game's; "Flat DMG" is
community shorthand for the game's "DMG increased by…".
⚠️ **"Elem. Mastery" is the only abbreviated-with-a-period label on the site** — and "EM"
is used everywhere else, including the Anatomy bars.
⚠️ **"Interruption Res"** is already ruled (glossary §2a) — listed for completeness.

Plus the scaling words inside a buff's value (`buffDisplay.ts:112–130`): ATK · base ATK ·
HP · DEF · EM · ER · CRIT Rate · Healing Bonus, and `+{n} → {n} over duration` (`:50`) for
a decaying buff — ⚠️ typesets `→` (on the mark sweep's banned list).

### G. Reaction labels with their element — `auraDisplay.ts:172–180`

| Now                                                                                   | New |
| ------------------------------------------------------------------------------------- | --- |
| Swirl (Pyro) · Swirl (Hydro) · Swirl (Cryo) · Swirl (Electro) · Stellar Swirl         | 🔒  |
| Crystallize (Pyro) · Crystallize (Hydro) · Crystallize (Cryo) · Crystallize (Electro) | 🔒  |

⚠️ **§8's "🔒 mostly" list didn't reach these.** The names are frozen; the "(Element)"
construction is ours — the Gauge Explorer's log writes the same thing as "Swirl (Pyro)" too,
so it is at least consistent.

### H. Assorted

| Where                   | Now                                                          | New |
| ----------------------- | ------------------------------------------------------------ | --- |
| `notationParser.ts:250` | Anemo Resonance: {name} _(a cooldown-reduction source name)_ | 🔒  |
| `sim/fields.ts:292`     | Polestar Field _(a buff's source name)_                      | 🔒  |

---

## Added 2026-09-30 — the playback round

☐ **Not yet read.** ⚠️ Until this box is ticked, a blank `New:` in this section is **not**
an approval. The playback round shipped on `main` (`6f3195ec`) with Claude's first-cut
strings, written against the style guide; its record is `docs/playback-round-plan.md`.
Keys are left to the extraction pass. Line numbers are `rotation-planner/+page.svelte`
unless named. ⚠️ The new Help paragraphs (**Play.** and **Laps.** in the Rotation Planner
chapter) are pass 2 material, like every Help chapter.

### A. The transport — band B's left zone

| Where                   | Context                         | Now                                                                                       | New |
| ----------------------- | ------------------------------- | ----------------------------------------------------------------------------------------- | --- |
| `:431`                  | The group's screen-reader name  | Playback                                                                                  |     |
| `:439`                  | ⏮ plate, screen-reader name    | Back to the start                                                                         |     |
| `:440`                  | ⏮ plate, tooltip               | Back to the start (Home)                                                                  |     |
| `:450`                  | Play plate, screen-reader name  | Play the rotation · Pause                                                                 |     |
| `:451`                  | Play plate, tooltip             | Play the rotation at game speed (Space) · Pause (Space)                                   |     |
| `:469`                  | Speed plate, screen-reader name | Playback speed {rate}                                                                     |     |
| `:470`                  | Speed plate, tooltip            | Playback speed: {rate}. Slow down to learn a rotation; the count-in keeps its pace        |     |
| `playback.svelte.ts:54` | {rate}, the plate's own label   | 1× · 0.75× · 0.5×                                                                         |     |
| `:502`                  | Laps plate, label               | Laps                                                                                      |     |
| `:498`                  | Laps plate, tooltip             | Draw the laps that follow: the rotation runs on past its end, cooldowns and buffs carried |     |

⚓ **"Laps"** was chosen over "Repeat" (⚓ Nate: repeat names a loop, and playback already
loops) and over "Extend" (extend what?) — it names what appears, the ×2, ×3 lap marks.
The job: say the chart now runs PAST the notation, and that what follows is simulated.
⚠️ **"(Home)" / "(Space)"** — key names in a tooltip. Keys localize (and "Home" is not on
every keyboard); worth a convention before more shortcuts arrive.
⚠️ **"count-in"** is musicians' vocabulary — a 🏷 context note for translators.
⚠️ **{rate} is decimals on purpose** — ⛔ never ½ ¾ (a vulgar fraction falls back to
another face). The × is typeset.
⚠️ The Speed tooltip has **no final period** and the other two do not either — consistent
with band B's other tooltips, but worth a ruling.

### B. The Zoom plate and its popover

| Where  | Context                               | Now      | New |
| ------ | ------------------------------------- | -------- | --- |
| `:520` | The plate's label (folds below 71rem) | Zoom     |     |
| `:520` | The plate's screen-reader name        | Zoom     |     |
| `:527` | − button                              | Zoom out |     |
| `:538` | The slider                            | Zoom     |     |
| `:543` | + button                              | Zoom in  |     |
| `:549` | The readout                           | {n}%     |     |
| `:554` | The reset button                      | Reset    |     |

⚠️ **{n}% is the scale against the resting one** (100% at rest), not a pixels-per-second
figure — the old slider tooltip said "pixels per second" and it is gone. `%` goes through
`Intl` (style guide §3.7).
⚠️ **The plate and the slider share one name, "Zoom".** A screen reader hears "Zoom,
button" then "Zoom, slider" — probably fine, worth a glance.

### C. The phone fold — one ⋯ below 40rem

| Where  | Context                          | Now                               | New |
| ------ | -------------------------------- | --------------------------------- | --- |
| `:674` | The ⋯ plate's screen-reader name | Playback, timing and panels       |     |
| `:676` | Heading over the speeds          | Speed                             |     |
| `:687` | The speeds                       | 1× · 0.75× · 0.5×                 |     |
| `:704` | Items                            | Laps · Human timing · Log · Notes |     |

⚠️ The items reuse the band's words, so a rename on the band is a rename here —
**one key each**, never two.
