<script lang="ts">
	/**
	 * THE BOARD PANE — the right half of the split screen (lineups design §2.4,
	 * build step 3). A board stacks its TEAMS vertically, each a row (§3).
	 *
	 * ⚠ Step 3's rows are PLAIN on purpose: four slots, a label, Open in
	 * Planner. The composition chips, the fingerprint, the overhanging 64px
	 * portraits, "N rotations" and the pin are step 5, and swap mode (what a
	 * selected slot opens in the roster pane) is step 6. Until then a selected
	 * slot is where the roster's next pick lands.
	 */
	import Mark from '$lib/components/Mark.svelte';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { getAvatarFallback, hasAvatar } from '$lib/utils/getAvatar';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { BOARD_TEAM_LIMIT, type Board, type BoardTeam } from '$lib/boards.svelte';
	import type { TravelerVariant } from '$lib/utils/getAvatar';

	export type SlotRef = { teamId: string; index: number };

	let {
		board,
		traveler,
		selected,
		onSelect,
		onEmpty,
		onAddTeam,
		onRemoveTeam,
		onOpenInPlanner
	}: {
		board: Board;
		traveler: TravelerVariant;
		selected: SlotRef | null;
		onSelect: (slot: SlotRef | null) => void;
		onEmpty: (slot: SlotRef) => void;
		onAddTeam: () => void;
		onRemoveTeam: (teamId: string) => void;
		onOpenInPlanner: (team: BoardTeam) => void;
	} = $props();

	const elColor = (id: string) => {
		const el = getCharacterIndexEntry(id)?.element ?? 'none';
		return (elementColors[el as ElementKey] ?? elementColors.none).main;
	};

	const isSelected = (teamId: string, index: number) =>
		selected?.teamId === teamId && selected.index === index;
</script>

<div class="bv">
	{#each board.teams as team, t (team.id)}
		{@const filled = team.slots.some((s) => s !== null)}
		<section class="bv-team" aria-label="Team {t + 1}">
			<header class="bv-team-head">
				<span class="bv-team-name">Team {t + 1}</span>
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
			<div class="bv-slots">
				{#each team.slots as id, i (i)}
					{@const sel = isSelected(team.id, i)}
					{@const entry = id ? getCharacterIndexEntry(id) : undefined}
					<div class="bv-slot-wrap">
						<button
							class="bv-slot ctx-dark"
							class:bv-slot--empty={!id}
							class:bv-slot--selected={sel}
							style:--el-color={id ? elColor(id) : undefined}
							aria-pressed={sel}
							aria-label={entry
								? `${entry.displayName}, team ${t + 1} slot ${i + 1}`
								: `Empty, team ${t + 1} slot ${i + 1}`}
							onclick={() => onSelect(sel ? null : { teamId: team.id, index: i })}
						>
							{#if id && hasAvatar(id)}
								<img src={getAvatarFallback(id, 'circle', traveler)} alt="" />
							{:else if id}
								<span class="bv-initials">{(entry?.displayName ?? id).slice(0, 2)}</span>
							{:else}
								<Mark name="plus" size={16} />
							{/if}
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
		</section>
	{/each}
	{#if board.teams.length < BOARD_TEAM_LIMIT}
		<button class="btn bv-add-team" onclick={onAddTeam}><Mark name="plus" /> Add team</button>
	{/if}
</div>

<style>
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
	/* The step-3 disc: the circle-trimmed portrait on its element ring. Step 5
	   replaces it with the 64px overhanging side portrait (§9.5a). */
	.bv-slot {
		width: 64px;
		height: 64px;
		padding: 0;
		border: 2px solid color-mix(in srgb, var(--el-color, var(--border)) 70%, transparent);
		border-radius: 50%;
		background: var(--surface);
		color: var(--muted);
		display: grid;
		place-items: center;
		overflow: hidden;
		cursor: pointer;
		transition:
			border-color var(--t-snap),
			box-shadow var(--t-snap);
	}
	.bv-slot img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.bv-slot--empty {
		border-style: dashed;
		border-color: var(--border);
	}
	.bv-slot:hover {
		box-shadow: 0 0 0 1px var(--glass-ring);
	}
	/* Selected: the gold ring — "chosen", the site's one meaning for it. */
	.bv-slot--selected,
	.bv-slot--selected:hover {
		box-shadow: 0 0 0 2px var(--sel-ring);
	}
	.bv-initials {
		font-weight: var(--fw-semibold);
		color: var(--text);
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
