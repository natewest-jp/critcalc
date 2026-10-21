# Profiles and surfaces — a design for the site's next shape

**Status: DRAFT 3, 2026-10-21. Not ready for implementation.** Draft 2 settled the what-if, storage, accounts, the link switch and profile identity (§2.3, §2.4, §4.4, §4.5, §9.3, §9.4); draft 3 settles the profile cap, names, per-profile tabs and default labels (§2.3, §4.2, §6.1, §9.4). Written from one long conversation with Nate, after a streamer's live session and the structure survey (`docs/structure-survey-2026-10-21.md`). ⚓ marks what Nate locked in that conversation; everything else is proposal. §12 collects what is still open, and there is a lot of it — this draft is meant to be hammered on before any build order is written.

---

## 0. Why

Watching a streamer use the site surfaced three problems that turned out to be one:

1. **He didn't know where things go.** He curated his owned characters in the Roster, then went to the Library to _add teams_ — Genshin's own Party Setup habit — and couldn't, because teams only come into being as a side effect of saving a rotation. Once told, he managed, but kept struggling with it.
2. **He couldn't see how the tools are controlled.** The structure survey found the cause in the frame: controls in 11–12px type in two half-empty bands, a document/view rule that holds in one tool of three, and interactions with no visible affordance.
3. **His data has more than one owner.** He has more than one Genshin account, so "my roster" is not one thing. And a shared rotation that uses _someone else's_ constellations has no clear status today: the site resolves it through two layers and a `synced` flag that nothing on screen names.

The design below answers all three with one structure: **three surfaces, two bars, and profiles.**

---

## 1. Principles

- ⚓ **Three surfaces, one job each.**
  - **Tools** are where you work — the night scene, glass and paper, as today.
  - **The full-screen state** is everything you go to on purpose to read or manage: your roster and teams, your saved work, help, about, settings.
  - **The inspector** is reference you check mid-task without leaving the work: a side panel inside a tool (the character detail card, the boss details).
- ⚓ **The full-screen state is a STATE, not an overlay.** The UI flips between the tool state (night scene) and the full-screen state (slate, covering the whole screen, no tool visible). This is Genshin's own grammar — the world, and the menus that take over the screen (Party Setup, the Character screen, the Archive).
- ⚓ **Two bars, one question each.** The **title bar** answers _where am I and what am I working on_. The **toolbar** answers _what can I do to what's below_, with each control sitting over the part it acts on.
- ⚓ **Whose characters is this built with?** is answered by the **profile**, visible at all times, opposite the logo.
- **Document properties live on the document**, not in a bar (e.g. a lineup's season).
- **Curated things are saved deliberately; worked-on things save themselves.** Teams are curated. Rotations and lineups autosave.

---

## 2. Profiles

### 2.1 What a profile is

⚓ A profile is **one Genshin account's worth of data, kept in this browser.** It is not a login, and nothing leaves the browser (the privacy page's promise stands). A profile holds:

| Part          | What                                                                         | Saved how            |
| ------------- | ---------------------------------------------------------------------------- | -------------------- |
| **Roster**    | Ownership (owned / wishlist), constellation levels, each character's loadout | Edited deliberately  |
| **Teams**     | Curated four-character presets with names                                    | Created deliberately |
| **Rotations** | Every rotation worked on in this profile                                     | Autosaved            |
| **Lineups**   | Every lineup worked on in this profile                                       | Autosaved            |

