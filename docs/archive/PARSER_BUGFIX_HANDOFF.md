# Parser / Editor / Loadout Bugfix Handoff

**Author:** Opus 4.7 review session, 2026-04-22
**Audience:** future Opus session (me) picking this work up cold
**Status:** diagnosis complete, no code changed yet

---

## 1. Context and posture

- **critcalc.app** is a pre-deployment Genshin Impact tooling site (SvelteKit + TS). Rotation Planner is the active tool.
- The codebase has been co-built with Sonnet 4.6. Sonnet's output is good but shows recurring patterns of shallow error-handling, silent-fallback idioms (`?? 0`, `as any` casts, `??` on required fields), and state-mutation bugs that pass type-check but misbehave at runtime. The tokenizer `re.lastIndex` infinite-loop (commit `56d0978`) is the canonical example.
- **We have full ownership.** Project is local-only; no external users. Breaking changes to types, JSON shape, or parser contract are fair game if they make the code correct or the model cleaner.
- **Goal of this work:** harden parser/tokenizer/loadout integration before deployment, removing silent-wrong-output footguns.

---

## 2. Architecture quick-reference

| Concern                                  | File                                               | Notes                                                                                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Notation → timeline data                 | `src/lib/utils/notationParser.ts`                  | Pure function. Per-call Maps for state. Called via `$derived` in Timeline. Wrapped in try/catch at the call site so parser exceptions degrade silently.                                  |
| Tokenizer                                | `src/lib/utils/tokenizer.ts`                       | Shared by parser and editor highlighting. Module-level regex `CONCAT_SPLIT_RE` with `g` flag — footgun history.                                                                          |
| CodeMirror editor plugin                 | `src/lib/utils/notationEditorExtension.ts`         | Highlight + autocomplete + paste normalization.                                                                                                                                          |
| Types (Ability / Effect / Condition)     | `src/lib/types/ability.ts`                         | Discriminated unions. Has a dead `type: "infuse"` Effect branch. `AbilityVariant = Omit<Partial<Ability>, "variants"> & { label }` — can carry all modifier arrays.                      |
| Rotation page (tabs, save bank, loadout) | `src/routes/(tools)/rotation-planner/+page.svelte` | Two-layer loadout: `$loadout` (character defaults, per-character localStorage) + `tabLoadout` (per-tab override, serialized into tabs localStorage). Also `+page.ts` sets `ssr = false`. |
| Timeline renderer / buff computation     | `src/lib/components/RotationTimeline.svelte`       | ~2500 lines. Calls `parseNotation`, computes team/self/active-target/weapon buff rows, renders Gantt bars.                                                                               |
| Character panel                          | `src/lib/components/RotationCharacterPanel.svelte` | Reads ability table; spreads variants via `{ ...base, ...variant }`.                                                                                                                     |
| Shared stores                            | `src/lib/stores.ts`                                | `$constellations`, `$loadout`, `$savedNotations`, `$siteSettings`. All localStorage-backed. `loadout.setWeapon(id, undefined, undefined)` leaves stub entries.                           |
| Weapon data                              | `src/lib/data/weapons/*.json` + `weaponLookup.ts`  | Currently one weapon: `sacrificial_bow.json`.                                                                                                                                            |
| Character data                           | `src/lib/data/characters/*.json`                   | 140+ characters. ~10 hand-curated with effect data (Ganyu, Bennett, Xingqiu, Fischl, Cyno, Zhongli, Kazuha, Yelan, Raiden, Furina).                                                      |

### How a parse runs, end-to-end

1. User types in CodeMirror → `notationEditorExtension.ts` updateListener fires `onChange(value)` → `notation` state in `+page.svelte` updates.
2. `RotationTimeline.svelte`'s `$derived` block re-runs `parseNotation(notation, lookupChar, swapFrames, $constellations, effectiveLoadout)`.
3. `parseNotation` tokenizes, splits by `>` into segments, iterates tokens per segment maintaining per-character state Maps (`eChargeQueues`, `qReadyAt`, `sacProcReadyAt`, `weaponProcBars`, `stanceWindows`, `stanceExtensionCounts`, `stanceQBarRefs`).
4. Returns `ParsedRotation { tracks, totalDuration, unknownTokens, weaponProcBars }`.
5. Timeline component derives `teamBuffRows`, `weaponProcRows`, `charReceivedBuffRows`, `nbBars`, `moonsignRows`, `totalDuration`, etc., and renders the DOM.

