# 2026-11-13: the keyboard shortcuts sheet

The to-do's keyboard and gesture cheat sheet, picked at the check-in (⚓ Nate). Branch `feat/keys-cheat-sheet`.

## What was decided

- **A dialog over the tool, not a Help chapter** (Claude recommended, Nate picked): it can be glanced at without leaving the work. It lists the area you are in first (a Roster or Teams section, a Help chapter's tool, or the tool under the address), then Everywhere, then the rest.
- **Built as a quick demo first** (Nate's pick over a written proposal), with the wording held as a draft; Nate approved all 31 lines unchanged.
- **Three ways in:** the `?` key anywhere that isn't text (a field, the notation editor, another dialog), the top bar's `?` menu, and Help's sidebar. The sidebar entry hides on touch screens (Nate): no keyboard, nothing to show.
- **Gestures stay in each tool's Help chapter**, written as their own copy proposal (to-do).

## What the code showed

The to-do's key list predated the redesigns. Pill drags, a click on bare band to add, and ←/→ (Shift) nudges with Delete belong to the Gauge Explorer, not the Planner, so they are listed under Visualizers. A ruler click is a pointer action and stays off a keyboard sheet.

The list is `src/lib/keysSheet.svelte.ts`, each row naming its handler; a new shortcut needs a row there. Arrow keycaps are marks (`arrowUp`, `arrowDown` are new, with `keyboard`), since arrows are banned glyphs.

## Traps met

- The panel's `max-height: min(40rem, 100%)` never bit: the backdrop's grid row sizes to the content, so on a 390×844 phone the panel hung off the bottom (top at 314). It caps against `100dvh` now.

## Left open

- Nate's real-Safari and iPhone look.
- Phone gestures in the Help chapters (to-do).
- A What's new entry, proposed in the report.
