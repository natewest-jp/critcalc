<!--
  SAVE AS TEAM, on the Planner's bench (design §3, §9.5; build plan §13,
  phase 3). ⚓ Nate 2026-10-23: one click files the seated four as a team,
  named by its members until you rename it in Teams; only with all four slots
  filled; a set that is already a team says so quietly instead, and opens Teams.

  Loaded by the bench only under the switch, so the storage session stays out
  of the bench's bundle. Real profiles only (§2.2): Theorycraft has no teams.
  Strings are working copy.
-->
<script lang="ts">
	import Mark from './Mark.svelte';
	import { rotationTabs as rt } from '$lib/rotationTabs.svelte';
	import { storageSession } from '$lib/storage/session.svelte';
	import type { TeamRecord } from '$lib/storage/records';
	import { menu } from '$lib/menuState.svelte';
	import { loadout } from '$lib/stores';
	import { resolveEntry } from '$lib/storage/teamLoadout';

	/** The folded phone bench's rail: the mark alone, the words in its title. */
	let { compact = false }: { compact?: boolean } = $props();

	const seats = $derived(rt.seats);
	const full = $derived(seats.every((id) => id !== null && id !== 'blank'));
	const real = $derived(storageSession.profile?.kind === 'real');

	let team = $state<TeamRecord | null | undefined>(undefined);
	$effect(() => {
		void storageSession.teamsVersion;
		const s = [...seats];
		if (!real || !full) {
			team = undefined;
			return;
		}
		void storageSession.teamFor(s).then((t) => {
			if (s.every((id, i) => id === seats[i])) team = t ?? null;
		});
	});

	/** ⚓ The new team starts with the rotation's loadout (Nate 2026-10-24),
	 *  and the rotation then inherits it rather than holding a copy, so the
	 *  next change to the team reaches it. */
	async function save(): Promise<void> {
		const ids = seats.filter((id): id is string => !!id);
		const lo = Object.fromEntries(
			ids.map((id) => [id, resolveEntry(rt.inheritedLoadout($loadout)[id], rt.tabLoadout[id])])
		);
		const r = await storageSession.saveTeam(seats, '', lo);
		if (!r) return;
		team = r.team;
		if (r.created) for (const id of ids) rt.putTabLoadout(id, null);
	}
</script>

{#if real && full && team !== undefined}
	<!-- ↻ 2026-10-24 (toolbar refinement, ⚓ Nate): PLATES, both of them. As
	     bare text "In Teams" did not read as pressable, and it is the door to
	     the team. The saved state keeps its check and recedes by INK, so the
	     request (Save as team) still outranks the fact. -->
	{#if team}
		{@const label = `In Teams${team.name ? ` · ${team.name}` : ''}`}
		<button
			class="btn btn--sm st st--in"
			class:btn--icon={compact}
			onclick={() => menu.show('teams')}
			title={compact ? `${label} (open Teams)` : 'Open Teams'}
			aria-label={compact ? label : undefined}
		>
			<Mark name="check" />
			{#if !compact}<span class="st-label">{label}</span>{/if}
		</button>
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
	/* Already a team: quiet, a fact rather than a request. */
	.st--in {
		color: var(--muted);
	}
	@media (hover: hover) {
		.st--in:hover {
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
