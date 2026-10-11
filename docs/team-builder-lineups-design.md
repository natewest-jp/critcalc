# Team Builder — lineups, the split screen, the fingerprint (design, 2026-10-07)

**Status:** ⚓ DESIGN AGREED with Nate, 2026-10-07. ⚠️⚠️ **§11 (2026-10-10) WINS over every
earlier section** — it reshapes the tool into the game's Party Setup and replaces §2.4 and the
remaining build steps (§10.6 6–8). Read §11 first. This record is the
starting point of the build session(s). Everything below marked ⚓ is Nate's ruling;
everything else is an agreed default.

**What came before (all merged to `main` and pushed, origin `a99a8cef`):**

- `721a5bee`: Compare's chart sees what supports do (`DerivedCapability.host`/`value`; coordinated-attack windows).
- `73ee3f06`: Compare as one block per effect.
- `c6ceb8c3`: one Roster (the Atlas cards are its front door), one finder, `providesFacet`, team delta.
- `5bba0571`: the rotation-backed audition.

Plan of that round: `~/.claude/plans/i-like-this-plan-twinkling-wind.md`.
Memory: `project_tb_round_2026_10`.

---

## 1. Why the tool changes shape

The round rebuilt Compare four ways, and Nate's verdict was the honest one: **powerful,
and incomprehensible**. Two findings sent the design up a level.

1. **Bars answer the wrong question.** Stacking each character's duration and cooldown
   answers "is 15s longer than 18s?". Nobody chooses a character on that. ⚓ The question
   is how a kit fits **this team and this rotation**, and that is the Planner's job. The
   Planner is one click away with the swap already made. **Compare stops doing the
   Planner's work; the bars go.**
   ⚓ Measured uptime is ALSO out: a swap usually means re-ordering the rotation, so
   reading uptime off the old order before the player can adjust it is unfair to the
   candidate.
