/**
 * The star veil's two readers on one formula (starVeil.ts): the TS function
 * the PNG export calls per star, and the GLSL the live star pass runs. Vitest
 * cannot run a shader, so this holds the shader to the same CONSTANTS and to
 * the chunk the TS module emits; the maths itself is pinned on the TS side.
 */
import { describe, it, expect } from 'vitest';
import {
	STAR_VEIL_CEILING,
	STAR_VEIL_FEATHER,
	STAR_VEIL_FLOOR,
	STAR_VEIL_GLSL,
	STAR_VEIL_INSET,
	STAR_VEIL_MAX_BOXES,
	STAR_VEIL_SIDES_BELOW,
	smootherstep,
	starVeil
} from './starVeil';
import { STAR_VERTEX_SRC } from './starPass';
import { BP } from '$lib/breakpoints';

const box = { x: 100, y: 200, w: 400, h: 300 }; // inset edges below
const L = box.x + STAR_VEIL_INSET;
const R = box.x + box.w - STAR_VEIL_INSET;
const T = box.y + STAR_VEIL_INSET;
const B = box.y + box.h - STAR_VEIL_INSET;
const span = STAR_VEIL_CEILING - STAR_VEIL_FLOOR;

describe('starVeil (the TS reader)', () => {
	it('is no veil at all without boxes — the landing', () => {
		expect(starVeil(10, 10, [])).toBe(1);
	});

	it('sits at the floor inside the content', () => {
		expect(starVeil((L + R) / 2, (T + B) / 2, [box])).toBeCloseTo(STAR_VEIL_FLOOR, 12);
		expect(starVeil(L, T, [box])).toBeCloseTo(STAR_VEIL_FLOOR, 12);
	});

	it('reaches the ceiling at the feather and stays there', () => {
		expect(starVeil(R + STAR_VEIL_FEATHER, (T + B) / 2, [box])).toBeCloseTo(STAR_VEIL_CEILING, 12);
		expect(starVeil(R + 5 * STAR_VEIL_FEATHER, B + 900, [box])).toBeCloseTo(STAR_VEIL_CEILING, 12);
	});

	it('eases along the feather on a smootherstep, not a line', () => {
		const at = (f: number) => starVeil((L + R) / 2, T - f * STAR_VEIL_FEATHER, [box]);
		expect(at(0.5)).toBeCloseTo(STAR_VEIL_FLOOR + span * 0.5, 12);
		expect(at(0.25)).toBeCloseTo(STAR_VEIL_FLOOR + span * smootherstep(0.25), 12);
		expect(smootherstep(0.25)).toBeCloseTo(0.103515625, 12); // 6t⁵ − 15t⁴ + 10t³
		expect(at(0.25)).toBeLessThan(STAR_VEIL_FLOOR + span * 0.25);
	});

	it('measures corners by true distance', () => {
		const d = STAR_VEIL_FEATHER * 0.4;
		const corner = starVeil(R + d / Math.SQRT2, B + d / Math.SQRT2, [box]);
		expect(corner).toBeCloseTo(STAR_VEIL_FLOOR + span * smootherstep(0.4), 9);
	});

	it('takes the NEAREST content when there are several boxes', () => {
		const aside = { x: R + 16, y: box.y, w: 262, h: box.h };
		const p = { x: R + 8, y: (T + B) / 2 }; // in the gap between them
		const both = starVeil(p.x, p.y, [box, aside]);
		expect(both).toBeCloseTo(Math.min(starVeil(p.x, p.y, [box]), starVeil(p.x, p.y, [aside])), 12);
	});

	it('keeps the sides at the floor under the phone rule', () => {
		const side = { x: R + STAR_VEIL_FEATHER, y: (T + B) / 2 };
		expect(starVeil(side.x, side.y, [box], { sides: false })).toBeCloseTo(STAR_VEIL_FLOOR, 12);
		expect(starVeil(side.x, side.y, [box], { sides: true })).toBeCloseTo(STAR_VEIL_CEILING, 12);
		// …while top and bottom still feather.
		const above = starVeil(side.x, T - STAR_VEIL_FEATHER / 2, [box], { sides: false });
		expect(above).toBeCloseTo(STAR_VEIL_FLOOR + span * 0.5, 12);
	});

	it('names a real breakpoint for the phone rule', () => {
		expect(BP[STAR_VEIL_SIDES_BELOW]).toBeTruthy();
	});
});

describe('the GLSL reader is fed the same formula', () => {
	const glslConst = (name: string) => {
		const m = new RegExp(`const float ${name} = ([0-9.eE+-]+);`).exec(STAR_VEIL_GLSL);
		if (!m) throw new Error(`${name} not declared in STAR_VEIL_GLSL`);
		return Number(m[1]);
	};

	it('declares every knob with the TS value', () => {
		expect(glslConst('STAR_VEIL_FLOOR')).toBe(STAR_VEIL_FLOOR);
		expect(glslConst('STAR_VEIL_CEILING')).toBe(STAR_VEIL_CEILING);
		expect(glslConst('STAR_VEIL_FEATHER')).toBe(STAR_VEIL_FEATHER);
		expect(glslConst('STAR_VEIL_INSET')).toBe(STAR_VEIL_INSET);
	});

	it('uses the same smootherstep and the same ramp', () => {
		expect(STAR_VEIL_GLSL).toContain('u * u * u * (u * (u * 6.0 - 15.0) + 10.0)');
		expect(STAR_VEIL_GLSL).toContain('STAR_VEIL_FLOOR + (STAR_VEIL_CEILING - STAR_VEIL_FLOOR) * t');
		expect(STAR_VEIL_GLSL).toContain('max(max(lo - p, p - hi), 0.0) * axes');
	});

	it('is the chunk the live star pass compiles, sized for its uniform arrays', () => {
		expect(STAR_VERTEX_SRC).toContain(STAR_VEIL_GLSL);
		expect(STAR_VERTEX_SRC).toContain(`uniform vec4 u_veilA[${STAR_VEIL_MAX_BOXES}];`);
		expect(STAR_VERTEX_SRC).toContain(`uniform vec4 u_veilB[${STAR_VEIL_MAX_BOXES}];`);
	});

	it('applies the veil to the star ALPHA in the vertex pass (before the dim)', () => {
		expect(STAR_VERTEX_SRC).toMatch(
			/alpha \*= mix\(1\.0, mix\(va, vb, u_veilMix\.x\), u_veilMix\.y\)/
		);
	});
});
