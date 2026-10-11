<script lang="ts">
	/**
	 * THE MARKS WEIGHT SPECIMEN (⚓ Nate 2026-10-11: "the new border draw style
	 * is really good — that should probably be the default on our Marks").
	 *
	 * TODAY Mark's stroke lives in Lucide's 24-unit grid, so the line that lands
	 * is `MARK_STROKE × size / 24` — 0.79px at 10, 1.11 at 14, 1.43 at 18. The
	 * small marks the site mostly uses draw thin, and a large one goes stubby.
	 *
	 * HELD draws every mark at ONE line width in CSS px, whatever its size, via
	 * `vector-effect: non-scaling-stroke`. That is the shape the change would
	 * take in Mark.svelte: unlike a stroke derived from the `size` prop, it is
	 * also right where CSS sizes the mark (SlotPortrait, CharacterCard).
	 *
	 * This page judges ONE number — the held weight — against today, on every
	 * ground a mark sits on, at every size the site uses. It draws its own SVGs
	 * from MARK_NODES and changes nothing else.
	 */
	import { MARK_NODES, MARK_VIEWBOX, type MarkName } from '$lib/marks.generated';
	import { MARK_SIZE, MARK_STROKE } from '$lib/components/Mark.svelte';

	const NAMES = Object.keys(MARK_NODES) as MarkName[];
	/** Every size a `<Mark>` is drawn at today (a census, 2026-10-11), plus
	 *  the 14 default. */
	const SIZES = [10, 11, 12, 13, 14, 16, 18];
	/** Marks the site draws FILLED (Mark's `filled`), shown filled too. */
	const FILLED: MarkName[] = ['play', 'pause', 'rewind', 'star'];

	/** 🎛️ THE ONE NUMBER: the held line width, CSS px. Starts at today's 14px
	 *  ink, so the default size is unchanged and only the others move. */
	let weight = $state(+((MARK_STROKE * MARK_SIZE) / MARK_VIEWBOX).toFixed(2));
	let filledToo = $state(true);
	const todayInk = (size: number) => (MARK_STROKE * size) / MARK_VIEWBOX;

	const GROUNDS = [
		{ cls: '', label: 'night' },
		{ cls: 'ctx-glass', label: 'glass' },
		{ cls: 'ctx-dark', label: 'dark' }
	];
</script>

