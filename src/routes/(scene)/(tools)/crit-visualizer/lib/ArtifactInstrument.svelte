<script lang="ts">
	import {
		SLOTS,
		SOURCES,
		SUBSTATS,
		substatPool,
		substatById,
		presenceProbability,
		pairRollDist,
		reshapeDist,
		cvDistribution,
		cvDistributionMinPairRolls,
		ELIXIR_MIN_PAIR_ROLLS,
		distStats,
		rollEvents,
		binomialDist,
		type SlotId,
		type MainStatId,
		type SubstatId,
		type SourceId
	} from './artifactRolls';
	import {
		inferRollCounts,
		resolvePiece,
		rvDistribution,
		percentileOf,
		possibleValues
	} from './appraise';
	import ValueWheel from './ValueWheel.svelte';

	type View = 'fresh' | 'upgrade' | 'reshape' | 'appraise';

	// ── State ──────────────────────────────────────────────────────────────
	// Default: the canonical case — a flower hunting double crit
	let slotId = $state<SlotId>('flower');
	let mainId = $state<MainStatId>('hp');
	let pair = $state<SubstatId[]>(['cr', 'cd']);
	let source = $state<SourceId>('domain');
	let view = $state<View>('fresh');
	let fourLine = $state(true);
	let guarantee = $state(2);
	// Upgrade view: Sanctifying Elixir mode — the crafted pair is guaranteed
	// ≥2 of the upgrade rolls (5.5 buff), modeled as conditional redistribution
	let crafted = $state(false);
	let currentRolls = $state(2);

	const slot = $derived(SLOTS.find((s) => s.id === slotId)!);
	const main = $derived(slot.mains.find((m) => m.id === mainId) ?? slot.mains[0]);
	const pool = $derived(substatPool(main.id));

	function pickSlot(id: SlotId) {
		slotId = id;
		const s = SLOTS.find((x) => x.id === id)!;
		if (!s.mains.some((m) => m.id === mainId)) mainId = s.mains[0].id;
		fixPair();
	}

	function pickMain(id: MainStatId) {
		mainId = id;
		fixPair();
	}

	// The pair must live in the pool; refill from crit-first defaults if the
	// main stat swallowed one of them
	function fixPair() {
		let next = pair.filter((p) => p !== mainId);
		for (const candidate of ['cr', 'cd', 'atkPct', 'er'] as SubstatId[]) {
			if (next.length >= 2) break;
			if (candidate !== mainId && !next.includes(candidate)) next = [...next, candidate];
		}
		pair = next;
	}

	// Click: deselect if selected; otherwise select, displacing the oldest
	function togglePairStat(id: SubstatId) {
		if (pair.includes(id)) {
			if (pair.length > 1) pair = pair.filter((p) => p !== id);
		} else {
			pair = [...pair, id].slice(-2);
		}
	}

	// ── Derived probabilities ──────────────────────────────────────────────
	const pairValid = $derived(pair.length === 2);
	const pairLabel = $derived(pair.map((p) => substatById(p).short).join(' + '));

	const src = $derived(SOURCES.find((s) => s.id === source)!);
	const p3 = $derived(pairValid ? presenceProbability(pool, pair, 3) : 0);
	const p4 = $derived(pairValid ? presenceProbability(pool, pair, 4) : 0);
	const pAtDrop = $derived(source === 'elixir' ? 1 : (1 - src.fourLine) * p3 + src.fourLine * p4);
	const pWithMain = $derived(main.chance * p4);

	const events = $derived(rollEvents(fourLine));
	const isCritPair = $derived(pair.includes('cr') && pair.includes('cd') && pairValid);
	const rollDist = $derived(pairRollDist(events));
	// The distribution the Upgrade view charts: crafted pieces condition on
	// the Elixir's ≥2-roll guarantee
	const upgradeDist = $derived(crafted ? reshapeDist(events, ELIXIR_MIN_PAIR_ROLLS) : rollDist);
	const cvDist = $derived(
		isCritPair
			? crafted
				? cvDistributionMinPairRolls(events, ELIXIR_MIN_PAIR_ROLLS)
				: cvDistribution(events)
			: null
	);
	const cvStats = $derived(cvDist ? distStats(cvDist) : null);

	// 1-CV display bins for the histogram (the exact support is much finer)
	const cvBins = $derived.by(() => {
		if (!cvDist) return [];
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient bin accumulator, drained to a plain array below; never reactive state
		const map = new Map<number, number>();
		for (const d of cvDist) {
			const bin = Math.floor(d.cv);
			map.set(bin, (map.get(bin) ?? 0) + d.p);
		}
		return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([cv, p]) => ({ cv, p }));
	});

	const effGuarantee = $derived(Math.min(guarantee, events));
	const reshaped = $derived(reshapeDist(events, effGuarantee));
	const clampedCurrent = $derived(Math.min(currentRolls, events));
	const pBetter = $derived(reshaped.reduce((acc, p, k) => (k > clampedCurrent ? acc + p : acc), 0));
	const pSame = $derived(reshaped[clampedCurrent] ?? 0);
	const pWorse = $derived(Math.max(0, 1 - pBetter - pSame));

	// ── Appraise: a real +20 piece, value-entered ──────────────────────────
	// Demo piece prefilled so the view teaches itself.
	let appraiseLines = $state<{ id: SubstatId; raw: string }[]>([
		{ id: 'cr', raw: '6.6' },
		{ id: 'cd', raw: '21.0' },
		{ id: 'atkPct', raw: '9.9' },
		{ id: 'er', raw: '5.2' }
	]);
	let resolutionPick = $state(0);

	const lineInferences = $derived(
		appraiseLines.map((l) => {
			const v = Number(l.raw);
			if (l.id === main.id || !Number.isFinite(v) || l.raw.trim() === '') return [];
			return inferRollCounts(l.id, v);
		})
	);
	const resolutions = $derived(resolvePiece(lineInferences));
	const resolution = $derived(
		resolutions.length ? resolutions[Math.min(resolutionPick, resolutions.length - 1)] : null
	);

	// Rolls into the target pair (upgrade rolls only, initial excluded)
	const apLinesInPair = $derived(
		pair.filter((p) => appraiseLines.some((l) => l.id === p)).length as 0 | 1 | 2
	);
	const apRollsIntoPair = $derived(
		resolution
			? appraiseLines.reduce(
					(acc, l, i) => acc + (pair.includes(l.id) ? resolution.counts[i] - 1 : 0),
					0
				)
			: 0
	);
	const apRollDist = $derived(
		resolution && apLinesInPair > 0 ? binomialDist(resolution.events, apLinesInPair / 4) : null
	);
	const apRollTail = $derived(
		apRollDist ? apRollDist.reduce((acc, p, k) => (k >= apRollsIntoPair ? acc + p : acc), 0) : 0
	);

	// Value luck: exact CV distribution for the crit pair, stat-agnostic RV else
	const apUseCv = $derived(isCritPair && apLinesInPair === 2);
	const apValueDist = $derived.by(() => {
		if (!resolution || apLinesInPair === 0) return null;
		if (apUseCv) return cvDistribution(resolution.events).map((d) => ({ x: d.cv, p: d.p }));
		return rvDistribution(resolution.events, apLinesInPair as 1 | 2).map((d) => ({
			x: d.rv,
			p: d.p
		}));
	});
	const apPieceValue = $derived.by(() => {
		if (!resolution) return 0;
		if (apUseCv) {
			return appraiseLines.reduce((acc, l) => {
				if (l.id === 'cr') return acc + 2 * Number(l.raw);
				if (l.id === 'cd') return acc + Number(l.raw);
				return acc;
			}, 0);
		}
		return appraiseLines.reduce((acc, l, i) => {
			if (!pair.includes(l.id) || !resolution) return acc;
			const inf = lineInferences[i].find((c) => c.count === resolution.counts[i]);
			return inf ? acc + (inf.rvMin + inf.rvMax) / 2 : acc;
		}, 0);
	});
	const apPercentile = $derived(apValueDist ? percentileOf(apValueDist, 'x', apPieceValue) : 0);
	const apLineSetOdds = $derived(
		resolution
			? presenceProbability(
					pool,
					appraiseLines.map((l) => l.id),
					4
				)
			: 0
	);

	// Histogram bins (1 CV or 10 RV wide) + marker scale
	const apBinW = $derived(apUseCv ? 1 : 10);
	const apBins = $derived.by(() => {
		if (!apValueDist) return [];
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient bin accumulator, drained to a plain array below; never reactive state
		const map = new Map<number, number>();
		for (const d of apValueDist) {
			const b = Math.floor(d.x / apBinW) * apBinW;
			map.set(b, (map.get(b) ?? 0) + d.p);
		}
		return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([x, p]) => ({ x, p }));
	});
	const apMaxBin = $derived(apBins.length ? Math.max(...apBins.map((b) => b.p)) : 1);
	const apX0 = $derived(apBins[0]?.x ?? 0);
	const apX1 = $derived((apBins[apBins.length - 1]?.x ?? 1) + apBinW);
	const apXOf = $derived((x: number) => M.left + ((x - apX0) / (apX1 - apX0)) * plotW);

	// The reshape slider follows an appraised piece (still manually adjustable)
	$effect(() => {
		if (resolution && apLinesInPair > 0) currentRolls = apRollsIntoPair;
	});

	// Reshape readout can say where its "current rolls" number came from
	const reshapeFromAppraisal = $derived(
		resolution !== null && apLinesInPair > 0 && clampedCurrent === apRollsIntoPair
	);

	const fmtLineValue = (id: SubstatId, n: number) =>
		substatById(id).isPct ? n.toFixed(1) : String(n);

	// Wheel options per line: exactly the values the game can display
	const lineOptions = $derived(
		appraiseLines.map((l) => possibleValues(l.id).map((n) => fmtLineValue(l.id, n)))
	);

	// Changing a line's stat snaps its value to the nearest legal one
	function setLineStat(index: number, id: SubstatId) {
		const options = possibleValues(id);
		const current = Number(appraiseLines[index].raw);
		const nearest = Number.isFinite(current)
			? options.reduce((a, b) => (Math.abs(b - current) < Math.abs(a - current) ? b : a))
			: options[Math.floor(options.length / 3)];
		appraiseLines = appraiseLines.map((l, i) =>
			i === index ? { id, raw: fmtLineValue(id, nearest) } : l
		);
	}

	// ── Graph geometry ─────────────────────────────────────────────────────
	let graphW = $state(720);
	const H = 240;
	const M = { left: 40, right: 16, top: 18, bottom: 34 };
	const plotH = H - M.top - M.bottom;
	const plotW = $derived(graphW - M.left - M.right);

	// Fresh-drop ladder rows
	const ladderRows = $derived.by(() => {
		if (!pairValid) return [];
		if (source === 'elixir') return [{ label: 'Both at craft — you choose them', p: 1 }];
		const rows = [
			{ label: `Both at drop (${src.name.toLowerCase()})`, p: pAtDrop },
			{ label: 'Both once 4 lines exist', p: p4 }
		];
		if (slot.mains.length > 1) rows.push({ label: `…and ${main.name} main`, p: pWithMain });
		return rows;
	});
	const ladderMax = $derived(Math.max(...ladderRows.map((r) => r.p), 1e-9));

	// CV histogram scales
	const cvMaxBin = $derived(cvBins.length ? Math.max(...cvBins.map((b) => b.p)) : 1);
	const cvX0 = $derived(cvBins[0]?.cv ?? 0);
	const cvX1 = $derived((cvBins[cvBins.length - 1]?.cv ?? 1) + 1);
	const cvXOf = $derived((cv: number) => M.left + ((cv - cvX0) / (cvX1 - cvX0)) * plotW);

	// Discrete roll-count bars (upgrade: plain; reshape: conditioned over ghost)
	const barsDist = $derived(view === 'upgrade' ? upgradeDist : reshaped);
	const barsGhost = $derived(
		view === 'reshape' || (view === 'upgrade' && crafted) ? rollDist : null
	);
	const barsMax = $derived(Math.max(...barsDist, ...(barsGhost ?? [])));
	const band = $derived(plotW / barsDist.length);

	const fmtPct = (p: number, digits = 1) => `${(p * 100).toFixed(digits)}%`;
	const oneIn = (p: number) => (p > 0 ? Math.round(1 / p).toLocaleString() : '—');

	// ── Workspace handle (share + reset) ───────────────────────────────────
	const VIEWS: View[] = ['fresh', 'upgrade', 'reshape', 'appraise'];

	export function reset() {
		slotId = 'flower';
		mainId = 'hp';
		pair = ['cr', 'cd'];
		source = 'domain';
		view = 'fresh';
		fourLine = true;
		guarantee = 2;
		currentRolls = 2;
		crafted = false;
		appraiseLines = [
			{ id: 'cr', raw: '6.6' },
			{ id: 'cd', raw: '21.0' },
			{ id: 'atkPct', raw: '9.9' },
			{ id: 'er', raw: '5.2' }
		];
		resolutionPick = 0;
	}

	export function getShareState() {
		return {
			v: 1,
			view,
			slot: slotId,
			main: mainId,
			pair,
			source,
			fourLine,
			guarantee,
			crafted,
			lines: appraiseLines.map((l) => [l.id, l.raw])
		};
	}

	export function applyShareState(state: unknown) {
		if (typeof state !== 'object' || state === null) return;
		const s = state as Record<string, unknown>;
		if (s.v !== 1) return;
		if (typeof s.slot === 'string' && SLOTS.some((x) => x.id === s.slot)) slotId = s.slot as SlotId;
		const sl = SLOTS.find((x) => x.id === slotId)!;
		if (typeof s.main === 'string' && sl.mains.some((m) => m.id === s.main))
			mainId = s.main as MainStatId;
		else if (!sl.mains.some((m) => m.id === mainId)) mainId = sl.mains[0].id;
		if (Array.isArray(s.pair)) {
			const p = s.pair.filter(
				(x): x is SubstatId =>
					typeof x === 'string' && x !== mainId && SUBSTATS.some((ss) => ss.id === x)
			);
			if (p.length === 2 && p[0] !== p[1]) pair = p;
		}
		fixPair();
		if (typeof s.source === 'string' && SOURCES.some((x) => x.id === s.source))
			source = s.source as SourceId;
		if (typeof s.fourLine === 'boolean') fourLine = s.fourLine;
		if (typeof s.crafted === 'boolean') crafted = s.crafted;
		if (typeof s.guarantee === 'number' && [2, 3, 4].includes(s.guarantee)) guarantee = s.guarantee;
		if (Array.isArray(s.lines) && s.lines.length === 4) {
			const lines: { id: SubstatId; raw: string }[] = [];
			for (const item of s.lines) {
				if (!Array.isArray(item)) break;
				const [id, raw] = item;
				if (typeof id !== 'string' || typeof raw !== 'string' || raw.length > 8) break;
				if (!SUBSTATS.some((ss) => ss.id === id)) break;
				lines.push({ id: id as SubstatId, raw });
			}
			// distinct stats only — duplicates would break roll inference
			if (lines.length === 4 && new Set(lines.map((l) => l.id)).size === 4) {
				appraiseLines = lines;
				resolutionPick = 0;
			}
		}
		if (typeof s.view === 'string' && VIEWS.includes(s.view as View)) view = s.view as View;
	}
