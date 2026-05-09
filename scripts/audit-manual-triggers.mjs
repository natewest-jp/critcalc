#!/usr/bin/env node
// One-shot audit: list every effect with `trigger.type === "manual"` plus
// the nearest curator notes from the parent ability/passive/constellation,
// keyed by character. Used as the F1 work plan source.
//
// Usage: node scripts/audit-manual-triggers.mjs

import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('src/lib/data/characters');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();

function summarizeEffect(eff) {
	const parts = [`type=${eff.type}`];
	if (eff.stat) parts.push(`stat=${eff.stat}`);
	if (eff.target) parts.push(`target=${JSON.stringify(eff.target)}`);
	if (eff.duration != null) parts.push(`dur=${eff.duration}`);
	if (eff.element) parts.push(`el=${eff.element}`);
	if (eff.scaling) parts.push(`scaling=${eff.scaling}`);
	if (eff.value != null) {
		const v = typeof eff.value === 'object' ? JSON.stringify(eff.value).slice(0, 50) : eff.value;
		parts.push(`value=${v}`);
	}
	return parts.join(' ');
}

function findManualTriggers(node, hostNotes, hostName, results) {
	if (Array.isArray(node)) {
		for (const item of node) findManualTriggers(item, hostNotes, hostName, results);
		return;
	}
	if (!node || typeof node !== 'object') return;

	// If this node has its own _curatorNotes + name + abilityType, it's a host node.
	const isHost = node.abilityType !== undefined || node.id !== undefined;
	const nextNotes = isHost ? (node._curatorNotes ?? null) : hostNotes;
	const nextName = isHost ? (node.name ?? node.id ?? hostName) : hostName;

	if (node.trigger?.type === 'manual') {
		results.push({
			host: nextName,
			summary: summarizeEffect(node),
			notes: nextNotes,
		});
	}

	for (const v of Object.values(node)) {
		findManualTriggers(v, nextNotes, nextName, results);
	}
}

let totalCount = 0;
for (const f of files) {
	const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
	const results = [];
	findManualTriggers(data, null, null, results);
	if (!results.length) continue;
	totalCount += results.length;
	console.log(`\n========== ${f} (${results.length}) ==========`);
	for (const r of results) {
		console.log(`\n  HOST: ${r.host}`);
		console.log(`  EFF:  ${r.summary}`);
		if (r.notes) {
			for (const n of r.notes) {
				const oneLine = String(n).replace(/\s+/g, ' ').slice(0, 240);
				console.log(`  NOTE: ${oneLine}`);
			}
		}
	}
}
console.log(`\n=== TOTAL: ${totalCount} manual-trigger effects across ${files.length} files ===`);
