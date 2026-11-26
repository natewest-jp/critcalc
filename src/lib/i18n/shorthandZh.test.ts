import { describe, it, expect } from 'vitest';
import { convertShorthand, readsAsShorthand } from './shorthandZh';
import { nameAtStart, suggestNotationNames, wholeNotationName } from './notationNames';

const convert = (doc: string) => convertShorthand(doc).text;

// Real lines from Chinese guides; the sources are in
// docs/rounds/zh-shorthand-research-2026-11-26.md.
describe('real guide lines', () => {
	it('reads a chain joined by arrows, with A as a normal attack', () => {
		// The to-do's example; the same shape as 18183 and Gamersky's 雷神 lines.
		expect(convert('雷神E→夜兰EQ→班尼特QE→香菱QE→雷神Q+AAAZ闪')).toBe(
			'Raiden E > Yelan E Q > Bennett Q E > Xiangling Q E > Raiden Q N3 C D'
		);
	});

	it('reads a list joined by 、, with a whole-step alternative and 接输出', () => {
		// 17173, Arlecchino (2025-11).
		const out = convertShorthand('仆人E、班尼特EQ、希诺宁EAA、茜特菈莉AEQ/EE、仆人Z接输出');
		expect(out.text).toBe(
			'Arlecchino E > Bennett E Q > Xilonen E N2 > Citlali N1 E Q > Arlecchino C ~?s'
		);
		expect(out.dropped).toBe(1);
	});

	it('reads optional letters, 短E, and a one-action alternative', () => {
		// 17173, Furina V5.4 (2025-03).
		expect(convert('那维莱特短E→芙宁娜QE→希诺宁E(Q)AA→枫原万叶E或Q→那维莱特Z(E)Q(Z)')).toBe(
			'Neuvillette E > Furina Q E > Xilonen E (Q) N2 > Kazuha E/Q > Neuvillette C (E) Q (C)'
		);
	});

	it('reads a hold written in brackets, and drops a team label', () => {
		// 17173, Arlecchino (2025-11), with Gamersky's label form.
		const out = convertShorthand('仆钟千班：仆人E、钟离E（长按）、班尼特EQ、千织EE、仆人Z接输出');
		expect(out.text).toBe(
			'Arlecchino E > Zhongli hE > Bennett E Q > Chiori E E > Arlecchino C ~?s'
		);
		expect(out.dropped).toBe(1);
	});

	it('reads 长E, a count in words, and a note it cannot read stays', () => {
		// 7723, Neuvillette (2024-12).
		expect(convert('龙王E→砂糖E→钟离长E，吃晶片→香菱EQ→龙王重击')).toBe(
			'Neuvillette E > Sucrose E > Zhongli hE 吃晶片 > Xiangling E Q > Neuvillette C'
		);
		// 17173, Mavuika and Neuvillette (2025-01).
		expect(convert('那维莱特E→芙宁娜EQ→希诺宁EQAA→玛薇卡EQ→那维莱特EQ接4发重击→循环。')).toBe(
			'Neuvillette E > Furina E Q > Xilonen E Q N2 > Mavuika E Q > Neuvillette E Q C C C C'
		);
	});

	it('reads repeats, and keeps a repeat it cannot count', () => {
		// 18183, Yae Miko teams (2024-01).
		expect(convert('雷神AAAZ*3+AZ')).toBe('Raiden [N3C]x3 N1 C');
		expect(convert('刻晴EQE+AZ*4+EE')).toBe('Keqing E Q E [N1C]x4 E E');
		// Gamersky, Wriothesley (2023-10): lower case, and a literal n.
		expect(convert('莱欧斯利e、aaaz*n')).toBe('Wriothesley E N3 C *n');
	});

	it('reads a number before letters as a count, and before a doubled letter as rounds', () => {
		// 17173 (2025-11) and BWIKI, Hu Tao.
		expect(convert('阿蕾奇诺3A1Z')).toBe('Arlecchino N3 C');
		expect(convert('胡桃E 8AAZJ')).toBe('Hu Tao E [N2CJ]x8');
	});
});

describe('names', () => {
	it('reads the longest name, so a game name beats the nickname inside it', () => {
		expect(nameAtStart('那维莱特短E')?.native).toBe('那维莱特');
		expect(nameAtStart('那维E')?.matches.map((m) => m.notation)).toEqual(['Neuvillette']);
		expect(nameAtStart('神里绫华E')?.matches.map((m) => m.notation)).toEqual(['Ayaka']);
	});

	it('leaves a nickname with two owners as written, and offers both', () => {
		expect(convert('火神E→班尼特Q')).toBe('火神 E > Bennett Q');
		expect(suggestNotationNames('火神').map((s) => s.notation)).toEqual(['Mavuika', 'Bennett']);
		expect(wholeNotationName('水神')).toBeNull();
	});

	it('reads the Travelers by element', () => {
		expect(convert('草主E→纳西妲EQ')).toBe('Dendro Traveler E > Nahida E Q');
	});

	it('swaps in a leading "then" or "swap to" before a name', () => {
		expect(convert('火神开E之后冲刺2次，再切希诺宁EQAA→班尼特EQ')).toBe(
			'火神 E D D > Xilonen E Q N2 > Bennett E Q'
		);
	});
});

describe('what it leaves alone', () => {
	it('leaves segments that are notation already exactly as they are', () => {
		const doc = 'Fischl E A A  >  雷神E→夜兰EQ\n> Bennett Q';
		expect(convert(doc)).toBe('Fischl E A A  >  Raiden E > Yelan E Q\n> Bennett Q');
	});

	it('keeps an English word whole, and a note in brackets is dropped', () => {
		const out = convertShorthand('九条E接蓄力射击(2命能自己吃到buff)>班尼特Q清除怪物身上元素');
		expect(out.text).toBe('Kujou Sara E C > Bennett Q 清除怪物身上元素');
		expect(out.dropped).toBe(1);
	});

	it('leaves a notation turn with a Chinese word left in it, so its A stays an aimed shot', () => {
		expect(convertShorthand('Fischl E A 吃晶片 > Bennett Q').changes).toEqual([]);
		expect(readsAsShorthand('Fischl E A 吃晶片 > Bennett Q')).toBe(false);
	});

	it('changes nothing when there is no Chinese', () => {
		expect(convertShorthand('Bennett E > Xiangling Q').changes).toEqual([]);
	});
});

describe('readsAsShorthand', () => {
	it('is true for shorthand', () => {
		expect(readsAsShorthand('雷神E→夜兰EQ')).toBe(true);
		expect(readsAsShorthand('仆人E、班尼特EQ')).toBe(true);
	});

	it('is false for notation with Chinese names, which the name offer handles', () => {
		expect(readsAsShorthand('胡桃 E > 钟离 hE N2 C')).toBe(false);
	});

	it('is false for Japanese, whose players write KQM', () => {
		expect(readsAsShorthand('フィッシュル E A > 胡桃 E')).toBe(false);
	});

	it('is false for plain notation', () => {
		expect(readsAsShorthand('Bennett E > Xiangling Q')).toBe(false);
	});
});
