# Playback round — plan (2026-09-29)

**Status:** PLAN. Nothing built. Pitched by Nate 2026-09-29; scoped as two rounds run back to back, both pre-launch.

## 1. What this is

The Rotation Planner's timeline gains a **playhead**: press play and a cursor travels the chart at real speed, with a sound at every input so the rotation can be followed with eyes on the game. A second control, **Repeat**, keeps simulating the rotation forward — lap after lap, joined by a swap back to the opener — so the chart shows what the second, third and later laps actually look like: where a cooldown makes a cast wait, which buffs spill across the seam, how the aura state carries.

⚓ **The tool does not judge whether a rotation "loops"**. It draws the next laps and the reader sees whether they match. This is the buff-pool / tiling posture already taken in the Team Builder (a repeat is a CLAIM, disclosed in the footnote), applied to time.

Origin: Nate's in-game test batch (`project_ingame_test_batch`). Following a static chart while playing is impossible; following a metronome is not.

## 2. The two modes

|                           | Repeat OFF                                   | Repeat ON                                                                       |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| What is simulated         | The document, once (today's parse)           | The document joined to itself `LAPS` times                                      |
| What play does at the end | Wraps to 0                                   | Keeps going until the drawn horizon, then stops and says so                     |
| Seam                      | None — the wrap is a rhythm aid, not a claim | A **swap** back to the opener, charged under human timing exactly as any `>` is |
| Notation change needed    | None                                         | **None** — see §4                                                               |

Repeat OFF + play is for feeling the rhythm; it does not care how the notation ends. Repeat ON is the analysis.

## 3. The stream model

Repeat ON simulates `notation + ' > ' + notation + …` — appending SEGMENTS, never editing text. The sim already does the work:

- A cast on cooldown **waits**: `run.ts` advances the clock to the E charge's `readyAt` or `cs.qReadyAt`. A late opener is a gap at the seam; a late second character shifts everything after it. Both are drawn by the existing pill + ghost-tail register with no new bar kind.
- Buffs, fields, stacks, states and auras **carry across the seam** because it is one IR stream. Lap 2's buff bars are lap 2's truth, not lap 1's copied.
- The seam is `totalDuration`, which is the last action's END frame before the drain (`run.ts` ~2343) — the right instant for a swap.

### 3.1 Seam rules

- **Same character on both sides.** The sim charges `swapF` between EVERY segment pair (`run.ts` ~2335), including two consecutive segments of one character. When the rotation ENDS on its opener, the join must **merge** the last and first segments rather than insert a swap. ⏭ Decide whether to fix the general case in the sim (a consecutive same-character `>` should cost nothing) or merge only at the seam. Recommendation: fix the sim — it is a pre-existing inaccuracy.
- **Stack asserts `{key:N}`.** ⚓ RULED (Nate 2026-09-29): braces notation is an ARTEFACT of the sim's pre-aura era, is not documented to users, and is to be **retired** as its own small cleanup later. Until then the repeat strips asserts from appended copies — lap 1 only, the carried count is the truth after that.
- **`gainStacks … onSwapIn`** fires at every real swap-in already, so the opener's swap-in at lap 2 grants correctly; lap 1's "takes the field" grant stays.
- **Provisional / refused tokens** repeat as they are. The lint runs on the DOCUMENT, never the stream.

### 3.2 Cost and horizon

- `LAPS` is a named constant (Nate-tunable). Start at a handful; the stream settles into a period within two or three laps for every kit we know, and the horizon is disclosed on the ruler.
- Parse cost is linear in laps. Lap 1 keeps parsing per keystroke as today; the appended laps are computed only while Repeat is armed and may be deferred a frame. Bound `LAPS × tokens` rather than the text length — `MAX_NOTATION_CHARS` guards the document, and the stream is derived, so it is not re-checked as text.
- DOM cost is linear in laps too (pills, ticks, aura markers). ⛔ Never `{#if}` rows away — gate at the PROJECTION, as the layers do.
- No resumable sim. Re-running from scratch for N laps is O(N) per arm and cheap at the sizes in play. A resumable `SimContext` is a refactor this round does not need.

### 3.3 What the stream is NOT

- ⛔ Not in the `?r=` codec. Repeat and play are view state (`plannerView`), like zoom.
- ⛔ Not in the PNG export. The export is the DOCUMENT, one lap.
- ⛔ Not a text edit. The editor never sees the appended copies; the notation stays the single source of truth.
- ⛔ Not locked. Arming does not freeze the editor (non-modal tool surfaces). Editing while armed re-sims the stream.

## 4. Notation

**No new token, no required trailing `>`.** The join IS a swap, so `>` is the right seam, but the Repeat control supplies it. Requiring the user to type a trailing `>` would (a) lint as an empty segment, (b) duplicate the toggle's statement, (c) break every existing shared rotation's ability to be repeated. KQM rotations are loops by convention and carry no marker; neither do ours.

## 5. Sound

Sound is what makes the in-game case work: a hidden tab freezes `requestAnimationFrame`, but **scheduled Web Audio keeps playing**. The audio clock leads; the cursor follows it.

- **Synthesised, no assets.** Oscillator envelopes from `AudioContext`, a few milliseconds each.
- **A small palette by input class**, learnable without looking: N a short click · C a longer click · E a mid tone · Q a low, longer tone · swap a two-note step · D/J a tick. ⚓ The sound marks the **PRESS** (`CastEvent.time`), never the hit — human-timing pads move presses and the sound follows the sim.
- **Count-in** before the first press, so the first input is not a surprise. ⏭ Length is Nate's.
- **Scheduling.** Look-ahead scheduler on the audio clock (a timer that keeps the next ~2 s queued). Background tabs throttle timers to ~1 s; a 2 s look-ahead survives that. On Repeat ON the scheduler walks the stream.
- **Autoplay.** The `AudioContext` is created/resumed inside the play click (iOS Safari requires a gesture).
- **Speech (`speechSynthesis`) is a LATER layer, not this round.** It is free and built in, but an utterance starts 50–300 ms late depending on engine, cannot be scheduled on the audio clock, and voices load asynchronously on Safari. If tones prove insufficient, speech works as a lead-in cue ("Xiangling") a fixed beat BEFORE the swap, never as the timing mark itself.
- A sound-off toggle. Volume is the OS's.

## 6. UI

- **Transport lives in band B** (the VIEW band): a play/pause plate, a Repeat plate, sound on/off. Speed chips (the Gauge Explorer's 0.25/0.5/1) are for reading, not testing — include them only if band B has room below `wide`; the narrow round already folds band B's word labels and the slider there. ⚠️ Re-measure `BAND_CTRL_H`-adjacent geometry only if a control's type or padding moves (band B is 36; band A's 29 is MEASURED).
- **The cursor** is one vertical rule on the SVG overlay, drawn straight on the night, no ground. Paint-only alpha (sub-pixel laws). Reuse `createPlayhead`/`advance` from the Visualizers (`visualizers/lib/playhead*.ts`) — lift them to `$lib` rather than duplicate.
- **Following the cursor.** The track scroller has a documented hazard around programmatic `scrollLeft` during momentum scrolling and a ruler that mirrors it. **Page-jump** when the cursor nears the edge; ⛔ no smooth follow this round.
- **Lap marks on the ruler** (Repeat ON): a seam line labelled by lap so the reader knows which repeat they are looking at. The event log numbers events in time order already; a lap column is optional.
- **Footnote** (Repeat ON): energy is unmodelled — a burst without energy is the most common reason a real rotation fails to repeat, and the planner draws that Q as ready. Same footnote posture as TB Compare's tiling.
- **Reduced motion.** The cursor is user-initiated motion; the Gauge Explorer precedent plays it. Keep parity.
- ⚠️ **Strings** (Play, Pause, Repeat, Sound, the count-in label, the footnote, the horizon notice) go through `docs/text/style-guide.md` + glossary and land in the text round's worksheets.

### 6.1 Strings added by Round A — for `docs/text/sheets/rotation-planner.md`

⚠️ The worksheets live on the text branch; these rows go into the planner sheet's next
"Added" section when the branches meet. Keys are left to the extraction pass.

| Where                  | Kind       | Now                                                         |
| ---------------------- | ---------- | ----------------------------------------------------------- |
| Band B transport group | aria-label | Playback                                                    |
| Play plate, idle       | aria-label | Play the rotation                                           |
| Play plate, idle       | title      | Play the rotation at game speed                             |
| Play plate, playing    | aria-label | Pause                                                       |
| Play plate, playing    | title      | Pause                                                       |
| Sound plate            | aria-label | Sound                                                       |
| Sound plate, on        | title      | Sound on: a three-beat count-in, then a tone at every press |
| Sound plate, off       | title      | Sound off                                                   |

Notes: "press" is the glossary-neutral word for an input (a tap or a key) and matches the
cue rule (§5: the sound marks the PRESS). ⚠️ "count-in" is musicians' vocabulary — a 🏷
context note for translators, not a term to freeze.

### 6.2 Strings added by the sound-sets follow-up — for `docs/text/sheets/settings.md`

| Where                       | Kind       | Now                                                                                                                                                                                                                                                                                            |
| --------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings, section title     | kicker     | Playback sound                                                                                                                                                                                                                                                                                 |
| Settings, section lede      | prose      | **Play** on the planner's toolbar counts you in and sounds a tone at every press, so you can follow a rotation with your eyes on the game. Pick the set you can follow.                                                                                                                        |
| Settings, sound-set row     | name       | Sound set                                                                                                                                                                                                                                                                                      |
| Settings, sound-set row     | desc       | Percussive is a drum kit — hats for attacks, a woodblock for a skill, a tom for a burst. Melodic is a kalimba on a pentatonic scale, so notes that overlap never clash. Either way the heavier the input, the lower and longer the sound.                                                      |
| Settings, sound-set segment | options    | Percussive · Melodic                                                                                                                                                                                                                                                                           |
| Settings, sound-set segment | aria-label | Sound set                                                                                                                                                                                                                                                                                      |
| Settings, preview button    | label      | Preview (aria: Preview the sound set)                                                                                                                                                                                                                                                          |
| Settings, notes row         | name       | Notes                                                                                                                                                                                                                                                                                          |
| Settings, notes row         | desc       | Which note each input gets, on any voice. **Weight** puts the heavier input lower — burst at the bottom, attacks at the top. **Skill up** keeps attacks in the middle and lets the skill announce itself. **Rising** puts the heavier input higher. **Close** keeps everything within a fifth. |
| Settings, notes segment     | options    | Weight · Skill up · Rising · Close                                                                                                                                                                                                                                                             |
| Settings, notes segment     | aria-label | Note assignment                                                                                                                                                                                                                                                                                |
| Settings, volume row        | name       | Volume                                                                                                                                                                                                                                                                                         |
| Settings, volume row        | desc       | The tones against the game's own level.                                                                                                                                                                                                                                                        |
| Settings, volume slider     | aria-label | Playback volume                                                                                                                                                                                                                                                                                |

## 7. Sequencing

**Round A — Playback + sound** (the test-batch need): playhead lifted to `$lib`, band-B transport, cursor + page-jump follow, Repeat-OFF wrap, audio palette + count-in + scheduler, strings.
**Round B — Repeat stream**: the segment-append join, seam rules (§3.1), `LAPS`, projection gating, lap marks, footnote, horizon notice.

A ships alone if B slips; B is useless without A.

## 8. Gates

Per round: vitest / check / lint / build. `advance()` and the audio SCHEDULE (a pure list of `{t, kind}`) are vitest-able; the sound itself is not — Nate listens. e2e before merge (band DOM changes; a portal if the transport ever needs to escape a band). ⚠️ Real Safari: new visual work re-opens the backlog by one — the cursor, the transport plates, and iOS audio resume are the items.

## 9. Decisions for Nate

✅ Nate agreed to every recommendation on 2026-09-29: asserts lap-1 only (and braces notation retires later, §3.1) · fix the same-character swap charge in the sim · six-class palette, count-in length tuned by ear · speed chips only if band B has room below `wide` (Round A ships without them) · `LAPS` starts as a knob and is tuned on screen.

## 10. Record

- **Round A** — branch `feat/planner-playback` (worktree), started 2026-09-29. Built the same day: `$lib/playback/` (`cues.ts`, `transport.ts`, `tones.ts`, `playback.svelte.ts` + two vitest files), the cursor and page-jump follow in `RotationTimeline.svelte`, the transport plates in band B, `siteSettings.playbackSound`, marks `sound`/`soundOff`. Measured in headless Chrome: count-in holds the cursor at 0 for 3s, then 60px/s at the resting zoom; pause holds; band B fits from 320 (sound plate folded, Play at 24px below `compact`). ⏭ Nate: listen to the palette; judge the gold cursor; decide where the sound preference lives on a phone. ⚠️ Speed chips deliberately absent. ⚠️ `loop` (cursor wrap) is ON with no control yet — Repeat's plate in Round B is the natural owner.

- **Round B** — same branch, built 2026-09-29. `$lib/playback/repeat.ts` (`repeatNotation`: trailing connectors dropped, asserts blanked to equal-length spaces in the copies, `REPEAT_LAPS` = 5 in all) + tests; the timeline parses `docRotation` (the document) and `rotation` (the stream while armed) and every projection reads the stream, so the sim's own waits and carries come through; lap marks `×2…` on the ruler with faint seam lines down the tracks; the Total stays the document's and `pv.playbackEnd` carries the horizon; the PNG export disarms Repeat for one synchronous snapshot (deriveds are pulled) and restores it; the tints read the document. ✅ §3.1's sim fix shipped GENERALLY: a `>` between two segments of one character charges no swap delay and opens no swap-in pad (`run.ts` `swappedIn` / `swapFollows`). The cursor runs to the horizon and stops while Repeat is lit; wraps at the document's end otherwise. Help chapter: a "Play and Repeat" paragraph carries the energy caveat. Measured in headless Chrome: a four-character rotation of 10.7s drew five laps at 7704px, lap 2 opening at 10.7s and later laps 25.3s apart (Fischl's 25s skill), the cursor at 60px/s in every mode. ⏭ Nate: the lap-mark register, whether the ruler should also state the horizon, and where the energy caveat should live besides Help. ⏭ Open: `src` ranges in the copies point past the document (no reader today); the aura log lists every lap with no lap column.

- **Sound sets follow-up** — same branch, 2026-09-29 (⚓ Nate: two sets, chosen by listening). `tones.ts` rebuilt on LAYERS (a pitched oscillator with an optional glide, or white noise through a bandpass, each with an attack of 3 ms and an exponential decay): **percussive** = closed/open hat, woodblock, tom, claves, metronome click; **melodic** = a kalimba voice (fundamental + a faster-dying second harmonic + a whisper of click) on A major pentatonic, A4–C♯6, count-in on the one note no input takes (F♯5). Rules the palettes obey and why are in the module head. `siteSettings.playbackSoundSet` (default percussive) + `playbackVolume` (0.7) in a new Settings block: choosing a set previews it, a Preview button plays the phrase again (normal, normal, skill, burst, swap), the volume slider previews on release. The beeps palette is RETIRED. ⏭ Nate: every gain and duration is a knob; the per-set trim; whether the count-in's last beat should be accented.

- **Length and the drum machine** — same branch, 2026-09-29 (⚓ Nate: "we have all the frame data"). Every cue carries `dur`, the block's drawn length (a cast's cancel-adjusted animation, a swing's duration, a swap's delay to the arrival). The kalimba's two partials are `sustain` layers: they ring for `ringFor(base, dur)` = the input's length less `RELEASE_S` (20 ms), floored at the base note and capped at `MAX_RING_S` (4 s), still decaying — so a burst rings for its animation and a human-timing pad plays as silence. ⚓ Melodic only; drums do not sustain, and that is now the audible difference between the sets. A swap's second note is a `delay: 'end'` layer in BOTH sets: it lands where the new character takes the field, so the gap is the ping. The percussive set was rebuilt on drum-machine recipes with a new `metal` layer kind (a bank of squares through a bandpass and a highpass): rimshot (normal), cross-stick (charged), woodblock (skill), tuned tom (burst), high tom (plunge), the tightest 808 hat (cancel), cowbell → cowbell a fourth up (swap), metronome click (count-in). Preview steps carry plausible lengths so the melodic set is heard ringing. ⏭ Nate: the whole percussive kit by ear; `RELEASE_S` and `MAX_RING_S`.

- **Snare** — 2026-09-29 (⚓ Nate: the percussive charged attack was too faint; "a charged attack is something more like a burst — a bigger attack"). The cross-stick is replaced by an 808 snare: two sine bodies (200→150 Hz, 330 Hz) under a wide band of noise, 140 ms. Nate approved the rebuilt kit otherwise and the length-scaled kalimba ("extremely helpful for a lot of people to track with the recording").

- **Five voices** — 2026-09-29 (⚓ Nate: "build all four, and if any of them don't sound right I'll strike them"). The pitched sets are now `kalimba` (was `melodic` — the stored id migrates in `loadSiteSettings`), `epiano` (an FM tine: modulator at the carrier's pitch, index 1.8 dying in 120 ms, over a sine body), `musicbox` (inharmonic partials ×2.76, ×5.4), `handpan` (1:2:3 stack with a 30 ms pitch dip on the strike), `marimba` (a strong fourth harmonic, dry). All five play ONE pentatonic assignment (`melodicPalette`) and differ only in the note's recipe (`Voice`); all sustain for the input's length. Two layer features carried it: `Tone.glide` (a strike's dip) and the `fm` layer kind. `SOUND_SET_LABELS` names them for the Settings segment, which wraps at six. ⏭ Nate strikes by ear; ⛔ a guzheng pluck is PARKED — Karplus-Strong needs a feedback loop shorter than Web Audio's render quantum, so it needs an AudioWorklet.

- **Tuning per voice, and a sixth** — 2026-09-29 (⚓ Nate: "build the whole list"). `SET_TUNING` gives each voice an OCTAVE and a MODE while the degree assignment stays shared (`roles()`: burst root · skill fifth · attack octave · cancel the third above · count the odd note out · swap fifth → octave). E-piano rebuilt with the Rhodes TINE (a second FM operator at ratio 14, 35 ms) and dropped an octave · marimba dropped an octave (it was a xylophone) · handpan MINOR and an octave down · music box UP an octave for Nate to judge · kalimba's second partial ×2.03 (a real tine's is sharp) · **vibraphone** added (the marimba bar in metal: the fourth harmonic sustains, a faint shimmer, floors ×1.8 via `durScale`). Seven sets; the picker is a 3-column grid, 3+3+1. ⏭ Nate strikes by ear (the e-piano first if anything); the music box's register; the 3+3+1 orphan.

