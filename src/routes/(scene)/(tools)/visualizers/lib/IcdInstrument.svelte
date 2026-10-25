<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { ELEMENT_LABEL } from '$lib/utils/auraDisplay';
	import Mark from '$lib/components/Mark.svelte';
	import {
		simulateIcd,
		uniformHitTimes,
		STANDARD_ICD,
		NO_ICD,
		type IcdHit,
		type IcdParams
	} from '$lib/utils/icd';
	import { icdHitsToGaugeApps, type HandoffMessage } from './workspace';
	import { ICD_EXAMPLES, type IcdExampleId } from './icdExamples';

	const ELEMENTS = ['pyro', 'hydro', 'anemo', 'electro', 'cryo', 'geo', 'dendro'] as const;
	type ElementId = (typeof ELEMENTS)[number];
	/** Where the hits come from: an even string drawn by the sliders, or an example. */
	type Source = 'even' | IcdExampleId;
	/** `own` is the example's own group, offered only while an example is loaded. */
	type Rule = 'standard' | 'none' | 'own' | 'custom';

	// Workspace handoff outlet — present only when a workspace hosts us
	let { onHandoff }: { onHandoff?: (msg: HandoffMessage) => void } = $props();

	// ── The hits ──────────────────────────────────────────────────────────────
	let source = $state<Source>('even');
	let interval = $state(0.5);
	let hitCount = $state(12);

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
		hitCount = 12;
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
	// The even string's sliders and the Custom rule's ride along even while an
	// example or another rule is on screen: going back to them shows what was set.
	export function getShareState() {
		return {
			v: 1,
			source,
			interval,
			hits: hitCount,
			rule,
			custom: [customTimer, customHits, customCap],
			element
		};
	}

	export function applyShareState(state: unknown) {
		if (typeof state !== 'object' || state === null) return;
		const s = state as Record<string, unknown>;
		if (s.v !== 1) return;
		// Clamped to the slider's range and snapped to its step, `per` steps to
		// the unit — dividing by it keeps 0.45 from coming back as 0.45000000000000007
		const num = (v: unknown, lo: number, hi: number, per = 1) =>
			typeof v === 'number' && Number.isFinite(v)
				? Math.round(Math.min(hi, Math.max(lo, v)) * per) / per
				: undefined;
		reset();
		// an example brings its own rule and element, as picking it does
		if (s.source === 'even' || ICD_EXAMPLES.some((e) => e.id === s.source))
			pickSource(s.source as Source);
		interval = num(s.interval, 0.1, 3, 20) ?? interval;
		hitCount = num(s.hits, 5, 30) ?? hitCount;
		if (Array.isArray(s.custom)) {
			customTimer = num(s.custom[0], 0.5, 10, 10) ?? customTimer;
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

	const times = $derived(example ? example.hits : uniformHitTimes(hitCount, interval));
	const sim = $derived(simulateIcd(times, params));
	const apps = $derived(sim.filter((h) => h.applies).length);

	// ── The rule in words ────────────────────────────────────────────────────
	const ordinal = (n: number) => (n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
	const fmtS = (s: number) => `${+s.toFixed(2)}s`;

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

	// ── Windows: a timer window opens on each timer-driven application ───────
	// ⚓ PER WINDOW, not per second (worksheet 02 → the pass). A rate averaged
	// over the string on screen moved with the Hits slider — the first hit always
	// applies — while "2 in every 2.5s window" is the mechanic itself.
	const windowCounts = $derived.by(() => {
		if (params.timer === 0) return [];
		const starts = sim.flatMap((h, i) => (h.viaTimer ? [i] : []));
		const counts = starts.map((s, k) => {
			const end = k + 1 < starts.length ? starts[k + 1] : sim.length;
			return sim.slice(s, end).filter((h) => h.applies).length;
		});
		// An even string is cut off wherever the slider says, so its last window
		// may be partial — drop it unless it is the only one. An example's list
		// is the whole story, so every window counts.
		return !example && counts.length > 1 ? counts.slice(0, -1) : counts;
	});
	const perWindow = $derived.by(() => {
		if (windowCounts.length === 0) return null;
		const lo = Math.min(...windowCounts);
		const hi = Math.max(...windowCounts);
		return { text: lo === hi ? `${lo}` : `${lo}–${hi}`, one: hi === 1 };
	});

	// ── Graph geometry — pixel-true (width measured, not viewBox-scaled) ──────
	let graphW = $state(720);
	let graphH = $state(0);
	const M = { left: 16, right: 16, top: 22 };
	/**
	 * ⚓ THE STALKS GROW, AND ONLY A LITTLE (2026-10-06, ⚓ Nate). Given a taller
	 * box the hits lengthen — everything above and below them keeps its size —
	 * up to STALK_GROW × their natural length; past that the strip and its key
	 * centre in the space and the rest is bare scene. A one-row strip has no
	 * vertical scale to fill, so a taller one only says the same thing louder.
	 */
	const STALK = 50;
	const STALK_GROW = 2; // 🎛️
	const H_MIN = 146;
	const stalk = $derived(Math.min(STALK * STALK_GROW, STALK + Math.max(0, graphH - H_MIN)));
	const H = $derived(H_MIN + stalk - STALK);
	const ROW = $derived({
		hitTop: 46,
		hitBottom: 46 + stalk,
		counterY: 64 + stalk,
		bandTop: 74 + stalk,
		bandH: 10
	});
	/** A blocked hit's tick starts this far down its stalk — short at any length. */
	const BLOCKED_DROP = 18 / STALK;

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
	// chart. An even string keeps a 3s floor so the standard window shows whole.
	const domain = $derived(
		example
			? lastHit + Math.min(gap, 1)
			: Math.max(lastHit + interval, params.timer > 0 ? params.timer + 0.5 : 0, 3)
	);
	const plotW = $derived(graphW - M.left - M.right);
	const xOf = $derived((t: number) => M.left + (t / domain) * plotW);

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

	const el = $derived(`var(--el-${element}-main)`);
	// ⚓ A blocked hit is still an ELEMENTAL hit (⚓ Nate, 2026-10-04) — it lands,
	// it just applies nothing — so it wears the element too, kept short, thin and
	// faint. Alpha in the paint, never element opacity (sub-pixel laws).
	// 🎛️ .5: clearly the element, clearly not an application.
	const BLOCKED_ALPHA = 0.5;
	const anyCounterApp = $derived(sim.some((h) => h.applies && !h.viaTimer));
	const anyCapped = $derived(sim.some((h) => h.capped));
	const showCount = (h: IcdHit) => !h.capped && params.hits !== Infinity && params.timer > 0;

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
</script>

<div class="instrument">
	<!-- Hit timeline: which hits actually apply their element -->
	<div class="icd-chart instrument-chart ctx-dark">
		<div
			class="icd-graph instrument-graph"
			style:--graph-min="{H_MIN}px"
			style:max-height="{H_MIN + STALK * (STALK_GROW - 1)}px"
			bind:clientWidth={graphW}
			bind:clientHeight={graphH}
		>
			<svg
				width={graphW}
				height={H}
				role="img"
				aria-label="ICD hit timeline"
				onpointermove={pointAt}
				onpointerdown={pointAt}
				onpointerleave={(e) => {
					if (e.pointerType === 'mouse') pointed = null;
				}}
			>
				<!-- Time grid -->
				{#each ticks as s (s)}
					<line
						x1={xOf(s)}
						y1={M.top}
						x2={xOf(s)}
						y2={ROW.bandTop + ROW.bandH + 6}
						stroke="var(--chart-grid)"
					/>
					<text
						x={xOf(s)}
						y={M.top - 8}
						fill="var(--chart-ink)"
						font-size="10"
						text-anchor="middle"
					>
						{fmtS(s)}
					</text>
				{/each}

				<!-- The pointed hit's column -->
				{#if pointed !== null && xs[pointed] !== undefined}
					<line
						x1={xs[pointed]}
						y1={M.top}
						x2={xs[pointed]}
						y2={ROW.bandTop + ROW.bandH + 6}
						stroke="var(--chart-ink)"
						stroke-dasharray="3 3"
					/>
				{/if}

				<!-- ICD timer windows (each starts on a timer-driven application) -->
				{#if params.timer > 0}
					{#each sim as h, i (i)}
						{#if h.viaTimer}
							<!-- 2px end gap + bright start notch keep contiguous windows readable -->
							<rect
								x={xOf(h.time)}
								y={ROW.bandTop}
								width={Math.max(2, xOf(Math.min(h.time + params.timer, domain)) - xOf(h.time) - 2)}
								height={ROW.bandH}
								rx="2"
								fill={el}
								fill-opacity="0.22"
							/>
							<line
								x1={xOf(h.time)}
								y1={ROW.bandTop - 1}
								x2={xOf(h.time)}
								y2={ROW.bandTop + ROW.bandH + 1}
								stroke={el}
								stroke-width="2"
								stroke-opacity="0.75"
							/>
						{/if}
					{/each}
				{/if}

				<!-- Baseline -->
				<line
					x1={M.left}
					y1={ROW.hitBottom}
					x2={graphW - M.right}
					y2={ROW.hitBottom}
					stroke="var(--chart-grid)"
				/>

				<!-- Hits: an applying hit wears the element; a blocked one is a short,
				     faint tick of the same element. Under each, its counter — ringed when the counter is what
				     let it apply, a dash once the window's applications are spent. -->
				{#each sim as h, i (i)}
					{@const x = xs[i]}
					{#if h.applies}
						<line x1={x} y1={ROW.hitTop} x2={x} y2={ROW.hitBottom} stroke={el} stroke-width="2.5" />
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
						{showCount(h) ? h.count : '–'}
					</text>
				{/each}
			</svg>
		</div>

		<!-- ⚓ The key is HTML so it wraps; the SVG legend sat at fixed offsets and
		     needed ~470px. The element swatches close the row: the strip that
		     explains the colours is where you change them. -->
		<div class="icd-key">
			<ul class="icd-legend">
				<li>
					<img src={elementIcon(element)} alt="" width="12" height="12" />
					applies element
				</li>
				<li><span class="icd-sw-blocked" style:--sw={el}></span>blocked hit</li>
				{#if params.timer > 0 && params.hits !== Infinity}
					<li><span class="icd-sw-digits">1 2 3</span>hit counter</li>
				{/if}
				{#if anyCounterApp}
					<li>
						<span class="icd-sw-ring" style:--sw={el}>1</span>applied by the counter
					</li>
				{/if}
				{#if anyCapped}
					<li><span class="icd-sw-digits">–</span>window limit reached</li>
				{/if}
				{#if params.timer > 0}
					<li><span class="icd-sw-band" style:--sw={el}></span>ICD timer window</li>
				{/if}
			</ul>
			<div class="icd-elements">
				{#each ELEMENTS as e (e)}
					<button
						class="chip chip--icon icd-el"
						class:active={element === e}
						style:--chip-color="var(--el-{e}-main)"
						onclick={() => (element = e)}
						aria-label={ELEMENT_LABEL[e]}
						title={ELEMENT_LABEL[e]}
					>
						<img src={elementIcon(e)} alt="" width="16" height="16" />
					</button>
				{/each}
			</div>
		</div>
	</div>

	<div class="icd-panels panels instrument-controls">
		<div class="panel">
			<p class="kicker">Attack string</p>
			<div class="chips">
				<button
					class="chip chip--control"
					class:active={source === 'even'}
					onclick={() => pickSource('even')}
				>
					Even spacing
				</button>
				{#each ICD_EXAMPLES as ex (ex.id)}
					<button
						class="chip chip--control"
						class:active={source === ex.id}
						onclick={() => pickSource(ex.id)}
					>
						{ex.label}
					</button>
				{/each}
			</div>
			{#if example}
				<p class="note">{example.note}</p>
			{:else}
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Hit interval</span>
						<span class="readout">{interval.toFixed(2)}s</span>
					</div>
					<input
						type="range"
						min="0.1"
						max="3"
						step="0.05"
						bind:value={interval}
						class="slider"
						aria-label="Hit interval in seconds"
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
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Hits</span>
						<span class="readout">{hitCount}</span>
					</div>
					<input
						type="range"
						min="5"
						max="30"
						step="1"
						bind:value={hitCount}
						class="slider"
						aria-label="Number of hits"
					/>
				</div>
			{/if}
		</div>

		<div class="panel">
			<p class="kicker">ICD rule</p>
			<p class="note">
				Internal Cooldown — the hidden rule that stops some hits from applying their element.
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
				<button class="chip chip--control" class:active={rule === 'custom'} onclick={pickCustom}>
					Custom
				</button>
			</div>
			{#if rule !== 'custom'}
				<p class="note">{ruleText}</p>
			{:else}
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Timer</span>
						<span class="readout">{customTimer.toFixed(1)}s</span>
					</div>
					<input
						type="range"
						min="0.5"
						max="10"
						step="0.1"
						bind:value={customTimer}
						class="slider"
						aria-label="ICD timer in seconds"
					/>
				</div>
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Hit counter</span>
						<span class="readout">{customHits === COUNTER_OFF ? 'Off' : customHits}</span>
					</div>
					<input
						type="range"
						min="1"
						max={COUNTER_OFF}
						step="1"
						bind:value={customHits}
						class="slider"
						aria-label="ICD hit counter"
					/>
				</div>
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Limit per window</span>
						<span class="readout">{customCap === NO_LIMIT ? 'None' : customCap}</span>
					</div>
					<input
						type="range"
						min="1"
						max={NO_LIMIT}
						step="1"
						bind:value={customCap}
						class="slider"
						aria-label="Applications allowed per ICD timer window"
					/>
				</div>
			{/if}
		</div>
	</div>

	<div class="panel panel--paper icd-readout instrument-readout">
		<p class="kicker">Readout</p>
		<p class="icd-big">
			{apps}<span class="icd-big-unit">
				of {sim.length}
				{sim.length === 1 ? 'hit applies' : 'hits apply'}</span
			>
		</p>
		{#if perWindow}
			<p class="icd-meta">
				<span class="icd-strong">{perWindow.text}</span>
				{perWindow.one ? 'application' : 'applications'} in each {fmtS(params.timer)} window
			</p>
		{/if}

		<!-- ⚓ Stacked in one grid cell so pointing never moves the card -->
		<div class="icd-reading">
			{#if reading}
				<div>
					<p class="icd-reading-head">
						{reading.head}
						<span class="icd-strong">{reading.applies ? 'applies' : 'blocked'}</span>
					</p>
					<p class="icd-reading-why">{reading.why}</p>
				</div>
			{:else}
				<p class="note">Point at a hit to read why it applies or is blocked.</p>
			{/if}
		</div>

		{#if onHandoff}
			<button
				class="btn btn--primary icd-send"
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

<style>
	/* ⚓ NO FRAME — the chart draws on the night (see .frame's retirement note in
	   app.css). The ground, the radius and the inset padding all left together;
	   .ctx-dark stays CLAIMED, because at TOOL_DIM the crest is a dark ground and
	   --chart-* still needs --frame-bg as its notional reference. */
	/* The strip and its key keep together and centre in what the strip
	   can't use (see STALK_GROW) */
	.icd-chart {
		justify-content: center;
	}

	.icd-graph svg {
		display: block;
		touch-action: pan-y;
	}

	.icd-graph text {
		font-family: var(--font-body);
	}

	/* ── The key: legend, then the element swatches ────────────────────────── */

	.icd-key {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1.25rem;
		margin-top: 0.25rem;
		padding-inline: 16px;
	}

	.icd-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--fs-xs);
		color: var(--chart-ink);
	}

	.icd-legend li {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.icd-sw-blocked {
		width: 1.5px;
		height: 10px;
		background: color-mix(in srgb, var(--sw) 50%, transparent);
	}

	.icd-sw-digits {
		color: var(--chart-dim);
	}

	.icd-sw-ring {
		display: inline-grid;
		place-items: center;
		width: 14px;
		height: 14px;
		border: 1.25px solid var(--sw);
		border-radius: 50%;
		color: var(--sw);
		font-weight: var(--fw-bold);
		line-height: 1;
	}

	.icd-sw-band {
		width: 18px;
		height: 10px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--sw) 22%, transparent);
	}

	.icd-elements {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	/* ── Readout ───────────────────────────────────────────────────────────── */

	.icd-big {
		margin: 0;
		font-family: var(--font-body);
		font-size: var(--fs-5xl);
		font-weight: var(--fw-bold);
		line-height: var(--lh-tight);
	}

	.icd-big-unit {
		margin-left: 0.4rem;
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}

	.icd-meta {
		margin: 0;
		font-size: var(--fs-xl);
		line-height: 1.5rem;
		color: var(--muted);
	}

	.icd-strong {
		font-family: var(--font-body);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	/* One cell, so a reading of two lines and the one-line hint take the same
	   place and the button under them never jumps. */
	.icd-reading {
		display: grid;
		min-height: 4.5rem;
		margin-top: 0.5rem;
		align-content: start;
	}

	.icd-reading p {
		margin: 0;
	}

	.icd-reading-head {
		font-size: var(--fs-lg);
		color: var(--muted);
	}

	.icd-reading-why {
		font-size: var(--fs-lg);
		line-height: 1.35;
		color: var(--muted);
	}

	/* .btn--primary; only its placement in the grid is local. */
	.icd-send {
		justify-self: start;
		margin-top: 0.35rem;
	}

	.icd-anchors :global(.chip) {
		font-family: var(--font-condensed);
		text-transform: none;
		letter-spacing: var(--ls-mid);
	}
</style>
