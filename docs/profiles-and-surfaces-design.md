# Profiles and surfaces — a design for the site's next shape

**Status: DRAFT 5 — ⚓ LOCKED as the shape, 2026-10-22 (Nate); the build plan is §13.** Tweaks are expected; the functionality is decided. Draft 5 (after demo 2) adds **Planner slots that hold** (§8.1), the menu state over the WHOLE screen and plain tool navigation (§6.1), the profile as a PICTURE (§5.1), paper patches for reading surfaces (§6.4), and Move (§4.3). Draft 4 (one conversation with Nate, the morning after demo 1) **retires tabs**: each tool holds one document, the Library is where you change it, and the Planner compares instead of switching (§4.2, §4.6, §5.1, §6.3). Draft 2 settled the what-if, storage, accounts, the link switch and profile identity (§2.3, §2.4, §4.4, §4.5, §9.3, §9.4); draft 3 settles the profile cap, names, per-profile tabs and default labels (§2.3, §4.2, §6.1, §9.4). Written from one long conversation with Nate, after a streamer's live session and the structure survey (`docs/structure-survey-2026-10-21.md`). ⚓ marks what Nate locked in that conversation; everything else is proposal. §12 collects what is still open, and there is a lot of it — this draft is meant to be hammered on before any build order is written.

**The shape in four sentences** (draft 4). Every rule below should be checkable against these; a rule that can't be said in one sentence to a player is a smell.

1. **Your account is yours** — a profile shows your account as it is.
2. **Anything that isn't your account is white and lives in Theorycraft.**
3. **Each tool holds one document.**
4. **The Library is where you change it.**

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
- ⚓ **The profile sits in the title bar opposite the logo** (§5.1), ↻ **as its picture only** (draft 5, ⚓ Nate 2026-10-22: a long name or a UID must cost the bar nothing). The NAME shows on hover, at the head of the profile menu, as the menu state's group heading, and **rides the switch cue**: it appears beside (below) the picture with the wash and folds away with it. Clicking the picture opens the profile menu (the switcher, Add an account, Roster, Teams).

### 2.4 How a document finds its values

This replaces today's two layers and the `synced` flag (lineups design §9.5, §10.4).

