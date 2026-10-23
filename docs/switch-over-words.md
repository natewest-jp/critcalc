# Switch-over words — proposals for Nate (release readiness pass, step 3)

**Status:** ⏳ PROPOSED 2026-10-23, nothing applied. Answer by number: "ok", a rewrite, or "cut".

**Scope (⚓ Nate 2026-10-23):** correct only what the new layout makes FALSE, in today's chapter form; the
§6 Help relayout is its own round after the release. The new text renders under the switch
(`{#if $nextLayout}`), and the old text goes in step 5. Bars are **the top bar** and **the toolbar**
(glossary updated, `8f13daa4`).

**How this was built:** an inventory of every string the switch touches (111 marked working copy, 34
help paragraphs, 60 switch-only strings), then a fact check of the new layout's behavior in the code.
Only the strings that need a change are listed. The rest were read against the style guide and are
fine as written.

Apostrophes and quotes are typed straight here for reading and go in curly.

---

## A. Rotation Planner chapter

1. **The composer — undo** (`RotationPlanner.svelte:74`)
   - Now: "…Each tab keeps its own edit history until the page reloads."
   - Proposed: "…Each rotation keeps its own edit history until the page reloads."

2. **The team — the chip and the pill** (`:118`). The old text describes per-tab levels, which the
   new layout retires for characters you own.
   - Now: "The chip on the portrait sets the character's constellation for this tab, and the pill
     beside it sets their weapon and artifact set. Neither touches your roster: A tab keeps its own
     levels and loadouts, so one rotation can be written at C6 while your roster says C0. When the
     tab uses a constellation you don't own the chip is drawn hollow."
   - Proposed: "The chip on the portrait is the character's constellation, and the pill beside it
     sets their weapon and artifact set for this rotation. A character you own is at your roster's
     level. Choosing another level for them makes a what-if: a copy of the rotation in Theorycraft
     at that level, paired with this one so you can switch between the two. A character you don't
     own keeps the level this rotation gives them, and their chip is drawn hollow. In Theorycraft
     every level belongs to the rotation."

3. **Zoom** (`:150`): "**Zoom** in the view bar…" → "**Zoom** in the toolbar…"

4. **Layers** (`:154`): "**Buffs** and **Auras** in the view bar are layers." → "…in the toolbar
   are layers."

5. **Human timing** (`:178`). It has left the toolbar; a tag beside the Total opens Settings.
   - Now: "…Turn Human timing off in the view bar to see the frame-perfect rotation."
   - Proposed: "…Turn Human timing off in Settings to see the frame-perfect rotation. While it's on,
     a **Human timing** tag beside **Total** says so and opens Settings."

6. **Aura log** (`:253`): "**Log** in the view bar opens…" → "**Log** in the toolbar opens…"

7. **Notes** (`:271`): "…with constellation notes shown from the level the tab uses." → "…from the
   level the rotation uses."

8. **Section heading** (`:283`): "Tabs, saving, and sharing" → "Saving, comparing, and sharing"
   (anchor `#tabs` → `#saving`).

9. **Replaces the tabs paragraph, the Save paragraph and the Library paragraph** (`:285–300`).
   Three paragraphs:
   - "The Planner shows one rotation at a time and saves it as you work, in the profile you're in.
     The rotation's name in the top bar opens **Rotations** in the Library, where **New rotation**
     starts another and each one can be pinned, renamed, or deleted."
   - "A rotation in Theorycraft can go to one of your profiles with **Move to a profile**. Before it
     moves, you see which levels change, since the profile's roster decides them for characters you
     own."
   - "**Compare** in the toolbar pairs two rotations. **Duplicate and compare** copies this one so
     you can change the copy, and **Compare with…** picks another from the Library. The button that
     takes Compare's place, or ⌃`, switches between them."

10. **Share** (`:303`). Share is in the top bar, and a link opens in Theorycraft.
    - Now: "**Share** copies a link, the KQM notation, or an image of the timeline. The link opens
      the rotation with its constellations and loadouts in a new tab without touching the reader's
      roster. …"
    - Proposed: "**Share** in the top bar copies a link, the KQM notation, or an image of the
      timeline. The link opens the rotation with its constellations and loadouts in Theorycraft, so
      it doesn't change the reader's profiles. …" (the rest unchanged)

