# Team Builder round — 2026-10 (⚓ Nate approved the plan 2026-10-07)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

The plan (which held every decision) and the survey screenshots were kept outside the repo.

**Why:** the survey measured that Compare's chart draws only 45 of 211 ally-facing buffs and 18 of 87 RES shreds. The 9 coordinated attacks (Xingqiu, Yelan, Nahida, Raiden, Beidou, Albedo, Dehya, Nicole, Qiqi) had no duration, and passive-hosted buffs had no lane. Kazuha's Swirl bonus, Sucrose's EM and Nahida's EM drew nothing. Four finder pipelines disagreed, and each tab felt thin (Nate).

**Phases (branches):**

1. `tb/contrib-data` — `DerivedCapability.host` (from trigger) + `value` (BuffValue); coordinated-attack durations.
2. `tb/compare-contrib` — contribution blocks.
3. `tb/roster-find` — one finder; Atlas cards become the Roster start; Audition is the finder seeded by a slot; coverage under the bench.
4. `tb/audition-rotation` — dynamic-import parser, before/after uptime.
5. `tb/copy` — copy, Help, ledger.

**Nate's rulings (2026-10-07):**

- ⚓ Names are **Roster | Compare** (not Find).
- ⚓ Compare is **one block per effect** (facts + lanes together, then "Only X").
- ⚓ A reaction-set buff is **one window labelled "per Swirl"**, never tiled.
- ⚓ **Coverage goes under the bench.** ⚠️ Measure with the bench in the planner-DISTRIBUTED layout (crossing from the planner keeps its row heights), not a cold Builder load. If tight, fall back to a compact strip at the top of the Roster that scrolls.
- ⚓ A role card **filters the grid and keeps the sections**.
- ⚓ The rotation audition reads at the **planner's** constellations.
- ⚓ E/Q CD + energy move into the sticky column header.
- ✅ One new e2e spec for the rotation audition is APPROVED.
- He deliberately reversed his 2026-07-22 "Atlas and Roster are separate tools" ruling — merging gives each surface a distinct purpose.

**How to apply:** check which phase is merged (`git log --merges`) before resuming. Each phase's copy goes to Nate as a numbered list before it merges.

## Progress

- ✅ **Phase 1 MERGED `721a5bee`** (feature `cc3e10c8`), e2e 78 + 78. ✅ pushed. Census: lanes 173 → 354 of 604 (buffs 45 → 162/211, shreds 18 → 65/87, off-field 72/72). ⚠️ The measurement changed the design: `host.casts` is a LIST, because Sucrose's A4 is `onHit ['skill','burst']` and 12 cast-set effects name no ability.
- ✅ **Phase 2 MERGED `73ee3f06`** (feature `bb611709`), e2e 78 + 78. Nate approved all its copy (2026-10-07), and facts on the night (no paper card).
  - ⚠️ The survey's "lanes reorder per group" was WRONG: they were always in column order.
  - New mark `pin`. `CapLane.host` is now OPTIONAL (`perReaction` lanes).
- ⏳ **Phase 3 `92c2a173` (`tb/roster-find`) + Phase 4 `ebb62ed1` (`tb/audition-rotation`, stacked on it): committed, NOT merged.** Waiting on Nate's approval of their copy list.
  - ⚠️ COVERAGE UNDER THE BENCH WAS MEASURED AND DOES NOT FIT: the planner-spaced ribbon runs to y≈880 at both 1440×900 and 1600×1000. It took Nate's fallback, a compact strip at the top of the Roster.
  - The parser chunk (120 KB) is verified outside the TB node's static closure.
  - Chevreuse in a Hydro/Anemo team reads ATK 43% → 0%. That is the feature's whole argument.
