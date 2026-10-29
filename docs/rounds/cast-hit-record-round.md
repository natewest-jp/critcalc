# A cast's hit record lands where its application does — Phase A (2026-09-21)

_Status: **SHIPPED on `fix/cast-hit-record`.** Phase A of the cast-side programme
planned in `docs/rounds/multi-hit-swings-round.md` §6 (⚓ Nate, 2026-09-20: "very
important"; order confirmed 2026-09-21). Phase B — every landing is a hit, swings
AND casts in one pass — is next, and starts at that doc's §3 measurement._

## 1. The defect

§1.K (`docs/rounds/swing-hitmark-round.md`) made a SWING's application and hit record one
closure at the hitmark. A CAST was never synced: `run.ts`'s cast branch dispatched
the hit record with `time: castStart`, synchronously, while the same cast's
`application[]` was queued at `castStart + frame`. The gauge saw the cast's damage
at the hitmark; every `onHit` consumer saw it at the button press.

All 266 hitting casts that state a landing were offset (median 35f, p90 106f, tail
Amber's Bunny at 530f). And it was an ORDER INVERSION, not just an offset: a damage
proc fired by a cast's hit landed its own application BEFORE the cast's.

## 2. What shipped

- **`CastEvent.firstHitAt`** — the absolute frame the cast's first hit lands: the
  earliest entry of the NOMINAL `application[]` (variant's replaces the base's).
  ⛔ Not the ICD-gated list (a suppressed hit still landed — contract C4), ⛔ not
  only the elemental entries (Xinyan's burst opens with a physical hit at 22f, its
  first Pyro is at 57f). Absent when there is no landing to state: unmeasured (no
  `application[]`, 16 casts), a hit at Durability 0 (`application: []` and hitting,
  3 casts), a non-hitting cast. ⚓ PUBLISHED by the parse, because finalize cannot
  recover the resolved variant's list from the token.
- **The live record** is a `Band.LAND` task at `firstHitAt`, queued AFTER
  `emitReactionsAtCast` queued the application at the same (frame, band) — FIFO
  lands application → hit record, the order a swing's one closure has. It carries
  the CAST's stack snapshot (⛔ never a re-read at the landing) and its landed
  entry's OWN element (absent = physical; Varka's opener resolves through the
  party), ⛔ not `char.element`. No landing stated keeps the synchronous path
  verbatim — no frame to move to, no provisional mark (§1.K's ruling carries).
- **A landing after the caster's turn ended is OFF FIELD** (`HitEvent.offField`).
  The task asks `liveSegment === turn` before it touches that turn's stack pool;
  when the turn is over `dispatchHit` takes the NULL pool a summon tick takes
  (same ruling, `stacks.ts`' header), with the entity path's expiry-first step in
  place of a settle. `source: 'active'` refuses it — gcsim's
  `ActorIndex == Player.Active()`. ⛔ Not `viaEntity`: that flag routes a hit into
  the summon-tick passes, and this is the cast's own hit. ⚠️ "The turn", not the
  character: a second consecutive segment of one character mints a fresh pool.
- **Finalize: the four cast-pool sites** (`castLandsNoHit`'s callers in
  `buffWindows.ts`) go through `partitionCastPool`: an `onHit` effect anchors at
  `firstHitAt`, an `onCast` effect at `fieldStart` as before, split by anchor only
  where the two instants differ. The artifact `onHit` branch needed nothing — it
  reads `hitRecords` by time.
- **A summon spawned AT the hit was spawned BY it** (`takeHitProcs`): a
  summon-hosted `onHit` listener hears nothing at `time <= start`. Unreachable
  while a cast's hit fired at the press; the tie only exists now that the hit lands
  where the summon appears. gcsim ×3: Albedo's attack is queued before the
  construct is created (both at 25f); Dehya's field gets a one-frame ICD "so field
  cannot proc from initial attack"; Raiden's status starts after her hitmark.

## 3. Measured

Probe: three rotations per character at C0 and C6 (1002 digests) — R1 the
summon-aware rotation with listener-free partners, R2 with Raiden's Eye, Albedo's
Blossom and C6 Faruzan's Collapse armed first and a swap straight after the
character's casts, R3 with Tenacity and with Deepwood on the character.

- **725 of 1002 moved.** R3: 446 — a hit-triggered set opens when the skill
  CONNECTS (Amber's Tenacity at the Bunny, 530f after the throw). R2: all 246 (the
  prelude's own casts move). R1: 33.
- **No character's OWN cast applications moved anywhere** — the change never
  touches `application[]`. Every application GAINED or LOST is a proc's
  (Albedo / Dehya / Raiden / Faruzan / Aino), and is its cooldown re-phasing off a
  shifted trigger; traced on Flins R2 (Blossom 40 → 94: it used to answer Faruzan's
  PRESS at 39, now her hit at 93; Collapse 72 → 126 = 93 + 33). Nahida's Tri-Karma
  and the Cryo Traveler's Star move downstream of those (a shifted Collapse changes
  which reaction is on the target when they ask).
- **R1's 26 non-proc moves are all cast-anchored `onHit` windows shifting to the
  landing** — Escoffier's burst shred +92f, Klee C6 +71f, Venti C6 +51f, Sucrose
  +42f, Nicole's burst +108f. Navia C6 moves 50f EARLIER (her burst's hit lands
  before its summon spawns, and `fieldStart` is the spawn). **No pool split in two**
  anywhere in the corpus — the split exists for correctness, nothing exercises it.
- **The oracle, same gcsim commit both sides:** Raiden's Eye strikes Δ 47 / 119 /
  119f → 5 / 60 / 60f and her extra application disappears (the Eye answering her
  own press); Albedo's Blossoms Δ 21 / −99 / −99f → 1 / −9 / −6f and the fixture's
  reactions go 2/3 → 3/3. Over-application 2 → 1. ⚠️ One aura sample flips agree →
  drift (175 → 174): our Blossom lands at 1.00s, one frame before gcsim's own
  sample at 1.02s, so we have already crystallized where gcsim samples "before".

Gates: vitest 1949 · check · lint · build green. e2e is the pre-merge gate — the
merge commit says how it ran.

## 4. What the probe cannot see

- `hitRecords` are parser-private; the digest sees them only through what they
  cause (procs, windows, stacks). A consumer with no drawn consequence — `energy`,
  `heal`, a `cooldownReduce` with no recast in the rotation (Sara C1) — moved
  unobserved.
- The 19 casts with no landing to state are unchanged BY CONSTRUCTION, so the
  digest says nothing about them.
- The off-field path is exercised by R2's swap, but only three listeners hear it.

## 5. Open

- ✅ **Raiden's Eye starts 66f after the press** (⚓ Nate, 2026-09-21: "follow
  their lead"). Our data had it live from the press, so the Eye answered her own E
  hit at +56f. gcsim adds the status — the coordinated-attack gate AND the
  burst-DMG mod, one object — at `6 + 60` ("starts 1s after cd delay"), which is
  PR #2271 (2024-11), a targeted correction of gcsim's own earlier "start eye at
  hitmark". Authored as `summons[0].spawnsAt: 66`, so the Eye's bar and her
  burst-DMG buff both open there. Oracle, the Eye-off-a-summon fixture: every
  Raiden row within ONE frame of gcsim (strikes 2.60 / 5.55 / 8.50s against 2.62 /
  5.57 / 8.52s; they were 5 / 60 / 60f off after Phase A, 47 / 119 / 119f before
  it).
- **The 3 Durability-0 hitting casts** (Emilie's E is the known one) want a
  hitmark with nowhere to live. ⚠️ §6.3 of the plan said `application[]` "cannot
  hold an entry that applies nothing" — it CAN: an element-less entry (`{frame:
14}` — five casts OPEN with one: Hu Tao, Lan Yan, Qiqi, Heizou, Xinyan) is a
  hit that applies nothing. But it means
  PHYSICAL, and Emilie's is Dendro at Durability 0, which `onHit` element filters
  can tell apart. Named, not solved.
- Windows that START past the rotation's end: a pre-existing class (138 in the
  probe before, 157 after — late landings of a rotation's last cast).
- Phase B: 88 multi-hit casts are still ONE record.

## Notes carried over from Claude's working memory (2026-10-29)

Traps from Phases A and B that this record does not carry:

- A probe rotation that writes a character's full name instead of its `displayName` ("Raiden Shogun E" where the name is "Raiden") has its segment dropped SILENTLY: R2 once ran with no Eye at all. Check `casts` in a trace before trusting a multi-character probe.
- The committed `docs/curation/gcsim-reaction-diff.md` was stale at the time (an older gcsim commit). To attribute an oracle move, run the oracle on stashed code too (`git stash -u -- src`) and diff the two dry runs.
- Two proc tests had a proc answering a BUTTON PRESS (Raiden's Eye at +5f of her own press; Albedo's Blossom off Raiden's press). Any test that asserts a proc instant near a cast start is suspect the same way.
- How gcsim's Raiden Eye start was judged without written evidence: `git log -L` on the line showed a deliberate later correction by a core maintainer, which outranks a default.
- Phase B: `FrameMap.lands` became `number | number[]`, which broke exactly one test (`toBeGreaterThan(0)` on Keqing's CA). Any reader doing arithmetic on `fm.lands` directly is a bug; go through `landsAt` / `landingsOf` (`src/lib/utils/frames.ts`).
- Phase B's measurement trick, worth reusing: inject the candidate data in memory inside the probe, so the design is measured before a single JSON changes (the naive-list versus name-stem diff of 8 digests fell out for free).
- Still open at the time: Alyosha's N4 (`hitIndex: 3` gain and consume-all) once gcsim covers him, and Nate's on-screen look at aura-lane pip density on an infused string.
