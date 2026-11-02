// A minimal .xlsx reader: enough to read a workbook's sheets as rows of text,
// in the browser and with no dependency. An .xlsx is a ZIP of XML parts; the
// platform's DecompressionStream('deflate-raw') inflates them. Only what a
// spreadsheet export needs: stored and deflated entries, shared and inline
// strings, numbers. No ZIP64, no encryption, no formulas evaluated.

export class XlsxError extends Error {}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

type Entry = { method: number; size: number; offset: number };

/** The ZIP's central directory: entry name → where its data sits. */
function readDirectory(bytes: Uint8Array): Map<string, Entry> {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	// The end-of-central-directory record sits in the last 22 bytes plus up to a 64 KiB comment.
	let eocd = -1;
	for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
		if (view.getUint32(i, true) === EOCD) {
			eocd = i;
			break;
		}
	}
	if (eocd < 0) throw new XlsxError('not a zip');
	const count = view.getUint16(eocd + 10, true);
	let at = view.getUint32(eocd + 16, true);
	const decoder = new TextDecoder();
	const entries = new Map<string, Entry>();
	for (let n = 0; n < count; n++) {
		if (at + 46 > bytes.length || view.getUint32(at, true) !== CENTRAL) {
			throw new XlsxError('bad central directory');
		}
		const method = view.getUint16(at + 10, true);
		const size = view.getUint32(at + 20, true);
		const nameLen = view.getUint16(at + 28, true);
		const extraLen = view.getUint16(at + 30, true);
		const commentLen = view.getUint16(at + 32, true);
		const local = view.getUint32(at + 42, true);
		if (size === 0xffffffff || local === 0xffffffff) throw new XlsxError('zip64 unsupported');
		const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLen));
		if (view.getUint32(local, true) !== LOCAL) throw new XlsxError('bad local header');
		const offset = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
		entries.set(name, { method, size, offset });
		at += 46 + nameLen + extraLen + commentLen;
	}
	return entries;
}

async function inflate(bytes: Uint8Array, entry: Entry): Promise<string> {
	const data = bytes.slice(entry.offset, entry.offset + entry.size);
	if (entry.method === 0) return new TextDecoder().decode(data);
	if (entry.method !== 8) throw new XlsxError(`compression method ${entry.method}`);
	const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
	return new Response(stream).text();
}

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** XML text content: entities decoded. */
export function decodeXml(s: string): string {
	return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
		if (e[0] === '#') {
			const code =
				e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
			return Number.isFinite(code) ? String.fromCodePoint(code) : m;
		}
		return ENTITIES[e] ?? m;
	});
}

/** The visible text of a string item: its `<t>` runs, without phonetic (`<rPh>`) runs. */
function textOf(xml: string): string {
	const visible = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
	let out = '';
	for (const m of visible.matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g))
		out += decodeXml(m[1] ?? '');
	return out;
}

/** A tag's attributes, read past a `>` inside a quoted value. */
const ATTRS = String.raw`((?:[^>"]|"[^"]*")*?)`;

const attr = (attrs: string, name: string) =>
	attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];

/** "AB" → 27 (0-indexed column). */
function columnIndex(ref: string): number {
	let n = 0;
	for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
	return n - 1;
}

/** A sheet's rows as text, in order; a missing cell is ''. */
export function sheetRows(xml: string, shared: string[]): string[][] {
	const rows: string[][] = [];
	for (const r of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
		const row: string[] = [];
		for (const c of (r[1] ?? '').matchAll(
			new RegExp(String.raw`<c\b${ATTRS}(?:\/>|>([\s\S]*?)<\/c>)`, 'g')
		)) {
			const attrs = c[1];
			const body = c[2] ?? '';
			const ref = attr(attrs, 'r');
			const col = ref ? columnIndex(ref) : row.length;
			const type = attr(attrs, 't');
			const v = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
			let text: string;
			if (type === 's') text = shared[Number(v)] ?? '';
			else if (type === 'inlineStr')
				text = textOf(body.match(/<is\b[^>]*>([\s\S]*?)<\/is>/)?.[1] ?? '');
			else text = v === undefined ? '' : decodeXml(v);
			while (row.length < col) row.push('');
			row[col] = text;
		}
		rows.push(row);
	}
	return rows;
}

export type Workbook = { sheets: Map<string, string[][]> };

/** Every sheet of an .xlsx, by name. Throws `XlsxError` for anything that isn't one. */
export async function readXlsx(buffer: ArrayBuffer): Promise<Workbook> {
	const bytes = new Uint8Array(buffer);
	const dir = readDirectory(bytes);
	const part = async (name: string) => {
		const e = dir.get(name);
		return e ? inflate(bytes, e) : undefined;
	};
	const workbook = await part('xl/workbook.xml');
	const rels = await part('xl/_rels/workbook.xml.rels');
	if (!workbook || !rels) throw new XlsxError('not a workbook');

	const sharedXml = await part('xl/sharedStrings.xml');
	const shared = sharedXml
		? [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
		: [];

	const targets = new Map<string, string>();
	for (const m of rels.matchAll(new RegExp(String.raw`<Relationship\b${ATTRS}\/?>`, 'g'))) {
		const id = attr(m[1], 'Id');
		const target = attr(m[1], 'Target');
		if (id && target) targets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`);
	}

	const sheets = new Map<string, string[][]>();
	for (const m of workbook.matchAll(new RegExp(String.raw`<sheet\b${ATTRS}\/?>`, 'g'))) {
		const name = attr(m[1], 'name');
		const id = attr(m[1], 'r:id');
		const path = id ? targets.get(id) : undefined;
		if (!name || !path) continue;
		const xml = await part(path);
		if (xml) sheets.set(decodeXml(name), sheetRows(xml, shared));
	}
	return { sheets };
}
