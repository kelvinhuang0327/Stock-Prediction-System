#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# stop_all.sh
#
# Stop all services started by scripts/start_all.sh.
# - Kills PID-file tracked processes.
# - Cleans stale PID files.
# - Optionally frees backend/frontend listener ports.
# ---------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RUNTIME_DIR="$PROJECT_DIR/runtime/agent_orchestrator"
PID_DIR="$RUNTIME_DIR/pids"
LOG_DIR="$PROJECT_DIR/logs/launchd"
ENV_FILE_DEFAULT="$PROJECT_DIR/deploy/launchd-orchestrator/launchd.env"

QUIET=0
for arg in "$@"; do
  case "$arg" in
    --quiet) QUIET=1 ;;
    *)
      echo "[stop_all] Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

mkdir -p "$PID_DIR" "$LOG_DIR"

ENV_FILE="${ORCHESTRATOR_LAUNCHD_ENV:-$ENV_FILE_DEFAULT}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_MODE="${FRONTEND_MODE:-shared}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
if [[ "$FRONTEND_MODE" == "shared" ]]; then
  FRONTEND_PORT="$BACKEND_PORT"
fi

BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"

STOP_LOG="$LOG_DIR/stop_all.log"

log() {
  if [[ "$QUIET" == "1" ]]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') [stop_all] $1" >>"$STOP_LOG"
  else
    echo "$(date '+%Y-%m-%d %H:%M:%S') [stop_all] $1" | tee -a "$STOP_LOG"
  fi
}

is_pid_running() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

terminate_pid() {
  local pid="$1"
  local name="$2"
  if ! is_pid_running "$pid"; then
    return 0
  fi
  log "Stopping ${name} PID ${pid}"
  kill "$pid" 2>/dev/null || true
  local i
  for ((i = 1; i <= 20; i++)); do
    if ! is_pid_running "$pid"; then
      log "${name} PID ${pid} stopped."
      return 0
    fi
    sleep 0.5
  done
  log "${name} PID ${pid} did not exit in time; force killing."
  kill -9 "$pid" 2>/dev/null || true
}

stop_from_pid_file() {
  local pid_file="$1"
  local name="$2"
  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi
  local pid
  pid="$(tr -d '[:space:]' < "$pid_file")"
  if [[ -n "$pid" ]]; then
    terminate_pid "$pid" "$name"
  fi
  rm -f "$pid_file"
}

kill_port_listener() {
  local port="$1"
  local name="$2"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    return 0
  fi
  while read -r pid; do
    [[ -z "$pid" ]] && continue
    terminate_pid "$pid" "${name}(port:${port})"
  done <<<"$pids"
}

main() {
  stop_from_pid_file "$BACKEND_PID_FILE" "backend"
  stop_from_pid_file "$FRONTEND_PID_FILE" "frontend"

  kill_port_listener "$BACKEND_PORT" "backend"
  if [[ "$FRONTEND_MODE" == "separate" || "$FRONTEND_PORT" != "$BACKEND_PORT" ]]; then
    kill_port_listener "$FRONTEND_PORT" "frontend"
  fi

  rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE"
  log "All managed services stopped."
}

main
