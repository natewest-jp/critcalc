#!/usr/bin/env bash
# Schedule a recurring character-curation run that fires every N seconds.
# Default cadence: every 5h15m (18900s).
#
# Differs from schedule-overnight.sh in three ways:
#   1. Recurring (StartInterval) rather than one-shot (StartCalendarInterval).
#   2. The LaunchAgent does NOT unload itself after a run — it stays loaded
#      and fires again on the next interval.
#   3. No pmset wake. pmset can't schedule arbitrary recurring intervals
#      (only daily-at-time). The Mac must be awake at fire time, OR the
#      interval must elapse fully during a wake window. If the Mac sleeps
#      through a fire, launchd fires once at the next wake (it does not
#      catch up missed fires beyond one).
#
# Usage:
#   scripts/schedule-recurring.sh                # every 18900s (5h15m), 3 chars per run
#   scripts/schedule-recurring.sh --interval 21600   # every 6h
#   scripts/schedule-recurring.sh --count 2      # 2 chars per run instead of 3
#   scripts/schedule-recurring.sh --cancel       # remove the agent
#
# Verifying:
#   launchctl list | grep app.critcalc.curation-recurring
#   tail -f .curation-logs/launchd-recurring.out.log
#
# Caveats:
#   - Sleep eats fires. If the Mac is asleep for >1 interval, you get
#     exactly one fire on wake, not several. For overnight runs, prefer
#     schedule-overnight.sh (which uses pmset to wake the Mac).
#   - If a curation run is still in progress when the next interval fires,
#     launchd skips that fire (default behavior; it won't run two copies
#     of the same job concurrently).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/run-curation.sh"
LOG_DIR="$REPO_ROOT/.curation-logs"
PLIST="$HOME/Library/LaunchAgents/app.critcalc.curation-recurring.plist"
LABEL="app.critcalc.curation-recurring"

INTERVAL=18900   # 5h15m in seconds
COUNT=3
ACTION="schedule"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interval) INTERVAL="$2"; shift 2 ;;
    --count)    COUNT="$2"; shift 2 ;;
    --cancel)   ACTION="cancel"; shift ;;
    -h|--help)  sed -n '1,33p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

# ---------------------------------------------------------------------------
# Cancel mode
# ---------------------------------------------------------------------------
if [[ "$ACTION" == "cancel" ]]; then
  echo "Cancelling recurring schedule…"
  if [[ -f "$PLIST" ]]; then
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "  Removed LaunchAgent: $PLIST"
  else
    echo "  No LaunchAgent at $PLIST"
  fi
  exit 0
fi

# ---------------------------------------------------------------------------
# Sanity checks
# ---------------------------------------------------------------------------
if [[ ! -x "$SCRIPT" ]]; then
  echo "ERROR: $SCRIPT not found or not executable" >&2
  exit 1
fi
if ! [[ "$INTERVAL" =~ ^[0-9]+$ ]] || (( INTERVAL < 60 )); then
  echo "ERROR: --interval must be an integer ≥ 60 seconds (got: $INTERVAL)" >&2
  exit 2
fi
mkdir -p "$LOG_DIR"
mkdir -p "$(dirname "$PLIST")"

# Pretty interval for the summary (h/m/s).
H=$(( INTERVAL / 3600 ))
M=$(( (INTERVAL % 3600) / 60 ))
S=$(( INTERVAL % 60 ))
PRETTY=""
(( H > 0 )) && PRETTY="${PRETTY}${H}h"
(( M > 0 )) && PRETTY="${PRETTY}${M}m"
(( S > 0 )) && PRETTY="${PRETTY}${S}s"
[[ -z "$PRETTY" ]] && PRETTY="${INTERVAL}s"

echo "Scheduling recurring curation:"
echo "  Interval:     $PRETTY ($INTERVAL seconds)"
echo "  Per run:      $COUNT characters from queue.txt"
echo "  LaunchAgent:  $PLIST"
echo ""

# ---------------------------------------------------------------------------
# Write the LaunchAgent plist
# ---------------------------------------------------------------------------
# StartInterval triggers on a wall-clock cadence relative to load time.
# RunAtLoad=true so the first run kicks off immediately on `launchctl load`.
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
    <string>cd "$REPO_ROOT" &amp;&amp; "$SCRIPT" --count $COUNT</string>
  </array>
  <key>StartInterval</key>
  <integer>$INTERVAL</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/launchd-recurring.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/launchd-recurring.err.log</string>
</dict>
</plist>
PLIST_EOF

echo "Wrote $PLIST"

# ---------------------------------------------------------------------------
# Load (replace if already loaded)
# ---------------------------------------------------------------------------
launchctl unload "$PLIST" 2>/dev/null || true
if ! launchctl load "$PLIST"; then
  echo "ERROR: launchctl load failed" >&2
  exit 1
fi

cat <<SUMMARY

================================================================
Recurring curation scheduled.

  Cadence:  every $PRETTY
  Per run:  $COUNT characters
  Logs:     $LOG_DIR/

What happens:
  - First run starts immediately (RunAtLoad).
  - Subsequent runs fire every $PRETTY.
  - Each run picks the next $COUNT pending entries from queue.txt and
    drafts each onto its own draft/<id> branch (caffeinate-wrapped).
  - The agent stays loaded — runs continue until you cancel.

Sleep behavior:
  - launchd does NOT wake the Mac. If the Mac sleeps through a fire,
    you get one fire on the next wake (not a backlog of missed runs).
  - For overnight unattended runs, use scripts/schedule-overnight.sh
    instead — that one uses pmset to wake the Mac at a fixed time.

To cancel:
  $0 --cancel

To see the next scheduled fire time:
  launchctl list $LABEL | grep -E 'PID|LastExitStatus'
================================================================
SUMMARY
