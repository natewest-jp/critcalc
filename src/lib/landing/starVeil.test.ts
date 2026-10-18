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

const view = { w: 1000, h: 800 };
const box = { x: 100, y: 200, w: 400, h: 300 }; // inset edges below
const L = box.x + STAR_VEIL_INSET;
const R = box.x + box.w - STAR_VEIL_INSET;
const T = box.y + STAR_VEIL_INSET;
const B = box.y + box.h - STAR_VEIL_INSET;
const span = STAR_VEIL_CEILING - STAR_VEIL_FLOOR;
const opts = { sides: true, view };
const veil = (x: number, y: number, o = opts) => starVeil(x, y, [box], o);
const midY = (T + B) / 2;
const midX = (L + R) / 2;

describe('starVeil (the TS reader)', () => {
	it('is no veil at all without boxes — the landing', () => {
		expect(starVeil(10, 10, [], opts)).toBe(1);
	});

	it('sits at the floor inside the content, less the inset', () => {
		expect(veil(midX, midY)).toBeCloseTo(STAR_VEIL_FLOOR, 12);
		expect(veil(L, T)).toBeCloseTo(STAR_VEIL_FLOOR, 12);
		// The inset band just inside the box's edge is already rising.
		expect(veil(box.x + 1, midY)).toBeGreaterThan(STAR_VEIL_FLOOR);
	});

	it('reaches the ceiling at the view edge on EVERY side, however wide the margin', () => {
		expect(veil(0, midY)).toBeCloseTo(STAR_VEIL_CEILING, 12); // left margin: 140
		expect(veil(view.w, midY)).toBeCloseTo(STAR_VEIL_CEILING, 12); // right: 540
		expect(veil(midX, 0)).toBeCloseTo(STAR_VEIL_CEILING, 12); // top: 240
		expect(veil(midX, view.h)).toBeCloseTo(STAR_VEIL_CEILING, 12); // bottom: 340
	});

	it('normalises the ramp per side: half the margin is the midpoint on each', () => {
		const mid = STAR_VEIL_FLOOR + span * 0.5;
		expect(veil(L / 2, midY)).toBeCloseTo(mid, 12);
		expect(veil(R + (view.w - R) / 2, midY)).toBeCloseTo(mid, 12);
		expect(veil(midX, T / 2)).toBeCloseTo(mid, 12);
		expect(veil(midX, B + (view.h - B) / 2)).toBeCloseTo(mid, 12);
	});

	it('eases on a smootherstep, not a line', () => {
		const at = veil(midX, T * 0.75); // a quarter of the way out
		expect(at).toBeCloseTo(STAR_VEIL_FLOOR + span * smootherstep(0.25), 12);
		expect(smootherstep(0.25)).toBeCloseTo(0.103515625, 12); // 6t⁵ − 15t⁴ + 10t³
	});

	it('rounds a corner by combining its two sides as a length', () => {
		const f = 0.4 / Math.SQRT2;
		const corner = veil(R + f * (view.w - R), B + f * (view.h - B));
		expect(corner).toBeCloseTo(STAR_VEIL_FLOOR + span * smootherstep(0.4), 9);
	});

	it('takes the NEAREST content when there are several boxes', () => {
		const aside = { x: R + 16, y: box.y, w: 262, h: box.h };
		const p = { x: R + 8, y: midY }; // in the gap between them
		const both = starVeil(p.x, p.y, [box, aside], opts);
		expect(both).toBeCloseTo(
			Math.min(starVeil(p.x, p.y, [box], opts), starVeil(p.x, p.y, [aside], opts)),
			12
		);
	});

	it('keeps the sides at the floor under the phone rule', () => {
		const phone = { sides: false, view };
		expect(veil(view.w, midY, phone)).toBeCloseTo(STAR_VEIL_FLOOR, 12);
		expect(veil(view.w, midY)).toBeCloseTo(STAR_VEIL_CEILING, 12);
		// …while top and bottom still feather.
		expect(veil(view.w, T / 2, phone)).toBeCloseTo(STAR_VEIL_FLOOR + span * 0.5, 12);
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
		expect(STAR_VEIL_GLSL).toContain('max(lo - p, 0.0) / (max(lo, 1.0) * STAR_VEIL_FEATHER)');
		expect(STAR_VEIL_GLSL).toContain(
			'max(p - hi, 0.0) / (max(view - hi, 1.0) * STAR_VEIL_FEATHER)'
		);
		expect(STAR_VEIL_GLSL).toContain('length((below + above) * axes)');
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
