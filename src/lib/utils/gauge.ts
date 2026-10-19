// Elemental gauge simulation — aura application, decay, and reaction consumption.
//
// Sources: KQM TCL Elemental Gauge Theory (docs/library/game/elemental-reactions.md, Sections
// 1/3/4) cross-referenced against gcsim pkg/reactable (the implementable ground
// truth where the TCL is narrative). Key rules encoded here:
//   - Aura tax: applications that become an aura are multiplied by 0.8
//   - Decay: a fresh aura decays linearly over (2.5 × applied gauge + 7) seconds;
//     re-applying the same element tops the gauge up to max(current, new) but
//     KEEPS the original decay rate — except Pyro, which since 3.0 re-derives its
//     decay rate whenever the application is at least as strong as what remains
//   - Reaction unit modifiers: ×2 forward vape/melt, ×0.5 reverse, ×1 overload/
//     superconduct/quicken, ×0.5 swirl/crystallize, 2:1 hydro:dendro for bloom
//   - Trigger gauge flows down the per-element reaction priority list (gcsim
//     React()), so one hit can trigger several reactions (e.g. Pyro on
//     Electro-Charged = Overload + Vaporize)
//   - Frozen: gauge = 2 × min(aura, trigger), decays at 0.4 U/s accelerating
//     0.1 U/s² while frozen (ramping back down at 0.2 U/s² after)
//   - Electro-Charged: both auras coexist; ticks every 1s drain 0.4U from each
//   - Lunar-Charged (a team with an enabler — `GaugeOptions.lunarCharged`):
//     the same coexistence and 0.4U, but from a thundercloud that lives 5.5s
//     past the last trigger and drains at most once per 2s (see startLC)
//   - Lunar-Crystallize (`GaugeOptions.lunarCrystallize`): Geo on Hydro
//     consumes ×0.5 like Crystallize but ignores — and never sets — the 1s
//     cooldown, so it can land beside a Crystallize on another aura
//   - Burning: a fixed 2U non-decaying Burning aura + a fuel gauge draining at
//     0.4 U/s; DAMAGE ticks every 0.25s, but re-applies Pyro only every ~2s
//     (the Burning ICD group — see BURNING_ICD below)
//
// The sim is frame-stepped at 60fps to mirror gcsim's Tick() exactly.
//
// ⚓ ONE MODEL, THREE SHAPES (gauge round L1, 2026-08-16). This module moved
// here from the Visualizers' lib to sit beside `icd.ts`, which made the same
// journey: `icd.ts` decides WHETHER a hit applies its element, `gauge.ts`
// decides WHAT HAPPENS when it does. Both now serve the instruments and the
// rotation planner from one implementation, so the two can never drift.
//
// ⚓⚓ AND THE MODULE ITSELF HAS TWO SHAPES (gauge round L5a, 2026-08-16), the
// same pair `icd.ts` already carries:
//
//   createGauge()    a LIVE gauge — the rotation sim learns its applications one
//                    at a time, from a clock that JUMPS between scheduled
//                    instants and never walks frames
//   simulateGauge()  the BATCH — hand it every application at once, get series +
//                    events, which is what an instrument wants
//
// ⚓ The batch is WRITTEN IN TERMS OF THE STREAM (`simulateGauge` is a loop over
// `createGauge`), so a second implementation cannot appear and the two cannot
// disagree. ⛔ Never add a rule to one of them.
//
// ⚠️⚠️ THIS MODULE MUST BE FED POST-ICD APPLICATIONS. It applies every gauge it
// is handed. gcsim applies ICD at the TARGET (`pkg/enemy/attack.go:114` scales
// durability by `WillApplyEle` before `React()`), so an authored unit value is
// the NOMINAL cap, not the applied rate. Pipe raw swings in and every aura
// comes out several times too strong.

import { createIcdClock, icdApplies, type IcdClock, type IcdParams } from '$lib/utils/icd';
import type { Element } from '$lib/types/ability';

/**
 * The seven elements that can be applied. ⚓ Derived from the canonical
 * `Element` rather than restated, so the two cannot drift: the only difference
 * is `physical`, which by definition applies nothing.
 */
export type ElementId = Exclude<Element, 'physical'>;

export type AuraKey =
	| 'pyro'
	| 'hydro'
	| 'electro'
	| 'cryo'
	| 'dendro'
	| 'frozen'
	| 'quicken'
	| 'burning'
	| 'burningFuel';

export type Application = {
	time: number;
	element: ElementId;
	/** Applied gauge in units, pre-tax (1 / 1.5 / 2 / 4) */
	gauge: number;
};

export type ReactionKind =
	| 'vaporize'
	| 'reverseVaporize'
	| 'melt'
	| 'reverseMelt'
	| 'overload'
	| 'superconduct'
	| 'electroCharged'
	| 'freeze'
	| 'swirl'
	| 'crystallize'
	| 'crystallizeBlocked'
	| 'quicken'
	| 'aggravate'
	| 'spread'
	| 'bloom'
	| 'quickenBloom'
	| 'burning'
	| 'hyperbloom'
	| 'burgeon';

export type AttachMode =
	/** Fresh aura: taxed gauge, decay rate derived from the applied gauge */
	| 'new'
	/** Same element re-applied: gauge tops up to max, original decay rate kept */
	| 'topUp'
	/** Pyro only: application ≥ remaining aura also re-derives the decay rate */
	| 'pyroRefresh'
	/** Pyro only: application weaker than the remaining aura does nothing */
	| 'tooWeak'
	/** Nothing attached (trigger reacted away, or Anemo/Geo) */
	| 'none';

export type Consumed = { mod: AuraKey; amount: number };

