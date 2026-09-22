# Worksheet — Gauge Explorer

⚠️ **Read `visualizers-instruments-00-conventions.md` first** — §A casing, §C colons.

**Strings:** 19 · `GaugeInstrument.svelte`

⚓ **This instrument shares a grammar with the planner's aura lane** (one application
marker read top to bottom: what it caused → what landed → a hairline into the gauge). Its
words should agree with the planner's, and `rotation-planner.md` §1 and §8 are its
siblings.

---

## The application editor

| key                      | Where                          | Now                                            | New |
| ------------------------ | ------------------------------ | ---------------------------------------------- | --- |
| `vz.gauge.apps`          | Section heading                | Applications                                   |     |
| `vz.gauge.element.aria`  | Per-application element picker | Element                                        | 🔒  |
| `vz.gauge.units.aria`    | Per-application gauge field    | Gauge units                                    |     |
| `vz.gauge.earlier.aria`  | ← nudge                        | Move earlier                                   |     |
| `vz.gauge.earlier.title` | Its tooltip                    | Move earlier — hold Shift for 1s               |     |
| `vz.gauge.later.aria`    | → nudge                        | Move later                                     |     |
| `vz.gauge.later.title`   | Its tooltip                    | Move later — hold Shift for 1s                 |     |
| `vz.gauge.remove.aria`   | ✕                              | Remove this application                        |     |
| `vz.gauge.add`           | Button                         | + Add application                              |     |
| `vz.gauge.empty`         | Empty state                    | No applications — add one to start a sequence. |     |
| `vz.gauge.scenarios`     | Section heading                | Example Scenarios                              |     |
| `vz.gauge.log`           | Section heading                | Event log                                      |     |

🐛 **"+ Add application" carries a literal `+` in the string.** Every other button on the
site uses a `<Mark>` for its glyph — and a `+` in a message is a character a translator
may reasonably move, drop or replace. ⛔ Take it out of the message.
⚠️ **"Event log" is sentence case while every other heading here is Title Case** (§A) —
and it names the same object the planner calls the **aura log**. ⚓ Two names for the same
kind of panel, in two tools that share its component. Worth one name.
⚠️ **"Shift" is a 🔒 frozen key name.** ⚠️ Both nudge tooltips are otherwise identical
apart from the direction — good.

## Readout

| key                     | Now                                                                                            | New |
| ----------------------- | ---------------------------------------------------------------------------------------------- | --- |
| `vz.gauge.readout`      | Readout                                                                                        | §E  |
| `vz.gauge.readout.at`   | at {time}                                                                                      |     |
| `vz.gauge.readout.none` | No aura — the next element applies fresh.                                                      |     |
| `vz.gauge.readout.hint` | Press play — or drag the paused playhead — to read the enemy's aura state at a moment in time. |     |
| `vz.gauge.chart.aria`   | Elemental gauge decay timeline                                                                 |     |

⚓ **"No aura — the next element applies fresh" is a real teaching sentence**, not an empty
state: the gap _is_ the information, and it says what the gap means. ⛔ Don't reduce it to
"No aura."
⚠️ **The hint has two em dashes wrapping an aside** (style guide §3.4) — it reads well and
is exactly the construction a CJK translator has to restructure. High-value candidate for
simplifying _because_ it is the instrument's first-run instruction.
⚠️ "playhead" is ours and appears only here and in the help chapter. It is the right word;
it needs a context note.
