<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	/**
	 * SlotPortrait — the roster card shared by the Rotation Planner's timeline
	 * label column and the Team Builder's Bench. Three horizontal bands:
	 *
	 *   1. identity — element glyph + name, then the constellation chip.
	 *   2. portrait — the circular side-avatar, alone, dominating the card.
	 *   3. base — ONE loadout pill (artifact · weapon · refinement), flanked by
	 *      whatever slot actions the host supplies (the Bench's audition/remove;
	 *      the planner supplies none). They ride this band rather than the
	 *      identity row, where they starved the name to five letters, and rather
	 *      than a footer band, which would cost height four times over.
	 *
	 * The constellation chip and the loadout pill wear the same inset capsule
	 * (--sp-pill-*): one height, fill, border and radius, so the card's two value
	 * controls read as a family. Only the VALUE takes the element color when set.
	 *
	 * The pill is a single shape with three hit zones: each opens the same
	 * LoadoutPanel, leading with the section you clicked. That keeps "change
	 * only the weapon" a one-click move while presenting the build as the one
	 * decision it actually is. Empty slots render honestly (blank portrait,
	 * "Empty", dimmed generic loadout art).
	 *
	 * Purely presentational: it displays the resolved (effective) constellation +
	 * loadout it's handed and reports edits through callbacks. Each host decides
	 * which layer those writes land in — the planner writes the tab (Layer 2), the
	 * Team Builder writes the roster (Layer 1) — so this component never touches a
	 * store or knows about layers. The popovers and their viewport-fixed
	 * positioning live here (a full-screen backdrop guarantees only one is ever
	 * open, so per-instance state is safe).
	 */
	import type { Snippet } from 'svelte';
	import { siteSettings, type LoadoutEntry } from '$lib/stores';
	import { getAvatar, getAvatarFallback } from '$lib/utils/getAvatar';
	import { elementPalette } from '$lib/utils/elementColors';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { artifactImagePath } from '$lib/data/artifactLookup';
	import { weaponImagePath } from '$lib/data/weaponLookup';
	import { GENERIC_ARTIFACT_ICON, weaponTypeIcon } from '$lib/utils/loadoutIcons';
	import LoadoutPanel from '$lib/components/LoadoutPanel.svelte';
	import type { LoadoutSection } from '$lib/components/LoadoutPanel.svelte';
	// Popovers + backdrops are viewport-fixed but must clear ANY host stacking
	// context (the Team Builder Bench is `position: sticky`) — see $lib/actions/portal
	import { portal } from '$lib/actions/portal';

	/** The minimal character shape the card renders — an index entry or a loaded
	 *  payload both satisfy it. null = empty slot. */
	type SlotChar = { id: string; displayName: string; element?: string; weapon?: string } | null;

	let {
		slotId,
		char,
		conLevel,
		loadoutEntry,
		onSetCon,
		onSetArtifact,
		onSetWeapon,
		onSetRefinement,
		onPortraitClick,
		portraitLabel = 'Open character selector',
		emptyLabel = 'Empty',
		actions
	}: {
		/** Raw avatar id (the character id, or 'blank' for an empty slot). */
		slotId: string;
		/** Resolved character, or null while unresolved / empty. */
		char: SlotChar;
		/** Effective constellation level to display (already layer-resolved). */
		conLevel: number;
		/** Effective loadout to display (already layer-resolved). */
		loadoutEntry: LoadoutEntry;
		onSetCon: (level: number) => void;
		onSetArtifact: (artifactSetId: string | undefined) => void;
		onSetWeapon: (weaponId: string | undefined, refinement: 1 | 2 | 3 | 4 | 5) => void;
		onSetRefinement: (r: 1 | 2 | 3 | 4 | 5) => void;
		/** When set, the portrait becomes an interactive button (planner: open the
		 *  selector; Bench: open the character / add). Omit for a static portrait. */
		onPortraitClick?: () => void;
		portraitLabel?: string;
		/** Text shown in the name area for an empty (char===null) slot. Both tools
		 *  pass '' — four blank portraits ARE the empty state, and a column of
		 *  "Empty" labels only adds noise. Kept as a prop for a host that wants one. */
		emptyLabel?: string;
		/** Host-supplied slot actions, seated either side of the loadout pill
		 *  (first left, last right). The Bench passes audition/remove; the planner
		 *  passes nothing. */
		actions?: Snippet;
	} = $props();

	const p = $derived(elementPalette(char?.element));

	// Frame-timing-not-curated mark. `curated` lives on the INDEX entry, not on
	// the loaded payload the planner hands us, so it is looked up here rather
	// than threaded through two hosts that carry different shapes — one source,
	// both tools correct.
	//
	// `blank` is excluded even though it is genuinely curated:false. The mark
	// promises "not curated YET — timing is approximate for now", and that is a
	// claim about pending work. Blank is the generic placeholder: approximate
	// timing is the whole point of it, permanently. The roster surfaces never
	// had to say this because they filter blank out of the corpus entirely; the
	// slot card is the one place it renders.
	const uncurated = $derived(
		!!char && char.id !== 'blank' && getCharacterIndexEntry(char.id)?.curated === false
	);

	function slotLabel(c: NonNullable<SlotChar>): string {
		return c.id.startsWith('traveler') ? 'Traveler' : c.displayName;
	}
	function initials(name: string): string {
		return name.slice(0, 2).toUpperCase();
	}

	// Avatar fallback (per instance) — reset whenever the slot's character changes.
	let avatarFallback = $state(false);
	$effect(() => {
		void slotId;
		avatarFallback = false;
	});
	function handleAvatarError(event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src.includes('-newfit')) {
			img.src = getAvatarFallback(slotId, 'side', $siteSettings.travelerVariant);
		} else {
			avatarFallback = true;
		}
	}

	// ── Loadout pill state ───────────────────────────────────────────────────
	const currentRef = $derived(loadoutEntry?.weaponRefinement ?? 1);
	const hasWeapon = $derived(!!loadoutEntry?.weaponId);
	const artifactIcon = $derived(
		loadoutEntry?.artifactSetId
			? artifactImagePath(loadoutEntry.artifactSetId)
			: GENERIC_ARTIFACT_ICON
	);
	const weaponIcon = $derived(
		loadoutEntry?.weaponId ? weaponImagePath(loadoutEntry.weaponId) : weaponTypeIcon(char?.weapon)
	);

	// ── Popovers (constellation pips + the loadout panel) ────────────────────
	let conOpen = $state(false);
	let conX = $state(0);
	let conY = $state(0);
	let conFlip = $state(false);
	let loadoutOpen = $state(false);
	let loadoutX = $state(0);
	let loadoutY = $state(0);
	let loadoutFlip = $state(false);
	let loadoutSection = $state<LoadoutSection>('artifact');

	// The widest picker (the loadout panel) — the flip decision's estimate, since
	// the popover hasn't rendered when the side is chosen.
	const POPOVER_W = 220;

	function anchorTo(e: MouseEvent): { x: number; y: number; flip: boolean } {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		// Default opens to the chip's right (the planner's left-edge portrait
		// column); the TB Bench holds the RIGHT viewport edge, where that side
		// can't fit — flip to the chip's left when it would overflow.
		const flip = rect.right + 8 + POPOVER_W > window.innerWidth;
		return { x: flip ? rect.left - 8 : rect.right + 8, y: rect.top + rect.height / 2, flip };
	}

	function openConstellation(e: MouseEvent) {
		e.stopPropagation();
		loadoutOpen = false;
		if (conOpen) {
			conOpen = false;
			return;
		}
		({ x: conX, y: conY, flip: conFlip } = anchorTo(e));
		conOpen = true;
	}
	function chooseCon(level: number) {
		onSetCon(level);
		conOpen = false;
	}

	function openLoadout(e: MouseEvent, section: LoadoutSection) {
		e.stopPropagation();
		conOpen = false;
		// Re-clicking the zone that opened the panel closes it; clicking a
		// DIFFERENT zone re-leads the open panel rather than dismissing it.
		if (loadoutOpen && loadoutSection === section) {
			loadoutOpen = false;
			return;
		}
		loadoutSection = section;
		({ x: loadoutX, y: loadoutY, flip: loadoutFlip } = anchorTo(e));
		loadoutOpen = true;
	}

	function closePopovers() {
		conOpen = false;
		loadoutOpen = false;
	}
