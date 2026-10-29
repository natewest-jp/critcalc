# Design principle: non-modal tool surfaces (2026-07-20)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**Principle (established with Nate 2026-07-20 during the Team Builder reevaluation):** reserve modal dialogs for **meta** surfaces — settings, help, static/about pages. Every **tool feature** should be **non-modal**: a docked side panel, or an in-frame overlay that respects the tool's own layout grammar rather than a full-screen `position:fixed; inset:0` backdrop that covers everything. Not a strict law — a target across all three tools.

**Why:** modals break the tool's spatial grammar and hide the surrounding context you're reasoning about. The Rotation Planner and Visualizers already reward wide screens with side-by-side panels; a modal throws that away. Non-modal panels also let two surfaces stay visible at once (e.g. pick a character in one panel while comparing in another).

**How to apply:**

- Team Builder: DetailCard + CompareView move from modals into a docked **Stage** panel (overlay only on narrow screens, via the existing sticky/static breakpoint idiom, not a new modal). See `docs/rounds/team-builder-redesign-2026-07-20.md`.
- Rotation Planner: the `CharacterSelector.svelte` full-screen modal (the last tool modal) becomes a non-modal **Source** panel layered over the timeline from the portrait column's edge.
- New tool features: default to a docked panel or in-frame overlay. Only reach for a true modal when the surface is genuinely meta (settings/help/static).
- Reasonable exceptions exist (a tiny confirm, a refinement popover) — the target is "tool _features_ aren't modals," not "zero overlays ever."

**Documented exception (Nate, 2026-07-30, TB final layout — `docs/rounds/tb-final-layout.md`):** the Team Builder **DetailCard is a modal by design** (the `docked`/Stage arrangement is retired). The principle's rationale is "don't hide the context you're reasoning about" — Compare reasons against the roster/team so it became a fully non-modal center view, but Detail is an isolated single-character read where focus is a feature, and docking it reflowed the Source grid on every open/close. The test for future calls: does the surface _reason against_ what's around it (→ non-modal) or is it a _focused read_ (→ modal is acceptable)?

**Second documented exception (Nate, 2026-08-17):** the planner's **`TabsFullDialog`** — the report shown when a shared `?r=` link arrives with all six tabs occupied and is parked in Saved Rotations instead. ⚓ It is not a tool FEATURE at all: it is a one-shot report of something that already happened, with nothing to reason against, which the principle's own "a tiny confirm" clause allows.

**The test that made it a modal, and it is a useful one to reuse: is the outcome confirmable BY LOOKING?** Every other document outcome is — a save leaves a linked tab, a team load leaves a team, a loaded rotation is on screen — so band A's 2.2s notice is a courtesy rather than the only evidence. This outcome leaves the planner looking untouched, so a missed notice reads as "the link is broken", the reader retries, and the failure COMPOUNDS. ⚠️ Quietness was itself the defect.

⛔ **Its backdrop does not dismiss**, the one divergence from DetailCard/ChromeOverlay (Esc / backdrop / ✕). Those are surfaces you browse; this is a message that has to be taken, and a stray click toward the timeline underneath is exactly how it would be missed. `role="alertdialog"`, acknowledgement focused on open.
