/**
 * src/lib/utils/roleIcons.ts
 *
 * Icon + label helpers for editorial Imaginarium Theater roles. Two variants:
 * `color` (the foreground glyph on the Atlas cards) and `monotone` (the large
 * backdrop overlay behind a card). Assets live in
 * static/assets/roles/{color,monotone}/<slug>.svg — a fixed five-glyph
 * vocabulary (like element icons), so there's no availability manifest.
 */

import type { RoleFunction, RolePosition } from '$lib/types/character';

export type RoleIconVariant = 'color' | 'monotone';

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
export const FUNCTION_LABEL: Record<RoleFunction, string> = {
	dps: 'DPS',
	support: 'Support',
	survivability: 'Survivability'
};

export function roleIconPath(slug: string, variant: RoleIconVariant): string {
	return `/assets/roles/${variant}/${slug}.svg`;
}
export function positionIcon(position: RolePosition, variant: RoleIconVariant): string {
	return roleIconPath(POSITION_SLUG[position], variant);
}
export function functionIcon(fn: RoleFunction, variant: RoleIconVariant): string {
	return roleIconPath(FUNCTION_SLUG[fn], variant);
}
