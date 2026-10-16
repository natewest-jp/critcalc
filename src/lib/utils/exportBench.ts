/**
 * src/lib/utils/exportBench.ts
 *
 * THE BENCH IN THE PNG EXPORT (2026-10-16, ⚓ Nate: "bench seriously revamped
 * — a direct copy of our actual bench is totally fine"). It replaces the
 * export's old label column (a round portrait, an element ring, a bare "C0").
 *
 * A COPY, not a cousin: the ribbon is drawn from the SAME generated paths the
 * live strip clips and frames itself with (`ribbonClipPath`,
 * `ribbonFramePath`, Nate's transcribed tail included), and every card number
 * below is the live card's (SlotPortrait.svelte / SidePortrait.svelte), named
 * where it is read. Colours are the live ROLES, resolved from the page at
 * export time (`resolveRoles`), so a palette change reaches the PNG with no
 * mirror to update.
 *
 * What it leaves out, on purpose: the hover-only magnifier, and artifact and
 * weapon NAMES (⚓ Nate: the icons are what the card shows; names would
 * crowd it).
 */

import {
	BENCH_CARD_W,
	CARD_PORTRAIT,
	RIBBON_CHROME,
	RIBBON_FRAME_R_TIGHT,
	RIBBON_TAIL_H,
	RIBBON_W,
	ribbonClipPath,
	ribbonFramePath
} from '$lib/benchBand.svelte';
import { sideLayout } from '$lib/sidePortrait';
import {
	CON_MARK_ASPECT,
	CON_MARK_PATHS,
	CON_MARK_VIEWBOX
} from '$lib/constellationMarks.generated';
import { MARK_NODES, MARK_VIEWBOX } from '$lib/marks.generated';
import { elementPalette } from '$lib/utils/elementColors';

export type ExportBenchCard = {
	/** null = an empty slot (the blank side portrait, no name, inert controls). */
	displayName: string | null;
	element: string | undefined;
	/** The side-portrait art URL (the blank one for an empty slot). */
	sideArt: string | null;
	conLevel: number;
	/** The rotation asks for more than the roster owns (or for someone not owned). */
	conShort: boolean;
	uncurated: boolean;
	artifactIcon: string;
	artifactSet: boolean;
	weaponIcon: string;
	weaponSet: boolean;
	refinement: number;
};

/** The live roles the bench paints with, resolved off the page. */
export type BenchRoles = {
	surface: string;
	well: string;
	lineStrong: string;
	lineSoft: string;
	frameLine: string;
	text: string;
	muted: string;
	provisional: string;
};

/**
 * Resolve the bench's colour ROLES as the page has them, under `.ctx-dark`
 * (the strip's context). Each is read through a 1×1 canvas fill, never
 * string-parsed — Chrome serialises a mixed colour as `color(srgb …)`, the
 * same trap sceneGL's `resolveColor` steps around.
 */
export function resolveRoles(): BenchRoles {
	const probe = document.createElement('span');
	probe.className = 'ctx-dark';
	probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
	document.body.appendChild(probe);
	const c = document.createElement('canvas');
	c.width = c.height = 1;
	const cx = c.getContext('2d', { willReadFrequently: true })!;
	const read = (role: string, fallback: string) => {
		probe.style.color = `var(${role}, ${fallback})`;
		cx.clearRect(0, 0, 1, 1);
		cx.fillStyle = getComputedStyle(probe).color;
		cx.fillRect(0, 0, 1, 1);
		const [r, g, b] = cx.getImageData(0, 0, 1, 1).data;
		return `rgb(${r}, ${g}, ${b})`;
	};
	const roles: BenchRoles = {
		surface: read('--surface', '#262c3a'),
		well: read('--surface-well', '#1f2635'),
		lineStrong: read('--line-strong', '#5b6170'),
		lineSoft: read('--line-soft', '#414752'),
		frameLine: read('--frame-line-quiet', '#414752'),
		text: read('--text', '#ece5d8'),
		muted: read('--muted', '#b7b4ae'),
		provisional: read('--ui-provisional', '#f6d365')
	};
	probe.remove();
	return roles;
}

