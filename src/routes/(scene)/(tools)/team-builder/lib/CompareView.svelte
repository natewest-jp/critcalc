<script lang="ts">
	/**
	 * Compare / Audition — the Team Builder's kit-against-kit surface.
	 *
	 * ONE SURFACE, TWO JOBS, AND THEY DIFFER IN EXACTLY ONE THING: whether there
	 * is a REFERENCE. Compare is symmetric — N peers, "how do these differ?" — and
	 * may pin one of them as a reference. Audition is asymmetric — an incumbent,
	 * challengers, and a slot to fill, "does this one fit HERE?". The incumbent
	 * IS the reference, so `anchorId` is not a mode flag bolted on the side.
	 *
	 * ⚓ CONTRIBUTIONS, ONE BLOCK PER EFFECT (Team Builder round, 2026-10-07).
	 * The view used to be a timing chart over a facts table: the bar for a heal
	 * and the numbers for that heal were a screen apart, and the table forced
	 * every kit into every row, so it was mostly dashes. Now each effect two or
	 * more of the characters share is ONE block — its facts per character (how
	 * much, who receives it, how long, what opens it), its lanes right beneath —
	 * and what only one character brings is listed under that character's name.
	 * Kits differ too much for a full grid; lining up is kept for where it helps.
	 *
	 * ⚓ THE LANE'S SPINE (2026-08-13) still holds: a LANE is an ABILITY (its
	 * cooldown and energy travel with it), the GROUPING is an EFFECT. A passive
	 * rides the lane of the cast its trigger names; a REACTION-set window is drawn
	 * once ("per Swirl"), never tiled. See compare.ts.
	 *
	 * MATERIALS: night looks · glass touches. The column header — the one thing
	 * with controls on it — is a glass plate that stays put while the blocks
	 * scroll beneath it; the blocks (facts and lanes) sit on the night.
	 * ⚠ The header is OUTSIDE the scroller on purpose, never `position: sticky`
	 * inside it: the scroll-fade mask would dissolve a sticky child (the Atlas
	 * head's note in +page.svelte has the measurement).
	 */
	import { untrack, type Snippet } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { getCharacterIndexEntry, searchCharacterIndex } from '$lib/data/characterLookup';
	import { getLoadedCharacter, loadCharacter } from '$lib/data/characterData';
	import { constellations, siteSettings, ownership } from '$lib/stores';
	import { getAvatar, getAvatarFallback, hasAvatar } from '$lib/utils/getAvatar';
	import { elementPalette } from '$lib/utils/elementColors';
	import { scrollFade } from '$lib/actions/scrollFade';
	import { below } from '$lib/media.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import { deriveCharacterCapabilities } from '$lib/capabilities/deriveCapabilities';
	import { rulerTicks } from '$lib/timeline/barGeometry';
	import { laneSegments, singleWindowSegments } from '$lib/timeline/barCycles';
	import { formatBuffDisplayValue } from '$lib/timeline/buffDisplay';
	import { conCapFor, type ConMode } from './facets';
	import {
		buildCompareModel,
		COMPARE_AXIS_CHOICES,
		COMPARE_AXIS_DEFAULT,
		MAX_COMPARE,
		factDelta,
		isShared,
		type CapCell,
		type CapLane,
		type CapRow,
		type CapRowKey
	} from './compare';
	import {
		TARGET_LABEL,
		TARGET_SHORT,
		capDetailText,
		caveatText
	} from '$lib/capabilities/capabilityText';
	import type { CapabilityKind, CapabilitySection } from '$lib/capabilities/deriveCapabilities';
	import CompareBar from './CompareBar.svelte';
	import type { RotationRead } from './auditionRotation';

	let {
		ids,
		conMode,
		onRemove,
		onAdd = undefined,
		anchorId = undefined,
		auditionSlot = undefined,
		onCommit = undefined,
		onClear = undefined,
		onCancelAudition = undefined,
		onBackToPlanner = undefined,
		seedLenses = undefined,
		onLensChange = undefined,
		onElementLensChange = undefined,
		candidatesArea = undefined,
		teamDeltas = undefined,
		rotationReads = undefined
	}: {
		ids: string[];
		conMode: ConMode;
		/** Remove one character from the comparison (the tab stack stays in sync). */
		onRemove: (id: string) => void;
		/** Add a character from inside Compare — the header's search. */
		onAdd?: (id: string) => void;
		/** Audition mode: the incumbent, pinned as the reference — can't be removed. */
		anchorId?: string;
		/** Audition mode: which slot is being filled. */
		auditionSlot?: number;
		/** Audition mode: commit a candidate into the audition slot (swaps + returns). */
		onCommit?: (id: string) => void;
		/** Plain compare: clear the whole selection. */
		onClear?: () => void;
		/** Audition mode: abandon without committing. */
		onCancelAudition?: () => void;
		/** Set only when the audition arrived as an errand from the planner. */
		onBackToPlanner?: () => void;
		/** Audition mode: the jobs this slot currently does, with the facet
		 *  system's own labels (handed in so the chips cannot drift from the
		 *  Roster rail's wording). EMPTY triggers the element fallback. */
		seedLenses?: readonly { key: string; label: string }[];
		/** The lens selection changed — an audition narrows its candidates by it. */
		onLensChange?: (keys: CapRowKey[]) => void;
		/** The ELEMENT lens changed — only in the fallback. */
		onElementLensChange?: (elements: string[]) => void;
		/** Audition mode: the candidates strip — the host owns its tiles. */
		candidatesArea?: Snippet;
		/** Audition mode: what each candidate's swap changes about the TEAM —
		 *  the question an audition is really asking. Facts, never a score. */
		teamDeltas?: Record<
			string,
			{ gained: string[]; lost: string[]; resonance?: { before: string[]; after: string[] } }
		>;
		/** Audition mode: each candidate's swap run through the planner's parse
		 *  of the working rotation (absent = still reading; null = there is no
		 *  rotation to read). See auditionRotation.ts. */
		rotationReads?: Record<string, RotationRead | null>;
	} = $props();

	/** The element fallback's vocabulary — the Roster filter rail's seven, in order. */
	const LENS_ELEMENTS = ['anemo', 'cryo', 'dendro', 'electro', 'geo', 'hydro', 'pyro'] as const;

	// ── Geometry ──────────────────────────────────────────────────────────────
	// 🎛️ The lane gutter holds one avatar disc; the fact column holds two lines
	// (the cycle, then what the same cast also buys).
	const LANE_GUTTER = 26;
	const LANE_FACT_W = 190;
	const LANE_GAP = 10;
	const TRACK_MIN = 160;
	const TRACK_MAX = 1100;

	let bodyW = $state(0);
	/** Below `compact` the fact column stacks under the bar — the SAME flag the
	 *  stylesheet's `@media (max-width: 40rem)` reads, so the track width and
	 *  the grid can never disagree about which form is showing. */
	const narrow = $derived(below('compact'));
	const trackW = $derived(
		bodyW > 0
			? Math.max(
					TRACK_MIN,
					Math.min(
						TRACK_MAX,
						narrow
							? bodyW - LANE_GUTTER - LANE_GAP
							: bodyW - LANE_GUTTER - LANE_FACT_W - LANE_GAP * 2
					)
				)
			: 320
	);

	/* ⚠ TWO COLOURS PER COLUMN: `color` is the element's IDENTITY (`main`),
	   `bar` its FILL rung — only CompareBar takes the second. */
	const columns = $derived(
		ids.map((id) => {
			const entry = getCharacterIndexEntry(id);
			const pal = elementPalette(entry?.element);
			return { id, entry, name: entry?.displayName ?? id, color: pal.main, bar: pal.bar };
		})
	);

	const anchorIndex = $derived(anchorId ? ids.indexOf(anchorId) : -1);

	// Full payloads — lazy chunks, reactive as each lands.
	$effect(() => {
		for (const id of ids) void loadCharacter(id);
	});
	const loaded = $derived(ids.map((id) => getLoadedCharacter(id)));
	const allLoaded = $derived(loaded.every((d) => d !== null));

	// Show everything; weaken what the mode's constellation cap hasn't unlocked —
	// per column, since "My roster" caps differ per character.
	const viewCons = $derived(ids.map((id) => conCapFor(conMode, $constellations[id] ?? 0)));

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

	// ── The reference ────────────────────────────────────────────────────────
	// The audition's incumbent, or a column the reader pins in plain Compare.
	let pinnedId = $state<string | null>(null);
	$effect(() => {
		if (pinnedId && !ids.includes(pinnedId)) pinnedId = null;
	});
	const refIndex = $derived(anchorIndex >= 0 ? anchorIndex : pinnedId ? ids.indexOf(pinnedId) : -1);

	// ── Axis + lens ─────────────────────────────────────────────────────────
	let axisSeconds = $state<number>(COMPARE_AXIS_DEFAULT);
	const allRows = $derived(model ? model.capRows : []);

	/**
	 * THE CHIP VOCABULARY. In plain compare the chips are the ROWS on screen —
	 * you narrow what you are looking at. ⚓ In an AUDITION they are the SLOT's,
	 * handed in whole: the row stays stable as candidates come and go, and keeps
	 * facets that may not be on screen (an instant cleanse) as candidate filters.
	 */
	const lensChips = $derived<{ key: string; label: string }[]>(
		anchorId !== undefined
			? [...(seedLenses ?? [])]
			: allRows.map((r) => ({ key: r.key as string, label: r.label }))
	);

	/** ⚓ THE ELEMENT FALLBACK (Nate 2026-08-13): a slot with no team-facing
	 *  capability auditions by ELEMENT. ⛔ Never both vocabularies at once. */
	const elementLens = $derived(anchorId !== undefined && lensChips.length === 0);
	const anchorElement = $derived(
		anchorIndex >= 0 ? (columns[anchorIndex].entry?.element ?? null) : null
	);

	const lenses = new SvelteSet<CapRowKey>();
	const elementLenses = new SvelteSet<string>();

	// `seedLenses` gets a NEW array identity per audition, so this reseeds once
	// per open and never fights the user's own toggles.
	let seededFrom: readonly unknown[] | undefined = undefined;
	$effect(() => {
		if (seedLenses === seededFrom) return;
		seededFrom = seedLenses;
		lenses.clear();
		elementLenses.clear();
		for (const chip of seedLenses ?? []) lenses.add(chip.key as CapRowKey);
		if (untrack(() => elementLens) && anchorElement) elementLenses.add(anchorElement);
		onLensChange?.([...lenses]);
		onElementLensChange?.([...elementLenses]);
	});

	// Drop lens keys the selection no longer offers (plain compare only — an
	// audition's chips are the slot's, not the screen's).
	$effect(() => {
		if (!model || anchorId !== undefined) return;
		const available = new Set(allRows.map((r) => r.key));
		let changed = false;
		for (const key of [...lenses]) {
			if (!available.has(key)) {
				lenses.delete(key);
				changed = true;
			}
		}
		if (changed) onLensChange?.([...lenses]);
	});

	function toggleLens(key: string) {
		if (lenses.has(key as CapRowKey)) lenses.delete(key as CapRowKey);
		else lenses.add(key as CapRowKey);
		onLensChange?.([...lenses]);
	}

	function toggleElementLens(el: string) {
		if (elementLenses.has(el)) elementLenses.delete(el);
		else elementLenses.add(el);
		onElementLensChange?.([...elementLenses]);
	}

	/** The lens picks the BLOCKS — an effect's facts and its lanes go together.
	 *  The element fallback narrows candidates only (an element is not an effect). */
	const visibleRows = $derived(
		lenses.size === 0 ? allRows : allRows.filter((r) => lenses.has(r.key))
	);

	/** Rows two or more characters share — the real comparisons. With one
	 *  character there is nothing to share, so every row is a block. */
	const sharedRows = $derived(
		ids.length < 2 ? visibleRows : visibleRows.filter((r) => isShared(r))
	);
	/** What only ONE character brings, per column. */
	const uniqueRows = $derived(
		ids.length < 2
			? ids.map(() => [] as CapRow[])
			: ids.map((_, i) => visibleRows.filter((r) => !isShared(r) && r.cells[i] !== null))
	);

	const pxPerSec = $derived(trackW / axisSeconds);
	const ruler = $derived(rulerTicks(axisSeconds, pxPerSec));

	function segmentsFor(lane: CapLane) {
		return lane.host
			? laneSegments(lane.uptime, lane.host.cooldown, axisSeconds)
			: singleWindowSegments(lane.uptime, axisSeconds);
	}

	// ── Words ────────────────────────────────────────────────────────────────

	/** "E 6s · Q 15s · 60 energy" — the column header's cost line. */
	function costLine(i: number): string {
		if (!model) return '';
		const parts: string[] = [];
		for (const row of model.timingRows) {
			const v = row.cells[i];
			if (v === null) continue;
			if (row.key === 'skill-cd') parts.push(`E ${v}`);
			else if (row.key === 'burst-cd') parts.push(`Q ${v}`);
			else parts.push(`${v} energy`);
		}
		return parts.join(' · ');
	}

	/** A lane's cycle, read left to right: its window over its cooldown, the
	 *  cast, its cost. The summon's NAME goes to the second line — on the first
	 *  it pushed the energy cost off the end of the column. */
	function laneCycle(lane: CapLane): string {
		if (!lane.host) return `${lane.uptime}s · per ${lane.perReaction?.join(' / ')}`;
		const cast = lane.host.summonLabel ? lane.host.label.split(' · ')[0] : lane.host.label;
		const parts = [`${lane.uptime}s / ${lane.host.cooldown}s`, cast];
		if (lane.host.energyCost) parts.push(`${lane.host.energyCost} energy`);
		if (lane.host.charges) parts.push(`×${lane.host.charges}`);
		return parts.join(' · ');
	}

	function alsoLine(lane: CapLane): string {
		const also = lane.alsoCarries.map((k) => allRows.find((r) => r.key === k)?.label ?? k);
		const parts = [
			...(lane.host?.summonLabel ? [lane.host.summonLabel] : []),
			...(also.length > 0 ? [`also ${also.join(' · ')}`] : [])
		];
		return parts.join(' — ');
	}

	/** The cell's headline: WHAT, and HOW MUCH. */
	function headline(row: CapRow, cell: CapCell): string {
		const kind = (row.key.startsWith('buff:') ? 'buff' : row.key) as CapabilityKind;
		// A row whose label already names the stat (EM buff, Healing Bonus) does
		// not repeat it; a family row (DMG% buff) says which DMG.
		const named = row.key === 'buff:em' || row.key.startsWith('buff:other:');
		const what = named ? [] : cell.details.map((d) => capDetailText(kind, d));
		// Deduped AFTER formatting: Kazuha's four Swirl bonuses are four stats
		// with one size, and the cell should say the size once.
		const much = [
			...new Set(
				cell.magnitudes
					.map((m) => ('stat' in m ? formatBuffDisplayValue(m.stat, m.value, 0) : `−${m.shred}%`))
					.map(tidyNumbers)
			)
		].join(' / ');
		return [what.join(' · '), much].filter(Boolean).join(' ');
	}

	/** A value authored to five decimals (Secret Rite's 5.71428%) reads to two. */
	function tidyNumbers(text: string): string {
		return text.replace(/\d+\.\d{3,}/g, (n) => String(Math.round(Number(n) * 100) / 100));
	}

	/** The cell's second line: who receives it, for how long, what opens it. */
	function subline(cell: CapCell): string {
		const parts: string[] = [];
		if (cell.target) parts.push(TARGET_SHORT[cell.target] ?? cell.target);
		if (cell.duration !== undefined) parts.push(`${cell.duration}s`);
		if (cell.opensOn.length > 0) parts.push(cell.opensOn.join(' / '));
		return parts.join(' · ');
	}

	const SECTION_WORD: Record<CapabilitySection, string> = {
		ability: '',
		passive: 'passive',
		constellation: 'constellation',
		factionBonus: 'team bonus'
	};

	// ── Inline provenance (touch reaches it — a title= never did) ──────────
	const expanded = new SvelteSet<string>();
	function toggleExpanded(key: string) {
		if (expanded.has(key)) expanded.delete(key);
		else expanded.add(key);
	}

	// ── Crosshair ─────────────────────────────────────────────────────────────
	// "At nine seconds in, who is still healing?" — the stacked geometry's one
	// interaction. One per block, since a block's lanes share an axis.
	let cross = $state<{ row: string; x: number } | null>(null);
	function trackPointer(row: string, event: PointerEvent) {
		const track = event.currentTarget as HTMLElement;
		const x = event.clientX - track.getBoundingClientRect().left;
		cross = x >= 0 && x <= trackW ? { row, x } : null;
	}

	const modeLine = $derived(
		conMode === 'mine' ? 'at your constellations' : `at ${conMode.toUpperCase()}`
	);

	// ── + Add ────────────────────────────────────────────────────────────────
	let addQuery = $state('');
	const addResults = $derived(
		addQuery.trim().length === 0
			? []
			: searchCharacterIndex(addQuery, 12)
					.filter((e) => !ids.includes(e.id))
					.slice(0, 8)
	);
	const canAdd = $derived(onAdd !== undefined && ids.length < MAX_COMPARE);

	// ── In your rotation ─────────────────────────────────────────────────────
	/** One line per contribution any read reports: the team's uptime with the
	 *  incumbent (the same in every read — it is the rotation as written) and
	 *  with each candidate. */
	const rotationLines = $derived.by(() => {
		if (!rotationReads) return [];
		const lines: Record<string, { label: string; before: number; after: Record<string, number> }> =
			{};
		for (const [id, read] of Object.entries(rotationReads)) {
			for (const row of read?.rows ?? []) {
				lines[row.key] ??= { label: row.label, before: row.before, after: {} };
				lines[row.key].after[id] = row.after;
			}
		}
		return Object.entries(lines).map(([key, l]) => ({ key, ...l }));
	});
	const rotationPending = $derived(
		!!rotationReads && columns.some((c, i) => i !== anchorIndex && !(c.id in (rotationReads ?? {})))
	);
	const rotationAbsent = $derived(
		!!rotationReads &&
			Object.keys(rotationReads).length > 0 &&
			Object.values(rotationReads).every((r) => r === null)
	);
	const pct = (x: number) => `${Math.round(x * 100)}%`;

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
     is a ROLE, and a portrait backing must not follow its surroundings. -->
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

