# Varesa's Fiery Passion — a timed Blessing, simulated (2026-10-17)

**Status: ✅ built** (`feat/varesa-fiery-passion`; ⚓ Nate took the "proper" option
over a shared-charges-only fix). Found by a sample-testing agent: in
`… > Varesa 2[E C P sQ E C P]` her 4th E waited 3.2s.

## What was wrong

- Her two E forms (Rush, Fiery Passion Rush) each kept their OWN 2 charges, where
  gcsim has one `ActionSkill`.
- Fiery Passion was the burst's fixed 15s stance: no Nightsoul points, so a plunge
  could never enter it, no free E on entry, and an in-Blessing plunge never ended
  it.

## The model (gcsim `internal/characters/varesa/`, `4eda9fc5f`)

`CharacterData.timedBlessing` + `sim/timedBlessing.ts` (⛔ not `nightsoul.ts`: that
pool drains and holds points only inside its Blessing):

- Points live OUTSIDE the Blessing, cap 40, never drain. E +20 at 5f (never enters);
  a plunge out of it +25 at its landing; the burst fills the pool at 3f. A gain
  marked `enters` that tops the pool opens Fiery Passion for 15s with ONE free E
  (no charge, no cooldown). Inside, the burst does not restart the timer.
- A plunge inside it spends every point and ends it at her NEXT action — unless
  that is a burst, so Volcano Kablam rides it — or at her swap-out
  (`clearNightsoulCB`).
- The burst is `instant` now; a Blessing it ENTERED draws as its bar, cut where
  the Blessing ends. One a plunge entered has no bar (as before).
- `sharesChargesWith`: Fiery Passion Rush spends the base Rush's pool.
- Points persist past a timed end, as in gcsim (a later plunge re-enters at once).
- Lint D.51. Tests: `timedBlessing.test.ts`.

## The sample string, re-read

gcsim and the model agree on it now: the 4th E is the FREE one and casts at once;
the second `sQ` is the base burst, waiting ~12s for its cooldown, because the
plunge before it is made OUTSIDE Fiery Passion (the E before it ended it), and at
C0 only an in-Blessing plunge grants Apex Drive. Kablam wants `E C P sQ` inside
Fiery Passion. That string never shipped.

## Not modelled

Her Hold E (Sudden Onrush), as before.