Site settings (display, playback, Human timing, swap ping, the Visualizers' layout, the storage stamps) stay **global**: they describe the person at this browser, not an account. ⏭ Confirm per setting (§12).

### 2.2 ⚓ Theorycraft: the profile you start in

- **The default on a first visit is a built-in Theorycraft profile.** All shared content opens there, so your own profiles are never touched by anyone else's work.
- **The site stays fully usable in Theorycraft alone.** It has no curated roster and no Teams — those belong to a real profile — but it has Rotations and Lineups, like any profile.
- In Theorycraft every character is available and every value is the document's own (there is no roster to fall back to).
- **New visitors are invited to create their own profile(s)** (§9.1), never forced.

### 2.3 Real profiles

- Created by the user: a **name**, a **profile picture** and a **colour**.
- ⚓ **The profile picture follows Genshin's own precedent** (Nate, 2026-10-21): the circle avatar of **any character you own** (in that profile's roster), or one of the game's **art profile pictures** — the silhouette-style pictures of moments from the Genshin journey. Nate supplies the art set. ⏭ A profile with an empty roster can still pick from the art set.
- ⚓ **Each profile has a colour, and colours are exclusive**: the **seven element colours** for real profiles, and a **gray/white** that only Theorycraft can have — it reads as "nobody's account". Exclusive means no two profiles share one, so ⚓ **a browser holds at most seven real profiles** (Nate: nobody actively plays eight accounts, and a cap with a visible reason beats an arbitrary one). At the limit, **Create profile** stays visible but disabled with a one-line reason; deleting a profile frees its colour.
- More than one is normal (several accounts). Switching is **loud** (§9.4): the picture, name and colour change in the title bar, and every list, tab and roster-dependent view changes with it.
- ⚓ **The profile sits in the title bar opposite the logo** (§5.1). Clicking it opens the full-screen state at **You** (§6), which holds the profile switcher.

### 2.4 How a document finds its values

This replaces today's two layers and the `synced` flag (lineups design §9.5, §10.4).

- **In a real profile:** a character you **own** reads the profile's roster, live. A character you **don't own** has no roster value, so the document keeps its own value for that character, marked as not owned (today's mark).
- **In Theorycraft:** every value is the document's own.
- ⚓ **Loadouts are a document's own choice everywhere.** Every weapon on offer is one every player has (Nate, 2026-10-21), so a weapon is not an ownership fact: the roster's loadout is a **default**, and a document may differ from it freely. ⏭ Revisit if weapons that need curating like the roster are ever added.
- ⚓ **Constellations: a profile always shows your account as it is, and a what-if is a LENS, not an edit** (Nate, 2026-10-21; "what would this look like with this four-star at C6?" is a real want):
  - In a real profile you can try a level you don't have. It is a **temporary view**: the character's constellation pip turns `--ui-provisional` (its existing meaning — _a stand-in_), and the bench or toolbar says so in one line with a **Clear** (working copy: "Trying Xiangling at C6 · not saved · Clear").
  - **The rotation keeps saving everything else** — notation, loadouts, all of it. Only the hypothetical level is unsaved, which is the point of a what-if.
  - **Keep as a Theorycraft copy** keeps a scenario that turns out to matter: the rotation is copied into Theorycraft with the what-if levels. So nothing is lost by accident, and nothing in a profile stops matching the account.
  - ⏭ Whether the lens survives a reload or a tab switch (§12).

### 2.5 What retires

`synced` / `RotationTab.synced` / the Sync badge and its confirm · "Use my constellations" (already superseded) · the densified constellation snapshot on save (a real-profile document follows the roster by construction) · the two-layer explanation in the help.

---

## 3. Teams

- ⚓ **One team per set of four characters, within a profile** (Nate: players make one Neuvillette team, not duplicates of the same four). The set is the identity; ⏭ the member ORDER is stored for display (§12).
- ⚓ **Teams are curated, never filed into.** Teams is the place to build presets and **start new work from them**:
  - **Plan a rotation** → a new Planner rotation with the four names.
  - **Add to a lineup** → onto the open Builder board's selected team (today's team picker, §10.2 of the lineups design).
- A team card links to its work without containing it: **"4 rotations · 2 lineups"**, each a link into Rotations or Lineups filtered to that team.
- A team carries its members, its name and ⏭ maybe notes. It does **not** carry constellations or loadouts — values come from the roster or the document (§2.4).
- **Creating a team from the other direction:** a rotation whose four characters are not a saved team simply has no team. The Planner's bench offers **Save as team**; a Builder board row keeps its existing **Save team** (§10.2).
- Teams exist only in real profiles (⚓ §2.2).

### 3.1 What retires

The Library's "team entry" (a names-only `savedNotations` row) and team headings as containers (lineups design §10.1, §10.1a). The notation stays the single source of truth for a _rotation's_ members (⚓ 2026-08-13); a team is now a separate, deliberate object.

---

## 4. Saving

### 4.1 ⚓ Autosave, with a status instead of a button

- Rotations and lineups save themselves into the **active profile**.
- **No Save button.** Next to the document's name, a **save status says where it is saved**: e.g. _Saved · Main_ (working copy, §12). The streamer wasn't afraid of losing work — he was looking for where things go, so the status answers _where_, not just _whether_.
- **⌘S** is caught and confirms the work is already saved (Figma and Google Docs do the same), instead of opening the browser's "Save page as".
- "Saved" means _in this browser_. The status can carry a quiet warning when storage isn't persistent and there is no recent backup (storage durability round, 2026-10-21).

