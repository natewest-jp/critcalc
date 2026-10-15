# Static pages inventory (2026-10-14)

**What this is:** the read-only preparation for the static-pages rewrite, the last of the
roadmap's three Claude-solo items (memory `project_launch_roadmap`, "Final stretch plan" ③).
The plan: Nate and Claude agree a section list from this document, then Claude proposes
copy line by line (memory `feedback_copy_proposed_first`). ⛔ No prose is rewritten here.

**Checked against:** `docs/text/style-guide.md`, `docs/text/glossary.md`, memory
`feedback_planner_not_we`, `docs/bench-portrait-round-2026-10-13.md` §4,
`docs/team-builder-lineups-design.md` §7, §10, §11, and the launch roadmap §6–§8 and §13.

**Owner column:** `clear` means stale, incorrect, or a plain glossary or style-guide
violation, which Nate has authorized Claude to fix directly. `needs-nate` means the
wording or structure is a real question for him.

**Routes in scope** (all render through `HelpAreaShell` in the `(scene)/(pages)` layout,
except Settings):

| Route               | Component                                                          | Area tab   |
| ------------------- | ------------------------------------------------------------------ | ---------- |
| `/about`            | `src/lib/help/chapters/About.svelte`                               | About      |
| `/contribute`       | `src/lib/help/chapters/Contribute.svelte`                          | About      |
| `/privacy`          | `src/lib/help/chapters/Privacy.svelte`                             | About      |
| `/coverage`         | `src/lib/components/CoverageList.svelte` (bare)                    | About      |
| `/help`             | `src/lib/help/chapters/Faq.svelte`                                 | Help       |
| `/help/builder`     | `src/lib/help/chapters/TeamBuilder.svelte`                         | Help       |
| `/help/planner`     | `src/lib/help/chapters/RotationPlanner.svelte`                     | Help       |
| `/help/visualizers` | `src/lib/help/chapters/Visualizers.svelte`                         | Help       |
| `/settings`         | `src/lib/components/SettingsPanel.svelte` + an own `<h1>`          | none       |
| `/faq`              | `+page.ts` 308 → `/help`                                           | (redirect) |
| `/` landing         | `src/routes/(scene)/+page.svelte`, `$lib/landing/announcements.ts` | (none)     |

Page meta for every route is in `src/lib/seo.ts:74–143`, covered per page below.

---

## 0. Cross-cutting findings

These recur on several pages. Fix them once, everywhere, during the rewrite.

### 0.1 Launch prerequisites that do not exist yet (evidence: grep)

- **Feedback channel.** No Google Form URL appears anywhere (`grep -rn "docs.google.com/forms\|forms.gle" src static` finds nothing). Five "report" entry points all land on `/contribute`, and that page says the channel "is being set up" (`Contribute.svelte:67–71`):
  - `SiteChrome.svelte:59`: the BETA tag
  - `+error.svelte:69`: "Report a problem"
  - `(tools)/+layout.svelte:850`: the render boundary's "Report this"
  - `Faq.svelte:70`: "let us know"
  - `Contribute.svelte:54`: the "Report something wrong" section
- **Cloudflare Web Analytics.** It is not wired: `grep -rn cloudflareinsights src static` finds nothing. Until it is, Privacy's "no analytics" is still true. ⚠️ Privacy, Contribute and `seo.ts` must change in the same deploy that adds the beacon, and Privacy:51 promises that the page changes **before** the beacon goes live.
- **LICENSE.** There is no LICENSE file in the repo root (`ls LICENSE*` matches nothing), and no page says what the code or data may be reused for.
- **The "what beta means here" note.** It does not exist. The BETA tag carries `title="What beta means here"` and links to `/contribute` (`SiteChrome.svelte:59`), but Contribute has no such section. The tooltip promises content the page does not have. `clear` that the target needs the note; `needs-nate` on its content (roadmap §8: the note is about the SURFACE, never the data; ⛔ no end condition, per Nate 2026-09-22).
- **Queued FAQ entry**: "Why is my skill recast a few frames later?" (roadmap §13, ⚓ Nate 2026-08-15). It is not in `Faq.svelte`. The facts: `Ability.cooldownStartDelay` comes from gcsim's `SetCDWithDelay` (Nahida's 11), 124 abilities carry it, and the Nightsoul case is that the cooldown starts when the stance ENDS (Xilonen 9s + 7s). Write it as "the gap is real," not as an apology.

### 0.2 The retired creed is still in the copy (style guide §1.3, §1.3a): `clear`

The style guide keeps the idea in exactly two places, About (once) and the FAQ question that asks it. Everywhere else it goes.

