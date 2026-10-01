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

**Decision:** Joining the rest of the site in sentence case, please.
**Notes:** ⚠️ The site's rule is **sentence case** (style guide §2) and the help chapters,
the planner and the Team Builder all follow it. The instruments are the exception, and
"What The Next Roll Buys" capitalizes even the article, which nothing else on the site
does. ⚓ Whatever you pick, the eight sheets inherit it and need no per-row decision.
**Applied (Claude, 2026-09-23):** every Title Case label in the table has its sentence-case
form in its sheet's `New` column. ⚓ **Frozen game terms keep the game's casing inside a
sentence-case label** — `Enemy RES`, `Elemental Mastery`, `DMG Bonus`, `Character Event`,
`CRIT Rate` — so `Your Level` → `Your level` but `Enemy RES` stays. ⚠️ **Two things are
NOT touched:** the eight instrument NAMES (proper names, still open in
`visualizers-workspace.md` §2 — so `Send to Gauge Explorer` and "the Enemy DEF & RES
instrument" wait for it) and the `/` and `&` inside `Hits / rotation` and `Levels & enemy`
(the joining rule is still open in `team-builder.md` §3). ⚠️ Most of these labels are
`.slider-label` / `.field-label` / `.kicker`, which CSS already uppercases, so on screen
the change is invisible. It matters for the locale file and for screen readers.

---

## B. 🐛 Crit stat names — **three** spellings in one tool

**`Crit Rate` / `Crit Damage`** (Crit instrument) · **`CRIT Rate` / `CRIT DMG`**
(Damage Anatomy) · **`CRIT RATE` / `CRIT DMG`** (heatmap axis labels).

**Decision:** Let's follow the game, then: CRIT Rate and CRIT DMG.
**Notes:** ⚠️ The game writes **CRIT Rate** and **CRIT DMG**. ⚓ The glossary marks these
🔒 frozen stat names, which argues for following the game exactly — and that would make
the Crit instrument the one that moves. ⚠️ Axis labels are a separate case (§D).
**Applied (Claude):** the Crit instrument's two labels and its readout lines move. Damage
Anatomy and the Artifact Rolls stat list already match. ⚠️ **One carve-out I made, overrule
if you disagree:** the **screen-reader names stay `Crit rate percent` / `Crit damage
percent`**. They follow the pattern `…-05-def-res.md` praises: visible labels keep the
game's abbreviations and aria names spell them out. An all-caps `CRIT` is also something some
screen readers spell out letter by letter. ⚠️ **`Crit Value:` becomes `Crit value`, not
`CRIT Value`**: crit value is community vocabulary with no in-game spelling to follow, and
the glossary rules **crit value (CV)**. It also matches Artifact Rolls' "Crit value
distribution".

---

## C. 🐛 Colons live inside the strings

Every instrument's readout is built as `Label:` + value — **Crit Rate:** · **Crit Value:**
· **Ratio (CD:CR):** · **Pinned:** · **Vs pinned:** · **Application rate:** ·
**Final RES:** · **Average cost:** · **Without shred/ignore:** · **No-crit risk (n hits):**

**Decision:** OK then, agreed - the colon must come out of the message.
**Notes:** ⚠️⚠️ **The colon must come out of the message.** French puts a space before it,
Japanese uses `：`, and several languages invert the pair entirely. ⚓ This is one
mechanical change across all eight instruments and it is the highest-value structural fix
on the shelf.
⚠️ Note `Ratio (CD:CR):` has a colon _inside_ the label too — that one is a ratio
separator and is 🔒 frozen.
**Applied (Claude):** every `Label:` row's `New` is the label with no colon. ⚓ **One
clarification on HOW:** the colon should move into **one shared locale pattern**, something
like `vz.labelValue = "{label}: {value}"`, which French writes as `{label} : {value}`.
⛔ Not into CSS: a `::after { content: ':' }` can't be translated either. ⚠️ Four of these are
sentence stems as well as labels (`No-crit risk ({n} hits)`, `Rolls into {pair}`, `Once 4
lines exist`, `With {main} main`), so removing the colon doesn't resolve their §3.1
assembly. The instrument sheets still flag it.

---

## D. Axis labels shout

**`AVERAGE DMG` · `CRIT DMG` · `CRIT RATE`** are uppercase in the source _and_ styled
uppercase (same doubling as the planner's lane names).

**Decision:** Agreed - sentence case is our new default, and we just decided to follow
the in-game CRIT Rate / CRIT DMG convention decided above.
**Notes:** ⚠️⚠️ Same reasoning as `rotation-planner.md` §1 — **CJK has no case**, so a
locale gets the styling and none of the emphasis, while the locale file carries shouting
English. ⚓ Write them sentence case and let the CSS shout. ⛔ These should match the
planner's decision, not be decided separately.
**Applied (Claude), and one correction:** `New` is `Average DMG` · `CRIT DMG` · `CRIT Rate`.
🐛 ⚠️⚠️ **The note above is wrong about these three: they are NOT styled uppercase.** They're
SVG `<text>` in `CritHeatmap.svelte:613,625,636` with a letter-spacing and no
`text-transform`, so the only uppercase is the source's. **Writing them sentence case
changes what you see** unless the same change adds `text-transform: uppercase` to those
three `<text>` elements. The code pass needs to do that, or the look moves. (The planner's
lane names really are doubled; this one isn't.)
↻ **2026-09-30 — the trap now also moves GEOMETRY.** The cleanup branch places these
titles by measured ink (`AXIS_INK` in `crit.ts`: Plex Sans cap height, a 0.13px dip below
the baseline), so the equal gaps assume all-caps Latin. Dropping the uppercase brings
descenders in (`g`, `p`), and a locale whose capitals carry accents or descend
(`É`, `Ç`, any CJK) will sit off the gaps too. ⏭ Not a text decision — flag it for the
i18n pass (`docs/i18n-plan.md`), where `AXIS_INK` becomes per-locale or is measured live.

---

## E. The "Readout" block

Six of the eight instruments end in a panel headed **Readout**, and it is the one place
each instrument states its answer in words.

**Decision (keep the word / change it):** Keep the word Readout
**Applied (Claude):** nothing to change. The `§E` markers in the sheets now read ✅.
**Notes:** ⚓ It is a good, neutral word and it is consistent — flagging it only because
it is the single most repeated label on the shelf, so it is worth confirming rather than
inheriting. ⚠️ It translates; it is not jargon.

---

## F. ✅ RULED — caps are never emphasis (⚓ Nate, 2026-09-22)

⛔ **Absolute, site-wide, no exceptions.** Emphasis is `<strong>` or italics. Style guide
§2.1 carries the ruling.

**All three sites** (a full sweep, not a sample — I said "four" in the report and it is
three):

| File                           | Now                                          | New                                                       |
| ------------------------------ | -------------------------------------------- | --------------------------------------------------------- |
| `AnatomyInstrument.svelte:511` | applied to **YOUR** current sheet            | applied to <strong>your</strong> current sheet            |
| `DefResInstrument.svelte:258`  | pushing **BELOW** zero still helps           | pushing <strong>below</strong> zero still helps           |
| `WishInstrument.svelte:261`    | is **YOUR** charted weapon 37.5% of the time | is <strong>your</strong> charted weapon 37.5% of the time |

⚠️ These three rows are the only work this section needs — they are repeated on their own
instrument sheets (`…-05-def-res.md`, `…-06-wish.md`, `…-07-anatomy.md`), so fill them
wherever you reach them first.
⚠️ ⛔ **This does not settle §D** (uppercase lane and axis _labels_, styled by CSS) —
that is a different question and is still open there.
↻ §D is decided now (sentence case, CSS does the uppercasing), which settles this too.
**Applied (Claude):** pre-filled with `<strong>`: **your** / **below** / **your**, in
both this table and the three instrument sheets. ⚠️ All three sentences are also up for
rewrite on other grounds (`…-07` §roll, `…-06` §weapon), so the fill is only a floor.

---

## G. 🐛 `x` vs `×`

The Crit instrument prints multipliers as **`1.234x`** (a literal lowercase x); every
other instrument and the style guide use **`×`**.

**Decision:** True multiplication × everywhere, please.
**Notes:** 🐛 Straight inconsistency, and it is in the instrument's headline number.
`src/routes/(scene)/(tools)/visualizers/lib/CritInstrument.svelte:255,292`
**Applied (Claude), with one call to confirm:** there are five sites, not two
(`CritInstrument.svelte:255,256,267,288,292`). Four are bare numbers, not strings, so
they're a code fix, not a message. ⚠️ **Position:** swapping the character gives
`1.234×`, a SUFFIX. Every other instrument PREFIXES (`×2` in Anatomy, `×{m}` in DEF & RES,
`×{n}` in Artifact Rolls), and so does the style guide's example (`×2 forward vape`).
⚓ **I've pre-filled the prefix form, `×1.234`,** so the shelf reads one way.
✅ **Prefix RULED (⚓ Nate, 2026-09-23).** The style guide's Multiplication row now says
so, and its Time example moved from `0.8×` to `×0.8`.

---

## H. 🐛 `5★` vs `five-star` vs `5-star`

Wish Odds writes **"the featured five-star"** in its chart title and **"A non-guaranteed
5★"** two paragraphs down. The glossary rules **5★**.

**Decision:** 5★ it is.
**Notes:** ⚠️ `★` is 🔒 frozen and is the game's own form. ⚠️ Note it also appears in the
Team Builder's detail line and in Artifact Rolls ("5★ artifact farming"), so the decision
reaches beyond this tool.
**Applied (Claude), and one push-back:** 🐛 ⚠️⚠️ **both "five-star" sites are
`aria-label`s** (`WishInstrument.svelte:116,282`): a screen reader's name for the chart
and for the pity field. Nothing sighted ever sees them. **`5★` read aloud is "5 black
star"** (VoiceOver) or "5 star" depending on the reader, so the glyph is wrong exactly where
these two strings live. ⚓ **Proposal: 5★ in everything visible, `five-star` in screen-reader
text**, the same visible/aria split as §B. ✅ **RULED (⚓ Nate, 2026-09-23): `five-star` in screen-reader text.** Both rows stay as
they are, and the glossary's §4 carries the exception. ⚠️ The visible sites already all say 5★, so on screen §H is done.

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
