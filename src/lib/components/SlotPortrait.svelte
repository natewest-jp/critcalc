<script lang="ts">
	import Mark from './Mark.svelte';
	import ConMark from './ConMark.svelte';
	import SidePortrait from './SidePortrait.svelte';
	import { rotationTwin } from '$lib/travelerTwin.svelte';
	import type { Twin } from '$lib/storage/records';
	import { twinLabel } from '$lib/data/characterLookup';
	/**
	 * SlotPortrait — the slot card of the Planner's bench ribbon, labelling a
	 * timeline track group.
	 *
	 * ══ THE PORTRAIT ROUND (⚓ Nate 2026-10-13, judged on /lab — lineups design
	 *    §9.5 / §9.5a / §10.3) ════════════════════════════════════════════════
	 * The card speaks the Team Builder's language now:
	 *
	 *   · the PORTRAIT is the Builder's overhanging side portrait (SidePortrait),
	 *     its hair rising over the card's top edge and fading out sideways
	 *     before the column; the ring is the soft line, gentle gold on hover;
	 *   · it READS — a click opens the character's details, on the desk as on
	 *     the phone (↻ bench-buttons round 2026-10-22; it was the host's swap,
	 *     with a hover magnifier for details);
	 *   · the CONSTELLATION sits on the disc, the Builder chip's place and
	 *     shape, and goes HOLLOW when the plan asks for more than you own;
	 *   · the column holds the NAME (no element badge — the planner's bars wear
	 *     the element) over the LOADOUT pill, and paints over the portrait's
	 *     art so a ponytail slips under the pill's well.
	 *
	 * ══ THE RAIL IS BACK (bench-buttons round, ⚓ Nate 2026-10-22) ═══════════
	 * The host's slot COMMANDS (⇄ Swap · ✕ Remove from team) stand at the card's
	 * left again, the pre-2026-10-13 rail lifted with its geometry. It retired
	 * then because Swap had become the portrait and the rail had no purpose
	 * left; slots that REST gave ✕ one (a character you placed is taken off the
	 * team only by removing them), and the portrait went back to reading.
	 *
	 * The COMPACT form is the phone row's UPRIGHT card: the portrait with the
	 * loadout pill standing beside it as ONE button, no name and no rail (see
	 * benchBand.svelte.ts § THE UPRIGHT CARD); Remove lives in its details.
	 *
	 * VALUE CONTROLS ARE WELLS (⚓ Nate 2026-08-12): the constellation and the
	 * loadout pill are places data sits, cut into the card (--surface-well).
	 *
	 * The loadout pill is one shape with TWO hit zones on the desk — artifact
	 * and weapon, the refinement a corner digit on the weapon icon. Both open
	 * the same LoadoutPanel — which zone you clicked decides only whether a
	 * second click closes it — and that panel always renders its refinement
	 * pips, so nothing is unreachable.
	 *
	 * Purely presentational: it displays the resolved (effective) constellation +
	 * loadout it's handed and reports edits through callbacks. The host decides
	 * which layer those writes land in — so this component never touches a store
	 * or knows about layers. The popovers and their viewport-fixed positioning
	 * live here (a full-screen backdrop guarantees only one is ever open, so
	 * per-instance state is safe).
	 */
	import type { Snippet } from 'svelte';
	import type { LoadoutEntry } from '$lib/stores';
	import { BENCH_ROW_CARD_H, CARD_PORTRAIT } from '$lib/benchBand.svelte';
	import { elementPalette } from '$lib/utils/elementColors';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { artifactImagePath, getArtifactSetById } from '$lib/data/artifactLookup';
	import { weaponImagePath } from '$lib/data/weaponLookup';
	import { GENERIC_ARTIFACT_ICON, weaponTypeIcon } from '$lib/utils/loadoutIcons';
	import LoadoutPanel from '$lib/components/LoadoutPanel.svelte';
	import type { LoadoutSection, LoadoutSource } from '$lib/components/LoadoutPanel.svelte';
	// Popovers + backdrops are viewport-fixed but must clear ANY host stacking
	// context (the ribbon is transform-placed) — see $lib/actions/portal
	import { portal } from '$lib/actions/portal';
	import { fade } from 'svelte/transition';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import { closeOnLeave } from '$lib/closeOnLeave';

	/** The minimal character shape the card renders — an index entry or a loaded
	 *  payload both satisfy it. null = empty slot. */
	type SlotChar = { id: string; displayName: string; element?: string; weapon?: string } | null;

	let {
		slotId,
		char,
		compact = false,
		compactDisc = BENCH_ROW_CARD_H,
		conLevel,
		ownedCon,
		loadoutEntry,
		onSetCon,
		onSetTwin,
		onSetArtifact,
		onSetWeapon,
		onSetRefinement,
		loadoutSource,
		onPortraitClick,
		portraitLabel = 'Open character selector',
		actions,
		emptyLabel = 'Empty',
		resting = false,
		picked = false
	}: {
		/** Raw avatar id (the character id, or 'blank' for an empty slot). */
		slotId: string;
		/** Resolved character, or null while unresolved / empty. */
		char: SlotChar;
		/** The phone row's UPRIGHT card (see the header). */
		compact?: boolean;
		/** The upright card's portrait, which the host solves from the width four
		 *  cards get (benchBand `rowPortrait`). */
		compactDisc?: number;
		/** Effective constellation level to display (already layer-resolved). */
		conLevel: number;
		/** Your account's constellation for this character — a level, `null` = not
		 *  owned, undefined = unknown (an empty roster). When it falls short of
		 *  `conLevel` the constellation goes HOLLOW (§9.5a). */
		ownedCon?: number | null;
		/** Effective loadout to display (already layer-resolved). */
		loadoutEntry: LoadoutEntry;
		onSetCon: (level: number) => void;
		/** A Traveler's twin choice, offered above the constellation pips (twin
		 *  frames round, 2026-10-28). Omit for anyone else. */
		onSetTwin?: (twin: Twin) => void;
		onSetArtifact: (artifactSetId: string | undefined) => void;
		onSetWeapon: (weaponId: string | undefined, refinement: 1 | 2 | 3 | 4 | 5) => void;
		onSetRefinement: (r: 1 | 2 | 3 | 4 | 5) => void;
		/** Whose loadout this is, when the rotation is a saved team. */
		loadoutSource?: LoadoutSource;
		/** The portrait as a button: a filled slot's details; on the desk an
		 *  empty slot ADDS through it. Omit for a static portrait. */
		onPortraitClick?: () => void;
		portraitLabel?: string;
		/** ⚓ Seated, with nothing in the notation yet (design §8.1): the card
		 *  stays in its slot, dimmed — never gone. */
		resting?: boolean;
		/** The character the inspector is showing (inspector round): the ring
		 *  HOLDS its hover gold, the site's selected colour (⚓ Nate). */
		picked?: boolean;
		/** The RAIL: the host's slot commands (⇄ · ✕), stacked at the card's
		 *  left and splitting the portrait's height. Desk only — the compact
		 *  card has no room and no swap. */
		actions?: Snippet;
		/** Text shown in the name area for an empty (char===null) slot. The bench
		 *  passes '' — four blank portraits ARE the empty state. */
		emptyLabel?: string;
	} = $props();

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
	let conAnchor = $state<Anchor | null>(null);
	let conEl = $state<HTMLDivElement | undefined>();
	let loadoutOpen = $state(false);
	let loadoutX = $state(0);
	let loadoutY = $state(0);
	let loadoutAnchor = $state<Anchor | null>(null);
	let loadoutEl = $state<HTMLDivElement | undefined>();
	let loadoutSection = $state<LoadoutSection>('artifact');

	// The chip's horizontal edges and vertical centre, read at the click.
	type Anchor = { left: number; right: number; y: number };
	// The gap to the chip, and the least margin to either screen edge.
	const POPOVER_GAP = 8;

	function anchorTo(e: MouseEvent): Anchor {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		return { left: rect.left, right: rect.right, y: rect.top + rect.height / 2 };
	}

	// Opens to the chip's right (the planner's left-edge portrait column); to
	// its left when the right can't hold it; then CLAMPED inside the screen.
	// The bench row's middle cards at 320–430 have room on neither side — a
	// side choice alone opened the loadout panel up to 98px off the left edge,
	// out of reach. Measured from the RENDERED picker: a single 220 estimate
	// was smaller than the 226px loadout panel, so the first card at 320
	// didn't flip and spilled 5px off the right.
	function placeBeside(anchor: Anchor, w: number): number {
		const vw = document.documentElement.clientWidth;
		let x = anchor.right + POPOVER_GAP;
		if (x + w + POPOVER_GAP > vw) x = anchor.left - POPOVER_GAP - w;
		return Math.max(POPOVER_GAP, Math.min(x, vw - w - POPOVER_GAP));
	}
	// Centred on the chip (the CSS's translateY(-50%)), then CLAMPED the same
	// way: the loadout panel is taller than a card, so centred on a low one it
	// ran off the bottom of the screen. Taller than the screen, it is the
	// panel's own max-height that holds it.
	function placeAcross(anchor: Anchor, h: number): number {
		const vh = document.documentElement.clientHeight;
		const half = Math.min(h, vh - 2 * POPOVER_GAP) / 2;
		return Math.max(POPOVER_GAP + half, Math.min(anchor.y, vh - POPOVER_GAP - half));
	}
	$effect(() => {
		if (!conEl || !conAnchor) return;
		conX = placeBeside(conAnchor, conEl.offsetWidth);
		conY = placeAcross(conAnchor, conEl.offsetHeight);
	});
	$effect(() => {
		if (!loadoutEl || !loadoutAnchor) return;
		loadoutX = placeBeside(loadoutAnchor, loadoutEl.offsetWidth);
		loadoutY = placeAcross(loadoutAnchor, loadoutEl.offsetHeight);
	});

	function openConstellation(e: MouseEvent) {
		e.stopPropagation();
		loadoutOpen = false;
		if (conOpen) {
			conOpen = false;
			return;
		}
		conAnchor = anchorTo(e);
		conY = conAnchor.y;
		conOpen = true;
	}
	function chooseCon(level: number) {
		onSetCon(level);
		conOpen = false;
	}
	function chooseTwin(twin: Twin) {
		onSetTwin?.(twin);
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
		loadoutAnchor = anchorTo(e);
		loadoutY = loadoutAnchor.y;
		loadoutOpen = true;
	}

	function closePopovers() {
		conOpen = false;
		loadoutOpen = false;
	}

	// ⚠️ The bench is the tools LAYOUT's, so leaving the planner only hides it
	// (`visibility`) — and these popovers are portalled out of that, so one
	// open at the leave stayed over the next tool until it was dismissed.
	closeOnLeave(() => conOpen || loadoutOpen, closePopovers);
