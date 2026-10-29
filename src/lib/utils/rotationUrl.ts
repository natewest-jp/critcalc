/**
 * src/lib/utils/rotationUrl.ts
 *
 * URL codec for sharing a single rotation-planner tab via a `?r=` query param.
 *
 * Wire format:  "3~" + base64url( deflate-raw( JSON.stringify(payload) ) )
 *
 *   - The leading "3~" is a version/format marker; the decoder dispatches on it
 *     before attempting decompression, and the payload carries a matching `v`.
 *     Format 3 adds the party's `slots` and `placed` (Planner slots); format 2
 *     links still decode, under the retention rule below.
 *
 *     ⚓ BUMPED TO 2 (2026-08-13, single truth): the `team` field is GONE. The
 *     notation is the team now, so an explicit slot list is not a compatible
 *     addition to drop — a v1 link's team is exactly the state the round
 *     retired. There is deliberately NO v1 decoder: ⚓ Nate confirmed nobody
 *     else has used the site and he has saved no share URLs, so a v1 link
 *     decodes to null and surfaces through the planner's existing
 *     "Invalid share link" notice. ⛔ Do not "add" a version marker here — it
 *     has had two since it was written; use them.
 *   - base64url alphabet (`-`/`_`, no `=` padding) is used deliberately so the
 *     blob survives `URLSearchParams` decoding untouched. Standard base64's `+`
 *     is decoded to a space by `application/x-www-form-urlencoded` rules, which
 *     would silently corrupt the payload.
 *   - deflate-raw (via the platform `CompressionStream`) keeps URLs short: the
 *     notation text and repeated JSON keys compress hard. No dependency added.
 *
 * This module is pure data-in / data-out. The planner page owns reading the
 * stores to build a {@link SharedRotation} and applying a decoded one.
 */

import type { LoadoutEntry } from '$lib/stores';
import { deflateToBase64Url, inflateFromBase64Url } from './urlCodec';
import { MAX_NOTATION_CHARS } from './tokenizer';

/** The reproducible state of one shared rotation. */
export type SharedRotation = {
	/** Rotation notation text, verbatim. */
	notation: string;
	/** ⚓ The party's slots (§8.1, format 3): ids by key 1–4, `null` empty.
	 *  Absent on a v2 link, whose team is derived from the notation as it was
	 *  when the link was made (the first four names, in order). */
	slots?: (string | null)[];
	/** Per slot, placed on purpose (rests when the notation does not name it)
	 *  rather than typed (empties) — §8.1. Absent = all typed. */
	placed?: boolean[];
	/** charId → constellation level (0–6) for every team member. ↻ 2026-10-08:
	 *  an explicit 0 travels too — older links omit it, and a missing member
	 *  then falls back to the recipient's roster as it always did. */
	constellations: Record<string, number>;
	/** charId → effective loadout (character default merged with tab override). */
	loadout: Record<string, LoadoutEntry>;
};

const FORMAT = '3';
const MARKER = `${FORMAT}~`;
/** ⚓ Retained forever (the rule below): links made before slots existed. */
const MARKER_V2 = '2~';

/**
 * ⚓ DECODER RETENTION RULE (2026-08-16, public launch).
 *
 * Before launch this codec could drop old formats freely — the v1 decoder was
 * removed outright because nobody outside this repo had ever made a link. That
 * reasoning EXPIRED the moment the site was shared.
 *
 * From launch on: **every wire format we have ever shipped must stay decodable,
 * forever.** A `?r=` link pasted into a Reddit comment or a Discord pin outlives
 * several redesigns of this file, and there is no server to migrate it. Bumping
 * FORMAT is fine; deleting the branch that reads the old one is not.
 *
 * So: when you bump, ADD a decoder, keep the old one, and make `decodeRotation`
 * dispatch on the marker. The same rule binds `instrumentUrl.ts` (`?i=`).
 */

