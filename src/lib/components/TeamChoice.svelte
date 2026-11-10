<!--
  A saved team as a menu row's contents: its four side portraits in element
  rings, overlapping, then its name, and a check at the end when it is the
  chosen one (⚓ Nate 2026-11-10). The faces are what set a team apart from a
  menu's plain verbs, on the Planner's bench and the Builder's row alike. The
  host supplies the `.band-menu-item` this sits in.

  ⚓ A row is as tall as the discs: hair rises out of the row, and under the
  row above, so `order` (the row's index) stacks earlier rows on top.
-->
<script lang="ts">
	import { rotationLabel } from '$lib/storage/convert';
	import type { TeamRecord } from '$lib/storage/records';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { elementPalette } from '$lib/utils/elementColors';
	import SidePortrait from './SidePortrait.svelte';
	import Mark from './Mark.svelte';

	/** 🎛️ Each portrait's disc, px. The overlap is `--tc-overlap` below. */
	const FACE = 28;
	/** Above any row count a menu will hold. */
	const STACK_TOP = 1000;

	let {
		team,
		order,
		checked = false
	}: { team: TeamRecord; order: number; checked?: boolean } = $props();

	const ring = (id: string | null) =>
		id ? elementPalette(getCharacterIndexEntry(id)?.element).main : undefined;
</script>

<span class="tc-faces" aria-hidden="true" style:z-index={STACK_TOP - order}>
	{#each team.slots as id, i (i)}
		<span class="tc-face" style:--spt-ring={ring(id)} style:height="{FACE}px"
			><SidePortrait {id} size={FACE} /></span
		>
	{/each}
</span>
<span class="tc-name">{team.name || rotationLabel(team.slots)}</span>
{#if checked}<span class="tc-check"><Mark name="check" size={12} /></span>{/if}

<style>
	.tc-faces {
		position: relative;
		flex: none;
		display: flex;
		/* 🎛️ How far each portrait overlaps the one before. */
		--tc-overlap: 6px;
	}
	/* As tall as the disc: the portrait's box stands on its bottom, so the
	   overhang spills upward and adds nothing to the row. */
	.tc-face {
		flex: none;
		display: flex;
		align-items: flex-end;
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
