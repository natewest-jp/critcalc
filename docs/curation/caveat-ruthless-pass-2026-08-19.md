# Ruthless Caveat Pass — 2026-08-19

> ⏭ **What this round left open lives in `docs/curation/caveat-open-items.md`** — the 29 unlanded
> trims, the positional-schema round, and the engine/data flags.

> Second pass over all **249** caveats under Nate's tightened rule.
>
> ✅ **APPLIED 2026-08-19 — Nate approved ALL deletions.** 141 removed, 28 trimmed, 6 promoted;
> **249 → 107**. Taking every deletion also RULED on the open question below (an unrendered buff
> leaves no noticeable blank — YES). Per-caveat verdicts kept in `caveat-ruthless-verdicts.json`.
>
> ⏭ **29 trims did not land**: the pass marked them trim but proposed no replacement text, so there
> was nothing to apply mechanically. They keep their current, longer text and are the one piece of
> this round still open.

## The rule (Nate, 2026-08-18)

> "I only want caveats when the player might be confused or not understand something on the screen —
> they know their character well and they wonder why they see something different from what they
> expected, or genuinely when we have to approximate something."

Encoded as **NAME THE PIXEL**: what does the player SEE that is wrong, approximate, or conspicuously
missing? If you cannot point at a bar, marker, tick, or a blank where one is due — the caveat dies.

The case that prompted it — Nicole's _"the shield absorbs Pyro DMG at 250% effectiveness"_ — is a
**general fact about the game**, and the tool shows absorption for NO shield, so nothing on screen
looks wrong. ⚓ Its reach turned out to be **six sites**, not one: three standalone caveats plus three
clauses cut from inside surviving caveats (Traveler Hydro C4, Xinyan skill, Baizhu burst).

## Method

18 batches judged, then a **challenger stage argued the opposite side of every keep** (the bias being
corrected is keeping too much). 37 agents. ⚠️ The challenger overturned **105 of 159** keeps — a 66%
rate that I treated as suspect and spot-checked; the kill reasons are source-verified refutations, not
taste. Several found the caveat outright **factually wrong** (see §Errors).

---

## THE ARITHMETIC

|                                       | n       |
| ------------------------------------- | ------- |
| **delete**                            | **141** |
| trim (keep the pixel, cut the trivia) | 57      |
| keep verbatim                         | 45      |
| promote to a host that renders        | 6       |

**249 → 108.** The column is ~57% padding.

---

## ✅ APPROVE-IN-ONE-DECISION — 80 caveats, uncontested

Zero disagreement between judge and challenger on any of these.

### invisible-omission — 72

Names something absent that never had a place on a timeline: damage magnitudes and DMG%, energy refunds and particle counts, heals (no heal draws a bar for ANY character), HP costs and drains, stamina, stack counters, pickups, positional and aim mechanics. Four sub-classes account for nearly all of it — damage math (frozen by the constitution), energy (no surface anywhere), heals (no consumer in any timeline module), and HP/pickups (no state in the sim at all).

<details><summary>all 72</summary>

