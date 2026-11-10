<!--
  A saved team as a menu row's contents: its four faces, overlapping, then its
  name (⚓ Nate 2026-11-10). The faces are what set a team apart from a menu's
  plain verbs, on the Planner's bench and the Builder's row alike. The host
  supplies the `.band-menu-item` this sits in.
-->
<script lang="ts">
	import { storageSession } from '$lib/storage/session.svelte';
	import { rotationLabel } from '$lib/storage/convert';
	import type { TeamRecord } from '$lib/storage/records';
	import { getAvatar, hasAvatar } from '$lib/utils/getAvatar';
	import { siteSettings } from '$lib/stores';
	import Mark from './Mark.svelte';

	let { team, checked = false }: { team: TeamRecord; checked?: boolean } = $props();

	const twin = $derived(storageSession.profile?.twin ?? 'aether');
	const src = (id: string) =>
		hasAvatar(id) ? getAvatar(id, $siteSettings.useNewOutfits, 'circle', twin) : null;
</script>

<span class="tc-check"
	>{#if checked}<Mark name="check" size={12} />{/if}</span
>
<span class="tc-faces" aria-hidden="true">
	{#each team.slots as id, i (i)}
		{@const url = id ? src(id) : null}
		<span class="tc-face"
			>{#if url}<img src={url} alt="" loading="lazy" />{/if}</span
		>
	{/each}
</span>
<span class="tc-name">{team.name || rotationLabel(team.slots)}</span>

<style>
	.tc-check {
		flex: none;
		width: 12px;
		display: grid;
		place-items: center;
	}
	.tc-faces {
		flex: none;
		display: flex;
		/* 🎛️ The face size and how far each overlaps the one before. */
		--tc-face: 26px;
		--tc-overlap: 8px;
	}
	.tc-face {
		width: var(--tc-face);
		height: var(--tc-face);
		border: 1px solid var(--line-faint);
		border-radius: var(--r-round);
		background: var(--surface-well);
		overflow: hidden;
		box-sizing: border-box;
	}
	.tc-face + .tc-face {
		margin-left: calc(-1 * var(--tc-overlap));
	}
	.tc-face img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.tc-name {
		min-width: 0;
		max-width: 16rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
