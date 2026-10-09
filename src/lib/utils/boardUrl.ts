/**
 * src/lib/utils/boardUrl.ts
 *
 * URL codec for sharing a Team Builder BOARD (a lineup of teams) via a `?b=`
 * query param — the lineups design §2.2 + §9.4, in the shape of `?r=`.
 *
 * Wire format:  "1~" + base64url( deflate-raw( JSON.stringify(payload) ) )
 *
 * ⚓ A SHARE CARRIES TEAMS, NOT ROTATIONS (§9.4): each team's four slots and
 * its constellations, ⛔ never its link — a link names a tab in the SENDER's
 * browser. Teams arrive free-standing. Embedding the linked rotations is
 * deferred; adding it is a FORMAT bump, which the marker exists for.
 *
 * ⚓ Every member's constellation travels, an explicit 0 included (§9.5): a
 * shared board never falls back to the recipient's roster, so the sender's C0
 * must arrive as C0.
 *
 * ⚓ DECODER RETENTION RULE (rotationUrl.ts): every wire format we ship stays
 * decodable forever. Bump FORMAT, add a decoder, keep the old one.
 *
 * Pure data-in / data-out. Validating ids against the roster is the
 * importer's job; this only guarantees the SHAPE.
 */

import { deflateToBase64Url, inflateFromBase64Url } from './urlCodec';

const TEAM_SIZE = 4;
/** Safety bounds for a decoded link — a hostile `?b=` must not build a board
 *  the UI cannot hold. Mirrors `BOARD_TEAM_LIMIT` (kept literal here so the
 *  codec stays free of the runes module). */
const MAX_TEAMS = 12;
const MAX_LABEL = 80;
const MAX_ID = 64;

/** One team as it travels. */
export type SharedTeam = {
	slots: (string | null)[];
	/** charId → 0–6, every member. */
	constellations: Record<string, number>;
};

/** The reproducible state of one shared board. */
export type SharedBoard = {
	label: string;
	noRepeats: boolean;
	/** What the board was made as, and a Stygian lineup's season (§2.6). Both
	 *  OPTIONAL and additive — a link made before them decodes as Custom. */
	preset?: 'stygian' | 'abyss' | 'custom';
	season?: string;
	teams: SharedTeam[];
};

const PRESETS = ['stygian', 'abyss', 'custom'];
const FORMAT = '1';
const MARKER = `${FORMAT}~`;

export async function encodeBoard(b: SharedBoard): Promise<string> {
	const payload = {
		v: 1,
		label: b.label,
		noRepeats: b.noRepeats,
		...(b.preset && { preset: b.preset }),
		...(b.season && { season: b.season }),
		teams: b.teams.map((t) => ({ slots: t.slots, con: t.constellations }))
	};
	return MARKER + (await deflateToBase64Url(JSON.stringify(payload)));
}

/** Decode a `?b=` value. Null for anything malformed, so a mangled or hostile
 *  link degrades to the importer's "invalid link" notice rather than a throw. */
export async function decodeBoard(param: string | null | undefined): Promise<SharedBoard | null> {
	if (!param || !param.startsWith(MARKER)) return null;
	const body = param.slice(MARKER.length);
	if (!body) return null;
	try {
		const data = JSON.parse(await inflateFromBase64Url(body));
		if (!isRecord(data) || data.v !== 1 || !Array.isArray(data.teams)) return null;
		// Reject rather than truncate: a lineup missing teams is a DIFFERENT
		// lineup than the sender meant.
		if (data.teams.length === 0 || data.teams.length > MAX_TEAMS) return null;
		return {
			label:
				typeof data.label === 'string' && data.label.trim()
					? data.label.trim().slice(0, MAX_LABEL)
					: 'Shared board',
			noRepeats: data.noRepeats !== false,
			...(PRESETS.includes(data.preset as string) && {
				preset: data.preset as SharedBoard['preset']
			}),
			...(typeof data.season === 'string' &&
				/^\d+\.\d+$/.test(data.season) && { season: data.season }),
			teams: data.teams.map((t: unknown) => sanitizeTeam(t))
		};
	} catch {
		return null;
	}
}

function sanitizeTeam(raw: unknown): SharedTeam {
	const team = isRecord(raw) ? raw : {};
	const rawSlots = Array.isArray(team.slots) ? team.slots : [];
	const slots: (string | null)[] = [];
	for (let i = 0; i < TEAM_SIZE; i++) {
		const id = rawSlots[i];
		slots.push(typeof id === 'string' && id && id.length <= MAX_ID ? id : null);
	}
	const constellations: Record<string, number> = {};
	if (isRecord(team.con)) {
		for (const [id, v] of Object.entries(team.con)) {
			if (!slots.includes(id)) continue; // only members travel
			if (typeof v === 'number' && Number.isFinite(v)) {
				constellations[id] = Math.min(6, Math.max(0, Math.round(v)));
			}
		}
	}
	return { slots, constellations };
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}
