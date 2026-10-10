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
	 *     the reactions that matter here), the FINGERPRINT (placeholder pips
	 *     until Nate's icons), and its rotations with the PIN (§10.2).
	 *
	 * A selected TEAM is where the roster's picks land, in click order (Nate
	 * 2026-10-09, the game's own model) — a frame around its portraits, gold
	 * as everywhere a thing is chosen. A filled portrait is not a control: it
	 * selects its row and nothing else, and a pick leaves by being picked again.
	 * ⚓ "No repeats" ALLOWS AND MARKS: a character on two teams wears a warning
	 * mark on both, while the board's toggle is on.
	 */
	import Mark from '$lib/components/Mark.svelte';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import SidePortrait from '$lib/components/SidePortrait.svelte';
	import { sideLayout } from '$lib/sidePortrait';
	import CompositionChips from '$lib/components/CompositionChips.svelte';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { constellations, ownership, savedNotations } from '$lib/stores';
	import {
		effectiveCon,
		pinnedRotation,
		repeatedCharacters,
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
	/** 🎛️ …and below `compact`, where it shares a line with the checks and
	 *  hands the lineup the full width — still larger than a member's 56. */
	const BOSS_DISC_NARROW = 64;
	/** How far a member's art rises above its ring — the portrait reserves it,
	 *  and the row frame hugs the RINGS, so hair rises out over the frame as in
	 *  the game rather than being boxed in a strip of empty headroom. */

	let {
		board,
		roomy = false,
		selectedTeamId,
		onSelectTeam,
		nudgeAt,
		onEmptySlot,
		onRemoveTeam,
		onOpenInPlanner,
		onPin,
		onSeason
	}: {
		board: Board;
		/** The board's wide form (⚓ Nate 2026-10-10: "too cramped and too
		 *  diminutive"): from `broad` it is 720 wide, and its contents grow with
		 *  it rather than leaving the width empty. */
		roomy?: boolean;
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
		onSeason: (version: string) => void;
	} = $props();

	const portrait = $derived(roomy ? BOARD_PORTRAIT_ROOMY : BOARD_PORTRAIT);
	const OVERHANG = $derived(sideLayout(portrait).overhang);

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

	/** Who sits on more than one team — shown only while the toggle is on. */
	const repeats = $derived(
		board.noRepeats ? repeatedCharacters(board.teams.map((t) => t.slots)) : {}
	);
	/** A team's name as its header says it, for the repeat mark's sentence. */
	const teamName = (t: number) =>
		season?.battlefields[t]
			? `Battlefield ${t + 1}`
			: abyss && t < 2
				? t === 0
					? 'the first half'
					: 'the second half'
				: `Team ${t + 1}`;

	// ── The lineup's battlefields ────────────────────────────────────────────
	const seasons = liveSeasons();
	const season = $derived(
		board.preset === 'stygian'
			? (SEASONS.find((s) => s.version === board.season) ?? seasons[0])
			: undefined
	);
	const abyss = $derived(board.preset === 'abyss' ? currentAbyss() : undefined);
	const fmtDay = (iso: string) =>
		new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		});

	/** Everything a team row shows, from the team and the bank. */
	function teamFacts(team: BoardTeam) {
		const ids = team.slots.filter((s): s is string => !!s);
		const own = teamCon(team, $savedNotations);
		const conOf = (id: string) => effectiveCon(own, $constellations, id);
		return { ids, own, conOf, fingerprint: ids.length ? teamFingerprint(ids, conOf) : null };
	}
	const verdictsFor = (b: Battlefield, ids: string[], conOf: (id: string) => number) =>
		ids.length
			? b.checks.map((c) => evaluateCheck(c, ids, conOf).verdict)
			: (undefined as CheckVerdict[] | undefined);

	/** The Abyss half whose opponents are open. */
	let opponents = $state<0 | 1 | null>(null);

	let detail = $state<{
		battlefield: Battlefield;
		season: Season;
		index: number;
		verdicts?: CheckVerdict[];
	} | null>(null);
</script>

