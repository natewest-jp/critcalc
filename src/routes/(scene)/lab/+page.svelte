<script lang="ts">
	import Mark from '$lib/components/Mark.svelte';
	import SidePortrait from '$lib/components/SidePortrait.svelte';
	import { SIDE_GEOMETRY, sideLayout, type SideGeometry } from '$lib/sidePortrait';
	import { getAllCharacterIndex, getCharacterIndexEntry } from '$lib/data/characterLookup';
	import SlotPortrait from '$lib/components/SlotPortrait.svelte';
	import {
		BENCH_ROW_CARD_GAP,
		BENCH_SLOT_H,
		RIBBON_CHROME,
		RIBBON_EDGE,
		RIBBON_FRAME_BORDER,
		RIBBON_PAD
	} from '$lib/benchBand.svelte';
	import { TOOL_GUTTER } from '$lib/toolGutter';

	/* ══ THE BENCH CARD after the lineups round (2026-10-13, lineups design
	   §9.5 / §9.5a / §10.3) — the REAL SlotPortrait in three forms, so nothing
	   here is a drawing. The seats exercise the constellation mark's cases;
	   "Roster known" off is an empty roster, where no mark can be drawn. */
	const BC_SEATS: { id: string | null; con: number; owned: number | null; note: string }[] = [
		{ id: 'bennett', con: 6, owned: 1, note: 'Bennett C6, you own C1 — short' },
		{ id: 'xiangling', con: 4, owned: 6, note: 'Xiangling C4, you own C6 — covered' },
		{ id: 'nahida', con: 0, owned: null, note: 'Nahida C0, not owned — short (the tallest hair)' },
		{ id: null, con: 0, owned: null, note: 'an empty slot' }
	];
	/** 🎛️ C's card width — no rail and no element badge give back ~48px of the
	 *  200. 152 = disc 60 + inset 4 + an 88px column ("Kuki Shinobu" on one line
	 *  at --fs-lg is 87.8; the control row needs 84). */
	let bcCardW = $state(152);
	/** The phone row: a viewport width, and the strip the bench would get there. */
	let bcVw = $state(390);
	const BC_DISC_MIN = 40;
	const BC_DISC_MAX = 60;
	/** The hair above the upright card: reserved inside the strip, or left to spill. */
	let bcReserve = $state(false);
	const bcRow = $derived.by(() => {
		const inner = bcVw - 2 * TOOL_GUTTER - 2 * RIBBON_CHROME;
		const fit = (inner - 3 * BENCH_ROW_CARD_GAP) / 4;
		const full = fit >= bcCardW;
		// The upright card: portrait + 4 + the 26px pill, the portrait taking
		// whatever the width leaves, between a floor and a cap (🎛️ both).
		const d = Math.round(Math.max(BC_DISC_MIN, Math.min(fit - 30, BC_DISC_MAX)));
		const w = full ? bcCardW : d + 30;
		return { inner, w, full, d, h: full ? 78 : Math.max(d, 55), over: sideLayout(d).overhang };
	});
	let bcSlotH = $state(BENCH_SLOT_H);
	let bcRosterKnown = $state(true);
	let bcCon = $state<Record<string, number>>({});
	const bcChar = (id: string | null) => {
		const e = id ? getCharacterIndexEntry(id) : null;
		return e
			? { id: e.id, displayName: e.displayName, element: e.element, weapon: e.weapon }
			: null;
	};

	/* ══ THE SIDE PORTRAIT (lineups design §9.5a, 2026-10-08) — Nate tunes the
	   geometry here; the values he settles on land in $lib/sidePortrait.ts as
	   they are. The sliders work in the ICON's own pixels (of 128). */
	let spDisc = $state(64);
	let spRing = $state(Math.round(128 / SIDE_GEOMETRY.artPerDisc));
	let spCx = $state(Math.round(SIDE_GEOMETRY.cx * 128));
	let spCy = $state(Math.round(SIDE_GEOMETRY.cy * 128));
	let spClip = $state(SIDE_GEOMETRY.clipBelow);
	/* The chip's four cases, one per seat (the empty slot is the fifth). */
	const SP_CASES: { con: number; ownedCon: number | null; note: string }[] = [
		{ con: 0, ownedCon: 0, note: 'C0, owned — no chip' },
		{ con: 2, ownedCon: 6, note: 'C2, you own C6 — filled' },
		{ con: 2, ownedCon: 0, note: 'C2, you own C0 — hollow' },
		{ con: 0, ownedCon: null, note: 'not owned — hollow C0' }
	];
	const spGeo: SideGeometry = $derived({
		artPerDisc: 128 / spRing,
		cx: spCx / 128,
		cy: spCy / 128,
		clipBelow: spClip
	});
	const SP_TEAM = ['neuvillette', 'nahida', 'xingqiu', 'furina'];
	const SP_GROUNDS = [
		{ cls: '', label: 'night' },
		{ cls: 'ctx-glass', label: 'glass' },
		{ cls: 'ctx-dark', label: 'dark' }
	];
	const spRoster = getAllCharacterIndex()
		.filter((c) => !c.id.startsWith('traveler_') || c.id === 'traveler_anemo')
		.sort((a, b) => a.displayName.localeCompare(b.displayName));

	/**
	 * THE SPECIMEN BOARD (/lab) — ⚓ NATE 2026-08-10.
	 *
	 * "I want to see the actual panels and text we'll be using on the scene with
	 * dim so that I can judge things clearly." Neither existing surface could:
	 * the Team Builder shows whatever that tool happens to use, never the whole
	 * set side by side; /styleguide shows the whole set but on the bare root
	 * layout, in chips, against a hand-drawn stand-in sky.
	 *
	 * SO THIS PAGE HAS EXACTLY ONE JOB: every ground we own, at real size, with
	 * the same content in each, AT THE CREST UNDER THE REAL WASH. It is a board
	 * to judge from, not a reference to look things up in — /styleguide stays the
	 * authority and stays exhaustive. Two surfaces, opposite virtues: reference
	 * wants completeness, judging wants one screenful at true scale.
	 *
	 * ⚠ WHAT MAY BE STYLED HERE. Shipped patterns are rendered with their REAL
	 * global classes and are not restyled — same law as /styleguide, and for the
	 * same reason (a board that paints its own copy of a button is showing you a
	 * button that does not exist). The exception is the CANDIDATES section: those
	 * are proposals with no home in app.css yet, so they are drawn locally and
	 * labelled as proposals. When one is adopted it moves to app.css and this
	 * page renders the real thing instead.
	 */

	/** The same content in every ground, so the only variable is the ground. */
	const SPECIMEN_GROUNDS = [
		{
			key: 'night',
			cls: '',
			label: 'ctx-night — the world itself',
			note: 'no paint · one ground, no rungs · lines must carry alpha'
		},
		{
			key: 'glass',
			cls: 'ctx-glass',
			label: 'ctx-glass — the material',
			note: 'slate at an alpha · 8% of the world survives it'
		},
		{ key: 'dark', cls: 'ctx-dark', label: 'ctx-dark — slate', note: 'ground · raised · well' },
		{
			key: 'light',
			cls: 'ctx-light',
			label: 'ctx-light — parchment',
			note: 'the inversion · navy ink'
		}
	];

	const LINE_STOPS = ['--line-faint', '--line-soft', '--line-strong', '--line-edge'];

	/**
	 * THE INK LADDER, rendered identically in every ground — ⚓ Nate 2026-08-10:
	 * "what are the exact text body sizes, headings, section breaks etc we're
	 * using right now?"
	 *
	 * Every row carries its own size tag, so each panel doubles as a legend for
	 * the type system ON THAT GROUND. That pairing is the point: the size and the
	 * ink role are one decision, not two, and the light context INVERTS the ink
	 * half of it (prose recedes, labels anchor) while keeping the sizes.
	 *
	 * ⚠ THE TAGS ARE MAINTAINED BY HAND, and the CSS below is pinned by hand to
	 * match them — /lab is excluded from the mechanical size sweep on purpose.
	 * A board that rode the scale would always agree with itself and could never
	 * show you a rung that had gone missing.
	 */
	const TYPE_ROWS = [
		{ cls: 'ty-h1', tag: '4xl · 24', text: 'Section heading' },
		{ cls: 'ty-h2', tag: '3xl · 20', text: 'Subheading · .title' },
		{ cls: 'ty-h3', tag: '2xl · 18', text: 'Emphasized body' },
		{ cls: 'ty-body', tag: 'xl · 16', text: 'Body — prose.' },
		{ cls: 'ty-dense', tag: 'lg · 14', text: 'Dense body — tables, data rows.' },
		{ cls: 'ty-label', tag: 'md · 12', text: 'Controls · tabs · chips' },
		{ cls: 'ty-caption', tag: 'sm · 11', text: 'Labels / meta' }
	];

	/**
	 * THE SIZE-UP — ⚓ APPROVED AND SHIPPED 2026-08-10. Kept on the board as the
	 * record of what moved, because the interesting part is the SHAPE of the
	 * change rather than the sizes themselves.
	 *
	 * ROLES MOVED UP A RUNG; THE RUNGS DID NOT MOVE. That direction is the whole
	 * decision. The px values are quoted in dozens of comments and in the export
	 * mirror, so a scale re-cut would have made every one of them quietly wrong
	 * — where re-pointing 208 declarations one step up leaves the ladder exactly
	 * where it was and just has everything stand higher on it.
	 *
	 * ⚠ TWO ENDS ARE PINNED. 4xl is the section heading AND the brand (Nate's
	 * unification — SiteChrome reads it through --brand-size), and 5xl held
	 * because it is the instrument-readout rung with nothing above it to climb
	 * to. Page titles moved up INTO 5xl, so those two share a rung: different
	 * roles on one rung is fine, a role with no rung is not.
	 */
	const SIZE_UP = [
		{ role: 'page title', now: '4xl · 24', next: '5xl · 32', moved: true },
		{ role: 'section heading · brand', now: '3xl · 20', next: '4xl · 24', moved: true },
		{ role: 'subheading · .title', now: '2xl · 18', next: '3xl · 20', moved: true },
		{ role: 'body / prose', now: 'lg · 14', next: 'xl · 16', moved: true },
		{ role: 'dense body', now: 'md · 12', next: 'lg · 14', moved: true },
		{ role: 'controls · tabs · chips', now: 'sm · 11', next: 'md · 12', moved: true },
		{ role: 'labels · meta', now: 'xs · 10', next: 'sm · 11', moved: true },
		{ role: 'micro / badges', now: '2xs · 9', next: 'xs · 10', moved: true },
		{ role: 'instrument readout', now: '5xl · 32', next: '5xl · 32', moved: false }
	];

	/**
	 * BORDERS IN GOLD — ⚓ Nate 2026-08-10: "I think Genshin uses gold for BOTH
	 * contexts. I'm not sure which brightness stop."
	 *
	 * Every candidate rung against both grounds, at the two alphas that survived
	 * the cut. Mixed OPAQUELY against each ground (the compositing law) and one
	 * level deep — both inputs are primitives, never aliases of each other, so
	 * no color-mix is ever fed a color-mix.
	 *
	 * The control row is the shipped ink line, so the question being asked is
	 * "gold instead of THIS", not "gold in the abstract".
	 */
	const BORDER_CANDIDATES = [
		{ key: 'ink', label: 'ink — shipped', src: null },
		{ key: 'gold-300', label: '--gold-300', src: 'var(--gold-300)' },
		{ key: 'gold-400', label: '--gold-400 · the accent', src: 'var(--gold-400)' },
		{ key: 'gold-500', label: '--gold-500', src: 'var(--gold-500)' },
		{ key: 'gold-600', label: '--gold-600', src: 'var(--gold-600)' },
		{ key: 'gold-700', label: '--gold-700', src: 'var(--gold-700)' }
	];

	/**
	 * THE THREE STATES OF A PANE, side by side and forced. Rendered as one run
	 * because the ladder is the point — each step is legible only against the
	 * one before it, and hovering shows you exactly one at a time.
	 */
	const PANE_STATES = [
		{ key: 'rest', label: 'rest · .58', cls: '' },
		{ key: 'hover', label: 'hover · .80 + ink ring', cls: 'is-dense is-ring' },
		{ key: 'sel', label: 'selected · .80 + gold ring', cls: 'is-sel' }
	];

	/**
	 * THE REJECTED RING COLOURS, kept as evidence rather than as a question.
	 * Settled by the BORDER decision, not beside it: borders stayed ink, so gold
	 * was left free to mean SELECTED and the ring kept the pane's own ink.
	 */
	const RING_CANDIDATES = [
		{ key: 'ink', label: 'parchment ink — shipped', ring: 'var(--line-edge)' },
		{
			key: 'gold',
			label: 'gold-400 @ .45',
			ring: 'color-mix(in srgb, var(--gold-400) 45%, transparent)'
		},
		{
			key: 'slate',
			label: 'brighter slate — slate-300',
			ring: 'color-mix(in srgb, var(--slate-300) 75%, transparent)'
		}
	];

	/**
	 * THE BENCH STRIP — two coupled questions, forced side by side (⚓ NATE
	 * 2026-08-11): what shade is the strip against the glass, and how deep do its
	 * controls sit in it.
	 *
	 * ↻ BOTH SETTLED THE SAME DAY, so this board is now a RECORD rather than a
	 * question — and it is kept for the same reason the gold-border grid above
	 * is: the reason is visible in it. ⚓ The strip stays at slate-800 (it stands
	 * one rung ABOVE the glass, which is what makes it read as the solid object
	 * among panes), and the well moved by MERGING the ramp's bottom two rungs
	 * instead of by picking a different one.
	 *
	 * ⚠ THE MIDDLE COLUMN NO LONGER EXISTS AS A SEPARATE VALUE. "well 900" and
	 * "well 950" were the same question asked twice — how deep — and the answer
	 * was that the ramp had two rungs where it needed one. The old pair is drawn
	 * from LITERALS here (/lab is exempt from the L0 law, so it can show a value
	 * nothing points at) precisely because they are no longer tokens: this is the
	 * only surface in the app that can still render the before.
	 */
	/** The seven-element pip row both Atlas specimens carry — every real card has
	 *  all seven, so the row's true width is what the layout has to survive. */
	const ATLAS_PIPS = [
		{ el: 'pyro', n: 9, color: 'var(--el-pyro-main)' },
		{ el: 'hydro', n: 7, color: 'var(--el-hydro-main)' },
		{ el: 'electro', n: 8, color: 'var(--el-electro-main)' },
		{ el: 'cryo', n: 6, color: 'var(--el-cryo-main)' },
		{ el: 'dendro', n: 5, color: 'var(--el-dendro-main)' },
		{ el: 'anemo', n: 7, color: 'var(--el-anemo-main)' },
		{ el: 'geo', n: 6, color: 'var(--el-geo-main)' }
	];

	const BENCH_VARIANTS = [
		{
			key: 'shipped',
			label: 'strip 800 · the merged well — shipped',
			ground: 'var(--surface)',
			fill: 'var(--surface-well)',
			border: 'none'
		},
		{
			key: 'was-900',
			label: 'the old 900 — desaturated',
			ground: 'var(--surface)',
			fill: '#262c38',
			border: 'none'
		},
		{
			key: 'was-950',
			label: 'the old 950 — too deep',
			ground: 'var(--surface)',
			fill: '#1c212b',
			border: 'none'
		},
		{
			key: 'was',
			label: 'gradient + stroke (declared 1.5px, painted 1) — was',
			ground: 'var(--surface)',
			fill: 'linear-gradient(180deg, color-mix(in srgb, var(--slate-800) 45%, var(--bg)) 0%, var(--slate-800) 50%)',
			border: '1.5px solid var(--frame-line-quiet)'
		}
	];

	/* ══════════════════════════════════════════════════════════════════════════
	   THE ELEMENT ROUND — the board for it. ⚓ Nate 2026-08-11.

	   ↻ ROUND TWO, same day, after the first board was read. Two things changed
	   and both narrowed the work:

	   ⚓ "Looking at it straight, Genshin's palette is superior to ours. We don't
	   need to keep our values for any particular reason." So OUR LIGHTNESS IS NO
	   LONGER A CONSTRAINT, and with it goes the whole hydro trilemma the first
	   board spent a section on — hydro was only stuck because it was pinned dark
	   by a ladder we are no longer defending. The comparison is now Genshin
	   straight versus one deliberate divergence from it, not a blend of ours and
	   theirs.

	   ⚓ "We are absolutely keeping white labels on the bars. Dark ink on the
	   element bars just kills the chart's atmosphere, period. But legibility
	   doesn't need to be so high on them. I'm up for slightly darker bars, so
	   that the text can show clearly, but the highest priority is the bars
	   showing cleanly and with pleasing element colours on the night scene."
	   So the ink question is CLOSED (white, with its halo) and the remaining
	   question is a single dial on the FILL — see LADDER_LO / LADDER_HI.

	   ⚠ EVERYTHING BELOW IS COMPUTED, not typed — same argument as the styleguide
	   census. A board whose numbers are hand-maintained is worse than no board.
	   ══════════════════════════════════════════════════════════════════════════ */

	const EL7 = ['pyro', 'electro', 'hydro', 'anemo', 'geo', 'dendro', 'cryo'] as const;
	type El = (typeof EL7)[number];

	/** ⚠ THE PALETTE THIS ROUND REPLACED — NOT what ships. Held as literals so
	 *  the board can still render the before; /lab is exempt from the L0 law for
	 *  exactly this reason, and it is the only surface that can show a value
	 *  nothing points at any more. Do not "update" these to the live tokens: the
	 *  comparison is the whole point of the row. */
	const EL_NOW: Record<El, string> = {
		pyro: '#f9563e',
		electro: '#cd7cfe',
		hydro: '#1c88e8',
		anemo: '#47dbc1',
		geo: '#fabd22',
		dendro: '#85d736',
		cryo: '#9de2f7'
	};

	/**
	 * GENSHIN'S OWN TWO PALETTES — and there really are two, which is the single
	 * most useful thing this round turned up.
	 *
	 * ICON is measured off the flat-colour source art (assets-src/game, byte
	 * identical to static/assets/elements/flat-color — each file is ONE colour
	 * plus an antialiased edge, so "the icon colour" is not an estimate).
	 *
	 * TEXT is the `<color=#rrggbbff>` tag Genshin wraps elemental words in
	 * throughout its own description strings, counted out of the genshin-db
	 * devDependency: 8891 uses of the cryo one, 2596 electro, and so on. It is
	 * the game's own table, not a fan reconstruction.
	 *
	 * ⚠ AND THE SECOND IS THE FIRST, LIFTED. Every TEXT entry is its ICON hue
	 * carried up to a lightness floor (oklch L ≈ .79) and left alone if it was
	 * already above it — pyro climbs .699 → .788 while cryo barely moves at
	 * .892 → .938. Genshin keeps a bright FILL palette and derives an
	 * INK-ON-DARK palette from it by exactly the rule proposed below.
	 *
	 * ⚠⚠ SO GENSHIN'S PALETTE ARRIVES WITH ITS OWN `hi` RUNG ALREADY DRAWN. That
	 * is why the two ladders below are not symmetrical work: for the Genshin set
	 * we derive only `deep`, and `hi` is theirs. Deriving a rung we have been
	 * handed would be inventing a disagreement.
	 */
	const EL_GENSHIN_ICON: Record<El, string> = {
		pyro: '#ff6640',
		electro: '#cc80ff',
		hydro: '#00c0ff',
		anemo: '#33d7a0',
		geo: '#ffb00d',
		dendro: '#9be53d',
		cryo: '#7af2f2'
	};
	const EL_GENSHIN_TEXT: Record<El, string> = {
		pyro: '#ff9999',
		electro: '#ffacff',
		hydro: '#80c0ff',
		anemo: '#80ffd7',
		geo: '#ffe699',
		dendro: '#99ff88',
		cryo: '#99ffff'
	};

	// ── colour maths. sRGB ⇄ oklch, and WCAG contrast. ─────────────────────────
	const _rgb = (hex: string): [number, number, number] =>
		[0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16)) as [
			number,
			number,
			number
		];
	const _lin = (c: number) =>
		c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4;
	const _unlin = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
	const _lum = (c: [number, number, number]) =>
		0.2126 * _lin(c[0]) + 0.7152 * _lin(c[1]) + 0.0722 * _lin(c[2]);
	/** WCAG contrast of two OPAQUE colours. */
	const ratio = (a: string, b: string) => {
		const [hi, lo] = [_lum(_rgb(a)), _lum(_rgb(b))].sort((x, y) => y - x);
		return (hi + 0.05) / (lo + 0.05);
	};
	const r2 = (a: string, b: string) => ratio(a, b).toFixed(2);

	function toOklch(hex: string): [number, number, number] {
		const [r, g, b] = _rgb(hex).map(_lin);
		const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
		const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
		const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
		const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
		const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
		return [
			0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
			Math.hypot(A, B),
			// ⚠ NORMALISED to [0,360). atan2 returns ±180 and every hue comparison
			// below would otherwise be off by a full turn for half the wheel.
			((Math.atan2(B, A) * 180) / Math.PI + 360) % 360
		];
	}
	function fromOklch(L: number, C: number, Hdeg: number) {
		const h = (Hdeg * Math.PI) / 180;
		const A = C * Math.cos(h);
		const B = C * Math.sin(h);
		const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
		const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
		const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
		const v = [
			4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
			-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
			-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
		];
		return {
			hex:
				'#' +
				v
					.map((x) =>
						Math.round(Math.min(1, Math.max(0, _unlin(Math.min(1, Math.max(0, x))))) * 255)
							.toString(16)
							.padStart(2, '0')
					)
					.join(''),
			inGamut: v.every((x) => x >= -0.0015 && x <= 1.0015)
		};
	}
	/** Shortest angular distance between two hues, in degrees. The wheel wraps,
	 *  so a plain subtraction reports 327° where the answer is 33°. */
	const hueGap = (a: string, b: string) => {
		const d = Math.abs(toOklch(a)[2] - toOklch(b)[2]) % 360;
		return d > 180 ? 360 - d : d;
	};
	/** The most chroma sRGB will hold at this lightness and hue. */
	function maxChroma(L: number, H: number) {
		let c = 0.4;
		while (c > 0 && !fromOklch(L, c, H).inGamut) c -= 0.001;
		return Math.max(c, 0);
	}
	const fitLCH = (L: number, C: number, H: number) =>
		fromOklch(L, Math.min(C, maxChroma(L, H)), H).hex;
	/** The same colour at lightness L. ⚠ Takes the HEX, not an unpacked triple:
	 *  hue has to come from the original every time, because a walk that drives
	 *  chroma to zero passes through a gray and a gray has no hue to read back. */
	const atLightness = (hex: string, L: number) => {
		const [, C, H] = toOklch(hex);
		return fitLCH(L, C, H);
	};
	/** Walk lightness in `dir` until the colour clears `target` against `ground`. */
	function toFloor(hex: string, ground: string, target: number, dir: 1 | -1) {
		const [L0] = toOklch(hex);
		if (ratio(hex, ground) >= target) return hex;
		for (let L = L0; L > 0.08 && L < 0.99; L += dir * 0.004) {
			const c = atLightness(hex, L);
			if (ratio(c, ground) >= target) return c;
		}
		return atLightness(hex, dir > 0 ? 0.99 : 0.08);
	}

	/* ── the grounds a colour has to answer to ──────────────────────────────── */
	/** The BRIGHTEST night pixel: a blank-white star under the tool wash. Glyphs
	 *  and fills on the open scene are limited by this and nothing else.
	 *  ⚠ Composited properly (dim·wash + (1−dim)·white), not white×(1−dim) —
	 *  that error is what made every star figure before 2026-08-10 optimistic. */
	const STAR = '#4c4c4e';
	const PAPER = '#ece5d8'; // parchment-100 — the DARKER paper, so the harder case
	/* ⚠ ctx-dark (slate-800) is deliberately NOT measured here. Its ground sits
	   at half the star's luminance, so night is strictly the harder of the two
	   and anything that clears the star clears slate. One ground, not three. */

	/**
	 * THE LADDER — three rungs, one hue, each with ONE job.
	 * Same shape as the accent's law already in app.css ("one hue at two rungs;
	 * it changes weight, not identity, when a surface flips"); elements need a
	 * third because an element is a FILL as well as an INK.
	 *
	 *   deep  →  element on LIGHT   (Atlas icons, pips, ink on parchment)
	 *   main  →  the identity FILL  (bars, discs, icons on dark/night)
	 *   hi    →  element as GLYPH/INK on dark/night
	 *
	 * deep and hi are DERIVED — same hue, same chroma, lightness walked to
	 * whichever floor its ground demands. That is what stops the set drifting
	 * apart one element at a time, which is the failure the icon generator was
	 * built to end; this is the same idea one layer up.
	 *
	 * ⚠ THE EXCEPTION IS GENSHIN'S OWN `hi`, WHICH IS NOT DERIVED — see
	 * EL_GENSHIN_TEXT. They already drew that rung and it measures 4.2:1+ on the
	 * worst star, so deriving our own would be manufacturing a disagreement.
	 */
	const HI_TARGET = 4.5; //  vs the worst star. 4.5 = readable as text.
	const DEEP_TARGET = 3.0; // vs parchment-100. 3.0 = the graphical threshold.

	/**
	 * 🎛️🎛️ THE ONE DIAL THIS BOARD EXISTS TO SET — ⚓ Nate's brief, exactly.
	 *
	 * Genshin's fill palette spans oklch L .699–.892. Their UI never has to put
	 * WHITE INK on those fills at 11px, and ours does, so the divergence pulls
	 * the whole ladder down into [LADDER_LO, LADDER_HI].
	 *
	 * ⚠ IT REMAPS, IT DOES NOT CLIP. A ceiling looks like the obvious move and is
	 * wrong: capping at L .74 lands FIVE of the seven on the same rung, and a
	 * palette with no lightness ladder is unreadable in a dense stacked chart
	 * (and dead under the grayscale gate). Remapping keeps Genshin's spacing —
	 * which is more even than ours ever was — and just moves and narrows it.
	 *
	 * ⚠ THE DIAL IS A TRADE AND BOTH ENDS ARE REAL. Down helps the label and
	 * costs the fill: at Genshin's own span the worst white-on-fill is 1.34:1 and
	 * the worst fill-vs-star is 2.96:1; at [.63,.78] that is 1.94 and 2.22. Nate
	 * ranked them — "the highest priority is the bars showing cleanly and with
	 * pleasing element colours" — so this is set nearer the bright end than a
	 * contrast target alone would put it, ON PURPOSE.
	 *
	 * ⚠ CHROMA IS KEPT AS A FRACTION OF THE GAMUT, not as an absolute. Dropping
	 * cryo from L .892 to .78 makes MORE chroma available, and holding its
	 * absolute C would spend that headroom on nothing — a darker cryo that is
	 * also duller is the muddy version of this idea. Same fraction = a darker
	 * cryo that is still ice.
	 */
	const LADDER_LO = 0.66;
	const LADDER_HI = 0.82;

	/** 🎛️ Degrees the divergence rotates CRYO toward blue. ⚓ Nate: their cryo is
	 *  "too turquoise / encroaching on anemo territory".
	 *  ⚠ BUT SEE THE MARKUP — most of that crowding was OUR ANEMO's doing, not
	 *  their cryo's. Their anemo is 14° greener than ours, which opens the pair
	 *  up before this dial touches anything. Hence 8° and not the 24° our
	 *  shipped cryo actually sits at. */
	const CRYO_NUDGE = 8;

	const GENSHIN_LS = EL7.map((el) => toOklch(EL_GENSHIN_ICON[el])[0]);
	const G_LO = Math.min(...GENSHIN_LS);
	const G_HI = Math.max(...GENSHIN_LS);

	/** The divergence: Genshin's hue and relative chroma, cryo nudged, ladder
	 *  remapped into [LADDER_LO, LADDER_HI]. */
	const EL_OURS_V2: Record<El, string> = Object.fromEntries(
		EL7.map((el) => {
			const [L, C, H] = toOklch(EL_GENSHIN_ICON[el]);
			const L2 = LADDER_LO + ((L - G_LO) / (G_HI - G_LO)) * (LADDER_HI - LADDER_LO);
			const H2 = el === 'cryo' ? H + CRYO_NUDGE : H;
			return [el, fitLCH(L2, maxChroma(L2, H2) * (C / maxChroma(L, H)), H2)];
		})
	) as Record<El, string>;

	/** A ladder row. `hi` is passed in when the palette already has one. */
	const ladder = (mains: Record<El, string>, his?: Record<El, string>) =>
		EL7.map((el) => ({
			el,
			deep: toFloor(mains[el], PAPER, DEEP_TARGET, -1),
			main: mains[el],
			hi: his ? his[el] : toFloor(mains[el], STAR, HI_TARGET, 1),
			hiGiven: !!his
		}));
	const LADDER_GENSHIN = ladder(EL_GENSHIN_ICON, EL_GENSHIN_TEXT);
	const LADDER_V2 = ladder(EL_OURS_V2);

	const PALETTES = [
		{ key: 'now', label: 'ours — what this round replaced', set: EL_NOW },
		{ key: 'genshin', label: 'Genshin, straight — SHIPPED', set: EL_GENSHIN_ICON },
		{ key: 'v2', label: 'the divergence — rejected, see above', set: EL_OURS_V2 }
	];

	/** The worst case in each direction, measured across the whole set — the two
	 *  numbers the dial trades against each other. */
	const extremes = (set: Record<El, string>) => ({
		white: Math.min(...EL7.map((el) => ratio('#ffffff', set[el]))),
		star: Math.min(...EL7.map((el) => ratio(set[el], STAR)))
	});

	/* ══ SECTION 10 · A FOURTH RUNG, FOR BARS ════════════════════════════════
	 * ⚓ Nate 2026-08-12: "we rejected a deeper rung for icons, but I think we
	 * might need a deeper rung for things like BARS… very slightly deeper
	 * (colour density) and slightly more balanced between the darkness of the
	 * scene and the white of their text."
	 *
	 * ⚠ THIS IS NOT A RE-TUNE OF THE PALETTE, AND THE DISTINCTION IS THE WHOLE
	 * REASON IT IS ALLOWED. `main` and `hi` are TRANSCRIBED — two tables copied
	 * out of the game — and the law from that round is "do not re-tune them as a
	 * set". A bar rung is DERIVED FROM main, the way `deep` and the icon set are:
	 * the transcription is untouched and gains a fourth job.
	 *
	 * ⚠ AND IT IS THE ANSWER THE REJECTED DIVERGENCE COULD NOT GIVE. That one
	 * moved the whole ladder, so a darker bar cost a darker ICON — and ⚓ Nate
	 * ranked the fill first. Scoping the move to bars pays nothing anywhere else:
	 * icons, glyphs, discs and washes all keep reading `main`.
	 */

	/**
	 * The luminance at which a fill sits EXACTLY between white and the worst
	 * star — i.e. where contrast(white, fill) == contrast(fill, star). Solving
	 * (1.05)/(x+.05) = (x+.05)/(Ls+.05) gives x = √(1.05·(Ls+.05)) − .05, and
	 * both ratios land on √(1.05/(Ls+.05)).
	 *
	 * ⚠ IT IS AN ANCHOR, NOT A TARGET. "Balanced" is a long way down from where
	 * Genshin's fills sit (their worst white-on-fill is 1.34:1 against a
	 * fill-vs-star of 2.96 — the fill is nearly as bright as the ink on it), and
	 * ⚓ Nate asked for "slightly MORE balanced", not balanced. What the anchor
	 * buys is a dial with meaning at BOTH ends instead of a taste slider.
	 */
	const STAR_LUM = _lum(_rgb(STAR));
	const BALANCED_LUM = Math.sqrt(1.05 * (STAR_LUM + 0.05)) - 0.05;
	const BALANCED_RATIO = 1.05 / (BALANCED_LUM + 0.05);

	/**
	 * 🎛️🎛️ THE TWO KNOBS THIS SECTION EXISTS TO SET. They are separate on
	 * purpose, because "deeper" is two different requests wearing one word.
	 *
	 *   BAR_BALANCE  how far each fill travels from where it is toward the
	 *                balanced luminance above. 0 = `main` untouched,
	 *                1 = equal contrast in both directions.
	 *   BAR_DENSITY  how much of the chroma headroom the drop FREES gets spent.
	 *                0 = hold the same share of the gamut it has now (the
	 *                divergence's rule — a darker cryo that is still ice);
	 *                1 = push to the gamut edge at the new lightness.
	 *                This is the "colour density" half of the ask, and it is the
	 *                half that costs the fill-vs-star ratio almost nothing.
	 *
	 * ⚠ ORDER MATTERS AND THE SOLVER HANDLES IT: chroma changes luminance too, so
	 * density is applied INSIDE the lightness walk rather than after it.
	 * Otherwise every candidate overshoots its own target by a few percent, in a
	 * direction that varies by hue.
	 */
	/* ✅ ⚓ NATE PICKED D, 2026-08-12 — these two numbers ARE the shipped rung.
	 * --el-*-bar in app.css and its mirror in elementColors.ts are this
	 * function's output at these values, transcribed. ⚠ So moving them here no
	 * longer just re-draws the board: it makes the board disagree with what
	 * ships, and the fix is to re-transcribe (7 hexes, both files, the mirror
	 * test enforces the pair). */
	const BAR_BALANCE = 0.3;
	const BAR_DENSITY = 0.5;

	/** One element's bar rung. Same hue, always — the hue is Genshin's and no
	 *  knob here touches it. */
	function barRung(hex: string, balance: number, density: number) {
		const [L0, C0, H] = toOklch(hex);
		const share = C0 / maxChroma(L0, H);
		const frac = share + (1 - share) * density;
		const target = _lum(_rgb(hex)) * (1 - balance) + BALANCED_LUM * balance;
		for (let L = L0; L > 0.2; L -= 0.002) {
			const c = fitLCH(L, maxChroma(L, H) * frac, H);
			if (_lum(_rgb(c)) <= target) return c;
		}
		return fitLCH(0.2, maxChroma(0.2, H) * frac, H);
	}
	const barSet = (balance: number, density: number) =>
		Object.fromEntries(
			EL7.map((el) => [el, barRung(EL_GENSHIN_ICON[el], balance, density)])
		) as Record<El, string>;

	/** The candidates on the board. ⚠ The last one is the anchor, not a
	 *  proposal — it is there so the dial's far end is visible rather than
	 *  imagined. */
	const BAR_CANDIDATES = [
		{
			key: 'shipped',
			label: 'A · `main`, as shipped — the icon rung doing a bar’s job',
			balance: 0,
			density: 0
		},
		{
			key: 'density',
			label: 'B · density only — same lightness, chroma to the gamut edge',
			balance: 0,
			density: 1
		},
		{ key: 'gentle', label: 'C · balance 0.15 + density 0.5', balance: 0.15, density: 0.5 },
		{
			key: 'pick',
			label: `D · balance ${BAR_BALANCE} + density ${BAR_DENSITY} — ✅ SHIPPED`,
			balance: BAR_BALANCE,
			density: BAR_DENSITY
		},
		{ key: 'deeper', label: 'E · balance 0.5 + density 0.5', balance: 0.5, density: 0.5 },
		{
			key: 'anchor',
			label: 'F · balance 1.0 — the anchor, NOT a proposal',
			balance: 1,
			density: 0.5
		}
	].map((c, i) => {
		const set = barSet(c.balance, c.density);
		const e = extremes(set);
		const Ls = EL7.map((el) => toOklch(set[el])[0]);
		return {
			...c,
			set,
			/** The letter the prose refers to. Derived, so the two can't disagree. */
			mark: 'ABCDEF'[i],
			white: e.white,
			star: e.star,
			spread: Math.max(e.white, e.star) / Math.min(e.white, e.star),
			/* ⚠ THE COLUMN THAT TURNED OUT TO MATTER — see the note in the markup.
			   Pulling every fill toward ONE luminance is by definition a squeeze on
			   the lightness ladder, and a palette without one is unreadable in a
			   dense stacked chart (the finding that killed the "just cap it"
			   proposal a round ago). Genshin's own span is .193. */
			span: Math.max(...Ls) - Math.min(...Ls)
		};
	});

	/** The shipped halo, derived the way RotationTimeline derives it: the bar's
	 *  own colour dropped 30 HSL lightness points. Reproduced rather than
	 *  imported so the mock cannot quietly diverge from the chart. */
	function haloOf(hex: string) {
		const [r, g, b] = _rgb(hex).map((v) => v / 255);
		const mx = Math.max(r, g, b);
		const mn = Math.min(r, g, b);
		const l = (mx + mn) / 2;
		const d = mx - mn;
		let h = 0;
		if (d !== 0) {
			if (mx === r) h = 60 * (((g - b) / d + 6) % 6);
			else if (mx === g) h = 60 * ((b - r) / d + 2);
			else h = 60 * ((r - g) / d + 4);
		}
		const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
		return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.max(0, Math.round(l * 100) - 30)}%)`;
	}

	/** What a planner row actually says — a real cast label, not lorem. */
	const BAR_SPECIMENS: Record<El, string> = {
		pyro: 'Q · Bennett',
		electro: 'E · Raiden',
		hydro: 'Q · Furina',
		anemo: 'E · Kazuha',
		geo: 'Q · Zhongli',
		dendro: 'E · Nahida',
		cryo: 'Q · Escoffier'
	};

	/* ══ SECTION 11 · THE UI STATE COLOURS ═══════════════════════════════════
	 * ⚓ Nate 2026-08-12: "let's quickly talk about those, since they're close to
	 * the element colours too" — plus three values Genshin uses.
	 *
	 * The question the board has to answer is NOT "which trio is prettier". It is
	 * the one the element round taught: a colour here has to live BESIDE the
	 * element palette without being mistaken for it, and it has to hold three
	 * different grounds. So every row is measured on both axes.
	 */
	const PAPER100 = '#ece5d8'; // parchment-100 — cards, the ∅ mark's actual ground
	const SLATE800 = '#2e3543'; // ctx-dark surface — panels, the detail card
	const UI_GROUNDS = [
		{ k: 'star', label: 'a star, on night', g: STAR },
		{ k: 'slate', label: 'slate-800', g: SLATE800 },
		{ k: 'paper', label: 'parchment-100', g: PAPER100 }
	];

	const EL_BAR: Record<El, string> = {
		pyro: '#ff653e',
		electro: '#ca7aff',
		hydro: '#00b7f4',
		anemo: '#1ecb95',
		geo: '#f1a501',
		dendro: '#8cd525',
		cryo: '#50e1e2'
	};

	/** ΔE in oklab — the same measure the palette round uses, where ~.05 is where
	 *  two colours stop reading as two. ⚠ NOT the hue gap: hue alone said our
	 *  hydro/cryo were fine when lightness was doing all the separating. */
	function dE(a: string, b: string) {
		const [LA, CA, HA] = toOklch(a);
		const [LB, CB, HB] = toOklch(b);
		const f = (C: number, H: number) => [
			C * Math.cos((H * Math.PI) / 180),
			C * Math.sin((H * Math.PI) / 180)
		];
		const [aa, ab] = f(CA, HA);
		const [ba, bb] = f(CB, HB);
		return Math.hypot(LA - LB, aa - ba, ab - bb);
	}
	/** The element this colour is most likely to be mistaken for, measured
	 *  against BOTH rungs — `main` is what a glyph beside it wears, `bar` is what
	 *  a fill beside it wears, and since 2026-08-12 those are different colours. */
	const nearestEl = (hex: string) => {
		const pick = (set: Record<El, string>) =>
			EL7.map((el) => ({ el, d: dE(hex, set[el]) })).sort((x, y) => x.d - y.d)[0];
		return { main: pick(EL_GENSHIN_ICON), bar: pick(EL_BAR) };
	};

	/**
	 * ⚠ FIVE VALUES, NOT THREE — and that gap is the first finding. The tokens
	 * were taken FROM the crit visualizer's risk ramp (⚓ Nate's pick), so the
	 * chart is the parent, not a copy. But the ramp has FOUR stops and only two
	 * of them ever became tokens:
	 *   #e63946 = --ui-danger   ✅       #f4a261 = --ui-warning  ✅
	 *   #f6d365 = no token at all        #4ecca3 = the PRE-NUDGE positive
	 * --ui-positive was pushed .034 → #51c89a to escape the OLD anemo and the
	 * chart never followed, so the family that was meant to be one is now two.
	 */
	const UI_ROWS = [
		{ key: 'danger', label: 'danger', now: '#e63946', token: '--ui-danger', gen: '#ff5a5a' },
		{ key: 'warning', label: 'warning', now: '#f4a261', token: '--ui-warning', gen: '#ffc700' },
		{ key: 'positive', label: 'positive', now: '#51c89a', token: '--ui-positive', gen: '#80df66' }
	];
	const UI_STRAYS = [
		{ hex: '#f6d365', note: 'the ramp’s 4th stop — never became a token' },
		{ hex: '#4ecca3', note: 'the pre-nudge positive — still in the ramp + ArtifactInstrument' }
	];

	/** OUR HUE AT GENSHIN'S LIGHTNESS, chroma held at the same share of the
	 *  gamut. The one transform worth showing, because it is the move this
	 *  system already makes twice (rx-quicken, and the --ui-positive note's own
	 *  advice: "the axis to spend is LIGHTNESS, not hue"). */
	function atGenshinL(ours: string, gen: string) {
		const [L0, C0, H] = toOklch(ours);
		const Lg = toOklch(gen)[0];
		return fitLCH(Lg, maxChroma(Lg, H) * (C0 / maxChroma(L0, H)), H);
	}
	const UI_LIFTED = Object.fromEntries(
		UI_ROWS.map((r) => [r.key, atGenshinL(r.now, r.gen)])
	) as Record<string, string>;

	/* ══ THE FOURTH VALUE ═════════════════════════════════════════════════════
	 * ⚓ Nate 2026-08-12: "should we actually have four values — an orange for
	 * warning, and a yellow like #f6d365 freed up for another use?"
	 *
	 * The census says yes, and that the fourth is not an invention: it is a SPLIT
	 * of what --ui-danger is already doing at thirteen sites in two different
	 * jobs. Counted by hand, excluding app.css's own declarations:
	 *   --ui-danger    13 sites   --ui-warning  1 site   --ui-positive  1 site
	 * (warning = the notation editor's unknown-token squiggle; positive = the
	 * switch's checked track, in app.css.)
	 */
	const UI_DANGER_CENSUS = [
		{
			job: 'a destructive ACTION — a verb, what a control will do',
			red: true,
			sites: ['SettingsPanel .sp-section--danger', 'BandMenu .band-menu-item--danger']
		},
		{
			job: 'data is INCOMPLETE or APPROXIMATE — a provenance statement, not an action',
			red: false,
			sites: [
				'CharacterCard .cc-namemark (the ∅, on 122 cards)',
				'SlotPortrait .sp-namemark',
				'RotationTimeline .rp-active-text--danger (generic timing)',
				'RotationTimeline isApprox block gradient',
				'CoveragePanel unknown chip',
				'DetailCard stub note · CompareView stub label'
			]
		}
	];

	/**
	 * The proposed fourth token. 🎛️ Two rungs, because it has a consumer on
	 * PAPER (the ∅ mark on a character card) and #f6d365 is 1.16:1 there.
	 * ⚠ THE LIGHT RUNG SITS AT THE GRAPHICAL FLOOR (3:1), NOT THE TEXT FLOOR,
	 * and that is forced rather than chosen: walking it to 4.5:1 lands on
	 * #786529, which is ΔE .030 from --gold-700 — it IS the light accent, and
	 * gold on paper already means "a gap you can click". So provisional may be a
	 * MARK on paper and must never be prose ink there.
	 */
	const UI_PROVISIONAL = '#f6d365';
	const UI_PROVISIONAL_LIGHT = '#998136';

	/* ── the in-context specimen ────────────────────────────────────────────
	 * ⚓ Nate: "can I see the current and proposed values used as text
	 * chips/buttons on the different backgrounds." Three forms, because a state
	 * colour is asked to do three different things and they fail differently: as
	 * INK it needs 4.5:1, as a soft CHIP the ink is the colour on 18% of itself,
	 * and as a solid BUTTON the colour is the ground and something else is the
	 * ink. */
	const UI_FORMS_GROUNDS = [
		{ k: 'night', label: 'night (bare scene)', bg: null, cls: '' },
		{ k: 'slate', label: 'slate-800 · ctx-dark', bg: SLATE800, cls: 'ctx-dark' },
		{ k: 'paper', label: 'parchment-100 · ctx-light', bg: PAPER100, cls: 'ctx-light' }
	];
	/** On a solid fill, the ink is whichever of white/near-black reads better —
	 *  the same question every button in the system answers. */
	const onFill = (hex: string) =>
		ratio(hex, '#0d0d0f') >= ratio(hex, '#ffffff') ? '#0d0d0f' : '#ffffff';

	const UI_ROLES = [
		{ key: 'danger', label: 'danger', now: '#e63946', next: '#e63946', nextLight: null },
		{ key: 'warning', label: 'warning', now: '#f4a261', next: '#f4a261', nextLight: null },
		{
			key: 'positive',
			label: 'positive',
			now: '#51c89a',
			next: UI_LIFTED.positive,
			nextLight: null
		},
		{
			key: 'provisional',
			label: 'provisional',
			/* Today this fact is drawn in --ui-danger — that IS the current
			   column, and seeing the ∅ red beside the ∅ yellow is the whole
			   comparison. */
			now: '#e63946',
			next: UI_PROVISIONAL,
			nextLight: UI_PROVISIONAL_LIGHT
		}
	];

	/* The risk ramp, verbatim from crit.ts — high risk → low risk, which is
	 * left → right on the hits/rotation slider (more hits = less risk). */
	const RAMP_NOW = ['#e63946', '#f4a261', '#f6d365', '#4ecca3'];
	const RAMP_GENSHIN = ['#ff5a5a', '#ffc700', '#80df66'];
	/** ⚠ DANGER AND WARNING ARE THE SHIPPED VALUES HERE, not the lifted ones —
	 *  the recommendation holds both, and a demo that quietly disagrees with its
	 *  own label is worse than no demo. Only positive moves.
	 *  🔎 WHICH MAKES THIS RAMP THE WHOLE POINT OF THE FOURTH VALUE: with
	 *  #f6d365 promoted to --ui-provisional, every one of the four stops is a
	 *  token, and the chart that FATHERED this family would finally be spelled
	 *  entirely in it. */
	const RAMP_LIFTED = ['#e63946', '#f4a261', UI_PROVISIONAL, UI_LIFTED.positive];
	const ramp = (stops: string[]) => `linear-gradient(to right, ${stops.join(', ')})`;

	/* ══ THE OTHER ICON SETS — measured, because the answer was counterintuitive ══
	 *
	 * ⚓ Nate: "there are other icons available — tcg, gilded, glow. What if we
	 * use something like tcg or gilded on parchment instead?"
	 *
	 * ⛔ NONE OF THEM WORKS ON PAPER, AND GILDED IS NEARLY THE WORST. Ink contrast
	 * against parchment-100, measured over every opaque pixel of all seven:
	 *
	 *     flat-color  1.06 – 2.32     tcg   1.38 – 2.14
	 *     glow        1.01 – 1.54     gilded 1.15 – 1.19
	 *
	 * Nothing clears the 3:1 graphical floor anywhere. "Gilded" reads like it
	 * belongs on parchment and is in fact bright gold FOR DARK GROUNDS; glow's
	 * anemo measures 1.01:1 on paper, which is invisible. Genshin has no light
	 * UI, so there is no light-ground glyph to borrow — that is the whole finding.
	 *
	 * ⚠ AND ONLY TWO OF THE FIVE SETS ARE TINTABLE. flat-color and flat-white are
	 * one colour plus straight alpha; tcg (461–1201 colours), gilded (128–180)
	 * and glow (32–76) are artwork with baked palettes. Using one of those in a
	 * context means THAT CONTEXT'S ICONS STOP TRACKING --el-*, which is the exact
	 * coupling generate-element-icons.mjs exists to guarantee. A system cost, not
	 * a taste one.
	 *
	 * ✅ BUT GILDED IS THE MOST INSTRUCTIVE OF THE FOUR. All seven of its glyphs
	 * average the same gold, within 0.05 of contrast of each other — it carries
	 * NO element colour at all. Genshin ships a set where element identity is
	 * carried entirely by the SILHOUETTE, which is what licenses the monochrome
	 * rows below.
	 *
	 * 🔎 glow is Genshin's own `hi` rung in icon form (4.57–7.86 vs the star) —
	 * the same two-tier pattern as their icon/in-text colour split, drawn twice.
	 */
	const MONO_PAPER = [
		{ key: 'ink', label: 'monochrome · --ink-900', color: '#3b4255' },
		{
			key: 'gold',
			label: 'monochrome · --gold-700 — the gilded idea, at a rung paper can hold',
			color: '#74603c'
		}
	];

	/* ══ THE MASK SOURCE IS flat-white, NOT flat-color ═══════════════════════════
	 * ⚓ Nate 2026-08-11, on being shown the measurement: "I didn't realize the
	 * flat white icons were larger."
	 *
	 * Both are one colour plus straight alpha, so both tint losslessly — but
	 * flat-white is 128px against flat-color's 84, and it carries three glyphs
	 * flat-color has no version of: lunar, omni and stellar. ⚓ Those three are
	 * NATE'S OWN, traced from art Genshin uses but never drew as icons, which is
	 * why they exist in white only. If they are ever wanted in colour he has
	 * schemes to suggest — do not invent one.
	 *
	 * So flat-white is a strictly better generator input, and this board reads
	 * from it for the same reason.
	 */
	const MASK = (el: string) => `url('/assets/elements/flat-white/${el}.png')`;

	/* ══ GLYPH SIZING — A "DEFECT" THAT WASN'T ═══════════════════════════════════
	 * The set survey turned up that the source art is not size-normalised: cropped
	 * to its own ink, cryo fills 89% of its canvas and hydro 75%, so at one CSS box
	 * hydro renders ~19% smaller in its longest dimension. True of flat-color
	 * (12–29% margins) and flat-white (11–25%) alike.
	 *
	 * ⛔ IT IS NOT BEING FIXED, and the reasoning is the part worth keeping.
	 * ⚓ Nate, shown all three rows: "to my eye, the non-normalized marks read most
	 * balanced." He is right, and my framing was wrong — I measured a variance and
	 * assumed uniformity was the correct state without establishing that it was.
	 *
	 * ⚠ THE NUMBERS BACKED HIM AND I MISSED IT. Ink area spans 17.6%–22.5%, a
	 * ratio of 1.28× — WIDER than the bounding-box spread of 1.19×. Neither metric
	 * is flat, and the two disagree about direction: hydro's box says ×1.19 while
	 * its ink says ×1.00, dendro's box says ×1.02 while its ink says ×1.13 (hydro
	 * is a solid droplet in a small box; dendro a sparse leaf in a large one). If
	 * the art were carelessly sized ONE of those would come out uniform. That both
	 * vary in opposite directions is what already-balanced-by-eye looks like: the
	 * artist compensated for perceived weight, which is the thing optical sizing
	 * actually means and which neither of my metrics measures.
	 *
	 * ⚠ THE GENERAL LESSON: a variance is not a defect until you can say what the
	 * correct value is. Both tables stay so the board can render the rejected
	 * candidates — seeing box-normalisation blob hydro is the argument.
	 */
	const SCALE_BY_BOX: Record<El, number> = {
		pyro: 1.056,
		electro: 1.14,
		hydro: 1.188,
		anemo: 1.096,
		geo: 1.14,
		dendro: 1.018,
		cryo: 1.0
	};
	const SCALE_BY_INK: Record<El, number> = {
		pyro: 1.067,
		electro: 1.114,
		hydro: 1.0,
		anemo: 1.051,
		geo: 1.074,
		dendro: 1.131,
		cryo: 1.092
	};
	const SIZING_ROWS = [
		{ key: 'asis', label: 'as shipped — untouched, and the one that reads best', scale: null },
		{
			key: 'box',
			label: 'normalised by BOUNDING BOX — rejected, blobs hydro',
			scale: SCALE_BY_BOX
		},
		{ key: 'ink', label: 'normalised by INK AREA — rejected, swells dendro', scale: SCALE_BY_INK }
	];
</script>

<svelte:head><title>Specimen Board — critcalc.app</title></svelte:head>

<div class="lab">
	<header class="lab-head">
		<h1>Specimen board</h1>
		<p>
			Every ground at real size, same content in each, at the crest under the real wash. Dev-only —
			<code>/styleguide</code> stays the exhaustive reference; this is the thing to judge from.
		</p>
	</header>

	<!-- ═════════════════════════════════════════════ 00 · THE BENCH CARD ══ -->
	<section>
		<h2 class="lab-h">The bench card, form C <span class="lab-badge">candidate</span></h2>
		<p class="sp-note">
			The real slot card: the Team Builder's portrait with the constellation on the disc, Swap at
			the end of the controls, no rail and no element icon. Click a constellation to set it; the
			portraits and ⇄ do nothing here.
		</p>
		{#snippet bcCard(seat: (typeof BC_SEATS)[number], compact: boolean)}
			{@const char = bcChar(seat.id)}
			<SlotPortrait
				slotId={seat.id ?? 'blank'}
				{char}
				{compact}
				compactDisc={bcRow.d}
				conLevel={seat.id ? (bcCon[seat.id] ?? seat.con) : 0}
				loadoutEntry={{}}
				onSetCon={(l) => seat.id && (bcCon = { ...bcCon, [seat.id]: l })}
				onSetArtifact={() => {}}
				onSetWeapon={() => {}}
				onSetRefinement={() => {}}
				onPortraitClick={() => {}}
				portraitLabel="(demo)"
				emptyLabel=""
				portrait="side"
				conOnDisc
				ownedCon={bcRosterKnown ? seat.owned : undefined}
			>
				{#snippet actions()}
					<button
						class="bc-swap"
						disabled={!char}
						title={char ? 'Swap' : undefined}
						aria-label={char ? `Swap ${char.displayName}` : 'Swap (empty slot)'}
						><Mark name="swap" /></button
					>
				{/snippet}
			</SlotPortrait>
		{/snippet}

		<div class="sp-knobs">
			<label
				>Card width <input type="range" min="130" max="200" bind:value={bcCardW} />
				<code>{bcCardW}px (today 200)</code></label
			>
			<label
				>Slot height <input type="range" min={BENCH_SLOT_H} max="140" bind:value={bcSlotH} />
				<code>{bcSlotH}px</code></label
			>
			<label><input type="checkbox" bind:checked={bcRosterKnown} /> Roster known</label>
		</div>
		<div class="bc-forms">
			<figure class="bc-form">
				<figcaption class="spec-tag">desk · the column beside the timeline</figcaption>
				<div
					class="bc-strip ctx-dark"
					style:--bc-w="{bcCardW}px"
					style:--bc-pad="{RIBBON_PAD}px"
					style:--bc-edge="{RIBBON_EDGE}px"
					style:--bc-frame="{RIBBON_FRAME_BORDER}px"
				>
					{#each BC_SEATS as seat, i (i)}
						<div class="bc-slot" style:height="{bcSlotH}px">{@render bcCard(seat, false)}</div>
					{/each}
				</div>
			</figure>
			<figure class="bc-form">
				<figcaption class="spec-tag">below 54rem · the row above band A</figcaption>
				<div class="sp-knobs">
					<label
						>Viewport <input type="range" min="320" max="863" bind:value={bcVw} />
						<code
							>{bcVw}px · cards {Math.round(bcRow.w)}×{bcRow.h}px{bcRow.full
								? ' · full'
								: ` · portrait ${bcRow.d}px, hair ${Math.round(bcRow.over)}px`}</code
						></label
					>
					<label><input type="checkbox" bind:checked={bcReserve} /> Reserve the hair</label>
				</div>
				<div class="bc-phone" style:width="{bcVw}px">
					<div
						class="bc-row ctx-dark"
						class:bc-row--spread={!bcRow.full}
						class:bc-row--reserve={bcReserve && !bcRow.full}
						style:--bc-over="{Math.round(bcRow.over)}px"
						style:--bc-chrome="{RIBBON_CHROME}px"
						style:--bc-gap="{BENCH_ROW_CARD_GAP}px"
					>
						{#each BC_SEATS as seat, i (i)}
							<div class="bc-cell" style:width="{bcRow.w}px" style:height="{bcRow.h}px">
								{@render bcCard(seat, !bcRow.full)}
							</div>
						{/each}
					</div>
					<div class="bc-band">band A</div>
				</div>
			</figure>
		</div>
		<p class="sp-note">
			Top to bottom / left to right: {BC_SEATS.map((x) => x.note).join(' · ')}. The phone row is the
			upright card: the loadout stands beside the portrait and Swap is gone, so a card is one row
			(today's compact card is 78px tall). Wherever four cards fit at the card width above, the row
			shows the full desk card. "Reserve the hair" grows the strip by the overhang instead of
			letting it spill. The desk strip draws the ribbon's real side chrome: {RIBBON_EDGE}px of bare
			edge, the
			{RIBBON_FRAME_BORDER}px frame (one stroke here; the real one is double), then the {RIBBON_PAD}px
			pad. The phone row uses the same {RIBBON_CHROME}px of chrome, without the frame.
		</p>
	</section>

	<!-- ═══════════════════════════════════════════ 0 · THE SIDE PORTRAIT ══ -->
	<section>
		<h2 class="lab-h">The side portrait <span class="lab-badge">candidate</span></h2>
		<div class="sp-knobs">
			<label
				>Disc <input type="range" min="32" max="96" bind:value={spDisc} />
				<code>{spDisc}px · art {Math.round(spDisc * spGeo.artPerDisc)}px</code></label
			>
			<label
				>Ring in icon px <input type="range" min="70" max="128" bind:value={spRing} />
				<code>{spRing} / 128</code></label
			>
			<label
				>Centre x <input type="range" min="40" max="90" bind:value={spCx} />
				<code>{spCx}</code></label
			>
			<label
				>Centre y <input type="range" min="50" max="110" bind:value={spCy} />
				<code>{spCy}</code></label
			>
			<label><input type="checkbox" bind:checked={spClip} /> Clip below centre</label>
		</div>

		<div class="lab-grid">
			{#each SP_GROUNDS as g (g.label)}
				<div class="spec {g.cls}" class:spec--bare={g.cls === ''}>
					<div class="spec-tag">{g.label}</div>
					<div class="sp-row">
						{#each SP_TEAM as id, i (id)}
							<SidePortrait
								{id}
								size={spDisc}
								geometry={spGeo}
								con={SP_CASES[i].con}
								ownedCon={SP_CASES[i].ownedCon}
								selected={i === 0}
							/>
						{/each}
						<SidePortrait id={null} size={spDisc} geometry={spGeo} />
					</div>
				</div>
			{/each}
		</div>

		<p class="sp-note">
			Left to right: {SP_CASES.map((c) => c.note).join(' · ')}. Hover a chip for its sentence.
		</p>

		<p class="sp-note">
			Two candidate sizes. Left: the disc at 64px (the art is upsampled about 1.35× on a 2× screen).
			Right: the ART at 64px (pixel for pixel on a 2× screen), which makes the disc about 47px.
		</p>
		<div class="sp-row sp-row--pair">
			<div class="sp-row">
				{#each SP_TEAM as id (id)}<SidePortrait {id} size={64} geometry={spGeo} />{/each}
			</div>
			<div class="sp-row">
				{#each SP_TEAM as id (id)}<SidePortrait
						{id}
						size={Math.round(64 / spGeo.artPerDisc)}
						geometry={spGeo}
					/>{/each}
			</div>
		</div>

		<p class="sp-note">The whole roster at the disc size above. Look for icons that sit oddly.</p>
		<div class="sp-sheet">
			{#each spRoster as c (c.id)}
				<figure class="sp-cell">
					<SidePortrait id={c.id} size={spDisc} geometry={spGeo} />
					<figcaption>{c.displayName}</figcaption>
				</figure>
			{/each}
		</div>
	</section>

	<!-- ══════════════════════════════════════════════════ 1 · THE GROUNDS ══ -->
	<section>
		<h2 class="lab-h">The grounds</h2>
		<div class="lab-grid">
			{#each SPECIMEN_GROUNDS as g (g.key)}
				<div class="spec {g.cls}" class:spec--bare={g.key === 'night'}>
					<div class="spec-tag">{g.label}</div>

					<!-- THE TYPE LADDER. Each row is sample + size tag, so the panel is
					     both a specimen and a legend. -->
					{#each TYPE_ROWS as t (t.cls)}
						<div class="ty-row">
							<span class={t.cls}>{t.text}</span>
							<span class="ty-tag">{t.tag}</span>
						</div>
					{/each}

					<!-- SECTION BREAK — the shipped .kicker: a label whose rule runs out
					     of its right-hand side. ⚠ It must DECLARE the body face; a
					     heading face here is the bug that keeps coming back. -->
					<p class="kicker">Section break</p>

					<p class="spec-prose">
						Prose with an <b>accent</b> in it, and a
						<a href="#top">link</a> to see the two apart.
					</p>
					<div class="spec-row">
						<span class="spec-label">Constellation</span>
						<span class="spec-value">C2</span>
					</div>
					<hr class="spec-rule" />
					<div class="spec-controls">
						<button class="btn" type="button"><Mark name="save" />Save</button>
						<button class="btn btn--primary" type="button">Apply</button>
						<button class="btn" type="button" disabled>Off</button>
					</div>
					<div class="spec-controls">
						<button class="tab active" type="button">Selected</button>
						<button class="tab" type="button">Resting</button>
					</div>
					<div class="spec-inset inset inset--plain">inset · gold</div>
					<div class="spec-lines">
						{#each LINE_STOPS as stop (stop)}
							<span class="spec-line" style:background="var({stop})"></span>
						{/each}
					</div>
					<div class="spec-note">{g.note}</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- ══════════════════════════════════════════════ 2 · THE SIZE-UP ══ -->
	<section>
		<h2 class="lab-h">
			The size-up <span class="lab-badge">shipped</span>
		</h2>
		<p class="lab-note">
			⚓ Approved and landed:
			<strong>every role moved up one rung, and the rungs did not move.</strong> 208 declarations across
			40 files were re-pointed one step up rather than the scale being re-cut — the direction matters,
			because those px values are quoted in dozens of comments and in the export mirror, and a scale whose
			numbers change under fixed names makes every one of them quietly wrong. A ladder is for climbing,
			not for sliding.
		</p>
		<p class="lab-note">
			Two ends are pinned. <strong>4xl · 24 is now the section heading AND the brand</strong> (⚓
			"unify Section headings and branding") — the masthead reads <code>--brand-size</code>, which
			is this token, so the two gain or lose it together. And <strong>5xl · 32 held</strong>: it is
			the instrument-readout rung, already as large as it wants to be, with nothing above it to
			climb to. Page titles moved up into it, so the two now share — different roles on one rung is
			fine, a role with no rung is not.
		</p>
		<div class="lab-row">
			<div class="su-table">
				{#each SIZE_UP as s (s.role)}
					<div class="su-trow" class:is-moved={s.moved}>
						<span class="su-role">{s.role}</span>
						<span class="ty-tag">{s.now}</span>
						<span class="su-arrow">{s.moved ? '→' : '·'}</span>
						<span class="ty-tag su-next">{s.next}</span>
					</div>
				{/each}
			</div>
			<div class="cand">
				<span class="cand-tag">a panel at the new sizes</span>
				<div class="ctx-dark sizeup">
					<h3 class="su-h3">Off-field DMG</h3>
					<p class="su-body">
						Coordinated attacks or damaging summons. Provided by <b>35</b> characters in the roster,
						of which you own <b>0</b>.
					</p>
					<div class="su-row"><span>Constellation</span><span>C2</span></div>
					<div class="spec-controls">
						<button class="btn" type="button">Filter</button>
						<button class="tab active" type="button">Atlas</button>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ═════════════════════════════════════════ 3 · THE NIGHT PAINTS ══ -->
	<section>
		<h2 class="lab-h">
			What may paint on the night <span class="lab-badge">proposal</span>
		</h2>
		<p class="lab-note">
			⚓ Nate: three, and all very transparent — a dark ribbon, a red ribbon, a gradient fade. The
			rule that keeps <em>night has no rungs</em> intact:
			<strong>these condition the world, they do not become grounds.</strong>
			None of them carries an ink ladder of its own; text on a scrim ribbon is still night text. The red
			one is the exception worth watching — it carries STATE (blocked / unavailable), so it is the one
			that must never be reached for as decoration.
		</p>
		<div class="lab-stack">
			<div class="night-ribbon">
				<h3 class="spec-title">Special Rules</h3>
			</div>
			<p class="spec-prose spec-prose--wide">
				A header needs a ribbon because it has to hold across whatever the sky is doing behind it.
				The prose under it does not — at <b>6.87:1</b> against the worst pixel it survives on its own,
				which is what the deeper wash bought.
			</p>
			<div class="night-ribbon night-ribbon--danger">
				<Mark name="gated" /> Challenge criteria not met
			</div>
			<div class="night-fade">
				<span>gradient fade — the landing footer's idiom, named</span>
			</div>
		</div>
	</section>

	<!-- ═══════════════════════════════════════════ 3 · BORDERS IN GOLD ══ -->
	<section>
		<h2 class="lab-h">
			Borders stay ink · the inset went gold <span class="lab-badge">shipped</span>
		</h2>
		<p class="lab-note">
			⚓ Settled here: <strong
				>a border is STRUCTURE and stays ink; the inset is ORNAMENT and went gold</strong
			>, zoned by context —
			<code>gold-400</code> on dark, <code>gold-700</code> on light. This grid is what settled it,
			and it is kept because the reason is visible in it: gold-600/700 barely lift off slate,
			gold-300/400 all but vanish into parchment. One hue can't serve both grounds, which is the
			same two-rung zoning
			<code>--accent</code> already uses. The shipped stop is <strong>α .18</strong>; the quiet stop
			(<code>--inset-line-quiet</code>, for <code>--double</code>) is .10.
		</p>
		<div class="border-grid">
			<div class="border-head">
				<span></span>
				<span class="cand-tag">on slate</span>
				<span class="cand-tag">on parchment</span>
			</div>
			{#each BORDER_CANDIDATES as c (c.key)}
				<div class="border-row">
					<span class="cand-tag border-name">{c.label}</span>
					{#each ['ctx-dark', 'ctx-light'] as ground (ground)}
						<div
							class="border-cell {ground}"
							style:--frame-line={c.src
								? `color-mix(in srgb, ${c.src} 18%, var(--frame-bg))`
								: null}
							style:--frame-line-quiet={c.src
								? `color-mix(in srgb, ${c.src} 10%, var(--frame-bg))`
								: null}
						>
							<div class="border-inset inset inset--plain">inset · α .18</div>
							<hr class="border-rule" />
							<hr class="border-rule border-rule--quiet" />
						</div>
					{/each}
				</div>
			{/each}
		</div>
	</section>

	<!-- ══════════════════════════════════════ 4 · GLASS HOVER + THE RING ══ -->
	<section>
		<h2 class="lab-h">
			The three states of a pane <span class="lab-badge">shipped</span>
		</h2>
		<p class="lab-note">
			<strong>rest .58 → hover .80 + an INK ring → selected .80 + a GOLD ring.</strong>
			<strong>Density separates resting from engaged; hue separates the two engaged states.</strong>
			⚓ Nate, correcting a version that took selected all the way to opaque: three densities meant the
			eye had to measure how solid a pane was to know what it was looking at, when the ring was already
			saying it in colour. Forced side by side, because
			<strong>you cannot judge a hover by hovering</strong>: you never see two states at once.
		</p>
		<p class="lab-note">
			⚓ The ring's colour settled with the row above. <strong>Borders stayed ink</strong>, which
			left gold free to mean SELECTED, so the hover ring keeps the pane's own ink. Had lines gone
			gold globally, a gold hover ring would have stopped distinguishing hover from selected — the
			one thing it has to do. The two rejected candidates stay below as the evidence.
		</p>
		<div class="lab-row">
			<div class="cand">
				<span class="cand-tag">the three states, shipped</span>
				{#each PANE_STATES as st (st.key)}
					<div class="ctx-glass glasspane {st.cls}">{st.label}</div>
				{/each}
			</div>
			{#each RING_CANDIDATES as r (r.key)}
				<div class="cand">
					<span class="cand-tag">hover ring · {r.label}</span>
					<div class="ctx-glass glasspane">rest · .58</div>
					<div class="ctx-glass glasspane is-dense" style:box-shadow="inset 0 0 0 1px {r.ring}">
						hover · .80
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- ══════════════════════════════════════ 5 · THE TWO PARCHMENTS ══ -->
	<section>
		<h2 class="lab-h">
			The two parchments <span class="lab-badge">shipped</span>
		</h2>
		<p class="lab-note">
			⚓ Nate sampled Genshin's two paper grounds — <code>#F2F1EC</code> for large panels and
			<code>#E8E5DD</code> for character cards. Our nearest rungs are
			<code>parchment-50</code> and <code>parchment-100</code>, both at a distance of 6, and — his
			constraint — <strong>they are ADJACENT rungs</strong>, so the pair is a half-step apart rather
			than a jump.
		</p>
		<p class="lab-note">
			<strong>The axis is SIZE, not depth.</strong> A large panel, a heading ribbon, or parchment
			carrying other parchment takes the lighter one (<code>--surface-broad</code>); a smaller item
			— a card, a button, a layer sitting on a broad panel — takes the darker one (<code
				>--surface</code
			>). ⚠ So the thing ON the paper is DARKER than the paper, which reverses what this system
			assumed a day earlier by reasoning from the dark context's ladder. Sampled beats symmetrical.
			⚠ And <code>ctx-light</code> therefore has
			<strong>no raised rung at all</strong> — it does not express depth by lightness, the way glass doesn't
			either.
		</p>
		<div class="lab-row">
			<div class="ctx-light paper-broad">
				<span class="paper-tag">--surface-broad · parchment-50 · the panel</span>
				<h3 class="su-h3">Off-field DMG</h3>
				<div class="ctx-light paper-object">
					<span class="paper-tag">--surface · parchment-100 · a card on it</span>
					<p class="spec-prose">The same paper a character card is made of.</p>
					<button class="btn" type="button">Filter</button>
				</div>
			</div>
			<div class="ctx-light paper-object paper-object--alone">
				<span class="paper-tag">--surface · standalone card</span>
				<p class="spec-prose">
					A smaller light object on the scene takes the same rung whether or not it sits on a broad
					panel — which is why this is a TOKEN and not a context modifier.
				</p>
			</div>
		</div>
	</section>

	<!-- ══════════════════════════════════════════ 6 · GOLD IN TEXT ══ -->
	<section>
		<h2 class="lab-h">
			Gold in text <span class="lab-badge">proposal</span>
		</h2>
		<p class="lab-note">
			Read off the five Genshin screenshots, the pattern is narrower than "an accent colour" and
			surprisingly consistent: <strong>gold names a BLOCK; it never emphasises a WORD.</strong> Their
			section labels — "Opening Characters", "Performance Requirements", "Challenge Criteria", "Special
			Rules" — are all gold. Their titles are not: those are white on dark, dark ink on light. And inline
			emphasis inside prose is never gold either — it is a hotter ORANGE, or the element's own hue.
		</p>
		<p class="lab-note">
			⚠ <strong>So gold sits BELOW the title in the hierarchy</strong>, which is the
			counterintuitive part and the reason it is worth writing down rather than applying by feel:
			you would expect the accent on the most important thing, and Genshin puts it on the
			second-most. The title is the loudest by SIZE; gold marks the thing that names a region.
		</p>
		<div class="lab-row">
			{#each [{ k: 'dark', cls: 'ctx-dark', t: 'on slate' }, { k: 'light', cls: 'ctx-light', t: 'on parchment' }] as g (g.k)}
				<div class="cand">
					<span class="cand-tag">{g.t} — today</span>
					<div class="{g.cls} goldspec">
						<h3 class="ty-h1">Off-field DMG</h3>
						<p class="kicker">Who provides it</p>
						<p class="spec-prose">
							Coordinated attacks or damaging summons, from <b>35</b> characters.
						</p>
					</div>
					<span class="cand-tag">{g.t} — gold names the block</span>
					<div class="{g.cls} goldspec goldspec--next">
						<h3 class="ty-h1">Off-field DMG</h3>
						<p class="kicker">Who provides it</p>
						<p class="spec-prose">
							Coordinated attacks or damaging summons, from <b>35</b> characters.
						</p>
					</div>
				</div>
			{/each}
		</div>
		<p class="lab-note sg-note--flag">
			⚠ <strong>THE GAP THIS OPENS: we have no inline-emphasis colour.</strong> Genshin's is an
			orange (<code>#f39000</code>) that belongs to no other role — it marks "takes DMG", "bolt of
			lightning", a level number. Ours is gold today (the bold runs above), and if gold becomes the
			block label then using it inside prose as well puts one hue on two unrelated jobs, which is
			exactly the drift the census exists to catch. Three ways out, none chosen: borrow the element
			hue where the emphasised thing HAS an element, promote a warm rung of our own, or accept that
			emphasis is weight-only. Worth deciding with the <code>--el-*</code> round, not before it.
		</p>
	</section>

	<!-- ══════════════════════════════════════════ 4 · THE SPLIT CARD ══ -->
	<section>
		<h2 class="lab-h">
			The Atlas card, split <span class="lab-badge">proposal</span>
		</h2>
		<p class="lab-note">
			Identity on the dark half, content on the light half — Genshin's own split, turned side-on for
			our aspect. Today's all-glass card sits beside it at the same size.
			<strong>The inversion is the information</strong>: the seam says "this side is what it is,
			that side is what it holds".
		</p>
		<div class="lab-row">
			<div class="atlas atlas--glass ctx-glass">
				<div class="atlas-id"><span class="atlas-glyph">◈</span></div>
				<div class="atlas-body">
					<h3 class="spec-title">On-field DPS</h3>
					<p class="spec-prose"><b>48</b> provides · <b>0</b> owned</p>
				</div>
			</div>
			<div class="atlas atlas--split">
				<div class="atlas-id ctx-dark"><span class="atlas-glyph">◈</span></div>
				<div class="atlas-body ctx-light">
					<h3 class="spec-title">On-field DPS</h3>
					<p class="spec-prose"><b>48</b> provides · <b>0</b> owned</p>
				</div>
			</div>
		</div>
	</section>

	<!-- ══════════════════════════════════ 7 · THE BENCH, ON THE SCENE ══ -->
	<section>
		<h2 class="lab-h">
			The bench, on the scene <span class="lab-badge">shipped</span>
		</h2>
		<p class="lab-note">
			Two questions the tools cannot answer, because in a tool you only ever see one answer at a
			time: <strong>what shade the strip is next to the glass</strong>, and
			<strong>how deep its controls sit in it</strong>. Both settled here, and the row is kept
			because the reason is visible in it.
		</p>
		<p class="lab-note">
			⚠ <strong>The band is not slate — it is slate composited over a dimmed world.</strong>
			<code>--glass-panel</code> at .58 over
			<code>--scene-dim</code> at <code>TOOL_DIM</code> lands around
			<strong>#262b36…#293040</strong>, and it MOVES with whatever the world is doing behind it. So
			the strip at <code>--surface</code> stands one rung ABOVE its neighbours, which is what makes
			it read as the solid object among panes. ⚓ <strong>It stays there.</strong> One darker would put
			it ON the glass's own average, and then the only thing separating opaque from translucent is whether
			stars swim through it.
		</p>
		<p class="lab-note">
			On the controls: the gradient-plus-stroke on the right is what shipped before this round. The
			gradient manufactured an inner shadow and the stroke drew the shape the gradient was too faint
			to draw alone — <strong>one idea in two parts</strong>, and both predate the depth ladder. A
			flat rung states it directly.
		</p>
		<p class="lab-note">
			⛔ <strong
				>That stroke is declared <code>1.5px</code> and has never once been painted at 1.5px.</strong
			>
			Measured 2026-08-13 across four device-pixel ratios:
			<strong>Chrome floors <code>border-width</code> to whole CSS pixels</strong> — 0.5, 1, 1.25,
			1.5 and 1.75 all paint at 1px — while WebKit gives 1 / 1.33 / 1.5 / 1.33 depending on DPR. So
			this specimen has always shown a 1px stroke in the browser it was judged in, and a different
			weight in the one we ship to. <code>box-shadow</code> is the mirror image and is not a
			workaround (Chrome renders a 1.5px inset ring exactly; WebKit wobbles). The value is
			<strong>retired, not rehoused</strong>: declare whole pixels. It survives here only because
			this column is a RECORD of what shipped before — and the label now says what it actually drew.
		</p>
		<p class="lab-note">
			⚓ <strong>"How deep" turned out to be a question about the RAMP, not about the card.</strong>
			The two middle columns are the old <code>slate-900</code> and <code>slate-950</code>, drawn
			from literals because they are no longer tokens: 900 was the one rung that broke the ramp's
			saturation curve (C/L climbs .053 → .081 from 300 to 800 and then dips at 900), and 950 was
			deeper than a well needs. <strong>They merged into one rung at their midpoint</strong> — L
			.269, chroma back on the .028–.030 plateau. What the eye gets is the depth: the well's step
			below the card ground went <strong>ΔL .027 → .060</strong>, which is what lets it read with no
			stroke at all.
		</p>
		<div class="lab-row lab-row--bench">
			{#each BENCH_VARIANTS as v (v.key)}
				<div class="cand">
					<span class="cand-tag">{v.label}</span>
					<div
						class="benchstrip ctx-dark"
						style:background={v.ground}
						style:--bx-fill={v.fill}
						style:--bx-border={v.border}
					>
						<span class="bx-frame bx-frame--tight" aria-hidden="true"></span>
						<span class="bx-frame bx-frame--wide" aria-hidden="true"></span>
						<div class="bx-card">
							<div class="bx-id">
								<span class="bx-el" aria-hidden="true"></span>
								<span class="bx-name">Furina</span>
								<span class="bx-ctl bx-ctl--chip">C2</span>
							</div>
							<div class="bx-portrait"></div>
							<div class="bx-base">
								<span class="bx-ctl bx-ctl--act"><Mark name="swap" /></span>
								<span class="bx-pill">
									<span class="bx-zone"></span>
									<span class="bx-zone"></span>
									<span class="bx-zone bx-zone--ref">R1</span>
								</span>
								<span class="bx-ctl bx-ctl--act"><Mark name="close" /></span>
							</div>
						</div>
						<div class="bx-divider" aria-hidden="true"></div>
					</div>
				</div>
			{/each}
			<div class="cand">
				<span class="cand-tag">a real band, for reference</span>
				<div class="ctx-glass benchband">Rotation · Save · Share</div>
				<div class="ctx-glass benchband benchband--well">zoom · notes</div>
			</div>
		</div>
	</section>

	<!-- ════════════════════════════════ 8 · THE ATLAS CARD, AS A BLOCK ══ -->
	<section>
		<h2 class="lab-h">
			The Atlas card, as a block <span class="lab-badge">proposal</span>
		</h2>
		<p class="lab-note">
			⚓ Nate: <em>"the cards are reading really wide, almost like fat banners."</em> Measured at
			1600×1000, the card is <strong>656 × 210 — a ratio of 3.12:1</strong>, wider than the monitor
			it is drawn on. And the shape is not even stable: it is 2.39:1 at 1280, because the WIDTH is
			given by the column while the HEIGHT is asserted by a <code>min-height: 210px</code> nothing needs.
			A card whose proportions change with the window is not an object yet.
		</p>
		<p class="lab-note">
			⚠ <strong>The 2×2 grid uses 436px of a 795px column.</strong> That 359px is not breathing
			room, it is dead — the drill-down <em>replaces</em> the cards rather than opening beneath them,
			so nothing ever uses it. The height is already paid for; the cards simply decline to take it.
		</p>
		<p class="lab-note">
			So: <strong>cap the measure and fix the ratio.</strong> A centred cap does the "more space
			around them" directly (189px of scene either side at 1600) and, because the cap holds below
			1600 too, <strong>the card becomes the same object at every width</strong>. The height then
			follows from <code>aspect-ratio</code> rather than from a floor — one knob, and the card stops arguing
			with the viewport.
		</p>
		<p class="lab-note">
			⚠ On the gap: <strong>yes, raise it — but keep it well under the outer margin.</strong> Four cards
			read as one object only while the space between them is clearly smaller than the space around them.
			16 → 20 against a 189px margin is about 1:9, which is comfortably a cluster. Take the gap much past
			that and you get four unrelated cards.
		</p>
		<div class="lab-row lab-row--atlas">
			<div class="cand">
				<span class="cand-tag">now · 656 × 210 · 3.12:1</span>
				<div class="ctx-glass atlasnow">
					<div class="an-art" aria-hidden="true"></div>
					<div class="an-glyphs"><span></span><b>+</b><span></span></div>
					<span class="an-label">On-Field DPS</span>
					<span class="an-counts"><b>48</b> provides · <b class="an-owned">12</b> owned</span>
					<div class="an-pips">
						{#each ATLAS_PIPS as pip (pip.el)}<span class="an-pip"
								><i style:background={pip.color}></i>{pip.n}</span
							>{/each}
					</div>
				</div>
			</div>
			<div class="cand">
				<span class="cand-tag">proposed · 465 × 388 · 6:5</span>
				<div class="atlasblock">
					<!-- THE DARK HALF — identity. Glass, because it is the same pane the
					     card has been since 2026-08-09; only the light half is new. -->
					<div class="ab-id ctx-glass">
						<div class="ab-glyphs"><span></span><b>+</b><span></span></div>
						<span class="ab-label">On-Field DPS</span>
					</div>
					<!-- THE PARCHMENT HALF — content. ⚓ Nate's SVG covers this. -->
					<div class="ab-body ctx-light">
						<div class="ab-art" aria-hidden="true">your SVG</div>
						<div class="ab-readout">
							<span class="ab-fig"><b>48</b><small>provides</small></span>
							<span class="ab-fig ab-fig--owned"><b>12</b><small>owned</small></span>
						</div>
						<div class="ab-pips">
							{#each ATLAS_PIPS as pip (pip.el)}<span class="ab-pip"
									><i style:background={pip.color}></i>{pip.n}</span
								>{/each}
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ══════════════════════════════════ 9 · THE ELEMENT COLOURS ══ -->
	<section>
		<h2 class="lab-h">
			Element colours <span class="lab-badge">shipped</span>
		</h2>
		<p class="lab-note">
			⚓ <strong>SETTLED 2026-08-11: Genshin's palette, transcribed.</strong>
			<code>main</code> is their icon set, <code>hi</code> is their in-text set, and
			<strong>neither is computed</strong> — two tables copied out of the game. The board is kept because
			the reason is visible in it, and because the losing candidate is the useful half of the record.
		</p>
		<p class="lab-note">
			⚓ <em
				>"Looking at it straight, Genshin's palette is superior to ours. We don't need to keep our
				values for any particular reason."</em
			>
			That released the constraint everything else was bending around. Hydro had looked like a trilemma
			— their hue, our lightness, its chroma, pick two — but it was only stuck because our own ladder
			pinned it dark. Stop defending that and hydro is just <code>#00c0ff</code>.
		</p>
		<p class="lab-note">
			⛔ <strong
				>WHY THE DIVERGENCE LOST, since it was the better-looking candidate for two rounds.</strong
			>
			It had exactly two advantages and both evaporated. It read better on parchment — deleted by the
			decision that element marks live on dark. And it improved white-on-fill 1.33 → 1.69 — but paid
			<strong>2.95 → 2.49 on fill-vs-star</strong>, which is the priority Nate had ranked FIRST (⚓
			<em>"the highest priority is the bars showing cleanly"</em>). It traded the first priority for
			a rounding error on the second, on a label the halo was already carrying. Its remapped pyro
			was also the thing he flagged as over-chromatic — an artefact of pushing the ladder down into
			the reddest part of the headroom.
		</p>
		<p class="lab-note">
			⚠ <strong>What survives from it is its SHAPE, not its values.</strong> If one element
			misbehaves in the real timeline, fix that element with a comment saying why — the pattern the
			generator's old <code>ICON_HUE_OFFSET</code> used, where an entry is a claim that must survive being
			asked why. A per-element exception you can defend beats a global transform you cannot.
		</p>

		<!-- ── 9a · what Genshin actually uses ─────────────────────────────── -->
		<h3 class="lab-sub">Two palettes, and the second is the first, lifted</h3>
		<p class="lab-note">
			The icon colours are measured off the flat-colour art (one colour per file, so this is not an
			estimate). The second set is the <code>&lt;color=#rrggbbff&gt;</code> tag the game wraps
			elemental words in inside its own description strings — from the <code>genshin-db</code>
			dependency, <strong>8891 uses</strong> of the cryo one alone. The game's own table, not a fan reconstruction.
		</p>
		<p class="lab-note">
			⚠ Every in-text colour is its icon hue carried up to a lightness floor (<code
				>oklch L ≈ .79</code
			>) and left alone if it was already above it: pyro climbs .699 → .788, cryo barely moves at
			.892 → .938.
			<strong
				>Genshin's palette therefore arrives with its own <code>hi</code> rung already drawn</strong
			>
			— which is why the two ladders below are not symmetrical work. For their set we derive only
			<code>deep</code>. Deriving a rung we have been handed would be manufacturing a disagreement.
		</p>
		<div class="lab-grid lab-grid--el">
			{#each SPECIMEN_GROUNDS as g (g.key)}
				<div class="spec elspec {g.cls}" class:spec--bare={g.key === 'night'}>
					<div class="spec-tag">{g.label}</div>
					{#each PALETTES as s (s.key)}
						<div class="elref-tag">{s.label}</div>
						<div class="elref">
							{#each EL7 as el (el)}
								<div class="elcell">
									<i
										class="elglyph"
										style="--c:{s.set[el]}; --m:url('/assets/elements/flat-color/{el}.png')"
									></i>
									<span class="elbar" style:background={s.set[el]}></span>
								</div>
							{/each}
						</div>
					{/each}
				</div>
			{/each}
		</div>

		<!-- ── 9b · the cryo/anemo correction ──────────────────────────────── -->
		<h3 class="lab-sub">On cryo being too turquoise — it was mostly our anemo</h3>
		<p class="lab-note">
			⚓ <em
				>"I didn't completely like their cryo value — I felt it was too turquoise, encroaching on
				anemo territory."</em
			>
			That is a different constraint from the one written into
			<code>app.css</code> (which records hydro, not anemo) and it changes the answer, so it is worth
			measuring rather than accepting.
		</p>
		<p class="lab-note">
			In oklch hue: <strong>ours anemo–cryo {hueGap(EL_NOW.anemo, EL_NOW.cryo).toFixed(0)}°</strong
			>,
			<strong>Genshin's {hueGap(EL_GENSHIN_ICON.anemo, EL_GENSHIN_ICON.cryo).toFixed(0)}°</strong>
			— so the complaint is real as an angle. But look at where the angle went:
			<strong
				>their anemo is {(toOklch(EL_NOW.anemo)[2] - toOklch(EL_GENSHIN_ICON.anemo)[2]).toFixed(0)}°
				greener than ours</strong
			>. Their anemo (<code>#33d7a0</code>) is a spring green and their cryo (<code>#7af2f2</code>)
			is exact cyan; ours are two teals sitting 40° apart and reading closer than the number says.
			<strong>Adopting their palette fixes most of the crowding by moving anemo, not cryo.</strong>
		</p>
		<p class="lab-note">
			🎛️ The divergence still takes cryo <strong>{CRYO_NUDGE}° toward blue</strong> for your taste —
			opening anemo–cryo to
			{hueGap(EL_OURS_V2.anemo, EL_OURS_V2.cryo).toFixed(0)}° while leaving cryo–hydro at
			{hueGap(EL_OURS_V2.cryo, EL_OURS_V2.hydro).toFixed(0)}°. Our shipped cryo sits
			{(toOklch(EL_NOW.cryo)[2] - toOklch(EL_GENSHIN_ICON.cryo)[2]).toFixed(0)}° out; this is a
			third of that, because their anemo already did most of the work.
			<code>CRYO_NUDGE</code> is one number in the script.
		</p>

		<!-- ── 9c · the dial ───────────────────────────────────────────────── -->
		<h3 class="lab-sub">Where the divergence actually is — the ladder, lowered</h3>
		<p class="lab-note">
			⚓ <em
				>"We are absolutely keeping white labels on the bars… but legibility doesn't need to be so
				high. I'm up for slightly darker bars… the highest priority is the bars showing cleanly and
				with pleasing element colours on the night scene."</em
			>
		</p>
		<p class="lab-note">
			Genshin never has to put 11px white on these fills, so their span runs bright:
			<code>oklch L .699–.892</code>. The divergence is
			<strong>that one axis and nothing else</strong>
			— same hues, same relative chroma, ladder remapped into
			<code>[{LADDER_LO}, {LADDER_HI}]</code>.
		</p>
		<p class="lab-note">
			⚠ <strong>It remaps rather than clips.</strong> A ceiling is the obvious move and it is wrong:
			capping at L .74 lands <em>five of the seven on the same rung</em>, and a palette with no
			lightness ladder is unreadable in a dense stacked chart. Remapping keeps Genshin's spacing —
			more even than ours ever was — and just moves and narrows it.
		</p>
		<p class="lab-note">
			⚠ <strong>Chroma is kept as a fraction of the gamut, not as an absolute.</strong> Dropping
			cryo from L .892 makes <em>more</em> chroma available, and holding its absolute value would spend
			that headroom on nothing. A darker cryo that is also duller is the muddy version of this idea.
		</p>
		<div class="eldial">
			{#each [{ k: 'Genshin, straight', s: EL_GENSHIN_ICON }, { k: `the divergence · [${LADDER_LO}, ${LADDER_HI}]`, s: EL_OURS_V2 }] as row (row.k)}
				<div class="eldial-row">
					<span class="eldial-tag">{row.k}</span>
					<span class="eldial-fig"
						>worst white-on-fill <b>{extremes(row.s).white.toFixed(2)}:1</b></span
					>
					<span class="eldial-fig"
						>worst fill-vs-star <b>{extremes(row.s).star.toFixed(2)}:1</b></span
					>
				</div>
			{/each}
		</div>
		<p class="lab-note">
			🎛️ <strong>That is the trade, and both ends of it are real</strong> — every step down helps
			the label and costs the fill. <code>LADDER_LO</code> / <code>LADDER_HI</code> are two numbers at
			the top of this page's script; the pair above re-measures itself when you move them. It is set nearer
			the bright end than a contrast target alone would put it, on purpose, because you ranked the fill
			first.
		</p>

		<!-- ── 9d · the two ladders ────────────────────────────────────────── -->
		<h3 class="lab-sub">The two palettes, all three rungs</h3>
		<div class="lab-row lab-row--ladder">
			{#each [{ k: 'Genshin, straight — SHIPPED', rows: LADDER_GENSHIN }, { k: 'the divergence — rejected', rows: LADDER_V2 }] as pal (pal.k)}
				<div class="cand">
					<span class="cand-tag">{pal.k}</span>
					<div class="elladder">
						{#each pal.rows as row (row.el)}
							<div class="ell-row">
								<span class="ell-name">{row.el}</span>
								<div class="ell-cell">
									<span class="ell-sw" style:background={row.deep}></span>
									<span class="ell-hex">{row.deep}</span>
									<span class="ell-r">{r2(row.deep, PAPER)}:1</span>
								</div>
								<div class="ell-cell">
									<span class="ell-sw" style:background={row.main}></span>
									<span class="ell-hex">{row.main}</span>
									<span class="ell-r">{r2(row.main, STAR)}:1</span>
								</div>
								<div class="ell-cell">
									<span class="ell-sw" style:background={row.hi}></span>
									<span class="ell-hex">{row.hi}</span>
									<span class="ell-r">{r2(row.hi, STAR)}:1</span>
								</div>
							</div>
						{/each}
						<div class="ell-legend">
							<span></span><span>deep · vs paper</span><span>main · vs star</span>
							<span>hi · {pal.rows[0].hiGiven ? "Genshin's own" : 'derived'}</span>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- ── 9e · bars on night, white labels ────────────────────────────── -->
		<h3 class="lab-sub">Goal 2 · the bars on night, white labels — settled ink, open fill</h3>
		<p class="lab-note">
			The ink question is closed: <strong>white, with its halo</strong>. So this row is not three
			answers any more, it is the same answer on two fills — which makes it the honest picture of
			what
			<code>LADDER_LO/HI</code> buys. Judge the <em>fill</em> first and the label second, in that order.
		</p>
		<div class="elpills">
			{#each [{ k: 'Genshin, straight — SHIPPED', rows: LADDER_GENSHIN }, { k: 'the divergence — rejected', rows: LADDER_V2 }] as pal (pal.k)}
				<div class="elpill-row">
					<span class="elpill-tag">{pal.k}</span>
					{#each pal.rows as row (row.el)}
						<span
							class="elpill elpill--halo"
							style:background={row.main}
							style:--label-halo={row.deep}>Q · {row.el}</span
						>
					{/each}
				</div>
			{/each}
			<div class="elpill-row">
				<span class="elpill-tag">ours — the palette this replaced</span>
				{#each EL7 as el (el)}
					<span
						class="elpill elpill--halo"
						style:background={EL_NOW[el]}
						style:--label-halo="#081225">Q · {el}</span
					>
				{/each}
			</div>
		</div>

		<!-- ── 9f · icons on light ─────────────────────────────────────────── -->
		<h3 class="lab-sub">
			Goal 1 · the icon on parchment — four answers and a fifth that sidesteps it
		</h3>
		<p class="lab-note">
			⛔ <strong
				>The other official sets do not rescue this, and the one that sounds like it should is
				nearly the worst.</strong
			>
			Ink contrast on parchment-100, over every opaque pixel:
			<code>flat-color 1.06–2.32</code> · <code>tcg 1.38–2.14</code> ·
			<code>glow 1.01–1.54</code> · <code>gilded 1.15–1.19</code>. Nothing clears 3:1 anywhere.
			Gilded is bright gold <em>for dark grounds</em>; glow's anemo measures 1.01:1 on paper, which
			is invisible.
			<strong>Genshin has no light UI, so there is no light-ground glyph to borrow.</strong>
		</p>
		<p class="lab-note">
			⚠ And only <code>flat-color</code> / <code>flat-white</code> are tintable — one colour plus
			straight alpha. <code>tcg</code>, <code>gilded</code> and <code>glow</code> are artwork with
			baked palettes, so adopting one means
			<strong
				>that context's icons stop tracking
				<code>--el-*</code></strong
			>. That is the coupling the generator exists to guarantee; it is a system cost, not a taste
			one.
		</p>
		<p class="lab-note">
			✅ <strong>But gilded is the most instructive of the four.</strong> All seven of its glyphs
			average the same gold, within 0.05 of contrast of each other — it carries
			<em>no element colour at all</em>. Genshin ships a set where identity is carried entirely by
			the
			<strong>silhouette</strong>, and that is what licenses the two monochrome rows below.
		</p>
		<div class="ctx-light elpaper">
			<div class="elpaper-row">
				<span class="elpaper-tag">a · main on paper — the smudge</span>
				{#each EL7 as el (el)}
					<i class="elglyph elglyph--lg" style="--c:{EL_NOW[el]}; --m:{MASK(el)}"></i>
				{/each}
				<span class="elpaper-r">{r2(EL_NOW.cryo, PAPER)}:1 worst</span>
			</div>
			<div class="elpaper-row">
				<span class="elpaper-tag">b · the deep rung — seven muddy colours</span>
				{#each LADDER_V2 as row (row.el)}
					<i class="elglyph elglyph--lg" style="--c:{row.deep}; --m:{MASK(row.el)}"></i>
				{/each}
				<span class="elpaper-r">{r2(LADDER_V2[0].deep, PAPER)}:1</span>
			</div>
			{#each MONO_PAPER as m (m.key)}
				<div class="elpaper-row">
					<span class="elpaper-tag">{m.key === 'ink' ? 'c' : 'd'} · {m.label}</span>
					{#each EL7 as el (el)}
						<i class="elglyph elglyph--lg" style="--c:{m.color}; --m:{MASK(el)}"></i>
					{/each}
					<span class="elpaper-r">{r2(m.color, PAPER)}:1</span>
				</div>
			{/each}
			<p class="elpaper-note">
				⚓ <strong
					>You already called it, and the measurements agree: the fifth answer is the one.</strong
				>
				Follow Genshin's own practice and
				<strong>do not put element marks on light UI at all</strong>
				— move the Atlas pips to the card's glass half, where the full-strength palette runs
				{r2(EL_OURS_V2.pyro, STAR)}–{r2(EL_OURS_V2.cryo, STAR)}:1 with no second tint set, no
				monochrome compromise, and no <code>deep</code> rung to keep in lockstep. A colour problem solved
				by not having the colour on the paper. The row is directly below.
			</p>
			<p class="elpaper-note">
				Of the four that stay on paper: <strong>c</strong> is the strongest — it is gilded's own
				logic, it reaches {r2(MONO_PAPER[0].color, PAPER)}:1, and cryo stops being a problem because
				there is no pale colour left to fail. <strong>d</strong> is the same idea wearing the gilded
				flavour, and it is the one to pick if these ever need to read as ornament rather than data.
				<strong>b</strong> buys colour that is too muddy to be a fast lookup, at the price of a whole
				second generated set. ⚠ Judge c and d at pip size, not at this size — the question is whether
				seven silhouettes are separable small, and that is exactly what gilded is Genshin's evidence for.
			</p>
			<div class="elpaper-row elpaper-row--small">
				<span class="elpaper-tag">c and d again, at real pip size</span>
				{#each EL7 as el (el)}
					<i class="elglyph" style="--c:#3b4255; --m:{MASK(el)}"></i>
				{/each}
				<span class="elpaper-sp"></span>
				{#each EL7 as el (el)}
					<i class="elglyph" style="--c:#74603c; --m:{MASK(el)}"></i>
				{/each}
			</div>
		</div>
		<div class="elonglass">
			<span class="elpaper-tag">the recommendation · full strength, on the glass half</span>
			<div class="ctx-glass elonglass-pane">
				{#each EL7 as el (el)}
					<span class="elpip"
						><i class="elglyph" style="--c:{EL_OURS_V2[el]}; --m:{MASK(el)}"></i>{[
							9, 8, 7, 7, 6, 5, 6
						][EL7.indexOf(el)]}</span
					>
				{/each}
			</div>
		</div>

		<!-- ── 9g · the sizing defect ──────────────────────────────────────── -->
		<h3 class="lab-sub">Glyph sizing — I called this a defect and it is not one</h3>
		<p class="lab-note">
			⛔ <strong
				>NOT FIXED, ON PURPOSE. ⚓ Nate: "to my eye, the non-normalized marks read most balanced" —
				and he is right.</strong
			> The row below is the whole argument; judge it, do not re-derive it.
		</p>
		<p class="lab-note">
			The measurement that started this is real: cropped to its own ink, each glyph fills a
			different share of its canvas — cryo 89%, hydro 75% — so at one CSS box hydro renders ~19%
			smaller in its longest dimension than cryo. <strong
				>What was wrong was calling that a defect.</strong
			> I measured a variance and assumed uniformity was the correct state, without establishing it.
		</p>
		<p class="lab-note">
			⚠ <strong>And my own numbers said otherwise, which I should have noticed.</strong> Ink area
			across the seven spans 17.6%–22.5%, a ratio of <strong>1.28×</strong> — <em>wider</em> than
			the bounding-box spread of 1.19×. Neither measure is flat, and they disagree about direction:
			hydro's box says ×1.19 while its ink says ×1.00; dendro's box says ×1.02 while its ink says
			×1.13. If the art were carelessly sized, one metric would come out uniform. That both vary, in
			opposite directions, is what <strong>already balanced by eye</strong> looks like — a sparse spiky
			glyph needs more box than a dense one to carry the same weight, and miHoYo's artist did that work.
		</p>
		<p class="lab-note">
			⚠ The general lesson is worth more than the case: <strong
				>a variance is not a defect until you can say what the correct value is.</strong
			> Both normalisations stay rendered below as the evidence — box-normalising visibly blobs hydro,
			ink-normalising visibly swells dendro, and neither reads as well as the art does untouched.
		</p>
		<div class="elsizing">
			{#each SIZING_ROWS as row (row.key)}
				<div class="elsizing-row">
					<span class="elpaper-tag">{row.label}</span>
					{#each EL7 as el (el)}
						<i
							class="elglyph elglyph--lg"
							style="--c:{EL_OURS_V2[el]}; --m:{MASK(el)}; --ms:{row.scale
								? (row.scale[el] * 100).toFixed(1)
								: 100}%"
						></i>
					{/each}
				</div>
			{/each}
		</div>

		<p class="lab-note">
			🔎 Two asides worth keeping. <strong
				><code>flat-white</code> is a strictly better generator input than
				<code>flat-color</code></strong
			>
			— same lossless tintability, 128px against 84, and it carries <code>lunar</code>,
			<code>omni</code>
			and <code>stellar</code>. ⚓ Those three are
			<strong>Nate's own</strong>, traced from art Genshin uses but never drew as icons, which is
			why they exist in white only; if they are ever wanted in colour he has schemes to suggest, so
			<strong>do not invent one</strong>. And <code>glow</code> is Genshin's own <code>hi</code> rung
			in icon form (4.57–7.86 against the star) — the same two-tier pattern as their icon/in-text colour
			split, drawn a second time in a different medium.
		</p>

		<p class="lab-note">
			<strong>Scope note.</strong> Three families ride along and would drift the moment the mains
			move: the <code>--rx-*</code> aura colours (frozen is cryo's <code>hi</code> by construction,
			burning is pyro pushed to ember), <code>--el-none-main</code> and <code>physical</code> (which
			have no light rung at all), and the generated icon manifest. <code>elementColors.ts</code> and
			the export mirror test are the two places that must move in lockstep with
			<code>app.css</code>.
		</p>
	</section>

	<!-- ═══════════════════════════════════ 10 · A FOURTH RUNG, FOR BARS ══ -->
	<section>
		<h2 class="lab-h">
			A deeper rung — for BARS only <span class="lab-badge">shipped</span>
		</h2>
		<p class="lab-note">
			✅ <strong>SETTLED 2026-08-12: candidate D ships as <code>--el-*-bar</code></strong> — the
			planner's cast pills and every phase of them, the summon lane, the active-row tint, the label
			halo, and the Team Builder's Compare bars. ⛔
			<strong>Not the icons, not the glyphs, not the portrait washes, not the avatar rings</strong> —
			the board's whole test is a bar beside an UNCHANGED icon, and the rung only works because the icon
			did not follow it down.
		</p>
		<p class="lab-note">
			⚓ <em
				>"We rejected a deeper rung for icons, but I think we might need a deeper rung for things
				like bars… very slightly deeper (colour density) and slightly more balanced between the
				darkness of the scene and the white of their text."</em
			>
		</p>
		<p class="lab-note">
			⚠ <strong
				>This is not a re-tune of the palette, and that distinction is what makes it allowed.</strong
			>
			<code>main</code> and <code>hi</code> are TRANSCRIBED — two tables copied out of the game —
			and the law from that round is <em>do not re-tune them as a set</em>. A bar rung is
			<strong>derived from <code>main</code></strong>, the way the icon set is: the transcription is
			untouched and gains a fourth job.
		</p>
		<p class="lab-note">
			⚠ <strong>It is also the answer the rejected divergence could not give.</strong> That one
			moved the whole ladder, so a darker bar bought a darker ICON, and the fill was ranked first.
			Scoping the move to bars pays nothing anywhere else — icons, glyphs, discs and the portrait
			washes all keep reading <code>main</code>. 🔎 And it is <em>one function</em>:
			<code>castFill()</code> in <code>elementColors.ts</code> is the only thing that turns an element
			into a bar, shared by the planner's E/Q pills and the Team Builder's Compare bars so the two finishes
			cannot drift.
		</p>

		<!-- ── 10a · where "balanced" actually is ──────────────────────────── -->
		<h3 class="lab-sub">The anchor: where "balanced" actually is</h3>
		<p class="lab-note">
			A bar fill answers to two things at once — the night behind it and the white on it — and those
			pull opposite ways. There is exactly one luminance where it owes each the same:
			<code>contrast(white, fill) == contrast(fill, star)</code>, which solves to
			<strong>{BALANCED_RATIO.toFixed(2)}:1 in both directions</strong>. Today's fills are nowhere
			near it — worst white-on-fill
			<strong>{extremes(EL_GENSHIN_ICON).white.toFixed(2)}:1</strong> against a fill-vs-star of
			<strong>{extremes(EL_GENSHIN_ICON).star.toFixed(2)}:1</strong>, i.e. the fill is almost as
			bright as the ink written on it.
		</p>
		<p class="lab-note">
			⚠ <strong>The anchor is a reference, NOT a target.</strong> Fully balanced is a long way down,
			and the ask was "slightly more balanced". What it buys is a dial with a
			<em>meaning</em> at both ends rather than a taste slider: <code>BAR_BALANCE</code> is "how far
			toward that point", and <code>BAR_DENSITY</code> is the separate question of how much chroma
			to spend on the way — because <strong>"deeper" is two requests wearing one word</strong>, and
			only one of them costs anything.
		</p>

		<!-- ── 10b · the numbers ───────────────────────────────────────────── -->
		<h3 class="lab-sub">What each candidate costs</h3>
		<div class="eldial eldial--quad">
			{#each BAR_CANDIDATES as c (c.key)}
				<div class="eldial-row">
					<span class="eldial-tag">{c.label}</span>
					<span class="eldial-fig">white-on-fill <b>{c.white.toFixed(2)}:1</b></span>
					<span class="eldial-fig">fill-vs-star <b>{c.star.toFixed(2)}:1</b></span>
					<span class="eldial-fig">imbalance <b>{c.spread.toFixed(2)}×</b></span>
					<span class="eldial-fig">ladder ΔL <b>{c.span.toFixed(3)}</b></span>
				</div>
			{/each}
		</div>
		<p class="lab-note">
			🔎🔎 <strong>THE SECOND COLUMN DOESN'T MOVE, AND THAT IS THE WHOLE FINDING.</strong> Worst
			fill-vs-star runs <strong>2.95 → 2.93 → 2.90</strong> across the entire dial while
			white-on-fill climbs 1.33 → 2.93. ⚠ <strong>This is not the divergence measured again</strong>
			— that one cost 2.95 → 2.49 on exactly this number, which is why it lost. The difference is mechanical:
			the divergence <em>remapped the whole ladder</em>, so the darkest fills went down too, and the
			worst case is set by the darkest fill. Pulling each element toward a
			<em>shared</em> luminance instead squeezes the ladder
			<strong>from the bright end only</strong> — cryo, geo and dendro had enormous fill-vs-star
			headroom and are the ones that move, while pyro barely budges (<code>#ff6640 → #ff653e</code>
			at balance 0.3). <strong>The priority you ranked first is not on the table this time.</strong>
		</p>
		<p class="lab-note">
			⚠ <strong>The real cost is the fourth column.</strong> Pulling toward one luminance is by
			definition a squeeze on the lightness ladder, and a palette without one is unreadable in a
			dense stacked chart — the finding that killed "just cap it" a round ago (a ceiling at L .74
			landed five of the seven on the same rung). Genshin's own span is
			<strong>ΔL {BAR_CANDIDATES[0].span.toFixed(3)}</strong>; the anchor flattens it to
			<strong>{BAR_CANDIDATES[BAR_CANDIDATES.length - 1].span.toFixed(3)}</strong>. That, and not
			the star, is what sets how far down this dial can go.
		</p>
		<p class="lab-note">
			🔎 And <strong>row B is free.</strong> Pushing every fill to the gamut edge at its own
			lightness moves both contrast figures by less than 0.01, because relative luminance is mostly
			a lightness fact — so if "deeper" turns out to mean "denser", it costs nothing that was ranked
			first. ⚠ It also does nothing to three of the seven: pyro, electro and hydro are already at
			the sRGB edge, so density alone is a <em>four</em>-element change (cryo
			<code>#7af2f2 → #01f8f9</code>, plus geo, dendro, anemo). Whether a set that moves four of
			seven still reads as one set is a judgement, not a measurement.
		</p>

		<!-- ── 10c · the specimen ──────────────────────────────────────────── -->
		<h3 class="lab-sub">On the night, at the chart's real size</h3>
		<p class="lab-note">
			14px rows, <code>--fs-xs</code> bold white, the shipped halo (the bar's own colour dropped 30
			HSL points) — reproduced from <code>RotationTimeline</code> rather than imported, so the mock
			cannot quietly diverge from the chart.
			<strong
				>The icon beside each bar stays on
				<code>main</code></strong
			>
			and does not move with the candidate: that pairing is the test. A bar rung only works if the bar
			still reads as the same element as the glyph next to it.
		</p>
		{#each BAR_CANDIDATES as c (c.key)}
			<div class="barcand" class:barcand--pick={c.key === 'pick'}>
				<div class="barcand-head">
					<span class="barcand-tag">{c.label}</span>
					<span class="barcand-fig"
						>{c.white.toFixed(2)} / {c.star.toFixed(2)} · <b>{c.spread.toFixed(2)}×</b></span
					>
				</div>
				<div class="barcand-rows">
					{#each EL7 as el (el)}
						<div class="barrow">
							<i
								class="barrow-glyph"
								style="--c:{EL_GENSHIN_ICON[el]}; --m:url('/assets/elements/flat-color/{el}.png')"
							></i>
							<span
								class="barrow-bar"
								style:background={c.set[el]}
								style:--label-halo={haloOf(c.set[el])}
								><span class="barrow-label">{BAR_SPECIMENS[el]}</span></span
							>
							<span class="barrow-hex">{c.set[el]}</span>
						</div>
					{/each}
				</div>
			</div>
		{/each}

		<!-- ── 10d · side by side, one element at a time ───────────────────── -->
		<h3 class="lab-sub">The same element down the ladder</h3>
		<p class="lab-note">
			The rows above answer "does this palette hold together"; this one answers "how far did each
			element actually move". ⚠ Watch <strong>cryo</strong> and <strong>geo</strong> — they start
			highest (<code>oklch L .892</code> and <code>.812</code>), so a balance step moves them
			furthest and they are where a set-wide dial goes wrong first.
		</p>
		<div class="barmatrix">
			<div class="barmatrix-row barmatrix-row--head">
				<span></span>
				{#each BAR_CANDIDATES as c (c.key)}<span class="barmatrix-h">{c.mark} · {c.key}</span
					>{/each}
			</div>
			{#each EL7 as el (el)}
				<div class="barmatrix-row">
					<i
						class="barrow-glyph"
						style="--c:{EL_GENSHIN_ICON[el]}; --m:url('/assets/elements/flat-color/{el}.png')"
					></i>
					{#each BAR_CANDIDATES as c (c.key)}
						<span class="barmatrix-sw" style:background={c.set[el]} title="{el} · {c.set[el]}"
						></span>
					{/each}
				</div>
			{/each}
		</div>

		<p class="lab-note">
			🎛️ <code>BAR_BALANCE</code> and <code>BAR_DENSITY</code> are two numbers at the top of this
			page's script and every figure above re-measures itself when you move them — candidate D is
			whatever they currently say. If one element misbehaves at the chosen setting, ⚠ the rule from
			the palette round applies:
			<strong>a per-element exception you can defend beats a global transform you cannot</strong>.
		</p>
	</section>

	<!-- ════════════════════════════════ 11 · THE UI STATE COLOURS ══ -->
	<section>
		<h2 class="lab-h">
			UI state colours <span class="lab-badge">shipped</span>
		</h2>
		<p class="lab-note">
			✅ <strong>SETTLED 2026-08-12 — ⚓ Nate approved all four.</strong>
			<code>--ui-danger</code> holds <code>#e63946</code> · <code>--ui-warning</code> holds
			<code>#f4a261</code> · <code>--ui-positive</code> → <code>#5be0ac</code> ·
			<strong><code>--ui-provisional</code> is NEW</strong> at <code>#f6d365</code>, zoned to
			<code>#998136</code> on <code>.ctx-light</code>. Seven consumers moved off
			<code>--ui-danger</code>, and <code>crit.ts</code>'s risk ramp was re-synced so all four of
			its stops are token values again. The board is kept because the reasoning is visible in it —
			the
			<em>now</em> column below is what shipped, the <em>next</em> column is what it replaced.
		</p>
		<p class="lab-note">
			⚓ Nate 2026-08-12: <em
				>"let's quickly talk about those, since they're close to the element colours, too"</em
			>
			— with three values Genshin uses: <code>#80DF66</code> · <code>#FFC700</code> ·
			<code>#FF5A5A</code>.
		</p>
		<p class="lab-note">
			⚠ <strong>The question is not which trio is prettier.</strong> A UI state colour has to live BESIDE
			the element palette without being mistaken for it, and it has to hold three different grounds. Every
			row below is measured on both axes, and the two answers point opposite ways — which is the whole
			result.
		</p>

		<!-- ── 11a · what we actually have ─────────────────────────────────── -->
		<h3 class="lab-sub">First: we have FIVE values, not three</h3>
		<p class="lab-note">
			The tokens were taken <em>from</em> the crit visualizer's risk ramp (⚓ Nate's pick), so the
			chart is the parent and not a copy that drifted. But
			<strong>the ramp has four stops and only two became tokens</strong>, and one of the other two
			has since gone stale:
		</p>
		<div class="uistray">
			{#each UI_STRAYS as s (s.hex)}
				<div class="uistray-row">
					<span class="uisw" style:background={s.hex}></span>
					<code>{s.hex}</code>
					<span class="uistray-note">{s.note}</span>
				</div>
			{/each}
		</div>
		<p class="lab-note">
			🐛 <code>#4ecca3</code> is the finding worth acting on. <code>--ui-positive</code> was pushed
			to <code>#51c89a</code> to escape the OLD anemo; the chart never followed, so
			<strong>the family that was meant to be one value is now two</strong> —
			<code>#4ecca3</code> still lives in <code>crit.ts</code>'s <code>RISK_STOPS</code> and in
			<code>ArtifactInstrument</code>'s better/same/worse odds.
		</p>

		<!-- ── 11b · the two measurements ──────────────────────────────────── -->
		<h3 class="lab-sub">Ours vs Genshin's — and they win opposite arguments</h3>
		<div class="uigrid">
			<div class="uigrid-row uigrid-row--head">
				<span></span><span>swatch</span><span>nearest element</span><span>nearest bar</span>
				{#each UI_GROUNDS as g (g.k)}<span>vs {g.label}</span>{/each}
			</div>
			{#each UI_ROWS as row (row.key)}
				{#each [{ tag: `ours · ${row.token}`, hex: row.now, mine: false }, { tag: 'Genshin', hex: row.gen, mine: false }, { tag: 'ours, at their L', hex: UI_LIFTED[row.key], mine: true }] as cand (cand.tag)}
					{@const n = nearestEl(cand.hex)}
					<div class="uigrid-row" class:uigrid-row--mine={cand.mine}>
						<span class="uigrid-tag">{row.label} · {cand.tag}</span>
						<span class="uisw uisw--wide" style:background={cand.hex}></span>
						<span class="uifig" class:uifig--bad={n.main.d < 0.05}
							>{n.main.el} <b>{n.main.d.toFixed(3)}</b></span
						>
						<span class="uifig" class:uifig--bad={n.bar.d < 0.05}
							>{n.bar.el} <b>{n.bar.d.toFixed(3)}</b></span
						>
						{#each UI_GROUNDS as g (g.k)}
							<span class="uifig" class:uifig--bad={ratio(cand.hex, g.g) < 3}
								><b>{r2(cand.hex, g.g)}</b></span
							>
						{/each}
					</div>
				{/each}
			{/each}
		</div>
		<p class="lab-note">
			🔎 <strong>Genshin's are brighter; ours are better separated.</strong> Their trio wins every
			contrast column — their red is 2.80 against a star where ours is 2.06 — and loses the
			separation column on two of three: their red sits <strong>ΔE .040 from pyro</strong> where
			ours sits .099, and their green <strong>.045 from dendro</strong>. ⚠ At ~.05 two colours stop
			reading as two. <strong>Genshin can afford that and we cannot:</strong> in their UI, element colour
			is icons and inline text tags while state colour is buttons and numeric deltas — the two never share
			a reading. Ours share a chart.
		</p>

		<!-- ── 11c · in context ────────────────────────────────────────────── -->
		<h3 class="lab-sub">In context — ink, chip and button, on each ground</h3>
		<p class="lab-note">
			⚓ Nate asked to see them used. <strong
				>Three forms, because a state colour is asked to do three different things and they fail
				differently.</strong
			>
			As INK it needs 4.5:1 against the ground. As a soft CHIP the ink is the colour sitting on 18% of
			itself, which is a
			<em>much</em>
			easier problem and hides a weak value. As a solid BUTTON the colour becomes the ground and something
			else has to be the ink — so a pale value stops being legible as a surface and a dark one stops taking
			white. ⚠ Judge the middle column last; it flatters everything.
		</p>
		<div class="uictx">
			{#each UI_FORMS_GROUNDS as g (g.k)}
				<div class="uictx-panel {g.cls}" class:uictx-panel--bare={!g.bg} style:background={g.bg}>
					<div class="uictx-head">{g.label}</div>
					{#each UI_ROLES as role (role.key)}
						{@const nxt = g.k === 'paper' && role.nextLight ? role.nextLight : role.next}
						<div class="uictx-role">{role.label}</div>
						{#each [{ tag: 'was', c: role.now }, { tag: 'now', c: nxt }] as v (v.tag)}
							<div class="uictx-row">
								<span class="uictx-vtag">{v.tag}</span>
								<span class="uictx-ink" style:color={v.c}>Not curated</span>
								<span
									class="uictx-chip"
									style:color={v.c}
									style:background="color-mix(in srgb, {v.c} 18%, transparent)">Not curated</span
								>
								<button
									class="uictx-btn"
									type="button"
									style:background={v.c}
									style:color={onFill(v.c)}>Not curated</button
								>
								<span class="uictx-r">{r2(v.c, g.bg ?? STAR)}:1</span>
							</div>
						{/each}
					{/each}
				</div>
			{/each}
		</div>
		<p class="lab-note">
			⚠ The ratio at the end of each row is the INK case — the colour against that panel's ground,
			or against a star for the bare one. ⚠ On the paper panel the <em>now</em> provisional row is
			the LIGHT rung (<code>{UI_PROVISIONAL_LIGHT}</code>), not <code>{UI_PROVISIONAL}</code>; see
			below for why it has two. ⚠ The <em>was</em> rows are what each value replaced — for
			provisional that is <code>--ui-danger</code>, because that is what was drawing the ∅.
		</p>

		<!-- ── 11d · the recommendation ────────────────────────────────────── -->
		<h3 class="lab-sub">My suggestion — per token, not a set swap</h3>
		<p class="lab-note">
			⚠ <strong>The right move is the one this system has already made twice</strong> — keep our
			HUES (they are the ones holding the separation) and spend LIGHTNESS. That is literally what
			the <code>--ui-positive</code> note in <code>app.css</code> advises, and what
			<code>--rx-quicken</code> did when the new anemo closed on it. But it does not apply evenly, so
			the answer is three answers:
		</p>
		<p class="lab-note">
			↻ <strong><code>--ui-warning</code> HOLDS at <code>#f4a261</code></strong> — ⚠ and this
			REVERSES what this board said in its first draft. With three values the lift to
			<code>{UI_LIFTED.warning}</code> was a pure win (4.16 → 5.44 on a star <em>and</em> geo
			separation .070 → .106). <strong>The fourth value changes warning's job.</strong> Once a
			yellow joins the family, warning's darker, more saturated orange is what makes the
			orange/yellow pair read as two: <code>#f4a261</code> sits ΔE <strong>.122</strong> from
			<code>#f6d365</code> where the lifted version sits <strong>.083</strong> — a third of the headroom
			gone, and both become pale warm tones. 4.16 was never a problem; the lift was solving for comfort,
			and the pair needs the separation more.
		</p>
		<p class="lab-note">
			✅ <strong><code>--ui-positive</code> → {UI_LIFTED.positive}</strong> — it fixes a collision
			that <em>today's bar rung made worse</em>. Shipped positive sits ΔE
			<strong>.026 from <code>--el-anemo-bar</code></strong>, well inside the "not two colours" line
			and the adjacency that actually happens — a green "saved" state beside an anemo bar. The lift
			takes it to .072 and buys 4.11 → 5.18 on the star.
		</p>
		<p class="lab-note">
			⛔ <strong><code>--ui-danger</code> stays at <code>#e63946</code></strong> — boxed in for
			three independent reasons, which is why I would not touch it. <strong>(1)</strong> Lifting it
			<em>halves</em>
			the pyro separation, .099 → .050, because <strong>pyro IS a light red</strong> — there is
			nowhere brighter for a red to go here. <strong>(2)</strong> It is the only one of the three
			that works on PAPER (<strong>3.33:1</strong> on parchment-100, against warning's 1.65 and
			positive's 1.66), and that is not hypothetical: the uncurated ∅ on a character card is
			<code>--ui-danger</code>
			on parchment. Genshin's red manages 2.44 there — no light UI, again.
			<strong>(3)</strong> Its weak-looking 2.06 vs a star is measured against a ground it never sits
			on; every consumer is ink on a card or a panel.
		</p>

		<!-- ── 11d · the ramp ──────────────────────────────────────────────── -->
		<!-- ── 11e · the fourth value ──────────────────────────────────────── -->
		<h3 class="lab-sub">Should there be a fourth? — yes, and it is already being drawn</h3>
		<p class="lab-note">
			⚓ Nate: <em
				>"an orange for warning, and a yellow, like the <code>#f6d365</code>, freed up for another
				use?"</em
			>
			<strong
				>Yes — and the fourth value is not an invention. It is a SPLIT of what
				<code>--ui-danger</code> is already doing.</strong
			>
			The census, counted by hand:
			<code>--ui-danger</code> <strong>13 sites</strong> · <code>--ui-warning</code> 1 (the notation
			editor's unknown-token squiggle) · <code>--ui-positive</code> 1 (the switch's checked track). And
			the thirteen split cleanly in two:
		</p>
		<div class="uicensus">
			{#each UI_DANGER_CENSUS as grp (grp.job)}
				<div class="uicensus-grp" class:uicensus-grp--move={!grp.red}>
					<div class="uicensus-job">
						<span class="uisw" style:background={grp.red ? '#e63946' : UI_PROVISIONAL}></span>
						{grp.job}
					</div>
					{#each grp.sites as s (s)}<div class="uicensus-site">{s}</div>{/each}
				</div>
			{/each}
		</div>
		<p class="lab-note">
			🔎 <strong>Read the comments at those sites and none of them argues that RED is right.</strong
			>
			They argue about which FAMILY — "<code>--ui-danger</code>, not a domain color, a data-quality
			consequence" appears verbatim on both name-marks — because state-vs-domain was the question
			the dire-retirement round was answering. Red was simply the only rung available that wasn't
			orange (which reads "you did something") or green. One of them gives the game away in its own
			text: <code>.rp-active-text--danger</code> calls itself
			<em>"warning-tinted text"</em> and then reaches for danger.
		</p>
		<p class="lab-note">
			⚠ <strong>And it is a tone bug at scale, not just a taxonomy one.</strong> "We haven't curated
			frames for this character yet" is not an error, not destructive, and not the user's fault —
			there is nothing to click. Drawn in red on 122 cards at once it reads as
			<em>something is wrong with this character</em>. Yellow says "proceed, this isn't fully
			known", which is the actual claim. 📌 The name I'd use is
			<strong><code>--ui-provisional</code></strong> — it covers approximate timing and uncurated
			and unknown-coverage in one word, where <code>--ui-unknown</code> would be wrong for timing we do
			know approximately.
		</p>
		<p class="lab-note">
			⚠ <strong>IT NEEDS TWO RUNGS, and the light one is forced rather than chosen.</strong> One
			consumer is on PAPER — the ∅ on a character card — and <code>{UI_PROVISIONAL}</code> is 1.16:1
			there. Zoning is the existing pattern (<code>--accent</code> is gold-400 dark / gold-700
			light), so <code>.ctx-light</code> takes <strong><code>{UI_PROVISIONAL_LIGHT}</code></strong>
			at 3.02:1. ⛔
			<strong>It sits at the GRAPHICAL floor, not the text floor, and it cannot go further:</strong>
			walking it to 4.5:1 lands on <code>#786529</code>, which is ΔE
			<strong>.030 from <code>--gold-700</code></strong> — it IS the light accent, and gold on paper already
			means "a gap you can click". So provisional may be a MARK on paper and must never be prose ink there.
			That constraint is the one thing to write into the token if it ships.
		</p>

		<!-- ── 11f · the ramp ──────────────────────────────────────────────── -->
		<h3 class="lab-sub">The crit visualizer's Hits / Rotation ramp</h3>
		<p class="lab-note">
			⚓ Nate asked whether those are our current values. <strong>Two of four exactly</strong> —
			<code>#e63946</code> is <code>--ui-danger</code> and <code>#f4a261</code> is
			<code>--ui-warning</code>. <code>#f6d365</code> has no token at all, and
			<code>#4ecca3</code> is the pre-nudge positive. Drawn at the slider's own size:
		</p>
		<div class="uiramps">
			{#each [{ k: 'ours — shipped, 4 stops', s: RAMP_NOW }, { k: 'Genshin’s three', s: RAMP_GENSHIN }, { k: 'the suggestion — all four are tokens', s: RAMP_LIFTED }] as g (g.k)}
				<div class="uiramp-row">
					<span class="uiramp-tag">{g.k}</span>
					<span class="uiramp" style:background={ramp(g.s)}></span>
					<span class="uiramp-hex">{g.s.join(' ')}</span>
				</div>
			{/each}
		</div>
		<p class="lab-note">
			🔎 <strong
				>Genshin's makes a visibly different object, and the stop COUNT does more of that than the
				hues.</strong
			>
			Three stops put the midpoint at pure yellow, so it reads red → yellow → green in three clean bands.
			Ours has four, and the extra <code>#f6d365</code> between orange and teal is what gives it its
			long warm shoulder — the thing that makes it read as a <em>risk</em> gradient rather than a
			traffic light. ⚠ If the tokens ever move,
			<strong>the ramp is a separate decision</strong>: § Laws says a UI state colour must not
			appear inside a visualization, and the only reason these coincide is that the chart got there
			first.
		</p>
		<p class="lab-note">
			🔎 <strong>And notice what the third row is.</strong> With <code>#f6d365</code> promoted to
			<code>--ui-provisional</code>, every one of the four stops is a token —
			<strong>the chart that fathered this family would finally be spelled entirely in it</strong>,
			which is the best evidence that four is the right count and not three. The only value still
			differing would be <code>#4ecca3</code> → <code>{UI_LIFTED.positive}</code>, which is the
			drift 11a opened with.
		</p>
	</section>
</div>

<style>
	/* The board sits in the (scene) group with the site chrome suppressed (/lab
	   is in TOOL_PATHS), so it owns the whole viewport. Generous padding: the
	   specimens have to be judged with sky around them, not edge to edge. */
	/* ⚠ THE PAGE OWNS ITS OWN SCROLLER. (scene)'s .content is `position: fixed;
	   inset: 0` — the scene has to stay pinned behind whatever is on top of it —
	   so a page inside it that does not scroll itself simply loses everything
	   below the fold with no scrollbar to tell you. (The tools get this from
	   .tool-shell; this page is not in that group.) */
	.lab {
		position: relative;
		z-index: 1;
		height: 100%;
		overflow-y: auto;
		padding: 2rem max(2rem, calc((100% - 1560px) / 2)) 6rem;
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}

	.lab-head h1 {
		margin: 0 0 0.3rem;
		font-family: var(--font-display);
		font-size: var(--fs-4xl);
		color: var(--chrome);
	}
	/* On the world, prose takes the BRIGHT ink — there is no panel here to set a
	   dim rung, and --muted does not clear 4.5:1 against a star even at the
	   deeper wash. See TOOL_DIM. */
	.lab-head p,
	.lab-note {
		margin: 0;
		max-width: 90ch;
		font-size: var(--fs-md);
		line-height: var(--lh-relaxed);
		color: var(--text);
	}
	.lab-note {
		margin-bottom: 1rem;
	}

	/* ── 0 · the side portrait ── */
	/* ── the bench card board ── */
	.bc-forms {
		display: flex;
		flex-wrap: wrap;
		gap: 3rem;
		align-items: flex-start;
	}
	.bc-form {
		margin: 0;
		min-width: 0;
	}
	/* The ribbon's real side chrome: the bare edge, the frame, the pad. */
	.bc-strip {
		position: relative;
		box-sizing: content-box;
		width: var(--bc-w);
		padding: 28px calc(var(--bc-edge) + var(--bc-frame) + var(--bc-pad)) 16px;
		background: var(--surface);
		border-radius: var(--r-md);
	}
	.bc-strip::before {
		content: '';
		position: absolute;
		inset: var(--bc-edge);
		border: var(--bc-frame) solid var(--inset-line);
		border-radius: calc(var(--r-md) - 2px);
		pointer-events: none;
	}
	.bc-slot {
		display: flex;
		flex-direction: column;
	}
	/* The phone: a viewport-wide box with the tool gutter, the bench row, and
	   a stand-in for band A beneath it. */
	.bc-phone {
		box-sizing: border-box;
		max-width: 100%;
		padding: 24px 16px 16px;
		outline: 1px dashed var(--line);
		border-radius: var(--r-md);
	}
	.bc-row {
		display: flex;
		gap: var(--bc-gap);
		padding: var(--bc-chrome);
		background: var(--surface);
		border-radius: var(--r-md);
	}
	.bc-row--spread {
		justify-content: space-between;
	}
	.bc-row--reserve {
		padding-top: calc(var(--bc-chrome) + var(--bc-over));
	}
	.bc-cell {
		flex: none;
		display: flex;
		flex-direction: column;
	}
	.bc-band {
		margin-top: 8px;
		padding: 6px 10px;
		font-size: var(--fs-sm);
		color: var(--muted);
		border-radius: var(--r-sm);
	}
	/* A stand-in for BenchBand's .bb-act (scoped there): the raised square. */
	.bc-swap {
		flex: none;
		width: 26px;
		height: 26px;
		display: grid;
		place-items: center;
		padding: 0;
		border: none;
		border-radius: var(--r-sm);
		background: var(--surface-raised);
		color: var(--sp-unset-ink, var(--muted));
		cursor: pointer;
	}
	.bc-swap:hover:not(:disabled) {
		background: color-mix(in srgb, white 7%, var(--surface-raised));
		color: var(--text);
	}
	.bc-swap:disabled {
		visibility: hidden;
	}
	.sp-knobs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 1.4rem;
		align-items: center;
		margin-bottom: 1rem;
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.sp-knobs label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.sp-row {
		display: flex;
		align-items: flex-end;
		gap: 1.25rem;
		flex-wrap: wrap;
	}
	.sp-row--pair {
		gap: 4rem;
		margin: 0.5rem 0 1.5rem;
	}
	.sp-note {
		margin: 1.25rem 0 0.5rem;
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.sp-sheet {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: 1rem 0.5rem;
	}
	.sp-cell {
		margin: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
	}
	.sp-cell figcaption {
		font-size: var(--fs-xs);
		color: var(--text);
		text-align: center;
	}
	.lab-h {
		margin: 0 0 0.5rem;
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		color: var(--chrome);
	}

	.lab-badge {
		padding: 0.1rem 0.45rem;
		border-radius: var(--r-round);
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
		color: var(--accent);
		font-family: var(--font-body);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		vertical-align: middle;
	}

	.lab-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		align-items: start;
	}
	.lab-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1.2rem;
		align-items: flex-start;
	}
	.lab-stack {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		max-width: 780px;
	}

	/* ── the ground specimens ──────────────────────────────────────────────
	   Identical box in all four; only the context class differs. The bare one
	   paints nothing at all, which is the whole claim of ctx-night. */
	.spec {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 1.1rem 1.2rem;
		border-radius: var(--r-sm);
		background: var(--surface);
		color: var(--text);
	}
	.spec--bare {
		background: none;
	}
	/* ↻ 2026-08-11: the glass specimen has no rule of its own any more. It held
	   exactly the blur, and with that retired the panel is just .spec — whose
	   `background: var(--surface)` resolves to --glass-panel under .ctx-glass,
	   which is the whole of what the material now is. */

	.spec-tag {
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
	/* ⚠ Bare night uses --text for the tag too: --muted is 4.16:1 out here. */
	.spec--bare .spec-tag,
	.spec--bare .spec-label,
	.spec--bare .spec-note {
		color: var(--text);
	}

	.spec-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: var(--text);
	}

	/* ── the ink ladder ───────────────────────────────────────────────────
	   Sample on the left, size tag right-aligned. The tag is deliberately the
	   quietest thing in the panel — it is an annotation on the specimen, not a
	   member of it, and it must not compete with the rung it is labelling. */
	.ty-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.8rem;
		min-width: 0;
	}
	.ty-tag {
		flex: none;
		font-family: var(--font-mono);
		font-size: var(--fs-2xs);
		color: var(--muted);
		opacity: 0.65;
	}
	.spec--bare .ty-tag {
		color: var(--text);
	}
	/* ⚠ THESE RUNGS ARE PINNED BY HAND, and /lab is excluded from the mechanical
	   size-shift for exactly that reason: the ladder here has to SHOW the scale,
	   not ride it. If a sweep moved these too, the board would always agree with
	   itself and never reveal a rung that had gone missing. Keep the tags and
	   the tokens in step by hand — that is the job. */
	.ty-h1 {
		font-family: var(--font-display);
		font-size: var(--fs-4xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: var(--text);
	}
	.ty-h2 {
		font-family: var(--font-display);
		font-size: var(--fs-3xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: var(--text);
	}
	.ty-h3 {
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
	.ty-body {
		font-size: var(--fs-xl);
		color: var(--text);
	}
	.ty-dense {
		font-size: var(--fs-lg);
		color: var(--text);
	}
	/* ⚠ THE LABEL VOICE IS WHERE THE CONTEXTS DISAGREE. --muted is the DIM rung
	   on dark and the ANCHORING rung on paper, so this one row inverts while
	   every other row holds — which is the clearest single demonstration of the
	   ink ladder flipping, and the reason the ladder is rendered per ground
	   rather than once. */
	.ty-label {
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
	.ty-caption {
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.spec--bare .ty-label,
	.spec--bare .ty-caption {
		color: var(--text);
	}

	/* ── the size-up comparison ───────────────────────────────────────────── */
	.sizeup {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		width: 330px;
		padding: 1rem 1.1rem;
		border-radius: var(--r-sm);
		background: var(--surface);
	}
	.su-h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-3xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: var(--text);
	}
	.su-body {
		margin: 0;
		font-size: var(--fs-xl);
		line-height: var(--lh-relaxed);
		color: var(--text);
	}
	.su-body b {
		color: var(--accent);
	}
	.su-row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-size: var(--fs-md);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}

	.su-table {
		display: grid;
		gap: 3px;
		align-content: start;
		font-family: var(--font-mono);
	}
	.su-trow {
		display: grid;
		grid-template-columns: 12rem 5rem 1.4rem 5rem;
		align-items: center;
		gap: 0.4rem;
		padding: 0.25rem 0.5rem;
		border-radius: var(--r-sm);
	}
	.su-trow.is-moved {
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}
	.su-role {
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.su-arrow,
	.su-next {
		color: var(--accent);
		opacity: 1;
	}
	.spec-prose {
		margin: 0;
		font-size: var(--fs-md);
		line-height: var(--lh-relaxed);
		color: var(--text);
	}
	.spec-prose--wide {
		max-width: none;
	}
	.spec-prose a {
		color: var(--accent);
	}
	.spec-prose b {
		color: var(--accent);
		font-weight: var(--fw-semibold);
	}
	.spec-row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-size: var(--fs-sm);
	}
	.spec-label {
		color: var(--muted);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}
	.spec-value {
		color: var(--text);
		font-weight: var(--fw-semibold);
	}
	.spec-rule {
		height: 2px;
		margin: 0;
		border: none;
		background: var(--frame-line);
	}
	.spec-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.spec-inset {
		display: grid;
		place-items: center;
		height: 54px;
		border-radius: var(--r-sm);
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		color: var(--muted);
		--frame-inset: 5px;
	}
	.spec--bare .spec-inset {
		color: var(--text);
	}
	/* The four line stops as a run, so the STEP between them is judgeable —
	   a single line tells you nothing about whether the ladder is spaced. */
	.spec-lines {
		display: grid;
		gap: 3px;
	}
	.spec-line {
		height: 2px;
	}
	.spec-note {
		font-size: var(--fs-xs);
		line-height: var(--lh-normal);
		color: var(--muted);
	}

	/* ── candidates: the night paints ─────────────────────────────────────
	   Local styling, deliberately — these have no home in app.css yet. When one
	   is adopted it moves there and this block shrinks. */
	/* ✅ ADOPTED 2026-08-11 — .night-ribbon and its --danger variant live in
	   app.css now (the Atlas drill's row headers are the first consumer), so the
	   local copies that used to sit here are gone and this board renders the REAL
	   class. That is the board's own law: a proposal is drawn locally only until
	   it has a home. */
	.night-fade {
		display: grid;
		place-items: end center;
		height: 110px;
		padding-bottom: 0.6rem;
		border-radius: var(--r-sm);
		background: linear-gradient(to bottom, transparent, rgb(16 16 19 / 0.85));
		color: var(--text);
		font-size: var(--fs-sm);
	}

	/* ── candidates: glass hover ──────────────────────────────────────────── */
	.cand {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.cand-tag {
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--text);
	}
	.glasspane {
		display: grid;
		place-items: center;
		width: 190px;
		height: 62px;
		border-radius: var(--r-sm);
		background: var(--surface);
		color: var(--muted);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}
	/* The retired wash, kept as the control — a layer over the pane, never a
	   color-mix fed by a color-mix. */
	.glasspane.is-wash {
		background: linear-gradient(var(--fill-hover), var(--fill-hover)), var(--surface);
	}
	/* The shipped hover: the MATERIAL thickens. Reads --surface-hover so this
	   specimen tracks the real token rather than restating its value. */
	.glasspane.is-dense {
		background: var(--surface-hover);
	}
	/* Selected: the SAME density as hover, and a gold ring instead of an ink one.
	   Density separates resting from engaged; hue separates the two engaged
	   states (⚓ Nate). */
	.glasspane.is-sel {
		background: var(--surface-hover);
		box-shadow: inset 0 0 0 1px var(--sel-ring);
		color: var(--text);
	}

	/* ── candidate: borders in gold ───────────────────────────────────────
	   Each cell re-declares --frame-line / --frame-line-quiet inline and then
	   renders the SHIPPED .inset--plain and a plain rule, so the specimen is the
	   real idiom wearing a candidate value — not a drawing of one. */
	.border-grid {
		display: grid;
		gap: 6px;
		max-width: 1000px;
	}
	.border-head,
	.border-row {
		display: grid;
		grid-template-columns: 12rem 1fr 1fr;
		align-items: center;
		gap: 10px;
	}
	.border-name {
		color: var(--text);
	}
	.border-cell {
		display: grid;
		gap: 7px;
		padding: 0.7rem 0.8rem;
		border-radius: var(--r-sm);
		background: var(--surface);
	}
	.border-inset {
		display: grid;
		place-items: center;
		height: 46px;
		border-radius: var(--r-sm);
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		color: var(--muted);
		--frame-inset: 4px;
	}
	.border-rule {
		height: 2px;
		margin: 0;
		border: none;
		background: var(--frame-line);
	}
	.border-rule--quiet {
		background: var(--frame-line-quiet);
	}

	/* ── gold in text (proposal) ──────────────────────────────────────────── */
	.goldspec {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		width: 340px;
		padding: 1rem 1.1rem;
		border-radius: var(--r-sm);
		background: var(--surface);
	}
	/* The whole proposal, in one declaration: the KICKER goes gold. Nothing else
	   moves — the title stays the context's brightest ink, the prose stays body
	   ink, and the emphasis stays where it is until the --el-* round settles it. */
	.goldspec--next :global(.kicker) {
		color: var(--accent);
	}
	/* ⚠ ...and its rule with it. The kicker's ::after is a mix of --muted; left
	   alone it would read as a grey tail on a gold label, which is precisely the
	   kind of half-applied idiom the board exists to expose before it ships. */
	.goldspec--next :global(.kicker::after) {
		background: color-mix(in srgb, var(--accent) 30%, transparent);
	}

	/* ── the two parchments ───────────────────────────────────────────────── */
	.paper-broad {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		width: 420px;
		padding: 1.1rem 1.2rem;
		border-radius: var(--r-sm);
		background: var(--surface-broad);
	}
	.paper-object {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.9rem 1rem;
		border-radius: var(--r-sm);
		background: var(--surface);
	}
	.paper-object--alone {
		width: 320px;
	}
	.paper-tag {
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		color: var(--muted);
	}

	/* ── candidate: the split Atlas card ──────────────────────────────────── */
	.atlas {
		display: grid;
		grid-template-columns: 150px 1fr;
		width: 480px;
		min-height: 132px;
		border-radius: var(--r-sm);
		overflow: hidden;
	}
	.atlas--glass {
		background: var(--surface);
	}
	.atlas-id {
		display: grid;
		place-items: center;
		background: var(--surface);
	}
	.atlas--glass .atlas-id {
		background: none;
	}
	/* ⚠ THE GLYPH IS CLIPPED TO THE DARK HALF, and that is not a detail: the real
	   role artwork is near-black, drawn to read as a deeper pool IN dark slate.
	   Cross it onto parchment and it inverts wrongly. A stand-in glyph here. */
	.atlas-glyph {
		font-size: 64px;
		line-height: 1;
		color: rgb(0 0 0 / 0.35);
	}
	.atlas-body {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.3rem;
		padding: 1rem 1.2rem;
		background: var(--surface);
	}
	.atlas--glass .atlas-body {
		background: none;
	}

	/* ── the bench strip (proposal) ───────────────────────────────────────────
	   A FRAGMENT of the real ribbon at true scale: the strip's own geometry
	   (RIBBON_* in $lib/benchBand.svelte.ts — card 160 inside 16 of chrome per
	   side, the two-stroke double frame, the 1.5px shelf line) carrying one slot
	   card's three bands. Drawn locally because SlotPortrait's styles are scoped
	   to it and there is no way to render the real card here without the store,
	   the roster and a host registration — so this is a proposal board, and it
	   is labelled as one.
	   ⚠ KEEP THE NUMBERS IN STEP BY HAND if the strip's constants move. They are
	   duplicated here on purpose: the point of the board is to show a candidate
	   the components do NOT have yet, which is exactly what importing the real
	   values would prevent. */
	.lab-row--bench {
		gap: 1.6rem;
	}
	.benchstrip {
		position: relative;
		box-sizing: border-box;
		width: 192px; /* card 160 + 16 chrome per side */
		padding: 16px;
		border-radius: 3px;
	}
	/* The double frame: two strokes on ONE box at ONE inset, differing only in
	   corner radius, so the straight runs coincide and only the corners split. */
	.bx-frame {
		position: absolute;
		inset: 5px;
		border: 2px solid var(--frame-line-quiet);
		pointer-events: none;
	}
	.bx-frame--tight {
		border-radius: 3px;
	}
	.bx-frame--wide {
		border-radius: 30px;
	}
	.bx-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 8px 10px 10px 8px;
	}
	.bx-id {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
	}
	/* The element glyph at its NEW size — 18px, the name's 1.25×. A flat disc
	   stands in for the generated element art; what is being judged here is the
	   glyph's WEIGHT against the name beside it, not its drawing. */
	.bx-el {
		flex: none;
		width: 18px;
		height: 18px;
		border-radius: var(--r-round);
		background: var(--el-hydro-main, var(--neutral));
	}
	.bx-name {
		margin-right: auto;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: var(--text);
	}
	.bx-portrait {
		width: 68px;
		height: 68px;
		align-self: center;
		border-radius: var(--r-round);
		border: 1.5px solid color-mix(in srgb, var(--el-hydro-main, var(--neutral)) 85%, transparent);
		background: var(--surface-well);
	}
	.bx-base {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 4px;
	}
	/* The four stations — con chip, ⇄, the pill, ✕ — all wearing the variant's
	   fill and border, which is the whole comparison. */
	.bx-ctl,
	.bx-pill {
		box-sizing: border-box;
		height: 26px;
		background: var(--bx-fill);
		border: var(--bx-border);
		border-radius: var(--r-round);
		color: color-mix(in srgb, white 40%, var(--frame-bg));
	}
	.bx-ctl {
		flex: none;
		width: 26px;
		display: grid;
		place-items: center;
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		line-height: var(--lh-none);
	}
	.bx-ctl--chip {
		text-indent: -0.07em;
		color: color-mix(in srgb, var(--el-hydro-main, var(--neutral)) 75%, white);
	}
	.bx-pill {
		display: flex;
		align-items: center;
		gap: 1px;
	}
	.bx-zone {
		width: 24px;
		height: 100%;
		display: grid;
		place-items: center;
	}
	/* Stand-ins for the artifact / weapon art, at the wash's resting alpha. */
	.bx-zone:not(.bx-zone--ref)::after {
		content: '';
		width: 15px;
		height: 15px;
		border-radius: 2px;
		background: color-mix(in srgb, white 34%, var(--frame-bg));
	}
	.bx-zone--ref {
		width: auto;
		min-width: 24px;
		padding: 0 5px;
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-mid);
		line-height: var(--lh-none);
		color: color-mix(in srgb, var(--el-hydro-main, var(--neutral)) 75%, white);
	}
	/* The shelf line between cards, running past the card into the frame. */
	.bx-divider {
		height: 1.5px;
		margin: 0 -9px;
		background: var(--frame-line-quiet);
	}
	/* A real band, at the real band height, for the shade comparison. */
	.benchband {
		display: grid;
		place-items: center;
		width: 190px;
		height: 36px;
		border-radius: 1px;
		background: var(--surface);
		color: var(--muted);
		font-size: var(--fs-md);
	}
	.benchband--well {
		background: var(--surface-well);
	}

	/* ── the Atlas card, as a block (proposal) ────────────────────────────────
	   Both specimens are drawn at the size the real grid computes, so the
	   comparison is of PROPORTION and not of scale:
	     now      656 × 210  (1328px column, 2 cols, 16px gap, min-height 210)
	     proposed 465 × 388  (950px cap,     2 cols, 20px gap, aspect-ratio 6/5)
	   ⚠ Hand-pinned, like everything else on this board. If the real card adopts
	   these, the numbers move to AtlasView and this section renders the record. */
	.lab-row--atlas {
		gap: 1.6rem;
		align-items: flex-start;
	}

	/* ── what it is now: one left-ranged column in a 3:1 box ──
	   The failure is visible in the specimen: every row is a ~200px thing on a
	   608px line, so the content occupies a third of its own card and the rest is
	   a long empty runway. That is the "fat banner" read — not the height, the
	   MEASURE. */
	.atlasnow {
		position: relative;
		overflow: hidden;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		width: 656px;
		height: 210px;
		padding: 1.4rem 1.5rem 1.2rem;
		border-radius: var(--r-sm);
		background: var(--surface);
	}
	.an-art {
		position: absolute;
		right: -6%;
		bottom: -20%;
		width: 46%;
		height: 120%;
		border-radius: var(--r-round);
		background: rgb(0 0 0 / 0.16);
	}
	.atlasnow > *,
	.atlasblock :not(.ab-art) {
		position: relative;
		z-index: 1;
	}
	.an-glyphs,
	.ab-glyphs {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
	.an-glyphs span,
	.ab-glyphs span {
		width: 42px;
		height: 42px;
		border-radius: var(--r-sm);
		background: color-mix(in srgb, var(--el-hydro-main) 55%, transparent);
	}
	.an-glyphs b,
	.ab-glyphs b {
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}
	.an-label {
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--text);
	}
	.an-counts {
		font-size: var(--fs-md);
		color: var(--muted);
	}
	.an-counts b {
		color: var(--text);
	}
	.an-owned {
		color: var(--accent);
	}
	.an-pips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: auto;
	}
	.an-pip,
	.ab-pip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}
	.an-pip i,
	.ab-pip i {
		width: 18px;
		height: 18px;
		border-radius: var(--r-round);
	}

	/* ── the proposal: a split block ──
	   ⚠ THE SEAM IS HORIZONTAL, WHICH REVERSES THE /lab PROTOTYPE ABOVE. That one
	   splits left/right, and it was right for what it was drawn on — a 480 × 132
	   banner, where a top/bottom seam would leave two letterbox slots. Rotate the
	   card to a block and the same split starves the identity half: "SURVIVABILITY"
	   sets ~169px at --fs-2xl, and a 38%-wide dark column leaves ~144px of measure,
	   so the longest label wraps on the one card that can least afford it. A
	   horizontal seam gives the label the card's full width and reads as Genshin's
	   own structure — a titled plate over a content area. */
	.atlasblock {
		display: grid;
		/* 37 / 63. The dark half is sized by its content (48 glyph + label + pad);
		   the light half takes the rest, and the rest is what the art wants. */
		grid-template-rows: 145px 1fr;
		width: 465px;
		height: 388px;
		border-radius: var(--r-sm);
		/* The halves are opaque and translucent respectively, so the CARD must
		   clip them — there is no ground behind the seam to hide a mismatch. */
		overflow: hidden;
	}
	.ab-id {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.5rem;
		padding: 0 1.3rem;
		background: var(--surface);
	}
	.ab-label {
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--text);
	}
	.ab-body {
		position: relative;
		overflow: hidden;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		padding: 1.1rem 1.3rem 1.2rem;
		background: var(--surface-broad);
	}
	/* ⚓ NATE'S ASSET GOES HERE — anchored bottom-right and BLEEDING off both
	   edges, which is the grammar the card already uses for its monotone role
	   backdrop. Text ranges from the top-left, so the two never fight: the
	   readout owns the top edge, the pips the bottom-LEFT, the art the
	   bottom-right corner and everything behind it. */
	.ab-art {
		position: absolute;
		right: -8%;
		bottom: -14%;
		display: grid;
		place-items: center;
		width: 62%;
		height: 78%;
		border-radius: var(--r-round);
		background: color-mix(in srgb, var(--ink-700) 12%, transparent);
		font-size: var(--fs-sm);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: color-mix(in srgb, var(--ink-700) 45%, transparent);
	}
	/* THE NUMBERS BECOME A READOUT. On the current card they are one --fs-md
	   line — "48 provides · 12 owned" — which states the card's whole point in
	   its quietest voice. A block card has the room to promote them, and OWNED is
	   the figure the user came for: it is the only personal fact on the surface. */
	.ab-readout {
		display: flex;
		gap: 1.4rem;
	}
	.ab-fig {
		display: flex;
		flex-direction: column;
		line-height: var(--lh-tight);
	}
	.ab-fig b {
		font-size: var(--fs-5xl);
		font-weight: var(--fw-bold);
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}
	.ab-fig small {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
	.ab-fig--owned b {
		color: var(--accent);
	}
	/* Two rows of four-ish, ranged bottom-left, clear of the art's corner. The
	   pip row is 7 wide and ~300px on one line; wrapping it is not a compromise
	   here, it is what turns a list into a block. */
	.ab-pips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 0.7rem;
		margin-top: auto;
		max-width: 62%;
	}
	.ab-pip {
		color: var(--text);
	}

	/* ── 9 · element colours ───────────────────────────────────────────────
	   ⚠ THE GLYPHS HERE ARE MASKED, NOT TINTED. Everywhere else in the app an
	   element icon is a pre-tinted PNG from the generated manifest, and it has
	   to be: masking asks the compositor for a colour it never resolves at
	   build time, so the token and the art could drift apart again — which is
	   the exact failure generate-element-icons.mjs exists to prevent.

	   A board is the one place it is right. The whole job here is to put a
	   colour that DOES NOT EXIST YET on the real silhouette, and generating
	   four hashed sets of seven files to look at a candidate would leave 28
	   files in an add-only tree for every idea we reject. The source art is
	   flat with straight alpha (same property the generator relies on), so a
	   mask reproduces the tint exactly. ⛔ Do not copy this into a component. */
	.lab-sub {
		margin: 1.6rem 0 0.5rem;
		font-family: var(--font-display);
		font-size: var(--fs-xl);
		color: var(--chrome);
	}
	.lab-list {
		padding-left: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.elglyph {
		display: block;
		width: 20px;
		height: 20px;
		background-color: var(--c);
		/* --ms scales the SILHOUETTE inside a box that stays put, which is what
		   makes the three sizing rows comparable. Defaults to `contain`, i.e.
		   exactly what every consumer gets today. */
		-webkit-mask: var(--m) center / var(--ms, contain) no-repeat;
		mask: var(--m) center / var(--ms, contain) no-repeat;
	}
	.elglyph--lg {
		width: 30px;
		height: 30px;
	}

	/* The four grounds carry four sets each, so this grid wants the whole width
	   and the panels want to be tall rather than wide. */
	.lab-grid--el {
		gap: 0.8rem;
	}
	.elspec {
		gap: 0.55rem;
	}
	.elref-tag {
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
	/* ⚠ ctx-night forbids --muted (it does not clear the star), and these tags
	   sit on the bare world in the first panel. */
	.spec--bare .elref-tag {
		color: var(--text);
	}
	.elref {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 0.3rem;
		margin-bottom: 0.5rem;
	}
	.elcell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}
	/* A bar as well as a glyph, because the two questions are different: a glyph
	   is judged on recognition and a bar on how it sits in a stack of others. */
	.elbar {
		width: 100%;
		height: 9px;
		border-radius: 2px;
	}

	/* The dial's two readouts, side by side — the whole argument of the
	   divergence is that these two numbers move in opposite directions. */
	.eldial {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-bottom: 1rem;
	}
	.eldial-row {
		display: grid;
		grid-template-columns: 22rem 15rem 15rem;
		gap: 0.5rem;
		align-items: baseline;
	}
	.eldial-tag {
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.eldial-fig {
		font-size: var(--fs-sm);
		color: var(--text);
		opacity: 0.8;
	}
	.eldial-fig b {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		opacity: 1;
	}

	.lab-row--ladder {
		gap: 2rem;
	}
	.elladder {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.ell-row,
	.ell-legend {
		display: grid;
		grid-template-columns: 4.5rem repeat(3, 8.6rem);
		gap: 0.4rem;
		align-items: center;
	}
	.ell-name {
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.ell-cell {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.ell-sw {
		width: 18px;
		height: 18px;
		border-radius: 2px;
		flex: none;
	}
	.ell-hex,
	.ell-r {
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		font-variant-numeric: tabular-nums;
	}
	.ell-hex {
		color: var(--text);
	}
	.ell-r {
		color: var(--muted);
	}
	/* On the bare world again — see .elref-tag. */
	.ell-r,
	.ell-legend {
		color: var(--text);
		opacity: 0.75;
	}
	.ell-legend {
		margin-top: 0.2rem;
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}

	.elpaper {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1.2rem 1.4rem;
		border-radius: 3px;
		background: var(--surface-broad);
	}
	.elpaper-row {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}
	.elpaper-tag {
		width: 22rem;
		flex: none;
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.elpaper-r {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}
	/* The pip-size row — the only size at which c and d can actually be judged,
	   because the question is whether seven SILHOUETTES separate when small. */
	.elpaper-row--small {
		gap: 0.55rem;
	}
	.elpaper-sp {
		width: 1.6rem;
	}
	/* The recommendation, drawn as the thing it would actually be: pips on the
	   card's glass half, at full strength. Glass over the scene, so this sits
	   OUTSIDE .elpaper — putting it on the parchment would be the very mistake
	   the row exists to avoid. */
	.elonglass {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		margin-top: 1rem;
	}
	/* ⚠ .ctx-glass re-points TOKENS; it does not paint. The pane has to claim
	   --surface itself, same as .benchband above — a glass context with no fill
	   is just bare scene wearing the right ink. */
	.elonglass-pane {
		display: flex;
		gap: 1rem;
		padding: 0.6rem 0.9rem;
		border-radius: 3px;
		background: var(--surface);
	}
	.elpip {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: var(--fs-sm);
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}
	/* The sizing comparison. --ms drives mask-size, so the SILHOUETTE scales
	   inside a box that does not move — which is the only way the three rows
	   stay comparable. */
	.elsizing {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.elsizing-row {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}
	.elpaper-note {
		margin: 0.3rem 0 0;
		max-width: 90ch;
		font-size: var(--fs-md);
		line-height: var(--lh-relaxed);
		color: var(--text);
	}
	/* ⛔ THE DARK-DISC CANDIDATE IS GONE, not merely unused. It was drawn here as
	   option (b) for one round and lost on a rule rather than on looks: a disc
	   re-chips a PICTURE mark, which the TB card round had just finished
	   removing, and it puts an opaque dark object on the paper to fix a problem
	   that is really about paint. Recorded so it is not re-proposed as new. */

	.elpills {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.elpill-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.elpill-tag {
		width: 14rem;
		flex: none;
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.elpill {
		padding: 0.2rem 0.6rem;
		border-radius: 2px;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		white-space: nowrap;
	}
	/* The shipped halo, reproduced exactly — the point of showing option (a) is
	   that its real defence is the halo and not the ratio, so a version without
	   one would be arguing against a straw man. */
	.elpill--halo {
		text-shadow:
			color-mix(in srgb, var(--label-halo) 25%, transparent) 0px 1px 2px,
			color-mix(in srgb, var(--label-halo) 50%, transparent) 0px 0px 6px;
	}

	/* ══ 10 · THE BAR RUNG ════════════════════════════════════════════════════
	   Everything here is drawn at the PLANNER'S OWN NUMBERS, because the whole
	   question is whether a fill survives 10px of white at 14px of height. A
	   comfortable mock would answer a question nobody asked. */
	.eldial--quad .eldial-row {
		grid-template-columns: 24rem 10rem 10rem 8rem 8rem;
	}

	.barcand {
		margin-bottom: 1.1rem;
	}
	/* The pick gets a rule down its left edge and nothing else. On the bare
	   scene a box would be a second object competing with the specimens it is
	   supposed to be pointing at. */
	.barcand--pick {
		border-left: 2px solid var(--accent);
		padding-left: 0.7rem;
		margin-left: -0.9rem;
	}
	.barcand-head {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		margin-bottom: 0.35rem;
	}
	.barcand-tag {
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.barcand-fig {
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		font-variant-numeric: tabular-nums;
		color: var(--text);
		opacity: 0.7;
	}
	/* ⚠ SEVEN FIXED COLUMNS, AND THAT IS THE POINT — not a wrap, not two
	   columns of four. Every candidate lays its elements out on the same pitch,
	   so pyro is at the same x in row A as in row F and a colour's travel down
	   the dial is read by looking STRAIGHT DOWN. A wrapping row breaks that the
	   moment two candidates wrap differently.
	   ⚠ It also fixes the bar's width at ~174px, which is chart-like. A bar
	   stretched across half the page is a different specimen: the fill dominates,
	   the label floats in the middle of it, and the thing being judged (10px of
	   white on a small coloured block) never appears. */
	.barcand-rows {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.barrow {
		display: grid;
		grid-template-columns: 18px minmax(0, 1fr);
		gap: 2px 6px;
		align-items: center;
	}
	/* The comparison the section is FOR: the glyph is `main` and never moves. */
	.barrow-glyph {
		display: block;
		flex: none;
		width: 18px;
		height: 18px;
		background-color: var(--c);
		-webkit-mask: var(--m) center / contain no-repeat;
		mask: var(--m) center / contain no-repeat;
	}
	/* E_ROW_H and the cast pill's radius, verbatim from RotationTimeline. */
	.barrow-bar {
		position: relative;
		flex: 1;
		min-width: 0;
		height: 14px;
		border-radius: 2px;
		display: flex;
		align-items: center;
	}
	.barrow-label {
		padding-left: 5px;
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: #fff;
		white-space: nowrap;
		overflow: hidden;
		/* The shipped halo. ⚠ Two shadows, not one — the tight 1px pass is what
		   holds the stem edges and the 6px pass is what separates the word from
		   the fill; dropping either changes the answer this board is asked for. */
		text-shadow:
			color-mix(in srgb, var(--label-halo) 25%, transparent) 0px 1px 2px,
			color-mix(in srgb, var(--label-halo) 50%, transparent) 0px 0px 6px;
	}
	/* Under the bar, aligned with it — the second column of the row's grid. */
	.barrow-hex {
		grid-column: 2;
		font-family: var(--font-mono);
		font-size: var(--fs-2xs);
		color: var(--text);
		opacity: 0.6;
	}

	/* One element per row, one candidate per column — the ladder read the other
	   way round, so a single element's whole travel is one glance. */
	.barmatrix {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-bottom: 1rem;
	}
	.barmatrix-row {
		display: grid;
		grid-template-columns: 22px repeat(6, minmax(0, 7rem));
		gap: 4px;
		align-items: center;
	}
	.barmatrix-h {
		font-size: var(--fs-2xs);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		color: var(--text);
		opacity: 0.7;
	}
	.barmatrix-sw {
		height: 14px;
		border-radius: 2px;
	}

	/* ══ 11 · UI STATE COLOURS ════════════════════════════════════════════════ */
	.uisw {
		display: inline-block;
		width: 22px;
		height: 18px;
		border-radius: 2px;
		flex: none;
	}
	.uisw--wide {
		width: 100%;
	}
	.uistray {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-bottom: 1rem;
	}
	.uistray-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.uistray-note {
		opacity: 0.75;
	}

	.uigrid {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-bottom: 1rem;
	}
	.uigrid-row {
		display: grid;
		grid-template-columns: 17rem 5rem repeat(5, minmax(0, 7rem));
		gap: 0.5rem;
		align-items: center;
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.uigrid-row--head {
		font-size: var(--fs-2xs);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		opacity: 0.7;
		margin-bottom: 0.2rem;
	}
	/* The proposal rows get a rule rather than a box — same reasoning as the bar
	   board's pick marker: on the bare scene a box competes with the swatches. */
	.uigrid-row--mine {
		border-left: 2px solid var(--accent);
		padding-left: 0.5rem;
		margin-left: -0.7rem;
		margin-bottom: 0.5rem;
	}
	.uigrid-tag {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.uifig {
		font-size: var(--fs-xs);
		opacity: 0.85;
	}
	.uifig b {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	/* ⚠ NOT --ui-danger. This board is ABOUT --ui-danger, and marking its own
	   failures in the value under discussion would move with the thing being
	   judged. --accent is the one hue on this page that is not on trial. */
	.uifig--bad {
		color: var(--accent);
		opacity: 1;
	}

	.uiramps {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.uiramp-row {
		display: grid;
		grid-template-columns: 17rem minmax(0, 22rem) 1fr;
		gap: 0.7rem;
		align-items: center;
		font-size: var(--fs-sm);
		color: var(--text);
	}
	/* The slider track's own geometry — 6px tall, fully rounded. A ramp judged
	   at swatch height is a different object from a ramp judged as a track. */
	.uiramp {
		height: 6px;
		border-radius: 3px;
	}
	.uiramp-hex {
		font-family: var(--font-mono);
		font-size: var(--fs-2xs);
		opacity: 0.6;
	}

	/* ── 11c · the in-context panels ─────────────────────────────────────────
	   Three real grounds side by side. ⚠ The night panel paints NOTHING — a
	   colour judged against a swatch of "dark" is not judged against the world,
	   and the world is what half these marks sit on. */
	.uictx {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.uictx-panel {
		padding: 0.9rem 1rem 1.1rem;
		border-radius: var(--r-sm);
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.15rem;
	}
	.uictx-panel--bare {
		box-shadow: inset 0 0 0 1px var(--line-soft);
	}
	.uictx-head {
		font-size: var(--fs-2xs);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		color: var(--muted);
		margin-bottom: 0.5rem;
	}
	.uictx-role {
		margin-top: 0.55rem;
		font-size: var(--fs-2xs);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		color: var(--text);
		opacity: 0.55;
	}
	.uictx-row {
		display: grid;
		grid-template-columns: 2.2rem 1fr 1fr 1fr 2.6rem;
		gap: 0.35rem;
		align-items: center;
	}
	.uictx-vtag {
		font-size: var(--fs-2xs);
		color: var(--text);
		opacity: 0.5;
	}
	.uictx-ink,
	.uictx-chip,
	.uictx-btn {
		font-family: var(--font-body);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		white-space: nowrap;
		text-align: center;
		padding: 3px 6px;
		border-radius: 3px;
	}
	.uictx-btn {
		border: none;
		font: inherit;
		font-weight: var(--fw-semibold);
		cursor: default;
	}
	.uictx-r {
		font-family: var(--font-mono);
		font-size: var(--fs-2xs);
		color: var(--text);
		opacity: 0.6;
		text-align: right;
	}

	/* ── 11e · the census ────────────────────────────────────────────────── */
	.uicensus {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		margin-bottom: 1rem;
	}
	.uicensus-job {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--text);
		margin-bottom: 0.3rem;
	}
	.uicensus-site {
		font-family: var(--font-mono);
		font-size: var(--fs-2xs);
		color: var(--text);
		opacity: 0.7;
		padding-left: 1.9rem;
	}
	/* The group that would MOVE gets the rule — same marker the proposal rows
	   use, so "this is the change" reads the same way twice on one page. */
	.uicensus-grp--move {
		border-left: 2px solid var(--accent);
		padding-left: 0.6rem;
		margin-left: -0.8rem;
	}
</style>
