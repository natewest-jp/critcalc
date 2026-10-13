/**
 * Release order — "newest first", the one rule the Coverage page and the
 * Team Builder's character grid both sort by.
 *
 * `release` is the PATCH only ("7.1"), so two characters from one patch tie
 * and fall back to their names.
 */
import type { CharacterIndexEntry } from '$lib/types/character';

/** "7.1" → 7001: a patch's minor never reaches 1000, and "6.10" must sort
 *  after "6.9", which a float would not. Unknown sorts last. */
export function patchOrder(release: string | undefined): number {
	const m = /^(\d+)\.(\d+)$/.exec(release ?? '');
	return m ? Number(m[1]) * 1000 + Number(m[2]) : -1;
}

/** Newest patch first, then by name. */
export function newestFirst(
	a: Pick<CharacterIndexEntry, 'release' | 'displayName'>,
	b: Pick<CharacterIndexEntry, 'release' | 'displayName'>
): number {
	return (
		patchOrder(b.release) - patchOrder(a.release) || a.displayName.localeCompare(b.displayName)
	);
}
