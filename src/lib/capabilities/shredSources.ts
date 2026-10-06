/**
 * Shred sources — every RES shred, DEF shred and DEF ignore the data carries,
 * flattened for the Visualizers' DEF & RES instrument (2026-10-06).
 *
 * Derived, never hand-maintained: characters come through
 * `deriveCharacterCapabilities` (its `amount` + `mod`), artifact sets straight
 * from their 4pc effects. `scripts/generate-character-index.mjs` writes the
 * result to `shredSources.generated.ts` so the instrument never loads the 123
 * lazy character payloads; `characterIndex.test.ts` guards the drift.
 *
 * ⚠️ Types-only imports — the generator runs this under Node's type stripping.
 */

import type { DerivedCapability } from './deriveCapabilities';

export type ShredStat = 'res' | 'def' | 'ignore';

/** The seven elements plus Physical — what a RES shred can name. */
export const SHRED_ELEMENTS = [
	'pyro',
	'hydro',
	'anemo',
	'electro',
	'dendro',
	'cryo',
	'geo',
	'physical'
] as const;
export type ShredElement = (typeof SHRED_ELEMENTS)[number];

const ELEMENTAL: ShredElement[] = SHRED_ELEMENTS.filter((e) => e !== 'physical');

export type ShredSource = {
	/** Character id or artifact set id. */
	owner: string;
	/** The character's display name, or the set's name. */
	ownerName: string;
	ownerKind: 'character' | 'artifact';
	/** The hosting entry's in-game name (talent, constellation, set). */
	ability: string;
	stat: ShredStat;
	/** `ignore` only: the attack class it is limited to (Yae C6's ticks). */
	scope?: 'skill';
	/** `res` only: the elements it lowers. Empty for DEF shred and ignore. */
	elements: ShredElement[];
	/** A positive percent. */
	amount: number;
	minCon: number;
	/** The in-game debuff — rows sharing one never stack (`resShred.mod`). */
	mod?: string;
	/** Who an ignore reaches: the holder alone, or the party. */
	target?: 'self' | 'team';
	/** Runtime conditions the data could not settle statically. */
	caveats: string[];
};

/** One character's capabilities → its shred rows, one per (entry, debuff,
 *  amount) with the elements unioned. Two triggers of one debuff at one
 *  strength (Faruzan's C0/C2 durations, Zhongli's hold E and C2 burst — a
 *  shared `mod`) fold to the lowest constellation that reaches it. */
export function characterShredSources(
	owner: string,
	ownerName: string,
	capabilities: readonly DerivedCapability[]
): ShredSource[] {
	const rows = new Map<string, ShredSource>();
	for (const cap of capabilities) {
		if (cap.amount === undefined) continue;
		let stat: ShredStat;
		let scope: ShredSource['scope'];
		let elements: ShredElement[] = [];
		if (cap.kind === 'resShred') {
			stat = cap.detail === 'def' ? 'def' : 'res';
			if (stat === 'res')
				elements = cap.detail === 'all' ? ELEMENTAL : [cap.detail as ShredElement];
		} else if (cap.kind === 'buff' && cap.detail === 'defIgnore') {
			stat = 'ignore';
		} else if (cap.kind === 'buff' && cap.detail === 'skillDefIgnore') {
			stat = 'ignore';
			scope = 'skill';
		} else continue;
		const ability = cap.source.abilityName;
		let key = [stat, scope ?? '', cap.mod ?? ability, cap.amount].join('|');
		let row = rows.get(key);
		// Without a `mod`, one entry's rows are ONE source only while they split
		// it by element (Eula's Cryo and Physical). Two on the same element are
		// two debuffs that SUM — Linnea's Ascendant Gleam "further" 15%.
		while (
			row &&
			cap.mod === undefined &&
			(elements.length === 0 || elements.some((e) => row!.elements.includes(e)))
		) {
			key += '+';
			row = rows.get(key);
		}
		if (row) {
			for (const e of elements) if (!row.elements.includes(e)) row.elements.push(e);
			row.minCon = Math.min(row.minCon, cap.minConstellation);
			for (const c of cap.caveats) if (!row.caveats.includes(c)) row.caveats.push(c);
			continue;
		}
		rows.set(key, {
			owner,
			ownerName,
			ownerKind: 'character',
			ability,
			stat,
			...(scope && { scope }),
			elements: [...elements],
			amount: cap.amount,
			minCon: cap.minConstellation,
			...(cap.mod !== undefined && { mod: cap.mod }),
			...(stat === 'ignore' && { target: cap.target === 'team' ? 'team' : 'self' }),
			caveats: [...cap.caveats]
		});
	}
	return [...rows.values()].map(sortRow);
}

type ArtifactLike = {
	id: string;
	name: string;
	fourPiece?: { effects?: unknown[] };
};

/** A set's 4pc shreds → one row per amount. A set's shred is ONE debuff
 *  however many triggers reach it (Deepwood's skill and burst hits), so the
 *  set id is its `mod`. */
export function artifactShredSources(set: ArtifactLike): ShredSource[] {
	const rows = new Map<number, ShredSource>();
	for (const raw of set.fourPiece?.effects ?? []) {
		const e = raw as { type?: string; value?: number; element?: string; shredStat?: string };
		if (e.type !== 'resShred' || typeof e.value !== 'number') continue;
		const amount = Math.abs(e.value);
		const stat: ShredStat = e.shredStat === 'def' ? 'def' : 'res';
		const row = rows.get(amount) ?? {
			owner: set.id,
			ownerName: set.name,
			ownerKind: 'artifact' as const,
			ability: set.name,
			stat,
			elements: [],
			amount,
			minCon: 0,
			mod: set.id,
			caveats: []
		};
		const els = e.element ? [e.element as ShredElement] : stat === 'res' ? ELEMENTAL : [];
		for (const el of els) if (!row.elements.includes(el)) row.elements.push(el);
		rows.set(amount, row);
	}
	return [...rows.values()].map(sortRow);
}

function sortRow(r: ShredSource): ShredSource {
	r.elements.sort((a, b) => SHRED_ELEMENTS.indexOf(a) - SHRED_ELEMENTS.indexOf(b));
	r.caveats.sort();
	return r;
}
