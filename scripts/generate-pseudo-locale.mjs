/**
 * Writes messages/en-XA.json, the pseudo-locale, from messages/en.json
 * (src/lib/i18n/pseudo.ts says what it is for). Run it after changing English:
 * `src/lib/i18n/pseudo.test.ts` fails until you do.
 *
 *   node scripts/generate-pseudo-locale.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import * as prettier from 'prettier';
import { pseudoFile } from '../src/lib/i18n/pseudo.ts';

const OUT = 'messages/en-XA.json';
const en = JSON.parse(readFileSync('messages/en.json', 'utf8'));
// Written as Prettier would leave it: `npm run lint` checks the file, and a
// long padded message wraps differently from JSON.stringify's layout.
const text = JSON.stringify(pseudoFile(en), null, '\t') + '\n';
const options = { ...(await prettier.resolveConfig(OUT)), filepath: OUT };
writeFileSync(OUT, await prettier.format(text, options));
console.log(`messages/en-XA.json: ${Object.keys(en).length - 1} messages`);