// The notation length cap is shared with the editor so the two entry points
// cannot drift — see tokenizer.ts for why it exists and how 16 KiB was chosen.

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Encode a rotation into the `?r=` value (marker + base64url deflate-raw JSON). */
export async function encodeRotation(r: SharedRotation): Promise<string> {
	const payload = {
		v: 3,
		notation: r.notation,
		...(r.slots ? { slots: r.slots } : {}),
		...(r.placed ? { placed: r.placed } : {}),
		constellations: r.constellations,
		loadout: r.loadout
	};
	const json = JSON.stringify(payload);
	return MARKER + (await deflateToBase64Url(json));
}

/**
 * Decode a `?r=` value back into a {@link SharedRotation}. Returns `null` for
 * anything malformed — wrong marker, bad base64, corrupt deflate stream,
 * non-JSON, wrong shape — so a hand-mangled or hostile link degrades to a
 * no-op rather than throwing. Output is field-sanitized.
 */
export async function decodeRotation(
	param: string | null | undefined
): Promise<SharedRotation | null> {
	if (!param) return null;
	// One body shape for both formats; v3 only adds `slots`.
	const version = param.startsWith(MARKER) ? 3 : param.startsWith(MARKER_V2) ? 2 : null;
	if (!version) return null;
	const body = param.slice(2);
	if (!body) return null;
	try {
		const json = await inflateFromBase64Url(body);
		const data = JSON.parse(json);
		if (!isRecord(data) || data.v !== version || typeof data.notation !== 'string') return null;
		// Reject rather than truncate: a truncated rotation is a DIFFERENT rotation
		// than the sender meant, applied silently. Returning null surfaces through
		// the planner's existing "Invalid share link" notice, which is honest.
		if (data.notation.length > MAX_NOTATION_CHARS) return null;
		const slots = version === 3 ? sanitizeSlots(data.slots) : undefined;
		const placed =
			slots && Array.isArray(data.placed)
				? data.placed.slice(0, 4).map((x: unknown) => x === true)
				: undefined;
		return {
			notation: data.notation,
			...(slots ? { slots } : {}),
			...(placed ? { placed } : {}),
			constellations: isRecord(data.constellations) ? sanitizeCons(data.constellations) : {},
			loadout: isRecord(data.loadout) ? sanitizeLoadout(data.loadout) : {}
		};
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Sanitizers — never trust a decoded link's shape
// ---------------------------------------------------------------------------

function sanitizeCons(raw: Record<string, unknown>): Record<string, number> {
	const out: Record<string, number> = {};
	for (const [id, v] of Object.entries(raw)) {
		if (typeof v === 'number' && Number.isFinite(v)) {
			out[id] = Math.min(6, Math.max(0, Math.round(v)));
		}
	}
	return out;
}

function sanitizeLoadout(raw: Record<string, unknown>): Record<string, LoadoutEntry> {
	const out: Record<string, LoadoutEntry> = {};
	for (const [id, v] of Object.entries(raw)) {
		if (!isRecord(v)) continue;
		const entry: LoadoutEntry = {};
		if (typeof v.weaponId === 'string') entry.weaponId = v.weaponId;
		if (typeof v.artifactSetId === 'string') entry.artifactSetId = v.artifactSetId;
		if (typeof v.weaponRefinement === 'number') {
			const r = Math.round(v.weaponRefinement);
			if (r >= 1 && r <= 5) entry.weaponRefinement = r as 1 | 2 | 3 | 4 | 5;
		}
		if (entry.weaponId || entry.artifactSetId || entry.weaponRefinement) out[id] = entry;
	}
	return out;
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Four entries at most, each an id-shaped string or null. Whether an id is a
 *  CHARACTER is the receiving store's call (`normalizeSeats`). */
function sanitizeSlots(raw: unknown): (string | null)[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	return raw
		.slice(0, 4)
		.map((id) => (typeof id === 'string' && /^[a-z0-9_]{1,40}$/.test(id) ? id : null));
}
