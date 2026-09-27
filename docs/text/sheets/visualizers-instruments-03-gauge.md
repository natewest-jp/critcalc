# Worksheet — Gauge Explorer

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
| `vz.gauge.add`           | Button                         | + Add application                              |                   |
| `vz.gauge.empty`         | Empty state                    | No applications — add one to start a sequence. |                   |
| `vz.gauge.scenarios`     | Section heading                | Example Scenarios                              | Example scenarios |
| `vz.gauge.log`           | Section heading                | Event log                                      |                   |

🐛 **"+ Add application" carries a literal `+` in the string.** Every other button on the
site uses a `<Mark>` for its glyph — and a `+` in a message is a character a translator
may reasonably move, drop or replace. ⛔ Take it out of the message.
⚠️ **"Event log" is sentence case while every other heading here is Title Case** (§A) —
↻ §A applied (`Example scenarios`), so the casing half is settled. What remains is that it names the same object the planner calls the **aura log**. ⚓ Two names for the same
kind of panel, in two tools that share its component. Worth one name.
⚠️ **"Shift" is a 🔒 frozen key name.** ⚠️ Both nudge tooltips are otherwise identical
apart from the direction — good.

## Readout

| key                     | Now                                                                                            | New   |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ----- |
| `vz.gauge.readout`      | Readout                                                                                        | ✅ §E |
| `vz.gauge.readout.at`   | at {time}                                                                                      |       |
| `vz.gauge.readout.none` | No aura — the next element applies fresh.                                                      |       |
| `vz.gauge.readout.hint` | Press play — or drag the paused playhead — to read the enemy's aura state at a moment in time. |       |
| `vz.gauge.chart.aria`   | Elemental gauge decay timeline                                                                 |       |

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

☐ **Not yet read.** ⚠️ Until this box is ticked, a blank `New:` in this section is **not**
an approval. These rows come from a parser-based re-run; the first pass skipped strings
inside script object literals and some attributes. Keys are left to the extraction pass.

### Controls and hints

| Where                         | Context                                  | Now                                                                                                                                                                                           | New |
| ----------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `GaugeInstrument.svelte:817`  | Play button, aria (playing)              | Pause playback                                                                                                                                                                                |     |
| `GaugeInstrument.svelte:817`  | Play button, aria (paused)               | Play the timeline                                                                                                                                                                             |     |
| `GaugeInstrument.svelte:967`  | A marker on the chart, aria              | {element} {n}U at {n} seconds                                                                                                                                                                 |     |
| `GaugeInstrument.svelte:1128` | Note under the Applications heading      | Drag a marker along the top of the chart to move it in time, or click the empty strip to add one. U = gauge units, the invisible strength of an elemental application — **most hits are 1U**. |     |
| `GaugeInstrument.svelte:1239` | Scenario note when no scenario is picked | Custom sequence — edit applications or pick a scenario.                                                                                                                                       |     |
| `GaugeInstrument.svelte:1287` | Event log, empty                         | Nothing lands on the target.                                                                                                                                                                  |     |

⚠️ **The marker aria is ASSEMBLED** and its `{element}` is the raw id (`pyro`), lowercase
and untranslated. 🐛 It should be the element's display name.
⚠️ **"Play the timeline" / "Pause playback"** don't mirror each other — "Play" / "Pause"
is enough for a toggle whose state `aria-pressed` already reports.

### The twelve scenarios

The scenario chips and the note shown under them when one is picked.
`GaugeInstrument.svelte:104–213`

