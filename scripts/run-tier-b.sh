#!/usr/bin/env bash
# Run autonomous Tier B character-curation passes back-to-back, drafting
# until either the queue is exhausted or a Claude usage limit fires.
#
# Modes:
#   scripts/run-tier-b.sh                          # default: drain Tier B queue
#   scripts/run-tier-b.sh --max-count 5            # cap at 5 characters this session
#   scripts/run-tier-b.sh yoimiya                  # explicit single target
#   scripts/run-tier-b.sh yoimiya tartaglia        # explicit multi-target
#
# Differences from run-curation.sh (the Tier A driver):
#   - Model: claude-opus-4-7 (was claude-sonnet-4-6)
#   - Effort: --effort high
#   - Recipe: docs/curation/recipe-tier-b.md (additive to recipe.md)
#   - Loop: drains the queue until empty OR a usage limit fires (was: --count N)
#   - Limit detection: matches Claude CLI rate-limit text in the per-character
#     log; on hit, exits cleanly without continuing to the next character.
#
# Self-wraps in `caffeinate -dimsu` so keep-awake is bound to this process —
# caffeinate exits automatically when the script exits, on any path.
#
# Each character gets:
#   - a fresh checkout of main
#   - its own draft/<id> branch
#   - its own per-character log
#   - a sanity report at the end of its run
#
# Targets are skipped (with a notice) when:
#   - the JSON already has meta.draftedAt populated (idempotent)
#   - the local branch draft/<id> already exists (covers the BLOCKED
#     draft/lanyan and draft/nilou state — they're left alone)

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
SESSION_LOG="$LOG_DIR/${SESSION_TS}_session-tier-b.log"

cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# Arg parsing
# ---------------------------------------------------------------------------
# Default cap is high enough to drain the queue if a limit never fires. The
# real terminator is the limit-hit pattern match (or queue-empty).
MAX_COUNT=999
TARGETS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-count)
      [[ $# -ge 2 ]] || { echo "ERROR: --max-count needs a value" >&2; exit 2; }
      MAX_COUNT="$2"
      shift 2
      ;;
    -h|--help)
      sed -n '1,32p' "$0"
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
# Preflight (repo + recipe state)
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
if [[ ! -f "$REPO_ROOT/docs/curation/recipe-tier-b.md" ]]; then
  echo "ERROR: docs/curation/recipe-tier-b.md not found — Tier B recipe missing." >&2
  exit 1
fi
for ref in hu_tao cyno; do
  if [[ ! -f "$REPO_ROOT/src/lib/data/characters/${ref}.json" ]]; then
    echo "ERROR: reference character $ref.json missing — Tier B prompts depend on it." >&2
    exit 1
  fi
done

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

# Print the next eligible Tier B id from queue.txt — a `[ ] <id>` line whose
# JSON hasn't been drafted yet and whose draft branch doesn't already exist.
# Returns empty if the queue is exhausted.
pick_next_pending() {
  local id
  while IFS= read -r id; do
    [[ -z "$id" ]] && continue
    if already_drafted "$id"; then
      continue
    fi
    if draft_branch_exists "$id"; then
      continue
    fi
    echo "$id"
    return 0
  done < <(awk '/^\[ \] [a-z_]+$/ { print $3 }' "$REPO_ROOT/docs/curation/queue.txt")
  return 1
}

# Detect Claude usage-limit text in a per-character log. Matches the most
# common phrasings seen from Claude CLI when a 5-hour or weekly limit fires.
# Used to differentiate "limit hit (stop session)" from "model error
# (continue with next character)".
limit_hit_in_log() {
  local logfile="$1"
  [[ -f "$logfile" ]] || return 1
  grep -qiE 'usage limit reached|weekly limit|5[- ]?hour limit|rate[ _-]?limit|too many requests|429|reset(s)? (at|in)' "$logfile"
}

# Reset working state to a clean main between iterations. Returns 1 if the
# tree is dirty in a way the script can't safely recover from — caller should
# abort the session in that case.
reset_to_main() {
  local cur
  cur="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "$cur" != "main" ]]; then
    git checkout main >>"$SESSION_LOG" 2>&1 || return 1
  fi
  if [[ -n "$(git status --porcelain)" ]]; then
    return 1
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Build initial target queue
# ---------------------------------------------------------------------------
# Two modes: explicit targets (one shot, possibly multiple) or queue-driven
# (drain until limit/cap/empty).
QUEUE_DRIVEN=1
if [[ ${#TARGETS[@]} -gt 0 ]]; then
  QUEUE_DRIVEN=0
fi

# ---------------------------------------------------------------------------
# Session header
# ---------------------------------------------------------------------------
{
  echo "Session $SESSION_TS — Tier B"
  echo "Model:      claude-opus-4-7"
  echo "Effort:     high"
  echo "Recipe:     docs/curation/recipe-tier-b.md"
  echo "Caffeinate: ON (parent PID $$)"
  echo "Mode:       $( ((QUEUE_DRIVEN)) && echo 'queue-driven (drain until limit/cap/empty)' || echo "explicit targets: ${TARGETS[*]}" )"
  echo "Cap:        --max-count $MAX_COUNT"
  echo "Log:        $SESSION_LOG"
  echo "---"
} | tee "$SESSION_LOG"

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
PROCESSED=0
SKIPPED=0
FAILED=0
LIMIT_HIT=0

# Iterator state for explicit-targets mode
TARGET_IDX=0

while (( PROCESSED + SKIPPED + FAILED < MAX_COUNT )); do
  # ----- Pick next target ----------------------------------------------------
  TARGET=""
  if (( QUEUE_DRIVEN )); then
    TARGET="$(pick_next_pending || true)"
    if [[ -z "$TARGET" ]]; then
      echo "" | tee -a "$SESSION_LOG"
      echo "Queue exhausted: no eligible [ ] entries remain in queue.txt." | tee -a "$SESSION_LOG"
      break
    fi
  else
    if (( TARGET_IDX >= ${#TARGETS[@]} )); then
      break
    fi
    TARGET="${TARGETS[$TARGET_IDX]}"
    TARGET_IDX=$((TARGET_IDX + 1))
  fi

  echo "" | tee -a "$SESSION_LOG"
  echo "================================================================" | tee -a "$SESSION_LOG"
  echo "=== START: $TARGET" | tee -a "$SESSION_LOG"
  echo "================================================================" | tee -a "$SESSION_LOG"

  # ----- Reset to clean main ------------------------------------------------
  if ! reset_to_main; then
    echo "ERROR: tree dirty before drafting $TARGET — aborting session" | tee -a "$SESSION_LOG" >&2
    FAILED=$((FAILED + 1))
    break
  fi

  # ----- Skip already-drafted ------------------------------------------------
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

  # ----- Build prompt --------------------------------------------------------
  # bash 3.2 (macOS default) has a heredoc + $() parsing bug with apostrophes;
  # `read -r -d ''` reads the heredoc directly without command substitution.
  IFS= read -r -d '' PROMPT <<PROMPT_EOF || true
You are running an autonomous Tier B character curation pass per
docs/curation/recipe-tier-b.md (the Tier B addendum to docs/curation/recipe.md).

TARGET CHARACTER: ${TARGET}

LOCAL-ONLY MODE: This repo has no GitHub remote. You will NOT push and you
will NOT create a PR. Drafts live as local branches; the human reviews and
merges manually.

PROCEDURE:
1. Read docs/curation/recipe.md end-to-end. The base recipe still governs
   frame extraction (InitAbilSlice / InitNormalCancelSlice rules), the
   summons[] schema, the behavior-field table, the scaling-buff rule, and
   the inherited "manual" trigger rule. Do not skip it — recipe-tier-b.md
   is additive, not a replacement.
2. Read docs/curation/recipe-tier-b.md end-to-end. Identify which Tier B
   pattern applies to "${TARGET}" by reading its per-character note in
   the "Per-character notes" section. The note pre-resolves the pattern
   choice and pre-flags the gotchas.
3. Read docs/curation/queue.md and confirm "${TARGET}" is listed in
   Tier B. If it appears in Tier A or Tier C, exit immediately and report.
4. Read the relevant reference characters per the matched pattern:
   - Pattern 1 (stance with N replacement): hu_tao.json
   - Pattern 2 (multi-skill stance, in-stance E/Q with different frames): cyno.json
   - Stance-on-Q without multi-skill: furina.json or raiden_shogun.json
   - Pattern 3 (multi-stage): see Pattern 3 section in recipe-tier-b.md;
     reference draft/lanyan if you choose to BLOCK
   - Pattern 4 (stack-gated CA): see Pattern 4 section + per-character note
   Mirror the closest reference's shape. Do not invent new shapes.
5. Confirm git is on main and the working tree is clean.
6. Create branch draft/${TARGET} off main and check it out.
7. Draft src/lib/data/characters/${TARGET}.json per recipe-tier-b.md.
   - If the JSON already has meta.draftedAt populated, exit (idempotency).
   - Stop only on stop conditions in recipe-tier-b.md § "Stop conditions
     (Tier B version)" — multi-step state machines that gate N-token
     meaning, Nightsoul resource pools, or genuinely novel mechanics.
   - Do NOT stop on stance, multi-stage, or stack-gated patterns — those
     are recipe-handled. Author them.
8. Commit with message: draft(${TARGET}): first-pass curation from gcsim
   (If a stop condition fired mid-draft, use commit message:
    draft(${TARGET}): BLOCKED — needs reviewer attention
    and follow the BLOCKED handoff format from recipe.md § "Stop
    conditions" — frame slices for each phase, state-flag and lifetime,
    inputs that trigger each phase, constellation modifiers.)
9. STOP. Do NOT push. Do NOT run gh or create a PR. The branch stays local.
10. Output the recipe's output checklist (with the Tier B additions from
    recipe-tier-b.md) as your final message, filled in for what was
    completed. End with a single summary line:
    Drafted ${TARGET} on branch draft/${TARGET}. Pattern: <pattern-name>. Flagged: <count> _curatorNotes.

HARD CONSTRAINTS:
- Tier B only. Tier A → exit (already curated). Tier C → exit (defer).
- One character per run. Do not draft anything else in this session — the
  outer loop handles the next character.
- Never merge. Never push (no remote configured). Never force-push.
- Never use --no-verify.
- File scope: only edit src/lib/data/characters/${TARGET}.json. Do NOT
  touch docs/curation/queue.txt — it is human-managed.
- KQM data is out of scope. Use gcsim only. Do not WebFetch.
- Never invent effects. Skeletons + _curatorNotes flags only. The base
  recipe's "flag, don't fake" posture still holds — Tier B is more
  permissive on *structural* shape (stance/multi-stage), not on *effect
  authoring*.
- For Bond of Life characters (Arlecchino, Clorinde): author the stance
  frames, do NOT author BoL-conditional buffs. Flag with _curatorNotes.
- For multi-stage chains where the schema can't gate the chain (no
  "afterPriorSkill" condition exists), author all stages as separate
  abilities with input ["E"] and a _curatorNotes flag describing the chain
  on each. The frames are the high-value output.

Use the latitude of Opus 4.7 high effort thoughtfully: this work needs
careful gcsim reading, faithful frame extraction, and good judgment on
when a mechanic deserves a flag vs an attempted authoring. When in doubt,
mirror the closest reference and flag the deviation. Better one well-flagged
draft than a partial one that papers over uncertainty.
PROMPT_EOF

  echo "Launching Tier B curation run for: $TARGET" | tee -a "$SESSION_LOG"
  echo "Per-character log: $RUN_LOG" | tee -a "$SESSION_LOG"
  echo "" | tee -a "$SESSION_LOG"

  # ----- Invoke Claude -------------------------------------------------------
  # set -e suspended for this block so a single failed character doesn't kill
  # the session — we want to detect limit-hits and continue past transient
  # failures.
  set +e
  claude \
    --model claude-opus-4-7 \
    --effort high \
    --dangerously-skip-permissions \
    -p "$PROMPT" \
    2>&1 | tee "$RUN_LOG" | tee -a "$SESSION_LOG"
  CLAUDE_STATUS=${PIPESTATUS[0]}
  set -e

  # ----- Limit-hit check (highest priority) ---------------------------------
  if limit_hit_in_log "$RUN_LOG"; then
    {
      echo ""
      echo "================================================================"
      echo "USAGE LIMIT HIT during $TARGET (claude exit: $CLAUDE_STATUS)."
      echo "Detected one of: 'usage limit reached', 'weekly limit',"
      echo "'5-hour limit', 'rate limit', '429', or a reset hint."
      echo "Stopping session cleanly. Re-launch via:"
      echo "  scripts/run-tier-b.sh"
      echo "or schedule for after the limit window via:"
      echo "  scripts/schedule-tier-b-overnight.sh"
      echo "================================================================"
    } | tee -a "$SESSION_LOG"
    LIMIT_HIT=1
    # Try to leave the tree clean for the next run; the partially-drafted
    # branch (if any) stays for the human to inspect.
    git checkout main >>"$SESSION_LOG" 2>&1 || true
    break
  fi

  # ----- Per-character status -----------------------------------------------
  if [[ "$CLAUDE_STATUS" -ne 0 ]]; then
    echo "WARN: claude exited non-zero ($CLAUDE_STATUS) for $TARGET — continuing to next" | tee -a "$SESSION_LOG"
    FAILED=$((FAILED + 1))
  fi

  # ----- Sanity report ------------------------------------------------------
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
      STANCE_USES=$(git show "$BRANCH:$TARGET_JSON" | grep -c '"behavior": "stance"' || true)
      INSTANCE_CONDITIONS=$(git show "$BRANCH:$TARGET_JSON" | grep -c '"state": "inStance"' || true)
      echo "  '\"type\": \"manual\"' triggers retained:    $MANUAL_TRIGGERS  (each should have a _curatorNotes flag)"
      echo "  '_curatorNotes' arrays present:           $CURATOR_NOTES"
      echo "  'behavior: \"persistent\"' usages:          $LEGACY_PERSISTENT  (should be 0 — recipe says use 'instant' + summons[])"
      echo "  'behavior: \"stance\"' usages:              $STANCE_USES   (Tier B stance characters: expect ≥1; multi-stage/stack-gated: expect 0)"
      echo "  '\"state\": \"inStance\"' conditions:         $INSTANCE_CONDITIONS  (in-stance variant abilities)"
      echo "  Tip: open $TARGET_JSON and verify the in-stance abilities have"
      echo "       distinct frame data from their base counterparts (otherwise the"
      echo "       split is meaningless)."
    } | tee -a "$SESSION_LOG"
  fi

  # ----- Restore main for next iteration ------------------------------------
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
  echo "Tier B session complete."
  echo "  Processed:        $PROCESSED"
  echo "  Skipped:          $SKIPPED"
  echo "  Failed (non-limit): $FAILED"
  echo "  Limit hit:        $( ((LIMIT_HIT)) && echo 'YES — stopped early' || echo 'no' )"
  echo ""
  echo "Review drafts:"
  if (( QUEUE_DRIVEN )); then
    # Surface every draft/<id> branch the session created or touched.
    while IFS= read -r b; do
      echo "  git diff main..${b#refs/heads/}"
    done < <(git for-each-ref --format='%(refname)' refs/heads/draft/)
  else
    for TARGET in "${TARGETS[@]}"; do
      if git rev-parse --verify "draft/${TARGET}" >/dev/null 2>&1; then
        echo "  git diff main..draft/${TARGET}"
      fi
    done
  fi
  echo ""
  echo "Merge each accepted draft with:"
  echo "  git checkout main && git merge --no-ff draft/<id> && git branch -d draft/<id>"
  echo ""
  echo "Discard a draft with:"
  echo "  git branch -D draft/<id>"
  echo ""
  echo "Session log: $SESSION_LOG"
} | tee -a "$SESSION_LOG"

# Exit 0 on limit-hit too — the run completed gracefully, the queue just
# isn't drained yet. Use exit 1 only for hard errors (preflight failures).
exit 0
