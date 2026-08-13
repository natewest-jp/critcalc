<script lang="ts">
	/**
	 * Compare / Audition — the Team Builder's kit-against-kit surface.
	 *
	 * ONE SURFACE, TWO JOBS, AND THEY DIFFER IN EXACTLY ONE THING: whether there
	 * is a REFERENCE. Compare is symmetric — N peers, nobody privileged, "how do
	 * these differ?". Audition is asymmetric — an incumbent, challengers, and a
	 * slot to fill, "does this one fit HERE?". So `anchorId` is not a mode flag
	 * bolted on the side; it is the reference, and everything else follows from
	 * whether it is set.
	 *
	 * TWO GEOMETRIES, BECAUSE TWO QUESTIONS. Time STACKS (a chart of lanes on one
	 * shared axis); facts COLUMN (a table, one column per character). Trying to
	 * make one geometry serve both is what left this surface reading as two half
	 * things sharing a scroll.
	 *
	 * ⚓ THE CHART'S SPINE: a LANE is an ABILITY, the GROUPING is an EFFECT.
	 * Aligning E-with-E is a category error — Bennett heals on Q, Kokomi on E,
	 * Jean on both, so which button carries a thing is kit-design accident. But
	 * aligning purely by effect throws away the COST, and the cost is the real
	 * currency. So the lane is the cast (dragging its cooldown and its energy
	 * along) and the heading is the effect. See compare.ts.
	 *
	 * MATERIALS (⚓ 2026-08-13, the on-the-scene law): night looks · glass
	 * touches · paper answers. The chart draws on the bare night with no ground
	 * of its own; the axis + lens controls are a glass plate; the facts table is
	 * the ONE paper card — it is the thing you land on.
	 */
	import type { Snippet } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { getLoadedCharacter, loadCharacter } from '$lib/data/characterData';
	import { constellations, siteSettings, ownership } from '$lib/stores';
	import { getAvatar, getAvatarFallback, hasAvatar } from '$lib/utils/getAvatar';
	import { elementPalette } from '$lib/utils/elementColors';
	import Mark from '$lib/components/Mark.svelte';
	import { deriveCharacterCapabilities } from '$lib/capabilities/deriveCapabilities';
	import { rulerTicks } from '$lib/timeline/barGeometry';
	import { laneSegments } from '$lib/timeline/barCycles';
	import { conCapFor, type ConMode } from './facets';
	import {
		buildCompareModel,
		COMPARE_AXIS_CHOICES,
		COMPARE_AXIS_DEFAULT,
		type CapCell,
		type CapLane,
		type CapRowKey
	} from './compare';
	import { TARGET_SHORT, capDetailText, caveatText } from '$lib/capabilities/capabilityText';
	import type { CapabilityKind } from '$lib/capabilities/deriveCapabilities';
	import CompareBar from './CompareBar.svelte';

	let {
		ids,
		conMode,
		onRemove,
		anchorId = undefined,
		auditionSlot = undefined,
		onCommit = undefined,
		onClear = undefined,
		onCancelAudition = undefined,
		onBackToPlanner = undefined,
		seedLenses = undefined,
		onLensChange = undefined,
		candidatesArea = undefined
	}: {
		ids: string[];
		conMode: ConMode;
		/** Remove one character from the comparison (the tab stack stays in sync). */
		onRemove: (id: string) => void;
		/** Audition mode: the incumbent, pinned as the reference — can't be removed. */
		anchorId?: string;
		/** Audition mode: which slot is being filled (the commit button names it). */
		auditionSlot?: number;
		/** Audition mode: commit a candidate into the audition slot (swaps + returns). */
		onCommit?: (id: string) => void;
		/** Plain compare: clear the whole selection (drops to the empty state). */
		onClear?: () => void;
		/** Audition mode: abandon without committing. */
		onCancelAudition?: () => void;
		/** Set only when the audition arrived as an errand from the planner — the
		 *  errand's two exits sit together, cancel then return. */
		onBackToPlanner?: () => void;
		/** Audition mode: the jobs this slot currently does. Seeds the lens, so
		 *  the chart opens on what has to be replaced rather than on everything. */
		seedLenses?: readonly string[];
		/** The lens selection changed. Audition narrows its candidate list by the
		 *  same chips that group the chart — ONE control, two jobs. */
		onLensChange?: (keys: CapRowKey[]) => void;
		/** Audition mode: the candidates strip, rendered below the reference — the
		 *  host owns the tiles/handlers (same pattern as the card actions). */
		candidatesArea?: Snippet;
	} = $props();

	// ── Geometry ──────────────────────────────────────────────────────────────
	// The track stretches with the view. 🎛️ Tuning knobs: the gutter holds one
	// avatar disc (it replaced a 96px name column that reprinted the same four
	// names down thirty-odd lanes), and the ceiling is generous because a TILED
	// lane fills its track — the old 720 cap existed when a bar was one cast in
	// a mostly-empty row.
	const LANE_GUTTER = 26;
	const LANE_FACT_W = 172;
	const LANE_GAP = 10;
	const TRACK_MIN = 280;
	const TRACK_MAX = 1100;

	let timelineW = $state(0);
	const trackW = $derived(
		timelineW > 0
			? Math.max(
					TRACK_MIN,
					Math.min(TRACK_MAX, timelineW - LANE_GUTTER - LANE_FACT_W - LANE_GAP * 2)
				)
			: 320
	);

	/* ⚠ TWO COLOURS PER COLUMN SINCE 2026-08-12, and they are not
	   interchangeable. `color` is the element's IDENTITY (`main`) — the lane
	   accents, the header ink, the --el-color the CSS reads. `bar` is the FILL
	   rung, which is `main` pulled 30% toward the balance point between the night
	   and the white written on it; it goes to CompareBar and nowhere else.
	   One value was doing both jobs, which was only invisible because the two
	   rungs did not exist yet. */
	const columns = $derived(
		ids.map((id) => {
			const entry = getCharacterIndexEntry(id);
			const pal = elementPalette(entry?.element);
			return { id, entry, color: pal.main, bar: pal.bar };
		})
	);

	const anchorIndex = $derived(anchorId ? ids.indexOf(anchorId) : -1);
	const candidateColumns = $derived(columns.filter((c) => c.id !== anchorId));

	// Full payloads — lazy chunks, reactive as each lands.
	$effect(() => {
		for (const id of ids) void loadCharacter(id);
	});
	const loaded = $derived(ids.map((id) => getLoadedCharacter(id)));
	const allLoaded = $derived(loaded.every((d) => d !== null));

	// Convention: show everything; lock (weaken) what the mode's constellation cap
	// hasn't unlocked — per column, since "My roster" caps differ per character.
	const viewCons = $derived(ids.map((id) => conCapFor(conMode, $constellations[id] ?? 0)));

	// Same derivation brain as the DetailCard — the two surfaces can't disagree.
	const model = $derived.by(() => {
		if (!allLoaded) return null;
		return buildCompareModel(
			loaded.map((data, i) => ({
				id: ids[i],
				abilities: data!.abilities ?? [],
				capabilities: deriveCharacterCapabilities(data!).capabilities
			}))
		);
	});

	// ── Axis + lenses ─────────────────────────────────────────────────────────
	let axisSeconds = $state<number>(COMPARE_AXIS_DEFAULT);

	/** Rows that have at least one drawable lane — the chart's whole vocabulary. */
	const chartableRows = $derived(model ? model.capRows.filter((r) => r.lanes.length > 0) : []);

	/** Lens selection. Empty = everything, which is also the honest default for
	 *  plain compare: you start by seeing what there is, not by hiding most of
	 *  it. An audition starts seeded instead — it opens on the jobs the slot
	 *  already does, because that is the question it was opened to answer. */
	const lenses = new SvelteSet<CapRowKey>();

	// `seedLenses` gets a NEW array identity per audition, so comparing the
	// reference reseeds once per open and never fights the user's own toggles.
	let seededFrom: readonly string[] | undefined = undefined;
	$effect(() => {
		if (seedLenses === seededFrom) return;
		seededFrom = seedLenses;
		lenses.clear();
		for (const key of seedLenses ?? []) lenses.add(key as CapRowKey);
		onLensChange?.([...lenses]);
	});

	// Drop lens keys the current selection no longer offers, so a stale chip
	// can't silently filter the chart down to nothing after a character swap.
	// ⚠ Guarded on `model`: while the lazy payloads are still landing there are
	// no chartable rows at all, and an unguarded sweep would wipe the audition's
	// seed a frame after it was set.
	$effect(() => {
		if (!model) return;
		const available = new Set(chartableRows.map((r) => r.key));
		let changed = false;
		for (const key of [...lenses]) {
			if (!available.has(key)) {
				lenses.delete(key);
				changed = true;
			}
		}
		if (changed) onLensChange?.([...lenses]);
	});

	function toggleLens(key: CapRowKey) {
		if (lenses.has(key)) lenses.delete(key);
		else lenses.add(key);
		onLensChange?.([...lenses]);
	}

	const visibleRows = $derived(
		lenses.size === 0 ? chartableRows : chartableRows.filter((r) => lenses.has(r.key))
	);

	const pxPerSec = $derived(trackW / axisSeconds);
	const ruler = $derived(rulerTicks(axisSeconds, pxPerSec));

	function segmentsFor(lane: CapLane) {
		return laneSegments(lane.uptime, lane.host.cooldown, axisSeconds);
	}

	/** A lane's cost line: what the cast asks for, in the notation's own terms. */
	function hostCost(lane: CapLane): string {
		const parts = [lane.host.label];
		if (lane.host.energyCost) parts.push(`${lane.host.energyCost} en`);
		if (lane.host.charges) parts.push(`×${lane.host.charges}`);
		return parts.join(' · ');
	}

	function cellTitle(cell: CapCell): string {
		const parts = [`from ${cell.sources.join(', ')}`];
		if (cell.caveats.length > 0) parts.push(cell.caveats.map(caveatText).join(' · '));
		return parts.join(' — ');
	}

	function laneTitle(lane: CapLane, row: { label: string }): string {
		const parts = [`${row.label} from ${lane.host.label}`];
		if (lane.details.length > 0) parts.push(lane.details.join(' · '));
		if (lane.caveats.length > 0) parts.push(lane.caveats.map(caveatText).join(' · '));
		return parts.join(' — ');
	}

	// ── Crosshair ─────────────────────────────────────────────────────────────
	// The single interaction the stacked geometry earns: "at nine seconds in, who
	// is still healing?" is the real comparison question, and no table answers it.
	let crossX = $state<number | null>(null);
	const crossT = $derived(crossX === null ? null : crossX / pxPerSec);

	function trackPointer(event: PointerEvent) {
		const track = event.currentTarget as HTMLElement;
		const x = event.clientX - track.getBoundingClientRect().left;
		crossX = x >= 0 && x <= trackW ? x : null;
	}

	const modeLine = $derived.by(() => {
		const con = conMode === 'mine' ? 'at your constellations' : `at ${conMode.toUpperCase()}`;
		return anchorId ? `pick one to take the slot · ${con}` : con;
	});

	const slotName = $derived(auditionSlot !== undefined ? `slot ${auditionSlot + 1}` : 'the slot');

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

