<script lang="ts">
	/**
	 * THE BOARD PANE — the right half of the split screen (lineups design §2.4).
	 * A board stacks its TEAMS vertically, each a row (§3); build step 5 gave
	 * the rows their content (Nate 2026-10-09):
	 *
	 *   · A Stygian lineup is the game's Party Setup: a SEASON (the current one,
	 *     earlier ones from the picker), and team i stands on battlefield i —
	 *     the boss's circle avatar (its magnifier opens `BossDetail`), the
	 *     battlefield's name, and its checks with the team's standing (✓ / ⚠;
	 *     ⛔ never guessed — `$lib/endgameChecks`). An Abyss lineup shows the
	 *     current blessing.
	 *   · Every team: the portraits (`SidePortrait`), resonance + factions
	 *     (`CompositionChips` without reactions — a battlefield's checks are
	 *     the reactions that matter here), the FINGERPRINT (the fifteen
	 *     glyphs), and its rotations with the PIN (§10.2).
	 *
	 * A selected TEAM is where the roster's picks land, in click order (Nate
	 * 2026-10-09, the game's own model) — its strip closes a ring in the
	 * team's hue. A filled portrait in the SELECTED row enters swap mode
	 * (§11.6 item 20); elsewhere it selects its row and nothing else, and a
	 * pick leaves by being picked again. ⚓ "No repeats" is ONE TEAM PER
	 * CHARACTER (↻ 2026-10-11 — it allowed and marked): the store moves a
	 * pick, so there is no mark to draw. Each row carries its team's HUE as a
	 * heavy right end, the key to the frames its members wear in the
	 * Characters grid.
	 */
	import Mark from '$lib/components/Mark.svelte';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import SidePortrait from '$lib/components/SidePortrait.svelte';
	import { sideLayout } from '$lib/sidePortrait';
	import CompositionChips from '$lib/components/CompositionChips.svelte';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { constellations, ownership, type SavedNotation } from '$lib/stores';
	import {
		effectiveCon,
		heldElsewhere,
		slotOfCharacter,
		pinnedRotation,
		rotationsForTeam,
		teamCon,
		type Board,
		type BoardTeam
	} from '$lib/boards.svelte';
	import {
		BOSSES,
		SEASONS,
		blessingImage,
		bossImage,
		currentAbyss,
		inLang,
		liveSeasons,
		type Battlefield,
		type Season
	} from '$lib/endgame';
	import { evaluateCheck, type CheckVerdict } from '$lib/endgameChecks';
	import { teamFingerprint } from '$lib/fingerprint';
	import type { FacetKey } from '$lib/capabilities/deriveCapabilities';
	import { checkShift, teamHue, teamLabel } from './team';
	import Fingerprint from './Fingerprint.svelte';
	import CheckChip from './CheckChip.svelte';
	import BossDetail from './BossDetail.svelte';
	import AbyssOpponents from './AbyssOpponents.svelte';

	/** 🎛️ The board's disc (the art rises above it; see `SIDE_ART_PER_DISC`). */
	const BOARD_PORTRAIT = 56;
	/** 🎛️ …and on the ROOMY board (from `broad`, where the board grows to 720):
	 *  64, the size the side art was planned for — pixel for pixel on a 2×
	 *  screen (§9.5a). */
	const BOARD_PORTRAIT_ROOMY = 64;
	/** 🎛️ The boss avatar — a little larger than a member, as in the game. */
	const BOSS_DISC = 88;
	const BOSS_DISC_ROOMY = 104;
	/** 🎛️ …and below `compact`, where it stands in the header strip beside the
	 *  battlefield's name (⚓ Nate 2026-10-20) — the strip's height, not a
	 *  line of its own. */
	const BOSS_DISC_NARROW = 52;

	let {
		board,
		roomy = false,
		narrow = false,
		availH = 0,
		selectedTeamId,
		onSelectTeam,
		nudgeAt,
		onEmptySlot,
		onRemoveTeam,
		onOpenInPlanner,
		onPin,
		bank,
		previewId = null,
		filteredFacets,
		onFind,
		swapping = null,
		onSwap,
		errand = null
	}: {
		board: Board;
		/** The board's ROOMY form (⚓ Nate 2026-10-10: "too cramped and too
		 *  diminutive") before the board is measured — the page's `broad`
		 *  flag; after that the measured width decides (`ROOMY_ROW_MIN`). */
		roomy?: boolean;
		/** The page's `compact` flag — the phone form before the board has been
		 *  measured; after that the measured width decides (2026-10-20). */
		narrow?: boolean;
		/** The board pane's visible height — the Abyss banner takes what the
		 *  teams leave of it (2026-10-20). 0 = unmeasured. */
		availH?: number;
		selectedTeamId: string | null;
		onSelectTeam: (teamId: string) => void;
		/** Set when a pick found the selected team full — the row shakes once. */
		nudgeAt: number | null;
		/** An EMPTY slot was clicked (after it selected its row) — below the
		 *  dock this is the way to the characters that fill it (§11.6). */
		onEmptySlot?: (teamId: string) => void;
		onRemoveTeam: (teamId: string) => void;
		onOpenInPlanner: (team: BoardTeam) => void;
		onPin: (teamId: string, rotationId: string | null) => void;
		/** The saved rotations a team can pin: the profile's documents under
		 *  the switch, the old bank otherwise. */
		bank: readonly SavedNotation[];
		/** The card the pointer rests on — the SELECTED team's fingerprint
		 *  previews the team its pick would make (§11.2). */
		previewId?: string | null;
		/** The roster's capability filter — the fingerprint marks its slots. */
		filteredFacets?: ReadonlySet<FacetKey>;
		/** A faint fingerprint slot was clicked: find who would provide it, for
		 *  this team. */
		onFind?: (teamId: string, facet: FacetKey) => void;
		/** SWAP MODE (§11.6 item 20): the slot being replaced. The hovered card
		 *  previews the team with it in that slot. */
		swapping?: { teamId: string; slot: number } | null;
		/** A FILLED portrait in the SELECTED row was clicked — swap that slot
		 *  (or leave swap mode, if it is the one being swapped). */
		onSwap?: (teamId: string, slot: number) => void;
		/** The Planner's ⇄ (`?swap=N`): ITS team, drawn ALONE in place of the
		 *  board (§10.3) — board-less, so it is drawn and never stored. */
		errand?: { team: BoardTeam; label: string; onCancel: () => void } | null;
	} = $props();

	// ── THE ROW'S GEOMETRY (2026-10-20, ⚓ Nate) ──────────────────────────────
	// One arrangement at every width: the lineup with the team's way into the
	// Planner at its RIGHT, the chips under it, the fingerprint under them —
	// and the fingerprint LOCKED to the lineup's width (first disc to last).
	// What changes is the boss (in the banner on a phone, beside the row when
	// it fits) and the Planner's shape (a vertical plate where the width is
	// short, "Planner →" over the pin where it isn't). The form follows the
	// board's MEASURED width, so the 431–640 range takes whichever fits.

	/** 🎛️ The gap between portraits: 18 on the board (Nate 2026-10-09), 22
	 *  on the roomy board, 16 on a phone — where the fingerprint at its 5px
	 *  slot gap (263 at least) must still fit under the lineup (4 × 56 + 3g). */
	const BOARD_GAP = 18;
	const BOARD_GAP_ROOMY = 22;
	const BOARD_GAP_PHONE = 16;
	/** …and on the smallest screens, where the portraits shrink to make room
	 *  for the vertical plate and the fingerprint spans under it instead. */
	const BOARD_GAP_TIGHT = 12;
	/** 🎛️ The smallest a phone's portrait may shrink (320 needs ~45). */
	const BOARD_PORTRAIT_MIN = 40;
	/** The lineup frame's padding beyond the discs: 8 before, 20 after (the
	 *  team hue's end inside it). The frame starts 8px into the gutter, so a
	 *  column spends the 20. */
	const FRAME_END = 20;
	/** 🎛️ The vertical Planner plate (⚓ Nate's idea): width and gap. */
	const V_PLANNER_W = 28;
	const V_PLANNER_GAP = 8;
	/** 🎛️ "Planner →" over the pin: the stack's width at LEAST (what the wide
	 *  row reserves), and the most it grows into the board's spare width —
	 *  room for a pinned rotation's name on two lines. */
	const STACK_W = 96;
	const STACK_W_ROOMY = 112;
	const STACK_MAX = 168;
	const STACK_MAX_ROOMY = 200;
	/** The phone body's left gutter (the frame's 8 reaches into it). */
	const PHONE_GUTTER = 8;
	/** The wide body: its padding (16 + 10) and the gaps either side of the
	 *  boss's rule (1.25rem each + the 1px rule). */
	const WIDE_BODY_SPEND = 16 + 10 + 20 + 1 + 20;
	/** The widest board that still takes the PHONE form: the wide row needs
	 *  the boss, the 56px lineup and the stack side by side. */
	const WIDE_ROW_MIN =
		WIDE_BODY_SPEND +
		BOSS_DISC +
		4 * BOARD_PORTRAIT +
		3 * BOARD_GAP +
		FRAME_END +
		BOARD_GAP +
		STACK_W;

	let boardW = $state(0);
	/** The phone form: measured, or the page's `compact` flag before the
	 *  first measurement (SSR / first paint). */
	const phone = $derived(boardW ? boardW < WIDE_ROW_MIN : narrow);
	/** The narrowest board that takes the ROOMY form (↻ 2026-10-20: by the
	 *  board's measured width, so the full-width Lineup tab between `compact`
	 *  and the dock grows too — not only the docked 720/800 boards): the
	 *  roomy boss, a 64px lineup, the roomy stack, and the roomy body's 1.5rem
	 *  gaps either side of the rule. */
	const ROOMY_ROW_MIN =
		WIDE_BODY_SPEND +
		8 +
		BOSS_DISC_ROOMY +
		4 * BOARD_PORTRAIT_ROOMY +
		3 * BOARD_GAP_ROOMY +
		FRAME_END +
		BOARD_GAP_ROOMY +
		STACK_W_ROOMY;
	/** Measured, or the page's `broad` flag before the first measurement. */
	const isRoomy = $derived(!phone && (boardW ? boardW >= ROOMY_ROW_MIN : roomy));
	/** On a phone, room for a 56px lineup at its phone gap and the STACK? */
	const phoneStack = $derived(
		phone &&
			boardW >=
				PHONE_GUTTER +
					4 * BOARD_PORTRAIT +
					3 * BOARD_GAP_PHONE +
					FRAME_END +
					BOARD_GAP_PHONE +
					STACK_W
	);
	/** …else the vertical plate: does a 56px lineup at the phone gap fit? */
	const phoneFull = $derived(
		boardW >=
			PHONE_GUTTER +
				4 * BOARD_PORTRAIT +
				3 * BOARD_GAP_PHONE +
				FRAME_END +
				V_PLANNER_GAP +
				V_PLANNER_W
	);
	/** The one exception: the lineup shrinks and the fingerprint spans. */
	const tight = $derived(phone && !phoneStack && !!boardW && !phoneFull);
	const gap = $derived(
		tight ? BOARD_GAP_TIGHT : phone ? BOARD_GAP_PHONE : isRoomy ? BOARD_GAP_ROOMY : BOARD_GAP
	);
	const portrait = $derived(
		tight
			? Math.max(
					BOARD_PORTRAIT_MIN,
					Math.min(
						BOARD_PORTRAIT,
						Math.floor(
							(boardW - PHONE_GUTTER - 3 * gap - FRAME_END - V_PLANNER_GAP - V_PLANNER_W) / 4
						)
					)
				)
			: isRoomy
				? BOARD_PORTRAIT_ROOMY
				: BOARD_PORTRAIT
	);
	/** First disc to last; the frame adds its 8 before and its end after. */
	const span = $derived(4 * portrait + 3 * gap);
	/** THE FINGERPRINT'S WIDTH: the lineup's FRAME (8 + the discs + its hue
	 *  end) — or, on the smallest screens, its whole row (the frame's edge to
	 *  the plate's), where it cannot match the lineup. */
	const fpW = $derived(tight ? boardW : span + 8 + FRAME_END);
	/** 🎛️ ⚓ Nate 2026-10-20: its gaps stay NARROW and fixed — 5px between
	 *  glyphs, 8px between its three clusters — and its GLYPHS size up to
	 *  meet the width: 15 glyphs + 12 slot gaps + 2 cluster gaps. A fraction
	 *  of a pixel is fine; the art is already scaled off-grid by the
	 *  generator's balance. ~14.9 on a phone, ~15.3 on the board, ~18.3 roomy. */
	const FP_SLOT_GAP = 5;
	const FP_CLUSTER_GAP = 8;
	const fpGlyph = $derived((fpW - 12 * FP_SLOT_GAP - 2 * FP_CLUSTER_GAP) / 15);
	const OVERHANG = $derived(sideLayout(portrait).overhang);

	// ── THE ABYSS BANNER ADAPTS TO THE HEIGHT (⚓ Nate 2026-10-20) ────────────
	// The blessing's art is the banner's GROUND at every height: it fills the
	// banner and fades hard under the words, so even with no room to spare
	// its shapes still read behind them (↻ the same day: a sliver of art over
	// a text-only strip said nothing). The banner takes whatever height the
	// board's OTHER contents leave in the pane, up to the art's own 2:1 shape
	// (≤ 320); with less than the words need, the blessing clamps (below).
	// The text is never hidden. The loop is stable by construction: the room
	// is measured WITHOUT the banner, and the words' full height depends only
	// on the width.
	const ART_MAX = 320;
	/** The title's whole width (a hidden copy) and its line's width. ⚠ The
	 *  copy is absolute inside the POSITIONED .bv-abyss-text. */
	let abyssTitleW = $state(0);
	let abyssLineW = $state(0);
	/** 🎛️ The + button's room on the title's line (24 + the 0.75rem gap). */
	const MORE_ROOM = 36;
	const abyssPrefix = $derived(!abyssLineW || abyssTitleW <= abyssLineW - MORE_ROOM);
	// ⚠⚠ EVERY INPUT BELOW IS INDEPENDENT OF THE BANNER ITSELF (↻ 2026-10-20,
	// Nate saw it flicker): the room was "the board less the banner" from two
	// measurements that update a frame apart, and the words' height was "the
	// text block less the blessing" — near the fit, a stale pair clamped, the
	// clamp moved the pair, and the banner cycled 144 → 121 → 163 → 142 every
	// frame. Now the TEAMS are measured in their own wrapper, the board's gap
	// and padding read off its style, and the words' height is the title's
	// line + the text's padding + the blessing's FULL height — none of which
	// the banner's height or its clamp can move.
	let bvEl = $state<HTMLElement>();
	let teamsH = $state(0);
	/** The board's own spend besides the banner and the teams: its row gap
	 *  (banner → teams) and its padding. Per form, so re-read when it moves. */
	let bvSpend = $state(0);
	$effect(() => {
		void phone;
		void isRoomy;
		if (!bvEl) return;
		const cs = getComputedStyle(bvEl);
		bvSpend =
			(parseFloat(cs.rowGap) || 0) +
			(parseFloat(cs.paddingTop) || 0) +
			(parseFloat(cs.paddingBottom) || 0);
	});
	let textEl = $state<HTMLElement>();
	let titleH = $state(0);
	/** The text block's padding + the gap between its title and blessing. */
	let textPad = $state(0);
	$effect(() => {
		void phone;
		if (!textEl) return;
		const cs = getComputedStyle(textEl);
		textPad =
			(parseFloat(cs.paddingTop) || 0) +
			(parseFloat(cs.paddingBottom) || 0) +
			(parseFloat(cs.rowGap) || 0);
	});
	let blessingEl = $state<HTMLElement>();
	/** The blessing's FULL height and line height, read off the element
	 *  (a clamped box still reports its whole content as scrollHeight). */
	let blessingFullH = $state(0);
	let blessingLineH = $state(0);
	$effect(() => {
		void boardW;
		void phone;
		if (!blessingEl) return;
		blessingFullH = blessingEl.scrollHeight;
		blessingLineH = parseFloat(getComputedStyle(blessingEl).lineHeight) || 0;
	});
	/** The banner's text less the blessing: its padding and the title. */
	const textChrome = $derived(textPad + titleH);
	/** The words' height UNCLAMPED. */
	const textFullH = $derived(textChrome + blessingFullH);
	/** The height the banner may take: the pane less the teams and the
	 *  board's own spend — floored, less a pixel, so rounding never tips the
	 *  pane into a scroll. */
	const bannerRoom = $derived(
		availH && teamsH && bvSpend ? Math.floor(availH - teamsH - bvSpend) - 1 : 0
	);
	/** The banner's height when the room exceeds the words (0 = the words'
	 *  own height, the art faint behind all of them). */
	const bannerFillH = $derived(
		!bannerRoom || !titleH
			? 224 // unmeasured: the old fixed 14rem
			: bannerRoom <= textFullH
				? 0
				: Math.min(bannerRoom, Math.max(textFullH, Math.min(ART_MAX, Math.round(boardW / 2))))
	);
	/** 🎛️ When even the words don't fit, the blessing CLAMPS to the lines
	 *  the room allows — two at least, never hidden — with + to read the rest
	 *  (the board then scrolls, as you asked it to). */
	const BLESSING_MIN_LINES = 2;
	let blessingOpen = $state(false);
	const blessingLines = $derived.by(() => {
		if (!bannerRoom || !blessingLineH || bannerRoom >= textFullH) return 0;
		const total = Math.round(blessingFullH / blessingLineH);
		const fit = Math.floor((bannerRoom - textChrome) / blessingLineH);
		return fit >= total ? 0 : Math.max(BLESSING_MIN_LINES, fit);
	});

	/* The constellation chip compares the team's level with your account's,
	   but only once the roster has something in it, or everyone reads as
	   unowned (§9.5). `undefined` = nothing to compare against. */
	const rosterHasContent = $derived(Object.values($ownership).includes('owned'));
	const ownedConOf = (id: string): number | null | undefined =>
		!rosterHasContent ? undefined : $ownership[id] === 'owned' ? ($constellations[id] ?? 0) : null;

	let shaking = $state(false);
	$effect(() => {
		if (!nudgeAt) return;
		shaking = true;
		const t = setTimeout(() => (shaking = false), 300);
		return () => clearTimeout(t);
	});

	// ── The lineup's battlefields ────────────────────────────────────────────
	const seasons = liveSeasons();
	const season = $derived(
		board.preset === 'stygian'
			? (SEASONS.find((s) => s.version === board.season) ?? seasons[0])
			: undefined
	);
	const abyss = $derived(board.preset === 'abyss' ? currentAbyss() : undefined);
	/** Everything a team row shows, from the team and the bank. */
	function teamFacts(team: BoardTeam) {
		const ids = team.slots.filter((s): s is string => !!s);
		const own = teamCon(team, bank);
		const conOf = (id: string) => effectiveCon(own, $constellations, id);
		return { ids, own, conOf, fingerprint: ids.length ? teamFingerprint(ids, conOf) : null };
	}
	/** The team a pick of `previewId` would make — the pick is the game's
	 *  toggle, so a member previews their own removal, and a full team
	 *  previews nothing (the pick would only nudge). ↻ Nor does a character
	 *  on ANOTHER team under No repeats: that pick only takes them off it
	 *  (⚓ Nate 2026-10-18), so this team would not change. */
	function previewIds(team: BoardTeam, facts: ReturnType<typeof teamFacts>): string[] | null {
		if (!previewId || team.id !== selectedTeamId) return null;
		// Swapping: the candidate takes the slot (a teammate is never offered).
		if (swapping?.teamId === team.id)
			return facts.ids.includes(previewId)
				? null
				: team.slots
						.map((s, i) => (i === swapping.slot ? previewId : s))
						.filter((s): s is string => !!s);
		if (facts.ids.includes(previewId)) return facts.ids.filter((id) => id !== previewId);
		// Another Traveler variant: the pick takes that one's slot (one Traveler).
		const j = slotOfCharacter(team.slots, previewId);
		if (j >= 0)
			return team.slots.map((s, i) => (i === j ? previewId : s)).filter((s): s is string => !!s);
		if (heldElsewhere(board, team.id, previewId)) return null;
		return team.slots.includes(null) ? [...facts.ids, previewId] : null;
	}
	const verdictsFor = (b: Battlefield, ids: string[], conOf: (id: string) => number) =>
		ids.length
			? b.checks.map((c) => evaluateCheck(c, ids, conOf).verdict)
			: (undefined as CheckVerdict[] | undefined);

	/** A boss's name — on a phone only what comes before its first colon
	 *  (⚓ Nate 2026-10-20: "Gale Hewing" is the variant; the magnifier's
	 *  details still carry the whole name). */
	function bossName(boss: Battlefield['boss'], short: boolean): string {
		const full = inLang(BOSSES[boss].name);
		return short ? full.split(': ')[0] : full;
	}

	/** The Abyss half whose opponents are open. */
	let opponents = $state<0 | 1 | null>(null);

	let detail = $state<{
		battlefield: Battlefield;
		season: Season;
		index: number;
		verdicts?: CheckVerdict[];
	} | null>(null);
