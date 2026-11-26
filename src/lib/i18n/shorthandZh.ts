/**
 * Chinese rotation shorthand, turned into notation.
 *
 * Chinese guides write a rotation as names with their actions run together,
 * joined by arrows or enumeration commas: 雷神E→夜兰EQ→班尼特QE→雷神Q+AAAZ闪.
 * That is close to KQM, with one trap: there `A` is a normal attack and `Z`
 * a charged attack, where KQM's `A` is an aimed shot. So the composer offers
 * a conversion (`notationEditor.ts`); the parser never reads shorthand, and
 * notation stays plain KQM in saved rotations and `?r=` links.
 *
 * The conventions, with their sources, and the rulings behind each choice:
 * `docs/rounds/zh-shorthand-research-2026-11-26.md`.
 *
 * What it does:
 * - A `>` segment that starts in Latin letters is notation already, and is
 *   left exactly as it is. Only segments that start in Chinese are rewritten.
 * - A separator (→ 、 , - — + ; and the like) starts a new turn only when a
 *   name follows it. Guides also put → between one character's actions.
 * - A name is the game's or a nickname (`nicknamesZh.ts`). A nickname with
 *   two owners (火神) stays as written, for the squiggle and the name list.
 * - Notes in brackets (（宗室）) and the second side of a many-action
 *   alternative (EQ/EE) are dropped, and counted. Anything else it can't read
 *   stays where it was, for the squiggle. One undo brings the original back.
 */
import { nameAtStart } from './notationNames';

export interface ShorthandChange {
	from: number;
	to: number;
	insert: string;
}

export interface ShorthandConversion {
	/** The edits, in document order, that make `doc` notation. */
	changes: ShorthandChange[];
	/** The document after them. */
	text: string;
	/** Notes in brackets and alternatives that were left out. */
	dropped: number;
}

const HAN = /\p{Script=Han}/u;
const KANA = /[぀-ヿｦ-ﾟ]/;

/** Characters that separate turns, or one turn's actions. */
const SEPARATORS = new Set(['→', '⇒', '➔', '➜', '、', ',', ';', '—', '+', '\n', '。', ':', '>']);

const CN_DIGITS: Record<string, number> = {
	一: 1,
	二: 2,
	两: 2,
	三: 3,
	四: 4,
	五: 5,
	六: 6,
	七: 7,
	八: 8,
	九: 9,
	十: 10
};

/** A count, written in digits or one Chinese numeral. */
const COUNT = '(\\d+|[一二两三四五六七八九十])';
const countOf = (text: string): number => CN_DIGITS[text] ?? parseInt(text, 10);

/** Words that are an action. The longest is tried first. */
const ACTION_WORDS: [string, string][] = (
	[
		['长按元素战技', 'hE'],
		['点按元素战技', 'E'],
		['长按战技', 'hE'],
		['点按战技', 'E'],
		['元素战技', 'E'],
		['元素爆发', 'Q'],
		['普通攻击', 'A'],
		['蓄力射箭', 'C'],
		['蓄力射击', 'C'],
		['下落攻击', 'P'],
		['长按E', 'hE'],
		['点按E', 'E'],
		['短按E', 'E'],
		['长E', 'hE'],
		['短E', 'E'],
		['点E', 'E'],
		['战技', 'E'],
		['大招', 'Q'],
		['普攻', 'A'],
		['平A', 'A'],
		['重击', 'C'],
		['蓄力', 'C'],
		['下落', 'P'],
		['闪避', 'D'],
		['冲刺', 'D'],
		['跳跃', 'J'],
		['闪', 'D'],
		['跳', 'J']
	] as [string, string][]
).sort((a, b) => b[0].length - a[0].length);

/** Words that say "and the carry plays out": the length is left unset. */
const PLAYS_OUT = ['接站场输出', '接战场输出', '开始输出', '站场输出', '接输出', '输出'];

/** Words between actions that carry no action: then, cast, swap in, loop. */
const FILLERS = [
	'然后',
	'随后',
	'之后',
	'最后',
	'切回',
	'上场',
	'起手',
	'收尾',
	'循环',
	'再',
	'接',
	'开',
	'放',
	'交',
	'切',
	'后'
].sort((a, b) => b.length - a.length);

/** Words that start an alternative. */
const OR_WORDS = ['或者', '或'];

/** KQM tokens a Chinese guide may write as they are. */
const KQM_TOKEN = /^(?:~\?s|~\d+(?:\.\d+)?s|h[12]?E|tE|pE|sE|hP|lP|sQ|sC|N[1-9]|C[1-9]|W)(?![a-z])/;

