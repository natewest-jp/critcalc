# Worksheet — Settings

**Surface:** the settings panel — display preferences, human-timing configuration, and
the backup/restore/reset block.
**Pass:** 1 (Nate leads) · **Strings:** 38 · **Guide:** `docs/text/style-guide.md` ·
**Glossary:** `docs/text/glossary.md`

⚓ **This is the most prose-dense surface outside the help pages**, and it is the one
place a setting's _explanation_ sits right under its control. The explanations are good.
Most of the work here is consistency, not rewriting.

---

## 1. Display

| key                  | Where           | Now                                                    | New |
| -------------------- | --------------- | ------------------------------------------------------ | --- |
| `set.display`        | Section heading | Display                                                |     |
| `set.outfits.label`  | Toggle label    | Updated outfits                                        |     |
| `set.outfits.desc`   | Under it        | Prefer characters' newest outfit art where one exists. |     |
| `set.traveler.label` | Control label   | Traveler                                               |     |
| `set.traveler.desc`  | Under it        | Which twin appears wherever a Traveler is shown.       |     |
| `set.traveler.aria`  | The control     | Traveler variant                                       |     |

`src/lib/components/SettingsPanel.svelte:68,72,73,88,89,91`

⚠️ **"Traveler" is 🔒 frozen** (genshin-db, and the game spells it per locale — note it is
"Traveller" in some English variants but HoYo uses one L). ⚠️ **"twin"** is ours and is a
nice word, but it is a _characterization_ — a translator needs to know it means
Aether/Lumine and not a game term.
⚠️ The description uses a **curly apostrophe** (`characters’`). ⚓ Correct per the style
guide; noting it so it is not "fixed" to a straight one.

---

## 2. Human timing

### `set.ping.label` / `.desc`

**Now (label):** Swap ping
**Now (desc):** Your network latency — the ms value Genshin shows top-right. A swap takes
your ping plus about 90 ms, so the rotation planner delays every character swap by that
much.
**New (label):**
**New (desc):**
**Notes:** ⚓ **"the ms value Genshin shows top-right" is exactly right** — it tells the
reader where to _find_ the number rather than defining latency. Keep that move.
⚠️ "top-right" is a spatial claim about another application's UI; it holds, but it is the
kind of thing that ages.
⚠️ `ms` should go through `Intl` with the number (style guide §3.7).
`src/lib/components/SettingsPanel.svelte:106,107`

### 🐛 `set.human.desc` — names a button that does not exist

**Now:** The rotation planner is frame-perfect by default: every cancel lands on the first
frame the game allows, the way a macro plays. The **Human** button on the planner's
toolbar times it the way a person does. These settings say what that changes.
**New:**
**Notes:**

- 🐛 **It calls the button "Human"; the button says "Human timing."** One of the two must
  move (see `rotation-planner.md` §3).
- 🐛 **It calls band B "the planner's toolbar."** That makes **three** names for one
  control across the site — "the view bar" and "the view controls" in the help chapter,
  "toolbar" here. ⚓ The glossary rules it **the view bar**.
- ⚠️⚠️ **ASSEMBLED** — three fragments around `<strong>Human</strong>`, and it names a
  control (style guide §3.3), so the name must be interpolated rather than typed twice.
- ⚓ **"the way a macro plays" is the sentence that makes frame-perfect mean something.**
  Keep it.
  `src/lib/components/SettingsPanel.svelte:131,132,134`

| key                      | Where                  | Now                                                                                                                                                                                                                  | New |
| ------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `set.human.label`        | Section heading        | Human timing                                                                                                                                                                                                         |     |
| `set.human.adjust.label` | Sub-control label      | What it adjusts                                                                                                                                                                                                      |     |
| `set.human.adjust.aria`  | Its screen-reader name | What human timing adjusts                                                                                                                                                                                            |     |
| `set.human.adjust.desc`  | Under it               | Padding adds a few frames before every input the game does not buffer — a skill after a normal attack, an aimed shot, the first press after a swap. Full animations let each action finish instead of cancelling it. |     |
| `set.human.pad.label`    | Slider label           | Input padding                                                                                                                                                                                                        |     |
| `set.human.pad.desc`     | Under it               | Frames added before each unbuffered input. KQM's starting point for a human player is 10; lower it if you play tight, raise it if you don't.                                                                         |     |
| `set.human.pad.aria`     | The slider             | Input padding in frames                                                                                                                                                                                              |     |
| `set.human.show.label`   | Toggle label           | Show padding                                                                                                                                                                                                         |     |
| `set.human.show.desc`    | Under it               | Draw the padding as a hatched sliver on the active row, so you can see where the time went.                                                                                                                          |     |
| `set.ping.aria`          | The ping field         | Swap ping in milliseconds                                                                                                                                                                                            |     |

`src/lib/components/SettingsPanel.svelte:121,140,141,147,162,163,178,190,191`

