<script lang="ts">
	import type { Snippet } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { getLoadedCharacter, loadCharacter } from '$lib/data/characterData';
	import { constellations, siteSettings, ownership } from '$lib/stores';
	import { getAvatar, getAvatarFallback, hasAvatar } from '$lib/utils/getAvatar';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { deriveCharacterCapabilities } from '$lib/capabilities/deriveCapabilities';
	import { rulerTicks } from '$lib/timeline/barGeometry';
	import { barPhases, type BarPhaseSegment } from '$lib/timeline/barPhases';
	import type { Ability } from '$lib/types/ability';
	import { conCapFor, type ConMode } from './facets';
	import { buildCompareModel, glyphScaleSeconds, type CapCell } from './compare';
	import { TARGET_SHORT, caveatText } from './capabilityText';
	import CompareBar from './CompareBar.svelte';

	let {
		ids,
		conMode,
		onRemove,
		anchorId = undefined,
		onCommit = undefined,
		onClear = undefined,
		onCancelAudition = undefined,
		candidatesArea = undefined
	}: {
		ids: string[];
		conMode: ConMode;
		/** Remove one character from the comparison (the tab stack stays in sync). */
		onRemove: (id: string) => void;
		/** Audition mode: the incumbent, pinned as the anchor row — shown with a
		 *  "current" badge, can't be removed. */
		anchorId?: string;
		/** Audition mode: commit a candidate into the audition slot (swaps + returns). */
		onCommit?: (id: string) => void;
		/** Plain compare: clear the whole selection (drops to the empty state). */
		onClear?: () => void;
		/** Audition mode: abandon without committing. */
		onCancelAudition?: () => void;
		/** Audition mode: the candidates strip, rendered below the legend — the
		 *  host owns the tiles/handlers (same pattern as the card actions). */
		candidatesArea?: Snippet;
	} = $props();

	// The bar track stretches with the view (this is a center view now, not an
	// inspector) — measured, then clamped so a narrow viewport still gets a
	// readable ruler and an ultrawide doesn't stretch seconds absurdly thin.
	// All lanes share it, so one px/sec scale governs the whole view and
	// stacked bars compare truthfully.
	let timelineW = $state(0);
	const NAME_W = 96;
	const trackW = $derived(
		timelineW > 0 ? Math.max(280, Math.min(720, timelineW - NAME_W - 84)) : 300
	);

	const columns = $derived(
		ids.map((id) => {
			const entry = getCharacterIndexEntry(id);
			return {
				id,
				entry,
				color: (elementColors[(entry?.element ?? 'none') as ElementKey] ?? elementColors.none).main
			};
		})
	);

	// Full payloads — lazy chunks, reactive as each lands.
	$effect(() => {
		for (const id of ids) void loadCharacter(id);
	});
	const loaded = $derived(ids.map((id) => getLoadedCharacter(id)));
	const allLoaded = $derived(loaded.every((d) => d !== null));

	// Same derivation brain as the DetailCard — the two surfaces can't disagree.
	const model = $derived.by(() => {
		if (!allLoaded) return null;
		return buildCompareModel(
			loaded.map((data, i) => ({
				id: ids[i],
				curated: columns[i].entry?.curated ?? false,
				abilities: data!.abilities ?? [],
				capabilities: deriveCharacterCapabilities(data!).capabilities
			}))
		);
	});

	// Convention: show everything; lock (dim) what the mode's constellation cap
	// hasn't unlocked — per column, since "My roster" caps differ per character.
	const viewCons = $derived(ids.map((id) => conCapFor(conMode, $constellations[id] ?? 0)));

	function abilityCooldown(abilities: readonly Ability[], type: 'skill' | 'burst'): number | null {
		for (const a of abilities) {
			if (a.abilityType === type && 'cooldown' in a && typeof a.cooldown === 'number' && a.cooldown)
				return a.cooldown;
		}
		return null;
	}

	const skillCd = $derived(
		loaded.map((d) => (d ? abilityCooldown(d.abilities ?? [], 'skill') : null))
	);
	const burstCd = $derived(
		loaded.map((d) => (d ? abilityCooldown(d.abilities ?? [], 'burst') : null))
	);

	// One shared time scale for every bar — the widest cycle across capability
	// glyphs AND the E/Q cooldown bars, floored so short kits still get a ruler.
	const scaleSeconds = $derived.by(() => {
		let max = model ? glyphScaleSeconds(model) : 0;
		for (const cd of skillCd) if (cd) max = Math.max(max, cd);
		for (const cd of burstCd) if (cd) max = Math.max(max, cd);
		return max > 0 ? Math.max(max, 6) : 0;
	});
	const pxPerSec = $derived(scaleSeconds > 0 ? trackW / scaleSeconds : 0);
	const ruler = $derived(rulerTicks(scaleSeconds, pxPerSec));

	// The Timing panel shows only real bars; rows whose cells all lack timing
	// live in the Facts table alone (no "no timing" placeholder lanes).
	const glyphRows = $derived(
		model ? model.capRows.filter((row) => row.cells.some((cell) => cell?.glyph)) : []
	);

	/** Three-phase segments for a capability glyph: solid window, dim overflow
	 *  past the cooldown, or a ghost cooldown remainder. */
	function glyphSegments(cell: CapCell): BarPhaseSegment[] {
		if (!cell.glyph) return [];
		return barPhases(
			{ start: 0, castTime: 0, cooldown: cell.glyph.cooldown, uptime: cell.glyph.uptime },
			false
		);
	}
	/** A bare cooldown bar (E/Q recharge): one ghost track the length of the CD. */
	function cooldownSegments(cd: number): BarPhaseSegment[] {
		return [{ role: 'ghost', start: 0, span: cd, cooldown: cd }];
	}

	function cellTitle(cell: CapCell): string {
		const parts = [`from ${cell.sources.join(', ')}`];
		if (cell.caveats.length > 0) parts.push(cell.caveats.map(caveatText).join(' · '));
		return parts.join(' — ');
	}

	const modeLine = $derived.by(() => {
		const con = conMode === 'mine' ? 'at your constellations' : `at ${conMode.toUpperCase()}`;
		return anchorId ? `pick one to replace the current member · ${con}` : con;
	});

	const erroredAvatars = new SvelteSet<string>();
	function fallbackFor(id: string): boolean {
		return erroredAvatars.has(id) || !hasAvatar(id);
	}
	function handleAvatarError(id: string, event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src.includes('-newfit')) {
			img.src = getAvatarFallback(id, 'side', $siteSettings.travelerVariant);
		} else {
			erroredAvatars.add(id);
		}
	}