export type SimEvent =
	| {
			kind: 'apply';
			time: number;
			appIndex: number;
			element: ElementId;
			gauge: number;
			attach: AttachMode;
			/** Gauge of the element's aura right after this application */
			auraAfter: number;
	  }
	| {
			kind: 'reaction';
			time: number;
			/**
			 * Index into the (time-sorted) application list; null for an internal
			 * trigger.
			 *
			 * ⚓ A null here is UNREACHABLE TODAY, and a consumer that needs to
			 * attribute a reaction to a character (the rotation planner dispatches
			 * `onReaction` effects by holder) may rely on that — but should say so
			 * rather than assume it. The only internal applicator is the Burning
			 * chain's Pyro, and nothing that REACTS with Pyro can coexist with a
			 * Burning aura: Hydro, Cryo and Electro each react on contact and so
			 * never attach while it is up. ⛔ Do not thread a "who ignited this"
			 * token through the chain for it — that was tried in L5a and is a field
			 * with no reachable case.
			 */
			appIndex: number | null;
			reaction: ReactionKind;
			trigger: ElementId;
			/** Which aura the reaction acted on (swirl/crystallize flavor) */
			of?: AuraKey;
			consumed: Consumed[];
			/** Trigger units spent (consumed ÷ unit modifier) */
			spent: number;
	  }
	| { kind: 'drained'; time: number; mod: AuraKey }
	| { kind: 'ecTick'; time: number; drained: number }
	| { kind: 'burningTick'; time: number }
	| { kind: 'burningEnd'; time: number; swept: AuraKey[] }
	/** A Bloom happened — the marker the Gauge Explorer has drawn since L5b.
	 *  ⚠️ This is the BLOOM's instant, not the core's: the core itself is on the
	 *  field `CORE_SPAWN_DELAY` frames later and has its own pair of events. */
	| { kind: 'core'; time: number }
	/**
	 * ⚓ A CORE IS A THING LEFT IN THE WORLD, and the gadget strip draws its
	 * LIFE (Polestar-Field round, 2026-09-01). Spawn carries the id so an end
	 * can be paired to it, and the nominal `expiry` so a consumer needs none of
	 * this module's constants to draw a core nobody touched. ⚠️ SECONDS, like
	 * every `time` in this union.
	 */
	| { kind: 'coreSpawn'; time: number; id: number; expiry: number }
	/**
	 * ⚓⚓ THE HALF THAT CANNOT BE DERIVED. A core's spawn and its nominal 6s are
	 * both computable from the Bloom, but a core EATEN by a Hyperbloom at 2s is
	 * not — and that instant is exactly what the lane exists to show. Without
	 * this event the strip would keep drawing a core the rotation already spent.
	 * `expired` needs no event: the queue is pruned lazily on read, so nothing
	 * fires, and the end is `spawn + CORE_LIFETIME` by construction.
	 */
	| { kind: 'coreEnd'; time: number; id: number; reason: 'consumed' | 'popped' };

export type SeriesPoint = { t: number; u: number };
/** One continuous lifetime of one aura; a mod re-applied later gets a new interval */
export type SeriesInterval = { key: AuraKey; points: SeriesPoint[] };

export type GaugeSim = {
	series: SeriesInterval[];
	events: SimEvent[];
	/** Time of the last sample (all gauges empty) */
	duration: number;
	/** ⚠️ The run hit `maxSeconds` with gauge still alive — the tail is MISSING,
	 *  not empty. Silent truncation is how a caller trusts a wrong answer. */
	truncated: boolean;
	/** Applications discarded for falling past `maxSeconds`. */
	droppedApplications: number;
};

export const AURA_TAX = 0.8;
export const GAUGE_OPTIONS = [1, 1.5, 2, 4] as const;

/** Untended aura lifetime in seconds for an applied (pre-tax) gauge */
export const auraDuration = (gauge: number) => 2.5 * gauge + 7;
/** Natural decay rate in U/s for a fresh aura from an applied (pre-tax) gauge */
export const auraDecayRate = (gauge: number) => (AURA_TAX * gauge) / auraDuration(gauge);

const FPS = 60;
const EPS = 1e-6;

/** Default simulation cap. ⚠️ Overridable per call — a 75 s ceiling suits the
 *  instrument's hand-placed applications but silently truncates a real
 *  rotation, and silent truncation is how a caller comes to trust a wrong
 *  answer. `simulateGauge` reports what it dropped. */
export const DEFAULT_MAX_SECONDS = 75;

// Frozen decay: base 0.4 U/s, +0.1 U/s² while frozen, −0.2 U/s² back down after
const FRZ_BASE_RATE = 0.4;
const FRZ_RAMP_UP = 0.1 / FPS;
const FRZ_RAMP_DOWN = 0.2 / FPS;
// Burning: fixed aura gauge; fuel drain floor (the formula rate mult·g/(2.5g+7)
// stays below 0.4 U/s for every real gauge, so the floor always governs)
const BURNING_GAUGE = 2;
const FUEL_RATE = 0.4;
const EC_DRAIN = 0.4;
/** Burning DAMAGE cadence — every 15 frames. ⚠️ NOT the application cadence. */
const BURNING_TICK_FRAMES = 15;

/**
 * ⚓ The Burning ICD group: a 2.0 s reset timer over an `1,0,0,0,0,0,0,0`
 * eight-tick sequence (`docs/library/game/icd.md`, and gcsim's
 * `ICDGroupBurning`). At the 0.25 s tick cadence that is one Pyro application
 * roughly every 2 s.
 *
 * 🐛 **This module used to re-apply 1U Pyro on EVERY 0.25 s tick — eight times
 * too often**, and because each phantom application ran the full `applyElement`
 * chain, a burning target carrying Electro overloaded ~4×/s. The bug was
 * conflating the DAMAGE cadence with the APPLICATION cadence; they are
 * different mechanics that happen to share a tick.
 *
 * Confirmed against KQM independently of gcsim — `elemental-reactions.md` §3.9
 * says Burning "[t]icks every 0.25 s and applies 1U Pyro … then once every
 * 2 s" — and measured through the L0 oracle at 128–135 frames between real
 * applications. ⚠️ We model the ICD rule (a flat ~2.0 s); gcsim's observed
 * gaps drift a little wider because its tick chain restarts on fuel refresh.
 * A residual ~10% is the accepted cost of not modelling the chain restart.
 */
const BURNING_ICD: IcdParams = { timer: 2.0, hits: 8 };

// ── Dendro cores (gauge round L5b) ───────────────────────────────────────────
//
// ⚓ A core is A THING LEFT IN THE WORLD, not an aura, which is why it was absent
// until now: L1 recorded "no dendro core gadgets, so no hyperbloom/burgeon" as a
// knowing gap, and the coarse model the planner used carried a bare counter with
// no lifetime instead. Modelling it here is what lets the gauge replace that
// counter without deleting two reactions four characters author against.
//
// ⛔ What we do NOT model, deliberately: core damage, the bloom explosion, the
// hyperbloom projectile seeking a target, AoE reaching several cores at once.
// The question this module answers is "does this reaction happen, and when".

/** Frames between a Bloom and its core actually being on the field
 *  (gcsim `dendrocore.Delay`). An Electro hit inside this gap hyperblooms
 *  nothing, which is why it is worth carrying. */
