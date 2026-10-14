# The pre-launch sweep (2026-10-14)

Ten parallel reviews of the whole site before connecting the domain, each followed
by an independent verify pass and then a fixer. Branch `sweep/prelaunch`, 41
commits from `8c7a9978` to `97675187`. ⚠️ **Nothing is pushed or merged.** On
Nate's instruction (2026-10-14), text with a clear right answer (stale, false, or
already ruled in the glossary or style guide) was fixed directly; anything where
his preferred wording was in doubt is in §3.

## 1. Headline

- **Found:** 116 findings across ten areas (planner 15, engine 9, builder 16,
  visualizers 11, site 20, state 13, leftovers 14, text 12, data 3, runtime 3).
  Several areas found the same thing (the `energy` meta, "bank", board → lineup,
  the backup gap), so this is **95 distinct issues**.
- **Confirmed:** 114 (93 distinct). **Uncertain:** 2 (`builder-13`, a stale
  Planner swap that needs an A→B→A within the 4s page hold; `visualizers-11`,
  Shatter vs Shattered). **Refuted:** 0. Only one part of one finding was
  refuted: `site-11`'s claim that the `/settings` meta is wrong. Settings does
  hold the roster's backup and reset, so that meta stays.
- **Fixed:** 83 distinct issues. Three of those are partial: `data-2` (one
  region of eight), `leftovers-10` (the portal generator was kept) and
  `builder-15` (only "RES shred" and the help meta).
- **Skipped:** 2 (`builder-13`, uncertain and post-launch; `site-17`, the
  report channel, already a launch item).
- **For Nate:** 22 items (§3). ⏰ Item 1 is due **tomorrow**.

**Gates on `97675187`:**

- `npx vitest run`: `Test Files 83 passed (83)`, `Tests 2338 passed (2338)`.
  Two suites are fewer than at the start because `barCycles` and
  `constellationFilter` were deleted along with their tests.
- `npm run check`: `721 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS`.
- `npm run lint`: during the sweep it failed on one file only, the untracked
  inventory doc (prettier). This commit formats and commits that doc, so lint is
  clean again. `eslint .` was clean throughout.
- `npm run build`: exit 0, no generated-file drift.
- **e2e, WebKit:** `74 passed (1.8m)`, exit 0.
- **e2e, Chrome:** `74 passed (5.8m)`. It exited 1, but that is the upstream
  worker-teardown hang ("worker-N process did not exit within 300000ms after
  stop, force-killed it") with every test green. The first Chrome run showed
  `1 failed` / `73 passed (6.0m)`. The failure was `e2e/viz-workspace.spec.ts:47`,
  which was still looking for the badge text `'Slot 2'` after `cf075419` renamed
  it "Tile". `97675187` updated the spec to match, and the text change stays.
- ⚠️ Real Safari and real touch devices were not checked. The CLAUDE.md rule
  applies: nothing visual counts as verified until Nate has looked.

## 2. Fixed

Items are grouped by area. The id in brackets is the finding; aliases from other
areas follow a slash. Text changes are written **Now → New**, so any of them can
be vetoed by its line.

### Planner: behavior

- An arriving document (Library open, `?r=`, `?team=`, a team sent from the
  Builder) no longer overwrites a fresh tab you have typed into. `adopt()` reads
  the active tab's live text when it looks for a spare tab (planner-1, data
  loss). `97291e2a`
- Reset this rotation clears the tab's `synced` flag, so the next save does not
  file a synced entry you never chose (planner-12). `97291e2a`
- The Always-on buffs strip gates its constellation chips on the tab's own
  constellations, not the roster's (planner-2). `e854973f`
- Leaving the planner stops playback, which used to keep sounding for up to 4s
  from the paused page (planner-4). `156c1d39`
- The narrow Log/Notes drawer, and the Builder's Filters drawer, closes when you
  navigate away. Before, it could stay pinned over the next tool (planner-13;
  inferred from the code, see §3 item 19). `156c1d39`
- Close all rotations sends every tab worth keeping to Recently closed
  (planner-3 / state-4). `d2e69cc8`
- Opening a saved rotation that is already open switches to its tab, as lineups
  already did, instead of making a second linked tab (state-6). `d2e69cc8`
- Band A's Save label checks that the linked entry still exists, so it no longer
  says "Save changes" for one the Library deleted (state-5). `boardBar` got the
  same live read. `d2e69cc8`
- Undo/Redo tooltips off Apple platforms: **"Undo (⌘Z)" / "Redo (⌘⇧Z)" →
  "Undo (Ctrl+Z)" / "Redo (Ctrl+Shift+Z)"**. RosterTab's off-Mac **"Undo (CtrlZ)"
  → "Undo (Ctrl+Z)"** (planner-9 / text-3). `2c8c48a2`
