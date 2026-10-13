<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import Mark from './Mark.svelte';
	import ConMark from './ConMark.svelte';
	import SidePortrait from './SidePortrait.svelte';
	/**
	 * SlotPortrait — the slot card of the bench ribbon, shared by the Rotation
	 * Planner (where it labels a timeline track group) and the Team Builder.
	 *
	 * ══ IT IS A ROW (⚓ NATE's mockup, the bench-card round 2026-08-12) ═══════
	 * THREE COLUMNS on ONE band the height of the portrait:
	 *
	 *   1. rail — the host's slot commands, stacked, splitting the portrait's
	 *      height between them (↻ ⇄ alone since ✕ retired, 2026-10-13 — it
	 *      takes the whole height until the portrait round re-lays the card). On the strip's quiet inner edge:
	 *      a rail on the RIGHT would sit flush against the E/Q bars at the
	 *      planner's busiest seam, which is the objection that killed this
	 *      layout's first outing in 2026-07-30.
	 *   2. portrait — the circular side avatar, overlapping the rail by
	 *      --sp-rail-overlap so the two columns cost less than their sum.
	 *   3. column — the name ranged along the disc's TOP edge, the value
	 *      controls along its BOTTOM. Two lines of --fs-lg name over a 26px
	 *      control row is exactly 68px, which is exactly the disc: the three
	 *      columns square up on one band by construction.
	 *
	 * It replaced a three-band STACK (identity / portrait / loadout) whose outer
	 * two bands were fixed at 86px, leaving the portrait as the only thing that
	 * could absorb a change in slot height — so on a typical rotation the disc
	 * rendered at 40px, the smallest object on a card it is supposed to lead.
	 * The full argument is in benchBand.svelte.ts; the short version is that a
	 * name BESIDE a portrait is free and a name BELOW one is not.
	 *
	 * ══ TWO REGISTERS OF CONTROL (⚓ NATE, same round) ═══════════════════════
	 * VALUE CONTROLS ARE WELLS; COMMAND BUTTONS ARE RAISED. The constellation
	 * chip and the loadout pill are places data sits, cut into the card
	 * (--surface-well); the rail's ⇄ is a thing you press, standing on it
	 * (--surface-raised, and they are squares rather than capsules). They used
	 * to share one fill as "one family", which is precisely why the old base
	 * band read as a single continuous bar of chrome heavy enough to outweigh
	 * the portrait.
	 *
	 * The loadout pill is one shape with TWO hit zones now — artifact and
	 * weapon, the refinement having become a corner digit on the weapon icon.
	 * Both open the same LoadoutPanel — which zone you clicked decides only
	 * whether a second click closes it, not how the panel reads (the lead
	 * emphasis went 2026-08-14) — and that panel always renders its refinement
	 * pips, so nothing became unreachable;
	 * setting refinement alone costs one extra click and gave back 24px of card.
	 *
	 * Purely presentational: it displays the resolved (effective) constellation +
	 * loadout it's handed and reports edits through callbacks. Each host decides
	 * which layer those writes land in — so this component never touches a store
	 * or knows about layers. The popovers and their viewport-fixed positioning
	 * live here (a full-screen backdrop guarantees only one is ever open, so
	 * per-instance state is safe).
	 */
	import type { Snippet } from 'svelte';
	import { siteSettings, type LoadoutEntry } from '$lib/stores';
	import { getAvatar, getAvatarFallback } from '$lib/utils/getAvatar';
	import { CARD_PORTRAIT, CARD_PORTRAIT_COMPACT } from '$lib/benchBand.svelte';
	import { elementPalette } from '$lib/utils/elementColors';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { artifactImagePath, getArtifactSetById } from '$lib/data/artifactLookup';
	import { weaponImagePath } from '$lib/data/weaponLookup';
	import { GENERIC_ARTIFACT_ICON, weaponTypeIcon } from '$lib/utils/loadoutIcons';
	import LoadoutPanel from '$lib/components/LoadoutPanel.svelte';
	import type { LoadoutSection } from '$lib/components/LoadoutPanel.svelte';
	// Popovers + backdrops are viewport-fixed but must clear ANY host stacking
	// context (the Team Builder Bench is `position: sticky`) — see $lib/actions/portal
	import { portal } from '$lib/actions/portal';
	import { fade } from 'svelte/transition';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';

	/** The minimal character shape the card renders — an index entry or a loaded
	 *  payload both satisfy it. null = empty slot. */
	type SlotChar = { id: string; displayName: string; element?: string; weapon?: string } | null;

	let {
		slotId,
		char,
		compact = false,
		conLevel,
		loadoutEntry,
		onSetCon,
		onSetArtifact,
		onSetWeapon,
		onSetRefinement,
		onPortraitClick,
		portraitLabel = 'Open character selector',
		emptyLabel = 'Empty',
		actions,
		portrait = 'disc',
		conOnDisc = false,
		ownedCon,
		compactDisc = CARD_PORTRAIT_COMPACT
	}: {
		/** Raw avatar id (the character id, or 'blank' for an empty slot). */
		slotId: string;
		/**
		 * The COMPACT form (responsive round, 2026-09-05): the bench ribbon's
		 * row, when four cards do not fit at full width. The disc and the rail on
		 * one row, the value controls on the next, the name gone — the portrait
		 * is the name at this size. Same 78px height as the full row form, by
		 * construction (CARD_PORTRAIT_COMPACT is solved from it), so the strip
		 * that holds four of these is one height whichever form they take.
		 */
		compact?: boolean;
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
		/** When set, the portrait becomes an interactive button. Both tools route
		 *  a FILLED portrait to the character's Detail card and an EMPTY one to
		 *  their swap affordance; the card doesn't need to know which is which.
		 *  Omit for a static portrait. */
		onPortraitClick?: () => void;
		portraitLabel?: string;
		/** Text shown in the name area for an empty (char===null) slot. Both tools
		 *  pass '' — four blank portraits ARE the empty state, and a column of
		 *  "Empty" labels only adds noise. Kept as a prop for a host that wants one. */
		emptyLabel?: string;
		/** Host-supplied slot commands, stacked in the card's left RAIL and
		 *  stretched to split the portrait's height between them. The bench
		 *  passes ⇄ alone (✕ retired 2026-10-13).
		 *  ↻ 2026-08-12: this used to be a `display: contents` + `order` trick
		 *  seating one snippet on BOTH sides of the loadout pill. The rail is an
		 *  ordinary flex column, so the trick is gone — buttons render in source
		 *  order, top to bottom. */
		actions?: Snippet;
		/**
		 * 🧪 CANDIDATE (bench portrait round, 2026-10-13 — judged on /lab, lineups
		 * design §9.5 / §9.5a): `side` draws the Team Builder's overhanging side
		 * portrait in the disc's place — the same band, the hair rising over the
		 * card's top edge. Every host passes nothing until Nate rules.
		 */
		portrait?: 'disc' | 'side';
		/** With `portrait: 'side'`: the constellation control moves ONTO the disc
		 *  (the TB chip's place, still the editor), and the column keeps the name,
		 *  the loadout pill and the host's actions — no rail. */
		conOnDisc?: boolean;
		/** Your account's constellation for this character — a level, `null` = not
		 *  owned, undefined = unknown (empty roster / marks off). When it falls
		 *  short of `conLevel` the constellation control goes HOLLOW (§9.5a). */
		ownedCon?: number | null;
		/** 🧪 The side form's COMPACT portrait, which the host solves from the
		 *  card's width (the upright phone card: portrait + 4 + the 26px pill). */
		compactDisc?: number;
	} = $props();

	const side = $derived(portrait === 'side');
	const discCon = $derived(side && conOnDisc);
	/** The plan asks for more than the account has (or for someone not owned). */
	const conShort = $derived(
		!!char &&
			char.id !== 'blank' &&
			ownedCon !== undefined &&
			(ownedCon === null || ownedCon < conLevel)
	);
	const conTitle = $derived(
		!char || !conShort
			? undefined
			: ownedCon === null
				? `You don't own ${char.displayName}`
				: `This rotation uses C${conLevel} · you own C${ownedCon}`
	);

	const p = $derived(elementPalette(char?.element));

	/** 🎛️ The constellation glyph's cap height. 8px is the ink the old --fs-sm
	 *  text laid down (11px × Plex Sans' 0.698 cap ratio ≈ 7.7), so the swap from
	 *  type to vector changed nothing about how big the value reads. */
	const CON_GLYPH_H = 8;

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

	// Constellation-locked characters (Aloy) have nothing to set — the chip
	// stays for layout but renders inert.
	const noCons = $derived(!!char && getCharacterIndexEntry(char.id)?.noConstellations === true);

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
	// ⚠ The stored id is checked against the SET LIST, not just for presence.
	// A loadout is localStorage-backed and a set can leave the roster (Maiden
	// Beloved did, 2026-08-14), so a saved id can outlive its set. The art is
	// add-only and survives deletion, so the unguarded path drew the pill of a
	// set the panel below it reports as "None" — the pill has to agree with the
	// panel, and the panel can only offer what still exists.
	const artifactIcon = $derived(
		loadoutEntry?.artifactSetId && getArtifactSetById(loadoutEntry.artifactSetId)
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
		// column); flip to the chip's left when that would overflow the viewport
		// (the row form's rightmost cards at narrow widths).
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

<!-- ↻ 2026-08-05 (archetype consistency pass): the `ctx-light` class that used
     to sit here is REMOVED, and the card inherits the ribbon's dark context.
     It was declaring a context it never painted — .sp-card has no background
     of its own, so the light context's warm-brown --text was rendering
     straight onto BenchBand's navy at 2.33:1, the worst contrast in the app,
     while --frame-bg resolved to paper and blew the inset pills and the
     avatar disc out to near-white (the three brightest objects in the planner
     were the ⇄ / loadout / ✕ chips). A context class has to come with its
     ground; this component is used only inside the always-dark ribbon, so the
     ground is dark. Almost certainly a leftover from when these cards lived in
     the Team Builder's light bench zone.
     ⚠ NOT a redesign — the card-interior restyle to Nate's mockup (ringed
     portrait, circular chips) is its own queued round. This only makes the
     card legible on the ground it actually sits on. -->
