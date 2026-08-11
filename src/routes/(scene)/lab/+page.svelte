<script lang="ts">
	import Mark from '$lib/components/Mark.svelte';

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
			label: 'gradient + 1.5px stroke — was',
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
			gradient manufactured an inner shadow and the 1.5px stroke drew the shape the gradient was too
			faint to draw alone — <strong>one idea in two parts</strong>, and both predate the depth
			ladder. A flat rung states it directly.
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
</style>
