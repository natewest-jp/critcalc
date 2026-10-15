<script lang="ts">
	import {
		constellations,
		loadout,
		ownership,
		savedBoards,
		savedNotations,
		siteSettings
	} from '$lib/stores';
	import Mark from './Mark.svelte';
	import { FPS, swapFramesForPing } from '$lib/utils/frames';
	import { HUMAN_PAD_MAX_F, HUMAN_PAD_MIN_F } from '$lib/sim/humanTiming';
	import { playback } from '$lib/playback/playback.svelte';
	import {
		NOTE_SET_IDS,
		NOTE_SET_LABELS,
		ORDER_IDS,
		ORDER_LABELS,
		orderHint,
		SOUND_MODES,
		SOUND_MODE_LABELS,
		SWAP_STYLES,
		SWAP_STYLE_LABELS,
		VOICE_IDS,
		VOICE_LABELS,
		noteSetNotes
	} from '$lib/playback/tones';
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
		savedBoards.clear();
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
		// applyBackup throws when the browser blocks site data or the quota is
		// full — say so rather than reload into the data the file was meant to replace.
		try {
			applyBackup(pending.data.data);
		} catch {
			pending = null;
			importError = 'This browser isn’t letting critcalc save data.';
			return;
		}
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
					Your network latency — the ms value Genshin shows top-right. A swap takes your ping plus
					about 90 ms, so the Rotation Planner delays every character swap by that much.
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
				<span class="sp-slider-value"
					>{$siteSettings.swapPing}ms · {swapFramesForPing($siteSettings.swapPing)}f</span
				>
			</div>
		</div>
		<label class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Coverage strips</span>
				<span class="sp-desc">
					Show each slotted character’s coverage strip under the Rotation Planner’s notation, with
					the parts your rotation doesn’t reach dimmed.
				</span>
			</span>
			<span class="toggle">
				<input
					type="checkbox"
					checked={$siteSettings.showCoverageStrips}
					onchange={() => siteSettings.setShowCoverageStrips(!$siteSettings.showCoverageStrips)}
				/>
				<span class="toggle-track"><span class="toggle-thumb"></span></span>
				<span class="toggle-label">{$siteSettings.showCoverageStrips ? 'On' : 'Off'}</span>
			</span>
		</label>
	</section>

	<section class="sp-section">
		<h2 class="kicker sp-section-title">Human timing</h2>
		<p class="sp-lede">
			Without Human timing, the Rotation Planner is frame-perfect: every cancel lands on the first
			frame the game allows, the way a macro plays. <strong>Human timing</strong>, on by default in
			its view bar, times a rotation the way a person plays it. These settings say what that
			changes.
		</p>

		<div class="sp-row">
			<span class="sp-label">
				<span class="sp-name">What it adjusts</span>
				<span class="sp-desc">
					<strong>Padding</strong> adds a few frames before every input the game does not buffer — a
					skill after a normal attack, an aimed shot, the first press after a swap.
					<strong>Animations</strong> lets each action finish instead of canceling it.
				</span>
			</span>
			<div class="segment sp-segment" role="radiogroup" aria-label="What human timing adjusts">
				{#each [['padding', 'Padding'], ['animations', 'Animations'], ['both', 'Both']] as const as [value, label] (value)}
					<button
						class="btn"
						class:is-active={$siteSettings.humanTimingMode === value}
						role="radio"
						aria-checked={$siteSettings.humanTimingMode === value}
						onclick={() => siteSettings.setHumanTiming({ humanTimingMode: value })}>{label}</button
					>
				{/each}
			</div>
		</div>

		<div class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Input padding</span>
				<span class="sp-desc">
					Frames added before each unbuffered input. KQM's starting point for a human player is 10;
					lower it if you play tight, raise it if you don't.
				</span>
			</span>
			<div class="sp-slider-ctl">
				<input
					class="slider sp-slider"
					type="range"
					min={HUMAN_PAD_MIN_F}
					max={HUMAN_PAD_MAX_F}
					step="1"
					value={$siteSettings.humanTimingPadFrames}
					oninput={(e) =>
						siteSettings.setHumanTiming({ humanTimingPadFrames: Number(e.currentTarget.value) })}
					aria-label="Input padding in frames"
				/>
				<span class="sp-slider-value"
					>{$siteSettings.humanTimingPadFrames}f · {(
						$siteSettings.humanTimingPadFrames / FPS
					).toFixed(2)}s</span
				>
			</div>
		</div>

		<label class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Show padding</span>
				<span class="sp-desc">
					Draw the padding as a hatched sliver on the active row, so you can see where the time
					went.
				</span>
			</span>
			<span class="toggle">
				<input
					type="checkbox"
					checked={$siteSettings.showHumanPadding}
					onchange={() =>
						siteSettings.setHumanTiming({ showHumanPadding: !$siteSettings.showHumanPadding })}
				/>
				<span class="toggle-track"><span class="toggle-thumb"></span></span>
				<span class="toggle-label">{$siteSettings.showHumanPadding ? 'On' : 'Off'}</span>
			</span>
		</label>
	</section>

	<!-- ══ PLAYBACK SOUND (playback round, 2026-09-29; ↻ tidied 2026-09-30) ═══
	     On/off and WHAT sounds are tastes set once, so they live here (⚓ Nate:
	     people are picky about sounds, and it is personal); band B's speaker
	     plate retired into the Sound row's Off. Every choice PLAYS on
	     selection — picking by listening, not by reading a label — and Preview
	     plays it again; all gestures, which is what the AudioContext needs.
	     ↻ 2026-09-30 (⚓ Nate: "condense and combine, simplify"): a row shows
	     only when it can be heard — nothing under Off, no voice or notes under
	     the metronome (one pitch) — and Order + Notes are ONE row, "which note
	     each input gets", with the long per-option prose moved to `title`s. -->
	<section class="sp-section">
		<h2 class="kicker sp-section-title">Playback sound</h2>
		<p class="sp-lede">
			<strong>Play</strong> in the Rotation Planner's view bar counts you in, then plays a note at every
			press, so you can follow a rotation with your eyes on the game.
		</p>

		<div class="sp-row sp-row--stack">
			<span class="sp-label">
				<span class="sp-name">Sound</span>
				<span class="sp-desc">
					The metronome is one pitch. Melodic gives attacks, skills and bursts their own notes.
				</span>
			</span>
			<div class="sp-sound-ctl">
				<div class="segment sp-segment sp-segment--mode" role="radiogroup" aria-label="Sound">
					<button
						class="btn"
						class:is-active={!$siteSettings.playbackSound}
						role="radio"
						aria-checked={!$siteSettings.playbackSound}
						onclick={() => playback.setSound(false)}>Off</button
					>
					{#each SOUND_MODES as value (value)}
						{@const on = $siteSettings.playbackSound && $siteSettings.playbackSoundMode === value}
						<button
							class="btn"
							class:is-active={on}
							role="radio"
							aria-checked={on}
							onclick={() => {
								siteSettings.setPlaybackSound({ playbackSoundMode: value });
								playback.setSound(true);
								playback.preview();
							}}>{SOUND_MODE_LABELS[value]}</button
						>
					{/each}
				</div>
				<button
					class="btn btn--sm"
					type="button"
					aria-label="Preview the sound"
					disabled={!$siteSettings.playbackSound}
					onclick={() => playback.preview()}
				>
					<Mark name="play" size={12} filled />
					Preview
				</button>
			</div>
		</div>

		{#if $siteSettings.playbackSound}
			{#if $siteSettings.playbackSoundMode === 'melodic'}
				<div class="sp-row sp-row--stack">
					<span class="sp-label">
						<span class="sp-name">Voice</span>
					</span>
					<div class="segment sp-segment sp-segment--grid3" role="radiogroup" aria-label="Voice">
						{#each VOICE_IDS as value (value)}
							<button
								class="btn"
								class:is-active={$siteSettings.playbackVoice === value}
								role="radio"
								aria-checked={$siteSettings.playbackVoice === value}
								onclick={() => {
									siteSettings.setPlaybackSound({ playbackVoice: value });
									playback.preview({ set: value });
								}}>{VOICE_LABELS[value]}</button
							>
						{/each}
					</div>
				</div>

				<div class="sp-row sp-row--stack">
					<span class="sp-label">
						<span class="sp-name">Notes</span>
						<span class="sp-desc">
							Which note each input gets, then which three notes. Every set comes from one
							pentatonic scale, so overlapping notes never clash.
						</span>
					</span>
					<div
						class="segment sp-segment sp-segment--grid3"
						role="radiogroup"
						aria-label="Note order"
					>
						{#each ORDER_IDS as value (value)}
							<button
								class="btn"
								class:is-active={$siteSettings.playbackOrder === value}
								role="radio"
								aria-checked={$siteSettings.playbackOrder === value}
								title={orderHint(value)}
								onclick={() => {
									siteSettings.setPlaybackSound({ playbackOrder: value });
									playback.preview({ order: value });
								}}>{ORDER_LABELS[value]}</button
							>
						{/each}
					</div>
					<div class="segment sp-segment sp-segment--grid4" role="radiogroup" aria-label="Note set">
						{#each NOTE_SET_IDS as value (value)}
							<button
								class="btn"
								class:is-active={$siteSettings.playbackNotes === value}
								role="radio"
								aria-checked={$siteSettings.playbackNotes === value}
								title={noteSetNotes(value)}
								onclick={() => {
									siteSettings.setPlaybackSound({ playbackNotes: value });
									playback.preview({ notes: value });
								}}>{NOTE_SET_LABELS[value]}</button
							>
						{/each}
					</div>
				</div>
			{/if}

			<div class="sp-row sp-row--stack">
				<span class="sp-label">
					<span class="sp-name">Swap</span>
					<span class="sp-desc">A soft hum while the next character comes in.</span>
				</span>
				<div class="segment sp-segment sp-segment--grid4" role="radiogroup" aria-label="Swap sound">
					{#each SWAP_STYLES as value (value)}
						<button
							class="btn"
							class:is-active={$siteSettings.playbackSwap === value}
							role="radio"
							aria-checked={$siteSettings.playbackSwap === value}
							onclick={() => {
								siteSettings.setPlaybackSound({ playbackSwap: value });
								playback.preview({ swap: value });
							}}>{SWAP_STYLE_LABELS[value]}</button
						>
					{/each}
				</div>
			</div>

			<div class="sp-row">
				<span class="sp-label">
					<span class="sp-name">Volume</span>
				</span>
				<div class="sp-slider-ctl">
					<input
						class="slider sp-slider"
						type="range"
						min="0"
						max="100"
						step="5"
						value={Math.round($siteSettings.playbackVolume * 100)}
						oninput={(e) =>
							siteSettings.setPlaybackSound({
								playbackVolume: Number(e.currentTarget.value) / 100
							})}
						onchange={() => playback.preview()}
						aria-label="Playback volume"
					/>
					<span class="sp-slider-value">{Math.round($siteSettings.playbackVolume * 100)}%</span>
				</div>
			</div>
		{/if}
	</section>

	<section class="sp-section">
		<h2 class="kicker sp-section-title">Your data</h2>

		<div class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Backup</span>
				<span class="sp-desc">
					critcalc keeps nothing on a server — your roster, loadouts, saved rotations, and saved
					lineups live in this browser. Download a file to back them up or move them to another
					device.
				</span>
			</span>
			<button class="btn btn--primary" onclick={() => downloadBackup()}>
				<Mark name="download" /> Export…
			</button>
		</div>

		<div class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Restore</span>
				<span class="sp-desc">
					Load a backup file. It replaces your roster, loadouts, saved rotations, saved lineups, and
					settings on this device.
				</span>
			</span>
			<button class="btn btn--primary" onclick={() => fileInput?.click()}>
				<Mark name="upload" /> Import…
			</button>
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
						<strong>{pending.counts.loadouts}</strong> loadouts,
						<strong>{pending.counts.rotations}</strong> saved rotations, and
						<strong>{pending.counts.lineups}</strong> saved lineups. Replace your current data?
					</p>
					<div class="sp-import-actions">
						<button class="btn btn--danger is-confirming" onclick={confirmImport}>
							<Mark name="warn" /> Replace &amp; reload
						</button>
						<button class="btn" onclick={cancelImport}>Cancel</button>
					</div>
				</div>
			</div>
		{/if}
	</section>

	<section class="sp-section sp-section--danger">
		<h2 class="kicker sp-section-title">Reset saved data</h2>

		{#each [['constellations', 'Constellation levels', 'Clears every saved constellation level.', () => constellations.clear()], ['loadout', 'Loadouts', "Clears every character's saved weapon and artifact set.", () => loadout.clear()], ['ownership', 'Roster ownership', 'Clears which characters are marked owned or wishlisted.', () => ownership.clear()], ['notations', 'Saved rotations', 'Deletes every rotation and team saved in your library.', () => savedNotations.clear()], ['boards', 'Saved lineups', 'Deletes every lineup saved in your library.', () => savedBoards.clear()]] as const as [key, name, desc, fn] (key)}
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
					{#if armedReset === key}<Mark name="warn" />{/if}
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
				{#if armedReset === 'all'}<Mark name="warn" />{/if}
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

	/* ONE layer. The sections used to be --surface-raised cards inside a
	   --surface modal — two elevations for content that is really just a list
	   with headings. The modal is --surface-raised now and a section is nothing
	   but its kicker plus its rows; the kicker's own rule does the separating. */
	.sp-section {
		display: flex;
		flex-direction: column;
	}

	/* Plain .kicker now — the old panel-header framing (padding + a full-width
	   border) belonged to the card that no longer exists. */
	.sp-section-title {
		margin-bottom: 0.2rem;
	}

	.sp-section--danger .sp-section-title {
		color: var(--ui-danger);
	}

	/* Third segmented control in the product — the global .segment track now.
	   Only its flex behaviour in the row is local. */
	/* The sound rows STACK: their choices do not fit beside a label, so the
	   label runs full width and the picker sits under it. A first cut kept the
	   side-by-side row and the segment folded into a 125px column six buttons
	   tall. */
	/* ⚠ Compound: `.sp-row` is declared LATER in this sheet and a lone
	   modifier ties with it and loses on source order — the rows centred their
	   label and pickers (the `.panel--paper` trap). */
	.sp-row.sp-row--stack {
		flex-direction: column;
		align-items: stretch;
		gap: 0.6rem;
	}
	/* The mode picker with its Preview beside it. */
	.sp-sound-ctl {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.sp-sound-ctl .sp-segment--mode {
		display: inline-grid;
		grid-template-columns: repeat(3, minmax(5.5rem, 1fr));
	}
	/* The stacked pickers are equal-width grids on one recessed track, so a
	   long label never widens its neighbours: the voices and the orders in
	   threes (the five voices are 3 + 2), the note sets and the swaps in
	   fours. */
	.sp-segment--grid3,
	.sp-segment--grid4 {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.sp-segment--grid4 {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}
	.sp-segment {
		flex-shrink: 0;
	}

	.sp-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.2rem;
		padding: 0.8rem 0.1rem;
	}
	/* ⛔ No rule between rows (⚓ Nate, 2026-10-01): the section kicker's rule
	   is the only separator, and the rows' padding carries the rhythm. */

	/* Full-width block below the Restore row for the import error / confirm UI. */
	.sp-feedback {
		padding: 0.8rem 0.1rem;
	}

	.sp-label {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.sp-name {
		font-weight: var(--fw-semibold);
		font-size: var(--fs-lg);
		color: var(--text);
	}

	.sp-desc {
		font-size: var(--fs-md);
		color: var(--muted);
		line-height: var(--lh-snug);
	}

	/* A section-level lede (Human timing): one paragraph before the rows, in
	   the row description's voice — it introduces the plate the rows serve. */
	.sp-lede {
		margin: 0 0 0.75rem;
		font-size: var(--fs-md);
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
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--muted);
		min-width: 3.4rem;
		text-align: right;
		white-space: nowrap;
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
		font-size: var(--fs-md);
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
		font-size: var(--fs-md);
		line-height: var(--lh-snug);
		color: var(--text);
	}

	.sp-import-actions {
		display: flex;
		gap: 0.5rem;
	}

	/* Phone: a segment or a slider does not fit BESIDE its label. The segment
	   doesn't shrink, so the label was squeezed to nothing (0px wide at 320 —
	   one word per line, the segment painted over it) and the whole panel ran
	   59px wide. Those rows take the stacked form the sound rows already use;
	   toggle and button rows stay side by side, where they fit. The segments
	   then share the row in equal columns (auto columns, so the two-option
	   Traveler fills it too). */
	@media (max-width: 40rem) /* compact — $lib/breakpoints.ts */ {
		.sp-row:has(> .segment),
		.sp-row:has(> .sp-slider-ctl) {
			flex-direction: column;
			align-items: stretch;
			gap: 0.6rem;
		}
		/* ⚠ Not the grid3/grid4 pickers: column flow would line their 3 + 2
		   voices up as five columns in one row. */
		.sp-row > .sp-segment:not(.sp-segment--grid3, .sp-segment--grid4) {
			display: grid;
			grid-auto-flow: column;
			grid-auto-columns: minmax(0, 1fr);
		}
		/* ⚠ `display: grid`, not the inline-grid above: as an inline-grid flex
		   item it kept its 313px max-content width. */
		.sp-sound-ctl .sp-segment--mode {
			display: grid;
			flex: 1 1 100%;
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		/* 'Animations' and 'Metronome' are 65px of text in a 74px third at
		   320, and 'Lantern' 44px in a 55px quarter — the default 0.65rem
		   padding clipped them. */
		.sp-segment > .btn {
			padding-inline: 0.25rem;
		}
	}
</style>
