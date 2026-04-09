/**
 * strip-constellation-effects.js
 *
 * Removes empty `effects: []` fields from specific ability categories:
 *
 *   - constellations: always informational, effects field removed entirely
 *   - passives:       effects collapsed onto E/Q during curation; empty array is clutter
 *   - normal attacks: never simulated by the tool; effects will always be empty by design
 *
 * Populated effects arrays are never touched — any constellation with authored effects
 * is left as-is so it can be manually collapsed onto E/Q during hand curation.
 *
 * Skills and bursts are intentionally excluded: an empty effects[] there is a useful
 * "not yet curated" marker during the active curation pass.
 *
 * Usage: node scripts/strip-constellation-effects.js
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const charactersDir = join(__dirname, "../src/lib/data/characters");

const STRIP_ABILITY_TYPES = new Set(["passive", "constellation", "normal"]);

function stripEmptyEffects(entries) {
  let removed = 0;
  for (const entry of entries) {
    if (
      STRIP_ABILITY_TYPES.has(entry.abilityType) &&
      Object.prototype.hasOwnProperty.call(entry, "effects") &&
      Array.isArray(entry.effects) &&
      entry.effects.length === 0
    ) {
      delete entry.effects;
      removed++;
    }
  }
  return removed;
}

const files = readdirSync(charactersDir).filter((f) => f.endsWith(".json"));

let totalFiles = 0;
let modifiedFiles = 0;
let totalRemoved = 0;

for (const file of files) {
  const filePath = join(charactersDir, file);
  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);

  let removedInFile = 0;

  if (Array.isArray(data.abilities)) removedInFile += stripEmptyEffects(data.abilities);
  if (Array.isArray(data.passives)) removedInFile += stripEmptyEffects(data.passives);
  if (Array.isArray(data.constellations)) removedInFile += stripEmptyEffects(data.constellations);

  totalFiles++;

  if (removedInFile > 0) {
    writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
    console.log(`${file}: removed ${removedInFile} empty effects field(s)`);
    modifiedFiles++;
    totalRemoved += removedInFile;
  }
}

console.log(
  `\nDone. Checked ${totalFiles} files, modified ${modifiedFiles}, removed ${totalRemoved} empty effects field(s) total.`
);
