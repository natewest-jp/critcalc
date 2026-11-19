<script module lang="ts">
	import { m } from '$lib/paraglide/messages';

	/** The page's groups, in order: the menu state's sidebar lists them under
	 *  Settings and scrolls to `#settings-<id>`. A label is a getter, so it
	 *  follows the locale (`$lib/i18n/labels.ts` says why). */
	export const SETTINGS_GROUPS = [
		{
			id: 'appearance',
			get label() {
				return m.settings_appearance();
			}
		},
		{
			id: 'planner',
			get label() {
				return m.settings_planner();
			}
		},
		{
			id: 'sound',
			get label() {
				return m.settings_playback_sound();
			}
		},
		{
			id: 'data',
			get label() {
				return m.settings_your_data();
			}
		}
	] as const;
</script>

<script lang="ts">
	import { notices, announceAfterReload } from '$lib/notices.svelte';
	import { onMount } from 'svelte';
	import { hrefTo } from '$lib/i18n/paths';
	import { HUMAN_TIMING_DEFAULTS, siteSettings, SWAP_PING_DEFAULT } from '$lib/stores';
	import Mark from './Mark.svelte';
	import Msg from './Msg.svelte';
	import { htmlLang } from '$lib/i18n/locale';
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
	import { downloadEnvelope } from '$lib/utils/settingsBackup';
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

	/** ⚓ The work lives in the store, so a backup is v3: every profile
	 *  (design §10, §12 Q11). */
	const session = () => import('$lib/storage/session.svelte').then((m) => m.storageSession);

	/** The session itself, once loaded (the new layout only): the Profile
	 *  link names the active profile. */
	let store = $state<Awaited<ReturnType<typeof session>> | null>(null);
	$effect(() => {
		void session().then((s) => (store = s));
	});
	const realProfile = $derived(store?.profile?.kind === 'real' ? store.profile : null);
	const anySeen = $derived($siteSettings.seenGuestNotice || $siteSettings.seenLinksNotice);

	function showNoticesAgain() {
		siteSettings.resetSeen();
		notices.toast('success', m.settings_tips_and_notices_will_show_again());
	}

	/** ⚓ The opposite of Restore (2026-10-26): it empties the browser, as a
	 *  first visit finds it. A DIALOG, because it takes every profile at once
	 *  and skips the Trash; it says when the last backup was, since Export is
	 *  one row above and this cannot be undone. */
	async function deleteEverything() {
		const s = await session();
		const ok = await notices.ask({
			title: m.settings_delete_everything_in_this_browser(),
			body:
				lastBackup === null
					? m.settings_delete_everything_body_no_backup()
					: m.settings_delete_everything_body_last_backup({ when: daysAgo(lastBackup) }),
			confirm: m.settings_delete_everything(),
			cancel: m.settings_keep_it(),
			danger: true
		});
		if (!ok) return;
		try {
			await s.wipe();
		} catch {
			notices.toast('error', m.settings_this_browser_isn_t_letting_critcalc());
			return;
		}
		announceAfterReload(m.settings_everything_in_this_browser_was_deleted());
		location.reload();
	}

	async function exportBackup() {
		const at = Date.now();
		const file = await (await session()).backup(at);
		if (!file) {
			importError = m.settings_this_browser_isn_t_letting_critcalc_read();
			return;
		}
		downloadEnvelope(file, at);
		lastBackup = at;
	}

	/** Saved rotations and lineups changed since the last backup, or ever
	 *  when there has been none (that is what makes "never" a warning). */
	let storeSince = $state(0);
	$effect(() => {
		const at = lastBackup ?? 0;
		void session()
			.then((s) => s.changedSince(at))
			.then((n) => (storeSince = n));
	});
	let savedSince = $derived(storeSince);
	/** ⚓ Color only when it is a problem (Nate 2026-10-26), so it keeps
	 *  meaning something: never, or older than the window, with work since. */
	const stale = $derived(backupIsStale(lastBackup, savedSince));

	/** "today", "yesterday", "3 days ago", in the page's language. */
	function daysAgo(at: number): string {
		const days = Math.max(0, Math.floor((Date.now() - at) / 86_400_000));
		return new Intl.RelativeTimeFormat(htmlLang(), { numeric: 'auto' }).format(-days || 0, 'day');
	}

	// Import flow: pick file → parse → confirm → restore + reload (the page
	// re-reads the whole store at once).
	let fileInput: HTMLInputElement | undefined = $state();
	/** The parsed file, waiting on its restore. */
	let pendingStore = $state<Extract<StoreParse, { ok: true }> | null>(null);
	let importError = $state<string | null>(null);

	async function onFileChosen(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = ''; // allow re-picking the same file
		if (!file) return;
		importError = null;
		pendingStore = null;
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
			title: m.settings_replace_everything_with_this_backup(),
			body: m.settings_it_holds_summary({ summary: storeSummary(res.counts) }),
			confirm: m.settings_replace_and_reload(),
			danger: true
		});
		if (!ok) return;
		pendingStore = res;
		await confirmStoreImport();
	}

	async function confirmStoreImport() {
		if (!pendingStore) return;
		try {
			await (await session()).restore(pendingStore);
		} catch {
			pendingStore = null;
			importError = m.settings_this_browser_isn_t_letting_critcalc_save();
			return;
		}
		// Said after the reload (`announceAfterReload`): nothing else would.
		announceAfterReload(m.settings_restored_from_your_backup());
		location.reload();
	}

	/** "Main and Alt", "Main, Alt, and Spare", in the page's language. */
	const listOf = (items: string[]) =>
		new Intl.ListFormat(htmlLang(), { type: 'conjunction' }).format(items);
	/** "2 profiles (Main and Alt), 3 rotations, 1 lineup, and 4 teams". */
	const storeSummary = (c: StoreCounts): string => {
		const n = c.profiles.length;
		const who = n
			? m.settings_count_profiles({ count: n, names: listOf(c.profiles) })
			: m.settings_no_profiles_of_your_own();
		return listOf([
			who,
			m.settings_count_rotations({ count: c.rotations }),
			m.settings_count_lineups({ count: c.lineups }),
			m.settings_count_teams({ count: c.teams })
		]);
	};

	// ── Human timing: ONE control (2026-10-26) ──────────────────────────────
	// The switch and "what it adjusts" were two rows; Off is now the control's
	// first choice, so it reads as one question. The stored shape is unchanged
	// (`humanTiming` + `humanTimingMode`), so a mode chosen before survives an
	// Off and comes back with On.
	const HUMAN_CHOICES = [
		['off', m.settings_off()],
		['padding', m.settings_padding()],
		['animations', m.settings_animations()],
		['both', m.settings_both()]
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
		notices.toast('success', m.settings_planner_settings_reset(), {
			actions: [{ label: m.settings_undo(), run: () => setPlanner(before) }]
		});
	}