---

## 3. Bug inventory (ordered by severity)

### P0 — triggerable with shipped data

#### Bug #1 — Sacrificial proc corrupts wrong charge slot

- **File:** `src/lib/utils/notationParser.ts` lines 580–599
- **Trigger:** C2 Ganyu + Sacrificial Bow. Ganyu's base E has `"charges": 1`; `chargeModifiers` adds `+1` at C2 (see `ganyu.json:71-81`). Sacrificial Bow passive `ability: "skill"` fires in `getWeaponCdResetCooldown` (line 391).
- **What's broken:** After consuming a charge we do `queue[0] = localCursor + cd` (line 580), then `queue.sort()` (line 581). After the sort, `queue[0]` is the _earliest-ready_ slot — which may be a different charge than the one we just consumed. The sac-proc block then does `queue[0] = hitTime` (line 591), resetting the wrong charge's cooldown.
- **Why it matters:** Queue misbehaves silently. With both charges ready, casting E + Sac proc yields `[5.5, 15.17]` when it should yield `[ready, 5.5]`. The rendered bar uses `bar.sacProcFired` so the single cast looks right; the bug hits the _next_ E cast's start time.
- **Fix sketch:**
  ```ts
  const consumedReadyAt = localCursor + (activeE.cooldownStartDelay ?? 0) / 60 + eCd;
  // ...sac-proc block, which may overwrite consumedReadyAt with hitTime
  let finalReadyAt = consumedReadyAt;
  if (sacCd !== null && hitTime >= procReady) {
  	finalReadyAt = hitTime;
  	/* ICD bookkeeping + weaponProcBars push + mark bar.sacProcFired */
  }
  queue[0] = finalReadyAt;
  queue.sort((a, b) => a - b);
  ```
- **Regression test:** notation `Ganyu E E > Xiangling Q` at C2 with Sac Bow equipped. Assert `track.eBars[1].start < 10` (proc fired → second E cast is not 10s out). Also `Ganyu E ~5s E` with both charges ready: assert the second E starts at 5s, not pushed to 10s.
- **Severity:** HIGH. Silent wrong timing on any multi-charge Sac setup.

#### Bug #2 — `tabLoadout` not persisted to localStorage

- **File:** `src/routes/(tools)/rotation-planner/+page.svelte` lines 80–86
- **Trigger:** User changes a weapon via LoadoutDropdown, then reloads before switching/closing/adding a tab.
- **What's broken:** The auto-persist `$effect`:
  ```ts
  const snapshot = tabs.map((t) => (t.id === activeTabId ? { ...t, notation, manualSlots } : t));
  ```
  doesn't read `tabLoadout`, so doesn't re-run when it changes. Even when the effect _does_ run (on notation edit), it spreads the stale `t.tabLoadout` from the tabs array — the live `tabLoadout` state is ignored.
- **Fix:** add `tabLoadout` to the snapshot spread:
  ```ts
  t.id === activeTabId ? { ...t, notation, manualSlots, tabLoadout } : t;
  ```
  The `$effect` dependency on `tabLoadout` is picked up automatically from reading it in the effect body.
- **Regression test:** manual. Set Ganyu's weapon, hard-refresh, verify weapon persisted.
- **Severity:** MEDIUM-HIGH (user-visible data loss, shipped code).

### P1 — latent, primed by curated data

#### Bug #3 — Variant-level modifiers silently dropped

