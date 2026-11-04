<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { shredSources } from '$lib/data/shredSources.generated';
	import { SHRED_ELEMENTS, type ShredElement } from '$lib/capabilities/shredSources';
	import {
		BASE_RES_MAX,
		BASE_RES_MIN,
		ENEMY_LEVEL_MAX,
		RES_RUNGS,
		appliesTo,
		defMultiplier,
		defRemoved as removedOf,
		groupSources,
		resMultiplier,
		sumPicks,
		type SourceGroup
	} from './defres';
	import { MAX_LEVEL, snapLevel } from './reactionCurves';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import InstrumentSlider from './kit/InstrumentSlider.svelte';
	import { LEVEL_SLIDER } from './kit/level';

	const ELEMENT_NAME: Record<ShredElement, string> = {
		pyro: 'Pyro',
		hydro: 'Hydro',
		anemo: 'Anemo',
		electro: 'Electro',
		dendro: 'Dendro',
		cryo: 'Cryo',
		geo: 'Geo',
		physical: 'Physical'
	};

	const GROUPS = groupSources(shredSources);
	/** ⚓ Nate (the headline round): the defaults pick Viridescent Venerer, so
	 *  the first view's headline is an answer and not "+0%". */
	const DEFAULT_PICKS: Record<string, number> = Object.fromEntries(
		GROUPS.filter((g) => g.owner === 'viridescent_venerer' && g.stat === 'res').map((g) => [
			g.key,
			g.options[g.options.length - 1].amount
		])
	);

	// ── State ─────────────────────────────────────────────────────────────
	let element = $state<ShredElement>('pyro');
	let charLevel = $state(90);
	/** A Transformative, Lunar or Stellar hit: DEF plays no part (gcsim IgnoreDefPercent 1). */
	let ignoresDef = $state(false);
	let enemyLevel = $state(100);
	let baseRes = $state(10);
	let immune = $state(false);
	/** Chip key → the amount picked for it. */
	let picks = $state<Record<string, number>>({ ...DEFAULT_PICKS });
	/** Shred from anything not listed, whole percent. */
	let otherRes = $state(0);
	let otherDef = $state(0);
	let otherIgnore = $state(0);

	export function reset() {
		element = 'pyro';
		charLevel = 90;
		ignoresDef = false;
		enemyLevel = 100;
		baseRes = 10;
		immune = false;
		picks = { ...DEFAULT_PICKS };
		otherRes = 0;
		otherDef = 0;
		otherIgnore = 0;
	}

	export function getShareState() {
		return {
			v: 1,
			element,
			charLevel,
			ignoresDef,
			enemyLevel,
			baseRes: immune ? 'immune' : baseRes,
			picks: $state.snapshot(picks),
			other: [otherRes, otherDef, otherIgnore]
		};
	}

	export function applyShareState(state: unknown) {
		if (typeof state !== 'object' || state === null) return;
		const s = state as Record<string, unknown>;
		const int = (v: unknown, lo: number, hi: number, step = 1) =>
			typeof v === 'number' && Number.isFinite(v)
				? Math.min(hi, Math.max(lo, Math.round(v / step) * step))
				: undefined;
		reset();
		if (SHRED_ELEMENTS.includes(s.element as ShredElement)) element = s.element as ShredElement;
		const lv = int(s.charLevel, 1, MAX_LEVEL);
		if (lv !== undefined) charLevel = snapLevel(lv);
		ignoresDef = s.ignoresDef === true;
		enemyLevel = int(s.enemyLevel, 1, ENEMY_LEVEL_MAX) ?? enemyLevel;
		if (s.baseRes === 'immune') immune = true;
		else baseRes = int(s.baseRes, BASE_RES_MIN, BASE_RES_MAX, 5) ?? baseRes;
		// a link's picks are the whole list, so one that picked nothing stays empty
		if (typeof s.picks === 'object' && s.picks !== null) {
			const next: Record<string, number> = {};
			for (const [key, amount] of Object.entries(s.picks)) {
				const g = GROUPS.find((x) => x.key === key);
				if (g?.options.some((o) => o.amount === amount)) next[key] = amount as number;
			}
			picks = next;
		}
		if (Array.isArray(s.other)) {
			otherRes = int(s.other[0], 0, 100, 5) ?? 0;
			otherDef = int(s.other[1], 0, 100, 5) ?? 0;
			otherIgnore = int(s.other[2], 0, 100, 5) ?? 0;
		}
	}

	// ── The arithmetic ────────────────────────────────────────────────────
	const picked = $derived(sumPicks(GROUPS, new Map(Object.entries(picks)), element));
	const resShred = $derived(picked.res + otherRes);
	const defShred = $derived(Math.min(100, picked.def + otherDef));
	// several ignores add, and gcsim caps the sum at 100%
	const defIgnore = $derived(Math.min(100, picked.ignore + otherIgnore));
	/** Shred and ignore as one figure: the share of the enemy's DEF that's gone.
	 *  They multiply, so this is what the DEF chart's x axis can carry alone. */
	const defRemoved = $derived(100 * removedOf(defShred / 100, defIgnore / 100));

	const finalRes = $derived(baseRes - resShred);
	const resBase = $derived(immune ? 0 : resMultiplier(baseRes / 100));
	const resNow = $derived(immune ? 0 : resMultiplier(finalRes / 100));
	const defBase = $derived(ignoresDef ? 1 : defMultiplier(charLevel, enemyLevel));
	const defNow = $derived(ignoresDef ? 1 : defMultiplier(charLevel, enemyLevel, defRemoved / 100));
	const total = $derived(resNow * defNow);
	const totalBase = $derived(resBase * defBase);
	const fmtX = (m: number) => `×${m.toFixed(3)}`;
	const minus = (v: number) => (v ? `−${v}%` : '0%');

	// ── The headline: what your shred adds (⚓ Nate) ─────────────────────
	const anyPick = $derived(resShred > 0 || defShred > 0 || defIgnore > 0);
	const gainPct = $derived(totalBase > 0 ? (total / totalBase - 1) * 100 : 0);
	const headFigure = $derived(immune ? '×0' : anyPick ? `+${gainPct.toFixed(1)}%` : '+0%');
	const headSentence = $derived(
		immune
			? `the enemy is immune to ${ELEMENT_NAME[element]}`
			: !anyPick
				? 'damage from shred, with none picked'
				: defIgnore > 0
					? 'damage from your shred and DEF ignore'
					: 'damage from your shred'
	);

	// ── Sources ───────────────────────────────────────────────────────────
	const visible = $derived(GROUPS.filter((g) => appliesTo(g, element)));
	const SECTIONS: { stat: SourceGroup['stat']; label: string }[] = [
		{ stat: 'res', label: 'RES shred' },
		{ stat: 'def', label: 'DEF shred' },
		{ stat: 'ignore', label: 'DEF ignore' }
	];
	// characters before sets, then by name
	const ofStat = (stat: SourceGroup['stat']) =>
		visible
			.filter((g) => g.stat === stat)
			.sort(
				(a, b) =>
					Number(a.ownerKind === 'artifact') - Number(b.ownerKind === 'artifact') ||
					a.ownerName.localeCompare(b.ownerName)
			);
	const onOf = (stat: SourceGroup['stat']) => ofStat(stat).filter((g) => g.key in picks);

	function toggle(g: SourceGroup) {
		const next = { ...picks };
		if (g.key in next) delete next[g.key];
		else next[g.key] = g.options[g.options.length - 1].amount;
		picks = next;
	}
	function pickAmount(g: SourceGroup, amount: number) {
		picks = { ...picks, [g.key]: amount };
	}
	const conOf = (g: SourceGroup) => {
		const amount = picks[g.key] ?? g.options[g.options.length - 1].amount;
		return g.options.find((o) => o.amount === amount)?.minCon ?? 0;
	};
	const whoOf = (g: SourceGroup) =>
		g.stat !== 'ignore'
			? null
			: g.scope === 'skill'
				? 'own Skill DMG only'
				: g.target === 'team'
					? 'whole party'
					: 'own hits';
	const abilityOf = (g: SourceGroup) =>
		g.options.find((o) => o.amount === picks[g.key])?.ability ?? g.options[0].ability;

	/** The Shred segment's face: what is on, the first two by name. */
	const shredFace = $derived.by(() => {
		const on = [
			...SECTIONS.flatMap((s) => onOf(s.stat)).map((g) => `${g.ownerName} ${picks[g.key]}%`),
			...(otherRes || otherDef || otherIgnore ? ['Other sources'] : [])
		];
		if (!on.length) return 'None';
		return on.length <= 2 ? on.join(', ') : `${on.slice(0, 2).join(', ')} +${on.length - 2}`;
	});

	// ── Geometry ──────────────────────────────────────────────────────────
	// Two plots in one chart, on ONE multiplier scale: RES (the larger, with
	// the handle under it) and DEF. Side by side where the tile is wide; stacked
	// below that, DEF on top, so RES's axis still sits on the handle.
	let graphW = $state(720);
	let graphH = $state(0);
	/** 🎛️ The y axis's numbers ("×1.5"). */
	const PADL = 38;
	const PADR = 12;
	const TOP = 16;
	/** The axis's numbers and its name, under each plot. */
	const AXIS_H = 30;
	/** 🎛️ Between the two plots, side by side. */
	const PANEL_GAP = 40;
	/** 🎛️ RES's share of the width, side by side. */
	const RES_SHARE = 0.62;
	/** 🎛️ Narrower than this, the plots stack. */
	const SIDE_MIN = 620;
	const PLOT_MIN = 200;
	/** 🎛️ The RES plot's least width for the common values to ride the
	 *  handle's line (its name and value at the left, the six at the right). */
	const RUNGS_INLINE_MIN = 560;
	/** Half the slider thumb's 15px (app.css `.slider`). */
	const THUMB_R = 7.5;

	const side = $derived(graphW >= SIDE_MIN);
	const minH = $derived(side ? TOP + PLOT_MIN + AXIS_H : 2 * (TOP + 0.7 * PLOT_MIN + AXIS_H));
	type Rect = { x0: number; x1: number; y0: number; y1: number };
	const rects = $derived.by((): { res: Rect; def: Rect; h: number } => {
		const h = Math.max(minH, graphH);
		// A hidden tile measures 0 wide; floor it, or the drag rect's width goes negative.
		const W = Math.max(graphW, PADL + PADR + PANEL_GAP + PLOT_MIN);
		if (side) {
			const w = W - PADL - PADR - PANEL_GAP;
			const y0 = TOP;
			const y1 = h - AXIS_H;
			const resX1 = PADL + w * RES_SHARE;
			return {
				res: { x0: PADL, x1: resX1, y0, y1 },
				def: { x0: resX1 + PANEL_GAP, x1: W - PADR, y0, y1 },
				h
			};
		}
		const each = (h - 2 * (TOP + AXIS_H)) / 2;
		return {
			def: { x0: PADL, x1: W - PADR, y0: TOP, y1: TOP + each },
			res: {
				x0: PADL,
				x1: W - PADR,
				y0: 2 * TOP + AXIS_H + each,
				y1: 2 * TOP + AXIS_H + 2 * each
			},
			h
		};
	});

	const Y_MAX = 1.5;
	const Y_TICKS = [0.5, 1, 1.5];
	const yIn = (r: Rect, m: number) => r.y1 - (Math.min(m, Y_MAX) / Y_MAX) * (r.y1 - r.y0 - 6);

	const RES_X0 = BASE_RES_MIN;
	const RES_X1 = BASE_RES_MAX;
	const clampRes = (r: number) => Math.min(RES_X1, Math.max(RES_X0, r));
	const resAt = (r: number) => resMultiplier(r / 100);
	const defAt = (removed: number) =>
		ignoresDef ? 1 : defMultiplier(charLevel, enemyLevel, removed / 100);

	type Dot = { x: number; m: number; hollow?: boolean; label: string; title: string };
	type Seg = { from: number; to: number; label: string; title: string };
	type Panel = {
		id: 'res' | 'def';
		r: Rect;
		xMin: number;
		xMax: number;
		xTicks: number[];
		xTitle: string;
		curve: (x: number) => number;
		span: [number, number] | null;
		dots: Dot[];
		segs: Seg[];
		guides: { x: number; label: string; side: 'left' | 'right' }[];
		dim: boolean;
		message?: string;
		/** Where the message centres, in the plot's units: in the room its curve
		 *  leaves, so it doesn't cross it. */
		messageAt: { x: number; m: number };
	};

	const resPanel = $derived.by((): Panel => {
		const b = clampRes(baseRes);
		const f = clampRes(finalRes);
		const segs: Seg[] = [];
		let cur = baseRes;
		for (const g of onOf('res')) {
			segs.push({
				from: cur,
				to: cur - picks[g.key],
				label: `${g.ownerName} ${picks[g.key]}%`,
				title: abilityOf(g)
			});
			cur -= picks[g.key];
		}
		if (otherRes)
			segs.push({
				from: cur,
				to: cur - otherRes,
				label: `Other ${otherRes}%`,
				title: 'Other sources'
			});
		return {
			id: 'res',
			r: rects.res,
			xMin: RES_X0,
			xMax: RES_X1,
			xTicks: [-100, -50, 0, 50, 100, 150, 200],
			xTitle: `Enemy ${ELEMENT_NAME[element]} RES`,
			curve: resAt,
			span: !immune && resShred ? [f, b] : null,
			dots: immune
				? []
				: [
						...(resShred
							? [
									{
										x: b,
										m: resAt(b),
										hollow: true,
										label: fmtX(resAt(b)),
										title: `At ${baseRes}% RES, before shred, ${fmtX(resAt(b))} of the hit gets through.`
									}
								]
							: []),
						{
							x: f,
							m: resAt(f),
							label: fmtX(resNow),
							title: `At ${finalRes}% RES, ${fmtX(resNow)} of the hit gets through.`
						}
					],
			segs: immune ? [] : segs,
			guides: [
				{ x: 0, label: 'below 0%, shred counts half', side: 'left' },
				{ x: 75, label: 'diminishing returns', side: 'right' }
			],
			dim: immune,
			message: immune ? 'Immune: this element deals no damage' : undefined,
			// over the flat tail, where the curve has fallen away
			messageAt: { x: 125, m: 1.2 }
		};
	});

	const defPanel = $derived.by((): Panel => {
		const segs: Seg[] = [];
		let cur = 0;
		for (const g of onOf('def')) {
			const to = Math.min(100, cur + picks[g.key]);
			segs.push({ from: cur, to, label: `${g.ownerName} ${picks[g.key]}%`, title: abilityOf(g) });
			cur = to;
		}
		if (otherDef) {
			const to = Math.min(100, cur + otherDef);
			segs.push({ from: cur, to, label: `Other ${otherDef}%`, title: 'Other sources' });
			cur = to;
		}
		// An ignore removes its share of the DEF the shred left.
		const left = 1 - defShred / 100;
		for (const g of onOf('ignore')) {
			const to = Math.min(100, cur + left * picks[g.key]);
			segs.push({
				from: cur,
				to,
				label: `${g.ownerName} ${picks[g.key]}% ignored`,
				title: `${abilityOf(g)} (${whoOf(g)})`
			});
			cur = to;
		}
		if (otherIgnore) {
			const to = Math.min(100, cur + left * otherIgnore);
			segs.push({ from: cur, to, label: `Other ${otherIgnore}% ignored`, title: 'Other sources' });
		}
		return {
			id: 'def',
			r: rects.def,
			xMin: 0,
			xMax: 100,
			xTicks: [0, 25, 50, 75, 100],
			xTitle: 'Enemy DEF removed',
			curve: defAt,
			span: !ignoresDef && defRemoved > 0 ? [0, defRemoved] : null,
			dots: ignoresDef
				? []
				: [
						...(defRemoved > 0
							? [
									{
										x: 0,
										m: defBase,
										hollow: true,
										label: fmtX(defBase),
										title: `Level ${charLevel} against level ${enemyLevel}, before shred, ${fmtX(defBase)} of the hit gets through.`
									}
								]
							: []),
						{
							x: defRemoved,
							m: defNow,
							label: fmtX(defNow),
							title: `Level ${charLevel} against level ${enemyLevel}, with ${Math.round(defRemoved)}% of its DEF removed, ${fmtX(defNow)} of the hit gets through.`
						}
					],
			segs: ignoresDef ? [] : segs,
			guides: [],
			dim: ignoresDef,
			message: ignoresDef ? 'Transformative, Lunar, and Stellar reactions ignore DEF' : undefined,
			// under the line, which is ×1 throughout when DEF is ignored
			messageAt: { x: 50, m: 0.6 }
		};
	});

	const xIn = (p: Panel, x: number) =>
		p.r.x0 + ((x - p.xMin) / (p.xMax - p.xMin)) * (p.r.x1 - p.r.x0);

	const SAMPLES = 120;
	function trace(p: Panel, lo = p.xMin, hi = p.xMax): string {
		const a = Math.max(p.xMin, Math.min(lo, hi));
		const b = Math.min(p.xMax, Math.max(lo, hi));
		if (b - a < 1e-9) return '';
		const n = Math.max(2, Math.ceil((SAMPLES * (b - a)) / (p.xMax - p.xMin)));
		return Array.from({ length: n + 1 }, (_, i) => {
			const x = a + (i / n) * (b - a);
			return `${i ? 'L' : 'M'}${xIn(p, x).toFixed(1)},${yIn(p.r, p.curve(x)).toFixed(1)}`;
		}).join(' ');
	}

	/** Where a dot's label goes: in the room its curve leaves. RES falls to the
	 *  right, so both labels sit up and right of their dots; DEF rises, so the
	 *  value up and left, and the "before" figure down and right. At an edge,
	 *  inward. */
	function dotLabelAt(p: Panel, d: Dot, cx: number, cy: number) {
		const right = p.id === 'res' || d.hollow || cx - p.r.x0 < 48;
		const below = p.id === 'def' && d.hollow;
		// Up against the plot's top (RES shredded toward −100%), above the dot
		// would meet the y axis's name: level with the dot instead, which on a
		// falling curve is still clear of it.
		const level = !below && cy - 8 - DOT_LABEL_CAP < p.r.y0;
		return {
			x: cx + (right ? 1 : -1) * (level ? 9 : 7),
			y: below ? cy + 15 : level ? cy + 1 : cy - 8,
			anchor: right ? 'start' : 'end'
		} as const;
	}

	/** A 12px condensed glyph, generously: keeps a message inside its plot. */
	const MESSAGE_CHAR_PX = 6.5;
	/** A dot label's cap height at 12px, about. */
	const DOT_LABEL_CAP = 9;

	/** A guide's label only where it fits inside its plot, clear of the y
	 *  axis's name over the plot's left corner. */
	function guideFits(p: Panel, g: Panel['guides'][number]) {
		const x = xIn(p, g.x);
		const w = g.label.length * SEG_CHAR_PX;
		return g.side === 'left' ? x - 5 - w >= p.r.x0 + 64 : x + 5 + w <= p.r.x1;
	}

	/** 🎛️ The arrow's height over the plot's floor, and between label rows. */
	const ARROW_DY = 12;
	const SEG_ROW = 13;
	const SEG_CHAR_PX = 5.6;
	/** The arrow's segments, each labelled over its middle, a row higher where
	 *  it would run into the label before it. */
	function arrowOf(p: Panel) {
		const y = p.r.y1 - ARROW_DY;
		const rowsEnd: number[] = [];
		return p.segs.map((s, i) => {
			const xa = xIn(p, Math.max(p.xMin, Math.min(p.xMax, s.from)));
			const xb = xIn(p, Math.max(p.xMin, Math.min(p.xMax, s.to)));
			const w = s.label.length * SEG_CHAR_PX;
			// keep the label inside the plot
			const mid = Math.min(p.r.x1 - w / 2, Math.max(p.r.x0 + w / 2, (xa + xb) / 2));
			const l = mid - w / 2;
			const r = mid + w / 2;
			// the arrow runs left on RES, right on DEF: a label clears the one before
			// it on the side it came from
			let row = 0;
			while (
				rowsEnd[row] !== undefined &&
				(p.id === 'res' ? r + 6 > rowsEnd[row] : l - 6 < rowsEnd[row])
			)
				row++;
			rowsEnd[row] = p.id === 'res' ? l : r;
			return { ...s, i, xa, xb, mid, y, ly: y - 7 - row * SEG_ROW, last: i === p.segs.length - 1 };
		});
	}

	// ── The chart sets the enemy's RES on press-and-drag (the RES plot only) ──
	let dragging = false;
	function resAtPointer(e: PointerEvent) {
		const svg = (e.currentTarget as SVGElement).ownerSVGElement!;
		const x = e.clientX - svg.getBoundingClientRect().left;
		const r = rects.res;
		const v = RES_X0 + Math.min(1, Math.max(0, (x - r.x0) / (r.x1 - r.x0))) * (RES_X1 - RES_X0);
		immune = false;
		baseRes = Math.round(v / 5) * 5;
	}
	function onDown(e: PointerEvent) {
		if (e.button !== 0) return;
		dragging = true;
		(e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
		resAtPointer(e);
	}
	function onMove(e: PointerEvent) {
		if (dragging) resAtPointer(e);
	}
	function onUp() {
		dragging = false;
	}

	const regime = $derived(
		immune
			? 'An immune enemy takes no damage of this element, whatever the shred.'
			: finalRes < 0
				? 'Below 0% RES, shred works at half strength.'
				: finalRes >= 75
					? 'Above 75% RES, shred works at less than full strength, until RES drops back under 75%.'
					: 'Between 0% and 75% RES, shred works at full strength.'
	);
</script>

{#snippet panel(p: Panel)}
	{@const r = p.r}
	<g class="dr-panel" class:is-dim={p.dim}>
		{#each p.xTicks as t (t)}
			<line x1={xIn(p, t)} y1={r.y0} x2={xIn(p, t)} y2={r.y1} stroke="var(--chart-grid)" />
			<text x={xIn(p, t)} y={r.y1 + 15} fill="var(--chart-ink)" font-size="10" text-anchor="middle">
				{t}%
			</text>
		{/each}
		<text x={r.x1} y={r.y1 + 27} fill="var(--chart-dim)" font-size="10" text-anchor="end">
			{p.xTitle}
		</text>
		{#each Y_TICKS as v (v)}
			<line x1={r.x0} y1={yIn(r, v)} x2={r.x1} y2={yIn(r, v)} stroke="var(--chart-grid)" />
			{#if r.x0 === PADL}
				<text
					x={PADL - 7}
					y={yIn(r, v) + 3.5}
					fill="var(--chart-ink)"
					font-size="10"
					text-anchor="end"
				>
					×{v}
				</text>
			{/if}
		{/each}
		<line x1={r.x0} y1={r.y1} x2={r.x1} y2={r.y1} stroke="var(--chart-rule)" />

		{#each p.guides.filter((g) => guideFits(p, g)) as g (g.x)}
			<line
				x1={xIn(p, g.x)}
				y1={r.y0}
				x2={xIn(p, g.x)}
				y2={r.y1}
				stroke="var(--chart-dim)"
				stroke-dasharray="3 3"
			/>
			<text
				class="stage-word"
				x={xIn(p, g.x) + (g.side === 'left' ? -5 : 5)}
				y={r.y0 + 10}
				fill="var(--chart-dim)"
				font-size="10"
				text-anchor={g.side === 'left' ? 'end' : 'start'}
			>
				{g.label}
			</text>
		{/each}

		<path d={trace(p)} fill="none" stroke="var(--chart-ink)" stroke-width="1.75" />
		{#if p.span}
			<path
				d={trace(p, p.span[0], p.span[1])}
				fill="none"
				stroke="var(--accent)"
				stroke-width="3"
			/>
		{/if}

		<!-- The arrow: each source a segment, along the axis it moves you on -->
		{#each arrowOf(p) as s (s.i)}
			<line
				x1={s.xa}
				y1={s.y}
				x2={s.xb}
				y2={s.y}
				stroke="var(--accent)"
				stroke-opacity={s.i % 2 ? 0.55 : 0.95}
				stroke-width="3"
			/>
			<line
				x1={s.xa}
				y1={s.y - 4}
				x2={s.xa}
				y2={s.y + 4}
				stroke="var(--accent)"
				stroke-width="1.25"
			/>
			{#if s.last}
				{@const dir = s.xb < s.xa ? -1 : 1}
				<path
					d="M{s.xb + dir * 2},{s.y} L{s.xb - dir * 5},{s.y - 4.5} L{s.xb - dir * 5},{s.y + 4.5} Z"
					fill="var(--accent)"
				/>
			{/if}
			<text
				class="stage-word"
				x={s.mid}
				y={s.ly}
				fill="var(--chart-ink)"
				font-size="10"
				text-anchor="middle"
			>
				{s.label}<title>{s.title}</title>
			</text>
		{/each}

		{#each p.dots as d, i (i)}
			{@const cx = xIn(p, d.x)}
			{@const cy = yIn(r, d.m)}
			{#if !d.hollow}
				<line
					x1={cx}
					y1={cy}
					x2={cx}
					y2={r.y1}
					stroke="var(--chart-ink)"
					stroke-width="1"
					stroke-dasharray="2 2"
				/>
			{/if}
			<circle
				{cx}
				{cy}
				r={d.hollow ? 3.5 : 4.5}
				fill={d.hollow ? 'var(--frame-bg)' : 'var(--accent)'}
				stroke={d.hollow ? 'var(--chart-ink)' : 'var(--frame-bg)'}
				stroke-width="1.5"
			/>
			{@const at = dotLabelAt(p, d, cx, cy)}
			<text
				class="stage-word dr-dot-label"
				class:is-now={!d.hollow}
				x={at.x}
				y={at.y}
				fill={d.hollow ? 'var(--chart-ink)' : 'var(--text)'}
				font-size={d.hollow ? 10 : 12}
				text-anchor={at.anchor}
			>
				{d.label}<title>{d.title}</title>
			</text>
		{/each}

		{#if p.message}
			{@const half = (p.message.length * MESSAGE_CHAR_PX) / 2}
			<text
				class="stage-word"
				x={Math.min(r.x1 - half, Math.max(r.x0 + half, xIn(p, p.messageAt.x)))}
				y={yIn(r, p.messageAt.m)}
				fill="var(--text)"
				font-size="12"
				text-anchor="middle"
			>
				{p.message}
			</text>
		{/if}
	</g>
{/snippet}

<!-- THE STAGE (design §6). One box: the chart head (what your shred adds),
     the chart's toolbar on its top edge (the hit's element, then the setup
     bar), the two plots on one multiplier scale, and the enemy's RES as the
     handle under the RES plot. The old Readout is on the chart: each factor at
     its dot, the shred as the arrow's segments, the product in the fine print. -->
<div class="stage-root">
	<div class="stage ctx-dark">
		<p class="readout-head stage-head">
			{headFigure}<span class="readout-sentence">{headSentence}</span>
		</p>

		<div class="stage-toolbar">
			<div class="segment stage-tabs dr-elements" role="radiogroup" aria-label="The hit's element">
				{#each SHRED_ELEMENTS as e (e)}
					<button
						class="btn seg-el"
						class:is-active={element === e}
						style:--seg-el="var(--el-{e === 'physical' ? 'none' : e}-main)"
						role="radio"
						aria-checked={element === e}
						aria-label={ELEMENT_NAME[e]}
						title={ELEMENT_NAME[e]}
						onclick={() => (element = e)}
					>
						{#if e === 'physical'}
							Physical
						{:else}
							<img src={elementIcon(e)} alt="" width="16" height="16" />
						{/if}
					</button>
				{/each}
			</div>

			<div class="setup-bar" role="group" aria-label="Setup">
				<BandMenu role="dialog" align="start" ariaLabel="Shred: {shredFace}">
					{#snippet face()}
						<span class="setup-key">Shred</span>
						<span class="setup-val">{shredFace}</span>
					{/snippet}
					{#snippet items()}
						<div class="setup-pop dr-shred-pop">
							{#each SECTIONS as sec (sec.stat)}
								{@const list = ofStat(sec.stat)}
								<div class="dr-section">
									<p class="dr-section-head">
										<span>{sec.label}{sec.stat === 'res' ? ` · ${ELEMENT_NAME[element]}` : ''}</span
										>
										<span class="dr-section-total">
											{sec.stat === 'res'
												? minus(resShred)
												: sec.stat === 'def'
													? minus(defShred)
													: `${defIgnore}%`}
										</span>
									</p>
									<ul class="dr-list">
										{#each list as g (g.key)}
											{@const on = g.key in picks}
											{@const who = whoOf(g)}
											<li class="dr-source" class:is-on={on}>
												<label class="check" title={g.options.map((o) => o.ability).join(' / ')}>
													<input type="checkbox" checked={on} onchange={() => toggle(g)} />
													<span class="check-box"></span>
													<span class="dr-name">{g.ownerName}</span>
													{#if conOf(g) > 0}<span class="dr-con">C{conOf(g)}</span>{/if}
													{#if who}<span class="dr-who">{who}</span>{/if}
												</label>
												{#if g.options.length > 1}
													<span
														class="dr-options"
														role="radiogroup"
														aria-label="{g.ownerName}'s amount"
													>
														{#each g.options as o (o.amount)}
															<button
																class="chip chip--sm"
																class:active={on && picks[g.key] === o.amount}
																role="radio"
																aria-checked={on && picks[g.key] === o.amount}
																title={o.ability}
																onclick={() => pickAmount(g, o.amount)}
															>
																{o.amount}%
															</button>
														{/each}
													</span>
												{:else}
													<span class="dr-amount">{g.options[0].amount}%</span>
												{/if}
											</li>
										{:else}
											<li class="dr-none">
												No character or set in the data shreds {ELEMENT_NAME[element]} RES.
											</li>
										{/each}
									</ul>
									{#if sec.stat === 'res'}
										<InstrumentSlider
											label="Other sources"
											aria="Other resistance shred percent"
											bind:value={otherRes}
											min={0}
											max={100}
											step={5}
											unit="%"
										/>
									{:else if sec.stat === 'def'}
										<InstrumentSlider
											label="Other sources"
											aria="Other defense shred percent"
											bind:value={otherDef}
											min={0}
											max={100}
											step={5}
											unit="%"
										/>
									{:else}
										<InstrumentSlider
											label="Other sources"
											aria="Other defense ignore percent"
											bind:value={otherIgnore}
											min={0}
											max={100}
											step={5}
											unit="%"
										/>
									{/if}
								</div>
							{/each}
						</div>
					{/snippet}
				</BandMenu>

				<BandMenu role="dialog" align="start" ariaLabel="Enemy level: {enemyLevel}">
					{#snippet face()}
						<span class="setup-key">Enemy level</span>
						<span class="setup-val setup-val--num">{enemyLevel}</span>
					{/snippet}
					{#snippet items()}
						<div class="setup-pop">
							<InstrumentSlider
								label="Enemy level"
								aria="Enemy level"
								bind:value={enemyLevel}
								min={1}
								max={ENEMY_LEVEL_MAX}
								step={1}
							/>
						</div>
					{/snippet}
				</BandMenu>

				<BandMenu role="dialog" align="start" ariaLabel="Your level: {charLevel}">
					{#snippet face()}
						<span class="setup-key">Your level</span>
						<span class="setup-val setup-val--num">{charLevel}</span>
					{/snippet}
					{#snippet items()}
						<div class="setup-pop">
							<InstrumentSlider
								label="Your level"
								aria="Character level"
								bind:value={charLevel}
								{...LEVEL_SLIDER}
							/>
						</div>
					{/snippet}
				</BandMenu>

				<BandMenu role="dialog" align="start" ariaLabel="DEF: {ignoresDef ? 'Ignored' : 'Applies'}">
					{#snippet face()}
						<span class="setup-key">DEF</span>
						<span class="setup-val">{ignoresDef ? 'Ignored' : 'Applies'}</span>
					{/snippet}
					{#snippet items()}
						<div class="setup-pop">
							<div class="dr-hits" role="radiogroup" aria-label="DEF">
								{#each [false, true] as ign (ign)}
									<button
										class="dr-hit"
										class:is-on={ignoresDef === ign}
										role="radio"
										aria-checked={ignoresDef === ign}
										onclick={() => (ignoresDef = ign)}
									>
										<span class="dr-hit-name">{ign ? 'Ignored' : 'Applies'}</span>
										<span class="dr-hit-detail">
											{ign
												? 'Transformative, Lunar, and Stellar reactions'
												: 'Talents and attacks, with or without an Amplifying or Additive reaction'}
										</span>
									</button>
								{/each}
							</div>
						</div>
					{/snippet}
				</BandMenu>
			</div>
		</div>

		<div
			class="stage-graph"
			style:--graph-min="{minH}px"
			bind:clientWidth={graphW}
			bind:clientHeight={graphH}
		>
			<svg
				width={graphW}
				height={rects.h}
				role="img"
				aria-label="Damage kept against the enemy's RES and against the share of its DEF removed"
			>
				<text
					x={PADL}
					y={(side ? rects.res.y0 : rects.def.y0) - 4}
					fill="var(--chart-dim)"
					font-size="10"
					text-anchor="start"
				>
					damage kept
				</text>
				{@render panel(defPanel)}
				{@render panel(resPanel)}
				<!-- The RES plot is the enemy's RES: press and drag to set it. The
				     handle under it is the keyboard's way (an ARIA slider). -->
				<rect
					role="presentation"
					class="dr-drag"
					x={rects.res.x0}
					y={rects.res.y0}
					width={rects.res.x1 - rects.res.x0}
					height={rects.res.y1 - rects.res.y0}
					fill="transparent"
					onpointerdown={onDown}
					onpointermove={onMove}
					onpointerup={onUp}
					onpointercancel={onUp}
				/>
			</svg>
		</div>

		<!-- THE HANDLE (design §6): the enemy's RES, under the RES plot. The
		     arrow's tail stands on it; the shred carries you left from there. -->
		<div
			class="stage-handle dr-handle"
			class:is-inline={rects.res.x1 - rects.res.x0 >= RUNGS_INLINE_MIN}
			style:--stage-handle-l="{rects.res.x0 - THUMB_R}px"
			style:--stage-handle-r="{graphW - rects.res.x1 - THUMB_R}px"
		>
			<!-- Moving the RES slider leaves Immune. Only a CHANGE does: the field
			     writes its value back when you tab through it or press Escape, and
			     that must not quietly drop Immune. -->
			<InstrumentSlider
				label="Enemy {ELEMENT_NAME[element]} RES"
				aria="Enemy base resistance percent"
				bind:value={
					() => baseRes,
					(v) => {
						if (v !== baseRes) immune = false;
						baseRes = v;
					}
				}
				min={BASE_RES_MIN}
				max={BASE_RES_MAX}
				step={5}
				unit={immune ? '' : '%'}
				text={immune ? 'Immune' : null}
			/>
			<div class="chips dr-rungs" role="group" aria-label="Common RES values">
				{#each RES_RUNGS as r (r)}
					<button
						class="chip chip--sm"
						class:active={!immune && baseRes === r}
						onclick={() => {
							immune = false;
							baseRes = r;
						}}
					>
						{r}%
					</button>
				{/each}
				<button class="chip chip--sm" class:active={immune} onclick={() => (immune = !immune)}>
					Immune
				</button>
			</div>
		</div>

		<!-- The fine print: the product, and the regime the shred works in. -->
		<p class="stage-fine">
			{#if !immune}
				RES {fmtX(resNow)} and DEF {fmtX(defNow)}: {fmtX(total)} of your hit’s damage gets through.
				<!-- ⚓ The DEF caption's fact, kept: it surprises people, so it led
				     (docs/text/ledger/notes/vz_defres.md). -->
				{#if !ignoresDef}Equal levels already cost you half your damage.{/if}
			{/if}
			{regime}
			<span class="dr-formula"
				>RES: below 0%, 1−res/2; 0–75%, 1−res; from 75%, 1/(4·res+1). DEF: (100+yours) /
				((100+yours) + (100+enemy)·(1−shred)·(1−ignore)).</span
			>
		</p>
	</div>
</div>

<style>
	.dr-elements img {
		display: block;
	}

	.dr-panel.is-dim > :not(text:last-child) {
		opacity: 0.35;
	}

	.dr-drag {
		cursor: ew-resize;
	}

	.dr-dot-label.is-now {
		font-weight: var(--fw-semibold);
	}

	/* The common values ride the handle's line, at its right. */
	.dr-handle {
		position: relative;
	}

	.dr-rungs {
		gap: 2px;
		margin-top: 0.4rem;
	}

	.dr-handle.is-inline .dr-rungs {
		position: absolute;
		right: var(--stage-handle-r);
		bottom: 0;
		margin-top: 0;
	}

	.dr-rungs .chip {
		text-transform: none;
		font-variant-numeric: tabular-nums;
	}

	.dr-formula {
		display: block;
		margin-top: 0.2rem;
		font-size: var(--fs-sm);
		color: var(--chart-dim);
	}

	/* ── The Shred popover: three lists, each with its Other sources ── */
	.dr-shred-pop {
		gap: 1rem;
	}

	.dr-section-head {
		display: flex;
		justify-content: space-between;
		margin: 0 0 0.25rem;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	.dr-section-total {
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}

	.dr-list {
		display: grid;
		margin: 0 0 0.4rem;
		padding: 0;
		list-style: none;
	}

	.dr-source {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-height: 1.75rem;
	}

	.dr-source .check {
		min-width: 0;
		gap: 0.45rem;
		font-size: var(--fs-md);
	}

	.dr-source.is-on .dr-name {
		color: var(--text);
	}

	.dr-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dr-con,
	.dr-who {
		flex: none;
		font-size: var(--fs-sm);
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	.dr-amount {
		flex: none;
		font-size: var(--fs-md);
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}

	.dr-options {
		display: flex;
		flex: none;
		gap: 2px;
	}

	.dr-options .chip {
		text-transform: none;
		padding: 0.1rem 0.35rem;
		font-variant-numeric: tabular-nums;
	}

	.dr-none {
		font-size: var(--fs-md);
		color: var(--muted);
	}

	/* ── The DEF popover: two choices, each with what it covers ── */
	.dr-hits {
		display: grid;
		gap: 0.15rem;
	}

	.dr-hit {
		display: grid;
		gap: 0.1rem;
		padding: 0.35rem 0.5rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	@media (hover: hover) {
		.dr-hit:hover {
			background: color-mix(in srgb, var(--text) 7%, transparent);
		}
	}

	.dr-hit.is-on {
		background: color-mix(in srgb, var(--text) 12%, transparent);
	}

	.dr-hit:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.dr-hit-name {
		font-weight: var(--fw-semibold);
	}

	.dr-hit-detail {
		font-size: var(--fs-sm);
		color: var(--muted);
	}
</style>
