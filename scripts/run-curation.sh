#!/usr/bin/env bash
# Run autonomous character-curation passes back-to-back in one session.
#
# Modes:
#   scripts/run-curation.sh                          # default: pick next 3 from queue
#   scripts/run-curation.sh --count 4                # next 4 from queue
#   scripts/run-curation.sh sucrose                  # explicit single target
#   scripts/run-curation.sh sucrose mona             # explicit multi-target
#
# The script self-wraps in `caffeinate -dimsu` so the keep-awake is bound to
# this process — caffeinate exits automatically when the script exits, on any
# path (success, failure, or Ctrl-C). No manual cleanup needed.
#
# Each character gets:
#   - a fresh checkout of main
#   - its own draft/<id> branch
#   - its own per-character log
#   - a sanity report at the end of its run
#
# The session leaves the working tree on main; draft branches stay local for
# the human to review and merge.
#
# Targets are skipped (with a notice) when:
#   - the JSON already has meta.draftedAt populated (idempotent)
#   - the local branch draft/<id> already exists

set -euo pipefail

# ---------------------------------------------------------------------------
# Caffeinate self-wrap
# ---------------------------------------------------------------------------
# Re-exec under caffeinate so display-and-system idle stays prevented for the
# lifetime of this process. Idempotent via env flag.
# Flags: -d display, -i system idle, -m disk idle, -s on AC, -u user-active.
if [[ -z "${CRITCALC_CAFFEINATED:-}" ]]; then
  export CRITCALC_CAFFEINATED=1
  exec /usr/bin/caffeinate -dimsu "$0" "$@"
fi

# ---------------------------------------------------------------------------
# Resolve `claude` on PATH
# ---------------------------------------------------------------------------
# When launched from launchd (overnight scheduler), PATH doesn't include the
# fnm-managed Node bin where `claude` lives. Initialize fnm if available, and
# fall back to a hardcoded shim path. This is a no-op in interactive shells
# where fnm is already on PATH.
if ! command -v claude >/dev/null 2>&1; then
  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env)" || true
  fi
  if ! command -v claude >/dev/null 2>&1; then
    for candidate in \
      "$HOME/.local/share/fnm/node-versions"/*/installation/bin; do
      if [[ -x "$candidate/claude" ]]; then
        export PATH="$candidate:$PATH"
        break
      fi
    done
  fi
fi
if ! command -v claude >/dev/null 2>&1; then
  echo "ERROR: 'claude' CLI not found on PATH after fnm setup." >&2
  echo "       Tried fnm env and ~/.local/share/fnm/node-versions/*/installation/bin" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Repo paths
# ---------------------------------------------------------------------------
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/.curation-logs"
mkdir -p "$LOG_DIR"
SESSION_TS="$(date +%Y%m%d_%H%M%S)"
SESSION_LOG="$LOG_DIR/${SESSION_TS}_session.log"

cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# Arg parsing
# ---------------------------------------------------------------------------
COUNT=3
TARGETS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --count)
      [[ $# -ge 2 ]] || { echo "ERROR: --count needs a value" >&2; exit 2; }
      COUNT="$2"
      shift 2
      ;;
    -h|--help)
      sed -n '1,30p' "$0"
      exit 0
      ;;
    --)
      shift
      while [[ $# -gt 0 ]]; do TARGETS+=("$1"); shift; done
      ;;
    -*)
      echo "ERROR: unknown flag: $1" >&2
      exit 2
      ;;
    *)
      TARGETS+=("$1")
      shift
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Preflight (repo state)
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Returns 0 if the character's JSON has been drafted (meta.draftedAt set).
already_drafted() {
  local id="$1"
  local f="$REPO_ROOT/src/lib/data/characters/${id}.json"
  [[ -f "$f" ]] && grep -q '"draftedAt"' "$f"
}

# Returns 0 if a draft/<id> branch already exists locally.
draft_branch_exists() {
  local id="$1"
  git rev-parse --verify "draft/${id}" >/dev/null 2>&1
}

