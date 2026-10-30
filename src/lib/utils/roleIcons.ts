/**
 * src/lib/utils/roleIcons.ts
 *
 * Icon + label helpers for editorial Imaginarium Theater roles: the colour
 * glyphs on the role plates of `CharacterFilterStrip`. Assets live in
 * static/assets/roles/color/<slug>.svg — a fixed five-glyph vocabulary (like
 * element icons), so there's no availability manifest. The `monotone/` set
 * beside it is unused and stays, since `/assets` is add-only.
 */

import type { RoleFunction, RolePosition } from '$lib/types/character';

const POSITION_SLUG: Record<RolePosition, string> = {
	onField: 'on-fielder',
	offField: 'off-fielder'
};
const FUNCTION_SLUG: Record<RoleFunction, string> = {
	dps: 'dps',
	support: 'support',
	survivability: 'survivability'
};

export const POSITION_LABEL: Record<RolePosition, string> = {
	onField: 'On-Field',
	offField: 'Off-Field'
};

function roleIconPath(slug: string): string {
	return `/assets/roles/color/${slug}.svg`;
}
export function positionIcon(position: RolePosition): string {
	return roleIconPath(POSITION_SLUG[position]);
}
export function functionIcon(fn: RoleFunction): string {
	return roleIconPath(FUNCTION_SLUG[fn]);
}
