/**
 * src/lib/utils/timelineExport.ts
 *
 * "Copy timeline as PNG" — paints the rotation chart onto a canvas straight
 * from the same derived data the DOM renders, then hands back a PNG blob.
 *
 * Why canvas-2D and not DOM capture or SVG-serialize:
 *   - html2canvas chokes on color-mix() fills and inset box-shadows (the
 *     planner uses both), and captures only the scrolled viewport;
 *   - a serialized SVG needs IBM Plex Mono embedded as a data URI to rasterize
 *     with the right glyphs — canvas simply uses the document's loaded fonts.
 * Geometry comes from the caller's xForTime-derived snapshot, so the export
 * can never drift horizontally from the on-screen chart.
 *
 * ⚠ Colors here MIRROR the CSS in RotationTimeline.svelte (the same
 * keep-in-lockstep convention as elementColors.ts ↔ app.css). If a bar/lane
 * color changes there, change it here.
 */

import { elementPalette, shiftHue, waveHueScale } from '$lib/utils/elementColors';
import { barPhases } from '$lib/timeline/barPhases';
import type { TimelineBar, InputBlock } from '$lib/utils/notationParser';
import type {
	CharReceivedBuffSubrow,
	MoonsignRow,
	SummonSubrow,
	TeamBuffSubrow,
	WeaponProcSubrow
} from '$lib/timeline/types';

// ── Palette mirror (RotationTimeline.svelte <style>) ────────────────────────

const CHART_BG = '#081225';
const GRID = '#13203a';
const LANE_LINE = '#1c2a4a';
const ACTIVE = '#5a6180';
const TEXT = '#e6edf8';
const MUTED = '#9eacc8';
const TEAM_BUFF_FILL = '#1d3050';
const TEAM_BUFF_EDGE = '#6a96c0';
const TEAM_BUFF_LABEL = '#90b4d0';
const DEBUFF_FILL = '#371c22';
const DEBUFF_EDGE = '#c06464';
const DEBUFF_LABEL = '#d09098';
const PROC_FILL = '#2b2210';
const PROC_EDGE = 'rgba(200, 140, 40, 0.6)';
const PROC_LABEL = 'rgba(200, 140, 40, 0.8)';
const PORTRAIT_BG = '#131c30';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';
// Chart text follows the site's Sans-default (body font). Only the notation
// header (KQM notation) keeps MONO — mirrors the on-screen Sans/Mono split.
const SANS = '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif';

// ── Color math (stand-ins for CSS color-mix in srgb) ────────────────────────

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	const n = parseInt(
		h.length === 3
			? h
					.split('')
					.map((c) => c + c)
					.join('')
			: h,
		16
	);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** color-mix(in srgb, a pct%, b) */
function mix(a: string, b: string, pctA: number): string {
	const [ar, ag, ab] = hexToRgb(a);
	const [br, bg, bb] = hexToRgb(b);
	const t = pctA / 100;
	const r = Math.round(ar * t + br * (1 - t));
	const g = Math.round(ag * t + bg * (1 - t));
	const bl = Math.round(ab * t + bb * (1 - t));
	return `rgb(${r}, ${g}, ${bl})`;
}

// ── Snapshot shape (assembled by RotationTimeline from its deriveds) ────────

export type ExportBar = TimelineBar & { hasSummon: boolean };

export type ExportSlot = {
	displayName: string | null; // null = blank slot
	element: string | undefined;
	consLevel: number;
	blockH: number;
	qRowTop: number;
	activeRowTop: number;
	buffRowsTop: number;
	summonLaneTop: number;
	tracks: Array<{
		activeStart: number;
		activeEnd: number;
		hasUnsetDuration: boolean;
		inputBlocks: InputBlock[];
		eBars: ExportBar[];
		qBars: ExportBar[];
	}>;
	summonRows: SummonSubrow[];
	procRows: WeaponProcSubrow[];
	receivedRows: CharReceivedBuffSubrow[];
	/** Equipped artifact/weapon icon paths — drawn under the name so shared
	 *  images show who caused which buffs. */
	equipIcons: string[];
};

