# Worksheet — Gauge Explorer

> ✅ **CLOSED + APPLIED 2026-10-02** (the Gauge Explorer pass, `docs/rounds/gauge-explorer-pass-2026-10-02.md`).
> ⛔ SUPERSEDED — the rulings a translator needs now live in
> `docs/text/ledger/notes/vz_gauge.md`, keyed to the generated inventory. Kept for history;
> ⚠️ the Applications panel it describes is gone (its controls moved to a toolbar over the
> chart), and so are several of its strings.

⚠️ **Read `visualizers-instruments-00-conventions.md` first** — §A casing, §C colons.

**Strings:** 19 · `GaugeInstrument.svelte`

⚓ **This instrument shares a grammar with the planner's aura lane** (one application
marker read top to bottom: what it caused → what landed → a hairline into the gauge). Its
words should agree with the planner's, and `rotation-planner.md` §1 and §8 are its
siblings.

---

## The application editor

| key                      | Where                          | Now                                            | New               |
| ------------------------ | ------------------------------ | ---------------------------------------------- | ----------------- |
| `vz.gauge.apps`          | Section heading                | Applications                                   |                   |
| `vz.gauge.element.aria`  | Per-application element picker | Element                                        | 🔒                |
| `vz.gauge.units.aria`    | Per-application gauge field    | Gauge units                                    |                   |
| `vz.gauge.earlier.aria`  | ← nudge                        | Move earlier                                   |                   |
| `vz.gauge.earlier.title` | Its tooltip                    | Move earlier — hold Shift for 1s               |                   |
| `vz.gauge.later.aria`    | → nudge                        | Move later                                     |                   |
| `vz.gauge.later.title`   | Its tooltip                    | Move later — hold Shift for 1s                 |                   |
| `vz.gauge.remove.aria`   | ✕                              | Remove this application                        |                   |
| `vz.gauge.add`           | Button                         | + Add application                              | Add application   |
| `vz.gauge.empty`         | Empty state                    | No applications — add one to start a sequence. |                   |
| `vz.gauge.scenarios`     | Section heading                | Example Scenarios                              | Example scenarios |
| `vz.gauge.log`           | Section heading                | Event log                                      | Aura log          |

🐛 **"+ Add application" carries a literal `+` in the string.** Every other button on the
site uses a `<Mark>` for its glyph — and a `+` in a message is a character a translator
may reasonably move, drop or replace. ⛔ Take it out of the message.
⚠️ **"Event log" is sentence case while every other heading here is Title Case** (§A) —
↻ §A applied (`Example scenarios`), so the casing half is settled. What remains is that it names the same object the planner calls the **aura log**. ⚓ Two names for the same kind of panel, in two tools that share its component. Worth one name.
⚠️ **"Shift" is a 🔒 frozen key name.** ⚠️ Both nudge tooltips are otherwise identical
apart from the direction — good.

## Readout

| key                     | Now                                                                                            | New                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `vz.gauge.readout`      | Readout                                                                                        | ✅ §E                                                                               |
| `vz.gauge.readout.at`   | at {time}                                                                                      |                                                                                     |
| `vz.gauge.readout.none` | No aura — the next element applies fresh.                                                      |                                                                                     |
| `vz.gauge.readout.hint` | Press play — or drag the paused playhead — to read the enemy's aura state at a moment in time. | Press play or drag the playhead to read the enemy's aura state at a moment in time. |
| `vz.gauge.chart.aria`   | Elemental gauge decay timeline                                                                 |                                                                                     |

⚓ **"No aura — the next element applies fresh" is a real teaching sentence**, not an empty
state: the gap _is_ the information, and it says what the gap means. ⛔ Don't reduce it to
"No aura."
⚠️ **The hint has two em dashes wrapping an aside** (style guide §3.4) — it reads well and
is exactly the construction a CJK translator has to restructure. High-value candidate for
simplifying _because_ it is the instrument's first-run instruction.
⚠️ "playhead" is ours and appears only here and in the help chapter. It is the right word;
it needs a context note.

---

## Added 2026-09-27 — missed by the first extraction

☑ **Read by Nate 2026-09-27** ⚠️ Until this box is ticked, a blank `New:` in this section is **not**
an approval. These rows come from a parser-based re-run; the first pass skipped strings
inside script object literals and some attributes. Keys are left to the extraction pass.

### Controls and hints

