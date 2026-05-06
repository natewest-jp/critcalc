#!/usr/bin/env bash
# Schedule an overnight Tier B character-curation run for the next HH:MM
# local time.
#
# Differs from schedule-overnight.sh (which targets Tier A) in:
#   - Calls scripts/run-tier-b.sh instead of run-curation.sh
#   - LaunchAgent label/plist filename use the `tier-b` prefix so the two
#     overnight schedulers can coexist without colliding
#   - No --count flag (Tier B drains the queue until limit hits); a
#     --max-count flag is passed through if you want to throttle a session
#
# What it does:
#   1. Asks pmset to wake the Mac at the target time (one-shot wake event,
#      requires sudo — pmset wake is a system-level setting).
#   2. Writes a one-shot LaunchAgent under ~/Library/LaunchAgents/ that runs
#      scripts/run-tier-b.sh at the target time and then unloads itself.
#   3. Loads the agent.
#
# Stacking multiple sessions per night:
#   The plist filename and Label both include the wake time (HHMM), so each
#   call writes a distinct LaunchAgent. Calling the script twice with two
#   different times queues both runs — useful for splitting a nightly batch
#   across two Claude usage windows (5h reset).
#
# Usage:
#   scripts/schedule-tier-b-overnight.sh                  # next 01:30, drain queue
#   scripts/schedule-tier-b-overnight.sh --hour 02 --min 15
#   scripts/schedule-tier-b-overnight.sh --max-count 5    # cap session at 5 chars
#
#   # Stacked example: 03:00 + 08:30, both fire tonight/tomorrow
#   scripts/schedule-tier-b-overnight.sh --hour 03 --min 00
#   scripts/schedule-tier-b-overnight.sh --hour 08 --min 30
#
#   scripts/schedule-tier-b-overnight.sh --cancel              # remove ALL queued sessions
#   scripts/schedule-tier-b-overnight.sh --cancel --hour 03 --min 00   # remove just 03:00
#
# Verifying the schedule:
#   pmset -g sched                                              # confirms wake event(s)
#   launchctl list | grep app.critcalc.curation-tier-b-overnight    # confirms agents loaded
#   ls ~/Library/LaunchAgents/app.critcalc.curation-tier-b-overnight*.plist
#
# Manual cleanup if a run fails / agents stay loaded:
#   for p in ~/Library/LaunchAgents/app.critcalc.curation-tier-b-overnight*.plist; do
#     launchctl unload "$p"; rm -f "$p"
#   done
#   sudo pmset schedule cancelall                       # clears all wake events

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/run-tier-b.sh"
LOG_DIR="$REPO_ROOT/.curation-logs"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
LABEL_PREFIX="app.critcalc.curation-tier-b-overnight"

WAKE_HOUR=01
WAKE_MIN=30
MAX_COUNT=""    # Empty means "no cap" — let run-tier-b.sh use its default.
ACTION="schedule"
TIME_GIVEN=0   # tracks whether --hour/--min were passed explicitly (matters for --cancel)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hour)      WAKE_HOUR="$2"; TIME_GIVEN=1; shift 2 ;;
    --min)       WAKE_MIN="$2"; TIME_GIVEN=1; shift 2 ;;
    --max-count) MAX_COUNT="$2"; shift 2 ;;
    --cancel)    ACTION="cancel"; shift ;;
    -h|--help)   sed -n '1,47p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

# Pad single-digit values to two digits.
WAKE_HOUR=$(printf '%02d' "$((10#$WAKE_HOUR))")
WAKE_MIN=$(printf '%02d' "$((10#$WAKE_MIN))")
SUFFIX="${WAKE_HOUR}${WAKE_MIN}"

PLIST="$LAUNCH_AGENTS_DIR/${LABEL_PREFIX}-${SUFFIX}.plist"
LABEL="${LABEL_PREFIX}-${SUFFIX}"

# ---------------------------------------------------------------------------
# Cancel mode
# ---------------------------------------------------------------------------
if [[ "$ACTION" == "cancel" ]]; then
  if (( TIME_GIVEN == 1 )); then
    echo "Cancelling Tier B overnight schedule for ${WAKE_HOUR}:${WAKE_MIN}…"
    if [[ -f "$PLIST" ]]; then
      launchctl unload "$PLIST" 2>/dev/null || true
      rm -f "$PLIST"
      echo "  Removed: $PLIST"
    else
      echo "  No LaunchAgent at $PLIST"
    fi
  else
    echo "Cancelling all Tier B overnight schedules…"
    shopt -s nullglob
    found=0
    for p in "$LAUNCH_AGENTS_DIR/${LABEL_PREFIX}.plist" "$LAUNCH_AGENTS_DIR/${LABEL_PREFIX}-"*.plist; do
      launchctl unload "$p" 2>/dev/null || true
      rm -f "$p"
      echo "  Removed: $p"
      found=$((found + 1))
    done
    shopt -u nullglob
    if (( found == 0 )); then
      echo "  No Tier B overnight LaunchAgents found in $LAUNCH_AGENTS_DIR"
    fi
  fi
  echo ""
  echo "Note: pmset wake events are not auto-removed. To inspect/clear:"
  echo "  pmset -g sched                  # see scheduled events"
  echo "  sudo pmset schedule cancelall   # clear all wake events"
  exit 0
fi

# ---------------------------------------------------------------------------
# Sanity checks
# ---------------------------------------------------------------------------
if [[ ! -x "$SCRIPT" ]]; then
  echo "ERROR: $SCRIPT not found or not executable" >&2
  exit 1
fi
mkdir -p "$LOG_DIR"
mkdir -p "$LAUNCH_AGENTS_DIR"

