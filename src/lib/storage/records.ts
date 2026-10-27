/**
 * The records the new storage holds (profiles and surfaces design §4.4,
 * build plan §13 phase 1). Pure types and constructors — no IndexedDB, no
 * `$app` — so the migration and the tests can use them anywhere.
 *
 * ⚓ SHAPED FOR SYNC FROM THE START (§4.4–4.5): every record carries a stable
 * `id`, an `updatedAt`, and a tombstone (`deleted`) instead of disappearing,
 * so optional accounts stay an additive change. ⛔ Never hard-delete a record
 * from a store: a sync would read the absence as "never existed" and bring it
 * back from the other side.
 */

import type { LoadoutEntry } from '$lib/stores';
import type { BoardPreset } from '$lib/boards.svelte';
import { THEORYCRAFT_PICTURE } from '$lib/profilePictures.generated';

export type SyncFields = {
	/** Stable across devices: minted once, never reused. */
	id: string;
	/** Last change, ms — the merge clock a sync would compare. */
	updatedAt: number;
	/** A tombstone: the record is gone, the fact of its going is kept. */
	deleted?: true;
	/** Cleared from the Trash (`trash.ts`): a tombstone holding nothing of
	 *  the work. Only ever beside `deleted`. */
	purged?: true;
};

/** The seven element colours a real profile's frame can wear, plus
 *  Theorycraft's white, which only Theorycraft can (§2.3). ↻ Not exclusive
 *  since 2026-10-26: two profiles may share one (Nate). */
export type ProfileColour =
	| 'pyro'
	| 'hydro'
	| 'anemo'
	| 'electro'
	| 'dendro'
	| 'cryo'
	| 'geo'
	| 'theorycraft';

export type Twin = 'aether' | 'lumine';

/** The tools a profile remembers being in (§4.2). */
export type ToolId = 'planner' | 'builder' | 'visualizers';

export type Roster = {
	constellations: Record<string, number>;
	ownership: Record<string, 'owned' | 'wishlist'>;
	/** ↻ RETIRED into teams (2026-10-24, `teamLoadout.ts`): kept as a field so
	 *  older records and backups still read, and emptied at the next start. */
	loadout: Record<string, LoadoutEntry>;
};

/** ⚓ A profile is shown as a picture (draft 5): one of the art set by its id
 *  (`profilePictures.generated.ts`), or a character's circle avatar. */
export type Picture = { kind: 'art'; name: string } | { kind: 'character'; id: string };

export type ProfileRecord = SyncFields & {
	kind: 'theorycraft' | 'real';
	name: string;
	colour: ProfileColour;
	/** Absent on a record migrated before 2026-10-22: read through `pictureOf`. */
	picture?: Picture;
	/** ⚓ An account fact (§13.5). Theorycraft's is only a default. */
	twin: Twin;
	/** Theorycraft's is always empty: it has no roster to fall back to (§2.2). */
	roster: Roster;
	/**
	 * The profile's current document per tool (§4.2); the Visualizers hold none.
	 * ⚓ `null` is a BLANK opened on purpose (New), kept through reloads and
	 * new sessions (Nate 2026-10-22); absent is "never set", which in
	 * Theorycraft opens the first visit's sample. A blank's pointer moves to
	 * its document once it has content.
	 */
	current: Partial<Record<'planner' | 'builder', string | null>>;
	lastTool?: ToolId;
	createdAt: number;
};

export type RotationBody = {
	notation: string;
	/** ⚓ The party's slots (§8.1), exactly four, `null` empty. */
	slots: (string | null)[];
	/** Per slot: placed on purpose (rests) rather than typed. */
	placed: boolean[];
	loadout?: Record<string, LoadoutEntry>;
	/**
	 * Levels the document stored for itself. In a real profile an owned
	 * character reads the roster (§2.4), so a level here that disagrees is a
	 * what-if waiting for its Theorycraft copy — ⏭ phase 4 creates the pair
	 * (§10); until then it is kept so nothing is lost.
	 */
	con?: Record<string, number>;
	/** The first-visit sample it opened on, credited while still its own. */
	sample?: string;
};

export type LineupTeam = {
	id: string;
	slots: (string | null)[];
	con?: Record<string, number>;
	/** A rotation DOCUMENT id pinned as this team's own. */
	pinnedRotationId?: string;
};

