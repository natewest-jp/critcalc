export const meta = {
	name: 'a6-rigor-pass',
	description:
		'A6: verify every hand-authored fixed constant (buff numbers, durations, proc CDs) across 114 effect-bearing characters against kit text + gcsim',
	whenToUse: 'Corpus-wide fixed-constant verification (data-quality-plan A6)',
	phases: [
		{
			title: 'Verify',
			detail: 'one Opus 4.8 agent per character; fix provable errors, flag the unverifiable',
			model: 'opus'
		}
	]
};

const IDS = [
	'aino',
	'albedo',
	'alhaitham',
	'aloy',
	'amber',
	'arataki_itto',
	'arlecchino',
	'baizhu',
	'barbara',
	'beidou',
	'bennett',
	'candace',
	'charlotte',
	'chevreuse',
	'chiori',
	'chongyun',
	'citlali',
	'clorinde',
	'collei',
	'columbina',
	'cyno',
	'dahlia',
	'dehya',
	'diluc',
	'diona',
	'dori',
	'durin',
	'emilie',
	'escoffier',
	'eula',
	'faruzan',
	'fischl',
	'flins',
	'freminet',
	'furina',
	'gaming',
	'ganyu',
	'gorou',
	'hu_tao',
	'iansan',
	'ifa',
	'illuga',
	'ineffa',
	'jahoda',
	'jean',
	'kachina',
	'kaedehara_kazuha',
	'kaeya',
	'kamisato_ayaka',
	'kamisato_ayato',
	'kaveh',
	'keqing',
	'kinich',
	'kirara',
	'klee',
	'kujou_sara',
	'kuki_shinobu',
	'lanyan',
	'lauma',
	'layla',
	'linnea',
	'lisa',
	'lynette',
	'lyney',
	'mavuika',
	'mika',
	'mona',
	'mualani',
	'nahida',
	'navia',
	'nefer',
	'neuvillette',
	'nilou',
	'ningguang',
	'noelle',
	'ororon',
	'qiqi',
	'raiden_shogun',
	'razor',
	'rosaria',
	'sangonomiya_kokomi',
	'sayu',
	'sethos',
	'shenhe',
	'shikanoin_heizou',
	'sigewinne',
	'skirk',
	'sucrose',
	'thoma',
	'tighnari',
	'traveler_anemo',
	'traveler_dendro',
	'traveler_electro',
	'traveler_hydro',
	'varesa',
	'varka',
	'venti',
	'wanderer',
	'wriothesley',
	'xiangling',
	'xianyun',
	'xiao',
	'xilonen',
	'xingqiu',
	'xinyan',
	'yae_miko',
	'yanfei',
	'yaoyao',
	'yelan',
	'yoimiya',
	'yumemizuki_mizuki',
	'yun_jin',
	'zhongli',
	'zibai'
];

const GCSIM_RENAMES = {
	arataki_itto: 'itto',
	hu_tao: 'hutao',
	kaedehara_kazuha: 'kazuha',
	kamisato_ayaka: 'ayaka',
	kamisato_ayato: 'ayato',
	kujou_sara: 'sara',
	kuki_shinobu: 'kuki',
	raiden_shogun: 'raiden',
	sangonomiya_kokomi: 'kokomi',
	shikanoin_heizou: 'heizou',
	yae_miko: 'yaemiko',
	yumemizuki_mizuki: 'mizuki',
	yun_jin: 'yunjin',
	traveler_anemo: 'traveler',
	traveler_dendro: 'traveler',
	traveler_electro: 'traveler',
	traveler_hydro: 'traveler'
};
const NO_GCSIM = new Set([
	'aino',
	'columbina',
	'durin',
	'iansan',
	'ifa',
	'illuga',
	'jahoda',
	'kachina',
	'linnea',
	'nefer',
	'varka',
	'zibai'
]);

const REPORT_SCHEMA = {
	type: 'object',
	required: ['characterId', 'status', 'valuesChecked', 'fixes', 'flags', 'gcsimAvailable'],
	properties: {
		characterId: { type: 'string' },
		status: { type: 'string', enum: ['clean', 'fixed', 'flagged', 'fixed+flagged', 'blocked'] },
		valuesChecked: {
			type: 'number',
			description: 'How many distinct hand-authored constants you verified'
		},
		fixes: {
			type: 'array',
			items: { type: 'string', maxLength: 300 },
			description: 'One line per corrected value: "where: was → now (evidence)". Empty if none.'
		},
		flags: {
			type: 'array',
			items: { type: 'string', maxLength: 300 },
			description:
				'Suspicious-or-unverifiable values left unchanged, one short line each. Empty if none.'
		},
		gcsimAvailable: { type: 'boolean' }
	}
};