</script>

<section class="cmp" aria-label={anchorId ? 'Audition replacements' : 'Compare characters'}>
	<header class="cmp-titlebar">
		<h2>{anchorId ? 'Audition' : 'Compare'}</h2>
		<p class="cmp-mode">{modeLine}</p>
		{#if onCancelAudition}
			<button class="btn cmp-headact" onclick={onCancelAudition}>✕ Cancel audition</button>
		{:else if onClear}
			<button class="btn cmp-headact" onclick={onClear}>✕ Clear</button>
		{/if}
	</header>

	<!-- Character legend — the color key the stacked lanes refer back to. -->
	<div class="cmp-legend">
		{#each columns as col (col.id)}
			<div
				class="cmp-chip"
				class:cmp-chip--anchor={col.id === anchorId}
				style:--el-color={col.color}
			>
				<span class="cmp-chip-avatar">
					{#if !fallbackFor(col.id)}
						<img
							src={getAvatar(
								col.id,
								$siteSettings.useNewOutfits,
								'side',
								$siteSettings.travelerVariant
							)}
							alt=""
							onerror={(e) => handleAvatarError(col.id, e)}
						/>
					{:else}
						<span class="cmp-chip-initials"
							>{(col.entry?.displayName ?? col.id).slice(0, 2).toUpperCase()}</span
						>
					{/if}
				</span>
				<span class="cmp-chip-body">
					<span class="cmp-chip-name"
						>{col.entry?.displayName ?? col.id}{#if $ownership[col.id] === 'wishlist'}<span
								class="cmp-chip-wish"
								title="Wishlisted">★</span
							>{/if}</span
					>
					<span class="cmp-chip-meta">
						{col.entry?.element ?? '?'} · {col.entry?.weapon ?? '?'}
						{#if conMode === 'mine'}· C{$constellations[col.id] ?? 0}{/if}
						{#if col.entry && !col.entry.curated}· <span class="cmp-chip-stub">not curated</span
							>{/if}
					</span>
				</span>
				{#if col.id === anchorId}
					<span class="cmp-chip-current" title="Current team member — auditioning replacements"
						>current</span
					>
				{:else}
					{#if onCommit}
						<button
							class="cmp-chip-commit"
							onclick={() => onCommit(col.id)}
							title="Replace the current member with {col.entry?.displayName ?? col.id}"
							>Use →</button
						>
					{/if}
					<button
						class="cmp-chip-remove"
						onclick={() => onRemove(col.id)}
						aria-label="Remove {col.entry?.displayName ?? col.id} from comparison"
						title="Remove from comparison">✕</button
					>
				{/if}
			</div>
		{/each}
	</div>

	{#if candidatesArea}
		{@render candidatesArea()}
	{/if}

	{#if !model}
		<p class="cmp-loading">Loading kit data…</p>
	{:else}
		<!-- ── Timing on one ruler — the bar instrument, full width ── -->
		<div class="cmp-section">
			<p class="kicker">Timing on one ruler</p>
			<div class="cmp-timeline" bind:clientWidth={timelineW} style:--track-w="{trackW}px">
				{#if scaleSeconds > 0}
					<div class="cmp-ruler-row">
						<div class="cmp-lane-name"></div>
						<div class="cmp-ruler">
							{#each ruler as tick (tick.t)}
								<span class="cmp-rtick" class:cmp-rtick--major={tick.major} style:left="{tick.x}px">
									{#if tick.major}<span class="cmp-rtick-label">{tick.t}s</span>{/if}
								</span>
							{/each}
						</div>
						<div class="cmp-lane-fact"></div>
					</div>
				{/if}

				{#if skillCd.some((c) => c !== null)}
					<div class="cmp-dim-label">E cooldown</div>
					{#each columns as col, i (col.id)}
						{#if skillCd[i] !== null}
							<div class="cmp-lane" style:--el-color={col.color}>
								<span class="cmp-lane-name">{col.entry?.displayName ?? col.id}</span>
								<CompareBar
									segments={cooldownSegments(skillCd[i]!)}
									color={col.color}
									{scaleSeconds}
									trackWidthPx={trackW}
								/>
								<span class="cmp-lane-fact">{skillCd[i]}s</span>
							</div>
						{/if}
					{/each}
				{/if}

				{#if burstCd.some((c) => c !== null)}
					<div class="cmp-dim-label">Q cooldown</div>
					{#each columns as col, i (col.id)}
						{#if burstCd[i] !== null}
							<div class="cmp-lane" style:--el-color={col.color}>
								<span class="cmp-lane-name">{col.entry?.displayName ?? col.id}</span>
								<CompareBar
									segments={cooldownSegments(burstCd[i]!)}
									color={col.color}
									{scaleSeconds}
									trackWidthPx={trackW}
								/>
								<span class="cmp-lane-fact">{burstCd[i]}s</span>
							</div>
						{/if}
					{/each}
				{/if}

				{#each glyphRows as row (row.key)}
					<div class="cmp-dim-label">{row.label}</div>
					{#each row.cells as cell, i (ids[i])}
						{@const col = columns[i]}
						{#if cell?.glyph}
							{@const locked = cell.minCon > viewCons[i]}
							<div class="cmp-lane" class:cmp-lane--locked={locked} style:--el-color={col.color}>
								<span class="cmp-lane-name">{col.entry?.displayName ?? col.id}</span>
								<CompareBar
									segments={glyphSegments(cell)}
									color={col.color}
									{scaleSeconds}
									trackWidthPx={trackW}
									{locked}
								/>
								<span class="cmp-lane-fact" title={cellTitle(cell)}
									>{cell.glyph.uptime}s / {cell.glyph.cooldown}s{locked ? ' 🔒' : ''}</span
								>
							</div>
						{/if}
					{/each}
				{/each}

				{#if glyphRows.length === 0 && skillCd.every((c) => c === null) && burstCd.every((c) => c === null)}
					<p class="cmp-empty">No curated timing to draw for this selection.</p>
				{/if}
			</div>
			<p class="note cmp-footnote">
				Bars share one time scale — solid = effect window, dim = window past its cooldown, faint =
				cooldown remaining. Hover a lane's numbers for the source ability.
			</p>
		</div>

		<!-- ── Side by side — the dense fact reference, aligned by row ── -->
		<div class="cmp-section">
			<p class="kicker">Side by side</p>
			<div class="cmp-tablewrap">
				<table class="cmp-table">
					<thead>
						<tr>
							<th class="cmp-th-label" aria-label="Attribute"></th>
							{#each columns as col (col.id)}
								<th style:color={col.color}>{col.entry?.displayName ?? col.id}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each model.timingRows as row (row.key)}
							<tr>
								<td class="cmp-td-label">{row.label}</td>
								{#each row.cells as cell, i (ids[i])}
									<td>
										{#if cell !== null}
											<span class="cmp-val">{cell}</span>
										{:else}
											<span class="cmp-none">—</span>
										{/if}
									</td>
								{/each}
							</tr>
						{/each}

						{#if model.capRows.length === 0}
							<tr>
								<td class="cmp-td-label"></td>
								<td colspan={ids.length} class="cmp-empty"
									>Nothing team-facing derives from these kits.</td
								>
							</tr>
						{/if}

						{#each model.capRows as row (row.key)}
							<tr>
								<td class="cmp-td-label">{row.label}</td>
								{#each row.cells as cell, i (ids[i])}
									{@const col = columns[i]}
									{#if cell === null}
										<td>
											<span class="cmp-none"
												>{col.entry && !col.entry.curated ? 'unknown' : '—'}</span
											>
										</td>
									{:else}
										{@const locked = cell.minCon > viewCons[i]}
										<td>
											<span
												class="cmp-cell"
												class:cmp-cell--locked={locked}
												style:--el-color={col.color}
												title={cellTitle(cell)}
											>
												<span class="cmp-gate" class:cmp-gate--base={cell.minCon === 0}
													>C{cell.minCon}{locked ? ' 🔒' : ''}</span
												>
												{#if cell.target}<span class="cmp-target"
														>{TARGET_SHORT[cell.target] ?? cell.target}</span
													>{/if}
												{#if cell.conditional}<span
														class="cmp-cond"
														title={cell.caveats.map(caveatText).join(' · ')}>~</span
													>{/if}
												{#if cell.details.length > 0}<span class="cmp-details"
														>{cell.details.join(' · ')}</span
													>{/if}
												{#if cell.also}
													{@const alsoLocked = cell.also.minCon > viewCons[i]}
													<span class="cmp-also" class:cmp-cell--locked={alsoLocked}
														>{TARGET_SHORT[cell.also.target]} from C{cell.also.minCon}{alsoLocked
															? ' 🔒'
															: ''}</span
													>
												{/if}
											</span>
										</td>
									{/if}
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="note cmp-footnote">
				~ = conditional (hover for the condition) · hover a cell for its source ability · full
				provenance lives in each character's detail card.
			</p>
		</div>
	{/if}
</section>

<style>
	/* A center view in normal flow — the page scrolls, nothing docks or overlays.
	   Shell echoes the old panel chrome (surface, hairline, 9px radius). */
	.cmp {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1.2rem 1.3rem 1.1rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 9px;
		font-family: var(--font-body);
		color: var(--text);
		min-width: 0;
	}

	/* ── Title bar ────────────────────────────────────────────── */
	.cmp-titlebar {
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
	}
	.cmp-titlebar h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-3xl);
		font-weight: var(--fw-semibold);
	}
	.cmp-mode {
		flex: 1;
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.cmp-headact {
		align-self: center;
		white-space: nowrap;
	}

	.cmp-footnote {
		font-size: var(--fs-xs);
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	/* ── Legend ───────────────────────────────────────────────── */
	.cmp-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.cmp-chip {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.3rem 0.5rem 0.3rem 0.35rem;
		border: 1px solid color-mix(in srgb, var(--el-color) 45%, var(--border));
		border-left: 3px solid var(--el-color);
		border-radius: var(--r-sm);
		background: color-mix(in srgb, var(--el-color) 7%, transparent);
	}
	.cmp-chip-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: 1.5px solid var(--el-color);
		overflow: hidden;
		background: rgba(0, 0, 0, 0.5);
		flex-shrink: 0;
	}
	.cmp-chip-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.333) translateY(-14%);
	}
	.cmp-chip-initials {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		color: var(--el-color);
	}
	.cmp-chip-body {
		display: flex;
		flex-direction: column;
		line-height: var(--lh-tight);
	}
	.cmp-chip-name {
		font-family: var(--font-display);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
	}
	.cmp-chip-wish {
		margin-left: 0.25rem;
		color: var(--el-geo-hi, #eed8a5);
		font-size: var(--fs-sm);
	}
	.cmp-chip-meta {
		font-size: var(--fs-2xs);
		color: var(--muted);
		text-transform: capitalize;
	}
	.cmp-chip-stub {
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		color: color-mix(in srgb, var(--el-geo-main, #ddb04a) 90%, var(--muted));
	}
	.cmp-chip-remove {
		background: none;
		border: none;
		padding: 2px 3px;
		color: color-mix(in srgb, var(--muted) 60%, transparent);
		font-size: var(--fs-xs);
		cursor: pointer;
		transition: color 150ms ease;
	}
	.cmp-chip-remove:hover {
		color: var(--text);
	}

	/* ── Audition (anchor + commit) ───────────────────────────── */
	.cmp-chip--anchor {
		border-left-width: 4px;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--el-color) 30%, transparent);
	}
	.cmp-chip-current {
		padding: 1px 6px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--el-color) 20%, transparent);
		color: var(--text);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}
	.cmp-chip-commit {
		padding: 2px 8px;
		border: 1px solid color-mix(in srgb, var(--accent) 55%, var(--border));
		border-radius: 3px;
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		cursor: pointer;
		transition: background 150ms ease;
	}
	.cmp-chip-commit:hover {
		background: color-mix(in srgb, var(--accent) 32%, transparent);
	}

	/* ── Timing panel ─────────────────────────────────────────── */
	.cmp-section {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		min-width: 0;
	}

	.cmp-timeline {
		min-width: 0;
	}

	.cmp-ruler-row,
	.cmp-lane {
		display: grid;
		grid-template-columns: 96px var(--track-w) minmax(0, 1fr);
		align-items: center;
		gap: 0.6rem;
	}

	.cmp-ruler {
		position: relative;
		height: 16px;
	}
	.cmp-rtick {
		position: absolute;
		bottom: 0;
		width: 1px;
		height: 5px;
		background: color-mix(in srgb, var(--muted) 40%, transparent);
	}
	.cmp-rtick--major {
		height: 9px;
		background: color-mix(in srgb, var(--muted) 65%, transparent);
	}
	.cmp-rtick-label {
		position: absolute;
		bottom: 10px;
		left: 0;
		transform: translateX(-50%);
		font-size: var(--fs-2xs);
		color: var(--muted);
		white-space: nowrap;
	}

	.cmp-dim-label {
		margin: 0.55rem 0 0.2rem;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		color: var(--text);
	}

	.cmp-lane {
		padding: 0.14rem 0;
	}
	.cmp-lane--locked {
		opacity: 0.55;
	}
	.cmp-lane-name {
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		color: var(--el-color);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.cmp-lane-fact {
		font-size: var(--fs-xs);
		font-variant-numeric: tabular-nums;
		color: var(--muted);
		white-space: nowrap;
	}

	/* ── Facts table ──────────────────────────────────────────── */
	.cmp-tablewrap {
		overflow-x: auto;
		min-width: 0;
	}
	.cmp-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
	}
	.cmp-table th {
		padding: 0.3rem 0.6rem 0.3rem 0;
		text-align: left;
		font-family: var(--font-display);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}
	.cmp-table td {
		padding: 0.4rem 0.6rem 0.4rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		vertical-align: baseline;
	}
	.cmp-th-label {
		width: 110px;
	}
	.cmp-td-label {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		color: var(--text);
		white-space: nowrap;
	}

	.cmp-cell {
		display: inline-flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.35rem;
		font-size: var(--fs-xs);
		min-width: 0;
	}
	.cmp-cell--locked {
		opacity: 0.55;
	}
	.cmp-val {
		font-variant-numeric: tabular-nums;
	}
	.cmp-gate {
		padding: 1px 6px;
		border-radius: 3px;
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		background: color-mix(in srgb, var(--el-color) 18%, transparent);
	}
	.cmp-gate--base {
		background: rgba(255, 255, 255, 0.07);
		color: var(--muted);
	}
	.cmp-target {
		color: var(--muted);
	}
	.cmp-cond {
		font-style: italic;
		color: var(--muted);
		cursor: help;
	}
	.cmp-details {
		color: var(--muted);
	}
	.cmp-also {
		font-style: italic;
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}
	.cmp-none {
		color: color-mix(in srgb, var(--muted) 55%, transparent);
	}

	.cmp-empty,
	.cmp-loading {
		padding: 0.6rem 0;
		color: var(--muted);
	}
</style>
