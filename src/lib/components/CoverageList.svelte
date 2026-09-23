<script lang="ts">
	/**
	 * The /coverage page's body (docs/coverage-round.md §7): every character, a
	 * coverage strip beside each name, hover for a segment's details, select a
	 * row for all of them in place (⛔ never a modal).
	 *
	 * ⚓ IDENTICAL PLACES — the strip, the column headers and the legend share ONE
	 * grid template built from COVERAGE_WIDTHS, so a column sits at the same x in
	 * every row and the headers label it once.
	 *
	 * The index carries only the STATES (one character per segment); the lines
	 * and caveats come from `deriveCoverage` over the lazy payload, loaded when a
	 * row is hovered or opened.
	 */
	import { onMount, tick } from 'svelte';
	import { SvelteSet, SvelteMap } from 'svelte/reactivity';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { characterIndex } from '$lib/data/characterIndex.generated';
	import { loadCharacter } from '$lib/data/characterData';
	import type { CharacterData, CharacterIndexEntry } from '$lib/types/character';
	import {
		COVERAGE_SEGMENTS,
		coverageCount,
		decodeCoverage,
		deriveCoverage,
		type Coverage,
		type CoverageColumn,
		type CoverageSegmentKey,
		type CoverageState
	} from '$lib/coverage/deriveCoverage';
	import {
		COVERAGE_COLUMN_GAP_PX,
		COVERAGE_SEAM_PX,
		COVERAGE_WIDTHS
	} from '$lib/coverage/coverageWidths';
	import {
		COLUMN_LABEL,
		LINE_TEXT,
		SEGMENT_TITLE,
		STATE_DESCRIPTION,
		STATE_LABEL
	} from '$lib/coverage/coverageText';
	import { getAvatar, hasAvatar } from '$lib/utils/getAvatar';
	import { constellations, ownership, siteSettings } from '$lib/stores';
	import { portal } from '$lib/actions/portal';
	import { takeCoverageFocus } from '$lib/coverage/openCoverage';

	// -------------------------------------------------------------------------
	// The shared grid template
	// -------------------------------------------------------------------------

	/** One grid line per segment, with a gap track between columns and a seam
	 *  track between the sub-segments of one column. */
	const layout = (() => {
		const tracks: string[] = [];
		const segCol: Record<string, number> = {};
		const colSpan: Partial<Record<CoverageColumn, [number, number]>> = {};
		let prev: CoverageColumn | undefined;
		for (const seg of COVERAGE_SEGMENTS) {
			if (prev !== undefined)
				tracks.push(`${seg.column === prev ? COVERAGE_SEAM_PX : COVERAGE_COLUMN_GAP_PX}px`);
			tracks.push(`${COVERAGE_WIDTHS[seg.key]}fr`);
			const line = tracks.length; // 1-based grid column of this segment
			segCol[seg.key] = line;
			const span = colSpan[seg.column];
			colSpan[seg.column] = span ? [span[0], line] : [line, line];
			prev = seg.column;
		}
		return {
			template: tracks.join(' '),
			segCol,
			colSpan: Object.entries(colSpan) as [CoverageColumn, [number, number]][]
		};
	})();

	const STATES: CoverageState[] = ['lit', 'provisional', 'missing', 'notModeled', 'na'];

	// -------------------------------------------------------------------------
	// Rows, filters, sort
	// -------------------------------------------------------------------------

	type Row = {
		entry: CharacterIndexEntry;
		states: CoverageState[];
		lit: number;
		of: number;
		gaps: number;
	};

	const rows: Row[] = characterIndex
		.filter((e) => e.id !== 'blank')
		.map((entry) => {
			const states = decodeCoverage(entry.coverage);
			const { lit, of } = coverageCount(states);
			const gaps = states.filter((s) => s === 'missing' || s === 'provisional').length;
			return { entry, states, lit, of, gaps };
		});

	const ELEMENTS = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'];
	const WEAPONS = ['sword', 'claymore', 'polearm', 'bow', 'catalyst'];

	let search = $state('');
	const elements = new SvelteSet<string>();
	const weapons = new SvelteSet<string>();
	let rosterOnly = $state(false);
	let sort = $state<'name' | 'least'>('name');

	const owned = $derived(
		new Set(Object.keys($ownership).filter((id) => $ownership[id] === 'owned'))
	);

	// -------------------------------------------------------------------------
	// Deep link — /coverage?c=bennett,xiangling (the planner's Notes panel)
	// -------------------------------------------------------------------------

	/** Characters named by the link, in the link's order; empty = the full list.
	 *  Read in onMount, never during render: the page is prerendered, and a
	 *  query string does not exist at build time. */
	let pinned = $state<string[]>([]);
	const byId: Record<string, Row> = Object.fromEntries(rows.map((r) => [r.entry.id, r]));

	/** True on the /coverage route itself; false inside the About overlay,
	 *  where the URL is whatever tool the overlay floats over. */
	const onRoute = () => location.pathname.replace(/\/$/, '').endsWith('/coverage');

	onMount(async () => {
		// The overlay link's focus first (openCoverage), else the route's ?c=.
		const named =
			takeCoverageFocus() ??
			(onRoute() ? (new URLSearchParams(location.search).get('c') ?? '').split(',') : []);
		const ids = named
			.map((s) => s.trim())
			.filter((id, i, all) => id in byId && all.indexOf(id) === i);
		if (ids.length === 0) return;
		pinned = ids;
		for (const id of ids) {
			open.add(id);
			ensure(id);
		}
		await tick();
		document.getElementById(`cov-${ids[0]}`)?.scrollIntoView({ block: 'start' });
	});

	function showAll() {
		pinned = [];
		if (onRoute()) replaceState(resolve('/coverage'), {});
	}

	const visible = $derived.by(() => {
		if (pinned.length > 0) return pinned.map((id) => byId[id]);
		const q = search.trim().toLowerCase();
		const out = rows.filter(
			(r) =>
				(!q || r.entry.displayName.toLowerCase().includes(q)) &&
				(elements.size === 0 || elements.has(r.entry.element ?? '')) &&
				(weapons.size === 0 || weapons.has(r.entry.weapon ?? '')) &&
				(!rosterOnly || owned.has(r.entry.id))
		);
		return sort === 'name'
			? out.sort((a, b) => a.entry.displayName.localeCompare(b.entry.displayName))
			: out.sort(
					(a, b) =>
						a.lit / Math.max(a.of, 1) - b.lit / Math.max(b.of, 1) ||
						b.gaps - a.gaps ||
						a.entry.displayName.localeCompare(b.entry.displayName)
				);
	});

	function toggle(set: SvelteSet<string>, v: string) {
		if (set.has(v)) set.delete(v);
		else set.add(v);
	}

	/** "My roster" dims the constellation columns above what you own. */
	const C_LEVEL: Partial<Record<CoverageSegmentKey, number>> = { C1: 1, C2: 2, C4: 4, C6: 6 };
	function dimmed(id: string, key: CoverageSegmentKey): boolean {
		if (!rosterOnly) return false;
		const level = C_LEVEL[key];
		return level !== undefined && level > ($constellations[id] ?? 0);
	}

	// -------------------------------------------------------------------------
	// Lazy details
	// -------------------------------------------------------------------------

	const details = new SvelteMap<string, { data: CharacterData; cov: Coverage } | null>();
	function ensure(id: string) {
		if (details.has(id)) return;
		details.set(id, null);
		loadCharacter(id).then((data) => {
			if (data) details.set(id, { data, cov: deriveCoverage(data) });
		});
	}

	/** Caveats of a cell's hosts, deduped — a caveat's host IS its column. */
	function caveatsOf(data: CharacterData, hosts: string[]): string[] {
		const all = [...data.abilities, ...(data.passives ?? []), ...(data.constellations ?? [])];
		const out: string[] = [];
		for (const id of hosts) {
			const c = all.find((a) => a.id === id)?.caveat;
			if (c && !out.includes(c)) out.push(c);
		}
		return out;
	}

	const open = new SvelteSet<string>();

	// -------------------------------------------------------------------------
	// Tooltip
	// -------------------------------------------------------------------------

	let tip = $state<{ id: string; key: CoverageSegmentKey; x: number; y: number } | null>(null);

	function onSegmentEnter(event: PointerEvent, id: string, key: CoverageSegmentKey) {
		if (event.pointerType === 'touch') return; // coarse pointers use the details
		ensure(id);
		const r = (event.currentTarget as HTMLElement).getBoundingClientRect();
		tip = { id, key, x: r.left + r.width / 2, y: r.top };
	}
