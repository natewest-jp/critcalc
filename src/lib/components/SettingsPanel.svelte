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
		<h2 class="kicker sp-section-title">Display</h2>

		<label class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Updated outfits</span>
				<span class="sp-desc">Prefer characters’ newest outfit art where one exists.</span>
			</span>
			<span class="toggle">
				<input
					type="checkbox"
					checked={$siteSettings.useNewOutfits}
					onchange={() => siteSettings.setUseNewOutfits(!$siteSettings.useNewOutfits)}
				/>
				<span class="toggle-track"><span class="toggle-thumb"></span></span>
				<span class="toggle-label">{$siteSettings.useNewOutfits ? 'On' : 'Off'}</span>
			</span>
		</label>

		<div class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Traveler</span>
				<span class="sp-desc">Which twin appears wherever a Traveler is shown.</span>
			</span>
			<div class="segment sp-segment" role="radiogroup" aria-label="Traveler variant">
				{#each [['aether', 'Aether'], ['lumine', 'Lumine']] as const as [value, label] (value)}
					<button
						class="btn"
						class:is-active={$siteSettings.travelerVariant === value}
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
		<h2 class="kicker sp-section-title">Your data</h2>

		<div class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Backup</span>
				<span class="sp-desc">
					critcalc keeps nothing on a server — your roster, loadouts, and saved rotations live in
					this browser. Download a file to back them up or move them to another device.
				</span>
			</span>
			<button class="btn btn--primary" onclick={() => downloadBackup()}>Export…</button>
		</div>

		<div class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Restore</span>
				<span class="sp-desc">Load a backup file. This replaces everything on this device.</span>
			</span>
			<button class="btn btn--primary" onclick={() => fileInput?.click()}>Import…</button>
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
						<button class="btn btn--danger is-confirming" onclick={confirmImport}
							>Replace &amp; reload</button
						>
						<button class="btn" onclick={cancelImport}>Cancel</button>
					</div>
				</div>
			</div>
		{/if}
	</section>

	<section class="sp-section sp-section--danger">
		<h2 class="kicker sp-section-title">Reset saved data</h2>

		{#each [['constellations', 'Constellation levels', 'Clears every saved constellation level.', () => constellations.clear()], ['loadout', 'Loadout labels', 'Clears every saved weapon and artifact label.', () => loadout.clear()], ['ownership', 'Roster ownership', 'Clears which characters are marked owned or wishlisted.', () => ownership.clear()], ['notations', 'Saved rotations', 'Deletes every rotation in your save bank.', () => savedNotations.clear()]] as const as [key, name, desc, fn] (key)}
			<div class="sp-row">
				<span class="sp-label">
					<span class="sp-name">{name}</span>
					<span class="sp-desc">{desc}</span>
				</span>
				<button
					class="btn btn--danger"
					class:is-confirming={armedReset === key}
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
				class="btn btn--danger"
				class:is-confirming={armedReset === 'all'}
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

	/* .kicker, plus the panel-header framing the global class doesn't carry. */
	.sp-section-title {
		padding: 0.55rem 0.9rem;
		border-bottom: 1px solid var(--border);
	}

	.sp-section--danger .sp-section-title {
		color: var(--ui-danger);
	}

	/* Third segmented control in the product — the global .segment track now.
	   Only its flex behaviour in the row is local. */
	.sp-segment {
		flex-shrink: 0;
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

	/* Export / Import are .btn--primary, not the plain ghost: they are the row's
	   only action, and a ghost button needs a cluster around it to read as a
	   control at all — standing alone in a settings row it reads as inert text.
	   (Nate/verification finding, chunk 3.) Cancel and the reset buttons keep
	   the quiet register. Only the flex behaviour here is local. */
	.sp-row > .btn {
		flex-shrink: 0;
	}

	.sp-file-input {
		display: none;
	}

	.sp-import-error {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--ui-danger);
	}

	.sp-import-confirm {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid color-mix(in srgb, var(--ui-danger) 45%, var(--border));
		border-radius: var(--r-md);
		background: color-mix(in srgb, var(--ui-danger) 8%, transparent);
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
</style>
