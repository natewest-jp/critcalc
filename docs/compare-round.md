# Compare and the guest star (phase 4), 2026-10-23

Under the switch (`?next`), a profile shows the account as it is: an OWNED character reads the roster, live, and a level chosen against it never edits the rotation. It opens a copy in Theorycraft, paired with the rotation, and ⇅ flips between the two (design §2.4, §4.6).

## Nate's calls (2026-10-23, all three recommendations)

1. **⌃` is one key with two jobs** (§12 Q26; ↻ first built as ⌥`, which on a Mac is a dead key and typed a ` into a focused notation — Nate caught it; ⌃ types nothing on any platform, and the key is caught in the capture phase): it flips the pair when the rotation has one, otherwise back to the previous document (the Builder: the previous lineup).
2. **A pair stays stored** when another document is opened (§12 Q30); only ✕ ends it, and both documents stay.
3. **The roster catching up** with a guest (§12 Q28): nothing for now; polish after the main work.

## What shipped

- **One resolver** (`rotationTabs.levelOf` / `levels`): under the switch an owned character reads the roster; an unowned one keeps the document's own level; a guest (`rotationTabs.rosterless`) reads only its own. Off the switch it is exactly the old `{...roster, ...tabCon}`. The bench, the timeline (fed the resolved map), the caveats/bonuses and Share (§12 Q31) all read it. The Builder's `effectiveCon` takes the same rule (`strictOwnership`).
- **The what-if** (`storageSession.whatIf`): the bench's level picker routes an owned character's change there. It makes a Theorycraft copy at every level the rotation ran at (the roster's for owned characters) with the one change, pairs the two, and shows the copy. A rotation already paired with a guest takes the change THERE (the copy is where its what-ifs live). The first routed copy shows a one-time notice, "Saved to Theorycraft · it doesn't match Main's roster" (`siteSettings.seenGuestNotice`, in the backup).
- **Pairs** (`DocumentRecord.pairId`, on both, `#setPair` ends any pair either was in): ⇅ and ⌃` open the other side; reopening either from the Library brings the pair back; ✕ ends it.
- **Compare** (`CompareControl.svelte`, the toolbar's middle beside the Total): unpaired, a menu with **Duplicate and compare** (a copy where the original lives, shown) and **Compare with…** (the Library in **pick mode**, `menu.pickFor`, the rotation itself left out). Paired, the two sides named by their profiles for a what-if ("Main" / "Theorycraft", the guest's in white), else A and B in the order made, the shown one ringed; ✕ beside.
- **The guest** in the top bar: the tool button in Theorycraft's white, "Planner · Theorycraft", "Saved · Theorycraft".
- **The Library**: a guest shows nested under the rotation it was copied from, framed in white, with what it changes ("Theorycraft copy · Xiangling C6"); in Theorycraft the copy carries "From Main".
- **The stored what-ifs** (§10, `#makeGuests`, once, `meta.guestsMadeAt`): a real profile's rotation holding an owned character's level that disagrees with the roster gets its Theorycraft copy at the stored levels, paired. The stored levels are left in place (copy-only); the resolver no longer reads them. ⚠ It runs on Nate's own data the first time this build loads under the switch.

## Strings (working copy, for Nate)

1. Toolbar: "Compare" · "Duplicate and compare" · "Compare with…" · "Show <label> (⌃`)" · "End the comparison (both rotations stay)"
2. Sides: profile names, or "A" / "B"
3. Library: "Choose a rotation to compare with" · "Cancel" · "Theorycraft copy" · "From <profile>"
4. Top bar: "Planner · Theorycraft" · "Saved · Theorycraft"
5. Notice: "Saved to Theorycraft · it doesn't match <profile>'s roster"

## Not done

The roster catching up (§12 Q28, ruled for later) · the phone's toolbar (Compare is in the middle zone, which folds; not checked below `compact`) · the previous-document key across a reload (it is per visit) · a guest's Share from inside a real profile writes the guest's own levels, which is right but untested · documents still have no addresses, so Back does not walk documents.

## Verification

vitest 2557 · check · lint · build. Headless Chrome on the production build, under the switch, with Xiangling owned at C0 in Main: picking C6 on the bench → a guest at C6 (white ring, "Planner · Theorycraft", the notice), the toolbar reading "Main / Theorycraft"; C4 inside the guest edits the guest; ⌃`→ Main at C0 (re-run with the editor focused: no` typed); ⇅ → the guest at C4; Main's Library with the nested "Theorycraft copy · Xiangling C4"; reopening the rotation keeps the pair; ✕ ends it; Duplicate and compare → "A / B", no white; Compare with… → pick mode without the current rotation, the pick pairs and returns; the pair survives a reload. The stored-level pass: a rotation seeded with Xiangling C2 (pass flag cleared) reloads as Main at C0 paired with a Theorycraft copy at C2, marked "From Main" in Theorycraft's Library. No page errors.
