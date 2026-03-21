export type AvatarSize = 'full' | 'circle' | 'side';

function slugifyCharacterId(id: string): string {
	return id.replace(/_/g, '-');
}

export function getAvatar(id: string, preferNewfit: boolean, size: AvatarSize): string {
	const slug = slugifyCharacterId(id);
	const base = `/assets/characters/${size}/${slug}`;
	return preferNewfit ? `${base}-newfit.webp` : `${base}.webp`;
}

export function getAvatarFallback(id: string, size: AvatarSize): string {
	const slug = slugifyCharacterId(id);
	return `/assets/characters/${size}/${slug}.webp`;
}