<div class="bv" class:bv--roomy={roomy} style:--portrait="{portrait}px">
	{#if season}
		<header class="bv-lineup">
			<span class="bv-lineup-mode">Stygian Onslaught</span>
			<!-- The site's dropdown (a plate, an opaque slate menu) rather than the
			     platform's select (Nate 2026-10-09). -->
			<BandMenu
				label="{season.version} · {fmtDay(season.start)} – {fmtDay(season.end)}"
				ariaLabel="Season"
				align="start"
			>
				{#snippet items(close)}
					{#each seasons as s (s.version)}
						{@const current = s.version === season.version}
						<button
							class="band-menu-item"
							role="menuitemradio"
							aria-checked={current}
							onclick={() => {
								close();
								onSeason(s.version);
							}}
						>
							<span class="bv-menu-check"
								>{#if current}<Mark name="check" size={12} />{/if}</span
							>
							<span class="bv-season-version">{s.version}</span>
							<span class="bv-season-dates">{fmtDay(s.start)} – {fmtDay(s.end)}</span>
						</button>
					{/each}
				{/snippet}
			</BandMenu>
		</header>
	{:else if abyss}
		<!-- The blessing's own banner (2:1), faded into the night at its edges, its
		     name and text laid over its foot. -->
		<!-- The blessing's own art (640×320, the game's), as a banner faded into
		     the night at its foot, the blessing laid over it (Nate 2026-10-09). -->
		<header class="bv-abyss">
			<img class="bv-abyss-art" src={blessingImage(abyss.icon)} alt="" />
			<div class="bv-abyss-text">
				<span class="bv-lineup-mode">Spiral Abyss · {inLang(abyss.name)}</span>
				<span class="bv-abyss-blessing">{inLang(abyss.text).replaceAll('**', '')}</span>
			</div>
		</header>
	{/if}

	{#each board.teams as team, t (team.id)}
		{@const filled = team.slots.some((s) => s !== null)}
		{@const facts = teamFacts(team)}
		{@const field = season?.battlefields[t]}
		{@const half = abyss && t < 2 ? abyss.halves[t] : undefined}
		{@const verdicts = field ? verdictsFor(field, facts.ids, facts.conOf) : undefined}
		{@const rotations = rotationsForTeam(team, $savedNotations)}
		{@const pin = pinnedRotation(team, $savedNotations)}
		{@const sel = team.id === selectedTeamId}
		<!-- ⚓ Nate 2026-10-09, after the game's own Party Setup: only the HEADER
		     is glass (the site — a battlefield, an Abyss half); everything under
		     it stands on the night. A battlefield's header fuses its number with
		     the boss's name, as the game writes "Battlefield 1: …". -->
		<section class="bv-team" aria-label="Team {t + 1}">
			<header class="bv-team-head ctx-glass">
				<div class="bv-head-text">
					<!-- ↻ §11.6 item 13: ONE run of Bitter bold, mixed case, as the game
					     writes "Battlefield 1: Aeonblight Drake: Skyshaker" — measured
					     over all 28 bosses, every English name fits one line of the
					     docked board (the old Plex caps ran a third wider). -->
					<h3 class="bv-head-title">
						{field
							? `Battlefield ${t + 1}: ${inLang(BOSSES[field.boss].name)}`
							: half
								? t === 0
									? 'First half'
									: 'Second half'
								: `Team ${t + 1}`}
					</h3>
					{#if half}<p class="bv-half">{inLang(half).replaceAll('**', '')}</p>{/if}
				</div>
				<!-- ↻ §11.6: the header names the SITE and nothing else. "Open in
				     Planner" moved to the rotation line, and ✕ belongs to a Custom
				     board only — a battlefield is not yours to remove. -->
				{#if (half && abyss) || (board.preset === 'custom' && board.teams.length > 1)}
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

			<!-- Stygian's own shape (Nate 2026-10-09): the boss at the left, a
			     vertical rule, then the stack — checks, the lineup, the fingerprint. -->
			<div class="bv-body">
				{#if field && season}
					<button
						class="bv-boss"
						style:--boss="{roomy ? BOSS_DISC_ROOMY : BOSS_DISC}px"
						style:--boss-narrow="{BOSS_DISC_NARROW}px"
						aria-label="Details: {inLang(BOSSES[field.boss].name)}"
						onclick={() => (detail = { battlefield: field, season, index: t, verdicts })}
					>
						<img src={bossImage(field.boss, 'icon')} alt="" />
						<span class="bv-boss-zoom" aria-hidden="true"><Mark name="search" size={14} /></span>
					</button>
					<span class="bv-vrule" aria-hidden="true"></span>
				{/if}
				<div class="bv-stack">
					{#if field?.checks.length}
						<div class="bv-checks">
							{#each field.checks as c, i (i)}<CheckChip check={c} verdict={verdicts?.[i]} />{/each}
						</div>
					{/if}
					<div class="bv-lineup-row">
						<!-- The whole strip is the row's hit area (the slots are its
						     keyboard path), framed when selected. -->
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<div
							class="bv-slots"
							style:--over="{OVERHANG}px"
							class:bv-slots--sel={sel}
							class:bv-slots--nudge={sel && shaking}
							onclick={() => onSelectTeam(team.id)}
						>
							{#each team.slots as id, i (i)}
								{@const entry = id ? getCharacterIndexEntry(id) : undefined}
								{@const others = id ? repeats[id]?.filter((x) => x !== t) : undefined}
								<div class="bv-slot-wrap">
									<button
										class="bv-slot"
										data-name={entry?.displayName ?? ''}
										aria-pressed={sel}
										aria-label={entry
											? `${entry.displayName}, team ${t + 1} slot ${i + 1}`
											: `Empty, team ${t + 1} slot ${i + 1}`}
										onclick={(e) => {
											e.stopPropagation();
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
									{#if others?.length}
										<!-- ⏭ Working copy (copy step 8). -->
										<span
											class="bv-repeat"
											role="img"
											aria-label="Also on {others.map(teamName).join(' and ')}"
											title="{entry?.displayName ?? id} is also on {others
												.map(teamName)
												.join(' and ')}"><Mark name="warn" size={12} /></span
										>
									{/if}
								</div>
							{/each}
						</div>
						{#if filled}
							<div class="bv-side">
								<CompositionChips ids={team.slots} reactions={false} />
								<!-- The team's rotation, and the way to play it: the line exists
								     exactly when the team does, and the rotation is the button's
								     subject (§11.6 item 13). -->
								<div class="bv-play">
									<!-- ⚓ A team's rotations are DERIVED from the library by its set;
								     a pin names the one you would play here (§10.2). -->
									{#if rotations.length === 0}
										<span class="bv-rotations"><Mark name="pin" size={12} /> No saved rotation</span
										>
									{:else}
										<BandMenu
											mark="pin"
											size="sm"
											align="start"
											label={pin?.name ??
												(rotations.length === 1
													? '1 rotation, none pinned'
													: `${rotations.length} rotations, none pinned`)}
											ariaLabel="Pinned rotation for team {t + 1}"
										>
											{#snippet items(close)}
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
														{#if r}{r.name}{:else}<span class="bv-menu-quiet">None pinned</span
															>{/if}
													</button>
												{/each}
											{/snippet}
										</BandMenu>
									{/if}
									<button
										class="btn btn--sm"
										onclick={() => onOpenInPlanner(team)}
										title="Open this team in the Rotation Planner"
										><Mark name="forward" size={12} /> Open in Planner</button
									>
								</div>
							</div>
						{/if}
					</div>
					{#if facts.fingerprint}<Fingerprint clusters={facts.fingerprint} />{/if}
				</div>
			</div>
		</section>
	{/each}
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
	.bv {
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
		padding: 0 0 1.5rem;
	}

	/* ── The lineup's header ── */
	.bv-lineup {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}
	/* The menus' rows: a check column, then the choice (a season: version +
	   dates). */
	.bv-menu-check {
		width: 12px;
		display: grid;
		place-items: center;
	}
	.bv-season-version {
		min-width: 2.2em;
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
	}
	.bv-season-dates,
	.bv-menu-quiet {
		color: var(--muted);
	}
	.bv-lineup-mode {
		font-family: var(--font-display);
		font-weight: var(--fw-semibold);
		font-size: var(--fs-3xl);
		color: var(--text);
	}

	/* The Abyss banner: the art across the pane, faded at the foot so the
	   blessing sits on the night it melts into. */
	.bv-abyss {
		display: grid;
		border-radius: var(--r-sm);
		overflow: hidden;
	}
	.bv-abyss > * {
		grid-area: 1 / 1;
	}
	.bv-abyss-art {
		width: 100%;
		height: 14rem;
		object-fit: cover;
		mask-image: linear-gradient(to bottom, #000 30%, transparent 100%);
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
	.bv-abyss-blessing {
		max-width: 46rem;
		font-size: var(--fs-lg);
		line-height: 1.45;
		color: var(--text);
	}

	/* ── A team: the glass strip names the site, the rest stands on night ── */
	.bv-team {
		display: flex;
		flex-direction: column;
		gap: 1rem;
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
	.bv-stack {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		min-width: 0;
		flex: 1;
	}
	.bv-checks {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.bv-lineup-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 1.1rem;
	}
	.bv-side {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
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
	/* 🎛️ 26 with a 14px mark, snugged 1px in from the disc's corner. */
	.bv-boss-zoom {
		position: absolute;
		top: -1px;
		right: -1px;
		width: 26px;
		height: 26px;
		display: grid;
		place-items: center;
		border-radius: var(--r-round);
		background: var(--btn-face, var(--surface-raised));
		color: var(--text);
		transition: background var(--t-snap);
	}
	/* ⚠ The ring's colour is translucent gold laid over the disc's well, so the
	   magnifier lays the SAME gold over the SAME well — one colour, not two that
	   happen to share a token. */
	.bv-boss:hover .bv-boss-zoom {
		background: linear-gradient(var(--sel-ring), var(--sel-ring)), var(--surface-well);
	}

	/* ── The lineup ── */
	/* The row's frame. At rest it holds its geometry with no paint, so
	   selecting a row moves nothing; selected, the game's frame — a ring and a
	   gold bar at its end — in the site's gold for "chosen". */
	/* The row's frame hugs the RINGS: the art's overhang is pulled out of the
	   layout (a negative margin) and the frame (::before) starts below it, so
	   hair rises over the frame's top edge. At rest the frame is unpainted, so
	   selecting a row moves nothing; selected it is the game's — a ring whose
	   END is heavier — in the site's gold for "chosen". */
	.bv-slots {
		position: relative;
		display: flex;
		gap: 18px; /* Nate 2026-10-09 */
		padding: 6px 20px 6px 8px;
		margin: calc(-1 * var(--over)) 0 -6px -8px;
		cursor: pointer;
	}
	.bv-slots::before {
		content: '';
		position: absolute;
		inset: var(--over) 0 0;
		border: 1px solid transparent;
		border-right-width: 5px;
		border-radius: var(--r-md);
		pointer-events: none;
		transition: border-color var(--t-snap);
	}
	.bv-slots:hover:not(.bv-slots--sel)::before {
		border-color: var(--line-soft);
	}
	.bv-slots--sel::before {
		border-color: var(--sel-ring);
	}
	.bv-slots--nudge {
		animation: nudge 120ms 2;
	}
	@media (prefers-reduced-motion: reduce) {
		.bv-slots--nudge {
			animation: none;
		}
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
	.bv-slot {
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		border-radius: var(--r-round);
	}
	/* A repeat: the warning mark, on its own ground so art never muddies it. */
	.bv-repeat {
		position: absolute;
		/* The disc's bottom left (Nate 2026-10-09) — the constellation chip holds
		   the bottom right. ⏭ Watch it against chins over time. */
		bottom: 0;
		left: -4px;
		width: 20px;
		height: 20px;
		display: grid;
		place-items: center;
		border-radius: var(--r-round);
		background: var(--surface-well);
		color: var(--ui-warning);
	}
	.bv-play {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 10px;
	}
	.bv-rotations {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--fs-sm);
		color: var(--text);
	}
	/* ── THE ROOMY BOARD (from `broad`, 1500px — the page's --tb-board-w) ──
	   The contents grow with the board: the portraits and the boss are set in
	   the script; here, the gaps between them, the fingerprint's glyphs, and
	   the chips' type step up one rung each. */
	.bv--roomy .bv-slots {
		gap: 22px;
	}
	.bv--roomy :global(.fp) {
		gap: 14px;
	}
	.bv--roomy :global(.fp-cluster) {
		gap: 6px;
	}
	.bv--roomy :global(.fp-slot) {
		width: 20px;
	}
	.bv--roomy :global(.fp-glyph) {
		width: 20px;
		height: 20px;
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
	.bv--roomy .bv-rotations {
		font-size: var(--fs-md);
	}

	/* ── Below `compact` (40rem — $lib/breakpoints.ts): the board is the whole
	   screen ── The wide row puts the boss BESIDE a stack whose lineup (four
	   56px portraits, 306px with its frame) and fingerprint (~308px) can't fit
	   next to it on a phone. Here the boss shares a line with the checks, and the
	   lineup and the fingerprint take the full width beneath. The split pane
	   never gets this narrow (472px at 1000), so the wide form is untouched. */
	@media (max-width: 40rem) {
		.bv-lineup {
			flex-wrap: wrap;
			gap: 0.4rem 0.9rem;
		}
		.bv-word {
			display: none;
		}
		.bv-team-head {
			align-items: start;
			padding-left: 0.75rem;
		}
		.bv-body {
			display: grid;
			grid-template-columns: auto minmax(0, 1fr);
			align-items: center;
			gap: 0.8rem 0.9rem;
			padding: 0 0 0 8px;
		}
		/* The stack dissolves into the body's grid: its checks sit beside the
		   boss, everything else spans the row. */
		.bv-stack {
			display: contents;
		}
		.bv-vrule {
			display: none;
		}
		/* The blessing runs to five lines at 320 and would cover the art whole:
		   on a phone it follows the banner, overlapping only its faded foot. */
		.bv-abyss-text {
			grid-area: 2 / 1;
			margin-top: -4.5rem;
			padding-inline: 0.75rem;
		}
		.bv-abyss-art {
			height: 11rem;
		}
		.bv-boss {
			width: var(--boss-narrow);
			height: var(--boss-narrow);
		}
		.bv-body > :global(*),
		.bv-stack > :global(*) {
			grid-column: 1 / -1;
		}
		.bv-body > .bv-boss {
			grid-column: 1;
		}
		.bv-stack > .bv-checks {
			grid-column: 2;
		}
		/* Four portraits in 288px of screen (320 less its gutters): 224 of
		   discs, the frame's 28, three gaps of 12. */
		.bv-slots {
			gap: 12px;
		}
	}
</style>
