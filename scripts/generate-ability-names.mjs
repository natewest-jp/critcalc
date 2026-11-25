/**
 * scripts/generate-ability-names.mjs
 *
 * Generates src/lib/data/abilityNames/{locale}.json: the game's own names for
 * every character's abilities, passives, constellations, summons, and
 * shields, in each locale besides English, as { characterId: { English:
 * name } }. English stays in the character data; `abilityName` in
 * `$lib/i18n/abilityNames` picks one for the page, and a locale's file loads
 * only on that locale's pages. Do not edit the files by hand.
 *
 *   node scripts/generate-ability-names.mjs
 *
 * Runs by hand, not on predev or prebuild: its second source, the game's text
 * maps, is about 300 MB and absent where the site deploys. The table is
 * committed, and `abilityNames.test.ts` fails when a name in the corpus has no
 * entry, so a new character or a renamed talent says to run this again.
 *
 * Two sources, in order, and nothing translated by us:
 *
 * 1. genshin-db, by position: a character's talents (combat1–3, passive1–4)
 *    and constellations (c1–c6), taken only where genshin-db's English is
 *    exactly ours.
 * 2. The game's text maps: our English is looked up in the English text map,
 *    and the same hash in the locale's one is the game's name. One English
 *    line can sit at several hashes; when their names differ only in the
 *    middle dot, the locale's dot wins (・ in Japanese, as the endgame text
 *    writes it; · in Chinese). Any
 *    other disagreement is left out and listed.
 * 3. The talent tables' row labels, for a name the game never prints alone
 *    (a summon, a field, a stance): "Tamoto DMG|…" is 「たもと」のダメージ|…, so
 *    the name is the label less its suffix and a joining の. Only the suffixes
 *    in `LABEL_SUFFIXES` are read, and every label found must agree.
 *
 * 4. By hand (`BY_HAND`), for the few parts the game prints only inside a
 *    description: each entry cites the line it was read from.
 *
 * A label composed from a game name and our words ("A1: Rekindle",
 * "Searing Onslaught (E1)") is looked up whole first, then part by part
 * (`$lib/data/nameParts.ts`), and `$lib/i18n/abilityNames` composes it back.
 * A part neither source finds is listed: our own words, which are messages
 * there, or a name the game's text doesn't have.
 *
 * The text maps are Dimbreath's `animegamedata2` (branch `main`), cached in
 * the gitignored `assets-src/textmap/`; `localize-endgame.mjs --refresh`
 * downloads them.
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { namesOf } from '../src/lib/data/abilityNameSources.ts';
import { childrenOf, isOurWord, NOTATION, splitName } from '../src/lib/data/nameParts.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHARACTERS = join(ROOT, 'src/lib/data/characters');
const OUT = join(ROOT, 'src/lib/data/abilityNames');
const CACHE = join(ROOT, 'assets-src/textmap');
const gdb = createRequire(import.meta.url)('genshin-db');

/** Our locale → genshin-db's language, the text maps' code, the middle dot
 *  that wins when two spellings differ only in it, and the particle that
 *  joins a name to a talent label's suffix ("X DMG" → Xのダメージ, X伤害). */
const LOCALES = {
	ja: { gdb: 'Japanese', map: 'JP', dot: '・', joiner: /の$/ },
	zh: { gdb: 'ChineseSimplified', map: 'CHS', dot: '·', joiner: /的$/ }
};
const NOT_IN_GAME = new Set(['blank']);

async function textMap(code) {
	const map = {};
	for (const part of [`TextMap${code}`, `TextMap_Medium${code}`]) {
		const file = join(CACHE, `${part}.json`);
		if (!existsSync(file))
			throw new Error(`missing ${file}: run node scripts/localize-endgame.mjs --refresh`);
		Object.assign(map, JSON.parse(await readFile(file, 'utf8')));
	}
	return map;
}

const DOTS = /[·･・]/g;

/** A talent-table label's English suffix → the endings it can have, per locale. */
const LABEL_SUFFIXES = {
	ja: {
		DMG: ['ダメージ'],
		'Explosion DMG': ['爆発ダメージ'],
		DoT: ['継続ダメージ'],
		Duration: ['継続時間', '存在時間', '持続時間'],
		CD: ['クールタイム'],
		'Attack Interval': ['攻撃間隔'],
		Healing: ['回復量'],
		'Shield Absorption': ['シールド吸収量'],
		Shield: ['シールド'],
		'1-Hit DMG': ['1段ダメージ'],
		'DMG Absorption': ['吸収量']
	},
	zh: {
		DMG: ['伤害'],
		'Explosion DMG': ['爆炸伤害'],
		DoT: ['持续伤害'],
		Duration: ['持续时间', '存在时间'],
		CD: ['冷却时间'],
		'Attack Interval': ['攻击间隔'],
		Healing: ['治疗量'],
		'Shield Absorption': ['护盾吸收量'],
		Shield: ['护盾'],
		'1-Hit DMG': ['第一段伤害', '单次伤害', '一段伤害'],
		'DMG Absorption': ['吸收量']
	}
};

