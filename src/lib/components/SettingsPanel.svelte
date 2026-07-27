<script lang="ts">
	import { constellations, loadout, ownership, savedNotations, siteSettings } from '$lib/stores';
	import {
		downloadBackup,
		parseBackup,
		applyBackup,
		type BackupCounts
	} from '$lib/utils/settingsBackup';

	// Two-click confirm shared across the reset buttons: a button is "armed" on
	// first click, fires on the second, and disarms on blur or when another arms.
	let armedReset = $state<string | null>(null);
	function reset(key: string, fn: () => void) {
		if (armedReset !== key) {
			armedReset = key;
			return;
		}
		fn();
		armedReset = null;
	}

	function clearEverything() {
		constellations.clear();
		ownership.clear();
		loadout.clear();
		savedNotations.clear();
	}

	// Import flow: pick file → parse+validate → show a summary → confirm → apply
	// + reload (stores only read localStorage at module init, so a reload is the
	// clean way to re-hydrate the whole app at once).
	let fileInput: HTMLInputElement | undefined = $state();
	let pending = $state<{ data: ReturnType<typeof parseBackup>; counts: BackupCounts } | null>(null);
	let importError = $state<string | null>(null);

	async function onFileChosen(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = ''; // allow re-picking the same file
		if (!file) return;
		importError = null;
		pending = null;
		const res = parseBackup(await file.text());
		if (!res.ok) {
			importError = res.error;
			return;
		}
		pending = { data: res, counts: res.counts };
	}

	function confirmImport() {
		if (!pending || !pending.data.ok) return;
		applyBackup(pending.data.data);
		location.reload();
	}

	function cancelImport() {
		pending = null;
		importError = null;
	}
</script>

