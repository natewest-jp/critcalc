<!--
  A TEAM MEMBER'S LOADOUT, on a Teams card (⚓ Nate 2026-10-24: a weapon and
  an artifact set are a team decision; storage/teamLoadout.ts). The bench
  card's upright pill (SlotPortrait's `--one` form: ONE button, both icons,
  the refinement as a digit on the weapon's corner) under the member's
  portrait, opening the same LoadoutPanel.

  ⚓ Nate 2026-10-24: on the Teams OVERVIEW it is DISPLAY-ONLY (no `onSet`);
  choosing a loadout belongs to team SETUP, which gets its own design session
  and is where the editable form (with `onSet`) will live.

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
		onSet
	}: {
		charId: string;
		entry: LoadoutEntry;
		/** A part changed; `undefined` clears it. Omitted = display only. */
		onSet?: (update: Partial<LoadoutEntry>) => void;
	} = $props();

	const char = $derived(getCharacterIndexEntry(charId));
	const p = $derived(elementPalette(char?.element));
	const ref = $derived(entry.weaponRefinement ?? 1);
	const hasWeapon = $derived(!!entry.weaponId);
	// Checked against the set list, as the bench's pill is: a stored id can
	// outlive its set.
	const artifactIcon = $derived(
		entry.artifactSetId && getArtifactSetById(entry.artifactSetId)
			? artifactImagePath(entry.artifactSetId)
			: GENERIC_ARTIFACT_ICON
	);
	/** What a display-only pill says to a screen reader and on hover. */
	const summary = $derived(
		[
			`${char?.displayName ?? charId}:`,
			(entry.artifactSetId && getArtifactSetById(entry.artifactSetId)?.name) || 'no artifact set',
			'·',
			entry.weaponId
				? `${getWeaponById(entry.weaponId)?.name ?? entry.weaponId} R${ref}`
				: 'no weapon'
		].join(' ')
	);
	const weaponIcon = $derived(
		entry.weaponId ? weaponImagePath(entry.weaponId) : weaponTypeIcon(char?.weapon)
	);

	// ── The panel: beside the pill, clamped inside the screen ──────────────
	const GAP = 8;
	let open = $state(false);
	let x = $state(0);
	let y = $state(0);
	let anchor = $state<DOMRect | null>(null);
	let panelEl = $state<HTMLDivElement | undefined>();

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

	function toggle(e: MouseEvent): void {
		if (open) return close();
		anchor = (e.currentTarget as HTMLElement).getBoundingClientRect();
		open = true;
	}
	function close(): void {
		open = false;
	}
	/** Escape closes the panel and is spent here, so the menu state under it
	 *  stays open (it skips a defaultPrevented Escape). */
	function onKey(e: KeyboardEvent): void {
		if (e.key !== 'Escape') return;
		e.preventDefault();
		close();
	}
	closeOnLeave(() => open, close);
</script>

{#snippet zones()}
	<span class="tlp-zone" class:is-unset={!entry.artifactSetId}>
		<img src={artifactIcon} alt="" />
	</span>
	<span class="tlp-zone" class:is-unset={!hasWeapon}>
		<img src={weaponIcon} alt="" />
		{#if hasWeapon}<span class="tlp-ref" aria-hidden="true">{ref}</span>{/if}
	</span>
{/snippet}

{#if onSet}
	<button
		class="tlp"
		style:--el={p.main}
		onclick={toggle}
		title={hasWeapon ? `Artifact set and weapon · refinement ${ref}` : 'Artifact set and weapon'}
		aria-label={`${char?.displayName ?? charId}: choose artifact set and weapon`}
		aria-expanded={open}>{@render zones()}</button
	>
{:else}
	<span class="tlp tlp--static" style:--el={p.main} title={summary} role="img" aria-label={summary}
		>{@render zones()}</span
	>
{/if}

{#if open && onSet}
	<div
		class="tlp-backdrop"
		role="button"
		tabindex="-1"
		aria-label="Close picker"
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
	/* The bench's upright pill, at the bench's numbers (SlotPortrait
	   `.sp-loadout--one`): a flat well holding two 24px icons. */
	.tlp {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 1px;
		height: 26px;
		padding: 0 3px;
		border: none;
		border-radius: var(--r-round);
		background: var(--surface-well);
		cursor: pointer;
	}
	.tlp-zone {
		position: relative;
		display: grid;
		place-items: center;
		width: 24px;
		height: 100%;
		border-radius: var(--r-round);
	}
	.tlp-zone img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	/* The dim is a wash of the well's own colour in the PAINT, never element
	   opacity (the WebKit layer dance; SlotPortrait § Icon dimming), on the
	   same 15/0/60/35 ladder. */
	.tlp-zone::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: color-mix(in srgb, var(--surface-well) 15%, transparent);
		pointer-events: none;
	}
	.tlp:not(.tlp--static):hover .tlp-zone::after {
		background: transparent;
	}
	/* Display only: no hover, no pointer — it shows the team, it isn't a control. */
	.tlp--static {
		cursor: default;
	}
	.tlp-zone.is-unset::after {
		background: color-mix(in srgb, var(--surface-well) 60%, transparent);
	}
	.tlp:not(.tlp--static):hover .tlp-zone.is-unset::after {
		background: color-mix(in srgb, var(--surface-well) 35%, transparent);
	}
	.tlp-ref {
		position: absolute;
		z-index: 1;
		top: -1px;
		right: -1px;
		color: color-mix(in srgb, var(--el) 75%, white);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		line-height: var(--lh-none);
		pointer-events: none;
		text-shadow:
			0 0 3px var(--surface-well),
			0 1px 2px var(--surface-well);
	}
	.tlp:not(.tlp--static):hover .tlp-ref {
		color: var(--text);
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
