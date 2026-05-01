#!/usr/bin/env bash
# Schedule an overnight character-curation run for the next 01:30 local time.
#
# What it does:
#   1. Asks pmset to wake the Mac at the target time (one-shot wake event,
#      requires sudo — pmset wake is a system-level setting).
#   2. Writes a one-shot LaunchAgent under ~/Library/LaunchAgents/ that runs
#      scripts/run-curation.sh at the target time and then unloads itself.
#   3. Loads the agent.
#
# Usage:
#   scripts/schedule-overnight.sh                # wake at next 01:30, run 2 chars
#   scripts/schedule-overnight.sh --hour 02 --min 15
#   scripts/schedule-overnight.sh --count 3      # run 3 chars instead of 2
#   scripts/schedule-overnight.sh --cancel       # remove the agent + wake
#
# Verifying the schedule:
#   pmset -g sched                               # confirms wake event
#   launchctl list | grep app.critcalc           # confirms agent loaded
#
# Manual cleanup if a run fails / agent stays loaded:
#   launchctl unload ~/Library/LaunchAgents/app.critcalc.curation-overnight.plist
#   rm ~/Library/LaunchAgents/app.critcalc.curation-overnight.plist
#   sudo pmset schedule cancelall                # clears all scheduled events

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/run-curation.sh"
LOG_DIR="$REPO_ROOT/.curation-logs"
PLIST="$HOME/Library/LaunchAgents/app.critcalc.curation-overnight.plist"
LABEL="app.critcalc.curation-overnight"

WAKE_HOUR=01
WAKE_MIN=30
COUNT=2
ACTION="schedule"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hour)  WAKE_HOUR="$2"; shift 2 ;;
    --min)   WAKE_MIN="$2"; shift 2 ;;
    --count) COUNT="$2"; shift 2 ;;
    --cancel) ACTION="cancel"; shift ;;
    -h|--help) sed -n '1,30p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

# Pad single-digit values to two digits.
WAKE_HOUR=$(printf '%02d' "$((10#$WAKE_HOUR))")
WAKE_MIN=$(printf '%02d' "$((10#$WAKE_MIN))")

# ---------------------------------------------------------------------------
# Cancel mode
# ---------------------------------------------------------------------------
if [[ "$ACTION" == "cancel" ]]; then
  echo "Cancelling overnight schedule…"
  if [[ -f "$PLIST" ]]; then
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "  Removed LaunchAgent: $PLIST"
  else
    echo "  No LaunchAgent at $PLIST"
  fi
  echo ""
  echo "Note: pmset wake events are not auto-removed. To clear:"
  echo "  pmset -g sched         # see scheduled events"
  echo "  sudo pmset schedule cancelall   # clear all"
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
mkdir -p "$(dirname "$PLIST")"

# ---------------------------------------------------------------------------
# Compute target wake date
# ---------------------------------------------------------------------------
# If today's HH:MM is already past target, schedule for tomorrow.
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

echo "Scheduling overnight curation:"
echo "  Wake target:    $WAKE_PMSET ($WAKE_DAY_DESC)"
echo "  Run:            $SCRIPT --count $COUNT"
echo "  LaunchAgent:    $PLIST"
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
    <string>cd "$REPO_ROOT" &amp;&amp; "$SCRIPT" --count $COUNT; STATUS=\$?; /bin/launchctl unload "$PLIST"; /bin/rm -f "$PLIST"; exit \$STATUS</string>
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
  <string>$LOG_DIR/launchd-overnight.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/launchd-overnight.err.log</string>
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
# Summary
# ---------------------------------------------------------------------------
cat <<SUMMARY
================================================================
Overnight curation scheduled.

  Wake:  $WAKE_PMSET
  Run:   $SCRIPT --count $COUNT
  Logs:  $LOG_DIR/

What happens:
  - Mac wakes at $WAKE_HOUR:$WAKE_MIN. (Verify: pmset -g sched)
  - LaunchAgent fires run-curation.sh, which caffeinates itself.
  - Script processes $COUNT characters from queue.txt, each on its
    own draft/<id> branch.
  - When the script exits, caffeinate releases automatically.
  - The LaunchAgent unloads + deletes itself. (Verify next morning:
    \`ls $PLIST\` should return "No such file".)

To cancel before it fires:
  $0 --cancel

Manual recovery if the agent stays loaded after a failed run:
  launchctl unload "$PLIST"
  rm -f "$PLIST"
  sudo pmset schedule cancelall
================================================================
SUMMARY
