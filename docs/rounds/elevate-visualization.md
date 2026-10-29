# Elevate buff visualization (planned)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

`elevate` got its own Effect type (not collapsed into `lunar*DmgBonus` stat keys) for a reason that's not yet realized in the renderer: theorycrafters call out elevation specifically because it's a _true_ multiplicative damage tier — strictly more potent than additive DMG bonuses (which dilute as other bonuses grow). The schema already captures the distinction; the renderer needs to follow.

**Why:** the user explicitly cited this when greenlighting Option B in the E1 design discussion — schema fidelity wasn't the only motivation, future visual differentiation was.

**How to apply:** when next touching the buff-bar renderer, give elevate effects a slightly different visual treatment from regular DMG bonus bars. They can look almost the same (same shape, same row pattern), as long as the label wording includes "elevate(s)" or "elevation" so users can recognize the distinction at a glance. Examples:

- Regular: `Lunar-Bloom DMG +25%`
- Elevate: `Lunar-Bloom Elevation +25%` or `Lunar-Bloom DMG elevated +25%`

This is the curator-facing convention too: the in-game ability descriptions use "elevated by X%" wording for elevation effects, not "DMG bonus."

**Future migrations expected:** more characters will have elevation effects as the game adds Moonsign/lunar-reaction units. The `elevate` primitive is ready for them; just needs the renderer side. Pending cases already noted: Columbina (multiple +1.5%/+7% all-lunar elevations across talents/cons — will need multi-reaction rendering), Zibai's per-cast Spirit Steed elevation (different mechanic — per-cast event-driven; may not fit the current `reactions[]` shape).
