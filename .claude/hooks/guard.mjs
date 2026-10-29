#!/usr/bin/env node
/**
 * PreToolUse guard for Claude Code (registered in `.claude/settings.json`).
 *
 * Refuses a few commands and edits that have each gone wrong in this repo
 * more than once. A refusal exits 2 with the reason on stderr, which Claude
 * Code hands back to the model so it can correct course. Everything else
 * exits 0 silently.
 *
 * Each rule says why it exists. When a rule stops being true, delete it here
 * rather than adding an exception.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/** Drop heredoc bodies and quoted strings, so text that only MENTIONS a
 *  command (a commit message, an echo) can't trip a rule. */
export function commandSkeleton(command) {
	let s = command.replace(/<<-?\s*['"]?(\w+)['"]?[^\n]*\n[\s\S]*?\n\s*\1\s*(\n|$)/g, '\n');
	s = s.replace(/'[^']*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""');
	return s;
}

function e2eRunning() {
	try {
		execSync('pgrep -f "playwright test"', { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

/** @returns {string | null} the refusal, or null to allow. */
export function check(input, { isE2eRunning = e2eRunning, fileExists = existsSync } = {}) {
	const tool = input.tool_name;
	const ti = input.tool_input ?? {};

	if (tool === 'Bash' && typeof ti.command === 'string') {
		const cmd = commandSkeleton(ti.command);

		if (/\bplaywright\s+test\b/.test(cmd) && !/--project[=\s]/.test(cmd))
			return 'Pass --project=chrome or --project=webkit to playwright test: a bare run includes the Firefox project and hangs. (Or use npm run test:e2e:chrome.)';

		if (/(test:e2e|playwright\s+test)/.test(cmd) && /\|\s*(tail|head)\b/.test(cmd))
			return 'Do not pipe e2e output through tail or head: read the whole result. A green run is one "N passed" line, and the exit code covers both engines.';

		if (/\bgit\s+merge\b[^|;&\n]*\s-F\s*-(\s|$)/.test(cmd))
			return '`git merge -F -` does not read stdin. Write the message to a file in scratch/ and pass its path, or use -m.';

		if (
			/(npm\s+run\s+(build|format)\b|\bvite\s+build\b|\bprettier\b[^|;&\n]*--write)/.test(cmd) &&
			isE2eRunning()
		)
			return 'An e2e run is in progress and serves build/. Building or reformatting now rewrites the tree the browsers are loading, and the failures scatter across unrelated specs. Wait for it to finish.';
	}

	if ((tool === 'Write' || tool === 'Edit') && typeof ti.file_path === 'string') {
		const p = ti.file_path;

		if (/\.generated\.ts$/.test(p))
			return 'This file is generated. Change its generator in scripts/ (generate-*.mjs) and re-run it; a hand edit is overwritten on the next predev or prebuild.';

		if (tool === 'Write' && /(^|\/)scripts\/probe-[^/]*\.mjs$/.test(p) && !fileExists(p))
			return 'New scripts/probe-*.mjs files are a retired pattern. Put throwaway checks in scratch/ and delete them the same turn; propose a permanent check as a test instead.';
	}

	return null;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
	let raw = '';
	process.stdin.on('data', (c) => (raw += c));
	process.stdin.on('end', () => {
		let input;
		try {
			input = JSON.parse(raw);
		} catch {
			process.exit(0);
		}
		const refusal = check(input);
		if (refusal) {
			process.stderr.write(`[critcalc guard] ${refusal}\n`);
			process.exit(2);
		}
		process.exit(0);
	});
}
