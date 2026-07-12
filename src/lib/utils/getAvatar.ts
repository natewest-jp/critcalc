import { AVAILABLE_AVATARS, NEWFIT_AVATARS } from '$lib/data/newfitAvatars';

export type AvatarSize = 'full' | 'circle' | 'side';

/** Asset-filename irregularities: Lan Yan's corpus id is `lanyan` (no
 *  underscore, predating the ingest generator) but her assets follow the
 *  standard spaced-name convention (`lan-yan.webp`). */
const SLUG_OVERRIDES: Record<string, string> = { lanyan: 'lan-yan' };

function slugifyCharacterId(id: string): string {
	return SLUG_OVERRIDES[id] ?? id.replace(/_/g, '-');
}

/** True when the character has avatar assets at all (travelers etc. don't).
 *  SSR'd consumers must check this and render a placeholder instead of an
 *  <img> — runtime onerror fallbacks can't cover prerender, and the
 *  prerenderer fails the build on crawled-asset 404s. */
export function hasAvatar(id: string): boolean {
	return AVAILABLE_AVATARS.has(slugifyCharacterId(id));
}

export function getAvatar(id: string, preferNewfit: boolean, size: AvatarSize): string {
	const slug = slugifyCharacterId(id);
	const base = `/assets/characters/${size}/${slug}`;
	// Only request the -newfit variant for characters that actually have one;
	// otherwise the ~115 without a skin 404 on every load. Manifest is generated
	// from the committed avatar files by scripts/generate-newfit.js.
	return preferNewfit && NEWFIT_AVATARS.has(slug) ? `${base}-newfit.webp` : `${base}.webp`;
}

export function getAvatarFallback(id: string, size: AvatarSize): string {
	const slug = slugifyCharacterId(id);
	return `/assets/characters/${size}/${slug}.webp`;
}
