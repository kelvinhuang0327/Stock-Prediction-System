#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install.sh — Install the autonomous scheduler as a macOS launchd agent
#
# What it does:
#   1. Creates the log directory
#   2. Makes the wrapper script executable
#   3. Copies the plist to ~/Library/LaunchAgents/
#   4. Loads the agent via launchctl (starts it immediately)
#
# To uninstall, run:  bash deploy/launchd/uninstall.sh
# ---------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

PLIST_NAME="com.trading.autonomous-scheduler.plist"
PLIST_SRC="$SCRIPT_DIR/$PLIST_NAME"
AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_DEST="$AGENTS_DIR/$PLIST_NAME"
LOG_DIR="$HOME/Library/Logs/autonomous-scheduler"
WRAPPER="$PROJECT_DIR/scripts/run-scheduler-daemon.sh"

echo "==> Creating log directory: $LOG_DIR"
mkdir -p "$LOG_DIR"

echo "==> Making wrapper executable: $WRAPPER"
chmod +x "$WRAPPER"

echo "==> Installing plist: $PLIST_DEST"
mkdir -p "$AGENTS_DIR"
cp "$PLIST_SRC" "$PLIST_DEST"

# Unload first in case a previous version is loaded
launchctl unload "$PLIST_DEST" 2>/dev/null || true

echo "==> Loading agent"
launchctl load "$PLIST_DEST"

echo ""
echo "Scheduler agent installed and started."
echo ""
echo "Status:   launchctl list | grep autonomous-scheduler"
echo "Logs:     tail -f $LOG_DIR/stdout.log"
echo "Errors:   tail -f $LOG_DIR/stderr.log"
echo "Stop:     launchctl unload $PLIST_DEST"
echo "Restart:  launchctl unload $PLIST_DEST && launchctl load $PLIST_DEST"
