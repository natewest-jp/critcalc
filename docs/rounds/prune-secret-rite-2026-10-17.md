# Prune's Secret Rite — the reactor and the others (2026-10-17)

**Status: ✅ fixed** (`fix/prune-secret-rite`). Nate saw her buff bars "segmented in
a strange way" in a Varka team.

## Cause

- The +30% ATK half ("the triggering character's ATK") was authored
  `target: 'active'` for lack of a triggering-character target. The active
  surface SLICES a window across the field, so the bar hopped Bennett →
  Xiangling → Varka and was cut at every 8-frame swap.
- Both halves listened to `source: 'team'`, so Prune's OWN bell Swirls fired
  them — but the Rite needs a character carrying Tolling Rally, and Tolling Rally
  is `teamExcludingSelf`. Her own Swirl also produced the duplicate "+30% / +60%"
  bar in her row (a +30% window cut by a swap one frame later, which the
  fuse-then-merge then could not merge).

## Fix

- `EffectTarget` `'reactor'` — the character whose hit triggered the reaction;
  `buffWindows.ts` emits one unsliced window per application on that character's
  row (`ReactionPool.reactorId`). The Team Builder reads it as `active`.
- `onReaction.source: 'others'` — any party member's reaction but the holder's.
- Lint D.52 (reactor only on an `onReaction` buff; `'others'` only on buffs and
  RES shreds, the one reader), and `invalid-reaction-source` admits `'others'`.
- Test: `buffWindows.faction.test.ts` (mutation-checked against the old data).

## Still not modelled

The triggerer must be Hexerei AND carry Tolling Rally — a receiver-faction and a
received-buff gate the schema has no condition for. Non-Hexerei teammates'
reactions still give Prune her +60%.