/** Every image URL the bench will draw — the caller preloads them. */
export function benchImageSources(cards: ExportBenchCard[]): string[] {
	return cards
		.flatMap((c) => [c.sideArt, c.artifactIcon, c.weaponIcon])
		.filter(Boolean) as string[];
}

// ── The live card's numbers (SlotPortrait.svelte) ──────────────────────────
const CARD_PAD_TOP = 8; // .sp-card padding-top
const CARD_PAD_X = 6; // .sp-card padding-left/right
const COL_INSET = 6; // --sp-col-inset
const COL_DROP = 3; // --sp-col-drop
const NAME_INSET = 4; // --sp-name-inset
const NAME_PX = 14; // --fs-lg
const NAME_LH = 1.2; // --lh-tight
const COL_GAP = 1; // --sp-gap
const PILL_H = 26; // --sp-pill-h
const PILL_PAD = 3; // .sp-loadout padding-inline
const ZONE_W = 24; // .sp-lo-zone width
const ZONE_GAP = 1; // .sp-loadout gap
const CHIP_H = 14; // .sp-disc-con height
const CHIP_PAD = 4; // .sp-disc-con padding-inline
const CHIP_MARK_H = 7; // <ConMark height={7}>
const ART_FADE_RIGHT = 6; // SidePortrait fadeRight on the desk card
const ART_FADE_W = 8; // SidePortrait FADE_W
const RING_W = 2; // .spt-disc border
const SANS = '"IBM Plex Sans Variable", "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif';

const conPaths = (level: number) =>
	CON_MARK_PATHS[Math.min(6, Math.max(0, Math.round(level)))].map((d) => new Path2D(d));
const CON_VB_H = Number(CON_MARK_VIEWBOX.split(' ')[3]);

/** A stroked Lucide mark (marks.generated.ts), at `size` px, in `color`. */
function drawMark(
	ctx: CanvasRenderingContext2D,
	name: keyof typeof MARK_NODES,
	x: number,
	y: number,
	size: number,
	color: string
) {
	const k = size / MARK_VIEWBOX;
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(k, k);
	ctx.strokeStyle = color;
	ctx.lineWidth = 1.15 / k; // the marks' one line (1.15px, non-scaling)
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	for (const [tag, a] of MARK_NODES[name]) {
		ctx.beginPath();
		if (tag === 'path') ctx.stroke(new Path2D(a.d));
		else if (tag === 'circle') {
			ctx.arc(+a.cx, +a.cy, +a.r, 0, Math.PI * 2);
			ctx.stroke();
		}
	}
	ctx.restore();
}

/** Greedy wrap to at most two lines (the card's `-webkit-line-clamp: 2`). */
function wrapName(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
	const words = text.split(' ');
	const lines: string[] = [];
	let cur = '';
	for (const word of words) {
		const trial = cur ? `${cur} ${word}` : word;
		if (ctx.measureText(trial).width > maxW && cur) {
			lines.push(cur);
			cur = word;
		} else cur = trial;
	}
	if (cur) lines.push(cur);
	return lines.slice(0, 2);
}

/**
 * Paint the ribbon at (`x`, `y`) in CSS px: `head` px of ribbon above the
 * first card (the live strip's head, which lines the cards up with their
 * track groups), then one card per slot at `slotHeights[i]`, then Nate's tail.
 * Returns the ribbon's height.
 */
