<!--
  A TEAM MEMBER'S LOADOUT, in Teams' details (⚓ Nate 2026-10-24: a weapon
  and an artifact set are a team decision; storage/teamLoadout.ts). Two
  plates under the member's portrait — the artifact set, then the weapon with
  its refinement — either of which opens the bench's LoadoutPanel beside it.

  ↻ 2026-10-25: this was the bench's upright pill, display-only on the Teams
  cards, which show the loadout as pips on the portrait now
  (TeamMemberPortrait); choosing moved here, into the team's details, as the
  loadouts round planned.

  The rotations of this team inherit what is chosen here, live.
-->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import LoadoutPanel from './LoadoutPanel.svelte';
	import { portal } from '$lib/actions/portal';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import { closeOnLeave } from '$lib/closeOnLeave';
	import type { LoadoutEntry } from '$lib/stores';
	import { getArtifactSetById, artifactImagePath } from '$lib/data/artifactLookup';
	import { getWeaponById, weaponImagePath } from '$lib/data/weaponLookup';
	import { GENERIC_ARTIFACT_ICON, weaponTypeIcon } from '$lib/utils/loadoutIcons';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { elementPalette } from '$lib/utils/elementColors';

	let {
		charId,
		entry,
		onSet,
		iconsOnly = false
	}: {
		charId: string;
		entry: LoadoutEntry;
		/** A part changed; `undefined` clears it. */
		onSet: (update: Partial<LoadoutEntry>) => void;
		/** A column too narrow for the names: the plates keep their icons (and
		 *  the weapon its refinement), and the names live in the titles. */
		iconsOnly?: boolean;
	} = $props();

	const char = $derived(getCharacterIndexEntry(charId));
	const p = $derived(elementPalette(char?.element));
	const ref = $derived(entry.weaponRefinement ?? 1);
	// Checked against the lists, as the bench's pill is: a stored id can
	// outlive its set.
	const artifact = $derived(
		entry.artifactSetId ? getArtifactSetById(entry.artifactSetId) : undefined
	);
	const weapon = $derived(entry.weaponId ? getWeaponById(entry.weaponId) : undefined);

	// ── The panel: beside the plates, clamped inside the screen ────────────
	const GAP = 8;
	let open = $state(false);
	let x = $state(0);
	let y = $state(0);
	let anchor = $state<DOMRect | null>(null);
	let panelEl = $state<HTMLDivElement | undefined>();
	let platesEl = $state<HTMLDivElement | undefined>();

	$effect(() => {
		if (!panelEl || !anchor) return;
		const vw = document.documentElement.clientWidth;
		const vh = document.documentElement.clientHeight;
		const w = panelEl.offsetWidth;
		const h = panelEl.offsetHeight;
		let nx = anchor.right + GAP;
		if (nx + w + GAP > vw) nx = anchor.left - GAP - w;
		x = Math.max(GAP, Math.min(nx, vw - w - GAP));
		const cy = anchor.top + anchor.height / 2;
		y = Math.max(GAP, Math.min(cy - h / 2, vh - GAP - h));
		panelEl.focus();
	});

	function toggle(): void {
		if (open) return close();
		if (!platesEl) return;
		anchor = platesEl.getBoundingClientRect();
		open = true;
	}
	function close(): void {
		open = false;
	}
	/** Escape closes the panel and is spent here, so the details under it
	 *  stay open (they skip a defaultPrevented Escape). */
	function onKey(e: KeyboardEvent): void {
		if (e.key !== 'Escape') return;
		e.preventDefault();
		close();
	}
	closeOnLeave(() => open, close);
</script>