const CORE_SPAWN_DELAY = 30;
/**
 * A core's lifetime once spawned.
 *
 * ⚠️ THE TWO SOURCES DISAGREE AND KQM WINS HERE. gcsim sets `Duration = 300 // ??`
 * — its own author marking the number uncertain — while
 * `docs/library/game/elemental-reactions.md` states a core "explodes after 6 s".
 * The round's rule is that gcsim is an implementation-level second source rather
 * than the game, so a value it flags as a guess loses to one KQM states outright.
 * ⚠️ Expect a small residual against the oracle: an Electro hit between 5 s and
 * 6 s after a Bloom hyperblooms for us and not for gcsim.
 */
const CORE_LIFETIME = 360;
/** Cores on the field at once; a sixth Bloom pops the oldest (KQM). */
const MAX_CORES = 5;

/** Mods reduced when a reaction consumes an element ("Burning counts as Pyro") */
const MODS_OF: Record<string, AuraKey[]> = {
	pyro: ['pyro', 'burning'],
	hydro: ['hydro'],
	electro: ['electro'],
	cryo: ['cryo'],
	dendro: ['dendro', 'burningFuel'],
	frozen: ['frozen'],
	quicken: ['quicken']
};

const ALL_MODS: AuraKey[] = [
	'pyro',
	'hydro',
	'electro',
	'cryo',
	'dendro',
	'frozen',
	'quicken',
	'burning',
	'burningFuel'
];

type ModState = Record<AuraKey, number>;

type Sim = {
	/** The frame the gauge is AT — the next one to be processed. */
	frame: number;
	/** ⚠️ `Infinity` for the live gauge: a cap is a batch concern (an instrument
	 *  charting hand-placed applications), and a rotation must never be silently
	 *  truncated mid-parse. */
	maxFrames: number;
	/** Series sampling. On for the batch and, since L6, for the rotation sim's
	 *  live gauge as well — the aura lane needs the trajectory. */
	sampling: boolean;
	/** An application landed at `frame` — the batch's "sample once before the
	 *  group, once after" grouping, preserved across the streaming split. */
	appliedThisFrame: boolean;
	u: ModState;
	rate: ModState;
	ecActive: boolean;
	burningActive: boolean;
	/**
	 * 🐛 GENERATION STAMPS, not booleans. A scheduled tick fires later and must
	 * be able to tell "am I still the live chain?" — if EC (or Burning) lapses
	 * and re-forms before a pending task runs, a boolean says yes to BOTH
	 * chains and they drain independently, doubling the rate and compounding
	 * with each re-lapse. gcsim stamps for exactly this reason
	 * (`ecTickSrc` / `burningTickSrc`).
	 */
	ecGen: number;
	burningGen: number;
	/** Burning's Pyro re-application counter (see BURNING_ICD). */
	burningIcd: IcdClock;
	crysGcdUntil: number;
	/** The team converts these reactions (`GaugeOptions`). Both false for the
	 *  Gauge Explorer, which models neither. */
	lunarCharged: boolean;
	lunarCrystallize: boolean;
	/** The thundercloud's end frame — 5.5s past the last Lunar-Charged trigger. */
	lcCloudUntil: number;
	/** The enemy's 2s gap between Lunar-Charged hits. ⚠️ The ENEMY's, so it
	 *  outlives a cloud and holds into the next one (gcsim `lcIcdKey`). */
	lcIcdUntil: number;
	/** Generation stamp for the cloud's scan chain, as `ecGen`. */
	lcGen: number;
	/** Live dendro cores, as expiry frames in spawn order. ⚠️ Pruned lazily on
	 *  read rather than by a scheduled task — a core that nobody triggers has no
	 *  consequence to fire, and a task whose only job is to check back later is
	 *  precisely the cost the jumping clock exists to avoid. */
	cores: { id: number; expiry: number }[];
	/** Next core id. Cores are a QUEUE of expiries and consumption shifts the
	 *  oldest, so a spawn and its end can only be paired by an explicit id. */
	nextCoreId: number;
	/** Applications past `maxFrames`, reported rather than silently dropped. */
	dropped: number;
	tasks: Map<number, (() => void)[]>;
	events: SimEvent[];
	// series building: open interval per mod + collinear-pruning anchor
	open: Partial<Record<AuraKey, SeriesPoint[]>>;
	series: SeriesInterval[];
};

const zeroState = (): ModState => ({
	pyro: 0,
	hydro: 0,
	electro: 0,
	cryo: 0,
	dendro: 0,
	frozen: 0,
	quicken: 0,
	burning: 0,
	burningFuel: 0
});

function schedule(S: Sim, frame: number, run: () => void) {
	const list = S.tasks.get(frame);
	if (list) list.push(run);
	else S.tasks.set(frame, [run]);
}

// ── Series sampling (with on-line point pruning) ─────────────────────────────

const PRUNE_TOL = 0.003; // U of deviation before a bend gets its own point

function pushPoint(points: SeriesPoint[], t: number, u: number) {
	const n = points.length;
	if (n >= 2) {
		const a = points[n - 2];
		const b = points[n - 1];
		// deviation of b from the chord a → (t,u); drop b if it stays on-line
		const span = t - a.t;
		if (span > 0) {
			const predicted = a.u + ((b.t - a.t) / span) * (u - a.u);
			if (Math.abs(predicted - b.u) < PRUNE_TOL) {
				b.t = t;
				b.u = u;
				return;
			}
		}
	}
	points.push({ t, u });
}

function sample(S: Sim, t: number) {
	if (!S.sampling) return;
	for (const mod of ALL_MODS) {
		const val = S.u[mod];
		const open = S.open[mod];
		if (val > EPS) {
			if (!open) S.open[mod] = [{ t, u: val }];
			else pushPoint(open, t, val);
		} else if (open) {
			pushPoint(open, t, 0);
			S.series.push({ key: mod, points: open });
			S.open[mod] = undefined;
		}
	}
}

// ── Gauge plumbing (mirrors gcsim reactable) ─────────────────────────────────

/**
 * Consume up to `g × factor` units from every mod carrying `element`; returns
 * the trigger units spent (consumed ÷ factor) and what was taken from where.
 * Multiple mods of one element (Pyro + Burning) are each reduced independently
 * up to the cap; the LARGEST single reduction is what the trigger pays for.
 */