export function paintBench(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	head: number,
	slotHeights: number[],
	cards: ExportBenchCard[],
	images: Map<string, HTMLImageElement>,
	roles: BenchRoles
): number {
	const h = RIBBON_CHROME + head + slotHeights.reduce((a, b) => a + b, 0) + RIBBON_TAIL_H;

	ctx.save();
	ctx.translate(x, y);
	// The ground (--surface, opaque slate) and the tight frame ring, exactly
	// as BenchBand draws the desk column (⚓ Nate 2026-10-14: no wide arc).
	ctx.fillStyle = roles.surface;
	ctx.fill(new Path2D(ribbonClipPath(h)));
	ctx.fillStyle = roles.frameLine;
	ctx.fill(new Path2D(ribbonFramePath(h, RIBBON_FRAME_R_TIGHT)), 'evenodd');

	let top = RIBBON_CHROME + head;
	cards.forEach((card, i) => {
		paintCard(ctx, RIBBON_CHROME, top, card, images, roles);
		top += slotHeights[i];
	});
	ctx.restore();
	return h;
}

function paintCard(
	ctx: CanvasRenderingContext2D,
	cellX: number,
	cellY: number,
	card: ExportBenchCard,
	images: Map<string, HTMLImageElement>,
	roles: BenchRoles
) {
	const d = CARD_PORTRAIT;
	const discX = cellX + CARD_PAD_X;
	const discY = cellY + CARD_PAD_TOP;

	// ── The portrait: the plain ring on the well, the art in front of it ──
	ctx.fillStyle = roles.well;
	ctx.beginPath();
	ctx.arc(discX + d / 2, discY + d / 2, d / 2, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = roles.lineSoft;
	ctx.lineWidth = RING_W;
	ctx.beginPath();
	ctx.arc(discX + d / 2, discY + d / 2, d / 2 - RING_W / 2, 0, Math.PI * 2);
	ctx.stroke();

	const art = card.sideArt ? images.get(card.sideArt) : undefined;
	if (art) {
		const lay = sideLayout(d);
		// The art fades out toward the right, gone `ART_FADE_RIGHT` past the
		// disc's edge, so a ponytail eases into the ground before the name.
		const fadeEnd = d - lay.left + ART_FADE_RIGHT;
		const layer = document.createElement('canvas');
		const s = 3; // a supersampled layer, so the fade has no stair
		layer.width = Math.ceil(lay.art * s);
		layer.height = Math.ceil(lay.art * s);
		const lc = layer.getContext('2d')!;
		lc.drawImage(art, 0, 0, layer.width, layer.height);
		lc.globalCompositeOperation = 'destination-in';
		const g = lc.createLinearGradient((fadeEnd - ART_FADE_W) * s, 0, fadeEnd * s, 0);
		g.addColorStop(0, '#000');
		g.addColorStop(1, 'rgba(0,0,0,0)');
		lc.fillStyle = g;
		lc.fillRect(0, 0, layer.width, layer.height);
		ctx.drawImage(layer, discX + lay.left, discY + lay.top, lay.art, lay.art);
	}

	// ── The constellation chip, on the disc's lower right ──
	if (card.displayName) {
		const markW = CHIP_MARK_H * CON_MARK_ASPECT;
		const chipW = markW + CHIP_PAD * 2;
		const chipX = discX + d - chipW;
		const chipY = discY + d - CHIP_H;
		const zero = card.conLevel === 0 && !card.conShort;
		ctx.fillStyle = card.conShort || zero ? roles.well : roles.lineStrong;
		ctx.beginPath();
		ctx.roundRect(chipX, chipY, chipW, CHIP_H, CHIP_H / 2);
		ctx.fill();
		if (card.conShort) {
			ctx.strokeStyle = roles.muted;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.roundRect(chipX + 0.5, chipY + 0.5, chipW - 1, CHIP_H - 1, (CHIP_H - 1) / 2);
			ctx.stroke();
		}
		ctx.save();
		ctx.translate(chipX + CHIP_PAD, chipY + (CHIP_H - CHIP_MARK_H) / 2);
		const k = CHIP_MARK_H / CON_VB_H;
		ctx.scale(k, k);
		// --sp-unset-ink: white 40% over the well, for a covered C0.
		ctx.fillStyle = card.conShort ? roles.muted : zero ? 'rgba(255,255,255,0.4)' : roles.text;
		for (const p of conPaths(card.conLevel)) ctx.fill(p);
		ctx.restore();
	}

	// ── The column: the name over the loadout pill, centred on the portrait ──
	const colX = discX + d + COL_INSET;
	const colW = cellX + BENCH_CARD_W - CARD_PAD_X - colX;
	ctx.font = `600 ${NAME_PX}px ${SANS}`;
	const lineH = NAME_PX * NAME_LH;
	const nameLines = card.displayName ? wrapName(ctx, card.displayName, colW - NAME_INSET) : [];
	const nameH = nameLines.length ? nameLines.length * lineH : lineH;
	const blockH = nameH + COL_GAP + PILL_H;
	const colY = discY + (d - blockH) / 2 + COL_DROP;

	ctx.fillStyle = roles.text;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	nameLines.forEach((line, i) => {
		ctx.fillText(line, colX + NAME_INSET, colY + lineH * (i + 0.5));
	});
	if (card.uncurated && nameLines.length) {
		const w = ctx.measureText(nameLines[0]).width;
		drawMark(
			ctx,
			'uncurated',
			colX + NAME_INSET + w + 5,
			colY + (lineH - 12) / 2,
			12,
			roles.provisional
		);
	}

	// The pill: one well holding two icon zones; an unset zone is washed
	// darker (60% of the well) than a set one (15%).
	const pillY = colY + nameH + COL_GAP;
	const pillW = PILL_PAD * 2 + ZONE_W * 2 + ZONE_GAP;
	ctx.save();
	if (!card.displayName) ctx.globalAlpha = 0.35; // .sp-loadout--disabled
	ctx.fillStyle = roles.well;
	ctx.beginPath();
	ctx.roundRect(colX, pillY, pillW, PILL_H, PILL_H / 2);
	ctx.fill();
	const zones: Array<[string, boolean]> = [
		[card.artifactIcon, card.artifactSet],
		[card.weaponIcon, card.weaponSet]
	];
	zones.forEach(([src, set], zi) => {
		const zx = colX + PILL_PAD + zi * (ZONE_W + ZONE_GAP);
		const icon = images.get(src);
		if (icon) {
			const s = Math.min(ZONE_W / icon.naturalWidth, PILL_H / icon.naturalHeight);
			const iw = icon.naturalWidth * s;
			const ih = icon.naturalHeight * s;
			ctx.drawImage(icon, zx + (ZONE_W - iw) / 2, pillY + (PILL_H - ih) / 2, iw, ih);
		}
		ctx.save();
		ctx.globalAlpha *= set ? 0.15 : 0.6;
		ctx.fillStyle = roles.well;
		ctx.beginPath();
		ctx.roundRect(zx, pillY, ZONE_W, PILL_H, ZONE_W / 2);
		ctx.fill();
		ctx.restore();
	});
	// The refinement digit on the weapon icon's top-right corner, in the
	// element's ink lifted toward white (.sp-lo-ref).
	if (card.weaponSet) {
		const zx = colX + PILL_PAD + ZONE_W + ZONE_GAP;
		const el = elementPalette(card.element).main;
		ctx.font = `700 10px ${SANS}`;
		ctx.textAlign = 'right';
		ctx.textBaseline = 'top';
		ctx.save();
		ctx.shadowColor = roles.well;
		ctx.shadowBlur = 3;
		ctx.fillStyle = mixWhite(el, 0.25);
		ctx.fillText(String(card.refinement), zx + ZONE_W + 1, pillY - 1);
		ctx.restore();
	}
	ctx.restore();
}

/** `color-mix(in srgb, hex (1−w), white w)` as an rgb() string. */
function mixWhite(hex: string, w: number): string {
	const n = parseInt(hex.replace('#', ''), 16);
	const ch = (v: number) => Math.round(v * (1 - w) + 255 * w);
	return `rgb(${ch((n >> 16) & 255)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

export { RIBBON_W };