export type LineupBody = {
	preset: BoardPreset;
	season?: string;
	noRepeats: boolean;
	teams: LineupTeam[];
};

type DocumentCommon = SyncFields & {
	profileId: string;
	/** ⚓ An unnamed document stores NO name (§4.2): its label is derived
	 *  from its contents, so it stays right as they change. */
	name: string | null;
	createdAt: number;
	/** Last opened, ms — half the Library's recency key, as before. */
	openedAt?: number;
	/** Heads the Library above Recent (§6.3): a recency list reorders itself
	 *  on every switch, and pinning is the cure. */
	pinned?: true;
	/** Arrived by a shared link (§9.3): the Library marks it, and ⏭ an
	 *  untouched one is pruned from Theorycraft after a while (§4.3). */
	fromLink?: true;
	/**
	 * ⚓ The document it is COMPARED with (§4.6): a pair, stored on both, so
	 * reopening either brings the other back. Only ✕ ends it. A what-if's pair
	 * crosses profiles: the real profile's document and its Theorycraft copy.
	 */
	pairId?: string;
	/**
	 * ⚓ This side is the pair's HOME (2026-10-27, Nate): the rotation the
	 * comparison was started from — the original of a duplicate, the current
	 * one of a Compare with…, the profile's own of a what-if. Home is the left
	 * side, and ✕ ends the pair and returns there from either side. On the home
	 * document only; a pair made before it has none and is ordered as it was.
	 */
	pairHome?: true;
};

export type RotationDocument = DocumentCommon & { type: 'rotation'; body: RotationBody };
export type LineupDocument = DocumentCommon & { type: 'lineup'; body: LineupBody };
export type DocumentRecord = RotationDocument | LineupDocument;

export type TeamRecord = SyncFields & {
	profileId: string;
	name: string;
	/** In party order (§12 Q2). */
	slots: (string | null)[];
	/** ⚓ Each member's weapon and artifact set (Nate 2026-10-24): a team
	 *  decision, inherited live by the team's rotations (`teamLoadout.ts`).
	 *  Absent or empty = none chosen. */
	loadout?: Record<string, LoadoutEntry>;
	createdAt: number;
};

/** ⚓ Theorycraft is built in: one per browser, at a FIXED id, so a link
 *  routed to it on any device lands in the same profile. */
export const THEORYCRAFT_ID = 'theorycraft';

export const emptyRoster = (): Roster => ({ constellations: {}, ownership: {}, loadout: {} });

/** A profile's picture. ⚓ Theorycraft's is RESERVED and cannot be changed
 *  (Nate 2026-10-22), so it is answered here whatever a record holds; a real
 *  profile migrated before pictures existed gets the Traveler. */
export function pictureOf(p: Pick<ProfileRecord, 'kind' | 'picture'>): Picture {
	if (p.kind === 'theorycraft') return { kind: 'art', name: THEORYCRAFT_PICTURE.id };
	return p.picture ?? { kind: 'character', id: 'traveler_anemo' };
}

export function makeTheorycraft(now: number, twin: Twin = 'aether'): ProfileRecord {
	return {
		id: THEORYCRAFT_ID,
		updatedAt: now,
		kind: 'theorycraft',
		name: 'Theorycraft',
		colour: 'theorycraft',
		picture: { kind: 'art', name: THEORYCRAFT_PICTURE.id },
		twin,
		roster: emptyRoster(),
		current: {},
		createdAt: now
	};
}

/** A record id: a v4 UUID, which unlike the 8-character ids the localStorage
 *  stores minted stays unique once records from two devices meet.
 *  ⚠️ `crypto.randomUUID` is missing on iOS 15.0–15.3 and in any insecure
 *  context (a phone on the dev server over LAN `http://`), and an id is
 *  minted at module import, so a throw there takes down hydration site-wide.
 *  `getRandomValues` has neither gap and builds the same shape. */
export const newId = (): string =>
	typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : uuidFromRandomValues();

function uuidFromRandomValues(): string {
	const b = crypto.getRandomValues(new Uint8Array(16));
	b[6] = (b[6] & 0x0f) | 0x40; // version 4
	b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
	const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
