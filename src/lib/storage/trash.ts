/**
 * THE TRASH (notices design §5; ⚓ Nate 2026-10-26). Pure rules over the
 * records; the session reads and writes them.
 *
 * ⚓ A delete was already a TOMBSTONE (records.ts), so the Trash is a reading
 * of the tombstones, not a store of its own: a record is in the Trash while it
 * is deleted, not yet cleared, and younger than `TRASH_DAYS`. Its `updatedAt`
 * is when it was deleted, since nothing writes a tombstone again until it is
 * cleared.
 *
 * ⚓ ONE Trash, outside every profile (like Settings): a deleted profile has
 * nowhere to go in a per-profile trash.
 *
 * ⚓ CLEARING keeps the tombstone (⛔ never a removal, or a sync would bring
 * the record back from the other side) and drops everything in it but the
 * fields a tombstone needs: the work is gone, the fact of its going is kept.
 */

import type { DocumentRecord, ProfileRecord, SyncFields, TeamRecord } from './records';

/** 🎛️ How long the Trash keeps a record (Nate 2026-10-26). */
export const TRASH_DAYS = 30;
export const TRASH_MS = TRASH_DAYS * 24 * 60 * 60 * 1000;

type Tombstone = SyncFields & { purged?: true };

/** In the Trash: deleted, not cleared, and not yet past its days. */
export const inTrash = (r: Tombstone, now: number): boolean =>
	!!r.deleted && !r.purged && now - r.updatedAt < TRASH_MS;

/** Past its days and not yet cleared: due for `cleared`. */
export const expired = (r: Tombstone, now: number): boolean =>
	!!r.deleted && !r.purged && now - r.updatedAt >= TRASH_MS;

/**
 * A record cleared from the Trash: the tombstone's own fields and the profile
 * it belonged to, nothing of the work. ⚠ Typed as its store's record because
 * the store is; every reader checks `deleted` before any other field, which
 * is what makes the stub safe to hold there.
 */
export function cleared<R extends SyncFields & { profileId?: string }>(r: R, now: number): R {
	return {
		id: r.id,
		updatedAt: now,
		deleted: true,
		purged: true,
		...(r.profileId !== undefined && { profileId: r.profileId })
	} as unknown as R;
}

/**
 * What a deleted profile took with it: its records deleted IN THE SAME DELETE,
 * which wrote one timestamp to all of them (`deleteProfile`). A rotation
 * deleted on its own before the profile went keeps its own time, so restoring
 * the profile leaves it in the Trash, where it was.
 */
export function takenWith<R extends SyncFields & { profileId: string }>(
	profile: ProfileRecord,
	records: readonly R[]
): R[] {
	return records.filter(
		(r) => r.profileId === profile.id && r.deleted && r.updatedAt === profile.updatedAt
	);
}

export type TrashEntry =
	| { store: 'documents'; record: DocumentRecord }
	| { store: 'teams'; record: TeamRecord }
	| { store: 'profiles'; record: ProfileRecord };

/**
 * A RUN of the Trash: consecutive entries of one profile, under one heading.
 * `profile` is the live record, or the deleted one when the profile is in the
 * Trash itself (`gone`).
 */
export type TrashRun = {
	profile: ProfileRecord;
	gone: boolean;
	entries: TrashEntry[];
};

/**
 * The Trash, NEWEST FIRST (↻ Nate 2026-10-26: grouped by profile, one busy
 * profile pushed another's fresh deletes out of sight). Entries of one
 * profile that follow each other share a heading, so the profile is still
 * named once per stretch rather than once per row. A deleted profile is an
 * entry itself, ahead of what it took with it (one timestamp, `takenWith`).
 */
export function trashRuns(
	all: { profiles: ProfileRecord[]; documents: DocumentRecord[]; teams: TeamRecord[] },
	now: number
): TrashRun[] {
	const profiles = new Map(all.profiles.map((p) => [p.id, p]));
	const owner = (e: TrashEntry) => (e.store === 'profiles' ? e.record.id : e.record.profileId);
	const entries: TrashEntry[] = [
		...all.profiles
			.filter((r) => inTrash(r, now))
			.map((record) => ({ store: 'profiles' as const, record })),
		...all.documents
			.filter((r) => inTrash(r, now))
			.map((record) => ({ store: 'documents' as const, record })),
		...all.teams
			.filter((r) => inTrash(r, now))
			.map((record) => ({ store: 'teams' as const, record }))
	];
	entries.sort(
		(a, b) =>
			b.record.updatedAt - a.record.updatedAt ||
			Number(b.store === 'profiles') - Number(a.store === 'profiles')
	);
	const runs: TrashRun[] = [];
	for (const e of entries) {
		const p = profiles.get(owner(e));
		if (!p || p.purged) continue;
		const last = runs.at(-1);
		if (last?.profile.id === p.id) last.entries.push(e);
		else runs.push({ profile: p, gone: !!p.deleted, entries: [e] });
	}
	return runs;
}

/** Everything in the Trash, counted as the sidebar shows it. */
export const trashCount = (runs: readonly TrashRun[]): number =>
	runs.reduce((n, r) => n + r.entries.length, 0);
