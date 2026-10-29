# UI state colours — the family is FOUR

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

✅ **Merged `fe9b031` + PUSHED, 2026-08-12** (branch `polish/ui-colors-cleanup`, deleted; the token commit is `d54d319`). ⚠ Cite the MERGE hash. ✅ **Real Safari checked by Nate** — "everything is green."

```
--ui-danger      #e63946   a destructive ACTION — a verb, what a control will do
--ui-warning     #f4a261   a CAUTION you caused — parse warning, unknown token
--ui-positive    #5be0ac   saved · on · valid
--ui-provisional #f6d365   our data is INCOMPLETE — a provenance statement
                 #998136   ⚠ ZONED: .ctx-light rung
```

⚓ Nate approved all four off `/lab` §11, which keeps the whole argument. The census + measurements live there; `app.css`'s UI STATE COLORS block holds the law.

## The rules this produced

- ⚠⚠ **`--ui-provisional` is NOT a caution and NOT an error.** Nothing to click, nothing the user did, nothing wrong with the character. It was split out of `--ui-danger`, which was doing two jobs at **13 sites**. Seven moved: the ∅ on 122 cards + its bench twin, the planner's generic-timing text and isApprox fill (+ canvas mirrors), CoveragePanel's unknown chip, DetailCard's stub note, CompareView's stub label.
- 🔎 **The tell that found it:** none of those sites' comments ever argued RED was right — they argued state-vs-domain (what the dire-retirement round was settling), and red was the only rung left that wasn't orange or green. `.rp-active-text--danger` called itself _"warning-tinted text"_ and then reached for danger.
- ⛔ **PROVISIONAL MAY BE A MARK ON PAPER AND NEVER PROSE INK.** The light rung sits at the **graphical** floor (3.02:1) and cannot go further: at the 4.5:1 text floor it lands **ΔE .030 from `--gold-700`** — it _becomes_ the light accent, and gold on paper already means "a gap you can click".
- ⚠ **It is the ONLY zoned UI state colour**, and that is a decision: danger is the only other one that works on paper (3.33:1 vs warning 1.65 / positive 1.66) and the other two have no paper consumers. A new paper consumer needs a rung in `.ctx-light`, not a nudge at `:root`.
- ⚠⚠ **WHEN AN ELEMENT CLOSES ON A UI COLOUR, SPEND LIGHTNESS — hue is what the element owns.** Twice proven: `--rx-quicken`, and `--ui-positive` (#51c89a sat ΔE **.026** from `--el-anemo-bar`; #5be0ac is the same hue at Genshin's L, .072).
- ↻ **`--ui-warning` HELD, reversing a three-value analysis.** Lifting it to `#f7c49d` was a pure win alone — but the fourth value changed its job: warning's darker, more saturated orange is what keeps the orange/yellow pair reading as two (ΔE .122 against .083 lifted). **A recommendation can expire when the set around it changes.**

## The risk ramp is the PARENT, and it is a hand-synced pair

⚠ `crit.ts`'s `RISK_STOPS` **fathered** this family (⚓ Nate's pick) — the tokens were taken from it, which is why they coincide. 🐛 It had silently become a _second_ family: it still held `#4ecca3`, the **pre-nudge** positive, so chart and tokens disagreed for months. Re-synced 2026-08-12; **all four stops are now token values**.

- ⛔ **Still literals, not `var()`** — § Laws forbids a UI state token inside a visualization. Both sites say so. **Re-sync by hand when either moves.**
- ⛔ `ArtifactInstrument`'s `same` is **not** `--ui-provisional` despite the matching hex: "this roll is a wash" is a confident answer, not missing data.

## ⏸ Open

- The RP notes-badge disc is `--ui-danger` and is arguably neither a verb nor provenance — an attention marker. Left as-is (⚓ Nate approved the red there).
- Genshin's own trio (`#80DF66` / `#FFC700` / `#FF5A5A`) was **measured and not adopted**: brighter on every ground, but their red is ΔE .040 from pyro and their green .045 from dendro. They can afford element/state collision because the two never share a reading in their UI; ours share a chart. Recorded in `/lab` §11 so it is not re-proposed blind.

Related: `docs/rounds/element-palette-round.md` · `docs/rounds/style-reference.md` · `docs/rounds/dire-retirement-round.md`
