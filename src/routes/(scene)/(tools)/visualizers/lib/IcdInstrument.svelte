<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { ELEMENT_LABEL } from '$lib/utils/auraDisplay';
	import Mark from '$lib/components/Mark.svelte';
	import BandMenu from '$lib/components/BandMenu.svelte';
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
	let customTimer = $state(2.5);
	/** Hit counter, 1–8; `COUNTER_OFF` = only the first hit of a window applies. */
	let customHits = $state(3);
	/** Applications per window, 1–8; `NO_LIMIT` = unlimited. */
	let customCap = $state(8);
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
		customTimer = p.timer > 0 ? Math.min(Math.max(p.timer, 0.5), 10) : 2.5;
		customHits = p.hits === Infinity ? COUNTER_OFF : Math.min(p.hits, 8);
		customCap = p.cap === undefined ? NO_LIMIT : Math.min(p.cap, 8);
		rule = 'custom';
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
			customTimer = num(s.custom[0], 0.5, 10, TIMER_PER) ?? customTimer;
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

	const span = $derived(evenSpan(params));
	const times = $derived(example ? example.hits : evenHits(interval, span));
	const sim = $derived(simulateIcd(times, params));
	const apps = $derived(sim.filter((h) => h.applies).length);

	// ── The headline: the share of hits that apply (⚓ Nate, 2026-11-04) ─────
	// An even string's share is its repeating window's (icdTimeline.ts), so it
	// follows the interval and nothing else; an example is a whole story, so
	// its share is the list's.
	const head = $derived.by(() => {
		if (example)
			return apps === sim.length
				? { figure: `All ${sim.length}`, sentence: 'hits apply their element' }
				: { figure: `${apps} of ${sim.length}`, sentence: 'hits apply their element' };
		const { applies, of } = evenShare(interval, params);
		return applies === of
			? { figure: 'Every hit', sentence: 'applies its element' }
			: { figure: `${applies} of every ${of}`, sentence: 'hits apply their element' };
	});

	// ── The rule in words ────────────────────────────────────────────────────
	const ordinal = (n: number) => (n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
	const fmtS = (s: number) => `${+s.toFixed(2)}s`;

	const RULE_NAME: Record<Rule, string> = {
		standard: 'Standard',
		none: 'No ICD',
		own: 'Its own',
		custom: 'Custom'
	};

	const ruleText = $derived.by(() => {
		const { timer, hits, cap } = params;
		if (timer === 0) return 'Every hit applies its element';
		const parts = [`${fmtS(timer)} timer`];
		if (hits === Infinity) parts.push('first hit only');
		else if (hits === 1) parts.push('every hit');
		else parts.push(`every ${ordinal(hits)} hit`);
		if (cap !== undefined && hits !== Infinity) parts.push(`at most ${cap} per window`);
		return parts.join(' · ');
	});

	// ── Graph geometry — pixel-true (width measured, not viewBox-scaled) ──────
	let graphW = $state(720);
	let graphH = $state(0);
	/** 🎛️ The left margin holds the lanes' names; every mark starts right of it. */
	const PADL = 58;
	const PADR = 16;
	/**
	 * ⚓ THE STALKS GROW, AND ONLY A LITTLE (2026-10-06, ⚓ Nate). Given a taller
	 * box the hits lengthen — the counter, the timer and the axis keep their
	 * size — up to STALK_GROW × their natural length; past that the lanes and
	 * their toolbar and handle centre in the stage (.icd-body) and the rest is
	 * bare night. A one-row strip has no vertical scale to fill, so a taller
	 * one only says the same thing louder.
	 */
	const STALK = 50;
	const STALK_GROW = 2; // 🎛️
	/** Everything in the chart but the stalk: the icons' room over it, the
	 *  counter and timer lanes and the axis under it. */
	const FIXED = 94;
	const H_MIN = STALK + FIXED;
	const stalk = $derived(Math.min(STALK * STALK_GROW, Math.max(STALK, graphH - FIXED)));
	const ROW = $derived.by(() => {
		const hitTop = 24;
		const hitBottom = hitTop + stalk;
		const bandTop = hitBottom + 28;
		const bandH = 14;
		const axisY = bandTop + bandH + 8;
		return { hitTop, hitBottom, counterY: hitBottom + 18, bandTop, bandH, axisY, H: axisY + 20 };
	});
	/** A blocked hit's tick starts this far down its stalk — short at any length. */
	const BLOCKED_DROP = 18 / STALK;
	/** Half the slider thumb's 15px (app.css `.slider`): the handle's track runs
	 *  this far past each end of its range, so the thumb sits on hit 2. */
	const THUMB_R = 7.5;

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

	// Axis steps that keep their labels ≥ 44px apart (a 90s string used to print
	// a label every second, ~8px apart).
	const STEPS = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20];
	const tickStep = $derived(STEPS.find((s) => (s / domain) * plotW >= 44) ?? 30);
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
			idx.forEach((i, k) => (out[i] = xOf(times[i]) + (k - (idx.length - 1) / 2) * FAN));
		return out;
	});

	/** 🎛️ Below this many px between hits, the counter lane writes only the
	 *  applying hits' numbers, or a 0.1s string's digits run together. */
	const DIGIT_ROOM = 11;
	const dense = $derived(!example && (interval / domain) * plotW < DIGIT_ROOM);

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
		return starts.map((s, k) => {
			const end = k + 1 < starts.length ? starts[k + 1] : sim.length;
			const t0 = sim[s].time;
			const x0 = xOf(t0);
			const x1 = xOf(Math.min(t0 + params.timer, domain));
			const whole = !!example || k + 1 < starts.length;
			return {
				i: s,
				x0,
				// 2px end gap + bright start notch keep contiguous windows readable
				w: Math.max(2, x1 - x0 - 2),
				count: whole ? sim.slice(s, end).filter((h) => h.applies).length : null
			};
		});
	});
	/** 🎛️ A band this wide says "2 applied"; narrower, just "2"; under the
	 *  second, nothing. */
	const BAND_WORDS = 62;
	const BAND_DIGIT = 16;

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
		for (let k = i; k >= 0; k--) if (sim[k].viaTimer) return k;
		return 0;
	};

	const reading = $derived.by(() => {
		if (pointed === null || pointed >= sim.length) return null;
		const i = pointed;
		const h = sim[i];
		const { timer, hits, cap } = params;
		const head = `Hit ${i + 1} · ${h.time.toFixed(2)}s`;
		if (timer === 0) return { head, applies: true, why: 'With no ICD, every hit applies.' };
		const k = windowStart(i);
		const left = fmtS(Math.max(0, sim[k].time + timer - h.time));
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
				why: `Every ${ordinal(hits)} hit applies. The timer from hit ${k + 1} keeps running, with ${left} left.`
			};
		if (h.capped)
			return {
				head,
				applies: false,
				why: `This window's ${cap} ${cap === 1 ? 'application is' : 'applications are'} used up until the timer from hit ${k + 1} runs out, in ${left}.`
			};
		if (hits === Infinity)
			return {
				head,
				applies: false,
				why: `Only the first hit in a window applies. The timer from hit ${k + 1} has ${left} left.`
			};
		return {
			head,
			applies: false,
			why: `The counter is on ${h.count} of ${hits}, and the timer from hit ${k + 1} has ${left} left.`
		};
	});

	// The lanes' names say what each lane is; their tooltips, how to read it
	// (design §6: definitions as tooltips on the chart's labels, no legend).
	const LANES = $derived([
		{
			name: 'Hits',
			y: () => ROW.hitTop + stalk / 2 + 3.5,
			tip: 'A tall stem with the element’s icon applies its element. A short, faint one is blocked by ICD.'
		},
		{
			name: 'Counter',
			y: () => ROW.counterY,
			tip:
				'The hit counter. A ringed number is a hit the counter let through.' +
				(params.cap !== undefined && counting ? ' A dash: the window’s limit is reached.' : '')
		},
		{
			name: 'Timer',
			y: () => ROW.bandTop + ROW.bandH - 3.5,
			tip: 'Each band is a timer window, started by a hit that applies once the timer has run out. Its number is how many hits it applied.'
		}
	]);
