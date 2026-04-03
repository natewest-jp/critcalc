<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { EditorView } from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import { parseNotation } from '$lib/utils/notationParser';
	import { buildNotationExtensions } from '$lib/utils/notationEditorExtension';
	import { getCharacterById, getCharacterByDisplayName } from '$lib/data/characterLookup';
	import { getAvatar, getAvatarFallback } from '$lib/utils/getAvatar';
	import { constellations, siteSettings } from '$lib/stores';
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
	let swapFrames = $state($siteSettings.swapFrames);

	$effect(() => {
		siteSettings.setSwapFrames(swapFrames);
	});

	// ---------------------------------------------------------------------------
	// Layout constants (px)
	// ---------------------------------------------------------------------------

	const LABEL_W = 84;
	const RULER_H = 24;
	const TEAM_BUFFS_H = 36;
	const CHAR_PAD_TOP = 8;
	const E_ROW_H = 16;
	const Q_ROW_H = 16;
	const ACTIVE_ROW_H = 36;
	const CHAR_BUFF_ROW_H = 8;
	const CHAR_PAD_BOTTOM = 14;
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
		CHAR_PAD_BOTTOM; // = 110

	const ACTIVE_ROW_OFFSET =
		CHAR_PAD_TOP + E_ROW_H + ROW_GAP + Q_ROW_H + ROW_GAP; // = 48

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
	// Svelte action: mounts a CodeMirror EditorView into the host element.
	// Two-way sync: editor → notation via updateListener; notation → editor via
	// the update() hook (only dispatches when the value actually differs, so
	// the editor's own changes don't cause a redundant round-trip).
	// ---------------------------------------------------------------------------

	function mountEditor(node: HTMLElement, value: string) {
		const view = new EditorView({
			state: EditorState.create({
				doc: value,
				extensions: buildNotationExtensions((v) => { notation = v; })
			}),
			parent: node
		});

		return {
			update(newValue: string) {
				const current = view.state.doc.toString();
				if (newValue !== current) {
					view.dispatch({ changes: { from: 0, to: current.length, insert: newValue } });
				}
			},
			destroy() { view.destroy(); }
		};
	}

	// ---------------------------------------------------------------------------
	// ---------------------------------------------------------------------------
	// Avatar fallback state (per slot)
	// ---------------------------------------------------------------------------

	let avatarFallbacks = $state([false, false, false, false]);

	$effect(() => {
		characterSlots.join(','); // track any slot change
		avatarFallbacks = [false, false, false, false];
	});

	function handleAvatarError(slotIdx: number, slotId: string, event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src.includes('-newfit')) {
			img.src = getAvatarFallback(slotId, 'side');
		} else {
			avatarFallbacks[slotIdx] = true;
		}
	}

	function initials(name: string): string {
		return name.slice(0, 2).toUpperCase();
	}


	// ---------------------------------------------------------------------------
	// Constellation popover
	// ---------------------------------------------------------------------------

	let popoverSlot = $state<number | null>(null);
	let popoverX = $state(0);
	let popoverY = $state(0);

	function openConstellation(e: MouseEvent, i: number) {
		if (popoverSlot === i) { popoverSlot = null; return; }
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		popoverX = rect.right + 8;
		popoverY = rect.top + rect.height / 2;
		popoverSlot = i;
	}

	function setConstellation(characterId: string, level: number) {
		constellations.setLevel(characterId, level);
		popoverSlot = null;
	}
</script>

