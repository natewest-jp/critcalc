/**
 * src/lib/data/plannerSamples.ts
 *
 * THE FIRST-VISIT SAMPLES (2026-10-17, ⚓ Nate). The first time the Rotation
 * Planner's tabs are created in a browser — nothing saved, and no share link
 * arriving — the first tab opens on ONE of these, picked at random, so a
 * visitor sees what the tool draws before they have typed a thing. The tab is
 * named "Sample: <name>", carries the sample's constellations and loadouts at
 * TAB level (never the reader's roster), and the Notes panel credits the
 * source for as long as the notation is still the sample's own.
 *
 * ⚓ Picked and corrected by Nate from a verified shortlist; every notation
 * parses with no unknown tokens and no editor flags (checked when it landed).
 * ⛔ Not a Library section: samples are first-visit only for launch. A browsable
 * catalog, if it comes, reads this list rather than storage, so a new sample
 * reaches everyone and nothing ever needs deleting.
 *
 * Build keys are character IDS (the index's `id`), not display names.
 */

import type { LoadoutEntry } from '$lib/stores';

export type SampleSource = { name: string; url: string };

export type PlannerSample = {
	id: string;
	/** The team as players call it — the tab is "Sample: <name>". */
	name: string;
	notation: string;
	/** Constellations the team is shown at (absent members: C0). ⚓ Every 4★
	 *  member is declared, at C6 unless the source says otherwise — the KQM
	 *  standard every sample follows (pinned by `plannerSamples.test.ts`). */
	cons?: Record<string, number>;
	loadout?: Record<string, LoadoutEntry>;
	/** Where the rotation comes from; null = written for critcalc. */
	source: SampleSource | null;
	/** True when the rotation was changed from its source's version. */
	adapted?: boolean;
};

const PRYDWEN = (char: string): SampleSource => ({
	name: 'Prydwen',
	url: `https://www.prydwen.gg/genshin-impact/characters/${char}`
});
const KQM = (path: string): SampleSource => ({
	name: 'Keqing Mains',
	url: `https://keqingmains.com/${path}`
});

