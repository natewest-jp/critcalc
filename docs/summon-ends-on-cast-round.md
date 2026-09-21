# A summon that ends on its owner's OTHER cast — record (2026-09-19)

_Status: ✅ SHIPPED on `feat/summon-ends-on-cast`. Engine item **§M** of
`docs/curation/essential-characters-2026-09-15.md` ("a summon cannot terminate
on a DIFFERENT cast"), the queue's `terminatesOn` item. There was no separate
scope; the measurement below was the scope._

## 1. The defect, measured on `main`

`Summon.terminatesOn` was `'swap' | 'recast'`. Two holders state a third end in
their own kit, and both already carried a caveat naming the pixel:

- **Mavuika** — gcsim's `Burst()` calls `enterBike()` and `skillRingTask`
  returns the moment the armament is not the ring, so the Ring is gone the
  instant Q is pressed. `Mavuika E Q`: the Ring's bar ran 0–744f and applied
  Pyro at 120 / 240 / … / 720f from an entity the game deleted at 18f.
- **Gorou** — "If a General's War Banner created by Gorou currently exists on
  the field when this ability is used, it will be destroyed." `Gorou E Q`: the
  Banner's bar ran 34–634f under General's Glory.
- Emilie's E Case, §M's third name, was already solved by the summon-conditions
  round (a shared LABEL + `recast`), and stays that way.

## 2. What shipped

`terminatesOn: 'skill' | 'burst'` — the summon ends at the START of its owner's
cast of that kind. Two readers, one instant:

- **Live** (`aura.ts` `retireSummonsOnCast`, called from the cast site BEFORE
  the cast schedules its own summons): every summon registered under
  `${characterId}::${kind}` is retired by the SAME generation bump a recast
  uses — nothing cancels a task, and the proc listeners hosted on the summon go
  with it. ⚠️ Superseded AT THE CAST (`summonChainSupersededAt = castTime`);
  unlike a recast there is no new spawn to wait for.
- **Finalize** (`emitSummon`): the terminating bar cuts every registered open
  window of its character at `bar.start`, ⚠️ before the `uptime <= 0` return —
  Mavuika's burst leaves no summon of its own and still ends the Ring. The
  registry lives outside the track loop (a character's casts span tracks).
  `naturalEnd` is untouched, so the cut window draws no boundary tick and no
  seam — the existing "a cut is not an end" rule.
- The state index (§1.G) reads final windows, so `duringSummon` ends with the
  cut. ⚠️ `holderStatesAt` reads the cast's `uptime` live and does NOT see it —
  the same approximation it already makes for a recast cut. No holder gates a
  live effect on either summon.

Lint: D.22 admits the two values; **D.22b** refuses a summon naming its own
ability's kind (that is `recast`). `notationParser.ir.test.ts`'s reference
geometry follows.

## 3. Measured

`Mavuika E Q`: Ring 0–18f, no ticks, Pyro only from the two casts (16, 124f).
`Mavuika E ~5s Q`: Ring 0–324f, ticks at 120 / 240, markers == applications.
`Mavuika Q E` and `E` alone: unchanged. `Gorou E ~3s Q ~10s E`: the first Banner
ends at the burst, the second runs its full 10s.

Corpus: 10 of 630 summon-aware digests (Gorou ×5, Mavuika ×5) and 2 of 252 buff
digests (Mavuika — window CONTENT identical, only ids shifted by the reaction
events the dead Ring no longer causes). Guarded in `summonTicks.test.ts` (corpus
characters, by that file's own rule); seeded negative — not retiring the live
chain — fails the Ring case.

## 4. ⏭ Open

- **Gorou's BUFF bar still draws through Glory** (`cast:skill def`, 34–634f).
  ↻ ✅ **SCOPED 2026-09-21** — `docs/summon-bound-buffs-round.md` §2.2. ⚓ Nate:
  cut it at its provider's death. ⚠️⚠️ But gcsim is sharper than "cut it": the
  buff is a 0.3s re-application loop handing out a **2s** mod that stops when
  **BOTH** fields are down (`skill.go:95-128`), so the honest end is field + 2s
  and ⛔ it must NOT be cut at the banner's death while the Glory is up —
  `E ~3s Q` is ONE continuous bar.
  A cast-anchored buff has no tie to its summon's life — that is a different
  primitive ("a buff that ends with the field that grants it"), and ⛔ it must
  not be inferred from the cut: most cast buffs beside a summon are NOT the
  summon's. His caveat now names only that bar, and the E-during-Glory banner.
- A summon ended by a cast BEFORE it spawns is clamped to zero length rather
  than removed. No corpus rotation reaches it.
