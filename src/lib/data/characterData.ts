/**
 * src/lib/data/characterData.ts
 *
 * Lazy character payload loader. Each character JSON is its own code-split
 * chunk (non-eager import.meta.glob), fetched on demand — in normal use only
 * the ≤4 slotted characters ever load. The identity index in
 * characterIndex.generated.ts (via characterLookup.ts) stays eager/sync.
 *
 * The loaded cache is a SvelteMap, so reads from $derived/$effect contexts
 * re-run when a payload lands — components read getLoadedCharacter() and
 * populate reactively once loadCharacter() resolves.
 */

import { SvelteMap } from 'svelte/reactivity';
import type { CharacterData } from '$lib/types/character';

type JsonModule = { default?: CharacterData } | CharacterData;

const loaders = import.meta.glob('./characters/*.json') as Record<
	string,
	() => Promise<JsonModule>
>;

const loaded = new SvelteMap<string, CharacterData>();
const inFlight = new Map<string, Promise<CharacterData | null>>();

/** Sync, reactive read of an already-loaded payload. Null until loadCharacter(id) resolves. */
export function getLoadedCharacter(id: string): CharacterData | null {
	return loaded.get(id) ?? null;
}

/**
 * Load a character payload by id (character JSON filenames match ids).
 * Idempotent: cached payloads resolve immediately, in-flight loads dedupe.
 * Unknown ids resolve to null.
 */
export function loadCharacter(id: string): Promise<CharacterData | null> {
	const cached = loaded.get(id);
	if (cached) return Promise.resolve(cached);

	const pending = inFlight.get(id);
	if (pending) return pending;

	const loader = loaders[`./characters/${id}.json`];
	if (!loader) return Promise.resolve(null);

	const promise = loader()
		.then((mod) => {
			const data = ('default' in mod ? mod.default : mod) as CharacterData | undefined;
			if (!data?.id) return null;
			loaded.set(data.id, data);
			return data;
		})
		.finally(() => {
			inFlight.delete(id);
		});
	inFlight.set(id, promise);
	return promise;
}
