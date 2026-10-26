/**
 * How a profile LOOKS, for every surface that draws one (the top bar, its
 * menu, the profile form, the switch cue): its colour as a CSS value and its
 * picture as a URL. Pure.
 */

import type { Picture, ProfileColour, Twin } from '$lib/storage/records';
import { PROFILE_PICTURES, THEORYCRAFT_PICTURE } from '$lib/profilePictures.generated';
import { getAvatar } from '$lib/utils/getAvatar';

/** The seven a real profile can wear, in the game's element order (§2.3). */
export const REAL_COLOURS: readonly Exclude<ProfileColour, 'theorycraft'>[] = [
	'pyro',
	'hydro',
	'anemo',
	'electro',
	'dendro',
	'cryo',
	'geo'
];

export const COLOUR_NAME: Record<ProfileColour, string> = {
	pyro: 'Pyro',
	hydro: 'Hydro',
	anemo: 'Anemo',
	electro: 'Electro',
	dendro: 'Dendro',
	cryo: 'Cryo',
	geo: 'Geo',
	theorycraft: 'Theorycraft'
};

export type RealColour = (typeof REAL_COLOURS)[number];

/**
 * The colour a new profile starts on: the least worn, first in the game's
 * order on a tie (↻ Nate 2026-10-26: colours repeat now, but a new profile
 * still keeps them apart while it can). Theorycraft's white is never one.
 */
export function nextColour(worn: readonly ProfileColour[]): RealColour {
	const count = (c: RealColour) => worn.filter((w) => w === c).length;
	return REAL_COLOURS.reduce((best, c) => (count(c) < count(best) ? c : best));
}

/** ⚓ Theorycraft's name is its own: a real profile called that would pass
 *  for the built-in one, which behaves differently (no roster, links open
 *  there). Any case, any spacing. */
export const isReservedName = (name: string): boolean =>
	name.trim().replace(/\s+/g, ' ').toLowerCase() === 'theorycraft';

export const colourValue = (c: ProfileColour): string =>
	c === 'theorycraft' ? 'var(--profile-theorycraft)' : `var(--el-${c}-main)`;

export function pictureUrl(p: Picture, newOutfits: boolean, twin: Twin): string | null {
	if (p.kind === 'character') return getAvatar(p.id, newOutfits, 'circle', twin);
	if (p.name === THEORYCRAFT_PICTURE.id) return THEORYCRAFT_PICTURE.url;
	return PROFILE_PICTURES.find((x) => x.id === p.name)?.url ?? null;
}
