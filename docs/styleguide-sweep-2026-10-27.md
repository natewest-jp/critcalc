# Style guide vs the post-flip site: where they disagree

Read-only sweep, 2026-10-27, against `main` at `68d45496`. "The guide" means `src/routes/styleguide/+page.svelte` (SG) plus the tokens and classes it documents in `src/app.css`. "The site" means what renders with `data-next` on (`:where(:root[data-next])` CSS, `$nextLayout` / `nextOn` markup). The method was static: greps across `src/`, then reading the guide, app.css, every component added since 10-20, and the round records (`docs/*-round.md`). **No browser was driven**, so nothing here has been checked as rendered. Each note says which side looks more recent. None of them says which side is right.

Line numbers are `file:line`. SG = `src/routes/styleguide/+page.svelte`. Dates come from `git blame`.

## Summary

| Group                                   | Findings |
| --------------------------------------- | -------- |
| 1. Tokens and colour                    | 10       |
| 2. Materials                            | 8        |
| 3. Type                                 | 6        |
| 4. Motion                               | 3        |
| 5. Marks and icons                      | 6        |
| 6. Components (rules applied to them)   | 6        |
| 7. Layout                               | 5        |
| 8. Undocumented patterns (the redesign) | 12       |
| 9. Stale guide entries                  | 9        |
| **Total**                               | **65**   |

What the dates show overall: the guide was last edited on 10-25 and 10-26 for the toolbar rounds (sentence case, "on is a fill") and for the filter rail's retirement. It was not edited for the inspector (10-23), the top bar and title bar (10-22 to 10-25), the edges round (10-25), the full-screen surface (10-25 and 10-26), or the notices, Roster, Teams, Profile and Settings rounds (10-26). Most of the gaps below come from that.

### The five most likely to matter for the flip

1. **The toast blurs its backdrop at 14px** (2.2). The guide retired `--glass-blur` and says it was struck rather than zeroed because any `backdrop-filter` costs WebKit frames, and that a bigger blur bands. `NoticeRegion.svelte:180` (10-26) ships `backdrop-filter: blur(14px)`. After the flip every visitor gets it.
2. **Nested `color-mix` in the rules the switch turns on** (1.7). The nesting law (`app.css:592-605`) says a mix result may never feed another mix, because WebKit drops the page. The "on/chosen is a fill" rules mix `var(--btn-face)`, which is itself a mix, at `app.css:2239, 2842, 2896, 2941, 2966` and `CharacterFilterStrip.svelte:324, 372`. The mirror test only checks custom-property declarations, so it cannot see these. `.btn.is-active` (`app.css:2713`, 08-07) has done the same thing for months, which is a data point for "survivable".
3. **The guide's structural sections describe the old layout** (9.1 to 9.4, 9.6). Band A as the document row, `.tab` document tabs, the beige top-level selection plate, and Help/About/Settings as modals all disappear at the flip. Once the switch is the default, the guide's Tool bands, Tabs and Structure sections describe a layout no user sees.
4. **Roster-scale grids render one `<img>` per tile** (2.7). The guide's Safari law says to use `background-image` on roster grids, and `CharacterCard` does. The Roster (`RosterTab.svelte:652, 656`) and the team details grid (`TeamDetail.svelte:707, 710`) use `<img>`, and the Roster is a main surface after the flip.
5. **The fade law versus eased tokens** (4.1, 4.2). The memory and `docs/title-bar-round.md` say every opacity fade is linear, but the guide never states it. The `--t-*` tokens bake in `ease` (`app.css:1014-1016`), and the guide says "there is one easing in the product" (SG:1155-1157). New fades in the top bar's profile-switch cue are `ease-out` and `ease-in`.

---

## 1. Tokens and colour

**1.1 The guide's token parser cannot see the second `:root` block**

- Guide: SG:71-82 parses "the :root block of app.css", ending at the first column-0 `}`. Tokens it doesn't see never reach the swatches or "Ungrouped".
- Site: `app.css:1550-1561` is a second `:root` holding `--ui-ctl-h`, `--ui-ctl-fs`, `--ui-bar-h`, `--profile-theorycraft` and `--portrait-unowned` (10-22 to 10-25). `:root[data-next] { --chrome-h: var(--ui-bar-h) }` is at 1572.
- Scope: 5 tokens, all redesign-era.
- Note: if they are ever merged into the first block, `--ui-ctl-*` and `--ui-bar-h` would land under "UI state colors", because SG:158 groups by the `--ui-` prefix.

**1.2 The context hover rung and the paper size rung are missing from Families**