- **Files:** `src/lib/utils/notationParser.ts` lines 299–302 (`resolveAbilityTiming`) and line 175 (`resolveEffectiveCharges`)
- **Trigger:** Kazuha's `Hold` variant carries `cooldownModifiers` (verified in `kaedehara_kazuha.json` — Chihayaburu variant has the C1 `-10%` modifier). Currently it's a duplicate of the base modifier so output is correct _by coincidence_. Any curator who adds a variant-only modifier, or who removes the modifier from the base expecting the variant copy to cover it, gets silent wrong output.
- **What's broken:** `resolveAbilityTiming` uses `variant?.cooldown ?? ability.cooldown` as the base value, then applies `ability.cooldownModifiers` (not variant's). Same shape for duration. `resolveEffectiveCharges` doesn't even accept a variant arg.
- **Fix sketch:**
  ```ts
  function resolveAbilityTiming(ability, tokenText, states, cLevel) {
  	const variant = ability.variants?.find((v) => v.input?.includes(tokenText));
  	const cooldown = applyModifiers(
  		variant?.cooldown ?? ability.cooldown ?? 0,
  		variant?.cooldownModifiers ?? ability.cooldownModifiers,
  		DEFAULT_ASCENSION,
  		states,
  		cLevel
  	);
  	// same for duration
  }
  ```
  Decide semantics: **replace, not compose.** Matches the "variant overrides" mental model and avoids double-applying C1. Document in the `AbilityVariant` type comment.
- **Also update:** `resolveEffectiveCharges` should accept the resolved ability (post-variant merge) or take explicit variant param. Currently called with `activeE` so passing through variant lookup is the cleanest extension.
- **Regression test:** synthetic character JSON in a test fixture with a hold variant that has a distinct cooldown modifier; assert hold CD differs.
- **Severity:** HIGH (landmine primed), but data-conditional so no live mis-output today.

#### Bug #4 — `(e as any).ability` cast hides schema divergence