<!-- ⚠ ctx-dark on every portrait backing, claimed IN THE MARKUP: --surface-well
     is a ROLE, so it would otherwise follow whatever context the card is dropped
     into, and a portrait backing is one of the few things that must NOT. -->
{#snippet avatarDisc(id: string, name: string, color: string, size: number)}
	<span
		class="cmp-disc ctx-dark"
		style:--el-color={color}
		style:width="{size}px"
		style:height="{size}px"
	>
		{#if !fallbackFor(id)}
			<img
				src={getAvatar(id, $siteSettings.useNewOutfits, 'side', $siteSettings.travelerVariant)}
				alt=""
				onerror={(e) => handleAvatarError(id, e)}
			/>
		{:else}
			<span class="cmp-disc-initials">{name.slice(0, 2).toUpperCase()}</span>
		{/if}
	</span>
{/snippet}

<section class="cmp" aria-label={anchorId ? 'Audition replacements' : 'Compare characters'}>
	<header class="cmp-titlebar">
		<h2>{anchorId ? 'Audition' : 'Compare'}</h2>
		<p class="cmp-mode">{modeLine}</p>
		{#if onCancelAudition}
			<button class="btn cmp-headact" onclick={onCancelAudition}>
				<Mark name="close" /> Cancel audition
			</button>
			<!-- ⚠ The arrow points RIGHT and trails the label. The site's arrows are
			     SPATIAL — they say where the tool IS, not whether the trip is out or
			     back — and the planner sits to the RIGHT of the Team Builder in the
			     nav. A left arrow here would be the first one to disagree with it. -->
			<!-- ⚠ Its OWN class, not a second .cmp-headact: two same-class buttons
			     in one header is the documented Playwright strict-mode trap this
			     repo has already paid for once. -->
			{#if onBackToPlanner}
				<button
					class="btn cmp-headback"
					title="Return to the rotation planner"
					onclick={onBackToPlanner}>Back to planner <Mark name="forward" /></button
				>
			{/if}
		{:else if onClear}
			<button class="btn cmp-headact" onclick={onClear}>
				<Mark name="close" /> Clear
			</button>
		{/if}
	</header>

	<!-- ── The reference (audition only) ────────────────────────────────────
	     The incumbent leaves the chip flow entirely. It is not a peer with a
	     badge; it is what the others are being measured against, and the layout
	     has to say so before the chart does. -->
	{#if anchorIndex >= 0}
		{@const ref = columns[anchorIndex]}
		<div class="cmp-ref" style:--el-color={ref.color}>
			{@render avatarDisc(ref.id, ref.entry?.displayName ?? ref.id, ref.color, 38)}
			<span class="cmp-ref-body">
				<span class="cmp-ref-role">Currently in {slotName}</span>
				<span class="cmp-ref-name">{ref.entry?.displayName ?? ref.id}</span>
			</span>
			<span class="cmp-ref-meta">
				{ref.entry?.element ?? '?'} · {ref.entry?.weapon ?? '?'}
				{#if conMode === 'mine'}· C{$constellations[ref.id] ?? 0}{/if}
			</span>
		</div>
	{/if}

	<!-- ── Candidates / legend ──────────────────────────────────────────────── -->
	<div class="cmp-legend">
		{#each candidateColumns as col (col.id)}
			<div class="cmp-chip" style:--el-color={col.color}>
				{@render avatarDisc(col.id, col.entry?.displayName ?? col.id, col.color, 30)}
				<span class="cmp-chip-body">
					<span class="cmp-chip-name"
						>{col.entry?.displayName ?? col.id}{#if $ownership[col.id] === 'wishlist'}<span
								class="cmp-chip-wish"
								title="Wishlisted"><Mark name="star" size={11} /></span
							>{/if}</span
					>
					<span class="cmp-chip-meta">
						{col.entry?.element ?? '?'} · {col.entry?.weapon ?? '?'}
						{#if conMode === 'mine'}· C{$constellations[col.id] ?? 0}{/if}
						{#if col.entry && !col.entry.curated}· <span class="cmp-chip-stub">not curated</span
							>{/if}
					</span>
				</span>
				{#if onCommit}
					<!-- ⚓ The commit lives on the COMPARED column, never on a browse
					     pill: you commit what you have looked at, and putting it on
					     the candidates strip would leave an irreversible act one
					     click away from a browsing gesture. -->
					<button
						class="btn btn--primary cmp-take"
						onclick={() => onCommit(col.id)}
						title="Put {col.entry?.displayName ?? col.id} in {slotName}"
						>Take {slotName} <Mark name="forward" size={12} /></button
					>
				{/if}
				<button
					class="cmp-chip-remove"
					onclick={() => onRemove(col.id)}
					aria-label="Remove {col.entry?.displayName ?? col.id} from comparison"
					title="Remove from comparison"><Mark name="close" size={12} /></button
				>
			</div>
		{/each}
	</div>

	{#if candidatesArea}
		{@render candidatesArea()}
	{/if}

	{#if !model}
		<p class="cmp-loading">Loading kit data…</p>
	{:else}
		<!-- ── Apparatus: glass. The axis and the lens, and nothing else. ────── -->
		{#if chartableRows.length > 0}
			<div class="panel ctx-glass cmp-controls">
				<div class="cmp-ctrl">
					<span class="cmp-ctrl-label" id="cmp-axis-label">Axis</span>
					<div class="segment" role="group" aria-labelledby="cmp-axis-label">
						{#each COMPARE_AXIS_CHOICES as choice (choice)}
							<button
								class="btn"
								class:is-active={axisSeconds === choice}
								aria-pressed={axisSeconds === choice}
								onclick={() => (axisSeconds = choice)}>{choice}s</button
							>
						{/each}
					</div>
				</div>
				<div class="cmp-ctrl cmp-ctrl--lens">
					<span class="cmp-ctrl-label" id="cmp-lens-label">Show</span>
					<div class="cmp-lenses" role="group" aria-labelledby="cmp-lens-label">
						{#each chartableRows as row (row.key)}
							<button
								class="chip chip--sm"
								class:active={lenses.has(row.key)}
								aria-pressed={lenses.has(row.key)}
								onclick={() => toggleLens(row.key)}>{row.label}</button
							>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- ── The chart: on the night, no ground of its own. ────────────────── -->
		<div class="cmp-section">
			<p class="kicker">Timing on one ruler</p>
			<div
				class="cmp-chart"
				bind:clientWidth={timelineW}
				style:--track-w="{trackW}px"
				style:--gutter="{LANE_GUTTER}px"
				style:--fact-w="{LANE_FACT_W}px"
				style:--lane-gap="{LANE_GAP}px"
			>
				{#if visibleRows.length > 0}
					<div class="cmp-ruler-row">
						<div></div>
						<div class="cmp-ruler">
							{#each ruler as tick (tick.t)}
								<span class="cmp-rtick" class:cmp-rtick--major={tick.major} style:left="{tick.x}px">
									{#if tick.major}<span class="cmp-rtick-label">{tick.t}s</span>{/if}
								</span>
							{/each}
						</div>
						<div></div>
					</div>

					<!-- The pointer region is the tracks' column only, so `crossX` is
					     already lane-local and needs no offset arithmetic. -->
					<div class="cmp-lanes">
						<div
							class="cmp-crosshair-zone"
							onpointermove={trackPointer}
							onpointerleave={() => (crossX = null)}
							aria-hidden="true"
						></div>
						{#if crossX !== null}
							<div class="cmp-crosshair" style:left="{crossX}px">
								<span class="cmp-crosshair-tag">{crossT!.toFixed(1)}s</span>
							</div>
						{/if}

						{#each visibleRows as row (row.key)}
							<p class="cmp-group">{row.label}</p>
							{#each row.lanes as lane (`${lane.columnIndex}:${lane.key}`)}
								{@const col = columns[lane.columnIndex]}
								{@const locked = lane.minCon > viewCons[lane.columnIndex]}
								<div class="cmp-lane" style:--el-color={col.color}>
									{@render avatarDisc(
										col.id,
										col.entry?.displayName ?? col.id,
										col.color,
										LANE_GUTTER
									)}
									<CompareBar
										segments={segmentsFor(lane)}
										ticks={lane.ticks ?? []}
										bar={col.bar}
										scaleSeconds={axisSeconds}
										trackWidthPx={trackW}
										{locked}
									/>
									<span class="cmp-lane-fact" title={laneTitle(lane, row)}>
										<span class="cmp-lane-nums">{lane.uptime}s / {lane.host.cooldown}s</span>
										<span class="cmp-lane-host">{hostCost(lane)}</span>
										{#if locked}<Mark name="gated" size={11} />{/if}
									</span>
								</div>
								{#if lane.alsoCarries.length > 0}
									<p class="cmp-also-line">
										also: {lane.alsoCarries
											.map((k) => chartableRows.find((r) => r.key === k)?.label ?? k)
											.join(' · ')}
									</p>
								{/if}
							{/each}
						{/each}
					</div>
				{:else if chartableRows.length > 0}
					<p class="cmp-empty">Every effect is hidden — turn a chip back on to draw the chart.</p>
				{:else}
					<p class="cmp-empty">No curated timing to draw for this selection.</p>
				{/if}
			</div>
			<p class="note cmp-footnote">
				A lane is one ability; the heading is what it does. Solid = the cast you make now, faint =
				the same cast repeated on cooldown — <strong>energy is not modelled</strong>, so a burst's
				repeats are a best case. Ticks mark a summon's cadence over its first window.
			</p>
		</div>

		<!-- ── The answer: paper. ⚠ `.panel.panel--paper` — a lone modifier ties
		     with `.panel` on specificity and loses on source order. ──────────── -->
		<div class="cmp-section">
			<p class="kicker">Side by side</p>
			<div class="panel panel--paper cmp-facts">
				<div class="cmp-tablewrap">
					<table class="cmp-table">
						<thead>
							<tr>
								<th class="cmp-th-label" aria-label="Attribute"></th>
								{#each columns as col (col.id)}
									<th class:cmp-th-ref={col.id === anchorId}>{col.entry?.displayName ?? col.id}</th>
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
													title={cellTitle(cell)}
												>
													<span class="cmp-gate" class:cmp-gate--base={cell.minCon === 0}
														>C{cell.minCon}{#if locked}<Mark name="gated" size={11} />{/if}</span
													>
													{#if cell.target}<span class="cmp-target"
															>{TARGET_SHORT[cell.target] ?? cell.target}</span
														>{/if}
													{#if cell.conditional}<span
															class="cmp-cond"
															title={cell.caveats.map(caveatText).join(' · ')}>~</span
														>{/if}
													{#if cell.details.length > 0}
														{@const kind = row.key.startsWith('buff:') ? 'buff' : row.key}
														<span class="cmp-details"
															>{cell.details
																.map((d) => capDetailText(kind as CapabilityKind, d))
																.join(' · ')}</span
														>
													{/if}
													{#if cell.also}
														{@const alsoLocked = cell.also.minCon > viewCons[i]}
														<span class="cmp-also" class:cmp-cell--locked={alsoLocked}
															>{TARGET_SHORT[cell.also.target]} from C{cell.also
																.minCon}{#if alsoLocked}<Mark name="gated" size={11} />{/if}</span
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
			</div>
			<p class="note cmp-footnote">
				~ = conditional (hover for the condition) · hover a cell for its source ability · full
				provenance lives in each character's detail card.
			</p>
		</div>
	{/if}
</section>

<style>
	.cmp {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
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
		font-size: var(--fs-4xl);
		font-weight: var(--fw-semibold);
	}
	.cmp-mode {
		flex: 1;
		margin: 0;
		font-size: var(--fs-md);
		color: var(--chart-ink);
	}
	.cmp-headact,
	.cmp-headback {
		align-self: center;
		white-space: nowrap;
	}
	.cmp-footnote {
		font-size: var(--fs-sm);
		color: var(--chart-dim);
	}

	/* ── Portrait discs ───────────────────────────────────────── */
	/* ⚓ NATE 2026-08-11: "they do need to be opaque — they layer and stack, so
	   they can't be transparent." The disc takes the element wash, like every
	   other character portrait on the site: ONE ground, only the element
	   travels. ⛔ Never --bg. */
	.cmp-disc {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		/* ⛔ 1px, not 1.5 — Chrome floors border-width to whole CSS px, so the
		   half never rendered and cost a hairline of alignment instead. */
		border: 1px solid var(--el-color);
		overflow: hidden;
		background: color-mix(in srgb, var(--el-color) 26%, var(--surface-well));
		flex-shrink: 0;
	}
	.cmp-disc img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.333) translateY(-14%);
	}
	.cmp-disc-initials {
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--el-color);
	}

	/* ── The reference row (audition) ─────────────────────────── */
	.cmp-ref {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.45rem 0.7rem;
		border: 1px solid color-mix(in srgb, var(--el-color) 45%, var(--border));
		border-left: 3px solid var(--el-color);
		border-radius: var(--r-sm);
		background: color-mix(in srgb, var(--el-color) 10%, transparent);
	}
	.cmp-ref-body {
		display: flex;
		flex-direction: column;
		line-height: var(--lh-tight);
	}
	.cmp-ref-role {
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--chart-ink);
	}
	.cmp-ref-name {
		font-family: var(--font-display);
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
	}
	.cmp-ref-meta {
		margin-left: auto;
		font-size: var(--fs-sm);
		color: var(--chart-ink);
		text-transform: capitalize;
	}

	/* ── Candidates / legend ──────────────────────────────────── */
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
	.cmp-chip-body {
		display: flex;
		flex-direction: column;
		line-height: var(--lh-tight);
	}
	.cmp-chip-name {
		font-family: var(--font-display);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
	}
	/* ⛔ NOT an element token. Gold means "a gap you can click"; the wishlist
	   star is exactly that, and it wore --el-geo-hi only because geo happens to
	   be gold-ish — borrowing an element's colour for a non-element role. */
	.cmp-chip-wish {
		margin-left: 0.25rem;
		color: var(--accent);
		font-size: var(--fs-md);
	}
	.cmp-chip-meta {
		font-size: var(--fs-xs);
		color: var(--chart-ink);
		text-transform: capitalize;
	}
	/* ↻ 2026-08-12: --ui-provisional — the "stub" label reports uncurated frame
	   timing, a data-quality state, not a domain colour and not an actionable
	   gap. */
	.cmp-chip-stub {
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		color: color-mix(in srgb, var(--ui-provisional) 80%, var(--chart-ink));
	}
	.cmp-chip-remove {
		background: none;
		border: none;
		padding: 2px 3px;
		color: var(--chart-dim);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition: color var(--t-snap);
	}
	.cmp-chip-remove:hover {
		color: var(--text);
	}
	.cmp-take {
		white-space: nowrap;
	}

	/* ── Apparatus: the glass plate ───────────────────────────── */
	.cmp-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1.1rem;
		padding: 0.45rem 0.7rem;
	}
	.cmp-ctrl {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
	}
	.cmp-ctrl--lens {
		flex: 1;
		min-width: 0;
	}
	.cmp-ctrl-label {
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--chart-ink);
		white-space: nowrap;
	}
	.cmp-lenses {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		min-width: 0;
	}

	/* ── The chart ────────────────────────────────────────────── */
	.cmp-section {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		min-width: 0;
	}
	.cmp-chart {
		min-width: 0;
	}

	.cmp-ruler-row,
	.cmp-lane {
		display: grid;
		grid-template-columns: var(--gutter) var(--track-w) minmax(0, var(--fact-w));
		align-items: center;
		gap: var(--lane-gap);
	}

	.cmp-ruler {
		position: relative;
		height: 15px;
	}
	.cmp-rtick {
		position: absolute;
		bottom: 0;
		width: 1px;
		height: 4px;
		background: var(--chart-grid);
	}
	.cmp-rtick--major {
		height: 8px;
		background: var(--chart-rule);
	}
	.cmp-rtick-label {
		position: absolute;
		bottom: 9px;
		left: 0;
		transform: translateX(-50%);
		font-size: var(--fs-xs);
		color: var(--chart-dim);
		white-space: nowrap;
	}

	.cmp-lanes {
		position: relative;
	}

	/* The pointer target is the TRACK column only — offset by the gutter and one
	   gap, so the x it reports is already lane-local. */
	.cmp-crosshair-zone {
		position: absolute;
		top: 0;
		bottom: 0;
		left: calc(var(--gutter) + var(--lane-gap));
		width: var(--track-w);
		z-index: 4;
	}
	.cmp-crosshair {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: 1px;
		margin-left: calc(var(--gutter) + var(--lane-gap));
		background: var(--chart-rule);
		pointer-events: none;
		z-index: 5;
		/* ⛔ No transition: it tracks the pointer, and a ramp on a hairline reads
		   as smear (motion round — the band axis is SIZE, and this is a control
		   surface at its smallest). */
	}
	.cmp-crosshair-tag {
		position: absolute;
		top: 0;
		left: 3px;
		padding: 0 4px;
		border-radius: 2px;
		background: var(--glass-bar);
		color: var(--text);
		font-size: var(--fs-xs);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.cmp-group {
		margin: 0.7rem 0 0.25rem;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		color: var(--text);
	}

	.cmp-lane {
		padding: 0.1rem 0;
	}
	/* inline-flex: the locked state's Mark is a block-level <svg>, which would
	   otherwise break the surrounding inline box. */
	.cmp-lane-fact {
		display: inline-flex;
		align-items: baseline;
		gap: 5px;
		font-size: var(--fs-sm);
		color: var(--chart-ink);
		white-space: nowrap;
		min-width: 0;
	}
	.cmp-lane-nums {
		font-variant-numeric: tabular-nums;
	}
	.cmp-lane-host {
		color: var(--chart-dim);
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* The second half of host-as-lane: one cast buying two things is a fact the
	   per-effect model could not show at all. */
	.cmp-also-line {
		margin: 0 0 0.2rem;
		padding-left: calc(var(--gutter) + var(--lane-gap));
		font-size: var(--fs-xs);
		color: var(--chart-dim);
	}

	/* ── The facts table: paper ───────────────────────────────────────────────
	   ⚠⚠ A CONTEXT FLIP INVERTS THE INK LADDER, AND THIS BLOCK IS WHERE IT BITES.
	   On dark, --muted is the QUIET rung under --text. On paper it is the exact
	   opposite: ⚓ Nate's inversion makes --muted (ink-900, 8.00:1) the ANCHORING
	   rung for labels and controls, and --text (ink-700, 6.18:1) the RECEDING
	   rung for prose. So every role below reads backwards from how the same
	   token reads twenty lines up in the chart.

	   This table carried the dark-context ladder for as long as it sat on a dark
	   frame, where it was right. Turning it into the paper card is what exposed
	   it — the tokens did not move, the ground did. LABELS take --muted; prose
	   and detail take --text; the genuinely quiet things go down from --text.
	   ⛔ Do not "fix" this back by symmetry with the chart. */
	.cmp-facts {
		padding: 0.5rem 0.8rem 0.7rem;
	}
	.cmp-tablewrap {
		overflow-x: auto;
		min-width: 0;
	}
	.cmp-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-md);
	}
	.cmp-table th {
		padding: 0.35rem 0.6rem 0.35rem 0;
		text-align: left;
		font-family: var(--font-display);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--muted); /* a heading anchors — see the ladder note above */
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}
	/* ⛔ The header is INK, not the element: on paper every --el-*-main sits
	   under 3:1 (cryo measures 1.14), and the palette has no light rung by
	   design. The discs above carry the element; a name does not need to. */
	.cmp-th-ref {
		color: var(--accent);
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
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		color: var(--muted); /* a row label anchors */
		white-space: nowrap;
	}

	.cmp-cell {
		display: inline-flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.35rem;
		font-size: var(--fs-sm);
		min-width: 0;
	}
	/* The rung below prose. On paper the ground is opaque, so mixing toward
	   transparent is safe here in a way it is not out on the night. */
	.cmp-cell--locked,
	.cmp-gate--base,
	.cmp-none,
	.cmp-also {
		color: color-mix(in srgb, var(--text) 62%, transparent);
	}
	.cmp-val {
		font-variant-numeric: tabular-nums;
	}
	.cmp-gate {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 1px 6px;
		border-radius: 3px;
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		background: var(--fill-rest);
	}
	.cmp-gate--base {
		background: transparent;
	}
	.cmp-target,
	.cmp-details,
	.cmp-cond {
		color: var(--text); /* prose recedes on paper — it is not the label */
	}
	.cmp-cond {
		font-style: italic;
		cursor: help;
	}
	.cmp-also {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-style: italic;
	}

	.cmp-empty,
	.cmp-loading {
		padding: 0.6rem 0;
		color: var(--chart-ink);
	}
</style>