| Site                       | Text                                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `About.svelte:38–40`       | "deliberately **visualizes mechanics, never verdicts**. There are no damage totals, no tier lists, and no 'synergy scores.' … so the judgment stays yours" |
| `Faq.svelte:20–21, 26–27`  | "visualize … instead of reducing them to a single score" · "No, by design. … mechanics, not verdicts … the judgment stays yours"                           |
| `RotationPlanner.svelte:9` | "it never computes damage numbers"                                                                                                                         |
| `TeamBuilder.svelte:83`    | "Facts, never a score." (the whole paragraph is retired anyway, see §5)                                                                                    |
| `seo.ts:78`                | "Mechanics made visible — no tier lists, no verdicts."                                                                                                     |
| `seo.ts:127`               | "visualize mechanics rather than reduce them to a score"                                                                                                   |
| `seo.ts:55`                | OG alt: "tools for visualizing mechanics" (mild; `needs-nate`)                                                                                             |

⚠️ The FAQ answer is also **partly incorrect** now. Damage Breakdown ends in a number for additive, transformative and Lunar/Stellar damage (`Visualizers.svelte:117–118`), so "no damage totals" is no longer literally true.

### 0.3 Limits stated as "we" (memory `feedback_planner_not_we`): `clear`

A limit belongs to the tool ("The Rotation Planner doesn't…"). "We" stays only for a choice that is not a limit.

- `RotationPlanner.svelte:36`: "a token we don't simulate"
- `RotationPlanner.svelte:37`: "we took it"
- `RotationPlanner.svelte:137–138`: "We draw these … what they hit for is not modelled"
- `RotationPlanner.svelte:146–147`: "We assume you are standing in the field; we do not model walking out of it"
- `RotationPlanner.svelte:159–160`: "Where we do not have a measured gauge strength … we use 1U". The first half is a limit; "we use 1U and mark it" is the style guide's own example of an acceptable "we".
- `TeamBuilder.svelte:78`: "which we show rather than score" (the paragraph is retired anyway)

### 0.4 British spellings (glossary §4, US English everywhere): `clear`

- About.svelte:46 `labelled`
- RotationPlanner.svelte:45–46 `modelling` ×2, :78 `cancelling`, :117 `labelled`, :138/:159/:192 `modelled`, :151 `neighbour`
- TeamBuilder.svelte:71 `modelled`
- Visualizers.svelte:144 `coloured`
- SettingsPanel.svelte:177 `cancelling`

(Every other hit in these files is in a code comment.)

### 0.5 House phrases and glossary terms: `clear`

- The house phrase is "**an unofficial fan project**" (glossary §4a). About.svelte:94 and Faq.svelte:32 still say "an independent, non-commercial fan project". The footer (`SiteFooter.svelte:25`) already uses the house phrase.
- The view bar is **the view bar**. RotationPlanner.svelte:191 says "the view controls", SettingsPanel.svelte:167 and :255 say "the planner's toolbar".
- "**plan**" is retired in favour of **tab** (holding a **rotation**): RotationPlanner.svelte:181.
- "**resistance shred**" should be **RES shred**: seo.ts:89. The glossary flags this one as first priority because it shows on the social card.
- The aura lane's halves are named "**the gauge lines**" and "**the reaction spawns**" (glossary §1a). RotationPlanner.svelte:110–129 still says "one plot" and "their own strip".
- A UI control named in prose is **bold and matches its label**. SettingsPanel.svelte:167 calls the control "**Human**", but its label is "Human timing" (`planner/+page.svelte:586`).

### 0.6 Data does not match the copy: saved lineups, tabs and the workspace escape Backup and Reset

This is a code finding, not a text one. The copy promises more than the code does, so either the code changes or the copy narrows. `needs-nate` on which.