function reduce(S: Sim, element: string, g: number, factor: number) {
	const m = g * factor;
	let consumedMax = 0;
	const consumed: Consumed[] = [];
	for (const mod of MODS_OF[element]) {
		if (S.u[mod] <= EPS) continue;
		const red = Math.min(m, S.u[mod]);
		S.u[mod] -= red;
		consumed.push({ mod, amount: red });
		if (red > consumedMax) consumedMax = red;
	}
	return { consumed, spent: consumedMax / factor };
}

function attachAura(
	S: Sim,
	mod: 'pyro' | 'hydro' | 'electro' | 'cryo' | 'dendro',
	gauge: number
): AttachMode {
	const taxed = AURA_TAX * gauge;
	if (mod === 'pyro') {
		// Pyro (3.0+): weaker application is a no-op; otherwise gauge AND decay
		// rate both refresh to the new application's
		if (S.u.pyro > EPS && taxed < S.u.pyro) return 'tooWeak';
		const had = S.u.pyro > EPS;
		S.u.pyro = taxed;
		S.rate.pyro = auraDecayRate(gauge);
		return had ? 'pyroRefresh' : 'new';
	}
	if (S.u[mod] > EPS) {
		S.u[mod] = Math.max(S.u[mod], taxed);
		return 'topUp';
	}
	S.u[mod] = taxed;
	S.rate[mod] = auraDecayRate(gauge);
	return 'new';
}

function attachQuicken(S: Sim, amount: number) {
	// Strongest-wins (like Pyro): weaker re-quicken is a no-op
	if (S.u.quicken > EPS && amount < S.u.quicken) return;
	S.u.quicken = amount;
	// Quicken lives 5 × gauge + 6 seconds
	S.rate.quicken = amount / (5 * amount + 6);
}

function expireIfDrained(S: Sim, mod: AuraKey, before: number) {
	if (before > EPS && S.u[mod] <= EPS) {
		S.events.push({ kind: 'drained', time: S.frame / FPS, mod });
	}
}

// ── Electro-Charged ──────────────────────────────────────────────────────────

function startEC(S: Sim) {
	if (S.ecActive) return;
	S.ecActive = true;
	const gen = ++S.ecGen;
	schedule(S, S.frame + 10, () => ecTick(S, gen));
}

function ecTick(S: Sim, gen: number) {
	// 🐛 A stale chain must die here. Without the generation check, an EC that
	// lapsed and re-formed leaves two live chains draining 0.4U each per tick.
	if (gen !== S.ecGen) return;
	if (!S.ecActive) return;
	if (S.u.electro <= EPS || S.u.hydro <= EPS) return;
	// Gauge drain lands 0.1s after the damage tick. ⚠️ It must re-check the
	// generation too: the chain can be superseded inside that 6-frame gap, and a
	// stale drain would take 0.4U off the NEW chain's auras.
	schedule(S, S.frame + 6, () => {
		if (gen !== S.ecGen) return;
		const e0 = S.u.electro;
		const h0 = S.u.hydro;
		S.u.electro -= Math.min(EC_DRAIN, S.u.electro);
		S.u.hydro -= Math.min(EC_DRAIN, S.u.hydro);
		S.events.push({ kind: 'ecTick', time: S.frame / FPS, drained: EC_DRAIN });
		expireIfDrained(S, 'electro', e0);
		expireIfDrained(S, 'hydro', h0);
	});
	schedule(S, S.frame + 60, () => ecTick(S, gen));
}

// ── Lunar-Charged ────────────────────────────────────────────────────────────
//
// ⚓ gcsim `pkg/reactable/lunarcharged.go`, transcribed. Every trigger (Electro
// on Hydro or Hydro on Electro, Frozen absent) extends the cloud to 5.5s from
// now; a cloud that was not alive starts a fresh scan 9 frames out. The scan
// runs every 6 frames while the cloud lives, and hits when the enemy's 2s gap
// has passed AND both auras are present — each hit draining 0.4U from both, as
// an EC tick does. So against EC: half the drain rate at most, and nothing at
// all once 5.5s pass without a new trigger, even with both auras still there.

const LC_CLOUD_F = 330;
const LC_FIRST_SCAN_F = 9;
const LC_SCAN_F = 6;
const LC_ICD_F = 120;

function triggerLC(S: Sim) {
	if (S.frame >= S.lcCloudUntil) {
		const gen = ++S.lcGen;
		schedule(S, S.frame + LC_FIRST_SCAN_F, () => lcScan(S, gen));
	}
	S.lcCloudUntil = S.frame + LC_CLOUD_F;
}

function lcScan(S: Sim, gen: number) {
	if (gen !== S.lcGen || S.frame >= S.lcCloudUntil) return;
	if (S.frame >= S.lcIcdUntil && S.u.electro > EPS && S.u.hydro > EPS) {
		S.lcIcdUntil = S.frame + LC_ICD_F;
		const e0 = S.u.electro;
		const h0 = S.u.hydro;
		S.u.electro -= Math.min(EC_DRAIN, S.u.electro);
		S.u.hydro -= Math.min(EC_DRAIN, S.u.hydro);
		// The same event as an EC tick: every reader converts it through the
		// team (aura.ts), so under an enabler it already reads Lunar-Charged.
		S.events.push({ kind: 'ecTick', time: S.frame / FPS, drained: EC_DRAIN });
		expireIfDrained(S, 'electro', e0);
		expireIfDrained(S, 'hydro', h0);
	}
	schedule(S, S.frame + LC_SCAN_F, () => lcScan(S, gen));
}

/** Electro-Charged forming — or, under an enabler, Lunar-Charged triggering. */
function chargeReaction(S: Sim) {
	if (S.lunarCharged) triggerLC(S);
	else startEC(S);
}

// ── Burning ──────────────────────────────────────────────────────────────────

function startBurning(S: Sim, fuel: number) {
	S.u.burningFuel = fuel;
	S.rate.burningFuel = FUEL_RATE;
	S.u.burning = BURNING_GAUGE;
	S.rate.burning = 0;
	S.burningActive = true;
	// A fresh burn is a fresh chain AND a fresh ICD counter.
	const gen = ++S.burningGen;
	S.burningIcd = createIcdClock();
	schedule(S, S.frame + BURNING_TICK_FRAMES, () => burningTick(S, gen));
}

