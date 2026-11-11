<script lang="ts">
	/**
	 * AN IMAGINARIUM THEATER LINEUP — the right pane (⚓ Nate 2026-11-11): the
	 * game's Party Setup screen, in the board's own grammar. ↻ The game's is
	 * parchment; ours stands on the NIGHT, as the Stygian and Abyss boards do
	 * (Nate): each section's HEADER is glass, and what it heads stands on the
	 * night under it (BoardView's `.bv-team-head`).
	 *
	 *   · Primary Antagonists — the mode's boss acts, and Lunar's two Arcanum
	 *     Challenges after a divider;
	 *   · the cast — the six Opening Characters, then the picks in order, then
	 *     a friend's character when one is counted. ⚓ Not interactive (Nate):
	 *     picks are made on the grid and with Auto-select and Clear;
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
	import { sideLayout } from '$lib/sidePortrait';
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
		onInvite
	}: {
		season: TheaterSeason;
		rules: TheaterModeRules;
		/** The picks that count (owned, not marked), in order. */
		cast: readonly string[];
		invite: boolean;
		/** Count or drop a friend's character; false when refused (a full cast). */
		onInvite: () => boolean;
	} = $props();

	/** 🎛️ The cast's side portraits: the DISC's diameter. The art rises over
	 *  it (hair, ears), so the row aligns on the disc, never the box. */
	const DISC = 40;
	const overhang = sideLayout(DISC).overhang;

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

	/** A refused invite nudges its button, as a full team's card does. */
	let nudged = $state(false);
	function invitePress(): void {
		if (onInvite()) return;
		nudged = false;
		requestAnimationFrame(() => (nudged = true));
	}
</script>