- **In a real profile:** a character you **own** reads the profile's roster, live. A character you **don't own** has no roster value, so the document keeps its own value for that character, marked as not owned (today's mark).
- **In Theorycraft:** every value is the document's own.
- ⚓ **Loadouts are a document's own choice everywhere.** Every weapon on offer is one every player has (Nate, 2026-10-21), so a weapon is not an ownership fact: the roster's loadout is a **default**, and a document may differ from it freely. ⏭ Revisit if weapons that need curating like the roster are ever added.
- ⚓ **Constellations: a profile always shows your account as it is** (Nate, 2026-10-21; "what would this look like with this four-star at C6?" is a real want).
  - ↻ **Draft 4: a what-if is a COMPARISON, not a lens** (⚓ Nate, 2026-10-22). Choosing a level for an **owned** character that differs from the roster (in EITHER direction: ⚓ Nate, 2026-10-22, a level BELOW yours isn't yours either, because Genshin gives no way to switch a constellation off) never edits the rotation: it opens a **copy beside it, in Theorycraft**, and the two are compared (§4.6). One sentence: _changing an owned character's constellation never edits your rotation; it opens a copy beside it, in Theorycraft, and ⇅ flips between them._
  - ⛔ Draft 2's lens (a temporary `--ui-provisional` view, "Trying Xiangling at C6 · not saved · Clear", "Keep as a Theorycraft copy") is retired: the comparison IS the kept copy, so nothing is ever "not saved".
  - ⛔ **A LINKED what-if was considered and cut** (Nate, 2026-10-22): one notation shared by both sides, only the levels differing, the copy's notation locked until you unlock it into an independent copy. Cut because a constellation often changes how you play (C6 Xiangling, C2 Raiden, C1 Neuvillette want their own rotation), so the first act on a linked copy would usually be to unlock it; and because it needed extra rules (what a second character's change does) that a player couldn't hold. If people turn out to edit A and wish B followed, the lock design is the way back.
  - **Unowned characters never open a comparison**: there is no account level to differ from, so their level is the document's own value (above).

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

### 4.2 ⚓ One document per tool (draft 4: tabs retire)

- ⚓ **Each tool holds ONE current document per profile** (Nate, 2026-10-22). The Planner one rotation, the Builder one lineup; the Visualizers none. The model is Google Docs' and Blender's (one document per window, a home screen or Open Recent to change it), not a browser's.
- **Why:** under autosave, with the tabs behind a menu (demo 1's form 5), "open" became a state nobody could see and few would ever close, and the 12-tab limit would arrive with no visible cause. The tools' rhythms agree: endgame modes go live on different schedules, so a Builder user thinks about Stygian for a week or two and Abyss for a few days, one lineup at a time; the **Planner is the only surface that wants quick switching**, and what it switches between is nearly always a comparison (§4.6).
- **Changing the document is the Library's job** (§6.3): the active tool's button in the title bar opens it. Opening a row puts that document in the tool and returns to it.
- **Fast switching without tabs:** the browser's **Back** returns to the last document (every document has an address); a **previous-document key** does the same within a tool; **⇅** flips a comparison (§4.6); **pinned** documents head the Library, because a recency list reorders itself on every switch (form 1's hunting objection in another shape).
- ⚓ **The current document belongs to a profile** (draft 3's rule, carried over): each profile keeps its current document per tool and its last tool, and returns to them when you switch back. ⏭ Whether it is also per BROWSER TAB (§12).
- ⛔ **What retires with tabs:** the tab strip and the documents menu (`rotationTabs.svelte.ts`, `DocumentTabs`), open/closed, Close, the **12-tab limit**, Recently closed, the Library's "open" mark (now "current").
- **Deleting** is a separate, deliberate act in the Library.
- ⚓ **An unnamed document stores no name; it shows a label derived from its contents**, styled as a placeholder (not yet named). Naming it is an ordinary edit.
  - **Rotation:** the matching saved team's name, else the characters' names ("Neuvillette · Furina · Kazuha · Baizhu"), shortened to fit. Derived, so it stays right when the team changes.
  - **Lineup:** its mode and season ("Stygian 7.1", "Abyss", "Custom lineup") — what the existing "the tab names the mode" intent asked for and the default "Lineup 1" ignores.
  - ⛔ Rejected: numbers ("Rotation 3": meaningless, and they shift), dates (the list already shows when), "Untitled" (every unnamed row looks the same). Duplicate labels are fine: rows also show portraits and last-touched time.

### 4.3 Accumulation and pruning

- **In a real profile**, nothing is pruned: it is your work. The Library's views and filters carry the load (§6.2).
- ⚓ **In Theorycraft:** a document opened from a link that you **never changed** drops off after a while (the link still exists if you want it again). **Anything you changed stays** until you delete it. ⏭ The window (§12).
- **Moving out of Theorycraft:** any Theorycraft document can be **moved (or copied) to a profile**. Arriving in a real profile, its owned characters start reading the roster — this is what "Sync" used to do, now a consequence of where the document lives. ⏭ Move or copy (§12).
  - **The Move confirmation lists what changes** before you commit (working copy: "In Main: Raiden reads C0 (this rotation: C2) · Furina is not owned, keeps C2"), because moving silently changes every owned character whose level differs. If the rotation exists _because_ of those levels, the list tells you to leave it in Theorycraft.
- ⚓ **The routing rule** (draft 4, Nate's "guest star"): **a document lives in the profile when it fits the account; if it doesn't fit, it lives in Theorycraft.** _Fits_ = every OWNED character at its roster level (unowned characters are free, §2.4).
  - **A document never stops fitting after the fact** (proposal): a profile document reads the roster live, so it fits by construction. Only a level CHOSEN against the roster makes a Theorycraft copy (§4.6). Lowering a constellation in the roster, or marking a character unowned, moves nothing.

### 4.6 ⚓ Compare, and the guest star (draft 4)

- ⚓ **Compare replaces tab switching** in the Planner (Nate, 2026-10-22). A rotation can be paired with ONE other; **⇅ flips which one the tool shows**, and a key does the same. ⚓ **No overlay and no ghost**: quick flipping is the whole feature, so the second rotation is never drawn at the same time as the first.
- **Compare is a pair, not a mode.** The pair is stored on the documents, so reopening either one from the Library brings its partner back; ✕ ends the pair (both documents stay).
- **Two ways in:**
  - **A what-if** (§2.4): choose a level an owned character doesn't have and the copy opens on its own, already paired.
  - **Compare** in the toolbar: **Duplicate and compare** (copy the current rotation, keep the original as the other side, edit the copy) or **Compare with…** (the Library in **pick mode**, §6.3).
- **Where a copy is saved follows the routing rule** (§4.3): a copy that fits stays in the profile; a copy that doesn't goes to Theorycraft. ⚓ Weapons and artifacts never open a comparison and never route a copy — a loadout is a document's own choice (§2.4).
- ⚓ **The guest star** (Nate, 2026-10-22): a Theorycraft document shown inside a real profile is marked with **Theorycraft's white**, which no real profile can wear (§2.3), so it can't be mistaken for any profile's own. While it's on screen the save status reads **Saved · Theorycraft**, and the white always comes with the word (colour is never the only signal). The FIRST time a copy is routed, a one-time notice teaches the rule (working copy: "Saved to Theorycraft · it doesn't match Main's roster"); afterwards the white and the status carry it.
- **A guest can be changed further without asking**: it is a Theorycraft document, so every value in it is its own (§2.2). A second character's what-if on the white side just edits the copy — which is why the cut linked form's "two characters" rule is unnecessary here.
- **Precedent:** Firefox's container tabs (one window, one tab marked with another context's colour).
- **From inside Theorycraft** (proposal): guests are ordinary Theorycraft documents with a small **from Main** mark; their pair with the real-profile document is not shown, because Theorycraft never reads a real profile.
- ⏭ **The roster catches up**: when you pull the constellation a guest assumed, the guest is redundant. Say so on it ("Your roster now matches this what-if")? (§12)

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

↻ **Draft 4** (demo 1's form 5, ⚓ Nate 2026-10-21, with tabs retired):

`[logo] critcalc.app ·· Builder [PLANNER / document] Visualizers ·· [Share ▾] [?] [⚙] [profile]`

- **Brand left, profile right** (⚓ the profile opposite the logo).
- ⚓ **Three equal tool buttons, centred**; the current one shows its document's name, the tool's name a faint line above it. The others are words on the night. No tool moves on a switch.
- ⚓ **The current tool's button is the Library's door** (draft 4): clicking it opens the full-screen state at Rotations or Lineups (whichever the tool makes), current document on top. There is no documents menu.
  - ⛔ **The Library glyph retires**: it would do the same thing as the button that names your rotation.
  - The Visualizers have no document: their button, current, does nothing.
  - **A guest** (§4.6) rings the button in Theorycraft's white, and the faint line reads _Planner · Theorycraft_.
- **The save status is brief** (⚓ 2026-10-21): _Saving…_ → _✓ Saved_, then it clears. "Not backed up" is the browser's storage, not the document's, so it is a badge on the profile picture.
- **Document verbs** leave the bar: Rename and Delete on the Library row, New at the top of the Library (and Teams' Plan a rotation), Clear on the tool's own controls. ⏭ Whether a small ⋯ verbs menu survives beside the name.
- **Share** stays visible (never behind an interaction); the Planner's menu keeps its link / KQM / image entries.
- **`?`** merges About and Help, and carries **Report a problem** — the visible feedback door the beta lacks.
- **⚙ Settings** stays visible (⚓ Settings is reached mid-task).
- **The old Roster icon goes**: the roster now belongs to the profile.
- ⏭ One control size for both bars — the fix for the survey's inverted size hierarchy (11px controls, 18px navigation) — and possibly a title bar shorter than today's 64px.

### 5.2 On a phone

⚓ The brand shows as the **logo only**, which frees room for the document:

`[logo] [document ▾] ··· [Share] [☰] [⚙] [profile]`

- ↻ **document** (no ▾ since draft 4) opens the Library, as on desktop.
- **☰** opens the full-screen state's index (tools at the top), replacing today's compass.
- Band A's separate row disappears; every tool gains ~33px of height.
- ⏭ Width check at 320px with the profile avatar added (§12).

### 5.3 The toolbar (replaces bands A and B)

One row, controls zoned over what they act on.

| Tool            | Left                                                                                         | Middle                 | Right                                        |
| --------------- | -------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------- |
| **Planner**     | ⏮ ▶ speed · Laps · Zoom (with Fit and the current %)                                        | Total · Compare (§4.6) | Buffs · Auras · Log · Notes                  |
| **Builder**     | over the roster: Search · filters · the roster lens (⏭ §12 Q on Owned vs My constellations) | —                      | over the board: ⏭ possibly nothing          |
| **Visualizers** | each tile's instrument picker, over its tile                                                 | —                      | Layout (lineup count + Reset as one control) |

- ⚓ **Human timing leaves the toolbar** (Nate, 2026-10-21) — to an indicator and its Settings entry; ⏭ exact form.
- **The Builder's season, No repeats and Add team move onto the board's own header** (a lineup's properties, as the game prints them on Party Setup). **Clear** moves into the document menu.
- **The Visualizers' Defaults moves into each tile's ⋯**, with a "changed" dot; the per-tile Share is renamed so "Share" means one thing site-wide.

### 5.4 What retires

Band A and band B as concepts (`ToolStack`'s two-band rule, `BAND_A_H`, the document/view split) · the chrome's Roster and About icons · `NavPanel` (the compass) · the Builder's empty rail plate.

### 5.5 ⚓ One place for every tool (Nate, 2026-10-22)

- **Every tool sits where the Planner sits today**: the straight tilt-up, centred, with no lean. The side-tool crane (`sideSign` in `transition.ts`, `crestPose`'s `lean`) retires, so the rise from the landing goes in one direction whichever card you pick.
- **Why:** the side-to-side pan said "the tools are places in a row", and this design makes them document types reached through the Library, ⇅ and Back/Forward, where a pan reads as arbitrary. The bench's glide across the pan, its best moment, already goes with the lineups reshape.
- **A tool changes IN PLACE** (a short fade); the landing ↔ tool rise stays.
- **A Settings option turns tool-to-tool transitions off** (the streamer: pretty but "fluff"), and `prefers-reduced-motion` turns them off on its own.
- ⛔ **No sideways offset and no knob for one.** The plate's side bleed is not spare width: it holds ultrawide screens and the phone's composition shift (`SCENE_NARROW_SHIFT`), so ⛔ the plates are not cropped either (the bleed is ~20% of the width, ~45 KB at the largest tier).

---

## 6. The full-screen state

### 6.1 Shape

- ⚓ A flip of the whole UI: **slate** (`ctx-dark`), covering the screen, no tool visible. The tool is kept, paused, exactly as a left tool page is today, so returning puts you back where you were.
- **The title bar stays** in both states, so the profile, the brand and the doors never move. ↻ ⚓ **The slate covers the WHOLE screen** (draft 5, Nate): the brand lockup and the bar sit ON it; only the night scene goes.
- ⚓ **The tool buttons stay, as plain navigation** (draft 5, Nate): another tool's button goes to that tool, out of the menu state; the CURRENT tool's button toggles its Library (from the tool into it; from anywhere in the menu state back onto the tool). ⛔ Rejected: every tool button opening its tool's saved work (an extra stop on every tool switch, and a button whose meaning depends on where you are); the sidebar names each Library place by its tool instead ("Rotations · Planner").
- ⚓ **The Visualizers have no saved content** (draft 5, Nate). Their current button does nothing. ⏭ Saved workspace configurations are a possible later want, not planned.
- **Switching profile inside the menu state stays at the section** (Roster stays Roster, for the new profile); only a pick ends.
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

- ⚓ **Draft 4: the Library is also the SWITCHER** (Nate, 2026-10-22: the form 5 dropdown already took two clicks to reach other work, and a full-screen list that is free of distraction and recognisable at a glance is a strictly better version of it). Opened from the current tool's button (§5.1); opening a row returns to the tool with that document; Escape or Back returns unchanged. ⚠️ It is now the main way to switch, so the flip must be FAST (the `--t-quick` band, ⛔ never the scene clocks), and the tool stays paused underneath.
- **Rotations as rows** — they carry long notation: team portraits, name, a **mini timeline strip** (recognisable faster than a notation excerpt), last touched, and marks for _current_ and _from a link_. **New rotation** heads the list.
- **Pinned** rows head the list, above Recent: a recency list reorders itself on every switch, and pinning is the cure.
- **Guests** (§4.6) show NESTED under the row they were copied from, framed in Theorycraft's white, never as rows of their own, so a burst of what-ifs can't clutter the list.
- **Pick mode**: the same surface, opened by the Planner's **Compare with…**, choosing a partner instead of opening a document.
- **Lineups as a grid of cards**, each card showing the teams inside as small portrait rows, so a lineup is recognised by its contents.
- **Order:** most recently touched first. Filters: by team (the link from a team card lands here), and ⏭ from a link.
- ⚓ **In Theorycraft:** the same two places, one recency list each, with a small **from a link** mark on documents that arrived by link (Nate considered a separate shared section; one list was chosen because people search by _when_, and an edited link is half theirs anyway). Pruning per §4.3.

### 6.4 ⚓ Reading surfaces: text on slate, paper as a PATCH (draft 5)

Help and About take the full-screen state, so they must use it well (Nate, 2026-10-22): **short strings, laid out**, never a 200-word block. Text sits straight on slate; **paper is used selectively**, as a patch where separation helps: a card per tool on Getting started, an example beside the paragraph that explains it, the keyboard table, the newest What's new entry, "Stored here" on Privacy. ⛔ Not everything on paper.

---

## 7. The inspector

- Reference opened **mid-task**, about ONE thing picked out of the work, read and never edited. Record: `docs/inspector-round.md`.
- ⚓ **The inspector is the CONTENT; each tool houses it in the shape its work wants** (Nate, 2026-10-23):
  - **Planner: a PANE** beside the timeline (the aside column), opened and folded by one button, because you read a cast against the chart.
  - **Builder: a MODAL** with room around it, because a character or a boss is read on its own and a dimmed edge is the quickest way out. One shell (`InspectModal`) for the character, the boss and a half's opponents; full screen below `compact`. The character modal carries the board's one fact as a line: "Adds to / Brings to <team>" (swap mode's `SwapDelta`). ↻ This replaces lineups §11.2's "details as a panel in the roster column".
  - **Visualizers: none.** Each tile's paper readout plays that part inside its instrument.
- ⚓ **Hover peeks, click inspects.** Clicking the thing already showing closes it. The picked thing wears the gold selected ring in the work, and a cast's token wears it in the notation too.
- ⚓ **Notes became the inspector's team page** (Nate: Notes disabled itself until a kit had a caveat, dead weight until then); the aside is Inspector | Aura log.
- ⚓ **The inspector reads, it never edits** (Nate). The one exception is the phone's Remove from team (the bench row has no rail).
- Planner pages: the team · a character · a buff bar · a cast (its pill, or a summon or shield it raised) · an always-on chip.
- ⏭ Deferred (Nate): weapons, artifact sets and reactions as their own pages.

## 8. Tools — what changes inside

This design doesn't redesign the tools' interiors; the structure survey's per-tool findings stand and are queued separately (Fit zoom, chart↔text linking, the Builder's card cap and board size, the Visualizers' catalog). What changes here:

- **Planner:** the bench's set-once targets merge (one loadout target per card); **Save as team** on the bench; values follow §2.4; **slots** (§8.1).

### 8.1 ⚓ Slots that hold (draft 5, Nate 2026-10-22)

**The problem** (the streamer): Library › team › new rotation opened with the bare names joined by swap connectors; he cleared the text to start writing, and the team vanished. The cause is the 2026-08-13 ruling that DERIVES the team from the notation (first four distinct names), so deleting text deletes characters, and the stub existed only to make the team exist.

**The rule:** a rotation stores **four slots** (the game's party keys 1–4), and the notation fills them.

- **A seated character with nothing in the notation is RESTING**, not gone: their card stays in its slot, dimmed, and their row draws nothing. They wake as they are written.
- **Slots hold until something needs them.** A typed name that isn't seated takes the first **empty** slot, else the first **resting** one, lowest number first. So a pure notation user starting from nothing sees today's behaviour (slots fill in typed order), and a changed mind never gets stuck: Bennett typed then deleted is resting, so Kazuha takes his slot.
- **Only ✕ on a card empties a slot on purpose** (its segments go with it, as today). ⇄ swap renames a character's segments and keeps the slot.
- **Plan a rotation** (Teams, a lineup, the Library) seats the four in the team's order, resting, in an **empty notation**, with a hint ("Start with a name: Neuvillette E > …"). ⛔ The stub of names joined by swaps retires.
- A fifth name with every slot awake keeps today's `--ui-provisional` flag.
- **Why order matters** (Nate): players are particular about which character is on which key, and the bench should match the party they know.

**Costs, accepted:** ⚠️ this **partly reverses the 2026-08-13 ruling** (memory `notation_single_truth`): the notation stays the truth for what HAPPENS; the slots become the truth for WHO is on the team and in which order, and "slot order = notation order" is undone on purpose. The `?r=` codec goes to **format 3** with an optional slots field (KQM export unchanged). **Undo must reach slots**: ⌘Z after typing Kazuha puts Bennett back, so slot changes ride the editor's history (a CodeMirror state field with invertible effects), designed in, not added later. ⚠️ The demo's plain textarea does NOT do this.

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

1. ⚓ A link (`?r=`, `?b=`, `?team=`) always opens in **Theorycraft** (↻ draft 4: it becomes Theorycraft's current document for that tool; whatever was there is in the Library, and Back returns to it), carrying the sender's values. **If another profile was active, the site switches automatically and makes it very obvious** (Nate, 2026-10-21): the switch cue (§9.4) plus a short notice — working copy: "Opened in Theorycraft · your profiles are untouched" — with **Move to a profile** beside it.
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
  - **Saved rotations** become **Rotations**; **saved boards** become **Lineups**. ↻ Draft 4: open tabs become ordinary Library documents, and each tool's ACTIVE tab becomes its current document.
  - **Recently closed** entries become ordinary Library documents (⏭ or are dropped).
  - **Stored constellations that disagree with the roster** for owned characters: under the strict rule (§2.4) they would silently change. ↻ Draft 4 proposal — the routing rule (§4.3) answers it: the rotation stays in the profile (reading the roster), and a **Theorycraft guest with the stored levels is created and paired with it** (§4.6). Nothing is lost and nothing changes silently: ⇅ shows both.
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
- ↻ Draft 4: **rotation and lineup TABS** (`rotationTabs.svelte.ts`, `DocumentTabs`, the 12-tab limit, Recently closed) · this design's own draft-3 §4.2 (per-profile open tabs) and draft-2 what-if LENS (§2.4) · demo 1's form 5 documents MENU.

---

## 12. Open questions

**Model**

1. ~~Overrides in a real profile~~ — ✅ settled: loadouts free (draft 2); ↻ a constellation what-if is a Theorycraft copy, compared (draft 4, §2.4, §4.6). The lens's persistence question is gone with the lens.
2. ~~Team order~~: ✅ stored and shown, in party order (draft 5); a rotation's slots carry it too (§8.1).
3. ~~Team notes~~: ✅ not for now (draft 5).
4. Which **settings** are per profile, if any (Human timing and swap ping feel personal to the player, not the account)?
5. ~~Avatar, colour cap~~ — ✅ settled (§2.3): seven real profiles.

**Saving**

6. ~~Default names~~ — ✅ derived labels (§4.2).
7. ~~Open-tab limit~~ — ↻ gone with tabs (draft 4, §4.2).
8. ~~Move vs copy~~: ✅ **Move** (draft 5), with the confirmation listing what changes (§4.3). Between two real profiles: still open.
9. The Theorycraft **pruning window** for untouched link documents.
10. ~~Storage engine~~ — ✅ IndexedDB, sync-ready records (§4.4).
11. Backup v3: all profiles, or per profile?

**Journeys**

12. ~~Link while a profile is active~~ — ✅ switch automatically, loudly (§9.3). **Still open:** the shape of the colour wash, and whether the permanent cue includes a title-bar line.
13. ~~Own open tabs~~ — ↻ a profile owns its CURRENT documents (draft 4, §4.2).
14. ~~The invitation~~: ✅ both places (draft 5): an **Add your account** pill beside the picture in the bar (hidden on a phone, where the bar has no room), and a paper panel where Roster and Teams would be. ⏭ What "Add your account" itself asks for (name, picture, colour) is demo 3's or later.

**Surfaces**

15. ~~Names~~ — ✅ the menu state; the top bar / the toolbar; the You group titled by the profile's name (§6.1).
16. ~~Slate or paper~~: ✅ text on slate, paper as a patch (§6.4).
17. The **flip transition**.
18. ~~The inspector's home~~: ✅ a modal in the Builder, a pane (a drawer on a phone) in the Planner (§7).
19. The Builder's roster lens: **Owned/Wishlist vs My constellations** (Nate: room for a clean concept; raise at that stage).
20. Human timing's **new form** off the toolbar.
21. **One control size** for both bars, and the title bar's height.
22. The phone title bar at **320px** with the profile added.

**Draft 4 (tabless)**

25. ⚠️ **Two browser tabs on one profile.** Without our tabs, the browser IS the tab system for anyone who wants two rotations side by side, so concurrent autosave stops being an edge case: two windows writing one profile, last write wins, work lost. Is the current document **per browser tab** (session-scoped, falling back to the profile's last)? Writes need a BroadcastChannel or a lock. Must be decided before the build.
26. The **previous-document key** (and whether it is the same key as ⇅ when a comparison exists).
27. (proposal, unvetoed: the Builder's button reads "Swapping slot 2 · _rotation_" during an audition) **Swap mode** (⇄ on a Planner card → the Builder) names the Builder's current LINEUP in the title bar while you are really auditioning for a ROTATION: the title bar needs a mode form for it.
28. (proposal, unvetoed) **The roster catches up** with a guest (§4.6): say so on the guest, offer to delete it, or nothing?
29. A small **⋯ verbs menu** beside the document name, or nothing in the bar at all (§5.1)?
30. Whether opening another document from the Library while a comparison is showing ENDS the pair or leaves it stored (proposal: stored — the pair belongs to the documents, ✕ ends it).
31. **Share from a real profile** must write the roster's levels into the link at the moment of sharing (a profile document no longer stores them).

**Process**

23. ~~Which demos first~~: ✅ demo 1 (bars), 1b (tabless), 2 (menu state) built on `experiment/lab-bars-tabless`; demo 3 (the inspector) is designed during phase 1–2 of the build.
24. ~~The build order~~: ✅ §13.

---

## 13. ⚓ The build plan (2026-10-22, Nate approved the approach)

### 13.1 The release strategy: incremental in the code, ONE release for users

- **Slots ship first, on their own** (phase 0). They fix a live bug (the streamer's vanishing team), touch only the Planner, the codec and undo, and revert cleanly.
- **Everything else is built on `main` behind a switch**, off by default, merged piece by piece through short feature branches (⛔ no long-lived branch: data rounds keep landing on `main`). Users see nothing until it is turned on.
- **Nate turns the switch on for himself on the live site** (Mac, iPhone, real Safari, real data) for as long as it takes. A tester can be handed the same switch as a link; ⛔ no separate preview subdomain (Nate, 2026-10-22: no testers to hand; the switch makes a stranger test free whenever one is possible).
- **When it is right, the switch becomes the default**: one release for users, one migration, the new shape met once.
- ⚓ **The migration only ever COPIES.** Today's `localStorage` keys are never deleted until well after the switch is the default, so a bad migration can be re-run and nothing is lost. A backup prompt comes before the first switch-over.
- **The first weeks after release are the real test**: Report a problem must be prominent through them.

### 13.2 Phases

| Phase                            | What                                                                                                                                                                                                                                                                                    | Ships                                   | Retires                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| **0. Slots** (§8.1)              | `slots` on a rotation; the seat/rest rule; ✕ the only deliberate removal; slot changes in the editor's undo history; codec format 3 (optional slots); the stub of names joined by swaps retires (an empty notation, the team resting)                                                   | **Live, on its own**                    | team-from-notation derivation (partly); the bare-names stub |
| **1. Foundations** (§4.4)        | IndexedDB store; profile, document and team records shaped for sync (stable id, last-changed, tombstone); the copy-only migration (§10) creating **My account** (the Traveler in the player's chosen twin, ⚓ Anemo ring; ⚓ Nate 2026-10-22) and Theorycraft; the two-tab rule (§13.3) | On `main`, dormant                      | —                                                           |
| **2. The switch-over**           | profiles + Theorycraft + link routing (§9.3); the top bar and toolbar (§5); one document per tool + autosave (§4.1–4.2); the menu state with the Library, Help, About and Settings (§6), every section its own URL (§13.4); the compass, tabs and both bands retire                     | Behind the switch, then **the release** | §11's list                                                  |
| **3. Teams** (§3)                | Teams in the menu state; Plan a rotation / Add to a lineup; Save as team; Move from Theorycraft with its list of what changes (§4.3)                                                                                                                                                    | Behind the switch (or after)            | the Library's team entries                                  |
| **4. Compare and guests** (§4.6) | pairs and ⇅; the what-if copy; routing and the white guest                                                                                                                                                                                                                              | After the release                       | —                                                           |
| **5. The inspector** (§7)        | demo 3 first, during phases 1–2                                                                                                                                                                                                                                                         | After                                   | the detail modals                                           |

Phases 2 and 3 may ship as one release if Teams is ready; a profile without Teams is coherent (the Library still holds work), so 3 does not block 2.

### 13.3 ⚓ Two browser tabs on one profile (§12 Q25, Nate approved)

- **The problem:** each tab holds its own copy in memory and autosaves; the tab that saves last silently overwrites the other's work.
- **A per-DOCUMENT lock** (the Web Locks API): a document open in one tab is read-only in another, with "Open in another tab · Edit here", and _Edit here_ takes the lock (WhatsApp Web's "Use here"). Different documents in different tabs stay fully editable, so the browser works as the tab system (§4.2).
- **A broadcast for everything else** (BroadcastChannel): any save tells the other tabs, which refresh the Library, the roster and anything listing the document.
- **Why this is the stable form:** the browser holds and releases the locks itself, so a closed or crashed tab can never leave a stale lock (the failure of hand-rolled "is it open" flags); both APIs are in every current engine, Safari included; IndexedDB writes are atomic.
- **The current document is per browser tab** (session-scoped), falling back to the profile's last one on a fresh tab.

### 13.4 Addresses (§6.1, Nate approved)

`/library/rotations`, `/library/lineups`, `/roster`, `/teams`, `/help`, `/help/planner`, `/help/builder`, `/help/shortcuts`, `/about`, `/whats-new`, `/privacy`, `/settings`; the old paths redirect (`static/_redirects`), and every new route takes its two entries (`seo.ts` + `sitemap.xml`). ⏭ Which of them are indexable (Help, About, Privacy) and which are `noindex` (the profile's own data).

### 13.5 Settings: per person or per account

- **Per profile:** the roster, teams, documents, ⚓ **the Traveler twin** (an account fact).
  - ⚓ **In the notation** (Nate, 2026-10-22): `Anemo Lumine` / `Cryo Aether` name a twin; a bare `Anemo Traveler` reads the profile's twin (in Theorycraft, a default). The other twin in a real profile is a value that doesn't fit the account, so it routes to a Theorycraft guest like a constellation what-if (§4.3, §4.6). ⏭ Needs the twin-frames data fix first: gcsim splits Aether/Lumine frames in all seven elements and we ship Aether's for both (the to-do list's Queue).
- **Global (the person at this browser):** ⚓ **new outfits** (a display taste, Nate 2026-10-22), display, playback, Human timing, swap ping, the Visualizers' layout, the storage stamps. (§12 Q4 otherwise stays open per setting.)
