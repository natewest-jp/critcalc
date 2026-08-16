/**
 * scripts/lib/alias-hook.mjs
 *
 * Teaches plain Node how to resolve SvelteKit's `$lib/*` alias, so an audit
 * script can import the real parser instead of a re-implementation of it.
 *
 * Scripts in this directory already import `.ts` modules directly (Node ≥22.18
 * strips types natively — see `audit-capabilities.mjs`), but that only works
 * for modules whose import graph is relative. `notationParser.ts` is not one:
 * it reaches for `$lib/utils/tokenizer`, `$lib/data/weaponLookup` and a dozen
 * more, and Vite is what normally resolves those.
 *
 * Two rules, both matching Vite's behaviour:
 *   - `$lib/x` → `<repo>/src/lib/x`
 *   - an extensionless specifier resolves to `.ts`, then `.js`, then `/index.ts`
 *
 * ⛔ Deliberately NOT a general Vite shim. There is no `$app/*` handling
 * because nothing the parser touches needs it, and a stub that silently
 * resolved `$app/environment` would let a browser-only module load in Node and
 * fail somewhere much less obvious.
 *
 * Usage: `node --import ./scripts/lib/alias-hook.mjs your-script.mjs`
 */

import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '../..');
const LIB_ROOT = resolvePath(REPO_ROOT, 'src/lib');

/** `.ts` first: every aliased module in the parser's graph is TypeScript, and
 *  checking it first avoids picking up a stale generated `.js` sibling. */
const EXTENSIONS = ['.ts', '.js', '.mjs', '/index.ts', '/index.js'];

function resolveWithExtension(absPath) {
	if (existsSync(absPath) && !absPath.endsWith('/')) return absPath;
	for (const ext of EXTENSIONS) {
		const candidate = absPath + ext;
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

const GLOB_SHIM_URL = pathToFileURL(resolvePath(REPO_ROOT, 'scripts/lib/glob-shim.mjs')).href;

/** `import.meta.glob('./x/*.json', { eager: true })` → a call into glob-shim.
 *  Three modules in the parser's graph use it (weaponLookup, artifactLookup,
 *  characterData) and Node has no equivalent primitive. */
const GLOB_CALL = /import\.meta\.glob\(\s*(['"])(.+?)\1\s*(?:,\s*(\{[^}]*\})\s*)?\)/g;

function rewriteGlobs(source) {
	if (!source.includes('import.meta.glob')) return null;
	let touched = false;
	const rewritten = source.replace(GLOB_CALL, (_m, _q, pattern, opts) => {
		touched = true;
		const eager = Boolean(opts && /eager\s*:\s*true/.test(opts));
		const fn = eager ? '__globEager' : '__globLazy';
		return `${fn}(import.meta.url, ${JSON.stringify(pattern)})`;
	});
	if (!touched) return null;
	return `import { __globEager, __globLazy } from ${JSON.stringify(GLOB_SHIM_URL)};\n${rewritten}`;
}

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === '$lib' || specifier.startsWith('$lib/')) {
			const rel = specifier === '$lib' ? '' : specifier.slice('$lib/'.length);
			const resolved = resolveWithExtension(resolvePath(LIB_ROOT, rel));
			if (!resolved) {
				throw new Error(
					`alias-hook: cannot resolve "${specifier}" under ${LIB_ROOT} ` +
						`(tried ${EXTENSIONS.join(', ')})`
				);
			}
			return { url: pathToFileURL(resolved).href, shortCircuit: true };
		}

		// Relative/absolute specifiers inside src/ are extensionless too once the
		// graph is entered through an alias, so they need the same treatment.
		if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
			const parentDir = dirname(fileURLToPath(context.parentURL));
			const resolved = resolveWithExtension(resolvePath(parentDir, specifier));
			if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
		}

		return nextResolve(specifier, context);
	},

	load(url, context, nextLoad) {
		const result = nextLoad(url, context);
		if (!url.startsWith('file:') || !url.includes('/src/lib/')) return result;
		const source = result.source == null ? null : String(result.source);
		if (source == null) return result;
		const rewritten = rewriteGlobs(source);
		return rewritten == null ? result : { ...result, source: rewritten };
	}
});