- **File:** `src/lib/utils/notationParser.ts` line 391, in `getWeaponCdResetCooldown`
- **Current code:** `weapon.passive.effects.find((e) => e.type === 'cdReset' && (e as any).ability === 'skill')`
- **Why it matters:** `Effect` with `type: "cdReset"` has a typed `ability: 'skill' | 'burst'` (see `ability.ts:337`). The `as any` cast defeats type narrowing. Also: `sacrificial_bow.json` has _two_ `ability` fields — one at the effect root (line 14) and one inside `trigger` (line 13). If a future curator moves it or renames it, this silently stops firing.
- **Fix:**
  ```ts
  const effect = weapon.passive.effects.find(
  	(e): e is Extract<Effect, { type: 'cdReset' }> => e.type === 'cdReset' && e.ability === 'skill'
  );
  ```
  Normalize the Sac JSON: drop `trigger.ability` (redundant) OR drop the top-level `ability` (it's implied by the trigger). Pick one and update the type + JSON together. I lean toward keeping `trigger.ability` since it's the semantic "what triggers this" and reading the root `ability` at parse time is a schema quirk.
- **Severity:** MEDIUM (silent break on schema change).

#### Bug #5 — Dead `type: "infuse"` branch in Effect union

- **File:** `src/lib/types/ability.ts` lines 329–332
- **Status:** Confirmed dead. Infusion is represented via `Ability.infusion?: Element` (see `cyno.json:51` `"infusion": "electro"` on Pactsworn Pathclearer). The union branch is structurally unreachable because `"infuse"` isn't in `EffectBase.type`'s literal union (line 246).
- **Fix:** delete lines 329–332. Grep first: `grep -rn '"infuse"' src/` to confirm no stragglers.
- **Severity:** cosmetic, but worth doing in the types-hardening pass.

### P2 — defensive hardening

#### Bug #6 — `?? 0` silently substitutes for missing cooldown/duration

- **File:** `src/lib/utils/notationParser.ts` lines 300–301
- **Symptom:** Ability JSON missing `cooldown` → `applyModifiers(undefined ?? 0, ...)` → CD of 0 → instantly recastable Q. No warning. Same for duration on persistent abilities → `duringSummon` state never resolves true.
- **Fix options:**
  - (a) Fail-loud: throw with ability id if `abilityType === 'skill' | 'burst'` and no cooldown. Parser's try/catch swallows, but `console.error` surfaces to devtools.
  - (b) Sentinel: substitute a visible-wrong value (e.g. `999`) so the timeline overflows and the issue is obvious.
  - (c) Make the field required in the type. Aggressive but aligns with "ownership" posture.
- **Recommendation:** (c) for E/Q abilities, (a) as backup for the parser-facing case. Let TypeScript + curation process be the first line of defense.

#### Bug #7 — `evalCondition` default branch is unreachable-but-permissive

- **File:** `src/lib/utils/notationParser.ts` line 148
- **Fix:** `default: { const _: never = cond; return null; }` — turns "new Condition variant added without updating parser" from silent `null` into a compile error.

### Watchlist — not fixing now but logged

- `resolveActiveAbility` returns first match among conditioned abilities — no tie-break (`notationParser.ts:323`). No conflict in current data; re-check when any character ships with overlapping state conditions.
- `getWeaponCdResetCooldown` only handles `ability: "skill"` and first matching effect (`notationParser.ts:384`). No weapon needs burst or multiple effects today.
- `FrameMap.swap` is required by type (`ability.ts:361`) but `resolveEQCastTime` defends with `?? fallbackS` (`notationParser.ts:245`). Pick one: drop the defense or drop the requirement. Curation audit first: `grep -L '"swap"' src/lib/data/characters/*.json` would catch any missing.
- `splitConcatenated`'s module-level `CONCAT_SPLIT_RE` — same class as the tokenizer footgun fixed in `56d0978`. Currently safe because `lastIndex = 0` is reset at entry, but if the regex ever leaks into a non-loop call it breaks. Consider constructing per-call (cheap) or dropping the `g` flag in favor of `matchAll`.
- `RotationCharacterPanel.svelte:159-170` — variant rows inherit base effects via spread. May misrepresent tap-vs-hold buff differences in future data.

---

## 4. Structural/"ownership" decisions to make

These are _not_ bugs but decisions that, if made now, prevent a class of future bugs.

### Decision A — Collapse `Effect.cdReset.ability` with `Trigger.onCast.ability`

Two overlapping fields. Pick one. My recommendation: keep `trigger.ability`, drop top-level `cdReset.ability`. Rationale: triggers already encode "when does this fire" and "fires on skill cast" is the semantic meaning. Update `sacrificial_bow.json` + `ability.ts` + parser.

### Decision B — `variants[]` vs separate-ability-with-`conditions`

Two patterns coexist:

- **Kazuha / Bennett / Ayato** use `ability.variants[]` for tap/hold variants of the same skill.
- **Cyno** uses two separate `Ability` entries with `conditions: { type: "state", state: "inStance" }` for base vs in-stance skill.

The parser handles both via `resolveActiveAbility` (for the Cyno pattern) and variant input matching (for the Kazuha pattern). But variant modifiers don't work (Bug #3) and the mental model is split.

**Option 1 (conservative):** Fix Bug #3 so variants fully work, document "use variants[] for same-cast-different-frames, use separate abilities for state-gated behavior."

**Option 2 (restructure):** Unify on the separate-abilities model. Variants become syntactic sugar expanded at load time into separate `Ability` entries. Eliminates the `variant?.cooldown ?? ability.cooldown` merge logic. Larger blast radius.

**Recommendation:** Option 1 for now. Revisit if a third kind of variant (e.g. stance-_and_-hold) shows up.

### Decision C — Required vs optional on `cooldown` / `duration` / `frames.swap`

Current types have these optional, parser defends with `?? 0` / `?? fallbackS`. Given the ownership stance, push these into required for the ability types that need them (E/Q = cooldown required, persistent = duration required, all = frames.swap required), remove defensive fallbacks, rely on type system.

---

## 5. Execution plan

Work in three PRs (or three commits on one branch) so each concern stays diff-reviewable:

### PR 1 — Parser correctness (Bugs #1, #3)

- One file (`notationParser.ts`), one logical theme (charge/variant math).
- Add a `src/lib/utils/notationParser.test.ts` in the same commit with regression tests for both.
- Use `vitest` (standard SvelteKit setup; verify by running `pnpm test` or `npm test` first — if no test infra exists, setting up vitest is a small prerequisite).
- Tests needed:
  - Ganyu C2 + Sac Bow, two E casts with gap less than full CD → assert second E starts on time.
  - Ganyu C2 no Sac, two E casts → verify charge queue math unchanged (non-regression baseline).
  - Synthetic character with variant `cooldownModifiers` distinct from base → assert variant path uses variant modifiers.

### PR 2 — Loadout persistence (Bug #2)

- One-line fix in `+page.svelte:83`. Manual test only.
- Low risk, ship standalone.

### PR 3 — Types hardening (Bugs #4, #5, #7 + Decision A)

- Delete `infuse` branch from Effect union.
- Remove `(e as any).ability` cast; narrow properly.
- Collapse `cdReset.ability` / `trigger.ability` per Decision A; update sac_bow JSON + parser.
- Add `never` exhaustiveness check to `evalCondition`.
- Run `pnpm check` / `svelte-check` and fix any downstream type errors.

### PR 4 (optional) — Required-field cleanup (Bug #6 + Decision C)

- Make `cooldown` required on skill/burst `Ability`, `duration` required on persistent, `frames.swap` required (already is in type).
- Remove `?? 0` fallbacks.
- Run a pass over all 10 curated character JSONs to catch any gaps.
- Save for last — touches many files, best done after the correctness fixes are in.

---

## 6. Per-task acceptance checklist

Before declaring any bug fixed:

1. **New regression test passes** and was committed in the same change.
2. **Existing parse behavior unchanged** for non-triggering rotations: run the parser against a known-good notation (e.g. `Bennett Q > Kazuha hE P > Xiangling Q E > Fischl E N1 N2 ~2s`) before and after, diff `tracks`. Should be byte-identical for fixes #2, #4, #5, #7. Fix #3 may alter Kazuha Hold bar timing — verify the delta is correct (should be 0 since the duplicated modifier yields same result).
3. **Timeline still renders** — load the dev server, paste a rotation with Ganyu E E, verify visual output.
4. **svelte-check clean** — `pnpm check` (or equivalent) returns no new errors.

---

## 7. How to resume cold

1. **Re-read this doc first.** Every finding has file:line refs so you can jump straight to code.
2. **Verify bug #1 is still present** before fixing — pull up `notationParser.ts:580-599` and confirm the sort-then-overwrite pattern. Quick sanity: `git log -p -- src/lib/utils/notationParser.ts | head -300`.
3. **Check test infra:**
   ```bash
   grep -l vitest package.json
   ls src/lib/**/*.test.ts 2>/dev/null
   ```
   If no test setup: `pnpm add -D vitest @vitest/ui` and a minimal `vitest.config.ts`. SvelteKit docs cover the pattern.
4. **Start with PR 1** — highest value, tightest scope.

---

## 8. Things I'm unsure about (verify before acting)

- Whether any test infrastructure exists. `notationParser` is pure, highly testable — if `vitest` isn't set up, doing so is a small investment with huge payoff for this work.
- Whether `getCharacterByDisplayName` or `getCharacterById` have any case-sensitivity / alias behavior that would affect parser test fixtures. Skim `characterLookup.ts` if authoring synthetic test characters.
- Exact semantics of "variant replaces base modifiers" vs "variant composes with base" — I recommend replace, but confirm with the one real data point we have (Kazuha) doesn't contradict.
- Whether the `$loadout` character-default and `tabLoadout` per-tab merging in `RotationTimeline.svelte:458-465` correctly round-trips through save-bank entries. Tangentially related to Bug #2.

---

## 9. File manifest (open these first in a new session)

- `src/lib/utils/notationParser.ts` — primary surface for Bugs #1, #3, #6, #7
- `src/lib/utils/tokenizer.ts` — watchlist only, no active bugs
- `src/lib/types/ability.ts` — Bugs #5, #7; Decisions A, C
- `src/routes/(tools)/rotation-planner/+page.svelte` — Bug #2
- `src/lib/components/RotationTimeline.svelte` — context for how parser output is consumed
- `src/lib/data/characters/ganyu.json` — Bug #1 live trigger
- `src/lib/data/characters/kaedehara_kazuha.json` — Bug #3 live trigger
- `src/lib/data/weapons/sacrificial_bow.json` — Bug #4 schema reference
- `src/lib/stores.ts` — loadout shape for Bug #2

---

_End of handoff._