| Scenario (chip)    | Note                                                                                                                                                                                                                                                                    | New |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| Single Aura        | 1U Pyro — the size of most hits in the game — lands as 0.8U after the ×0.8 aura tax, then decays out over 2.5 × 1 + 7 = 9.5s.                                                                                                                                           |     |
| Top-Up             | Re-applying the same element tops the gauge up but keeps the **first** application's decay rate — 2U onto a 1U aura refills it and still drains at the slow 1U rate.                                                                                                    |     |
| Vaporize 🔒        | Hydro on Pyro is the strong direction: the trigger takes 2× its own gauge. A single 1U Hydro hit clears a 2U Pyro aura outright — which is why one vape usually leaves nothing behind.                                                                                  |     |
| Reverse Melt       | Cryo on Pyro is the weak direction: the trigger removes only **half** its own gauge, so each 1U hit nibbles 0.5U off a 2U aura instead of clearing it. (The ×1.5 on the chart is the **damage** multiplier — a different number from what the reaction costs the aura.) |     |
| Swirl 🔒           | Anemo consumes at ×0.5 and can never attach as an aura — it takes half a unit and leaves the rest behind.                                                                                                                                                               |     |
| Crystallize 🔒     | Geo consumes at ×0.5 with a 1s reaction cooldown — the attempt inside the window is blocked and takes no gauge at all.                                                                                                                                                  |     |
| Electro-Charged 🔒 | Hydro and Electro coexist, and each tick drains 0.4U from **both** gauges — so the **smaller** aura runs out first and the reaction stops with the bigger one still on the target. A 2U Hydro aura outlives a 1U Electro one.                                           |     |
| Freeze 🔒          | Frozen forms at 2 × min(aura, trigger) and decays on its own accelerating clock; the leftover Hydro keeps ticking down underneath it.                                                                                                                                   |     |
| Quicken 🔒         | Quicken forms 1:1 and lives 5 × gauge + 6s. Aggravate hits on it consume nothing — but the same hit can re-Quicken off leftover Dendro. Nahida applies 1.5U, which is what separates the Quicken line from the Dendro one underneath it.                                |     |
| Bloom 🔒           | Hydro is the weak side of Bloom (2:1) — a 1U Hydro trigger removes only 0.5U of Dendro and spawns a Dendro Core, leaving the rest of the aura behind.                                                                                                                   |     |
| Burning 🔒         | Burning = a fixed 2U aura plus a hidden fuel gauge draining at 0.4 U/s, re-applying 1U Pyro to the target every 0.25s until the fuel runs dry. Feeding it more Dendro extends the burn.                                                                                 |     |
| Overvape           | One Pyro hit on an Electro-Charged target triggers Overload **and** Vaporize — leftover trigger gauge flows down the reaction priority list.                                                                                                                            |     |

⚓ **These twelve notes are the instrument's teaching** — the most prose it carries, and
the one place it explains a mechanic rather than drawing it.
⚠️ **Title Case chips** (Single Aura, Top-Up, Reverse Melt) — §A says sentence case for
the ones that are ours. The reaction names are 🔒. "Overvape" and "Reverse Melt" are
community terms (🏷 label frozen?), worth a ruling.
⚠️ **Bold is used as emphasis in four notes and the Applications hint** (`**first**`, `**half**`, `**both**`,
`**smaller**`, `**damage**`, `**and**`) — the `Emphasis` component renders it. R4 bans
caps as emphasis, not bold, but a translator has to carry the markers across; the density
is worth a look.
⚠️ **"vape"** is slang inside a sentence that otherwise says "Vaporize".
⚠️ **Several notes carry formulas** (`2.5 × 1 + 7 = 9.5s`, `2 × min(aura, trigger)`,
`5 × gauge + 6s`, `0.4 U/s`) — 🔒 the math stays, and "0.4 U/s" is a RATE written with
`/`, which the day-2 ruling says takes "per".

### The event log's grammar

Every log line is **ASSEMBLED** from these parts (`GaugeInstrument.svelte:608–708`):

| Where   | Line shape                                                                  | New |
| ------- | --------------------------------------------------------------------------- | --- |
| 636     | {Element} aura {n}U                                                         |     |
| 638     | {Element} aura {n}U · topped up, rate kept                                  |     |
| 640     | {Element} aura {n}U · refreshed, new rate                                   |     |
| 642     | {Element} · too weak to attach                                              |     |
| 645     | {Element} · never attaches _(Anemo, Geo)_                                   |     |
| 646     | {Element} · fully reacted                                                   |     |
| 672     | Electro-Charged tick · −0.4U from both                                      |     |
| 673     | Electro-Charged ticks ×{n} · −0.4U from both                                |     |
| 687–694 | {Reaction} ({Element}) · −{n}U {Element}, … · −{n}U trigger                 |     |
| 692     | … · no gauge spent _(Aggravate, Spread)_                                    |     |
| 693     | … · inside the 1s cooldown _(blocked Crystallize)_                          |     |
| 695     | … · burning self-tick                                                       |     |
| 698     | {Element} gone                                                              |     |
| 703     | Burning ends · {Element}, {Element} swept                                   |     |
| 708     | Dendro Core 🔒                                                              |     |
| 49,54   | Reaction names used in the log: Crystallize (blocked) · Bloom (via Quicken) |     |

⚓ **The log's voice was tightened on purpose (⚓ Nate, 2026-08-17: "a bit wordy")** — a
line says what CHANGED, not what the mechanic is called; the teaching lives in the
scenario notes. ⛔ Don't restore explanation here.
⚠️⚠️ **Assembled with `·` as the joint** — every part is a fragment, so a translator
cannot see a sentence. Probably fine for a transcript, but it needs one note for all of
them.
⚠️ `×{n}` is a count, not a multiplier — the same glyph as the damage multipliers
elsewhere.