function burningTick(S: Sim, gen: number) {
	// 🐛 Same stale-chain hazard as EC: a re-ignition before a pending tick
	// fires would otherwise leave two chains ticking.
	if (gen !== S.burningGen) return;
	if (!S.burningActive) return;
	if (S.u.burningFuel <= EPS || S.u.burning <= EPS) return;

	// The DAMAGE tick fires every time…
	S.events.push({ kind: 'burningTick', time: S.frame / FPS });
	// …but the Pyro APPLICATION is gated by the Burning ICD group. ⚓ Reuses
	// `icd.ts` rather than restating the rule — one model, three shapes.
	if (icdApplies(S.burningIcd, S.frame / FPS, BURNING_ICD).applies) {
		applyElement(S, 'pyro', 1, null);
	}
	schedule(S, S.frame + BURNING_TICK_FRAMES, () => burningTick(S, gen));
}

// ── Dendro cores ─────────────────────────────────────────────────────────────

/** A Bloom's core, on the field `CORE_SPAWN_DELAY` frames later. */
function spawnCore(S: Sim) {
	schedule(S, S.frame + CORE_SPAWN_DELAY, () => {
		S.cores = S.cores.filter((c) => c.expiry > S.frame);
		// A sixth core pops the oldest rather than being refused.
		if (S.cores.length >= MAX_CORES) {
			const popped = S.cores.shift();
			if (popped)
				S.events.push({
					kind: 'coreEnd',
					time: S.frame / FPS,
					id: popped.id,
					reason: 'popped'
				});
		}
		const core = { id: S.nextCoreId++, expiry: S.frame + CORE_LIFETIME };
		S.cores.push(core);
		S.events.push({
			kind: 'coreSpawn',
			time: S.frame / FPS,
			id: core.id,
			expiry: core.expiry / FPS
		});
	});
}

/** Take one live core, oldest first. `false` when there is none to take. */
function consumeCore(S: Sim): boolean {
	S.cores = S.cores.filter((c) => c.expiry > S.frame);
	const core = S.cores.shift();
	if (!core) return false;
	S.events.push({ kind: 'coreEnd', time: S.frame / FPS, id: core.id, reason: 'consumed' });
	return true;
}

/** Burning aura consumed (as Pyro) while fuel remains → fuel is swept too */
function burningCheck(S: Sim) {
	if (S.u.burning <= EPS && S.u.burningFuel > EPS) {
		S.u.burningFuel = 0;
		S.rate.burningFuel = 0;
		S.burningActive = false;
		S.events.push({ kind: 'burningEnd', time: S.frame / FPS, swept: ['burningFuel'] });
	}
}

// ── Reaction resolution (gcsim React() priority per trigger element) ─────────

