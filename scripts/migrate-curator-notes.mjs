#!/usr/bin/env node
/**
 * One-shot migration: convert `_curatorNotes: "string"` to `_curatorNotes: ["string"]`
 * across all character JSONs. Idempotent — already-array values are untouched.
 *
 * Run from repo root: node scripts/migrate-curator-notes.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const dir = 'src/lib/data/characters';
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

let totalConverted = 0;
let totalFiles = 0;

function walk(node) {
	let converted = 0;
	if (Array.isArray(node)) {
		for (const item of node) converted += walk(item);
	} else if (node && typeof node === 'object') {
		for (const [k, v] of Object.entries(node)) {
			if (k === '_curatorNotes' && typeof v === 'string') {
				node[k] = [v];
				converted += 1;
			} else {
				converted += walk(v);
			}
		}
	}
	return converted;
}

for (const f of files) {
	const path = join(dir, f);
	const raw = readFileSync(path, 'utf8');
	const data = JSON.parse(raw);
	const converted = walk(data);
	if (converted > 0) {
		writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
		console.log(`${f}: ${converted} converted`);
		totalConverted += converted;
		totalFiles += 1;
	}
}

console.log(`\nTotal: ${totalConverted} _curatorNotes converted across ${totalFiles} files`);
