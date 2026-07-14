# Gotchas — bugs, footguns, omissions & errors we made

A single catalog of mistakes we don't want to repeat, kept in-repo so the lesson
survives the session that learned it. Each entry is a small postmortem: what
happened, why it bit, the rule that prevents a repeat, and where that rule now
lives or is enforced.

**Scope:** game-mechanics and **data-curation** footguns — the things a curator
(human or agent) needs at authoring time. Pure front-end engineering lessons
(SSR/hydration, Safari repaint, WebGL, lazy-import ordering) stay in memory and
the `docs/*-handoff.md` docs; promote one here only if it recurs across the data
layer too.

## Entry template

```
### <slug> — <one-line title>

**What happened:** the concrete mistake.
**Why it bit:** why it was easy to make and hard to notice.
**The rule now:** the one-sentence takeaway.
**Where it's caught / lives:** the lint, test, script, doc, or convention that
enforces or records it (or "not automatically — review only", stated honestly).
```

Keep entries short. When this file gets long, split by theme into
`gotchas/<theme>.md` and leave the index here.

---

### elevation-spec-lost — a primitive with no written spec

**What happened:** The `elevate` Effect existed in the schema, its JSDoc called it
"special / multiplicative," and a memory said the same — but nobody had written
down the _bucket mechanics_ that make elevation special: it's a **multiplicative
reaction-DMG bucket, currently Lunar-only**, distinct from both the _additive_
`lunar*DmgBonus` stat and the _no-primitive_ Reaction Bonus bucket.

**Why it bit:** With only "it's special" recorded, we couldn't reason about it.
The schema-gaps survey even asserted elevation applies to Swirl/EC — wrong, it's
Lunar-only. A primitive whose _rule_ is undocumented is a latent error generator:
every downstream decision has to guess, and guesses diverge.

**The rule now:** Document the **mechanic** (the rule the field encodes), not just
the field. A primitive without a written spec is an incomplete primitive.

**Where it's caught / lives:** [`../game/elevation.md`](../game/elevation.md) — the
three reaction-DMG buckets + the curator signal (game text "elevated by X%" →
`elevate`; "DMG Bonus" → the `lunar*DmgBonus` stat).

---

### factionBonuses-orphaned — a primitive wired to nothing

**What happened:** `factionBonuses` was added to the character type, given a lint
rule, and authored on exactly **one** character (Fischl) — then wired to no
consumer. No renderer, no derivation reads it. It was forgotten so thoroughly that
the later "what schema exists" survey missed it entirely.

**Why it bit:** An unwired primitive with one lonely usage is invisible. It _looks_
done — type + lint + a real usage — but produces nothing, and there's no failing
test to flag the gap, so nothing ever surfaces it.

**The rule now:** Wire a primitive **end-to-end** (author → derive/consume →
render) in the same body of work. If you must land it early, track the gap
explicitly — a `// TODO: data gap` at the type **and** a curation task — so it
can't silently vanish.

**Where it's caught / lives:** [`../game/factions.md`](../game/factions.md) (the
mechanic) + [`../../curation/faction-bonuses-wiring.md`](../../curation/faction-bonuses-wiring.md)
(the open wiring task). Current code state: `character.ts` (type) + `characterLint.ts`
(lint) + `fischl.json` (the one usage) — still no consumer.

---

### atk%-buff-scale — 0.225 where 22.5 was meant

**What happened:** atk% (and other percentage) buff values, plus `BuffValue`
scaling ratios, must be stored as **whole percentage points** (`22.5`), not
decimals (`0.225`). Mixing the two produces a buff 100× off.

**Why it bit:** There's no type-level distinction — both `0.225` and `22.5` are
just `number`. The convention is JSDoc-only (`BuffValue.scaling`: _"ratio is in
PERCENTAGE POINTS, not a decimal"_), consumed by `buffDisplay.ts`. A wrong-scale
value passes lint and parse; it only looks wrong in the rendered timeline — if you
happen to look.

**The rule now:** Percentage buff values and `BuffValue` scaling ratios are whole
percentage points. Store `22.5`, not `0.225`.

**Where it's caught / lives:** **Not automatically** — JSDoc convention
(`src/lib/types/ability.ts`, `BuffValue.scaling`) + review + eyeballing the
rendered buff. Give any percentage value a second look at authoring time.

---

### fake-timing — inventing tick cadence

**What happened:** Filling in a plausible-looking tick interval or duration when
the real cadence isn't known, instead of leaving it visibly unknown.

**Why it bit:** A fabricated interval is indistinguishable from a verified one
downstream — the timeline renders it with full confidence and a user trusts it.
Worse, a made-up number _masks the gap_, so nobody goes back to verify it.

**The rule now:** Timing comes only from gcsim (`~/Code/gcsim`
`internal/characters/{id}/`) or explicit kit text. Unknown cadence → `~?s` (a
visible unknown). Unmodelable effect → `_todo`. Never a made-up number.

**Where it's caught / lives:** CLAUDE.md data conventions ("Never fake timing");
verification source is the local gcsim checkout.

---

### frames-flip-isCurated — advertising a hollow kit as done

**What happened:** Landing a FrameMap on an ability flips the character's
`isCurated` flag to `true`. Do that on a kit whose effects are still empty/stubbed
and the site now advertises a hollow kit as fully curated.

**Why it bit:** `isCurated` is the site's honesty signal (the Team Builder "not yet
curated" bucket, the planner's generic cast-time fallbacks). Frames are visually
satisfying to add, but they're **orthogonal** to whether the mechanics are
modeled — coupling them makes it easy to flip the signal by accident.

**The rule now:** Never land frames on an effect-empty kit. Frames come _after_ the
effects, or the kit stays honestly "not yet curated." A character that is genuinely
curated but frameless goes in `FRAMELESS_EXEMPT`.

**Where it's caught / lives:** `characterLint.test.ts` (the `FRAMELESS_EXEMPT`
list) + the `isCurated` derivation.

---

### talent-level-10 — reading the wrong scaling column

**What happened:** Talent scaling values must be stored at **talent level 10** (the
10th column of the sidecar scaling table). Grabbing a different column (level 1, or
a talent-book-boosted level) drifts every number in the kit systematically.

**Why it bit:** Sidecar tables have many columns; picking the wrong one is a silent,
uniform error across a whole character that no single value looks wrong against.

**The rule now:** Store the **level-10** column value.

**Where it's caught / lives:** `scripts/normalize-talent-levels.mjs` enforces the
level-10 convention.
