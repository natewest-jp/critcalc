<!--
  A TEAM MEMBER, as Teams draws one (⚓ Nate 2026-10-25): the forward-facing
  portrait on the Roster's element well and ring, and what the team equips
  them with as CUTOUT PIPS round the bottom-right of the circle — the
  artifact set at the corner, the weapon (with its refinement) stacked above
  it along the circumference. Only what is equipped gets a pip; one alone
  takes the corner. Display only: the caller owns the click.

  The pips sit on discs of `--pip-ground`, which the caller sets to whatever
  the portrait stands on, so they read as cut out of it in every state.
-->
<script lang="ts">
	import Mark from './Mark.svelte';
	import type { LoadoutEntry } from '$lib/stores';
	import { getArtifactSetById, artifactImagePath } from '$lib/data/artifactLookup';
	import { getWeaponById, weaponImagePath } from '$lib/data/weaponLookup';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';

	let {
		src,
		charId,
		entry,
		size = 60,
		faded = false,
		selected = false
	}: {
		/** The portrait; null draws an empty seat. */
		src: string | null;
		charId: string | null;
		entry?: LoadoutEntry;
		/** The portrait's diameter, px. */
		size?: number;
		/** Not owned: the Roster's faded look. */
		faded?: boolean;
		/** The slot being filled (Teams' details). */
		selected?: boolean;
	} = $props();

	const char = $derived(charId ? getCharacterIndexEntry(charId) : undefined);
	const el = $derived(
		(elementColors[(char?.element ?? 'none') as ElementKey] ?? elementColors.none).main
	);

	const artifact = $derived(
		entry?.artifactSetId ? getArtifactSetById(entry.artifactSetId) : undefined
	);
	const weapon = $derived(entry?.weaponId ? getWeaponById(entry.weaponId) : undefined);
	const ref = $derived(entry?.weaponRefinement ?? 1);

	type Pip = { kind: 'artifact' | 'weapon'; img: string; title: string };
	const pips = $derived.by(() => {
		const out: Pip[] = [];
		if (artifact && entry?.artifactSetId)
			out.push({
				kind: 'artifact',
				img: artifactImagePath(entry.artifactSetId),
				title: artifact.name
			});
		if (weapon && entry?.weaponId)
			out.push({
				kind: 'weapon',
				img: weaponImagePath(entry.weaponId),
				title: `${weapon.name} R${ref}`
			});
		return out;
	});

	// ── The pips' places, on one circle round the portrait's centre ─────────
	// The first sits where the Roster's corner discs do (the box's corner, a
	// pixel out), and each next one turns up the circle by its own width and a
	// hairline, so they touch the ring the same way at every size.
	const pip = $derived(size >= 80 ? 22 : 18);
	const GAP = 2;
	const place = $derived.by(() => {
		const r = size / 2;
		const d = Math.SQRT2 * (r + 1 - pip / 2);
		const step = 2 * Math.asin((pip / 2 + GAP / 2) / d);
		return pips.map((_, i) => {
			const a = Math.PI / 4 - i * step;
			return { left: r + d * Math.cos(a) - pip / 2, top: r + d * Math.sin(a) - pip / 2 };
		});
	});
</script>

<span
	class="tmp"
	class:is-faded={faded}
	class:is-empty={!src}
	class:is-selected={selected}
	style:--el={el}
	style:--size="{size}px"
	style:--pip="{pip}px"
>
	<span class="tmp-face">
		{#if src}<img {src} alt="" />{:else}<Mark name="plus" size={Math.round(size / 4)} />{/if}
	</span>
	{#each pips as p, i (p.kind)}
		<span
			class="tmp-pip"
			title={p.title}
			style:left="{place[i].left}px"
			style:top="{place[i].top}px"
		>
			<img src={p.img} alt="" />
			{#if p.kind === 'weapon'}<span class="tmp-ref">{ref}</span>{/if}
		</span>
	{/each}
</span>

<style>
	.tmp {
		position: relative;
		display: block;
		flex-shrink: 0;
		width: var(--size);
		height: var(--size);
	}
	/* The Roster's face (RosterTab .til-face): the element's wash in the well,
	   the element's 2px ring. */
	.tmp-face {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border-radius: var(--r-round);
		background: color-mix(in srgb, var(--el) 28%, var(--surface-well));
		box-shadow: 0 0 0 2px var(--el);
		color: var(--muted);
		transition: box-shadow var(--t-snap);
	}
	.tmp-face > img {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: var(--r-round);
		object-fit: cover;
	}
	/* Not owned: faded, keeping some of its colour, and no ring (the Roster's
	   rule, at its softer value). */
	.is-faded .tmp-face {
		box-shadow: none;
	}
	.is-faded .tmp-face > img {
		filter: var(--portrait-unowned);
	}
	.is-empty .tmp-face {
		background: var(--surface-well);
		box-shadow: inset 0 0 0 1px var(--line-faint);
	}
	.is-selected .tmp-face {
		box-shadow: 0 0 0 2px var(--sel-ring);
	}

	.tmp-pip {
		position: absolute;
		display: grid;
		place-items: center;
		width: var(--pip);
		height: var(--pip);
		border-radius: var(--r-round);
		background: var(--pip-ground, var(--surface));
		transition: background-color var(--t-snap);
	}
	.tmp-pip > img {
		width: calc(var(--pip) - 2px);
		height: calc(var(--pip) - 2px);
		object-fit: contain;
	}
	/* The bench pill's refinement digit (TeamLoadoutPlates .tlp-ref). */
	.tmp-ref {
		position: absolute;
		top: -3px;
		right: -3px;
		color: color-mix(in srgb, var(--el) 75%, white);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		line-height: var(--lh-none);
		text-shadow:
			0 0 3px var(--pip-ground, var(--surface)),
			0 1px 2px var(--pip-ground, var(--surface));
	}
</style>
