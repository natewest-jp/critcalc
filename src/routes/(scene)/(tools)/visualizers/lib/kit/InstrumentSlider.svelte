<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import { clamp, decimalsOf, fieldChars, formatField, parseField } from './numberField';

	/**
	 * THE INSTRUMENT SLIDER: a label, a value you can type, and a track (the
	 * Visualizers overhaul, round 2: `docs/rounds/viz-type-kit-2026-11-02.md`).
	 * One component for every slider in the eight instruments, which held
	 * about twenty copies of the same markup and three of the level slider.
	 *
	 * ⚓ TYPEABLE (Nate 2026-11-02: "users would like to just quickly type in
	 * a number"). The value is a field: click it and type, Enter or leave to
	 * set, Escape to put it back, ↑/↓ to step (Shift: ×10). A valid number
	 * inside the range applies AS YOU TYPE, so the chart answers before you
	 * press anything. What you type may be finer than the track's step (an EM
	 * of 187 stays 187), down to the field's own decimals, and may run past
	 * the track where the model allows (`fieldMin`/`fieldMax`).
	 *
	 * The field has a fixed width (`fieldChars`) and tabular figures, so
	 * nothing beside it moves as the value changes (design § Stability).
	 *
	 * Units: `value`, `min`, `max` and `step` are the MODEL's. `scale` turns
	 * them into what the field shows (100 for a fraction shown as percent).
	 */
	type Track = {
		/** Track positions run 0..steps. */
		steps: number;
		/** The model value at a track position, and back. */
		to: (value: number) => number;
		from: (position: number) => number;
	};

	let {
		label,
		value = $bindable(),
		min,
		max,
		step,
		aria,
		valueText,
		unit = '',
		scale = 1,
		decimals,
		typeable = true,
		fieldMin,
		fieldMax,
		fieldStep,
		words = {},
		text = null,
		snap,
		stepKey,
		marks = [],
		track,
		trackStyle,
		vertical = false,
		headerEnd,
		disabled = false,
		class: className = ''
	}: {
		/** The visible label, sentence case. */
		label: string;
		value: number;
		min: number;
		max: number;
		step: number;
		/** The track's accessible name, when it should say more than the label. */
		aria?: string;
		/** What a screen reader hears for the track's value (default: the field's text and unit). */
		valueText?: string;
		/** Shown after the field: '%', 's'. */
		unit?: string;
		/** Display = model × scale. */
		scale?: number;
		/** Decimals the field shows (default: what the display step implies). */
		decimals?: number;
		typeable?: boolean;
		/** The typed range, in MODEL units (default: the track's). */
		fieldMin?: number;
		fieldMax?: number;
		/** ↑/↓ in the field, in model units (default: the track's step). */
		fieldStep?: number;
		/** Words the field reads as numbers, in display units: { off: 0 }. */
		words?: Record<string, number>;
		/** A word shown INSTEAD of the number while the field is at rest ("Immune", "Off"). */
		text?: string | null;
		/** Where a dragged or typed value lands (the level slider's 1–90, 95, 100). */
		snap?: (value: number) => number;
		/** One arrow-key step on the track, when the native step can't express it. */
		stepKey?: (value: number, dir: 1 | -1) => number;
		/** Tick marks under the track, in model units (linear tracks only). */
		marks?: number[];
		/** A non-linear track. While it is dragged the thumb keeps its own
		 *  position, so it glides as the value steps underneath. */
		track?: Track;
		/** Inline background for the track (the Crit heatmap's risk ramp). */
		trackStyle?: string;
		/** The track stands upright, its minimum at the foot (the Crit heatmap's
		 *  CRIT Rate handle, on its y axis). Where the track goes is the caller's. */
		vertical?: boolean;
		/** Controls that belong to the value, after its field on the header line
		 *  (the ICD timeline's interval presets). */
		headerEnd?: Snippet;
		disabled?: boolean;
		class?: string;
	} = $props();

	const id = $props.id();

	const shownDecimals = $derived(decimals ?? decimalsOf(step * scale));
	const lo = $derived(fieldMin ?? min);
	const hi = $derived(fieldMax ?? max);
	const shown = (v: number) => formatField(v * scale, shownDecimals);
	/** A typed number at the field's own precision, in model units: the field
	 *  and the model never disagree (a typed 55.5 into a whole-number field is
	 *  56 in both). A slider that takes finer values says so with `decimals`. */
	const fromTyped = (n: number) => {
		const f = 10 ** shownDecimals;
		return Math.round(n * f) / f / scale;
	};

	// ── The field ──────────────────────────────────────────────────────────
	/** What is in the field while it has focus; null at rest. */
	let draft = $state<string | null>(null);
	/** The value when the field took focus, for Escape. */
	let before = 0;
	const restText = $derived(text ?? shown(value));
	const chars = $derived(
		fieldChars(lo * scale, hi * scale, shownDecimals, [restText, ...Object.keys(words)])
	);

	const land = (v: number) => {
		const c = clamp(v, lo, hi);
		return snap ? snap(c) : c;
	};

	/** A click that is focusing the field: its mouseup must not drop the selection. */
	let clickFocus = false;

	// Focusing selects the whole value, so what you type replaces it. After
	// the draft has rendered (writing the value moves the caret), and a
	// focusing click's own mouseup is cancelled below, or the browser places
	// a caret there and the typing lands after the old number.
	function onFocus(e: FocusEvent & { currentTarget: HTMLInputElement }) {
		before = value;
		draft = shown(value);
		const el = e.currentTarget;
		void tick().then(() => el.select());
	}

	function onInput(e: Event & { currentTarget: HTMLInputElement }) {
		draft = e.currentTarget.value;
		const n = parseField(draft, words);
		if (n === null) return;
		const v = fromTyped(n);
		// Live only inside the range: "1" on the way to "140" must not set 1%.
		if (v >= lo && v <= hi) set(snap ? snap(v) : v);
	}

	// ⚠ Write only a CHANGE. A caller's binding can do more than store (RES &
	// DEF's clears Immune), so tabbing through the field, or Escape with
	// nothing typed, must not reach it.
	function set(v: number) {
		if (v !== value) value = v;
	}

	function commit(el: HTMLInputElement) {
		const n = draft === null ? null : parseField(draft, words);
		if (n !== null) set(land(fromTyped(n)));
		draft = null;
		el.value = restText;
	}

	function onKeydown(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		const el = e.currentTarget;
		if (e.key === 'Enter') {
			e.preventDefault();
			commit(el);
			el.blur();
		} else if (e.key === 'Escape') {
			// Spent here, so a popover or the menu state around it stays open.
			e.preventDefault();
			e.stopPropagation();
			set(before);
			draft = null;
			el.blur();
		} else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			e.preventDefault();
			const dir = e.key === 'ArrowUp' ? 1 : -1;
			const by = (fieldStep ?? step) * (e.shiftKey ? 10 : 1);
			const next = stepKey && !e.shiftKey ? stepKey(value, dir) : land(value + dir * by);
			set(next);
			draft = shown(next);
			el.value = draft;
			el.select();
		}
	}

	// ── The track ──────────────────────────────────────────────────────────
	let held = $state<number | null>(null);
	const position = $derived(
		track
			? held !== null && track.from(held) === value
				? held
				: track.to(value)
			: clamp(value, min, max)
	);

	function onTrack(e: Event & { currentTarget: HTMLInputElement }) {
		const el = e.currentTarget;
		const t = Number(el.value);
		if (track) {
			held = t;
			value = track.from(t);
		} else {
			value = snap ? snap(t) : t;
			// A snapped value the browser didn't land on: put the thumb on it.
			if (snap) el.value = String(value);
		}
	}

	function onTrackKey(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (!stepKey) return;
		const dir =
			e.key === 'ArrowRight' || e.key === 'ArrowUp'
				? 1
				: e.key === 'ArrowLeft' || e.key === 'ArrowDown'
					? -1
					: 0;
		if (!dir) return;
		e.preventDefault();
		value = stepKey(value, dir);
		e.currentTarget.value = String(position);
	}

	const markAt = (m: number) => (m - min) / (max - min);
