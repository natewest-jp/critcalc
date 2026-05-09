/**
 * src/lib/types/artifact.ts
 *
 * Artifact set schema types derived from the gold-standard transformer model.
 */

import type { Effect } from './ability';

// ---------------------------------------------------------------------------
// Artifact data
// ---------------------------------------------------------------------------

/** A single artifact set bonus definition. */
export type ArtifactSetBonus = {
	effects: Effect[];
};

/** Full artifact set definition with optional 2pc/4pc bonuses. */
export type ArtifactSet = {
	id: string;
	name: string;
	shortName?: string;
	twoPiece?: ArtifactSetBonus;
	fourPiece?: ArtifactSetBonus;
};
