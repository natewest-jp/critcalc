# A7 Follow-up Queue (engine-level + decisions)

Harvested from the A7 caveat audit (2026-07-19/20). Every item below has a
conservative rewrite already shipped on its caveat, so nothing here blocks
anything — these are improvements that would make caveats deletable.

## Executed in Wave 8 (done)

- ✅ **lohen** burst +1.65s in-stance extension — authored via
  `durationExtensions` (kit-text-sourced; no gcsim for lohen).
- ✅ **escoffier C1** team gate — `teamElementCount(hydro+cryo) >= 3`
  (exclude-self; gcsim-equivalence proven). Caveat deleted.

## Needs Nate's call

- ✅ **ifa** skill `cooldownStartDelay` — DECIDED (Nate, 2026-07-20, option A)
  and authored: `cooldownStartDelay: 600` starts the CD at the drawn stance
  end (internally consistent with the fixed-10s hover bar); caveat now states
  the full-hover assumption and the early-exit direction.

## Engine-level (each would obviate a caveat class)

**PLANNED (Nate, 2026-07-20):** ① stance-window coupling — one buffWindows
change covering both the zibai-C1 clip case and the lohen extension-ride
case (rows below); ② the CD-modification engine pass — cooldownReduce
(raiden C6, arlecchino C4, gorou C2, navia C1) folded together with the
deferred SIMULATE weapon-CD queue (Impetuous Winds, Chongyun). The rest of
the table stays queued, unscheduled.

| Item                                                                                                              | Blocked caveats                                                                  | Notes                                               |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------- |
| Attack-class-scoped crit stats (chargeCritDmg etc.)                                                               | arataki_itto C6 (+70% CRIT DMG on CAs — only global/per-element stats exist)     | A7b pilot discovery                                 |
| Stance-clipped buff windows: truncate `inStance`-gated onCast buffs when the stance ends early (terminatesOnSwap) | zibai C1 (probe-validated: buff bar outlasts mode bar on `Zibai E > Bennett N3`) | New discovery this run                              |
| Enemy-death trigger (onTargetDied or similar)                                                                     | hu_tao C4                                                                        | Manual-trigger workaround shipped                   |
| `cooldownReduce` parser implementation                                                                            | raiden C6 (+ Arlecchino C4, Gorou C2, Navia C1 per CANNOT list)                  | The canonical schema-only trap                      |
| Periodic/interval grant trigger                                                                                   | cyno A1 (Endseer procs)                                                          | Also on the P4 open list (Brilliance 1-seal/sec)    |
| Summon non-tick effect triggers (`Summon.effects[]`, P3)                                                          | albedo skill (blossoms), dehya skill (coordinated attacks)                       |                                                     |
| perTeamCount on resShred values + non-linear tier mapping                                                         | escoffier A4 (5/10/15/55)                                                        | teamElementCount union counting already expressible |
| Per-abilityName-filtered buff routing                                                                             | nahida A1 cA (Tri-Karma-only CR; Ayato C1 same gap)                              |                                                     |
| decaying×perStack composition + constellation-conditional decay removal                                           | mavuika A4/C4                                                                    | Queued v2 buff-value work                           |
| Chain-state selection for in-stance recasts (WS1→WS2→WS3) + state-gated token rejection                           | nilou skill                                                                      | Deferred parser/state work                          |
| Multi-state primitive (P1) for recast/ring toggles                                                                | mavuika skill                                                                    | Pre-existing deferral, reconfirmed                  |
| Effect windows riding stance extensions (fixed-duration infuse outlives extended stance)                          | lohen skill residual                                                             | New discovery from Wave 8 authoring                 |

## Render-surface wiring — ✅ RESOLVED 2026-07-20

- ✅ **Constellation passive-trigger bonuses** now list in the Always-on
  caption (TeamBonusesBlock walks constellations gated on the slot con
  level, scoped to buff/resShred effects — shield/heal/elevate passives
  stay unlisted). The optimistic-render caveat sweep shipped with it:
  diluc C1, eula C4, kaeya C1, ayato C1, razor C2, xiao C4, yanfei C2
  (kaeya C4 excluded by the effect-type filter — still renders nowhere,
  so no caveat). mona-C4 duration-less-manual lint candidate still open.
- ✅ **canonicalAssumption**: RETIRED (Nate option a, 2026-07-20) — 6 uses
  folded into 4 ability-level caveats (nahida x2 incl. the Tri-Karma CR
  warning, skirk x2); type/lint/display path removed; a retired-field lint
  guards regressions.

## A7b candidate sweep

Done (Wave 9): see `a7b-candidates.md` in this directory — 36 zero-caveat
characters / 85 abilities whose `_curatorNotes` contain divergence keywords.
A7b is a future audit with full verification treatment; not part of A7.

## Notes carried over from Claude's working memory (2026-10-29)

From `docs/curation/caveat-pass/followups.md`, the outcome of the passes this queue came from:

- **A7** (2026-07-20): all 151 caveats across 66 characters audited and adversarially verified, then applied: 138 rewrites (average about 300 → 170 characters), 8 deletes (all field-verified), 2 keeps. Merged `e95d72a`, with the Ifa `cooldownStartDelay` decision executed in `12f0661`.
- **A7b** (missing-caveat audit, 2026-07-20): 36 zero-caveat characters and 85 candidates gave 10 new caveats and 7 effects authored instead of caveats (Nate's implement-first doctrine), the rest no caveat.
- **Render-surface session**: merged `8ca144e` (canonicalAssumption retired, constellation always-on bonuses listed in the planner caption).
- Process lessons that worked for a corpus-wide pass: a pilot wave and Nate's style sign-off before the bulk; each wave's proposals committed before verification, so an interrupted session loses at most one audit step; the compression-only rule with `claimsLost` accounting; a full review of every delete; style lessons folded into the guide between waves.
- `scripts/caveat-apply.mjs` is a format-preserving JSON editor (jsonc-parser CST edits plus a deep-equal net). A full-file `JSON.stringify` → Prettier round-trip is not byte-stable, because Prettier preserves hand-inlined objects.