- `settingsBackup.ts:20–26` `BACKUP_KEYS` holds siteSettings, constellations, ownership, loadout and savedNotations. It leaves out `critcalc:savedBoards` (the Library's saved lineups, `stores.ts:144`), `critcalc:boards` (open lineup tabs), `critcalc:rotationTabs` and `critcalc:vizWorkspace`. Its own comment says it "must stay in sync with … stores.ts". `savedBoards` arrived with `c6a079de` (the board model), and the backup file was last touched before that (`627c7de7`).
- `sanitizeSiteSettings` (`settingsBackup.ts:69–100`) also drops every setting added since human timing: sound, `showCoverageStrips`, `timelineLayers`.
- `SettingsPanel.svelte:40–45` `clearEverything` and the Reset list (:477) never clear saved lineups.
- **Copy that over-promises as a result:**
  - `Faq.svelte:49–52`: "export a backup … that is also the only way it travels" (saved lineups cannot travel at all)
  - `Privacy.svelte:20–23`: "You can wipe everything at any time from the same place"
  - `SettingsPanel.svelte:422–424`: "your roster, loadouts, and saved rotations"
  - SettingsPanel.svelte:499: "Clears all of the above"

### 0.7 Other surfaces I passed through (out of this inventory's scope, noted for the sweep)

- `LibraryOverlay.svelte:762` uses the kicker "**Boards**". The glossary rules **Lineup** on screen and keeps `board` for code only. `clear`.
- `areas.ts:76` has a code comment that says "About's three"; there are four now. A comment nit only.

---

## 1. Landing (`/`)

**Purpose today:** the front door. Three cards and a status line, with no pitch sentence of its own.

**Copy now:**

- The cards (`+page.svelte:46–68`) show a kicker with the tool's name (Team Builder · Rotation Planner · Visualizers) over the poetic name (Astrolabe · Ephemeris · Observatory). The names are ruled (glossary §1).
- The announcement (`announcements.ts:27–40`):
  - Headline: "Data current to Genshin Impact 7.1"
  - Fine print, derived: "Alyosha, Lohen, Sandrone, Vesna, and Vodyanitsa in the works". It links to `/coverage` and expires 2026-11-04.
- Footer (`SiteFooter.svelte:24–27`): "© {year} critcalc.app — an unofficial fan project, not affiliated with or endorsed by HoYoverse. Genshin Impact and all related trademarks and assets are © HoYoverse."
- Screen-reader labels: "critcalc tools", "Announcements".
- Meta (`seo.ts:76–78`): "Three tools for seeing how Genshin works: … Mechanics made visible — no tier lists, no verdicts."

**Stale or incorrect:**

- seo.ts:78 has the creed and its rule-of-three tail. `clear` to cut the tail; `needs-nate` on the sentence that replaces it.
- seo.ts:78 "a capability-faceted team builder" undersells the lineups shape. `needs-nate`.

**Missing for launch:**

- The footer links nowhere: no Privacy and no License, which is where most sites put them. `needs-nate`.

**Proposed sections:** none. The landing's copy is pass 1, Nate's (`docs/text/sheets/landing.md`). The rewrite only touches `seo.ts:78` and, if Nate wants them, footer links.

---

## 2. About (`/about`)

**Purpose today:** what critcalc is, the tools, the credits and the fan-project disclaimer.

**Sections now:**

- Lede: "a small set of theorycrafting tools … _visualize_ the mechanics … rather than reduce everything to a single number."
- **The three tools**: one bullet per tool.
- **The philosophy**: the creed, KQM terminology, and "timing only from gcsim or kit text … not curated is labelled."
- **Credits**: gcsim, KQM, genshin-db, Lunaris.moe, Stygian.moe, the Fandom wiki, plus "support those projects" → `/contribute`.
- **A fan project**: the disclaimer.

**Stale or incorrect:**

| Line  | Says                                                                              | Is now                                                                                                                                                | Owner                                                  |
| ----- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 19–21 | Team Builder: "… and compare their timings side by side"                          | Compare retired 2026-10-13 into swap mode. The Builder builds **lineups** of teams with each team's capabilities (lineups design §11, §11.6 item 20). | clear                                                  |
| 28–30 | Visualizers names 6 of 8: crit, application, artifact, wishing, gauges, reactions | Damage Breakdown and Enemy RES & DEF are missing (`visualizers/lib/workspace.ts` INSTRUMENTS)                                                         | clear                                                  |
| 38–40 | the creed + the triad + "the judgment stays yours"                                | §0.2                                                                                                                                                  | clear (cut) · needs-nate (the one sentence that stays) |
| 46    | `labelled`                                                                        | `labeled`                                                                                                                                             | clear                                                  |
| 84–88 | "the best thing you can do is …"                                                  | flagged as preachy in style guide §1.3c                                                                                                               | clear                                                  |
| 94    | "independent, non-commercial fan project"                                         | house phrase "an unofficial fan project" (§0.5)                                                                                                       | clear                                                  |

**Missing:**

- Credits leave out sources the help chapters already cite: **GGanalysis** (`Visualizers.svelte:179`, the Wish model) and **Genshin Optimizer** (`Visualizers.svelte:155`, the reshape reading). Credits for the icon set (Lucide, ISC) and the fonts (IBM Plex, Bitter) are a `needs-nate` question.
- **Who makes it.** The error page says "one person's project" (`+error.svelte:64`), and the style guide holds that phrase up as the site's most personal one (§1.3a). About has no equivalent. `needs-nate`.
- The coverage page is not mentioned, even though "not curated … labelled as such" is exactly what it shows.
- A license line, which depends on the LICENSE decision.

**Proposed sections:**

- Lede: what critcalc is, in one or two sentences (the one place the "how the game works, your call" idea is stated, as a description)
- The three tools: current shape, one line each, each linking to its help chapter
- Where the data comes from: gcsim-first, kit text, "not yet curated" → the coverage page
- Credits: the six now, plus GGanalysis and Genshin Optimizer (more on Nate's call)
- Who makes it (one person plus Claude, "we"; see the question below)
- A fan project: the house phrase, and the license once decided

---

## 3. Contribute (`/contribute`), also the BETA tag's target

**Purpose today:** "support upstream", "report something wrong" (with no channel), and "critcalc takes no money".

**Sections now:**

- Lede: "The most useful thing you can do for this site is to support the projects upstream of it." Style guide §1.3c flags this as preachy.
- **Support the projects this is built on**: gcsim, KQM, genshin-db, and "Data flows downhill."
- **Report something wrong**: curation stages, a link to coverage, "A public place … is being set up", and "check gcsim".
- **Supporting critcalc**: "no ads, no accounts, no analytics … which is the point of the section above."

**Stale or incorrect:**

| Line       | Says                                              | Is now                                    | Owner                                  |
| ---------- | ------------------------------------------------- | ----------------------------------------- | -------------------------------------- |
| 18–21      | "The most useful thing you can do for this site…" | §1.3c                                     | clear                                  |
| 30–45      | three upstream projects                           | About credits six; the two lists disagree | needs-nate (which belong on this page) |
| 67–71      | "being set up"                                    | becomes the Google Form, once it exists   | blocked on the Form ID                 |
| 77         | "no analytics"                                    | false the moment the CF beacon lands      | blocked on analytics                   |
| 80–83      | "which is the point of the section above"         | the purest §1.3c case                     | clear                                  |
| 1–9, 64–66 | an authoring-hole comment and a TODO              | resolve them with the Form                | clear                                  |

**Missing for launch:**

- **The BETA note**, which this page is the BETA tag's target for. Roadmap §8 says what it covers: one person, active development, data hand-curated against gcsim, and what to do if something looks wrong. It points at the surface, never the data. ⛔ No end condition.
- **The report form**: what to include (the share link), and that the in-tool report pre-fills it (roadmap §6, Google Forms prefill `?usp=pp_url&entry.<id>=`). GitHub Issues as a second channel only if the repo goes public.
- An anchor (`#beta` or similar) for the tag to deep-link to, or the note becomes its own page (see the questions).

**Proposed sections:**

- What "beta" means here (the BETA tag deep-links to it)
- Report a problem: the Form, what to include, and that the coverage page answers "is this known?"
- Help the projects this is built on: upstream, with "a fix there reaches every tool"
- Money: none taken (a single line, without the "no analytics" claim)

---

## 4. Coverage (`/coverage`)

**Purpose today:** per character, which parts of the kit the Rotation Planner draws. Shipped 2026-09-23, rulings in `docs/coverage-round.md` §11, copy settled with Nate.

**Sections now:**

- `h1` "Coverage" and an intro (`CoverageList.svelte`)
- The legend: Modeled / Stand-in / Missing / Not modeled / Nothing to model
- Controls: search, a **My constellations** chip (filters to owned and dims constellations above yours, `cb575244`), and sort (Newest first / By name / Least covered first)
- A pinned notice when it is opened with `?c=` ("Showing N characters from the Rotation Planner" + "Show all characters")
- The table, whose rows expand into per-segment detail lines (`coverageText.ts`), the reasons and the caveats

**Stale or incorrect:** none found. Its strings are newer than any text worksheet (roadmap: "in NO text worksheet yet").

**Missing:**

- Nothing for launch. Optionally, a line saying how to report a wrong row (→ Contribute).

**Proposed sections:** unchanged. Leave it out of the rewrite except for a single report line, if Nate wants one.

---

## 5. Help: FAQ (`/help`)

**Purpose today:** general questions; the "?" opens here from the landing.

**Sections now:**

- `h1` "Help & FAQ" and a lede
- **What critcalc is**: "What is critcalc?" · "Does it tell me my damage number or the best team?" · "Is critcalc official?"
- **Your data**: "Do I need an account? …" · "How do I move my data to another device?"
- **The data behind it**: "Where does the character data come from?" · "A value looks wrong, or a character is missing." · "Why do some characters show fewer details than others?"
- **Odds and ends**: "Which terminology do you follow?" · "Does the site work offline or on a phone?"

**Stale or incorrect:**

| Line  | Says                                                                                                                  | Is now                                                                                                                                                                                                                                     | Owner                                                 |
| ----- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| 20–27 | the creed twice, plus "No, by design."                                                                                | §0.2. ⚠️ Damage Breakdown does end in a number for reaction damage.                                                                                                                                                                        | needs-nate (this is the one place it stays, reworded) |
| 32    | "independent, non-commercial"                                                                                         | house phrase                                                                                                                                                                                                                               | clear                                                 |
| 42–52 | "Everything you set … lives only in your own browser" · backup "is the only way it travels"                           | true about the browser; false that the backup carries everything (§0.6)                                                                                                                                                                    | needs-nate (via §0.6)                                 |
| 66–71 | "shown honestly as 'not yet curated'" and "let us know" → Contribute, which has no channel                            | link the coverage page; the channel depends on the Form                                                                                                                                                                                    | clear (coverage link) / blocked (channel)             |
| 90–95 | "built for wide screens — the planner timeline and the Team Builder's comparison in particular … but they scale down" | Compare is retired. Both benched tools reach 0px overflow from 320px (the narrow round, verified by Nate on a phone), the planner has a phone dock with a key row, and the site installs to a home screen (`static/manifest.webmanifest`). | clear                                                 |
| 90–93 | "offline … keeps working while you are on it"                                                                         | there is no service worker (`src/service-worker*` is absent), and character data is lazy-loaded chunks, so going offline mid-session can fail                                                                                              | needs-nate (say "no", or say nothing)                 |

**Missing:**

- **"Why is my skill recast a few frames later?"** (queued, §0.1)
- A pointer to the coverage page ("is my character fully in?")
- "How do I report something?" → the Form
- What "beta" means (or a link to Contribute's note)
- Possibly: "Why is the timeline different from my in-game rotation?", covering Human timing being on by default, swap ping, energy not modeled. `needs-nate`.

**Proposed sections:**

- What critcalc is: what it is · damage numbers or the best team (the one sentence) · official? · beta?
- Your data: account/server · moving data (scope per §0.6) · sharing a link (what a link carries)
- The data behind it: sources · coverage and "not yet curated" · something looks wrong → report
- Timing questions: the skill-recast entry · the Nightsoul cooldown case · (optionally) human timing and swap ping
- Odds and ends: terminology (KQM) · phones and installing

---

## 6. Help: Rotation Planner (`/help/planner`)

**Purpose today:** how to write notation and read the timeline. It is the longest chapter.

**Sections now:**

- Lede: "… frame-accurate. It visualizes timing and windows; it never computes damage numbers."
- **Writing the notation**: tokens; amber vs yellow underlines; walk-cancels.
- **Reading the timeline**: rows, buffs, cooldowns, zoom; "generic cast timings"; **Human timing**; **Play**; **Laps**.
- **The target's aura**: the plot; ticks and dots; the "strip" below (cores, prism, cloud, moondrifts); what each one does; the Polestar Field; turning it off (Auras/Buffs); what it assumes.
- **Team, weapons and constellations**: notation = team; bench ⇄ and ✕; portraits and chips; bench vs roster vs Team Builder.
- **Notes and caveats**: Notes; Share → KQM text / PNG.

**Stale or incorrect:**

| Line                      | Says                                                                                                                                                                                  | Is now                                                                                                                                                                                                                 | Owner                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 9                         | "it never computes damage numbers"                                                                                                                                                    | creed (§0.2)                                                                                                                                                                                                           | clear                                                              |
| 36–37                     | "we don't simulate" / "we took it"                                                                                                                                                    | §0.3                                                                                                                                                                                                                   | clear                                                              |
| 63–65                     | "Cooldowns render as a distinct edge treatment"                                                                                                                                       | The outline was removed (2026-08-11). The cooldown is a translucent "ghost" track flowing out of the cast pill and ending when the ability is back, with a seconds label (`RotationTimeline.svelte:4926–4945`, :3085). | clear                                                              |
| 73–76                     | "**By default the chart is frame-perfect** … _Human timing_ times the rotation the way a person does"                                                                                 | ❗ Human timing is **ON by default** (`stores.ts:576` `humanTiming: true`, padding mode, since 2026-09-24/30)                                                                                                          | clear                                                              |
| 82–83                     | "a link you share opens frame-perfect for whoever follows it"                                                                                                                         | ❗ A link opens at the **reader's** setting (never in `?r=`, `stores.ts:427–434`), which is human timing unless the reader turned it off                                                                               | clear                                                              |
| 110–129                   | "one plot", "their own strip below the baseline", "The strip only appears…"                                                                                                           | **the gauge lines** / **the reaction spawns** (glossary §1a)                                                                                                                                                           | clear                                                              |
| 137–138, 146–147, 159–160 | "We draw…", "We assume…", "we do not have…"                                                                                                                                           | §0.3                                                                                                                                                                                                                   | clear                                                              |
| 152–154                   | "Summons and shields stay either way: they are things standing in the world"                                                                                                          | A shield is not standing in the world. The ruling is "a bar that says when an ability IS stays" (CLAUDE.md, Layers).                                                                                                   | clear                                                              |
| 169–173                   | "The bench's ⇄ hands that slot to the Team Builder to compare replacements against, and ✕ removes the character"                                                                      | ✕ is gone. The **portrait is Swap** (desk only) into the Builder's **swap mode**; an empty slot opens it **adding**; removing a character means deleting their actions (bench round §2, `SlotPortrait.svelte:25`).     | clear                                                              |
| 176–178                   | "Click a team portrait to read that character's details. Each portrait also carries chips for their weapon, artifact set, and constellation"                                          | details are behind the corner **magnifier**; the constellation sits on the disc (hollow means the tab asks for more than you own); the loadout is the pill beside the portrait                                         | clear                                                              |
| 181–184                   | "apply to the plan (the tab you're in) … roster … in the Team Builder's roster … The bench is one and the same team in both tools … the active tab is the one the Team Builder edits" | The Builder left the shared bench (lineups §2.1); "plan" is retired; the roster is edited in the **Library → Roster** tab (§11.2)                                                                                      | clear                                                              |
| 191                       | "in the view controls above the timeline"                                                                                                                                             | "the view bar" (§0.5); the aside now also holds the **Log**                                                                                                                                                            | clear                                                              |
| 196–197                   | "Copy … as KQM text, or export … as a PNG, from **Share**"                                                                                                                            | Share holds Copy link · Copy KQM notation · Copy timeline image · Download timeline image (`DocumentActions.svelte:86–135`)                                                                                            | clear (labels) · ⛔ the PNG's look is Nate's separate conversation |

**Missing** (bench round §4's scan, confirmed against code):

- **Tabs** (limit 12, Recently closed), **Save / Library**, and saved rotations
- **The aura log** (the `Log` aside, `planner/+page.svelte:740`)
- The **Total** readout (`planner/+page.svelte:556`), the **zoom popover** and **Reset zoom**
- **Coverage strips** (Settings) and the Notes → coverage page links (`?c=`, `RotationNotes.svelte:58,67`)
- Team bonuses (faction bonuses, `DetailCard.svelte:95`)
- **On a phone**: the composer dock, the key row, the bench row (no Swap on phones), and layers starting off below `toolMin`
- Swap ping (Settings) as a cause of swap timing

**Proposed sections:**

- Writing the notation: tokens · the two underline colors · walk-cancels (keep the §1.2 "why")
- Tabs, saving and sharing: tabs · Save and the Library · the Share menu
- The team: notation = team · the bench card (Swap, magnifier, constellation disc, loadout pill) · constellations vs your roster · on a phone
- Reading the timeline: rows · cooldown ghosts · buffs and team bonuses · zoom and Total · generic timing → coverage
- Timing like a person: Human timing (on by default) · swap ping · Play and its sound · Laps (energy not modeled)
- The enemy's aura: gauge lines · reaction spawns · the Polestar Field · the aura log · layers (Auras/Buffs) · what it assumes
- Notes and caveats: Notes · coverage strips

---

## 7. Help: Team Builder (`/help/builder`)

**Purpose today:** describes the pre-lineups tool. ⚠️ **It is almost entirely stale** (bench round §4: "almost entirely stale"; lineups design §7: "the Help chapter is rewritten for the new shape").

**Sections now:**

- Lede: capabilities with provenance.
- **Finding characters**: Atlas/Roster tabs, filters combine, italic conditional badges, uncurated characters listed separately.
- **Constellations change the answer**: C0 / My constellations / C6; the roster is shared.
- **Comparing and assembling**: Compare, the effect-grouped chart, the audition, Take slot, team slots + resonance/coverage checklist, the bench glides across.

**Stale or incorrect:**

| Line       | Says                                                                                                                                                 | Is now                                                                                                                                                                                                                        | Owner                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 18–19      | "The middle panel has two tabs … **Atlas** … **Roster**"                                                                                             | The Atlas retired. The grid is **Characters** with a filter bar and "More" popover; **Roster** is the Library tab only (glossary §1, lineups §11.2).                                                                          | clear                   |
| 23–29      | "Healing + ATK buff" combine; "Conditional badges … italics"                                                                                         | Filtering is now the 15 capability glyphs ("Can provide"), a faint glyph on a team filters to it, and hovering a card previews it (§11.2). Whether filters still AND and whether italics still exist: verify while rewriting. | clear (after verifying) |
| 53–55      | "set it once … stored only in your browser"                                                                                                          | still true, but set in **Library → Roster**; the Builder's details are read-only for ownership (§11.2)                                                                                                                        | clear                   |
| 58–86      | Compare, the effect-grouped chart, the audition, **Take slot**, the coverage checklist, "Facts, never a score", "The bench … glides across with you" | All retired (Compare + Audition → swap mode, `ad848af9`; the Builder has no bench, §2.1)                                                                                                                                      | clear                   |
| 71         | `modelled`                                                                                                                                           | US spelling                                                                                                                                                                                                                   | clear                   |
| seo.ts:110 | "constellation modes, comparison and team slots"                                                                                                     | stale                                                                                                                                                                                                                         | clear                   |
| seo.ts:89  | "resistance shred"                                                                                                                                   | RES shred                                                                                                                                                                                                                     | clear                   |

**Missing (the whole current tool):**

- **Lineups**: presets (current Stygian Onslaught by default, Abyss, Custom), battlefields, the boss and checks, No repeats (`docs/tb-endgame-round-2026-10-09.md`)
- **Picking**: the whole card picks into the selected slot; the destination strip; the magnifier opens details in the roster column
- **The team's capabilities**: the 15 glyphs, presence only, two states (glossary: ⛔ "fingerprint" on screen)
- **Swap mode**: click a filled portrait; sections = what the swap costs the TEAM, gains in green; "Adds" for an empty slot; band A's notice with **Undo** and **Try in Planner**; the Planner's Swap lands here
- **Pinned rotation**: a team opens its rotation in the Rotation Planner
- **The Library**: Teams / Roster tabs, Sync / Synced, Recently closed
- **Constellation marks**: above what you own; not owned
- **Share links** (`?b=`)
- **On a phone**: the Characters | Lineup tabs and the Filters drawer

⚠️ Step-6 copy (tier names, "Loses nothing", "Replacing X · Battlefield 2", the notice sentences) is still unruled (bench round §4). Rule it before, or inside, this chapter.

**Proposed sections:**

- What it's for (one line: the game's party setup, with what each character brings)
- Lineups and battlefields: presets · the season · checks and bosses · no repeats
- Finding characters: the filter bar · the capability glyphs as filters · uncurated characters → coverage
- Building a team: pick · the destination · details (magnifier)
- What a team can do: the glyphs · conditions read against the team · constellation lens (C0 / My constellations / C6)
- Swapping: swap mode's sections · Undo · Try in Planner · arriving from the Planner
- Your roster and the Library: the Roster tab (owned, constellations, wishlist) · saved lineups · Sync
- Sharing a lineup: the link
- On a phone

---

## 8. Help: Visualizers (`/help/visualizers`)

**Purpose today:** the workspace plus one section per instrument. Each section was rewritten in its 2026-10-01 to 10-06 pass, so this is the most current chapter.

**Sections now:**

- Lede
- **The workspace**
- Eight instrument sections in picker order: **Crit Heatmap**, **Gauge Explorer**, **ICD Timeline**, **Reaction Curves**, **Damage Breakdown**, **Enemy RES & DEF**, **Artifact Odds**, **Wish Odds**

**Stale or incorrect:**

| Line  | Says                                                                           | Is now                                                                                                                                                                                                                                     | Owner |
| ----- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| 19–21 | "**Reset layout** restores the default, and each tile can be reset on its own" | The tile's button is labeled **Defaults** (`visualizers/+page.svelte:271`; prose should bold the label). **Reset layout** and the **Instruments shown** control (Auto/1/2/3, :212) sit in band A, which is hidden below 1360px (:444–465). | clear |
| 144   | `coloured`                                                                     | US spelling                                                                                                                                                                                                                                | clear |

**Missing:**

- The **Instruments shown** control (Auto / 1 / 2 / 3)
- The per-tile **Share** button is mentioned, but not that it is per tile
- The per-instrument "how to read" rulings already live in the instrument passes. Nothing else is missing.

**Proposed sections:** keep the current shape:

- The workspace: picker · Instruments shown · Defaults vs Reset layout · Share per tile · hand-offs
- The eight instrument sections, unchanged apart from the two fixes above

---

## 9. Privacy (`/privacy`)

**Purpose today:** "nothing on a server". It needs a **real rewrite**, not a tweak, once analytics and the Form exist (roadmap, decided 2026-08-14).

**Sections now:**

- Lede: "keeps **nothing** about you on a server. No accounts, no tracking, no cookies."
- **Your data stays in your browser**: localStorage; Export/Import; wipe.
- **No tracking**: no cookies or analytics; Cloudflare Pages processes request data.
- **External links**
- **Changes**: "if an optional, privacy-respecting analytics measure is added — this page will say so plainly before it does."

**True today, as verified:** the only `fetch(` in `src` is the avatar warmer (`warmAvatars.ts:52`, same origin), there are no third-party scripts in `app.html`, and fonts are not from Google.

**Stale or incorrect:**

| Line       | Says                                    | Issue                                                                    | Owner                 |
| ---------- | --------------------------------------- | ------------------------------------------------------------------------ | --------------------- |
| 7, 28–31   | "no tracking … runs no analytics"       | false once the CF beacon lands; the page must change first (its own :51) | blocked on analytics  |
| 20–23      | "wipe everything … from the same place" | Clear all leaves saved lineups, tabs and the workspace (§0.6)            | needs-nate (via §0.6) |
| seo.ts:137 | "no accounts, no tracking, no cookies"  | same as :7                                                               | blocked on analytics  |

**Missing for launch:**

- **Cloudflare Web Analytics**: what it collects (pages, referrer, browser, country; cookieless), and whether it records query strings. ⚠️ A `?r=` URL carries a whole rotation. Check this before writing the sentence.
- **Google Forms**: what a report sends (prefilled share link, build, browser) and that Google's policy applies.
- **Share links**: a link carries your rotation in the URL. This is the one way your data leaves your device, and only when you send the link.
- **Home-screen install**: stores nothing new (optional).
- A **last-updated date**.

**Proposed sections:**

- Short version (two lines)
- What stays in your browser: the list, and the backup/wipe scope per §0.6
- What leaves it: share links · reports (Google Forms) · analytics (Cloudflare) · the host's request logs
- No accounts, no cookies, no ads
- External links
- Changes and the last-updated date

---

## 10. Settings (`/settings`, also the chrome's Settings modal)

**Purpose today:** preferences and data management. It is a pass-1 surface (`docs/text/sheets/settings.md`, Nate leads), so the rewrite only fixes what is incorrect.

**Sections now** (`SettingsPanel.svelte`):

- **Display**: Updated outfits · Traveler · Swap ping · Coverage strips
- **Human timing**: lede · What it adjusts (Padding / Animations / Both) · Input padding · Show padding
- **Playback sound**: Sound · Voice · Notes · Swap · Volume
- **Your data**: Backup (Export…) · Restore (Import…) · the import confirm
- **Reset saved data**: Constellation levels · Loadout labels · Roster ownership · Saved rotations · Everything

**Stale or incorrect:**

| Line         | Says                                                                                      | Is now                                                                | Owner      |
| ------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------- |
| 166          | "The rotation planner is **frame-perfect by default**"                                    | ❗ Human timing is on by default (`stores.ts:576`)                    | clear      |
| 167          | "The **Human** button on the planner's toolbar"                                           | label "Human timing"; "the view bar"                                  | clear      |
| 123, 166     | "the rotation planner" (lowercase)                                                        | the tool's name is Rotation Planner                                   | clear      |
| 177          | `cancelling`                                                                              | US spelling                                                           | clear      |
| 255          | "the planner's toolbar"                                                                   | "the view bar"                                                        | clear      |
| 422–424, 499 | Backup "your roster, loadouts, and saved rotations"; Everything "Clears all of the above" | §0.6 (code or copy)                                                   | needs-nate |
| seo.ts:141   | "Your roster, display preferences and saved data"                                         | the roster is edited in Library → Roster now; Settings only resets it | clear      |

**Missing:**

- If §0.6 is fixed in code: "Saved lineups" in Reset, and lineups in the backup.

**Proposed sections:** unchanged structure. Fix the rows above in place.

---

## 11. Smaller items

- **`/faq`** (`+page.ts:9`) is a 308 to `/help`, kept for old links. Nothing to do.
- The **render boundary** copy (`(tools)/+layout.svelte:844–850`): "Your saved rotations are untouched" is true. It says nothing about lineups, which are also untouched. Low priority.
- **The error page** (`+error.svelte:62–66`) carries the §1.3c tell: "telling us what you were doing is genuinely useful … reports are how problems get found". Its "Report a problem" should go to the Form. It is not a static page, but it belongs to the same round as the channel.
- **Sitemap** (`static/sitemap.xml`) lists all 13 routes. If the BETA note becomes a page, it needs entries in both `seo.ts` and the sitemap (CLAUDE.md).

---

## 12. Open questions for Nate

1. **The BETA note's home:** a section on Contribute (the tag deep-links to `/contribute#beta`), or its own short page (`/beta`, which needs a `seo.ts` and sitemap entry)?
2. **The BETA note's content:** roadmap §8 lists one person, active development, data hand-curated against gcsim, and what to do if something looks wrong. Is that the list, and should it say "one person" or "we" (style guide §1.4: "we" is the honest plural)?
3. **The Form:** which fields does it require (share link, tool, what you expected), and which are prefilled by the in-tool button? This decides the Contribute and Privacy wording.
4. **Analytics:** on every page including the tools, or the static pages only? And does the beacon record query strings? If it does, a shared `?r=` rotation lands in analytics, which Privacy must say, or the beacon must strip.
5. **LICENSE:** which license for the code, and does the curated character data get a different one? Should About or the footer say it?
6. **Backup scope (§0.6):** should saved lineups, open tabs and the Visualizers workspace go into the backup and into Clear all, or should the copy narrow to what is backed up today? (Recommendation: saved lineups yes, since it was most likely just missed when `savedBoards` was added; open tabs, your call.)
7. **The one "damage numbers" sentence:** the style guide keeps it in About and in the FAQ question. With Damage Breakdown ending in a number for reactions, what does that answer say now?
8. **About, "who makes it":** add a line in the spirit of the error page's "one person's project", and if so, how personal (name, handle, none)?
9. **Credits:** add GGanalysis and Genshin Optimizer (both cited in help). Add the fonts and Lucide too, or leave them out?
10. **FAQ, offline:** say plainly "no, it needs a connection", or drop the offline half of the question?
11. **FAQ, a timing-surprises question** (Human timing on by default, swap ping, energy not modeled), or does the Planner chapter carry that alone?
12. **Footer links:** add Privacy (and License) to the landing/static footer, or keep the footer legal-only as it is today?
13. **TB step-6 copy** (tier names, "Loses nothing", "Replacing X · Battlefield 2", the notice sentences): rule it before the Team Builder chapter is written, or inside the rewrite?
14. **Ordering:** CLAUDE.md's launch-boundary simplification pass. Before the help is written, or after (bench round §4 asks the same)?
