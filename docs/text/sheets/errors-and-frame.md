# Worksheet — Errors and the tool frame

**Surface:** the 404 / error page, the in-tool render boundary, and the shared tool-frame
chrome (the aside drawer's close, the tools landmark).
**Pass:** 1 (Nate leads) · **Strings:** 14 · **Guide:** `docs/text/style-guide.md`

⚠️ **Two error surfaces, and they catch different things.** `+error.svelte` handles
SvelteKit's routing failures — chiefly a 404 from a mistyped or truncated link — and
renders outside the scene. The `<svelte:boundary>`s (one around the tool page, one around
the menu state's sections) catch a throw during render, which `+error.svelte` never sees. ⛔ They are not interchangeable and
their copy should not be merged.

---

## 1. The 404

### `error.404.title` / `error.404.lede`

**Where:** Any unmatched URL. ⚠️ This is the surface a **truncated shared link** lands on,
which is the predicted top cause — `?r=` links are long and chat apps trim them.
**Now (title):** We couldn't find that page.
**Now (lede):** The address may be mistyped — or, if you followed a shared link, it may
have been cut short on its way here. Share links are long, and chat apps sometimes trim
them.
**New (title):**
**New (lede):**
**Notes:** ⚓ **The lede names the likely cause instead of blaming the reader, and that is
the right move** — most people arriving here did nothing wrong. Keep that.
⚠️ Two em dashes' worth of clause-hanging in one sentence (style guide §3.4). It reads
well in English; it is the kind of sentence a CJK translator will have to restructure.
Worth simplifying _because_ it is high-traffic, not because it is bad.
`src/routes/+error.svelte:39–43`

### `error.generic.title` / `error.generic.lede`

**Where:** Any non-404 routing error.
**Now (title):** Something went wrong.
**Now (lede):** That's on us, not on you. Reloading often clears it. If it keeps
happening, telling us what you were doing is genuinely useful — critcalc is one person's
project and reports are how problems get found.
**New (title):**
**New (lede):**
**Notes:**

- ⚠️⚠️ **This sentence uses two speakers at once** — "that's on **us**", "telling **us**",
  then "**critcalc** is **one person's** project." Style guide §1.4 gives each speaker a
  job, and this is the clearest place the mixture shows. ⚓ It is also, arguably, the one
  place the mixture is _deliberate_: "us" is warm, "one person's project" is the honest
  fact that makes the ask land. ✅ **Now decided:** "we", never "I", and it is a genuine
  plural — Claude wired the site and contributors are welcome (style guide §1.4). So the
  mixture stays, with each speaker doing its own job.
- ↻🐛 **REVERSED.** This bullet used to read: _"'reports are how problems get found' is the
  best sentence on the site for turning an error into a contribution. ⛔ Don't lose it."_
  ⛔ **Withdrawn — it is the headline example of §1.3c.** It explains to the reader that
  reporting a bug helps us find bugs, which they already knew, and telling someone what
  they already know implies they did not.
- ⚠️ **"genuinely useful" in the same sentence does the same job** — asserting the value of
  the action instead of just offering it.
- ⚓ **What to keep is the SPECIFIC half:** "critcalc is one person's project" earns the
  ask by admitting something. ⚓ And the strongest replacement for the explaining half is a
  **non-obvious instruction** — what to include in a report (the share link) does more work
  than a sentence about why reports matter.
  `src/routes/+error.svelte:45–50`

### 404 navigation

| key                 | Where                                | Now                 | New |
| ------------------- | ------------------------------------ | ------------------- | --- |
| `error.back`        | Primary button, both variants        | Back to critcalc    |     |
| `error.report`      | Secondary button, non-404 only       | Report a problem    |     |
| `error.tools.label` | Above the three tool links, 404 only | Looking for a tool? |     |
| `error.tools.aria`  | That nav's landmark                  | Tools               |     |

`src/routes/+error.svelte:54,56,61,62`

⚠️ **"Report a problem" here and "Report this" in the render boundary (§2) are the same
action with two labels.** One of them is the house form. ⚓ Whichever you pick becomes the
label on the feedback channel when it lands (roadmap §6), so it is worth choosing once.

---

## 2. The in-tool render boundary

### `boundary.title` / `boundary.body`

**Where:** Inside a tool, when a component throws during render. ⚓ **Scoped to the tool
surface on purpose** — the chrome, the scene and the bench survive, so the reader can
navigate away. That is most of what made the old blank page bad, and the copy leans on it.
**Now (title):** This tool ran into a problem.
**Now (body):** The rest of the site is fine, and your saved rotations and lineups are
untouched.
**New (title):**
**New (body):**
**Notes:** ⚓ **"Your saved rotations are untouched" is the sentence that matters.** The
first thing a user fears here is losing work. ⛔ Keep it, and keep it last — it is the
line they leave with.
⚓ No directions (Nate 2026-10-30): the tool links and Try again are on screen, so naming
them explained what the reader can see (style guide §1.3c). The old "switch tools above"
was also wrong below 47.5rem, where the tool links fold into ☰.
`src/routes/(scene)/(tools)/+layout.svelte` (the `failed` snippet)

| key                  | Where                              | Now         | New |
| -------------------- | ---------------------------------- | ----------- | --- |
| `boundary.retry`     | Primary button                     | Try again   |     |
| `boundary.report`    | Secondary button                   | Report this |     |
| `frame.tools.aria`   | The tool switcher's landmark       | Tools       |     |
| `frame.drawer.close` | ✕ on the aside drawer, below 54rem | Close       |     |

`src/lib/components/RenderCrash.svelte` ·
`src/lib/components/ToolColumns.svelte:111`

### `boundary.section.title` / `boundary.section.body`

**Where:** Inside the menu state (Roster, Teams, Library, Profile, Settings, Trash, Help,
About), when a section throws during render. The top bar, the sidebar and the page head
survive, so the reader can open another section. Shares `boundary.retry` and
`boundary.report` with the tool boundary.
**Now (title):** This section ran into a problem.
**Now (body):** The rest of the site is fine, and your saved work is untouched.
**New (title):**
**New (body):**
**Notes:** ⚓ Nate 2026-10-30, matching the tool boundary's body. No directions: the
sidebar (or the Menu button on a phone) and Try again are on screen. "saved work" rather than "rotations and
lineups": the roster, teams and profile live here too. ⚠️ An unsaved profile form is lost
in the crash, which "saved" covers.
`src/lib/components/MenuState.svelte` (the `failed` snippet)

---

## 3. 🗒️ Owed by this round, not yet written

Three surfaces have no copy at all yet and land here rather than in a later pass:

- **The BETA explainer** (roadmap §8) — what beta means, pointed at the **surface** and
  ⛔ never the **data**. The tag currently links to `/contribute` as a stand-in.
- **The feedback channel copy** (roadmap §6) — `/contribute` carries a live TODO and
  correctly promises nothing. Blocked on the Google Form ID.
- **The `/privacy` analytics paragraph** — only if analytics ships. The page currently
  claims no analytics, truthfully.

⚠️ All three are **new user-facing English**, so they should be written against the style
guide from the start rather than joining the backlog they were meant to be ahead of.
