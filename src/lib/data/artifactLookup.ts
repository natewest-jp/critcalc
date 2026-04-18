/**
 * src/lib/data/artifactLookup.ts
 *
 * Eager-loaded artifact set lookup from the curated JSONs.
 * Returns empty arrays / null until JSON files exist.
 */

import type { ArtifactSet } from '$lib/types/artifact';

const modules = import.meta.glob('./artifacts/*.json', { eager: true });

const _all: ArtifactSet[] = (Object.values(modules) as { default: ArtifactSet }[])
	.map((m) => m.default)
	.filter(Boolean)
	.sort((a, b) => a.name.localeCompare(b.name));

export function getAllArtifactSets(): ArtifactSet[] {
	return _all;
}

export function getArtifactSetById(id: string): ArtifactSet | null {
	return _all.find((a) => a.id === id) ?? null;
}

/** Resolves the static image path for an artifact set icon. */
export function artifactImagePath(id: string): string {
	return `/assets/artifacts/${id.replace(/_/g, '-')}.png`;
}