⚠️ **"lower it if you play tight, raise it if you don't"** is the most conversational
sentence on the site. ⚓ It is good and it suits a settings panel — flagging it only
because it is an outlier in register, and because "play tight" is community idiom that
will not translate literally (style guide §3.8 covers the _label_ case, not this).
⚠️ **"KQM"** is 🔒 frozen. The number `10` should be a value, not copy.

---

## 3. 🐛 Your data — and a plural bug waiting to happen

| key                   | Where              | Now                                                                                                                                                                   | New |
| --------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `set.data`            | Section heading    | Your data                                                                                                                                                             |     |
| `set.backup.label`    | Sub-heading        | Backup                                                                                                                                                                |     |
| `set.backup.desc`     | Under it           | critcalc keeps nothing on a server — your roster, loadouts, and saved rotations live in this browser. Download a file to back them up or move them to another device. |     |
| `set.export`          | Button             | Export…                                                                                                                                                               |     |
| `set.restore.label`   | Sub-heading        | Restore                                                                                                                                                               |     |
| `set.restore.desc`    | Under it           | Load a backup file. This replaces everything on this device.                                                                                                          |     |
| `set.import`          | Button             | Import…                                                                                                                                                               |     |
| `set.reset.label`     | Sub-heading        | Reset saved data                                                                                                                                                      |     |
| `set.reset.all.label` | The last reset row | Everything                                                                                                                                                            |     |
| `set.reset.all.desc`  | Under it           | Clears all of the above at once. Display settings are kept.                                                                                                           |     |

`src/lib/components/SettingsPanel.svelte:210,214,215,221,227,228,231,269,291,292`