/**
 * Names matched by hand, for a part the three sources can't reach: the game
 * prints it only inside a description, or our label words it differently.
 * Each entry cites the game's own line it was read from. Checked before the
 * sources, so it also settles a name the text maps split two ways.
 */
const BY_HAND = {
	ja: {
		alhaitham: { 'Projection Attack': '光幕攻撃' }, // "Projection Attack Interval" 光幕攻撃の間隔
		charlotte: { 'Focused Impression': 'フォーカスインプレッション' }, // 「フォーカスインプレッション」マークのダメージ
		chasca: { Nightsoul: '夜魂' }, // "Nightsoul Transmission" 夜魂トランス
		chiori: { Kinu: '「きぬ」' }, // her A4: 簡易型自動制御人形の「きぬ」
		clorinde: {
			'Glimbright Shade': '明燭の影', // her C6: 「明燭の影」が現れて追撃を行い
			'Nightvigil Shade': '夜巡りの影' // her C1: 敵の近くに夜巡りの影を召喚して
		},
		columbina: { 'Gravity Interference': '引力の干渉' }, // a highlighted term, six lines
		dehya: { 'Fiery Sanctum': '浄焔剣獄' }, // "Fiery Sanctum: Redmane's Blood" 浄焔剣獄·赤鬣の血
		diluc: { Phoenix: '炎の鳥' }, // Dawn: 前方に飛行する炎の鳥を出し
		durin: { 'Cycle of Enlightenment': '輪廻啓発' }, // a highlighted term, 「輪廻啓発」
		emilie: { 'Heart Note': 'ルミドゥースの心' }, // her C4, "Lumidouce Heart Note"
		escoffier: { 'Cooking Mek': '調理マシナリー', 'Cold Storage': '「チルド」' }, // "Cold Storage Mode" 「チルド」モード
		freminet: { 'Shattering Pressure': '高圧粉砕' }, // a highlighted term
		ineffa: { 'Optical Flow': 'オプティカルフロー' }, // "Optical Flow Shield Barrier" オプティカルフローシールド
		kujou_sara: { Ambush: '伏' }, // "Tengu Juurai: Ambush" 天狗呪雷·伏
		kuki_shinobu: { Thundergrass: '雷草' }, // her C4: 雷草が敵の位置に落ち
		linnea: { 'Memo Heal': '備忘録の回復' }, // ours: her burst is "Memo: …" 絶体絶命サバイバル備忘録
		mavuika: { 'Rings of Searing Radiance': '焚曜の輪' }, // "Ring of Searing Radiance DMG" 焚曜の輪のダメージ
		mitya: { Overloaded: '過負荷', 'Steady State': '安定状態' }, // the reaction; a highlighted term
		mona: { Phantom: '虚影' }, // a highlighted term
		nicole: {
			'Shield of Blazing Light': '熾光の護り', // her skill: 熾光の護りを展開する
			"Pathfinder's Blessing": '導きの加護', // her C4: 「導きの加護」効果を付与する
			Unity: '合性' // "Arcane Projection: Unity" ミステリウムの影・合性
		},
		nilou: { 'Sword Dance': '剣舞', 'Whirling Steps': '旋舞のステップ', 'Water Wheel': '水輪' }, // "Sword Dance/Whirling Steps 1-Hit DMG", "Luminous Illusion/Water Wheel DMG"
		noelle: { 'Stone Armor': '護身の岩鎧' }, // Breastplate: 護身の岩鎧を召喚し ("protective stone armor")
		prune: { 'Hunter-Seeker': 'ハンティング', 'Hunt the Witch': '魔女狩り' }, // 「ハンティング」モード; 「魔女狩り」効果を獲得する
		skirk: { 'Rapid Movement': '高速移動' }, // her skill's Hold: 高速移動し続ける
		valeriy: { Supercharged: '蓄雷' }, // "Supercharged Shield" 蓄雷シールド
		yaoyao: { Yuegui: '月桂', 'Jumping Mode': '跳躍型' }, // 「月桂·跳躍型」
		zibai: { "Spirit Steed's Stride": '翔ける霊駒' } // "Spirit Steed's Stride 1-Hit DMG" 翔ける霊駒の1段目ダメージ
	},
	zh: {
		alhaitham: { 'Projection Attack': '光幕攻击' }, // "Projection Attack Interval" 光幕攻击间隔
		charlotte: { 'Focused Impression': '聚焦印象' }, // "Focused Impression" Mark DMG 「聚焦印象」印记伤害
		chasca: { Nightsoul: '夜魂' }, // "Nightsoul Transmission" 夜魂传递
		chiori: { Kinu: '「绢」' }, // her A4: 简易自动制御人形「绢」
		clorinde: {
			'Glimbright Shade': '明烛之影', // her C6: 明烛之影会在特定条件下出现
			'Nightvigil Shade': '夜巡之影' // her C1: 附近唤出夜巡之影
		},
		columbina: { 'Gravity Interference': '引力干涉' }, // "Gravity Interference: Lunar-Charged DMG" 引力干涉·月感电伤害
		dehya: { 'Fiery Sanctum': '净焰剑狱' }, // "Fiery Sanctum: Redmane's Blood" 净焰剑狱·赤鬃之血
		diluc: { Phoenix: '火之鸟' }, // Dawn: 挥出向前飞行的火之鸟
		durin: { 'Cycle of Enlightenment': '轮变启迪' }, // a highlighted term, 「轮变启迪」
		emilie: { 'Heart Note': '心韵' }, // her C4, "Lumidouce Heart Note" 柔灯心韵
		escoffier: { 'Cooking Mek': '厨艺机关', 'Cold Storage': '低温冷藏' }, // "Cooking Mek: Cold Storage Mode" 厨艺机关·低温冷藏模式
		freminet: { 'Shattering Pressure': '高压粉碎' }, // "Level 0 Shattering Pressure DMG" 零阶高压粉碎伤害
		ineffa: { 'Optical Flow': '光流' }, // "Optical Flow Shield Barrier" 光流屏障护盾
		kamisato_ayato: { Shunsuiken: '瞬水剑' }, // "Shunsuiken 3-Hit DMG" 三段瞬水剑伤害
		kujou_sara: { Ambush: '伏' }, // "Tengu Juurai: Ambush" 天狗咒雷·伏
		kuki_shinobu: { 'Thundergrass Mark': '雷草标', Thundergrass: '雷草' }, // her C4: 雷草标将落在敌人所在的位置
		linnea: { 'Memo Heal': '备忘治疗' }, // ours: her burst is "Memo: …" 备忘·绝境生存指南
		mavuika: { 'Rings of Searing Radiance': '焚曜之环' }, // "Ring of Searing Radiance DMG" 焚曜之环伤害
		mitya: { Overloaded: '超载', 'Steady State': '稳态' }, // the reaction; "Steady State Core DMG" 稳态炉心伤害
		mona: { Phantom: '虚影' }, // a highlighted term
		nicole: {
			'Shield of Blazing Light': '炽光护盾', // her burst: 并展开炽光护盾
			"Pathfinder's Blessing": '先导之佑', // her C4: 「先导之佑」效果
			Unity: '合一' // "Arcane Projection: Unity" 「奥迹造影·合一」
		},
		nilou: { 'Sword Dance': '剑舞步', 'Whirling Steps': '旋舞步', 'Water Wheel': '水轮' }, // "Sword Dance/Whirling Steps 1-Hit DMG" 剑舞步/旋舞步一段伤害, "Luminous Illusion/Water Wheel DMG" 水月/水轮伤害
		noelle: { 'Stone Armor': '护体岩铠' }, // Breastplate: 唤出护体的岩铠; the effect is 护体岩铠
		prune: { 'Hunter-Seeker': '寻猎', 'Hunt the Witch': '寻猎魔女' }, // "Hunter-Seeker Mode Duration" 寻猎模式持续时间; 「寻猎魔女」效果
		skirk: { 'Rapid Movement': '快速移动' }, // her skill's Hold: 将持续快速移动
		valeriy: { Supercharged: '蓄雷' }, // "Fortune Stick: Supercharged" 灵签·蓄雷
		yaoyao: { Yuegui: '月桂', 'Jumping Mode': '弹跳型' } // 「月桂·弹跳型」
	}
};

