<script lang="ts">
	/**
	 * AN IMAGINARIUM THEATER LINEUP — the right pane (⚓ Nate 2026-11-11): the
	 * game's Party Setup screen, as closely as our materials allow. The grid on
	 * the left is the Alternate Cast; this is everything to its right:
	 *
	 *   · Primary Antagonists — the mode's boss acts, and Lunar's two Arcanum
	 *     Challenges after a divider;
	 *   · the cast so far — the six Opening Characters, then the picks in
	 *     order, then a friend's character when one is counted;
	 *   · Stats — the cast by element and by role, the Opening Characters
	 *     included, as the game counts them;
	 *   · the extra members' line and what they bring (Fantasia Flowers and
	 *     Blessing Levels), or what the mode still asks for.
	 *
	 * The season and the mode are chosen in band B, over this pane. The rules:
	 * `docs/library/game/imaginarium-theater.md`; the arithmetic: `$lib/theater`.
	 */
	import Mark from '$lib/components/Mark.svelte';
	import SidePortrait from '$lib/components/SidePortrait.svelte';
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { functionIcon, positionIcon } from '$lib/utils/roleIcons';
	import { inLang, monsterImage } from '$lib/endgame';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import {
		FLOWERS_PER_EXTRA,
		OPENING_CAST,
		blessingStats,
		castStats,
		modeVerdicts,
		type TheaterModeRules,
		type TheaterSeason
	} from '$lib/theater';
	import type { Element } from '$lib/types/ability';

	let {
		season,
		rules,
		cast,
		invite,
		onInvite,
		onRemove
	}: {
		season: TheaterSeason;
		rules: TheaterModeRules;
		/** The picks that count (owned, not marked), in order. */
		cast: readonly string[];
		invite: boolean;
		onInvite: () => void;
		onRemove: (id: string) => void;
	} = $props();

	const verdict = $derived(
		modeVerdicts(season, cast.length, { invite }).find((v) => v.mode === rules.mode)!
	);
	const stats = $derived(castStats([...season.opening, ...cast]));
	const blessing = $derived(blessingStats(verdict.blessingLevels));
	/** The game's element order on this row: the season's own three. */
	const elements = $derived(season.elements.filter((e) => stats.elements[e as Element]));
	const fmt = (n: number) => n.toLocaleString('en-US');
	const ROMAN = ['I', 'II', 'III'];
	const nameOf = (id: string) => getCharacterIndexEntry(id)?.displayName ?? id;
</script>

