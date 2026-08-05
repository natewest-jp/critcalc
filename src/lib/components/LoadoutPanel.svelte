<script lang="ts">
	/**
	 * LoadoutPanel — the whole build in one popout: artifact set, weapon, and
	 * refinement, chosen from one surface instead of the three separate menus
	 * this replaces (two searchable dropdowns + a refinement pip row).
	 *
	 * The corpus is small enough that lists would be the wrong form — 7 artifact
	 * sets and at most 3 weapons of any one type — so each section is an icon
	 * grid with a caption naming the current pick. No search, no scroll.
	 *
	 * Purely presentational, like its host: it renders the resolved loadout it's
	 * handed and reports every edit through callbacks, so the caller decides
	 * which layer the write lands in.
	 */
	import type { LoadoutEntry } from '$lib/stores';
	import { getAllArtifactSets, artifactImagePath } from '$lib/data/artifactLookup';
	import { getWeaponsByType, getAllWeapons, weaponImagePath } from '$lib/data/weaponLookup';
	import type { WeaponType } from '$lib/types/weapon';
	import { GENERIC_ARTIFACT_ICON, weaponTypeIcon } from '$lib/utils/loadoutIcons';

	/** Which section the pill zone that opened us should lead with. */
	export type LoadoutSection = 'artifact' | 'weapon' | 'refinement';

	let {
		loadoutEntry,
		weaponType,
		elementColor,
		section = 'artifact',
		onSetArtifact,
		onSetWeapon,
		onSetRefinement
	}: {
		loadoutEntry: LoadoutEntry;
		/** The slot character's weapon type. 'blank' (the generic placeholder) has
		 *  none, so it may equip anything — see `weaponItems`. */
		weaponType: string | undefined;
		elementColor: string;
		section?: LoadoutSection;
		onSetArtifact: (artifactSetId: string | undefined) => void;
		onSetWeapon: (weaponId: string | undefined, refinement: 1 | 2 | 3 | 4 | 5) => void;
		onSetRefinement: (r: 1 | 2 | 3 | 4 | 5) => void;
	} = $props();

	const artifactSets = getAllArtifactSets();

	// Blank has no weapon type, so it offers EVERY authored weapon — users can
	// sketch "a generic character running Sacrificial / TTDS / …" regardless of
	// type. A real character is held to its own type, which for polearm users is
	// currently an empty list (no polearm is authored yet).
	const weapons = $derived(
		weaponType === undefined || weaponType === 'blank'
			? getAllWeapons()
			: getWeaponsByType(weaponType as WeaponType)
	);

	const currentRef = $derived((loadoutEntry?.weaponRefinement ?? 1) as 1 | 2 | 3 | 4 | 5);
	const currentArtifact = $derived(
		artifactSets.find((a) => a.id === loadoutEntry?.artifactSetId) ?? null
	);
	const currentWeapon = $derived(weapons.find((w) => w.id === loadoutEntry?.weaponId) ?? null);

	// The generic icons double as the "none" tile — the same dimmed art the
	// unset pill zone shows, so clearing a slot returns it to a shape the user
	// has already seen.
	const noneWeaponIcon = $derived(weaponTypeIcon(weaponType));
</script>

