# Worksheet — The document bar

**Surface:** band A — the rotation tabs, Save/Load/Share, the Saved Rotations overlay,
and the tabs-full dialog. Identical in the Rotation Planner and the Team Builder, because
they edit one working team.
**Pass:** 1 (Nate leads) · **Strings:** 33 · **Guide:** `docs/text/style-guide.md` ·
**Glossary:** `docs/text/glossary.md`

---

## 1. The bar's actions

| key                      | Where                          | Now                     | New |
| ------------------------ | ------------------------------ | ----------------------- | --- |
| `doc.load.title`         | Load button, hover tooltip     | Open a saved rotation   |     |
| `doc.load`               | Load button                    | Load                    |     |
| `doc.share.link`         | Share menu                     | Copy link               |     |
| `doc.share.kqm`          | Share menu                     | Copy KQM notation       |     |
| `doc.share.png.copy`     | Share menu                     | Copy timeline image     |     |
| `doc.share.png.download` | Share menu                     | Download timeline image |     |
| `doc.save.new`           | Save menu                      | Save as new             |     |
| `doc.reset`              | Save menu                      | Reset this rotation     |     |
| `doc.closeall`           | Save menu                      | Close all rotations     |     |
| `doc.reset.confirm`      | The Reset button, second press | Reset?                  |     |
| `doc.tab.new`            | ＋ beside the tabs             | New rotation            |     |
| `doc.tab.close`          | ✕ on a tab                     | Close {tab.label}       |     |

`src/lib/components/DocumentActions.svelte:65,72,85,98,109,120,140,153,165,184` ·
`DocumentTabs.svelte:147,158`

⚠️ **Two confirm patterns exist and they should match.** Reset asks **"Reset?"**; Delete
in the Saved Rotations overlay asks **"Confirm?"** (§2). One of them is the house form.
⚠️ `Close {tab.label}` interpolates a user-typed tab name — fine as a message, but it
means the locale file needs the variable documented (style guide §3.5).
⚠️ **tight** — every label here folds to its mark alone below 40rem, so the word is the
tooltip at narrow widths. A longer word costs nothing at narrow, everything at medium.

---

## 2. The Saved Rotations overlay

### 🐛 `doc.saved.title` — the overlay's heading

**Where:** Top of the overlay. Also referred to by name from the tabs-full dialog (§3).
**Now:** Saved Rotations
**New:**
**Notes:** 🐛 **Title Case, where the whole site is sentence case.** It is the only
Title Case heading found in the survey, and it appears **three times** — the heading, the
dialog's reference to it, and the dialog's button. The style guide says sentence case;
either the guide gets an exception for this one proper-noun-ish surface, or all three
become "Saved rotations." ⚓ Your call, but they must agree.
⚠️ Note the overlay's `aria-label` already says **"Saved rotations"** (sentence case), so
today the announced name and the visible name differ.
`src/lib/components/SavedNotationsOverlay.svelte:109,111`

### ⚠️ `doc.saved.empty.*` — the empty state, currently THREE strings

**Where:** The overlay, when nothing is saved yet.
**Now (title):** No saved rotations yet.
**Now (hint):** Write a rotation and click **Save** to bank it here.
**New (title):**
**New (hint):**
**Notes:**

- ⚠️⚠️ **ASSEMBLED** — the hint is three fragments in the markup: `Write a rotation and
click` + `<strong>Save</strong>` + `to bank it here.` This is the exact case style guide
  §3.1 exists for. In Japanese the verb goes last and this cannot be reassembled in
  order. It must become one message with the control name interpolated.
- ⚠️ **"bank it here" is an idiom** and will not survive a literal translation. It is
  also the only place on the site that calls saving "banking". ⛔ Not in the glossary; if
  you keep it, it should appear more than once, and if you don't, this is the row.
- ⚠️ `Save` here names a control (style guide §3.3) — in six locales the button moves and
  this sentence has to move with it.
  `src/lib/components/SavedNotationsOverlay.svelte:119–121`

### Per-entry controls

| key                        | Where                    | Now                 | New |
| -------------------------- | ------------------------ | ------------------- | --- |
| `doc.saved.rename.title`   | Pencil on a saved entry  | Rename              |     |
| `doc.saved.rename.aria`    | Same, screen-reader name | Rename {entry.name} |     |
| `doc.saved.newtab.title`   | Tooltip                  | Open in a new tab   |     |
| `doc.saved.newtab`         | Button label             | New tab             |     |
| `doc.saved.load`           | Button label             | Load                |     |
| `doc.saved.delete`         | Button label             | Delete              |     |
| `doc.saved.delete.aria`    | Same, screen-reader name | Delete {entry.name} |     |
| `doc.saved.delete.confirm` | Delete, second press     | Confirm?            |     |
| `doc.saved.close.aria`     | ✕, and the backdrop      | Close               |     |

`src/lib/components/SavedNotationsOverlay.svelte:104,112,191,192,215,224,230,236`

⚠️ **"New tab" is ambiguous out of context** — it reads as _browser_ tab and means
_rotation_ tab. The tooltip says "Open in a new tab" and inherits the same ambiguity.
⚠️ `Close` is used for both the ✕ and the invisible backdrop, so a screen reader finds
two identical "Close" controls. Same meaning, so ⚓ one key — but worth knowing.

