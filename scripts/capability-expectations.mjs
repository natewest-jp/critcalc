/**
 * scripts/capability-expectations.mjs
 *
 * Ground-truth fixture for the capability coverage audit
 * (audit-capabilities.mjs): which characters ACTUALLY have headline
 * capabilities in-game, regardless of what the curated JSONs currently
 * express. The audit diffs this list against derived capabilities; every
 * mismatch is a curation-backlog item.
 *
 * ⚠️ Authored from game knowledge by Fable (2026-07-12), NOT from the data —
 * that's the point: an expectations file derived from the data could never
 * catch the data's own gaps. Review before trusting; entries flagged
 * `confidence: 'check'` are the ones to verify first.
 *
 * Scope: headline capabilities — sustained team/active-facing healing,
 * shields, off-field damage — plus a short list of ICONIC ally buffers whose
 * entire kit identity is the buff (Gorou's banner derived nothing on
 * 2026-07-12 because his E effects were never authored; a structural
 * tags-vs-effects check can't see a buff that simply isn't there). Broad buff
 * coverage stays out of fixture scope.
 *
 * Entry shape:
 *   id             character id (must match the JSON filename)
 *   kind           'heal' | 'shield' | 'offFieldDamage' | 'buff'
 *   family         buff entries only — buffFamilyOf() family ('atk' | 'em' | …)
 *   minCon         constellation at which the capability comes online in-game
 *   target         optional 'team' | 'active' | 'self' — checked when present
 *   fromAbilityType optional 'skill' | 'burst' — requires a derivation source
 *                  on that ability type (catches "Jean heals, but only her
 *                  passive is curated; her Q heal is missing")
 *   confidence     omit for confident; 'check' = verify me first
 *   note           free-text context for the reviewer
 */

