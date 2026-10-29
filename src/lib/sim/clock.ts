/**
 * src/lib/sim/clock.ts
 *
 * The rotation sim's frame clock and task queue (gauge-round.md §L3, contract
 * C6). Everything the parse defers — a window expiring, a summon ticking, a hit
 * landing, the actor taking its next input — is a TASK on this queue, and the
 * clock is the only thing that moves time.
 *
 * ⚓⚓ THE CLOCK JUMPS. IT DOES NOT WALK FRAMES.
 *
 * `advance()` hops straight to the next scheduled instant; there is no
 * `for (f = 0; f <= end; f++)` anywhere, and so there is no frame-loop cap to
 * pick. This is not an optimisation, it is a correctness requirement measured
 * on real input: `MAX_TIME_ADVANCE_F` bounds ONE `~Xs` token, and a document
 * full of waits SUMS. 14 KB of legal notation — 2,000 × `~3600s` — parses in
 * 4.3 ms today and reaches **432,000,000 frames** of simulated time. A per-frame
 * loop over that is 4+ seconds of frozen tab at an optimistic 10 ns/iteration,
 * which is exactly the hang class docs/rounds/parser-hardening-2026-08-14.md closed.
 *
 * ⚠️ The rule survives the gauge (L5). Continuous decay is bounded by AURA
 * LIFETIME (`2.5·U + 7` s), not by rotation length, so a long idle advances the
 * clock ONCE and the gauge catches up over the span it can still be alive.
 * ⛔ Never hand a continuous model a 2,000-hour span and let it step to the end.
 *
 * ⚠️ Work here is proportional to SCHEDULED INSTANTS, never to elapsed time.
 * A task whose only job is "check back later" is therefore not free — it is the
 * one way to reintroduce the cost this design exists to avoid.
 */

/**
 * Same-frame execution order. Lower fires first; within one band, insertion
 * order (FIFO).
 *
 * ⚠️ The order is the contract, not a convenience — each band must be able to
 * assume the ones above it have already run at this frame:
 *
 *   EXPIRE  a thing that ends at F has ended before anything at F reads it
 *   TICK    consequences of what is already running, before anything new starts
 *   LAND    a hit already in flight lands before the next input is taken
 *   ACT     the actor pops a token and runs the frozen cast/action pipeline
 *
 * ⏸️ TICK and LAND carry nothing at L3 and that is deliberate: they are the
 * contract L4's `application[]` and L5's gauge are written against. They are
 * pinned by clock.test.ts rather than merely declared, so an empty band is a
 * tested promise instead of a speculative abstraction.
 */
export const Band = {
	EXPIRE: 0,
	TICK: 10,
	LAND: 20,
	ACT: 30
} as const;
export type Band = (typeof Band)[keyof typeof Band];

export type Task = () => void;

type Entry = {
	frame: number;
	band: Band;
	/** Monotonic insertion counter — the FIFO tiebreak within (frame, band). */
	seq: number;
	run: Task;
};

export type Clock = {
	/** Current frame. Advances only through `advance` / `runDueTasks`. */
	readonly now: number;
	/**
	 * Queue a task at an absolute frame.
	 *
	 * ⚠️ Scheduling into the PAST is a caller bug, not something to silently
	 * round forward: a task that was meant to fire at a frame the clock has
	 * already left has lost its ordering guarantee, and quietly running it now
	 * would put it after things it was supposed to precede. Clamped to `now`
	 * and reported via `latecomers` so a differ run can see it happened.
	 */
	schedule(frame: number, band: Band, run: Task): void;
	/** Frame of the earliest queued task, or `null` when the queue is empty. */
	peek(): number | null;
	/**
	 * Move to `frame` and run every task due at or before it, in
	 * (frame, band, insertion) order. Tasks may schedule further tasks; ones
	 * landing at or before `frame` run in this same call, after the tasks
	 * already queued at their (frame, band).
	 *
	 * ⛔ Never moves time backwards: `advance(f)` with `f < now` is a no-op on
	 * `now` and still drains anything due.
	 */
	advance(frame: number): void;
	/** Advance to the earliest queued task and run it (plus its same-instant
	 *  siblings). Returns the frame reached, or `null` if the queue was empty. */
	step(): number | null;
	/** Drain the whole queue, including tasks scheduled by drained tasks. */
	drain(): void;
	/** Tasks that were scheduled into the past and got clamped to `now`. */
	readonly latecomers: number;
};

/** Ordering: earliest frame, then band, then insertion. A total order — which
 *  is what makes the sim deterministic for a given notation. */
const before = (a: Entry, b: Entry): boolean =>
	a.frame !== b.frame ? a.frame < b.frame : a.band !== b.band ? a.band < b.band : a.seq < b.seq;

/**
 * Binary min-heap over `before`.
 *
 * ⚠️ A sorted array with `splice`-insert is O(n) per schedule and looks fine at
 * a few hundred tasks; L5 puts a summon tick on this queue every few frames for
 * every summon in the rotation, so the shape has to hold at tens of thousands.
 * The heap is ~40 lines and removes the question.
 */
class Heap {
	private a: Entry[] = [];

	get size(): number {
		return this.a.length;
	}

	peek(): Entry | undefined {
		return this.a[0];
	}

	push(e: Entry): void {
		const a = this.a;
		a.push(e);
		let i = a.length - 1;
		while (i > 0) {
			const p = (i - 1) >> 1;
			if (!before(a[i], a[p])) break;
			[a[i], a[p]] = [a[p], a[i]];
			i = p;
		}
	}

	pop(): Entry | undefined {
		const a = this.a;
		if (a.length === 0) return undefined;
		const top = a[0];
		const last = a.pop()!;
		if (a.length > 0) {
			a[0] = last;
			let i = 0;
			for (;;) {
				const l = 2 * i + 1;
				const r = l + 1;
				let m = i;
				if (l < a.length && before(a[l], a[m])) m = l;
				if (r < a.length && before(a[r], a[m])) m = r;
				if (m === i) break;
				[a[i], a[m]] = [a[m], a[i]];
				i = m;
			}
		}
		return top;
	}
}

export function createClock(startFrame = 0): Clock {
	const heap = new Heap();
	let now = startFrame;
	let seq = 0;
	let latecomers = 0;

	const runDueThrough = (frame: number): void => {
		for (;;) {
			const top = heap.peek();
			if (!top || top.frame > frame) break;
			heap.pop();
			// `now` tracks the task being run, so a task that schedules relative
			// to "now" gets its own instant rather than the advance target.
			if (top.frame > now) now = top.frame;
			top.run();
		}
	};

	return {
		get now() {
			return now;
		},
		get latecomers() {
			return latecomers;
		},
		schedule(frame, band, run) {
			let at = frame;
			if (at < now) {
				latecomers++;
				at = now;
			}
			heap.push({ frame: at, band, seq: seq++, run });
		},
		peek() {
			return heap.peek()?.frame ?? null;
		},
		advance(frame) {
			runDueThrough(frame);
			if (frame > now) now = frame;
		},
		step() {
			const next = heap.peek()?.frame ?? null;
			if (next === null) return null;
			runDueThrough(next);
			if (next > now) now = next;
			return next;
		},
		drain() {
			for (;;) {
				const next = heap.peek()?.frame ?? null;
				if (next === null) break;
				runDueThrough(next);
				if (next > now) now = next;
			}
		}
	};
}
