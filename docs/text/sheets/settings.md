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
