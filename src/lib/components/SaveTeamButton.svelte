<!--
  SAVE AS TEAM, on the Planner's bench (design §3, §9.5; build plan §13,
  phase 3). ⚓ Nate 2026-10-23: one click files the seated four as a team,
  named by its members until you rename it in Teams; only with all four slots
  filled. ⚓ Nate 2026-11-10: four that are already a team offer that team, and
  a way to make a second; four that are several teams, with no link, ask which.

  Loaded by the bench on demand, so the storage session stays out of the
  bench's bundle. Real profiles only (§2.2): Theorycraft has no teams.
  Strings are working copy.
-->
<script lang="ts">
	import Mark from './Mark.svelte';
	import BandMenu from './BandMenu.svelte';
	import TeamChoice from './TeamChoice.svelte';
	import { rotationTabs as rt } from '$lib/rotationTabs.svelte';
	import { storageSession } from '$lib/storage/session.svelte';
	import type { TeamRecord } from '$lib/storage/records';
	import { menu } from '$lib/menuState.svelte';
	import { resolveEntry, teamsOfSlots } from '$lib/storage/teamLoadout';

	/** The folded phone bench's rail: the mark alone, the words in its title. */
	let { compact = false }: { compact?: boolean } = $props();

	const seats = $derived(rt.seats);
	const full = $derived(seats.every((id) => id !== null && id !== 'blank'));
	const real = $derived(storageSession.profile?.kind === 'real');

	/** Every team holding these four; `undefined` until the store has answered. */
	let matches = $state<TeamRecord[] | undefined>(undefined);
	$effect(() => {
		void storageSession.teamsVersion;
		const s = [...seats];
		if (!real || !full) {
			matches = undefined;
			return;
		}
		void storageSession.teams().then((all) => {
			if (s.every((id, i) => id === seats[i])) matches = teamsOfSlots(all, s);
		});
	});

	const current = $derived(matches?.find((t) => t.id === rt.team?.id));
	const label = $derived(
		current ? `In Teams${current.name ? ` · ${current.name}` : ''}` : 'Choose team'
	);

	/** ⚓ The new team starts with the rotation's loadout (Nate 2026-10-24),
	 *  and the rotation then inherits it rather than holding a copy, so the
	 *  next change to the team reaches it. */
	async function save(): Promise<void> {
		const ids = seats.filter((id): id is string => !!id);
		const lo = Object.fromEntries(
			ids.map((id) => [id, resolveEntry(rt.inheritedLoadout()[id], rt.tabLoadout[id])])
		);
		const team = await storageSession.saveTeam(seats, '', lo);
		if (!team) return;
		rt.linkTeam(team.id);
		for (const id of ids) rt.putTabLoadout(id, null);
	}

	function choose(t: TeamRecord): void {
		if (rt.canEdit()) rt.linkTeam(t.id);
	}
</script>

{#if real && full && matches !== undefined}
	<!-- ↻ 2026-10-24 (toolbar refinement, ⚓ Nate): PLATES, both of them. As
	     bare text "In Teams" did not read as pressable, and it is the door to
	     the team. The saved state keeps its check and recedes by INK, so the
	     request (Save as team) still outranks the fact. -->
	{#if matches.length}
		<span class="st-menu" class:st-menu--in={!!current} class:st-menu--icon={compact}>
			<BandMenu size="sm" align="start" {compact} ariaLabel={label}>
				{#snippet face()}
					{#if current}<Mark name="check" />{/if}
					{#if !compact}<span class="st-label">{label}</span>{/if}
				{/snippet}
				{#snippet items(close)}
					{#if matches && matches.length > 1}
						{#each matches as t, i (t.id)}
							<button
								class="band-menu-item"
								role="menuitemradio"
								aria-checked={t.id === current?.id}
								onclick={() => {
									close();
									choose(t);
								}}><TeamChoice team={t} order={i} checked={t.id === current?.id} /></button
							>
						{/each}
					{/if}
					<button
						class="band-menu-item"
						role="menuitem"
						onclick={() => {
							close();
							menu.show('teams');
						}}>Open Teams</button
					>
					<button
						class="band-menu-item"
						role="menuitem"
						onclick={() => {
							close();
							void save();
						}}>Save as a new team</button
					>
				{/snippet}
			</BandMenu>
		</span>
	{:else}
		<button
			class="btn btn--sm st"
			class:btn--icon={compact}
			onclick={save}
			title={compact ? 'Save as team' : undefined}
			aria-label={compact ? 'Save as team' : undefined}
		>
			<Mark name="plus" />
			{#if !compact}<span class="st-label">Save as team</span>{/if}
		</button>
	{/if}
{/if}

<style>
	.st {
		width: 100%;
		min-width: 0;
		color: var(--text);
	}
	.st.btn--icon {
		width: auto;
		flex-shrink: 0;
	}
	.st-menu {
		display: block;
		width: 100%;
		min-width: 0;
	}
	.st-menu--icon {
		width: auto;
		flex-shrink: 0;
	}
	.st-menu :global(.band-menu-trigger) {
		width: 100%;
		min-width: 0;
		color: var(--text);
	}
	/* Already a team: quiet, a fact rather than a request. */
	.st-menu--in :global(.band-menu-trigger) {
		color: var(--muted);
	}
	@media (hover: hover) {
		.st-menu--in :global(.band-menu-trigger:hover) {
			color: var(--text);
		}
	}
	.st-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
