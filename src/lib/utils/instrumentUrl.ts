/**
 * src/lib/utils/instrumentUrl.ts
 *
 * URL codec for sharing a Visualizers instrument via a `?i=` query param.
 *
 * Wire format, two tiers:
 *   "?i=<id>"                      — bare, human-typeable: select an instrument
 *   "?i=<id>.1~<base64url blob>"   — plus that instrument's shared state
 *
 * The `.` separator is outside the base64url alphabet and outside instrument
 * ids, so splitting on the FIRST `.` is unambiguous. The `1~` version marker
 * follows the `?r=` convention (rotationUrl.ts): bump it if the encoding ever
 * changes, and old links keep resolving because the decoder dispatches on it.
 *
 * This module is pure data-in / data-out and registry-agnostic: it does not
 * validate the instrument id (the workspace owns the live roster) and treats
 * `state` as an opaque JSON value — each instrument sanitizes its own state
 * shape inside `applyShareState`.
 */

import { deflateToBase64Url, inflateFromBase64Url } from './urlCodec';

const FORMAT = '1';
const MARKER = `${FORMAT}~`;

/** id must be url-plain: lowercase alnum, no separators the format uses */
const ID_RE = /^[a-z0-9]+$/;

export type DecodedInstrumentParam = {
	id: string;
	/** Opaque state payload, `null` when the link was a bare id (or corrupt blob) */
	state: unknown | null;
};

/** Encode a `?i=` value. Omitting `state` yields the bare human-typeable id. */
export async function encodeInstrumentParam(id: string, state?: unknown): Promise<string> {
	if (!ID_RE.test(id)) throw new Error(`instrument id not url-plain: ${id}`);
	if (state === undefined) return id;
	const blob = await deflateToBase64Url(JSON.stringify(state));
	return `${id}.${MARKER}${blob}`;
}

/**
 * Decode a `?i=` value. Returns `null` when the whole param is malformed;
 * returns `{ id, state: null }` when the id parses but the state blob is
 * corrupt — a mangled link still selects its instrument.
 */
export async function decodeInstrumentParam(
	param: string | null | undefined
): Promise<DecodedInstrumentParam | null> {
	if (!param) return null;
	const dot = param.indexOf('.');
	const id = dot === -1 ? param : param.slice(0, dot);
	if (!ID_RE.test(id)) return null;
	if (dot === -1) return { id, state: null };

	const rest = param.slice(dot + 1);
	if (!rest.startsWith(MARKER)) return { id, state: null };
	try {
		const json = await inflateFromBase64Url(rest.slice(MARKER.length));
		return { id, state: JSON.parse(json) };
	} catch {
		return { id, state: null };
	}
}
