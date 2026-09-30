<script lang="ts">
	import { constellations, loadout, ownership, savedNotations, siteSettings } from '$lib/stores';
	import Mark from './Mark.svelte';
	import { FPS, swapFramesForPing } from '$lib/utils/frames';
	import { HUMAN_PAD_MAX_F, HUMAN_PAD_MIN_F } from '$lib/sim/humanTiming';
	import { playback } from '$lib/playback/playback.svelte';
	import {
		NOTE_SET_IDS,
		NOTE_SET_LABELS,
		ORDER_IDS,
		ORDER_LABELS,
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
					Your network latency — the ms value Genshin shows top-right. A swap takes your ping plus
					about 90 ms, so the rotation planner delays every character swap by that much.
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
			The rotation planner is frame-perfect by default: every cancel lands on the first frame the
			game allows, the way a macro plays. The <strong>Human</strong> button on the planner's toolbar times
			it the way a person does. These settings say what that changes.
		</p>

		<div class="sp-row">
			<span class="sp-label">
				<span class="sp-name">What it adjusts</span>
				<span class="sp-desc">
					Padding adds a few frames before every input the game does not buffer — a skill after a
					normal attack, an aimed shot, the first press after a swap. Full animations let each
					action finish instead of cancelling it.
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

	<!-- ══ PLAYBACK SOUND (playback round, 2026-09-29) ═══════════════════════
	     ↻ 2026-09-30: on/off lives here too, as the Sound row's Off — band B's
	     speaker plate retired (a preference set once, and unreachable below
	     `compact`). WHAT sounds is a taste set once, so it lives here (⚓ Nate: people are picky about sounds, and it is personal).
	     Every choice PLAYS on selection — picking by listening, not by reading a
	     label — and Preview plays it again. All gestures, which is what creating
	     the AudioContext needs. The vocabulary is three notes (attack, skill,
	     burst): the ORDER says which sits low, mid, high; the NOTES say which
	     three steps of the pentatonic they are. -->
	<section class="sp-section">
		<h2 class="kicker sp-section-title">Playback sound</h2>
		<p class="sp-lede">
			<strong>Play</strong> on the planner's toolbar counts you in and sounds a note at every press, so
			you can follow a rotation with your eyes on the game. Every note rings for as long as its input
			holds the field: a burst is a long note, a normal attack a short one.
		</p>

		<div class="sp-row sp-row--stack">
			<span class="sp-label">
				<span class="sp-name">Sound</span>
				<span class="sp-desc">
					<strong>Off</strong> runs the cursor in silence, with no count-in. The metronome is one pitch
					and says only when. A melodic voice gives the attacks, the skill and the burst three notes of
					a pentatonic scale, so notes that overlap never clash.
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
			{#if $siteSettings.playbackSound && $siteSettings.playbackSoundMode === 'melodic'}
				<div class="segment sp-segment" role="radiogroup" aria-label="Voice">
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
			{/if}
		</div>

		<div class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Order</span>
				<span class="sp-desc">
					Which note sits where. <strong>Weighty</strong> puts the heavier input lower — attacks
					high, burst low. <strong>Skill up</strong> keeps attacks in the middle and lets the skill
					announce itself. <strong>Rising</strong> puts the heavier input higher.
				</span>
			</span>
			<div class="segment sp-segment" role="radiogroup" aria-label="Note order">
				{#each ORDER_IDS as value (value)}
					<button
						class="btn"
						class:is-active={$siteSettings.playbackOrder === value}
						role="radio"
						aria-checked={$siteSettings.playbackOrder === value}
						onclick={() => {
							siteSettings.setPlaybackSound({ playbackOrder: value });
							playback.preview({ order: value });
						}}>{ORDER_LABELS[value]}</button
					>
				{/each}
			</div>
		</div>

		<div class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Notes</span>
				<span class="sp-desc">
					Which two notes join A at the bottom; every set is A up to A, and every voice plays the
					same notes. <strong>Open</strong> is {noteSetNotes('open')}, a suspended, airy sound.
					<strong>Anchor</strong>
					is {noteSetNotes('anchor')}, the grounded fourth-and-fifth. <strong>Lantern</strong> is {noteSetNotes(
						'lantern'
					)}, wistful.
					<strong>Meadow</strong> is {noteSetNotes('meadow')}, bright.
				</span>
			</span>
			<div class="segment sp-segment" role="radiogroup" aria-label="Note set">
				{#each NOTE_SET_IDS as value (value)}
					<button
						class="btn"
						class:is-active={$siteSettings.playbackNotes === value}
						role="radio"
						aria-checked={$siteSettings.playbackNotes === value}
						onclick={() => {
							siteSettings.setPlaybackSound({ playbackNotes: value });
							playback.preview({ notes: value });
						}}>{NOTE_SET_LABELS[value]}</button
					>
				{/each}
			</div>
		</div>

		<div class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Swap</span>
				<span class="sp-desc">
					A swap is a soft hum held until the next character arrives, the one sound that is not
					struck. <strong>Low</strong> is a single low tone, <strong>Fifth</strong> an open pair,
					<strong>Rise</strong> the low tone bending gently up.
				</span>
			</span>
			<div class="segment sp-segment" role="radiogroup" aria-label="Swap sound">
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
				<span class="sp-desc">The notes against the game's own level.</span>
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
						siteSettings.setPlaybackSound({ playbackVolume: Number(e.currentTarget.value) / 100 })}
					onchange={() => playback.preview()}
					aria-label="Playback volume"
				/>
				<span class="sp-slider-value">{Math.round($siteSettings.playbackVolume * 100)}%</span>
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
			<button class="btn btn--primary" onclick={() => downloadBackup()}>
				<Mark name="download" /> Export…
			</button>
		</div>

		<div class="sp-row">
			<span class="sp-label">
				<span class="sp-name">Restore</span>
				<span class="sp-desc">Load a backup file. This replaces everything on this device.</span>
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
						<strong>{pending.counts.loadouts}</strong> loadouts, and
						<strong>{pending.counts.rotations}</strong> saved rotations. Replace your current data?
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
	/* The sound-set row STACKS: six choices do not fit beside a label, so the
	   label runs full width and the picker sits under it. A first cut kept the
	   side-by-side row and the segment folded into a 125px column six buttons
	   tall. */
	.sp-row--stack {
		flex-direction: column;
		align-items: stretch;
		gap: 0.6rem;
	}
	/* The picker with its Preview beside it. */
	.sp-sound-ctl {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	/* The mode picker is three plates (Off and the two modes) beside Preview; the voices (shown under it
	   when Melodic) and the three-way rows sit on one recessed track as a
	   3-column grid, so the six voices are 3 + 3 and never overflow. */
	.sp-sound-ctl .sp-segment--mode {
		display: inline-grid;
		grid-template-columns: repeat(3, minmax(5.5rem, 1fr));
	}
	.sp-row--stack > .sp-segment {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
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
		border-bottom: 1px solid var(--border);
	}

	.sp-row:last-child {
		border-bottom: none;
	}

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
</style>