<div
	class="sp-card"
	class:sp-card--compact={compact}
	class:sp-card--side={side}
	style:--el={p.main}
	style:--sp-band="{CARD_PORTRAIT}px"
	style:--sp-band-compact="{CARD_PORTRAIT_COMPACT}px"
	style:--sp-side-d="{compactDisc}px"
>
	<!-- ONE band, three columns. `max-height: 100%` on the body is what keeps a
	     card in a slot shorter than its own content from spilling instead of
	     shrinking — see .sp-avatar-chip for the bug that taught us. -->
	<div class="sp-body">
		<!-- The RAIL. Rendered and VISIBLE on every slot; the host disables its
		     buttons on an empty one. See the empty-slot note on .sp-controls. -->
		{#if !discCon}
			<div class="sp-rail">
				{#if actions}{@render actions()}{/if}
			</div>
		{/if}

		{#if side}
			<!-- 🧪 The side portrait (candidate): anchored at the band's bottom, so
			     the art's overhang rises ABOVE the card rather than growing it. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div
				class="sp-avatar-chip sp-side"
				class:sp-avatar-clickable={!!onPortraitClick}
				onclick={onPortraitClick}
				role={onPortraitClick ? 'button' : undefined}
				tabindex={onPortraitClick ? 0 : undefined}
				aria-label={onPortraitClick ? portraitLabel : undefined}
			>
				<span class="sp-side-art">
					<SidePortrait id={char ? slotId : null} size={compact ? compactDisc : CARD_PORTRAIT} />
				</span>
				{#if discCon && char}
					<button
						class="sp-disc-con"
						class:sp-disc-con--short={conShort}
						class:sp-disc-con--zero={conLevel === 0 && !conShort}
						disabled={noCons}
						onclick={openConstellation}
						title={conTitle ??
							(noCons ? 'Constellations can’t be unlocked for this character' : undefined)}
						aria-label={noCons
							? `${char.displayName} has no constellations`
							: `Set constellation for ${char.displayName}, currently C${conLevel}`}
					>
						<ConMark level={conLevel} height={7} />
					</button>
				{/if}
			</div>
		{:else}
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
		{/if}

		<!-- The column: name along the disc's top edge, value controls along its
		     bottom. -->
		<div class="sp-col">
			<div class="sp-id-row">
				<!-- 🧪 The side form drops the element badge (⚓ Nate 2026-10-13): the
				     planner's bars already wear the element, as the Builder's cards do
				     for its slots, and the name gets the width back. -->
				{#if char?.element && !side}
					<img class="sp-el-badge" src={elementIcon(char.element)} alt={char.element} />
				{/if}
				<span class="sp-char-name" class:sp-char-name--empty={!char}
					>{char ? slotLabel(char) : emptyLabel}</span
				>
				{#if uncurated}
					<span
						class="sp-namemark"
						title="Frame timing not curated yet — capabilities are complete, but Planner timing is approximate"
						aria-label="Frame timing not curated yet"><Mark name="uncurated" size={11} /></span
					>
				{/if}
			</div>

			<!-- ⚓ NATE 2026-08-12: AN EMPTY SLOT KEEPS ITS FOUR STATIONS, all inert.
			     A first pass hid them — four blank discs being the empty state, and
			     eight dead controls only saying it louder. That reasoning was wrong
			     about what the strip is FOR: the controls are the slot's shape, and
			     a card that loses them stops reading as a slot waiting to be filled
			     and starts reading as a different, smaller kind of card. The one
			     thing that genuinely has nothing to say is the NAME, which stays
			     empty (both hosts pass emptyLabel=''). Restores the four-station
			     rhythm from 2026-08-06, which was right the first time. -->
			<div class="sp-controls">
				{#if !discCon}
					<button
						class="sp-cons-chip"
						class:sp-cons-chip--set={conLevel > 0}
						class:sp-cons-chip--short={side && conShort}
						disabled={!char || noCons}
						onclick={openConstellation}
						title={noCons
							? 'Constellations can’t be unlocked for this character'
							: side
								? conTitle
								: undefined}
						aria-label={char
							? noCons
								? `${char.displayName} has no constellations`
								: `Set constellation for ${char.displayName}, currently C${conLevel}`
							: 'Constellation (empty slot)'}
					>
						<ConMark level={conLevel} height={CON_GLYPH_H} />
					</button>
				{/if}
				<div class="sp-loadout" class:sp-loadout--disabled={!char}>
					<button
						class="sp-lo-zone"
						class:sp-lo-zone--unset={!loadoutEntry?.artifactSetId}
						disabled={!char}
						onclick={(e) => openLoadout(e, 'artifact')}
						title={char ? 'Artifact set' : undefined}
						aria-label="Choose artifact set"
					>
						<img class="sp-lo-icon" src={artifactIcon} alt="" />
					</button>
					<button
						class="sp-lo-zone"
						class:sp-lo-zone--unset={!hasWeapon}
						disabled={!char}
						onclick={(e) => openLoadout(e, 'weapon')}
						title={char ? (hasWeapon ? `Weapon · refinement ${currentRef}` : 'Weapon') : undefined}
						aria-label="Choose weapon and refinement"
					>
						<img class="sp-lo-icon" src={weaponIcon} alt="" />
						<!-- The refinement, as the in-game weapon card draws it: a digit
							     on the icon's corner rather than a hit zone of its own. It is
							     DISPLAY only — the panel this zone opens always renders its
							     refinement pips, so nothing became unreachable.
							     ⚓ NATE 2026-08-12: ABSENT with no weapon equipped, rather
							     than dimmed. Dimmed is this card's "nothing here yet" voice,
							     and it is the right one for a slot you can FILL — but there
							     is no refinement to set until a weapon exists, which is a
							     different statement. A digit on an icon corner has no room
							     to draw that distinction, so it makes no claim at all; the
							     panel's inert pips carry the explanation instead. -->
						{#if hasWeapon}
							<span class="sp-lo-ref" aria-hidden="true">{currentRef}</span>
						{/if}
					</button>
				</div>
				<!-- 🧪 The upright phone card has no Swap (⚓ Nate 2026-10-13). -->
				{#if discCon && actions && !compact}
					<span class="sp-col-actions">{@render actions()}</span>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- ── Constellation + loadout popovers ─────────────────────────────────────
     THE SURFACE BAND (--t-quick / T_QUICK, motion round 2026-08-12) — a
     popover is a region arriving, not a control, and SIZE is what sets the
     clock (app.css § MOTION). A fade and nothing else: these are viewport-fixed
     and PLACED BY A TRANSFORM (translateY(-50%) off a measured, fractional
     top), and a scale or a slide would be a second transform compounding on
     that — the exact geometry the sub-pixel laws warn about. A fade ends at
     opacity 1, so the transient rasterization is brief and the resting state
     is clean.

     Both halves fade TOGETHER: the backdrop is invisible, but it is the thing
     that would still be swallowing clicks after the panel had gone if it
     didn't. `introLive`/`outroInert` are why it doesn't — see $lib/motion. -->
{#if conOpen || loadoutOpen}
	<div
		class="sp-popover-backdrop"
		role="button"
		tabindex="-1"
		aria-label="Close picker"
		use:portal
		transition:fade={{ duration: motion(T_QUICK) }}
		onintrostart={introLive}
		onoutrostart={outroInert}
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
		transition:fade={{ duration: motion(T_QUICK) }}
		onintrostart={introLive}
		onoutrostart={outroInert}
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
		transition:fade={{ duration: motion(T_QUICK) }}
		onintrostart={introLive}
		onoutrostart={outroInert}
		style:left="{loadoutX}px"
		style:top="{loadoutY}px"
	>
		<LoadoutPanel
			{loadoutEntry}
			weaponType={char.weapon}
			elementColor={p.main}
			onSetArtifact={(id) => onSetArtifact(id)}
			onSetWeapon={(id, r) => onSetWeapon(id, r)}
			onSetRefinement={(r) => onSetRefinement(r)}
		/>
	</div>
{/if}

<style>
	/* Registered so the icon wash's alpha INTERPOLATES (the hover ease) — an
	   unregistered custom property snaps between values. Registration is
	   page-global by nature; the sp- prefix keeps it this card's. */
	@property --sp-wash-a {
		syntax: '<percentage>';
		inherits: false;
		initial-value: 0%;
	}

	/* ── Card ─────────────────────────────────────────────────────────────────
	   ONE band, three columns (rail · portrait · column), TOP-ALIGNED inside
	   whatever cell the host gives it. `flex: 1` lets it fill a planner slot,
	   whose height varies; the slack falls BELOW the band, which is where the
	   timeline puts its own slack too — so a busy slot's card stays level with
	   the E/Q rows it labels instead of drifting down the group. */
	.sp-card {
		box-sizing: border-box;
		flex: 1;
		min-height: 0;
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		/* No HORIZONTAL padding: the ribbon's own RIBBON_PAD is the card's side
		   inset, and having both was the doubling ⚓ Nate trimmed on 2026-08-12.
		   Vertical padding stays — it is the only thing holding the band off the
		   slot's top edge. */
		padding: 8px 0 10px;

		/* ══ THE RAIL, SOLVED RATHER THAN PICKED ═════════════════════════════
		   ⚓ NATE 2026-08-12: "if you would be able to make the buttons' right
		   edge reach the half-way point of the avatars' circle, that would look
		   the cleanest (so the buttons cleanly extend right under the avatar all
		   the way)."

		   So the tile's fill runs to the disc's CENTRE — one expression, half the
		   band, rather than a tuned number — and because the circle's left edge
		   sweeps from disc.x+30 at the band's top down to disc.x at its middle,
		   the fill's own right edge is never visible anywhere. It slides under
		   the avatar and stops. That is the whole effect.

		   ⚠ BUT THE BUTTON IS NOT THAT WIDE, AND MUST NOT BE. A 46px tile with
		   its right 30px under an opaque disc has its CENTRE POINT — the place
		   every click lands by default — inside the portrait, which owns the
		   pointer there. It shipped that way for one build and Playwright caught
		   it immediately ("the portrait subtree intercepts pointer events"); a
		   human would have found a button that works at its left edge and not
		   its middle. So --sp-rail-w is THE VISIBLE, CLICKABLE STRIP, and the
		   hidden remainder is a pseudo-element on .bb-act that paints but cannot
		   be clicked. The thing you can press is the thing you can see.

		   The strip's width is then set by the MARK clearing the circle's arc,
		   solved at its worst corner (lower-right of the top mark; by symmetry
		   upper-right of the bottom one):

		     R  = band/2                     = 30    (circle radius)
		     t  = (band − gap)/2             = 28    (tile height)
		     dy = R − (t + mark)/2           = 9     (that corner off-centre)
		     arc left at dy = R − √(R²−dy²)  = 1.43  (px right of disc.x)
		     W  ≥ inset + mark − 1.43        = 3 + 14 − 1.43 = 15.6

		   16 clears it, and the marks' ink stops a further 1.78px inside their
		   box, so the real margin is ~2.2px. ⚠ RE-SOLVE IF THE BAND, THE GAP OR
		   MARK_SIZE MOVE — the failure is a glyph with its corner shaved off by
		   the portrait, subtle enough to read as a rendering bug rather than a
		   layout one. */
		--sp-rail-w: 16px;
		--sp-rail-gap: 4px;
		--sp-rail-mark-inset: 3px;
		/** How far the tile's FILL (not its box) runs on under the portrait. */
		--sp-rail-underlap: calc(var(--sp-band) / 2);

		/* ══ THE COLUMN'S TWO LEFT EDGES (⚓ NATE 2026-08-12) ══════════════════
		   They are deliberately NOT the same edge. What lines up is the two
		   rows' LEADING CONTROLS — the constellation chip under the element
		   badge — because those are what the eye tracks down the strip, and the
		   chip (26) is wider than the badge (18).

		   Box-concentric would be a 4px offset (half the difference). ⚓ Nate's
		   eye says 2: "not quite centered on each other, but very close."
		   ⚠ AND THERE IS NO SOLVING IT — the element icons' glyph sizing is
		   deliberately NOT normalised across the seven (see the icon generator),
		   so each element's ink sits differently inside its 18px box and no
		   single offset is optically right for all of them. This is a chosen
		   value, not a derived one; it stops being a compromise only if the
		   icons are ever normalised. */
		--sp-col-inset: 4px;
		--sp-id-nudge: 2px;

		/* The two VALUE controls — the constellation chip and the loadout pill.
		   Change them here, never on one alone. (The rail's COMMANDS are a
		   different register and deliberately don't share this height: see
		   .bb-act in BenchBand, where they stretch to split the band.) */
		--sp-pill-h: 26px;
		/* ── THE CONTROLS ARE FLAT WELLS (⚓ NATE 2026-08-11) ──────────────────
		   Both halves of the old treatment are gone, and they went together
		   because they were one idea: a GRADIENT that manufactured an inner
		   shadow, plus a 1.5px STROKE that drew the shape the gradient was too
		   subtle to draw on its own. That idea predates the palette-definition
		   round, which settled a real depth ladder (ground · raised · well) and
		   a rule about what a border is for — structure, i.e. where a surface
		   ENDS. A recessed control's extent is not in doubt; its DEPTH is the
		   whole message, and a ground one rung down states that directly.

		   So: ONE FLAT ROLE, no stroke. --surface-well is not a new value for
		   this card, it is the role that already means "a ground cut into
		   another ground" — the planner's chart and every input field wear it.
		   The card's ground is --frame-bg (slate-800) and the controls are
		   slate-900, the same one-rung step the rest of the system spends on a
		   well.

		   ↻ AND THEN THE RUNG MOVED UNDER IT, same day. This shipped at ΔL .027
		   with a note that it might be too soft a step for a control with no
		   stroke — and the fix landed in the RAMP rather than here: ⚓ Nate
		   merged slate-900 and slate-950 into one rung at their midpoint (his
		   read: 900 was desaturated against its siblings; the curve agreed and
		   showed it was also the only rung breaking the ramp's C/L trend).
		   ΔL is .060 now. ⚠ THE DECLARATION BELOW DID NOT CHANGE — it names the
		   role, the role names the rung, and the rung moved. That is the layer
		   law paying for itself; do not re-point this at a value.

		   ⚠ HOVER DOES NOT TOUCH THIS. The card's rule since 2026-07-30 is that
		   hover BRIGHTENS THE CONTENT and never fills — the con chip's ink, the
		   R value's ink and the icons' wash all already move. Losing the stroke
		   removed a second hover channel that was only ever doubling them. */
		--sp-pill-fill: var(--surface-well);

		/* Unset-VALUE ink: dimmed WHITE, stepped to the unset loadout icons'
		   opacity ladder (0.4 rest → 0.65 hover) so an unset C0/R1 and the
		   generic artifact/weapon art speak one "nothing here yet" voice —
		   --muted beside the white-art icons read as a different (beige) state
		   (Nate 2026-08-06). Mixed against the ground the values ACTUALLY sit on
		   per the alpha-compositing law, never transparent white. Disabled needs
		   no rung of its own: the shared 0.35 element dim multiplies this ink and
		   the icons identically.
		   ↻ 2026-08-11: that ground is --sp-pill-fill, not --frame-bg. It used to
		   be the gradient's LIGHT END, which was --frame-bg — a coincidence that
		   stopped being true the moment the controls became a rung of their own.
		   Reading the fill token keeps the mix correct through any depth change. */
		--sp-unset-ink: color-mix(in srgb, white 40%, var(--sp-pill-fill));
		--sp-unset-ink-hover: color-mix(in srgb, white 65%, var(--sp-pill-fill));

		/* The portrait's backing: a WELL the element lights from below.
		   ↻ 2026-08-11 (⚓ Nate: the old backing "might be a bit outdated"). It ran
		   --frame-bg → color-mix(el 14%, --bg), and both ends were the problem.
		   --bg is the PAGE ground — the deepest rung on the site and not on the
		   slate ramp at all — so the gradient fell a long way out of the card's own
		   depth ladder and landed somewhere near black, where 14% of an element
		   barely registers. Two grounds, one hue-shift and a near-invisible tint.
		   It is ONE ground now, and the only thing that travels is the element.
		   --surface-well is the rung the card's own controls wear (--sp-pill-fill),
		   so the portrait reads as cut into the same card rather than punched
		   through to the page behind it, and the element gets a lit rung to sit on
		   instead of a black one. Still tinted at the BOTTOM, like the pills.
		   ⚠ --surface-well resolves to a LITERAL in every context (slate-900 /
		   parchment-200 / --glass-well), so the mix below is not a mix of a mix. */
		/* 🎛️ How much element the bottom stop carries. Up from the old 14%: that
		   number was picked against a near-black stop, and the same fraction reads
		   weaker on a ground three rungs lighter. */
		--sp-avatar-el: 26%;
		--sp-avatar-fill: linear-gradient(
			180deg,
			var(--surface-well) 0%,
			color-mix(in srgb, var(--el, var(--neutral)) var(--sp-avatar-el), var(--surface-well)) 100%
		);
	}

	/* ── The band ─────────────────────────────────────────────────────────────
	   Its height IS the portrait (--sp-band, fed from CARD_PORTRAIT so the card
	   and the slot floor cannot disagree). `max-height: 100%` is load-bearing:
	   a fixed box that cannot shrink does not shrink, IT SPILLS — that bug
	   shipped once, invisibly, because layout overflow is not an error. */
	.sp-body {
		display: flex;
		align-items: stretch;
		height: var(--sp-band);
		max-height: 100%;
		min-height: 0;
	}

	/* ── The rail ─────────────────────────────────────────────────────────────
	   The host's slot commands, stretched to SPLIT the band between them, so the
	   pair spans exactly the portrait's height and the card's three columns
	   square up. Its buttons are styled by their host (BenchBand's .bb-act) —
	   only their box is this card's business. */
	.sp-rail {
		flex: 0 0 var(--sp-rail-w);
		width: var(--sp-rail-w);
		display: flex;
		flex-direction: column;
		gap: var(--sp-rail-gap);
		min-height: 0;
	}
	.sp-rail :global(> *) {
		flex: 1 1 0;
		width: 100%;
		height: auto;
		min-height: 0;
	}

	/* ── The column ───────────────────────────────────────────────────────────
	   ⚓ NATE 2026-08-12 asked for the two rows to sit on "the UI controls'
	   centers", and found by inspector that it meant moving the name down 7px
	   and the controls up 2px. THE RULE BEHIND THOSE TWO NUMBERS: the column
	   runs the RAIL'S GRID. Same two tracks, same gap, each row centring its
	   content — so the name lands on the ⇄ tile's centre-line and the controls
	   on the ✕'s, and the card reads as 2 × 2 stations with the portrait
	   spanning both rows.

	   Checked against his own values: at the 68px band he was measuring, the
	   tracks are 32 and their centres +16 / +52, against a top-aligned name at
	   +9 and a bottom-aligned control row at +55 — i.e. down 7 and up 2, to the
	   pixel. Deriving it means it stays true when the band moves, which it did
	   in the same message (68 → 60).

	   ⚠ A TWO-LINE NAME (34) OVERFLOWS ITS 28px TRACK, by design: centred, it
	   spends 3px into the 4px gap at each end and still clears the control row,
	   which sits 1px inside its own track. Names up to Kuki Shinobu (87.8px at
	   --fs-lg, ⚓ Nate's stated bar) fit on one line at this width; the six
	   longer ones in the roster wrap and are the reason the clamp stays. */
	.sp-col {
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
		margin-left: var(--sp-col-inset);
		display: grid;
		grid-template-rows: 1fr 1fr;
		gap: var(--sp-rail-gap);
		align-items: center;
	}
	/* flex-START, not center: for a one-line name the row is the badge's own
	   height and the two are identical, but a name that wraps to two lines must
	   keep its glyph on line ONE rather than floating to the middle of the
	   block. */
	.sp-id-row {
		display: flex;
		align-items: flex-start;
		gap: 0.3rem;
		min-width: 0;
		/* Sits --sp-id-nudge right of the control row, so the element badge lands
		   just off-centre under the constellation chip. See the knob. */
		padding-left: var(--sp-id-nudge);
	}
	.sp-controls {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}
	/* Sized as large as the longest roster names allow: single-word names sit on
	   one line; multi-word outliers (Sangonomiya Kokomi, Shikanoin Heizou…) wrap
	   to a second line rather than truncate.
	   ⚠ TWO LINES IS THE CARD'S HEIGHT BUDGET, not a preference: 2 × --lh-tight
	   at --fs-lg (34) + the gap (8) + the control row (26) is exactly the 68px
	   portrait. Move this size or the clamp and the column stops matching the
	   disc — the card still works, it just stops looking designed. */
	.sp-char-name {
		min-width: 0;
		font-size: var(--fs-lg);
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
	   timing is approximate. No chip — it sits on the card surface.
	   ↻ 2026-08-12: the constellation chip left this row for the control row
	   below, so the mark is the row's last item now. `margin-right: auto` still
	   does the right thing (free space piles up to the mark's RIGHT, keeping it
	   snug against the name) and it is now the same arrangement the roster card
	   reaches with margin-left — kept as-is because the effect is identical and
	   the name, not the row, is what this annotates. */
	.sp-namemark {
		margin-right: auto;
		flex-shrink: 0;
		display: flex;
		/* Not a domain color — a data-quality consequence, not a game fact
		   (dire-retirement round, 2026-08-05; mirrors .cc-namemark).
		   ↻ 2026-08-12: and the right STATE colour is --ui-provisional, not
		   --ui-danger. That round settled which FAMILY this belongs to and red was
		   just the only rung left; the family has a fourth value now. ⚠ The bench
		   is always dark, so this takes the :root rung — the roster card's twin
		   resolves to the ctx-light one. Same token, two grounds. */
		color: var(--ui-provisional);
		cursor: help;
		/* ↻ 2026-08-11: the type declarations and the -0.08em lift are GONE, for
		   the reason spelled out at .cc-namemark — they were tuned for a unicode
		   ∅ and none of them reaches an SVG, except the transform, which was
		   pushing an already-centred mark off centre. The two cards' marks were
		   nudged by DIFFERENT amounts (-0.08 here, -0.10 there) precisely because
		   each was eyeballed against its own font-size; a geometric mark needs
		   neither number. It aligns like .sp-el-badge does, three items to the
		   left, and for the same reason: both are blocks in a centred flex row. */
	}
	/* 14 — and the rule that picks it is worth stating once, because it is what
	   keeps the two card families in step without either knowing the other's
	   numbers: THE MARK MATCHES THE NAME IT ANNOTATES, 1:1 in px. This row's name
	   is --fs-lg, so 14; the roster card's comfortable band is also --fs-lg and
	   also lands on 14, and its roomy band moves to 16 with its name.
	   (The element badge above sits at 1.25× the name instead. Identity outranks
	   annotation, so it is the one that gets to be bigger than the words.) */
	.sp-namemark :global(.mark) {
		width: 14px;
		height: 14px;
	}

	/* Element glyph inline with the name — the in-game card language.
	   ↻ 2026-08-11 (⚓ NATE): 15 → 18px. It had been pinned to the roster card's
	   .cc-el and both were sized against a --fs-md (12px) name; the size-up took
	   the name to --fs-lg (14px) and left the glyph where it was, so the badge
	   quietly stopped being the name's peer. 18 restores the ratio it was built
	   at (1.25 × the name's size — glyph a touch taller than the cap, which is
	   how the in-game cards draw it).
	   ⚠ THE TWO FAMILIES HAVE PARTED HERE, deliberately, and this is the last
	   place they still agree about the idiom. On 2026-08-12 the roster card's
	   .cc-el moved OUT of its name row and into the portrait's top-left corner,
	   following Genshin's own character cards; the bench's badge stays inline
	   because this card has no portrait corner to put it in — the portrait is a
	   disc, and its corners are outside the art. So the sizing rule above no
	   longer has a roster twin to stay in step with: it is this card's alone. */
	.sp-el-badge {
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		background: none;
		pointer-events: none;
	}

	/* Constellation selector: the loadout pill's twin — same height, fill and
	   radius, because both are VALUE controls (see the two-register note at the
	   top). Only the value changes with state: dimmed white unset (the icons'
	   ladder), element-tinted when set — the contract the refinement digit
	   follows too.

	   ══ IT IS A GLYPH NOW, NOT TEXT (⚓ NATE 2026-08-12) ═════════════════════
	   And with it went the centering apparatus this rule used to carry: a
	   `letter-spacing: normal` override (tracking lands after the LAST glyph
	   too, so the advance box the grid centers is one unit wider than the ink)
	   and a −0.07em optical nudge for the bearings residual, both measured at 8×
	   in two engines — with the WebKit half only true at the ribbon's current
	   dock x, since WebKit snaps text to whole pixels while boxes sit at
	   sub-pixel precision. A path has no advance box and no bearings, so
	   `place-items: center` is now simply correct in both engines, and the font
	   declarations that fed the old sums are gone with it.
	   ⚠ THE LESSON SURVIVES THE FIX (see reference_subpixel_rendering_laws): the
	   trap was never the C chip, it was centering INK by centering a BOX. This
	   one control stopped having the problem; nothing else did. */
	.sp-cons-chip {
		box-sizing: border-box;
		flex-shrink: 0;
		height: var(--sp-pill-h);
		width: var(--sp-pill-h);
		display: grid;
		place-items: center;
		border: none;
		border-radius: var(--r-round);
		background: var(--sp-pill-fill);
		color: var(--sp-unset-ink);
		cursor: pointer;
		transition: color var(--t-snap);
		z-index: 1;
	}
	/* Unset hover climbs the icons' ladder (0.4 → 0.65 white); a SET value
	   hovers to --text, exactly as before. ↻ 2026-08-11: the element-tinted
	   border-color that used to ride along went with the stroke. The ink was
	   always the louder half of this hover, and the element already speaks
	   through the glyph, the portrait ring and the set value. */
	.sp-cons-chip:hover:not(:disabled) {
		color: var(--sp-unset-ink-hover);
	}
	.sp-cons-chip--set:hover:not(:disabled) {
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
	/* 🧪 §9.5a's hollow mark: the plan asks for more than the account has. */
	.sp-cons-chip--short {
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--muted);
		color: var(--muted);
	}

	/* ── 🧪 The side portrait (candidate) ─────────────────────────────────────
	   The chip keeps the band's square; the portrait inside is anchored at its
	   BOTTOM, so the disc lands exactly where the round chip's did and the hair
	   rises over the card's top padding and beyond. Nothing reserves that
	   overhang — that is the question the demo asks. */
	.sp-side {
		overflow: visible;
	}
	.sp-side-art {
		position: absolute;
		left: 0;
		bottom: 0;
		display: block;
		pointer-events: none;
	}
	/* The constellation control on the disc — the TB chip's place and shape,
	   but a BUTTON (it is still the editor). Filled = covered (or no roster);
	   hollow = short; at C0 and covered it recedes to a ghost until hovered. */
	.sp-disc-con {
		position: absolute;
		right: 0;
		bottom: 0;
		z-index: 2;
		height: 14px;
		padding: 0 4px;
		box-sizing: border-box;
		display: grid;
		place-items: center;
		border: none;
		border-radius: var(--r-round);
		background: var(--line-strong);
		color: var(--text);
		cursor: pointer;
		transition: color var(--t-snap);
	}
	.sp-disc-con--short {
		background: var(--surface-well);
		box-shadow: inset 0 0 0 1px var(--muted);
		color: var(--muted);
	}
	.sp-disc-con--zero {
		background: var(--surface-well);
		color: var(--sp-unset-ink);
	}
	.sp-disc-con:hover:not(:disabled) {
		color: var(--text);
	}
	.sp-disc-con:disabled {
		cursor: default;
	}
	/* Without a rail the host's actions sit at the controls row's end. */
	.sp-col-actions {
		display: flex;
		align-self: stretch;
		margin-left: auto;
	}

	/* ── Loadout pill ─────────────────────────────────────────────────────────
	   One shape, TWO zones (artifact · weapon), each opening the same panel led
	   by its own section. A well, like the constellation chip beside it — value
	   controls are places data sits, not things you press.
	   ↻ 2026-08-12: the refinement was a third zone and is now a digit on the
	   weapon icon's corner (see .sp-lo-ref). That is 24px of a 200px card, and
	   the thing it cost — one-click refinement editing — is two clicks now,
	   through a panel that was always going to show the pips anyway.
	   ⚠ overflow stays VISIBLE: the digit deliberately overhangs the capsule's
	   corner, exactly as a weapon card draws it in game. */
	.sp-loadout {
		box-sizing: border-box;
		max-width: 100%;
		height: var(--sp-pill-h);
		display: flex;
		align-items: center;
		gap: 1px;
		/* 🎛️ ⚓ NATE 2026-08-12: "the artifact/weapon loadout pill needs a little
		   more background pill on each end — a little more of that dark slate
		   showing on the left and right edges of the icons." The zones used to
		   run flush to the capsule's ends, so its curve cut straight into the
		   artwork and the pill read as two icons rather than one well holding
		   two icons. */
		padding: 0 3px;
		border: none;
		border-radius: var(--r-round);
		background: var(--sp-pill-fill);
	}
	/* An empty slot's pill: the shared 0.35 dim the constellation chip and the
	   rail's buttons wear, so all four stations fade as one family. Element
	   opacity is the accepted remnant here — it is STATIC (never toggled by
	   hover), which is what the WebKit transparency-layer dance needs. */
	.sp-loadout--disabled {
		opacity: 0.35;
	}
	.sp-lo-zone {
		position: relative;
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
		transition: background var(--t-snap);
	}
	/* ── Icon dimming = a GROUND-COLORED WASH over a full-opacity icon ────────
	   Never element `opacity` on the icon — and the alpha must live IN THE
	   PAINT (a translucent background-color), never as `opacity` on the wash
	   element either. The ribbon is transform-placed at measured (fractional)
	   coordinates, and WebKit rasterizes any element-opacity<1 subtree into a
	   transparency layer at ROUNDED device coordinates — the icons visibly
	   "danced" on hover in real Safari (the chrome ⓘ bug's exact mechanism).
	   Two hard-won rungs of this lesson (both Nate-observed in real Safari,
	   2026-08-06): the icons' own opacity danced, and so did v2's
	   gradient-wash pseudo carrying `opacity` — element opacity is the trigger
	   wherever it sits. Paint alpha (the chrome fix's fill-opacity analog) has
	   no layer and no rounding.

	   The wash is THE PILL'S OWN GROUND at an alpha. The rule it has to satisfy
	   is that the wash is invisible wherever the icon ISN'T (α·g + (1−α)·g = g),
	   so it must be the same paint as the ground beneath it — which is why the
	   v3 flat --frame-bg failed in 2026-08-06: the pill was a GRADIENT then, and
	   a flat wash punched lighter DISCS into it (Nate spotted them at zoom).
	   ↻ 2026-08-11: the pill went FLAT (see --sp-pill-fill), so the gradient
	   this rebuilt is gone and the wash is a flat colour again — the failed v3,
	   made correct by the ground finally being flat too. It now reads
	   --sp-pill-fill ITSELF rather than a parallel copy of the ramp, so the two
	   cannot desync: change the ground and the wash follows by construction.

	   The hover ease rides the REGISTERED property --sp-wash-a (@property
	   below): the percentage interpolates and the stops re-resolve per frame.
	   Engines without @property keep correct per-state values and merely snap.
	   Ladder: α = 1 − old icon opacity → 15/0/60/35% for set-rest/set-hover/
	   unset-rest/unset-hover.
	   ↻ 2026-08-12: the `:not(.sp-lo-ref)` guard is gone with the refinement
	   zone — every zone is an icon zone now. The refinement digit rides the same
	   ladder through `color`, which is already paint. */
	.sp-lo-zone::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		--sp-wash-a: 15%;
		background: color-mix(in srgb, var(--sp-pill-fill) var(--sp-wash-a), transparent);
		transition: --sp-wash-a var(--t-snap);
		pointer-events: none;
	}
	/* Hover brightens the CONTENT, it does not fill the zone — the same move the
	   constellation chip and the slot actions make, and the only one that keeps
	   the pill reading as ONE shape. A filled disc inside the capsule fragments
	   it, and lands on the same circle silhouette as the action chips flanking
	   it. To go back to a fill, a background on the zone is the whole change. */
	.sp-lo-zone:hover:not(:disabled)::after {
		--sp-wash-a: 0%;
	}
	/* An empty slot wears generic art dimmed — still legibly a thing you click,
	   never a hole. ⚠ An unset icon must stay visibly BELOW a set one even
	   while hovered — the dim is this card's signal for "nothing equipped", so
	   hover must not push an empty slot into looking filled. 35% wash hovered
	   > 15% wash at rest. */
	/* Doubled class = specificity over the hover rule (two class-level simple
	   selectors each; source order alone loses). */
	.sp-lo-zone.sp-lo-zone--unset::after {
		--sp-wash-a: 60%;
	}
	.sp-lo-zone.sp-lo-zone--unset:hover:not(:disabled)::after {
		--sp-wash-a: 35%;
	}
	.sp-lo-zone:disabled {
		cursor: default;
	}
	.sp-lo-icon {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	/* ── The refinement digit ─────────────────────────────────────────────────
	   The number alone, on the weapon icon's top-right corner — the in-game
	   weapon card's own idiom, and the reason it can be four pixels of type
	   instead of a 24px hit zone. It renders ONLY with a weapon equipped (see the
	   markup), so it has one state and takes the element tint unconditionally —
	   the unset rung the constellation chip still carries has no meaning here.

	   ⚠ z-index is load-bearing. The zone's dimming wash is an ::after at
	   inset 0, which paints ABOVE every static child and would wash the half of
	   the digit that overlaps the zone — the half, not the whole, which is the
	   worst possible way for it to look. Positioned + z-index puts the digit
	   over the wash.
	   The shadow is the ground's own colour, so the digit reads over whatever
	   part of the weapon art it lands on without needing a plate behind it. */
	.sp-lo-ref {
		position: absolute;
		z-index: 1;
		top: -1px;
		right: -1px;
		color: color-mix(in srgb, var(--el) 75%, white);
		font-family: var(--font-body);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		line-height: var(--lh-none);
		white-space: nowrap;
		pointer-events: none;
		text-shadow:
			0 0 3px var(--sp-pill-fill),
			0 1px 2px var(--sp-pill-fill);
		transition: color var(--t-snap);
	}
	/* Follows its ZONE's hover, not its own — it is a label on the weapon
	   button, not a control. One rung, because it has one state. */
	.sp-lo-zone:hover:not(:disabled) .sp-lo-ref {
		color: var(--text);
	}

	/* ── Portrait ─────────────────────────────────────────────────────────────
	   Circular — the side-avatar art is cropped to a circle in-game, so the
	   portrait honours that shape. Backed by --sp-avatar-fill: the roster cards'
	   element wash, flipped so the tint sits at the BOTTOM like everything else
	   on this card. Element identity also rides the small glyph badge in the
	   identity row and the clip border. */
	/* ══ THE DISC FITS ITS CARD (bug fix, 2026-08-11) ═════════════════════════
	   This was `width: 68px; height: 68px; flex-shrink: 0` — a fixed square that
	   could not yield. That held for as long as the host cell was 158px tall,
	   which is what the card was designed against; the timeline's condensing
	   rounds took the planner's slot to 136 and then lower, and a chip that
	   cannot shrink does not shrink — IT SPILLS. Measured at an 84px slot the
	   68px disc ran straight through the identity row above it and the loadout
	   pill below. ⚠ THE BUG WAS INVISIBLE TO EVERY CHECK WE RUN: it is layout
	   overflow, not an error, and the round-one probe measured the TRACKS and
	   never looked at the cards beside them.

	   It is now the AREA that decides. The disc takes its host's height and its
	   width from the aspect ratio, capped at --sp-avatar-max. So it is 68px
	   wherever there is room for 68px — the TB bench, a tall planner slot — and
	   smaller, but never overflowing, wherever there is not. ⚓ Nate asked for
	   exactly this in round one: "simply adjust the bench's portrait area to
	   follow this need."

	   ⚠ A CAP IS NOT A FLOOR. Nothing here stops the disc becoming 10px in a
	   short slot; it only stops it breaking the card. The floor is the SLOT's
	   (BENCH_SLOT_MIN_H in benchBand.svelte.ts), because that is the side that
	   knows what a portrait needs to still be a portrait.

	   🎛️ THE SIZE KNOB IS `CARD_PORTRAIT` IN benchBand.svelte.ts NOW, arriving
	   here as --sp-band. The local --sp-avatar-max it replaced was a second copy
	   of the same 68 that the slot floor also had to know — one number in one
	   place, and the floor follows it by construction. The art's framing is
	   independent of the diameter (see .sp-avatar-img), so it stays free to
	   retune; only BENCH_CARD_W needs to follow it. */
	.sp-avatar-chip {
		position: relative;
		/* Over the rail tiles' painted extension — the mockup's foreground/
		   background read. The disc sits FLUSH against the rail (no negative
		   margin): it is the tiles' fill that reaches under the disc, not the
		   disc that laps over the tiles' boxes. See --sp-rail-underlap. */
		z-index: 1;
		flex: 0 0 auto;
		height: 100%;
		width: auto;
		aspect-ratio: 1;
		min-height: 0;
		border-radius: var(--r-round);
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
		   go — it dimmed on interaction.
		   🎛️ 1.5 → 2px (bench-card round). ⚓ Nate: "seeing that avatar with the
		   elemental-colored border is the immediate read" — this ring is the one
		   thing on the card doing that job at distance, and it was drawn at the
		   same weight as the card's hairlines. */
		border: 2px solid color-mix(in srgb, var(--el, #6a7080) 85%, transparent);
		transition: box-shadow var(--t-snap);
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
		font-size: var(--fs-sm);
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
		   enough to clear the tool panels (the bench ribbon, the band plates) but below the
		   1000 modal layer, which never coexists with this picker. */
		z-index: 949;
	}
	.sp-popover {
		position: fixed;
		transform: translateY(-50%);
	}
	/* Anchored at the chip's LEFT edge when the right side can't fit it — same
	   vertical centering. */
	.sp-popover--flip {
		transform: translate(-100%, -50%);
	}
	.sp-popover {
		z-index: 950;
		background: var(--surface); /* modal role (Nate 2026-07-31) */
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		padding: 7px 9px;
		display: flex;
		align-items: center;
		gap: 4px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
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
		background: var(--fill-rest);
		color: var(--muted);
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		transition:
			background var(--t-snap),
			box-shadow var(--t-snap),
			color var(--t-snap);
	}
	.sp-pip--filled {
		background: color-mix(in srgb, var(--pip-color) 22%, transparent);
		color: var(--pip-color);
	}
	.sp-pip--current {
		background: color-mix(in srgb, var(--pip-color) 30%, transparent);
		/* 1.5px stands here on purpose — the selection-ring exception to the
		   1.5px sweep; the argument is at .lp-tile--current in LoadoutPanel. */
		box-shadow: inset 0 0 0 1.5px var(--pip-color);
	}
	.sp-pip:hover {
		background: var(--fill-hover);
		color: var(--pip-color, var(--text));
	}
	/* ══ THE COMPACT FORM (responsive round, 2026-09-05) ═══════════════════════
	   The same three parts, re-stacked for a card ~80px wide:

	     ┌──┐╭────╮
	     │⇄ │( 48 )        ← rail + disc, one row, the disc at CARD_PORTRAIT_COMPACT
	     │✕ │╰────╯
	     ⓒ ( ▣ ⚔¹ )        ← the value controls, full width
	
	   The NAME goes, and only the name: at this width the portrait is the
	   name, and every other station survives — nothing a reader could do on a
	   desk is lost on a phone. The card's own vertical padding goes with it
	   (the ribbon's RIBBON_PAD is the inset here), which is what lets
	   48 + 4 + 26 land on the full form's 78 exactly.

	   ⚠ THE RAIL RE-SOLVES. --sp-rail-w's derivation above is for a 60px disc;
	   at 48 the tile is 22 tall, the mark's worst corner sits 6px off the
	   centre-line, the arc there is 0.76px right of disc.x, and W ≥ 3 + 14 −
	   0.76 = 16.24 → 17. ⚠ --sp-rail-underlap is re-derived too: it is
	   computed on .sp-card from the FULL band, and a custom property resolves
	   where it is declared, not where it is read. */
	.sp-card--compact {
		padding: 0;
	}
	.sp-card--compact .sp-body {
		--sp-band: var(--sp-band-compact);
		--sp-rail-w: 17px;
		--sp-rail-underlap: calc(var(--sp-band-compact) / 2);
		height: auto;
		max-height: none;
		display: grid;
		grid-template-columns: var(--sp-rail-w) auto minmax(0, 1fr);
		grid-template-rows: var(--sp-band-compact) var(--sp-pill-h);
		row-gap: var(--sp-rail-gap);
		column-gap: 0;
		align-items: stretch;
	}
	.sp-card--compact .sp-rail {
		grid-row: 1;
		grid-column: 1;
	}
	.sp-card--compact .sp-avatar-chip {
		grid-row: 1;
		grid-column: 2;
		height: var(--sp-band-compact);
	}
	.sp-card--compact .sp-col {
		grid-row: 2;
		grid-column: 1 / -1;
		display: flex;
		margin: 0;
		min-width: 0;
	}
	.sp-card--compact .sp-id-row {
		display: none;
	}
	.sp-card--compact .sp-controls {
		width: 100%;
	}
	/* The pill takes the row's remainder and its two zones SHARE it, down to a
	   floor the 16px artwork still sits inside — this is where the card's floor
	   (BENCH_ROW_CARD_MIN_W) comes from. */
	.sp-card--compact .sp-loadout {
		flex: 1 1 0;
		min-width: 0;
	}
	.sp-card--compact .sp-lo-zone {
		flex: 1 1 0;
		width: auto;
		min-width: 20px;
		/* Never wider than the desk zone — the artwork inside scales with the
		   zone, and a zone that grew with a roomy card grew its icons with it. */
		max-width: 24px;
	}

	/* ── 🧪 The side form on the desk: the controls row sits on the band's
	   BOTTOM, so the loadout pill and ⇄ end where the disc's chip ends (they
	   were centred in their half of the band, 1px short — measured). The name
	   comes down 6px (⚓ Nate). */
	.sp-card--side:not(.sp-card--compact) .sp-controls {
		align-self: end;
	}
	.sp-card--side:not(.sp-card--compact) .sp-id-row {
		position: relative;
		top: 6px;
	}

	/* ══ 🧪 THE SIDE FORM, COMPACT — THE UPRIGHT CARD (⚓ Nate 2026-10-13) ═════
	   The loadout pill stands UPRIGHT (flower over weapon) to the right of the
	   portrait, and Swap is gone, so the card is ONE row:

	       ⟨hair⟩
	      (  d  )ⓒ ▣      ← the portrait, bottom-aligned with the pill
	      (     )  ⚔¹
	
	   width = d + 4 + 26, height = max(d, the pill's 55). The host solves d
	   from the width four cards get (`compactDisc`). */
	.sp-card--side.sp-card--compact .sp-body {
		display: flex;
		align-items: flex-end;
		gap: 4px;
		height: auto;
	}
	.sp-card--side.sp-card--compact .sp-avatar-chip {
		height: var(--sp-side-d);
		width: var(--sp-side-d);
	}
	.sp-card--side.sp-card--compact .sp-col {
		display: flex;
		margin: 0;
	}
	.sp-card--side.sp-card--compact .sp-controls {
		width: auto;
	}
	.sp-card--side.sp-card--compact .sp-loadout {
		flex: none;
		flex-direction: column;
		width: var(--sp-pill-h);
		height: auto;
		padding: 3px 0;
	}
	.sp-card--side.sp-card--compact .sp-lo-zone {
		flex: none;
		width: 24px;
		max-width: none;
		height: 24px;
	}
</style>
