<script lang="ts">
	import { fade } from 'svelte/transition';
	import { rotationTabs as rt } from '$lib/rotationTabs.svelte';
	import { documentBar as db } from '$lib/documentBar.svelte';
	import BandMenu from './BandMenu.svelte';
	import Mark from './Mark.svelte';

	// ---------------------------------------------------------------------------
	// Band A's END zone — what you can do to the working document AS A WHOLE
	// (toolbar round, 2026-08-07). Rendered by both benched tools, so the Team
	// Builder can finally keep the team it just built.
	//
	// Three changes of shape from the planner's old row:
	//
	// 1. ONE Share. There used to be three ways out of a rotation — ⤴ Share in
	//    the tab bar and ⎘ KQM / ⧉ PNG at the far BOTTOM corner of the frame,
	//    one family split across two ends of the tool. They are one menu now,
	//    and the two chart-bound exports register themselves (documentBar's
	//    exporters) so the menu offers exactly what the current tool can
	//    actually produce: on the Team Builder, a team has only a link.
	//
	// 2. The destructive pair moved into the overflow. "Reset" and "Reset all"
	//    sat permanently in the primary bar wearing danger red — far louder than
	//    their frequency deserves, and "Reset all" was nearly a duplicate of
	//    closing every tab, which the tabs' own × already does.
	//
	// 3. Save/Load act on a DOCUMENT, not a notation. The bank has always stored
	//    the team, the loadout and the constellations alongside the text
	//    (SavedNotation); the gate is `hasContent`, which a team satisfies on
	//    its own.
	// ---------------------------------------------------------------------------

	const canExportChart = $derived(!!db.exporters);
</script>

<div class="doc-actions">
	{#if db.notice}
		<span class="doc-notice" transition:fade={{ duration: 180 }}>{db.notice}</span>
	{/if}

	<!-- ONE button, one identity. It used to swap its mark from the floppy to a
	     circular-arrows glyph the moment the document linked, which made it look
	     like a different control — and paired with "Update" it read as a software
	     update rather than "write this over the entry you opened". The action
	     never changed: it is Save either way, so it keeps the save mark and only
	     the word grows. The object of the sentence is the tab label two zones to
	     the left; the title spells it out. -->
	<button
		class="btn"
		class:doc-btn-linked={db.linked}
		type="button"
		disabled={!db.hasContent}
		title={db.linked
			? `Save changes to “${rt.activeTab.label}”`
			: 'Save this team and rotation to your bank'}
		onclick={() => db.save()}
	>
		<Mark name="save" />
		<span class="da-label">{db.linked ? 'Save changes' : 'Save'}</span>
	</button>

	<button
		class="btn"
		type="button"
		title="Open a saved rotation"
		onclick={() => {
			db.resetConfirm = false;
			db.loadOpen = true;
		}}
	>
		<Mark name="load" />
		<span class="da-label">Load</span>
	</button>

	<BandMenu label="Share" mark="share" disabled={!db.hasContent}>
		{#snippet items(close)}
			<button
				class="band-menu-item"
				role="menuitem"
				onclick={() => {
					close();
					db.shareLink();
				}}
			>
				<Mark name="link" />
				Copy link
			</button>
			{#if canExportChart}
				<div class="band-menu-rule"></div>
				<button
					class="band-menu-item"
					role="menuitem"
					onclick={() => {
						close();
						db.shareKqm();
					}}
				>
					<Mark name="copy" />
					Copy KQM notation
				</button>
				<button
					class="band-menu-item"
					role="menuitem"
					onclick={() => {
						close();
						db.sharePng('copy');
					}}
				>
					<Mark name="image" />
					Copy timeline image
				</button>
				<button
					class="band-menu-item"
					role="menuitem"
					onclick={() => {
						close();
						db.sharePng('download');
					}}
				>
					<Mark name="image" />
					Download timeline image
				</button>
			{/if}
		{/snippet}
	</BandMenu>

	<BandMenu compact mark="more" ariaLabel="More rotation actions">
		{#snippet items(close)}
			<!-- The escape hatch from an overwrite. Only meaningful once linked —
			     an unlinked Save already makes a new entry. -->
			{#if db.linked}
				<button
					class="band-menu-item"
					role="menuitem"
					onclick={() => {
						close();
						db.saveAsNew();
					}}
				>
					<Mark name="copy" />
					Save as new
				</button>
				<div class="band-menu-rule"></div>
			{/if}
			<button
				class="band-menu-item band-menu-item--danger"
				role="menuitem"
				onclick={() => {
					close();
					db.resetConfirm = true;
				}}
			>
				<Mark name="reset" />
				Reset this rotation
			</button>
			{#if rt.tabs.length > 1}
				<button
					class="band-menu-item band-menu-item--danger"
					role="menuitem"
					onclick={() => {
						close();
						rt.resetAll();
					}}
				>
					<Mark name="close" />
					Close all rotations
				</button>
			{/if}
		{/snippet}
	</BandMenu>

	<!-- The confirm step comes back OUT of the menu and into the band: a
	     destructive action must be armed where the eye already is, not behind a
	     popover that has closed by the time you decide. .btn--danger.is-confirming
	     is the shared two-step idiom (app.css). -->
	{#if db.resetConfirm}
		<button
			class="btn btn--danger is-confirming"
			type="button"
			title="Confirm: clear this rotation's notation and unlink it from the bank"
			onclick={(e) => {
				e.stopPropagation();
				db.resetDocument();
			}}><Mark name="warn" /> Reset?</button
		>
	{/if}
</div>

<style>
	/* gap: BAND_ITEM_GAP — one value across the whole row, shared with the tab
	   strip (⚓ Nate 2026-08-10). */
	.doc-actions {
		display: flex;
		align-items: center;
		gap: var(--band-item-gap, 4px);
	}

	.doc-notice {
		font-size: var(--fs-sm);
		letter-spacing: var(--ls-wide);
		color: var(--accent);
		padding: 0 0.4rem;
		white-space: nowrap;
	}

	/* The document is linked to a bank entry — the "Save changes" variant reads
	   in the band's accent. Kept local on top of .btn: the global set is
	   base/primary/danger, and "linked" is a document semantic, not a fourth
	   button variant. */
	.doc-btn-linked {
		color: color-mix(in srgb, var(--accent) 55%, var(--text));
	}
	.doc-btn-linked:hover {
		background: var(--accent-hover-fill);
		color: var(--accent);
	}

	/* ══ THE FOLD (responsive round, 2026-09-05) ═══════════════════════════════
	   Below BP.compact ($lib/breakpoints.ts — 40rem) Save · Load · Share drop
	   their WORDS and keep their marks. Band A has the chrome's own priority
	   problem: the tab strip shrinks first (min-width: 0) and this cluster never
	   does, so on a 320px phone the three labelled buttons (~340px with their
	   gaps) left the document tab NO room at all — the row read as
	   Save/Load/Share with no document to save. Marks alone are ~116px, which
	   hands ~170px back to the tab whose label is the one thing here that
	   cannot be guessed. The `title`s still carry the words; the ⋯ menu beside
	   them never had any. ⚠ Literal from the table, by necessity. */
	@media (max-width: 40rem) {
		.da-label,
		.doc-actions :global(.band-menu-label) {
			display: none;
		}
	}
</style>
