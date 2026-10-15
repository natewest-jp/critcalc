/**
 * The breakpoint table is the ONLY source of a width `@media` literal.
 *
 * ⚠️⚠️ Custom properties do not work inside media queries, so every `@media`
 * block in the codebase writes a LITERAL and cites `$lib/breakpoints.ts`. That
 * discipline is a convention, and this is the guard the responsive survey
 * proposed for it (§5; ⚓ Nate approved the promotion 2026-09-22): a width
 * literal that is not in the table is a new threshold nobody measured, which is
 * exactly how AtlasView's stray 620px sat 20px off the chrome's stop for a
 * month.
 *
 * ⚓ CONTENT STOPS ARE ALLOWED, BY NAME. A surface can have a measured minimum of
 * its own that maps onto no shared fact (the survey's own ruling — forcing a
 * real content stop onto a wrong shared number is worse than the stray it
 * replaces). Each is listed here WITH its reason, so adding one is a decision
 * recorded in one place rather than a literal that looks like every other.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BP, HEIGHT } from './breakpoints';

const SRC = join(__dirname, '..');

/** Width literals that are NOT breakpoints — a surface's own measured stop. */
const CONTENT_STOPS: Record<string, string> = {
	'1260px':
		"AtlasView — two columns of role cards: 'SURVIVABILITY' sets 147px at --fs-2xl and the wall margin takes 96px out of the column; measured, 1180 left 3px of slack",
	'1024px':
		"Visualizers — the workspace's second column, and where `.ws` takes the viewport's height: the tile is a SIZE container from here (100cqh), which the capped instruments and the Crit Heatmap's stage measure against",
	'1360px':
		"Visualizers — two instruments fit side by side (viewportCapacity); below it band A's lineup controls do nothing, so the band is hidden"
};

const walk = (dir: string, out: string[] = []): string[] => {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, out);
		else if (/\.(svelte|css)$/.test(name)) out.push(p);
	}
	return out;
};

const WIDTH_QUERY = /@media[^{]*?\((?:min|max)-width:\s*([\d.]+(?:px|rem|em))\)/g;
/** Every height feature anywhere in an `@media` prelude (a list may hold several). */
const MEDIA_PRELUDE = /@media([^{]*)\{/g;
const HEIGHT_FEATURE = /\((?:min|max)-height:\s*([\d.]+(?:px|rem|em))\)/g;

describe('breakpoint table', () => {
	const allowed = new Set<string>([...Object.values(BP), ...Object.keys(CONTENT_STOPS)]);

	it('every width @media literal in src is a table value or a named content stop', () => {
		const strays: string[] = [];
		for (const file of walk(SRC)) {
			const text = readFileSync(file, 'utf8');
			for (const m of text.matchAll(WIDTH_QUERY)) {
				if (!allowed.has(m[1])) strays.push(`${relative(SRC, file)}: ${m[0].trim()}`);
			}
		}
		expect(
			strays,
			'a width literal outside $lib/breakpoints.ts — add it to the table or to CONTENT_STOPS with its reason'
		).toEqual([]);
	});

	it('a content stop is not secretly a breakpoint', () => {
		// The list exists to name exceptions; a value that IS in the table does
		// not belong in it.
		for (const stop of Object.keys(CONTENT_STOPS)) {
			expect(Object.values(BP) as string[], `${stop} is a breakpoint`).not.toContain(stop);
		}
	});

	it('the table writes each rung once, in one unit per rung', () => {
		const values = Object.values(BP) as string[];
		expect(new Set(values).size).toBe(values.length);
		for (const v of values) expect(v).toMatch(/^[\d.]+(px|rem)$/);
	});

	it('every height @media literal is the height axis (THE HEIGHT AXIS, breakpoints.ts)', () => {
		const heights = new Set<string>(Object.values(HEIGHT));
		const strays: string[] = [];
		for (const file of walk(SRC)) {
			const text = readFileSync(file, 'utf8');
			for (const m of text.matchAll(MEDIA_PRELUDE)) {
				for (const h of m[1].matchAll(HEIGHT_FEATURE)) {
					if (!heights.has(h[1])) strays.push(`${relative(SRC, file)}: @media${m[1].trim()}`);
				}
			}
		}
		expect(
			strays,
			'a height literal outside HEIGHT in $lib/breakpoints.ts — a short screen is (max-height: 30rem)'
		).toEqual([]);
	});
});