export const EXPECTED = [
	// ------------------------------------------------------------------ heal
	{
		id: 'baizhu',
		kind: 'heal',
		minCon: 0,
		target: 'active',
		fromAbilityType: 'burst',
		note: 'CORRECTED 2026-07-12: Seamless Shield regeneration heals only the active character (gcsim summonSeamlessShieldHealing → Player.Active(); kit: "heal your own active character"), not team-wide'
	},
	{
		id: 'baizhu',
		kind: 'heal',
		minCon: 0,
		target: 'team',
		fromAbilityType: 'skill',
		note: 'ADDED 2026-07-12: Universal Diagnosis Gossamer Sprite heals all party members on return (gcsim Heal Target -1; kit: "all nearby party members")'
	},
	{ id: 'barbara', kind: 'heal', minCon: 0, target: 'team', fromAbilityType: 'skill' },
	{ id: 'bennett', kind: 'heal', minCon: 0, fromAbilityType: 'burst' },
	{
		id: 'charlotte',
		kind: 'heal',
		minCon: 0,
		target: 'team',
		fromAbilityType: 'burst',
		note: 'dedicated healer; kit is an uncurated stub — only her C1 self-heal derives today'
	},
	{
		id: 'chevreuse',
		kind: 'heal',
		minCon: 0,
		target: 'active',
		fromAbilityType: 'skill',
		note: 'CORRECTED 2026-07-12: heals the active character over 12s (2s ticks) and fires on BOTH press and hold E (gcsim calls skillHeal() in skillPress and skillHold) — not Hold-only as previously noted'
	},
	{
		id: 'diona',
		kind: 'heal',
		minCon: 0,
		target: 'active',
		fromAbilityType: 'burst',
		note: 'CORRECTED 2026-07-12: Drunken Mist heals only the character inside the field (gcsim Player.Active + KQM), not team-wide'
	},
	{
		id: 'diona',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'burst',
		note: 'Drunken Mist cryo ticks'
	},
	{
		id: 'dori',
		kind: 'heal',
		minCon: 0,
		target: 'active',
		fromAbilityType: 'burst',
		note: 'Q jinni tether heals the connected character at C0 (data currently derives only her C6 team heal)'
	},
	{ id: 'escoffier', kind: 'heal', minCon: 0 },
	{
		id: 'furina',
		kind: 'heal',
		minCon: 0,
		target: 'active',
		fromAbilityType: 'skill',
		note: 'CORRECTED 2026-07-12: the healer is the PNEUMA Singer of Many Waters and it heals the active character (gcsim Player.Active(); kit: "nearby active character(s)") — the Ousia Salon Members deal damage and DRAIN ally HP, they never heal'
	},
	{ id: 'gorou', kind: 'heal', minCon: 4, target: 'active', note: 'C4 General’s Glory field heal' },
	{
		id: 'hu_tao',
		kind: 'heal',
		minCon: 0,
		target: 'self',
		note: 'Q heals only Hu Tao on hit — RESOLVED 2026-07-12 (wiki/KQM verified); data target fixed team→self'
	},
	{ id: 'ifa', kind: 'heal', minCon: 0, fromAbilityType: 'skill' },
	{ id: 'jahoda', kind: 'heal', minCon: 0, target: 'active' },
	{
		id: 'jean',
		kind: 'heal',
		minCon: 0,
		target: 'team',
		fromAbilityType: 'burst',
		note: 'Dandelion Breeze burst heal + field; currently only her A1 on-hit heal is curated'
	},
	{
		id: 'kuki_shinobu',
		kind: 'heal',
		minCon: 0,
		target: 'active',
		fromAbilityType: 'skill',
		note: 'Sanctifying Ring heals the active character every pulse; currently only her A4(?) self-heal derives'
	},
	{
		id: 'lauma',
		kind: 'heal',
		minCon: 1,
		target: 'active',
		note: 'RESOLVED 2026-07-12: heal is C1-locked (per Moon-Bloom trigger, ~500% EM); C0 Lauma has no defensive utility (KQM quickguide)'
	},
	{ id: 'linnea', kind: 'heal', minCon: 0, target: 'active' },
	{ id: 'mika', kind: 'heal', minCon: 0, fromAbilityType: 'burst' },
	{ id: 'noelle', kind: 'heal', minCon: 0, note: 'chance-heal on hits while Breastplate is up' },
	{ id: 'qiqi', kind: 'heal', minCon: 0, target: 'team', fromAbilityType: 'skill' },
	{
		id: 'qiqi',
		kind: 'heal',
		minCon: 0,
		target: 'active',
		fromAbilityType: 'skill',
		note: 'ADDED 2026-07-12: Herald of Frost also regenerates the active character periodically (separate from the on-hit team heal)'
	},
	{
		id: 'sangonomiya_kokomi',
		kind: 'heal',
		minCon: 0,
		target: 'active',
		fromAbilityType: 'skill',
		note: 'CORRECTED 2026-07-12: Bake-Kurage heals only the on-field character per tick (gcsim Player.Active()), not a simultaneous team heal'
	},
	{ id: 'sayu', kind: 'heal', minCon: 0, fromAbilityType: 'burst' },
	{ id: 'sigewinne', kind: 'heal', minCon: 0, target: 'team', fromAbilityType: 'skill' },
	{ id: 'xianyun', kind: 'heal', minCon: 0, target: 'team', fromAbilityType: 'burst' },
	{
		id: 'xingqiu',
		kind: 'heal',
		minCon: 0,
		target: 'active',
		fromAbilityType: 'skill',
		note: 'rain sword shatter/expiry heals the active character — fixed 6% Xingqiu Max HP kit constant (not talent-scaled); authored via onHPDecrease proxy trigger'
	},
	{ id: 'xilonen', kind: 'heal', minCon: 0, fromAbilityType: 'burst' },
	{ id: 'yaoyao', kind: 'heal', minCon: 0, target: 'team', fromAbilityType: 'skill' },
	{
		id: 'yaoyao',
		kind: 'heal',
		minCon: 0,
		target: 'team',
		fromAbilityType: 'burst',
		note: 'ADDED 2026-07-12: Moonjade Descent — burst-window Yuegui: Jumping radish heals (lowest-HP-percentage targeting, represented as team)'
	},
	{
		id: 'clorinde',
		kind: 'heal',
		minCon: 0,
		note: 'SELF-only: Impale the Night heals Clorinde, 100% Bond-of-Life-scaled — no BoL scaling primitive exists, so the effect stays deliberately unauthored (tag-derived capability only; see clorinde.json _curatorNotes). Known audit gap, traveler_hydro precedent'
	},
	{ id: 'yumemizuki_mizuki', kind: 'heal', minCon: 0, fromAbilityType: 'burst' },
	// aino heal entry REMOVED 2026-07-12: research confirmed she has NO healing
	// at any constellation (Hydro-application/EM support only — KQM quickguide).
	{
		id: 'traveler_hydro',
		kind: 'heal',
		minCon: 0,
		target: 'self',
		note: 'RESOLVED 2026-07-12: Sourcewater Droplet pickup heals the TRAVELER only (7% max HP; C6 extends to lowest-HP ally). Pickup-triggered heals have no schema primitive yet — expected to stay a known gap until one exists'
	},

	// ---------------------------------------------------------------- shield
	{ id: 'baizhu', kind: 'shield', minCon: 0, fromAbilityType: 'burst' },
	{
		id: 'beidou',
		kind: 'shield',
		minCon: 0,
		fromAbilityType: 'skill',
		note: 'Tidecaller hold shield'
	},
	{ id: 'candace', kind: 'shield', minCon: 0, fromAbilityType: 'skill' },
	{ id: 'citlali', kind: 'shield', minCon: 0, fromAbilityType: 'skill' },
	{ id: 'dahlia', kind: 'shield', minCon: 0, fromAbilityType: 'burst' },
	{ id: 'diona', kind: 'shield', minCon: 0, fromAbilityType: 'skill' },
	{ id: 'ineffa', kind: 'shield', minCon: 0, fromAbilityType: 'skill' },
	{ id: 'kirara', kind: 'shield', minCon: 0, fromAbilityType: 'skill' },
	{ id: 'lanyan', kind: 'shield', minCon: 0, fromAbilityType: 'skill' },
	{ id: 'layla', kind: 'shield', minCon: 0, fromAbilityType: 'skill' },
	{ id: 'nicole', kind: 'shield', minCon: 0, target: 'active', fromAbilityType: 'skill' },
	{
		id: 'nicole',
		kind: 'shield',
		minCon: 2,
		target: 'team',
		note: 'C2 extends Shield of Blazing Light to nearby party members'
	},
	{ id: 'noelle', kind: 'shield', minCon: 0, fromAbilityType: 'skill' },
	{
		id: 'thoma',
		kind: 'shield',
		minCon: 0,
		fromAbilityType: 'skill',
		note: 'premier stacking shielder (E + Q); no shield derives from his kit today'
	},
	{ id: 'xinyan', kind: 'shield', minCon: 0, fromAbilityType: 'skill' },
	{ id: 'yanfei', kind: 'shield', minCon: 4 },
	{ id: 'yun_jin', kind: 'shield', minCon: 0, fromAbilityType: 'skill' },
	{
		id: 'zhongli',
		kind: 'shield',
		minCon: 0,
		fromAbilityType: 'skill',
		note: 'Hold-E Jade Shield'
	},
	{
		id: 'sigewinne',
		kind: 'shield',
		minCon: 2,
		note: 'CONFIRMED 2026-07-12: C2 Bubbly Shield (30% max HP, 250% hydro absorption); no shield below C2 (KQM quickguide)'
	},

	// ------------------------------------------------------- off-field damage
	{ id: 'fischl', kind: 'offFieldDamage', minCon: 0 },
	{ id: 'xingqiu', kind: 'offFieldDamage', minCon: 0 },
	{ id: 'yelan', kind: 'offFieldDamage', minCon: 0 },
	{ id: 'beidou', kind: 'offFieldDamage', minCon: 0, fromAbilityType: 'burst' },
	{ id: 'xiangling', kind: 'offFieldDamage', minCon: 0, fromAbilityType: 'burst' },
	{ id: 'furina', kind: 'offFieldDamage', minCon: 0, fromAbilityType: 'skill' },
	{ id: 'raiden_shogun', kind: 'offFieldDamage', minCon: 0, fromAbilityType: 'skill' },
	{ id: 'yae_miko', kind: 'offFieldDamage', minCon: 0, fromAbilityType: 'skill' },
	{ id: 'albedo', kind: 'offFieldDamage', minCon: 0, fromAbilityType: 'skill' },
	{
		id: 'emilie',
		kind: 'offFieldDamage',
		minCon: 0,
		note: 'Lumidouce case levels; kit is an uncurated stub'
	},
	{ id: 'kuki_shinobu', kind: 'offFieldDamage', minCon: 0, fromAbilityType: 'skill' },
	{
		id: 'nahida',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'skill',
		note: 'Tri-Karma coordinated strikes'
	},

	// Blind-spot batch VERIFIED 2026-07-12 (per-character gcsim/kit evidence in
	// that day's verification report): every entry below keeps dealing damage
	// while the holder is off-field — none of the deriving summons terminate on
	// swap (Citlali/Kinich checked explicitly: no OnCharacterSwap cancel).
	{
		id: 'chiori',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'skill',
		note: 'Tamoto automaton doll (stationary, 17.5s) slashes every 3.6s — core off-field Geo'
	},
	{
		id: 'citlali',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'skill',
		note: 'Itzpapa Frostfall Storm ticks Cryo at the active char every ~0.98s during the 20s timed blessing; swap does not cancel (no OnCharacterSwap handler in gcsim)'
	},
	{
		id: 'dehya',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'skill',
		note: 'Fiery Sanctum coordinated attack (once/2.5s when an in-field enemy is hit) — her headline off-field mechanic; derives via coordinatedAttack, not summon'
	},
	{
		id: 'escoffier',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'skill',
		note: 'Cooking Mek follows the active char, Frosty Parfaits every ~0.98s for 20s'
	},
	{
		id: 'ineffa',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'skill',
		note: 'Birgitta stationary turret (Electro every 2s, 20s), spawned by both E and Q'
	},
	{
		id: 'ororon',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'burst',
		note: 'Supersonic Oculus stationary turret (sonic waves, 9s)'
	},
	{
		id: 'kinich',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'burst',
		note: 'K’uhul Ajaw Dragon Breath lasers (~2.45s cadence, 15s) persist off-field — gcsim onExitField cancels only the E-stance Nightsoul, never the burst status'
	},
	{
		id: 'aino',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'burst',
		note: 'Cool Your Jets Ducky stationary water turret (Hydro every 1.5s, 14s)'
	},
	{
		id: 'traveler_anemo',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'burst',
		note: 'Gust Surge tornado (9 Anemo ticks, stationary)'
	},
	{
		id: 'traveler_dendro',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'burst',
		note: 'LeaLotus Lamp (Dendro/s, 12s, stationary) — notable off-field Dendro for Bloom'
	},
	{
		id: 'traveler_hydro',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'burst',
		note: 'Rising Waters bubble (Hydro every 0.5s) — unrelated to the tracked pickup-heal gap'
	},
	{
		id: 'gorou',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'burst',
		note: 'INCIDENTAL: General’s Glory Crystal Collapse (Geo once/1.5s, 9s) — real off-field damage but his identity is a DEF/Geo buffer'
	},
	{
		id: 'zhongli',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'skill',
		note: 'INCIDENTAL: Stone Stele resonance (Geo every 2s, 31s) — real but minor next to his shielder identity'
	},
	{
		id: 'sangonomiya_kokomi',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'skill',
		note: 'INCIDENTAL: Bake-Kurage Ripple DMG (Hydro every 2s) alongside its heal — she is a healer first'
	},
	{
		id: 'yumemizuki_mizuki',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'burst',
		note: 'INCIDENTAL: Mini Baku Munen Shockwaves from uncollected snacks over the 12s burst (un-gated on Dreamdrifter) — secondary to her heal/EM-buff identity'
	},

	// Group A frame-curation (2026-07-14): frames recovered from gcsim main /
	// open PRs (see ingest-character skill "locate the source"); effects authored
	// the same pass.
	{
		id: 'columbina',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'skill',
		note: 'Gravity Ripple follows active char — Hydro DoT 16.8% Max HP / 1.95s over 25s'
	},
	{
		id: 'durin',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'burst',
		note: 'Dragon follows active char, autonomous Pyro DMG (White AoE / Dark single-target), 20s'
	},
	{
		id: 'nicole',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'burst',
		note: 'Arcane Projection coordinated attacks during Silent Contemplation (3s ICD, max 4/burst)'
	},
	{
		id: 'kachina',
		kind: 'offFieldDamage',
		minCon: 0,
		fromAbilityType: 'skill',
		note: 'Turbo Twirly summon slams for DEF-scaling Geo every ~2s while off-field. Frameless (no gcsim source) — effects-only curation 2026-07-14; kit stays "not yet curated" until frames land'
	},

	// -------------------------------------------------- iconic ally buffers
	// Characters whose kit identity IS the buff — if these derive nothing, the
	// facet is broken in the way users would notice first.
	{
		id: 'gorou',
		kind: 'buff',
		family: 'hpdef',
		minCon: 0,
		fromAbilityType: 'skill',
		note: 'General’s War Banner DEF bonus; effects unauthored as of 2026-07-12 (curator note in JSON)'
	},
	{ id: 'bennett', kind: 'buff', family: 'atk', minCon: 0, fromAbilityType: 'burst' },
	{ id: 'kujou_sara', kind: 'buff', family: 'atk', minCon: 0 },
	{ id: 'sucrose', kind: 'buff', family: 'em', minCon: 0 },
	{
		id: 'kaedehara_kazuha',
		kind: 'buff',
		family: 'dmg',
		minCon: 0,
		note: 'A4 swirl-element DMG bonus'
	},
	{
		id: 'shenhe',
		kind: 'buff',
		family: 'dmg',
		minCon: 0,
		note: 'Icy Quills are closer to flat-DMG; family per buffFamilyOf on the authored stat'
	},
	{
		id: 'yun_jin',
		kind: 'buff',
		family: 'dmg',
		minCon: 0,
		fromAbilityType: 'burst',
		note: 'Normal-attack DMG bonus'
	},
	{
		id: 'faruzan',
		kind: 'buff',
		family: 'dmg',
		minCon: 0,
		note: 'Anemo DMG bonus (+ shred, separately)'
	},
	{
		id: 'furina',
		kind: 'buff',
		family: 'dmg',
		minCon: 0,
		fromAbilityType: 'burst',
		note: 'Fanfare all-DMG bonus'
	},
	{
		id: 'yelan',
		kind: 'buff',
		family: 'dmg',
		minCon: 0,
		fromAbilityType: 'burst',
		note: 'A4 ramping all-DMG bonus during Q'
	},

	// ------------------------------------------------- cleanse & grouping
	// A4 vocabulary (2026-07-12) — regression anchors for the new tags.
	{ id: 'barbara', kind: 'cleanse', minCon: 0, fromAbilityType: 'skill' },
	{ id: 'jean', kind: 'cleanse', minCon: 0, fromAbilityType: 'burst' },
	{ id: 'venti', kind: 'grouping', minCon: 0, fromAbilityType: 'burst' },
	{ id: 'sucrose', kind: 'grouping', minCon: 0, fromAbilityType: 'skill' },
	{ id: 'kaedehara_kazuha', kind: 'grouping', minCon: 0, fromAbilityType: 'skill' },
	{ id: 'faruzan', kind: 'grouping', minCon: 0, fromAbilityType: 'skill' }
];