<div class="lp" style:--el={elementColor}>
	<section class="lp-section" class:lp-section--lead={section === 'artifact'}>
		<h3 class="lp-hd">
			<span class="lp-hd-key">Artifact set:</span>
			{currentArtifact?.name ?? 'None'}
		</h3>
		<div class="lp-grid">
			<button
				class="lp-tile lp-tile--none"
				class:lp-tile--current={!currentArtifact}
				title="No artifact set"
				aria-label="No artifact set"
				aria-pressed={!currentArtifact}
				onclick={() => onSetArtifact(undefined)}
			>
				<img class="lp-tile-img" src={GENERIC_ARTIFACT_ICON} alt="" />
			</button>
			{#each artifactSets as set (set.id)}
				<button
					class="lp-tile"
					class:lp-tile--current={currentArtifact?.id === set.id}
					title={set.name}
					aria-label={set.name}
					aria-pressed={currentArtifact?.id === set.id}
					onclick={() => onSetArtifact(set.id)}
				>
					<img class="lp-tile-img" src={artifactImagePath(set.id)} alt="" />
				</button>
			{/each}
		</div>
	</section>

	<section class="lp-section" class:lp-section--lead={section === 'weapon'}>
		<h3 class="lp-hd">
			<span class="lp-hd-key">Weapon:</span>
			{currentWeapon?.name ?? 'None'}
		</h3>
		{#if weapons.length === 0}
			<p class="lp-empty">No {weaponType}-type weapons are curated yet.</p>
		{:else}
			<div class="lp-grid">
				<button
					class="lp-tile lp-tile--none"
					class:lp-tile--current={!currentWeapon}
					title="No weapon"
					aria-label="No weapon"
					aria-pressed={!currentWeapon}
					onclick={() => onSetWeapon(undefined, currentRef)}
				>
					<img class="lp-tile-img" src={noneWeaponIcon} alt="" />
				</button>
				{#each weapons as weapon (weapon.id)}
					<button
						class="lp-tile"
						class:lp-tile--current={currentWeapon?.id === weapon.id}
						title={weapon.name}
						aria-label={weapon.name}
						aria-pressed={currentWeapon?.id === weapon.id}
						onclick={() => onSetWeapon(weapon.id, currentRef)}
					>
						<img class="lp-tile-img" src={weaponImagePath(weapon.id)} alt="" />
					</button>
				{/each}
			</div>
		{/if}
	</section>

	<section class="lp-section" class:lp-section--lead={section === 'refinement'}>
		<h3 class="lp-hd"><span class="lp-hd-key">Refinement</span></h3>
		<div class="lp-pips">
			{#each [1, 2, 3, 4, 5] as r (r)}
				<button
					class="lp-pip"
					class:lp-pip--filled={r <= currentRef}
					class:lp-pip--current={r === currentRef}
					aria-pressed={r === currentRef}
					onclick={() => onSetRefinement(r as 1 | 2 | 3 | 4 | 5)}>R{r}</button
				>
			{/each}
		</div>
	</section>
</div>

<style>
	/* One panel, three stacked sections. Sized by its content: at 7 artifact
	   sets + a none tile the grid is 4 across and two rows deep, and no section
	   ever needs to scroll. */
	.lp {
		width: 202px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.lp-section {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	/* The heading carries the current selection inline — "Artifact set: Noblesse
	   Oblige" — rather than captioning the grid underneath it. One line per
	   section instead of two, and the label sits where you look before choosing
	   rather than after. Long names wrap under the key; nothing truncates. */
	.lp-hd {
		margin: 0;
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		color: var(--text);
		letter-spacing: var(--ls-tight);
		line-height: var(--lh-tight);
	}
	/* The pill zone that opened the panel leads — a quiet emphasis, since all
	   three sections are visible and none is hidden behind a step. */
	.lp-hd-key {
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}
	.lp-section--lead .lp-hd-key {
		color: var(--text);
	}

	.lp-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 4px;
	}

	.lp-tile {
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		padding: 2px;
		border: none;
		border-radius: var(--r-sm);
		background: var(--fill-rest);
		cursor: pointer;
		transition:
			background 150ms ease,
			box-shadow 150ms ease;
	}
	.lp-tile:hover {
		background: var(--fill-hover);
	}
	.lp-tile--current {
		background: color-mix(in srgb, var(--el) 20%, transparent);
		box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--el) 60%, transparent);
	}
	.lp-tile-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	/* The generic art reads as "nothing equipped", not as a set you could pick. */
	.lp-tile--none .lp-tile-img {
		opacity: 0.4;
	}
	.lp-tile--none.lp-tile--current .lp-tile-img {
		opacity: 0.6;
	}

	.lp-empty {
		margin: 0;
		font-size: var(--fs-2xs);
		font-style: italic;
		color: var(--muted);
		line-height: var(--lh-tight);
	}

	/* ── Refinement pips ──────────────────────────────────────────────────────
	   The same pip language as the constellation picker in SlotPortrait. */
	.lp-pips {
		display: flex;
		gap: 4px;
	}
	.lp-pip {
		flex: 1;
		height: 24px;
		border-radius: var(--r-sm);
		border: none;
		background: var(--fill-rest);
		color: var(--muted);
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-mid);
		cursor: pointer;
		display: grid;
		place-items: center;
		padding: 0;
		transition:
			background 150ms ease,
			box-shadow 150ms ease,
			color 150ms ease;
	}
	.lp-pip--filled {
		background: color-mix(in srgb, var(--el) 22%, transparent);
		color: var(--el);
	}
	.lp-pip--current {
		background: color-mix(in srgb, var(--el) 30%, transparent);
		box-shadow: inset 0 0 0 1.5px var(--el);
	}
	.lp-pip:hover {
		background: var(--fill-hover);
		color: var(--el, var(--text));
	}
</style>
