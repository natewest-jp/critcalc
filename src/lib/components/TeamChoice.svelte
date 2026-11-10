<!--
  A saved team as a menu row's contents: its four side portraits, overlapping,
  then its name, and a check at the end when it is the chosen one (⚓ Nate
  2026-11-10). The faces are what set a team apart from a menu's plain verbs,
  on the Planner's bench and the Builder's row alike. The host supplies the
  `.band-menu-item` this sits in.
-->
<script lang="ts">
	import { rotationLabel } from '$lib/storage/convert';
	import type { TeamRecord } from '$lib/storage/records';
	import SidePortrait from './SidePortrait.svelte';
	import Mark from './Mark.svelte';

	/** 🎛️ Each portrait's disc, px. The overlap is `--tc-overlap` below. */
	const FACE = 28;

	let { team, checked = false }: { team: TeamRecord; checked?: boolean } = $props();
</script>

<span class="tc-faces" aria-hidden="true">
	{#each team.slots as id, i (i)}
		<span class="tc-face"><SidePortrait {id} size={FACE} /></span>
	{/each}
</span>
<span class="tc-name">{team.name || rotationLabel(team.slots)}</span>
{#if checked}<span class="tc-check"><Mark name="check" size={12} /></span>{/if}

<style>
	.tc-faces {
		flex: none;
		display: flex;
		align-items: flex-end;
		/* 🎛️ How far each portrait overlaps the one before. */
		--tc-overlap: 6px;
	}
	.tc-face {
		flex: none;
	}
	.tc-face + .tc-face {
		margin-left: calc(-1 * var(--tc-overlap));
	}
	.tc-name {
		min-width: 0;
		max-width: 16rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tc-check {
		flex: none;
		margin-left: auto;
		padding-left: 0.5rem;
		display: grid;
		place-items: center;
	}
</style>
