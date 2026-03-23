<script lang="ts">
	import { onMount } from 'svelte';
	import { getCharacterById, type CharacterAbility } from '$lib/data/characterLookup';
	import {
		getCharacterCardOverride,
		type CharacterCardOverride,
		type SkillVariant,
		type SkillOverride,
		type BurstOverride
	} from '$lib/data/characterCardOverrides';
	import { getAvatar, getAvatarFallback } from '$lib/utils/getAvatar';

	export let characterId = 'bennett';
	export let constellation = 'C6';

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

	type StatCell = {
		label?: string;
		value: number | string;
		muted?: boolean;
	};
	type StatSlot = {
		entries: StatCell[];
		variantLabel?: string;
		kind?: 'buffs';
	};

	let cardEl: HTMLDivElement;
	let useFallbackPortrait = false;
	let character:
		| { name: string; abilities?: CharacterAbility[]; element?: string; weapon?: string }
		| null = null;
	let abilities: CharacterAbility[] = [];
	let skillAbility: CharacterAbility | null = null;
	let burstAbility: CharacterAbility | null = null;
	let override: CharacterCardOverride | null = null;
	let displayName = 'Unknown';
	let portraitPreferredSrc = '';
	let portraitFallbackSrc = '';
	let portraitSrc = '';
	let skillSlots: StatSlot[] = [];
	let burstSlots: StatSlot[] = [];
	let skillNoICD = false;
	let skillSnapshots = false;
	let burstNoICD = false;
	let burstSnapshots = false;
	let elementLabel = 'Pyro';
	let elementIcon = 'pyro';
	let weaponType = 'Sword';
	let weaponIcon = '/assets/weapon-types/sword.webp';

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
		const knownWeapons = new Set(['sword', 'claymore', 'polearm', 'catalyst', 'bow']);
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
	$: skillNoICD = Boolean(skillAbility?.noICD);
	$: skillSnapshots = Boolean(skillAbility?.snapshots);
	$: burstNoICD = Boolean(burstAbility?.noICD);
	$: burstSnapshots = Boolean(burstAbility?.snapshots);

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
		dmgBonus: 'DMG%',
		anemoDmgBonus: 'Anemo%',
		cryoDmgBonus: 'Cryo%',
		dendroDmgBonus: 'Dendro%',
		electroDmgBonus: 'Electro%',
		geoDmgBonus: 'Geo%',
		hydroDmgBonus: 'Hydro%',
		pyroDmgBonus: 'Pyro%'
	};

	function formatBuffStat(stat: string): string {
		return buffStatLabels[stat] ?? stat;
	}

	function collectBuffLabels(buffs: Array<{ stat?: string }> | undefined): string[] {
		if (!buffs || buffs.length === 0) {
			return [];
		}

		const labels: string[] = [];
		const seen = new Set<string>();
		for (const buff of buffs) {
			if (!buff?.stat) {
				continue;
			}
			const label = formatBuffStat(buff.stat);
			if (!seen.has(label)) {
				seen.add(label);
				labels.push(label);
			}
		}

		return labels;
	}

	function buildBuffEntries(buffLabels: string[]): StatCell[] {
		return buffLabels.map((label, index) => ({
			label: index === 0 ? 'buffs' : undefined,
			value: label
		}));
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

	function buildSkillSlots(
		skill: CharacterAbility | null,
		overrides: SkillOverride | undefined
	): StatSlot[] {
		const slots: StatSlot[] = [];
		const baseDuration = toNumber(overrides?.duration ?? skill?.duration);
		const baseCooldown = toNumber(overrides?.cooldown ?? skill?.cooldown);
		const variants = overrides?.variants ?? [];

		if (variants.length > 0) {
			const used = new Set<SkillVariant>();
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

			const showVariantLabels = ordered.length > 1;

			for (const variant of ordered) {
				const duration = toNumber(variant.duration ?? baseDuration);
				const cooldown = toNumber(variant.cooldown ?? baseCooldown);
				const entries: StatCell[] = [];

				if (duration !== null) {
					entries.push({ label: 'duration', value: duration });
				}
				if (cooldown !== null) {
					entries.push({ label: 'cooldown', value: cooldown, muted: true });
				}

				if (entries.length) {
					slots.push({
						entries,
						variantLabel: showVariantLabels ? variant.label : undefined
					});
				}
			}
		} else {
			const entries: StatCell[] = [];
			if (baseDuration !== null) {
				entries.push({ label: 'duration', value: baseDuration });
			}
			if (baseCooldown !== null) {
				entries.push({ label: 'cooldown', value: baseCooldown, muted: true });
			}
			if (entries.length) {
				slots.push({ entries });
			}
		}

		const buffLabels = collectBuffLabels(skill?.buffs);
		if (buffLabels.length) {
			slots.push({
				entries: buildBuffEntries(buffLabels),
				kind: 'buffs'
			});
		}

		return slots;
	}

	function buildBurstSlots(
		burst: CharacterAbility | null,
		overrides: BurstOverride | undefined
	): StatSlot[] {
		const duration = toNumber(overrides?.duration ?? burst?.duration);
		const cooldown = toNumber(overrides?.cooldown ?? burst?.cooldown);
		const energyCost = toNumber(overrides?.energyCost ?? burst?.energyCost);
		const slots: StatSlot[] = [];

		if (duration !== null) {
			slots.push({ entries: [{ label: 'duration', value: duration }] });
		}
		if (cooldown !== null) {
			slots.push({ entries: [{ label: 'cooldown', value: cooldown, muted: true }] });
		}
		if (energyCost !== null) {
			slots.push({ entries: [{ label: 'cost', value: energyCost }] });
		}

		const buffLabels = collectBuffLabels(burst?.buffs);
		if (buffLabels.length) {
			slots.push({
				entries: buildBuffEntries(buffLabels),
				kind: 'buffs'
			});
		}

		return slots;
	}

	$: skillSlots = buildSkillSlots(skillAbility, override?.skill);
	$: burstSlots = buildBurstSlots(burstAbility, override?.burst);

	onMount(() => {
		if (!cardEl || typeof ResizeObserver === 'undefined') {
			return;
		}

		const styles = getComputedStyle(cardEl);
		const baseWidth = parseFloat(styles.getPropertyValue('--card-width')) || 320;
		const baseHeight = parseFloat(styles.getPropertyValue('--card-height')) || 180;

		const updateScale = (width: number, height: number) => {
			const next = Math.min(width / baseWidth, height / baseHeight);
			cardEl.style.setProperty('--scale', next.toString());
		};

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				updateScale(width, height);
			}
		});

		observer.observe(cardEl);

		const rect = cardEl.getBoundingClientRect();
		updateScale(rect.width, rect.height);

		return () => observer.disconnect();
	});
