# Blank: no cooldowns, and E/Q bars of a stated length (2026-11-08)

Branch `feat/blank-bars`. The Now item "Blank character: Help section + possible
changes", settled in discussion the same day.

## 1. The shape (⚓ Nate 2026-11-08)

Blank stands in for a character a player is imagining, so it should not make
their brainstorming harder with numbers the imagined character may not have.

- **No cooldowns.** E and Q are 0s, so `Blank E E` casts the second E at once.
  Measured before: it waited out a 12s cooldown. Nate floated "cooldowns match
  the durations"; Claude recommended zero, because a matched cooldown brings the
  wait back in a quieter form, and `~Xs` already spaces casts. The Q's energy
  cost is 0 too (nothing reads it, but the inspector showed "60").
- **E/Q bars only.** `E{8s}` and `Q{12s}` draw the cast as a bar of that length.
  A plain `E`/`Q` draws only the cast. No summon or off-field bar: revisit if
  players ask for one.
- **No element.** See §3.
- **One Blank.** As before; no naming.

## 2. How it works

- Tokenizer: a `bar-length` kind, `BAR_LENGTH_RE` (`{8s}`, `{2.5s}`, `{.5s}`),
  spaced or concatenated. Inert to every lookahead (`isInert`), so it moves
  nothing; dropped on the KQM export; styled like a stack count in the editor.
- `run.ts` reads it only off the token right after a Blank cast and sets the cast
  event's `uptime`. A recast cuts the earlier bar at the new cast, on the event
  itself. ⛔ `pillCuts` was tried first: it lands after finalize projects the E/Q
  bars, so the drawn bar kept its full length while the event was cut.
- `barPhases.ts`: a bar with no cooldown is drawn solid for its whole length.
  Before, case B drew the cast time solid and the rest dim, "past the cooldown".
  No corpus ability has a 0 cooldown with a duration, so nothing else moved.
- Lint: `{Xs}` on anyone but Blank, or not right after Blank's E or Q, is an
  `unsupported-token` warning. `characterLint` lets Blank's burst cost 0.

Why braces: they already mark planner-only notation (`{key:N}`), which the KQM
export strips. `E~8s` was rejected: it would differ from `E ~8s` (8s of field
time) by one space. ⚠️ `playback/repeat.ts` records Nate's 2026-09-29 note that
the `{key:N}` form "retires later"; if it does, `{Xs}` is the one brace form left.

Tests: `notationParser.test.ts` "Blank: no cooldowns, and bars of a stated
length", plus `tokenizer`, `barPhases`, `kqmExport` and `notationFlags` cases.

## 3. Open

- **An element for Blank (⚓ Nate: keep as a note to revisit).** Blank's attacks
  don't hit, so an element would change nothing on the aura lane. Where it would
  matter is teammates whose kits count the party's elements: Nilou's Bountiful
  Cores, Chevreuse, elemental resonance. Today a Blank counts as no element, so a
  Blank in a Nilou team switches her passive off.
- The Help section, written now that the shape has settled. Copy is Nate's.
