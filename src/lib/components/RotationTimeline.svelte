<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { parseNotation } from '$lib/utils/notationParser';
	import { formatKQMPaste } from '$lib/utils/formatNotation';
	import { getCharacterById, getCharacterByDisplayName } from '$lib/data/characterLookup';
	import { getAvatar } from '$lib/utils/getAvatar';
	import type { CharacterTrack } from '$lib/utils/notationParser';

	// ---------------------------------------------------------------------------
	// Props
	// ---------------------------------------------------------------------------

	let {
		characterSlots = ['blank', 'blank', 'blank', 'blank'],
		notation = $bindable(''),
		onOpenSelector
	}: {
		characterSlots?: string[];
		notation?: string;
		onOpenSelector?: () => void;
	} = $props();

	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------
	let scale = $state(60); // px per second
	let swapFrames = $state(8);

	// ---------------------------------------------------------------------------
	// Layout constants (px)
	// ---------------------------------------------------------------------------

	const LABEL_W = 84;
	const RULER_H = 24;
	const TEAM_BUFFS_H = 36;
	const CHAR_PAD_TOP = 6;
	const E_ROW_H = 14;
	const Q_ROW_H = 14;
	const ACTIVE_ROW_H = 28;
	const CHAR_BUFF_ROW_H = 7;
	const CHAR_PAD_BOTTOM = 8;
	const ROW_GAP = 4;
	const CHAR_BLOCK_H =
		CHAR_PAD_TOP +
		E_ROW_H +
		ROW_GAP +
		Q_ROW_H +
		ROW_GAP +
		ACTIVE_ROW_H +
		ROW_GAP +
		CHAR_BUFF_ROW_H +
		CHAR_PAD_BOTTOM; // = 98

	const ACTIVE_ROW_OFFSET =
		CHAR_PAD_TOP + E_ROW_H + ROW_GAP + Q_ROW_H + ROW_GAP; // = 50

	// ---------------------------------------------------------------------------
	// Element color palette (includes 'none' for blank/element-less)
	// ---------------------------------------------------------------------------

	type ElementPalette = { main: string; cd: string; active: string; border: string };

	const PALETTE: Record<string, ElementPalette> = {
		pyro:    { main: '#e05a4a', cd: 'rgba(224,90,74,0.13)',    active: 'rgba(224,90,74,0.22)',    border: 'rgba(224,90,74,0.5)'    },
		hydro:   { main: '#5ab4e0', cd: 'rgba(90,180,224,0.13)',   active: 'rgba(90,180,224,0.22)',   border: 'rgba(90,180,224,0.5)'   },
		anemo:   { main: '#4ecbb4', cd: 'rgba(78,203,180,0.13)',   active: 'rgba(78,203,180,0.22)',   border: 'rgba(78,203,180,0.5)'   },
		electro: { main: '#c070f0', cd: 'rgba(192,112,240,0.13)',  active: 'rgba(192,112,240,0.22)',  border: 'rgba(192,112,240,0.5)'  },
		cryo:    { main: '#88c8f0', cd: 'rgba(136,200,240,0.13)',  active: 'rgba(136,200,240,0.22)',  border: 'rgba(136,200,240,0.5)'  },
		geo:     { main: '#d4a040', cd: 'rgba(212,160,64,0.13)',   active: 'rgba(212,160,64,0.22)',   border: 'rgba(212,160,64,0.5)'   },
		dendro:  { main: '#80c840', cd: 'rgba(128,200,64,0.13)',   active: 'rgba(128,200,64,0.22)',   border: 'rgba(128,200,64,0.5)'   },
		none:    { main: '#6a7080', cd: 'rgba(106,112,128,0.13)',  active: 'rgba(106,112,128,0.22)',  border: 'rgba(106,112,128,0.5)'  }
	};

	function pal(element: string | undefined): ElementPalette {
		return PALETTE[element ?? 'none'] ?? PALETTE.none;
	}

	// ---------------------------------------------------------------------------
	// Derived: character data per slot
	// ---------------------------------------------------------------------------

	let slotCharacters = $derived(characterSlots.map((id) => getCharacterById(id)));

	// ---------------------------------------------------------------------------
	// Derived: rotation (filtered to only characters present in slots)
	// ---------------------------------------------------------------------------

	let rotation = $derived(parseNotation(notation, getCharacterByDisplayName, swapFrames));

	// ---------------------------------------------------------------------------
	// Track → slot mapping
	// Distributes multiple tracks for the same characterId across matching slots
	// in round-robin order (handles the all-blank case cleanly).
	// ---------------------------------------------------------------------------

	type SlottedTrack = CharacterTrack & { slotIdx: number };

	function mapTracksToSlots(tracks: CharacterTrack[], slots: string[]): SlottedTrack[] {
		const slotUsage: Record<string, number> = {};
		const result: SlottedTrack[] = [];
		for (const track of tracks) {
			const matching = slots
				.map((id, idx) => (id === track.characterId ? idx : -1))
				.filter((idx) => idx >= 0);
			if (matching.length === 0) continue;
			const usage = slotUsage[track.characterId] ?? 0;
			const slotIdx = matching[usage % matching.length];
			slotUsage[track.characterId] = usage + 1;
			result.push({ ...track, slotIdx });
		}
		return result;
	}

	let annotatedTracks = $derived(mapTracksToSlots(rotation.tracks, characterSlots));

	// Group tracks by slot index for rendering character blocks
	let tracksBySlot = $derived(
		Array.from({ length: 4 }, (_, i) => annotatedTracks.filter((t) => t.slotIdx === i))
	);

	// ---------------------------------------------------------------------------
	// Derived: timeline dimensions
	// ---------------------------------------------------------------------------

	let trackScrollWidth = $state(0);

	let totalDuration = $derived.by(() => {
		let max = rotation.totalDuration;
		for (const track of rotation.tracks) {
			for (const bar of track.eBars) max = Math.max(max, bar.start + bar.cooldown);
			for (const bar of track.qBars) max = Math.max(max, bar.start + bar.cooldown);
		}
		const viewportSeconds = trackScrollWidth > 0 ? trackScrollWidth / scale : 25;
		return Math.max(max + 2, viewportSeconds, 25);
	});
	let totalWidth = $derived(Math.round(totalDuration * scale));

	function rulerTicks(dur: number, sc: number): Array<{ t: number; x: number; major: boolean }> {
		const step = sc >= 50 ? 1 : sc >= 25 ? 2 : 5;
		const ticks = [];
		for (let t = 0; t <= dur; t += step) {
			ticks.push({ t, x: Math.round(t * sc), major: t % 5 === 0 });
		}
		return ticks;
	}

	let ticks = $derived(rulerTicks(totalDuration, scale));

	// ---------------------------------------------------------------------------
	// Geometry helpers
	// ---------------------------------------------------------------------------

	function barGeom(start: number, span: number): { left: number; width: number } {
		return {
			left: Math.round(start * scale),
			width: Math.max(Math.round(span * scale), 2)
		};
	}

	/**
	 * Connector between two consecutive notation segments.
	 * Spans vertically from the active row of the 'from' slot to the active row
	 * of the 'to' slot. Returns null if both tracks are in the same slot (no swap).
	 */
	function connectorStyle(from: SlottedTrack, to: SlottedTrack): string | null {
		if (from.slotIdx === to.slotIdx) return null;

		const x = Math.round(from.activeEnd * scale);
		const w = Math.max(Math.round((to.activeStart - from.activeEnd) * scale), 1);
		const r = Math.min(2, Math.floor(w / 2));

		const topSlot = Math.min(from.slotIdx, to.slotIdx);
		const bottomSlot = Math.max(from.slotIdx, to.slotIdx);

		// Align with the inset active bar (top: 1px, height: calc(100% - 2px))
		const y = RULER_H + TEAM_BUFFS_H + topSlot * CHAR_BLOCK_H + ACTIVE_ROW_OFFSET + 1;
		const yBottom = RULER_H + TEAM_BUFFS_H + bottomSlot * CHAR_BLOCK_H + ACTIVE_ROW_OFFSET + ACTIVE_ROW_H - 1;

		// Downward: from is top slot → free corners are TR and BL
		// Upward:   from is bottom slot → free corners are TL and BR
		const isDownward = from.slotIdx < to.slotIdx;
		const radius = isDownward ? `0 ${r}px 0 ${r}px` : `${r}px 0 ${r}px 0`;

		return `left:${x}px;top:${y}px;width:${w}px;height:${yBottom - y}px;border-radius:${radius}`;
	}

	// ---------------------------------------------------------------------------
	// Connection info per track (arrival/departure of swap connectors)
	// ---------------------------------------------------------------------------

	type ConnectInfo = { hasArrival: boolean; hasDeparture: boolean };

	let trackConnections = $derived.by(() => {
		const map = new SvelteMap<number, ConnectInfo>();
		for (let i = 0; i < annotatedTracks.length; i++) {
			const t = annotatedTracks[i];
			const prev = annotatedTracks[i - 1];
			const next = annotatedTracks[i + 1];
			map.set(t.activeStart, {
				hasArrival:   prev != null && prev.slotIdx !== t.slotIdx,
				hasDeparture: next != null && next.slotIdx !== t.slotIdx
			});
		}
		return map;
	});

	function barRadius(conn: ConnectInfo | undefined): string {
		const l = conn?.hasArrival   ? '0' : '2px';
		const r = conn?.hasDeparture ? '0' : '2px';
		return `${l} ${r} ${r} ${l}`; // TL TR BR BL
	}

	// ---------------------------------------------------------------------------
	// Svelte action: sets non-standard attributes that TS doesn't know about
	// ---------------------------------------------------------------------------

	function noCorrect(node: HTMLElement) {
		node.setAttribute('autocorrect', 'off');
		node.setAttribute('autocapitalize', 'off');
		node.setAttribute('autocomplete', 'off');
		node.setAttribute('data-gramm', 'false');
	}

	// ---------------------------------------------------------------------------
	// Paste handler: auto-formats pasted KQM notation
	// ---------------------------------------------------------------------------

	function handlePaste(e: ClipboardEvent) {
		e.preventDefault();
		const raw = e.clipboardData?.getData('text') ?? '';
		notation = formatKQMPaste(raw);
	}

	// ---------------------------------------------------------------------------
	// Label part splitter: splits activeLabel into optional / non-optional spans
	// ---------------------------------------------------------------------------

	function parseLabelParts(label: string): Array<{ text: string; optional: boolean }> {
		const parts: Array<{ text: string; optional: boolean }> = [];
		const re = /(\([^)]*\))|([^(]+)/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(label)) !== null) {
			if (m[1]) {
				parts.push({ text: m[1].slice(1, -1), optional: true });
			} else if (m[2].trim()) {
				parts.push({ text: m[2].trim(), optional: false });
			}
		}
		return parts;
	}

	// ---------------------------------------------------------------------------
	// Avatar fallback state (per slot)
	// ---------------------------------------------------------------------------

	let avatarFallbacks = $state([false, false, false, false]);

	$effect(() => {
		characterSlots.join(','); // track any slot change
		avatarFallbacks = [false, false, false, false];
	});

	function handleAvatarError(slotIdx: number) {
		avatarFallbacks[slotIdx] = true;
	}

	function initials(name: string): string {
		return name.slice(0, 2).toUpperCase();
	}
