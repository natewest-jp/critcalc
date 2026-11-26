/**
 * The faces a PNG export draws in, and making sure they are loaded first.
 *
 * Canvas takes a font string, not a custom property, and draws only with a
 * face that is already loaded: it never fetches one. So the export reads the
 * page's own stacks (`--font-body`, `--font-mono`, which on a Chinese page
 * lead into IBM Plex Sans SC through `--font-cjk`), then loads the faces for
 * every character it will draw before it measures or paints anything.
 * Plex Sans SC is split by `unicode-range` into slices, and the page has
 * loaded only the slices its own visible text needed; an export can draw a
 * character the page never showed.
 *
 * In English the stacks read the same as the fallbacks below, so nothing
 * changes there.
 */

/** The body face, when the page's stack can't be read. ⚠️ Names the variable
 *  family: the static 'IBM Plex Sans' is not loaded at all. */
const SANS_FALLBACK =
	'"IBM Plex Sans Variable", "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif';
const MONO_FALLBACK = '"IBM Plex Mono", ui-monospace, monospace';

/** The weights the exports set text in (`timelineExport.ts`, `exportBench.ts`). */
const WEIGHTS = [400, 500, 600, 700];

/** The stacks the current export draws in. Read by the painters at draw
 *  time; `prepareExportFonts` sets them at the start of each export. */
export const exportFaces = { sans: SANS_FALLBACK, mono: MONO_FALLBACK };

/** Every distinct non-ASCII character in the strings anywhere inside
 *  `value` (a snapshot: plain data, perhaps with functions and images, which
 *  are skipped). ASCII is left out because the Latin faces are preloaded on
 *  every page. */
export function nonAsciiText(value: unknown): string {
	const chars = new Set<string>();
	const seen = new WeakSet<object>();
	const walk = (v: unknown): void => {
		if (typeof v === 'string') {
			for (const ch of v) if (ch.codePointAt(0)! > 0x7e) chars.add(ch);
		} else if (Array.isArray(v)) {
			if (seen.has(v)) return;
			seen.add(v);
			for (const x of v) walk(x);
		} else if (v instanceof Map) {
			if (seen.has(v)) return;
			seen.add(v);
			for (const [k, x] of v) {
				walk(k);
				walk(x);
			}
		} else if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
			if (seen.has(v)) return;
			seen.add(v);
			for (const x of Object.values(v)) walk(x);
		}
	};
	walk(value);
	return [...chars].join('');
}

/** Read the page's stacks into `exportFaces`, then load the faces `snapshot`'s
 *  text needs in each weight. A face that fails to load leaves its text to the
 *  next face in the stack, as on the page. */
export async function prepareExportFonts(snapshot: unknown): Promise<void> {
	const style = getComputedStyle(document.documentElement);
	exportFaces.sans = style.getPropertyValue('--font-body').trim() || SANS_FALLBACK;
	exportFaces.mono = style.getPropertyValue('--font-mono').trim() || MONO_FALLBACK;

	const text = nonAsciiText(snapshot);
	if (text) {
		const loads = WEIGHTS.map((w) => `${w} 16px ${exportFaces.sans}`);
		loads.push(`400 16px ${exportFaces.mono}`);
		await Promise.allSettled(loads.map((font) => document.fonts.load(font, text)));
	}
	await document.fonts.ready;
}
