<script lang="ts">
	/**
	 * SidePortrait — the overhanging side portrait (lineups design §9.5a), the
	 * Stygian Onslaught party screen's shape: a PLAIN ring on a dark disc, the
	 * side icon standing in front of it, hair and ornaments rising over the
	 * ring's top. ⚓ Nate 2026-10-08: no element tint on the ring (the game has
	 * none), no decorative dot, our palette's equivalents rather than its hues.
	 *
	 * The box is the disc plus the art's OVERHANG above it, so a host lays it
	 * out like any block and the hair never lands on whatever sits above. The
	 * art may still spill sideways (a ponytail) — that is the look.
	 *
	 * ⚓ It is an OBJECT, not a surface, so it claims `.ctx-dark` and is OPAQUE
	 * on every ground (Nate 2026-10-08: on glass the filled chip went
	 * translucent, because glass declares its lines and well with alpha). The
	 * class sets roles only and paints nothing.
	 *
	 * The ring sits BEHIND the art. Anything that marks the slot (selection,
	 * hover) belongs on the ring too, so the host passes `selected` rather than
	 * drawing its own circle over the hair.
	 *
	 * ══ THE CONSTELLATION CHIP (candidate, 2026-10-08) ══════════════════════
	 * ONE mark at the disc's lower right (where no hair reaches) carries the
	 * team's constellation AND whether your account covers it:
	 *   · filled "C2" — the team uses C2 and you own at least that (C0 owned:
	 *     no chip, so most portraits stay clean);
	 *   · HOLLOW "C2" — the team asks for more than you have. Not owning the
	 *     character is the bottom of the same scale (less than C0), so it is
	 *     the same hollow chip, and the hover says which.
	 * ⛔ The portrait and its ring are never dulled: a first cut faded the art
	 * and Nate ruled it out ("we don't want users to feel like not owning the
	 * character makes the tool look unattractive"); a quieter ring vanished on
	 * night. It replaces §9.5a's ring drawn inside the pip.
	 * `ownedCon` undefined = no ownership to compare against (the roster is
	 * empty, or marks are off) — the chip then only states the level.
	 */
	import Mark from './Mark.svelte';
	import ConMark from './ConMark.svelte';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { getAvatar, getAvatarFallback, hasAvatar } from '$lib/utils/getAvatar';
	import { siteSettings } from '$lib/stores';
	import { SIDE_GEOMETRY, sideLayout, type SideGeometry } from '$lib/sidePortrait';

	let {
		id,
		size = 64,
		con,
		ownedCon,
		selected = false,
		geometry = SIDE_GEOMETRY
	}: {
		id: string | null;
		/** The DISC's diameter in px. The art is larger (see `SIDE_ART_PER_DISC`). */
		size?: number;
		/** The constellation this team/rotation uses. Absent: no chip. */
		con?: number;
		/** Your account's: a level, `null` = not owned, undefined = unknown. */
		ownedCon?: number | null;
		selected?: boolean;
		/** /lab's tuning sliders only — every surface takes the default. */
		geometry?: SideGeometry;
	} = $props();

	const short = $derived(
		con !== undefined && ownedCon !== undefined && (ownedCon === null || ownedCon < con)
	);
	const showChip = $derived(!!id && con !== undefined && (short || con > 0));

	const lay = $derived(sideLayout(size, geometry));
	const name = $derived(id ? (getCharacterIndexEntry(id)?.displayName ?? id) : '');

	function handleError(e: Event) {
		const img = e.currentTarget as HTMLImageElement;
		if (id && !img.dataset.triedFallback) {
			img.dataset.triedFallback = '1';
			img.src = getAvatarFallback(id, 'side', $siteSettings.travelerVariant);
		} else {
			img.style.display = 'none';
		}
	}
</script>

<span
	class="spt ctx-dark"
	style:--d="{size}px"
	style:--over="{lay.overhang}px"
	style:--art="{lay.art}px"
	style:--art-left="{lay.left}px"
	style:--art-top="{lay.top}px"
	style:--mx="{geometry.cx * lay.art}px"
	style:--my="{geometry.cy * lay.art}px"
