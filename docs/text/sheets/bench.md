# Worksheet — The bench

**Surface:** the slot strip under the bands — bench cards, the loadout popover (artifact
set / weapon / refinement), and the always-on buffs chip row. Shared by the Rotation
Planner and the Team Builder.
**Pass:** 1 (Nate leads) · **Strings:** 20 · **Guide:** `docs/text/style-guide.md` ·
**Glossary:** `docs/text/glossary.md`

---

## 1. ⚠️ The loadout popover's section headings

Three sections, and they do not follow one pattern.

| key                            | Where                                              | Now             | New |
| ------------------------------ | -------------------------------------------------- | --------------- | --- |
| `bench.loadout.artifact.key`   | Heading, followed by the current set's name        | Artifact set:   |     |
| `bench.loadout.weapon.key`     | Heading, followed by the current weapon's name     | Weapon:         |     |
| `bench.loadout.refine.key`     | Heading above the five refinement pips             | Refinement      |     |
| `bench.loadout.none`           | The value shown when nothing is equipped           | None            |     |
| `bench.loadout.artifact.empty` | The "no set" tile, tooltip + screen-reader name    | No artifact set |     |
| `bench.loadout.weapon.empty`   | The "no weapon" tile, tooltip + screen-reader name | No weapon       |     |

`src/lib/components/LoadoutPanel.svelte:71,79,80,102,113,114,145`

⚠️ **Two headings take a colon and the third does not.** "Artifact set:" and "Weapon:"
are `key: value` pairs; "Refinement" heads a control instead. Defensible — but the colon
is currently carried _inside the string_, which means six locales each inherit an English
punctuation convention. ⚓ French puts a space before a colon; Japanese uses `：`. ⛔ The
colon should not be in the message.
⚠️⚠️ **ASSEMBLED** — both are `<span>Artifact set:</span> {value}`. One message with the
value interpolated, or the pair cannot be reordered.
⚠️ **`None` is a bare fallback inside an expression** (`?? 'None'`) and is easy to miss
in extraction. It is listed here so it does not get left behind in English.

### `bench.loadout.refine.hint` — beside the Refinement heading

**Where:** Shown only when no weapon is equipped, so the pips are inert.
**Now:** equip a weapon first
**New:**
**Notes:** ⚠️ Lowercase, no terminal punctuation — the only sentence fragment styled this
way on the bench. ⚓ Its design reason is good and worth keeping: the section stays
**visible but inert** rather than vanishing, because a section that vanishes teaches
nothing about why. The wording should match that intent (an explanation, not a command).
`src/lib/components/LoadoutPanel.svelte:146`

### `bench.loadout.weapon.none-curated` — empty weapon list

**Where:** Replaces the weapon grid when no weapon of that type is curated.
**Now:** No {weaponType}-type weapons are curated yet.
**New:**
**Notes:** ⚠️⚠️ **`{weaponType}-type` is an English compound and will not translate.**
Japanese and Chinese attach a counter/suffix differently, and Russian needs the noun
declined. ⚓ Prefer a form where the whole phrase is in the message and the weapon type is
a clean noun substitution. The weapon type itself is 🔒 frozen (genshin-db).
`src/lib/components/LoadoutPanel.svelte:107`

---

## 2. ⚠️ The uncurated mark — the site's honesty claim, on the smallest surface

### `bench.card.uncurated.title` / `.aria`

**Where:** A small mark beside a bench card's name when the character has no frame data.
**Now (tooltip):** Frame timing not curated yet — capabilities are complete, but Planner
timing is approximate
**Now (screen reader):** Frame timing not curated yet
**New (tooltip):**
**New (screen reader):**
**Notes:**

- ⚓ **This is the most important tooltip on the bench.** It is where "not curated yet"
  stops being a shrug and becomes a precise claim: the Team Builder's answer is complete,
  the planner's timing is approximate. ⛔ Don't shorten it into the shrug.
- ⚠️ **It says "Planner", which is the tool switcher's short form, not the tool's name.**
  Glossary: the tool is the **Rotation Planner**; in prose "the planner" is fine,
  capital-P "Planner" is neither. Pick one and it propagates.
- ⚠️ **The screen-reader name is a truncation that drops the entire explanation** — a
  sighted user gets the reason, a screen-reader user gets only the problem. Worth making
  them the same string.
- ⚠️ **tight** — tooltip only, no width cap, so length is free here.
  `src/lib/components/SlotPortrait.svelte:329,330`

### Bench card controls

| key                        | Where                         | Now                          | New |
| -------------------------- | ----------------------------- | ---------------------------- | --- |
| `bench.card.artifact.aria` | Artifact chip on a bench card | Choose artifact set          |     |
| `bench.card.weapon.aria`   | Weapon chip on a bench card   | Choose weapon and refinement |     |
| `bench.card.picker.close`  | ✕ on the open loadout popover | Close picker                 |     |

`src/lib/components/SlotPortrait.svelte:366,376,418`

⚠️ **"Close picker"** — "picker" appears nowhere else user-facing; the glossary calls this
the **loadout popover**. One of the two should move.

---

## 3. The always-on buffs row

| key                      | Where                                | Now                       | New |
| ------------------------ | ------------------------------------ | ------------------------- | --- |
| `bench.bonuses.key`      | Label before the chip row            | Always-on buffs           |     |
| `bench.bonuses.moonsign` | Chip, when the team reaches the tier | Moonsign: Ascendant Gleam | 🔒  |
| `bench.bonuses.hexerei`  | Chip, when the team reaches the tier | Hexerei: Secret Rite      | 🔒  |

`src/lib/components/TeamBonusesBlock.svelte:215,231,234`

⚠️ **The two faction chips are 🔒 frozen game terms** — "Moonsign", "Ascendant Gleam",
"Hexerei" and "Secret Rite" all come from the game and genshin-db ships them per locale.
⛔ Never hand-translate them. But note they are currently **hardcoded English with a
hardcoded `: ` separator**, so extraction has to reach the game term rather than the
whole chip.
⚠️ Elemental resonance names beside them (Fervent Flames, Soothing Water, Impetuous
Winds, High Voltage, Shattering Ice, Enduring Rock, Sprawling Greenery, Protective
Canopy) are 🔒 frozen for the same reason — `src/lib/utils/resonance.ts:37–132`.
⚠️ **"Always-on buffs"** is ours and translates. ⚓ It is doing real work: it distinguishes
these from the timed buffs the planner draws, which is a distinction the tool is built on.
