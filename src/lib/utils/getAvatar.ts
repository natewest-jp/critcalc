import { AVAILABLE_AVATARS, NEWFIT_AVATARS } from '$lib/data/newfitAvatars';

export type AvatarSize = 'full' | 'circle' | 'side';

/** Asset-filename irregularities: Lan Yan's corpus id is `lanyan` (no
 *  underscore, predating the ingest generator) but her assets follow the
 *  standard spaced-name convention (`lan-yan.webp`). */
const SLUG_OVERRIDES: Record<string, string> = { lanyan: 'lan-yan' };

/** The six element-traveler ids share one avatar pair: aether.webp /
 *  lumine.webp (both with -newfit variants). Which one renders is a site
 *  setting (siteSettings.travelerVariant, default aether) — callers pass it
 *  through explicitly so avatar bindings stay reactive to the setting. */
export type TravelerVariant = 'aether' | 'lumine';

function slugifyCharacterId(id: string, traveler: TravelerVariant): string {
	if (id.startsWith('traveler_')) return traveler;
	return SLUG_OVERRIDES[id] ?? id.replace(/_/g, '-');
}

/** True when the character has avatar assets at all.
 *  SSR'd consumers must check this and render a placeholder instead of an
 *  <img> — runtime onerror fallbacks can't cover prerender, and the
 *  prerenderer fails the build on crawled-asset 404s. Travelers resolve to
 *  the aether/lumine pair (always authored together), so the variant doesn't
 *  affect presence. */
export function hasAvatar(id: string): boolean {
	return AVAILABLE_AVATARS.has(slugifyCharacterId(id, 'aether'));
}

export function getAvatar(
	id: string,
	preferNewfit: boolean,
	size: AvatarSize,
	traveler: TravelerVariant = 'aether'
): string {
	const slug = slugifyCharacterId(id, traveler);
	const base = `/assets/characters/${size}/${slug}`;
	// Only request the -newfit variant for characters that actually have one;
	// otherwise the ~115 without a skin 404 on every load. Manifest is generated
	// from the committed avatar files by scripts/generate-newfit.js.
	return preferNewfit && NEWFIT_AVATARS.has(slug) ? `${base}-newfit.webp` : `${base}.webp`;
}

export function getAvatarFallback(
	id: string,
	size: AvatarSize,
	traveler: TravelerVariant = 'aether'
): string {
	const slug = slugifyCharacterId(id, traveler);
	return `/assets/characters/${size}/${slug}.webp`;
}
