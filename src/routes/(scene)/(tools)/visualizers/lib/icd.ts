// Elemental-application internal cooldown (ICD) simulation.
//
// KQM (combat-mechanics/internal-cooldown): standard ICD is a 2.5s timer AND a
// 3-hit counter running concurrently. The rules are asymmetric:
//   - the first hit applies its element (timer starts, count = 1)
//   - a hit applies when the timer has expired — this resets BOTH timer & count
//   - a hit also applies every `hits`-th hit by counter — this resets the count
//     but does NOT reset the timer
// Under fast standard-ICD attacks, applications land on hits 1, 4, 7, …

export type IcdParams = {
	/** Timer length in seconds (0 = every hit applies) */
	timer: number;
	/** Counter length: every `hits`-th hit applies (1 = every hit applies) */
	hits: number;
};

export const STANDARD_ICD: IcdParams = { timer: 2.5, hits: 3 };

export type IcdHit = {
	time: number;
	applies: boolean;
	/** Applied because the timer expired (also true for the first hit) */
	viaTimer: boolean;
	/** Hit-counter value after this hit (1 … hits) */
	count: number;
};

// Float-noise guard for interval multiples landing exactly on the timer edge
const EPS = 1e-9;

export function simulateIcd(hitTimes: number[], { timer, hits }: IcdParams): IcdHit[] {
	let timerStart = -Infinity;
	let count = 0;

	return hitTimes.map((time) => {
		if (time - timerStart >= timer - EPS) {
			timerStart = time;
			count = 1;
			return { time, applies: true, viaTimer: true, count };
		}

		count += 1;
		if (count > hits) {
			count = 1;
			return { time, applies: true, viaTimer: false, count };
		}

		return { time, applies: false, viaTimer: false, count };
	});
}

/** Hit timestamps for a uniform attack string: 0, interval, 2·interval, … */
export const uniformHitTimes = (count: number, interval: number) =>
	Array.from({ length: Math.max(0, Math.round(count)) }, (_, i) => i * interval);
