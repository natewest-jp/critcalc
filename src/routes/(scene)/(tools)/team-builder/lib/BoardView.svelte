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
	 * A selected slot is where the roster's next pick lands (swap mode is step 6).
	 */
	import Mark from '$lib/components/Mark.svelte';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import SidePortrait from '$lib/components/SidePortrait.svelte';
	import CompositionChips from '$lib/components/CompositionChips.svelte';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { constellations, ownership, savedNotations } from '$lib/stores';
	import {
		BOARD_TEAM_LIMIT,
		effectiveCon,
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
	import Fingerprint from './Fingerprint.svelte';
	import CheckChip from './CheckChip.svelte';
	import BossDetail from './BossDetail.svelte';
	import AbyssOpponents from './AbyssOpponents.svelte';

	/** 🎛️ The board's disc (the art rises above it; see `SIDE_ART_PER_DISC`). */
	const BOARD_PORTRAIT = 56;
	/** 🎛️ The boss avatar — a little larger than a member, as in the game. */
	const BOSS_DISC = 88;

	export type SlotRef = { teamId: string; index: number };

	let {
		board,
		selected,
		onSelect,
		onEmpty,
		onAddTeam,
		onRemoveTeam,
		onOpenInPlanner,
		onPin,
		onSeason
	}: {
		board: Board;
		selected: SlotRef | null;
		onSelect: (slot: SlotRef | null) => void;
		onEmpty: (slot: SlotRef) => void;
		onAddTeam: () => void;
		onRemoveTeam: (teamId: string) => void;
		onOpenInPlanner: (team: BoardTeam) => void;
		onPin: (teamId: string, rotationId: string | null) => void;
		onSeason: (version: string) => void;
	} = $props();

	/* The constellation chip compares the team's level with your account's,
	   but only once the roster has something in it, or everyone reads as
	   unowned (§9.5). `undefined` = nothing to compare against. */
	const rosterHasContent = $derived(Object.values($ownership).includes('owned'));
	const ownedConOf = (id: string): number | null | undefined =>
		!rosterHasContent ? undefined : $ownership[id] === 'owned' ? ($constellations[id] ?? 0) : null;

	const isSelected = (teamId: string, index: number) =>
		selected?.teamId === teamId && selected.index === index;

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

<div class="bv">
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
		<!-- ⚓ Nate 2026-10-09, after the game's own Party Setup: only the HEADER
		     is glass (the site — a battlefield, an Abyss half); everything under
		     it stands on the night. A battlefield's header fuses its number with
		     the boss's name, as the game writes "Battlefield 1: …". -->
		<section class="bv-team" aria-label="Team {t + 1}">
			<header class="bv-team-head ctx-glass">
				<div class="bv-head-text">
					<h3 class="bv-head-title">
						<span class="kicker bv-head-n"
							>{field
								? `Battlefield ${t + 1}:`
								: half
									? t === 0
										? 'First half'
										: 'Second half'
									: `Team ${t + 1}`}</span
						>
						<!-- The boss's name in full, in the game's order: "Battlefield 1:
						     Battle-Hardened Domovoy Sculptor: Gale Hewing" — the family is the
						     NAME, the part after it the title. -->
						{#if field}<span class="bv-boss-name">{inLang(BOSSES[field.boss].name)}</span>{/if}
					</h3>
					{#if half}<p class="bv-half">{inLang(half).replaceAll('**', '')}</p>{/if}
				</div>
				<span class="bv-team-actions">
					{#if half && abyss}
						<button class="btn btn--sm" onclick={() => (opponents = t as 0 | 1)}
							><Mark name="search" size={12} /> Opponents</button
						>
					{/if}
					<button
						class="btn btn--sm"
						disabled={!filled}
						onclick={() => onOpenInPlanner(team)}
						title="Open this team in the Rotation Planner"
						><Mark name="forward" size={12} /> Open in Planner</button
					>
					{#if board.teams.length > 1}
						<button
							class="btn btn--icon bv-remove-team"
							onclick={() => onRemoveTeam(team.id)}
							aria-label="Remove team {t + 1}"><Mark name="close" size={12} /></button
						>
					{/if}
				</span>
			</header>

			<!-- Stygian's own shape (Nate 2026-10-09): the boss at the left, a
			     vertical rule, then the stack — checks, the lineup, the fingerprint. -->
			<div class="bv-body">
				{#if field && season}
					<button
						class="bv-boss"
						style:--boss="{BOSS_DISC}px"
						aria-label="Details: {inLang(BOSSES[field.boss].name)}"
						onclick={() => (detail = { battlefield: field, season, index: t, verdicts })}
					>
						<img src={bossImage(field.boss, 'icon')} alt="" />
						<span class="bv-boss-zoom" aria-hidden="true"><Mark name="search" size={12} /></span>
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
						<div class="bv-slots">
							{#each team.slots as id, i (i)}
								{@const sel = isSelected(team.id, i)}
								{@const entry = id ? getCharacterIndexEntry(id) : undefined}
								<div class="bv-slot-wrap">
									<button
										class="bv-slot"
										data-name={entry?.displayName ?? ''}
										aria-pressed={sel}
										aria-label={entry
											? `${entry.displayName}, team ${t + 1} slot ${i + 1}`
											: `Empty, team ${t + 1} slot ${i + 1}`}
										onclick={() => onSelect(sel ? null : { teamId: team.id, index: i })}
									>
										<SidePortrait
											{id}
											size={BOARD_PORTRAIT}
											con={id ? facts.conOf(id) : undefined}
											ownedCon={id ? ownedConOf(id) : undefined}
											selected={sel}
										/>
									</button>
									{#if id}
										<button
											class="bv-slot-clear"
											onclick={() => onEmpty({ teamId: team.id, index: i })}
											aria-label="Take {entry?.displayName ?? id} off team {t + 1}"
											><Mark name="close" size={10} /></button
										>
									{/if}
								</div>
							{/each}
						</div>
						{#if filled}
							<div class="bv-side">
								<CompositionChips ids={team.slots} reactions={false} />
								<!-- ⚓ A team's rotations are DERIVED from the library by its set;
								     a pin names the one you would play here (§10.2). -->
								{#if rotations.length === 0}
									<span class="bv-rotations"><Mark name="pin" size={12} /> No saved rotation</span>
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
													{#if r}{r.name}{:else}<span class="bv-menu-quiet">None pinned</span>{/if}
												</button>
											{/each}
										{/snippet}
									</BandMenu>
								{/if}
							</div>
						{/if}
					</div>
					{#if facts.fingerprint}<Fingerprint clusters={facts.fingerprint} />{/if}
				</div>
			</div>
		</section>
	{/each}
	{#if board.teams.length < BOARD_TEAM_LIMIT}
		<button class="btn bv-add-team" onclick={onAddTeam}><Mark name="plus" /> Add team</button>
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
	.bv {
		display: flex;
		flex-direction: column;
		gap: 1rem;
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
		gap: 0.75rem;
	}
	.bv-team-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.6rem 0.5rem 1rem;
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
	/* One run of TEXT, not flex items, so a long name wraps word by word
	   instead of dropping whole beneath the number. */
	.bv-head-title {
		margin: 0;
		font-size: inherit;
		line-height: 1.4;
	}
	/* The kicker's voice without its rule — it leads a line here. */
	.bv-head-n {
		display: inline;
		margin-right: 0.35em;
		font-size: var(--fs-md);
	}
	.bv-head-n::after {
		content: none;
	}
	.bv-team-actions {
		flex: none;
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.bv-boss-name {
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-widest);
		text-transform: uppercase;
		color: var(--accent);
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
		gap: 1rem;
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
		gap: 0.7rem;
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
		border: 2px solid var(--line-strong);
		border-radius: var(--r-round);
		background: var(--surface-well);
		cursor: pointer;
		transition: box-shadow var(--t-snap);
	}
	.bv-boss img {
		width: 100%;
		height: 100%;
		border-radius: var(--r-round);
		object-fit: cover;
	}
	.bv-boss:hover {
		box-shadow: 0 0 0 2px var(--sel-ring);
	}
	.bv-boss-zoom {
		position: absolute;
		top: -3px;
		right: -3px;
		width: 22px;
		height: 22px;
		display: grid;
		place-items: center;
		border-radius: var(--r-round);
		background: var(--btn-face, var(--surface-raised));
		color: var(--text);
	}

	/* ── The lineup ── */
	.bv-slots {
		display: flex;
		gap: 18px; /* Nate 2026-10-09 */
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
		width: 56px;
	}
	/* The slot is a bare hit area around the portrait, which draws its own
	   ring, selection and empty state. Hover lifts the ring to ink. */
	.bv-slot {
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		border-radius: var(--r-round);
	}
	.bv-slot:hover :global(.spt-disc:not(.spt-disc--selected)) {
		box-shadow: 0 0 0 1px var(--glass-ring);
	}
	/* The remove control appears with the slot's hover (or keyboard focus), so
	   four resting ✕s do not crowd the portraits. */
	.bv-slot-clear {
		position: absolute;
		top: 0;
		right: 0;
		width: 18px;
		height: 18px;
		display: grid;
		place-items: center;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: var(--btn-face, var(--surface-raised));
		color: var(--muted);
		cursor: pointer;
		visibility: hidden;
	}
	.bv-slot-wrap:hover .bv-slot-clear,
	.bv-slot-clear:focus-visible {
		visibility: visible;
	}
	.bv-slot-clear:hover {
		color: var(--text);
	}
	.bv-rotations {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.bv-add-team {
		align-self: flex-start;
	}
</style>
