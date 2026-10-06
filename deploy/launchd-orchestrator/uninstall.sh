#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
AGENTS_DIR="$HOME/Library/LaunchAgents"
DAEMONS_DIR="/Library/LaunchDaemons"
SCOPE="${LAUNCHD_SCOPE:-agent}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scope)
      SCOPE="${2:-}"
      shift 2
      ;;
    --scope=*)
      SCOPE="${1#*=}"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ "$SCOPE" != "agent" && "$SCOPE" != "daemon" ]]; then
  echo "Invalid --scope: $SCOPE (expected agent|daemon)" >&2
  exit 2
fi

if [[ "$SCOPE" == "daemon" && "$EUID" -ne 0 ]]; then
  echo "LaunchDaemon uninstall requires root." >&2
  exit 1
fi

job_dir() {
  if [[ "$SCOPE" == "daemon" ]]; then
    echo "$DAEMONS_DIR"
    return
  fi
  echo "$AGENTS_DIR"
}

PLISTS=(
  "com.stocksystem.main-service.plist"
  "com.stocksystem.orchestrator.planner-tick.plist"
  "com.stocksystem.orchestrator.worker-tick.plist"
  "com.stocksystem.orchestrator.worker-daemon.plist"
)

for plist in "${PLISTS[@]}"; do
  target="$(job_dir)/$plist"
  if [[ -f "$target" ]]; then
    echo "==> Unloading $plist"
    if [[ "$SCOPE" == "daemon" ]]; then
      launchctl bootout system "$target" 2>/dev/null || true
      launchctl disable "system/${plist%.plist}" 2>/dev/null || true
    else
      launchctl unload -w "$target" 2>/dev/null || true
    fi
    echo "==> Removing $plist"
    rm -f "$target"
  fi
done

if [[ -x "$PROJECT_DIR/scripts/stop_all.sh" ]]; then
  echo "==> Stopping managed services"
  "$PROJECT_DIR/scripts/stop_all.sh" --quiet || true
fi

echo "Uninstall completed for scope=$SCOPE."
