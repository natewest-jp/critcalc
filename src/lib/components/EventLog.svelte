<script module lang="ts">
	/**
	 * THE EVENT LOG — a transcript of what happened to the target's aura, shared
	 * by the Visualizers' Gauge Explorer and the planner's side column
	 * (2026-08-17, ⚓ NATE: "the event log from the instrument — that should be
	 * cleanly applicable to the planner").
	 *
	 * ⚓ ONE GRAMMAR, TWO FEEDS, and the split is the same one the marker grammar
	 * already draws: the two tools read DIFFERENT event vocabularies — the
	 * instrument drives `simulateGauge` and sees `crystallizeBlocked`,
	 * `reverseVaporize` and per-reaction consumption; the planner reads the IR,
	 * where `reactionBridge` has already collapsed those. So each tool builds its
	 * own rows and this owns nothing but how a row LOOKS. ⛔ Don't push either
	 * tool's vocabulary in here to "unify" them; that is how one of them starts
	 * lying.
	 *
	 * THE ROW, read left to right: WHEN · WHAT LANDED (an element-coloured pip
	 * carrying its gauge units) · WHAT IT DID. That is the application marker's
	 * own order, in prose — ⚓ the pip and the chart's pill are deliberately the
	 * same object, which is why the pip carries UNITS and not a row number.
	 * ↻ ⚓ NATE 2026-08-17: it used to carry the application's INDEX. That numbered
	 * nothing a reader could see anywhere else on either surface, while the unit is
	 * the one datum the whole log is about — and it makes a log line and its marker
	 * recognisably the same event.
	 *
	 * ⚠ THE TIME IS ITS OWN COLUMN, tabular and right-aligned. Inline ("0.00s —
	 * Pyro…") the times ragged against the text and the eye could not run down
	 * them, which is the one thing a log is scanned FOR. A row with no time hangs
	 * under the one above it, which is what makes a reaction read as a consequence
	 * of the application over it rather than as a second event.
	 */
	export type EventLogTone =
		/** An application: the thing that happened. Full ink. */
		| 'lead'
		/** Its consequence — a reaction. Indented, one rung down. */
		| 'sub'
		/** Bookkeeping the reader did not cause: decay, expiry, a core. */
		| 'quiet';

	export type EventLogRow = {
		/** Seconds. Omitted on a row that belongs to the one above it. */
		time?: number;
		/**
		 * Seconds — the END of a run, for rows that name a span rather than an
		 * instant ("Electro-Charged ×4"). ⚠ HIGHLIGHTING ONLY: the time COLUMN
		 * still prints the start alone, because a range there is twice the width
		 * of every other row. A run has width, so "is the cursor on this row" is a
		 * containment test where a discrete event's is proximity — the same split
		 * `auraReactionsAt` already makes on the chart.
		 */
		endTime?: number;
		/**
		 * The element disc. `text` is the gauge units — see the note above.
		 *
		 * ⚓ `color` IS THE `bar` RUNG, NOT `main` (⚓ NATE 2026-08-17: "I simply
		 * don't like dark ink on elemental colors… make their text white and give
		 * them the same --halo treatment that bars have"). The disc is a tiny BAR
		 * with white written on it, and `bar` is the rung the palette derives for
		 * exactly that; `halo` is its dark shade, the thing that holds white ink
		 * off a bright fill. ⚠ Both come from the caller because the two tools
		 * name their elements differently on the way in.
		 */
		pip?: { text: string; color: string; halo?: string; provisional?: boolean };
		text: string;
		tone: EventLogTone;
	};

	/**
	 * Where the reader is pointing on the CHART, in seconds, with the reach that
	 * pixel covers at the current zoom.
	 *
	 * ⚓ SECONDS, NOT FRAMES, in both directions across this seam. The rows are
	 * already in seconds because that is what they PRINT, and a channel whose
	 * unit matches its consumer is one conversion nobody has to remember.
	 * ⚓ THE REACH COMES FROM THE CHART because only the chart knows its zoom — a
	 * pixel is 1/20th of a second at one end of the zoom range and 1/120th at the
	 * other. ⛔ Don't hard-code a tolerance here; it would be wrong at every zoom
	 * but one.
	 */
	export type EventLogHover = { at: number; reach: number };

	/** Both tools' one time format. ⚠ TWO DECIMALS, and it is not fussiness: the
	 *  planner's events land on FRAMES (1/60s), so a single decimal would print
	 *  three consecutive casts as the same instant. The column is tabular, so the
	 *  extra digit costs the same width on every row and nothing on any of them. */
	export const fmtLogTime = (seconds: number) => `${seconds.toFixed(2)}s`;
