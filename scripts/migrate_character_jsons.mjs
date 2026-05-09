#!/usr/bin/env node
/**
 * Mechanical migration of character JSONs to the new ability-type schema.
 *
 *   note              → description
 *   _todo (string)    → _curatorNotes (string[])
 *   type              → dropped on normal/passive/constellation; renamed to
 *                       behavior on skill/burst (top-level and inside variants)
 *   input: "X"        → input: ["X"]
 *   permanentBonuses  → effects merged into the matching passive by name;
 *                       attribution stripped from merged effects;
 *                       permanentBonuses field removed
 *
 * Constellation/passive effect relocation (effects living on a host ability
 * with attribution: "C1: ...") is NOT touched here — handled by hand for the
 * curated characters where it matters.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHAR_DIR = join(__dirname, '..', 'src', 'lib', 'data', 'characters');

function migrateAbility(ab) {
	const out = { ...ab };

	if (typeof out.note === 'string') {
		out.description = out.note;
		delete out.note;
	}

	if (typeof out._todo === 'string') {
		out._curatorNotes = [out._todo];
		delete out._todo;
	} else if (Array.isArray(out._todo)) {
		out._curatorNotes = out._todo;
		delete out._todo;
	}

	if (typeof out.input === 'string') {
		out.input = [out.input];
	}

	if (out.abilityType === 'skill' || out.abilityType === 'burst') {
		if ('type' in out) {
			out.behavior = out.type;
			delete out.type;
		}
	} else if (
		out.abilityType === 'normal' ||
		out.abilityType === 'passive' ||
		out.abilityType === 'constellation' ||
		// legacy abilityType values being pruned
		out.abilityType === 'charged' ||
		out.abilityType === 'plunge'
	) {
		delete out.type;
	}

	if (Array.isArray(out.variants)) {
		out.variants = out.variants.map(migrateVariant);
	}

	return out;
}

function migrateVariant(v) {
	const out = { ...v };
	if (typeof out.input === 'string') out.input = [out.input];
	if ('type' in out) {
		out.behavior = out.type;
		delete out.type;
	}
	return out;
}

function mergePermanentBonusesIntoPassives(char) {
	if (!Array.isArray(char.permanentBonuses) || char.permanentBonuses.length === 0) {
		delete char.permanentBonuses;
		return;
	}
	if (!Array.isArray(char.passives)) char.passives = [];

	for (const bonus of char.permanentBonuses) {
		const target = char.passives.find((p) => p.name === bonus.name);
		const bonusEffects = (bonus.effects ?? []).map((fx) => {
			const { attribution: _, ...rest } = fx;
			return rest;
		});
		if (target) {
			const existing = target.effects ?? [];
			target.effects = [...existing, ...bonusEffects];
		} else {
			// No matching passive: append the bonus as a new passive entry,
			// stripped of permanent-bonus framing.
			char.passives.push({
				...bonus,
				abilityType: 'passive',
				effects: bonusEffects
			});
		}
	}
	delete char.permanentBonuses;
}

function migrateCharacter(char) {
	mergePermanentBonusesIntoPassives(char);

	if (Array.isArray(char.abilities)) char.abilities = char.abilities.map(migrateAbility);
	if (Array.isArray(char.passives)) char.passives = char.passives.map(migrateAbility);
	if (Array.isArray(char.constellations))
		char.constellations = char.constellations.map(migrateAbility);

	return char;
}

const files = readdirSync(CHAR_DIR).filter((f) => f.endsWith('.json'));
let touched = 0;
for (const file of files) {
	const path = join(CHAR_DIR, file);
	const original = readFileSync(path, 'utf8');
	const data = JSON.parse(original);
	migrateCharacter(data);
	const next = JSON.stringify(data, null, 2) + '\n';
	if (next !== original) {
		writeFileSync(path, next);
		touched++;
	}
}
console.log(`Migrated ${touched} of ${files.length} character JSONs.`);
