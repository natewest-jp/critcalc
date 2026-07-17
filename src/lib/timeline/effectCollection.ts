/**
 * src/lib/timeline/effectCollection.ts
 *
 * Re-export shim: the module moved to `src/lib/utils/effectCollection.ts`
 * (post-P4 #5 phase 4) so the parser's buff-window derivation can import it
 * without reaching into the timeline layer. Timeline-side imports keep
 * working through this shim.
 */
export * from '$lib/utils/effectCollection';
