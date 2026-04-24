#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# uninstall.sh — Remove the autonomous scheduler launchd agent
# ---------------------------------------------------------------------------

set -euo pipefail

PLIST_NAME="com.trading.autonomous-scheduler.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"

if [[ -f "$PLIST_DEST" ]]; then
  echo "==> Unloading agent"
  launchctl unload "$PLIST_DEST" 2>/dev/null || true
  echo "==> Removing plist: $PLIST_DEST"
  rm "$PLIST_DEST"
  echo "Scheduler agent removed."
else
  echo "Plist not found at $PLIST_DEST — nothing to do."
fi
