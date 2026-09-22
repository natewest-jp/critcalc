# Worksheet — Instrument conventions (read first)

**Surface:** cross-cutting decisions for all eight Visualizers instruments.
**Pass:** 1 (Nate leads) · **Guide:** `docs/text/style-guide.md` ·
**Glossary:** `docs/text/glossary.md`

⚓ **Decide these eight things once here and the eight instrument sheets become short.**
The instruments were built over months and each settled its own conventions; the result
is that the same idea is written three or four ways across the shelf. Almost none of it
is _wrong_ — it is just not one voice, and the instruments are the surface where a reader
moves between tiles most.

---

## A. 🐛 Control-label casing — currently **three** conventions

| Convention                    | Found on                                                                                                                                                                                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title Case**                | Crit Rate · Crit Damage · Hits / Rotation · Current Build · Attack String · Hit Interval · ICD Rule · Hit Counter · Reaction Family · Your Sheet · Your State · Your Level · Enemy Level · Enemy RES · RES Shred · DEF Shred · DEF Ignore · Banner · Current Pity · Pulls Saved · Hidden Multiplier |
| **Sentence case**             | Event log · Base stat · Base scaling stat · Flat bonus · Flat stat bonus · Readout · Applications                                                                                                                                                                                                   |
| **Title Case incl. articles** | What The Next Roll Buys                                                                                                                                                                                                                                                                             |

**Decision:**
**Notes:** ⚠️ The site's rule is **sentence case** (style guide §2) and the help chapters,
the planner and the Team Builder all follow it. The instruments are the exception, and
"What The Next Roll Buys" capitalizes even the article, which nothing else on the site
does. ⚓ Whatever you pick, the eight sheets inherit it and need no per-row decision.

---

## B. 🐛 Crit stat names — **three** spellings in one tool

**`Crit Rate` / `Crit Damage`** (Crit instrument) · **`CRIT Rate` / `CRIT DMG`**
(Damage Anatomy) · **`CRIT RATE` / `CRIT DMG`** (heatmap axis labels).

**Decision:**
**Notes:** ⚠️ The game writes **CRIT Rate** and **CRIT DMG**. ⚓ The glossary marks these
🔒 frozen stat names, which argues for following the game exactly — and that would make
the Crit instrument the one that moves. ⚠️ Axis labels are a separate case (§D).

---

## C. 🐛 Colons live inside the strings

Every instrument's readout is built as `Label:` + value — **Crit Rate:** · **Crit Value:**
· **Ratio (CD:CR):** · **Pinned:** · **Vs pinned:** · **Application rate:** ·
**Final RES:** · **Average cost:** · **Without shred/ignore:** · **No-crit risk (n hits):**

**Decision:**
**Notes:** ⚠️⚠️ **The colon must come out of the message.** French puts a space before it,
Japanese uses `：`, and several languages invert the pair entirely. ⚓ This is one
mechanical change across all eight instruments and it is the highest-value structural fix
on the shelf.
⚠️ Note `Ratio (CD:CR):` has a colon _inside_ the label too — that one is a ratio
separator and is 🔒 frozen.

---

## D. Axis labels shout

