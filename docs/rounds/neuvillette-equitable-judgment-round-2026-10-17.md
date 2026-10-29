# Neuvillette's Equitable Judgment — `C` is the beam (2026-10-17)

**Status: ✅ built** (`feat/neuvillette-ej`). Before it, `C` drew gcsim's SHORT
Charged Attack — one hit, one Hydro, 69f — where the game's (and gcsim's) `C` is a
3.4s channel of 8 hits and 4 Hydro applications. His whole loop was missing.

## The shape

- `NormalAbility.chargeChannel` (`ChargeChannel`): windup, `absorbAt`, `chargeUp`
  per droplet count, the beam's `hits`, `endLag`, `dropletLife`. Lint D.50.
- `spawnsDroplets` on the skill and burst (`DropletSpawn`): E 3 at 23f; Q 3/2/1 at
  95/135/154f.
- `run.ts`: a `C` on a channelling kit absorbs up to three droplets OLDEST FIRST
  from `ctx.droplets` (a count, recorded at each cast with its future spawn
  instant), then lays the beam's hits on the clock. Each hit is gated on its own
  standard counter (gcsim `ICDTagExtraAttack`) — ⚠️ the catalyst Charged Attack
  rule (`ICDTagNone`) belongs to the short attack — and is a charged hit record.

## ⚓ Rulings (Nate, 2026-10-17)

- **Droplets are COUNTED, not placed.** gcsim places them as gadgets and absorbs
  the ones in range at random; in the E → Q → C loop it measures three every time,
  and the count reproduces that. A flat "always three" was considered and
  dropped: `E C C` would draw its second beam instant where it charges for 3.5s.
- **No droplet-count notation** (braces are being phased out) and no token for
  the short Charged Attack.
- **Not drawn:** the HP drain, the droplet heals, C4's heal droplet, C6's +60f per
  droplet absorbed in the beam's last second.

## Numbers (gcsim `charge.go`, `4eda9fc5f`)

Windup 14f out of a dash / jump / swap / wait, 0 after a cast, Normal, Charged or
plunge. Absorb at windup + 3. Charge-up 209 / 152 / 98 / 0f for 0–3 droplets. Hits
at beam start + 6, 28, 53, 78, 103, 128, 153, and the closing wave at 173. End lag
51 (C 30, swap 27, E Q D J 0). Droplets live 878f.

**Measured** (`chargeForms.test.ts`): `E Q C C C` beams 206f apart with
applications at S + 6/78/153/173 (gcsim's CLI: C→C 206f, the same four); `E C C`'s
second beam 412f; a cold `C` 426f. ⚠️ The first beam lands 5f earlier than gcsim's
CLI run (172 vs 177 from the E) — the offset sits in the E → Q → C chain before
the beam (gcsim's character tasks carry hitlag), not in the channel.

## Open

- C6's extension; the A1 stacks already scale the beam's damage as buffs (no
  change needed here).
