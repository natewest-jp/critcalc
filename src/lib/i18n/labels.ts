/**
 * A module-level label table that follows the locale.
 *
 * A table built at module load (`{ marimba: 'Marimba' }`) is read once, so a
 * message called there would freeze one language for the whole prerender.
 * `labels()` takes the message functions and returns a plain-looking record
 * whose every read calls its message, so callers keep `LABELS[id]`.
 */
export function labels<K extends string>(table: Record<K, () => string>): Record<K, string> {
	const out = {} as Record<K, string>;
	for (const key of Object.keys(table) as K[])
		Object.defineProperty(out, key, { enumerable: true, get: table[key] });
	return out;
}
