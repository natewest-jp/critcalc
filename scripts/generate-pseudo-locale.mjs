/**
 * Writes messages/en-XA.json, the pseudo-locale, from messages/en.json
 * (src/lib/i18n/pseudo.ts says what it is for). Run it after changing English:
 * `src/lib/i18n/pseudo.test.ts` fails until you do.
 *
 *   node scripts/generate-pseudo-locale.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pseudoFile } from '../src/lib/i18n/pseudo.ts';

const en = JSON.parse(readFileSync('messages/en.json', 'utf8'));
writeFileSync('messages/en-XA.json', JSON.stringify(pseudoFile(en), null, '\t') + '\n');
console.log(`messages/en-XA.json: ${Object.keys(en).length - 1} messages`);
