# Notation as Single Truth — ✅ SHIPPED (2026-08-13)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

> ⚠️⚠️ **PARTLY REVERSED BY DESIGN, 2026-10-22 (⚓ Nate, not yet built):** a rotation will store four SLOTS that hold (party keys 1–4); a seated character with nothing in the notation RESTS instead of vanishing. The notation stays the truth for what HAPPENS; slots become the truth for WHO and in which ORDER. Cause: a streamer cleared the bare-names stub and lost the team. Spec: `docs/design/profiles-and-surfaces-design.md` §8.1; see `docs/rounds/bars-demo.md`. Read §8.1 before touching team derivation.

✅ **MERGED `5b08b3a` and PUSHED.** Cite the MERGE hash; the branch commits are
`7e82bab` (the linter), `824c681` (single truth), `1623160` (undo/redo),
`f9e61b7` (e2e promotion), `025a39d` (`A`/`W`), `3a790de` (parser invariants +
loose ends). **Gates green including `test:e2e` on both engines (70 + 70).**
✅ **Safari cleared by Nate 2026-08-13.**

⚓ **Nate's decision:** the notation box is the SINGLE SOURCE OF TRUTH for the
team. He traded slot reordering away for it ("having the tool and notation
agree is way more important") and has a separate idea for reordering.

## What the round actually was

`slots = manualSlots ?? autoSlots` gave the team TWO sources of truth, and both
known bugs were the two disagreeing. **Both are gone**, and the second one is
worth stating precisely: the sticky-mode bug was never in the parser, and the
silent discard was a RENDERING decision (`mapTracksToSlots`'s
`if (matching.length === 0) continue`). That `continue` still exists — only a
FIFTH character can reach it now, and the linter squiggles that name.

## The five things worth knowing before touching this

1. ⚓ **A character name is ONLY ever a segment's FIRST token.** That is the
   fact that makes rename/delete bounded. `notationEdit.ts` splices at
   tokenizer offsets — ⛔ never a text replace (it would eat `N2`, "Nahida",
   "Chongyun") and ⛔ never a rebuild (it would reformat spacing the user chose
   and eat a half-typed dangling `>`).
2. ⚠ **The joins are the hard part, not the segments.** A middle deletion takes
   the `>` AFTER it, a last deletion takes the one BEFORE it — and two adjacent
   deletions OVERLAP if computed as independent spans. Survivors are
   reassembled instead. All of it is in `notationEdit.test.ts`.
3. ✅ **Undo came almost free, and the earlier estimate calling it "the real
   cost of ✕" was too pessimistic.** The store writes `rt.notation`; Svelte
   hands it down; the editor replays it as a CodeMirror transaction. Because
   the slot is DERIVED, undoing the text restores the slot by itself — there is
   no separate slot-restore path. ⛔ `setValue` must stay a plain `dispatch`
   (history by default); adding `addToHistory.of(false)` would silently break
   ⌘Z for every bench edit. It computes a MINIMAL change now so the caret maps
   through instead of being dumped at the end of a new doc.
4. ⚠ **`historyTick` is why the undo buttons' disabled state is right.**
   CodeMirror's undo depth is invisible to Svelte, and a programmatic write
   runs with the change callback SUPPRESSED — so counting only typed changes
   greys out Undo immediately after the edit most likely to want it. Bump it on
   both sync directions.
5. **Slot resolution moved to the TOKENIZER** (`orderedCharacterIds`), off the
   old `notation.split('>')` word-prefix scan. The parser resolves the
   tokenizer's `character` token, so the scan was the odd one out — a slot
   derivation that can disagree with the parser is the bug shape being removed.

## The linter (increment 1 — it was a real prerequisite)

`notationFlags.ts`, fed by a new EAGER index field `casts`
(`castTokens.declaredCastTokens`). Eager because it lints per keystroke and
cannot wait for a lazy payload — same reason element/weapon are eager.

⚠ **TWO REGISTERS** — see the RULE under `A`/`W` below for the line that
covers every case. The provisional squiggle does **NOT** take the ink: the
token's colour is carrying the element tint, which is real information.

- ⚠ **We do not lint the word you are typing** — every prefix of a name
  resolves to nobody. The decoration build runs on `selectionSet` too so the
  squiggle returns when the caret leaves.
- ⛔ **RangeSetBuilder had to go.** It cannot nest a mark inside one already
  added, which is exactly a cast inside `2[hE C]` (ONE tokenizer token).
  `Decoration.set(ranges, true)` + the new `tokenizeActionRun` export.
- Measured: every shipped character declares E and Q, 31 declare a hold — so
  the flag fires almost entirely on holds and short bursts that fall back.

## Decisions Nate made in-session (2026-08-13)

- **Flag surface:** editor squiggle only. No band-B counter, no Notes entry.
- **Clear team:** TWO STEPS when `notationHasActions` — four bare names still
  go in one press.
- **A 5th character:** FLAG it, do not grow a fifth lane. The bench holds four,
  and a chart disagreeing with it is a worse lie than the drop.

## ⚓ `A` and `W` — decided and shipped (`025a39d`)

Both were tokenized and then silently dropped by the parser. Nothing had ever
been decided about them; the answer turned out different for each.

- ✅ **`A` was never a gap — it is an ALIAS we never wired.** A bow's `C` IS its
  fully-charged aimed shot (`chargeHits`), and `resolveActionElement` already
  carried the C1-is-physical exception. `A` now enters the charged branch on a
  bow; `Ganyu A N1 A` ≡ `Ganyu C N1 C`, verified event-for-event. ⛔ Bow-gated —
  gcsim's base `Aimed` literally returns "action aimed not implemented".
- ⛔ **`W` is REFUSED, not pending.** ⚓ Nate chose the WARNING register over
  provisional: a token we will never simulate is not a coverage gap that might
  close. Walk-cancels enable timing-breaking play (machine-gun Gorou), and
  **gcsim does not model it either** — its `walk` has NO intrinsic duration,
  only the frame count you pass (`p["f"]`, default 1); every per-character
  override is a refusal. gcsim's `ActionWalk` is really a frame-map KEY
  ("frames until you can walk"), the role our `frames.swap` plays.
- 🐛 **An unread `W` was not free.** It is no FrameMap key, so `peekActionKey`
  resolved it to `swap` and `Ganyu N1 W N2` timed its N1 differently from
  `Ganyu N1 N2` (1.0 vs 1.1s). `peekActionKey` now SKIPS it — which is also
  truer to the technique, since a walk-cancel does not reset the attack string.

⚓ **THE REGISTER LINE, now a rule instead of an enumeration:** `--ui-warning` =
WE CANNOT TAKE THIS (about the INPUT; nothing is drawn) · `--ui-provisional` =
WE TOOK IT AND THIS IS A STAND-IN (about OUR coverage). Use it for any new flag.

## Persisted surfaces

⚓ **No backwards compatibility was required** (nobody else has used the site;
no saved share URLs), so `?r=` **BUMPED to FORMAT '2'** and dropped `team`,
with NO v1 decoder — a v1 link surfaces as "Invalid share link". ⛔ It was
ALREADY versioned twice; the round used them rather than adding a third.
The three LOCAL surfaces migrate as a courtesy to Nate's own tabs
(`foldTeamIntoNotation` at the localStorage restore, the save-bank load, and
the settings-backup import). `SavedNotation.manualSlots` survives as an
optional READ-ONLY field; nothing writes it.

⚠ **The e2e fixture no longer seeds `manualSlots`.** It scrapes id→displayName
out of the committed index with a regex and writes a NOTATION — specs keep
their `slots` contract. A file scrape rather than an import because the fixture
cannot resolve `$lib`.

## ✅ Closed along the way

- **The summon BIJECTION HAZARD is closed.** characterId ↔ slotIdx had exactly
  one way to break — `?team=` and shared links passed their id array VERBATIM,
  so `?team=fischl,fischl` handed one characterId two slotIdx. Both write the
  notation now and read back through the deduping `orderedCharacterIds`, so a
  duplicate-character team cannot be EXPRESSED. The two comments in
  `notationParser.ts` / `summonSubrows.ts` that described it as live say so now.
- `documentBar.hasContent` is one test, not two (a filled slot IS a name).
- Both promotions APPROVED and landed: `e2e/notation-truth.spec.ts` (the two
  single-truth bugs) and the `A`/`W` invariants in `notationParser.test.ts`.

## ⏭ Left open

- **Slot reordering** — Nate's separate idea, undescribed. This is the thing
  single truth traded away; he has a plan for it.
- **The empty-slot invitation** (inherited from the Source-retirement round):
  nobody has decided whether a bare empty bench portrait reads as an invitation.
  Under single truth an empty slot's ⇄ appends, so it works; it just may not
  announce itself.

**How to apply:** see `docs/rounds/rp-source-retirement.md` for the round that
surfaced this, `docs/rounds/p4-event-stream-plan.md` before touching parser internals,
and `docs/rounds/ui-state-colors.md` for the two-register split the squiggles use.
