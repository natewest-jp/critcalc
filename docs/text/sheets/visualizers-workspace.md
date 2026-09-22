# Worksheet — Visualizers workspace

**Surface:** the Visualizers' own chrome — the workspace title, the lineup control, the
per-tile picker and its reset/share actions, and the eight instrument names.
**Pass:** 1 (Nate leads) · **Strings:** 18 · **Guide:** `docs/text/style-guide.md` ·
**Glossary:** `docs/text/glossary.md`

⚠️ The eight instruments' own controls are **not** here — each has its own sheet.

---

## 1. The workspace bar

| key               | Where                                | Now               | New |
| ----------------- | ------------------------------------ | ----------------- | --- |
| `vz.title`        | Band A, left — the tool's own kicker | Workspace         |     |
| `vz.slots.aria`   | The lineup segmented control         | Instruments shown |     |
| `vz.reset.layout` | Band B — restores the default lineup | Reset layout      |     |

`src/routes/(scene)/(tools)/visualizers/+page.svelte:204,212,239`

⚠️ **"Reset layout" and the tile's "Defaults" (§2) are deliberately different things** and
the words were chosen to say so: the bar's button resets the **lineup** (which
instruments, how many), the tile's resets **that instrument's controls**. ⛔ Don't
converge them in a tidy-up — the split is the whole point of the rename that produced it.
⚠️ **tight** — band B folds its labels to marks at narrow widths; the word is the tooltip
there.

🗒️ The lineup options include an **"Auto"** resting state (a value, not a label in the
markup). ⚠️ It is user-visible and easy to miss in extraction — listed here so it is not
left in English.

---

## 2. A tile's own controls

| key                      | Where                                    | Now                                                      | New |
| ------------------------ | ---------------------------------------- | -------------------------------------------------------- | --- |
| `vz.tile.picker.aria`    | The instrument dropdown, as a listbox    | Choose instrument                                        |     |
| `vz.tile.slot.badge`     | On an instrument already shown elsewhere | Slot {at + 1}                                            |     |
| `vz.tile.defaults`       | Resets this instrument's controls        | Defaults                                                 |     |
| `vz.tile.defaults.title` | Its tooltip                              | Reset this instrument's controls to their defaults       |     |
| `vz.tile.share`          | Copies a deep link to this instrument    | Share                                                    |     |
| `vz.tile.share.done`     | The same button, just after a copy       | Copied                                                   |     |
| `vz.tile.share.title`    | Its tooltip                              | Copy a link that reopens this instrument as it looks now |     |

`src/routes/(scene)/(tools)/visualizers/+page.svelte:269,278` ·
`InstrumentPicker.svelte:135,160`

⚠️ **`Slot {at + 1}` is an index rendered as a word plus a number** — fine as a message,
but note the badge means _"this instrument is currently in slot N; picking it here will
swap the two."_ ⚓ That is a lot of meaning in eight characters and it is carried entirely
by a swap mark beside it. Worth checking it still reads once translated.
⚠️ **`Share` → `Copied` is a transient label swap on one button.** Both strings must stay
close in length or the button resizes mid-interaction. **tight, both.**

---

## 3. The eight instrument names

These are **ours** — we named them, so nothing external defines them.

| key                | Now             | New |
| ------------------ | --------------- | --- |
| `vz.inst.crit`     | Crit Heatmap    |     |
| `vz.inst.icd`      | ICD Timeline    |     |
| `vz.inst.artifact` | Artifact Rolls  |     |
| `vz.inst.gauge`    | Gauge Explorer  |     |
| `vz.inst.reaction` | Reaction Curves |     |
| `vz.inst.defres`   | Enemy DEF & RES |     |
| `vz.inst.wish`     | Wish Odds       |     |
| `vz.inst.anatomy`  | Damage Anatomy  |     |

`src/routes/(scene)/(tools)/visualizers/lib/workspace.ts:17–24`

⚠️⚠️ **These are 🏷 mixed, and each one differently.** Every name pairs a frozen term with
a translatable one:

- **ICD**, **DEF**, **RES** are 🔒 frozen jargon/stat abbreviations — the letters stay.
- **Crit** is a game term; **Heatmap**, **Timeline**, **Rolls**, **Explorer**, **Curves**,
  **Odds**, **Anatomy** are ours and translate.
- **Wish** and **Artifact** are game nouns and should take genshin-db's word for them.

⚓ So a translator needs the _parts_ marked, not the name as a blob. This is the clearest
case on the site for the glossary's 🏷 rule, and it is worth getting right because these
eight names appear in the picker, the tile header, the help chapter and the share link's
title.
⚠️ **tight** — they are the picker's rows and the tile headers, and **"Enemy DEF & RES"**
is already the longest. ⛔ Don't lengthen any of them without checking the picker at
360px.
⚠️ **Title Case throughout**, which disagrees with the site's sentence-case rule. ⚓ These
read as proper names of instruments rather than as headings, so Title Case is defensible
here in a way `Saved Rotations` (see `document-bar.md` §2) is not — but the two should be
decided together.