</script>

<script lang="ts">
	import { tick, untrack, type Snippet } from 'svelte';

	let {
		rows,
		empty = 'Nothing to report.',
		lead,
		hover = null,
		onHover,
		onSeek,
		reveal = null,
		onRevealed
	}: {
		rows: EventLogRow[];
		empty?: string;
		/** Where the chart's cursor is — the rows under it light up. */
		hover?: EventLogHover | null;
		/**
		 * The reverse channel: which instant the reader is pointing at IN THE LOG,
		 * so the chart can draw its own cursor there. ⚓ ONE CROSSHAIR, TWO
		 * DRIVERS — the chart already had this cursor for its own pointer, so the
		 * log borrows the vocabulary rather than inventing a second highlight.
		 */
		onHover?: (seconds: number | null) => void;
		/**
		 * "Take me there." Given, every row becomes a real button and the log
		 * becomes keyboard-navigable; omitted, the rows stay inert paragraphs —
		 * which is the Gauge Explorer, whose chart is never scrolled.
		 */
		onSeek?: (seconds: number) => void;
		/**
		 * Standing content above the transcript — the planner puts the aura's
		 * modelling limits here.
		 *
		 * ⚠ INSIDE THE SCROLLER, not stuck above it. Three paragraphs pinned over a
		 * several-hundred-row list would spend a third of the column permanently on
		 * something you read once; scrolling past it is the correct fate for a
		 * standing note, and it still arrives first.
		 */
		lead?: Snippet;
		/**
		 * An instant to scroll into view — the chart asks for it when a pip is
		 * clicked. Held until there are rows to find it among (the planner only
		 * projects them once the panel is open), then handed back through
		 * `onRevealed` so the caller can clear it.
		 */
		reveal?: number | null;
		onRevealed?: () => void;
	} = $props();

	/**
	 * Each row plus the two things the template cannot work out on its own: the
	 * instant it stands for, and whether the chart's cursor is on it.
	 *
	 * ⚓ A ROW WITH NO TIME INHERITS THE ONE ABOVE IT, for both. That is already
	 * what a timeless row MEANS here — it hangs under its lead — so a reaction
	 * lights up with the application that caused it and seeks to the same place.
	 * ⛔ Don't make sub rows unhighlightable "because they have no time": that
	 * would leave a lit application with a dark consequence under it, which reads
	 * as the pair being unrelated.
	 */
	const marked = $derived.by(() => {
		let lastAt: number | undefined;
		let lastActive = false;
		return rows.map((row) => {
			if (row.time !== undefined) lastAt = row.time;
			const at = row.time ?? lastAt;
			const active =
				row.time === undefined
					? lastActive
					: hover !== null &&
						hover.at >= row.time - hover.reach &&
						hover.at <= (row.endTime ?? row.time) + hover.reach;
			lastActive = active;
			return { row, at, active };
		});
	});

	// ── Keyboard: ONE tab stop, arrows to walk ────────────────────────────────
	// ⚠ A ROVING TABINDEX, not 300 tab stops. A rotation makes a few hundred rows
	// and making each a focus stop would put the whole transcript between the Log
	// button and everything after it. One row is reachable at a time and the
	// arrows move which — the standard pattern, and the reason the rows can be
	// real <button>s at all.
	let kbIndex = $state(0);
	let rowEls = $state<(HTMLElement | undefined)[]>([]);

	function focusRow(i: number) {
		const next = Math.max(0, Math.min(marked.length - 1, i));
		kbIndex = next;
		rowEls[next]?.focus();
	}
	function onRowKey(e: KeyboardEvent, i: number) {
		if (e.key === 'ArrowDown') focusRow(i + 1);
		else if (e.key === 'ArrowUp') focusRow(i - 1);
		else if (e.key === 'Home') focusRow(0);
		else if (e.key === 'End') focusRow(marked.length - 1);
		else return;
		e.preventDefault();
	}

	// ── Reveal: bring a requested instant to the middle of the column ─────────
	// ⚠ The LIST'S OWN scrollTop, never `scrollIntoView` — that scrolls every
	// scrollable ancestor too, and the tool must never page-scroll.
	let listEl = $state<HTMLElement | undefined>();
	$effect(() => {
		const target = reveal;
		if (target === null || marked.length === 0 || !listEl) return;
		// The first row at or after the instant — a pip's row carries its exact
		// time, so this lands on it; the slack absorbs float noise from frames.
		let i = marked.findIndex((m) => m.at !== undefined && m.at >= target - 1e-3);
		if (i < 0) i = marked.length - 1;
		const list = listEl;
		void tick().then(() => {
			const el = list.querySelectorAll<HTMLElement>('.el-row')[i];
			if (!el) return;
			const lb = list.getBoundingClientRect();
			const eb = el.getBoundingClientRect();
			list.scrollTo({
				top: list.scrollTop + (eb.top - lb.top) - (lb.height - eb.height) / 2,
				behavior: 'smooth'
			});
		});
		untrack(() => {
			kbIndex = i;
			onRevealed?.();
		});
	});

	/**
	 * Hover is read at the CONTAINER, not per row.
	 *
	 * ⚠ `mouseover` (which bubbles) with a `closest` lookup, rather than 300
	 * `mouseenter` handlers — mouseenter does not bubble, so per-row is the only
	 * other option and it is one listener per row on a list this long.
	 */
	function onListOver(e: Event) {
		if (!onHover) return;
		const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-el-at]');
		const at = el?.dataset.elAt;
		onHover(at === undefined ? null : Number(at));
	}
