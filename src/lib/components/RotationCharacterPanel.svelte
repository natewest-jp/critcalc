<!--
	src/lib/components/RotationCharacterPanel.svelte

	Collapsible per-character ability reference panel for the rotation planner.
	Header is always visible: avatar · name + element · weapon/artifact loadout.
	Body (ability table) expands/collapses on toggle.
-->
<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { getCharacterById } from '$lib/data/characterLookup';
	import { getAvatar, getAvatarFallback } from '$lib/utils/getAvatar';
	import { constellations, loadout, siteSettings } from '$lib/stores';
	import type { Ability, AbilityVariant } from '$lib/types/ability';
	import { getAllArtifactSets, artifactImagePath } from '$lib/data/artifactLookup';
	import { getWeaponsByType } from '$lib/data/weaponLookup';
	import LoadoutDropdown from '$lib/components/LoadoutDropdown.svelte';
	import type { DropdownItem } from '$lib/components/LoadoutDropdown.svelte';

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

	let char = $derived(getCharacterById(characterId));
	let isBlank = $derived(!char || characterId === 'blank');

	let skillAbility = $derived((char?.abilities.find((a) => a.abilityType === 'skill') ?? null) as Ability | null);
	let burstAbility = $derived((char?.abilities.find((a) => a.abilityType === 'burst') ?? null) as Ability | null);

	let cLevel    = $derived(char ? ($constellations[char.id] ?? 0) : 0);
	let charLoad  = $derived(char ? ($loadout[char.id] ?? {}) : {});

	// ---------------------------------------------------------------------------
	// Element palette (mirrors RotationTimeline)
	// ---------------------------------------------------------------------------

	type Palette = { main: string; active: string; border: string };

	const PALETTE: Record<string, Palette> = {
		pyro:    { main: '#e05a4a', active: 'rgba(224,90,74,0.22)',   border: 'rgba(224,90,74,0.5)'   },
		hydro:   { main: '#1472f0', active: 'rgba(20,114,240,0.22)',  border: 'rgba(20,114,240,0.5)'  },
		anemo:   { main: '#4ecbb4', active: 'rgba(78,203,180,0.22)',  border: 'rgba(78,203,180,0.5)'  },
		electro: { main: '#c070f0', active: 'rgba(192,112,240,0.22)', border: 'rgba(192,112,240,0.5)' },
		cryo:    { main: '#88c8f0', active: 'rgba(136,200,240,0.22)', border: 'rgba(136,200,240,0.5)' },
		geo:     { main: '#d4a040', active: 'rgba(212,160,64,0.22)',  border: 'rgba(212,160,64,0.5)'  },
		dendro:  { main: '#80c840', active: 'rgba(128,200,64,0.22)',  border: 'rgba(128,200,64,0.5)'  },
		none:    { main: '#6a7080', active: 'rgba(106,112,128,0.22)', border: 'rgba(106,112,128,0.5)' }
	};

	function pal(el: string | undefined): Palette {
		return PALETTE[el ?? 'none'] ?? PALETTE.none;
	}

	let p = $derived(pal(char?.element));

	// ---------------------------------------------------------------------------
	// Avatar fallback
	// ---------------------------------------------------------------------------

	let avatarError = $state(false);
	$effect(() => { characterId; avatarError = false; });

	function handleAvatarError(event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src.includes('-newfit')) {
			img.src = getAvatarFallback(characterId, 'circle');
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
	};

	const BUFF_LABELS: Record<string, string> = {
		'atk%': 'ATK%', 'def%': 'DEF%', 'hp%': 'HP%',
		em: 'EM', critRate: 'CR', critDmg: 'CD',
		allDmgBonus: 'DMG%',
		anemoDmgBonus: 'Anemo DMG%', cryoDmgBonus: 'Cryo DMG%',
		dendroDmgBonus: 'Dendro DMG%', electroDmgBonus: 'Electro DMG%',
		geoDmgBonus: 'Geo DMG%', hydroDmgBonus: 'Hydro DMG%',
		pyroDmgBonus: 'Pyro DMG%', lunarDmgBonus: 'Lunar DMG%'
	};

	const BUFF_TONES: Record<string, string> = {
		'atk%': 'atk', 'def%': 'def', 'hp%': 'hp',
		em: 'em', critRate: 'crit', critDmg: 'crit',
		allDmgBonus: 'dmg', anemoDmgBonus: 'dmg', cryoDmgBonus: 'dmg',
		dendroDmgBonus: 'dmg', electroDmgBonus: 'dmg', geoDmgBonus: 'dmg',
		hydroDmgBonus: 'dmg', pyroDmgBonus: 'dmg', lunarDmgBonus: 'dmg'
	};

	function effectChips(ability: Ability | null): EffectChip[] {
		if (!ability) return [];
		const chips: EffectChip[] = [];
		const seen = new SvelteSet<string>();
		for (const fx of ability.effects ?? []) {
			if (fx.type !== 'buff') continue;
			const stat = (fx as { stat?: string }).stat;
			if (!stat || seen.has(stat)) continue;
			seen.add(stat);
			chips.push({ label: BUFF_LABELS[stat] ?? stat, tone: BUFF_TONES[stat] ?? 'misc' });
		}
		if (ability.tags?.some((t) => t === 'heal')) chips.push({ label: 'heal', tone: 'heal' });
		if (ability.tags?.some((t) => t === 'shield')) chips.push({ label: 'shield', tone: 'misc' });
		return chips;
	}

	function isTap(v: AbilityVariant) { return /tap|press|main|base/i.test(v.label); }
	function isHold(v: AbilityVariant) { return /hold/i.test(v.label); }

	function orderedVariants(variants: AbilityVariant[]): AbilityVariant[] {
		const used = new SvelteSet<AbilityVariant>();
		const out: AbilityVariant[] = [];
		const tap  = variants.find(isTap);
		const hold = variants.find(isHold);
		if (tap)  { out.push(tap);  used.add(tap);  }
		else if (variants[0]) { out.push(variants[0]); used.add(variants[0]); }
		if (hold && !used.has(hold)) { out.push(hold); used.add(hold); }
		const other = variants.find((v) => !used.has(v));
		if (other) out.push(other);
		return out;
	}

	let abilityRows = $derived.by((): AbilityRow[] => {
		const rows: AbilityRow[] = [];

		if (skillAbility) {
			const baseDur = skillAbility.duration ?? null;
			const baseCD  = skillAbility.cooldown ?? null;
			rows.push({
				key: skillAbility.input?.[0] ?? 'E',
				name: skillAbility.name,
				duration: baseDur,
				cooldown: baseCD,
				cost: null,
				effects: effectChips(skillAbility),
				isVariant: false
			});
			for (const v of orderedVariants(skillAbility.variants ?? [])) {
				const merged = { ...skillAbility, ...v, variants: undefined } as Ability;
				rows.push({
					key: skillAbility.input?.[0] ?? 'E',
					name: v.label,
					duration: v.duration ?? baseDur ?? null,
					cooldown: v.cooldown ?? baseCD ?? null,
					cost: null,
					effects: effectChips(merged),
					isVariant: true
				});
			}
		}

		if (burstAbility) {
			rows.push({
				key: burstAbility.input?.[0] ?? 'Q',
				name: burstAbility.name,
				duration: burstAbility.duration ?? null,
				cooldown: burstAbility.cooldown ?? null,
				cost: burstAbility.energyCost ?? null,
				effects: effectChips(burstAbility),
				isVariant: false
			});
		}

		return rows;
	});

	// ---------------------------------------------------------------------------
	// Loadout dropdowns (update character default)
	// ---------------------------------------------------------------------------

	const artifactItems: DropdownItem[] = getAllArtifactSets().map((a) => ({
		id: a.id,
		label: a.shortName ?? a.name,
		iconSrc: artifactImagePath(a.id)
	}));

	let weaponItems = $derived<DropdownItem[]>(
		char ? getWeaponsByType(char.weapon as import('$lib/types/weapon').WeaponType).map((w) => ({
			id: w.id,
			label: w.shortName ?? w.name
		})) : []
	);

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
		<div class="rcp-header">
			<div class="rcp-avatar rcp-avatar--blank"></div>
			<span class="rcp-blank-label">No character</span>
		</div>
	</div>
{:else}
	<div class="rcp-root" style:--el={p.main} style:--el-active={p.active} style:--el-border={p.border}>

		<!-- ── Header (always visible, click anywhere to toggle) ── -->
		<div
			class="rcp-header"
			role="button"
			tabindex="0"
			aria-expanded={expanded}
			aria-label="Toggle ability table for {char?.displayName}"
			onclick={() => (expanded = !expanded)}
			onkeydown={(e) => e.key === 'Enter' && (expanded = !expanded)}
		>

			<!-- Avatar -->
			<div class="rcp-avatar" style:border-color={p.main}>
				{#if !avatarError}
					<img
						class="rcp-avatar-img"
						src={getAvatar(characterId, $siteSettings.useNewOutfits, 'circle')}
						alt={char?.displayName}
						onerror={handleAvatarError}
					/>
				{:else}
					<span class="rcp-avatar-initials">{(char?.displayName ?? '?').slice(0, 2).toUpperCase()}</span>
				{/if}
			</div>

			<!-- Identity: name · element · weapon type -->
			<div class="rcp-identity">
				<span class="rcp-name">{char?.displayName}</span>
				<div class="rcp-meta-row">
					{#if char?.element}
						<span class="rcp-element-dot" style:background={p.main}></span>
						<span class="rcp-meta-label">{char.element}</span>
					{/if}
					{#if char?.weapon}
						{@const icon = weaponIcon(char.weapon)}
						<span class="rcp-meta-sep">·</span>
						{#if icon}
							<img class="rcp-weapon-icon" src={icon} alt={char.weapon} />
						{/if}
						<span class="rcp-meta-label">{char.weapon}</span>
					{/if}
					<span class="rcp-meta-sep">·</span>
					<span class="rcp-constellation-label" style:color={cLevel > 0 ? p.main : undefined}>C{cLevel}</span>
				</div>
			</div>

			<!-- Loadout: weapon + artifact (updates character default) -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="rcp-loadout" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
				<LoadoutDropdown
					items={artifactItems}
					selected={charLoad.artifactSetId}
					placeholder="Artifact"
					onSelect={(id) => char && loadout.setArtifact(char.id, id)}
				/>
				<LoadoutDropdown
					items={weaponItems}
					selected={charLoad.weaponId}
					placeholder="Weapon"
					onSelect={(id) => char && loadout.setWeapon(char.id, id)}
				/>
			</div>

			<!-- Expand toggle -->
			<button
				class="rcp-toggle"
				class:rcp-toggle--open={expanded}
				onclick={(e) => { e.stopPropagation(); expanded = !expanded; }}
				aria-label={expanded ? 'Collapse ability table' : 'Expand ability table'}
				tabindex="-1"
			>▾</button>
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
							<span class="rcp-key" class:rcp-key--variant={row.isVariant}>{row.key}</span>
							<span class="rcp-ability-name" class:rcp-ability-name--variant={row.isVariant} title={row.name}>{row.name}</span>
						</div>
						<div class="rcp-col-stat" class:rcp-stat--variant={row.isVariant}>{fmt(row.duration)}</div>
						<div class="rcp-col-stat" class:rcp-stat--variant={row.isVariant}>{fmt(row.cooldown)}</div>
						<div class="rcp-col-stat" class:rcp-stat--variant={row.isVariant}>{fmt(row.cost, '')}</div>
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
	.rcp-root {
		--bg: #0f1528;
		--card: #17213a;
		--border: #253252;
		--text: #e6edf8;
		--muted: #9eacc8;
		--el: #6a7080;

		font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace;
		font-size: 10px;
		color: var(--text);
		background: var(--bg);
		border-radius: 8px;
		border: 1px solid var(--border);
		border-top: 2px solid var(--el);
		overflow: hidden;
	}

	.rcp-blank {
		border-top-color: var(--border);
		opacity: 0.4;
	}

	/* ── Header ───────────────────────────────────────────────── */
	.rcp-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px 8px 8px;
		min-height: 48px;
		cursor: pointer;
		user-select: none;
	}

	/* ── Avatar ───────────────────────────────────────────────── */
	.rcp-avatar {
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		border-radius: 50%;
		border: 1.5px solid var(--border);
		overflow: hidden;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.rcp-avatar--blank {
		background: #17213a;
	}
	.rcp-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.rcp-avatar-initials {
		font-family: 'Space Grotesk', sans-serif;
		font-size: 10px;
		font-weight: 700;
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
		font-family: 'Space Grotesk', sans-serif;
		font-size: 12px;
		font-weight: 600;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		letter-spacing: 0.01em;
	}
	.rcp-meta-row {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.rcp-element-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.rcp-weapon-icon {
		width: 11px;
		height: 11px;
		object-fit: contain;
		opacity: 0.6;
	}
	.rcp-meta-label {
		font-size: 8.5px;
		color: var(--muted);
		text-transform: capitalize;
		white-space: nowrap;
	}
	.rcp-meta-sep {
		font-size: 8px;
		color: #3a4e72;
	}
	.rcp-constellation-label {
		font-size: 8.5px;
		font-weight: 700;
		color: var(--muted);
		letter-spacing: 0.05em;
	}
	.rcp-blank-label {
		font-size: 9px;
		color: var(--muted);
	}

	/* ── Loadout ──────────────────────────────────────────────── */
	.rcp-loadout {
		display: flex;
		flex-direction: column;
		gap: 3px;
		flex-shrink: 0;
		width: 130px;
	}
	.rcp-loadout-row {
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.rcp-loadout-icon {
		font-size: 9px;
		color: #4a6090;
		flex-shrink: 0;
		width: 12px;
		text-align: center;
	}

	/* ── Toggle ───────────────────────────────────────────────── */
	.rcp-toggle {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 14px;
		color: var(--muted);
		padding: 2px 4px;
		flex-shrink: 0;
		line-height: 1;
		transition: transform 0.15s, color 0.15s;
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
		border-top: 1px solid var(--border);
	}
	.rcp-table-header,
	.rcp-table-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 34px 34px 30px minmax(40px, auto);
		align-items: center;
		gap: 4px;
		padding: 0 10px;
	}
	.rcp-table-header {
		height: 22px;
		color: #4a6090;
		font-size: 7.5px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		border-bottom: 1px solid var(--border);
	}
	/* Mirror data column alignment: cols 2–4 centered, col 5 (EFFECTS) left */
	.rcp-table-header > div:nth-child(2),
	.rcp-table-header > div:nth-child(3),
	.rcp-table-header > div:nth-child(4) {
		text-align: center;
	}
	.rcp-table-row {
		height: 34px;
	}
	.rcp-table-row:not(:last-child) {
		border-bottom: 1px solid #17213a;
	}
	.rcp-row--variant {
		height: 26px;
		background: rgba(0,0,0,0.15);
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
		padding: 1px 4px 2px;
		border-radius: 2px;
		background: var(--text);
		color: #05091a;
		font-size: 7.5px;
		font-weight: 800;
		line-height: 1;
		letter-spacing: 0.03em;
	}
	.rcp-key--variant {
		background: transparent;
		color: var(--muted);
		border: 1px solid #3a4e72;
		font-size: 7px;
	}
	.rcp-ability-name {
		font-family: 'Space Grotesk', sans-serif;
		font-size: 10px;
		font-weight: 500;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.rcp-ability-name--variant {
		font-size: 8.5px;
		color: var(--muted);
		font-weight: 400;
	}
	.rcp-col-stat {
		font-size: 9.5px;
		font-weight: 500;
		color: var(--text);
		text-align: center;
	}
	.rcp-stat--variant {
		font-size: 8.5px;
		color: var(--muted);
	}
	.rcp-col-effects {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
		align-content: center;
		padding: 3px 0;
	}

	/* ── Effect chips ─────────────────────────────────────────── */
	.rcp-chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 1px 5px 2px;
		border-radius: 999px;
		border: 1px solid #253252;
		font-size: 7.5px;
		font-weight: 600;
		color: #9eacc8;
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
	.rcp-chip.tone-atk::before  { background: #f25f5c; }
	.rcp-chip.tone-def::before  { background: #4b88ff; }
	.rcp-chip.tone-hp::before   { background: #f3a712; }
	.rcp-chip.tone-em::before   { background: #4cd4b0; }
	.rcp-chip.tone-crit::before { background: #d977ff; }
	.rcp-chip.tone-dmg::before  { background: #f7c948; }
	.rcp-chip.tone-heal::before { background: #6ee7b7; }
</style>
