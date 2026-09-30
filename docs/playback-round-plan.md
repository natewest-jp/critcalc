# Playback round — plan (2026-09-29)

**Status:** ✅ SHIPPED — merged to `main` as `6f3195ec` and pushed 2026-09-30 (e2e green at `ff0b5b7a`). Pitched by Nate 2026-09-29; built as two rounds back to back plus two finishing passes (§10). ⏭ Nate checks the first count-in note on iOS on the live site. The body below is the original plan; §10 is the record and wins over it.

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

| Where                    | Kind       | Now                                                                                          |
| ------------------------ | ---------- | -------------------------------------------------------------------------------------------- |
| Band B transport group   | aria-label | Playback                                                                                     |
| Rewind plate             | aria-label | Back to the start                                                                            |
| Rewind plate             | title      | Back to the start (Home)                                                                     |
| Play plate, idle         | aria-label | Play the rotation                                                                            |
| Play plate, idle         | title      | Play the rotation at game speed (Space)                                                      |
| Play plate, playing      | aria-label | Pause                                                                                        |
| Play plate, playing      | title      | Pause (Space)                                                                                |
| Speed plate              | aria-label | Playback speed {rate}                                                                        |
| Speed plate              | title      | Playback speed: {rate}. Slow down to learn a rotation; the count-in keeps its pace           |
| Speed values             | label      | 1× · 0.75× · 0.5×                                                                            |
| Band B fold (⋯, compact) | aria-label | Playback, timing and panels                                                                  |
| Band B fold              | heading    | Speed                                                                                        |
| Band B fold              | items      | Repeat · Human timing · Log · Notes                                                          |
| Settings, Sound row      | option     | Off (beside Metronome, Melodic)                                                              |
| Settings, Sound row      | desc       | **Off** runs the cursor in silence, with no count-in. (prefixed to the existing description) |

↻ 2026-09-30: the Sound plate's three strings RETIRED with the plate (on/off moved to the
Settings Sound row).

Notes: "press" is the glossary-neutral word for an input (a tap or a key) and matches the
cue rule (§5: the sound marks the PRESS). ⚠️ "count-in" is musicians' vocabulary — a 🏷
context note for translators, not a term to freeze.

### 6.2 Strings added by the sound-sets follow-up — for `docs/text/sheets/settings.md`

| Where                    | Kind       | Now                                                                                                                                                                                                                                    |
| ------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings, section title  | kicker     | Playback sound                                                                                                                                                                                                                         |
| Settings, section lede   | prose      | **Play** on the planner's toolbar counts you in and sounds a tone at every press, so you can follow a rotation with your eyes on the game. Pick the set you can follow.                                                                |
| Settings, sound row      | name       | Sound                                                                                                                                                                                                                                  |
| Settings, sound row      | desc       | The metronome is one pitch and says only when. A melodic voice gives the attacks, the skill and the burst three notes of a pentatonic scale, so notes that overlap never clash.                                                        |
| Settings, sound segment  | options    | Metronome · Melodic (aria: Sound)                                                                                                                                                                                                      |
| Settings, voice segment  | options    | Kalimba · E-piano · Music box · Handpan · Marimba · Vibraphone (aria: Voice)                                                                                                                                                           |
| Settings, preview button | label      | Preview (aria: Preview the sound)                                                                                                                                                                                                      |
| Settings, order row      | name       | Order                                                                                                                                                                                                                                  |
| Settings, order row      | desc       | Which note sits where. **Weighty** puts the heavier input lower — attacks high, burst low. **Skill up** keeps attacks in the middle and lets the skill announce itself. **Rising** puts the heavier input higher.                      |
| Settings, order segment  | options    | Weighty · Skill up · Rising (aria: Note order)                                                                                                                                                                                         |
| Settings, notes row      | name       | Notes                                                                                                                                                                                                                                  |
| Settings, notes row      | desc       | Which three steps of the scale the notes take, counting from the root. Every voice plays them in its own key and register.                                                                                                             |
| Settings, notes segment  | options    | 1 · 2 · 5 · 2 · 5 · 6 · 2 · 3 · 5 (aria: Note set)                                                                                                                                                                                     |
| Settings, swap row       | name       | Swap                                                                                                                                                                                                                                   |
| Settings, swap row       | desc       | A swap is a soft hum held until the next character arrives, the one sound that is not struck. **Low** is a single low tone, **Fifth** an open pair, **Breath** a breath of air with no pitch, **Rise** the low tone bending gently up. |
| Settings, swap segment   | options    | Low · Fifth · Breath · Rise (aria: Swap sound)                                                                                                                                                                                         |
| Settings, volume row     | name       | Volume                                                                                                                                                                                                                                 |
| Settings, volume row     | desc       | The notes against the game's own level.                                                                                                                                                                                                |
| Settings, volume slider  | aria-label | Playback volume                                                                                                                                                                                                                        |

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

