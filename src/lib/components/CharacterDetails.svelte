<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { feedbackToolForPath } from '$lib/feedback';
	import ReportLink from '$lib/components/ReportLink.svelte';
	import { openCoverage } from '$lib/coverage/openCoverage';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { getLoadedCharacter, loadCharacter } from '$lib/data/characterData';
	import { constellations, ownership, loadout } from '$lib/stores';
	import { library } from '$lib/library.svelte';
	import LoadoutPanel from '$lib/components/LoadoutPanel.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import {
		deriveCharacterCapabilities,
		type DerivedCapability
	} from '$lib/capabilities/deriveCapabilities';
	import type { ConMode } from '$lib/capabilities/facets';
	import { conCapFor } from '$lib/capabilities/facets';
	import {
		KIND_LABEL,
		KIND_ORDER,
		TARGET_LABEL,
		capDetailText,
		caveatText
	} from '$lib/capabilities/capabilityText';
	import type { Snippet } from 'svelte';

	/**
	 * A CHARACTER'S DETAILS, the body without a shell (inspector round,
	 * 2026-10-23). Lifted out of `DetailCard` so the Planner's inspector pane and
	 * the modal both tools open read ONE component: the same character can never
	 * say two things in two places. The shell owns the header, the close and the
	 * ground; this owns everything below the header.
	 *
	 * ⚠ The `dc-` class names stayed with the markup, so the e2e locators that
	 * reach into the modal (`.dc-panel .dc-caps`) still find it there.
	 */
	let {
		id,
		conMode,
		defaultBuild = true,
		rotationNote = !defaultBuild,
		compact = false,
		onLeave,
		afterRoster
	}: {
		id: string;
		conMode: ConMode;
		/** The roster's Layer-1 loadout, editable (the Team Builder) — see
		 *  DetailCard's note on the prop's history. */
		defaultBuild?: boolean;
		/** The Planner's "for this rotation only" pointer to the bench. Defaults
		 *  to the old rule (shown wherever the default build is not). */
		rotationNote?: boolean;
		/** A narrow column (the inspector pane): capability rows stack. */
		compact?: boolean;
		/** Called before a link here takes the reader elsewhere — the modal
		 *  closes behind Edit in Roster and See coverage. */
		onLeave?: () => void;
		/** Rendered at the end of the roster section (the inspector's notes). */
		afterRoster?: Snippet;
	} = $props();

	const entry = $derived(getCharacterIndexEntry(id));
	const color = $derived(
		(elementColors[(entry?.element ?? 'none') as ElementKey] ?? elementColors.none).main
	);

	// Full payload — lazy chunk, reactive once landed.
	$effect(() => {
		void loadCharacter(id);
	});
	const data = $derived(getLoadedCharacter(id));

	const myCon = $derived($constellations[id] ?? 0);
	const myOwnership = $derived($ownership[id]);

	const viewCon = $derived(conCapFor(conMode, myCon));

	// Full provenance derivation, client-side from the loaded payload — the same
	// brain as the build-time index, so badges and card can never disagree.
	const capabilities = $derived(data ? deriveCharacterCapabilities(data).capabilities : []);
	const sortedCaps = $derived(
		[...capabilities].sort(
			(a, b) =>
				KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
				a.minConstellation - b.minConstellation
		)
	);

	// Convention (settled 2026-05-12): the planner hides locked effects; the
	// Team Builder shows everything with a locked badge.
	const locked = (cap: DerivedCapability) => cap.minConstellation > viewCon;

	function sectionLabel(cap: DerivedCapability): string {
		const { section, abilityName, variant } = cap.source;
		const name = variant ? `${abilityName} (${variant})` : abilityName;
		if (section === 'passive') return `${name} · passive`;
		if (section === 'factionBonus') return `${name} · team bonus`;
		return name;
	}

	// Timing reference — skill/burst rows.
	const castAbilities = $derived(
		(data?.abilities ?? []).filter((a) => a.abilityType === 'skill' || a.abilityType === 'burst')
	);

	/**
	 * "See coverage" opens the About overlay (or the menu state's Coverage), and
	 * a modal host CLOSES behind it, as it does for "Edit in Roster". Closed only
	 * when the overlay actually opened (a ⌘-click is left to open its new tab).
	 *
	 * ⚠ Bound as onclickCAPTURE: out of the app root, a delegated onclick runs
	 * only at `document`, AFTER SvelteKit's router has taken the click at
	 * <html> and navigated to /coverage. A capture handler sits on the anchor
	 * itself, so openCoverage's preventDefault lands first.
	 */
	function seeCoverage(e: MouseEvent) {
		if (!entry) return;
		openCoverage(e, [entry.id]);
		if (e.defaultPrevented) onLeave?.();
	}
