<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { getCharacterById, type CharacterAbility } from '$lib/data/characterLookup';
	import {
		getCharacterCardOverride,
		type CharacterCardOverride,
		type SkillVariant
	} from '$lib/data/characterCardOverrides';
	import { getAvatar, getAvatarFallback } from '$lib/utils/getAvatar';

	export let characterId = 'bennett';
	export let constellation = 'C6';
	export let weaponChoiceLabel: string | null = null;
	export let artifactChoiceLabel: string | null = null;

	const elementStyles = {
		Pyro: { dark: '#290502', mid: '#C7301C' },
		Hydro: { dark: '#031B63', mid: '#0092EC' },
		Electro: { dark: '#190E21', mid: '#AE35EA' },
		Cryo: { dark: '#0A4E67', mid: '#7ADAFF' },
		Anemo: { dark: '#143B3A', mid: '#3CCEC8' },
		Geo: { dark: '#341B07', mid: '#B88D10' },
		Dendro: { dark: '#1B200A', mid: '#639C23' }
	} as const;

	let elementColor = '#C7301C';
	let elementBorder = '#C7301C';
	let elementDark = '#290502';
	const preferNewfit = true;

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

	let useFallbackPortrait = false;
	let character:
		| (ReturnType<typeof getCharacterById> & { rarity?: number; abilities?: CharacterAbility[] })
		| null = null;
	let abilities: CharacterAbility[] = [];
	let skillAbility: CharacterAbility | null = null;
	let burstAbility: CharacterAbility | null = null;
	let override: CharacterCardOverride | null = null;
	let displayName = 'Unknown';
	let portraitPreferredSrc = '';
	let portraitFallbackSrc = '';
	let portraitSrc = '';
	let elementLabel = 'Pyro';
	let elementIcon = 'pyro';
	let weaponType = 'Sword';
	let weaponIcon = '/assets/weapon-types/sword.webp';
	type TagItem = { label: string; iconSrc?: string };
	let tagList: TagItem[] = [];
	let abilityRows: AbilityRow[] = [];

	$: character = getCharacterById(characterId);
	$: abilities = character?.abilities ?? [];
	$: skillAbility = (abilities[1] ?? null) as CharacterAbility | null;
	$: burstAbility = (abilities[2] ?? null) as CharacterAbility | null;
	$: override = getCharacterCardOverride(characterId);
	$: displayName = character?.name ?? 'Unknown';
	$: elementLabel = character?.element ?? 'Pyro';
	$: {
		const hasStyle = elementLabel in elementStyles;
		const style =
			elementStyles[elementLabel as keyof typeof elementStyles] ?? elementStyles.Pyro;
		elementColor = style.mid;
		elementBorder = style.mid;
		elementDark = style.dark;
		elementIcon = (hasStyle ? elementLabel : 'Pyro').toLowerCase();
	}
	$: weaponType = character?.weapon ?? 'Sword';
	$: {
		const weaponKey = weaponType.toLowerCase();
		const knownWeapons = new SvelteSet(['sword', 'claymore', 'polearm', 'catalyst', 'bow']);
		weaponIcon = knownWeapons.has(weaponKey)
			? `/assets/weapon-types/${weaponKey}.webp`
			: '/assets/weapon-types/sword.webp';
	}

	$: if (characterId) {
		useFallbackPortrait = false;
	}

	$: portraitPreferredSrc = getAvatar(characterId, preferNewfit, 'full');
	$: portraitFallbackSrc = getAvatarFallback(characterId, 'full');
	$: portraitSrc = useFallbackPortrait ? portraitFallbackSrc : portraitPreferredSrc;

	function handlePortraitError() {
		useFallbackPortrait = true;
	}

	function toNumber(value: unknown): number | null {
		return typeof value === 'number' ? value : null;
	}

	const buffStatLabels: Record<string, string> = {
		'atk%': 'ATK% buff',
		'def%': 'DEF% buff',
		'hp%': 'HP% buff',
		em: 'EM buff',
		critRate: 'CR buff',
		critDmg: 'CD buff',
		dmgBonus: 'DMG% buff',
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
		dmgBonus: 'dmg',
		anemoDmgBonus: 'dmg',
		cryoDmgBonus: 'dmg',
		dendroDmgBonus: 'dmg',
		electroDmgBonus: 'dmg',
		geoDmgBonus: 'dmg',
		hydroDmgBonus: 'dmg',
		pyroDmgBonus: 'dmg'
	};

	function collectEffects(ability: (CharacterAbility & { tags?: string[] }) | null): EffectChip[] {
		if (!ability) {
			return [];
		}
		const effects: EffectChip[] = [];
		const seen = new SvelteSet<string>();
		const buffs = ability.buffs ?? [];
		for (const buff of buffs) {
			const stat = buff?.stat;
			if (!stat || seen.has(stat)) {
				continue;
			}
			seen.add(stat);
			const label = buffStatLabels[stat] ?? stat;
			effects.push({ label, tone: buffStatTones[stat] ?? 'misc' });
		}

		const tags = ability.tags ?? [];
		if (tags.some((tag) => tag.toLowerCase().includes('heal'))) {
			effects.push({ label: 'healing', tone: 'heal' });
		}

		return effects;
	}

	function formatSeconds(value: number | null): string {
		return value === null ? '--' : `${value}s`;
	}

	function formatCost(value: number | null): string {
		return value === null ? '--' : `${value}`;
	}

	function isTapVariant(variant: SkillVariant) {
		const key = variant.key.toLowerCase();
		const label = variant.label.toLowerCase();
		return ['tap', 'press', 'main', 'base'].includes(key) || /tap|press|main/.test(label);
	}

	function isHoldVariant(variant: SkillVariant) {
		const key = variant.key.toLowerCase();
		const label = variant.label.toLowerCase();
		return key.startsWith('h') || /hold/.test(label);
	}

	function orderedVariants(variants: SkillVariant[]): SkillVariant[] {
		const used = new SvelteSet<SkillVariant>();
		const ordered: SkillVariant[] = [];
		const tap = variants.find(isTapVariant);
		const hold = variants.find(isHoldVariant);

		if (tap) {
			ordered.push(tap);
			used.add(tap);
		} else if (variants[0]) {
			ordered.push(variants[0]);
			used.add(variants[0]);
		}

		if (hold && !used.has(hold)) {
			ordered.push(hold);
			used.add(hold);
		}

		const other = variants.find((variant) => !used.has(variant));
		if (other) {
			ordered.push(other);
		}

		return ordered;
	}

	function buildAbilityRows(
		skill: CharacterAbility | null,
		burst: CharacterAbility | null,
		overrides: CharacterCardOverride | null
	): AbilityRow[] {
		const rows: AbilityRow[] = [];
		const skillOverrides = overrides?.skill;
		const burstOverrides = overrides?.burst;

		const baseSkillDuration = toNumber(skillOverrides?.duration ?? skill?.duration);
		const baseSkillCooldown = toNumber(skillOverrides?.cooldown ?? skill?.cooldown);

		rows.push({
			kind: 'skill',
			keyLabel: 'E',
			label: 'Elemental Skill',
			name: skill?.name ?? 'Elemental Skill',
			duration: baseSkillDuration,
			cooldown: baseSkillCooldown,
			cost: null,
			effects: collectEffects(skill)
		});

		const variants = skillOverrides?.variants ?? [];
		if (variants.length) {
			for (const variant of orderedVariants(variants)) {
				rows.push({
					kind: 'skill-variant',
					keyLabel: variant.key,
					name: variant.label,
					label: undefined,
					duration: toNumber(variant.duration ?? baseSkillDuration),
					cooldown: toNumber(variant.cooldown ?? baseSkillCooldown),
					cost: null,
					effects: [],
					isVariant: true
				});
			}
		}

		const burstDuration = toNumber(burstOverrides?.duration ?? burst?.duration);
		const burstCooldown = toNumber(burstOverrides?.cooldown ?? burst?.cooldown);
		const burstCost = toNumber(burstOverrides?.energyCost ?? burst?.energyCost);
		rows.push({
			kind: 'burst',
			keyLabel: 'Q',
			label: 'Elemental Burst',
			name: burst?.name ?? 'Elemental Burst',
			duration: burstDuration,
			cooldown: burstCooldown,
			cost: burstCost,
			effects: collectEffects(burst)
		});

		return rows;
	}

	function buildTags(characterData: typeof character, skill: CharacterAbility | null, burst: CharacterAbility | null) {
		const tags: TagItem[] = [];
		const rarity = characterData?.rarity;
		if (rarity === 4 || rarity === 5) {
			tags.push({ label: rarity === 4 ? 'four star' : 'five star' });
		}
		if (characterData?.weapon) {
			tags.push({ label: characterData.weapon.toLowerCase(), iconSrc: weaponIcon });
		}
		const abilityTags = [skill, burst]
			.flatMap((ability) => (ability as (CharacterAbility & { tags?: string[] }) | null)?.tags ?? [])
			.map((tag) => tag.toLowerCase());
		if (abilityTags.some((tag) => tag.includes('heal'))) {
			tags.push({ label: 'heals' });
		} else if ((skill?.buffs?.length ?? 0) + (burst?.buffs?.length ?? 0) > 0) {
			tags.push({ label: 'buffs' });
		}
		return tags.slice(0, 4);
	}

	$: abilityRows = buildAbilityRows(skillAbility, burstAbility, override);
	$: tagList = buildTags(character, skillAbility, burstAbility);

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
					on:error={handlePortraitError}
				/>
				<button class="constellation" aria-label="Select constellation">
					{constellation} <span class="constellation-caret">v</span>
				</button>
				<div class="nameplate">
					<span class="element-icon" aria-hidden="true">
						<img src={`/assets/elements/flat-color/${elementIcon}.png`} alt={elementLabel} />
					</span>
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
				<div class="ability-header-cols">
					<span>DUR</span>
					<span>CD</span>
					<span>COST</span>
					<span>EFFECTS</span>
				</div>
			</div>

			{#each abilityRows as row, index (row.kind + '-' + index)}
				<div class={`ability-row ${row.kind}`}>
					<div class="ability-meta">
						<span class={`key ${row.isVariant ? 'variant-key' : ''}`}>{row.keyLabel}</span>
						<div class="ability-text">
							{#if row.label}
								<span class="ability-label">{row.label}</span>
							{/if}
							<span class={`ability-name ${row.isVariant ? 'variant-name' : ''}`} title={row.name}>
								{row.name}
							</span>
						</div>
					</div>
					<div class="ability-stat">{formatSeconds(row.duration)}</div>
					<div class="ability-stat muted">{formatSeconds(row.cooldown)}</div>
					<div class="ability-stat">{formatCost(row.cost)}</div>
					<div class="ability-effects">
						{#if row.effects.length}
							{#each row.effects as effect (effect.label)}
								<span class={`effect-chip tone-${effect.tone ?? 'misc'}`}>
									<span class="effect-icon"></span>
									<span class="effect-text">{effect.label}</span>
								</span>
							{/each}
						{/if}
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
		--portrait-col-width: 140px;
		--card-radius: 10px;
		--radius-sm: 6px;
		--radius-md: 10px;
		--space-1: 4px;
		--space-2: 6px;
		--space-3: 8px;
		--space-4: 10px;
		--space-5: 12px;
		--space-6: 16px;
		--space-7: 20px;
		--type-xs: 0.5rem;
		--type-sm: 0.6rem;
		--type-md: 0.7rem;
		--type-lg: 0.8rem;
		--type-xl: 1rem;

		width: 100%;
		height: 100%;
	}

	.wide-card-body {
		width: 100%;
		display: grid;
		grid-template-columns: var(--portrait-col-width) minmax(0, 320px);
		align-items: start;
	}

	.profile-card {
		position: relative;
		width: var(--portrait-col-width);
		height: calc(var(--portrait-col-width) * 1.5);
		border-radius: var(--card-radius);
		background: #314265;
		border: 2px solid #314265;
		box-shadow:
			0 2px 0 #060a10,
			0 12px 32px rgba(0, 0, 0, 0.55),
			inset 0 1px 0 rgba(255, 255, 255, 0.03);
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.portrait-frame {
		position: relative;
		width: 100%;
		height: var(--portrait-col-width);
		border-radius: calc(var(--card-radius) - 2px);
		background: radial-gradient(circle at 50% 100%, var(--element-color) -2%, #05091a 100%);
		overflow: hidden;
	}

	/*.portrait-frame::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.75);
		z-index: 1;
		pointer-events: none;
	}*/

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
		gap: 4px;
		padding: 2px 7px 3px;
		background: #314265;
		border: none;
		border-radius: 0 0 0 calc(var(--card-radius) - 2px);
		box-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
		font-family: 'Noto Sans Display Variable', 'Noto Sans Display', sans-serif;
		font-size: var(--type-sm);
		font-weight: 700;
		color: #e7eefc;
		cursor: pointer;
	}

	.constellation-caret {
		font-size: var(--type-xs);
		line-height: 1;
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
		padding: 2px 9px 0 5px;
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
		align-items: center;
	}

	.element-icon img {
		width: 14px;
		height: 14px;
		display: block;
	}

	.name {
		font-family: 'Bitter Variable', 'Bitter', serif;
		font-size: var(--type-lg);
		font-weight: 750;
		color: #e4ecff;
		letter-spacing: 0.04em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.tag-row {
		margin-top: var(--space-2);
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		justify-content: center;
	}

	.tag {
		padding: 1px 5px;
		border-radius: 999px;
		border: 1px solid #6f7fa3;
		font-family: 'Noto Sans Display Variable', 'Noto Sans Display', sans-serif;
		font-size: var(--type-xs);
		font-weight: 600;
		text-transform: lowercase;
		color: #c7d3ef;
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.tag img {
		width: 12px;
		height: 12px;
		object-fit: contain;
		display: block;
	}

	.loadout {
		margin-top: var(--space-3);
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
		margin-top: auto;
	}

	.loadout-empty {
		padding: 2px 4px;
		border-radius: 999px;
		border: 1px dashed #2a3a58;
		background: transparent;
		color: #6f7fa3;
		font-size: var(--type-xs);
		font-weight: 600;
		cursor: pointer;
	}

	.loadout-chip {
		padding: 2px 4px;
		border-radius: 999px;
		border: 1px solid #263552;
		background: #141d31;
		color: #dbe6ff;
		font-size: var(--type-xs);
		font-weight: 600;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ability-card {
		width: 100%;
		border-radius: 0 var(--card-radius) var(--card-radius) 0;
		border: 1px solid #1c2a46;
		box-shadow:
			0 2px 0 #060a10,
			0 10px 36px rgba(0, 0, 0, 0.55),
			inset 0 1px 0 rgba(255, 255, 255, 0.03);
		display: grid;
		grid-auto-rows: min-content;
		overflow: hidden;
		transform: translate(0, 10px);
	}

	.ability-header-row {
		display: grid;
		grid-template-columns: minmax(110px, 1.2fr) 34px 34px 34px minmax(80px, 1fr);
		align-items: center;
		padding: var(--space-1) 0;
		background: #18243F;
		color: #6f7fa3;
		font-size: var(--type-xs);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.ability-header-left {
		height: 1px;
	}

	.ability-header-cols {
		display: grid;
		grid-template-columns: 34px 34px 34px minmax(80px, 1fr);
		align-items: center;
		gap: var(--space-1);
	}

	.ability-row {
		display: grid;
		grid-template-columns: minmax(110px, 1.2fr) 34px 34px 34px minmax(80px, 1fr);
		align-items: center;
		gap: var(--space-1);
		padding: 0 var(--space-1);
		height: 40px;
		background: #18243F;
	}

	.ability-row.skill-variant {
		background: rgba(9, 14, 26, 0.2);
		padding-left: var(--space-4);
		height: 20px;
	}

	.ability-meta {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}

	.key {
		flex-shrink: 0;
		padding: 1px 5px;
		border-radius: var(--radius-sm);
		background: #e7eefc;
		color: #05091a;
		font-family: 'Bitter Variable', 'Bitter', serif;
		font-size: var(--type-xs);
		font-weight: 800;
		line-height: 1;
		text-transform: uppercase;
	}

	.key.variant-key {
		background: #222f4a;
		color: #d4e0fb;
		font-family: 'Noto Sans Display Variable', 'Noto Sans Display', sans-serif;
		font-size: 0.44rem;
		text-transform: lowercase;
	}

	.ability-text {
		min-width: 0;
		display: grid;
		gap: 1px;
	}

	.ability-label {
		font-size: 0.42rem;
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
		font-size: 0.5rem;
		font-weight: 600;
		color: #c7d3ef;
	}

	.ability-stat {
		font-size: var(--type-lg);
		font-weight: 500;
		color: #e7eefc;
		font-variant-numeric: tabular-nums;
	}

	.ability-stat.muted {
		color: #6f7fa3;
	}

	.ability-effects {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		min-height: 14px;
	}

	.effect-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 4px;
		border-radius: 999px;
		background: #101a2f;
		border: 1px solid #233252;
		color: #d4def7;
		font-size: 0.44rem;
		font-weight: 600;
	}

	.effect-icon {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		background: #7c89a6;
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
	}

	.effect-chip.tone-atk .effect-icon {
		background: #f25f5c;
	}
	.effect-chip.tone-def .effect-icon {
		background: #4b88ff;
	}
	.effect-chip.tone-hp .effect-icon {
		background: #f3a712;
	}
	.effect-chip.tone-em .effect-icon {
		background: #4cd4b0;
	}
	.effect-chip.tone-crit .effect-icon {
		background: #d977ff;
	}
	.effect-chip.tone-dmg .effect-icon {
		background: #f7c948;
	}
	.effect-chip.tone-heal .effect-icon {
		background: #6ee7b7;
	}
</style>