/** One name from several text-map candidates, or null when they disagree. */
function pick(candidates, dot) {
	const set = [...new Set(candidates)];
	if (set.length === 1) return set[0];
	if (new Set(set.map((s) => s.replace(DOTS, dot))).size === 1) return set[0].replace(DOTS, dot);
	return null;
}

const english = { queryLanguages: [gdb.Language.English] };

/** genshin-db's names for one character: English → localized. */
function fromGenshinDb(name, language) {
	const out = new Map();
	const res = { ...english, resultLanguage: gdb.Language[language] };
	for (const folder of ['talents', 'constellations']) {
		const en = gdb[folder](name, english);
		if (!en || en.name !== name) continue;
		const here = gdb[folder](name, res);
		for (const key of Object.keys(en)) {
			const a = en[key]?.name;
			const b = here?.[key]?.name;
			if (typeof a === 'string' && typeof b === 'string' && /^(combat|passive|c)\d$/.test(key))
				out.set(a, b);
		}
	}
	return out;
}

const files = (await readdir(CHARACTERS)).filter((f) => f.endsWith('.json')).sort();
const characters = await Promise.all(
	files.map(async (f) => JSON.parse(await readFile(join(CHARACTERS, f), 'utf8')))
);

const enMap = await textMap('EN');
const byEnglish = new Map();
for (const [hash, s] of Object.entries(enMap)) {
	const k = s.trim();
	if (!k || k.length > 80) continue;
	const list = byEnglish.get(k);
	if (list) list.push(hash);
	else byEnglish.set(k, [hash]);
}