<div class="th panel panel--paper">
	<section class="th-sec">
		<h3 class="kicker">Primary Antagonists</h3>
		<div class="th-foes">
			{#each rules.bosses as b (b.act)}
				<figure class="th-foe" title={inLang(b.name)}>
					<img class="th-foe-disc" src={monsterImage(b.icons[0])} alt={inLang(b.name)} />
					<figcaption>Lv. {b.level}</figcaption>
				</figure>
			{/each}
			{#if rules.arcana.length}
				<span class="th-rule" aria-hidden="true"></span>
				{#each rules.arcana as a, i (i)}
					<figure class="th-foe" title={inLang(a.name)}>
						<img class="th-foe-disc" src={monsterImage(a.icons[0])} alt={inLang(a.name)} />
						<figcaption>{ROMAN[i]}</figcaption>
					</figure>
				{/each}
			{/if}
		</div>
	</section>

	<section class="th-sec">
		<header class="th-head">
			<h3 class="kicker">Opening and Alternate Cast members selected</h3>
			<button
				class="btn th-invite"
				class:is-on={invite}
				aria-pressed={invite}
				title={invite
					? 'Counting one Supporting Cast character from a friend'
					: 'Count one Supporting Cast character from a friend'}
				onclick={onInvite}><Mark name="plus" size={12} /> Invite Supporting Cast</button
			>
		</header>
		<div class="th-cast">
			{#each season.opening as id (id)}
				<span class="th-member" title="{nameOf(id)} · Opening Character"
					><SidePortrait {id} size={40} /></span
				>
			{/each}
			<span class="th-plus" aria-hidden="true"><Mark name="plus" size={12} /></span>
			{#each cast as id, i (id)}
				<button
					class="th-member th-pick"
					title="{nameOf(id)} · remove from the cast"
					aria-label="Remove {nameOf(id)} from the cast"
					onclick={() => onRemove(id)}
				>
					<SidePortrait {id} size={40} />
					<span class="th-num">{i + 1}</span>
				</button>
			{/each}
			{#if invite}
				<span class="th-member th-guest" title="Supporting Cast">
					<span class="th-unknown"><Mark name="help" size={18} /></span>
					<span class="th-tag">Supporting Cast</span>
				</span>
			{/if}
		</div>
	</section>

	<section class="th-sec th-stats" aria-label="Stats">
		<span class="th-stats-label">Stats</span>
		{#each elements as e (e)}
			<span class="th-chip"
				><img src={elementIcon(e)} alt={e} /> ×{stats.elements[e as Element]}</span
			>
		{/each}
		<span class="th-rule th-rule--short" aria-hidden="true"></span>
		<span class="th-chip" title="On-Field"
			><img src={positionIcon('onField')} alt="On-Field" /> ×{stats.onField}</span
		>
		<span class="th-chip" title="Off-Field"
			><img src={positionIcon('offField')} alt="Off-Field" /> ×{stats.offField}</span
		>
		<span class="th-rule th-rule--short" aria-hidden="true"></span>
		<span class="th-chip" title="Support"
			><img src={functionIcon('support')} alt="Support" /> ×{stats.support}</span
		>
		<span class="th-chip" title="Survivability"
			><img src={functionIcon('survivability')} alt="Survivability" /> ×{stats.survivability}</span
		>
	</section>

	<section class="th-sec">
		<p class="th-line" class:is-short={!verdict.open}>
			<span>
				{#if verdict.open}
					{verdict.extras}/{rules.extra} extra Alternate Cast members have been added. Buffs based on
					the number of extra members added are obtained
				{:else}
					Add at least {OPENING_CAST + verdict.need} characters to start the show
				{/if}
			</span>
			<span class="th-count" title="Alternate Cast"
				><Mark name="person" size={13} /> {verdict.have}</span
			>
		</p>
		{#if verdict.extras > 0}
			<ul class="th-gains">
				<li>Gain <b>{verdict.extras * FLOWERS_PER_EXTRA}</b> Fantasia Flowers</li>
				<li>
					Gain <b>{verdict.blessingLevels}</b> Blessing Level(s): Increases Max HP by
					<b>{fmt(blessing.hp)}</b>, ATK by <b>{fmt(blessing.atk)}</b>, DEF by
					<b>{fmt(blessing.def)}</b>, and Elemental Mastery by <b>{fmt(blessing.em)}</b>.
				</li>
			</ul>
		{/if}
	</section>
</div>

<style>
	/* 🎛️ The Theater panel's knobs: the boss disc, the cast's side portraits
	   (set on the SidePortrait call, 40), and the gap between sections. */
	.th {
		--th-foe: 52px;
		--th-gap: 1.1rem;
		gap: var(--th-gap);
	}
	.th-sec {
		display: grid;
		gap: 0.55rem;
	}
	.th-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.kicker {
		font-size: var(--fs-md);
	}

	/* ── Primary Antagonists ── */
	.th-foes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}
	.th-foe {
		margin: 0;
		display: grid;
		justify-items: center;
		gap: 0.2rem;
		font-size: var(--fs-sm);
		font-variant-numeric: tabular-nums;
	}
	.th-foe-disc {
		width: var(--th-foe);
		height: var(--th-foe);
		border-radius: var(--r-round);
		background: var(--surface-well);
		object-fit: cover;
	}
	.th-rule {
		align-self: stretch;
		width: 1px;
		margin: 0.25rem 0.1rem 1.2rem;
		background: var(--line-soft);
	}
	.th-rule--short {
		margin: 0.2rem 0.15rem;
	}

	/* ── The cast ── */
	.th-cast {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
	}
	.th-member {
		position: relative;
		display: grid;
		place-items: center;
	}
	.th-pick {
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		border-radius: var(--r-round);
	}
	.th-pick:hover {
		background: var(--fill-rest);
	}
	.th-num {
		position: absolute;
		top: -2px;
		right: -2px;
		min-width: 16px;
		padding: 0 3px;
		border-radius: var(--r-round);
		background: var(--accent);
		color: var(--surface);
		font-size: 10px;
		font-weight: var(--fw-bold);
		line-height: 16px;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.th-plus {
		display: grid;
		place-items: center;
		width: 18px;
		color: var(--muted);
	}
	.th-guest {
		gap: 2px;
	}
	.th-unknown {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: var(--r-round);
		background: var(--surface-well);
		color: var(--text);
	}
	.th-tag {
		position: absolute;
		top: -8px;
		padding: 0 4px;
		border-radius: 3px;
		background: var(--accent);
		color: var(--surface);
		font-size: 9px;
		font-weight: var(--fw-bold);
		white-space: nowrap;
	}
	.th-invite {
		font-size: var(--fs-sm);
	}
	.th-invite.is-on {
		box-shadow: inset 0 0 0 1px var(--accent);
	}

	/* ── Stats ── */
	.th-stats {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
	}
	.th-stats-label {
		margin-right: 0.3rem;
		font-weight: var(--fw-semibold);
	}
	.th-chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 2px 9px 2px 4px;
		border-radius: var(--r-round);
		background: var(--fill-rest);
		font-variant-numeric: tabular-nums;
		font-size: var(--fs-sm);
	}
	.th-chip img {
		width: 18px;
		height: 18px;
	}

	/* ── The extra members ── */
	/* ⚠ The game paints this line on a yellow band; paper takes no gold fill
	   (.claude/rules/ui.md), so it is the paper's darker card here. */
	.th-line {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		margin: 0;
		padding: 0.6rem 0.75rem;
		border-radius: 3px;
		background: var(--surface-broad);
		box-shadow: inset 3px 0 0 var(--accent);
		font-weight: var(--fw-semibold);
	}
	.th-line.is-short {
		box-shadow: inset 3px 0 0 var(--ui-warning);
	}
	.th-count {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.th-gains {
		margin: 0;
		padding-left: 1.1rem;
		display: grid;
		gap: 0.3rem;
	}
	.th-gains b {
		color: var(--accent);
		font-weight: var(--fw-bold);
	}
</style>
