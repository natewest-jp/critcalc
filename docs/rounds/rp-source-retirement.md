# RP Source Retirement — ⇄ leaves the tool (2026-08-13)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

✅ **MERGED `a9950f4` and PUSHED.** Cite the MERGE hash; the branch commits are
`ce24214` (the retirement) and `9c7374a` (the bench fix it surfaced). Gates green
including `test:e2e` on both engines (68 + 68). ✅ **Safari cleared by Nate
2026-08-13** — including band B's left zone, which gains a second plate during an
errand and shifts the nav rail he calibrated on 2026-08-10.

**The planner has no character grid.** ⚓ Nate: it never earned its keep — power
users type the notation, and anyone who wants to browse and filter characters
wants the tool next door. The retort that settled it is in the code, not the
argument: the Source could only ever fill the **lowest empty slot**, while the
Team Builder's audition **pins the incumbent** and compares against it. So ⇄ on a
bench card navigates to `/team-builder?swap=N` instead of the planner keeping a
worse copy of the answer.

**The errand is a round trip, and that is the design.** Two flags, two questions:

- `fromPlanner` — lives for the whole VISIT, drives the "Back to planner" plate.
  Cancelling means "let me look around", not "I never came from the planner"; the
  way back must not evaporate at the moment it becomes the only way back.
- `returnOnCommit` — scoped to the ONE audition the errand opened. Cancel and
  commit both discharge it, so a commit two auditions later cannot yank you out of
  a tool you decided to stay in.

The team does not travel — it IS the shared working team — so the slot index is
the entire payload. The arrival is resolved in an `$effect` gated on
`rt.restored && mounted`, **not** in `afterNavigate`: a cold load of `?swap=2`
reads the param before the layout restores the tabs and would degrade to "open the
Roster" for a team that does have someone in it.

⚠ **The Back-to-planner arrow points RIGHT, deliberately.** The retired chip read
"← Explore alternatives" because the Team Builder sits to the planner's LEFT in
the tool order; coming back is a move right, so the arrow turns and moves to the
trailing edge with it. **The site's arrows are spatial** — they say where the tool
is, not whether the trip is outbound or a return.

**Retired with the panel** (do not resurrect looking for them): `CharacterSelector`,
`CharacterSelectorFilters`, `pickerFilters.svelte.ts`, the `sourceOpen`/
`sourceOverlay` props, `.rp-frame--picking`'s 26rem min-height, `.rp-frame`'s
`position: relative` (the overlay was its only containing block), the composer's
inert/blanked picking state, the page's window Escape handler, the aside column's
three-way ternary and `asideBare`, and the "← Explore alternatives" chip.
`?alts=1` is KEPT as an inbound param — the chip that sent it is gone, but it is a
shareable URL and costs one branch.

⏭ **Left open, Nate's call:** the planner's empty bench slots are now the only
on-ramp for adding a character. They already fall through to ⇄'s job so they work,
but nobody has decided whether a bare empty portrait reads as an invitation.

**How to apply:** the planner is a WRITING surface and the Team Builder is the
CHOOSING surface — do not add roster browsing back to the planner. See
`docs/rounds/tool-page-revival.md` for the revival bug this round surfaced,
`docs/rounds/bench-band-round.md` for the ribbon, `docs/rounds/tb-card-round.md` for the
audition's cards.