/** Talent-table labels: their English left of the "|" → hashes. */
const byLabel = new Map();
for (const [hash, s] of Object.entries(enMap)) {
	const bar = s.indexOf('|');
	const k = (bar < 0 ? s : s.slice(0, bar)).trim();
	if (!k || k.length > 80) continue;
	const list = byLabel.get(k);
	if (list) list.push(hash);
	else byLabel.set(k, [hash]);
}

/** Source 3: the name lifted out of the talent tables' labels, or null. */
function fromLabels(name, localMap, lang, locale) {
	const found = [];
	const stems = name.endsWith('s') ? [name, name.slice(0, -1)] : [name];
	for (const stem of stems)
		for (const [en, endings] of Object.entries(LABEL_SUFFIXES[locale]))
			for (const hash of byLabel.get(`${stem} ${en}`) ?? []) {
				const s = localMap[hash];
				if (!s) continue;
				const left = s.split('|')[0].trim();
				const end = endings.find((e) => left.endsWith(e));
				if (!end) continue;
				const core = left.slice(0, -end.length).replace(lang.joiner, '').trim();
				if (core) found.push(core);
			}
	return found.length ? pick(found, lang.dot) : null;
}

const tables = {};
const report = [];
for (const [locale, lang] of Object.entries(LOCALES)) {
	const localMap = await textMap(lang.map);
	const table = {};
	let fromDb = 0;
	let fromMap = 0;
	let dotted = 0;
	let fromLabel = 0;
	let byHand = 0;
	const missing = [];
	const split = [];
	for (const c of characters) {
		if (NOT_IN_GAME.has(c.id)) continue;
		const db = fromGenshinDb(c.name, lang.gdb);
		const row = {};
		/** One name: whole first; a composed label that isn't found whole is
		 *  looked up part by part, so "Searing Onslaught (E1)" finds Searing
		 *  Onslaught. Notation and our words are left to the page. */
		const resolve = (name) => {
			if (name in row || NOTATION.test(name) || isOurWord(name)) return;
			let local = BY_HAND[locale]?.[c.id]?.[name] ?? db.get(name);
			if (BY_HAND[locale]?.[c.id]?.[name]) byHand++;
			else if (local) fromDb++;
			else {
				// A plural ("Rain Swords") is the game's singular in Japanese and Chinese.
				const hashes =
					byEnglish.get(name) ??
					(name.endsWith('s') ? byEnglish.get(name.slice(0, -1)) : null) ??
					[];
				const candidates = hashes.map((h) => localMap[h]?.trim()).filter(Boolean);
				local = candidates.length ? pick(candidates, lang.dot) : null;
				if (local) {
					fromMap++;
					if (new Set(candidates).size > 1) dotted++;
				} else if ((local = fromLabels(name, localMap, lang, locale))) fromLabel++;
				else {
					const node = splitName(name);
					if (node) return childrenOf(node).forEach(resolve);
					if (candidates.length)
						split.push(`${c.id}: ${name} → ${[...new Set(candidates)].join(' | ')}`);
					else missing.push(`${c.id}: ${name}`);
				}
			}
			if (local) row[name] = local;
		};
		namesOf(c).forEach(resolve);
		if (Object.keys(row).length) table[c.id] = row;
	}
	tables[locale] = table;
	report.push(
		`${locale}: ${fromDb} from genshin-db, ${fromMap} from the text maps (${dotted} by the middle dot), ${fromLabel} from talent labels, ${byHand} by hand, ${split.length} split, ${missing.length} missing`,
		...split.map((s) => `  split  ${s}`),
		...missing.map((s) => `  none   ${s}`)
	);
}

await mkdir(OUT, { recursive: true });
for (const [locale, table] of Object.entries(tables))
	await writeFile(join(OUT, `${locale}.json`), JSON.stringify(table, null, '\t') + '\n');
console.log(`wrote ${OUT}/{${Object.keys(tables).join(',')}}.json`);
console.log(report.join('\n'));