</script>

<!-- ⚠ `focusin`/`focusout` ALONGSIDE the mouse pair, and not only to satisfy the
     a11y rule: arrowing down the log with the keyboard should move the chart's
     crosshair exactly as hovering does, or the whole link is mouse-only. They
     BUBBLE where `focus`/`blur` do not, which is what lets one listener on the
     container serve every row.
     ⚠ The rule asks literally for `focus`, which CANNOT do this job: it does not
     bubble, so on a container it would only fire for the container itself and
     every row would be missed. `focusin` is the bubbling form and is the whole
     point — the keyboard path is covered, which is what the rule is protecting.
     ⛔ Don't "fix" this by adding a dead `onfocus` beside them. -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<div
	bind:this={listEl}
	class="el-log"
	onmouseover={onListOver}
	onmouseleave={() => onHover?.(null)}
	onfocusin={onListOver}
	onfocusout={() => onHover?.(null)}
	role="presentation"
>
	{@render lead?.()}
	{#if rows.length === 0}
		<p class="el-empty">{empty}</p>
	{:else}
		{#each marked as { row, at, active }, i (i)}
			{#if onSeek}
				<!-- ⚠ A REAL BUTTON, so Enter and Space seek without a keydown handler
				     of our own, and so the row announces itself as actionable. -->
				<button
					bind:this={rowEls[i]}
					type="button"
					class="el-row el-row--{row.tone}"
					class:el-row--active={active}
					class:el-row--seekable={at !== undefined}
					data-el-at={at}
					tabindex={i === kbIndex ? 0 : -1}
					disabled={at === undefined}
					onkeydown={(e) => onRowKey(e, i)}
					onfocus={() => (kbIndex = i)}
					onclick={() => at !== undefined && onSeek?.(at)}
				>
					{@render rowContent(row)}
				</button>
			{:else}
				<p class="el-row el-row--{row.tone}" class:el-row--active={active} data-el-at={at}>
					{@render rowContent(row)}
				</p>
			{/if}
		{/each}
	{/if}
</div>

{#snippet rowContent(row: EventLogRow)}
	<span class="el-time">{row.time === undefined ? '' : fmtLogTime(row.time)}</span>
	<span class="el-pip-cell">
		{#if row.pip}
			<span
				class="el-pip"
				class:el-pip--provisional={row.pip.provisional}
				style:background={row.pip.color}
				style:--label-halo={row.pip.halo}>{row.pip.text}</span
			>
		{/if}
	</span>
	<span class="el-body">{row.text}</span>
{/snippet}

<style>
	/* Fills whatever box it is given and scrolls inside it — the Explorer hands it
	   a panel, the planner hands it the aside column. ⛔ No max-height here: the
	   two boxes have different heights and the one that knows is the caller. */
	/* ⚠⚠ ONE INK AT THREE STRENGTHS, AND THE ANCHOR IS THE CALLER'S TO NAME.
	   The first cut built the ladder out of `--text` (lead) and `--muted` (sub),
	   which is right on the night and BACKWARDS on paper: measured inside the
	   Explorer's readout card, --text is #495366 and --muted is #3b4255, so the
	   applications came out FAINTER than the reactions hanging under them. That
	   inversion is a documented property of `.ctx-light` (a page's palette note
	   has it), not a bug to patch at one call site.
	   ⚓ So the component never names two inks: it takes ONE and derives the other
	   two by alpha, which cannot invert. `--el-ink` is the caller's knob; a caller
	   on paper points it at whichever token anchors there.
	   ⚠ Alpha in the PAINT, not element `opacity` — the sub-pixel law.

	   🐛 THE DEFAULT IS A `var()` FALLBACK AT EVERY USE SITE, NOT A DECLARATION
	   HERE. `--el-ink: var(--text)` on `.el-log` looked equivalent and silently
	   ATE the caller's value: a custom property set ON an element beats the same
	   property inherited INTO it, and `.gx-log` — the ancestor doing the pointing
	   — is inherited. Measured: the paper card's rows kept resolving to #495366
	   (the receding ink) with the override in place and no warning anywhere.
	   ⛔ Don't "tidy" these five fallbacks back into one declaration. */
	/* ↻ 2026-10-02 (⚓ Nate): THE LIST IS THE GRID, and every row is a
	   `subgrid` of it — time · pip · text. Three columns so every row's text
	   starts on ONE line (after a pip, on a wrapped line, on a row with no pip);
	   ONE grid so the pip column is as wide as the widest pip this log actually
	   holds, which makes the gap after a pip the same as the gap after the time.
	   A fixed pip column had to fit "1.5", and left a "1" pip floating in
	   ~14px of air before its text.
	   🎛️ The time column is sized to its widest member — "199.99s" — so the text
	   never shifts as a rotation gets long. */
	.el-log {
		display: grid;
		grid-template-columns: 3.6rem auto minmax(0, 1fr);
		column-gap: 0.45rem;
		row-gap: 0.3rem;
		align-content: start;
		min-height: 0;
		overflow-y: auto;
	}
	/* Every child spans the three columns — the rows, and the caller's standing
	   `lead` content and the empty line, which are not rows. */
	.el-log > :global(*) {
		grid-column: 1 / -1;
	}

	.el-row {
		display: grid;
		/* ⚠ The pip used to sit INLINE at the start of the text, so a wrap ran
		   back under it, and the reaction and bookkeeping rows carried a 0.9rem
		   indent of their own — three left edges in one log. ⛔ Don't bring the
		   indent back: a timeless row already reads as hanging under the one
		   above, and its ink says what kind of line it is. */
		grid-template-columns: subgrid;
		margin: 0;
		font-size: var(--fs-lg);
		line-height: 1.25rem;
		/* The seekable variant is a <button>; strip the UA's chrome so both forms
		   are the same object and the ladder above still governs their ink. ⚠ The
		   negative margin + matching padding is what lets the lit row's fill reach
		   past the text without the rows themselves moving. */
		width: 100%;
		text-align: left;
		font-family: inherit;
		background: none;
		border: none;
		border-radius: 3px;
		padding: 1px 4px;
		margin-inline: -4px;
	}

	.el-row--seekable {
		cursor: pointer;
	}
	.el-row--seekable:hover {
		background: var(--fill-hover);
	}
	.el-row--seekable:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -1px;
	}
	/* ⚓ THE CHART'S CURSOR IS ON THIS ROW. A FILL, not a colour change: the ink
	   ladder is already carrying tone (lead / consequence / bookkeeping), so
	   brightening a row would collide with what its shade already says. A ground
	   is a different axis, so a lit BOOKKEEPING row still reads as bookkeeping.
	   ⛔ Not the gold selection fill — nothing here is selected; this is an echo
	   of where the pointer is, and it leaves the moment the pointer does. */
	.el-row--active {
		background: var(--fill-hover);
	}

	/* ⚠ Tabular figures, or the column is right-aligned and still ragged: the
	   proportional 1 is narrower than every other digit, so "1.10s" and "8.80s"
	   would not line up under each other. */
	.el-time {
		font-variant-numeric: tabular-nums;
		text-align: right;
		color: color-mix(in srgb, var(--el-ink, var(--text)) 52%, transparent);
		white-space: nowrap;
	}

	.el-body {
		min-width: 0;
		color: var(--el-ink, var(--text));
	}

	.el-row--sub .el-body {
		color: color-mix(in srgb, var(--el-ink, var(--text)) 76%, transparent);
	}
	.el-row--quiet .el-body {
		color: color-mix(in srgb, var(--el-ink, var(--text)) 58%, transparent);
	}
	/* The pip sits at the start of its column, on the first line's centre. */
	.el-pip-cell {
		display: flex;
		align-items: flex-start;
		padding-top: 2.5px;
	}

	.el-pip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 15px;
		height: 15px;
		padding: 0 3px;
		border-radius: var(--r-round);
		font-family: var(--font-condensed);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		/* ↻ ⚓ NATE 2026-08-17: WHITE ON A HALO, not dark ink on the element. It
		   was `--bright-ink` on the `main` rung, which is the bright-chip idiom the
		   planner's bars retired in 2026-08-11 for the same reason — ⚓ "I simply
		   don't like dark ink on elemental colors."
		   ⚠ THE RECIPE IS THE CHART'S, VERBATIM (RotationTimeline's halo block):
		   FULL-opacity #fff over two shadows in a dark shade of the fill's own
		   hue. ⛔ Never alpha-reduced white here — the shadow bleeds through the
		   glyphs, which is why nothing dimmed on the chart carries a halo either.
		   The fallback is the chart's own near-black, for a caller that hands over
		   a colour with no halo. */
		color: #fff;
		text-shadow:
			color-mix(in srgb, var(--label-halo, #081225) 25%, transparent) 0px 1px 2px,
			color-mix(in srgb, var(--label-halo, #081225) 50%, transparent) 0px 0px 6px;
	}
	/* ⚓ The same statement the chart's tick makes: "could someone MEASURE this?"
	   — a ring rather than a recolour, so the element still names itself. */
	.el-pip--provisional {
		box-shadow: 0 0 0 1px var(--ui-provisional);
	}

	.el-empty {
		margin: 0;
		font-size: var(--fs-lg);
		color: color-mix(in srgb, var(--el-ink, var(--text)) 58%, transparent);
	}
</style>