/** Shorthand letters, and what each is in notation. */
const LETTERS: Record<string, string> = {
	A: 'A',
	a: 'A',
	Z: 'C',
	z: 'C',
	E: 'E',
	e: 'E',
	Q: 'Q',
	q: 'Q',
	S: 'D',
	D: 'D',
	J: 'J',
	P: 'P',
	C: 'C'
};

/** The KQM form of a run of normal attacks. Past nine KQM has no N, so the
 *  run is written as a repeat of one attack. */
const normals = (n: number): string => (n <= 9 ? `N${n}` : `[N1]x${n}`);

/** Actions as notation: runs of `A` become one `N<count>`. */
function toNotation(actions: string[]): string[] {
	const out: string[] = [];
	let run = 0;
	const flush = () => {
		if (run) out.push(normals(run));
		run = 0;
	};
	for (const a of actions) {
		if (a === 'A') run++;
		else {
			flush();
			out.push(a);
		}
	}
	flush();
	return out;
}

interface Scan {
	/** Actions in reading order: `A` for a normal attack, notation otherwise,
	 *  or text kept as written. */
	actions: string[];
	dropped: number;
}

/**
 * The actions in one piece of a turn (the text between separators, after
 * its name). Words it can't read are kept, whole, as written.
 */
function scanActions(text: string): Scan {
	const actions: string[] = [];
	let dropped = 0;
	let unknown = '';
	const keepUnknown = () => {
		if (unknown.trim()) actions.push(unknown.trim());
		unknown = '';
	};
	const push = (...as: string[]) => {
		keepUnknown();
		actions.push(...as);
	};
	/** A count written before an action (4发重击), waiting for it. */
	let pending = 0;
	const pushCounted = (a: string) => {
		const n = pending || 1;
		pending = 0;
		push(...Array<string>(Math.min(n, 99)).fill(a));
	};

	let i = 0;
	while (i < text.length) {
		const rest = text.slice(i);
		const ch = text[i];

		// An alternative: keep one-action pairs as KQM's E/Q, and otherwise
		// keep the first side and drop the rest of the piece.
		// The piece ends here: what follows is the other option.
		const orWord = ch === '/' ? '/' : OR_WORDS.find((w) => rest.startsWith(w));
		if (orWord) {
			keepUnknown();
			const after = text.slice(i + orWord.length);
			const cut = after.search(/\/|或者|或/);
			const left = toNotation(actions);
			const right = toNotation(scanActions(cut >= 0 ? after.slice(0, cut) : after).actions);
			const single = (a: string[]) => a.length === 1 && /^[A-Za-z0-9~?.]+$/.test(a[0]);
			if (single(left) && single(right)) {
				actions.splice(0, actions.length, `${left[0]}/${right[0]}`);
				// A third option has no place in E/Q.
				if (cut >= 0) dropped++;
			} else dropped++;
			return { actions, dropped };
		}

		// Brackets: actions inside are optional, a hold marks the E before
		// it, and anything else is a note.
		const open = '(【'.indexOf(ch);
		if (open >= 0) {
			const close = text.indexOf(open === 0 ? ')' : '】', i + 1);
			if (close > i) {
				keepUnknown();
				const inner = text.slice(i + 1, close).trim();
				const last = actions.length - 1;
				if (open === 0 && /^长按E?$|^长E$/.test(inner) && actions[last] === 'E')
					actions[last] = 'hE';
				else if (open === 0 && /^(点按|短按)E?$/.test(inner)) {
					// A tap is notation's plain E: nothing to change.
				} else {
					const scan = open === 0 ? scanActions(inner) : null;
					const readable =
						scan &&
						scan.actions.length > 0 &&
						scan.dropped === 0 &&
						scan.actions.every((a) => /^[A-Za-z0-9~?.[\]/]+$/.test(a));
					if (readable) actions.push(`(${toNotation(scan.actions).join(' ')})`);
					else dropped++;
				}
				i = close + 1;
				continue;
			}
		}

		// A wait: 等4秒, 等待1.5秒.
		const wait = rest.match(/^等待?(\d+(?:\.\d+)?|[一二两三四五六七八九十])秒/);
		if (wait) {
			push(`~${CN_DIGITS[wait[1]] ?? wait[1]}s`);
			i += wait[0].length;
			continue;
		}
		// Attacking for a while (普攻4秒) has no notation: kept as written.
		const spam = rest.match(/^(普攻|普通攻击)\d+(?:\.\d+)?秒/);
		if (spam) {
			keepUnknown();
			actions.push(spam[0]);
			i += spam[0].length;
			continue;
		}
		// A count in words, before an action (4发重击) or after one (冲刺2次).
		const counted = rest.match(new RegExp(`^${COUNT}[次发下个]`));
		if (counted) {
			const n = countOf(counted[1]);
			const after = text.slice(i + counted[0].length);
			const nextIsAction =
				ACTION_WORDS.some(([w]) => after.startsWith(w)) || /^[AaZzEeQqSJDP]/.test(after);
			if (nextIsAction) pending = n;
			else if (actions.length && !unknown && n <= 99) {
				const prev = actions[actions.length - 1];
				actions.push(...Array<string>(Math.max(n - 1, 0)).fill(prev));
			} else unknown += counted[0];
			i += counted[0].length;
			continue;
		}
		// A repeat after the piece's actions: AAAZ*3, 长按E×2. The piece is
		// the group, since + and → end one.
		const times = rest.match(/^[*×xX](\d+)/);
		if (times && actions.length > 0 && !unknown) {
			const n = Math.min(parseInt(times[1], 10), 99);
			const group = toNotation(actions.splice(0));
			actions.push(n > 1 ? `[${group.join('')}]x${n}` : group.join(' '));
			i += times[0].length;
			continue;
		}

		const playsOut = PLAYS_OUT.find((w) => rest.startsWith(w));
		if (playsOut) {
			push('~?s');
			i += playsOut.length;
			continue;
		}
		const word = ACTION_WORDS.find(([w]) => rest.startsWith(w));
		if (word) {
			pushCounted(word[1]);
			i += word[0].length;
			continue;
		}
		const filler = FILLERS.find((w) => rest.startsWith(w));
		if (filler) {
			keepUnknown();
			i += filler.length;
			continue;
		}

		// KQM written inside a Chinese turn passes through.
		const kqm = rest.match(KQM_TOKEN);
		if (kqm) {
			push(kqm[0]);
			i += kqm[0].length;
			continue;
		}
		// A number before letters: 3A (three attacks), 1Z, 2E, or before a
		// doubled letter, rounds of the group (8AAZJ, eight rounds of AAZJ).
		const numbered = rest.match(/^(\d+)([AaZzEeQqSJ]+)/);
		if (numbered) {
			const n = parseInt(numbered[1], 10);
			const run = numbered[2];
			const roundOf =
				run.length > 1 && run[0].toUpperCase() === 'A' && run[1].toUpperCase() === 'A';
			if (n < 1 || n > 99) {
				unknown += numbered[0];
			} else if (roundOf) {
				const group = toNotation(run.split('').map((c) => LETTERS[c]));
				push(`[${group.join('')}]x${n}`);
			} else {
				push(...Array<string>(n).fill(LETTERS[run[0]]));
				push(
					...run
						.slice(1)
						.split('')
						.map((c) => LETTERS[c])
				);
			}
			i += numbered[0].length;
			continue;
		}
		// Letters: each one an action, but only in a run made of shorthand
		// letters alone, so an English word (QTE, BUFF) stays a word.
		const letters = rest.match(/^[A-Za-z]+/)?.[0];
		if (letters) {
			if ([...letters].every((c) => c in LETTERS)) {
				pushCounted(LETTERS[ch]);
				i++;
			} else {
				unknown += letters;
				i += letters.length;
			}
			continue;
		}
		// Punctuation that ends a sentence or trails off.
		if (/[.…!！?？\s]/.test(ch)) {
			keepUnknown();
			i++;
			continue;
		}
		unknown += ch;
		i++;
	}
	keepUnknown();
	return { actions, dropped };
}

