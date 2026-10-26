<script module lang="ts">
	/** The page's groups, in order: the menu state's sidebar lists them under
	 *  Settings and scrolls to `#settings-<id>`. */
	export const SETTINGS_GROUPS = [
		{ id: 'appearance', label: 'Appearance' },
		{ id: 'planner', label: 'Planner' },
		{ id: 'sound', label: 'Playback sound' },
		{ id: 'data', label: 'Your data' }
	] as const;
</script>

<script lang="ts">
	import { notices, announceAfterReload } from '$lib/notices.svelte';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		constellations,
		HUMAN_TIMING_DEFAULTS,
		loadout,
		ownership,
		savedBoards,
		savedNotations,
		siteSettings,
		SWAP_PING_DEFAULT
	} from '$lib/stores';
	import Mark from './Mark.svelte';
	import { nextLayout } from '$lib/nextLayout';
	import { FPS, swapFramesForPing } from '$lib/utils/frames';
	import { HUMAN_PAD_MAX_F, HUMAN_PAD_MIN_F } from '$lib/sim/humanTiming';
	import { playback } from '$lib/playback/playback.svelte';
	import {
		NOTE_SET_IDS,
		NOTE_SET_LABELS,
		ORDER_IDS,
		ORDER_LABELS,
		orderHint,
		PREVIEW_NOTES,
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
		downloadEnvelope,
		parseBackup,
		applyBackup,
		type BackupCounts
	} from '$lib/utils/settingsBackup';
	import type { StoreCounts, StoreParse } from '$lib/storage/backup';
	import {
		isSafari,
		readLastBackup,
		backupIsStale,
		requestPersistentStorage,
		storagePersisted
	} from '$lib/utils/storageDurability';

	// Storage durability. Both are read after mount: the server can't know
	// either, so the first paint carries neither (`undefined` = not yet asked).
	let persisted = $state<boolean | null | undefined>(undefined);
	let persistDeclined = $state(false);
	let safari = $state(false);
	let lastBackup = $state<number | null>(null);
	onMount(() => {
		lastBackup = readLastBackup();
		safari = isSafari();
		storagePersisted().then((p) => (persisted = p));
	});

	async function askToKeep() {
		persisted = await requestPersistentStorage();
		persistDeclined = !persisted;
	}

	/** ⚓ Under the switch the work lives in the new storage, so a backup is
	 *  v3: every profile (design §10, §12 Q11). The session is loaded only then. */
	const session = () => import('$lib/storage/session.svelte').then((m) => m.storageSession);

	/** The session itself, once loaded (the new layout only): the Profile
	 *  link names the active profile. */
	let store = $state<Awaited<ReturnType<typeof session>> | null>(null);
	$effect(() => {
		if ($nextLayout) void session().then((s) => (store = s));
	});
	const realProfile = $derived(store?.profile?.kind === 'real' ? store.profile : null);
	const anySeen = $derived($siteSettings.seenGuestNotice || $siteSettings.seenLinksNotice);

	function showNoticesAgain() {
		siteSettings.resetSeen();
		notices.toast('success', 'Tips and notices will show again');
	}

	/** ⚓ The opposite of Restore (2026-10-26): it empties the browser, as a
	 *  first visit finds it. A DIALOG, because it takes every profile at once
	 *  and skips the Trash; it says when the last backup was, since Export is
	 *  one row above and this cannot be undone. */
	async function deleteEverything() {
		const s = await session();
		const ok = await notices.ask({
			title: 'Delete everything in this browser?',
			body: `Every profile, with its roster, teams, rotations, and lineups, the Trash, and your settings are deleted, and the page reloads. This can’t be undone. ${
				lastBackup === null
					? 'You haven’t downloaded a backup yet.'
					: `Your last backup was ${daysAgo(lastBackup)}.`
			}`,
			confirm: 'Delete everything',
			cancel: 'Keep it',
			danger: true
		});
		if (!ok) return;
		try {
			await s.wipe();
		} catch {
			notices.toast('error', 'This browser isn’t letting critcalc change its data.');
			return;
		}
		announceAfterReload('Everything in this browser was deleted');
		location.reload();
	}

	async function exportBackup() {
		const at = Date.now();
		if ($nextLayout) {
			const file = await (await session()).backup(at);
			if (!file) {
				importError = 'This browser isn’t letting critcalc read its data.';
				return;
			}
			downloadEnvelope(file, at);
		} else downloadBackup(at);
		lastBackup = at;
	}

	/** Saved rotations and lineups changed since the last backup, or ever
	 *  when there has been none (that is what makes "never" a warning). */
	let storeSince = $state(0);
	$effect(() => {
		const at = lastBackup ?? 0;
		if ($nextLayout)
			void session()
				.then((s) => s.changedSince(at))
				.then((n) => (storeSince = n));
	});
	let savedSince = $derived(
		$nextLayout
			? storeSince
			: [...$savedNotations, ...$savedBoards].filter((e) => e.savedAt > (lastBackup ?? 0)).length
	);
	/** ⚓ Colour only when it is a problem (Nate 2026-10-26), so it keeps
	 *  meaning something: never, or older than the window, with work since. */
	const stale = $derived(backupIsStale(lastBackup, savedSince));

	function daysAgo(at: number): string {
		const days = Math.floor((Date.now() - at) / 86_400_000);
		if (days <= 0) return 'today';
		if (days === 1) return 'yesterday';
		return `${days} days ago`;
	}

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

	// The old layout's resets (it has no Profile page). ↻ Under the switch
	// they moved to the profile's own page, its Clear data (2026-10-26).
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
	/** The same, under the switch: any backup file, read for the new storage. */
	let pendingStore = $state<Extract<StoreParse, { ok: true }> | null>(null);
	let importError = $state<string | null>(null);

	async function onFileChosen(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = ''; // allow re-picking the same file
		if (!file) return;
		importError = null;
		pending = null;
		pendingStore = null;
		if ($nextLayout) {
			const [{ parseAnyBackup }, { newId }] = await Promise.all([
				import('$lib/storage/backup'),
				import('$lib/storage/records')
			]);
			const res = parseAnyBackup(await file.text(), { newId });
			if (!res.ok) {
				importError = res.error;
				return;
			}
			// ↻ A DIALOG (notices §3.4): it replaces everything in the browser.
			const ok = await notices.ask({
				title: 'Replace everything with this backup?',
				body: `It holds ${storeSummary(res.counts)}. Everything in this browser is replaced with it, and the page reloads.`,
				confirm: 'Replace and reload',
				danger: true
			});
			if (!ok) return;
			pendingStore = res;
			await confirmStoreImport();
			return;
		}
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

	async function confirmStoreImport() {
		if (!pendingStore) return;
		try {
			await (await session()).restore(pendingStore);
		} catch {
			pendingStore = null;
			importError = 'This browser isn’t letting critcalc save data.';
			return;
		}
		// Said after the reload (`announceAfterReload`): nothing else would.
		announceAfterReload('Restored from your backup');
		location.reload();
	}

	function cancelImport() {
		pending = null;
		pendingStore = null;
		importError = null;
	}

	/** "Main and Alt", "Main, Alt, and Spare". */
	function listOf(names: string[]): string {
		if (names.length <= 2) return names.join(' and ');
		return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
	}
	const storeSummary = (c: StoreCounts): string => {
		const n = c.profiles.length;
		const who = n
			? `${n} ${n === 1 ? 'profile' : 'profiles'} (${listOf(c.profiles)})`
			: 'no profiles of your own';
		const plural = (k: number, one: string) => `${k} ${one}${k === 1 ? '' : 's'}`;
		return `${who}, ${plural(c.rotations, 'rotation')}, ${plural(c.lineups, 'lineup')}, and ${plural(c.teams, 'team')}`;
	};

	// ── Human timing: ONE control (2026-10-26) ──────────────────────────────
	// The switch and "what it adjusts" were two rows; Off is now the control's
	// first choice, so it reads as one question. The stored shape is unchanged
	// (`humanTiming` + `humanTimingMode`), so a mode chosen before survives an
	// Off and comes back with On.
	const HUMAN_CHOICES = [
		['off', 'Off'],
		['padding', 'Padding'],
		['animations', 'Animations'],
		['both', 'Both']
	] as const;
	const humanChoice = $derived($siteSettings.humanTiming ? $siteSettings.humanTimingMode : 'off');
	const padding = $derived(humanChoice === 'padding' || humanChoice === 'both');
	function chooseHuman(v: (typeof HUMAN_CHOICES)[number][0]) {
		if (v === 'off') siteSettings.setHumanTiming({ humanTiming: false });
		else siteSettings.setHumanTiming({ humanTiming: true, humanTimingMode: v });
	}

	// ── The Planner group's defaults ────────────────────────────────────────
	// Values people fiddle with and want back (the Reset zoom reasoning), so
	// the reset is one click with an Undo, not a confirm.
	type PlannerValues = typeof HUMAN_TIMING_DEFAULTS & {
		swapPing: number;
		showCoverageStrips: boolean;
	};
	const PLANNER_DEFAULTS: PlannerValues = {
		...HUMAN_TIMING_DEFAULTS,
		swapPing: SWAP_PING_DEFAULT,
		showCoverageStrips: false
	};
	const plannerValues = $derived<PlannerValues>({
		humanTiming: $siteSettings.humanTiming,
		humanTimingMode: $siteSettings.humanTimingMode,
		humanTimingPadFrames: $siteSettings.humanTimingPadFrames,
		showHumanPadding: $siteSettings.showHumanPadding,
		swapPing: $siteSettings.swapPing,
		showCoverageStrips: $siteSettings.showCoverageStrips
	});
	const plannerAtDefaults = $derived(
		(Object.keys(PLANNER_DEFAULTS) as (keyof PlannerValues)[]).every(
			(k) => plannerValues[k] === PLANNER_DEFAULTS[k]
		)
	);
	function setPlanner(v: PlannerValues) {
		const { swapPing, showCoverageStrips, ...human } = v;
		siteSettings.setHumanTiming(human);
		siteSettings.setSwapPing(swapPing);
		siteSettings.setShowCoverageStrips(showCoverageStrips);
	}
	function resetPlanner() {
		const before = plannerValues;
		setPlanner(PLANNER_DEFAULTS);
		notices.toast('success', 'Planner settings reset', {
			actions: [{ label: 'Undo', run: () => setPlanner(before) }]
		});
	}
</script>

<!-- ⚓ THE ROW (settings surface round, 2026-10-26): a NAME, its CONTROL, and
     a NOTE — three columns, so the names make one column to scan and the
     controls one straight edge to read values down; what a setting means
     sits in the margin, level with its row (the reading layout's idea).
     Narrower, the note folds under the name; narrower still, the control
     too. The questions the streamer couldn't find answers to are the GROUP
     names, so a group is a question (Appearance, Planner…), never a kind of
     control. -->
<div class="sp">
	<!-- The switch (build plan §13.1): shown ONLY while it is on, so the
	     public never meets a half-built option; `?next` turns it on. -->
	{#if $nextLayout}
		<section class="sp-section">
			<label class="sp-row">
				<span class="sp-name">Use the new layout</span>
				<span class="sp-ctl">
					<span class="toggle">
						<input type="checkbox" checked onchange={() => nextLayout.set(false)} />
						<span class="toggle-track"><span class="toggle-thumb"></span></span>
						<span class="toggle-label">On</span>
					</span>
				</span>
			</label>
		</section>
	{/if}

	<section class="sp-section" id="settings-appearance">
		<h2 class="kicker sp-section-title">Appearance</h2>

		<label class="sp-row">
			<span class="sp-name">Updated outfits</span>
			<span class="sp-ctl">
				<span class="toggle">
					<input
						type="checkbox"
						checked={$siteSettings.useNewOutfits}
						onchange={() => siteSettings.setUseNewOutfits(!$siteSettings.useNewOutfits)}
					/>
					<span class="toggle-track"><span class="toggle-thumb"></span></span>
					<span class="toggle-label">{$siteSettings.useNewOutfits ? 'On' : 'Off'}</span>
				</span>
			</span>
			<span class="sp-note">Show characters in their newest outfit if they have one.</span>
		</label>

		<div class="sp-row">
			<span class="sp-name">Traveler</span>
			<span class="sp-ctl">
				<span class="segment sp-segment" role="radiogroup" aria-label="Traveler variant">
					{#each [['aether', 'Aether'], ['lumine', 'Lumine']] as const as [value, label] (value)}
						<button
							class="btn"
							class:is-active={$siteSettings.travelerVariant === value}
							role="radio"
							aria-checked={$siteSettings.travelerVariant === value}
							onclick={() => siteSettings.setTravelerVariant(value)}>{label}</button
						>
					{/each}
				</span>
			</span>
			<span class="sp-note">Which twin takes the role of Traveler on the site.</span>
		</div>
	</section>

	<section class="sp-section" id="settings-planner">
		<h2 class="kicker sp-section-title">Planner</h2>

		<div class="sp-row">
			<span class="sp-name">Human timing</span>
			<span class="sp-ctl">
				<span class="segment sp-segment" role="radiogroup" aria-label="Human timing">
					{#each HUMAN_CHOICES as [value, label] (value)}
						<button
							class="btn"
							class:is-active={humanChoice === value}
							role="radio"
							aria-checked={humanChoice === value}
							onclick={() => chooseHuman(value)}>{label}</button
						>
					{/each}
				</span>
			</span>
			<span class="sp-note">
				<strong>Off</strong> times a rotation frame-perfectly, the way a macro plays it.
				<strong>Padding</strong>
				adds a short pause before each input the game doesn't buffer, like a skill after a normal attack
				or the first press after a swap. <strong>Animations</strong> lets every action play out instead
				of canceling it.
			</span>
		</div>

		{#if padding}
			<div class="sp-row">
				<span class="sp-name">Input padding</span>
				<span class="sp-ctl sp-slider-ctl">
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
				</span>
				<span class="sp-note">
					How long that pause is. KQM suggests 10 frames for most players; go lower if you play
					tight.
				</span>
			</div>

			<label class="sp-row">
				<span class="sp-name">Mark padding</span>
				<span class="sp-ctl">
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
				</span>
				<span class="sp-note">
					Draws each pause as a hatched sliver on the timeline, so you can see where the time went.
				</span>
			</label>
		{/if}

		<div class="sp-row">
			<span class="sp-name">Swap ping</span>
			<span class="sp-ctl sp-slider-ctl">
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
			</span>
			<span class="sp-note">
				The ping Genshin shows in the top right. Each swap in the Planner takes your ping plus about
				90 ms.
			</span>
		</div>

		<label class="sp-row">
			<span class="sp-name">Coverage strips</span>
			<span class="sp-ctl">
				<span class="toggle">
					<input
						type="checkbox"
						checked={$siteSettings.showCoverageStrips}
						onchange={() => siteSettings.setShowCoverageStrips(!$siteSettings.showCoverageStrips)}
					/>
					<span class="toggle-track"><span class="toggle-thumb"></span></span>
					<span class="toggle-label">{$siteSettings.showCoverageStrips ? 'On' : 'Off'}</span>
				</span>
			</span>
			<span class="sp-note">
				Shows each character's coverage strip under the rotation planner's notation, with the parts
				your rotation doesn't use yet dimmed.
			</span>
		</label>

		<div class="sp-row sp-row--action">
			<span class="sp-ctl">
				<button class="btn btn--sm" disabled={plannerAtDefaults} onclick={resetPlanner}>
					<Mark name="reset" size={12} /> Reset to defaults
				</button>
			</span>
		</div>
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
	<section class="sp-section" id="settings-sound">
		<h2 class="kicker sp-section-title">Playback sound</h2>

		<div class="sp-row">
			<span class="sp-name">Sound</span>
			<span class="sp-ctl sp-sound-ctl">
				<span class="segment sp-segment sp-segment--mode" role="radiogroup" aria-label="Sound">
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
				</span>
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
			</span>
			<span class="sp-note">
				<strong>Play</strong> in the {$nextLayout ? 'Planner’s toolbar' : 'Planner’s view bar'} counts
				you in and plays a note at each press, so you can follow along with your eyes on the game. Metronome
				uses one pitch; Melodic gives attacks, skills, and bursts their own notes.
			</span>
		</div>

		{#if $siteSettings.playbackSound}
			{#if $siteSettings.playbackSoundMode === 'melodic'}
				<div class="sp-row">
					<span class="sp-name">Voice</span>
					<span class="sp-ctl">
						<span class="segment sp-segment sp-segment--grid3" role="radiogroup" aria-label="Voice">
							{#each VOICE_IDS as value (value)}
								<button
									class="btn"
									class:is-active={$siteSettings.playbackVoice === value}
									role="radio"
									aria-checked={$siteSettings.playbackVoice === value}
									onclick={() => {
										siteSettings.setPlaybackSound({ playbackVoice: value });
										playback.preview({ set: value }, PREVIEW_NOTES);
									}}>{VOICE_LABELS[value]}</button
								>
							{/each}
						</span>
					</span>
				</div>

				<div class="sp-row">
					<span class="sp-name">Notes</span>
					<span class="sp-ctl sp-ctl--stack">
						<span
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
										playback.preview({ order: value }, PREVIEW_NOTES);
									}}>{ORDER_LABELS[value]}</button
								>
							{/each}
						</span>
						<span
							class="segment sp-segment sp-segment--grid4"
							role="radiogroup"
							aria-label="Note set"
						>
							{#each NOTE_SET_IDS as value (value)}
								<button
									class="btn"
									class:is-active={$siteSettings.playbackNotes === value}
									role="radio"
									aria-checked={$siteSettings.playbackNotes === value}
									title={noteSetNotes(value)}
									onclick={() => {
										siteSettings.setPlaybackSound({ playbackNotes: value });
										playback.preview({ notes: value }, PREVIEW_NOTES);
									}}>{NOTE_SET_LABELS[value]}</button
								>
							{/each}
						</span>
					</span>
					<span class="sp-note">
						The top row picks which input gets which note, the bottom row which three notes.
						<!-- ⚓ The chosen order spelled out, VISIBLE (Nate 2026-10-26): its
						     title is hover-only, and a touch screen never sees one. -->
						<span class="sp-reading">{orderHint($siteSettings.playbackOrder)}</span>
					</span>
				</div>
			{/if}

			<div class="sp-row">
				<span class="sp-name">Swap</span>
				<span class="sp-ctl">
					<span
						class="segment sp-segment sp-segment--grid4"
						role="radiogroup"
						aria-label="Swap sound"
					>
						{#each SWAP_STYLES as value (value)}
							<button
								class="btn"
								class:is-active={$siteSettings.playbackSwap === value}
								role="radio"
								aria-checked={$siteSettings.playbackSwap === value}
								onclick={() => {
									siteSettings.setPlaybackSound({ playbackSwap: value });
									playback.preview({ swap: value }, ['swap']);
								}}>{SWAP_STYLE_LABELS[value]}</button
							>
						{/each}
					</span>
				</span>
				<span class="sp-note">A soft hum while the next character comes in.</span>
			</div>

			<div class="sp-row">
				<span class="sp-name">Volume</span>
				<span class="sp-ctl sp-slider-ctl">
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
				</span>
			</div>
		{/if}
	</section>

	<section class="sp-section" id="settings-data">
		<h2 class="kicker sp-section-title">Your data</h2>

		<!-- ⚓ The VALUE is bold, never the sentence or its label (Nate
		     2026-10-26): "never" / "3 days ago" and the count are the reading. -->
		<div class="sp-row">
			<span class="sp-name">Backup</span>
			<span class="sp-ctl">
				<button class="btn btn--primary" onclick={exportBackup}>
					<Mark name="download" /> Export…
				</button>
			</span>
			<span class="sp-note">
				critcalc has no server, so everything you set up lives in this browser. Export a file to
				keep a copy or move to another device.
				{#if lastBackup === null}
					Last backup: <strong class="sp-value" class:is-stale={stale}>never</strong>.
				{:else}
					Last backup: <strong class="sp-value" class:is-stale={stale}>{daysAgo(lastBackup)}</strong
					>.
					<!-- The space before the block is OUTSIDE it: Svelte trims a
					     block's own edges (it once rendered "ago.1 saved item"). -->
					{#if savedSince > 0}
						<strong class="sp-value"
							>{savedSince} saved {savedSince === 1 ? 'item' : 'items'}</strong
						>
						{savedSince === 1 ? 'has' : 'have'} changed since.
					{/if}
				{/if}
			</span>
		</div>

		<!-- ⚓ Its own row again (Nate 2026-10-26): the CONTROL column states
		     the browser's answer, or holds the one action there is. The site
		     asks on the first save anyway; this is for a decliner, or a
		     browser that said no silently and may say yes later. -->
		{#if persisted !== undefined}
			<div class="sp-row">
				<span class="sp-name">Storage</span>
				<span class="sp-ctl">
					{#if persisted}
						<span class="sp-status"><Mark name="check" size={14} /> Kept</span>
					{:else if persisted === null}
						<span class="sp-status">Unknown</span>
					{:else if safari}
						<span class="sp-status">Not kept</span>
					{:else if persistDeclined}
						<span class="sp-status">Declined</span>
					{:else}
						<button class="btn" onclick={askToKeep}>Keep my data</button>
					{/if}
				</span>
				<span class="sp-note">
					{#if persisted}
						This browser will keep your data until you clear this site’s data yourself.
					{:else if persisted === null}
						This browser doesn’t say whether it will keep your data. A backup keeps a copy either
						way.
					{:else if persisted === false && safari}
						Safari may clear your data after a while without a visit. Add critcalc to your Home
						Screen to keep it, or download a backup.
					{:else if persisted === false && persistDeclined}
						This browser declined, so it may still clear your data on its own. A backup keeps a
						copy.
					{:else if persisted === false}
						This browser may clear your data on its own, for example after a while without a visit.
						Ask it to keep your data, or download a backup.
					{/if}
				</span>
			</div>
		{/if}

		<div class="sp-row">
			<span class="sp-name">Restore</span>
			<span class="sp-ctl">
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
			</span>
			<span class="sp-note">
				{#if $nextLayout}
					Replaces every profile in this browser, and your settings, with the ones in a backup file.
					Older backups work too.
				{:else}
					Load a backup file. It replaces your roster, loadouts, saved rotations, saved lineups,
					open tabs, and settings on this device.
				{/if}
			</span>
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
						<strong>{pending.counts.rotations}</strong> saved rotations,
						<strong>{pending.counts.lineups}</strong> saved lineups, and
						<strong>{pending.counts.openTabs}</strong> open tabs. Replace your current data?
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

		{#if realProfile}
			<!-- ⚓ A LINK, not a second copy (2026-10-26): clearing acts on one
			     profile, so its control lives on that profile's page; Settings
			     is where people look for it, so this row points there. -->
			<div class="sp-row">
				<span class="sp-name">Clear profile data</span>
				<span class="sp-ctl">
					<a class="btn" href={resolve('/profile')}>Open Profile</a>
				</span>
				<span class="sp-note">
					Clear a profile’s roster, rotations, lineups, or teams from its own page.
				</span>
			</div>
		{/if}

		<div class="sp-row">
			<span class="sp-name">Tips and notices</span>
			<span class="sp-ctl">
				<button class="btn" disabled={!anySeen} onclick={showNoticesAgain}>Show again</button>
			</span>
			<span class="sp-note">Brings back the one-time notices you’ve dismissed.</span>
		</div>

		{#if $nextLayout}
			<div class="sp-row">
				<span class="sp-name">Delete everything</span>
				<span class="sp-ctl">
					<button class="btn btn--danger" onclick={() => void deleteEverything()}>
						<Mark name="delete" /> Delete everything…
					</button>
				</span>
				<span class="sp-note">
					Removes every profile, the Trash, and your settings, as if you were visiting for the first
					time.
				</span>
			</div>
		{/if}
	</section>

	<!-- The old layout keeps its resets here: it has no Profile page. -->
	{#if !$nextLayout}
		<section class="sp-section sp-section--danger" id="settings-reset">
			<h2 class="kicker sp-section-title">Reset saved data</h2>

			{#each [['constellations', 'Constellation levels', 'Clears every saved constellation level.', () => constellations.clear()], ['loadout', 'Loadouts', "Clears every character's saved weapon and artifact set.", () => loadout.clear()], ['ownership', 'Roster ownership', 'Clears which characters are marked owned or wishlisted.', () => ownership.clear()], ['notations', 'Saved rotations', 'Deletes every rotation and team saved in your library.', () => savedNotations.clear()], ['boards', 'Saved lineups', 'Deletes every lineup saved in your library.', () => savedBoards.clear()]] as const as [key, name, desc, fn] (key)}
				<div class="sp-row">
					<span class="sp-name">{name}</span>
					<span class="sp-ctl">
						<button
							class="btn btn--danger"
							class:is-confirming={armedReset === key}
							onclick={() => reset(key, fn)}
							onblur={() => armedReset === key && (armedReset = null)}
						>
							{#if armedReset === key}<Mark name="warn" />{/if}
							{armedReset === key ? 'Confirm' : 'Clear'}
						</button>
					</span>
					<span class="sp-note">{desc}</span>
				</div>
			{/each}

			<div class="sp-row">
				<span class="sp-name">Everything</span>
				<span class="sp-ctl">
					<button
						class="btn btn--danger"
						class:is-confirming={armedReset === 'all'}
						onclick={() => reset('all', clearEverything)}
						onblur={() => armedReset === 'all' && (armedReset = null)}
					>
						{#if armedReset === 'all'}<Mark name="warn" />{/if}
						{armedReset === 'all' ? 'Confirm clear all' : 'Clear all'}
					</button>
				</span>
				<span class="sp-note">Clears all of the above at once. Display settings are kept.</span>
			</div>
		</section>
	{/if}
</div>

<style>
	/* The panel answers to its OWN width (a container), not the window's: it
	   renders in the menu state's content area, the old gear modal (~491px)
	   and the old /settings page, and each wants the form that fits it. */
	.sp {
		container-type: inline-size;
		/* The rows' own width (12 + 22 + 28rem and two gaps), so a kicker's
		   rule ends where its rows do. */
		max-width: 67rem;
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}

	/* ONE layer: a section is its kicker plus its rows; the kicker's own rule
	   does the separating. */
	.sp-section {
		display: flex;
		flex-direction: column;
		/* The sidebar's scroll-to lands the kicker clear of the area's top. */
		scroll-margin-top: 1rem;
	}
	.sp-section-title {
		margin-bottom: 0.35rem;
	}
	.sp-section--danger .sp-section-title {
		color: var(--ui-danger);
	}

	/* ── The row: NAME · CONTROL · NOTE ──
	   🎛️ 12rem holds the longest name ("Use the new layout") on one line;
	   22rem holds the widest control (Sound's three choices + Preview). The
	   note takes what is left up to the reading margin's 28rem. The columns
	   are FIXED, not content-sized, so every row's control starts on the
	   same line: that one edge is what makes the values scannable. */
	.sp-row {
		display: grid;
		grid-template-columns: 12rem 22rem minmax(14rem, 28rem);
		column-gap: 2.5rem;
		align-items: start;
		padding: 0.55rem 0;
	}
	/* ⛔ No rule between rows (⚓ Nate, 2026-10-01): the section kicker's rule
	   is the only separator, and the rows' padding carries the rhythm. */

	/* Name and control share a line box as tall as a control, so a one-line
	   name sits level with a toggle, a segment or a slider alike. */
	.sp-name,
	.sp-ctl {
		min-height: 2.1rem;
		display: flex;
		align-items: center;
	}
	.sp-name {
		font-weight: var(--fw-semibold);
		font-size: var(--fs-lg);
		color: var(--text);
	}
	.sp-ctl {
		grid-column: 2;
		gap: 0.5rem;
		min-width: 0;
	}
	/* The margin: muted, the row description's old voice, its first line
	   level with the name. */
	.sp-note {
		grid-column: 3;
		padding-top: 0.45rem;
		font-size: var(--fs-md);
		color: var(--muted);
		line-height: var(--lh-snug);
	}
	/* The note's reading: a value inside the prose is in the ink, so it is
	   found before the sentence is read; the warning ink only when it is a
	   problem. */
	.sp-value {
		color: var(--text);
	}
	.sp-value.is-stale {
		color: var(--ui-warning);
	}
	/* A reading on its own line under a note (the chosen note order). */
	.sp-reading {
		display: block;
		margin-top: 0.3rem;
		color: var(--text);
	}
	/* A state in the control column, where a button would otherwise be. */
	.sp-status {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
	/* An action that belongs to the group, not to one setting. */
	.sp-row--action {
		padding-top: 0.25rem;
	}

	.sp-segment {
		flex-shrink: 0;
	}
	/* Sound's mode with its Preview beside it. */
	.sp-sound-ctl {
		flex-wrap: wrap;
	}
	.sp-sound-ctl .sp-segment--mode {
		display: inline-grid;
		grid-template-columns: repeat(3, minmax(4.5rem, 1fr));
	}
	/* Notes' two pickers, one above the other. */
	.sp-ctl.sp-ctl--stack {
		flex-direction: column;
		align-items: stretch;
	}
	/* The stacked pickers are equal-width grids on one recessed track, so a
	   long label never widens its neighbours: the voices and the orders in
	   threes (the five voices are 3 + 2), the note sets and the swaps in
	   fours. They fill the control column. */
	.sp-segment--grid3,
	.sp-segment--grid4 {
		display: grid;
		flex: 1;
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.sp-segment--grid4 {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}

	.sp-slider {
		width: 10rem;
	}
	.sp-slider-value {
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--muted);
		min-width: 3.4rem;
		white-space: nowrap;
	}

	.sp-file-input {
		display: none;
	}

	/* Full width under the Restore row: the import error / confirm UI. */
	.sp-feedback {
		padding: 0.55rem 0;
		max-width: 36.5rem;
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

	/* ── Folded: no room for the margin ──
	   12 + 22 + 14rem and the gaps. The note goes UNDER the name and the
	   control keeps its own column at the row's end. */
	@container (max-width: 53rem) {
		.sp-row {
			grid-template-columns: minmax(0, 1fr) auto;
			column-gap: 1.5rem;
		}
		.sp-name {
			grid-column: 1;
			grid-row: 1;
		}
		.sp-ctl {
			grid-column: 2;
			grid-row: 1 / span 2;
			align-self: start;
		}
		.sp-note {
			grid-column: 1;
			grid-row: 2;
			padding-top: 0.1rem;
		}
		.sp-row--action .sp-ctl {
			grid-column: 1 / -1;
		}
		.sp-segment--grid3,
		.sp-segment--grid4,
		.sp-ctl.sp-ctl--stack {
			width: 22rem;
		}
	}

	/* ── Narrow (the phone, the old gear modal): the control too goes under
	   its name, full width, and the segments share it in equal columns. ── */
	@container (max-width: 34rem) {
		.sp-row {
			grid-template-columns: minmax(0, 1fr);
			row-gap: 0.4rem;
		}
		.sp-name,
		.sp-ctl,
		.sp-note {
			grid-column: 1;
			grid-row: auto;
		}
		/* A toggle or a lone button still fits beside its name. */
		.sp-row:has(.toggle) {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.sp-row:has(.toggle) .sp-ctl {
			grid-column: 2;
			grid-row: 1;
		}
		.sp-name {
			min-height: 0;
		}
		/* …and its name keeps the toggle's line box, so the note follows the
		   name rather than the toggle's taller box. */
		.sp-row:has(.toggle) {
			row-gap: 0;
		}
		.sp-row:has(.toggle) .sp-name {
			min-height: 2.1rem;
		}
		.sp-segment--grid3,
		.sp-segment--grid4,
		.sp-ctl.sp-ctl--stack {
			width: auto;
		}
		.sp-ctl > .sp-segment:not(.sp-segment--grid3, .sp-segment--grid4, .sp-segment--mode) {
			display: grid;
			flex: 1;
			grid-auto-flow: column;
			grid-auto-columns: minmax(0, 1fr);
		}
		.sp-sound-ctl .sp-segment--mode {
			display: grid;
			flex: 1 1 100%;
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.sp-slider {
			flex: 1;
			width: auto;
		}
		/* 'Animations' and 'Metronome' are 65px of text in a 74px share at
		   320, and 'Lantern' 44px in a 55px quarter — the default 0.65rem
		   padding clipped them. */
		.sp-segment > .btn {
			padding-inline: 0.25rem;
		}
	}
</style>