- An all-Moonsign team, or a Moonsign pair beside empty slots, no longer draws an
  empty Ascendant Gleam lane (runtime-3). `52ab3707`

### Engine

- A same-character `>`, which includes every Laps join that lands on the opener,
  no longer ends stances, `terminatesOnSwap` states or state chains
  (engine-1). One existing test wrote its swap that way and now swaps through a
  second stub. The timing half is still open, see §3 item 6. `a8af205d`
- Zero-time tokens (`{key:N}`, `/Q`, `(…)`) no longer change the cancel window
  of the action before them. This is the bug class already fixed for `W`, and it
  made lap 1 and later laps time the same actions differently (engine-2).
  `0eb1d96c`
- `sC` takes the C cancel from the swing before it instead of the swap slice
  (engine-3). `0eb1d96c`
- Lint for `sE` on a character without one: **"Bennett can't perform sE — this
  cast is drawn with generic timing." → "Bennett has no sE variant — timed as a
  plain E."** (engine-4). `91a5728b`
- Engine, schema and tokenizer comments now describe the current code
  (engine-7/8/9). They also stop claiming two summon resolvers "must stay
  identical", because there is one; `src/lib/CLAUDE.md` is updated to match.
  `b7c1ace6`, `1abf9039`

### Team Builder

- A team sent to a full Stygian or Abyss lineup shows "The lineup is full"
  instead of adding a team that can never be removed (builder-1). `8fbc7c91`
- A Library pick during the Planner swap ends the swap first, so it lands on the
  lineup you can see (builder-2). `8fbc7c91`
- The details card's team button is hidden while swapping. It used to say "Team
  full" while a pick would have swapped (builder-10). `8fbc7c91`
- Library hint on a battlefield lineup: **"Put on Team 2" → "Put on Battlefield
  2"**, and the same for Pin (builder-4). `637cdb6c`
- Board rows' screen-reader names: **"Team N" → the visible label ("Battlefield
  N", "First half")** (builder-5). `637cdb6c`
- **"First Half" / "Second Half" → "First half" / "Second half"**
  (builder-6 / text-10). `637cdb6c`
- My constellations hint: **"Uses your saved constellations (set them in a
  character's details)" → "Uses the constellations in your Roster"**
  (builder-7 / text-4). `637cdb6c`
- Swap tier: **"Not curated yet" → "Not yet curated"** (builder-8). `637cdb6c`
- Uncurated note: **"Absence of a badge here means "unknown", not "no"." → "A
  card with no capabilities here means "unknown", not "no"."** (builder-9).
  `637cdb6c`
- board → lineup on screen, per glossary §1 (ruled 2026-10-12) (builder-11 /
  state-12 / text-5). `637cdb6c` **"Board 1" / "Board N" → "Lineup 1" /
  "Lineup N"** (new defaults only; saved tab names keep their stored label) ·
  **"New board" → "New lineup"** · **"Loaded shared board" → "Loaded shared
  lineup"** · **"Shared board" → "Shared lineup"** · **"Team added to the board"
  → "Team added to the lineup"** · **"The board is full" → "The lineup is full"**
  · **"Save this board to your library" → "Save this lineup to your library"** ·
  **"Copy a link to this board" → "Copy a link to this lineup"** · **"Add to the
  board[, pinned]" → "Add to the lineup[, pinned]"** · **"Put on a board" → "Put
  on a lineup"** · **"Boards that use it…" → "Lineups that use it…"** (three
  variants) · tag **"Board" → "Lineup"** · kicker **"Boards" → "Lineups"** ·
  **"No board matches." / "No saved boards yet." → "No lineup matches." / "No
  saved lineups yet."**
- The retired Compare action is gone from DetailCard (props, button, CSS), along
  with the `compare` mark and `serializeTeamParam` (builder-12 / leftovers-2 /
  text-7). The Builder's stale comments went in the same commit (builder-16).
  `4c02673e`
- Capability hint: **"Buffs allies' Crit Rate / Crit DMG" → "Buffs allies' CRIT
  Rate / CRIT DMG"** (text-8). `f471c99a`
- Resonance tooltips capitalize elements, Frozen and CRIT Rate. For example,
  **"CRIT rate +15% vs frozen or cryo-affected enemies; electro aura duration
  −40%" → "CRIT Rate +15% vs Frozen or Cryo-affected enemies; Electro aura
  duration −40%"**; the six other rows change the same way (text-9). `f471c99a`

### Visualizers

