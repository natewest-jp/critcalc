# Artifact set curation plan (2026-04-17)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

Decided 2026-04-17. Sets are curated from the external transformer's output and hand-copied to critcalc.

**Guiding principle:** Focus on evergreen support sets that remain relevant across metas. On-field DPS sets are usually maxed out by their intended DPS and don't need timeline planning — skip them.

---

## Pass 1 — Implement first

- **Deepwood Memories** — on E or Q: enemy Dendro RES -30% for 8s. Clean trigger.
- **Instructor** — after E: all party EM +120 for 8s. Team buff, clean trigger. (Only 4-star set included.)
- **Maiden Beloved** — after E or Q: all party healing received +20% for 10s. Team buff, clean trigger.
- **Noblesse Oblige** — on Q: all party ATK +20% for 12s. Team buff, clean trigger.
- **Silken Moon's Serenade** — on Elemental DMG hit (off-field OK): all party EM +60/+120 for 8s (Nascent/Ascendant Gleam, resolved from TeamComposition.moonsignCount). Team buff, tractable.
- **Tenacity of the Millelith** — off-field E hit: all party ATK +20%, Shield Strength +30% for 3s. Team buff, approximate from E summon uptime.
- **Viridescent Venerer** — on swirl: element RES -40% for 10s. resShred, approximate as on E/Q of Anemo character.

---

## Pass 2 — Revisit later

- **Marechaussee Hunter** — HP change → CRIT Rate +12%/stack, max 3 stacks, 5s. Requires tracking HP change events per ability (Furina, Neuvillette, Hu Tao etc.). HP change events not yet in data model.

---

## Skip — Everything else

All other sets skipped. Key reasons:

- **On-field DPS sets** (Crimson Witch, Desert Pavilion, Heart of Depth, Long Night's Oath, Pale Flame, Vermillion Hereafter, etc.) — always maxed out by their intended DPS; timeline planning not useful
- **Near-permanent uptime** (Gilded Dreams, Scroll of the Hero, Obsidian Codex, Husk of Opulent Dreams, Unfinished Reverie, A Day Carved from Rising Winds) — showing always-on buffs adds no planning value
- **Untrackable triggers** (Archaic Petra, Blizzard Strayer, Bloodstained Chivalry, Flower of Paradise Lost, Night of the Sky's Unveiling, Nighttime Whispers, Retracing Bolide) — trigger conditions can't be derived from rotation notation
- **Niche / outdated** (Shimenawa's, Nymph's Dream, Song of Days Past, Fragment of Harmonic Whimsy, Ocean-Hued Clam, Echoes of an Offering)
- **Model-incompatible** (Thundering Fury — CD reduction changes rotation shape; Emblem of Severed Fate — always-on stat scaling; Finale of the Deep Galleries — wait for user request)
- All 3-star and 4-star sets except Instructor
