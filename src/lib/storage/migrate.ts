/**
 * The copy-only migration (profiles and surfaces design §10, build plan §13).
 *
 * ⚓ ONE PATH FOR LIVE STORAGE AND A BACKUP FILE: the input is `BackupData`,
 * the shape `parseBackup` has already SANITIZED, so a v1/v2 file and the
 * browser's own `localStorage` (read through `buildEnvelope` → `parseBackup`)
 * meet the same rules. ⚓ It only ever COPIES: this module returns records and
 * touches nothing, and the `localStorage` keys it read are left as they are
 * until well after the switch is the default (§13.1).
 *
 * Pure: the clock and the id source are handed in, so a test can pin both.
 */

import type { BackupData } from '$lib/utils/settingsBackup';
import { sampleById } from '$lib/data/plannerSamples';
import { notationHasActions, seatingOfSaved, seatsFromLegacy } from '$lib/utils/notationEdit';
import type { LoadoutEntry } from '$lib/stores';
import type { BoardPreset } from '$lib/boards.svelte';
import {
	makeTheorycraft,
	THEORYCRAFT_ID,
	type DocumentRecord,
	type LineupDocument,
	type LineupTeam,
	type ProfileRecord,
	type RotationBody,
	type RotationDocument,
	type Roster,
	type TeamRecord,
	type Twin
} from './records';

export type MigrationResult = {
	profiles: ProfileRecord[];
	documents: DocumentRecord[];
	teams: TeamRecord[];
	/** The profile the site opens in: the account when the browser held
	 *  anything of the player's, else Theorycraft (§10). */
	activeProfileId: string;
};

export type MigrationOptions = { now: number; newId: () => string };

/** The migrated real profile's name (⚓ Nate 2026-10-22). */
export const MIGRATED_PROFILE_NAME = 'My account';

// ── The stored shapes, as the sanitizers leave them ─────────────────────────

type StoredRotation = {
	id: string;
	label?: string;
	name?: string;
	notation: string;
	slots?: (string | null)[];
	placed?: boolean[];
	manualSlots?: (string | null)[] | null;
	tabLoadout?: Record<string, LoadoutEntry>;
	tabCon?: Record<string, number>;
	savedId?: string;
	sample?: string;
	viewedAt?: number;
	savedAt?: number;
	openedAt?: number;
};

type StoredTeam = {
	id: string;
	slots: (string | null)[];
	con?: Record<string, number>;
	pinnedRotationId?: string;
};

type StoredBoard = {
	id: string;
	label?: string;
	name?: string;
	preset: BoardPreset;
	season?: string;
	noRepeats: boolean;
	teams: StoredTeam[];
	savedId?: string;
	viewedAt?: number;
	savedAt?: number;
	openedAt?: number;
};

type Closed<T> = { tab: T; closedAt: number };

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = <T extends object>(v: unknown): T =>
	v && typeof v === 'object' ? (v as T) : ({} as T);
const nonEmpty = (o: object) => Object.keys(o).length > 0;

/**
 * A label the tools minted rather than the player chose: "Tab 3",
 * "Lineup 2", "Sample: …". ⚓ An unnamed document stores no name (§4.2), so
 * these become `null` and the document shows a label derived from its
 * contents. A saved entry's name was always typed (or accepted) at Save, so
 * it is kept whatever it says.
 */
export function isMintedLabel(label: string): boolean {
	return /^(Tab|Lineup) \d+$/.test(label) || label.startsWith('Sample: ');
}

function rotationBody(r: StoredRotation): RotationBody {
	// seatingOfSaved is the ONE reading of a stored party: stored slots, else
	// a legacy manualSlots placed on purpose, else the notation's derivation —
	// exactly what the planner's own restore (migrateTab + seatingOf) does.
	const seating = seatingOfSaved(r);
	const body: RotationBody = {
		notation: r.notation,
		slots: seating.seats,
		placed: seating.placed
	};
	if (r.tabLoadout && nonEmpty(r.tabLoadout)) body.loadout = r.tabLoadout;
	if (r.tabCon && nonEmpty(r.tabCon)) body.con = r.tabCon;
	if (r.sample) body.sample = r.sample;
	return body;
}

/** Nothing typed and nobody seated: a blank tab, not a document. */
const isEmptyRotation = (b: RotationBody) => b.notation.trim() === '' && b.slots.every((s) => !s);

/** A sample tab still exactly as it opened — nobody's work (§9.1). */
function isUntouchedSample(r: StoredRotation): boolean {
	const sample = sampleById(r.sample);
	return !!sample && r.notation === sample.notation;
}

