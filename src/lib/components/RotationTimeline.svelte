<script lang="ts">
	import { parseNotation } from '$lib/utils/notationParser';
	import { getCharacterByDisplayName } from '$lib/data/characterLookup';
	import type { CharacterTrack } from '$lib/utils/notationParser';

	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------

	let notation = $state('Bennett Q > Kaedehara Kazuha Q hEP > Xiangling Q E > Fischl E ~2s(N1 N2)');
	let scale = $state(60); // px per second (default = 60px/s = 1px/frame @ 60fps)
	let swapFrames = $state(8);

	// ---------------------------------------------------------------------------
	// Layout constants (px)
	// ---------------------------------------------------------------------------

	const LABEL_W = 80;
	const RULER_H = 24;
	const TEAM_BUFFS_H = 36; // placeholder row height — auto-detection is a future feature
	const CHAR_PAD_TOP = 6;
	const E_ROW_H = 18;
	const Q_ROW_H = 18;
	const ACTIVE_ROW_H = 24;
	const CHAR_BUFF_ROW_H = 12;
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

	// Offset from the top of a char block to the top of its active row
	const ACTIVE_ROW_OFFSET =
		CHAR_PAD_TOP + E_ROW_H + ROW_GAP + Q_ROW_H + ROW_GAP; // = 50

	// Connector goes from bottom of char[i]'s active row to top of char[i+1]'s active row
	const CONNECTOR_TOP_IN_BLOCK = ACTIVE_ROW_OFFSET + ACTIVE_ROW_H; // = 74
	const CONNECTOR_H = CHAR_BLOCK_H - ACTIVE_ROW_H; // = 74

	// ---------------------------------------------------------------------------
	// Element color palette
	// ---------------------------------------------------------------------------

	type ElementPalette = { main: string; cd: string; active: string; border: string };

	const PALETTE: Record<string, ElementPalette> = {
		pyro:    { main: '#e05a4a', cd: 'rgba(224,90,74,0.13)',    active: 'rgba(224,90,74,0.22)',    border: 'rgba(224,90,74,0.5)' },
		hydro:   { main: '#5ab4e0', cd: 'rgba(90,180,224,0.13)',   active: 'rgba(90,180,224,0.22)',   border: 'rgba(90,180,224,0.5)' },
		anemo:   { main: '#4ecbb4', cd: 'rgba(78,203,180,0.13)',   active: 'rgba(78,203,180,0.22)',   border: 'rgba(78,203,180,0.5)' },
		electro: { main: '#c070f0', cd: 'rgba(192,112,240,0.13)',  active: 'rgba(192,112,240,0.22)',  border: 'rgba(192,112,240,0.5)' },
		cryo:    { main: '#88c8f0', cd: 'rgba(136,200,240,0.13)',  active: 'rgba(136,200,240,0.22)',  border: 'rgba(136,200,240,0.5)' },
		geo:     { main: '#d4a040', cd: 'rgba(212,160,64,0.13)',   active: 'rgba(212,160,64,0.22)',   border: 'rgba(212,160,64,0.5)' },
		dendro:  { main: '#80c840', cd: 'rgba(128,200,64,0.13)',   active: 'rgba(128,200,64,0.22)',   border: 'rgba(128,200,64,0.5)' }
	};

	function pal(element: string): ElementPalette {
		return PALETTE[element] ?? PALETTE.pyro;
	}

	// ---------------------------------------------------------------------------
	// Derived values
	// ---------------------------------------------------------------------------

	let rotation = $derived(parseNotation(notation, getCharacterByDisplayName, swapFrames));
	let tracks = $derived(rotation.tracks);
	let totalDuration = $derived(Math.max(rotation.totalDuration + 2, 20)); // pad 2s at end
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

	// Swap connector geometry for a given track index
	function connectorStyle(i: number, track: CharacterTrack, nextTrack: CharacterTrack) {
		const x = Math.round(track.activeEnd * scale);
		const w = Math.round((nextTrack.activeStart - track.activeEnd) * scale);
		const y = RULER_H + TEAM_BUFFS_H + i * CHAR_BLOCK_H + CONNECTOR_TOP_IN_BLOCK;
		return `left:${x}px;top:${y}px;width:${Math.max(w, 1)}px;height:${CONNECTOR_H}px`;
	}

	// Ability bar left + width, clamped to timeline width
	function barGeom(start: number, span: number): { left: number; width: number } {
		const left = Math.round(start * scale);
		const width = Math.max(Math.round(span * scale), 2);
		return { left, width };
	}

	// Short label for avatar (first 2 chars)
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
		<!-- Left label column (non-scrolling) -->
		<div class="rp-label-col" style:width="{LABEL_W}px">

			<!-- Ruler spacer -->
			<div class="rp-label-spacer" style:height="{RULER_H}px"></div>

			<!-- Team buffs label -->
			<div class="rp-label-cell" style:height="{TEAM_BUFFS_H}px">
				<span class="rp-label-text">TEAM<br />BUFFS</span>
			</div>

			<!-- Character labels -->
			{#each tracks as track}
				<div class="rp-label-cell char-label" style:height="{CHAR_BLOCK_H}px">
					<div
						class="rp-avatar"
						style:border-color={pal(track.element).main}
						style:color={pal(track.element).main}
					>
						{initials(track.displayName)}
					</div>
				</div>
			{/each}
		</div>

		<!-- Right scrollable track area -->
		<div class="rp-track-scroll">
			<div class="rp-tracks" style:width="{totalWidth}px" style:position="relative">

				<!-- Ruler -->
				<div class="rp-ruler" style:height="{RULER_H}px">
					{#each ticks as tick}
						<div
							class="rp-tick"
							class:major={tick.major}
							style:left="{tick.x}px"
						>
							{#if tick.major}
								<span class="rp-tick-label">{tick.t}s</span>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Team buffs row (placeholder) -->
				<div class="rp-team-buffs" style:height="{TEAM_BUFFS_H}px">
					<!-- Grid lines -->
					{#each ticks.filter((t) => t.major) as tick}
						<div class="rp-gridline" style:left="{tick.x}px"></div>
					{/each}
					<span class="rp-team-buffs-empty">team buffs — auto-detection coming soon</span>
				</div>

				<!-- Character tracks -->
				{#each tracks as track}
					{@const p = pal(track.element)}
					{@const activeLeft = Math.round(track.activeStart * scale)}
					{@const activeW = Math.max(Math.round((track.activeEnd - track.activeStart) * scale), 4)}

					<div class="rp-char-block" style:height="{CHAR_BLOCK_H}px">

						<!-- Grid lines -->
						{#each ticks.filter((t) => t.major) as tick}
							<div class="rp-gridline" style:left="{tick.x}px"></div>
						{/each}

						<!-- E row -->
						<div
							class="rp-row"
							style:top="{CHAR_PAD_TOP}px"
							style:height="{E_ROW_H}px"
						>
							<span class="rp-row-label">E</span>
							{#each track.eBars as bar}
								{#if bar.uptime > 0}
									<!-- uptime chip -->
									{@const u = barGeom(bar.start, bar.uptime)}
									<div
										class="rp-bar-uptime"
										style:left="{u.left}px"
										style:width="{u.width}px"
										style:background={p.main}
									></div>
									<!-- cooldown chip -->
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
									<!-- instant: full cooldown bar with colored left edge -->
									{@const cd = barGeom(bar.start, bar.cooldown)}
									<div
										class="rp-bar-cd rp-bar-instant"
										style:left="{cd.left}px"
										style:width="{cd.width}px"
										style:background={p.cd}
										style:border-left-color={p.main}
										style:border-color="rgba(255,255,255,0.06)"
									>
										{#if cd.width > 32}
											<span class="rp-bar-cd-label">{bar.cooldown}s cd</span>
										{/if}
									</div>
								{/if}
							{/each}
						</div>

						<!-- Q row -->
						<div
							class="rp-row"
							style:top="{CHAR_PAD_TOP + E_ROW_H + ROW_GAP}px"
							style:height="{Q_ROW_H}px"
						>
							<span class="rp-row-label">Q</span>
							{#each track.qBars as bar}
								{#if bar.uptime > 0}
									{@const u = barGeom(bar.start, bar.uptime)}
									<div
										class="rp-bar-uptime"
										style:left="{u.left}px"
										style:width="{u.width}px"
										style:background={p.main}
									></div>
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
										style:border-left-color={p.main}
										style:border-color="rgba(255,255,255,0.06)"
									>
										{#if cd.width > 32}
											<span class="rp-bar-cd-label">{bar.cooldown}s cd</span>
										{/if}
									</div>
								{/if}
							{/each}
						</div>

						<!-- Active row -->
						<div
							class="rp-row"
							style:top="{ACTIVE_ROW_OFFSET}px"
							style:height="{ACTIVE_ROW_H}px"
						>
							<span class="rp-row-label active-label">▶</span>
							<div
								class="rp-active-bar"
								style:left="{activeLeft}px"
								style:width="{activeW}px"
								style:background={p.active}
								style:border-color={p.border}
							>
								{#if track.activeLabel}
									<span class="rp-active-text" style:color={p.main}>
										{track.activeLabel}
									</span>
								{/if}
							</div>
						</div>

						<!-- Char-specific buff row (placeholder) -->
						<div
							class="rp-row"
							style:top="{ACTIVE_ROW_OFFSET + ACTIVE_ROW_H + ROW_GAP}px"
							style:height="{CHAR_BUFF_ROW_H}px"
						>
							<span class="rp-row-label" style:font-size="7px">↑</span>
						</div>

					</div>
				{/each}

				<!-- Swap connectors (absolutely positioned over the full track column) -->
				{#each tracks as track, i}
					{#if i < tracks.length - 1}
						{@const next = tracks[i + 1]}
						{@const p = pal(next.element)}
						<div
							class="rp-connector"
							style={connectorStyle(i, track, next)}
							style:border-color={p.border}
							style:background="rgba(255,255,255,0.04)"
						></div>
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
			placeholder="Bennett Q > Kazuha Q hEP > Xiangling Q E > Fischl E ~2s(N1 N2)"
		></textarea>
	</div>

</div>


<style>
	/* ── Root ─────────────────────────────────────────────────── */
	.rp-root {
		--bg: #111318;
		--card: #181c24;
		--border: rgba(255, 255, 255, 0.06);
		--text: #d4d8e0;
		--muted: rgba(200, 205, 215, 0.35);

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
		/* Sticky so it stays visible when scrolling right */
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

	/* ── Avatar ───────────────────────────────────────────────── */
	.rp-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 1.5px solid;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Space Grotesk', sans-serif;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.03em;
		background: rgba(0, 0, 0, 0.4);
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
		background: rgba(255, 255, 255, 0.06);
		height: 4px;
	}
	.rp-tick.major {
		height: 8px;
		background: rgba(255, 255, 255, 0.14);
	}
	.rp-tick-label {
		position: absolute;
		bottom: 10px;
		left: 2px;
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
		background: rgba(255, 255, 255, 0.025);
		pointer-events: none;
		z-index: 0;
	}

	/* ── Team buffs row ───────────────────────────────────────── */
	.rp-team-buffs {
		position: relative;
		border-bottom: 2px solid rgba(255, 255, 255, 0.09);
		display: flex;
		align-items: center;
	}
	.rp-team-buffs-empty {
		padding-left: 8px;
		font-size: 8px;
		color: rgba(200, 205, 215, 0.15);
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
	.rp-row-label {
		position: absolute;
		left: 4px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 8px;
		font-weight: 600;
		color: rgba(200, 205, 215, 0.22);
		z-index: 2;
		pointer-events: none;
		letter-spacing: 0;
	}
	.active-label {
		font-size: 9px;
		color: rgba(200, 205, 215, 0.18);
	}

	/* ── Ability bars ─────────────────────────────────────────── */
	.rp-bar-uptime {
		position: absolute;
		top: 1px;
		height: calc(100% - 2px);
		border-radius: 3px 0 0 3px;
		z-index: 2;
		min-width: 2px;
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
		padding-left: 5px;
		min-width: 2px;
	}
	.rp-bar-instant {
		border-radius: 3px;
		border-left: 2px solid !important;
	}
	.rp-bar-cd-label {
		font-size: 7.5px;
		color: rgba(200, 205, 215, 0.25);
		white-space: nowrap;
		pointer-events: none;
	}

	/* ── Active bar ───────────────────────────────────────────── */
	.rp-active-bar {
		position: absolute;
		top: 1px;
		height: calc(100% - 2px);
		border-radius: 3px;
		border: 1px solid;
		display: flex;
		align-items: center;
		padding: 0 6px;
		z-index: 2;
		min-width: 4px;
	}
	.rp-active-text {
		font-size: 8.5px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		pointer-events: none;
	}

	/* ── Swap connector ───────────────────────────────────────── */
	.rp-connector {
		position: absolute;
		border: 1px solid;
		border-top: none;
		border-bottom: none;
		z-index: 3;
		pointer-events: none;
	}

	/* ── Notation box ─────────────────────────────────────────── */
	.rp-notation-wrap {
		display: flex;
		flex-direction: column;
	}
	.rp-notation {
		background: #0d1117;
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
		border-color: rgba(200, 205, 215, 0.2);
	}
</style>
