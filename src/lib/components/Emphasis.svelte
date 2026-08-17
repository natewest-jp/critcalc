<script module lang="ts">
	/**
	 * Render a string with `**bold**` spans as real `<strong>`.
	 *
	 * ⚓ NATE 2026-08-17: user-facing copy was SHOUTING for emphasis — "each tick
	 * drains 0.4U from BOTH gauges" — which is a terminal habit, born of not
	 * having bold available. On a page we do. Bold reads calmer and more
	 * professional, and it does not make a reader parse a word twice to check
	 * whether it is an acronym.
	 *
	 * ⛔ NOT `{@html}`. These strings are static and author-controlled today, so
	 * `{@html}` would work and would be the shortest path — but it makes every
	 * future caller a place where a non-static string could be passed, and the
	 * whole cost of this is ten lines. A closed marker with no other syntax
	 * cannot inject anything.
	 *
	 * ⚠️ ONLY `**`. No italics, no links, no nesting — ⛔ don't grow this into a
	 * markdown renderer. If copy needs structure, it needs markup, not a parser.
	 */
	export type EmphasisSegment = { text: string; strong: boolean };

	/** Split on `**…**`. An unclosed marker is left as literal text rather than
	 *  swallowing the rest of the string — a typo should look like a typo. */
	export function splitEmphasis(source: string): EmphasisSegment[] {
		const out: EmphasisSegment[] = [];
		const re = /\*\*([^*]+)\*\*/g;
		let last = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(source)) !== null) {
			if (m.index > last) out.push({ text: source.slice(last, m.index), strong: false });
			out.push({ text: m[1], strong: true });
			last = m.index + m[0].length;
		}
		if (last < source.length) out.push({ text: source.slice(last), strong: false });
		return out;
	}
</script>

<script lang="ts">
	let { text }: { text: string } = $props();
	const segments = $derived(splitEmphasis(text));
</script>

{#each segments as seg, i (i)}{#if seg.strong}<strong>{seg.text}</strong
		>{:else}{seg.text}{/if}{/each}

<style>
	/* ⚠ The house emphasis weight, not the browser's `bold` (700): the body face
	   is variable and --fw-semibold is the rung this design language emphasises
	   at. A full 700 inside --fs-sm prose reads as a heading fragment. */
	strong {
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
</style>