</script>

<div class="instrument">
	<!-- View switch -->
	<div class="ar-views">
		<button
			class="chip chip--control"
			class:active={view === 'fresh'}
			onclick={() => (view = 'fresh')}
		>
			Fresh Drop
		</button>
		<button
			class="chip chip--control"
			class:active={view === 'upgrade'}
			onclick={() => (view = 'upgrade')}
		>
			Upgrade Rolls
		</button>
		<button
			class="chip chip--control"
			class:active={view === 'appraise'}
			onclick={() => (view = 'appraise')}
		>
			Appraise
		</button>
		<button
			class="chip chip--control"
			class:active={view === 'reshape'}
			onclick={() => (view = 'reshape')}
		>
			Reshape
		</button>
	</div>

	<!-- Graph frame -->
	<div class="ar-frame frame ctx-dark">
		{#if !pairValid}
			<p class="ar-empty">Pick two target substats below.</p>
		{:else if view === 'appraise'}
			{#if !resolution}
				<p class="ar-empty">Dial in your piece's four substat values below.</p>
			{:else if apLinesInPair === 0}
				<p class="ar-empty">Neither target substat is on this piece — pick a pair it has.</p>
			{:else}
				<!-- Value-luck histogram with the entered piece marked -->
				<div class="ar-graph" bind:clientWidth={graphW}>
					<svg
						width={graphW}
						height={H}
						role="img"
						aria-label="Where this piece sits on its outcome distribution"
					>
						{#each apBins as bin (bin.x)}
							<rect
								x={apXOf(bin.x) + 0.5}
								y={M.top + plotH * (1 - bin.p / apMaxBin)}
								width={Math.max(1, plotW / apBins.length - 1)}
								height={plotH * (bin.p / apMaxBin)}
								fill="var(--accent)"
								opacity="0.75"
							/>
						{/each}
						<line
							x1={M.left}
							y1={M.top + plotH}
							x2={graphW - M.right}
							y2={M.top + plotH}
							stroke="rgba(255,255,255,0.2)"
						/>
						<line
							x1={apXOf(apPieceValue)}
							y1={M.top + 2}
							x2={apXOf(apPieceValue)}
							y2={M.top + plotH}
							stroke="#f7fafc"
							stroke-width="1.5"
							stroke-dasharray="4 4"
						/>
						<text
							x={apXOf(apPieceValue)}
							y={M.top - 4}
							fill="#f7fafc"
							font-size="10"
							text-anchor="middle"
						>
							your piece · p{Math.round(apPercentile * 100)}
						</text>
						{#each apBins.filter((_, i) => i % Math.ceil(apBins.length / 6) === 0) as bin (bin.x)}
							<text
								x={apXOf(bin.x)}
								y={H - 14}
								fill="rgba(255,255,255,0.5)"
								font-size="10"
								text-anchor="middle"
							>
								{bin.x}{apUseCv ? ' CV' : ' RV'}
							</text>
						{/each}
					</svg>
				</div>
				<p class="note">
					{apUseCv ? 'Crit value' : `Roll value into ${pairLabel}`} across every possible outcome of a
					piece with these starting lines ({resolution.fourLineStart
						? '4-line start'
						: '3-line start'}, {resolution.events} rolls) — the marker is the piece you entered.
					{#if !apUseCv}RV = roll value, each roll's strength as a % of the strongest possible roll.{/if}
				</p>
			{/if}
		{:else if view === 'fresh'}
			<!-- Probability ladder: bars scaled to the largest row -->
			<div class="ar-ladder">
				{#each ladderRows as row (row.label)}
					<div class="ar-ladder-row">
						<span class="ar-ladder-label">{row.label}</span>
						<div class="ar-ladder-track">
							<div class="ar-ladder-bar" style:width="{(row.p / ladderMax) * 100}%"></div>
						</div>
						<span class="ar-ladder-value">{fmtPct(row.p)}</span>
						<span class="ar-ladder-onein">1 in {oneIn(row.p)}</span>
					</div>
				{/each}
			</div>
			{#if source === 'elixir'}
				<p class="note">
					Crafted pieces skip the draw — the main stat and both target substats are chosen at
					crafting. The Elixir's real story is in Upgrade Rolls: since 5.5, at least 2 rolls are
					guaranteed into your chosen pair.
				</p>
			{:else}
				<p class="note">
					{pairLabel} on a 5★ {slot.name.toLowerCase()} — the game draws starting lines with hidden weights,
					and the two CRIT stats are its rarest draws.
				</p>
			{/if}
		{:else if view === 'upgrade' && cvDist && cvStats}
			<!-- Crit-value histogram at +20 -->
			<div class="ar-graph" bind:clientWidth={graphW}>
				<svg width={graphW} height={H} role="img" aria-label="Crit value distribution at +20">
					{#each cvBins as bin (bin.cv)}
						<rect
							x={cvXOf(bin.cv) + 0.5}
							y={M.top + plotH * (1 - bin.p / cvMaxBin)}
							width={Math.max(1, plotW / cvBins.length - 1)}
							height={plotH * (bin.p / cvMaxBin)}
							fill="var(--accent)"
							opacity="0.75"
						/>
					{/each}
					<line
						x1={M.left}
						y1={M.top + plotH}
						x2={graphW - M.right}
						y2={M.top + plotH}
						stroke="rgba(255,255,255,0.2)"
					/>
					{#each [cvStats.p10, cvStats.median, cvStats.p90] as mark, i (i)}
						<line
							x1={cvXOf(mark)}
							y1={M.top - 2}
							x2={cvXOf(mark)}
							y2={M.top + plotH}
							stroke="rgba(255,255,255,0.55)"
							stroke-dasharray="3 4"
						/>
						<text
							x={cvXOf(mark)}
							y={M.top - 6}
							fill="rgba(255,255,255,0.7)"
							font-size="10"
							text-anchor="middle"
						>
							{['p10', 'median', 'p90'][i]}
							{mark.toFixed(1)}
						</text>
					{/each}
					{#each [15, 25, 35, 45] as tick (tick)}
						{#if tick > cvX0 && tick < cvX1}
							<text
								x={cvXOf(tick)}
								y={H - 14}
								fill="rgba(255,255,255,0.5)"
								font-size="10"
								text-anchor="middle"
							>
								{tick} CV
							</text>
						{/if}
					{/each}
				</svg>
			</div>
			<p class="note">
				Exact distribution of total crit value at +20, assuming CR and CD are both starting lines ({fourLine
					? '4-line start, 5 rolls'
					: '3-line start, 4 rolls'}{crafted
					? `, ≥${ELIXIR_MIN_PAIR_ROLLS} guaranteed into the pair`
					: ''}). p10 = the unlucky tenth of pieces, p90 = the lucky tenth.
			</p>
		{:else}
			<!-- Discrete roll-count bars: upgrade (plain) or reshape (conditioned over ghost) -->
			<div class="ar-graph" bind:clientWidth={graphW}>
				<svg
					width={graphW}
					height={H}
					role="img"
					aria-label="Distribution of rolls into the target pair"
				>
					{#each barsDist as p, k (k)}
						{#if barsGhost}
							<rect
								x={M.left + k * band + band * 0.18}
								y={M.top + plotH * (1 - (barsGhost[k] ?? 0) / barsMax)}
								width={band * 0.64}
								height={plotH * ((barsGhost[k] ?? 0) / barsMax)}
								fill="rgba(255,255,255,0.16)"
							/>
						{/if}
						<rect
							x={M.left + k * band + band * 0.26}
							y={M.top + plotH * (1 - p / barsMax)}
							width={band * 0.48}
							height={plotH * (p / barsMax)}
							fill="var(--accent)"
							opacity="0.85"
						/>
						{#if p > 0.0005}
							<text
								x={M.left + k * band + band * 0.5}
								y={M.top + plotH * (1 - p / barsMax) - 6}
								fill="rgba(255,255,255,0.7)"
								font-size="10"
								text-anchor="middle"
							>
								{fmtPct(p, p < 0.1 ? 1 : 0)}
							</text>
						{/if}
						<text
							x={M.left + k * band + band * 0.5}
							y={H - 14}
							fill="rgba(255,255,255,0.55)"
							font-size="11"
							text-anchor="middle"
						>
							{k}
						</text>
					{/each}
					<line
						x1={M.left}
						y1={M.top + plotH}
						x2={graphW - M.right}
						y2={M.top + plotH}
						stroke="rgba(255,255,255,0.2)"
					/>
					{#if view === 'reshape'}
						<line
							x1={M.left + clampedCurrent * band + band * 0.5}
							y1={M.top + 2}
							x2={M.left + clampedCurrent * band + band * 0.5}
							y2={M.top + plotH}
							stroke="#f7fafc"
							stroke-width="1.5"
							stroke-dasharray="4 4"
						/>
						<text
							x={M.left + clampedCurrent * band + band * 0.5 + 5}
							y={M.top + plotH - 8}
							fill="#f7fafc"
							font-size="10"
							text-anchor="start"
						>
							current
						</text>
					{/if}
				</svg>
			</div>
			<p class="note">
				{#if view === 'upgrade'}
					Rolls into {pairLabel} across {events} upgrade events (each event: 25% per line).
				{:else}
					Solid: reshape outcome with the ≥{effGuarantee} guarantee (ghost: without it). Rolls reallocate
					across all 4 lines; modeled as a conditional redistribution.
				{/if}
			</p>
		{/if}
	</div>

	<!-- Controls -->
	<div class="ar-panels panels">
		<div class="panel">
			<p class="kicker">Piece</p>
			<div class="ar-slots">
				{#each SLOTS as s (s.id)}
					<button
						class="ar-slot"
						class:active={s.id === slotId}
						onclick={() => pickSlot(s.id)}
						title={s.name}
						aria-label={s.name}
					>
						<img src="/assets/artifacts/generic-full-set/{s.id}.webp" alt="" />
					</button>
				{/each}
			</div>
			<div class="ar-chips">
				{#each slot.mains as m (m.id)}
					<button
						class="chip chip--control"
						class:active={m.id === main.id}
						onclick={() => pickMain(m.id)}
					>
						{m.name}{#if slot.mains.length > 1}&nbsp;<span class="chip-sub"
								>{fmtPct(m.chance, m.chance < 0.05 ? 1 : 0)}</span
							>{/if}
					</button>
				{/each}
			</div>
		</div>

		<div class="panel">
			<p class="kicker">Target Pair</p>
			<div class="ar-chips ar-chips-dense">
				{#each SUBSTATS as s (s.id)}
					{#if s.id !== main.id}
						<button
							class="chip chip--control"
							class:active={pair.includes(s.id)}
							onclick={() => togglePairStat(s.id)}
						>
							{s.short}
						</button>
					{/if}
				{/each}
			</div>
			<p class="note">
				Two substats — reshaping selects exactly two, so the whole instrument thinks in pairs.
			</p>
		</div>

		<div class="panel">
			<p class="kicker">{view === 'appraise' ? 'Your Piece' : 'Scenario'}</p>
			{#if view === 'appraise'}
				{#each appraiseLines as line, i (i)}
					<div class="ar-line-row">
						<select
							class="ar-select"
							value={line.id}
							onchange={(e) => setLineStat(i, e.currentTarget.value as SubstatId)}
							aria-label="Substat {i + 1}"
						>
							{#each SUBSTATS as s (s.id)}
								{#if s.id !== main.id && (s.id === line.id || !appraiseLines.some((l) => l.id === s.id))}
									<option value={s.id}>{s.short}</option>
								{/if}
							{/each}
						</select>
						<ValueWheel
							values={lineOptions[i]}
							bind:value={appraiseLines[i].raw}
							label="Value for substat {i + 1}"
						/>
						<span class="ar-count-badge">
							{#if resolution}
								×{resolution.counts[i]}
							{:else if lineInferences[i].length}
								×{lineInferences[i].map((c) => c.count).join('/')}
							{:else}
								—
							{/if}
						</span>
					</div>
				{/each}
				{#if resolutions.length > 1}
					<div class="ar-chips">
						{#each resolutions as r, i (i)}
							<button
								class="chip chip--control"
								class:active={resolution === r}
								onclick={() => (resolutionPick = i)}
							>
								{r.fourLineStart ? '4-line start' : '3-line start'}
							</button>
						{/each}
					</div>
					<p class="note">Rounding makes two roll totals possible — pick the true start.</p>
				{/if}
			{:else if view === 'fresh'}
				<div class="ar-chips">
					{#each SOURCES as s (s.id)}
						<button
							class="chip chip--control"
							class:active={source === s.id}
							onclick={() => (source = s.id)}
						>
							{s.name}
						</button>
					{/each}
				</div>
				<p class="note">
					{#if source === 'elixir'}
						Sanctifying Elixir: {fmtPct(1 - src.fourLine, 0)} of crafts start with 3 lines, {fmtPct(
							src.fourLine,
							0
						)} with 4 — same odds as domain drops.
					{:else}
						{src.name}: {fmtPct(1 - src.fourLine, 0)} of 5★ drops start with 3 lines, {fmtPct(
							src.fourLine,
							0
						)} with 4.
					{/if}
				</p>
			{:else}
				<div class="ar-chips">
					<button
						class="chip chip--control"
						class:active={fourLine}
						onclick={() => (fourLine = true)}
					>
						4-line start
					</button>
					<button
						class="chip chip--control"
						class:active={!fourLine}
						onclick={() => (fourLine = false)}
					>
						3-line start
					</button>
				</div>
				<p class="note">{events} value rolls from +0 to +20.</p>
				{#if view === 'upgrade'}
					<div class="ar-chips">
						<button
							class="chip chip--control"
							class:active={!crafted}
							onclick={() => (crafted = false)}
						>
							Farmed
						</button>
						<button
							class="chip chip--control"
							class:active={crafted}
							onclick={() => (crafted = true)}
						>
							Elixir-crafted
						</button>
					</div>
					{#if crafted}
						<p class="note">
							Sanctifying Elixir (5.5+): your two crafted substats are guaranteed at least
							{ELIXIR_MIN_PAIR_ROLLS} of the {events} rolls.
						</p>
					{/if}
				{/if}
				{#if view === 'reshape'}
					<div class="ar-chips">
						<button
							class="chip chip--control"
							class:active={guarantee === 2}
							onclick={() => (guarantee = 2)}
						>
							Standard ≥2
						</button>
						<button
							class="chip chip--control"
							class:active={guarantee === 3}
							onclick={() => (guarantee = 3)}
						>
							Advanced ≥3
						</button>
						<button
							class="chip chip--control"
							class:active={guarantee === 4}
							onclick={() => (guarantee = 4)}
						>
							Decreed ≥4
						</button>
					</div>
					<div class="slider-control">
						<div class="slider-header">
							<span class="slider-label">Current rolls in pair</span>
							<span class="readout">{clampedCurrent}</span>
						</div>
						<input
							type="range"
							min="0"
							max={events}
							step="1"
							bind:value={currentRolls}
							class="slider"
							aria-label="Current rolls into the target pair"
						/>
					</div>
				{/if}
			{/if}
		</div>

		<div class="panel">
			<p class="kicker">Readout</p>
			{#if !pairValid}
				<p class="note">Pick two target substats.</p>
			{:else if view === 'appraise'}
				{#if resolution && apLinesInPair > 0}
					<p class="ar-big">
						p{Math.round(apPercentile * 100)}<span class="ar-big-unit"
							>of pieces with these lines</span
						>
					</p>
					<p class="ar-meta">
						Rolls into {pairLabel}: <span class="ar-strong">{apRollsIntoPair}</span>
						(P(≥{apRollsIntoPair}): <span class="ar-strong">{fmtPct(apRollTail)}</span>)
					</p>
					<p class="ar-meta">
						This line set at drop: <span class="ar-strong">1 in {oneIn(apLineSetOdds)}</span>
					</p>
					<p class="ar-meta">
						{resolution.fourLineStart ? '4-line' : '3-line'} start ·
						<span class="ar-strong">{resolution.events}</span> upgrade rolls
					</p>
				{:else}
					<p class="note">Enter a complete, valid piece to appraise it.</p>
				{/if}
			{:else if view === 'fresh'}
				{#if source === 'elixir'}
					<p class="ar-big">100%<span class="ar-big-unit">both chosen at craft</span></p>
					<p class="ar-meta">
						The pair guarantee lives in <span class="ar-strong">Upgrade Rolls</span>
					</p>
				{:else}
					<p class="ar-big">{fmtPct(pAtDrop)}<span class="ar-big-unit">at drop</span></p>
					<p class="ar-meta">
						Once 4 lines exist: <span class="ar-strong">{fmtPct(p4)}</span>
					</p>
				{/if}
				{#if slot.mains.length > 1 && source !== 'elixir'}
					<p class="ar-meta">
						With {main.name} main: <span class="ar-strong">1 in {oneIn(pWithMain)}</span>
					</p>
				{/if}
			{:else if view === 'upgrade'}
				{#if cvStats}
					<p class="ar-big">
						{cvStats.median.toFixed(1)}<span class="ar-big-unit">median CV at +20</span>
					</p>
					<p class="ar-meta">Mean: <span class="ar-strong">{cvStats.mean.toFixed(1)} CV</span></p>
					<p class="ar-meta">
						p10–p90: <span class="ar-strong"
							>{cvStats.p10.toFixed(1)}–{cvStats.p90.toFixed(1)} CV</span
						>
					</p>
				{:else}
					{@const expected = upgradeDist.reduce((acc, p, k) => acc + p * k, 0)}
					<p class="ar-big">
						{expected.toFixed(1)}<span class="ar-big-unit">expected rolls into {pairLabel}</span>
					</p>
					<p class="ar-meta">
						P(≥3 rolls): <span class="ar-strong"
							>{fmtPct(upgradeDist.reduce((acc, p, k) => (k >= 3 ? acc + p : acc), 0))}</span
						>
					</p>
				{/if}
			{:else}
				<p class="ar-reshape-odds">
					<span class="ar-odds better">{fmtPct(pBetter)} better</span>
					<span class="ar-odds same">{fmtPct(pSame)} same</span>
					<span class="ar-odds worse">{fmtPct(pWorse)} worse</span>
				</p>
				<p class="ar-meta">
					{#if reshapeFromAppraisal}
						vs <span class="ar-strong">{clampedCurrent}</span> rolls from your appraised piece.
					{:else}
						vs <span class="ar-strong">{clampedCurrent}</span> current rolls — appraise your piece and
						this follows it automatically.
					{/if}
				</p>
				<p class="note">
					Compared by roll count only: reshaping also rerolls each roll's strength (the 70–100%
					tiers), which isn't part of this comparison.
				</p>
				<p class="note">
					Pity: Advanced at 6 Dust of Enlightenment; Decreed on the 3rd consecutive Advanced. You
					keep the better of original and reshaped.
				</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.ar-views {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	/* Chart frame: same family treatment as the other instruments */
	.ar-frame {
		display: grid;
		gap: 0.5rem;
		padding: 0.9rem 1rem 0.7rem;
		border-radius: 9px;
	}

	.ar-graph svg {
		display: block;
	}

	.ar-graph text {
		font-family: var(--font-body);
	}

	.ar-empty {
		margin: 0;
		padding: 2rem 0;
		text-align: center;
		color: var(--muted);
	}

	/* ── Fresh-drop probability ladder ─────────────────────────────────────── */

	.ar-ladder {
		display: grid;
		gap: 0.55rem;
		padding: 0.4rem 0;
	}

	.ar-ladder-row {
		display: grid;
		grid-template-columns: minmax(10rem, 14rem) minmax(0, 1fr) 4.5rem 6rem;
		align-items: center;
		gap: 0.8rem;
	}

	.ar-ladder-label {
		font-family: var(--font-condensed);
		font-size: var(--fs-lg);
		color: var(--muted);
	}

	.ar-ladder-track {
		height: 12px;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.06);
		overflow: hidden;
	}

	.ar-ladder-bar {
		height: 100%;
		border-radius: 3px;
		background: var(--accent);
		opacity: 0.85;
		min-width: 2px;
	}

	.ar-ladder-value {
		font-family: var(--font-body);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		text-align: right;
	}

	.ar-ladder-onein {
		font-family: var(--font-body);
		font-size: var(--fs-md);
		color: var(--muted);
		text-align: right;
	}

	/* ── Panels ─────────────────────────────────────────────────────────────── */

	/* ── Slot picker ────────────────────────────────────────────────────────── */

	.ar-slots {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.ar-slot {
		width: 46px;
		height: 46px;
		padding: 4px;
		border: none;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.06);
		cursor: pointer;
		opacity: 0.55;
		transition:
			opacity 150ms ease,
			background 150ms ease,
			box-shadow 150ms ease;
	}

	.ar-slot img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.ar-slot:hover {
		opacity: 0.85;
	}

	.ar-slot.active {
		opacity: 1;
		background: color-mix(in srgb, var(--accent) 20%, var(--surface));
		box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 65%, transparent);
	}

	/* ── Chips ──────────────────────────────────────────────────────────────── */

	.ar-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	/* Condensed trial: the 9-chip substat row is the densest chip cluster */
	.ar-chips-dense :global(.chip) {
		font-family: var(--font-condensed);
	}

	/* ── Appraise entry ─────────────────────────────────────────────────────── */

	.ar-line-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 5.2rem 3.2rem;
		align-items: center;
		gap: 0.5rem;
	}

	.ar-select {
		padding: 0.32rem 0.5rem;
		border: none;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.07);
		color: var(--text);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		cursor: pointer;
	}

	.ar-select option {
		background: var(--surface);
		color: var(--text);
	}

	.ar-count-badge {
		font-family: var(--font-body);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--muted);
		text-align: right;
	}

	/* ── Slider ─────────────────────────────────────────────────────────────── */

	/* ── Readout ────────────────────────────────────────────────────────────── */

	.ar-big {
		margin: 0;
		font-family: var(--font-body);
		font-size: var(--fs-5xl);
		font-weight: var(--fw-bold);
		line-height: var(--lh-tight);
	}

	.ar-big-unit {
		margin-left: 0.4rem;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}

	.ar-meta {
		margin: 0;
		font-size: var(--fs-lg);
		line-height: 1.5rem;
		color: var(--muted);
	}

	.ar-strong {
		font-family: var(--font-body);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	/* Reshape verdictless odds trio — colors reuse the no-crit risk scale */
	.ar-reshape-odds {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.ar-odds {
		padding: 0.3rem 0.6rem;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.06);
		font-family: var(--font-body);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
	}

	.ar-odds.better {
		color: #4ecca3;
	}

	.ar-odds.same {
		color: #f6d365;
	}

	.ar-odds.worse {
		color: #e63946;
	}
</style>