if [[ -f "$PLIST" ]]; then
  echo "Note: a Tier B overnight session at ${WAKE_HOUR}:${WAKE_MIN} already exists."
  echo "      It will be replaced."
  echo ""
fi

# ---------------------------------------------------------------------------
# Compute target wake date (tonight if HH:MM is in the future, tomorrow if past)
# ---------------------------------------------------------------------------
NOW_HM=$(date +%H%M)
TARGET_HM="${WAKE_HOUR}${WAKE_MIN}"

if (( 10#$NOW_HM < 10#$TARGET_HM )); then
  WAKE_DATE=$(date "+%m/%d/%Y")
  WAKE_DAY_DESC="today"
else
  WAKE_DATE=$(date -v+1d "+%m/%d/%Y")
  WAKE_DAY_DESC="tomorrow"
fi
WAKE_PMSET="${WAKE_DATE} ${WAKE_HOUR}:${WAKE_MIN}:00"

# Build the run-tier-b.sh argv. Empty MAX_COUNT means "drain queue".
RUN_ARGS=""
if [[ -n "$MAX_COUNT" ]]; then
  RUN_ARGS="--max-count $MAX_COUNT"
fi

echo "Scheduling Tier B overnight curation:"
echo "  Wake target:    $WAKE_PMSET ($WAKE_DAY_DESC)"
echo "  Run:            $SCRIPT $RUN_ARGS"
echo "  Model:          claude-opus-4-7 (high effort)"
echo "  LaunchAgent:    $PLIST"
echo "  Label:          $LABEL"
echo ""

# ---------------------------------------------------------------------------
# 1. Schedule the system wake (pmset, needs sudo)
# ---------------------------------------------------------------------------
echo "Step 1/3: scheduling system wake (will prompt for sudo)…"
if ! sudo pmset schedule wake "$WAKE_PMSET"; then
  echo "ERROR: pmset schedule wake failed" >&2
  exit 1
fi
echo "  OK"
echo ""

# ---------------------------------------------------------------------------
# 2. Write the one-shot LaunchAgent
# ---------------------------------------------------------------------------
echo "Step 2/3: writing LaunchAgent plist…"

# StartCalendarInterval matches every day at HH:MM. To make this one-shot,
# the wrapped command unloads + deletes the plist after the run completes.
# If the run dies before that, the user can run --cancel or unload manually.
# Per-session log filename keeps stacked sessions from clobbering each other.

cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd "$REPO_ROOT" &amp;&amp; "$SCRIPT" $RUN_ARGS; STATUS=\$?; /bin/launchctl unload "$PLIST"; /bin/rm -f "$PLIST"; exit \$STATUS</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>$((10#$WAKE_HOUR))</integer>
    <key>Minute</key>
    <integer>$((10#$WAKE_MIN))</integer>
  </dict>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/launchd-tier-b-overnight-${SUFFIX}.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/launchd-tier-b-overnight-${SUFFIX}.err.log</string>
</dict>
</plist>
PLIST_EOF

echo "  Wrote $PLIST"
echo ""

# ---------------------------------------------------------------------------
# 3. Load the agent
# ---------------------------------------------------------------------------
echo "Step 3/3: loading LaunchAgent…"
launchctl unload "$PLIST" 2>/dev/null || true
if ! launchctl load "$PLIST"; then
  echo "ERROR: launchctl load failed" >&2
  exit 1
fi
echo "  OK"
echo ""

# ---------------------------------------------------------------------------
# Summary — list every currently-queued Tier B overnight session
# ---------------------------------------------------------------------------
shopt -s nullglob
QUEUED=("$LAUNCH_AGENTS_DIR/${LABEL_PREFIX}-"*.plist)
shopt -u nullglob

cat <<SUMMARY
================================================================
Tier B overnight curation scheduled.

  Wake:   $WAKE_PMSET
  Run:    $SCRIPT $RUN_ARGS
  Logs:   $LOG_DIR/launchd-tier-b-overnight-${SUFFIX}.{out,err}.log
          $LOG_DIR/<session-ts>_session-tier-b.log
          $LOG_DIR/<session-ts>_<character>.log

What happens:
  - Mac wakes at $WAKE_HOUR:$WAKE_MIN. (Verify: pmset -g sched)
  - LaunchAgent fires run-tier-b.sh, which caffeinates itself.
  - Script picks the next [ ] entry from queue.txt's Tier B section and
    drafts it on draft/<id>, using Opus 4.7 with --effort high.
  - Loop continues drafting characters until the queue is exhausted OR
    Claude reports a usage limit (5-hour or weekly window). Either way,
    the session exits cleanly.
  - When the script exits, caffeinate releases automatically.
  - The LaunchAgent unloads + deletes itself.

Currently queued Tier B sessions (${#QUEUED[@]}):
SUMMARY

for p in "${QUEUED[@]}"; do
  fname=$(basename "$p" .plist)
  hhmm=${fname##*-}
  hh=${hhmm:0:2}
  mm=${hhmm:2:2}
  echo "  - ${hh}:${mm}  ($p)"
done

cat <<SUMMARY

To cancel:
  $0 --cancel                            # remove ALL queued Tier B sessions
  $0 --cancel --hour $WAKE_HOUR --min $WAKE_MIN     # remove just this one

Note: this scheduler does not affect Tier A overnight sessions
(scripts/schedule-overnight.sh). The two coexist via distinct labels.

Manual recovery if an agent stays loaded after a failed run:
  launchctl unload "$PLIST"
  rm -f "$PLIST"
================================================================
SUMMARY
