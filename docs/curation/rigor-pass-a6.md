# A6 Rigor Pass — Fixed-Constant Verification (2026-07-12/13)

_Corpus-wide verification of hand-authored fixed constants (constellation/passive
buff numbers, durations, proc CDs, stack counts, tick intervals) against kit text +
gcsim Go source. 114 per-character agents (Opus 4.8) via the `a6-rigor-pass`
workflow (`.claude/workflows/a6-rigor-pass.js`). Talent-scaled values were covered
by the 2026-07-12 talent-level-10 sweep; this pass covers everything that sweep
could not. Fixes carry `A6 rigor` `_curatorNotes` citations in the character JSONs._

**Totals: 114 characters · 1,688 constants verified · 16 corrections on 12 characters · 61 flags on 29 characters · 78 fully clean.**

## Corrections applied (provable errors, evidence cited)

### fischl

- skill+burst Oz summonTick scaling: 247.32 → 159.84 (gcsim queueOz Mult=birdAtk[9]=1.5984 = Oz's ATK DMG L10; sidecar 159.8%; 247.32 matched no Fischl multiplier at any level). Both curator notes corrected + A6 line added.

### ifa

- C4 Decayed Vessel's Permutation buff value: 15 → 100 (kit text 'Ifa gains 100 Elemental Mastery for 15s'; prior 15 duplicated the duration field; EM buff = whole-number flat EM)

### nahida

- C2 the_root_of_all_fullness effects: critRate value 10 → 20, critDmg value 10 → 100 (in-JSON desc 'fixed at 20% and 100%' + gcsim cons.go c2(): CR += 0.2, CD = 1)

### noelle

- noelle.json Devotion passive condition: ascension min 4 → 1 — Devotion is Noelle's 1st Ascension Passive (gcsim asc.go a1() gates on `Ascension < 1`; Fextralife + Fandom confirm Ascension Phase 1). Curator note added.

### raiden_shogun

- skill (Baleful Omen) buff value.description: ≈0.35% → ≈0.30% per energy (T10) — gcsim skillBurstBonus[9]=0.003; sidecar 0.30% Per Energy

### skirk

- skill Hold-E gainStacks amount: 18 → 45 (gcsim skill.go skillHold AddSerpentsSubtlety 45.0; skillHoldGainSS=18 is a frame delay not the grant; kit text 'Hold: gains 45 Serpent's Subtlety' confirms)
- skill caveat text: 'it grants 18 SS' → '45 SS' (sync with corrected effect value)
- skill \_curatorNotes: 'Hold-E grants 18 SS' → '45 SS' (sync with corrected effect value)

### traveler_anemo

- burst Gust Surge summon.duration: 5.57 → 4.03 (gcsim burst.go). Renderer adds duration to spawnsAt=94, so 5.57s (from-CAST status 334f mis-set as from-SPAWN) drew 12 tick markers for a 9-tick burst. Male status 336f−94f=242f=4.03s → correct 9 ticks (strict-< needs >4.0s).

### traveler_dendro

- burst summon LeaLotus summonTick interval: 1 → 1.5 (gcsim lealotus.go ThinkInterval=90f=1.5s; JSON's own note hedged 'damage tick ~1s')
- burst summon LeaLotus summonTick firstTickDelay: 1 → 0 (gcsim first damage at burstHitmark=91f = spawnsAt=91, so first tick coincides with summon spawn; timeline computes spawnAt+firstDelay)

### traveler_electro

- burst Falling Thunder scaling (both onHit normal+charged damage effects): 32.8 -> 59.04 (talent lvl10; gcsim stats.go burstTick[9]=0.5904; 32.8 was the lvl-1 value burstTick[0]; no sidecar so 07-12 sweep skipped this char)
- burst \_curatorNotes stale constants (doc-only, not authored fields): Falling Thunder 32.8%->59.04% at lvl=10, and burstRegen[lvl=10] 4->1 (gcsim burstRegen[9]=1; the 4 was skillRegen's value)

### varesa

- C2 energy amount: 11 → 11.5 (gcsim cons.go AddEnergy "varesa-c2" 11.5 + kit text "restore 11.5 Energy"; schema amount field is fractional-capable, cf. Dori 2.5 — prior integer-rounding rationale was false)

### xiao

- burst caveat HP-drain: 1.6%/2.4%/3.2% → 3.0%/2.5%/2.0% (T1/T6/T13) — gcsim burstDrain (0.03/0.025/0.02, DECREASING with talent lvl) + sidecar Life Drain row; prior values wrong-magnitude and inverted-direction

### zhongli

- burst Planet Befall: duration 3.9 → 4.0 (Petrification duration; sidecar TL10 10th col = 4.0s, 3.9 = level-9; scaling-only sweep skipped duration fields). \_curatorNotes added.

## Flags (left unchanged — for curator review)

Source disagreements, stale documentation, re-authoring candidates, and
unverifiable values. None are provable constant errors; several are modeling/
semantics issues explicitly out of A6 scope.

### aino

- skill \_curatorNotes labels 65.6%/188.8% as 'at lvl=10' but those are lvl-1 values (lvl-10 = 118.1%/339.8%); documentation-only, skill has effects:[] so no rendered value affected — not edited
- cooldownStartDelay:13 (skill) and spawnsAt:123 (summon) are gcsim frame-derived; no gcsim dir for aino so unverifiable, but out of A6 scope — left unchanged

### amber

- passive Every Arrow buff duration:10 — no game/gcsim anchor (gcsim a1 is a permanent conditional CR mod, NewBase -1); overstates ~2s Fiery Rain window & contradicts curatorNote 'during the burst duration'. Modeling artifact, left unchanged (not provably wrong).
- C6 Wildfire unauthored (no effects[]): gcsim NewBaseWithHitlag('amber-c6',900)=15s vs kit text 10s ATK/MoveSPD +15%. Discrepancy already in curatorNotes; nothing to fix.
- A4 Precise Shot unauthored (no effects[]): gcsim 0.15 ATK / 600f=10s matches kit 15%/10s; no authored constant to verify.

### arataki_itto

- burst resShred: value -20 magnitude is correct (kit 'by 20%'), but target='enemy' is semantically wrong — kit + gcsim burst.go comment say it decreases ITTO'S OWN Elem/Physical RES (self downside), not an enemy shred. Left unchanged: target/existence is a re-authoring/design call, not a numeric fix.
- burst resShred \_curatorNotes claims 'gcsim applies via Snapshot debuff during the burst window' — inaccurate: gcsim burst.go models NO RES debuff at all (self-RES-reduction isn't simmed). Note misdescribes the mechanic; flag for curator, not edited.

### arlecchino

- C6 \_curatorNotes (l318) says critRate value:70 is wrong, 'fix to 10' — but value is ALREADY 10 (correct: gcsim m[CR]=0.1, kit text '10% CRIT Rate'). Note is stale/self-contradicting; left unchanged per no-re-author scope.
- C2 damage effect duration:15 is misplaced — 15s in kit text is the RES-buff duration, not the instantaneous 900% AoE damage instance; left unchanged (inert manual-trigger skeleton; \_curatorNotes already says 'verify before promoting').
- burst energyCost 60 vs gcsim ConsumeEnergy(12): kit-text/sidecar authority = 60; discrepancy already documented in \_curatorNotes. No kit-text mismatch, no action.

### chiori

- Tamoto summon duration 17.5s: gcsim skillDollDuration=int(17.5\*60) confirms it (repo's primary source) and a \_curatorNote already cites it; genshin-db talent sidecar 'Tamoto Duration' row says 17.0s. Left unchanged per gcsim priority — surfaced only for cross-source awareness.

### chongyun

- C4 Frozen Skies energy amount:1 matches kit text ('regenerates 1 Energy') but gcsim cons.go AddEnergy('chongyun-c4',2)=2; left at 1 per kit-text priority #1; discrepancy already documented in effect \_curatorNotes

### columbina

- C2: 4 buffs (hp% 1 / em 0.35 / hp% 0.35 / hp% 1) mismatch kit text. Desc wants Lunar Brilliance +40% Max HP/8s (missing) + per-Moonsign ATK 1%/EM 0.35%/DEF 1% as HP-scaling on atk/em/def, not flat hp%/em; one 0.35 unmapped. Re-author, not a value fix. Left unchanged; curator note added.
- Kit-text fixed constants NOT authored as effects (completeness, likely A7 scope): every constellation 'elevated 1.5%/7%' Lunar elevate, C2 '+34% gravity rate', C1 6-energy / C4 4-energy restore, passive Lunacy maxStacks 3.
- No gcsim dir; skill/burst CD, duration, energy match talent sidecar (genshin-db@5.2.12) exactly, so treated as verified not flagged.

### cyno

- gcsim asc.go COMMENT says Duststalker Bolt = 50% ATK but the CODE (skill.go ai.Mult=1.0) uses 100% ATK; cyno.json description '100% of ATK' is correct. No action, noted for future readers.
- Not an error: burst's signature +100 EM Pactsworn buff (gcsim burst.go m[EM]=100; sidecar 'Elemental Mastery Bonus 100') is unmodeled as an effect in the JSON — a modeling gap, out of A6 scope (re-authoring).

### dehya

- burst.duration=4.1: gcsim burstDuration=4.1\*60 exactly, but genshin-db talent table + in-game display say 4.0s. Left unchanged — matches gcsim, \_curatorNotes documents the choice; source disagreement only, not provably wrong.

### durin

- C6 dual_birth scaling 30/40 (stat=def): constants match kit ("ignores 30% DEF" / "additional 40% DEF") but model DEF-IGNORE as a damage instance scaling on DEF — wrong effect semantics, not a constant error. Re-author flag.
- passive chaos_formed scaling 3 (stat=atk): matches kit "3%" but kit is "+3% original DMG per 100 ATK, max 75%" (a multiplier), not a flat 3%-ATK damage instance; per-100-ATK & 75% cap unmodeled. Re-author flag.
- Unmodeled kit numbers (no effect authored, so no constant to verify): passive Dark Decay Vaporize/Melt +40%, C2 +50% Pyro/reaction DMG 6s, C4 +40% burst DMG & 30% no-consume chance.

### furina

- burst buff \_curatorNotes cite '~0.26%/~0.09% per stack at T9'; TL10 Fanfare conversion is 0.25%/0.10% — cosmetic note approx on value:0 unmodelable effects, no data impact, left unchanged

### gaming

- Burst Suanni's Gilded Dance: effect buff hp% value:50 is wrong (no 50% HP buff exists) — gcsim=30% MaxHP heal (Src=0.3) + 12s Wushou stance window; effect also mistyped buff->heal. Already documented in \_curatorNotes for rework; left unchanged (proper fix = re-authoring, out of scope).

### hu_tao

- skill \_curatorNotes stale: says 'ratio 5.957 reflects ppatk[8] (talent 9 baseline)' but authored value is 6.26 = ppatk TL10 (correct post-2026-07-12 sweep); note text not updated. Data correct, doc misleading.
- burst \_curatorNotes stale: says 'Heal scaling 7.875 = regen[8] (talent 9 baseline)' but authored value is 10.2 = regen TL10 (correct). Note text not updated. Data correct, doc misleading.
- burst energyCost 60 matches kit/sidecar/in-game; gcsim ConsumeEnergy(68) is a gcsim quirk, not the game value — no change.

### iansan

- iansan\_\_skill drain.ratePerSecond=6: gcsim-unverifiable (no gcsim dir; not in sidecar/wiki/KQM). Left unchanged — internally consistent; curator note derives 54NS/6-per-sec.
- iansan\_\_skill duration=9 (stance): unverifiable from sidecar/web; derived from 54NS/6-per-sec drain. Left unchanged — matches community-known ~9s NS window.

### illuga

- A1 em buff value=50 correct, but has durationType:fixed with NO duration; siblings (CR5/CD10) use duration:20 and kit ties EM to the 20s Lightkeeper's Oath — missing field, likely 20. Left unchanged (not a wrong value).
- C6 buffs CR10/CD30/EM80 all correct but lack duration (kit Oath=20s) AND target 'self'; kit text = enhancement of the TEAM Lightkeeper's Oath, so target likely team/teamExcludingSelf. Structural, unchanged.
- C2 damage scaling=400 (EM) correct; kit's '200% of DEF' portion unmodeled (no flatScaling{def,200}). Missing addend, not a wrong constant.
- C4 Solarhunting Wolf 'DEF increased by 200' has NO effect authored (missing team def buff). Stub gap, out of re-author scope.
- C1 Vigilant Sentinel '12 Energy, once every 15s' unmodeled (no energy effect / procCooldown). Stub gap.
- skill+burst effects:[] empty — burst Nightingale's Song per-stack EM DMG (Geo 33.6% / Lunar-Cryst 406.7% EM @L10 per sidecar) and E/Q base EM+DEF DMG unauthored. Stub, out of A6 scope.
- A4 two damage effects (24% always + 160% on Lunar-Crystallize) may double-count; kit reads as 160 REPLACING 24 on Lunar-Crystallize, not additive. Modeling note.

### jahoda

- summons[0].duration=13.17 (gcsim burstDuration 790f) vs talent-table robot duration 12.0s. 790f = cast->robot-removal incl ~1.17s deploy; spawnsAt=0 frozen so window still ends at correct real time. Reconcile with spawnsAt when frames land. Left unchanged.
- skill.cooldown=15.5 vs talent-table CD 15.0s: +0.5s skillWindup added (notes cite gcsim SetCD(skill, skillCD+skillWindup)). Deliberate model choice, not provably wrong; no gcsim dir to reconfirm. Left unchanged.
- skill.duration=5.57 (gcsim 334f shadowPursuitMaxDuration) and heal interval=1.45 (87f) / firstTickDelay=0.2 (12f): gcsim-frame-derived, no jahoda gcsim dir, absent from talent table/kit text -> unverifiable. Well-documented, left unchanged.
- Note-only, no rendered impact: several skill/burst \_curatorNotes cite non-lvl10 multipliers -- filledFlask 212% / unfilledFlask 190.8% are talent LVL1 (lvl10=381.6%/343.4%), initial-burst 259.0% is lvl4 (lvl10=373.0%). Those hits are unauthored (effects[] empty) so no data is wrong.

### kinich

- Ajaw tick interval 2.45s is a documented approximation of a randomized gcsim interval (ajawHitmarks[145,150], avg 147.5f=2.458s). Within ~0.5f tolerance, cited in \_curatorNotes; left unchanged (no single exact value exists for a random interval).

### lauma

- C2 buff duration=15s (onCast burst): gcsim c2Init applies the +40% lunarBloomDmgBonus permanently (NewBase, dur -1) when ascendantGleam; kit text reads as an always-on Moonsign passive. Value 40% verified correct; 15s window is a documented modeling choice pending a burst-active primitive.
- C4: kit text 'regain 4 Elemental Energy' vs gcsim AddEnergy('lauma-c4', 5) — 4 vs 5 disagreement (5s ICD matches c4IcdKey 5\*60). No effect authored on C4, so nothing to edit; already noted in \_curatorNotes for KQM verification.

### nefer

- skill.cooldownStartDelay=22 (frames): gcsim-extracted (SetCDWithDelay 22f); no gcsim dir for nefer + not stated in kit text -> unverifiable, left unchanged
- C6 teamFaction moonsign min:2: proxy for Moonsign Ascendant Gleam (Lv2 threshold); teamFaction resolves null at parse; plausible/standard, left unchanged

### sangonomiya_kokomi

- C6 Sango Isshin duration:4 matches kit text (JSON desc 'for 4s') but gcsim cons.go NewBase('kokomi-c6',480)=8s — kit-vs-gcsim disagreement on a load-bearing duration; kept 4 per kit-text priority, do not 'fix' to 8 from gcsim
- C2 buff stat:hp% value:50 is a documented placeholder (50=HP<=50% threshold, not a buff value); real shape = heal add-ons 4.5%/0.6% MaxHP gated recipientHpBelow:50 (gcsim skill.go L114 0.045, burst.go L135 0.006) — thresholds verified, effect still unauthored
- Skill summon duration 12.5 = gcsim status 12\*60+30+1=751f; in-game sidecar/kit Duration=12.0s. Intentional gcsim-based choice (documented in \_curatorNotes), left unchanged

### sucrose

- A4 Mollis Favonius buff value:20 is a documented placeholder for the scaling shape {type:scaling,stat:em,ratio:0.2}; numerically correct vs gcsim (.20=20%) but not a final fixed constant — already noted in \_curatorNotes, left unchanged.

### traveler_anemo

- C6 \_curatorNotes (burst + constellation node) call C6 a '+60% party RES' buff, but gcsim c6cb is −20% ENEMY RES shred (Value:-0.20, 600f). Internal notes only, not rendered; the user-facing description already says −20%/10s correctly — left unedited.

### traveler_dendro

- C2 'Verdant Tessera' desc (+1 Lamp Spirit stack) vs gcsim (Cons>=2 → +3s lamp duration), and C4 desc (+6s duration) vs gcsim (+5 stacks) appear swapped; no authored effects exist on either, descriptions are genshin-db game text (out of numeric scope), left unchanged
- C2 +3s lamp duration (gcsim s.Duration+=3\*60) not modeled as a summon durationModifier — modeling gap deferred with A1-stack mechanic per curatorNotes, not a value error

### traveler_hydro

- C1/C4/C6 + A1 passive = BETA-kit data, not release. Real: C1 Swelling Lake (+2 Energy on droplet pickup); C4 Pouring Descent (Aegis shield 10% MaxHP); C6 Tides of Justice (heal ally 6% MaxHP); A1 Spotless Waters (droplet 7% HP). Added FLAG note to each node (gcsim+KQM).
- All const/passive NAMES stale beta->release: Beneficent Spring->Swelling Lake, Liquid Drift->Trickling Purity, Tide Tributary->Pouring Descent, Cresting Onslaught->Tides of Justice; C3/C5 generic->Turbulent Ripples/Churning Whirlpool. C2/C3/C5 effects OK, name-only (KQM).
- Passives misnamed: #1 'Suffusion'/'Outflow' isn't a real talent (real A1=Spotless Waters); #2 'Rising Waters' has correct A4 content but real name is 'Clear Waters'. #2 left unedited (effect correct, name only) (KQM).
- Verdict: authored from beta datamine — needs full re-authoring of C1/C4/C6+A1 vs release. CORRECT as-is: skill/burst mechanics, all scalings (340.7/59.04/183.36%), CD 10/20s, energy 80, C2 +3s/-30%SPD, A4 45%/5000 cap, summon 4s/0.5s tick.

### wriothesley

- Icefang Rush effect buff atk% value:50 (+duration:10): no gcsim source (no ATKP mod from E) & absent from kit text; A4 gives 6%/stack ATK, not flat 50. Likely genshin-db artifact, already curator-noted #1 as delete/correct. Left unchanged (structural, reviewer-gated).

### xingqiu

- Burst summon 'Rainbow Bladework' duration=15.55s vs canonical 15.0s (sidecar/kit; gcsim orbital=15\*60=900f). 15.55 = gcsim burstKey status dur+33 anim frames (933f/60). Traces to a real gcsim value, not provably wrong; left unchanged.

### yaoyao

- Burst 'Yuegui: Jumping Mode' summon duration:6 — gcsim burstDur=6\*60=6s (priority-2) vs genshin-db/sidecar 'Adeptal Legacy Duration'=5.0s; kit text gives no number. gcsim outranks sidecar so 6 is defensible but contested; left unchanged (already noted in \_curatorNotes).
- C4 Winsome buff duration:8 — matches kit text 'for 8s' (priority-1); gcsim c4 NewBaseWithHitlag(8.8\*60) is hitlag-inflated not a true 8.8s window. Value verified correct per kit text; open \_curatorNotes reviewer question resolvable in favor of 8.

### yelan

- C2 Taking All Comers: kit text + gcsim (c2icd = F+1.8\*60) document a 1.8s ICD; effect has no procCooldown (trigger 'manual'). scaling:14 is correct — ICD gap is unmodeled data completeness, not re-authored per verification-only scope.

### yun_jin

- skill shield: flat:2542 is CORRECT (gcsim skillShieldFlat[9]=2542.14 @TL10) but skill \_curatorNotes still says '+2542 flat portion is dropped — schema gap'. Note is stale; shield.flat landed 2026-07-12 (ability.ts L871). Value fine, note misleading — no value change made.

## Clean characters (no fixes, no flags)

albedo, alhaitham, aloy, baizhu, barbara, beidou, bennett, candace, charlotte, chevreuse, citlali, clorinde, collei, cyno, dahlia, diluc, diona, dori, emilie, escoffier, eula, faruzan, flins, freminet, furina, ganyu, gorou, ineffa, jean, kachina, kaedehara_kazuha, kaeya, kamisato_ayaka, kamisato_ayato, kaveh, keqing, kinich, kirara, klee, kujou_sara, kuki_shinobu, lanyan, layla, linnea, lisa, lynette, lyney, mavuika, mika, mona, mualani, navia, neuvillette, nilou, ningguang, ororon, qiqi, razor, rosaria, sayu, sethos, shenhe, shikanoin_heizou, sigewinne, thoma, tighnari, varka, venti, wanderer, xiangling, xianyun, xilonen, xinyan, yae_miko, yanfei, yoimiya, yumemizuki_mizuki, zibai