/** A turn: the name as notation (or as written, when it has no one answer),
 *  and its actions. */
interface Turn {
	head: string | null;
	actions: string[];
}

/** The pieces of one segment, split at separators outside brackets. A `-`
 *  separates only between words, since 1-3 is a range. */
function pieces(text: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let cur = '';
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === '(' || ch === '【') depth++;
		if ((ch === ')' || ch === '】') && depth > 0) depth--;
		const dash = ch === '-' && !(/\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? ''));
		const arrow = (ch === '-' || ch === '=') && text[i + 1] === '>';
		if (depth === 0 && (SEPARATORS.has(ch) || dash || arrow)) {
			out.push(cur);
			cur = '';
			if (arrow) i++;
			continue;
		}
		cur += ch;
	}
	out.push(cur);
	return out.map((p) => p.trim()).filter(Boolean);
}

/** A team code before a colon (玛夜希班：), which labels a rotation. */
const TEAM_LABEL = /^\s*\p{Script=Han}{2,8}\s*[:：]\s*/u;

/** One segment with Chinese in it, as notation turns. */
function convertSegment(segment: string): { turns: string[]; dropped: number } {
	let text = segment.normalize('NFKC');
	let dropped = 0;
	const label = text.match(TEAM_LABEL);
	if (label && !nameAtStart(label[0].trim())) {
		text = text.slice(label[0].length);
		dropped++;
	}
	const turns: Turn[] = [];
	for (let piece of pieces(text)) {
		// "Then" or "swap to" before a name (再切希诺宁): gone, if a name follows.
		for (let probe = piece; ; ) {
			const filler = FILLERS.find((w) => probe.startsWith(w));
			if (!filler) break;
			probe = probe.slice(filler.length);
			if (nameAtStart(probe)) {
				piece = probe;
				break;
			}
		}
		const name = nameAtStart(piece);
		let rest = piece;
		if (name) {
			const head = name.matches.length === 1 ? name.matches[0].notation : name.native;
			turns.push({ head, actions: [] });
			rest = piece.slice(name.length);
		} else if (turns.length === 0) turns.push({ head: null, actions: [] });
		const scan = scanActions(rest);
		turns[turns.length - 1].actions.push(...scan.actions);
		dropped += scan.dropped;
	}
	return {
		turns: turns
			.map((t) => [t.head, ...toNotation(t.actions)].filter(Boolean).join(' '))
			.filter(Boolean),
		dropped
	};
}