**`AVERAGE DMG` · `CRIT DMG` · `CRIT RATE`** are uppercase in the source _and_ styled
uppercase (same doubling as the planner's lane names).

**Decision:**
**Notes:** ⚠️⚠️ Same reasoning as `rotation-planner.md` §1 — **CJK has no case**, so a
locale gets the styling and none of the emphasis, while the locale file carries shouting
English. ⚓ Write them sentence case and let the CSS shout. ⛔ These should match the
planner's decision, not be decided separately.

---

## E. The "Readout" block

Six of the eight instruments end in a panel headed **Readout**, and it is the one place
each instrument states its answer in words.

**Decision (keep the word / change it):**
**Notes:** ⚓ It is a good, neutral word and it is consistent — flagging it only because
it is the single most repeated label on the shelf, so it is worth confirming rather than
inheriting. ⚠️ It translates; it is not jargon.

---

## F. ✅ RULED — caps are never emphasis (⚓ Nate, 2026-09-22)

⛔ **Absolute, site-wide, no exceptions.** Emphasis is `<strong>` or italics. Style guide
§2.1 carries the ruling.

**All three sites** (a full sweep, not a sample — I said "four" in the report and it is
three):

| File                           | Now                                          | New |
| ------------------------------ | -------------------------------------------- | --- |
| `AnatomyInstrument.svelte:511` | applied to **YOUR** current sheet            |     |
| `DefResInstrument.svelte:258`  | pushing **BELOW** zero still helps           |     |
| `WishInstrument.svelte:261`    | is **YOUR** charted weapon 37.5% of the time |     |

⚠️ These three rows are the only work this section needs — they are repeated on their own
instrument sheets (`…-05-def-res.md`, `…-06-wish.md`, `…-07-anatomy.md`), so fill them
wherever you reach them first.
⚠️ ⛔ **This does not settle §D** (uppercase lane and axis _labels_, styled by CSS) —
that is a different question and is still open there.

---

## G. 🐛 `x` vs `×`

The Crit instrument prints multipliers as **`1.234x`** (a literal lowercase x); every
other instrument and the style guide use **`×`**.

**Decision:**
**Notes:** 🐛 Straight inconsistency, and it is in the instrument's headline number.
`src/routes/(scene)/(tools)/visualizers/lib/CritInstrument.svelte:255,292`

---

## H. 🐛 `5★` vs `five-star` vs `5-star`

Wish Odds writes **"the featured five-star"** in its chart title and **"A non-guaranteed
5★"** two paragraphs down. The glossary rules **5★**.

**Decision:**
**Notes:** ⚠️ `★` is 🔒 frozen and is the game's own form. ⚠️ Note it also appears in the
Team Builder's detail line and in Artifact Rolls ("5★ artifact farming"), so the decision
reaches beyond this tool.

---

## I. ⚠️ Formulas are 🔒 frozen — and they are currently strings

Several instruments print a formula as body text:

- `CD = 2×CR` · `CV = 2×Rate + DMG`
- `res < 0: 1−res/2 · 0–75%: 1−res · ≥75%: 1/(4·res+1)`
- `(100+yours) / ((100+yours) + (100+enemy)·(1−shred)·(1−ignore))`
- `2.5s timer · every 3rd hit`
- the sixteen reaction multipliers in `anatomy.ts` (`Vaporize ×2`, `Swirl ×0.6`, …)

⛔ **None of these translate**, but two of them embed **English words** (`yours`, `enemy`,
`Rate`, `DMG`, `timer`, `hit`) that a translator will reasonably try to localize — and
must not, because the surrounding prose explains them. ⚓ They need a 🔒 marker in the
locale file, not a rewrite.
⚠️ The reaction names beside the multipliers (**Vaporize, Melt, Spread, Aggravate,
Hyperbloom, Burgeon, Shatter, Overload, Electro-Charged, Bloom, Superconduct, Swirl,
Burning**) _are_ 🔒 frozen and genshin-db ships them per locale.

---

## J. ↻ WITHDRAWN — US English is the house style, so `modeled` was already right

⚓ **Nate ruled US English site-wide, 2026-09-22** (glossary §4). The mixed spelling was
an AI artifact, never a house style.

⛔ **Do not "fix" `modeled` in `WishInstrument.svelte:256`, or `behavior` in
`Contribute.svelte`.** They were the only two US-correct spellings on the site, and this
section previously told you to change both. Withdrawn.

⚠️ The real list runs the other way — 12 British spellings, ten of them in help chapters
(pass 2). Full table with file:line: **glossary §4**. None is in an instrument.

<details>
<summary>The withdrawn text, kept so the reversal is legible</summary>

### ~~J. Two American spellings in instrument prose~~

- **"isn't fully datamined, so it isn't modeled"** — Wish Odds. House style is
  **modelled** (`WishInstrument.svelte:256`).
- (The other stray, `behavior`, is in `Contribute.svelte` — see the glossary's §4.)

**Decision:** ~~fix both~~ → ⛔ **neither. Both were already correct.**

</details>