export type TimelineSnapshot = {
	title: string;
	/** The raw notation string — rendered as the export's header. */
	notation: string;
	scale: number;
	labelW: number;
	rulerH: number;
	totalWidth: number;
	contentH: number;
	ticks: Array<{ t: number; x: number; major: boolean }>;
	slots: ExportSlot[];
	slotTops: number[]; // offsets below ruler
	// Connectors, pre-resolved to geometry (from/to active-row edges)
	connectors: Array<{ x: number; w: number; yTop: number; yBottom: number; downward: boolean }>;
	eRowH: number;
	qRowH: number;
	activeRowH: number;
	buffRowH: number;
	buffRowStride: number;
	summonRowH: number;
	summonRowStride: number;
	charPadTop: number;
	teamBuffRows: TeamBuffSubrow[];
	teamBuffsTop: number;
	teamBuffsH: number;
	nbBars: Array<{ start: number; cooldown: number }>;
	nbTop: number | null; // null = lane hidden
	nbH: number;
	moonsignRows: MoonsignRow[];
	moonsignTop: number | null;
	moonsignH: number;
	statIconFor: (stat: string) => string | undefined;
	avatarFor: (slotIdx: number) => string | null;
	elementGlyphFor: (element: string | undefined) => string | null;
};

// ── Image preload ────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		img.src = src;
	});
}