- **The hum** — 2026-09-29 (⚓ Nate: "maybe a hum is a good idea — demo that"). `SwapStyle` (`slide` | `hum`) as a third Settings row and `siteSettings.playbackSwap`; the palette is `paletteFor(set, assignment, swap)` and the sounder takes a `SoundChoice`. The hum is two sines (an octave under the burst's note, and its octave) with a 40 ms attack (`Layer.attack`) and no click, held for the swap's length — the one sound in the set that is not struck. ⏭ Nate also asked, before more assignments, for an ALLOCATION of inputs to tones (E/hE, Q/sQ, N/C, P, D/J); Claude's answer of 2026-09-29: three pitched roles (attack, skill, burst) + the cancel tick + the count-in — five notes, one pentatonic octave — with hE→E, sQ→Q, C/A→attack by length, and ⏭ P folded into attack (retiring the two-note plunge figure) once Nate confirms. ⚠️ Nate: "a rising 1-2-3 doesn't sound pentatonic either — it just reads as the start to a scale" — the chime-rising pair is for striking.

- **Three notes** — 2026-09-29 (⚓ Nate: "we have to pick a solid three (E, Q, Normal-type) and then base the other sounds around those"; the input allocation agreed). The vocabulary is now three roles — ATTACK (N, C, A, P), SKILL (every E, sE), BURST (Q, sQ) — plus the cancel tick (D, J), a hum for the swap, and the count-in; `W` is refused and silent; the two-note plunge figure is gone (a plunge is a long attack note after a jump's tick). Settings: **Sound** = Metronome | Melodic, with a **voice** picker under Melodic (`playbackSoundMode` + `playbackVoice`) · **Order** = Weighty | Skill up | Rising (`ORDERS`: which role sits low/mid/high; Close and the chimes are gone) · **Notes** = 1 · 2 · 5 | 2 · 5 · 6 | 2 · 3 · 5 (`NOTE_SETS`: the three steps, the cancel above them, the count on a free step) · **Swap** = four hums, Low | Fifth | Breath | Rise (⚓ Nate: the hum is "by far the best"; the slide is retired). `SoundChoice = {set, order, notes, swap}`; stored legacy ids migrate in `loadSiteSettings`. ⏭ Nate: pick an order, a note set and a hum; the survivors may then become constants.

- **Nate's notes** — 2026-09-29 (⚓ at a keyboard; the earlier "steps" were A-major intervals, not pentatonic ones). ⚓ EVERY VOICE ON THE SAME NOTES: per-voice key and register are GONE (the handpan's minor, the marimba's and e-piano's lower octave, the music box's upper). ⚓ A4 is the bottom of every set and A5 the cancel tick; the two notes between come from A B D E F♯ (D major pentatonic). Four sets, named by Claude for how they sit: **Open** A·B·E (suspended, airy) · **Anchor** A·D·E (fourth-and-fifth, grounded) · **Lantern** A·B·F♯ (the sixth leans minor, wistful) · **Meadow** A·E·F♯ (added sixth, bright). The count-in takes a free note inside the span (D, B, D, D). Orders unchanged. Swap hums: Breath STRUCK; Low, Fifth, Rise stay. ⏭ Nate picks a set, an order and a hum.

- **Materials** — 2026-09-29 (⚓ Nate: keep only well-differentiated voices, "I like when it sounds like an actual material being struck"; he brought the staggered-envelope advice, which is right and was half-applied). Kalimba and handpan STRUCK (least differentiated, most synthetic); e-piano retargeted to **Pipe** (a closed tube, odd harmonics ×3 ×5 ×7, an octave down — the hollow sound he heard in it); music box retargeted to **Bell** (muted metal, inharmonic ×2.76 ×5.4 ×8.93); **Marimba** rebuilt (×3.93, ×9.5, a felt thud, an octave down); **Vibraphone** kept (×4 sustaining, ×10 shimmer); **Glass** new (×2.32, ×4.25, the brightest faintest chime — the soft option). Every voice is a `Material` — partials with their own gain, base length AND `ringScale` (share of a long ring, ⚓ damping rises with frequency, so the tail sounds like a thing vibrating) plus the material's own transient band. Per-strike humanising: ±3 cents and up to 6 % level, shared by a strike's partials. Per-voice `octave` is back (the NOTES stay the same; a material plays them in its register). Retired voice ids migrate (epiano→pipe, musicbox→bell, kalimba/handpan→glass); default voice glass. ⏭ Nate: every partial and transient is a knob.

- **Defaults** — 2026-09-29 evening (⚓ Nate, `tune(nate)`): Vibraphone · Skill up · Anchor. He may revise in the morning.

- **Finishing round** — 2026-09-30 (⚓ Nate greenlit the list, in this order). ⚓ The count-in is **FOUR** beats, a constant (not a setting), and its last beat is the same sine an octave up (`countLast`). ⚓ **Every start counts in**, a resume included — the cursor waits at the paused spot through the beats; `dueBetween`/`positionAt` take a `start`. **⏮ Rewind** beside Play (Lucide `SkipBack`, filled): parks at 0, or mid-play goes again from the top with the count-in. **Sound on/off moved to Settings** (Off beside Metronome | Melodic); the band's speaker plate and the `sound`/`soundOff` marks retired. **Speed** 1× · 0.75× · 0.5× (a cycling plate, lit when not 1×, fixed at 49px): the rotation's axis divides by the rate, ⚓ the count-in keeps its one-second beat; a change inside the count-in restarts the beats. **Keys**: Space plays/pauses, Home rewinds — never in a text field, under a modal, on a keyboard-focused control, or off the planner's route; ⚠️ `:focus-visible` could NOT gate this (Chrome makes a clicked button focus-visible at the first key), so the pointer is tracked. **Band B re-fit**: `wide` 68rem → **82rem** (the left zone is 485px; the Repeat plate had already broken the old fact on 09-29), and below `compact` one ⋯ holds Speed, Repeat, Human timing, Log, Notes. Measured 320–1920: no overflow, the Total clears by ≥ 17px.

- **Second finishing pass** — 2026-09-30 (⚓ Nate, after testing the first). Defaults **Vibraphone · Weighty · Anchor** (`tune(nate)`). Swap gains **Off**. Settings condensed: rows show only when audible (nothing under Off; no Voice/Notes under the metronome); Order + Notes are ONE "Notes" row; per-option prose moved to titles. Band B: **Reset** moved inside the zoom group after + and took **ScanSearch**; **Repeat → Laps** with **ArrowRightFromLine** (⚓ "repeat" named a loop, and playback already loops). Internal names (`pv.repeat`, `REPEAT_LAPS`, `repeat.ts`) unchanged. `wide` stays 82rem (left zone now 469px).

- **Zoom popover** — 2026-09-30 (⚓ Nate: the zoom cluttered the bar and is set-and-leave). Band B's steppers, slider and Reset became ONE **Zoom** plate (ZoomIn mark + word, a chevron) opening an anchored popover — `BandMenu` with a new `role="dialog"` — holding − slider +, the scale as a % of the resting one, and **Reset** as a word (the ScanSearch/`resetZoom` mark retired). ⛔ Not a scrimmed modal: the chart rescales live behind it. The left zone fell 469 → 295px and `wide` came down **82rem → 71rem**.

## 11. Where to resume (written 2026-09-30, before the merge — ✅ the merge and push are done)

**State:** branch `feat/planner-playback` in the worktree `~/Code/critcalc-playback`; every commit's vitest / check / lint / build green. The finishing round (§10, last entry) is built and committed. ⛔ Not merged, not pushed.

**Nate owes:**

1. Listen to the four-beat count-in and its octave-up last beat.
2. Judge on screen: the ⏮ and speed plates (desk width), the ⋯ fold at phone width, the full form's arrival at 82rem.
3. The standing calls from 09-29: keep-or-trim voices / orders / note sets / hums; `REPEAT_LAPS`; the lap-mark register; whether the energy caveat needs a home besides Help.
4. Real Safari: the transport keys and the first count-in beat on iOS (the context resumes inside the tap).

**Then:** e2e (two "N passed" lines) → merge `--no-ff` → push when asked. The §6.1–§6.2 strings go to the text sheets when the branches meet.

**Later (parked):** clicking the ruler to set the start point (⚓ agreed 2026-09-30 as the next step, before any draggable playhead) · a guzheng pluck needs an AudioWorklet · the aura log has no lap column · the stream's `src` ranges point past the document (no reader) · the round-A rulings on `pointer: coarse` and the drawer stay with the responsive survey.
