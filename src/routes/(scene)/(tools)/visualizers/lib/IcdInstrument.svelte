<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { ELEMENT_LABEL } from '$lib/utils/auraDisplay';
	import Mark from '$lib/components/Mark.svelte';
	import { simulateIcd, STANDARD_ICD, NO_ICD, type IcdParams } from '$lib/utils/icd';
	import { icdHitsToGaugeApps, type HandoffMessage } from './workspace';
	import { ICD_EXAMPLES, type IcdExampleId } from './icdExamples';
	import { evenHits, evenShare, evenSpan } from './icdTimeline';
	import InstrumentSlider from './kit/InstrumentSlider.svelte';

	const ELEMENTS = ['pyro', 'hydro', 'anemo', 'electro', 'cryo', 'geo', 'dendro'] as const;
	type ElementId = (typeof ELEMENTS)[number];
	/** Where the hits come from: an even string drawn by the handle, or an example. */
	type Source = 'even' | IcdExampleId;
	/** `own` is the example's own group, offered only while an example is loaded. */
	type Rule = 'standard' | 'none' | 'own' | 'custom';

	// Workspace handoff outlet — present only when a workspace hosts us
	let { onHandoff }: { onHandoff?: (msg: HandoffMessage) => void } = $props();

	// ── The hits ──────────────────────────────────────────────────────────────
	let source = $state<Source>('even');
	let interval = $state(0.5);

	// A typed value may be finer than its track (frame data gives 0.475s), so
	// the seconds keep the precision a link carries: an interval to the
	// millisecond, a timer to the hundredth. The counts are whole. Each snap is
	// also what keeps ↑/↓ in a field from adding float noise (0.1 + 0.05 × 3),
	// which would unlight an anchor chip that compares with ===.
	const INTERVAL_PER = 1000;
	const TIMER_PER = 100;
	const toInterval = (v: number) => Math.round(v * INTERVAL_PER) / INTERVAL_PER;
	const toTimer = (v: number) => Math.round(v * TIMER_PER) / TIMER_PER;
	const INTERVAL_MIN = 0.1;
	const INTERVAL_MAX = 3;

	// Rough real-world anchors so "hit interval" means something before a
	// player knows their frame data — deliberately approximate (~).
	// ⚓ KEEP THE SPREAD (worksheet 02): under standard ICD the three show the
	// rule's three cases — at 0.5s the counter decides, at 1s the counter and the
	// timer agree, at 2s the timer decides. 0.5s is the corpus median swing gap
	// (0.475s over 119 strings) and the default, so the first is lit on load.
	const ANCHORS = [
		{ label: '~0.5s normal attacks', v: 0.5 },
		{ label: '~1s summon ticks', v: 1 },
		{ label: '~2s slow summon ticks', v: 2 }
	];

	// ── The rule ──────────────────────────────────────────────────────────────
	let rule = $state<Rule>('standard');
	/** The Custom rule's timer, 0–10s; 0 is no timer (every hit applies). */
	let customTimer = $state(2.5);
	/** Hit counter, 1–8; `COUNTER_OFF` = only the first hit of a window applies. */
	let customHits = $state(3);
	/** Applications per window, 1–8; `NO_LIMIT` = unlimited. */
	let customCap = $state(8);
	const TIMER_MAX = 10;
	const COUNTER_OFF = 9;
	const NO_LIMIT = 9;

	// Which element colors the applications — and what a hand-off sends
	let element = $state<ElementId>('electro');

	export function reset() {
		source = 'even';
		interval = 0.5;
		rule = 'standard';
		customTimer = 2.5;
		customHits = 3;
		customCap = 8;
		element = 'electro';
		pointed = null;
	}

	const example = $derived(
		source === 'even' ? null : (ICD_EXAMPLES.find((e) => e.id === source) ?? null)
	);

	function pickSource(s: Source) {
		source = s;
		pointed = null;
		const ex = ICD_EXAMPLES.find((e) => e.id === s);
		if (ex) {
			rule = 'own';
			element = ex.element;
		} else if (rule === 'own') {
			rule = 'standard';
		}
	}

	/** Custom starts from the rule on screen, so it opens as an edit of it. */
	function pickCustom() {
		const p = params;
		customTimer = Math.min(p.timer, TIMER_MAX);
		customHits = p.hits === Infinity ? COUNTER_OFF : Math.min(p.hits, 8);
		customCap = p.cap === undefined ? NO_LIMIT : Math.min(p.cap, 8);
		rule = 'custom';
	}

	/**
	 * ⚓ THE RULE IS ON THE SURFACE (⚓ Nate 2026-11-04): its three numbers are
	 * always shown, a preset only fills them in, and moving one makes the rule
	 * Custom, starting from the preset's numbers.
	 */
	function editRule(set: () => void) {
		if (rule !== 'custom') pickCustom();
		set();
	}

	// ── Workspace handle (share) ───────────────────────────────────────────────
	// The even string's interval and the Custom rule's ride along even while an
	// example or another rule is on screen: going back to them shows what was
	// set. ↻ The stage round dropped `hits`: the axis's length is the rule's
	// now (icdTimeline.ts `evenSpan`), so an older link's count is ignored.
	export function getShareState() {
		return {
			v: 1,
			source,
			interval,
			rule,
			custom: [customTimer, customHits, customCap],
			element
		};
	}

	export function applyShareState(state: unknown) {
		if (typeof state !== 'object' || state === null) return;
		const s = state as Record<string, unknown>;
		if (s.v !== 1) return;
		// Clamped to the slider's range and snapped to what its field takes, `per`
		// steps to the unit — dividing by it keeps 0.45 from coming back as
		// 0.45000000000000007
		const num = (v: unknown, lo: number, hi: number, per = 1) =>
			typeof v === 'number' && Number.isFinite(v)
				? Math.round(Math.min(hi, Math.max(lo, v)) * per) / per
				: undefined;
		reset();
		// an example brings its own rule and element, as picking it does
		if (s.source === 'even' || ICD_EXAMPLES.some((e) => e.id === s.source))
			pickSource(s.source as Source);
		interval = num(s.interval, INTERVAL_MIN, INTERVAL_MAX, INTERVAL_PER) ?? interval;
		if (Array.isArray(s.custom)) {
			customTimer = num(s.custom[0], 0, TIMER_MAX, TIMER_PER) ?? customTimer;
			customHits = num(s.custom[1], 1, COUNTER_OFF) ?? customHits;
			customCap = num(s.custom[2], 1, NO_LIMIT) ?? customCap;
		}
		if (s.rule === 'standard' || s.rule === 'none' || s.rule === 'custom') rule = s.rule;
		// `own` only means something while an example is loaded
		else if (s.rule === 'own' && source !== 'even') rule = 'own';
		if (ELEMENTS.includes(s.element as ElementId)) element = s.element as ElementId;
	}

	const params = $derived<IcdParams>(
		rule === 'standard'
			? STANDARD_ICD
			: rule === 'none'
				? NO_ICD
				: rule === 'own' && example
					? example.rule
					: {
							timer: customTimer,
							hits: customHits === COUNTER_OFF ? Infinity : customHits,
							cap: customCap === NO_LIMIT ? undefined : customCap
						}
	);

	/** The rule's three numbers as its sliders show them, whichever rule is on. */
	const shown = $derived({
		timer: Math.min(params.timer, TIMER_MAX),
		hits: params.hits === Infinity ? COUNTER_OFF : Math.min(params.hits, 8),
		cap: params.cap === undefined ? NO_LIMIT : Math.min(params.cap, 8)
	});

	const span = $derived(evenSpan(params));
	const times = $derived(example ? example.hits : evenHits(interval, span));
	const sim = $derived(simulateIcd(times, params));
	const apps = $derived(sim.filter((h) => h.applies).length);

	// ── The headline: the share of hits that apply (⚓ Nate, 2026-11-04) ─────
	// An even string's share is its repeating window's (icdTimeline.ts), so it
	// follows the interval and nothing else; an example is a whole story, so
	// its share is the list's.
	const share = $derived(example ? null : evenShare(interval, params));
	const head = $derived.by(() => {
		if (!share)
			return apps === sim.length
				? { figure: `All ${sim.length}`, sentence: 'hits apply their element' }
				: { figure: `${apps} of ${sim.length}`, sentence: 'hits apply their element' };
		return share.applies === share.of
			? { figure: 'Every hit', sentence: 'applies its element' }
			: { figure: `${share.applies} of every ${share.of}`, sentence: 'hits apply their element' };
	});

	const ordinal = (n: number) => (n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
	const fmtS = (s: number) => `${+s.toFixed(2)}s`;

	// ── Graph geometry — pixel-true (width measured, not viewBox-scaled) ──────
	let graphW = $state(720);
	let graphH = $state(0);
	/**
	 * ⚓ THE CHART SIZES UP AS A WHOLE (⚓ Nate 2026-11-04, replacing "the stalks
	 * grow, and only a little" of 2026-10-06, when the chart sat in the rail).
	 * On the stage a strip that only lengthened its stems looked spare. Given a
	 * taller box, every mark and word scales by `k` (icons, stems, digits,
	 * rings, bands, labels, the margins) up to 🎛️ K_MAX; then the stems
	 * lengthen, up to 🎛️ STALK_GROW × their scaled length; past that the
	 * group centres in the stage (.icd-body) and the rest is bare night.
	 * A phone's stage is its natural height, so it stays at k = 1.
	 */
	const K_MAX = 1.6;
	const STALK_GROW = 2;
	const STALK = 50;
	/** Everything in the chart but the stalk, at k = 1: the bracket's and the
	 *  icons' room over it; the counter, the timer and the axis under it; and,
	 *  for an even string, the share strip under the axis. */
	const TOP = $derived(example ? 26 : 46);
	const FIXED = $derived(TOP + 50 + (example ? 20 : 60));
	const natural = $derived(FIXED + STALK);
	const k = $derived(Math.min(K_MAX, Math.max(1, graphH / natural)));
	const stalk = $derived(Math.min(k * STALK * STALK_GROW, Math.max(k * STALK, graphH - k * FIXED)));
	const ROW = $derived.by(() => {
		const hitTop = TOP * k;
		const hitBottom = hitTop + stalk;
		const bandTop = hitBottom + 28 * k;
		const bandH = 14 * k;
		const axisY = bandTop + bandH + 8 * k;
		const stripTop = axisY + 24 * k;
		const stripH = 30 * k;
		return {
			bracketY: 16 * k,
			hitTop,
			hitBottom,
			counterY: hitBottom + 18 * k,
			bandTop,
			bandH,
			axisY,
			stripTop,
			stripBottom: stripTop + stripH,
			stripH,
			H: example ? axisY + 20 * k : stripTop + stripH + 6 * k
		};
	});
	/** A blocked hit's tick starts this far down its stalk — short at any length. */
	const BLOCKED_DROP = 18 / STALK;
	/** Half the slider thumb's 15px (app.css `.slider`): the handle's track runs
	 *  this far past each end of its range, so the thumb sits on hit 2. */
	const THUMB_R = 7.5;
	/** The chart's type, scaled with it. */
	const fs = $derived(10 * k);

	/** The lanes' names are labels, not marks: they follow the chart's type up
	 *  to 🎛️ 13px and stop, and their column is the widest name ("Counter",
	 *  about 3.5em in the condensed face) and LANE_GAP. Every mark starts right
	 *  of it. ↻ Was 58 × k, about 100px at full size (Nate: snug the edges). */
	const LANE_FS = $derived(Math.min(13, fs));
	const LANE_GAP = 8;
	const PADL = $derived(Math.ceil(3.5 * LANE_FS) + LANE_GAP);
	/** The right margin is half the last time label, so it ends at the edge. */
	const PADR = $derived(Math.ceil(1.2 * fs));

	const lastHit = $derived(times.length ? times[times.length - 1] : 0);
	const gap = $derived(
		example
			? Math.max(
					0.1,
					...times
						.slice(1)
						.map((t, i) => t - times[i])
						.filter((d) => d > 0)
				)
			: interval
	);
	// ⚓ An example's axis ends just after its last hit, even when its timer runs
	// on (Chevreuse's 3s window over 0.6s of shells): a window drawn running off
	// the edge says "and more" without squeezing eight hits into a fifth of the
	// chart. An even string's is the rule's span, which the handle doesn't move.
	const domain = $derived(example ? lastHit + Math.min(gap, 1) : span);
	const plotW = $derived(Math.max(1, graphW - PADL - PADR));
	const xOf = $derived((t: number) => PADL + (t / domain) * plotW);

	/** 🎛️ The reading stands right of the share strip, under the chart it
	 *  explains, where at least BESIDE_MIN px are left there; otherwise (a
	 *  phone, an example) it is a line of its own under the chart. */
	const BESIDE_MIN = 360;
	const BESIDE_GAP = 32;
	const besideX = $derived(xOf(INTERVAL_MAX) + BESIDE_GAP);
	const beside = $derived(!example && graphW - PADR - besideX >= BESIDE_MIN);

	// Axis steps that keep their labels ≥ 44px apart (scaled with the type).
	const STEPS = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20];
	const tickStep = $derived(STEPS.find((s) => (s / domain) * plotW >= 44 * k) ?? 30);
	const ticks = $derived(
		Array.from({ length: Math.floor(domain / tickStep + 1e-9) + 1 }, (_, i) => i * tickStep)
	);

	// Same-frame hits (Chevreuse's shells land in pairs) fan out a few pixels
	// so both can be seen — the times themselves are unchanged. 🎛️ 12px: two
	// counter digits side by side without touching.
	const FAN = 12;
	const xs = $derived.by(() => {
		// A plain record, not a Map: it lives and dies inside this derivation.
		const groups: Record<number, number[]> = {};
		times.forEach((t, i) => (groups[Math.round(t * 1e6)] ??= []).push(i));
		const out = new Array<number>(times.length);
		for (const idx of Object.values(groups))
			idx.forEach((i, j) => (out[i] = xOf(times[i]) + (j - (idx.length - 1) / 2) * FAN * k));
		return out;
	});

	/** 🎛️ Below this many px between hits (at k = 1), the counter lane writes
	 *  only the applying hits' numbers, or a 0.1s string's digits run together. */
	const DIGIT_ROOM = 11;
	const dense = $derived(!example && (interval / domain) * plotW < DIGIT_ROOM * k);

	const el = $derived(`var(--el-${element}-main)`);
	// ⚓ A blocked hit is still an ELEMENTAL hit (⚓ Nate, 2026-10-04) — it lands,
	// it just applies nothing — so it wears the element too, kept short, thin and
	// faint. Alpha in the paint, never element opacity (sub-pixel laws).
	// 🎛️ .5: clearly the element, clearly not an application.
	const BLOCKED_ALPHA = 0.5;
	/** The counter decides only on a timer, with a counter. */
	const counting = $derived(params.timer > 0 && params.hits !== Infinity);
	/** What the counter lane writes under a hit: its count, a dash once the
	 *  window's applications are spent, or nothing where no counter runs. */
	function counterText(i: number): string {
		const h = sim[i];
		if (h.capped) return dense ? '' : '–';
		if (!counting) return '';
		return dense && !h.applies ? '' : `${h.count}`;
	}

	// ── The timer windows: each opens on a timer-driven application ──────────
	// ⚓ PER WINDOW, not per second (worksheet 02 → the pass): "2 in every 2.5s
	// window" is the mechanic itself. Each band says how many it applied. An
	// even string is cut off at the axis's end, so a window that runs past it
	// is partial and says nothing; an example's list is the whole story, so
	// every window counts.
	const windows = $derived.by(() => {
		if (params.timer === 0) return [];
		const starts = sim.flatMap((h, i) => (h.viaTimer ? [i] : []));
		return starts.map((s, j) => {
			const end = j + 1 < starts.length ? starts[j + 1] : sim.length;
			const t0 = sim[s].time;
			const x0 = xOf(t0);
			const x1 = xOf(Math.min(t0 + params.timer, domain));
			const whole = !!example || j + 1 < starts.length;
			return {
				i: s,
				x0,
				// 2px end gap + bright start notch keep contiguous windows readable
				w: Math.max(2, x1 - x0 - 2),
				count: whole ? sim.slice(s, end).filter((h) => h.applies).length : null
			};
		});
	});
	/** 🎛️ A band this wide (at k = 1) says "2 applied"; narrower, just "2";
	 *  under the second, nothing. */
	const BAND_WORDS = 62;
	const BAND_DIGIT = 16;

	// ── The headline's window, bracketed (on trial: ⚓ Nate 2026-11-04) ──────
	// The hits the headline counts, over the first window: "2 of these 5". Not
	// on an example (its share is the whole list) or when every hit applies.
	const bracket = $derived.by(() => {
		if (!share || share.applies === share.of || share.of > xs.length) return null;
		return { x0: xs[0], x1: xs[share.of - 1], text: `${share.applies} of these ${share.of}` };
	});

	// ── The share strip: the headline at every interval, along the handle ───
	// The handle's track runs 0.1–3s on the time axis's scale, so the strip
	// drawn on that span under the axis is the slider's landscape: where the
	// share steps up as the interval grows. Sampled every 0.01s; it depends on
	// the rule alone, so dragging the handle only moves its dot.
	const SHARE_STEP = 0.01;
	const shares = $derived.by(() => {
		if (example) return [];
		const n = Math.round((INTERVAL_MAX - INTERVAL_MIN) / SHARE_STEP);
		return Array.from({ length: n + 1 }, (_, i) => {
			const v = INTERVAL_MIN + i * SHARE_STEP;
			const s = evenShare(v, params);
			return { v, r: s.applies / s.of };
		});
	});
	const stripPath = $derived.by(() => {
		if (!shares.length) return '';
		const y = (r: number) => (ROW.stripBottom - r * ROW.stripH).toFixed(1);
		let d = `M${xOf(INTERVAL_MIN).toFixed(1)},${ROW.stripBottom}`;
		let prev = shares[0].r;
		d += ` L${xOf(INTERVAL_MIN).toFixed(1)},${y(prev)}`;
		for (const { v, r } of shares) {
			if (r === prev) continue;
			const x = xOf(v).toFixed(1);
			d += ` L${x},${y(prev)} L${x},${y(r)}`;
			prev = r;
		}
		return `${d} L${xOf(INTERVAL_MAX).toFixed(1)},${y(prev)} L${xOf(INTERVAL_MAX).toFixed(1)},${ROW.stripBottom} Z`;
	});

	// ── Point to read ────────────────────────────────────────────────────────
	let pointed = $state<number | null>(null);

	function pointAt(e: PointerEvent) {
		const svg = e.currentTarget as SVGSVGElement;
		const x = e.clientX - svg.getBoundingClientRect().left;
		let best = -1;
		let bestD = Infinity;
		xs.forEach((hx, i) => {
			const d = Math.abs(hx - x);
			if (d < bestD) {
				bestD = d;
				best = i;
			}
		});
		pointed = best >= 0 ? best : null;
	}

	/** The timer-driven application that opened hit `i`'s window. */
	const windowStart = (i: number) => {
		for (let j = i; j >= 0; j--) if (sim[j].viaTimer) return j;
		return 0;
	};

	const reading = $derived.by(() => {
		if (pointed === null || pointed >= sim.length) return null;
		const i = pointed;
		const h = sim[i];
		const { timer, hits, cap } = params;
		const head = `Hit ${i + 1} · ${h.time.toFixed(2)}s`;
		if (timer === 0) return { head, applies: true, why: 'With no ICD, every hit applies.' };
		const j = windowStart(i);
		const left = fmtS(Math.max(0, sim[j].time + timer - h.time));
		if (h.viaTimer)
			return {
				head,
				applies: true,
				why:
					i === 0
						? `The first hit always applies, and it starts the ${fmtS(timer)} timer.`
						: `${fmtS(timer)} have passed since the timer started, so this hit applies, starts it again and sets the counter back to 1.`
			};
		if (h.applies)
			return {
				head,
				applies: true,
				why: `Every ${ordinal(hits)} hit applies. The timer from hit ${j + 1} keeps running, with ${left} left.`
			};
		if (h.capped)
			return {
				head,
				applies: false,
				why: `This window's ${cap} ${cap === 1 ? 'application is' : 'applications are'} used up until the timer from hit ${j + 1} runs out, in ${left}.`
			};
		if (hits === Infinity)
			return {
				head,
				applies: false,
				why: `Only the first hit in a window applies. The timer from hit ${j + 1} has ${left} left.`
			};
		return {
			head,
			applies: false,
			why: `The counter is on ${h.count} of ${hits}, and the timer from hit ${j + 1} has ${left} left.`
		};
	});

	// The lanes' names say what each lane is; their tooltips, how to read it
	// (design §6: definitions as tooltips on the chart's labels, no legend).
	const LANES = $derived([
		{
			name: 'Hits',
			y: ROW.hitTop + stalk / 2 + LANE_FS * 0.35,
			tip: 'A tall stem with the element’s icon applies its element. A short, faint one is blocked by ICD.'
		},
		{
			name: 'Counter',
			y: ROW.counterY,
			tip:
				'The hit counter. A ringed number is a hit the counter let through.' +
				(params.cap !== undefined && counting ? ' A dash: the window’s limit is reached.' : '')
		},
		{
			name: 'Timer',
			y: ROW.bandTop + ROW.bandH / 2 + LANE_FS * 0.35,
			tip: 'Each band is a timer window, started by a hit that applies once the timer has run out. Its number is how many hits it applied.'
		},
		...(example
			? []
			: [
					{
						name: 'Share',
						y: ROW.stripTop + ROW.stripH / 2 + LANE_FS * 0.35,
						tip: 'The share of hits that apply at every hit interval, along the slider under it.'
					}
				])
	]);

	const RULES: { id: Rule; label: string }[] = [
		{ id: 'standard', label: 'Standard' },
		{ id: 'none', label: 'No ICD' },
		{ id: 'own', label: 'Its own' },
		{ id: 'custom', label: 'Custom' }
	];
