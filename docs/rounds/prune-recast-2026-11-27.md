# Prune's recast — a lock taken from her own Swirl (2026-11-27)

**Status: ✅ built** (`feat/prune-recast`). Nate, after the check-in: finish elemental absorption, Prune most notably. Her recast was the last kit gap in the absorption family that the survey (`elemental-absorption-survey.md`) never listed, because it is not an aura poll.

## What gcsim does

`internal/characters/prune/skill.go` at a284a499b:

- The chime (`Ring-A-Ding-Ding! Hexhunter Chime DMG`) hits at 26f. If that hit causes a Swirl, its element goes into `skillConvertEle` and `prune-skill-recast-window` opens for 364f. A Stellar Swirl counts as Cryo. A shared 0.2s swirl ICD means one hit sets the element once.
- A second E inside the window is `skillConvert()`, "Clang Clang! Witch-tribution Comes!": one hit at 30f in that element, Durability 25, ICDTagNone, with A4 (Tolling Rally), C1, C2 and C4 on its callbacks. `ActionReady` skips the cooldown check while the window is open, the recast sets no cooldown, and it deletes the window.
- The chime's E cancel is 28 while the window is open and 41 otherwise.

## What we built

- **`SkillAbility.locksSwirl {opensState}`**: a cast's lock taken from the first Swirl its own hits cause. The cast's offers carry the lock key (`Offer.swirlLockKey`), and `emitReaction` takes the lock (`takeLock`, `swirledElement` in `sim/absorb.ts`). The state opens at the Swirl and names the cast.
- **`absorbedFrom: {state}`**: a follow-up reads the lock of the cast that opened the state's current window (`inheritedLockKey` in `run.ts`, beside Lan Yan's `'stance'`).
- **A lock already held at the follow-up's cast is resolved there** for its landings and the cast's element, so the recast's hit is a hit record (A4, C1, and C4 hear it) and its block takes the swirled element. Its offer still goes through `emitAbsorbedAtCast`, on its own counter.
  - Tried first: rewriting the entry as a literal element. It moved Lan Yan's ring twins onto the cast's own ICD counter (`notationParser.test.ts` caught it); gcsim gives them a separate group.
- **`SkillAbility.consumesState`**, the sibling-ability twin of the variant field.
- **The data:** the recast is a conditioned sibling skill with `cooldown: 0` (its own charge queue, so the chime's 15s keeps running), gcsim's `skillConvertFrames`, and one absorbed entry at 30f with `noICD`. A4, C1, and C4 filter on `abilityName: "Clang Clang"`. The chime's caveat ("shown after every skill hit") was no longer true and is gone, with its two kit-note lines.
- **The chime's `frames.E` is 28**, gcsim's cancel into the recast. Without a Swirl the next E waits out the 15s cooldown, so 41 never decides a cast time. The frames audit lists it (E 28→41), as expected.
- **New state `witchtribution`**, with its Team Builder phrase in each locale (en "while Clang Clang! Witch-tribution Comes! is ready", after Flins's and Odette's; held for Nate's ruling).
- Lint: `absorbedFrom` accepts `{state}` when some lock of the character opens that state; `locksSwirl.opensState` needs a known state and a positive duration.
- Test: `src/lib/sim/swirlLock.test.ts` (six cases), written first.

## Not done

- **A1's Burst hammers** (a Witchlure Bell Swirl spawns a 150% hammer in that element, 45f later, 1.2s shared ICD) also carry A4, C1, C2, and C4 in gcsim. A reaction proc's landing is not a hit record the buff passes read (`buffWindows`), so Tolling Rally is not shown from them: an under-claim during the burst, so no caveat. This is the "proc hits" item in `launch-roadmap.md` § Engine and data leftovers. gcsim also narrows A1 to the Bell's own swirls (`Abil == "Witchlure Bell"`); ours still fires off any of her swirls while the Bell is up.
- **C4's ricochet** has no `application`, so the sim never arms it; it now filters on the converted hammer like A4 and C1.
- **The Secret Rite gates** (the triggerer must be Hexerei and carry Tolling Rally) are unchanged (`prune-secret-rite-2026-10-17.md`).
- The oracle cannot reach the recast: the dumper runs one character in an empty core.

## What's left of absorption

Kazuha's A1 plunge, Wanderer's A1, Sucrose's C6, Jahoda (survey §8), and Venti's stream ending with the Stormeye (an in-game check). Wanderer's A1 and Sucrose's C6 share one missing piece, a condition on the locked element.