</script>

{#snippet teamRow(team: BoardTeam, t: number, isErrand: boolean)}
	{@const filled = team.slots.some((s) => s !== null)}
	{@const facts = teamFacts(team)}
	{@const field = isErrand ? undefined : season?.battlefields[t]}
	{@const half = !isErrand && abyss && t < 2 ? abyss.halves[t] : undefined}
	{@const verdicts = field ? verdictsFor(field, facts.ids, facts.conOf) : undefined}
	{@const rotations = rotationsForTeam(team, bank)}
	{@const pin = pinnedRotation(team, bank)}
	{@const sel = team.id === selectedTeamId}
	{@const after = previewIds(team, facts)}
	{@const preview = after ? teamFingerprint(after, facts.conOf) : null}
	{@const afterVerdicts = after && field ? verdictsFor(field, after, facts.conOf) : undefined}
	{@const name = isErrand ? (errand?.label ?? '') : teamLabel(board, t)}
	{@const swapSlot = swapping?.teamId === team.id ? swapping.slot : null}
	{@const plate = filled && !isErrand}
	{@const planTitle = pin
		? `Open “${pin.name}” in the Rotation Planner`
		: 'Open this team in the Rotation Planner'}
	{@const pinLabel = pin
		? `Pinned rotation for ${name}: ${pin.name}`
		: `Pin a rotation for ${name}`}
	<!-- The row's pieces, arranged twice below: the wide row and the phone's. -->
	{#snippet boss(size: number, zoom: number)}
		{#if field && season}
			<button
				class="bv-boss"
				style:--boss="{size}px"
				style:--zoom="{zoom}px"
				aria-label="Details: {inLang(BOSSES[field.boss].name)}"
				onclick={() => (detail = { battlefield: field, season, index: t, verdicts })}
			>
				<img src={bossImage(field.boss, 'icon')} alt="" />
				<span class="bv-boss-zoom" aria-hidden="true"
					><Mark name="search" size={zoom >= 26 ? 14 : 11} /></span
				>
			</button>
		{/if}
	{/snippet}
	{#snippet checks(terse = false)}
		{#if field?.checks.length}
			<div class="bv-checks">
				{#each field.checks as c, i (i)}<CheckChip
						check={c}
						verdict={afterVerdicts?.[i] ?? verdicts?.[i]}
						shift={afterVerdicts && verdicts ? checkShift(c, verdicts[i], afterVerdicts[i]) : 0}
						{terse}
					/>{/each}
			</div>
		{/if}
	{/snippet}
	{#snippet pinItems(close: () => void)}
		{#each [null, ...rotations] as r (r?.id ?? '')}
			{@const current = (pin?.id ?? null) === (r?.id ?? null)}
			<button
				class="band-menu-item"
				role="menuitemradio"
				aria-checked={current}
				onclick={() => {
					close();
					onPin(team.id, r?.id ?? null);
				}}
			>
				<span class="bv-menu-check"
					>{#if current}<Mark name="check" size={12} />{/if}</span
				>
				{#if r}{r.name}{:else}<span class="bv-menu-quiet">No pin</span>{/if}
			</button>
		{/each}
	{/snippet}
	{#snippet act()}
		<!-- THE TEAM'S WAY INTO THE PLANNER, at the lineup's right (⚓ Nate
			     2026-10-20): "Planner →" over the pin, the two as tall as the
			     lineup's frame — or the vertical plate, where the width is short
			     (the pin then sits beside the chips). The pin appears once there
			     is a saved rotation to pin, and is GOLD while one is pinned. -->
		{#if phone && !phoneStack}
			<button
				class="btn bv-vplanner"
				onclick={() => onOpenInPlanner(team)}
				title={planTitle}
				aria-label={planTitle}
				><span class="bv-vword">Planner</span><Mark name="forwardSlim" size={12} /></button
			>
			{#if rotations.length > 0}
				<span class="bv-pin bv-pin--beside" class:bv-pin--on={!!pin}>
					<BandMenu
						compact
						mark="pin"
						size="sm"
						align="end"
						ariaLabel={pinLabel}
						items={pinItems}
					/>
				</span>
			{/if}
		{:else}
			<div class="bv-act">
				<button
					class="btn btn--sm bv-planner"
					onclick={() => onOpenInPlanner(team)}
					title={planTitle}
					aria-label={planTitle}>Planner <Mark name="forward" size={12} /></button
				>
				{#if rotations.length > 0}
					<span class="bv-pin" class:bv-pin--on={!!pin}>
						<BandMenu
							mark="pin"
							size="sm"
							align="end"
							label={pin?.name ?? 'Rotation'}
							ariaLabel={pinLabel}
							items={pinItems}
						/>
					</span>
				{/if}
			</div>
		{/if}
	{/snippet}
	{#snippet slots()}
		<!-- The whole strip is the row's hit area (the slots are its
			     keyboard path), framed when selected. -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div
			class="bv-slots"
			style:--over="{OVERHANG}px"
			style:--team-hue={isErrand ? 'var(--accent)' : teamHue(t)}
			class:bv-slots--sel={sel}
			class:bv-slots--nudge={sel && shaking}
			onclick={() => onSelectTeam(team.id)}
		>
			{#each team.slots as id, i (i)}
				{@const entry = id ? getCharacterIndexEntry(id) : undefined}
				<div class="bv-slot-wrap">
					<!-- ⚓ §11.6 item 8: on an UNSELECTED row a portrait selects
						     the row and nothing else; a FILLED portrait in the
						     SELECTED row swaps its slot, and again leaves swap mode.
						     On the Planner's row an EMPTY one does too — it adds. -->
					<button
						class="bv-slot"
						class:bv-slot--swap={swapSlot === i}
						data-name={entry?.displayName ?? ''}
						aria-pressed={sel}
						aria-label={entry
							? sel
								? swapSlot === i
									? `Stop replacing ${entry.displayName}`
									: `Replace ${entry.displayName}, ${name} slot ${i + 1}`
								: `${entry.displayName}, ${name} slot ${i + 1}`
							: sel && isErrand
								? swapSlot === i
									? `Stop adding to ${name}`
									: `Add to ${name}, slot ${i + 1}`
								: `Empty, ${name} slot ${i + 1}`}
						onclick={(e) => {
							e.stopPropagation();
							if (sel && (id || isErrand) && onSwap) return onSwap(team.id, i);
							onSelectTeam(team.id);
							if (!id) onEmptySlot?.(team.id);
						}}
					>
						<SidePortrait
							{id}
							size={portrait}
							con={id ? facts.conOf(id) : undefined}
							ownedCon={id ? ownedConOf(id) : undefined}
						/>
					</button>
				</div>
			{/each}
		</div>
	{/snippet}
	{#snippet fingerprint()}
		<!-- The fingerprint's line is RESERVED (⚓ Nate 2026-10-12): an empty
			     team keeps its height, so the board doesn't move when a team
			     fills, empties or previews. -->
		<div class="bv-fp">
			{#if facts.fingerprint || preview}
				<Fingerprint
					clusters={facts.fingerprint ?? teamFingerprint([], facts.conOf)}
					{preview}
					previewId={facts.ids.includes(previewId ?? '') ? null : previewId}
					filtered={sel ? filteredFacets : undefined}
					onFind={!isErrand && onFind ? (facet) => onFind(team.id, facet) : undefined}
				/>
			{/if}
		</div>
	{/snippet}

	<!-- ⚓ Nate 2026-10-09, after the game's own Party Setup: only the HEADER
		     is glass (the site — a battlefield, an Abyss half); everything under
		     it stands on the night. A battlefield's header fuses its number with
		     the boss's name, as the game writes "Battlefield 1: …". -->
	<section class="bv-team" class:bv-team--errand={isErrand} aria-label={name}>
		<header
			class="bv-team-head ctx-glass"
			class:bv-team-head--boss={phone && !!field}
			class:bv-team-head--half={!!half}
		>
			<!-- ↻ 2026-10-20 (⚓ Nate): on a phone the boss stands IN the strip,
				     beside its short name — two blocks folded into one. -->
			{#if phone}{@render boss(BOSS_DISC_NARROW, 20)}{/if}
			<div class="bv-head-text">
				<!-- ↻ §11.6 item 13: ONE run of Bitter bold, mixed case, as the game
					     writes "Battlefield 1: Aeonblight Drake: Skyshaker" — measured
					     over all 28 bosses, every English name fits one line of the
					     docked board (the old Plex caps ran a third wider). -->
				<h3
					class="bv-head-title"
					title={field && phone ? inLang(BOSSES[field.boss].name) : undefined}
				>
					{field
						? phone
							? bossName(field.boss, true)
							: `Battlefield ${t + 1}: ${bossName(field.boss, false)}`
						: half
							? t === 0
								? 'First half'
								: 'Second half'
							: name}
				</h3>
				<!-- ↻ 2026-10-20 (⚓ Nate): on a phone the checks sit IN the banner,
					     under the boss's name, beside its portrait. -->
				{#if phone && field}{@render checks(true)}{/if}
				{#if half}<p class="bv-half">{inLang(half).replaceAll('**', '')}</p>{/if}
			</div>
			<!-- ↻ §11.6: the header names the SITE and nothing else. "Open in
				     Planner" moved to the rotation line, and ✕ belongs to a Custom
				     board only — a battlefield is not yours to remove. -->
			{#if isErrand}
				<span class="bv-team-actions">
					<button class="btn btn--sm" onclick={() => errand?.onCancel()}>Cancel</button>
				</span>
			{:else if (half && abyss) || (board.preset === 'custom' && board.teams.length > 1)}
				<span class="bv-team-actions">
					<!-- Below `compact` it keeps its MARK and drops its WORD, as band
						     controls do, so the half's name has the strip's width. -->
					{#if half && abyss}
						<button
							class="btn btn--sm"
							aria-label="Opponents"
							onclick={() => (opponents = t as 0 | 1)}
							><Mark name="search" size={12} /><span class="bv-word">Opponents</span></button
						>
					{/if}
					{#if board.preset === 'custom' && board.teams.length > 1}
						<button
							class="btn btn--icon bv-remove-team"
							onclick={() => onRemoveTeam(team.id)}
							aria-label="Remove team {t + 1}"><Mark name="close" size={12} /></button
						>
					{/if}
				</span>
			{/if}
		</header>

		<!-- ONE GRID at every width (⚓ Nate 2026-10-20): the lineup with the
			     team's way into the Planner at its right; the chips under the
			     lineup; the fingerprint under them, as wide as the lineup. Wide,
			     the boss stands at the left with its checks over the lineup, as
			     the game's own selection screen has it; on a phone both went up
			     into the banner. -->
		{#snippet grid()}
			<div
				class="bv-grid"
				class:bv-grid--top={!phone}
				class:bv-grid--act={plate && (!phone || phoneStack)}
				class:bv-grid--vert={plate && phone && !phoneStack}
				class:bv-grid--tight={tight}
			>
				{#if !phone && field?.checks.length}<div class="bv-top">{@render checks()}</div>{/if}
				{@render slots()}
				{#if plate}{@render act()}{/if}
				{#if filled}
					<!-- What the four unlock together: resonances and factions, one to
						     four chips (two of each is the most a team makes). -->
					<div class="bv-chips"><CompositionChips ids={team.slots} reactions={false} /></div>
				{/if}
				{@render fingerprint()}
			</div>
		{/snippet}
		{#if phone}
			<div class="bv-nbody">{@render grid()}</div>
		{:else}
			<div class="bv-body">
				{#if field && season}
					{@render boss(isRoomy ? BOSS_DISC_ROOMY : BOSS_DISC, 26)}
					<span class="bv-vrule" aria-hidden="true"></span>
				{/if}
				{@render grid()}
			</div>
		{/if}
	</section>
{/snippet}

<div
	class="bv"
	class:bv--roomy={isRoomy}
	class:bv--phone={phone}
	style:--portrait="{portrait}px"
	style:--slot-gap="{gap}px"
	style:--span="{span}px"
	style:--fp-w="{fpW}px"
	style:--fp-glyph="{fpGlyph}px"
	style:--bv-fp-slot="{FP_SLOT_GAP}px"
	style:--fp-cluster-gap="{FP_CLUSTER_GAP}px"
	style:--frame-end="{FRAME_END}px"
	style:--vplanner-w="{V_PLANNER_W}px"
	style:--vplanner-gap="{V_PLANNER_GAP}px"
	style:--stack-w="{isRoomy ? STACK_W_ROOMY : STACK_W}px"
	style:--stack-max="{isRoomy ? STACK_MAX_ROOMY : STACK_MAX}px"
	bind:clientWidth={boardW}
	bind:this={bvEl}
>
	<!-- ⚓ The Planner's ⇄ is a state of its OWN (Nate 2026-10-13): its team
	     alone, not a row above whatever board was open — the board waits,
	     untouched, and comes back when the errand ends. -->
	{#if errand}
		{@render teamRow(errand.team, -1, true)}
	{:else if abyss}
		<!-- The blessing's own art (640×320, the game's) is the banner's ground,
		     fading hard under the words laid over its foot (Nate 2026-10-09,
		     ↻ 2026-10-20) — the banner as tall as the room the teams leave. -->
		<header class="bv-abyss" style:--banner-h="{bannerFillH}px" style:--text-h="{textFullH}px">
			<img class="bv-abyss-art" src={blessingImage(abyss.icon)} alt="" />
			<div class="bv-abyss-text" bind:this={textEl}>
				<div class="bv-abyss-title" bind:clientWidth={abyssLineW} bind:clientHeight={titleH}>
					<!-- ⚓ Nate 2026-10-20: ONE line — where the whole title won't fit
						     (a 320 phone), "Spiral Abyss · " folds and the Moon names the
						     cycle alone. Measured off a hidden copy of the whole title
						     against the line LESS the + button's room, held whether or
						     not the button shows, so the decision cannot feed itself. -->
					<span class="bv-lineup-mode"
						>{abyssPrefix ? 'Spiral Abyss · ' : ''}{inLang(abyss.name)}</span
					>
					<span
						class="bv-lineup-mode bv-abyss-measure"
						aria-hidden="true"
						bind:clientWidth={abyssTitleW}>Spiral Abyss · {inLang(abyss.name)}</span
					>
					{#if blessingLines > 0}
						<button
							class="btn btn--icon btn--sm bv-abyss-more"
							aria-label={blessingOpen ? 'Less' : 'More'}
							aria-expanded={blessingOpen}
							onclick={() => (blessingOpen = !blessingOpen)}
							><Mark name={blessingOpen ? 'minus' : 'plus'} size={12} /></button
						>
					{/if}
				</div>
				<span
					class="bv-abyss-blessing"
					class:bv-abyss-blessing--clamped={blessingLines > 0 && !blessingOpen}
					style:--lines={blessingLines}
					bind:this={blessingEl}>{inLang(abyss.text).replaceAll('**', '')}</span
				>
			</div>
		</header>
	{/if}

	{#if !errand}
		<!-- The teams in a box of their own, so the Abyss banner can measure
		     what they take without measuring itself. -->
		<div class="bv-teams" bind:clientHeight={teamsH}>
			{#each board.teams as team, t (team.id)}{@render teamRow(team, t, false)}{/each}
		</div>
	{/if}
</div>

{#if opponents !== null && abyss}
	<AbyssOpponents cycle={abyss} half={opponents} onClose={() => (opponents = null)} />
{/if}

{#if detail}
	<BossDetail
		battlefield={detail.battlefield}
		season={detail.season}
		index={detail.index}
		verdicts={detail.verdicts}
		onClose={() => (detail = null)}
	/>
{/if}

<style>
	/* 🎛️ Breathing room (⚓ Nate 2026-10-10: "a little more"): the rhythm
	   between teams, inside a team, and inside its header. */
	/* 🎛️ THE RHYTHM (2026-10-20, tightened): between teams, banner to body
	   (.bv-team), and between the row's lines (--row-gap). Phone and roomy
	   below. */
	.bv {
		--row-gap: 0.65rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 0 0 1.5rem;
	}
	/* The teams' own box (the Abyss banner measures it): the board's gap
	   between them, as when they were its direct children. */
	.bv-teams {
		display: flex;
		flex-direction: column;
		gap: inherit;
	}

	/* The pin menu's rows: a check column, then the rotation. */
	.bv-menu-check {
		width: 12px;
		display: grid;
		place-items: center;
	}
	.bv-menu-quiet {
		color: var(--muted);
	}
	.bv-lineup-mode {
		font-family: var(--font-display);
		font-weight: var(--fw-semibold);
		font-size: var(--fs-3xl);
		color: var(--text);
	}

	/* The Abyss banner: the art is its GROUND — it fills the banner and fades
	   hard under the words (to ~20%, then ~10% at the foot), so the shapes
	   still read behind them whatever share of the banner they take. */
	.bv-abyss {
		position: relative;
		display: grid;
		min-height: var(--banner-h);
		border-radius: var(--r-sm);
		overflow: hidden;
	}
	.bv-abyss-art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		mask-image: linear-gradient(
			to bottom,
			#000 calc(100% - var(--text-h) - 32px),
			rgb(0 0 0 / 0.22) calc(100% - var(--text-h) + 8px),
			rgb(0 0 0 / 0.1) 100%
		);
	}
	/* ⚠ POSITIONED: the art's mask makes it a stacking context, which paints
	   OVER in-flow text that shares its grid cell. */
	.bv-abyss-text {
		position: relative;
		align-self: end;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 1rem 1.1rem 0.6rem;
	}
	.bv-abyss-blessing.bv-abyss-blessing--clamped {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: var(--lines);
		line-clamp: var(--lines);
		overflow: hidden;
	}
	/* The title's line carries More, so the clamp spends no line on it. */
	.bv-abyss-title {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}
	/* The width test's copy: laid out, never seen, never in the flow. */
	.bv-abyss-measure {
		position: absolute;
		visibility: hidden;
		white-space: nowrap;
		pointer-events: none;
	}
	.bv-abyss-more {
		flex: none;
		margin-top: 0.2rem;
	}
	.bv-abyss-blessing {
		display: block;
		max-width: 46rem;
		font-size: var(--fs-lg);
		line-height: 1.45;
		color: var(--text);
	}

	/* ── A team: the glass strip names the site, the rest stands on night ── */
	.bv-team {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.bv-team-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.65rem 0.75rem 0.65rem 1rem;
		border-radius: var(--r-sm);
		background: var(--surface);
	}
	.bv-head-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	/* ↻ §11.6 item 13: the battlefield's heading in the game's voice — Bitter
	   bold, mixed case, the number and the boss one run of text. White for now
	   (the house rule: gold names a block, a title is not gold); the game's is
	   gold, and Nate may switch it back.
	   ↻ ⚓ Nate 2026-10-10: 13 → 14px (back on the ladder), with the board
	   grown to 720 from `broad`. At 580 the longest few names now wrap to a
	   second line — as the game's own do. */
	.bv-head-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
		line-height: 1.4;
		color: var(--text);
	}
	.bv-team-actions {
		flex: none;
		display: flex;
		align-items: center;
		gap: 4px;
	}
	/* An Abyss half: the title shares its line with Opponents, and the half's
	   blessing runs the strip's whole width beneath both (⚓ Nate 2026-10-20 —
	   it wrapped at the button's edge, a line it never shares). */
	.bv-team-head--half {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.25rem 0.75rem;
	}
	.bv-team-head--half .bv-head-text {
		display: contents;
	}
	.bv-team-head--half .bv-head-title {
		grid-area: 1 / 1;
		align-self: center;
	}
	.bv-team-head--half .bv-half {
		grid-column: 1 / -1;
	}
	.bv-team-head--half .bv-team-actions {
		grid-area: 1 / 2;
	}
	.bv-half {
		margin: 0;
		font-size: var(--fs-md);
		line-height: 1.45;
		color: var(--text);
	}
	.bv-body {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding: 0 0.6rem 0 1rem;
	}
	.bv-vrule {
		flex: none;
		align-self: stretch;
		width: 1px;
		background: var(--line-faint);
	}

	/* ── THE ROW'S GRID (⚓ Nate 2026-10-20) — one at every width ──
	   Column 1 is the LINEUP's (its discs + the frame's end); the chips and
	   the fingerprint take the width they are given (zero intrinsic width),
	   so only the lineup sizes it. Column 2 is the team's way into the
	   Planner. The modifiers only change the template:
	     --top   wide: the boss's checks over the lineup
	     --act   "Planner →" over the pin, beside the lineup
	     --vert  the vertical plate beside the lineup, the pin beside the chips
	     --tight the vertical plate on the smallest screens: the fingerprint
	             spans under the plate rather than wrap */
	.bv-grid {
		display: grid;
		grid-template-columns: max-content;
		grid-template-areas: 'slots' 'chips' 'fp';
		align-content: start;
		row-gap: var(--row-gap);
		min-width: 0;
		flex: 1;
	}
	.bv-grid--top {
		grid-template-areas: 'top' 'slots' 'chips' 'fp';
	}
	.bv-grid--act {
		grid-template-columns: max-content minmax(var(--stack-w), var(--stack-max));
		grid-template-areas: 'slots act' 'chips .' 'fp .';
		column-gap: var(--slot-gap);
	}
	.bv-grid--act.bv-grid--top {
		grid-template-areas: 'top top' 'slots act' 'chips .' 'fp .';
	}
	/* ⚓ Nate 2026-10-20: the vertical plate and the pin HUG THE SCREEN'S
	   EDGE, not the lineup — the plate's column takes the row's spare width
	   and the two stand at its end. */
	.bv-grid--vert {
		grid-template-columns: max-content minmax(var(--vplanner-w), 1fr);
		grid-template-areas: 'slots act' 'chips pin' 'fp .';
		column-gap: var(--vplanner-gap);
	}
	.bv-grid--vert.bv-grid--tight {
		grid-template-areas: 'slots act' 'chips pin' 'fp fp';
	}
	/* ⚓ Nate 2026-10-20: the checks, the chips and the fingerprint share the
	   FRAME's left edge — 8px before the first disc — so every line of a team
	   starts at the one visible box. */
	.bv-top {
		grid-area: top;
		min-width: 0;
		margin-left: -8px;
	}
	.bv-slots {
		grid-area: slots;
		justify-self: start;
	}
	.bv-chips {
		grid-area: chips;
		align-self: center;
		width: 0;
		min-width: calc(100% + 8px);
		margin-left: -8px;
	}
	.bv-chips > :global(.comp) {
		flex-wrap: wrap;
	}
	/* THE FINGERPRINT IS LOCKED TO THE LINEUP'S FRAME (⚓ Nate 2026-10-20):
	   the frame's whole width — its 8px before the first disc, the discs, its
	   end with the team's hue — so its ends sit under the frame's at every
	   width; on the smallest screens (--tight) its whole row instead. Its
	   gaps are fixed and narrow, and its GLYPHS size to fill (--fp-w,
	   --fp-glyph — both set in the script). */
	.bv-fp {
		grid-area: fp;
		width: var(--fp-w);
		margin-left: -8px;
		/* The reserved line (⚓ Nate 2026-10-12): an empty team holds the
		   board's shape — the glyph + its 2px gap + the 3px dots, rounded. */
		min-height: calc(var(--fp-glyph) + 8px);
	}
	.bv-fp :global(.fp) {
		gap: var(--fp-cluster-gap);
		flex-wrap: nowrap;
		/* Absorbs sub-pixel rounding only; the sizes already fill the width. */
		justify-content: space-between;
	}
	.bv-fp :global(.fp-cluster) {
		--fp-slot-gap: var(--bv-fp-slot);
	}
	.bv-fp :global(.fp-slot) {
		width: var(--fp-glyph);
	}
	.bv-fp :global(.fp-glyph) {
		width: var(--fp-glyph);
		height: var(--fp-glyph);
	}
	/* ⚠ The OUTER slots' hit areas stop at the fingerprint's ends: they
	   reach half a gap past their glyph, and at the row's edge that spilled
	   ~3px past the board and scrolled it sideways. */
	.bv-fp :global(.fp-cluster:first-child .fp-slot:first-child::before) {
		left: 0;
	}
	.bv-fp :global(.fp-cluster:last-child .fp-slot:last-child::before) {
		right: 0;
	}
	.bv-checks {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	/* THE STACK: as tall as the lineup's FRAME (the disc + its 6px padding
	   twice), standing on the frame, not the art's overhang above it.
	   ⚓ Nate 2026-10-20: a SLIM "Planner →" takes a third and the pin two
	   thirds, so a pinned rotation's name has two lines. Planner → keeps its
	   third with no pin under it. */
	.bv-act {
		grid-area: act;
		align-self: end;
		height: calc(var(--portrait) + 12px);
		margin-bottom: -6px;
		display: grid;
		grid-template-rows: 1fr 2fr;
		gap: 4px;
		min-width: 0;
	}
	.bv-act > .bv-planner,
	.bv-act > .bv-pin,
	.bv-act > .bv-pin > :global(.band-menu-trigger) {
		width: 100%;
		height: auto;
		min-height: 0;
		min-width: 0;
	}
	.bv-act > .bv-planner {
		justify-content: center;
		padding-block: 0;
		font-size: var(--fs-xs);
	}
	.bv-act > .bv-pin {
		display: flex;
	}
	.bv-act :global(.band-menu-trigger) {
		justify-content: start;
		text-align: left;
	}
	/* The name: up to two lines, then an ellipsis (its tooltip and menu
	   carry it whole). It is the player's OWN text, so it is set as they
	   wrote it — mixed case, no tracking — as the library lists it, rather
	   than in the plate's caps (which also ran a third wider). */
	.bv-act :global(.band-menu-label) {
		text-transform: none;
		letter-spacing: normal;
		font-weight: var(--fw-medium);
		flex: 1;
		min-width: 0;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		white-space: normal;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}
	/* The pin's MARK is gold while a rotation is pinned (gold is where a thing
	   is chosen) — touch has no tooltip to say so. */
	.bv-pin--on :global(.band-menu-trigger > .mark:first-child) {
		color: var(--accent);
	}
	.bv-pin--beside {
		grid-area: pin;
		align-self: center;
		justify-self: end;
		width: var(--vplanner-w);
		display: flex;
		justify-content: center;
	}

	/* The boss: a circle-cut avatar on the members' ring, the game's magnifier
	   at its top right, and the whole disc is the button. */
	.bv-boss {
		position: relative;
		flex: none;
		width: var(--boss);
		height: var(--boss);
		padding: 0;
		border: 2px solid var(--line-faint); /* the members' night ring */
		border-radius: var(--r-round);
		background: var(--surface-well);
		cursor: pointer;
		transition: border-color var(--t-snap);
	}
	.bv-boss img {
		width: 100%;
		height: 100%;
		border-radius: var(--r-round);
		object-fit: cover;
	}
	/* ⚓ Nate 2026-10-10: hover recolours the RING itself — no second outline
	   outside it — and the magnifier turns with it, to the same colour. */
	.bv-boss:hover {
		border-color: var(--sel-ring);
	}
	/* 🎛️ 26 with a 14px mark (⚓ Nate's placement, 2026-10-10). */
	.bv-boss-zoom {
		position: absolute;
		top: 3px;
		right: -2px;
		width: var(--zoom, 26px);
		height: var(--zoom, 26px);
		display: grid;
		place-items: center;
		border-radius: var(--r-round);
		background-color: var(--btn-face, var(--surface-raised));
		/* The gold layer, transparent at rest (see the hover). */
		box-shadow: inset 0 0 0 calc(var(--zoom, 26px) / 2) transparent;
		color: var(--text);
		transition:
			background-color var(--t-snap),
			box-shadow var(--t-snap);
	}
	/* ⚠ The ring's colour is translucent gold laid over the disc's well, so the
	   magnifier lays the SAME gold over the SAME well — one colour, not two that
	   happen to share a token.
	   ⚠ The gold is an INSET SHADOW filling the 26px circle, never a gradient
	   layer: a gradient cannot interpolate, so it SNAPPED while the colour under
	   it faded — a one-frame flash in and, worse, out. A shadow's colour fades
	   with the backing, so the two move as one. */
	.bv-boss:hover .bv-boss-zoom {
		background-color: var(--surface-well);
		box-shadow: inset 0 0 0 calc(var(--zoom, 26px) / 2) var(--sel-ring);
	}

	/* ── The lineup ── */
	/* The row's frame hugs the RINGS: the art's overhang is pulled out of the
	   layout (a negative margin) and the frame (::before) starts below it, so
	   hair rises over the frame's top edge. Its heavy END is the team's hue at
	   rest too; selecting the row closes the ring, so selecting moves nothing. */
	.bv-slots {
		position: relative;
		display: flex;
		gap: var(--slot-gap); /* 18, Nate 2026-10-09 — see BOARD_GAP */
		padding: 6px 20px 6px 8px;
		margin: calc(-1 * var(--over)) 0 -6px -8px;
		cursor: pointer;
	}
	.bv-slots::before {
		content: '';
		position: absolute;
		inset: var(--over) 0 0;
		border: 1px solid transparent;
		border-right: 5px solid var(--team-hue);
		border-radius: var(--r-md);
		pointer-events: none;
		transition: border-color var(--t-snap);
	}
	/* ↻ Nate 2026-10-13: the team's HUE is the row's heavy END, always — the
	   key to the frames its members wear in the Characters grid (§11.6 item
	   8) — and selecting the row closes the ring in the same hue. (It was a
	   3px edge on the left with a gold ring and end on selection.) */
	.bv-slots:hover:not(.bv-slots--sel)::before {
		border-top-color: var(--line-soft);
		border-bottom-color: var(--line-soft);
		border-left-color: var(--line-soft);
	}
	.bv-slots--sel::before {
		border-color: var(--team-hue);
	}
	/* The shared nudge (app.css) — it guards reduced motion itself. */
	.bv-slots--nudge {
		animation: nudge 120ms 2;
	}
	/* The board's ring is the FAINT line (Nate 2026-10-09): on the night four
	   strong rings read as a row of buttons, not of portraits. */
	.bv-slot :global(.spt-disc) {
		border-color: var(--line-faint);
	}
	.bv-slot-wrap {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		width: var(--portrait);
	}
	/* The slot is a bare hit area around the portrait, which draws its own
	   ring and empty state; the ROW frames the selection. */
	/* SWAP MODE: the slot being replaced wears the gold ring — gold is where
	   a thing is chosen (§11.6 item 20). */
	.bv-slot--swap :global(.spt-disc) {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
	}
	.bv-slot {
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		border-radius: var(--r-round);
	}
	/* ── THE ROOMY BOARD (from `broad`, 1500px — the page's --tb-board-w) ──
	   The contents grow with the board: the portraits, the boss, the gaps
	   and the fingerprint's glyphs are set in the script; here, the chips'
	   type and the rhythm step up one rung each. */
	.bv--roomy {
		gap: 1.75rem;
		--row-gap: 0.8rem;
	}
	.bv--roomy .bv-team {
		gap: 1rem;
	}
	.bv--roomy .bv-body {
		gap: 1.5rem;
	}
	.bv--roomy :global(.fp-pip) {
		width: 15px;
		height: 15px;
	}
	.bv--roomy :global(.ck) {
		min-height: 28px;
		font-size: var(--fs-md);
	}
	.bv--roomy :global(.comp-chip) {
		height: 24px;
		font-size: var(--fs-sm);
	}

	/* ── THE PHONE ROW (`phone` — the board narrower than the wide row) ──
	   ↻ 2026-10-20 (⚓ Nate, L2 + the boss in the strip): the boss stands in
	   the banner with its short name on ONE line and the checks under it; the
	   lineup takes the width; the composition runs under it with the rotation
	   and Planner → at its end. Measured before: 339px a team at 390, three
	   lone lines (Planner →, the pin, the chips) and the boss on its own. */
	.bv-team-head--boss {
		gap: 0.65rem;
		padding: 5px 0.75rem 5px 5px;
	}
	.bv-team-head--boss .bv-boss {
		border-color: var(--line-soft);
	}
	.bv-team-head--boss .bv-head-text {
		gap: 4px;
	}
	/* ONE line: the longest names ellipsize (the title and the magnifier's
	   details carry them whole). */
	.bv-team-head--boss .bv-head-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* The checks on the banner's GLASS lose their pill ground — glass on glass
	   stacks its alpha — and keep their marks, whose colour and shape carry
	   the standing. The preview's ring stays, so it keeps its padding. */
	.bv-team-head--boss :global(.ck) {
		background: none;
		min-height: 20px;
		padding: 0 6px 0 0;
	}
	.bv-team-head--boss :global(.ck--better),
	.bv-team-head--boss :global(.ck--worse) {
		padding-left: 6px;
	}
	.bv-nbody {
		padding: 0 0 0 8px;
	}
	/* The phone's rhythm: tighter between teams (the chips' spare space
	   already sits at a team's foot) and inside one. */
	.bv--phone {
		gap: 1.25rem;
		--row-gap: 0.65rem;
	}
	/* The vertical plate (⚓ Nate's idea): the word bottom to top, as tall as
	   the lineup's frame. */
	.bv-vplanner {
		grid-area: act;
		align-self: end;
		justify-self: end;
		width: var(--vplanner-w);
		height: calc(var(--portrait) + 12px);
		margin-bottom: -6px;
		/* ⚓ Nate 2026-10-20: the chevron sits against the right edge (its box
		   already carries ~3px of air around its ink) and the room goes to
		   the word's side. */
		padding: 0 0 0 1px;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 1px;
		font-size: var(--fs-xs);
	}
	/* Bottom to top, as a spine reads: vertical-rl turned half a turn.
	   ⚠ inline-block: a transform does not apply to an inline box. */
	.bv-vword {
		display: inline-block;
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		line-height: 1;
	}
	/* A coarse pointer reaches the narrow plate across half the gap. */
	@media (pointer: coarse) {
		.bv-vplanner {
			position: relative;
		}
		/* ⚠ Leftward only: the plate hugs the screen's edge, and a hit area
		   past it scrolled the pane sideways (Chrome's device mode). */
		.bv-vplanner::after {
			content: '';
			position: absolute;
			inset: 0 0 0 calc(-1 * var(--vplanner-gap) / 2);
		}
	}

	/* ── Below `compact` (40rem — $lib/breakpoints.ts): the board is the whole
	   screen. The row's form follows the board's measured width (`phone`);
	   these are the pieces around it. */
	@media (max-width: 40rem) {
		.bv-word {
			display: none;
		}
		.bv-team-head {
			align-items: start;
			padding-left: 0.75rem;
		}
		.bv-team-head--boss {
			align-items: center;
			padding-left: 5px;
		}
		.bv-abyss-text {
			padding-inline: 0.75rem;
		}
		/* One size down on a phone: five lines at 320 at the desk size. */
		.bv-abyss-blessing {
			font-size: var(--fs-md);
		}
	}
</style>
