# critcalc tool constitutions (written 2026-07-27, flagged stale 2026-09-22)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

# ⚠️⚠️ STALE — verify every claim before acting on it (flagged 2026-09-22)

⛔ **This document is partly FALSE.** It was written 2026-07-27 and its "will never"
lists have been overtaken by work that has since shipped. ⏭ **A rewrite is queued**
(`docs/rounds/launch-roadmap.md`); until it lands, the known-wrong parts are:

| Says                                                                                                                       | Actually                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| "Tool 1 — **Crit Visualizer**"                                                                                             | Now **Visualizers**: eight instruments, route renamed 2026-08-14                                  |
| "Tool 3 — Team Builder **_(planned)_ … not yet implemented**"                                                              | Feature-complete 2026-07-13 (`3742300`)                                                           |
| Planner "**will never simulate** complete aura/reaction simulation — no gauge units, no aura priority, no ICD bookkeeping" | ⛔ **All of it shipped** — gauge rounds L3–L6. `ctx.aura` is a real gauge; the aura lane draws it |
| "❌ Track aura gauge units, aura tax, decay → **not planner job**"                                                         | ⛔ Shipped. The ×0.8 aura tax, decay rates and dendro cores are all modeled                       |
| "Reaction triggers as windows, **not as math**"                                                                            | ⛔ The gauge does the math                                                                        |

⚓⚓ **The lesson, and it is why the rewrite is queued rather than optional** (⚓ Nate,
2026-09-22): **a "will never" list does not stay a boundary — it goes stale into being
false, and then keeps being read as true.** The same framing, in user-facing copy, is
what the text round retired (`docs/rounds/text-round.md`). ⛔ The rewrite should describe
**current scope** and ⛔ avoid "never" entirely.

⚠️ **What is still sound:** the _reasoning_ — the in-game DPS dummy comparison, the
"window vs calculation" question as a judgment aid, and the curation-implications
section. ⚓ Use those; ⛔ do not trust any specific "never" as a live constraint.

---

# critcalc Tool Constitutions

The strategic frame for what each tool _is_, _aspires to be_, and _will never become_. Use this when curation or implementation choices land in gray territory — "should this go in the planner?", "should the visualizer track X?", etc.

---

## Overarching Philosophy

**critcalc visualizes mechanics; it does not optimize numbers.**

The Genshin tooling space is dominated by _calculators_ — gcsim, Genshin Optimizer, KQMC. They take inputs, run math, return optimal answers. They try to find where a player's numbers are suboptimal and surface that gap.

critcalc's approach is the inverse: **make the mechanics visually obvious so the player optimizes themselves.** Show the choreography, the windows, the distributions — and trust the player to read them. This is a surprisingly unclaimed niche in the Genshin fansite ecosystem, and it's the unifying thread across all three tools.

**Implication for judgment calls:** when a feature could be _visualized_ or _calculated_, default to visualized. When data could expose a mechanic or hide it behind a number, expose the mechanic. The point is to build intuition, not deliver verdicts.

---

## Tool 1 — Crit Visualizer

**Status:** mostly complete; needs polish/refactor; future expansion possible.

### What it simulates

- The RNG distribution of damage outcomes given a crit rate / crit damage stat profile.
- Single-hit, stats-only — variance and expected value made visible.

### What it hopes to simulate (future, speculative)

- Other calculations that fit the **graph + slider** shape may become additional "modes" of the same tool. Specifics TBD; explore during refactor.
- The shape constraint is real: anything added must work as a graph driven by sliders. If it doesn't fit that interaction model, it doesn't belong here.

### What it will never simulate

- Damage calculation in any team-comp or rotation sense. No motion values, scaling, enemy res, buffs.
- Anything requiring rotation context, team context, or build context beyond crit stats.

### Mental model

An intuition tool for the cr/cd tradeoff. Not "is my build optimal" but "what does my build _feel like_ when it lands."

---

## Tool 2 — Rotation Planner _(flagship)_

**Status:** active development, primary focus. The flagship of critcalc — no comparable tool exists in the Genshin community, and this is what gives critcalc reason to exist.

### What it simulates

- **Timing and choreography** of a team rotation, frame-accurate.
- Ability animations (E/Q/N/CA/swap), cooldowns, charge regen, cast times.
- Buff _windows_ (when a buff is active) from character kits + artifact triggers.
- Stance state, NB lane, Moonsign lane, summon lifetimes.
- Notation parsed in (KQM-aligned), Gantt timeline rendered out.

### What it hopes to simulate

- Reaction _trigger windows_ as a rendering treatment (when Quicken/Bloom/etc. is live), not their gauge math.
- `onSwap` / `onHit` / `onReaction` / `onStack` buff triggers (Pass 2 of weapon/artifact effects).
- ResShred windows (Viridescent etc.) as a separate visual treatment.
- Constellation-aware ability panel display.