export const PLANNER_SAMPLES: readonly PlannerSample[] = [
	{
		id: 'mavuika-melt',
		name: 'Mavuika Melt',
		notation:
			'Mavuika E > Bennett E > Iansan E Q > Bennett Q > Citlali E Q > Mavuika Q CCCF DCCCF DCF',
		cons: { bennett: 6, iansan: 6 },
		loadout: { bennett: { artifactSetId: 'noblesse_oblige' } },
		source: PRYDWEN('mavuika')
	},
	{
		id: 'flins-lunar-charged',
		name: 'Flins Lunar-Charged',
		notation: 'Columbina E Q > Ineffa E > Sucrose E > Flins E E sQ N4D N3 E sQ N4D N2 E sQ N4',
		cons: { sucrose: 6, flins: 1 },
		loadout: {
			columbina: { artifactSetId: 'silken_moons_serenade' },
			sucrose: {
				weaponId: 'thrilling_tales_of_dragon_slayers',
				weaponRefinement: 5,
				artifactSetId: 'viridescent_venerer'
			}
		},
		source: PRYDWEN('flins'),
		adapted: true
	},
	{
		id: 'nefer-lunar-bloom',
		name: 'Nefer Lunar-Bloom',
		notation: 'Lauma Q hE > Columbina Q E > Sucrose E > Nefer E 3[C D] E 2[C D] C Q > Columbina C',
		cons: { sucrose: 6 },
		source: PRYDWEN('nefer')
	},
	{
		id: 'columbina-hypercarry',
		name: 'Columbina Hypercarry',
		notation: 'Columbina E > Nahida EQ > Lauma hEQ > Nilou EN2E > Columbina Q5[C]',
		cons: { nilou: 2 },
		loadout: { lauma: { artifactSetId: 'deepwood_memories' } },
		source: null
	},
	{
		id: 'zibai-lunar-crystallize',
		name: 'Zibai Lunar-Crystallize',
		notation: 'Columbina E Q > Linnea E > Illuga Q E > Zibai E N4 E N1 Q E N4 E N4 E',
		cons: { illuga: 6 },
		source: PRYDWEN('columbina')
	},
	{
		id: 'navia-lunar-crystallize',
		name: 'Navia Lunar-Crystallize',
		notation: 'Columbina E Q > Navia Q > Furina E Q > Linnea E Q > Navia E 3[N2 D] E 3[N2 D]',
		source: PRYDWEN('furina')
	},
	{
		id: 'skirk-shenhe',
		name: 'Skirk with Shenhe',
		notation: 'Furina E D Q > Escoffier E Q > Shenhe hE Q > Skirk E N5 Q N5 D N5 C D N5 D',
		source: PRYDWEN('skirk')
	},
	{
		id: 'mizuki-sac-frags',
		name: 'Sac Frags Mizuki',
		notation:
			'Cryo Traveler E > Faruzan Q > Odette EE > Mizuki E~2s > Cryo Traveler CQ > Mizuki E > Faruzan Q > Odette EE > Mizuki E~2s > Cryo Traveler EQ > Mizuki E',
		cons: { traveler_cryo: 4, faruzan: 6 },
		loadout: {
			yumemizuki_mizuki: { weaponId: 'sacrificial_fragments', weaponRefinement: 5 }
		},
		source: null
	},
	{
		id: 'raiden-national',
		name: 'Raiden National',
		notation:
			'Raiden E > Xingqiu E D Q N1 > Bennett Q N1 E > Xiangling N1 Q N1 E D > Bennett E N1 > Raiden Q 3[N3C] N1C E > Bennett E',
		cons: { xingqiu: 6, bennett: 6, xiangling: 6 },
		source: KQM('q/raiden-quickguide/'),
		adapted: true
	},
	{
		id: 'double-hydro-national',
		name: 'Double Hydro National',
		notation:
			'Yelan Q N1 E N1 > Xingqiu Q N1 > Bennett E N1 Q > Xiangling N1 Q N1 E > Xingqiu N2 > Bennett N1 E > Yelan N1 E N1 > Xingqiu N1 E D N2 > Bennett N1 E > Xiangling N2 > Bennett N1 E > Xiangling N2',
		cons: { xingqiu: 6, bennett: 6, xiangling: 6 },
		source: KQM('q/xiangling-quickguide/')
	},
	{
		id: 'nahida-hyperbloom',
		name: 'Nahida Hyperbloom',
		notation:
			'Nahida E Q > Xingqiu Q N1 > Kuki Shinobu E N1 > Yelan E N1 Q > Nahida N3 E N3 D N3 > Xingqiu N1 E N2 > Nahida N1 E N3 D N3 > Yelan E N1 > Kuki Shinobu Q N1 > Nahida N3 D N3',
		cons: { xingqiu: 6, kuki_shinobu: 6 },
		source: KQM('q/nahida-quickguide/')
	},
	{
		id: 'sukokomon',
		name: 'Sukokomon',
		notation:
			'Fischl E > Kokomi E > Xiangling ED > Sucrose N1 E > Xiangling Q > Kokomi Q N3C N3D N3C > Fischl Q > Xiangling ED > Sucrose N1 E N2 Q N3',
		cons: { fischl: 6, xiangling: 6, sucrose: 6 },
		loadout: { sucrose: { artifactSetId: 'viridescent_venerer' } },
		source: KQM('q/kokomi-quickguide/')
	},
	{
		id: 'kinich-burning',
		name: 'Kinich Burning',
		notation:
			'Emilie E > Bennett Q E > Xiangling Q E > Kinich E Q 3[N2E] N1E > Bennett E > Xiangling N2',
		cons: { bennett: 6, xiangling: 6 },
		loadout: { bennett: { artifactSetId: 'noblesse_oblige' } },
		// ⚓ Nate 2026-10-17: KQM's `shE N2E Q E 3[N2E]` loses its last cannon
		// to Human timing (the stance ends first); this one fits either way.
		source: KQM('q/kinich-quickguide/'),
		adapted: true
	},
	{
		id: 'cyno-aggravate',
		name: 'Cyno Aggravate',
		notation: 'Fischl E > Nahida E Q > Baizhu EQ > Fischl Q > Cyno E N1 Q N2E 3[N5 N2E]',
		cons: { fischl: 6 },
		source: KQM('q/cyno-quickguide/')
	},
	{
		id: 'hu-tao-double-hydro',
		name: 'Hu Tao Double Hydro',
		notation: 'Xingqiu Q E > Yelan E Q > Zhongli hE > Hu Tao E 7[N2CJ] Q',
		cons: { xingqiu: 6 },
		source: KQM('q/hu-tao-quickguide/'),
		adapted: true
	}
];

export const sampleById = (id: string | undefined): PlannerSample | undefined =>
	id ? PLANNER_SAMPLES.find((s) => s.id === id) : undefined;

/** One sample at random — each first visit gets its own. */
export const pickSample = (): PlannerSample =>
	PLANNER_SAMPLES[Math.floor(Math.random() * PLANNER_SAMPLES.length)];