11. **On a phone** (`:318`): "…which the **Bench** button in the view bar hides." → "…in the toolbar
    hides."

## B. Team Builder chapter

12. **Lineups — opening line** (`TeamBuilder.svelte:29`)
    - Now: "**+** in the document bar starts a new lineup in one of three shapes:"
    - Proposed: "**New lineup**, in the Library under **Lineups**, starts a lineup in one of three
      shapes:"

13. **Custom** (`:41`): "…and **Add team** in the view bar for more…" → "…in the toolbar for
    more…"

14. **Replaces the tabs paragraph** (`:46`)
    - Now: "Each lineup is a tab: Double-click to rename it and drag to reorder. You can keep up to
      twelve tabs open at a time. A closed lineup with anyone in it goes to **Recently closed** in
      the Library."
    - Proposed: "**New lineup** on a team in **Teams** does the same, and the lineup starts with that
      team. The Builder shows one lineup at a time and saves it as you work. The lineup's name in
      the top bar opens **Lineups**, where each one can be pinned, renamed, or deleted."

15. **Building a team — from the Library** (`:77`). A Library row can no longer go onto a team.
    - Now: "From the Library, a saved team or rotation can go straight onto the selected team,
      replacing its members. With no team selected it goes to the first empty one."
    - Proposed: cut.

16. **Finding characters** (`:93`): "The view bar narrows further…" → "The toolbar narrows
    further…"

17. **The constellation lens** (`:97`). Teams now read your roster for characters you own.
    - Now: "…The constellation lens in the view bar sets that level: … It changes the Characters
      grid display only; the teams are read at their own constellations."
    - Proposed: "…The constellation lens in the toolbar sets that level: … It changes the Characters
      grid only. A team reads your roster for characters you own and its own level for anyone
      else."

18. **Rotations — the pin** (`:184`)
    - Now: "If you have already saved a rotation to your library for exactly the four characters in
      a team (in any order), … The team will then read its capabilities at that rotation's
      constellations. **Planner** opens the pinned rotation, or a new tab with the team's names if
      nothing is pinned. Changing the team's members drops the pin; the rotation itself stays in
      the Library under its original team."
    - Proposed: "If this profile has a rotation for exactly the four characters in a team (in any
      order), you will see the pin under **Planner** become a menu, which you can use to pin a
      specific rotation to that team. Characters you don't own then read that rotation's
      constellations. **Planner** opens the pinned rotation, or a new rotation with the team's
      names if nothing is pinned. Changing the team's members drops the pin; the rotation itself
      stays in the Library."

19. **Section heading** (`:195`): "Your roster, saving and sharing" → "Your roster and sharing"

20. **Your roster** (`:196`)
    - Now: "Your roster lives in the Library's **Roster** tab, also reached from **Edit in Roster** in
      a character's details. …"
    - Proposed: "Your roster is under **Roster** in the profile menu (your picture in the top bar),
      and **Edit in Roster** in a character's details goes there too. … In Theorycraft there is no
      roster: every character is there at every level." (the middle sentences unchanged)

21. **The team portrait chip** (`:202`). A character you own is always at your roster's level, so
    hollow now means "not owned".
    - Now: "…If it is filled, you own at least that constellation. If it's hollow, the team uses a
      constellation higher than you have (or a character you don't own)."
    - Proposed: "The chip on a team portrait is the constellation that team uses. A character you own
      is at your roster's level; the chip is hollow for a character you don't own."

22. **Saving and sharing** (`:207`)
    - Now: "An unsaved lineup follows your roster as it changes. **Save** puts the lineup in the
      Library and fixes each member's constellation as it was, so a saved lineup stays put.
      **Share** copies a link with the lineup's teams, preset, season, No repeats setting and
      constellations. (Pinned rotations are not included.)"
    - Proposed: "**Share** in the top bar copies a link with the lineup's teams, preset, season, No
      repeats setting, and constellations. (Pinned rotations are not included.) It opens in
      Theorycraft for the reader."

## C. FAQ, Privacy, Visualizers

23. **FAQ — is my data stored anywhere?** (`Faq.svelte:43`)
    - Now: "Everything you set up (your roster, loadouts, saved rotations and lineups, and settings)
      is stored in this browser and nowhere else."
    - Proposed: "Everything you set up (your profiles with their rosters, teams, rotations, and
      lineups, and your settings) is stored in this browser and nowhere else."