---

## 3. ⚠️ The tabs-full dialog — four fragments in one sentence

### `doc.tabsfull.*`

**Where:** Opens when a shared `?r=` link arrives and every tab is already in use.
**Now (title):** All your tabs are in use
**Now (body):** Nothing you had open was replaced. The shared rotation is in
**Saved Rotations**, as **{name}** — close a tab and load it there whenever you want it.
**Now (dismiss):** Got it
**Now (action):** Open Saved Rotations
**New (title):**
**New (body):**
**New (dismiss):**
**New (action):**
**Notes:**

- ⚠️⚠️ **ASSEMBLED, worst case on the site** — the body is five fragments around two
  `<strong>`s and an interpolated name. One message, two placeholders.
- ⚓ **The copy itself is good and does the important thing first** — "Nothing you had
  open was replaced" answers the panic before explaining the mechanism. Keep that order.
- ⚠️ "Saved Rotations" appears twice more here; whatever §2 decides applies to both.
- ⚠️ **tight** — it is an `alertdialog` sized to its content, so growth is fine
  vertically. No cap.
  `src/lib/components/TabsFullDialog.svelte:58–71`

---

## Added 2026-09-27 — missed by the first extraction

☐ **Not yet read.** ⚠️ Until this box is ticked, a blank `New:` in this section is **not**
an approval. These rows come from a parser-based re-run; the first pass skipped strings
inside script expressions and some attributes. Keys are left to the extraction pass.

### Save and the ⋯ menu

| Where                           | Context                              | Now                                                                 | New |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------------------- | --- |
| `DocumentActions.svelte:72`     | Save button, when the tab is linked  | Save changes                                                        |     |
| `DocumentActions.svelte:67`     | Its tooltip                          | Save changes to "{tab}"                                             |     |
| `DocumentActions.svelte:68`     | Save tooltip, unlinked               | Save this team and rotation to your bank                            |     |
| `DocumentActions.svelte:137`    | ⋯ menu, aria                         | More rotation actions                                               |     |
| `DocumentActions.svelte:173` 🆕 | Reset, armed (second click confirms) | Reset this rotation?                                                |     |
| `DocumentActions.svelte:161` 🆕 | Its tooltip, armed                   | Confirm: clear this rotation's notation and unlink it from the bank |     |
| `DocumentActions.svelte:191` 🆕 | Close all, armed                     | Close all rotations?                                                |     |
| `DocumentActions.svelte:180` 🆕 | Its tooltip, armed                   | Confirm: close every rotation tab                                   |     |

🆕 = added 2026-09-24 (`e46d5df1`), after the sheets were written.
⚠️ **"bank"** appears in two tooltips and nowhere a reader can see — the overlay is called
**Saved Rotations**. ⚓ Glossary: one name per thing.
⚠️ The typographic quotes in `Save changes to "{tab}"` are English punctuation — German
opens with „ and French uses « ».

### Notices (every tool's toasts land in band A's notice slot)

| Where                               | Now                                  | New |
| ----------------------------------- | ------------------------------------ | --- |
| `documentBar.svelte.ts:204`         | Saved                                |     |
| `documentBar.svelte.ts:223`         | Saved as new                         |     |
| `documentBar.svelte.ts:285`         | Link copied                          |     |
| `documentBar.svelte.ts:287`         | Share failed                         |     |
| `documentBar.svelte.ts:294`         | KQM copied                           |     |
| `documentBar.svelte.ts:294`         | Copy failed                          |     |
| `RotationTimeline.svelte:1648`      | Image copied                         |     |
| `RotationTimeline.svelte:1650`      | Image saved                          |     |
| `RotationTimeline.svelte:1651,1655` | Export failed                        |     |
| `rotation-planner/+page.svelte:73`  | Loaded shared rotation               |     |
| `rotation-planner/+page.svelte:192` | Invalid share link                   |     |
| `rotation-planner/+page.svelte:210` | Team loaded                          |     |
| `rotation-planner/+page.svelte:210` | Tabs full — close one to load a team |     |

⚠️ **"Copy failed" pairs with "KQM copied" but says less** — which copy? And "Share failed"
/ "Export failed" give no next step, where "Tabs full — close one to load a team" does.
⚠️ **"KQM" is 🔒** but here it stands for "the KQM notation", not the organization.

### Default names

| Where                                    | Now                           | New |
| ---------------------------------------- | ----------------------------- | --- |
| `rotationTabs.svelte.ts:161,257,355,366` | Tab {n}                       |     |
| `rotationTabs.svelte.ts:470`             | Imported team                 |     |
| `documentBar.svelte.ts:58`               | {name} copy · {name} copy {n} |     |

🐛 **"copy" is parsed back out with a regex** (`/ copy(?: \d+)?$/`) so a second fork numbers
rather than stacks. Once the word translates, the regex must translate with it — or the
suffix must stop being a word. A code fix at extraction time.
⚠️ These names are **stored in the reader's data**, so a default written in one locale
stays in that locale after the reader switches language.
