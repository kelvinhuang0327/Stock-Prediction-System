#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

ENV_FILE_DEFAULT="$PROJECT_DIR/deploy/launchd-orchestrator/launchd.env"
ENV_FILE="${ORCHESTRATOR_LAUNCHD_ENV:-$ENV_FILE_DEFAULT}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$PROJECT_DIR"

INTERVAL_SEC="${WORKER_DAEMON_INTERVAL_SEC:-60}"
FAIL_FAST="${WORKER_DAEMON_FAIL_FAST:-0}"

echo "{\"event\":\"worker_daemon_start\",\"interval_sec\":${INTERVAL_SEC},\"at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"

while true; do
  if npm run orchestrator:worker -- --force --caller-context=background; then
    :
  else
    status=$?
    echo "{\"event\":\"worker_daemon_tick_failed\",\"status\":${status},\"at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >&2
    if [[ "$FAIL_FAST" == "1" ]]; then
      exit "$status"
    fi
  fi
  sleep "$INTERVAL_SEC"
done
