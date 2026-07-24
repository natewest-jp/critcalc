/**
 * src/lib/utils/urlCodec.ts
 *
 * Shared low-level codec for URL-embedded state blobs:
 * base64url( deflate-raw( utf-8 text ) ), with the base64url alphabet
 * (`-`/`_`, no `=` padding) chosen so the blob survives `URLSearchParams`
 * decoding untouched — standard base64's `+` is decoded to a space by
 * `application/x-www-form-urlencoded` rules, which would silently corrupt
 * the payload.
 *
 * Consumers (`rotationUrl.ts` `?r=`, `instrumentUrl.ts` `?i=`) own their own
 * format markers, JSON shapes, and sanitizers; this module is only the
 * compression + transport encoding. deflate-raw rides the platform
 * `CompressionStream` (browser + Node ≥ 21) — no dependency.
 */

/** Compress a string and encode it as an unpadded base64url blob. */
export async function deflateToBase64Url(text: string): Promise<string> {
	const compressed = await runStream(
		new TextEncoder().encode(text),
		new CompressionStream('deflate-raw')
	);
	return bytesToBase64Url(compressed);
}

/**
 * Decode an unpadded base64url blob and decompress it back to a string.
 * Throws on malformed input (bad base64, corrupt deflate stream) — callers
 * catch and degrade to null so hostile links become no-ops.
 */
export async function inflateFromBase64Url(body: string): Promise<string> {
	const bytes = base64UrlToBytes(body);
	return new TextDecoder().decode(await runStream(bytes, new DecompressionStream('deflate-raw')));
}

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
