<!--
	src/lib/components/RotationCharacterPanel.svelte

	Collapsible per-character ability reference panel for the rotation planner.
	Header is always visible: avatar · name + element · weapon/artifact loadout.
	Body (ability table) expands/collapses on toggle.
-->
<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { getLoadedCharacter, loadCharacter } from '$lib/data/characterData';
	import { getAvatar, getAvatarFallback } from '$lib/utils/getAvatar';
	import { constellations, siteSettings } from '$lib/stores';
	import type { Ability, AbilityVariant, CastAbility, AbilityTag } from '$lib/types/ability';
	import { getActiveDuration } from '$lib/types/ability';
	import { elementPalette } from '$lib/utils/elementColors';
	import { isEffectUnlocked, isVariantUnlocked } from '$lib/utils/constellationFilter';

	// ---------------------------------------------------------------------------
	// Props
	// ---------------------------------------------------------------------------

	let {
		characterId,
		expanded = $bindable(false)
	}: {
		characterId: string;
		expanded?: boolean;
	} = $props();

	// ---------------------------------------------------------------------------
	// Character data
	// ---------------------------------------------------------------------------

	// Identity (name/element/weapon) comes from the eager index so the header
	// renders immediately; the full payload (abilities for the table body)
	// lazy-loads and fills in reactively.
	let indexEntry = $derived(getCharacterIndexEntry(characterId));
	let char = $derived(getLoadedCharacter(characterId));
	let isBlank = $derived(!indexEntry || characterId === 'blank');

	$effect(() => {
		if (characterId !== 'blank') void loadCharacter(characterId);
	});

	let skillAbility = $derived(
		char?.abilities.find(
			(a): a is Extract<Ability, { abilityType: 'skill' }> => a.abilityType === 'skill'
		) ?? null
	);
	let burstAbility = $derived(
		char?.abilities.find(
			(a): a is Extract<Ability, { abilityType: 'burst' }> => a.abilityType === 'burst'
		) ?? null
	);

	let cLevel = $derived(indexEntry ? ($constellations[characterId] ?? 0) : 0);

	// ---------------------------------------------------------------------------
	// Element palette — values live in `src/app.css` as `--el-*-*`.
	// Only `main` is consumed in this component; the deprecated `active` slot
	// has been removed.
	// ---------------------------------------------------------------------------

	let p = $derived(elementPalette(indexEntry?.element));

	// ---------------------------------------------------------------------------
	// Avatar fallback
	// ---------------------------------------------------------------------------

	let avatarError = $state(false);
	$effect(() => {
		void characterId;
		avatarError = false;
	});

	function handleAvatarError(event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src.includes('-newfit')) {
			img.src = getAvatarFallback(characterId, 'circle', $siteSettings.travelerVariant);
		} else {
			avatarError = true;
		}
	}

	// ---------------------------------------------------------------------------
	// Ability table rows
	// ---------------------------------------------------------------------------

	type EffectChip = { label: string; tone: string };

	type AbilityRow = {
		key: string;
		name: string;
		duration: number | null;
		cooldown: number | null;
		cost: number | null;
		effects: EffectChip[];
		isVariant: boolean;
		/** Unlocked constellation node — rendered with the element-tinted key badge. */
		isCons?: boolean;
	};

	const BUFF_LABELS: Record<string, string> = {
		'atk%': 'ATK%',
		'def%': 'DEF%',
		'hp%': 'HP%',
		em: 'EM',
		critRate: 'CR',
		critDmg: 'CD',
		allDmgBonus: 'DMG%',
		anemoDmgBonus: 'Anemo DMG%',
		cryoDmgBonus: 'Cryo DMG%',
		dendroDmgBonus: 'Dendro DMG%',
		electroDmgBonus: 'Electro DMG%',
		geoDmgBonus: 'Geo DMG%',
		hydroDmgBonus: 'Hydro DMG%',
		pyroDmgBonus: 'Pyro DMG%',
		lunarDmgBonus: 'Lunar DMG%',
		lunarChargedDmgBonus: 'Lunar-Charged DMG%',
		lunarBloomDmgBonus: 'Lunar-Bloom DMG%',
		lunarCrystallizeDmgBonus: 'Lunar-Crystallize DMG%',
		anemoRes: 'Anemo RES',
		cryoRes: 'Cryo RES',
		dendroRes: 'Dendro RES',
		electroRes: 'Electro RES',
		geoRes: 'Geo RES',
		hydroRes: 'Hydro RES',
		pyroRes: 'Pyro RES',
		physicalRes: 'Physical RES',
		allElementalRes: 'All Elem. RES',
		anemoCritDmg: 'Anemo CD',
		cryoCritDmg: 'Cryo CD',
		dendroCritDmg: 'Dendro CD',
		electroCritDmg: 'Electro CD',
		geoCritDmg: 'Geo CD',
		hydroCritDmg: 'Hydro CD',
		pyroCritDmg: 'Pyro CD'
	};

	const BUFF_TONES: Record<string, string> = {
		'atk%': 'atk',
		'def%': 'def',
		'hp%': 'hp',
		em: 'em',
		critRate: 'crit',
		critDmg: 'crit',
		allDmgBonus: 'dmg',
		anemoDmgBonus: 'dmg',
		cryoDmgBonus: 'dmg',
		dendroDmgBonus: 'dmg',
		electroDmgBonus: 'dmg',
		geoDmgBonus: 'dmg',
		hydroDmgBonus: 'dmg',
		pyroDmgBonus: 'dmg',
		lunarDmgBonus: 'dmg',
		lunarChargedDmgBonus: 'dmg',
		lunarBloomDmgBonus: 'dmg',
		lunarCrystallizeDmgBonus: 'dmg',
		anemoRes: 'misc',
		cryoRes: 'misc',
		dendroRes: 'misc',
		electroRes: 'misc',
		geoRes: 'misc',
		hydroRes: 'misc',
		pyroRes: 'misc',
		physicalRes: 'misc',
		allElementalRes: 'misc',
		anemoCritDmg: 'crit',
		cryoCritDmg: 'crit',
		dendroCritDmg: 'crit',
		electroCritDmg: 'crit',
		geoCritDmg: 'crit',
		hydroCritDmg: 'crit',
		pyroCritDmg: 'crit'
	};

	function effectChips(ability: Ability | null, conLevel: number): EffectChip[] {
		if (!ability) return [];
		const chips: EffectChip[] = [];
		const seen = new SvelteSet<string>();
		for (const fx of ability.effects ?? []) {
			if (fx.type !== 'buff') continue;
			if (!isEffectUnlocked(fx, conLevel)) continue;
			const stat = (fx as { stat?: string }).stat;
			if (!stat || seen.has(stat)) continue;
			seen.add(stat);
			chips.push({ label: BUFF_LABELS[stat] ?? stat, tone: BUFF_TONES[stat] ?? 'misc' });
		}
		const tags: AbilityTag[] | undefined =
			ability.abilityType === 'normal' ||
			ability.abilityType === 'skill' ||
			ability.abilityType === 'burst'
				? ability.tags
				: undefined;
		if (tags?.some((t) => t === 'heal')) chips.push({ label: 'heal', tone: 'heal' });
		if (tags?.some((t) => t === 'shield')) chips.push({ label: 'shield', tone: 'misc' });
		return chips;
	}

	function isTap(v: AbilityVariant) {
		return /tap|press|main|base/i.test(v.label);
	}
	function isHold(v: AbilityVariant) {
		return /hold/i.test(v.label);
	}

	function orderedVariants(variants: AbilityVariant[]): AbilityVariant[] {
		const used = new SvelteSet<AbilityVariant>();
		const out: AbilityVariant[] = [];
		const tap = variants.find(isTap);
		const hold = variants.find(isHold);
		if (tap) {
			out.push(tap);
			used.add(tap);
		} else if (variants[0]) {
			out.push(variants[0]);
			used.add(variants[0]);
		}
		if (hold && !used.has(hold)) {
			out.push(hold);
			used.add(hold);
		}
		const other = variants.find((v) => !used.has(v));
		if (other) out.push(other);
		return out;
	}

	let abilityRows = $derived.by((): AbilityRow[] => {
		const rows: AbilityRow[] = [];

		if (skillAbility) {
			const baseDur = getActiveDuration(skillAbility) || null;
			const baseCD = skillAbility.cooldown;
			rows.push({
				key: skillAbility.input?.[0] ?? 'E',
				name: skillAbility.name,
				duration: baseDur,
				cooldown: baseCD,
				cost: null,
				effects: effectChips(skillAbility, cLevel),
				isVariant: false
			});
			const unlockedVariants = (skillAbility.variants ?? []).filter((v) =>
				isVariantUnlocked(v, cLevel)
			);
			for (const v of orderedVariants(unlockedVariants)) {
				const merged = { ...skillAbility, ...v, variants: undefined } as CastAbility;
				rows.push({
					key: skillAbility.input?.[0] ?? 'E',
					name: v.label,
					duration: v.duration ?? baseDur ?? null,
					cooldown: v.cooldown ?? baseCD ?? null,
					cost: null,
					effects: effectChips(merged, cLevel),
					isVariant: true
				});
			}
		}

		if (burstAbility) {
			rows.push({
				key: burstAbility.input?.[0] ?? 'Q',
				name: burstAbility.name,
				duration: getActiveDuration(burstAbility) || null,
				cooldown: burstAbility.cooldown,
				cost: burstAbility.energyCost,
				effects: effectChips(burstAbility, cLevel),
				isVariant: false
			});
		}

		// Constellation-node rows: only UNLOCKED nodes (≤ current cons level)
		// that carry at least one modeled buff effect — the "show the whole
		// kit with locked badges" pattern was rejected for the planner (it
		// belongs to the Team Builder); here the table reflects what the
		// timeline actually simulates for this build.
		for (const cons of char?.constellations ?? []) {
			if (cons.abilityType !== 'constellation') continue;
			if (cons.constellationLevel > cLevel) continue;
			const chips = effectChips(cons, cLevel);
			if (chips.length === 0) continue;
			const durations = (cons.effects ?? [])
				.map((fx) => ('duration' in fx ? fx.duration : undefined))
				.filter((d): d is number => typeof d === 'number');
			rows.push({
				key: `C${cons.constellationLevel}`,
				name: cons.name,
				duration: durations.length > 0 ? Math.max(...durations) : null,
				cooldown: null,
				cost: null,
				effects: chips,
				isVariant: false,
				isCons: true
			});
		}

		return rows;
	});

	function fmt(n: number | null, suffix = 's'): string {
		return n === null ? '—' : `${n}${suffix}`;
	}

	// Weapon type icon path
	function weaponIcon(wt: string | undefined): string | null {
		if (!wt) return null;
		const known = new Set(['sword', 'claymore', 'polearm', 'catalyst', 'bow']);
		return known.has(wt.toLowerCase()) ? `/assets/weapon-types/${wt.toLowerCase()}.webp` : null;
	}