phase('Verify');
log(`A6 rigor pass: fanning out ${IDS.length} per-character verification agents`);

const reports = await pipeline(IDS, (id) =>
	agent(
		`You are a data-VERIFICATION agent for critcalc (Genshin Impact tooling), repo /Users/producer/Code/critcalc. Your ONE character: "${id}" (src/lib/data/characters/${id}.json).

TASK — A6 rigor pass: the corpus's talent-scaled values were swept 2026-07-12 (talent-level-10 normalization), but hand-authored FIXED constants have never been verified. Verify every one of them in your character's JSON, fix what is provably wrong, flag what you cannot verify. This is verification, not re-authoring.

IN SCOPE (enumerate ALL of these in the file, count them, verify each):
- Effect numerics everywhere (abilities/passives/constellations/summons/variants): buff "value", BuffValue scaling "ratio", flatScaling "ratio", heal/shield/damage "flat" portions, "procCooldown", effect "duration", stack counts / "maxStacks", condition thresholds (HP percentages, stack requirements, teamElementCount counts)
- Summon "duration" + tick "interval"/"firstTickDelay" + durationModifiers values
- Constellation and passive effect numbers (the classic silent-rot spot: C2 "+15%", A4 "+20%" style constants)
- Talent-scaled "scaling" values: trust the 2026-07-12 sweep — only re-derive one if something around it looks wrong.

SKIP: frames{} FrameMaps and summon "spawnsAt" (gcsim-extracted in a separate stage with its own lints). For ability "cooldown"/"energyCost" (generator-parsed): cross-check them against the kit text descriptions already in the JSON — FLAG mismatches, do not silently change them.

SOURCES (priority): (1) kit text — the "description" fields in your JSON state most fixed constants ("increased by 20%", "once every 1.5s", "lasts 12s"); (2) gcsim Go source — ${NO_GCSIM.has(id) ? 'NOT AVAILABLE for this character (no gcsim dir): rely on kit text + web (wiki/KQM); mark unverifiable values as flags rather than guessing' : `~/Code/gcsim/internal/characters/${GCSIM_RENAMES[id] ?? id}/ — constants in the Go files (buff amounts, ICD frames /60 = seconds, status durations)`}; (3) talent sidecar docs/curation/talents/${id}.json for anything talent-scaled; (4) web (wiki/KQM) last resort. WebFetch/WebSearch are reachable via ToolSearch if not directly listed.

RULES:
- Fix ONLY provable errors: edit with the Edit tool, match the file's tab indentation, and add ONE _curatorNotes line on the affected ability citing "A6 rigor 2026-07-12: <field> corrected <was> → <now> (<source>)".
- NEVER change a value you cannot prove wrong. Unverifiable or merely suspicious → leave unchanged, add to your report flags (and only add a _curatorNotes line if the suspicion is strong enough that a future curator needs it).
- Percentages are percentage points (22.5 = 22.5%); values at talent level 10; conventions authority: docs/curation/tier-c-guide.md + src/lib/types/ability.ts JSDoc — read these FIRST if you need to interpret a field.
- Edit ONLY src/lib/data/characters/${id}.json. No other file, no index regen, no commits.
- If you made ANY edit: verify JSON parses (node -e "JSON.parse(require('fs').readFileSync('src/lib/data/characters/${id}.json','utf8'))") and run npx vitest run src/lib/utils/characterLint.test.ts once; fix lint findings involving your file only.
- KEEP THE REPORT COMPACT: every fixes/flags line under 300 characters, no prose narrative. Your final message is consumed by an orchestrator, not a human.`,
		{ label: `rigor:${id}`, phase: 'Verify', model: 'opus', schema: REPORT_SCHEMA }
	)
);

const ok = reports.filter(Boolean);
const lost = IDS.length - ok.length;
const fixed = ok.filter((r) => r.status.includes('fixed'));
const flagged = ok.filter((r) => r.status.includes('flagged'));
const clean = ok.filter((r) => r.status === 'clean');
log(
	`A6 complete: ${clean.length} clean, ${fixed.length} with fixes, ${flagged.length} with flags, ${lost} lost`
);

return {
	totals: {
		agents: IDS.length,
		reported: ok.length,
		lost,
		valuesChecked: ok.reduce((s, r) => s + (r.valuesChecked || 0), 0),
		fixCount: ok.reduce((s, r) => s + (r.fixes?.length || 0), 0),
		flagCount: ok.reduce((s, r) => s + (r.flags?.length || 0), 0)
	},
	fixes: ok.filter((r) => r.fixes?.length).map((r) => ({ id: r.characterId, fixes: r.fixes })),
	flags: ok.filter((r) => r.flags?.length).map((r) => ({ id: r.characterId, flags: r.flags })),
	clean: clean.map((r) => r.characterId),
	reports: ok
};