# Print up to N pending entries from queue.txt (`[ ] <id>` lines), filtering
# out anything already drafted or already on a draft/<id> branch.
pick_from_queue() {
  local want="$1"
  local picked=()
  local id
  while IFS= read -r id; do
    [[ -z "$id" ]] && continue
    if already_drafted "$id"; then
      continue
    fi
    if draft_branch_exists "$id"; then
      continue
    fi
    picked+=("$id")
    if [[ ${#picked[@]} -ge "$want" ]]; then
      break
    fi
  done < <(awk '/^\[ \] [a-z_]+$/ { print $3 }' "$REPO_ROOT/docs/curation/queue.txt")
  printf '%s\n' "${picked[@]}"
}

# ---------------------------------------------------------------------------
# Resolve targets
# ---------------------------------------------------------------------------
if [[ ${#TARGETS[@]} -eq 0 ]]; then
  echo "No explicit targets — picking next $COUNT from queue.txt"
  while IFS= read -r id; do
    [[ -n "$id" ]] && TARGETS+=("$id")
  done < <(pick_from_queue "$COUNT")
fi

if [[ ${#TARGETS[@]} -eq 0 ]]; then
  echo "Nothing to do: queue.txt has no eligible pending entries"
  echo "(everything is either already drafted or has a local draft/<id> branch)"
  exit 0
fi

# ---------------------------------------------------------------------------
# Session header
# ---------------------------------------------------------------------------
{
  echo "Session $SESSION_TS"
  echo "Caffeinate: ON (parent PID $$)"
  echo "Targets: ${TARGETS[*]}"
  echo "Log: $SESSION_LOG"
  echo "---"
} | tee "$SESSION_LOG"

# ---------------------------------------------------------------------------
# Per-character loop
# ---------------------------------------------------------------------------
PROCESSED=0
SKIPPED=0
FAILED=0

for TARGET in "${TARGETS[@]}"; do
  echo "" | tee -a "$SESSION_LOG"
  echo "================================================================" | tee -a "$SESSION_LOG"
  echo "=== START: $TARGET" | tee -a "$SESSION_LOG"
  echo "================================================================" | tee -a "$SESSION_LOG"

  # Defensive: ensure clean main between runs (prior run leaves draft branch
  # checked out — restore main).
  CUR_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "$CUR_BRANCH" != "main" ]]; then
    echo "Switching back to main before drafting $TARGET" | tee -a "$SESSION_LOG"
    git checkout main >>"$SESSION_LOG" 2>&1
  fi
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "ERROR: tree dirty before drafting $TARGET — aborting session" | tee -a "$SESSION_LOG" >&2
    FAILED=$((FAILED + 1))
    break
  fi

  # Skip already-drafted characters (idempotency).
  if already_drafted "$TARGET"; then
    echo "SKIP: $TARGET already has meta.draftedAt — leaving alone" | tee -a "$SESSION_LOG"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi
  if draft_branch_exists "$TARGET"; then
    echo "SKIP: branch draft/$TARGET already exists — leaving alone" | tee -a "$SESSION_LOG"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  RUN_LOG="$LOG_DIR/${SESSION_TS}_${TARGET}.log"

  # Per-character autonomous prompt. Note: avoid `PROMPT=$(cat <<EOF ... EOF)` —
  # bash 3.2 (macOS default) has a parsing bug where apostrophes in the
  # heredoc body break command substitution. `read -r -d ''` reads the heredoc
  # directly without $().
  IFS= read -r -d '' PROMPT <<PROMPT_EOF || true
You are running an autonomous character curation pass per docs/curation/recipe.md.

TARGET CHARACTER: ${TARGET}

LOCAL-ONLY MODE: This repo has no GitHub remote. You will NOT push and you
will NOT create a PR. Drafts live as local branches; the human reviews and
merges manually.

PROCEDURE:
1. Read docs/curation/recipe.md end-to-end before doing anything else. The
   recipe was updated on 2026-05-01 to reflect the canonical post-migration
   schema. Pay special attention to:
   - The "Summons — entity lifetime data" subsection in section 2. Skills
     and bursts that spawn entities (Oz, Phantom, fields, bubbles) use
     'behavior: "instant"' + 'summons[]', not the legacy
     'behavior: "persistent"' + 'summonActivatesAt' shape.
   - The behavior-field table in section 3. Do NOT author 'behavior:
     "persistent"' on a new draft — change generator-stub 'persistent'
     values to 'instant' and either add 'summons[]' or flag with
     '_curatorNotes'.
   - "InitAbilSlice vs InitNormalCancelSlice — silent-default trap"
     (especially ActionJump in plunge frames; omit J if not explicitly set).
   - "Charged attack (sword/claymore/polearm/catalyst)" key-set row.
   - "Skill charges from constellations" worked example.
   - Section 3.5 "Elemental Absorption" — applies if target is anemo.
   - The scaling-buff rule (delete the value field; no placeholder).
   - The inherited "manual" trigger rule (flag, do not rewrite).
   The recipe's PR-related steps are OVERRIDDEN by this prompt — see below.
2. Read docs/curation/queue.md and confirm "${TARGET}" is listed in Tier A.
   If not in Tier A, exit immediately and report which tier it's in.
3. Confirm git is on main and the working tree is clean.
4. Create branch draft/${TARGET} off main and check it out.
5. Draft src/lib/data/characters/${TARGET}.json per the recipe. If the
   character JSON already has meta.draftedAt populated, exit (idempotency).
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
- File scope: only edit src/lib/data/characters/${TARGET}.json. Do NOT
  touch docs/curation/queue.txt — it is human-managed.
- KQM data is out of scope. Use gcsim only. Do not WebFetch.
- Never invent effects. Skeletons + _curatorNotes flags only.
- If you encounter an unfamiliar mechanic the recipe doesn't cover: stop,
  add a _curatorNotes entry describing what you saw, commit what you have
  with the BLOCKED commit message, then exit.
PROMPT_EOF

  echo "Launching curation run for: $TARGET" | tee -a "$SESSION_LOG"
  echo "Per-character log: $RUN_LOG" | tee -a "$SESSION_LOG"
  echo "" | tee -a "$SESSION_LOG"

  # Don't let one character's failure abort the whole session — track and
  # continue. set -e is suspended for the duration of this block.
  set +e
  claude \
    --model claude-sonnet-4-6 \
    --dangerously-skip-permissions \
    -p "$PROMPT" \
    2>&1 | tee "$RUN_LOG" | tee -a "$SESSION_LOG"
  CLAUDE_STATUS=${PIPESTATUS[0]}
  set -e

  if [[ "$CLAUDE_STATUS" -ne 0 ]]; then
    echo "WARN: claude exited non-zero ($CLAUDE_STATUS) for $TARGET" | tee -a "$SESSION_LOG"
    FAILED=$((FAILED + 1))
  fi

  # Sanity report — same shape as run-calibration.sh.
  TARGET_JSON="src/lib/data/characters/${TARGET}.json"
  BRANCH="draft/${TARGET}"
  if git rev-parse --verify "$BRANCH" >/dev/null 2>&1 && [[ -f "$TARGET_JSON" ]]; then
    {
      echo ""
      echo "Sanity report for $TARGET:"
      echo "  Diff stats:"
      git diff --stat "main..$BRANCH" -- "$TARGET_JSON" | sed 's/^/    /'
      MANUAL_TRIGGERS=$(git show "$BRANCH:$TARGET_JSON" | grep -c '"type": "manual"' || true)
      CURATOR_NOTES=$(git show "$BRANCH:$TARGET_JSON" | grep -c '"_curatorNotes"' || true)
      LEGACY_PERSISTENT=$(git show "$BRANCH:$TARGET_JSON" | grep -c '"behavior": "persistent"' || true)
      echo "  '\"type\": \"manual\"' triggers retained: $MANUAL_TRIGGERS  (each should have a _curatorNotes flag)"
      echo "  '_curatorNotes' arrays present:        $CURATOR_NOTES"
      echo "  'behavior: \"persistent\"' usages:        $LEGACY_PERSISTENT  (should be 0 — recipe says use 'instant' + summons[])"
      echo "  Tip: eyeball plungeFrames J — if it equals AnimationLength it should be omitted."
      echo "  Tip: any 'value: <n>' on a scaling-buff effect should be deleted (recipe section 'Out of scope')."
      echo "  Tip: skills/bursts that spawn entities should have summons[] populated."
    } | tee -a "$SESSION_LOG"
  fi

  # Restore main for the next iteration.
  git checkout main >>"$SESSION_LOG" 2>&1 || true

  PROCESSED=$((PROCESSED + 1))
  echo "" | tee -a "$SESSION_LOG"
  echo "=== END: $TARGET" | tee -a "$SESSION_LOG"
done

# ---------------------------------------------------------------------------
# Session footer
# ---------------------------------------------------------------------------
{
  echo ""
  echo "================================================================"
  echo "Session complete."
  echo "  Processed: $PROCESSED"
  echo "  Skipped:   $SKIPPED"
  echo "  Failed:    $FAILED"
  echo ""
  echo "Review drafts:"
  for TARGET in "${TARGETS[@]}"; do
    if git rev-parse --verify "draft/${TARGET}" >/dev/null 2>&1; then
      echo "  git diff main..draft/${TARGET}"
    fi
  done
  echo ""
  echo "Merge each accepted draft with:"
  echo "  git checkout main && git merge --no-ff draft/<id> && git branch -d draft/<id>"
  echo ""
  echo "Discard a draft with:"
  echo "  git branch -D draft/<id>"
  echo ""
  echo "Session log: $SESSION_LOG"
} | tee -a "$SESSION_LOG"

# Caffeinate exits when this script does — no manual stop needed.
