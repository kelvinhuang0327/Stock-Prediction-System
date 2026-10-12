#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs/launchd"
PID_DIR="$PROJECT_DIR/runtime/agent_orchestrator/pids"
GUI_UID="$(id -u)"

echo "== launchctl list =="
launchctl list | grep com.stocksystem || true

echo
echo "== user domain =="
launchctl print "gui/${GUI_UID}/com.stocksystem.main-service" 2>/dev/null | head -n 20 || true

echo
echo "== system domain =="
launchctl print system/com.stocksystem.main-service 2>/dev/null | head -n 20 || true

echo
echo "== PID files =="
ls -la "$PID_DIR" 2>/dev/null || true

echo
echo "== Recent logs =="
for f in \
  "$LOG_DIR/main-service.stdout.log" \
  "$LOG_DIR/main-service.stderr.log" \
  "$LOG_DIR/planner-tick.stdout.log" \
  "$LOG_DIR/worker-tick.stdout.log" \
  "$LOG_DIR/worker-daemon.stdout.log"; do
  if [[ -f "$f" ]]; then
    echo "--- $f"
    tail -n 20 "$f"
  fi
done
