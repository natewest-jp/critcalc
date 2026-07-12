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
	{ id: 'baizhu', kind: 'heal', minCon: 0, target: 'team', fromAbilityType: 'burst' },
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
		fromAbilityType: 'skill',
		note: 'Hold-E heal over time'
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
		target: 'team',
		note: 'Ousia-aligned Salon / Singer of Many Waters'
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
	{ id: 'sangonomiya_kokomi', kind: 'heal', minCon: 0, target: 'team', fromAbilityType: 'skill' },
	{ id: 'sayu', kind: 'heal', minCon: 0, fromAbilityType: 'burst' },
	{ id: 'sigewinne', kind: 'heal', minCon: 0, target: 'team', fromAbilityType: 'skill' },
	{ id: 'xianyun', kind: 'heal', minCon: 0, target: 'team', fromAbilityType: 'burst' },
	{ id: 'xingqiu', kind: 'heal', minCon: 0, note: 'rain sword shatter/expiry heal' },
	{ id: 'xilonen', kind: 'heal', minCon: 0, fromAbilityType: 'burst' },
	{ id: 'yaoyao', kind: 'heal', minCon: 0, target: 'team', fromAbilityType: 'skill' },
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