</script>

<!-- THE STAGE (design §6, §8). One box: the chart head (the share of hits
     that apply), the setup bar and the chart tools on the chart's top edge,
     three lanes on one time axis (the hits, the counter, the timer windows),
     the interval's handle on that axis with its thumb on hit 2, and the
     pointed hit's reading under it. -->
<div class="stage-root">
	<div class="stage ctx-dark">
		<p class="readout-head stage-head">
			{head.figure}<span class="readout-sentence">{head.sentence}</span>
		</p>

		<div class="icd-body">
			<div class="stage-toolbar">
				<div class="setup-bar" role="group" aria-label="Setup">
					<BandMenu
						role="dialog"
						align="start"
						ariaLabel="String: {example?.label ?? 'Even spacing'}"
					>
						{#snippet face()}
							<span class="setup-key">String</span>
							<span class="setup-val">{example?.label ?? 'Even spacing'}</span>
						{/snippet}
						{#snippet items(close)}
							<div class="setup-pop">
								<div class="icd-picks" role="radiogroup" aria-label="String">
									<button
										class="icd-pick"
										class:is-on={source === 'even'}
										role="radio"
										aria-checked={source === 'even'}
										onclick={() => {
											pickSource('even');
											close();
										}}
									>
										<span class="icd-pick-name">Even spacing</span>
										<span class="icd-pick-detail"
											>Hits at the interval you set under the chart.</span
										>
									</button>
									{#each ICD_EXAMPLES as ex (ex.id)}
										<button
											class="icd-pick"
											class:is-on={source === ex.id}
											role="radio"
											aria-checked={source === ex.id}
											onclick={() => {
												pickSource(ex.id);
												close();
											}}
										>
											<span class="icd-pick-name">{ex.label}</span>
											<span class="icd-pick-detail">{ex.note}</span>
										</button>
									{/each}
								</div>
							</div>
						{/snippet}
					</BandMenu>

					<BandMenu role="dialog" align="start" ariaLabel="ICD: {RULE_NAME[rule]}">
						{#snippet face()}
							<span class="setup-key">ICD</span>
							<span class="setup-val">{RULE_NAME[rule]}</span>
						{/snippet}
						{#snippet items()}
							<div class="setup-pop">
								<p class="icd-pop-note">
									Internal Cooldown — the hidden rule that stops some hits from applying their
									element.
								</p>
								<div class="chips">
									<button
										class="chip chip--control"
										class:active={rule === 'standard'}
										onclick={() => (rule = 'standard')}
									>
										Standard
									</button>
									<button
										class="chip chip--control"
										class:active={rule === 'none'}
										onclick={() => (rule = 'none')}
									>
										No ICD
									</button>
									{#if example}
										<button
											class="chip chip--control"
											class:active={rule === 'own'}
											onclick={() => (rule = 'own')}
										>
											Its own
										</button>
									{/if}
									<button
										class="chip chip--control"
										class:active={rule === 'custom'}
										onclick={pickCustom}
									>
										Custom
									</button>
								</div>
								{#if rule !== 'custom'}
									<p class="icd-pop-note">{ruleText}</p>
								{:else}
									<InstrumentSlider
										label="Timer"
										aria="ICD timer in seconds"
										bind:value={customTimer}
										min={0.5}
										max={10}
										step={0.1}
										unit="s"
										decimals={2}
										snap={toTimer}
									/>
									<!-- The track's last stop is the word: typed, "off" lands there too. -->
									<InstrumentSlider
										label="Hit counter"
										aria="ICD hit counter"
										bind:value={customHits}
										min={1}
										max={COUNTER_OFF}
										step={1}
										snap={Math.round}
										text={customHits === COUNTER_OFF ? 'Off' : null}
										words={{ off: COUNTER_OFF }}
									/>
									<InstrumentSlider
										label="Limit per window"
										aria="Applications allowed per ICD timer window"
										bind:value={customCap}
										min={1}
										max={NO_LIMIT}
										step={1}
										snap={Math.round}
										text={customCap === NO_LIMIT ? 'None' : null}
										words={{ none: NO_LIMIT }}
									/>
								{/if}
							</div>
						{/snippet}
					</BandMenu>
				</div>

				<!-- The chart tools: one group, so they wrap together and hold the
				     toolbar's far end. The element colours the hits and is what a
				     hand-off sends. -->
				<div class="icd-tools">
					<BandMenu glass role="dialog" ariaLabel="Element: {ELEMENT_LABEL[element]}">
						{#snippet face()}
							<img src={elementIcon(element)} alt="" width="16" height="16" />
							<span>{ELEMENT_LABEL[element]}</span>
						{/snippet}
						{#snippet items(close)}
							<div class="icd-elements" role="radiogroup" aria-label="Element">
								{#each ELEMENTS as e (e)}
									<button
										class="chip chip--icon"
										class:active={element === e}
										style:--chip-color="var(--el-{e}-main)"
										role="radio"
										aria-checked={element === e}
										onclick={() => {
											element = e;
											close();
										}}
										aria-label={ELEMENT_LABEL[e]}
										title={ELEMENT_LABEL[e]}
									>
										<img src={elementIcon(e)} alt="" width="16" height="16" />
									</button>
								{/each}
							</div>
						{/snippet}
					</BandMenu>

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
				style:--graph-min="{H_MIN}px"
				style:max-height="{STALK * STALK_GROW + FIXED}px"
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
							y1={ROW.hitTop - 4}
							x2={xOf(s)}
							y2={ROW.axisY}
							stroke="var(--chart-grid)"
						/>
						<text
							x={xOf(s)}
							y={ROW.axisY + 14}
							fill="var(--chart-ink)"
							font-size="10"
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
							x={PADL - 10}
							y={lane.y()}
							fill="var(--chart-dim)"
							font-size="10"
							text-anchor="end"
						>
							{lane.name}<title>{lane.tip}</title>
						</text>
					{/each}

					<!-- The pointed hit's column -->
					{#if pointed !== null && xs[pointed] !== undefined}
						<line
							x1={xs[pointed]}
							y1={ROW.hitTop - 4}
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
							rx="2"
							fill={el}
							fill-opacity="0.22"
						/>
						<line
							x1={w.x0}
							y1={ROW.bandTop - 1}
							x2={w.x0}
							y2={ROW.bandTop + ROW.bandH + 1}
							stroke={el}
							stroke-width="2"
							stroke-opacity="0.75"
						/>
						{#if w.count !== null && w.w >= BAND_DIGIT}
							<text
								class="stage-word"
								x={w.x0 + 5}
								y={ROW.bandTop + ROW.bandH - 3.5}
								fill="var(--text)"
								font-size="10"
							>
								{w.w >= BAND_WORDS ? `${w.count} applied` : w.count}
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
								stroke-width="2.5"
							/>
							<image
								href={elementIcon(element)}
								x={x - 8}
								y={ROW.hitTop - 20}
								width="16"
								height="16"
							/>
						{:else}
							<line
								x1={x}
								y1={ROW.hitTop + stalk * BLOCKED_DROP}
								x2={x}
								y2={ROW.hitBottom}
								stroke={el}
								stroke-opacity={BLOCKED_ALPHA}
								stroke-width="1.5"
							/>
						{/if}
						{#if h.applies && !h.viaTimer}
							<circle
								cx={x}
								cy={ROW.counterY - 3.5}
								r="7"
								fill="none"
								stroke={el}
								stroke-width="1.25"
							/>
						{/if}
						<text
							{x}
							y={ROW.counterY}
							fill={h.applies ? el : 'var(--chart-dim)'}
							font-size="10"
							font-weight={h.applies ? 700 : 400}
							text-anchor="middle"
						>
							{counterText(i)}
						</text>
					{/each}
				</svg>
			</div>

			<!-- THE HANDLE (design §6): the interval is a time, so its track runs
			     the time axis from its least to its most, and the thumb sits on
			     hit 2. The axis is the rule's (icdTimeline.ts `evenSpan`), so it
			     holds still under the drag. An example has no handle: its hits
			     are gcsim's. -->
			{#if !example}
				<div class="icd-handle-row">
					<div
						class="stage-handle icd-handle"
						style:--stage-handle-l="{xOf(INTERVAL_MIN) - THUMB_R}px"
						style:--stage-handle-r="{graphW - xOf(INTERVAL_MAX) - THUMB_R}px"
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
						/>
					</div>
					<div class="chips icd-anchors">
						{#each ANCHORS as a (a.v)}
							<button
								class="chip chip--control"
								class:active={interval === a.v}
								onclick={() => (interval = a.v)}
							>
								{a.label}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- The pointed hit's reading. ⚓ Two lines reserved, so pointing
			     never moves what's under it (design §4). -->
			<div class="icd-reading" aria-live="polite">
				{#if reading}
					<p>
						<span class="icd-reading-head">{reading.head}</span>
						<strong>{reading.applies ? 'applies' : 'blocked'}</strong>. {reading.why}
					</p>
				{:else}
					<p>Point at a hit to read why it applies or is blocked.</p>
				{/if}
			</div>

			{#if example}
				<p class="stage-fine">{example.note}</p>
			{/if}
		</div>
	</div>
</div>

<style>
	/* The toolbar, the lanes, the handle and the reading are one group, and
	   it centres in the room under the headline once the stalks stop growing
	   (the graph's max-height, STALK_GROW). Narrow, the stage is its natural
	   height and there is nothing to centre in. */
	.icd-body {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		justify-content: center;
		gap: var(--inst-gap-control);
		min-height: 0;
	}

	.icd-lane {
		cursor: help;
	}

	/* ── The toolbar's far end ─────────────────────────────────────────────── */

	.icd-tools {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-left: auto;
	}

	.icd-tools :global(.band-menu-trigger) {
		gap: 0.4rem;
	}

	.icd-send {
		gap: 0.4rem;
	}

	.icd-elements {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		padding: 0.5rem;
	}

	/* ── The String segment's list: a row per string, its note under it ────── */

	.icd-picks {
		display: grid;
		gap: 0.15rem;
	}

	.icd-pick {
		display: grid;
		gap: 0.1rem;
		padding: 0.3rem 0.5rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	@media (hover: hover) {
		.icd-pick:hover {
			background: color-mix(in srgb, var(--text) 7%, transparent);
		}
	}

	.icd-pick.is-on {
		background: color-mix(in srgb, var(--text) 12%, transparent);
	}

	.icd-pick:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.icd-pick-name {
		font-weight: var(--fw-semibold);
	}

	.icd-pick-detail {
		font-size: var(--fs-sm);
		line-height: var(--lh-snug);
		color: var(--muted);
	}

	.icd-pop-note {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--lh-snug);
		color: var(--muted);
	}

	/* ── The handle and its anchors ────────────────────────────────────────── */

	/* The anchors sit at the row's far end, level with the handle's name and
	   field, in the room the track leaves; on a narrow tile they wrap under. */
	.icd-handle-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.5rem 1rem;
	}

	/* The track's width is the axis's, so the handle takes the row's width;
	   its name and field may run past a short track without widening it. */
	.icd-handle {
		flex: 1 0 100%;
	}

	.icd-handle :global(.slider-control) {
		grid-template-columns: minmax(0, 1fr);
	}

	.icd-handle :global(.slider-header) {
		white-space: nowrap;
	}

	.icd-anchors {
		margin-left: auto;
		padding-right: 16px;
	}

	.icd-anchors :global(.chip) {
		font-family: var(--font-condensed);
		text-transform: none;
		letter-spacing: var(--ls-mid);
	}

	/* Wide enough, the anchors share the handle's name line, at its end. */
	@container instrument (min-width: 44rem) {
		.icd-handle-row {
			position: relative;
		}
		.icd-anchors {
			position: absolute;
			right: 0;
			bottom: 0;
			margin: 0;
		}
	}

	/* ── The reading ───────────────────────────────────────────────────────── */

	.icd-reading {
		min-height: calc(2 * var(--lh-snug) * var(--fs-md));
	}

	.icd-reading p {
		margin: 0;
		font-size: var(--fs-md);
		line-height: var(--lh-snug);
		color: var(--chart-ink);
	}

	.icd-reading-head {
		font-variant-numeric: tabular-nums;
	}

	.icd-reading strong {
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
</style>
