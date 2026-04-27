#!/usr/bin/env bash
# Launch one autonomous calibration run for a single character.
# Usage:  scripts/run-calibration.sh <character-id>
# Example: scripts/run-calibration.sh sucrose
#
# Designed for the calibration phase ONLY (runs 1-3). Hardcodes the target
# instead of reading docs/curation/queue.txt — sidesteps cross-run state for
# the unattended manual runs. Once calibration is validated, switch to the
# queue-driven prompt in docs/curation/run-prompt.md.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <character-id>" >&2
  exit 2
fi

TARGET="$1"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/.curation-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$(date +%Y%m%d_%H%M%S)_${TARGET}.log"

cd "$REPO_ROOT"

# Preflight: must be on main, clean tree, gcsim source present.
if [[ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]]; then
  echo "ERROR: not on main. Checkout main and re-run." >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: working tree not clean. Stash or commit first." >&2
  exit 1
fi
if [[ ! -d "/Users/producer/Code/gcsim/internal/characters" ]]; then
  echo "ERROR: gcsim source not found at /Users/producer/Code/gcsim." >&2
  exit 1
fi

# Note: avoid `PROMPT=$(cat <<EOF ... EOF)` — bash 3.2 (macOS default) has a
# parsing bug where apostrophes in the heredoc body break command
# substitution. `read -r -d ''` reads the heredoc directly without $().
IFS= read -r -d '' PROMPT <<PROMPT_EOF || true
You are running an autonomous character curation pass per docs/curation/recipe.md.

TARGET CHARACTER: ${TARGET}

LOCAL-ONLY MODE: This repo has no GitHub remote yet. You will NOT push
and you will NOT create a PR. Drafts live as local branches; the human
reviews and merges manually.

PROCEDURE:
1. Read docs/curation/recipe.md end-to-end before doing anything else.
   Note the recipe's PR-related steps are OVERRIDDEN by this prompt — see
   below.
2. Read docs/curation/queue.md and confirm "${TARGET}" is listed in Tier A.
   If not in Tier A, exit immediately and report which tier it's in.
3. Confirm git is on main and the working tree is clean.
4. Create branch draft/${TARGET} off main and check it out.
5. Draft src/lib/data/characters/${TARGET}.json per the recipe. If the
   character JSON already has frame data populated, exit (idempotency check).
   Stop drafting on any condition in the recipe's "Stop conditions" section.
6. Commit with message: draft(${TARGET}): first-pass curation from gcsim
   (If a stop condition fired mid-draft, use commit message:
    draft(${TARGET}): BLOCKED — needs reviewer attention)
7. STOP. Do NOT push. Do NOT run gh or create a PR. The branch stays local.
8. Output the recipe's output checklist as your final message (filled in
   for what was completed). End with a single summary line:
   Drafted ${TARGET} on branch draft/${TARGET}. Flagged: <count> _curatorNotes.

HARD CONSTRAINTS:
- Tier A only. Tier B/C → exit without drafting.
- One character per run. Do not draft anything else.
- Never merge. Never push (no remote configured). Never force-push.
- Never use --no-verify.
- File scope: only edit src/lib/data/characters/${TARGET}.json.
  Do NOT touch docs/curation/queue.txt — calibration runs leave it alone.
- KQM data is out of scope. Use gcsim only. Do not WebFetch.
- Never invent effects. Skeletons + _curatorNotes flags only.
- If you encounter an unfamiliar mechanic the recipe doesn't cover: stop,
  add a _curatorNotes entry describing what you saw, commit what you have
  with the BLOCKED commit message, then exit.
PROMPT_EOF

echo "Launching calibration run for: $TARGET"
echo "Log: $LOG_FILE"
echo "---"

claude \
  --model claude-sonnet-4-6 \
  --dangerously-skip-permissions \
  -p "$PROMPT" \
  2>&1 | tee "$LOG_FILE"

echo "---"
echo "Run complete. Log: $LOG_FILE"
echo
echo "Review the draft locally:"
echo "  git diff main..draft/$TARGET"
echo "  git log --oneline main..draft/$TARGET"
echo
echo "If satisfied, merge with:"
echo "  git checkout main && git merge --no-ff draft/$TARGET"
echo
echo "If not satisfied, discard with:"
echo "  git checkout main && git branch -D draft/$TARGET"
