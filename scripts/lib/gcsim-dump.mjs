/**
 * scripts/lib/gcsim-dump.mjs
 *
 * Builds and runs `scripts/gcsim-dump/main.go` — the Go program that links gcsim as a
 * LIBRARY and reads its exact action-cancel slices and per-ability application
 * schedules. See docs/rounds/gauge-round-L4.md §2.
 *
 * ⚓ Why a shim module rather than a file dropped into the gcsim checkout: the tool is
 * OURS and belongs in our history, but gcsim's `internal/` packages are unreachable
 * from outside its module. Everything the dumper needs is under `pkg/` — `pkg/core`,
 * `pkg/simulation` (whose import.go registers every character), `pkg/testhelper`,
 * `pkg/avatar`, `pkg/enemy` — and a `replace` directive reaches them without copying a
 * line of their source.
 *
 * ⛔ The shim is GENERATED on every run, never committed. Its go.mod is derived from
 * gcsim's own and its go.sum copied verbatim, so a gcsim upgrade cannot leave us
 * building against a stale dependency set. Everything lands in gitignored scratch/.
 *
 * ⚠️ `GOPROXY=off` is deliberate: the module cache is already populated by the L0
 * oracle's `go build`, and a network fetch here would be a silent dependency change in
 * a tool whose whole job is to be a fixed reference.
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GCSIM_REPO, gcsimCommit } from './gcsim.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(REPO_ROOT, 'scripts', 'gcsim-dump', 'main.go');
const BUILD_DIR = join(REPO_ROOT, 'scratch', 'gcsim-dump');
const BIN_PATH = join(BUILD_DIR, 'gcsim-dump');

/** gcsim's go.mod, rewritten as our shim's. The `tool` and `ignore` blocks are theirs
 *  alone and Go rejects a `tool` directive naming a package we do not build. */
function shimGoMod() {
	const src = readFileSync(join(GCSIM_REPO, 'go.mod'), 'utf8');
	const stripBlock = (text, name) => text.replace(new RegExp(`^${name} \\([^)]*\\)\\n`, 'ms'), '');
	let out = src.replace(/^module .*$/m, 'module critcalc/gcsimdump');
	out = stripBlock(out, 'tool');
	out = stripBlock(out, 'ignore');
	return `${out}
require github.com/genshinsim/gcsim v0.0.0

replace github.com/genshinsim/gcsim => ${GCSIM_REPO}
`;
}

/** Materialise + build. Returns the binary path. Fails with something actionable. */
export function ensureDumper({ rebuild = false } = {}) {
	if (!existsSync(GCSIM_REPO)) {
		throw new Error(
			`gcsim checkout not found at ${GCSIM_REPO}.\nClone it, or set GCSIM_REPO=/path/to/gcsim.`
		);
	}
	mkdirSync(BUILD_DIR, { recursive: true });
	writeFileSync(join(BUILD_DIR, 'go.mod'), shimGoMod());
	copyFileSync(join(GCSIM_REPO, 'go.sum'), join(BUILD_DIR, 'go.sum'));
	copyFileSync(SRC, join(BUILD_DIR, 'main.go'));
	if (!rebuild && existsSync(BIN_PATH)) {
		// The source may have changed under us; `go build` is incremental and cheap, so
		// there is no reason to trust a stale binary. Fall through and rebuild anyway.
	}
	try {
		execFileSync('go', ['build', '-o', BIN_PATH, '.'], {
			cwd: BUILD_DIR,
			stdio: 'pipe',
			env: { ...process.env, GOPROXY: 'off', GOWORK: 'off' }
		});
	} catch (err) {
		const detail = err.stderr ? String(err.stderr).trim() : err.message;
		throw new Error(
			`Failed to build the gcsim dumper.\n` +
				`  cd ${BUILD_DIR} && GOPROXY=off go build -o ${BIN_PATH} .\n` +
				`Is Go installed? (brew install go)\n\n${detail}`
		);
	}
	return BIN_PATH;
}

/**
 * Run the dumper.
 *
 * @param {object} opts
 * @param {number} [opts.cons]        constellation level (0 or 6)
 * @param {number} [opts.horizon]     frames to advance after each cast when collecting
 *                                    applications
 * @param {string} [opts.only]        a single gcsim character key
 * @param {boolean} [opts.framesOnly] skip the application pass
 * @param {object} [opts.drivers]     the per-character prerequisite table
 */
export function runDumper(opts = {}) {
	const bin = ensureDumper();
	const payload = JSON.stringify({
		cons: opts.cons ?? 0,
		horizon: opts.horizon ?? 900,
		only: opts.only ?? '',
		framesOnly: opts.framesOnly === true,
		drivers: opts.drivers ?? {}
	});
	const stdout = execFileSync(bin, [payload], {
		encoding: 'utf8',
		maxBuffer: 512 * 1024 * 1024
	});
	return { commit: gcsimCommit(), characters: JSON.parse(stdout) };
}
