<script lang="ts">
	/**
	 * THE FINGERPRINT, drawn (lineups design §4; the model is `$lib/fingerprint`).
	 * Fifteen slots in three clusters — Survival · Support · Damage — the same
	 * order for every team, so two teams compare as SHAPES.
	 *
	 * GLYPHS: `FingerprintGlyph`, the one icon set the card and the roster's
	 * filter draw too (Nate's traces; a facet he has not drawn yet shows its
	 * two-letter stand-in).
	 *
	 * ⚓ TWO STATES, EVERY GLYPH ALWAYS DRAWN (Nate 2026-10-09) — a missing
	 * capability has to be SEEN missing, so no slot shrinks to a dot:
	 *   lit    the team has it; dots = how many members provide it
	 *   faint  the team does not; dots = members who WOULD (a higher
	 *          constellation, or a condition this team doesn't meet), no dots =
	 *          nobody here has it
	 * The model's five states survive in the slot's sentence (the tooltip),
	 * which says which kind of "would" it is. An uncurated member reads as
	 * faint with no dots — the sentence says the kit is unknown.
	 * Painted, ⛔ never element opacity (the sub-pixel law).
	 *
	 * STEP 4 (§11.2, §11.5): the fingerprint is the filter vocabulary.
	 *   · A FAINT slot is a button: it finds who would provide it (the page
	 *     filters the roster to that facet and selects this team).
	 *   · Hovering a card PREVIEWS the team the pick would make — the row is
	 *     drawn as it would end, with what it gains and what it loses marked.
	 */
	import { FACETS } from '$lib/capabilities/facets';
	import type { FacetKey } from '$lib/capabilities/deriveCapabilities';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import type { FingerprintCluster, FingerprintSlot } from '$lib/fingerprint';
	import FingerprintGlyph from '$lib/components/FingerprintGlyph.svelte';

	type Clusters = { cluster: FingerprintCluster; slots: FingerprintSlot[] }[];

	let {
		clusters,
		preview = null,
		previewId = null,
		filtered,
		onFind
	}: {
		clusters: Clusters;
		/** The team AFTER the hovered card's pick (lineups design §11.2 — "the
		 *  old fact cell, on demand"): drawn in place of `clusters`, with every
		 *  slot the pick would light or put out marked. Still presence only. */
		preview?: Clusters | null;
		/** Who the preview adds — their dot is the previewed one. */
		previewId?: string | null;
		/** The facets the roster is filtered by — their slots say so. */
		filtered?: ReadonlySet<FacetKey>;
		/** A FAINT slot was clicked: find who would provide it (§11.2). Absent,
		 *  no slot is a control. */
		onFind?: (facet: FacetKey) => void;
	} = $props();

	const LABEL = Object.fromEntries(FACETS.map((f) => [f.key, f.label]));
	const first = (id: string) => (getCharacterIndexEntry(id)?.displayName ?? id).split(' ')[0];

	/** Whether each facet is lit now — what the preview is compared against. */
	const litNow = $derived(
		new Map(clusters.flatMap((c) => c.slots.map((s) => [s.facet, s.state === 'lit'] as const)))
	);
	const shown = $derived(preview ?? clusters);

	/** Who the dots count: the providers when lit, the would-be providers when
	 *  faint. */
	const dotsOf = (s: FingerprintSlot) =>
		s.state === 'lit'
			? s.providers
			: s.members.filter((m) => m.state === 'locked' || m.state === 'outlined').map((m) => m.id);

	const names = new Intl.ListFormat('en', { type: 'conjunction' });

	/** The slot's tooltip: its label, then one WHOLE sentence per member state
	 *  (style guide §3.1 — each is a string of its own, with a plural form where
	 *  the verb agrees, never a run assembled from fragments). */
	function sentence(s: FingerprintSlot, change: 'gain' | 'loss' | null): string {
		const who = (state: string) =>
			s.members.filter((m) => m.state === state).map((m) => first(m.id));
		const lit = who('lit');
		const outlined = who('outlined');
		const locked = who('locked');
		const unknown = who('unknown');
		const lines = [`${LABEL[s.facet] ?? s.facet}.`];
		if (lit.length)
			lines.push(lit.length === 1 ? `${lit[0]} provides it.` : `${names.format(lit)} provide it.`);
		if (outlined.length) lines.push(`${names.format(outlined)} would, but not in this team.`);
		if (locked.length) lines.push(`${names.format(locked)} would from a higher constellation.`);
		if (unknown.length)
			lines.push(
				unknown.length === 1
					? `${unknown[0]} isn’t curated yet.`
					: `${names.format(unknown)} aren’t curated yet.`
			);
		if (!lit.length && !outlined.length && !locked.length && !unknown.length)
			lines.push('Nobody here provides it.');
		if (change === 'gain') lines.push('This pick adds it.');
		else if (change === 'loss') lines.push('This pick takes it away.');
		else if (onFind && s.state !== 'lit') lines.push('Click to find who provides it.');
		return lines.join(' ');
	}
</script>