function applyElement(S: Sim, element: ElementId, gauge: number, appIndex: number | null) {
	const t = S.frame / FPS;
	let g = gauge;
	let reacted = false;
	let quickenBloomPending = false;

	const emit = (reaction: ReactionKind, consumed: Consumed[], spent: number, of?: AuraKey) => {
		S.events.push({
			kind: 'reaction',
			time: t,
			appIndex,
			reaction,
			trigger: element,
			of,
			consumed,
			spent
		});
	};

	// apply event pushed first so the log reads application → its reactions;
	// attach fields are patched in after the chain resolves
	let applyEvent: Extract<SimEvent, { kind: 'apply' }> | null = null;
	if (appIndex !== null) {
		applyEvent = { kind: 'apply', time: t, appIndex, element, gauge, attach: 'none', auraAfter: 0 };
		S.events.push(applyEvent);
	}

	switch (element) {
		case 'electro': {
			// ⚓ A core is a GADGET, not an aura: hitting one costs the trigger no
			// gauge and does not count as having reacted, so the same Electro hit
			// hyperblooms the core AND goes on to meet the enemy's aura. gcsim's
			// `React()` carries a bare `// hyperbloom` comment at exactly this
			// position for the reaction it resolves outside the switch.
			if (consumeCore(S)) emit('hyperbloom', [], 0);
			if (S.u.quicken > EPS && g > EPS) emit('aggravate', [], 0);
			if ((S.u.pyro > EPS || S.u.burning > EPS) && g > EPS) {
				const r = reduce(S, 'pyro', g, 1);
				g -= r.spent;
				reacted = true;
				emit('overload', r.consumed, r.spent);
				burningCheck(S);
			}
			// EC rejects while frozen persists
			if (S.u.frozen <= EPS && S.u.hydro > EPS && g > EPS) {
				if (!reacted) {
					const mode = attachAura(S, 'electro', g);
					if (applyEvent) applyEvent.attach = mode;
				}
				reacted = true;
				emit('electroCharged', [], 0);
				chargeReaction(S);
			}
			if (S.u.frozen > EPS && g > EPS) {
				// frozen superconduct: cryo first, leftover into frozen, trigger spent
				const r1 = reduce(S, 'cryo', g, 1);
				const r2 = reduce(S, 'frozen', g - r1.spent, 1);
				g = 0;
				reacted = true;
				emit('superconduct', [...r1.consumed, ...r2.consumed], r1.spent + r2.spent);
			} else if (S.u.cryo > EPS && g > EPS) {
				const r = reduce(S, 'cryo', g, 1);
				g -= r.spent;
				reacted = true;
				emit('superconduct', r.consumed, r.spent);
			}
			if (S.u.dendro > EPS && g > EPS) {
				const r = reduce(S, 'dendro', g, 1);
				g -= r.spent;
				reacted = true;
				const formed = Math.max(...r.consumed.map((c) => c.amount), 0);
				attachQuicken(S, formed);
				emit('quicken', r.consumed, r.spent);
				if (S.u.hydro > EPS) quickenBloomPending = true;
			}
			break;
		}
		case 'pyro': {
			// The Burgeon half of the same rule — see the Electro case above.
			if (consumeCore(S)) emit('burgeon', [], 0);
			if (S.u.electro > EPS && g > EPS) {
				const r = reduce(S, 'electro', g, 1);
				g -= r.spent;
				reacted = true;
				emit('overload', r.consumed, r.spent);
			}
			// the game rejects vaporize while frozen persists (melt handles it)
			if (S.u.hydro > EPS && S.u.frozen <= EPS && g > EPS) {
				const r = reduce(S, 'hydro', g, 0.5);
				g -= r.spent;
				reacted = true;
				emit('reverseVaporize', r.consumed, r.spent);
			}
			if ((S.u.cryo > EPS || S.u.frozen > EPS) && g > EPS) {
				// forward melt drains Cryo AND Frozen, each up to 2 × trigger;
				// the trigger pays once for the larger of the two
				const ra = reduce(S, 'cryo', g, 2);
				const rb = reduce(S, 'frozen', g, 2);
				const spent = Math.max(ra.spent, rb.spent);
				g -= spent;
				reacted = true;
				emit('melt', [...ra.consumed, ...rb.consumed], spent);
			}
			if ((S.u.dendro > EPS || S.u.quicken > EPS) && g > EPS) {
				// burning ignition consumes nothing and does NOT count as reacting,
				// so the pyro still attaches as an aura afterwards
				if (S.u.burningFuel <= EPS) {
					startBurning(S, Math.max(S.u.dendro, S.u.quicken));
					emit('burning', [], 0);
				}
			}
			break;
		}
		case 'cryo': {
			if (S.u.frozen <= EPS && S.u.electro > EPS && g > EPS) {
				const r = reduce(S, 'electro', g, 1);
				g -= r.spent;
				reacted = true;
				emit('superconduct', r.consumed, r.spent);
			}
			if ((S.u.pyro > EPS || S.u.burning > EPS) && g > EPS) {
				// gcsim quirk kept as-is: reverse melt reduces the pyro but does
				// not charge the cryo trigger's gauge (it stays available for a
				// freeze further down the chain)
				const r = reduce(S, 'pyro', g, 0.5);
				reacted = true;
				emit('reverseMelt', r.consumed, 0);
				burningCheck(S);
			}
			if (S.u.hydro > EPS && g > EPS) {
				const d = Math.min(S.u.hydro, g);
				S.u.hydro -= d;
				S.u.frozen = Math.max(S.u.frozen, 2 * d);
				g -= d;
				reacted = true;
				emit('freeze', [{ mod: 'hydro', amount: d }], d);
			}
			break;
		}
		case 'hydro': {
			if ((S.u.pyro > EPS || S.u.burning > EPS) && g > EPS) {
				const r = reduce(S, 'pyro', g, 2);
				g -= r.spent;
				reacted = true;
				emit('vaporize', r.consumed, r.spent);
				burningCheck(S);
			}
			if (S.u.cryo > EPS && g > EPS) {
				const d = Math.min(S.u.cryo, g);
				S.u.cryo -= d;
				S.u.frozen = Math.max(S.u.frozen, 2 * d);
				g -= d;
				reacted = true;
				emit('freeze', [{ mod: 'cryo', amount: d }], d);
			}
			if ((S.u.dendro > EPS || S.u.quicken > EPS || S.u.burningFuel > EPS) && g > EPS) {
				const ra = reduce(S, 'dendro', g, 0.5);
				const rb = reduce(S, 'quicken', g, 0.5);
				const spent = Math.max(ra.spent, rb.spent);
				g -= spent;
				reacted = true;
				emit('bloom', [...ra.consumed, ...rb.consumed], spent);
				S.events.push({ kind: 'core', time: t });
				spawnCore(S);
			}
			if (S.u.frozen <= EPS && S.u.electro > EPS && g > EPS) {
				if (!reacted) {
					const mode = attachAura(S, 'hydro', g);
					if (applyEvent) applyEvent.attach = mode;
				}
				reacted = true;
				emit('electroCharged', [], 0);
				chargeReaction(S);
			}
			break;
		}
		case 'dendro': {
			if (S.u.quicken > EPS && g > EPS) emit('spread', [], 0);
			if (S.u.electro > EPS && g > EPS) {
				const r = reduce(S, 'electro', g, 1);
				g -= r.spent;
				reacted = true;
				const formed = Math.max(...r.consumed.map((c) => c.amount), 0);
				attachQuicken(S, formed);
				emit('quicken', r.consumed, r.spent);
				if (S.u.hydro > EPS) quickenBloomPending = true;
			}
			if ((S.u.pyro > EPS || S.u.burning > EPS) && g > EPS) {
				if (S.u.burningFuel <= EPS) {
					const dendroDur = Math.max(S.u.dendro, AURA_TAX * g);
					startBurning(S, Math.max(dendroDur, S.u.quicken));
					emit('burning', [], 0);
				} else {
					// fresh dendro OVERWRITES the fuel gauge (it can shrink it)
					S.u.burningFuel = AURA_TAX * g;
				}
			}
			if (S.u.hydro > EPS && g > EPS) {
				const r = reduce(S, 'hydro', g, 2);
				g -= r.spent;
				reacted = true;
				emit('bloom', r.consumed, r.spent);
				S.events.push({ kind: 'core', time: t });
				spawnCore(S);
			}
			break;
		}
		case 'anemo': {
			const order: [string, AuraKey][] = [
				['electro', 'electro'],
				['pyro', 'pyro'],
				['hydro', 'hydro'],
				['cryo', 'cryo'],
				['frozen', 'frozen']
			];
			for (const [el, key] of order) {
				if (g <= EPS) break;
				const present = MODS_OF[el].some((m) => S.u[m] > EPS);
				if (!present) continue;
				const r = reduce(S, el, g, 0.5);
				g -= r.spent;
				reacted = true;
				emit('swirl', r.consumed, r.spent, key);
				if (el === 'pyro') burningCheck(S);
			}
			break;
		}
		case 'geo': {
			const order: [string, AuraKey][] = [
				['electro', 'electro'],
				['hydro', 'hydro'],
				['cryo', 'cryo'],
				['pyro', 'pyro'],
				['frozen', 'frozen']
			];
			// ⚓ gcsim tries every aura in this order. A regular Crystallize is
			// gated by the 1s cooldown, so only the first present aura reacts (or
			// is blocked); an armed Lunar-Crystallize on Hydro ignores the gate,
			// never sets it, and does not end the search.
			let regularTried = false;
			for (const [el, key] of order) {
				const present = MODS_OF[el].some((m) => S.u[m] > EPS);
				if (!present || g <= EPS) continue;
				if (el === 'hydro' && S.lunarCrystallize) {
					const r = reduce(S, el, g, 0.5);
					g -= r.spent;
					reacted = true;
					emit('crystallize', r.consumed, r.spent, key);
					continue;
				}
				if (regularTried) continue;
				regularTried = true;
				if (S.frame < S.crysGcdUntil) {
					emit('crystallizeBlocked', [], 0, key);
				} else {
					S.crysGcdUntil = S.frame + 60;
					const r = reduce(S, el, g, 0.5);
					g -= r.spent;
					reacted = true;
					emit('crystallize', r.consumed, r.spent, key);
					if (el === 'pyro') burningCheck(S);
				}
			}
			break;
		}
	}

	// unreacted elemental gauge becomes (or refreshes) an aura
	if (!reacted && g > EPS && element !== 'anemo' && element !== 'geo') {
		const mode = attachAura(S, element, g);
		if (applyEvent) applyEvent.attach = mode;
	}
	if (applyEvent) {
		const mod = element as AuraKey;
		applyEvent.auraAfter = element === 'anemo' || element === 'geo' ? 0 : S.u[mod];
	}

	// quicken formed while hydro is present blooms immediately off its own gauge
	if (quickenBloomPending && S.u.quicken > EPS && S.u.hydro > EPS) {
		const avail = S.u.quicken;
		const r = reduce(S, 'hydro', avail, 2);
		const q0 = S.u.quicken;
		S.u.quicken -= Math.min(r.spent, S.u.quicken);
		emit('quickenBloom', [...r.consumed, { mod: 'quicken', amount: q0 - S.u.quicken }], 0);
		S.events.push({ kind: 'core', time: t });
		spawnCore(S);
	}
}

