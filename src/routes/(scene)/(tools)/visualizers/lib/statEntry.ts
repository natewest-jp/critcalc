// What a typed entry on Artifact odds' piece card matches: a substat's name,
// or a value the game can show for it. The card's fields offer a list and
// take typing, and only ever set an entry from the list, so what you type is
// a search: an impossible value is never set, and never quietly swapped for
// a near one (the streamer's report, 2026-11-03).

export type FieldOption = {
	/** What the field sets ('' clears a name). */
	value: string;
	/** What the list and the field show. */
	label: string;
	/** Other words a name answers to, lowercase: "cd", "crit damage". */
	terms?: string[];
};

export type Match = {
	/** The options to list, in order. */
	options: FieldOption[];
	/** The option the text names exactly, if any: what Enter or leaving sets. */
	exact: FieldOption | null;
	/** True when nothing matched and `options` are the nearest instead. */
	nearest: boolean;
};

/** A typed number, as the game writes it: a comma is a decimal point. */
const asNumberText = (text: string) => text.trim().replace(',', '.');
const NUMBER_PREFIX = /^\d*\.?\d*$/;

/**
 * Values: every option whose label starts with the text, or that is the same
 * number ("21" is 21.0). Exact only for the same number, never the first of
 * several that start alike. When nothing starts with it, the nearest value
 * on each side, so the list says where the text fell.
 */
export function matchValue(text: string, options: FieldOption[]): Match {
	const t = asNumberText(text);
	if (t === '') return { options, exact: null, nearest: false };
	if (!NUMBER_PREFIX.test(t) || t === '.') return { options: [], exact: null, nearest: false };
	const n = Number(t);
	const exact = options.find((o) => o.value !== '' && Number(o.value) === n) ?? null;
	const starts = options.filter((o) => o.label.startsWith(t) || o === exact);
	if (starts.length) return { options: starts, exact, nearest: false };
	const below = options.filter((o) => Number(o.value) < n).at(-1);
	const above = options.find((o) => Number(o.value) > n);
	return { options: [below, above].filter((o) => o !== undefined), exact: null, nearest: true };
}

/**
 * Names: an option matches when its label, a word of its label, or one of its
 * terms starts with the text, case aside. Exact when the text is the label or
 * a term ("cd", "crit dmg"), or when only one option matches ("ener").
 */
export function matchName(text: string, options: FieldOption[]): Match {
	const t = text.trim().toLowerCase();
	if (t === '') return { options, exact: null, nearest: false };
	const words = (o: FieldOption) => [
		o.label.toLowerCase(),
		...o.label.toLowerCase().split(/\s+/),
		...(o.terms ?? [])
	];
	const named = options.filter((o) => o.value !== '');
	const hits = named.filter((o) => words(o).some((w) => w.startsWith(t)));
	const exact =
		named.find((o) => o.label.toLowerCase() === t || (o.terms ?? []).includes(t)) ??
		(hits.length === 1 ? hits[0] : null);
	return { options: hits, exact, nearest: false };
}