- The ICD → Gauge handoff drops hits past the gauge's 15s axis instead of
  stacking them all at 15s. Send button title: **"Sends the hits that apply an
  element — each as 1U, since this ICD Timeline doesn't specify gauge sizes." →
  "Sends the first 8 hits within 15s that apply an element — each as 1U, since
  the ICD Timeline doesn't model gauge sizes."** (visualizers-1). `8c7a9978`
- A tile's Share shows **"Share failed"** when the clipboard write fails, instead
  of an unhandled rejection with no feedback (visualizers-8). `14773399`
- Damage Breakdown with a Stellar Swirl blast picked: **"On average, one Stellar
  Swirl blast, 3+ swirls hit would deal …" → "On average, one Stellar Swirl
  blast after 3+ swirls would deal …"**, and the row line now reads **"A Stellar
  Swirl blast after 3+ swirls multiplies the base by 3, …"** The picker labels
  are unchanged (runtime-1). `c65933a7`
- `cf075419` (visualizers-2/3/4/5/6/9/10, site-19):
  - Help: **"Single target only: Swirl spreading, Shatter, and what happens to
    Dendro Cores after they spawn are out of scope." → "Single target only:
    Swirl spreading and Shatter are out of scope."** The Gauge Explorer does
    simulate Hyperbloom and Burgeon.
  - Help: **"…after a set number of hits…" → "…after a set number of
    applications…"**
  - **"Grey shows every +20 …" → "Gray shows every +20 …"** (×2) and
    **"coloured" → "colored"**.
  - Picker badge **"Slot N" → "Tile N"**. Help: **"choose which instrument lives
    in that slot" → "choose the instrument it shows"**.
  - Help: **"each tile can be reset on its own without disturbing the others" →
    "a tile's Defaults puts that instrument's controls back without disturbing
    the others"**.
  - ICD element chips' name and tooltip: **"electro" → "Electro"**.
  - Help: **"crystallize" → "Crystallize"** · **"see its reactions' damage at a
    given level" → "see its reactions one by one"** · **"ATK, HP or DEF" → "ATK,
    HP, or DEF"**.

### Saved data and storage

- A backup now carries saved lineups and every current setting (coverage strips,
  toggled layers, the seven playback fields), and restores a saved rotation's
  `synced` flag and opened time. The import summary counts lineups and no longer
  counts names-only teams as rotations. Reset saved data gains a **Saved
  lineups** row, and Clear all clears lineups too (state-1/2/8 / site-1). Restore
  description: **"Load a backup file. This replaces everything on this device." →
  "Load a backup file. It replaces your roster, loadouts, saved rotations, saved
  lineups, and settings on this device."** `6ca3427b`
- A browser that blocks site data, or a full quota, gets a site that works for
  the session instead of controls that throw on every write. A failed import
  says **"This browser isn't letting critcalc save data."** (state-3).
  `c49268d5`
- The Coverage page shows your Traveler and outfit choice on a hard load
  (state-7). `b5b4a374`
- `617c4464` (planner-7 / state-9 / text-6, state-10, state-11):
  - **"Save this team and rotation to your bank" → "…to your library"**.
  - **"…unlink it from the bank" → "…unlink it from your library"**.
  - Reset rows: **"Loadout labels" → "Loadouts"** · **"Clears every saved weapon
    and artifact label." → "Clears every character's saved weapon and artifact
    set."** · **"Deletes every rotation in Saved rotations." → "Deletes every
    rotation and team saved in your library."**
  - Privacy: **"You can wipe everything at any time from the same place, or…" →
    "You can clear your saved data at any time from Settings → Reset saved data,
    or wipe everything by clearing this site's data in your browser
    settings."**, and its list of what is stored now names lineups.
- Persistence-module comments describe the surfaces that exist (state-13,
  planner-15). `15c3670c`, `9d615fa6`

### In-tool and Settings text

- Aura log limits (planner-5/11 / text-1/2 / runtime-2). `98825549`
  - **"Hits land on their listed timing. A swing that hits several times counts
    as one application, and Shatter is not modelled." → "Hits land on their
    listed timing, and Shatter is not modeled."** Every landing has applied
    since Phase B. The Help chapter got the same fix.
  - **"A pip with a yellow ring means we are using a default gauge strength of
    1U for that hit rather than a measured one." → "A pip with a yellow ring has
    no measured gauge strength, so the Rotation Planner uses 1U for that hit."**
  - **"…not where — we assume you are standing in it." → "…not where — the
    Rotation Planner assumes you are standing in it."**
  - **"no auras you did not put there" → "no auras you didn't put there"**.
- Lane headings are now sentence case in the source; CSS still makes them
  uppercase, so nothing changes on screen (planner-14). `98825549`