/** Greedy word-wrap against the current ctx font. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
	if (!text) return [];
	const words = text.split(' ');
	const lines: string[] = [];
	let cur = '';
	for (const word of words) {
		const trial = cur ? `${cur} ${word}` : word;
		if (ctx.measureText(trial).width > maxW && cur) {
			lines.push(cur);
			cur = word;
		} else {
			cur = trial;
		}
	}
	if (cur) lines.push(cur);
	return lines;
}

// ── The painter ──────────────────────────────────────────────────────────────

const DPR = 2; // fixed 2× raster for crisp Discord/KQM embeds
const PAD = 16; // canvas padding around the chart
const FOOTER_H = 22; // watermark strip

export async function renderTimelinePng(snap: TimelineSnapshot): Promise<Blob> {
	await document.fonts.ready;

	// Preload every image the chart needs (portraits, glyphs, stat icons).
	const imageSrcs = new Set<string>();
	snap.slots.forEach((s, i) => {
		const a = snap.avatarFor(i);
		if (a) imageSrcs.add(a);
		const g = snap.elementGlyphFor(s.element);
		if (g) imageSrcs.add(g);
	});
	for (const row of snap.teamBuffRows) {
		const icon = snap.statIconFor(row.primaryStat);
		if (icon) imageSrcs.add(icon);
	}
	for (const slot of snap.slots) {
		for (const row of slot.receivedRows) {
			const icon = snap.statIconFor(row.primaryStat);
			if (icon) imageSrcs.add(icon);
		}
	}
	for (const slot of snap.slots) {
		for (const src of slot.equipIcons) imageSrcs.add(src);
	}
	const images = new Map<string, HTMLImageElement>();
	await Promise.all(
		[...imageSrcs].map(async (src) => {
			const img = await loadImage(src);
			if (img) images.set(src, img);
		})
	);

	const w = snap.labelW + snap.totalWidth + PAD * 2;

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('canvas 2d context unavailable');

	// Header: the notation itself, wrapped to the canvas width. Measured
	// before the canvas is sized (resizing resets ctx state anyway).
	const HEADER_LINE_H = 17;
	ctx.font = `11px ${MONO}`;
	const notationLines = wrapText(ctx, snap.notation.trim(), w - PAD * 2);
	const headerH = notationLines.length > 0 ? notationLines.length * HEADER_LINE_H + 14 : 0;

	const h = headerH + snap.contentH + PAD * 2 + FOOTER_H;
	canvas.width = w * DPR;
	canvas.height = h * DPR;
	ctx.scale(DPR, DPR);

	// Ground
	ctx.fillStyle = CHART_BG;
	ctx.fillRect(0, 0, w, h);

	// Notation header
	ctx.font = `11px ${MONO}`;
	ctx.fillStyle = 'rgba(230, 237, 248, 0.85)';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	notationLines.forEach((line, i) => {
		ctx.fillText(line, PAD, PAD + 8 + i * HEADER_LINE_H);
	});

	// Chart origin (tracks area starts right of the label column, below header)
	const ox = PAD + snap.labelW;
	const oy = PAD + headerH;

	const x = (t: number) => ox + Math.round(t * snap.scale);

	// ── Gridlines (z:0) ──
	ctx.strokeStyle = GRID;
	ctx.lineWidth = 1;
	for (const tick of snap.ticks) {
		if (!tick.major) continue;
		ctx.beginPath();
		ctx.moveTo(ox + tick.x + 0.5, oy + snap.rulerH);
		ctx.lineTo(ox + tick.x + 0.5, oy + snap.contentH);
		ctx.stroke();
	}

	// ── Ruler ──
	ctx.textBaseline = 'alphabetic';
	for (const tick of snap.ticks) {
		ctx.fillStyle = tick.major ? '#35486e' : '#22304c';
		const th = tick.major ? 8 : 4;
		ctx.fillRect(ox + tick.x, oy + snap.rulerH - th, 1, th);
		if (tick.major && tick.t > 0) {
			ctx.fillStyle = MUTED;
			ctx.font = `10px ${SANS}`;
			ctx.textAlign = 'center';
			ctx.fillText(`${tick.t}s`, ox + tick.x, oy + snap.rulerH - 11);
		}
	}
	ctx.strokeStyle = LANE_LINE;
	ctx.beginPath();
	ctx.moveTo(ox, oy + snap.rulerH + 0.5);
	ctx.lineTo(ox + snap.totalWidth, oy + snap.rulerH + 0.5);
	ctx.stroke();

	// Rounded-rect helper (uniform radius)
	function rr(px: number, py: number, pw: number, ph: number, r: number) {
		ctx!.beginPath();
		ctx!.roundRect(px, py, pw, ph, r);
	}

	// Width = difference of rounded endpoints (mirrors barGeom in the
	// timeline) so adjacent segments telescope at every zoom.
	const barGeomW = (start: number, span: number) => Math.max(x(start + span) - x(start), 2);

	// Cast pill / summon fill — mirrors castFill(): flat element base, a warm
	// hue-rotated wave (+18° damped per-element, 373px tile) beating against
	// a cool counter-wave (−18°, 277px tile), under the vertical top-light
	// (10% white → 58%).
	function paintCastFill(
		px: number,
		py: number,
		pw: number,
		ph: number,
		main: string,
		element: string | undefined
	) {
		const deg = 18 * waveHueScale(element);
		const warm = (a: number) => shiftHue(main, deg, 3, a);
		const cool = (a: number) => shiftHue(main, -deg, -2, a);
		ctx!.save();
		rr(px, py, pw, ph, 1);
		ctx!.clip();
		ctx!.fillStyle = main;
		ctx!.fillRect(px, py, pw, ph);
		tileLinear(px, py, pw, ph, 373, [
			[0, warm(0)],
			[0.3, warm(0.5)],
			[0.55, warm(0.4)],
			[1, warm(0)]
		]);
		tileLinear(px, py, pw, ph, 277, [
			[0, cool(0)],
			[0.55, cool(0.45)],
			[1, cool(0)]
		]);
		const light = ctx!.createLinearGradient(0, py, 0, py + ph);
		light.addColorStop(0, 'rgba(255,255,255,0.1)');
		light.addColorStop(0.58, 'rgba(255,255,255,0)');
		light.addColorStop(1, 'rgba(255,255,255,0)');
		ctx!.fillStyle = light;
		ctx!.fillRect(px, py, pw, ph);
		ctx!.restore();
	}

	// Bar-label halo — mirrors the shared on-screen text-shadow: a soft halo
	// in a dark shade of the bar's own element color (NB/moonsign pin their
	// darkest palette color) so full-white labels read on light fills.
	// Two passes, one per shadow layer; the second also lays the final fill.
	// `tight` = 0 1px 2px @ 0.25; `wide` = 0 0 6px @ 0.5 (mirrors the CSS).
	function haloText(
		text: string,
		tx: number,
		ty: number,
		tight: string,
		wide: string,
		maxW?: number
	) {
		ctx!.save();
		ctx!.shadowColor = wide;
		ctx!.shadowBlur = 6;
		if (maxW !== undefined) ctx!.fillText(text, tx, ty, maxW);
		else ctx!.fillText(text, tx, ty);
		ctx!.shadowColor = tight;
		ctx!.shadowBlur = 2;
		ctx!.shadowOffsetY = 1;
		if (maxW !== undefined) ctx!.fillText(text, tx, ty, maxW);
		else ctx!.fillText(text, tx, ty);
		ctx!.restore();
	}

	/** The two halo shadow colors for an element-main hex (dark shade, −30 L) */
	function elementHalo(main: string): [string, string] {
		return [shiftHue(main, 0, -30, 0.25), shiftHue(main, 0, -30, 0.5)];
	}

	// ── NB / Moonsign layered-tile fills — mirror the on-screen CSS ──
	// (repeat-x px tiles; angles flattened to horizontal — invisible at 14px)

	/** rgba() with alpha, from a hex color */
	const alpha = (hex: string, a: number) => {
		const [r, g, b] = hexToRgb(hex);
		return `rgba(${r}, ${g}, ${b}, ${a})`;
	};

	// NB/moonsign label halos pin each lane's darkest palette color
	const NB_HALO_TIGHT = alpha('#f85b21', 0.25);
	const NB_HALO_WIDE = alpha('#f85b21', 0.5);
	const MOONSIGN_HALO_TIGHT = alpha('#0a6cf4', 0.25);
	const MOONSIGN_HALO_WIDE = alpha('#0a6cf4', 0.5);

	/** One tiling linear-gradient layer painted across a clipped bar */
	function tileLinear(
		px: number,
		py: number,
		pw: number,
		ph: number,
		tileW: number,
		stops: Array<[number, string]>
	) {
		for (let ox = 0; ox < pw; ox += tileW) {
			const g = ctx!.createLinearGradient(px + ox, 0, px + ox + tileW, 0);
			for (const [at, c] of stops) g.addColorStop(at, c);
			ctx!.fillStyle = g;
			ctx!.fillRect(px + ox, py, Math.min(tileW, pw - ox), ph);
		}
	}

	/** One tiling soft elliptical bloom layer (cx px / cy fraction per tile) */
	function tileBloom(
		px: number,
		py: number,
		pw: number,
		ph: number,
		tileW: number,
		cx: number,
		cyFrac: number,
		rx: number,
		ry: number,
		color: string,
		fade: number
	) {
		for (let ox = cx; ox < pw + rx; ox += tileW) {
			ctx!.save();
			ctx!.translate(px + ox, py + cyFrac * ph);
			ctx!.scale(rx, ry);
			const g = ctx!.createRadialGradient(0, 0, 0, 0, 0, 1);
			g.addColorStop(0, color);
			g.addColorStop(fade, alpha(color, 0));
			g.addColorStop(1, alpha(color, 0));
			ctx!.fillStyle = g;
			ctx!.fillRect(-1, -1, 2, 2);
			ctx!.restore();
		}
	}

	/** Phlogiston NB fill — mirrors .rp-nb-bar */
	function paintNbBar(px: number, py: number, pw: number, ph: number) {
		ctx!.save();
		rr(px, py, pw, ph, 1);
		ctx!.clip();
		ctx!.fillStyle = '#f85b21';
		ctx!.fillRect(px, py, pw, ph);
		tileLinear(px, py, pw, ph, 251, [
			[0, '#f85b21'],
			[0.24, '#e1a566'],
			[0.46, '#f85b21'],
			[0.65, mix('#f85b21', '#e1a566', 55)],
			[0.82, '#e1a566'],
			[1, '#f85b21']
		]);
		tileBloom(px, py, pw, ph, 127, 15, 0.25, 26, 10, '#e1a566', 0.7);
		tileBloom(px, py, pw, ph, 173, 60, 0.75, 34, 12, '#e1a566', 0.72);
		tileBloom(px, py, pw, ph, 211, 160, 0.3, 24, 12, mix('#70e1c1', '#e1a566', 55), 0.82);
		ctx!.restore();
	}

	/** Moon-gravity-wave fill — mirrors .rp-moonsign-bar */
	function paintMoonsignBar(px: number, py: number, pw: number, ph: number) {
		ctx!.save();
		rr(px, py, pw, ph, 1);
		ctx!.clip();
		tileLinear(px, py, pw, ph, 719, [
			[0, '#0a6cf4'],
			[0.125, '#35d1f3'],
			[0.25, '#81ddc7'],
			[0.375, '#fffcd3'],
			[0.5, '#fced5c'],
			[0.625, '#fffcd3'],
			[0.75, '#81ddc7'],
			[0.875, '#35d1f3'],
			[1, '#0a6cf4']
		]);
		tileLinear(px, py, pw, ph, 433, [
			[0, alpha('#35d1f3', 0)],
			[0.3, alpha('#81ddc7', 0.3)],
			[0.5, alpha('#fffcd3', 0.4)],
			[0.7, alpha('#81ddc7', 0.3)],
			[1, alpha('#35d1f3', 0)]
		]);
		ctx!.restore();
	}

	// ── Per-slot ghost CD tracks first (z:0), then connectors (z:1),
	//    then solid bars (z:2) — the on-screen sandwich. ──

	type GhostDraw = { px: number; pw: number; py: number; ph: number; main: string; cd: number };
	const ghosts: GhostDraw[] = [];

	function collectBarPhases(
		bar: ExportBar,
		rowTop: number,
		rowH: number,
		main: string,
		element: string | undefined,
		badge: string,
		solids: Array<() => void>
	) {
		const py = rowTop + 1;
		const ph = rowH - 2;
		const ghostY = rowTop + 4;
		const ghostH = rowH - 8;

		const drawSolid = (start: number, span: number, dim: boolean) => {
			solids.push(() => {
				const px = x(start);
				const pw = barGeomW(start, span);
				if (dim) {
					ctx!.fillStyle = mix(main, CHART_BG, 65);
					rr(px, py, pw, ph, 1);
					ctx!.fill();
				} else {
					paintCastFill(px, py, pw, ph, main, element);
				}
				ctx!.fillStyle = '#fff';
				ctx!.font = `700 9px ${SANS}`;
				ctx!.textAlign = 'left';
				haloText(badge, px + 4, py + ph / 2 + 3, ...elementHalo(main));
			});
		};
		const pushGhost = (start: number, span: number, cd: number) => {
			ghosts.push({
				px: x(start),
				pw: barGeomW(start, span),
				py: ghostY,
				ph: ghostH,
				main,
				cd
			});
		};

		// Shared phase geometry (barPhases.ts). The canvas projection keeps its
		// own styling: drawSolid always stamps the badge + radius-1; ghost tracks
		// paint below. `uptimeDim`/`overflow` are the dim continuation tones.
		for (const seg of barPhases(bar, bar.hasSummon)) {
			if (seg.role === 'ghost') {
				pushGhost(seg.start, seg.span, seg.cooldown ?? 0);
			} else {
				const dim = seg.role === 'uptimeDim' || seg.role === 'overflow';
				drawSolid(seg.start, seg.span, dim);
			}
		}
	}

	const solidDraws: Array<() => void> = [];

	snap.slots.forEach((slot, si) => {
		const top = oy + snap.rulerH + snap.slotTops[si];
		const p = elementPalette(slot.element);

		for (const track of slot.tracks) {
			for (const bar of track.eBars)
				collectBarPhases(
					bar,
					top + snap.charPadTop,
					snap.eRowH,
					p.main,
					slot.element,
					bar.label,
					solidDraws
				);
			for (const bar of track.qBars)
				collectBarPhases(
					bar,
					top + slot.qRowTop,
					snap.qRowH,
					p.main,
					slot.element,
					bar.label,
					solidDraws
				);
		}

		// Active strip + input blocks (solid layer)
		for (const track of slot.tracks) {
			const rowTop = top + slot.activeRowTop;
			solidDraws.push(() => {
				const left = x(track.activeStart);
				const width = Math.max(x(track.activeEnd) - left, 4);
				ctx!.fillStyle = ACTIVE;
				if (track.hasUnsetDuration) {
					ctx!.strokeStyle = ACTIVE;
					ctx!.setLineDash([3, 3]);
					ctx!.strokeRect(left + 0.5, rowTop + 1.5, width - 1, snap.activeRowH - 3);
					ctx!.setLineDash([]);
				} else {
					ctx!.fillRect(left, rowTop + 1, width, snap.activeRowH - 2);
				}
				track.inputBlocks.forEach((block, bi) => {
					const bx = x(block.start);
					const bw = barGeomW(block.start, block.duration);
					const kind = block.kind;
					if (kind === 'skill' || kind === 'burst' || kind === 'elemental-normal') {
						ctx!.fillStyle = mix(p.main, ACTIVE, 50);
					} else if (kind === 'movement') {
						ctx!.fillStyle = 'rgba(90, 97, 128, 0.45)';
					} else if (kind === 'unset') {
						return;
					} else {
						ctx!.fillStyle = ACTIVE;
					}
					ctx!.fillRect(bx, rowTop + 1, bw, snap.activeRowH - 2);
					// gap divider — none on the last block, so the strip meets its
					// swap connector seamlessly (mirrors the on-screen rule)
					if (bi !== track.inputBlocks.length - 1) {
						ctx!.fillStyle = 'rgba(8, 18, 37, 0.25)';
						ctx!.fillRect(bx + bw - 1, rowTop + 1, 1, snap.activeRowH - 2);
					}
					// label
					ctx!.fillStyle = 'rgba(255,255,255,0.85)';
					ctx!.font = `600 10px ${SANS}`;
					ctx!.textAlign = 'left';
					ctx!.fillText(block.parts.join(''), bx + 4, rowTop + snap.activeRowH / 2 + 3, bw - 6);
				});
			});
		}

		// Summon lane (solid layer, opaque mix)
		slot.summonRows.forEach((srow, ri) => {
			const rowTop = top + slot.summonLaneTop + ri * snap.summonRowStride;
			solidDraws.push(() => {
				for (const sbar of srow.bars) {
					const px = x(sbar.start);
					const pw = barGeomW(sbar.start, sbar.end - sbar.start);
					// Full-strength castFill — same finish as the E/Q pills
					paintCastFill(px, rowTop + 1, pw, snap.summonRowH - 2, p.main, slot.element);
					ctx!.fillStyle = '#fff';
					ctx!.font = `700 9px ${SANS}`;
					ctx!.textAlign = 'left';
					haloText(
						srow.label,
						px + 4,
						rowTop + snap.summonRowH / 2 + 3,
						...elementHalo(p.main),
						Math.max(pw - 6, 8)
					);
					// Bottom-anchored tick stubs — mirror .rp-summon-tick
					ctx!.fillStyle = p.hi;
					ctx!.globalAlpha = 0.85;
					const th = Math.round(snap.summonRowH * 0.4);
					for (const tickT of sbar.ticks) {
						ctx!.fillRect(x(tickT), rowTop + snap.summonRowH - 1 - th, 1, th);
					}
					ctx!.globalAlpha = 1;
				}
			});
		});

		// Proc + received buff rows (solid layer)
		const buffTop = top + slot.buffRowsTop;
		slot.procRows.forEach((row, pi) => {
			const rowTop = buffTop + pi * snap.buffRowStride;
			solidDraws.push(() => {
				for (const bar of row.bars) {
					drawLaneBar(
						x(bar.start),
						rowTop,
						barGeomW(bar.start, bar.end - bar.start),
						snap.buffRowH,
						PROC_FILL,
						PROC_EDGE,
						PROC_LABEL,
						`${row.label} trigger CD`,
						undefined
					);
				}
			});
		});
		slot.receivedRows.forEach((row, ri) => {
			const rowTop = buffTop + (slot.procRows.length + ri) * snap.buffRowStride;
			const icon = snap.statIconFor(row.primaryStat);
			solidDraws.push(() => {
				for (const bar of row.bars) {
					drawLaneBar(
						x(bar.start),
						rowTop,
						barGeomW(bar.start, bar.end - bar.start),
						snap.buffRowH,
						TEAM_BUFF_FILL,
						TEAM_BUFF_EDGE,
						TEAM_BUFF_LABEL,
						bar.sourceLabel,
						icon ? images.get(icon) : undefined
					);
				}
			});
		});
	});

	// Lane bar helper (team buff / proc / received): solid fill + hairline ring
	// + 2px left edge + optional icon + label
	function drawLaneBar(
		px: number,
		py: number,
		pw: number,
		ph: number,
		fill: string,
		edge: string,
		labelColor: string,
		label: string,
		icon: HTMLImageElement | undefined
	) {
		ctx!.fillStyle = fill;
		rr(px, py, pw, ph, 1);
		ctx!.fill();
		ctx!.strokeStyle = 'rgba(255,255,255,0.07)';
		ctx!.lineWidth = 1;
		rr(px + 0.5, py + 0.5, pw - 1, ph - 1, 1);
		ctx!.stroke();
		ctx!.fillStyle = edge;
		ctx!.fillRect(px, py, 2, ph);
		let tx = px + 5;
		if (icon && pw > 24) {
			ctx!.drawImage(icon, tx, py + (ph - 11) / 2, 11, 11);
			tx += 15;
		}
		ctx!.save();
		ctx!.beginPath();
		ctx!.rect(px, py, pw - 2, ph);
		ctx!.clip();
		ctx!.fillStyle = labelColor;
		ctx!.font = `600 9px ${SANS}`;
		ctx!.textAlign = 'left';
		ctx!.fillText(label, tx, py + ph / 2 + 3);
		ctx!.restore();
	}

	// ── Lane separators (horizontal) — drawn BEFORE bars/connectors so the
	//    connectors span slot boundaries uninterrupted (matches on-screen
	//    stacking, where positioned bars paint above the container borders) ──
	ctx.strokeStyle = LANE_LINE;
	const hline = (yy: number) => {
		ctx.beginPath();
		ctx.moveTo(PAD, yy + 0.5);
		ctx.lineTo(ox + snap.totalWidth, yy + 0.5);
		ctx.stroke();
	};
	snap.slots.forEach((slot, si) => {
		hline(oy + snap.rulerH + snap.slotTops[si] + slot.blockH);
	});
	hline(oy + snap.rulerH + snap.teamBuffsTop + snap.teamBuffsH);
	if (snap.nbTop !== null) hline(oy + snap.rulerH + snap.nbTop + snap.nbH);
	if (snap.moonsignTop !== null) hline(oy + snap.rulerH + snap.moonsignTop + snap.moonsignH);

	// z:0 — ghosts
	for (const g of ghosts) {
		ctx.fillStyle = mix(g.main, CHART_BG, 20);
		rr(g.px, g.py, g.pw, g.ph, 1);
		ctx.fill();
		// ready notch
		ctx.fillStyle = mix(g.main, CHART_BG, 45);
		ctx.fillRect(g.px + g.pw - 1, g.py, 1, g.ph);
		if (g.pw > 32) {
			ctx.fillStyle = '#fff';
			ctx.font = `600 9px ${SANS}`;
			ctx.textAlign = 'center';
			haloText(
				`${Math.round(g.cd * 10) / 10}s`,
				g.px + g.pw / 2,
				g.py + g.ph / 2 + 3,
				...elementHalo(g.main)
			);
		}
	}

	// z:1 — connectors
	ctx.fillStyle = ACTIVE;
	for (const c of snap.connectors) {
		const cx = ox + c.x;
		const yT = oy + c.yTop;
		const yB = oy + c.yBottom;
		const r = Math.min(3, Math.floor(c.w / 2));
		ctx.beginPath();
		if (c.downward) {
			ctx.moveTo(cx, yT);
			ctx.lineTo(cx + c.w - r, yT);
			ctx.quadraticCurveTo(cx + c.w, yT, cx + c.w, yT + r);
			ctx.lineTo(cx + c.w, yB);
			ctx.lineTo(cx + r, yB);
			ctx.quadraticCurveTo(cx, yB, cx, yB - r);
		} else {
			ctx.moveTo(cx + r, yT);
			ctx.lineTo(cx + c.w, yT);
			ctx.lineTo(cx + c.w, yB - r);
			ctx.quadraticCurveTo(cx + c.w, yB, cx + c.w - r, yB);
			ctx.lineTo(cx, yB);
			ctx.lineTo(cx, yT + r);
			ctx.quadraticCurveTo(cx, yT, cx + r, yT);
		}
		ctx.closePath();
		ctx.fill();
	}

	// z:2 — solids
	for (const draw of solidDraws) draw();

	// ── Below-timeline lanes ──
	// Team buffs
	{
		const laneTop = oy + snap.rulerH + snap.teamBuffsTop;
		snap.teamBuffRows.forEach((subrow, ri) => {
			const rowTop = laneTop + 2 + ri * snap.buffRowStride;
			const isDebuff = subrow.kind === 'debuff';
			const icon = snap.statIconFor(subrow.primaryStat);
			for (const bar of subrow.bars) {
				drawLaneBar(
					x(bar.start),
					rowTop,
					barGeomW(bar.start, bar.end - bar.start),
					snap.buffRowH,
					isDebuff ? DEBUFF_FILL : TEAM_BUFF_FILL,
					isDebuff ? DEBUFF_EDGE : TEAM_BUFF_EDGE,
					isDebuff ? DEBUFF_LABEL : TEAM_BUFF_LABEL,
					subrow.sourceLabel,
					icon ? images.get(icon) : undefined
				);
			}
		});
	}
	// NB lane (phlogiston fill, matching on-screen)
	if (snap.nbTop !== null) {
		const laneTop = oy + snap.rulerH + snap.nbTop + 2;
		for (const ev of snap.nbBars) {
			const px = x(ev.start);
			const pw = barGeomW(ev.start, ev.cooldown);
			paintNbBar(px, laneTop, pw, snap.buffRowH);
			ctx.fillStyle = '#fff';
			ctx.font = `600 9px ${SANS}`;
			ctx.textAlign = 'left';
			haloText('NB', px + 5, laneTop + snap.buffRowH / 2 + 3, NB_HALO_TIGHT, NB_HALO_WIDE);
			if (pw > 40) {
				ctx.fillStyle = '#fff';
				ctx.textAlign = 'center';
				haloText(
					`${ev.cooldown}s`,
					px + pw / 2,
					laneTop + snap.buffRowH / 2 + 3,
					NB_HALO_TIGHT,
					NB_HALO_WIDE
				);
			}
		}
	}
	// Moonsign lane
	if (snap.moonsignTop !== null) {
		snap.moonsignRows.forEach((row, ri) => {
			const rowTop = oy + snap.rulerH + snap.moonsignTop! + 2 + ri * snap.buffRowStride;
			for (const win of row.windows) {
				paintMoonsignBar(x(win.start), rowTop, barGeomW(win.start, win.duration), snap.buffRowH);
			}
			// Label on the first window — mirrors .rp-moonsign-label (near-white
			// with the shared halo, like every other bar label)
			const first = row.windows[0];
			if (first) {
				ctx.fillStyle = '#fff';
				ctx.font = `600 9px ${SANS}`;
				ctx.textAlign = 'left';
				const name = snap.slots[row.slotIdx]?.displayName ?? '';
				haloText(
					`${name} · Ascendant Gleam`,
					x(first.start) + 4,
					rowTop + snap.buffRowH / 2 + 3,
					MOONSIGN_HALO_TIGHT,
					MOONSIGN_HALO_WIDE
				);
			}
		});
	}

	// ── Label column ──
	// Opaque backing (below the notation header) so long ghost bars never
	// bleed under the labels
	ctx.fillStyle = CHART_BG;
	ctx.fillRect(0, oy, PAD + snap.labelW, h - oy);

	snap.slots.forEach((slot, si) => {
		const top = oy + snap.rulerH + snap.slotTops[si];
		const p = elementPalette(slot.element);
		const cx = PAD + 8;

		// Portrait: circle clip + neutral backing + element ring
		const size = 54;
		const px = PAD + (snap.labelW - size) / 2 - 8;
		const py = top + Math.max((slot.blockH - size) / 2 - 16, 8);
		ctx.save();
		ctx.beginPath();
		ctx.arc(px + size / 2, py + size / 2, size / 2, 0, Math.PI * 2);
		ctx.clip();
		ctx.fillStyle = PORTRAIT_BG;
		ctx.fill();
		const avatarSrc = snap.avatarFor(si);
		const avatar = avatarSrc ? images.get(avatarSrc) : undefined;
		if (avatar) {
			// mirror .rp-avatar-img: scale(1.333) translateY(-14%)
			const s = size * 1.333;
			ctx.drawImage(avatar, px + (size - s) / 2, py + (size - s) / 2 - size * 0.14, s, s);
		}
		ctx.restore();
		ctx.strokeStyle = p.main;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(px + size / 2, py + size / 2, size / 2 - 0.75, 0, Math.PI * 2);
		ctx.stroke();

		// Glyph + name + Cn under the portrait
		const nameY = py + size + 16;
		const glyphSrc = snap.elementGlyphFor(slot.element);
		const glyph = glyphSrc ? images.get(glyphSrc) : undefined;
		let tx = cx;
		if (glyph) {
			ctx.drawImage(glyph, tx, nameY - 10, 13, 13);
			tx += 16;
		}
		ctx.fillStyle = slot.displayName ? TEXT : MUTED;
		ctx.font = `600 11px ${SANS}`;
		ctx.textAlign = 'left';
		ctx.fillText(slot.displayName ?? 'Empty', tx, nameY, snap.labelW - 44);
		if (slot.displayName) {
			ctx.fillStyle = slot.consLevel > 0 ? p.main : MUTED;
			ctx.font = `700 9px ${SANS}`;
			ctx.textAlign = 'right';
			ctx.fillText(`C${slot.consLevel}`, PAD + snap.labelW - 10, nameY);
		}

		// Equipped artifact/weapon icons — who caused which buffs
		slot.equipIcons.forEach((src, ei) => {
			const icon = images.get(src);
			if (icon) ctx.drawImage(icon, cx + ei * 24, nameY + 8, 20, 20);
		});
	});

	// Lane labels
	ctx.fillStyle = MUTED;
	ctx.font = `600 9px ${SANS}`;
	ctx.textAlign = 'right';
	const laneLabelX = PAD + snap.labelW - 10;
	ctx.fillText(
		'TEAM BUFFS',
		laneLabelX,
		oy + snap.rulerH + snap.teamBuffsTop + snap.teamBuffsH / 2 + 3
	);
	if (snap.nbTop !== null)
		ctx.fillText('NIGHTSOUL', laneLabelX, oy + snap.rulerH + snap.nbTop + snap.nbH / 2 + 3);
	if (snap.moonsignTop !== null)
		ctx.fillText(
			'MOONSIGN',
			laneLabelX,
			oy + snap.rulerH + snap.moonsignTop + snap.moonsignH / 2 + 3
		);

	// ── Footer: title left, watermark right ──
	const fy = h - PAD / 2 - 4;
	ctx.fillStyle = MUTED;
	ctx.font = `600 10px ${SANS}`;
	ctx.textAlign = 'left';
	ctx.fillText(snap.title, PAD, fy);
	ctx.fillStyle = 'rgba(158, 172, 200, 0.55)';
	ctx.textAlign = 'right';
	ctx.fillText('critcalc.app', w - PAD, fy);

	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error('toBlob failed'));
		}, 'image/png');
	});
}

/**
 * Deliver the PNG. mode 'copy' tries the clipboard and silently falls back to
 * a download when the browser refuses; mode 'download' goes straight to disk.
 * Returns what actually happened.
 */
export async function deliverPng(
	blob: Blob,
	filename: string,
	mode: 'copy' | 'download'
): Promise<'copied' | 'downloaded'> {
	if (mode === 'copy') {
		try {
			if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
				await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
				return 'copied';
			}
		} catch {
			// fall through to download
		}
	}
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
	return 'downloaded';
}