</script>

<!-- The markup in the notes' messages (`Msg.svelte`). -->
{#snippet strong(text: string)}<strong>{text}</strong>{/snippet}
{#snippet value(text: string)}<strong class="sp-value">{text}</strong>{/snippet}
{#snippet staleValue(text: string)}<strong class="sp-value" class:is-stale={stale}>{text}</strong
	>{/snippet}

<!-- ⚓ THE ROW (settings surface round, 2026-10-26): a NAME, its CONTROL, and
     a NOTE — three columns, so the names make one column to scan and the
     controls one straight edge to read values down; what a setting means
     sits in the margin, level with its row (the reading layout's idea).
     Narrower, the note folds under the name; narrower still, the control
     too. The questions the streamer couldn't find answers to are the GROUP
     names, so a group is a question (Appearance, Planner…), never a kind of
     control. -->
<div class="sp">
	<section class="sp-section" id="settings-appearance">
		<h2 class="kicker sp-section-title">{m.settings_appearance()}</h2>

		<label class="sp-row">
			<span class="sp-name">{m.settings_updated_outfits()}</span>
			<span class="sp-ctl">
				<span class="toggle">
					<input
						type="checkbox"
						checked={$siteSettings.useNewOutfits}
						onchange={() => siteSettings.setUseNewOutfits(!$siteSettings.useNewOutfits)}
					/>
					<span class="toggle-track"><span class="toggle-thumb"></span></span>
					<span class="toggle-label"
						>{$siteSettings.useNewOutfits ? m.settings_on() : m.settings_off()}</span
					>
				</span>
			</span>
			<span class="sp-note">{m.settings_show_characters_in_their_newest_outfit()}</span>
		</label>

		<!-- ⚓ The Traveler twin is an ACCOUNT fact (2026-10-26): it lives on
		     each profile's page. -->
	</section>

	<section class="sp-section" id="settings-planner">
		<h2 class="kicker sp-section-title">{m.settings_planner()}</h2>

		<div class="sp-row">
			<span class="sp-name">{m.settings_human_timing()}</span>
			<span class="sp-ctl">
				<span class="segment sp-segment" role="radiogroup" aria-label={m.settings_human_timing()}>
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
			<span class="sp-note"
				><Msg parts={m.settings_human_timing_note.parts()} tags={{ strong }} /></span
			>
		</div>

		{#if padding}
			<div class="sp-row">
				<span class="sp-name">{m.settings_input_padding()}</span>
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
						aria-label={m.settings_input_padding_in_frames()}
					/>
					<span class="sp-slider-value"
						>{$siteSettings.humanTimingPadFrames}f · {(
							$siteSettings.humanTimingPadFrames / FPS
						).toFixed(2)}s</span
					>
				</span>
				<span class="sp-note">{m.settings_how_long_that_pause_is_kqm_suggests_10()}</span>
			</div>

			<label class="sp-row">
				<span class="sp-name">{m.settings_mark_padding()}</span>
				<span class="sp-ctl">
					<span class="toggle">
						<input
							type="checkbox"
							checked={$siteSettings.showHumanPadding}
							onchange={() =>
								siteSettings.setHumanTiming({ showHumanPadding: !$siteSettings.showHumanPadding })}
						/>
						<span class="toggle-track"><span class="toggle-thumb"></span></span>
						<span class="toggle-label"
							>{$siteSettings.showHumanPadding ? m.settings_on() : m.settings_off()}</span
						>
					</span>
				</span>
				<span class="sp-note">{m.settings_draws_each_pause_as_a_hatched_sliver_on()}</span>
			</label>
		{/if}

		<div class="sp-row">
			<span class="sp-name">{m.settings_swap_ping()}</span>
			<span class="sp-ctl sp-slider-ctl">
				<input
					class="slider sp-slider"
					type="range"
					min="0"
					max="200"
					step="5"
					value={$siteSettings.swapPing}
					oninput={(e) => siteSettings.setSwapPing(Number(e.currentTarget.value))}
					aria-label={m.settings_swap_ping_in_milliseconds()}
				/>
				<span class="sp-slider-value"
					>{$siteSettings.swapPing}ms · {swapFramesForPing($siteSettings.swapPing)}f</span
				>
			</span>
			<span class="sp-note">{m.settings_the_ping_genshin_shows_in_the_top_right()}</span>
		</div>

		<label class="sp-row">
			<span class="sp-name">{m.settings_coverage_strips()}</span>
			<span class="sp-ctl">
				<span class="toggle">
					<input
						type="checkbox"
						checked={$siteSettings.showCoverageStrips}
						onchange={() => siteSettings.setShowCoverageStrips(!$siteSettings.showCoverageStrips)}
					/>
					<span class="toggle-track"><span class="toggle-thumb"></span></span>
					<span class="toggle-label"
						>{$siteSettings.showCoverageStrips ? m.settings_on() : m.settings_off()}</span
					>
				</span>
			</span>
			<span class="sp-note">{m.settings_shows_each_character_s_coverage_strip()}</span>
		</label>

		<div class="sp-row sp-row--action">
			<span class="sp-ctl">
				<button class="btn btn--sm" disabled={plannerAtDefaults} onclick={resetPlanner}>
					<Mark name="reset" size={12} />
					{m.settings_reset_to_defaults()}
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
		<h2 class="kicker sp-section-title">{m.settings_playback_sound()}</h2>

		<div class="sp-row">
			<span class="sp-name">{m.settings_sound()}</span>
			<span class="sp-ctl sp-sound-ctl">
				<span
					class="segment sp-segment sp-segment--mode"
					role="radiogroup"
					aria-label={m.settings_sound()}
				>
					<button
						class="btn"
						class:is-active={!$siteSettings.playbackSound}
						role="radio"
						aria-checked={!$siteSettings.playbackSound}
						onclick={() => playback.setSound(false)}>{m.settings_off()}</button
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
					aria-label={m.settings_preview_the_sound()}
					disabled={!$siteSettings.playbackSound}
					onclick={() => playback.preview()}
				>
					<Mark name="play" size={12} filled />
					{m.settings_preview()}
				</button>
			</span>
			<span class="sp-note"><Msg parts={m.settings_play_note.parts()} tags={{ strong }} /></span>
		</div>

		{#if $siteSettings.playbackSound}
			{#if $siteSettings.playbackSoundMode === 'melodic'}
				<div class="sp-row">
					<span class="sp-name">{m.settings_voice()}</span>
					<span class="sp-ctl">
						<span
							class="segment sp-segment sp-segment--grid3"
							role="radiogroup"
							aria-label={m.settings_voice()}
						>
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
					<span class="sp-name">{m.settings_notes()}</span>
					<span class="sp-ctl sp-ctl--stack">
						<span
							class="segment sp-segment sp-segment--grid3"
							role="radiogroup"
							aria-label={m.settings_note_order()}
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
							aria-label={m.settings_note_set()}
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
						{m.settings_the_top_row_picks_which_input_gets_which()}
						<!-- ⚓ The chosen order spelled out, VISIBLE (Nate 2026-10-26): its
						     title is hover-only, and a touch screen never sees one. -->
						<span class="sp-reading">{orderHint($siteSettings.playbackOrder)}</span>
					</span>
				</div>
			{/if}

			<div class="sp-row">
				<span class="sp-name">{m.settings_swap()}</span>
				<span class="sp-ctl">
					<span
						class="segment sp-segment sp-segment--grid4"
						role="radiogroup"
						aria-label={m.settings_swap_sound()}
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
				<span class="sp-note">{m.settings_a_soft_hum_while_the_next_character()}</span>
			</div>

			<div class="sp-row">
				<span class="sp-name">{m.settings_volume()}</span>
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
						aria-label={m.settings_playback_volume()}
					/>
					<span class="sp-slider-value">{Math.round($siteSettings.playbackVolume * 100)}%</span>
				</span>
			</div>
		{/if}
	</section>

	<section class="sp-section" id="settings-data">
		<h2 class="kicker sp-section-title">{m.settings_your_data()}</h2>

		<!-- ⚓ The VALUE is bold, never the sentence or its label (Nate
		     2026-10-26): "never" / "3 days ago" and the count are the reading. -->
		<div class="sp-row">
			<span class="sp-name">{m.settings_backup()}</span>
			<span class="sp-ctl">
				<button class="btn btn--primary" onclick={exportBackup}>
					<Mark name="download" />
					{m.settings_export()}
				</button>
			</span>
			<span class="sp-note">
				{m.settings_critcalc_has_no_server_so_everything_you()}
				{#if lastBackup === null}
					<Msg parts={m.settings_last_backup_never.parts()} tags={{ value: staleValue }} />
				{:else}
					<Msg
						parts={m.settings_last_backup_when.parts({ when: daysAgo(lastBackup) })}
						tags={{ value: staleValue }}
					/>
					<!-- The space before the block is OUTSIDE it: Svelte trims a
					     block's own edges (it once rendered "ago.1 saved item"). -->
					{#if savedSince > 0}
						<Msg parts={m.settings_saved_since.parts({ count: savedSince })} tags={{ value }} />
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
				<span class="sp-name">{m.settings_storage()}</span>
				<span class="sp-ctl">
					{#if persisted}
						<span class="sp-status"
							><Mark name="check" size={14} />
							{m.settings_kept()}</span
						>
					{:else if persisted === null}
						<span class="sp-status">{m.settings_unknown()}</span>
					{:else if safari}
						<span class="sp-status">{m.settings_not_kept()}</span>
					{:else if persistDeclined}
						<span class="sp-status">{m.settings_declined()}</span>
					{:else}
						<button class="btn" onclick={askToKeep}>{m.settings_keep_my_data()}</button>
					{/if}
				</span>
				<span class="sp-note">
					{#if persisted}
						{m.settings_this_browser_will_keep_your_data_until()}
					{:else if persisted === null}
						{m.settings_this_browser_doesn_t_say_whether_it_will()}
					{:else if persisted === false && safari}
						{m.settings_safari_may_clear_your_data_after_a_while()}
					{:else if persisted === false && persistDeclined}
						{m.settings_this_browser_declined_so_it_may_still()}
					{:else if persisted === false}
						{m.settings_this_browser_may_clear_your_data_on_its()}
					{/if}
				</span>
			</div>
		{/if}

		<div class="sp-row">
			<span class="sp-name">{m.settings_restore()}</span>
			<span class="sp-ctl">
				<button class="btn btn--primary" onclick={() => fileInput?.click()}>
					<Mark name="upload" />
					{m.settings_import()}
				</button>
				<input
					bind:this={fileInput}
					type="file"
					accept="application/json,.json"
					class="sp-file-input"
					onchange={onFileChosen}
				/>
			</span>
			<span class="sp-note">{m.settings_replaces_every_profile_in_this_browser()}</span>
		</div>

		{#if importError}
			<div class="sp-feedback">
				<p class="sp-import-error" role="alert">{importError}</p>
			</div>
		{/if}

		{#if realProfile}
			<!-- ⚓ A LINK, not a second copy (2026-10-26): clearing acts on one
			     profile, so its control lives on that profile's page; Settings
			     is where people look for it, so this row points there. -->
			<div class="sp-row">
				<span class="sp-name">{m.settings_clear_profile_data()}</span>
				<span class="sp-ctl">
					<a class="btn" href={hrefTo('/profile')}>{m.settings_open_profile()}</a>
				</span>
				<span class="sp-note">{m.settings_clear_a_profile_s_roster_rotations()}</span>
			</div>
		{/if}

		<div class="sp-row">
			<span class="sp-name">{m.settings_tips_and_notices()}</span>
			<span class="sp-ctl">
				<button class="btn" disabled={!anySeen} onclick={showNoticesAgain}
					>{m.settings_show_again()}</button
				>
			</span>
			<span class="sp-note">{m.settings_brings_back_the_one_time_notices_you_ve()}</span>
		</div>

		<div class="sp-row">
			<span class="sp-name">{m.settings_delete_everything()}</span>
			<span class="sp-ctl">
				<button class="btn btn--danger" onclick={() => void deleteEverything()}>
					<Mark name="delete" />
					{m.settings_delete_everything_ellipsis()}
				</button>
			</span>
			<span class="sp-note">{m.settings_removes_every_profile_the_trash_and_your()}</span>
		</div>
	</section>
</div>

<style>
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

	/* The row's own folds live in app.css (§ THE SETTING ROW); these are the
	   panel's pickers at the same two widths. */
	@container (max-width: 53rem) {
		.sp-segment--grid3,
		.sp-segment--grid4,
		.sp-ctl.sp-ctl--stack {
			width: 22rem;
		}
	}

	@container (max-width: 34rem) {
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