/** The `>` segments of `doc`, with where each one's text sits. */
function segments(doc: string): { from: number; to: number; text: string }[] {
	const out: { from: number; to: number; text: string }[] = [];
	let start = 0;
	for (let i = 0; i <= doc.length; i++) {
		if (i < doc.length && doc[i] !== '>') continue;
		const raw = doc.slice(start, i);
		const lead = raw.length - raw.trimStart().length;
		const text = raw.trim();
		if (text) out.push({ from: start + lead, to: start + lead + text.length, text });
		start = i + 1;
	}
	return out;
}

/** The document as notation: each segment with Chinese in it rewritten, and
 *  every other character left where it was. */
export function convertShorthand(doc: string): ShorthandConversion {
	const changes: ShorthandChange[] = [];
	let dropped = 0;
	for (const seg of segments(doc)) {
		// A segment that starts in Latin letters is notation, even with a Chinese
		// word left in it (Fischl E A 吃晶片): its A is KQM's aimed shot.
		if (!HAN.test(seg.text.charAt(0))) continue;
		const converted = convertSegment(seg.text);
		dropped += converted.dropped;
		// A bare > beside the rewrite gets its spaces, as notation writes it.
		const pad = (ch: string | undefined) => (ch === '>' ? ' ' : '');
		const insert = pad(doc[seg.from - 1]) + converted.turns.join(' > ') + pad(doc[seg.to]);
		if (insert !== seg.text) changes.push({ from: seg.from, to: seg.to, insert });
	}
	let text = '';
	let at = 0;
	for (const c of changes) {
		text += doc.slice(at, c.from) + c.insert;
		at = c.to;
	}
	text += doc.slice(at);
	return { changes, text, dropped };
}

/** `doc` with only its Chinese and Japanese names made notation names: what
 *  the plain name offer would give, for comparing. */
function namesOnly(doc: string): string {
	return segments(doc)
		.map((seg) => {
			const name = nameAtStart(seg.text);
			const swapped =
				name && name.matches.length === 1 && /^\s/.test(seg.text.slice(name.length))
					? name.matches[0].notation + seg.text.slice(name.length)
					: seg.text;
			return swapped.replace(/\s+/g, ' ');
		})
		.join(' > ');
}

/**
 * Whether `doc` is written in Chinese shorthand: converting it does more
 * than turn its names into notation names. Japanese (any kana) never is,
 * because Japanese players write KQM itself, where `A` is an aimed shot.
 */
export function readsAsShorthand(doc: string): boolean {
	if (!HAN.test(doc) || KANA.test(doc)) return false;
	const converted = convertShorthand(doc);
	if (converted.changes.length === 0) return false;
	const asText = segments(converted.text)
		.map((s) => s.text.replace(/\s+/g, ' '))
		.join(' > ');
	return asText !== namesOnly(doc);
}
