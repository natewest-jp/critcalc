<script lang="ts">
	import { constellations, loadout, siteSettings } from '$lib/stores';

	let constellationClearConfirm = $state(false);
	let loadoutClearConfirm = $state(false);

	function clearConstellations() {
		if (!constellationClearConfirm) {
			constellationClearConfirm = true;
			return;
		}
		constellations.clear();
		constellationClearConfirm = false;
	}

	function clearLoadout() {
		if (!loadoutClearConfirm) {
			loadoutClearConfirm = true;
			return;
		}
		loadout.clear();
		loadoutClearConfirm = false;
	}
</script>

<div class="settings-page">
	<h1 class="page-title">Site settings</h1>

	<section class="settings-section">
		<h2 class="section-title">Display</h2>

		<label class="setting-row">
			<span class="setting-label">
				<span class="setting-name">New character outfits</span>
				<span class="setting-description">Show alternate outfits for characters that have one</span>
			</span>
			<button
				class="toggle"
				class:toggle--on={$siteSettings.useNewOutfits}
				role="switch"
				aria-checked={$siteSettings.useNewOutfits}
				onclick={() => siteSettings.setUseNewOutfits(!$siteSettings.useNewOutfits)}
			>
				<span class="toggle__track">
					<span class="toggle__thumb"></span>
				</span>
				<span class="toggle__label">{$siteSettings.useNewOutfits ? 'On' : 'Off'}</span>
			</button>
		</label>

		<div class="setting-row">
			<span class="setting-label">
				<span class="setting-name">Traveler</span>
				<span class="setting-description">Which twin appears wherever a Traveler is shown</span>
			</span>
			<div class="segment" role="radiogroup" aria-label="Traveler variant">
				{#each [['aether', 'Aether'], ['lumine', 'Lumine']] as const as [value, label] (value)}
					<button
						class="segment__option"
						class:segment__option--active={$siteSettings.travelerVariant === value}
						role="radio"
						aria-checked={$siteSettings.travelerVariant === value}
						onclick={() => siteSettings.setTravelerVariant(value)}>{label}</button
					>
				{/each}
			</div>
		</div>
	</section>

	<section class="settings-section settings-section--danger">
		<h2 class="section-title">Reset saved data</h2>

		<div class="setting-row">
			<span class="setting-label">
				<span class="setting-name">Constellation levels</span>
				<span class="setting-description"
					>Clears all saved constellation levels for every character</span
				>
			</span>
			<button
				class="reset-button"
				class:reset-button--confirm={constellationClearConfirm}
				onclick={clearConstellations}
				onblur={() => (constellationClearConfirm = false)}
			>
				{constellationClearConfirm ? 'Confirm clear' : 'Clear'}
			</button>
		</div>

		<div class="setting-row">
			<span class="setting-label">
				<span class="setting-name">Loadout labels</span>
				<span class="setting-description"
					>Clears all saved weapon and artifact labels for every character</span
				>
			</span>
			<button
				class="reset-button"
				class:reset-button--confirm={loadoutClearConfirm}
				onclick={clearLoadout}
				onblur={() => (loadoutClearConfirm = false)}
			>
				{loadoutClearConfirm ? 'Confirm clear' : 'Clear'}
			</button>
		</div>
	</section>
</div>

<style>
	.settings-page {
		max-width: 640px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0;
	}

	.settings-section {
		display: flex;
		flex-direction: column;
		gap: 0;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		overflow: hidden;
		background: var(--surface-raised);
	}

	.section-title {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		margin: 0;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid var(--border);
	}

	.settings-section--danger .section-title {
		color: #c0604a;
	}

	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		padding: 0.85rem 1rem;
		border-bottom: 1px solid var(--border);
	}

	.setting-row:last-child {
		border-bottom: none;
	}

	.setting-label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.setting-name {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.setting-description {
		font-size: 0.78rem;
		color: var(--muted);
		line-height: 1.4;
	}

	/* Toggle */
	.toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.toggle__track {
		position: relative;
		display: block;
		width: 2.4rem;
		height: 1.35rem;
		border-radius: 999px;
		background: var(--border);
		transition: background 180ms ease;
	}

	.toggle--on .toggle__track {
		background: #4a8c6a;
	}

	.toggle__thumb {
		position: absolute;
		top: 0.175rem;
		left: 0.175rem;
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		background: #fff;
		transition: transform 180ms ease;
	}

	.toggle--on .toggle__thumb {
		transform: translateX(1.05rem);
	}

	.toggle__label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--muted);
		min-width: 1.8rem;
	}

	/* Segmented picker */
	.segment {
		display: flex;
		flex-shrink: 0;
		border: 1px solid var(--border);
		border-radius: 0.3rem;
		overflow: hidden;
	}

	.segment__option {
		padding: 0.35rem 0.8rem;
		border: none;
		background: none;
		color: var(--muted);
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease;
	}

	.segment__option + .segment__option {
		border-left: 1px solid var(--border);
	}

	.segment__option:hover {
		color: var(--text);
	}

	.segment__option--active {
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		color: var(--text);
	}

	/* Reset buttons */
	.reset-button {
		flex-shrink: 0;
		padding: 0.35rem 0.8rem;
		border-radius: 0.3rem;
		border: 1px solid #c0604a44;
		background: transparent;
		color: #c0604a;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 150ms ease,
			border-color 150ms ease;
		white-space: nowrap;
	}

	.reset-button:hover {
		background: #c0604a18;
		border-color: #c0604a88;
	}

	.reset-button--confirm {
		background: #c0604a;
		border-color: #c0604a;
		color: #fff;
	}

	.reset-button--confirm:hover {
		background: #a04030;
		border-color: #a04030;
	}
</style>