- **At the DPS dummy** — 2026-09-29 (⚓ Nate, over game audio): EVERY voice carried; the drum kit did not (Genshin's SFX are broadband noise and a hat or a snare is camouflaged by its own kind); the two-hit swap was confusing. So: ⛔ the drum kit is RETIRED (a stored `percussive` migrates to `metronome`) and the non-melodic option is a **Metronome** — one pitch (1175 Hz, a woodblock-like ping) with the length rule, so class is told by weight alone · a **swap is one note that SLIDES** (`Layer.slide`, a frequency ratio over the swap's own length, so the pitch arrives at the new character's entry; the ping is inside one sound; a little quieter than a press) · a **Notes** setting (`playbackAssignment`) picks which degree each input gets, on any voice: Weight (the original) · Skill up (attacks on the fifth, skill on the octave) · Rising (heavier = higher) · Close (everything within a fifth, in thirds). Palettes are `paletteFor(set, assignment)`, memoised. Default voice is now Kalimba. ⏭ Nate: which assignment survives (the setting may then retire), the metronome's pitch, the slide's direction per assignment.

- **Chimes** — 2026-09-29 (⚓ Nate: the metronome passes; the assignments so far were octaves and fifths, "we're not really using the pentatonic scale truly" — wind chimes use NEIGHBOURING notes, and pitch separates them well enough). Assignments moved from named intervals to scale STEPS (1 = root … 6 = octave … 9), resolved per mode, and an assignment may carry a `mode` that overrides the voice's. Four chime assignments: Chime (attacks 3 · skill 2 · burst 1 · cancel 5 · count 4, major: C♯ B A), Chime minor (D C A), Chime rising (attacks 1 · skill 2 · burst 3), Chime rising minor. Eight assignments on a 4-column picker. ⚠️ Weight/Skill up/Rising's cancel is step 8, which in minor is D6 rather than the C6 it was. ⏭ Nate picks; the swap stays a slide for now (he is unsure but has no better concept — candidates in the reply of 2026-09-29: a soft low hum for the swap's length, a silent swap, a chord).