</script>

<div class="dc-body" class:dc-body--compact={compact} style:--el-color={color}>
	{#if entry && !entry.curated}
		<!-- ⚠ onclickCAPTURE, not onclick — see seeCoverage. -->
		{#if entry.caps.length === 0}
			<p class="dc-stub-note">
				Kit not yet curated — capability data below is incomplete. Missing entries mean “unknown”,
				not “no”.
				<a
					class="link dc-stub-link"
					href="{resolve('/coverage')}?c={entry.id}"
					onclickcapture={seeCoverage}>See coverage</a
				>
			</p>
		{:else}
			<p class="dc-stub-note">
				Capabilities below are complete. Frame timing isn’t curated yet, so only this character’s
				rotation timing is approximate in the Planner.
				<a
					class="link dc-stub-link"
					href="{resolve('/coverage')}?c={entry.id}"
					onclickcapture={seeCoverage}>See coverage</a
				>
			</p>
		{/if}
	{/if}

	<!-- ── Your roster ────────────────────────────────────── -->
	<!-- ⚓ READ-ONLY (lineups design §11.6 item 2): the Library's Roster tab is
	     the one place the roster is edited, so details in both tools say what
	     it holds and link there, arriving on this character. -->
	<section>
		<p class="kicker">Your roster</p>
		<p class="dc-roster">
			<span class="dc-roster-state"
				>{#if myOwnership === 'owned'}<Mark name="check" size={13} /> Owned{#if !entry?.noConstellations}{` · C${myCon}`}{/if}{:else if myOwnership === 'wishlist'}<Mark
						name="star"
						size={13}
						filled
					/> On your wishlist{:else}Not owned{/if}</span
			>
			<button
				class="btn btn--sm"
				onclick={() => {
					// ⚠ Read the id BEFORE leaving: props are live, and a modal host
					// clears the one this card was opened with.
					const target = id;
					onLeave?.();
					library.openRoster(target);
				}}>Edit in Roster</button
			>
		</p>
		{#if rotationNote}
			<p class="note dc-note">
				To set this character’s constellation for this rotation only, use the selector on the
				Planner rather than the Roster.
			</p>
		{/if}
		<!-- The roster's LOADOUT (Layer 1), beside its constellation (lineups
		     design §2.1): it was editable only through the bench, and the Team
		     Builder has no bench any more. Same panel the bench opens; writes
		     land in the roster, where a rotation's own picks fall back to it. -->
		{#if defaultBuild}
			<p class="kicker dc-build-kicker">Default build</p>
			<LoadoutPanel
				loadoutEntry={$loadout[id] ?? {}}
				weaponType={entry?.weapon}
				elementColor={color}
				onSetArtifact={(setId) => loadout.setArtifact(id, setId)}
				onSetWeapon={(weaponId, r) => loadout.setWeapon(id, weaponId, r)}
				onSetRefinement={(r) => loadout.setWeapon(id, $loadout[id]?.weaponId, r)}
			/>
		{/if}
	</section>

	{@render afterRoster?.()}

	<!-- ── Capabilities ───────────────────────────────────── -->
	<section>
		<p class="kicker">Capabilities</p>
		{#if !data}
			<p class="note dc-note">Loading kit data…</p>
		{:else if sortedCaps.length === 0}
			<p class="note dc-note">
				Nothing team-facing derives from this kit{entry?.curated
					? ' — likely a selfish carry, or curation hasn’t covered its utility yet'
					: ''}.
			</p>
		{:else}
			<ul class="dc-caps">
				{#each sortedCaps as cap, i (i)}
					<li class="dc-cap" class:dc-cap--locked={locked(cap)}>
						<span class="dc-cap-kind"
							>{KIND_LABEL[cap.kind] ?? cap.kind}{(cap.kind === 'buff' ||
								cap.kind === 'resShred' ||
								cap.kind === 'infuse') &&
							cap.detail
								? `: ${capDetailText(cap.kind, cap.detail)}`
								: ''}</span
						>
						<span class="dc-cap-src">
							{sectionLabel(cap)}
							{#if cap.target}· {TARGET_LABEL[cap.target] ?? cap.target}{/if}
							{#if cap.via === 'tag'}
								<span
									class="dc-cap-tagged"
									title="Marked on the ability, but target/scaling not yet curated">tagged</span
								>
							{/if}
						</span>
						<span class="dc-cap-gate">
							{#if cap.minConstellation > 0}
								<span class="dc-gate-chip" class:dc-gate-chip--locked={locked(cap)}
									>C{cap.minConstellation}{#if locked(cap)}<Mark
											name="gated"
											size={11}
										/>{/if}</span
								>
							{:else}
								<span class="dc-gate-chip dc-gate-chip--base">C0</span>
							{/if}
						</span>
						{#if cap.caveats.length > 0}
							<span class="dc-cap-caveats"
								>{[...new Set(cap.caveats.map(caveatText))].join(' · ')}</span
							>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- ── Timing reference ───────────────────────────────── -->
	{#if data && castAbilities.length > 0}
		<section>
			<p class="kicker">Timing reference</p>
			<table class="dc-timing">
				<tbody>
					{#each castAbilities as ability (ability.id)}
						<tr>
							<td class="dc-timing-slot">{ability.abilityType === 'skill' ? 'E' : 'Q'}</td>
							<td class="dc-timing-name">{ability.name}</td>
							<td class="dc-timing-val">
								{#if 'cooldown' in ability && ability.cooldown}<span class="dc-timing-part"
										>{ability.cooldown}s cooldown</span
									>{/if}
								{#if 'charges' in ability && ability.charges && ability.charges > 1}
									<span class="dc-timing-part">· {ability.charges} charges</span>{/if}
								{#if 'energyCost' in ability && ability.energyCost}
									<span class="dc-timing-part">· {ability.energyCost} energy</span>{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}

	<!-- The feedback form, opened on its character section: the name as this
	     card titles it and the constellation the card reads at. -->
	<p class="dc-report">
		<ReportLink
			class="link"
			prefill={{
				category: 'character',
				tool: feedbackToolForPath(page.url.pathname),
				character: entry?.displayName ?? id,
				constellation: entry?.noConstellations ? undefined : viewCon,
				includeTech: true
			}}>Something not right with this character?</ReportLink
		>
	</p>
</div>

<style>
	.dc-body {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}
	.dc-body section {
		min-width: 0;
	}
	.dc-build-kicker {
		margin-top: 1rem;
	}
	.dc-report {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.dc-stub-link {
		white-space: nowrap;
	}
	.dc-stub-note {
		margin: 0;
		padding: 0.55rem 0.7rem;
		border-radius: 3px;
		/* ↻ 2026-08-11: --ui-danger, not --el-geo-main. This note reports the SAME
		   fact the ∅ marker does — frame timing isn't curated — and the
		   dire-retirement round settled that as a DATA-QUALITY state rather than a
		   domain colour. It was wearing a borrowed element token; now the note and
		   the mark that summarises it speak with one voice.
		   ↻ 2026-08-12: and that one voice is now --ui-provisional. The 08-11 move
		   settled state-over-domain; this one settles WHICH state, now that the
		   family has a value for "incomplete" that isn't "wrong". */
		border: 1px solid color-mix(in srgb, var(--ui-provisional) 40%, transparent);
		background: var(--ui-provisional-soft);
		font-size: var(--fs-md);
		line-height: var(--lh-normal);
		color: var(--text);
	}

	/* ── Your roster (read-only) ───────────────────────────────── */
	.dc-note {
		margin-top: 0.5rem;
		font-size: var(--fs-md);
	}
	.dc-roster {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		margin: 0;
	}
	.dc-roster-state {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--fs-md);
	}

	/* ── Capabilities list ────────────────────────────────────── */
	.dc-caps {
		list-style: none;
		margin: 0.55rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.dc-cap {
		display: grid;
		grid-template-columns: minmax(108px, auto) minmax(0, 1fr) auto;
		gap: 0.15rem 0.7rem;
		align-items: baseline;
		padding: 0.45rem 0.6rem;
		border-radius: 3px;
		background: var(--fill-rest);
		font-size: var(--fs-lg);
	}
	.dc-cap--locked {
		opacity: 0.5;
	}

	.dc-cap-kind {
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
	}

	.dc-cap-src {
		color: var(--muted);
		min-width: 0;
	}

	.dc-cap-tagged {
		margin-left: 0.35rem;
		padding: 0 4px;
		border-radius: 3px;
		background: var(--fill-rest);
		font-size: var(--fs-xs);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
	}

	.dc-cap-gate {
		justify-self: end;
	}

	/* inline-flex, because the locked state's Mark is a block-level <svg> and a
	   block child would break the chip's inline box. */
	.dc-gate-chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 1px 6px;
		border-radius: 3px;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		background: color-mix(in srgb, var(--el-color) 18%, transparent);
	}
	.dc-gate-chip--base {
		background: var(--fill-rest);
		color: var(--muted);
	}
	.dc-gate-chip--locked {
		background: var(--fill-rest);
		color: var(--muted);
	}

	.dc-cap-caveats {
		grid-column: 1 / -1;
		font-size: var(--fs-sm);
		font-style: italic;
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	/* ── Timing table ─────────────────────────────────────────── */
	.dc-timing {
		margin-top: 0.55rem;
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-lg);
	}
	.dc-timing td {
		padding: 0.35rem 0.6rem 0.35rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		vertical-align: baseline;
	}
	.dc-timing-slot {
		width: 1.6rem;
		font-weight: var(--fw-bold);
		color: var(--el-color);
	}
	.dc-timing-name {
		color: var(--text);
	}
	.dc-timing-val {
		text-align: right;
		white-space: nowrap;
		color: var(--muted);
	}
	/* Each fact holds together, so a wrapped value breaks only BETWEEN them. */
	.dc-timing-part {
		white-space: nowrap;
	}
	/* On a phone the value may wrap: at 320 "15s cooldown · 60 energy" needs
	   300px against the panel's 275 and scrolled the card 5px sideways. Only
	   below compact — wider, the name column is the one that gives. */
	@media (max-width: 40rem) /* compact — $lib/breakpoints.ts */ {
		.dc-timing-val {
			white-space: normal;
		}
	}

	/* ── The narrow column (the inspector pane, ~262px) ──────────────────
	   The modal's three-column capability row wants ~400px; in the pane the
	   kind and its gate share the first line and the source runs under them.
	   Type steps down one rung to the pane's own size (the notes' fs-sm/md),
	   and the timing value drops under its name. */
	.dc-body--compact {
		gap: 0.9rem;
	}
	.dc-body--compact .dc-cap {
		grid-template-columns: minmax(0, 1fr) auto;
		padding: 0.35rem 0.5rem;
		font-size: var(--fs-md);
	}
	.dc-body--compact .dc-cap-src {
		grid-column: 1 / -1;
		grid-row: 2;
		font-size: var(--fs-sm);
	}
	.dc-body--compact .dc-cap-gate {
		grid-column: 2;
		grid-row: 1;
	}
	.dc-body--compact .dc-timing {
		font-size: var(--fs-md);
	}
	.dc-body--compact .dc-timing-val {
		white-space: normal;
	}
	.dc-body--compact .dc-stub-note {
		font-size: var(--fs-sm);
	}
</style>
