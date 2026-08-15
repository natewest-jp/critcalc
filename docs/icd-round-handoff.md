# ICD round — handoff

**Status:** NOT STARTED. Scoped 2026-08-15 from the far side of the faction-bonuses round (`fec93f8`), which is where the gap surfaced.
**Why it exists:** ⚓ Nate asked what it would take to feed catalyst normals, charged attacks and bow aimed shots into the reaction system, and whether stance infusions would come along. The answer is that the _wiring_ is small and the _ICD model_ is the round.

---

## The one-paragraph version

The parser emits reactions **only from E/Q casts**. Feeding N/C/P in is a handful of lines — the element is already resolved and already stamped on every action event. But there is **no elemental-application ICD anywhere in `src`**, and casts are naturally spaced enough that its absence has never shown. Normals are exactly where it bites: standard ICD is "3 hits or 2.5s", so a catalyst `N5` applies on hits 1 and 4, and naive wiring would emit **five** swirls where the game gives two — on the single most common token in the tool. Build ICD first; normals-feed-reactions then falls out nearly free.

---

## What already exists (more than you'd expect)

**The element rule is done and centralised.** `src/lib/utils/actionElement.ts` — `resolveActionElement(kind, tokenText, weapon, element, infusion)` — is the single source of "is this N/C/P elemental, and with what element", shared by the parser and the notation highlighter. It already encodes all three cases Nate asked about:

| case                                                                 | handled |
| -------------------------------------------------------------------- | ------- |
| catalyst N/C/P                                                       | ✅      |
| bow charged / aimed shot (⛔ except `C1`, the physical partial shot) | ✅      |
| active normal carries an infusion                                    | ✅      |

**The element is already stamped downstream.** `ActionEvent.element` carries it per swing (absent ⇒ physical), and the parser-private hit records carry it too. Nothing needs computing — only consuming.

**Stance infusions come free.** 16 characters carry `NormalAbility.infusion` (Cyno, Hu Tao, Ayato, Yoimiya, Xiao, Itto, Skirk, Clorinde, Raiden, Mavuika, Chasca, Xilonen, Tartaglia, Nilou, Wanderer, Flins), and `resolveActiveAbility` makes it stance-aware, so mid-rotation infusion already resolves correctly. They start reacting the moment normals feed the aura.

**The research is done.** `docs/library/game/icd.md` is thorough and cites gcsim's machine-readable `pkg/core/attacks/icd_groups_gen.go` alongside KQM and the Fandom per-ability catalogue.

**The schema field exists.** `noICD?: boolean` on two types in `ability.ts` — ⚠️ read by **zero** code today, a deliberate forward-looking annotation.

**There is a visualizer that already simulates this.** ⚓ Nate: the Visualizers' **ICD timeline** instrument. Whatever model it uses is a second opinion worth reconciling against before inventing one parser-side.

---

## What is missing

**All of it, on the parser side.** Grep for `applicationICD` / `elementalICD` / `gaugeUnit` / `auraGauge` in `src` returns nothing.

The aura model is deliberately coarse — a presence `Set`:

```ts
type AuraState = {
	applied: Set<AuraElement>; // no gauge units
	burning: boolean; // no decay
	quickened: boolean;
	bloomCores: number;
};
```

`computeReactionsForCast` documents itself as **optimistic**: "any opposing aura makes the matching reaction eligible." That is a defensible choice for a tool that visualises mechanics rather than computing damage — ⚠️ **do not casually replace it with a full gauge simulation.** The question this round must answer is narrower: _how often does a repeating source APPLY its element_, which is ICD, not gauge decay.

---

## The work, in the order it wants doing

1. **Reconcile with the visualizer.** Read the ICD instrument's model first. If it is already correct and testable, the parser should borrow its vocabulary rather than grow a second one.
2. **An ICD clock in the parser**, keyed by (character, ICD group) — the "3 hits or 2.5s, whichever first, each resetting both counters" rule from `icd.md` §"What ICD is". ⚠️ Read that section rather than reimplementing from memory; the interaction between the two counters has a documented worked example that is easy to get subtly wrong.
3. **Per-ability ICD-group tagging in the data.** gcsim's `icd_groups_gen.go` is the table. `noICD` already covers the "applies every hit" exception and has a documented authoring rule in `icd.md` (⛔ "leave the field off" when standard — don't mass-annotate the default).
4. **Then wire normals into the reaction stream.** `emitReactionsAtCast` already exists and is called from exactly two sites, both E/Q. The normal loop in `notationParser.ts` has both the element (`nElement`) and each swing's time (`localCursor`) in hand.

---

## The separate, smaller thing that is NOT in this round

**`infuse` EFFECTS are unwired** — a different mechanism from `NormalAbility.infusion`, and the parser reads none of the five:

| character | effect                              | target   |
| --------- | ----------------------------------- | -------- |
| Bennett   | Fire Ventures With Me → pyro        | `active` |
| Candace   | Sacred Rite: Wagtail's Tide → hydro | `active` |
| Dori      | Sprinkling Weight → electro         | `self`   |
| Kazuha    | Crimson Momiji → anemo              | `self`   |
| Lohen     | Unforeseen Strike → cryo            | `self`   |

The two `active` ones are the interesting case: an infusion granted **to whoever is on field**, which means tracking an infusion window per receiver rather than reading a field off the active normal ability. Worth doing after normals react — until then it changes nothing observable.

---

## Ordering, stated plainly

⛔ **Do not wire normals into reactions before ICD exists.** It ships a chart that over-counts reactions on every normal string, and it would look like a feature rather than a regression.
