# Radiance gates against the Polestar Field (2026-11-09)

Branch `fix/radiance-gates`. Cyno's and Diona's Radiance: Stellar-Conduct clauses rode `teamEnablesReaction`, which is true for any party with an enabler. gcsim gates them on standing in a field.

## 1. What each clause asks (gcsim)

| Clause                                           | gcsim                                                         | Authored as                              |
| ------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------- |
| Cyno C1, Together We Rise +200 EM                | `isStellarRadiance()` once, on entering Pactsworn             | Entry test at the burst, `inPolestarField` |
| Cyno C2, +80% Stellar-Conduct DMG                | The hitter holds Together We Rise                             | The same entry test                      |
| Cyno C4, 20 Energy                               | The reacting teammate holds Together We Rise                  | Unchanged, no planner surface            |
| Diona C6, Superconduct and Stellar-Conduct +40%  | `getRadiance()` every 30f across the burst, 120f per grant    | `whilePolestarField`                     |

An entry test would have been wrong for Diona: a field usually opens after her burst lands, so it would erase the ordinary opener. A clip would have been wrong for Cyno: Together We Rise outlives the field and follows the swap.

## 2. Engine

- The per-event buff passes now answer `inPolestarField` at the event's instant, beside the holder's states (`statesAt` in `buffWindows.ts`). The stateless pool prefilters still get null and keep the effect.
- `whilePolestarField` on an effect intersects its window with the field's spans, in the same last pass as `whileState`. Lint: a buff-like effect with a `duration`.

Tests are in `buffWindows.test.ts` § Radiance: Stellar-Conduct against the Polestar Field. The earlier "an enabler of both draws all four" case changed on purpose: with no Stellar-Conduct in the rotation, the two Conduct lines no longer draw.

## 3. Left as it is

- Diona's bar ends with the field. gcsim's 120f per grant can run up to 2s past it, and the kit describes a state held while inside.
- Diona's Stellar Swirl branch keeps its standing gate. gcsim gives Conduct precedence and bounds Swirl to its 8s window, so a party with both still draws both.
- Together We Rise from the skill-opened Pactsworn stays omitted (`revelation-gcsim-2026-11-06.md` §3).
- gcsim's field lasts 6s (`sscFieldDur`) and its in-field status runs to about 8s when not refreshed. Fandom says 7s and the planner follows it, so both gates inherit that 7s.

## 4. Open

- Mitya's party still draws the Prism. gcsim has no Mitya and no source states whether "1 every 1.5s for 3s" makes two Beacons or three, so the span is unsettled.
- Cyno C1's caveat needs new wording, held as a proposal.
