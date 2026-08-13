/**
 * src/lib/utils/rotationUrl.ts
 *
 * URL codec for sharing a single rotation-planner tab via a `?r=` query param.
 *
 * Wire format:  "2~" + base64url( deflate-raw( JSON.stringify(payload) ) )
 *
 *   - The leading "2~" is a version/format marker; the decoder dispatches on it
 *     before attempting decompression, and the payload carries a matching `v`.
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

/** The reproducible state of one shared rotation. */
export type SharedRotation = {
	/** Rotation notation text, verbatim — and, since single truth, the team as
	 *  well: the slots are the first four distinct names it holds. */
	notation: string;
	/** charId → constellation level (1–6). Only meaningful team members included. */
	constellations: Record<string, number>;
	/** charId → effective loadout (character default merged with tab override). */
	loadout: Record<string, LoadoutEntry>;
};

const FORMAT = '2';
const MARKER = `${FORMAT}~`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Encode a rotation into the `?r=` value (marker + base64url deflate-raw JSON). */
export async function encodeRotation(r: SharedRotation): Promise<string> {
	const payload = {
		v: 2,
		notation: r.notation,
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
	if (!param || !param.startsWith(MARKER)) return null;
	const body = param.slice(MARKER.length);
	if (!body) return null;
	try {
		const json = await inflateFromBase64Url(body);
		const data = JSON.parse(json);
		if (!isRecord(data) || data.v !== 2 || typeof data.notation !== 'string') return null;
		return {
			notation: data.notation,
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
			const level = Math.min(6, Math.max(0, Math.round(v)));
			if (level > 0) out[id] = level;
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