<!-- One character's entry in a block: what, how much, for how long — and,
     on a click, where it comes from. -->
{#snippet factCell(row: CapRow, i: number)}
	{@const cell = row.cells[i]}
	{@const col = columns[i]}
	{#if cell === null}
		<div class="cmp-fact cmp-fact--none">
			<span class="cmp-fact-who">{@render avatarDisc(col.id, col.name, col.color, 18)}</span>
			<span class="cmp-none">{col.entry && !col.entry.curated ? 'unknown' : '—'}</span>
		</div>
	{:else}
		{@const key = `${row.key}:${col.id}`}
		{@const locked = cell.minCon > viewCons[i]}
		{@const deltas = refIndex >= 0 && refIndex !== i ? factDelta(row.cells[refIndex], cell) : []}
		<div class="cmp-fact" class:cmp-fact--locked={locked}>
			<span class="cmp-fact-who">{@render avatarDisc(col.id, col.name, col.color, 18)}</span>
			<button
				class="cmp-fact-body"
				aria-expanded={expanded.has(key)}
				onclick={() => toggleExpanded(key)}
			>
				<span class="cmp-fact-head">
					{#if cell.minCon > 0}<span class="cmp-gate"
							>C{cell.minCon}{#if locked}<Mark name="gated" size={11} />{/if}</span
						>{/if}
					{#if headline(row, cell)}
						<span class="cmp-fact-what">{headline(row, cell)}</span>
					{:else}
						<!-- A capability with nothing to size (a pull, a cleanse): it is
						     THERE, and a mark says so — never a unicode ✓. -->
						<span class="cmp-fact-what cmp-fact-yes" aria-label="Yes"
							><Mark name="check" size={13} /></span
						>
					{/if}
				</span>
				<span class="cmp-fact-sub">{subline(cell)}</span>
				{#if cell.conditional && cell.caveats.length > 0}
					<span class="cmp-fact-cond">{cell.caveats.map(caveatText).join(' · ')}</span>
				{/if}
				{#if cell.also}
					<span class="cmp-fact-cond"
						>{TARGET_SHORT[cell.also.target]} from C{cell.also.minCon}</span
					>
				{/if}
				{#if deltas.length > 0}
					<span class="cmp-delta" title="Compared with {columns[refIndex].name}"
						>{deltas.join(' · ')}</span
					>
				{/if}
			</button>
			{#if expanded.has(key)}
				<ul class="cmp-prov">
					{#each cell.provenance as p, j (j)}
						<li>
							<span class="cmp-prov-name"
								>{p.source.abilityName}{#if p.source.variant}
									({p.source.variant}){/if}</span
							>
							{#if SECTION_WORD[p.source.section]}<span class="cmp-prov-section"
									>{SECTION_WORD[p.source.section]}</span
								>{/if}
							{#if p.target}<span>{TARGET_LABEL[p.target]}</span>{/if}
							{#each p.caveats as c (c)}<span class="cmp-prov-cond">{caveatText(c)}</span>{/each}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
{/snippet}

<!-- An effect's lanes on one shared ruler. -->
{#snippet lanesFor(row: CapRow, laneFilter: (lane: CapLane) => boolean)}
	{@const lanes = row.lanes.filter(laneFilter)}
	{#if lanes.length > 0}
		<div class="cmp-ruler-row" aria-hidden="true">
			<div></div>
			<div class="cmp-ruler">
				{#each ruler as tick (tick.t)}
					<span class="cmp-rtick" class:cmp-rtick--major={tick.major} style:left="{tick.x}px">
						{#if tick.major}<span class="cmp-rtick-label">{tick.t}s</span>{/if}
					</span>
				{/each}
			</div>
		</div>
		<div class="cmp-lanes">
			<div
				class="cmp-crosshair-zone"
				onpointermove={(e) => trackPointer(row.key, e)}
				onpointerleave={() => (cross = null)}
				aria-hidden="true"
			></div>
			{#if cross?.row === row.key}
				<div class="cmp-crosshair" style:left="{cross.x}px">
					<span class="cmp-crosshair-tag">{(cross.x / pxPerSec).toFixed(1)}s</span>
				</div>
			{/if}
			{#each lanes as lane (lane.key + ':' + lane.columnIndex)}
				{@const col = columns[lane.columnIndex]}
				{@const locked = lane.minCon > viewCons[lane.columnIndex]}
				<div class="cmp-lane" style:--el-color={col.color}>
					{@render avatarDisc(col.id, col.name, col.color, LANE_GUTTER)}
					<CompareBar
						segments={segmentsFor(lane)}
						ticks={lane.ticks ?? []}
						bar={col.bar}
						scaleSeconds={axisSeconds}
						trackWidthPx={trackW}
						{locked}
					/>
					<span class="cmp-lane-fact">
						<span class="cmp-lane-cycle"
							>{laneCycle(lane)}{#if locked}<Mark name="gated" size={11} />{/if}</span
						>
						{#if alsoLine(lane)}
							<span class="cmp-lane-also">{alsoLine(lane)}</span>
						{/if}
					</span>
				</div>
			{/each}
		</div>
	{/if}
{/snippet}

<section
	class="cmp"
	aria-label={anchorId ? 'Audition replacements' : 'Compare characters'}
	style:--cols={ids.length}
>
	<header class="cmp-titlebar">
		<h2>{anchorId ? 'Audition' : 'Compare'}</h2>
		<p class="cmp-mode">{modeLine}</p>
		{#if onCancelAudition}
			<button class="btn cmp-headact" onclick={onCancelAudition}>
				<Mark name="close" /> Cancel audition
			</button>
			<!-- ⚠ Its OWN class: two same-class buttons in one header is the
			     Playwright strict-mode trap this repo has already paid for. -->
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

	<!-- ── The columns: one glass plate, outside the scroller ─────────────── -->
	<div class="panel ctx-glass cmp-cols" class:cmp-cols--add={canAdd}>
		{#each columns as col, i (col.id)}
			{@const isRef = i === refIndex}
			<div
				class="cmp-col"
				class:cmp-ref={i === anchorIndex}
				class:cmp-col--ref={isRef}
				style:--el-color={col.color}
			>
				{@render avatarDisc(col.id, col.name, col.color, 34)}
				<span class="cmp-col-body">
					{#if i === anchorIndex}
						<span class="cmp-ref-role"
							>{auditionSlot !== undefined ? `In slot ${auditionSlot + 1}` : 'In the slot'}</span
						>
					{:else if isRef}
						<span class="cmp-ref-role">Reference</span>
					{/if}
					<span class="cmp-col-name"
						>{col.name}{#if $ownership[col.id] === 'wishlist'}<span
								class="cmp-col-wish"
								title="Wishlisted"><Mark name="star" size={11} /></span
							>{/if}</span
					>
					<span class="cmp-col-meta">
						{col.entry?.element ?? '?'} · {col.entry?.weapon ?? '?'}
						{#if conMode === 'mine'}· C{$constellations[col.id] ?? 0}{/if}
						{#if col.entry && !col.entry.curated}· <span class="cmp-col-stub">not curated</span
							>{/if}
					</span>
					<span class="cmp-col-cost">{costLine(i)}</span>
					{#if teamDeltas?.[col.id]}
						{@const d = teamDeltas[col.id]}
						{#if d.gained.length + d.lost.length === 0 && !d.resonance}
							<span class="cmp-col-delta cmp-col-delta--same">Team covers the same</span>
						{:else}
							{#if d.gained.length > 0}
								<span class="cmp-col-delta">+ {d.gained.join(' · ')}</span>
							{/if}
							{#if d.lost.length > 0}
								<span class="cmp-col-delta">− {d.lost.join(' · ')}</span>
							{/if}
							{#if d.resonance}
								<span class="cmp-col-delta"
									>{d.resonance.before.join(' + ') || 'No resonance'} → {d.resonance.after.join(
										' + '
									) || 'no resonance'}</span
								>
							{/if}
						{/if}
					{/if}
				</span>
				<span class="cmp-col-acts">
					{#if onCommit && i !== anchorIndex}
						<!-- ⚓ The commit lives on the COMPARED column: you commit what
						     you have looked at, never from a browsing pill. -->
						<button
							class="btn btn--primary cmp-take"
							onclick={() => onCommit(col.id)}
							title="Put {col.name} in {auditionSlot !== undefined
								? `slot ${auditionSlot + 1}`
								: 'the slot'}">Replace {anchorIndex >= 0 ? columns[anchorIndex].name : ''}</button
						>
					{/if}
					{#if anchorIndex < 0 && ids.length > 1}
						<button
							class="cmp-col-btn cmp-pin"
							class:is-active={isRef}
							aria-pressed={isRef}
							onclick={() => (pinnedId = isRef ? null : col.id)}
							aria-label={isRef
								? `Stop comparing against ${col.name}`
								: `Compare everyone against ${col.name}`}
							title={isRef
								? 'Stop comparing against this column'
								: 'Compare everyone against this column'}><Mark name="pin" size={13} /></button
						>
					{/if}
					{#if i !== anchorIndex}
						<button
							class="cmp-col-btn cmp-chip-remove"
							onclick={() => onRemove(col.id)}
							aria-label="Remove {col.name} from comparison"
							title="Remove from comparison"><Mark name="close" size={13} /></button
						>
					{/if}
				</span>
			</div>
		{/each}
		{#if canAdd}
			<div class="cmp-add">
				<BandMenu label="Add" mark="plus" role="dialog" ariaLabel="Add a character to compare">
					{#snippet items(close)}
						<div class="cmp-add-panel">
							<input
								class="cmp-add-input"
								type="search"
								placeholder="Find a character…"
								bind:value={addQuery}
								aria-label="Find a character"
							/>
							{#if addResults.length > 0}
								<ul class="cmp-add-list">
									{#each addResults as e (e.id)}
										<li>
											<button
												class="cmp-add-pick"
												onclick={() => {
													onAdd?.(e.id);
													addQuery = '';
													close();
												}}
											>
												{@render avatarDisc(
													e.id,
													e.displayName,
													elementPalette(e.element).main,
													22
												)}
												{e.displayName}
											</button>
										</li>
									{/each}
								</ul>
							{:else if addQuery.trim().length > 0}
								<p class="cmp-add-empty">No match.</p>
							{/if}
						</div>
					{/snippet}
				</BandMenu>
			</div>
		{/if}
	</div>

	<div class="cmp-body scroll-fade" use:scrollFade bind:clientWidth={bodyW}>
		{#if candidatesArea}
			{@render candidatesArea()}
		{/if}

		{#if !model}
			<p class="cmp-loading">Loading kit data…</p>
		{:else}
			<!-- ── Apparatus: glass. The axis and the lens. ─────────────────── -->
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
					{#if elementLens}
						<span class="cmp-ctrl-label" id="cmp-lens-label">Element</span>
						<div class="cmp-lenses" role="group" aria-labelledby="cmp-lens-label">
							{#each LENS_ELEMENTS as el (el)}
								<button
									class="chip chip--sm chip--element"
									class:active={elementLenses.has(el)}
									style:--chip-color={elementPalette(el).main}
									aria-pressed={elementLenses.has(el)}
									onclick={() => toggleElementLens(el)}>{el}</button
								>
							{/each}
						</div>
					{:else if lensChips.length > 0}
						<span class="cmp-ctrl-label" id="cmp-lens-label">Show</span>
						<div class="cmp-lenses" role="group" aria-labelledby="cmp-lens-label">
							{#each lensChips as chip (chip.key)}
								<button
									class="chip chip--sm"
									class:active={lenses.has(chip.key as CapRowKey)}
									aria-pressed={lenses.has(chip.key as CapRowKey)}
									onclick={() => toggleLens(chip.key)}>{chip.label}</button
								>
							{/each}
						</div>
					{/if}
				</div>
			</div>
			{#if elementLens}
				<p class="note cmp-fallback-note">
					{columns[anchorIndex]?.name ?? 'This slot'} has no team-facing capability to match candidates
					on, so candidates are matched on element instead.
				</p>
			{/if}

			{#if rotationReads && anchorIndex >= 0 && columns.length > 1}
				<!-- ── In your rotation: the planner's parse, not the chart's claim ── -->
				<section class="cmp-block cmp-rot">
					<h3 class="cmp-group">In your rotation</h3>
					{#if rotationAbsent}
						<p class="cmp-rot-note">
							Write a rotation in the Rotation Planner to see how each swap plays in it.
						</p>
					{:else}
						<p class="cmp-rot-note">
							How much of your rotation the team has each effect, with each character in the slot —
							at the planner's constellations.
						</p>
						{#if rotationPending && rotationLines.length === 0}
							<p class="cmp-rot-note">Reading your rotation…</p>
						{/if}
						{#each rotationLines as line (line.key)}
							<div class="cmp-rot-row">
								<span class="cmp-rot-label">{line.label}</span>
								<div class="cmp-facts">
									{#each columns as col, i (col.id)}
										<div class="cmp-fact">
											<span class="cmp-fact-who"
												>{@render avatarDisc(col.id, col.name, col.color, 18)}</span
											>
											<span class="cmp-fact-what cmp-rot-val">
												{#if i === anchorIndex}
													{pct(line.before)}
												{:else if col.id in line.after}
													{pct(line.after[col.id])}
												{:else if col.id in (rotationReads ?? {})}
													{pct(0)}
												{:else}
													…
												{/if}
											</span>
										</div>
									{/each}
								</div>
							</div>
						{/each}
						{#if columns.some((c) => (rotationReads?.[c.id]?.approximated ?? 0) > 0)}
							<div class="cmp-facts">
								{#each columns as col (col.id)}
									{@const n = rotationReads?.[col.id]?.approximated ?? 0}
									<div class="cmp-fact">
										{#if n > 0}
											<span class="cmp-fact-cond"
												>{n} of {col.name}'s actions {n === 1 ? 'is' : 'are'} timed as a stand-in</span
											>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					{/if}
				</section>
			{/if}

			<div
				class="cmp-blocks"
				style:--track-w="{trackW}px"
				style:--gutter="{LANE_GUTTER}px"
				style:--fact-w="{LANE_FACT_W}px"
				style:--lane-gap="{LANE_GAP}px"
			>
				{#if allRows.length === 0}
					<p class="cmp-empty">Nothing team-facing derives from these kits.</p>
				{:else if visibleRows.length === 0}
					<p class="cmp-empty">Every effect is hidden — turn a chip back on.</p>
				{/if}

				{#each sharedRows as row (row.key)}
					<section class="cmp-block">
						<h3 class="cmp-group">{row.label}</h3>
						<div class="cmp-facts">
							{#each columns as col, i (col.id)}
								{@render factCell(row, i)}
							{/each}
						</div>
						{@render lanesFor(row, () => true)}
					</section>
				{/each}

				{#each columns as col, i (col.id)}
					{#if uniqueRows[i].length > 0}
						<section class="cmp-only" style:--el-color={col.color}>
							<h3 class="cmp-only-head">
								{@render avatarDisc(col.id, col.name, col.color, 22)}
								Only {col.name}
							</h3>
							{#each uniqueRows[i] as row (row.key)}
								<div class="cmp-only-row">
									<span class="cmp-only-label">{row.label}</span>
									{@render factCell(row, i)}
								</div>
								{@render lanesFor(row, (l) => l.columnIndex === i)}
							{/each}
						</section>
					{/if}
				{/each}
			</div>

			<p class="note cmp-footnote">
				A bar is one cast's effect, repeated each time the cast comes back — energy isn't modeled,
				so a burst's repeats are a best case. A window a reaction opens is drawn once. Ticks are a
				summon's hits over its first window. Select an entry to see where it comes from.
			</p>
		{/if}
	</div>
</section>

<style>
	/* The view FILLS the source box and scrolls INSIDE itself, so the column
	   header stays put (see the header comment for why it is not sticky). */
	.cmp {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		flex: 1;
		min-height: 0;
		min-width: 0;
		font-family: var(--font-body);
		color: var(--text);
	}
	.cmp-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		min-width: 0;
	}

	/* ── Title bar ────────────────────────────────────────────── */
	.cmp-titlebar {
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
		flex-wrap: wrap;
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
		margin: 0;
		max-width: 62rem;
		font-size: var(--fs-sm);
		color: var(--chart-dim);
	}

	/* ── Portrait discs ───────────────────────────────────────── */
	/* ⚓ NATE 2026-08-11: opaque — they layer and stack. ONE ground, only the
	   element travels. ⛔ Never --bg. */
	.cmp-disc {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
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

	/* ── The column header: one glass plate ───────────────────── */
	.cmp-cols {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: 0.5rem;
		padding: 0.5rem;
		flex-shrink: 0;
	}
	.cmp-cols--add {
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr)) auto;
	}
	.cmp-col {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		min-width: 0;
		padding: 0.35rem 0.4rem 0.35rem 0.5rem;
		border-left: 3px solid var(--el-color);
		border-radius: var(--r-sm);
	}
	/* The reference column: gold names the BLOCK it is (a reference), never a
	   word inside it. */
	.cmp-col--ref {
		box-shadow: inset 0 0 0 1px var(--inset-line);
	}
	.cmp-col-body {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
		line-height: var(--lh-tight);
		gap: 2px;
	}
	.cmp-ref-role {
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--accent);
	}
	.cmp-col-name {
		font-family: var(--font-display);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.cmp-col-wish {
		margin-left: 0.25rem;
		color: var(--accent);
	}
	.cmp-col-meta,
	.cmp-col-cost {
		font-size: var(--fs-xs);
		color: var(--chart-ink);
		text-transform: capitalize;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.cmp-col-cost {
		text-transform: none;
		font-variant-numeric: tabular-nums;
	}
	/* ⚠ A swap's team delta is a FACT: neutral ink, never good/bad colour — a
	   "lost" line is not a warning, it is what the swap costs. */
	.cmp-col-delta {
		font-size: var(--fs-xs);
		color: var(--text);
		white-space: normal;
	}
	.cmp-col-delta--same {
		color: var(--chart-dim);
	}
	/* ↻ 2026-08-12: --ui-provisional — a data-quality state, not a domain colour. */
	.cmp-col-stub {
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		color: color-mix(in srgb, var(--ui-provisional) 80%, var(--chart-ink));
	}
	.cmp-col-acts {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.3rem;
		flex-shrink: 0;
	}
	.cmp-col-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		padding: 3px;
		border-radius: var(--r-sm);
		color: var(--chart-dim);
		cursor: pointer;
		transition: color var(--t-snap);
	}
	.cmp-col-btn:hover,
	.cmp-col-btn.is-active {
		color: var(--text);
	}
	.cmp-pin.is-active {
		color: var(--accent);
	}
	.cmp-take {
		white-space: nowrap;
	}
	.cmp-add {
		display: flex;
		align-items: center;
	}
	.cmp-add-panel {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.4rem;
		min-width: 14rem;
	}
	.cmp-add-input {
		width: 100%;
	}
	.cmp-add-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.cmp-add-pick {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		width: 100%;
		padding: 0.25rem 0.35rem;
		background: none;
		border: none;
		border-radius: var(--r-sm);
		color: var(--text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.cmp-add-pick:hover,
	.cmp-add-pick:focus-visible {
		background: var(--accent-hover-fill);
	}
	.cmp-add-empty {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--chart-dim);
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
	.cmp-lenses .chip--element {
		text-transform: capitalize;
	}
	.cmp-fallback-note {
		margin: -0.35rem 0 0;
		font-size: var(--fs-sm);
		color: var(--chart-dim);
	}

	/* ── Blocks ───────────────────────────────────────────────── */
	.cmp-blocks {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		min-width: 0;
	}
	.cmp-block,
	.cmp-only {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		min-width: 0;
	}
	.cmp-group,
	.cmp-only-head {
		margin: 0;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		color: var(--text);
	}
	.cmp-only-head {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding-top: 0.4rem;
		border-top: 1px solid var(--chart-grid);
	}
	.cmp-rot {
		padding: 0.6rem 0.5rem 0.7rem;
		border-radius: var(--r-sm);
		box-shadow: inset 0 0 0 1px var(--chart-grid);
	}
	.cmp-rot-note {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--chart-ink);
	}
	.cmp-rot-row {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.cmp-rot-label {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--chart-ink);
	}
	.cmp-rot-val {
		font-size: var(--fs-md);
	}
	.cmp-only-row {
		display: grid;
		grid-template-columns: 9rem minmax(0, 1fr);
		gap: 0.6rem;
		align-items: baseline;
	}
	.cmp-only-label {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--chart-ink);
	}

	/* A block's facts: the SAME columns as the header plate above. */
	.cmp-facts {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: 0.5rem;
		padding: 0 0.5rem;
	}
	.cmp-fact {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		padding-left: calc(0.5rem + 3px);
	}
	/* The disc beside each fact only appears when the columns STACK (narrow),
	   where position no longer says whose entry it is. */
	.cmp-fact-who {
		display: none;
	}
	.cmp-fact-body {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		min-width: 0;
		padding: 0;
		background: none;
		border: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.cmp-fact-body:hover .cmp-fact-what,
	.cmp-fact-body[aria-expanded='true'] .cmp-fact-what {
		text-decoration: underline;
		text-decoration-color: var(--chart-dim);
		text-underline-offset: 3px;
	}
	.cmp-fact-head {
		display: inline-flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.cmp-fact-what {
		font-size: var(--fs-sm);
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.cmp-fact-sub,
	.cmp-fact-cond {
		font-size: var(--fs-xs);
		color: var(--chart-ink);
	}
	.cmp-fact-cond {
		font-style: italic;
		color: var(--chart-dim);
	}
	/* ⚠ A delta is a FACT, never a verdict: neutral ink, never good/bad colour. */
	.cmp-delta {
		font-size: var(--fs-xs);
		color: var(--chart-ink);
		font-variant-numeric: tabular-nums;
	}
	.cmp-fact--locked .cmp-fact-what,
	.cmp-fact--locked .cmp-fact-sub {
		color: var(--chart-dim);
	}
	.cmp-none {
		font-size: var(--fs-sm);
		color: var(--chart-dim);
	}
	.cmp-fact-yes {
		display: inline-flex;
		color: var(--chart-ink);
	}
	.cmp-gate {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 0 5px;
		border-radius: 3px;
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		color: var(--chart-ink);
		box-shadow: inset 0 0 0 1px var(--chart-grid);
	}
	.cmp-prov {
		list-style: none;
		margin: 0.2rem 0 0;
		padding: 0.3rem 0 0 0.5rem;
		border-left: 1px solid var(--chart-grid);
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: var(--fs-xs);
		color: var(--chart-ink);
	}
	.cmp-prov li {
		display: flex;
		flex-wrap: wrap;
		gap: 0.1rem 0.45rem;
	}
	.cmp-prov-name {
		color: var(--text);
	}
	.cmp-prov-section,
	.cmp-prov-cond {
		font-style: italic;
		color: var(--chart-dim);
	}

	/* ── Lanes ────────────────────────────────────────────────── */
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
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.cmp-crosshair-zone {
		position: absolute;
		top: 0;
		bottom: 0;
		left: calc(var(--gutter) + var(--lane-gap));
		width: var(--track-w);
		z-index: 4;
	}
	/* ⛔ No transition: it tracks the pointer, and a ramp on a hairline smears. */
	.cmp-crosshair {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		margin-left: calc(var(--gutter) + var(--lane-gap));
		background: var(--chart-rule);
		pointer-events: none;
		z-index: 5;
	}
	.cmp-crosshair-tag {
		position: absolute;
		top: -2px;
		left: 3px;
		padding: 0 4px;
		border-radius: 2px;
		background: var(--glass-bar);
		color: var(--text);
		font-size: var(--fs-xs);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.cmp-lane-fact {
		display: flex;
		flex-direction: column;
		min-width: 0;
		line-height: var(--lh-tight);
	}
	.cmp-lane-cycle {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: var(--fs-sm);
		color: var(--chart-ink);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.cmp-lane-also {
		font-size: var(--fs-xs);
		color: var(--chart-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.cmp-empty,
	.cmp-loading {
		margin: 0;
		padding: 0.6rem 0;
		color: var(--chart-ink);
	}

	/* ── Narrow (literal: `compact`, 40rem — $lib/breakpoints.ts) ───────────
	   The columns stop being columns: the header wraps two-up, each block's
	   facts become a list with a disc per entry, and a lane's fact line moves
	   under its bar. */
	@media (max-width: 40rem) {
		/* One character per line, actions on the line's end. */
		.cmp-cols,
		.cmp-cols--add {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.25rem;
		}
		.cmp-col {
			align-items: center;
		}
		.cmp-col-acts {
			flex-direction: row;
			align-items: center;
		}
		.cmp-add {
			justify-content: flex-end;
		}
		.cmp-facts {
			grid-template-columns: minmax(0, 1fr);
			padding: 0;
		}
		.cmp-fact {
			flex-direction: row;
			align-items: flex-start;
			gap: 0.45rem;
			padding-left: 0;
		}
		.cmp-fact-who {
			display: block;
		}
		.cmp-ruler-row,
		.cmp-lane {
			grid-template-columns: var(--gutter) var(--track-w);
		}
		.cmp-lane-fact {
			grid-column: 2;
		}
		.cmp-only-row {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.2rem;
		}
	}
</style>