</script>

<div
	class="card"
	style:--element-color={elementColor}
	style:--element-border={elementBorder}
	style:--element-dark={elementDark}
	bind:this={cardEl}
>
	<div class="card-body">
		<div class="bio-col">
			<div class="bio">
				<img
					src={portraitSrc}
					alt={displayName}
					class="portrait"
					on:error={handlePortraitError}
				/>
				<img src={weaponIcon} alt={weaponType} class="weapon-type" />
				<button class="constellation" aria-label="Select constellation">
					{constellation} <span class="constellation-caret">▾</span>
				</button>
				<!-- Avatar image goes here; gradient placeholder for now -->
			</div>

			<div class="nameplate">
				<span class="element-icon" aria-hidden="true">
					<img src={`/assets/elements/flat-color/${elementIcon}.png`} alt={elementLabel} />
				</span>
				<span class="name">{displayName}</span>
			</div>
		</div>

		<div class="stats">
			{#if skillSlots.length}
				<section class="ability">
					<header class="ability-header">
						<span class="key">E</span>
						<span class="title">Elemental Skill</span>
						{#if skillNoICD || skillSnapshots}
							<span class="icon-group">
								{#if skillNoICD}
									<span class="icon icd" title="No ICD">
										<img src="/noicd.svg" alt="" aria-hidden="true" />
									</span>
								{/if}
								{#if skillSnapshots}
									<span class="icon snapshot" title="Snapshotting">
										<img src="/snapshots.svg" alt="" aria-hidden="true" />
									</span>
								{/if}
							</span>
						{/if}
					</header>

					<div
						class="stat-row"
						style:--stat-columns={skillSlots.length}
					>
						{#each skillSlots as slot, index (slot.variantLabel ?? slot.kind ?? 'skill' + '-' + index)}
							<div class={`stat-slot ${slot.kind === 'buffs' ? 'buffs' : ''}`}>
								<div class="stat-entry-row">
									{#each slot.entries as entry}
										<div class="stat-entry">
											{#if entry.label}
												<span class={`label ${entry.muted ? 'muted' : ''}`}>{entry.label}</span>
											{/if}
											<span class={`value ${entry.muted ? 'muted' : ''}`}>{entry.value}</span>
										</div>
									{/each}
								</div>
								{#if slot.variantLabel}
									<span class="variant">{slot.variantLabel}</span>
								{/if}
							</div>
						{/each}
					</div>
				</section>
			{/if}

			{#if burstSlots.length}
				<section class="ability">
					<header class="ability-header">
						<span class="key">Q</span>
						<span class="title">Elemental Burst</span>
						{#if burstNoICD || burstSnapshots}
							<span class="icon-group">
								{#if burstNoICD}
									<span class="icon icd" title="No ICD">
										<img src="/noicd.svg" alt="" aria-hidden="true" />
									</span>
								{/if}
								{#if burstSnapshots}
									<span class="icon snapshot" title="Snapshotting">
										<img src="/snapshots.svg" alt="" aria-hidden="true" />
									</span>
								{/if}
							</span>
						{/if}
					</header>

					<div
						class="stat-row"
						style:--stat-columns={burstSlots.length}
					>
						{#each burstSlots as slot, index (slot.variantLabel ?? slot.kind ?? 'burst' + '-' + index)}
							<div class={`stat-slot ${slot.kind === 'buffs' ? 'buffs' : ''}`}>
								<div class="stat-entry-row">
									{#each slot.entries as entry}
										<div class="stat-entry">
											{#if entry.label}
												<span class={`label ${entry.muted ? 'muted' : ''}`}>{entry.label}</span>
											{/if}
											<span class={`value ${entry.muted ? 'muted' : ''}`}>{entry.value}</span>
										</div>
									{/each}
								</div>
								{#if slot.variantLabel}
									<span class="variant">{slot.variantLabel}</span>
								{/if}
							</div>
						{/each}
					</div>
				</section>
			{/if}
		</div>
	</div>
</div>

<style>
	.card {
		--element-color: #d95a2b;
		--element-border: #a01e14;
		--card-width: 350px;
		--card-height: 200px;
		--card-aspect: 7 / 4;
		--portrait-width: 150px;
		--portrait-height: 150px;
		--card-radius: 12px;
		--portrait-radius: 12px;
		--radius-2xs: 2px;
		--radius-xs: 3px;
		--radius-sm: 4px;
		--space-1: 2px;
		--space-2: 4px;
		--space-3: 6px;
		--space-4: 7px;
		--space-5: 8px;
		--space-6: 10px;
		--space-7: 12px;
		--space-8: 14px;
		--space-9: 16px;
		--stat-row-height: 64px;
		--type-2xs: 0.5rem;
		--type-xs: 0.5625rem;
		--type-sm: 0.65rem;
		--type-lg: 1rem;
		--type-md: 0.8rem;
		--type-xl: 2.5rem;
		--type-icon: 0.75rem;
		--scale: 1;

		width: 100%;
		height: 100%;
		aspect-ratio: var(--card-aspect);
		display: grid;
		place-items: center;
	}

	.card-body {
		width: var(--card-width);
		height: var(--card-height);
		transform-origin: center;
		transform: scale(var(--scale));
		display: grid;
		grid-template-columns: var(--portrait-width) 1fr;
		background: #0e1627;
		border: 1px solid #1a2540;
		border-radius: var(--card-radius);
		overflow: visible;
		box-shadow:
			0 2px 0 #060a10,
			0 8px 40px rgba(0, 0, 0, 0.55),
			inset 0 1px 0 rgba(255, 255, 255, 0.03);
	}

	.bio-col {
		position: relative;
		width: var(--portrait-width);
		display: grid;
		grid-template-rows: min-content min-content;
		align-content: start;
	}

	.bio {
		position: absolute;
		top: -4px;
		left: -4px;
		background: linear-gradient(160deg, var(--element-dark) 0%, var(--element-border) 100%);
		border: 1px solid var(--element-border);
		border-radius: var(--portrait-radius);
		width: var(--portrait-width);
		height: var(--portrait-height);
		overflow: hidden;
	}

	.portrait {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	.weapon-type {
		position: absolute;
		top: 30px;
		left: 7px;
		width: 23px;
		height: 23px;
		object-fit: contain;
		display: block;
	}

	.constellation {
		position: absolute;
		top: 6px;
		left: 6px;
		display: inline-flex;
		align-items: center;
		padding: var(--space-1) var(--space-4);
		background: var(--element-dark);
		border: 1px solid var(--element-border);
		border-radius: var(--card-radius);
		font-family: 'Noto Sans Display Variable';
		font-size: var(--type-sm);
		font-weight: 700;
		color: #fff;
		cursor: pointer;
		transition: background 0.15s;
	}
	.constellation:hover {
		background: var(--element-dark);
	}
	.constellation-caret {
		font-size: var(--type-sm);
		line-height: 1;
	}

	.nameplate {
		position: absolute;
		top: calc(var(--portrait-height));
		left: -8px;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		padding: var(--space-6) var(--space-7);
	}

	.element-icon {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		color: var(--element-color);
	}
	.element-icon img {
		width: 20px;
		height: 20px;
		display: block;
		transform: translateY(-2px);
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
	}

	.stats {
		display: grid;
		grid-auto-rows: min-content;
		align-items: start;
		align-content: start;
		gap: var(--space-6);
		padding: var(--space-6) var(--space-8) var(--space-6) var(--space-2);
		font-family: 'Noto Sans Display Variable', 'Noto Sans Display', sans-serif;
	}

	.ability {
		display: grid;
		grid-template-rows: min-content var(--stat-row-height);
		gap: var(--space-4);
	}

	.ability-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.ability-header .icon-group {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.title {
		display: inline-flex;
		font-family: 'Bitter Variable', 'Bitter', serif;
		font-size: var(--type-sm);
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.icon {
		--icon-size: 0.68rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: var(--type-icon);
	}
	.icon img {
		display: block;
		height: var(--icon-size);
		width: auto;
	}
	.icon.snapshot img {
		transform: translateY(-1px);
		margin-left: 2px;
	}
	.icon.icd {
		--icon-size: 0.5rem;
	}

	.stat-row {
		--stat-columns: 3;
		display: grid;
		grid-template-columns: repeat(var(--stat-columns), max-content);
		position: relative;
		justify-content: start;
		justify-items: start;
		align-items: start;
		line-height: 1;
		height: var(--stat-row-height);
		align-content: start;
		column-gap: var(--space-6);
		row-gap: var(--space-3);
	}

	.stat-slot {
		display: grid;
		justify-items: start;
		align-content: start;
		row-gap: var(--space-1);
		text-align: left;
	}

	.stat-entry-row {
		display: flex;
		align-items: flex-start;
		gap: var(--space-6);
	}

	.stat-slot.buffs .stat-entry-row {
		flex-direction: column;
		gap: var(--space-3);
	}

	.stat-entry {
		display: grid;
		row-gap: var(--space-1);
	}

	.key {
		justify-self: center;
		flex-shrink: 0;
		padding: 2px 3px 1px;
		border-radius: var(--radius-xs);
		background: #fff;
		color: #05091a;
		font-family: 'Bitter Variable', 'Bitter', serif;
		font-size: var(--type-xs);
		font-weight: 800;
		line-height: 1;
		letter-spacing: 0;
	}

	.variant {
		font-family: 'Noto Sans Variable', 'Noto Sans', sans-serif;
		font-size: var(--type-2xs);
		font-weight: 700;
		border-radius: var(--radius-sm);
		padding: 1px var(--space-2);
		white-space: nowrap;
		align-self: start;
		margin-top: var(--space-1);
	}

	.value {
		display: inline-flex;
		align-items: center;
		font-size: var(--type-xl);
		font-weight: 500;
		line-height: 1;
		letter-spacing: -0.01em;
		text-align: left;
		font-variant-numeric: tabular-nums;
	}

	.label {
		font-size: var(--type-2xs);
		font-weight: 800;
		line-height: 1;
		letter-spacing: 0.04em;
		white-space: nowrap;
	}

	.stat-slot.buffs .value {
		font-size: var(--type-md);
		font-weight: 650;
		line-height: 1.2;
	}
	
	.muted {
		color: #4e6080;
	}
	.muted.key {
		color: #05091a;
		background-color: #9CA6B8;
	}

	/* ════════════════════════════════════════
     RESPONSIVE — mobile
     Portrait becomes a small circle avatar;
     Stats layout identical, just narrower.
  ════════════════════════════════════════ */
	@media (max-width: 520px) {
		.card {
			--portrait-width: 72px;
		}

		.card-body {
			grid-template-columns: 1fr;
		}

		/* Portrait becomes a square that we clip to a circle */
		.portrait {
			width: 72px;
			height: 72px;
			min-height: unset;
			border-radius: 50%;
			margin: 14px auto 0;
			border: 2px solid var(--element-border);
			box-shadow: 0 0 0 3px #0e1627;
			overflow: hidden;
		}

		/* Hide nameplate text on mobile — name moves to top of stats col */
		.nameplate {
			display: none;
		}

		.stats {
			padding: var(--space-7) var(--space-8);
		}

		/* Inject name at top of stats col on mobile via a sibling trick —
       Instead, the nameplate is simply kept but repositioned.
       In SvelteKit you can conditionally render two separate elements.
       For this demo we show it via a mobile-only pseudo-header. */
	}
</style>