- Bench card's uncurated mark: **"Frame timing not curated yet — capabilities
  are complete, but Planner timing is approximate" → "Frame timing not curated
  yet — the Rotation Planner draws this character's actions with generic
  timing"** (planner-10). `98825549`
- Settings, Human timing lede (planner-8 / site-10). `4a3a789c`
  - **"The rotation planner…" → "The Rotation Planner…"**.
  - **"The Human button on the planner's toolbar times it the way a person does."
    → "Human timing in its view bar times a rotation the way a person plays
    it."**
  - **"Play on the planner's toolbar" → "Play in the Rotation Planner's view
    bar"** · **"cancelling" → "canceling"**.
  - ⚠️ The lede's first clause is still false; see §3 item 3.
- Settings, Human timing options: **"Full animations let each action finish
  instead of cancelling it." → "Animations lets each action finish instead of
  canceling it."** Both option names are now bold, per style guide §2 (text-11).
  `d0e081a5`

### Static pages and meta (`4a3a789c` unless noted)

- Team Builder help: the whole **"Comparing and assembling"** section is deleted
  (Compare, audition, Take slot, the shared bench). Its replacement is §3 item 13
  (site-2).
- Team Builder help, in place (site-4):
  - **"The middle panel has two tabs. Browse by capability in the Atlas, or by
    identity… in the Roster." → "The icons above Characters filter it by role,
    by element, and by what a character can provide; More adds weapon, rarity
    and region."**
  - **"Conditional badges are shown in italics…" → "Each card shows what that
    character can provide: lit at the constellation you are reading at, dim
    where it takes a higher one…"**
  - **"The switch offers three readings:" → "The lens reads every kit at any
    level from C0 to C6, or at your own:"**
  - **"set it once and the Rotation Planner reads the same levels" → "set it once
    in the Library's Roster tab and…"**
  - A missing badge → **"a card with no capabilities means 'unknown'"**.
- Planner help, Team section (site-5):
  - **"The bench's ⇄ hands that slot to the Team Builder to compare replacements
    against, and ✕ removes the character…" → "…you remove someone by deleting
    their part of the notation. On a wide screen, click a bench portrait to swap
    that character in the Team Builder… an empty slot adds someone instead."**
  - **"Click a team portrait to read that character's details. Each portrait
    also carries chips…" → "The magnifier on a portrait opens that character's
    details. The constellation sits on the portrait, and the pill beside it
    holds their weapon and artifact set…"**
  - **"…apply to the plan (the tab you're in)… The bench is one and the same team
    in both tools…" → "…apply to the rotation in that tab, and each tab is its
    own team. Your roster stays as it is unless you change it in the Library's
    Roster tab."**
- Planner help lede: **"It visualizes timing and windows; it never computes damage
  numbers."** is deleted (site-6).
- Planner help, glossary names (site-7):
  - **"one plot with a line per element" → "a gauge line for each element"**.
  - **"Above the plot" → "Above the gauge lines"**.
  - **"Under the plot: what the reaction left behind." → "The reaction spawns:
    what a reaction leaves behind."**
  - **"their own strip" → "their own rows"** · **"The strip only appears" → "The
    reaction spawns only appear"**.
  - **"hides the lane and the strip under it" → "hides the whole aura lane,
    reaction spawns included"**.
  - **"Outside the notation editor" → "Outside the composer"** · **"the view
    controls" → "the view bar"**.
- US spellings in the Planner help, About and Settings: modelling/modelled,
  cancelling, labelled, neighbour → modeling/modeled, canceling, labeled,
  neighbor (site-8).
- Planner help, limits belong to the tool (site-9):
  - **"a token we don't simulate… we took it" → "a token the Rotation Planner
    doesn't simulate… the Rotation Planner took it"**.
  - **"We assume you are standing in the field; we do not model walking out of
    it." → "The Rotation Planner assumes you are standing in the field and
    doesn't model walking out of it."**
- Meta (site-11/12 / planner-6 / leftovers-6/7/9):
  - `/planner`: **"cooldowns, energy, buff windows and who is on field when" →
    "cooldowns, buff windows, auras and who is on field when"**. Energy is not
    modeled.
  - `/help/builder`: **"capability facets, constellation modes, comparison and
    team slots" → "capability filters, constellations, lineups and swapping a
    character"**.
  - Landing: **"Mechanics made visible — no tier lists, no verdicts."** is
    deleted.
  - `/builder`: **"resistance shred" → "RES shred"**.
- About and FAQ: **"an independent, non-commercial fan project" → "an unofficial
  fan project"** (site-13).
- About: **", and compare their timings side by side"** is deleted. FAQ: **"the
  planner timeline and the Team Builder's comparison in particular reward the
  room" → "the planner timeline in particular rewards the room"** (site-14 /
  leftovers-8).