<!-- ============================================================ -->
<!--  Root                                                        -->
<!-- ============================================================ -->
<div class="rp-root">

	<!-- ── Notation editor (CodeMirror) ─────────────────────── -->
	<div class="rp-notation-wrap">
		<div class="rp-notation" use:mountEditor={notation}></div>
	</div>
	<!-- ── Controls + unrecognised tokens ───────────────────── -->
	<div class="rp-controls">
		<!-- Left: unrecognised token warnings (hidden when none) -->
		<div class="rp-controls-warnings">
			{#if rotation.unknownTokens.length > 0}
				{@const dedupedUnknowns = [...new Set(rotation.unknownTokens)]}
				<span class="rp-unknown-label">Unrecognised:</span>
				{#each dedupedUnknowns as tok (tok)}
					<span class="rp-unknown-chip">{tok}</span>
				{/each}
			{/if}
		</div>

		<!-- Right: sliders -->
		<div class="rp-controls-sliders">
			<button class="rp-zoom-btn" type="button" aria-label="Zoom out"
				onclick={() => scale = Math.max(20, scale - 5)}>🔍−</button>
			<input
				type="range"
				min={20}
				max={120}
				step={5}
				bind:value={scale}
				class="rp-zoom-slider"
				aria-label="Zoom"
			/>
			<button class="rp-zoom-btn" type="button" aria-label="Zoom in"
				onclick={() => scale = Math.min(120, scale + 5)}>🔍+</button>
			<span class="rp-controls-value">{scale}px/s</span>
			<span class="rp-controls-divider">|</span>
			<span class="rp-controls-label">Ping</span>
			<input
				type="range"
				min={4}
				max={20}
				step={1}
				bind:value={swapFrames}
				class="rp-zoom-slider"
				aria-label="Swap ping"
			/>
			<span class="rp-controls-value">{swapFrames}f</span>
		</div>
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
				{@const cLevel = char ? ($constellations[char.id] ?? 0) : 0}
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
								src={getAvatar(slotId, $siteSettings.useNewOutfits, 'side')}
								alt={char?.displayName ?? slotId}
								onerror={(e) => handleAvatarError(i, slotId, e)}
							/>
						{:else}
							<span class="rp-avatar-initials">
								{initials(char?.displayName ?? slotId)}
							</span>
						{/if}
					</div>
					{#if char}
						<span class="rp-char-name">{char.displayName}</span>
						<button
							class="rp-constellation-badge"
							style:color={cLevel > 0 ? p.main : undefined}
							onclick={(e) => openConstellation(e, i)}
							aria-label="Set constellation for {char.displayName}"
						>C{cLevel}</button>
					{/if}
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
								<div
									class="rp-active-bar"
									class:rp-active-bar--unset={track.hasUnsetDuration}
									style:left="{activeLeft}px"
									style:width="{activeW}px"
									style:border-radius={barRadius(conn)}
								>
									{#each track.labelSegments as seg, si (si)}
										{@const segLeft = Math.round((seg.start - track.activeStart) * scale) + 6}
										<div class="rp-active-label" style:left="{segLeft}px">
											{#each seg.parts as part, pi (pi)}
												<span class="rp-active-text" class:rp-active-text--optional={part.optional}>{part.text}</span>
											{/each}
										</div>
									{/each}
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

	<!-- ── Constellation popover ─────────────────────────────── -->
	{#if popoverSlot !== null}
		{@const pchar = slotCharacters[popoverSlot]}
		{@const pp = pal(pchar?.element)}
		{@const currentLevel = pchar ? ($constellations[pchar.id] ?? 0) : 0}
		<div
			class="rp-popover-backdrop"
			role="button"
			tabindex="-1"
			aria-label="Close constellation picker"
			onclick={() => (popoverSlot = null)}
			onkeydown={(e) => e.key === 'Escape' && (popoverSlot = null)}
		></div>
		<div
			class="rp-constellation-popover"
			style:left="{popoverX}px"
			style:top="{popoverY}px"
		>
			{#each [0, 1, 2, 3, 4, 5, 6] as level (level)}
				<button
					class="rp-pip"
					class:rp-pip--filled={level > 0 && level <= currentLevel}
					class:rp-pip--current={level === currentLevel}
					style:--pip-color={pp.main}
					onclick={() => pchar && setConstellation(pchar.id, level)}
				>{level}</button>
			{/each}
		</div>
	{/if}

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
		justify-content: space-between;
		gap: 8px;
		color: var(--muted);
		min-height: 24px;
	}
	.rp-controls-warnings {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
		font-size: 0.7rem;
		min-width: 0;
	}
	.rp-controls-sliders {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
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
	.rp-zoom-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 11px;
		line-height: 1;
		padding: 0 2px;
		color: var(--muted);
		opacity: 0.6;
		user-select: none;
	}
	.rp-zoom-btn:hover {
		opacity: 1;
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
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 6px 0;
		gap: 4px;
	}
	.rp-char-name {
		font-family: 'Space Grotesk', 'IBM Plex Mono', sans-serif;
		font-size: 7.5px;
		font-weight: 500;
		color: var(--muted);
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: calc(100% - 8px);
		letter-spacing: 0.04em;
	}
	.rp-constellation-badge {
		background: none;
		border: none;
		padding: 1px 5px;
		cursor: pointer;
		font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace;
		font-size: 7.5px;
		font-weight: 700;
		color: var(--muted);
		letter-spacing: 0.05em;
		border-radius: 3px;
		transition: background 0.12s;
	}
	.rp-constellation-badge:hover {
		background: rgba(255, 255, 255, 0.06);
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
		transform: scale(1.333) translateY(-14%);
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
		position: relative;
	}
	/* .rp-notation is the CodeMirror host div — structural only; all visual
	   styling (background, border, font, colors) is injected by notationTheme
	   inside buildNotationExtensions so it bypasses Svelte's CSS scoping. */
	.rp-notation {
		width: 100%;
		box-sizing: border-box;
	}

	/* ── Unknown token warning ───────────────────────────────── */
	.rp-unknown-label {
		color: #c0882a;
		font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace;
	}
	.rp-unknown-chip {
		background: rgba(192, 136, 42, 0.12);
		border: 1px solid rgba(192, 136, 42, 0.3);
		border-radius: 3px;
		padding: 1px 5px;
		font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace;
		color: #c0882a;
	}

	/* ── Constellation popover ────────────────────────────────── */
	.rp-popover-backdrop {
		position: fixed;
		inset: 0;
		z-index: 49;
	}
	.rp-constellation-popover {
		position: fixed;
		transform: translateY(-50%);
		z-index: 50;
		background: #17213a;
		border: 1px solid #253252;
		border-radius: 8px;
		padding: 6px 8px;
		display: flex;
		align-items: center;
		gap: 4px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
	}
	.rp-pip {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 1.5px solid #2a3a5c;
		background: none;
		color: #4a6090;
		font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace;
		font-size: 8px;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		transition: background 0.1s, border-color 0.1s, color 0.1s;
	}
	.rp-pip--filled {
		background: color-mix(in srgb, var(--pip-color) 20%, transparent);
		border-color: color-mix(in srgb, var(--pip-color) 60%, transparent);
		color: var(--pip-color);
	}
	.rp-pip--current {
		background: color-mix(in srgb, var(--pip-color) 30%, transparent);
		border-color: var(--pip-color);
		box-shadow: 0 0 0 1.5px var(--pip-color);
	}
	.rp-pip:hover {
		border-color: var(--pip-color, #6cb5ff);
		color: var(--pip-color, #6cb5ff);
	}
</style>
