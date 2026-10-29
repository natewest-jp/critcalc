# Weapon and artifact loadout: type and data plan (2026-05)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

## Status (2026-05-09)

**Type system** — all in [`ability.ts`](src/lib/types/ability.ts):

- `onSwapOut` / `onSwapIn` triggers (split from `onSwap` 2026-04-19): `onSwapOut` fires when holder leaves and buffs the incoming character; `onSwapIn` fires when holder enters and buffs themselves.
- `onStack`, `passive` triggers; `procCooldown: number | ScaledValue` on `EffectBase`; `resShred` effect type; `source: "character" | "weapon" | "artifact"` on buff effects.
- `cdReset` effect type (Sacrificial series); since 2026-05-09 the schema also accepts `cdReset.source: "character"` and a separate `cooldownReduce` effect type. See [project_schema_model_mismatch.md](schema-model-mismatch.md) and `notationParser.ts` for how character cdResets thread through (Kazuha C1 — Q resets E).
- Stat additions during this work: `skillDmgBonus` / `burstDmgBonus`; `EffectTarget: "teamExcludingSelf"`; `Trigger: "afterDuration"`; `BuffValue: { type: "unknown"; description }`; `Ability.infusion?: Element`.

**Display naming (`shortName` nicknames, 2026-07-15):** Weapons + artifact sets carry an optional `shortName` (community nickname). Split: **selection menus show the full `name`** (`CharacterSelector.svelte` dropdown items use `name` — unambiguous when picking); **compact/external display uses `shortName ?? name`** (timeline labels + weaponProcRows/teamBuffRows/charReceivedBuffRows). Populated: Sac Sword/Greatsword/Bow/Fragments, Widsith, TTDS; Deepwood, Maiden, Noblesse, Silken Moon, Tenacity, VV (Instructor skipped — nickname == name). New weapons/artifacts: set `shortName` only when a real community shorthand exists; falls back to `name`. This is deliberately NOT the character `name`/`displayName` pattern (that uses the short form in menus too). `artifacts_index.json` is dead (nothing reads it — live source is `data/artifacts/*.json`).

**Curated weapon list (final, per user review 2026-04-18):**

| Weapon                 | Type        | Mechanism                        | Status  |
| ---------------------- | ----------- | -------------------------------- | ------- |
| TTDS                   | Catalyst 3★ | onSwapOut → buffs incoming char  | ✅ Done |
| Sacrificial Sword      | Sword 4★    | cdReset on E                     | ✅ Done |
| Sacrificial Bow        | Bow 4★      | cdReset on E                     | ✅ Done |
| Sacrificial Greatsword | Claymore 4★ | cdReset on E                     | ✅ Done |
| Sacrificial Fragments  | Catalyst 4★ | cdReset on E                     | ✅ Done |
| The Widsith            | Catalyst 4★ | onSwapIn → 3 effects, ICD-merged | ✅ Done |

**All other weapons skipped** (settled 2026-04-19). Elegy, Freedom-Sworn, PJWS, etc. all use `onHit` / `onStack` triggers that need multi-hit + off-field tick simulation — not feasible accurately. Add more only on explicit user request.

**No polearm weapons exist** in the curated set. `LoadoutDropdown` exposes `disabled` + `title` props; polearm characters get `disabled={true}` with native title "No polearm-type weapons available".

**Artifact 4pc effects** — fully wired:

- 7 sets authored (see [project_artifact_curation_plan.md](artifact-curation-plan.md) for the list and per-set notes).
- `computeTeamBuffRows` reads artifact 4pc `onCast` effects from `effectiveLoadout`. Two artifact `onCast` buffs already wired in the team buffs row (Noblesse Oblige, Maiden Beloved).

**`cdReset` model (Sacrificial series) — final implementation:**

- Proc fires at hitmark (`hitTime = localCursor + eCast`), not onCast.
- Proc ICD (30/26/22/19/16s by R1–R5) starts at `hitTime`.
- Parser: `queue[0] = hitTime` resets the E charge, `sacProcFired = true` on the bar, ICD window in `weaponProcBars`.
- E bar for the proc cast: rendered as Phase 2 (0.65 opacity, inset border glow) spanning duration only.

**Char buff row architecture (final):**

Two bar types in each character's 16px buff row (`CHAR_BUFF_ROW_H`):

1. **Sac proc ICD** (`weaponProcRows` from `rotation.weaponProcBars`): amber `rp-weapon-proc-bar`, on the **wielder's** row, labelled `"[Weapon] trigger CD"`.
2. **Received weapon buffs** (`charReceivedBuffRows` derived in component): blue `rp-team-buff-bar` with stat icon, on the **receiving** character's row. Computed by iterating `rotation.tracks` in order, detecting `onSwapOut` / `onSwapIn` weapon effects, enforcing proc ICD, and keying bars to the receiver.

`onSwap*` proc ICD enforced per `"charId::weaponId::onSwap*"` key within `charReceivedBuffRows`.

## Still pending

- **More weapons** — only on explicit user request (scope is final per 2026-04-19 review).

## resShred renderer — shipped 2026-05-11

Renders `resShred` effects as red-tinted "debuff" bars in the team-buffs row. Reuses the existing `${element}Res` icon/label registry (anemoRes, cryoRes, etc.) — no new stat keys. resShreds without an `element` field render under `allElementalRes` (Itto Q, VV swirl).

Dispatch sites (mirror the buff dispatch pipeline): character `onCast` (Itto Q, Beidou Q, Jean Q, Nefer skill, Zhongli E), character `onHit` cast-class (Escoffier skill, Kinich skill, Rosaria burst, Venti skill+burst, Nilou skill elemental), character `onHit` N/CA/P-class (none authored), character `afterDuration` (Chongyun skill), character `onReaction` (Chevreuse overload, Citlali melt+frozen, Durin overload, Nilou bloom), artifact 4pc `onReaction` (VV swirl).

`manual`-trigger resShreds (Deepwood, Emilie, Lyney, Navia, Sigewinne, Xiangling, Xinyan) NOT rendered — they need a different "permanent uptime / chip" treatment (no fire-time event in notation). Defer.

Side win: extending the renderer to handle character `onReaction` for resShred also unblocked character `onReaction` BUFF dispatch in the same pass — Kazuha A4, Sucrose A4, Baizhu, Tighnari, Fischl, Freminet, Varka now render their swirl/reaction-triggered EM buffs.

Visual: `.rp-team-debuff-bar` class on the same `.rp-team-buff-bar` element. Background `#3a1c20`, border `#7a3c44`, left `#c06464`, label `#d09098`. Geometry identical to buff bars; tint communicates "applies to enemy" at a glance.

## Resolved decisions to remember

- Widsith: 3 effects in JSON (`atk%`, `allDmgBonus`, `em`), all `onSwapIn`, duration 10s, procCooldown 30s. ICD logic naturally shows `atk%` as representative (first effect consumes ICD); Aria + Interlude sit in JSON for future tooltip enumeration. Snapshottable: `atk%` true, others false.
- Elegy / Freedom-Sworn / PJWS: dropped. `onHit`/`onStack` can't be accurately timed without multi-hit + off-field simulation.
- Refinement picker (R1–R5 buttons): renders in label column when a weapon is selected.
- Weapon images via `weaponImagePath()` in [`weaponLookup.ts`](src/lib/data/weaponLookup.ts), files in `/static/assets/weapons/`.
