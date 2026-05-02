#!/usr/bin/env bash
# Schedule an overnight character-curation run for the next HH:MM local time.
#
# What it does:
#   1. Asks pmset to wake the Mac at the target time (one-shot wake event,
#      requires sudo — pmset wake is a system-level setting).
#   2. Writes a one-shot LaunchAgent under ~/Library/LaunchAgents/ that runs
#      scripts/run-curation.sh at the target time and then unloads itself.
#   3. Loads the agent.
#
# Stacking multiple sessions per night:
#   The plist filename and Label both include the wake time (HHMM), so each
#   call writes a distinct LaunchAgent. Calling the script twice with two
#   different times queues both runs — useful for splitting a nightly batch
#   across two Claude Pro 5-hour usage windows.
#
# Usage:
#   scripts/schedule-overnight.sh                # next 01:30, run 3 chars
#   scripts/schedule-overnight.sh --hour 02 --min 15
#   scripts/schedule-overnight.sh --count 4      # 4 chars instead of 3
#
#   # Stacked example: 03:00 + 08:30, both fire tonight/tomorrow
#   scripts/schedule-overnight.sh --hour 03 --min 00
#   scripts/schedule-overnight.sh --hour 08 --min 30
#
#   scripts/schedule-overnight.sh --cancel              # remove ALL queued sessions
#   scripts/schedule-overnight.sh --cancel --hour 03 --min 00   # remove just 03:00
#
# Verifying the schedule:
#   pmset -g sched                                      # confirms wake event(s)
#   launchctl list | grep app.critcalc.curation-overnight   # confirms agents loaded
#   ls ~/Library/LaunchAgents/app.critcalc.curation-overnight*.plist
#
# Manual cleanup if a run fails / agents stay loaded:
#   for p in ~/Library/LaunchAgents/app.critcalc.curation-overnight*.plist; do
#     launchctl unload "$p"; rm -f "$p"
#   done
#   sudo pmset schedule cancelall                       # clears all wake events

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/run-curation.sh"
LOG_DIR="$REPO_ROOT/.curation-logs"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
LABEL_PREFIX="app.critcalc.curation-overnight"

WAKE_HOUR=01
WAKE_MIN=30
COUNT=3
ACTION="schedule"
TIME_GIVEN=0   # tracks whether --hour/--min were passed explicitly (matters for --cancel)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hour)  WAKE_HOUR="$2"; TIME_GIVEN=1; shift 2 ;;
    --min)   WAKE_MIN="$2"; TIME_GIVEN=1; shift 2 ;;
    --count) COUNT="$2"; shift 2 ;;
    --cancel) ACTION="cancel"; shift ;;
    -h|--help) sed -n '1,38p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

# Pad single-digit values to two digits.
WAKE_HOUR=$(printf '%02d' "$((10#$WAKE_HOUR))")
WAKE_MIN=$(printf '%02d' "$((10#$WAKE_MIN))")
SUFFIX="${WAKE_HOUR}${WAKE_MIN}"

# Per-time paths. The label/filename suffix lets multiple sessions coexist.
PLIST="$LAUNCH_AGENTS_DIR/${LABEL_PREFIX}-${SUFFIX}.plist"
LABEL="${LABEL_PREFIX}-${SUFFIX}"

# ---------------------------------------------------------------------------
# Cancel mode
# ---------------------------------------------------------------------------
if [[ "$ACTION" == "cancel" ]]; then
  if (( TIME_GIVEN == 1 )); then
    # Targeted cancel: only the specified time.
    echo "Cancelling overnight schedule for ${WAKE_HOUR}:${WAKE_MIN}…"
    if [[ -f "$PLIST" ]]; then
      launchctl unload "$PLIST" 2>/dev/null || true
      rm -f "$PLIST"
      echo "  Removed: $PLIST"
    else
      echo "  No LaunchAgent at $PLIST"
    fi
  else
    # Sweep cancel: every overnight plist, including any legacy un-suffixed file.
    echo "Cancelling all overnight schedules…"
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
      echo "  No overnight LaunchAgents found in $LAUNCH_AGENTS_DIR"
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

# Warn if a session is already scheduled at this time. We don't refuse — the
# user might be intentionally re-loading after editing — but flag it so a
# typo doesn't silently double-schedule.
if [[ -f "$PLIST" ]]; then
  echo "Note: an overnight session at ${WAKE_HOUR}:${WAKE_MIN} already exists."
  echo "      It will be replaced with the new --count value ($COUNT)."
  echo ""
fi

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
  <string>$LOG_DIR/launchd-overnight-${SUFFIX}.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/launchd-overnight-${SUFFIX}.err.log</string>
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
# Summary — list every currently-queued overnight session
# ---------------------------------------------------------------------------
shopt -s nullglob
QUEUED=("$LAUNCH_AGENTS_DIR/${LABEL_PREFIX}-"*.plist)
shopt -u nullglob

cat <<SUMMARY
================================================================
Overnight curation scheduled.

  Wake:   $WAKE_PMSET
  Run:    $SCRIPT --count $COUNT
  Logs:   $LOG_DIR/launchd-overnight-${SUFFIX}.{out,err}.log

What happens:
  - Mac wakes at $WAKE_HOUR:$WAKE_MIN. (Verify: pmset -g sched)
  - LaunchAgent fires run-curation.sh, which caffeinates itself.
  - Script processes $COUNT characters from queue.txt, each on its
    own draft/<id> branch.
  - When the script exits, caffeinate releases automatically.
  - The LaunchAgent unloads + deletes itself.

Currently queued sessions (${#QUEUED[@]}):
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
  $0 --cancel                            # remove ALL queued sessions
  $0 --cancel --hour $WAKE_HOUR --min $WAKE_MIN     # remove just this one

Manual recovery if an agent stays loaded after a failed run:
  launchctl unload "$PLIST"
  rm -f "$PLIST"
================================================================
SUMMARY