</script>

<!-- THE STAGE (design §6, §8). One box: the chart head (the share of hits
     that apply); the strings and the chart tools on the chart's top edge;
     three lanes on one time axis (the hits, the counter, the timer windows);
     the interval's handle on that axis, its thumb on hit 2, with the share
     at every interval along it; the pointed hit's reading; and the rule.
     ⚓ The ICD timeline has no setup bar (⚓ Nate 2026-11-04): its rule is the
     thing you play with, a live control, so it is on the surface. -->
{#snippet readingText()}
	{#if reading}
		<p>
			<span class="icd-reading-head">{reading.head}</span>
			<strong>{reading.applies ? 'applies' : 'blocked'}</strong>. {reading.why}
		</p>
	{:else}
		<p>Point at a hit to read why it applies or is blocked.</p>
	{/if}
{/snippet}

<div class="stage-root">
	<div class="stage ctx-dark">
		<p class="readout-head stage-head">
			{head.figure}<span class="readout-sentence">{head.sentence}</span>
		</p>

		<div class="icd-body">
			<div class="stage-toolbar">
				<div class="segment stage-tabs" role="radiogroup" aria-label="String">
					<button
						class="btn"
						class:is-active={source === 'even'}
						role="radio"
						aria-checked={source === 'even'}
						onclick={() => pickSource('even')}
					>
						Even spacing
					</button>
					{#each ICD_EXAMPLES as ex (ex.id)}
						<button
							class="btn"
							class:is-active={source === ex.id}
							role="radio"
							aria-checked={source === ex.id}
							onclick={() => pickSource(ex.id)}
						>
							{ex.label}
						</button>
					{/each}
				</div>

				<!-- The chart tools: one group, so they wrap together and hold the
				     toolbar's far end. The element colours the hits and is what a
				     hand-off sends; its track matches the strings'. -->
				<div class="icd-tools">
					<div class="segment icd-elements" role="radiogroup" aria-label="Element">
						{#each ELEMENTS as e (e)}
							<button
								class="btn icd-el"
								class:is-active={element === e}
								role="radio"
								aria-checked={element === e}
								onclick={() => (element = e)}
								aria-label={ELEMENT_LABEL[e]}
								title={ELEMENT_LABEL[e]}
							>
								<img src={elementIcon(e)} alt="" width="16" height="16" />
							</button>
						{/each}
					</div>

					{#if onHandoff}
						<button
							class="btn btn--glass ctx-glass icd-send"
							disabled={apps === 0}
							title="Sends the first 8 hits within 15s that apply an element — each as 1U, since the ICD timeline doesn't model gauge sizes."
							onclick={() =>
								onHandoff({
									target: 'gauge',
									kind: 'applications',
									payload: icdHitsToGaugeApps(sim, element)
								})}
						>
							Send to gauge explorer <Mark name="forward" size={12} />
						</button>
					{/if}
				</div>
			</div>

			<div
				class="stage-graph instrument-graph icd-graph"
				style:--graph-min="{natural}px"
				style:max-height="{K_MAX * (FIXED + STALK * STALK_GROW)}px"
				bind:clientWidth={graphW}
				bind:clientHeight={graphH}
			>
				<svg
					width={graphW}
					height={ROW.H}
					role="img"
					aria-label="ICD hit timeline"
					onpointermove={pointAt}
					onpointerdown={pointAt}
					onpointerleave={(e) => {
						if (e.pointerType === 'mouse') pointed = null;
					}}
				>
					<!-- Time grid, through the three lanes to the axis -->
					{#each ticks as s (s)}
						<line
							x1={xOf(s)}
							y1={ROW.hitTop - 4 * k}
							x2={xOf(s)}
							y2={ROW.axisY}
							stroke="var(--chart-grid)"
						/>
						<text
							x={xOf(s)}
							y={ROW.axisY + 14 * k}
							fill="var(--chart-ink)"
							font-size={fs}
							text-anchor="middle"
						>
							{fmtS(s)}
						</text>
					{/each}
					<line
						x1={PADL}
						y1={ROW.axisY}
						x2={graphW - PADR}
						y2={ROW.axisY}
						stroke="var(--chart-rule)"
					/>

					<!-- The lanes' names, in the left margin -->
					{#each LANES as lane (lane.name)}
						<text
							class="stage-word icd-lane"
							x={PADL - LANE_GAP}
							y={lane.y}
							fill="var(--chart-dim)"
							font-size={LANE_FS}
							text-anchor="end"
						>
							{lane.name}<title>{lane.tip}</title>
						</text>
					{/each}

					<!-- The headline's window, bracketed over its hits -->
					{#if bracket}
						<path
							d="M{bracket.x0},{ROW.bracketY + 5 * k} V{ROW.bracketY} H{bracket.x1} V{ROW.bracketY +
								5 * k}"
							fill="none"
							stroke="var(--chart-ink)"
							stroke-width="1"
						/>
						<text
							class="stage-word"
							x={bracket.x0}
							y={ROW.bracketY - 4 * k}
							fill="var(--text)"
							font-size={11 * k}
						>
							{bracket.text}
						</text>
					{/if}

					<!-- The pointed hit's column -->
					{#if pointed !== null && xs[pointed] !== undefined}
						<line
							x1={xs[pointed]}
							y1={ROW.hitTop - 4 * k}
							x2={xs[pointed]}
							y2={ROW.axisY}
							stroke="var(--chart-ink)"
							stroke-dasharray="3 3"
						/>
					{/if}

					<!-- The timer lane: each window from the application that opened it -->
					{#each windows as w (w.i)}
						<rect
							x={w.x0}
							y={ROW.bandTop}
							width={w.w}
							height={ROW.bandH}
							rx={2 * k}
							fill={el}
							fill-opacity="0.22"
						/>
						<line
							x1={w.x0}
							y1={ROW.bandTop - 1}
							x2={w.x0}
							y2={ROW.bandTop + ROW.bandH + 1}
							stroke={el}
							stroke-width={2 * k}
							stroke-opacity="0.75"
						/>
						{#if w.count !== null && w.w >= BAND_DIGIT * k}
							<text
								class="stage-word"
								x={w.x0 + 5 * k}
								y={ROW.bandTop + ROW.bandH / 2 + fs * 0.35}
								fill="var(--text)"
								font-size={fs}
							>
								{w.w >= BAND_WORDS * k ? `${w.count} applied` : w.count}
							</text>
						{/if}
					{/each}

					<!-- The hits lane's baseline -->
					<line
						x1={PADL}
						y1={ROW.hitBottom}
						x2={graphW - PADR}
						y2={ROW.hitBottom}
						stroke="var(--chart-grid)"
					/>

					<!-- Hits: an applying hit wears the element; a blocked one is a short,
					     faint tick of the same element. Under each, the counter lane:
					     ringed where the counter is what let it apply. -->
					{#each sim as h, i (i)}
						{@const x = xs[i]}
						{#if h.applies}
							<line
								class="icd-applies"
								x1={x}
								y1={ROW.hitTop}
								x2={x}
								y2={ROW.hitBottom}
								stroke={el}
								stroke-width={2.5 * k}
							/>
							<image
								href={elementIcon(element)}
								x={x - 8 * k}
								y={ROW.hitTop - 20 * k}
								width={16 * k}
								height={16 * k}
							/>
						{:else}
							<line
								x1={x}
								y1={ROW.hitTop + stalk * BLOCKED_DROP}
								x2={x}
								y2={ROW.hitBottom}
								stroke={el}
								stroke-opacity={BLOCKED_ALPHA}
								stroke-width={1.5 * k}
							/>
						{/if}
						{#if h.applies && !h.viaTimer}
							<circle
								cx={x}
								cy={ROW.counterY - fs * 0.35}
								r={7 * k}
								fill="none"
								stroke={el}
								stroke-width={1.25 * k}
							/>
						{/if}
						<text
							{x}
							y={ROW.counterY}
							fill={h.applies ? el : 'var(--chart-dim)'}
							font-size={fs}
							font-weight={h.applies ? 700 : 400}
							text-anchor="middle"
						>
							{counterText(i)}
						</text>
					{/each}

					<!-- The share strip: the headline at every interval the handle
					     under it reaches, and a dot where it is now -->
					{#if stripPath && share}
						<line
							x1={xOf(INTERVAL_MIN)}
							y1={ROW.stripTop}
							x2={xOf(INTERVAL_MAX)}
							y2={ROW.stripTop}
							stroke="var(--chart-grid)"
						/>
						<line
							x1={xOf(INTERVAL_MIN)}
							y1={ROW.stripBottom}
							x2={xOf(INTERVAL_MAX)}
							y2={ROW.stripBottom}
							stroke="var(--chart-rule)"
						/>
						<path d={stripPath} fill="var(--chart-ink)" fill-opacity="0.45" />
						<line
							x1={xOf(interval)}
							y1={ROW.stripTop}
							x2={xOf(interval)}
							y2={ROW.stripBottom}
							stroke="var(--chart-ink)"
							stroke-width="1.5"
						/>
						<circle
							cx={xOf(interval)}
							cy={ROW.stripBottom - (share.applies / share.of) * ROW.stripH}
							r={3.5 * k}
							fill="var(--accent)"
							style="stroke: var(--frame-bg)"
							stroke-width="1.5"
						/>
					{/if}
				</svg>
				{#if beside}
					<div
						class="icd-reading icd-reading--beside"
						aria-live="polite"
						style:left="{besideX}px"
						style:right="{PADR}px"
						style:top="{ROW.stripTop - 2}px"
					>
						{@render readingText()}
					</div>
				{/if}
			</div>

			<!-- THE HANDLE (design §6): the interval is a time, so its track runs
			     the time axis from its least to its most, and the thumb sits on
			     hit 2. The axis is the rule's (icdTimeline.ts `evenSpan`), so it
			     holds still under the drag. An example has no handle: its hits
			     are gcsim's, and its note takes the handle's place. -->
			{#if !example}
				<div
					class="stage-handle icd-handle"
					style:--stage-handle-l="{xOf(INTERVAL_MIN) - THUMB_R}px"
					style:--stage-handle-r="0px"
					style:--icd-track-w="{xOf(INTERVAL_MAX) - xOf(INTERVAL_MIN) + 2 * THUMB_R}px"
				>
					<InstrumentSlider
						label="Hit interval"
						aria="Hit interval in seconds"
						bind:value={interval}
						min={INTERVAL_MIN}
						max={INTERVAL_MAX}
						step={0.05}
						unit="s"
						decimals={3}
						snap={toInterval}
					>
						{#snippet headerEnd()}
							<span class="chips icd-anchors">
								{#each ANCHORS as a (a.v)}
									<button
										class="chip chip--control"
										class:active={interval === a.v}
										onclick={() => (interval = a.v)}
									>
										{a.label}
									</button>
								{/each}
							</span>
						{/snippet}
					</InstrumentSlider>
				</div>
			{:else}
				<p class="stage-fine">{example.note}</p>
			{/if}

			<!-- The pointed hit's reading, where there is no room beside the strip.
			     ⚓ Two lines reserved, so pointing never moves what's under it
			     (design §4). -->
			{#if !beside}
				<div class="icd-reading" aria-live="polite">{@render readingText()}</div>
			{/if}

			<!-- THE RULE, on the surface: the presets fill in its three numbers,
			     and moving one makes it Custom (editRule). Last, so a preset that
			     comes and goes ("Its own") moves nothing under the hand. -->
			<div class="icd-rule" role="group" aria-label="ICD rule">
				<div class="icd-rule-grid">
					<div class="icd-rule-head">
						<span class="icd-rule-name">ICD</span>
						<div class="segment" role="radiogroup" aria-label="ICD rule">
							{#each RULES as r (r.id)}
								{#if r.id !== 'own' || example}
									<button
										class="btn"
										class:is-active={rule === r.id}
										role="radio"
										aria-checked={rule === r.id}
										onclick={() => (r.id === 'custom' ? pickCustom() : (rule = r.id))}
									>
										{r.label}
									</button>
								{/if}
							{/each}
						</div>
					</div>
					<!-- The tracks' ends are words: typed, "off" and "none" land there too. -->
					<InstrumentSlider
						label="Timer"
						aria="ICD timer in seconds"
						bind:value={() => shown.timer, (v) => editRule(() => (customTimer = v))}
						min={0}
						max={TIMER_MAX}
						step={0.1}
						unit="s"
						decimals={2}
						snap={toTimer}
						text={shown.timer === 0 ? 'Off' : null}
						words={{ off: 0 }}
					/>
					<InstrumentSlider
						label="Hit counter"
						aria="ICD hit counter"
						bind:value={() => shown.hits, (v) => editRule(() => (customHits = v))}
						min={1}
						max={COUNTER_OFF}
						step={1}
						snap={Math.round}
						text={shown.hits === COUNTER_OFF ? 'Off' : null}
						words={{ off: COUNTER_OFF }}
					/>
					<InstrumentSlider
						label="Limit per window"
						aria="Applications allowed per ICD timer window"
						bind:value={() => shown.cap, (v) => editRule(() => (customCap = v))}
						min={1}
						max={NO_LIMIT}
						step={1}
						snap={Math.round}
						text={shown.cap === NO_LIMIT ? 'None' : null}
						words={{ none: NO_LIMIT }}
					/>
				</div>
				<p class="stage-fine">
					Internal Cooldown — the hidden rule that stops some hits from applying their element.
				</p>
			</div>
		</div>
	</div>
</div>

<style>
	/* Everything under the headline, top-aligned under it as on every stage
	   instrument; the chart grows into the room (K_MAX, STALK_GROW) and what
	   it can't use is bare night at the foot. ↻ Was centred, which left a gap
	   between the answer and its chart (Nate 2026-11-04). */
	.icd-body {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		gap: var(--inst-gap-control);
		min-height: 0;
	}

	.icd-graph {
		position: relative;
	}

	.icd-lane {
		cursor: help;
	}

	/* ── The toolbar's far end ─────────────────────────────────────────────── */

	.icd-tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
		margin-left: auto;
	}

	.icd-send {
		gap: 0.4rem;
	}

	.icd-elements {
		flex-wrap: wrap;
	}

	.icd-el {
		padding-inline: 0.45rem;
	}

	/* ── The handle and its presets ────────────────────────────────────────── */

	/* The track is the interval's span of the time axis (--icd-track-w), and
	   the header line under it runs on past its end: the name, the field, and
	   the presets after them, wrapping on a phone. */
	.icd-handle :global(.slider-control) {
		grid-template-columns: minmax(0, 1fr);
	}

	.icd-handle :global(.is-track) {
		width: var(--icd-track-w);
	}

	.icd-handle :global(.slider-header) {
		flex-wrap: wrap;
		row-gap: 0.5rem;
	}

	.icd-anchors {
		margin-left: 0.5rem;
	}

	.icd-anchors :global(.chip) {
		font-family: var(--font-condensed);
		text-transform: none;
		letter-spacing: var(--ls-mid);
	}

	/* ── The reading ───────────────────────────────────────────────────────── */

	.icd-reading {
		min-height: calc(2 * var(--lh-snug) * var(--fs-md));
	}

	/* Beside the strip: under the chart's right part, level with the strip's
	   top. Pointing passes through it to the chart. */
	.icd-reading--beside {
		position: absolute;
		min-height: 0;
		pointer-events: none;
	}

	.icd-reading :global(p) {
		margin: 0;
		font-size: var(--fs-md);
		line-height: var(--lh-snug);
		color: var(--chart-ink);
	}

	.icd-reading :global(.icd-reading-head) {
		font-variant-numeric: tabular-nums;
	}

	.icd-reading :global(strong) {
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	/* ── The rule ──────────────────────────────────────────────────────────── */

	/* A section of its own: the ladder's section rung above it (the body's
	   control gap plus this). */
	.icd-rule {
		display: grid;
		/* minmax(0), or the implicit `auto` column takes the sliders' min-content
		   and the section runs off a phone's edge. */
		grid-template-columns: minmax(0, 1fr);
		gap: var(--inst-gap-in);
		margin-top: calc(var(--inst-gap-section) - var(--inst-gap-control));
	}

	/* ONE ROW across the stage, its edges the chart's: the rule's name and
	   presets, then its three numbers. Stacked on a narrow tile. */
	.icd-rule-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--inst-gap-control) 2.5rem;
		align-items: end;
	}

	@container instrument (min-width: 52rem) {
		.icd-rule-grid {
			grid-template-columns: auto repeat(3, minmax(0, 1fr));
		}
	}

	/* The name over the presets, as a slider's label is over its track: the
	   name level with the labels, the presets' foot with the tracks'. */
	.icd-rule-head {
		display: flex;
		flex-direction: column;
		align-self: stretch;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.icd-rule-name {
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
</style>