- Guide: SG:109-117 lists each context as `--frame-bg / --surface / --surface-raised / --surface-well / --border / --text / --muted`.
- Site: `.ctx-dark` gained `--surface-hover: var(--slate-600)` (`app.css:1708`, 10-25, the full-screen round's bug fix). `--surface-broad` is declared in every context. The sidebar, cards and verbs on the full-screen surface depend on both.
- Scope: 2 roles, about 20 call sites.
- Note: the site is newer. The fix landed without a guide entry.

**1.3 Thirteen `:root` tokens show only as "Ungrouped (unclassified)"**

- Guide: SG:1223-1229 lists them under a warning badge.
- Site: `--hero-lit --hero-rule --veil-ground-top --veil-ground-bottom --surface-broad --inset-line --inset-line-quiet --inset-line-mid --site-pad-x --team-hue-first…fourth`. `--site-pad-x` (`app.css:763-764`) is the edges round's one site gutter, read by both bars and every tool.
- Scope: 13 tokens.
- Note: the guide flags them itself, so this is a known gap. `--site-pad-x` is the one the redesign leans on.

**1.4 Profile colours are element hues worn on UI chrome**

- Guide: SG:2035-2040 says "elements = the game · `--glass-bar` = our reading of it · chrome = the over-world white. Don't cross them." SG:2051-2054 says domain colours never appear on a control's state.
- Site: `profileLook.ts:51-52` resolves a profile colour to `var(--el-<x>-main)`. It is worn on the sidebar's current edge (`MenuState.svelte:263, 622-623`), Trash rows (`TrashPlace.svelte:254`), the toast swatch (`NoticeRegion.svelte:206-212`), profile-picture rings (`MenuState.svelte:~684`) and the Library's guest edge (`LibraryPlace.svelte:700`, Theorycraft white).
- Scope: about 6 surfaces.
- Note: this is a deliberate Nate ruling (design §2.3: exclusive colours are the 7 elements plus Theorycraft's white, 10-21/22). The guide has no entry for it.

**1.5 Literal colours in redesign-era components**

- Guide: SG:2123-2126 says ink comes "from the context, never from a literal". SG:2027-2033 says "White is not a member of either context" (only bar ink and black shadows are excepted). `app.css:886` records that there is no free blue.
- Site:
  - `BuffDetailRows.svelte:108` uses `#90b4d0` as the value ink (10-23, lifted from BuffTooltip). It now also renders in the Planner inspector.
  - `NoticeRegion.svelte:176` puts a 1px white inset ring (`rgb(255 255 255 / .1)`) on toasts.
  - The neutral hover discs are `rgb(127 127 127 / .22)` (`NoticeRegion.svelte:261`) and `/ .2` (`NoticeBanners.svelte:129`).
  - Scrims are five different literals: `rgba(16,16,19,.72)` (LinksDialog:70, MoveDialog:157, TabLimitDialog:104), `rgb(6 9 16 / .6)` (NoticeRegion:303), `rgb(0 0 0 / .55)` (InspectModal:110), `.5` (BossDetail:207, AbyssOpponents:140) and `rgba(3,6,14,.45)` (ToolColumns:323).
- Scope: about 12 sites in about 9 files.
- Note: all 10-23 to 10-26 except the older scrims. The guide has no scrim role (see also 8.9).

**1.6 Warning and positive are now zoned on paper**

- Guide: SG:1042 (08-12) says provisional "is the only zoned UI state colour".
- Site: `.ctx-light` declares `--ui-warning: #c85d02` and `--ui-positive: #018d65` (`app.css:1879-1889`, 10-26, the notices round).
- Scope: 2 tokens.
- Note: the site is newer, and the app.css comment explains it.

**1.7 Nested `color-mix` at rule level, under the switch**

- Guide: the nesting law lives in `app.css:592-605` ("A color-mix result may NEVER feed another color-mix… WebKit crashes the renderer"). SG does not state it. The guard (`timelineExport.mirror.test.ts:255-278`) checks only `--x: color-mix(...)` declarations.
- Site: `--btn-face` is a `color-mix` (`app.css:1112, 1779, 1908, 2072`). It is mixed again in `background:` at `app.css:2239, 2842, 2896, 2941, 2966` (all `:where(:root[data-next])`, 10-24/25) and at `CharacterFilterStrip.svelte:324, 372` (10-25). There is a pre-switch precedent at `app.css:2713` (`.btn.is-active`, 08-07).
- Scope: 7 rules, applied to every chosen chip, segment and plate.
- Note: app.css says the trigger is "nesting × element count". The 08-07 precedent has shipped through Safari checks, which may mean rule-level nesting is survivable. That is not stated anywhere.

**1.8 The top two line stops are "unused" in app.css but have component consumers**

- Guide/app.css: the comment at `app.css:~1733-1741` (08-10) says "nothing points at the top two any more… let the census report it free".
- Site: `var(--line-strong)` / `var(--line-edge)` appear in TopBar:586 (the current tool's hover ring, ⚓ Nate 10-25), LibraryPlace:844, SidePortrait (×2), SlotPortrait, Fingerprint (×3), CheckChip (×2), the planner page and LibraryView.
- Scope: 13 uses in 9 files.
- Note: the hover ring is a recorded ruling (title-bar-round.md). The census in SG cannot see this, because these are context tokens, not ramp rungs.

**1.9 Gold on a word**

- Guide: `app.css:3709-3726` says "GOLD NAMES A BLOCK; IT NEVER EMPHASISES A WORD", with inline emphasis explicitly left unresolved. SG:2455-2460 leaves "where the accent gets spent" open.
- Site: `LibraryPlace.svelte:1067-1069` sets `.row-now` ("Open now") to `--accent`, semibold (10-22).
- Scope: 1 idiom, 3 call sites (LibraryPlace:392, 426, 438).
- Note: gold marks (pins, chosen pips, wishlist stars) are a different case. Selection is accent, so those agree with the guide.

**1.10 The top bar has no white-accent zone**

- Guide: SG:744-754 says branding and top-level chrome stay `--chrome` white, and `.site-chrome` re-declares the accent and its derived tokens.
- Site: `TopBar.svelte` does not carry `.site-chrome`. On tool routes it renders inside `data-zone="tool"` (`(tools)/+layout.svelte:1156-1161`), so its accent is gold. `.tb-beta` reads `--accent` directly (TopBar:523), where SiteChrome used its own `--chrome-tag` role. The current tool selects with glass, not accent (TopBar:575-577).
- Scope: 1 component.
- Note: the visible result (gold BETA, white words) matches the rulings. What changed is the mechanism the guide describes.

## 2. Materials

**2.1 The full-screen surface is a screen of slate, which the material rules don't cover**

- Guide: SG:541-546 says `.ctx-dark` is for "chart-like panels… and the bench ribbon". The material law is night looks, glass touches, paper answers (SG:2394-2404). The Open list says meta overlays read the world's voice (SG:2496-2501).
- Site: `MenuState.svelte:541-552` fills the viewport with `--surface` (slate). Help and About are text on slate with paper patches (`.invite ctx-light`, MenuState:~477).
- Scope: the whole menu state (Library, Teams, Roster, Help, About, Settings, Profile, Trash).
- Note: ⚓ Nate (10-22 draft 5: "full-screen state is a STATE on slate, not an overlay"). Not in the guide.

**2.2 The glass toast blurs its backdrop**

- Guide: SG:640-662 and 2472-2479 retire `--glass-blur`: struck, not zeroed, because `backdrop-filter` at any value costs WebKit frames, and "a bigger blur BANDS".
- Site: `NoticeRegion.svelte:178-181` (10-26) uses `background: var(--glass-plate)` (the landing cards' stop, `app.css:216`) with `backdrop-filter: blur(14px)`. This is the only `backdrop-filter` on the real site apart from the dev grayscale overlay.
- Scope: 1 rule, every toast.
- Note: the site is newer, and the notices design doc does not record a decision on the blur.

**2.3 Dialogs come in three materials**

- Guide: the modal is the one surface that keeps an edge border and `--r-md` (SG:1580-1586, 2291-2300). The Open list says modals "may want a material of their own" (SG:2486-2490).
- Site:
  - The notice confirm dialog is paper (`NoticeRegion.svelte:117, 306-313`: `.nd ctx-light`, `--surface-broad`) with no border.
  - LinksDialog, MoveDialog and TabLimitDialog are slate (`ctx-dark`) with no border (`LinksDialog.svelte:44, 71-78`).
  - InspectModal is slate with a 1px `--border` (InspectModal:124, ruled 10-23).
- Scope: 5 dialogs.
- Note: the inspector modals' one frame is a recorded ruling, and the notices dialog's paper is in `docs/notices-design.md`. Nothing reconciles the three.

**2.4 Paper notices on tool surfaces**

- Guide: there is one paper card per instrument, because "a second card does not read as a second answer, it reads as the first one failing to be one" (SG:1659-1661, 2399-2402).
- Site: NoticeBanners (paper, `NoticeBanners.svelte:72-89`) stack at the top of ToolStack and MenuState, and error toasts are paper (`NoticeRegion.svelte:184-191`).
- Scope: every tool can show them.
- Note: the guide's rule is about instruments. Whether a paper notice beside a Readout card counts is not addressed.

**2.5 A tool feature as a modal**

- Guide: SG:2282-2285 says modals are for meta only, and every tool feature is a docked panel or an in-frame overlay.
- Site: the Builder's inspector is `InspectModal.svelte` (character, boss and opponents; 10-23).
- Scope: 3 Builder surfaces.
- Note: ⚓ Nate, inspector ruling 1 (`docs/inspector-round.md`: "a modal in the Builder").

**2.6 A CSS `filter` on portraits**

- Guide: SG:2200-2204 (Safari) says "No filters".
- Site: `--portrait-unowned: saturate(0.45) brightness(0.72)` (`app.css:1560`, 10-25) is applied as `filter:` in TeamDetail:1160, TeamMemberPortrait:147, TeamLoadoutPlates:208 and RosterTab:940.
- Scope: 4 files, up to roster scale.
- Note: it replaced an earlier `grayscale() brightness()` filter, so filters were already in use here. The guide's law is phrased around dimming, which this is.

**2.7 One `<img>` per tile in roster-scale grids**

- Guide: SG:2230-2231 says no per-item `<img>` on roster-scale grids until about Safari 27, and to use `background-image`. `CharacterCard.svelte:153-188` follows this ("122 cards: 222ms → 2ms").
- Site: `RosterTab.svelte:652, 656` (portrait plus element icon, 10-11) and `TeamDetail.svelte:707, 710` (10-25).
- Scope: 2 grids, about 123 tiles each.
- Note: the guide's law is older (07-xx). The Roster becomes a primary surface at the flip.

**2.8 Element `opacity` instead of paint alpha**

- Guide: SG:2200-2213 says to dim in the paint, never with element `opacity`, and especially not on anything transform- or parallax-placed.
- Site: `TopBar.svelte:498, 506, 524` (logo, wordmark, BETA at `opacity: .85`) sit on a bar that TopBar's own comment (746-749) says rides the parallax. The rule was carried over from `SiteChrome.svelte:537`. Also: MenuState:614-616 (`.side-item:disabled` .45), PlannerInspector:474 (.8), CharacterDetails:380 (.5), and the hover verbs fading by `opacity` (TeamsPlace:365-379, LibraryPlace:1091-1101, RosterTab:824-832).
- Scope: 3 in the top bar plus about 6 elsewhere.
- Note: only the top bar is transform-placed. The others are on the fixed menu state, which is the weaker case for this law.

## 3. Type

**3.1 The guide's spec lines give sizes and colours that app.css has moved past**

- Guide → app.css:
  - `.btn` "fs-sm" (SG:1376) → `font-size: var(--fs-md)` (`app.css:2674`).
  - `.chip` "fs-sm" (SG:1453) → fs-md (2863).
  - `.chip--control` "fs-md" (SG:1465) → fs-lg (2902).
  - `.note` "fs-md, relaxed leading" (SG:1618) → fs-lg with a 56ch measure (`app.css:3774-3794`).
  - `.kicker` "--muted UPPER ls-widest" (SG:1624, 08-09) → gold `--accent`, fs-lg (`app.css:3728-3739`, gold since 08-10).
- Scope: 5 spec lines.
- Note: the app.css values are newer in every case.

**3.2 Hand-rolled section labels next to `.kicker`**

- Guide: "a SECTION heading… `.kicker` stays on the sans" (SG:1251-1255). app.css:3720-3722 says "The kicker is our only section-label idiom". SG:1945-1949 says app.css is the only place these are defined.
- Site: uppercase muted labels without the rule or the gold: MenuState `.side-group` (572-579, 10-22, "quieter group headers" per `docs/fullscreen-surface-round.md`), LibraryPlace `.sec` (750-756), CompareControl `.cmp-kicker` (202-206), CharacterFilterStrip `.rfs-count` (380-385).
- Scope: 4 components.
- Note: the sidebar's quieter header is a ruling. "No gold kicker over a page's title" (`docs/fullscreen-cleanups-round.md`, 10-26) is also a ruling the guide doesn't record.

**3.3 An uppercase control under the sentence-case law**

- Guide: SG:2129-2132 (10-24) says controls are sentence case, and only kickers and chart axis titles are capitals.
- Site: `PlannerInspector.svelte:285-296` sets `.pi-crumb` (a breadcrumb `<button>`) to `text-transform: uppercase`, `--ls-widest` (10-23).
- Scope: 1 control.
- Note: it predates the sentence-case ruling by one day.

**3.4 Line heights off the ladder**

- Guide: the `--lh-*` ladder is 1 / 1.2 / 1.4 / 1.5 / 1.6 (SG:1327-1336, `app.css:1492-1496`).
- Site: NoticeRegion:173 uses `1.35` and NoticeRegion:322 uses `1.45`. NoticeBanners:85 (`1.4`) and LinksDialog:89 (`1.5`) use the ladder's values as literals.
- Scope: about 4 sites, all 10-23 to 10-26.

**3.5 Dialogs redefine `.title` and `.note` locally**

- Guide: SG:15-16 says not to fix a pattern by editing a component. `.note` is margin-free because "spacing belongs to the container" (`app.css:3768-3774`).
- Site: scoped `.title` / `.note` / `.note--quiet` with their own margins, sizes and leading in LinksDialog:80-94 and MoveDialog:167-216.
- Scope: 2 dialogs (10-23).

**3.6 "colour" in the code base**

- Guide: SG:2420-2425 says US English everywhere, including comments and identifiers.
- Site: 319 occurrences in 71 files under `src/`, including identifiers (`ProfileColour`, `colourValue`, `nextColour`) and the guide's own prose (SG:623, 1042, 1143).
- Scope: site-wide and longstanding.
- Note: user-facing strings appear clean. The memory records the UI "Color spelling" fix from 10-23.

## 4. Motion

**4.1 The fade law is not in the guide, and the tokens it would govern are eased**

- Guide: SG:1155-1157 says "A token is a duration AND its easing… one easing in the product". The tokens are `--t-snap: 120ms ease`, `--t-quick: 150ms ease`, `--t-move: 240ms ease` (`app.css:1014-1016`). The guide never mentions linear fades.
- Site and rulings: memory `feedback_fade_law` (reaffirmed 10-25) and `docs/title-bar-round.md` ("Linear, at `--t-quick`… Nate kept the fade law"). The tool crossfade hard-codes `linear` (`(tools)/+layout.svelte:1336, 1358`). Opacity transitions on the eased tokens remain in about 12 files: SiteChrome, TopBar, TeamsPlace, LibraryPlace, RosterTab, CloseMark, RotationTimeline, the Builder page, ArtifactInstrument, CharacterCard, +error, app.css.
- Scope: about 20 rules.
- Note: the fade law applies to "every opacity fade on the site", but its memory text mostly discusses landing and tool fades. Whether control-hover opacity counts is not stated anywhere.

**4.2 Eased fades in the top bar's profile-switch cue**

- Guide/law: as in 4.1.
- Site: `.tb-wash` uses `wash-out … ease-out` (TopBar:890-907) and `.tb-cue-name` uses `ease-in` (TopBar:919). Both are opacity keyframes (10-22). `.st-dot` pulses opacity at `0.9s ease-in-out infinite` (TopBar:644).
- Scope: 3 animations.

**4.3 Component keyframes and literal durations**

- Guide: SG:1158-1164 says keyframes are the one place reduced motion is honoured by hand. `app.css:1523` says "`pulse-confirm` is the only one". The paint-animation law is at SG:2248-2251.
- Site: keyframes in TopBar (`brief-in`, `st-pulse`, `wash-out`), RosterTab (`ros-flash`, 1.4s ease-out animating `box-shadow`, 869-880), NoticeRegion (`nt-drain`, the timer ring, linear by design), ToolColumns (`tc-aside-rise`, scroll-driven), CritInstrument (`cv-dot-in` 260ms ease-out) and LoadingVeil (scene, exempt). Every shake does use the shared `nudge`, spent as `120ms 2` at 5 sites.
- Scope: about 6 component keyframes outside the scene.
- Note: the app.css "only one" comment is stale (see 9.8). The rule that bans local shakes is followed.

## 5. Marks and icons

**5.1 A unicode glyph in a control**

- Guide: SG:1737-1741 and 2406-2407 say marks are geometry, never a unicode character.
- Site: `MenuState.svelte:442` renders `<span aria-hidden="true">‹</span> Menu`, the phone's way back (10-25).
- Scope: 1 control.

**5.2 Bespoke, non-Lucide marks inside the set**

- Guide: SG:1719-1727 says control glyphs come from Lucide through the generator. SG:1760-1765 says not to hand-copy SVGs. SG:1816-1822 lists the two marks "deliberately NOT in the set".
- Site: `scripts/lib/bespoke-marks.mjs` (10-24) merges Nate's `handOff` art into `MarkName` through `generate-marks.mjs`.
- Scope: 1 mark, plus a new route for adding more.
- Note: the hand-copy rule was about provenance. This art has provenance (Nate's), so the reason doesn't apply, but the guide doesn't describe the route.

**5.3 Filled marks**

- Guide: SG:1755-1758 says marks are decorative with ink from `currentColor`. Filled variants are not mentioned.
- Site: `Mark.svelte:107-136` takes `filled?: boolean | 'solid'` (the Roster round, 10-26; also play/pause). It is used in RosterTab, CharacterDetails, LoadoutPanel and SlotPortrait.
- Scope: 4 files.

**5.4 Top-bar door glyphs are sized by ink, not at 28px**

- Guide: SG:2165-2166 says "Button marks are 28px", built as a disc with the glyph as an evenodd hole.
- Site: `TopBar.svelte:712-760` sizes them from `--tb-glyph-h = --ui-ctl-h − 6px` × `--disc` 1.12 × a per-door `--ink` (compass ×1.1, Teams 1.22). That is about 29px at Medium and varies with the interface size.
- Scope: 5 doors.
- Note: ⚓ Nate, the title-bar round (10-25).

**5.5 The guide names a probe that doesn't exist**

- Guide: SG:1824 says "`scripts/probe-marks.mjs` is the guard".
- Site: there is no such file. `scripts/` holds only `probe-ink-centering.mjs`, and CLAUDE.md calls `probe-*` a retired pattern.
- Scope: 1 line.

**5.6 `⋯` typed in Help prose**

- Guide: SG:1809-1815 says three things stay typeset on purpose (`5★`, the `?` hedge, and `× · → ⁄` in prose).
- Site: `⋯` names the menu control in Beta:38, Contribute:32, Faq:119, Visualizers:48 and 56, and RotationPlanner:384 (help chapters).
- Scope: 6 sites.
- Note: it is a reference to a control in prose, which the guide's exception list doesn't cover either way.

## 6. Components (rules applied to them)

**6.1 Two guide lines still describe the ring**

- Guide: SG:1916 says "Band B selects with the ordinary ring". SG:1484 says `.chip--icon` "active lifts to 1 + element ring".
- Site: under the switch, chosen is a fill. `.chip--icon.active` mixes `--chip-color` 28% into `--btn-face` (`app.css:2964-2967`).
- Scope: 2 spec lines.
- Note: SG:1426-1436 and 2187-2193 already state the fill rule (10-25). These two lines were missed.

**6.2 The retired `--r-lg`, still referenced with a fallback**

- Guide: SG:1079-1081 says `--r-lg` 9px was retired, and SG:2410-2413 says "Only four radii exist… No exceptions".
- Site: `var(--r-lg, 6px)` is undefined, so 6px renders, at InspectModal:125 (10-23), BossDetail:221, AbyssOpponents:153 and LibraryView:1520. Literal radii instead of tokens (`3px`, `1px`, `6px`, `999px`, `50%`) appear at about 30 more sites, including TabLimitDialog:110, PlannerInspector:356, CharacterDetails:323/375/396/414, DocumentTabs:472/548/571, LibraryPlace:735, MoveDialog:185, and app.css itself at 2595, 3577, 3584, 3862.
- Scope: 4 `--r-lg` sites plus about 30 literals in about 20 files.
- Note: the values mostly equal the scale's (3/6/1/999). The disagreement is that they are named as literals. The `--r-lg` fallback in a 10-23 file was copied from LibraryView (10-18).

**6.3 Notices round their corners like modals**

- Guide: SG:1071-1075 says `--r-md` is for modals only (Help / About / Settings / the pages panel).
- Site: toasts (NoticeRegion:171), the confirm dialog (308) and banners (NoticeBanners:81) use `--r-md`.
- Scope: 3 surfaces.
- Note: ⚓ Nate, notices ruling ("corners --r-md", `docs/notices-design.md` §9).

**6.4 Edge lines on the new surfaces**

- Guide: SG:2291-2300 says an edge border retires to nothing, and the modal is the one survivor.
- Site: the toast has a 1px white inset ring (NoticeRegion:176). Banners and error toasts have a 4px coloured left stripe (NoticeBanners:88, NoticeRegion:190). LibraryPlace's narrowing chip has a 1px `--sel-ring` border (734). Hand-rolled fields have 1px `--border` borders (ProfileForm:510, LibraryPlace:1048). The sidebar's `border-right: 1px --line-faint` (MenuState:~568) is a structural hairline, which the guide allows (SG:2311-2312).
- Scope: about 5 components.

**6.5 Global class names redefined, and fields hand-rolled**

- Guide: SG:1945-1949 says app.css is the only place a button, chip, tab, toggle, note or field is defined.
- Site: LibraryPlace scopes its own `.chip` (726-738, a bordered capsule). LinksDialog and MoveDialog scope `.title` / `.note` (see 3.5). Text inputs bypass `.field`: ProfileForm uses `.text` ×3, LibraryPlace `.rename`, TeamDetail `.td-name`. These carry their own border or ground, while `.field` uses an inset shadow on `--fill-rest`.
- Scope: about 6 components.
- Note: the profile-surface memory records why: "a global `.field` class boxes any form using that name". That is a class-naming collision rather than a design choice.

**6.6 Control size under the switch is the interface size, which the button spec doesn't know**

- Guide: SG:1374-1377 gives `.btn` as "3px · 0.32/0.65rem · fs-sm". The band height is `BAND_CTRL_H` 36 (SG:1844-1846).
- Site: `:root[data-next] .band-b .tab, .band-b .btn { font-size: var(--ui-ctl-fs) }` (`app.css:2289-2292`). The top bar is built from `--ui-ctl-h` and `--ui-bar-h`.
- Scope: every toolbar control.
- Note: see 7.1.

## 7. Layout

**7.1 Interface size (Small / Medium / Large)**

- Guide: none. The Metrics section shows only `--chrome-h` and `--site-footer-h` from the first `:root` (SG:1218-1221).
- Site: `app.css:1536-1581` sets the sizes by width (28/32/36 controls, 48/56/64 bar). `--chrome-h` becomes `--ui-bar-h` under the switch.
- Scope: both bars and every toolbar.
- Note: ⚓ Nate (10-22). The Settings pin retired on 10-26.

**7.2 The one site gutter**

- Guide: listed only as an unclassified token (1.3).
- Site: `--site-pad-x` (`app.css:763-764`) is read by the tools, both bars and the menu sidebar (`MenuState.svelte:563`).
- Scope: site-wide.

**7.3 Scroll fades and "the fade ends at the neighbour"**

- Guide: none.
- Site: `.scroll-fade` / `.scroll-fade-x` (`app.css:3315-3507`, 08-10). The law "THE FADE ENDS AT THE NEIGHBOUR" (`app.css:3419`, 10-25) says a scroller reaches into the `--room-*` gap that `ToolStack` publishes.
- Scope: every tool scroller.

**7.4 Band B's centre has no ground, and the phone bench has a rail**

- Guide: SG:1851-1853 says "The only rail left is the one a tool asks for by filling `bandBCenter`, and that rail is a plate like the others."
- Site: under the switch the 3-up centre zone drops its paint (`ToolStack.svelte:602`). The phone bench gains a `benchRail` strip above the bench row (`docs/toolbar-refine-round.md`), and the desktop bench foot holds Compare and Save as team.
- Scope: the Planner and Builder toolbars, and the phone bench.

**7.5 Coarse-pointer hit boxes**

- Guide: none. The responsive laws are only in CLAUDE.md and the survey doc.
- Site: `app.css:3894-3960` (09-05, 10-15; 44px ⚓ Nate).
- Scope: global.
- Note: this predates the redesign.

## 8. Undocumented patterns (the redesign)

None of these have an SG section. Where a specimen board exists, it's named.

1. **The top bar** (`TopBar.svelte`): centred Bitter tool words with no plate at rest; the current tool filled with glass and a small bold Bitter label; a hover ring only on Library-opening buttons; doors sized by ink (5.4); the profile picture with an element ring; BETA anchored to the wordmark; save status (Saving… with a pulsing dot); the profile-switch colour wash plus name cue. Record: `docs/title-bar-round.md`, `docs/top-bar-round.md`.
2. **The menu state (full-screen surface)** (`MenuState.svelte`): a 17rem sidebar with 16px items, 18px marks, quieter uppercase group headers, counts and a profile switcher row; expand-in-place Help and About; a current item marked by `--surface-hover` plus a 2px inset edge in gold or the profile's colour (618-623); ✕ at top right, "‹ Menu" on a phone; a `headActions` slot; the reading layout (68ch plus a 16–28rem margin, container query); phone tool tiles with a 1.5px gold inset when current (743).
3. **Library places** (`LibraryPlace.svelte`): rotation rows and lineup cards; a shelf of pins; a compare pair nested with A/B tags; verbs shown on hover or `:has(:focus-visible)` and always shown under `hover: none`; the current item as a pseudo-element ring over the verbs; "Open now".
4. **Teams and team details** (`TeamsPlace.svelte`, `TeamDetail.svelte`, `TeamMemberPortrait.svelte`): cards with pips, a details screen sharing the Roster's strip, unowned portraits through `--portrait-unowned`, selected = ground plus gold ring on the box (the teams-surface memory: Nate rejects ring + glow + badge).
5. **Notices** (`NoticeRegion.svelte`, `NoticeBanners.svelte`, `$lib/notices.svelte.ts`): the toast (glass; an error is paper and stays; a timer ring around the ✕; hover is the ring's circle), the banner (paper, a severity stripe), the confirm dialog (paper), save status, all at `--fs-xl`. Specimen board: `/lab/notices`, which SG does not link to. Spec: `docs/notices-design.md`.
6. **The setting row** `.sp` / `.sp-row` / `.sp-name·-ctl·-note` / `.sp-section(--danger)` / `.sp-status` (`app.css:4316-4482`, 10-26): a global class family with folding container queries.
7. **The inspector**: the Planner pane (`PlannerInspector.svelte`; widths 300/340/380 by screen), the Builder's `InspectModal` shell (gold kicker, display title at `--fs-4xl`, hairline, `--im-pad-*`), the gold inset ring on a picked bar and the held portrait gold on the bench. Record: `docs/inspector-round.md`.
8. **Profile identity**: element-hue profile colours (1.4), Theorycraft white `--profile-theorycraft`, pictures (`profileLook.ts`), and the "guest" ring on a tool button (TopBar `.is-guest`).
9. **Scrims**: five literal values (1.5) with no role.
10. **Older globals still absent from SG**: `.banner` / `.banner-end` (a section label, 08-08; ⚠ the same word as the notices "banner", a different thing), `.night-ribbon(--danger)` (08-10), `.scroll-fade(-x)`, `.instrument-*`, `.slider-*`, `.chip--sm`, `.cov-state--*`, `.band--3up`, `.lede`, flavor text (`app.css:2581`), the text link outside prose (`app.css:2496`).
11. **The one nudge** (`app.css:2771-2797`): the site's only refused-action shake, with its own reduced-motion redefinition and the `120ms 2` spend. SG has nothing on it.
12. **Hover only where a pointer can hover** (`@media (hover: hover)` rings; verbs under `hover: none`). It is stated in passing at SG:1432-1433 but has no rule or specimen.

## 9. Stale guide entries

**9.1 Tool bands describe two rows and band A as the document**

- Guide: SG:1836-1936. Band A is the DOCUMENT row (tabs · save · load · share · reset), identical in Planner and Builder, with `BAND_A_H` 27. SG:2386-2389 adds "band A still spans the screen" for the Visualizers.
- Site: under the switch `benchBand.noBandA = nextOn` (`(tools)/+layout.svelte:100`). The Builder passes `noBandA={$nextLayout}` (builder/+page.svelte:1394). The document is in the top bar, and Share is each toolbar's last plate (`docs/title-bar-round.md`).
- Note: the site is newer. Until step 5, the old form still exists with the switch off.

**9.2 "The bench ribbon opens on band A's top edge"**

- Guide: SG:2322-2334.
- Site: there is no band A under the switch, and the head reads the measured band B height (`benchBand.bandBH`, ToolStack:132-134).

**9.3 Tabs**

- Guide: SG:1508-1510 says "Document tabs (band A) are the base size and the whole live population".
- Site: under the switch no `.tab` renders. DocumentTabs lives in the hidden band A, and AreaTabs / HelpAreaShell serve only the old modal layout.

**9.4 Top-level navigation selects with the beige plate**

- Guide: SG:2095-2105 names two consumers: the Team Builder's Atlas/Roster/Compare plate and the Help chapter nav. SG:1912-1916 adds the band A beige pilot.
- Site: `--sel-surface` / `--sel-ink` have one consumer, `HelpAreaShell.svelte:218-219`, which is old-layout only. The Atlas/Roster/Compare plate is gone. The new top-level selections are glass fill (top bar) and hover rung plus a coloured edge (sidebar), as in 8.1 and 8.2.

**9.5 The inset family**

- Guide: SG:1675-1683 says the set is closed at two and the TB's selected navigation plate wears `--plain` at 1.5px. SG:2505-2508 (Open) says "five to choose from now… Nothing wears one yet except the bench ribbon".
- Site: no element outside `/lab` (`lab/+page.svelte:142`) carries `.inset`.
- Note: the guide contradicts itself on two versus five.

**9.6 The aside's occupants**

- Guide: SG:2350-2357 says "the planner's notes, or its Source's filters covering them".
- Site: the Source retired on 08-13. Under the switch the planner's aside is the inspector (notes moved into its team page) or the aura log (`docs/inspector-round.md`).

**9.7 Meta surfaces as modals**

- Guide: SG:780-787 says `ChromeModals` is mounted outside `.tool-shell` "so Help/About/Settings read the world's voice". The Open item at SG:2496-2501 says the same.
- Site: under the switch they are MenuState sections on slate (2.1). ChromeModals serves the old layout.

**9.8 The keyframe count**

- app.css: `app.css:1522-1523` says "`pulse-confirm` is the only one" (that honours reduced motion by hand).
- Site: `nudge` lives in app.css too, and about 6 component keyframes exist (4.3).

**9.9 "Behind the switch until the flip"**

- Guide: SG:1348, 1426 and 2191-2192 describe the sentence-case and fill rules as gated by `:where(:root[data-next])` "until the flip".
- Site: this wording goes stale the moment the switch becomes the default. The gated `:not([data-next])` halves remain in app.css until step 5.
- Note: the specimens render under whichever state the root layout sets (`src/routes/+layout.svelte:58-61` toggles `data-next` on `<html>`), so after the flip SG shows the new forms with no code change.

---

### Not checked

Nothing was checked as rendered (no browser session). Every Visualizer instrument interior beyond the greps above was skipped. Spacing has no token scale in the guide, so it was not swept. The `RotationTimeline` (60 literal colours, 12 literal radii) and `ValueWheel` counts are pre-redesign and appear in the greps but not as findings here.