</script>

<div class="coverage">
	<header class="cov-head">
		<h1>Coverage</h1>
		<p class="cov-intro">
			How much of each character’s kit the Rotation Planner draws, ability by ability. Hover a
			segment for its details, or select a character to see all of them.
		</p>

		<ul class="cov-legend">
			{#each STATES as s (s)}
				<li>
					<span class="swatch s-{s}"></span>
					<strong>{STATE_LABEL[s]}</strong>
					<span class="legend-desc">{STATE_DESCRIPTION[s]}</span>
				</li>
			{/each}
		</ul>

		<!-- A deep link narrows the list to its characters; the filters would
		     do nothing there, so they return with "Show all characters". -->
		{#if pinned.length === 0}
			<div class="cov-controls">
				<input
					class="field cov-search"
					type="search"
					placeholder="Search characters"
					aria-label="Search characters"
					bind:value={search}
				/>
				<div class="chips" role="group" aria-label="Element">
					{#each ELEMENTS as el (el)}
						<button
							type="button"
							class="chip"
							class:active={elements.has(el)}
							aria-pressed={elements.has(el)}
							onclick={() => toggle(elements, el)}>{el}</button
						>
					{/each}
				</div>
				<div class="chips" role="group" aria-label="Weapon">
					{#each WEAPONS as w (w)}
						<button
							type="button"
							class="chip"
							class:active={weapons.has(w)}
							aria-pressed={weapons.has(w)}
							onclick={() => toggle(weapons, w)}>{w}</button
						>
					{/each}
				</div>
				<div class="chips" role="group" aria-label="Show">
					<!-- A phrase, so it opts out of the chip's capitalize (app.css .chip). -->
					<button
						type="button"
						class="chip cov-phrase"
						class:active={rosterOnly}
						aria-pressed={rosterOnly}
						onclick={() => (rosterOnly = !rosterOnly)}>My roster</button
					>
				</div>
				<label class="cov-sort">
					<span class="field-label">Sort</span>
					<select class="field" bind:value={sort}>
						<option value="name">By name</option>
						<option value="least">Least covered first</option>
					</select>
				</label>
			</div>
		{/if}
	</header>

	{#if pinned.length > 0}
		<p class="cov-pinned">
			<span
				>{pinned.length === 1
					? 'Showing 1 character from the Rotation Planner.'
					: `Showing ${pinned.length} characters from the Rotation Planner.`}</span
			>
			<button type="button" class="btn" onclick={showAll}>Show all characters</button>
		</p>
	{/if}

	<div class="cov-table" style:--cov-template={layout.template}>
		<div class="cov-columns" aria-hidden="true">
			<span class="cov-name-spacer"></span>
			<div class="strip strip-head">
				{#each layout.colSpan as [col, [a, b]] (col)}
					<span class="col-label" style:grid-column="{a} / {b + 1}">{COLUMN_LABEL[col]}</span>
				{/each}
			</div>
		</div>

		<ul class="cov-rows">
			{#each visible as row (row.entry.id)}
				{@const id = row.entry.id}
				{@const isOpen = open.has(id)}
				<li class="cov-row" class:is-open={isOpen} id="cov-{id}">
					<button
						type="button"
						class="row-button"
						aria-expanded={isOpen}
						onpointerenter={() => ensure(id)}
						onclick={() => {
							if (isOpen) open.delete(id);
							else {
								open.add(id);
								ensure(id);
							}
						}}
					>
						<span class="who">
							{#if hasAvatar(id)}
								<img
									class="avatar"
									src={getAvatar(
										id,
										$siteSettings.useNewOutfits,
										'circle',
										$siteSettings.travelerVariant
									)}
									alt=""
									width="32"
									height="32"
									loading="lazy"
								/>
							{:else}
								<span class="avatar avatar--blank"></span>
							{/if}
							<span class="name">{row.entry.displayName}</span>
							<span class="count">{row.lit} of {row.of}</span>
						</span>
						<span class="strip" role="img" aria-label="{row.lit} of {row.of} parts modeled">
							{#each COVERAGE_SEGMENTS as seg, i (seg.key)}
								<!-- Hover is a convenience tier only: everything the tooltip says is
								     also in the row's details, which the row button opens. -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span
									class="seg s-{row.states[i]}"
									class:is-dim={dimmed(id, seg.key)}
									style:grid-column={layout.segCol[seg.key]}
									onpointerenter={(e) => onSegmentEnter(e, id, seg.key)}
									onpointerleave={() => (tip = null)}
								></span>
							{/each}
						</span>
					</button>

					{#if isOpen}
						{@const d = details.get(id)}
						<div class="row-details">
							{#if !d}
								<p class="loading">Loading…</p>
							{:else}
								<dl class="detail-list">
									{#each COVERAGE_SEGMENTS as seg (seg.key)}
										{@const c = d.cov[seg.key]}
										{#if c.state !== 'na' || c.lines.some((l) => l.code !== 'grants.noHost')}
											<div class="detail">
												<dt>
													<span class="swatch s-{c.state}"></span>
													{SEGMENT_TITLE[seg.key]}
													<span class="detail-state">{STATE_LABEL[c.state]}</span>
												</dt>
												{#each c.lines as line, li (li)}
													<dd>
														{#if line.form}<span class="form">{line.form}</span>{/if}
														{LINE_TEXT[line.code]}
													</dd>
												{/each}
												{#if c.reason}<dd class="reason">{c.reason}</dd>{/if}
												{#each caveatsOf(d.data, c.hosts) as cav (cav)}
													<dd class="caveat">{cav}</dd>
												{/each}
											</div>
										{/if}
									{/each}
								</dl>
							{/if}
						</div>
					{/if}
				</li>
			{:else}
				<li class="empty">No characters match these filters.</li>
			{/each}
		</ul>
	</div>
</div>

{#if tip}
	{@const d = details.get(tip.id)}
	<div class="cov-tip" use:portal style:left="{tip.x}px" style:top="{tip.y}px" role="tooltip">
		<p class="tip-title">{SEGMENT_TITLE[tip.key]}</p>
		{#if !d}
			<p>Loading…</p>
		{:else}
			{@const c = d.cov[tip.key]}
			<p class="tip-state"><span class="swatch s-{c.state}"></span>{STATE_LABEL[c.state]}</p>
			<ul>
				{#each c.lines as line, li (li)}
					<li>
						{#if line.form}<span class="form">{line.form}</span>{/if}
						{LINE_TEXT[line.code]}
					</li>
				{/each}
			</ul>
			{#if c.reason}<p class="reason">{c.reason}</p>{/if}
			{#each caveatsOf(d.data, c.hosts) as cav (cav)}
				<p class="caveat">{cav}</p>
			{/each}
		{/if}
	</div>
{/if}

<style>
	.coverage {
		--cov-who-w: 13.5rem;
		--cov-strip-h: 14px;
	}

	h1 {
		margin: 0 0 0.6rem;
		font-size: var(--fs-5xl);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-tight);
		color: var(--chrome);
	}
	.cov-intro {
		margin: 0 0 1rem;
		color: var(--text);
		max-width: 60ch;
	}

	/* ---- legend ---------------------------------------------------------- */
	.cov-legend {
		list-style: none;
		margin: 0 0 1rem;
		padding: 0;
		display: grid;
		gap: 0.3rem;
		font-size: var(--fs-sm);
	}
	.cov-legend li {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.cov-legend strong {
		color: var(--text);
		font-weight: var(--fw-semibold);
		white-space: nowrap;
	}
	.legend-desc {
		color: var(--muted);
	}

	/* ---- the five states (one register each; ⛔ never element colours).
	   ⚓ Nate 2026-09-23: modeled is --ui-positive and not-modeled hatches in
	   --ui-danger, so the strip reads at a glance. ---- */
	.swatch {
		display: inline-block;
		width: 1.4rem;
		height: 0.7rem;
		flex: none;
		border-radius: 1px;
		align-self: center;
	}
	.s-lit {
		background-color: var(--ui-positive);
	}
	.s-provisional {
		background-color: var(--ui-provisional);
	}
	.s-missing {
		background-color: var(--ui-warning);
	}
	.s-notModeled {
		/* One layer only — the Safari veto is on TILED multi-layer backgrounds. */
		background-image: repeating-linear-gradient(
			135deg,
			var(--ui-danger) 0 1.5px,
			transparent 1.5px 4px
		);
	}
	.s-na {
		box-shadow: inset 0 0 0 1px var(--border);
	}

	/* ---- controls -------------------------------------------------------- */
	.cov-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 0.75rem;
		align-items: center;
		margin-bottom: 0.75rem;
	}
	.cov-search {
		flex: 1 1 12rem;
		width: auto;
		min-width: 0;
	}
	.cov-phrase {
		text-transform: none;
	}
	.cov-sort {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}
	.cov-sort .field-label {
		margin: 0;
	}
	.cov-sort .field {
		width: auto;
	}

	/* ---- the table ------------------------------------------------------- */
	.cov-columns,
	.row-button {
		display: grid;
		grid-template-columns: var(--cov-who-w) minmax(0, 1fr);
		align-items: center;
		gap: 0.75rem;
	}
	.cov-columns {
		position: sticky;
		/* It scrolls inside the overlay's chapter body or the route's panel;
		   top: 0 is the scrollport's edge in both. */
		top: 0;
		z-index: 1;
		padding: 0.4rem 0;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}
	.strip {
		display: grid;
		grid-template-columns: var(--cov-template);
		align-items: center;
		min-width: 0;
	}
	.strip-head {
		font-size: var(--fs-xs);
		color: var(--muted);
	}
	.col-label {
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
	}

	.cov-rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.cov-row {
		border-bottom: 1px solid var(--border);
		/* A deep link scrolls the first named row in under the sticky header. */
		scroll-margin-top: 2.5rem;
	}
	.row-button {
		width: 100%;
		padding: 0.3rem 0;
		font: inherit;
		color: inherit;
		text-align: left;
		background: transparent;
		border: 0;
		cursor: pointer;
	}
	.row-button:hover .name,
	.cov-row.is-open .name {
		color: var(--chrome);
	}
	.who {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}
	.avatar {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
	}
	.avatar--blank {
		display: block;
		box-shadow: inset 0 0 0 1px var(--border);
	}
	.name {
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: color var(--t-snap);
	}
	.count {
		font-size: var(--fs-xs);
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.seg {
		height: var(--cov-strip-h);
		border-radius: 1px;
	}
	.seg.is-dim {
		opacity: 0.3;
	}
	.empty {
		padding: 1rem 0;
		color: var(--muted);
	}

	/* ---- details (in flow, ⛔ never a modal) ------------------------------ */
	.row-details {
		padding: 0.25rem 0 0.9rem calc(var(--cov-who-w) + 0.75rem);
	}
	.loading {
		color: var(--muted);
		margin: 0.25rem 0;
	}
	.detail-list {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: 0.6rem 1.25rem;
	}
	.detail dt {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		color: var(--text);
		font-weight: var(--fw-semibold);
		font-size: var(--fs-sm);
	}
	.detail-state {
		margin-left: auto;
		font-weight: normal;
		color: var(--muted);
	}
	.detail dd {
		margin: 0.15rem 0 0;
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.form {
		color: var(--text);
		margin-right: 0.35rem;
	}
	.reason,
	.caveat {
		color: var(--text);
	}

	/* ---- tooltip (portalled: the panel's will-change mints a containing block) */
	.cov-tip {
		position: fixed;
		z-index: 50;
		transform: translate(-50%, calc(-100% - 8px));
		max-width: 22rem;
		padding: 0.55rem 0.7rem;
		font-size: var(--fs-sm);
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--r-sm, 3px);
		pointer-events: none;
	}
	.cov-tip p,
	.cov-tip ul {
		margin: 0.2rem 0 0;
	}
	.cov-tip ul {
		padding-left: 1rem;
	}
	.tip-title {
		font-weight: var(--fw-semibold);
		margin-top: 0 !important;
	}
	.tip-state {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--muted);
	}

	/* ---- narrow: the strip takes the full width under the name ------------ */
	@media (max-width: 40rem) /* compact — $lib/breakpoints.ts */ {
		.cov-columns,
		.row-button {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.3rem;
		}
		.cov-name-spacer {
			display: none;
		}
		.row-details {
			padding-left: 0;
		}
	}
</style>