// ── Per-frame decay (mirrors gcsim Tick()) ───────────────────────────────────

function decayTick(S: Sim) {
	// plain auras + burning fuel decay at their own rate
	for (const mod of ['pyro', 'hydro', 'electro', 'cryo', 'burningFuel'] as AuraKey[]) {
		if (S.u[mod] <= EPS || S.rate[mod] === 0) continue;
		const before = S.u[mod];
		S.u[mod] = Math.max(0, S.u[mod] - S.rate[mod] / FPS);
		expireIfDrained(S, mod, before);
	}

	// fuel exhausted → burning ends and sweeps dendro + quicken with it
	if (S.burningActive && S.u.burningFuel <= EPS) {
		const swept: AuraKey[] = [];
		for (const mod of ['burning', 'dendro', 'quicken'] as AuraKey[]) {
			if (S.u[mod] > EPS) swept.push(mod);
			S.u[mod] = 0;
		}
		S.burningActive = false;
		S.events.push({ kind: 'burningEnd', time: (S.frame + 1) / FPS, swept });
	}

	// dendro & quicken: while burning, they drain at the fuel's rate instead
	// (dendro at least double its own)
	for (const mod of ['dendro', 'quicken'] as AuraKey[]) {
		if (S.u[mod] <= EPS) continue;
		let rate = S.rate[mod];
		if (S.u.burningFuel > EPS) {
			rate = S.rate.burningFuel;
			if (mod === 'dendro') rate = Math.max(rate, S.rate.dendro * 2);
		}
		const before = S.u[mod];
		S.u[mod] = Math.max(0, S.u[mod] - rate / FPS);
		expireIfDrained(S, mod, before);
	}

	// frozen: accelerating decay while present, decelerating back down after
	if (S.u.frozen > EPS) {
		S.rate.frozen += FRZ_RAMP_UP;
		const before = S.u.frozen;
		S.u.frozen = Math.max(0, S.u.frozen - S.rate.frozen / FPS);
		expireIfDrained(S, 'frozen', before);
	} else if (S.rate.frozen > FRZ_BASE_RATE) {
		S.rate.frozen = Math.max(FRZ_BASE_RATE, S.rate.frozen - FRZ_RAMP_DOWN);
	}

	if (S.ecActive && (S.u.electro <= EPS || S.u.hydro <= EPS)) S.ecActive = false;
}

// ── The live gauge (streaming shape) ─────────────────────────────────────────

/**
 * A gauge that runs alongside a clock instead of over a finished list.
 *
 * ⚓⚓ THE SHAPE THE ROTATION SIM NEEDS. The planner cannot hand over a sorted
 * application list, because half of them do not exist yet: a reaction changes a
 * stance's length, which changes what the next token resolves to, which decides
 * what applies next (gauge-round.md §2, feedback edge F2). So the gauge learns
 * one application at a time, at the instant the sim reaches it.
 *
 * ⚠️ Frame ordering inside one frame F is a contract carried over from the batch
 * loop, not an implementation detail:
 *
 *   `advanceTo(F)`  runs internal tasks and decay for every frame BEFORE F, and
 *                   stops at the top of F
 *   `apply()`       lands at the top of F, before F's own internal tasks
 *   F's tasks fire when the gauge next LEAVES F
 *
 * ⚓ `advanceTo` JUMPS when the gauge is idle — every aura at zero and nothing
 * scheduled — because a rotation may contain hours of legal idle time (C6, as
 * amended at L3a: 14 KB of `~3600s` tokens is 432,000,000 frames). Continuous
 * work is bounded by AURA LIFETIME, never by rotation length.
 */
export type Gauge = {
	/** The frame the gauge is at — the next one to be processed. */
	readonly frame: number;
	/** Every aura empty and nothing scheduled: time may be skipped freely. */
	readonly idle: boolean;
	/** Earliest pending internal task (a Burning or EC tick), or `null`.
	 *  ⚓ The rotation sim schedules its own wake-up here, so a tick-borne
	 *  reaction dispatches in true clock order instead of being noticed late. */
	nextTaskFrame(): number | null;
	/** Run tasks + decay up to (not including) `frame`. ⛔ Never moves backwards. */
	advanceTo(frame: number): void;
	/** Land one application at the current frame. `gauge` is PRE-TAX units and
	 *  `source` is the caller's own token, handed back on every event it causes
	 *  — including the ones a Burning chain fires later. */
	apply(element: ElementId, gauge: number, source?: number | null): void;
	/** Events since the last call. */
	takeEvents(): SimEvent[];
	/** Every event so far. */
	allEvents(): SimEvent[];
	/** Current gauge of every mod — the aura trajectory the L0 oracle compares. */
	gauges(): Readonly<ModState>;
	/** Close the open series intervals and return them.
	 *  ⚠️ The rotation sim calls this too since L6 (`collectAuraSeries`) — the
	 *  aura lane draws the LIVE gauge's own trajectory rather than a re-run, so
	 *  this is no longer batch/instrument-only. Call it once, at the end. */
	closeSeries(): SeriesInterval[];
};

/** ⚠️ The batch needs two things the streaming contract deliberately withholds:
 *  the raw state (to ask "is every aura spent yet") and a way to walk ONE frame
 *  past the last application without the idle skip cutting the series tail
 *  short. They stay module-private rather than widening `Gauge`. */
type GaugeInternals = { gauge: Gauge; sim: Sim; step: () => void };

/** How the gauge is built. The two Lunar flags say the TEAM converts that
 *  reaction (an enabler is on it), which changes the gauge, not just the name:
 *  the rotation sim sets them from `teamEnabledReactions`; the Gauge Explorer
 *  leaves them off. */
export type GaugeOptions = {
	maxFrames?: number;
	sampling?: boolean;
	lunarCharged?: boolean;
	lunarCrystallize?: boolean;
};