</script>

<!-- ======================================================================= -->

{#if isBlank}
	<div class="rcp-root rcp-blank">
		<div class="rcp-header rcp-header--static">
			<div class="rcp-avatar">
				<img class="rcp-avatar-img" src="/assets/characters/circle/blank.webp" alt="" />
			</div>
			<span class="rcp-blank-label">Empty</span>
		</div>
	</div>
{:else}
	<div class="rcp-root" style:--el={p.main}>
		<!-- ── Header (always visible, click anywhere to toggle) ── -->
		<div
			class="rcp-header"
			role="button"
			tabindex="0"
			aria-expanded={expanded}
			aria-label="Toggle ability table for {indexEntry?.displayName}"
			onclick={() => (expanded = !expanded)}
			onkeydown={(e) => e.key === 'Enter' && (expanded = !expanded)}
		>
			<!-- Avatar -->
			<div class="rcp-avatar" style:border-color={p.main}>
				{#if !avatarError}
					<img
						class="rcp-avatar-img"
						src={getAvatar(
							characterId,
							$siteSettings.useNewOutfits,
							'circle',
							$siteSettings.travelerVariant
						)}
						alt={indexEntry?.displayName}
						onerror={handleAvatarError}
					/>
				{:else}
					<span class="rcp-avatar-initials"
						>{(indexEntry?.displayName ?? '?').slice(0, 2).toUpperCase()}</span
					>
				{/if}
			</div>

			<!-- Identity: name · element · weapon type -->
			<div class="rcp-identity">
				<span class="rcp-name">{indexEntry?.displayName}</span>
				<div class="rcp-meta-row">
					{#if indexEntry?.element}
						<img
							class="rcp-element-glyph"
							src="/assets/elements/flat-color/{indexEntry.element}.png"
							alt=""
						/>
						<span class="rcp-meta-label">{indexEntry.element}</span>
					{/if}
					{#if indexEntry?.weapon}
						{@const icon = weaponIcon(indexEntry.weapon)}
						<span class="rcp-meta-sep">·</span>
						{#if icon}
							<img class="rcp-weapon-icon" src={icon} alt={indexEntry.weapon} />
						{/if}
						<span class="rcp-meta-label">{indexEntry.weapon}</span>
					{/if}
					<span class="rcp-meta-sep">·</span>
					<span class="rcp-constellation-label" style:color={cLevel > 0 ? p.main : undefined}
						>C{cLevel}</span
					>
				</div>
			</div>

			<!-- Expand toggle -->
			<button
				class="rcp-toggle"
				class:rcp-toggle--open={expanded}
				onclick={(e) => {
					e.stopPropagation();
					expanded = !expanded;
				}}
				aria-label={expanded ? 'Collapse ability table' : 'Expand ability table'}
				tabindex="-1">▾</button
			>
		</div>

		<!-- ── Ability table (collapsible) ──────────────────────── -->
		{#if expanded}
			<div class="rcp-table">
				<div class="rcp-table-header">
					<div></div>
					<div>DUR</div>
					<div>CD</div>
					<div>COST</div>
					<div>EFFECTS</div>
				</div>
				{#each abilityRows as row, ri (ri)}
					<div class="rcp-table-row" class:rcp-row--variant={row.isVariant}>
						<div class="rcp-col-meta">
							<span
								class="rcp-key"
								class:rcp-key--variant={row.isVariant}
								class:rcp-key--cons={row.isCons}>{row.key}</span
							>
							<span
								class="rcp-ability-name"
								class:rcp-ability-name--variant={row.isVariant}
								title={row.name}>{row.name}</span
							>
						</div>
						<div class="rcp-col-stat" class:rcp-stat--variant={row.isVariant}>
							{fmt(row.duration)}
						</div>
						<div class="rcp-col-stat" class:rcp-stat--variant={row.isVariant}>
							{fmt(row.cooldown)}
						</div>
						<div class="rcp-col-stat" class:rcp-stat--variant={row.isVariant}>
							{fmt(row.cost, '')}
						</div>
						<div class="rcp-col-effects">
							{#each row.effects as chip (chip.label)}
								<span class="rcp-chip tone-{chip.tone}">{chip.label}</span>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	/* ── Root ─────────────────────────────────────────────────── */
	/* Solid panel surface with the shared inset top hairline; the 2px
	   element-colored top edge ties each panel to its timeline row — an
	   accent border earning its place as identity, not an outline. */
	.rcp-root {
		--el: var(--el-none-main);

		font-family: var(--font-body);
		font-size: var(--fs-md);
		color: var(--text);
		background: var(--surface);
		border-radius: 6px;
		border-top: 2px solid var(--el);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
		overflow: hidden;
	}

	.rcp-blank {
		border-top-color: rgba(255, 255, 255, 0.12);
		opacity: 0.45;
	}

	/* ── Header ───────────────────────────────────────────────── */
	.rcp-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 10px 9px 9px;
		min-height: 52px;
		cursor: pointer;
		user-select: none;
	}
	.rcp-header--static {
		cursor: default;
	}

	/* ── Avatar ───────────────────────────────────────────────── */
	/* Same portrait language as the roster card: circle on a neutral
	   backing, ringed in the element color. */
	.rcp-avatar {
		width: 38px;
		height: 38px;
		flex-shrink: 0;
		border-radius: 50%;
		border: 1.5px solid var(--el);
		overflow: hidden;
		background: #131c30;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.rcp-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.rcp-avatar-initials {
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--muted);
	}

	/* ── Identity ─────────────────────────────────────────────── */
	.rcp-identity {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.rcp-name {
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		letter-spacing: var(--ls-tight);
	}
	.rcp-meta-row {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.rcp-element-glyph {
		width: 12px;
		height: 12px;
		flex-shrink: 0;
		object-fit: contain;
	}
	.rcp-weapon-icon {
		width: 12px;
		height: 12px;
		object-fit: contain;
		opacity: 0.6;
	}
	.rcp-meta-label {
		font-size: var(--fs-xs);
		color: var(--muted);
		text-transform: capitalize;
		white-space: nowrap;
	}
	.rcp-meta-sep {
		font-size: var(--fs-xs);
		color: rgba(255, 255, 255, 0.18);
	}
	.rcp-constellation-label {
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--muted);
		letter-spacing: var(--ls-wide);
	}
	.rcp-blank-label {
		font-size: var(--fs-sm);
		color: var(--muted);
	}

	/* ── Toggle ───────────────────────────────────────────────── */
	.rcp-toggle {
		background: none;
		border: none;
		cursor: pointer;
		font-size: var(--fs-lg);
		color: var(--muted);
		padding: 2px 4px;
		flex-shrink: 0;
		line-height: var(--lh-none);
		transition:
			transform 150ms ease,
			color 150ms ease;
		transform: rotate(-90deg);
	}
	.rcp-toggle--open {
		transform: rotate(0deg);
	}
	.rcp-toggle:hover {
		color: var(--text);
	}

	/* ── Ability table ────────────────────────────────────────── */
	.rcp-table {
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}
	.rcp-table-header,
	.rcp-table-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 38px 38px 32px minmax(44px, auto);
		align-items: center;
		gap: 4px;
		padding: 0 10px;
	}
	.rcp-table-header {
		height: 24px;
		color: var(--muted);
		opacity: 0.75;
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}
	/* Mirror data column alignment: cols 2–4 centered, col 5 (EFFECTS) left */
	.rcp-table-header > div:nth-child(2),
	.rcp-table-header > div:nth-child(3),
	.rcp-table-header > div:nth-child(4) {
		text-align: center;
	}
	.rcp-table-row {
		min-height: 36px;
	}
	.rcp-table-row:not(:last-child) {
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}
	.rcp-row--variant {
		min-height: 28px;
		background: rgba(0, 0, 0, 0.15);
	}

	/* ── Table cell content ───────────────────────────────────── */
	.rcp-col-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.rcp-key {
		flex-shrink: 0;
		padding: 2px 5px 3px;
		border-radius: 2px;
		background: var(--text);
		color: #05091a;
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		line-height: var(--lh-none);
		letter-spacing: var(--ls-mid);
	}
	.rcp-key--variant {
		background: rgba(255, 255, 255, 0.08);
		color: var(--muted);
		font-size: var(--fs-2xs);
	}
	/* Constellation-node key: the selected-chip idiom — element-tinted fill
	   + inset ring, matching the roster card's set constellation chip. */
	.rcp-key--cons {
		background: color-mix(in srgb, var(--el) 20%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--el) 50%, transparent);
		color: color-mix(in srgb, var(--el) 75%, white);
	}
	.rcp-ability-name {
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.rcp-ability-name--variant {
		font-size: var(--fs-xs);
		color: var(--muted);
		font-weight: var(--fw-normal);
	}
	.rcp-col-stat {
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		color: var(--text);
		text-align: center;
	}
	.rcp-stat--variant {
		font-size: var(--fs-xs);
		color: var(--muted);
	}
	.rcp-col-effects {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
		align-content: center;
		padding: 4px 0;
	}

	/* ── Effect chips ─────────────────────────────────────────── */
	/* Solid quiet fills; the colored dot stays — it is the data cue. */
	.rcp-chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 2px 5px 3px;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.05);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		color: var(--muted);
		white-space: nowrap;
	}
	.rcp-chip::before {
		content: '';
		width: 5px;
		height: 5px;
		border-radius: 1.5px;
		background: #4a6090;
		flex-shrink: 0;
	}
	.rcp-chip.tone-atk::before {
		background: #f25f5c;
	}
	.rcp-chip.tone-def::before {
		background: #4b88ff;
	}
	.rcp-chip.tone-hp::before {
		background: #f3a712;
	}
	.rcp-chip.tone-em::before {
		background: #4cd4b0;
	}
	.rcp-chip.tone-crit::before {
		background: #d977ff;
	}
	.rcp-chip.tone-dmg::before {
		background: #f7c948;
	}
	.rcp-chip.tone-heal::before {
		background: #6ee7b7;
	}
</style>
