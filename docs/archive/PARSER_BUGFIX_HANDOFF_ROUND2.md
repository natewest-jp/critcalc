# Parser Bugfix Handoff — Round 2

**Author:** Opus 4.7 session, 2026-04-22
**Supersedes:** execution plan in `docs/archive/PARSER_BUGFIX_HANDOFF.md` (original)
**Audience:** future session picking up `parser-bugfix` branch cold

---

## 1. What's closed

Three PRs already on the branch (off `main`):

| Commit                                                                   | Scope                                                      |
| ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `63ee6e9` fix: persist tabLoadout changes                                | Bug #2 — auto-persist $effect now spreads `tabLoadout`     |
| `d6a8eae` chore: add vitest                                              | Infra — `npm test`, `src/lib/utils/notationParser.test.ts` |
| `f97842e` fix(parser): charge queue proc slot + variant modifiers        | Bugs #1 + #3 + regression tests                            |
| `ea69f12` refactor(types): collapse cdReset.ability with trigger.ability | Bugs #4 + #7 + Decision A (4 sac weapon JSONs updated)     |

`npm test` → 4/4 passing. `npm run check` → 0 errors.

**Semantic change curators must know:** variant modifier arrays **replace** (not compose with) the base ability's arrays. Applies to `cooldownModifiers`, `durationModifiers`, `chargeModifiers`. If a variant omits the array, the base's applies; if the variant has one, base's is ignored.

---

## 2. Decision needed before more work — Bug #5 (infuse Effect branch)

Original handoff diagnosed `type: "infuse"` as a dead Effect union branch. That's **code-accurate but misses live JSON curation**:

- `bennett.json:244` — C6 pyro infusion effect
- `kaedehara_kazuha.json:115, :191, :298` — swirl infusion effects

These are semantically meaningful curated data; no runtime consumer exists yet, but the JSONs express real game mechanics.

**Two paths:**

1. **Revive the branch.** Add `"infuse"` to `EffectBase.type` literal union (`ability.ts:246`). JSONs become type-valid. No consumer code required immediately — curation stays intact for a future pass that actually wires it.
2. **Strip the JSONs.** Delete the branch + delete the 4 infuse effect entries from Bennett/Kazuha JSONs. Cleaner types, loses curation work.

Recommend path 1 (cheaper, preserves curation). Needs user call before committing.

---

## 3. PR 4 — Bug #6 / Decision C (required timing fields)

### Scope

- Make `cooldown` required on `abilityType: "skill" | "burst"` abilities.
- Make `duration` required on `type: "persistent"` abilities.
- `frames.swap` is already required in the `FrameMap` type (`ability.ts:361`).
- Remove defensive fallbacks in parser:
  - `notationParser.ts` — `?? 0` fallbacks on cooldown/duration in `resolveAbilityTiming` (~lines 306-310 after PR 3).
  - `notationParser.ts` — `?? fallbackS` in `resolveEQCastTime` only if we're comfortable requiring frames (we are — swap is already required).

### Implementation options for "required cooldown"

`Ability` is a flat type covering all `abilityType` values (normal/skill/burst/charged/plunge/passive/constellation). Making `cooldown` unconditionally required would break normals/passives/constellations that don't need one.

**Option A — discriminated union by `abilityType`.** Cleanest, but widest blast radius. Every consumer that reads `ability.cooldown` has to narrow.

**Option B — keep the field optional in the type, enforce via a runtime check + vitest lint.** Add a test that walks all 10 curated JSONs and asserts skill/burst have cooldown, persistent have duration. Type stays permissive; test acts as the tripwire. Less ambitious but catches the bug class the handoff cares about.

**Recommendation:** start with Option B (low-risk, high signal). Revisit Option A after the next wave of character curation.

### Audit list (run grep/read against these)

Curated characters with E/Q: ganyu, bennett, xingqiu, fischl, cyno, zhongli, kazuha (kaedehara_kazuha), yelan, raiden (raiden_shogun), furina. Every one should have `cooldown` on skill + burst, and `duration` on persistent abilities. Spot-check for `?? 0` landmines.

### Tests to add

1. Curation lint: iterate `import.meta.glob` over characters, assert required fields. One test file or one new block in `notationParser.test.ts`.
2. Regression test that a missing cooldown surfaces loudly (either type-error under Option A, or lint-fail under Option B).

---

## 4. How to resume cold

1. **Confirm branch state:** `git log --oneline -8` should show the four commits above, plus the original `df87271` handoff-doc commit.
2. **Re-read this doc, then `docs/archive/PARSER_BUGFIX_HANDOFF.md` section 7 for orientation.** Section 8's "unsure" list still partially applies for PR 4.
3. **Ask user about Bug #5 path** before touching `ability.ts:329-332` or infuse JSON entries.
4. **PR 4 plan:** pick Option A vs B, do audit, implement, add tests, `npm run check && npm test`, commit.
5. **After PR 4 merges**, archive the `project_parser_bugfix_status.md` memory and fold the "variant replaces base" semantic into `docs/rounds/parser-architecture.md` or `docs/rounds/curation-plan.md`.

---

## 5. File manifest (unchanged from original)

Primary surfaces for PR 4:

- `src/lib/types/ability.ts` — required-field decisions
- `src/lib/utils/notationParser.ts` — fallback removal
- `src/lib/data/characters/*.json` — audit target (10 curated)
- `src/lib/utils/notationParser.test.ts` — add curation lint test(s)
