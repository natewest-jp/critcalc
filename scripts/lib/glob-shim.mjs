/**
 * scripts/lib/glob-shim.mjs
 *
 * Runtime half of the `import.meta.glob` shim used by `alias-hook.mjs`.
 *
 * Three modules in the parser's import graph use Vite's `import.meta.glob` to
 * pull in a directory of JSON (`weaponLookup`, `artifactLookup`,
 * `characterData`). Node has no such primitive, so the hook rewrites the call
 * and these two helpers stand in for it.
 *
 * Matches Vite's contract for the cases we actually use:
 *   - keys are the glob-relative specifier as written (`./weapons/foo.json`)
 *   - a JSON module's payload is `{ default: <parsed> }`
 *   - eager → the module object; lazy → a `() => Promise<module>` thunk
 *
 * ⚠️ Only a single `*` in the FINAL path segment is supported — that is every
 * pattern in the repo, and a fuller matcher would be untested surface.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

function listMatches(parentUrl, pattern) {
	const parentDir = dirname(fileURLToPath(parentUrl));
	const lastSlash = pattern.lastIndexOf('/');
	const dirPart = pattern.slice(0, lastSlash);
	const filePart = pattern.slice(lastSlash + 1);

	if (filePart.includes('**')) {
		throw new Error(`glob-shim: recursive patterns are unsupported (${pattern})`);
	}
	const star = filePart.indexOf('*');
	if (star === -1) throw new Error(`glob-shim: pattern has no wildcard (${pattern})`);
	const prefix = filePart.slice(0, star);
	const suffix = filePart.slice(star + 1);

	const absDir = resolvePath(parentDir, dirPart);
	return readdirSync(absDir)
		.filter(
			(name) =>
				name.startsWith(prefix) &&
				name.endsWith(suffix) &&
				name.length >= prefix.length + suffix.length
		)
		.sort()
		.map((name) => ({ key: `${dirPart}/${name}`, abs: resolvePath(absDir, name) }));
}

function loadModule(abs) {
	if (abs.endsWith('.json')) return { default: JSON.parse(readFileSync(abs, 'utf8')) };
	throw new Error(`glob-shim: only JSON globs are supported (${abs})`);
}

export function __globEager(parentUrl, pattern) {
	const out = {};
	for (const { key, abs } of listMatches(parentUrl, pattern)) out[key] = loadModule(abs);
	return out;
}

export function __globLazy(parentUrl, pattern) {
	const out = {};
	for (const { key, abs } of listMatches(parentUrl, pattern)) {
		out[key] = async () => loadModule(abs);
	}
	return out;
}