### What it will never simulate

- **Damage numbers.** No DPS readout, no per-hit damage, no totals.
- **Complete aura/reaction simulation.** No gauge units, no aura priority, no internal cooldown bookkeeping for reactions themselves.
- **Enemy state.** No stagger, no aura present/absent assumptions, no positioning.
- **Complete energy simulation.** Particle generation/funneling/ER feasibility is not the planner's job.

### Why those boundaries

Genshin recently launched a **UGC mode** where creators built a live, in-game DPS dummy — a controlled environment where players can test damage, auras, reactions, and energy directly against repeatable conditions. **The Rotation Planner is designed to complement this in-game tool, not duplicate it.** Damage, reactions, energy feasibility, enemy states — players should test those in-game with real character data and live feedback. Trying to recreate that in a web tool would be costly, RNG-fragile, and never as authoritative as the game itself.

What the in-game dummy _cannot_ do is let a player **see** the visual ordering of overlapping uptimes, swap windows, and buff overlaps across a 20–40 second rotation. That's practically impossible to hold in your head. **That is the one thing the planner does, and it does it better than anything else.**

### The line: "windows" vs. "calculation"

- ✅ Render _when_ a buff is active → window. Planner job.
- ❌ Multiply that buff's value into a damage number → calculation. Not planner job.
- ✅ Show _when_ a reaction triggers as a marker/window → visualization. Planner job.
- ❌ Track aura gauge units, aura tax, decay → simulation. Not planner job.
- ✅ Show energy cost/generation as visual annotation → reference. Probably OK.
- ❌ Compute end-of-rotation energy balance and feasibility → calculation. Not planner job.

When in doubt, ask: _is this a window, a marker, or a number?_ Windows and markers belong; numbers don't.

### Mental model

A **choreography editor**. The questions it answers are "is this rotation tight?", "do my buffs cover my big hits?", "does the swap order make sense?" — not "how much damage did it do."

---

## Tool 3 — Team Builder _(planned)_

**Status:** not yet implemented; will follow Rotation Planner. CharacterAbilityCardWide is the starting point.

### What it will simulate

- Side-by-side comparison of character kits.
- Reference surface for ability details, scalings, energy costs, archetype, key mechanics.
- Looking at characters _outside_ of a rotation context — when the user wants to study kits before placing them on a timeline.

### What it hopes to simulate

- Shape is TBD; general direction is settled (kit comparison, not opinion engine).

### What it will never simulate

- Team suggestions, character rankings, synergy scores, tier lists.
- Damage calculation (as with the other tools).
- Anything that returns a verdict rather than exposing information.

### Mental model

"I'm considering pairing X with Y — what do their kits actually look like side by side?" Dense kit reference, not a recommender.

---

## Curation Implications

When curating character data, weigh fields by which tool consumes them:

- **Timing data is sacred** (frames, cast times, hitlag, charge counts, cooldowns, durations). Every tool except the visualizer leans on it; the planner depends on it being frame-accurate. Never fake — `_todo` is correct when data is missing.
- **Buff _windows_ matter; buff _amounts_ matter less.** The planner renders when a buff is active, not how much damage it adds. Get the duration, trigger condition, and stat affected right; getting the exact `+22.5%` value is secondary (and often noted only for completeness or future Team Builder display).
- **Reaction triggers as windows, not as math.** If an effect says "for 8s after triggering Aggravate," curate the window and the trigger condition. Don't try to model whether Aggravate will actually proc — that's the player's problem to verify in-game.
- **Energy / particle data is reference-tier.** Worth recording for completeness and Team Builder display; not load-bearing for any planner mechanic.
- **Damage scaling tables are decorative.** Useful for the Team Builder's kit display; never feed into a calculation.
- **Effects too situational to model reliably get `_todo`** with a brief note. Aura-dependent procs, multi-conditional triggers, and effects that depend on enemy state are common candidates.

When a curation question feels ambiguous, return to: _what does the tool do with this field?_ If no tool will ever render it as a window, marker, or reference text, it doesn't need to be perfect — and possibly doesn't need to be there.

---

## Tool-Authoring Implications

When deciding whether a proposed feature belongs:

1. **Which tool is this for?** If it doesn't fit one of the three, it probably doesn't belong on critcalc.
2. **Is it visualization or calculation?** Default to visualization. Calculation features need a strong justification.
3. **Does the in-game DPS dummy already cover this?** If yes, and the feature would attempt to replicate it, reconsider.
4. **Does it return a verdict or expose a mechanic?** Verdicts (rankings, scores, "optimal" anything) are out of character for critcalc. Exposing mechanics is in character.
5. **For the Crit Visualizer specifically:** does it fit the graph+slider shape? If not, it's probably a different tool.