</script>

<!-- The card inherits the ribbon's DARK context (it has no ground of its own).
     ⚠ A context class has to come with its ground — the `ctx-light` this
     used to carry (2026-08-05) rendered beige ink on the navy ribbon. -->
<div
	class="sp-card"
	class:sp-card--compact={compact}
	class:sp-card--resting={resting && !!char}
	title={resting && char ? `${char.displayName} is resting: not in the rotation yet` : undefined}
	style:--el={p.main}
	style:--sp-band="{compact ? compactDisc : CARD_PORTRAIT}px"
>
	<div class="sp-body">
		{#if actions && !compact}
			<!-- The RAIL. Rendered on every slot; the host disables its buttons on
			     an empty one, so the portraits never step sideways. -->
			<div class="sp-rail">{@render actions()}</div>
		{/if}
		<!-- The portrait. Anchored at the band's bottom, so the art's overhang
		     rises ABOVE the card rather than growing it. The portrait and its
		     constellation are SIBLING buttons — never one inside another, and
		     the rail's buttons stand beside them. -->
		<div class="sp-avatar-chip" class:sp-avatar-chip--picked={picked}>
			<span class="sp-side-art">
				<SidePortrait
					id={char ? slotId : null}
					size={compact ? compactDisc : CARD_PORTRAIT}
					fadeRight={compact ? 2 : 6}
					twin={$rotationTwin}
				/>
			</span>
			{#if onPortraitClick}
				<button class="sp-side-hit" onclick={onPortraitClick} aria-label={portraitLabel}></button>
			{/if}
			{#if char}
				<!-- ⚠ `ctx-dark` on the button itself, as SidePortrait claims it: an
				     OBJECT is opaque on every ground, and the hollow chip's well must
				     not resolve to whatever context the host stands in (⚓ Nate
				     2026-10-13 — it took the glass well on /lab). -->
				<button
					class="sp-disc-con ctx-dark"
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

		<!-- The column: the name over the loadout pill (the pill alone on the
		     phone). It paints OVER the portrait's art. -->
		<div class="sp-col">
			{#if !compact}
				<div class="sp-id-row">
					<span class="sp-char-name" class:sp-char-name--empty={!char}
						>{char ? slotLabel(char) : emptyLabel}</span
					>
					{#if uncurated}
						<span
							class="sp-namemark"
							title="Frame timing not curated yet — the rotation planner draws this character’s actions with generic timing"
							aria-label="Frame timing not curated yet"><Mark name="uncurated" size={12} /></span
						>
					{/if}
				</div>
			{/if}

			<!-- ⚓ NATE 2026-08-12: AN EMPTY SLOT KEEPS ITS STATIONS, inert — the
			     controls are the slot's shape, and a card that loses them reads as
			     a different, smaller kind of card. -->
			<div class="sp-controls">
				{#if compact}
					<!-- The upright pill is ONE button: both zones open the same panel,
					     so the whole ~22 × 47 pill is the touch target instead of two
					     ~22px squares whose 24px circles would overlap (WCAG 2.5.8). -->
					<button
						class="sp-loadout sp-loadout--one"
						class:sp-loadout--disabled={!char}
						disabled={!char}
						onclick={(e) => openLoadout(e, 'artifact')}
						title={char ? 'Artifact set and weapon' : undefined}
						aria-label="Choose artifact set and weapon"
					>
						<span class="sp-lo-zone" class:sp-lo-zone--unset={!loadoutEntry?.artifactSetId}>
							<img class="sp-lo-icon" src={artifactIcon} alt="" />
						</span>
						<span class="sp-lo-zone" class:sp-lo-zone--unset={!hasWeapon}>
							<img class="sp-lo-icon" src={weaponIcon} alt="" />
							{#if hasWeapon}
								<span class="sp-lo-ref" aria-hidden="true">{currentRef}</span>
							{/if}
						</span>
					</button>
				{:else}
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
							title={char
								? hasWeapon
									? `Weapon · refinement ${currentRef}`
									: 'Weapon'
								: undefined}
							aria-label="Choose weapon and refinement"
						>
							<img class="sp-lo-icon" src={weaponIcon} alt="" />
							<!-- The refinement, as the in-game weapon card draws it: a digit
							     on the icon's corner, DISPLAY only (the panel always renders
							     its pips). ⚓ NATE 2026-08-12: ABSENT with no weapon equipped
							     — there is no refinement to set until a weapon exists. -->
							{#if hasWeapon}
								<span class="sp-lo-ref" aria-hidden="true">{currentRef}</span>
							{/if}
						</button>
					</div>
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
		bind:this={conEl}
		use:portal
		transition:fade={{ duration: motion(T_QUICK) }}
		onintrostart={introLive}
		onoutrostart={outroInert}
		style:left="{conX}px"
		style:top="{conY}px"
	>
		{#if onSetTwin}
			<!-- The Traveler's twin: Aether and Lumine are timed apart. -->
			<div class="sp-twins" role="group" aria-label="Twin">
				{#each ['aether', 'lumine'] as const as twin (twin)}
					<button
						class="sp-twin"
						class:sp-twin--current={twin === $rotationTwin}
						style:--pip-color={p.main}
						aria-pressed={twin === $rotationTwin}
						onclick={() => chooseTwin(twin)}>{twinLabel(twin)}</button
					>
				{/each}
			</div>
		{/if}
		<div class="sp-pips">
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
	</div>
{/if}
{#if loadoutOpen && char}
	<div
		class="sp-popover sp-popover--panel"
		bind:this={loadoutEl}
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
			source={loadoutSource}
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
	   ONE band, two columns (portrait · column), TOP-ALIGNED inside
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
		/* ⚓ Nate 2026-10-13: 6px of breathing room inside the ribbon's frame on
		   each side, on top of its own RIBBON_PAD. ↻ 2026-10-22: NONE on the
		   left now the rail stands there (⚓ Nate) — the ribbon's pad is the
		   rail's air, as in the 2026-08-12 trim, and the 6px went to the name
		   column (Kuki Shinobu fits on one line again; a longer name is a
		   font-size or condensed-face question, not a padding one).
		   Vertical padding holds the band off the slot's top edge. */
		padding: 8px 6px 10px 0;

		/* The gap between the name and the controls. 🎛️ ⚓ Nate 2026-10-14:
		   1 (4 → 0 → 1) — the line box's own leading does most of the work. */
		--sp-gap: 1px;
		/* 🎛️ The centred column, dropped below the portrait's centre (⚓ Nate
		   2026-10-14: 3). */
		--sp-col-drop: 3px;
		/* 🎛️ The name's indent past the controls' edge (⚓ Nate 2026-10-14:
		   4, so the name lines up with the flower's left edge). */
		--sp-name-inset: 4px;
		/* 🎛️ Portrait → column (⚓ Nate 2026-10-13: 6, up from 4). */
		--sp-col-inset: 6px;

		/* ── THE RAIL'S GEOMETRY (lifted from the pre-2026-10-13 card) ─────────
		   --sp-rail-w is THE VISIBLE, CLICKABLE STRIP. Each tile's fill runs on
		   under the portrait (--sp-rail-underlap, a pseudo-element in the host
		   that paints and cannot be clicked) to the disc's centre and stops; the
		   opaque disc covers it from its own left edge, which sweeps left as the
		   circle widens, so the fill's right end is never visible. The thing you
		   can press is the thing you can see.

		   The width is set by the MARK clearing the circle's arc at its worst
		   corner (lower-right of the top mark):
		     R  = band/2                     = 30    (circle radius)
		     t  = (band − gap)/2             = 29    (tile height)
		     dy = R − (t + mark)/2           = 8.5
		     arc left at dy = R − √(R²−dy²)  = 1.23
		     W  ≥ inset + mark − 1.23        = 3 + 14 − 1.23 = 15.8
		   ⚠ RE-SOLVE IF CARD_PORTRAIT, THE GAP OR MARK_SIZE MOVE — the failure
		   is a glyph with its corner shaved off by the portrait. */
		--sp-rail-w: 16px;
		/* 🎛️ ⚓ Nate 2026-10-22: 2 (the old rail's was 4). */
		--sp-rail-gap: 2px;
		--sp-rail-mark-inset: 3px;
		--sp-rail-underlap: calc(var(--sp-band) / 2);

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
	   Two tiles splitting the band's height. Behind the portrait (which is
	   z 1) so the tiles' underlap slides beneath the disc. */
	.sp-rail {
		position: relative;
		z-index: 0;
		flex: 0 0 var(--sp-rail-w);
		width: var(--sp-rail-w);
		display: flex;
		flex-direction: column;
		gap: var(--sp-rail-gap);
		min-height: 0;
	}
	.sp-rail > :global(*) {
		flex: 1 1 0;
		width: 100%;
		min-height: 0;
	}

	/* ── The column ───────────────────────────────────────────────────────────
	   The name over the controls, as ONE block CENTRED on the portrait (⚓ Nate
	   2026-10-14, trying it — it used to be two 1fr tracks with the controls on
	   the band's bottom, level with the disc's constellation chip, and the name
	   brought down 6px). The name is indented --sp-name-inset past the pill so
	   its ink starts at the flower's edge; the pill does not move.

	   A two-line name (34) makes the block 34 + 1 + 26 = 61 — a px taller than
	   the portrait, and with the 3px drop its pill bottom sits 3.5px under the
	   portrait's. The card's 10px bottom padding absorbs it.

	   It PAINTS OVER the portrait's art (z 2 over the portrait's 1, ⚓ Nate): a
	   ponytail reaching sideways slips under the loadout pill's well. */
	.sp-col {
		position: relative;
		top: var(--sp-col-drop);
		z-index: 2;
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
		margin-left: var(--sp-col-inset);
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: var(--sp-gap);
	}
	/* flex-START, not center: a name that wraps to two lines keeps its mark on
	   line ONE rather than floating to the middle of the block. */
	.sp-id-row {
		padding-left: var(--sp-name-inset);
		display: flex;
		align-items: flex-start;
		gap: 0.3rem;
		min-width: 0;
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
	   at --fs-lg (34) + the gap (--sp-gap, 1) + the control row (26) is 61 —
	   a px over the 60px portrait, and --sp-col-drop moves it 3 lower still. Move this size or the clamp and the column stops matching the
	   disc — the card still works, it just stops looking designed. */
	.sp-char-name {
		min-width: 0;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--text);
		line-height: var(--lh-tight);
		/* ONE LINE EVEN WHEN EMPTY (⚓ Nate 2026-10-22): an empty slot's name
		   collapsed to 0, the centred column lost a line, and the inert pill
		   sat higher than a filled card's. */
		min-height: calc(1em * var(--lh-tight));
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
		/* ⚓ Nate 2026-10-14: the mark's bottom sits on the name's BASELINE (the
		   first line's, on a two-line name — the mark stays with line one). An svg has no baseline, so a flex
		   item made of one falls back to the row's bottom — 3–4px under the
		   letters. So the mark is set INLINE, in a line box of the name's own
		   type: an inline svg stands on the baseline, and that line box gives
		   the row a real baseline to align. */
		display: block;
		font-size: var(--fs-lg);
		line-height: var(--lh-tight);
		align-self: baseline;
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
		display: inline;
		vertical-align: baseline;
		width: 12px;
		height: 12px;
	}

	/* ── Portrait ─────────────────────────────────────────────────────────────
	   The square the disc occupies: the band's height, its width from the
	   aspect ratio. The side portrait inside is anchored at its BOTTOM, so the
	   disc lands on the band and the hair rises over the card's top padding
	   and beyond — nothing reserves that overhang, and nothing clips it.
	   🎛️ THE SIZE KNOB is `CARD_PORTRAIT` (desk) / the host's `compactDisc`
	   (phone), arriving as --sp-band. ⚠ The disc is a CAP, never a floor: the
	   floor is the slot's (BENCH_SLOT_MIN_H), the side that knows what a
	   portrait needs. */
	.sp-avatar-chip {
		position: relative;
		z-index: 1;
		flex: 0 0 auto;
		height: 100%;
		width: auto;
		aspect-ratio: 1;
		min-height: 0;
	}
	.sp-side-art {
		position: absolute;
		left: 0;
		bottom: 0;
		display: block;
		pointer-events: none;
	}
	/* RESTING (§8.1): seated, nothing written yet. The ART dims — its own
	   pixels, through the portrait's masks, so the overhang never shows a box
	   (a wash over the art's box painted a dark rectangle behind every disc).
	   ⚠ A filter on the bench's gliding cards is unverified in real Safari:
	   the sub-pixel laws ban element OPACITY there because WebKit rasterizes
	   it at rounded coordinates; a filter on one image is likely safe, and is
	   exactly what Nate's Safari pass must confirm. */
	.sp-card--resting :global(.spt-art) {
		filter: brightness(0.5) saturate(0.6);
	}
	.sp-card--resting .sp-char-name {
		color: var(--muted);
	}
	/* The constellation on the disc — the Builder chip's place and shape, but a
	   BUTTON (it is the editor). Filled = covered (or no roster); HOLLOW =
	   short; at C0 and covered it recedes to a ghost until hovered. */
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
	/* The ring: the SOFT line at rest, a gentle gold (--sel-ring, the accent at
	   55%) while the portrait is pointed at — the Builder's language (⚓ Nate
	   2026-10-13). The ring is BEHIND the art, so hair keeps crossing it. */
	.sp-avatar-chip :global(.spt-disc) {
		border-color: var(--line-soft);
	}
	.sp-avatar-chip:has(.sp-side-hit:hover) :global(.spt-disc),
	.sp-avatar-chip:has(.sp-side-hit:focus-visible) :global(.spt-disc),
	.sp-avatar-chip--picked :global(.spt-disc) {
		border-color: var(--sel-ring);
	}
	/* The portrait's hit area: the disc (the hair above it is not a target).
	   Its focus ring IS the gold ring above. */
	.sp-side-hit {
		position: absolute;
		inset: 0;
		padding: 0;
		border: none;
		border-radius: var(--r-round);
		background: none;
		cursor: pointer;
	}
	.sp-side-hit:focus-visible {
		outline: none;
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
	   viewport rather than centered on its anchor when it would overflow
	   (`placeAcross` moves it; this caps a panel taller than the screen). */
	.sp-popover--panel {
		padding: 10px 11px;
		max-height: calc(100vh - 16px);
		overflow-y: auto;
	}
	/* The pips are one row; a Traveler's twin choice sits above them. */
	.sp-popover:not(.sp-popover--panel) {
		flex-direction: column;
		align-items: stretch;
	}
	.sp-pips,
	.sp-twins {
		display: flex;
		gap: 4px;
	}
	.sp-twin {
		flex: 1;
		height: 24px;
		border-radius: var(--r-round);
		border: none;
		background: var(--fill-rest);
		color: var(--muted);
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		cursor: pointer;
		padding: 0 8px;
		transition:
			background var(--t-snap),
			box-shadow var(--t-snap),
			color var(--t-snap);
	}
	.sp-twin--current {
		background: color-mix(in srgb, var(--pip-color) 30%, transparent);
		color: var(--pip-color);
		box-shadow: inset 0 0 0 1.5px var(--pip-color);
	}
	.sp-twin:hover {
		background: var(--fill-hover);
		color: var(--pip-color, var(--text));
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
	/* ══ THE UPRIGHT CARD — the phone row (⚓ Nate 2026-10-13) ════════════════
	   The loadout pill stands UPRIGHT (flower over weapon) beside the portrait,
	   and the card is ONE row with no name and no rail:

	       ⟨hair⟩
	      (  d  )ⓒ▣       ← the pill, centred on the portrait
	      (     ) ⚔

	   width = d + 2 + 22 (benchBand `rowCardWidth`), height = the constant
	   BENCH_ROW_CARD_H. ⚠ Keep the gap and the pill in step with
	   BENCH_ROW_PILL_GAP / BENCH_ROW_PILL_W. */
	.sp-card--compact {
		padding: 0;
		--sp-up-gap: 2px;
		--sp-up-w: 22px;
		--sp-up-zone: 20px;
	}
	.sp-card--compact .sp-body {
		align-items: flex-end;
		gap: var(--sp-up-gap);
		height: 100%;
		max-height: none;
	}
	.sp-card--compact .sp-avatar-chip {
		height: var(--sp-band);
		width: var(--sp-band);
	}
	/* ⚓ Nate 2026-10-14: the pill is CENTRED on the portrait. The column is
	   the portrait's height, or the pill's (47) if that is taller — so below a
	   ~47 portrait (phones under ~350px) it stands on the portrait's foot as
	   before rather than hang under the card. */
	.sp-card--compact .sp-col {
		/* ⚠ A grid track, not `min-height: max-content` — WebKit ignores that
		   on this flex item and the pill hung 4px under the card at 320. */
		display: grid;
		grid-template-rows: minmax(var(--sp-band), auto);
		align-items: center;
		top: 0;
		margin: 0;
	}
	.sp-card--compact .sp-loadout {
		flex: none;
		flex-direction: column;
		width: var(--sp-up-w);
		height: auto;
		padding: 3px 0;
		cursor: pointer;
	}
	.sp-card--compact .sp-lo-zone {
		flex: none;
		width: var(--sp-up-zone);
		max-width: none;
		height: var(--sp-up-zone);
	}
	.sp-loadout--one:disabled {
		cursor: default;
	}
</style>