### 4.2 Tabs under autosave

- A tab is just **an open document**. Closing a tab closes it; the document stays in the Library. **Recently closed retires**: the Library's recency order already holds it.
- Deleting is a separate, deliberate act in the Library.
- ⚓ **Open tabs belong to a profile.** Each profile keeps its own open tabs per tool, its active tab and its last tool, and returns to them when you switch back (as Chrome profiles restore their windows). Theorycraft's tabs persist like any profile's. ⛔ One shared tab strip tagged per profile was rejected: switching profiles would change the values inside tabs still on screen.
- The 12-tab limit (⚓ §9.3) stays, **per profile**, as an _open_ limit, not a storage limit.
- ⚓ **An unnamed document stores no name; it shows a label derived from its contents**, styled as a placeholder (not yet named). Naming it is an ordinary edit.
  - **Rotation:** the matching saved team's name, else the characters' names ("Neuvillette · Furina · Kazuha · Baizhu"), shortened to fit. Derived, so it stays right when the team changes.
  - **Lineup:** its mode and season ("Stygian 7.1", "Abyss", "Custom lineup") — what the existing "the tab names the mode" intent asked for and the default "Lineup 1" ignores.
  - ⛔ Rejected: numbers ("Rotation 3": meaningless, and they shift), dates (the list already shows when), "Untitled" (every unnamed row looks the same). Duplicate labels are fine: rows also show portraits and last-touched time.

### 4.3 Accumulation and pruning

- **In a real profile**, nothing is pruned: it is your work. The Library's views and filters carry the load (§6.2).
- ⚓ **In Theorycraft:** a document opened from a link that you **never changed** drops off after a while (the link still exists if you want it again). **Anything you changed stays** until you delete it. ⏭ The window (§12).
- **Moving out of Theorycraft:** any Theorycraft document can be **moved (or copied) to a profile**. Arriving in a real profile, its owned characters start reading the roster — this is what "Sync" used to do, now a consequence of where the document lives. ⏭ Move or copy (§12).

### 4.4 ⚠️ Storage

Autosaving everything, across several profiles, into `localStorage` would meet its ~5 MB per-origin quota (a notation may be up to 16 KiB).

- ⚓ **Documents and profiles move to IndexedDB** — the browser's built-in database: far more room (typically hundreds of MB or more), built for many records, and it never freezes the page while reading or writing. It is still local: "clear site data" erases it and `navigator.storage.persist()` covers it, exactly as for `localStorage`. Small settings can stay in `localStorage`.
- ⚓ **Records are shaped for sync from the start**, so optional accounts (§4.5) stay cheap to add: every record carries a **stable id**, a **last-changed time**, and a **deletion marker** (a tombstone) instead of disappearing.
- The move is part of the migration (§10).

---

### 4.5 Accounts: parked, and designed for

⚓ **No accounts for now** (Nate, 2026-10-21, after weighing "account required to save a profile"). The reasons, kept so the question isn't re-argued from scratch:

- IndexedDB solves **capacity** without a server; only durability and cross-device use need one.
- Requiring an account at **Create profile** would put a sign-up wall at the moment a player is most engaged (curating their roster), and the profile design only works if people create profiles.
- Mandatory accounts make every cost unavoidable: two-device merges, a privacy rewrite, a minimum age and consent rules (many players are under 16), security and breach handling, "I lost my login" support.
- Optional accounts are additive later; mandatory ones are hard to reverse.