>
	<span class="spt-disc" class:spt-disc--empty={!id} class:spt-disc--selected={selected}>
		{#if !id}
			<Mark name="plus" size={Math.round(size / 4)} />
		{:else if !hasAvatar(id)}
			<span class="spt-initials">{name.slice(0, 2)}</span>
		{/if}
	</span>
	{#if id && hasAvatar(id)}
		<img
			class="spt-art"
			class:spt-art--clip={geometry.clipBelow}
			src={getAvatar(id, $siteSettings.useNewOutfits, 'side', $siteSettings.travelerVariant)}
			alt={name}
			onerror={handleError}
		/>
	{/if}
	{#if showChip && con !== undefined}
		<span
			class="spt-chip"
			class:spt-chip--short={short}
			title={!short
				? `C${con}`
				: ownedCon === null
					? `You don't own ${name}`
					: `This team uses C${con} · you own C${ownedCon}`}
		>
			<ConMark level={con} height={Math.max(6, Math.round(size * 0.11))} />
		</span>
	{/if}
</span>

<style>
	.spt {
		position: relative;
		display: block;
		flex: none;
		width: var(--d);
		height: calc(var(--d) + var(--over));
	}
	/* The ring and its ground. Behind the art, at the bottom of the box. */
	.spt-disc {
		position: absolute;
		left: 0;
		bottom: 0;
		width: var(--d);
		height: var(--d);
		box-sizing: border-box;
		border-radius: var(--r-round);
		background: var(--surface-well);
		border: 2px solid var(--line-strong);
		color: var(--muted);
		display: grid;
		place-items: center;
		transition:
			border-color var(--t-snap),
			box-shadow var(--t-snap);
	}
	.spt-disc--empty {
		border-style: dashed;
		border-color: var(--line-soft);
	}
	/* Selected: the gold ring, the site's one meaning for "chosen". Outside the
	   plain ring, so the plain ring stays the portrait's own edge. */
	.spt-disc--selected {
		box-shadow: 0 0 0 2px var(--sel-ring);
	}
	.spt-initials {
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
	.spt-art {
		position: absolute;
		left: var(--art-left);
		top: calc(var(--over) + var(--art-top));
		width: var(--art);
		height: var(--art);
		/* The art is WIDER than its box (the disc) by design; the global
		   `img { max-width: 100% }` capped it at the disc and squashed every
		   portrait horizontally. */
		max-width: none;
		pointer-events: none;
	}
	/* Below the disc's centre line the art is held to the disc; above it, it
	   rises free. Two mask layers that ADD: the band above the centre, and the
	   disc itself (a half-pixel ramp, so the cut is antialiased). */
	.spt-art--clip {
		--r: calc(var(--d) / 2);
		mask-image:
			linear-gradient(#000, #000),
			radial-gradient(
				circle var(--r) at var(--mx) var(--my),
				#000 calc(var(--r) - 0.5px),
				transparent calc(var(--r) + 0.5px)
			);
		mask-size:
			100% var(--my),
			100% 100%;
		mask-position:
			0 0,
			0 0;
		mask-repeat: no-repeat;
	}
	/* ── The constellation chip ──
	   A pill at the lower right, sized off the disc. It always carries its own
	   ground (the well) so hair behind it never muddies the glyph.
	   filled: the ring's ink as a fill — it reads as part of the portrait.
	   short:  HOLLOW — the well with a 1px ink ring, the glyph in the same ink. */
	.spt-chip {
		position: absolute;
		right: calc(var(--d) * -0.04);
		bottom: 0;
		height: calc(var(--d) * 0.22);
		padding: 0 calc(var(--d) * 0.07);
		box-sizing: border-box;
		display: grid;
		place-items: center;
		border-radius: var(--r-round);
		background: var(--line-strong);
		color: var(--text);
	}
	.spt-chip--short {
		background: var(--surface-well);
		border: 1px solid var(--muted);
		color: var(--muted);
	}
</style>
