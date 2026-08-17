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

	/** Both tools' one time format. ⚠ TWO DECIMALS, and it is not fussiness: the
	 *  planner's events land on FRAMES (1/60s), so a single decimal would print
	 *  three consecutive casts as the same instant. The column is tabular, so the
	 *  extra digit costs the same width on every row and nothing on any of them. */
	export const fmtLogTime = (seconds: number) => `${seconds.toFixed(2)}s`;
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		rows,
		empty = 'Nothing to report.',
		lead
	}: {
		rows: EventLogRow[];
		empty?: string;
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
	} = $props();
</script>

<div class="el-log">
	{@render lead?.()}
	{#if rows.length === 0}
		<p class="el-empty">{empty}</p>
	{:else}
		{#each rows as row, i (i)}
			<p class="el-row el-row--{row.tone}">
				<span class="el-time">{row.time === undefined ? '' : fmtLogTime(row.time)}</span>
				<span class="el-body">
					{#if row.pip}
						<span
							class="el-pip"
							class:el-pip--provisional={row.pip.provisional}
							style:background={row.pip.color}
							style:--label-halo={row.pip.halo}>{row.pip.text}</span
						>
					{/if}{row.text}
				</span>
			</p>
		{/each}
	{/if}
</div>

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
	.el-log {
		display: grid;
		gap: 0.3rem;
		min-height: 0;
		overflow-y: auto;
	}

	.el-row {
		display: grid;
		/* 🎛️ The time column is sized to its widest member — "199.99s" — so the
		   body column never shifts as a rotation gets long. */
		grid-template-columns: 3.6rem minmax(0, 1fr);
		gap: 0.5rem;
		margin: 0;
		font-size: var(--fs-lg);
		line-height: 1.25rem;
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

	/* ⚠ The indent is on the BODY, not the row — the time column has to stay
	   where it is, because an indented row's job is to read as hanging under the
	   text above it, not as a differently-timed event. */
	.el-row--sub .el-body {
		color: color-mix(in srgb, var(--el-ink, var(--text)) 76%, transparent);
		padding-left: 0.9rem;
	}
	.el-row--quiet .el-body {
		color: color-mix(in srgb, var(--el-ink, var(--text)) 58%, transparent);
		padding-left: 0.9rem;
	}

	.el-pip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 15px;
		height: 15px;
		padding: 0 3px;
		margin-right: 0.4rem;
		border-radius: var(--r-round);
		font-family: var(--font-condensed);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		vertical-align: 1px;
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
