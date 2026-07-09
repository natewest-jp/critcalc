/**
 * src/lib/utils/rotationUrl.ts
 *
 * URL codec for sharing a single rotation-planner tab via a `?r=` query param.
 *
 * Wire format:  "1~" + base64url( deflate-raw( JSON.stringify(payload) ) )
 *
 *   - The leading "1~" is a version/format marker. If the encoding ever changes
 *     (different compression, added fields that need a migration), bump it — old
 *     links keep resolving because the decoder dispatches on the marker.
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

/** The reproducible state of one shared rotation. */
export type SharedRotation = {
	/** Rotation notation text, verbatim. */
	notation: string;
	/** Explicit team/slot order (charIds), or `null` if the team was inferred. */
	team: string[] | null;
	/** charId → constellation level (1–6). Only meaningful team members included. */
	constellations: Record<string, number>;
	/** charId → effective loadout (character default merged with tab override). */
	loadout: Record<string, LoadoutEntry>;
};

const FORMAT = '1';
const MARKER = `${FORMAT}~`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Encode a rotation into the `?r=` value (marker + base64url deflate-raw JSON). */
export async function encodeRotation(r: SharedRotation): Promise<string> {
	const payload = {
		v: 1,
		notation: r.notation,
		team: r.team,
		constellations: r.constellations,
		loadout: r.loadout
	};
	const json = JSON.stringify(payload);
	const compressed = await runStream(
		new TextEncoder().encode(json),
		new CompressionStream('deflate-raw')
	);
	return MARKER + bytesToBase64Url(compressed);
}

/**
 * Decode a `?r=` value back into a {@link SharedRotation}. Returns `null` for
 * anything malformed — wrong marker, bad base64, corrupt deflate stream,
 * non-JSON, wrong shape — so a hand-mangled or hostile link degrades to a
 * no-op rather than throwing. Output is field-sanitized.
 */
export async function decodeRotation(param: string | null | undefined): Promise<SharedRotation | null> {
	if (!param || !param.startsWith(MARKER)) return null;
	const body = param.slice(MARKER.length);
	if (!body) return null;
	try {
		const bytes = base64UrlToBytes(body);
		const json = new TextDecoder().decode(
			await runStream(bytes, new DecompressionStream('deflate-raw'))
		);
		const data = JSON.parse(json);
		if (!isRecord(data) || data.v !== 1 || typeof data.notation !== 'string') return null;
		return {
			notation: data.notation,
			team: Array.isArray(data.team) ? data.team.filter((x): x is string => typeof x === 'string') : null,
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

// ---------------------------------------------------------------------------
// deflate-raw via the platform CompressionStream (browser + Node ≥ 21)
// ---------------------------------------------------------------------------

async function runStream(
	data: Uint8Array,
	stream: CompressionStream | DecompressionStream
): Promise<Uint8Array> {
	const writer = stream.writable.getWriter();
	// Kick writing off; swallow the write-side rejection so it can't surface as
	// an unhandled rejection — the real error is reported by the read side below.
	// Cast: lib.dom types the chunk as an ArrayBuffer-backed BufferSource, while
	// TextEncoder/new Uint8Array widen to Uint8Array<ArrayBufferLike>.
	const written = writer
		.write(data as BufferSource)
		.then(() => writer.close())
		.catch(() => {});
	const buf = await new Response(stream.readable).arrayBuffer();
	await written;
	return new Uint8Array(buf);
}

// ---------------------------------------------------------------------------
// base64url (`-`/`_`, unpadded) — URLSearchParams-safe
// ---------------------------------------------------------------------------

function bytesToBase64Url(bytes: Uint8Array): string {
	let bin = '';
	const CHUNK = 0x8000; // avoid arg-count limits on String.fromCharCode
	for (let i = 0; i < bytes.length; i += CHUNK) {
		bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
	let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
	const pad = b64.length % 4;
	if (pad) b64 += '='.repeat(4 - pad); // re-pad for engines that require it
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}