⚠️ **`Export…` / `Import…` use an ellipsis**, which the style guide bans in prose. ⚓ This
is the standard "opens a dialog" convention and is the right exception — worth recording
in the guide so it is not stripped later. ⚠️ Use the single character `…`, never three
dots.
⚓ **The backup description repeats the privacy claim** ("critcalc keeps nothing on a
server"). That repetition is deliberate and good — it is the reassurance that makes
someone willing to press Export. ⛔ Don't cut it as redundant with `/privacy`.

### 🐛 `set.import.confirm` — four fragments and three unguarded plurals

**Where:** The confirmation shown after picking a backup file.
**Now:** This backup holds **{n}** owned characters, **{n}** loadouts, and **{n}** saved
rotations. Replace your current data?
**New:**
**Notes:**

- 🐛 **Three bare plurals.** A backup with one character reads "1 owned characters". In
  English that is a small wart; in Russian (which has **three** plural forms keyed to the
  number) it is simply wrong. ⚓ This is the sheet's clearest **ICU plural** case
  (style guide §3.1).
- ⚠️⚠️ **ASSEMBLED** — four text fragments interleaved with three values. One message,
  three plural-aware placeholders.
- ⚓ **Ending on the question is right** — the counts are the evidence, the question is the
  decision. Keep that order.
  `src/lib/components/SettingsPanel.svelte:251–255`

| key                      | Where          | Now              | New |
| ------------------------ | -------------- | ---------------- | --- |
| `set.import.confirm.yes` | Confirm button | Replace & reload |     |
| `set.import.confirm.no`  | Cancel button  | Cancel           |     |

`src/lib/components/SettingsPanel.svelte:259,261`

⚠️ **"Replace & reload"** uses `&`. The style guide has no rule for ampersands in buttons
— worth one, since "Enemy DEF & RES" uses it too and "Help & FAQ" uses it a third time.
⚠️ **The reset rows** (individual data categories above "Everything") are built from a
tuple array the extractor could not read cleanly. ⚠️ They are user-facing and need their
own pass — flagged so they are not missed.
`src/lib/components/SettingsPanel.svelte:271`

---

## Added 2026-09-27 — missed by the first extraction

☐ **Not yet read.** ⚠️ Until this box is ticked, a blank `New:` in this section is **not**
an approval. These rows come from a parser-based re-run; the first pass skipped strings
inside script expressions and array literals. Keys are left to the extraction pass.

### Display — added after the sheets were written

| Where                         | Context      | Now                                                                                                                                    | New |
| ----------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `SettingsPanel.svelte:130` 🆕 | Toggle label | Coverage strips                                                                                                                        |     |
| `SettingsPanel.svelte:131` 🆕 | Under it     | Show each slotted character's coverage strip under the Rotation Planner's notation, with the parts your rotation doesn't reach dimmed. |     |

🆕 = added 2026-09-23 (`9af689a7`), the coverage round — written against the style guide.

### Slider readouts

| Where                      | Now          | New |
| -------------------------- | ------------ | --- |
| `SettingsPanel.svelte:124` | {n}ms · {n}f |     |
| `SettingsPanel.svelte:199` | {n}f · {n}s  |     |

⚠️ **`f` for frames** is our abbreviation and appears nowhere else as a unit a reader is
told about. `ms` and `s` go through `Intl` (style guide §3.7); `f` can't.

### The reset rows

The four per-category rows above "Everything" (`SettingsPanel.svelte:289`, one array):

| Name                 | Description                                             | New |
| -------------------- | ------------------------------------------------------- | --- |
| Constellation levels | Clears every saved constellation level.                 |     |
| Loadout labels       | Clears every saved weapon and artifact label.           |     |
| Roster ownership     | Clears which characters are marked owned or wishlisted. |     |
| Saved rotations      | Deletes every rotation in your save bank.               |     |

| Where                      | Context                     | Now                           | New |
| -------------------------- | --------------------------- | ----------------------------- | --- |
| `SettingsPanel.svelte:302` | Each row's button / armed   | Clear · Confirm               |     |
| `SettingsPanel.svelte:319` | Everything's button / armed | Clear all · Confirm clear all |     |

⚠️ **"save bank"** again — the overlay is called **Saved Rotations**, and this row's own
name says "Saved rotations". (The same word appears in two band A tooltips —
`document-bar.md`.)
⚠️ Three rows say "Clears", the fourth "Deletes" — probably deliberate (a rotation is a
thing you made), worth confirming.

### Backup import errors

| Where                   | Now                                            | New |
| ----------------------- | ---------------------------------------------- | --- |
| `settingsBackup.ts:187` | That file isn't valid JSON.                    |     |
| `settingsBackup.ts:191` | That doesn't look like a critcalc backup file. |     |
| `settingsBackup.ts:209` | The backup had no recognizable critcalc data.  |     |

⚠️ "critcalc" is 🔒 the brand. ⚠️ "valid JSON" assumes the reader knows what JSON is —
they chose a file, so perhaps; the other two say the same thing in plain words.

---

## Added 2026-09-30 — the playback round: "Playback sound"

☐ **Not yet read.** ⚠️ Until this box is ticked, a blank `New:` in this section is **not**
an approval. A whole new section of the modal, shipped on `main` (`6f3195ec`) with
Claude's first-cut strings — condensed once already at ⚓ Nate's ask ("condense and combine
things, simplify descriptions"). Keys are left to the extraction pass. Line numbers are
`SettingsPanel.svelte` unless named. ⚠️ Rows HIDE when they cannot be heard: nothing
below Sound when it is Off; no Voice or Notes under the metronome.

| Where                      | Context                         | Now                                                                                                                                         | New |
| -------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `:253`                     | Section kicker                  | Playback sound                                                                                                                              |     |
| `:254`                     | Lede                            | **Play** on the planner's toolbar counts you in, then plays a note at every press, so you can follow a rotation with your eyes on the game. |     |
| `:261`                     | Row name                        | Sound                                                                                                                                       |     |
| `:262`                     | Under it                        | The metronome is one pitch. Melodic gives attacks, skills and bursts their own notes.                                                       |     |
| `:273` · `tones.ts:73`     | Its choices                     | Off · Metronome · Melodic                                                                                                                   |     |
| `:293` / `:298`            | Preview button, name / label    | Preview the sound / Preview                                                                                                                 |     |
| `:307` · `tones.ts:63`     | Row name, choices               | Voice — Marimba · Bell · Vibraphone · Pipe · Glass                                                                                          |     |
| `:327`                     | Row name                        | Notes                                                                                                                                       |     |
| `:328`                     | Under it                        | Which note each input gets, then which three notes. Every set comes from one pentatonic scale, so overlapping notes never clash.            |     |
| `:336` · `tones.ts:138`    | First picker, name and choices  | Note order — Weighty · Skill up · Rising                                                                                                    |     |
| `tones.ts:144` `orderHint` | Each order's tooltip (built)    | Burst low · skill middle · attacks high (and the other two orders' spellings)                                                               |     |
| `:352` · `tones.ts:185`    | Second picker, name and choices | Note set — Open · Anchor · Lantern · Meadow                                                                                                 |     |
| `tones.ts` `noteSetNotes`  | Each set's tooltip (built)      | A · B · E (etc.)                                                                                                                            |     |
| `:372` / `:373`            | Row name / under it             | Swap / A soft hum while the next character comes in.                                                                                        |     |
| `:375` · `tones.ts:205`    | Its choices                     | Off · Low · Fifth · Rise                                                                                                                    |     |
| `:393` / `:408`            | Row name / slider's name        | Volume / Playback volume                                                                                                                    |     |

⚠️ **"Weighty", "Skill up", "Open", "Anchor", "Lantern", "Meadow"** are Claude's coinages
for things that have no standard name — their only job is to be told apart by ear, and
the tooltips carry the meaning. ⚠️ `orderHint` BUILDS its sentence from parts ("attacks",
"skill", "burst", "low/middle/high", " · ") — word order will not survive translation;
it wants one string per order.
⚠️ **Note names (A B D E F♯)** — letter names are not universal (do-re-mi in FR/ES/IT);
a 🏷 or a locale-aware table.
⚠️ **"skills" / "bursts"** — check against the glossary's names for E and Q.
⚠️ The Sound row's **Off** also silences the count-in — the lede promises one. Worth
saying, or trusting the reader.
