# Profiles and link routing (phase 2d), 2026-10-22

Under the switch (`?next`), the site has profiles: Theorycraft (built in) and up to seven real ones, each with its own roster, rotations and lineups, switched from the top bar's picture. Shared links open in Theorycraft. With the switch off, nothing changes.

## Rulings landed (⚓ Nate, 2026-10-22)

- **The profile form is a menu-state SECTION**, not a dialog: `/profile` edits the active profile, `/profile/new` adds an account.
- **The switch cue is a wash from the top bar**: the new profile's colour falls from the bar and fades over ~2 s, its name riding under the picture and folding away with it. 🎛️ Knobs in `TopBar.svelte`: `WASH_MS` 2000, `WASH_REACH` 38vh, `WASH_PEAK` 32%.

## What shipped

- **Each profile has its own roster** (§2.1). Under the switch the three roster stores (`constellations`, `ownership`, `loadout`) start EMPTY, the session fills them from the active profile (`bindRoster`), and their writes go to that profile's record. ⚓ Never to localStorage, which stays as the migration found it (copy-only). Every profile write (roster, current document, name, colour, picture) goes through ONE queue that re-reads the stored record, so two kinds of change cannot write over each other.
- **The profile menu** (the picture): the profile's name and what it is, the other profiles (a click switches), Add your account (disabled at seven, with the reason), Profile (real only) and Roster.
- **Theorycraft's invitation**: an "Add your account" word beside its picture (hidden on a phone, §12 Q14), and a paper card where its Roster would be. The sidebar shows Add your account instead of Profile.
- **The profile form** (`ProfileForm.svelte`): name, one of the seven element colours (exclusive: a colour another profile wears is disabled and names its wearer), and a picture from the 29-picture art set or, when editing, a character the profile owns. Adding switches to the new profile and opens its Roster (§9.2). Editing saves as you go. Delete is a tombstone of the profile and everything in it, on a second click; deleting the active profile moves to Theorycraft.
- **Switching** (`storageSession.switchTo`) writes and lets go of the documents on screen, binds the new roster, opens the new profile's current documents, and starts the cue. ⚠ A tool with no current document always starts from a FRESH blank: `restoreFrom(null)` keeps whatever tab is there, which after a switch is the other profile's document (and the next autosave would have pointed the new profile at it).
- **Links open in Theorycraft** (§9.3): `?r=`, `?b=` and `?team=` wait for the session (`storage/arrivals.ts`; on a cold load they used to race the session's restore), switch to Theorycraft if a real profile was active, and open as Theorycraft's new current document; the one before stays in the Library. The notice reads "Opened in Theorycraft · your profiles are untouched" when a switch happened. ⚓ A link's rotation is UNNAMED: "Shared rotation" was the planner's word, not the sender's. `?swap=` is internal and stays where it is.
- **From a link**: `DocumentRecord.fromLink`, marked on the Library row.
- `src/lib/profileLook.ts`: one place for a profile's colour and picture URL.

## Calls for Nate to overrule

1. **Today's constellation layering stays** (a rotation's own level wins over the roster). §2.4's strict rule needs phase 4's what-if copies, or a level that disagrees with the roster would be lost.
2. **A new profile's Traveler twin** is copied from the current site setting; it is not on the form yet. Only the profile picture reads it so far (§13.5's twin is the twin-frames fix's).
3. **Theorycraft's roster record still takes loadout defaults** set in a details card, since a loadout is a document's default everywhere (§2.4); its Roster section shows the invitation, so nothing else writes it.
4. **The "Opened in Theorycraft" notice** uses the bar's ordinary notice timing (a couple of seconds); "very obvious" is the wash plus the notice. Move to a profile is phase 3's.
5. **The profile menu's sub-lines**: "Shared links open here" (Theorycraft), "Your account, in this browser" (real). Working copy.

## Not yet

Move to a profile (phase 3, with its list of what changes) · pruning untouched link documents (§4.3, the window is §12 Q9) · Back returning to the document a link replaced (documents have no addresses yet) · backups still read localStorage, so profiles are not in a backup (backup v3, §12 Q11) · a second browser tab keeps its profile in memory until reloaded.

## Verification

vitest 2557 · check · lint · build. Headless Chrome against the production build: Theorycraft first visit with the invitation; Add your account → Main, the cue, Main's Roster empty; a character marked in Main's roster lands in Main's IndexedDB record only (Theorycraft's empty, localStorage unwritten); Main's rotation, a switch to Theorycraft and back, each profile's own current document; Main's share link opened → Theorycraft, the notice, the row marked From a link and labelled by its team; delete Main → Theorycraft. No page errors.