2. **Comparing characters in a vacuum is weak.** What players actually do (Nate, as a
   player):
   1. **Learn** what characters offer. Bosses put "checks" on a team (a heal, a shield,
      …). ⚓ This is the single most important job.
   2. Find **alternatives** from the Planner, without rigidity: a different team
      **archetype** counts (put a Hydro unit into Overloaded and get Overvape).
   3. See the **tradeoffs** at the consideration stage, so a lost ATK buff or RES shred is
      known before the team is tried, not after.
   4. _(added)_ Answer it **with what I own**.
   5. _(added)_ Build **several teams that cannot share characters**. Stygian Onslaught
      wants three; Abyss wants two. ⚓ **This is the richest fruit of the round**:
      Stygian is the most-discussed endgame mode (stygian.moe), and theorycrafters run
      "how many non-overlapping teams can be built" exercises (Zajef77's "strongest
      non-overlapping Stellar teams").
   6. _(added)_ Think in **reactions**: an archetype is which reactions the team's
      elements enable.
   7. _(added)_ **Tradeoffs ripple.** A swap can switch off a TEAMMATE's buff: put a
      Hydro unit beside Chevreuse and her ATK buff stops, though she never moved.

**So the Builder stops being a comparison tool and becomes a TEAM tool:** learn and
find (the Roster), assemble (teams, plural), swap (a slot's candidates).

---

## 2. The architecture

### 2.1 ⚓ The Builder leaves the shared bench and the Planner's tabs

The bench existed because the Builder edited the ONE team the Planner ran. A tool that
builds three teams cannot hold one shared team.

- The Builder renders **no bench and no rotation tabs**. That frees horizontal space and
  band A.
- The Planner keeps its bench exactly as it is.
- ⚠️ **The bench's cross-tool glide becomes Planner-only.** Crossing Planner → Builder
  must take the ribbon away cleanly instead of docking it (the glide timing is Nate's
  tuning, ⛔ not ours).
- ⚠️ **Loadout editing moves into the Detail card.** The roster's (Layer 1) loadout was
  only editable through the bench, and the Detail card already edits Layer 1
  constellation.

### 2.2 A new document: the BOARD (a lineup of teams)

- A board holds N teams. ⚓ Three for Stygian, two for Abyss, and the user can add more.
- A team is four slots, plus an optional **link** to a Planner tab, plus an optional
  **battlefield** (§2.6).
- ⚓ **Boards are saved, and you flip between them** (a Stygian lineup, an Abyss
  lineup). They use band A with the **same tab grammar as the Planner's rotation tabs**,
  so people already know how they behave.
- **A share link for a board** (in the shape of the Planner's `?r=` codec, versioned).
  Lineups are what people post and argue about.
- Its own localStorage store. ⛔ Never inside `rotationTabs`.
- ⚓ **No repeats: ALLOW AND MARK.** Each board has a "No repeats" setting (on by
  default for a Stygian-style board):
  - a repeated character carries a conflict mark on both teams;
  - in the roster pane, a character already placed wears which team holds them
    ("T1").

  You are informed, never blocked, so theorycrafting and pre-pull planning keep
  working.

### 2.3 ⚓ Links are LIVE VIEWS, not copies

- A linked team **reads** its Planner tab's slots, which come from the notation, which
  is the single source of truth. There is no sync problem, because there is no second
  copy.
- A chain mark shows which teams are linked.
- **Open in Planner** on an unlinked team creates a tab and links it.
- **Unlink** turns a linked team into a free-standing copy.
- ⚓ **Swapping a character in a linked team renames them in the notation**
  (`renameCharacterInNotation`, the audition commit we already have). The rotation
  survives.
- ⚓ **Removing a character from a linked team asks first:** "Unlink and remove", or
  "Remove from the rotation too" (that deletes their segments; ⌘Z in the Planner is the
  net).
- **Closing the linked tab in the Planner** leaves the team with its four characters,
  unlinked. ⛔ It is never deleted.
- **Arriving from the Planner** (its ⇄, or "Open in Builder") lands on the board holding
  that tab's linked team, at 50/50, with the slot selected.
- **Try in Planner** from a swap opens a NEW tab with the swap made, so trying is free
  and reversible.

### 2.4 ⚓ The split screen: three states, animated wipes

Genshin's own endgame party screen is this shape: roster on the left, battlefields on the
right.

1. **Roster, full width.** The cold start: no board in progress, not arriving from the
   Planner. It offers **Build a team**.
2. **50/50:** the roster beside the board. "Build a team" wipes the board in from the
   right.
3. **Board, full width:** the roster wipes out, for reviewing a whole lineup.

- One control, three positions. Each half keeps its scroll and filters while hidden.
- **On a phone** there is no 50/50: two full-screen states, the same wipe.
- 🎛️ The wipe moves a whole half of the screen. It wants its own motion value, which
  Nate tunes; ⛔ not one of the three `--t-*` bands by default.

### 2.5 Picking into a slot: Compare and Audition dissolve here

- **Click a slot:** the roster pane becomes **candidates for this slot**, grouped by
  what the swap DOES, not by how similar the candidate is:
  - **Keeps everything:** the like-for-like replacements.
  - **Trades:** "+ RES shred · − ATK buff".
  - **Changes the archetype:** "adds Vaporize · loses Overloaded".

  Every group includes the RIPPLE (§1.7): teammates' conditions are re-checked against
  the new team. Owned characters first (the finder's `rank: 'ownedFirst'`).
  ⏭ Group ORDER and within-group order: neutral by default (alphabetical, owned
  first). "Fewest losses first" is arithmetic, but it nudges toward advice; decide
  in the build session.

- **Click empty space:** the plain Roster, for learning and finding.
- **On a linked team,** the swap also shows the rotation read ("In your rotation"), the
  planner's parse with the candidate renamed in (`auditionRotation.ts`, kept). ⚠️ It
  is a reading of the CURRENT order, and the copy must say so (see §1 point 1).
- Drag-and-drop from roster to slot is a nicety, not a launch requirement.
- Free-standing "compare these two" survives only as a lightweight extra: select cards
  in the Roster and see their fingerprints stacked inline. ⛔ No surface of its own.

### 2.6 Battlefields: a framework, not a catalogue

The game's recommendation chips ("👍 Multi Elemental DMG | Bow characters",
"👎 Single Elemental DMG") are mostly **conditions we can check against a team**.

- A team may carry a **battlefield**: a name, an optional boss portrait, and a few
  **checks**. Each check reports a plain fact, never a verdict:
  - "Bow characters: 2 of 4";
  - "Elements: 3".
- **The thumbs are the game's verdict, quoted.** We only check the team against them.
- **Users author their own checks** ("needs a healer", "needs a shield"). That covers
  Abyss halves and homemade challenges with zero upkeep from us.
- ⏭ **A curated current-season preset** (three bosses, their chips, their portraits) is
  the optional extra, and the only part with ongoing cost: about six-weekly data plus a
  boss-portrait asset pipeline. ⛔ We do not catalogue Stygian (other sites' territory);
  we give people a framework to plan on. Decide separately.

### 2.7 One boundary: no "highest floor" optimiser

Distributing a roster so the weakest team is as strong as possible needs a measure of
team STRENGTH, which means damage. That is not the goal now (⚓ not a "never").

What the board makes easy instead is the manual version:

- every team's fingerprint, side by side, so the floor is visible as facts ("team 3 has
  no healer");
- the **leftover pool** (characters not yet placed) as a roster view.

---

## 3. The team row

⚓ Nate's sketch, horizontal, like the Stygian screen. A board stacks these vertically:

```
◯ ◯ ◯ ◯   (resonance) (reactions) (factions)        ← avatars · composition chips
⬤ ⬤ ⬤ ⬤ ⬤   ⬤ ⬤ ⬤ ⬤ ⬤ ⬤ ⬤ ⬤ ⬤ ⬤   ⬤                ← fingerprint: Survival · Support · Damage
```

- **Why horizontal:** a board stacks TEAMS vertically, so a team is a row. The bench is
  vertical only to align with the Planner's track rows, which the Builder has none of.
  Four across already fits at 390 (the bench's phone form).
- **Avatars:** reuse the bench's compact card grammar (the element-washed disc, the
  constellation chip). Same portrait language, laid out sideways.
- **Composition chips** (⚓ these three to start; more may surface later):
  - **Resonance:** element icon(s) plus a label (`deriveResonances`; full party only).
  - **Reactions** the team's elements can make. ⚓ Drawn like Stygian's chip: **the two
    element icons, each clipped to one side of a diagonal line** (generated, no new
    art). Include the enabler reactions (Lunar, Stellar) where `enablesReactions` /
    `teamEnablesReaction` say so.
  - **Factions:** Moonsign (Ascendant Gleam), Hexerei (Secret Rite), the Natlan count
    (`deriveTeamComposition`).
- **Fingerprint:** §4. It REPLACES the "This team covers" chips: one vocabulary for a
  character and for a team.
- **Conflict mark** (No repeats), **chain mark** (linked), and the battlefield header
  when set.
- Phone: the fingerprint wraps into its three clusters, one per line.

---

## 4. The fingerprint

One fixed row of icons, the SAME order for every character and every team, so
differences are seen as shapes before anything is read.

### 4.1 ⚓ Four states, presence only (no fill)

| State        | Meaning                                                        | Drawn as                                       |
| ------------ | -------------------------------------------------------------- | ---------------------------------------------- |
| **lit**      | provides it                                                    | the glyph in full ink / element-neutral colour |
| **outlined** | provides it, but **inactive in this team** (a condition fails) | the glyph's outline only                       |
| **locked**   | provides it only above the current constellation lens          | dim glyph plus the `gated` Mark                |
| **unknown**  | the kit is uncurated                                           | dim glyph plus the `uncurated` Mark ("?")      |

- An absent capability is the dim glyph (or an empty place-holder) and keeps its
  POSITION.
- **On a team fingerprint, dots under each icon count its providers** (two dots = two
  people cover it). That is redundancy shown, never judged.
- ⛔ **No fill-as-uptime** (⚓ Nate, §1 point 1). Uptime is the Planner's.
- ⚠️ **States live in the PAINT, never element opacity** (sub-pixel laws). That is why
  the set must be SVG.
- Tap or hover an icon: one sentence ("+20% ATK · team · 12s every 15s", plus its source
  and condition). This is the old fact cell, on demand.

### 4.2 The fifteen, in the role cards' clusters (`FUNCTION_FACETS`)

| Cluster      | Capability       | Icon today                                                               |
| ------------ | ---------------- | ------------------------------------------------------------------------ |
| **Survival** | Heal             | ✅ `Icon_Attribute_Healing` (webp)                                       |
|              | Shield           | ✅ `Icon_Attribute_Shield_Strength` (webp)                               |
|              | Cleanse          | ❌ new concept                                                           |
|              | Taunt            | ❌ new concept                                                           |
| **Support**  | ATK buff         | ✅ `Icon_Attribute_Attack`                                               |
|              | EM buff          | ✅ `Icon_Attribute_Elemental_Mastery`                                    |
|              | Crit buff        | ✅ `Icon_Attribute_Critical_Hit`                                         |
|              | DMG% buff        | ~ the planner borrows the white "omni" element; wants its own glyph      |
|              | HP/DEF buff      | ~ two icons (`Health`, `Defense`) for one capability; wants one glyph    |
|              | Energy           | ✅ `Icon_Attribute_Energy_Recharge`                                      |
|              | RES shred        | ❌ new concept                                                           |
|              | Grouping         | ❌ new concept                                                           |
|              | Infusion         | ❌ new concept                                                           |
|              | Interruption res | ❌ new concept                                                           |
| **Damage**   | Off-field DMG    | ❌ new concept (⛔ not the role set's "off-fielder", which names a ROLE) |

🎨 **Nate's art list:** the whole set of **15 as single-colour SVGs in one style**:

- 8 traced from the existing webp;
- 2 redesigned (DMG%, HP/DEF);
- **7 new concepts** (cleanse, taunt, RES shred, grouping, infusion, interruption res,
  off-field DMG).

Optional: faction emblems (Moonsign, Hexerei, Natlan), which are text pills today. Boss
portraits only if curated seasons go ahead.
Pipeline: `static/assets/…` plus a generator in the shape of the element icons'
(content-hashed; see the immutable `/assets/*` caching note in memory
`project_tb_atlas_round`).

---

## 5. The technical core: checking conditions against a TEAM

"Outlined" (§4.1), the ripple (§1.7) and the swap groups (§2.5) all need a capability's
conditions **evaluated against a concrete team**, not just a constellation:

- element counts (`teamElementCount`);
- faction counts (`teamFaction`);
- enablers (`teamEnablesReaction`);
- "active character is …" where the slot decides it.

- `deriveCapabilities.ts`'s `evalAtConstellation` answers only constellation and
  ascension today; every team leaf is a CAVEAT (`null`). Extend it with an optional team
  context so those leaves can answer true or false.
- ⛔ The module stays **TYPES-ONLY** (Node scripts import it). Write the team evaluator
  there, ⛔ never import the parser's `evalCondition`.
- Mirror the parser's semantics leaf for leaf, and pin both with a test over corpus
  conditions so they cannot drift.
- Measured proof the inputs exist: the rotation read already showed Chevreuse's ATK buff
  at 0% in a Hydro/Anemo team.

---

## 6. What carries over, what retires

**Carries over** (this round's merged work):

- `splitRoster` (the one finder: `exclude`, `rank`) and `providesFacet`;
- `teamDelta`, which grows into the swap groups;
- the Roster front door (role cards, sections) and the role strip;
- `auditionRotation.ts` (linked swaps);
- `DerivedCapability.host` / `value`;
- the capability vocabulary and magnitude formatting (now the fingerprint's
  sentences);
- `capDetailText`'s "coordinated attack";
- the `pin` mark (may retire).

**Retires:**

- the Compare tab and CompareView's blocks, column header and "+ Add";
- `CompareBar`, `barCycles` tiling, compare.ts's lane builder, the axis and lens;
- the audition's candidate strip, which becomes the roster pane's swap mode;
- CoveragePanel, which becomes the team fingerprint plus chips;
- the Builder's bench and band A rotation tabs.

⚠️ Sweep for dead code with the orphaned-schema test and `svelte-check`'s unused-CSS
warnings, and delete what the new shape no longer reads.

**Specs to rewrite:**

- `team-builder.spec` (compare and audition);
- `cross-tool.spec` (⇄ lands on the board);
- `loadout-layers.spec` (the TB bench test moves to the Detail card);
- the e2e fixture's helpers.

---

## 7. Copy owed (approved 2026-10-07, not yet applied)

The worksheet items Nate approved, which still apply because the vocabulary survives:

1. Capability chips render their labels **as written**: drop the global `.chip`
   `text-transform: capitalize` for them. One vocabulary across chips, fingerprint
   sentences and blocks.
2. "Heals"/"Shields" → **"Heal"/"Shield"**.
3. "Interruption Res" → **"Interruption res"** (glossary §2a).
4. "Not curated": one pattern stated twice (no capability data / capabilities complete,
   timing approximate); "Planner" → "Rotation Planner".
5. Card and Detail card: one wording per action ("In your team", "Team is full",
   "Remove from comparison" …).
6. Plurals and casing: "needs {n} stacks" (ICU), "vs Pyro-affected enemies".
7. Stack keys show their in-game name, never the key ("overchargedBall").
8. Screen-reader name "Source view" → "Team Builder views".

Then the **Help chapter** is rewritten for the new shape. Every new string follows
`docs/text/style-guide.md` and goes to Nate as a numbered Now → proposed list before it
lands.

---

## 8. Suggested build order (one branch each, `--no-ff`)

1. **Board model:** store, boards/tabs, link-as-view, the share codec, plus its tests.
2. **Team-aware conditions** (§5), plus the parity test. Everything visual depends on it.
3. **The split screen:** the three states and wipes; the Builder without bench or band-A
   rotation tabs; the bench leaving cleanly on a crossing; loadout in the Detail card.
4. **Team rows:** avatars, composition chips (incl. split reaction icons), the
   fingerprint. It waits on Nate's SVG set; build with placeholder glyphs and swap them
   in.
5. **Swap mode** in the roster pane: consequence groups, the ripple, Try in Planner (new
   tab), and the rotation read on linked teams.
6. **No repeats** marking, the leftover pool, battlefields with user-authored checks.
7. Copy (§7), Help, ledger notes, round record, CLAUDE.md line, memory.
8. ⏭ Separately: curated Stygian seasons (data plus portraits).

Gates per round: vitest · check · lint · build. Full cross-engine e2e before each merge
(two "N passed" lines). ⚠️ The Chrome half can hang in worker teardown (playwright
#39753); it force-kills and continues, so read the counts, not the exit code.

---

## 9. Rulings of 2026-10-08 (the review before the build)

A review against the code found three errors in §4.2 and §5 and a dozen open questions.
⚓ Everything below is Nate's ruling or a call he accepted. Where this section and an
earlier one disagree, **this one wins**.

### 9.1 Corrections

- **§4.2 is fourteen, not fifteen, in `FUNCTION_FACETS`.** Its `dps` cluster is empty and
  `offFieldDamage` sits in no cluster. Step 4 adds the Damage cluster and ONE order
  constant for the fingerprint (the code's order and the table's differ; choose once).
- **§5 understated the core.** `teamDelta`, coverage and the finder run on the eager
  index's `CapabilitySummary`, which keeps only `conditional: boolean`. It drops the
  condition tree and merges sources of one kind, detail and target. Measured
  2026-10-08: **139 of 879 derived capabilities (34 characters) carry a team-resolvable
  leaf**; 103 depend only on the team, 36 also on a runtime leaf.
  ⚓ **The index carries a compact team-condition residue** for those entries, so swap
  mode can check about 120 candidates without loading payloads or the parser.

### 9.2 ⚓ A condition is lit if the team can make it happen

**Outlined means "can't happen in this team", never "unlikely".** Players go out of their
way to make difficult teams work, so we assume they can.

- **Always lit:** the character's own kit and the fight: `state`, `stacks`,
  `chainStage`, own HP, recipient HP, enemy HP.
- **Lit if the team has the ingredient:** `enemyAffectedBy` X needs an X applier; a
  reaction needs both of its elements somewhere in the team (a two-element character
  counts); Lunar and Stellar reactions need their enabler; `inPolestarField` needs the
  reaction that spawns it; a heal-triggered condition, if one is ever authored, needs a
  healer.
- **Receiver-scoped leaves** (`weaponType`: Bennett C6, Candace's burst;
  `activeCharFaction`: Nicole, Linnea): ⚓ no on-field questions. Lit if ANY teammate,
  the provider included, qualifies.
- A lit icon that is only POSSIBLE still names its dependency in its sentence
  ("needs Swirl"), or lit reads as guaranteed.
- A card in the Roster, with no team around it, never shows outlined.

### 9.3 ⚓ Tabs: a limit of 12, and Recently closed (step 1)

- `TAB_LIMIT` 6 → **12**. Only the active tab is parsed; the constraint is display.
- **Every closed tab goes to "Recently closed"** (the stash), shown above the saved
  rotations. It keeps the last 20, oldest dropped. Promoting one is the existing Save.
  It skips a tab whose notation is empty, and a saved tab with no changes.
- Tabs record **when they were last viewed**.
- **At the limit, a confirm names the tab that will close**: the least recently viewed
  UNLINKED tab, pre-selected. The user may pick another. Linked tabs are listed but
  disabled (closing one would silently unlink a board team). If every tab is linked,
  it refuses and says why.
  ⚠️ If an incoming shared link is cancelled at that prompt, its rotation goes to
  Recently closed, so the link is never lost.
- **Saved rotations sort by last opened** (newest of saved and opened). The list already
  sorts by recency (`savedAt`, `SavedNotationsOverlay`), so this changes which recency.
  A rename still does not reorder.
- **The tab strip becomes a dropdown ONLY where it does not fit** (⚓ Nate 2026-10-08),
  in the shape of the Visualizers' instrument picker (`BandMenu`). Measured overflow,
  never a container query.

### 9.4 Share links carry teams, not rotations

- A board's share carries its teams, their constellations (§9.5) and the battlefield.
  **Teams arrive unlinked.**
- ⏭ Embedding the linked rotations is DEFERRED: it opens up to three tabs on arrival
  (§9.3) and puts up to three 16 KiB notations in a URL. The codec is versioned from
  day one, so adding it later is a version bump, not a break.

### 9.5 ⚓ Constellations: one model for the Planner and the Builder

- A team's constellation for a character is **its own value if set, otherwise the
  roster's** (Layer 2 over Layer 1, exactly as Planner tabs already work).
- Your own boards hold no values until you set some, so they follow the roster LIVE.
- **A shared board or rotation arrives with every value filled in**, so it never falls
  back: their C0 stays C0 even if you own C6. ⏭ Verify that `?r=` fills them all in
  today; if not, fix it in the same step.
- A linked team reads its tab's values.
- **Subtle marks:** a constellation ABOVE the one you own (never below), and a
  character you do not own. They appear only once the roster has something in it
  (otherwise everyone reads as unowned). One Settings switch hides both.
  ⏭ The Planner's bench gets the same marks (§9.5 unifies the two tools).
- **"Use my constellations"** (working name; copy list) in both tools. It sets
  **constellations only, never loadouts** (a loadout belongs to its team and rotation),
  in both directions, for characters you own. A character you do not own keeps the
  team's value. It is shown only when it would change something, under the same
  roster-has-content condition, and it is undoable.

### 9.5a Marks and portraits (step 4)

- **Not owned:** the avatar's element ring is DULLED (mixed toward muted ink), echoing
  the roster's faded cards. **Owned below the shown constellation:** a 2px ring drawn
  INSIDE the pip (it does not grow); its hover says "You own C2". Both read ONE role
  token. ⚓ Ink, not gold (gold already means "chosen" and "wishlist"); no side-by-side
  demo. ⚠️ Nate expects the ink ring may vanish on the already-dark pip; judge on
  screen. ⏭ Nate may drop the element tint from avatar frames altogether (the game
  does not tint them, and the element icon beside the name carries it); start with the
  dulled element ring.
- **The overhanging portrait** (the Stygian screen): the side icons
  (`static/assets/characters/side/`, 147, 128×128 with alpha) are ALREADY trimmed to
  the circle at the bottom, so ⛔ no mask. Hair and ornaments rise over the ring; the
  ring sits behind the portrait. ⚓ Drawn at **64px**, so 2× screens get the source
  pixel for pixel. If the circle's alignment is hard to find, Nate measures it in
  Affinity. The Builder first; ⏭ the Planner's bench is converted afterwards (Nate's
  call if 64px does not fit it), and ⚠️ Safari needs Nate's eyes.

- ↻ ⚓ **Superseded 2026-10-08 (Nate, on /lab; `6a563f2a` + `3c28a239`):** the ring is
  PLAIN (`--line-strong`, no element tint, no decorative dot) and the portrait is never
  dulled. Ownership is ONE **constellation chip** at the disc's lower right: filled "C2"
  when your account covers the team's level, HOLLOW when it asks for more; not owned is
  the bottom of that scale (hollow "C0"), the hover says which; C0 owned shows nothing.
  This replaces the dulled element ring AND the ring inside the pip. The portrait is
  `SidePortrait` (`.ctx-dark`, opaque on every ground); its geometry is Nate's values in
  `$lib/sidePortrait.ts` (art 90px on a 64px disc).

### 9.6 Defaults taken without objection

- Roster-full-width (§2.4 state 1) means the active board is EMPTY.
- An **archetype change** is exactly a change in the team's reaction set. **Trades** means
  capabilities changed but reactions did not. **Keeps everything** means no change after
  the ripple.
- The wipe gets a named constant; the value is a placeholder for Nate to tune.
- Filling an empty slot in a linked team appends a bare-name segment. A linked team's
  slots follow notation order, so it cannot have a gap.

### 9.6a ⚓ Boards copy the rotation tabs completely

Open board tabs, a saved list with Save/Load, and Recently closed. Step 1 builds the tab
machinery (limit, last viewed, Recently closed, the confirm) ONCE, shared by both.

### 9.7 Still open (decide when the step reaches them)

- Arriving from the Planner when no board links that tab: add a team to the current
  board, or make a new board?
- Board kinds: is "No repeats on by default" a preset chosen at creation (Stygian ×3,
  Abyss ×2, custom)?
- The inbound `?team=` link (probably: a team on the active board).
- User-facing names: board / lineup / battlefield / fingerprint (glossary).
- §2.5 candidate group order and within-group order; §2.6 curated seasons.

---

## 10. The library, and links that are DERIVED (2026-10-08, later)

⚓ Nate's rulings from the same day's design session. **This section wins over §2.3,
§2.5's linked-swap note, §9.3's locked tabs and §9.6a's link-keeping where they
disagree.**

### 10.1 ⚓ The notation is the save concept; the library presents it as TEAMS

- **A team is a notation with no actions** ("Bennett > Xiangling > Xingqiu > Sucrose").
  A rotation is the same thing with actions written in. Both live in ONE store, the
  existing saved rotations (`savedNotations`). Nothing about who is on a team is stored
  anywhere but the notation.
- **The library groups entries by their SET of characters**: the team is the heading,
  its rotations are the entries under it. ⚓ Order is ignored, and a short team is its
  own heading ("Bennett, Xiangling" = "Bennett, Xiangling, blank, blank"; it is NOT
  filed under every four-character team containing them). The key is the first four
  distinct names, as `slotsFromNotation` reads them.
- Grouping is a VIEW, so every rotation already saved appears grouped on day one, with
  no migration. Swap a character in a saved rotation and, once saved, it moves to the
  other heading: the library cannot disagree with the text.
- A team saved with no rotation is an entry whose notation is only names ("No rotation
  yet").
- ⚓ **A team is a REAL entry, never drawn as a rotation** (Nate 2026-10-08, step 4
  design): the names-only notation IS the heading. It outlives its rotations (delete
  the last one and the team stays), and **saving a rotation creates its team entry
  ON SAVE** if absent (and on an overwrite that changes the team), so "every rotation
  has a team" is enforced at the one place entries are written. Deleting a team that
  still has rotations is a two-stage confirm naming the count; an empty team deletes
  in one click (↻ §10.1a: one confirm either way). ⚓ **The Builder never files a team on its own**: "Save team" copies
  a set into the library one way, and deleting that team later leaves boards alone
  (a pin to a deleted rotation drops, §10.2). ⚓ The team entry's NAME is its
  nickname, which retires the separate nickname store below.
- **Team nicknames** (⚓): optional, stored per character set in a small store of their
  own. A label beside the set, never a second copy of the team. Without one, the
  heading is the portraits plus the composition chips (§3). If a rotation's team
  changes, it moves to a heading without that nickname.
- ⚓ **Craft it lovingly** (Nate): the library is what can make both tools pleasing to
  use. It is an OVERLAY first (opened by Load in either tool), built so it can move to
  its own page (`/library`) later.
- Its sections: **Teams** (headings, rotations under them), **Boards** (each as mini
  team rows), **Recently closed** (rotations and boards). Sorted by last touched (a
  heading by its newest entry), with a character filter and the subtle owned marks.

### 10.1a ⚓ The library's shape (Nate, 2026-10-08, from the `/lab/library` demos)

- **The Shelf layout**: teams (headings with their rotations nested) in the main
  column; **Recently closed tops the side column, collapsed to three**, Boards below it.
  Index+detail and Gallery were tried and dropped. One column on a phone.
- ⚓ **The strip is the button.** A rotation row and a team heading are each ONE click
  target meaning "use this HERE". From the Planner: a rotation opens in a new tab, a
  heading opens a names-only tab. From the Builder: both put the team on the board (a
  rotation PINNED), on the selected team if one is selected, else as a new team. As its
  own page: each goes to its document's HOME (rotations → the Planner, boards → the
  Builder). A hover hint at the row's end names the click; rename / duplicate / share /
  delete / nickname / the other tool live in ⋯; **Sync stays visible** (a state, not an
  action). This retires the "pick mode" question: pick mode is simply the library
  opened from the Builder.
- **Sync is per ROTATION** (a team entry is names-only and has nothing to sync).
- **Delete is ONE confirm** for a rotation AND for a team with rotations; the rotations
  go to Recently closed. (Supersedes the two-stage confirm in §10.1.)
- ⚓ **Filtering is the search box** (the strip of every avatar was too clunky to find
  anyone in): typing suggests, Enter turns the top suggestion into a TAG inside the box,
  tags AND together, Backspace on an empty box removes the last, leftover text searches
  names. ⏭ The demo also lets a tag be an ELEMENT or a REACTION — Nate to judge.
- Headings: portraits at a 48px disc, composition chips, nickname, count, last touched,
  the boards that use the team. ⛔ No fingerprint in the library.

- ✅ **Built 2026-10-09** on `tb/library` (stacked on `tb/portraits`): `library.ts` (the
  pure model + tags), `library.svelte.ts` (the flows; the Builder registers a TARGET),
  `LibraryOverlay.svelte` (replaces `SavedNotationsOverlay`), board Save/Load in the
  Builder's band A, Sync (`SavedNotation.synced` / `RotationTab.synced`). Further
  rulings taken on the way (Nate, 2026-10-09): the library heading carries NO reaction
  chips (`CompositionChips reactions={false}`; reactions are found through search) ·
  Duplicate is not in the library (the Planner's Save as new forks) · saving an
  unlinked rotation the library already holds links to it ("Already saved as …") ·
  a nicknamed team names its new tab · Travelers are separate characters, and one
  "Traveler" tag matches them all · the Synced badge is library-only.

### 10.2 ⚓ Links are DERIVED, not stored

- **A board team is a set of characters plus an optional PINNED rotation id.** Its
  rotations are whatever the library holds for its set; "2 rotations" shows on its row
  and a click pins one. ⛔ No live view of a Planner tab, no locked tabs, no snapshot
  on a tab's close, no "remove from the rotation too?" question: the link targeted the
  wrong thing (tabs are scratch space).
- ⚓ **The Builder never rewrites a saved rotation.** Swapping on a board changes the
  board's team; the old rotation stays under the old heading. Carrying a rotation to the
  new character is explicit: **Try in Planner** opens a NEW tab with the swap made, kept
  by Save. (Reverses §2.3's "a swap renames in the notation".)
- If a pinned rotation is deleted, the team keeps its characters and the pin drops; if
  the pinned rotation's team no longer matches the board team, the pin drops too.
- **Open in Planner** opens the pinned rotation, else the bare names.
- **Filling a slot the Genshin way:** a team picker lists the library's team headings,
  and one choice fills the team. **Save team** on a board row files that set in the
  library as a team (a preset for next time).
- A board team's constellations (⚓): the pinned rotation's while pinned, its own
  otherwise. One source at a time.

### 10.3 ⚓ The Planner's bench

- **⇄ stays** (relabelled "Swap"): the Planner's way into swap mode, and the ONE place
  the Builder writes a notation, because the reader came from the rotation to change it.
  It is today's audition, kept as a board-less mode: the Planner's team on top,
  candidates for the slot, "Take slot N" renames in the tab and returns.
- ⛔ **✕ goes**, and is NOT moved into swap mode (⚓ Nate): removing a character means
  deleting their actions, which the text already does.
- ⏭ The buttons' final layout is decided when the 64px overhanging portrait reaches the
  bench (§9.5a).

### 10.4 ⚓ "Synced to my roster"

- **Sync** removes a document's own constellation for every character you OWN, so they
  follow the roster live; a character you do not own keeps its stored level and its
  not-owned mark.
- A saved rotation is pinned on save today (`documentBar.#densifiedSnapshot`), so a
  synced one carries a flag and saves WITHOUT pinning owned characters.
- The badge reads itself: set a level by hand and the document is no longer synced.
- In the library: a badge on synced documents, a clickable Sync on the others behind a
  confirm (working copy: "Your roster's constellations will replace this rotation's for
  every character you own, and it will keep following your roster from now on.").
  Shown only once the roster has content. Applies to rotations, teams and boards.
- This supersedes §9.5's one-shot "Use my constellations" button.

### 10.5 Presets and names (⚓)

- New boards come as **Stygian** (3 teams), **Abyss** (2) or **Custom** (1, add more).
  Nate sources each preset's boss names, portraits and team-building goals.
- New boards are named "Board N" unless something better turns up.
- Every new string from step 1 is approved for now and judged live later.

### 10.6 The build order, revised

1. ✅ Board model (adjusted to §10.2: a pin, not a tab link).
2. ✅ Team-aware conditions.
3. The split screen: three states and wipes, the Builder without bench or band-A
   rotation tabs, board tabs in band A, presets, the bench leaving cleanly.
4. **The library** (§10.1, §10.4): overlay, team headings, nicknames, sync.
5. Team rows (avatars at 64px overhanging, composition chips, fingerprint with
   placeholder glyphs, "N rotations", pin).
6. Swap mode (consequence groups, ripple, Try in Planner, the ⇄ path from the bench).
7. No-repeats marks, leftover pool, battlefields.
8. Copy, Help, ledger, record.

---

## 11. ⚓ The Party Setup shape (2026-10-10 — WINS over everything above)

Survey of the tool after steps 1–5 (screenshots at 1440×900 plus Nate's in-game
reference, `~/Code/critcalc-review/tb-party-setup-2026-10-10/`; the game's screen is
`stygian-party-setup-menacing.png`). Nate: "I'm already certain that this is the shape
the tool should take" — no lab demo.

### 11.1 Why (what the survey found)

1. The view switch (Roster | Roster + board) kept the ROSTER as the subject — the thing
   you build was the add-on, and full-width Roster was the old Builder kept alive.
2. The wipe JUMPS by construction: the board slides, but the roster's width changes in
   one step at the start, so ~127 cards reflow 9 → 5 columns. (On a phone both panes
   are full width, so the slide never reflows there.)
3. The Atlas role cards are the filter rail's Role section at poster size: ~300 of 900px
   in the split, one row of characters above the fold, "SURVIVABILIT" clipped, and
   "0 owned" ×4 on an empty roster.
4. The filter drawer overlays the board you are filtering FOR.
5. The card's hover "+ Team" bar covers the chips you were reading, and never says
   which team the pick goes to.
6. The detail modal covers the board at the moment you ask what someone brings to it;
   half of it is roster/loadout settings.
7. "Roster" meant four things (the view, the "My roster" lens, All/Owned/Wishlist,
   "Edit roster…").
8. Compare/Audition is still live (the Planner's ⇄ lands in it) and much of
   `+page.svelte`'s 2,358 lines is its residue (plus the retired working-team coverage:
   `members`, `coverageCapOf`, `rt.tabCon`).

### 11.2 ⚓ Rulings

- ⚓ **The board is ALWAYS docked on wide screens, on the RIGHT** (where Genshin's
  endgames always put it), at a FIXED width. **The roster is the only thing that shrinks
  and grows**, so the board's layout can be made stable and polished. No view switch and
  no wipe at `toolMin`+. Phone keeps two tabs (proposed names **Characters | Lineup**)
  and its slide.
- ⚓ **The default board is the CURRENT Stygian Onslaught** — for a first visit and
  whenever the tool has no open tabs (all closed, storage cleared). Show the tool at its
  greatest usefulness, as sample rotations will for the Planner; Stygian is the mode most
  players want this for. Its empty board is the cold start (replaces "Build a team").
- ⚓ **The blank "?" portrait IS the empty slot** — exactly how Stygian draws one
  (Claude's suggestion of a ring with + was withdrawn).
- ⚓ **The whole card picks; a corner MAGNIFIER opens details** (the boss disc's grammar).
  The hover "+ Team" bar retires.
- ⚓ **Slot frames after the game's** (see the reference image): a coloured corner tab at
  the card's TOP RIGHT carrying the slot number (1–4), a heavy bar along the BOTTOM in
  the same colour, thin sides. ⚓ **Our own colours** — the game backs portraits gold/purple
  by rarity, ours are element-shaded, so its green/blue don't carry over. Whole-pixel
  borders only (Chrome floors fractional widths).
- ⚓ **Roster curation LEAVES the Builder.** Nate: the only reason to keep a full-width
  character grid was to curate your owned list, and that deserves its own surface in a
  place that makes sense for it: **Roster becomes a second tab of the Library.** It is
  optimised for quick entry: owned, constellation, a NEW "level 70+" flag (for a future
  Imaginarium Theater lineup feature), and loadout. The Builder no longer serves mainly
  the Planner, so **the Builder's character details carry no loadout settings**.
  - The Builder still READS the roster (the Owned filter, the constellation lens, the
    con chip on portraits); only EDITING leaves. Details show a read-only "Owned · C2"
    with a way to the Roster tab. Edit-roster mode retires (which also ends its clash
    with whole-card picking).
  - ⚠ `DetailCard` is shared with the Planner, and the Planner edits per-rotation
    loadout through `LoadoutPanel`: the Roster tab holds the DEFAULT build, the Planner
    keeps its per-rotation override, only the Builder's details drop the section.
- ✅ Agreed (Claude's proposal, Nate: "completely agree with all your ideas"):
  - **Filters live IN the roster column as a bar** — search, the four roles as an icon
    row, the elements; weapon/rarity/region/factions in a "More" popover anchored in
    the roster column, ⛔ never over the board. The Atlas role cards retire. (The game
    puts its filter button inside the roster column too.)
  - **The fingerprint is the filter vocabulary**: the 15 glyphs are the "Can provide"
    filter; clicking a FAINT glyph on a team filters the roster to who would provide it.
  - **Hovering a card previews it in the selected team's fingerprint** (which glyphs
    would light) — the old fact cell, on demand; still presence only.
  - **A destination strip above the grid**: "Adding to Battlefield 2 · 3/4".
  - **Details become a panel inside the roster column** (the board stays visible, so the
    preview stays readable), capabilities with provenance first; full screen + Back on
    a phone.
  - **Swap mode lives in the grid**: clicking a filled portrait (today it only selects its
    row) puts that slot in swap mode — the roster regroups keeps / trades / archetype
    change (§2.5). The Planner's ⇄ arrives in that state. Then Compare + Audition retire
    with a sweep of their code.
  - **One meaning per word**: the grid = Characters · the board = Lineup on screen (code
    keeps `board`) · the ownership section = Owned · the lens = "My constellations" ·
    "Roster" = the Library tab only.

### 11.3 Read off the game's screen (reference for the build)

- ⚠️ **The frame colours look PER TEAM, not selected-vs-other** — in the reference,
  Battlefield 1's four (incl. the one under "Other Characters") are GREEN and Battlefield
  2's are BLUE, while the SELECTED row is Battlefield 3 (empty; grey frame, gold end
  bar). Nate described them as "green for the active lineup, blue for the non-selected" —
  check which before building (open item 3).
- The corner number is the SLOT within its team; the colour says which team.
- The grid is SECTIONED: "Exalted Ones" (the mode's featured characters) above "Other
  Characters" — a picked character keeps its place in its section.
- Every card shows its level ("Lv. 90"); the game's filter is a button at the roster
  column's bottom left; the board says "Drag to adjust the order"; "Preset Teams" (≈ our
  Library) and "Confirm Adjustment" sit under the board.
- The selected row: a grey frame with a heavy GOLD end bar — ours already matches.

### 11.4 Open decisions (⏭ Nate decides with Claude later)

1. **The Library's entry point** — today only band A's "Load" opens it, and nobody looks
   under Load to mark what they own. Rename the button "Library"? An entry in the site
   chrome? Build the standalone `/library` page now?
2. **Does Wishlist stay** in the new Roster tab?
3. **Frame colours**: per team (as the reference seems to show) or selected vs other
   teams? Which of OUR hues — avoid `--ui-positive` green (it means "met" on the checks)
   and hues that sit badly on element-shaded backs. If per team, the corner number stays
   the slot (the game's way) and Claude's "B2" proposal is moot.
4. **The Roster tab's design** — a fast data-entry surface (phone included); design it
   together before building. The level 70+ flag's shape (a per-character boolean beside
   ownership/constellation, localStorage, not in share links) and whether a card shows it.
5. **A sectioned grid like "Exalted Ones"** — e.g. characters who satisfy the selected
   battlefield's 👍 checks first?
6. **Between seasons** (the `season-dates.json` guard finds none current): proposed — the
   latest live season, never Custom.
7. **The docked board's width** (proposed 560–600px; measure with a full Stygian board).
8. **Phone tab names** (proposed Characters | Lineup) and the details panel's order after
   capabilities.
9. Left from the phone pass (fits, judged fine; polish only): 3–4 line uppercase boss
   names at 320; the Damage glyph wrapping at 320; the Abyss blessing under its banner.

### 11.5 The build order (replaces §10.6 steps 6–8)

1. **Party Setup layout** — docked board right at a fixed width, no switch/wipe wide,
   phone tabs, the filter bar + "More" popover, the Atlas cards retire, default board =
   current Stygian (⚠ e2e fixtures assume a Custom "Board 1" in places).
2. **Library Roster tab** — owned / constellation / 70+ / default loadout. ⚠ MUST land
   before step 3 removes the Builder's editing tools, or there is a stretch with no way to
   mark what you own. Can run alongside step 1.
3. **Cards + details** — whole-card pick + magnifier, slot frames + corner numbers, the
   destination strip, details as a roster-column panel (no loadout), edit-roster mode out.
4. **Fingerprint as filter** — glyph filters, faint-glyph → filter, hover preview. Works
   with the placeholder pips; does not wait on the art.
5. **Swap mode in the grid** + the Planner's ⇄ into it; Compare/Audition retire + the
   `+page.svelte` sweep.
6. **Copy, Help, glossary, ledger, record.**

Also pending: 🎨 Nate is drawing the glyphs (memory `project_tb_round_2026_10` holds his
concept list); ⚠️ data gaps for a later data pass — Chongyun has NO infuse effect;
Xingqiu's interruption resistance doesn't derive (`interruptionRes` = Gorou + Columbina
only; Noelle/Thoma absent too).

### 11.6 ⚓ Rulings of 2026-10-10 (later) — §11.4 decided

1. **Entry points.** Band A's Load becomes **Library**, with Lucide's `LibraryBig` (books on
   a shelf) in place of the folder. A **Roster** button joins the SITE CHROME beside the
   settings cog: the roster belongs to the account, not to the document band A edits, and
   the chrome reaches every tool, the Visualizers included. It opens the Library on its
   Roster tab, so there is still only one Roster screen; below `roomy` it folds into the
   compass. Its mark is Nate's hand-drawn **Aether silhouette**, traced from the game's
   Character button: that button is where a player sees what they own and unlocks
   constellations. ⛔ Not the game's Party Setup glyph, which names what the Team Builder
   now is. The word stays **Roster** (⛔ "Characters" is the grid's word).
2. **Only the Roster tab edits the roster.** The character details in BOTH tools become
   read-only ("Owned · C2") with a link that opens the Roster tab on that character. The
   Planner's note "can only be changed in the Team Builder" goes.
3. **Docking width is MEASURED in step 1**, at the width where the roster still holds
   enough columns, with the phone's Characters | Lineup tabs below it. The **compact card**
   (portrait + name, no chips; the deleted 2026-08-11 band) comes back only if the
   measurement shows it lowers that threshold.
4. **An untouched default Stygian board follows the season**: a board the user never
   edited moves to the newest live season. ⛔ An edited board never changes.
5. **The level 70+ flag is DEFERRED** and ships with the Imaginarium Theater feature
   (post-launch). ⛔ No field without a reader.
6. **Wishlist stays.**
7. **The Roster tab is designed together** before step 2 is built.
8. **Frame colours are PER TEAM** (re-reading the reference: Battlefield 1 green,
   Battlefield 2 blue, the selected Battlefield 3 empty). A placeholder hue per team,
   with a MATCHING-HUE EDGE on each Lineup row as the key, judged live (on element-washed
   backs). The corner number stays the slot.
   - ⚓ **Selecting vs swapping**: anything on an UNSELECTED row (its edge, empty space, a
     portrait) selects the row, nothing else. A FILLED portrait in the SELECTED row enters
     swap mode; Escape or a second click leaves it. A swap always takes a deliberate click
     on a row already shown as selected.
9. **Audition is a temporary casualty** of steps 1–4: it may break or read oddly until
   swap mode replaces it in step 5. Nobody else uses the site yet.
10. **No sectioned grid.** The game's "Exalted Ones" is a live, usage-driven buff list we
    will not show. Section only if a filtering need asks for it.
11. **Phone tabs: Characters | Lineup.** The details panel runs capabilities →
    owned/constellation (read-only) → coverage → kit, judged once the tool is played with.
12. **The empty roster gets a hint**: until the roster has content, the filter bar carries
    one quiet line pointing at the Roster, because the Owned filter and the "My
    constellations" lens do nothing without it.
13. **The battlefield header** (all 28 Stygian bosses measured in Chrome):
    - The whole heading, "Battlefield 1: …", is **Bitter bold 13px, mixed case**. The old
      Plex 12px caps with `--ls-widest` ran a median 509px and a longest 707px; Bitter 13px
      runs 372 / 508, so every English name fits on ONE line. EN names have no length cap
      (longest 69 characters; PT 82, RU 75).
    - **Colour: white, to be judged** (gold is the game's; the house rule makes a title
      not gold). It can switch back.
    - **"Open in Planner" moves to the rotation line** under the portraits (📌 pinned
      rotation ▾ · → Open in Planner). That line appears exactly when the team is full,
      which is when the button works, and the rotation is its subject.
    - **✕ is Custom-only.** It showed on Stygian/Abyss boards whenever `teams.length > 1`.
    - A Stygian header holds only the name; Abyss keeps "Opponents" per half.
14. `main` is NOT pushed until these changes are further along (⚓ Nate).
15. **Band B is CUT AT THE DOCK** (⚓ Nate, the same evening — the freed band "is a gift"),
    the Visualizers' per-tile shape: the band paints nothing, and its cells sit on the
    dock's own columns (`lib/dock.ts` holds `BOARD_W`/`DOCK_GAP` once for both rows).
    - The character cell holds search · All/Owned/Wishlist · More · the constellation lens
      (last). The cell is MEASURED and folds Show, then the lens, into More when it runs
      short (`FOLD_SHOW_W` / `FOLD_LENS_W`). The roles, elements and count stay on a strip
      over the grid.
    - The lineup cell's first resident is No repeats; more will settle there as we build.
    - Below the dock ONE cell shows, the open pane's, led by the **pane switch**:
      ⚓ ONE glass plate naming the pane it OPENS (Lucide `PanelRightOpen` "Lineup" /
      `PanelLeftOpen` "Characters"). The Bitter parchment tab plates are retired. Tapping
      an EMPTY slot on the Lineup also opens Characters.
16. **Refinements, the same evening (⚓ Nate):**
    - The character cell's order is **Show · search · More · lens**. The Show segment's
      buttons are the control height less the track's 2px, so its selected ring and
      hover sit inside the track.
    - The lineup cell is a **rail** that always spans its pane, the Planner's band B
      middle, with the controls at its END: **+ Add team** (Custom only) then
      **No repeats**. The board's own footer is gone.
    - The role and element strip is a glass context, so its plates hover as glass.
    - **The board's width steps at `broad` and `vast`: 580 / 720 / 800** (fixed within
      each range). From `broad` the board is ROOMY and its contents grow with it:
      portraits 64 (the side art's planned size, pixel for pixel on 2×), boss 104,
      fingerprint glyphs 20, chip type one rung up.
    - The heading is **14px** (back on the ladder); at 580 the longest few names wrap.
      More room between teams (1.75rem) and inside them.
17. **Step 2 built (2026-10-11, `tb/roster-tab`):** the demo, on the real stores.
    - **Where it lives:** `RosterTab.svelte` is the Library's second tab. The header shows
      the tabs and, on Roster, the totals; the totals share the Show filter through
      `rosterView.svelte.ts`.
    - **Opening it:** `library.openRoster(id?)` opens the tab, optionally arriving on one
      character, from any tool. From the Visualizers, a Teams pick goes on to the Planner
      (`#away`).
    - **The chrome's Roster button** sits beside the cog. It exists only while a tool is
      mounted (`registerRosterOpener`, since the Library is the tools layout's overlay).
      Below `roomy` it folds into the compass. ⏳ Placeholder disc glyph until Nate's
      Aether/Lumine silhouettes land (they will follow `travelerVariant`).
    - **Details are READ-ONLY** in both tools: "Owned · C2" plus an **Edit in Roster** link
      that arrives on that character, unlocked. The Builder keeps "Default build" (prop
      `defaultBuild`, was `conEditable`) until step 3.
    - **The Builder's empty-roster hint** sits under the filter strip and links to the
      Roster.
    - `ownership` and `constellations` gain `replaceAll` (undo, and bulk actions in one
      write). `roles.ts` moved to `$lib/capabilities/` (two readers now).
    - ⚠ **A details card must read its `id` BEFORE calling `onClose`**: props are live, and
      the host clears the one the card was opened with (the arrival silently got `null`).
    - **The phone form (same day, ⚓ Nate asked before the merge):** below `toolMin`
      the sidebar is a SHEET over the grid (a Filters button opens it, Done
      closes it, and the count moves into its head). Below `compact` the bulk
      actions fold into one ⋯, Filters keeps only its mark, the notice takes its
      own row, and tiles drop to an 88px minimum, so 320 holds three columns.
      With `hover: none` the key legend hides and the wishlist star always
      shows while editing (it was hover-only, so touch could not wishlist).
      With `pointer: coarse` the astroids' tap area grows vertically only
      (13×29), and undo is the net.
      Measured: the grid went 300 → 663px at 390, the controls fit one 30px
      row, and nothing overflows at 320–390.
