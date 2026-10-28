# Twin frames round (2026-10-28)

Branch `data/twin-frames`. gcsim times Aether and Lumine apart (`c.gender` 0/1) in all
seven elements: 65 captures differ, mostly normals and the charged attack, plus Anemo
E/hold E/Q, Geo E/Q and Hydro E/Q (her press lands at 26 vs 25, her bubble at 36 vs 34).
We had shipped Aether's numbers for both.

## Shape

- A Traveler's base fields are **Aether's** (gcsim gender 0); `twin.lumine` overlays
  (`TwinOverlay` in `$lib/types/ability.ts`) state only where Lumine differs: hit frames,
  charge/plunge maps, cast and variant `frames` + `application`, summon `spawnsAt`.
- `forTwin()` (`$lib/data/twin.ts`) is the ONE reader. The planner resolves a Traveler to
  the rotation's twin at the parser's character lookup, so the parse never knows.
- Lint B.21: overlays on Travelers only, on the fields `forTwin` reads; the Lumine
  resolution is linted as a character of its own (`characterLint.test.ts`).

## Tooling

Lumine is a second character to the tools: `twinView` (`traveler_x@lumine`, gcsim
`lumine…`), `foldTwin`, `withTwinEntries` in `scripts/lib/gcsim-map.mjs`. The audit and
the frames, landings and applications writers all run her through the same rules.

- ⚠️ `migrate-application-schema.mjs` was NOT run (it would rewrite 48 files of
  hand-curated lists); Lumine's two Hydro hitmarks are hand-authored from gcsim source.
- ⚠️ Anemo's `burstHitmarks {96, 94}` sets the STATUS length only; ticks are queued at a
  literal `94 + 30i` for both twins (a move to 96 was tried and reverted).
- Fixed on Aether too: Anemo tap E was transposed (`anim 74, Q 76` → `anim 76, N 74`).

## Notation and UI (⚓ Nate's rulings)

- `Cryo Aether` / `Cryo Lumine` pin a twin; `Cryo Traveler` plays the profile's.
- The Traveler's constellation popover on the bench has an Aether/Lumine row. In a real
  profile the other twin is a what-if (`session.whatIfTwin` → paired Theorycraft copy,
  its notation explicit); elsewhere it rewrites the notation (`setTwinInNotation`).
- Typed by hand in a real profile, the other twin is timed and flagged provisional
  (`other-twin`).
- Portraits follow the notation (`rotationTwin`) on the bench, the Planner's rail and
  inspector and the PNG; every other portrait stays the account's.
- Suggestions offer twin names only when typed ("Lum", "Aeth").
- A swap between Traveler elements keeps a pinned twin. KQM export passes names through.

## Not modelled

Anemo A1 / Geo A4 extra-hit timing (A1 isn't authored; A4 rides the N5 hit), Pyro C6
Lumine's shared enhanced-CA ICD tag, Hydro Q's energy-consume frame, hitboxes.