| Where                         | Context                                  | Now                                                                                                                                                                                           | New                                                                                                                                                                       |
| ----------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GaugeInstrument.svelte:817`  | Play button, aria (playing)              | Pause playback                                                                                                                                                                                | Pause                                                                                                                                                                     |
| `GaugeInstrument.svelte:817`  | Play button, aria (paused)               | Play the timeline                                                                                                                                                                             | Play                                                                                                                                                                      |
| `GaugeInstrument.svelte:967`  | A marker on the chart, aria              | {element} {n}U at {n} seconds                                                                                                                                                                 |                                                                                                                                                                           |
| `GaugeInstrument.svelte:1128` | Note under the Applications heading      | Drag a marker along the top of the chart to move it in time, or click the empty strip to add one. U = gauge units, the invisible strength of an elemental application — **most hits are 1U**. | Click or drag along the top of the chart to add or move an application marker. U = gauge units, the invisible strength of an elemental application. **Most hits are 1U**. |
| `GaugeInstrument.svelte:1239` | Scenario note when no scenario is picked | Custom sequence — edit applications or pick a scenario.                                                                                                                                       |                                                                                                                                                                           |
| `GaugeInstrument.svelte:1287` | Event log, empty                         | Nothing lands on the target.                                                                                                                                                                  |                                                                                                                                                                           |

⚠️ **The marker aria is ASSEMBLED** and its `{element}` is the raw id (`pyro`), lowercase
and untranslated. 🐛 It should be the element's display name.
⚠️ **"Play the timeline" / "Pause playback"** don't mirror each other — "Play" / "Pause"
is enough for a toggle whose state `aria-pressed` already reports.

### The twelve scenarios

The scenario chips and the note shown under them when one is picked.
`GaugeInstrument.svelte:104–213`

| Scenario (chip)    | New chip                    | Note (Now)                                                                                                                                                                                                                                                              | New note                                                                                                                                                                                                                                                              |
| ------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single Aura        | Single aura                 | 1U Pyro — the size of most hits in the game — lands as 0.8U after the ×0.8 aura tax, then decays out over 2.5 × 1 + 7 = 9.5s.                                                                                                                                           | 1U application — the size of most hits in the game — lands as 0.8U after the ×0.8 aura tax, then decays out over 2.5 × 1 + 7 = **9.5s**.                                                                                                                              |
| Top-Up             | Top-up                      | Re-applying the same element tops the gauge up but keeps the **first** application's decay rate — 2U onto a 1U aura refills it and still drains at the slow 1U rate.                                                                                                    | Re-applying the same element (except Pyro, as of version 3.0) tops the gauge up but keeps the **first** application's decay rate. 2U onto a 1U aura refills it and still drains at the slow 1U rate.                                                                  |
| Vaporize 🔒        |                             | Hydro on Pyro is the strong direction: the trigger takes 2× its own gauge. A single 1U Hydro hit clears a 2U Pyro aura outright — which is why one vape usually leaves nothing behind.                                                                                  | Hydro on Pyro is the strong direction: the trigger removes twice its own gauge. A single 1U Hydro hit clears a 2U Pyro aura outright — which is why one Vaporize usually leaves nothing behind.                                                                       |
| Reverse Melt       | 🔒 (Melt keeps its capital) | Cryo on Pyro is the weak direction: the trigger removes only **half** its own gauge, so each 1U hit nibbles 0.5U off a 2U aura instead of clearing it. (The ×1.5 on the chart is the **damage** multiplier — a different number from what the reaction costs the aura.) | Cryo on Pyro is the weak direction: the trigger removes only **half** its own gauge, so each 1U hit chips 0.5U off a 2U aura instead of clearing it. (The ×1.5 on the chart is the **damage** multiplier — a different number from what the reaction costs the aura.) |
| Swirl 🔒           |                             | Anemo consumes at ×0.5 and can never attach as an aura — it takes half a unit and leaves the rest behind.                                                                                                                                                               |                                                                                                                                                                                                                                                                       |
| Crystallize 🔒     |                             | Geo consumes at ×0.5 with a 1s reaction cooldown — the attempt inside the window is blocked and takes no gauge at all.                                                                                                                                                  |                                                                                                                                                                                                                                                                       |
| Electro-Charged 🔒 |                             | Hydro and Electro coexist, and each tick drains 0.4U from **both** gauges — so the **smaller** aura runs out first and the reaction stops with the bigger one still on the target. A 2U Hydro aura outlives a 1U Electro one.                                           | Hydro and Electro coexist, and each tick drains 0.4U from **both** gauges. The smaller aura runs out first, which ends the reaction and leaves the larger one on the target. A 2U Hydro aura outlives a 1U Electro one.                                               |
| Freeze             | Frozen 🔒                   | Frozen forms at 2 × min(aura, trigger) and decays on its own accelerating clock; the leftover Hydro keeps ticking down underneath it.                                                                                                                                   | Frozen forms at 2 × min(aura, trigger) and decays on its own accelerating clock. Any leftover Hydro keeps ticking down underneath it.                                                                                                                                 |
| Quicken 🔒         |                             | Quicken forms 1:1 and lives 5 × gauge + 6s. Aggravate hits on it consume nothing — but the same hit can re-Quicken off leftover Dendro. Nahida applies 1.5U, which is what separates the Quicken line from the Dendro one underneath it.                                | Quicken forms 1:1 and lives 5 × gauge + 6s. Aggravate hits on it consume nothing — but the same hit can re-Quicken off leftover Dendro. This example uses a starting 1.5U of Dendro — the strength of Nahida's Tri-Karma Purification hits.                           |
| Bloom 🔒           |                             | Hydro is the weak side of Bloom (2:1) — a 1U Hydro trigger removes only 0.5U of Dendro and spawns a Dendro Core, leaving the rest of the aura behind.                                                                                                                   | Hydro on Dendro is the weak direction of Bloom: a 1U Hydro trigger removes only 0.5U of Dendro and spawns a Dendro Core, leaving the rest of the aura behind.                                                                                                         |
| Burning 🔒         |                             | Burning = a fixed 2U aura plus a hidden fuel gauge draining at 0.4 U/s, re-applying 1U Pyro to the target every 0.25s until the fuel runs dry. Feeding it more Dendro extends the burn.                                                                                 | Burning = a fixed 2U aura plus a hidden fuel gauge draining at 0.4U per second, re-applying 1U Pyro to the target every 0.25s until the fuel runs out. Feeding it more Dendro extends the burn.                                                                       |
| Overvape           |                             | One Pyro hit on an Electro-Charged target triggers Overload **and** Vaporize — leftover trigger gauge flows down the reaction priority list.                                                                                                                            | One Pyro hit on an Electro-Charged target reacts with the Electro first (Overloaded); whatever gauge it has left then reacts with the Hydro (Vaporize).                                                                                                               |

⚓ **These twelve notes are the instrument's teaching** — the most prose it carries, and
the one place it explains a mechanic rather than drawing it.
⚠️ **Title Case chips** (Single Aura, Top-Up, Reverse Melt) — §A says sentence case for
the ones that are ours. The reaction names are 🔒. "Overvape" and "Reverse Melt" are
community terms (🏷 label frozen?), worth a ruling. → N: Really good catches. First of all, let's make our labels sentence case (Single aura, Top-up). Reverse Melt stays the same, even though being sentence case, because I think Melt should be capitalized. And most of all, really good catch on Freeze - Frozen is the correct name - please also update any glossary ruling or other locations, if there are any - Frozen should be the locked standard. Another one found above is Overloaded - this is one I have a tendency to get wrong, and many people do use "Overload" - but Overloaded is the correct term and should also be locked.
⚠️ **Bold is used as emphasis in four notes and the Applications hint** (`**first**`, `**half**`, `**both**`,
`**smaller**`, `**damage**`, `**and**`) — the `Emphasis` component renders it. R4 bans
caps as emphasis, not bold, but a translator has to carry the markers across; the density
is worth a look. → N: Good call. Please take special care with my changes, because I did decide to unbold a few spots.
⚠️ **"vape"** is slang inside a sentence that otherwise says "Vaporize". → N: You're right, and might as well avoid the mental association with the other meaning of "vape."
⚠️ **Several notes carry formulas** (`2.5 × 1 + 7 = 9.5s`, `2 × min(aura, trigger)`,
`5 × gauge + 6s`, `0.4 U/s`) — 🔒 the math stays, and "0.4 U/s" is a RATE written with
`/`, which the day-2 ruling says takes "per".

### The event log's grammar

Every log line is **ASSEMBLED** from these parts (`GaugeInstrument.svelte:608–708`):

| Where   | Line shape (Now)                                                            | New                                                                                                                                                                                                          |
| ------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 636     | {Element} aura {n}U                                                         | {Element} ({n}U after tax)                                                                                                                                                                                   |
| 638     | {Element} aura {n}U · topped up, rate kept                                  | {Element} (topped up to {n}U, rate kept)                                                                                                                                                                     |
| 640     | {Element} aura {n}U · refreshed, new rate                                   | {Element} ({n}U after tax, refreshed, new rate)                                                                                                                                                              |
| 642     | {Element} · too weak to attach                                              | {Element} (too weak to attach)                                                                                                                                                                               |
| 645     | {Element} · never attaches _(Anemo, Geo)_                                   | {Element} (never attaches)                                                                                                                                                                                   |
| 646     | {Element} · fully reacted                                                   | {Element} (fully reacted)                                                                                                                                                                                    |
| 672     | Electro-Charged tick · −0.4U from both                                      | Electro-Charged tick (−0.4U from both)                                                                                                                                                                       |
| 673     | Electro-Charged ticks ×{n} · −0.4U from both                                | {n} Electro-Charged ticks (−0.4U from both each tick)                                                                                                                                                        |
| 687–694 | {Reaction} ({Element}) · −{n}U {Element}, … · −{n}U trigger                 | {Reaction}: −{n}U {Element}, … −{n}U {Element} trigger — e.g. "Vaporize: −2U Pyro, −1U Hydro trigger" · "Melt: −1.6U Cryo, −0.8U Frozen, −0.8U Pyro trigger" · "Swirl (Pyro): −0.5U Pyro, −1U Anemo trigger" |
| 692     | … · no gauge spent _(Aggravate, Spread)_                                    | {Reaction} (no gauge spent)                                                                                                                                                                                  |
| 693     | … · inside the 1s cooldown _(blocked Crystallize)_                          | Crystallize (blocked by its 1s cooldown)                                                                                                                                                                     |
| 695     | … · burning self-tick                                                       | ⛔ drop — unreachable (see note C3)                                                                                                                                                                          |
| 698     | {Element} gone                                                              |                                                                                                                                                                                                              |
| 703     | Burning ends · {Element}, {Element} swept                                   | Burning ends ({Aura} gone) — e.g. "Burning ends (Fuel gone)"                                                                                                                                                 |
| 708     | Dendro Core 🔒                                                              |                                                                                                                                                                                                              |
| 43,46   | Log reaction names: Overload · Freeze                                       | Overloaded · Frozen — ⚓ glossary §2                                                                                                                                                                         |
| 49,54   | Reaction names used in the log: Crystallize (blocked) · Bloom (via Quicken) | Crystallize (blocked) folds into 693 · Bloom (via Quicken) unchanged                                                                                                                                         |

⚓ **The log's voice was tightened on purpose (⚓ Nate, 2026-08-17: "a bit wordy")** — a
line says what CHANGED, not what the mechanic is called; the teaching lives in the
scenario notes. ⛔ Don't restore explanation here.
⚠️⚠️ **Assembled with `·` as the joint** — every part is a fragment, so a translator
cannot see a sentence. Probably fine for a transcript, but it needs one note for all of
them. → N: Changed to parentheses across the board - what do you think, is this better?
→ C: ✅ Yes — a parenthesis marks a qualifier; the `·` glued unrelated fragments. Only
rule: never two in a row (hence 693).
⚠️ `×{n}` is a count, not a multiplier — the same glyph as the damage multipliers
elsewhere. → N: Changed the shape of it - what do you think?
→ C: ✅ One shape is right, but it must carry BOTH numbers — what the aura lost and what
the trigger spent differ by the reaction's modifier (1U Hydro on Pyro: −2U Pyro, −1U
trigger), which is the Vaporize / Reverse Melt lesson. Resolved 2026-09-27 as in the table.

### → C: notes on the resolved log grammar (2026-09-27)

- **C1 — Top-up says "the same element", but Pyro is the exception.** Since 3.0 a Pyro
  re-application does NOT top up: a stronger one replaces the aura AND its decay rate
  (line 640), a weaker one does nothing (line 642). The scenario uses Electro, so the
  chart is right; the sentence over-generalizes. Suggest: "Re-applying the same element —
  any except Pyro — tops the gauge up…". ✅ Ruled (⚓ Nate 2026-09-27): "(except Pyro, as of
  version 3.0)" — enough for a curious reader to look it up.
- **C2 — "after tax" is true on 636 and 640 but not always on 638.** A top-up keeps the
  LARGER of the existing aura and the new taxed gauge (`attachAura`: `max(aura, taxed)`),
  so the number shown can be the old aura, untaxed by this hit. "topped up to {n}U" is
  true either way. ✅ Ruled (⚓ Nate 2026-09-27).
- **C3 — 695 never renders.** `gauge.ts` documents a reaction with no application behind
  it as unreachable today (nothing that reacts with Pyro can coexist with Burning).
- **Lines 640 and 642 are Pyro-only**, which is why no scenario shows them. To see them:
  640 — 1U Pyro at 0s, then 1U Pyro at 2s (the aura has decayed below 0.8U, so the new
  hit replaces it). 642 — 2U Pyro at 0s, then 1U Pyro at 1s (1.6U still standing beats a
  0.8U taxed hit).
- ⚠️ The numbers in these lines come from `fmtU`, which appends the `U` — so a "{n}U" in
  this table is one token in code.
