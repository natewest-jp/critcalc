# The stage: tidying before Reaction curves (2026-11-03)

**Status:** ✅ merged into `main` on 2026-11-03 (`polish/viz-stage-tidy`). Nate approved the labels,
ICD's head and Help's "The workspace" rewrite (§4, now in Help).

## 1. Why

The open items left by the first two stage rounds (`viz-stage-wish-2026-11-02.md`,
`viz-stage-artifact-2026-11-03.md`), settled by Nate before Reaction curves:

- Wish odds' crossing labels go to the drop line's foot, as Artifact odds has them.
- The phone-usability pass and the slot icons as SVGs are deferred (`docs/todo.md` § On hold).
- All the proposed copy is approved as written in; Nate will read it closely later.
- ⚓ The materials rule "one paper Readout card per instrument" is obsolete for instruments on the
  stage.
- ⚓ The Radiance counter popover's lead is "Or answer a few questions to predict it:" (Nate's
  wording). The last session had balanced the old sentence across two lines, splitting it at the
  comma; Nate didn't want the sentence split in the middle.

## 2. What changed

- **Wish odds' Half by and Unlucky tenth at the drop line's foot** (`WishInstrument.svelte`
  `crossings`, Artifact odds' placement): just above the axis, right of the line or left near the
  plot's right edge, and a label that would run into the one before steps up a row. The level dot
  labels move to the marker's other side when they'd land on one, as Artifact odds' do. Beside the
  dot, the label had to dodge the curve. Under the curve the space is always empty.
- **The Radiance lead** is Nate's sentence. The `.wi-balance` rule and the non-breaking space
  went with the old one: the new line fits on one line in the popover.
- **ICD's head** is "5 of 12" over "hits apply" (proposed in the type-kit round, §5). ICD's Readout
  is replaced when ICD reaches the stage, and its headline is chosen then.
- **`ui.md`**: paper is a readout card, which an instrument on the stage doesn't have. The design's
  ⏭ on it (§6) is settled.
- **The copy ledger** (`docs/text/ledger/notes/vz_wish.md`) has the new lead.

Driven on the production build at 1600 and 390: one level, C2 with the marker at 60 and 200, the
pair, the Radiance popover, ICD's head; no page errors. On a phone the two labels meet and
Unlucky tenth steps up a row, left of its line.

## 3. Copy approved

As written in: the workspace bars' (§5: How it works, the Defaults toast and title), the type
kit's (§7: the field's screen-reader name, Breakdown's chip group), the rail's (§5: the folded
lines' names, the "Enemy" kicker), Wish odds' (§5, §7), and Artifact odds' last line still
proposed ("Your first two valued stats on this piece, until you pick your own.", §13).

Not landed, because only their subject was written down, not their words: headlines for the
three Readouts without one (Reaction curves, Gauge, Breakdown) and new names for the Readout
kickers. The stage replaces those Readouts, and each instrument's headline is chosen at the start
of its round (⚓ design §6).

## 4. Help's "The workspace" (approved, landed)

The section (`src/lib/help/chapters/Visualizers.svelte` § The workspace) still describes the
overhaul's starting point: as many tiles as fit, Defaults in the ⋯, settings forgotten each
visit. All three changed (`viz-workspace-bars`, `viz-saved`). Approved by Nate and landed:

1. "The workspace shows one instrument at a time, picked from the menu at its top left.
   **Layout**, at the bar's right end, shows two or three side by side when the window is wide
   enough, or **Auto** for as many as fit. Picking an instrument already showing in another tile
   swaps the two, and **Reset layout** goes back to one instrument and the default lineup."
2. "Each instrument has **Defaults**, which puts its controls back to their defaults (with
   Undo), and **Copy link**, which copies a link that reopens the instrument exactly as it looks
   now (in the reader's first tile). Its **⋯** menu has **How it works**, which opens this page
   at the instrument's section, and **Report a problem**, for feedback about that instrument."
3. "Each instrument's settings are saved with your profile, and the layout with this browser, so
   both are as you left them next visit. A link you open shows the settings it carries, and
   those are what's kept from then on."