</script>

<div class="sp-card" style:--el={p.main}>
	<!-- Identity row: element glyph + name ranged left, constellation chip right.
	     Slot actions do NOT live here — they ride the base band. -->
	<div class="sp-id-row">
		<span class="sp-id-name">
			{#if char?.element}
				<img class="sp-el-badge" src={elementIcon(char.element)} alt={char.element} />
			{/if}
			<span class="sp-char-name" class:sp-char-name--empty={!char}
				>{char ? slotLabel(char) : emptyLabel}</span
			>
		</span>
		{#if uncurated}
			<span
				class="sp-namemark"
				title="Frame timing not curated yet — capabilities are complete, but Planner timing is approximate"
				aria-label="Frame timing not curated yet">∅</span
			>
		{/if}
		<button
			class="sp-cons-chip"
			class:sp-cons-chip--set={conLevel > 0}
			disabled={!char}
			onclick={openConstellation}
			aria-label={char ? `Set constellation for ${char.displayName}` : 'Constellation (empty slot)'}
			>C{conLevel}</button
		>
	</div>

	<div class="sp-portrait-area">
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			class="sp-avatar-chip"
			class:sp-avatar-clickable={!!onPortraitClick}
			onclick={onPortraitClick}
			role={onPortraitClick ? 'button' : undefined}
			tabindex={onPortraitClick ? 0 : undefined}
			aria-label={onPortraitClick ? portraitLabel : undefined}
		>
			<span class="sp-avatar-clip">
				{#if !avatarFallback}
					<img
						class="sp-avatar-img"
						src={getAvatar(
							slotId,
							$siteSettings.useNewOutfits,
							'side',
							$siteSettings.travelerVariant
						)}
						alt={char?.displayName ?? 'Empty slot'}
						onerror={handleAvatarError}
					/>
				{:else}
					<span class="sp-avatar-initials">{initials(char?.displayName ?? slotId)}</span>
				{/if}
			</span>
		</div>
	</div>

	<!-- Base band: the loadout pill, flanked by any host slot actions. The
	     actions wrapper is `display: contents`, so the buttons become flex items
	     of THIS row and `order` seats the first left of the pill and the last
	     right of it — one `actions` snippet, two sides. -->
	<div class="sp-loadout-row">
		{#if actions}<span class="sp-actions">{@render actions()}</span>{/if}
		<div class="sp-loadout" class:sp-loadout--disabled={!char}>
			<button
				class="sp-lo-zone"
				disabled={!char}
				onclick={(e) => openLoadout(e, 'artifact')}
				title={char ? 'Artifact set' : undefined}
				aria-label="Choose artifact set"
			>
				<img
					class="sp-lo-icon"
					class:sp-lo-icon--unset={!loadoutEntry?.artifactSetId}
					src={artifactIcon}
					alt=""
				/>
			</button>
			<button
				class="sp-lo-zone"
				disabled={!char}
				onclick={(e) => openLoadout(e, 'weapon')}
				title={char ? 'Weapon' : undefined}
				aria-label="Choose weapon"
			>
				<img class="sp-lo-icon" class:sp-lo-icon--unset={!hasWeapon} src={weaponIcon} alt="" />
			</button>
			<button
				class="sp-lo-zone sp-lo-ref"
				class:sp-lo-ref--set={hasWeapon}
				disabled={!char}
				onclick={(e) => openLoadout(e, 'refinement')}
				title={char ? 'Weapon refinement' : undefined}
				aria-label="Set weapon refinement">R{currentRef}</button
			>
		</div>
	</div>
</div>

<!-- ── Constellation + loadout popovers ────────────────────────────────────── -->
{#if conOpen || loadoutOpen}
	<div
		class="sp-popover-backdrop"
		role="button"
		tabindex="-1"
		aria-label="Close picker"
		use:portal
		onclick={closePopovers}
		onkeydown={(e) => {
			if (e.key === 'Escape') closePopovers();
		}}
	></div>
{/if}
{#if conOpen}
	<div
		class="sp-popover"
		class:sp-popover--flip={conFlip}
		use:portal
		style:left="{conX}px"
		style:top="{conY}px"
	>
		{#each [0, 1, 2, 3, 4, 5, 6] as level (level)}
			<button
				class="sp-pip"
				class:sp-pip--filled={level > 0 && level <= conLevel}
				class:sp-pip--current={level === conLevel}
				style:--pip-color={p.main}
				onclick={() => chooseCon(level)}>{level}</button
			>
		{/each}
	</div>
{/if}
{#if loadoutOpen && char}
	<div
		class="sp-popover sp-popover--panel"
		class:sp-popover--flip={loadoutFlip}
		use:portal
		style:left="{loadoutX}px"
		style:top="{loadoutY}px"
	>
		<LoadoutPanel
			{loadoutEntry}
			weaponType={char.weapon}
			elementColor={p.main}
			section={loadoutSection}
			onSetArtifact={(id) => onSetArtifact(id)}
			onSetWeapon={(id, r) => onSetWeapon(id, r)}
			onSetRefinement={(r) => onSetRefinement(r)}
		/>
	</div>
{/if}

<style>
	/* ── Card ─────────────────────────────────────────────────────────────────
	   Three bands: identity header across the top, the portrait centered — alone —
	   in the middle space, and the loadout pill grounded at the base. `flex: 1`
	   lets the card fill a host cell of fixed height (the planner's timeline row,
	   whose height varies per slot); with no such height (the Bench) it collapses
	   to content, which is what keeps four cards inside the viewport-fit frame. */
	.sp-card {
		box-sizing: border-box;
		flex: 1;
		min-height: 0;
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		padding: 8px 10px 10px 8px;
		gap: 8px;

		/* The two controls that wear the inset-capsule treatment — the
		   constellation chip and the loadout pill — share every one of these, so
		   they read as one family. Change them here, never on one alone. */
		--sp-pill-h: 26px;
		--sp-pill-border: 1.5px solid var(--frame-line);
		/* Page ground at the top falling to the FRAME's ground below — lighter
		   stop low, the reverse of the roster cards' portrait gradient, which is
		   what gives these an INSET read rather than a raised one. No element
		   tint: these are chrome, and the element already speaks through the
		   glyph, the portrait ring and the set values.
		
		   ⚠ THE STOP POSITION IS THE WEIGHT KNOB. At 100% the gradient is still
		   climbing when it runs out of pill, so every pixel is darker than the
		   frame it sits on and the control reads heavy. Landing the frame-ground
		   stop early concentrates the dark into a band under the TOP edge — an
		   inner shadow — and lets the rest sit flush with its surroundings. Lower
		   = tighter, heavier shadow; higher = softer but darker overall. */
		--sp-pill-stop: 50%;
		--sp-pill-fill: linear-gradient(180deg, var(--bg) 0%, var(--frame-bg) var(--sp-pill-stop));

		/* The portrait keeps the ELEMENT wash the roster cards use — a portrait
		   wants a lit backing, not the chrome fill the controls wear, and the art
		   sits far better on it. Same reversed direction as the pills (tint at the
		   BOTTOM), so the card still reads as one surface. */
		--sp-avatar-fill: linear-gradient(
			180deg,
			var(--frame-bg) 0%,
			color-mix(in srgb, var(--el, var(--neutral)) 14%, var(--bg)) 100%
		);
	}

	.sp-portrait-area {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* ── Base band ────────────────────────────────────────────────────────────
	   The loadout pill, centered, flanked by any host slot actions. `contents`
	   dissolves the actions wrapper so its buttons become flex items of this row;
	   `order` then seats the first one left of the pill and the last one right,
	   which is how ONE snippet fills both sides. */
	.sp-loadout-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		min-width: 0;
	}
	.sp-actions {
		display: contents;
	}
	.sp-actions :global(> *:first-child) {
		order: -1;
	}
	.sp-actions :global(> *:last-child) {
		order: 1;
	}

	/* Identity row: glyph+name ranged left, constellation + host actions right. */
	.sp-id-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		min-width: 0;
	}
	/* Glyph + name metrics are the roster card's (CharacterCard's comfortable
	   band, --fs-md): 15px glyph, 0.3rem gap, ranged left. */
	.sp-id-name {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		min-width: 0;
	}
	/* Sized as large as the longest roster names allow: single-word names sit on
	   one line; multi-word outliers (Sangonomiya Kokomi, Shikanoin Heizou…) wrap
	   to a second line rather than truncate. */
	.sp-char-name {
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--text);
		line-height: var(--lh-tight);
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		max-width: 100%;
		letter-spacing: var(--ls-tight);
	}
	.sp-char-name--empty {
		color: var(--muted);
		font-weight: var(--fw-medium);
		opacity: 0.55;
	}

	/* Frame-timing-not-curated mark — mirrors CharacterCard's .cc-namemark
	   exactly (bold dire ∅, --fs-2xl, the same em-based lift for the glyph's low
	   line-box seat, cursor:help). Capability data is complete; only Planner
	   timing is approximate. No chip — it sits on the card surface. The card
	   pins it far right; here the constellation chip is last, so it seats just
	   left of that. */
	.sp-namemark {
		/* margin-RIGHT auto, not left: the auto margin swallows the row's free
		   space on the mark's far side, so the mark stays snug against the name
		   and the constellation chip keeps the right edge. (The roster card pins
		   its mark right with margin-left because there it IS the last item.) */
		margin-right: auto;
		flex-shrink: 0;
		color: color-mix(in srgb, var(--dire) 80%, white);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-bold);
		line-height: var(--lh-none);
		/* In `em` so the lift scales with the glyph's own font-size. Nate's
		   measured value at this card's scale — the roster card's -0.1em sits
		   the glyph slightly low here. */
		transform: translateY(-0.08em);
		cursor: help;
	}

	/* Element glyph inline with the name — the in-game card language, at the
	   roster card's .cc-el size. */
	.sp-el-badge {
		flex-shrink: 0;
		width: 15px;
		height: 15px;
		background: none;
		pointer-events: none;
	}

	/* Constellation selector: the loadout pill's twin — identical height, fill,
	   border and radius, so the card's two value controls are one family. It is
	   no longer a global .chip; that class carried a different fill and radius,
	   all of which this overrode. Only the VALUE changes with state: gray unset,
	   element-tinted when set — the same contract the refinement zone follows. */
	.sp-cons-chip {
		box-sizing: border-box;
		flex-shrink: 0;
		height: var(--sp-pill-h);
		width: var(--sp-pill-h);
		display: grid;
		place-items: center;
		border: var(--sp-pill-border);
		border-radius: var(--r-round);
		background: var(--sp-pill-fill);
		color: var(--muted);
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-wide);
		line-height: var(--lh-none);
		cursor: pointer;
		transition:
			border-color 150ms ease,
			color 150ms ease;
		z-index: 1;
	}
	.sp-cons-chip:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--el) 45%, var(--frame-line));
		color: var(--text);
	}
	.sp-cons-chip:disabled {
		opacity: 0.35;
		cursor: default;
		pointer-events: none;
	}
	.sp-cons-chip--set {
		color: color-mix(in srgb, var(--el) 75%, white);
	}

	/* ── Loadout pill ─────────────────────────────────────────────────────────
	   One shape, three zones (artifact · weapon · refinement), each opening the
	   same panel led by its own section. Wears the shared inset capsule
	   treatment (--sp-pill-*) with the constellation chip, and the same fill the
	   portrait sits on, so the bands read as one surface rather than as a chip
	   stuck under a picture. */
	.sp-loadout {
		/* Hugs its content and centers under the portrait rather than spanning the
		   card: a compact capsule reads as one object you click, where a
		   full-width bar read as a third structural band competing with the
		   portrait. */
		box-sizing: border-box;
		max-width: 100%;
		height: var(--sp-pill-h);
		display: flex;
		align-items: center;
		gap: 1px;
		padding: 0;
		border: var(--sp-pill-border);
		border-radius: var(--r-round);
		background: var(--sp-pill-fill);
	}
	.sp-loadout--disabled {
		opacity: 0.35;
	}
	.sp-lo-zone {
		display: grid;
		place-items: center;
		flex: 0 0 auto;
		width: 24px;
		height: 100%;
		padding: 0;
		border: none;
		/* Fully round so the end zones stay inside the pill's rounded ends. */
		border-radius: var(--r-round);
		background: none;
		cursor: pointer;
		transition: background 150ms ease;
	}
	/* Hover brightens the CONTENT, it does not fill the zone — the same move the
	   constellation chip and the slot actions make, and the only one that keeps
	   the pill reading as ONE shape. A filled disc inside the capsule fragments
	   it, and lands on the same circle silhouette as the action chips flanking
	   it. To go back to a fill, this rule is the whole change. */
	.sp-lo-zone:hover:not(:disabled) .sp-lo-icon {
		opacity: 1;
	}
	/* ⚠ An unset icon must stay visibly BELOW a set one even while hovered —
	   opacity is this card's signal for "nothing equipped", so hover must not
	   push an empty slot into looking filled. 0.65 hovered < 0.85 at rest. */
	.sp-lo-zone:hover:not(:disabled) .sp-lo-icon--unset {
		opacity: 0.65;
	}
	.sp-lo-zone:disabled {
		cursor: default;
	}
	.sp-lo-icon {
		width: 100%;
		height: 100%;
		object-fit: contain;
		/* Held just below full so hover has somewhere to go. (Element `opacity`
		   is safe here — the WebKit transparency-layer jitter documented for the
		   chrome needs an element at FRACTIONAL coordinates that MOVE; these sit
		   in a static card, and the unset state already ships this property.) */
		opacity: 0.85;
		transition: opacity 150ms ease;
	}
	/* An empty slot wears generic art dimmed — still legibly a thing you click,
	   never a hole. */
	.sp-lo-icon--unset {
		opacity: 0.4;
	}
	/* Refinement rides the pill as a third zone. Weapons are always R1–R5, so it
	   is never absent — gray until a weapon is equipped, element-tinted after,
	   mirroring the constellation chip exactly. */
	.sp-lo-ref {
		width: auto;
		min-width: 24px;
		padding: 0 5px;
		color: var(--muted);
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-mid);
		line-height: var(--lh-none);
		white-space: nowrap;
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	.sp-lo-ref--set {
		color: color-mix(in srgb, var(--el) 75%, white);
	}
	/* Exactly the constellation chip's hover: the value goes to --text. */
	.sp-lo-ref:hover:not(:disabled) {
		color: var(--text);
	}

	/* ── Portrait ─────────────────────────────────────────────────────────────
	   Circular — the side-avatar art is cropped to a circle in-game, so the
	   portrait honours that shape. Backed by --sp-avatar-fill: the roster cards'
	   element wash, flipped so the tint sits at the BOTTOM like everything else
	   on this card. Element identity also rides the small glyph badge in the
	   identity row and the clip border. */
	.sp-avatar-chip {
		position: relative;
		/* THE portrait-size knob. Nate's concepts drew 68; the art's framing is
		   independent of it (see .sp-avatar-img), so this is free to retune and
		   only the bench width tokens need to follow. */
		width: 68px;
		height: 68px;
		border-radius: var(--r-round);
		flex-shrink: 0;
	}
	.sp-avatar-clip {
		position: absolute;
		inset: 0;
		border-radius: var(--r-round);
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--sp-avatar-fill);
		/* Resting is the RECEDED edge; hover brings it up to full element. The
		   two used to be the other way round, which left hover with nowhere to
		   go — it dimmed on interaction. */
		border: 1.5px solid color-mix(in srgb, var(--el, #6a7080) 85%, transparent);
		transition: box-shadow 150ms ease;
	}
	.sp-avatar-clickable {
		cursor: pointer;
	}
	/* Element-tinted EDGE on hover, not a glow. The glow this used to carry
	   ("same recipe as the chrome ?/gear buttons") outlived its own reference:
	   the chrome dropped its halo, and so has everything else. */
	.sp-avatar-clickable:hover .sp-avatar-clip {
		border-color: var(--el, #9eacc8);
	}
	.sp-avatar-img {
		/* Side avatars are 128×128 with the character positioned toward the
		   center/bottom. This scale+offset is the correct framing of that art in
		   a circle, measured by Nate in the inspector — it is INDEPENDENT of the
		   circle's diameter (the transform rides along), so the size knob above
		   can move without retuning these two numbers. */
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.25) translateY(-12%);
	}
	.sp-avatar-initials {
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-mid);
		color: var(--text);
	}

	/* ── Popovers (constellation pips + the loadout panel) ────────────────────
	   Full-screen backdrop (z 949) captures the dismiss click and guarantees only
	   one popover is open at a time; the picker (z 950) is viewport-fixed beside
	   the zone that opened it. */
	.sp-popover-backdrop {
		position: fixed;
		inset: 0;
		/* Portaled to <body>, so this competes at the root stacking level. High
		   enough to clear the tool panels (Bench sticky, Source rail) but below the
		   1000 modal layer, which never coexists with this picker. */
		z-index: 949;
	}
	.sp-popover {
		position: fixed;
		transform: translateY(-50%);
	}
	/* Anchored at the chip's LEFT edge when the right side can't fit it (the
	   TB Bench holds the right viewport edge) — same vertical centering. */
	.sp-popover--flip {
		transform: translate(-100%, -50%);
	}
	.sp-popover {
		z-index: 950;
		background: var(--surface-raised);
		border: none;
		border-radius: var(--r-md);
		padding: 7px 9px;
		display: flex;
		align-items: center;
		gap: 4px;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.06),
			0 4px 16px rgba(0, 0, 0, 0.5);
	}
	/* The loadout panel is taller than a pip row, so it is clamped to the
	   viewport rather than centered on its anchor when it would overflow. */
	.sp-popover--panel {
		padding: 10px 11px;
		max-height: calc(100vh - 16px);
		overflow-y: auto;
	}
	.sp-pip {
		width: 24px;
		height: 24px;
		border-radius: var(--r-round);
		border: none;
		background: rgba(255, 255, 255, 0.06);
		color: var(--muted);
		font-family: var(--font-body);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		transition:
			background 150ms ease,
			box-shadow 150ms ease,
			color 150ms ease;
	}
	.sp-pip--filled {
		background: color-mix(in srgb, var(--pip-color) 22%, transparent);
		color: var(--pip-color);
	}
	.sp-pip--current {
		background: color-mix(in srgb, var(--pip-color) 30%, transparent);
		box-shadow: inset 0 0 0 1.5px var(--pip-color);
	}
	.sp-pip:hover {
		background: rgba(255, 255, 255, 0.12);
		color: var(--pip-color, var(--text));
	}
</style>
