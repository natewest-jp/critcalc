# critcalc design decisions (2026-04 to 2026-07)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

This file is the tactical companion to `project_design_constitution.md`. The constitution carries strategic intent (mission, theme, audience, preferences); this file carries the specific design calls that have been made on top of it. Append to this file as new decisions land.

Each settled decision carries the date it was confirmed. The "Open questions" section at the end tracks what's known to need a decision but hasn't gotten one yet — promote items out of it into the appropriate area above as they get settled.

---

## Landing layout

**Settled — 2026-04-26**

- The landing is a **contained, no-scroll cinematic frame**, sized to the viewport, full-bleed. The user does not scroll on the landing — the entire experience above the fold IS the landing.
- The landing escapes the site-shell chrome entirely. No global header, no global footer.
- Composition is built on the Perilous Trail reference scene (vast night sky reflected on polished marble plane), Blender-recreated as layered passes for layout flexibility and clean usage rights.
- The horizon line is a structural element — sky above (wonder, possibility), polished floor below (where the user stands), reflection bridging the two.
- Posture: rooted-then-ascending. The user stands on the floor with their choices in front of them and sky overhead. Picking a hero is the moment of ascent.
- No room for additional content (about-us, what's-new, contributors, etc.); such content lives on separate utility routes.
- Three heroes is the comfortable composition. A fourth or fifth tool would strain the scene.

---

## Heroes (tool entry points)

**Settled — 2026-04-26**

- Heroes hover in the **lower foreground** of the landing scene, over the polished floor — physically near to the user, the floor as their stage.
- Heroes are **small cosmic vignettes** — themed illustrations capturing the essence of each tool, rendered in the same cool-blue palette + warm starlight accents as the scene. Not screenshots; not bare icons.
- Vignette seed concepts (Nate-authored, vector):
  - **Crit Visualizer** — light dispersion, scatter pattern, a single bright point fanning into a probability arc. "How outcomes scatter from skill."
  - **Rotation Planner** — orbital paths, a pulsar's beat, a constellation traced in sequence. "Time, choreography, the trajectory of action."
  - **Team Builder** — alignment, conjunction, four bound lights. "Stars in synergy."
- Heroes hold low luminosity in repose so the starfield wins the first impression. Brighten on hover/focus — magnetism activates on engagement.
- Subtle stagger on landing entry (~250ms between heroes) enforces temporal hierarchy: cosmos first, then choices.
- **Authoring:** Nate is crafting these in vector. He'll return for concept inspiration and sizing recommendations when authoring begins.

---

## Transitions

**Settled — 2026-04-26**

- **Default transition (#1 — "lift and dim"):** click a hero → camera tilts up → floor exits off the bottom → horizon line travels past the bottom edge → starfield dims via overlay → tool panel fades in centered against the dimmed sky. Safe, legible, repeatable.
- **Transition #3 — "hero rises, world falls away":** chosen hero card lifts and grows; floor and other heroes fall away beneath; the chosen hero expands into the tool surface. Reserved for **cases where a natural visual fit exists** between the hero vignette and the tool's entry surface. Decide per tool when authoring.
- **Transition #2 — "through-the-light" (portal):** ~~reserved for the sister site (weaselthief.com)~~ — **superseded; see the 2026-05-31 amendment below.**

**Superseded / amended — 2026-05-31 (the cross-browser perf pivot)**

- **The camera-tilt transitions (#1 lift-and-dim, #3 hero-rises) are retired for _tool entry_.** A slow, full-viewport DOM camera-pan is near the cross-browser ceiling — smooth in Chrome/Safari, "disastrous" in Firefox (WebRender). A slow easing move can't survive even a few dropped frames, and reducing to 2 stars + a static placeholder didn't save it: the cost is a large surface travelling a long distance, not the star count.
- **critcalc's tool transition is now a portal / animated iris** — a gateway opening into the tool. Cheap to build robustly, and _more_ on-theme than the tilt: in Genshin, portals lead to the darker / more-powerful side of the Abyss — exactly the light↔dark gradient the constitution now describes (landing = open cosmos; tool = focused-power interior). The Spiral Abyss itself uses an iris-portal card, so it's canon-faithful.
- The portal was previously earmarked for the sister site only; it now lives on **both** sites (styling can diverge).
- **Portal implementation (video vs CSS/SVG iris vs canvas/WebGL) is deferred.** ~~deferred~~ — **BUILT 2026-06-07 as a CSS/WAAPI iris (NOT video), the predicted choice.** A magenta vortex plate scales/spins open from the clicked hero card over a black backing; dark-to-dark handoff into the tool's `#000` interior; reverse collapses back to the card. All transform+opacity → Firefox-safe by construction. Implementation detail + knobs + the two gap-bug fixes are in `docs/rounds/landing-status.md` (top section). What survived the pivot as planned: the persistent-scene architecture, the asset pipeline, the twinkle perf work, the SSR rest state. The pan-era machinery (75dvh tilt, side-crane, world-locked tool reveal/exit, motion blur, pre-armed twinkle freeze) is now dormant under the `PORTAL` flag — kept in `transition.ts` for revert, not removed.
- The transition is the user's first real interaction with the brand. It must feel cinematic, not chrome-y.

---

## Motion & life on the landing

**Settled — 2026-04-26**

- The landing is a **living scene.** Ambient motion is allowed and welcome — twinkling stars at minimum; subtle drift on the Milky Way layer and faint breath on the warm accent are on the table.
- ~~No responsive motion to cursor~~ — **reversed 2026-05-31 (see below).**

**Amended — 2026-05-31 (cursor parallax adopted)**

- **Responsive cursor parallax is now adopted.** The old rule (responsive motion would feel gimmicky / break the rooted-observer posture) was written when the camera-tilt transition carried the "aliveness." With the tilt retired, the scene needs another way to feel alive — and a _subtle_ parallax reads as the world having depth, not as a gimmick, as long as it stays restrained.
- **Mechanism:** on cursor move, the **entire background scene shifts together as one rigid unit** (honoring the existing "everything at infinity" model — no differential-depth parallax that would fight the baked single-camera perspective), with a **very slight counter-shift of the landing content** (brand + heroes) to amplify the depth read. Small amplitudes, tuned by feel.
- **Why it's safe where the pan wasn't:** a tiny offset of a cached layer (not a long full-viewport slide) + an interactive lerp-follow (no scripted easing trajectory for the eye to judge dropped frames against). A different performance class entirely. Still **Firefox-tested as the canary** before commit.
- **Gating:** desktop-only (`hover: hover` + `pointer: fine`), suspended during transitions, off under `prefers-reduced-motion`.
- **Ambient auto-drift / "breathing"** (a slow continuous world drift, no input — works on touch/mobile too) is still wanted, but **deferred until cursor parallax is evaluated first** (Nate's call). Mobile **device-tilt** parallax is a lower-priority maybe (iOS needs a permission gesture; nausea / gimmick risk); ambient drift is the better universal mobile aliveness.
- **Shooting stars** are greenlit as ambient life (occasional, randomized; compositor-cheap transform + opacity — implementation approach in the landing plan).

---

## Site chrome boundaries

**Settled — 2026-04-26**

- **Two distinct chrome layers** are now formally distinguished:
  - **Site chrome** — global header / footer / nav. Appears on **utility routes only** (`/about`, `/settings`, etc.). Does NOT appear on landing or any tool route.
  - **Tool chrome** — per-tool affordances (back-to-landing, settings access, tool-specific controls). Internal to each tool. Currently undefined / inconsistent across tools.
- **Architectural implication:** the current `src/routes/+layout.svelte` wraps everything with chrome and needs restructuring so utility routes opt _into_ the chrome rather than landing/tools opting out. Likely move site-shell HTML into a `(utility)/+layout.svelte` group, leaving the root layout chrome-free.
- The current rotation planner top-right "other tools" affordance is an accepted placeholder until the tool chrome unification pass.

---

## Warm accent placement

**Settled — 2026-04-26** (refines the constitution)

- Reserved for: branding (placement TBD via logo iteration), active states, "live now"-class signaling, moments of accomplishment.
- Usage ceiling: ~5–8 instances across the entire product. Sparing is the rule.
- Must NOT be applied to ambient UI chrome, body text accents, or anywhere broad — broad usage extinguishes the warm accent's value as the project's defining contrast color.

---

## Mobile strategy

**Settled — 2026-04-26**

- **Explicitly desktop-first.** Deliberate inversion of the modern "mobile-first" default, justified by tool nature (theorycraft tools and stream-friendly games shine on large displays).
- Mobile is treated as a **downgraded experience**, designed _after_ the desktop landing and tools are settled.
- Mobile landing will likely be a different composition (not a reflow of desktop) — possibly a portrait-tuned variant of the cosmic scene with a different hero treatment. Specifics deferred.

---

## Branding (settled 2026-07-19)

- **The brand string is `critcalc.app` — the full domain, everywhere** (Nate 2026-07-19). The chrome wordmark previously read bare "critcalc"; corrected in `a51e0e4`. When authoring any new surface (headers, footers, exports, meta, marketing), write `critcalc.app`, never bare `critcalc`. (The PNG export watermark already did this.)

---

## Open questions / pending decisions

- **Element palette migration** — task brief drafted in conversation 2026-04-26; awaiting separate session execution. Migrate per-component element palettes to `--el-{element}-{slot}` CSS variables in `src/app.css`, fix the `RotationCharacterPanel.svelte` schema drift. No value changes in this pass.
- **Keystone palette tuning** — after migration lands. Refine the seven element `main` colors (Nate reports current values are ~95% to his vision); then derive expanded slot set as components demand.
- **Site palette refinement** — viewport bg, surface colors. Sample anchor values from the Blender-recreated reference scene once it exists.
- **Logo iteration** — black-hole → quasar evolution. Will determine warm accent placement (logo glow, stroke detail, letterform inset, or absent from brand mark and reserved entirely for UI use).
- **Tool chrome unification** — design pass bringing rotation planner, crit visualizer, and (eventually) team builder under a coherent tool chrome system. Includes back-to-landing affordance, settings entry, tool-internal navigation. Current rotation planner top-right "other tools" link is a placeholder.
- **Camera transition motion details** — exact curves, durations, what physically rises/falls, when the dim overlay drops in relative to the tilt. Prototype once a stylable landing exists.
- **Per-tool transition choice (#1 vs #3)** — decide per tool whether the hero vignette has a natural visual fit for the morph (transition #3) or defaults to lift-and-dim (#1). Decide when authoring each tool's transition.
- **Mobile landing composition** — different design entirely vs. portrait reflow of desktop. Deferred until desktop is settled.
- **Cross-site link placement (critcalc ↔ weaselthief.com)** — on a contained no-scroll cinematic landing, where does the sister-site link live? Options to weigh: distant light on the horizon (a "you can see another world out there"), a second-stage camera move (sideways instead of upward), utility-route chrome only, or a dual-brand-mark treatment. Pending.
- **`/about` route content** — currently linked from header nav but route doesn't exist. Decide content + author when ready.
- **Hero vignette authoring** — Nate is crafting in vector. Will return for concept inspiration and sizing when authoring begins.
- **Tool internals visual unification** — once landing palette is locked, walk through each tool to align surface colors, accent usage, and remove "hollow-element" patterns that accreted during functional development.
- **Footer placement on utility routes** — what does the footer actually say once it stops being global? Currently it carries the HoYoverse fan-disclaimer; that disclaimer needs to live somewhere accessible from every page even though footer chrome doesn't render on landing/tools.
