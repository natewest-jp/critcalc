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

	/** 🎛️ The board's disc (the art rises above it; see `SIDE_ART_PER_DISC`). */
	const BOARD_PORTRAIT = 64;
	/** 🎛️ The boss avatar — a little larger than a member, as in the game. */
	const BOSS_DISC = 72;

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
			<label class="bv-season">
				<select
					aria-label="Season"
					value={season.version}
					onchange={(e) => onSeason(e.currentTarget.value)}
				>
					{#each seasons as s (s.version)}
						<option value={s.version}>{s.version} · {fmtDay(s.start)} – {fmtDay(s.end)}</option>
					{/each}
				</select>
			</label>
		</header>
	{:else if abyss}
		<header class="bv-lineup bv-lineup--abyss">
			<img class="bv-blessing-icon" src={blessingImage(abyss.icon)} alt="" />
			<span class="bv-blessing">
				<span class="bv-lineup-mode">Spiral Abyss · {inLang(abyss.name)}</span>
				<span class="bv-blessing-text">{inLang(abyss.text).replaceAll('**', '')}</span>
			</span>
		</header>
	{/if}

	{#each board.teams as team, t (team.id)}
		{@const filled = team.slots.some((s) => s !== null)}
		{@const facts = teamFacts(team)}
		{@const field = season?.battlefields[t]}
		{@const verdicts = field ? verdictsFor(field, facts.ids, facts.conOf) : undefined}
		{@const rotations = rotationsForTeam(team, $savedNotations)}
		{@const pin = pinnedRotation(team, $savedNotations)}
		<section class="bv-team" aria-label="Team {t + 1}">
			<header class="bv-team-head">
				<span class="bv-team-name">
					{#if field}Battlefield {t + 1}: {inLang(BOSSES[field.boss].name)}{:else}Team {t + 1}{/if}
				</span>
				<span class="bv-team-actions">
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

			<div class="bv-team-body" class:bv-team-body--field={!!field}>
				{#if field && season}
					<button
						class="bv-boss"
						style:--boss="{BOSS_DISC}px"
						aria-label="Details: {inLang(BOSSES[field.boss].name)}"
						onclick={() => (detail = { battlefield: field, season, index: t, verdicts })}
					>
						<img src={bossImage(field.boss, 'icon')} alt="" />
						<span class="bv-boss-zoom" aria-hidden="true"><Mark name="search" size={11} /></span>
					</button>
				{/if}

				<div class="bv-team-main">
					{#if field?.checks.length}
						<div class="bv-checks">
							{#each field.checks as c, i (i)}<CheckChip check={c} verdict={verdicts?.[i]} />{/each}
						</div>
					{/if}

					<div class="bv-row">
						<div class="bv-slots">
							{#each team.slots as id, i (i)}
								{@const sel = isSelected(team.id, i)}
								{@const entry = id ? getCharacterIndexEntry(id) : undefined}
								<div class="bv-slot-wrap">
									<button
										class="bv-slot"
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
									<span class="bv-slot-name">{entry?.displayName ?? ''}</span>
								</div>
							{/each}
						</div>

						{#if filled}
							<div class="bv-meta">
								<CompositionChips ids={team.slots} reactions={false} />
								{#if facts.fingerprint}<Fingerprint clusters={facts.fingerprint} />{/if}
								<!-- ⚓ A team's rotations are DERIVED from the library by its set;
								     a pin names the one you would play here (§10.2). -->
								<span class="bv-rotations">
									{#if rotations.length === 0}
										<span class="bv-muted">No saved rotation</span>
									{:else}
										<Mark name="pin" size={11} />
										<select
											aria-label="Pinned rotation for team {t + 1}"
											value={pin?.id ?? ''}
											onchange={(e) => onPin(team.id, e.currentTarget.value || null)}
										>
											<option value=""
												>{rotations.length === 1
													? '1 rotation — not pinned'
													: `${rotations.length} rotations — not pinned`}</option
											>
											{#each rotations as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
										</select>
									{/if}
								</span>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</section>
	{/each}
	{#if board.teams.length < BOARD_TEAM_LIMIT}
		<button class="btn bv-add-team" onclick={onAddTeam}><Mark name="plus" /> Add team</button>
	{/if}
</div>

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
	/* ── The lineup's header: a Stygian season, or the Abyss blessing ── */
	.bv-lineup {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding-bottom: 0.25rem;
	}
	.bv-lineup-mode {
		font-family: var(--font-display);
		font-weight: var(--fw-semibold);
		font-size: var(--fs-2xl);
	}
	.bv-season select,
	.bv-rotations select {
		font: inherit;
		font-size: var(--fs-sm);
		color: var(--text);
		background: var(--surface-well);
		border: none;
		border-radius: var(--r-sm, 3px);
		padding: 3px 6px;
		max-width: 100%;
	}
	.bv-lineup--abyss {
		align-items: flex-start;
	}
	.bv-blessing-icon {
		width: 40px;
		height: 40px;
	}
	.bv-blessing {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.bv-blessing-text {
		font-size: var(--fs-sm);
		color: var(--muted);
	}

	/* ── A team: the boss (on a battlefield), then checks over the row ── */
	.bv-team-body {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}
	.bv-team-body--field {
		padding-left: 0.25rem;
	}
	.bv-team-main {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		min-width: 0;
		flex: 1;
	}
	.bv-checks {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.bv-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 1.25rem;
		align-items: flex-end;
	}
	.bv-meta {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
		padding-bottom: 1.4rem;
	}
	.bv-rotations {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.bv-muted {
		color: var(--muted);
	}

	/* The boss: a circle-cut avatar on the members' ring, a magnifier at its
	   top right (the game's), and the whole disc is the button. */
	.bv-boss {
		position: relative;
		flex: none;
		width: var(--boss);
		height: var(--boss);
		margin-top: 2.1rem;
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
		box-shadow: 0 0 0 1px var(--glass-ring);
	}
	.bv-boss-zoom {
		position: absolute;
		top: -2px;
		right: -2px;
		width: 22px;
		height: 22px;
		display: grid;
		place-items: center;
		border-radius: var(--r-round);
		background: var(--surface-raised);
		color: var(--text);
	}
	.bv {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0 0 1rem;
	}
	.bv-team {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.bv-team-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}
	.bv-team-name {
		font-family: var(--font-display);
		font-size: var(--fs-xl);
		color: var(--text);
	}
	.bv-team-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.bv-slots {
		display: flex;
		gap: 0.9rem;
		flex-wrap: wrap;
	}
	.bv-slot-wrap {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		width: 72px;
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
	.bv-slot-clear {
		position: absolute;
		top: -2px;
		right: 2px;
		width: 18px;
		height: 18px;
		display: grid;
		place-items: center;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: var(--surface);
		color: var(--muted);
		cursor: pointer;
	}
	.bv-slot-clear:hover {
		color: var(--text);
	}
	.bv-slot-name {
		font-size: var(--fs-sm);
		color: var(--muted);
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-height: 1.2em;
	}
	.bv-add-team {
		align-self: flex-start;
	}
</style>
