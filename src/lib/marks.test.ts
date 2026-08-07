/**
 * src/lib/marks.test.ts
 *
 * Guards the committed mark artifact (marks.generated.ts) against drift from
 * the Lucide package it was extracted from. If this fails, re-run
 * `npm run generate-marks` and commit the result — the same contract the
 * character-index and roles artifacts hold.
 *
 * It matters more here than it looks: `lucide` is a DEVdependency, so a bump
 * that redraws an icon would otherwise change nothing until someone happened to
 * regenerate, and the artifact would quietly disagree with the version its own
 * header claims. This makes that a red test instead.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as lucide from 'lucide';
import { MARK_NODES, MARK_VIEWBOX, type MarkName } from './marks.generated';

/** The generator's own map, read back out of it so there is ONE copy of the
 *  semantic-name → icon-name pairing in the repo. Parsing beats duplicating:
 *  a second hand-maintained list is exactly the drift this file exists to
 *  catch. */
function generatorMarks(): Record<string, string> {
	const src = readFileSync(
		fileURLToPath(new URL('../../scripts/generate-marks.mjs', import.meta.url)),
		'utf8'
	);
	const block = src.slice(
		src.indexOf('const MARKS = {'),
		src.indexOf('\n};', src.indexOf('const MARKS = {'))
	);
	const out: Record<string, string> = {};
	for (const line of block.split('\n')) {
		const m = line.match(/^\t([a-zA-Z]+):\s*'([A-Za-z0-9]+)'/);
		if (m) out[m[1]] = m[2];
	}
	return out;
}

const MARKS = generatorMarks();
const icons = lucide as unknown as Record<string, unknown>;

describe('generated marks', () => {
	it('parsed the generator map', () => {
		expect(Object.keys(MARKS).length).toBeGreaterThan(10);
	});

	it('every mapped name exists in the installed lucide', () => {
		const missing = Object.entries(MARKS).filter(([, icon]) => !icons[icon]);
		expect(missing).toEqual([]);
	});

	it('matches a fresh extraction (no drift)', () => {
		const fresh = Object.fromEntries(
			Object.entries(MARKS).map(([name, icon]) => [name, icons[icon]])
		);
		expect(MARK_NODES).toEqual(fresh);
	});

	it('covers exactly the generator map — no orphans either way', () => {
		expect(Object.keys(MARK_NODES).sort()).toEqual(Object.keys(MARKS).sort());
	});

	it('renders on Lucide’s own grid', () => {
		expect(MARK_VIEWBOX).toBe(24);
	});

	// The wrapper renders each node with <svelte:element this={tag}>, and only
	// SVG child elements are legal there. A future icon arriving as, say, a
	// <style> or <foreignObject> node would render as garbage rather than fail,
	// so the shape is asserted rather than assumed.
	it('every node is a plain SVG shape with string attributes', () => {
		const ALLOWED = new Set(['path', 'circle', 'line', 'rect', 'polyline', 'polygon', 'ellipse']);
		for (const [name, nodes] of Object.entries(MARK_NODES)) {
			expect(Array.isArray(nodes), name).toBe(true);
			for (const [tag, attrs] of nodes) {
				expect(ALLOWED.has(tag), `${name}: <${tag}>`).toBe(true);
				for (const [k, v] of Object.entries(attrs)) {
					expect(typeof v, `${name}.${k}`).toBe('string');
				}
			}
		}
	});

	// Marks are decorative and inherit their control's ink. An upstream icon
	// carrying its own fill or stroke would break out of that contract and
	// ignore the disabled/active states.
	it('no node carries its own paint', () => {
		for (const [name, nodes] of Object.entries(MARK_NODES)) {
			for (const [, attrs] of nodes) {
				expect(attrs.fill, name).toBeUndefined();
				expect(attrs.stroke, name).toBeUndefined();
			}
		}
	});

	it('the artifact header names the version it was cut from', () => {
		const artifact = readFileSync(
			fileURLToPath(new URL('./marks.generated.ts', import.meta.url)),
			'utf8'
		);
		const installed = JSON.parse(
			readFileSync(
				fileURLToPath(new URL('../../node_modules/lucide/package.json', import.meta.url)),
				'utf8'
			)
		).version;
		expect(artifact).toContain(`lucide@${installed}`);
	});

	it('every mark name is referenced somewhere, or is dead weight', () => {
		// Cheap orphan check: the whole point of keeping the set small is that
		// it stays the set we use. Scans source for `name="x"` / `name={'x'}` /
		// a ternary branch `'x'`.
		const files = import.meta.glob('/src/**/*.svelte', {
			eager: true,
			query: '?raw',
			import: 'default'
		});
		const corpus = Object.values(files as Record<string, string>).join('\n');
		const unused = (Object.keys(MARK_NODES) as MarkName[]).filter(
			(n) => !new RegExp(`['"]${n}['"]`).test(corpus)
		);
		expect(unused).toEqual([]);
	});
});