<div class="th" style:--th-disc="{DISC}px" style:--th-overhang="{overhang}px">
	<section class="th-sec">
		<header class="th-head ctx-glass"><h3 class="th-title">Primary Antagonists</h3></header>
		<div class="th-body th-foes">
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
		<header class="th-head ctx-glass">
			<h3 class="th-title">Opening and Alternate Cast members selected</h3>
			<button
				class="btn btn--sm th-invite"
				class:is-on={invite}
				class:is-nudged={nudged}
				aria-pressed={invite}
				title={invite
					? 'Counting one Supporting Cast character from a friend'
					: 'Count one Supporting Cast character from a friend'}
				onanimationend={() => (nudged = false)}
				onclick={invitePress}><Mark name="plus" size={12} /> Invite Supporting Cast</button
			>
		</header>
		<div class="th-body th-cast">
			<!-- The Opening Characters in one pill hugging their rings (the hair
			     rises over it), so the six read as the game's own. -->
			<span class="th-opening">
				{#each season.opening as id (id)}
					<span class="th-member" title="{nameOf(id)} · Opening Character"
						><SidePortrait {id} size={DISC} /></span
					>
				{/each}
			</span>
			<span class="th-plus" aria-hidden="true"><Mark name="plus" size={12} /></span>
			{#each cast as id (id)}
				<span class="th-member" title={nameOf(id)}><SidePortrait {id} size={DISC} /></span>
			{/each}
			{#if invite}
				<span class="th-plus" aria-hidden="true"><Mark name="plus" size={12} /></span>
				<!-- The game's blank side portrait, tagged as the game tags it. -->
				<span class="th-member th-guest" title="Supporting Cast">
					<SidePortrait id={null} size={DISC} />
					<span class="th-tag">Supporting Cast</span>
				</span>
			{/if}
		</div>
	</section>

	<section class="th-sec">
		<header class="th-head ctx-glass"><h3 class="th-title">Stats</h3></header>
		<div class="th-body th-stats">
			{#each elements as e (e)}
				<span class="th-chip ctx-glass"
					><img src={elementIcon(e)} alt={e} /> ×{stats.elements[e as Element]}</span
				>
			{/each}
			<span class="th-rule th-rule--short" aria-hidden="true"></span>
			<span class="th-chip ctx-glass" title="On-Field"
				><img src={positionIcon('onField')} alt="On-Field" /> ×{stats.onField}</span
			>
			<span class="th-chip ctx-glass" title="Off-Field"
				><img src={positionIcon('offField')} alt="Off-Field" /> ×{stats.offField}</span
			>
			<span class="th-rule th-rule--short" aria-hidden="true"></span>
			<span class="th-chip ctx-glass" title="Support"
				><img src={functionIcon('support')} alt="Support" /> ×{stats.support}</span
			>
			<span class="th-chip ctx-glass" title="Survivability"
				><img src={functionIcon('survivability')} alt="Survivability" />
				×{stats.survivability}</span
			>
		</div>
	</section>

	<section class="th-sec th-body">
		<p class="th-line ctx-glass" class:is-short={!verdict.open}>
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
	/* 🎛️ The Theater pane's knobs: the boss disc and the gaps (the cast's
	   disc is DISC, above). The board's own rhythm (BoardView's .bv,
	   .bv-team, .bv-body). */
	.th {
		--th-foe: 52px;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 0 0 1.5rem;
	}
	.th-sec {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	/* The glass strip — BoardView's .bv-team-head, in its voice. */
	.th-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.65rem 0.75rem 0.65rem 1rem;
		border-radius: var(--r-sm);
		background: var(--surface);
	}
	.th-title {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
		line-height: 1.4;
		color: var(--text);
	}
	/* What a strip heads stands on the night, inset as the board's rows are. */
	.th-body {
		padding: 0 0.6rem 0 1rem;
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
		color: var(--text);
	}
	/* The Stygian boss disc's frame (BoardView's .bv-boss), with no hover:
	   these open nothing. */
	.th-foe-disc {
		box-sizing: border-box;
		width: var(--th-foe);
		height: var(--th-foe);
		border: 2px solid var(--line-faint);
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
	/* ⚓ Aligned on the DISC (Nate 2026-11-11): every portrait's box is its
	   disc plus the hair's room above, so the row sits on its bottoms and
	   the + takes the disc's height. */
	.th-cast {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.3rem;
	}
	.th-member {
		position: relative;
		display: block;
	}
	/* 🎛️ The Opening Characters' pill (⚓ Nate 2026-11-11: light glass, round
	   ends hugging the outer avatars). Its ground starts at the rings' top
	   less its padding, so the hair rises over it, as the board's team row
	   frames its rings. --th-pill-pad, --th-pill-fill. */
	.th-opening {
		--th-pill-pad: 3px;
		--th-pill-fill: var(--glass-sheer);
		position: relative;
		display: flex;
		align-items: flex-end;
		gap: 0.3rem;
		padding: var(--th-pill-pad);
	}
	.th-opening::before {
		content: '';
		position: absolute;
		inset: var(--th-overhang) 0 0;
		border-radius: var(--r-round);
		background: var(--th-pill-fill);
	}
	.th-plus {
		display: grid;
		place-items: center;
		width: 18px;
		height: var(--th-disc);
		color: var(--text);
	}
	/* The game's tag over the friend's portrait, centred on the disc's top. */
	.th-tag {
		position: absolute;
		top: calc(var(--th-overhang) - 8px);
		left: 50%;
		transform: translateX(-50%);
		padding: 0 4px;
		border-radius: 3px;
		background: var(--team-hue-first);
		color: var(--surface-well);
		font-size: 9px;
		font-weight: var(--fw-bold);
		line-height: 14px;
		white-space: nowrap;
	}
	.th-invite {
		flex: none;
	}
	.th-invite.is-on {
		box-shadow: inset 0 0 0 1px var(--accent);
	}
	/* The shared nudge (app.css) — it guards reduced motion itself. */
	.th-invite.is-nudged {
		animation: nudge 120ms 2;
	}

	/* ── Stats ── */
	.th-stats {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
	}
	.th-chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 2px 9px 2px 4px;
		border-radius: var(--r-round);
		background: var(--surface);
		color: var(--text);
		font-variant-numeric: tabular-nums;
		font-size: var(--fs-sm);
	}
	.th-chip img {
		width: 18px;
		height: 18px;
	}

	/* ── The extra members ── */
	/* The game's line is a gold band; here a glass card with a gold edge
	   (gold names a block), or the warning edge while the mode is short. */
	.th-line {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		margin: 0;
		padding: 0.6rem 0.75rem;
		border-radius: var(--r-sm);
		background: var(--surface);
		box-shadow: inset 3px 0 0 var(--accent);
		color: var(--text);
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
		color: var(--text);
	}
	.th-gains b {
		font-weight: var(--fw-bold);
	}
</style>