</script>

<!-- ============================================================ -->
<!--  Root                                                        -->
<!-- ============================================================ -->
<div class="rp-root">

	<!-- ── Controls ──────────────────────────────────────────── -->
	<div class="rp-controls">
		<span class="rp-controls-label">Zoom</span>
		<input
			type="range"
			min={20}
			max={120}
			step={5}
			bind:value={scale}
			class="rp-zoom-slider"
		/>
		<span class="rp-controls-value">{scale}px/s</span>
		<span class="rp-controls-divider">|</span>
		<span class="rp-controls-label">Swap ping</span>
		<input
			type="range"
			min={4}
			max={20}
			step={1}
			bind:value={swapFrames}
			class="rp-zoom-slider"
		/>
		<span class="rp-controls-value">{swapFrames}f</span>
	</div>

	<!-- ── Timeline ──────────────────────────────────────────── -->
	<div class="rp-scroll-wrapper">

		<!-- Left label column (sticky, non-scrolling) -->
		<div class="rp-label-col" style:width="{LABEL_W}px">

			<!-- Ruler spacer -->
			<div class="rp-label-spacer" style:height="{RULER_H}px"></div>

			<!-- Team buffs label -->
			<div class="rp-label-cell" style:height="{TEAM_BUFFS_H}px">
				<span class="rp-label-text">TEAM<br />BUFFS</span>
			</div>

			<!-- Character slot labels (always 4) -->
			{#each characterSlots as slotId, i (i)}
				{@const char = slotCharacters[i]}
				{@const p = pal(char?.element)}
				<div class="rp-label-cell char-label" style:height="{CHAR_BLOCK_H}px">
					<div
						class="rp-avatar-wrap"
						class:rp-avatar-clickable={!!onOpenSelector}
						style:border-color={p.main}
						style:color={p.main}
						onclick={onOpenSelector}
						role={onOpenSelector ? 'button' : undefined}
						tabindex={onOpenSelector ? 0 : undefined}
						aria-label={onOpenSelector ? 'Open character selector' : undefined}
					>
						{#if !avatarFallbacks[i]}
							<img
								class="rp-avatar-img"
								src={getAvatar(slotId, false, 'side')}
								alt={char?.displayName ?? slotId}
								onerror={() => handleAvatarError(i)}
							/>
						{:else}
							<span class="rp-avatar-initials">
								{initials(char?.displayName ?? slotId)}
							</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<!-- Right scrollable track area -->
		<div class="rp-track-scroll" bind:clientWidth={trackScrollWidth}>
			<div class="rp-tracks" style:width="{totalWidth}px">

				<!-- Ruler -->
				<div class="rp-ruler" style:height="{RULER_H}px">
					{#each ticks as tick (tick.t)}
						<div class="rp-tick" class:major={tick.major} style:left="{tick.x}px">
							{#if tick.major && tick.t > 0}
								<span class="rp-tick-label">{tick.t}s</span>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Team buffs row (placeholder) -->
				<div class="rp-team-buffs" style:height="{TEAM_BUFFS_H}px">
					{#each ticks.filter((t) => t.major) as tick (tick.t)}
						<div class="rp-gridline" style:left="{tick.x}px"></div>
					{/each}
					<span class="rp-team-buffs-empty">team buffs — auto-detection coming soon</span>
				</div>

				<!-- Character slot tracks (always 4 rows) -->
				{#each slotCharacters as char, slotIdx (slotIdx)}
					{@const p = pal(char?.element)}
					{@const slotTracks = tracksBySlot[slotIdx]}

					<div class="rp-char-block" style:height="{CHAR_BLOCK_H}px">

						<!-- Grid lines -->
						{#each ticks.filter((t) => t.major) as tick (tick.t)}
							<div class="rp-gridline" style:left="{tick.x}px"></div>
						{/each}

						<!-- E row -->
						<div class="rp-row" style:top="{CHAR_PAD_TOP}px" style:height="{E_ROW_H}px">
							{#each slotTracks as track (track.activeStart)}
								{#each track.eBars as bar, barIdx (barIdx)}
									{#if bar.uptime > 0}
										{@const u = barGeom(bar.start, bar.uptime)}
										<div
											class="rp-bar-uptime"
											style:left="{u.left}px"
											style:width="{u.width}px"
											style:background={p.main}
										>
											<span class="rp-bar-cast-label">{bar.label}</span>
										</div>
										{@const cd = barGeom(bar.start + bar.uptime, bar.cooldown - bar.uptime)}
										{#if cd.width > 0}
											<div
												class="rp-bar-cd"
												style:left="{cd.left}px"
												style:width="{cd.width}px"
												style:background={p.cd}
												style:border-color="rgba(255,255,255,0.08)"
											>
												{#if cd.width > 32}
													<span class="rp-bar-cd-label">{bar.cooldown}s</span>
												{/if}
											</div>
										{/if}
									{:else}
										{@const cd = barGeom(bar.start, bar.cooldown)}
										<div
											class="rp-bar-cd rp-bar-instant"
											style:left="{cd.left}px"
											style:width="{cd.width}px"
											style:background={p.cd}
											style:border-color="rgba(255,255,255,0.06)"
											style:border-left-color={p.main}
										>
											<span class="rp-bar-cast-label" style:color={p.main}>{bar.label}</span>
											{#if cd.width > 40}
												<span class="rp-bar-cd-label">{bar.cooldown}s</span>
											{/if}
										</div>
									{/if}
								{/each}
							{/each}
						</div>

						<!-- Q row -->
						<div
							class="rp-row"
							style:top="{CHAR_PAD_TOP + E_ROW_H + ROW_GAP}px"
							style:height="{Q_ROW_H}px"
						>
							{#each slotTracks as track (track.activeStart)}
								{#each track.qBars as bar, barIdx (barIdx)}
									{#if bar.uptime > 0}
										{@const u = barGeom(bar.start, bar.uptime)}
										<div
											class="rp-bar-uptime"
											style:left="{u.left}px"
											style:width="{u.width}px"
											style:background={p.main}
										>
											<span class="rp-bar-cast-label">{bar.label}</span>
										</div>
										{@const cd = barGeom(bar.start + bar.uptime, bar.cooldown - bar.uptime)}
										{#if cd.width > 0}
											<div
												class="rp-bar-cd"
												style:left="{cd.left}px"
												style:width="{cd.width}px"
												style:background={p.cd}
												style:border-color="rgba(255,255,255,0.08)"
											>
												{#if cd.width > 32}
													<span class="rp-bar-cd-label">{bar.cooldown}s</span>
												{/if}
											</div>
										{/if}
									{:else}
										{@const cd = barGeom(bar.start, bar.cooldown)}
										<div
											class="rp-bar-cd rp-bar-instant"
											style:left="{cd.left}px"
											style:width="{cd.width}px"
											style:background={p.cd}
											style:border-color="rgba(255,255,255,0.06)"
											style:border-left-color={p.main}
										>
											<span class="rp-bar-cast-label" style:color={p.main}>{bar.label}</span>
											{#if cd.width > 40}
												<span class="rp-bar-cd-label">{bar.cooldown}s</span>
											{/if}
										</div>
									{/if}
								{/each}
							{/each}
						</div>

						<!-- Active row (one bar per track in this slot) -->
						<div class="rp-row" style:top="{ACTIVE_ROW_OFFSET}px" style:height="{ACTIVE_ROW_H}px">
							{#each slotTracks as track (track.activeStart)}
								{@const activeLeft = Math.round(track.activeStart * scale)}
								{@const activeW = Math.max(Math.round((track.activeEnd - track.activeStart) * scale), 4)}
								{@const conn = trackConnections.get(track.activeStart)}
								{@const labelLeft = Math.round((track.labelStart - track.activeStart) * scale) + 6}
								<div
									class="rp-active-bar"
									class:rp-active-bar--unset={track.hasUnsetDuration}
									style:left="{activeLeft}px"
									style:width="{activeW}px"
									style:border-radius={barRadius(conn)}
								>
									{#if track.activeLabel}
										<div class="rp-active-label" style:left="{labelLeft}px">
											{#each parseLabelParts(track.activeLabel) as part, pi (pi)}
												<span class="rp-active-text" class:rp-active-text--optional={part.optional}>{part.text}</span>
											{/each}
										</div>
									{/if}
								</div>
								<!-- Cast-time overlays: one per E/Q bar, tinted with element color -->
								{#each [...track.eBars, ...track.qBars] as bar, ci (ci)}
									{@const castLeft = Math.round(bar.start * scale)}
									{@const castW = Math.max(Math.round(bar.castTime * scale), 2)}
									<div
										class="rp-cast-marker"
										style:left="{castLeft}px"
										style:width="{castW}px"
										style:background={p.border}
									></div>
								{/each}
							{/each}
						</div>

						<!-- Char-specific buff row (placeholder) -->
						<div
							class="rp-row"
							style:top="{ACTIVE_ROW_OFFSET + ACTIVE_ROW_H + ROW_GAP}px"
							style:height="{CHAR_BUFF_ROW_H}px"
						></div>

					</div>
				{/each}

				<!-- Swap connectors: between consecutive notation segments -->
				<!-- Color is keyed to the 'to' character's element -->
				{#each annotatedTracks as track, i (i)}
					{#if i < annotatedTracks.length - 1}
						{@const next = annotatedTracks[i + 1]}
						{@const style = connectorStyle(track, next)}
						{#if style}
							<div
								class="rp-connector"
								{style}
							></div>
						{/if}
					{/if}
				{/each}

			</div><!-- /rp-tracks -->
		</div><!-- /rp-track-scroll -->
	</div><!-- /rp-scroll-wrapper -->

	<!-- ── Notation box ──────────────────────────────────────── -->
	<div class="rp-notation-wrap">
		<textarea
			class="rp-notation"
			bind:value={notation}
			rows={3}
			spellcheck={false}
			use:noCorrect
			onpaste={handlePaste}
			placeholder="e.g. Bennett Q > Xiangling Q E > Kazuha Q hEP > Fischl E N1 N2 ~2s"
		></textarea>
	</div>

</div>


<style>
	/* ── Root ─────────────────────────────────────────────────── */
	.rp-root {
		--bg: #0f1528;
		--card: #17213a;
		--border: #253252;
		--text: #e6edf8;
		--muted: #9eacc8;

		font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace;
		font-size: 10px;
		color: var(--text);
		background: var(--bg);
		border-radius: 10px;
		padding: 14px 16px 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	/* ── Controls ─────────────────────────────────────────────── */
	.rp-controls {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--muted);
	}
	.rp-controls-label {
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.rp-controls-value {
		font-size: 9px;
		min-width: 44px;
	}
	.rp-controls-divider {
		opacity: 0.2;
		margin: 0 4px;
	}
	.rp-zoom-slider {
		width: 80px;
		accent-color: rgba(200, 205, 215, 0.5);
	}

	/* ── Scroll wrapper ───────────────────────────────────────── */
	.rp-scroll-wrapper {
		display: flex;
		overflow-x: auto;
		overflow-y: hidden;
	}

	/* ── Label column ─────────────────────────────────────────── */
	.rp-label-col {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		position: sticky;
		left: 0;
		z-index: 10;
		background: var(--bg);
	}
	.rp-label-spacer {
		flex-shrink: 0;
	}
	.rp-label-cell {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding-right: 10px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}
	.rp-label-text {
		font-family: 'Space Grotesk', 'IBM Plex Mono', sans-serif;
		font-size: 8px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--muted);
		text-align: right;
		line-height: 1.4;
	}

	/* ── Character label cell ─────────────────────────────────── */
	.char-label {
		flex-direction: row;
		justify-content: flex-start;
		align-items: center;
		padding: 0 0 0 8px;
		gap: 6px;
	}

	/* ── Avatar ───────────────────────────────────────────────── */
	.rp-avatar-wrap {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: 1.5px solid;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
		flex-shrink: 0;
		transition: box-shadow 0.18s;
	}
	.rp-avatar-clickable {
		cursor: pointer;
	}
	.rp-avatar-clickable:hover {
		box-shadow: 0 0 0 2px currentColor, 0 0 10px 1px currentColor;
	}

	.rp-avatar-img {
		/* Side avatars are 128×128 with the character positioned toward the
		   center/bottom. Scale up and translate upward within the clipping circle. */
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.4) translateX(-1.4%) translateY(-14%);
	}

	.rp-avatar-initials {
		font-family: 'Space Grotesk', sans-serif;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.03em;
	}

	/* ── Track scroll container ───────────────────────────────── */
	.rp-track-scroll {
		flex: 1;
		min-width: 0;
	}

	/* ── Track area ───────────────────────────────────────────── */
	.rp-tracks {
		position: relative;
	}

	/* ── Ruler ────────────────────────────────────────────────── */
	.rp-ruler {
		position: relative;
		border-bottom: 1px solid var(--border);
	}
	.rp-tick {
		position: absolute;
		bottom: 0;
		width: 1px;
		background: #253252;
		height: 4px;
	}
	.rp-tick.major {
		height: 8px;
		background: #3a4e72;
	}
	.rp-tick-label {
		position: absolute;
		bottom: 10px;
		left: 0;
		transform: translateX(-50%);
		font-size: 8.5px;
		color: var(--muted);
		white-space: nowrap;
		pointer-events: none;
	}

	/* ── Grid lines ───────────────────────────────────────────── */
	.rp-gridline {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: #1a2540;
		pointer-events: none;
		z-index: 0;
	}

	/* ── Team buffs row ───────────────────────────────────────── */
	.rp-team-buffs {
		position: relative;
		border-bottom: 2px solid #253252;
		display: flex;
		align-items: center;
	}
	.rp-team-buffs-empty {
		padding-left: 8px;
		font-size: 8px;
		color: #3a4e72;
		pointer-events: none;
	}

	/* ── Character block ──────────────────────────────────────── */
	.rp-char-block {
		position: relative;
		border-bottom: 1px solid var(--border);
	}

	/* ── Rows ─────────────────────────────────────────────────── */
	.rp-row {
		position: absolute;
		left: 0;
		right: 0;
	}
	/* ── Ability bars ─────────────────────────────────────────── */
	.rp-bar-uptime {
		position: absolute;
		top: 1px;
		height: calc(100% - 2px);
		border-radius: 3px 0 0 3px;
		z-index: 2;
		min-width: 2px;
		display: flex;
		align-items: center;
		padding: 0 3px;
		overflow: hidden;
	}
	.rp-bar-cd {
		position: absolute;
		top: 1px;
		height: calc(100% - 2px);
		border-radius: 0 3px 3px 0;
		border: 1px solid;
		border-left: none;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 2px;
	}
	.rp-bar-instant {
		border-radius: 3px;
		border-left: 2px solid !important;
		justify-content: center;
	}
	/* Cast token pinned to the left edge inside instant bars */
	.rp-bar-instant .rp-bar-cast-label {
		position: absolute;
		left: 5px;
	}
	.rp-bar-cast-label {
		font-size: 7px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.85);
		white-space: nowrap;
		pointer-events: none;
		letter-spacing: 0.02em;
		flex-shrink: 0;
	}
	.rp-bar-cd-label {
		font-size: 7.5px;
		color: #4a6090;
		white-space: nowrap;
		pointer-events: none;
	}

	/* ── Active bar ───────────────────────────────────────────── */
	.rp-active-bar {
		position: absolute;
		top: 1px;
		height: calc(100% - 2px);
		background: #4F546B;
		overflow: hidden;
		z-index: 2;
		min-width: 4px;
	}
	.rp-active-bar--unset {
		background: transparent;
		border: 1.5px dashed #4F546B;
	}
	/* Container div that positions label text at the correct time offset */
	.rp-active-label {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		gap: 3px;
		white-space: nowrap;
		pointer-events: none;
	}
	.rp-active-text {
		font-size: 8.5px;
		font-weight: 500;
		color: #9eacc8;
	}
	.rp-active-text--optional {
		opacity: 0.45;
		font-style: italic;
	}

	/* ── Cast-time markers ────────────────────────────────────── */
	.rp-cast-marker {
		position: absolute;
		top: 1px;
		height: calc(100% - 2px);
		z-index: 3;
		border-radius: 1px;
		pointer-events: none;
	}

	/* ── Swap connector ───────────────────────────────────────── */
	.rp-connector {
		position: absolute;
		background: #4F546B;
		border: none;
		z-index: 0;
		pointer-events: none;
	}

	/* ── Notation box ─────────────────────────────────────────── */
	.rp-notation-wrap {
		display: flex;
		flex-direction: column;
	}
	.rp-notation {
		background: #060914;
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--text);
		font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace;
		font-size: 12px;
		line-height: 1.6;
		padding: 10px 12px;
		resize: vertical;
		outline: none;
		width: 100%;
		box-sizing: border-box;
	}
	.rp-notation:focus {
		border-color: #6cb5ff;
	}
</style>
