<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import Mark from './Mark.svelte';
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
	// ⚗️ TEMPORARY — see the flag's note; remove this import with the experiment.
	import { BENCH_PORTRAIT_SHOWN } from '$lib/benchBand.svelte';
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
				aria-label="Frame timing not curated yet"><Mark name="uncurated" size={11} /></span
			>
		{/if}
		<button
			class="sp-cons-chip"
			class:sp-cons-chip--set={conLevel > 0}
			disabled={!char || noCons}
			onclick={openConstellation}
			title={noCons ? 'Constellations can’t be unlocked for this character' : undefined}
			aria-label={char
				? noCons
					? `${char.displayName} has no constellations`
					: `Set constellation for ${char.displayName}`
				: 'Constellation (empty slot)'}>C{conLevel}</button
		>
	</div>

	<!-- ⚗️ TEMPORARY (⚓ Nate 2026-08-11): the portrait is out so the timeline can
	     be judged without the bench card's floor holding its rows up. The whole
	     area goes, not just the disc — an empty flex:1 box would still claim the
	     space the experiment is trying to reclaim. Flip BENCH_PORTRAIT_SHOWN
	     back to `true` to restore it; see the note there. -->
	{#if BENCH_PORTRAIT_SHOWN}
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
	{/if}

	<!-- Base band: the loadout pill, flanked by any host slot actions. The
	     actions wrapper is `display: contents`, so the buttons become flex items
	     of THIS row and `order` seats the first left of the pill and the last
	     right of it — one `actions` snippet, two sides. -->
	<div class="sp-loadout-row">
		{#if actions}<span class="sp-actions">{@render actions()}</span>{/if}
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
				title={char ? 'Weapon' : undefined}
				aria-label="Choose weapon"
			>
				<img class="sp-lo-icon" src={weaponIcon} alt="" />
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
	/* Registered so the icon wash's alpha INTERPOLATES (the hover ease) — an
	   unregistered custom property snaps between values. Registration is
	   page-global by nature; the sp- prefix keeps it this card's. */
	@property --sp-wash-a {
		syntax: '<percentage>';
		inherits: false;
		initial-value: 0%;
	}

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

	.sp-portrait-area {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* ── Base band ────────────────────────────────────────────────────────────
	   The loadout pill between the host slot actions. `contents` dissolves the
	   actions wrapper so its buttons become flex items of this row; `order` then
	   seats the first one left of the pill and the last one right, which is how
	   ONE snippet fills both sides. space-between ranges the outer actions to
	   the card's padding edges — the ✕ sits on the constellation chip's exact
	   vertical (same circle, same edge), the ⇄ on the name's — and splits the
	   leftover space evenly either side of the pill. The gap is only the
	   crush floor for a hairline card. */
	.sp-loadout-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
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

	/* Constellation selector: the loadout pill's twin — identical height, fill,
	   border and radius, so the card's two value controls are one family. It is
	   no longer a global .chip; that class carried a different fill and radius,
	   all of which this overrode. Only the VALUE changes with state: dimmed
	   white unset (the icons' ladder), element-tinted when set — the same
	   contract the refinement zone follows. */
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
		font-family: var(--font-body);
		/* --fs-xs, not the chip-label 2xs — sized up alongside the SVG action
		   glyphs (⚓ NATE 2026-08-06); the refinement value and both pickers'
		   pips move together. */
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		/* ── Centering the C value in its ring (⚓ NATE 2026-08-06) ────────────
		   Two corrections, both measured against the ring's own rendered center
		   (pixel-analysed at 8× in Chrome AND WebKit — font metrics were too
		   coarse to see this, and a screenshot of the chip alone can't: its clip
		   rect rounds to whole device pixels, so the ring has to be in frame as
		   the reference):

		   1. NO letter-spacing. Tracking lands after the LAST glyph too, so the
		      advance box the grid centers is one unit wider than the ink.
		   2. This optical nudge. Even untracked, "C"+digit ink sits RIGHT of
		      the advance box's center (bearings, plus the open C carrying less
		      mass than the digit) — measured +0.25px in Chrome and +0.81px in
		      WebKit, which is why Safari looked worse. Safe for every value:
		      C0–C6 are all C + one tabular digit, one constant offset.

		   In em so it tracks font-size. Swept 0 → −1px: −0.07em lands both
		   engines inside ±0.32px by ink-bbox and by mass centroid (−1px
		   over-corrects Chrome, −0.5 leaves WebKit at +0.5). Tune it here; the
		   probe is scratch/chip-nudge-sweep.mjs. */
		text-indent: -0.07em;
		line-height: var(--lh-none);
		cursor: pointer;
		transition: color 150ms ease;
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
		border: none;
		border-radius: var(--r-round);
		background: var(--sp-pill-fill);
	}
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
		transition: background 150ms ease;
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
	   unset-rest/unset-hover. Icon zones only (:not(.sp-lo-ref)) — the R value
	   is text, and `color` is already paint. */
	.sp-lo-zone:not(.sp-lo-ref)::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		--sp-wash-a: 15%;
		background: color-mix(in srgb, var(--sp-pill-fill) var(--sp-wash-a), transparent);
		transition: --sp-wash-a 150ms ease;
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
	/* Doubled class = specificity over the base rule's `.sp-lo-zone:not(...)`
	   (two class-level simple selectors each; source order alone loses). */
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
	/* Refinement rides the pill as a third zone. Weapons are always R1–R5, so it
	   is never absent — dimmed white until a weapon is equipped (the icons'
	   ladder), element-tinted after, mirroring the constellation chip exactly. */
	.sp-lo-ref {
		width: auto;
		min-width: 24px;
		padding: 0 5px;
		color: var(--sp-unset-ink);
		font-family: var(--font-body);
		font-size: var(--fs-sm);
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
	/* Exactly the constellation chip's hover: unset climbs the icon ladder,
	   a set value goes to --text. */
	.sp-lo-ref:hover:not(:disabled) {
		color: var(--sp-unset-ink-hover);
	}
	.sp-lo-ref--set:hover:not(:disabled) {
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

	   🎛️ --sp-avatar-max is the size knob Nate's concepts drew at 68. The art's
	   framing is independent of it (see .sp-avatar-img), so it stays free to
	   retune; only the bench WIDTH tokens need to follow it now. */
	.sp-avatar-chip {
		position: relative;
		--sp-avatar-max: 68px;
		height: 100%;
		width: auto;
		aspect-ratio: 1;
		max-height: var(--sp-avatar-max);
		max-width: var(--sp-avatar-max);
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
		background: var(--fill-hover);
		color: var(--pip-color, var(--text));
	}
</style>
