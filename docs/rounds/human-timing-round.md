# Human Timing Round (2026-09-14, `feat/human-timing`, merged to main the same day — merge commit `3818211`)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**Trigger:** Nate's idea — the frame-perfect default makes the planner look _less_ accurate to an average player, because their buffs run out before the chart says. Evaluated, researched, built and merged in one session.

## What shipped (ten commits, in order)

1. **`231ebc3` a swap costs ping + 90 ms** (KQM frames evidence, ~75 data points), not gcsim's `ping × 0.12`. ONE conversion: `swapFramesForPing` in `$lib/utils/frames.ts`; the Settings slider prints the frame count. Default 60 ms → 9 frames (was 7). ⚠️ The two legacy `swapFrames → swapPing` migrations still invert the OLD formula on purpose.
2. **`627c7de` the Human timing plate.** Model + authority in **`src/lib/sim/humanTiming.ts`**; state in `siteSettings` (`humanTiming`, `humanTimingMode`, `humanTimingPadFrames` 1–20 default 10, `showHumanPadding`), ⛔ never in `?r=`. Settings: a THREE-WAY `Padding · Animations · Both` (⚓ two checkboxes can both be off and make a lit plate a no-op; a radio structurally cannot), a pad slider, a Show padding toggle.
3. Placement, over three tries (⚓ Nate): **right zone, FIRST, ahead of Buffs**. After the layers it split Auras from the Log; beside the rail on the left it read as part of the zoom cluster. Label **"Human timing"**, mark `hand`.
4. **The hatch: 2px white at .12 on a 6px period** (`PAD_HATCH_*` in the export mirror it). A 1px/.14/8px try read as texture and was discarded.
5. **Band B re-cut.** Reset + zoom in the 3-up's LEFT zone (`bandBLeft`), "Reset" not "Reset zoom"; ⚓ **ONE HEIGHT — the icon-only exception (2026-08-10) is WITHDRAWN by Nate**: steppers 36px wearing `zoomIn`/`zoomOut` at 18px, the slider on its own plate painted **`--surface`** (⚠️ NOT `--btn-face` — a 3-up zone repaints every `.btn` to the glass panel; the first cut was visibly a different glass).
6. **`BP.wide` = 68rem / 1088px**, a NEW rung named by its fact: band B's full form (~806px of band) beside the bench column (viewport − ~276). Words + slider fold below it. ⚠️ Below `compact` the Reset plate and the Total's KEY fold and the steppers narrow to 28px, or the 320 phone form spills. Swept 320–1600: 0 overflow, 0 spill from 340. ↻ **2026-09-30 (playback round): `wide` is 71rem** — the transport joined band B and the zoom left it for one plate + a popover; below `compact` a ⋯ folds speed/Laps/Human timing/Log/Notes. `$lib/breakpoints.ts` holds the current fact.
7. **No-frames tokens: the provisional GRADIENT is retired** — ordinary strip, label in `--ui-provisional` outright (was a 55/45 mix with white); mirrored in the PNG. The sliver inherits nothing on a frameless character by construction.
8. **The sliver names its pixel**: `InputBlock.padAfter` → tooltip "Human timing: 10 frames (0.17s) after a skill, before an input the game does not buffer" (the swap's: the wait for the new character). Help's timeline chapter gained the paragraph, incl. that a shared link opens frame-perfect.
9. **Guards (⚓ Nate-approved promotions)**: `sim/humanTiming.test.ts` (rule + where a pad may land + off-is-off + null≡omitted + full animations never lengthen a buffered swing); `settingsBackup.test.ts` gained the four keys. ⚠️ Two first-draft expectations were WRONG about the rule and the code was right (last action of the rotation, and an action before a typed wait, both pad nothing).

## The model — ⚓ THE RULE IS INPUT BUFFERING, NOT A UNIFORM SLOWDOWN

- KQM: "add 10 frames to every attack to account for human error" is the ONLY authority; the number is the player's.
- **Buffered = free.** The game stores the next N (or C off a non-bow) pressed during a swing → no pad, no full-animation. Everything else pads: N→E/Q/D/J/swap (timed against the hitmark), a bow's aimed shot (KQM: cannot be buffered), after E/Q (KQM says "buffered or ignored" — ⚠️ an UNKNOWN resolved conservatively), and **the incoming character's first input after a swap** (a REACTION).
- **Full animations** resolve with `FULL_ANIMATION_KEY` (`'anim'` — literally the field, so `frameAt` finds it explicit). ⛔ NEVER at a buffered transition: gcsim's N→N frames ARE the chain cadence a stored input produces.
- No pad before a typed `~1s`, none after the rotation's last action — `peekHumanPadTarget` answers `null` there where `peekActionKey` answers `'swap'` (the slice question has an answer; the pad question does not). `swapFollows` is the only way a segment's last action knows a swap is real.
- A pad is **not an IR event** — `ctx.humanPads` → finalize → `InputBlock` kind `'pad'`, id minted from the event counter so it sorts between the action and the next input. `showHumanPadding` strips the blocks in ONE derived (`displayTracks`) read by both the chart and the PNG snapshot; the parse pads either way.

## ⛔ Two things that are NOT knobs (asked, answered by method)

- **The 2-frame input lag is ALREADY IN THE DATA.** gcsim counts `end − start` where the end is the START FRAME OF THE NEXT ACTION'S ANIMATION; a floor would double-count it.
- **gcsim's `frame_defaults=human` applies ONLY `swap_delay`** — `attack_delay`/`skill_delay`/… are parsed and echoed into result metadata, read by nothing. No oracle for the pad; it is a stated model.

## Measured

`Xiangling E N3 Q > Fischl E N2 A Q > Bennett E Q ~1s N1 D` at 9 swap frames: 588 → **698** padding → **745** animations → **855** both. Casts/actions identical; only `overloaded` reactions move (Xiangling's Pyro vs Oz's cadence). Corpus byte-identical with the feature off. e2e 73 + 73 green twice (feature, then the band re-cut).

## Verified

✅ **Real-Safari pass by Nate, 2026-09-14, all green** — the hatch (CSS repeating gradient and the hand-drawn canvas mirror), the 18px magnifiers, the slider's plate, the provisional labels, the folded forms. Nothing from this round is in the Safari backlog.

## Open

- Is a swap press during E/Q buffered? Unmeasured; pads today.
- Should the post-swap reaction be a larger number than the timing pad? No source; folded into the pad.

**↻ 2026-09-17 — buffering AFTER a Charged Attack is PER CHARACTER.** The default (charged → N/C is a stored input) is an EXTENSION of KQM's frames page, which states buffering only after normals; the Raiden guide supports it ("can be input buffered or button-mashed" over her N3C/N1C). Lohen's quick guide contradicts it for him ("you cannot buffer inputs after a Charged Attack"), so 🆕 `NormalAbility.noBufferAfterCharged` (positive claim, one holder, `cba0d157`) pads his next swing. ⛔ Don't flip the default without a source that speaks for most characters; ⛔ author the flag only from a source naming that character.

**↻ 2026-09-30 — the default MODE is `padding`, not `both`** (⚓ Nate, `ca67dc59`). Full animations model a player who never cancels; Flins C1 `E E sQ N5 E sQ N5 E sQ` fit with padding (last sQ 550f) but `both` resolved N5's last swing to `anim` 68f (hit 29f) and every E/sQ to full length, pushing the last E sQ out of the stance. Nate: he animation-cancels everything on characters he knows. ⚠️ The pad slider never touches the animation half — "lowering the setting didn't help" was that.