</script>

<div class="slider-control {className}">
	<div class="slider-header">
		<label class="slider-label" for="{id}-track">{label}</label>
		{#if typeable}
			<span class="is-value">
				<input
					class="is-field"
					type="text"
					inputmode={shownDecimals > 0 || lo < 0 ? 'decimal' : 'numeric'}
					autocomplete="off"
					spellcheck="false"
					style:--is-chars={chars}
					value={draft ?? restText}
					aria-label="{aria ?? label}, type a value"
					{disabled}
					onpointerdown={(e) => (clickFocus = document.activeElement !== e.currentTarget)}
					onmouseup={(e) => {
						if (clickFocus) e.preventDefault();
						clickFocus = false;
					}}
					onfocus={onFocus}
					oninput={onInput}
					onblur={(e) => commit(e.currentTarget)}
					onkeydown={onKeydown}
				/>{#if unit && (draft !== null || text === null)}<span class="is-unit" aria-hidden="true"
						>{unit}</span
					>{/if}
			</span>
		{:else}
			<span class="readout is-readout">{restText}{text === null ? unit : ''}</span>
		{/if}
		{@render headerEnd?.()}
	</div>
	<div class="is-track" class:is-track--marked={marks.length > 0}>
		<input
			id="{id}-track"
			type="range"
			class="slider"
			class:slider--vertical={vertical}
			aria-orientation={vertical ? 'vertical' : undefined}
			min={track ? 0 : min}
			max={track ? track.steps : max}
			step={track ? 1 : step}
			value={position}
			aria-label={aria}
			aria-valuetext={valueText ?? text ?? `${restText}${unit}`}
			style={trackStyle}
			{disabled}
			oninput={onTrack}
			onkeydown={onTrackKey}
			onpointerup={() => (held = null)}
		/>
		{#if marks.length}
			<div class="is-marks" aria-hidden="true">
				{#each marks as m (m)}
					<span class="is-mark" style:--at={markAt(m)}></span>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.is-value {
		display: inline-flex;
		align-items: baseline;
		gap: 0.2rem;
		flex-shrink: 0;
	}

	/* ⚓ A FIELD LOOKS LIKE A FIELD at rest, so typing is discoverable: the
	   well the Crit heatmap's stat fields always had, at the label's size.
	   Mono, because mono is the voice of input fields (app.css § .readout). */
	.is-field {
		box-sizing: content-box;
		width: calc(var(--is-chars) * 1ch);
		padding: 0.12rem 0.4rem;
		border: none;
		border-radius: var(--r-sm);
		background: var(--fill-rest);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
		text-align: right;
		transition: box-shadow var(--t-snap);
	}
	@media (hover: hover) {
		.is-field:hover:not(:disabled) {
			box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, var(--border));
		}
	}
	.is-field:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
		outline-offset: 1px;
	}
	/* iOS zooms the page into a focused field under 16px. */
	@media (pointer: coarse) {
		.is-field {
			font-size: var(--fs-xl);
		}
	}

	.is-unit {
		font-family: var(--font-mono);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}

	.is-readout {
		font-variant-numeric: tabular-nums;
	}

	.is-track {
		position: relative;
		display: grid;
	}

	/* ⚠ A range input carries the UA's 2px side margin (Chrome and WebKit
	   alike), so its track starts 2px in from this wrapper. The marks mirror
	   that box exactly, margin AND width, or every mark sits 2px left. */
	.is-marks {
		position: relative;
		width: 100%;
		height: 5px;
		margin: 3px 2px 0;
	}

	/* Centred on the thumb's centre: the 15px thumb travels the track less
	   its own width, and the 1px mark steps back half a pixel. */
	.is-mark {
		position: absolute;
		top: 0;
		left: calc(7.5px + var(--at) * (100% - 15px) - 0.5px);
		width: 1px;
		height: 100%;
		background: color-mix(in srgb, var(--text) 35%, transparent);
	}
</style>
