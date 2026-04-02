<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { getCharacterById } from '$lib/data/characterLookup';
	import type { Ability, AbilityVariant } from '$lib/types/ability';
	import { getAvatar, getAvatarFallback } from '$lib/utils/getAvatar';
	import { siteSettings } from '$lib/stores';
	import type { CharacterData } from '$lib/types/character';

	// ---------------------------------------------------------------------------
	// Props (Svelte 5 runes)
	// ---------------------------------------------------------------------------

	let {
		characterId = 'bennett',
		constellation = 'C6',
		weaponChoiceLabel = null,
		artifactChoiceLabel = null
	}: {
		characterId?: string;
		constellation?: string;
		weaponChoiceLabel?: string | null;
		artifactChoiceLabel?: string | null;
	} = $props();

	// ---------------------------------------------------------------------------
	// Element styles (includes 'none' for blank/element-less characters)
	// ---------------------------------------------------------------------------

	const elementStyles = {
		pyro:    { dark: '#290502', mid: '#DE2A13' },
		hydro:   { dark: '#031B63', mid: '#009EFF' },
		electro: { dark: '#190E21', mid: '#C03DFD' },
		cryo:    { dark: '#0A4E67', mid: '#69D9FF' },
		anemo:   { dark: '#143B3A', mid: '#49E9E3' },
		geo:     { dark: '#341B07', mid: '#E6AD07' },
		dendro:  { dark: '#1B200A', mid: '#8FD70E' },
		none:    { dark: '#111318', mid: '#6a7080' }
	} as const;

	// ---------------------------------------------------------------------------
	// Types
	// ---------------------------------------------------------------------------

	type EffectChip = {
		label: string;
		tone?: 'atk' | 'def' | 'hp' | 'em' | 'crit' | 'dmg' | 'heal' | 'misc';
	};

	type AbilityRow = {
		kind: 'skill' | 'skill-variant' | 'burst';
		keyLabel: string;
		label?: string;
		name: string;
		duration: number | null;
		cooldown: number | null;
		cost: number | null;
		effects: EffectChip[];
		isVariant?: boolean;
	};

	type TagItem = { label: string; iconSrc?: string };

	// ---------------------------------------------------------------------------
	// Portrait fallback state
	// ---------------------------------------------------------------------------

	let useFallbackPortrait = $state(false);

	$effect(() => {
		if (characterId) useFallbackPortrait = false;
	});

	// ---------------------------------------------------------------------------
	// Derived character data
	// ---------------------------------------------------------------------------

	let character = $derived(getCharacterById(characterId));
	let abilities = $derived(character?.abilities ?? []);
	let skillAbility = $derived((abilities[1] ?? null) as Ability | null);
	let burstAbility = $derived((abilities[2] ?? null) as Ability | null);
	let displayName = $derived(character?.displayName ?? character?.name ?? 'Unknown');

	let elementKey = $derived(character?.element ?? 'none');
	let elementLabel = $derived(formatElementLabel(elementKey));
	let elementStyle = $derived(
		elementStyles[elementKey as keyof typeof elementStyles] ?? elementStyles.none
	);
	let elementColor = $derived(elementStyle.mid);
	let elementBorder = $derived(elementStyle.mid);
	let elementDark = $derived(elementStyle.dark);
	let elementIcon = $derived(elementKey in elementStyles && elementKey !== 'none' ? elementKey : null);

	let portraitSrc = $derived(
		useFallbackPortrait
			? getAvatarFallback(characterId, 'full')
			: getAvatar(characterId, $siteSettings.useNewOutfits, 'full')
	);

	let abilityRows = $derived(buildAbilityRows(skillAbility, burstAbility));
	let tagList = $derived(buildTags(character, skillAbility, burstAbility));

	// ---------------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------------

	function handlePortraitError() {
		useFallbackPortrait = true;
	}

	function toNumber(value: unknown): number | null {
		return typeof value === 'number' ? value : null;
	}

	const buffStatLabels: Record<string, string> = {
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
		pyroDmgBonus: 'Pyro DMG%'
	};

	const buffStatTones: Record<string, EffectChip['tone']> = {
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
		pyroDmgBonus: 'dmg'
	};

	function collectEffects(ability: Ability | null): EffectChip[] {
		if (!ability) return [];
		const effects: EffectChip[] = [];
		const seen = new SvelteSet<string>();
		for (const effect of ability.effects ?? []) {
			if (effect.type !== 'buff') continue;
			const stat = effect.stat;
			if (!stat || seen.has(stat)) continue;
			seen.add(stat);
			effects.push({ label: buffStatLabels[stat] ?? stat, tone: buffStatTones[stat] ?? 'misc' });
		}
		const tags = ability.tags ?? [];
		if (tags.some((t) => t.toLowerCase().includes('heal'))) {
			effects.push({ label: 'heal', tone: 'heal' });
		}
		return effects;
	}

	function formatSeconds(value: number | null): string {
		return value === null ? '-' : `${value}s`;
	}

	function formatCost(value: number | null): string {
		return value === null ? '-' : `${value}`;
	}

	function shortenAbilityName(name: string): string {
		if (name.length <= 18) return name;
		const idx = name.indexOf(':');
		return idx !== -1 ? name.slice(idx + 1).trim() : name;
	}

	function formatElementLabel(value: string): string {
		if (!value || value === 'none') return '';
		return `${value[0]?.toUpperCase() ?? ''}${value.slice(1)}`;
	}

	function isTapVariant(variant: AbilityVariant) {
		return /tap|press|main|base/.test(variant.label.toLowerCase());
	}

	function isHoldVariant(variant: AbilityVariant) {
		return /hold/.test(variant.label.toLowerCase());
	}

	function orderedVariants(variants: AbilityVariant[]): AbilityVariant[] {
		const used = new SvelteSet<AbilityVariant>();
		const ordered: AbilityVariant[] = [];
		const tap = variants.find(isTapVariant);
		const hold = variants.find(isHoldVariant);
		if (tap) { ordered.push(tap); used.add(tap); }
		else if (variants[0]) { ordered.push(variants[0]); used.add(variants[0]); }
		if (hold && !used.has(hold)) { ordered.push(hold); used.add(hold); }
		const other = variants.find((v) => !used.has(v));
		if (other) ordered.push(other);
		return ordered;
	}

	function buildAbilityRows(skill: Ability | null, burst: Ability | null): AbilityRow[] {
		const rows: AbilityRow[] = [];
		const baseSkillDuration = toNumber(skill?.duration ?? null);
		const baseSkillCooldown = toNumber(skill?.cooldown ?? null);
		const skillKeyLabel = skill?.input ?? 'E';

		rows.push({
			kind: 'skill',
			keyLabel: skillKeyLabel,
			label: 'Elemental Skill',
			name: skill?.name ?? 'Elemental Skill',
			duration: baseSkillDuration,
			cooldown: baseSkillCooldown,
			cost: null,
			effects: collectEffects(skill)
		});

		for (const variant of orderedVariants(skill?.variants ?? [])) {
			const merged = skill ? ({ ...skill, ...variant, variants: undefined } as Ability) : null;
			rows.push({
				kind: 'skill-variant',
				keyLabel: skillKeyLabel,
				name: variant.label,
				duration: toNumber(variant.duration ?? baseSkillDuration),
				cooldown: toNumber(variant.cooldown ?? baseSkillCooldown),
				cost: null,
				effects: collectEffects(merged),
				isVariant: true
			});
		}

		rows.push({
			kind: 'burst',
			keyLabel: burst?.input ?? 'Q',
			label: 'Elemental Burst',
			name: burst?.name ?? 'Elemental Burst',
			duration: toNumber(burst?.duration ?? null),
			cooldown: toNumber(burst?.cooldown ?? null),
			cost: toNumber(burst?.energyCost ?? null),
			effects: collectEffects(burst)
		});

		return rows;
	}

	function buildTags(
		characterData: CharacterData | null,
		skill: Ability | null,
		burst: Ability | null
	): TagItem[] {
		const tags: TagItem[] = [];
		const rarity = characterData?.rarity;
		if (rarity === 4 || rarity === 5) {
			tags.push({ label: rarity === 4 ? 'four star' : 'five star' });
		}
		if (characterData?.weapon) {
			const k = characterData.weapon.toLowerCase();
			const known = new Set(['sword', 'claymore', 'polearm', 'catalyst', 'bow']);
			const icon = known.has(k) ? `/assets/weapon-types/${k}.webp` : undefined;
			tags.push({ label: characterData.weapon.toLowerCase(), iconSrc: icon });
		}
		const abilityTags = [skill, burst].flatMap((a) => a?.tags ?? []).map((t) => t.toLowerCase());
		if (abilityTags.some((t) => t.includes('heal'))) {
			tags.push({ label: 'heals' });
		} else if (
			(skill?.effects ?? []).some((e) => e.type === 'buff') ||
			(burst?.effects ?? []).some((e) => e.type === 'buff')
		) {
			tags.push({ label: 'buffs' });
		}
		return tags.slice(0, 4);
	}
