import { NEWFIT_AVATARS } from '$lib/data/newfitAvatars';

export type AvatarSize = 'full' | 'circle' | 'side';

function slugifyCharacterId(id: string): string {
	return id.replace(/_/g, '-');
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