{#snippet mk(name: MarkName, size: number, held: boolean, filled = false)}
	<svg
		class="mk"
		class:mk--held={held}
		width={size}
		height={size}
		viewBox="0 0 {MARK_VIEWBOX} {MARK_VIEWBOX}"
		fill={filled ? 'currentColor' : 'none'}
		stroke="currentColor"
		stroke-width={held ? weight : MARK_STROKE}
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#each MARK_NODES[name] as [tag, attrs], i (i)}
			<svelte:element this={tag} {...attrs} />
		{/each}
	</svg>
{/snippet}

<div class="spec">
	<header class="spec-bar ctx-dark">
		<h1 class="spec-title">Mark weight</h1>
		<label class="spec-slider">
			<span>Held line</span>
			<input type="range" min="0.6" max="1.6" step="0.05" bind:value={weight} />
			<strong>{weight.toFixed(2)}px</strong>
		</label>
		<label class="check spec-check"
			><input type="checkbox" bind:checked={filledToo} /> Show filled marks filled</label
		>
		<span class="spec-note"
			>Today: {todayInk(10).toFixed(2)}px at 10 · {todayInk(14).toFixed(2)} at 14 · {todayInk(
				18
			).toFixed(2)} at 18</span
		>
	</header>

	<!-- In context first: a mark is read beside a word, at band sizes. -->
	<section class="spec-ground ctx-glass">
		<p class="kicker">In context — today above, held below</p>
		{#each [false, true] as held (held)}
			<div class="spec-ctx">
				<span class="spec-rowlabel">{held ? 'held' : 'today'}</span>
				<button class="btn btn--sm btn--glass">{@render mk('save', 13, held)} Save</button>
				<button class="btn btn--sm btn--glass">{@render mk('library', 13, held)} Library</button>
				<button class="btn btn--sm btn--glass">{@render mk('share', 13, held)} Share</button>
				<button class="btn btn--sm btn--glass">{@render mk('plus', 12, held)} Add team</button>
				<button class="btn btn--icon btn--glass" aria-label="Undo"
					>{@render mk('undo', 14, held)}</button
				>
				<button class="btn btn--icon btn--glass" aria-label="More"
					>{@render mk('more', 14, held)}</button
				>
				<button class="btn btn--icon btn--glass" aria-label="Play"
					>{@render mk('play', 13, held, true)}</button
				>
				<button class="btn btn--sm btn--glass">{@render mk('filter', 12, held)} More</button>
				<span class="chip">C2 {@render mk('gated', 11, held)}</span>
				<span class="spec-inline">{@render mk('star', 11, held)} Wishlisted</span>
				<span class="spec-inline">{@render mk('uncurated', 10, held)} uncurated</span>
				<span class="spec-big">{@render mk('search', 18, held)}{@render mk('close', 16, held)}</span
				>
			</div>
		{/each}
	</section>

	{#each GROUNDS as g (g.label)}
		<section class="spec-ground {g.cls}" class:spec-ground--bare={!g.cls}>
			<p class="kicker">{g.label}</p>
			<div class="spec-grid" style:--cols={NAMES.length}>
				{#each SIZES as size (size)}
					{#each [false, true] as held (held)}
						<span class="spec-rowlabel" class:spec-rowlabel--held={held}
							>{held ? 'held' : `${size}px`}</span
						>
						{#each NAMES as name (name)}
							<span class="spec-cell" title="{name} · {size}px · {held ? 'held' : 'today'}"
								>{@render mk(name, size, held, filledToo && FILLED.includes(name))}</span
							>
						{/each}
					{/each}
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	/* /lab's own scroller: the scene layout never page-scrolls. */
	.spec {
		position: relative;
		z-index: 1;
		height: 100%;
		overflow-y: auto;
		display: grid;
		align-content: start;
		gap: 1rem;
		padding: 2rem 1.5rem 4rem;
	}
	.spec-bar {
		position: sticky;
		top: 0;
		z-index: 2;
		background: var(--surface);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1.5rem;
		padding: 8px 14px;
		border-radius: var(--r-md);
	}
	.spec-title {
		margin: 0;
		font-size: var(--fs-xl);
	}
	.spec-slider {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: var(--fs-sm);
	}
	.spec-slider input {
		width: 16rem;
	}
	.spec-slider strong {
		min-width: 3.5rem;
		font-variant-numeric: tabular-nums;
	}
	.spec-note {
		margin-left: auto;
		color: var(--muted);
		font-size: var(--fs-xs);
	}
	/* Each ground paints its own --surface (glass resolves it to the glass
	   panel); the night specimen paints nothing. */
	.spec-ground {
		padding: 12px 14px 14px;
		border-radius: var(--r-md);
		background: var(--surface);
		color: var(--text);
	}
	.spec-ground--bare {
		background: none;
	}
	.spec-ground .kicker {
		margin: 0 0 0.6rem;
	}
	.spec-ctx {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.6rem;
	}
	.spec-ctx .btn {
		gap: 5px;
	}
	.spec-ctx .chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}
	.spec-inline,
	.spec-big {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.spec-grid {
		display: grid;
		grid-template-columns: 3.5rem repeat(var(--cols), 24px);
		align-items: center;
		row-gap: 2px;
	}
	.spec-rowlabel {
		color: var(--muted);
		font-size: var(--fs-2xs);
		font-variant-numeric: tabular-nums;
	}
	.spec-rowlabel--held {
		color: var(--accent);
	}
	.spec-cell {
		display: grid;
		place-items: center;
		height: 24px;
	}
	.mk {
		display: block;
		flex-shrink: 0;
	}
	/* vector-effect is NOT inherited — it must sit on the shapes. */
	.mk--held :global(*) {
		vector-effect: non-scaling-stroke;
	}
</style>