function createGaugeInternal({
	maxFrames = Infinity,
	sampling = false,
	lunarCharged = false,
	lunarCrystallize = false
}: GaugeOptions = {}): GaugeInternals {
	const S: Sim = {
		frame: 0,
		maxFrames,
		sampling,
		appliedThisFrame: false,
		u: zeroState(),
		rate: { ...zeroState(), frozen: FRZ_BASE_RATE },
		ecActive: false,
		burningActive: false,
		ecGen: 0,
		burningGen: 0,
		burningIcd: createIcdClock(),
		crysGcdUntil: -1,
		lunarCharged,
		lunarCrystallize,
		lcCloudUntil: -1,
		lcIcdUntil: -1,
		lcGen: 0,
		cores: [],
		nextCoreId: 0,
		dropped: 0,
		tasks: new Map(),
		events: [],
		open: {},
		series: []
	};
	let taken = 0;

	const isIdle = () => S.tasks.size === 0 && ALL_MODS.every((m) => S.u[m] <= EPS);

	/** Process the current frame and move to the next. */
	const stepFrame = () => {
		const t = S.frame / FPS;
		const tasks = S.tasks.get(S.frame);
		if (tasks) {
			S.tasks.delete(S.frame);
			for (const run of tasks) run();
		}
		if (S.appliedThisFrame || tasks) sample(S, t);
		S.appliedThisFrame = false;
		decayTick(S);
		sample(S, (S.frame + 1) / FPS);
		S.frame++;
	};

	const gauge: Gauge = {
		get frame() {
			return S.frame;
		},
		get idle() {
			return isIdle();
		},
		nextTaskFrame() {
			let min: number | null = null;
			for (const f of S.tasks.keys()) if (min === null || f < min) min = f;
			return min;
		},
		advanceTo(frame) {
			while (S.frame < frame) {
				// ⚓ THE IDLE SKIP. Nothing decays and nothing fires, so the frames in
				// between are indistinguishable — and walking them is the one way to
				// reintroduce the freeze C6 exists to prevent.
				//
				// 🐛 ⚠️ THE CURRENT FRAME IS NOT SKIPPABLE WHILE AN APPLICATION IS
				// UNFLUSHED, even when every aura reads zero — which is exactly the
				// state an application that CONSUMED the last aura leaves behind. Its
				// post-sample is what closes the series interval; skipping it merged
				// two lifetimes of the same aura into one and drew a line across the
				// gap where the chart should have gone to zero. (148/400 sweeps.)
				if (!S.appliedThisFrame && isIdle()) {
					S.frame = frame;
					return;
				}
				stepFrame();
			}
		},
		apply(element, gauge, source = null) {
			if (!(gauge > 0)) return;
			if (!S.appliedThisFrame) {
				// Ground the pre-application values so a consumed aura renders as a
				// vertical drop rather than a diagonal to the next sample.
				sample(S, S.frame / FPS);
				S.appliedThisFrame = true;
			}
			applyElement(S, element, gauge, source);
		},
		takeEvents() {
			const out = S.events.slice(taken);
			taken = S.events.length;
			return out;
		},
		allEvents() {
			return S.events;
		},
		gauges() {
			return S.u;
		},
		closeSeries() {
			for (const mod of ALL_MODS) {
				const open = S.open[mod];
				if (open) {
					S.series.push({ key: mod, points: open });
					S.open[mod] = undefined;
				}
			}
			return S.series;
		}
	};

	return { gauge, sim: S, step: stepFrame };
}

/** The live gauge. See {@link Gauge}. */
export function createGauge(opts?: GaugeOptions): Gauge {
	return createGaugeInternal(opts).gauge;
}

// ── Entry point (the batch) ──────────────────────────────────────────────────

export function simulateGauge(
	applications: Application[],
	{ maxSeconds = DEFAULT_MAX_SECONDS }: { maxSeconds?: number } = {}
): GaugeSim {
	const maxFrames = Math.max(1, Math.round(maxSeconds * FPS));
	const apps = [...applications]
		.filter((a) => a.gauge > 0 && a.time >= 0)
		.sort((a, b) => a.time - b.time);

	const { gauge: g, sim: S, step } = createGaugeInternal({ maxFrames, sampling: true });

	// ⚠️ Applications past the cap used to vanish without a trace. They are
	// still not simulated — but they are COUNTED, so a caller cannot mistake a
	// truncated run for a complete one.
	let dropped = 0;
	apps.forEach((app, index) => {
		const f = Math.round(app.time * FPS);
		if (f > maxFrames) {
			dropped++;
			return;
		}
		g.advanceTo(f);
		g.apply(app.element, app.gauge, index);
	});
	// ⚠️ The LAST application's frame, dropped ones included — so a run whose
	// input all fell past the cap still walks to the cap rather than reporting a
	// one-frame duration. It reads like an off-by-one and is the behaviour.
	const lastAppFrame = apps.length ? Math.round(apps[apps.length - 1].time * FPS) : 0;

	// Run on past the last application until every aura is spent (or the cap).
	// ⚠️ A bare frame walk rather than `advanceTo`, because the idle skip would
	// jump straight to the cap and the series would lose its tail.
	while (S.frame <= maxFrames) {
		step();
		if (S.frame - 1 >= lastAppFrame && ALL_MODS.every((m) => S.u[m] <= EPS)) break;
	}

	const series = g.closeSeries();
	// Hit the cap with gauge still alive → the tail is missing, not empty.
	const truncated = S.frame > maxFrames && ALL_MODS.some((m) => S.u[m] > EPS);

	return {
		series,
		events: g.allEvents(),
		duration: Math.min(S.frame, maxFrames) / FPS,
		truncated,
		droppedApplications: dropped
	};
}

/** Gauge of every aura present at time t (linear interpolation within samples) */
export function gaugesAt(series: SeriesInterval[], t: number): Partial<Record<AuraKey, number>> {
	const out: Partial<Record<AuraKey, number>> = {};
	for (const { key, points } of series) {
		if (!points.length) continue;
		if (t < points[0].t || t > points[points.length - 1].t) continue;
		for (let i = 1; i < points.length; i++) {
			if (t <= points[i].t) {
				const a = points[i - 1];
				const b = points[i];
				const u = b.t === a.t ? b.u : a.u + ((t - a.t) / (b.t - a.t)) * (b.u - a.u);
				if (u > EPS) out[key] = Math.max(out[key] ?? 0, u);
				break;
			}
		}
	}
	return out;
}
