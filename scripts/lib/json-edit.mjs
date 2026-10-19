/**
 * scripts/lib/json-edit.mjs
 *
 * Write a mutated character back into its JSON TEXT, touching only what changed.
 *
 * ⚓⚓ WHY THIS EXISTS. The corpus is hand-formatted — compact where a curator wanted
 * compact, expanded where they wanted that — and the writers used to end with
 * `format(JSON.stringify(data))`. `JSON.stringify` throws the layout away and prettier
 * then collapses every object it can fit on a line, so authoring 233 numbers produced a
 * 14,190-line diff (§1.K, 2026-09-20) and six frame maps cost Iansan 173 deleted lines.
 * A review of such a diff cannot see the change it is reviewing.
 *
 * So a writer keeps mutating the parsed object exactly as before, and this turns the
 * DIFFERENCE between the parsed original and the mutated object into `jsonc-parser`
 * edits against the original text. Untouched bytes stay untouched.
 *
 * - An object is diffed key by key. ⚠️ One written on a single line that gains or loses
 *   a key is rewritten whole, compact (2026-10-19 — the walk round's 72 files). A NEW key is inserted after the nearest key that
 *   precedes it in the mutated object's own order, so a writer states a position by
 *   building its object in that order (`anim`, `hit`, `lands`, then the cancels).
 *   ⚠️ A pure REORDER of existing keys is not applied — there is no edit for it, and
 *   reflowing a map to move a key is the thing this file exists to avoid.
 * - An array of the same length is diffed element by element; a length change
 *   replaces the array whole (indices stop meaning the same element).
 * - Everything else is replaced at its own path.
 *
 * The caller still runs prettier over the result — on TEXT, where it respects an
 * object the author expanded.
 */

import { applyEdits, findNodeAtLocation, modify, parseTree } from 'jsonc-parser';

const FORMAT = { insertSpaces: false, tabSize: 1 };
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** One-line JSON in the corpus's compact style — `{ "anim": 20, "hit": 12 }`. */
const compact = (v) =>
	Array.isArray(v)
		? `[${v.map(compact).join(', ')}]`
		: isObject(v)
			? `{ ${Object.entries(v)
					.map(([k, x]) => `${JSON.stringify(k)}: ${compact(x)}`)
					.join(', ')} }`
			: JSON.stringify(v);

export function surgicalRewrite(text, before, after) {
	let out = text;
	const set = (path, value, order) => {
		out = applyEdits(
			out,
			modify(out, path, value, {
				formattingOptions: FORMAT,
				...(order ? { getInsertionIndex: order } : {})
			})
		);
	};
	const walk = (a, b, path) => {
		if (same(a, b)) return;
		if (isObject(a) && isObject(b)) {
			// ⚠️ A key ADDED to (or removed from) an object the author wrote on ONE line:
			// `modify` inserts it on a line of its own, and prettier then keeps the whole
			// object expanded (it honours a newline after `{`). Rewrite that object
			// compact instead, and let prettier expand it only if it no longer fits.
			const keysMoved =
				Object.keys(a).some((k) => !(k in b)) || Object.keys(b).some((k) => !(k in a));
			const node = keysMoved ? findNodeAtLocation(parseTree(out), path) : undefined;
			if (node && !out.slice(node.offset, node.offset + node.length).includes('\n')) {
				out = out.slice(0, node.offset) + compact(b) + out.slice(node.offset + node.length);
				return;
			}
			for (const k of Object.keys(a)) if (!(k in b)) set([...path, k], undefined);
			const wanted = Object.keys(b);
			for (const k of wanted) {
				if (k in a) walk(a[k], b[k], [...path, k]);
				else
					set([...path, k], b[k], (existing) => {
						for (let i = wanted.indexOf(k) - 1; i >= 0; i--) {
							const at = existing.indexOf(wanted[i]);
							if (at >= 0) return at + 1;
						}
						return 0;
					});
			}
			return;
		}
		if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
			a.forEach((x, i) => walk(x, b[i], [...path, i]));
			return;
		}
		set(path, b);
	};
	walk(before, after, []);
	return out;
}