- ⏭ **Phase 5:** the copy list (phase 3/4 strings plus the worksheet's flagged bugs) and the Help rewrite. The global `.chip` is `text-transform: capitalize` — that is why the rail reads "Off-Field DMG" while the source says "Off-field DMG".

## ⚓⚓ 2026-10-07 (later): THE PIVOT — read `docs/design/team-builder-lineups-design.md` first

- ✅ Phases 3 + 4 MERGED: `c6ceb8c3` and `5bba0571`, e2e 79 + 79 at `ebb62ed1`. ✅ PUSHED 2026-10-07 with the design doc (origin `a99a8cef`); the local branches are deleted.
- ⚓ Nate approved copy items 1–19. Items 12–19 (§7 of the design doc) are NOT yet applied.
- **The new shape:**
  - The Builder = Roster + a BOARD of several teams (Stygian ×3, Abyss ×2), in a three-state split screen with animated wipes.
  - No bench and no rotation tabs in the Builder; band A becomes the board tabs.
  - Linked teams are LIVE VIEWS of Planner tabs: a swap renames in the notation; removing a character asks first.
  - The swap picker groups candidates by consequence: keeps / trades / archetype change, including the ripple onto teammates.
  - The fingerprint: 15 icons, 4 states (lit / outlined-inactive-in-team / locked / unknown), no uptime fill, provider dots on a team.
  - Battlefields are a framework with checks the user writes. Curated Stygian seasons are a separate decision.
- **Why bars died (⚓ Nate):** they measure kits against each other, when the real question is how a kit fits MY rotation, and that is the Planner's job. Uptime measured in a not-yet-adjusted rotation is unfair to the candidate.
- ⚠️ **The technical core** is evaluating conditions against a TEAM, inside types-only `deriveCapabilities` (design doc §5).
- 🎨 **Nate owes the art:** 15 single-colour SVGs (8 traced, 2 redesigned, 7 new concepts).
- ⏭ **Next session:** the build order in design doc §8.

## How this session ran (worth repeating)

⚓ Nate wanted DIVERGENT thinking before any build. He asked to think "even further out of the box" twice, and the best ideas came on the third pass: lineups, and dropping the bars. So when a surface reads as incomprehensible:

- ⛔ don't polish it;
- ✅ ask what players actually come to do;
- ✅ offer several genuinely different concepts with their tradeoffs before converging.

He closes a design in discussion, then builds in a fresh session from a docs/ record.

## 2026-10-08: review before the build

- Rulings are in design doc **§9, which wins over earlier sections**: the index team-condition residue; lit = the team CAN make it happen (no on-field questions); `TAB_LIMIT` 12 + Recently closed + a confirm at the limit; shares carry teams, not rotations; one Layer-2-over-roster constellation model for both tools, with subtle marks and "use my constellations".
- ⚠️ The plan's "15 in `FUNCTION_FACETS`" was wrong (14, no Damage cluster). The eager index loses conditions, so §5 alone could not drive swap mode.
- Open items are listed in §9.7.

## 2026-10-08 (later): §10 + the build, steps 1–3

- ⚓ Design doc **§10 wins** (the library, DERIVED links, the bench loses ✕, synced-to-roster, presets, revised build order: 3 split → 4 library → 5 team rows → 6 swap mode → 7 marks/battlefields → 8 copy).
- Stacked branches, none merged (Nate judges the copy live, all step-1 strings approved for now):
  - `tb/board-model`: tabs (limit 12, Recently closed, a confirm every time — overrules the 2026-08-17 "park in the bank"), boards with PINNED rotations (`teamKey` = set, order ignored), `?b=` codec, C0 now travels in `?r=`. e2e 79+79 at `c6a079de` (before the §10 rework).
  - `tb/team-conditions`: `TeamNeed` / `summaryInTeam` / `REACTION_INGREDIENTS`, index `teamGated` (+2 KB gz), parity test vs `evalCondition`.
  - `tb/split-screen`: no bench in the Builder (layout `benchMode` RP-only), band A = board tabs via generic `DocumentTabs` + `TabStripModel`, split control in band B, `BoardView` plain rows, loadout in the Detail card, specs rewritten. ⏳ full e2e running at `6331822c`.
- ⚠️ `pgrep -f "playwright test"` inside a Monitor loop MATCHES THE LOOP ITSELF — it never ends. Wait on the background task's own notification instead.
- ⚠️ `DocumentTabs` renders a hidden MEASURING copy with the same classes — scope e2e selectors with `:not(.doc-tabs--measure)`.

## ✅ 2026-10-08 close: steps 1–3 MERGED (not pushed)

- `f0b963fc` (board model) · `fe320d14` (team conditions) · `88edd5bc` (split screen). e2e 77 + 77 at `6331822c`; Nate checked in Safari. ⛔ Not pushed — wait for Nate.
- ⏭ **Next session: DESIGN THE LIBRARY (step 4) with Nate before building.** He wants a clean context for it. Start from design doc §10.1 + §10.4; offer a clickable sketch with sample data. Questions he will care about: how a team heading reads (portraits + composition chips + optional nickname), where boards and Recently closed sit, the character filter, the sync badge and its confirm, overlay now / `/library` page later. ⚓ Craft it lovingly — it is the feature that can make both tools pleasing.
- Open, from §10/§9.7: arriving from the Planner with no board for that team (now moot? the ⇄ audition is board-less); the TB-mode bench code in `BenchBand`/`benchBand` is dead and awaits the round's sweep.

## ✅ 2026-10-09 close: `tb/endgame` MERGED + PUSHED (step 5 + endgame presets)

Record: `docs/rounds/tb-endgame-round-2026-10-09.md` (read it first). MERGED `d3238333` + PUSHED (e2e 77 + 77 at `9d50e249`).

- Nate's live rulings this session: the game's ROW pick model (row selected, earliest empty slot, re-pick frees, 5th = nudge, filled portrait does nothing, ✕ gone, remove+re-add for order); views Roster·Roster+board wide / Roster·Board phone (phone switches to Board once the team fills); no-repeats mark bottom-left of the disc, toggle ON for Stygian/Abyss, OFF for Custom; fingerprint TWO states, every glyph always drawn (faint+dots = would provide; faint, no dots = nobody); ⛔ boss RES dropped (lunaris = base template, wrong); boss full name in the game's order (NAME before the colon, title after); glass header strip only, rest on night; rings --line-faint on night, --line-soft in the library; selected frame 1px gold, 5px end.
- ⚠ A `mask-image` element is a stacking context — it paints OVER in-flow text sharing its grid cell (the Abyss banner bug).
- ⚠ Playwright `evaluateAll` does not wait — `boardNames` waits for the first slot.
- ▶️ NEXT SESSION, in order: (1) the PHONE PASS — Nate checked, the board overflows at phone width, give it real attention; (2) the other nine fingerprint glyphs — Nate is designing the split HP/DEF buff icon and wants to TALK about the look of the rest first (generator: add a line to GLYPHS in `scripts/generate-fingerprint-glyphs.mjs`); (3) step 6 swap mode; (4) step 8 copy. Open question for Nate: should a plain card click pick while the board shows (game-like), details behind a small button?

## 2026-10-09 (later): endgame data + step 5 on `tb/endgame` (NOT merged; last commit 1b5ed0ae)

- Endgame data from lunaris.moe (`scripts/fetch-endgame.mjs` → `src/lib/data/endgame/{stygian,abyss}.json`; art via `build-endgame-art.mjs` from gitignored `assets-src/endgame/`). ⚓ No leaks: `season-dates.json` is HAND-MAINTAINED — one Stygian line per patch, one Abyss line per cycle (Nate names the blessing). ⚠️ lunaris carries BETA records (6.7/7.1 dates, one-day Abyss cycles). ⚠️ HP is per season (Herra changed). Credits on About: Lunaris.moe, Stygian.moe, Genshin Impact Wiki.
- Step 5 built: fingerprint (placeholder pips, `$lib/fingerprint.ts`), battlefield checks (`$lib/endgameChecks.ts`, 29/40 phrasings decidable, rest UNKNOWN never guessed), Stygian Party-Setup layout (boss 88 left, rule, checks/lineup/fingerprint; portraits 56), BossDetail hero, Abyss banner + half blessings + per-half Opponents.
- ⚠️ A redrawn /assets file needs a NEW NAME — the dev server caches images 1h, and a force reload did not clear it (cost a misdiagnosis).
- After 1b5ed0ae: the Abyss banner is the full overlay again, output renamed `{icon}-v2.webp`. ⚠️ Chrome keeps a FAILED image load per page — a force reload did not retry it; right-click → "Load image" did. Don't rebuild assets while Nate is looking (the delete→rebuild window 404s).
- Layout state Nate approved so far: Stygian card = kicker + name (title over family), boss 88 LEFT, vertical rule, stack (checks · lineup with chips+pin · fingerprint); portraits 56; BossDetail = hero header (art at right, masked), mechanics full width; Abyss = banner overlay, half blessings, per-half Opponents modal (chambers stacked). Check verdict mark REPLACES the thumb; unmet = no change.
- ▶️ NEXT SESSION, in order: (1) ask Nate for a Safari look + any remaining polish on the board/boss/Abyss views; (2) full e2e (`npm run test:e2e`, read both "passed" lines) then `--no-ff` merge `tb/endgame` (message file, not stdin); (3) wire Nate's fingerprint SVGs when they land in `assets-src/fingerprint/` (24-unit, fills only, shade as `<g id="shade">`; states painted in code); (4) step 6 swap mode (§2.5; candidate groups keeps/trades/archetype change, owned first then by name — Nate will judge live); (5) step 8 copy: the glossary gains Library · lineup (on screen; code keeps `board`) · battlefield · fingerprint = "the team's capabilities" in Help.
- Open data notes: 11 of 40 check phrasings are UNKNOWN (damage-profile wordings, Bond of Life / Crowd-control / Plunging characters) — a rule for any of them is a later decision. The TB page chunk carries the 187 KB season data (337 KB / 119 KB gz) — lazy-load later if it matters.

## 2026-10-09: step 4 — the library BUILT on `tb/library` (stacked on `tb/portraits`; NEITHER merged nor pushed)

- Demo settled first (Shelf; strip-is-button; one Teams grid of subgrids — ⚠️ a spanning heading inflates a max-content track, so the middle min is a LENGTH (11rem); headings as tall as a nicknamed one via an invisible sizer; hint replaces chips/meta in place).
- Build: `library.ts` (pure model + tags, tested) · `library.svelte.ts` (flows; Builder registers a target; Back = shallow `page.state.library`) · `LibraryOverlay.svelte` (replaced `SavedNotationsOverlay`) · board Save/Load in TB band A · Sync (§10.4). Team entries are made ON SAVE in documentBar; `rotationsForTeam` excludes them.
- 🐛 fixed on the way: a Save whose linked entry was deleted updated nothing and still said "Saved".
- ✅ MERGED 2026-10-09: `8c03ee14` (tb/portraits) + `78775aaa` (tb/library), e2e 77+77 at `088518aa`; NOT pushed. Nate tried it live.
- ⏭ Next: step 5 (team rows; Nate is drawing the 15 fingerprint SVGs — 6 traced, 2 redesigned, 7 new).

## 2026-10-08 (later): step 4 — portraits done, library DEMO in progress, on `tb/portraits` (NOT merged, NOT pushed)

Commits: `6a563f2a` feat SidePortrait + con chip · `3c28a239` tune(nate) geometry · `a10e5268` docs §9.5a · `cc41c483` + `fd95ff02` experiment: `/lab/library` demo + `CompositionChips` (real) + `teamReactions()` export. Design doc §9.5a + §10.1 + NEW §10.1a hold every ruling.

- Portraits: plain ring, `.ctx-dark` so OPAQUE on glass, Nate's geometry in `$lib/sidePortrait.ts` (⛔ never re-derive). Ownership = ONE constellation chip (filled = covered, hollow = team asks more, not owned = hollow C0). ⛔ never fade the portrait. ⚠️ global `img { max-width: 100% }` squashes over-wide art.
- Library rulings: Shelf layout; the STRIP is the button ("use this here" per opening tool, home tool on the standalone page; hover hint names the click; ⋯ for the rest; Sync visible); Sync per ROTATION; delete = ONE confirm (team too), rotations → Recently closed; Recently closed tops the side column ×3; team = real names-only entry created ON SAVE, its name IS the nickname; filtering = tag search box (Enter adds a tag), ⛔ no avatar strip.
- ▶️ RESUME: Nate said "a little better" and wants to give JUDGMENTS on the demo next session — start by asking for them (`npm run dev -- --port 5179`, `/lab/library`). Then ask: element/reaction tags keep or drop? Still unasked from the agenda: share from the library, duplicate detection on save, Traveler variants as one character for grouping, synced badge on Planner tabs too?, nickname shown on board rows / as default save name. After the demo settles: build the real library (store, overlay opened by Load in both tools, Back closes it), then step 5.
- Full cross-engine e2e not yet run on this branch (last green `6331822c`); run before merging.

## 2026-10-08 (later): step 4 began with PORTRAITS, on `tb/portraits` (not merged)

- `6a563f2a` feat + `3c28a239` tune(nate): `SidePortrait` (plain ring, overhanging art, `.ctx-dark` so OPAQUE on glass) + the constellation CHIP (filled = covered, hollow = team asks more, not owned = hollow C0). Design doc §9.5a amended. Nate's geometry in `$lib/sidePortrait.ts` — ⛔ never re-derive.
- ⚠️ Global `img { max-width: 100% }` squashes any art wider than its box — `max-width: none`.
- ⚠️ Ruled out on /lab: fading the portrait (any strength), a quieter ring (invisible on night).
- Library rulings (§10.1 amended): a team is a REAL names-only entry, created ON SAVE; outlives its rotations; two-stage delete with rotations; the Builder never files teams; the entry's name IS the nickname (no nickname store).
- Nate's answers so far: overlay uses max screen, side-by-side on large / stacked on small (try options in demos), Back closes it, heading = portraits (slightly smaller than board) + chips + nickname + count + date, ⛔ NO fingerprint in the library, portrait order = newest entry's.
- ⏭ Next: library demos (2–3 layouts in /lab, seeded with Nate's sample rotations — he will provide them). Re-prompt him on the items he hasn't answered (8–22 of the agenda in this session).

## 2026-10-10: glyph concepts chosen (Nate drawing them) + the phone pass begins

- Nate's picks for the remaining glyphs: DMG% = a drawn percent sign · Cleanse = an eraser concept · Taunt = a ground circle with a "!" alarm mark over it · Grouping = chevrons pointing at a centre dot · Infusion = an upright blade with an elemental effect around it · Interruption res = an anchor · RES shred = a hexagon plate with a crack · Off-field DMG = three falling darts (like Xingqiu's rain swords). HP/DEF = his splice of Health + Defense (Claude's advice: a vertical split, HP the main fill and DEF the shade half, because DEF's crest reads as Shield).
- Rationale: the existing six already use circles (EM, ER), a diagonal blade (ATK) and a burst (Crit), so new glyphs avoid those; no spiral for grouping (every grouper is Anemo, so it would read as the element).
- ⚠️ Data gaps found 2026-10-10 (log for a data pass, not fixed): Chongyun has NO infuse effect (the facet lists 10 infusers without him); Xingqiu's interruption resistance is mentioned once but doesn't derive (interruptionRes = Gorou + Columbina only; Noelle/Thoma also absent).
- Nate handed the PHONE PASS to Claude (consult him as needed).
- ✅ Phone pass first cut: `6de0505d` on `polish/tb-phone` (NOT merged). Below 40rem the board row is a grid: boss 64 + checks, then lineup/chips/fingerprint full width; header buttons icon-only; Abyss blessing below its banner. 0px overflow 320–430 on all three presets. Only the board ever overflowed (Roster, Library and the modals were clean). ⏭ Nate judges it live (dev on :5180); open: the 3–4 line uppercase boss names at 320, and the Damage glyph wrapping at 320.

## ⚓⚓ 2026-10-10 (session close): THE PARTY SETUP SHAPE — design doc §11 WINS

- Branch `polish/tb-phone` holds `6de0505d` (phone pass; Nate CONFIRMED every surface fits on mobile) + `3f5a918f` (design doc §11). ⛔ NOT merged, NOT pushed. Before merging: the full cross-engine e2e (`npm run test:e2e`, read both "passed" lines; last full green `9d50e249`), then `--no-ff` with a message FILE.
- §11 records the survey, every ruling, the open decisions (§11.4: ⏭ Nate decides them WITH Claude — ask, don't assume) and the new build order (§11.5): 1 docked-board layout + filter bar + default Stygian board → 2 Library Roster tab (before 3!) → 3 whole-card pick + magnifier + slot frames + details panel → 4 fingerprint as filter + hover preview → 5 swap mode in the grid, Compare/Audition retire → 6 copy.
- Headlines: board ALWAYS docked RIGHT on wide (fixed width; only the roster flexes; no switch, no wipe); default board = current Stygian; blank "?" IS the empty slot (Claude's ring-with-+ idea withdrawn); whole card picks, magnifier = details; game-style slot frames in OUR colours; roster curation moves to a Library "Roster" tab (owned, con, NEW level-70+ flag, loadout) and the Builder's details lose loadout.
- ⚠️ In Nate's reference screenshot the frame colours look PER TEAM (BF1 green, BF2 blue, selected BF3 empty) though he described them as active-vs-other — §11.4 item 3, check before building.
- Reference images (the game's Party Setup + the 1440 survey shots) were kept outside the repo.
- ⚓ Nate's way this session: he decided the shape from a written proposal, no lab demo; he wants open decisions WRITTEN DOWN and decided together later.

## ✅ 2026-10-10 (next session): `polish/tb-phone` MERGED `34d8a1a1` (NOT pushed)

- e2e 77 + 77 at `3f5a918f`. Main is one merge ahead of origin.
- Plan review done with Nate. Gaps found beyond §11.4:
  - The Planner's DetailCard still edits Owned/Wishlist, and its note says the con "can only be changed in the Team Builder".
  - Docking at toolMin leaves the roster ~250px; it likely needs `wide`.
  - Audition has no home in the docked layout through steps 1–4.
  - An untouched default Stygian board would go stale at the season rollover.
  - The 70+ flag would have no reader.
  - With an empty roster, the Owned filter and the con lens do nothing.
- ✅ Frame colours are PER TEAM (re-read the reference: BF1 green, BF2 blue, BF3 selected and empty). Only our hues remain to choose.
- Claude's leans: rename Load → Library and deep-link details to the Roster tab; the Planner's details go read-only; keep Wishlist; defer the 70+ flag; the sectioned grid after step 4, built on the fingerprint filter.
- ⏭ Waiting on Nate's answers before step 1.

## ▶️ 2026-10-10 (later): step 1 begins on `tb/party-setup`

- Every §11.4 item is decided; design doc **§11.6** holds them (commit `46df5705`).
- Nate is drawing the chrome Roster icon (an Aether silhouette).
- ⛔ Don't push `main` yet.
- ✅ Step 1, first cut `86c4966b` (not merged):
  - The dock is `wide` (580px board; 4 roster columns at 1137). The compact card was measured and NOT brought back.
  - `RosterFilterBar`. A Stygian board with an unset season follows the game. The Bitter 13px white header.
  - Load → Library. Add team and ✕ are Custom-only. The BandMenu `end` fix.
  - ⏳ For Nate: band B on wide holds only the con lens, an empty strip. Removing it is a cross-tool alignment call.

## ✅ 2026-10-10 (later): step 1 DONE on `tb/party-setup` — see design doc §11.6 items 15–16

- **Band B is cut at the dock** (the Visualizers' per-tile band):
  - The character cell reads Show · search · More · lens. It is MEASURED (`bind:clientWidth`) and folds Show, then the lens, into More (`FOLD_*_W` in `lib/dock.ts`).
  - The lineup cell is a glass RAIL with + Add team (Custom only) and No repeats at its end.
  - Below the dock it is one cell, led by Nate's ONE-plate pane switch (PanelRightOpen "Lineup" / PanelLeftOpen "Characters").
- **The board steps 580 / 720 / 800** at broad and vast, in CSS (`--tb-board-w`, read by the dock AND band B). It is ROOMY from broad: portraits 64, boss 104, glyphs 20.
- The heading is 14px Bitter. Nate's boss magnifier: 26px at top 3, right -2. Its hover is an inset shadow (⚠ a gradient layer can't transition, so it flashed).
- ⚠ The global `.toggle` rules use `~ .toggle-track` now (a leading label broke `+`).
- ⚠ Inside the dark context, `btn--glass` plates need a `.ctx-glass` ancestor or they rest and hover in slate.
- ⚠ Band B's blanket `.btn` height breaks a `.segment`: its buttons need the control height minus 4px.
- ⏭ NEXT: design the Library's Roster tab WITH Nate (§11.6 item 7), then step 2. The empty-roster hint (§11.6 item 12) ships with step 2, since it links to the tab.
- ✅ MERGED `d59b9306` + PUSHED 2026-10-10 (origin was at `d3238333`, so `34d8a1a1` went too). e2e: chrome 75, webkit 74 + 1 flaky.
- ⚠ The flaky one is "a board survives a reload": the reload lands mid-`warmAvatars`, and WebKit reports the cancelled fetches as pageerrors. It ran 10/10 in isolation. ⏭ Fix it later (e.g. wait for idle before the reload, or route the noise through EXPECTED_NOISE).

## ✅ 2026-10-11: the Roster tab DESIGNED on `experiment/roster-tab` (`/lab/roster`, tip `228e06b2`, NOT merged)

- Design doc §11.6 item 17 holds the first rulings. The demo's header comment holds the rest. Later rulings, same day (⚓ Nate):
  - **TILES won** (the ledger was dense without being more usable).
  - Six ASTROIDS under the portrait (C0 = none filled; clicking the top lit one steps down). New mark `constellation`. Lock marks: `locked` / `unlocked`.
  - A LOCK: locked shows a C-badge from C1 and hides the astroids. It opens locked whenever the roster has content, unlocked when empty, and is NOT remembered.
  - One-click bulk actions under UNDO (⌘Z / ⇧⌘Z, 100 steps, in memory only): Mark all owned / Mark all C6 / Mark all not owned, each "shown" under a filter.
  - Not owned KEEPS constellations stored. ⛔ No Mark all wishlisted.
  - Keys: O owned, X not owned, Space switch, W wishlist, 0–6. The key legend shows whenever editing.
  - Clickable header totals. Blank is excluded from the Roster (it stays in the Planner).
- ⏭ Step 2 builds this into LibraryOverlay on the real stores.
  - The chrome Roster button takes Nate's TWO silhouettes (Aether + Lumine) and must follow `siteSettings.travelerVariant`.
  - The keys say ⌘ on Mac and Ctrl elsewhere. The copy goes to Nate as a numbered list.
- ⏭ The Marks single-weight branch: Mark's stroke scales with size (ink = 1.9 × size / 24). Do `vector-effect: non-scaling-stroke`, ⛔ not a size-derived stroke (SlotPortrait and CharacterCard size marks in CSS). Nate picks the one weight from a /lab specimen.

## ✅ 2026-10-11: Marks hold one line — MERGED `b8749c14` (e2e 75 + 75; Nate checked real Safari; NOT pushed)

- `MARK_STROKE` = 1.15 CSS px at every size, via `vector-effect: non-scaling-stroke` (in CSS on `.mark :global(*)` — ⚠ the attribute isn't typed on `svelte:element`). The specimen is in history at `e9d3198d`.
- The 1× finding is in Mark.svelte's header: 12px is the crisp size, and size is the lever for crispness, ⛔ not the width.
- ⏭ Step 2: rebase or merge main into the roster work, so the astroids drop their local stroke workaround.

## ✅ 2026-10-11 (later): step 2 BUILT on `tb/roster-tab` @ `b9ca0a1f` (NOT merged)

- Design doc §11.6 item 18 is the record. Copy is approved (Nate's wording for the Planner's details note).
- e2e: 73 + 73 at the pre-fix state. The 2 old-design assertions (`site-chrome`, `loadout-layers`) are updated and green on both engines.
- ⏭ Nate looks live, then a full e2e run and `--no-ff` merge.
- ⏭ Then step 3: whole-card pick, magnifier, slot frames, details as a roster-column panel with no loadout.
- ⏳ Waiting on Nate's two chrome silhouettes.
- ⚠ A details card must read its `id` BEFORE `onClose` (props are live).
- ✅ The chrome Roster marks are DONE, `tb/roster-tab` @ `5a848712`. Nate's Aether and Lumine silhouettes follow `travelerVariant`.
  - Aether: 34px, 1px right.
  - Lumine: 32px, 2px right. She is aligned to Aether by the FACE (nose tip + chin, from the path data).
  - Sized by luminous ink per height², the compass method.
  - Gradient ids come from `$props.id()`.
- ⏭ Before merge: Nate looks live at the Roster tab, a real-Safari look at the gradient marks, a fresh full e2e (the last full run predates the spec fixes and the marks), then `--no-ff`. After the merge, delete `experiment/roster-tab`.

## ✅ 2026-10-11: step 2 MERGED `a98f5509` + PUSHED (origin = main)

- e2e green at the tip: chrome 75, webkit 75. The phone form shipped in the same merge (design doc §11.6 item 18).
- `experiment/roster-tab` DELETED (Nate, 2026-10-11). RosterTab.svelte now cites design doc §11.6 items 17–18 instead.
- ⏭ NEXT: step 3. Whole-card pick + magnifier, per-team slot frames, the destination strip, and details as a roster-column panel. That panel drops Default build / LoadoutPanel from the Builder and retires its old roster editing.

## 🧭 Where to resume (2026-10-13, step 5 MERGED + PUSHED — read this first)

**State:** `main` = origin at the step-5 merge `ad848af9` (`Merge tb/swap-mode`) + a CLAUDE.md roadmap commit. No open TB branch. e2e green at the merge: 75 + 75 (chrome, webkit). Record: design doc §11.6 item 20 — its "↻ After Nate used it" block WINS over the bullets above it.

**What exists:** swap model in `team-builder/lib/team.ts` (`swapDelta`, `swapSections` — sections = the COST, `runs` only seat like gains together and feed the green card glyphs; `checkNamedElsewhere`, `checkShift`); `SwapDelta.svelte` heads; `$lib/utils/reactionPairs.ts`; `$lib/utils/release.ts` (`newestFirst`); band A notice buttons (`documentBar.showNotice(msg, actions)`, `tryWithSwap`); `boards.restoreTeams`; BoardView's `teamRow` snippet; the Planner's ⇄ is an ERRAND state (`ERRAND_ID`, only its row shows, band A has no active tab).

**⚓ Rulings 2026-10-13 (beyond the doc):** ⛔ per-run caption tiles CUT (noise) — the green gained glyphs on cards carry it · swap respects on-/off-field (IT roles position) · default grid order newest release first · count lives in the team-hued destination banner · board row: team-hue right END always, ring in team hue when selected (no gold) · filter strip groups = joined glass bars · picked card's slot tab = glyph-column width · DMG% NUDGE 0.874.

**⚠ Traps:** a claim that "undo is the net" was wrong — the Builder had NO undo; check a claim before leaning on it. ⚠ a one-team board shows its row selected, so ONE portrait click enters swap mode. ⚠ `$derived` naming a later `const` = TS used-before-declaration. ⚠ two band A's are mounted (both tools) — scope locators. ⚠ e2e `matchCount` reads `.rfs-count, .tb-dest-count` (the count moves to the banner when a team is selected).

**Next:** ⚓ Nate: the TB is essentially finished; the NEXT MAJOR WORK is (re)writing the STATIC PAGES' content — which absorbs step 6 copy (tier names, "Loses nothing", "Replacing X · …", notice sentences) and the Help chapter (still describes Compare/Audition/bench/Atlas). Copy goes as a numbered line-by-line list (memory `feedback_copy_proposed_first`). Still open: the phone pass (band A's notice doesn't fold).

## 🧭 Where to resume (rewritten 2026-10-12, end of the step-4 session)

**State:** `main` = origin at `abaffe12` (`Merge tb/fingerprint-filter`). No open TB branch. Last cross-engine e2e green at `dd569b44` (75 + 75). Records: design doc §11.6 items 18 (step 3) and 19 (step 4, incl. glyphs + copy); `docs/rounds/tb-endgame-round-2026-10-09.md` (battlefield-check rulings, 7/40 unknown on purpose).

**✅ (DONE 2026-10-13 — superseded by the block above) step 5** — swap mode in the Characters grid; Compare + Audition retire; sweep the dead TB bench code (`benchBand.svelte.ts` `tool: 'rp' | 'tb'`). ⚓ Nate: START WITH `/lab` DEMOS — ask demo-vs-proposal per new shape (memory `feedback_ui_decisions`).

**Queued (small):**

- ✅ DONE 2026-10-13: Coverage page toggle now says "My constellations".
- Grouping glyph is still the lightest (46 sq units, NUDGE 1.2) — Nate may redraw heavier, post-launch fine. Glyphs will keep being tweaked over time (⚓ Nate).
- Layout pass with the glyphs in: Columbina's tall card row (9 glyphs), possibly smaller avatars, team hues (`--team-hue-*` placeholders). Card glyph knobs now `--cc-glyph` 11 / gaps 5–11 / pad 8.
- Open question: should a fingerprint "find" narrow to who'd be LIT in that team?
- The phone pass.

**Rulings made this session (2026-10-12) — beyond the design doc:**

- ⚓ Glyph pipeline: Nate exports the full 24-unit artboard (fills only; a shade half's id contains "shade"); `scripts/generate-fingerprint-glyphs.mjs` CROPS each to its art and balances it (`DENSITY_K` 0.5 = shrink denser-than-median toward the median; `NUDGE` = tune(nate) per-glyph `{scale,dx,dy}`; svg overflow visible so >100% spills into the gap). Adding/replacing a glyph = drop the SVG (same stem) and regenerate; a NEW facet needs a GLYPHS line or the generator refuses.
- ⚓ Preview colours: gain `--ui-positive` straight; loss `--ui-danger` 60% into `--line-strong` (`--fp-loss-mix`).
- ⚓ Team row = two columns under a spanning top line ("Planner →" centred on the checks; pin ALWAYS under it; fingerprint line reserved). Unpinned label "Pin a rotation"; menu item "No pin".
- ⚓ Copy: Healing / Shield / CRIT buff / **Interruption RES** (game's spelling, glossary §2a); "Each character joins only one team."; fingerprint tooltip = whole sentences per state; lens = **My constellations**.
- ⚓ Data: shielders (Zhongli included) never count for interruption resistance; Gorou's `>=1`/`>=2` geo gates are correct (`teamElementCount` excludes the holder). Battlefield checks: Nightsoul = Natlan or traveler_pyro; crowd control (both spellings) = met if Grouping lit else unknown; Bond of Life = Arlecchino + Clorinde only; frequency trio, Plunging, Single + Multi Elemental stay UNKNOWN.

**⚠ Traps learned this session:**

- `var(--debuff)` does not exist (CLAUDE.md still names it) — it silently inherits white; use `--ui-danger`.
- flex-wrap breaks lines by an item's max-content width, not its shrunk width (why the team row became a grid).
- Band B fold widths (`FOLD_SHOW_W` 680 / `FOLD_LENS_W` 472 in `team-builder/lib/dock.ts`) are measured on the WIDEST lens label — re-measure if a band B control or label grows.
- WebKit reports navigation-cancelled fetches as pageerrors past `.catch()` — abort on `pagehide` (warmAvatars).
- A removed e2e locator hangs the run for its whole timeout and leaves port 4998 held. Facet filters in e2e: `provideGlyph` (strip) vs `moreChip` (More).
- The index generator can print a stale "up to date" — verify derived capabilities directly.
- A passive-hosted `onCast skill` effect fires on EVERY skill — host it on the ability (Dehya's A1 on Indomitable Flame + `attribution`).
- Earlier traps still live: a details card must read its `id` BEFORE `onClose`; inlined SVG art needs per-instance gradient ids; testing in Nate's Chrome writes HIS dev localStorage.
- `experiment/tb-card-shapes` held the `/lab/cards` demo — DELETED 2026-10-18 (⚓ Nate; tip was `01b7a823`, never merged).