</script>

<div
	class="wide-card"
	style:--element-color={elementColor}
	style:--element-border={elementBorder}
	style:--element-dark={elementDark}
>
	<div class="wide-card-body">
		<section class="profile-card">
			<div class="portrait-frame">
				<img
					src={portraitSrc}
					alt={displayName}
					class="portrait"
					onerror={handlePortraitError}
				/>
				<button class="constellation" aria-label="Select constellation">
					{constellation} <span class="constellation-caret">⏷</span>
				</button>
				<div class="nameplate">
					{#if elementIcon}
						<span class="element-icon" aria-hidden="true">
							<img src={`/assets/elements/flat-color/${elementIcon}.png`} alt={elementLabel} />
						</span>
					{/if}
					<span class="name" title={displayName}>{displayName}</span>
				</div>
			</div>

			<div class="profile-body">
				{#if tagList.length}
					<div class="tag-row">
						{#each tagList as tag (tag.label)}
							<span class="tag">
								{#if tag.iconSrc}
									<img src={tag.iconSrc} alt="" aria-hidden="true" />
								{/if}
								{#if tag.label === 'four star' || tag.label === 'five star'}
									<span aria-hidden="true">✦</span>
								{/if}
								{tag.label}
							</span>
						{/each}
					</div>
				{/if}

				<div class="loadout">
					{#if weaponChoiceLabel}
						<span class="loadout-chip" title={weaponChoiceLabel}>{weaponChoiceLabel}</span>
					{:else}
						<button class="loadout-empty" type="button">+ weapon</button>
					{/if}
					{#if artifactChoiceLabel}
						<span class="loadout-chip" title={artifactChoiceLabel}>{artifactChoiceLabel}</span>
					{:else}
						<button class="loadout-empty" type="button">+ artifact</button>
					{/if}
				</div>
			</div>
		</section>

		<section class="ability-card">
			<div class="ability-header-row">
				<div class="ability-header-left"></div>
				<span>DUR</span>
				<span>CD</span>
				<span>COST</span>
				<span>EFFECTS</span>
			</div>

			{#each abilityRows as row, index (row.kind + '-' + index)}
				<div class={`ability-row ${row.kind}`}>
					<div class="ability-meta">
						<span class={`key ${row.isVariant ? 'variant-key' : ''}`}>{row.keyLabel}</span>
						<div class="ability-text">
							{#if row.label}
								<span class="ability-label">{row.label}</span>
							{/if}
							<span
								class={`ability-name ${row.isVariant ? 'variant-name' : ''}`}
								title={row.name}
							>
								{shortenAbilityName(row.name)}
							</span>
						</div>
					</div>
					<div class={`ability-stat ${row.isVariant ? 'variant-stat' : ''}`}>{formatSeconds(row.duration)}</div>
					<div class={`ability-stat ${row.isVariant ? 'variant-stat' : ''}`}>{formatSeconds(row.cooldown)}</div>
					<div class={`ability-stat ${row.isVariant ? 'variant-stat' : ''}`}>{formatCost(row.cost)}</div>
					<div class="ability-effects">
						{#each row.effects as effect (effect.label)}
							<span class={`effect-chip tone-${effect.tone ?? 'misc'}`}>
								<span class="effect-icon"></span>
								<span class="effect-text">{effect.label}</span>
							</span>
						{/each}
					</div>
				</div>
			{/each}
		</section>
	</div>
</div>

<style>
	.wide-card {
		--element-color: #d95a2b;
		--element-border: #a01e14;
		--portrait-col-width: 100px;
		--portrait-col-height: calc(var(--portrait-col-width) * 1.55);
		--card-radius: 10px;
		--radius-md: 8px;
		--radius-sm: 6px;
		--radius-xs: 2px;
		--space-1: 2px;
		--space-2: 4px;
		--space-3: 6px;
		--space-4: 8px;
		--space-5: 10px;
		--space-6: 12px;
		--space-7: 16px;
		--space-8: 20px;
		--type-2xs: 0.482rem;
		--type-xs: 0.578rem;
		--type-sm: 0.694rem;
		--type-md: 0.833rem;
		--type-lg: 1rem;

		width: 100%;
		height: 100%;
	}

	.wide-card-body {
		width: 100%;
		display: grid;
		grid-template-columns: var(--portrait-col-width) minmax(0, 1fr);
		align-items: start;
	}

	.profile-card {
		position: relative;
		width: var(--portrait-col-width);
		height: var(--portrait-col-height);
		border-radius: var(--card-radius);
		background: #314265;
		border: 2px solid #314265;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.profile-card::after {
		content: '';
		position: absolute;
		width: calc(var(--portrait-col-width) - 2px);
		height: calc(var(--portrait-col-width) - 2px);
		inset: -1px;
		border-radius: inherit;
		border: 1px solid #314265;
		z-index: 3;
		pointer-events: none;
	}

	.portrait-frame {
		position: relative;
		flex-shrink: 0;
		height: calc(var(--portrait-col-width) - 4px);
		border-radius: calc(var(--card-radius) - 2px);
		background: radial-gradient(circle at 50% 100%, var(--element-color) 3%, #05091a 95%);
		overflow: hidden;
	}

	.portrait {
		position: relative;
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		z-index: 0;
	}

	.constellation {
		position: absolute;
		top: 0;
		right: 0;
		z-index: 2;
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 2px 6px 3px 7px;
		background: #314265;
		border: none;
		border-radius: 0 0 0 calc(var(--card-radius) - 2px);
		box-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
		font-family: 'Noto Sans Variable', 'Noto Sans', sans-serif;
		font-size: var(--type-xs);
		font-weight: 700;
		color: #e7eefc;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.constellation-caret {
		font-size: 0.75em;
		line-height: 1;
		transform: translate(0, 1px);
	}

	.profile-body {
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		flex: 1;
	}

	.nameplate {
		position: absolute;
		bottom: 0;
		left: 0;
		z-index: 2;
		padding: 3px 8px 0 4px;
		background: #314265;
		border-radius: 0 calc(var(--card-radius) - 2px) 0 0;
		box-shadow: -2px 2px 7px rgba(0, 0, 0, 1);
		display: flex;
		align-items: center;
		gap: var(--space-1);
		justify-content: center;
		text-align: center;
	}

	.element-icon {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
	}

	.element-icon img {
		width: 14px;
		height: 14px;
		display: block;
		transform: translate(0, -1px);
	}

	.name {
		font-family: 'Bitter Variable', 'Bitter', serif;
		font-size: var(--type-xs);
		font-weight: 750;
		color: #e4ecff;
		letter-spacing: 0.04em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.tag-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		justify-content: center;
	}

	.tag {
		padding: 1px 4px;
		border-radius: 999px;
		border: 1px solid #6f7fa3;
		font-family: 'Noto Sans Display Variable', 'Noto Sans Display', sans-serif;
		font-size: var(--type-2xs);
		font-weight: 600;
		text-transform: lowercase;
		color: #c7d3ef;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.tag img {
		width: 10px;
		height: 10px;
		object-fit: contain;
		display: block;
	}

	.loadout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
		margin-top: auto;
	}

	.loadout-empty {
		padding: 2px 4px;
		background: transparent;
		border: none;
		color: #6f7fa3;
		font-size: var(--type-2xs);
		font-weight: 600;
		cursor: pointer;
		transition: color 0.25s ease;
	}
	.loadout-empty:hover {
		color: #dbe6ff;
	}

	.loadout-chip {
		padding: 2px 4px;
		color: #dbe6ff;
		font-size: var(--type-2xs);
		font-weight: 600;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* ── Ability card ─────────────────────────────────────────── */

	.ability-card {
		--ability-cols: minmax(70px, 1fr) 28px 28px 28px minmax(36px, 0.6fr);

		width: 100%;
		height: auto;
		min-height: calc(var(--portrait-col-height) - 20px);
		background: #18243F;
		border-radius: 0 var(--card-radius) var(--card-radius) 0;
		border: 2px solid #18243F;
		border-left: 0;
		display: grid;
		grid-auto-rows: min-content;
		overflow: hidden;
		transform: translate(0, 10px);
	}

	.ability-header-row {
		display: grid;
		grid-template-columns: var(--ability-cols);
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
		color: #6f7fa3;
		font-size: var(--type-2xs);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.ability-header-left {
		height: 1px;
	}

	.ability-row {
		display: grid;
		grid-template-columns: var(--ability-cols);
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-2) 0 var(--space-4);
		height: 50px;
	}

	.ability-row.skill,
	.ability-row.skill-variant {
		background: #101a2f;
	}

	.ability-row.skill-variant {
		position: relative;
		height: 30px;
	}

	.ability-row.skill-variant .ability-meta {
		transform: translate(18px, -9px);
	}

	.ability-row.skill-variant > * {
		transform: translate(0, -9px);
	}

	.ability-row.skill-variant::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 13px;
		width: 2px;
		background: #6f7fa3;
		pointer-events: none;
		transform: translate(0, -9px);
	}

	.ability-meta {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
	}

	.key {
		flex-shrink: 0;
		padding: 1px 3px 2px;
		border-radius: var(--radius-xs);
		background: #e7eefc;
		color: #05091a;
		font-family: 'Bitter Variable', 'Bitter', serif;
		font-size: var(--type-xs);
		font-weight: 800;
		line-height: 1;
		text-transform: uppercase;
	}

	.key.variant-key {
		padding: 3px 2px 2px;
		font-size: var(--type-2xs);
		text-transform: lowercase;
	}

	.ability-text {
		min-width: 0;
		display: grid;
		gap: 1px;
		text-align: left;
	}

	.ability-label {
		font-size: var(--type-2xs);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #9db0d6;
	}

	.ability-name {
		font-family: 'Bitter Variable', 'Bitter', serif;
		font-size: var(--type-sm);
		font-weight: 700;
		color: #e7eefc;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ability-name.variant-name {
		font-family: 'Noto Sans Display Variable', 'Noto Sans Display', sans-serif;
		font-size: var(--type-2xs);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #9db0d6;
	}

	.ability-stat {
		font-size: var(--type-sm);
		font-weight: 500;
		color: #e7eefc;
	}

	.ability-stat.variant-stat {
		font-size: var(--type-xs);
	}

	.ability-effects {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		min-height: 14px;
		align-content: center;
	}

	.effect-chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 2px 4px;
		border-radius: 999px;
		border: 1px solid #233252;
		color: #d4def7;
		font-size: var(--type-2xs);
		font-weight: 600;
	}

	.effect-icon {
		width: 6px;
		height: 6px;
		border-radius: 2px;
		background: #7c89a6;
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
		flex-shrink: 0;
	}

	.effect-chip.tone-atk .effect-icon  { background: #f25f5c; }
	.effect-chip.tone-def .effect-icon  { background: #4b88ff; }
	.effect-chip.tone-hp .effect-icon   { background: #f3a712; }
	.effect-chip.tone-em .effect-icon   { background: #4cd4b0; }
	.effect-chip.tone-crit .effect-icon { background: #d977ff; }
	.effect-chip.tone-dmg .effect-icon  { background: #f7c948; }
	.effect-chip.tone-heal .effect-icon { background: #6ee7b7; }
</style>
