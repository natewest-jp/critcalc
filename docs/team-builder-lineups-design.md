# Team Builder — lineups, the split screen, the fingerprint (design, 2026-10-07)

**Status:** ⚓ DESIGN AGREED with Nate, 2026-10-07. Not built. This record is the
starting point of the build session(s). Everything below marked ⚓ is Nate's ruling;
everything else is an agreed default.

**What came before (all merged to `main`, not pushed):**

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
