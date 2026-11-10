/**
 * ⚓ A HELD CHARGED ATTACK WITH A HEAT GAUGE (`ChargeHold`, Sandrone's Fagio,
 * 2026-11-10; gcsim `sandrone/charge.go`). Pure: the parser hands it a press
 * and places what comes back. Every number was read off gcsim's own logs, and
 * `chargeHold.test.ts` holds those logs.
 *
 * Heat is gcsim's Decoding Power, stored ×10 as gcsim stores it.
 */
import type { ChargeHold } from '$lib/types/ability';

export type HeatState = {
	value: number;
	/** Power Overdrive, entered at the cap and left under `exitBelow`. */
	overheated: boolean;
	/** When the cooling ticker last ran or was armed; `null` while it is off. */
	coolFrom: number | null;
	/** When a value at the cap turns into Power Overdrive. */
	maxAt: number | null;
};

export const createHeat = (): HeatState => ({
	value: 0,
	overheated: false,
	coolFrom: null,
	maxAt: null
});

export type HoldPlan = {
	sweeps: number[];
	beams: number[];
	/** Power Overdrive's shots, at their landing frames. */
	overdrive: number[];
	/** The frame the hold ends. */
	exit: number;
	/** A bare `C`: gcsim stops the moment it ends, with no end lag. */
	bare: boolean;
};

function reduce(s: HeatState, h: ChargeHold, amount: number): void {
	if (s.value <= 0) return;
	s.value -= amount;
	if (s.value < h.heat.exitBelow) s.overheated = false;
	if (s.value < 0) s.value = 0;
}

/** Heat as it stands at `now`: the cooling ticks and a pending overheat. */
export function advanceHeat(
	s: HeatState,
	h: ChargeHold,
	now: number,
	onField: (frame: number) => boolean
): void {
	for (;;) {
		const tick = s.coolFrom === null || s.value <= 0 ? Infinity : s.coolFrom + h.heat.coolEvery;
		const next = Math.min(tick, s.maxAt ?? Infinity);
		if (next === Infinity || next > now) return;
		if (s.maxAt === next) {
			if (s.value >= h.heat.max) s.overheated = true;
			s.maxAt = null;
		}
		if (tick === next) {
			reduce(s, h, onField(tick) ? h.heat.cool : h.heat.cool * h.heat.offFieldMultiplier);
			s.coolFrom = tick;
		}
	}
}

/** The Skill vents heat at once, and more for as long as the cast lasts. */
export function ventHeat(
	s: HeatState,
	h: ChargeHold,
	castAt: number,
	castFrames: number,
	onField: (frame: number) => boolean
): void {
	advanceHeat(s, h, castAt, onField);
	reduce(s, h, h.heat.skillVent.atCast);
	for (let i = 1; i <= h.heat.skillVent.ticks; i++) {
		const at = i * h.heat.skillVent.every;
		if (at >= castFrames) break;
		advanceHeat(s, h, castAt + at, onField);
		reduce(s, h, h.heat.skillVent.amount);
	}
}

function gain(s: HeatState, h: ChargeHold, amount: number, divisor: number, at: number): void {
	s.value += Math.trunc(amount / divisor);
	if (s.value < h.heat.max) return;
	s.value = h.heat.max;
	s.maxAt ??= at + h.heat.overheatDelay;
}

/** One press of Charged Attack. `hold` is a `~Xs`'s frames, `null` for a bare `C`. */
export function planHold(
	s: HeatState,
	h: ChargeHold,
	press: {
		at: number;
		/** The windup rolled into the action before. */
		rolled: boolean;
		hold: number | null;
		constellation: number;
		onField: (frame: number) => boolean;
	}
): HoldPlan {
	const { at, rolled, constellation, onField } = press;
	const windup = rolled ? 0 : h.windup;
	const boosted = constellation >= h.heat.boost.level;
	const divisor = boosted ? h.heat.boost.gainDivisor : 1;
	const beamCap = boosted ? h.heat.boost.beams : h.beams;
	advanceHeat(s, h, at, onField);

	const start = at + windup + h.firstTick;
	const sweeps: number[] = [];
	const beams: number[] = [];
	const overdrive: number[] = [];

	if (s.overheated) {
		const hold = press.hold ?? 0;
		const src = at + windup + h.overdrive.firstTick;
		for (let f = src; f <= src + hold; f += h.overdrive.every) {
			overdrive.push(f + h.overdrive.travel);
		}
		const exit = start + hold;
		s.coolFrom = exit + 1;
		return { sweeps, beams, overdrive, exit, bare: false };
	}

	// The most beams that fit under the cap, from the heat at the press.
	let fit = 0;
	for (let b = 1; b <= beamCap; b++) {
		if (s.value <= h.heat.max - Math.trunc(h.heat.beamsNeed[b] / divisor)) fit = b;
	}
	const bare = press.hold === null && fit > 0;
	const hold = press.hold ?? (bare ? Infinity : 0);
	const limit = start + hold;
	let beamsLeft = bare ? fit : Infinity;

	advanceHeat(s, h, start, onField);
	s.coolFrom = null;

	let decoding = true;
	let nextSweep = start;
	let sweepIndex = 0;
	let nextBeam = start + h.beamFirst;
	let nextGain = start;
	let nextShot = Infinity;
	let exit: number | null = null;

	for (let f = start; f <= limit; f++) {
		if (decoding && f === nextSweep) {
			sweeps.push(f);
			nextSweep += h.sweepGaps[sweepIndex];
			sweepIndex = (sweepIndex + 1) % h.sweepGaps.length;
		}
		if (decoding && f === nextBeam) {
			beams.push(f);
			gain(s, h, h.heat.perBeam, divisor, f);
			nextBeam += h.beamEvery;
			if (--beamsLeft <= 0) exit = f;
		}
		if (decoding && f === nextGain) {
			gain(s, h, h.heat.perTick, divisor, f);
			nextGain += h.heat.tickEvery;
		}
		if (s.maxAt === f) {
			s.maxAt = null;
			if (s.value >= h.heat.max) {
				s.overheated = true;
				if (decoding) {
					decoding = false;
					if (bare) exit = f;
					else nextShot = f + h.overdrive.firstTick;
				}
			}
		}
		if (f === nextShot) {
			overdrive.push(f + h.overdrive.travel);
			nextShot += h.overdrive.every;
		}
		if (exit !== null) break;
	}
	const end = exit ?? limit;
	s.coolFrom = end + 1;
	return { sweeps, beams, overdrive, exit: end, bare };
}