- **Columbina passive** — Not modeled: the revival — once every 100s in the Nod-Krai or Frost Moon regions, a fallen party member is revived with HP based on Friendship Level.
- **Columbina constellation** — Not modeled: the 4 Energy she regains on each Gravity Interference, and the bonus DMG folded into that hit (12.5% / 2.5% / 12.5% of her Max HP, by dom
- **Skirk ability (normal, in-stance chain)** — Not modeled: after the in-stance burst, normal hits deal bonus DMG on a repeating 0.1s trigger (up to 10 times), raised further by Void Rifts absorbed
- **Skirk constellation (C1)** — Not modeled: the crystal blade added on each Void Rift absorbed, since Void Rifts are not simulated. In a standard Freeze team it is a predictable dam
- **Skirk constellation (C6)** — Not modeled: this relies on Void Rifts, which are not simulated — the stacks, their coordinated attacks, and the in-stance damage reduction are absent
- **Neuvillette constellation (C1)** — Both effects act on Equitable Judgment, which is not modeled — the bonus Past Draconic Glories stack only feeds its damage tiers, and the interrupt re
- **Neuvillette constellation (C2)** — The Past Draconic Glories CRIT DMG bonus (+14% per stack, up to +42%) applies only to Equitable Judgment, which is not modeled, so it has no effect on
- **Neuvillette constellation (C4)** — The Sourcewater Droplet generated when healed (once every 4s) feeds Equitable Judgment, which is not modeled, so this constellation has no visible pay
- **Neuvillette constellation (C6)** — These effects extend and augment Equitable Judgment, which is not modeled, so neither the extra droplet absorption nor the added Hydro currents appear
- **Durin passive entry (A4)** — The first 10 dragon ticks after the Burst each gain up to +75% DMG, scaling with ATK (+3% per 100 ATK). This dynamic amp is not folded into the tick v
- **Durin constellation entry** — Not modeled: the 30% chance for a hit to skip consuming C1's Cycle of Enlightenment stacks.
- **Cyno passive entry (A1)** — Not modeled: the Endseer stance and the Judication effect it enables — the skill DMG bonus and the Duststalker Bolts. With a Stellar-Conduct enabler i
- **Cyno constellation entry** — Not modeled: the Energy returns — 3 to nearby party members on each qualifying reaction, up to 5 times per burst, and the 20 a teammate carrying Toget
- **Cyno constellation entry** — Not modeled: the Day of the Jackal stacks and the extra Duststalker Bolts they fire. With a Stellar-Conduct enabler in the party those become Starsame
- **Nicole Burst** — Not modeled: the Hexerei Secret Rite — with 2 or more Hexerei in the party, Arcane Projections triggered by Hexerei members deal extra DMG equal to 30
- **Mona C2** — Not modeled: the automatic follow-up Charged Attacks, including the guaranteed one within 5s of the burst in a Hexerei party.
- **Qiqi ability** — Not modeled: with the Witch's Revelation talent unlocked, a cast inside a Polestar Field adds a Cryo hit that counts as Stellar-Conduct DMG.
- **Qiqi constellation** — Not modeled: the Energy regenerated when the Herald hits a Talisman-marked opponent, or the extra 6 Energy that also needs a Polestar Field.
- **Qiqi constellation** — Not modeled: the extra heal on each Talisman heal — in game only the nearby ally with the lowest HP percentage receives it, not the whole party. The 2
- **Qiqi constellation** — Not modeled: the Glimpse of Mystery stacks gained after the burst, which add 600% of the caster's ATK to a teammate's Stellar-Conduct DMG (4 stacks, 1
- **Traveler (Hydro) ability** — Not modeled: Foreign Aqualis, unlocked by the True Moon quest — stat bonuses for each element resonated with, plus an empowered Charged Attack that sp
- **Traveler (Hydro) ability** — Not modeled: the Hold mode's up to 22 Dewdrop damage ticks and its HP drain — each Dewdrop scales with Max HP and costs 4% of current HP (only above 5
- **Traveler (Hydro) ability** — Not modeled: the C2 -30% bubble movement-speed reduction — the slower drift isn't shown. Its +3s duration is applied, so damage ticks run at the base
- **Traveler (Hydro) passive** — Not modeled: the heal from picking up a Sourcewater Droplet. Droplets drop from the skill's Hold-mode Dewdrop hits, up to 4 per use, and must be colle
- **Traveler (Hydro) constellation** — Not modeled: the heal from picking up a Sourcewater Droplet. It reaches only the nearby party member with the lowest HP percentage, for 6% of that mem
- **Sandrone passive:A1 (Eternal Speculation Engine)** — Not modeled: the 400% second Prism Shot or the Refined Tactics boost to the burst ray, both of which need Decoding Power and a Polestar Field.
- **Sandrone constellation:2 (An Heiress Gazed Into the Looking-Glass)** — Not modeled: the CRIT DMG bonus on condensed beams, which needs a Polestar Field and grows by 20% per beam fired.
- **Sandrone constellation:4 (In Knowledge Lies the World's True Ground)** — Not modeled: the extra cannon that fires when Stellar-Conduct DMG lands (125% ATK Cryo, once every 4s).
- **Sandrone constellation:6 (Narcissus Wakes, Her Eyes Upon the Dawn)** — Not modeled: the Condensed Cluster Beam's up-to-4 extra hits from the third beam of each Decoding period onward.
- **Varka constellation:2 ("When Dawn Breaks, Our Journey Shall Take Flight")** — Not modeled: the extra 800% ATK Anemo strike that accompanies the special in-stance actions (Four Winds' Ascension, Azure Devour).
- **Varka constellation:6 ("Beloved Mondstadt, Steadfast You Shall Shine")** — Not modeled: the free-recast enhancements to the special in-stance actions (Four Winds' Ascension and Azure Devour).
- **Wriothesley C2** — Not modeled: at 5 Prosecution Edict stacks, Normal and Charged Attacks deal 125% and 130% of their DMG — or, inside the Polestar Field, stronger Stell
- **Wriothesley C4** — Not modeled: the ATK SPD gained from overhealing, or the Polestar Field version that replaces it with 25% less DMG taken plus ATK SPD for him and for
- **Wriothesley C6** — Not modeled: the CRIT Rate and CRIT DMG boosts on the enhanced Charged Attack, or — inside the Polestar Field — their wider coverage of Chilling Penal
- **Yae Miko C6** — Not modeled: the extra CRIT DMG on Stellar-Conduct DMG, or the Sesshou Sakura DEF ignore.
- **Zibai Burst** — Not modeled: the two DEF-scaling Geo hits, the 2nd of which counts as a Lunar-Crystallize reaction.
- **Diona Burst** — The heal is shown on every tick, but only the active character standing inside the field is healed. Anyone outside its limited vertical range receives
- **Diona Passive** — Not modeled: the three extra paws fired when the party triggers Superconduct, Stellar-Conduct, or Cryo Swirl within 20s of the skill. They deal DMG on
- **Hu Tao skill (Guide to Afterlife)** — Not modeled: the 30% current-HP drain on cast.
- **Hu Tao burst (Spirit Soother)** — DMG and heal are boosted at ≤50% HP (not modeled).
- **Klee normal ability** — Not modeled: Boom Badges. Normal Attack, Skill, and Burst DMG each grant a badge for 20s, and 1/2/3 badges raise the Boom-Boom Strike to 115%/130%/150
- **Klee passive (A1)** — Not modeled: the Spark stock — the Skill and Burst each grant one and up to 3 are held for stamina-free Charged Attacks.
- **Raiden Shogun ability (burst)** — Not modeled: Resolve stack count or the resulting DMG bonus.
- **Arataki Itto ability (burst)** — Not modeled: the stance lowers his own Elemental and Physical RES by 20% while it lasts.
- **Arataki Itto constellation (C6)** — Not modeled: the +70% CRIT DMG on Charged Attacks.
- **Traveler (Anemo) passive caveat (A1)** — Not modeled: the heal when the skill defeats an opponent — 2% of Max HP each second for 5s, at most once every 5s.
- **Baizhu ability caveat (skill)** — The heal isn't shown on the timeline; in game it lands when the Sprite returns after its attacks, or right away if no opponents are nearby.
- **Dahlia constellation caveat (C6)** — Not modeled: the 10% ATK SPD for the active character under Favonian Favor, and the revive if they fall (once every 15 minutes).
- **Iansan Passive** — Not modeled: the heal in the 10s Warming Up window after a teammate's Nightsoul Burst, which needs her to regain Nightsoul points each time.
- **Iansan C1** — Not modeled: the 15 Energy she restores for herself while spending Nightsoul points in the Nightsoul's Blessing state, at most once every 18s.
- **Illuga ability (burst)** — Not modeled: the 20s Nightingale's Song boost — a per-hit flat add to the active character's Geo damage, scaling off the caster's Elemental Mastery an
- **Illuga passive (A4)** — Not modeled: the further Nightingale's Song DMG bonus from having Hydro or Geo characters in the party (he counts) — like the base bonus, a per-hit fl
- **Jean ability (skill)** — Only the held version pulls opponents in — a tap launches them away instead.
- **Jean ability (burst)** — Not modeled: the field's continuous Anemo application (self-swirl) to the active character standing inside it.
- **Jean passive (A1)** — Not modeled: the 50% chance — every Normal Attack hit is treated as healing, about double the real frequency.
- **Mika ability (burst)** — Not modeled: the 15s healing window — in game it heals the active character on their Normal Attack hits, at most once every 2.5s.
- **Razor ability — Claw and Thunder (skill)** — Not modeled: with 2 or more Hexerei in the party, an overflowing Electro Sigil calls down a lightning strike that returns 7 Energy.
- **Sigewinne ability — Rebound Hydrotherapy (skill)** — Not modeled: the one-time self-heal (50% Max HP) when the bubble stops bouncing, the held-cast healing boost on early bounces (+5% / +10%), and Bond o
- **Arlecchino ability — Balemoon Rising (burst)** — Heals only the caster — no other character's healing can reach her. Shown as the 150% ATK portion only; in game the heal also scales with Bond of Life
- **Ineffa constellation** — Not modeled: the extra Electro hit on a Lunar-Charged reaction, which in game also needs the C1 buff (active 20s after each skill cast).
- **Nefer ability** — Not modeled: the per-stack DMG bonus the burst gains from consuming Veil of Falsehood stacks on cast (max 3, or 5 at C2). Shown at the zero-stack base
- **Ororon ability:burst** — Not modeled: the taunt that draws opponents' attacks toward the Supersonic Oculus.
- **Ororon passive** — Not modeled: the Energy that Normal, Charged, and Plunging Attack hits restore to the active character — and to him while he's off-field — in the 15s
- **Xiao ability:burst** — Not modeled: the HP drain each second while the stance is active.
- **Clorinde ability** — Bond of Life isn't tracked, so the self-heal from Impale the Night and its gains from Swift Hunt and the burst aren't shown. While Night Vigil is acti
- **Lynette ability** — Not modeled: the HP cost that comes with the heal — for 4s after the thrust hits, she loses about 6% of her current HP each second.
- **Lyney ability** — The heal is shown at one Prop Surplus stack; in game it restores 20% of Max HP per stack cleared (up to 5), and with none banked it heals nothing.
- **Noelle ability** — Not modeled: the healing chance — each qualifying Normal or Charged hit has only a ~59% chance to heal the party, rising to 100% at C1 while the burst
- **Sayu ability** — Both the Daruma's heal and its attack are drawn on every tick, but at C0 each tick is one or the other: it heals only while the active character is at
- **Xingqiu ability caveat (skill)** — Not modeled: the heal for 6% of the caster's Max HP when a Rain Sword shatters or expires — incoming hits aren't simulated.
- **Xinyan ability caveat (skill)** — Shown at its lowest strength, from hitting 0–1 opponents; hitting 2 or 3+ opponents gives progressively stronger shields that aren't reflected. Not mo
- **Zhongli constellation caveat (C6)** — Not modeled: the heal when the Jade Shield takes a hit (40% of that DMG, capped at 8% of Max HP) — incoming DMG isn't simulated.

</details>

### general-game-knowledge — 3

True of the game at large, not of this character or our rendering. All three are the exact case Nate named: elemental shields absorbing their own element at 250%. No shield in the tool renders absorption at all, so nothing on screen claims otherwise.

<details><summary>all 3</summary>

- **Nicole Skill** — Not modeled: the shield absorbs Pyro DMG at 250% effectiveness.
- **Dahlia ability caveat (burst)** — The shield absorbs Hydro DMG at 250% effectiveness, which the shown window doesn't reflect. Only the initial shield is shown; when it breaks it re-for
- **Candace ability (skill)** — Not modeled: the shield's extra effectiveness against Hydro DMG.

</details>

### kit-explanation — 3

Explains how the character works, or how to type a token, without any rendered thing being wrong. Includes one notation tutorial (Varesa's sQ), one 'if you whiff you get nothing' (Lan Yan), and one attack-string mechanic in a Hexerei team (Klee).

<details><summary>all 3</summary>

- **Klee burst (Sparks 'n' Splash)** — Not modeled: with 2 or more Hexerei characters in the party, the Normal Attack string stops resetting for its duration and every third attack spends a
- **Lan Yan ability** — Shown on every cast, but the shield only forms when the opening Detect strike lands on an enemy; a whiffed cast creates no shield.
- **Varesa ability caveat (burst)** — Type sQ within the 2.33s Apex Drive window — opened by a plunge during Fiery Passion, or any plunge at C2 — to cast Volcano Kablam, the 30-energy plun

</details>

### working-behavior — 2

Describes something the tool already does correctly. Raiden's Eye caveat explains a per-member formula the bar ALREADY prints verbatim ('≈0.30% per energy cost (T10)'); Nahida's skill caveat restates the modelled 2.5s procCooldown and then names an interval reduction that is never the binding constraint.

<details><summary>all 2</summary>

- **Nahida ability (skill)** — Tri-Karma Purification fires at most once every 2.5s. Not modeled: the shorter interval the burst grants with Electro teammates, and the extra C6 proc
- **Raiden Shogun ability (skill)** — The burst DMG bonus scales with each member's own burst energy cost, so it differs per party member; the timeline shows the buff window but not a sing

</details>

---

## ⚖️ THE ONE BIG DECISION — does an unrendered buff leave a "blank"?

**This single ruling moves ~30 caveats.**

The challenger's argument, which I verified in source myself:
`projectCharReceivedBuffRows` (charReceivedBuffRows.ts:31-40) builds rows FROM windows —
`windows.filter(w => w.kind === 'buff')`, one row per window via a rowMap. **An effect that emits no
window creates no row.** So the timeline is merely _quieter_, not visibly holed. There is no empty row
to notice.

⚠️ **Where I think it has a limit, and why it is your call:** the argument is airtight for a character
whose buffs are ALL unmodelled — nothing draws, no contrast. It is weaker when the character draws
several buff bars and one conspicuous one is missing. A C6 Columbina casting Q sees three Reaction
Bonus rows and no +80% CRIT DMG bar; that absence has neighbours to be measured against.

- **Rule YES (no blank is a pixel)** → `expected-but-absent` collapses to ~6 survivors.
- **Rule NO** → ~14 come back.
- **Rule "only when siblings draw"** → the middle path; costs a per-case check.

---

## 🐛 ERRORS FOUND — these must not ship unchanged whichever way you rule

- **Aino C2** — the sentence is **BACKWARDS**. `source:'others'` excludes Aino's own hits, so an
  on-field rotation shows FEWER water balls, not more. ⚓ This is the caveat an agent authored during
  the first sweep and I flagged as a duplicate — it was also wrong. Authored-by-fan-out prose needs the
  same scrutiny as a delete.
- **Shikanoin Heizou C6** — its load-bearing first sentence is FALSE against current code. Measured by
  probe: the CRIT bonuses DO draw with no `{declension:N}` asserted (stackContext undefined → condition
  folds to null → the pool drops only a definitive false).
- **Flins** — "plunges are disabled in this form" warns about a block that can never draw: Flins authors
  no plunge frames and `run.ts:1291` gates the branch on `if (plungeFrames)`.
- **Candace burst** — rationale inverted: catalyst normals ARE elemental, so the bar is correct for a
  catalyst holder; it over-promises only for a bow holder's uncharged shots.

---

## ⚙️ FLAGS THAT ARE NOT CAVEAT WORK

- ✅ **Itto C2 — ALREADY FIXED** (`d7a5a9a`, this branch). The pass flagged it independently; the
  divergence is gone, so no caveat is needed rather than restored.
- **Xianyun C2** — `constellationScaling` on the plunge buff (200%→400%, cap 9000→18000) is never read
  by buff emission or display, so a C2 reader is shown the base value. Caveated nowhere.
- **Skirk burst** — the Serpent's Subtlety bar fails OPEN across a swap (measured:
  `Skirk hE > Fischl E > Skirk Q` draws it with no stack context), and the C2 cap prints 12 not 22.
- **Qiqi C4 + Traveler Hydro C6** — both author `target:'team'` on INERT heal effects, so
  `deriveCapabilities` hands the Team Builder a party-wide heal claim no caveat can reach.
  ⚓ Same shape as the Nicole C2 / Kirara C2 ruling.

---

## 👀 CONTESTED — 33 rows where judge and challenger disagreed on LIFE, not wording

- Mavuika C2 (The Ashen Price) — judge KEEP / challenger DELETE. Judge: a 20% DEF-shred bar that draws at C6 and vanishes at C2 reads as a bug. Challenger: constellation gating means no reader ever sees both levels, so there is no asymmetry to notice.
- Skirk C4 (Fractured Flow) — judge KEEP / challenger DELETE as a duplicate. The ATK bar is folded into the same window as the A4 +70% bar disclosed one entry up, same defect, same mechanism. Challenger's alternative: change one word in the A4 caveat ('the tiers' not 'the Normal Attack tier') and delete this.
- Skirk A1 (Void Rifts) — judge TRIM / challenger DELETE with a measurement: the bar the trim hangs on is either FILTERED OFF entirely (pool 45 < min 51) or draws with no stack context and prints a composition-free formula. Nothing on screen undercounts.
- Durin C2 — judge KEEP / challenger DELETE: the missing partner-element bar would be exactly co-extensive with the drawn Pyro bar, so no shape, length or value changes. Both agree the drawn bar has a bigger undisclosed problem (its duringSummon gate never resolves, so it draws with no Burst).
- Wriothesley A4 'Reckoning for Sin' — judge KEEP / challenger DELETE. THE ARCHETYPE of the contested class: is an unrendered received-buff row a pixel? Challenger says no row exists to be empty, and that unmodelled self-stat passives are the corpus's largest silent class (167 manual + 72 passive effects).
- Prune burst (Witchlure Bell) — judge KEEP / challenger DELETE with a corpus count: 34 of 94 authored summons draw NO tick marks, so a bare summon bar is the lane's ordinary form, not a conspicuous blank. This measurement, if accepted, also weakens several other 'the lane is empty' keeps.
- Albedo skill (Silver Isotomas) — judge KEEP / challenger DELETE: the kit text says Silvers only emit when NO Solar Isotoma is on the field, so in any rotation that casts E the missing lane would be empty anyway.
- Yae Miko C1 — judge KEEP / challenger DELETE: the missing trigger path is 'Yae deals Stellar-Conduct DMG directly', which is itself unauthored and 0U, so the player can never see the event whose absence is being explained.
- Hu Tao C4 — judge KEEP / challenger DELETE: the trigger is an enemy DEATH — no token, no marker, no enemy model — so there is no instant in a written rotation at which the missing 15s crit bar should appear.
- Jahoda burst (robot damage ticks) — judge KEEP / challenger DELETE: the heal marks drawn are correct and complete for any non-Moonsign team, and spotting the divergence needs a deliberately assembled Moonsign party plus tick-spacing arithmetic. Note the challenger KEPT Jahoda's A4 and C6 blanks on the opposite reasoning, so the line is drawn, not arbitrary.
- Aino C2 — judge KEEP / challenger DELETE, and the challenger says the text is BACKWARDS: source:'others' excludes Aino's own hits, so an on-field rotation shows FEWER water balls, not more. ⚠ Whichever way Nate rules, this sentence is wrong as written and must not ship unchanged.
- Lohen A4 — judge KEEP / challenger DELETE: it is an under-claim (a second copy of an already-visible bar missing from an off-field row). Challenger calls it their own closest coin-flip and takes the delete per the calibration.
- Raiden Shogun, Musou Isshin plunge — judge KEEP / challenger DELETE: the caveat shows for every Raiden team on roster presence, while the bar it warns about only appears if you type an illegal plunge — and for the Xianyun team it warns about, the frames are exactly right.
- Sucrose skill (Secret Rite attack-tag scope) — judge KEEP / challenger DELETE: the excluded slice is transformative-reaction DMG, which the tool computes nowhere, and the bar's label is 'DMG Bonus' in a lane titled TEAM BUFFS, not an all-damage claim. Sucrose's BURST caveat (same family, real recipient error) survives both passes.
- Dahlia skill (Sacramental Shower) — judge KEEP / challenger DELETE: ability `tags` are read by the Team Builder and never by the timeline, so nothing advertises a summon here; the row it would draw is an empty bar for an inert touch-triggered construct.
- Escoffier skill (hold form) — judge KEEP / challenger DELETE: notationFlags already lints a hold token on a character with no hold variant, in place, on the token, on hover. A 262px aside is strictly worse than the lint that already fires. ⚠ Same argument kills Chiori's skill caveat below — rule on it once.
- Faruzan A1 (vortex shred) — judge KEEP but flagged it as their own first to reconsider / challenger DELETE: the burstless rotation it describes is not one anyone plans, and the vortex draws nothing for anyone anywhere.
- Ifa burst (restraining wind current) — ⚠ THE ONLY LOW-CONFIDENCE JUDGEMENT IN 249. Judge KEEP and named it the batch's genuine coin-flip; challenger DELETE because the game itself states no duration, so there is no quantity a player expects to see.
- Beidou skill (Tidecaller shield) — judge KEEP / challenger DELETE: the skill declares input ['E'] only, and the PRESS grants no shield in game, so the empty lane is correct. ⚠ The real complaint underneath is the Team Builder's shield claim from tags:['shield'], which a caveat can never reach.
- Beidou A4 Polaris — judge TRIM (cooldown cut) / challenger DELETE: the CD cut requires the HOLD, which Beidou cannot express (no variant), so the drawn 7.5s tail is correct for the only cast the notation can write.
- Linnea A1 (Geo RES shred) — judge KEEP / challenger DELETE: the shred bar is authored 25s to match Lumi's 25s bar, so they agree on screen; what is really being disclosed is that we do not model proximity, an engine-wide assumption no other zone character caveats.
- Candace burst (Normal Attack bonus) — judge KEEP / challenger DELETE: catalyst normals are elemental and the sibling infuse covers melee, so the bar over-promises only for a bow holder's uncharged shots.
- Sigewinne C6 — judge KEEP / challenger DELETE: the trigger is healing, which the planner draws nowhere, so there is no on-screen moment at which the missing CRIT bars are due.
- Chiori skill (hold E) — judge KEEP / challenger DELETE twice over: the notation linter already says this at the token, and the divergence is 15 frames (0.25s) on a 16s bar.
- Chiori A4 (Geo construct bonus) — judge KEEP / challenger DELETE: Tamoto's summon bar existing is not an invitation to expect a buff bar, and a construct SPAWN is not an event the tool models at all.
- Kinich skill — judge TRIM to the 'charged attacks are disabled' half / challenger DELETE: the block that draws is a generic placeholder (chargeFrames deliberately unauthored), so it is equally wrong outside Nightsoul; the caveat points at a state gate while the real defect is missing data.
- Kinich A4 (Hunter's Experience) — judge KEEP / challenger DELETE: the caveat teaches an obscure {key:N} syntax that summons a bar which otherwise is not there, then repairs the misplacement it created.
- Bennett burst — judge KEEP / challenger DELETE: the ATK gate is selfHpAbove 70, so drawing it optimistically AGREES with reality nearly always (the inverse of Xiao C4, which both passes keep), and the field ticks are untyped hairlines that never claim a heal landed.
- Gorou C6 — judge KEEP / challenger DELETE: teamElementCount resolves, so both rows carry the SAME value and the union of spans is correct; the only artefact is one buff occupying two rows, an engine-wide row-splitting grammar left undisclosed on four other characters with the identical shape.
- Kaedehara Kazuha skill (glide-cancel) — judge KEEP / challenger DELETE with a measurement against gcsim: the cancel is worth 16–20 frames (~0.27s), not 'much shorter', and the common E→plunge path is already modelled correctly at 24f.
- Shikanoin Heizou C6 — judge KEEP / challenger DELETE with a probe: the CRIT bonuses DO draw with no {declension:N} asserted (stackContext is undefined, the condition folds to null, the pool drops only definitive false). ⚠ The caveat's load-bearing first sentence is FALSE against current code — it must not survive as written whichever way Nate rules.
- Chevreuse skill (heal window) — judge TRIM / challenger DELETE: no non-summon heal reaches any lane for any character, so this is the corpus-wide 'healing is not on the timeline' fact stated once per character.
- Mona C1 — judge TRIM / challenger DELETE, called their own closest call: three of the six bonuses ARE bucket-5 keys that draw as team bars for other characters, but a DMG% blank on your own timeline is Nate's own named invisible-omission.

---

## Recurring challenger arguments worth ruling on ONCE

Each of these decides several caveats at a stroke:

1. **The notation linter already said it.** `notationFlags.ts` warns in the editor, on the token, on
   hover — strictly better than a 262px aside. (Escoffier hold-E, Chiori hold-E.)
2. **A bare summon bar is ordinary.** Measured: **34 of 94** authored summons draw no tick marks, so an
   empty summon lane is the lane's normal form, not a conspicuous blank.
3. **The trigger is invisible, so there is no moment for the missing bar to be due** — enemy death
   (Hu Tao C4), healing (Sigewinne C6), construct spawn (Chiori A4).
4. **Constellation gating means no reader sees both levels**, so a value that changes between C2 and C6
   is never an on-screen asymmetry. (Mavuika C2.)
5. **An under-claim is an invisible-omission**, not a divergence — everything shown is correct, there is
   merely less of it. (Lohen A4, Varka C4.)