- Contribute: **"the action notation this planner reads" → "the action notation
  the Rotation Planner reads"** (site-20).
- The static pages' chapter fade uses `motion(T_QUICK)`: still 150ms, and 0 under
  reduced motion (site-16). `9ae5ebcf`
- **`static/_headers`:** the launch-flip note no longer names the past date
  2026-08-11 (site-18). `6b84c41d`

### Leftovers and data

- Deleted `barCycles.ts` (the retired Compare's tiling module) (leftovers-1).
  `4e8ba33f`
- Deleted `constellationFilter.ts`, whose last consumer went in July
  (leftovers-3). `3b6c2eb1`
- Deleted `src/lib/data/index.json` and `artifacts_index.json`. Nothing reads
  either; memory is updated (leftovers-4). `81f63b69`
- The ingest-character skill and `src/lib/CLAUDE.md` say `manual` is retired.
  `audit-manual-triggers.mjs` is deleted (leftovers-5). `c83d4a9d`
- Deleted the May-2026 curation automation: six `run-*`/`schedule-*` scripts and
  `strip-constellation-effects.js`. See §3 items 2 and 16 (leftovers-10).
  `c0490a19`
- Uninstalled `bits-ui` and the static `@fontsource/ibm-plex-sans`; nothing
  imported either. The build still ships all three Plex faces (leftovers-11).
  `8e8d93ae`
- Deleted two misexplained `procs.ts` aliases and five unreferenced exports;
  `RIBBON_RESTING_H` is kept on purpose (leftovers-12). `5a51122d`
- Comments that named the bench ✕, the audition or Compare as live now name
  today's callers (leftovers-13). `500aa476`
- CLAUDE.md: **"68 tests per engine" → "~74 tests per engine — `npx playwright
test --list --project=chrome` for the current count"** (leftovers-14).
  `902078a5`
- Zibai gets `"region": "Liyue"`, so the Liyue chip finds her (data-2, partial;
  see §3 item 14). `genshin-db-diff.md`'s scan count is refreshed from 126 to 128
  (data-3). `ae9d250f`

## 3. For Nate

Answer in the terminal by number ("1 Rosy Moon, 2 done, 3 ok, 5: no …"). Where
there is no "Now:" line, the item is a decision rather than a wording.

1. ⏰ **The Spiral Abyss resets tomorrow (2026-10-16).** `season-dates.json`
   holds only Cascading Moon, so from tomorrow the Abyss lineup keeps presenting
   last cycle's blessing, Floor 12 halves and enemies as current
   (builder-14 / data-1). The table is hand-kept by ruling (no leaks).
   → Give me the new blessing's English name. I'll add the line and re-run
   `fetch-endgame.mjs` + `build-endgame-art.mjs` once it is live. Optional
   guard, also your call: once the newest cycle's `end` has passed,
   `currentAbyss()` returns nothing, so the board drops to its no-banner form
   instead of passing an old blessing off as current.
2. **Two LaunchAgents on your Mac still fire every day:**
   `app.critcalc.curation-overnight-0330` and `-0900`. They run
   `scripts/run-curation.sh --count 3`, which calls
   `claude --dangerously-skip-permissions` on main. Their 2026-10-12 log shows
   them firing and failing on PATH. Now that the script is deleted (`c0490a19`),
   they fail on the missing file, and I did not touch `~/Library`.
   → Run `launchctl bootout gui/$(id -u)/app.critcalc.curation-overnight-0330`
   (and `…-0900`), `rm` both plists from `~/Library/LaunchAgents/`, and
   optionally delete the gitignored `.curation-logs/`. Say "2 do it" if you'd
   rather I run those commands.
3. **"Frame-perfect by default" is false.** `humanTiming: true` has been the
   default since 2026-09-24 (`stores.ts:607`), and a shared link opens with the
   reader's own setting, not frame-perfect. The inventory lists this too.
   Now (Settings lede): "The Rotation Planner is frame-perfect by default: every
   cancel lands on the first frame the game allows, the way a macro plays.
   <strong>Human timing</strong> in its view bar times a rotation the way a
   person plays it."
   → "Without Human timing, the Rotation Planner is frame-perfect: every cancel
   lands on the first frame the game allows, the way a macro plays.
   <strong>Human timing</strong>, on by default in its view bar, times a
   rotation the way a person plays it."
   Now (Planner help :72): "By default the chart is frame-perfect: every
   cancel…" and (:81) "a link you share opens frame-perfect for whoever follows
   it."
   → "With it off, the chart is frame-perfect: every cancel…" and "a link you
   share opens with whatever setting the person following it has."
4. **The 1U line now differs between the tool and Help.** In the tool the aura
   log reads "…so the Rotation Planner uses 1U for that hit". `site-9` left the
   Help sentence alone, as a modeling choice under style guide §1.4.
   Now (Planner help :158): "Where we do not have a measured gauge strength for
   a hit we use 1U and…"
   → "Where a hit has no measured gauge strength, the Rotation Planner uses 1U
   and…"
   In the same chapter, Now (:172): "or ⌘Z" → "or ⌘Z / Ctrl+Z".
5. **Should the composer flag a `C` drawn with the generic charge profile, the way
   it flags a frameless `P`?** About 15 framed claymores (Diluc, Eula, Navia…)
   have no `chargeFrames`, and the Coverage page already calls them stand-ins
   (engine-5). → Yes: add a `charged` index fact and mark it provisional with
   "{name}'s charged attack isn't measured yet — drawn with generic timing."
   (the plunge line's shape). If yes, also flag `sC` on a character without one:
   "{name} has no special charged attack — timed as a plain C." (engine-6). The
   cost is a yellow squiggle on every C those claymores write.
6. **The timing half of the same-character join is still open.** After
   `a8af205d` the states survive a same-character `>`, but the action before
   the join still takes the end-of-segment swap slice, and the second segment
   restarts the normal-attack string. `Xilonen E N2 > Xilonen N2` totals 93f,
   against 129f for `Xilonen E N2 N2`. Laps reaches this whenever a rotation
   ends on its opener. → Fix it in the sim: a same-character join continues the
   string and uses the next action's cancel. This needs its own before/after, so
   it was not done at night.
7. **The Planner swap after Escape or ✕.** Leaving the slot but not the swap
   shows a destination strip that is lowercase and false (builder-3).
   Now: "the Planner's team is full. Pick a member again to remove them."
   → "Pick a portrait in the Planner's team to replace it."
   The alternative is to make Escape/✕ end the whole swap, so this state never
   shows.
8. **The `/builder` meta still describes the pre-lineups tool** (builder-15; only
   "RES shred" was changed).
   Now: "Find who covers what — healing, shielding, RES shred, buffs — at which
   constellation, with the ability and the caveat that comes with it."
   → "Build lineups for Stygian Onslaught and the Spiral Abyss: see what each
   team brings — healing, shields, RES shred, buffs — at your constellations,
   and what a swap would change."
9. **The planner's log panel is headed "Target aura"**, but glossary §1 rules
   "Aura log" for both tools, and the button that opens it says "Log" (text-12).
   Now: "Target aura" (panel heading and phone-drawer title)
   → "Aura log". The lane heading TARGET AURA stays.
10. **The ICD Timeline and Reaction Curves have no Share button**, and Help says
    Share "reopens an instrument exactly as it looks" (visualizers-7).
    → Add share state to both (`v:1`, sanitized like the other six; no codec
    change). Or, Now (Help :24): "…a <strong>Share</strong> button…"
    → "Most instruments have a <strong>Share</strong> button…"
11. **Shatter or Shattered?** The library doc names the reaction "Shattered".
    Your Frozen/Overloaded ruling (the game's name) covers only those two
    (visualizers-11). → If it extends: "Shatter" → "Shattered" on about seven
    surfaces (the Reaction Curves list and its hit line, the breakdown, the aura
    displays, the aura log limit, two help chapters), plus a glossary §2 row. If
    not, nothing changes.
12. **The creed lines left for the static-pages rewrite** (site-15). Proposals:
    - About :38–40. Now: "critcalc deliberately visualizes mechanics, never
      verdicts. There are no damage totals, no tier lists, and no "synergy
      scores." The tools show you how the pieces fit together so the judgment
      stays yours."
      → "The tools draw how the game's mechanics work — windows, timings, odds —
      and leave what to make of them to you."
    - FAQ :26–27. Now: "No, by design. critcalc shows mechanics, not verdicts: …"
      → "No. The tools show when buffs are up, which hits apply and what a roll
      is worth, and leave the ranking to you." (This is inventory Q7, now that
      the Damage Breakdown ends in a number.)
    - About :85–87. Now: "the best thing you can do is support those projects"
      → "A fix accepted by any of these projects reaches every community tool,
      critcalc included — here is how to support them."
    - Contribute :19–20. Now: "The most useful thing you can do for this site is
      to support the projects upstream of it." → (delete)
    - Contribute :81–82. Now: "So there is nothing to give here — which is the
      point of the section above. Send it upstream instead." → "So there is
      nothing to give here; the projects above are where support goes."
    - `seo.ts` `/about`. Now: "…theorycrafting tools that visualize mechanics
      rather than reduce them to a score." → "What critcalc is, the community
      projects its data stands on, and who makes it."
13. **A new Team Builder help section** to replace the deleted "Comparing and
    assembling" (site-3). Proposed outline:
    - a Lineup and its battlefields;
    - the team's capabilities row, where a faint glyph narrows Characters to who
      would provide it;
    - a filled portrait in the selected team enters swap mode, and an empty slot
      adds;
    - No repeats;
    - a pinned rotation and Open in Planner.

    → One section or several? I'd write it during the rewrite, from the glossary
    names, never "fingerprint".

14. **Seven characters have no region**, so a region chip hides them (data-2).
    Zibai was fixed. → Confirm each one: nicole, odette, vodyanitsa and vesna
    (Nod-Krai?), alyosha (Snezhnaya?), sandrone (Snezhnaya or Nod-Krai?), skirk
    (none?). Aloy's empty region is correct.
15. **The rest of the backup scope (inventory Q6).** Saved lineups are in now.
    Open rotation tabs, open lineups and the Visualizers workspace still aren't,
    and the copy now names what is included. → Leave it that way: those are
    working state, not saved data.
16. **`scripts/optimize-portal.js` and its npm script were kept.**
    `docs/archive/portal-handoff.md` keeps the portal generator "deliberately"
    for a revival, so only you can reverse that. → Delete it, since the portal
    has been retired since the spring.
17. **Fixes applied that the reviews had marked needs-nate**, applied because a
    ruling already covered them. Veto any:
    - (a) planner-11's pip line (your 2026-09-23 "never we" ruling);
    - (b) planner-10's bench tooltip, which may want re-voicing when the four
      "not curated" wordings are unified (team-builder.md §4);
    - (c) builder-11's whole board → lineup pass (glossary §1, 2026-10-12);
    - (d) text-11 bolds **Padding** and **Animations** in prose (style guide §2).
18. **Regression tests (CLAUDE.md asks first).** → Approve adding two vitest
    cases:
    - `rotationTabs.test.ts`: a fresh tab typed into after `addTab()` is not
      spare, so `adopt()` must not overwrite it (planner-1, a data-loss bug);
    - `notationParser.test.ts`: `VStub hE > VStub N1` keeps the stance
      (engine-1).
19. **Animation check on the phone: the drawer now closes as you leave**
    (planner-13). This was inferred from the code and never reproduced. A drawer
    open when you navigate now plays its outro during the route change instead
    of staying pinned for up to 4s. → On the iPhone, open the planner's Log
    drawer, then (i) swipe back, (ii) tap a tool in the compass. Tell me whether
    the fade reads as part of the leave or as a flash. The same applies to the
    Builder's Filters drawer. (The chapter fade in `9ae5ebcf` changes only under
    reduced motion. The roadmap's site-wide animation sweep was not part of this
    sweep.)
20. **Visual checks on the desk.** (i) A Columbina + Ineffa rotation with two
    empty slots should now draw no Ascendant Gleam lane (`52ab3707`). (ii) In
    swap mode, the details card should have no team button (`8fbc7c91`). Naming
    the destination on that button ("Replace Furina") is left for the copy pass.
21. **The landing announcement "Data current to Genshin Impact 7.1"** expires
    2026-11-04. → Remind me when 7.2 lands, or tell me now if it should come down
    sooner.
22. **`scratch/runtime-smoke/`** (the runtime pass's probe scripts and
    screenshots, gitignored) is still on disk, because the permission prompt
    refused its deletion. → `rm -rf scratch/runtime-smoke`, or say "22 ok" and
    I'll do it.

## 4. Skipped or uncertain, worth knowing

- `builder-13`: a Planner swap might survive leaving the Builder and coming back
  within the 4s page hold. This was traced in the code and not reproduced. The
  errand row reads the live tab anyway. If it's wanted after launch, the fix is
  a `beforeNavigate` that calls `leaveErrand()`.
- `site-17`: every "report a problem" path ends at a Contribute page that has no
  channel and no beta note. This is not new; it is roadmap §6/§8 and inventory
  Q1–Q3.
- The text ledger's generated inventories (`docs/text/ledger/inventory/*.md`)
  still show many pre-sweep strings, and `tb.md` still cites deleted exports.
  Nothing checks them for drift, and `extract-strings.mjs --write` was not
  re-run.
- Comments still mention Compare in two places: `scripts/generate-marks.mjs`
  (`forward`, `pin`) and `DetailCard.svelte:399` (CompareView).
- The Builder fixer staged intermediate versions of shared files to keep its
  three commits apart, so `8fbc7c91` and `637cdb6c` were never gated on their
  own. The tip is gated.
- The visualizers fixer's first vitest run failed on another worker's
  transient probe file (`src/lib/zzprobe`), which was gone on the rerun.
- The error page's "critcalc is one person's project" was left alone, because
  its worksheet line is blank (approved). It belongs to inventory Q8.

## 5. Not covered

- **No browser except the runtime pass.** Every other finding comes from
  reading code, vitest and inline probes. The runtime pass drove the production
  build in headless Chrome, plus a WebKit route pass:
  - every sitemap route at 1440, 390 and 1920;
  - all eight `?i=` instruments;
  - planner, Builder and Visualizers flows, with bad `?r=`/`?b=`/`?i=`/`?team=`
    links.

  It found three issues, all fixed, and no console errors. Not seen anywhere:
  real Safari, real touch devices, playback audio, Settings file import, the PNG
  export (out of scope), the live Cloudflare deploy, and the `_redirects` 301s,
  which only Pages serves.

- **Planner:** most of `RotationTimeline.svelte`'s ~5,600 lines (lane markup,
  tooltip builders, aura plot geometry), the `src/lib/timeline/*.ts`
  projections beyond their consumers, `benchBand.svelte.ts` ribbon geometry,
  `BuffTooltip`, `LoadoutPanel`, and `BandMenu`/`DocumentTabs` keyboard and
  drag. Open worksheet wording in `docs/text/sheets/rotation-planner.md` was left
  to the ledger.
- **Engine:** not read in depth: `aura.ts` (gauge chain, Burning, EC),
  `stacks.ts`, `finalize.ts`, `buffWindows.ts`, `procs.ts`, thresholds, accrual,
  `cooldownReduce.ts`, summon tick walks, fields/gadgets, and the
  auraPlot/auraLog/barPhases/summonSubrows geometry. These rest on the vitest
  baseline and one corpus probe of buff-row labels (123 characters × C0/C6 × 4
  partners: no `undefined`, NaN or raw stat keys). ICD and cadences were not
  re-audited against gcsim. The Human-timing effect in engine-2 was read from
  the code, not run.
- **Builder:** the fingerprint math, the endgame-check verdicts and
  `deriveCapabilities` were left to vitest. `RosterTab` and `LibraryOverlay`
  were skimmed for strings only. The phone layout and the PNG export were not
  checked. The Factions/Buffs and On-Field/Off-Field DPS labels wait on
  glossary §5.
- **Visualizers:** read only lightly: CritHeatmap canvas geometry, the
  `DefResChart` and `ValueWheel` components, Artifact Odds' roll inference and
  the Breakdown waterfall geometry. Gauge and ICD numbers were trusted from their
  2026-10-02/04 cross-checks. Wish and artifact odds were spot-checked only, not
  re-run against GGanalysis. Unchecked: "Pyro refresh since version 3.0", and
  whether the game hyphenates "Stellar-Conduct".
- **Site:** the overlay/TOC rendering, chapter anchors and the 404 fallback were
  checked from source only. Not every Visualizers help claim was re-read against
  the code. The Coverage page's reason strings were grep-checked only. Unknown:
  whether Pages' `/*.html` Cache-Control rule matches extensionless paths.
- **State:** blocked storage was not exercised live. Unchecked: each
  instrument's `applyShareState` sanitizer, and Safari's clipboard after an
  await. Old `?i=anatomy` links select nothing, which is harmless before launch;
  from launch on, the decoder-retention rule applies.
- **Leftovers:** most of `/styleguide`'s ~3,250 lines are dev-only and full of
  historical mentions. The `INERT` entries, `eslint-disable` comments and script
  internals were not checked; only their paths were. The dead-export scan is a
  name heuristic: it finds names never mentioned, not exports that are named but
  never called.
- **Text:** character caveats and data strings (they have their own guide),
  strings built at runtime from data, and the open pass-1 worksheet items.
- **Data:** no network fetchers were run, so the next Abyss and Stygian seasons
  are not confirmed. Neither `audit-gcsim-frames.mjs` nor
  `audit-genshin-db-text.mjs` was run. Portraits were checked by manifest and
  file, not by eye. A TODO in Yelan's skill description remains; nothing renders
  it.

## 6. The static-pages inventory

`docs/static-pages-inventory-2026-10-14.md` is the read-only preparation for the
static-pages rewrite: ten surfaces, each with its stale lines and a proposed
section list, ending in 14 open questions (§12). It was untracked during the
sweep and is committed with this record, formatted by prettier, which was the
only reason `npm run lint` failed. Many of its `clear` rows are now done (§2,
"Static pages and meta"). What's left for the rewrite: its §12 questions, the
Team Builder section (§3 item 13), the creed lines (§3 item 12) and the
frame-perfect claim (§3 item 3).
