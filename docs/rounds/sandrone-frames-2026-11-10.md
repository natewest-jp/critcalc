# Sandrone's frames (2026-11-10)

gcsim added Sandrone in #3269 (v2.50.0, `b107b5dc5`), the first source for the kit. Nate picked the frames round at that day's check-in.

## What landed

- FrameMaps (N1–N3, the Charged Attack, E, Q) and `application[]` (E, Q), written by `migrate-frames-shape --seed` and `migrate-application-schema`.
- Off `FRAMELESS_EXEMPT`, so the Builder no longer buckets the kit as "not yet curated" and the coverage page's "in the works" list drops the name.

## What was checked

- E 4s, Q 15s, 60 energy agree with the sidecar and the kit text.
- Radiance states, the 14% Base DMG cap, A4's EM conversion, C1's 30%, and C6's elevation all match the authored effects.
- The Q's three Bombardment hits at 12f spacing belong to the cast, as the audit's "regular, no authored summon" note allows: they sit in `application[]` with the Ray at +177.

## What stays open

- `chargeFrames` is the shortest Charged Attack gcsim allows (anim 64). The real one is held at will, and its length comes from gcsim's runtime `beams`/`frames` params. It joins the held-input leftovers in `docs/rounds/launch-roadmap.md` (Flins, Varka).
- Fagio's sweeping fire, condensed beams, and Decoding Power are unmodelled, and the normal's caveat says so on screen.
- gcsim marks its C4 (15f) and C6 (3f) hitmarks as TODO. Neither is authored here.
