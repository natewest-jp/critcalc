/**
 * How a profile LOOKS, for every surface that draws one (the top bar, its
 * menu, the profile form, the switch cue): its color as a CSS value and its
 * picture as a URL. Pure.
 */

import type { Picture, ProfileColor, Twin } from '$lib/storage/records';
import { PROFILE_PICTURES, THEORYCRAFT_PICTURE } from '$lib/profilePictures.generated';
import { getAvatar } from '$lib/utils/getAvatar';

/** The seven a real profile can wear, in the game's element order (§2.3). */
export const REAL_COLORS: readonly Exclude<ProfileColor, 'theorycraft'>[] = [
	'pyro',
	'hydro',
	'anemo',
	'electro',
	'dendro',
	'cryo',
	'geo'
];

export const COLOR_NAME: Record<ProfileColor, string> = {
	pyro: 'Pyro',
	hydro: 'Hydro',
	anemo: 'Anemo',
	electro: 'Electro',
	dendro: 'Dendro',
	cryo: 'Cryo',
	geo: 'Geo',
	theorycraft: 'Theorycraft'
};

export type RealColor = (typeof REAL_COLORS)[number];

/**
 * The color a new profile starts on: the least worn, first in the game's
 * order on a tie (↻ Nate 2026-10-26: colors repeat now, but a new profile
 * still keeps them apart while it can). Theorycraft's white is never one.
 */
export function nextColor(worn: readonly ProfileColor[]): RealColor {
	const count = (c: RealColor) => worn.filter((w) => w === c).length;
	return REAL_COLORS.reduce((best, c) => (count(c) < count(best) ? c : best));
}

/** ⚓ Theorycraft's name is its own: a real profile called that would pass
 *  for the built-in one, which behaves differently (no roster, links open
 *  there). Any case, any spacing. */
export const isReservedName = (name: string): boolean =>
	name.trim().replace(/\s+/g, ' ').toLowerCase() === 'theorycraft';

export const colorValue = (c: ProfileColor): string =>
	c === 'theorycraft' ? 'var(--profile-theorycraft)' : `var(--el-${c}-main)`;

export function pictureUrl(p: Picture, newOutfits: boolean, twin: Twin): string | null {
	if (p.kind === 'character') return getAvatar(p.id, newOutfits, 'circle', twin);
	if (p.name === THEORYCRAFT_PICTURE.id) return THEORYCRAFT_PICTURE.url;
	return PROFILE_PICTURES.find((x) => x.id === p.name)?.url ?? null;
}
