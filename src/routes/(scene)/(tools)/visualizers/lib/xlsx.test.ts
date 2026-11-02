import { describe, expect, it } from 'vitest';
import { decodeXml, readXlsx, sheetRows, XlsxError } from './xlsx';

/** A ZIP of the given parts, each stored or deflated (the reader doesn't check CRCs). */
async function makeZip(parts: Record<string, string>, deflate = true): Promise<ArrayBuffer> {
	const enc = new TextEncoder();
	const locals: Uint8Array[] = [];
	const centrals: Uint8Array[] = [];
	let offset = 0;
	for (const [name, text] of Object.entries(parts)) {
		const raw = enc.encode(text);
		const data = deflate
			? new Uint8Array(
					await new Response(
						new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))
					).arrayBuffer()
				)
			: raw;
		const nameBytes = enc.encode(name);
		const local = new Uint8Array(30 + nameBytes.length + data.length);
		const lv = new DataView(local.buffer);
		lv.setUint32(0, 0x04034b50, true);
		lv.setUint16(8, deflate ? 8 : 0, true);
		lv.setUint32(18, data.length, true);
		lv.setUint32(22, raw.length, true);
		lv.setUint16(26, nameBytes.length, true);
		local.set(nameBytes, 30);
		local.set(data, 30 + nameBytes.length);
		const central = new Uint8Array(46 + nameBytes.length);
		const cv = new DataView(central.buffer);
		cv.setUint32(0, 0x02014b50, true);
		cv.setUint16(10, deflate ? 8 : 0, true);
		cv.setUint32(20, data.length, true);
		cv.setUint32(24, raw.length, true);
		cv.setUint16(28, nameBytes.length, true);
		cv.setUint32(42, offset, true);
		central.set(nameBytes, 46);
		locals.push(local);
		centrals.push(central);
		offset += local.length;
	}
	const dirSize = centrals.reduce((n, c) => n + c.length, 0);
	const eocd = new Uint8Array(22);
	const ev = new DataView(eocd.buffer);
	ev.setUint32(0, 0x06054b50, true);
	ev.setUint16(8, centrals.length, true);
	ev.setUint16(10, centrals.length, true);
	ev.setUint32(12, dirSize, true);
	ev.setUint32(16, offset, true);
	return new Blob([...locals, ...centrals, eocd] as BlobPart[]).arrayBuffer();
}

/** A workbook with the given sheets, every cell a shared string. */
async function makeWorkbook(sheets: Record<string, string[][]>, deflate = true) {
	const shared: string[] = [];
	const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
	const parts: Record<string, string> = {};
	const names = Object.keys(sheets);
	parts['xl/workbook.xml'] =
		`<workbook><sheets>` +
		names
			.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
			.join('') +
		`</sheets></workbook>`;
	parts['xl/_rels/workbook.xml.rels'] =
		`<Relationships>` +
		names
			.map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`)
			.join('') +
		`</Relationships>`;
	names.forEach((n, i) => {
		const rows = sheets[n]
			.map(
				(row, r) =>
					`<row r="${r + 1}">` +
					row
						.map((cell, c) => {
							shared.push(cell);
							return `<c r="${String.fromCharCode(65 + c)}${r + 1}" t="s"><v>${shared.length - 1}</v></c>`;
						})
						.join('') +
					`</row>`
			)
			.join('');
		parts[`xl/worksheets/sheet${i + 1}.xml`] =
			`<worksheet><sheetData>${rows}</sheetData></worksheet>`;
	});
	parts['xl/sharedStrings.xml'] =
		`<sst>` + shared.map((s) => `<si><t>${esc(s)}</t></si>`).join('') + `</sst>`;
	return makeZip(parts, deflate);
}

describe('readXlsx', () => {
	it('reads every sheet by name, deflated or stored', async () => {
		for (const deflate of [true, false]) {
			const wb = await readXlsx(
				await makeWorkbook({ First: [['a', 'b & c']], 'Second <2>': [['x'], ['y', 'z']] }, deflate)
			);
			expect([...wb.sheets.keys()]).toEqual(['First', 'Second <2>']);
			expect(wb.sheets.get('First')).toEqual([['a', 'b & c']]);
			expect(wb.sheets.get('Second <2>')).toEqual([['x'], ['y', 'z']]);
		}
	});

	it('refuses what isn’t a zip, or a zip that isn’t a workbook', async () => {
		await expect(readXlsx(new TextEncoder().encode('not a spreadsheet').buffer)).rejects.toThrow(
			XlsxError
		);
		await expect(readXlsx(await makeZip({ 'hello.txt': 'hi' }))).rejects.toThrow(XlsxError);
	});
});

describe('sheetRows', () => {
	it('places cells by reference, and reads numbers, inline strings and phonetic-free runs', () => {
		const xml =
			`<sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>42</v></c></row>` +
			`<row r="2"><c r="B2" t="inlineStr"><is><t>in&amp;line</t></is></c></row>` +
			`<row r="3"/></sheetData>`;
		const shared = ['漢字'];
		expect(sheetRows(xml, shared)).toEqual([['漢字', '', '42'], ['', 'in&line'], []]);
	});

	it('decodes numeric entities', () => {
		expect(decodeXml('&#11088; &#x2605; &lt;b&gt;')).toBe('⭐ ★ <b>');
	});
});