<div class="fp" class:fp--preview={!!preview} role="list" aria-label="The team's capabilities">
	{#each shown as c (c.cluster)}
		<span class="fp-cluster">
			{#each c.slots as s (s.facet)}
				{@const lit = s.state === 'lit'}
				{@const was = litNow.get(s.facet) ?? false}
				{@const change = preview ? (lit && !was ? 'gain' : !lit && was ? 'loss' : null) : null}
				{@const find = onFind && !lit && !preview}
				{@const label = sentence(s, change)}
				<svelte:element
					this={find ? 'button' : 'span'}
					class="fp-slot"
					class:fp-find={find}
					class:fp-lit={lit}
					class:fp-gain={change === 'gain'}
					class:fp-loss={change === 'loss'}
					class:fp-filtered={filtered?.has(s.facet)}
					role={find ? undefined : 'listitem'}
					type={find ? 'button' : undefined}
					aria-pressed={find ? (filtered?.has(s.facet) ?? false) : undefined}
					title={label}
					aria-label={label}
					onclick={find
						? (e: MouseEvent) => {
								e.stopPropagation();
								onFind?.(s.facet);
							}
						: undefined}
				>
					<span class="fp-glyph"><FingerprintGlyph facet={s.facet} /></span>
					<span class="fp-dots">
						{#each dotsOf(s) as p (p)}<span
								class="fp-dot"
								class:fp-dot--new={p === previewId && lit}
							></span>{/each}
					</span>
				</svelte:element>
			{/each}
		</span>
	{/each}
</div>

<style>
	.fp {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	/* --fp-slot-gap is the gap between slots; the hit area below reaches half
	   of it, so a consumer resizes the gap through the variable. */
	.fp-cluster {
		--fp-slot-gap: 7px;
		display: flex;
		gap: var(--fp-slot-gap);
	}
	.fp-slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		position: relative;
		width: 13px;
		/* FAINT is the resting paint; LIT is the ink. */
		color: var(--line-strong);
	}
	/* The slot's HIT AREA reaches halfway into the gaps beside it, so moving
	   from glyph to glyph never crosses dead space — crossing one hid the
	   tooltip and restarted its delay. Transparent and out of flow; ::after is
	   the filter rule. */
	.fp-slot::before {
		content: '';
		position: absolute;
		inset: -3px calc(var(--fp-slot-gap) / -2);
	}
	.fp-slot.fp-lit {
		color: var(--text);
	}
	/* THE PREVIEW (⚓ Nate 2026-10-12): each changed slot keeps the BRIGHTNESS
	   it would end at, and the hue says it moved. A gain is --ui-positive
	   straight, as bright as a lit glyph ("this will be lit"); a loss is the
	   red pulled toward the faint paint ("this will go dim").
	   🎛️ --fp-loss-mix is how much red survives the dimming. ⚠ One mix of two
	   literals — a color-mix fed by a color-mix crashes WebKit. */
	.fp {
		--fp-loss-mix: 60%;
	}
	.fp-slot.fp-gain {
		color: var(--ui-positive);
	}
	.fp-slot.fp-loss {
		color: color-mix(in srgb, var(--ui-danger) var(--fp-loss-mix), var(--line-strong));
	}
	/* ↻ 2026-10-12: the glyph box IS the glyph now (the generator crops each
	   to its art), so 16px of padded box became 13px of glyph + 3px more gap —
	   the slot pitch is unchanged and the art is ~30% larger. */
	.fp-glyph {
		width: 13px;
		height: 13px;
	}
	/* A faint slot that FINDS: a bare button, its hover the ink brightening. */
	button.fp-slot {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		cursor: pointer;
		transition: color var(--t-snap);
	}
	button.fp-slot:hover {
		color: color-mix(in srgb, var(--text) 60%, transparent);
	}
	button.fp-slot:focus-visible {
		outline: 1px solid var(--accent);
		outline-offset: 2px;
		border-radius: var(--r-sm, 3px);
	}
	/* The roster is filtered by this slot: a gold rule under its dots. */
	.fp-filtered::after {
		content: '';
		position: absolute;
		left: 2px;
		right: 2px;
		bottom: -3px;
		height: 1px;
		background: var(--accent);
	}
	.fp-dots {
		display: flex;
		gap: 1px;
		height: 3px;
		min-width: 8px;
		justify-content: center;
		color: var(--line-edge);
	}
	.fp-lit .fp-dots {
		color: var(--text);
	}
	.fp-dot {
		width: 3px;
		height: 3px;
		border-radius: var(--r-round);
		background: currentColor;
	}
	.fp-dot--new {
		background: var(--ui-positive);
	}

	/* Below `compact` (40rem — $lib/breakpoints.ts) the row is a phone's
	   width: tighter gaps keep the fifteen on ONE line from 360 (296px), and at
	   320 the Damage cluster wraps whole — a cluster never splits. */
	@media (max-width: 40rem) {
		.fp {
			gap: 8px;
		}
		.fp-cluster {
			--fp-slot-gap: 6px;
		}
	}
</style>