<div class="sp">
	<section class="sp-section">
		<h2 class="sp-section-title">Display</h2>

		<label class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Updated outfits</span>
				<span class="sp-desc">Prefer characters’ newest outfit art where one exists.</span>
			</span>
			<button
				class="sp-toggle"
				class:sp-toggle--on={$siteSettings.useNewOutfits}
				role="switch"
				aria-checked={$siteSettings.useNewOutfits}
				onclick={() => siteSettings.setUseNewOutfits(!$siteSettings.useNewOutfits)}
			>
				<span class="sp-toggle-track"><span class="sp-toggle-thumb"></span></span>
				<span class="sp-toggle-label">{$siteSettings.useNewOutfits ? 'On' : 'Off'}</span>
			</button>
		</label>

		<div class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Traveler</span>
				<span class="sp-desc">Which twin appears wherever a Traveler is shown.</span>
			</span>
			<div class="sp-segment" role="radiogroup" aria-label="Traveler variant">
				{#each [['aether', 'Aether'], ['lumine', 'Lumine']] as const as [value, label] (value)}
					<button
						class="sp-segment-opt"
						class:sp-segment-opt--active={$siteSettings.travelerVariant === value}
						role="radio"
						aria-checked={$siteSettings.travelerVariant === value}
						onclick={() => siteSettings.setTravelerVariant(value)}>{label}</button
					>
				{/each}
			</div>
		</div>

		<div class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Swap ping</span>
				<span class="sp-desc">
					Your network latency — the ms value Genshin shows top-right. The rotation planner adds a
					matching delay to every character swap so timings reflect real play.
				</span>
			</span>
			<div class="sp-slider-ctl">
				<input
					class="slider sp-slider"
					type="range"
					min="0"
					max="200"
					step="5"
					value={$siteSettings.swapPing}
					oninput={(e) => siteSettings.setSwapPing(Number(e.currentTarget.value))}
					aria-label="Swap ping in milliseconds"
				/>
				<span class="sp-slider-value">{$siteSettings.swapPing}ms</span>
			</div>
		</div>
	</section>

	<section class="sp-section">
		<h2 class="sp-section-title">Your data</h2>

		<div class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Backup</span>
				<span class="sp-desc">
					critcalc keeps nothing on a server — your roster, loadouts, and saved rotations live in
					this browser. Download a file to back them up or move them to another device.
				</span>
			</span>
			<button class="sp-btn" onclick={() => downloadBackup()}>Export…</button>
		</div>

		<div class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Restore</span>
				<span class="sp-desc">Load a backup file. This replaces everything on this device.</span>
			</span>
			<button class="sp-btn" onclick={() => fileInput?.click()}>Import…</button>
			<input
				bind:this={fileInput}
				type="file"
				accept="application/json,.json"
				class="sp-file-input"
				onchange={onFileChosen}
			/>
		</div>

		{#if importError}
			<div class="sp-feedback">
				<p class="sp-import-error" role="alert">{importError}</p>
			</div>
		{/if}

		{#if pending}
			<div class="sp-feedback">
				<div class="sp-import-confirm">
					<p class="sp-import-summary">
						This backup holds
						<strong>{pending.counts.owned}</strong> owned characters,
						<strong>{pending.counts.loadouts}</strong> loadouts, and
						<strong>{pending.counts.rotations}</strong> saved rotations. Replace your current data?
					</p>
					<div class="sp-import-actions">
						<button class="sp-btn sp-btn--danger" onclick={confirmImport}>Replace & reload</button>
						<button class="sp-btn" onclick={cancelImport}>Cancel</button>
					</div>
				</div>
			</div>
		{/if}
	</section>

	<section class="sp-section sp-section--danger">
		<h2 class="sp-section-title">Reset saved data</h2>

		{#each [['constellations', 'Constellation levels', 'Clears every saved constellation level.', () => constellations.clear()], ['loadout', 'Loadout labels', 'Clears every saved weapon and artifact label.', () => loadout.clear()], ['ownership', 'Roster ownership', 'Clears which characters are marked owned or wishlisted.', () => ownership.clear()], ['notations', 'Saved rotations', 'Deletes every rotation in your save bank.', () => savedNotations.clear()]] as const as [key, name, desc, fn] (key)}
			<div class="sp-row">
				<span class="sp-label">
					<span class="sp-name">{name}</span>
					<span class="sp-desc">{desc}</span>
				</span>
				<button
					class="sp-reset"
					class:sp-reset--armed={armedReset === key}
					onclick={() => reset(key, fn)}
					onblur={() => armedReset === key && (armedReset = null)}
				>
					{armedReset === key ? 'Confirm' : 'Clear'}
				</button>
			</div>
		{/each}

		<div class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Everything</span>
				<span class="sp-desc">Clears all of the above at once. Display settings are kept.</span>
			</span>
			<button
				class="sp-reset sp-reset--all"
				class:sp-reset--armed={armedReset === 'all'}
				onclick={() => reset('all', clearEverything)}
				onblur={() => armedReset === 'all' && (armedReset = null)}
			>
				{armedReset === 'all' ? 'Confirm clear all' : 'Clear all'}
			</button>
		</div>
	</section>
</div>

<style>
	.sp {
		display: flex;
		flex-direction: column;
		gap: 1.4rem;
	}

	.sp-section {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		overflow: hidden;
		background: var(--surface-raised);
	}

	.sp-section-title {
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		color: var(--muted);
		margin: 0;
		padding: 0.55rem 0.9rem;
		border-bottom: 1px solid var(--border);
	}

	.sp-section--danger .sp-section-title {
		color: #c0604a;
	}

	.sp-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.2rem;
		padding: 0.8rem 0.9rem;
		border-bottom: 1px solid var(--border);
	}

	.sp-row:last-child {
		border-bottom: none;
	}

	/* Full-width block below the Restore row for the import error / confirm UI. */
	.sp-feedback {
		padding: 0.8rem 0.9rem;
	}

	.sp-label {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.sp-name {
		font-weight: var(--fw-semibold);
		font-size: var(--fs-md);
		color: var(--text);
	}

	.sp-desc {
		font-size: var(--fs-sm);
		color: var(--muted);
		line-height: var(--lh-snug);
	}

	/* Toggle */
	.sp-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.sp-toggle-track {
		position: relative;
		display: block;
		width: 2.4rem;
		height: 1.35rem;
		border-radius: 999px;
		background: var(--border);
		transition: background 180ms ease;
	}

	.sp-toggle--on .sp-toggle-track {
		background: #4a8c6a;
	}

	.sp-toggle-thumb {
		position: absolute;
		top: 0.175rem;
		left: 0.175rem;
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		background: #fff;
		transition: transform 180ms ease;
	}

	.sp-toggle--on .sp-toggle-thumb {
		transform: translateX(1.05rem);
	}

	.sp-toggle-label {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--muted);
		min-width: 1.6rem;
	}

	/* Segmented picker */
	.sp-segment {
		display: flex;
		flex-shrink: 0;
		border: 1px solid var(--border);
		border-radius: 0.3rem;
		overflow: hidden;
	}

	.sp-segment-opt {
		padding: 0.35rem 0.8rem;
		border: none;
		background: none;
		color: var(--muted);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease;
	}

	.sp-segment-opt + .sp-segment-opt {
		border-left: 1px solid var(--border);
	}

	.sp-segment-opt:hover {
		color: var(--text);
	}

	.sp-segment-opt--active {
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		color: var(--text);
	}

	/* Slider */
	.sp-slider-ctl {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-shrink: 0;
	}

	.sp-slider {
		width: 8rem;
	}

	.sp-slider-value {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--muted);
		min-width: 3.4rem;
		text-align: right;
	}

	/* Buttons */
	.sp-btn {
		flex-shrink: 0;
		padding: 0.4rem 0.9rem;
		border-radius: 0.3rem;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition:
			background 150ms ease,
			border-color 150ms ease;
	}

	.sp-btn:hover {
		border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
	}

	.sp-btn--danger {
		border-color: #c0604a;
		background: #c0604a;
		color: #fff;
	}

	.sp-btn--danger:hover {
		background: #a04030;
		border-color: #a04030;
	}

	.sp-file-input {
		display: none;
	}

	.sp-import-error {
		margin: 0;
		font-size: var(--fs-sm);
		color: #c0604a;
	}

	.sp-import-confirm {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid color-mix(in srgb, #c0604a 45%, var(--border));
		border-radius: 0.35rem;
		background: color-mix(in srgb, #c0604a 8%, transparent);
	}

	.sp-import-summary {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--lh-snug);
		color: var(--text);
	}

	.sp-import-actions {
		display: flex;
		gap: 0.5rem;
	}

	/* Reset buttons */
	.sp-reset {
		flex-shrink: 0;
		padding: 0.35rem 0.8rem;
		border-radius: 0.3rem;
		border: 1px solid #c0604a44;
		background: transparent;
		color: #c0604a;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		white-space: nowrap;
		transition:
			background 150ms ease,
			border-color 150ms ease;
	}

	.sp-reset:hover {
		background: #c0604a18;
		border-color: #c0604a88;
	}

	.sp-reset--armed {
		background: #c0604a;
		border-color: #c0604a;
		color: #fff;
	}

	.sp-reset--armed:hover {
		background: #a04030;
		border-color: #a04030;
	}
</style>
