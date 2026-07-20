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

| Attack-class-scoped crit stats (chargeCritDmg etc.) | arataki_itto C6 (+70% CRIT DMG on CAs — only global/per-element crit stats exist) | A7b pilot discovery |

| Item                                                                                                              | Blocked caveats                                                                  | Notes                                               |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------- |
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

## Render-surface wiring

- **`canonicalAssumption.caveat` renderer**: 6 authored strings (nahida ×3,
  skirk ×3) render nowhere — the `ability.ts` JSDoc claiming panel rendering
  is stale. Wire into BuffTooltip or the NOTES panel. Nahida's A1 cA carries a
  real accuracy warning (global CR over-render) that users currently never see
  — flagged for promotion to ability-level caveat if wiring stays deferred.

## A7b candidate sweep

Done (Wave 9): see `a7b-candidates.md` in this directory — 36 zero-caveat
characters / 85 abilities whose `_curatorNotes` contain divergence keywords.
A7b is a future audit with full verification treatment; not part of A7.