/** A lineup with no character on any team and a minted label. */
const isEmptyLineup = (b: StoredBoard) =>
	b.teams.every((t) => t.slots.every((s) => !s)) && isMintedLabel(b.label ?? b.name ?? '');

export function migrate(data: BackupData, { now, newId }: MigrationOptions): MigrationResult {
	const settings = obj<{ travelerVariant?: Twin }>(data['critcalc:siteSettings']);
	const twin: Twin = settings.travelerVariant ?? 'aether';

	const roster: Roster = {
		constellations: obj(data['critcalc:constellations']),
		ownership: obj(data['critcalc:ownership']),
		loadout: obj(data['critcalc:loadout'])
	};

	const saved = arr<StoredRotation>(data['critcalc:savedNotations']);
	const savedBoards = arr<StoredBoard>(data['critcalc:savedBoards']);
	const tabState = obj<{ tabs?: StoredRotation[]; activeTabId?: string }>(
		data['critcalc:rotationTabs']
	);
	const boardState = obj<{ boards?: StoredBoard[]; activeBoardId?: string }>(
		data['critcalc:boards']
	);
	// Oldest first, so a later copy of the same document overwrites an earlier.
	const byClosed = <T>(v: unknown) =>
		arr<Closed<T>>(v)
			.slice()
			.sort((a, b) => a.closedAt - b.closedAt);
	const closedTabs = byClosed<StoredRotation>(data['critcalc:recentlyClosedRotations']);
	const closedBoards = byClosed<StoredBoard>(data['critcalc:recentlyClosedBoards']);

	// Documents are minted against a placeholder owner and assigned at the
	// end, once we know whether the browser held an account at all.
	const OWNER = '';
	const docs: DocumentRecord[] = [];
	const teams: TeamRecord[] = [];
	/** Which documents are untouched samples, bound for Theorycraft. */
	const toTheorycraft = new Set<string>();
	/** A saved entry's id → the document it became (the `savedId` merge). */
	const docOfSaved = new Map<string, RotationDocument>();
	const lineupOfSaved = new Map<string, LineupDocument>();

	// ── Rotations: the saved bank, then Recently closed, then the open tabs ──
	// ⚓ A tab linked to a saved entry is ONE document: the tab is the working
	// copy, so its content wins and the saved entry's name is kept. The saved
	// version is still in localStorage (copy-only).

	for (const e of saved) {
		if (!notationHasActions(e.notation)) {
			// A names-only entry is a TEAM (library.isTeamEntry).
			const seats = seatingOfSaved(e).seats;
			if (seats.every((s) => !s)) continue;
			teams.push({
				id: newId(),
				updatedAt: e.savedAt ?? now,
				profileId: OWNER,
				name: e.name ?? '',
				slots: seats,
				createdAt: e.savedAt ?? now
			});
			continue;
		}
		const doc: RotationDocument = {
			id: newId(),
			updatedAt: e.savedAt ?? now,
			profileId: OWNER,
			type: 'rotation',
			name: e.name ?? null,
			createdAt: e.savedAt ?? now,
			body: rotationBody(e)
		};
		if (e.openedAt) doc.openedAt = e.openedAt;
		docs.push(doc);
		docOfSaved.set(e.id, doc);
	}

	/** Tab id → document, for the active tab's `current`. */
	const docOfTab = new Map<string, RotationDocument>();
	const takeTab = (t: StoredRotation, at: number) => {
		const body = rotationBody(t);
		const linked = t.savedId ? docOfSaved.get(t.savedId) : undefined;
		if (linked) {
			linked.body = body;
			linked.updatedAt = Math.max(linked.updatedAt, at);
			if (t.viewedAt) linked.openedAt = Math.max(linked.openedAt ?? 0, t.viewedAt);
			docOfTab.set(t.id, linked);
			return;
		}
		if (isEmptyRotation(body)) return;
		const label = t.label ?? '';
		const doc: RotationDocument = {
			id: newId(),
			updatedAt: at,
			profileId: OWNER,
			type: 'rotation',
			name: label && !isMintedLabel(label) ? label : null,
			createdAt: at,
			body
		};
		if (t.viewedAt) doc.openedAt = t.viewedAt;
		docs.push(doc);
		docOfTab.set(t.id, doc);
		if (isUntouchedSample(t)) toTheorycraft.add(doc.id);
	};
	for (const c of closedTabs) takeTab(c.tab, c.closedAt);
	for (const t of arr<StoredRotation>(tabState.tabs)) takeTab(t, t.viewedAt ?? now);

	// ── Lineups: the same three sources, the same merge ─────────────────────

	const lineupTeams = (teams: StoredTeam[]): LineupTeam[] =>
		teams.map((t) => {
			const out: LineupTeam = { id: t.id, slots: seatsFromLegacy(t.slots) };
			if (t.con && nonEmpty(t.con)) out.con = t.con;
			// The pin named a SAVED rotation; it now names that rotation's
			// document, and a pin to an entry that no longer exists is dropped.
			const pinned = t.pinnedRotationId ? docOfSaved.get(t.pinnedRotationId) : undefined;
			if (pinned) out.pinnedRotationId = pinned.id;
			return out;
		});
	const lineupBody = (b: StoredBoard) => ({
		preset: b.preset,
		...(b.season ? { season: b.season } : {}),
		noRepeats: b.noRepeats,
		teams: lineupTeams(b.teams)
	});

	for (const b of savedBoards) {
		const doc: LineupDocument = {
			id: newId(),
			updatedAt: b.savedAt ?? now,
			profileId: OWNER,
			type: 'lineup',
			name: b.name ?? null,
			createdAt: b.savedAt ?? now,
			body: lineupBody(b)
		};
		if (b.openedAt) doc.openedAt = b.openedAt;
		docs.push(doc);
		lineupOfSaved.set(b.id, doc);
	}

	const docOfBoard = new Map<string, LineupDocument>();
	const takeBoard = (b: StoredBoard, at: number) => {
		const linked = b.savedId ? lineupOfSaved.get(b.savedId) : undefined;
		if (linked) {
			linked.body = lineupBody(b);
			linked.updatedAt = Math.max(linked.updatedAt, at);
			if (b.viewedAt) linked.openedAt = Math.max(linked.openedAt ?? 0, b.viewedAt);
			docOfBoard.set(b.id, linked);
			return;
		}
		if (isEmptyLineup(b)) return;
		const label = b.label ?? '';
		const doc: LineupDocument = {
			id: newId(),
			updatedAt: at,
			profileId: OWNER,
			type: 'lineup',
			name: label && !isMintedLabel(label) ? label : null,
			createdAt: at,
			body: lineupBody(b)
		};
		if (b.viewedAt) doc.openedAt = b.viewedAt;
		docs.push(doc);
		docOfBoard.set(b.id, doc);
	};
	for (const c of closedBoards) takeBoard(c.tab, c.closedAt);
	for (const b of arr<StoredBoard>(boardState.boards)) takeBoard(b, b.viewedAt ?? now);

	// ── Profiles ────────────────────────────────────────────────────────────

	const theorycraft = makeTheorycraft(now, twin);
	const profiles: ProfileRecord[] = [theorycraft];
	const ownWork = docs.some((d) => !toTheorycraft.has(d.id));
	const hasAccount =
		ownWork ||
		teams.length > 0 ||
		nonEmpty(roster.constellations) ||
		nonEmpty(roster.ownership) ||
		nonEmpty(roster.loadout);

	let account: ProfileRecord | undefined;
	if (hasAccount) {
		account = {
			id: newId(),
			updatedAt: now,
			kind: 'real',
			name: MIGRATED_PROFILE_NAME,
			// ⚓ Nate 2026-10-22: the Traveler in the player's twin, Anemo ring.
			colour: 'anemo',
			twin,
			roster,
			current: {},
			createdAt: now
		};
		profiles.push(account);
	}

	const home = (docId: string) =>
		account && !toTheorycraft.has(docId) ? account.id : THEORYCRAFT_ID;
	for (const d of docs) d.profileId = home(d.id);
	for (const t of teams) t.profileId = account?.id ?? THEORYCRAFT_ID;

	// Each tool's ACTIVE tab becomes its current document, in whichever
	// profile that document landed (§10, draft 4).
	const ownerOf = (id: string) => profiles.find((p) => p.id === home(id))!;
	const activeRotation = tabState.activeTabId ? docOfTab.get(tabState.activeTabId) : undefined;
	if (activeRotation) ownerOf(activeRotation.id).current.planner = activeRotation.id;
	const activeLineup = boardState.activeBoardId
		? docOfBoard.get(boardState.activeBoardId)
		: undefined;
	if (activeLineup) ownerOf(activeLineup.id).current.builder = activeLineup.id;

	return {
		profiles,
		documents: docs,
		teams,
		activeProfileId: account?.id ?? THEORYCRAFT_ID
	};
}