24. **FAQ — moving to another device** (`:54`)
    - Now: "The file carries your settings, roster, constellations, loadouts, saved rotations and
      lineups, open tabs, and the Visualizers' layout."
    - Proposed: "The file carries every profile in this browser, each with its roster, teams,
      rotations, and lineups, plus your settings and the Visualizers' layout."

25. **FAQ — Human timing** (`:111`)
    - Now: "Turn it off in the Rotation Planner's view bar to see the frame-perfect rotation, or tune
      it in Settings."
    - Proposed: "Turn it off in Settings to see the frame-perfect rotation, or tune it there."

26. **Privacy — what stays in your browser** (`Privacy.svelte:25–32`). The data now lives in
    IndexedDB as well as local storage, and is grouped by profile.
    - Lede now: "Everything you create is kept in this browser's local storage, on this device only:"
      → "Everything you create is kept in this browser, on this device only:"
    - Items "Your roster: …", "Weapon and artifact loadouts.", "Saved rotations and teams, and saved
      lineups." and "Open tabs in the Rotation Planner and the Team Builder, and their recently
      closed tabs." → ONE item: "Your profiles, each with its name, picture, and color, its roster
      (which characters you own or have wishlisted, at what constellation, with their loadouts), its
      teams, rotations, and lineups, and which of them is open."

27. **Privacy — reset** (`:37`)
    - Now: "**Reset saved data** in the same place clears your roster, loadouts, saved rotations, and
      saved lineups but keeps your settings."
    - Proposed: "**Reset saved data** in the same place clears the profile you're in: its roster,
      loadouts, rotations, lineups, and teams. Your settings are kept."

28. **Privacy — the storage ask** (`:45`): "The first time you save a rotation or lineup…" → "The
    first time you change a rotation or lineup…"

29. **Visualizers — the workspace** (`Visualizers.svelte:24`). "Lineup" now names a Builder
    document, so the default instruments get their own word.
    - Now: "**Instruments shown** in the document bar can lower the count, and **Reset layout** puts
      back the default lineup. Both are hidden when only one tile fits."
    - Proposed: "**Layout**, beside the last tile, can lower the count, and its **Reset layout** puts
      back the default instruments." (Checked: under the switch **Layout** shows even when one tile
      fits, so the "hidden" sentence goes.)

30. **Visualizers — each tile** (`:31`)
    - Now: "Each tile has its own **Defaults**, which resets that instrument's controls, and
      **Share**, which copies a link that reopens the instrument exactly as it looks now (the link
      always opens in the reader's first tile). The tile's **⋯** menu has **Report a problem** for
      sending feedback related to that instrument."
    - Proposed: "Each tile has **Copy link**, which copies a link that reopens the instrument exactly
      as it looks now (the link always opens in the reader's first tile). The tile's **⋯** menu has
      **Defaults**, which resets that instrument's controls, and **Report a problem** for sending
      feedback related to that instrument."

## D. Strings in the new surfaces

31. **Teams — empty state** (`TeamsPlace.svelte`). "team … as a team" repeats itself.
    - Now: "No teams yet. Make one here, or save the team on the Planner's bench as a team."
    - Proposed: "No teams yet. Make one here, or use **Save as team** on the Planner's bench."

32. **Profile form — what a profile is** (`ProfileForm.svelte`). It leaves out teams.
    - Now: "A profile is one Genshin account, kept in this browser: its roster, rotations, and
      lineups. Shared links still open in Theorycraft, so your profiles stay as you left them."
    - Proposed: "A profile is one Genshin account, kept in this browser: its roster, teams,
      rotations, and lineups. Shared links open in Theorycraft, so your profiles stay as you left
      them."

33. **Teams — the lineup button** (new today). It was "Add to a lineup" and now makes a new lineup.
    - Proposed: keep **New lineup**, the same words as the Library's button, since it opens the same
      menu.

34. **Not yet worded, flagged:** "Use the new layout" in Settings goes away at the flip (no way back
    for users), so it needs no review.
