---
paths:
  - 'scripts/**'
---

# Scripts, audits and the gcsim oracle

Budget: about 10,000 characters. Rules in the present tense; history belongs in the round records in `docs/rounds/`.

## The scripts

- Audits are review-candidate generators, never fixers. The writers are `migrate-frames-shape.mjs` and `migrate-application-schema.mjs`. ⚠️ Never run `migrate-application-schema.mjs` corpus-wide.
- `audit-capabilities.mjs --write` diffs derived capabilities against the game-knowledge fixture (`capability-expectations.mjs`) into `docs/curation/capability-audit.md`, the curation backlog.
- `audit-capability-sweep.mjs --write` diffs against Fandom wiki capability categories (snapshot `docs/library/wiki/capability-categories.json`) and Genshin's IT roles into `docs/curation/capability-sweep.md`. Verified-wrong wiki rows are suppressed in `WIKI_KNOWN_WRONG` (`wiki-capability-config.mjs`) with evidence notes. `--mutate id:kind` is a seeded-negative self-test.
- `audit-gcsim-frames.mjs` diffs every FrameMap, summon cadence and cast application against gcsim into `docs/curation/gcsim-frames-diff.md`. `scripts/lib/gcsim-map.mjs` is the one place that says which capture describes which authored map. Per-character prerequisites live in `scripts/gcsim-dump/drivers.json`.
- `audit-genshin-db-diff.mjs` diffs shipped scalars (energy cost, cooldown, identity) against a fresh genshin-db stub. genshin-db cooldowns can be wrong for newer characters: verify against gcsim, and suppress verified rows in `GDB_CD_KNOWN_WRONG`.
- `audit-genshin-db-text.mjs --names` checks corpus names against genshin-db.
- `audit-data-outliers.mjs` is a self-consistency sweep (decimal-form leaks, RES shred sign stored negative, placeholder zeros, magnitude outliers).
- `normalize-talent-levels.mjs` enforces the talent-level-10 convention.
- The network scripts are `fetch-wiki-capabilities.mjs` (MediaWiki API; WebFetch is blocked there) and `fetch-endgame.mjs` (lunaris.moe → `src/lib/data/endgame/stygian.json`, then `build-endgame-art.mjs`). No leaks: a season ships only once `season-dates.json` names it, one hand-added line per patch.
- ⚠️ `scripts/probe-*.mjs` is a retired pattern. `probe-ink-centering.mjs` is the one survivor. Never add another; scratch work goes in `scratch/`.

## The oracle

- The oracle is `scripts/gcsim-dump/main.go`, which links gcsim as a library (a shim Go module generated into gitignored `scratch/`, with `replace` → `~/Code/gcsim`) rather than shelling out. The cancel slice is `action.Info.Frames(next)` and is not in the debug log. Running one ability in an empty core makes application attribution exact. The whole roster takes about 2s.
- Fetch the gcsim checkout first: the oracle audits whatever is checked out. gcsim's `go.mod` needs Go 1.27, and the dumper's `GOPROXY=off` build then reads as "Go not installed", so prime it with `go version` in the clone.
- If the shim build fails with "module lookup disabled" after a gcsim upgrade, run `go mod download` in the clone.
- Characters whose frames come from an unmerged gcsim PR (`meta.framesSource: "gcsim-pr"`) go stale when the PR moves: re-check its head with `git ls-remote origin refs/pull/N/head`, and re-run the writers when it merges.
- A frames migration never collapses a distinction the corpus draws. If two maps that differ today would match afterwards, the capture describes only one of them, and the whole group reverts.
- A module a Node script imports must not import a `.svelte.ts` runes module, even transitively, and imports sibling TypeScript files with the `.ts` extension.
- Frames from an unmerged gcsim PR follow the Ifa/Varka precedent. Never take them from a draft whose slices are placeholders. To see who gcsim still lacks, list `~/Code/gcsim/internal/characters/` after a fetch; the state of the checkout is `docs/design/gcsim-checkout-state.md`.

## Reading the oracle

- The reaction report pairs by ordinal, so never attribute a fixture row without checking the labels on both sides.
- Re-measure a suspect series in the isolated core: a second character skews the first's cadence.
- An applied count says only that the default is wrong, never what is right.
- A `× 1` row in `gcsim-frames-diff.md` §5 is not a cadence.
- A capture behind a prerequisite sees the prerequisite's summon ticking.
- None of the remaining misses is a rule we believe wrong. Reopen a specific mechanic (Oz's burst geometry, construct resonance), never "counter sharing" as a programme. Record: `docs/rounds/icd-group-round.md` §9–§10.

## Oracle artefacts: never migrate

These diff rows are the dumper's doing, not ours:

- Flins's burst · Nilou WS2/WS3 · Neuvillette `chargeFrames` (the dumper samples EJ's closure) · Varka's Four Winds · Bennett's in-field `h2E` · Lauma's deer row and `hit 73→67` · a bow's `C` (`ActionAim`) · Varesa's Xianyun plunge · Sayu's `hE` (the dumper rolls `hold=1`; ours is a held cast at nominal D = 0) · Ningguang's `C` (gcsim draws the charge type at random off a fresh core).
- ⚠️ Promoting a variant to a sibling ability, or putting a conditioned variant first, creates new artefacts: the dumper reaches neither branch.
- The dumper's `hA` is `hold: 1` (fully charged) for most bows; `drivers.json` names the aimed-shot pairing (`aim`) per character.

## Data pipeline

- The external capability sweep is at 0 actionable findings. The roles CSV is Genshin's IT table plus documented editorial amendments. Plan: `docs/curation/data-quality-plan.md`.