<div class="tlp" class:is-icons={iconsOnly} bind:this={platesEl} style:--el={p.main}>
	<button
		class="tlp-plate"
		class:is-unset={!artifact}
		title={artifact?.name ?? 'Artifact set'}
		aria-expanded={open}
		aria-label="{char?.displayName ?? charId}: artifact set, {artifact?.name ?? 'none'}"
		onclick={toggle}
	>
		<img
			src={artifact && entry.artifactSetId
				? artifactImagePath(entry.artifactSetId)
				: GENERIC_ARTIFACT_ICON}
			alt=""
		/>
		<span class="tlp-name">{artifact?.name ?? 'Artifact set'}</span>
	</button>
	<button
		class="tlp-plate"
		class:is-unset={!weapon}
		title={weapon ? `${weapon.name} R${ref}` : 'Weapon'}
		aria-expanded={open}
		aria-label="{char?.displayName ?? charId}: weapon, {weapon ? `${weapon.name} R${ref}` : 'none'}"
		onclick={toggle}
	>
		<img
			src={weapon && entry.weaponId
				? weaponImagePath(entry.weaponId)
				: weaponTypeIcon(char?.weapon)}
			alt=""
		/>
		<span class="tlp-name">{weapon?.name ?? 'Weapon'}</span>
		{#if weapon}<span class="tlp-ref">R{ref}</span>{/if}
	</button>
</div>

{#if open}
	<div
		class="tlp-backdrop"
		role="button"
		tabindex="-1"
		aria-label="Close the loadout popover"
		use:portal
		transition:fade={{ duration: motion(T_QUICK) }}
		onintrostart={introLive}
		onoutrostart={outroInert}
		onclick={close}
		onkeydown={onKey}
	></div>
	<div
		class="tlp-panel ctx-dark"
		bind:this={panelEl}
		use:portal
		role="dialog"
		aria-label="Artifact set and weapon"
		tabindex="-1"
		transition:fade={{ duration: motion(T_QUICK) }}
		onintrostart={introLive}
		onoutrostart={outroInert}
		onkeydown={onKey}
		style:left="{x}px"
		style:top="{y}px"
	>
		<LoadoutPanel
			loadoutEntry={entry}
			weaponType={char?.weapon}
			elementColor={p.main}
			onSetArtifact={(id) => onSet({ artifactSetId: id })}
			onSetWeapon={(id, r) => onSet({ weaponId: id, weaponRefinement: id ? r : undefined })}
			onSetRefinement={(r) => onSet({ weaponRefinement: r })}
		/>
	</div>
{/if}

<style>
	.tlp {
		display: grid;
		gap: 3px;
		width: 100%;
	}
	.tlp-plate {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		min-width: 0;
		height: 28px;
		padding: 0 0.45rem 0 0.2rem;
		border: none;
		border-radius: var(--r-sm);
		background: var(--plate-ground, var(--surface-raised));
		color: var(--text);
		font: inherit;
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
		transition:
			background-color var(--t-snap),
			color var(--t-snap);
	}
	.tlp-plate:hover {
		background: var(--plate-hover, var(--surface-hover));
	}
	.tlp-plate img {
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		object-fit: contain;
	}
	/* Nothing chosen: the part's generic icon and its name, receding, the
	   icon faded as an unowned portrait is. */
	.tlp-plate.is-unset {
		color: var(--muted);
	}
	.tlp-plate.is-unset img {
		filter: var(--portrait-unowned);
	}
	.tlp-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tlp-ref {
		flex-shrink: 0;
		color: color-mix(in srgb, var(--el) 75%, white);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		font-variant-numeric: tabular-nums;
	}

	/* Too narrow for the names (the caller measures its column): a name cut
	   to a stub says nothing, so the icons stand alone. */
	.is-icons .tlp-plate {
		justify-content: center;
		padding: 0 0.2rem;
	}
	.is-icons .tlp-name {
		display: none;
	}

	.tlp-backdrop {
		position: fixed;
		inset: 0;
		z-index: 949;
	}
	/* The bench's loadout popover (SlotPortrait `.sp-popover--panel`). */
	.tlp-panel {
		position: fixed;
		z-index: 950;
		max-height: calc(100vh - 16px);
		overflow-y: auto;
		padding: 10px 11px;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
		outline: none;
	}
</style>