**The path if it returns:** optional, per profile — **Sync this profile** — on the sync-ready records above. Triggers worth watching: players asking for cross-device use, or reports of lost data despite the backup reminder. (The to-do list's On hold entry carries the earlier cost breakdown.)

## 5. The two bars

### 5.1 The title bar

Same shape on every surface and in both states:

`[logo] critcalc.app · Builder Planner Visualizers · [document ▾] [save status] ··· [Share ▾] [Library] [?] [⚙] [profile]`

- **Brand left, profile right** (⚓ the profile opposite the logo).
- **The tool switcher moves left beside the brand** — a breadcrumb: site › tool › document.
- **The document area**: the open documents (tabs) and the active one's save status. The Visualizers have no document, so it stays empty there.
- **Share** stays visible (never behind an interaction); the Planner's menu keeps its link / KQM / image entries.
- **Library** opens the full-screen state at Rotations or Lineups (whichever the current tool makes).
- **`?`** merges About and Help, and carries **Report a problem** — the visible feedback door the beta lacks.
- **⚙ Settings** stays visible (⚓ Settings is reached mid-task).
- **The old Roster icon goes**: the roster now belongs to the profile.
- ⏭ One control size for both bars — the fix for the survey's inverted size hierarchy (11px controls, 18px navigation) — and possibly a title bar shorter than today's 64px.

### 5.2 On a phone

⚓ The brand shows as the **logo only**, which frees room for the document:

`[logo] [document ▾] ··· [Share] [☰] [⚙] [profile]`

- **document ▾** switches open documents and opens the Library.
- **☰** opens the full-screen state's index (tools at the top), replacing today's compass.
- Band A's separate row disappears; every tool gains ~33px of height.
- ⏭ Width check at 320px with the profile avatar added (§12).

### 5.3 The toolbar (replaces bands A and B)

One row, controls zoned over what they act on.

| Tool            | Left                                                                                         | Middle | Right                                        |
| --------------- | -------------------------------------------------------------------------------------------- | ------ | -------------------------------------------- |
| **Planner**     | ⏮ ▶ speed · Laps · Zoom (with Fit and the current %)                                        | Total  | Buffs · Auras · Log · Notes                  |
| **Builder**     | over the roster: Search · filters · the roster lens (⏭ §12 Q on Owned vs My constellations) | —      | over the board: ⏭ possibly nothing          |
| **Visualizers** | each tile's instrument picker, over its tile                                                 | —      | Layout (lineup count + Reset as one control) |

- ⚓ **Human timing leaves the toolbar** (Nate, 2026-10-21) — to an indicator and its Settings entry; ⏭ exact form.
- **The Builder's season, No repeats and Add team move onto the board's own header** (a lineup's properties, as the game prints them on Party Setup). **Clear** moves into the document menu.
- **The Visualizers' Defaults moves into each tile's ⋯**, with a "changed" dot; the per-tile Share is renamed so "Share" means one thing site-wide.

### 5.4 What retires

Band A and band B as concepts (`ToolStack`'s two-band rule, `BAND_A_H`, the document/view split) · the chrome's Roster and About icons · `NavPanel` (the compass) · the Builder's empty rail plate.

---

## 6. The full-screen state

### 6.1 Shape

- ⚓ A flip of the whole UI: **slate** (`ctx-dark`), covering the screen, no tool visible. The tool is kept, paused, exactly as a left tool page is today, so returning puts you back where you were.
- **The title bar stays** in both states, so the profile, the brand and the doors never move. Only what is below the title bar flips.
- **A sidebar of sections** (macOS System Settings, Discord's settings, Steam's library):

| Group              | Sections                                                    | Door                |
| ------------------ | ----------------------------------------------------------- | ------------------- |
| **(profile name)** | Roster · Teams                                              | the profile picture |
| **Library**        | Rotations · Lineups                                         | Library             |
| **Help**           | Getting started · each tool · FAQ · Keyboard shortcuts      | `?`                 |
| **About**          | About · What's new · Contribute · Beta · Privacy · Coverage | `?`                 |
| **Settings**       | Display · Playback · Human timing · Your data               | ⚙                   |

- **Every section has its own address**, so Back works, links work, and the old split between "overlay" and "page" (`/library`, `/settings`, `/help/...`) becomes one thing.
- **Leaving:** a clear return to the tool, Escape, and the browser's Back.
- ⏭ Reading surfaces (Help, About) on slate, or paper cards on slate per "paper answers" (§12).
- ⏭ The flip needs its own transition; the scene and nav clocks are Nate-tuned and are not borrowed. The WebGL scene can stop rendering while covered.
- ⚓ **Names.** The state needs no user-facing name (users only ever see its sections, as Genshin never names its menus); internally it is **the menu state** — the game's world-and-menus split. ⛔ "Archive" (in Genshin, lore and collections) and "Dashboard" (data at a glance) rejected. In help copy the bars are **"the top bar"** and **"the toolbar"**; internally, title bar and toolbar.
- ⚓ **The You group is titled with the active profile's own name** (e.g. "Main" above Roster and Teams), so the heading answers "whose is this?". ⛔ "Account" (promises a login) and "Profile" (reads like a settings page) rejected; "You" is the fallback.

### 6.2 You: Roster and Teams (real profiles only)

- **Roster:** today's ownership, constellations and loadouts, given room.
- **Teams:** a Party Setup grid of named teams — four portraits each — with **New team**, **Plan a rotation**, **Add to a lineup**, and the links into their rotations and lineups.
- In Theorycraft, You shows an **invitation to create a profile** instead (§9.1).

### 6.3 Library: Rotations and Lineups

⚓ Two dedicated places, each displayed for what it holds:

- **Rotations as rows** — they carry long notation: team portraits, name, a notation excerpt, last touched, and marks for _open_ and _from a link_.
- **Lineups as a grid of cards**, each card showing the teams inside as small portrait rows, so a lineup is recognised by its contents.
- **Order:** most recently touched first. Filters: by team (the link from a team card lands here), and ⏭ open / from a link.
- ⚓ **In Theorycraft:** the same two places, one recency list each, with a small **from a link** mark on documents that arrived by link (Nate considered a separate shared section; one list was chosen because people search by _when_, and an edited link is half theirs anyway). Pruning per §4.3.

---

## 7. The inspector

- Reference opened **mid-task**, beside the work, never covering it: the **character detail card** and the **boss details** move from modals to an inspector panel.
- The Builder survey's finding is the reason: the detail modal hides the very board you were asking about.
- ⏭ Where it lives per tool (the planner's aside column already exists; the Builder needs one) and how it behaves on a phone (a drawer, like today's aside).

---

## 8. Tools — what changes inside

This design doesn't redesign the tools' interiors; the structure survey's per-tool findings stand and are queued separately (Fit zoom, chart↔text linking, the Builder's card cap and board size, the Visualizers' catalog). What changes here:

- **Planner:** the bench's set-once targets merge (one loadout target per card); **Save as team** on the bench; values follow §2.4.
- **Builder:** the board's header carries the lineup's properties; a board row's team picker reads the profile's Teams; values follow §2.4.
- **Visualizers:** no document and no profile scope (⏭ unless an instrument wants the roster later).

---

## 9. Journeys

### 9.1 A first visit

1. The site opens in **Theorycraft**, on the Planner's sample rotation (today's first-visit sample).
2. The title bar's profile reads **Theorycraft** with a quiet **Create your profile** invitation. Nothing blocks work.
3. Everything works: rotations and lineups save themselves into Theorycraft.

### 9.2 Creating a profile and building from it

1. Profile → **Create profile**: a name (⏭ and an avatar).
2. **Roster**: mark owned characters, set constellations and loadouts.
3. **Teams**: create named teams.
4. From a team: **Plan a rotation** → the Planner, with the team's four names, values from the roster. It saves itself into the profile.
5. The streamer's own order — Roster → Teams → build — is now the way the site works.

### 9.3 Opening a shared link

1. ⚓ A link (`?r=`, `?b=`, `?team=`) always opens in **Theorycraft**, carrying the sender's values. **If another profile was active, the site switches automatically and makes it very obvious** (Nate, 2026-10-21): the switch cue (§9.4) plus a short notice — working copy: "Opened in Theorycraft · your profiles are untouched" — with **Move to a profile** beside it.
2. The document is marked **from a link**.
3. **Move to a profile** brings it into Main: owned characters start reading Main's roster.

### 9.4 Switching profiles

- One action from the profile picture. Open tabs, the roster, Teams and the Library all swap, and you land where you last were in that profile (§4.2).
- ⚓ **The switch cue** (Nate, 2026-10-21): the new profile's colour **washes softly over the UI and fades out over ~2 seconds** — e.g. a gradient falling from the title bar, or a soft frame around the tool; ⏭ the shape is a design question for `/lab`. Precedents: Chrome's per-profile window colour, Firefox's container colours, Slack's workspace colours, the red banner teams put on production.
- **A permanent cue as well**: the profile picture carries its colour at all times, and ⏭ possibly a thin line of it along the title bar's bottom edge. The flash marks the moment of switching; the permanent cue answers "where am I?" any time after. Colour is never the only signal — the name and picture say it too.
- **Motion:** one soft fade, well clear of the three-flashes-a-second accessibility limit. Under `prefers-reduced-motion` it appears in its end state with no fade (the motion tokens zero, per the motion round); the permanent cue carries the meaning. ⛔ The scene and nav clocks are not borrowed.

### 9.5 Starting from the Planner

- Write a rotation with four characters that aren't a saved team: it saves as a rotation with no team. **Save as team** on the bench files the set in Teams.

---

## 10. Migration

The site is early and its audience small (⚓ Nate: "now's the time"), but anyone with a saved roster must not lose it.

- **On first load after the change**, if the browser holds any roster or saved document:
  - Create one **real profile** (⏭ default name, then invite a rename) holding the roster (`ownership`, `constellations`, `loadout`).
  - **Team entries** (names-only `savedNotations` rows, with their nicknames) become **Teams**.
  - **Saved rotations** become **Rotations**; **saved boards** become **Lineups**; open tabs and boards stay open.
  - **Recently closed** entries become ordinary Library documents (⏭ or are dropped).
  - **Stored constellations that disagree with the roster** for owned characters: under the strict rule (§2.4) they would silently change. ⏭ Either keep them as marked overrides, or copy those documents into Theorycraft. §12 Q1 decides.
- **If the browser holds nothing**, start in Theorycraft.
- **Backups:** a v1/v2 file imports through the same migration. ⏭ Backup v3's shape: all profiles, or one profile at a time (an exportable account is a nice consequence).
- ⚠️ If documents move to IndexedDB (§4.4), the migration also moves storage engines.

---

## 11. Rulings this supersedes

So nothing below reads as still in force once this design is adopted:

- Lineups design **§9.3** (Recently closed lists) · **§9.5** two-layer constellations · **§10.1 / §10.1a** "the notation is the save concept; the library presents it as teams" · **§10.4** "Synced to my roster".
- **Tool chrome** (CLAUDE.md): band A = document / band B = view; `BAND_A_H` and the two-band `ToolStack`.
- **Site chrome** (compass round): the chrome's contents, its centre-collapsible priority order, and the compass overlay. ⚓ Settings stays visible (kept).
- **Bench ribbon** geometry tied to band A's top (⚓ 2026-08-17).
- The **Library overlay** as a modal-like layer.

---

## 12. Open questions

**Model**

1. ~~Overrides in a real profile~~ — ✅ settled in draft 2 (§2.4): loadouts free, constellation what-ifs as a lens. **Still open:** does a what-if lens survive a reload, or a tab switch?
2. Team identity is the set of four; is the member **order** stored and shown?
3. Do teams carry **notes**?
4. Which **settings** are per profile, if any (Human timing and swap ping feel personal to the player, not the account)?
5. ~~Avatar, colour cap~~ — ✅ settled (§2.3): seven real profiles.

**Saving**

6. ~~Default names~~ — ✅ derived labels (§4.2).
7. ~~Open-tab limit~~ — ✅ 12, per profile (§4.2).
8. **Moving vs copying** a Theorycraft document into a profile; and between two real profiles.
9. The Theorycraft **pruning window** for untouched link documents.
10. ~~Storage engine~~ — ✅ IndexedDB, sync-ready records (§4.4).
11. Backup v3: all profiles, or per profile?

**Journeys**

12. ~~Link while a profile is active~~ — ✅ switch automatically, loudly (§9.3). **Still open:** the shape of the colour wash, and whether the permanent cue includes a title-bar line.
13. ~~Own open tabs~~ — ✅ yes (§4.2).
14. What a first visit's **invitation** looks like, and where it lives.

**Surfaces**

15. ~~Names~~ — ✅ the menu state; the top bar / the toolbar; the You group titled by the profile's name (§6.1).
16. Help and About **on slate, or paper cards on slate**.
17. The **flip transition**.
18. The **inspector's** home in the Builder, and on a phone.
19. The Builder's roster lens: **Owned/Wishlist vs My constellations** (Nate: room for a clean concept; raise at that stage).
20. Human timing's **new form** off the toolbar.
21. **One control size** for both bars, and the title bar's height.
22. The phone title bar at **320px** with the profile added.

**Process**

23. Which `/lab` demos come first: the title bar + toolbar (Planner, Builder; desktop + phone), the full-screen state (You, Library, Help, Settings), the inspector.
24. The build order — after this draft has been through another round.
